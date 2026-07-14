#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;
const BUILD_PATTERN = /^\d{8}\.\d+$/;
const BUILD_ONLY_ENV = 'ALLOW_BUILD_ONLY_VERSION_CHANGE';

function git(args, options = {}) {
  return execFileSync('git', args, {
    cwd: options.cwd ?? process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim();
}

export function extractAppInfo(source, label = 'index.html') {
  const marker = source.search(/\bAPP_INFO\s*=/);
  if (marker < 0) throw new Error(`Could not find APP_INFO in ${label}.`);

  const open = source.indexOf('{', marker);
  if (open < 0) throw new Error(`Could not find the APP_INFO object in ${label}.`);

  let depth = 0;
  let quote = null;
  let escaped = false;
  let close = -1;
  for (let i = open; i < source.length; i += 1) {
    const char = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') quote = char;
    else if (char === '{') depth += 1;
    else if (char === '}' && --depth === 0) {
      close = i;
      break;
    }
  }
  if (close < 0) throw new Error(`APP_INFO is not a complete object in ${label}.`);

  const objectText = source.slice(open, close + 1);
  const readString = key => {
    const match = objectText.match(new RegExp(`(?:^|[,\\n{])\\s*["']?${key}["']?\\s*:\\s*(["'])(.*?)\\1`, 's'));
    if (!match) throw new Error(`Could not extract APP_INFO.${key} from ${label}.`);
    return match[2];
  };
  return { version: readString('version'), build: readString('build') };
}

export function isRelevantFile(file) {
  const path = file.replaceAll('\\', '/');
  if (path === 'index.html' || path === 'package.json' || path === 'package-lock.json') return true;
  if (/^(tests|scripts)\//.test(path)) return true;
  // These locations are treated as app-delivered help/documentation. Repository
  // Markdown such as README.md, AGENTS.md, and docs/*.md remains external docs.
  return /^(public|help|docs\/in-app)\//.test(path);
}

export function validateChange(oldInfo, newInfo, relevantFiles, options = {}) {
  if (!SEMVER_PATTERN.test(newInfo.version)) {
    return { valid: false, message: `Invalid APP_INFO.version "${newInfo.version}"; expected MAJOR.MINOR.PATCH.` };
  }
  if (!BUILD_PATTERN.test(newInfo.build)) {
    return { valid: false, message: `Invalid APP_INFO.build "${newInfo.build}"; expected YYYYMMDD.N.` };
  }
  if (!relevantFiles.length) return { valid: true, message: 'No version bump required: only external documentation or unrelated files changed.' };

  const versionChanged = oldInfo.version !== newInfo.version;
  const buildChanged = oldInfo.build !== newInfo.build;
  if (!versionChanged && !buildChanged) {
    return { valid: false, message: `Relevant files changed (${relevantFiles.join(', ')}), but neither APP_INFO.version nor APP_INFO.build changed.` };
  }
  if (versionChanged && !buildChanged) {
    return { valid: false, message: 'APP_INFO.version changed, but APP_INFO.build did not. Update both values.' };
  }
  if (!versionChanged && buildChanged && !options.allowBuildOnly) {
    return { valid: false, message: `APP_INFO.build changed without APP_INFO.version. Set ${BUILD_ONLY_ENV}=1 only for an intentional build-only change.` };
  }
  return { valid: true, message: 'Version check passed.' };
}

export function findComparisonBase(cwd = process.cwd()) {
  try {
    const upstream = git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'], { cwd });
    return { ref: git(['merge-base', 'HEAD', upstream], { cwd }), reason: `merge base with ${upstream}` };
  } catch {
    try {
      return { ref: git(['rev-parse', 'HEAD^'], { cwd }), reason: 'HEAD^ fallback (no upstream)' };
    } catch {
      return { ref: git(['rev-parse', 'HEAD'], { cwd }), reason: 'HEAD fallback (no upstream or parent commit)' };
    }
  }
}

export function runVersionCheck({ cwd = process.cwd(), env = process.env } = {}) {
  const base = findComparisonBase(cwd);
  const oldSource = git(['show', `${base.ref}:index.html`], { cwd });
  const workingSource = readFileSync(new URL('index.html', pathToFileURL(`${cwd}/`)), 'utf8');
  const oldInfo = extractAppInfo(oldSource, `${base.ref}:index.html`);
  const newInfo = extractAppInfo(workingSource, 'working tree index.html');
  const tracked = git(['diff', '--name-only', base.ref, '--'], { cwd }).split('\n').filter(Boolean);
  const untracked = git(['ls-files', '--others', '--exclude-standard'], { cwd }).split('\n').filter(Boolean);
  const changedFiles = [...new Set([...tracked, ...untracked])];
  const relevantFiles = changedFiles.filter(isRelevantFile);
  const result = validateChange(oldInfo, newInfo, relevantFiles, {
    allowBuildOnly: /^(1|true|yes)$/i.test(env[BUILD_ONLY_ENV] ?? '')
  });

  console.log(`Comparison: ${base.reason} (${base.ref})`);
  console.log(`Old: ${oldInfo.version} / ${oldInfo.build}`);
  console.log(`New: ${newInfo.version} / ${newInfo.build}`);
  console.log(result.message);
  return result.valid ? 0 : 1;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  try {
    process.exitCode = runVersionCheck();
  } catch (error) {
    console.error(`Version check failed: ${error.message}`);
    process.exitCode = 1;
  }
}

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const checker = fileURLToPath(new URL('../scripts/check-version-bump.mjs', import.meta.url));

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function app(version = '1.2.3', build = '20260713.1', extra = '') {
  return `<script>\nconst APP_INFO = Object.freeze({\n  name: 'Court',\n  version: '${version}',\n  build: '${build}'\n});\n${extra}\n</script>\n`;
}

function repo() {
  const cwd = mkdtempSync(join(tmpdir(), 'court-version-check-'));
  git(cwd, 'init', '-q');
  git(cwd, 'config', 'user.name', 'Version Check Test');
  git(cwd, 'config', 'user.email', 'version-check@example.invalid');
  writeFileSync(join(cwd, 'index.html'), app());
  writeFileSync(join(cwd, 'README.md'), '# Court\n');
  git(cwd, 'add', '.');
  git(cwd, 'commit', '-qm', 'base');
  // A second commit makes HEAD^ available while deliberately leaving the test
  // branch without an upstream.
  writeFileSync(join(cwd, 'README.md'), '# Court\n\nExternal docs.\n');
  git(cwd, 'add', 'README.md');
  git(cwd, 'commit', '-qm', 'docs');
  return cwd;
}

function run(cwd, env = {}) {
  return spawnSync(process.execPath, [checker], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...env }
  });
}

function changeCode(cwd, version = '1.2.3', build = '20260713.1') {
  writeFileSync(join(cwd, 'index.html'), app(version, build, 'const behavior = true;'));
}

test('relevant code change with no version bump fails', () => {
  const cwd = repo();
  changeCode(cwd);
  const result = run(cwd);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /neither APP_INFO\.version nor APP_INFO\.build changed/);
});

for (const [kind, version] of [['patch', '1.2.4'], ['minor', '1.3.0']]) {
  test(`${kind} version plus build bump passes`, () => {
    const cwd = repo();
    changeCode(cwd, version, '20260713.2');
    assert.equal(run(cwd).status, 0);
  });
}

test('malformed semantic version fails', () => {
  const cwd = repo();
  changeCode(cwd, '1.2', '20260713.2');
  const result = run(cwd);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /expected MAJOR\.MINOR\.PATCH/);
});

test('malformed build fails', () => {
  const cwd = repo();
  changeCode(cwd, '1.2.4', '2026-07-13.2');
  const result = run(cwd);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /expected YYYYMMDD\.N/);
});

test('version bump without build bump fails', () => {
  const cwd = repo();
  changeCode(cwd, '1.2.4');
  const result = run(cwd);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /version changed, but APP_INFO\.build did not/);
});

test('build bump without version bump fails by default', () => {
  const cwd = repo();
  changeCode(cwd, '1.2.3', '20260713.2');
  const result = run(cwd);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /build changed without APP_INFO\.version/);
});

test('explicit environment variable allows an intentional build-only change', () => {
  const cwd = repo();
  changeCode(cwd, '1.2.3', '20260713.2');
  assert.equal(run(cwd, { ALLOW_BUILD_ONLY_VERSION_CHANGE: '1' }).status, 0);
});

test('documentation-only change passes without a bump', () => {
  const cwd = repo();
  writeFileSync(join(cwd, 'README.md'), '# Court\n\nMore external documentation.\n');
  assert.equal(run(cwd).status, 0);
});

test('uses HEAD^ when no upstream branch exists', () => {
  const cwd = repo();
  changeCode(cwd, '1.2.4', '20260713.2');
  const result = run(cwd);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /HEAD\^ fallback \(no upstream\)/);
  assert.match(result.stdout, /Old: 1\.2\.3 \/ 20260713\.1/);
});

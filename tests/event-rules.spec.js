import { test, expect } from '@playwright/test';

function fixedEvent(extra = {}) {
  return {
    id: 'rules-fixed', name: 'Summer Sand 4s', eventDate: '2026-07-18', created: 1,
    done: false, format: 'fixedTeams', teams: [
      { id: 'a', name: 'Alpha', pool: 'A', players: ['p1', 'p2', 'p3', 'p4'] },
      { id: 'b', name: 'Bravo', pool: 'A', players: ['p5', 'p6', 'p7', 'p8'] }
    ],
    sched: { start: '09:00', courts: 2, courtStyle: 'num', setMin: 25, matchMin: 45, breakMin: 10, seed: 'rules-fixed', revision: 1 },
    brackets: [], ...extra
  };
}

function rotatingEvent(extra = {}) {
  return {
    id: 'rules-rotating', name: 'Rotating Pairs', eventDate: '2026-07-18', created: 1,
    done: false, format: 'rotatingGroups', teams: [], entries: [], brackets: [],
    rotation: { entrySize: 2, teamSize: 4, rounds: 4, courts: 2, winPoints: 1, tiePoints: .5, lossPoints: 0, tiebreakers: ['winPct', 'pointDiff'], seed: 'rules-rotating', revision: 1 },
    rotationSchedule: [], ...extra
  };
}

async function seed(page, events) {
  await page.addInitScript(value => {
    localStorage.setItem('vb:players', '[]');
    localStorage.setItem('vb:games', '[]');
    localStorage.setItem('vb:events', JSON.stringify(value));
    localStorage.setItem('vb:settings', '{}');
  }, events);
  await page.goto('/');
}

test('rules defaults and migration are safe for old, malformed, and future events', async ({ page }) => {
  await seed(page, [fixedEvent({ rules: undefined })]);
  const result = await page.evaluate(() => {
    const old = { id: 'old' };
    const missing = eventRules(old);
    const malformed = normalizeRulesModel({ status: '<bad>', draft: { document: '<script>x</script>' }, revisions: 'bad' });
    const future = { schemaVersion: 99, futureField: { keep: true } };
    const futureResult = normalizeRulesModel(future);
    return {
      missing, oldHasRules: Object.hasOwn(old, 'rules'), malformed,
      futureSame: JSON.stringify(futureResult) === JSON.stringify(future),
      futureSupported: rulesModelSupported(futureResult)
    };
  });
  expect(result.missing).toMatchObject({ schemaVersion: 1, draft: null, publishedRevisionId: null, revisions: [] });
  expect(result.oldHasRules).toBe(false);
  expect(result.malformed).toMatchObject({ schemaVersion: 1, draft: null, revisions: [] });
  expect(result.futureSame).toBe(true);
  expect(result.futureSupported).toBe(false);
});

test('schema-backed rich text strips scripts, handlers, unsafe URLs, embeds, forms, and unsupported styles', async ({ page }) => {
  await seed(page, []);
  const result = await page.evaluate(() => {
    const input = `<h2 onclick="evil()">Scoring <em>rules</em></h2>
      <p style="color:red">Read <strong>this</strong> <a href="javascript:alert(1)" onmouseover="evil()">bad</a>
      <a href="https://example.com/rules" target="_self">safe</a><img src=x onerror=evil()></p>
      <aside data-callout="weather"><b>Lightning</b></aside><script>alert(1)</script>
      <iframe src="https://evil.test"></iframe><form><input value="secret"></form>`;
    const sanitized = sanitizeRulesHtml(input);
    const document = rulesDocumentFromHtml(input);
    const rendered = rulesDocumentToHtml(document);
    return { sanitized, document, rendered, stable: rendered === sanitizeRulesHtml(rendered) };
  });
  for (const value of [result.sanitized, result.rendered]) {
    expect(value).not.toMatch(/script|onclick|onmouseover|onerror|javascript:|iframe|form|input|style=/i);
    expect(value).toContain('<h2>Scoring <em>rules</em></h2>');
    expect(value).toContain('href="https://example.com/rules"');
    expect(value).toContain('rel="noopener noreferrer"');
    expect(value).toContain('data-callout="weather"');
  }
  expect(result.document).toMatchObject({ schemaVersion: 1, blocks: expect.any(Array) });
  expect(result.stable).toBe(true);
});

test('publishing creates immutable revisions and post-start changes require an explanation', async ({ page }) => {
  await seed(page, []);
  const result = await page.evaluate(() => {
    const event = {
      id: 'publish', name: 'Publish Cup', eventDate: '2026-07-17', created: 1,
      sched: { start: '08:00', courts: 1 }, teams: [], brackets: [], rules: createEmptyRulesModel()
    };
    event.rules.draft = createRulesDraft(rulesDocumentFromHtml('<h2>Scoring</h2><p>One set to 25.</p>'), {}, 100);
    const first = publishRulesRevision(event, { summary: 'Initial rules', now: new Date(2026, 6, 16, 12).getTime() });
    const firstSnapshot = JSON.stringify(event.rules.revisions[0]);
    event.rules.draft = createRulesDraft(rulesDocumentFromHtml('<h2>Scoring</h2><p>One set to 21.</p>'), {}, 200, first.id);
    let missingExplanation = '';
    try { publishRulesRevision(event, { summary: '', now: new Date(2026, 6, 17, 12).getTime() }); }
    catch (error) { missingExplanation = error.code; }
    const second = publishRulesRevision(event, { summary: 'Shortened because of heat', now: new Date(2026, 6, 17, 12).getTime() });
    return { first, second, firstUnchanged: firstSnapshot === JSON.stringify(event.rules.revisions[0]), missingExplanation, rules: event.rules };
  });
  expect(result.first.number).toBe(1);
  expect(result.second).toMatchObject({ number: 2, afterStart: true, changeSummary: 'Shortened because of heat' });
  expect(result.firstUnchanged).toBe(true);
  expect(result.missingExplanation).toBe('post-start-summary-required');
  expect(result.rules.revisions).toHaveLength(2);
  expect(result.rules.draft).toBeNull();
  expect(result.rules.publishedRevisionId).toBe(result.second.id);
});

test('rules sync merge unions concurrent revisions, tombstones drafts, and records ID conflicts', async ({ page }) => {
  await seed(page, []);
  const result = await page.evaluate(() => {
    const doc = text => rulesDocumentFromHtml(`<h2>Rules</h2><p>${text}</p>`);
    const base = createEmptyRulesModel();
    const local = { ...base, draft: createRulesDraft(doc('local draft'), {}, 300), revisions: [{ id: 'rev-a', number: 1, document: doc('A'), quickRules: {}, publishedAt: 100, changeSummary: 'A', settingsSnapshot: {}, schemaVersion: 1 }], publishedRevisionId: 'rev-a', updatedAt: 300 };
    const remote = { ...createEmptyRulesModel(), draft: null, draftDeletedAt: 400, revisions: [
      { id: 'rev-b', number: 2, document: doc('B'), quickRules: {}, publishedAt: 200, changeSummary: 'B', settingsSnapshot: {}, schemaVersion: 1 },
      { id: 'rev-a', number: 1, document: doc('different A'), quickRules: {}, publishedAt: 100, changeSummary: 'A2', settingsSnapshot: {}, schemaVersion: 1 }
    ], publishedRevisionId: 'rev-b', updatedAt: 400 };
    const merged = mergeRulesModels(local, remote);
    const reversed = mergeRulesModels(remote, local);
    const oldClient = mergeEventRecords({ id: 'event', name: 'Local', rules: local }, { id: 'event', name: 'Remote' }, true);
    const state = rulesDisplayState({ id: 'event', teams: [], brackets: [], rules: merged });
    return { merged, oldClient, state, symmetric: canonicalRulesJson(merged) === canonicalRulesJson(reversed), revisionText: merged.revisions.map(revision => rulesDocumentText(revision.document)) };
  });
  expect(result.merged.draft).toBeNull();
  expect(result.merged.draftDeletedAt).toBe(400);
  expect(result.merged.revisions.map(revision => revision.id)).toEqual(expect.arrayContaining(['rev-a', 'rev-b', expect.stringMatching(/^rev-a~conflict-/)]));
  expect(result.merged.revisions).toHaveLength(3);
  expect(result.revisionText).toEqual(expect.arrayContaining(['rulesa', 'rulesdifferent a', 'rulesb']));
  expect(result.merged.publishedRevisionId).toBe('rev-b');
  expect(result.merged.conflicts).toEqual([expect.objectContaining({ type: 'revision-id-content', revisionId: 'rev-a', alternateRevisionId: expect.stringMatching(/^rev-a~conflict-/) })]);
  expect(result.symmetric).toBe(true);
  expect(result.state).toMatchObject({ key: 'needsReview', label: 'Needs review' });
  expect(result.oldClient.name).toBe('Remote');
  expect(result.oldClient.rules.revisions).toHaveLength(1);
});

test('duplication copies editable rules into a new draft without publication identity', async ({ page }) => {
  await seed(page, []);
  const duplicated = await page.evaluate(eventInput => {
    const event = {
      ...eventInput, schedulePublications: { full: { publicToken: 'public', publicUrl: 'https://example.test/s/public', managementToken: 'private' } },
      rules: createEmptyRulesModel()
    };
    event.rules.revisions = [{ id: 'old-rev', number: 1, document: rulesDocumentFromHtml('<h2>Weather</h2><p>Stop for lightning.</p>'), quickRules: {}, publishedAt: 10, changeSummary: 'Initial', settingsSnapshot: {}, schemaVersion: 1 }];
    event.rules.publishedRevisionId = 'old-rev';
    return duplicateEventData(event, { id: 'copy', name: 'Summer Sand 4s Copy', now: 500 });
  }, fixedEvent());
  expect(duplicated.id).toBe('copy');
  expect(duplicated.name).toBe('Summer Sand 4s Copy');
  expect(duplicated.schedulePublications).toBeUndefined();
  expect(duplicated.rules).toMatchObject({ publishedRevisionId: null, revisions: [], draft: { basedOnRevisionId: null } });
  expect(JSON.stringify(duplicated.rules.draft.document)).toContain('Stop for lightning');
});

test('Rules action is prominent for fixed and rotating formats and blank draft can be saved', async ({ page }) => {
  await seed(page, [fixedEvent(), rotatingEvent()]);
  await page.locator('[data-tab="events"]:visible').first().click();
  await page.locator('.ev-row').filter({ hasText: 'Summer Sand 4s' }).click();
  await page.getByRole('button', { name: 'Rules — Not created', exact: true }).click();
  const hub = page.getByRole('dialog');
  await expect(hub.getByRole('heading', { name: 'Event Rules Hub' })).toBeVisible();
  await expect(hub.getByRole('button', { name: 'Build from event settings' })).toBeVisible();
  await expect(hub.getByRole('button', { name: 'Paste existing rules' })).toBeVisible();
  await hub.getByRole('button', { name: 'Start blank' }).click();
  const editor = page.locator('[contenteditable="true"][data-rules-editor]');
  await editor.fill('<h2>Scoring</h2><p>One set to 25.</p>');
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page.getByRole('dialog').getByText('Draft saved')).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Rules — Draft', exact: true })).toBeVisible();
});

test('public rules document has navigation, quick rules, search synonyms, revision notice, and no draft content', async ({ page }) => {
  await seed(page, []);
  const result = await page.evaluate(eventInput => {
    const event = { ...eventInput, rules: createEmptyRulesModel() };
    event.rules.revisions = [{
      id: 'public-rev', number: 2,
      document: rulesDocumentFromHtml('<h2>Ball Handling</h2><p>Open-hand placement and dinks are not allowed.</p><h2>Weather and Safety</h2><p>Lightning stops play.</p>'),
      quickRules: { teamFormat: { state: 'inherited', value: 'Fixed teams · 4 players per team' } },
      publishedAt: 200, changeSummary: 'Updated tip rule', afterStart: true, settingsSnapshot: {}, schemaVersion: 1
    }];
    event.rules.publishedRevisionId = 'public-rev';
    event.rules.draft = createRulesDraft(rulesDocumentFromHtml('<p>SECRET DRAFT</p>'), {}, 300, 'public-rev');
    const html = renderPublicEventDocument(event);
    const search = buildRulesSearchIndex(event.rules.revisions[0].document);
    return { html, tips: searchRulesIndex(search, 'tips'), weather: searchRulesIndex(search, 'weather'), direct: rulesPublicUrl({ publicUrl: 'https://example.test/s/token' }) };
  }, fixedEvent());
  expect(result.html).toContain('Overview');
  expect(result.html).toContain('Schedule');
  expect(result.html).toContain('Standings');
  expect(result.html).toContain('Bracket');
  expect(result.html).toContain('Rules');
  expect(result.html).toContain('Quick Rules');
  expect(result.html).toContain('Rules updated');
  expect(result.html).toContain('Updated tip rule');
  expect(result.html).not.toContain('SECRET DRAFT');
  expect(result.tips.count).toBeGreaterThan(0);
  expect(result.weather.count).toBeGreaterThan(0);
  expect(result.direct).toBe('https://example.test/s/token#rules');
});

test('full-event publication switches to unified HTML without changing the existing public URL', async ({ page }) => {
  const publication = { scope: 'full', publicToken: 'stable-token', publicUrl: 'https://example.test/s/stable-token', managementToken: 'private-token', contentHash: 'a'.repeat(64), createdAt: 1, updatedAt: 1, status: 'active' };
  await seed(page, [fixedEvent({ schedulePublications: { full: publication } })]);
  const result = await page.evaluate(async () => {
    const event = evts[0]; event.rules = createEmptyRulesModel();
    event.rules.draft = createRulesDraft(rulesDocumentFromHtml('<h2>Scoring</h2><p>One set to 25.</p>'), {}, 10);
    publishRulesRevision(event, { summary: 'Initial', now: new Date(2026, 6, 16, 12).getTime() });
    const before = event.schedulePublications.full.publicUrl;
    const prepared = await SchedulePublications.prepare(event.id);
    return { before, after: event.schedulePublications.full.publicUrl, title: prepared.title, html: prepared.html, direct: rulesPublicUrl(event.schedulePublications.full) };
  });
  expect(result.before).toBe(result.after);
  expect(result.direct).toBe('https://example.test/s/stable-token#rules');
  expect(result.title).toBe('Summer Sand 4s — Tournament Rules');
  expect(result.html).toContain('href="#schedule"');
  expect(result.html).toContain('href="#rules"');
  expect(result.html).toContain('One set to 25.');
});

test('format-aware templates, settings drafts, builder states, and Quick Rules remain editable', async ({ page }) => {
  await seed(page, []);
  const result = await page.evaluate(({ fixed, rotating }) => {
    const fixedTemplates = rulesTemplateOptions(fixed).map(row => row.key);
    const rotatingTemplates = rulesTemplateOptions(rotating).map(row => row.key);
    const template = rulesTemplateDocument(fixed, 'coed4s');
    const settings = rulesFromSettingsDocument(rotating);
    const quick = deriveRulesQuickRules(rotating, {
      tipRule: { state: 'custom', value: 'No open-hand tips' },
      coedRequirement: { state: 'notApplicable', value: 'Not applicable' },
      weatherPolicy: { state: 'notDecided', value: 'Not decided' }
    });
    return {
      fixedTemplates, rotatingTemplates,
      templateText: rulesDocumentText(template), settingsText: rulesDocumentText(settings), quick,
      builderTitles: RULES_BUILDER_SECTIONS.map(row => row.title)
    };
  }, { fixed: fixedEvent(), rotating: rotatingEvent() });
  expect(result.fixedTemplates).toEqual(expect.arrayContaining(['indoor6s', 'sandDoubles', 'coed4s', 'reverseCoed', 'fixedTournament', 'custom']));
  expect(result.fixedTemplates).not.toContain('rotatingPairs');
  expect(result.rotatingTemplates).toEqual(['rotatingPairs', 'custom']);
  expect(result.templateText).toContain('organizer review required');
  expect(result.templateText).toContain('weather and safety policy');
  expect(result.settingsText).toContain('pairs combine into 4s');
  expect(result.quick.tipRule).toMatchObject({ state: 'custom', value: 'No open-hand tips' });
  expect(result.quick.coedRequirement.state).toBe('notApplicable');
  expect(result.builderTitles).toEqual(expect.arrayContaining(['Governing rules and authority', 'Advancement and brackets', 'Event-day modifications']));
});

test('returning to Build Your Rules replaces generated sections instead of duplicating them', async ({ page }) => {
  await seed(page, []);
  const result = await page.evaluate(() => {
    const original = rulesDocumentFromHtml('<h2>Event rules</h2><p>Keep this introduction.</p><h2>Governing rules and authority</h2><p>Old answer.</p><h2>Organizer notes</h2><p>Keep this note.</p>');
    const generated = '<h2>Governing rules and authority</h2><p>New answer.</p>';
    const once = rulesDocumentWithBuilderSections(original, generated);
    const twice = rulesDocumentWithBuilderSections(once, generated);
    const html = rulesDocumentToHtml(twice);
    return { html, headingCount: (html.match(/Governing rules and authority/g) || []).length };
  });
  expect(result.headingCount).toBe(1);
  expect(result.html).toContain('New answer.');
  expect(result.html).not.toContain('Old answer.');
  expect(result.html).toContain('Keep this introduction.');
  expect(result.html).toContain('Keep this note.');
});

test('structured contradictions can be inherited, deferred, or recorded as intentional exceptions', async ({ page }) => {
  await seed(page, [fixedEvent()]);
  const result = await page.evaluate(async () => {
    const event = evts[0], rules = createEmptyRulesModel();
    rules.draft = createRulesDraft(rulesDocumentFromHtml('<h2>Team composition</h2><p>Six players per team.</p>'), {
      teamFormat: { state: 'custom', value: 'Fixed teams · 6 rostered players' }
    }, 10);
    event.rules = rules;
    const before = rulesSettingsMismatch(event);
    const mismatch = before[0];
    event.rules.settingsAcknowledgements.teamFormat = { resolution: 'intentionalException', fingerprint: mismatch.fingerprint, acknowledgedAt: 20 };
    const intentional = rulesSettingsMismatch(event);
    event.rules.settingsAcknowledgements.teamFormat = { resolution: 'reviewLater', fingerprint: mismatch.fingerprint, acknowledgedAt: 30 };
    const deferred = rulesSettingsMismatch(event);
    event.rules.draft.quickRules.teamFormat = rulesInheritedQuickRules(event).teamFormat;
    const inherited = rulesSettingsMismatch(event);
    return { before, intentional, deferred, inherited };
  });
  expect(result.before).toHaveLength(1);
  expect(result.intentional).toHaveLength(0);
  expect(result.deferred).toEqual([expect.objectContaining({ resolution: 'reviewLater' })]);
  expect(result.inherited).toHaveLength(0);
});

test('backup and restore preserve published history while old backups safely default to no rules', async ({ page }) => {
  await seed(page, [fixedEvent()]);
  const result = await page.evaluate(async () => {
    const event = evts[0]; event.rules = createEmptyRulesModel();
    event.rules.draft = createRulesDraft(rulesDocumentFromHtml('<h2>Weather</h2><p>Lightning stops play.</p>'), {}, 10);
    publishRulesRevision(event, { summary: 'Initial', now: new Date(2026, 6, 16, 12).getTime() });
    await saveEvents();
    const backup = { players: [], games: [], events: JSON.parse(JSON.stringify(evts)), settings: {}, v: 3 };
    evts = []; await restoreBackupData(backup);
    const restored = JSON.parse(JSON.stringify(eventRules(evts[0])));
    await restoreBackupData({ players: [], games: [], events: [{ id: 'legacy', name: 'Legacy', created: 1, teams: [], brackets: [] }], settings: {}, v: 1 });
    return { restored, legacy: eventRules(evts[0]), legacyStored: Object.hasOwn(evts[0], 'rules') };
  });
  expect(result.restored.revisions).toHaveLength(1);
  expect(result.restored.publishedRevisionId).toBe(result.restored.revisions[0].id);
  expect(result.legacy).toMatchObject({ draft: null, publishedRevisionId: null, revisions: [] });
  expect(result.legacyStored).toBe(false);
});

test('history copy and unpublish preserve the audit trail and hide rules publicly', async ({ page }) => {
  await seed(page, [fixedEvent()]);
  const result = await page.evaluate(async () => {
    const event = evts[0]; event.rules = createEmptyRulesModel();
    event.rules.draft = createRulesDraft(rulesDocumentFromHtml('<h2>Scoring</h2><p>25 points.</p>'), {}, 10);
    const revision = publishRulesRevision(event, { summary: 'Initial', now: new Date(2026, 6, 16, 12).getTime() });
    event.rules.draft = createRulesDraft(revision.document, revision.quickRules, 20, revision.id);
    const copied = JSON.parse(JSON.stringify(event.rules.draft));
    event.rules.draft = null; event.rules.publishedRevisionId = null; event.rules.unpublishedAt = 30; event.rules.publicationUpdatedAt = 30;
    const html = renderPublicEventDocument(event);
    return { copied, rules: event.rules, html };
  });
  expect(result.copied.basedOnRevisionId).toBe(result.rules.revisions[0].id);
  expect(result.rules.revisions).toHaveLength(1);
  expect(result.rules.publishedRevisionId).toBeNull();
  expect(result.html).toContain('The organizer has not published event rules');
  expect(result.html).not.toContain('25 points.');
});

test('editor paste is sanitized, toolbar fits mobile, and Cancel protects unsaved changes', async ({ page }) => {
  await seed(page, [fixedEvent()]);
  await page.locator('[data-tab="events"]:visible').first().click();
  await page.locator('.ev-row').filter({ hasText: 'Summer Sand 4s' }).click();
  await page.getByRole('button', { name: 'Rules — Not created', exact: true }).click();
  await page.getByRole('button', { name: 'Start blank' }).click();
  const editor = page.locator('[data-rules-editor]');
  await editor.evaluate(element => {
    element.focus();
    const data = new DataTransfer();
    data.setData('text/html', '<h2 onclick="evil()">Weather</h2><p><strong>Stop</strong><img src=x onerror=evil()></p><script>evil()</script>');
    element.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data }));
  });
  await expect(editor).toContainText('Weather');
  expect(await editor.innerHTML()).not.toMatch(/script|onclick|onerror|img/i);
  const toolbarOverflow = await page.locator('.rules-toolbar').evaluate(element => ({ scrollable: element.scrollWidth >= element.clientWidth, pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
  expect(toolbarOverflow.scrollable).toBe(true);
  expect(toolbarOverflow.pageOverflow).toBeLessThanOrEqual(0);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  const confirm = page.getByRole('alertdialog');
  await expect(confirm).toContainText('Discard unsaved rules edits');
  await confirm.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(editor).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Discard edits', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Event Rules Hub' })).toBeVisible();
});

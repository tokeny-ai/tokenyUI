/** Verify native-row placement, wrapping, draft retention, and teardown in headless Chromium. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const repo = path.resolve(__dirname, '../../../..');
const ts = require(path.join(repo, 'node_modules/typescript'));
const { chromium } = createRequire(path.join(repo, 'apps/web/package.json'))('playwright');
const source = path.join(repo, 'packages/client/tokeny-ui/src/desktop');
const compiled = ts.transpileModule(fs.readFileSync(path.join(source, 'ComposerLayout.ts'), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const css = fs.readFileSync(path.join(source, 'Composer.module.css'), 'utf8').replace(/:global\(([^)]+)\)/g, '$1');
const executablePath = [process.env.TOKENY_UI_CHROME, process.env.CHROME_PATH,
  ...[process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA]
    .filter(Boolean).map(base => path.join(base, 'Google/Chrome/Application/chrome.exe')),
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium',
].find(candidate => candidate && fs.existsSync(candidate));
const reports = [];

(async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.setContent(`<!doctype html><style>
      body { margin: 0; font: 14px sans-serif; }
      [data-tokeny-ui] { width: min(800px, calc(100% - 40px)); margin: 20px auto; }
      [data-slot] { display: contents; }
      .native-stack { display: flex; flex-direction: column; gap: 8px; }
      .native-row { display: flex; align-items: center; gap: 2px; padding: 0 16px 0 20px; margin-top: 4px; }
      button { box-sizing: border-box; white-space: nowrap; flex-shrink: 0; height: 28px; }
      .project { width: 180px; }
      .preset { width: 140px; }
      .pet { height: 64px; margin-bottom: -8px; }
      .native-bar { padding: 0 16px; }
      .native-card { display: flex; flex-direction: column; gap: 12px; padding-top: 8px; position: relative; box-sizing: border-box; }
      [data-attachment] { height: 25px; }
      [data-input-scroll] { overflow: auto; }
      .native-grow { position: relative; }
      [data-composer-input] { box-sizing: border-box; min-height: 52px; padding: 4px 8px 0 14px; }
      [data-composer-placeholder] { position: absolute; inset: 4px 8px auto 14px; pointer-events: none; }
      .toolbar { height: 28px; }
      ${css}
    </style><div data-tokeny-ui><div data-composer-seat><div class="native-stack">
      <header data-brand>DeepSeek Harness</header>
      <div class="native-row"><button class="project" aria-label="Choose workspace">Project folder</button>
        <div data-slot="conversation.hero.workspace"></div>
        <div data-slot="conversation.hero.agentPreset"><button class="preset">Default mode</button></div>
      </div>
      <div data-slot="conversation.input.dock"><div class="pet" data-pet></div></div>
      <div data-slot="conversation.composer.bar"><div class="native-bar"><div class="native-card" data-composer-card>
        <div data-slot="conversation.input.attachments"><div data-attachment>Attached image</div></div>
        <div data-input-scroll><div class="native-grow"><div contenteditable="true" data-composer-input>Preserve this draft</div><div data-composer-placeholder>Native placeholder</div></div></div>
        <div class="toolbar">Native controls</div>
      </div></div></div>
    </div></div></div>`);
    const before = await page.evaluate(() => ({
      row: document.querySelector('.native-row').getBoundingClientRect().bottom,
      card: document.querySelector('[data-composer-card]').getBoundingClientRect().top,
    }));
    assert.ok(before.row < before.card, 'The unadapted native row lies outside the card');
    await page.locator('[data-composer-input]').focus();
    await page.evaluate(code => {
      const module = { exports: {} };
      new Function('require', 'module', 'exports', code)(() => ({ __esModule: true, default: { controls: 'controls', card: 'card', stack: 'stack' } }), module, module.exports);
      window.nativeRow = document.querySelector('.native-row');
      window.nativeEditor = document.querySelector('[data-composer-input]');
      window.disposeComposer = module.exports.installComposerLayout(document.querySelector('[data-tokeny-ui]'));
    }, compiled);
    const contained = () => {
      const row = document.querySelector('[data-tokeny-composer-controls]');
      if (!row) return false;
      const a = row.getBoundingClientRect();
      const b = document.querySelector('[data-composer-card]').getBoundingClientRect();
      const attachment = document.querySelector('[data-attachment]').getBoundingClientRect();
      return a.top >= b.top - 1 && a.left >= b.left - 1 && a.right <= b.right + 1 && a.bottom <= attachment.top;
    };
    await page.waitForFunction(contained);
    assert.equal(await page.evaluate(() => document.activeElement === window.nativeEditor), true);
    assert.equal(await page.locator('[data-composer-input]').textContent(), 'Preserve this draft');
    const bounds = await page.evaluate(() => ({
      cardTop: document.querySelector('[data-composer-card]').getBoundingClientRect().top,
      petBottom: document.querySelector('[data-pet]').getBoundingClientRect().bottom,
      rowParent: window.nativeRow.parentElement.classList.contains('native-stack'),
      brand: document.querySelector('[data-brand]').textContent,
    }));
    assert.ok(Math.abs(bounds.cardTop - bounds.petBottom) <= 1, 'Pet feet align with the native card top');
    assert.equal(bounds.rowParent, true, 'Native controls retain their original DOM and React parent');
    assert.equal(bounds.brand, 'DeepSeek Harness');
    reports.push({ name: 'hero controls fit within card, preserve input focus/draft, and keep pet at the edge', passed: true });

    await page.evaluate(() => {
      document.querySelector('[data-composer-card]').className = 'native-card native-session-card';
      document.querySelector('.native-stack').className = 'native-stack native-hero';
      window.nativeRow.className = 'native-row';
    });
    await page.waitForFunction(contained);
    assert.equal(await page.evaluate(() => document.querySelector('[data-composer-card]').className), 'native-card native-session-card');
    assert.equal(await page.evaluate(() => {
      const row = document.querySelector('[data-tokeny-composer-controls]').getBoundingClientRect();
      const placeholder = document.querySelector('[data-composer-placeholder]').getBoundingClientRect();
      return row.bottom <= placeholder.top;
    }), true);
    reports.push({ name: 'native className updates retain measured clearance for the real scroll/grow/placeholder hierarchy', passed: true });

    await page.setViewportSize({ width: 390, height: 900 });
    await page.waitForFunction(contained);
    await page.waitForFunction(() => document.querySelector('[data-tokeny-composer-controls]').getBoundingClientRect().height > 40);
    assert.equal(await page.locator('[data-composer-input]').textContent(), 'Preserve this draft');
    reports.push({ name: 'narrow controls wrap and reserve measured height above attachments', passed: true });

    await page.evaluate(() => window.nativeRow.remove());
    await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-composer-card]')).paddingTop === '8px');
    assert.equal(await page.evaluate(() => document.querySelector('[data-composer-card]').style.getPropertyValue('--tokeny-composer-controls-height')), '');
    assert.equal(await page.locator('[data-composer-input]').textContent(), 'Preserve this draft');
    reports.push({ name: 'active nonhero composer releases the reserved top area without remounting the editor', passed: true });

    await page.evaluate(() => document.querySelector('.native-stack').insertBefore(window.nativeRow, document.querySelector('[data-slot="conversation.input.dock"]')));
    await page.waitForFunction(contained);
    await page.evaluate(() => window.disposeComposer());
    assert.equal(await page.locator('[data-tokeny-composer-controls]').count(), 0);
    assert.equal(await page.evaluate(() => document.querySelector('.native-card').className), 'native-card native-session-card');
    assert.equal(await page.locator('[data-tokeny-composer-stack], [data-tokeny-composer-card]').count(), 0);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.locator('[data-tokeny-composer-controls]').count(), 0);
    assert.deepEqual(errors, []);
    reports.push({ name: 'return to hero and disposal leave native layout intact with no deferred mutations', passed: true });
    const report = { tests: reports, limitations: ['Fixture uses native composer DOM structure and source layout controller; assembled Harness smoke covers real menus and framework bindings.'] };
    const artifact = path.join(repo, '.artifacts/tokenyUI/desktop-composer-verification.json');
    fs.writeFileSync(artifact, `${JSON.stringify(report, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } catch (error) {
    const geometry = await page.evaluate(() => {
      const selectors = ['.native-stack', '.native-row', '[data-composer-card]', '[data-attachment]', '[data-pet]'];
      return selectors.map(selector => {
        const element = document.querySelector(selector);
        return { selector, html: element?.outerHTML, bounds: element?.getBoundingClientRect().toJSON(), style: element && { position: getComputedStyle(element).position, padding: getComputedStyle(element).padding } };
      });
    });
    process.stderr.write(`${JSON.stringify({ errors, geometry }, null, 2)}\n`);
    throw error;
  } finally {
    await browser.close();
  }
})().catch(error => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });

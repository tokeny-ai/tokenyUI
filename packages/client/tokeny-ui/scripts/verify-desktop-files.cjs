/**
 * Verify the built desktop navigator against the installed 0.2.2 file-tree Factory.
 * Run after build-desktop.mjs. TOKENY_UI_DESKTOP_ROOT selects the app directory;
 * TOKENY_UI_DESKTOP_BUNDLE selects another built client.js. Reports and native
 * bundle copies belong to a unique run directory under .artifacts/tokenyUI.
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { createRequire } = require('node:module');
const repo = path.resolve(__dirname, '../../../..');
const artifactRoot = path.join(repo, '.artifacts/tokenyUI');
fs.mkdirSync(artifactRoot, { recursive: true });
const runDirectory = fs.mkdtempSync(path.join(artifactRoot, 'files-verification-'));
const pluginBundle = process.env.TOKENY_UI_DESKTOP_BUNDLE ?? path.join(artifactRoot, 'desktop-package/lib/client.js');
const appDirectory = process.env.TOKENY_UI_DESKTOP_ROOT ?? path.join(process.env.LOCALAPPDATA ?? '', 'Programs/DeepSeek Harness');
const nativeBundle = path.join(runDirectory, 'native-files-client.js');
const nativeManifest = path.join(runDirectory, 'native-files-package.json');
const nativePlatform = path.join(runDirectory, 'native-platform.js');
const extractor = path.join(runDirectory, 'extract-native.cjs');
const nativePackage = path.join(appDirectory, 'resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-client-ui-sidebar-files');
const frontendAssets = path.join(appDirectory, 'resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets');
fs.writeFileSync(extractor, `const fs = require('node:fs'), path = require('node:path');\nfs.copyFileSync(${JSON.stringify(path.join(nativePackage, 'lib/client.js'))}, ${JSON.stringify(nativeBundle)});\nfs.copyFileSync(${JSON.stringify(path.join(nativePackage, 'package.json'))}, ${JSON.stringify(nativeManifest)});\nconst assets = ${JSON.stringify(frontendAssets)};\nconst platform = fs.readdirSync(assets).filter(name => name.endsWith('.js')).map(name => fs.readFileSync(path.join(assets, name), 'utf8')).find(source => source.includes('"@deepseek-ai/dsh-client-ui-primitives":'));\nif (platform === undefined) throw new Error('Native platform module was not found');\nfs.writeFileSync(${JSON.stringify(nativePlatform)}, platform);\n`);
const extraction = spawnSync(path.join(appDirectory, 'DeepSeek Harness.exe'), [extractor], {
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, encoding: 'utf8', timeout: 30000, windowsHide: true,
});
if (extraction.error) throw extraction.error;
assert.equal(extraction.signal, null, 'Native bundle extraction must exit before its deadline');
assert.equal(extraction.status, 0, extraction.stderr || extraction.stdout || 'Native bundle extraction failed');
const nativeVersion = JSON.parse(fs.readFileSync(nativeManifest, 'utf8')).version;
assert.equal(nativeVersion, '0.2.2-rc.1', 'This verifier targets the desktop 0.2.2-rc.1 API');
const ts = require(path.join(repo, 'node_modules/typescript'));
const platformSource = fs.readFileSync(nativePlatform, 'utf8');
const primitiveSeed = platformSource.match(/"@deepseek-ai\/dsh-client-ui-primitives":(\w+)/)?.[1];
assert.ok(primitiveSeed, 'The native platform must seed UI primitives');
let primitiveExports;
function walk(node, inspect) { inspect(node); ts.forEachChild(node, child => walk(child, inspect)); }
walk(ts.createSourceFile('native-platform.js', platformSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS), node => {
  if (!ts.isVariableDeclaration(node) || node.name.getText() !== primitiveSeed) return;
  const exported = node.initializer?.arguments?.[0]?.arguments?.[0];
  assert.ok(exported && ts.isObjectLiteralExpression(exported), 'The native UI primitives export table must be readable');
  primitiveExports = new Set(exported.properties.filter(property => property.name !== undefined).map(property => property.name.text));
});
assert.ok(primitiveExports);
function assertPrimitiveReferences(filename) {
  const source = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const aliases = new Set();
  walk(source, node => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer !== undefined && ts.isCallExpression(node.initializer) && node.initializer.expression.getText() === 'require' && node.initializer.arguments[0]?.text === '@deepseek-ai/dsh-client-ui-primitives') aliases.add(node.name.text);
  });
  walk(source, node => {
    if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && aliases.has(node.expression.text)) assert.ok(primitiveExports.has(node.name.text), `Native platform does not export UI primitive: ${node.name.text}`);
  });
}
assertPrimitiveReferences(nativeBundle);
assertPrimitiveReferences(pluginBundle);
fs.writeFileSync(path.join(runDirectory, 'native-primitive-exports.json'), JSON.stringify([...primitiveExports].sort(), null, 2) + '\n');
const localRequire = createRequire(fs.realpathSync(path.join(repo, 'node_modules/@testing-library/react/package.json')));
const React = localRequire('react');
const jsx = localRequire('react/jsx-runtime');
const { JSDOM } = require(path.join(repo, 'node_modules/jsdom'));
const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost/' });
const globalNames = ['window', 'document', 'navigator', 'HTMLElement', 'MutationObserver', 'getComputedStyle', 'IS_REACT_ACT_ENVIRONMENT'];
const originalGlobals = new Map(globalNames.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
for (const key of globalNames.filter(key => key !== 'IS_REACT_ACT_ENVIRONMENT')) {
  Object.defineProperty(globalThis, key, { configurable: true, value: key === 'getComputedStyle' ? dom.window.getComputedStyle.bind(dom.window) : dom.window[key] });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { render, fireEvent, waitFor, cleanup, act } = localRequire('@testing-library/react');
const primitive = new Proxy({ classifyFileType: () => 'text' }, { get(target, key) {
  assert.ok(primitiveExports.has(key), `Native platform does not export UI primitive: ${String(key)}`);
  return target[key] ?? (props => React.createElement('svg', { 'aria-hidden': true, ...props }));
} });
const noEffect = () => {};
const store = {
  createSnapshotStore: initial => {
    let state = initial;
    const listeners = new Set();
    const notify = () => { for (const listener of [...listeners]) listener(); };
    return {
      getSnapshot: () => state,
      subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); },
      update: mutator => { const draft = Array.isArray(state) ? [...state] : { ...state }; mutator(draft); state = draft; notify(); },
      set: next => { state = next; notify(); },
    };
  },
  defineStore: spec => ({ create: () => { let state = spec.init(); const listeners = new Set(); return { getSnapshot: () => state, subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); }, actions: Object.fromEntries(Object.entries(spec.actions).map(([name, fn]) => [name, (...args) => { fn(state, ...args); for (const listener of listeners) listener(); }])) }; } }),
};
function loadBundle(filename, extra = '') {
  let source = fs.readFileSync(filename, 'utf8');
  if (extra) source = source.replace('return module.exports;', `${extra}\nreturn module.exports;`);
  let output;
  const modules = { react: React, 'react/jsx-runtime': jsx, '@deepseek-ai/dsh-client-ui-primitives': primitive, '@deepseek-ai/dsh-client-store': store, '@deepseek-ai/cordis': {}, '@deepseek-ai/dsh-client-ui-slots': {} };
  new Function('window', source)({ __ModuleLoader__: { load(registration) { output = registration.factory(name => { assert.ok(name in modules, `Unexpected browser dependency: ${name}`); return modules[name]; }); } } });
  assert.ok(output);
  return output;
}
const official = loadBundle(nativeBundle, 'exports.__addresses = { sessionFileAddress, parseFileAddress };');
let factory;
let nativeDictionary;
official.apply({
  remote: {}, sidebarRight: {},
  sidebarRightTabs: { entries: () => [], candidates: () => [] },
  locale: { bind: () => key => key, register: (name, values) => { nativeDictionary = values.en; return noEffect; } },
  inject: noEffect,
  slots: { registerFactory: (options, component) => { if (options.name === 'sidebar.files.tree') factory = component; return noEffect; }, inject: noEffect },
  effect: (fn, label) => /tree factory|dictionaries/.test(label) ? fn() : noEffect,
});
assert.ok(factory, 'Installed native tree Factory registered');
const plugin = loadBundle(pluginBundle);
let registration;
const dictionaries = new Map();
const opened = [];
const requests = [];
let readDirectory;
const ctx = {
  remote: { workspaceFiles: { list: (id, location, signal) => { requests.push({ id, path: location, signal }); return readDirectory(id, location, signal); } } },
  sidebarRight: { openResource: address => opened.push(address) },
  locale: { register: (name, dictionary) => { dictionaries.set(name, dictionary.en); return noEffect; } },
  slots: { inject: (name, fn) => name === 'tokenyUI.files' ? fn() : noEffect, register: (options, component) => { registration = { options, component }; return noEffect; } },
  effect: (fn, label) => /file labels|left file navigator/.test(label) ? fn() : noEffect,
  inject: (services, fn) => services.includes('remote.workspaceFiles') ? fn(ctx) : noEffect,
};
plugin.apply(ctx);
assert.ok(registration, 'Built tokenyUI file explorer registered');
const callbacks = registration.options.inject();
const factoryTranslate = key => nativeDictionary[key] ?? key;
const translate = key => dictionaries.get('tokenyUI.files')[key] ?? key;
const renderFactorySlot = (name, input) => { assert.equal(name, 'sidebar.files.tree'); return React.createElement(factory, { ...input, t: factoryTranslate, useFactorySlot: (name, fallback) => fallback }); };
let snapshot;
const Component = registration.component;
function element() {
  const sessionId = Object.values(snapshot?.byId ?? {})[0]?.id;
  const sessions = {
    ...snapshot,
    byId: Object.fromEntries(Object.values(snapshot?.byId ?? {}).map(row => [row.id, row])),
  };
  return React.createElement(Component, { ...callbacks, workspaceId: 'project-a', sessionId, useSessions: selector => selector(sessions), renderFactorySlot, t: translate });
}
const ok = entries => ({ ok: true, value: { entries, truncated: false } });
const root = 'D:/项目 空格';
const file = 'a #?%中文.md';
let rootEntries = [{ name: 'src', type: 'directory' }, { name: file, type: 'file' }];
readDirectory = async (id, location) => location === root ? ok(rootEntries) : ok([{ name: '测试%.ts', type: 'file' }]);
snapshot = { byId: { first: { id: 'session-a', cwd: root, retainedBy: { mainView: 1 } } } };
const report = [];
(async () => {
  const view = render(element());
  await waitFor(() => assert.ok(view.getByRole('button', { name: file })));
  assert.equal(requests[0].path, root);
  fireEvent.click(view.getByRole('button', { name: 'src' }));
  await waitFor(() => assert.ok(view.getByRole('button', { name: '测试%.ts' })));
  assert.ok(requests.some(request => request.path === `${root}/src`));
  fireEvent.click(view.getByRole('button', { name: '测试%.ts' }));
  assert.equal(opened.at(-1), official.__addresses.sessionFileAddress('session-a', `${root}/src/测试%.ts`));
  assert.deepEqual(official.__addresses.parseFileAddress(opened.at(-1)), { scope: 'session', sessionId: 'session-a', path: `${root}/src/测试%.ts` });
  report.push('Installed 0.2.2 native tree rendered directory/file fields and opened a nested Unicode file through the built plugin.');
  rootEntries = [{ name: file, type: 'file' }];
  fireEvent.click(view.getByRole('button', { name: 'Refresh files' }));
  await waitFor(() => assert.ok(view.queryByRole('button', { name: 'src' }) === null));
  assert.ok(view.queryByRole('button', { name: '测试%.ts' }) === null);
  report.push('Refreshing a removed directory pruned its cached descendants.');
  for (const location of ['D:/项目 空格/a #?%中文.md', 'C:/a.txt', '/etc/配置 文件.json', '//server/share/目录/a.md']) {
    callbacks.openFile('session-a', location);
    assert.equal(opened.at(-1), official.__addresses.sessionFileAddress('session-a', location));
    assert.equal(official.__addresses.parseFileAddress(opened.at(-1)).path, location);
  }
  report.push('Windows drive, UNC, POSIX, Unicode, space, #, ?, and % addresses matched the installed native encoder/parser.');
  for (const directory of ['C:/', '/']) {
    const start = requests.length;
    readDirectory = async () => ok([{ name: 'root-file.txt', type: 'file' }]);
    snapshot = { byId: { root: { id: 'session-root', cwd: directory, retainedBy: { mainView: 1 } } } };
    view.rerender(element());
    await waitFor(() => assert.ok(view.getByRole('button', { name: 'root-file.txt' })));
    assert.equal(requests[start].path, directory);
    fireEvent.click(view.getByRole('button', { name: 'root-file.txt' }));
    assert.equal(official.__addresses.parseFileAddress(opened.at(-1)).path, `${directory}root-file.txt`);
  }
  report.push('Windows drive root and POSIX filesystem root retained correct request paths and native file rows.');
  let release;
  readDirectory = (id, location, signal) => id === 'session-old' ? new Promise(resolve => { release = resolve; }) : Promise.resolve(ok([{ name: 'current.txt', type: 'file' }]));
  snapshot = { byId: { old: { id: 'session-old', cwd: 'D:/old', retainedBy: { mainView: 1 } } } };
    view.rerender(element());
  await waitFor(() => assert.equal(requests.at(-1).id, 'session-old'));
  const oldSignal = requests.at(-1).signal;
  snapshot = { byId: { next: { id: 'session-new', cwd: 'D:/new', retainedBy: { mainView: 1 } } } };
    view.rerender(element());
  await waitFor(() => assert.ok(view.getByRole('button', { name: 'current.txt' })));
  assert.equal(oldSignal.aborted, true);
  await act(async () => { release(ok([{ name: 'stale.txt', type: 'file' }])); });
  assert.ok(view.queryByRole('button', { name: 'stale.txt' }) === null);
  report.push('Switching the main Session cancelled a pending listing and suppressed its late response.');
  const failure = { ok: false, error: { code: 'workspace-file/not-found', message: 'Directory removed' } };
  readDirectory = async () => failure;
  fireEvent.click(view.getByRole('button', { name: 'Refresh files' }));
  await waitFor(() => assert.ok(view.getByText('Directory removed')));
  report.push('Native Remote failure messages remained visible in the tree.');
  cleanup();
  fs.writeFileSync(path.join(runDirectory, 'verification.json'), JSON.stringify({ passed: report.length, nativeVersion, pluginBundle, checks: report, scope: 'Built tokenyUI browser bundle + installed native FileTree Factory in jsdom; fixture Remote, no desktop/profile mutation.' }, null, 2) + '\n');
  console.log(report.map((line, index) => `${index + 1}. ${line}`).join('\n'));
  console.log(`PASS ${report.length} focused checks`);
  console.log(`Report: ${path.join(runDirectory, 'verification.json')}`);
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  cleanup();
  dom.window.close();
  for (const [key, descriptor] of originalGlobals) {
    if (descriptor === undefined) delete globalThis[key];
    else Object.defineProperty(globalThis, key, descriptor);
  }
});




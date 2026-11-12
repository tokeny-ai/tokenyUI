/** Focused companion checks against the real preference engine and React components. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const repo = path.resolve(__dirname, '../../../..');
const ts = require(path.join(repo, 'node_modules/typescript'));
const localRequire = createRequire(fs.realpathSync(path.join(repo, 'node_modules/@testing-library/react/package.json')));
const React = localRequire('react');
const { JSDOM } = require(path.join(repo, 'node_modules/jsdom'));
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'MutationObserver', 'localStorage']) {
  Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] });
}
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { render, fireEvent, cleanup, act } = localRequire('@testing-library/react');
let reduced = false;
const mediaListeners = new Set();
window.matchMedia = () => ({ get matches() { return reduced; }, addEventListener: (_key, fn) => mediaListeners.add(fn), removeEventListener: (_key, fn) => mediaListeners.delete(fn) });
document.hasFocus = () => true;
Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
let observed = 0;
globalThis.ResizeObserver = class { observe() { observed++; } disconnect() { observed--; } };
let intersectionCallback;
const intersections = new Map();
globalThis.IntersectionObserver = class {
  constructor(fn) { intersectionCallback = fn; this.callback = fn; }
  observe(element) { observed++; this.element = element; intersections.set(element, this.callback); }
  disconnect() { observed--; intersections.delete(this.element); }
};
Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get() { return this.hasAttribute('data-tokeny-pet-rail') ? 800 : 0; } });
const clock = { now: 0, serial: 0, tasks: new Map() };
function later(fn, duration) { const id = ++clock.serial; clock.tasks.set(id, { at: clock.now + duration, fn }); return id; }
function clear(id) { clock.tasks.delete(id); }
function tick(duration) {
  const end = clock.now + duration;
  while (true) {
    const first = [...clock.tasks].filter(([, task]) => task.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
    if (first === undefined) break;
    clock.tasks.delete(first[0]); clock.now = first[1].at; first[1].fn();
  }
  clock.now = end;
}
const modules = new Map();
function load(filename) {
  if (modules.has(filename)) return modules.get(filename).exports;
  if (/\.(webp|css)$/.test(filename)) return filename.endsWith('.webp') ? { default: `fixture:${path.basename(filename)}` } : { default: new Proxy({}, { get: (_object, key) => String(key) }) };
  const module = { exports: {} }; modules.set(filename, module);
  const ownRequire = createRequire(filename);
  const requireModule = (name) => {
    if (name === 'react') return React;
    if (name === 'react/jsx-runtime') return localRequire('react/jsx-runtime');
    if (name === '@deepseek-ai/dsh-client-store') return load(path.join(repo, 'packages/client/runtime/src/client/contract/store.ts'));
    if (name === '@deepseek-ai/dsh-client-ui-primitives') return {
      // The native Menu's portal and keyboard behavior are exercised by smoke-desktop.mjs.
      Menu: ({ anchor, open, items, onSelect, onClose }) => React.createElement(React.Fragment, null, anchor,
        open && React.createElement('div', { role: 'menu' }, items.map(item => React.createElement('button', { key: item.id, role: 'menuitem', disabled: item.disabled, onClick: () => { onSelect(item.id); onClose(); } }, item.label)))),
    };
    if (name.startsWith('.')) return load(path.resolve(path.dirname(filename), name));
    return ownRequire(name);
  };
  const result = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
  new Function('require', 'module', 'exports', 'setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', result.outputText)(
    requireModule, module, module.exports, later, clear, fn => later(() => fn(clock.now), 16), clear);
  return module.exports;
}
const petRoot = path.join(repo, 'packages/client/tokeny-ui/src/desktop/pets');
const { createPetController } = load(path.join(petRoot, 'preferences.ts'));
const { SpritePlayer } = load(path.join(petRoot, 'SpritePlayer.tsx'));
const { InputPet } = load(path.join(petRoot, 'InputPet.tsx'));
const { PetSettings } = load(path.join(petRoot, 'PetSettings.tsx'));
const { zh } = load(path.join(petRoot, 'locales.ts'));
const reports = [];
function check(name, run) { run(); reports.push({ name, passed: true }); cleanup(); assert.equal(clock.tasks.size, 0, 'unmount must cancel all pet timers'); assert.equal(observed, 0, 'unmount must disconnect all observers'); }
function hook(source) { return selector => React.useSyncExternalStore(source.subscribe, () => selector(source.getSnapshot())); }
try {
  check('stored choices validate and survive controller recreation', () => {
    localStorage.setItem('dsh.tokenyUI.pet', '{invalid');
    assert.equal(createPetController().state.getSnapshot().enabled, true);
    localStorage.setItem('dsh.tokenyUI.pet', JSON.stringify({ enabled: false, skinId: 'external-unavailable', sleeping: 'yes' }));
    const controller = createPetController();
    assert.deepEqual(controller.state.getSnapshot(), { enabled: false, skinId: 'orange-cat', sleeping: false, saveError: false });
    controller.setSkinId('octopus'); controller.setSleeping(true); controller.setEnabled(true);
    assert.deepEqual(JSON.parse(localStorage.getItem('dsh.tokenyUI.pet')), { enabled: true, skinId: 'octopus', sleeping: true });
    assert.equal(createPetController().state.getSnapshot().skinId, 'octopus');
    const dispose = controller.startPersistence();
    window.dispatchEvent(new window.StorageEvent('storage', { key: 'dsh.tokenyUI.pet', newValue: '{invalid' }));
    assert.equal(controller.state.getSnapshot().skinId, 'octopus');
    window.dispatchEvent(new window.StorageEvent('storage', { key: 'dsh.tokenyUI.pet', newValue: JSON.stringify({ enabled: false, skinId: 'ai-robot', sleeping: false }) }));
    assert.equal(controller.state.getSnapshot().skinId, 'ai-robot');
    dispose();
    window.dispatchEvent(new window.StorageEvent('storage', { key: 'dsh.tokenyUI.pet', newValue: null }));
    assert.equal(controller.state.getSnapshot().skinId, 'ai-robot', 'disposed persistence must ignore new events');
  });
  check('storage failures keep live choices and support an explicit retry', () => {
    const storage = globalThis.localStorage;
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
      getItem: () => null,
      setItem: () => { throw new Error('Quota exceeded'); },
    } });
    const controller = createPetController();
    try {
      controller.setEnabled(false);
      assert.equal(controller.state.getSnapshot().enabled, false);
      assert.equal(controller.state.getSnapshot().saveError, true);
    } finally { Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage }); }
    controller.retry();
    assert.equal(controller.state.getSnapshot().saveError, false);
    assert.equal(JSON.parse(storage.getItem('dsh.tokenyUI.pet')).enabled, false);
  });
  check('sprite pauses offscreen, hidden, or reduced and releases observers', () => {
    const view = render(React.createElement(SpritePlayer, { src: 'fixture:cat', action: 'idle' }));
    const sprite = view.container.querySelector('[data-tokeny-pet-action]');
    assert.equal(sprite.style.backgroundPosition, '0px 0px');
    act(() => tick(500)); assert.equal(sprite.style.backgroundPosition, '-64px 0px');
    act(() => intersectionCallback([{ isIntersecting: false }])); assert.equal(clock.tasks.size, 0);
    act(() => intersectionCallback([{ isIntersecting: true }])); assert.equal(clock.tasks.size, 1);
    reduced = true; act(() => { for (const listener of mediaListeners) listener(); }); assert.equal(clock.tasks.size, 0);
    reduced = false; act(() => { for (const listener of mediaListeners) listener(); }); assert.equal(clock.tasks.size, 1);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    act(() => document.dispatchEvent(new window.Event('visibilitychange'))); assert.equal(clock.tasks.size, 0);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  });
  check('settings change the live pet without editing or blurring the native input', () => {
    localStorage.clear();
    const controller = createPetController();
    const props = { ...controller, usePet: hook(controller.state), t: key => zh[key], sessionId: 'pet-session', session: { running: false }, input: { phase: 'plain' }, useSessionStatus: selector => selector(new Map()) };
    const view = render(React.createElement('div', null,
      React.createElement('div', { 'data-slot': 'conversation.input.dock' }, React.createElement(InputPet, props)),
      React.createElement('div', { 'data-composer-card': true }, React.createElement('textarea', { defaultValue: 'Keep this draft' })),
      React.createElement(PetSettings, props)));
    const rail = view.container.querySelector('[data-tokeny-pet-rail]');
    assert.equal(clock.tasks.size, 2, 'visible idle companion schedules sprite frames and an occasional walk');
    act(() => intersections.get(rail)([{ isIntersecting: false }]));
    assert.equal(clock.tasks.size, 0, 'offscreen rail pauses both sprite animation and automatic walking');
    act(() => intersections.get(rail)([{ isIntersecting: true }]));
    const textarea = view.container.querySelector('textarea'); act(() => textarea.focus());
    const pet = view.container.querySelector('[data-tokeny-pet]');
    fireEvent.mouseDown(pet); fireEvent.click(pet);
    assert.equal(document.activeElement, textarea); assert.equal(textarea.value, 'Keep this draft');
    assert.equal(view.container.querySelector('[data-tokeny-pet-action]').dataset.tokenyPetAction, 'pet');
    fireEvent.change(view.getByLabelText(zh.skin), { target: { value: 'rainbow-cloud' } });
    assert.equal(view.container.querySelector('[data-tokeny-pet]').dataset.tokenyPetSkin, 'rainbow-cloud');
    fireEvent.click(view.getByLabelText(zh.sleeping));
    assert.equal(view.container.querySelector('[data-tokeny-pet]').dataset.tokenyPetSleeping, 'true');
    fireEvent.click(view.container.querySelector('[data-tokeny-pet]'));
    assert.equal(controller.state.getSnapshot().sleeping, false);
    fireEvent.contextMenu(view.container.querySelector('[data-tokeny-pet]'));
    fireEvent.click(view.getByRole('menuitem', { name: zh.hide }));
    assert.equal(view.container.querySelector('[data-tokeny-pet-rail]'), null);
    assert.equal(textarea.value, 'Keep this draft');
    fireEvent.click(view.getByLabelText(zh.enabled));
    assert.ok(view.container.querySelector('[data-tokeny-pet]'));
    assert.equal(createPetController().state.getSnapshot().skinId, 'rainbow-cloud');
  });
  check('native running and pending-interaction facts select the activity animation', () => {
    localStorage.clear(); const controller = createPetController();
    const base = { ...controller, usePet: hook(controller.state), t: key => zh[key], sessionId: 'pet-session', session: { running: true }, input: { phase: 'plain' }, useSessionStatus: selector => selector(new Map()) };
    const view = render(React.createElement(InputPet, base));
    assert.equal(view.container.querySelector('[data-tokeny-pet-action]').dataset.tokenyPetAction, 'thinking');
    view.rerender(React.createElement(InputPet, { ...base, input: { phase: 'sending' } }));
    assert.equal(view.container.querySelector('[data-tokeny-pet-action]').dataset.tokenyPetAction, 'working');
    view.rerender(React.createElement(InputPet, { ...base, useSessionStatus: selector => selector(new Map([['pet-session', { pendingInteraction: { key: 'approval' } }]])) }));
    assert.equal(view.container.querySelector('[data-tokeny-pet-action]').dataset.tokenyPetAction, 'attention');
  });
  process.stdout.write(JSON.stringify({ passed: reports.length, checks: reports }, null, 2) + '\n');
} finally { cleanup(); dom.window.close(); }

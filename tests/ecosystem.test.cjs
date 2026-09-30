// Behaviour of the Value Compass cross-links: the vendored vc-shell.js (registry
// deep links) and app.js syncEcosystemLinks (shell first, static href fallback).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

function fakeWindow({ search = '', stored = null } = {}) {
  const attributes = { 'data-theme': 'light' };
  const listeners = {};
  const storage = new Map(stored ? [['theme', stored]] : []);
  const documentElement = {
    dataset: {},
    getAttribute: name => attributes[name] ?? null,
    setAttribute: (name, value) => { attributes[name] = String(value); if (name === 'data-theme') documentElement.dataset.theme = String(value); },
  };
  documentElement.dataset.theme = 'light';
  const shell = { getAttribute: name => (name === 'tool' ? 'all-about-gold' : null) };
  const document = {
    documentElement,
    links: [],
    querySelector: selector => (selector.startsWith('vc-shell') ? shell : null),
    querySelectorAll: selector => (selector === 'a[data-vc-tool]' ? document.links : []),
    addEventListener: (type, fn) => { (listeners[type] ||= []).push(fn); },
    dispatchEvent: event => { (listeners[event.type] || []).forEach(fn => fn(event)); return true; },
  };
  const window = {
    document,
    location: { search, pathname: '/all-about-gold/', hash: '' },
    history: { state: null, replaceState() {} },
    localStorage: {
      getItem: key => (storage.has(key) ? storage.get(key) : null),
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: key => storage.delete(key),
    },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    addEventListener() {},
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init && init.detail; } },
    MutationObserver: class { observe() {} },
    URL, URLSearchParams,
  };
  window.window = window; window.self = window; window.top = window;
  return { window, storage, listeners };
}

function load(files, options) {
  const env = fakeWindow(options);
  const context = vm.createContext(env.window);
  for (const file of files) vm.runInContext(read(file), context, { filename: file });
  return { ...env, context };
}

function syncSource() {
  // Top-level helpers of app.js that do not touch the page DOM on load.
  const app = read('static/js/app.js');
  const start = app.indexOf('const currentTheme');
  const end = app.indexOf('// The inline vc-theme-boot block');
  assert.ok(start > 0 && end > start, 'syncEcosystemLinks block not found in app.js');
  return app.slice(start, end) + '\nthis.syncEcosystemLinks = syncEcosystemLinks;';
}

const link = dataset => ({ dataset, href: dataset.fallback });

test('registry deep links used by the page resolve to the sibling tools', () => {
  const { window } = load(['static/vc-shell.js']);
  const shell = window.VCShell;
  assert.equal(shell.linkTo('eiayn', { code: '411060' }),
    'https://ducklove.github.io/eiayn/?code=411060&theme=light&from=all-about-gold');
  assert.equal(shell.linkTo('eiayn', { code: 'gld' }),
    'https://ducklove.github.io/eiayn/?code=GLD&theme=light&from=all-about-gold');
  assert.equal(shell.linkTo('gold_gap', { asset: 'gold' }),
    'https://ducklove.github.io/gold_gap/?asset=gold&theme=light&from=all-about-gold');
  assert.match(shell.linkTo('value-invest', {}), /^https:\/\/ducklove\.duckdns\.org:3691\/.*theme=light&from=all-about-gold$/);
});

test('theme toggle through VCShell stores the shared key and emits vc:themechange', () => {
  const { window, storage, listeners, context } = load(['static/vc-shell.js']);
  vm.runInContext(syncSource(), context);
  const eiayn = link({ vcTool: 'eiayn', vcCode: '132030', fallback: 'https://ducklove.github.io/eiayn/?code=132030' });
  window.document.links.push(eiayn);
  window.document.addEventListener('vc:themechange', () => context.syncEcosystemLinks());
  context.syncEcosystemLinks();
  assert.match(eiayn.href, /code=132030&theme=light&from=all-about-gold$/);
  window.VCShell.setTheme('dark');
  assert.equal(storage.get('theme'), 'dark');
  assert.equal(window.document.documentElement.getAttribute('data-theme'), 'dark');
  assert.ok(listeners['vc:themechange'].length >= 1);
  assert.match(eiayn.href, /code=132030&theme=dark&from=all-about-gold$/);
});

test('without the shell, links keep their static target and carry the theme', () => {
  const { window, context } = load([]);
  vm.runInContext(syncSource(), context);
  window.document.documentElement.dataset.theme = 'dark';
  const gap = link({ vcTool: 'gold_gap', vcAsset: 'gold', fallback: 'https://ducklove.github.io/gold_gap/?asset=gold' });
  const hub = link({ vcTool: 'value-invest', fallback: 'https://ducklove.duckdns.org:3691/' });
  window.document.links.push(gap, hub);
  context.syncEcosystemLinks();
  assert.equal(gap.href, 'https://ducklove.github.io/gold_gap/?asset=gold&theme=dark');
  assert.equal(hub.href, 'https://ducklove.duckdns.org:3691/?theme=dark');
});

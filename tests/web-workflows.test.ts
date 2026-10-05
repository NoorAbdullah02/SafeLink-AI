import assert from 'node:assert/strict';
import { register } from 'node:module';
import { after, afterEach, before, beforeEach, test } from 'node:test';
import { act, createElement } from 'react';
import type { Root } from 'react-dom/client';
import { Window } from 'happy-dom';
import type { ScanResult } from '../shared/types';

// These tests render the real workspace with isolated DOM and deferred transport
// fixtures. The DOM shim cannot verify geometry; browser layout QA is separate.
const browser = new Window({ url: 'https://safelink.test/#workspace' });
const installedGlobals = new Map<string, PropertyDescriptor | undefined>();
let root: Root;
let App: typeof import('../web/App').default;
let createRoot: typeof import('react-dom/client').createRoot;
let currentUser: ReturnType<typeof user> | null;
let handler: (path: string, options: RequestInit) => Response | Promise<Response>;
let requests: Array<{ path: string; options: RequestInit }>;
let scrolled: Element[];
let scrolledIntoView: Element[];

function user(name = 'Initial Name') {
  return {
    id: 'qa-user',
    name,
    email: 'qa@example.test',
    role: 'user',
    verified: true,
    simpleMode: false,
  };
}

function response(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function scan(id: string, level = 'Low Risk'): ScanResult {
  return {
    id,
    kind: 'url',
    score: level === 'Low Risk' ? 0 : 30,
    level,
    threatType: 'Controlled fixture',
    preview: id + '.example',
    evidence: [],
    checks: [{ name: 'Local rules', status: 'complete', detail: 'Synthetic test content.' }],
    explanation: 'Controlled scan result.',
    aiExplanation: null,
    recommendation: 'Check independently.',
    urls: ['https://' + id + '.example'],
    phones: [],
    createdAt: '2026-10-05T00:00:00.000Z',
    persisted: true,
    saved: false,
  };
}

function fallback(path: string, options: RequestInit) {
  if (path === '/api/health')
    return response({ storage: 'temporary-memory', email: true, ai: false, intelligence: false });
  if (path === '/api/me')
    return currentUser ? response(currentUser) : response({ error: 'Sign in required.' }, 401);
  if (path === '/api/graph') return response({ nodes: [], edges: [] });
  if (path === '/api/categories') return response(['Phishing']);
  if (path === '/api/auth/logout') {
    currentUser = null;
    return response({ ok: true });
  }
  if ((options.method || 'GET') === 'GET') return response([]);
  throw new Error('Unexpected mocked request: ' + (options.method || 'GET') + ' ' + path);
}

async function settle() {
  await act(async () => {
    for (let tick = 0; tick < 3; tick++) await new Promise<void>((done) => setImmediate(done));
  });
}

function element<T extends HTMLElement = HTMLElement>(selector: string): T {
  const found = document.querySelector<T>(selector);
  assert.ok(found, 'Missing element: ' + selector);
  return found;
}

function button(text: string, scope: ParentNode = document): HTMLButtonElement {
  const found = Array.from(scope.querySelectorAll<HTMLButtonElement>('button')).find(
    (entry) => entry.textContent?.trim() === text,
  );
  assert.ok(found, 'Missing button: ' + text);
  return found;
}

async function click(target: HTMLElement) {
  await act(async () => target.click());
  await settle();
}

async function edit(target: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype =
    target.tagName === 'TEXTAREA'
      ? browser.HTMLTextAreaElement.prototype
      : browser.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  assert.ok(setter);
  await act(async () => {
    setter.call(target, value);
    target.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function submit(form: HTMLFormElement) {
  await act(async () =>
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
  );
  await settle();
}

async function renderWorkspace() {
  await act(async () => root.render(createElement(App)));
  await settle();
}

before(async () => {
  const values: Record<string, unknown> = {
    window: browser,
    document: browser.document,
    navigator: browser.navigator,
    location: browser.location,
    history: browser.history,
    localStorage: browser.localStorage,
    HTMLElement: browser.HTMLElement,
    HTMLInputElement: browser.HTMLInputElement,
    HTMLTextAreaElement: browser.HTMLTextAreaElement,
    Element: browser.Element,
    Node: browser.Node,
    Event: browser.Event,
    KeyboardEvent: browser.KeyboardEvent,
    MouseEvent: browser.MouseEvent,
    MutationObserver: browser.MutationObserver,
    getComputedStyle: browser.getComputedStyle.bind(browser),
    requestAnimationFrame: browser.requestAnimationFrame.bind(browser),
    cancelAnimationFrame: browser.cancelAnimationFrame.bind(browser),
    matchMedia: browser.matchMedia.bind(browser),
    confirm: () => true,
    IS_REACT_ACT_ENVIRONMENT: true,
    fetch: (url: string | URL | Request, options: RequestInit = {}) => {
      const path = new URL(String(url), 'https://safelink.test').pathname;
      requests.push({ path, options });
      return Promise.resolve(handler(path, options));
    },
  };
  for (const [name, value] of Object.entries(values)) {
    installedGlobals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
  browser.scrollTo = () => {};
  browser.HTMLElement.prototype.scrollIntoView = function () {
    scrolledIntoView.push(this as unknown as Element);
  };
  browser.HTMLElement.prototype.scrollTo = function () {
    scrolled.push(this as unknown as Element);
  };
  browser.HTMLElement.prototype.getClientRects = function () {
    return [{ width: 10, height: 10 }] as unknown as ReturnType<
      typeof browser.HTMLElement.prototype.getClientRects
    >;
  };
  // Node's asynchronous loader API is available throughout the supported Node
  // range. Only frontend CSS is ignored; geometry stays in browser QA.
  const webRoot = new URL('../web/', import.meta.url).href;
  const cssLoader = `export async function load(url, context, nextLoad) {
    if (url.startsWith(${JSON.stringify(webRoot)}) && url.endsWith('.css'))
      return { format: 'module', source: 'export default {};', shortCircuit: true };
    return nextLoad(url, context);
  }`;
  register('data:text/javascript,' + encodeURIComponent(cssLoader), import.meta.url);
  ({ createRoot } = await import('react-dom/client'));
  ({ default: App } = await import('../web/App'));
});

beforeEach(() => {
  currentUser = null;
  requests = [];
  scrolled = [];
  scrolledIntoView = [];
  handler = fallback;
  browser.document.body.innerHTML = '<div id="root"></div>';
  browser.history.replaceState({}, '', 'https://safelink.test/#workspace');
  browser.localStorage.clear();
  root = createRoot(element('#root'));
});

afterEach(async () => {
  await act(async () => root.unmount());
  await settle();
});

after(async () => {
  await browser.happyDOM.abort();
  for (const [name, original] of installedGlobals) {
    if (original) Object.defineProperty(globalThis, name, original);
    else Reflect.deleteProperty(globalThis, name);
  }
});

test('clipboard permission wait locks input, consent, tabs and duplicate paste', async () => {
  const clipboard = deferred<string>();
  let reads = 0;
  Object.defineProperty(browser.navigator, 'clipboard', {
    configurable: true,
    value: {
      readText: () => {
        reads++;
        return clipboard.promise;
      },
    },
  });
  handler = (path, options) =>
    path === '/api/scans' ? response(scan('pasted')) : fallback(path, options);
  await renderWorkspace();
  const consent = element<HTMLInputElement>('.scan-options input[type="checkbox"]');
  await click(consent);
  assert.equal(consent.checked, true);
  await click(element('.btn-paste-quick'));
  assert.equal(consent.disabled, true);
  assert.equal(element<HTMLTextAreaElement>('#scan-input').disabled, true);
  assert.equal(element<HTMLButtonElement>('.btn-paste-autoscan').disabled, true);
  assert.ok(
    Array.from(document.querySelectorAll<HTMLButtonElement>('.scan-tabs button')).every(
      (tab) => tab.disabled,
    ),
  );
  await click(element('.btn-paste-autoscan'));
  assert.equal(reads, 1);
  clipboard.resolve('https://clipboard.example');
  await settle();
  const sent = requests.filter((request) => request.path === '/api/scans');
  assert.equal(sent.length, 1);
  assert.equal(JSON.parse(sent[0].options.body as string).external, true);
  assert.equal(consent.disabled, false);
});

test('cancelled clipboard completion cannot overwrite or unlock a newer scan', async () => {
  const clipboard = deferred<string>();
  const secondScan = deferred<Response>();
  Object.defineProperty(browser.navigator, 'clipboard', {
    configurable: true,
    value: { readText: () => clipboard.promise },
  });
  handler = (path, options) =>
    path === '/api/scans' ? secondScan.promise : fallback(path, options);
  await renderWorkspace();
  await click(element('.btn-paste-quick'));
  await click(button('Cancel scan'));
  const input = element<HTMLTextAreaElement>('#scan-input');
  assert.equal(input.disabled, false);
  await edit(input, 'https://newer.example');
  await submit(element<HTMLFormElement>('.scan-card form'));
  assert.equal(input.disabled, true);
  clipboard.resolve('https://discarded.example');
  await settle();
  assert.equal(input.value, 'https://newer.example');
  assert.equal(input.disabled, true);
  const sent = requests.filter((request) => request.path === '/api/scans');
  assert.equal(sent.length, 1);
  assert.equal(JSON.parse(sent[0].options.body as string).text, 'https://newer.example');
  secondScan.resolve(response(scan('newer')));
  await settle();
  assert.equal(input.disabled, false);
});

test('clipboard completion after leaving scanner sends nothing', async () => {
  const clipboard = deferred<string>();
  Object.defineProperty(browser.navigator, 'clipboard', {
    configurable: true,
    value: { readText: () => clipboard.promise },
  });
  await renderWorkspace();
  await click(element('.btn-paste-quick'));
  await click(button('Community'));
  clipboard.resolve('https://discarded.example');
  await settle();
  assert.equal(
    requests.some((request) => request.path === '/api/scans'),
    false,
  );
});

test('later profile save survives an older response after page navigation', async () => {
  currentUser = user();
  const first = deferred<Response>();
  const second = deferred<Response>();
  let saves = 0;
  handler = (path, options) => {
    if (path === '/api/me' && options.method === 'PATCH')
      return ++saves === 1 ? first.promise : second.promise;
    return fallback(path, options);
  };
  await renderWorkspace();
  await click(button('Settings'));
  await edit(element<HTMLInputElement>('.stack input:not([readonly])'), 'Earlier Name');
  await submit(element<HTMLFormElement>('.stack'));
  await click(button('Community'));
  await click(button('Settings'));
  await edit(element<HTMLInputElement>('.stack input:not([readonly])'), 'Later Name');
  await submit(element<HTMLFormElement>('.stack'));
  assert.equal(saves, 2);
  second.resolve(response(user('Later Name')));
  await settle();
  first.resolve(response(user('Earlier Name')));
  await settle();
  assert.equal(element('.profile strong').textContent, 'Later Name');
});

test('deleting scan A preserves a newer selected scan B', async () => {
  currentUser = user();
  const removed = deferred<Response>();
  let rows = [scan('scan-a'), scan('scan-b', 'Caution')];
  handler = (path, options) => {
    if (path === '/api/scans/scan-a' && options.method === 'DELETE') return removed.promise;
    if (path === '/api/scans') return response(rows);
    return fallback(path, options);
  };
  await renderWorkspace();
  await click(button('Scan history'));
  await click(element('.history-list .row-open'));
  await click(element('.history-list [aria-label="Delete scan"]'));
  await click(Array.from(document.querySelectorAll<HTMLElement>('.history-list .row-open'))[1]);
  assert.equal(
    element('.result-card').getAttribute('aria-label'),
    'Scan result: Caution, risk score 30 out of 100',
  );
  rows = [rows[1]];
  removed.resolve(response({ ok: true }));
  await settle();
  assert.equal(
    element('.result-card').getAttribute('aria-label'),
    'Scan result: Caution, risk score 30 out of 100',
  );
});

test('obsolete health retry cannot replace a newer successful connection', async () => {
  const obsolete = deferred<Response>();
  let checks = 0;
  handler = (path, options) => {
    if (path === '/api/health') {
      checks++;
      if (checks === 2) return obsolete.promise;
    }
    return fallback(path, options);
  };
  await renderWorkspace();
  await act(async () => browser.dispatchEvent(new browser.Event('online')));
  await settle();
  await act(async () => browser.dispatchEvent(new browser.Event('online')));
  await settle();
  assert.equal(element('.connection').textContent?.trim(), 'Local demo');
  obsolete.resolve(response({ error: 'Old unavailable response.' }, 503));
  await settle();
  assert.equal(element('.connection').textContent?.trim(), 'Local demo');
});

test('forgot-password request excludes the password from the sign-in form', async () => {
  let payload: Record<string, unknown> | undefined;
  handler = (path, options) => {
    if (path === '/api/auth/forgot') {
      payload = JSON.parse(options.body as string);
      return response({ message: 'Check your inbox if an account exists.' });
    }
    return fallback(path, options);
  };
  await renderWorkspace();
  await click(button('Sign in'));
  await edit(element<HTMLInputElement>('.auth-form-panel input[type="email"]'), 'qa@example.test');
  await edit(element<HTMLInputElement>('#auth-password'), 'synthetic-test-passphrase');
  await click(button('Forgot password?'));
  await submit(element<HTMLFormElement>('.auth-form-panel form'));
  assert.deepEqual(payload, { email: 'qa@example.test' });
});

test('family alert history orders unsorted server records newest first', async () => {
  currentUser = user();
  const alerts = Array.from({ length: 13 }, (_, index) => ({
    id: 'alert-' + index,
    createdAt: new Date(Date.UTC(2026, 9, 5, index)).toISOString(),
    status: 'Status ' + index,
  })).reverse();
  handler = (path, options) =>
    path === '/api/alerts' ? response(alerts) : fallback(path, options);
  await renderWorkspace();
  await click(button('Family Shield'));
  const visible = Array.from(document.querySelectorAll('.category-row strong')).map(
    (entry) => entry.textContent,
  );
  assert.deepEqual(
    visible,
    Array.from({ length: 10 }, (_, index) => 'Status ' + (12 - index)),
  );
});

test('long assistant replies stay keyboard reachable and scroll only the conversation', async () => {
  handler = (path, options) =>
    path === '/api/assistant'
      ? response({
          reply: 'Controlled long response. '.repeat(300),
          suggestions: [],
          hotlines: [],
          source: 'local',
          externalUsed: false,
        })
      : fallback(path, options);
  await renderWorkspace();
  scrolled = [];
  scrolledIntoView = [];
  await click(element('.header-assistant-btn'));
  await edit(element<HTMLInputElement>('.assistant-text-input'), 'Controlled question');
  await submit(element<HTMLFormElement>('.assistant-input-footer'));
  const transcript = element('.assistant-chat-body');
  assert.equal(transcript.tabIndex, 0);
  assert.ok(transcript.textContent?.includes('Controlled long response.'));
  assert.ok(scrolled.length > 0);
  assert.ok(scrolled.every((entry) => entry.classList.contains('assistant-chat-body')));
  assert.equal(scrolledIntoView.length, 0);
});

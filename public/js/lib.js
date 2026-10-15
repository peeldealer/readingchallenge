import * as config from './config.js';

// Supabase client library: self-hosted copy in /vendor (see tests/package.json "vendor").
const { createClient } = window.supabase;

const { SUPABASE_URL, SUPABASE_ANON_KEY, LIBRARY_NAME, LIBRARY_URL } = config;

export const configured = !SUPABASE_URL.includes('YOUR-PROJECT');

// Staff and kids never share a sign-in: the admin page keeps its session in a
// separate slot that lives only as long as the browser tab, so a desk computer
// left open can't hand a staff session to a kid, and closing the tab signs out.
const isAdminPage = /admin\.html$/.test(location.pathname);
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: isAdminPage
    ? { persistSession: true, autoRefreshToken: true, storage: window.sessionStorage, storageKey: 'srch-staff' }
    : { persistSession: true, autoRefreshToken: true },
});

// Refuse to run inside someone else's frame (clickjacking). GitHub Pages can't
// send a frame-ancestors header, and CSP meta tags ignore that directive.
if (window.top !== window.self) {
  document.documentElement.hidden = true;
  throw new Error('framed');
}

// Build DOM safely: strings always become text nodes, never HTML.
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (key in node && typeof value !== 'string') node[key] = value;
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export const $ = (selector) => document.querySelector(selector);

export async function rpc(name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}

// Library cards look like ABCD-EFGH-JKMN-PQRS.
export function formatCode(code) {
  return code.replace(/[^A-Za-z0-9]/g, '').toUpperCase().match(/.{1,4}/g)?.join('-') ?? '';
}

export function footer() {
  return el('footer', { class: 'site-footer' },
    el('a', { href: LIBRARY_URL, target: '_blank', rel: 'noopener noreferrer' }, LIBRARY_NAME),
    el('span', { class: 'sep', 'aria-hidden': 'true' }, '·'),
    el('a', { href: 'privacy.html' }, 'Privacy'));
}

export { LIBRARY_NAME };

// Where QR tags send kids. Always ends with '/'.
export const SITE_URL = (() => {
  const url = new URL(config.SITE_URL || './', location.href);
  // 'https://x.github.io/repo' means the folder, not a file in it.
  if (config.SITE_URL && !url.pathname.endsWith('/') && !/\.html?$/.test(url.pathname)) url.pathname += '/';
  if (!url.pathname.endsWith('/')) url.pathname = url.pathname.replace(/[^/]*$/, '');
  url.hash = '';
  url.search = '';
  return url.href;
})();
export function isLocalAddress(address) {
  const host = new URL(address).hostname;
  return /^(localhost|127\.|\[::1\]|0\.0\.0\.0)/.test(host) || host.endsWith('.local');
}
export const siteIsLocal = isLocalAddress(SITE_URL);

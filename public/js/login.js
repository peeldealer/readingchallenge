import { supabase, rpc, $, configured, formatCode } from './lib.js';
import { t, lang, setLang, applyStatic, errorText } from './i18n.js';
import { coastSVG, fitScene } from './scene.js';

const form = $('#codeForm');
const input = $('#codeInput');
const button = $('#signInBtn');
const message = $('#loginMessage');

function drawScene() {
  const frame = $('#coast');
  frame.querySelector('svg')?.remove();
  frame.insertAdjacentHTML('afterbegin', coastSVG({ startLabel: t('startLabel'), endLabel: t('goalLabel') }));
  fitScene(frame, 'xMinYMax slice');
}

applyStatic();
drawScene();
$('#langToggle').addEventListener('click', () => { setLang(lang === 'en' ? 'mi' : 'en'); drawScene(); });
if (!configured) $('#setupWarning').classList.remove('hidden');
const notice = new URLSearchParams(location.search);
if (notice.has('deleted') || notice.has('timeout')) {
  message.textContent = t(notice.has('deleted') ? 'accountDeleted' : 'idleSignedOut');
  message.classList.add('ok');
  history.replaceState(null, '', location.pathname);
}

input.addEventListener('input', () => {
  const pos = input.value.length === input.selectionStart;
  input.value = formatCode(input.value);
  if (pos) input.selectionStart = input.selectionEnd = input.value.length;
});

// Typing a code usually means a library computer, so sign out after a quiet
// spell there. Scanning the QR is usually the kid's own device.
const markShared = (shared) => {
  try { shared ? localStorage.setItem('sharedDevice', '1') : localStorage.removeItem('sharedDevice'); } catch { /* ignore */ }
};

form.addEventListener('submit', (e) => {
  e.preventDefault();
  markShared(true);
  signIn(input.value);
});

// Things the previous reader on this device left behind.
function clearDeviceState() {
  for (const key of ['timer', 'seenPrizes']) {
    try { localStorage.removeItem(key); } catch { /* private mode */ }
  }
  // A tag opened in a tab where staff were signed in ends that staff session.
  try { sessionStorage.removeItem('srch-staff'); sessionStorage.removeItem('staffLastActive'); } catch { /* ignore */ }
}

async function signIn(code) {
  message.textContent = '';
  button.disabled = true;
  button.textContent = t('signingIn');
  const freshSession = async () => {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
  };
  const claim = async () => {
    try {
      return await rpc('claim_card', { p_code: code });
    } catch (err) {
      // A stored session the server no longer accepts shows up as an auth error.
      return { ok: false, error: /jwt|token|not_signed_in|sub claim/i.test(err.message) ? 'not_signed_in' : err.message };
    }
  };
  try {
    // Every scan starts a fresh anonymous sign-in, so a staff session or the
    // previous kid on this device is never reused for the next tag.
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      await rpc('release_session').catch(() => {});
      await supabase.auth.signOut({ scope: 'local' });
    }
    clearDeviceState();
    await freshSession();
    let result = await claim();
    if (!result.ok && result.error === 'not_signed_in') {
      // Old sign-in on this device (e.g. cleaned up by staff): start over once.
      await supabase.auth.signOut({ scope: 'local' });
      await freshSession();
      result = await claim();
    }
    if (!result.ok) throw new Error(result.error);
    location.replace('app.html');
  } catch (err) {
    console.error(err);
    message.textContent = errorText(err);
    button.disabled = false;
    button.textContent = t('signIn');
  }
}

// QR codes link to <site>/#c=XXXX (older cards: index.html#code=XXXX). The code lives in the URL fragment,
// so it is never sent to the web server or leaked in Referer headers.
// ?code= is still accepted for old links.
function codeInUrl() {
  const params = new URLSearchParams(location.hash.slice(1) || location.search);
  return params.get('c') ?? params.get('code');
}
function signInFromUrl(code) {
  history.replaceState(null, '', location.pathname);
  markShared(false);
  input.value = formatCode(code);
  signIn(code);
}
// A tag link opened while this page is already showing only changes the #part.
addEventListener('hashchange', () => { const code = codeInUrl(); if (code) signInFromUrl(code); });

const codeFromUrl = codeInUrl();
if (codeFromUrl) {
  signInFromUrl(codeFromUrl);
} else if (configured) {
  // Already signed in on this device? Go straight to the dashboard.
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    try {
      if ((await rpc('whoami')).reader) location.replace('app.html');
    } catch { /* stay on the login page */ }
  }
}

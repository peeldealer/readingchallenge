import { supabase, rpc, el, $, formatCode, LIBRARY_NAME, SITE_URL, isLocalAddress, openedFromPasswordReset } from './lib.js';
import { DEFAULTS as LASER_DEFAULTS, buildSheets, layout, tagSize } from './laser.js';

// The address built into new tags: the staff setting, or the default from
// js/config.js. Short link keeps the QR small enough to engrave: <site>/#c=CODE
let tagAddress = SITE_URL;
let tagInfo = { site_url: null, history: [], active_tags: 0 };
const loginUrlFor = (code) => `${tagAddress}#c=${code}`;
const tagAddressIsLocal = () => isLocalAddress(tagAddress);
const TAG_ADDRESS_RULE = /^https:\/\/[a-z0-9.-]+(:[0-9]{1,5})?(\/[a-z0-9._~%-]+)*\/$/i;

async function loadTagAddress() {
  tagInfo = await rpc('admin_site_url_info');
  tagAddress = tagInfo.site_url ?? SITE_URL;
  showSiteUrl();
}

function showSiteUrl() {
  const box = $('#siteUrlNote');
  box.replaceChildren(...[
    el('span', {}, 'New tags will open'),
    el('strong', { class: 'site-url-big' }, tagAddress),
    el('span', {}, 'Tags already made keep the address they were made with. ',
      el('button', { class: 'btn btn-secondary btn-small', type: 'button', onclick: () => showTab('settings') }, 'Change in Settings')),
    tagAddressIsLocal() ? el('span', { class: 'warn' },
      '⚠️ This is a local address: tags made now will only work on this computer.') : null,
  ].filter(Boolean));
  box.classList.toggle('notice', tagAddressIsLocal());
  if ($('#tagAddressNow')) renderTagAddressCard();
}

function renderTagAddressCard() {
  $('#tagAddressNow').textContent = tagAddress;
  $('#tagHosts').textContent = (tagInfo.allowed_hosts ?? []).join(', ') || 'none';
  const history = [...tagInfo.history].reverse();
  $('#tagAddressHistory').replaceChildren(
    ...history.map((h, i) => el('li', { class: 'row' },
      el('span', { class: 'name' }, h.url, el('small', { class: 'muted entry-when' }, `${i === 0 ? 'Current, since' : 'From'} ${fmtDate(h.since)}`)))),
    el('li', { class: 'row' }, el('span', { class: 'name' }, SITE_URL,
      el('small', { class: 'muted entry-when' }, history.length
        ? `Default from the website code, used before ${fmtDate(tagInfo.history[0].since)}`
        : 'Default from the website code (in use now)'))));
}

$('#tagAddressTest').addEventListener('click', () => {
  const url = $('#tagAddressNew').value.trim() || tagAddress;
  if (!TAG_ADDRESS_RULE.test(url)) { $('#tagAddressMessage').textContent = 'That isn’t a valid address: it must start with https:// and end with /.'; return; }
  window.open(url, '_blank', 'noopener');
});

$('#tagAddressForm').addEventListener('submit', (e) => {
  e.preventDefault();
  once(e.target.querySelector('[type=submit]'), async () => {
    const msg = $('#tagAddressMessage');
    msg.classList.remove('ok');
    const url = $('#tagAddressNew').value.trim();
    if (!TAG_ADDRESS_RULE.test(url)) { msg.textContent = 'The address must start with https:// and end with /, e.g. https://library.example.nz/reading/'; return; }
    if (url !== $('#tagAddressConfirm').value.trim()) { msg.textContent = 'The two addresses don’t match.'; return; }
    if (url === tagAddress) { msg.textContent = 'That’s already the address.'; return; }
    const n = tagInfo.active_tags;
    if (!confirm(`Change the tag address?\n\nOld: ${tagAddress}\nNew: ${url}\n\n`
      + `Only tags made AFTER this change will use the new address.\n`
      + `${n === 1 ? 'The 1 tag already made will NOT change: it keeps' : `The ${n.toLocaleString()} tags already made will NOT change: they keep`} pointing to the old address, so keep it working or forwarding.`)) return;
    try {
      const r = await rpc('admin_set_site_url', { p_url: url });
      await loadTagAddress();
      $('#tagAddressNew').value = '';
      $('#tagAddressConfirm').value = '';
      $('#tagAddressEdit').open = false;
      msg.classList.add('ok');
      msg.textContent = r.changed
        ? `Saved. New tags will open ${url}. ${Number(r.tags_keeping_old_address) === 1 ? 'The 1 existing tag still opens' : `The ${Number(r.tags_keeping_old_address).toLocaleString()} existing tags still open`} the old address.`
        : 'No change.';
      $('#tagAddressEdit').after(msg);
    } catch (err) { fail(err); }
  });
});

const FRIENDLY = {
  no_eligible: 'Nobody matches those rules, so no winner was drawn.',
  invalid_collect_by: 'The collect-by date can’t be in the past.',
  prize_not_cancellable: 'That prize has already been collected or cancelled.',
  prize_not_active: 'That prize was cancelled, so it can’t be marked collected.',
  not_a_draw: 'Only prizes from a draw can be redrawn.',
  invalid_prize: 'Type what the prize is (up to 120 characters).',
  staff_only: 'Your staff sign-in has expired. Sign in again.',
  invalid_count: 'Pick between 1 and 100 readers.',
  invalid_site_url: 'The address must start with https:// and end with /.',
  tag_host_not_allowed: 'That web host isn’t on the approved list. For safety, only a developer can add a new host (a one-line database change).',
  reader_deleted: 'That reader deleted their account. Restore them first (Today or Readers → All tags).',
  invalid_minutes: 'Bonus must be 1–300 minutes.',
  invalid_reason: 'Type what the bonus is for (up to 80 characters).',
  not_found: 'That reader no longer exists. Refresh and try again.',
  not_deleted: 'That account isn’t deleted, so there’s nothing to restore.',
  tag_not_found: 'That tag isn’t active. It may have been replaced: check the code, or press “New card” for them first.',
  tag_not_winner: 'That tag belongs to someone else, not the winner of this prize.',
  use_tag_to_collect: 'Scan the winner’s tag at the Desk to hand a prize over.',
};
function fail(err) {
  console.error(err);
  const code = err.message ?? String(err);
  alert(FRIENDLY[code] ?? `Error: ${code}`);
}

async function db(query) {
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const shortDate = (d) => new Date(d.length === 10 ? `${d}T12:00:00` : d).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' });

// A date input value 14 days from today (local time), the default collect-by.
function inTwoWeeks() {
  const d = new Date(Date.now() + 14 * 864e5);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* ========= Prizes: shared bits ========= */

const PRIZE_STATUS = {
  waiting: { label: 'To collect', cls: 'pill' },
  overdue: { label: 'Overdue', cls: 'pill warn-pill' },
  collected: { label: 'Collected', cls: 'pill ok' },
  cancelled: { label: 'Cancelled', cls: 'pill' },
};

function prizeLine(p) {
  const bits = [`Won ${shortDate(p.won_at)}`, p.direct ? 'given directly' : 'prize draw'];
  if (p.collect_by && (p.status === 'waiting' || p.status === 'overdue')) bits.push(`collect by ${shortDate(p.collect_by)}`);
  if (p.claimed_at) bits.push(`collected ${shortDate(p.claimed_at)}${p.collected_via === 'tag' ? ' (tag checked)' : p.collected_via === 'override' ? ` (no tag: ${p.collect_note})` : ''}`);
  if (p.cancelled_at) bits.push(`cancelled ${shortDate(p.cancelled_at)}`);
  return bits.join(' · ');
}

// Buttons that make sense for a prize in its current state. Handing a prize
// over only happens at the Desk: with the winner's scanned tag (checked by the
// database), or without it by giving a reason that stays in the history.
// desk: { code } when the reader was found by scanning their tag, {} when found
// by name; omitted everywhere else (lists show where to go instead).
function prizeActions(p, readerId, name, refresh, desk = null) {
  const call = (fn, args, confirmText) => async () => {
    if (confirmText && !confirm(confirmText)) return;
    try { await rpc(fn, args); await refresh(); } catch (err) { fail(err); }
  };
  const id = { p_draw: p.draw_id, p_reader: readerId };
  const who = name ?? 'this reader';
  switch (p.status) {
    case 'waiting':
    case 'overdue': {
      let handOver = el('span', { class: 'muted small' }, 'Hand over at the Desk');
      if (desk?.code) {
        handOver = el('button', { class: 'btn btn-small btn-sea', type: 'button', onclick: call('admin_collect_prize', { p_code: desk.code, p_draw: p.draw_id }) }, 'Hand over ✓');
      } else if (desk) {
        handOver = el('button', { class: 'btn btn-small', type: 'button', onclick: async () => {
          const reason = prompt(`Their tag hasn't been scanned, so we can't check this is ${who}.\n\nBest: scan their tag. If they've lost it, press “New card” for them first.\n\nTo hand over anyway, type why (kept in the prize history):`);
          if (reason === null) return;
          try { await rpc('admin_collect_prize_override', { ...id, p_reason: reason }); await refresh(); } catch (err) { fail(err); }
        } }, 'Hand over without tag…');
      }
      return [
        handOver,
        p.direct ? null : el('button', {
          class: 'btn btn-small', type: 'button', title: 'Cancel this winner and draw someone else with the same rules',
          onclick: async () => {
            if (!confirm(`Cancel ${who}'s “${p.prize}” and draw a replacement winner with the same rules?`)) return;
            try {
              const [winner] = await rpc('admin_redraw', id);
              alert(`New winner: ${winner.display_name}${winner.note ? ` (${winner.note})` : ''}.`);
              await refresh();
            } catch (err) { fail(err); }
          },
        }, 'Redraw'),
        el('button', { class: 'btn btn-small danger', type: 'button', onclick: call('admin_cancel_prize', { ...id, p_cancel: true }, `Cancel ${who}'s “${p.prize}”? It stays in the history as cancelled.`) }, 'Cancel'),
      ];
    }
    case 'collected':
      return [el('button', { class: 'btn btn-small', type: 'button', onclick: call('admin_set_claimed', { ...id, p_claimed: false }, `Mark ${who}'s “${p.prize}” as not collected?`) }, 'Undo collected')];
    case 'cancelled':
      return [el('button', { class: 'btn btn-small', type: 'button', onclick: call('admin_cancel_prize', { ...id, p_cancel: false }, `Restore ${who}'s “${p.prize}”?`) }, 'Restore')];
    default:
      return [];
  }
}

/* ========= Auto sign-out when idle (shared desk computers) ========= */

const IDLE_LIMIT_MS = 15 * 60 * 1000;
const ACTIVE_KEY = 'staffLastActive';
let lastActive = Number(sessionStorage.getItem(ACTIVE_KEY)) || Date.now();
const markActive = () => {
  lastActive = Date.now();
  try { sessionStorage.setItem(ACTIVE_KEY, String(lastActive)); } catch { /* ignore */ }
};
['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((ev) => addEventListener(ev, markActive, { passive: true }));
setInterval(async () => {
  if (Date.now() - lastActive < IDLE_LIMIT_MS) return;
  const { data } = await supabase.auth.getSession();
  if (!data.session || data.session.user.is_anonymous) return;
  await signOutHere('admin.html?timeout');
}, 30 * 1000);

// Sign out on this computer only: other desks sharing the staff account stay signed in.
async function signOutHere(to) {
  stopCamera();
  clearNewCodes();
  await supabase.auth.signOut({ scope: 'local' });
  try { sessionStorage.removeItem(ACTIVE_KEY); } catch { /* ignore */ }
  location.replace(to);
}

// Report anything that slipped through instead of failing silently.
addEventListener('unhandledrejection', (e) => fail(e.reason));

// Run fn once at a time per button: stops double clicks, double Enter and
// double scans from giving the same bonus or prize twice.
async function once(button, fn) {
  if (button.disabled) return;
  button.disabled = true;
  try { await fn(); } finally { button.disabled = false; }
}

/* ========= Auth ========= */

async function boot() {
  const { data } = await supabase.auth.getSession();
  if (data.session && Date.now() - lastActive > IDLE_LIMIT_MS) return signOutHere('admin.html?timeout');
  markActive();
  const isStaff = data.session && !data.session.user.is_anonymous && (await rpc('whoami')).staff;
  $('#signInView').classList.toggle('hidden', !!isStaff);
  $('#adminView').classList.toggle('hidden', !isStaff);
  $('#adminSignOut').classList.toggle('hidden', !data.session || data.session.user.is_anonymous);
  $('#staffEmail').textContent = isStaff ? data.session.user.email : '';
  if (data.session && !data.session.user.is_anonymous && !isStaff) {
    $('#staffMessage').textContent = 'This account is not on the staff list. Ask your Supabase admin to add it.';
  }
  if (isStaff) { await loadTagAddress().catch(fail); showTab('today'); }
  if (!isStaff && new URLSearchParams(location.search).has('timeout')) {
    $('#staffMessage').textContent = 'Signed out after 15 minutes without activity. Sign in again to carry on.';
    history.replaceState(null, '', location.pathname);
  }
}

// Password reset: Supabase emails a link back to this page, which signs the
// staff member in for just long enough to choose a new password.
$('#forgotPassword').addEventListener('click', async () => {
  const email = $('#staffEmailInput').value.trim();
  if (!email) { $('#staffMessage').textContent = 'Type your email above first.'; return; }
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
  $('#staffMessage').classList.toggle('ok', !error);
  $('#staffMessage').textContent = error
    ? error.message
    : 'If that’s a staff account, a reset link is on its way. Open it on this computer.';
});

function showNewPasswordForm() {
  $('#signInView').classList.remove('hidden');
  $('#adminView').classList.add('hidden');
  $('#staffForm').classList.add('hidden');
  $('#newPasswordForm').classList.remove('hidden');
  $('#newPassword').focus();
}

$('#newPasswordForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const { error } = await supabase.auth.updateUser({ password: $('#newPassword').value });
  $('#newPassword').value = '';
  if (error) { $('#newPasswordMessage').textContent = error.message; return; }
  $('#newPasswordForm').classList.add('hidden');
  $('#staffForm').classList.remove('hidden');
  boot();
});

$('#staffForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#staffMessage').textContent = '';
  const { error } = await supabase.auth.signInWithPassword({
    email: $('#staffEmailInput').value,
    password: $('#staffPassword').value,
  });
  $('#staffPassword').value = '';
  if (error) $('#staffMessage').textContent = error.message;
  else boot();
});

$('#adminSignOut').addEventListener('click', () => signOutHere('admin.html'));

/* ========= Tabs ========= */

const loaders = { today: loadToday, desk: loadDesk, prizes: loadPrizesTab, readers: () => showSub('readers'), content: () => showSub('content'), settings: loadSettings };
const subLoaders = { board: loadBoard, tags: loadReaders, bingo: loadBingo, news: loadNews, books: loadBooks, words: loadWords };
const currentSub = { readers: 'board', content: 'bingo' };

function showTab(name) {
  if (name !== 'desk') stopCamera();
  if (name !== 'readers') clearNewCodes();
  document.querySelectorAll('[data-tab]').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === name);
    b.setAttribute('aria-selected', String(b.dataset.tab === name));
  });
  document.querySelectorAll('[data-panel]').forEach((p) => p.classList.toggle('hidden', p.dataset.panel !== name));
  loaders[name]().catch(fail);
}
document.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
document.querySelectorAll('[data-goto]').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.goto)));

// Sub-views inside Readers (leaderboard / all tags) and Content (bingo, news, …).
async function showSub(panel, sub = currentSub[panel]) {
  if (panel === 'readers' && sub !== 'tags') clearNewCodes();
  currentSub[panel] = sub;
  const root = document.querySelector(`[data-panel="${panel}"]`);
  root.querySelectorAll('[data-sub]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.sub === sub)));
  root.querySelectorAll('[data-subpanel]').forEach((p) => p.classList.toggle('hidden', p.dataset.subpanel !== sub));
  await subLoaders[sub]();
}
document.querySelectorAll('[data-panel] [data-sub]').forEach((b) => b.addEventListener('click', () => {
  showSub(b.closest('[data-panel]').dataset.panel, b.dataset.sub).catch(fail);
}));

/* ========= Today: what needs doing ========= */

const ago = (d) => {
  const mins = Math.round((Date.now() - new Date(d)) / 60000);
  if (mins < 60) return `${Math.max(mins, 1)} min ago`;
  if (mins < 24 * 60) return `${Math.round(mins / 60)} h ago`;
  return fmtDate(d);
};

async function loadToday() {
  const [o, open, recent] = await Promise.all([
    rpc('admin_overview'),
    rpc('admin_prizes', { p_status: 'open' }),
    rpc('admin_recent_text', { p_days: Number($('#recentDays').value) }),
  ]);
  const kpi = (value, label) => el('div', { class: 'kpi' }, el('strong', {}, value), el('span', {}, label));
  $('#todayStats').replaceChildren(
    kpi(o.named_readers.toLocaleString(), 'readers signed up'),
    kpi(o.active_7d.toLocaleString(), 'active this week'),
    kpi(`${((o.minutes / o.goal) * 100).toFixed(1)}%`, `of the ${o.goal.toLocaleString()} minute goal`),
    kpi(o.logs.toLocaleString(), 'reading sessions'));

  const overdue = open.filter((p) => p.status === 'overdue').length;
  $('#todayPrizeCount').textContent = `${open.length} waiting${overdue ? ` · ${overdue} overdue` : ''}`;
  $('#todayPrizeCount').className = overdue ? 'pill warn-pill' : 'pill';
  $('#todayPrizes').replaceChildren(...(open.length ? open.slice(0, 8).map((p) =>
    el('li', { class: 'row' },
      el('span', { class: 'name' }, el('strong', {}, p.display_name ?? '(no name yet)'), ` · ${p.prize}`,
        el('small', { class: 'muted entry-when' }, prizeLine(p))),
      el('span', { class: PRIZE_STATUS[p.status].cls }, PRIZE_STATUS[p.status].label)))
    : [el('li', { class: 'empty' }, 'Nothing waiting. 🎉')]));

  $('#todayNames').replaceChildren(...(recent.names.length ? recent.names.map((r) =>
    el('li', { class: 'row' },
      el('span', { class: 'name' }, r.display_name, r.note ? el('span', { class: 'muted' }, ` · ${r.note}`) : null,
        el('small', { class: 'muted entry-when' }, ago(r.named_at))),
      el('button', { class: 'btn btn-small', type: 'button', onclick: () => resetName(r, loadToday) }, 'Reset name')))
    : [el('li', { class: 'empty' }, 'No new names.')]));

  $('#todayTitles').replaceChildren(...(recent.titles.length ? recent.titles.map((b) =>
    el('li', { class: 'row' },
      el('span', { class: 'name' }, b.book_title, b.hidden ? el('span', {}, ' ', el('span', { class: 'pill warn-pill' }, 'Hidden')) : null,
        el('small', { class: 'muted entry-when' }, `${ago(b.first_seen_at)} · ${b.readers} reader${b.readers === 1 ? '' : 's'}`)),
      el('button', { class: `btn btn-small${b.hidden ? '' : ' danger'}`, type: 'button', onclick: () => {
        if (!b.hidden && !confirm(`Hide “${b.book_title}” from suggestions and Community favourites?`)) return;
        updateBook(b, { hidden: !b.hidden }, loadToday);
      } }, b.hidden ? 'Unhide' : 'Hide')))
    : [el('li', { class: 'empty' }, 'No new titles.')]));

  $('#todayDeletedCard').classList.toggle('hidden', !recent.deleted.length);
  $('#todayDeleted').replaceChildren(...recent.deleted.map((r) =>
    el('li', { class: 'row' },
      el('span', { class: 'name' }, r.display_name ?? '(no name)', el('small', { class: 'muted entry-when' }, `Erased for good on ${fmtDate(r.erase_on)}`)),
      el('button', { class: 'btn btn-small', type: 'button', onclick: () => restoreReader(r, loadToday) }, 'Restore'))));
}
$('#recentDays').addEventListener('change', () => loadToday().catch(fail));

/* ========= Readers & cards ========= */

let readers = [];

let readersSeq = 0;
async function loadReaders() {
  const seq = ++readersSeq;
  const rows = await rpc('admin_readers', { p_search: $('#readerSearch').value.trim() || null });
  if (seq !== readersSeq) return; // a newer search finished first
  readers = rows;
  $('#readersTable tbody').replaceChildren(...readers.map((r) => (r.deleted_at ? deletedRow(r) :
    el('tr', {},
      el('td', {}, r.display_name ?? el('em', { class: 'muted' }, 'not signed up yet')),
      el('td', {}, r.note ?? ''),
      el('td', { class: 'num' }, Number(r.minutes).toLocaleString()),
      el('td', {}, fmtDate(r.last_read_at)),
      el('td', {}, fmtDate(r.created_at)),
      el('td', { class: 'actions' },
        el('button', { class: 'btn btn-small', onclick: () => showLogs(r) }, 'Details'),
        el('button', { class: 'btn btn-small', onclick: () => reissue(r) }, 'New card'),
        el('button', { class: 'btn btn-small', onclick: () => openReader(r) }, 'Open at desk'),
        r.display_name && el('button', { class: 'btn btn-small', onclick: () => resetName(r) }, 'Reset name'))))));
}

// A kid deleted their account: hidden everywhere, kept 14 days so staff can undo it.
function deletedRow(r) {
  return el('tr', { class: 'deleted-row' },
    el('td', {}, r.display_name ?? el('em', { class: 'muted' }, 'no name'), ' ',
      el('span', { class: 'pill warn-pill' }, 'Deleted'),
      el('small', { class: 'muted entry-when' }, `Erased for good on ${fmtDate(r.erase_on)}`)),
    el('td', {}, r.note ?? ''),
    el('td', { class: 'num' }, Number(r.minutes).toLocaleString()),
    el('td', {}, fmtDate(r.last_read_at)),
    el('td', {}, fmtDate(r.created_at)),
    el('td', { class: 'actions' },
      el('button', { class: 'btn btn-small', onclick: () => restoreReader(r) }, 'Restore'),
      el('button', { class: 'btn btn-small danger', onclick: () => removeReader(r) }, 'Erase now')));
}

async function restoreReader(r, refresh = loadReaders) {
  if (!confirm(`Restore ${r.display_name ?? 'this reader'}? Their name, minutes, books and prizes come back, and their tag works again.\n\nIf someone else may have used their tag to delete it, press “New card” for them straight after restoring, so the old tag stops working.`)) return;
  try { await rpc('admin_restore_reader', { p_reader: r.reader_id }); await refresh(); } catch (err) { fail(err); }
}

let searchTimer;
$('#readerSearch').addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => loadReaders().catch(fail), 300);
});

/* ---------- output: paper and/or laser ---------- */

const PREFS_KEY = 'cardOutput';
function loadPrefs() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(PREFS_KEY)) ?? {}; } catch { /* ignore */ }
  return { mode: 'laser', ...LASER_DEFAULTS, ...saved };
}
function savePrefs() {
  const prefs = {
    mode: $('#outputMode').value,
    tagWidth: Number($('#tagWidth').value) || LASER_DEFAULTS.tagWidth,
    bedWidth: Number($('#bedWidth').value) || LASER_DEFAULTS.bedWidth,
    bedHeight: Number($('#bedHeight').value) || LASER_DEFAULTS.bedHeight,
    showCode: $('#showCode').checked,
  };
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* ignore */ }
  const { w, h } = tagSize(prefs);
  const { cols, rows, perSheet } = layout({ ...LASER_DEFAULTS, ...prefs });
  $('#laserFit').textContent = perSheet
    ? `Each tag is ${w.toFixed(1)} × ${h.toFixed(1)} mm. ${cols} × ${rows} = ${perSheet} tags per sheet.`
    : 'The tags don’t fit on that bed size.';
  return prefs;
}
(() => {
  const p = loadPrefs();
  $('#outputMode').value = p.mode;
  $('#tagWidth').value = p.tagWidth;
  $('#bedWidth').value = p.bedWidth;
  $('#bedHeight').value = p.bedHeight;
  $('#showCode').checked = p.showCode;
  savePrefs();
  ['#outputMode', '#tagWidth', '#bedWidth', '#bedHeight', '#showCode'].forEach((id) => $(id).addEventListener('change', savePrefs));
})();

function outputCards(codes, name) {
  const prefs = savePrefs();
  clearNewCodes();
  if (prefs.mode !== 'paper') showLaser(codes, prefs);
  if (prefs.mode !== 'laser') printCards(codes, name);
}

// Freshly made codes are only shown once: wipe them (and their download links)
// when staff move on, so nobody can scan them off the screen later.
let codeUrls = [];
function clearNewCodes() {
  codeUrls.forEach((u) => URL.revokeObjectURL(u));
  codeUrls = [];
  $('#laserOutput').replaceChildren();
  $('#laserOutput').classList.add('hidden');
  $('#printSheet').replaceChildren();
}

function showLaser(codes, prefs) {
  const box = $('#laserOutput');
  let result;
  try {
    result = buildSheets(codes, loginUrlFor, prefs);
  } catch (err) { return fail(err); }
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  const files = result.sheets.map((svg, i) => {
    const name = `reading-tags-${stamp}-sheet${i + 1}of${result.sheets.length}.svg`;
    const href = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    codeUrls.push(href);
    return el('a', { class: 'btn btn-primary', href, download: name }, `⬇ Sheet ${i + 1} of ${result.sheets.length}`);
  });
  // laser.js output is numbers and glyph paths only; parse it as SVG, never as HTML.
  const svgDoc = new DOMParser().parseFromString(result.sheets[0], 'image/svg+xml');
  const preview = el('div', { class: 'laser-preview' }, document.importNode(svgDoc.documentElement, true));
  box.classList.remove('hidden');
  box.replaceChildren(
    el('h3', {}, `Laser files: ${codes.length} tag${codes.length === 1 ? '' : 's'}`),
    el('p', { class: 'tiny-note' },
      `Download every sheet now: the codes can't be shown again. These tags open ${tagAddress}. Black = engrave, red hairline = cut, units are mm. `,
      `QR is ${result.qr.modules}×${result.qr.modules} modules, ${result.qr.moduleMM.toFixed(2)} mm each. `,
      `Test-scan the first tag before running a full batch.`),
    el('div', { class: 'input-row' }, files,
      el('button', { class: 'btn btn-secondary', type: 'button', onclick: () => {
        if (confirm('Clear these codes from the screen? Make sure every sheet is downloaded first.')) clearNewCodes();
      } }, 'Done, clear codes')),
    preview);
  box.scrollIntoView({ behavior: 'smooth' });
}

$('#createForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!confirmLocal()) return;
  try {
    const cards = await rpc('admin_create_readers', {
      p_count: Number($('#createCount').value),
      p_note: $('#createNote').value,
    });
    outputCards(cards.map((c) => c.code));
    loadReaders();
  } catch (err) { fail(err); }
});

function confirmLocal() {
  return !tagAddressIsLocal() || confirm(`These tags will point to ${tagAddress}, which only works on this computer. Make them anyway (for testing)?`);
}

async function reissue(r) {
  if (!confirmLocal()) return;
  if (!confirm(`Replace the card for ${r.display_name ?? 'this reader'}? The old card stops working and they'll be signed out everywhere. Their minutes are kept.`)) return;
  try {
    const code = await rpc('admin_reissue_card', { p_reader: r.reader_id });
    outputCards([code], r.display_name);
  } catch (err) { fail(err); }
}

async function resetName(r, refresh = loadReaders) {
  if (!confirm(`Clear the name "${r.display_name}"? They'll be asked to choose a new one next time.`)) return;
  try { await rpc('admin_reset_name', { p_reader: r.reader_id }); await refresh(); } catch (err) { fail(err); }
}

async function removeReader(r) {
  if (!confirm(`Permanently delete ${r.display_name ?? 'this reader'} and all their reading? This can't be undone.`)) return false;
  try { await db(supabase.from('readers').delete().eq('id', r.reader_id)); loadReaders(); return true; } catch (err) { fail(err); return false; }
}

async function showLogs(r) {
  const box = $('#readerLogs');
  const logs = await db(supabase.from('reading_logs').select('id, minutes, book_title, source, created_at')
    .eq('reader_id', r.reader_id).order('created_at', { ascending: false }).limit(200));
  box.classList.remove('hidden');
  box.replaceChildren(
    el('div', { class: 'input-row' },
      el('h3', { class: 'grow' }, `Reading log: ${r.display_name ?? 'unnamed reader'}`),
      el('button', { class: 'btn btn-small danger', onclick: () => removeReader(r).then((gone) => gone && box.classList.add('hidden')) }, 'Delete this reader'),
      el('button', { class: 'btn btn-small', onclick: () => box.classList.add('hidden') }, 'Close')),
    logs.length
      ? el('table', {}, el('tbody', {}, logs.map((l) => el('tr', {},
          el('td', {}, new Date(l.created_at).toLocaleString('en-NZ')),
          el('td', {}, l.book_title),
          el('td', { class: 'num' }, `${l.minutes} min`),
          el('td', {}, l.source),
          el('td', {}, el('button', { class: 'btn btn-small danger', onclick: async () => {
            if (!confirm(`Delete this ${l.minutes} minute entry?`)) return;
            try { await db(supabase.from('reading_logs').delete().eq('id', l.id)); showLogs(r); loadReaders(); } catch (err) { fail(err); }
          } }, 'Delete'))))))
      : el('p', { class: 'muted' }, 'No reading logged yet.'));
  box.scrollIntoView({ behavior: 'smooth' });
}

function printCards(codes, name) {
  const sheet = $('#printSheet');
  sheet.replaceChildren(...codes.map((code) => {
    const url = loginUrlFor(code);
    const qr = qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    const img = el('img', { src: qr.createDataURL(6, 2), alt: 'QR code' });
    return el('div', { class: 'reader-card' },
      el('div', { class: 'reader-card-title' }, '☀️ Summer Reading Challenge'),
      img,
      el('div', { class: 'reader-card-code' }, formatCode(code)),
      name && el('div', { class: 'tiny-note' }, `Replacement card for ${name}`),
      el('div', { class: 'tiny-note' }, `Scan to sign in. Keep this card private. ${LIBRARY_NAME}`));
  }));
  // Wait for QR images before opening the print dialog.
  Promise.all([...sheet.querySelectorAll('img')].map((i) => i.decode().catch(() => {}))).then(() => {
    window.print();
  });
}

/* ========= Bonus minutes: scan a tag, award minutes ========= */

const BONUS_CHOICES = [5, 10, 20, 30, 50];
let presets = [];     // [{ reason, minutes? }] from settings.bonus_presets
let current = null;   // reader looked up from the last scan

// A scanner or camera gives the whole QR link; people may type just the code.
function extractCode(text) {
  const raw = text.trim();
  try {
    const url = new URL(raw);
    const params = new URLSearchParams(url.hash.slice(1) || url.search);
    const code = params.get('c') ?? params.get('code');
    if (code) return code;
  } catch { /* not a link */ }
  return raw;
}

function choiceChips(container, values, onPick, label = (v) => String(v)) {
  container.replaceChildren(...values.map((v) => el('button', {
    type: 'button', class: 'chip-btn', 'aria-pressed': 'false', 'data-value': String(v),
    onclick: () => onPick(v),
  }, label(v))));
}
function markChip(container, value) {
  container.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === String(value))));
}

function setMinutes(n) { $('#bonusInput').value = n; markChip($('#bonusChips'), n); }
function pickPreset(p) {
  $('#reasonInput').value = p.reason;
  markChip($('#reasonChips'), p.reason);
  if (p.minutes) setMinutes(p.minutes);
}

choiceChips($('#bonusChips'), BONUS_CHOICES, setMinutes, (n) => `+${n}`);
$('#reasonInput').addEventListener('input', () => markChip($('#reasonChips'), $('#reasonInput').value.trim()));
$('#bonusInput').addEventListener('input', () => markChip($('#bonusChips'), Number($('#bonusInput').value)));
setMinutes(10);

async function loadPresets() {
  const s = await db(supabase.from('settings').select('bonus_presets').single());
  presets = Array.isArray(s.bonus_presets) ? s.bonus_presets : [];
  choiceChips($('#reasonChips'), presets.map((p) => p.reason),
    (reason) => pickPreset(presets.find((p) => p.reason === reason)),
    (reason) => { const p = presets.find((x) => x.reason === reason); return p.minutes ? `${reason} · +${p.minutes}` : reason; });
  $('#presetText').value = presets.map((p) => (p.minutes ? `${p.reason}, ${p.minutes}` : p.reason)).join('\n');
  // Start with the first preset so a quick scan-and-add works straight away.
  if (!$('#reasonInput').value && presets[0]) pickPreset(presets[0]);
  else markChip($('#reasonChips'), $('#reasonInput').value.trim());
}

$('#savePresets').addEventListener('click', async () => {
  const lines = $('#presetText').value.split('\n').map((l) => l.trim()).filter(Boolean);
  const parsed = [];
  for (const line of lines) {
    const m = line.match(/^(.*?)(?:\s*,\s*(\d+))?$/);
    const reason = m[1].trim();
    const minutes = m[2] ? Number(m[2]) : null;
    if (!reason || reason.length > 80) return ($('#presetMessage').textContent = `“${line}”: reasons must be 1–80 characters.`);
    if (minutes !== null && (minutes < 1 || minutes > 300)) return ($('#presetMessage').textContent = `“${line}”: minutes must be 1–300.`);
    parsed.push(minutes ? { reason, minutes } : { reason });
  }
  try {
    await db(supabase.from('settings').update({ bonus_presets: parsed }).eq('id', true));
    $('#presetMessage').textContent = 'Saved ✓';
    setTimeout(() => { $('#presetMessage').textContent = ''; }, 2000);
    loadPresets();
  } catch (err) { fail(err); }
});

function showCurrent() {
  $('#awardWho').textContent = current ? (current.display_name ?? 'Not signed up yet') : 'Nobody selected';
  $('#awardInfo').textContent = current
    ? `${Number(current.minutes).toLocaleString()} minutes so far${current.note ? ` · ${current.note}` : ''}${current.display_name ? '' : ' · they haven’t picked a name, but bonus minutes still count'}`
    : 'Scan a tag, or find someone by name, to give bonus minutes or hand over a prize.';
  $('#awardBtn').disabled = !current;
  ['#prizePanel', '#awardForm', '#givePrizeBox'].forEach((id) => $(id).classList.toggle('hidden', !current));
  // Was this person checked with their tag, or just picked from a list?
  const badge = $('#deskBadge');
  badge.classList.toggle('hidden', !current);
  badge.className = current?.code ? 'pill ok' : 'pill warn-pill';
  badge.textContent = current?.code ? '✓ Tag scanned' : 'Not checked: found by name';
  if (!current) badge.classList.add('hidden');
}

async function loadReaderPrizes() {
  if (!current) return;
  const reader = current;
  const prizes = await rpc('admin_reader_prizes', { p_reader: reader.reader_id });
  $('#readerPrizes').replaceChildren(...(prizes.length ? prizes.map((p) =>
    el('li', { class: `row${p.status === 'waiting' || p.status === 'overdue' ? ' prize-row' : ''}` },
      el('span', { class: 'name' }, p.prize, ' ', el('span', { class: PRIZE_STATUS[p.status].cls }, PRIZE_STATUS[p.status].label),
        el('small', { class: 'muted entry-when' }, prizeLine(p))),
      el('span', { class: 'actions-inline' }, prizeActions(p, reader.reader_id, reader.display_name, loadReaderPrizes, { code: reader.code ?? null }))))
    : [el('li', { class: 'empty' }, 'No prizes yet.')]));
}

$('#givePrizeForm').addEventListener('submit', (e) => {
  e.preventDefault();
  once(e.target.querySelector('[type=submit]'), async () => {
    const prize = $('#givePrizeInput').value.trim();
    if (!current) return;
    if (!prize) { $('#prizeMessage').textContent = 'Type what the prize is first.'; return; }
    try {
      await rpc('admin_give_prize', { p_reader: current.reader_id, p_prize: prize, p_collect_by: $('#givePrizeDate').value || null });
      $('#prizeMessage').textContent = `🎁 Given “${prize}” to ${current.display_name ?? 'this reader'}. They'll see it next time they open their page.`;
      $('#givePrizeInput').value = '';
      loadReaderPrizes();
    } catch (err) { fail(err); }
  });
});
$('#givePrizeDate').value = inTwoWeeks();

// Open a reader in the scan station without scanning (from Readers & cards).
function openReader(r) {
  current = { reader_id: r.reader_id, display_name: r.display_name, minutes: r.total ?? r.minutes, note: r.note, code: null };
  $('#nameSearch').value = '';
  $('#nameResults').replaceChildren();
  showTab('desk');
  showCurrent();
  $('#scanMessage').textContent = '';
  $('#awardMessage').replaceChildren();
  $('#prizeMessage').textContent = '';
  loadReaderPrizes().catch(fail);
}

async function lookup(text) {
  const code = extractCode(text);
  // A handheld scanner can read the same tag twice in a row: don't double-award.
  if ($('#instantMode').checked && code === lastScan.code && Date.now() - lastScan.at < 4000) {
    $('#scanInput').value = '';
    return;
  }
  lastScan = { code, at: Date.now() };
  $('#scanMessage').textContent = '';
  $('#awardMessage').replaceChildren();
  if (code.replace(/[^A-Za-z0-9]/g, '').length < 8) {
    $('#scanMessage').textContent = 'That doesn’t look like a tag code.';
    return;
  }
  try {
    const [reader] = await rpc('admin_lookup_card', { p_code: code });
    // Keep the scanned code so prizes can be handed over against this tag.
    current = reader ? { ...reader, code } : null;
    showCurrent();
    $('#scanInput').value = '';
    if (!reader) {
      $('#scanMessage').textContent = 'No active tag matches that code. It may have been replaced.';
      return;
    }
    $('#prizeMessage').textContent = '';
    loadReaderPrizes().catch(fail);
    if ($('#instantMode').checked) await award();
    else $('#awardBtn').focus();
  } catch (err) { fail(err); }
}

const award = () => once($('#awardBtn'), awardNow);
async function awardNow() {
  if (!current) return;
  const minutes = Number($('#bonusInput').value);
  const reason = $('#reasonInput').value.trim();
  if (!reason) { $('#awardMessage').textContent = 'Pick or type a reason.'; return; }
  if (!(minutes >= 1 && minutes <= 300)) { $('#awardMessage').textContent = 'Bonus must be 1–300 minutes.'; return; }
  try {
    const id = await rpc('admin_award_bonus', { p_reader: current.reader_id, p_minutes: minutes, p_reason: reason });
    const who = current.display_name ?? 'this reader';
    const readerId = current.reader_id;
    current = { ...current, minutes: Number(current.minutes) + minutes };
    showCurrent();
    $('#awardMessage').replaceChildren(
      `✓ Added ${minutes} bonus minutes to ${who} (${reason}). `,
      el('button', { class: 'btn btn-small', type: 'button', onclick: () => undoBonus(id, minutes, who, readerId) }, 'Undo'));
    loadBonuses();
    $('#scanInput').focus();
  } catch (err) { fail(err); }
}

async function undoBonus(id, minutes, who, readerId) {
  try {
    await db(supabase.from('bonus_awards').delete().eq('id', id));
    if (current && current.reader_id === readerId) { current = { ...current, minutes: Number(current.minutes) - minutes }; showCurrent(); }
    $('#awardMessage').textContent = `Removed ${minutes} bonus minutes from ${who}.`;
    loadBonuses();
  } catch (err) { fail(err); }
}

$('#scanForm').addEventListener('submit', (e) => { e.preventDefault(); lookup($('#scanInput').value); });
$('#awardForm').addEventListener('submit', (e) => { e.preventDefault(); award(); });

async function loadDesk() {
  if (!$('#givePrizeDate').value) $('#givePrizeDate').value = inTwoWeeks();
  showCurrent();
  await loadBonuses();
}

async function loadBonuses() {
  await loadPresets();
  const awards = await rpc('admin_recent_bonuses');
  $('#bonusList').replaceChildren(...(awards.length ? awards.map((a) =>
    el('li', { class: 'row' },
      el('span', { class: 'name' }, a.display_name ?? '(no name yet)',
        el('small', { class: 'muted entry-when' },
          `${a.reason} · ${new Date(a.created_at).toLocaleString('en-NZ', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}`)),
      el('span', { class: 'value' }, `+${a.minutes}`),
      el('button', { class: 'btn btn-small danger', type: 'button', onclick: () => {
        if (confirm(`Remove ${a.minutes} bonus minutes from ${a.display_name ?? 'this reader'}?`)) undoBonus(a.id, a.minutes, a.display_name ?? 'this reader', a.reader_id);
      } }, 'Remove')))
    : [el('li', { class: 'empty' }, 'No bonus minutes given yet.')]));
  if (!document.querySelector('[data-panel="desk"]').classList.contains('hidden') && !current) $('#scanInput').focus();
}

/* ---------- find a reader by name (no tag at the desk) ---------- */

let nameTimer;
$('#nameSearch').addEventListener('input', () => {
  clearTimeout(nameTimer);
  nameTimer = setTimeout(() => findByName().catch(fail), 250);
});

async function findByName() {
  const q = $('#nameSearch').value.trim();
  if (q.length < 2) { $('#nameResults').replaceChildren(); return; }
  const found = (await rpc('admin_readers', { p_search: q })).filter((r) => r.display_name).slice(0, 8);
  if ($('#nameSearch').value.trim() !== q) return; // a newer search is on its way
  $('#nameResults').replaceChildren(...(found.length ? found.map((r) =>
    el('li', {}, el('button', { type: 'button', class: 'row name-pick', onclick: () => openReader(r) },
      el('span', { class: 'name' }, r.display_name, r.note ? el('span', { class: 'muted' }, ` · ${r.note}`) : null),
      el('span', { class: 'value' }, `${Number(r.minutes).toLocaleString()} min`))))
    : [el('li', { class: 'empty' }, 'Nobody with a name like that.')]));
}

/* ========= Leaderboard: pick readers, give prizes or bonus ========= */

let board = [];
let boardSeq = 0;
const picked = new Map(); // reader_id -> display name

async function loadBoard() {
  const f = $('#boardPrizeDate');
  if (!f.value) f.value = inTwoWeeks();
  if (!presets.length) await loadPresets();
  $('#presetReasons').replaceChildren(...presets.map((p) => el('option', { value: p.reason })));
  const days = $('#boardPeriod').value;
  const seq = ++boardSeq;
  const rows = await rpc('admin_leaderboard', { p_days: days ? Number(days) : null, p_search: $('#boardSearch').value.trim() || null });
  if (seq !== boardSeq) return; // a newer search finished first
  board = rows;
  renderBoard();
}

function renderBoard() {
  const days = $('#boardPeriod').value;
  $('#boardTable thead th:nth-child(4)').textContent = days ? `Minutes (last ${days} days)` : 'Minutes';
  $('#boardTable tbody').replaceChildren(...(board.length ? board.map((r) =>
    el('tr', { class: picked.has(r.reader_id) ? 'picked' : '' },
      el('td', {}, el('input', {
        type: 'checkbox', 'aria-label': `Select ${r.display_name}`, checked: picked.has(r.reader_id),
        onchange: (e) => { e.target.checked ? picked.set(r.reader_id, r.display_name) : picked.delete(r.reader_id); renderBoard(); },
      })),
      el('td', { class: 'num' }, r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : r.rank),
      el('td', {}, el('strong', {}, r.display_name), r.note ? el('span', { class: 'muted' }, ` · ${r.note}`) : null),
      el('td', { class: 'num' }, Number(r.minutes).toLocaleString(), days ? el('small', { class: 'muted' }, ` / ${Number(r.total).toLocaleString()}`) : null),
      el('td', {}, r.open_prizes ? el('span', { class: 'pill' }, `${r.open_prizes} to collect`)
        : r.prizes ? el('span', { class: 'muted' }, `${r.prizes} collected`) : el('span', { class: 'muted' }, '—')),
      el('td', { class: 'actions' }, el('button', { class: 'btn btn-small', type: 'button', onclick: () => openReader(r) }, 'Open'))))
    : [el('tr', {}, el('td', { colspan: 6, class: 'empty' }, $('#boardSearch').value.trim() ? 'Nobody matches that.' : 'Nobody has logged reading in this period yet.'))]));
  renderPicked();
}

function renderPicked() {
  $('#boardBar').classList.toggle('hidden', picked.size === 0);
  const names = [...picked.values()];
  $('#boardPicked').textContent = `${names.length} selected: ${names.slice(0, 6).join(', ')}${names.length > 6 ? ` and ${names.length - 6} more` : ''}`;
}

let boardTimer;
$('#boardSearch').addEventListener('input', () => { clearTimeout(boardTimer); boardTimer = setTimeout(() => loadBoard().catch(fail), 250); });
$('#boardPeriod').addEventListener('change', () => { picked.clear(); $('#boardMessage').replaceChildren(); loadBoard().catch(fail); });
document.querySelectorAll('[data-top]').forEach((b) => b.addEventListener('click', () => {
  picked.clear();
  board.filter((r) => r.rank <= Number(b.dataset.top)).forEach((r) => picked.set(r.reader_id, r.display_name));
  renderBoard();
}));
$('#boardClear').addEventListener('click', () => { picked.clear(); renderBoard(); });

const listNames = (names) => (names.length <= 3 ? names.join(', ') : `${names.slice(0, 3).join(', ')} and ${names.length - 3} more`);

$('#boardPrizeForm').addEventListener('submit', (e) => {
  e.preventDefault();
  once(e.target.querySelector('[type=submit]'), async () => {
    const prize = $('#boardPrize').value.trim();
    if (!prize) { $('#boardMessage').textContent = 'Type what the prize is first.'; return; }
    const names = [...picked.values()];
    if (!confirm(`Give “${prize}” to ${names.length === 1 ? names[0] : `these ${names.length} readers`}?\n\n${names.join(', ')}`)) return;
    try {
      await rpc('admin_give_prize_many', { p_readers: [...picked.keys()], p_prize: prize, p_collect_by: $('#boardPrizeDate').value || null });
      $('#boardMessage').textContent = `🎁 Gave “${prize}” to ${listNames(names)}. They'll see it next time they open their page.`;
      $('#boardPrize').value = '';
      picked.clear();
      loadBoard();
    } catch (err) { fail(err); }
  });
});

$('#boardBonusForm').addEventListener('submit', (e) => {
  e.preventDefault();
  once(e.target.querySelector('[type=submit]'), async () => {
    const reason = $('#boardReason').value.trim();
    const minutes = Number($('#boardMinutes').value);
    if (!reason) { $('#boardMessage').textContent = 'Type what the bonus is for.'; return; }
    if (!(minutes >= 1 && minutes <= 300)) { $('#boardMessage').textContent = FRIENDLY.invalid_minutes; return; }
    const names = [...picked.values()];
    if (names.length > 1 && !confirm(`Add ${minutes} bonus minutes (${reason}) to each of these ${names.length} readers?\n\n${names.join(', ')}`)) return;
    try {
      const ids = await rpc('admin_award_bonus_many', { p_readers: [...picked.keys()], p_minutes: minutes, p_reason: reason });
      picked.clear();
      $('#boardMessage').replaceChildren(`✓ Added ${minutes} bonus minutes to ${listNames(names)} (${reason}). `,
        el('button', { class: 'btn btn-small', type: 'button', onclick: async () => {
          try {
            await db(supabase.from('bonus_awards').delete().in('id', ids));
            $('#boardMessage').textContent = `Removed those ${minutes} bonus minutes.`;
            loadBoard();
          } catch (err) { fail(err); }
        } }, 'Undo'));
      loadBoard();
    } catch (err) { fail(err); }
  });
});

/* ---------- camera scanning ---------- */

let stream = null;
let scanTimer = null;
let lastScan = { code: '', at: 0 };

async function qrReader() {
  if ('BarcodeDetector' in window) {
    try {
      if ((await BarcodeDetector.getSupportedFormats()).includes('qr_code')) {
        const detector = new BarcodeDetector({ formats: ['qr_code'] });
        return async (video) => (await detector.detect(video))[0]?.rawValue ?? null;
      }
    } catch { /* fall back */ }
  }
  // Fallback for browsers without a built-in QR reader.
  if (!window.jsQR) {
    await new Promise((resolve, reject) => {
      const script = el('script', { src: 'vendor/jsQR.js' });
      script.onload = resolve;
      script.onerror = () => reject(new Error('Couldn’t load the QR reader.'));
      document.head.append(script);
    });
  }
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  return async (video) => {
    if (!video.videoWidth) return null;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    return window.jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height)?.data ?? null;
  };
}

async function startCamera() {
  const video = $('#scanVideo');
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
  } catch (err) {
    $('#scanMessage').textContent = `Camera unavailable: ${err.message}. Use a scanner or type the code instead.`;
    return;
  }
  video.srcObject = stream;
  video.classList.remove('hidden');
  await video.play();
  $('#cameraBtn').textContent = '⏹ Stop camera';
  const read = await qrReader().catch((err) => { $('#scanMessage').textContent = err.message; return null; });
  if (!read) return stopCamera();
  const loop = async () => {
    if (!stream) return;
    try {
      const text = await read(video);
      const code = text && extractCode(text);
      // Ignore the same tag held in front of the camera for a few seconds.
      if (code && !(code === lastScan.code && Date.now() - lastScan.at < 4000)) {
        markActive();
        video.classList.add('hit');
        setTimeout(() => video.classList.remove('hit'), 600);
        await lookup(code);
      }
    } catch { /* keep scanning */ }
    scanTimer = setTimeout(loop, 250);
  };
  loop();
}

function stopCamera() {
  clearTimeout(scanTimer);
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  const video = $('#scanVideo');
  video.srcObject = null;
  video.classList.add('hidden');
  $('#cameraBtn').textContent = '📷 Use camera';
}

$('#cameraBtn').addEventListener('click', () => (stream ? stopCamera() : startCamera()));

/* ========= Prizes tab ========= */

let openPrizes = [];

async function loadPrizesTab() {
  const f = $('#drawForm').elements;
  if (!f.collectBy.value) f.collectBy.value = inTwoWeeks();
  await Promise.all([loadOpenPrizes(), loadDraws(), updatePreview()]);
}

async function loadOpenPrizes() {
  openPrizes = await rpc('admin_prizes', { p_status: 'open' });
  const overdue = openPrizes.filter((p) => p.status === 'overdue').length;
  $('#openCount').textContent = `${openPrizes.length} to collect${overdue ? ` · ${overdue} overdue` : ''}`;
  $('#openCount').className = overdue ? 'pill warn-pill' : 'pill';
  renderOpenPrizes();
}

function renderOpenPrizes() {
  const q = $('#prizeFilter').value.trim().toLowerCase();
  const shown = openPrizes.filter((p) => !q || [p.display_name, p.note, p.prize].some((v) => v?.toLowerCase().includes(q)));
  $('#openPrizes').replaceChildren(...(shown.length ? shown.map((p) =>
    el('li', { class: 'row' },
      el('span', { class: 'name' },
        el('strong', {}, p.display_name ?? '(no name yet)'), p.note ? el('span', { class: 'muted' }, ` · ${p.note}`) : null,
        ' — ', p.prize, ' ', el('span', { class: PRIZE_STATUS[p.status].cls }, PRIZE_STATUS[p.status].label),
        el('small', { class: 'muted entry-when' }, prizeLine(p))),
      el('span', { class: 'actions-inline' },
        el('button', { class: 'btn btn-small', type: 'button', onclick: () => openReader(p) }, 'Open at desk'),
        prizeActions(p, p.reader_id, p.display_name, () => loadPrizesTab()))))
    : [el('li', { class: 'empty' }, openPrizes.length ? 'Nothing matches that filter.' : 'Nothing waiting to be collected. 🎉')]));
}
$('#prizeFilter').addEventListener('input', renderOpenPrizes);

function drawArgs() {
  const f = $('#drawForm').elements;
  return {
    p_prize: f.prize.value.trim(),
    p_count: Number(f.count.value),
    p_min_minutes: Number(f.min.value) || 0,
    p_active_days: f.days.value ? Number(f.days.value) : null,
    p_weighted: f.weighted.checked,
    p_exclude_past_winners: f.exclude.checked,
    p_collect_by: f.collectBy.value || null,
  };
}

let previewTimer;
let eligible = null;
async function updatePreview() {
  const a = drawArgs();
  try {
    eligible = await rpc('admin_draw_preview', { p_min_minutes: a.p_min_minutes, p_active_days: a.p_active_days, p_exclude_past_winners: a.p_exclude_past_winners });
    $('#drawPreview').textContent = `${eligible} reader${eligible === 1 ? '' : 's'} eligible`;
    $('#drawPreview').className = eligible ? 'pill ok' : 'pill warn-pill';
  } catch (err) { $('#drawPreview').textContent = ''; }
}
['min', 'days', 'exclude'].forEach((n) => $('#drawForm').elements[n].addEventListener('input', () => {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(updatePreview, 250);
}));

$('#drawForm').addEventListener('submit', (e) => {
  e.preventDefault();
  once(e.target.querySelector('[type=submit]'), async () => {
    const a = drawArgs();
    $('#drawMessage').textContent = '';
    if (eligible === 0) { $('#drawMessage').textContent = FRIENDLY.no_eligible; return; }
    const n = Math.min(a.p_count, eligible ?? a.p_count);
    if (!confirm(`Draw ${n} winner${n === 1 ? '' : 's'} for “${a.p_prize}” from ${eligible} eligible reader${eligible === 1 ? '' : 's'}?\n\nThe draw is recorded and can't be re-run quietly.`)) return;
    try {
      const winners = await rpc('admin_run_draw', a);
      $('#drawMessage').classList.add('ok');
      $('#drawMessage').textContent = `🎉 Winner${winners.length === 1 ? '' : 's'}: ${winners.map((w) => w.display_name + (w.note ? ` (${w.note})` : '')).join(', ')}.`
        + (winners.length < a.p_count ? ` Only ${winners.length} reader${winners.length === 1 ? '' : 's'} matched.` : '');
      const f = e.target.elements;
      f.prize.value = '';
      f.count.value = 1;
      loadPrizesTab();
    } catch (err) { fail(err); }
  });
});

async function loadDraws() {
  const draws = await rpc('admin_draws');
  const rules = (c) => c.direct ? 'Given directly to one reader' : [
    c.min_minutes ? `${c.min_minutes}+ minutes` : null,
    c.active_days ? `read in the last ${c.active_days} days` : null,
    c.weighted ? 'weighted by minutes' : 'equal chances',
    c.exclude_past_winners ? 'no repeat winners' : null,
  ].filter(Boolean).join(' · ');
  $('#drawList').replaceChildren(...(draws.length ? draws.map((d) => {
    const active = d.winners.filter((w) => w.status !== 'cancelled');
    return el('section', { class: 'history-item' },
      el('div', { class: 'input-row' },
        el('strong', { class: 'grow' }, `${d.criteria.direct ? '🎁' : '🎲'} ${d.prize}`),
        el('span', { class: 'muted' }, fmtDate(d.created_at)),
        !d.criteria.direct && active.length ? el('button', { class: 'btn btn-small', type: 'button', onclick: () => postWinners(d, active) }, 'Post to News') : null),
      el('p', { class: 'tiny-note' }, rules(d.criteria), d.collect_by ? ` · collect by ${shortDate(d.collect_by)}` : ''),
      el('ul', { class: 'draw-winners' }, d.winners.map((w) => el('li', { class: w.status === 'cancelled' ? 'cancelled' : '' },
        el('span', { class: 'winner-name' }, w.display_name ?? '(no name yet)', w.note ? el('span', { class: 'muted' }, ` · ${w.note}`) : null),
        el('span', { class: PRIZE_STATUS[w.status].cls }, PRIZE_STATUS[w.status].label),
        w.collected_via ? el('small', { class: 'muted' }, w.collected_via === 'tag' ? 'tag checked' : `no tag: ${w.collect_note}`) : null,
        w.status === 'cancelled' ? el('button', { class: 'btn btn-small', type: 'button', onclick: async () => {
          if (!confirm(`Restore ${w.display_name ?? 'this reader'}'s “${d.prize}”?`)) return;
          try { await rpc('admin_cancel_prize', { p_draw: d.id, p_reader: w.reader_id, p_cancel: false }); loadPrizesTab(); } catch (err) { fail(err); }
        } }, 'Restore') : null))));
  }) : [el('p', { class: 'muted' }, 'No prizes yet.')]));
}

async function postWinners(d, winners) {
  const names = winners.map((w) => w.display_name).filter(Boolean);
  if (!confirm(`Publish a News post congratulating ${names.join(', ')}?`)) return;
  try {
    await db(supabase.from('announcements').insert({
      title_en: `🎉 ${d.prize}: winners drawn!`,
      body_en: `Congratulations ${names.join(', ')}!\nBring your reading tag to a library desk to collect your prize${d.collect_by ? ` by ${shortDate(d.collect_by)}` : ''}.`,
      published: true,
    }));
    alert('Posted to News.');
  } catch (err) { fail(err); }
}

/* ========= Books: hiding titles ========= */

async function loadBooks() {
  const books = await rpc('admin_books', { p_search: $('#bookSearch').value.trim() || null });
  $('#booksTable tbody').replaceChildren(...(books.length ? books.map((b) =>
    el('tr', {},
      el('td', {}, el('strong', {}, b.book_title), b.hidden ? el('span', {}, ' ', el('span', { class: 'pill warn-pill' }, 'Hidden')) : null),
      el('td', { class: 'num' }, b.readers),
      el('td', { class: 'num' }, b.rating_count ? `★ ${Number(b.avg_rating).toFixed(1)} (${b.rating_count})` : '—'),
      el('td', { class: 'actions' },
        el('button', { class: `btn btn-small${b.hidden ? '' : ' danger'}`, onclick: () => {
          if (!b.hidden && !confirm(`Hide “${b.book_title}” from suggestions and Community favourites?`)) return;
          updateBook(b, { hidden: !b.hidden });
        } }, b.hidden ? 'Unhide' : 'Hide title'))))
    : [el('tr', {}, el('td', { colspan: '4', class: 'muted' }, 'No books logged yet.'))]));
}

async function updateBook(b, values, refresh = loadBooks) {
  try { await db(supabase.from('book_stats').update(values).eq('book_key', b.book_key)); await refresh(); } catch (err) { fail(err); }
}

let bookSearchTimer;
$('#bookSearch').addEventListener('input', () => {
  clearTimeout(bookSearchTimer);
  bookSearchTimer = setTimeout(() => loadBooks().catch(fail), 300);
});

/* ========= Bingo ========= */

async function loadBingo() {
  const squares = await db(supabase.from('bingo_squares').select('*').order('position'));
  $('#bingoSave').disabled = true;
  $('#bingoSaveMessage').textContent = '';
  $('#bingoTable tbody').replaceChildren(...squares.map((sq) => {
    const input = (field, attrs = {}) => el('input', { value: sq[field] ?? '', 'data-field': field, ...attrs });
    return el('tr', { 'data-position': sq.position },
      el('td', {}, sq.position + 1),
      el('td', {}, input('icon', { maxlength: '8', class: 'narrow', 'aria-label': 'Icon (emoji)' })),
      el('td', {}, input('title_en', { maxlength: '40', required: true })),
      el('td', {}, input('description_en', { maxlength: '300', required: true })),
      el('td', {}, input('title_mi', { maxlength: '40' })),
      el('td', {}, input('description_mi', { maxlength: '300' })),
      el('td', {}, input('bonus_minutes', { type: 'number', min: '0', max: '120', class: 'narrow' })));
  }));
}

// Edits only mark the row; one Save writes every changed row.
$('#bingoTable').addEventListener('input', (e) => {
  e.target.closest('tr')?.classList.add('changed');
  $('#bingoSave').disabled = false;
  $('#bingoSaveMessage').textContent = '';
});

$('#bingoSave').addEventListener('click', () => once($('#bingoSave'), async () => {
  const rows = [...document.querySelectorAll('#bingoTable tr.changed')];
  for (const row of rows) {
    const values = {};
    row.querySelectorAll('[data-field]').forEach((i) => { values[i.dataset.field] = i.value.trim() || null; });
    values.bonus_minutes = Number(values.bonus_minutes ?? 0);
    if (!values.title_en || !values.description_en) {
      alert(`Square ${Number(row.dataset.position) + 1}: the English title and description are required.`);
      return;
    }
    try {
      await db(supabase.from('bingo_squares').update(values).eq('position', Number(row.dataset.position)));
      row.classList.remove('changed');
    } catch (err) { fail(err); return; }
  }
  $('#bingoSaveMessage').textContent = `Saved ${rows.length} square${rows.length === 1 ? '' : 's'} ✓`;
}).then(() => { $('#bingoSave').disabled = !document.querySelector('#bingoTable tr.changed'); }));

/* ========= News ========= */

async function loadNews() {
  const items = await db(supabase.from('announcements').select('*').order('created_at', { ascending: false }));
  $('#newsList').replaceChildren(...items.map((a) =>
    el('li', { class: 'row news-admin' },
      el('div', { class: 'name' }, el('strong', {}, a.title_en), el('div', { class: 'muted' }, a.body_en)),
      el('span', { class: a.published ? 'pill ok' : 'pill' }, a.published ? 'Published' : 'Draft'),
      el('button', { class: 'btn btn-small', onclick: async () => {
        try { await db(supabase.from('announcements').update({ published: !a.published }).eq('id', a.id)); loadNews(); } catch (err) { fail(err); }
      } }, a.published ? 'Unpublish' : 'Publish'),
      el('button', { class: 'btn btn-small danger', onclick: async () => {
        if (!confirm('Delete this announcement?')) return;
        try { await db(supabase.from('announcements').delete().eq('id', a.id)); loadNews(); } catch (err) { fail(err); }
      } }, 'Delete'))));
}

$('#newsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const value = (k) => (f.get(k) ?? '').toString().trim() || null;
  try {
    await db(supabase.from('announcements').insert({
      title_en: value('title_en'), body_en: value('body_en'),
      title_mi: value('title_mi'), body_mi: value('body_mi'),
      published: f.get('published') === 'on',
    }));
    e.target.reset();
    loadNews();
  } catch (err) { fail(err); }
});

/* ========= Blocked words ========= */

async function loadWords() {
  const words = await db(supabase.from('blocked_words').select('word').order('word'));
  $('#wordList').replaceChildren(...words.map(({ word }) =>
    el('li', { class: 'word-chip' }, word, el('button', { 'aria-label': `Remove ${word}`, onclick: async () => {
      try { await db(supabase.from('blocked_words').delete().eq('word', word)); loadWords(); } catch (err) { fail(err); }
    } }, '×'))));
}

$('#wordForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await db(supabase.from('blocked_words').upsert({ word: $('#wordInput').value.trim().toLowerCase() }));
    $('#wordInput').value = '';
    loadWords();
  } catch (err) { fail(err); }
});

/* ========= New season ========= */

$('#newSeasonBtn').addEventListener('click', async () => {
  let open = 0;
  try { open = (await rpc('admin_prizes', { p_status: 'open' })).length; } catch { /* ignore */ }
  const typed = prompt('This permanently clears this season’s reading for everyone.'
    + (open ? `\n\n⚠️ ${open} prize${open === 1 ? ' hasn’t' : 's haven’t'} been collected yet. They will be cleared too.` : '')
    + '\n\nType NEW SEASON to confirm:');
  if (typed === null) return;
  if (typed.trim().toUpperCase() !== 'NEW SEASON') {
    $('#seasonMessage').textContent = 'Not started: the confirmation didn’t match.';
    return;
  }
  try {
    await rpc('admin_new_season', { p_confirm: 'NEW SEASON' });
    $('#seasonMessage').classList.add('ok');
    $('#seasonMessage').textContent = 'New season started. Everyone is back to 0 minutes.';
  } catch (err) { fail(err); }
});

/* ========= Settings ========= */

async function loadSettings() {
  await Promise.all([loadPresets(), loadTagAddress()]);
  const s = await db(supabase.from('settings').select('*').single());
  const form = $('#settingsForm');
  for (const [k, v] of Object.entries(s)) if (form.elements[k]) form.elements[k].value = v ?? '';
}

$('#settingsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target.elements;
  try {
    await db(supabase.from('settings').update({
      community_goal: Number(f.community_goal.value),
      starts_on: f.starts_on.value || null,
      ends_on: f.ends_on.value || null,
      max_session_minutes: Number(f.max_session_minutes.value),
      max_daily_minutes: Number(f.max_daily_minutes.value),
      bingo_line_bonus: Number(f.bingo_line_bonus.value),
      bingo_card_bonus: Number(f.bingo_card_bonus.value),
    }).eq('id', true));
    $('#settingsMessage').textContent = 'Saved ✓';
    setTimeout(() => { $('#settingsMessage').textContent = ''; }, 2000);
  } catch (err) { fail(err); }
});

/* ========= Downloads (CSV) ========= */

function downloadCsv(filename, rows) {
  // Quote every cell and neutralise formula injection for Excel.
  const cell = (v) => `"${String(v ?? '').replace(/^([=+\-@\t\r\s])/, "'$1").replace(/"/g, '""')}"`;
  // BOM so Excel reads macrons (ā, ō) correctly.
  const csv = `﻿${rows.map((r) => r.map(cell).join(',')).join('\r\n')}`;
  const a = el('a', { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })), download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  $('#exportMessage').textContent = `Downloaded ${filename} (${rows.length - 1} rows).`;
}

const stamp = () => new Date().toISOString().slice(0, 10);

$('#exportReaders').addEventListener('click', () => once($('#exportReaders'), async () => {
  try {
    const all = await rpc('admin_all_readers');
    downloadCsv(`readers-${stamp()}.csv`, [['display_name', 'note', 'minutes', 'last_read_at', 'created_at'],
      ...all.map((r) => [r.display_name, r.note, r.minutes, r.last_read_at, r.created_at])]);
  } catch (err) { fail(err); }
}));

$('#exportLogs').addEventListener('click', () => once($('#exportLogs'), async () => {
  try {
    const names = new Map((await rpc('admin_all_readers')).map((r) => [r.reader_id, r]));
    const logs = [];
    // The API returns at most 1,000 rows per request, so page through.
    for (let from = 0; ; from += 1000) {
      const page = await db(supabase.from('reading_logs').select('reader_id,minutes,book_title,source,created_at')
        .order('created_at', { ascending: true }).range(from, from + 999));
      logs.push(...page);
      if (page.length < 1000) break;
    }
    downloadCsv(`reading-log-${stamp()}.csv`, [['logged_at', 'display_name', 'note', 'book_title', 'minutes', 'source'],
      ...logs.map((l) => [l.created_at, names.get(l.reader_id)?.display_name, names.get(l.reader_id)?.note, l.book_title, l.minutes, l.source])]);
  } catch (err) { fail(err); }
}));

$('#exportPrizes').addEventListener('click', () => once($('#exportPrizes'), async () => {
  try {
    const prizes = await rpc('admin_prizes', { p_status: null });
    downloadCsv(`prizes-${stamp()}.csv`, [['won_at', 'prize', 'display_name', 'note', 'how', 'status', 'collect_by', 'collected_at', 'cancelled_at'],
      ...prizes.map((p) => [p.won_at, p.prize, p.display_name, p.note, p.direct ? 'given directly' : 'draw', p.status, p.collect_by, p.claimed_at, p.cancelled_at])]);
  } catch (err) { fail(err); }
}));

if (openedFromPasswordReset) {
  supabase.auth.getSession().then(({ data }) => (data.session ? showNewPasswordForm() : boot())).catch(fail);
} else {
  boot().catch(fail);
}

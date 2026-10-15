import { supabase, rpc, el, $, footer } from './lib.js';
import { t, lang, setLang, applyStatic, errorText, formatDuration } from './i18n.js';
import { coastSVG, placeBoat, fitScene } from './scene.js';

let dash = null;          // last get_dashboard() result
let busy = false;

$('#footerSlot').replaceWith(footer());

/* ========= Scene ========= */

function drawScene() {
  const frame = $('#coast');
  frame.querySelector('svg')?.remove();
  frame.insertAdjacentHTML('afterbegin', coastSVG({ startLabel: t('startLabel'), endLabel: t('goalLabel') }));
  fitScene(frame);
  if (dash) placeBoat(frame, dash.community.minutes / dash.community.goal);
}

/* ========= Loading ========= */

async function load() {
  try {
    dash = await rpc('get_dashboard', { p_lang: lang });
  } catch (err) {
    if (err.message === 'not_signed_in') return location.replace('index.html');
    console.error(err);
    showMessage(errorText(err));
    return;
  }
  render();
  $('#dashboard').setAttribute('aria-busy', 'false');
  if (!dash.me.display_name) askForName();
}

async function act(fn) {
  if (busy) return;
  busy = true;
  try {
    await fn();
    await load();
  } catch (err) {
    console.error(err);
    if (err.message === 'not_signed_in') return location.replace('index.html');
    showMessage(errorText(err, { n: dash?.settings.max_session_minutes }));
  } finally {
    busy = false;
  }
}

// Messages show inside the log box while it's open, otherwise on the page.
// `action` is an optional button, e.g. Undo.
function showMessage(text, ok = false, action = null, where = null) {
  const msg = where ?? ($('#logDialog').open ? $('#logMessage') : $('#pageMessage'));
  msg.replaceChildren(text, action ? ' ' : '', action ?? '');
  msg.classList.toggle('ok', ok);
}

function removeEntry(entry, ask = true) {
  if (ask && !confirm(t('removeConfirm', { n: entry.minutes, title: entry.title }))) return;
  return act(async () => {
    await rpc('delete_my_log', { p_log_id: entry.id });
    showMessage(t('removed', { n: entry.minutes, title: entry.title }), true);
  });
}

/* ========= Rendering ========= */

function render() {
  applyStatic();
  const { me, community, settings } = dash;

  const name = me.display_name ?? '';
  $('#profileInitial').textContent = name ? name[0].toUpperCase() : '·';
  $('#welcomeMessage').textContent = name ? `${t('hello')}, ${name}!` : `${t('hello')}!`;
  $('#streak').textContent = `${me.streak}🔥`;
  $('#rank').textContent = me.rank ? `#${me.rank}` : '–';
  // Compact so it fits the tile on a phone: "45 mins", "2h 10m".
  $('#myMinutes').textContent = me.minutes < 60 ? `${me.minutes} ${t('mins')}` : `${Math.floor(me.minutes / 60)}h ${me.minutes % 60}m`;
  $('#myMinutes').title = formatDuration(me.minutes);

  const pct = (community.minutes / community.goal) * 100;
  $('#communityLine').replaceChildren(...splitTemplate(t('communityLine', { minutes: '{minutes}', pct: '{pct}' }), {
    minutes: el('span', { class: 'big' }, community.minutes.toLocaleString('en-NZ')),
    pct: pct < 10 ? pct.toFixed(1) : Math.floor(pct),
  }));
  $('#goalFill').style.width = `${Math.min(pct, 100)}%`;
  $('#goalPct').textContent = t('goalPct', { pct: pct < 10 ? pct.toFixed(1) : Math.floor(pct) });
  $('#goalOf').textContent = t('goalOf', { goal: community.goal.toLocaleString('en-NZ') });
  placeBoat($('#coast'), community.minutes / community.goal);
  const goalLabel = $('#coast [data-goal-label]');
  if (goalLabel) goalLabel.textContent = t('endLabel', { goal: community.goal.toLocaleString('en-NZ') });

  $('#closedBanner').classList.toggle('hidden', settings.open);
  $('#maxSessionNote').textContent = t('maxSession', { n: settings.max_session_minutes });
  $('#minutes').max = settings.max_session_minutes;

  renderPrizes();
  renderRecent();
  renderBingo();
  renderLeaderboard();
  renderBookshelf();
  renderFavourites();
  renderNews();
  renderNewsFlash();
}

// Fill a translated sentence with text or elements, without using HTML.
function splitTemplate(text, parts) {
  return text.split(/(\{\w+\})/).map((piece) => {
    const key = piece.match(/^\{(\w+)\}$/)?.[1];
    return key ? (parts[key] ?? '') : piece;
  });
}

// Pop up each new prize once (remembered per device).
const SEEN_KEY = 'seenPrizes';
function seenPrizes() {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY)) ?? []); } catch { return new Set(); }
}
function announcePrizes() {
  const seen = seenPrizes();
  // Keyed by name too, so two kids sharing a device each get their own popup.
  const key = (p) => `${dash.me.display_name}|${p.prize}|${p.drawn_at}`;
  const fresh = dash.prizes.filter((p) => !seen.has(key(p)));
  const dialog = $('#prizeDialog');
  if (!fresh.length || dialog.open || $('#nameDialog').open) return;
  $('#prizeDialogTitle').textContent = t('prizeTitle', { prize: fresh.map((p) => p.prize).join(' + ') });
  $('#prizeDialogWhen').textContent = fresh.length === 1 ? prizeWhen(fresh[0]) : '';
  $('#prizeDialogOk').onclick = () => dialog.close();
  dialog.onclose = () => {
    fresh.forEach((p) => seen.add(key(p)));
    try { localStorage.setItem(SEEN_KEY, JSON.stringify([...seen])); } catch { /* private mode */ }
    launchConfetti();  // after closing: popups sit above the confetti canvas
  };
  dialog.showModal();
}

function prizeWhen(p) {
  if (p.overdue) return t('prizeOverdue');
  if (!p.collect_by) return '';
  const date = new Date(`${p.collect_by}T12:00:00`).toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' });
  return t('prizeCollectBy', { date });
}

function renderPrizes() {
  announcePrizes();
  const name = dash.me.display_name ?? '';
  $('#prizes').replaceChildren(...dash.prizes.map((p) =>
    el('section', { class: 'prize', role: 'status' },
      el('div', { class: 'prize-icon', 'aria-hidden': 'true' }, '🎉'),
      el('div', {},
        el('h3', {}, t('prizeTitle', { prize: p.prize })),
        el('p', {}, t('prizeBody'), ' ', el('strong', {}, prizeWhen(p))),
        el('span', { class: 'who' }, name)))));
}

function entryLabel(entry) {
  if (entry.kind === 'bonus') return `🎁 ${t('bonusEntry', { reason: entry.title })}`;
  if (entry.kind === 'bingo') return `🎉 ${t(entry.title === '12' ? 'bingoCardEntry' : 'bingoLineEntry')}`;
  return entry.title;
}

function renderRecent() {
  const list = $('#recent');
  if (!dash.recent.length) {
    list.replaceChildren(el('li', { class: 'empty' }, t('noRecent')));
    return;
  }
  const when = (iso) => new Date(iso).toLocaleString('en-NZ', { weekday: 'short', hour: 'numeric', minute: '2-digit' });
  list.replaceChildren(...dash.recent.map((entry) =>
    el('li', { class: `row${entry.kind !== 'reading' ? ' bonus-row' : ''}` },
      el('span', { class: 'name' }, entryLabel(entry),
        el('small', { class: 'muted entry-when' }, `${when(entry.created_at)}${entry.source === 'timer' ? ` · ⏱ ${t('timerEntry')}` : ''}`)),
      el('span', { class: 'value' }, entry.kind !== 'reading' ? `+${entry.minutes}` : entry.minutes, el('small', {}, ` ${t('mins')}`)),
      entry.kind === 'reading' && entry.can_undo ? el('button', { class: 'btn btn-small', type: 'button', onclick: () => removeEntry(entry) }, t('remove')) : null)));
}

function renderLeaderboard() {
  const list = $('#leaderboard');
  if (!dash.leaderboard.length) {
    list.replaceChildren(el('li', { class: 'empty' }, t('noReaders')));
    return;
  }
  const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };
  let prevRank = 0;
  list.replaceChildren(...dash.leaderboard.flatMap((row) => {
    const items = [];
    if (row.rank > prevRank + 1 && prevRank >= 8) items.push(el('li', { class: 'gap', 'aria-hidden': 'true' }, '• • •'));
    prevRank = row.rank;
    items.push(el('li', { class: `row${row.is_me ? ' me' : ''}${row.rank <= 3 ? ` top${row.rank}` : ''}` },
      el('span', { class: 'rank' }, medals[row.rank] ?? `#${row.rank}`),
      el('span', { class: 'avatar', 'aria-hidden': 'true' }, row.name[0].toUpperCase()),
      el('span', { class: 'name' }, row.name, row.is_me ? el('span', { class: 'you' }, ` (${t('you')})`) : null),
      el('span', { class: 'value' }, row.minutes.toLocaleString('en-NZ'), el('small', {}, ` ${t('mins')}`)),
    ));
    return items;
  }));
}

// A clay "book" for a title: colour and pattern come from the title, so the
// same book always looks the same on every shelf.
function book_(title, mini = false) {
  let hash = 0;
  for (const ch of title.toLowerCase()) hash = (hash * 31 + ch.codePointAt(0)) >>> 0;
  return el('div', { class: `book c${hash % 6} p${(hash >>> 4) % 4}${mini ? ' mini' : ''}`, 'aria-hidden': 'true' },
    el('span', { class: 'book-title' }, mini ? [...title][0].toUpperCase() : title));
}

function renderBookshelf() {
  const list = $('#bookshelf');
  $('#shelfHint').classList.toggle('hidden', !dash.bookshelf.length);
  if (!dash.bookshelf.length) {
    list.replaceChildren(el('li', { class: 'empty' }, t('shelfEmpty')));
    return;
  }
  list.replaceChildren(...dash.bookshelf.map((book) =>
    el('li', { title: book.title },
      book_(book.title),
      el('span', { class: 'sr-only' }, book.title),
      el('span', { class: 'stars', role: 'radiogroup', 'aria-label': book.title },
        [1, 2, 3, 4, 5].map((n) => el('button', {
          type: 'button',
          class: `star${n <= (book.rating ?? 0) ? ' filled' : ''}`,
          role: 'radio',
          'aria-checked': String(n === book.rating),
          'aria-label': t('rateBook', { title: book.title, n }),
          onclick: () => act(() => rpc('rate_book', { p_book_key: book.book_key, p_rating: n === book.rating ? null : n })),
        }, '★'))))));
}

function renderFavourites() {
  const list = $('#favourites');
  if (!dash.top_rated.length) {
    list.replaceChildren(el('li', { class: 'empty' }, t('noRatings')));
    return;
  }
  list.replaceChildren(...dash.top_rated.map((book) =>
    el('li', { class: 'row' },
      book_(book.title, true),
      el('span', { class: 'name' }, book.title),
      el('span', { class: 'value score' }, `★ ${Number(book.rating).toFixed(1)}`, el('small', {}, ` (${book.votes})`)))));
}

// The newest post from the last week, up top until the kid taps "Got it".
const SEEN_NEWS_KEY = 'seenNews';
function renderNewsFlash() {
  let seen = [];
  try { seen = JSON.parse(localStorage.getItem(SEEN_NEWS_KEY)) ?? []; } catch { /* ignore */ }
  const latest = dash.announcements[0];
  const fresh = latest && Date.now() - new Date(latest.created_at) < 7 * 864e5 && !seen.includes(latest.id);
  if (!fresh) { $('#newsFlash').replaceChildren(); return; }
  $('#newsFlash').replaceChildren(el('section', { class: 'card news-flash', 'aria-labelledby': 'newsFlashTitle' },
    el('span', { class: 'news-flash-icon', 'aria-hidden': 'true' }, '📣'),
    el('div', { class: 'grow' },
      el('p', { class: 'news-flash-label' }, t('newsFlash')),
      el('h3', { id: 'newsFlashTitle' }, latest.title),
      el('p', { class: 'news-body' }, latest.body)),
    el('button', { class: 'btn btn-secondary btn-small', type: 'button', onclick: () => {
      try { localStorage.setItem(SEEN_NEWS_KEY, JSON.stringify([...seen, latest.id].slice(-20))); } catch { /* ignore */ }
      $('#newsFlash').replaceChildren();
    } }, t('gotIt'))));
}

function renderNews() {
  const box = $('#news');
  if (!dash.announcements.length) {
    box.replaceChildren(el('p', { class: 'empty' }, t('noNews')));
    return;
  }
  box.replaceChildren(...dash.announcements.map((a) =>
    el('details', { class: 'news-item' },
      el('summary', {},
        el('span', {}, a.title),
        el('time', { datetime: a.created_at }, new Date(a.created_at).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' }))),
      el('p', { class: 'news-body' }, a.body))));
  box.querySelector('details')?.setAttribute('open', '');
}

/* ========= Bingo ========= */

const SIZE = 5;
let openSquare = null;

function renderBingo() {
  $('#bingoBoard').replaceChildren(...dash.bingo.map((sq) =>
    el('button', {
      type: 'button',
      class: `bingo-cell${sq.done ? ' done' : ''}`,
      'aria-pressed': String(sq.done),
      'aria-label': sq.title,
      title: sq.title,
      onclick: () => openBingo(sq),
    },
    el('span', { class: 'bingo-icon', 'aria-hidden': 'true' }, sq.icon ?? '📖'),
    el('span', { class: 'bingo-label' }, sq.title))));
}

function openBingo(sq) {
  openSquare = sq;
  $('#bingoIcon').textContent = sq.done ? '✅' : (sq.icon ?? '📖');
  $('#bingoTitle').textContent = sq.done ? t('completed') : sq.title;
  $('#bingoDescription').textContent = sq.description;
  $('#bingoBonus').textContent = t('bonus', { n: sq.bonus });
  $('#bingoConfirm').textContent = sq.done ? t('unmark') : t('iDidIt');
  $('#bingoDialog').showModal();
}

$('#bingoCancel').addEventListener('click', () => $('#bingoDialog').close());
$('#bingoConfirm').addEventListener('click', () => {
  $('#bingoDialog').close();
  const sq = openSquare;
  act(async () => {
    const before = new Set(dash.bingo.filter((s) => s.done).map((s) => s.position));
    $('#bingoMessage').textContent = '';
    const done = await rpc('toggle_bingo', { p_position: sq.position });
    if (!done) return;
    const after = new Set([...before, sq.position]);
    const newLines = countLines(after) - countLines(before);
    const fullCard = after.size === SIZE * SIZE;
    if (fullCard) {
      showMessage(t('bingoFullCard', { n: dash.settings.bingo_card_bonus + newLines * dash.settings.bingo_line_bonus }), true, null, $('#bingoMessage'));
      launchConfetti();
      setTimeout(launchConfetti, 900);
    } else if (newLines > 0) {
      showMessage(t(newLines > 1 ? 'bingoLines' : 'bingoLine', { count: newLines, n: newLines * dash.settings.bingo_line_bonus }), true, null, $('#bingoMessage'));
      launchConfetti();
    }
  });
});

// Rows, columns and both diagonals: the same lines the server pays out for.
const LINES = (() => {
  const lines = [];
  for (let i = 0; i < SIZE; i++) {
    lines.push([...Array(SIZE)].map((_, j) => i * SIZE + j));  // row
    lines.push([...Array(SIZE)].map((_, j) => j * SIZE + i));  // column
  }
  lines.push([...Array(SIZE)].map((_, j) => j * SIZE + j));
  lines.push([...Array(SIZE)].map((_, j) => j * SIZE + (SIZE - 1 - j)));
  return lines;
})();
const countLines = (done) => LINES.filter((line) => line.every((p) => done.has(p))).length;

/* ========= Log reading dialog ========= */

const logDialog = $('#logDialog');
const CHIP_MINUTES = [10, 15, 20, 30, 45, 60];

function setMinutes(n) {
  $('#minutes').value = n ?? '';
  $('#minuteChips').querySelectorAll('button').forEach((b) =>
    b.setAttribute('aria-pressed', String(Number(b.dataset.min) === n)));
}

$('#minuteChips').replaceChildren(...CHIP_MINUTES.map((n) =>
  el('button', { type: 'button', class: 'chip-btn', 'data-min': String(n), 'aria-pressed': 'false', onclick: () => setMinutes(n) }, String(n))));
$('#minutes').addEventListener('input', () => setMinutes(Number.parseInt($('#minutes').value, 10) || null));

function showTab(which) {
  const timer = which === 'timer';
  $('#tabType').setAttribute('aria-selected', String(!timer));
  $('#tabTimer').setAttribute('aria-selected', String(timer));
  $('#panelType').classList.toggle('hidden', timer);
  $('#panelTimer').classList.toggle('hidden', !timer);
}
$('#tabType').addEventListener('click', () => showTab('type'));
$('#tabTimer').addEventListener('click', () => showTab('timer'));

function openLog() {
  $('#logMessage').textContent = '';
  showTab(readTimer() ? 'timer' : 'type');
  logDialog.showModal();
  if (!$('#bookTitle').value) $('#bookTitle').focus();
}
$('#logBtn').addEventListener('click', openLog);
logDialog.querySelector('[data-close]').addEventListener('click', () => logDialog.close());

$('#panelType').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = $('#bookTitle').value.trim();
  const minutes = Number.parseInt($('#minutes').value, 10);
  if (!title) { showMessage(t('needTitle')); $('#bookTitle').focus(); return; }
  if (!minutes) { showMessage(t('err_invalid_minutes', { n: dash?.settings.max_session_minutes ?? 120 })); return; }
  const source = $('#panelType').dataset.source ?? 'manual';
  let saved = false;
  await act(async () => {
    await rpc('log_reading', { p_minutes: minutes, p_title: title, p_source: source });
    saved = true;
    delete $('#panelType').dataset.source;
    $('#bookTitle').value = '';
    setMinutes(null);
    logDialog.close();
  });
  if (!saved) return;
  // The newest entry is the one just added: offer to undo it straight away.
  const entry = dash.recent[0];
  const undo = entry && entry.title === title.replace(/\s+/g, ' ') && entry.minutes === minutes
    ? el('button', { class: 'btn btn-small', type: 'button', onclick: () => removeEntry(entry, false) }, t('undo'))
    : null;
  showMessage(t('logged', { n: minutes, title }), true, undo);
});

/* ========= Timer (keeps running if the page is closed) ========= */

const TIMER_KEY = 'timer';
let tick = null;

function readTimer() {
  try { return JSON.parse(localStorage.getItem(TIMER_KEY)); } catch { return null; }
}
function writeTimer(value) {
  try { value ? localStorage.setItem(TIMER_KEY, JSON.stringify(value)) : localStorage.removeItem(TIMER_KEY); } catch { /* ignore */ }
}
const clock = (ms) => {
  const secs = Math.floor(ms / 1000);
  return `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
};

function startTicking() {
  const timer = readTimer();
  if (!timer) return;
  $('#timerBtn').dataset.i18n = 'stopAndLog';
  $('#timerBtn').textContent = t('stopAndLog');
  $('#timerBtn').classList.add('running');
  $('#bookTitle').value ||= timer.title;
  const update = () => {
    const elapsed = Date.now() - timer.start;
    $('#timerDisplay').textContent = clock(elapsed);
    $('#logBtn').replaceChildren('⏱ ', el('span', { class: 'timer-live' }, t('timerRunningBtn', { time: clock(elapsed) })));
    if (dash && elapsed / 60000 >= dash.settings.max_session_minutes) stopTimer(true);
  };
  update();
  clearInterval(tick);
  tick = setInterval(update, 1000);
}

function stopTimer(capped = false) {
  const timer = readTimer();
  clearInterval(tick);
  tick = null;
  writeTimer(null);
  $('#timerBtn').dataset.i18n = 'startTimer';
  $('#timerBtn').textContent = t('startTimer');
  $('#timerBtn').classList.remove('running');
  $('#timerDisplay').textContent = '00:00';
  $('#logBtn').replaceChildren('📖 ', el('span', { 'data-i18n': 'logMyReading' }, t('logMyReading')));
  if (!timer) return;

  const max = dash?.settings.max_session_minutes ?? 120;
  const minutes = Math.min(Math.floor((Date.now() - timer.start) / 60000), max);
  if (!logDialog.open) logDialog.showModal();
  if (minutes < 1) { showTab('timer'); showMessage(t('tooShort')); return; }
  $('#bookTitle').value ||= timer.title;
  setMinutes(minutes);
  $('#panelType').dataset.source = 'timer';
  showTab('type');
  showMessage(capped ? t('timerCapped', { n: max }) : t('timerStopped', { n: minutes }), true);
}

$('#timerBtn').addEventListener('click', () => {
  if (readTimer()) return stopTimer();
  const title = $('#bookTitle').value.trim();
  if (!title) { showMessage(t('needTitle')); $('#bookTitle').focus(); return; }
  showMessage('');
  writeTimer({ start: Date.now(), title });
  startTicking();
});

/* ========= Book title suggestions ========= */

const titleInput = $('#bookTitle');
const suggestions = $('#suggestions');
let debounce;
let lastQuery = '';

function hideSuggestions() {
  suggestions.classList.add('hidden');
  titleInput.setAttribute('aria-expanded', 'false');
}

titleInput.addEventListener('input', () => {
  clearTimeout(debounce);
  const query = titleInput.value.trim();
  if (query.length < 2) return hideSuggestions();
  debounce = setTimeout(async () => {
    lastQuery = query;
    let titles = [];
    try { titles = await rpc('book_suggestions', { p_query: query }); } catch { /* ignore */ }
    if (query !== lastQuery || !titles?.length) return hideSuggestions();
    suggestions.replaceChildren(...titles.map((title) =>
      el('li', { role: 'option', tabindex: '-1', onmousedown: (e) => { e.preventDefault(); titleInput.value = title; hideSuggestions(); } }, title)));
    suggestions.classList.remove('hidden');
    titleInput.setAttribute('aria-expanded', 'true');
  }, 250);
});
titleInput.addEventListener('blur', hideSuggestions);
titleInput.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !suggestions.classList.contains('hidden')) { e.preventDefault(); hideSuggestions(); } });

/* ========= Display name ========= */

// The name can't be skipped: Esc is ignored, and if the browser closes the
// dialog anyway it comes straight back.
$('#nameDialog').addEventListener('cancel', (e) => e.preventDefault());
$('#nameDialog').addEventListener('close', () => { if (!dash?.me.display_name) setTimeout(askForName, 0); });

// Fun, safe names so kids don't reach for their real one.
const NAME_WORDS = [
  ['Sunny', 'Brave', 'Speedy', 'Sandy', 'Clever', 'Happy', 'Bouncy', 'Cosmic', 'Lucky', 'Mighty', 'Salty', 'Sparkly'],
  ['Kiwi', 'Tūī', 'Weka', 'Kea', 'Pūkeko', 'Tuatara', 'Gecko', 'Orca', 'Fantail', 'Penguin', 'Dolphin', 'Kākāpō'],
];
const pick = (list) => list[Math.floor(Math.random() * list.length)];
$('#nameIdea').addEventListener('click', () => {
  $('#nameInput').value = `${pick(NAME_WORDS[0])} ${pick(NAME_WORDS[1])} ${10 + Math.floor(Math.random() * 90)}`;
  $('#nameMessage').textContent = '';
  $('#nameInput').focus();
});

function askForName() {
  const dialog = $('#nameDialog');
  if (dialog.open) return;
  dialog.showModal();
  $('#nameInput').focus();
}

$('#nameForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('#nameMessage');
  msg.textContent = '';
  try {
    const name = await rpc('set_display_name', { p_name: $('#nameInput').value });
    if (dash) dash.me.display_name = name;  // before close, so it doesn't pop back up
    $('#nameDialog').close();
    await load();
  } catch (err) {
    msg.textContent = errorText(err);
  }
});

/* ========= Confetti ========= */

function launchConfetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const canvas = $('#confetti');
  const ctx = canvas.getContext('2d');
  canvas.width = innerWidth;
  canvas.height = innerHeight;
  const colours = ['#d93a2b', '#ffc23a', '#35b7b0', '#5f9230', '#ffffff'];
  const bits = Array.from({ length: 160 }, () => ({
    x: Math.random() * canvas.width, y: canvas.height,
    r: Math.random() * 5 + 4,
    c: colours[Math.floor(Math.random() * colours.length)],
    vx: Math.random() * 4 - 2, vy: -(Math.random() * 6 + 9),
  }));
  (function frame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const b of bits) {
      b.x += b.vx; b.y += b.vy; b.vy += 0.2;
      ctx.fillStyle = b.c;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
    }
    if (bits.some((b) => b.y < canvas.height + 10)) requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  })();
}

/* ========= Delete account ========= */

$('#deleteAccountBtn').addEventListener('click', () => {
  const name = dash?.me.display_name ?? '';
  $('#deleteConfirmLabel').textContent = name ? t('deleteConfirmLabel', { name }) : '';
  $('#deleteConfirm').closest('label').classList.toggle('hidden', !name);
  $('#deleteConfirm').value = '';
  $('#deleteMessage').textContent = '';
  $('#deleteDialog').showModal();
});
$('#deleteCancel').addEventListener('click', () => $('#deleteDialog').close());
$('#deleteForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = dash?.me.display_name;
  if (name && $('#deleteConfirm').value.trim().toLowerCase() !== name.toLowerCase()) {
    $('#deleteMessage').textContent = t('deleteMismatch');
    return;
  }
  try {
    await rpc('delete_my_account');
  } catch (err) {
    $('#deleteMessage').textContent = errorText(err);
    return;
  }
  writeTimer(null);
  await supabase.auth.signOut({ scope: 'local' });
  location.replace('index.html?deleted');
});

/* ========= Header controls ========= */

$('#langToggle').addEventListener('click', () => {
  setLang(lang === 'en' ? 'mi' : 'en');
  drawScene();
  load();
});

async function signOut(to = 'index.html') {
  writeTimer(null);
  try { await rpc('release_session'); } catch { /* already gone */ }
  await supabase.auth.signOut({ scope: 'local' });
  location.replace(to);
}
$('#signOutBtn').addEventListener('click', () => signOut());

// Library computers (signed in by typing a code): sign out after 15 quiet minutes,
// unless a reading timer is running.
let sharedDevice = false;
try { sharedDevice = localStorage.getItem('sharedDevice') === '1'; } catch { /* ignore */ }
if (sharedDevice) {
  let lastActive = Date.now();
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((ev) => addEventListener(ev, () => { lastActive = Date.now(); }, { passive: true }));
  setInterval(() => {
    if (Date.now() - lastActive > 15 * 60 * 1000 && !readTimer()) signOut('index.html?timeout');
  }, 30 * 1000);
}

// Refresh shared numbers when the kid comes back to the tab.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !busy && !logDialog.open) load();
});

applyStatic();
drawScene();
await load();
startTicking();

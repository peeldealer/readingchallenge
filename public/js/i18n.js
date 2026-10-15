// English strings, plus the te reo Māori strings from the original app.
// Any key missing from `mi` falls back to English. New te reo strings should
// be written or checked by a fluent speaker before going live.
const en = {
  appTitle: 'Summer Reading Challenge',
  yourMinutes: 'My minutes',
  logMyReading: 'Log my reading',
  whatBook: 'What are you reading?',
  typeIt: 'Type it in',
  useTimer: 'Use the timer',
  howMany: 'How many minutes?',
  otherAmount: 'Or type the minutes',
  timerHint: 'Start the timer when you start reading. You can close this box, it keeps counting.',
  timerStopped: 'Timer stopped at {n} minutes. Check the book title, then press Save.',
  timerRunningBtn: 'Reading… {time}',
  stopAndLog: 'Stop and log it',
  noReaders: 'Nobody’s logged any reading yet. You could be first!',
  bingoHint: 'Done one? Tap it for bonus minutes. Finish a row, column or diagonal for extra!',
  shelfHint: 'Tap the stars to rate a book.',
  communityLine: 'Together we’ve read {minutes} minutes!',
  goalPct: '{pct}% of the way',
  goalOf: 'Goal: {goal}',
  startLabel: 'Start',
  endLabel: 'Goal: {goal} mins',
  goalLabel: 'Goal',
  privacyLink: 'Your privacy',
  recentReading: 'My recent reading',
  noRecent: 'Nothing logged yet. Tap “Log my reading” to start.',
  remove: 'Remove',
  undo: 'Undo',
  removeConfirm: 'Remove {n} minutes of “{title}”?',
  removed: 'Removed {n} minutes of “{title}”.',
  timerEntry: 'timer',
  bonusEntry: 'Bonus: {reason}',
  bingoLineEntry: 'Bingo line bonus',
  bingoCardEntry: 'Full bingo card bonus',
  bingoLine: 'BINGO! 🎉 You finished a line: +{n} bonus minutes!',
  bingoLines: 'DOUBLE BINGO! 🎉 {count} lines at once: +{n} bonus minutes!',
  bingoFullCard: 'FULL CARD! 🏆 You did every square: +{n} bonus minutes. Legend!',
  deleteAccount: 'Delete my account',
  deleteTitle: 'Delete your account?',
  deleteBody: 'Your name comes off the leaderboard straight away and your tag stops working. After 14 days your name, reading, bookshelf, bingo and bonus minutes are erased for good. Changed your mind? Ask at a library desk within 14 days.',
  deleteConfirmLabel: 'Type your display name ({name}) to confirm',
  deleteForever: 'Delete my account',
  deleteMismatch: 'That doesn’t match your display name.',
  accountDeleted: 'Your account has been deleted and will be erased for good in 14 days. Thanks for reading with us!',
  idleSignedOut: 'You were signed out because nobody used this computer for a while. Scan your tag to carry on.',
  err_cannot_undo: 'That entry can’t be removed any more. Ask at the library desk if it’s wrong.',
  prizeTitle: 'You won: {prize}!',
  prizeBody: 'Bring your reading tag to a library desk to collect it.',
  prizeCollectBy: 'Collect it by {date}.',
  prizeOverdue: 'The collect-by date has passed. Ask at the library desk.',
  prizeOk: 'Yay!',
  subtitle: 'Welcome to the Summer Reading Challenge.',
  hello: 'Kia ora',
  daysStreak: 'Day streak',
  totalMinutes: 'Total minutes logged',
  yourRank: 'My rank',
  logTime: 'Log time',
  maxSession: 'Up to {n} minutes at a time.',
  bookTitlePlaceholder: 'Book title…',
  minsPlaceholder: 'Mins',
  saveSession: 'Save',
  orTimer: 'Or time your reading',
  startTimer: 'Start timer',
  stopTimer: 'Stop timer',
  communityGoal: "Let's read our way to {goal} minutes together!",
  ofGoal: 'of goal',
  bingo: 'Summer bingo',
  topReaders: 'Top readers',
  myBookshelf: 'My bookshelf',
  shelfEmpty: 'Books you log show up here, and you can rate them.',
  communityFavs: 'Community favourites',
  noRatings: 'No rated books yet.',
  news: 'News',
  noNews: 'No news yet.',
  newsFlash: 'New from the library',
  gotIt: 'Got it',
  you: 'you',
  min: 'min', mins: 'mins', hour: 'hour', hours: 'hours', day: 'day', days: 'days',
  logged: 'Ka pai! {n} minutes of “{title}” added.',
  confirmTimer: 'Log {n} minutes for “{title}”?',
  tooShort: 'That was under a minute. Keep reading and try again!',
  timerCapped: 'Timer stopped at the {n} minute limit.',
  needTitle: 'Please enter a book title first.',
  bonus: 'Bonus: +{n} minutes',
  iDidIt: 'I did it! ✅',
  unmark: 'Unmark ↩️',
  completed: 'Completed!',
  cancel: 'Cancel',
  confirm: 'Yes, log it',
  signOut: 'Sign out',
  rateBook: 'Rate {title}: {n} stars',
  closed: 'The challenge is not open right now — you can still look around.',
  // name picker
  welcomeTitle: 'Welcome! 👋',
  pickName: 'Choose a display name for the leaderboard.',
  noRealNames: 'Please don’t use your real name. 3–20 letters or numbers. You can’t change it later.',
  nameIdea: '🎲 Pick one for me',
  namePlaceholder: 'e.g. BookWorm99',
  startReading: 'Start reading 🚀',
  // login
  loginTitle: 'Scan your tag to start',
  loginHelp: 'Point your camera at the QR code on your reading tag, or type the code printed under it.',
  codePlaceholder: 'Type the code from your tag',
  signIn: 'Sign in',
  signingIn: 'Signing in…',
  // server error codes
  err_invalid_code: 'That code didn’t work. Check it and try again, or ask at the library desk.',
  err_too_many_attempts: 'Too many tries. Please wait 15 minutes or ask at the library desk.',
  err_not_signed_in: 'You’ve been signed out. Please scan your tag again.',
  err_invalid_name: 'Use 3–20 letters, numbers, spaces, dots, dashes or underscores.',
  err_name_not_allowed: 'Please choose a different name.',
  err_name_taken: 'That name is taken — try another.',
  err_name_already_set: 'You already have a name.',
  err_name_required: 'Please choose a display name first.',
  err_invalid_minutes: 'Enter between 1 and {n} minutes.',
  err_invalid_title: 'Please enter a book title (up to 200 characters).',
  err_title_not_allowed: 'Please check that book title.',
  err_daily_limit: 'That’s a lot of reading for one day! You’ve hit today’s limit.',
  err_challenge_closed: 'The challenge is not open right now.',
  err_generic: 'Something went wrong. Please try again.',
};

const mi = {
  appTitle: 'Wero Pānui Pukapuka',
  subtitle: 'Nau mai ki te Wero Pānui Pukapuka o te Raumati.',
  hello: 'Kia ora',
  totalMinutes: 'Tapeke Meneti Kua Tuhia',
  logTime: 'Tuhia te Wā',
  saveSession: 'Tiaki',
  startTimer: 'Tīmata',
  stopTimer: 'Whakamutu',
  topReaders: 'Kaipānui Toa',
  myBookshelf: 'Taku Whata Pukapuka',
  communityFavs: 'Ngā Pukapuka Pai',
  bookTitlePlaceholder: 'Taitara Pukapuka…',
  minsPlaceholder: 'Meneti',
  ofGoal: 'o te Whāinga',
  min: 'meneti', mins: 'meneti', hour: 'hāora', hours: 'hāora', day: 'rā', days: 'rā',
  needTitle: 'Tuhia te taitara pukapuka.',
};

const dictionaries = { en, mi };

function storedLang() {
  try { return localStorage.getItem('lang') === 'mi' ? 'mi' : 'en'; } catch { return 'en'; }
}

export let lang = storedLang();

export function setLang(next) {
  lang = next === 'mi' ? 'mi' : 'en';
  try { localStorage.setItem('lang', lang); } catch { /* private mode */ }
  document.documentElement.lang = lang;
  applyStatic();
}

export function t(key, vars = {}) {
  const text = dictionaries[lang][key] ?? en[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? '');
}

export function errorText(err, vars) {
  const code = String(err?.message ?? err);
  return en[`err_${code}`] ? t(`err_${code}`, vars) : t('err_generic');
}

// Elements with data-i18n / data-i18n-placeholder / data-i18n-aria get static text.
export function applyStatic(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((n) => { n.textContent = t(n.dataset.i18n); });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((n) => { n.placeholder = t(n.dataset.i18nPlaceholder); });
  root.querySelectorAll('[data-lang-opt]').forEach((n) => n.classList.toggle('active', n.dataset.langOpt === lang));
}

export function formatDuration(total) {
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const minutes = total % 60;
  const parts = [];
  if (days) parts.push(`${days} ${t(days === 1 ? 'day' : 'days')}`);
  if (hours) parts.push(`${hours} ${t(hours === 1 ? 'hour' : 'hours')}`);
  if (minutes || !parts.length) parts.push(`${minutes} ${t(minutes === 1 ? 'min' : 'mins')}`);
  return parts.join(', ');
}

document.documentElement.lang = lang;

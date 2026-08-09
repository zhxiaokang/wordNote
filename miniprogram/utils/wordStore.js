// wordStore.js — local-first data layer for words + daily review status.
// All persistence goes through wx.setStorageSync/getStorageSync. Cloud sync (utils/cloudSync.js)
// hooks in via setChangeListener() so this module stays decoupled from network/login concerns.
const { today, addDays, getWeekRange, getMonthKey, getMonthLabel, getYearKey, getYearLabel } = require('./date.js');
const { advanceSchedule, REVIEW_INTERVALS } = require('./review.js');

const WORDS_KEY = 'words';
const DAILY_STATUS_KEY = 'dailyStatus';
const LAST_OPEN_DATE_KEY = 'lastOpenDate';

let changeListener = null;
function setChangeListener(fn) {
  changeListener = fn;
}
function notifyChange(kind, payload) {
  if (changeListener) {
    try {
      changeListener(kind, payload);
    } catch (e) {
      // sync listener failures must never break local data flow
    }
  }
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function readWords() {
  return wx.getStorageSync(WORDS_KEY) || [];
}
function writeWords(words) {
  wx.setStorageSync(WORDS_KEY, words);
}
function readDailyStatus() {
  return wx.getStorageSync(DAILY_STATUS_KEY) || {};
}
function writeDailyStatus(map) {
  wx.setStorageSync(DAILY_STATUS_KEY, map);
}

function getWords() {
  return readWords()
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt);
}

function getWordById(id) {
  return readWords().find((w) => w.id === id) || null;
}

function saveWord(word) {
  const words = readWords();
  const idx = words.findIndex((w) => w.id === word.id);
  if (idx >= 0) words[idx] = word;
  else words.push(word);
  writeWords(words);
  notifyChange('word', word);
}

function upsertHistory(word, action) {
  const date = today();
  const entry = word.history.find((h) => h.date === date);
  if (entry) entry.action = action;
  else word.history.push({ date, action });
}

function addWord({ word, meanings, notes }) {
  const date = today();
  const w = {
    id: generateId(),
    word: word.trim(),
    meanings: meanings.map((m) => ({ pos: m.pos, def: m.def })),
    notes: notes || '',
    createdAt: Date.now(),
    createdDate: date,
    stage: 0,
    nextReviewDate: addDays(date, REVIEW_INTERVALS[0]),
    history: [{ date, action: 'added' }],
    updatedAt: Date.now(),
  };
  saveWord(w);
  return w;
}

function getDueWords(dateStr) {
  return readWords()
    .filter((w) => w.nextReviewDate <= dateStr)
    .sort((a, b) => (a.nextReviewDate < b.nextReviewDate ? -1 : a.nextReviewDate > b.nextReviewDate ? 1 : a.createdAt - b.createdAt));
}

// Runs once per app launch: fills in dailyStatus for any days between the last recorded
// open date and today that have no snapshot, so the check-in calendar has no unexplained gaps.
// Approximation: due-count for a backfilled day uses each word's *current* nextReviewDate,
// so a word resolved between that day and today under-counts as not-due-back-then.
function backfillGapDays() {
  const lastOpen = wx.getStorageSync(LAST_OPEN_DATE_KEY);
  const t = today();
  if (lastOpen && lastOpen < t) {
    const map = readDailyStatus();
    const words = readWords();
    let d = addDays(lastOpen, 1);
    while (d < t) {
      if (!map[d]) {
        const dueCount = words.filter((w) => w.nextReviewDate <= d).length;
        map[d] = { date: d, dueCount, doneCount: 0, finished: true, updatedAt: Date.now() };
      }
      d = addDays(d, 1);
    }
    writeDailyStatus(map);
  }
  wx.setStorageSync(LAST_OPEN_DATE_KEY, t);
}

function getOrCreateTodaySession() {
  const t = today();
  const map = readDailyStatus();
  let entry = map[t];
  if (!entry || !entry.order) {
    const due = getDueWords(t);
    entry = {
      date: t,
      dueCount: due.length,
      doneCount: 0,
      order: due.map((w) => w.id),
      queue: due.map((w) => w.id),
      mistakes: [],
      finished: due.length === 0,
      updatedAt: Date.now(),
    };
    map[t] = entry;
    writeDailyStatus(map);
    notifyChange('dailyStatus', entry);
  }
  return entry;
}

function saveSession(entry) {
  entry.updatedAt = Date.now();
  const map = readDailyStatus();
  map[entry.date] = entry;
  writeDailyStatus(map);
  notifyChange('dailyStatus', entry);
}

function getCurrentSessionWord(session) {
  if (!session.queue.length) return null;
  return getWordById(session.queue[0]);
}

function resolveCorrect(session, wordId) {
  const word = getWordById(wordId);
  const { stage, nextReviewDate } = advanceSchedule(word.stage, true, today());
  word.stage = stage;
  word.nextReviewDate = nextReviewDate;
  word.updatedAt = Date.now();
  upsertHistory(word, 'correct');
  saveWord(word);

  session.queue.shift();
  session.doneCount += 1;
  if (session.queue.length === 0) session.finished = true;
  saveSession(session);
  return session;
}

function resolveIncorrect(session, wordId) {
  const word = getWordById(wordId);
  const { stage, nextReviewDate } = advanceSchedule(word.stage, false, today());
  word.stage = stage;
  word.nextReviewDate = nextReviewDate;
  word.updatedAt = Date.now();
  upsertHistory(word, 'incorrect');
  saveWord(word);

  session.queue.shift();
  session.queue.push(wordId);
  if (session.mistakes.indexOf(wordId) === -1) session.mistakes.push(wordId);
  saveSession(session);
  return session;
}

function computeSessionStats(session) {
  const total = session.order.length;
  const needsStrength = session.mistakes.length;
  const mastered = total - needsStrength;
  return { total, mastered, needsStrength };
}

// Emoji/marker for the check-in calendar. Returns null for future dates or days with no review task.
function computeCalendarStatus(dateStr) {
  const t = today();
  if (dateStr > t) return null;
  const map = readDailyStatus();
  const entry = map[dateStr];
  if (dateStr === t) {
    const session = entry && entry.order ? entry : getOrCreateTodaySession();
    if (!session.finished) return { pending: true };
    if (session.dueCount === 0) return null;
    return session.doneCount >= session.dueCount ? { emoji: '😊' } : { emoji: '😐' };
  }
  if (!entry) {
    const dueCount = readWords().filter((w) => w.nextReviewDate <= dateStr).length;
    return dueCount === 0 ? null : { emoji: '😢' };
  }
  if (entry.dueCount === 0) return null;
  if (entry.doneCount === 0) return { emoji: '😢' };
  if (entry.doneCount < entry.dueCount) return { emoji: '😐' };
  return { emoji: '😊' };
}

// Vocabulary tab grouping. mode: 'week' | 'month' | 'year'.
function getGroupedVocab(mode) {
  const words = getWords(); // newest first
  const groups = [];
  const indexByKey = {};
  words.forEach((w) => {
    let key, label;
    if (mode === 'week') {
      const range = getWeekRange(w.createdDate);
      key = range.key;
      label = range.label;
    } else if (mode === 'month') {
      key = getMonthKey(w.createdDate);
      label = getMonthLabel(w.createdDate);
    } else {
      key = getYearKey(w.createdDate);
      label = getYearLabel(w.createdDate);
    }
    if (!(key in indexByKey)) {
      indexByKey[key] = groups.length;
      groups.push({ key, label, words: [] });
    }
    groups[indexByKey[key]].words.push(w);
  });
  // groups is already in newest-first order because `words` is newest-first and each
  // group is created on first encounter of its key.
  return groups;
}

function getDailyStatusList() {
  const map = readDailyStatus();
  return Object.keys(map).map((k) => map[k]);
}

// Merge word/dailyStatus docs pulled from the cloud into local storage, last-write-wins by
// updatedAt. Used on login (full pull) and on each app-launch incremental sync.
function mergeRemote({ words, dailyStatus }) {
  if (words && words.length) {
    const local = readWords();
    const byId = {};
    local.forEach((w) => (byId[w.id] = w));
    words.forEach((remote) => {
      const existing = byId[remote.id];
      if (!existing || remote.updatedAt > existing.updatedAt) byId[remote.id] = remote;
    });
    writeWords(Object.keys(byId).map((id) => byId[id]));
  }
  if (dailyStatus && dailyStatus.length) {
    const map = readDailyStatus();
    dailyStatus.forEach((remote) => {
      const existing = map[remote.date];
      if (!existing || remote.updatedAt > existing.updatedAt) map[remote.date] = remote;
    });
    writeDailyStatus(map);
  }
}

module.exports = {
  setChangeListener,
  generateId,
  getWords,
  getWordById,
  saveWord,
  addWord,
  getDueWords,
  backfillGapDays,
  getOrCreateTodaySession,
  saveSession,
  getCurrentSessionWord,
  resolveCorrect,
  resolveIncorrect,
  computeSessionStats,
  computeCalendarStatus,
  getGroupedVocab,
  getDailyStatusList,
  mergeRemote,
};

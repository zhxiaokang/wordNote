// cloudSync.js — optional account-based cloud sync, gated entirely behind login.
// Local storage (utils/wordStore.js) is always the source of truth for offline use; this module
// mirrors mutations to the `wordApi` cloud function when logged in, and swallows all network
// failures per design.md ("失败无需报错，等到后面用户再使用小程序的时候再尝试就可以了") — retries
// happen opportunistically on the next app launch / mutation, there is no persistent retry queue.
const wordStore = require('./wordStore.js');

const AUTH_KEY = 'auth';
const LAST_SYNC_KEY = 'lastSyncAt';

function getAuth() {
  return wx.getStorageSync(AUTH_KEY) || { loggedIn: false };
}
function setAuth(auth) {
  wx.setStorageSync(AUTH_KEY, auth);
}
function isLoggedIn() {
  return !!getAuth().loggedIn;
}
function getLastSyncAt() {
  return wx.getStorageSync(LAST_SYNC_KEY) || 0;
}
function setLastSyncAt(ts) {
  wx.setStorageSync(LAST_SYNC_KEY, ts);
}

function callCloud(type, data) {
  return wx.cloud
    .callFunction({ name: 'wordApi', data: Object.assign({ type }, data) })
    .then((res) => res.result);
}

// Registered once from app.js. Fires a best-effort push for whatever just changed locally;
// failures are swallowed here so a flaky network never surfaces as an error to the user.
function onLocalChange(kind, payload) {
  if (!isLoggedIn() || !wx.cloud) return;
  const words = kind === 'word' ? [payload] : [];
  const dailyStatus = kind === 'dailyStatus' ? [payload] : [];
  callCloud('syncPush', { words, dailyStatus }).catch(() => {});
}

function init() {
  wordStore.setChangeListener(onLocalChange);
  if (isLoggedIn() && wx.cloud) {
    syncNow().catch(() => {});
  }
}

// Pulls anything changed remotely since the last sync, merges it in, then pushes anything
// changed locally since the last sync (covers pushes that failed earlier while offline).
function syncNow() {
  const since = getLastSyncAt();
  const startedAt = Date.now();
  return callCloud('syncPull', { sinceTs: since })
    .then((result) => {
      wordStore.mergeRemote({ words: result.words || [], dailyStatus: result.dailyStatus || [] });
      const words = wordStore.getWords().filter((w) => w.updatedAt > since);
      const dailyStatus = wordStore.getDailyStatusList().filter((d) => d.updatedAt > since);
      if (words.length || dailyStatus.length) {
        return callCloud('syncPush', { words, dailyStatus });
      }
    })
    .then(() => {
      setLastSyncAt(startedAt);
    });
}

function login() {
  if (!wx.cloud) return Promise.reject(new Error('cloud not initialized'));
  return wx.getUserProfile({ desc: '用于账号登录与数据同步' }).then((profileRes) => {
    const { nickName, avatarUrl } = profileRes.userInfo;
    return callCloud('login', { nickName, avatarUrl }).then((res) => {
      const auth = { loggedIn: true, openid: res.openid, nickName, avatarUrl };
      setAuth(auth);
      setLastSyncAt(0); // force a full pull on first login so a new device gets full history
      return syncNow().then(() => auth);
    });
  });
}

function logout() {
  setAuth({ loggedIn: false });
}

function submitFeedback(message) {
  return callCloud('submitFeedback', { message });
}

function getFeedback() {
  return callCloud('getFeedback', {});
}

module.exports = {
  init,
  isLoggedIn,
  getAuth,
  login,
  logout,
  syncNow,
  submitFeedback,
  getFeedback,
};

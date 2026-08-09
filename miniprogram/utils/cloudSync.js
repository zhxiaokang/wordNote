// cloudSync.js — thin wrapper around the `wordApi` cloud function for user feedback only.
// Words/dailyStatus are local-only (wx.setStorageSync, see wordStore.js); there is no account
// login or cloud sync of word data. The cloud function relies on cloud.getWXContext().OPENID,
// which WeChat attaches automatically to every callFunction call, so no login step is needed.
function callCloud(type, data) {
  return wx.cloud
    .callFunction({ name: 'wordApi', data: Object.assign({ type }, data) })
    .then((res) => res.result);
}

function submitFeedback(message) {
  return callCloud('submitFeedback', { message });
}

function getFeedback() {
  return callCloud('getFeedback', {});
}

module.exports = {
  submitFeedback,
  getFeedback,
};

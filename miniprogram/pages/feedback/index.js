const cloudSync = require('../../utils/cloudSync.js');

function formatTs(ts) {
  const d = new Date(ts);
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  return (
    d.getFullYear() + '/' + pad(d.getMonth() + 1) + '/' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
  );
}

Page({
  data: {
    list: [],
    draft: '',
    loading: true,
  },

  onLoad() {
    this.loadFeedback();
  },

  loadFeedback() {
    this.setData({ loading: true });
    cloudSync
      .getFeedback()
      .then((res) => {
        const list = (res.list || []).map((item) => ({
          ...item,
          createdAtLabel: formatTs(item.createdAt),
          repliedAtLabel: item.repliedAt ? formatTs(item.repliedAt) : '',
        }));
        this.setData({ list, loading: false });
      })
      .catch(() => {
        this.setData({ loading: false });
        wx.showToast({ title: '加载失败，请稍后重试', icon: 'none' });
      });
  },

  onDraftInput(e) {
    this.setData({ draft: e.detail.value });
  },

  onSubmit() {
    const message = this.data.draft.trim();
    if (!message) return;
    wx.showLoading({ title: '提交中' });
    cloudSync
      .submitFeedback(message)
      .then(() => {
        wx.hideLoading();
        this.setData({ draft: '' });
        this.loadFeedback();
      })
      .catch(() => {
        wx.hideLoading();
        wx.showToast({ title: '提交失败，请稍后重试', icon: 'none' });
      });
  },
});

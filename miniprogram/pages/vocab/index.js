const wordStore = require('../../utils/wordStore.js');

Page({
  data: {
    mode: 'week',
    groups: [],
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setActive('/pages/vocab/index');
    }
    this.loadGroups();
  },

  // handleWebviewPreload: "manual" in index.json — trigger the next tab's webview warm-up
  // as soon as this page has rendered, instead of waiting on the default fixed 200ms delay.
  onReady() {
    if (typeof wx.preloadWebview === 'function') wx.preloadWebview();
  },

  loadGroups() {
    const groups = wordStore.getGroupedVocab(this.data.mode).map((g, i) => ({ ...g, expanded: i === 0 }));
    this.setData({ groups });
  },

  onSwitchMode(e) {
    const { mode } = e.currentTarget.dataset;
    if (mode === this.data.mode) return;
    this.setData({ mode }, () => this.loadGroups());
  },

  onToggleGroup(e) {
    const { index } = e.currentTarget.dataset;
    const groups = this.data.groups;
    groups[index].expanded = !groups[index].expanded;
    this.setData({ groups });
  },

  onTapWord(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: '/pages/vocab-detail/index?id=' + id });
  },
});

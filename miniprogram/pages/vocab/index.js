const wordStore = require('../../utils/wordStore.js');

Page({
  data: {
    mode: 'week',
    groups: [],
  },

  // Per-mode UI state that must survive tab switches, sub-page navigation, and switching
  // between 周/月/年 and back — kept on the page instance (not `data`) since it's never
  // meant to trigger a render on its own, only to be read back by loadGroups()/onPageScroll.
  expandedByMode: { week: {}, month: {}, year: {} },
  scrollTopByMode: { week: 0, month: 0, year: 0 },

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

  onPageScroll(e) {
    this.scrollTopByMode[this.data.mode] = e.scrollTop;
  },

  // Re-reads word data fresh each time (so edits made on vocab-detail show up), but expanded
  // state is keyed by group.key and only defaulted (index 0 = expanded) the first time a key
  // is ever seen — an already-seen key keeps whatever the user last set it to.
  loadGroups() {
    const mode = this.data.mode;
    const expandedMap = this.expandedByMode[mode];
    const groups = wordStore.getGroupedVocab(mode).map((g, i) => {
      if (!(g.key in expandedMap)) {
        expandedMap[g.key] = i === 0;
      }
      return Object.assign({}, g, { expanded: expandedMap[g.key] });
    });
    this.setData({ groups }, () => {
      wx.pageScrollTo({ scrollTop: this.scrollTopByMode[mode], duration: 0 });
    });
  },

  onSwitchMode(e) {
    const { mode } = e.currentTarget.dataset;
    if (mode === this.data.mode) return;
    this.setData({ mode }, () => this.loadGroups());
  },

  onToggleGroup(e) {
    const { index } = e.currentTarget.dataset;
    const groups = this.data.groups;
    const group = groups[index];
    group.expanded = !group.expanded;
    this.expandedByMode[this.data.mode][group.key] = group.expanded;
    this.setData({ groups });
  },

  onTapWord(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: '/pages/vocab-detail/index?id=' + id });
  },
});

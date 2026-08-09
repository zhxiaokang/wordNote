Component({
  data: {
    active: 0,
    list: [
      { pagePath: '/pages/review/index', text: '复习', icon: '↺' },
      { pagePath: '/pages/newword/index', text: '新词', icon: '＋' },
      { pagePath: '/pages/vocab/index', text: '词汇', icon: '≡' },
      { pagePath: '/pages/mine/index', text: '我的', icon: '👤' },
    ],
  },
  methods: {
    setActive(path) {
      const index = this.data.list.findIndex((item) => path.indexOf(item.pagePath) === 0);
      if (index >= 0) this.setData({ active: index });
    },
    onTap(e) {
      const { index } = e.currentTarget.dataset;
      const item = this.data.list[index];
      if (index === this.data.active) return;
      wx.switchTab({ url: item.pagePath });
    },
  },
});

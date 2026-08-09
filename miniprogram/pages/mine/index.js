const wordStore = require('../../utils/wordStore.js');
const cloudSync = require('../../utils/cloudSync.js');
const dateUtil = require('../../utils/date.js');

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

Page({
  data: {
    auth: { loggedIn: false },
    showLoginModal: false,
    monthLabel: '',
    weekdayLabels: WEEKDAY_LABELS,
    weeks: [],
    today: '',
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setActive('/pages/mine/index');
    }
    this.setData({ auth: cloudSync.getAuth() });
    this.loadCalendar();
  },

  // handleWebviewPreload: "manual" in index.json — trigger the next tab's webview warm-up
  // as soon as this page has rendered, instead of waiting on the default fixed 200ms delay.
  onReady() {
    if (typeof wx.preloadWebview === 'function') wx.preloadWebview();
  },

  loadCalendar() {
    const t = dateUtil.today();
    const [year, month] = t.split('-').map(Number);
    const matrix = dateUtil.getMonthMatrix(year, month);
    const weeks = matrix.map((week) =>
      week.map((dateStr) => {
        if (!dateStr) return null;
        const status = wordStore.computeCalendarStatus(dateStr);
        return {
          date: dateStr,
          day: Number(dateStr.split('-')[2]),
          isToday: dateStr === t,
          emoji: status && status.emoji ? status.emoji : '',
          pending: !!(status && status.pending),
        };
      })
    );
    this.setData({
      monthLabel: dateUtil.getYearLabel(t) + (month) + '月',
      weeks,
      today: t,
    });
  },

  onTapLogin() {
    this.setData({ showLoginModal: true });
  },

  onCancelLogin() {
    this.setData({ showLoginModal: false });
  },

  onConfirmLogin() {
    cloudSync
      .login()
      .then((auth) => {
        this.setData({ showLoginModal: false, auth });
        this.loadCalendar();
        wx.showToast({ title: '登录成功', icon: 'success' });
      })
      .catch(() => {
        this.setData({ showLoginModal: false });
        wx.showToast({ title: '登录失败，请重试', icon: 'none' });
      });
  },

  onTapFeedback() {
    if (!this.data.auth.loggedIn) return;
    wx.navigateTo({ url: '/pages/feedback/index' });
  },
});

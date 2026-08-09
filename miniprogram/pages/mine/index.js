const wordStore = require('../../utils/wordStore.js');
const dateUtil = require('../../utils/date.js');

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

Page({
  data: {
    showImportModal: false,
    importDraft: '',
    monthLabel: '',
    weekdayLabels: WEEKDAY_LABELS,
    weeks: [],
    today: '',
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setActive('/pages/mine/index');
    }
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

  onTapFeedback() {
    wx.navigateTo({ url: '/pages/feedback/index' });
  },

  onTapExport() {
    const json = wordStore.exportData();
    wx.setClipboardData({
      data: json,
      success: () => wx.showToast({ title: '已复制到剪贴板，请粘贴保存', icon: 'none' }),
      fail: () => wx.showToast({ title: '导出失败，请重试', icon: 'none' }),
    });
  },

  onTapImport() {
    this.setData({ showImportModal: true, importDraft: '' });
  },

  onCancelImport() {
    this.setData({ showImportModal: false });
  },

  onImportDraftInput(e) {
    this.setData({ importDraft: e.detail.value });
  },

  onConfirmImport() {
    const draft = this.data.importDraft.trim();
    if (!draft) return;
    try {
      wordStore.importData(draft);
    } catch (e) {
      wx.showToast({ title: '导入失败，请检查内容', icon: 'none' });
      return;
    }
    this.setData({ showImportModal: false });
    this.loadCalendar();
    wx.showToast({ title: '导入成功', icon: 'success' });
  },
});

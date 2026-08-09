const wordStore = require('../../utils/wordStore.js');

Page({
  data: {
    ready: false,
    dueCount: 0,
    doneCount: 0,
    progressPercent: 0,
    phase: 'empty', // 'empty' | 'word' | 'feedback' | 'done'
    currentWord: null,
    badgeType: '', // 'know' | 'dontknow' | 'wrong'
    showNext: false,
    stats: null,
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setActive('/pages/review/index');
    }
    this.session = wordStore.getOrCreateTodaySession();
    this.refreshView();
  },

  refreshView() {
    const session = this.session;
    const progressPercent = session.dueCount ? Math.round((session.doneCount / session.dueCount) * 100) : 0;
    if (session.dueCount === 0) {
      this.setData({ ready: true, phase: 'empty', dueCount: 0, doneCount: 0, progressPercent: 0 });
      return;
    }
    if (session.finished) {
      const stats = wordStore.computeSessionStats(session);
      this.setData({
        ready: true,
        phase: 'done',
        dueCount: session.dueCount,
        doneCount: session.doneCount,
        progressPercent: 100,
        stats,
      });
      return;
    }
    const word = wordStore.getCurrentSessionWord(session);
    this.setData({
      ready: true,
      phase: 'word',
      dueCount: session.dueCount,
      doneCount: session.doneCount,
      progressPercent,
      currentWord: word,
      badgeType: '',
      showNext: false,
    });
  },

  onTapKnow() {
    this.setData({ phase: 'feedback', badgeType: 'know', showNext: false });
  },

  onTapDontKnow() {
    this.setData({ phase: 'feedback', badgeType: 'dontknow', showNext: true });
  },

  onTapWrong() {
    this.setData({ badgeType: 'wrong', showNext: true });
  },

  onTapCorrect() {
    this.session = wordStore.resolveCorrect(this.session, this.data.currentWord.id);
    this.refreshView();
  },

  onTapNext() {
    this.session = wordStore.resolveIncorrect(this.session, this.data.currentWord.id);
    this.refreshView();
  },
});

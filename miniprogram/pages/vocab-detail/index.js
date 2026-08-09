const wordStore = require('../../utils/wordStore.js');

const ACTION_LABEL = {
  added: { text: '首次添加', cls: 'action-added' },
  correct: { text: '✓ 记对了', cls: 'action-correct' },
  incorrect: { text: '✗ 记错了', cls: 'action-incorrect' },
};

Page({
  data: {
    word: null,
    createdDateSlash: '',
    history: [],
  },

  onLoad(options) {
    const word = wordStore.getWordById(options.id);
    if (!word) {
      wx.showToast({ title: '单词不存在', icon: 'none' });
      wx.navigateBack();
      return;
    }
    const history = word.history.map((h) => ({
      date: h.date.replace(/-/g, '/'),
      label: (ACTION_LABEL[h.action] || {}).text || h.action,
      cls: (ACTION_LABEL[h.action] || {}).cls || '',
    }));
    this.setData({
      word,
      createdDateSlash: word.createdDate.replace(/-/g, '/'),
      history,
    });
  },
});

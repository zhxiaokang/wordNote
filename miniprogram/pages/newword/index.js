const wordStore = require('../../utils/wordStore.js');

const POS_OPTIONS = ['n.', 'v.', 'adj.', 'adv.', 'prep.', 'conj.', 'pron.', 'interj.'];

function emptyRow() {
  return { pos: '', def: '' };
}

Page({
  data: {
    word: '',
    meaningRows: [emptyRow()],
    notes: '',
    posOptions: POS_OPTIONS,
    openDropdownIndex: -1,
    canSave: false,
    wordFocused: false,
    focusedDefIndex: -1,
    notesFocused: false,
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setActive('/pages/newword/index');
    }
  },

  updateCanSave() {
    const hasWord = this.data.word.trim().length > 0;
    const hasMeaning = this.data.meaningRows.some((r) => r.def.trim());
    this.setData({ canSave: hasWord && hasMeaning });
  },

  onWordInput(e) {
    this.setData({ word: e.detail.value }, () => this.updateCanSave());
  },

  onWordFocus() {
    this.setData({ wordFocused: true });
  },

  onWordBlur() {
    this.setData({ wordFocused: false });
  },

  onNotesInput(e) {
    this.setData({ notes: e.detail.value });
  },

  onNotesFocus() {
    this.setData({ notesFocused: true });
  },

  onNotesBlur() {
    this.setData({ notesFocused: false });
  },

  onDefInput(e) {
    const { index } = e.currentTarget.dataset;
    const meaningRows = this.data.meaningRows;
    meaningRows[index].def = e.detail.value;
    this.setData({ meaningRows }, () => this.updateCanSave());
  },

  onDefFocus(e) {
    const { index } = e.currentTarget.dataset;
    this.setData({ focusedDefIndex: index });
  },

  onDefBlur() {
    this.setData({ focusedDefIndex: -1 });
  },

  onToggleDropdown(e) {
    const { index } = e.currentTarget.dataset;
    this.setData({ openDropdownIndex: this.data.openDropdownIndex === index ? -1 : index });
  },

  onSelectPos(e) {
    const { index, pos } = e.currentTarget.dataset;
    const meaningRows = this.data.meaningRows;
    meaningRows[index].pos = meaningRows[index].pos === pos ? '' : pos;
    this.setData({ meaningRows, openDropdownIndex: -1 }, () => this.updateCanSave());
  },

  onCloseDropdown() {
    this.setData({ openDropdownIndex: -1 });
  },

  onAddMeaning() {
    const meaningRows = this.data.meaningRows.concat([emptyRow()]);
    this.setData({ meaningRows });
  },

  onSave() {
    if (!this.data.canSave) return;
    const meanings = this.data.meaningRows.filter((r) => r.def.trim());
    wordStore.addWord({ word: this.data.word, meanings, notes: this.data.notes.trim() });
    wx.showToast({ title: '已保存', icon: 'success' });
    this.setData({
      word: '',
      meaningRows: [emptyRow()],
      notes: '',
      openDropdownIndex: -1,
      canSave: false,
    });
  },
});

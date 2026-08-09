const wordStore = require('../../utils/wordStore.js');

const ACTION_LABEL = {
  added: { text: '首次添加', cls: 'action-added' },
  correct: { text: '✓ 记对了', cls: 'action-correct' },
  incorrect: { text: '✗ 记错了', cls: 'action-incorrect' },
};

const POS_OPTIONS = ['n.', 'v.', 'adj.', 'adv.', 'prep.', 'conj.', 'pron.', 'interj.'];

function emptyRow() {
  return { pos: '', def: '' };
}

function buildHistory(word) {
  return word.history.map((h) => ({
    date: h.date.replace(/-/g, '/'),
    label: (ACTION_LABEL[h.action] || {}).text || h.action,
    cls: (ACTION_LABEL[h.action] || {}).cls || '',
  }));
}

function emptyWord() {
  return { word: '', meanings: [], notes: '' };
}

Page({
  data: {
    // Never null: the whole page tree renders from the first frame using this
    // stub, so onLoad's setData only has to patch text into already-mounted
    // nodes instead of forcing the render layer to create the entire page's
    // node tree right as the navigation transition lands (visible as a
    // "frame appears instantly, content pops in late" stutter).
    word: emptyWord(),
    createdDateSlash: '',
    history: [],

    editing: false,
    editWord: '',
    editMeaningRows: [],
    editNotes: '',
    posOptions: POS_OPTIONS,
    openDropdownIndex: -1,
    canSave: false,
    wordFocused: false,
    focusedDefIndex: -1,
    notesFocused: false,
    showDeleteModal: false,
  },

  onLoad(options) {
    this.wordId = options.id;
    this.loadWord();
  },

  loadWord() {
    const word = wordStore.getWordById(this.wordId);
    if (!word) {
      wx.showToast({ title: '单词不存在', icon: 'none' });
      wx.navigateBack();
      return;
    }
    this.setData({
      word,
      createdDateSlash: word.createdDate.replace(/-/g, '/'),
      history: buildHistory(word),
    });
  },

  onEdit() {
    const word = this.data.word;
    const editMeaningRows = word.meanings.length ? word.meanings.map((m) => ({ pos: m.pos, def: m.def })) : [emptyRow()];
    this.setData({
      editing: true,
      editWord: word.word,
      editMeaningRows,
      editNotes: word.notes || '',
      openDropdownIndex: -1,
    }, () => this.updateCanSave());
  },

  onCancelEdit() {
    this.setData({ editing: false, openDropdownIndex: -1 });
  },

  updateCanSave() {
    const hasWord = this.data.editWord.trim().length > 0;
    const hasMeaning = this.data.editMeaningRows.some((r) => r.def.trim());
    this.setData({ canSave: hasWord && hasMeaning });
  },

  onWordInput(e) {
    this.setData({ editWord: e.detail.value }, () => this.updateCanSave());
  },

  onWordFocus() {
    this.setData({ wordFocused: true });
  },

  onWordBlur() {
    this.setData({ wordFocused: false });
  },

  onNotesInput(e) {
    this.setData({ editNotes: e.detail.value });
  },

  onNotesFocus() {
    this.setData({ notesFocused: true });
  },

  onNotesBlur() {
    this.setData({ notesFocused: false });
  },

  onDefInput(e) {
    const { index } = e.currentTarget.dataset;
    const editMeaningRows = this.data.editMeaningRows;
    editMeaningRows[index].def = e.detail.value;
    this.setData({ editMeaningRows }, () => this.updateCanSave());
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
    const editMeaningRows = this.data.editMeaningRows;
    editMeaningRows[index].pos = editMeaningRows[index].pos === pos ? '' : pos;
    this.setData({ editMeaningRows, openDropdownIndex: -1 }, () => this.updateCanSave());
  },

  onCloseDropdown() {
    this.setData({ openDropdownIndex: -1 });
  },

  onAddMeaning() {
    const editMeaningRows = this.data.editMeaningRows.concat([emptyRow()]);
    this.setData({ editMeaningRows });
  },

  onRemoveMeaning(e) {
    if (this.data.editMeaningRows.length <= 1) return;
    const { index } = e.currentTarget.dataset;
    const editMeaningRows = this.data.editMeaningRows.slice();
    editMeaningRows.splice(index, 1);
    this.setData({ editMeaningRows, openDropdownIndex: -1 }, () => this.updateCanSave());
  },

  onSave() {
    if (!this.data.canSave) return;
    const meanings = this.data.editMeaningRows.filter((r) => r.def.trim());
    wordStore.updateWord({
      id: this.wordId,
      word: this.data.editWord,
      meanings,
      notes: this.data.editNotes.trim(),
    });
    this.setData({ editing: false, openDropdownIndex: -1 });
    this.loadWord();
    wx.showToast({ title: '已保存', icon: 'success' });
  },

  onTapDelete() {
    this.setData({ showDeleteModal: true });
  },

  onCancelDelete() {
    this.setData({ showDeleteModal: false });
  },

  onConfirmDelete() {
    wordStore.deleteWord(this.wordId);
    wx.showToast({ title: '已删除', icon: 'success' });
    wx.navigateBack();
  },
});

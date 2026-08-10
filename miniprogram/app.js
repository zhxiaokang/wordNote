// app.js
const wordStore = require("./utils/wordStore.js");

App({
  onLaunch: function () {
    wordStore.backfillGapDays();
  },
});

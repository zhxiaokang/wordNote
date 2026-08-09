// app.js
const wordStore = require("./utils/wordStore.js");

App({
  onLaunch: function () {
    this.globalData = {
      // env 参数说明：
      // env 参数决定接下来小程序发起的云开发调用（wx.cloud.xxx）会请求到哪个云环境的资源
      // 此处请填入环境 ID, 环境 ID 可在微信开发者工具右上顶部工具栏点击云开发按钮打开获取
      // 只有"我的"页的用户反馈功能依赖这个 env；单词数据是纯本地存储，其余 tab 无需配置即可离线使用。
      env: "",
    };
    if (wx.cloud) {
      wx.cloud.init({
        env: this.globalData.env,
        traceUser: true,
      });
    }

    wordStore.backfillGapDays();
  },
});

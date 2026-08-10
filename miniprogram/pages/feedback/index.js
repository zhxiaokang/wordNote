const EMAIL = 'xkang.zhang@outlook.com';

Page({
  data: {
    email: EMAIL,
  },

  onCopyEmailTap() {
    wx.setClipboardData({
      data: EMAIL,
      success: () => wx.showToast({ title: '邮箱已复制', icon: 'success' }),
      fail: () => wx.showToast({ title: '复制失败', icon: 'none' }),
    });
  },
});

// background.js - 后台服务
chrome.runtime.onInstalled.addListener(() => {
    console.log('AI 翻译助手已安装');
});

// 可选：处理右键菜单等
// preload.js - 在网页和主进程之间桥接
window.addEventListener('DOMContentLoaded', () => {
    console.log('Preload loaded');
});

// preload.js - 最终优化版
const { contextBridge, ipcRenderer } = require('electron');

console.log('🔵 Preload 脚本已加载');

// 1. 先设置监听器（接收主进程消息）
ipcRenderer.on('translated-message', (event, { original, translated }) => {
  console.log('📩 收到翻译结果:', original, '→', translated);
  window.postMessage({ type: 'translated', original, text: translated }, '*');
});

// 2. 再暴露 API 给网页
contextBridge.exposeInMainWorld('electronAPI', {
  translateMessage: (msg) => {
    console.log('📤 发送翻译请求:', msg);
    return ipcRenderer.invoke('translate-message', msg);
  }
});

// 3. DOM 加载完成通知
window.addEventListener('DOMContentLoaded', () => {
    console.log('✅ DOM 已加载，preload 就绪');
});
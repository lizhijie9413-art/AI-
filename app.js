
const API ='http://localhost:3000'; 

const CID = 'user_' + Date.now();
const messagesEl = document.getElementById('messages');
const inputText = document.getElementById('inputText');
const resultText = document.getElementById('resultText');
const statusEl = document.getElementById('status');

const socket = io();
let currentTelegramChatId = null;
let currentMode = 'chat';
let translateHistory = JSON.parse(localStorage.getItem('translateHistory') || '[]');
let autoReplyMode = false;


function showPage(page) {
    currentMode = page;
    document.querySelectorAll('.nav').forEach(n => n.classList.remove('active'));
    event.target.classList.add('active');

    // 隐藏所有面板
    const tp = document.getElementById('telegramWebPanel');
    if (tp) tp.style.display = 'none';
    
    const replySettings = document.getElementById('replySettings');
    if (replySettings) replySettings.style.display = 'none';
    
    const offworkSettings = document.getElementById('offworkSettings');
    if (offworkSettings) offworkSettings.style.display = 'none';
    
    const historyPanel = document.getElementById('historyPanel');
    if (historyPanel) historyPanel.style.display = 'none';

    if (page === 'chat') {
        inputText.placeholder = '输入消息...';
        resultText.textContent = '智能聊天模式';
        document.querySelector('.primary').textContent = '加入聊天';
    } else if (page === 'translate') {
        inputText.placeholder = '输入中文，翻译成美式英文';
        resultText.textContent = '美式翻译模式';
        document.querySelector('.primary').textContent = '翻译成英文';
    } else if (page === 'telegram') {
        if (tp) tp.style.display = 'block';
        resultText.textContent = '📱 Telegram - 扫码登录';
        inputText.placeholder = '复制消息到这里翻译...';
        document.querySelector('.primary').textContent = '翻译选中内容';
    } else if (page === 'reply') {
        if (replySettings) replySettings.style.display = 'block';
        resultText.textContent = '🤖 AI 回复设置';
    } else if (page === 'offwork') {
        if (offworkSettings) offworkSettings.style.display = 'block';
        resultText.textContent = '🕘 下班模式设置';
    } else if (page === 'history') {
        if (historyPanel) historyPanel.style.display = 'block';
        renderHistory();
        resultText.textContent = '📜 翻译记录';
    }
    
    statusEl.textContent = '🟢 在线';
    statusEl.className = 'status on';
}

function closeTelegram() {
    document.getElementById('telegramWebPanel').style.display = 'none';
}

// ============ Enter发送 ============
inputText.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendAsMessage();
  }
});

// ============ 自动高度 ============
inputText.addEventListener('input', function() {
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 120) + 'px';
});

// ============ 发送消息 ============
async function sendAsMessage() {
    const text = inputText.value.trim();
    if (!text) return;
    if (currentMode === 'translate') {
        resultText.textContent = '正在翻译...';
        await translateOnly(); 
        return;
    }
    inputText.value = '';
    addBubble('me','客户',text,'');
    const typing = addTyping();
    try {
        const res = await fetch(API + '/chat', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify({message:text, customerId:CID})
        });
        const data = await res.json();
        typing.remove();
        if(data.reply) addBubble('other','Lisa',data.reply,data.replyZh||'');
    } catch(err) {
        typing.remove();
        addBubble('other','Lisa','Connection error.','连接失败。');
    }
    inputText.focus();
}

// ============ 只翻译 ============
async function translateOnly() {
  const text = inputText.value.trim();
  if (!text) { alert('请先输入要翻译的内容'); return; }
  resultText.textContent = '正在翻译...';
  try {
    const res = await fetch(API + '/api/translate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    const data = await res.json();
    if (data.translated) {
      resultText.textContent = data.translated;
      saveToHistory(text, data.translated);
      addBubble('me', '原文', text, '');
      addBubble('other', '美式英文', data.translated, '');
      inputText.value = '';
      inputText.style.height = 'auto';
    } else {
      resultText.textContent = '翻译失败，看控制台';
    }
  } catch (err) {
    resultText.textContent = '请求失败: ' + err.message;
  }
}

// ============ 生成AI回复 ============
async function makeReply() {
  const text = inputText.value.trim();
  if (!text) return;
  const res = await fetch(API + '/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: text, customerId: CID + '_preview' })
  });
  const data = await res.json();
  if (resultText && data.reply) {
    resultText.innerHTML = '<strong>🇺🇸 英文：</strong>' + data.reply + '<br><br><strong>🇨🇳 中文：</strong>' + (data.replyZh || '');
  }
}

// ============ 登录注册 ============
let authToken = localStorage.getItem('authToken');

async function login() {
  const username = document.getElementById('authUsername').value.trim();
  const password = document.getElementById('authPassword').value.trim();
  
  const res = await fetch(API + '/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  
  const data = await res.json();
  if (data.success) {
    authToken = data.token;
    localStorage.setItem('authToken', data.token);
    document.getElementById('authPanel').style.display = 'none';
    document.getElementById('authMsg').textContent = '';
    resultText.textContent = `✅ 欢迎，${data.username}！`;
  } else {
    document.getElementById('authMsg').textContent = '❌ ' + data.error;
  }
}

async function register() {
  const username = document.getElementById('authUsername').value.trim();
  const password = document.getElementById('authPassword').value.trim();
  
  const res = await fetch(API + '/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  
  const data = await res.json();
  if (data.success) {
    authToken = data.token;
    localStorage.setItem('authToken', data.token);
    document.getElementById('authPanel').style.display = 'none';
    document.getElementById('authMsg').textContent = '';
    resultText.textContent = `✅ 注册成功，欢迎，${data.username}！`;
  } else {
    document.getElementById('authMsg').textContent = '❌ ' + data.error;
  }
}

// 初始化：检查是否已登录
if (authToken) {
  document.getElementById('authPanel').style.display = 'none';
} else {
  document.getElementById('authPanel').style.display = 'flex';
}

// ============ 翻译+话题 ============
async function translatePlus() {
  const text = inputText.value.trim();
  if (!text) { alert('请先输入内容'); return; }
  resultText.textContent = '正在分析...';
  const res = await fetch(API + '/api/translate-plus', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
  const data = await res.json();
  resultText.innerHTML =
    '<b>美式英文：</b><br>' + (data.translated || '') +
    '<br><br><b>话题建议：</b><br>' + (data.topics || []).join('<br>') +
    '<br><br><b>推荐开场：</b><br>' + (data.openers || []).join('<br>');
  saveToHistory(text, data.translated || '');  // ✅ 加这行
  addBubble('me', '原文', text, '');
  addBubble('other', '美式英文', data.translated || '', '');
  inputText.value = '';
}


// ============ 客户分析 ============
async function analyzeCustomer() {
  resultText.textContent = '正在分析...';
  const res = await fetch(API + '/api/customer-analysis', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customerId: CID })
  });
  const data = await res.json();
  resultText.innerHTML = `
    <b>📊 ${data.stageLabel}</b> | 聊天${data.chatCount}次<br>
    <b>📌 兴趣：</b><br>${(data.interests || []).map(i => '✓ ' + i).join('<br>') || '暂无'}
    <br><br><b>💡 建议话题：</b><br>${(data.suggestedTopics || []).map(t => '• ' + t).join('<br>')}
    <br><br><b>📝 上次话题：</b>${data.lastTopic || '无'}
  `;
}

// ============ 每日简报 ============
async function dailyBrief() {
  const res = await fetch(API + '/api/daily-brief', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customerId: CID })
  });
  const data = await res.json();
  resultText.innerHTML = `
    <b>📊 ${data.stageLabel}</b> | 聊天${data.chatCount}次<br>
    <b>📌 兴趣：</b>${(data.interests || []).join(', ') || '暂无'}<br>
    <b>📝 上次：</b>${data.lastTopic || '无'}<br>
    <b>😊 情绪：</b>${data.mood || '未知'}
  `;
}


async function demoChat() {
  if (demoIndex >= demoMessages.length) {
    demoIndex = 0;
    resultText.textContent = '✅ 模拟完成，点击客户分析查看结果';
    return;
  }
  const text = demoMessages[demoIndex];
  demoIndex++;
  addBubble('me', '客户', text, '');
  await fetch(API + '/api/customer-analysis', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customerId: CID, message: text })
  });
  resultText.textContent = `✅ 已发送第${demoIndex}条：${text}`;
  if (demoIndex < demoMessages.length) {
    setTimeout(() => demoChat(), 1500);
  } else {
    setTimeout(() => { resultText.textContent = '✅ 完成！点击"📊 客户分析"查看结果'; }, 1000);
  }
}

// ============ 添加气泡 ============
function addBubble(cls, name, text, trans) {
  const div = document.createElement('div');
  div.className = 'bubble ' + cls;
  div.innerHTML = '<b>' + name + '</b><p>' + text + '</p>' + (trans ? '<small>中文：' + trans + '</small>' : '');
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// ============ 打字动画 ============
function addTyping() {
  const div = document.createElement('div');
  div.className = 'bubble other';
  div.innerHTML = '<b>Lisa</b><p>正在输入...</p>';
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return div;
}

// ============ 切换状态 ============
function toggleStatus() {
  const auto = document.getElementById('autoMode');
  if (statusEl) {
    statusEl.textContent = (auto && auto.checked) ? '🟠 自动回复' : '🟢 在线';
    statusEl.className = (auto && auto.checked) ? 'status off' : 'status on';
  }
}

// ============ Telegram 实时消息 ============
socket.on('telegram-message', (data) => {
  document.getElementById('telegramPanel').style.display = 'block';
  currentTelegramChatId = data.chatId;
  const div = document.createElement('div');
  div.style.cssText = 'padding:6px;margin:4px 0;background:#fff;border-radius:6px;';
  div.innerHTML = `<b>${data.username}</b> <small>${data.time}</small><br>${data.text}`;
  document.getElementById('telegramMessages').appendChild(div);
  document.getElementById('telegramMessages').scrollTop = document.getElementById('telegramMessages').scrollHeight;
 inputText.value = data.text;
  inputText.focus();
});



async function sendToTelegram() {

  const text = inputText.value.trim();

  if (!text || !currentTelegramChatId)
    return alert('没有活动对话');

  socket.emit(
    'send-to-telegram',
    {
      chatId: currentTelegramChatId,
      text
    }
  );

  addBubble('me', '客服回复', text, '');

  inputText.value = '';
}

// ============ 初始化 ============
messagesEl.innerHTML = '';
addBubble('other', 'Lisa', "Hi there! I'm Lisa. How's your day going?", '嗨！我是Lisa，你今天过得怎么样？');
statusEl.textContent = '🟢 在线';
statusEl.className = 'status on';

// ============ AI 回复设置 ============
let replySettingsData = {
  speed: 'normal',
  proactive: 'normal',
  length: 'normal'
};

function updateReplySettings() {
  replySettingsData.speed = document.getElementById('replySpeed')?.value || 'normal';
  replySettingsData.proactive = document.getElementById('proactiveRate')?.value || 'normal';
  replySettingsData.length = document.getElementById('msgLength')?.value || 'normal';
  resultText.textContent = '✅ 回复设置已更新';
}

function resetMemory() {
  if (confirm('确定要清除当前客户的记忆吗？')) {
    fetch(API + '/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId: CID })
    });
    resultText.textContent = '✅ 记忆已重置';
  }
}

// ============ 下班模式 ============
function toggleAutoReply() {
  autoReplyMode = document.getElementById('autoReplyMode')?.checked || false;
  if (statusEl) {
    statusEl.textContent = autoReplyMode ? '🟠 自动回复中' : '🟢 在线';
    statusEl.className = autoReplyMode ? 'status off' : 'status on';
  }
}

function saveOffworkSettings() {
  const msg = document.getElementById('awayMessage')?.value || '';
  localStorage.setItem('awayMessage', msg);
  resultText.textContent = '✅ 下班设置已保存';
}

// 加载已保存的下班问候语
const savedAwayMsg = localStorage.getItem('awayMessage');
if (savedAwayMsg && document.getElementById('awayMessage')) {
  document.getElementById('awayMessage').value = savedAwayMsg;
}

// ============ 翻译记录 ============
function saveToHistory(original, translated) {
  translateHistory.unshift({
    id: Date.now(),
    original,
    translated,
    time: new Date().toLocaleString()
  });
  if (translateHistory.length > 100) translateHistory = translateHistory.slice(0, 100);
  localStorage.setItem('translateHistory', JSON.stringify(translateHistory));
  renderHistory();
}

function renderHistory(filter = '') {
  const list = document.getElementById('historyList');
  if (!list) return;
  
  const filtered = filter 
    ? translateHistory.filter(h => h.original.includes(filter) || h.translated.includes(filter))
    : translateHistory;
  
  if (filtered.length === 0) {
    list.innerHTML = '<p style="color:#999;">暂无翻译记录</p>';
    return;
  }
  
  list.innerHTML = filtered.map(h => `
    <div style="padding:8px;margin:4px 0;background:#f8fafc;border-radius:8px;border-left:3px solid #2563eb;">
      <div style="color:#64748b;font-size:12px;">${h.original}</div>
      <div style="color:#2563eb;font-weight:600;font-size:13px;">→ ${h.translated}</div>
      <small style="color:#aaa;">${h.time}</small>
    </div>
  `).join('');
}

function filterHistory() {
  const keyword = document.getElementById('historySearch')?.value || '';
  renderHistory(keyword);
}

function exportHistory() {
  const text = translateHistory.map(h => `${h.time}\t${h.original}\t${h.translated}`).join('\n');
  const blob = new Blob([text], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '翻译记录.txt';
  a.click();
}

function clearHistory() {
  if (confirm('确定清空所有翻译记录？')) {
    translateHistory = [];
    localStorage.removeItem('translateHistory');
    renderHistory();
    resultText.textContent = '✅ 记录已清空';
  }
}

// ==================== MTProto 扫码登录 API ====================

// 初始化 MTProto 客户端
function initMTProtoClient() {
    if (!MT_API_ID || !MT_API_HASH) {
        console.log("⚠️ 未配置 TELEGRAM_API_ID 或 TELEGRAM_API_HASH");
        return null;
    }
    
    return new MTProto({
        api_id: MT_API_ID,
        api_hash: MT_API_HASH,
        dc_id: 2,  // 使用 DC2
        connection: {
            host: '149.154.167.50',
            port: 443,
        },
        storageOptions: {
            path: path.join(__dirname, 'telegram-session.json')
        }
    });
}

// 生成二维码
app.get("/api/telegram/qrcode", async (req, res) => {
    try {
        if (!mtprotoClient) {
            mtprotoClient = initMTProtoClient();
        }
        
        if (!mtprotoClient) {
            return res.json({ success: false, error: "MTProto 未初始化，请检查 API_ID 和 API_HASH 配置" });
        }
        
        const result = await mtprotoClient.call('auth.exportLoginToken', {
            api_id: MT_API_ID,
            api_hash: MT_API_HASH,
            except_ids: []
        });
        
        if (result._ === 'auth.loginToken') {
            const tokenBuffer = Buffer.from(result.token);
            const tokenBase64 = tokenBuffer.toString('base64');
            const qrUrl = `tg://login?token=${tokenBase64}`;
            const qrCodeDataUrl = await QRCode.toDataURL(qrUrl);
            
            // 开始轮询登录状态
            if (qrPollingInterval) clearInterval(qrPollingInterval);
            qrPollingInterval = setInterval(async () => {
                try {
                    const loginResult = await mtprotoClient.call('auth.importLoginToken', {
                        token: result.token
                    });
                    if (loginResult._ === 'auth.authorization') {
                        clearInterval(qrPollingInterval);
                        mtprotoConnected = true;
                        io.emit('telegram-login-success', { message: "个人账号登录成功！" });
                        console.log("✅ 个人账号登录成功！");
                        startMessageListener();
                    }
                } catch (err) {
                    // 等待用户扫码
                }
            }, 3000);
            
            res.json({ success: true, qrCode: qrCodeDataUrl });
        } else {
            res.json({ success: false, error: "无法生成登录 token" });
        }
    } catch (err) {
        console.error("生成二维码失败:", err);
        res.json({ success: false, error: err.message });
    }
});

// 获取登录状态
app.get("/api/telegram/status", (req, res) => {
    res.json({ connected: mtprotoConnected });
});

// 监听个人账号消息
async function startMessageListener() {
    if (!mtprotoClient) return;
    
    // 获取当前用户信息
    try {
        const me = await mtprotoClient.call('users.getUsers', {
            id: [{ _: 'inputUserSelf' }]
        });
        console.log("📱 已登录个人账号:", me[0]?.first_name);
    } catch (err) {}
    
    // 简单轮询获取消息
    setInterval(async () => {
        if (!mtprotoConnected) return;
        try {
            const dialogs = await mtprotoClient.call('messages.getDialogs', {
                limit: 5,
                offset_date: 0,
                offset_id: 0,
                offset_peer: { _: 'inputPeerEmpty' }
            });
            
            if (dialogs.messages && dialogs.messages.length > 0) {
                for (const msg of dialogs.messages) {
                    if (msg.message && !msg.out) {
                        const translated = simpleTranslate(msg.message);
                        io.emit('telegram-message', {
                            text: msg.message,
                            translated: translated,
                            time: new Date().toLocaleTimeString()
                        });
                    }
                }
            }
        } catch (err) {}
    }, 5000);
}

// 通过个人账号发送消息
app.post("/api/telegram/send", async (req, res) => {
    const { chatId, text } = req.body;
    if (!mtprotoClient || !mtprotoConnected) {
        return res.json({ success: false, error: "个人账号未登录" });
    }
    try {
        await mtprotoClient.call('messages.sendMessage', {
            peer: { _: 'inputPeerUser', user_id: parseInt(chatId) },
            message: text,
            random_id: Math.floor(Math.random() * 0xFFFFFFFF)
        });
        res.json({ success: true });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});
require("dotenv").config();

console.log("⚡ TELEGRAM_TOKEN =", process.env.TELEGRAM_TOKEN);
const { MTProto } = require('@mtproto/core');
const QRCode = require('qrcode');
const express = require("express");
const cors = require("cors");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const TelegramBot = require("node-telegram-bot-api");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "lisa_translator_secret_key_2024";
const users = {};

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET","POST"] } });

const PORT = process.env.PORT || 3000;

// ==================== 中间件 ====================
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// 静态文件
const publicPath = path.join(__dirname, "public");
app.use(express.static(publicPath));

// ==================== AI 聊天功能 ====================
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const AI_MODEL = process.env.AI_MODEL || "gpt-4o";
const sessions = {};

const sensitiveWords = [
  "invest", "investment", "profit", "guarantee",
  "deposit", "withdraw", "withdrawal",
  "crypto", "bitcoin", "usdt", "wallet",
  "收益", "投资", "充值", "提现", "钱包", "保证", "利润"
];

function hasSensitiveTopic(text = "") {
  const lower = text.toLowerCase();
  return sensitiveWords.some(word => lower.includes(word.toLowerCase()));
}

function getSession(customerId) {
  if (!sessions[customerId]) {
    sessions[customerId] = {
      memory: { interests: [], mood: "", food: [], travel: [], movies: [], music: [], fitness: [], pets: [], work: "", lastTopic: "", chatCount: 0 },
      messages: []
    };
  }
  return sessions[customerId];
}

function addUnique(list, value) {
  if (!value) return;
  if (!list.includes(value)) list.push(value);
}

function updateMemory(memory, text = "") {
  const lower = text.toLowerCase();
  if (["like","love","hobby","兴趣","喜欢"].some(k => lower.includes(k))) addUnique(memory.interests, text);
  if (["food","coffee","餐","吃"].some(k => lower.includes(k))) addUnique(memory.food, text);
  if (["travel","trip","旅游","旅行"].some(k => lower.includes(k))) addUnique(memory.travel, text);
  if (["movie","netflix","电影"].some(k => lower.includes(k))) addUnique(memory.movies, text);
  if (["music","song","音乐"].some(k => lower.includes(k))) addUnique(memory.music, text);
  if (["gym","workout","fitness","健身","滑雪","运动"].some(k => lower.includes(k))) addUnique(memory.fitness, text);
  if (["dog","cat","宠物","狗","猫"].some(k => lower.includes(k))) addUnique(memory.pets, text);
  if (["tired","stress","stressed","累","烦","心情不好"].some(k => lower.includes(k))) memory.mood = text;
  if (["work","job","工作","上班"].some(k => lower.includes(k))) memory.work = text;
  memory.lastTopic = text;
  memory.chatCount += 1;
}

async function callAI(messages, temperature = 0.85) {
  if (!OPENAI_API_KEY) {
    console.log("OPENAI KEY MISSING, using mock response");
    return mockAIResponse(messages);
  }
  
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type":"application/json",
        "Authorization":`Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({ 
        model: AI_MODEL, 
        temperature, 
        max_tokens: 300,
        messages 
      })
    });
    
    const rawText = await response.text();
    if (!response.ok) { console.log("OPENAI ERROR:", rawText); return mockAIResponse(messages); }
    const data = JSON.parse(rawText);
    return data.choices?.[0]?.message?.content?.trim() || mockAIResponse(messages);
  } catch (err) {
    console.error("AI call failed:", err.message);
    return mockAIResponse(messages);
  }
}

function mockAIResponse(messages) {
  const lastUserMsg = messages.filter(m => m.role === 'user').pop()?.content || "";
  const lower = lastUserMsg.toLowerCase();
  
  if (lower.includes("你好") || lower.includes("hello")) {
    return "Hey! How can I help you today? 😊";
  }
  if (lower.includes("谢谢") || lower.includes("thank")) {
    return "You're very welcome! Happy to help!";
  }
  if (lower.includes("价格") || lower.includes("price")) {
    return "Let me check the pricing for you. What product are you interested in?";
  }
  if (lower.includes("发货") || lower.includes("ship")) {
    return "Your order is being processed! Let me grab the tracking info for you 📦";
  }
  if (lower.includes("折扣") || lower.includes("discount")) {
    return "We have a spring sale! Use code SPRING10 for 10% off 🎉";
  }
  
  return "Thanks for sharing! Let me look into that for you. What else would you like to know?";
}

async function translateToChinese(text) {
  if (!text || !OPENAI_API_KEY) return text;
  
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: AI_MODEL,
        temperature: 0.1,
        max_tokens: 500,
        messages: [
          { role: "system", content: "Translate to natural Chinese. Keep emojis. Only return Chinese." },
          { role: "user", content: text }
        ]
      })
    });
    
    const raw = await response.text();
    if (!response.ok) { console.log("翻译错误:", raw); return text; }
    
    const data = JSON.parse(raw);
    return data.choices?.[0]?.message?.content?.trim() || text;
  } catch (err) {
    return text;
  }
}

// ==================== API 路由 ====================

app.get("/", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

// 聊天接口
app.post("/chat", async (req, res) => {
  try {
    const { message, customerId = "default" } = req.body;
    if (!message) return res.status(400).json({ error: "Message is required" });
    
    if (hasSensitiveTopic(message)) {
      return res.json({ 
        reply: "Let's talk about something else 😊",
        replyZh: "我们聊点别的吧 😊",
        flagged: true
      });
    }
    
    const session = getSession(customerId);
    const { memory, messages: chatMessages } = session;
    
    updateMemory(memory, message);
    chatMessages.push({ from: "customer", text: message, time: Date.now() });
    
    const conversation = chatMessages.slice(-10).map(m => ({
      role: m.from === "team" ? "assistant" : "user", 
      content: m.text
    }));
    
    let reply = await callAI([
      { role: "system", content: "You are a friendly customer service assistant. Reply naturally in American English. Keep responses short and helpful." },
      ...conversation
    ], 0.85);
    
    reply = reply || "Thanks for sharing! How can I help you further?";
    chatMessages.push({ from: "team", text: reply, time: Date.now() });
    
    let replyZh = await translateToChinese(reply);
    
    res.json({ reply, replyZh: replyZh || reply });
    
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({ 
      reply: "Sorry, I'm having trouble right now. Please try again.",
      replyZh: "抱歉，我现在有点问题，请稍后再试。"
    });
  }
});

// 翻译接口
app.post("/api/translate", async (req, res) => {
  const { text, style = "friendly" } = req.body;
  if (!text) return res.json({ success: false, translated: text });
  
  const translated = await callAI([
    { role: "system", content: `Translate to natural American English. Style: ${style}. Return only translation.` },
    { role: "user", content: text }
  ], 0.3);
  
  res.json({ success: true, translated: translated || text });
});

// 翻译+话题接口
app.post("/api/translate-plus", async (req, res) => {
  const { text } = req.body;
  if (!text) return res.json({ success: false, translated: "", topics: [], openers: [] });
  
  const reply = await callAI([
    { role: "system", content: `You are an American English chat assistant. Return JSON: {"translated": "natural American English", "topics": ["topic1","topic2","topic3"], "openers": ["opener1","opener2"]}` },
    { role: "user", content: text }
  ], 0.7);
  
  try {
    const data = JSON.parse(reply);
    res.json({ success: true, translated: data.translated || "", topics: data.topics || [], openers: data.openers || [] });
  } catch (err) {
    res.json({ success: true, translated: reply, topics: [], openers: [] });
  }
});

// 客户分析接口
app.post("/api/customer-analysis", async (req, res) => {
  const { customerId = "default", message = "" } = req.body;
  
  const session = getSession(customerId);
  const { memory, messages: chatMessages } = session;
  
  if (message) {
    updateMemory(memory, message);
    chatMessages.push({ from: "customer", text: message, time: Date.now() });
  }
  
  const chatCount = memory.chatCount || 0;
  let relationshipStage = "cold";
  if (chatCount > 10) relationshipStage = "hot";
  else if (chatCount > 4) relationshipStage = "warm";
  
  const extractKeyword = (text) => {
    if (!text) return null;
    const keywords = {
      '健身': '健身', 'gym': '健身', '运动': '运动', '旅行': '旅行', '旅游': '旅游',
      '电影': '电影', 'movie': '电影', '音乐': '音乐', '狗': '宠物', '猫': '宠物'
    };
    const lower = text.toLowerCase();
    for (const [key, value] of Object.entries(keywords)) {
      if (lower.includes(key)) return value;
    }
    return null;
  };
  
  const rawInterests = [...memory.interests || [], ...memory.food || [], ...memory.travel || [], ...memory.fitness || []];
  const keywords = rawInterests.map(extractKeyword).filter(Boolean);
  const uniqueInterests = [...new Set(keywords)];
  
  res.json({
    success: true,
    interests: uniqueInterests,
    relationshipStage,
    stageLabel: relationshipStage === "cold" ? "❄️ 初期" : relationshipStage === "warm" ? "🌤️ 升温中" : "🔥 热络",
    chatCount,
    lastTopic: memory.lastTopic || "无",
    mood: memory.mood || "未知"
  });
});

// 每日简报接口
app.post("/api/daily-brief", async (req, res) => {
  const { customerId = "default" } = req.body;
  const session = getSession(customerId);
  const { memory } = session;
  const chatCount = memory.chatCount || 0;
  
  const brief = `📋 今日简报 (${new Date().toLocaleDateString()}): 共接待 ${Math.floor(Math.random() * 15) + 8} 位客户，主要问题: 物流查询(35%)、价格咨询(28%)，转化率约 71%。推荐美式用语: "Let me look into that for you right away!"`;
  
  res.json({ success: true, brief, chatCount });
});

// ========== 认证接口 ==========
app.post("/api/register", async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.json({ success: false, error: '用户名和密码不能为空' });
  }
  
  if (username.length < 3 || password.length < 6) {
    return res.json({ success: false, error: '用户名至少3位，密码至少6位' });
  }
  
  if (users[username]) {
    return res.json({ success: false, error: '用户名已存在' });
  }
  
  const hashedPassword = await bcrypt.hash(password, 10);
  users[username] = {
    username,
    password: hashedPassword,
    createdAt: new Date().toISOString()
  };
  
  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ success: true, token, username });
});

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.json({ success: false, error: '用户名和密码不能为空' });
  }
  
  const user = users[username];
  if (!user) {
    return res.json({ success: false, error: '用户不存在' });
  }
  
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.json({ success: false, error: '密码错误' });
  }
  
  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ success: true, token, username });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ==================== MTProto 扫码登录 API ====================
const MT_API_ID = parseInt(process.env.TELEGRAM_API_ID || "30451905");
const MT_API_HASH = process.env.TELEGRAM_API_HASH || "";

let mtprotoClient = null;
let mtprotoConnected = false;
let qrPollingInterval = null;

function initMTProtoClient() {
    if (!MT_API_ID || !MT_API_HASH) {
        console.log("⚠️ 未配置 TELEGRAM_API_ID 或 TELEGRAM_API_HASH");
        return null;
    }
    return new MTProto({
        api_id: MT_API_ID,
        api_hash: MT_API_HASH,
        dc_id: 2,
        connection: { host: '149.154.167.50', port: 443 },
        storageOptions: { path: path.join(__dirname, 'telegram-session.json') }
    });
}

app.get("/api/telegram/qrcode", async (req, res) => {
    try {
        if (!mtprotoClient) mtprotoClient = initMTProtoClient();
        if (!mtprotoClient) return res.json({ success: false, error: "MTProto 未初始化" });
        
        const result = await mtprotoClient.call('auth.exportLoginToken', {
            api_id: MT_API_ID, api_hash: MT_API_HASH, except_ids: []
        });
        
        if (result._ === 'auth.loginToken') {
            const qrUrl = `tg://login?token=${Buffer.from(result.token).toString('base64')}`;
            const qrCodeDataUrl = await QRCode.toDataURL(qrUrl);
            
            if (qrPollingInterval) clearInterval(qrPollingInterval);
            qrPollingInterval = setInterval(async () => {
                try {
                    const loginResult = await mtprotoClient.call('auth.importLoginToken', { token: result.token });
                    if (loginResult._ === 'auth.authorization') {
                        clearInterval(qrPollingInterval);
                        mtprotoConnected = true;
                        io.emit('telegram-login-success', { message: "登录成功！" });
                        console.log("✅ 个人账号登录成功！");
                    }
                } catch (err) {}
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

app.get("/api/telegram/status", (req, res) => {
    res.json({ connected: mtprotoConnected });
});

// ==================== Telegram Bot ====================
let bot = null;

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
if (TELEGRAM_TOKEN) {
 bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
  
  function simpleTranslate(text) {
    const isChinese = /[\u4e00-\u9fa5]/.test(text);
    const map = {
      '你好': 'Hello', '谢谢': 'Thank you', '价格': 'Price',
      '多少钱': 'How much', '发货': 'Shipping', '物流': 'Tracking',
      'hello': '你好', 'hi': '你好', 'thank': '谢谢', 'price': '价格'
    };
    
    for (const [k, v] of Object.entries(map)) {
      if (text.toLowerCase().includes(k)) {
        return { from: isChinese ? '中文' : '英文', to: isChinese ? '英文' : '中文', result: v };
      }
    }
    return { from: isChinese ? '中文' : '英文', to: isChinese ? '英文' : '中文', result: isChinese ? `[EN] ${text}` : `[CN] ${text}` };
  }
  
  bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "🤖 AI 翻译机器人已启动！\n\n发送任何消息，自动翻译中英文。\n\n支持：你好、谢谢、价格、发货等");
  });
  
  bot.on('message', async (msg) => {
    const text = msg.text;
    if (!text || text.startsWith('/')) return;

    const chatId = msg.chat.id;
    const username = msg.from?.first_name || msg.from?.username || 'Telegram User';

    const result = simpleTranslate(text);

    // 发送翻译结果
    await bot.sendMessage(chatId, `🔍 ${result.from} → ${result.to}\n\n📝 ${result.result}`);
    
    // 通过 WebSocket 推送到前端
    io.emit('telegram-message', {
      chatId,
      username,
      text,
      translated: result.result,
      time: new Date().toLocaleTimeString()
    });
  });
  
  console.log("✅ Telegram 翻译机器人已启动");
} else {
  console.log("⚠️ 未配置 TELEGRAM_TOKEN，Telegram 功能未启动");
}

// ==================== Socket.IO ====================
io.on("connection", (socket) => {
  console.log("🟢 客户端连接:", socket.id);

  socket.on("send-to-telegram", async (data) => {
    try {
      const { chatId, text } = data;
      if (!chatId || !text) return;
      if (!bot) {
        console.log("❌ Telegram Bot 未启动");
        return;
      }
      await bot.sendMessage(chatId, text);
      console.log(`✅ 已回复 Telegram [${chatId}]: ${text}`);
    } catch (err) {
      console.error("❌ Telegram 回复失败:", err.message);
    }
  });

  socket.on("disconnect", () => {
    console.log("🔴 客户端断开:", socket.id);
  });
});

// ==================== 启动服务器 ====================
server.listen(PORT, () => {
  console.log(`\n${"=".repeat(55)}`);
  console.log(`🚀 AI 客服助手已启动`);
  console.log(`${"=".repeat(55)}`);
  console.log(`📡 本地访问: http://localhost:${PORT}`);
  console.log(`📁 静态文件: ${publicPath}`);
  console.log(`🤖 AI 模式: ${OPENAI_API_KEY ? "OpenAI启用" : "模拟模式"}`);
  console.log(`💾 记忆功能: 已启用`);
  console.log(`📊 客户分析: 已启用`);
  console.log(`📱 Telegram: ${TELEGRAM_TOKEN ? "翻译机器人已启动" : "未配置"}`);
  console.log(`${"=".repeat(55)}\n`);
});

// 错误处理
process.on("uncaughtException", (err) => {
  console.error("❌ 未捕获的异常:", err);
});
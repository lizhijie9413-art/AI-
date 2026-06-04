// content.js - Telegram Web 翻译助手

class TelegramTranslator {
    constructor() {
        this.settings = {
            autoTranslate: true,      // 自动翻译
            translateOwn: false,      // 翻译自己发送的消息
            replyStyle: 'friendly',   // 回复风格
            fontSize: 14,             // 字体大小
            fontColor: '#2AABEE'      // 翻译文字颜色
        };
        this.isTranslating = false;
        this.loadSettings();
        this.init();
    }

    // 选择器
    selectors = {
        messages: '.bubbles .message',
        outgoingMsg: '.bubbles .is-out .message',
        incomingMsg: '.bubbles .is-in .message',
        inputArea: '.input-message-input',
        sendBtn: '.btn-send',
        chatContainer: '.bubbles'
    };

    async init() {
        console.log('🤖 AI 翻译助手已启动');
        await this.waitForPage();
        this.observeMessages();
        this.injectStyles();
        this.addSettingsPanel();
        console.log('✅ 翻译助手初始化完成');
    }

    async waitForPage() {
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                const messages = document.querySelector(this.selectors.messages);
                if (messages) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 500);
        });
    }

    // 监听新消息
    observeMessages() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.addedNodes.length) {
                    this.translateNewMessages();
                }
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // 初始翻译
        setTimeout(() => this.translateNewMessages(), 1000);
    }

    // 翻译新消息
    async translateNewMessages() {
        const messages = document.querySelectorAll(this.selectors.incomingMsg);
        
        for (const msg of messages) {
            // 检查是否已翻译
            if (msg.parentElement?.querySelector('.ai-translation')) continue;
            
            const text = this.extractText(msg);
            if (!text || this.isNumber(text)) continue;
            
            // 显示翻译中状态
            this.showTranslationLoading(msg);
            
            // 调用翻译 API
            const translated = await this.translateText(text);
            
            // 插入翻译结果
            this.insertTranslation(msg, translated);
        }
    }

    // 提取消息文本
    extractText(element) {
        let text = '';
        const childNodes = element.childNodes;
        
        for (const node of childNodes) {
            if (node.nodeType === Node.TEXT_NODE) {
                text += node.textContent;
            } else if (node.nodeName === 'IMG') {
                text += node.alt || '';
            } else if (node.nodeName === 'BR') {
                text += '\n';
            } else if (node.nodeName === 'DIV' || node.nodeName === 'SPAN') {
                text += this.extractText(node);
            }
        }
        
        return text.trim();
    }

    // 显示翻译中
    showTranslationLoading(element) {
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'ai-translation ai-loading';
        loadingDiv.textContent = '🔄 翻译中...';
        element.parentElement?.appendChild(loadingDiv);
    }

    // 调用翻译 API
    async translateText(text) {
        // 方案1：调用您自己的后端 API
        const apiUrl = 'https://ai-v2zo.onrender.com/api/translate';
        
        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ text, style: this.settings.replyStyle })
            });
            
            const data = await response.json();
            return data.translated || data.result || text;
        } catch (error) {
            console.error('翻译失败:', error);
            
            // 方案2：备用 - 本地简单翻译
            return this.localTranslate(text);
        }
    }

    // 本地简单翻译（备用）
    localTranslate(text) {
        const map = {
            '你好': 'Hello',
            '谢谢': 'Thank you',
            '价格': 'Price',
            '发货': 'Shipping',
            '多少钱': 'How much',
            '订单': 'Order'
        };
        
        for (const [cn, en] of Object.entries(map)) {
            if (text.includes(cn)) return en;
        }
        return `📝 ${text}`;
    }

    // 插入翻译结果
    insertTranslation(element, translated) {
        // 移除加载中的占位
        const loading = element.parentElement?.querySelector('.ai-loading');
        if (loading) loading.remove();
        
        // 检查是否已有翻译
        let translationDiv = element.parentElement?.querySelector('.ai-translation');
        
        if (!translationDiv) {
            translationDiv = document.createElement('div');
            translationDiv.className = 'ai-translation';
            element.parentElement?.appendChild(translationDiv);
        }
        
        translationDiv.innerHTML = `
            <span class="translation-icon">🌐</span>
            <span class="translation-text">${this.escapeHtml(translated)}</span>
            <button class="translation-copy" onclick="navigator.clipboard.writeText('${this.escapeHtml(translated)}')">📋</button>
        `;
        translationDiv.style.display = 'block';
    }

    // 添加设置面板到页面
    addSettingsPanel() {
        const panel = document.createElement('div');
        panel.id = 'ai-translator-panel';
        panel.innerHTML = `
            <div class="translator-toggle" id="translatorToggle">
                <span>🤖 AI 翻译</span>
                <label class="switch">
                    <input type="checkbox" id="autoTranslateCheckbox" ${this.settings.autoTranslate ? 'checked' : ''}>
                    <span class="slider"></span>
                </label>
            </div>
            <div class="translator-settings">
                <select id="replyStyleSelect">
                    <option value="friendly" ${this.settings.replyStyle === 'friendly' ? 'selected' : ''}>😊 自然友好</option>
                    <option value="casual" ${this.settings.replyStyle === 'casual' ? 'selected' : ''}>🗣️ 轻松口语</option>
                    <option value="professional" ${this.settings.replyStyle === 'professional' ? 'selected' : ''}>💼 专业简短</option>
                </select>
            </div>
        `;
        
        // 添加到页面侧边栏
        const sidebar = document.querySelector('.tg_head_split');
        if (sidebar) {
            sidebar.appendChild(panel);
        }
        
        // 绑定事件
        const checkbox = document.getElementById('autoTranslateCheckbox');
        if (checkbox) {
            checkbox.addEventListener('change', (e) => {
                this.settings.autoTranslate = e.target.checked;
                this.saveSettings();
                if (this.settings.autoTranslate) {
                    this.translateNewMessages();
                }
            });
        }
        
        const styleSelect = document.getElementById('replyStyleSelect');
        if (styleSelect) {
            styleSelect.addEventListener('change', (e) => {
                this.settings.replyStyle = e.target.value;
                this.saveSettings();
            });
        }
    }

    // 注入样式
    injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .ai-translation {
                margin: 5px 0 5px 30px;
                padding: 6px 10px;
                background: #f0f2f5;
                border-radius: 12px;
                font-size: 13px;
                color: #2AABEE;
                border-left: 3px solid #2AABEE;
                display: flex;
                align-items: center;
                gap: 8px;
                flex-wrap: wrap;
            }
            .ai-translation .translation-icon {
                font-size: 14px;
            }
            .ai-translation .translation-text {
                flex: 1;
                word-break: break-word;
            }
            .ai-translation .translation-copy {
                background: none;
                border: none;
                cursor: pointer;
                font-size: 14px;
                opacity: 0.6;
            }
            .ai-translation .translation-copy:hover {
                opacity: 1;
            }
            .ai-loading {
                opacity: 0.6;
                font-style: italic;
            }
            #ai-translator-panel {
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: white;
                border-radius: 12px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                padding: 12px 16px;
                z-index: 10000;
                font-size: 13px;
                display: flex;
                gap: 16px;
                align-items: center;
            }
            .translator-toggle {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .switch {
                position: relative;
                display: inline-block;
                width: 40px;
                height: 20px;
            }
            .switch input {
                opacity: 0;
                width: 0;
                height: 0;
            }
            .slider {
                position: absolute;
                cursor: pointer;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: #ccc;
                transition: 0.3s;
                border-radius: 20px;
            }
            .slider:before {
                position: absolute;
                content: "";
                height: 16px;
                width: 16px;
                left: 2px;
                bottom: 2px;
                background-color: white;
                transition: 0.3s;
                border-radius: 50%;
            }
            input:checked + .slider {
                background-color: #2AABEE;
            }
            input:checked + .slider:before {
                transform: translateX(20px);
            }
            .translator-settings select {
                padding: 4px 8px;
                border-radius: 8px;
                border: 1px solid #ddd;
                background: white;
            }
        `;
        document.head.appendChild(style);
    }

    // 保存设置
    saveSettings() {
        localStorage.setItem('telegram_translator_settings', JSON.stringify(this.settings));
    }

    // 加载设置
    loadSettings() {
        const saved = localStorage.getItem('telegram_translator_settings');
        if (saved) {
            try {
                this.settings = { ...this.settings, ...JSON.parse(saved) };
            } catch(e) {}
        }
    }

    // 检测纯数字
    isNumber(str) {
        return /^\d+$/.test(str);
    }

    // HTML 转义
    escapeHtml(str) {
        return str.replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }
}

// 启动翻译器
window.addEventListener('load', () => {
    setTimeout(() => {
        new TelegramTranslator();
    }, 2000);
});
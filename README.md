# AI Translator Assistant 内部版

功能：
- 中文 ⇄ 自然美式英语翻译
- AI 回复草稿
- 下班自动回复模式
- 随机延迟、合并消息、敏感问题转人工
- 没有 API KEY 也可以先测试界面

## 使用方法

1. 解压压缩包
2. 进入项目文件夹
3. 安装依赖：

```bash
npm install
```

4. 复制环境变量文件：

```bash
cp .env.example .env
```

Windows 可以直接复制 `.env.example`，重命名为 `.env`。

5. 在 `.env` 里面填入你的 API KEY：

```bash
OPENAI_API_KEY=你的key
```

6. 启动：

```bash
npm start
```

7. 浏览器打开：

```text
http://localhost:3000
```

## 后续可升级

- 接 Telegram
- 接 WhatsApp
- 接 Facebook / Instagram
- 加团队账号登录
- 加聊天记录数据库
- 加敏感词后台管理

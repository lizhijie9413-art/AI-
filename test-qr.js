require("dotenv").config();
const { MTProto } = require('@mtproto/core');
const QRCode = require('qrcode');

const API_ID = parseInt(process.env.TELEGRAM_API_ID || "0");
const API_HASH = process.env.TELEGRAM_API_HASH || "";

console.log("API_ID:", API_ID);
console.log("API_HASH:", API_HASH ? "已配置" : "未配置");

async function test() {
    if (!API_ID || !API_HASH) {
        console.log("❌ 请先配置 TELEGRAM_API_ID 和 TELEGRAM_API_HASH");
        return;
    }
    
    const client = new MTProto({
        api_id: API_ID,
        api_hash: API_HASH,
    });
    
    try {
        const result = await client.call('auth.exportLoginToken', {
            api_id: API_ID,
            api_hash: API_HASH,
            except_ids: []
        });
        
        console.log("结果:", result);
        
        if (result._ === 'auth.loginToken') {
            const tokenBase64 = Buffer.from(result.token).toString('base64');
            const qrUrl = `tg://login?token=${tokenBase64}`;
            const qrCode = await QRCode.toDataURL(qrUrl);
            console.log("✅ 二维码生成成功！");
            // 保存二维码到文件
            const fs = require('fs');
            const base64Data = qrCode.replace(/^data:image\/png;base64,/, '');
            fs.writeFileSync('qr.png', base64Data, 'base64');
            console.log("二维码已保存为 qr.png");
        }
    } catch (err) {
        console.error("错误:", err.message);
    }
}

test();
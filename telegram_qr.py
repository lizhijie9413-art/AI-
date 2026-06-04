import asyncio
from telethon import TelegramClient
import qrcode
import os
from dotenv import load_dotenv

load_dotenv()

api_id = int(os.getenv('TELEGRAM_API_ID'))
api_hash = os.getenv('TELEGRAM_API_HASH')

async def main():
    client = TelegramClient('session', api_id, api_hash)
    
    # 生成二维码登录
    qr = await client.qr_login()
    
    # 保存二维码
    qr.png('qr.png', scale=10)
    print("✅ 二维码已保存为 qr.png")
    print("请用手机 Telegram App 扫描")
    
    # 等待扫码
    await qr.wait()
    print("✅ 登录成功！")
    
    # 获取所有对话
    async for dialog in client.iter_dialogs():
        print(f'{dialog.name}: {dialog.id}')

asyncio.run(main())
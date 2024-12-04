const TelegramBot = require('node-telegram-bot-api');

// إعداد الـ API Token الخاص بـ Telegram
const token = 'YOUR_API_TOKEN';
const bot = new TelegramBot(token);

// إعداد Webhook
const webhookUrl = 'https://your-server.com/bot'; // استبدل بـ URL الخاص بك
bot.setWebHook(`${webhookUrl}/bot`);

module.exports = bot;

const TelegramBot = require('node-telegram-bot-api');

// إعداد الـ API Token الخاص بـ Telegram
const token = '7859625373:AAEFlMbm3Sfagj4S9rx5ixbfqItE1jNpDos';
const bot = new TelegramBot(token);

// إعداد Webhook
const webhookUrl = 'https://trygaz.onrender.com'; // استبدل بـ URL الخاص بك
bot.setWebHook(`${webhookUrl}/bot`);

module.exports = bot;

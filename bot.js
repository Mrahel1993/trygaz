const TelegramBot = require('node-telegram-bot-api');
const { sendMessageToAdmins } = require('./utils');

const token = process.env.TELEGRAM_BOT_TOKEN || 'your-token';
const bot = new TelegramBot(token, { polling: false });

const webhookUrl = process.env.WEBHOOK_URL || 'https://example.com';
bot.setWebHook(`${webhookUrl}/bot${token}`);

module.exports = bot;

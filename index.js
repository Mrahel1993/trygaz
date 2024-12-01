// bot.js
const { Telegraf } = require('telegraf');
const fs = require('fs');
const path = require('path');
const driveService = require('./googleDrive'); // ملف التعامل مع Google Drive

// استبدل بـ توكن البوت الخاص بك
const bot = new Telegraf('7859625373:AAEFlMbm3Sfagj4S9rx5ixbfqItE1jNpDos');

// عند بدء البوت
bot.start((ctx) => ctx.reply('Welcome to the bot!'));

// عند تلقي رسالة من المستخدم
bot.on('text', (ctx) => {
  const userId = ctx.from.id;
  const userName = ctx.from.username;
  const userData = { userId, userName, message: ctx.message.text };

  // تخزين البيانات في ملف على Google Drive
  const filePath = path.join(__dirname, 'user_data.json');
  fs.writeFileSync(filePath, JSON.stringify(userData, null, 2));

  // رفع البيانات إلى Google Drive
  driveService.uploadFile(filePath);

  ctx.reply('Your data has been saved and uploaded to Google Drive!');
});

// تشغيل البوت
bot.launch();

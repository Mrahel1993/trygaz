const TelegramBot = require('node-telegram-bot-api');

// إعداد الـ API Token الخاص بـ Telegram
const token = '7859625373:AAEFlMbm3Sfagj4S9rx5ixbfqItE1jNpDos';
const bot = new TelegramBot(token);

// إعداد Webhook
const webhookUrl = 'https://trygaz.onrender.com'; // استبدل بـ URL الخاص بك
bot.setWebHook(`${webhookUrl}/bot`);

// تخزين معرفات الدردشة لمستخدمي البوت
let chatIds = []; // سيتم تخزين معرفات المستخدمين الذين تفاعلوا مع البوت

// إضافة معرف دردشة جديد عند التفاعل
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  if (!chatIds.includes(chatId)) {
    chatIds.push(chatId); // إضافة المعرف للقائمة إذا لم يكن موجودًا
  }
});

// دالة إرسال رسالة مع زر لوحة مفاتيح مخصصة
function sendMainMenu(chatId) {
  const options = {
    reply_markup: {
      keyboard: [
        [
          { text: 'إرسال رسالة للجميع' },
          { text: 'ابحث في البيانات' },
        ],
      ],
      one_time_keyboard: true, // إخفاء لوحة المفاتيح بعد الضغط
    },
  };
  
  const welcomeMessage = "مرحبًا! اختر أحد الخيارات:";
  bot.sendMessage(chatId, welcomeMessage, options);
}

// التعامل مع الزر عند الضغط عليه
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (text === 'إرسال رسالة للجميع') {
    const responseMessage = 'هذه هي الرسالة التي تم إرسالها لجميع المستخدمين!';
    sendMessageToAllUsers(responseMessage);
    bot.sendMessage(chatId, "تم إرسال الرسالة لجميع المستخدمين.");
  } else if (text === 'ابحث في البيانات') {
    bot.sendMessage(chatId, "يرجى إرسال النص الذي ترغب في البحث عنه.");
  }
});

// إرسال رسالة لجميع المستخدمين
function sendMessageToAllUsers(message) {
  chatIds.forEach(chatId => {
    bot.sendMessage(chatId, message);
  });
}

// تصدير الوظائف لاستخدامها في أماكن أخرى
module.exports = { bot, sendMessageToAllUsers, sendMainMenu };

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

// دالة إرسال رسالة مع زر
function sendMessageWithButton(chatId) {
  const options = {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: 'إرسال رسالة',
            callback_data: 'send_message', // بيانات الزر
          },
        ],
      ],
    },
  };
  
  const welcomeMessage = "مرحبًا! اضغط على الزر لإرسال رسالة.";
  bot.sendMessage(chatId, welcomeMessage, options);
}

// التعامل مع الزر عند الضغط عليه
bot.on('callback_query', (query) => {
  if (query.data === 'send_message') {
    const chatId = query.message.chat.id;
    const responseMessage = 'هذه هي الرسالة التي تم إرسالها بعد الضغط على الزر!';
    bot.sendMessage(chatId, responseMessage);
  }
});

// إرسال رسالة لجميع المستخدمين
function sendMessageToAllUsers(message) {
  chatIds.forEach(chatId => {
    bot.sendMessage(chatId, message);
  });
}

// تصدير الوظائف لاستخدامها في أماكن أخرى
module.exports = { bot, sendMessageToAllUsers, sendMessageWithButton };

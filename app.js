const express = require('express');
const bodyParser = require('body-parser');
const bot = require('./bot'); // إعدادات Telegram Bot
const { readExcelData, searchExcelData } = require('./excel-utils'); // وظائف التعامل مع Excel

const app = express();
app.use(bodyParser.json());

// ملفات Excel
const files = ['file1.xlsx', 'file2.xlsx']; // استبدل بأسماء ملفاتك

// استلام الطلبات عبر Webhook
app.post('/bot', (req, res) => {
  const msg = req.body.message;
  const chatId = msg.chat.id;
  const query = msg.text;

  // إرسال رسالة مع الزر للمستخدم
  if (query === '/start') {
    bot.sendMessageWithButton(chatId);
    return res.status(200).send('OK');
  }

  if (!query) {
    bot.sendMessage(chatId, "يرجى إدخال نص للبحث.");
    return res.status(200).send('OK');
  }

  // قراءة البيانات من ملفات Excel
  const data = readExcelData(files);

  // البحث في البيانات
  const results = searchExcelData(data, query);

  if (results.length === 0) {
    bot.sendMessage(chatId, "لم يتم العثور على نتائج تطابق البحث.");
  } else {
    let message = "نتائج البحث:\n\n";
    results.forEach(row => {
      Object.keys(row).forEach(key => {
        message += `${key}: ${row[key]}\n`;
      });
      message += "\n";
    });

    bot.sendMessage(chatId, message);
  }

  res.status(200).send('OK');
});

// بدء الخادم على المنفذ 3000
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Webhook server is running on port ${port}`);
});

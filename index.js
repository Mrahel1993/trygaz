const TelegramBot = require('node-telegram-bot-api');
const XLSX = require('xlsx');
const express = require('express');
const bodyParser = require('body-parser');

// API token الخاص بك
const token = '7859625373:AAEFlMbm3Sfagj4S9rx5ixbfqItE1jNpDos';
const bot = new TelegramBot(token);

// إنشاء خادم Express
const app = express();

// إعداد body-parser لقبول JSON
app.use(bodyParser.json());

// إعداد URL الخاص بـ Webhook
const webhookUrl = 'https://trygaz.onrender.com'; // استبدل بـ URL الخاص بك

// تعيين Webhook
bot.setWebHook(`${webhookUrl}/bot`);

// ملفات Excel التي تريد التعامل معها
const files = ['bur.xlsx', 'kan.xlsx' , 'rfh.xlsx']; // استبدل بأسماء الملفات الفعلية

// وظيفة لقراءة البيانات من ملف Excel
function readExcelData(files) {
  let data = {};
  files.forEach(file => {
    const workbook = XLSX.readFile(file);
    const sheetName = workbook.SheetNames[0]; // نفترض أن البيانات في الورقة الأولى
    const worksheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(worksheet);
    data[file] = json;
  });
  return data;
}

// استلام الطلبات عبر Webhook
app.post('/bot', (req, res) => {
  const msg = req.body.message;
  const chatId = msg.chat.id;

  // قراءة البيانات من ملفات Excel
  const data = readExcelData(files);

  let message = "البيانات من ملفات Excel:\n\n";
  for (const file in data) {
    message += `من الملف ${file}:\n`;
    // عرض أول 5 صفوف فقط لتقليل حجم الرسالة
    const firstRows = data[file].slice(0, 5);
    firstRows.forEach(row => {
      message += JSON.stringify(row) + '\n';
    });
    message += "\n\n";
  }

  // إرسال البيانات للمستخدم
  bot.sendMessage(chatId, message);

  // إرسال رد بنجاح للـ Webhook
  res.status(200).send('OK');
});

// بدء الخادم على المنفذ 3000
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Webhook server is running on port ${port}`);
});

const TelegramBot = require('node-telegram-bot-api');
const XLSX = require('xlsx');
const express = require('express');
const bodyParser = require('body-parser');

// API token الخاص بك
const token = 'YOUR_API_TOKEN';
const bot = new TelegramBot(token);

// إنشاء خادم Express
const app = express();
app.use(bodyParser.json());

// إعداد URL الخاص بـ Webhook
const webhookUrl = 'https://your-server.com/bot'; // استبدل بـ URL الخاص بك
bot.setWebHook(`${webhookUrl}/bot`);

// ملفات Excel التي تريد التعامل معها
const files = ['file1.xlsx', 'file2.xlsx']; // استبدل بأسماء الملفات الفعلية

// وظيفة لقراءة البيانات من ملفات Excel
function readExcelData(files) {
  let data = [];
  files.forEach(file => {
    const workbook = XLSX.readFile(file);
    const sheetName = workbook.SheetNames[0]; // نفترض أن البيانات في الورقة الأولى
    const worksheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 }); // استخراج البيانات كصفوف مصفوفة
    const headers = json[0]; // أسماء الأعمدة
    const rows = json.slice(1); // الصفوف بدون العناوين

    rows.forEach(row => {
      let rowData = {};
      headers.forEach((header, index) => {
        rowData[header || `عمود ${index + 1}`] = row[index] || ""; // استخدام أسماء الأعمدة أو تسمية الأعمدة غير المسماة
      });
      data.push(rowData);
    });
  });
  return data;
}

// وظيفة للبحث في العمود الأول أو الثاني
function searchExcelData(data, query) {
  return data.filter(row => {
    const columns = Object.keys(row); // أسماء الأعمدة
    return (
      String(row[columns[0]] || "").toLowerCase().includes(query.toLowerCase()) || // البحث في العمود الأول
      String(row[columns[1]] || "").toLowerCase().includes(query.toLowerCase())    // البحث في العمود الثاني
    );
  });
}

// استلام الطلبات عبر Webhook
app.post('/bot', (req, res) => {
  const msg = req.body.message;
  const chatId = msg.chat.id;
  const query = msg.text; // نص البحث من المستخدم

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
        message += `${key}: ${row[key]}\n`; // اسم العمود + القيمة
      });
      message += "\n"; // مسافة بين السجلات
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

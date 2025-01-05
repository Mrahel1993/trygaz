const TelegramBot = require('node-telegram-bot-api');
const XLSX = require('xlsx');
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// إعداد سيرفر Express
const app = express();
const port = process.env.PORT || 4000;

// API token الخاص بك
const token = '7892619179:AAEM4EGEnxVZP7q6DZkrReGw3ND5ea2R3OI';
const bot = new TelegramBot(token, { webHook: true });

// إعداد Webhook
const webhookUrl = 'https://ifhasbot.onrender.com'; // استبدل بـ URL الخاص بك
bot.setWebHook(`${webhookUrl}/bot`);

app.use(bodyParser.json());
app.get('/', (req, res) => {
  res.send('The server is running successfully.');
});

// قراءة بيانات Excel عند بدء تشغيل التطبيق
const excelFolder = './excelFiles'; // اسم المجلد الذي يحتوي على ملفات Excel
let excelData = readExcelData(excelFolder);

// وظيفة لقراءة البيانات من ملفات Excel في مجلد معين
function readExcelData(folderPath) {
  let data = [];
  
  // قراءة جميع الملفات في المجلد
  const files = fs.readdirSync(folderPath).filter(file => file.endsWith('.xlsx')); // قراءة ملفات Excel فقط

  files.forEach(file => {
    const filePath = path.join(folderPath, file);
    const stats = fs.statSync(filePath);  // الحصول على معلومات الملف
    const modificationDate = stats.mtime; // تاريخ آخر تعديل
    const formattedDate = modificationDate.toLocaleDateString('ar-EG') + ' ' + modificationDate.toLocaleTimeString('ar-EG'); // تنسيق التاريخ والوقت

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    const headers = json[0];
    const rows = json.slice(1);

    rows.forEach(row => {
      let rowData = {};
      headers.forEach((header, index) => {
        rowData[header || `عمود ${index + 1}`] = row[index] || "";
      });
      rowData._fileName = file;  // إضافة اسم الملف
      rowData._modificationDate = formattedDate;  // إضافة تاريخ آخر تعديل
      data.push(rowData);
    });
  });

  return data;
}

// البحث في البيانات
function searchExcelData(data, query) {
  return data.filter(row => {
    const columns = Object.keys(row);
    return (
      String(row[columns[0]] || "").toLowerCase().includes(query.toLowerCase()) ||
      String(row[columns[1]] || "").toLowerCase().includes(query.toLowerCase())
    );
  });
}

// اتصال MongoDB Atlas
const mongoURI = 'mongodb+srv://mrahel1993:7Am7dkIitbpVN9Oq@cluster0.rjekk.mongodb.net/userDBifhas?retryWrites=true&w=majority';
mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB Atlas'))
.catch(err => console.error('MongoDB connection error:', err));

// تعريف مخطط المستخدمين
const userSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true },
  username: String,
  firstName: String,
  lastName: String,
  languageCode: String, // اللغة التي يستخدمها المستخدم
  bio: String, // السيرة الذاتية (إذا كانت موجودة)
  phoneNumber: String, // رقم الهاتف (إذا شاركه المستخدم)
  isBot: Boolean, // هل المستخدم هو بوت أو شخص حقيقي
  chatId: Number, // معرّف المحادثة
  joinedAt: { type: Date, default: Date.now }, // تاريخ الانضمام
});

const User = mongoose.model('User', userSchema);

// إضافة خيارات الأزرار الجديدة

const adminIds = process.env.ADMIN_IDS?.split(',') || ['7719756994'];   // قائمة معرفات المسؤولين
const adminState = {};  // حالة المسؤولين الذين يرسلون رسائل جماعية

const options = {
    reply_markup: {
        keyboard: [
            [{ text: "🔍 البحث" }], 
            [{ text: "📞 معلومات الاتصال" }, { text: "📖 معلومات عن البوت" }],
        ],
        resize_keyboard: true,
        one_time_keyboard: false,
    },
};

bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  if (adminIds.includes(chatId.toString())) {
      options.reply_markup.keyboard.push([{ text: "📢 إرسال رسالة للجميع" }]);
  }
  bot.sendMessage(chatId, "مرحبًا بك! اختر أحد الخيارات التالية:", options);
});

// استقبال الرسائل عبر Webhook
app.post('/bot', async (req, res) => {
  if (!req.body.message || !req.body.message.text) {
    return res.status(200).send('No valid message received.');
  }

  const msg = req.body.message;
  const chatId = msg.chat.id;
  const query = msg.text;

  // حفظ بيانات المستخدم في قاعدة البيانات
  const userData = {
    telegramId: msg.from.id,
    username: msg.from.username || "No Username",  // اسم المستخدم
    firstName: msg.from.first_name || "No First Name",  // الاسم الأول
    lastName: msg.from.last_name || "No Last Name",  // الاسم الأخير
    languageCode: msg.from.language_code || "en",  // اللغة
    bio: msg.from.bio || "No Bio",  // السيرة الذاتية
    phoneNumber: msg.contact ? msg.contact.phone_number : null,  // رقم الهاتف (إذا شاركه المستخدم)
    isBot: msg.from.is_bot,  // إذا كان المستخدم بوت
    chatId: msg.chat.id,  // معرّف المحادثة
  };

  try {
    let user = await User.findOne({ telegramId: msg.from.id });
    if (!user) {
      user = new User(userData);
      await user.save();
      console.log(`User ${msg.from.id} saved to database.`);
    } else {
      console.log(`User ${msg.from.id} already exists.`);
    }
  } catch (err) {
    console.error('Error saving user to database:', err);
  }

  if (query === '/start') {
    bot.sendMessage(chatId, "مرحبًا بك! اختر أحد الخيارات التالية:", options);
    return res.status(200).send('OK');
  }

  if (query === "🔍 البحث برقم الهوية أو الاسم") {
    bot.sendMessage(chatId, "📝  للبحث:");
    return res.status(200).send('OK');
  } else if (query === "📞 معلومات الاتصال") {
    const contactMessage = 
`📞 **معلومات الاتصال:**
للمزيد من الدعم أو الاستفسار
في حال حدوث اي خلل
يمكنك التواصل معنا عبر:
💬 تلجرام: [https://t.me/AhmedGarqoud]`;
    bot.sendMessage(chatId, contactMessage, { parse_mode: 'Markdown' });
    return res.status(200).send('OK');
  } else if (query === "📖 معلومات عن البوت") {
    const aboutMessage = 
`🤖 **معلومات عن البوت:**
هذا البوت يتيح لك البحث عن اسمك في كشوفات الغاز باستخدام رقم الهوية أو اسمك كما هو مسجل في كشوفات الغاز.
- يتم عرض تفاصيل اسمك بما في ذلك بيانات الموزع وحالة طلبك.
هدفنا هو تسهيل الوصول إلى بيانتات.
هذا بوت مجهود شخصي ولا يتبع لاي جهة.
🔧 **التطوير والصيانة**: تم تطوير هذا البوت بواسطة [احمد محمد].`;
    bot.sendMessage(chatId, aboutMessage, { parse_mode: 'Markdown' });
    return res.status(200).send('OK');
  }

  if (query === "📢 إرسال رسالة للجميع" && adminIds.includes(chatId.toString())) {
    adminState[chatId] = 'awaiting_broadcast_message';
    bot.sendMessage(chatId, "✉️ اكتب الرسالة التي تريد إرسالها لجميع المستخدمين، ثم اضغط على إرسال:");
    return res.status(200).send('OK');
  }

  if (adminState[chatId] === 'awaiting_broadcast_message') {
    delete adminState[chatId]; // إزالة الحالة بعد استلام الرسالة
    await sendBroadcastMessage(query, chatId);
    return res.status(200).send('OK');
  }

  // البحث في البيانات
  if (query && query.trim() !== "") {
    const results = searchExcelData(excelData, query);

    if (results.length === 0) {
      bot.sendMessage(chatId, "لم يتم العثور على نتائج تطابق البحث.");
    } else {
        results.sort((a, b) => new Date(b._modificationDate) - new Date(a._modificationDate));
      results.forEach(row => {
        let message = "نتائج البحث:\n\n";

        // عرض البيانات بدون _fileName و _modificationDate
        Object.keys(row).forEach(key => {
          if (key !== '_fileName' && key !== '_modificationDate') {
            message += `${key}: ${row[key]}\n`;
          }
        });

        // عرض اسم الملف وتاريخ التعديل بشكل منفصل
        message += `\n **اسم الملف**: ${row._fileName}\n `;

        bot.sendMessage(chatId, message);
      });
    }
  }

  res.status(200).send('OK');
});

app.listen(port, () => {
  console.log(`Webhook server is running on port ${port}`);
});

async function sendBroadcastMessage(message, chatId) {
  try {
    const users = await User.find();
    users.forEach(user => {
      if (user.telegramId !== chatId) { // لا نرسل الرسالة للمسؤول نفسه
        bot.sendMessage(user.chatId, message);
      }
    });
    console.log(`Broadcast message sent: ${message}`);
  } catch (err) {
    console.error('Error sending broadcast message:', err);
  }
}

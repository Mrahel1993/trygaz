// جعل الاكسل ديناميكي لا يعتمد على الاعمدة
const TelegramBot = require('node-telegram-bot-api');
const ExcelJS = require('exceljs');
const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// إعداد السيرفر Express
const app = express();
const port = process.env.PORT || 4000;

app.use(express.json()); // لتلقي الطلبات بتنسيق JSON

app.get('/', (req, res) => {
    res.send('The server is running successfully.');
});

// استبدال التوكن الخاص بك
const token = process.env.TELEGRAM_BOT_TOKEN || '7742968603:AAFD-02grJl4Kt2V9b6Z-AxaCbwopEx_zZU';

// إنشاء البوت
const bot = new TelegramBot(token, { polling: false });

const webhookUrl = process.env.WEBHOOK_URL || 'https://trygaz.onrender.com';
bot.setWebHook(`${webhookUrl}/bot${token}`);

app.post(`/bot${token}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// تخزين البيانات من Excel
let data = [];
let adminState = {}; // لتتبع حالة المسؤولين أثناء إرسال الرسائل

// اتصال MongoDB Atlas
const mongoURI = 'mongodb+srv://mrahel1993:7Am7dkIitbpVN9Oq@cluster0.rjekk.mongodb.net/userDB11?retryWrites=true&w=majority';
mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(() => console.log('Connected to MongoDB Atlas'))
    .catch(err => console.error('MongoDB connection error:', err));

// تعريف مخطط المستخدمين في MongoDB
const userSchema = new mongoose.Schema({
    telegramId: { type: Number, required: true, unique: true },
    username: String,
    firstName: String,
    lastName: String,
    languageCode: String,
    bio: String,
    phoneNumber: String,
    isBot: Boolean,
    chatId: Number,
    joinedAt: { type: Date, default: Date.now },
});

const User = mongoose.model('User', userSchema);
/ دالة لتحميل البيانات من ملفات Excel في مجلد معين
async function loadExcelFilesFromDirectory(directoryPath) {
    data = []; // إعادة تعيين البيانات في كل مرة
    try {
        const files = fs.readdirSync(directoryPath);
        const excelFiles = files.filter(file => file.endsWith('.xlsx') || file.endsWith('.xls'));

        if (excelFiles.length === 0) {
            console.log('❌ لم يتم العثور على أي ملفات Excel في المجلد المحدد.');
            sendMessageToAdmins("❌ لم يتم العثور على أي ملفات Excel في المجلد المحدد.");
            return;
        }

        for (const file of excelFiles) {
            const filePath = path.join(directoryPath, file);
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(filePath);
            const worksheet = workbook.worksheets[0];

            const fileStats = fs.statSync(filePath);
            const lastModifiedDate = fileStats.mtime.toISOString().split('T')[0];

            // قراءة رؤوس الأعمدة
            const headers = worksheet.getRow(1).values;

            worksheet.eachRow((row, rowIndex) => {
                if (rowIndex === 1) return; // تخطي صف الرؤوس
                const rowData = {};

                // استخدام الرؤوس لتحديد الأعمدة
                headers.forEach((header, index) => {
                    // التحقق من وجود قيمة للخلية
                    const value = row.getCell(index + 1).value?.toString().trim() || "غير متوفر";
                    rowData[header] = value;
                });

                // إضافة تاريخ التسليم
                rowData['deliveryDate'] = lastModifiedDate;

                // إضافة البيانات إلى المصفوفة إذا كان هناك رقم هوية
                if (rowData['idNumber']) {
                    data.push(rowData);
                }
            });
        }

        console.log('📁 تم تحميل البيانات من جميع ملفات Excel بنجاح.');
        sendMessageToAdmins("📢 تم تحديث البيانات من جميع ملفات Excel في المجلد بنجاح!");
    } catch (error) {
        console.error('❌ حدث خطأ أثناء قراءة ملفات Excel:', error.message);
        sendMessageToAdmins("❌ حدث خطأ أثناء قراءة ملفات Excel.");
    }
}

// استدعاء الدالة لتحميل الملفات من مجلد
const excelDirectory = path.join(__dirname, 'data'); // استبدل 'data' بمسار مجلدك
loadExcelFilesFromDirectory(excelDirectory);

// قائمة معرفات المسؤولين
const adminIds = process.env.ADMIN_IDS?.split(',') || ['7719756994'];

// الرد على أوامر البوت
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;

    const options = {
        reply_markup: {
            keyboard: [
                [{ text: "🔍 البحث برقم الهوية أو الاسم" }],
                [{ text: "📞 معلومات الاتصال" }, { text: "📖 معلومات عن البوت" }],
            ],
            resize_keyboard: true,
            one_time_keyboard: false,
        },
    };

    if (adminIds.includes(chatId.toString())) {
        options.reply_markup.keyboard.push([{ text: "📢 إرسال رسالة للجميع" }]);
    }

    bot.sendMessage(chatId, "مرحبًا بك! اختر أحد الخيارات التالية:", options);
});

// التعامل مع الضغط على الأزرار والبحث
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const input = msg.text.trim();

    if (input === '/start' || input.startsWith('/')) return;

    if (input === "🔍 البحث برقم الهوية أو الاسم") {
        bot.sendMessage(chatId, "📝 أدخل رقم الهوية أو الاسم للبحث:");
    } else if (input === "📞 معلومات الاتصال") {
        const contactMessage = `
📞 **معلومات الاتصال:**
للمزيد من الدعم أو الاستفسار
يمكنك التواصل معنا عبر:
💬 تلجرام: [https://t.me/AhmedGarqoud]
        `;
        bot.sendMessage(chatId, contactMessage, { parse_mode: 'Markdown' });
    } else if (input === "📖 معلومات عن البوت") {
        const aboutMessage = `
🤖 **معلومات عن البوت:**
هذا البوت يتيح لك البحث عن اسمك في كشوفات الغاز باستخدام رقم الهوية أو اسمك كما هو مسجل في كشوفات الغاز.
🔧 **التطوير والصيانة**: تم تطوير هذا البوت بواسطة [احمد محمد].
        `;
        bot.sendMessage(chatId, aboutMessage, { parse_mode: 'Markdown' });
    } else if (input === "📢 إرسال رسالة للجميع" && adminIds.includes(chatId.toString())) {
        adminState[chatId] = 'awaiting_broadcast_message';
        bot.sendMessage(chatId, "✉️ اكتب الرسالة التي تريد إرسالها لجميع المستخدمين، ثم اضغط على إرسال:");
    } else if (adminState[chatId] === 'awaiting_broadcast_message') {
        delete adminState[chatId]; // إزالة الحالة بعد استلام الرسالة
        await sendBroadcastMessage(input, chatId);
    } else {
        const user = data.find((entry) => entry.idNumber === input || entry.name === input);

        if (user) {
            // إنشاء رسالة ديناميكية لعرض النتائج
            let response = "🔍 **تفاصيل الطلب:**\n\n";
            for (const [key, value] of Object.entries(user)) {
                // تحويل أسماء الأعمدة إلى عناوين مفهومة
                const formattedKey = key
                    .replace(/([A-Z])/g, ' $1') // إضافة مسافة قبل الأحرف الكبيرة
                    .replace(/^./, str => str.toUpperCase()); // تحويل أول حرف إلى كبير
                response += `**${formattedKey}**: ${value || "غير متوفر"}\n`;
            }

            bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
        } else {
            bot.sendMessage(chatId, "⚠️ لم أتمكن من العثور على بيانات للمدخل المقدم.");
        }
    }

    // حفظ بيانات المستخدم في MongoDB
    const userData = {
        telegramId: msg.from.id,
        username: msg.from.username || "No Username",
        firstName: msg.from.first_name || "No First Name",
        lastName: msg.from.last_name || "No Last Name",
        languageCode: msg.from.language_code || "en",
        bio: msg.from.bio || "No Bio",
        phoneNumber: msg.contact ? msg.contact.phone_number : null,
        isBot: msg.from.is_bot,
        chatId: msg.chat.id,
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
});

// إرسال رسالة جماعية بناءً على قاعدة بيانات المستخدمين
async function sendBroadcastMessage(message, adminChatId) {
    try {
        // استعلام للحصول على جميع المستخدمين من قاعدة البيانات
        const users = await User.find({});

        // إرسال الرسالة لكل مستخدم
        for (const user of users) {
            try {
                await bot.sendMessage(user.telegramId, message);
            } catch (err) {
                console.error(`❌ فشل في إرسال الرسالة للمستخدم ${user.telegramId}:`, err.message);
            }
        }

        // تأكيد الإرسال للمسؤول
        bot.sendMessage(adminChatId, "✅ تم إرسال الرسالة لجميع المستخدمين بنجاح.");
    } catch (err) {
        console.error('❌ خطأ أثناء جلب المستخدمين من قاعدة البيانات:', err.message);
        bot.sendMessage(adminChatId, "❌ حدث خطأ أثناء إرسال الرسالة للجميع.");
    }
}

// إرسال تنبيه للمسؤولين
function sendMessageToAdmins(message) {
    adminIds.forEach(adminId => {
        bot.sendMessage(adminId, message);
    });
}

// تشغيل السيرفر
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

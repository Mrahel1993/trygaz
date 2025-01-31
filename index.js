const TelegramBot = require('node-telegram-bot-api');
const ExcelJS = require('exceljs');
const express = require('express');
const mongoose = require('mongoose');
const axios = require("axios");
const fs = require('fs'); // لإدارة الملفات
const path = require('path'); // للتعامل مع المسارات
require('dotenv').config();

//------------------------------------------------------------------------------------
// إعداد السيرفر Express
const app = express();
const port = process.env.PORT || 4000;
app.use(express.json()); // لتلقي الطلبات بتنسيق JSON
app.get('/', (req, res) => {
    res.send('The server is running successfully.');
});
//------------------------------------------------------------------------------------
// استبدال التوكن الخاص بك
const token = process.env.TELEGRAM_BOT_TOKEN || '7742968603:AAFD-02grJl4Kt2V9b6Z-AxaCbwopEx_zZU';
const bot = new TelegramBot(token, { polling: false });  // إنشاء البوت
const webhookUrl = process.env.WEBHOOK_URL || 'https://trygaz.onrender.com';
bot.setWebHook(`${webhookUrl}/bot${token}`);

app.post(`/bot${token}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});
//------------------------------------------------------------------------------------
// تخزين البيانات من Excel
let data = [];
let adminState = {}; // لتتبع حالة المسؤولين أثناء إرسال الرسائل
//------------------------------------------------------------------------------------
// اتصال MongoDB Atlas
const mongoURI = process.env.MONGO_URI || 'mongodb+srv://mrahel1993:7Am7dkIitbpVN9Oq@cluster0.rjekk.mongodb.net/userDBtrygaz?retryWrites=true&w=majority';
mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 30000,
})
    .then(() => console.log('Connected to MongoDB Atlas'))
    .catch(err => console.error('MongoDB connection error:', err));
//------------------------------------------------------------------------------------
// تعريف مخطط المستخدمين في MongoDB
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

//------------------------------------------------------------------------------------
// دالة لإزالة التشكيل وتوحيد النصوص
function normalizeArabicText(text) {
    if (!text) return '';

    // إزالة التشكيل (الحركات)
    const diacriticsRegex = /[\u0617-\u061A\u064B-\u0652]/g;
    let normalizedText = text.replace(diacriticsRegex, '');

    // توحيد الأحرف المتشابهة
    normalizedText = normalizedText.replace(/[أإآ]/g, 'ا'); // تحويل "أ", "إ", "آ" إلى "ا"
    normalizedText = normalizedText.replace(/ى/g, 'ي'); // تحويل "ى" إلى "ي"
    normalizedText = normalizedText.replace(/[ة]/g, 'ه'); // تحويل "ة" إلى "ه"
    normalizedText = normalizedText.replace(/[ؤئء]/g, 'ء'); // تحويل "ؤ", "ئ", "ء" إلى "ء"

    // توحيد الأرقام العربية إلى إنجليزية
    const arabicNumbers = [/٠/g, /١/g, /٢/g, /٣/g, /٤/g, /٥/g, /٦/g, /٧/g, /٨/g, /٩/g];
    const englishNumbers = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    arabicNumbers.forEach((pattern, index) => {
        normalizedText = normalizedText.replace(pattern, englishNumbers[index]);
    });

    // إزالة الرموز الخاصة
    normalizedText = normalizedText.replace(/[^\w\sء-ي]/g, '');

    // إزالة المسافات الزائدة
    normalizedText = normalizedText.replace(/\s+/g, ' ').trim();

    // تحويل النص إلى حروف صغيرة (إذا كان يحتوي على إنجليزية)
    normalizedText = normalizedText.toLowerCase();

    return normalizedText;
}


//------------------------------------------------------------------------------------
// دالة لقراءة جميع ملفات Excel من مجلد معين
async function loadDataFromExcelFolder(folderPath) {
    data = []; // إعادة تهيئة البيانات
    try {
        const files = fs.readdirSync(folderPath);  // قراءة جميع الملفات في المجلد

        // تصفية الملفات ذات الامتداد .xlsx
        const excelFiles = files.filter(file => path.extname(file).toLowerCase() === '.xlsx');

        if (excelFiles.length === 0) {
            console.log('❌ لا توجد ملفات Excel في المجلد المحدد.');
            return;
        }

        // قراءة كل ملف Excel
        for (const file of excelFiles) {
            const filePath = path.join(folderPath, file); // الحصول على المسار الكامل للملف
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(filePath);
            const worksheet = workbook.worksheets[0];

            const fileStats = fs.statSync(filePath);
            const lastModifiedDate = fileStats.mtime.toISOString().split('T')[0];

            worksheet.eachRow((row) => {
                const idNumber = row.getCell(1).value?.toString().trim();
                const name = row.getCell(2).value?.toString().trim();
                const province = row.getCell(3).value?.toString().trim();
                const district = row.getCell(4).value?.toString().trim();
                const area = row.getCell(5).value?.toString().trim();
                const distributorId = row.getCell(6).value?.toString().trim();
                const distributorName = row.getCell(7).value?.toString().trim();
                const distributorPhone = row.getCell(8).value?.toString().trim();
                const status = row.getCell(9).value?.toString().trim();

                if (idNumber && name) {
                    data.push({
                        idNumber,
                        name,
                        province: province || "غير متوفر",
                        district: district || "غير متوفر",
                        area: area || "غير متوفر",
                        distributorId: distributorId || "غير متوفر",
                        distributorName: distributorName || "غير متوفر",
                        distributorPhone: distributorPhone || "غير متوفر",
                        status: status || "غير متوفر",
                        deliveryDate: lastModifiedDate,
                        fileName: file,
                    });
                }
            });
        }

        console.log('📁 تم تحميل البيانات من جميع الملفات بنجاح.');
        sendMessageToAdmins("📢 تم تحديث البيانات من جميع الملفات بنجاح! يمكنك الآن البحث في البيانات المحدثة.");
    } catch (error) {
        console.error('❌ حدث خطأ أثناء قراءة ملفات Excel:', error.message);
    }
}

// استدعاء الدالة مع مجلد يحتوي على ملفات Excel
const excelFolderPath = './excel-files'; // استبدل بمسار المجلد الخاص بك
loadDataFromExcelFolder(excelFolderPath);

// قائمة معرفات المسؤولين
const adminIds = process.env.ADMIN_IDS?.split(',') || ['7719756994'];
//------------------------------------------------------------------------------------
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

    const axios = require("axios");

// إضافة زر "عرض عدد المستخدمين" والمزيد للمسؤولين فقط
if (adminIds.includes(chatId.toString())) {
    const inlineKeyboard = {
        reply_markup: {
            inline_keyboard: [
                [{ text: "📊 عرض عدد المستخدمين", callback_data: 'show_user_count' }],
                [{ text: "📈 إحصائيات البوت", callback_data: 'bot_statistics' }],
                [{ text: "🕌 مواقيت الصلاة", callback_data: 'prayer_times' }]
            ],
        },
    };
    bot.sendMessage(chatId, "مرحبًا بك! اختر أحد الخيارات التالية:", options);
    bot.sendMessage(chatId, "للإدارة، يمكنك استخدام الأزرار أدناه:", inlineKeyboard);
} else {
    bot.sendMessage(chatId, "مرحبًا بك! اختر أحد الخيارات التالية:", options);
}

// التعامل مع الضغط على الأزرار
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const callbackData = query.data;

    if (callbackData === 'show_user_count') {
        try {
            const userCount = await User.countDocuments();
            bot.sendMessage(chatId, `📊 عدد المستخدمين المسجلين في قاعدة البيانات هو: ${userCount}`);
        } catch (err) {
            console.error('❌ فشل في جلب عدد المستخدمين:', err.message);
            bot.sendMessage(chatId, "❌ حدث خطأ أثناء جلب عدد المستخدمين.");
        }
    } else if (callbackData === 'bot_statistics') {
        try {
            const now = new Date();
            const oneWeekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
            const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
            const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

            const weeklyUsers = await User.countDocuments({ joinedAt: { $gte: oneWeekAgo } });
            const monthlyUsers = await User.countDocuments({ joinedAt: { $gte: oneMonthAgo } });
            const yearlyUsers = await User.countDocuments({ joinedAt: { $gte: oneYearAgo } });

            const statisticsMessage = `
📈 **إحصائيات البوت:**
- 🗓️ المستخدمون الجدد هذا الأسبوع: ${weeklyUsers}
- 📅 المستخدمون الجدد هذا الشهر: ${monthlyUsers}
- 📆 المستخدمون الجدد هذا العام: ${yearlyUsers}
            `;
            bot.sendMessage(chatId, statisticsMessage, { parse_mode: 'Markdown' });
        } catch (err) {
            console.error('❌ فشل في جلب إحصائيات البوت:', err.message);
            bot.sendMessage(chatId, "❌ حدث خطأ أثناء جلب إحصائيات البوت.");
        }
    } else if (callbackData === 'prayer_times') {
        try {
            const response = await axios.get("http://api.aladhan.com/v1/timingsByCity", {
                params: {
                    city: "Gaza", // غيّر المدينة حسب الحاجة
                    country: "PS",
                    method: 4
                }
            });

            const data = response.data.data;
            const hijriDate = data.date.hijri;
            const gregorianDate = data.date.gregorian;
            const timings = data.timings;

            const message = `🕌 *مواقيت الصلاة لهذا اليوم* 🌙

📅  *${hijriDate.weekday.ar}* ${hijriDate.day} ${hijriDate.month.ar} ${hijriDate.year}هـ  
الموافق *${gregorianDate.day} ${gregorianDate.month.en} ${gregorianDate.year} م*

🌟 الفجر: ${timings.Fajr}  
☀️ الشروق: ${timings.Sunrise}  
🕰 الظهر: ${timings.Dhuhr}  
🌇 العصر: ${timings.Asr}  
🌆 المغرب: ${timings.Maghrib}  
🌌 العشاء: ${timings.Isha}`;

            bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
        } catch (error) {
            console.error("❌ خطأ في جلب مواقيت الصلاة:", error);
            bot.sendMessage(chatId, "❌ حدث خطأ أثناء جلب مواقيت الصلاة، حاول مرة أخرى لاحقًا.");
        }
    }
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
في حال حدوث اي خلل
يمكنك التواصل معنا عبر:
💬 تلجرام: [https://t.me/AhmedGarqoud]
        `;
        bot.sendMessage(chatId, contactMessage, { parse_mode: 'Markdown' });
    } else if (input === "📖 معلومات عن البوت") {
        const aboutMessage = `
🤖 **معلومات عن البوت:**
هذا البوت يتيح لك البحث عن اسمك في كشوفات الغاز باستخدام رقم الهوية أو اسمك كما هو مسجل في كشوفات الغاز.
- يتم عرض تفاصيل اسمك بما في ذلك بيانات الموزع وحالة طلبك.
هدفنا هو تسهيل الوصول إلى بيانتات.
هذا بوت مجهود شخصي ولا يتبع لاي جهة.
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
        // تحسين البحث ليشمل تطبيع النصوص
        const normalizedInput = normalizeArabicText(input); // تطبيع الإدخال
        const matchingRecords = data.filter((entry) => {
            const normalizedName = normalizeArabicText(entry.name); // تطبيع الأسماء المخزنة
            return (
                entry.idNumber === input ||
                normalizedName.includes(normalizedInput) // البحث المتوافق
            );
        });


       if (matchingRecords.length > 0) {
            const user = matchingRecords[0]; // استخدام أول نتيجة مطابقة
            const response = `
🔍 **تفاصيل الطلب:**

👤 **الاسم**: ${user.name}
🏘️ **الحي / المنطقة**: ${user.area}
🏙️ **المدينة**: ${user.district}
📍 **المحافظة**: ${user.province}

📛 **اسم الموزع**: ${user.distributorName}
📞 **رقم جوال الموزع**: ${user.distributorPhone}
🆔 **هوية الموزع**: ${user.distributorId}

📜 **الحالة**: ${user.status}
📄 **اسم الملف**: ${user.fileName}
            `;
            bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
        } else {
           // إضافة اسم الملف إلى الرسالة عند عدم العثور على البيانات
            const filesInFolder = fs.readdirSync(excelFolderPath).filter(file => path.extname(file).toLowerCase() === '.xlsx');
            const fileNames = filesInFolder.join(', '); // عرض أسماء جميع الملفات
            bot.sendMessage(chatId, `  ⚠️ لم أتمكن من العثور على بيانات للمدخل المقدم. تم البحث في الملفات:  ${fileNames}  `);
        }
    }
//------------------------------------------------------------------------------------
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
//------------------------------------------------------------------------------------
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
//------------------------------------------------------------------------------------
// إرسال تنبيه للمسؤولين
function sendMessageToAdmins(message) {
    adminIds.forEach(adminId => {
        bot.sendMessage(adminId, message);
    });
}
//------------------------------------------------------------------------------------
// تشغيل السيرفر
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

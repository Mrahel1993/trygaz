// استيراد المكتبات اللازمة
const TelegramBot = require('node-telegram-bot-api');
const { InlineKeyboardMarkup, InlineKeyboardButton } = require('node-telegram-bot-api');
const ExcelJS = require('exceljs');
const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// إعداد السيرفر Express
const app = express();
const port = process.env.PORT || 4000;
app.use(express.json());

app.get('/', (req, res) => {
    res.send('The server is running successfully.');
});

// إعدادات البوت
const token = process.env.TELEGRAM_BOT_TOKEN || '7742968603:AAFD-02grJl4Kt2V9b6Z-AxaCbwopEx_zZU';
const bot = new TelegramBot(token, { polling: false });
const webhookUrl = process.env.WEBHOOK_URL || 'https://trygaz.onrender.com';
bot.setWebHook(`${webhookUrl}/bot${token}`);

// تخزين البيانات من Excel
let data = [];
let adminState = {}; // لتتبع حالة المسؤولين أثناء إرسال الرسائل

// إعداد اتصال MongoDB
const mongoURI = process.env.MONGO_URI;
mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 30000,
})
.then(() => console.log('Connected to MongoDB Atlas'))
.catch(err => console.error('MongoDB connection error:', err));

// إعادة الاتصال تلقائيًا في حال فقدان الاتصال
mongoose.connection.on('disconnected', () => {
    console.log('MongoDB connection lost. Reconnecting...');
    mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
        .then(() => console.log('Reconnected to MongoDB Atlas'))
        .catch(err => console.error('Failed to reconnect to MongoDB Atlas:', err));
});

// التعامل مع أخطاء الاتصال بشكل عام
mongoose.connection.on('error', err => {
    console.error('MongoDB connection error:', err);
});

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

// دالة لتحسين التعامل مع البيانات المفقودة أو غير الصالحة
const cleanData = (value) => {
    if (value === null || value === undefined || value === "") {
        return "غير متوفر";
    }
    return value.toString().trim() || "غير متوفر";
};

// دالة لإزالة التشكيل وتوحيد النصوص
function normalizeArabicText(text) {
    if (!text) return '';
    const diacriticsRegex = /[\u0617-\u061A\u064B-\u0652]/g;
    let normalizedText = text.replace(diacriticsRegex, '');
    normalizedText = normalizedText.replace(/[أإآ]/g, 'ا');
    normalizedText = normalizedText.replace(/ى/g, 'ي');
    normalizedText = normalizedText.replace(/[ة]/g, 'ه');
    normalizedText = normalizedText.replace(/\s+/g, ' ').trim();
    return normalizedText;
}

// دالة لتحميل البيانات من جميع ملفات Excel في مجلد معين
async function loadDataFromExcelFolder(folderPath) {
    data = [];
    try {
        const fileNames = fs.readdirSync(folderPath).filter(file => file.endsWith('.xlsx'));
        for (const fileName of fileNames) {
            const filePath = path.join(folderPath, fileName);
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
                        _fileName: fileName,
                        lastModifiedDate: lastModifiedDate,
                    });
                }
            });
        }
        console.log('📁 تم تحميل البيانات من جميع الملفات بنجاح.');
        sendMessageToAdmins("📢 تم تحديث البيانات من جميع الملفات بنجاح! يمكنك الآن البحث في البيانات المحدثة.");
    } catch (error) {
        console.error('❌ حدث خطأ أثناء قراءة ملفات Excel:', error.message);
        sendMessageToAdmins(`❌ حدث خطأ أثناء قراءة ملفات Excel: ${error.message}`);
    }
}

// تحسين Logging للأخطاء
function logError(error, source = '') {
    console.error(`❌ [${new Date().toISOString()}] ${source ? source + " - " : ""}${error.message}`);
}

// استدعاء الدالة مع مسار المجلد
const excelFolderPath = './excel-files';
loadDataFromExcelFolder(excelFolderPath);

// قائمة معرفات المسؤولين
const adminIds = process.env.ADMIN_IDS?.split(',') || ['7719756994'];

// التعامل مع أوامر البوت
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const isAdmin = adminIds.includes(chatId.toString());
    const mainKeyboard = createMainKeyboard(isAdmin);
    bot.sendMessage(chatId, "مرحبًا بك! اختر أحد الخيارات التالية:", mainKeyboard);

    if (isAdmin) {
        const adminInlineKeyboard = createAdminInlineKeyboard();
        bot.sendMessage(chatId, "⚙️ خيارات إدارة البوت:", adminInlineKeyboard);
    }
});

// التعامل مع الرسائل النصية
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text.trim();
    const isAdmin = adminIds.includes(chatId.toString());

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
        await saveUserWithRetry(userData);
    } catch (err) {
        console.error('Error saving user to database:', err);
    }

    if (text === "Menu") {
        const menuKeyboard = createMenuKeyboard();
        bot.sendMessage(chatId, "اختر أحد الخيارات من القائمة:", menuKeyboard);
    } else if (text === "الرجوع") {
        const mainKeyboard = createMainKeyboard(isAdmin);
        bot.sendMessage(chatId, "مرحبًا بك! اختر أحد الخيارات التالية:", mainKeyboard);
    } else if (text === "⚙️ إدارة البوت" && isAdmin) {
        const adminInlineKeyboard = createAdminInlineKeyboard();
        bot.sendMessage(chatId, "⚙️ خيارات إدارة البوت:", adminInlineKeyboard);
    } else if (adminState[chatId] === 'awaiting_broadcast_message') {
        delete adminState[chatId];
        await sendBroadcastMessage(text, chatId);
    } else {
        await handleUserInput(chatId, text);
    }
});

// دالة لإنشاء لوحة المفاتيح الرئيسية
function createMainKeyboard(isAdmin) {
    const keyboard = [
        [{ text: "🔍 البحث برقم الهوية أو الاسم" }],
        [{ text: "📞 معلومات الاتصال" }, { text: "📖 معلومات عن البوت" }],
        [{ text: "قائمة خدماتنا" }]
    ];

    if (isAdmin) {
        keyboard.push([{ text: "📢 إرسال رسالة للجميع" }, { text: "⚙️ إدارة البوت" }]);
    }

    return {
        reply_markup: {
            keyboard,
            resize_keyboard: true,
            one_time_keyboard: false,
        },
    };
}

// دالة لإنشاء لوحة مفاتيح الإدارة
function createAdminInlineKeyboard() {
    return {
        reply_markup: {
            inline_keyboard: [
                [{ text: "📊 عرض عدد المستخدمين", callback_data: 'show_user_count' }],
                [{ text: "📈 إحصائيات البوت", callback_data: 'bot_statistics' }],
                [{ text: "📝 إعدادات أخرى", callback_data: 'other_settings' }]
            ],
        },
    };
}

// دالة لإنشاء لوحة مفاتيح القائمة
function createMenuKeyboard() {
    return {
        reply_markup: {
            keyboard: [
                [{ text: "ابدأ البحث" }, { text: "الرجوع" }]
            ],
            resize_keyboard: true,
            one_time_keyboard: false,
        },
    };
}

// دالة لجلب إحصائيات البوت
async function getBotStatistics() {
    const now = new Date();
    const oneWeekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

    const weeklyUsers = await User.countDocuments({ joinedAt: { $gte: oneWeekAgo } });
    const monthlyUsers = await User.countDocuments({ joinedAt: { $gte: oneMonthAgo } });
    const yearlyUsers = await User.countDocuments({ joinedAt: { $gte: oneYearAgo } });

    return `
📈 **إحصائيات البوت:**
- 🗓️ المستخدمون الجدد هذا الأسبوع: ${weeklyUsers}
- 📅 المستخدمون الجدد هذا الشهر: ${monthlyUsers}
- 📆 المستخدمون الجدد هذا العام: ${yearlyUsers}
    `;
}

// دالة للتعامل مع البحث والضغط على الأزرار
async function handleUserInput(chatId, input) {
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
    } else {
        const normalizedInput = normalizeArabicText(input);
        const matchingRecords = data.filter((entry) => {
            const normalizedName = normalizeArabicText(entry.name);
            return (
                entry.idNumber === input ||
                normalizedName.includes(normalizedInput)
            );
        });

        if (matchingRecords.length > 0) {
            matchingRecords.sort((a, b) => a._fileName.localeCompare(b._fileName));
            for (const [index, record] of matchingRecords.entries()) {
                const resultMessage = `
📄 **نتيجة ${index + 1}:**
👤 **الاسم**: ${record.name}
🏘️ **الحي / المنطقة**: ${record.area}
🏙️ **المدينة**: ${record.district}
📍 **المحافظة**: ${record.province}

📛 **اسم الموزع**: ${record.distributorName}
📞 **رقم جوال الموزع**: ${record.distributorPhone}
🆔 **هوية الموزع**: ${record.distributorId}

📜 **الحالة**: ${record.status}
📂 **اسم الملف**: ${record._fileName}
📅 **تاريخ التعديل الأخير**: ${record.lastModifiedDate}
                `;
                await bot.sendMessage(chatId, resultMessage, { parse_mode: 'Markdown' });
            }
        } else {
            bot.sendMessage(chatId, "⚠️ لم أتمكن من العثور على بيانات للمدخل المقدم.");
        }
    }
}

// دالة لإعادة المحاولة عند حدوث خطأ
async function retryOperation(operation, retries = 3, delay = 2000, operationName = 'عملية') {
    let attempt = 0;
    while (attempt < retries) {
        try {
            return await operation();
        } catch (error) {
            attempt++;
            logError(error, `${operationName} - محاولة ${attempt}`);
            if (attempt < retries) {
                console.log(`⏳ إعادة المحاولة بعد ${delay / 1000} ثواني...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                console.error('❌ تم استنفاد المحاولات.');
                throw error;
            }
        }
    }
}

// دالة لحفظ بيانات المستخدم في MongoDB مع إعادة المحاولة عند حدوث خطأ
async function saveUserWithRetry(userData) {
    await retryOperation(async () => {
        let user = await User.findOne({ telegramId: userData.telegramId });
        if (!user) {
            user = new User(userData);
            await user.save();
            console.log(`User ${userData.telegramId} saved to database.`);
        } else {
            console.log(`User ${userData.telegramId} already exists.`);
        }
    });
}

// دالة لإرسال رسالة مع إعادة المحاولة في حال حدوث خطأ
async function sendMessageWithRetry(chatId, message) {
    await retryOperation(() => bot.sendMessage(chatId, message));
}

// دالة لإرسال رسالة جماعية بناءً على قاعدة بيانات المستخدمين
async function sendBroadcastMessage(message, adminChatId) {
    const failedUsers = [];
    try {
        const users = await User.find({});
        for (const user of users) {
            try {
                await retryOperation(() => bot.sendMessage(user.telegramId, message), 3, 2000);
            } catch (err) {
                console.error(`❌ فشل في إرسال الرسالة للمستخدم ${user.telegramId}:`, err.message);
                failedUsers.push(user.telegramId);
            }
        }
        bot.sendMessage(adminChatId, "✅ تم إرسال الرسالة لجميع المستخدمين بنجاح.");
        if (failedUsers.length > 0) {
            bot.sendMessage(adminChatId, `❌ فشل إرسال الرسالة إلى المستخدمين التاليين: ${failedUsers.join(', ')}`);
        }
    } catch (err) {
        console.error('❌ خطأ أثناء جلب المستخدمين من قاعدة البيانات:', err.message);
        bot.sendMessage(adminChatId, "❌ حدث خطأ أثناء إرسال الرسالة للجميع.");
    }
}

// دالة لإرسال تنبيه للمسؤولين
function sendMessageToAdmins(message) {
    adminIds.forEach(adminId => {
        bot.sendMessage(adminId, message);
    });
}

// تشغيل السيرفر
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

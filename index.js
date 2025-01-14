const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
const port = process.env.PORT || 4000;

app.use(express.json());

// استبدال التوكن الخاص بك
const token = process.env.TELEGRAM_BOT_TOKEN || '7742968603:AAFD-02grJl4Kt2V9b6Z-AxaCbwopEx_zZU';
const webhookUrl = process.env.WEBHOOK_URL || 'https://trygaz.onrender.com';

//-------------------------------------------
const bot = new TelegramBot(token, { polling: false });
// عند بدء تشغيل البوت، أرسل رسالة ترحيب للمستخدمين الجدد
bot.on('polling_error', (error) => {
  console.log(`Polling error: ${error.code}`);
});
// تعيين الـ webhook
axios.post(`https://api.telegram.org/bot${token}/setWebhook`, {
    url: `${webhookUrl}/bot${token}`
}).then(() => {
    console.log('Webhook set successfully');
}).catch((error) => {
    console.error('Error setting webhook:', error);
});

//-------------------------------------------

// قائمة معرفات المسؤولين
const adminIds = process.env.ADMIN_IDS?.split(',') || ['7719756994'];

//-------------------------------------------
// اتصال MongoDB Atlas
const mongoURI = 'mongodb+srv://mrahel1993:7Am7dkIitbpVN9Oq@cluster0.rjekk.mongodb.net/userDBtrygaz?retryWrites=true&w=majority';
mongoose.connect(mongoURI, {useNewUrlParser: true, useUnifiedTopology: true,serverSelectionTimeoutMS: 30000, })  // 30 ثانية
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

//-------------------------------------------
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
// تخزين البيانات من Excel
let data = [];
let adminState = {}; // لتتبع حالة المسؤولين أثناء إرسال الرسائل

// استدعاء الدالة مع مسار المجلد
const excelFolderPath = './excel-files'; // استبدل بمسار المجلد الخاص بك
loadDataFromExcelFolder(excelFolderPath);

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
                        _fileName: fileName,  // إضافة اسم الملف
                        lastModifiedDate: lastModifiedDate,  // إضافة تاريخ آخر تعديل
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


//-------------------------------------------
// إرسال رسالة جماعية بناءً على قاعدة بيانات المستخدمين
async function sendBroadcastMessage(message, adminChatId) {
    const failedUsers = [];  // لتخزين المستخدمين الذين فشل الإرسال إليهم

    try {
        // استعلام للحصول على جميع المستخدمين من قاعدة البيانات
        const users = await User.find({});
        
        // إرسال الرسالة لكل مستخدم مع إعادة المحاولة في حال الفشل
         for (const user of users) {
            try {
                await retryOperation(() => axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
                    chat_id: user.telegramId,
                    text: message
                }), 3, 2000); // إعادة المحاولة 3 مرات
            } catch (err) {
                console.error(`❌ فشل في إرسال الرسالة للمستخدم ${user.telegramId}:`, err.message);
                failedUsers.push(user.telegramId); // إضافة المستخدم إلى قائمة الفشل
            }
        }

         // تأكيد الإرسال للمسؤول
        await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
            chat_id: adminChatId,
            text: "✅ تم إرسال الرسالة لجميع المستخدمين بنجاح."
        });

        // إذا كان هناك مستخدمون فشل إرسال الرسالة إليهم
        if (failedUsers.length > 0) {
            await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
                chat_id: adminChatId,
                text: `❌ فشل إرسال الرسالة إلى المستخدمين التاليين: ${failedUsers.join(', ')}`
            });
        }
    } catch (err) {
        console.error('❌ خطأ أثناء جلب المستخدمين من قاعدة البيانات:', err.message);
        await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
            chat_id: adminChatId,
            text: "❌ حدث خطأ أثناء إرسال الرسالة للجميع."
        });
    }
}

//-------------------------------------------
// دالة لإنشاء لوحة المفاتيح الرئيسية
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const input = msg.text.trim();

    // الخيارات الأساسية للمستخدمين
    if (input === '/start') {
    const options = {
        reply_markup: {
            keyboard: [
                [{ text: "🔍 البحث برقم الهوية أو الاسم" }],
                [{ text: "📞 الدعم أو الاستفسار" }, { text: "📖 معلومات عن البوت" }],
            ],
            resize_keyboard: true,
            one_time_keyboard: false,
        },
    };

    // إضافة خيارات الإدارة إذا كان المستخدم مسؤولاً
    if (adminIds.includes(chatId.toString())) {
        options.reply_markup.keyboard.push([
            { text: "📢 إرسال رسالة للجميع" },
            { text: "⚙️ لوحة التحكم" },
        ]);
    }

    bot.sendMessage(chatId, "مرحبًا بك! اختر أحد الخيارات التالية:", options);
 return; // العودة لتجنب المعالجة المكررة
    }

    //-------------------------------------------

// التعامل مع خيارات لوحة التحكم
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const input = msg.text.trim();

    if (input === "⚙️ لوحة التحكم" && adminIds.includes(chatId.toString())) {
        const inlineKeyboard = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "📊 عرض عدد المستخدمين", callback_data: 'show_user_count' }],
                    [{ text: "📈 إحصائيات البوت", callback_data: 'bot_statistics' }],
                ],
            },
        };
        bot.sendMessage(chatId, "⚙️ لوحة التحكم: اختر أحد الخيارات التالية:", inlineKeyboard);
    }
});

//-------------------------------------------

// التعامل مع الضغط على زر عرض عدد المستخدمين وإحصائيات البوت
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const callbackData = query.data;

    try {
        if (callbackData === 'show_user_count') {
            const userCount = await User.countDocuments();
            bot.sendMessage(chatId, `📊 عدد المستخدمين المسجلين في قاعدة البيانات هو: ${userCount}`);
        } else if (callbackData === 'bot_statistics') {
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
        }
    } catch (err) {
        console.error('❌ فشل في جلب البيانات:', err.message);
        bot.sendMessage(chatId, "❌ حدث خطأ أثناء جلب البيانات.");
    }
});

//-------------------------------------------

// التعامل مع البحث والرسائل الأخرى
     if (input === '/start' || input.startsWith('/')) return;

    if (input === "🔍 البحث برقم الهوية أو الاسم") {
        bot.sendMessage(chatId, "📝 أدخل رقم الهوية أو الاسم للبحث:");
    } else if (input === "📞 الدعم أو الاستفسار") {
        const contactMessage = `
📞 **الدعم أو الاستفسار:**
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
        await sendBroadcastMessage(input, chatId);  // إرسال رسالة جماعية بناءً على قاعدة بيانات المستخدمين
    } else {
        const normalizedInput = normalizeArabicText(input); // تطبيع الإدخال
        const matchingRecords = data.filter((entry) => {
            const normalizedName = normalizeArabicText(entry.name); // تطبيع الأسماء المخزنة
            return (
                entry.idNumber === input ||
                normalizedName.includes(normalizedInput) // البحث المتوافق
            );
        });

        if (matchingRecords.length > 0) {
            matchingRecords.sort((a, b) => a._fileName.localeCompare(b._fileName));

            let response = `🔍 **تم العثور على ${matchingRecords.length} نتيجة للمدخل \"${input}\":**\n\n`;
            for (const [index, record] of matchingRecords.entries()) {
                const safeFileName = record._fileName.replace(/[_*]/g, '\\\\$&'); // للهروب من الرموز الخاصة
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
📂 **اسم الملف**: ${safeFileName}
                `;
                await bot.sendMessage(chatId, resultMessage, { parse_mode: 'Markdown' });
            }
        } else {
            bot.sendMessage(chatId, "⚠️ لم أتمكن من العثور على بيانات للمدخل المقدم.");
        }
    }
});



//-------------------------------------------

// حفظ بيانات المستخدم في MongoDB
  bot.on('message', async (msg) => {
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
        // التأكد من أن الدالة async
        await saveUserWithRetry(userData);
    } catch (err) {
        console.error('Error saving user to database:', err);
    }
});

//-------------------------------------------
// إرسال تنبيه للمسؤولين
function sendMessageToAdmins(message) {
    adminIds.forEach(adminId => {
        axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
            chat_id: adminId,
            text: message
        }).catch(err => console.error('Error sending message to admins:', err));
    });
}
//-------------------------------------------
// تشغيل السيرفر
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

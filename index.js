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

app.use(express.json());

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
const mongoURI = 'mongodb+srv://mrahel1993:7Am7dkIitbpVN9Oq@cluster0.rjekk.mongodb.net/userDBtrygaz?retryWrites=true&w=majority';
mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 30000, // 30 ثانية
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
  languageCode: String, // اللغة التي يستخدمها المستخدم
  bio: String, // السيرة الذاتية (إذا كانت موجودة)
  phoneNumber: String, // رقم الهاتف (إذا شاركه المستخدم)
  isBot: Boolean, // هل المستخدم هو بوت أو شخص حقيقي
  chatId: Number, // معرّف المحادثة
  joinedAt: { type: Date, default: Date.now }, // تاريخ الانضمام
});

const User = mongoose.model('User', userSchema);

// دالة لتحسين التعامل مع البيانات المفقودة أو غير الصالحة
const cleanData = (value) => {
    if (value === null || value === undefined || value === "") {
        return "غير متوفر"; // إرجاع "غير متوفر" إذا كانت القيمة مفقودة أو فارغة
    }
    return value.toString().trim() || "غير متوفر"; // تحويل القيمة إلى نص والتأكد من أنها ليست فارغة
};

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

// تحسين Logging للأخطاء
function logError(error, source = '') {
    console.error(`❌ [${new Date().toISOString()}] ${source ? source + " - " : ""}${error.message}`);
    sendMessageToAdmins(`❌ [${new Date().toISOString()}] ${source ? source + " - " : ""}${error.message}`);
}


// استدعاء الدالة مع مسار المجلد
const excelFolderPath = './excel-files'; // استبدل بمسار المجلد الخاص بك
loadDataFromExcelFolder(excelFolderPath);

// قائمة معرفات المسؤولين
const adminIds = process.env.ADMIN_IDS?.split(',') || ['7719756994'];

// دالة لإرسال رسالة إلى جميع المسؤولين
async function sendBroadcastMessage(message, adminId) {
    try {
        if (message.length > 4096) {
            await bot.sendMessage(adminId, "⚠️ الرسالة طويلة جدًا. يرجى تقصيرها إلى أقل من 4096 حرفًا.");
            return;
        }

        const users = await User.find();
        if (users.length === 0) {
            console.log("⚠️ لا يوجد مستخدمون في قاعدة البيانات.");
            await bot.sendMessage(adminId, "⚠️ لا يوجد مستخدمون لإرسال الرسالة إليهم.");
            return;
        }

        let successCount = 0;
        let failureCount = 0;

        const sendPromises = users.map(async user => {
            try {
                await bot.sendMessage(user.chatId, message);
                successCount++;
            } catch (error) {
                console.error(`❌ فشل إرسال الرسالة إلى المستخدم ${user.chatId}:`, error.message);
                if (error.response && error.response.statusCode === 403) {
                    console.log(`🚫 المستخدم ${user.chatId} قد يكون قد حظر البوت.`);
                }
                failureCount++;
            }
        });

        await Promise.all(sendPromises);
        await bot.sendMessage(adminId, `✅ تم إرسال الرسائل. \n📬 نجاح: ${successCount} \n❌ فشل: ${failureCount}`);
    } catch (error) {
        console.error('❌ حدث خطأ أثناء إرسال الرسائل:', error.message);
        await bot.sendMessage(adminId, "❌ حدث خطأ أثناء إرسال الرسائل.");
    }
}




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


// إرسال رسالة مع إعادة المحاولة في حال حدوث خطأ
async function sendMessageWithRetry(chatId, message) {
    await retryOperation(() => bot.sendMessage(chatId, message));
}

// حفظ بيانات المستخدم في MongoDB مع إعادة المحاولة عند حدوث خطأ
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
        // البحث عن جميع السجلات التي تطابق الإدخال
        const matchingRecords = data.filter((entry) => 
            entry.idNumber === input || entry.name.includes(input)
        );

        if (matchingRecords.length > 0) {
            bot.sendMessage(chatId, `🔍 **تم العثور على ${matchingRecords.length} نتيجة للمدخل "${input}":**`);

            for (const record of matchingRecords) {
                const safeFileName = record._fileName.replace(/[_*]/g, '\\$&'); // للهروب من الرموز الخاصة
                const response = `
👤 **الاسم**: ${record.name}
🏘️ **الحي / المنطقة**: ${record.area}
🏙️ **المدينة**: ${record.district}
📍 **المحافظة**: ${record.province}

📛 **اسم الموزع**: ${record.distributorName}
📞 **رقم جوال الموزع**: ${record.distributorPhone}
🆔 **هوية الموزع**: ${record.distributorId}

📜 **الحالة**: ${record.status}
📂 **اسم الملف**: ${safeFileName}
📅 **تاريخ التعديل الأخير**: ${record.lastModifiedDate}
                `;
                bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
            }
        } else {
            bot.sendMessage(chatId, "⚠️ لم أتمكن من العثور على بيانات للمدخل المقدم.");
        }
    }

    // حفظ بيانات المستخدم في MongoDB
    const userData = {
        telegramId: msg.from.id,
        username: msg.from.username || "No Username",  // اسم المستخدم
        firstName: msg.from.first_name || "No First Name",  // الاسم الأول
        lastName: msg.from.last_name || "No Last Name",  // الاسم الأخير
        languageCode: msg.from.language_code || "en",  // اللغة
        bio: msg.from.bio || "No Bio",  // السيرة الذاتية
        phoneNumber: msg.contact ? msg.contact.phone_number : null,  // رقم الهاتف (إذا شاركه المستخدم)
        isBot: msg.from.is_bot,  // هل هو بوت أم شخص
        chatId: msg.chat.id  // معرّف المحادثة
    };

    saveUserWithRetry(userData);
});

// إعادة المحاولة عند حدوث أخطاء
async function retryOperation(operation, retries = 5, delay = 1000) {
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            await operation();
            return; // إذا تمت العملية بنجاح، نخرج من الدالة
        } catch (error) {
            if (attempt < retries - 1) {
                console.log(`❌ محاولة فاشلة ${attempt + 1}. إعادة المحاولة بعد ${delay / 1000} ثانية...`);
                await new Promise(resolve => setTimeout(resolve, delay)); // الانتظار قبل المحاولة التالية
            } else {
                console.log('❌ فشل العملية بعد عدة محاولات:', error.message);
                throw error;  // إذا فشلت جميع المحاولات، نرمي الخطأ
            }
        }
    }
}


app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

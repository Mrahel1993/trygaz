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

// استدعاء الدالة مع مسار المجلد
const excelFolderPath = './excel-files'; // استبدل بمسار المجلد الخاص بك
loadDataFromExcelFolder(excelFolderPath);

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

// دالة لإرسال رسالة للأدمنين
async function sendMessageToAdmins(message) {
    for (const adminId of adminIds) {
        try {
            await bot.sendMessage(adminId, message);
        } catch (error) {
            console.error(`❌ لم يتم إرسال الرسالة إلى المسؤول ${adminId}: ${error.message}`);
        }
    }
}

// التعامل مع الضغط على الزر "📢 إرسال رسالة للجميع"
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const input = msg.text.trim();

    if (input === "📢 إرسال رسالة للجميع" && adminIds.includes(chatId.toString())) {
        adminState[chatId] = 'awaiting_message_type';
        bot.sendMessage(chatId, "📝 اختر نوع المحتوى الذي تريد إرساله:", {
            reply_markup: {
                keyboard: [
                    [{ text: "📜 رسالة نصية" }],
                    [{ text: "🖼️ صورة" }]
                ],
                resize_keyboard: true,
                one_time_keyboard: true
            }
        });
        return;
    }

    if (adminState[chatId] === 'awaiting_message_type') {
        if (input === "📜 رسالة نصية") {
            adminState[chatId] = 'awaiting_text_message';
            bot.sendMessage(chatId, "✏️ اكتب الرسالة النصية التي تريد إرسالها:");
        } else if (input === "🖼️ صورة") {
            adminState[chatId] = 'awaiting_image';
            bot.sendMessage(chatId, "📸 أرسل الصورة التي تريد إرسالها:");
        }
    } else if (adminState[chatId] === 'awaiting_text_message') {
        delete adminState[chatId]; // إزالة الحالة بعد استلام الرسالة
        await sendBroadcastMessage(input, chatId);
    } else if (adminState[chatId] === 'awaiting_image') {
        delete adminState[chatId]; // إزالة الحالة بعد استلام الصورة
        bot.sendPhoto(chatId, msg.photo[msg.photo.length - 1].file_id)
            .then(() => {
                sendImageToAll(input); // إرسال الصورة إلى الجميع
            })
            .catch(error => {
                console.error('❌ حدث خطأ أثناء إرسال الصورة:', error.message);
            });
    }
});

// دالة لإرسال رسالة نصية للجميع
async function sendBroadcastMessage(message, chatId) {
    try {
        for (const adminId of adminIds) {
            await bot.sendMessage(adminId, message);
        }
        bot.sendMessage(chatId, "✅ تم إرسال الرسالة النصية لجميع المستخدمين.");
    } catch (error) {
        console.error("❌ حدث خطأ أثناء إرسال الرسالة النصية:", error.message);
        bot.sendMessage(chatId, "❌ حدث خطأ أثناء إرسال الرسالة النصية.");
    }
}

// دالة لإرسال صورة للجميع
async function sendImageToAll(imageId) {
    try {
        for (const adminId of adminIds) {
            await bot.sendPhoto(adminId, imageId);
        }
        bot.sendMessage(adminIds[0], "✅ تم إرسال الصورة لجميع المستخدمين.");
    } catch (error) {
        console.error("❌ حدث خطأ أثناء إرسال الصورة:", error.message);
        bot.sendMessage(adminIds[0], "❌ حدث خطأ أثناء إرسال الصورة.");
    }
}

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

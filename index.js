const TelegramBot = require('node-telegram-bot-api');
const ExcelJS = require('exceljs');
require('dotenv').config();
const express = require('express');

// إعداد سيرفر Express
const app = express();
const port = process.env.PORT || 4000;
const serverUrl = process.env.WEBHOOK_URL || 'https://trygaz.onrender.com'; // رابط الويب هوك عبر HTTP

// استبدل بالتوكن الخاص بك
const token = process.env.TELEGRAM_BOT_TOKEN || '7859625373:AAEFlMbm3Sfagj4S9rx5ixbfqItE1jNpDos';

// إنشاء البوت باستخدام Webhook
const bot = new TelegramBot(token);

// تخزين البيانات من Excel
let data = [];

// حفظ معرفات المستخدمين الذين يتفاعلون مع البوت
let userIds = new Set();

// دالة لتحميل البيانات من عدة ملفات Excel
async function loadDataFromExcelFiles(filePaths) {
    data = [];
    try {
        for (const filePath of filePaths) {
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(filePath);
            const worksheet = workbook.worksheets[0];
            const fileStats = require('fs').statSync(filePath);
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
                    });
                }
            });
        }

        console.log('📁 تم تحميل البيانات من جميع الملفات بنجاح.');
    } catch (error) {
        console.error('❌ حدث خطأ أثناء قراءة ملفات Excel:', error.message);
    }
}

// استدعاء الدالة مع ملفات متعددة
const excelFiles = ['bur.xlsx', 'kan.xlsx', 'rfh.xlsx'];
loadDataFromExcelFiles(excelFiles);

// قائمة معرفات المسؤولين
const adminIds = process.env.ADMIN_IDS?.split(',') || ['7719756994'];

// الرد على أوامر البوت
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    userIds.add(chatId);

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
bot.on('message', (msg) => {
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
هدفنا هو تسهيل الوصول إلى بيانتات.
هذا بوت مجهود شخصي ولا يتبع لاي جهة
        `;
        bot.sendMessage(chatId, aboutMessage, { parse_mode: 'Markdown' });
    } else {
        const user = data.find((entry) => entry.idNumber === input || entry.name === input);
        if (user) {
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
📅 **تاريخ صدور الكشف**: ("30 / 11/ 2024 ")
            `;
            bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
        } else {
            bot.sendMessage(chatId, "⚠️ لم أتمكن من العثور على بيانات للمدخل المقدم.");
        }
    }
});

// إعداد Webhook بدون HTTPS
bot.setWebHook(`${serverUrl}/webhook`);

// التعامل مع Webhook
app.post('/webhook', express.json(), (req, res) => {
    const update = req.body;
    bot.processUpdate(update);
    res.sendStatus(200);
});

// تشغيل السيرفر باستخدام HTTP
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

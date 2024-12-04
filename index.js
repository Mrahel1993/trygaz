const TelegramBot = require('node-telegram-bot-api');
const ExcelJS = require('exceljs'); // استيراد مكتبة exceljs
const express = require('express'); // إضافة Express لتشغيل السيرفر
require('dotenv').config(); // تحميل متغيرات البيئة

const app = express(); // إنشاء تطبيق Express
const port = process.env.PORT || 4000; // المنفذ الافتراضي

// إعداد Webhook
const token = process.env.TELEGRAM_BOT_TOKEN;
const webhookUrl = process.env.RENDER_URL;

if (!token || !webhookUrl) {
    console.error('❌ يجب ضبط TELEGRAM_BOT_TOKEN و RENDER_URL في متغيرات البيئة.');
    process.exit(1);
}

// إنشاء البوت
const bot = new TelegramBot(token, { webHook: true });
bot.setWebHook(`${webhookUrl}/bot${token}`);

// استضافة Webhook
app.use(express.json());
app.post(`/bot${token}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// إعداد صفحة رئيسية للتأكد من تشغيل السيرفر
app.get('/', (req, res) => {
    res.send('✅ The bot is running successfully with Webhook.');
});

// تخزين البيانات من Excel
let data = [];
let userIds = new Set(); // تخزين معرفات المستخدمين
const adminIds = process.env.ADMIN_IDS?.split(',') || ['7719756994'];

// تحميل بيانات من ملفات Excel
async function loadDataFromExcelFiles(filePaths) {
    data = []; // إعادة تعيين البيانات
    try {
        for (const filePath of filePaths) {
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(filePath);
            const worksheet = workbook.worksheets[0];

            worksheet.eachRow((row) => {
                const idNumber = row.getCell(1).value?.toString().trim();
                const name = row.getCell(2).value?.toString().trim();

                if (idNumber && name) {
                    data.push({
                        idNumber,
                        name,
                        province: row.getCell(3).value || 'غير متوفر',
                        district: row.getCell(4).value || 'غير متوفر',
                        area: row.getCell(5).value || 'غير متوفر',
                        distributorId: row.getCell(6).value || 'غير متوفر',
                        distributorName: row.getCell(7).value || 'غير متوفر',
                        distributorPhone: row.getCell(8).value || 'غير متوفر',
                        status: row.getCell(9).value || 'غير متوفر',
                    });
                }
            });
        }
        console.log('📁 تم تحميل البيانات بنجاح.');
    } catch (error) {
        console.error('❌ خطأ أثناء تحميل البيانات:', error.message);
    }
}

// تحميل البيانات عند بدء التشغيل
const excelFiles = ['bur.xlsx', 'kan.xlsx', 'rfh.xlsx']; // استبدل بالأسماء الفعلية للملفات
loadDataFromExcelFiles(excelFiles);

// الرد على أوامر البوت
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    userIds.add(chatId);

    const options = {
        reply_markup: {
            keyboard: [
                [{ text: "🔍 البحث برقم الهوية أو الاسم" }],
                [{ text: "📞 معلومات الاتصال" }, { text: "📖 معلومات عن البوت" }],
                ...(adminIds.includes(chatId.toString()) ? [[{ text: "📢 إرسال رسالة للجميع" }]] : []),
            ],
            resize_keyboard: true,
        },
    };

    bot.sendMessage(chatId, "مرحبًا! اختر أحد الخيارات:", options);
});

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const input = msg.text.trim();
  

    if (input === "🔍 البحث برقم الهوية أو الاسم") {
        bot.sendMessage(chatId, "📝 أدخل رقم الهوية أو الاسم للبحث:");
      
      
    } else if (input === "📞 معلومات الاتصال") {
        bot.sendMessage(chatId, "📞 للتواصل معنا: [https://t.me/YourContact]", { parse_mode: 'Markdown' });
      
      
    } else if (input === "📖 معلومات عن البوت") {
        bot.sendMessage(chatId, "🤖 بوت البحث في بيانات الغاز. \n 🔧 تم تطويره بواسطة [Ahmed](https://t.me/AhmedGarqoud)", { parse_mode: 'Markdown' });
      
      
    } else if (input === "📢 إرسال رسالة للجميع" && adminIds.includes(chatId.toString())) {
        bot.sendMessage(chatId, "✉️ اكتب الرسالة لإرسالها:");
        bot.once('message', (broadcastMsg) => {
            userIds.forEach((userId) => {
                bot.sendMessage(userId, broadcastMsg.text);
            });
            bot.sendMessage(chatId, "✅ تم الإرسال للجميع.");
        });

      
    } else {
        const user = data.find((entry) => entry.idNumber === input || entry.name === input);
      

        if (user) {
            bot.sendMessage(chatId, `
🔍 **تفاصيل الطلب**:
👤 الاسم: ${user.name}
🏘️ الحي: ${user.area}
🏙️ المدينة: ${user.district}
📍 المحافظة: ${user.province}
📞 موزع: ${user.distributorName} (${user.distributorPhone})
📜 الحالة: ${user.status}
            `);
        } else {
            bot.sendMessage(chatId, "⚠️ لم يتم العثور على البيانات.");
        }
    }
});

// تشغيل السيرفر
app.listen(port, () => {
    console.log(`🚀 السيرفر يعمل على المنفذ ${port}`);
});

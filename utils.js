const bot = require('./bot');

function sendMessageToAdmins(message) {
    const adminIds = process.env.ADMIN_IDS?.split(',') || ['1234567890'];
    adminIds.forEach(adminId => {
        bot.sendMessage(adminId, message);
    });
}

function logError(error, source = '') {
    console.error(`[${new Date().toISOString()}] ${source ? source + " - " : ""}${error.message}`);
    sendMessageToAdmins(`[${new Date().toISOString()}] ${source ? source + " - " : ""}${error.message}`);
}

module.exports = { sendMessageToAdmins, logError };

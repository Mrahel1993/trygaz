// googleDrive.js
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// بيانات الاعتماد من ملف JSON الذي قمت بتحميله
const credentials = require('./credentials.json');

// إعداد OAuth2
const oAuth2Client = new google.auth.OAuth2(
  credentials.installed.client_id,
  credentials.installed.client_secret,
  credentials.installed.redirect_uris[0]
);

// للحصول على رمز التوثيق، يجب على المستخدم زيارة الرابط
const getAuthUrl = () => {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/drive.file'],
  });
  console.log('Authorize this app by visiting this url:', authUrl);
};

// استخدم الرمز للحصول على التوكن
const getAccessToken = async (code) => {
  const { tokens } = await oAuth2Client.getToken(code);
  oAuth2Client.setCredentials(tokens);
  console.log('Tokens acquired.');
};

// تحميل ملف إلى Google Drive
const uploadFile = async (filePath) => {
  const drive = google.drive({ version: 'v3', auth: oAuth2Client });
  const fileMetadata = {
    name: 'users_data.json', // اسم الملف على Google Drive
  };
  const media = {
    mimeType: 'application/json',
    body: fs.createReadStream(filePath),
  };

  const file = await drive.files.create({
    resource: fileMetadata,
    media: media,
    fields: 'id',
  });
  console.log('File uploaded successfully. File ID:', file.data.id);
};

module.exports = { getAuthUrl, getAccessToken, uploadFile };

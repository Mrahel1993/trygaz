const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// بيانات الاعتماد الخاصة بحساب الخدمة
const credentials = {
  "type": "service_account",
  "project_id": "testgaz",
  "private_key_id": "83eee4da2f14abb96c87c25d690e3aabcc8a3c99",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCq+UpoZ2Mfa2Dx\n0rfjF4lezoXdoFDsppbjzalES+QKQ4bo7Pm4msH+d4/sZAezpfO25ihJJkzr2cAB\nbFsdzWesYhLDEAJx8FLKdAFUPF2vgZJlGpZiy05/S+m/ke135AKyEoXUXrnfyzpO\nIdR9EzAWFa22mBiTzfofsaFwKMOQxjRGFTSJ1wBqcSkpDK93XGvnM3KjvaaYeM68\nCVsE32SkO+CD0A3LyGZSGC3qBqmMWNMoFnRpX4OQa8ds97OPy1nlN4xFag7mMxPt\nutDmDkNVdsSiqc4ckx1mhf6HskePNkQjgXlKHRXJjV2sd1jMZ+QIM/9u1AwI49Di\nrfK+wqNfAgMBAAECggEABb2eFnhWNzFbTXNWUk0xgxnrG8Bsxy1mxppasxzbOM8A\noiSG1AB6QAmSrwzCx3DsiHkc5CvhjE/A5ytUueDyOLMITz1j36CCnyKbAtGOEb0H\nhdaJMyMBbTvGyvRi5VImFwWRMcrGcfG4cPQo1tREmpE6xnU/6gKSAetscMAlpOA8\nx2BRyFy0GX0kW8hpEzOEcQzVygex2gMJKrK0aO/NAcqTuklkQDWQJi+Wq0L5P+Qa\nBa5QK0NjJOodKHSe2Sdyr8OwrhYLDAdxJXRntaWac1ihm87PJBvVzi9gk0C948QF\nuxPmFRN3kfq87hlXN3xixDYhJ7bd+k/pF5wBk6rFOQKBgQDSorBleZF2H8FXtqXI\nZOhAgd0PFI1L9S7uE+VW0JWMqomzwrbXqkS9ErW9PAWPnav0dM0pv9R91NF+ZxWK\ncz0rhJ9bvTy4SVpvR/mo1AA2nnKTu1tCdIb4clOPmvzPYCw2PHE/kWCd2xYx2HBt\nOE+2UfNjM0N3gsf6jXHrBgFxBwKBgQDPy94hSvciJcegekgW/XG1toI1Y59af1p+\nNVSw4+7f4CZznpczRNgjbkyHCKwsgPySLP6BGWUMj8WN4vMrLHWJRSc7jUUdIjpn\nd1R6fUgITMp+N3kDudmMM2evegWNEL5gm1ATcxpHBJeGAi5wKjc2E67p2QZKgzab\nHXB6ALoc6QKBgQDO2kYw4Togrv7IjO4x5ibPcrkM3joEpjv4QkGvCBhVlAS3LDkz\nglsO8xjXReKQL193Kl1w6ppbGGzDnahh1tnzqsJ07Vp8AE13i096pPewq9oJiq0M\njjMeOegl1yb+4IuKl8D/lF01qLobKVr/Z5WgjspeWTGgZCbPv6hoDfXMcQKBgFd8\nNaE+tp2h2lIuKXvEaMNge6GOt+CaDbdlLKrsy/1lmcrD0lS7f2QrY/zWIeb6x1uj\npeMkle6b+UirbEWZCkMo4kOoTpjdeElnbCHF7TXRXs+U+1YeQQFOAzFV5lBl5EE4\nIpaNt1p/DGxXLsX6gBQ8ZT//Jy7n322fD2POOo1BAoGBAI329OmFFo6Y9WKMdX4A\nahETCfgWRS3g9cbAGEt3480tjo1ILetamYACZ5USi6OaOzOFnjV5rIMNY4fV+cQR\n6HlnL+bTiu0pGBqMBgdxGl6SX6tWD7nl5qjWLnrBtVPrNgi0VMyKAirwIHCKo9qq\nI0ylgIkri0crd4zBMIlH0i7h\n-----END PRIVATE KEY-----\n",
  "client_email": "telgram-users@testgaz.iam.gserviceaccount.com",
  "client_id": "108839172211680844759",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/telgram-users%40testgaz.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
};

// إعداد OAuth2 باستخدام حساب الخدمة
const auth = new google.auth.GoogleAuth({
  credentials: credentials,
  scopes: ['https://www.googleapis.com/auth/drive.file'],
});

// استخدام الحساب للاتصال بـ Google Drive API
const drive = google.drive({ version: 'v3', auth });

// رفع الملف إلى Google Drive
const uploadFile = async (filePath) => {
  try {
    const fileMetadata = {
      name: 'users_data.json',  // اسم الملف الذي سيتم رفعه
    };
    const media = {
      mimeType: 'application/json',
      body: fs.createReadStream(filePath),  // قراءة الملف المحلي
    };

    const file = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id',  // الحصول على ID للملف المرفوع
    });
    console.log('File uploaded successfully. File ID:', file.data.id);
  } catch (err) {
    console.error('Error uploading file:', err);
  }
};

// تصدير الدوال لاستخدامها في ملفات أخرى
module.exports = { uploadFile };

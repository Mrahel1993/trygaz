const express = require('express');
const { loadDataFromExcelFolder } = require('./excelUtils');
const bot = require('./bot');
const { sendMessageToAdmins } = require('./utils');
const mongoose = require('./mongodb');
const User = require('./userModel');

const app = express();
const port = process.env.PORT || 4000;

app.use(express.json());

app.get('/', (req, res) => {
    res.send('The server is running successfully.');
});

loadDataFromExcelFolder('./excel-files');

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

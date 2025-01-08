const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

let data = [];

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
                if (idNumber && name) {
                    data.push({
                        idNumber,
                        name,
                        lastModifiedDate,
                        _fileName: fileName,
                    });
                }
            });
        }

        console.log('Data loaded successfully from Excel files.');
    } catch (error) {
        console.error('Error loading Excel files:', error.message);
    }
}

module.exports = { loadDataFromExcelFolder, data };

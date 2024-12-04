const XLSX = require('xlsx');

/**
 * قراءة البيانات من ملفات Excel
 * @param {string[]} files - أسماء ملفات Excel
 * @returns {Array} - مصفوفة تحتوي على جميع البيانات
 */
function readExcelData(files) {
  let data = [];
  files.forEach(file => {
    const workbook = XLSX.readFile(file);
    const sheetName = workbook.SheetNames[0];
    const worksheet = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });

    const headers = worksheet[0];
    const rows = worksheet.slice(1);

    rows.forEach(row => {
      let rowData = {};
      headers.forEach((header, index) => {
        rowData[header || `عمود ${index + 1}`] = row[index] || "";
      });
      data.push(rowData);
    });
  });
  return data;
}

/**
 * البحث عن القيم في العمود الأول أو الثاني
 * @param {Array} data - البيانات المقروءة من Excel
 * @param {string} query - نص البحث
 * @returns {Array} - النتائج المطابقة
 */
function searchExcelData(data, query) {
  return data.filter(row => {
    const columns = Object.keys(row);
    return (
      String(row[columns[0]] || "").toLowerCase().includes(query.toLowerCase()) ||
      String(row[columns[1]] || "").toLowerCase().includes(query.toLowerCase())
    );
  });
}

module.exports = { readExcelData, searchExcelData };

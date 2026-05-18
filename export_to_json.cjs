const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'DATA DB.xlsx');
const workbook = XLSX.readFile(filePath);

const outputDir = path.join(__dirname, 'src', 'data');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

workbook.SheetNames.forEach(sheetName => {
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    fs.writeFileSync(path.join(outputDir, `${sheetName}.json`), JSON.stringify(jsonData, null, 2));
    console.log(`Exported ${sheetName} to JSON`);
});

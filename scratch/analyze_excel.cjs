const XLSX = require('xlsx');
const path = require('path');

const filePath = 'C:/Users/intel/Videos/xampp/htdocs/KECLC/docs/(주)성화기술단.xlsx';

try {
    const workbook = XLSX.readFile(filePath);
    // 실제 데이터 시트 선택 (LU-365)
    const dataSheetName = 'LU-365';
    const worksheet = workbook.Sheets[dataSheetName];
    if (!worksheet) {
        console.error(`Sheet ${dataSheetName} not found`);
        process.exit(1);
    }
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    console.log(`\n--- Analyzing Sheet: ${dataSheetName} ---`);
    console.log('--- Rows 0-20 ---');
    jsonData.slice(0, 20).forEach((row, r) => {
        const cleanRow = Array.isArray(row) ? row.map((v, c) => v === undefined || v === null ? '' : `${v}(${c})`) : [];
        console.log(`Row ${r}:`, cleanRow);
    });

} catch (err) {
    console.error('Error reading excel:', err.message);
}

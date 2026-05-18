import XLSX from 'xlsx';

const filePath = 'c:\\xampp\\htdocs\\KECLC\\docs\\계산서 FORM.xlsx';

try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = 'LP-관리(라동)';
    console.log(`\n--- [${sheetName}] Data ---`);
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    // Show rows 1 to 50 to see the header and values
    console.log(JSON.stringify(jsonData.slice(0, 50), null, 2));
} catch (error) {
    console.error('Error reading excel:', error);
}

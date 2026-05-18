import XLSX from 'xlsx';

const filePath = 'c:\\xampp\\htdocs\\KECLC\\docs\\계산서 FORM.xlsx';

try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = 'LP-관리(라동)';
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    // Show rows 1 to 10
    jsonData.slice(0, 10).forEach((row, idx) => {
        console.log(`Row ${idx}:`, JSON.stringify(row));
    });
} catch (error) {
    console.error('Error reading excel:', error);
}

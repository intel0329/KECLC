import XLSX from 'xlsx';

const filePath = 'c:\\xampp\\htdocs\\KECLC\\docs\\계산서 FORM.xlsx';

try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = 'LP-관리(라동)';
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    // Show rows 10 to 20 to find labels
    jsonData.slice(10, 21).forEach((row, idx) => {
        console.log(`Row ${idx+10}:`, JSON.stringify(row));
    });
} catch (error) {
    console.error('Error reading excel:', error);
}

import XLSX from 'xlsx';

const filePath = 'c:\\xampp\\htdocs\\KECLC\\docs\\계산서 FORM.xlsx';

try {
    const workbook = XLSX.readFile(filePath);
    console.log('--- Sheets ---');
    console.log(workbook.SheetNames);
} catch (error) {
    console.error('Error reading excel:', error);
}

import XLSX from 'xlsx';

const filePath = 'c:\\xampp\\htdocs\\KECLC\\docs\\계산서 FORM.xlsx';

try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = '부하분담';
    if (workbook.SheetNames.includes(sheetName)) {
        console.log(`\n--- [${sheetName}] Data ---`);
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        // Show rows 1 to 50
        console.log(JSON.stringify(jsonData.slice(0, 50), null, 2));
    } else {
        console.log(`Sheet [${sheetName}] not found.`);
        console.log('Available sheets:', workbook.SheetNames);
    }
} catch (error) {
    console.error('Error reading excel:', error);
}

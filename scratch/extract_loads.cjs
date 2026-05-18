const XLSX = require('xlsx');

const filePath = 'C:/Users/intel/Videos/xampp/htdocs/KECLC/docs/(주)성화기술단.xlsx';
const workbook = XLSX.readFile(filePath);

const loadNames = new Set();
workbook.SheetNames.forEach(sheetName => {
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    // Assuming load names are typically in column 2, 3, 4 etc. Let's just grab string cells that don't match typical metadata
    jsonData.forEach(row => {
        row.forEach((cell, idx) => {
            if (typeof cell === 'string') {
                const text = cell.trim();
                // simple heuristics for load names
                if (text.length > 2 && !text.includes('TOTAL') && !text.includes('부 하') && !text.includes(':') && !text.includes('MCCB') && !text.includes('ELB') && !text.includes('3Φ') && !text.includes('1Φ')) {
                    if (idx > 0 && idx < 6) { // Load names are usually in the middle 
                        loadNames.add(text);
                    }
                }
            }
        });
    });
});

console.log(Array.from(loadNames));

const XLSX = require('xlsx');
const path = require('path');

const filePath = 'C:/Users/intel/Videos/xampp/htdocs/KECLC/docs/(주)성화기술단.xlsx';

const columnDefinitions = {
    id: { keywords: ['회로', '회로(1)'] },
    name: { keywords: ['부하내용', '부하내용(2)'] },
    unitLoad: { keywords: ['개별용량', '개별용량(5)'] },
    qty: { keywords: ['수량', '수량(6)'] },
    totalLoad: { keywords: ['합계용량', '합계용량(7)'] },
    breakerType: { keywords: ['종류', '종류(11)'] },
    poles: { keywords: ['P(12)', 'P'] },
    af: { keywords: ['AF(13)', 'AF'] },
    at: { keywords: ['AT(14)', 'AT'] },
    comment: { keywords: ['비고(15)', '비고'] }
};

const resolveColumnIndexes = (jsonData, columnDefinitions) => {
    const resolved = {};
    let bestHeaderRow = -1;
    let maxMatches = -1;

    for (let r = 0; r < Math.min(jsonData.length, 25); r++) {
        const row = jsonData[r];
        if (!row) continue;
        
        let matches = 0;
        const tempIndexes = {};
        
        Object.entries(columnDefinitions).forEach(([field, config]) => {
            const keywords = config.keywords;
            if (!keywords) return;
            
            for (let c = 0; c < row.length; c++) {
                const cellValue = String(row[c] || '').trim().toLowerCase();
                if (keywords.some(k => cellValue.includes(k.toLowerCase()))) {
                    tempIndexes[field] = c;
                    matches++;
                    break;
                }
            }
        });

        console.log(`Row ${r} matches: ${matches}`);
        if (matches > maxMatches && matches >= 2) {
            maxMatches = matches;
            bestHeaderRow = r;
            Object.assign(resolved, tempIndexes);
        }
    }

    return { indexes: resolved, bestHeaderRow, maxMatches };
};

try {
    const workbook = XLSX.readFile(filePath);
    const dataSheetName = 'LU-365';
    const worksheet = workbook.Sheets[dataSheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    const result = resolveColumnIndexes(jsonData, columnDefinitions);
    console.log('\nResult:', result);

} catch (err) {
    console.error(err);
}

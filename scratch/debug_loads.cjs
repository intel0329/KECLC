const XLSX = require('xlsx');

const EXCEL_TEMPLATES = [
    {
        id: 'sh_tech',
        columns: {
            id: { keywords: ['회로', '회로(1)'] },
            name: { keywords: ['부하내용', '부하내용(2)', 'LOAD(2)', 'LOAD'] },
            unitLoad: { keywords: ['개별용량', '개별용량(5)', 'TOTAL(5)'] },
            qty: { keywords: ['수량', '수량(6)', 'LOAD(6)'] },
            totalLoad: { keywords: ['합계용량', '합계용량(7)', 'SUM(3)', 'LOAD(7)', 'TOTAL'] },
            breakerType: { keywords: ['종류', '종류(11)'] },
            poles: { keywords: ['P(12)', 'P'] },
            af: { keywords: ['AF(13)', 'AF'] },
            at: { keywords: ['AT(14)', 'AT'] },
            comment: { keywords: ['비고(15)', '비고'] }
        }
    }
];

const resolveColumnIndexes = (jsonData, columnDefinitions) => {
    const resolved = {};
    let bestHeaderRow = -1;
    let maxMatches = -1;

    for (let r = 0; r < Math.min(jsonData.length, 20); r++) {
        const row = jsonData[r];
        const nextRow = jsonData[r + 1] || [];
        if (!row) continue;
        
        let matches = 0;
        const tempIndexes = {};
        
        Object.entries(columnDefinitions).forEach(([field, config]) => {
            const keywords = config.keywords;
            if (!keywords) return;
            const normalizedKeywords = keywords.map(k => k.replace(/\s+/g, '').toLowerCase());
            
            for (let c = 0; c < Math.max(row.length, nextRow.length); c++) {
                const cellValue = String(row[c] || '').replace(/\s+/g, '').toLowerCase();
                const nextCellValue = String(nextRow[c] || '').replace(/\s+/g, '').toLowerCase();
                
                if (normalizedKeywords.some(nk => cellValue.includes(nk) || nextCellValue.includes(nk))) {
                    tempIndexes[field] = c;
                    matches++;
                    break;
                }
            }
        });

        if (matches > maxMatches && matches >= 2) {
            maxMatches = matches;
            bestHeaderRow = r;
            Object.assign(resolved, tempIndexes);
        }
    }

    let dataStartRow = bestHeaderRow !== -1 ? bestHeaderRow + 1 : 1;
    for (let i = dataStartRow; i < Math.min(jsonData.length, dataStartRow + 5); i++) {
        const row = jsonData[i];
        if (row && row.some(cell => String(cell || '').trim().length > 0)) {
            const isHeaderExtension = row.some(cell => String(cell || '').replace(/\s+/g, '').toUpperCase().includes('LOAD') || String(cell || '').replace(/\s+/g, '').includes('합계'));
            if (!isHeaderExtension) {
                dataStartRow = i;
                break;
            }
        }
    }

    return { 
        indexes: resolved, 
        dataStartRow,
        successCount: maxMatches
    };
};


try {
    const filePath = 'C:/Users/intel/Videos/xampp/htdocs/KECLC/docs/(주)성화기술단.xlsx';
    const workbook = XLSX.readFile(filePath);
    const worksheet = workbook.Sheets['LU-365'];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    const template = EXCEL_TEMPLATES[0];
    const { indexes, dataStartRow } = resolveColumnIndexes(jsonData, template.columns);

    console.log('Columns Resolved:', indexes);
    console.log('Data Start Row:', dataStartRow);

} catch (err) {
    console.error(err);
}

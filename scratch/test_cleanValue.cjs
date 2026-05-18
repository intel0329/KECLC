const XLSX = require('xlsx');

const cleanValue = (val, keywords) => {
    if (!val) return '';
    let cleaned = String(val).trim();

    if (cleaned.includes(':')) {
        const parts = cleaned.split(':');
        if (parts.length > 1) {
            const afterColon = parts.slice(1).join(':').trim();
            if (afterColon) {
                cleaned = afterColon;
            } else {
                return ''; 
            }
        }
    }

    const noSpaceCleaned = cleaned.replace(/\s+/g, '').toLowerCase();
    
    if (keywords && keywords.length > 0) {
        for (let i = 0; i < keywords.length; i++) {
            const noSpaceK = keywords[i].replace(/\s+/g, '').toLowerCase();
            if (noSpaceCleaned === noSpaceK || noSpaceCleaned === noSpaceK + ':') {
                return ''; 
            }
        }
    }

    return cleaned;
};

const findValueByHybrid = (jsonData, config) => {
    if (!config) return '';
    const { keywords, fallback } = config;

    const normalizedKeywords = keywords ? keywords.map(k => k.replace(/\s+/g, '').toLowerCase()) : [];

    if (normalizedKeywords.length > 0) {
        for (let r = 0; r < Math.min(jsonData.length, 25); r++) {
            const row = jsonData[r];
            if (!row) continue;
            for (let c = 0; c < row.length; c++) {
                const cellValue = String(row[c] || '').trim();
                const noSpaceCell = cellValue.replace(/\s+/g, '').toLowerCase();
                
                if (normalizedKeywords.some(nk => noSpaceCell.includes(nk))) {
                    console.log(`Keyword match at [${r},${c}]: ${cellValue}`);

                    const selfCleaned = cleanValue(cellValue, keywords);
                    if (selfCleaned) return selfCleaned;

                    for (let nextC = c + 1; nextC < Math.min(row.length, c + 10); nextC++) {
                        const val = String(row[nextC] || '').trim();
                        if (val) {
                            const cleaned = cleanValue(val, keywords);
                            if (cleaned) {
                                console.log(`Found value at [${r},${nextC}]: ${cleaned}`);
                                return cleaned;
                            }
                        }
                    }
                }
            }
        }
    }

    if (fallback && jsonData[fallback.r] && jsonData[fallback.r][fallback.c]) {
        const fallbackVal = String(jsonData[fallback.r][fallback.c]).trim();
        return cleanValue(fallbackVal, keywords);
    }

    return '';
};

// Mock Test
const jsonData = [
    [], [],
    [null, null, '판 넬 명   : ', null, null, 'LP-관리(라동)'],
    [null, null, '전    압   : ', null, null, '1Φ-2W 220V '],
];

const config = { keywords: ['판넬명', '판 넬 명 :'], fallback: { r: 2, c: 2 } };
console.log('Result for panelName: ', findValueByHybrid(jsonData, config));

const configV = { keywords: ['전압', '전 압 :'], fallback: { r: 3, c: 2 } };
console.log('Result for voltage: ', findValueByHybrid(jsonData, configV));

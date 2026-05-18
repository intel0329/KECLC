const XLSX = require('xlsx');
const path = require('path');

// 프로젝트의 파싱 로직을 모방한 디버그 스크립트
const filePath = 'C:/Users/intel/Videos/xampp/htdocs/KECLC/docs/(주)성화기술단.xlsx';

const template = {
    headerRow: 8,
    columns: {
        id: 1,           // 회로 (UA1 등)
        name: 2,         // 부하내용
        unitLoad: 5,     // 개별 용량
        qty: 6,          // 수량
        totalLoad: 7,    // 합계 용량
        breakerType: 11, // 차단기 종류
        poles: 12,       // 극수
        af: 13,          // AF
        at: 14,          // AT
    }
};

try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = 'LU-365';
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    const leftCircuits = [];
    const rightCircuits = [];
    let currentCircuit = null;

    console.log(`Starting parse for ${sheetName}, rows: ${jsonData.length}`);

    for (let i = template.headerRow + 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length === 0) continue;

        const circuitNo = String(row[template.columns.id] || '').trim();
        const loadName = String(row[template.columns.name] || '').trim();
        const totalLoad = parseFloat(row[template.columns.totalLoad]) || 0;

        console.log(`Row ${i}: circuitNo='${circuitNo}', loadName='${loadName}', totalLoad=${totalLoad}`);

        if (circuitNo && circuitNo !== 'undefined') {
            currentCircuit = {
                circuitNo: circuitNo,
                loads: []
            };
            if (leftCircuits.length <= rightCircuits.length) {
                leftCircuits.push(currentCircuit);
            } else {
                rightCircuits.push(currentCircuit);
            }
        }

        if (currentCircuit && (loadName || totalLoad > 0)) {
            currentCircuit.loads.push({ name: loadName, va: totalLoad });
            console.log(`  -> Added load to ${currentCircuit.circuitNo}`);
        }
    }

    console.log(`\nFinal Result: Left=${leftCircuits.length}, Right=${rightCircuits.length}`);
    if (leftCircuits.length > 0) {
        console.log('First Circuit Loads:', leftCircuits[0].loads);
    }

} catch (err) {
    console.error(err);
}

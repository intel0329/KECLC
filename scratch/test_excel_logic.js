
const { getLoadClassification, getWireClassification } = require('../src/utils/excel/categoryMapper.js');
const XLSX = require('xlsx');

// Mock workbook/sheet for testing Look-ahead
const jsonData = [
    ['Circuit', 'Load Name', 'AF', 'AT', 'Qty', 'Unit Load'],
    ['1', '', '50', '50', '1', '1000'],
    ['', '냉난방 실외기', '', '', '', ''], // Name on next row
    ['2', '전등', '30', '20', '10', '20']
];

const indexes = { id: 0, name: 1, af: 2, at: 3, qty: 4, unitLoad: 5 };

function testLookAhead() {
    console.log("--- Testing Look-ahead Logic ---");
    for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        let name = row[indexes.name];
        const circuitNo = String(row[indexes.id] || '').trim();

        if (!name) {
            for (let nextI = i + 1; nextI < Math.min(jsonData.length, i + 6); nextI++) {
                const nextRowCandidate = jsonData[nextI];
                if (!nextRowCandidate) continue;
                const nextNameValue = String(nextRowCandidate[indexes.name] || '').trim();
                const nextCircuitNo = String(nextRowCandidate[indexes.id] || '').trim();
                if (nextCircuitNo) break;
                if (nextNameValue && !['TOTAL', '합계'].some(k => nextNameValue.toUpperCase().includes(k))) {
                    name = nextNameValue;
                    break;
                }
            }
        }
        
        if (name || circuitNo) {
            console.log(`Row ${i}: Circuit=${circuitNo}, Name=${name}`);
            const classification = getLoadClassification(name, 'sh_tech');
            console.log(`  Classification: prefix=${classification.prefix}, category=${classification.category}`);
            
            const at = row[indexes.at] || 0;
            // Infer phase from poles (hardcoded for test)
            const phase = '3Ø4W'; 
            const wireSpec = getWireClassification(at, classification.category, phase, 'sh_tech');
            console.log(`  Wire Spec (AT ${at}): wire=${wireSpec.wire}, size=${wireSpec.size}, method=${wireSpec.method}`);
        }
    }
}

// Since we are in a browser/node environment mismatch (ESM vs CJS), 
// I'll just rely on manual logic check or small execution if node is available.
// But wait, the environment is Windows. I can run node.

testLookAhead();

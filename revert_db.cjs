const fs = require('fs');

// Revert CB.csv
const csvPath = 'c:\\Users\\intel\\Videos\\xampp\\htdocs\\KELC\\public\\db\\CB.csv';
let csvLines = fs.readFileSync(csvPath, 'utf8').split(/\r?\n/);
// Remove lines 49 to 69 (0-indexed: 48 to 68)
// Check if line 49 is indeed the 3-wire section
if (csvLines[48] && csvLines[48].includes('3상3선 배선용차단기 (MCCB)')) {
    csvLines.splice(48, 21);
    fs.writeFileSync(csvPath, csvLines.join('\n'), 'utf8');
    console.log('Successfully reverted CB.csv');
} else {
    console.error('CB.csv: Target section not found at expected line 49');
}

// Revert CB.json
const jsonPath = 'c:\\Users\\intel\\Videos\\xampp\\htdocs\\KELC\\src\\data\\CB.json';
let jsonLines = fs.readFileSync(jsonPath, 'utf8').split(/\r?\n/);
// We need to remove the added sections.
// I'll look for the indices of the 3-wire sections.
const firstIndex = jsonLines.findIndex(l => l.includes('3상3선 배선용차단기 (MCCB)'));
if (firstIndex !== -1) {
    // Find the start of the 4-wire section
    const secondIndex = jsonLines.findIndex((l, i) => i > firstIndex && l.includes('3상4선 배선용차단기 (MCCB)'));
    if (secondIndex !== -1) {
        // We want to remove from the '[' before the first 3-wire title to the '[' before the 4-wire title.
        // The '[' is at firstIndex - 1.
        // The '[' for 4-wire is at secondIndex - 1.
        jsonLines.splice(firstIndex - 1, secondIndex - firstIndex);
        fs.writeFileSync(jsonPath, jsonLines.join('\n'), 'utf8');
        console.log('Successfully reverted CB.json');
    } else {
        console.error('CB.json: 4-wire section not found after 3-wire section');
    }
} else {
    console.error('CB.json: 3-wire section not found');
}

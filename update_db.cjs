const fs = require('fs');
const path = require('path');

const csvPath = 'c:\\Users\\intel\\Videos\\xampp\\htdocs\\KELC\\public\\db\\CB.csv';
const csvContent = fs.readFileSync(csvPath, 'utf8');

const target = '3상4선 배선용차단기 (MCCB),,,,,,,';
const newSection = `3상3선 배선용차단기 (MCCB),,,,,,,
MCCB,ABS,3,3,20,50,18,460
MCCB,ABS,3,3,30,50,18,460
MCCB,ABS,3,3,40,50,18,460
MCCB,ABS,3,3,50,50,18,460
MCCB,ABS,3,3,75,125,37,460
MCCB,ABS,3,3,100,125,37,460
MCCB,ABS,3,3,125,125,37,460
MCCB,ABS,3,3,150,250,37,460
MCCB,ABS,3,3,175,250,37,460
MCCB,ABS,3,3,200,250,37,460
MCCB,ABS,3,3,225,250,37,460
MCCB,ABS,3,3,250,400,50,460
MCCB,ABS,3,3,300,400,50,460
MCCB,ABS,3,3,350,400,50,460
MCCB,ABS,3,3,400,400,50,460
MCCB,ABS,3,3,500,630,65,460
MCCB,ABS,3,3,600,630,65,460
MCCB,ABS,3,3,630,630,65,460
MCCB,ABS,3,3,700,800,65,460
MCCB,ABS,3,3,800,800,65,460
`;

if (csvContent.includes(target)) {
    const updatedContent = csvContent.replace(target, newSection + target);
    fs.writeFileSync(csvPath, updatedContent, 'utf8');
    console.log('Successfully updated CB.csv');
} else {
    console.error('Target string not found in CB.csv');
    // Try to find it without the commas just in case
    const targetNoCommas = '3상4선 배선용차단기 (MCCB)';
    if (csvContent.includes(targetNoCommas)) {
        console.log('Found target without commas, attempting replacement...');
        const lines = csvContent.split(/\r?\n/);
        const index = lines.findIndex(l => l.includes(targetNoCommas));
        lines.splice(index, 0, ...newSection.trim().split('\n'));
        fs.writeFileSync(csvPath, lines.join('\n'), 'utf8');
        console.log('Successfully updated CB.csv using line index');
    } else {
        console.error('Target string (no commas) also not found');
    }
}

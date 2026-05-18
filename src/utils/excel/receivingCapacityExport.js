
import ExcelJS from 'exceljs';

// ================================================================
// 변압기 갑지 워크시트 빌드 함수 (전기수용설비 - 갑지 전용)
// ================================================================
export const buildReceivingCapacityWorksheet = (workbook, sheetName, projectInfo, powerLoads, summaryStats, mofData, insulationTypes = []) => {
    const worksheet = workbook.addWorksheet(sheetName);

    // 1. PAGE SETUP
    worksheet.pageSetup = {
        orientation: 'landscape',
        paperSize: 9, 
        scale: 57,    
        margins: { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 }
    };
    worksheet.views = [{ state: 'pageBreakPreview' }];

    // 2. COLUMN WIDTHS
    worksheet.columns = [
        { width: 3 }, { width: 4 }, { width: 8 }, { width: 8 }, { width: 8 }, { width: 4 }, 
        { width: 8 }, { width: 8 }, { width: 8 }, { width: 8 }, { width: 8 }, { width: 8 }, 
        { width: 8 }, { width: 8 }, { width: 10 }, { width: 10 }, { width: 8 }, { width: 10 }, 
        { width: 10 }, { width: 10 }, { width: 10 }, { width: 8 }, { width: 6 }, { width: 6 }, 
        { width: 6 }, { width: 6 }, { width: 10 }
    ];

    const fontMain = { name: "맑은 고딕", size: 10 };
    const fontBold = { name: "맑은 고딕", size: 10, bold: true };
    const borderThin = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    const centerAlign = { vertical: 'middle', horizontal: 'center' };
    const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    const subHeaderFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };

    const applyStyle = (cell, options = {}) => {
        cell.font = { ...fontMain, ...options.font };
        cell.border = borderThin;
        cell.alignment = { ...centerAlign, ...options.alignment };
        if (options.fill) cell.fill = options.fill;
        return cell;
    };

    const formatUnit = (val, unit) => {
        if (val === undefined || val === null || val === '') return '-';
        return `${val} ${unit}`;
    };

    // 3. ROWS SETUP
    [1, 4].forEach(r => worksheet.getRow(r).height = 15);
    [2, 3, 5, 6].forEach(r => worksheet.getRow(r).height = 25);

    // 4. TOP INFO BAR
    const topLabels = [
        ['PROJECT', 'B2:I2'], ['TITLE', 'J2:L2'], ['SOURCE', 'M2:N2'], ['LOCATION', 'O2:R2'],
        ['Phase', 'S2:S2'], ['Voltage', 'T2:T2'], ['TR CAP', 'U2:V2'], ['Type', 'W2:X2'],
        ['Mount', 'Y2:Z2'], ['인입긍장', 'AA2:AA2']
    ];
    topLabels.forEach(([label, range]) => {
        if (range.includes(':')) worksheet.mergeCells(range);
        applyStyle(worksheet.getCell(range.split(':')[0]), { fill: headerFill, font: { bold: true } }).value = label;
    });

    worksheet.mergeCells('B3:I3'); applyStyle(worksheet.getCell('B3'), { font: fontBold }).value = projectInfo.projectName || projectInfo.name || '-';
    worksheet.mergeCells('J3:L3'); applyStyle(worksheet.getCell('J3'), { font: fontBold }).value = '수배전반 계산서';
    worksheet.mergeCells('M3:N3'); applyStyle(worksheet.getCell('M3'), { font: fontBold }).value = projectInfo.source || '-';
    worksheet.mergeCells('O3:R3'); applyStyle(worksheet.getCell('O3'), { font: fontBold }).value = projectInfo.location || '-';
    
    let pVal = projectInfo.phase || '3Φ';
    // [교정] '3Φ-3W' 등에서 앞부분('3Φ')만 추출하도록 수정
    if (pVal !== '-') {
        pVal = pVal.substring(0, 2); 
        pVal = String(pVal).replace(/(\d+)/, '$1 ').trim();
    }
    applyStyle(worksheet.getCell('S3'), { font: fontBold }).value = pVal;
    
    // [교정] 변압기 갑지의 인입전압은 웹페이지와 동일하게 '22.9kV'로 우선 표시
    let vVal = projectInfo.receivingVoltage || '22.9kV';
    if (vVal !== '-') vVal = String(vVal).replace(/([0-9.]+)([a-zA-Z]+)/, '$1 $2').trim();
    applyStyle(worksheet.getCell('T3'), { font: fontBold }).value = vVal; 
    
    worksheet.mergeCells('U3:V3'); 
    let capVal = projectInfo.mainCapacity ? projectInfo.mainCapacity.toString().replace(/kVA/g, '').trim() : '-';
    applyStyle(worksheet.getCell('U3'), { font: fontBold }).value = capVal !== '-' ? `${capVal} kVA` : '-';
    
    // [교정] 'S+PF'와 같은 계통 형식이 아닌 'MOLD' 또는 'OIL'과 같은 절연 방식이 표시되도록 수정
    // 전달받은 insulationTypes가 있으면 그것을 사용하고, 없으면 기본값 참조
    let tVal = (insulationTypes && insulationTypes.length > 0) ? insulationTypes.join(', ') : (projectInfo.insulationType || '-');
    worksheet.mergeCells('W3:X3'); applyStyle(worksheet.getCell('W3'), { font: fontBold }).value = tVal;
    
    worksheet.mergeCells('Y3:Z3'); 
    applyStyle(worksheet.getCell('Y3'), { font: fontBold }).value = projectInfo.installType || '-';
    
    let distVal = projectInfo.branchDistance ? projectInfo.branchDistance.toString().replace(/m/g, '').trim() : '-';
    applyStyle(worksheet.getCell('AA3'), { font: fontBold }).value = distVal !== '-' ? `${distVal} m` : '-';

    // 5. TABLE HEADERS
    const tableHeaders = [
        ['NO', 'B5:B6'], ['TR NO.', 'C5:C6'], ['TYPE', 'D5:D6'], ['CAPACITY', 'E5:E5'],
        ['NO', 'F5:F6'], ['SECTION', 'G5:G6'], ['PANEL', 'H5:I6'], ['LOCATION', 'J5:L6'],
        ['PHASE', 'M5:M6'], ['VOLT', 'N5:N5'], ['총부하', 'O5:O5'], ['부하전류', 'P5:P5'],
        ['수용률', 'Q5:Q5'], ['수용부하', 'R5:R5'], ['수용전류', 'S5:S5'], ['부등률', 'T5:T6'],
        ['합성수용전력', 'U5:U5'], ['TYPE', 'V5:V6'], ['P', 'W5:W6'], ['AF', 'X5:X6'],
        ['AT', 'Y5:Y6'], ['KA', 'Z5:Z6'], ['REMARKS', 'AA5:AA6']
    ];
    tableHeaders.forEach(([label, range]) => {
        if (range.includes(':')) worksheet.mergeCells(range);
        const fSize = (label === 'CAPACITY' || label === '합성수용전력') ? 9 : 10;
        applyStyle(worksheet.getCell(range.split(':')[0]), { fill: headerFill, font: { bold: true, size: fSize } }).value = label;
    });

    const units = [['[kVA]', 'E6'], ['[V]', 'N6'], ['[kVA]', 'O6'], ['[A]', 'P6'], ['[%]', 'Q6'], ['[kVA]', 'R6'], ['[A]', 'S6'], ['[kVA]', 'U6']];
    units.forEach(([u, r]) => applyStyle(worksheet.getCell(r), { fill: subHeaderFill, font: { size: 8, bold: true } }).value = u);

    // 6. DATA ROWS
    let cur = 7;
    let dataRowCount = 0;
    const banks = [];
    (powerLoads || []).forEach(l => { if (l.bankId) { let b = banks.find(x => x.id === l.bankId); if (!b) { b = { id: l.bankId, name: l.bankName, type: 'MOLD', cap: l.bankCapacity, loads: [] }; banks.push(b); } b.loads.push(l); } });

    banks.forEach((b, bIdx) => {
        b.loads.forEach((l, lIdx) => {
            const row = worksheet.getRow(cur); row.height = 25;
            for (let c = 2; c <= 27; c++) applyStyle(row.getCell(c));
            if (lIdx === 0) {
                ['B', 'C', 'D', 'E'].forEach(col => { if (b.loads.length > 1) worksheet.mergeCells(`${col}${cur}:${col}${cur + b.loads.length - 1}`); });
                row.getCell('B').value = bIdx + 1; row.getCell('C').value = b.name || '-'; row.getCell('D').value = b.type || '-'; row.getCell('E').value = b.cap ? Number(b.cap) : '-';
            }
            row.getCell('F').value = lIdx + 1; // 내부 순번 복구
            row.getCell('G').value = l.sectionName || '-'; 
            worksheet.mergeCells(`H${cur}:I${cur}`); row.getCell('H').value = l.equipmentName || '-'; 
            worksheet.mergeCells(`J${cur}:L${cur}`); row.getCell('J').value = l.location || '-';
            row.getCell('M').value = l.phase || '-'; row.getCell('N').value = l.voltage ? Number(l.voltage.replace('V', '')) : '-'; 
            row.getCell('O').value = l.apparentPower ? Number(l.apparentPower).toFixed(2) : '-';
            row.getCell('P').value = l.subPanelTotalCurrent ? Number(l.subPanelTotalCurrent).toFixed(2) : '-'; 
            row.getCell('Q').value = l.demandFactor ? Number(l.demandFactor) : '-'; 
            row.getCell('R').value = l.demandLoad ? Number(l.demandLoad).toFixed(2) : '-';
            row.getCell('S').value = l.demandCurrent ? Number(l.demandCurrent).toFixed(2) : '-'; 
            const divF = l.connectedPanelId ? (l.diversityFactor ?? 1.0) : null;
            row.getCell('T').value = (divF !== null) ? Number(divF).toFixed(1) : '-'; 
            row.getCell('U').value = l.compositeDemandPower ? Number(l.compositeDemandPower).toFixed(2) : '-';
            row.getCell('V').value = l.subPanelBreakerType || '-'; row.getCell('W').value = l.cbP || '-'; row.getCell('X').value = l.af || '-'; row.getCell('Y').value = l.at || '-'; row.getCell('Z').value = l.shortCircuitCurrent || '-'; row.getCell('AA').value = l.remarks || '-';
            cur++;
            dataRowCount++;
        });
    });

    // Fill empty rows to target (Strictly 25 rows total)
    const emptyRowsToFill = 25 - dataRowCount;
    for (let i = 0; i < Math.max(0, emptyRowsToFill); i++) { 
        const row = worksheet.getRow(cur); row.height = 25; 
        for (let c = 2; c <= 27; c++) applyStyle(row.getCell(c));
        worksheet.mergeCells(`H${cur}:I${cur}`); worksheet.mergeCells(`J${cur}:L${cur}`);
        cur++; 
    }

    worksheet.getRow(cur).height = 15; cur++;

    // 7. BOTTOM SUMMARY
    worksheet.mergeCells(`B${cur}:AA${cur}`); worksheet.getRow(cur).height = 25;
    applyStyle(worksheet.getCell(`B${cur}`), { fill: headerFill, font: { bold: true } }).value = 'LOAD SUMMARY';
    
    cur++; worksheet.getRow(cur).height = 25;
    worksheet.mergeCells(`B${cur}:G${cur}`); applyStyle(worksheet.getCell(`B${cur}`), { fill: subHeaderFill, font: { bold: true } }).value = 'TRANSFORMER CAPACITY';
    worksheet.mergeCells(`H${cur}:L${cur}`); applyStyle(worksheet.getCell(`H${cur}`), { fill: subHeaderFill, font: { bold: true } }).value = 'Maximum Demand';
    worksheet.mergeCells(`M${cur}:Q${cur}`); applyStyle(worksheet.getCell(`M${cur}`), { fill: subHeaderFill, font: { bold: true } }).value = 'Total Load';
    worksheet.mergeCells(`R${cur}:X${cur}`); applyStyle(worksheet.getCell(`R${cur}`), { fill: subHeaderFill, font: { bold: true } }).value = 'M.O.F';
    worksheet.mergeCells(`Y${cur}:AA${cur}`); applyStyle(worksheet.getCell(`Y${cur}`), { fill: subHeaderFill, font: { bold: true } }).value = '권장 한류형 FUSE';

    cur++; worksheet.getRow(cur).height = 25;
    const trV_Primary = projectInfo.receivingVoltage || '22.9kV';
    const trV_Secondary = '380V';
    const trP_Base = (projectInfo.phase || '3Φ').substring(0, 2);
    const trC = projectInfo.mainCapacity || '-';
    
    // [교정] 요약 정보를 '3Φ - 22.9kV / 380V - 950 kVA' 형식으로 수정
    const trDisplay = (trC === '-') ? '-' : `${trP_Base} - ${trV_Primary} / ${trV_Secondary} - ${trC} kVA`;
    worksheet.mergeCells(`B${cur}:G${cur}`); applyStyle(worksheet.getCell(`B${cur}`), { font: fontBold }).value = trDisplay;
    applyStyle(worksheet.getCell(`H${cur}`), { font: fontBold }).value = projectInfo.demandFactor ? `${Math.round(Number(projectInfo.demandFactor))} %` : '-';
    worksheet.mergeCells(`I${cur}:J${cur}`); applyStyle(worksheet.getCell(`I${cur}`), { font: fontBold }).value = summaryStats?.totalLoad ? `${Number(summaryStats.totalLoad).toFixed(2)} kVA` : '-';
    worksheet.mergeCells(`K${cur}:L${cur}`); applyStyle(worksheet.getCell(`K${cur}`), { font: fontBold }).value = summaryStats?.totalCurrentCalc ? `${Number(summaryStats.totalCurrentCalc).toFixed(1)} A` : '-';
    applyStyle(worksheet.getCell(`M${cur}`), { font: fontBold }).value = 'Max';
    worksheet.mergeCells(`N${cur}:O${cur}`); applyStyle(worksheet.getCell(`N${cur}`), { font: fontBold }).value = summaryStats?.totalLoad ? `${Number(summaryStats.totalLoad).toFixed(2)} kVA` : '-';
    worksheet.mergeCells(`P${cur}:Q${cur}`); applyStyle(worksheet.getCell(`P${cur}`), { font: fontBold }).value = summaryStats?.totalCurrentCalc ? `${Number(summaryStats.totalCurrentCalc).toFixed(1)} A` : '-';
    // 179: PT 표시 (단위 중복 방지 및 슬래시 공백)
    worksheet.mergeCells(`R${cur}:S${cur}`);
    let ptVal = mofData?.pt ? mofData.pt.toString().replace(/V/g, '').replace(/\//g, ' / ').replace(/\s+/g, ' ').trim() : '-';
    applyStyle(worksheet.getCell(`R${cur}`), { font: fontBold }).value = ptVal !== '-' ? `PT: ${ptVal} V` : 'PT: -';

    // 180: CT 표시 (단위 중복 방지 및 슬래시 공백)
    worksheet.mergeCells(`T${cur}:U${cur}`);
    let ctVal = mofData?.ct ? mofData.ct.toString().replace(/A/g, '').trim() : '-';
    if (ctVal.includes('/')) {
        ctVal = ctVal.split('/').map(v => v.trim() + ' A').join(' / ');
    } else if (ctVal !== '-') {
        ctVal = ctVal + ' A / 5 A';
    }
    applyStyle(worksheet.getCell(`T${cur}`), { font: fontBold }).value = ctVal !== '-' ? `CT: ${ctVal}` : 'CT: -';

    // 181: 강도 표시
    worksheet.mergeCells(`V${cur}:X${cur}`);
    let ocsVal = mofData?.ocs ? mofData.ocs.toString().replace(/배수/g, '').trim() : '-';
    applyStyle(worksheet.getCell(`V${cur}`), { font: fontBold }).value = ocsVal !== '-' ? `강도: ${ocsVal} 배수` : '강도: - 배수';

    worksheet.mergeCells(`Y${cur}:AA${cur}`); 
    let fuseVal = mofData?.primaryPF ? String(mofData.primaryPF)
        .replace(/\s+/g, '') // 모든 공백 제거
        .replace(/kA/g, ' kA') // kA 앞에 공백 추가 (kA 자체는 붙임)
        .replace(/([0-9]+)A/g, '$1 A') // 숫자와 A 사이 공백 추가
        .replace(/\//g, ' / ') // 슬래시 전후 공백
        .trim() : '-';
    applyStyle(worksheet.getCell(`Y${cur}`), { font: fontBold }).value = fuseVal;

    worksheet.pageSetup.printArea = `A1:AA${cur}`;
};

// EXPORT FUNCTIONS
export const exportReceivingCapacityToExcel = async (projectInfo, powerLoads, summaryStats, mofData, insulationTypes = []) => {
    const workbook = new ExcelJS.Workbook();
    buildReceivingCapacityWorksheet(workbook, 'Receiving Capacity', projectInfo, powerLoads, summaryStats, mofData, insulationTypes);
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `변압기용량계산서_(갑지).xlsx`;
    anchor.click(); window.URL.revokeObjectURL(url);
};

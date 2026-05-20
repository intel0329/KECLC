
import * as XLSX from 'xlsx-js-style';
import ExcelJS from 'exceljs';
import { buildReceivingCapacityWorksheet } from './excel/receivingCapacityExport';

// Status color helper
const getStatusColor = (status) => {
    if (status === 'Ok' || (typeof status === 'number' && !isNaN(status))) return { rgb: "008000" }; // Green
    if (status === '-' || !status) return { rgb: "808080" }; // Gray
    if (status === 'Fail' || status === 'ERR' || status === 'Chk.') return { rgb: "FF0000" }; // Red
    if (status === 'Caution') return { rgb: "FFA500" }; // Orange
    return { rgb: "000000" }; // Default Black
};

const getStatusStyle = (status, baseStyle) => {
    return {
        ...baseStyle,
        font: { ...baseStyle.font, color: getStatusColor(status) }
    };
};

// Phase contribution calculation
const calculatePhaseContribution = (circuit, loadTotal, phaseType, selectedPhaseLine) => {
    const p = Number(circuit?.p) || 4;
    const contrib = { l1: 0, l2: 0, l3: 0 };

    if (phaseType === '1Ø-2W') {
        if (selectedPhaseLine === 'L1') contrib.l1 = loadTotal;
        else if (selectedPhaseLine === 'L2') contrib.l2 = loadTotal;
        else if (selectedPhaseLine === 'L3') contrib.l3 = loadTotal;
    } else {
        if (p === 2) {
            const pl = circuit?.phaseLine || 'L1';
            if (pl === 'L1') contrib.l1 = loadTotal;
            else if (pl === 'L2') contrib.l2 = loadTotal;
            else if (pl === 'L3') contrib.l3 = loadTotal;
        } else {
            const share = Math.floor(loadTotal / 3);
            contrib.l1 = contrib.l2 = contrib.l3 = share;
        }
    }
    return contrib;
};

// Format load list to string
const formatLoadList = (loads) => {
    if (!loads || loads.length === 0) return '';
    return loads.map(l => {
        let prefix = l.prefix ? `[${l.prefix}] ` : '';
        return `${prefix}${l.name || 'Unknown'} (${l.qty}EA / ${Number(l.va).toLocaleString()}VA)`;
    }).join(', ');
};

// ================================================================
// 분전반 워크시트 빌드 함수 (통합 내보내기에서 재사용)
// ================================================================
const buildPanelWorksheet = (workbook, sheetName, projectInfo, leftCircuits, rightCircuits, getMaxRow, selectedPhaseLine, phaseTotals, totalLoad) => {
    const worksheet = workbook.addWorksheet(sheetName);

    // ================================================================
    // 1. PAGE SETUP (User Requested)
    // ================================================================
    worksheet.pageSetup = {
        orientation: 'landscape',
        paperSize: 9,        // A4
        scale: 57,           // 57% Fixed Scale
        fitToPage: false,    // Use manual scale
        margins: {
            left: 0.7, right: 0.7, top: 0.75, bottom: 0.75,
            header: 0.3, footer: 0.3
        },
        horizontalCentered: true
    };

    // Enable Page Break Preview Mode
    worksheet.views = [
        { state: 'normal', showGridLines: true, activeTab: 0, view: 'pageBreakPreview' }
    ];

    // ================================================================
    // 2. COLUMN WIDTHS (Preserve Exactly)
    // ================================================================
    const colWidths = [
        4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 10, 15, 10, 10, 10, 15, 10, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5
    ];
    worksheet.columns = colWidths.map(w => ({ width: w }));

    // ================================================================
    // 3. STYLE DEFINITIONS (ExcelJS format)
    // ================================================================
    const fontMain = { name: "맑은 고딕", size: 9 };
    const borderThin = {
        top: { style: 'thin', color: { argb: 'FF333333' } },
        left: { style: 'thin', color: { argb: 'FF333333' } },
        bottom: { style: 'thin', color: { argb: 'FF333333' } },
        right: { style: 'thin', color: { argb: 'FF333333' } }
    };
    const centerAlign = { vertical: 'middle', horizontal: 'center' };

    const getBaseStyle = () => ({
        font: { ...fontMain },
        border: { ...borderThin },
        alignment: { ...centerAlign }
    });

    const applyStyle = (cell, options = {}) => {
        const style = getBaseStyle();
        if (options.bold) style.font.bold = true;
        if (options.size) style.font.size = options.size;
        if (options.color) style.font.color = { argb: 'FF' + options.color };
        if (options.bg) {
            style.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF' + options.bg }
            };
        }
        if (options.align) style.alignment.horizontal = options.align;
        cell.style = style;
    };

    const getStatusColor = (status) => {
        if (status === 'Ok' || (typeof status === 'number' && !isNaN(status))) return '008000'; // Green
        if (status === '-' || !status) return '808080'; // Gray
        if (status === 'Fail' || status === 'ERR' || status === 'Chk.') return 'FF0000'; // Red
        if (status === 'Caution') return 'FFA500'; // Orange
        return '000000'; // Default Black
    };

    const applyStatusStyle = (cell, status, baseOptions = {}) => {
        applyStyle(cell, { ...baseOptions, color: getStatusColor(status) });
    };

    // ================================================================
    // 4. DATA CONSTRUCTION
    // ================================================================
    const labelCfg = { bg: 'F5F5F5', align: 'left', size: 8 };
    const valueCfg = { bold: true, size: 10 };
    const blueValueCfg = { ...valueCfg, color: '2563EB' };
    const headerCfg = { bg: 'E0E0E0', bold: true };
    const busbarCfg = { bg: 'E8E8E8', bold: true };
    const loadDetailCfg = { bg: 'F8F8F8', align: 'left', size: 8 };
    const loadLabelCfg = { bg: 'E0E0E0', size: 8, color: '666666' };

    // Row 1: PROJECT INFO LABELS
    const r1 = worksheet.getRow(1);
    r1.height = 20;
    for (let c = 2; c <= 34; c++) applyStyle(r1.getCell(c), labelCfg);
    r1.getCell(2).value = 'PROJECT';
    r1.getCell(11).value = 'PANEL';
    r1.getCell(14).value = 'SOURCE';
    r1.getCell(16).value = 'LOCATION';
    r1.getCell(20).value = 'PHASE';
    r1.getCell(21).value = 'VOLTAGE';
    r1.getCell(23).value = 'MCCB';
    r1.getCell(26).value = 'TYPE';
    r1.getCell(29).value = 'MOUNT';
    r1.getCell(32).value = 'BRANCH';

    worksheet.mergeCells('B1:J1');
    worksheet.mergeCells('K1:M1');
    worksheet.mergeCells('N1:O1');
    worksheet.mergeCells('P1:Q1');
    worksheet.mergeCells('U1:V1');
    worksheet.mergeCells('W1:Y1');
    worksheet.mergeCells('Z1:AB1');
    worksheet.mergeCells('AC1:AE1');
    worksheet.mergeCells('AF1:AH1');

    // Row 2: PROJECT INFO VALUES
    const r2 = worksheet.getRow(2);
    r2.height = 20;
    for (let c = 2; c <= 34; c++) applyStyle(r2.getCell(c), valueCfg);
    r2.getCell(2).value = projectInfo.name;
    r2.getCell(11).value = projectInfo.panelName;
    r2.getCell(14).value = projectInfo.sourceName || '';
    r2.getCell(16).value = projectInfo.location;
    applyStyle(r2.getCell(20), blueValueCfg); r2.getCell(20).value = projectInfo.phase;
    applyStyle(r2.getCell(21), blueValueCfg); r2.getCell(21).value = projectInfo.voltage;
    r2.getCell(23).value = `${projectInfo.mccbAF}AF / ${projectInfo.mccbAT}AT`;
    r2.getCell(26).value = projectInfo.usageType;
    r2.getCell(29).value = projectInfo.installType;
    r2.getCell(32).value = `${projectInfo.branchDistance}m`;

    worksheet.mergeCells('B2:J2');
    worksheet.mergeCells('K2:M2');
    worksheet.mergeCells('N2:O2');
    worksheet.mergeCells('P2:Q2');
    worksheet.mergeCells('U2:V2');
    worksheet.mergeCells('W2:Y2');
    worksheet.mergeCells('Z2:AB2');
    worksheet.mergeCells('AC2:AE2');
    worksheet.mergeCells('AF2:AH2');

    // Row 3: Spacer
    worksheet.getRow(3).height = 20;
    for (let c = 2; c <= 34; c++) applyStyle(worksheet.getRow(3).getCell(c));

    // ================================================================
    // 5. HELPER: RENDER HEADERS (Repeated on each page)
    // ================================================================
    const renderCircuitHeaders = (startRow) => {
        // Section Headers
        const rSect = worksheet.getRow(startRow);
        rSect.height = 20;
        for (let c = 2; c <= 34; c++) applyStyle(rSect.getCell(c), headerCfg);
        rSect.getCell(2).value = 'LEFT SIDE CIRCUITS';
        rSect.getCell(17).value = 'BUS BAR / LOAD INFO';
        rSect.getCell(20).value = 'RIGHT SIDE CIRCUITS';
        worksheet.mergeCells(startRow, 2, startRow, 16);
        worksheet.mergeCells(startRow, 17, startRow, 19);
        worksheet.mergeCells(startRow, 20, startRow, 34);

        // Column Headers
        const rCol = worksheet.getRow(startRow + 1);
        rCol.height = 20;
        const colHeaders = [
            'CB', 'P', 'AF', 'AT(B)', 'AT(th)', 'AT(Is)', 'SB', 'SCB', 'Se%', 'SSC', '공사', 'WIRE', 'mm²', 'Load', 'CIRCUIT',
            'L1', 'L2', 'L3',
            'CIRCUIT', 'Load', 'CB', 'P', 'AF', 'AT(B)', 'AT(th)', 'AT(Is)', 'SB', 'SCB', 'Se%', 'SSC', '공사', 'WIRE', 'mm²'
        ];
        colHeaders.forEach((h, i) => {
            applyStyle(rCol.getCell(i + 2), headerCfg);
            rCol.getCell(i + 2).value = h;
        });
        return startRow + 2;
    };

    // ================================================================
    // 6. PAGINATED CIRCUIT RENDERING
    // ================================================================
    // ================================================================
    // 6. DYNAMIC PAGINATION LOGIC
    // ================================================================
    const maxDataRow = getMaxRow();
    const isMultiPage = maxDataRow > 16;
    const totalCircuitsToRender = Math.max(maxDataRow, 16);
    
    let currentRow = 4; 
    let runningL1 = 0, runningL2 = 0, runningL3 = 0;
    let processedCircuits = 0;
    let pageNum = 0;

    while (processedCircuits < totalCircuitsToRender) {
        // Determine how many circuits to put on THIS page
        let limitForThisPage;
        if (pageNum === 0) {
            // First Page
            limitForThisPage = isMultiPage ? 18 : 16;
        } else {
            // Subsequent Pages
            const remaining = totalCircuitsToRender - processedCircuits;
            // Page 2+ can fit about 20 circuits comfortably with headers.
            // If this is the last page (remaining <= 18), we pad up to 18 to fill the page.
            if (remaining <= 18) limitForThisPage = 18;
            else limitForThisPage = 20;
        }

        // 1. Render Headers
        currentRow = renderCircuitHeaders(currentRow);

        // 2. Render Circuits
        for (let i = 1; i <= limitForThisPage; i++) {
            const dataIdx = processedCircuits + i;
            const left = leftCircuits.find(c => c.row === dataIdx);
            const right = rightCircuits.find(c => c.row === dataIdx);

            // Phase calculations
            const leftLoadTotal = Number(left?.power) || 0;
            const rightLoadTotal = Number(right?.power) || 0;
            let pL1 = 0, pL2 = 0, pL3 = 0;

            if (projectInfo.phase === '1Ø-2W') {
                const rowLoadTotal = leftLoadTotal + rightLoadTotal;
                if (selectedPhaseLine === 'L1') pL1 = rowLoadTotal;
                else if (selectedPhaseLine === 'L2') pL2 = rowLoadTotal;
                else if (selectedPhaseLine === 'L3') pL3 = rowLoadTotal;
            } else {
                const l = left ? calculatePhaseContribution(left, leftLoadTotal, projectInfo.phase, null) : { l1: 0, l2: 0, l3: 0 };
                const r = right ? calculatePhaseContribution(right, rightLoadTotal, projectInfo.phase, null) : { l1: 0, l2: 0, l3: 0 };
                pL1 = l.l1 + r.l1; pL2 = l.l2 + r.l2; pL3 = l.l3 + r.l3;
            }
            runningL1 += pL1; runningL2 += pL2; runningL3 += pL3;

            // Determine occupancy
            const getOccupancy = (circuit) => {
                if (!circuit) return { l1: false, l2: false, l3: false };
                const pVal = Number(circuit.p) || 4;
                if (pVal >= 3) return { l1: true, l2: true, l3: true };
                if (pVal === 2) {
                    const pl = circuit.phaseLine || 'L1';
                    return { l1: pl === 'L1', l2: pl === 'L2', l3: pl === 'L3' };
                }
                return { l1: false, l2: false, l3: false };
            };

            let occL1 = false, occL2 = false, occL3 = false;
            if (projectInfo.phase === '1Ø-2W') {
                if (left || right) {
                    if (selectedPhaseLine === 'L1') occL1 = true;
                    else if (selectedPhaseLine === 'L2') occL2 = true;
                    else if (selectedPhaseLine === 'L3') occL3 = true;
                }
            } else {
                const leftOcc = getOccupancy(left);
                const rightOcc = getOccupancy(right);
                occL1 = leftOcc.l1 || rightOcc.l1; occL2 = leftOcc.l2 || rightOcc.l2; occL3 = leftOcc.l3 || rightOcc.l3;
            }

            const mainRow = worksheet.getRow(currentRow);
            const detailRow = worksheet.getRow(currentRow + 1);
            mainRow.height = 20; detailRow.height = 20;

            for (let c = 2; c <= 34; c++) {
                applyStyle(mainRow.getCell(c));
                applyStyle(detailRow.getCell(c), loadDetailCfg);
            }

            if (left) {
                mainRow.getCell(2).value = left.type; mainRow.getCell(3).value = left.p;
                applyStatusStyle(mainRow.getCell(4), left.af === 'ERR' ? 'Fail' : 'Ok'); mainRow.getCell(4).value = left.af;
                mainRow.getCell(5).value = left.at;
                applyStatusStyle(mainRow.getCell(6), left.kecJudgment?.at_th?.status); mainRow.getCell(6).value = left.kecJudgment?.at_th?.status;
                applyStatusStyle(mainRow.getCell(7), left.kecJudgment?.at_sc?.status); mainRow.getCell(7).value = left.kecJudgment?.at_sc?.status;
                applyStatusStyle(mainRow.getCell(8), left.kecJudgment?.sb?.status); mainRow.getCell(8).value = left.kecJudgment?.sb?.recommendedSize;
                applyStatusStyle(mainRow.getCell(9), left.kecJudgment?.scb?.status); mainRow.getCell(9).value = left.kecJudgment?.scb?.recommendedSize;
                applyStatusStyle(mainRow.getCell(10), left.kecJudgment?.se?.status); mainRow.getCell(10).value = left.kecJudgment?.se?.e_percent ? parseFloat(left.kecJudgment.se.e_percent).toFixed(2) : '-';
                applyStatusStyle(mainRow.getCell(11), left.kecJudgment?.ssc?.status); mainRow.getCell(11).value = left.kecJudgment?.ssc?.recommendedSize;
                mainRow.getCell(12).value = left.method; mainRow.getCell(13).value = left.wire; mainRow.getCell(14).value = left.size;
                mainRow.getCell(15).value = left.power ? Number(left.power).toLocaleString() : '';
                mainRow.getCell(16).value = left.loadName;
                applyStyle(detailRow.getCell(2), loadLabelCfg); detailRow.getCell(2).value = '부하';
                detailRow.getCell(3).value = formatLoadList(left.loads);
                worksheet.mergeCells(currentRow + 1, 3, currentRow + 1, 16);
            }

            const cellL1 = mainRow.getCell(17); cellL1.value = pL1 > 0 ? Number(pL1).toLocaleString() : (occL1 ? '-' : ''); applyStyle(cellL1, busbarCfg);
            const cellL2 = mainRow.getCell(18); cellL2.value = pL2 > 0 ? Number(pL2).toLocaleString() : (occL2 ? '-' : ''); applyStyle(cellL2, busbarCfg);
            const cellL3 = mainRow.getCell(19); cellL3.value = pL3 > 0 ? Number(pL3).toLocaleString() : (occL3 ? '-' : ''); applyStyle(cellL3, busbarCfg);
            worksheet.mergeCells(currentRow, 17, currentRow + 1, 17);
            worksheet.mergeCells(currentRow, 18, currentRow + 1, 18);
            worksheet.mergeCells(currentRow, 19, currentRow + 1, 19);

            if (right) {
                mainRow.getCell(20).value = right.loadName;
                mainRow.getCell(21).value = right.power ? Number(right.power).toLocaleString() : '';
                mainRow.getCell(22).value = right.type; mainRow.getCell(23).value = right.p;
                applyStatusStyle(mainRow.getCell(24), right.af === 'ERR' ? 'Fail' : 'Ok'); mainRow.getCell(24).value = right.af;
                mainRow.getCell(25).value = right.at;
                applyStatusStyle(mainRow.getCell(26), right.kecJudgment?.at_th?.status); mainRow.getCell(26).value = right.kecJudgment?.at_th?.status;
                applyStatusStyle(mainRow.getCell(27), right.kecJudgment?.at_sc?.status); mainRow.getCell(27).value = right.kecJudgment?.at_sc?.status;
                applyStatusStyle(mainRow.getCell(28), right.kecJudgment?.sb?.status); mainRow.getCell(28).value = right.kecJudgment?.sb?.recommendedSize;
                applyStatusStyle(mainRow.getCell(29), right.kecJudgment?.scb?.status); mainRow.getCell(29).value = right.kecJudgment?.scb?.recommendedSize;
                applyStatusStyle(mainRow.getCell(30), right.kecJudgment?.se?.status); mainRow.getCell(30).value = right.kecJudgment?.se?.e_percent ? parseFloat(right.kecJudgment.se.e_percent).toFixed(2) : '-';
                applyStatusStyle(mainRow.getCell(31), right.kecJudgment?.ssc?.status); mainRow.getCell(31).value = right.kecJudgment?.ssc?.recommendedSize;
                mainRow.getCell(32).value = right.method; mainRow.getCell(33).value = right.wire; mainRow.getCell(34).value = right.size;
                detailRow.getCell(20).value = formatLoadList(right.loads);
                applyStyle(detailRow.getCell(34), loadLabelCfg); detailRow.getCell(34).value = '부하';
                worksheet.mergeCells(currentRow + 1, 20, currentRow + 1, 33);
            }

            currentRow += 2;
        }

        processedCircuits += limitForThisPage;
        
        // 3. Add Page Break if more circuits remain
        if (processedCircuits < totalCircuitsToRender) {
            worksheet.getRow(currentRow - 1).addPageBreak();
            pageNum++;
        }
    }

    // ================================================================
    // 7. FINAL SUMMARY
    // ================================================================
    // Phase Totals Row
    const rTot = worksheet.getRow(currentRow);
    rTot.height = 20;
    for (let c = 2; c <= 34; c++) applyStyle(rTot.getCell(c));
    rTot.getCell(17).value = Number(runningL1).toLocaleString(); applyStyle(rTot.getCell(17), busbarCfg);
    rTot.getCell(18).value = Number(runningL2).toLocaleString(); applyStyle(rTot.getCell(18), busbarCfg);
    rTot.getCell(19).value = Number(runningL3).toLocaleString(); applyStyle(rTot.getCell(19), busbarCfg);
    currentRow++;

    // LOAD SUMMARY title
    const rSumTitle = worksheet.getRow(currentRow);
    rSumTitle.height = 20;
    for (let c = 2; c <= 34; c++) applyStyle(rSumTitle.getCell(c), headerCfg);
    rSumTitle.getCell(2).value = 'LOAD SUMMARY';
    worksheet.mergeCells(currentRow, 2, currentRow, 34);
    currentRow++;

    // Summary Labels
    const rSumLabel = worksheet.getRow(currentRow);
    rSumLabel.height = 20;
    for (let c = 2; c <= 34; c++) applyStyle(rSumLabel.getCell(c), headerCfg);
    applyStyle(rSumLabel.getCell(29), { ...headerCfg, size: 8 });

    rSumLabel.getCell(2).value = 'MAIN BREAKER';
    rSumLabel.getCell(8).value = 'TOTAL LOAD';
    rSumLabel.getCell(11).value = 'TOTAL CURRENT';
    rSumLabel.getCell(14).value = 'MAX P LOAD';
    rSumLabel.getCell(16).value = 'MAX P CURRENT';
    rSumLabel.getCell(20).value = 'CIRCUITS';
    rSumLabel.getCell(21).value = 'MAX CIRCUIT DISTANCE';
    rSumLabel.getCell(25).value = 'VOLT DROP';
    rSumLabel.getCell(28).value = 'DEMAND FACTOR';
    rSumLabel.getCell(32).value = 'Est. Panel Size';

    worksheet.mergeCells(currentRow, 2, currentRow, 7);
    worksheet.mergeCells(currentRow, 8, currentRow, 10);
    worksheet.mergeCells(currentRow, 11, currentRow, 13);
    worksheet.mergeCells(currentRow, 14, currentRow, 15);
    worksheet.mergeCells(currentRow, 21, currentRow, 24);
    worksheet.mergeCells(currentRow, 25, currentRow, 27);
    worksheet.mergeCells(currentRow, 28, currentRow, 31);
    worksheet.mergeCells(currentRow, 32, currentRow, 34);
    currentRow++;

    // Summary Values
    const rSumVal = worksheet.getRow(currentRow);
    rSumVal.height = 20;
    for (let c = 2; c <= 34; c++) applyStyle(rSumVal.getCell(c), valueCfg);

    const rawTotalLoad = phaseTotals.rawL1 !== undefined 
        ? (phaseTotals.rawL1 + phaseTotals.rawL2 + phaseTotals.rawL3) 
        : (totalLoad / (((Number(projectInfo.demandFactor) || 100)) / 100));
    const rawTotalCurrent = rawTotalLoad / (projectInfo.phase.includes('3Ø') ? (380 * Math.sqrt(3)) : 220);
    const rawMaxPhaseLoad = phaseTotals.rawMax !== undefined 
        ? phaseTotals.rawMax 
        : (phaseTotals.max / (((Number(projectInfo.demandFactor) || 100)) / 100));
    const rawMaxPhaseCurrent = phaseTotals.rawMaxCurrent !== undefined 
        ? phaseTotals.rawMaxCurrent 
        : (phaseTotals.maxCurrent / (((Number(projectInfo.demandFactor) || 100)) / 100));

    const finalAllCircuits = [...leftCircuits, ...rightCircuits];
    let finalMaxDistCircuit = null, finalMaxDist = -1;
    finalAllCircuits.forEach(c => { const dist = Number(c.cableDistance) || 0; if (dist > finalMaxDist) { finalMaxDist = dist; finalMaxDistCircuit = c; } });

    rSumVal.getCell(2).value = `${projectInfo.phase} MCCB`;
    rSumVal.getCell(5).value = `${projectInfo.mccbAF}AF / ${projectInfo.mccbAT}AT`;
    rSumVal.getCell(8).value = `${Math.round(rawTotalLoad).toLocaleString()} VA`;
    rSumVal.getCell(11).value = `${rawTotalCurrent.toFixed(1)} A`;
    rSumVal.getCell(14).value = `${Math.round(rawMaxPhaseLoad).toLocaleString()} VA`;
    rSumVal.getCell(16).value = `${rawMaxPhaseCurrent.toFixed(1)} A`;
    rSumVal.getCell(20).value = finalAllCircuits.length;
    rSumVal.getCell(21).value = finalMaxDistCircuit?.loadName || '-';
    rSumVal.getCell(23).value = finalMaxDist > 0 ? `${finalMaxDist} m` : '-';
    rSumVal.getCell(25).value = `${(Number(projectInfo.voltageDropLimit) || 3.0).toFixed(2)} %`;
    rSumVal.getCell(28).value = `${projectInfo.demandFactor || '100'}%`;
    const finalDemandKva = totalLoad / 1000;
    rSumVal.getCell(30).value = `${finalDemandKva.toFixed(2)} kVA`;
    const finalEstPanelSize = projectInfo.calculatedPanelSize
        ? `${projectInfo.calculatedPanelSize.width} x ${projectInfo.calculatedPanelSize.height}`
        : (projectInfo.panelSize || '800 x 2300');
    rSumVal.getCell(32).value = finalEstPanelSize;

    worksheet.mergeCells(currentRow, 2, currentRow, 4);
    worksheet.mergeCells(currentRow, 5, currentRow, 7);
    worksheet.mergeCells(currentRow, 8, currentRow, 10);
    worksheet.mergeCells(currentRow, 11, currentRow, 13);
    worksheet.mergeCells(currentRow, 14, currentRow, 15);
    worksheet.mergeCells(currentRow, 21, currentRow, 22);
    worksheet.mergeCells(currentRow, 23, currentRow, 24);
    worksheet.mergeCells(currentRow, 25, currentRow, 27);
    worksheet.mergeCells(currentRow, 28, currentRow, 29);
    worksheet.mergeCells(currentRow, 30, currentRow, 31);
    worksheet.mergeCells(currentRow, 32, currentRow, 34);

    // Final Setup
    worksheet.pageSetup.printArea = `B1:AH${currentRow}`;
};

// 기존 개별 내보내기 함수 (역호환 유지)
export const exportPanelToExcel = async (projectInfo, leftCircuits, rightCircuits, getMaxRow, selectedPhaseLine, phaseTotals, totalLoad) => {
    const workbook = new ExcelJS.Workbook();
    buildPanelWorksheet(workbook, 'Panel Layout', projectInfo, leftCircuits, rightCircuits, getMaxRow, selectedPhaseLine, phaseTotals, totalLoad);

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${projectInfo.panelName || 'Panel'}_계산서.xlsx`;
    anchor.click();
    window.URL.revokeObjectURL(url);
};


// ================================================================
// 동력 부하 워크시트 빌드 함수 (통합 내보내기에서 재사용)
// ================================================================
const buildPowerLoadWorksheet = (workbook, sheetName, projectInfo, powerLoads, summaryStats, kecSettings) => {
    const worksheet = workbook.addWorksheet(sheetName);

    // ================================================================
    // 1. PAGE SETUP (The Core Fix)
    // ================================================================
    worksheet.pageSetup = {
        orientation: 'landscape',
        paperSize: 9,        // A4
        scale: 54,           // 54% Scale
        fitToPage: false,    // Use manual scale
        margins: {
            left: 0.7, right: 0.7, top: 0.75, bottom: 0.75,
            header: 0.3, footer: 0.3
        }
    };

    // Enable Page Break Preview Mode
    worksheet.views = [
        { state: 'normal', showGridLines: true, activeTab: 0, view: 'pageBreakPreview' }
    ];

    // ================================================================
    // 2. COLUMN WIDTHS
    // ================================================================
    const colWidths = [
        { width: 3 },   // A - Marker (hidden)
        { width: 5 },   // B - NO
        { width: 25 },  // C - EQUIPMENT NAME
        { width: 10 },  // D - CIRCUIT
        { width: 10 },  // E - TYPE
        { width: 10 },  // F - PHASE
        { width: 10 },  // G - VOLT
        { width: 10 },  // H - kVA
        { width: 10 },  // I - kW
        { width: 10 },  // J - IB(A)
        { width: 10 },  // K - IMS(A)
        { width: 10 },  // L - IMI(A)
        { width: 5 },   // M - PF
        { width: 5 },   // N - Eff
        { width: 10 },  // O - METHOD
        { width: 5 },   // P - SEC (tm)
        { width: 10 },  // Q - CB
        { width: 5 },   // R - P
        { width: 5 },   // S - AF
        { width: 5 },   // T - AT
        { width: 5 },   // U - CT
        { width: 5 },   // V - uF
        { width: 5 },   // W - 공사
        { width: 5 },   // X - Wire
        { width: 5 },   // Y - mm²
        { width: 5 },   // Z - C
        { width: 5 },   // AA - L
        { width: 5 },   // AB - PE
        { width: 5 },   // AC - SIZE
        { width: 5 },   // AD - CHK
    ];
    worksheet.columns = colWidths;

    // ================================================================
    // 3. STYLE DEFINITIONS (ExcelJS format)
    // ================================================================
    const fontMain = { name: "맑은 고딕", size: 10 };
    const borderAll = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
    };
    const centerAlign = { vertical: 'middle', horizontal: 'center', wrapText: true };

    const getBaseStyle = () => ({
        font: { ...fontMain },
        border: { ...borderAll },
        alignment: { ...centerAlign }
    });

    const applyStyle = (cell, options = {}) => {
        const style = getBaseStyle();
        if (options.bold) style.font.bold = true;
        if (options.size) style.font.size = options.size;
        if (options.color) style.font.color = { argb: options.color };
        if (options.bg) {
            style.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: options.bg }
            };
        }
        if (options.align) style.alignment.horizontal = options.align;
        if (options.shrinkToFit) {
            style.alignment.shrinkToFit = true;
            style.alignment.wrapText = false;
        }
        cell.style = style;
    };

    // ================================================================
    // Header & Rows Implementation
    // ================================================================

    // Row 1: Spacer
    worksheet.getRow(1).height = 15;

    // Row 2: Labels
    const r2 = worksheet.getRow(2);
    r2.height = 25;
    const labelCfg = { bg: 'FFD9D9D9', bold: true };
    applyStyle(worksheet.getCell('B2'), labelCfg); worksheet.getCell('B2').value = 'PROJECT';
    applyStyle(worksheet.getCell('F2'), labelCfg); worksheet.getCell('F2').value = 'PANEL';
    applyStyle(worksheet.getCell('H2'), labelCfg); worksheet.getCell('H2').value = 'SOURCE';
    applyStyle(worksheet.getCell('J2'), labelCfg); worksheet.getCell('J2').value = 'LOCATION';
    applyStyle(worksheet.getCell('O2'), labelCfg); worksheet.getCell('O2').value = 'Phase';
    applyStyle(worksheet.getCell('Q2'), labelCfg); worksheet.getCell('Q2').value = 'Voltage';
    applyStyle(worksheet.getCell('S2'), labelCfg); worksheet.getCell('S2').value = 'MCCB';
    applyStyle(worksheet.getCell('V2'), labelCfg); worksheet.getCell('V2').value = 'Type';
    applyStyle(worksheet.getCell('Y2'), labelCfg); worksheet.getCell('Y2').value = 'Mount';
    applyStyle(worksheet.getCell('AB2'), labelCfg); worksheet.getCell('AB2').value = 'Branch';

    // Remaining cell styles in Row 2 for borders
    for (let c = 2; c <= 30; c++) { if (!worksheet.getRow(2).getCell(c).style.font) applyStyle(worksheet.getRow(2).getCell(c), labelCfg); }

    worksheet.mergeCells('B2:E2');
    worksheet.mergeCells('F2:G2');
    worksheet.mergeCells('H2:I2');
    worksheet.mergeCells('J2:N2');
    worksheet.mergeCells('O2:P2');
    worksheet.mergeCells('Q2:R2');
    worksheet.mergeCells('S2:U2');
    worksheet.mergeCells('V2:X2');
    worksheet.mergeCells('Y2:AA2');
    worksheet.mergeCells('AB2:AD2');

    // Row 3: Values
    const r3 = worksheet.getRow(3);
    r3.height = 25;
    const valCfg = { bold: true, size: 10 };
    const blueCfg = { ...valCfg, color: 'FF2563EB' };

    applyStyle(worksheet.getCell('B3'), valCfg); worksheet.getCell('B3').value = projectInfo.name || '';
    applyStyle(worksheet.getCell('F3'), valCfg); worksheet.getCell('F3').value = projectInfo.panelName || '';
    const sourceVal = (projectInfo.source || '').replace(/\(Linked\)/gi, '').trim();
    applyStyle(worksheet.getCell('H3'), valCfg); worksheet.getCell('H3').value = sourceVal;
    applyStyle(worksheet.getCell('J3'), valCfg); worksheet.getCell('J3').value = projectInfo.location || '';
    applyStyle(worksheet.getCell('O3'), blueCfg); worksheet.getCell('O3').value = projectInfo.phase || '';
    applyStyle(worksheet.getCell('Q3'), blueCfg); worksheet.getCell('Q3').value = projectInfo.voltage || '';
    applyStyle(worksheet.getCell('S3'), valCfg); worksheet.getCell('S3').value = `${projectInfo.mccbAF || ''}AF / ${projectInfo.mccbAT || ''}AT`;
    applyStyle(worksheet.getCell('V3'), valCfg); worksheet.getCell('V3').value = projectInfo.breakerType || '일반';
    applyStyle(worksheet.getCell('Y3'), valCfg); worksheet.getCell('Y3').value = projectInfo.mountType || '노출';
    applyStyle(worksheet.getCell('AB3'), valCfg); worksheet.getCell('AB3').value = projectInfo.branchDistance ? `${projectInfo.branchDistance}m` : '';

    for (let c = 2; c <= 30; c++) { if (!worksheet.getRow(3).getCell(c).style.font) applyStyle(worksheet.getRow(3).getCell(c), valCfg); }

    worksheet.mergeCells('B3:E3');
    worksheet.mergeCells('F3:G3');
    worksheet.mergeCells('H3:I3');
    worksheet.mergeCells('J3:N3');
    worksheet.mergeCells('O3:P3');
    worksheet.mergeCells('Q3:R3');
    worksheet.mergeCells('S3:U3');
    worksheet.mergeCells('V3:X3');
    worksheet.mergeCells('Y3:AA3');
    worksheet.mergeCells('AB3:AD3');

    // Row 4: Spacer
    worksheet.getRow(4).height = 15;

    // Row 5 & 6: Main Headers
    const hCfg = { bg: 'FFD9D9D9', bold: true };
    [5, 6].forEach(rn => {
        worksheet.getRow(rn).height = 25;
        for (let c = 2; c <= 30; c++) applyStyle(worksheet.getRow(rn).getCell(c), hCfg);
    });

    const h1 = worksheet.getRow(5);
    h1.getCell(2).value = 'NO';
    h1.getCell(3).value = '동력설비 설비명';
    h1.getCell(4).value = '회로';
    h1.getCell(5).value = '부하종류';
    h1.getCell(6).value = '상';
    h1.getCell(7).value = '전압';
    h1.getCell(8).value = '피상전력';
    h1.getCell(9).value = '유효전력';
    h1.getCell(10).value = '설계전류';
    h1.getCell(11).value = '기동전류';
    h1.getCell(12).value = '돌입전류';
    h1.getCell(13).value = '역률';
    h1.getCell(14).value = '효율';
    h1.getCell(15).value = '기동방식';
    h1.getCell(16).value = '기동';
    h1.getCell(17).value = '차단기';
    // Cells 18, 19, 20 will be merged with 17
    h1.getCell(21).value = 'CT';
    applyStyle(h1.getCell(22), { ...hCfg, size: 10, shrinkToFit: true }); h1.getCell(22).value = '콘덴서';
    h1.getCell(23).value = '공사';
    applyStyle(h1.getCell(24), { ...hCfg, size: 10, shrinkToFit: true }); h1.getCell(24).value = '케이블';
    h1.getCell(25).value = '도체';
    h1.getCell(26).value = '코어';
    h1.getCell(27).value = '라인';
    h1.getCell(28).value = '접지';
    h1.getCell(29).value = '유닛';
    h1.getCell(30).value = '확인';

    const h2 = worksheet.getRow(6);
    h2.getCell(3).value = 'EQUIPMENT LIST';
    h2.getCell(4).value = 'CIRCUIT';
    h2.getCell(5).value = 'TYPE';
    h2.getCell(6).value = 'PHASE';
    h2.getCell(7).value = 'VOLT';
    h2.getCell(8).value = 'kVA';
    h2.getCell(9).value = 'Kw';
    h2.getCell(10).value = 'IB(A)';
    h2.getCell(11).value = 'IMS(A)';
    h2.getCell(12).value = 'IMI(A)';
    h2.getCell(13).value = 'PF';
    h2.getCell(14).value = 'Eff';
    h2.getCell(15).value = 'METHOD';
    h2.getCell(16).value = 'SEC';
    h2.getCell(17).value = 'TYPE';
    h2.getCell(18).value = 'P';
    h2.getCell(19).value = 'AF';
    h2.getCell(20).value = 'AT';
    h2.getCell(21).value = 'CT';
    applyStyle(h2.getCell(22), { ...hCfg, size: 10 }); h2.getCell(22).value = 'uF';
    h2.getCell(23).value = '공사';
    applyStyle(h2.getCell(24), { ...hCfg, size: 10 }); h2.getCell(24).value = 'Wire';
    h2.getCell(25).value = 'mm²';
    h2.getCell(26).value = 'C';
    h2.getCell(27).value = 'L';
    h2.getCell(28).value = 'PE';
    h2.getCell(29).value = 'SIZE';
    h2.getCell(30).value = 'CHK';

    worksheet.mergeCells('B5:B6'); // NO
    worksheet.mergeCells('Q5:T5'); // 차단기 merge (17-20)

    // Row 7-33: Data (Adjusted upwards to 26 Rows to fit one page)
    const dataRowCount = 26;
    for (let i = 0; i < dataRowCount; i++) {
        const rn = 7 + i;
        const load = powerLoads[i];
        const row = worksheet.getRow(rn);
        row.height = 25;
        for (let c = 2; c <= 30; c++) applyStyle(row.getCell(c));

        row.getCell(2).value = i + 1;
        if (load) {
            row.getCell(3).value = load.equipmentName || '';
            row.getCell(4).value = load.circuitNo || '';
            row.getCell(5).value = load.type || '';
            row.getCell(6).value = load.phase || '';
            row.getCell(7).value = load.voltage || projectInfo.voltage?.replace('V', '') || '';
            row.getCell(8).value = load.apparentPower ?? '-';
            row.getCell(9).value = load.effectivePower ?? '-';
            row.getCell(10).value = load.designCurrent || '';
            row.getCell(11).value = load.startingCurrent ?? '-';
            row.getCell(12).value = load.inrushCurrent ?? '-';

            const pfVal = load.powerFactor || kecSettings?.cableCondition?.powerFactor;
            row.getCell(13).value = pfVal ? Number(pfVal).toFixed(2) : '';

            const effVal = load.efficiency || kecSettings?.cableCondition?.efficiency;
            row.getCell(14).value = effVal ? Number(effVal).toFixed(2) : '';
            row.getCell(15).value = load.startingMethod ?? '-';
            row.getCell(16).value = load.startingTime ?? '-';
            row.getCell(17).value = load.cbType || '';
            row.getCell(18).value = load.cbP || '';
            row.getCell(19).value = load.af || '';
            row.getCell(20).value = load.at || '';
            row.getCell(21).value = load.ct ?? '-';
            row.getCell(22).value = load.capacitor ?? '-';
            row.getCell(23).value = load.method || '';
            row.getCell(24).value = load.wire || '';
            row.getCell(25).value = load.size || '';
            row.getCell(26).value = load.c || '';
            row.getCell(27).value = load.l || '';
            row.getCell(28).value = load.pe || '';
            row.getCell(29).value = load.unitSize ?? '-';

            const chkStatus = load.chk || '';
            if (chkStatus === 'Ok') applyStyle(row.getCell(30), { color: 'FF2563EB', bold: true });
            else if (chkStatus === 'Fail') applyStyle(row.getCell(30), { color: 'FFDC2626', bold: true });
            row.getCell(30).value = chkStatus;
        }
    }

    // Load Summary Rows (Relative to dataRowCount)
    const spacerRowAfterData = 7 + dataRowCount; // 34
    const summaryHeaderRow = spacerRowAfterData + 1; // 35
    const summaryLabelRow = summaryHeaderRow + 1; // 36
    const summaryValueRow = summaryLabelRow + 1; // 37

    // Load Summary Spacer
    worksheet.getRow(spacerRowAfterData).height = 15;

    // Load Summary Header
    const rHeader = worksheet.getRow(summaryHeaderRow);
    rHeader.height = 25;
    const sumHCfg = { bg: 'FFD9D9D9', bold: true, size: 10 };
    for (let c = 2; c <= 30; c++) applyStyle(rHeader.getCell(c), sumHCfg);
    rHeader.getCell(2).value = 'LOAD SUMMARY';
    worksheet.mergeCells(`B${summaryHeaderRow}:AD${summaryHeaderRow}`);

    // Summary Labels
    const rLabel = worksheet.getRow(summaryLabelRow);
    rLabel.height = 25;
    const sumLCfg = { bg: 'FFD9D9D9', bold: true, size: 10 };
    for (let c = 2; c <= 30; c++) applyStyle(rLabel.getCell(c), sumLCfg);
    rLabel.getCell(2).value = 'MAIN BREAKER';
    rLabel.getCell(4).value = 'MAIN CT';
    rLabel.getCell(6).value = 'TOTAL LOAD';
    rLabel.getCell(8).value = 'TOTAL CURRENT';
    rLabel.getCell(10).value = 'PHASE LOAD (KVA)';
    rLabel.getCell(13).value = 'MAX MOTOR CAPACITY';
    rLabel.getCell(19).value = 'MAX STARTING TIME';
    rLabel.getCell(23).value = 'MAX STARTING FACTOR';
    rLabel.getCell(27).value = 'DEMAND FACTOR';

    worksheet.mergeCells(`B${summaryLabelRow}:C${summaryLabelRow}`);
    worksheet.mergeCells(`D${summaryLabelRow}:E${summaryLabelRow}`);
    worksheet.mergeCells(`F${summaryLabelRow}:G${summaryLabelRow}`);
    worksheet.mergeCells(`H${summaryLabelRow}:I${summaryLabelRow}`);
    worksheet.mergeCells(`J${summaryLabelRow}:L${summaryLabelRow}`);
    worksheet.mergeCells(`M${summaryLabelRow}:R${summaryLabelRow}`);
    worksheet.mergeCells(`S${summaryLabelRow}:V${summaryLabelRow}`);
    worksheet.mergeCells(`W${summaryLabelRow}:Z${summaryLabelRow}`);
    worksheet.mergeCells(`AA${summaryLabelRow}:AD${summaryLabelRow}`);

    // Summary Values
    const rValue = worksheet.getRow(summaryValueRow);
    rValue.height = 25;
    const sumVCfg = { bold: true, size: 10 };
    for (let c = 2; c <= 30; c++) applyStyle(rValue.getCell(c), sumVCfg);

    const mainBrkText = `${projectInfo.phase || ''} ${projectInfo.mainBreakerType || 'MCCB'} ${projectInfo.mccbAF || ''}AF / ${projectInfo.mccbAT || ''}AT`;
    rValue.getCell(2).value = mainBrkText;
    rValue.getCell(4).value = summaryStats.mainCT || '';
    rValue.getCell(6).value = `${(summaryStats.totalLoad / 1000).toFixed(2)} kVA`;

    const vNum = Number((projectInfo.voltage || '380V').replace('V', '')) || 380;
    const is3P = projectInfo.phase && projectInfo.phase.includes('3');
    const totI = summaryStats.totalLoad / (is3P ? (vNum * Math.sqrt(3)) : vNum);
    rValue.getCell(8).value = `${totI.toFixed(1)} A`;

    const pt = summaryStats.phaseTotals || {};
    rValue.getCell(10).value = pt.l1 !== undefined ? `L1: ${(pt.l1 / 1000).toFixed(2)}` : '';
    rValue.getCell(11).value = pt.l2 !== undefined ? `L2: ${(pt.l2 / 1000).toFixed(2)}` : '';
    rValue.getCell(12).value = pt.l3 !== undefined ? `L3: ${(pt.l3 / 1000).toFixed(2)}` : '';

    const maxMotCircuit = summaryStats.maxMotorCircuitNo || '';
    rValue.getCell(13).value = maxMotCircuit ? `"${maxMotCircuit}"` : '';
    rValue.getCell(15).value = summaryStats.maxMotorKva ? summaryStats.maxMotorKva.toFixed(2) : '';
    rValue.getCell(16).value = 'kVA';
    rValue.getCell(17).value = summaryStats.maxMotorKw ? summaryStats.maxMotorKw.toFixed(0) : '';
    rValue.getCell(18).value = 'kW';

    rValue.getCell(19).value = summaryStats.maxTm ? `${summaryStats.maxTm} sec` : '';
    rValue.getCell(23).value = summaryStats.maxBetaMethod || '';

    rValue.getCell(27).value = projectInfo.demandFactor !== undefined ? `${projectInfo.demandFactor}%` : '100%';
    const demKva = (summaryStats.totalLoad / 1000) * ((projectInfo.demandFactor || 100) / 100);
    rValue.getCell(29).value = `${demKva.toFixed(2)} kVA`;

    worksheet.mergeCells(`B${summaryValueRow}:C${summaryValueRow}`);
    worksheet.mergeCells(`D${summaryValueRow}:E${summaryValueRow}`);
    worksheet.mergeCells(`F${summaryValueRow}:G${summaryValueRow}`);
    worksheet.mergeCells(`H${summaryValueRow}:I${summaryValueRow}`);
    worksheet.mergeCells(`M${summaryValueRow}:N${summaryValueRow}`);
    worksheet.mergeCells(`S${summaryValueRow}:V${summaryValueRow}`);
    worksheet.mergeCells(`W${summaryValueRow}:Z${summaryValueRow}`);
    worksheet.mergeCells(`AA${summaryValueRow}:AB${summaryValueRow}`);
    worksheet.mergeCells(`AC${summaryValueRow}:AD${summaryValueRow}`);

    // Set final print area dynamically to avoid empty pages
    worksheet.pageSetup.printArea = `B1:AD${summaryValueRow}`;

    // Final: worksheet is ready on the workbook
};

// 기존 개별 내보내기 함수 (역호환 유지)
export const exportPowerLoadToExcel = async (projectInfo, powerLoads, summaryStats, kecSettings) => {
    const workbook = new ExcelJS.Workbook();
    buildPowerLoadWorksheet(workbook, 'Power Load Calculation', projectInfo, powerLoads, summaryStats, kecSettings);

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${projectInfo.panelName || 'PowerPanel'}_동력부하계산서.xlsx`;
    anchor.click();
    window.URL.revokeObjectURL(url);
};

// ================================================================
// 통합 엑셀 내보내기 (모든 패널을 하나의 파일에 각 탭으로)
// ================================================================
/**
 * 프로젝트 내 모든 패널을 하나의 Excel 파일에 각각의 시트(탭)로 내보냅니다.
 * 
 * @param {string} projectName - 프로젝트 이름 (파일명에 사용)
 * @param {Array<Object>} panels - 내보낼 패널 목록
 *   각 패널 객체 형식:
 *   {
 *     type: 'panel-load' | 'power-load',  // 계산서 타입
 *     sheetName: string,                    // 시트(탭) 이름
 *     data: { ... }                         // 해당 타입에 필요한 데이터
 *   }
 * 
 *   panel-load의 data:
 *     { projectInfo, leftCircuits, rightCircuits, getMaxRow, selectedPhaseLine, phaseTotals, totalLoad }
 * 
 *   power-load의 data:
 *     { projectInfo, powerLoads, summaryStats, kecSettings }
 * 
 * 향후 새로운 계산서 타입(간선, 변압기, 발전기 등)을 추가할 때는:
 * 1. 해당 타입의 buildXxxWorksheet 함수를 작성
 * 2. 아래 for 루프에 else if (panel.type === 'new-type') 분기 추가
 */
export const exportCombinedExcel = async (projectName, panels) => {
    const workbook = new ExcelJS.Workbook();

    for (const panel of panels) {
        if (panel.type === 'panel-load') {
            const d = panel.data;
            buildPanelWorksheet(
                workbook, panel.sheetName,
                d.projectInfo, d.leftCircuits, d.rightCircuits,
                d.getMaxRow, d.selectedPhaseLine, d.phaseTotals, d.totalLoad
            );
        } else if (panel.type === 'power-load') {
            const d = panel.data;
            buildPowerLoadWorksheet(
                workbook, panel.sheetName,
                d.projectInfo, d.powerLoads, d.summaryStats, d.kecSettings
            );
        } else if (panel.type === 'transformer') {
            const d = panel.data;
            buildReceivingCapacityWorksheet(
                workbook, panel.sheetName,
                d.projectInfo, d.powerLoads, d.summaryStats, d.mofData, d.insulationTypes
            );
        }
    }

    // 단일 파일로 다운로드
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${projectName || 'Project'}_통합계산서.xlsx`;
    anchor.click();
    window.URL.revokeObjectURL(url);
};

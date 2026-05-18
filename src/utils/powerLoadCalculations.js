/**
 * Power Load Calculation Utility for Excel Export
 * 
 * 이 유틸리티는 PowerLoadContent.jsx의 useMemo 계산 로직과 동일한 결과를 생성합니다.
 * 통합 엑셀 내보내기 시 DB에서 로드한 raw 데이터로부터 엑셀에 필요한 계산 값을 생성합니다.
 * 
 * [주의] 이 파일의 계산 로직은 PowerLoadContent.jsx의 calculatedLoads, totalLoad,
 * phaseTotals, summaryStats, mainCtValue 계산과 동일해야 합니다.
 * PowerLoadContent.jsx의 계산이 변경되면 이 파일도 함께 업데이트해야 합니다.
 * 
 * @see PowerLoadContent.jsx (calculatedLoads useMemo, ~line 1585)
 */

import CB_DATA from '../data/CB.json';
import { calculateKECJudgment } from './kecCalculations';

// ================================================================
// Helper Functions (PowerLoadContent.jsx에서 복사)
// ================================================================

const getAFValue = (cbType, poles, at) => {
    if (!cbType || !poles || !at) return { af: '', error: '' };
    const upperCB = cbType.toString().trim().toUpperCase();
    const numPoles = Number(poles);
    const numAT = Number(at);

    const match = CB_DATA.find(row => {
        const rowCB = row[0]?.toString().trim().toUpperCase();
        const rowPhase = Number(row[2]);
        const rowPoles = Number(row[3]);
        const rowAT = Number(row[4]);
        const circuitPhaseNum = numPoles === 2 ? 2 : 3;
        return rowCB === upperCB && rowPhase === circuitPhaseNum && rowPoles === numPoles && rowAT === numAT;
    });

    if (match) return { af: match[5], error: '' };
    return { af: 'ERR', error: 'Chk.' };
};

const getVoltageByPhase = (phase) => {
    if (!phase) return null;
    const p = phase.toString();
    if (p.includes('1Φ-2W') || p.includes('1Φ2W') || p.includes('1φ-2W') || p.includes('1φ2W') || p.includes('1Ø')) return 220;
    return 380;
};

const formatValue = (val) => {
    if (!val) return '';
    return parseFloat(Number(val).toFixed(2)).toString();
};

const getStartupMultiplier = (tm, p, at, tccData) => {
    if (!tccData || !tm || !at) return 0;
    const poles = Number(p) || 3;
    const typeKey = poles <= 2 ? 'singlePhase' : 'threePhase';
    const headersKey = poles <= 2 ? 'singlePhaseHeaders' : 'threePhaseHeaders';

    const data = tccData[typeKey];
    const headers = tccData[headersKey];
    if (!data || !headers) return 0;

    const tmStr = String(tm).trim();
    const colIndex = headers.findIndex(h => String(h).trim() === tmStr);
    if (colIndex === -1) return 0;

    const atStr = String(at).trim();
    const rowData = data[atStr];
    if (!rowData) return 0;

    return Number(rowData[colIndex]) || 0;
};

// ================================================================
// 기본 MCC 설정값 (PowerLoadContent.jsx의 초기값과 동일)
// ================================================================
const DEFAULT_MCC_SETTINGS = {
    betaDirect1P: 6.0,
    betaDirect3PSmall: 9.5,
    betaDirect3PLarge: 8.2,
    betaYD: 7.2,
    betaReactor: 7.7,
    reactorTap: 0.65,
    lambdaInv: 1.2,
    globalK: 1.5,
    globalCT: 1.25,
    tmDOL: 2,
    tmYD: 6,
    tmReactor: 10,
    tmINV: 4
};

const DEFAULT_KEC_SETTINGS = {
    shortCircuitSettings: { is: 10, tn: 0.1, k: 143, selectedK: { rowIdx: 0, colIdx: 0 } },
    cableCondition: { area: 50, powerFactor: 0.8, efficiency: 1.0, i2Type: 'industrial' },
    atMiMultiplierType: 'delta2'
};

// ================================================================
// Main Calculation Function
// ================================================================

/**
 * 동력 부하 데이터를 엑셀 내보내기용 형태로 계산합니다.
 * PowerLoadContent.jsx의 useMemo 계산 로직과 동일합니다.
 * 
 * @param {Object} projectInfo - 패널 프로젝트 정보
 * @param {Array} powerLoads - DB에서 로드한 raw 동력 부하 데이터
 * @param {Object} [kecSettings] - KEC 설정 (없으면 기본값 사용)
 * @param {Object} [mccSettings] - MCC 설정 (없으면 기본값 사용)
 * @param {Object} [tccMultiplierData] - TCC 배율 데이터 (없으면 null)
 * @returns {{ calculatedLoads: Array, totalLoad: number, phaseTotals: Object, phaseLoad: number, summaryStats: Object, mainCtValue: number|null }}
 */
export function calculatePowerLoadExportData(
    projectInfo,
    powerLoads,
    kecSettings,
    mccSettings,
    tccMultiplierData = null
) {
    // null 방어: JavaScript에서 null은 default parameter를 트리거하지 않으므로 명시적 대체
    kecSettings = kecSettings || DEFAULT_KEC_SETTINGS;
    mccSettings = mccSettings || DEFAULT_MCC_SETTINGS;

    if (!powerLoads || !Array.isArray(powerLoads)) {
        return {
            calculatedLoads: [],
            totalLoad: 0,
            phaseTotals: { l1: 0, l2: 0, l3: 0, max: 0, maxCurrent: 0, totalCurrent: 0 },
            phaseLoad: 0,
            summaryStats: {},
            mainCtValue: null
        };
    }

    // --- calculatedLoads 계산 (PowerLoadContent.jsx ~line 1585-1857) ---
    const calculatedLoads = powerLoads.map(load => {
        const eff = Number(load.efficiency) || Number(kecSettings.cableCondition?.efficiency) || 1;
        const pf = Number(load.powerFactor) || Number(kecSettings.cableCondition?.powerFactor) || 1;
        const voltage = getVoltageByPhase(load.phase);

        const isGeneral = load.type === 'LOAD';
        const P = Number(load.effectivePower) || 0;
        const Pa = Number(load.apparentPower) || 0;
        const hasKVA = Pa > 0;
        const hasKW = P > 0;
        const useKVAFormula = isGeneral && hasKVA;

        // 설계전류 IB 계산
        let designCurrent = 0;
        if (voltage) {
            if (load.phase && load.phase.includes('1Φ')) {
                if (useKVAFormula) {
                    designCurrent = (Pa * 1000) / (voltage * eff);
                } else {
                    designCurrent = (P * 1000) / (voltage * pf * eff);
                }
            } else {
                if (useKVAFormula) {
                    designCurrent = (Pa * 1000) / (Math.sqrt(3) * voltage * eff);
                } else {
                    designCurrent = (P * 1000) / (Math.sqrt(3) * voltage * pf * eff);
                }
            }
        }

        // 기동전류 (IMS) 및 돌입전류 (IMI) 계산
        let ims = 0;
        let imi = 0;
        const kw = Number(load.effectivePower) || 0;
        const method = load.startingMethod || '';

        let beta = 0;
        if (method === 'DOL' || method.includes('직입')) {
            if (load.phase && (load.phase.includes('1Φ') || load.phase.includes('1φ') || load.phase.includes('1Ø'))) {
                beta = mccSettings.betaDirect1P;
            } else {
                if (kw <= 2.2) beta = mccSettings.betaDirect3PSmall;
                else beta = mccSettings.betaDirect3PLarge;
            }
        } else if (method === 'Y-D') {
            beta = mccSettings.betaYD;
        } else if (method === '리액터' || method.includes('REACTOR') || method === 'Reactor') {
            beta = mccSettings.betaReactor;
        }

        let startingC = 1;
        if (method === 'INV' || method.includes('INVERTER')) {
            ims = designCurrent * mccSettings.lambdaInv;
            imi = designCurrent * mccSettings.lambdaInv;
        } else {
            let c = 1;
            if (method === 'Y-D') c = 1 / 3;
            else if (method === '리액터' || method.includes('REACTOR') || method === 'Reactor') c = mccSettings.reactorTap;
            startingC = c;
            ims = designCurrent * beta * c;
            imi = ims * mccSettings.globalK;
        }

        // kVA Calculations
        let apparentPowerInput = 0;
        let startingKva = 0;

        if (isGeneral) {
            const kvaValue = useKVAFormula ? Pa : (hasKW ? P / (pf * eff) : 0);
            apparentPowerInput = kvaValue;
            startingKva = kvaValue * (method === 'INV' ? mccSettings.lambdaInv : 1);
        } else if (load.type === 'SPARE') {
            apparentPowerInput = '-';
            startingKva = '-';
            designCurrent = '-';
            ims = '-';
            imi = '-';
        } else {
            apparentPowerInput = kw / (pf * eff);
            if (method === 'INV' || method.includes('INVERTER')) {
                startingKva = apparentPowerInput * mccSettings.lambdaInv;
            } else {
                startingKva = apparentPowerInput * beta * startingC;
            }
        }

        // AF 계산
        const { af } = getAFValue(load.cbType, load.cbP, load.at);

        // C & L Logic
        let autoC = '-';
        let autoL = '-';
        const sizeNum = Number(load.size) || 0;
        const areaSetting = Number(kecSettings.cableCondition?.area) || 50;
        const wireType = (load.wire || '').trim().toUpperCase();
        const phase = load.phase || '';
        const startingMethod = load.startingMethod || '';

        if (wireType && wireType !== 'WIRE') {
            if (wireType === 'HFIX') {
                autoC = '1C';
                if (phase.includes('1Φ')) autoL = '2L';
                else if (phase.includes('3Φ-3W')) autoL = '3L';
                else if (phase.includes('3Φ-4W')) autoL = '4L';
                else autoL = '1L';
            } else if (wireType === 'FCV' || wireType === 'FR8') {
                if (sizeNum < areaSetting) {
                    if (phase.includes('3Φ-3W')) autoC = '3C';
                    else if (phase.includes('3Φ-4W')) autoC = '4C';
                    else if (phase.includes('1Φ')) autoC = '2C';
                    else autoC = '1C';
                } else {
                    autoC = '1C';
                }

                if (startingMethod === 'Y-D') {
                    autoL = (sizeNum < areaSetting) ? '2L' : '6L';
                } else {
                    if (sizeNum < areaSetting) {
                        autoL = '1L';
                    } else {
                        if (phase.includes('1Φ')) autoL = '2L';
                        else if (phase.includes('3Φ-3W')) autoL = '3L';
                        else if (phase.includes('3Φ-4W')) autoL = '4L';
                        else autoL = '1L';
                    }
                }
            } else {
                autoC = '1C';
                autoL = '1L';
            }
        } else {
            autoC = '-';
            autoL = '-';
        }

        // PE Logic
        let autoPE = '-';
        const wireTypeUpper = (load.wire || '').trim().toUpperCase();
        if (wireTypeUpper && wireTypeUpper !== 'WIRE' && load.size) {
            const s = load.size;
            const peMap = {
                '1.5': '1.5', '2.5': '2.5', '4': '4', '6': '6', '10': '10', '16': '16',
                '25': '16', '35': '16', '50': '25', '70': '35', '95': '50',
                '120': '70', '150': '95', '185': '95', '240': '120', '300': '150'
            };
            autoPE = peMap[s] || '-';
        }

        // RECOMMENDED IN Logic
        const ibValue = Number(designCurrent) || 0;
        const cbPhaseNum = (Number(load.cbP) === 2) ? 2 : 3;
        const recommendedIn = CB_DATA
            .filter(row =>
                row[0] === load.cbType &&
                Number(row[2]) === cbPhaseNum &&
                row[3]?.toString() === load.cbP?.toString()
            )
            .map(row => Number(row[4]))
            .filter(at => at > ibValue)
            .sort((a, b) => a - b)[0];

        // KEC JUDGMENT
        // Get effective starting time (tm)
        // Priority: Load specific (if user edited it) > Global MCC Setting by method
        let effectiveTm = Number(load.startingTime) || 0;
        const methodForTm = load.startingMethod || '';
        if (methodForTm === 'INV' || methodForTm.includes('INVERTER')) {
            effectiveTm = mccSettings.tmINV;
        } else if (!load.startingTime || load.startingTime === '') {
            if (methodForTm === 'DOL' || methodForTm.includes('직입')) effectiveTm = mccSettings.tmDOL;
            else if (methodForTm === 'Y-D') effectiveTm = mccSettings.tmYD;
            else if (methodForTm === '리액터' || methodForTm.includes('REACTOR') || methodForTm === 'Reactor') effectiveTm = mccSettings.tmReactor;
            else effectiveTm = 10;
        }

        const atForDelta = Number(load.at) || recommendedIn;
        const delta = getStartupMultiplier(effectiveTm, load.cbP, atForDelta, tccMultiplierData);

        const circuitForKEC = {
            ...load,
            startingTime: effectiveTm,
            at: load.at,
            size: load.size,
            type: load.cbType,
            p: Number(load.cbP) || (load.phase?.includes('1Φ') ? 2 : 4),
            af: af,
            wire: load.wire,
            method: load.method,
            isGeneral: load.type === 'LOAD',
            pa: load.apparentPower,
            p_kw: load.effectivePower,
            pf: load.powerFactor || kecSettings.cableCondition?.powerFactor,
            eff: load.efficiency || kecSettings.cableCondition?.efficiency,
            cableDistance: load.cableDistance || load.d || 15,
            delta: delta,
            delta2: (() => {
                const rows = tccMultiplierData?.delta2Rows;
                if (!rows || !Array.isArray(rows) || rows.length === 0) return 0;
                const targetAt = Number(atForDelta) || 0;
                if (targetAt <= 0) return 0;
                const sorted = rows
                    .filter(r => r.at && r.delta2 && Number(r.at) > 0)
                    .sort((a, b) => Number(a.at) - Number(b.at));
                let matched = null;
                for (const r of sorted) {
                    if (Number(r.at) <= targetAt) matched = r;
                    else break;
                }
                return matched ? Number(matched.delta2) || 0 : (sorted.length > 0 ? Number(sorted[0].delta2) || 0 : 0);
            })(),
            atMiMultiplierType: kecSettings.atMiMultiplierType || 'delta2',
            ib: designCurrent,
            startingCurrent: ims,
            inrushCurrent: imi,
            globalK: mccSettings.globalK
        };

        const fullJudgment = calculateKECJudgment(circuitForKEC, kecSettings, projectInfo);

        // Combined Status
        const allJudgments = [
            fullJudgment.at_b?.status,
            fullJudgment.at_th?.status,
            fullJudgment.at_sc?.status,
            fullJudgment.at_ms?.status,
            fullJudgment.at_mi?.status,
            fullJudgment.sb?.status,
            fullJudgment.scb?.status,
            fullJudgment.ssc?.status,
            fullJudgment.se?.status
        ];
        const combinedStatus = allJudgments.every(s => s === 'Ok') ? 'Ok' :
            allJudgments.some(s => s === 'Fail') ? 'Fail' : '-';

        return {
            ...load,
            // excelExport.js는 load.apparentPower를 kVA 열에 사용하므로 계산된 값으로 덮어씌움
            apparentPower: load.type === 'SPARE' ? '-' : (apparentPowerInput > 0 ? apparentPowerInput.toFixed(2) : '0.00'),
            designCurrent: (load.type === 'SPARE') ? '-' : (designCurrent > 0 ? designCurrent.toFixed(2) : '0.00'),
            startingCurrent: (load.type === 'SPARE' || load.type === 'LOAD') ? '-' : (ims > 0 ? ims.toFixed(2) : '0.00'),
            inrushCurrent: (load.type === 'SPARE' || load.type === 'LOAD') ? '-' : (imi > 0 ? imi.toFixed(2) : '0.00'),
            voltage,
            af,
            c: autoC,
            l: autoL,
            pe: autoPE,
            recommendedIn: recommendedIn || 'N/A',
            chk: combinedStatus,
            kecJudgment: fullJudgment,
            beta: beta,
            // [FIX] 엑셀 내보내기 시에도 실시간 계산된 기동시간 반영
            startingTime: effectiveTm, 
            displayPF: formatValue(load.powerFactor || kecSettings.cableCondition?.powerFactor),
            displayEff: formatValue(load.efficiency || kecSettings.cableCondition?.efficiency),
            apparentPowerInput: load.type === 'SPARE' ? '-' : (apparentPowerInput > 0 ? apparentPowerInput.toFixed(2) : '0.00'),
            startingKva: (load.type === 'SPARE' || load.type === 'LOAD') ? '-' : (startingKva > 0 ? startingKva.toFixed(2) : '0.00')
        };
    });

    // --- totalLoad 계산 (PowerLoadContent.jsx ~line 1862-1870) ---
    const totalLoad = calculatedLoads.reduce((sum, load) => {
        if (load.type === 'SPARE') return sum;
        const ib = Number(load.designCurrent) || 0;
        const v = Number(load.voltage) || (load.phase?.includes('1Φ') ? 220 : 380);
        const power = load.phase?.includes('1Φ') ? (ib * v) : (ib * v * Math.sqrt(3));
        return sum + power;
    }, 0);

    // --- phaseTotals 계산 (PowerLoadContent.jsx ~line 1872-1905) ---
    let l1 = 0, l2 = 0, l3 = 0;
    let i1 = 0, i2 = 0, i3 = 0;

    calculatedLoads.forEach(load => {
        const p = Number(load.cbP) || 4;
        const ib = Number(load.designCurrent) || 0;
        const v = Number(load.voltage) || (load.phase?.includes('1Φ') ? 220 : 380);
        const power = load.phase?.includes('1Φ') ? (ib * v) : (ib * v * Math.sqrt(3));

        if (load.phase?.includes('3Φ')) {
            const phaseCurrent = (power / 3) / 220;
            l1 += power / 3; l2 += power / 3; l3 += power / 3;
            i1 += phaseCurrent; i2 += phaseCurrent; i3 += phaseCurrent;
        } else {
            const pl = load.phaseLine || 'L1';
            const current = power / 220;
            if (pl === 'L1') { l1 += power; i1 += current; }
            else if (pl === 'L2') { l2 += power; i2 += current; }
            else if (pl === 'L3') { l3 += power; i3 += current; }
        }
    });

    const phaseTotals = {
        l1, l2, l3,
        i1, i2, i3,
        max: Math.max(l1, l2, l3),
        maxCurrent: Math.max(i1, i2, i3),
        totalCurrent: i1 + i2 + i3
    };

    const phaseLoad = phaseTotals.max;

    // --- totalCurrentCalc & mainCtValue (PowerLoadContent.jsx ~line 1907-1921) ---
    const v = Number((projectInfo.voltage || '380V').replace('V', '')) || 380;
    const voltageFactor = projectInfo.phase && projectInfo.phase.includes('3') ? (v * Math.sqrt(3)) : v;
    const totalCurrentCalc = totalLoad / voltageFactor;

    let mainCtValue = null;
    if (totalCurrentCalc > 0) {
        const targetValue = totalCurrentCalc * (mccSettings.globalCT || 1.25);
        const standardRatings = [5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100, 150, 200, 250, 300, 400, 500, 600, 750, 800, 1000, 1200, 1500, 2000, 2500, 3000, 4000];
        mainCtValue = standardRatings.find(r => r >= targetValue) || standardRatings[standardRatings.length - 1];
    }

    // --- summaryStats 계산 (PowerLoadContent.jsx ~line 1971-2010) ---
    let maxMotorLoad = null;
    let maxMotorKva = 0;

    calculatedLoads.forEach(load => {
        const isMotor = load.type === 'MOTOR' || load.type === 'PUMP';
        if (isMotor) {
            const currentKva = Number(load.startingKva) || 0;
            if (currentKva > maxMotorKva || (currentKva === maxMotorKva && !maxMotorLoad)) {
                maxMotorKva = currentKva;
                maxMotorLoad = load;
            }
        }
    });

    let othersSumKva = 0;
    calculatedLoads.forEach(load => {
        if (load !== maxMotorLoad && load.type !== 'SPARE') {
            othersSumKva += Number(load.apparentPowerInput) || 0;
        }
    });

    const maxTm = maxMotorLoad ? (Number(maxMotorLoad.startingTime) || 0) : 0;
    const maxDelta = maxMotorLoad ? (Number(maxMotorLoad.beta) || 0) : 0;
    const maxBetaMethod = maxMotorLoad ? (maxMotorLoad.startingMethod || '-') : '';
    const maxMotorKw = maxMotorLoad ? (Number(maxMotorLoad.effectivePower) || 0) : 0;
    const maxMotorCircuitNo = maxMotorLoad ? (maxMotorLoad.circuitNo || '') : '';

    const summaryStats = {
        maxMotorKva,
        maxMotorKw,
        maxMotorCircuitNo,
        othersSumKva,
        maxTm,
        maxDelta,
        maxBetaMethod
    };

    return {
        calculatedLoads,
        totalLoad,
        phaseTotals,
        phaseLoad,
        summaryStats,
        mainCtValue,
        totalCurrentCalc
    };
}

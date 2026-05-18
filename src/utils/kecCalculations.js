/**
 * KEC Judgment Calculation Utility
 * Based on the technical standards for electrical installations.
 * 
 * [CRITICAL RULES FOR CABLE SELECTION - DO NOT MODIFY WITHOUT USER APPROVAL]
 * 1. HFIX Restriction: HFIX wire is ONLY allowed for installation methods A1, B1, and D (D1).
 * 2. FR8 Mapping: FR8 wire must always use the capacity tables of FCV (XLPE/EPR).
 * 3. Phase Dependency: P=2 circuits must use 1-phase capacity tables and 220V for Ib calculation.
 *    P=3 or 4 circuits must use 3-phase capacity tables and 380V for Ib calculation.
 */

// Cable Capacity Tables (KEC / IEC 60364-5-52)
// XLPE_90C: For HFIX, FCV, FR8 (90°C Rated)
// PVC_70C: For HIV (70°C Rated)
const CABLE_CAPACITY = {
    'XLPE_90C': {
        '3p': {
            'A1': { '1.5': 17, '2.5': 23, '4': 31, '6': 40, '10': 54, '16': 73, '25': 95, '35': 117, '50': 141, '70': 179, '95': 216, '120': 249, '150': 285, '185': 324, '240': 380, '300': 435 },
            'A2': { '1.5': 16.5, '2.5': 22, '4': 30, '6': 38, '10': 51, '16': 68, '25': 89, '35': 109, '50': 130, '70': 164, '95': 197, '120': 227, '150': 259, '185': 295, '240': 346, '300': 396 },
            'B1': { '1.5': 20, '2.5': 28, '4': 37, '6': 48, '10': 66, '16': 88, '25': 117, '35': 144, '50': 175, '70': 222, '95': 269, '120': 312, '150': 358, '185': 413, '240': 491, '300': 565 },
            'B2': { '1.5': 19.5, '2.5': 26, '4': 35, '6': 44, '10': 60, '16': 80, '25': 105, '35': 128, '50': 154, '70': 194, '95': 233, '120': 268, '150': 307, '185': 352, '240': 417, '300': 480 },
            'E': { '1.5': 23, '2.5': 32, '4': 42, '6': 54, '10': 75, '16': 100, '25': 127, '35': 158, '50': 192, '70': 246, '95': 298, '120': 346, '150': 395, '185': 456, '240': 538, '300': 621 },
            'F': { '25': 141, '35': 176, '50': 216, '70': 279, '95': 342, '120': 400, '150': 464, '185': 533, '240': 634, '300': 736 },
            'D1': { '1.5': 22, '2.5': 28, '4': 36, '6': 44, '10': 58, '16': 75, '25': 96, '35': 115, '50': 135, '70': 167, '95': 197, '120': 223, '150': 251, '185': 281, '240': 324, '300': 365 }
        },
        '1p': {
            'A1': { '1.5': 19, '2.5': 26, '4': 35, '6': 45, '10': 61, '16': 81, '25': 106, '35': 131, '50': 158, '70': 200, '95': 241, '120': 278, '150': 318, '185': 362, '240': 424, '300': 486 },
            'A2': { '1.5': 18.5, '2.5': 25, '4': 33, '6': 42, '10': 57, '16': 76, '25': 99, '35': 121, '50': 145, '70': 183, '95': 220, '120': 253, '150': 290, '185': 329, '240': 386, '300': 442 },
            'B1': { '1.5': 23, '2.5': 31, '4': 42, '6': 54, '10': 75, '16': 100, '25': 133, '35': 164, '50': 198, '70': 253, '95': 306, '120': 354, '150': 407, '185': 468, '240': 553, '300': 636 },
            'B2': { '1.5': 22, '2.5': 30, '4': 40, '6': 51, '10': 69, '16': 91, '25': 119, '35': 146, '50': 175, '70': 221, '95': 265, '120': 305, '150': 349, '185': 400, '240': 472, '300': 543 },
            'E': { '1.5': 26, '2.5': 36, '4': 49, '6': 63, '10': 86, '16': 115, '25': 149, '35': 185, '50': 225, '70': 289, '95': 352, '120': 410, '150': 473, '185': 542, '240': 641, '300': 741 },
            'F': { '25': 161, '35': 200, '50': 242, '70': 310, '95': 377, '120': 437, '150': 504, '185': 575, '240': 679, '300': 783 },
            'D1': { '1.5': 25, '2.5': 33, '4': 43, '6': 53, '10': 71, '16': 91, '25': 116, '35': 139, '50': 164, '70': 203, '95': 239, '120': 271, '150': 306, '185': 343, '240': 395, '300': 446 }
        }
    }
};

// Import RX data for impedance lookup
import RX_DATA from '../data/RX.json';

// Import CB data for kA lookup
import CB_DATA from '../data/CB.json';

/**
 * Get R and X values from RX data based on cable configuration
 * @param {string} wire - Wire type: 'HFIX', 'FCV', 'FR8'
 * @param {string} size - Conductor cross-section area
 * @param {number} p - Phase (2=1P, 3/4=3P)
 * @param {boolean} isSingleCore - Whether using single-core cable
 * @returns {object} { r: number, x: number } in Ω/km
 */
const getRXValues = (wire, size, p, isSingleCore) => {
    // Default values if lookup fails
    let r = 0;
    let x = 0;

    // Determine table section based on wire type and cable configuration
    // FCV tables start at row 5 (单心) or row 27 (多心)
    // FR8 tables start at row 47 (单心) or row 69 (多心)
    // HFIX tables start at row 93 (单心 only)

    let startRow = 0;
    const sizeStr = size?.toString();

    if (wire === 'FCV' || wire === 'FR8') {
        if (wire === 'FCV') {
            // CV, CE, F-CV: rows 5-22 (單心), 27-44 (多心)
            startRow = isSingleCore ? 5 : 27;
        } else {
            // FR8: rows 47-64 (單心), 69-86 (多心)
            startRow = isSingleCore ? 47 : 69;
        }
    } else if (wire === 'HFIX') {
        // HFIX only has single-core table: rows 93-110
        startRow = 93;
    }

    // Find the row with matching size
    for (let i = startRow; i < startRow + 20 && i < RX_DATA.length; i++) {
        const row = RX_DATA[i];
        if (row && row[0] === sizeStr) {
            // Determine column based on phase configuration
            // Columns: [size, 1P-R, 1P-X, 3P TRI-R, 3P TRI-X, 3P HORIZ-R, 3P HORIZ-X]
            if (p === 2) {
                // 1P (columns 1, 2)
                r = parseFloat(row[1]) || 0;
                x = parseFloat(row[2]) || 0;
            } else {
                // 3P - use HORIZ (S=D) for single-core, or 3P 3W for multi-core
                if (isSingleCore) {
                    // 3P HORIZ (S=D) columns 5, 6
                    r = parseFloat(row[5]) || 0;
                    x = parseFloat(row[6]) || 0;
                } else {
                    // 3P 3W (columns 3, 4)
                    r = parseFloat(row[3]) || 0;
                    x = parseFloat(row[4]) || 0;
                }
            }
            break;
        }
    }

    return { r, x };
};

/**
 * Validate if installation method matches cable type according to KEC
 * @param {object} loadData - Row data (wire, size, method)
 * @param {object} settings - KEC settings (cableCondition.area)
 * @returns {boolean}
 */
export const isCableMethodValid = (loadData, settings) => {
    if (!loadData || !loadData.method || !loadData.size) return true;

    const methodUpper = String(loadData.method).toUpperCase().trim();
    const baseMethod = methodUpper.split('X')[0].trim();

    // 1. Parallel HFIX restriction
    if (methodUpper.includes('X') && loadData.wire === 'HFIX') return false;

    // 2. HFIX Method restriction
    if (loadData.wire === 'HFIX') {
        const hfixMethods = ['A1', 'B1', 'D'];
        return hfixMethods.includes(baseMethod);
    }

    // 3. FCV/FR8 Size vs Method restriction
    if (loadData.wire !== 'FCV' && loadData.wire !== 'FR8') return true;

    const circuitSize = Number(loadData.size);
    const thresholdArea = settings?.cableCondition?.area || 50;

    const smallSizeMethods = ['A2', 'B2', 'D', 'E'];
    const largeSizeMethods = ['A1', 'B1', 'D', 'F'];

    if (circuitSize >= thresholdArea) {
        return largeSizeMethods.includes(baseMethod);
    } else {
        return smallSizeMethods.includes(baseMethod);
    }
};

/**
 * Get list of disabled options for method dropdown based on KEC rules
 * @param {object} loadData - Row data (wire, size)
 * @param {object} settings - KEC settings (cableCondition.area)
 * @returns {string[]} List of method names to disable
 */
export const getMethodDisabledOptions = (loadData, settings) => {
    if (!loadData) return [];

    const wire = loadData.wire;
    const circuitSize = Number(loadData.size) || 0;
    const thresholdArea = settings?.cableCondition?.area || 50;

    if (wire === 'HFIX') {
        return ['A2', 'B2', 'E', 'F'];
    }

    if (wire === 'FCV' || wire === 'FR8') {
        if (circuitSize >= thresholdArea) {
            return ['A2', 'B2', 'E'];
        } else {
            return ['A1', 'B1', 'F'];
        }
    }
    return [];
};

const SIZES = ['1.5', '2.5', '4', '6', '10', '16', '25', '35', '50', '70', '95', '120', '150', '185', '240', '300'];

export const calculateKECJudgment = (circuit, settings, projectInfo) => {
    const ib = Number(circuit.ib) || calculateIb(circuit, projectInfo);
    const izResult = calculateIz(circuit, settings);
    const iz = izResult.iz;
    const in_breaker = Number(circuit.at) || 0;
    const size = Number(circuit.size) || 0;

    // If essential data is missing, return empty status
    if (in_breaker === 0 || size === 0) {
        return {
            at_b: { status: '-' },
            at_th: { status: '-' },
            at_sc: { status: '-' },
            at_ms: { status: '-' },
            at_mi: { status: '-' },
            sb: { status: '-' },
            scb: { status: '-' },
            se: { status: '-' },
            ssc: { status: '-' }
        };
    }

    // 1. AT_TH Judgment (Overload Protection)
    const i2Type = settings?.cableCondition?.i2Type || 'industrial';
    let i2Multiplier = 1.0;
    if (i2Type === 'residential') {
        i2Multiplier = in_breaker <= 63 ? 1.45 : 1.52;
    } else {
        i2Multiplier = in_breaker <= 63 ? 1.3 : 1.37;
    }
    const i2 = in_breaker * i2Multiplier;
    const iz145 = iz * 1.45;
    const at_th_status = (i2 <= iz145) ? 'Ok' : 'Fail';

    // 2. AT_SC Judgment - Calculate tz and compare with tn
    // tz = (S * K / Isc)^2
    const kVal = settings?.shortCircuitSettings?.k || 143;
    const tn = settings?.shortCircuitSettings?.tn || 0.1;

    // Fetch parallel settings
    let isParallel = false;
    let kIsc = 1.0;
    const methodInput = (circuit.method || 'E').toUpperCase();
    if (methodInput.includes('X')) {
        isParallel = true;
        const factors = settings?.selectedFactors || {};
        const f9 = factors.factor9 || {};
        kIsc = f9.kIsc !== undefined ? Number(f9.kIsc) : 1.5;
    }

    // Get kA from CB table using CB type, P, AT, and AF values
    const cbType = circuit.type || '';
    const poles = circuit.p || '';
    const atValue = Number(circuit.at) || 0;
    const afValue = Number(circuit.af) || 0;

    // Lookup kA from CB_DATA based on CB type, P (poles), AT, and AF
    // CB.json structure: [0]=CB, [1]=TYPE, [2]=?, [3]=P(W), [4]=AT, [5]=AF, [6]=kA, [7]=비고
    const cbMatch = CB_DATA.find(row =>
        row[0] === cbType &&
        row[3]?.toString() === poles?.toString() &&
        Number(row[4]) === atValue &&
        Number(row[5]) === afValue
    );
    const scbKa = cbMatch ? Number(cbMatch[6]) : (Number(circuit.scb) || 0); // Fallback to circuit.scb if not found

    const isPercent = settings?.shortCircuitSettings?.is || 100; // factor (1) %
    let i_sc_actual = scbKa * 1000 * (isPercent / 100);

    // Apply KIsc if parallel
    if (isParallel) {
        i_sc_actual = i_sc_actual * kIsc;
    }

    let tz_calculated = 0;
    if (i_sc_actual > 0) {
        // [RESTORED] Use actual parallelN instead of hardcoded * 2
        const actualSize = isParallel ? size * (izResult.parallelN || 1) : size;
        tz_calculated = Math.pow((actualSize * kVal) / i_sc_actual, 2);
    }

    // AT_SC Status: tn ≤ tz
    const at_sc_status = (tn <= tz_calculated) ? 'Ok' : 'Fail';

    // 3. SB Judgment (Design Current vs Cable Capacity)
    const sb_status = (ib <= iz) ? 'Ok' : 'Fail';

    // SB Recommendation: Calculate based on single cable (ignore parallel xN)
    const singleCableCircuit = {
        ...circuit,
        method: (circuit.method || 'E').toUpperCase().split('X')[0]
    };
    const recommendedSize = calculateRecommendedSize(singleCableCircuit, settings, ib);

    // 4. SCB Judgment (Short Circuit Breaking Capacity)
    const icu = Number(circuit.scb) || 35;
    const scb_status = (ib <= in_breaker && in_breaker <= iz) ? 'Ok' : 'Fail';
    const scbRecommendedResult = calculateRecommendedSize(singleCableCircuit, settings, in_breaker);
    const cableDistance = Number(circuit.cableDistance || circuit.cableLength) || 15; // D in meters, default 15
    const powerFactor = Number(settings?.cableCondition?.powerFactor) || 0.8; // cosθ
    const cosTheta = powerFactor;
    const sinTheta = Math.sqrt(1 - cosTheta * cosTheta); // sinθ = √(1 - cos²θ)

    // Determine if single-core or multi-core based on size and threshold
    const thresholdArea = Number(settings?.cableCondition?.area) || 50;
    const circuitSize = Number(circuit.size) || 0;
    const isSingleCore = circuitSize >= thresholdArea;

    // Get R and X values from RX data (in Ω/km)
    const rxValues = getRXValues(circuit.wire || 'FCV', circuit.size, Number(circuit.p) || 4, isSingleCore);
    const r_per_km = rxValues.r; // R in Ω/km
    const x_per_km = rxValues.x; // X in Ω/km

    // Calculate total R and X for cable distance (D/1000 converts m to km)
    // Apply Parallel Conductor correction factors (KR, KX) if applicable
    let kr = 1.0;
    let kx = 1.0;
    if (isParallel) {
        const factors = settings?.selectedFactors || {};
        const f9 = factors.factor9 || {};
        kr = f9.kr !== undefined ? Number(f9.kr) : 0.5;
        kx = f9.kx !== undefined ? Number(f9.kx) : 0.75;
    }

    const r_total = r_per_km * (cableDistance / 1000) * kr;
    const x_total = x_per_km * (cableDistance / 1000) * kx;

    // Voltage drop calculation
    // e = K × (R×cosθ + X×sinθ) × IB
    // K values: 3상4선(P=4)=1, 단상2선(P=2)=1, 3상3선(P=3)=√3
    const p = Number(circuit.p) || 4;
    let K = 1;
    if (p === 3) {
        K = Math.sqrt(3);
    }

    // e = K × (R×cosθ + X×sinθ) × IB
    const e_v = K * (r_total * cosTheta + x_total * sinTheta) * ib;

    // E% = (e / V) × 100
    // V = 220 for 단상 (P=2), 380 for 3상 (P=3 or 4)
    const baseVoltage = p === 2 ? 220 : 380;
    const e_percent = (e_v / baseVoltage) * 100;

    // SE status: typically Ok if e% <= limit (default 3% or project setting)
    const limit = Number(projectInfo?.voltageDropLimit) || 3;
    const se_status = (e_percent <= limit) ? 'Ok' : 'Fail';

    const phaseLabel = p === 2 ? '1φ' : '3φ';

    // 7. AT_B Judgment (Breaker Coordination)
    // Condition: Ib <= In
    const at_b_status = (ib <= in_breaker) ? 'Ok' : 'Fail';

    // RECOMMENDATION: Find smallest AT > IB from CB_DATA
    const cbPhaseB = p === 2 ? 2 : 3;
    const cbPolesB = p;

    const recommendedInMatch = CB_DATA
        .filter(row => {
            if (!row || row.length < 5) return false;
            const rowType = String(row[0] || '').trim();
            const targetType = String(cbType || '').trim();
            if (rowType !== targetType) return false;

            const rowPhase = Number(row[2]);
            const rowPoles = Number(row[3]);

            if (rowPhase !== cbPhaseB) return false;
            if (rowPoles !== Number(cbPolesB)) return false;

            return true;
        })
        .map(row => Number(row[4]))
        .filter(at => at > ib)
        .sort((a, b) => a - b)[0];

    // 8. AT_MS Judgment (Motor Startup)
    // Condition: In >= (Ims * alpha) / delta
    const atmsAlpha = Number(settings?.marginFactors?.atms) || 1.0;
    const delta = Number(circuit.delta) || 0;
    const ims = Number(circuit.startingCurrent) || 0; // FixedStartingCurrent or calculated
    const ims_effective = ims * atmsAlpha;
    let at_ms_status = '-';
    let ims_delta = 0;
    let recommendedMsIn = '-';

    if (circuit.isGeneral) {
        at_ms_status = '-';
    } else if (delta > 0 && ims > 0) {
        ims_delta = ims_effective / delta;
        at_ms_status = (in_breaker >= ims_delta) ? 'Ok' : 'Fail';

        // RECOMMENDATION: Smallest AT > IMS/delta
        // Determine CB Phase (2 or 3) and Poles (2, 3, 4) from circuit.p
        const cbPhase = p === 2 ? 2 : 3;
        const cbPoles = p; // 2, 3, or 4

        recommendedMsIn = CB_DATA
            .filter(row => {
                if (!row || row.length < 5) return false;
                const rowType = String(row[0] || '').trim();
                const targetType = String(cbType || '').trim();
                if (rowType !== targetType) return false;

                const rowPhase = Number(row[2]);
                const rowPoles = Number(row[3]);

                if (rowPhase !== cbPhase) return false;
                if (rowPoles !== Number(cbPoles)) return false;

                return true;
            })
            .map(row => Number(row[4]))
            .filter(at => at > ims_delta) // Strictly greater than
            .sort((a, b) => a - b)[0] || 'N/A';
    }

    // 9. AT_MI Judgment (Motor Inrush - 기동돌입전류를 고려한 보호장치)
    // Condition: IN >= (IMI * alpha) / (delta or delta2)
    const atmiAlpha = Number(settings?.marginFactors?.atmi) || 1.0;
    const imi = Number(circuit.inrushCurrent) || 0;
    const imi_effective = imi * atmiAlpha;
    const globalK = Number(circuit.globalK) || 0;

    // Support dynamic multiplier selection
    const multiplierType = settings?.atMiMultiplierType || 'delta2';
    const multiplierValue = multiplierType === 'delta' ? (Number(circuit.delta) || 0) : (Number(circuit.delta2) || 0);

    let at_mi_status = '-';
    let imi_m_result = 0;
    let recommendedMiIn = '-';

    if (circuit.isGeneral) {
        at_mi_status = '-';
    } else if (multiplierValue > 0 && imi > 0) {
        imi_m_result = imi_effective / multiplierValue;
        at_mi_status = (in_breaker >= imi_m_result) ? 'Ok' : 'Fail';

        // RECOMMENDATION: Smallest AT >= IMI / multiplier
        const cbPhaseMi = p === 2 ? 2 : 3;
        const cbPolesMi = p;

        recommendedMiIn = CB_DATA
            .filter(row =>
                row[0] === cbType &&
                Number(row[2]) === cbPhaseMi &&
                Number(row[3]) === cbPolesMi
            )
            .map(row => Number(row[4]))
            .filter(at => at >= imi_m_result)
            .sort((a, b) => a - b)[0] || 'N/A';
    }

    return {
        at_b: {
            status: at_b_status,
            ib: ib,
            in: in_breaker,
            recommendedIn: recommendedInMatch || 'N/A',
            iz: iz,
            phase: phaseLabel
        },
        at_th: {
            status: at_th_status,
            ib: ib,
            i2: i2,
            iz145: iz145,
            iz: iz,
            baseIz: izResult.baseIz || iz,
            parallelN: izResult.parallelN || 1,
            parallelKg: izResult.parallelKg || 1,
            i2Type: i2Type,
            phase: phaseLabel
        },
        at_sc: {
            status: at_sc_status,
            tn: tn,
            tz_calculated: tz_calculated,
            iz: iz,
            isc: (scbKa * (isPercent / 100)) * (isParallel ? kIsc : 1.0), // ISC in kA, including KIsc if parallel
            isPercent: isPercent, // ISC percentage from settings
            kIsc: kIsc,
            isParallel: isParallel,
            ka1: 0,
            ka2: 0,
            ka3: 0,
            phase: phaseLabel
        },
        at_ms: {
            status: at_ms_status,
            delta: delta > 0 ? delta : '-',
            ims: ims > 0 ? ims : '-',
            ims_delta: ims_delta,
            recommendedIn: recommendedMsIn,
            alpha: atmsAlpha,
            k: '규약동작배율' // Just a label
        },
        at_mi: {
            status: at_mi_status,
            globalK: globalK > 0 ? globalK : '-',
            imi: imi > 0 ? imi : '-',
            multiplierType: multiplierType,
            multiplierValue: multiplierValue > 0 ? multiplierValue : '-',
            imi_status_val: imi_m_result,
            recommendedIn: recommendedMiIn,
            alpha: atmiAlpha
        },
        sb: {
            status: sb_status,
            ib: ib,
            in: in_breaker,
            recommendedSize: recommendedSize.size,
            correctedIz: recommendedSize.iz,
            appliedFactor: izResult.factor, // [ADDED] 적용 도체에 대한 실제 보정계수
            totalFactor: recommendedSize.factor,
            parallelN: izResult.parallelN || 1,
            phase: phaseLabel,
            wire: circuit.wire || 'FCV',
            method: circuit.method || 'E',
            isParallelRecommendation: recommendedSize.isParallelRecommendation || false,
            recommendedParallelN: recommendedSize.parallelN || 1,
            recommendedParallelKg: recommendedSize.parallelKg || 1
        },
        scb: {
            status: scb_status,
            ib: ib,
            is: icu,
            iz: iz,
            recommendedSize: scbRecommendedResult.size,
            correctedIz: scbRecommendedResult.iz,
            parallelN: izResult.parallelN || 1,
            isParallelRecommendation: scbRecommendedResult.isParallelRecommendation || false,
            recommendedParallelN: scbRecommendedResult.parallelN || 1,
            recommendedParallelKg: scbRecommendedResult.parallelKg || 1
        },
        se: {
            status: se_status,
            d: cableDistance,
            e_percent: e_percent.toFixed(2),
            e_v: e_v.toFixed(2),
            limit: limit,
            r: (r_per_km / 1000 * cableDistance).toFixed(4),
            x: (x_per_km / 1000 * cableDistance).toFixed(4),
            r_per_km: r_per_km,
            x_per_km: x_per_km,
            cos_theta: cosTheta.toFixed(1),
            sin_theta: sinTheta.toFixed(1),
            isParallel: isParallel,
            kr: kr,
            kx: kx
        },
        smse: (() => {
            // 10. SMSe% Judgment (Motor Starting Voltage Drop)
            // IMS (기동전류)를 사용하여 전압강하 계산
            // [MODIFIED] Always return insulation regardless of ims
            const seKColIdx = settings?.seSettings?.selectedK?.colIdx;
            const insulation = (seKColIdx === 4) ? 'XLPE' : 'PVC';

            if (ims > 0) {
                // 기동시 역률 적용 (기본값 0.3)
                const startCos = Number(settings?.smseSettings?.startingPowerFactor) || 0.3;
                const startSin = Math.sqrt(1 - Math.pow(startCos, 2));

                const n = izResult.parallelN || 1;
                // Apply Parallel Conductor correction factors (KR, KX) for SMSe calculation as well
                let kr_smse = 1.0;
                let kx_smse = 1.0;
                if (isParallel) {
                    const factors = settings?.selectedFactors || {};
                    const f9 = factors.factor9 || {};
                    kr_smse = f9.kr !== undefined ? Number(f9.kr) : 0.5;
                    kx_smse = f9.kx !== undefined ? Number(f9.kx) : 0.75;
                }

                // Voltage drop for parallel circuit: Drop is reduced by n and affected by factors
                const e_v_ims = (K * ((r_total / kr) * kr_smse * startCos + (x_total / kx) * kx_smse * startSin) * ims) / n;
                const e_percent_ims = (e_v_ims / baseVoltage) * 100;

                // 기준강하율 (E_limit) 선정
                const isFeeder = !!(circuit.isPanel || circuit.isFeeder);
                const smseLimits = settings?.smseSettings || { singleLimit: 15, feederLimit: 10 };
                const startingLimit = Number(isFeeder ? smseLimits.feederLimit : smseLimits.singleLimit) || (isFeeder ? 10 : 15);

                const smse_status = (e_percent_ims <= startingLimit) ? 'Ok' : 'Fail';

                // 추천 단면적 계산 루프: 단일 케이블 기준 (n=1)
                let smseRecommendedSize = '300+';
                for (const s of SIZES) {
                    const sNum = Number(s);
                    const isSC = sNum >= thresholdArea;
                    const rx = getRXValues(circuit.wire || 'FCV', s, Number(circuit.p) || 4, isSC);
                    const r_t = (rx.r * cableDistance) / 1000;
                    const x_t = (rx.x * cableDistance) / 1000;
                    const e_v_temp = K * (r_t * startCos + x_t * startSin) * ims;
                    const e_p_temp = (e_v_temp / baseVoltage) * 100;

                    if (e_p_temp <= startingLimit) {
                        smseRecommendedSize = s;
                        break;
                    }
                }

                return {
                    status: smse_status,
                    e_v: e_v_ims.toFixed(2),
                    e_percent: e_percent_ims.toFixed(2),
                    limit: startingLimit,
                    recommendedSize: smseRecommendedSize,
                    appliedSize: circuit.size,
                    parallelN: n,
                    kr: kr_smse,
                    kx: kx_smse,
                    ims: ims.toFixed(2)
                };
            }
            return { status: '-' };
        })(),
        ssc: (() => {
            // SSC 계산: (ISC × √tn / K) × α = SSC [㎟]
            // [MODIFIED] Use i_sc_actual which already has kIsc applied if isParallel
            const isc_A = i_sc_actual;
            const alpha = settings?.shortCircuitSettings?.alpha || 1.0;
            const ssc_calculated = (isc_A * Math.sqrt(tn) / kVal) * alpha;

            // 추천 단면적: SSC보다 크거나 같은 가장 작은 표준 단면적
            let recommendedSize = '300+';
            for (const s of SIZES) {
                if (Number(s) >= ssc_calculated) {
                    recommendedSize = s;
                    break;
                }
            }

            // Status: 선정(size) >= ssc_calculated면 Ok, 그렇지 않으면 Fail
            const circuitSize = Number(circuit.size) || 0;
            const status = circuitSize >= ssc_calculated ? 'Ok' : 'Fail';
            const kColIdx = settings?.shortCircuitSettings?.selectedK?.colIdx;
            const insulation = (kColIdx === 4) ? 'XLPE' : 'PVC';

            return {
                status: status,
                size: circuitSize,
                type: '신설',
                isc: i_sc_actual / 1000, // [MODIFIED] 반영된 예상 ISC [kA]
                tn: tn, // 차단시간 [s] from settings
                tz: tz_calculated, // 계산된 tz [s]
                k: kVal, // K 계수 (절연물에 따른)
                alpha: alpha, // 여유 계수 α
                ssc_calculated: ssc_calculated,
                recommendedSize: recommendedSize,
                insulation: insulation,
                isPercent: isPercent,
                isParallel: isParallel, // [ADDED] UI 표시용
                kIsc: kIsc, // [ADDED] UI 표시용
                n: isParallel ? (izResult.parallelN || 1) : 1 // [ADDED] UI xn 표시용
            };
        })(),
        smsth: (() => {
            // SMSTh 계산: S [㎟] ≥ [(IMS * √tm) / (K × n)] × α
            const ims = Number(circuit.startingCurrent) || 0;
            const tm = Number(circuit.startingTime) || 0;
            const alpha = settings?.smsthSettings?.alpha || 1.0;
            const kVal_smsth = settings?.smsthSettings?.k || 143;

            const kColIdx = settings?.smsthSettings?.selectedK?.colIdx;
            const insulation = (kColIdx === 4) ? 'XLPE' : 'PVC';

            // [MODIFIED] Use parallelN from calculation if isParallel ('X' condition)
            const n = isParallel ? (izResult.parallelN || 1) : (settings?.smsthSettings?.n || 1);

            if (ims === 0 || tm === 0) return { status: '-' };

            const smsth_calculated = ((ims * Math.sqrt(tm)) / (kVal_smsth * n)) * alpha;

            // 추천 단면적: smsth_calculated 보다 크거나 같은 가장 작은 표준 단면적
            let recommendedSize = '300+';
            for (const s of SIZES) {
                if (Number(s) >= smsth_calculated) {
                    recommendedSize = s;
                    break;
                }
            }

            const circuitSize = Number(circuit.size) || 0;
            const status = (circuitSize >= smsth_calculated) ? 'Ok' : 'Fail';

            return {
                status: status,
                appliedSize: circuit.size,
                recommendedSize: recommendedSize,
                smsth_calculated: smsth_calculated,
                ims: ims,
                tm: tm,
                n: n,
                insulation: insulation,
                k: kVal_smsth,
                alpha: alpha,
                isParallel: isParallel // [ADDED] UI xn 표시 트리거용
            };
        })()
    };
};

const calculateIb = (circuit, projectInfo) => {
    const power = Number(circuit.power) || 0;
    const p = Number(circuit.p) || 4;

    if (p === 2) {
        return power / 220;
    } else {
        return power / (380 * Math.sqrt(3));
    }
};

const calculateIz = (circuit, settings) => {
    const wire = circuit.wire || 'FCV';
    let methodInput = (circuit.method || 'E').toUpperCase();
    const size = circuit.size?.toString() || '2.5';
    const p = Number(circuit.p) || 4;

    // --- Parallel Conductor Parsing ---
    let parallelN = 1;
    let parallelKg = 1.0;

    // Check if method includes 'X' (e.g., 'B1X2')
    if (methodInput.includes('X')) {
        const parts = methodInput.split('X');
        methodInput = parts[0]; // The actual base method (e.g., 'B1')
        parallelN = Number(parts[1]) || 1;
        // Fetch Kg from settings (Factor 9)
        const factors = settings?.selectedFactors || {};
        // Support both new {kg} and old {value} structure
        const f9 = factors.factor9;
        parallelKg = f9?.kg !== undefined ? Number(f9.kg) : (f9?.value !== undefined ? Number(f9.value) : 0.8);
    }

    const method = methodInput;

    // Restriction: HFIX only for A1, B1, D (D1)
    if (wire === 'HFIX' && !['A1', 'B1', 'D', 'D1'].includes(method)) {
        return { iz: 0, factor: 1, baseIz: 0, parallelN: 1, parallelKg: 1 };
    }

    // Select phase table: P=2 is 1p, P=3 or 4 is 3p
    const phaseKey = p === 2 ? '1p' : '3p';

    // Default to XLPE_90C table
    const table = CABLE_CAPACITY['XLPE_90C'];

    // Map Method to Table Row
    const rowKey = method === 'D' ? 'D1' : method;

    const baseCapacity = table?.[phaseKey]?.[rowKey]?.[size] || 0;

    // Apply correction factors from settings
    const factors = settings?.selectedFactors || {};
    const f2 = factors.factor2?.value || 1;
    const f3 = factors.factor3?.value || 1;
    const f4 = factors.factor4?.value || 1;
    const f5 = factors.factor5?.value || 1;
    const f6 = factors.factor6?.value || 1;

    let totalFactor = 1.0;
    if (['A1', 'B1', 'A2', 'B2'].includes(method)) {
        // Temperature (f3) only for conduit methods
        totalFactor = f3;
    } else if (['E', 'F'].includes(method)) {
        // Temperature (f3) and Grouping (f2) for tray methods
        totalFactor = f2 * f3;
    } else if (method === 'D1' || method === 'D') {
        // Soil factors for underground
        totalFactor = f4 * f5 * f6;
    }

    const baseIz = baseCapacity * totalFactor;

    // Final Iz Calculation (Parallel Condutor applied)
    // Itotal = (Iz * n) * Kg
    let finalIz = baseIz;
    if (parallelN > 1) {
        finalIz = (baseIz * parallelN) * parallelKg;
    }

    return {
        iz: finalIz,
        factor: totalFactor,
        baseIz: baseIz,
        parallelN: parallelN,
        parallelKg: parallelKg
    };
};

const calculateRecommendedSize = (circuit, settings, targetCurrent) => {
    if (!targetCurrent || targetCurrent === 0) return { size: '-', iz: 0, factor: 1, parallelN: 1, parallelKg: 1, isParallelRecommendation: false };

    // 1단계: 단일 도체 탐색 (기존 로직)
    for (const size of SIZES) {
        const tempCircuit = { ...circuit, size };
        const result = calculateIz(tempCircuit, settings);
        if (result.iz >= targetCurrent) {
            return { size, iz: result.iz, factor: result.factor, parallelN: 1, parallelKg: 1, isParallelRecommendation: false };
        }
    }

    // 2단계: 병렬도체 탐색 (50㎟ 이상, N=2~4)
    // Kg(집합보정계수)를 settings에서 가져옴
    const factors = settings?.selectedFactors || {};
    const f9 = factors.factor9;
    const kg = f9?.kg !== undefined ? Number(f9.kg) : (f9?.value !== undefined ? Number(f9.value) : 0.8);

    const PARALLEL_SIZES = SIZES.filter(s => Number(s) >= 50); // 50㎟ 이상
    const MAX_N = 4;

    for (let n = 2; n <= MAX_N; n++) {
        for (const size of PARALLEL_SIZES) {
            const tempCircuit = { ...circuit, size };
            const result = calculateIz(tempCircuit, settings);
            // 보정전류(baseIz=보정계수 적용된 Iz) × Kg × N >= targetCurrent
            const parallelIz = result.iz * kg * n;
            if (parallelIz >= targetCurrent) {
                return {
                    size,
                    iz: parallelIz,
                    factor: result.factor,
                    parallelN: n,
                    parallelKg: kg,
                    isParallelRecommendation: true
                };
            }
        }
    }

    // 3단계: 병렬로도 불가능한 경우
    const baseResult = calculateIz({ ...circuit, size: SIZES[0] }, settings);
    return { size: 'WIRE/공사 Chk', iz: 0, factor: baseResult.factor, parallelN: 1, parallelKg: 1, isParallelRecommendation: false };
};

/**
 * 패널 데이터에서 전체 부하량(Total VA)을 계산합니다.
 * @param {Object} data - 패널 상세 데이터 (leftCircuits, rightCircuits 또는 feeders 포함)
 * @returns {number} - 전체 부하량 [VA]
 */
export const calculatePanelTotalLoad = (data) => {
    if (!data) return 0;

    // [NEW] UPS/변압기 등 정격 용량(Capacity) 기반 판넬 우선 처리
    // projectInfo에 mainCapacity 필드가 정의되어 있다면, 하위 부하 합계 대신 이 값을 부모에게 전달할 부하량으로 사용합니다.
    const mainCap = data.projectInfo?.mainCapacity;
    if (mainCap !== undefined && mainCap !== null && mainCap !== "") {
        const numericCap = Number(mainCap);
        if (!isNaN(numericCap)) {
            return Math.round(numericCap * 1000);
        }
    }

    let totalVA = 0;

    // PanelLoad 형식 (분전반 부하 계산서)
    if (data.leftCircuits || data.rightCircuits) {
        ['leftCircuits', 'rightCircuits'].forEach(side => {
            if (data[side]) {
                data[side].forEach(c => {
                    // 회로에 직접 입력된 power가 있으면 우선 시용
                    if (c.power !== undefined && c.power !== "" && c.power !== null) {
                        totalVA += Number(c.power);
                    }
                    // 하위 부하 리스트가 있으면 합산
                    else if (c.loads) {
                        c.loads.forEach(load => {
                            totalVA += (Number(load.qty) || 0) * (Number(load.va) || 0);
                        });
                    }
                });
            }
        });
    }
    // PowerLoadContent 형식 (동력 부하 계산서) 및 UPS 형식
    else if (data.powerLoads) {
        // cachedTotalLoad 우선 사용 (런타임 계산 결과 캐싱 값)
        if (data.projectInfo?.cachedTotalLoad !== undefined && data.projectInfo.cachedTotalLoad !== null) {
            totalVA = Number(data.projectInfo.cachedTotalLoad) || 0;
        } else {
            // 폴백: 원시 데이터 기반 계산 (LOAD: apparentPower/kva, MOTOR/PUMP: effectivePower kW)
            data.powerLoads.forEach(load => {
                if (load.type === 'SPARE' || load._deleted) return;
                
                // 1. UPS 형식 (kva 필드 우선)
                if (load.kva !== undefined && load.kva !== null && load.kva !== "") {
                    totalVA += (Number(load.kva) || 0) * 1000;
                }
                // 2. PowerLoadContent 형식 (MOTOR/PUMP: effectivePower kW)
                else if (load.type === 'MOTOR' || load.type === 'PUMP') {
                    const kw = Number(load.effectivePower) || 0;
                    const pf = Number(load.powerFactor) || 0.85;
                    const eff = Number(load.efficiency) || 0.9;
                    if (pf > 0 && eff > 0) {
                        totalVA += (kw / (pf * eff)) * 1000;
                    }
                } 
                // 3. PowerLoadContent 형식 (LOAD: apparentPower kVA)
                else {
                    totalVA += (Number(load.apparentPower) || 0) * 1000;
                }
            });
        }
    }
    // PanelFeederContent 형식 (분전반 간선 계산서)
    else if (data.feeders) {
        data.feeders.forEach(f => {
            // 간선 계산서의 경우 kVA를 VA로 환산하여 합산
            totalVA += (Number(f.demandKva) || 0) * 1000;
        });
    }

    return Math.round(totalVA);
};

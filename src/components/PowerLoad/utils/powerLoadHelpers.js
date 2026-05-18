import CB_DATA from '../../../data/CB.json';
import MCC_DATA from '../../../data/MCC.json';

/**
 * 중복된 패널 이름이 있는지 확인합니다.
 */
export const isNameDuplicate = (project, name, excludeId = null) => {
    if (!project || !project.calculators) return false;

    const checkInItems = (items) => {
        for (const item of items) {
            if (item.id !== excludeId && (item.name?.trim() || '') === name.trim()) {
                return true;
            }
            if (item.children && checkInItems(item.children)) {
                return true;
            }
        }
        return false;
    };

    return checkInItems(project.calculators);
};

/**
 * 상(Phase) 문자열을 표준화합니다.
 */
export const normalizePhase = (p) => {
    if (!p) return '';
    return String(p).replace(/[-\s]/g, '').replace(/Ø|ø/g, 'Φ').toUpperCase();
};

/**
 * 차단기 타입, 극수, AT 값을 기준으로 AF 값을 조회합니다.
 */
export const getAFValue = (cbType, poles, at) => {
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

        return rowCB === upperCB &&
            rowPhase === circuitPhaseNum &&
            rowPoles === numPoles &&
            rowAT === numAT;
    });

    if (match) return { af: match[5], error: '' };
    return { af: 'ERR', error: 'Chk.' };
};

/**
 * 상(Phase)에 따른 기본 전압을 반환합니다.
 */
export const getVoltageByPhase = (phase) => {
    if (!phase) return null;
    const cleanPh = String(phase).replace(/[-\s]/g, '').replace(/Ø/g, 'Φ').toUpperCase();
    if (cleanPh.includes('1Φ2W') || cleanPh.includes('1Ø')) return 220;
    return 380;
};

/**
 * MCC 데이터를 조회합니다.
 */
export const findMCCData = (type, phase, method, kw) => {
    if (type !== 'MOTOR' && type !== 'PUMP') return null;
    if (!kw) return null;

    const numKW = parseFloat(kw);
    const match = MCC_DATA.find(row => {
        const rMethod = row[0];
        const rKW = parseFloat(row[1]);
        const rPhase = row[2] ? row[2].toString() : '3';

        if (rMethod !== method) return false;
        
        let targetPhaseStr = '3';
        const cleanPh = String(phase || '').replace(/[-\s]/g, '').replace(/Ø/g, 'Φ').toUpperCase();
        if (cleanPh.includes('1Φ')) targetPhaseStr = '2';

        if (rPhase !== targetPhaseStr) return false;
        return rKW === numKW;
    });

    if (match) {
        return {
            efficiency: match[4],
            powerFactor: match[5],
            startingTime: match[13],
            ct: match[14],
            capacitor: match[15],
            unitSize: match[16],
            c: match[8],
            lambda: match[9]
        };
    }
    return null;
};

// 기동방식 배수 상수
export const STARTING_MULTIPLIER = {
    'DOL': 6,
    'Y-D': 2,
    'INV': 1,
    '리액터': 4
};

/**
 * 상(Phase)별 전력 계통 레벨을 반환합니다.
 */
export const PHASE_LEVELS = {
    '1Φ2W': 1,
    '1Φ-2W': 1,
    '3Φ3W': 2,
    '3Φ-3W': 2,
    '3Φ4W': 3,
    '3Φ-4W': 3,
    '1φ2W': 1,
    '1φ-2W': 1,
    '1Ø-2W': 1,
};

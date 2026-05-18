import CB_DATA from '../../../data/CB.json';

// Derive unique breaker types from CB_DATA
export const BREAKER_TYPES = [...new Set(
    CB_DATA.filter(row => row[0] && typeof row[3] === 'number')
        .map(row => row[0])
)].sort();

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

// 기동방식 배수
export const STARTING_MULTIPLIER = {
    'DOL': 6,
    'Y-D': 2,
    'INV': 1,
    '리액터': 4
};

// PHASE별 전압 자동 결정
export const getVoltageByPhase = (phase) => {
    if (!phase) return null;
    const p = phase.toString();
    if (p.includes('1Φ2W') || p.includes('1φ2W') || p.includes('1Ø')) return 220;
    return 380;
};

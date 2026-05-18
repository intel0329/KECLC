import CB_DATA from '../../../data/CB.json';

// Helper for duplicate name check
export const isNameDuplicate = (project, name, excludeId = null) => {
    if (!project || !project.calculators) return false;

    const checkInItems = (items) => {
        for (const item of items) {
            // ID가 다르고 이름이 같은 경우 중복으로 간주 (이름 부재 시 안전하게 처리)
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

// Helper to get Startup Multiplier (delta)
export const getStartupMultiplier = (tm, p, at, tccData) => {
    if (!tccData || !tm || !at) return 0;

    // Determine Phase Key
    // P=1 or 2 -> 1P (Assuming 1P/single phase uses 1P table)
    // P>=3 -> 3P (Assuming 3P uses 3P table)
    const poles = Number(p) || 3;
    const typeKey = poles <= 2 ? 'singlePhase' : 'threePhase';
    const headersKey = poles <= 2 ? 'singlePhaseHeaders' : 'threePhaseHeaders';

    const data = tccData[typeKey];
    const headers = tccData[headersKey];

    if (!data || !headers) return 0;

    // Find Column Index by tm (header match)
    const tmStr = String(tm).trim();
    const colIndex = headers.findIndex(h => String(h).trim() === tmStr);

    if (colIndex === -1) return 0;

    // Find Row by AT (Exact match on row key)
    const atStr = String(at).trim();
    const rowData = data[atStr];

    if (!rowData) return 0;

    return Number(rowData[colIndex]) || 0;
};

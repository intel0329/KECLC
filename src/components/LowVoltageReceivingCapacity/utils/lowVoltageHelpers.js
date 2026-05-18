import CB_DATA from '../../../data/CB.json';

// Helper for duplicate name check
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

// PHASE별 전압 자동 결정
export const getVoltageByPhase = (phase) => {
    if (!phase) return null;
    const p = phase.toString();
    if (p.includes('1Φ2W') || p.includes('1φ2W') || p.includes('1Ø')) return 220;
    return 380;
};

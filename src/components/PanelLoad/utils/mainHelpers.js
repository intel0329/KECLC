import CB_DATA from '../../../data/CB.json';

// Helper to normalize phase string
export const normalizePhase = (p) => {
    if (!p) return '';
    return String(p).replace(/[-\s]/g, '').replace(/Ø|ø/g, 'Φ').toUpperCase();
};

/**
 * 프로젝트 내 중복 이름 검사 유틸리티
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

export const getAFValue = (cbType, poles, at) => {
    if (!cbType || !poles || !at) return { af: '', error: '' };

    const upperCB = cbType.toString().trim().toUpperCase();
    const numPoles = Number(poles);
    const numAT = Number(at);

    // Try numeric match first
    const match = CB_DATA.find(row => {
        const rowCB = row[0]?.toString().trim().toUpperCase();
        const rowPoles = Number(row[3]);
        const rowAT = Number(row[4]);

        return rowCB === upperCB && rowPoles === numPoles && rowAT === numAT;
    });

    if (match) return { af: match[5], error: '' };

    // Fallback for string comparison
    const strPoles = poles.toString().trim();
    const strAT = at.toString().trim();

    const fallbackMatch = CB_DATA.find(row =>
        row[0]?.toString().trim().toUpperCase() === upperCB &&
        row[3]?.toString().trim() === strPoles &&
        row[4]?.toString().trim() === strAT
    );

    if (fallbackMatch) return { af: fallbackMatch[5], error: '' };

    // Final check: Maybe CB Chk?
    const hasCB = CB_DATA.some(row => row[0]?.toString().trim().toUpperCase() === upperCB);
    if (!hasCB) return { af: 'ERR', error: 'CB Chk.' };

    return { af: 'ERR', error: 'AT Chk.' };
};

export const getStatusColor = (status) => {
    if (status === 'Ok' || (typeof status === 'number' && !isNaN(status))) return 'text-green-500';
    if (status === '-' || !status) return 'text-gray-500';
    return 'text-red-500';
};

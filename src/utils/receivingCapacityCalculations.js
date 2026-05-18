
import CB_DATA from '../data/CB.json';

// MOF 퓨즈 정격 데이터
const FUSE_RATINGS = [
    { a: 5, ka: 40 }, { a: 10, ka: 40 }, { a: 16, ka: 40 }, { a: 20, ka: 40 },
    { a: 25, ka: 40 }, { a: 30, ka: 40 }, { a: 40, ka: 40 }, { a: 50, ka: 40 },
    { a: 63, ka: 40 }, { a: 75, ka: 25 }, { a: 100, ka: 25 }, { a: 125, ka: 25 },
    { a: 160, ka: 25 }, { a: 200, ka: 25 }
];

const getAFValue = (type, poles, at) => {
    if (!type || !poles || !at) return { af: '' };
    const numPoles = Number(poles);
    const numAT = Number(at);
    const upperType = type.toString().trim().toUpperCase();

    // CB_DATA structure: [0:Type, 1:kA, 2:Phase(2 or 3), 3:Poles, 4:AT, 5:AF, 6:kA_value]
    const match = CB_DATA.find(row => {
        const rowType = row[0]?.toString().trim().toUpperCase();
        const rowPhase = Number(row[2]);
        const rowPoles = Number(row[3]);
        const rowAT = Number(row[4]);
        const circuitPhaseNum = numPoles === 2 ? 2 : 3;

        return rowType === upperType &&
            rowPhase === circuitPhaseNum &&
            rowPoles === numPoles &&
            rowAT === numAT;
    });

    if (match) return { af: match[5] };
    return { af: '' };
};

/**
 * MOF 및 계통 관련 정밀 데이터를 계산합니다.
 */
export const calculateMofData = (mainCapacity, options = {}) => {
    const { mofDatabase = [], fuseSettings = {}, mccSettings = {} } = options;
    const capacity = Number(mainCapacity) || 0;
    
    // 1. 기본값 초기화
    let result = { 
        pt: '-', ct: '-', ocs: '-', primaryPF: '-', trSidePF: '-', 
        af: '-', icu: '-', am: '-', kv: '-', type: 'ACB' 
    };

    if (capacity === 0) return result;

    // 2. PRD.csv 기반 데이터 매칭 (mofDatabase가 제공된 경우)
    if (mofDatabase.length > 0) {
        // [FIX] 대소문자 및 공백에 유연하게 대응
        const sectionIdx = mofDatabase.findIndex(row => 
            row[0]?.toString().toUpperCase().includes('POWER SYSTEM STANDARDS') ||
            row[0]?.toString().includes('수변전설비')
        );
        
        // 섹션 인덱스가 없어도 전체에서 용량 매칭 시도
        const startIdx = sectionIdx !== -1 ? sectionIdx : 0;
        const match = mofDatabase.find((row, i) => 
            i > startIdx && 
            row[0]?.toString().trim() === capacity.toString().trim() &&
            row[4] // CT 값이 비어있지 않은 행 우선
        );
        
        if (match) {
            result = {
                pt: (match[3] || '-').toString().replace(/V/g, '').trim(), 
                ct: (match[4] || '-').toString().replace(/ A/g, '').trim(), 
                ocs: match[5] || '-',
                primaryPF: match[2] || '-', 
                trSidePF: match[6] || '-',
                af: match[12] || '-', 
                icu: match[13] || '-',
                kv: '690', am: '-', type: 'ACB'
            };

            // 퓨즈 계산 로직 (PRD 기반)
            const i_n1 = parseFloat(match[1]);
            if (!isNaN(i_n1)) {
                let multiplier = 1.4;
                if (fuseSettings) {
                    if (capacity <= 150) multiplier = fuseSettings['100 ~ 150kVA'] || 2.0;
                    else if (capacity <= 300) multiplier = fuseSettings['200 ~ 300kVA'] || 1.5;
                    else if (capacity <= 450) multiplier = fuseSettings['350 ~ 450kVA'] || 1.5;
                    else if (capacity <= 700) multiplier = fuseSettings['500 ~ 700kVA'] || 1.5;
                    else if (capacity <= 1000) multiplier = fuseSettings['750 ~ 1000kVA'] || 1.25;
                    else if (capacity <= 1600) multiplier = fuseSettings['1050 ~ 1600kVA'] || 1.5;
                }
                const target = i_n1 * multiplier;
                const bestMatch = FUSE_RATINGS.find(r => r.a >= target) || FUSE_RATINGS[FUSE_RATINGS.length - 1];
                result.primaryPF = `${bestMatch.a}A / ${bestMatch.ka}kA`;
                result.trSidePF = result.primaryPF;
            }

            // VCB/ACB 자동 선정 로직 (이후 생략... 현재 로직 유지)
            // ... (생략된 ACB/VCB 로직은 그대로 유지됨)
            if (capacity >= 1000) {
                const inCurrent = capacity / (Math.sqrt(3) * 22.9);
                const vcbIdx = mofDatabase.findIndex(row => row.some(col => String(col).includes('Vacuum') && String(col).includes('Breaker')));
                if (vcbIdx !== -1) {
                    const vMatch = mofDatabase.find((row, i) => {
                        if (i <= vcbIdx + 2) return false;
                        const rated = parseFloat(String(row[0]).replace(/[^0-9.]/g, ''));
                        return !isNaN(rated) && rated > inCurrent;
                    });
                    if (vMatch) {
                        result.type = 'VCB';
                        result.am = String(vMatch[0] || '').trim();
                        result.af = String(vMatch[1] || '').trim();
                        result.icu = String(vMatch[2] || '').trim();
                        result.kv = String(vMatch[3] || '').trim();
                    }
                }
            }

            if (result.type === 'ACB') {
                const acbIdx = mofDatabase.findIndex(row => row.some(col => String(col).includes('Air Circuit Breaker') || String(col).includes('기중차단기')));
                if (acbIdx !== -1) {
                    const tAF = parseFloat(String(result.af).replace(/[^0-9.]/g, ''));
                    const tICU = parseFloat(String(result.icu).replace(/[^0-9.]/g, ''));
                    const aMatch = mofDatabase.find((row, i) => {
                        if (i <= acbIdx + 2) return false;
                        const rAF = parseFloat(String(row[1]).replace(/[^0-9.]/g, ''));
                        const rICU = parseFloat(String(row[2]).replace(/[^0-9.]/g, ''));
                        return rAF === tAF && rICU === tICU;
                    });
                    if (aMatch) result.am = String(aMatch[0] || '').trim();
                }
            }
            return result;
        }
    }

    // Fallback: 약식 계산
    const primaryCurrent = (capacity / (Math.sqrt(3) * 22.9));
    const ctRatio = primaryCurrent * 1.5;
    const standardCTs = [5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100, 150, 200, 250, 300, 400];
    const ctVal = standardCTs.find(v => v >= ctRatio) || 400;
    
    result = { 
        ...result, 
        pt: "13200 / 110", 
        ct: `${ctVal} / 5`, 
        ocs: Math.round(7000 / ctVal),
        primaryPF: '-' 
    };
    
    const targetA = primaryCurrent * 1.5;
    const fuseMatch = FUSE_RATINGS.find(r => r.a >= targetA);
    if (fuseMatch) result.primaryPF = `${fuseMatch.a}A / ${fuseMatch.ka}kA`;

    return result;
};

/**
 * 절연 방식(Type) 리스트를 생성합니다. (단일화 포인트)
 */
export const calculateInsulationTypes = (powerLoads, panelsData, fallbackType = 'OIL') => {
    const types = new Set();
    powerLoads.forEach(l => {
        // bankId (변압기 뱅크) 또는 connectedPanelId (하위 패널) 양쪽 모두에서 추출 시도
        const targetId = l.bankId || l.connectedPanelId;
        if (targetId && panelsData[targetId]) {
            const pi = panelsData[targetId].projectInfo;
            // usageType 또는 insulationType 필드 모두 확인
            const typeValue = pi?.usageType || pi?.insulationType;
            if (typeValue && typeValue !== '-') {
                types.add(typeValue);
            }
        }
    });
    const result = Array.from(types).sort();
    return result.length > 0 ? result : [fallbackType];
};

/**
 * 하위 패널의 총 부하를 직접 계산합니다. (캐시가 없을 경우 대비)
 */
const calculateTotalLoadFromData = (data) => {
    if (!data) return 0;
    let total = 0;
    if (data.leftCircuits) total += data.leftCircuits.reduce((sum, c) => sum + (Number(c.power) || 0), 0);
    if (data.rightCircuits) total += data.rightCircuits.reduce((sum, c) => sum + (Number(c.power) || 0), 0);
    return total;
};

/**
 * 변압기 부하 리스트 계산 처리 (전기수용설비 - 갑지 전용)
 */
export const calculateReceivingCapacityExportData = (powerLoads, panelsData = {}) => {
    return powerLoads.map((load) => {
        let currentLoad = { ...load };

        // 1. 하위 패널 데이터 연동
        if (load.connectedPanelId && panelsData[load.connectedPanelId]) {
            const subPanel = panelsData[load.connectedPanelId];
            if (subPanel.projectInfo) {
                const pi = subPanel.projectInfo;
                currentLoad.phase = pi.phase || currentLoad.phase || '3Φ-4W';
                currentLoad.voltage = pi.voltage || currentLoad.voltage || '380V';
                currentLoad.location = pi.location || currentLoad.location || '-';
                currentLoad.at = pi.mccbAT || currentLoad.at || '-';
                currentLoad.af = pi.mccbAF || currentLoad.af || '-';
                currentLoad.cbType = pi.mainBreakerType || currentLoad.cbType || 'MCCB';
                currentLoad.subPanelBreakerType = pi.mainBreakerType || currentLoad.cbType || 'MCCB';
                currentLoad.demandFactor = pi.demandFactor || currentLoad.demandFactor || '100';
                currentLoad.diversityFactor = pi.diversityFactor || currentLoad.diversityFactor || '1.0';

                const ph = String(currentLoad.phase).replace(/[-\s]/g, '').replace(/Ø/g, 'Φ').toUpperCase();
                if (ph.includes('1Φ')) currentLoad.cbP = '2';
                else if (ph.includes('3Φ3W')) currentLoad.cbP = '3';
                else if (ph.includes('3Φ4W')) currentLoad.cbP = '4';

                // 부하 용량 계산 (캐시 우선, 없으면 직접 계산)
                const finalVA = pi.cachedTotalLoad || calculateTotalLoadFromData(subPanel);
                currentLoad.apparentPower = (Number(finalVA) / 1000).toFixed(2);

                const v = Number(String(currentLoad.voltage).replace('V', '')) || 380;
                const is3Ph = currentLoad.phase.includes('3Φ') || currentLoad.phase.includes('3Ø');
                currentLoad.subPanelTotalCurrent = finalVA > 0 ? (finalVA / (is3Ph ? (v * 1.7320508) : v)).toFixed(2) : 0;

                // [Fix] 하위 패널 차단기 데이터로부터 kA 값 유치
                if (pi.mainBreakerType && pi.mccbAF && pi.mccbAT) {
                    const match = CB_DATA.find(row => 
                        row[0] === pi.mainBreakerType && 
                        Number(row[5]) === Number(pi.mccbAF) && 
                        Number(row[4]) === Number(pi.mccbAT)
                    );
                    currentLoad.shortCircuitCurrent = match ? String(match[6]) : (pi.shortCircuitCurrent || '-');
                } else {
                    currentLoad.shortCircuitCurrent = pi.shortCircuitCurrent || '-';
                }
            }
        }

        // 2. 수용률 및 부합 전력
        const demandFactor = Number(currentLoad.demandFactor) || 100;
        const appPower = Number(currentLoad.apparentPower) || 0;
        const demandLoad = (appPower * demandFactor) / 100;
        const diversityFactor = Number(currentLoad.diversityFactor) || 1.0;
        const compositeDemandPower = (demandLoad / diversityFactor).toFixed(2);

        // 3. AF 값
        const { af } = getAFValue(currentLoad.cbType, currentLoad.cbP, currentLoad.at);
        
        // 4. 수용전류
        const voltageVal = Number(String(currentLoad.voltage).replace('V', '')) || 380;
        const is3Phase = String(currentLoad.phase).includes('3Φ') || String(currentLoad.phase).includes('3Ø');
        let demandCurrentValue = 0;
        if (demandLoad > 0 && voltageVal > 0) {
            demandCurrentValue = (demandLoad * 1000) / (is3Phase ? (voltageVal * 1.7320508) : voltageVal);
        }

        return { 
            ...currentLoad, 
            demandLoad: demandLoad.toFixed(2), 
            compositeDemandPower, 
            af: af || currentLoad.af || '-', 
            demandCurrent: demandCurrentValue.toFixed(2) 
        };
    });
};

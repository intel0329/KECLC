import { PL_DATA, getPhaseCount } from './plData';

/**
 * 분전반 예상 크기(W x H)를 계산합니다.
 * 
 * @param {string} mainAF - 메인 차단기 AF 값
 * @param {string} phase - 시스템 상수 (예: '3Ø-4W')
 * @param {Array} leftCircuits - 왼쪽 분기 회로 배열
 * @param {Array} rightCircuits - 오른쪽 분기 회로 배열
 * @returns {object} { width, height, auxiliaryDevices }
 */
export const calculatePanelSize = (mainAF, phase, leftCircuits, rightCircuits) => {
    const phaseData = PL_DATA[phase] || PL_DATA['3Ø-4W'];
    const phaseCount = getPhaseCount(phase);

    // 보조 기기 감지 (on/off, 타이머, 일괄소등)
    const auxKeywords = ['on/off', '타이머', '일괄소등'];
    const detectedAux = new Set();

    const checkLoadsForAux = (circuits) => {
        circuits.forEach(c => {
            (c.loads || []).forEach(l => {
                const category = String(l.category || '').toLowerCase();
                const prefix = String(l.prefix || '').toLowerCase();
                const name = String(l.name || '').toLowerCase();

                auxKeywords.forEach(kw => {
                    if (category.includes(kw) || prefix.includes(kw) || name.includes(kw)) {
                        detectedAux.add(kw);
                    }
                });
            });
        });
    };

    checkLoadsForAux(leftCircuits);
    checkLoadsForAux(rightCircuits);

    const auxiliaryDevices = Array.from(detectedAux);
    const auxExtraHeight = auxiliaryDevices.length * 100; // 항목 1개당 100mm 여유 공간 가산

    // 1. 세로 높이(H) 계산 로직
    const mainBreaker = phaseData[mainAF] || phaseData['30']; // 메인 AF가 없으면 기본 30AF 기준
    const topMargin = mainBreaker.topMargin; // 상부 인입 배선 공간
    const mainBreakerH = mainBreaker.h; // 메인 차단기 높이

    const calculateSideH = (circuits) => {
        let sideH = 0;
        const validCircuits = circuits.filter(c => c.af && phaseData[c.af]);

        validCircuits.forEach((c, index) => {
            const breaker = phaseData[c.af];
            // 분기 차단기는 가로로 눕혀서 배치되므로, 차단기의 너비(w)가 세로 높이에 누적됩니다.
            sideH += breaker.w;
            if (index < validCircuits.length - 1) {
                sideH += 5; // 차단기 사이 여유 간격 5mm (사용자 수정 반영)
            }
        });
        return sideH;
    };

    const leftH = calculateSideH(leftCircuits);
    const rightH = calculateSideH(rightCircuits);
    const branchAreaH = Math.max(leftH, rightH); // 좌/우 중 더 긴 쪽 기준

    const bottomMargin = 150; // 하부 배선 및 접지 단자대 공간

    // 전체 높이 합산 (상부 + 메인 + 분기 + 하부 + 보조기기 가산)
    const totalH = topMargin + mainBreakerH + branchAreaH + bottomMargin + auxExtraHeight;
    // 50mm 단위로 올림, 최소 높이는 300mm
    const roundedH = Math.max(300, Math.ceil(totalH / 50) * 50);

    // 2. 가로 폭(W) 계산 로직
    const sideMargins = 80 * 2; // 좌우 배선 공간 (80mm x 2)

    // 분기 차단기의 최대 높이(H)를 찾습니다. (가로 배치이므로 차단기 높이가 판넬 폭에 영향을 줌)
    const allCircuits = [...leftCircuits.filter(c => c.af && phaseData[c.af]), ...rightCircuits.filter(c => c.af && phaseData[c.af])];
    let maxBranchBreakerH = 0;
    if (allCircuits.length > 0) {
        maxBranchBreakerH = Math.max(...allCircuits.map(c => phaseData[c.af].h));
    } else {
        maxBranchBreakerH = 130; // 분기 차단기가 없을 경우 기본 130mm 기준
    }

    const busbarWidth = 25 * phaseCount; // 버스바 폭 (25mm x 상수)
    const busbarClearance = 30 * 2; // 버스바 이격 거리 (30mm x 2)

    // 전체 폭 합산 (좌우마진 + 분기차단기x2 + 버스바 + 이격거리)
    const totalW = sideMargins + (maxBranchBreakerH * 2) + busbarWidth + busbarClearance;
    // 50mm 단위로 올림, 최소 폭은 200mm
    const roundedW = Math.max(200, Math.ceil(totalW / 50) * 50);

    return {
        width: roundedW,
        height: roundedH,
        auxiliaryDevices // 감지된 보조 기기 목록 반환
    };
};

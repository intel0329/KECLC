/**
 * PL.csv에서 추출한 차단기 치수 데이터
 * 형식: { [상수]: { [AF]: { w, h, topMargin } } }
 * 참고: 분기 차단기는 가로로 배치되므로, 이 테이블의 'w'가 판넬 내에서는 수직 높이 점유분이 됩니다.
 */
export const PL_DATA = {
    '1Ø-2W': {
        '30': { w: 50, h: 130, topMargin: 200 },
        '50': { w: 50, h: 130, topMargin: 200 },
        '100': { w: 50, h: 130, topMargin: 200 },
        '125': { w: 60, h: 155, topMargin: 250 },
        '250': { w: 105, h: 165, topMargin: 250 },
        '400': { w: 140, h: 257, topMargin: 400 },
        '630': { w: 210, h: 280, topMargin: 550 },
        '800': { w: 210, h: 280, topMargin: 550 },
    },
    '3Ø-3W': {
        '30': { w: 75, h: 130, topMargin: 200 },
        '50': { w: 75, h: 130, topMargin: 200 },
        '100': { w: 75, h: 130, topMargin: 200 },
        '125': { w: 90, h: 155, topMargin: 250 },
        '250': { w: 105, h: 165, topMargin: 250 },
        '400': { w: 140, h: 257, topMargin: 400 },
        '630': { w: 210, h: 280, topMargin: 550 },
        '800': { w: 210, h: 280, topMargin: 550 },
    },
    '3Ø-4W': {
        '30': { w: 100, h: 130, topMargin: 200 },
        '50': { w: 100, h: 130, topMargin: 200 },
        '100': { w: 100, h: 130, topMargin: 200 },
        '125': { w: 120, h: 155, topMargin: 250 },
        '250': { w: 140, h: 165, topMargin: 250 },
        '400': { w: 184, h: 257, topMargin: 400 },
        '630': { w: 280, h: 280, topMargin: 550 },
        '800': { w: 280, h: 280, topMargin: 550 },
    }
};

export const getPhaseCount = (phase) => {
    if (phase === '1Ø-2W') return 2;
    if (phase === '3Ø-3W') return 3;
    if (phase === '3Ø-4W') return 4;
    return 4;
};

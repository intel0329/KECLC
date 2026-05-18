export const EXCEL_TEMPLATES = [
    {
        id: 'sh_tech',
        name: '(주)성화기술단 [분전반]',
        headerRow: 8,
        panelHeader: {
            panelName: { keywords: ['판넬명', '판 넬 명 :'], fallback: { r: 2, c: 2 } },
            location: { keywords: ['설치위치', '설치위치 :'], fallback: { r: 2, c: 9 } },
            voltage: { keywords: ['전압', '전 압 :'], fallback: { r: 3, c: 2 } },
            source: { keywords: ['FROM', 'FROM :'], fallback: { r: 4, c: 9 } },
            installType: { keywords: ['형태', '형 태 :'], fallback: { r: 6, c: 9 } }
        },
        columns: {
            id: { keywords: ['회로', '회로(1)'], fallbackColumn: 1 },
            name: { keywords: ['부하내용', '부하내용(2)', 'LOAD(2)'], fallbackColumn: 2 },
            unitLoad: { keywords: ['개별용량', '개별용량(5)', 'TOTAL(5)'], fallbackColumn: 5 },
            qty: { keywords: ['수량', '수량(6)', 'LOAD(6)'], fallbackColumn: 6 },
            totalLoad: { keywords: ['합계용량', '합계용량(7)', 'SUM(3)', 'LOAD(7)'], fallbackColumn: 7 },
            breakerType: { keywords: ['종류', '종류(11)'], fallbackColumn: 11 },
            poles: { keywords: ['P(12)', 'P'], fallbackColumn: 12 },
            af: { keywords: ['AF(13)', 'AF'], fallbackColumn: 13 },
            at: { keywords: ['AT(14)', 'AT'], fallbackColumn: 14 },
            comment: { keywords: ['비고(15)', '비고'], fallbackColumn: 15 }
        }
    },
    {
        id: 'sh_tech_power',
        name: '(주)성화기술단 [동력]',
        headerRow: 8,
        panelHeader: {
            panelName: { keywords: ['PANEL', 'PANEL :'], fallback: { r: 1, c: 5 } },
            location: { keywords: ['지상', '위치', 'LOCATION'], fallback: { r: 1, c: 110 } }, // 대략적인 위치
            voltage: { keywords: ['전압', 'VOLTAGE'], fallback: { r: 3, c: 2 } },
            source: { keywords: ['FROM', 'FROM :'], fallback: { r: 1, c: 10 } },
            installType: { keywords: ['형태', 'TYPE'], fallback: { r: 1, c: 120 } }
        },
        summary: { // [NEW] 하단 요약 섹션 키워드
            demandFactor: '수용률',
            mccbAF: 'AF',
            mccbAT: 'AT',
            mainPoles: 'P'
        },
        columns: {
            id: { keywords: ['장비번호', '장비 번호'], fallbackColumn: 0 },
            name: { keywords: ['장비명', '장비 명'], fallbackColumn: 1 },
            type: { keywords: ['종류', 'TYPE'], fallbackColumn: 5 },
            phase: { keywords: ['상수', 'PHASE'], fallbackColumn: 6 },
            kva: { keywords: ['출력(kVA)', 'kVA'], fallbackColumn: 7 },
            kw: { keywords: ['출력(kW)', 'kW'], fallbackColumn: 8 },
            at: { keywords: ['AT', '정격'], fallbackColumn: 14 },
            af: { keywords: ['AF', '프레임'], fallbackColumn: 13 },
            startingMethod: { keywords: ['기동방식', '기동 방식'], fallbackColumn: 19 }
        }
    },
    {
        id: 'standard_keclc',
        name: 'KECLC 표준 양식',
        headerRow: 7, 
        panelHeader: {
            panelName: { keywords: ['판넬명', 'PANEL NAME'], fallback: { r: 2, c: 2 } },
            location: { keywords: ['설치위치', 'LOCATION', '설치장소'], fallback: { r: 2, c: 9 } },
            voltage: { keywords: ['전압', 'VOLTAGE', '전 압'], fallback: { r: 3, c: 2 } },
            source: { keywords: ['FROM', '공급원', 'POWER SOURCE'], fallback: { r: 3, c: 9 } },
            installType: { keywords: ['형태', 'MOUNT', '형 태'], fallback: { r: 6, c: 9 } }
        },
        columns: {
            id: { keywords: ['회로', '회로(1)', 'CIRCUIT', 'NO'], fallbackColumn: 1 },
            name: { keywords: ['부하내용', '부하내용(2)', 'LOAD NAME', 'DESCRIPTION', 'LOAD(2)'], fallbackColumn: 2 },
            unitLoad: { keywords: ['개별용량', '개별용량(5)', 'UNIT LOAD', 'VA', 'TOTAL(5)'], fallbackColumn: 5 },
            qty: { keywords: ['수량', '수량(6)', 'QTY', 'QUANTITY', 'LOAD(6)'], fallbackColumn: 6 },
            totalLoad: { keywords: ['합계용량', '합계용량(7)', 'TOTAL LOAD', 'SUM', 'SUM(3)', 'LOAD(7)'], fallbackColumn: 7 },
            breakerType: { keywords: ['종류', '종류(11)', 'TYPE', 'BREAKER'], fallbackColumn: 11 },
            poles: { keywords: ['P(12)', 'P', 'POLES', '극수'], fallbackColumn: 12 },
            af: { keywords: ['AF(13)', 'AF'], fallbackColumn: 13 },
            at: { keywords: ['AT(14)', 'AT'], fallbackColumn: 14 },
            comment: { keywords: ['비고(15)', '비고', 'REMARK', 'COMMENT'], fallbackColumn: 15 }
        }
    },
    {
        id: 'minimal_form',
        name: '간이 양식 (부하명/용량 중심)',
        headerRow: 1,
        columns: {
            name: 0,
            unitLoad: 1,
            qty: 2
        }
    }
];

export const getTemplateById = (id) => EXCEL_TEMPLATES.find(t => t.id === id) || EXCEL_TEMPLATES[0];

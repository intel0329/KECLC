/**
 * 엑셀 부하 내역 키워드 기반 자동 분류 규칙 정의 (템플릿별 분리)
 * 
 * - global: 모든 템플릿에 공통으로 적용되는 규칙
 * - [templateId]: 특정 템플릿(예: 'sh_tech', 'standard_keclc' 등)에만 적용되는 규칙
 * 
 * [규칙 구조]
 * - keyword: 검색할 키워드 (공백은 자동으로 무시됨)
 * - prefix: 웹 UI의 '구분' 필드 값 ('감전보호', 'On/Off', '타이머', '일괄소등' 등)
 * - category: 웹 UI의 '종류' 필드 값 ('전등', '전열', '동력', 'PL', '기타')
 * 
 * ※ 우선순위: 특정 템플릿 규칙 > global 공통 규칙 (상단에 위치할수록 우선 적용)
 */
export const LOAD_MAPPING_RULES = {
    // 모든 템플릿 공통 규칙
    global: [
        { keyword: '전등', prefix: '일괄소등', category: '전등' },
        { keyword: 'led', prefix: '', category: '전등' },
        { keyword: '라이트', prefix: '', category: '전등' },
        { keyword: '투광기', prefix: '', category: '전등' },
		{ keyword: '옥외외등', prefix: '타이머', category: '전등' },
		{ keyword: '외등', prefix: '타이머', category: '전등' },

        { keyword: '콘센트', prefix: '', category: '전열' },
        { keyword: '전열', prefix: '', category: '전열' },
        { keyword: '비데', prefix: '감전보호', category: '전열' },		
		{ keyword: '전기온수기', prefix: '감전보호', category: '전열' },
		{ keyword: '감응기', prefix: '감전보호', category: '전열' },
		{ keyword: '핸드드라이', prefix: '감전보호', category: '전열' },
		{ keyword: '전기방열기', prefix: '감전보호', category: '전열' },
		{ keyword: '전기컨백터', prefix: '감전보호', category: '전열' },
        { keyword: 'CCTV', prefix: '', category: '전열' },
        { keyword: '방송', prefix: '', category: '전열' },		
        { keyword: '유도등', prefix: '', category: '전열' },	
        { keyword: 'ATM', prefix: '', category: '전열' },
        
        { keyword: '에어컨', prefix: '', category: '동력' },
		{ keyword: '전열교환기', prefix: '', category: '동력' },
		{ keyword: 'ERV', prefix: '', category: '동력' },
        { keyword: '펌프', prefix: '', category: '동력' },
        { keyword: '모터', prefix: '', category: '동력' },
        { keyword: '실내기', prefix: '', category: '동력' },
        { keyword: '실외기', prefix: '', category: '동력' },		
		{ keyword: '간판', prefix: '타이머', category: '동력' },
		{ keyword: '급기', prefix: 'On/Off', category: '동력' },
		{ keyword: '배기', prefix: 'On/Off', category: '동력' },
        { keyword: '팬', prefix: '', category: '동력' },
        { keyword: '휀', prefix: 'On/Off', category: '동력' },
        { keyword: 'fan', prefix: '', category: '동력' },
		
		{ keyword: 'SPARE', prefix: '', category: '예비' },
		{ keyword: '예비', prefix: '', category: '예비' },
		{ keyword: 'SP', prefix: '', category: '예비' },
    ],

    // (주)성화기술단 [분전반] 전용 규칙
    sh_tech: [
        { keyword: '전등', prefix: '일괄소등', category: '전등' },
        { keyword: 'led', prefix: '', category: '전등' },
        { keyword: '라이트', prefix: '', category: '전등' },
        { keyword: '투광기', prefix: '', category: '전등' },
		{ keyword: '옥외외등', prefix: '타이머', category: '전등' },
		{ keyword: '외등', prefix: '타이머', category: '전등' },

        { keyword: '콘센트', prefix: '', category: '전열' },
        { keyword: '전열', prefix: '', category: '전열' },
        { keyword: '비데', prefix: '감전보호', category: '전열' },		
		{ keyword: '전기온수기', prefix: '감전보호', category: '전열' },
		{ keyword: '감응기', prefix: '감전보호', category: '전열' },
		{ keyword: '핸드드라이', prefix: '감전보호', category: '전열' },
		{ keyword: '전기방열기', prefix: '감전보호', category: '전열' },
		{ keyword: '전기컨백터', prefix: '감전보호', category: '전열' },
        { keyword: 'CCTV', prefix: '', category: '전열' },
		{ keyword: 'AV설비', prefix: '', category: '전열' },
        { keyword: '방송', prefix: '', category: '전열' },		
        { keyword: '유도등', prefix: '', category: '전열' },	
        { keyword: 'ATM', prefix: '', category: '전열' },
        
        { keyword: '에어컨', prefix: '', category: '동력' },
		{ keyword: '전열교환기', prefix: '', category: '동력' },
		{ keyword: 'ERV', prefix: '', category: '동력' },
        { keyword: '펌프', prefix: '', category: '동력' },
        { keyword: '모터', prefix: '', category: '동력' },
        { keyword: '실내기', prefix: '', category: '동력' },
        { keyword: '실외기', prefix: '', category: '동력' },		
		{ keyword: '간판', prefix: '타이머', category: '동력' },
		{ keyword: '급기', prefix: 'On/Off', category: '동력' },
		{ keyword: '배기', prefix: 'On/Off', category: '동력' },
        { keyword: '팬', prefix: '', category: '동력' },
        { keyword: '휀', prefix: 'On/Off', category: '동력' },
        { keyword: 'fan', prefix: '', category: '동력' },
		
		{ keyword: 'SPARE', prefix: '', category: '예비' },
		{ keyword: '예비', prefix: '', category: '예비' },
		{ keyword: 'SP', prefix: '', category: '예비' },
    ],

    // KECLC 표준 양식 전용 규칙
    standard_keclc: [
        // 필요 시 추가
    ],

    // (주)성화기술단 [동력] 전용 규칙
    sh_tech_power: [
        { keyword: '펌프', category: 'PUMP' },
        { keyword: 'pump', category: 'PUMP' },
        { keyword: '모터', category: 'MOTOR' },
        { keyword: 'motor', category: 'MOTOR' },
        { keyword: '팬', category: 'MOTOR' },
        { keyword: '휀', category: 'MOTOR' },
        { keyword: 'fan', category: 'MOTOR' },
        { keyword: 'ahu', category: 'MOTOR' },
        { keyword: '공조기', category: 'MOTOR' },
        { keyword: '에어컨', category: 'MOTOR' },
        { keyword: '냉동기', category: 'MOTOR' },
        { keyword: '냉각탑', category: 'MOTOR' },
        { keyword: '전열교환기', category: 'MOTOR' },
        { keyword: 'erv', category: 'MOTOR' },
        { keyword: '급기', category: 'MOTOR' },
        { keyword: '배기', category: 'MOTOR' },
        { keyword: '가압', category: 'MOTOR' },
        { keyword: '전열', category: 'LOAD' },
        { keyword: '콘센트', category: 'LOAD' },
        { keyword: 'load', category: 'LOAD' },
        { keyword: 'spare', category: 'SPARE' },
        { keyword: '예비', category: 'SPARE' },
        { keyword: 'sp', category: 'SPARE' }
    ]
};

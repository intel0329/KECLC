/**
 * 차단기 용량(AT), 부하 종류(Category), 상(Phase) 기반 전선 정보 자동 매핑 규칙 정의
 * 
 * [구조]
 * - templateId: 특정 템플릿('sh_tech' 등) 또는 'global'
 *   - category: 부하 종류 ('전등', '전열', '동력', 'PL', '기타')
 *     - phase: 상 정보 ('1Ø2W', '3Ø4W', '기타')
 *       - at: 차단기 용량 [A]
 *       - wire/size/method: 전선 정보
 * 
 * ※ 우선순위: 특정 템플릿 -> 특정 종류 -> 특정 상 -> 특정 AT 순서로 최적 규칙 탐색
 */
export const WIRE_MAPPING_RULES = {
    // (주)성화기술단 [분전반] 전용 매핑 규칙
    sh_tech: {
        '전등': {
            '1Ø2W': [
                { at: 20, wire: 'HFIX', size: '2.5', method: 'A1' },
                { at: 30, wire: 'HFIX', size: '2.5', method: 'A1' }
            ],
            '3Ø4W': [
                
            ],
            '기타': [
                
            ]
        },
        '전열': {
            '1Ø2W': [
                { at: 20, wire: 'HFIX', size: '4', method: 'A1' },
                { at: 30, wire: 'HFIX', size: '4', method: 'A1' },
				{ at: 40, wire: 'HFIX', size: '6', method: 'A1' },
				{ at: 50, wire: 'HFIX', size: '10', method: 'A1' },
                { at: 75, wire: 'HFIX', size: '16', method: 'A1' },
                { at: 100, wire: 'HFIX', size: '25', method: 'A1' }
            ],
            '기타': [
                { at: 20, wire: 'HFIX', size: '4', method: 'A1' },
                { at: 50, wire: 'HFIX', size: '10', method: 'A1' },
                { at: 100, wire: 'HFIX', size: '25', method: 'A1' }
            ]
        },
        '동력': {
            '3Ø4W': [
                { at: 20, wire: 'FCV', size: '4', method: 'A2' },
                { at: 30, wire: 'FCV', size: '6', method: 'B2' },
				{ at: 40, wire: 'FCV', size: '10', method: 'B2' },
                { at: 50, wire: 'FCV', size: '16', method: 'B2' },
                { at: 75, wire: 'FCV', size: '25', method: 'E' },
                { at: 100, wire: 'FCV', size: '35', method: 'E' },
				{ at: 125, wire: 'FCV', size: '35', method: 'E' },
                { at: 150, wire: 'FCV', size: '50', method: 'F' }
            ],
            '1Ø2W': [
                { at: 20, wire: 'FCV', size: '4', method: 'A2' },
                { at: 30, wire: 'FCV', size: '6', method: 'B2' },
                { at: 50, wire: 'FCV', size: '10', method: 'B2' },
                { at: 100, wire: 'FCV', size: '25', method: 'B2' }
            ],
            '기타': [
                { at: 20, wire: 'FCV', size: '4', method: 'A2' },
                { at: 30, wire: 'FCV', size: '6', method: 'B2' },
				{ at: 40, wire: 'FCV', size: '10', method: 'B2' },
                { at: 50, wire: 'FCV', size: '16', method: 'B2' },
                { at: 75, wire: 'FCV', size: '25', method: 'E' },
                { at: 100, wire: 'FCV', size: '35', method: 'E' },
				{ at: 125, wire: 'FCV', size: '35', method: 'E' },
                { at: 150, wire: 'FCV', size: '50', method: 'F' }
            ]
        },
        '기타': {
            '기타': [
                { at: 20, wire: 'FCV', size: '4', method: 'A2' },
                { at: 30, wire: 'FCV', size: '6', method: 'B2' },
				{ at: 40, wire: 'FCV', size: '10', method: 'B2' },
                { at: 50, wire: 'FCV', size: '16', method: 'B2' },
                { at: 75, wire: 'FCV', size: '25', method: 'E' },
                { at: 100, wire: 'FCV', size: '35', method: 'E' },
				{ at: 125, wire: 'FCV', size: '35', method: 'E' },
                { at: 150, wire: 'FCV', size: '50', method: 'F' }
            ]
        }
    },

    // (주)성화기술단 [동력] 전용 매핑 규칙
    sh_tech_power: {
        '동력': {
            '3Ø-4W': [
                { at: 20, wire: 'FCV', size: '4', method: 'A2' },
                { at: 30, wire: 'FCV', size: '6', method: 'B2' },
                { at: 40, wire: 'FCV', size: '10', method: 'B2' },
                { at: 50, wire: 'FCV', size: '16', method: 'B2' },
                { at: 75, wire: 'FCV', size: '25', method: 'E' },
                { at: 100, wire: 'FCV', size: '35', method: 'E' },
                { at: 125, wire: 'FCV', size: '35', method: 'E' },
                { at: 150, wire: 'FCV', size: '50', method: 'F' }
            ],
            '3Φ-3W': [
                { at: 20, wire: 'FCV', size: '4', method: 'A2' },
                { at: 30, wire: 'FCV', size: '6', method: 'B2' },
                { at: 40, wire: 'FCV', size: '10', method: 'B2' },
                { at: 50, wire: 'FCV', size: '16', method: 'B2' },
                { at: 75, wire: 'FCV', size: '25', method: 'E' },
                { at: 100, wire: 'FCV', size: '35', method: 'E' },
                { at: 125, wire: 'FCV', size: '35', method: 'E' },
                { at: 150, wire: 'FCV', size: '50', method: 'F' }
            ],
            '1Φ-2W': [
                { at: 20, wire: 'FCV', size: '4', method: 'A2' },
                { at: 30, wire: 'FCV', size: '6', method: 'B2' },
                { at: 50, wire: 'FCV', size: '10', method: 'B2' },
                { at: 100, wire: 'FCV', size: '25', method: 'B2' }
            ],
            '기타': [
                { at: 20, wire: 'FCV', size: '4', method: 'A2' },
                { at: 30, wire: 'FCV', size: '6', method: 'B2' },
                { at: 40, wire: 'FCV', size: '10', method: 'B2' },
                { at: 50, wire: 'FCV', size: '16', method: 'B2' },
                { at: 75, wire: 'FCV', size: '25', method: 'E' },
                { at: 100, wire: 'FCV', size: '35', method: 'E' },
                { at: 125, wire: 'FCV', size: '35', method: 'E' },
                { at: 150, wire: 'FCV', size: '50', method: 'F' }
            ]
        },
        '기타': {
            '기타': [
                { at: 20, wire: 'FCV', size: '4', method: 'A2' },
                { at: 30, wire: 'FCV', size: '6', method: 'B2' },
                { at: 40, wire: 'FCV', size: '10', method: 'B2' },
                { at: 50, wire: 'FCV', size: '16', method: 'B2' },
                { at: 75, wire: 'FCV', size: '25', method: 'E' },
                { at: 100, wire: 'FCV', size: '35', method: 'E' },
                { at: 150, wire: 'FCV', size: '50', method: 'F' }
            ]
        }
    },

    // 모든 템플릿 공통 매핑 규칙 (Fallback용)
    global: {
        '기타': {
            '기타': [
                { at: 20, wire: 'FCV', size: '4', method: 'A2' },
                { at: 30, wire: 'FCV', size: '6', method: 'B2' }
            ]
        }
    }
};

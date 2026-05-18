/**
 * feederChker.js
 * 간선-계산서의 각 섹션별 에러(FAIL/ERR)를 중앙 집중 관리하는 유틸리티
 * 
 * "빨간색 글씨 탐색" 원칙에 따라 특정 필드가 FAIL/ERR 상태인지 판단합니다.
 */

/**
 * 값이 FAIL 또는 ERR을 포함하는지 확인 (상태 색상 판정 기준)
 * @param {any} val 체크할 값
 * @returns {boolean} 에러 여부
 */
export const isFailed = (val) => {
    if (!val) return false;
    const upper = val.toString().toUpperCase();
    return upper.includes('FAIL') || upper.includes('ERR');
};

/**
 * 각 섹션별로 감시해야 할 데이터 필드 정의
 */
export const SECTION_FIELDS = {
    ATB: ['ibInIz', 'atb'],
    ATTH: ['i2Iz', 'atth'],
    ATMS: ['inIms', 'atms'],
    ATMI: ['inImi', 'atmi'],
    ATSC: ['tnTz', 'atsc'],
    SCB: ['ibInIz2', 'scbSize'],
    SE: ['seSize'],
    VDROP: ['seSize'], // 전압강하 섹션 (e[V], e[%]) 추가
    SSC: ['sscStatus'],
    SMSE: ['smSize'],
    SMSTH: ['smsStatus']
};

/**
 * 재질과 공사방법의 정합성 확인
 */
export const isMaterialMethodValid = (feeder) => {
    if (!feeder || !feeder.conduitMat || !feeder.method) return true;
    const mat = String(feeder.conduitMat).toUpperCase().trim();
    const methodUpper = String(feeder.method).toUpperCase().trim();
    const baseMethod = methodUpper.split('X')[0].trim();
    
    if (mat === 'TRAY') {
        return ['E', 'F'].includes(baseMethod);
    }
    if (mat === 'ELP') {
        return ['D'].includes(baseMethod);
    }
    if (mat === 'ST') {
        return ['B1', 'B2'].includes(baseMethod);
    }
    if (mat === 'CD') {
        if (methodUpper.includes('X')) return false;
        return ['A1', 'A2'].includes(baseMethod);
    }
    if (mat === 'HI') {
        return ['D'].includes(baseMethod);
    }
    return true;
};

/**
 * 호칭 규격 적합성 확인
 */
export const isNominalValid = (feeder) => {
    if (!feeder) return true;
    const nom = String(feeder.conduitNom || '').trim();
    const mat = String(feeder.conduitMat || '').toUpperCase().trim();
    
    // 1. 'Chk' 문자열이 있으면 에러
    if (nom === 'Chk') return false;
    
    // 2. CD관의 경우 36C, 42C는 에러 (규정 제한)
    if (mat === 'CD' && (nom === '36C' || nom === '42C')) return false;
    
    return true;
};

/**
 * 전선 규격 vs 공사방법 적합성 확인
 */
export const isCableMethodValid = (feeder, kecSettings = null) => {
    if (!feeder || !feeder.method || !feeder.cableCond) return true;

    // Normalize method: handle parallel conductor string (e.g., 'B1x2' -> 'B1')
    const methodUpper = String(feeder.method).toUpperCase().trim();
    const baseMethod = methodUpper.split('X')[0].trim();

    // 1. Parallel HFIX restriction
    if (methodUpper.includes('X') && feeder.cableIns === 'HFIX') return false;

    // 2. HFIX Method restriction
    if (feeder.cableIns === 'HFIX') {
        const hfixMethods = ['A1', 'B1', 'D'];
        return hfixMethods.includes(baseMethod);
    }

    // 3. FCV/FR8 Size vs Method restriction
    if (feeder.cableIns !== 'FCV' && feeder.cableIns !== 'FR8') return true;

    const circuitSize = Number(feeder.cableCond);
    const thresholdArea = Number(kecSettings?.cableCondition?.area) || 50;

    const smallSizeMethods = ['A2', 'B2', 'D', 'E'];
    const largeSizeMethods = ['A1', 'B1', 'D', 'F'];

    if (circuitSize >= thresholdArea) {
        return largeSizeMethods.includes(baseMethod);
    } else {
        return smallSizeMethods.includes(baseMethod);
    }
};

/**
 * 특정 섹션에 에러가 있는지 확인
 * @param {object} feeder 판넬(피더) 데이터 객체
 * @param {string} section 섹션 키 (예: 'ATB')
 * @param {object} kecSettings KEC 설정 객체 (선택)
 * @returns {boolean} 에러 포함 여부
 */
export const hasSectionError = (feeder, section, kecSettings = null) => {
    // 특수 섹션 검증
    if (section === 'METHOD') {
        const isBasicValid = (feeder.toId || feeder.capacityKva || feeder.capacityKw) && !feeder.method;
        if (isBasicValid) return true;
        return !isCableMethodValid(feeder, kecSettings);
    }
    if (section === 'CABLE_COND') return (feeder.toId || feeder.capacityKva || feeder.capacityKw) && !feeder.cableCond;
    if (section === 'CONDUIT_MAT_EMPTY') return (feeder.toId || feeder.capacityKva || feeder.capacityKw) && !feeder.conduitMat;
    if (section === 'CONDUIT_MAT') return !isMaterialMethodValid(feeder);
    if (section === 'CONDUIT_NOM') return !isNominalValid(feeder);

    const fields = SECTION_FIELDS[section];
    if (!fields) return false;
    return fields.some(field => isFailed(feeder[field]));
};

/**
 * 행 전체에 에러가 하나라도 있는지 확인 (최종 검토 열 연동용)
 * @param {object} feeder 판넬(피더) 데이터 객체
 * @param {object} kecSettings KEC 설정 객체 (선택)
 * @returns {string} 'FAIL' 또는 'OK'
 */
export const getRowStatus = (feeder, kecSettings = null) => {
    // [FIX] 부하 명칭(toId)이나 용량 등 주요 데이터가 없는 '비어있는 행'은 검토 결과(OK/FAIL)를 표시하지 않음
    if (!feeder.toId && !feeder.capacityKva && !feeder.capacityKw) return '';

    // [ADD] 필수 선택 데이터(공사방법, 도체, 재질)가 누락된 경우 FAIL
    if (!feeder.method || !feeder.cableCond || !feeder.conduitMat) return 'FAIL';

    // 1. 일반 필드 기반 체크
    const allFields = Object.values(SECTION_FIELDS).flat();
    const hasFieldError = allFields.some(field => isFailed(feeder[field]));
    if (hasFieldError) return 'FAIL';

    // 2. 로직 기반 체크 (Conduit, Cable Method)
    if (!isMaterialMethodValid(feeder) || !isNominalValid(feeder) || !isCableMethodValid(feeder, kecSettings)) return 'FAIL';
    
    return 'OK';
};

/**
 * 행에서 가장 먼저 발견되는 에러 필드명을 반환 (점프 기능용)
 * @param {object} feeder 판넬(피더) 데이터 객체
 * @param {object} kecSettings KEC 설정 객체 (선택)
 * @returns {string|null} 필드명
 */
export const getFirstErrorField = (feeder, kecSettings = null) => {
    if (!feeder.toId && !feeder.capacityKva && !feeder.capacityKw) return null;

    // 1. 필수 입력 누락 (우선순위 높음)
    if (!feeder.method) return 'method';
    if (!feeder.cableCond) return 'cableCond';
    if (!feeder.conduitMat) return 'conduitMat';

    // 2. 섹션별 에러 체크 (표시 순서대로)
    // VDROP/SE, ATB, ATTH, ATSC, ATMS, ATMI, SCB, SSC, SMSE, SMS 순서
    const checkOrder = [
        ...SECTION_FIELDS.VDROP,
        ...SECTION_FIELDS.ATB,
        ...SECTION_FIELDS.ATTH,
        ...SECTION_FIELDS.ATSC,
        ...SECTION_FIELDS.ATMS,
        ...SECTION_FIELDS.ATMI,
        ...SECTION_FIELDS.SCB,
        ...SECTION_FIELDS.SE,
        ...SECTION_FIELDS.SSC,
        ...SECTION_FIELDS.SMSE,
        ...SECTION_FIELDS.SMSTH
    ];

    for (const field of checkOrder) {
        if (isFailed(feeder[field])) return field;
    }

    // 3. 로직 에러
    if (!isCableMethodValid(feeder, kecSettings)) return 'method';
    if (!isMaterialMethodValid(feeder)) return 'conduitMat';
    if (!isNominalValid(feeder)) return 'conduitNom';

    return null;
};

import { LOAD_MAPPING_RULES } from './loadMappingRules.js';
import { WIRE_MAPPING_RULES } from './wireMappingRules.js';

/**
 * 부하 명칭(Name)을 분석하여 '구분(prefix)'과 '종류(category)'를 자동으로 판별합니다.
 * 공백을 무시하고 키워드 포함 여부를 검사합니다.
 * 
 * @param {string} name 부하 명칭
 * @param {string} templateId 선택된 엑셀 템플릿 ID (sh_tech, standard_keclc 등)
 */
export const getLoadClassification = (name, templateId = 'global') => {
    // 기본값 설정
    const result = { prefix: '', category: '기타' };
    
    if (!name) return result;

    // 비교를 위해 공백 제거 및 소문자화
    const cleanName = String(name).replace(/\s+/g, '').toLowerCase();

    // 1. 특정 템플릿 전용 규칙 검색 (우선 처리)
    const templateRules = LOAD_MAPPING_RULES[templateId] || [];
    for (const rule of templateRules) {
        if (!rule.keyword) continue;
        const cleanKeyword = String(rule.keyword).replace(/\s+/g, '').toLowerCase();
        if (cleanName.includes(cleanKeyword)) {
            result.prefix = rule.prefix || '';
            result.category = rule.category || '기타';
            return result;
        }
    }

    // 2. 공통(global) 규칙 검색 (2차 처리)
    const globalRules = LOAD_MAPPING_RULES.global || [];
    for (const rule of globalRules) {
        if (!rule.keyword) continue;
        const cleanKeyword = String(rule.keyword).replace(/\s+/g, '').toLowerCase();
        if (cleanName.includes(cleanKeyword)) {
            result.prefix = rule.prefix || '';
            result.category = rule.category || '기타';
            return result;
        }
    }

    // 판별이 어려운 경우 기본값 유지
    return result;
};

/**
 * 전선 정보 자동 매핑 시 제외할 카테고리 정의 (템플릿별 분리)
 * - 여기에 포함된 카테고리는 전선 종류, 굵기, 공사방법을 할당하지 않고 빈 값으로 둡니다.
 */
const EXEMPT_WIRE_CATEGORIES = {
    global: ['예비', 'SPARE'],
    sh_tech: ['예비'],
    sh_tech_power: ['SPARE']
};

/**
 * 차단기 용량(AT), 부하 종류(Category), 상(Phase) 정보를 분석하여 전선 정보(종류, 굵기, 공사방법)를 판별합니다.
 * 
 * @param {string|number} at 차단기 용량 [A]
 * @param {string} category 부하 종류 (전등, 전열, 동력, PL, 기타)
 * @param {string} phase 상 정보 (1Ø2W, 3Ø4W, 기타)
 * @param {string} templateId 템플릿 ID
 */
export const getWireClassification = (at, category = '기타', phase = '기타', templateId = 'global') => {
    // [EXCEPTION] 예비(SPARE) 등 전선 정보가 필요 없는 특수 카테고리 처리 (템플릿별 예외 목록 참조)
    const exemptList = EXEMPT_WIRE_CATEGORIES[templateId] || EXEMPT_WIRE_CATEGORIES.global;
    if (exemptList.includes(category)) {
        return { wire: '', size: '', method: '' };
    }

    const numAt = parseFloat(at);
    const defaultWire = { wire: 'FCV', size: '', method: 'E' };

    if (isNaN(numAt)) return defaultWire;

    // 1단계: 템플릿 그룹 선택
    const templateGroup = WIRE_MAPPING_RULES[templateId] || WIRE_MAPPING_RULES.global;
    
    // 2단계: 카테고리 그룹 선택 (해당 종류가 없으면 '기타' 종류 그룹 참조)
    const categoryGroup = templateGroup[category] || templateGroup['기타'] || (WIRE_MAPPING_RULES.global['기타'] || {});
    
    // 3단계: 상(Phase) 기반 규칙 탐색 (안전장치 포함)
    let rules = categoryGroup[phase];
    
    // 안전장치 1: 해당 종류 내에 상(Phase) 규칙이 없는 경우 '기타' 상 그룹 참조
    if (!rules || rules.length === 0) {
        rules = categoryGroup['기타'];
    }
    
    // 안전장치 2: 그래도 규칙을 못 찾은 경우 템플릿 '기타' 종류의 '기타' 상 그룹 참조
    if (!rules || rules.length === 0) {
        const fallbackGroup = templateGroup['기타'] || (WIRE_MAPPING_RULES.global['기타'] || {});
        rules = fallbackGroup['기타'] || [];
    }

    if (!rules || rules.length === 0) return defaultWire;

    // 4단계: AT 기준 오름차순 정렬하여 가장 가까운 상위 값 찾기
    const sortedRules = [...rules].sort((a, b) => a.at - b.at);
    const match = sortedRules.find(r => r.at >= numAt);

    if (match) {
        return {
            wire: match.wire || defaultWire.wire,
            size: match.size || defaultWire.size,
            method: match.method || defaultWire.method
        };
    }

    // 모든 규칙보다 큰 AT인 경우 가장 큰 용량 규칙 적용
    const last = sortedRules[sortedRules.length - 1];
    return {
        wire: last.wire,
        size: last.size,
        method: last.method
    };
};

/**
 * 하위 호환성을 위해 유지: 부하 명칭으로 '종류'만 반환합니다.
 */
export const mapCategoryByName = (name) => {
    const { category } = getLoadClassification(name);
    return category;
};

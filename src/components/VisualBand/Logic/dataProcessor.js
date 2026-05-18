/**
 * Energy Band Data Processor
 * 
 * 스토어의 판넬 데이터를 시각화용 구조로 가공합니다.
 * panel-load(양측 독립 회로)와 power-load(단일 배열) 형식을 자동 감지합니다.
 */

/**
 * 부하명 정리: PL연결 회로의 감싸진 따옴표 제거 등
 */
const cleanName = (name) => {
    if (!name) return '';
    return name
        .replace(/^"(.+)"PL$/i, '$1')
        .replace(/^"/, '')
        .replace(/"$/, '')
        .trim();
};

import { getLoadClassification } from '../../../utils/excel/categoryMapper';

export const processEnergyBandData = (panelData, panelId) => {
    if (!panelData) return null;

    // 변압기 관련 계산서인지 확인
    const isTransformer = panelData.powerLoads?.some(l => l.bankId || l.bankName) || 
                         (panelData.projectInfo?.usageType && ['OIL', 'TR', 'MOLD'].includes(panelData.projectInfo.usageType));

    // 변압기 갑지 여부 확인 (ID 기반으로 100% 정확하게 판별)
    const isMainTransformer = isTransformer && (
        String(panelId || '').startsWith('transformer-main') ||
        panelData.mainCapacity !== undefined || 
        panelData.totalCapacity !== undefined
    );

    // 판넬 이름 추출 우선순위: 갑지(고정) > 판넬명 > 프로젝트명 > 뱅크명
    let panelName = panelData.projectInfo?.panelName || panelData.projectInfo?.name || panelData.bankName || "";
    
    // 갑지인 경우 무조건 HV(특고압)으로 표시
    if (isMainTransformer) {
        panelName = "HV(특고압)";
    } else if (!panelName) {
        panelName = isTransformer ? "변압기 계산서" : "판넬";
    }
    
    let circuits = [];

    // 변압기/동력계산서일 경우 고정 레이블 대신 동적 타입 레이블(MOTOR, LOAD 등) 사용
    const isPowerContext = Array.isArray(panelData.powerLoads);
    const mainLabel = isTransformer ? "TOTAL" : "동력";
    
    // 동력/변압기 계산서일 경우 초기 레이블 없이 동적으로 생성 (타입별 집계)
    const catSums = isPowerContext 
        ? {} 
        : { "간선": 0, [mainLabel]: 0, "전열": 0, "전등": 0, "기타": 0, "예비": 0 };

    // ══════════════════════════════════════
    // 1. Panel Load (분전반 부하) 형식 감지
    // ══════════════════════════════════════
    if (panelData.leftCircuits || panelData.rightCircuits) {

        const processSide = (arr, sideLabel) => {
            if (!Array.isArray(arr)) return;
            arr.forEach((c, idx) => {
                let va = 0;

                // [FIX] 하위 부하 리스트(loads)가 있는 경우 상세 집계 우선
                if (Array.isArray(c.loads) && c.loads.length > 0) {
                    c.loads.forEach(l => {
                        const lVA = (Number(l.qty) || 0) * (Number(l.va) || 0);
                        va += lVA;
                        
                        // 카테고리 집계 (PL -> 간선 매핑)
                        const cat = l.category === 'PL' ? '간선' : (l.category || '기타');
                        if (catSums[cat] !== undefined) catSums[cat] += Math.max(0, lVA);
                        else catSums["기타"] += Math.max(0, lVA);
                    });
                }
                // [FIX] loads가 없고 단일 power 값이 있는 경우 부하명으로 종류 판별
                else if (c.power !== undefined && c.power !== '' && c.power !== null) {
                    va = Number(c.power) || 0;
                    
                    const { category } = getLoadClassification(c.loadName);
                    const cat = category === 'PL' ? '간선' : (category || '기타');
                    
                    if (catSums[cat] !== undefined) catSums[cat] += Math.max(0, va);
                    else catSums["기타"] += Math.max(0, va);
                }

                const rawName = cleanName(c.loadName);

                // 이름과 전력 모두 비어있는 빈 회로는 건너뜀
                if (!rawName && va <= 0) return;

                circuits.push({
                    name: rawName || `${sideLabel}-${idx + 1}`,
                    va: Math.max(0, va),
                    side: sideLabel
                });
            });
        };

        processSide(panelData.leftCircuits, 'L');
        processSide(panelData.rightCircuits, 'R');
    }
    // ══════════════════════════════════════
    // 2. Power Load (동력 / 변압기 부하) 형식 감지
    // ══════════════════════════════════════
    else if (isPowerContext) {

        panelData.powerLoads.forEach((load, idx) => {
            // 예비 회로 제외 (변압기 갑지/을지 호환)
            if (load.type === 'SPARE' || load.isSpare || (load.equipmentName || '').includes('예비')) return;

            // 변압기 갑지/을지 호환 이름 추출 (equipmentName -> bankName -> loadName 순)
            const rawName = (load.equipmentName || load.bankName || load.loadName || '').trim();
            // 대소문자 구분 없이 타입 판별
            const type = (load.type || 'LOAD').toUpperCase();
            let va = 0;

            // 1. kVA 입력값이 있는지 먼저 확인 (표에 입력된 값을 최우선으로 신뢰)
            // "0.00"과 같은 더미 문자열은 무시하고 실제 숫자가 있는 필드를 순차적으로 찾습니다.
            const getValidKva = (val) => {
                const n = Number(String(val || '').replace(/[^0-9.]/g, '')) || 0;
                return n > 0 ? n : 0;
            };

            const kvaNum = getValidKva(load.apparentPowerInput) || 
                           getValidKva(load.apparentPower) || 
                           getValidKva(load.kva) || 
                           getValidKva(load.inputKva);

            if (kvaNum > 0) {
                va = kvaNum * 1000;
            } 
            // 2. kVA 입력값이 없을 경우에만 kW 기반으로 계산 수행
            else if (type === 'MOTOR' || type === 'PUMP') {
                const kwStr = String(load.effectivePower || '0').replace(/[^0-9.]/g, '');
                const kw = Number(kwStr) || 0;
                const pf = Number(load.powerFactor) || 0.85;
                const eff = Number(load.efficiency) || 0.9;
                if (pf > 0 && eff > 0 && kw > 0) va = (kw / (pf * eff)) * 1000;
            } else {
                // [폴백] LOAD 타입인데 kVA는 없고 kW만 있는 경우
                if (load.effectivePower) {
                    const kwStr = String(load.effectivePower).replace(/[^0-9.]/g, '');
                    const kw = Number(kwStr) || 0;
                    if (kw > 0) {
                        // 1순위: 해당 행에 입력된 역률/효율
                        // 2순위: 프로젝트/판넬 전체 설정에 지정된 기본값
                        // 3순위: 시스템 표준 기본값 (0.85 / 1.0)
                        const defaultPF = Number(panelData.settings?.powerFactor || panelData.projectInfo?.powerFactor) || 0.85;
                        const defaultEff = Number(panelData.settings?.efficiency || panelData.projectInfo?.efficiency) || 1.0;

                        const pf = Number(load.powerFactor) || defaultPF;
                        const eff = Number(load.efficiency) || defaultEff;
                        va = (kw / (pf * eff)) * 1000;
                    }
                }
            }

            if (!rawName && va <= 0) return;

            const finalVA = Math.max(0, va);
            
            // [개선] 고정 레이블(동력) 대신 부하 TYPE별로 세부 집계 (MOTOR, PUMP, LOAD 등)
            // 이를 통해 동력계산서에서도 의미 있는 통계 정보를 제공합니다.
            const typeLabel = (load.type || 'LOAD').toUpperCase();
            if (catSums[typeLabel] === undefined) catSums[typeLabel] = 0;
            catSums[typeLabel] += finalVA;

            circuits.push({
                name: rawName || `부하 ${idx + 1}`,
                va: finalVA,
                type: typeLabel,
                bankName: load.bankName || '' // 소속 변압기 이름 추가
            });
        });
    }

    // 데이터 없음
    if (circuits.length === 0) return null;

    // VA 내림차순 정렬 (가장 큰 부하가 위, 밝은 색상)
    circuits.sort((a, b) => b.va - a.va);

    const totalVA = circuits.reduce((sum, c) => sum + c.va, 0);
    const maxVA = Math.max(...circuits.map(c => c.va), 1);

    circuits = circuits.map((c, idx) => ({
        ...c,
        index: idx,
        percent: totalVA > 0 ? (c.va / totalVA) * 100 : 0,
        kva: c.va / 1000,
        ratio: c.va / maxVA  // 최대값 대비 비율 (색상 매핑용)
    }));

    // ══════════════════════════════════════
    // 3. 종류별 통계 가공 (0kVA 제외)
    // ══════════════════════════════════════
    const typeStats = Object.entries(catSums)
        .map(([label, va]) => ({
            label,
            kva: va / 1000,
            percent: totalVA > 0 ? (va / totalVA) * 100 : 0
        }))
        .filter(s => s.kva > 0.001) // 0.001kVA(1VA) 미만 제외
        .sort((a, b) => b.kva - a.kva);

    return {
        panelName,
        totalVA,
        totalKVA: totalVA / 1000,
        circuits,
        circuitCount: circuits.length,
        typeStats
    };
};

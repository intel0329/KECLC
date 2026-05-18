import { useMemo } from 'react';

/**
 * useSafetyCheck
 * 각종 계산서의 안전 규정 및 'Chk' 로직을 실시간으로 감시하는 커스텀 훅
 * 
 * @param {string} moduleType - 'panel', 'power', 'ups' 등 모듈 구분
 * @param {object} data - 각 모듈의 회로/부하 데이터 (leftCircuits, rightCircuits, loads 등)
 * @param {object} projectInfo - 현재 모듈의 프로젝트 정보 (메인 차단기 설정 등)
 * @param {object} panelsData - 전역 스토어의 모든 판넬 데이터 (SSOT 연동용)
 */
export const useSafetyCheck = (moduleType, data, projectInfo, panelsData) => {
    
    // 1. 최대 분기 AT (Amperage Trip) 값 계산
    const maxBranchAT = useMemo(() => {
        let maxAT = 0;
        
        if (moduleType === 'panel') {
            const { leftCircuits = [], rightCircuits = [] } = data || {};
            const findMax = (circuits) => {
                circuits.forEach(c => {
                    let circuitAT = Number(c.at) || 0;
                    
                    // [SSOT] 연결된 하위 판넬의 메인 AT가 있다면 이를 우선 참조
                    const connId = c.connectedPanelId || c.loads?.find(l => l.category === 'PL')?.connectedPanelId;
                    if (connId && panelsData[connId]) {
                        const childMainAT = Number(panelsData[connId].projectInfo?.mccbAT) || 0;
                        if (childMainAT > 0) circuitAT = childMainAT;
                    }
                    
                    if (circuitAT > maxAT) maxAT = circuitAT;
                });
            };
            findMax(leftCircuits);
            findMax(rightCircuits);
        } else if (moduleType === 'power') {
            // [REACTIVE] data가 배열이면 직접 사용, 아니면 { loads } 구조에서 추출
            const loads = Array.isArray(data) ? data : (data?.loads || []);
            loads.forEach(c => {
                let circuitAT = Number(c.at) || 0;
                
                // [SSOT] 연결된 하위 판넬의 메인 AT가 있다면 이를 우선 참조
                const connId = c.connectedPanelId;
                if (connId && panelsData[connId]) {
                    const childMainAT = Number(panelsData[connId].projectInfo?.mccbAT) || 0;
                    if (childMainAT > 0) circuitAT = childMainAT;
                }
                
                if (circuitAT > maxAT) maxAT = circuitAT;
            });
        } else if (moduleType === 'ups') {
            const loads = Array.isArray(data) ? data : (data?.loads || []);
            loads.forEach(l => {
                const branchAT = Number(l.at) || 0;
                
                // [REACTIVE LOOKUP] bankId를 통해 스토어에서 직접 자식 메인 AT 참조
                let bankMainAT = 0;
                if (l.bankId && panelsData[l.bankId]) {
                    bankMainAT = Number(panelsData[l.bankId].projectInfo?.mccbAT) || 0;
                }
                
                // UPS에서는 분기 AT뿐만 아니라, 연결된 뱅크의 메인 AT 자체도 UPS 메인보다 클 수 없으므로 둘 다 체크
                if (branchAT > maxAT) maxAT = branchAT;
                if (bankMainAT > maxAT) maxAT = bankMainAT;
            });
        }
        
        return maxAT;
    }, [moduleType, data, panelsData]);

    // 2. 메인 차단기 AT 위반 여부 (Main AT <= Branch AT)
    const isATViolation = useMemo(() => {
        if (moduleType === 'ups') {
            const loads = Array.isArray(data) ? data : (data?.loads || []);
            const globalMainAT = Number(projectInfo?.mccbAT) || 0;
            return loads.some(l => {
                const branchAT = Number(l.at) || 0;
                
                // [REACTIVE LOOKUP] bankId를 통해 스토어에서 직접 자식 메인 AT 참조
                let bankMainAT = 0;
                if (l.bankId && panelsData[l.bankId]) {
                    bankMainAT = Number(panelsData[l.bankId].projectInfo?.mccbAT) || 0;
                }
                
                // 1. 내부 회로 >= 뱅크 메인
                const internalVio = (bankMainAT > 0 && branchAT >= bankMainAT);
                // 2. 뱅크 메인 >= UPS 메인
                const globalVio = (globalMainAT > 0 && bankMainAT >= globalMainAT);
                
                return internalVio || globalVio;
            });
        }
        
        const mainAT = Number(projectInfo?.mccbAT) || 0;
        return (maxBranchAT > 0 && mainAT > 0) ? (maxBranchAT >= mainAT) : false;
    }, [moduleType, data, maxBranchAT, projectInfo?.mccbAT]);

    return {
        maxBranchAT,
        isATViolation,
        // 향후 추가될 Chk 로직들 (e.g., isCableViolation, isVoltageDropViolation 등)
    };
};

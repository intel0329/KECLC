import { useEffect } from 'react';
import useDataStore from '../store/useDataStore';

/**
 * Power Load Data Hook (SSOT Integration)
 * 
 * 동력 부하 데이터를 관리하며 스토어와 실시간으로 동기화합니다.
 */
export const usePowerLoadData = (projectId, panelId) => {
    const { 
        panels, 
        results, 
        loadPanel, 
        updatePanelData, 
        syncPanel,
        savePanel, 
        initProject,
        activeProjectId
    } = useDataStore();

    // 프로젝트 초기화
    useEffect(() => {
        if (projectId && activeProjectId !== projectId) {
            initProject(projectId);
        }
    }, [projectId, activeProjectId, initProject]);

    // 판넬 데이터 로드
    useEffect(() => {
        if (panelId) {
            loadPanel(panelId);
        }
    }, [panelId, loadPanel]);

    const data = panels[panelId] || { projectInfo: {}, powerLoads: [] };
    const result = results[panelId] || { calculatedLoads: [], phaseTotals: {}, summaryStats: {} };

    // 수동 저장 이벤트 리스닝
    useEffect(() => {
        const handleTriggerSave = async () => {
            if (panelId) {
                await savePanel(panelId);
                window.dispatchEvent(new CustomEvent('kelc_save_finished', { detail: { panelId, success: true } }));
            }
        };
        window.addEventListener('kelc_trigger_save', handleTriggerSave);
        return () => window.removeEventListener('kelc_trigger_save', handleTriggerSave);
    }, [panelId, savePanel]);

    /**
     * 데이터를 업데이트하고 즉시 스토어에 반영합니다.
     * 이를 통해 이 판넬을 참조하는 다른 계산서들이 즉시 반응합니다.
     */
    const dispatchUpdate = (updates, newResult = null) => {
        updatePanelData(panelId, updates);
        if (newResult || result) {
            syncPanel(panelId, { ...data, ...updates }, newResult || result);
        }
    };

    return {
        projectInfo: data.projectInfo,
        powerLoads: data.powerLoads,
        calculatedLoads: result.calculatedLoads,
        phaseTotals: result.phaseTotals,
        summaryStats: result.summaryStats,
        mainCtValue: result.mainCtValue,
        totalLoad: result.totalLoad,
        isDataLoaded: !!panels[panelId],
        
        setProjectInfo: (updates) => dispatchUpdate({ projectInfo: { ...data.projectInfo, ...updates } }),
        setPowerLoads: (newLoads) => dispatchUpdate({ powerLoads: newLoads }),
        
        updateLoad: (id, field, value) => {
            const newLoads = data.powerLoads.map(l => l.id === id ? { ...l, [field]: value } : l);
            dispatchUpdate({ powerLoads: newLoads });
        },

        // 계산 결과 동기화 (컴포넌트에서 계산 직후 호출)
        syncResult: (newResult) => syncPanel(panelId, data, newResult)
    };
};

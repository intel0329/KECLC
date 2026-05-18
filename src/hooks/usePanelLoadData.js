import { useEffect } from 'react';
import useDataStore from '../store/useDataStore';

export const usePanelLoadData = (projectId, panelId) => {
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

    useEffect(() => {
        if (projectId && activeProjectId !== projectId) {
            initProject(projectId);
        }
    }, [projectId, activeProjectId, initProject]);

    useEffect(() => {
        if (panelId) {
            loadPanel(panelId);
        }
    }, [panelId, loadPanel]);

    const data = panels[panelId] || { projectInfo: {}, leftCircuits: [], rightCircuits: [] };
    const result = results[panelId] || { leftCircuits: [], rightCircuits: [], totalLoad: 0 };

    // --- SSOT REAL-TIME SYNC FOR LINKED PANELS ---
    useEffect(() => {
        if (!panelId || !panels) return;

        let hasUpdates = false;
        const updateCircuits = (circuits) => {
            return circuits.map(c => {
                if (!c.toId) return c;
                
                const linkedData = panels[c.toId];
                if (!linkedData || !linkedData.projectInfo) return c;

                // Sync breaker info from linked panel's main breaker
                const breakerType = linkedData.projectInfo.mainBreakerType || '';
                const af = linkedData.projectInfo.mccbAF || '';
                const at = linkedData.projectInfo.mccbAT || '';

                if (c.breakerType !== breakerType || c.af !== af || c.at !== at) {
                    hasUpdates = true;
                    return { ...c, breakerType, af, at };
                }
                return c;
            });
        };

        const newLeft = updateCircuits(data.leftCircuits || []);
        const newRight = updateCircuits(data.rightCircuits || []);

        if (hasUpdates) {
            // Update store immediately so UI reflects change "very fast"
            updatePanelData(panelId, { 
                leftCircuits: newLeft, 
                rightCircuits: newRight 
            });
        }
    }, [panels, panelId]);

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

    return {
        projectInfo: data.projectInfo,
        leftCircuits: result.leftCircuits || data.leftCircuits || [],
        rightCircuits: result.rightCircuits || data.rightCircuits || [],
        totalLoad: result.totalLoad,
        isDataLoaded: !!panels[panelId],
        
        setProjectInfo: (updates) => updatePanelData(panelId, { projectInfo: { ...data.projectInfo, ...updates } }),
        setCircuits: (side, newCircuits) => updatePanelData(panelId, { [side]: newCircuits }),
        
        updateCircuit: (side, index, field, value) => {
            const sideKey = side === 'left' ? 'leftCircuits' : 'rightCircuits';
            const updated = (data[sideKey] || []).map((c, i) => i === index ? { ...c, [field]: value } : c);
            updatePanelData(panelId, { [sideKey]: updated });
        }
    };
};

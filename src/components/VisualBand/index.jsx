import React, { useState, useEffect, useCallback } from 'react';
import useDataStore from '../../store/useDataStore';
import { getRemoteData } from '../../services/projectService';
import { processEnergyBandData } from './Logic/dataProcessor';
import VisualBandPopup from './UI/VisualBandPopup';

/**
 * VisualBand — 전역 에너지 밴드 시각화 컴포넌트
 * 
 * App.jsx 레벨에 마운트되어 `kelc_open_energy_band` 커스텀 이벤트를 수신합니다.
 * 판넬 데이터를 스토어/서버에서 로드 후 차트 팝업을 표시합니다.
 */
const VisualBand = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [chartData, setChartData] = useState(null);
    const [loading, setLoading] = useState(false);

    /**
     * 판넬 데이터를 3단계 폴백으로 로드합니다.
     * 1. 인메모리 스토어 → 2. 스토어 loadPanel (캐시 포함) → 3. 서버 직접 요청
     */
    const loadAndProcess = useCallback(async (panelId) => {
        if (!panelId) return;
        setLoading(true);

        try {
            let panelData = null;

            // 1단계: 인메모리 스토어 확인
            panelData = useDataStore.getState().panels[panelId];

            // 2단계: 스토어 loadPanel (LocalStorage → 서버 Draft → 서버 Origin)
            if (!panelData) {
                panelData = await useDataStore.getState().loadPanel(panelId);
            }

            // 3단계: 서버 직접 요청 (폴백)
            if (!panelData) {
                const activeProjectId = useDataStore.getState().activeProjectId;
                panelData = await getRemoteData(`kelc_panel_draft_${panelId}`, activeProjectId);
                if (!panelData) {
                    panelData = await getRemoteData(`kelc_panel_data_${panelId}`, activeProjectId);
                }
            }

            if (!panelData) {
                console.warn('[EnergyBand] 판넬 데이터를 찾을 수 없습니다:', panelId);
                return;
            }

            // [NEW] 하위 참조 판넬(을지 등)의 실시간 계산 결과 주입 로직
            // 갑지 계산서에서 을지의 최신 값을 참조하지 못해 0으로 나오는 현상을 해결합니다.
            const store = useDataStore.getState();
            const results = store.results;

            // 1. Power Load (동력 / 변압기 갑지) 계통 결과 주입
            if (Array.isArray(panelData.powerLoads)) {
                for (let load of panelData.powerLoads) {
                    const subId = load.connectedPanelId || load.bankId;
                    if (subId) {
                        // 스토어에 이미 로드된 결과가 있는지 확인
                        let finalVA = results[subId]?.totalLoad;
                        
                        // 결과가 없다면 해당 판넬을 로드하여 내부 데이터를 정밀 분석 (정밀 합산 로직 추가)
                        if (finalVA === undefined || finalVA === null) {
                            const subPanel = store.panels[subId] || await store.loadPanel(subId);
                            
                            // 1단계: 캐시된 결과 확인
                            finalVA = subPanel?.projectInfo?.cachedTotalLoad;
                            
                            // 2단계: 캐시가 없다면 실시간 정밀 계산 (분전반/동력/변압기 형식 구분)
                            if ((finalVA === undefined || finalVA === null || Number(finalVA) === 0) && subPanel) {
                                let sum = 0;
                                // 2-1. 분전반 형식 (Left/Right Circuits)
                                if (subPanel.leftCircuits || subPanel.rightCircuits) {
                                    ['leftCircuits', 'rightCircuits'].forEach(side => {
                                        if (Array.isArray(subPanel[side])) {
                                            subPanel[side].forEach(c => {
                                                if (c.power !== undefined && c.power !== '') sum += (Number(c.power) || 0);
                                                else if (Array.isArray(c.loads)) {
                                                    c.loads.forEach(l => sum += (Number(l.qty) || 0) * (Number(l.va) || 0));
                                                }
                                            });
                                        }
                                    });
                                } 
                                // 2-2. 동력/변압기 형식 (PowerLoads)
                                else if (Array.isArray(subPanel.powerLoads)) {
                                    subPanel.powerLoads.forEach(l => {
                                        if (l.type === 'SPARE' || l.isSpare) return;
                                        if (l.type === 'MOTOR' || l.type === 'PUMP') {
                                            const kw = Number(l.effectivePower) || 0;
                                            const pf = Number(l.powerFactor) || 0.85;
                                            const eff = Number(l.efficiency) || 0.9;
                                            if (pf > 0 && eff > 0) sum += (kw / (pf * eff)) * 1000;
                                        } else {
                                            sum += (Number(l.apparentPower) || 0) * 1000;
                                        }
                                    });
                                }
                                finalVA = sum;
                            }
                        }
                        
                        if (finalVA !== undefined && finalVA !== null) {
                            load.apparentPower = (Number(finalVA) / 1000).toFixed(2);
                        }
                    }
                }
            }

            // 데이터 가공 및 UI 표시
            const processed = processEnergyBandData(panelData, panelId);
            if (processed && processed.circuits.length > 0) {
                setChartData(processed);
                setIsOpen(true);
            } else {
                console.warn('[EnergyBand] 시각화할 회로 데이터가 없습니다.');
            }
        } catch (err) {
            console.error('[EnergyBand] 데이터 로드 실패:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    // 전역 이벤트 리스너
    useEffect(() => {
        const handler = (e) => {
            const { panelId } = e.detail || {};
            if (panelId) {
                loadAndProcess(panelId);
            }
        };

        window.addEventListener('kelc_open_energy_band', handler);
        return () => window.removeEventListener('kelc_open_energy_band', handler);
    }, [loadAndProcess]);

    const handleClose = useCallback(() => {
        setIsOpen(false);
        // 팝업 퇴장 애니메이션 후 데이터 정리
        setTimeout(() => setChartData(null), 500);
    }, []);

    if (!isOpen || !chartData) return null;

    return <VisualBandPopup data={chartData} onClose={handleClose} />;
};

export default VisualBand;

import { useEffect, useCallback, useRef, useState } from 'react';
import { getProject, setRemoteData, getRemoteData } from '../../../services/projectService';
import { calculateFeederValues, extractLinkedDataFromPanel } from '../utils/feederCalculations';
import { updateGroupFooters, syncHierarchyAndReorder, cleanEmptyGroups } from '../utils/feederGrouping';
import useDataStore from '../../../store/useDataStore';

/**
 * Feeder Data Hook (True SSOT Integration - Fixed)
 */
export const useFeederData = (projectId, panelId, getParentId, lookupLoaded, getChildrenIds, idToName, panelParents, allPanels, isLocalChangeRef) => {
    const { 
        panels, 
        results,
        loadPanel, 
        updatePanelData, 
        savePanel,
        initProject,
        activeProjectId,
        syncPanel,
        setSyncStatus
    } = useDataStore();

    // Store 데이터 추출
    const panelData = panels[panelId] || { projectInfo: {}, feeders: [] };
    const projectInfo = panelData.projectInfo || {};
    const feeders = panelData.feeders || [];
    // [Phase 1] Hydration State
    const [isDataLoaded, setIsDataLoaded] = useState(false);

    // 케이블 및 MCC 설정 상태
    const [kecSettings, setKecSettings] = useState({});
    const [mccSettings, setMccSettings] = useState({});
    const [settingsPF, setSettingsPF] = useState(0.8);
    const [settingsEff, setSettingsEff] = useState(1.0);

    const [isInitialLoading, setIsInitialLoading] = useState(true);

    // 0. 프로젝트 초기화 확인 (다른 프로젝트에서 진입 시 상태 초기화 및 ID 업데이트)
    useEffect(() => {
        if (projectId && activeProjectId !== projectId) {
            initProject(projectId);
        }
    }, [projectId, activeProjectId, initProject]);

    // 1. 초기 데이터 및 프로젝트 정보 로드
    useEffect(() => {
        const initLoad = async () => {
            if (!panelId || activeProjectId !== projectId) return;
            
            setIsInitialLoading(true);
            // 판넬 데이터 로드
            const loadedData = await loadPanel(panelId);
            
            // 프로젝트 명칭 동기화
            const project = await getProject(projectId);
            if (project && project.name) {
                updatePanelData(panelId, { 
                    projectInfo: { 
                        ...(loadedData?.projectInfo || {}), 
                        name: project.name 
                    } 
                });
            }
            setIsInitialLoading(false);
        };
        initLoad();
    }, [panelId, projectId, activeProjectId, loadPanel]);

    // 2. FROM 셀 (부모 판넬) 자동 동기화 로직 복구
    useEffect(() => {
        if (!lookupLoaded || !isDataLoaded || !panelId || !getParentId || isInitialLoading) return;

        // 판넬 자체의 부모(fromId) 동기화
        const actualParentId = getParentId(panelId);
        if (actualParentId && projectInfo.fromId !== actualParentId) {
            updatePanelData(panelId, { projectInfo: { ...projectInfo, fromId: actualParentId } });
        }

        // 개별 Feeder 행의 fromId 동기화
        let hasUpdates = false;
        const newFeeders = feeders.map(f => {
            if (f.toId) {
                const targetParentId = getParentId(f.toId) || '';
                if (f.fromId !== targetParentId) {
                    hasUpdates = true;
                    return { ...f, fromId: targetParentId };
                }
            }
            return f;
        });

        if (hasUpdates) {
            updatePanelData(panelId, { feeders: newFeeders });
        }
    }, [lookupLoaded, isDataLoaded, panelId, getParentId, feeders, projectInfo.fromId, isInitialLoading]);

    // 3. 실시간 자식 판넬 데이터(차단기/부하) 동기화 (최적화 버전)
    const syncLinkedFeederData = useCallback(() => {
        if (!isDataLoaded || feeders.length === 0) return;

        let hasNewUpdates = false;
        const updatedFeeders = feeders.map(f => {
            if (!f.toId || !f.cat) return f;

            const linkedData = panels[f.toId];
            if (!linkedData) {
                // 데이터가 아직 없는 경우에만 로드 요청 (이미 요청 중인 경우는 store에서 관리함)
                loadPanel(f.toId);
                return f;
            }

            const result = results[f.toId];
            const totalVA = result?.totalLoad ?? linkedData.projectInfo?.cachedTotalLoad ?? 0;
            const linkedUpdates = extractLinkedDataFromPanel(linkedData, f.cat, kecSettings, mccSettings, totalVA);
            
            let needsUpdate = false;
            
            // [Optimized] 실제 값이 변경되었는지 정밀 비교
            for (const [key, val] of Object.entries(linkedUpdates)) {
                if (String(f[key] || '') !== String(val || '')) {
                    needsUpdate = true;
                    break;
                }
            }

            if (needsUpdate) {
                hasNewUpdates = true;
                const merged = { ...f, ...linkedUpdates };
                return { ...merged, ...calculateFeederValues(merged, settingsPF, settingsEff, kecSettings) };
            }
            return f;
        });

        // [Optimized] 실제 데이터 내용이 변했을 때만 스토어 반영 (Echo-Stop)
        const feedersStr = JSON.stringify(feeders);
        const updatedFeedersStr = JSON.stringify(updatedFeeders);
        
        if (feedersStr !== updatedFeedersStr) {
            console.log(`[Feeder Sync] Linked data changed. Updating store...`);
            updatePanelData(panelId, { feeders: updatedFeeders });
        }
    }, [panels, results, isDataLoaded, feeders, kecSettings, mccSettings, panelId, settingsPF, settingsEff, updatePanelData]);

    // [Phase 3] Reactive Recalculation Listener
    // Note: The global listener is moved to the main component's subscription for better targeting.


    // 4. 설정값(PF, Eff) 로드 로직 복구
    useEffect(() => {
        const loadSettings = async () => {
            const defaultKey = 'kelc_setting_data';
            const projectKey = projectId ? `${defaultKey}_${projectId}` : defaultKey;
            
            let remote = await getRemoteData(projectKey, projectId);
            if (!remote && projectKey !== defaultKey) {
                remote = await getRemoteData(defaultKey, projectId);
            }

            if (remote) {
                setKecSettings(remote);
                if (remote.cableCondition) {
                    setSettingsPF(Number(remote.cableCondition.powerFactor) || 0.8);
                    setSettingsEff(Number(remote.cableCondition.efficiency) || 1.0);
                }
            }
        };
        loadSettings();
        window.addEventListener('kelc_settings_updated', loadSettings);
        return () => window.removeEventListener('kelc_settings_updated', loadSettings);
    }, [projectId]);

    // 4.1. MCC 설정 로드 로직 추가
    useEffect(() => {
        const loadMccSettings = async () => {
            const defaultMccKey = 'kelc_mcc_settings';
            const projectMccKey = projectId ? `${defaultMccKey}_${projectId}` : defaultMccKey;
            
            let remote = await getRemoteData(projectMccKey, projectId);
            if (!remote && projectMccKey !== defaultMccKey) {
                remote = await getRemoteData(defaultMccKey, projectId);
            }

            if (remote) {
                setMccSettings(remote);
            }
        };
        loadMccSettings();
        window.addEventListener('kelc_mcc_settings_updated', loadMccSettings);
        return () => window.removeEventListener('kelc_mcc_settings_updated', loadMccSettings);
    }, [projectId]);

    // [NEW] Garbage Collection: Remove rows for deleted panels
    useEffect(() => {
        if (!lookupLoaded || !isDataLoaded || !idToName || feeders.length === 0) return;

        const filtered = feeders.filter(f => {
            // toId가 설정되어 있는 경우, 해당 ID가 프로젝트에 여전히 존재하는지 확인
            if (f.toId) {
                return !!idToName[f.toId];
            }
            // 수동 입력 행이나 빈 행은 유지
            return true;
        });

        if (filtered.length !== feeders.length) {
            console.log(`[Feeder Sync] Removing ${feeders.length - filtered.length} dead rows.`);
            setFeeders(filtered);
            // setFeeders internal update will trigger the draft save useEffect
        }
    }, [idToName, lookupLoaded, isDataLoaded]);

    // [NEW] Reactive Group Footer Calculation
    useEffect(() => {
        if (!isDataLoaded || feeders.length === 0) return;

        const getNameById = (id) => idToName[id] || id;
        const calculatedFeeders = updateGroupFooters(feeders, getNameById);

        // 깊은 비교 대신 문자열 비교로 변경 여부 확인 (무한 루프 방지)
        if (JSON.stringify(calculatedFeeders) !== JSON.stringify(feeders)) {
            updatePanelData(panelId, { feeders: calculatedFeeders });
        }
    }, [feeders, idToName, isDataLoaded, panelId]);

    // 조작 메서드 (Zero-Sync 적용)
    const setProjectInfo = useCallback((updates) => {
        isLocalChangeRef.current = true;
        const newData = { projectInfo: { ...projectInfo, ...updates }, feeders };
        syncPanel(panelId, newData);
    }, [panelId, projectInfo, feeders, syncPanel, isLocalChangeRef]);
    
    const setFeeders = useCallback((newFeeders) => {
        isLocalChangeRef.current = true;
        const newData = { projectInfo, feeders: newFeeders };
        syncPanel(panelId, newData);
    }, [panelId, projectInfo, syncPanel, isLocalChangeRef]);


    // [Phase 1] 제거: 중복 syncPanel 호출을 방지하고 핸들러에서 직접 처리하도록 유도
    // 하지만 타 탭 동기화를 위해 참조는 유지
    const lastDraftRef = useRef(null);
    const latestDataRef = useRef(null); 
    const lastSyncFingerprintRef = useRef('');

    // [Phase 1] Zero-Sync (Zustand Store Sync)
    useEffect(() => {
        if (!panelId || !isDataLoaded) return;
        
        // 1. 현재 데이터의 핵심 지문(Fingerprint) 생성
        const currentFingerprint = JSON.stringify({
            p: projectInfo,
            pl: feeders,
            mof: null,
            tl: null
        });

        // 2. 지문이 이전과 완벽히 동일하면 무한 핑퐁 차단을 위해 여기서 중단(Return)
        if (lastSyncFingerprintRef.current === currentFingerprint) {
            return; 
        }
        lastSyncFingerprintRef.current = currentFingerprint;

        // 즉시 상태 변경 알림 (인디케이터 초록색)
        if (isLocalChangeRef.current) {
            useDataStore.getState().setSyncStatus('local', 'saving');
        }

        // Zustand 스토어 및 BroadcastChannel 동기화
        syncPanel(panelId, { projectInfo, feeders });

        // 로컬 동기화 완료 후 인디케이터 유지
        if (isLocalChangeRef.current) {
            const timer = setTimeout(() => {
                useDataStore.getState().setSyncStatus('local', 'saved');
                setTimeout(() => {
                    const currentLocalStatus = useDataStore.getState().syncStatus?.local;
                    if (currentLocalStatus === 'saved') {
                        useDataStore.getState().setSyncStatus('local', 'idle');
                    }
                }, 2000);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [panelId, isDataLoaded, projectInfo, feeders, syncPanel]);

    // [ZERO SYNC] 타 탭 변경 신호 감지 (Zustand 스토어 구독 기반)
    useEffect(() => {
        // [ZERO SYNC] 연결된 자식 판넬 데이터가 변경되었을 수 있으므로 연동 데이터 동기화 실행
        syncLinkedFeederData();
    }, [panels, results, syncLinkedFeederData]);

    // [Phase 2] Draft 자동 저장 (3s Debounce, Active Origin Only)
    const lastSavedDataRef = useRef(null); // [NEW] 루프 차단용 방어막
    useEffect(() => {
        if (!isDataLoaded || !panelId || !activeProjectId || !isLocalChangeRef.current) return;

        const currentData = { projectInfo, feeders };
        const dataString = JSON.stringify(currentData);

        // 초기 로드 시점의 데이터는 저장하지 않음 (변경시에만 동작)
        if (lastSavedDataRef.current === null) {
            lastSavedDataRef.current = dataString;
            return;
        }

        // 데이터가 실제로 변경되었을 때만 실행 (Echo-Stop)
        if (lastSavedDataRef.current === dataString) return;
        
        // 1. Dirty 상태 업데이트 (Header 저장 버튼 연동)
        useDataStore.getState().markAsDirty(panelId);

        let isActive = true;
        const timer = setTimeout(async () => {
            if (!isActive || !isLocalChangeRef.current) return;

            try {
                // [Sync Status] 서버 동기화 시작 (Yellow Cloud)
                useDataStore.getState().setSyncStatus('remote', 'saving');
                const startTime = Date.now();
                
                const draftKey = `kelc_panel_draft_${panelId}`;
                await setRemoteData(activeProjectId, draftKey, { ...currentData, status: 'DIRTY', isDraft: true });
                lastSavedDataRef.current = dataString; // 저장된 시점의 문자열 업데이트
                
                // [Sync Status] 최소 800ms 동안 주황색 유지
                const elapsed = Date.now() - startTime;
                const minDuration = 800;
                if (elapsed < minDuration) {
                    await new Promise(resolve => setTimeout(resolve, minDuration - elapsed));
                }

                // [Sync Status] 서버 동기화 완료 (Blue)
                useDataStore.getState().setSyncStatus('remote', 'saved');
                
                // 리더 권한 반납 (저장 완료)
                isLocalChangeRef.current = false;

                setTimeout(() => {
                    const { syncStatus } = useDataStore.getState();
                    if (syncStatus.remote === 'saved') useDataStore.getState().setSyncStatus('remote', 'idle');
                }, 2000);

            } catch (e) { 
                console.error('Draft save failed:', e);
                useDataStore.getState().setSyncStatus('remote', 'error');
            }
        }, 3000);

        return () => {
            isActive = false;
            clearTimeout(timer);
        };
    }, [feeders, projectInfo, panelId, activeProjectId, isDataLoaded, isLocalChangeRef]);

    const addFeeder = () => {
        isLocalChangeRef.current = true;
        const newFeeder = {
            id: Date.now() + Math.random(),
            fromId: projectInfo.fromId || '', 
            toId: '', cat: '',
            capacityKva: '', capacityKw: '',
            phase: '', wire: '', voltage: '',
            current: '',
            demandFactor: '', demandKva: '', demandA: '',
            breakerType2: '', breakerAF: '', breakerAT: '', breakerKA: '',
            cableVolt: '', cableIns: '', cableCore: '', cableCond: '', cableCondArea: '', cableLine: '', cableX: '',
            cablePe: '', cableOuterD: '', cablePeLine: '',
            conduitTotal: '', chk: '',
        };
        setFeeders([...feeders, newFeeder]);
    };

    const updateFeeder = (id, field, value) => {
        let newFeeders = [...feeders];
        const targetIdx = newFeeders.findIndex(f => f.id === id);
        if (targetIdx === -1) return;

        const currentFeeder = newFeeders[targetIdx];
        let updated = { ...currentFeeder, [field]: value };

        // [ADD] 공사방법이 E 또는 F일 경우 재질을 자동으로 TRAY로 설정
        const m = String(value || '').toUpperCase().trim();
        if (field === 'method' && (m === 'E' || m === 'F')) {
            updated.conduitMat = 'TRAY';
        }

        // toId 입력 시 자동으로 fromId 찾기 및 수용률 기본값(100) 설정
        if (field === 'toId') {
            if (value) {
                if (getParentId) updated.fromId = getParentId(value) || '';
                // 수용률이 비어있으면 기본값 100 설정
                if (!updated.demandFactor) {
                    updated.demandFactor = '100';
                }
            } else {
                // To(부하명칭)가 지워지면 From을 포함한 모든 데이터 초기화 (ID 유지)
                const feederId = updated.id;
                updated = {
                    id: feederId,
                    fromId: '', toId: '', cat: '',
                    capacityKva: '', capacityKw: '',
                    phase: '', wire: '', voltage: '',
                    current: '',
                    demandFactor: '', demandKva: '', demandA: '',
                    breakerType2: '', breakerAF: '', breakerAT: '', breakerKA: '',
                    dist: '', method: '', ib: '', in: '', iz: '', 
                    vDropEPer: '', vDropEV: '',
                    atb: '', atth: '', atms: '', atmi: '', atsc: '',
                    scbSize: '', seSize: '', sscSize: '', smSize: '', smsSize: '',
                    smseEv: '', smseEPer: '', smseLimit: '', smseRecommendedSize: '',
                    smsIms: '', smsTm: '', smsInsulation: '', smsStatus: '',
                    pf: '', eff: '', r: '', x: '',
                    cableVolt: '', cableIns: '', cableCore: '', cableD: '', cableCond: '', cableCondArea: '', cableLine: '',
                    cablePe: '', cableOuterD: '', cablePeLine: '',
                    conduitTotal: '', chk: '',
                };
            }
        }

        // --- From 셀 변경 시 자식 자동 추가 로직 (동기화 보완) ---
        // [FIX] 기존 값과 동일한 경우 로직이 중단되어 중복 행 생성을 방지함
        if (field === 'fromId' && value && value !== currentFeeder.fromId && getChildrenIds) {
            const childIds = getChildrenIds(value); // 이 부모에 연결된 모든 자식 ID들
            if (childIds.length > 0) {
                // 1. 첫 번째 자식은 현재 행의 To로 설정 및 데이터 연동
                const firstChildId = childIds[0];
                updated.toId = firstChildId;
                updated.cat = panels[firstChildId]?.type === 'power-load' ? 'M' : 'L';
                
                // 스토어에 데이터가 있다면 즉시 연동
                if (panels[firstChildId]) {
                    const linkedData = extractLinkedDataFromPanel(panels[firstChildId], updated.cat, kecSettings, mccSettings);
                    Object.assign(updated, linkedData);
                }
                
                // 2. 나머지 자식들은 새로운 행으로 추가 (중복 체크 및 데이터 연동)
                const existingToIds = new Set(feeders.map(f => f.toId));
                const feedersToAdd = [];
                
                for (let i = 1; i < childIds.length; i++) {
                    const cId = childIds[i];
                    if (!existingToIds.has(cId)) {
                        const newCat = panels[cId]?.type === 'power-load' ? 'M' : 'L';
                        let newFeeder = {
                            id: Date.now() + Math.random() + i,
                            fromId: value,
                            toId: cId,
                            cat: newCat,
                            capacityKva: '', capacityKw: '',
                            phase: '', wire: '', voltage: '',
                            current: '',
                            demandFactor: '', demandKva: '', demandA: '',
                            breakerType2: '', breakerAF: '', breakerAT: '', breakerKA: '',
                            dist: '', method: '', ib: '', in: '', iz: '', 
                        };

                        // 스토어에 해당 패널 데이터가 있다면 즉시 연동
                        if (panels[cId]) {
                            const linkedData = extractLinkedDataFromPanel(panels[cId], newCat, kecSettings, mccSettings);
                            newFeeder = { ...newFeeder, ...linkedData };
                        }

                        // 자동 계산 적용 (전류, 수용부하 등)
                        const calculated = calculateFeederValues(newFeeder, settingsPF, settingsEff);
                        feedersToAdd.push({ ...newFeeder, ...calculated });
                    }
                }
                
                if (feedersToAdd.length > 0) {
                    // 현재 행 바로 아래에 삽입
                    newFeeders.splice(targetIdx + 1, 0, ...feedersToAdd);
                }
            }
        }

        // toId 입력 시 자동으로 fromId 찾기 및 수용률 기본값(100) 설정
        if (field === 'toId' && value && getParentId) {
            updated.fromId = getParentId(value) || '';
            // 수용률이 비어있으면 기본값 100 설정
            if (!updated.demandFactor) {
                updated.demandFactor = '100';
            }
        }

        if (['capacityKva', 'capacityKw', 'demandFactor', 'phase', 'voltage', 'cat', 'fromId', 'toId', 'conduitMat', 'cableX', 'cableCondArea', 'cableLine', 'cableOuterD', 'demandKva', 'demandA'].includes(field)) {
            newFeeders[targetIdx] = { ...updated, ...calculateFeederValues(updated, settingsPF, settingsEff, kecSettings) };
        } else {
            newFeeders[targetIdx] = updated;
        }

        isLocalChangeRef.current = true;
        
        // [REMOVED] handleImmediateConnectionSync 제거

        setFeeders(newFeeders);
    };

    /**
     * 에너지 플로우의 계통 구조를 분석하여 간선계산서 행을 자동으로 재배치 및 동기화합니다.
     */
    const reorderFeedersByHierarchy = useCallback(() => {
        if (!lookupLoaded || !isDataLoaded) return;
        
        const getNameById = (id) => idToName[id] || id;
        const reordered = updateGroupFooters(
            syncHierarchyAndReorder(feeders, allPanels, panelParents, getNameById),
            getNameById
        );
        
        setFeeders(reordered);
    }, [feeders, panels, panelParents, idToName, lookupLoaded, isDataLoaded]);

    const refreshLinkedLoads = useCallback(() => {
        if (!isDataLoaded || feeders.length === 0) return;

        feeders.forEach(f => {
            if (f.toId) {
                loadPanel(f.toId);
            }
        });
    }, [feeders, isDataLoaded, loadPanel]);

    // 저장 및 Draft 로직 생략 (기존과 동일하게 유지)
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

    // settingsI2Type 추가
    const settingsI2Type = kecSettings?.cableCondition?.i2Type || 'industrial';

    return {
        feeders,
        setFeeders,
        projectInfo,
        setProjectInfo,
        isDataLoaded,
        isInitialLoading,
        addFeeder,
        removeFeeder: (id) => {
            const updated = feeders.filter(f => f.id !== id);
            setFeeders(cleanEmptyGroups(updated));
        },
        updateFeeder,
        reorderFeedersByHierarchy,
        refreshLinkedLoads,
        hasChanges: true,
        settingsPF,
        settingsEff,
        settingsI2Type,
        kecSettings,
        mccSettings,
        setIsDataLoaded,
        panels,
        results
    };
};

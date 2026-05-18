import { create } from 'zustand';
import projectService from '../services/projectService';

/**
 * SSOT (Single Source of Truth) Store
 * 
 * [Optimization Strategy]
 * Tier 1: Local memory and LocalStorage (Immediate sync)
 * Tier 2: Remote server (Debounced sync / On unmount)
 */
const SYNC_CHANNEL = 'KECLC_STATE_SYNC';
const bc = new BroadcastChannel(SYNC_CHANNEL);
const TAB_ID = Math.random().toString(36).substring(2, 11);

// Helper for immediate local backup to prevent unmount data loss
const backupToLocal = (panelId, data) => {
    if (!panelId) return;
    try {
        const cacheKey = `kelc_panel_cache_${panelId}`;
        localStorage.setItem(cacheKey, JSON.stringify({ 
            ...data, 
            status: data.status || 'LOCAL_SAVED',
            cachedAt: new Date().toISOString() 
        }));
    } catch (e) {
        if (e.name === 'QuotaExceededError' || e.code === 22) {
            console.warn(`LocalStorage quota exceeded. Performing emergency cleanup...`);
            // Emergency Cleanup: Delete all panel caches EXCEPT the current one
            // We iterate backwards and delete old project caches first
            try {
                const keys = Object.keys(localStorage);
                const cacheKeys = keys.filter(k => k.startsWith('kelc_panel_cache_') && !k.includes(panelId));
                cacheKeys.forEach(k => localStorage.removeItem(k));
                
                // Try again once more for the current panel
                const cacheKey = `kelc_panel_cache_${panelId}`;
                localStorage.setItem(cacheKey, JSON.stringify({ ...data, cachedAt: new Date().toISOString() }));
            } catch (innerErr) {
                console.error("Cleanup failed or insufficient:", innerErr);
            }
        } else {
            console.warn(`LocalStorage backup failed:`, e);
        }
    }
};

const useDataStore = create((set, get) => {

    // 채널 메시지 수신 시 상태 동기화
    bc.onmessage = (event) => {
        const { type, payload, senderId } = event.data;
        
        // 내가 보낸 메시지라면 무시 (무한 루프 및 자가 리다이렉트 방지 핵심)
        if (senderId === TAB_ID) return;

        // [SESSION GUARD] 프로젝트 ID가 일치하지 않는 상태에서 메시지가 오면 
        // 데이터 정합성 보호를 위해 강제 종료 시나리오 실행 검토

        switch (type) {
            case 'UPDATE_PANEL': {
                const { panelId, data } = payload;
                const existingPanel = get().panels[panelId];
                if (JSON.stringify(existingPanel) === JSON.stringify(data)) break;
                
                // [Tier 1] 타 탭에서 온 데이터도 로컬 캐시에 즉시 각인 (새로고침 대비)
                backupToLocal(panelId, data);

                set(state => ({
                    panels: { ...state.panels, [panelId]: data }
                }));

                // [ZERO SYNC] 타 탭에서 온 변경사항임을 알리는 신호 발송
                window.dispatchEvent(new CustomEvent('kelc_connections_changed', { detail: { panelId } }));
                break;
            }
            case 'UPDATE_RESULTS': {
                const { panelId, result } = payload;
                const existingResult = get().results[panelId];
                if (JSON.stringify(existingResult) === JSON.stringify(result)) break;
                
                set(state => ({
                    results: { ...state.results, [panelId]: result }
                }));

                // [ZERO SYNC] 계산 결과 업데이트 신호 발송
                window.dispatchEvent(new CustomEvent('kelc_results_updated', { detail: { panelId } }));
                break;
            }
            case 'UPDATE_SETTINGS': {
                const { key, data } = payload;
                const existingSettings = get().settings[key];
                if (JSON.stringify(existingSettings) === JSON.stringify(data)) break;

                set(state => ({
                    settings: { ...state.settings, [key]: data }
                }));

                // [ZERO SYNC] 설정 업데이트 신호 발송 (Legacy 호환용)
                const eventMap = {
                    kec: 'kelc_settings_updated',
                    mcc: 'kelc_mcc_settings_updated',
                    tcc: 'kelc_tcc_multiplier_updated'
                };
                if (eventMap[key]) {
                    window.dispatchEvent(new CustomEvent(eventMap[key], { detail: { data } }));
                }
                break;
            }
            case 'CLOSE_PROJECT':
                console.log(`[SYNC] Closing project by request from ${senderId}`);
                set({ activeProjectId: null, panels: {}, results: {} });
                
                // 타 탭에서도 로컬 스토리지 청소 (중요)
                localStorage.removeItem('kelc_active_project_id');
                localStorage.removeItem('kelc_project_info');
                localStorage.removeItem('kelc_dirty_panels');
                localStorage.setItem('kelc_project_is_dirty', 'false');

                if (payload?.redirectTo) {
                    // 현재 탭이 진행 중인 작업을 멈추고 리다이렉트 (프리징 방지)
                    window.location.href = payload.redirectTo;
                }
                break;
            case 'PROJECT_DELETED':
                const currentProjectId = get().activeProjectId;
                if (currentProjectId === payload.projectId) {
                    console.log(`[SYNC] Active project deleted: ${payload.projectId}. Redirecting to home.`);
                    set({ activeProjectId: null, panels: {}, results: {} });
                    localStorage.removeItem('kelc_active_project_id');
                    localStorage.removeItem('kelc_project_info');
                    window.location.href = '/'; // 강제 홈 이동
                }
                break;
            case 'PROJECT_LIST_UPDATED':
                console.log(`[SYNC] Project list update signal received from ${senderId}`);
                // 리스트 갱신 트리거 증가 (ProjectList 컴포넌트 구독용)
                set(state => ({ listUpdateTrigger: (state.listUpdateTrigger || 0) + 1 }));
                break;
            case 'REQ_ACTIVE_PROJECT':
                // 다른 탭에서 "누가 활동 중이니?" 물어볼 때 응답
                const activeId = get().activeProjectId;
                if (activeId) {
                    bc.postMessage({
                        type: 'RES_ACTIVE_PROJECT',
                        payload: { projectId: activeId },
                        senderId: TAB_ID
                    });
                }
                break;
            case 'RES_ACTIVE_PROJECT':
                // 다른 탭의 활동 상태를 수신하여 내 상태 업데이트
                if (payload.projectId) {
                    console.log(`[SYNC] Active project detected from another tab: ${payload.projectId}`);
                    localStorage.setItem('kelc_active_project_id', payload.projectId);
                    set({ activeProjectId: payload.projectId });
                }
                break;
            case 'FORCE_RELOAD':
                // [USER REQUEST] Setting 페이지는 새로고침 대상에서 제외 (다른 계산서 페이지들만 최신화)
                if (window.location.pathname.includes('/setting')) {
                    console.log(`[SYNC] Skipping force reload for setting page`);
                    break;
                }
                console.log(`[SYNC] Force reloading tab by request from ${senderId}`);
                window.location.reload();
                break;
        }
    };

    // [NEW] 탭 간 활성 프로젝트 ID 실시간 동기화 (Header와의 정합성 확보)
    if (typeof window !== 'undefined') {
        const handleStorageSync = (e) => {
            // [GUARD] 다른 로직에 의해 ID가 null로 지워지는 이벤트는 무시합니다.
            // 상태 초기화는 오직 명시적인 CLOSE_PROJECT 브로드캐스트 메시지를 통해서만 수행됩니다.
            if (e.key === 'kelc_active_project_id' && e.newValue !== null) {
                set({ activeProjectId: e.newValue });
            }
        };
        window.addEventListener('storage', handleStorageSync);
    }

    return {
        // [NEW] Actions for dirty state management
        markAsDirty: (panelId) => {
            if (!panelId) return;
            try {
                const dirtyList = JSON.parse(localStorage.getItem('kelc_dirty_panels') || '[]');
                if (!dirtyList.includes(panelId)) {
                    dirtyList.push(panelId);
                    localStorage.setItem('kelc_dirty_panels', JSON.stringify(dirtyList));
                    localStorage.setItem('kelc_project_is_dirty', 'true');
                    window.dispatchEvent(new Event('kelc_dirty_state_changed'));
                }
            } catch (e) { console.error('Failed to mark as dirty:', e); }
        },
        markAsClean: (panelId) => {
            if (!panelId) return;
            try {
                const dirtyList = JSON.parse(localStorage.getItem('kelc_dirty_panels') || '[]');
                const newList = dirtyList.filter(id => id !== panelId);
                localStorage.setItem('kelc_dirty_panels', JSON.stringify(newList));
                if (newList.length === 0) {
                    localStorage.setItem('kelc_project_is_dirty', 'false');
                }
                window.dispatchEvent(new Event('kelc_dirty_state_changed'));
            } catch (e) { console.error('Failed to mark as clean:', e); }
        },

        TAB_ID: TAB_ID,
        activeProjectId: localStorage.getItem('kelc_active_project_id') || null,
        listUpdateTrigger: 0, // [NEW] 트리거 카운터
        panels: {},
        results: {},
        panelConnections: {}, // [NEW] { childId: parentId } 계통 정보 맵
        loadingPanels: new Set(), // [NEW] Track panels currently in flight
        settings: { kec: null, mcc: null, tcc: null },
        
        // [NEW] 동기화 상태 (idle | saving | saved | error)
        syncStatus: {
            local: 'idle',  // 로컬 PC 저장 상태
            remote: 'idle'  // 서버 동기화 상태
        },

        setSyncStatus: (type, status) => set(state => ({
            syncStatus: { ...state.syncStatus, [type]: status }
        })),

        /**
         * 프로젝트 초기화
         */
        initProject: (projectId) => {
            if (!projectId) return;
            // [GUARD] 이미 동일한 프로젝트가 로드되어 있다면 초기화를 스킵하여 데이터 증발 방지
            if (get().activeProjectId === projectId) return;

            // [SoT] 전역 상태 업데이트 전 LocalStorage에 먼저 각인
            localStorage.setItem('kelc_active_project_id', projectId);
            set({ activeProjectId: projectId, panels: {}, results: {} });
            projectService.setActiveProject(projectId);
            
            // 타 탭에 프로젝트 활성화 사실 전송 (즉시 동기화)
            bc.postMessage({
                type: 'RES_ACTIVE_PROJECT',
                payload: { projectId },
                senderId: TAB_ID
            });
        },

        /**
         * 특정 판넬 데이터 로드 (Hydration Barrier 적용)
         * [REFINED] Status-First Hydration (Timestamp 제거)
         */
        loadPanel: async (panelId) => {
            if (!panelId) return null;

            const { panels, activeProjectId } = get();
            
            // 1. [Tier 0] Memory-First: 이미 메모리에 있으면 즉시 반환
            if (panels[panelId]) return panels[panelId];

            // 2. [Tier 1] LocalStorage 확인
            const cacheKey = `kelc_panel_cache_${panelId}`;
            const cached = localStorage.getItem(cacheKey);
            let cachedData = null;
            if (cached) {
                try {
                    cachedData = JSON.parse(cached);
                } catch (e) { console.warn("Cache parse failed:", e); }
            }

            // [Status-First Decision Rule]
            // LocalStorage에 데이터가 있고, 상태가 DIRTY 또는 LOCAL_SAVED라면 로컬을 100% 신뢰
            if (cachedData && (cachedData.status === 'DIRTY' || cachedData.status === 'LOCAL_SAVED')) {
                console.log(`[Hydration] Local-First: Trusting Local Cache (${cachedData.status}) for ${panelId}`);
                set(state => ({
                    panels: { ...state.panels, [panelId]: cachedData }
                }));
                return cachedData;
            }

            // 3. [Tier 2/3] Local이 비어있거나 SERVER_SYNCED 상태인 경우만 서버 데이터 조회
            console.log(`[Hydration] Fetching from Server (Local empty or synced) for ${panelId}`);
            const draftKey = `kelc_panel_draft_${panelId}`;
            const originKey = `kelc_panel_data_${panelId}`;

            try {
                // Draft 우선 조회 후 없으면 Origin 조회
                let remoteData = await projectService.getRemoteData(draftKey, activeProjectId);
                let fallbackStatus = 'DIRTY';

                if (!remoteData) {
                    remoteData = await projectService.getRemoteData(originKey, activeProjectId);
                    fallbackStatus = 'SERVER_SYNCED';
                }

                if (remoteData) {
                    // 서버 데이터는 출처에 따라 상태 부여 (기존 상태가 있으면 유지)
                    const finalData = { 
                        ...remoteData, 
                        status: remoteData.status || fallbackStatus 
                    };
                    
                    set(state => ({
                        panels: { ...state.panels, [panelId]: finalData }
                    }));
                    
                    // 로컬 캐시도 동기화
                    backupToLocal(panelId, finalData);
                    return finalData;
                }
            } catch (error) {
                console.error(`[Hydration] Server fetch failed for ${panelId}:`, error);
            }

            return null;
        },

        /**
         * 판넬 데이터 업데이트 (Tier 1: 스토어 및 로컬 스토리지 즉각 반영)
         */
        updatePanelData: (panelId, updates) => {
            if (!panelId) return;

            set(state => {
                const currentData = state.panels[panelId] || { projectInfo: {}, feeders: [], powerLoads: [] };
                const updatedData = { ...currentData, ...updates };
                
                backupToLocal(panelId, updatedData);

                return { 
                    panels: { ...state.panels, [panelId]: updatedData },
                    syncStatus: { ...state.syncStatus, local: 'saved' }
                };
            });

            // 1초 후 로컬 저장 'saved' 상태 초기화 (아이콘 페이드아웃용)
            setTimeout(() => {
                const { syncStatus } = get();
                if (syncStatus.local === 'saved') {
                    set(state => ({ syncStatus: { ...state.syncStatus, local: 'idle' } }));
                }
            }, 1000);

            // 창 간 실시간 데이터 공유
            const updatedData = get().panels[panelId];
            bc.postMessage({ 
                type: 'UPDATE_PANEL', 
                payload: { panelId, data: updatedData },
                senderId: TAB_ID 
            });
        },

        /**
         * 특정 판넬의 최신 데이터를 스토어에 동기화 및 결과 저장
         */
        syncPanel: (panelId, data, result = null) => {
            if (!panelId) return;

            const state = get();
            const currentData = state.panels[panelId];
            const currentResult = state.results[panelId];

            // [FIX] 상태가 포함된 버전으로 비교하여 무한 루프 방지
            // 기존 상태가 DIRTY면 유지, 아니면 LOCAL_SAVED 부여
            const targetStatus = data.status || (currentData?.status === 'DIRTY' ? 'DIRTY' : 'LOCAL_SAVED');
            const dataWithStatus = { 
                ...data, 
                status: targetStatus 
            };

            const isDataSame = JSON.stringify(currentData) === JSON.stringify(dataWithStatus);
            const isResultSame = JSON.stringify(currentResult) === JSON.stringify(result || currentResult);

            if (isDataSame && isResultSame) return;
            
            // [Tier 1] 즉시 로컬 백업 및 상태 반영
            backupToLocal(panelId, dataWithStatus);
            
            set(state => ({
                panels: { ...state.panels, [panelId]: dataWithStatus },
                results: { 
                    ...state.results, 
                    [panelId]: result || state.results[panelId] || { totalLoad: data?.projectInfo?.cachedTotalLoad || 0 }
                },
                syncStatus: { ...state.syncStatus, local: 'saved' }
            }));

            // 로컬 인디케이터 페이드아웃
            setTimeout(() => {
                const { syncStatus } = get();
                if (syncStatus.local === 'saved') {
                    set(state => ({ syncStatus: { ...state.syncStatus, local: 'idle' } }));
                }
            }, 1000);

            // [ZERO SYNC] 전파 시 TAB_ID 포함 및 신호 발송
            bc.postMessage({ 
                type: 'UPDATE_PANEL', 
                payload: { panelId, data },
                senderId: TAB_ID 
            });
            
            if (result) {
                bc.postMessage({ 
                    type: 'UPDATE_RESULTS', 
                    payload: { panelId, result },
                    senderId: TAB_ID 
                });
            }

            // [ZERO SYNC] 타 계산서(PowerLoad 등)에서 감지할 수 있도록 로컬 스토리지 신호 업데이트
            // [REMOVED] Legacy signal replaced by Zustand state subscription
            // localStorage.setItem('kelc_data_update_signal', Date.now().toString());
        },

        /**
         * 판넬 데이터 서버 저장 (Optimistic)
         */
        savePanel: async (panelId) => {
            const { panels, activeProjectId } = get();
            const data = panels[panelId];
            if (!data || !activeProjectId) return;

            // [Status-First] 서버 저장 시 상태를 SERVER_SYNCED로 업데이트
            const dataToSave = { ...data, status: 'SERVER_SYNCED' };

            try {
                const originKey = `kelc_panel_data_${panelId}`;
                const draftKey = `kelc_panel_draft_${panelId}`;

                // 비동기로 저장 진행 (UI 차단 없음)
                set(state => ({ 
                    panels: { ...state.panels, [panelId]: dataToSave },
                    syncStatus: { ...state.syncStatus, remote: 'saving' } 
                }));
                const startTime = Date.now();
                
                // [STRICT] use setRemoteData from projectService
                projectService.setRemoteData(activeProjectId, originKey, dataToSave)
                    .then(async () => {
                        // 성공 시 Draft 데이터는 서버에서 제거 (정규 저장 데이터가 최신이므로)
                        projectService.removeRemoteData(draftKey, activeProjectId).catch(() => {});
                        
                        // [Sync Status] 최소 800ms 동안 주황색 유지
                        const elapsed = Date.now() - startTime;
                        const minDuration = 800;
                        if (elapsed < minDuration) {
                            await new Promise(resolve => setTimeout(resolve, minDuration - elapsed));
                        }

                        set(state => ({ syncStatus: { ...state.syncStatus, remote: 'saved' } }));
                        setTimeout(() => {
                            const { syncStatus } = get();
                            if (syncStatus.remote === 'saved') {
                                set(state => ({ syncStatus: { ...state.syncStatus, remote: 'idle' } }));
                            }
                        }, 2000);
                    })
                    .catch(e => {
                        console.error("Background save failed:", e);
                        set(state => ({ syncStatus: { ...state.syncStatus, remote: 'error' } }));
                    });
                
                return true;
            } catch (e) {
                console.error(`Failed to save panel ${panelId}:`, e);
                return false;
            }
        },

        getPanelData: (panelId) => get().panels[panelId] || null,
        getPanelResult: (panelId) => get().results[panelId] || null,
        setSettings: (type, data) => set(state => ({
            settings: { ...state.settings, [type]: data }
        })),

        /**
         * 다른 탭들에 프로젝트 종료 및 리다아렉트 신호 전송 (현재 탭 상태는 유지)
         */
        broadcastClose: (redirectTo = '/') => {
            bc.postMessage({ 
                type: 'CLOSE_PROJECT', 
                payload: { redirectTo }, 
                senderId: TAB_ID 
            });
        },

        /**
         * 프로젝트 종료 및 상태 초기화
         * @param {string} redirectTo - 현재 탭이 이동할 경로
         * @param {string} broadcastRedirect - 다른 탭들이 유도될 경로 (기본값: 프로젝트 목록)
         */
        closeProject: (redirectTo = '/', broadcastRedirect = '/projects') => {
            set({ activeProjectId: null, panels: {}, results: {} });
            localStorage.removeItem('kelc_active_project_id');
            localStorage.removeItem('kelc_project_info');
            localStorage.removeItem('kelc_dirty_panels');
            localStorage.setItem('kelc_project_is_dirty', 'false');
            
            // 다른 탭에는 '프로젝트 목록'으로 이동하도록 지시 (전환 시 탭 간섭 방지)
            bc.postMessage({ 
                type: 'CLOSE_PROJECT', 
                payload: { redirectTo: broadcastRedirect }, 
                senderId: TAB_ID 
            });
            
            // 현재 탭 이동
            if (redirectTo) {
                window.location.href = redirectTo;
            }
        },

        /**
         * 프로젝트 삭제 사실 전송
         */
        broadcastDelete: (projectId) => {
            bc.postMessage({
                type: 'PROJECT_DELETED',
                payload: { projectId },
                senderId: TAB_ID
            });
        },

        /**
         * 프로젝트 리스트 갱신 신호 전송 (생성, 복사, 삭제, 수정 시 호출)
         */
        broadcastListUpdate: () => {
            console.log('[SYNC] Broadcasting project list update');
            bc.postMessage({
                type: 'PROJECT_LIST_UPDATED',
                payload: {},
                senderId: TAB_ID
            });
            // 본인 탭의 트리거도 동일하게 증가시켜 동기화
            set(state => ({ listUpdateTrigger: (state.listUpdateTrigger || 0) + 1 }));
            
            // [Legacy Support] 전역 이벤트 발송
            window.dispatchEvent(new Event('kelc_project_info_updated'));
            window.dispatchEvent(new Event('kelc_project_list_updated'));
        },

        /**
         * [LOCAL ONLY] 활성 프로젝트 상태 및 관련 로컬 데이터 강제 초기화
         * 타 탭에 영향을 주지 않으려 할 때(세션 초기화 등) 사용합니다.
         */
        clearActiveProject: () => {
            set({ activeProjectId: null, panels: {}, results: {} });
            localStorage.removeItem('kelc_active_project_id');
            localStorage.removeItem('kelc_project_info');
            localStorage.removeItem('kelc_dirty_panels');
            localStorage.setItem('kelc_project_is_dirty', 'false');
        },

        /**
         * 전 탭 강제 새로고침 신호 전송 (타 탭 대상)
         */
        broadcastReload: () => {
            bc.postMessage({
                type: 'FORCE_RELOAD',
                payload: {},
                senderId: TAB_ID
            });
        },

        /**
         * 타 탭에 활성 프로젝트 상태 요청
         */
        requestActiveProject: () => {
            bc.postMessage({
                type: 'REQ_ACTIVE_PROJECT',
                payload: {},
                senderId: TAB_ID
            });
        },

        /**
         * 분전반 이름 업데이트 (Zustand 통합 브릿지)
         */
        updatePanelName: async (projectId, panelId, newName) => {
            try {
                const result = await projectService.updatePanelName(projectId, panelId, newName);
                if (result) {
                    // 트리 업데이트를 위한 브로드캐스트 전송 (타 탭 동기화)
                    get().broadcastListUpdate();
                    
                    // 현재 탭의 UI 컴포넌트 및 Hook(usePanelLookup 등) 갱신을 위한 이벤트 발생
                    window.dispatchEvent(new CustomEvent('kelc_panel_name_updated', {
                        detail: { panelId, newName }
                    }));
                    window.dispatchEvent(new Event('kelc_project_info_updated'));
                    
                    return true;
                }
                return false;
            } catch (e) {
                console.error('[Store] updatePanelName failed:', e);
                return false;
            }
        },

        /**
         * 전역 설정 업데이트 및 브로드캐스트
         */
        updateSettings: (key, data) => {
            const existing = get().settings[key];
            if (JSON.stringify(existing) === JSON.stringify(data)) return;

            set(state => ({
                settings: { ...state.settings, [key]: data }
            }));

            // 브로드캐스트 전송
            bc.postMessage({
                type: 'UPDATE_SETTINGS',
                payload: { key, data },
                senderId: TAB_ID
            });

            // [Legacy Support] 기존 이벤트 발송 (Zustand 미사용 컴포넌트용)
            const eventMap = {
                kec: 'kelc_settings_updated',
                mcc: 'kelc_mcc_settings_updated',
                tcc: 'kelc_tcc_multiplier_updated'
            };
            if (eventMap[key]) {
                window.dispatchEvent(new CustomEvent(eventMap[key], { detail: { data } }));
            }
        }
    };
});


export { useDataStore };
export default useDataStore;

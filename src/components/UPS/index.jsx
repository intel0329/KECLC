import React, { useState, useEffect, useMemo, useCallback, useRef, useTransition } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePanelLookup } from '../../hooks/usePanelLookup';
import { useConnectionSync } from '../../hooks/useConnectionSync';
import useDataStore from '../../store/useDataStore';
import { Header } from '../Header';
import { calculatePanelTotalLoad, calculateKECJudgment } from '../../utils/kecCalculations';
import { getProject, updatePanelName, savePanelConnections, getRemoteData, setRemoteData } from '../../services/projectService';
import { AlertCircle, CheckCircle, X } from 'lucide-react';
import UpsKECDrawer from './UpsKECDrawer';
import { useSafetyCheck } from '../../hooks/useSafetyCheck';

// Helper for duplicate name check
const isNameDuplicate = (project, name, excludeId = null) => {
    if (!project || !project.calculators) return false;

    const checkInItems = (items) => {
        for (const item of items) {
            if (item.id !== excludeId && (item.name?.trim() || '') === name.trim()) {
                return true;
            }
            if (item.children && checkInItems(item.children)) {
                return true;
            }
        }
        return false;
    };

    return checkInItems(project.calculators);
};

// Import sub-sections
import UpsProjectInfoBar from './sections/UpsProjectInfoBar';
import UpsTable from './sections/UpsTable';
import UpsLoadSummary from './sections/UpsLoadSummary';
import UpsContextMenu from './sections/UpsContextMenu';
import KECJudgmentDrawer from '../KECJudgmentDrawer';

const getVoltageByPhase = (phase) => {
    if (!phase) return 380;
    const cleanPh = String(phase).replace(/[-\s]/g, '').replace(/Ø/g, 'Φ').toUpperCase();
    if (cleanPh.includes('1Φ')) return 220;
    return 380;
};

const getPolesByPhase = (phase) => {
    if (!phase) return '4';
    const cleanPh = String(phase).replace(/[-\s]/g, '').replace(/[ØΦφ]/g, 'Φ').toUpperCase();
    if (cleanPh.includes('3Φ4W')) return '4';
    if (cleanPh.includes('3Φ3W')) return '3';
    if (cleanPh.includes('1Φ2W')) return '2';
    return '4';
};

const normalizePhase = (phase) => {
    if (!phase) return '';
    return String(phase).replace(/[-\s]/g, '').replace(/[ØΦφ]/g, 'Φ').toUpperCase();
};

const UPS = () => {
    const { projectId, panelId } = useParams();
    const navigate = useNavigate();
    const panelsData = useDataStore(state => state.panels);
    const results = useDataStore(state => state.results);
    const updatePanelData = useDataStore(state => state.updatePanelData);
    const savePanel = useDataStore(state => state.savePanel);
    const loadPanel = useDataStore(state => state.loadPanel);
    const syncPanel = useDataStore(state => state.syncPanel);
    const syncStatus = useDataStore(state => state.syncStatus);

    const { panels: allLookupPanels, idToName, nameToId, getNameById, getParentId, globalUsedPanelIds, isLoaded: lookupLoaded } = usePanelLookup(projectId);

    // [Phase 1] Safe-Draft v2 Core State
    const [isHydrating, setIsHydrating] = useState(true);
    const isLocalChangeRef = useRef(false);
    const lastSyncRef = useRef({ dataStr: '', resultStr: '' });
    const latestDataRef = useRef(null);
    const [isPending, startTransition] = useTransition();

    // [CORE STATE] Local state for reactive UI and buffering
    const [projectInfo, setProjectInfo] = useState({
        panelName: 'UPS 용량 계산서',
        mainCapacity: 0,
        mainAF: '',
        mainAT: '',
        mainBreakerType: 'MCCB',
        phase: '3Ø-4W',
        voltage: '380V',
        fromId: '',
        location: '',
        kecMethod: 'E',
        wire: 'FCV',
        cableSize: '',
        usageType: '일반',
        installType: '매입',
        branchDistance: 1.5,
        voltageDropLimit: 3
    });
    const [powerLoads, setPowerLoads] = useState([]);
    const [isDataLoaded, setIsDataLoaded] = useState(false);

    // [Tier 1] Unified Data Sync Helper (Zero-Sync)
    // Refactored to use local state setters instead of immediate store update
    const updateProjectInfo = useCallback((key, value) => {
        isLocalChangeRef.current = true;
        setProjectInfo(prev => ({ ...prev, [key]: value }));
        markAsDirty(panelId);

        // [ZERO SYNC] 즉시 로컬 저장 상태 표시 (🟢)
        useDataStore.getState().setSyncStatus('local', 'saved');

        // [OPTIMISTIC SOURCE UPDATE] 
        if (key === 'fromId') {
            const currentConnections = { ...useDataStore.getState().panelConnections };
            if (value) {
                currentConnections[panelId] = value;
            } else {
                delete currentConnections[panelId];
            }
            useDataStore.setState({ panelConnections: currentConnections });

            // 타 탭에 계통도 변경 알림 (Optimistic)
            const channel = new BroadcastChannel('KECLC_CONNECTION_SYNC');
            channel.postMessage({ type: 'CONNECTION_CHANGED', projectId });
            channel.close();
        }
    }, [panelId, projectId]);

    // [NEW] Filter panels for dropdown (hide if already used as a child, or if it's a transformer/ups type)
    const filteredPanelsForDropdown = useMemo(() => {
        if (!allLookupPanels || !globalUsedPanelIds) return allLookupPanels;
        return allLookupPanels.filter(p => {
            // Block circular UPS or Transformer connections
            const isBlockedType = p.type === 'transformer' || p.type === 'ups' || p.type === 'receiving-capacity';
            const isAlreadyUsed = globalUsedPanelIds.has(p.id);
            return !isBlockedType && !isAlreadyUsed;
        });
    }, [allLookupPanels, globalUsedPanelIds]);

    // Local state for UI only (not persisted core data)
    const [projectName, setProjectName] = useState('');

    // [CONNECTION SYNC] 부모-자식 연결 즉시 동기화
    const getFlushPayload = useCallback(() => {
        if (!isDataLoaded || !panelId) return null;
        const uniqueBanks = Array.from(new Set(powerLoads?.map(l => l.bankId).filter(Boolean) || []));
        const connections = uniqueBanks.map(bankId => ({ child_panel_id: bankId }));
        return {
            draftSaveFn: () => savePanel(panelId),
            connections
        };
    }, [panelId, isDataLoaded, powerLoads, savePanel]);
    const { flushNow: flushConnectionsNow } = useConnectionSync(projectId, panelId, getFlushPayload);

    // Dropdown UI State
    const [activeDropdownId, setActiveDropdownId] = useState(null);
    const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

    // Settings (Standardized default values to match Panel calculation)
    const [kecSettings, setKecSettings] = useState({
        shortCircuitSettings: {
            is: 10,
            tn: 0.1,
            kVal: 143,
            kIsc: 1.2
        },
        cableCondition: {
            area: 50,
            kr: 0.5,
            kx: 0.75
        }
    });

    // [NEW] Multi-selection & Context Menu State
    const [selectedRows, setSelectedRows] = useState([]);
    const isProcessingCommit = useRef(false);
    // [NEW] Context Menu State
    const [contextMenu, setContextMenu] = useState({ show: false, x: 0, y: 0, loadId: null });
    const [clipboard, setClipboard] = useState({ loads: [], type: null }); // type: 'copy' | 'cut'

    // [NEW] Drawer State
    const [isPanelKECDrawerOpen, setIsPanelKECDrawerOpen] = useState(false);
    const [panelHighlightSection, setPanelHighlightSection] = useState(null);

    // [NEW] PANEL/SOURCE state
    const [editingPanelName, setEditingPanelName] = useState('');
    const [sourceSearchText, setSourceSearchText] = useState('');
    const [showSourceDropdown, setShowSourceDropdown] = useState(false);
    const [sourceSelectedIndex, setSourceSelectedIndex] = useState(0);
    const sourceDropdownRef = useRef(null);
    const forceSaveRef = useRef(false);
    const lastSourceChangeRef = useRef(false);

    // Toast State (Premium Local Toast)
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

    // [NEW] Drag and Drop State
    const [draggedRow, setDraggedRow] = useState(null);
    const [dropTarget, setDropTarget] = useState(null);
    const [isGroupDrag, setIsGroupDrag] = useState(false);

    const showToast = useCallback((message, type = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
    }, []);

    // [NEW] Circular Dependency Check
    const checkCircularDependency = useCallback((targetParentId) => {
        if (!targetParentId) return false;
        let current = targetParentId;
        const visited = new Set();
        while (current) {
            if (current === panelId) return true;
            if (visited.has(current)) break;
            visited.add(current);
            current = getParentId(current);
        }
        return false;
    }, [panelId, getParentId]);
    
    // Helper to manage dirty list - triggers red dot in header
    const markAsDirty = async (pId) => {
        if (!pId) return;
        try {
            const dirtyList = JSON.parse(localStorage.getItem('kelc_dirty_panels') || '[]');
            if (!dirtyList.includes(pId)) {
                dirtyList.push(pId);
                localStorage.setItem('kelc_dirty_panels', JSON.stringify(dirtyList));
                localStorage.setItem('kelc_project_is_dirty', 'true'); // Global flag for UI
                // [NEW] 헤더 등에 즉시 상태 변경 알림
                window.dispatchEvent(new Event('kelc_dirty_state_changed'));
            }
        } catch (e) { console.error(e); }
    };

    const markAsClean = async (pId) => {
        if (!pId) return;
        try {
            const dirtyList = JSON.parse(localStorage.getItem('kelc_dirty_panels') || '[]');
            const newList = dirtyList.filter(id => id !== pId);
            localStorage.setItem('kelc_dirty_panels', JSON.stringify(newList));
            if (newList.length === 0) {
                localStorage.setItem('kelc_project_is_dirty', 'false');
            }
            // [NEW] 헤더 등에 즉시 상태 변경 알림
            window.dispatchEvent(new Event('kelc_dirty_state_changed'));
        } catch (e) { console.error(e); }
    };

    // [NEW] Auto-Save Debounce logic (Safe-Draft v2)
    const lastSavedData = useRef(null);
    useEffect(() => {
        // [STRICT] Only the tab that initiated the local change (isLocalChangeRef) performs the save.
        if (!isDataLoaded || !panelId || !isLocalChangeRef.current) return;

        const timer = setTimeout(async () => {
            const dataStr = JSON.stringify({ projectInfo, powerLoads });
            if (lastSavedData.current !== dataStr) {
                lastSavedData.current = dataStr;
                
                // [Sync Status] Start saving (Orange)
                useDataStore.getState().setSyncStatus('remote', 'saving');
                const startTime = Date.now();
                
                try {
                    const draftKey = `kelc_panel_draft_${panelId}`;
                    const dataToSave = { 
                        projectInfo, 
                        powerLoads,
                        savedAt: new Date().toISOString(),
                        status: 'DIRTY',
                        isDraft: true 
                    };
                    
                    await setRemoteData(projectId, draftKey, dataToSave);
                    
                    // [NEW] Extract bank IDs and save panel connections for UPS
                    const uniqueBanks = Array.from(new Set(powerLoads?.map(l => l.bankId).filter(Boolean) || []));
                    const connections = uniqueBanks.map(bankId => ({ child_panel_id: bankId }));
                    if (projectId) {
                        await savePanelConnections(projectId, panelId, connections);
                    }
                    
                    console.log('[UPS] Draft auto-saved');

                    // [Sync Status] Ensure 'saving' is visible for at least 800ms
                    const elapsed = Date.now() - startTime;
                    const minDuration = 800;
                    if (elapsed < minDuration) {
                        await new Promise(resolve => setTimeout(resolve, minDuration - elapsed));
                    }

                    // [Sync Status] Finished saving (Blue/Green)
                    useDataStore.getState().setSyncStatus('remote', 'saved');
                    
                    // [IMPORTANT] 모든 동기화가 완료된 후 리더 권한 반납
                    isLocalChangeRef.current = false;
                    
                    setTimeout(() => {
                        const currentRemoteStatus = useDataStore.getState().syncStatus?.remote;
                        if (currentRemoteStatus === 'saved') {
                            useDataStore.getState().setSyncStatus('remote', 'idle');
                        }
                    }, 2000);
                } catch (e) {
                    console.error('UPS auto-save failed:', e);
                    useDataStore.getState().setSyncStatus('remote', 'error');
                }
            }
        }, 3000); // 3s debounce to match other sheets

        return () => clearTimeout(timer);
    }, [projectInfo, powerLoads, panelId, isDataLoaded, savePanel]);

    // [NEW] 수동 저장 이벤트 처리 (Header 저장 버튼)
    useEffect(() => {
        const handleTriggerSave = async (e) => {
            if (e.detail?.panelId !== panelId) return;
            if (!isDataLoaded) return;

            try {
                await savePanel(panelId);
                const uniqueBanks = Array.from(new Set(powerLoads?.map(l => l.bankId).filter(Boolean) || []));
                const connections = uniqueBanks.map(bankId => ({ child_panel_id: bankId }));
                if (projectId) {
                    await savePanelConnections(projectId, panelId, connections);
                }
                markAsClean(panelId);
                showToast('저장되었습니다.');
                window.dispatchEvent(new CustomEvent('kelc_save_finished', { detail: { panelId, success: true } }));
            } catch (err) {
                console.error('Failed to manual save:', err);
                showToast('저장에 실패했습니다.', 'error');
                window.dispatchEvent(new CustomEvent('kelc_save_finished', { detail: { panelId, success: false, error: err.message } }));
            }
        };

        window.addEventListener('kelc_trigger_save', handleTriggerSave);
        return () => window.removeEventListener('kelc_trigger_save', handleTriggerSave);
    }, [panelId, projectId, savePanel, showToast]);

    // [FIX] lookup 데이터 로드 완료 시 편집 중인 이름과 동기화 (초기 로딩 대응)
    useEffect(() => {
        if (lookupLoaded && panelId && editingPanelName === 'UPS 용량 계산서') {
            const actualName = getNameById(panelId);
            if (actualName && actualName !== 'UPS 용량 계산서') {
                setEditingPanelName(actualName);
            }
        }
    }, [lookupLoaded, panelId, getNameById, editingPanelName]);

    // Initial Load (Memory-First Hydration with Blocking Gate)
    useEffect(() => {
        if (!projectId || !panelId) return;

        const loadInitialData = async () => {
            if (!isDataLoaded) setIsHydrating(true);
            let currentPanel = null;
            try {
                // 1. [Memory First] Check if main panel already exists in store
                currentPanel = useDataStore.getState().panels[panelId];
                
                if (!currentPanel || (!currentPanel.powerLoads && !currentPanel.projectInfo)) {
                    // 2. [Tier 2] Local Cache Check (Status-First)
                    const cacheKey = `kelc_panel_cache_${panelId}`;
                    const cached = localStorage.getItem(cacheKey);
                    let cachedData = null;
                    if (cached) {
                        try { cachedData = JSON.parse(cached); } catch (e) { console.warn("Cache parse failed:", e); }
                    }

                    if (cachedData && (cachedData.status === 'DIRTY' || cachedData.status === 'LOCAL_SAVED')) {
                        console.log(`[UPS Hydration] Local-First: Trusting Local Cache (${cachedData.status})`);
                        currentPanel = cachedData;
                    } else {
                        // 3. [Tier 3] Server Fetch (Draft -> Origin)
                        console.log('[UPS] Fetching main panel from server...');
                        currentPanel = await loadPanel(panelId);
                    }
                } else {
                    console.log('[UPS] Memory-First hydration: Main panel found in store');
                }

                if (currentPanel) {
                    // 2. [Blocking Hydration] Pre-load all connected banks ( 을지 데이터 ) - Recursive Deep Loading
                    const bankIds = Array.from(new Set(currentPanel.powerLoads?.map(l => l.bankId).filter(Boolean) || []));
                    
                    const loadRecursive = async (ids) => {
                        if (!ids || ids.length === 0) return;
                        const subIds = [];
                        await Promise.all(ids.map(async (bId) => {
                            if (!useDataStore.getState().panels[bId]) {
                                const data = await loadPanel(bId, true);
                                if (data) {
                                    const circuits = data.leftCircuits ? [...(data.leftCircuits || []), ...(data.rightCircuits || [])] : (data.powerLoads || []);
                                    circuits.forEach(c => {
                                        const subId = c.connectedPanelId || c.loads?.find(l => l.category === 'PL')?.connectedPanelId;
                                        if (subId) subIds.push(subId);
                                    });
                                }
                            }
                        }));
                        const nextIds = [...new Set(subIds.filter(id => !useDataStore.getState().panels[id]))];
                        if (nextIds.length > 0) await loadRecursive(nextIds);
                    };

                    if (bankIds.length > 0) {
                        console.log(`[UPS] Blocking Hydration: Deep loading ${bankIds.length} banks...`);
                        await loadRecursive(bankIds);
                    }
                }
            } catch (e) {
                console.error('[UPS] Hydration failed:', e);
            } finally {
                // [FIX] 프로젝트 메타데이터에서 실제 패널 이름 선제 로드 (lookup 로딩 지연 대응)
                let actualPanelName = '';
                try {
                    const project = await getProject(projectId);
                    if (project) {
                        const findName = (items) => {
                            for (const item of items) {
                                if (item.id === panelId) return item.name;
                                if (item.children) {
                                    const found = findName(item.children);
                                    if (found) return found;
                                }
                            }
                            return null;
                        };
                        actualPanelName = findName(project.calculators.flatMap(c => c.children || [])) || '';
                    }
                } catch (err) {
                    console.error('[UPS] Metadata fetch failed:', err);
                }

                startTransition(() => {
                    const baseInfo = currentPanel?.projectInfo || {
                        panelName: actualPanelName || getNameById(panelId, 'UPS 용량 계산서'),
                        mainCapacity: 0,
                        mainAF: '',
                        mainAT: '',
                        mainBreakerType: 'MCCB',
                        phase: '3Ø-4W',
                        voltage: '380V',
                        fromId: '',
                        location: '',
                        kecMethod: 'E',
                        wire: 'FCV',
                        cableSize: '',
                        usageType: '일반',
                        installType: '매입',
                        branchDistance: 1.5,
                        voltageDropLimit: 3
                    };

                    // [SSOT] Force the actual name from project tree metadata
                    if (actualPanelName) {
                        baseInfo.panelName = actualPanelName;
                    }

                    setProjectInfo(baseInfo);
                    setPowerLoads(currentPanel?.powerLoads || []);
                    setEditingPanelName(actualPanelName || getNameById(panelId, 'UPS 용량 계산서'));
                    setIsDataLoaded(true);
                    setIsHydrating(false);
                });
            }
        };

        loadInitialData();
    }, [projectId, panelId]);

    // [NEW] Load KEC Settings & Sync (identical to PanelLoad)
    useEffect(() => {
        const loadLocalSettings = () => {
            try {
                const defaultKey = 'kelc_setting_data';
                const projectKey = projectId ? `${defaultKey}_${projectId}` : defaultKey;
                const saved = localStorage.getItem(projectKey) || localStorage.getItem(defaultKey);
                if (saved) setKecSettings(prev => ({ ...prev, ...JSON.parse(saved) }));
            } catch (e) { console.error('Failed to load local settings:', e); }
        };
        
        loadLocalSettings();
        
        // Listen for same-tab updates and other-tab storage events
        window.addEventListener('kelc_settings_updated', loadLocalSettings);
        const handleStorageChange = (e) => {
            if (e.key === 'kelc_setting_data' || (projectId && e.key === `kelc_setting_data_${projectId}`)) {
                loadLocalSettings();
            }
        };
        window.addEventListener('storage', handleStorageChange);
        
        return () => {
            window.removeEventListener('kelc_settings_updated', loadLocalSettings);
            window.removeEventListener('storage', handleStorageChange);
        };
    }, [projectId]);

    // [NEW] Load KEC Settings from Server (Remote Sync)
    useEffect(() => {
        if (!projectId) return;
        const loadRemoteSettings = async () => {
            try {
                const defaultKey = 'kelc_setting_data';
                const projectKey = `${defaultKey}_${projectId}`;
                
                let remoteData = await getRemoteData(projectKey, projectId);
                if (!remoteData) {
                    remoteData = await getRemoteData(defaultKey, projectId);
                }
                
                if (remoteData) {
                    setKecSettings(prev => ({ ...prev, ...remoteData }));
                }
            } catch (e) {
                console.error('Failed to load remote KEC settings:', e);
            }
        };
        loadRemoteSettings();
    }, [projectId]);

    // Get Project Name from LocalStorage (for Header compatibility)
    useEffect(() => {
        const saved = localStorage.getItem('kelc_project_info');
        if (saved) {
            const data = JSON.parse(saved);
            if (data.projectName) setProjectName(data.projectName);
        }
    }, [projectId]);

    // [Tier 1 -> Tier 2] 실시간 데이터 참조 업데이트 (Zustand 동기화용)
    useEffect(() => {
        latestDataRef.current = { projectInfo, powerLoads };
    }, [projectInfo, powerLoads]);

    // [Phase 1] External Sync (BroadcastChannel Support)
    useEffect(() => {
        const storeData = panelsData[panelId];
        if (!storeData || !isDataLoaded || isLocalChangeRef.current) return;

        const currentDataStr = JSON.stringify({ projectInfo, powerLoads });
        const storeDataStr = JSON.stringify({
            projectInfo: storeData.projectInfo || {},
            powerLoads: storeData.powerLoads || []
        });

        if (currentDataStr !== storeDataStr) {
            console.log(`[ZERO SYNC] External update received for UPS ${panelId}`);
            if (storeData.projectInfo) {
                setProjectInfo(prev => ({ ...prev, ...storeData.projectInfo }));
                if (storeData.projectInfo.panelName && storeData.projectInfo.panelName !== editingPanelName) {
                    setEditingPanelName(storeData.projectInfo.panelName);
                }
            }
            if (storeData.powerLoads) setPowerLoads(storeData.powerLoads);
        }
    }, [panelsData, panelId, isDataLoaded]);

    // [NEW] Load data for all connected sub-panels (Banks) to ensure reactivity - Recursive
    useEffect(() => {
        if (!isDataLoaded) return;
        
        const loadSubRecursive = async (ids) => {
            const nextSubIds = [];
            for (const bid of ids) {
                if (!panelsData[bid]) {
                    const data = await loadPanel(bid, true).catch(() => null);
                    if (data) {
                        const subCircuits = data.leftCircuits ? [...(data.leftCircuits || []), ...(data.rightCircuits || [])] : (data.powerLoads || []);
                        subCircuits.forEach(sc => {
                            const sid = sc.connectedPanelId || sc.loads?.find(l => l.category === 'PL')?.connectedPanelId;
                            if (sid && !panelsData[sid]) nextSubIds.push(sid);
                        });
                    }
                }
            }
            if (nextSubIds.length > 0) {
                const filteredIds = [...new Set(nextSubIds)];
                await loadSubRecursive(filteredIds);
            }
        };

        const bankIds = [...new Set(powerLoads.map(l => l.bankId).filter(Boolean))];
        loadSubRecursive(bankIds);
    }, [isDataLoaded, powerLoads, loadPanel, panelsData]);

    // --- Core Logic: Dropdown Search & Position ---
    const handleOpenDropdown = useCallback((containerEl, rowId) => {
        if (!containerEl) {
            setActiveDropdownId(null);
            return;
        }
        const rect = containerEl.getBoundingClientRect();
        setDropdownPos({
            top: rect.bottom + window.scrollY,
            left: rect.left + window.scrollX,
            width: rect.width
        });
        setActiveDropdownId(`panel-${rowId}`);
    }, []);

    // Click outside to close dropdown, context menu, and clear selection
    useEffect(() => {
        const handleClick = (e) => {
            if (activeDropdownId && !e.target.closest('.SearchablePanelCell-container')) {
                setActiveDropdownId(null);
            }
            if (contextMenu.show) {
                setContextMenu({ show: false, x: 0, y: 0, loadId: null });
            }

            // Selection reset: only if clicking outside the table rows and not on context menu
            if (!e.target.closest('td') && !e.target.closest('.context-menu')) {
                setSelectedRows([]);
            }
        };
        window.addEventListener('mousedown', handleClick);
        return () => window.removeEventListener('mousedown', handleClick);
    }, [activeDropdownId, contextMenu.show]);

    // [NEW] Panel Name Commit
    const broadcastListUpdate = useDataStore(state => state.broadcastListUpdate);
    const handlePanelNameCommit = useCallback(async () => {
        if (isProcessingCommit.current) return;

        const newName = editingPanelName.trim();
        const currentName = getNameById(panelId);

        // 기존 이름과 같으면 무시
        if (!newName || newName === currentName) {
            setEditingPanelName(currentName || '');
            return;
        }

        isProcessingCommit.current = true;
        try {
            const project = await getProject(projectId);
            if (isNameDuplicate(project, newName, panelId)) {
                showToast(`'${newName}' 이름은 이미 사용 중입니다.`, "error");
                setEditingPanelName(currentName || '');
                return;
            }

            // [ZERO SYNC] 즉시 로컬 상태 반영 및 브로드캐스팅
            const success = await useDataStore.getState().updatePanelName(projectId, panelId, newName);
            if (success) {
                isLocalChangeRef.current = true;
                setProjectInfo(prev => ({ ...prev, panelName: newName }));
                
                broadcastListUpdate();
                window.dispatchEvent(new Event('kelc_project_info_updated'));
                showToast('판넬 이름이 변경되었습니다.');
            } else {
                showToast("이름 변경 실패", "error");
                setEditingPanelName(currentName || '');
            }
        } catch (e) {
            console.error(e);
            showToast("이름 변경 오류", "error");
            setEditingPanelName(currentName || '');
        } finally {
            isProcessingCommit.current = false;
        }
    }, [editingPanelName, panelId, projectId, getNameById, showToast, panelsData, syncPanel, broadcastListUpdate]);

    // [NEW] Context Menu Handlers
    const handleContextMenu = useCallback((e, loadId) => {
        e.preventDefault();

        // If the right-clicked row isn't in selection, select it exclusively
        if (!selectedRows.includes(loadId)) {
            setSelectedRows([loadId]);
        }

        setContextMenu({
            show: true,
            x: e.clientX,
            y: e.clientY,
            loadId
        });
    }, [selectedRows]);

    const handleGroupContextMenu = useCallback((e, group) => {
        e.preventDefault();
        const firstId = group.loads[0]?.id;
        if (!firstId) return;

        // Select all IDs in the group
        const allIds = group.loads.map(l => l.id);
        setSelectedRows(allIds);

        setContextMenu({
            show: true,
            x: e.clientX,
            y: e.clientY,
            loadId: firstId
        });
    }, []);

    const closeContextMenu = useCallback(() => {
        setContextMenu({ show: false, x: 0, y: 0, loadId: null });
    }, []);

    const handleGroupClick = useCallback((group, e) => {
        const allIds = group.loads.map(l => l.id);

        if (e.ctrlKey || e.metaKey) {
            // Toggle group selection
            const someAlreadySelected = allIds.some(id => selectedRows.includes(id));
            if (someAlreadySelected) {
                setSelectedRows(prev => prev.filter(id => !allIds.includes(id)));
            } else {
                setSelectedRows(prev => Array.from(new Set([...prev, ...allIds])));
            }
        } else {
            // Exclusively select group (Toggle if already exclusively selected)
            const isExactlySelected = allIds.length > 0 &&
                allIds.length === selectedRows.length &&
                allIds.every(id => selectedRows.includes(id));

            if (isExactlySelected) {
                setSelectedRows([]);
            } else {
                setSelectedRows(allIds);
            }
        }
    }, [selectedRows]);

    const handleRowClick = useCallback((loadId, e) => {
        if (e.shiftKey && selectedRows.length > 0) {
            // Shift-select range
            const lastId = selectedRows[selectedRows.length - 1];
            const startIdx = powerLoads.findIndex(l => l.id === lastId);
            const endIdx = powerLoads.findIndex(l => l.id === loadId);
            if (startIdx !== -1 && endIdx !== -1) {
                const range = powerLoads
                    .slice(Math.min(startIdx, endIdx), Math.max(startIdx, endIdx) + 1)
                    .map(l => l.id);
                setSelectedRows(prev => Array.from(new Set([...prev, ...range])));
            }
        } else if (e.ctrlKey || e.metaKey) {
            // Ctrl-select toggle
            setSelectedRows(prev =>
                prev.includes(loadId) ? prev.filter(id => id !== loadId) : [...prev, loadId]
            );
        } else {
            // Single select (Toggle if already exclusively selected)
            if (selectedRows.length === 1 && selectedRows[0] === loadId) {
                setSelectedRows([]);
            } else {
                setSelectedRows([loadId]);
            }
        }
    }, [powerLoads, selectedRows]);

    // [NEW] Drag and Drop Handlers
    const handleDragStart = useCallback((e, loadId, isGroup = false) => {
        setDraggedRow(loadId);
        setIsGroupDrag(isGroup);
        e.dataTransfer.effectAllowed = 'move';
    }, []);

    const handleDragOver = useCallback((e, loadId) => {
        e.preventDefault();
        if (loadId === draggedRow) return;

        let targetId = loadId;
        let position = 'above';
        const rect = e.currentTarget.getBoundingClientRect();
        const y = e.clientY - rect.top;

        if (isGroupDrag) {
            const targetLoad = powerLoads.find(l => l.id === loadId);
            if (targetLoad?.bankId) {
                const groupRows = powerLoads.filter(l => l.bankId === targetLoad.bankId);
                const firstId = groupRows[0].id;
                const lastId = groupRows[groupRows.length - 1].id;

                if (y < rect.height / 2) {
                    targetId = firstId;
                    position = 'above';
                } else {
                    targetId = lastId;
                    position = 'below';
                }
            } else {
                position = y < rect.height / 2 ? 'above' : 'below';
            }
        } else {
            position = y < rect.height / 2 ? 'above' : 'below';
        }

        setDropTarget({ id: targetId, position });
    }, [draggedRow, isGroupDrag, powerLoads]);

    const handleDragLeave = useCallback(() => {
        setDropTarget(null);
    }, []);

    const handleDrop = useCallback((e, targetIdArg) => {
        e.preventDefault();
        if (!draggedRow) {
            setDraggedRow(null);
            setDropTarget(null);
            return;
        }

        const position = dropTarget?.position || 'above';
        const targetId = dropTarget?.id || targetIdArg;

        if (draggedRow === targetId) {
            setDraggedRow(null);
            setDropTarget(null);
            return;
        }

        let draggedItems;
        const draggedLoad = powerLoads.find(l => l.id === draggedRow);
        if (isGroupDrag && draggedLoad?.bankId) {
            draggedItems = powerLoads.filter(l => l.bankId === draggedLoad.bankId).map(l => l.id);
        } else {
            draggedItems = selectedRows.includes(draggedRow) ? selectedRows : [draggedRow];
        }

        const remainingLoads = powerLoads.filter(l => !draggedItems.includes(l.id));
        const draggedLoadsData = powerLoads.filter(l => draggedItems.includes(l.id));

        const targetIdx = remainingLoads.findIndex(l => l.id === targetId);
        if (targetIdx === -1) {
            setDraggedRow(null);
            setDropTarget(null);
            return;
        }

        const insertionIdx = position === 'below' ? targetIdx + 1 : targetIdx;
        const newLoads = [
            ...remainingLoads.slice(0, insertionIdx),
            ...draggedLoadsData,
            ...remainingLoads.slice(insertionIdx)
        ];

        isLocalChangeRef.current = true;
        setPowerLoads(newLoads);
        markAsDirty(panelId);
        setDraggedRow(null);
        setDropTarget(null);
        setIsGroupDrag(false);
    }, [draggedRow, dropTarget, powerLoads, selectedRows, panelId]);

    const handleDragEnd = useCallback(() => {
        setDraggedRow(null);
        setDropTarget(null);
        setIsGroupDrag(false);
    }, []);

    const handleInsertRow = useCallback((position = 'below') => {
        isLocalChangeRef.current = true;
        if (selectedRows.length === 0) return;
        const targetId = selectedRows[position === 'above' ? 0 : selectedRows.length - 1];
        const targetIdx = powerLoads.findIndex(l => l.id === targetId);
        if (targetIdx === -1) return;

        const newId = `new-${Date.now()}`;
        const newRow = {
            id: newId,
            bankName: '', bankId: null, sourceCircuitId: null, bankType: 'ONLINE', bankLocation: '',
            circuit: '', equipmentName: '', type: 'LOAD', phase: '3Φ4W', voltage: '380V',
            kva: '0', kw: '0', demandFactor: '100', pf: '0.9', eff: '0.95',
            breakerType: 'MCCB', p: '3', af: '', at: '',
            isFire: false, isBlackout: true, isSequential: false, connectedPanelId: null
        };

        const newLoads = [...powerLoads];
        newLoads.splice(position === 'above' ? targetIdx : targetIdx + 1, 0, newRow);
        setPowerLoads(newLoads);
        markAsDirty(panelId);
    }, [panelId, powerLoads, selectedRows]);

    const handleDeleteSelected = useCallback(() => {
        if (selectedRows.length === 0) return;
        isLocalChangeRef.current = true;
        const newLoads = powerLoads.filter(l => !selectedRows.includes(l.id));
        setPowerLoads(newLoads);
        setSelectedRows([]);
        markAsDirty(panelId);
    }, [panelId, powerLoads, selectedRows]);

    const handleCopy = useCallback(() => {
        if (selectedRows.length === 0) return;
        const loadsToCopy = powerLoads.filter(l => selectedRows.includes(l.id));
        setClipboard({ loads: JSON.parse(JSON.stringify(loadsToCopy)), type: 'copy' });
    }, [powerLoads, selectedRows]);

    const handleCut = useCallback(() => {
        if (selectedRows.length === 0) return;
        const loadsToCut = powerLoads.filter(l => selectedRows.includes(l.id));
        setClipboard({ loads: JSON.parse(JSON.stringify(loadsToCut)), type: 'cut' });
    }, [powerLoads, selectedRows]);

    const handlePaste = useCallback(() => {
        if (clipboard.loads.length === 0 || selectedRows.length === 0) return;
        isLocalChangeRef.current = true;
        const targetId = selectedRows[selectedRows.length - 1];
        const targetIdx = powerLoads.findIndex(l => l.id === targetId);
        if (targetIdx === -1) return;

        const loadsToPaste = clipboard.loads.map((l, i) => ({
            ...l,
            id: `pasted-${Date.now()}-${i}`
        }));

        const newLoads = [...powerLoads];
        newLoads.splice(targetIdx + 1, 0, ...loadsToPaste);

        if (clipboard.type === 'cut') {
            const cutIds = clipboard.loads.map(l => l.id);
            const filteredLoads = newLoads.filter((l, idx) => {
                return !cutIds.includes(l.id) || l.id.startsWith('pasted-');
            });
            setPowerLoads(filteredLoads);
            setClipboard({ loads: [], type: null });
            markAsDirty(panelId);
        } else {
            setPowerLoads(newLoads);
            markAsDirty(panelId);
        }
    }, [panelId, powerLoads, selectedRows, clipboard]);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (activeDropdownId) return; // Ignore if searching

            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'c' || e.key === 'C') {
                    handleCopy();
                } else if (e.key === 'x' || e.key === 'X') {
                    handleCut();
                } else if (e.key === 'v' || e.key === 'V') {
                    handlePaste();
                }
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                // Only delete if not in an input
                if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
                    handleDeleteSelected();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleCopy, handleCut, handlePaste, handleDeleteSelected, activeDropdownId]);

    /**
     * [NEW] Extract detailed circuit data from sub-panels
     */
    const extractCircuitsFromPanelData = useCallback((panelId, panelData) => {
        if (!panelData) return [];
        let circuits = [];
        const info = panelData.projectInfo || {};
        const bankName = info.panelName || panelData.name || '';
        const bankLocation = info.location || panelData.location || '';
        const bankMainType = info.mainBreakerType || 'MCCB';
        const bankMainAF = info.mccbAF || '';
        const bankMainAT = info.mccbAT || '';
        const bankMainP = getPolesByPhase(info.phase);

        // Settings defaults for PF/Eff
        const defaultPF = kecSettings?.cableCondition?.powerFactor || 0.8;
        const defaultEff = kecSettings?.cableCondition?.efficiency || 1.0;

        if (panelData.leftCircuits || panelData.rightCircuits) {
            // Distribution Panel (Normal-Eulji style)
            ['leftCircuits', 'rightCircuits'].forEach(side => {
                if (panelData[side]) {
                    panelData[side].forEach((c, i) => {
                        // Include if has usage, power, connected panel, loadName, at, or category is '예비'
                        const isSpare = c.category === '예비' || (c.loads?.[0]?.category === '예비');
                        if (c.usage || c.connectedPanelId || c.power || c.loadName || c.at || isSpare) {
                            // [SoT Sync] Reactive Lookup for connected sub-panels
                            const connId = c.connectedPanelId || c.loads?.find(l => l.category === 'PL')?.connectedPanelId || null;
                            const subRes = connId ? results[connId] : null;
                            const subInfo = connId ? (panelsData[connId]?.projectInfo || {}) : {};
                            const subInfoLoaded = !!panelsData[connId];

                            // [Memory-First] 자식 패널의 실제 설정을 최우선 참조
                            const numericP = String(subInfo.phase ? getPolesByPhase(subInfo.phase) : (c.p || '4'));
                            let phase = subInfo.phase || c.phase || info.phase || '1Φ2W';
                            
                            // [SoT] 극수와 상 정보 동기화
                            if (numericP === '2') phase = '1Φ2W';
                            else if (numericP === '3') phase = '3Φ3W';
                            else if (numericP === '4') phase = '3Φ4W';

                            const finalVoltage = `${getVoltageByPhase(phase)}V`;
                            
                            // [Reactive Power Lookup] 실시간 계산 결과(results)가 있으면 이를 우선 사용 (SSOT)
                            const powerVA = subRes ? (subRes.totalLoad || 0) : (subInfo.cachedTotalLoad || c.power || 0);
                            const kva = (Number(powerVA) / 1000).toFixed(2);
                            
                            const pf = Number(c.pf || c.powerFactor || info.powerFactor || defaultPF);
                            const eff = Number(c.eff || c.efficiency || info.efficiency || defaultEff);

                            const sidePrefix = side === 'leftCircuits' ? 'L' : 'R';

                            // [Reactive phaseLine Lookup] 자식이 단상일 경우, 자식이 선택한 BUS 상 위치(헤더 선택값)를 최우선 반영
                            const isSubSinglePhase = normalizePhase(subInfo.phase).includes('1Φ2W') || normalizePhase(subInfo.phase).includes('1Ø-2W');
                            const currentPhaseLine = isSubSinglePhase ? (subInfo.selectedPhaseLine || 'L1') : (c.phaseLine || 'L1');

                            const firstLoad = c.loads?.[0];

                            circuits.push({
                                sourceCircuitId: `${sidePrefix}-${c.id || i}`,
                                circuitNo: c.loadName || c.circuitNo || c.no || `${sidePrefix}${i + 1}`,
                                equipmentName: firstLoad?.name || c.loadName || c.usage || '',
                                bankId: panelId,
                                bankName: bankName,
                                bankLocation: bankLocation,
                                bankMainType: bankMainType,
                                bankMainP: bankMainP,
                                bankMainAF: bankMainAF,
                                bankMainAT: bankMainAT,
                                connectedPanelId: connId,
                                phase: phase,
                                voltage: finalVoltage,
                                kva: kva,
                                demandFactor: c.demandFactor || '100',
                                pf: pf.toFixed(2),
                                eff: eff.toFixed(2),
                                loadType: (connId ? 'PL' : (firstLoad?.category || c.category || '기타')),
                                breakerType: subInfo.mainBreakerType || (connId ? (subInfoLoaded ? '' : (c.type || 'MCCB')) : (c.type || 'MCCB')),
                                af: subInfo.mccbAF || (connId ? (subInfoLoaded ? '' : (c.af || '')) : (c.af || '')),
                                at: subInfo.mccbAT || (connId ? (subInfoLoaded ? '' : (c.at || '')) : (c.at || '')),
                                p: numericP,
                                isFire: false,
                                isBlackout: true,
                                phaseLine: currentPhaseLine,
                                // [NEW] 자식의 상별 부하 분포 전파 (SSOT 기반)
                                childPhaseTotals: subRes?.phaseTotals ? {
                                    l1: (subRes.phaseTotals.l1 || 0) / 1000,
                                    l2: (subRes.phaseTotals.l2 || 0) / 1000,
                                    l3: (subRes.phaseTotals.l3 || 0) / 1000
                                } : (c.phaseTotals ? {
                                    l1: (c.phaseTotals.l1 || 0) / 1000,
                                    l2: (c.phaseTotals.l2 || 0) / 1000,
                                    l3: (c.phaseTotals.l3 || 0) / 1000
                                } : null)
                            });
                        }
                    });
                }
            });
        } else if (panelData.powerLoads) {
            // Power/MCC Panel
            panelData.powerLoads.forEach((l, i) => {
                const isSpare = l.type === '예비';
                if (l.equipmentName || l.effectivePower || l.apparentPower || l.at || isSpare) {
                    const connId = l.connectedPanelId || null;
                    const subRes = connId ? results[connId] : null;
                    const subInfo = connId ? (panelsData[connId]?.projectInfo || {}) : {};

                    const phase = l.phase || info.phase || '3Φ4W';
                    const finalVoltage = `${getVoltageByPhase(phase)}V`;
                    const pf = Number(l.powerFactor || info.powerFactor || defaultPF);
                    const eff = Number(l.efficiency || info.efficiency || defaultEff);

                    let kvaVal = 0;
                    if (l.type === 'MOTOR' || l.type === 'PUMP') {
                        const kw = Number(l.effectivePower) || 0;
                        if (pf > 0 && eff > 0) {
                            kvaVal = kw / (pf * eff);
                        }
                    } else {
                        const powerVA = subRes ? (subRes.totalLoad || 0) : (subInfo.cachedTotalLoad || (Number(l.apparentPower) * 1000) || 0);
                        kvaVal = powerVA / 1000;
                    }

                    circuits.push({
                        sourceCircuitId: l.id || `PL-${i}`,
                        circuitNo: l.circuitNo || l.circuit || `${i + 1}`,
                        equipmentName: l.equipmentName || '',
                        bankId: panelId,
                        bankName: bankName,
                        bankLocation: bankLocation,
                        bankMainType: bankMainType,
                        bankMainP: bankMainP,
                        bankMainAF: bankMainAF,
                        bankMainAT: bankMainAT,
                        connectedPanelId: connId,
                        phase: phase,
                        voltage: finalVoltage,
                        kva: kvaVal.toFixed(2),
                        demandFactor: l.demandFactor || '100',
                        pf: pf.toFixed(2),
                        eff: eff.toFixed(2),
                        loadType: l.type || 'LOAD',
                        breakerType: subInfo.mainBreakerType || l.cbType || l.breakerType || 'MCCB',
                        af: subInfo.mccbAF || l.af || '',
                        at: subInfo.mccbAT || l.at || '',
                        p: l.p || (phase?.includes('1Ø') ? '2' : '4'),
                        isFire: l.isFire || false,
                        isBlackout: l.isBlackout || true,
                        phaseLine: l.phaseLine || 'L1',
                        childPhaseTotals: subRes?.phaseTotals ? {
                            l1: (subRes.phaseTotals.l1 || 0) / 1000,
                            l2: (subRes.phaseTotals.l2 || 0) / 1000,
                            l3: (subRes.phaseTotals.l3 || 0) / 1000
                        } : (l.phaseTotals ? {
                            l1: (l.phaseTotals.l1 || 0) / 1000,
                            l2: (l.phaseTotals.l2 || 0) / 1000,
                            l3: (l.phaseTotals.l3 || 0) / 1000
                        } : null)
                    });
                }
            });
        }
        return circuits;
    }, [projectId, results, panelsData, kecSettings]); // getNameById 의존성 제거

    /**
     * [NEW] Handle row expansion when a sub-panel is selected
     */
    const handleBankSelection = useCallback(async (loadId, selectedPanel) => {
        if (!selectedPanel) return;

        try {
            const bankData = await loadPanel(selectedPanel.id, true);
            const circuits = extractCircuitsFromPanelData(selectedPanel.id, bankData);

            const newLoads = [...powerLoads];
            const targetIdx = newLoads.findIndex(l => l.id === loadId);
            if (targetIdx === -1) return;

            const currentLoad = newLoads[targetIdx];

            if (circuits.length === 0) {
                // If no circuits, just update the single row
                newLoads[targetIdx] = {
                    ...currentLoad,
                    bankName: selectedPanel.name,
                    bankId: selectedPanel.id,
                    connectedPanelId: selectedPanel.id,
                    bankMainType: bankData.projectInfo?.mainBreakerType || 'MCCB',
                    bankMainAF: bankData.projectInfo?.mccbAF || '',
                    bankMainAT: bankData.projectInfo?.mccbAT || '',
                    bankMainP: getPolesByPhase(bankData.projectInfo?.phase),
                    bankLocation: bankData.projectInfo?.location || '',
                    kva: (calculatePanelTotalLoad(bankData) / 1000).toFixed(2)
                };
            } else {
                // Expand into multiple rows
                newLoads.splice(targetIdx, 1);
                const rowsToAdd = circuits.map((c, i) => ({
                    ...currentLoad,
                    id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 5)}`,
                    bankId: c.bankId,
                    bankName: c.bankName,
                    bankLocation: c.bankLocation,
                    sourceCircuitId: c.sourceCircuitId,
                    circuit: c.circuitNo,
                    equipmentName: c.equipmentName,
                    connectedPanelId: c.connectedPanelId,
                    phase: c.phase,
                    voltage: c.voltage,
                    kva: c.kva,
                    loadType: c.loadType,
                    breakerType: c.breakerType,
                    p: c.p,
                    af: c.af,
                    at: c.at,
                    phaseLine: c.phaseLine,
                    demandFactor: c.demandFactor,
                    pf: c.pf,
                    eff: c.eff,
                    bankMainType: c.bankMainType,
                    bankMainP: c.bankMainP,
                    bankMainAF: c.bankMainAF,
                    bankMainAT: c.bankMainAT,
                    isFire: c.isFire,
                    isBlackout: c.isBlackout,
                    childPhaseTotals: c.childPhaseTotals
                }));
                newLoads.splice(targetIdx, 0, ...rowsToAdd);
            }

            // [Recursive Sync] 손자 패널 로드 보강
            if (circuits.length > 0) {
                const subIds = circuits.map(c => c.connectedPanelId).filter(Boolean);
                for (const sid of subIds) {
                    if (!panelsData[sid]) await loadPanel(sid, true);
                }
            }

            isLocalChangeRef.current = true;
            setPowerLoads(newLoads);
            savePanel(panelId);
            markAsDirty(panelId);

            // [CONNECTION SYNC] Bank 선택 시 즉시 flush
            requestAnimationFrame(() => {
                const payload = getFlushPayload?.();
                if (payload) flushConnectionsNow(payload.draftSaveFn, payload.connections);
            });
        } catch (e) {
            console.error('Failed to handle bank selection:', e);
        }
    }, [panelId, powerLoads, extractCircuitsFromPanelData, loadPanel, savePanel]);

    /**
     * [NEW] Background Sync logic for Bank rows
     */
    useEffect(() => {
        if (!isDataLoaded || powerLoads.length === 0) return;

        let hasUpdates = false;
        const newLoads = [...powerLoads];

        // Group rows by bankId to optimize lookups
        const bankGroups = new Map();
        powerLoads.forEach((l, idx) => {
            if (l.bankId) {
                if (!bankGroups.has(l.bankId)) bankGroups.set(l.bankId, []);
                bankGroups.get(l.bankId).push({ load: l, index: idx });
            }
        });

        bankGroups.forEach((rows, bankId) => {
            if (bankId === panelId) return; // Prevent self-sync loop
            const bankData = panelsData[bankId];
            if (!bankData) return; // Panel not loaded in store yet

            const sourceCircuits = extractCircuitsFromPanelData(bankId, bankData);
            const sourceMap = new Map(sourceCircuits.map(sc => [sc.sourceCircuitId, sc]));

            // Check for updates or deletions
            rows.forEach(({ load, index }) => {
                const sc = sourceMap.get(load.sourceCircuitId);
                if (sc) {
                    // Update existing row
                    // Use String conversion for robust comparison (prevent 10 !== "10.00" loops)
                    const fieldsChanged =
                        String(load.kva) !== String(sc.kva) ||
                        String(load.pf) !== String(sc.pf) ||
                        String(load.eff) !== String(sc.eff) ||
                        String(load.phase) !== String(sc.phase) ||
                        String(load.voltage) !== String(sc.voltage) ||
                        String(load.circuit) !== String(sc.circuitNo) ||
                        String(load.equipmentName) !== String(sc.equipmentName) ||
                        String(load.loadType) !== String(sc.loadType) ||
                        String(load.breakerType) !== String(sc.breakerType) ||
                        String(load.p) !== String(sc.p) ||
                        String(load.af) !== String(sc.af) ||
                        String(load.at) !== String(sc.at) ||
                        String(load.bankName) !== String(sc.bankName) ||
                        String(load.bankLocation) !== String(sc.bankLocation) ||
                        String(load.bankMainType) !== String(sc.bankMainType) ||
                        String(load.bankMainP) !== String(sc.bankMainP) ||
                        String(load.bankMainAF) !== String(sc.bankMainAF) ||
                        String(load.bankMainAT) !== String(sc.bankMainAT) ||
                        String(load.phaseLine) !== String(sc.phaseLine) ||
                        JSON.stringify(load.childPhaseTotals) !== JSON.stringify(sc.childPhaseTotals);

                    if (fieldsChanged) {
                        newLoads[index] = {
                            ...load,
                            kva: sc.kva,
                            pf: sc.pf,
                            eff: sc.eff,
                            phase: sc.phase,
                            voltage: sc.voltage,
                            circuit: sc.circuitNo,
                            equipmentName: sc.equipmentName,
                            loadType: sc.loadType,
                            breakerType: sc.breakerType,
                            p: sc.p,
                            af: sc.af,
                            at: sc.at,
                            phaseLine: sc.phaseLine,
                            connectedPanelId: sc.connectedPanelId,
                            bankName: sc.bankName,
                            bankLocation: sc.bankLocation,
                            bankMainType: sc.bankMainType,
                            bankMainP: sc.bankMainP,
                            bankMainAF: sc.bankMainAF,
                            bankMainAT: sc.bankMainAT,
                            childPhaseTotals: sc.childPhaseTotals
                        };
                        hasUpdates = true;
                    }
                    sourceMap.delete(load.sourceCircuitId); // Mark as processed
                } else {
                    // Row's source was deleted in parent
                    newLoads[index] = { ...load, _deleted: true };
                    hasUpdates = true;
                }
            });

            // Handle new circuits added to parent
            if (sourceMap.size > 0) {
                const insertIdx = rows.length > 0 ? rows[rows.length - 1].index : -1;
                const rowsToAdd = Array.from(sourceMap.values()).map((sc, i) => ({
                    ...rows[0].load,
                    id: `${Date.now()}-sync-${i}-${Math.random().toString(36).slice(2, 5)}`,
                    bankId: sc.bankId,
                    bankName: sc.bankName,
                    sourceCircuitId: sc.sourceCircuitId,
                    circuit: sc.circuitNo,
                    equipmentName: sc.equipmentName,
                    connectedPanelId: sc.connectedPanelId,
                    phase: sc.phase,
                    voltage: sc.voltage,
                    kva: sc.kva,
                    demandFactor: sc.demandFactor,
                    pf: sc.pf,
                    eff: sc.eff,
                    bankMainType: sc.bankMainType,
                    bankMainP: sc.bankMainP,
                    bankMainAF: sc.bankMainAF,
                    bankMainAT: sc.bankMainAT,
                    loadType: sc.loadType,
                    breakerType: sc.breakerType,
                    p: sc.p,
                    af: sc.af,
                    at: sc.at,
                    childPhaseTotals: sc.childPhaseTotals
                }));

                if (insertIdx !== -1) {
                    newLoads.splice(insertIdx + 1, 0, ...rowsToAdd);
                } else {
                    newLoads.push(...rowsToAdd);
                }
                hasUpdates = true;
            }
        });

        if (hasUpdates) {
            console.log(`[UPS] Passive Sync: Updates detected in bank circuits`);
            const sanitizedLoads = newLoads.filter(l => !l._deleted);
            
            // Deep check to prevent loop
            if (JSON.stringify(sanitizedLoads) !== JSON.stringify(powerLoads)) {
                isLocalChangeRef.current = true;
                setPowerLoads(sanitizedLoads);
            }
        }
    }, [panelsData, results, isDataLoaded, panelId, powerLoads, kecSettings, extractCircuitsFromPanelData]);

    // --- Core Logic: Calculated Loads (UI Only) ---
    const calculatedLoads = useMemo(() => {
        return powerLoads.map(load => {
            const currentLoad = { ...load };

            // Single Panel Sync (Non-expanded case legacy support)
            if (currentLoad.connectedPanelId && !currentLoad.sourceCircuitId) {
                const subPanel = panelsData[currentLoad.connectedPanelId];
                const subResult = results[currentLoad.connectedPanelId];

                if (subPanel?.projectInfo) {
                    currentLoad.circuit = subPanel.name || currentLoad.circuit;
                    currentLoad.phase = subPanel.projectInfo.phase || currentLoad.phase;
                    currentLoad.voltage = `${getVoltageByPhase(currentLoad.phase)}V`;
                }
                const finalVA = subResult?.totalLoad ?? subPanel?.projectInfo?.cachedTotalLoad ?? calculatePanelTotalLoad(subPanel) ?? 0;
                currentLoad.kva = (finalVA / 1000).toFixed(2);
            }

            // [Hierarchical Reactive Lookup] Sync Main Breaker Info from connected bank (UI Only)
            if (currentLoad.bankId) {
                const bankPanel = panelsData[currentLoad.bankId];
                if (bankPanel?.projectInfo) {
                    const info = bankPanel.projectInfo;
                    currentLoad.bankMainType = info.mainBreakerType || 'MCCB';
                    currentLoad.bankMainAF = info.mccbAF || '';
                    currentLoad.bankMainAT = info.mccbAT || '';
                    currentLoad.bankMainP = getPolesByPhase(info.phase);
                    currentLoad.bankLocation = info.location || '';
                    currentLoad.bankName = bankPanel.name || info.panelName || '';
                } else {
                    // Fallback: If not loaded yet, use last known values or defaults
                    currentLoad.bankMainType = currentLoad.bankMainType || 'MCCB';
                    currentLoad.bankMainAF = currentLoad.bankMainAF || '';
                    currentLoad.bankMainAT = currentLoad.bankMainAT || '';
                }
            }

            // [NEW] Reactive Sync for Expanded Bank Circuits (UI Only)
            // This ensures immediate UI update when sub-panels are edited in other tabs
            if (currentLoad.bankId && currentLoad.sourceCircuitId && panelsData[currentLoad.bankId]) {
                const bankData = panelsData[currentLoad.bankId];
                const scs = extractCircuitsFromPanelData(currentLoad.bankId, bankData, kecSettings);
                const sc = scs.find(s => s.sourceCircuitId === currentLoad.sourceCircuitId);
                
                if (sc) {
                    // [SoT Sync] 회로 번호(이름)도 실시간 조회 적용
                    currentLoad.circuit = sc.connectedPanelId ? `"${getNameById(sc.connectedPanelId)}"` : sc.circuitNo;
                    // [SoT Sync] 실시간 이름 조회 적용 (UI Only) - sc.equipmentName은 이미 extractCircuitsFromPanelData에서 정밀화됨
                    currentLoad.equipmentName = sc.connectedPanelId ? `"${getNameById(sc.connectedPanelId)}"` : sc.equipmentName;
                    currentLoad.loadType = sc.loadType; // [NEW] 종류(loadType)도 실시간 동기화 보장
                    currentLoad.bankName = getNameById(sc.bankId); // Bank 이름도 실시간 조회
                    currentLoad.bankLocation = sc.bankLocation; // [NEW] 실시간 위치 조회
                    currentLoad.kva = sc.kva;
                    currentLoad.phase = sc.phase;
                    currentLoad.voltage = sc.voltage;
                    currentLoad.pf = sc.pf;
                    currentLoad.eff = sc.eff;
                    currentLoad.breakerType = sc.breakerType;
                    currentLoad.p = sc.p;
                    currentLoad.af = sc.af;
                    currentLoad.at = sc.at;
                    currentLoad.phaseLine = sc.phaseLine;
                    currentLoad.childPhaseTotals = sc.childPhaseTotals;
                }
            }

            // Calculation Logic
            const kvaNum = parseFloat(currentLoad.kva) || 0;
            const pfNum = parseFloat(currentLoad.pf) || 1.0;
            const dfNum = parseFloat(currentLoad.demandFactor) || 100;

            currentLoad.kw = (kvaNum * pfNum).toFixed(2);
            currentLoad.demandKva = (kvaNum * (dfNum / 100)).toFixed(2);
            currentLoad.demandKw = (parseFloat(currentLoad.kw) * (dfNum / 100)).toFixed(2);

            return currentLoad;
        });
    }, [powerLoads, panelsData, results, kecSettings, getNameById, extractCircuitsFromPanelData]); // getNameById 추가하여 이름 변경 시 UI 즉시 갱신

    // --- Derived Stats for Summary ---
    const totalLoad = useMemo(() => calculatedLoads.reduce((sum, l) => sum + (parseFloat(l.kva) || 0), 0), [calculatedLoads]);
    
    // [NEW] Phase-Aware Aggregation Engine
    const phaseTotals = useMemo(() => {
        let l1 = 0, l2 = 0, l3 = 0;
        
        calculatedLoads.forEach(load => {
            const kva = parseFloat(load.kva) || 0;
            const poles = parseInt(load.p) || 3;
            const pl = load.phaseLine || 'L1';
            
            if (poles <= 2) {
                // [CONCENTRATION] 단상 연결 시 자식의 모든 부하를 지정된 상으로 집약
                let totalChildKva = kva;
                if (load.childPhaseTotals) {
                    totalChildKva = (load.childPhaseTotals.l1 || 0) + (load.childPhaseTotals.l2 || 0) + (load.childPhaseTotals.l3 || 0);
                }
                
                if (pl === 'L1') l1 += totalChildKva;
                else if (pl === 'L2') l2 += totalChildKva;
                else if (pl === 'L3') l3 += totalChildKva;
            } else {
                // [DIRECT MAPPING] 3상 연결 시 자식의 상분포를 그대로 흡수하거나 1/3 분산
                if (load.childPhaseTotals) {
                    l1 += load.childPhaseTotals.l1 || 0;
                    l2 += load.childPhaseTotals.l2 || 0;
                    l3 += load.childPhaseTotals.l3 || 0;
                } else {
                    const share = Math.round((kva / 3) * 10000) / 10000;
                    l1 += share;
                    l2 += share;
                    l3 += Math.round((kva - (share * 2)) * 10000) / 10000;
                }
            }
        });

        const totalKva = l1 + l2 + l3;
        const isSinglePhase = (projectInfo.phase || '').includes('1Ø') || (projectInfo.phase || '').includes('1Φ');
        const voltageFactor = isSinglePhase ? 0.22 : (Math.sqrt(3) * 0.38);
        const totalI = totalKva > 0 ? (totalKva / voltageFactor) : 0;

        // Round to 4 decimal places for broadcast stability
        return {
            l1: Math.round(l1 * 10000) / 10000,
            l2: Math.round(l2 * 10000) / 10000,
            l3: Math.round(l3 * 10000) / 10000,
            i1: totalKva > 0 ? Number((totalI * (l1 / totalKva) * (isSinglePhase ? 1 : 3)).toFixed(2)) : 0,
            i2: totalKva > 0 ? Number((totalI * (l2 / totalKva) * (isSinglePhase ? 1 : 3)).toFixed(2)) : 0,
            i3: totalKva > 0 ? Number((totalI * (l3 / totalKva) * (isSinglePhase ? 1 : 3)).toFixed(2)) : 0
        };
    }, [calculatedLoads, projectInfo.phase]);

    const demandFactorSummary = useMemo(() => {
        const totalKva = calculatedLoads.reduce((sum, l) => sum + (parseFloat(l.demandKva) || 0), 0);
        const totalKw = calculatedLoads.reduce((sum, l) => sum + (parseFloat(l.demandKw) || 0), 0);
        const avgPercent = totalLoad > 0 ? (totalKva / totalLoad) * 100 : 100;
        return { avgPercent, totalKva, totalKw };
    }, [calculatedLoads, totalLoad]);

    const PHASE_LEVELS = useMemo(() => ({
        '1Φ2W': 1, '1Φ-2W': 1, '1Ø-2W': 1,
        '3Φ3W': 2, '3Φ-3W': 2, '3Ø-3W': 2,
        '3Φ4W': 3, '3Φ-4W': 3, '3Ø-4W': 3,
        '2': 1, '3': 2, '4': 3
    }), []);

    const maxLoadLevel = useMemo(() => {
        if (!calculatedLoads || calculatedLoads.length === 0) return 0;
        return Math.max(...calculatedLoads.map(l => 
            Math.max(
                PHASE_LEVELS[l.phase] || PHASE_LEVELS[String(l.p)] || 1,
                PHASE_LEVELS[String(l.bankMainP)] || 1
            )
        ));
    }, [calculatedLoads, PHASE_LEVELS]);

    const isMainPhaseInvalid = useMemo(() => (PHASE_LEVELS[projectInfo.phase] || 3) < maxLoadLevel, [projectInfo.phase, maxLoadLevel, PHASE_LEVELS]);
    
    // [SAFETY] AT violation check (Branch AT >= Bank Main AT for UPS)
    const { isATViolation: safetyWarning } = useSafetyCheck('ups', powerLoads, projectInfo, panelsData);

    // --- persistence & change Handlers ---
    const hasDecideWarning = useMemo(() => {
        if (!projectInfo) return false;

        // [SAFETY] Check for AT violations (Branch AT >= Main AT)
        if (safetyWarning) return true;

        const isCableMethodValid = (info) => {
            if (!info || !info.kecMethod || !info.cableSize) return true;
            const baseMethod = info.kecMethod.split(/x|X/)[0];
            const isParallel = info.kecMethod.toUpperCase().includes('X');
            if (info.wire === 'HFIX') return isParallel ? false : ['A1', 'B1', 'D'].includes(baseMethod);
            if (info.wire !== 'FCV' && info.wire !== 'FR8') return true;
            return Number(info.cableSize) >= (kecSettings?.cableCondition?.area || 50) ?
                ['A1', 'B1', 'D', 'F'].includes(baseMethod) :
                ['A2', 'B2', 'D', 'E'].includes(baseMethod);
        };
        if (!isCableMethodValid(projectInfo)) return true;
        const getP = (ph) => ph?.includes('1Ø') ? 2 : ph?.includes('3Ø-3W') ? 3 : 4;
        const p = getP(projectInfo.phase), ib = p === 2 ? (totalLoad * 1000) / 220 : (totalLoad * 1000) / (380 * Math.sqrt(3));
        const judgment = calculateKECJudgment({
            ib,
            at: projectInfo.mccbAT || 0,
            af: projectInfo.mccbAF || 0,
            type: projectInfo.mainBreakerType || 'MCCB',
            size: projectInfo.cableSize || 0,
            wire: projectInfo.wire || 'FCV',
            method: projectInfo.kecMethod || 'E',
            p,
            cableDistance: projectInfo.branchDistance || 1.5,
                            scb: projectInfo.shortCircuitCurrent || 0,
            isGeneral: true
        }, kecSettings, projectInfo);
        if (!judgment) return false;
        const isFail = (status) => status === 'Fail' || status === 'Error' || status === 'Chk';
        return isFail(judgment.at_b?.status) || isFail(judgment.at_th?.status) || isFail(judgment.at_sc?.status) ||
            isFail(judgment.sb?.status) || isFail(judgment.scb?.status) || isFail(judgment.se?.status) || isFail(judgment.ssc?.status);
    }, [projectInfo, totalLoad, kecSettings, safetyWarning]);
    

    useEffect(() => {
        if (!lookupLoaded || !isDataLoaded || !panelId) return;

        // [ANTI-LOOP] 로컬 변경 중(isLocalChangeRef)이고 사용자가 직접 소스를 수정한 상황(lastSourceChangeRef)이 아니라면, 
        // 외부(getParentId) 데이터에 의한 자동 수정을 건너뜁니다.
        // 이는 서버 데이터가 아직 업데이트되지 않아(Debounce) 발생하는 역방향 동기화 루프를 방지합니다.
        if (isLocalChangeRef.current && !lastSourceChangeRef.current) return;
        
        const actualParentId = getParentId(panelId);
        const currentFromId = projectInfo.fromId;
        
        const sActual = actualParentId ? String(actualParentId) : null;
        const sCurrent = currentFromId ? String(currentFromId) : null;

        if (sActual && sCurrent !== sActual) {
            updateProjectInfo('fromId', actualParentId);
            markAsDirty(panelId);
            if (lastSourceChangeRef.current) { 
                showToast(`SOURCE Updated: ${getNameById(actualParentId)}`); 
                lastSourceChangeRef.current = false; 
            }
        } else if (!sActual && sCurrent) {
            // 부모가 없는데 로컬에 설정된 경우 (해제됨)
            if (lastSourceChangeRef.current) { 
                showToast("해당 연결은 유효하지 않습니다", "error"); 
                lastSourceChangeRef.current = false; 
            }
            updateProjectInfo('fromId', null);
            markAsDirty(panelId);
        } else if (lastSourceChangeRef.current && sCurrent === sActual) {
            if (sCurrent) showToast(`SOURCE Updated: ${getNameById(currentFromId)}`);
            lastSourceChangeRef.current = false;
        }
    }, [lookupLoaded, isDataLoaded, panelId, getParentId, projectInfo.fromId, updateProjectInfo, showToast, getNameById]);

    const updatePowerLoad = useCallback((id, key, value) => {
        isLocalChangeRef.current = true;
        
        if (key === 'bankName' && typeof value === 'string') {
            const matchedId = nameToId[value];
            if (matchedId) {
                const matchedPanel = allLookupPanels.find(p => p.id === matchedId);
                const isBlockedType = matchedPanel?.type === 'transformer' || matchedPanel?.type === 'ups' || matchedPanel?.type === 'receiving-capacity';

                if (!isBlockedType) {
                    handleBankSelection(id, { id: matchedId, name: value });
                    return;
                }
            }
        }

        if (key === 'bankCapacity') {
            setProjectInfo(prev => ({ ...prev, mainCapacity: value }));
            setPowerLoads(prev => prev.map(l => ({ ...l, bankCapacity: value })));
        } else {
            setPowerLoads(prev => prev.map(l => {
                if (l.id === id) {
                    if (key === 'bankName' && typeof value === 'object' && value !== null) return l;
                    return { ...l, [key]: value };
                }
                return l;
            }));
        }
        markAsDirty(panelId);
    }, [panelId, nameToId, allLookupPanels, handleBankSelection]);

    const addPowerLoad = useCallback(() => {
        isLocalChangeRef.current = true;
        const newId = String(Date.now());
        const newRow = {
            id: newId,
            bankName: '', bankId: null, sourceCircuitId: null,
            bankMainType: 'MCCB', bankMainP: '4', bankMainAF: '', bankMainAT: '',
            bankLocation: '',
            circuit: '', equipmentName: '', type: 'LOAD', phase: '3Φ4W', voltage: '380V',
            kva: '0', kw: '0', demandFactor: '100', pf: '0.9', eff: '0.95',
            breakerType: 'MCCB', p: '3', af: '', at: '',
            isFire: false, isBlackout: true, isSequential: false, connectedPanelId: null
        };
        setPowerLoads(prev => [...prev, newRow]);
        markAsDirty(panelId);
    }, [panelId]);

    // [Phase 1] Zero-Sync (Zustand Store Sync)
    useEffect(() => {
        if (!panelId || !isDataLoaded) return;

        // 즉시 상태 변경 알림 (인디케이터 초록색)
        if (isLocalChangeRef.current) {
            useDataStore.getState().setSyncStatus('local', 'saving');
        }

        // Construct stable objects for sync
        // [Phase-Aware Propagation] 상분포 정보를 고려한 데이터 규약 매칭
        const isSinglePhase = (projectInfo.phase || '').includes('1Ø') || (projectInfo.phase || '').includes('1Φ');
        const totalVA = Math.round(totalLoad * 1000 * 10000) / 10000;
        const totalI = Number((demandFactorSummary.totalKva / (isSinglePhase ? 0.22 : (Math.sqrt(3) * 0.38))).toFixed(4));
        
        let syncPhaseTotals = { l1: 0, l2: 0, l3: 0, i1: 0, i2: 0, i3: 0, totalCurrent: totalI };

        if (isSinglePhase) {
            const selPhase = projectInfo.selectedPhaseLine || 'L1';
            if (selPhase === 'L1') { syncPhaseTotals.l1 = totalVA; syncPhaseTotals.i1 = totalI; }
            else if (selPhase === 'L2') { syncPhaseTotals.l2 = totalVA; syncPhaseTotals.i2 = totalI; }
            else if (selPhase === 'L3') { syncPhaseTotals.l3 = totalVA; syncPhaseTotals.i3 = totalI; }
        } else {
            // UPS 자체의 합계 분포 (자식들의 합산 분포를 그대로 따름)
            syncPhaseTotals.l1 = Math.round(phaseTotals.l1 * 1000 * 10000) / 10000;
            syncPhaseTotals.l2 = Math.round(phaseTotals.l2 * 1000 * 10000) / 10000;
            syncPhaseTotals.l3 = Math.round(phaseTotals.l3 * 1000 * 10000) / 10000;
            
            // 전류 배분 (전류도 부하 비율에 따라 배분)
            const ratio1 = totalVA > 0 ? syncPhaseTotals.l1 / totalVA : 1/3;
            const ratio2 = totalVA > 0 ? syncPhaseTotals.l2 / totalVA : 1/3;
            const ratio3 = totalVA > 0 ? syncPhaseTotals.l3 / totalVA : 1/3;

            syncPhaseTotals.i1 = Number((totalI * ratio1 * 3).toFixed(4));
            syncPhaseTotals.i2 = Number((totalI * ratio2 * 3).toFixed(4));
            syncPhaseTotals.i3 = Number((totalI * ratio3 * 3).toFixed(4));
        }

        const syncData = { projectInfo, powerLoads };
        const syncResult = { 
            totalLoad: totalVA, 
            phaseTotals: syncPhaseTotals,
            summaryStats: demandFactorSummary,
            calculatedLoads 
        };

        const dataStr = JSON.stringify(syncData);
        const resultStr = JSON.stringify(syncResult);

        // [STRICT] Break the reactive loop by guarding with a deep comparison ref
        if (lastSyncRef.current.dataStr !== dataStr || lastSyncRef.current.resultStr !== resultStr) {
            lastSyncRef.current = { dataStr, resultStr };
            
            // [REACTIVE] Use transition for background sync to keep UI responsive
            startTransition(() => {
                syncPanel(panelId, syncData, syncResult);

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
            });

            // [MASTER GUIDE] 타 계산서(간선 등)의 즉각적 리액티브 반응을 위한 시그널 발송
            // [REMOVED] Legacy signal
            // localStorage.setItem('kelc_data_update_signal', Date.now().toString());
        }
    }, [panelId, isDataLoaded, projectInfo, powerLoads, totalLoad, demandFactorSummary, calculatedLoads, syncPanel]);

    if (!isDataLoaded || isHydrating) {
        return (
            <div className="min-h-screen bg-[#050505] text-gray-500 p-2 sm:p-4 lg:p-6 animate-pulse overflow-hidden">
                <div className="max-w-[1920px] mx-auto w-full">
                    {/* Header Info Bar Skeleton */}
                    <div className="h-[120px] bg-zinc-950/40 border border-zinc-900 mb-6 flex items-center px-6 gap-8 relative">
                        <div className="w-48 h-10 bg-zinc-900/30 rounded-sm"></div>
                        <div className="flex-1 h-8 bg-zinc-900/20 rounded-sm"></div>
                        <div className="w-64 h-10 bg-zinc-900/30 rounded-sm"></div>
                        <div className="absolute top-4 right-6 w-20 h-6 bg-zinc-900/40 rounded-full"></div>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                        {/* Table Area Skeleton */}
                        <div className="space-y-4">
                            <div className="h-12 bg-zinc-900/40 border border-zinc-900"></div>
                            <div className="space-y-2">
                                {[...Array(12)].map((_, i) => (
                                    <div key={i} className="flex gap-2">
                                        <div className="h-6 bg-zinc-900/20 rounded-sm w-12"></div>
                                        <div className="h-6 bg-zinc-900/20 rounded-sm flex-1"></div>
                                        <div className="h-6 bg-zinc-900/20 rounded-sm w-32"></div>
                                        <div className="h-6 bg-zinc-900/20 rounded-sm w-24"></div>
                                        <div className="h-6 bg-zinc-900/20 rounded-sm w-24"></div>
                                        <div className="h-6 bg-zinc-900/20 rounded-sm w-24"></div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Summary Area Skeleton */}
                        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="h-32 bg-zinc-900/30 border border-zinc-900 rounded-lg p-4">
                                <div className="w-24 h-4 bg-zinc-800/50 mb-4"></div>
                                <div className="w-full h-10 bg-zinc-800/30"></div>
                            </div>
                            <div className="h-32 bg-zinc-900/30 border border-zinc-900 rounded-lg p-4">
                                <div className="w-24 h-4 bg-zinc-800/50 mb-4"></div>
                                <div className="w-full h-10 bg-zinc-800/30"></div>
                            </div>
                            <div className="h-32 bg-zinc-900/30 border border-zinc-900 rounded-lg p-4">
                                <div className="w-24 h-4 bg-zinc-800/50 mb-4"></div>
                                <div className="w-full h-10 bg-zinc-800/30"></div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex justify-center items-center h-20 text-[10px] text-zinc-700 font-bold tracking-[0.3em] uppercase mt-10">
                        Blocking Hydration & Pre-loading Banks
                    </div>
                </div>
            </div>
        );
    }

    const panelName = getNameById(panelId, 'UPS 용량 계산서');

    return (
        <div className="bg-black text-gray-400 p-2 sm:p-4 lg:p-6 pb-10 selection:bg-blue-500/30 custom-scrollbar">
            {/* Premium Toast Notification (Matching PanelLoad) */}
            {toast.show && (
                <div className="fixed bottom-6 md:bottom-10 left-1/2 -translate-x-1/2 z-[9999] anim-toast-in">
                    <div className={`flex items-center gap-3 md:gap-4 px-4 md:px-6 py-3 md:py-4 rounded-xl md:rounded-2xl border shadow-2xl backdrop-blur-md min-w-[280px] md:min-w-[360px] max-w-[90%] ${toast.type === 'error' ? 'bg-red-950/95 border-red-500/50 text-red-100' : 'bg-lime-950/95 border-lime-500/50 text-lime-100'}`}>
                        <div className={`shrink-0 ${toast.type === 'error' ? 'text-red-500' : 'text-lime-400'}`}>
                            {toast.type === 'error' ? <AlertCircle className="w-[22px] h-[22px] md:w-[28px] md:h-[28px]" /> : <CheckCircle className="w-[22px] h-[22px] md:w-[28px] md:h-[28px]" />}
                        </div>
                        <div className="flex-1 text-[12.5px] md:text-[14.5px] font-medium tracking-wide">{toast.message}</div>
                        <button onClick={() => setToast(prev => ({ ...prev, show: false }))} className="shrink-0 p-1 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"><X className="w-4 h-4 md:w-5 md:h-5" /></button>
                    </div>
                </div>
            )}

            <div className="max-w-[1920px] mx-auto w-full flex flex-col">
                <UpsProjectInfoBar
                    projectName={projectName}
                    panelName={panelName}
                    projectInfo={projectInfo}
                    updateProjectInfo={updateProjectInfo}
                    editingPanelName={editingPanelName}
                    setEditingPanelName={setEditingPanelName}
                    handlePanelNameCommit={handlePanelNameCommit}
                    sourceDropdownRef={sourceDropdownRef}
                    showSourceDropdown={showSourceDropdown}
                    sourceSearchText={sourceSearchText}
                    setSourceSearchText={setSourceSearchText}
                    setShowSourceDropdown={setShowSourceDropdown}
                    setSourceSelectedIndex={setSourceSelectedIndex}
                    sourceSelectedIndex={sourceSelectedIndex}
                    getNameById={getNameById}
                    getParentId={getParentId}
                    panelId={panelId}
                    panels={allLookupPanels}
                    checkCircularDependency={checkCircularDependency}
                    lastSourceChangeRef={lastSourceChangeRef}
                    forceSaveRef={forceSaveRef}
                    showToast={showToast}
                    setProjectInfo={setProjectInfo}
                    isMainPhaseInvalid={isMainPhaseInvalid}
                    maxLoadLevel={maxLoadLevel}
                    PHASE_LEVELS={PHASE_LEVELS}
                />
                <UpsTable
                    calculatedLoads={calculatedLoads}
                    updatePowerLoad={updatePowerLoad}
                    addPowerLoad={addPowerLoad}
                    handleBankSelection={handleBankSelection}
                    panels={filteredPanelsForDropdown}
                    activeDropdownId={activeDropdownId}
                    onOpenDropdown={handleOpenDropdown}
                    dropdownPos={dropdownPos}
                    selectedRows={selectedRows}
                    handleContextMenu={handleContextMenu}
                    handleGroupContextMenu={handleGroupContextMenu}
                    handleRowClick={handleRowClick}
                    handleGroupClick={handleGroupClick}
                    draggedRow={draggedRow}
                    dropTarget={dropTarget}
                    handleDragStart={handleDragStart}
                    handleDragOver={handleDragOver}
                    handleDragLeave={handleDragLeave}
                    handleDrop={handleDrop}
                    handleDragEnd={handleDragEnd}
                    projectInfo={projectInfo}
                />
                <UpsLoadSummary
                    projectInfo={projectInfo}
                    totalLoad={totalLoad}
                    phaseTotals={phaseTotals}
                    demandFactorSummary={demandFactorSummary}
                    kecSettings={kecSettings}
                    calculateKECJudgment={calculateKECJudgment}
                    setPanelHighlightSection={setPanelHighlightSection}
                    setIsPanelKECDrawerOpen={setIsPanelKECDrawerOpen}
                    hasDecideWarning={hasDecideWarning}
                    updateProjectInfo={updateProjectInfo}
                    setProjectInfo={setProjectInfo}
                    maxLoadLevel={maxLoadLevel}
                    PHASE_LEVELS={PHASE_LEVELS}
                    showToast={showToast}
                />
            </div>
            <UpsContextMenu
                contextMenu={contextMenu}
                closeContextMenu={closeContextMenu}
                calculatedLoads={calculatedLoads}
                projectId={projectId}
                panels={allLookupPanels}
                navigate={navigate}
                handleInsertRow={handleInsertRow}
                handleCopy={handleCopy}
                handleCut={handleCut}
                handlePaste={handlePaste}
                handleDeleteSelected={handleDeleteSelected}
                clipboard={clipboard}
                selectedRows={selectedRows}
            />
            <UpsKECDrawer
                isOpen={isPanelKECDrawerOpen}
                onClose={() => setIsPanelKECDrawerOpen(false)}
                projectInfo={projectInfo}
                updateProjectInfo={updateProjectInfo}
                totalLoad={totalLoad * 1000}
                kecSettings={kecSettings}
                highlightSection={panelHighlightSection}
                powerLoads={powerLoads}
            />

        </div>
    );
};

export default UPS;

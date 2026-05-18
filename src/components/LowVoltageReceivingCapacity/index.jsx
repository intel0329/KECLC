import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, Plus, X, Download, AlertCircle, CheckCircle } from 'lucide-react';
import { getRemoteData, performBatchSave } from '../../services/projectService';
import projectService from '../../services/projectService';
import { usePanelLookup } from '../../hooks/usePanelLookup';
import { useConnectionSync } from '../../hooks/useConnectionSync';
import useDataStore from '../../store/useDataStore';

// UI and Sections
import { CornerBorders } from './ui/LowVoltageUI';
import ProjectInfoBar from './sections/ProjectInfoBar';
import LoadTable from './sections/LoadTable';
import Summary from './sections/Summary';
import ContextMenu from './sections/ContextMenu';
import CB_DATA from '../../data/CB.json';

const STORAGE_KEY = 'kelc_setting_data';

const LowVoltageReceivingCapacity = () => {
    const { projectId, panelId } = useParams();
    const navigate = useNavigate();

    // 1. Core State
    const [projectInfo, setProjectInfo] = useState({
        name: '',
        panelName: '',
        fromId: '',
        location: '',
        phase: '3Φ4W',
        voltage: '380/220V',
        mainCapacity: '',
        branchDistance: 30,
        wire: 'FCV',
        cableSize: '',
        kecMethod: 'E',
        sourceName: '',
        usageType: 'LV',
        contractType: '일반(갑)',
        mountType: '노출'
    });

    const [powerLoads, setPowerLoads] = useState([]);
    const [isDataLoaded, setIsDataLoaded] = useState(false);
    const isLocalChangeRef = useRef(false);
    
    // 2. Lookup and Store hooks
    const { 
        getNameById, 
        getIdByName, 
        getParentId, 
        panels: panelMetadata, // Rename to metadata to avoid confusion
        globalUsedPanelIds, 
        isLoaded: lookupLoaded 
    } = usePanelLookup(projectId);
    
    const loadPanel = useDataStore(state => state.loadPanel);
    const syncPanel = useDataStore(state => state.syncPanel);
    const setSyncStatus = useDataStore(state => state.setSyncStatus);
    const panelsData = useDataStore(state => state.panels); // Actual data store
    const results = useDataStore(state => state.results);
    const activeProjectId = useDataStore(state => state.activeProjectId);

    // [Reactive Lookup] Resolve metadata for connected panels from SSOT
    const getEffectiveLoad = useCallback((load) => {
        if (!load) return null;
        const connId = load.connectedPanelId;
        
        // [ANTI-DUPLICATION] If not connected, return as is (allow manual entry for raw loads)
        if (!connId) return load;

        // [Reactive Metadata Lookup] Get latest info from global store (panelsData)
        const childData = panelsData[connId] || {};
        const childInfo = childData.projectInfo || {};
        const childResult = results[connId] || {};

        // [Reactive Results Fallback] If results store is empty, use cached totals from projectInfo
        const childTotalLoad = childResult.totalLoad !== undefined 
            ? childResult.totalLoad 
            : (childInfo.cachedTotalLoad || 0);

        const childMaxCurrent = childResult.maxCurrent !== undefined 
            ? childResult.maxCurrent 
            : (childInfo.cachedPhaseTotals?.maxCurrent || 0);

        // [Reactive Values Injection]
        return {
            ...load,
            // 1. Basic Info
            phase: childInfo.phase || load.phase || '3Φ4W',
            voltage: childInfo.voltage || load.voltage || '380/220V',
            location: childInfo.location || load.location || '',
            
            // 2. Load Data (Convert VA to kVA)
            apparentPower: (Number(childTotalLoad) / 1000).toFixed(2),
            subPanelTotalCurrent: Number(childMaxCurrent).toFixed(2),
            demandFactor: childInfo.demandFactor || load.demandFactor || '100',
            
            // 3. Breaker Data
            subPanelBreakerType: childInfo.mainBreakerType || load.subPanelBreakerType || 'MCCB',
            cbP: (childInfo.phase ? (childInfo.phase.includes('1') ? '2' : '4') : (load.cbP || '4')).toString().replace(/[^0-9]/g, ''),
            at: childInfo.mccbAT || load.at || '',
            af: childInfo.mccbAF || load.af || '',
            shortCircuitCurrent: (() => {
                const bType = childInfo.mainBreakerType || load.subPanelBreakerType || 'MCCB';
                const bAF = childInfo.mccbAF || load.af;
                const bAT = childInfo.mccbAT || load.at;
                const voltText = String(childInfo.voltage || load.voltage || '380');
                const volt = parseInt(voltText) || 380;
                
                if (!bType || !bAF || !bAT) return load.shortCircuitCurrent || '';
                
                const match = CB_DATA.find(row => 
                    row[0] === bType && 
                    Number(row[5]) === Number(bAF) && 
                    Number(row[4]) === Number(bAT) &&
                    (volt > 300 ? Number(row[7]) >= 380 : Number(row[7]) < 300)
                );
                return match ? String(match[6]) : (load.shortCircuitCurrent || '');
            })()
        };
    }, [panelsData, results]);

    // [Phase 3] Reactive Recalculation Listener
    // 다른 패널의 데이터가 변경될 때마다 화면을 즉시 최신화합니다.
    const [, forceUpdate] = useState({});
    useEffect(() => {
        const unsub = useDataStore.subscribe((state) => {
            // [Zustand Subscribe] 스토어 상태가 변경될 때마다 테이블 동기화 유도
            forceUpdate({});
        });
        return () => unsub();
    }, []);

    // 3. Calculation Logic using Reactive Data
    const calculationResults = useMemo(() => {
        const effectiveLoads = powerLoads.map(getEffectiveLoad);
        
        const calculatedLoads = effectiveLoads.map(load => {
            const kw = Number(load.apparentPower) || 0;
            const demandFactor = (Number(load.demandFactor) || 100) / 100;
            const diversityFactor = (Number(load.diversityFactor) || 1.0);
            
            const demandLoad = kw * demandFactor;
            const compositeDemandPower = demandLoad / diversityFactor;

            return {
                ...load,
                demandLoad: demandLoad.toFixed(2),
                demandCurrent: (load.subPanelTotalCurrent * demandFactor).toFixed(2),
                compositeDemandPower: compositeDemandPower.toFixed(2),
            };
        });

        const totalLoad = effectiveLoads.reduce((sum, l) => sum + (Number(l.apparentPower) || 0), 0);
        const totalCurrentCalc = effectiveLoads.reduce((sum, l) => sum + (Number(l.subPanelTotalCurrent) || 0), 0);
        const totalDemandKva = calculatedLoads.reduce((sum, l) => sum + (Number(l.compositeDemandPower) || 0), 0);
        const totalDemandA = calculatedLoads.reduce((sum, l) => sum + (Number(l.demandCurrent) || 0), 0);

        return {
            calculatedLoads,
            totalLoad,
            totalCurrentCalc,
            demandFactorSummary: {
                totalKva: totalDemandKva,
                totalA: totalDemandA,
                avgPercent: totalLoad > 0 ? (totalDemandKva / totalLoad) * 100 : 100
            }
        };
    }, [powerLoads, getEffectiveLoad, results, panelsData]); // results, panelsData 추가하여 반응성 확보

    // [Phase 1] Zero-Sync (Zustand Store Sync)
    // Ensures the module adheres to the "Memory-First" architecture by keeping Zustand as SSOT
    useEffect(() => {
        if (!panelId || !isDataLoaded || !isLocalChangeRef.current) return;
        
        // [Standardization] Results store uses VA (Volt-Ampere) for cross-module compatibility
        const totalLoadVA = Math.round((Number(calculationResults.totalLoad) || 0) * 1000);
        
        syncPanel(panelId, { 
            projectInfo: { 
                ...projectInfo, 
                cachedTotalLoad: totalLoadVA 
            }, 
            powerLoads 
        }, { totalLoad: totalLoadVA });
    }, [panelId, isDataLoaded, projectInfo, powerLoads, calculationResults, syncPanel]);

    // 3. Handlers
    // [GLOBAL CLEANUP] 계통도 연결 해제 및 호적 정리 엔진 (Sync-Before-Broadcast)
    const disconnectPanels = useCallback(async (panelIds) => {
        if (!panelIds || panelIds.length === 0) return;
        
        try {
            const currentConnections = { ...useDataStore.getState().panelConnections };
            let changed = false;
            
            panelIds.forEach(id => {
                if (currentConnections[id]) {
                    delete currentConnections[id];
                    changed = true;
                }
            });
            
            if (changed) {
                // 1. 메모리 업데이트
                useDataStore.setState({ panelConnections: currentConnections });

                // 2. 서버 DB 선행 정리
                const remainingConnections = Object.entries(currentConnections)
                    .filter(([childId, parentId]) => parentId === panelId)
                    .map(([childId]) => ({ child_panel_id: childId }));

                await projectService.savePanelConnections(projectId, panelId, remainingConnections);

                // 3. 방송 송출
                const channel = new BroadcastChannel('KECLC_CONNECTION_SYNC');
                channel.postMessage({ type: 'CONNECTION_CHANGED', projectId });
                channel.close();
                console.log(`[Zero-Sync] LV Incoming cleaned up connections: ${panelIds.join(', ')}`);
            }
        } catch (e) {
            console.error('[Zero-Sync] LV Incoming cleanup failed:', e);
        }
    }, [projectId, panelId]);

    // [GLOBAL SYNC] 계통도 연결 추가 엔진
    const connectPanel = useCallback(async (childId) => {
        if (!childId) return;
        try {
            const currentConnections = { ...useDataStore.getState().panelConnections };
            currentConnections[childId] = panelId;
            
            // 1. 메모리 업데이트
            useDataStore.setState({ panelConnections: currentConnections });

            // 2. 서버 DB 선행 정리
            const remainingConnections = Object.entries(currentConnections)
                .filter(([cid, pid]) => pid === panelId)
                .map(([cid]) => ({ child_panel_id: cid }));

            await projectService.savePanelConnections(projectId, panelId, remainingConnections);

            // 3. 방송 송출
            const channel = new BroadcastChannel('KECLC_CONNECTION_SYNC');
            channel.postMessage({ type: 'CONNECTION_CHANGED', projectId });
            channel.close();
            console.log(`[Zero-Sync] LV Incoming connected child ${childId}`);
        } catch (e) {
            console.error('[Zero-Sync] LV Incoming connect failed:', e);
        }
    }, [projectId, panelId]);

    // [GLOBAL SYNC] 본인(수전반)의 SOURCE(부모) 연결 변경 엔진
    const updateSourceConnection = useCallback(async (parentId) => {
        try {
            const oldConnections = { ...useDataStore.getState().panelConnections };
            const oldParentId = oldConnections[panelId];
            const currentConnections = { ...oldConnections };
            
            // 1. 메모리 업데이트
            if (parentId) {
                currentConnections[panelId] = parentId;
            } else {
                delete currentConnections[panelId];
            }
            useDataStore.setState({ panelConnections: currentConnections });

            // 2. 서버 DB 선행 정리 (Sync-Before-Broadcast)
            // (1) 새로운 부모의 자식 리스트 업데이트
            if (parentId) {
                const newSiblings = Object.keys(currentConnections)
                    .filter(cid => currentConnections[cid] === parentId);
                const newPayload = newSiblings.map(cid => ({ child_panel_id: cid }));
                await projectService.savePanelConnections(projectId, parentId, newPayload);
            }

            // (2) 이전 부모의 자식 리스트에서도 나를 제거
            if (oldParentId && oldParentId !== parentId) {
                const oldSiblings = Object.keys(currentConnections)
                    .filter(cid => currentConnections[cid] === oldParentId);
                const oldPayload = oldSiblings.map(cid => ({ child_panel_id: cid }));
                await projectService.savePanelConnections(projectId, oldParentId, oldPayload);
            }

            // 3. 방송 송출
            const channel = new BroadcastChannel('KECLC_CONNECTION_SYNC');
            channel.postMessage({ type: 'CONNECTION_CHANGED', projectId });
            channel.close();
            console.log(`[Zero-Sync] LV Incoming SOURCE updated: ${oldParentId || 'NONE'} -> ${parentId || 'NONE'}`);
        } catch (e) {
            console.error('[Zero-Sync] LV Incoming source update failed:', e);
        }
    }, [projectId, panelId]);

    const updateProjectInfo = (field, value) => {
        isLocalChangeRef.current = true;
        setProjectInfo(prev => {
            const next = { ...prev, [field]: value };
            
            // [LOGIC] Phase selection dependency: 3Φ4W -> 380/220V, 1Φ2W -> 220V
            if (field === 'phase') {
                if (value === '3Φ4W') {
                    next.voltage = '380/220V';
                } else if (value === '1Φ2W') {
                    next.voltage = '220V';
                }
            }
            return next;
        });

        // [ZERO SYNC] 즉시 로컬 저장 상태 표시 (🟢)
        useDataStore.getState().setSyncStatus('local', 'saved');

        // [STRICT SYNC] SOURCE(fromId) 변경 시 Sync-Before-Broadcast 엄격 적용
        if (field === 'fromId') {
            updateSourceConnection(value);
        }
    };

    // [AUTO-SAVE] Debounced Server Sync with Payload Filtering
    const getCoreDataString = useCallback((info, loads) => {
        // [PAYLOAD FILTERING] Remove reactive fields before saving to DB
        const filteredLoads = loads.map(l => {
            if (l.connectedPanelId) {
                const { 
                    phase, voltage, apparentPower, subPanelTotalCurrent, 
                    subPanelBreakerType, cbP, at, af, shortCircuitCurrent, ...persistentData 
                } = l;
                return persistentData;
            }
            return l;
        });

        return JSON.stringify({
            projectInfo: info,
            powerLoads: filteredLoads
        });
    }, []);

    // [Connection Sync] Track child panel connections for parent-child relationship (WHM -> LP)
    const getFlushPayload = useCallback(() => {
        // [IMPORTANT] isLocalChangeRef.current check is essential to prevent infinite sync loops
        // but here we just need the latest state for the payload
        const connections = powerLoads
            .map(l => l.connectedPanelId)
            .filter(Boolean)
            .map(id => ({ child_panel_id: String(id) }));

        return {
            draftSaveFn: async () => {
                const currentData = getCoreDataString(projectInfo, powerLoads);
                const draftKey = `kelc_panel_draft_${panelId}`;
                await projectService.setRemoteData(projectId, draftKey, {
                    projectInfo,
                    powerLoads: JSON.parse(currentData).powerLoads,
                    savedAt: new Date().toISOString(),
                    isDraft: true
                });
                lastSavedDataRef.current = currentData;
            },
            connections
        };
    }, [projectId, panelId, projectInfo, powerLoads, getCoreDataString]);

    const { flushNow } = useConnectionSync(projectId, panelId, getFlushPayload);

    const addPowerLoad = () => {
        isLocalChangeRef.current = true;
        const newLoad = {
            id: `load-${Date.now()}`,
            equipmentName: '',
            location: '',
            phase: projectInfo.phase,
            voltage: projectInfo.phase === '3Φ4W' ? '380/220V' : (projectInfo.phase === '1Φ2W' ? '220V' : projectInfo.voltage),
            apparentPower: '',
            connectedPanelId: '',
            demandFactor: '100', // Default demand factor
            diversityFactor: '1.0',
            remarks: ''
        };
        setPowerLoads(prev => [...prev, newLoad]);
    };

    const updatePowerLoad = (id, field, value, panel = null) => {
        isLocalChangeRef.current = true;
        setPowerLoads(prev => {
            const next = prev.map(load => {
                if (load.id === id) {
                    const updated = { ...load, [field]: value };
                    if (panel) {
                        // [CONNECTION SYNC] 새로운 연결 수립 (Sync-Before-Broadcast)
                        connectPanel(panel.id);

                        // [ANTI-DUPLICATION] Store ONLY the ID. Metadata will be looked up reactively.
                        updated.connectedPanelId = panel.id;
                        updated.equipmentName = panel.name;
                        
                        // Clear reactive fields to ensure they don't persist
                        updated.phase = '';
                        updated.voltage = '';
                        updated.apparentPower = '';
                        updated.subPanelTotalCurrent = '';
                        updated.subPanelBreakerType = '';
                        updated.at = '';
                        updated.af = '';
                        updated.shortCircuitCurrent = '';
                    } else if (field === 'equipmentName' && !value) {
                        // [CONNECTION SYNC] 연결 해제 (Sync-Before-Broadcast)
                        if (load.connectedPanelId) {
                            disconnectPanels([load.connectedPanelId]);
                        }
                        updated.connectedPanelId = '';
                    }
                    return updated;
                }
                return load;
            });
            return next;
        });
    };

    const updatePowerLoadFields = (ids, updates) => {
        isLocalChangeRef.current = true;
        setPowerLoads(prev => prev.map(load => {
            if (ids.includes(load.id)) {
                return { ...load, ...updates };
            }
            return load;
        }));
    };

    const lastSavedDataRef = useRef('');

    useEffect(() => {
        if (!isDataLoaded || !projectId || !panelId) return;

        const sync = async () => {
            if (!isLocalChangeRef.current) return;

            const currentData = getCoreDataString(projectInfo, powerLoads);
            if (currentData === lastSavedDataRef.current) return;

            try {
                // [Sync Status] Remote sync starting (Yellow Indicator)
                setSyncStatus('remote', 'saving');
                const startTime = Date.now();

                const draftKey = `kelc_panel_draft_${panelId}`;
                await projectService.setRemoteData(projectId, draftKey, {
                    projectInfo,
                    powerLoads: JSON.parse(currentData).powerLoads,
                    savedAt: new Date().toISOString(),
                    isDraft: true
                });
                lastSavedDataRef.current = currentData;
                isLocalChangeRef.current = false;
                
                // [Sync Status] Ensure indicator stays visible for a minimum duration to avoid flickering
                const elapsed = Date.now() - startTime;
                if (elapsed < 800) {
                    await new Promise(resolve => setTimeout(resolve, 800 - elapsed));
                }

                // [Sync Status] Remote sync success (Blue Indicator)
                setSyncStatus('remote', 'saved');
                setTimeout(() => {
                    if (useDataStore.getState().syncStatus.remote === 'saved') {
                        setSyncStatus('remote', 'idle');
                    }
                }, 2000);

                // Broadcast update to other tabs (Legacy and Utility events)
                window.dispatchEvent(new CustomEvent('UPDATE_PANEL', {
                    detail: { panelId, senderId: 'LV_CAPACITY_MODULE' }
                }));
            } catch (e) {
                console.error("Auto-save failed", e);
                setSyncStatus('remote', 'error');
            }
        };

        const timer = setTimeout(sync, 2000);
        return () => clearTimeout(timer);
    }, [projectInfo, powerLoads, isDataLoaded, projectId, panelId, getCoreDataString]);

    // 6. Data Loading & Project Name Connection
    useEffect(() => {
        const fetchInitialData = async () => {
            if (!panelId) return;
            try {
                // 1. Load panel data
                const data = await loadPanel(panelId);
                
                // 2. Fetch project info directly
                const project = await projectService.getProject(projectId);
                const projectName = project ? project.name : '';

                if (data) {
                    const loadedInfo = data.projectInfo || {};
                    // [SSOT] Force the actual name from project tree metadata
                    const treePanelName = getNameById(panelId);
                    setProjectInfo(prev => ({ 
                        ...prev,
                        ...loadedInfo, 
                        name: projectName,
                        panelName: treePanelName || loadedInfo.panelName || 'LV 수전반',
                        phase: loadedInfo.phase || prev.phase,
                        voltage: loadedInfo.voltage || prev.voltage,
                        contractType: loadedInfo.contractType || prev.contractType,
                        mountType: loadedInfo.mountType || prev.mountType
                    }));
                    
                    if (data.powerLoads) {
                        setPowerLoads(data.powerLoads);
                        lastSavedDataRef.current = getCoreDataString(loadedInfo, data.powerLoads);
                    }
                } else {
                    setProjectInfo(prev => ({ 
                        ...prev, 
                        name: projectName,
                        panelName: getNameById(panelId)
                    }));
                }
                setIsDataLoaded(true);
            } catch (e) {
                console.error("Failed to load LV Receiving Capacity data", e);
            }
        };
        fetchInitialData();
    }, [panelId, loadPanel, projectId, getNameById, getCoreDataString]);

    // [NEW] Sync panel name if it changes in the project tree
    useEffect(() => {
        if (lookupLoaded && panelId) {
            const currentName = getNameById(panelId);
            if (currentName && currentName !== projectInfo.panelName) {
                setProjectInfo(prev => ({ ...prev, panelName: currentName }));
            }
        }
    }, [lookupLoaded, panelId, getNameById, projectInfo.panelName]);

    // 7. [HYDRATION] Automatically load child panels data into memory
    useEffect(() => {
        if (!isDataLoaded || !powerLoads.length) return;

        const loadChildData = async () => {
            const connectedIds = powerLoads
                .map(l => l.connectedPanelId)
                .filter(id => id && !panelsData[id]);

            if (connectedIds.length === 0) return;

            // Load sequentially or in parallel to hydrate the store
            await Promise.all(connectedIds.map(id => loadPanel(id)));
        };

        loadChildData();
    }, [powerLoads, isDataLoaded, loadPanel, panelsData]);

    // 8. UI Interaction States
    const [editingPanelName, setEditingPanelName] = useState('');
    useEffect(() => {
        if (projectInfo.panelName) setEditingPanelName(projectInfo.panelName);
    }, [projectInfo.panelName]);

    const handlePanelNameCommit = async () => {
        if (editingPanelName && editingPanelName !== projectInfo.panelName) {
            try {
                // 1. Update project structure (sidebar, header labels)
                await projectService.updatePanelName(projectId, panelId, editingPanelName);
                
                // 2. Update local state
                updateProjectInfo('panelName', editingPanelName);
                
                // 3. Notify app about name change to refresh lookup and other tabs
                window.dispatchEvent(new Event('kelc_panel_name_updated'));
            } catch (e) {
                console.error("Failed to update panel name", e);
            }
        }
    };

    const [activeDropdownId, setActiveDropdownId] = useState(null);
    const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
    const [sourceSearchText, setSourceSearchText] = useState('');
    const [showSourceDropdown, setShowSourceDropdown] = useState(false);
    const [sourceSelectedIndex, setSourceSelectedIndex] = useState(0);
    const sourceDropdownRef = useRef(null);

    const updateDropdownPosition = (element) => {
        if (!element) {
            setActiveDropdownId(null);
            return;
        }
        const rect = element.getBoundingClientRect();
        setDropdownPos({
            top: rect.bottom + window.scrollY,
            left: rect.left + window.scrollX,
            width: rect.width
        });
        setActiveDropdownId(`panel-${element.dataset.rowId}`);
    };

    // 7. Context Menu and Row Selection
    const [contextMenu, setContextMenu] = useState({ show: false, x: 0, y: 0, loadId: null });
    const [selectedRows, setSelectedRows] = useState([]);
    const [draggedRow, setDraggedRow] = useState(null);
    const [dropTarget, setDropTarget] = useState(null);
    const [clipboard, setClipboard] = useState({ loads: [], mode: null });
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

    const showToast = (message, type = 'success') => {
        if (toast.show) return;
        setToast({ show: true, message, type });
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
    };

    const handleRowClick = (id, e) => {
        e.stopPropagation(); // Background click handler에서 선택 해제되는 것 방지
        if (e.ctrlKey || e.metaKey) {
            setSelectedRows(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
        } else if (e.shiftKey && selectedRows.length > 0) {
            const allIds = powerLoads.map(l => l.id);
            const lastSelectedId = selectedRows[selectedRows.length - 1];
            const startIdx = allIds.indexOf(lastSelectedId);
            const endIdx = allIds.indexOf(id);
            
            if (startIdx !== -1 && endIdx !== -1) {
                const range = allIds.slice(Math.min(startIdx, endIdx), Math.max(startIdx, endIdx) + 1);
                setSelectedRows(prev => Array.from(new Set([...prev, ...range])));
            }
        } else {
            setSelectedRows([id]);
        }
    };

    const handleContextMenu = (e, id) => {
        e.preventDefault();
        setContextMenu({ show: true, x: e.clientX, y: e.clientY, loadId: id });
        if (!selectedRows.includes(id)) setSelectedRows([id]);
    };

    // 8. Context Menu & Clipboard Actions
    const handleInsertRow = () => {
        isLocalChangeRef.current = true;
        setPowerLoads(prev => {
            const targetIdx = prev.findIndex(l => l.id === contextMenu.loadId);
            const newLoad = {
                id: `load-${Date.now()}`,
                equipmentName: '',
                location: '',
                phase: projectInfo.phase,
                voltage: projectInfo.phase === '3Φ4W' ? '380/220V' : (projectInfo.phase === '1Φ2W' ? '220V' : projectInfo.voltage),
                apparentPower: '',
                connectedPanelId: '',
                demandFactor: '100',
                diversityFactor: '1.0',
                remarks: ''
            };
            const next = [...prev];
            if (targetIdx !== -1) {
                next.splice(targetIdx + 1, 0, newLoad);
            } else {
                next.push(newLoad);
            }
            return next;
        });
        setContextMenu(prev => ({ ...prev, show: false }));
    };

    const handleCopy = useCallback(() => {
        const loadsToCopy = powerLoads.filter(l => selectedRows.includes(l.id));
        if (loadsToCopy.length > 0) {
            setClipboard({ loads: JSON.parse(JSON.stringify(loadsToCopy)), mode: 'copy' });
            setContextMenu(prev => ({ ...prev, show: false }));
        }
    }, [powerLoads, selectedRows]);

    const handleCut = useCallback(() => {
        const loadsToCopy = powerLoads.filter(l => selectedRows.includes(l.id));
        if (loadsToCopy.length > 0) {
            setClipboard({ loads: JSON.parse(JSON.stringify(loadsToCopy)), mode: 'cut' });
            setContextMenu(prev => ({ ...prev, show: false }));
        }
    }, [powerLoads, selectedRows]);

    const handlePaste = useCallback(() => {
        if (clipboard.loads.length === 0) return;
        isLocalChangeRef.current = true;
        setPowerLoads(prev => {
            let next = [...prev];
            if (clipboard.mode === 'cut') {
                const cutIds = clipboard.loads.map(l => l.id);
                next = next.filter(l => !cutIds.includes(l.id));
            }
            
            const targetIdx = next.findIndex(l => l.id === contextMenu.loadId);
            const newLoads = clipboard.loads.map((l, i) => ({ 
                ...l, 
                id: `load-paste-${Date.now()}-${i}` 
            }));
            
            if (targetIdx !== -1) {
                next.splice(targetIdx + 1, 0, ...newLoads);
            } else {
                next.push(...newLoads);
            }
            return next;
        });
        if (clipboard.mode === 'cut') setClipboard({ loads: [], mode: null });
        setContextMenu(prev => ({ ...prev, show: false }));
    }, [clipboard, contextMenu.loadId]);

    const handleInsertPaste = useCallback(() => {
        handleInsertRow();
        setTimeout(handlePaste, 0);
    }, [handleInsertRow, handlePaste]);

    const handleDeleteSelected = () => {
        if (selectedRows.length === 0) return;

        // [ANTI-PATTERN FIX] disconnectPanels(async)를 setPowerLoads 바깥에서 먼저 처리
        const idsToDisconnect = powerLoads
            .filter(l => selectedRows.includes(l.id) && l.connectedPanelId)
            .map(l => l.connectedPanelId);
        
        if (idsToDisconnect.length > 0) {
            disconnectPanels(idsToDisconnect);
        }

        isLocalChangeRef.current = true;
        setPowerLoads(prev => prev.filter(l => !selectedRows.includes(l.id)));
        
        setSelectedRows([]);
        setContextMenu(prev => ({ ...prev, show: false }));
    };

    // 9. Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            if (e.ctrlKey || e.metaKey) {
                if (e.key.toLowerCase() === 'c') {
                    e.preventDefault();
                    handleCopy();
                } else if (e.key.toLowerCase() === 'v') {
                    e.preventDefault();
                    handlePaste();
                } else if (e.key.toLowerCase() === 'x') {
                    e.preventDefault();
                    handleCut();
                }
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectedRows.length > 0) {
                    handleDeleteSelected();
                }
            } else if (e.key === 'Escape') {
                setSelectedRows([]);
                setContextMenu(prev => ({ ...prev, show: false }));
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedRows, handleCopy, handlePaste, handleCut]);

    return (
        <div className="min-h-screen bg-black text-gray-300 p-2 sm:p-4 lg:p-6 selection:bg-lime-500/30" onClick={() => setSelectedRows([])}>
            {toast.show && (
                <div className="fixed bottom-6 md:bottom-10 left-1/2 -translate-x-1/2 z-[9999] anim-fade-in">
                    <div className={`flex items-center gap-3 md:gap-4 px-4 md:px-6 py-3 md:py-4 rounded-xl md:rounded-2xl border shadow-2xl backdrop-blur-md min-w-[280px] md:min-w-[360px] max-w-[90%] ${toast.type === 'error' ? 'bg-red-950/95 border-red-500/50 text-red-100' : 'bg-indigo-950/95 border-indigo-500/50 text-indigo-100'}`}>
                        <div className={`shrink-0 ${toast.type === 'error' ? 'text-red-500' : 'text-indigo-400'}`}>
                            {toast.type === 'error' ? <AlertCircle className="w-[22px] h-[22px] md:w-[28px] md:h-[28px]" /> : <CheckCircle className="w-[22px] h-[22px] md:w-[28px] md:h-[28px]" />}
                        </div>
                        <div className="flex-1 text-[12.5px] md:text-[14.5px] font-medium tracking-wide leading-relaxed">{toast.message}</div>
                        <button onClick={() => setToast(prev => ({ ...prev, show: false }))} className="shrink-0 p-1 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white">
                            <X className="w-4 h-4 md:w-5 md:h-5" />
                        </button>
                    </div>
                </div>
            )}
            <div className="max-w-[1920px] mx-auto w-full">

                {/* Project Info Bar */}
                <ProjectInfoBar 
                    projectInfo={projectInfo}
                    editingPanelName={editingPanelName}
                    setEditingPanelName={setEditingPanelName}
                    handlePanelNameCommit={handlePanelNameCommit}
                    sourceDropdownRef={sourceDropdownRef}
                    getParentId={getParentId}
                    panelId={panelId}
                    getNameById={getNameById}
                    showSourceDropdown={showSourceDropdown}
                    sourceSearchText={sourceSearchText}
                    setSourceSearchText={setSourceSearchText}
                    setShowSourceDropdown={setShowSourceDropdown}
                    setSourceSelectedIndex={setSourceSelectedIndex}
                    updateProjectInfo={updateProjectInfo}
                    panels={panelMetadata}
                    sourceSelectedIndex={sourceSelectedIndex}
                    showToast={showToast}
                />

                {/* Load Table */}
                <LoadTable 
                    calculatedLoads={calculationResults.calculatedLoads}
                    selectedRows={selectedRows}
                    dropTarget={dropTarget}
                    draggedRow={draggedRow}
                    handleDragStart={() => {}}
                    handleDragOver={() => {}}
                    handleDragLeave={() => {}}
                    handleDrop={() => {}}
                    handleDragEnd={() => {}}
                    handleContextMenu={handleContextMenu}
                    handleRowClick={handleRowClick}
                    projectInfo={projectInfo}
                    updatePowerLoad={updatePowerLoad}
                    updatePowerLoadFields={updatePowerLoadFields}
                    panels={panelMetadata}
                    activeDropdownId={activeDropdownId}
                    updateDropdownPosition={updateDropdownPosition}
                    dropdownPos={dropdownPos}
                    panelId={panelId}
                    globalUsedPanelIds={globalUsedPanelIds}
                    addPowerLoad={addPowerLoad}
                />

                    {/* Summary Section */}
                <Summary 
                    projectInfo={projectInfo}
                    exportToExcel={() => {}}
                    updateProjectInfo={updateProjectInfo}
                    demandFactorSummary={calculationResults.demandFactorSummary}
                    totalLoad={calculationResults.totalLoad}
                    totalCurrentCalc={calculationResults.totalCurrentCalc}
                    showExportSaveModal={false}
                    setShowExportSaveModal={() => {}}
                    performExcelExport={() => {}}
                    handleExportSaveConfirm={() => {}}
                />
            </div>

            {/* Context Menu */}
            <ContextMenu 
                contextMenu={contextMenu}
                closeContextMenu={() => setContextMenu({ ...contextMenu, show: false })}
                calculatedLoads={calculationResults.calculatedLoads}
                projectId={projectId}
                panels={panelMetadata}
                navigate={navigate}
                handleInsertRow={handleInsertRow}
                handleCopy={handleCopy}
                handleCut={handleCut}
                handlePaste={handlePaste}
                handleInsertPaste={handleInsertPaste}
                handleDeleteSelected={handleDeleteSelected}
                clipboard={clipboard}
                selectedRows={selectedRows}
            />
        </div>
    );
};

export default LowVoltageReceivingCapacity;

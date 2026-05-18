import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { X, AlertCircle, CheckCircle, ExternalLink } from 'lucide-react';
import Papa from 'papaparse';
import CB_DATA from '../../data/CB.json';
import { getProject, getRemoteData, setRemoteData, removeRemoteData, savePanelConnections, updatePanelName, performBatchSave } from '../../services/projectService';
import projectService from '../../services/projectService';
import { usePanelLookup } from '../../hooks/usePanelLookup';
import useDataStore from '../../store/useDataStore';
import { exportPowerLoadToExcel } from '../../utils/excelExport';

// Import extracted sub-sections
import ProjectInfoBar from './sections/ProjectInfoBar';
import GeneratorTable from './sections/GeneratorTable';
import LoadSummary from './sections/LoadSummary';
import GeneratorContextMenu from './sections/GeneratorContextMenu';

// Helper paths
import { getAFValue, getVoltageByPhase } from './utils/generatorHelpers';

const STORAGE_KEY = 'kelc_setting_data';

// No transformer-specific constants needed for Generator

// Custom Hook for Undo/Redo logic specific to power load arrays
function usePowerLoadHistory(initialLoads) {
    const [loadsState, setLoadsState] = useState(initialLoads);
    const historyRef = useRef([]);
    const historyIndexRef = useRef(-1);
    const isUndoRedoAction = useRef(false);

    const recordHistory = (loads) => {
        if (isUndoRedoAction.current) {
            isUndoRedoAction.current = false;
            return;
        }
        const currentState = JSON.stringify(loads);
        if (historyIndexRef.current >= 0) {
            const head = historyRef.current[historyIndexRef.current];
            if (head && head === currentState) return;
        }
        const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
        newHistory.push(currentState);
        if (newHistory.length > 5) {
            newHistory.shift();
        } else {
            historyIndexRef.current += 1;
        }
        historyRef.current = newHistory;
    };

    const undo = () => {
        if (historyIndexRef.current === historyRef.current.length - 1) {
            const tipState = historyRef.current[historyIndexRef.current];
            const currentStateStr = JSON.stringify(loadsState);
            if (!tipState || tipState !== currentStateStr) {
                historyRef.current.push(currentStateStr);
                if (historyRef.current.length > 5) historyRef.current.shift();
                else historyIndexRef.current += 1;
            }
        }
        if (historyIndexRef.current > 0) {
            isUndoRedoAction.current = true;
            historyIndexRef.current -= 1;
            const previousState = historyRef.current[historyIndexRef.current];
            setLoadsState(JSON.parse(previousState));
            return true;
        }
        return false;
    };

    const redo = () => {
        if (historyIndexRef.current < historyRef.current.length - 1) {
            isUndoRedoAction.current = true;
            historyIndexRef.current += 1;
            const nextState = historyRef.current[historyIndexRef.current];
            setLoadsState(JSON.parse(nextState));
            return true;
        }
        return false;
    };

    return { powerLoads: loadsState, setPowerLoads: setLoadsState, recordHistory, undo, redo };
}

const Generator = () => {
    const { projectId, panelId } = useParams();
    const navigate = useNavigate();

    // [Phase 1] Responsive Calculation & Hydration Gate
    const [isPending, startTransition] = React.useTransition();
    const [isHydrating, setIsHydrating] = useState(true);

    // Zustand Store
    const loadPanelStore = useDataStore(state => state.loadPanel);
    const getPanelResult = useDataStore(state => state.getPanelResult);
    const results = useDataStore(state => state.results);
    const panelsData = useDataStore(state => state.panels);
    const activeProjectId = useDataStore(state => state.activeProjectId);
    const initProject = useDataStore(state => state.initProject);
    const syncPanel = useDataStore(state => state.syncPanel);
    const TAB_ID = useDataStore(state => state.TAB_ID);

    // [Phase 1] Active Origin Tracking
    const isLocalChangeRef = useRef(false);
    const loadingPanelsRef = useRef(new Set());

    // ID-based panel lookup hook
    const { getNameById, getChildrenIds, panels, globalUsedPanelIds, idToName, isLoaded: lookupLoaded } = usePanelLookup(projectId);

    // Helpers
    const getOriginKey = (pId) => pId ? `kelc_panel_data_${pId}` : null;
    const getDraftKey = (pId) => pId ? `kelc_panel_draft_${pId}` : null;
    
    const markAsDirty = async (pId) => {
        if (!pId) return;
        const dirtyList = JSON.parse(localStorage.getItem('kelc_dirty_panels') || '[]');
        if (!dirtyList.includes(pId)) {
            dirtyList.push(pId);
            localStorage.setItem('kelc_dirty_panels', JSON.stringify(dirtyList));
            localStorage.setItem('kelc_project_is_dirty', 'true');
            // [NEW] 헤더 등에 즉시 상태 변경 알림
            window.dispatchEvent(new Event('kelc_dirty_state_changed'));
        }
    };
    const markAsClean = async (pId) => {
        if (!pId) return;
        const dirtyList = JSON.parse(localStorage.getItem('kelc_dirty_panels') || '[]');
        const newList = dirtyList.filter(id => id !== pId);
        localStorage.setItem('kelc_dirty_panels', JSON.stringify(newList));
        if (newList.length === 0) localStorage.setItem('kelc_project_is_dirty', 'false');
        // [NEW] 헤더 등에 즉시 상태 변경 알림
        window.dispatchEvent(new Event('kelc_dirty_state_changed'));
    };

    const calculateTotalLoadFromData = (data) => {
        if (!data) return 0;
        let totalVA = 0;
        if (data.leftCircuits || data.rightCircuits) {
            ['leftCircuits', 'rightCircuits'].forEach(side => {
                if (data[side]) data[side].forEach(c => {
                    if (c.power !== undefined && c.power !== "") totalVA += Number(c.power);
                    else if (c.loads) c.loads.forEach(load => totalVA += (Number(load.qty) || 0) * (Number(load.va) || 0));
                });
            });
        } else if (data.powerLoads) {
            data.powerLoads.forEach(load => {
                const kva = Number(load.kva) || (Number(load.apparentPower) || 0);
                totalVA += kva * 1000;
            });
        }
        return Math.round(totalVA);
    };

    const getCoreDataString = (info, loads) => {
        const cleanInfo = {
            name: String(info.name || ''),
            location: String(info.location || ''),
            phase: String(info.phase || ''),
            voltage: String(info.voltage || ''),
            mainBreakerType: String(info.mainBreakerType || ''),
            usageType: String(info.usageType || ''),
            installType: String(info.installType || ''),
            mainCapacity: String(info.mainCapacity || ''),
            gcpType: String(info.gcpType || '별치형'),
            wire: String(info.wire || ''),
            cableSize: String(info.cableSize || ''),
            kecMethod: String(info.kecMethod || ''),
            voltageDropLimit: String(info.voltageDropLimit || ''),
            demandFactor: String(info.demandFactor || ''),
            blackoutCapacity: String(info.blackoutCapacity || ''),
            fireCapacity: String(info.fireCapacity || ''),
            excludingMotorCapacity: String(info.excludingMotorCapacity || ''),
            generatorKFactor: String(info.generatorKFactor || '1.13'),
            primePowerKw: String(info.primePowerKw || ''),
            primePowerKva: String(info.primePowerKva || ''),
            airFlow: String(info.airFlow || ''),
            padSize: String(info.padSize || ''),
            fuelTank: String(info.fuelTank || ''),
            weight: String(info.weight || '')
        };
        const cleanLoad = (l) => ({
            id: String(l.id || ''),
            bankId: String(l.bankId || ''),
            bankName: String(l.bankName || ''),
            bankType: String(l.bankType || ''),
            bankLocation: String(l.bankLocation || ''),
            bankCapacity: String(l.bankCapacity || ''),
            circuit: String(l.circuit || ''),
            equipmentName: String(l.equipmentName || ''),
            type: String(l.type || ''),
            phase: String(l.phase || ''),
            voltage: String(l.voltage || ''),
            kva: String(l.kva || ''),
            kw: String(l.kw || ''),
            demandFactor: String(l.demandFactor || '100'),
            startingKw: String(l.startingKw || ''),
            alphaLabel: String(l.alphaLabel || ''),
            alphaValue: String(l.alphaValue || ''),
            betaLabel: String(l.betaLabel || ''),
            betaValue: String(l.betaValue || ''),
            pf: String(l.pf || '0.8'),
            eff: String(l.eff || '0.9'),
            isFire: Boolean(l.isFire),
            isBlackout: Boolean(l.isBlackout),
            isSequential: Boolean(l.isSequential),
            connectedPanelId: String(l.connectedPanelId || ''),
            chk: String(l.chk || 'Ok')
        });
        return JSON.stringify({ projectInfo: cleanInfo, powerLoads: loads.map(cleanLoad) });
    };

    // Initial States
    const [projectInfo, setProjectInfo] = useState({
        name: '', location: '', phase: '3Φ4W', voltage: '380V', mainBreakerType: 'MCCB',
        mccbAT: 400, mccbAF: 400, usageType: 'EMERGENCY', installType: 'EMERGENCY', mainCapacity: '',
        gcpType: '별치형', wire: 'FCV', cableSize: '', kecMethod: 'E', voltageDropLimit: 3, demandFactor: 100,
        blackoutCapacity: '', fireCapacity: '', excludingMotorCapacity: '', generatorKFactor: '1.13',
        primePowerKw: '', primePowerKva: '', airFlow: '', padSize: '', fuelTank: '', weight: ''
    });
    const { powerLoads, setPowerLoads, recordHistory, undo, redo } = usePowerLoadHistory([]);
    const [kecSettings, setKecSettings] = useState({
        shortCircuitSettings: { is: 10, tn: 0.1, k: 143, selectedK: { rowIdx: 0, colIdx: 0 } },
        cableCondition: { area: 50, powerFactor: 0.8, efficiency: 1.0, i2Type: 'industrial' },
        atMiMultiplierType: 'delta2'
    });
    const [mccSettings, setMccSettings] = useState({
        betaDirect1P: 6.0, betaDirect3PSmall: 9.5, betaDirect3PLarge: 8.2, betaYD: 7.2, betaReactor: 7.7,
        reactorTap: 0.65, lambdaInv: 1.2, globalK: 1.5, globalCT: 1.25, tmDOL: 2, tmYD: 6, tmReactor: 10, tmINV: 4
    });
    const [isDataLoaded, setIsDataLoaded] = useState(false);
    const [isReadyToCheck, setIsReadyToCheck] = useState(false);
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
    const [selectedRows, setSelectedRows] = useState([]);
    const [lastSelectedRow, setLastSelectedRow] = useState(null);
    const [isGroupDrag, setIsGroupDrag] = useState(false);
    const [draggedRow, setDraggedRow] = useState(null);
    const [dropTarget, setDropTarget] = useState(null);
    const [genSpecs, setGenSpecs] = useState([]);
    const [isCapacityMatched, setIsCapacityMatched] = useState(true);

    // Load Generator Specs from CSV
    useEffect(() => {
        const loadGenSpecs = async () => {
            try {
                const response = await fetch('/db/GEN.csv');
                if (!response.ok) throw new Error('Failed to fetch CSV');
                const csvData = await response.text();
                Papa.parse(csvData, {
                    complete: (results) => {
                        const rows = results.data;
                        const specRows = rows.filter(row => row.length >= 7 && !isNaN(parseFloat(row[0])));
                        setGenSpecs(specRows);
                    }
                });
            } catch (e) {
                console.error('Failed to load GEN.csv:', e);
            }
        };
        loadGenSpecs();
    }, []);

    // Load KEC Settings
    useEffect(() => {
        const loadSettings = () => {
            try {
                const defaultKey = STORAGE_KEY;
                const projectKey = projectId ? `${defaultKey}_${projectId}` : defaultKey;
                const saved = localStorage.getItem(projectKey) || localStorage.getItem(defaultKey);
                if (saved) {
                    setKecSettings(prev => ({ ...prev, ...JSON.parse(saved) }));
                }
            } catch (e) {
                console.error('Failed to load local settings:', e);
            }
        };

        const loadRemoteSettings = async () => {
            if (!projectId) return;
            try {
                const defaultKey = STORAGE_KEY;
                const projectKey = projectId ? `${defaultKey}_${projectId}` : defaultKey;
                
                let perProjectSettings = await getRemoteData(projectKey, projectId);
                if (!perProjectSettings && projectKey !== defaultKey) {
                    perProjectSettings = await getRemoteData(defaultKey, projectId);
                }

                if (perProjectSettings) {
                    setKecSettings(prev => ({ ...prev, ...perProjectSettings }));
                }
            } catch (e) { console.error('Failed to load remote KEC settings', e); }
        };

        loadSettings();
        loadRemoteSettings();

        // [REMOVED] Legacy event listeners replaced by Zustand/BroadcastChannel sync
        // window.addEventListener('kelc_settings_updated', loadSettings);
        // return () => window.removeEventListener('kelc_settings_updated', loadSettings);
    }, [projectId]);

    // Load MCC Settings for Beta Factor and related calc
    useEffect(() => {
        const applyMccData = (parsed) => {
            const sliders = parsed.independentSliders;
            if (sliders) {
                setMccSettings(prev => ({
                    ...prev,
                    betaDirect1P: Number(sliders.betaDirect1P ?? prev.betaDirect1P),
                    betaDirect3PSmall: Number(sliders.betaDirect3PSmall ?? prev.betaDirect3PSmall),
                    betaDirect3PLarge: Number(sliders.betaDirect3PLarge ?? prev.betaDirect3PLarge),
                    betaYD: Number(sliders.betaYD ?? prev.betaYD),
                    betaReactor: Number(sliders.betaReactor ?? prev.betaReactor),
                    reactorTap: Number(sliders.reactorTap ?? prev.reactorTap),
                    lambdaInv: Number(sliders.lambdaInv ?? prev.lambdaInv),
                    globalK: Number(parsed.otherSettings?.globalK ?? prev.globalK),
                    globalCT: Number(parsed.otherSettings?.globalCT ?? prev.globalCT),
                    tmDOL: Number(parsed.startTimes?.tmDOL ?? prev.tmDOL),
                    tmYD: Number(parsed.startTimes?.tmYD ?? prev.tmYD),
                    tmReactor: Number(parsed.startTimes?.tmReactor ?? prev.tmReactor),
                    tmINV: Number(parsed.startTimes?.tmINV ?? prev.tmINV)
                }));
            }
        };

        const loadMccSettings = () => {
            const defaultKey = 'kelc_mcc_settings';
            const projectKey = projectId ? `${defaultKey}_${projectId}` : defaultKey;
            const saved = localStorage.getItem(projectKey) || localStorage.getItem(defaultKey);
            if (saved) {
                try {
                    applyMccData(JSON.parse(saved));
                } catch (e) {
                    console.error("Failed to parse MCC settings", e);
                }
            }
        };

        const loadRemoteMccSettings = async () => {
            if (!projectId) return;
            try {
                const defaultKey = 'kelc_mcc_settings';
                const projectKey = projectId ? `${defaultKey}_${projectId}` : defaultKey;
                let perProjectMcc = await getRemoteData(projectKey, projectId);
                if (!perProjectMcc && projectKey !== defaultKey) {
                    perProjectMcc = await getRemoteData(defaultKey, projectId);
                }
                if (perProjectMcc) applyMccData(perProjectMcc);
            } catch (e) { console.error('Failed to load remote MCC settings', e); }
        };

        loadMccSettings();
        loadRemoteMccSettings();

        // [REMOVED] Legacy event listeners replaced by Zustand/BroadcastChannel sync
        // window.addEventListener('storage', handleUpdate);
        // window.addEventListener('kelc_mcc_settings_updated', handleUpdate);
        // return () => {
        //     window.removeEventListener('storage', handleUpdate);
        //     window.removeEventListener('kelc_mcc_settings_updated', handleUpdate);
        // };
    }, [projectId]);

    const getBetaValue = useCallback((method, phase, kva) => {
        if (!method || method === '-') return '-';
        const cleanMethod = method.toUpperCase();
        const is1P = phase?.includes('1Φ');
        const numKva = Number(kva) || 0;

        if (cleanMethod.includes('DOL') || cleanMethod.includes('직입')) {
            if (is1P) return mccSettings.betaDirect1P.toFixed(2);
            return (numKva < 37) ? mccSettings.betaDirect3PSmall.toFixed(2) : mccSettings.betaDirect3PLarge.toFixed(2);
        }
        if (cleanMethod.includes('Y-D') || cleanMethod.includes('와이델타')) return mccSettings.betaYD.toFixed(2);
        if (cleanMethod.includes('REACTOR') || cleanMethod.includes('리액터')) return mccSettings.betaReactor.toFixed(2);
        if (cleanMethod.includes('INV') || cleanMethod.includes('인버터')) return '1.00'; // Inverter beta is fixed to 1.0, multiplier moved to C column
        
        return '1.00';
    }, [mccSettings]);

    const getCValue = useCallback((method) => {
        if (!method || method === '-') return '1.00';
        const cleanMethod = method.toUpperCase();
        if (cleanMethod.includes('DOL') || cleanMethod.includes('직입')) return '1.00';
        if (cleanMethod.includes('Y-D') || cleanMethod.includes('와이델타')) return '0.33';
        if (cleanMethod.includes('REACTOR') || cleanMethod.includes('리액터')) return mccSettings.reactorTap.toFixed(2);
        if (cleanMethod.includes('INV') || cleanMethod.includes('인버터')) return mccSettings.lambdaInv.toFixed(2); // λ from MCC
        return '1.00';
    }, [mccSettings]);
    const [contextMenu, setContextMenu] = useState({ show: false, x: 0, y: 0, loadId: null });

    // [NEW] Helper to calculate starting kva fallback if result store is empty
    const calculateStartingKva = (load, mcc) => {
        const method = load.startingMethod || load.method || 'DOL';
        const phase = load.phase || '';
        const pf = Number(load.pf || load.powerFactor || 0.8);
        const eff = Number(load.eff || load.efficiency || 0.9);
        const kw = Number(load.kw || load.effectivePower) || 0;
        const kva = Number(load.kva || load.apparentPower) || (kw / (pf * eff) || 0);

        let beta = 1;
        const cleanMethod = method.toUpperCase();
        if (cleanMethod.includes('DOL') || cleanMethod.includes('직입')) {
            const is1P = phase.includes('1Φ') || phase.includes('1Ø');
            if (is1P) beta = mcc.betaDirect1P;
            else beta = (kw <= 2.2) ? mcc.betaDirect3PSmall : mcc.betaDirect3PLarge;
        } else if (cleanMethod.includes('Y-D') || cleanMethod.includes('와이델타')) {
            beta = mcc.betaYD;
        } else if (cleanMethod.includes('REACTOR') || cleanMethod.includes('리액터')) {
            beta = mcc.betaReactor;
        } else if (cleanMethod.includes('INV') || cleanMethod.includes('인버터')) {
            return (kva * mcc.lambdaInv).toFixed(2); // Already correctly using lambdaInv directly
        }

        let c = 1;
        if (cleanMethod.includes('Y-D') || cleanMethod.includes('와이델타')) c = 0.33;
        else if (cleanMethod.includes('REACTOR') || cleanMethod.includes('리액터')) c = mcc.reactorTap;

        const result = kva * beta * c;
        return result > 0 ? result.toFixed(2) : '0.00';
    };

    const [clipboard, setClipboardState] = useState(() => {
        try { const saved = localStorage.getItem('powerLoadClipboard'); return saved ? JSON.parse(saved) : { loads: [], mode: null }; }
        catch (e) { return { loads: [], mode: null }; }
    });
    const [activeDropdownId, setActiveDropdownId] = useState(null);
    const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

    const [showExportSaveModal, setShowExportSaveModal] = useState(false);
    const [otherPanels, setOtherPanels] = useState([]);

    // No transformer-specific helpers needed

    const lastSavedDataRef = useRef(null);

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

                await savePanelConnections(projectId, panelId, remainingConnections);

                // 3. 방송 송출
                const channel = new BroadcastChannel('KECLC_CONNECTION_SYNC');
                channel.postMessage({ type: 'CONNECTION_CHANGED', projectId });
                channel.close();
            }
        } catch (e) {
            console.error('[Zero-Sync] Generator cleanup failed:', e);
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

            await savePanelConnections(projectId, panelId, remainingConnections);

            // 3. 방송 송출
            const channel = new BroadcastChannel('KECLC_CONNECTION_SYNC');
            channel.postMessage({ type: 'CONNECTION_CHANGED', projectId });
            channel.close();
        } catch (e) {
            console.error('[Zero-Sync] Generator connect failed:', e);
        }
    }, [projectId, panelId]);

    // [NEW] Garbage Collection: Remove rows for deleted panels
    useEffect(() => {
        if (!lookupLoaded || !isDataLoaded || !powerLoads || powerLoads.length === 0) return;

        const filtered = powerLoads.filter(load => {
            if (load.bankId && !idToName[load.bankId]) return false;
            if (load.connectedPanelId && !idToName[load.connectedPanelId]) return false;
            return true;
        });

        if (filtered.length !== powerLoads.length) {
            console.log(`[Generator Sync] Removing ${powerLoads.length - filtered.length} dead rows.`);
            setPowerLoads(filtered);
        }
    }, [idToName, lookupLoaded, isDataLoaded, powerLoads]);
    
    // MOF / Fuse fetch logic removed (Transformer remnants)

    const showToast = (message, type = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
    };

    // Calculations
    const calculatedLoads = useMemo(() => {
        if (!powerLoads) return [];
        return powerLoads.map(load => {
            const currentLoad = { ...load };
            
            // [NEW] PF/Eff logic based on Alpha selection and manual input
            const aLabel = currentLoad.alphaLabel || '표준형';
            const pfInput = Number(currentLoad.pf);
            const effInput = Number(currentLoad.eff);
            const hasOwnValue = !isNaN(pfInput) || !isNaN(effInput);

            let pf = isNaN(pfInput) ? (aLabel === '고효율' ? 0.8 : (kecSettings.cableCondition?.powerFactor || 0.8)) : pfInput;
            let eff = isNaN(effInput) ? (aLabel === '고효율' ? 0.9 : (kecSettings.cableCondition?.efficiency || 1.0)) : effInput;

            let kvaNum = Number(currentLoad.kva) || 0;
            let kwNum = Number(currentLoad.kw) || 0;

            if (kvaNum > 0 && !currentLoad.kw) {
                kwNum = kvaNum * pf * eff;
                currentLoad.kw = kwNum.toFixed(2);
            } else if (kwNum > 0 && !currentLoad.kva) {
                kvaNum = (pf * eff > 0) ? kwNum / (pf * eff) : 0;
                currentLoad.kva = kvaNum.toFixed(2);
            } else if (kvaNum > 0 && kwNum > 0) {
                // If both exist, trust both, but kvaNum/kwNum are already set
            }

            const demandFactor = Number(currentLoad.demandFactor) || 100;
            const demandKva = (kvaNum * demandFactor) / 100;
            const demandKw = (kwNum * demandFactor) / 100;

            // [MANDATORY] Define basic flags early
            const isSpare = currentLoad.type === 'SPARE';
            const isDist = currentLoad.isDistributionLoad;

            // alphaValue logic (CALCULATE EARLY for Starting Capacity)
            let aVal = '1.38';
            if (hasOwnValue) {
                if (pf > 0 && eff > 0) { aVal = (Math.floor((1 / (pf * eff)) * 100) / 100).toFixed(2); }
            } else if (aLabel === '고효율') {
                aVal = (Math.floor((1 / (0.8 * 0.9)) * 100) / 100).toFixed(2);
            } else {
                const rPf = kecSettings.cableCondition?.powerFactor || 0.8;
                const rEff = kecSettings.cableCondition?.efficiency || 0.9;
                if (rPf > 0 && rEff > 0) { aVal = (Math.floor((1 / (rPf * rEff)) * 100) / 100).toFixed(2); }
            }

            // [NEW] Resolve calculation error: Use direct formula (kW * alpha * beta * C)
            const bLabel = (isSpare || isDist) ? '-' : (currentLoad.betaLabel || 'DOL');
            const bVal = (isSpare || isDist) ? '-' : (currentLoad.betaValue || getBetaValue(bLabel, currentLoad.phase, currentLoad.kva));
            const cVal = (isSpare || isDist) ? '-' : getCValue(bLabel);

            const isMotor = (currentLoad.type === 'MOTOR' || currentLoad.type === 'PUMP');
            let loadStartingKw = '-';
            if (isMotor && !isSpare && !isDist) {
                const alpha = parseFloat(aVal) || 1.0;
                const beta = parseFloat(bVal) || 0;
                const c = parseFloat(cVal) || 0;
                if (kwNum > 0 && beta > 0) {
                    loadStartingKw = (kwNum * alpha * beta * c).toFixed(2);
                }
            }

            currentLoad.alphaValue = aVal;
            currentLoad.hasOwnValue = hasOwnValue;

            // Fetch from connected sub-panel if applicable
            if (currentLoad.connectedPanelId) {
                const subPanel = panelsData[currentLoad.connectedPanelId], subResult = results[currentLoad.connectedPanelId];
                if (subPanel?.projectInfo) {
                    currentLoad.phase = subPanel.projectInfo.phase || currentLoad.phase;
                    currentLoad.voltage = subPanel.projectInfo.voltage || currentLoad.voltage;
                    // Sync common fields if they are missing in the row
                    if (!currentLoad.location) currentLoad.location = subPanel.projectInfo.location || '';
                    if (!currentLoad.bankType) currentLoad.bankType = subPanel.projectInfo.usageType || '';
                    if (!currentLoad.bankLocation) currentLoad.bankLocation = subPanel.projectInfo.location || '';
                }
                const finalVA = subResult?.totalLoad ?? subPanel?.projectInfo?.cachedTotalLoad ?? calculateTotalLoadFromData(subPanel) ?? 0;
                
                // Update apparent power (kVA) from sub-panel
                currentLoad.kva = (finalVA / 1000).toFixed(2);
                currentLoad.kw = (Number(currentLoad.kva) * pf).toFixed(2);
            }
            
            // [ZERO-SYNC] Reactive Name Lookup
            const reactiveBankName = currentLoad.bankId ? getNameById(currentLoad.bankId) : currentLoad.bankName;
            const reactiveEquipName = currentLoad.connectedPanelId ? getNameById(currentLoad.connectedPanelId) : currentLoad.equipmentName;

            return { 
                ...currentLoad, 
                bankName: reactiveBankName,
                equipmentName: reactiveEquipName,
                kva: isSpare ? '-' : currentLoad.kva,
                kw: (isSpare || isDist) ? '-' : (currentLoad.kw || (kvaNum * pf).toFixed(2)),
                demandFactor: isSpare ? '-' : currentLoad.demandFactor,
                demandKva: isSpare ? '-' : demandKva.toFixed(2), 
                demandKw: (isSpare || isDist) ? '-' : demandKw.toFixed(2),
                startingKw: (isSpare || isDist) ? '-' : loadStartingKw,
                alphaLabel: (isSpare || isDist) ? '-' : aLabel,
                alphaValue: (isSpare || isDist) ? '-' : aVal,
                betaLabel: (isSpare || isDist) ? '-' : bLabel,
                betaValue: (isSpare || isDist) ? '-' : bVal,
                cValue: (isSpare || isDist) ? '-' : cVal
            };
        });
    }, [powerLoads, panelsData, results, kecSettings, getBetaValue, getCValue, getNameById]);

    const totalLoad = useMemo(() => calculatedLoads.reduce((sum, l) => {
        if (l.type === 'SPARE') return sum;
        return sum + (Number(l.kva) || 0);
    }, 0), [calculatedLoads]);
    const totalCurrentCalc = useMemo(() => calculatedLoads.reduce((sum, l) => {
        if (l.type === 'SPARE') return sum;
        return sum + (Number(l.demandKva) || 0);
    }, 0), [calculatedLoads]);

    const totalGeneratorCapacity = useMemo(() => {
        if (!powerLoads) return 0;
        const uniqueBanks = Array.from(new Set(powerLoads.filter(l => l && l.bankId).map(l => l.bankId)));
        return uniqueBanks.reduce((sum, bankId) => { const firstLoadInBank = powerLoads.find(l => l.bankId === bankId); return sum + (parseFloat(firstLoadInBank?.bankCapacity) || 0); }, 0);
    }, [powerLoads]);

    const demandFactorSummary = useMemo(() => {
        const totalKva = calculatedLoads.reduce((sum, l) => sum + (Number(l.demandKva) || 0), 0);
        const totalKw = calculatedLoads.reduce((sum, l) => sum + (Number(l.demandKw) || 0), 0);
        const avgPercent = totalLoad > 0 ? (totalKva / totalLoad) * 100 : 100;
        return { avgPercent, totalKva, totalKw };
    }, [calculatedLoads, totalLoad]);

    const excludingMotorKva = useMemo(() => {
        return calculatedLoads.reduce((sum, l) => {
            // "분류"가 정전(isBlackout)이고 "종류"가 LOAD인 경우만 합산
            if (l.isBlackout && l.type === 'LOAD') {
                return sum + (parseFloat(l.kva) || 0);
            }
            return sum;
        }, 0);
    }, [calculatedLoads]);

    const calculateGeneratorSummary = (filterType) => {
        const isBlackoutScenario = filterType === 'isBlackout';

        const loads = calculatedLoads.filter(l => 
            l[filterType] && 
            l.type !== 'SPARE'
        );
        
        if (loads.length === 0) return { epValue: '0.00', totalPmResult: '0.00', plResult: '0.00', gpResult: '0.00', plAlpha: '-' };

        const motors = loads.filter(l => l.type === 'MOTOR' || l.type === 'PUMP');
        const nonMotors = loads.filter(l => l.type !== 'MOTOR' && l.type !== 'PUMP');

        // ΣP: 전동기를 제외한 부하
        // Apply demand factor ONLY in Blackout scenario. In Fire scenario, use 100%.
        const epValue = nonMotors.reduce((sum, m) => {
            const df = isBlackoutScenario ? (parseFloat(m.demandFactor || 100) / 100) : 1.0;
            return sum + (parseFloat(m.kva || 0) * df);
        }, 0);

        if (motors.length === 0) {
            const gp = epValue * parseFloat(projectInfo.generatorKFactor || 1.13);
            return {
                epValue: epValue.toFixed(2),
                totalPmResult: '0.00',
                plResult: '0.00',
                gpResult: gp.toFixed(2),
                plAlpha: '-'
            };
        }

        // 1. Find the maximum startingKw value
        const maxSKW = Math.max(...motors.map(m => parseFloat(m.startingKw) || 0));
        
        // 2. Identify all motors with this maximum value
        const maxMotors = motors.filter(m => (parseFloat(m.startingKw) || 0) === maxSKW);
        const nonMaxMotors = motors.filter(m => (parseFloat(m.startingKw) || 0) !== maxSKW);

        const maxSequentialMotors = maxMotors.filter(m => m.isSequential);

        let selectedMaxMotors = [];
        let runningMotors = [];

        if (maxSequentialMotors.length > 1) {
            const numExcluded = maxSequentialMotors.length - 1;
            const excludedMotors = maxSequentialMotors.slice(0, numExcluded);
            selectedMaxMotors = maxMotors.filter(m => !excludedMotors.some(em => em.id === m.id));
            runningMotors = [...excludedMotors, ...nonMaxMotors];
        } else {
            selectedMaxMotors = maxMotors;
            runningMotors = nonMaxMotors;
        }

        // Calculate Block 3: 기동용량 최대 전동기 (PL × α × β × C) - NO demand factor as per user request
        let plStartingResult = 0;
        selectedMaxMotors.forEach(m => {
            const kw = parseFloat(m.kw) || 0;
            const alpha = parseFloat(m.alphaValue) || 1.0;
            const beta = parseFloat(m.betaValue) || 1.0;
            const c = parseFloat(m.cValue) || 1.0;
            plStartingResult += kw * alpha * beta * c;
        });

        // Calculate Block 2: 일반 전동기 부하 합계 (ΣPm × α - PL × α)
        // Apply demand factor ONLY in Blackout scenario
        let totalPmRunningResult = 0;
        runningMotors.forEach(m => {
            const kw = parseFloat(m.kw) || 0;
            const alpha = parseFloat(m.alphaValue) || 1.0;
            const df = isBlackoutScenario ? (parseFloat(m.demandFactor || 100) / 100) : 1.0;
            totalPmRunningResult += kw * df * alpha;
        });

        // GP = [ ΣP + ( ΣPm × α - PL × α ) + ( PL × α × β × C ) ] × k
        const gpResult = (epValue + totalPmRunningResult + plStartingResult) * parseFloat(projectInfo.generatorKFactor || 1.13);

        return { 
            epValue: epValue.toFixed(2),
            totalPmResult: totalPmRunningResult.toFixed(2), 
            plResult: plStartingResult.toFixed(2), 
            gpResult: gpResult.toFixed(2),
            plAlpha: (selectedMaxMotors.length === 1) ? parseFloat(selectedMaxMotors[0].alphaValue) || 1.0 : '-'
        };
    };

    const blackoutMotorSummary = useMemo(() => calculateGeneratorSummary('isBlackout'), [calculatedLoads, projectInfo.generatorKFactor]);
    const fireMotorSummary = useMemo(() => calculateGeneratorSummary('isFire'), [calculatedLoads, projectInfo.generatorKFactor]);

    // [REMOVED] Automatic generator capacity sync was causing data loss on refresh.
    // Removed logic that forced totalGeneratorCapacity into mainCapacity.

    // [NEW] Sync excludingMotorCapacity with safety check
    useEffect(() => {
        if (!isReadyToCheck || !isDataLoaded) return;
        
        const valStr = excludingMotorKva > 0 ? excludingMotorKva.toFixed(2) : '0';
        if (valStr !== '0' && valStr !== String(projectInfo.excludingMotorCapacity)) {
            setProjectInfo(prev => ({ ...prev, excludingMotorCapacity: valStr }));
            markAsDirty(panelId);
        }
    }, [excludingMotorKva, isDataLoaded, isReadyToCheck, panelId, projectInfo.excludingMotorCapacity]);

    // usageType auto-switch logic removed (Transformer remnants)

    // [NEW] Click-Away Listener for Dropdowns
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (activeDropdownId && 
                !e.target.closest('.SearchablePanelCell-container') && 
                !e.target.closest('.dropdown-viewport')) {
                setActiveDropdownId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [activeDropdownId]);

    const mainCtValue = useMemo(() => {
        const capacity = Number(projectInfo.mainCapacity) || 0; if (capacity <= 0) return null;
        const targetCurrent = (capacity / (Math.sqrt(3) * 0.38)) * (mccSettings.globalCT || 1.25);
        const standardRatings = [5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100, 150, 200, 250, 300, 400, 500, 600, 750, 800, 1000, 1200, 1500, 2000, 2500, 3000, 4000];
        return standardRatings.find(r => r >= targetCurrent) || standardRatings[standardRatings.length - 1];
    }, [projectInfo.mainCapacity, mccSettings.globalCT]);

    const phaseTotals = useMemo(() => ({ totalCurrent: totalCurrentCalc }), [totalCurrentCalc]);
    const summaryStats = useMemo(() => ({}), []);

    // Handlers
    // [NEW] Helper to extract detailed load/circuit data from sub-panels
    const extractCircuitsFromPanelData = useCallback((panelId, panelData) => {
        if (!panelData) return [];
        let circuits = [];
        const info = panelData.projectInfo || {};
        
        if (panelData.leftCircuits || panelData.rightCircuits) {
            // Distribution Panel (Normal-Eulji)
            ['leftCircuits', 'rightCircuits'].forEach(side => {
                if (panelData[side]) {
                    panelData[side].forEach(c => {
                        // Only include non-empty circuits
                        if (c.usage || c.connectedPanelId || c.power) {
                            // Map numeric P codes (2, 3, 4) to Phase strings for Distribution Panels
                            const numericP = String(c.p || '');
                            let phase = c.phase || info.phase || '';
                            if (numericP === '2') phase = '1Φ2W';
                            else if (numericP === '3') phase = '3Φ3W';
                            else if (numericP === '4') phase = '3Φ4W';
                            
                            const derivedVolt = getVoltageByPhase(phase);
                            const finalVoltage = derivedVolt ? `${derivedVolt}V` : (c.voltage || info.voltage || '');
                            
                            const kva = (Number(c.power || 0) / 1000).toFixed(2);
                            const startingKva = kva; // For distribution, startingKva is same as kva
                            const pf = Number(c.pf || c.powerFactor || info.powerFactor || kecSettings.cableCondition?.powerFactor || 0.8);
                            const eff = Number(c.eff || c.efficiency || info.efficiency || kecSettings.cableCondition?.efficiency || 1.0);
                            
                            const sidePrefix = side === 'leftCircuits' ? 'L' : 'R';

                            // [NEW] 부하(loads) 배열에서 '부하' 명칭들 추출하여 결합
                            const loadNames = (c.loads || [])
                                .map(l => l.name || '')
                                .filter(Boolean)
                                .join(', ');

                            // 우선순위: 1. 명시적 용도(usage)가 있고 회로명(loadName)도 있는 경우
                            //         2. 연결된 하위 판넬이 있는 경우 (판넬명)
                            //         3. 부하 팝업에서 입력한 부하명칭들 (loadNames)
                            let equipmentName = '';
                            if (c.loadName && c.usage) {
                                equipmentName = c.usage;
                            } else if (c.connectedPanelId) {
                                equipmentName = getNameById(c.connectedPanelId);
                            } else {
                                equipmentName = loadNames;
                            }
                            
                            circuits.push({
                                sourceCircuitId: `${sidePrefix}-${c.id}`,
                                circuitNo: c.loadName || c.usage || c.circuitNo || c.no || '',
                                equipmentName: equipmentName,
                                type: 'LOAD', // Default to LOAD for distribution panels
                                isDistributionLoad: true,
                                connectedPanelId: c.connectedPanelId || null,
                                phase: phase,
                                voltage: finalVoltage,
                                kva: kva,
                                kw: (Number(kva) * pf * eff).toFixed(2),
                                startingKva: startingKva,
                                demandFactor: c.demandFactor || '100',
                                pf: pf.toFixed(2),
                                eff: eff.toFixed(2),
                                betaLabel: 'DOL', // Default for distribution
                                betaValue: getBetaValue('DOL', phase, kva)
                            });
                        }
                    });
                }
            });
        } else if (panelData.powerLoads) {
            // Power/MCC Panel
            panelData.powerLoads.forEach(l => {
                if (l.equipmentName) {
                    const phase = l.phase || info.phase || '';
                    const derivedVolt = getVoltageByPhase(phase);
                    const finalVoltage = derivedVolt ? `${derivedVolt}V` : (l.voltage || info.voltage || '');

                    const pf = Number(l.pf || l.powerFactor || kecSettings.cableCondition?.powerFactor || 0.8);
                    const eff = Number(l.eff || l.efficiency || kecSettings.cableCondition?.efficiency || 1.0);

                    // MCC already uses units like kVA/kW (not VA)
                    const kva = l.kva || l.apparentPower || ((Number(l.effectivePower) || 0) / (pf * eff || 0.8)).toFixed(2);
                    const kw = l.kw || l.effectivePower || (Number(kva) * pf * eff).toFixed(2);
                    const startMethod = l.startingMethod || l.method || 'DOL';
                    
                    // [NEW] Always use self-calculation for Starting kVA (Pure Fallback/Self-calculation)
                    const startingKva = calculateStartingKva(l, mccSettings);

                    circuits.push({
                        sourceCircuitId: l.id,
                        circuitNo: l.circuitNo || l.circuit || '',
                        equipmentName: l.equipmentName,
                        type: l.type || '',
                        connectedPanelId: l.connectedPanelId || null,
                        phase: phase,
                        voltage: finalVoltage,
                        kva: Number(kva).toFixed(2),
                        kw: Number(kw).toFixed(2),
                        startingKva: startingKva,
                        demandFactor: l.demandFactor || '100',
                        pf: pf.toFixed(2),
                        eff: eff.toFixed(2),
                        betaLabel: startMethod || 'DOL',
                        betaValue: getBetaValue(startMethod || 'DOL', phase, kva)
                    });
                }
            });
        }
        return circuits;
    }, [getNameById, getBetaValue, kecSettings, mccSettings]);

    const fetchAndApplyPanelData = async (loadId, selectedPanel) => {
        try {
            let data = await loadPanelStore(selectedPanel.id), panelIdToFetchResult = selectedPanel.id;
            if ((!data || !data.projectInfo) && selectedPanel.children && selectedPanel.children.length > 0) {
                const firstChild = selectedPanel.children[0];
                data = await loadPanelStore(firstChild.id);
                panelIdToFetchResult = firstChild.id;
            }
            if (!data) return;
            const result = getPanelResult(panelIdToFetchResult), realTimeLoad = result?.totalLoad, cachedLoad = data?.projectInfo?.cachedTotalLoad, manualCalculatedLoad = calculateTotalLoadFromData(data);
            const finalVA = (realTimeLoad !== undefined && realTimeLoad !== null) ? realTimeLoad : (cachedLoad !== undefined && cachedLoad !== null) ? cachedLoad : manualCalculatedLoad;
            const totalLoadKVA = (Number(finalVA) / 1000).toFixed(2);
            const phase = data.projectInfo?.phase || '3Ø-4W', voltage = data.projectInfo?.voltage || (phase.includes('1Ø') ? '220V' : '380V');
            const getP = (ph) => {
                const cp = String(ph || '').replace(/[-\s]/g, '').replace(/Ø/g, 'Φ').toUpperCase();
                return cp.includes('1Φ') ? 2 : cp.includes('3Φ3W') ? 3 : 4;
            };
            setPowerLoads(current => current.map(load => (loadId ? (load.id === loadId) : (load.connectedPanelId === panelIdToFetchResult)) ? {
                ...load,
                connectedPanelId: panelIdToFetchResult,
                phase,
                voltage,
                location: data.projectInfo?.location || '',
                bankType: data.projectInfo?.usageType || '',
                bankLocation: data.projectInfo?.location || '',
                apparentPower: totalLoadKVA,
                cbP: String(getP(phase)),
                cbType: data.projectInfo?.mainBreakerType || 'MCCB',
                at: data.projectInfo?.mccbAT || '',
                shortCircuitCurrent: data.projectInfo?.shortCircuitCurrent || ''
            } : load));
        } catch (e) { console.error('Failed to fetch sub-panel data:', e); }
    };

    const updateProjectInfo = (field, value) => { 
        isLocalChangeRef.current = true;
        const newInfo = { ...projectInfo, [field]: value };
        setProjectInfo(newInfo);
        
        markAsDirty(panelId); 
        
        // [ZERO SYNC] 즉시 로컬 저장 상태 표시 (🟢)
        useDataStore.getState().setSyncStatus('local', 'saved');

        // [OPTIMISTIC SOURCE UPDATE] 
        if (field === 'fromId') {
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
    };
    
    const updatePowerLoad = (id, field, value, selectedPanel = null) => {
        isLocalChangeRef.current = true;
        recordHistory(powerLoads);
        
        const newLoads = powerLoads.map(load => {
            if (load.id !== id) return load;
            let updated = { ...load, [field]: value };
            
            // Sync kVA and kW if one is changed
            if (field === 'kva' && value) {
                const pf = Number(updated.pf) || 0.8;
                updated.kw = (Number(value) * pf).toFixed(2);
            } else if (field === 'kw' && value) {
                const pf = Number(updated.pf) || 0.8;
                if (pf > 0) updated.kva = (Number(value) / pf).toFixed(2);
            } else if (field === 'pf' && value) {
                const kva = Number(updated.kva) || 0;
                updated.kw = (kva * Number(value)).toFixed(2);
            }
            
            if (field === 'equipmentName' && selectedPanel) {
                updated.connectedPanelId = selectedPanel.id;
                // [CONNECTION SYNC] 새로운 연결 수립
                connectPanel(selectedPanel.id);
            } else if (field === 'equipmentName' && !value) {
                // [CONNECTION SYNC] 연결 해제
                if (load.connectedPanelId) {
                    disconnectPanels([load.connectedPanelId]);
                }
                updated.connectedPanelId = null;
                updated.phase = '';
                updated.voltage = '';
                updated.kva = '';
                updated.kw = '';
                updated.demandFactor = '100';
            }
            return updated;
        });

        setPowerLoads(newLoads);
        
        markAsDirty(panelId);
        
        if (field === 'equipmentName') {
            const panel = selectedPanel || panels.find(p => p.name === value);
            if (panel) fetchAndApplyPanelData(id, panel);
        }
    };

    const handleBankSelection = async (loadId, name, selectedPanel) => {
        isLocalChangeRef.current = true;
        if (!selectedPanel) {
            const newLoads = powerLoads.map(l => l.id === loadId ? { ...l, bankId: '', bankName: name, bankCapacity: '' } : l);
            setPowerLoads(newLoads);
            return;
        }

        try {
            const bankData = await loadPanelStore(selectedPanel.id);
            const capacity = bankData?.projectInfo?.mainCapacity || '';
            const circuits = extractCircuitsFromPanelData(selectedPanel.id, bankData);

            let newLoads;
            setPowerLoads(prev => {
                const targetIdx = prev.findIndex(l => l.id === loadId);
                if (targetIdx === -1) return prev;
                const currentLoad = prev[targetIdx];

                if (circuits.length === 0) {
                    newLoads = [...prev.slice(0, targetIdx), { ...currentLoad, bankId: selectedPanel.id, bankName: selectedPanel.name, bankCapacity: capacity, sectionName: '' }, ...prev.slice(targetIdx + 1)];
                    return newLoads;
                }

                const resultLoads = [...prev];
                const rowsToAdd = circuits.map((c, i) => ({
                    ...currentLoad,
                    id: Date.now() + Math.random() + i,
                    bankId: selectedPanel.id,
                    bankName: selectedPanel.name,
                    bankCapacity: capacity,
                    bankType: bankData?.projectInfo?.usageType || '',
                    bankLocation: bankData?.projectInfo?.location || '',
                    circuit: c.circuitNo,
                    equipmentName: c.equipmentName,
                    connectedPanelId: c.connectedPanelId,
                    sourceCircuitId: c.sourceCircuitId,
                    phase: c.phase,
                    voltage: c.voltage,
                    kva: c.kva,
                    kw: c.kw,
                    type: c.type,
                    demandFactor: '100',
                    pf: c.pf,
                    eff: c.eff,
                    betaLabel: c.betaLabel,
                    betaValue: c.betaValue,
                    startingKva: c.startingKva,
                    isDistributionLoad: c.isDistributionLoad
                }));
                
                resultLoads.splice(targetIdx, 1, ...rowsToAdd);
                newLoads = resultLoads;
                return resultLoads;
            });

            if (newLoads) {
                markAsDirty(panelId);
            }

            // Pre-load connected grandchildren
            circuits.forEach(c => { if (c.connectedPanelId) loadPanelStore(c.connectedPanelId); });
        } catch (e) {
            console.error('Failed to load bank data:', e);
        }
    };

    // Keep Bank rows synced (Circuit-level)
    useEffect(() => {
        if (!isDataLoaded || !lookupLoaded || !panels || !powerLoads || powerLoads.length === 0) return;
        let hasUpdates = false;
        
        const bankGroups = new Map();
        powerLoads.forEach(l => { 
            if (l.bankId) { 
                if (!bankGroups.has(l.bankId)) bankGroups.set(l.bankId, []); 
                bankGroups.get(l.bankId).push(l); 
            } 
        });
        
        let newPowerLoads = [...powerLoads];
        
        bankGroups.forEach((rows, bankId) => {
            const bankData = panelsData[bankId];

            // Trigger load if panel exists but not in store (background)
            if (!bankData) {
                if (panels.some(p => p.id === bankId)) {
                    loadPanelStore(bankId);
                }
                return;
            }

            const sourceCircuits = extractCircuitsFromPanelData(bankId, bankData);
            const sourceCircuitIds = sourceCircuits.map(sc => sc.sourceCircuitId);
            
            // 1. Remove rows that no longer exist in the source panel
            const orphanedRows = rows.filter(r => r.sourceCircuitId && !sourceCircuitIds.includes(r.sourceCircuitId));
            if (orphanedRows.length > 0) {
                const orphanedIds = orphanedRows.map(or => or.id);
                newPowerLoads = newPowerLoads.filter(l => !orphanedIds.includes(l.id));
                hasUpdates = true;
            }

            // 2. Update existing rows and identify missing ones
            const currentSourceIdsInGenerator = newPowerLoads
                .filter(l => l.bankId === bankId && l.sourceCircuitId)
                .map(l => l.sourceCircuitId);
            
            const missingSourceIds = sourceCircuitIds.filter(sid => !currentSourceIdsInGenerator.includes(sid));

            // Sync values for existing rows
            const bankCapacity = bankData.projectInfo?.mainCapacity || '';
            const currentName = getNameById(bankId);
            const bankType = bankData.projectInfo?.usageType || '';
            const bankLocation = bankData.projectInfo?.location || '';

            newPowerLoads = newPowerLoads.map(row => {
                if (row.bankId !== bankId || !row.sourceCircuitId) return row;
                
                const sc = sourceCircuits.find(s => s.sourceCircuitId === row.sourceCircuitId);
                if (!sc) return row;

                // [FIX] trName (bankName)이 비어있는데 기존 row.bankName이 있다면 덮어쓰지 않음 (방어적 동기화)
                const resolvedName = currentName || row.bankName;

                // [REFINED] 실시간 동기화 감지 로직 개선
                // sc.equipmentName이 변경되면 row.equipmentName도 강제로 업데이트합니다.
                const isEquipmentNameChanged = row.equipmentName !== sc.equipmentName;

                // Check for value changes
                if (row.bankCapacity !== bankCapacity || row.bankName !== resolvedName || 
                    row.bankType !== bankType || row.bankLocation !== bankLocation ||
                    isEquipmentNameChanged || 
                    row.kva !== sc.kva || 
                    row.phase !== sc.phase || row.voltage !== sc.voltage || 
                    row.circuit !== sc.circuitNo || 
                    row.pf !== sc.pf || row.eff !== sc.eff || row.type !== sc.type ||
                    row.betaLabel !== sc.betaLabel || row.betaValue !== sc.betaValue ||
                    row.startingKva !== sc.startingKva || 
                    row.isDistributionLoad !== sc.isDistributionLoad) {
                    
                    hasUpdates = true;
                    return {
                        ...row,
                        bankCapacity, bankName: resolvedName, bankType, bankLocation,
                        equipmentName: sc.equipmentName,
                        kva: sc.kva,
                        kw: sc.kw,
                        phase: sc.phase,
                        voltage: sc.voltage,
                        circuit: sc.circuitNo,
                        pf: sc.pf,
                        eff: sc.eff,
                        type: sc.type,
                        betaLabel: sc.betaLabel,
                        betaValue: sc.betaValue,
                        startingKva: sc.startingKva,
                        isDistributionLoad: sc.isDistributionLoad
                    };
                }
                return row;
            });

            // 3. Add missing circuits
            if (missingSourceIds.length > 0) {
                hasUpdates = true;
                let insertIdx = -1;
                for (let i = newPowerLoads.length - 1; i >= 0; i--) { 
                    if (newPowerLoads[i].bankId === bankId) { insertIdx = i; break; } 
                }
                
                const baseRow = rows[0]; // Use first available row of this bank as template
                const rowsToAdd = missingSourceIds.map((sid, i) => {
                    const sc = sourceCircuits.find(s => s.sourceCircuitId === sid);
                    return { 
                        ...baseRow, 
                        id: Date.now() + Math.random() + i, 
                        sourceCircuitId: sid,
                        circuit: sc.circuitNo,
                        equipmentName: sc.equipmentName,
                        connectedPanelId: sc.connectedPanelId,
                        type: sc.type,
                        isDistributionLoad: sc.isDistributionLoad,
                        phase: sc.phase,
                        voltage: sc.voltage,
                        kva: sc.kva,
                        kw: sc.kw,
                        demandFactor: '100',
                        pf: sc.pf,
                        eff: sc.eff,
                        betaLabel: sc.betaLabel,
                        betaValue: sc.betaValue,
                        startingKva: sc.startingKva,
                        bankName: currentName || baseRow.bankName
                    };
                });
                
                if (insertIdx !== -1) newPowerLoads.splice(insertIdx + 1, 0, ...rowsToAdd); 
                else newPowerLoads.push(...rowsToAdd);
                
                missingSourceIds.forEach(sid => {
                    const sc = sourceCircuits.find(s => s.sourceCircuitId === sid);
                    if (sc.connectedPanelId) loadPanelStore(sc.connectedPanelId);
                });
            }
        });
        
        if (hasUpdates) setPowerLoads(newPowerLoads);
    }, [panelsData, isDataLoaded, lookupLoaded, extractCircuitsFromPanelData, getNameById, loadPanelStore]);

    // [Phase 3] Reactive Recalculation Listener
    // 다른 패널(을지)의 데이터가 변경될 때마다 발전기 부하 데이터를 최신화합니다.
    const [, forceUpdate] = useState({});

    useEffect(() => {
        // [Zustand Subscribe] 스토어 상태가 변경될 때마다 테이블 동기화 유도
        const unsub = useDataStore.subscribe((state) => {
            startTransition(() => {
                forceUpdate({});
            });
        });
        return () => unsub();
    }, []);

    // [Phase 1] Initialization Effect (Memory-First Hydration)
    useEffect(() => {
        const load = async () => {
            if (!projectId || !panelId) return;
            if (loadingPanelsRef.current.has(panelId)) return;
            
            setIsReadyToCheck(false);
            setIsHydrating(true);
            loadingPanelsRef.current.add(panelId);
            
            try {
                // [Tier 0] Memory-First Barrier
                const storeState = useDataStore.getState().panels[panelId];
                let finalInfo = null;
                let sanitizedLoads = null;

                if (storeState && storeState.projectInfo) {
                    console.log(`[Generator Hydration] Tier 0: Loading from Memory Store.`);
                    finalInfo = JSON.parse(JSON.stringify(storeState.projectInfo));
                    sanitizedLoads = JSON.parse(JSON.stringify(storeState.powerLoads || []));
                } else {
                    // [Tier 1] LocalStorage Cache
                    const cacheKey = `kelc_panel_cache_${panelId}`;
                    const cached = localStorage.getItem(cacheKey);
                    let cachedData = null;
                    if (cached) {
                        try { cachedData = JSON.parse(cached); } catch (e) { console.warn("Cache parse failed:", e); }
                    }

                    // [Status-Based Hydration] 로컬 캐시가 DIRTY/LOCAL_SAVED면 서버 조회 없이 신뢰
                    let data = null;
                    if (cachedData && (cachedData.status === 'DIRTY' || cachedData.status === 'LOCAL_SAVED')) {
                        console.log(`[Generator Hydration] Local-First: Trusting Local Cache (${cachedData.status})`);
                        data = cachedData;
                    } else {
                        // [Tier 2] Remote Data 조회 (Draft -> Origin)
                        const draftKey = getDraftKey(panelId);
                        const originKey = getOriginKey(panelId);
                        
                        const draftData = await getRemoteData(draftKey, projectId);
                        if (draftData) {
                            data = draftData;
                        } else {
                            const originData = await getRemoteData(originKey, projectId);
                            if (originData) {
                                data = originData;
                            } else if (cachedData) {
                                // 서버에 없고 로컬에만 데이터가 있는 경우
                                data = cachedData;
                            }
                        }
                    }
                    
                    if (!data) {
                        finalInfo = { ...projectInfo, panelName: idToName[panelId] || getNameById(panelId) || 'Generator Panel' };
                        sanitizedLoads = [];
                    } else {
                        finalInfo = { ...data.projectInfo };
                        sanitizedLoads = (data.powerLoads || []).map(l => ({
                            ...l,
                            isBlackout: l.isBlackout ?? true,
                            isFire: l.isFire ?? false,
                            isSequential: l.isSequential ?? false,
                            demandFactor: l.demandFactor || '100',
                            pf: l.pf || '0.8',
                            eff: l.eff || '0.9'
                        }));
                    }
                }

                // [Fetch Project Metadata] 프로젝트 이름 갱신
                const project = await getProject(projectId);
                if (project && finalInfo) {
                    finalInfo.name = project.name || finalInfo.name;
                    if (project.calculators) {
                        const allPanels = [];
                        const extractPanels = (items) => { if (!items) return; items.forEach(item => { if (item.id && item.name && item.id !== panelId) allPanels.push({ id: item.id, name: item.name }); if (item.children) extractPanels(item.children); }); };
                        extractPanels(project.calculators);
                        setOtherPanels(allPanels);
                    }
                }

                setProjectInfo(finalInfo);
                setPowerLoads(sanitizedLoads);
                lastSavedDataRef.current = getCoreDataString(finalInfo, sanitizedLoads);

                // [SSOT Sync] 전역 스토어 업데이트
                useDataStore.getState().updatePanelData(panelId, {
                    projectInfo: finalInfo,
                    powerLoads: sanitizedLoads
                });

                // [Phase 3] Blocking Hydration: 의존성 패널(을지) 데이터 선행 로딩
                const circuits = sanitizedLoads.filter(l => l.connectedPanelId);
                if (circuits.length > 0) {
                    await Promise.all(circuits.map(c => 
                        loadPanelStore(c.connectedPanelId).catch(err => {
                            console.warn(`Failed to load sub-panel ${c.connectedPanelId}:`, err);
                            return null;
                        })
                    ));
                }

                initProject(projectId);
                setIsDataLoaded(true);
                
                // [Gate Control] 하이드레이션 완료 후 동기화 게이트 개방
                setTimeout(() => {
                    setIsHydrating(false);
                    setIsReadyToCheck(true);
                    console.log(`[Generator Hydration] Gate Open.`);
                    loadingPanelsRef.current.delete(panelId);
                }, 500);

            } catch (e) { 
                console.error('Failed to hydrate Generator:', e); 
                setIsDataLoaded(true);
                setIsHydrating(false);
            }
        };
        load();
    }, [projectId, panelId]);

    // [Phase 1] External Sync (BroadcastChannel Support via panelsData)
    useEffect(() => {
        const storeData = panelsData[panelId];
        if (!storeData || !isDataLoaded || isLocalChangeRef.current) return;

        const storeDataString = getCoreDataString(storeData.projectInfo || {}, storeData.powerLoads || []);
        if (lastSavedDataRef.current !== storeDataString) {
            console.log(`[Generator Sync] External update received for ${panelId}`);
            if (storeData.projectInfo) setProjectInfo(prev => ({ ...prev, ...storeData.projectInfo }));
            if (storeData.powerLoads) setPowerLoads(storeData.powerLoads);
            lastSavedDataRef.current = storeDataString;
        }
    }, [panelsData, panelId, isDataLoaded]);

    // [Phase 1] Zero-Sync (Zustand Store Sync)
    useEffect(() => {
        if (!panelId || !isDataLoaded) return;
        
        // 즉시 상태 변경 알림 (인디케이터 초록색)
        if (isLocalChangeRef.current) {
            useDataStore.getState().setSyncStatus('local', 'saving');
        }

        // Zustand 스토어 및 BroadcastChannel 동기화
        syncPanel(panelId, { projectInfo, powerLoads });

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
    }, [panelId, isDataLoaded, projectInfo, powerLoads, syncPanel]);

    // [Phase 1] Auto-Save Draft (1s Debounce, Active Origin Only)
    useEffect(() => {
        if (!isDataLoaded || !isReadyToCheck || !isLocalChangeRef.current) return;

        let isActive = true;
        const timer = setTimeout(async () => {
            const currentDataString = getCoreDataString(projectInfo, powerLoads);
            if (lastSavedDataRef.current === currentDataString) {
                if (isActive) isLocalChangeRef.current = false;
                return;
            }

            try {
                useDataStore.getState().setSyncStatus('remote', 'saving');
                const startTime = Date.now();

                const draftKey = getDraftKey(panelId);
                const dataToSave = {
                    projectInfo: { ...projectInfo, cachedTotalLoad: totalLoad },
                    powerLoads,
                    savedAt: new Date().toISOString(),
                    status: 'DIRTY',
                    isDraft: true
                };

                await setRemoteData(projectId, draftKey, dataToSave);
                await savePanelConnections(projectId, panelId, []);
                
                if (!isActive) return;

                lastSavedDataRef.current = currentDataString;
                
                // 최신 데이터와 일치할 때만 로컬 변경 플래그 해제
                if (getCoreDataString(projectInfo, powerLoads) === currentDataString) {
                    isLocalChangeRef.current = false;
                }

                const elapsed = Date.now() - startTime;
                if (elapsed < 800) await new Promise(r => setTimeout(r, 800 - elapsed));

                useDataStore.getState().setSyncStatus('remote', 'saved');
                setTimeout(() => {
                    if (useDataStore.getState().syncStatus.remote === 'saved') {
                        useDataStore.getState().setSyncStatus('remote', 'idle');
                    }
                }, 2000);

                markAsDirty(panelId);
            } catch (e) {
                if (!isActive) return;
                console.error('Generator auto-save failed:', e);
                useDataStore.getState().setSyncStatus('remote', 'error');
            }
        }, 1000);

        return () => {
            isActive = false;
            clearTimeout(timer);
        };
    }, [projectInfo, powerLoads, isDataLoaded, isReadyToCheck, totalLoad]);

    // [Phase 1] Manual Save
    useEffect(() => {
        const handleTriggerSave = async (e) => {
            if (e.detail?.panelId !== panelId) return;
            try {
                useDataStore.getState().setSyncStatus('remote', 'saving');
                const originKey = getOriginKey(panelId);
                const draftKey = getDraftKey(panelId);

                const dataToSave = {
                    projectInfo: { ...projectInfo, cachedTotalLoad: totalLoad },
                    powerLoads,
                    savedAt: new Date().toISOString(),
                    status: 'SERVER_SYNCED',
                    isDraft: false
                };

                await setRemoteData(projectId, originKey, dataToSave);
                await savePanelConnections(projectId, panelId, []);
                await removeRemoteData(draftKey);
                
                lastSavedDataRef.current = getCoreDataString(projectInfo, powerLoads);
                isLocalChangeRef.current = false;
                
                markAsClean(panelId);
                useDataStore.getState().setSyncStatus('remote', 'saved');
                showToast('최종 저장되었습니다.');
                
                window.dispatchEvent(new CustomEvent('kelc_save_finished', { detail: { panelId, success: true } }));
                
                setTimeout(() => {
                    useDataStore.getState().setSyncStatus('remote', 'idle');
                }, 2000);
            } catch (e) {
                console.error('Manual save failed:', e);
                useDataStore.getState().setSyncStatus('remote', 'error');
                showToast('저장에 실패했습니다.', 'error');
                window.dispatchEvent(new CustomEvent('kelc_save_finished', { detail: { panelId, success: false } }));
            }
        };
        window.addEventListener('kelc_trigger_save', handleTriggerSave);
        return () => window.removeEventListener('kelc_trigger_save', handleTriggerSave);
    }, [projectInfo, powerLoads, totalLoad, projectId, panelId]);

    // Selection and Context Menu Logic (RE-RESTORED FROM BACKUP)
    const handleRowClick = (loadId, event) => {
        event.stopPropagation();
        if (event.shiftKey && lastSelectedRow !== null) {
            const startIdx = calculatedLoads.findIndex(l => l.id === lastSelectedRow);
            const endIdx = calculatedLoads.findIndex(l => l.id === loadId);
            if (startIdx !== -1 && endIdx !== -1) {
                const [from, to] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
                const rangeIds = calculatedLoads.slice(from, to + 1).map(l => l.id);
                setSelectedRows(prev => [...new Set([...prev, ...rangeIds])]);
            }
        } else if (event.ctrlKey || event.metaKey) {
            setSelectedRows(prev => prev.includes(loadId) ? prev.filter(id => id !== loadId) : [...prev, loadId]);
        } else {
            setSelectedRows([loadId]);
        }
        setLastSelectedRow(loadId);
    };

    const handleContextMenu = (e, loadId) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        e.preventDefault();
        if (!selectedRows.includes(loadId)) {
            setSelectedRows([loadId]);
            setLastSelectedRow(loadId);
        }
        setContextMenu({ show: true, x: e.clientX, y: e.clientY, loadId });
    };

    const handleGroupClick = (group, event) => {
        event.stopPropagation();
        const groupIds = group.loads.map(l => l.id);
        if (event.shiftKey && lastSelectedRow !== null) {
            const startIdx = calculatedLoads.findIndex(l => l.id === lastSelectedRow);
            const endIdx = calculatedLoads.findIndex(l => l.id === groupIds[0]);
            if (startIdx !== -1 && endIdx !== -1) {
                const [from, to] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
                const rangeIds = calculatedLoads.slice(from, to + 1).map(l => l.id);
                setSelectedRows(prev => [...new Set([...prev, ...rangeIds])]);
            }
        } else if (event.ctrlKey || event.metaKey) {
            const allIn = groupIds.every(id => selectedRows.includes(id));
            if (allIn) setSelectedRows(prev => prev.filter(id => !groupIds.includes(id)));
            else setSelectedRows(prev => [...new Set([...prev, ...groupIds])]);
        } else {
            setSelectedRows(groupIds);
        }
        setLastSelectedRow(groupIds[0]);
    };

    const handleGroupContextMenu = (e, group) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        e.preventDefault();
        const groupIds = group.loads.map(l => l.id);
        const someOut = groupIds.some(id => !selectedRows.includes(id));
        if (someOut) {
            setSelectedRows(groupIds);
            setLastSelectedRow(groupIds[0]);
        }
        setContextMenu({ show: true, x: e.clientX, y: e.clientY, loadId: groupIds[0] });
    };

    const closeContextMenu = () => setContextMenu({ show: false, x: 0, y: 0, loadId: null });

    const handleCopy = () => {
        const loadsToCopy = powerLoads.filter(l => selectedRows.includes(l.id));
        setClipboardState({ loads: loadsToCopy.map(l => ({ ...l })), mode: 'copy' });
        localStorage.setItem('powerLoadClipboard', JSON.stringify({ loads: loadsToCopy, mode: 'copy' }));
        closeContextMenu();
    };

    const handleCut = () => {
        isLocalChangeRef.current = true;
        recordHistory(powerLoads);
        const loadsToCut = powerLoads.filter(l => selectedRows.includes(l.id));
        // [CONNECTION SYNC] 글로벌 계통도 연결 해제
        const connectedIds = loadsToCut.map(l => l.connectedPanelId).filter(Boolean);
        disconnectPanels(connectedIds);

        setClipboardState({ loads: loadsToCut.map(l => ({ ...l })), mode: 'cut' });
        localStorage.setItem('powerLoadClipboard', JSON.stringify({ loads: loadsToCut, mode: 'cut' }));
        
        const newLoads = powerLoads.filter(l => !selectedRows.includes(l.id));
        setPowerLoads(newLoads);
        
        setSelectedRows([]);
        closeContextMenu();
    };

    const handlePaste = () => {
        if (clipboard.loads.length === 0) return;
        isLocalChangeRef.current = true;
        recordHistory(powerLoads);
        const targetIdx = contextMenu.loadId ? powerLoads.findIndex(l => l.id === contextMenu.loadId) : powerLoads.length;
        const newItems = clipboard.loads.map(l => ({ ...l, id: Date.now() + Math.random() }));
        let updatedLoads = [...powerLoads];
        for (let i = 0; i < newItems.length; i++) {
            const currentIdx = targetIdx + i;
            if (currentIdx < updatedLoads.length) {
                // [CONNECTION SYNC] 덮어쓰기 전 기존 연결 해제
                const oldRow = updatedLoads[currentIdx];
                if (oldRow.connectedPanelId && oldRow.connectedPanelId !== newItems[i].connectedPanelId) {
                    disconnectPanels([oldRow.connectedPanelId]);
                }
                updatedLoads[currentIdx] = { ...newItems[i], id: updatedLoads[currentIdx].id };
            } else {
                updatedLoads.push(newItems[i]);
            }
        }
        
        if (clipboard.mode === 'cut') {
            const sourceIds = clipboard.loads.map(l => l.id);
            updatedLoads = updatedLoads.filter(l => !sourceIds.includes(l.id));
            setClipboardState({ loads: [], mode: null });
            localStorage.removeItem('powerLoadClipboard');
        }

        setPowerLoads(updatedLoads);
        closeContextMenu();
    };

    const handleInsertPaste = () => {
        if (clipboard.loads.length === 0) return;
        isLocalChangeRef.current = true;
        recordHistory(powerLoads);
        const targetIdx = contextMenu.loadId ? powerLoads.findIndex(l => l.id === contextMenu.loadId) : powerLoads.length - 1;
        const newItems = clipboard.loads.map(l => ({ ...l, id: Date.now() + Math.random() }));
        let updatedLoads = [...powerLoads];
        updatedLoads.splice(targetIdx, 0, ...newItems);
        
        if (clipboard.mode === 'cut') {
            const sourceIds = clipboard.loads.map(l => l.id);
            updatedLoads = updatedLoads.filter(l => !sourceIds.includes(l.id));
            setClipboardState({ loads: [], mode: null });
            localStorage.removeItem('powerLoadClipboard');
        }

        setPowerLoads(updatedLoads);
        closeContextMenu();
    };

    const handleInsertRow = () => {
        isLocalChangeRef.current = true;
        recordHistory(powerLoads);
        const targetIdx = contextMenu.loadId ? powerLoads.findIndex(l => l.id === contextMenu.loadId) : powerLoads.length - 1;
        const newLoad = { id: Date.now(), bankId: '', bankName: '', bankType: '', bankLocation: '', circuit: '', equipmentName: '', phase: '3Φ4W', voltage: '380V', kva: '', kw: '', demandFactor: '100', startingKw: '', alphaLabel: '표준형', alphaValue: '1.38', betaLabel: 'DOL', betaValue: '1.0', coeffC: '1.0', pf: '-', eff: '-', isFire: false, isBlackout: false, isSequential: false, chk: 'Ok' };
        const updatedLoads = [...powerLoads];
        updatedLoads.splice(targetIdx + 1, 0, newLoad);
        
        setPowerLoads(updatedLoads);
        closeContextMenu();
    };

    const addPowerLoad = () => {
        isLocalChangeRef.current = true;
        recordHistory(powerLoads);
        const newLoad = { id: Date.now(), bankId: '', bankName: '', bankType: '', bankLocation: '', circuit: '', equipmentName: '', phase: '3Φ4W', voltage: '380V', kva: '', kw: '', demandFactor: '100', startingKw: '', alphaLabel: '표준형', alphaValue: '1.38', betaLabel: 'DOL', betaValue: '1.0', coeffC: '1.0', pf: '-', eff: '-', isFire: false, isBlackout: false, isSequential: false, chk: 'Ok' };
        const newLoads = [...powerLoads, newLoad];
        setPowerLoads(newLoads);
        
        markAsDirty(panelId);
    };

    const handleDeleteSelected = () => {
        isLocalChangeRef.current = true;
        recordHistory(powerLoads);
        const loadsToDelete = powerLoads.filter(l => selectedRows.includes(l.id));
        // [CONNECTION SYNC] 글로벌 계통도 연결 해제
        const connectedIds = loadsToDelete.map(l => l.connectedPanelId).filter(Boolean);
        disconnectPanels(connectedIds);

        const newLoads = powerLoads.filter(l => !selectedRows.includes(l.id));
        setPowerLoads(newLoads);
        
        setSelectedRows([]);
        closeContextMenu();
    };

    // Keyboard Shortcuts Effect
    useEffect(() => {
        const handleKeyDown = (e) => {
            const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA';
            const isControlKey = e.ctrlKey || e.metaKey;
            if (!e.key) return;
            const key = e.key.toLowerCase();

            if (isInput) {
                if (key === 'v' && isControlKey) return;
                if ((key === 'c' || key === 'x') && isControlKey) {
                    if (e.target.selectionStart !== e.target.selectionEnd) return;
                } else if (e.key === 'Delete' || e.key === 'Backspace') return;
                else if (!isControlKey) return;
            }

            if (selectedRows.length === 0 && !(isControlKey && key === 'v')) return;

            if (isControlKey && key === 'c') {
                e.preventDefault(); handleCopy();
            } else if (isControlKey && key === 'x') {
                e.preventDefault(); handleCut();
            } else if (isControlKey && key === 'v') {
                e.preventDefault(); handlePaste();
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault(); handleDeleteSelected();
            } else if (isControlKey && key === 'z') {
                isLocalChangeRef.current = true;
                if (e.shiftKey) { 
                    e.preventDefault(); 
                    redo();
                }
                else { 
                    e.preventDefault(); 
                    undo();
                }
            } else if (isControlKey && key === 'y') {
                isLocalChangeRef.current = true;
                e.preventDefault(); 
                redo();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedRows, powerLoads, clipboard, lastSelectedRow, undo, redo]);

    // Drag and Drop Handlers
    const handleDragStart = (e, loadId, isGroup = false) => { 
        setDraggedRow(loadId); 
        setIsGroupDrag(isGroup);
        e.dataTransfer.effectAllowed = 'move'; 
    };
    const handleDragOver = (e, loadId) => {
        e.preventDefault();
        if (loadId === draggedRow) return;

        let targetId = loadId;
        let position = 'above';
        const rect = e.currentTarget.getBoundingClientRect();
        const y = e.clientY - rect.top;
        
        if (isGroupDrag) {
            // Find the bank of the target row to ensure the drop line is at bank boundaries
            const targetLoad = powerLoads.find(l => l.id === loadId);
            if (targetLoad?.bankId) {
                const group = powerLoads.filter(l => l.bankId === targetLoad.bankId);
                const firstId = group[0].id;
                const lastId = group[group.length - 1].id;
                
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
    };
    const handleDragLeave = () => setDropTarget(null);
    const handleDrop = (e, targetIdArg) => {
        e.preventDefault();
        if (!draggedRow) { setDraggedRow(null); setDropTarget(null); return; }
        
        isLocalChangeRef.current = true;
        recordHistory(powerLoads);
        const position = dropTarget?.position || 'above';
        const targetId = dropTarget?.id || targetIdArg;

        if (draggedRow === targetId) { setDraggedRow(null); setDropTarget(null); return; }

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
        if (targetIdx === -1) { setDraggedRow(null); setDropTarget(null); return; }
        
        const insertionIdx = position === 'below' ? targetIdx + 1 : targetIdx;
        const newLoads = [...remainingLoads.slice(0, insertionIdx), ...draggedLoadsData, ...remainingLoads.slice(insertionIdx)];
        
        setPowerLoads(newLoads);

        setDraggedRow(null); setDropTarget(null); setIsGroupDrag(false);
    };
    const handleDragEnd = () => { setDraggedRow(null); setDropTarget(null); setIsGroupDrag(false); };

    // --- Dropdown Management ---

    const updateDropdownPosition = (el) => { 
        if (!el) { setActiveDropdownId(null); return; } 
        const r = el.getBoundingClientRect(); 
        setDropdownPos({ top: r.bottom + window.scrollY, left: r.left + window.scrollX, width: r.width }); 
        setActiveDropdownId(`panel-${el.dataset.rowId}`); 
    };
    const exportToExcel = () => setShowExportSaveModal(true);
    const performExcelExport = () => { exportPowerLoadToExcel(projectInfo, calculatedLoads, { totalLoad, totalCurrentCalc }, kecSettings); };
    const handleExportSaveConfirm = async () => {
        setShowExportSaveModal(false);
        // Dispatch save event
        window.dispatchEvent(new CustomEvent('kelc_trigger_save', { detail: { panelId } }));

        // Wait for save finish signal
        const onSaveFinished = async (e) => {
            if (e.detail?.panelId === panelId) {
                window.removeEventListener('kelc_save_finished', onSaveFinished);
                if (e.detail.success) {
                    // [NEW] 프로젝트 전체 일괄 저장 수행하여 헤더의 빨간 점(Dirty) 제거
                    await projectService.performBatchSave(projectId);
                    performExcelExport();
                } else {
                    showToast('저장 중 오류가 발생하여 추출을 중단합니다.', 'error');
                }
            }
        };
        window.addEventListener('kelc_save_finished', onSaveFinished);
        
        // Safety timeout
        setTimeout(() => {
            window.removeEventListener('kelc_save_finished', onSaveFinished);
        }, 5000);
    };

    // [NEW] 현재 발전기 계산서에 이미 등록된 패널 ID 집합 계산 (지역 범위 한정)
    const localUsedPanelIds = useMemo(() => {
        const ids = new Set();
        powerLoads.forEach(l => {
            if (l.bankId) ids.add(String(l.bankId));
            if (l.connectedPanelId) ids.add(String(l.connectedPanelId));
        });
        return ids;
    }, [powerLoads]);

    if (isHydrating) {
        return (
            <div className="min-h-screen bg-[#050505] text-gray-500 p-2 sm:p-4 lg:p-6 animate-pulse overflow-hidden">
                <div className="max-w-[1920px] mx-auto w-full">
                    {/* Header Info Bar Skeleton */}
                    <div className="h-[120px] bg-zinc-950/40 border border-zinc-900 mb-6 flex items-center px-6 gap-8">
                        <div className="w-48 h-10 bg-zinc-900/30 rounded-sm"></div>
                        <div className="flex-1 h-8 bg-zinc-900/20 rounded-sm"></div>
                        <div className="w-64 h-10 bg-zinc-900/30 rounded-sm"></div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                        {/* Table Area Skeleton */}
                        <div className="lg:col-span-3 space-y-4">
                            <div className="h-12 bg-zinc-900/40 border border-zinc-900"></div>
                            <div className="space-y-2">
                                {[...Array(15)].map((_, i) => (
                                    <div key={i} className="flex gap-2">
                                        <div className="h-6 bg-zinc-900/20 rounded-sm w-12"></div>
                                        <div className="h-6 bg-zinc-900/20 rounded-sm flex-1"></div>
                                        <div className="h-6 bg-zinc-900/20 rounded-sm w-24"></div>
                                        <div className="h-6 bg-zinc-900/20 rounded-sm w-24"></div>
                                        <div className="h-6 bg-zinc-900/20 rounded-sm w-32"></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                        {/* Summary Area Skeleton */}
                        <div className="space-y-6 pb-20">
                            <div className="h-[280px] bg-zinc-950/40 border border-zinc-900 rounded-sm"></div>
                            <div className="h-[280px] bg-zinc-950/40 border border-zinc-900 rounded-sm"></div>
                            <div className="h-[180px] bg-zinc-950/40 border border-zinc-900 rounded-sm"></div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-gray-300 p-2 sm:p-4 lg:p-6" 
            onClick={() => {
                setSelectedRows([]);
                setActiveDropdownId(null);
            }}
        >
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
                <ProjectInfoBar projectInfo={projectInfo} updateProjectInfo={updateProjectInfo} />
                <GeneratorTable 
                    calculatedLoads={calculatedLoads} selectedRows={selectedRows} dropTarget={dropTarget} draggedRow={draggedRow}
                    handleDragStart={handleDragStart} handleDragOver={handleDragOver} handleDragLeave={handleDragLeave}
                    handleDrop={handleDrop} handleDragEnd={handleDragEnd} handleContextMenu={handleContextMenu}
                    handleGroupContextMenu={handleGroupContextMenu} handleRowClick={handleRowClick} handleGroupClick={handleGroupClick}
                    handleBankSelection={handleBankSelection} updatePowerLoad={updatePowerLoad} panels={panels}
                    activeDropdownId={activeDropdownId} updateDropdownPosition={updateDropdownPosition} dropdownPos={dropdownPos}
                    panelId={panelId} globalUsedPanelIds={localUsedPanelIds} addPowerLoad={addPowerLoad}
                />
                <LoadSummary 
                    projectInfo={projectInfo} exportToExcel={exportToExcel} updateProjectInfo={updateProjectInfo}
                    demandFactorSummary={demandFactorSummary}
                    totalLoad={totalLoad}
                    isCapacityMatched={isCapacityMatched}
                    totalCurrentCalc={totalCurrentCalc}
                    mainCtValue={mainCtValue}
                    blackoutMotorSummary={blackoutMotorSummary}
                    fireMotorSummary={fireMotorSummary}
                    showExportSaveModal={showExportSaveModal} setShowExportSaveModal={setShowExportSaveModal}
                    performExcelExport={performExcelExport} handleExportSaveConfirm={handleExportSaveConfirm}
                />
                <GeneratorContextMenu 
                    contextMenu={contextMenu} closeContextMenu={closeContextMenu} calculatedLoads={calculatedLoads}
                    projectId={projectId} panels={panels} navigate={navigate} handleInsertRow={handleInsertRow}
                    handleCopy={handleCopy} handleCut={handleCut} handlePaste={handlePaste} handleInsertPaste={handleInsertPaste}
                    handleDeleteSelected={handleDeleteSelected} clipboard={clipboard} selectedRows={selectedRows}
                />
            </div>
        </div>
    );
};

export default Generator;

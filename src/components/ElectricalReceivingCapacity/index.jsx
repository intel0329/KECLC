import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { X, AlertCircle, CheckCircle, ExternalLink } from 'lucide-react';
import Papa from 'papaparse';
import CB_DATA from '../../data/CB.json';
import { getProject, getRemoteData, setRemoteData, removeRemoteData, savePanelConnections, updatePanelName, performBatchSave } from '../../services/projectService';
import projectService from '../../services/projectService';
import { usePanelLookup } from '../../hooks/usePanelLookup';
import useDataStore from '../../store/useDataStore';
import { exportReceivingCapacityToExcel } from '../../utils/excel/receivingCapacityExport';
import { 
    calculateReceivingCapacityExportData, 
    calculateMofData, 
    calculateInsulationTypes 
} from '../../utils/receivingCapacityCalculations';

// Import extracted sub-sections
import ProjectInfoBar from './sections/ProjectInfoBar';
import CapacityTable from './sections/CapacityTable';
import LoadSummary from './sections/LoadSummary';
import CapacityContextMenu from './sections/CapacityContextMenu';

// Helper paths
import { getAFValue, getVoltageByPhase } from './utils/capacityHelpers';

const STORAGE_KEY = 'kelc_setting_data';

// Constant for Fuse Ratings - Moved outside to prevent infinite re-renders
const FUSE_RATINGS = [
    { a: 5, ka: 40 }, { a: 10, ka: 40 }, { a: 16, ka: 40 }, { a: 20, ka: 40 },
    { a: 25, ka: 40 }, { a: 30, ka: 40 }, { a: 40, ka: 40 }, { a: 50, ka: 40 },
    { a: 63, ka: 40 }, { a: 75, ka: 25 }, { a: 100, ka: 25 }, { a: 125, ka: 25 },
    { a: 160, ka: 25 }, { a: 200, ka: 25 }
];

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

const ElectricalReceivingCapacity = () => {
    const { projectId, panelId } = useParams();
    const navigate = useNavigate();

    // [Phase 3] Responsive Calculation & Hydration Gate
    const [isPending, startTransition] = React.useTransition();
    const [isHydrating, setIsHydrating] = useState(true);

    // Zustand Store
    const loadPanelStore = useDataStore(state => state.loadPanel);
    const getPanelResult = useDataStore(state => state.getPanelResult);
    const results = useDataStore(state => state.results);
    const panelsData = useDataStore(state => state.panels);
    const activeProjectId = useDataStore(state => state.activeProjectId);
    const initProject = useDataStore(state => state.initProject);

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
                if (load.type === 'SPARE') return;
                if (load.type === 'MOTOR' || load.type === 'PUMP') {
                    const kw = Number(load.effectivePower) || 0, pf = Number(load.powerFactor) || 0.85, eff = Number(load.efficiency) || 0.9;
                    if (pf > 0 && eff > 0) totalVA += (kw / (pf * eff)) * 1000;
                } else totalVA += (Number(load.apparentPower) || 0) * 1000;
            });
        }
        return Math.round(totalVA);
    };

    const getCoreDataString = (info, loads) => JSON.stringify({ 
        projectInfo: {
            ...info,
            // Ensure consistency in data tracking
            usageType: info.usageType || 'S+PF',
            insulationType: info.insulationType || 'OIL'
        }, 
        powerLoads: loads 
    });

    // Initial States
    const [projectInfo, setProjectInfo] = useState({
        name: '', location: '', phase: '3Φ4W', voltage: '380V', mainBreakerType: 'MCCB',
        mccbAT: 400, mccbAF: 400, usageType: 'S+PF', insulationType: 'OIL', installType: '옥내형', mainCapacity: '',
        branchDistance: 30, wire: 'FCV', cableSize: '', kecMethod: 'E', voltageDropLimit: 3, demandFactor: 100,
        source: ''
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
    const [fuseSettings, setFuseSettings] = useState({
        '100 ~ 150kVA': 2.0, '200 ~ 300kVA': 1.5, '350 ~ 450kVA': 1.5, '500 ~ 700kVA': 1.5,
        '750 ~ 1000kVA': 1.25, '1050 ~ 1600kVA': 1.5
    });
    const [tccMultiplierData, setTccMultiplierData] = useState(null);

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

    const [isDataLoaded, setIsDataLoaded] = useState(false);
    const [isReadyToCheck, setIsReadyToCheck] = useState(false);
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
    const [selectedRows, setSelectedRows] = useState([]);
    const [lastSelectedRow, setLastSelectedRow] = useState(null);
    const [draggedRow, setDraggedRow] = useState(null);
    const [isGroupDrag, setIsGroupDrag] = useState(false);
    const [dropTarget, setDropTarget] = useState(null);
    const [contextMenu, setContextMenu] = useState({ show: false, x: 0, y: 0, loadId: null });
    const [clipboard, setClipboardState] = useState(() => {
        try { const saved = localStorage.getItem('powerLoadClipboard'); return saved ? JSON.parse(saved) : { loads: [], mode: null }; }
        catch (e) { return { loads: [], mode: null }; }
    });
    const [activeDropdownId, setActiveDropdownId] = useState(null);
    const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
    const [showExportSaveModal, setShowExportSaveModal] = useState(false);
    const [otherPanels, setOtherPanels] = useState([]);

    // Helper to format Fuse Rating
    const formatFuseRating = (val) => {
        if (!val || val === '-') return '-';
        const num = parseInt(val);
        if (isNaN(num)) return val;
        const match = FUSE_RATINGS.find(r => r.a === num);
        return match ? `${match.a}A/${match.ka}kA` : `${num}A`;
    };

    const [mofData, setMofData] = useState({ pt: '-', ct: '-', ocs: '-', primaryPF: '-', trSidePF: '-', af: '-', icu: '-', am: '-', kv: '-', type: 'ACB' });
    const [mofDatabase, setMofDatabase] = useState([]);
    const lastSavedDataRef = useRef(null);
    // [Active Origin] 사용자가 직접 수정을 발생시켰는지 여부 확인 (다중 탭 자동 저장 충돌 방지)
    const isLocalChangeRef = useRef(false);
    const lastSyncFingerprintRef = useRef('');

    // [Tier 0] Zombie Row Cleanup & Pure Observer Enforcement
    // Ensures powerLoads state only contains TR Headers or Standalone Panels
    useEffect(() => {
        if (!isDataLoaded || powerLoads.length === 0) return;

        const filtered = powerLoads.filter(load => {
            // [Pure Observer] Rows with BOTH bankId and connectedPanelId are "Zombies" 
            // that should be derived dynamically instead of stored in state.
            const isZombie = load.bankId && load.connectedPanelId;
            if (isZombie) return false;

            // [Garbage Collection] Remove rows for deleted panels
            if (load.bankId && lookupLoaded && !idToName[load.bankId]) return false;
            if (load.connectedPanelId && lookupLoaded && !idToName[load.connectedPanelId]) return false;
            
            return true;
        });

        if (filtered.length !== powerLoads.length) {
            console.log(`[Gap-ji Observer] Sanitizing state: Removing ${powerLoads.length - filtered.length} zombie/dead rows.`);
            setPowerLoads(filtered);
        }
    }, [idToName, lookupLoaded, isDataLoaded, powerLoads.length]);

    // [Observer] Ensure all expanded children panels are loaded into memory for Reactive Lookup
    useEffect(() => {
        if (!isDataLoaded || !lookupLoaded) return;
        
        const missingIds = new Set();
        powerLoads.forEach(trRow => {
            if (trRow.bankId) {
                const childIds = getChildrenIds(trRow.bankId) || [];
                childIds.forEach(id => {
                    if (!panelsData[id]) missingIds.add(id);
                });
            }
        });
        
        if (missingIds.size > 0) {
            console.log(`[Gap-ji Observer] Pre-loading ${missingIds.size} missing child panels.`);
            missingIds.forEach(id => loadPanelStore(id));
        }
    }, [powerLoads, panelsData, isDataLoaded, lookupLoaded, getChildrenIds, loadPanelStore]);
    
    // [RESTORED] Fetch MOF/Fuse/ACB Data from PRD.csv and use Unified Calculator
    useEffect(() => {
        const fetchMofDatabase = async () => {
            try {
                const response = await fetch('/db/PRD.csv');
                if (!response.ok) throw new Error('Failed to fetch PRD.csv');
                const csv = await response.text();
                Papa.parse(csv, {
                    complete: (results) => {
                        setMofDatabase(results.data);
                    }
                });
            } catch (e) {
                console.error('Failed to fetch M.O.F database:', e);
            }
        };
        fetchMofDatabase();
    }, []);

    useEffect(() => {
        const capacity = projectInfo.mainCapacity;
        if (!capacity || mofDatabase.length === 0) return;

        const calculated = calculateMofData(capacity, {
            mofDatabase,
            fuseSettings,
            mccSettings
        });
        setMofData(calculated);
    }, [projectInfo.mainCapacity, mofDatabase, fuseSettings, mccSettings]);

    const showToast = (message, type = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
    };

    const [calcResults, setCalcResults] = useState({
        calculatedLoads: [],
        totalLoad: 0,
        totalCurrentCalc: 0,
        totalTransformerCapacity: 0,
        demandFactorSummary: { avgPercent: 100, totalKva: 0, totalA: 0 },
        mainCtValue: null,
        insulationTypes: []
    });

    // [Phase 3] Reactive Recalculation with Dynamic Observer Expansion
    useEffect(() => {
        if (!isDataLoaded) return;

        startTransition(() => {
            // [PURE OBSERVER] Dynamically expand children rows for each TR bank from SSOT connections
            const expandedLoads = [];
            powerLoads.forEach(trRow => {
                if (trRow.bankId) {
                    const childIds = getChildrenIds(trRow.bankId) || [];
                    const trData = panelsData[trRow.bankId];
                    const trSubLoads = trData?.powerLoads || [];

                    if (childIds.length > 0) {
                        // [STRICT FILTER] Only process children that exist in the parent's feeder list (Eulji)
                        // This prevents "Zombie Connections" where a child still claims a parent that has deleted its feeder row.
                        const validChildIds = childIds.filter(cid => trSubLoads.some(sl => sl.connectedPanelId === cid));

                        validChildIds.forEach((childId) => {
                            const trSubLoad = trSubLoads.find(sl => sl.connectedPanelId === childId);
                            const childPanelData = panelsData[childId];
                            const childInfo = childPanelData?.projectInfo || {};
                            
                            // 실시간 부하량 (Memory-First)
                            const realTimeResult = results[childId];
                            const totalLoadVA = realTimeResult?.totalLoad ?? childInfo.cachedTotalLoad;
                            const totalLoadKVA = (totalLoadVA !== undefined && totalLoadVA !== null) 
                                                ? (Number(totalLoadVA) / 1000).toFixed(2) 
                                                : '';

                            expandedLoads.push({
                                ...trRow,
                                // Use deterministic dynamic ID to prevent key collisions but allow selection
                                id: `${trRow.id}_child_${childId}`, 
                                equipmentName: getNameById(childId),
                                connectedPanelId: childId,
                                sectionName: trSubLoad?.sectionName || '',
                                remarks: trSubLoad?.remarks || '',
                                isObserverRow: true,
                                // --- Reactive Lookup Fields injected early for calculation context ---
                                location: childInfo.location || '',
                                phase: childInfo.phase || '',
                                voltage: childInfo.voltage || '',
                                apparentPower: totalLoadKVA || '',
                                diversityFactor: trSubLoad?.diversityFactor || '1.0',
                                cbType: childInfo.mainBreakerType || '', 
                                at: childInfo.mccbAT || '',              
                                af: childInfo.mccbAF || '',              
                                shortCircuitCurrent: childInfo.shortCircuitCurrent || '' 
                            });
                        });
                    } else {
                        // Keep TR header row even if no children are connected
                        expandedLoads.push({
                            ...trRow,
                            equipmentName: '-',
                            connectedPanelId: null,
                            isObserverRow: true
                        });
                    }
                } else {
                    // Standalone panels or manual entries
                    expandedLoads.push(trRow);
                }
            });

            let calculatedLoads = calculateReceivingCapacityExportData(expandedLoads, panelsData);
            
            // [ZERO-SYNC] Reactive Mapping & Deep Lookup (Storage-Free) - Final Pass
            calculatedLoads = calculatedLoads.map(load => {
                const childId = load.connectedPanelId;
                const childPanelData = childId ? panelsData[childId] : null;
                const childInfo = childPanelData?.projectInfo || {};
                
                // 실시간 부하량 (Memory-First)
                const realTimeResult = results[childId];
                const totalLoadVA = realTimeResult?.totalLoad ?? childInfo.cachedTotalLoad;
                const totalLoadKVA = (totalLoadVA !== undefined && totalLoadVA !== null)
                                    ? (Number(totalLoadVA) / 1000).toFixed(2)
                                    : load.apparentPower;

                return {
                    ...load,
                    bankName: load.bankId ? getNameById(load.bankId) : load.bankName,
                    equipmentName: childId ? getNameById(childId) : load.equipmentName,
                    
                    // --- 리액티브 룩업 필드 (저장되지 않으며 렌더링 시점에만 조인됨) ---
                    location: childInfo.location || load.location || '',
                    phase: childInfo.phase || load.phase || '',
                    voltage: childInfo.voltage || load.voltage || '',
                    apparentPower: totalLoadKVA,
                    diversityFactor: load.diversityFactor || '1.0',
                    cbType: childInfo.mainBreakerType || load.cbType || '', 
                    at: childInfo.mccbAT || load.at || '',              
                    af: childInfo.mccbAF || load.af || '',              
                    shortCircuitCurrent: childInfo.shortCircuitCurrent || load.shortCircuitCurrent || '' 
                };
            });

            const totalLoad = calculatedLoads.reduce((sum, l) => l.type === 'SPARE' ? sum : sum + (Number(l.apparentPower) || 0), 0);
            const totalCurrentCalc = calculatedLoads.reduce((sum, l) => l.type === 'SPARE' ? sum : sum + (Number(l.subPanelTotalCurrent) || 0), 0);
            
            const uniqueBanks = Array.from(new Set(powerLoads.filter(l => l.bankId).map(l => l.bankId)));
            const totalTransformerCapacity = uniqueBanks.reduce((sum, bankId) => { 
                const firstLoadInBank = powerLoads.find(l => l.bankId === bankId); 
                const childPanel = panelsData[bankId];
                const latestCapacity = childPanel?.projectInfo?.mainCapacity;
                return sum + (parseFloat(latestCapacity !== undefined && latestCapacity !== '' ? latestCapacity : firstLoadInBank?.bankCapacity) || 0); 
            }, 0);

            const totalKva = calculatedLoads.reduce((sum, l) => sum + (Number(l.demandLoad) || 0), 0);
            const totalA = calculatedLoads.reduce((sum, l) => sum + (Number(l.demandCurrent) || 0), 0);
            const avgPercent = totalLoad > 0 ? (totalKva / totalLoad) * 100 : 100;

            const capacity = totalTransformerCapacity || 0;
            const targetCurrent = capacity > 0 ? (capacity / (Math.sqrt(3) * 0.38)) * (mccSettings.globalCT || 1.25) : 0;
            const standardRatings = [5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100, 150, 200, 250, 300, 400, 500, 600, 750, 800, 1000, 1200, 1500, 2000, 2500, 3000, 4000];
            const mainCtValue = targetCurrent > 0 ? (standardRatings.find(r => r >= targetCurrent) || standardRatings[standardRatings.length - 1]) : null;

            const insulationTypes = calculateInsulationTypes(powerLoads, panelsData, projectInfo.insulationType);

            setCalcResults({
                calculatedLoads,
                totalLoad,
                totalCurrentCalc,
                totalTransformerCapacity,
                demandFactorSummary: { avgPercent, totalKva, totalA },
                mainCtValue,
                insulationTypes
            });
        });
    }, [powerLoads, panelsData, results, projectInfo.insulationType, mccSettings.globalCT, isDataLoaded, getNameById, getChildrenIds]);

    const { calculatedLoads, totalLoad, totalCurrentCalc, totalTransformerCapacity, demandFactorSummary, mainCtValue, insulationTypes } = calcResults;

    useEffect(() => { 
        if (isDataLoaded && String(totalTransformerCapacity) !== String(projectInfo.mainCapacity)) { 
            setProjectInfo(prev => ({ ...prev, mainCapacity: String(totalTransformerCapacity) })); 
            markAsDirty(panelId); 
        } 
    }, [totalTransformerCapacity, isDataLoaded, panelId]);

    // [NEW] System Type (usageType) Auto-Switch Logic based on capacity
    useEffect(() => {
        if (!isDataLoaded) return;
        const capacity = Number(projectInfo.mainCapacity || 0);
        if (capacity >= 1000) {
            if (projectInfo.usageType !== 'PF+C') {
                updateProjectInfo('usageType', 'PF+C');
            }
        } else if (!projectInfo.usageType) {
            // Priority/Default for kVA < 1000
            updateProjectInfo('usageType', 'S+PF');
        }
    }, [projectInfo.mainCapacity, isDataLoaded, projectInfo.usageType]);

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

    const phaseTotals = { totalCurrent: totalCurrentCalc };
    const summaryStats = {};

    // Handlers
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
                apparentPower: totalLoadKVA,
                demandFactor: data.projectInfo?.demandFactor || '100',
                cbP: String(getP(phase)),
                cbType: data.projectInfo?.mainBreakerType || 'MCCB',
                at: data.projectInfo?.mccbAT || '',
                shortCircuitCurrent: data.projectInfo?.shortCircuitCurrent || ''
            } : load));
        } catch (e) { console.error('Failed to fetch sub-panel data:', e); }
    };

    const updateProjectInfo = (field, value) => { 
        setProjectInfo(prev => ({ ...prev, [field]: value })); 
        markAsDirty(panelId); 
        
        // [Active Origin]
        isLocalChangeRef.current = true;
        // [ZERO SYNC] 🟢 LOCAL_SAVED
        useDataStore.getState().setSyncStatus('local', 'saved');

        // [OPTIMISTIC SOURCE UPDATE] 
        if (field === 'fromId' || field === 'source') {
            const currentConnections = { ...useDataStore.getState().panelConnections };
            const effectiveValue = value || null;
            if (effectiveValue) {
                currentConnections[panelId] = effectiveValue;
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
        setPowerLoads(prev => prev.map(load => {
            if (load.id !== id) return load;
            let updated = { ...load, [field]: value };
            if (field === 'equipmentName' && selectedPanel) updated.connectedPanelId = selectedPanel.id;
            else if (field === 'equipmentName' && !value) {
                updated.connectedPanelId = null;
                updated.phase = '';
                updated.voltage = '';
                updated.apparentPower = '';
                updated.demandFactor = '';
                updated.diversityFactor = '';
                updated.cbP = '';
                updated.at = '';
                updated.shortCircuitCurrent = '';
                updated.af = '';
            }
            return updated;
        }));
        markAsDirty(panelId);
        
        // [Active Origin]
        isLocalChangeRef.current = true;
        // [ZERO SYNC] 🟢 LOCAL_SAVED
        useDataStore.getState().setSyncStatus('local', 'saved');

        if (field === 'equipmentName') {
            const panel = selectedPanel || panels.find(p => p.name === value);
            if (panel) fetchAndApplyPanelData(id, panel);
        }
    };

    const handleTRSelection = async (loadId, name, selectedPanel) => {
        isLocalChangeRef.current = true;
        if (!selectedPanel) {
            setPowerLoads(prev => prev.map(l => l.id === loadId ? { ...l, bankId: '', bankName: name, bankCapacity: '' } : l));
            return;
        }
        
        let capacity = '';
        try {
            const trData = await loadPanelStore(selectedPanel.id);
            capacity = trData?.projectInfo?.mainCapacity || '';
        } catch (e) { console.error('Failed to load TR data:', e); }

        setPowerLoads(prev => prev.map(l => l.id === loadId ? {
            ...l,
            bankId: selectedPanel.id,
            bankName: selectedPanel.name,
            bankCapacity: capacity,
            // [Pure Observer] Clear child-specific fields as they will be derived dynamically
            equipmentName: '',
            connectedPanelId: null,
            sectionName: '',
            remarks: ''
        } : l));

        markAsDirty(panelId);
        // [ZERO SYNC] 🟢 LOCAL_SAVED
        useDataStore.getState().setSyncStatus('local', 'saved');
    };

    // [REMOVED] Legacy TR Sync Logic. 
    // Now handled by dynamic expansion in the calculation phase (Pure Observer Mode).
    /*
    useEffect(() => {
        // ... (Legacy code removed)
    }, [...]);
    */

    // Initialization Effect
    useEffect(() => {
        const load = async () => {
            if (!projectId || !panelId) return;
            setIsReadyToCheck(false);
            setIsHydrating(true);
            
            try {
                // [Tier 1] Memory-First (Zustand Store) - 최우선 순위
                const storeState = useDataStore.getState().panels[panelId];
                
                let loadedInfo = null;
                let loadedLoads = null;

                if (storeState) {
                    console.log(`[Gap-ji Hydration] Memory-First Hit: ${panelId}`);
                    loadedInfo = storeState.projectInfo;
                    loadedLoads = storeState.powerLoads;
                } else {
                    // [Tier 2] LocalStorage 캐시 확인
                    const cacheKey = `kelc_panel_cache_${panelId}`;
                    const cached = localStorage.getItem(cacheKey);
                    let cachedData = null;
                    if (cached) {
                        try {
                            cachedData = JSON.parse(cached);
                        } catch (e) { console.warn("Cache parse failed:", e); }
                    }

                    // [Status-Based Hydration] 로컬 캐시가 DIRTY/LOCAL_SAVED면 서버 조회 없이 신뢰
                    let finalData = null;
                    if (cachedData && (cachedData.status === 'DIRTY' || cachedData.status === 'LOCAL_SAVED')) {
                        console.log(`[Gap-ji Hydration] Local-First: Trusting Local Cache (${cachedData.status})`);
                        finalData = cachedData;
                    } else {
                        // [Tier 3] 서버 데이터 조회 (Draft -> Origin)
                        const originKey = getOriginKey(panelId);
                        const draftKey = getDraftKey(panelId);
                        const draftData = await getRemoteData(draftKey, projectId);
                        
                        if (draftData) {
                            finalData = draftData;
                        } else {
                            const originData = await getRemoteData(originKey, projectId);
                            if (originData) {
                                finalData = originData;
                            } else if (cachedData) {
                                // 서버에 없고 로컬에만 데이터가 있는 경우
                                finalData = cachedData;
                            }
                        }
                    }

                    if (finalData) {
                        loadedInfo = finalData.projectInfo;
                        loadedLoads = finalData.powerLoads;
                    }
                }
                
                // 기본값 보장
                const finalInfo = {
                    name: '', location: '', phase: '3Φ-3W', voltage: '380V', mainBreakerType: 'MCCB',
                    mccbAT: '', mccbAF: '', usageType: 'S+PF', insulationType: 'OIL', installType: '옥내형', mainCapacity: '',
                    branchDistance: 30, wire: 'FCV', cableSize: '', kecMethod: 'E', demandFactor: 100,
                    ...loadedInfo
                };
                const finalLoads = (loadedLoads || []).map(l => ({ ...l, chk: l.chk || 'Ok' }));

                // [REFINED] Robust Sanitization
                if (finalInfo.usageType === 'OIL' || finalInfo.usageType === 'MOLD') {
                    if (!finalInfo.insulationType) finalInfo.insulationType = finalInfo.usageType;
                    finalInfo.usageType = 'S+PF'; 
                }
                if (!finalInfo.insulationType) finalInfo.insulationType = 'OIL';

                const project = await getProject(projectId);
                if (project?.name) finalInfo.name = project.name;

                // 상태 업데이트
                setProjectInfo(finalInfo);
                setPowerLoads(finalLoads);

                // [SSOT Sync] 전역 스토어 업데이트
                useDataStore.getState().updatePanelData(panelId, {
                    projectInfo: finalInfo,
                    powerLoads: finalLoads
                });

                lastSavedDataRef.current = getCoreDataString(finalInfo, finalLoads);
                
                // [FIX] Sync Project Context
                initProject(projectId);
                const projectCtx = {
                    projectId: projectId,
                    projectName: (project?.name || finalInfo.name) || '',
                    panelName: finalInfo.panelName
                };
                localStorage.setItem('kelc_project_info', JSON.stringify(projectCtx));
                localStorage.setItem('kelc_active_project_id', projectId);
                
                if (project?.calculators) {
                    const allPanels = [];
                    const extractPanels = (items) => { if (!items) return; items.forEach(item => { if (item.id && item.name && item.id !== panelId) allPanels.push({ id: item.id, name: item.name }); if (item.children) extractPanels(item.children); }); };
                    extractPanels(project.calculators);
                    setOtherPanels(allPanels);
                }

                // [Blocking Hydration] 부모 계산에 필요한 모든 자식 데이터를 한 번에 가져옴
                const subPanelIds = new Set();
                finalLoads.forEach(l => {
                    if (l.connectedPanelId) subPanelIds.add(l.connectedPanelId);
                    if (l.bankId) subPanelIds.add(l.bankId);
                });

                if (subPanelIds.size > 0) {
                    console.log(`[Gap-ji Hydration] Waiting for ${subPanelIds.size} sub-panels... ProjectId: ${projectId}`);
                    
                    // [Phase 3 Optimization] Promise.allSettled를 사용하여 일부 패널 로딩 실패 시에도 전체 프로세스가 멈추지 않도록 개선
                    await Promise.allSettled(Array.from(subPanelIds).map(async (id) => {
                        try {
                            // [Phase 3 Refinement] 현재 페이지의 projectId를 명시적으로 전달하여 하이드레이션 정합성 확보
                            const data = await loadPanelStore(id, false, projectId);
                            
                            if (data) {
                                // [Tier 1 Sync] 가져온 데이터를 즉시 전역 스토어에 강제 주입 (을지 컴포넌트 마운트 시 즉시 참조 가능하도록)
                                useDataStore.getState().updatePanelData(id, data);
                                console.log(`[Gap-ji Hydration] Sub-panel ${id} loaded successfully.`);
                            } else {
                                // [Fallback] 서버에 데이터가 없는 경우에만 기본 빈 구조를 스토어에 삽입 (안전장치 유지)
                                console.warn(`[Gap-ji Hydration] Sub-panel ${id} has no data on server, applying fallback.`);
                                useDataStore.getState().updatePanelData(id, {
                                    projectInfo: { mainCapacity: 0, phase: '3Φ-4W', voltage: '380V' },
                                    powerLoads: []
                                });
                            }
                        } catch (e) {
                            console.error(`[Gap-ji Hydration] Critical error loading sub-panel ${id}, using empty fallback.`, e);
                            useDataStore.getState().updatePanelData(id, {
                                projectInfo: { mainCapacity: 0 },
                                powerLoads: []
                            });
                        }
                    }));
                }

                // [Phase 3 Refinement] 모든 데이터 적재 확인 후 게이트 해제
                setIsDataLoaded(true);
                setTimeout(() => {
                    setIsHydrating(false);
                    setIsReadyToCheck(true);
                    console.log(`[Gap-ji Hydration] All gates open. Recalculating...`);
                }, 500);

            } catch (e) { 
                console.error('Failed to load initial data:', e); 
                setIsDataLoaded(true);
                setIsHydrating(false);
            }
        };
        load();
        
        const handleUpdate = async () => { 
            const p = await getProject(projectId); 
            if (p?.name) setProjectInfo(prev => ({ ...prev, name: p.name })); 
        };
        window.addEventListener('kelc_project_info_updated', handleUpdate);
        return () => window.removeEventListener('kelc_project_info_updated', handleUpdate);
    }, [projectId, panelId, loadPanelStore]);

    // Auto-Save Draft Logic
    useEffect(() => {
        if (!isDataLoaded || !isReadyToCheck || !projectId || !panelId) return;

        const timer = setTimeout(async () => {
            // [Active Origin] 내가 직접 수정한 경우에만 서버 자동 저장 진행
            if (!isLocalChangeRef.current) return;

            const currentDataString = getCoreDataString(projectInfo, powerLoads);
            if (lastSavedDataRef.current === currentDataString) return;

            // [SYNC STATUS] 🟡 SERVER_SYNCING (저장 시작)
            useDataStore.getState().setSyncStatus('remote', 'saving');
            const startTime = Date.now();

            markAsDirty(panelId);
            const draftKey = getDraftKey(panelId);
            try {
                const dataToSave = {
                    projectInfo: { ...projectInfo, cachedTotalLoad: totalLoad },
                    powerLoads,
                    mofData,
                    savedAt: new Date().toISOString(),
                    isDraft: true
                };
                await setRemoteData(projectId, draftKey, dataToSave);
                await savePanelConnections(projectId, panelId, []);
                lastSavedDataRef.current = currentDataString;
                
                // [Active Origin] 저장 성공 후 권한 반납
                isLocalChangeRef.current = false;

                // [SYNC STATUS] 최소 800ms 동안 🟡 유지 (애니메이션 효과)
                const elapsed = Date.now() - startTime;
                const minDuration = 800;
                if (elapsed < minDuration) {
                    await new Promise(resolve => setTimeout(resolve, minDuration - elapsed));
                }

                // [SYNC STATUS] 🔵 SERVER_SYNCED (서버 자동 저장 완료)
                useDataStore.getState().setSyncStatus('remote', 'saved');
            } catch (e) {
                console.error('Failed to save draft:', e);
                // [SYNC STATUS] 🔴 ERROR
                useDataStore.getState().setSyncStatus('remote', 'error');
            }
        }, 3000);
        return () => clearTimeout(timer);
    }, [projectInfo, powerLoads, isDataLoaded, isReadyToCheck, projectId, panelId, totalLoad]);

    // Handle MANUAL SAVE (Commit)
    useEffect(() => {
        const handleTriggerSave = async (e) => {
            if (e.detail?.panelId !== panelId) return;
            const originKey = getOriginKey(panelId);
            const draftKey = getDraftKey(panelId);
            if (!originKey) return;

            try {
                const dataToSave = {
                    projectInfo: { ...projectInfo, cachedTotalLoad: totalLoad },
                    powerLoads,
                    mofData,
                    savedAt: new Date().toISOString(),
                    isDraft: false
                };
                await setRemoteData(projectId, originKey, dataToSave);
                await savePanelConnections(projectId, panelId, []);
                await removeRemoteData(draftKey);
                lastSavedDataRef.current = getCoreDataString(projectInfo, powerLoads);
                markAsClean(panelId);
                
                // [Active Origin] 수동 저장 시 리더 권한 초기화
                isLocalChangeRef.current = false;

                // [SYNC STATUS] 수동 저장 시 모든 상태 초기화
                useDataStore.getState().setSyncStatus('local', null);
                useDataStore.getState().setSyncStatus('remote', null);

                showToast('저장되었습니다.');
                window.dispatchEvent(new CustomEvent('kelc_save_finished', { detail: { panelId, success: true } }));
            } catch (e) {
                console.error('Failed to manual save:', e);
                showToast('저장에 실패했습니다.', 'error');
                // [SYNC STATUS] 🔴 ERROR
                useDataStore.getState().setSyncStatus('remote', 'error');
                window.dispatchEvent(new CustomEvent('kelc_save_finished', { detail: { panelId, success: false, error: e.message } }));
            }
        };
        window.addEventListener('kelc_trigger_save', handleTriggerSave);
        return () => window.removeEventListener('kelc_trigger_save', handleTriggerSave);
    }, [projectInfo, powerLoads, projectId, panelId, totalLoad]);

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
        recordHistory(powerLoads);
        const loadsToCut = powerLoads.filter(l => selectedRows.includes(l.id));
        setClipboardState({ loads: loadsToCut.map(l => ({ ...l })), mode: 'cut' });
        localStorage.setItem('powerLoadClipboard', JSON.stringify({ loads: loadsToCut, mode: 'cut' }));
        setPowerLoads(powerLoads.filter(l => !selectedRows.includes(l.id)));
        setSelectedRows([]);
        closeContextMenu();
    };

    const handlePaste = () => {
        if (clipboard.loads.length === 0) return;
        isLocalChangeRef.current = true;
        recordHistory(powerLoads);
        const targetIdx = contextMenu.loadId ? powerLoads.findIndex(l => l.id === contextMenu.loadId) : powerLoads.length;
        const newLoads = clipboard.loads.map(l => ({ ...l, id: Date.now() + Math.random() }));
        const updatedLoads = [...powerLoads];
        for (let i = 0; i < newLoads.length; i++) {
            if (targetIdx + i < updatedLoads.length) updatedLoads[targetIdx + i] = { ...newLoads[i], id: updatedLoads[targetIdx + i].id };
            else updatedLoads.push(newLoads[i]);
        }
        setPowerLoads(updatedLoads);
        if (clipboard.mode === 'cut') {
            const sourceIds = clipboard.loads.map(l => l.id);
            setPowerLoads(prev => prev.filter(l => !sourceIds.includes(l.id)));
            setClipboardState({ loads: [], mode: null });
            localStorage.removeItem('powerLoadClipboard');
        }
        closeContextMenu();

        // [Active Origin]
        // [ZERO SYNC] 🟢 LOCAL_SAVED
        useDataStore.getState().setSyncStatus('local', 'saved');
    };

    const handleInsertPaste = () => {
        if (clipboard.loads.length === 0) return;
        isLocalChangeRef.current = true;
        recordHistory(powerLoads);
        const targetIdx = contextMenu.loadId ? powerLoads.findIndex(l => l.id === contextMenu.loadId) : powerLoads.length - 1;
        const newLoads = clipboard.loads.map(l => ({ ...l, id: Date.now() + Math.random() }));
        const updatedLoads = [...powerLoads];
        updatedLoads.splice(targetIdx, 0, ...newLoads);
        setPowerLoads(updatedLoads);
        if (clipboard.mode === 'cut') {
            const sourceIds = clipboard.loads.map(l => l.id);
            setPowerLoads(prev => prev.filter(l => !sourceIds.includes(l.id)));
            setClipboardState({ loads: [], mode: null });
            localStorage.removeItem('powerLoadClipboard');
        }
        closeContextMenu();

        // [Active Origin]
        isLocalChangeRef.current = true;
        // [ZERO SYNC] 🟢 LOCAL_SAVED
        useDataStore.getState().setSyncStatus('local', 'saved');
    };

    const handleInsertRow = () => {
        isLocalChangeRef.current = true;
        recordHistory(powerLoads);
        const targetIdx = contextMenu.loadId ? powerLoads.findIndex(l => l.id === contextMenu.loadId) : powerLoads.length - 1;
        const newLoad = { id: Date.now(), equipmentName: '', sectionName: '', type: '', phase: '', startingMethod: '', startingTime: '', apparentPower: '', effectivePower: '', cbType: '', cbP: '', at: '', ct: '', capacitor: '', unitSize: '', powerFactor: '', efficiency: '', wire: '', size: '', chk: 'Ok' };
        const updatedLoads = [...powerLoads];
        updatedLoads.splice(targetIdx + 1, 0, newLoad);
        setPowerLoads(updatedLoads);
        closeContextMenu();

        // [Active Origin]
        isLocalChangeRef.current = true;
        // [ZERO SYNC] 🟢 LOCAL_SAVED
        useDataStore.getState().setSyncStatus('local', 'saved');
    };

    // [Phase 0] 초기 데이터 로드 (MariaDB / Local Cache)
    useEffect(() => {
        const loadInitialData = async () => {
            if (isDataLoaded) return;
            setIsHydrating(true);
            try {
                // 1. [Memory First] Zustand 스토어 확인
                let currentData = panelsData[panelId];
                
                if (!currentData || (!currentData.projectInfo && !currentData.powerLoads)) {
                    // 2. [Tier 2] Local Cache 확인 (Status-First)
                    const cacheKey = `kelc_panel_cache_${panelId}`;
                    const cached = localStorage.getItem(cacheKey);
                    let cachedData = null;
                    if (cached) {
                        try { cachedData = JSON.parse(cached); } catch (e) { console.warn("Cache parse failed:", e); }
                    }

                    if (cachedData && (cachedData.status === 'DIRTY' || cachedData.status === 'LOCAL_SAVED')) {
                        console.log(`[Receiving Hydration] Local-First: Trusting Local Cache (${cachedData.status})`);
                        currentData = cachedData;
                    } else {
                        // 3. [Tier 3] 서버 데이터 조회 (Draft -> Origin)
                        console.log('[Receiving] Fetching data from server...');
                        currentData = await loadPanelStore(panelId);
                    }
                }

                if (currentData) {
                    if (currentData.projectInfo) setProjectInfo(prev => ({ ...prev, ...currentData.projectInfo }));
                    if (currentData.powerLoads) setPowerLoads(currentData.powerLoads);
                    if (currentData.mofData) setMofData(currentData.mofData);
                }
            } catch (e) {
                console.error('Initial load failed:', e);
            } finally {
                setIsDataLoaded(true);
                setIsHydrating(false);
            }
        };
        loadInitialData();
    }, [panelId, projectId, loadPanelStore]);

    const addPowerLoad = () => {
        recordHistory(powerLoads);
        const newLoad = { id: Date.now(), equipmentName: '', sectionName: '', type: '', phase: '', startingMethod: '', startingTime: '', apparentPower: '', effectivePower: '', cbType: '', cbP: '', at: '', ct: '', capacitor: '', unitSize: '', powerFactor: '', efficiency: '', wire: '', size: '', chk: 'Ok' };
        setPowerLoads([...powerLoads, newLoad]);
        
        // [Active Origin]
        isLocalChangeRef.current = true;
        markAsDirty(panelId);

        // [ZERO SYNC] 🟢 LOCAL_SAVED
        useDataStore.getState().setSyncStatus('local', 'saved');
    };

    const handleDeleteSelected = () => {
        recordHistory(powerLoads);
        setPowerLoads(powerLoads.filter(l => !selectedRows.includes(l.id)));
        setSelectedRows([]);
        closeContextMenu();

        // [Active Origin]
        isLocalChangeRef.current = true;
        // [ZERO SYNC] 🟢 LOCAL_SAVED
        useDataStore.getState().setSyncStatus('local', 'saved');
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
                if (e.shiftKey) { e.preventDefault(); redo(); }
                else { e.preventDefault(); undo(); }
            } else if (isControlKey && key === 'y') {
                e.preventDefault(); redo();
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

        // [Active Origin]
        isLocalChangeRef.current = true;
        // [ZERO SYNC] 🟢 LOCAL_SAVED
        useDataStore.getState().setSyncStatus('local', 'saved');
    };
    const handleDragEnd = () => { setDraggedRow(null); setDropTarget(null); setIsGroupDrag(false); };

    // --- SSOT Sync Layer ---
    const syncPanel = useDataStore(state => state.syncPanel);
    
    // [Phase 1] External Sync (BroadcastChannel Support via panelsData)
    useEffect(() => {
        const storeData = panelsData[panelId];
        if (!storeData || !isDataLoaded || isLocalChangeRef.current) return;

        const currentDataStr = JSON.stringify({ projectInfo, powerLoads });
        const storeDataStr = JSON.stringify({ 
            projectInfo: storeData.projectInfo || {}, 
            powerLoads: storeData.powerLoads || [] 
        });

        if (currentDataStr !== storeDataStr) {
            console.log(`[ZERO SYNC] External update received for ${panelId}`);
            if (storeData.projectInfo) setProjectInfo(prev => ({ ...prev, ...storeData.projectInfo }));
            if (storeData.powerLoads) setPowerLoads(storeData.powerLoads);
            lastSavedDataRef.current = storeDataStr;
        }
    }, [panelsData, panelId, isDataLoaded]);

    useEffect(() => {
        if (isDataLoaded && powerLoads.length > 0) {
            powerLoads.forEach(load => {
                if (load.connectedPanelId && !panelsData[load.connectedPanelId]) loadPanelStore(load.connectedPanelId, false, projectId);
                if (load.bankId && !panelsData[load.bankId]) loadPanelStore(load.bankId, false, projectId);
            });
        }
    }, [isDataLoaded, powerLoads, loadPanelStore, panelsData, projectId]);

    // [Phase 2] Reactive bankCapacity Sync from Child Transformers (을지)
    useEffect(() => {
        if (!isDataLoaded || powerLoads.length === 0) return;

        let hasUpdates = false;
        const updatedLoads = powerLoads.map(load => {
            if (load.bankId) {
                const childPanel = panelsData[load.bankId];
                const latestCapacity = childPanel?.projectInfo?.mainCapacity;
                
                if (latestCapacity !== undefined && latestCapacity !== '' && String(load.bankCapacity) !== String(latestCapacity)) {
                    hasUpdates = true;
                    return { ...load, bankCapacity: String(latestCapacity) };
                }
            }
            return load;
        });

        if (hasUpdates) {
            console.log(`[Receiving Capacity] Dynamic Bank Capacity Sync: Updating stale TR capacities in powerLoads`);
            isLocalChangeRef.current = true;
            setPowerLoads(updatedLoads);
            markAsDirty(panelId);
        }
    }, [panelsData, isDataLoaded, powerLoads, panelId]);

    useEffect(() => {
        if (panelId && isDataLoaded) {
            // 1. 현재 데이터의 핵심 지문(Fingerprint) 생성
            const currentFingerprint = JSON.stringify({
                p: projectInfo,
                pl: powerLoads,
                mof: typeof mofData !== 'undefined' ? mofData : null,
                tl: totalLoad
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

            syncPanel(panelId, { projectInfo, powerLoads, mofData }, { totalLoad, phaseTotals, summaryStats, mainCtValue, calculatedLoads });

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
        }
    }, [panelId, isDataLoaded, projectInfo, powerLoads, mofData, totalLoad, phaseTotals, summaryStats, mainCtValue, calculatedLoads, syncPanel]);

    // [Phase 2] Auto-Save to Server (MariaDB / Redis Draft)
    useEffect(() => {
        if (!panelId || !isDataLoaded || !isLocalChangeRef.current) return;

        const draftKey = getDraftKey(panelId);
        if (!draftKey) return;

        let isActive = true;
        const timer = setTimeout(async () => {
            if (!isActive || !isLocalChangeRef.current) return;

            try {
                // [Sync Status] 서버 동기화 시작 (노란색)
                useDataStore.getState().setSyncStatus('remote', 'saving');
                const startTime = Date.now();

                const dataToSave = {
                    projectInfo: { ...projectInfo, cachedTotalLoad: totalLoad },
                    powerLoads,
                    mofData,
                    savedAt: new Date().toISOString(),
                    status: 'DIRTY',
                    isDraft: true
                };

                await setRemoteData(projectId, draftKey, dataToSave);

                // 최소 표시 시간 보장 (깜빡임 방지)
                const elapsed = Date.now() - startTime;
                if (elapsed < 800) await new Promise(r => setTimeout(r, 800 - elapsed));

                // [Sync Status] 서버 동기화 완료 (파란색)
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
                console.error('[Receiving] Auto-save failed:', e);
                useDataStore.getState().setSyncStatus('remote', 'error');
            }
        }, 3000); // 3초 디바운스

        return () => {
            isActive = false;
            clearTimeout(timer);
        };
    }, [panelId, projectId, isDataLoaded, totalLoad, projectInfo, powerLoads, mofData]);

    const updateDropdownPosition = (el) => { 
        if (!el) { setActiveDropdownId(null); return; } 
        const r = el.getBoundingClientRect(); 
        setDropdownPos({ top: r.bottom + window.scrollY, left: r.left + window.scrollX, width: r.width }); 
        setActiveDropdownId(`panel-${el.dataset.rowId}`); 
    };
    const exportToExcel = () => setShowExportSaveModal(true);
    const performExcelExport = () => { exportReceivingCapacityToExcel(projectInfo, calculatedLoads, { totalLoad, totalCurrentCalc }, mofData, insulationTypes); };
    
    const handleExportSaveConfirm = async () => { 
        setShowExportSaveModal(false); 
        
        // [FIX] 실제로 DB에 저장하는 로직을 수행합니다.
        try {
            const originKey = getOriginKey(panelId);
            const draftKey = getDraftKey(panelId);
            const dataToSave = {
                projectInfo: { ...projectInfo, cachedTotalLoad: totalLoad },
                powerLoads,
                mofData,
                savedAt: new Date().toISOString(),
                status: 'SERVER_SYNCED',
                isDraft: false
            };
            
            // 1. DB 영구 저장
            await setRemoteData(projectId, originKey, dataToSave);
            // 2. 계통 연결 정보 저장
            await savePanelConnections(projectId, panelId, []);
            // 3. 임시 저장(Draft) 삭제
            await removeRemoteData(draftKey);
            
            lastSavedDataRef.current = getCoreDataString(projectInfo, powerLoads);
            
            // [Active Origin] 수동 저장 시 리더 권한 초기화
            isLocalChangeRef.current = false;

            // [SYNC STATUS] 수동 저장 시 모든 상태 초기화
            useDataStore.getState().setSyncStatus('local', null);
            useDataStore.getState().setSyncStatus('remote', null);

            // [NEW] 프로젝트 전체 일괄 저장 수행하여 헤더의 빨간 점(Dirty) 제거
            await projectService.performBatchSave(projectId);
            
            showToast('저장 및 추출을 시작합니다.');
            
            // [FIX] 헤더의 빨간 점(더티 버튼)을 지우기 위해 저장 완료 이벤트를 발생시킵니다.
            window.dispatchEvent(new CustomEvent('kelc_save_finished', { detail: { panelId, success: true } }));
            
            // 저장이 완료된 후 추출 실행
            performExcelExport();
        } catch (e) {
            console.error('Failed to save before export:', e);
            showToast('저장에 실패하여 추출을 중단합니다.', 'error');
            // [SYNC STATUS] 🔴 ERROR
            useDataStore.getState().setSyncStatus('remote', 'error');
        }
    };

    if (!isDataLoaded || isHydrating) {
        return (
            <div className="min-h-screen bg-black text-gray-500 p-2 sm:p-4 lg:p-6 animate-pulse">
                <div className="max-w-[1920px] mx-auto w-full flex flex-col gap-6">
                    {/* Header Skeleton - 더 어두운 톤 */}
                    <div className="h-20 bg-zinc-950/40 border border-zinc-900 rounded-sm w-full"></div>

                    {/* Content Skeleton (확장형 레이아웃) */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 space-y-6">
                            {/* Main Table Area */}
                            <div className="h-[750px] bg-zinc-950/30 border border-zinc-900 rounded-sm p-6 space-y-4">
                                <div className="h-10 bg-zinc-900/40 rounded-sm w-full mb-6"></div>
                                {[...Array(20)].map((_, i) => (
                                    <div key={i} className="flex gap-4">
                                        <div className="h-6 bg-zinc-900/20 rounded-sm w-full"></div>
                                        <div className="h-6 bg-zinc-900/20 rounded-sm w-24"></div>
                                        <div className="h-6 bg-zinc-900/20 rounded-sm w-32"></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                        <div className="space-y-6 pb-20">
                            {/* Sidebar Summary Area */}
                            <div className="h-[360px] bg-zinc-950/30 border border-zinc-900 rounded-sm"></div>
                            <div className="h-[360px] bg-zinc-950/30 border border-zinc-900 rounded-sm"></div>
                            <div className="h-[200px] bg-zinc-950/30 border border-zinc-900 rounded-sm"></div>
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
                <ProjectInfoBar projectInfo={projectInfo} updateProjectInfo={updateProjectInfo} insulationTypes={insulationTypes} />
                <CapacityTable 
                    calculatedLoads={calculatedLoads} selectedRows={selectedRows} dropTarget={dropTarget} draggedRow={draggedRow}
                    handleDragStart={handleDragStart} handleDragOver={handleDragOver} handleDragLeave={handleDragLeave}
                    handleDrop={handleDrop} handleDragEnd={handleDragEnd} handleContextMenu={handleContextMenu}
                    handleGroupContextMenu={handleGroupContextMenu} handleRowClick={handleRowClick} handleGroupClick={handleGroupClick}
                    handleTRSelection={handleTRSelection} updatePowerLoad={updatePowerLoad} panels={panels}
                    panelsFullData={panelsData}
                    activeDropdownId={activeDropdownId} updateDropdownPosition={updateDropdownPosition} dropdownPos={dropdownPos}
                    panelId={panelId} globalUsedPanelIds={globalUsedPanelIds} addPowerLoad={addPowerLoad}
                />
                <LoadSummary 
                    projectInfo={projectInfo} exportToExcel={exportToExcel} updateProjectInfo={updateProjectInfo}
                    demandFactorSummary={demandFactorSummary} totalLoad={totalLoad} totalCurrentCalc={totalCurrentCalc}
                    mofData={mofData} formatFuseRating={formatFuseRating} mainCtValue={mainCtValue}
                    showExportSaveModal={showExportSaveModal} setShowExportSaveModal={setShowExportSaveModal}
                    performExcelExport={performExcelExport} handleExportSaveConfirm={handleExportSaveConfirm}
                />
                <CapacityContextMenu 
                    contextMenu={contextMenu} closeContextMenu={closeContextMenu} calculatedLoads={calculatedLoads}
                    projectId={projectId} panels={panels} navigate={navigate} handleInsertRow={handleInsertRow}
                    handleCopy={handleCopy} handleCut={handleCut} handlePaste={handlePaste} handleInsertPaste={handleInsertPaste}
                    handleDeleteSelected={handleDeleteSelected} clipboard={clipboard} selectedRows={selectedRows}
                />
            </div>
        </div>
    );
};

export default ElectricalReceivingCapacity;

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Papa from 'papaparse';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, Plus, X, Download, AlertCircle, CheckCircle } from 'lucide-react';
import CB_DATA from '../../data/CB.json';
import { getProject, updateProject, updatePanelName, getRemoteData, setRemoteData, removeRemoteData, savePanelConnections, performBatchSave } from '../../services/projectService';
import projectService from '../../services/projectService';
import { usePanelLookup } from '../../hooks/usePanelLookup';
import { useConnectionSync } from '../../hooks/useConnectionSync';
import useDataStore from '../../store/useDataStore';
import { exportPowerLoadToExcel } from '../../utils/excelExport';

// Import extracted components and utilities
import { CornerBorders } from './ui/TransformerUI';
import { isNameDuplicate, BREAKER_TYPES, getAFValue, STARTING_MULTIPLIER, getVoltageByPhase, getStartupMultiplier } from './utils/transformerHelpers';
import ProjectInfoBar from './sections/ProjectInfoBar';
import FeederTable from './sections/FeederTable';
import LoadSummary from './sections/LoadSummary';
import TransformerContextMenu from './sections/TransformerContextMenu';

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

    // Store snapshots
    const historyRef = useRef([]);
    const historyIndexRef = useRef(-1);

    // Flag to prevent recording state changes caused by undo/redo itself
    const isUndoRedoAction = useRef(false);

    // Records a state snapshot ONLY when explicitly called
    const recordHistory = (loads) => {
        if (isUndoRedoAction.current) {
            isUndoRedoAction.current = false;
            return;
        }

        const currentState = JSON.stringify(loads);

        // Don't record if identical to the current snapshot
        if (historyIndexRef.current >= 0) {
            const head = historyRef.current[historyIndexRef.current];
            if (head && head === currentState) return;
        }

        // Slice out future history if we are overwriting after an Undo (branching)
        const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
        newHistory.push(currentState);

        // Keep only the last 5 steps to save memory
        if (newHistory.length > 5) {
            newHistory.shift();
        } else {
            historyIndexRef.current += 1;
        }

        historyRef.current = newHistory;
    };

    const undo = () => {
        // If we are about to undo from the "tip" of the history, save the CURRENT state first
        if (historyIndexRef.current === historyRef.current.length - 1) {
            const tipState = historyRef.current[historyIndexRef.current];
            const currentStateStr = JSON.stringify(loadsState);

            if (!tipState || tipState !== currentStateStr) {
                historyRef.current.push(currentStateStr);
                if (historyRef.current.length > 5) {
                    historyRef.current.shift();
                } else {
                    historyIndexRef.current += 1;
                }
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

    return {
        powerLoads: loadsState,
        setPowerLoads: setLoadsState,
        recordHistory,
        undo,
        redo
    };
}

const Transformer = () => {
    const { projectId, panelId } = useParams();
    const navigate = useNavigate();

    // KEC Settings State (Integrated from PanelLoad)
    const [kecSettings, setKecSettings] = useState({
        shortCircuitSettings: {
            is: 10,
            tn: 0.1,
            k: 143,
            selectedK: { rowIdx: 0, colIdx: 0 }
        },
        cableCondition: {
            area: 50,
            powerFactor: 0.8,
            efficiency: 1.0,
            i2Type: 'industrial'
        },
        atMiMultiplierType: 'delta2' // Default to delta2 as recently requested
    });

    // ID-based panel lookup hook (reactive to name changes)
    const { getNameById, getIdByName, getParentId, panels, globalUsedPanelIds, isLoaded: lookupLoaded, refresh: refreshPanelLookup } = usePanelLookup(projectId);
    const loadPanel = useDataStore(state => state.loadPanel);
    const getPanelResult = useDataStore(state => state.getPanelResult);
    const panelsData = useDataStore(state => state.panels);
    const results = useDataStore(state => state.results);
    const activeProjectId = useDataStore(state => state.activeProjectId);
    const initProject = useDataStore(state => state.initProject);

    // Fuse Settings for PRD synchronization
    const [fuseSettings, setFuseSettings] = useState({
        '100 ~ 150kVA': 2.0,
        '200 ~ 300kVA': 1.5,
        '350 ~ 450kVA': 1.5,
        '500 ~ 700kVA': 1.5,
        '750 ~ 1000kVA': 1.25,
        '1050 ~ 1600kVA': 1.5
    });

    const [isDataLoaded, setIsDataLoaded] = useState(false);

    // [Active Origin] 사용자가 직접 수정을 발생시켰는지 여부 확인 (다중 탭 자동 저장 충돌 방지)
    const isLocalChangeRef = useRef(false);

    // [Hydration] 데이터 로딩 및 계산 차단 상태
    const [isHydrating, setIsHydrating] = useState(true);
    const [isPending, startTransition] = React.useTransition();

    // [Calculation Results] 반응형 계산 결과 상태
    const [calculationResults, setCalculationResults] = useState({
        calculatedLoads: [],
        demandFactorSummary: { totalKva: 0, totalA: 0, avgPercent: 100 },
        totalLoad: 0,
        mainCtValue: null,
        phaseTotals: { l1: 0, l2: 0, l3: 0, i1: 0, i2: 0, i3: 0, max: 0, maxCurrent: 0, totalCurrent: 0 },
        summaryStats: {
            maxMotorKva: 0, maxMotorKw: 0, maxMotorCircuitNo: '', othersSumKva: 0,
            maxTm: 0, maxAbsoluteTm: 0, maxDelta: 0, maxBetaMethod: ''
        }
    });

    // Source Dropdown Keyboard Nav State
    const [sourceSelectedIndex, setSourceSelectedIndex] = useState(0);
    const [sourceSearchText, setSourceSearchText] = useState('');

    // Track last saved state to prevent false dirty flags
    const lastSavedDataRef = React.useRef(null);
    const [isReadyToCheck, setIsReadyToCheck] = useState(false); // Stabilization flag

    // Helper functions for storage keys
    const getOriginKey = (pId) => pId ? `kelc_panel_data_${pId}` : null;
    const getDraftKey = (pId) => pId ? `kelc_panel_draft_${pId}` : null;

    // Helper to manage dirty list
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

    // Helper to extract core data for comparison
    const getCoreDataString = (info, loads) => {
        const cleanLoad = (l) => ({
            id: String(l.id || ''),
            equipmentName: String(l.equipmentName || ''),
            circuitNo: String(l.circuitNo || ''),
            type: String(l.type || ''),
            phase: String(l.phase || ''),
            startingMethod: String(l.startingMethod || ''),
            startingTime: String(l.startingTime || ''),
            demandFactor: String(l.demandFactor || ''),
            diversityFactor: String(l.diversityFactor || ''),
            connectedPanelId: String(l.connectedPanelId || ''),
            apparentPower: String(l.apparentPower || ''),
            effectivePower: String(l.effectivePower || ''),
            cbType: String(l.cbType || ''),
            cbP: String(l.cbP || ''),
            at: String(l.at || ''),
            ct: String(l.ct || ''),
            capacitor: String(l.capacitor || ''),
            unitSize: String(l.unitSize || ''),
            powerFactor: String(l.powerFactor || ''),
            efficiency: String(l.efficiency || ''),
            fixedDesignCurrent: String(l.fixedDesignCurrent || ''),
            fixedStartingCurrent: String(l.fixedStartingCurrent || ''),
            fixedInrushCurrent: String(l.fixedInrushCurrent || ''),
            method: String(l.method || ''),
            wire: String(l.wire || ''),
            size: String(l.size || ''),
            c: String(l.c || ''),
            phaseLine: String(l.phaseLine || 'L1'),
            l: String(l.l || ''),
            pe: String(l.pe || ''),
            chk: String(l.chk || ''),
            sectionName: String(l.sectionName || ''),
            remarks: String(l.remarks || '')
        });

        const cleanInfo = {
            name: String(info.name || ''),
            panelName: String(info.panelName || ''),
            fromId: String(info.fromId || ''), // Changed from 'from' to 'fromId'
            location: String(info.location || ''),
            phase: String(info.phase || '3Ø-3W'),
            voltage: String(info.voltage || '380V'), // Include voltage in tracking
            installType: String(info.installType || '옥내형'),
            usageType: String(info.usageType || 'OIL'),
            branchDistance: String(info.branchDistance || 30),
            mainCapacity: String(info.mainCapacity || ''),
            mccbAF: String(info.mccbAF || ''),
            mccbAT: String(info.mccbAT || ''),
            mainBreakerType: String(info.mainBreakerType || 'MCCB'),
            panelSize: String(info.panelSize || ''),
            shortCircuitCurrent: String(info.shortCircuitCurrent || ''),
            door: String(info.door || ''),
            box: String(info.box || ''),
            voltageDropLimit: String(info.voltageDropLimit || 3),
            kecMethod: String(info.kecMethod || 'E'),
            wire: String(info.wire || 'FCV'),
            cableSize: String(info.cableSize || ''),
            sourceName: String(info.sourceName || '')
        };

        return JSON.stringify({
            projectInfo: cleanInfo,
            powerLoads: loads.map(cleanLoad)
        });
    };

    // Settings from SettingPage
    const [settings, setSettings] = useState({
        powerFactor: 0.8,
        efficiency: 1.0
    });


    // Load KEC Settings Data
    useEffect(() => {
        const loadKecSettings = () => {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                try {
                    setKecSettings(JSON.parse(saved));
                } catch (e) {
                    console.error("Failed to parse KEC settings", e);
                }
            }
        };
        loadKecSettings();

        const handleStorageChange = (e) => {
            if (e.key === STORAGE_KEY || e.key === 'kelc_settings_update_signal') {
                loadKecSettings();
            }
        };

        const handleCustomUpdate = () => loadKecSettings();

        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('kelc_settings_update_signal', handleCustomUpdate);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('kelc_settings_update_signal', handleCustomUpdate);
        };
    }, []);

    // Load TCC Multiplier Data State
    const [tccMultiplierData, setTccMultiplierData] = useState(null);
    const [transformerSpecs, setTransformerSpecs] = useState([]);

    // Load TCC Multiplier Data
    useEffect(() => {
        const loadTccData = () => {
            const saved = localStorage.getItem('tccMultiplierData');
            if (saved) {
                try {
                    setTccMultiplierData(JSON.parse(saved));
                } catch (e) {
                    console.error("Failed to parse TCC data", e);
                }
            }
        };
        loadTccData();

        loadTccData();

        // [REMOVED] Legacy event listeners replaced by Zustand/BroadcastChannel sync
        // window.addEventListener('storage', handleStorageChange);
        // window.addEventListener('kelc_data_update_signal', handleCustomUpdate);
        // return () => {
        //     window.removeEventListener('storage', handleStorageChange);
        //     window.removeEventListener('kelc_data_update_signal', handleCustomUpdate);
        // };
    }, []);

    // Load Transformer Specs from CSV (1-time mount sync)
    useEffect(() => {
        const loadTransformerSpecs = async () => {
            try {
                const response = await fetch('/db/PRD.csv');
                if (!response.ok) throw new Error('Failed to fetch CSV');
                const csvData = await response.text();
                Papa.parse(csvData, {
                    complete: (results) => {
                        setTransformerSpecs(results.data || []);
                    }
                });
            } catch (e) {
                console.error('Failed to load PRD.csv:', e);
            }
        };
        loadTransformerSpecs();
    }, []);

    // MCC Settings from MCCPage
    const [mccSettings, setMccSettings] = useState({
        betaDirect1P: 6.0,
        betaDirect3PSmall: 9.5,
        betaDirect3PLarge: 8.2,
        betaYD: 7.2,
        betaReactor: 7.7,
        reactorTap: 0.65,
        lambdaInv: 1.2,
        globalK: 1.5,
        globalCT: 1.25,
        tmDOL: 2,
        tmYD: 6,
        tmReactor: 10,
        tmINV: 4
    });
    
    // Load MCC Settings Data
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
        loadMccSettings();

        loadMccSettings();

        // [REMOVED] Legacy event listeners replaced by Zustand/BroadcastChannel sync
        // window.addEventListener('storage', handleUpdate);
        // window.addEventListener('kelc_mcc_settings_updated', handleUpdate);
        // return () => {
        //     window.removeEventListener('storage', handleUpdate);
        //     window.removeEventListener('kelc_mcc_settings_updated', handleUpdate);
        // };
    }, [projectId]);

    // Load Fuse Settings (PRD Synchronization)
    useEffect(() => {
        const loadFuseSettings = async () => {
            const defaultKey = 'kelc_fuse_settings_v2';
            const pId = activeProjectId || projectId;
            const projectKey = pId ? `${defaultKey}_${pId}` : defaultKey;

            try {
                // Try MariaDB first
                const remoteData = await getRemoteData(projectKey);
                if (remoteData) {
                    setFuseSettings(remoteData);
                    return;
                }

                // Fallback to LocalStorage
                const saved = localStorage.getItem(projectKey) || localStorage.getItem(defaultKey);
                if (saved) {
                    setFuseSettings(JSON.parse(saved));
                }
            } catch (e) {
                console.error("Failed to load fuse settings", e);
            }
        };

        loadFuseSettings();

        // [REMOVED] Legacy event listeners replaced by Zustand/BroadcastChannel sync
        // const handleUpdate = () => loadFuseSettings();
        // window.addEventListener('kelc_fuse_settings_updated', handleUpdate);
        // return () => window.removeEventListener('kelc_fuse_settings_updated', handleUpdate);
    }, [activeProjectId, projectId]);

    // Project Info
    const [projectInfo, setProjectInfo] = useState({
        name: '',
        panelName: '',
        fromId: '', // Changed from 'from' to 'fromId' for ID-based storage
        location: '',
        phase: '3Φ4W',
        voltage: '380V',
        mainBreakerType: 'MCCB',
        mccbAT: 400,
        mccbAF: 400,
        usageType: 'OIL',
        installType: '옥내형',
        mainCapacity: '',
        branchDistance: 30,
        wire: 'FCV',
        cableSize: '',
        kecMethod: 'E',
        voltageDropLimit: 3,
        startingVoltageDropLimit: 15,
        shortCircuitCurrent: '',
        demandFactor: 100,
        sourceName: ''
    });

    // Helper to format Fuse Rating (e.g., 30 -> 30A/40kA)
    const formatFuseRating = (val) => {
        if (!val || val === '-') return '-';
        const num = parseInt(val);
        if (isNaN(num)) return val;
        const match = FUSE_RATINGS.find(r => r.a === num);
        return match ? `${match.a}A/${match.ka}kA` : `${num}A`;
    };

    // MOF Data State (Fetched from PRD.csv)
    const [mofData, setMofData] = useState({ 
        pt: '-', ct: '-', ocs: '-', 
        primaryPF: '-', trSidePF: '-', 
        af: '-', icu: '-', kv: '-', am: '-',
        type: 'ACB' 
    });

    // Fetch MOF Data from PRD.csv (Optimized memory-based lookup)
    useEffect(() => {
        const fetchMofData = () => {
            const capacity = projectInfo.mainCapacity;
            if (!capacity || transformerSpecs.length === 0) {
                setMofData({ pt: '-', ct: '-', ocs: '-', primaryPF: '-', trSidePF: '-', af: '-', icu: '-', am: '-', kv: '-', type: 'ACB' });
                return;
            }

            const rows = transformerSpecs;
            const sectionIdx = rows.findIndex(row => 
                row[0]?.toString().includes('POWER SYSTEM STANDARDS BY TRANSFORMER')
            );
            
            if (sectionIdx !== -1) {
                const match = rows.find((row, i) => i > sectionIdx && row[0]?.toString().trim() === capacity.toString().trim());
                
                if (match) {
                    // 1. Initialize base data
                    let baseMof = {
                        pt: match[3] || '-',
                        ct: match[4] || '-',
                        ocs: match[5] || '-',
                        primaryPF: match[2] || '-',
                        trSidePF: match[6] || '-',
                        af: match[12] || '-',
                        icu: match[13] || '-',
                        kv: '690',
                        am: '-',
                        type: 'ACB'
                    };

                    // 2. Fuse Rating Logic
                    const i_n1 = parseFloat(match[1]);
                    if (!isNaN(i_n1)) {
                        let multiplier = 1.4;
                        const kva = parseInt(capacity);
                        if (fuseSettings) {
                            if (kva <= 150) multiplier = fuseSettings['100 ~ 150kVA'] || 2.0;
                            else if (kva <= 300) multiplier = fuseSettings['200 ~ 300kVA'] || 1.5;
                            else if (kva <= 450) multiplier = fuseSettings['350 ~ 450kVA'] || 1.5;
                            else if (kva <= 700) multiplier = fuseSettings['500 ~ 700kVA'] || 1.5;
                            else if (kva <= 1000) multiplier = fuseSettings['750 ~ 1000kVA'] || 1.25;
                            else if (kva <= 1600) multiplier = fuseSettings['1050 ~ 1600kVA'] || 1.5;
                        }
                        const target = i_n1 * multiplier;
                        const bestMatch = FUSE_RATINGS.find(r => r.a >= target) || FUSE_RATINGS[FUSE_RATINGS.length - 1];
                        const formatted = `${bestMatch.a}A/${bestMatch.ka}kA`;
                        baseMof.primaryPF = formatted;
                        baseMof.trSidePF = formatted;
                    }

                    // 3. Breaker Selection Logic (VCB for >= 1000kVA)
                    const kvaValue = Number(capacity);
                    if (kvaValue >= 1000) {
                        const inCurrent = kvaValue / (Math.sqrt(3) * 22.9);
                        const vcbIdx = rows.findIndex(row => row.some(col => String(col).includes('Vacuum') && String(col).includes('Breaker')));
                        if (vcbIdx !== -1) {
                            const vMatch = rows.find((row, i) => {
                                if (i <= vcbIdx + 2) return false;
                                const rated = parseFloat(String(row[0]).replace(/[^0-9.]/g, ''));
                                return !isNaN(rated) && rated > inCurrent;
                            });
                            if (vMatch) {
                                baseMof.type = 'VCB';
                                baseMof.am = String(vMatch[0] || '').trim();
                                baseMof.af = String(vMatch[1] || '').trim();
                                baseMof.icu = String(vMatch[2] || '').trim();
                                baseMof.kv = String(vMatch[3] || '').trim();
                            }
                        }
                    }

                    // 4. ACB Specification Lookup (if type is ACB)
                    if (baseMof.type === 'ACB') {
                        const acbIdx = rows.findIndex(row => row.some(col => String(col).includes('Air Circuit Breaker') || String(col).includes('기중차단기')));
                        if (acbIdx !== -1) {
                            const tAF = parseFloat(String(baseMof.af).replace(/[^0-9.]/g, ''));
                            const tICU = parseFloat(String(baseMof.icu).replace(/[^0-9.]/g, ''));
                            const aMatch = rows.find((row, i) => {
                                if (i <= acbIdx + 2) return false;
                                const rAF = parseFloat(String(row[1]).replace(/[^0-9.]/g, ''));
                                const rICU = parseFloat(String(row[2]).replace(/[^0-9.]/g, ''));
                                return rAF === tAF && rICU === tICU;
                            });
                            if (aMatch) {
                                baseMof.am = String(aMatch[0] || '').trim();
                            }
                        }
                    }

                    setMofData(baseMof);
                } else {
                    setMofData({ pt: '-', ct: '-', ocs: '-', primaryPF: '-', trSidePF: '-', af: '-', icu: '-', am: '-', kv: '-', type: 'ACB' });
                }
            }
        };

        fetchMofData();
    }, [projectInfo.mainCapacity, fuseSettings, transformerSpecs]);

    const [showExportSaveModal, setShowExportSaveModal] = useState(false);

    const exportToExcel = () => {
        setShowExportSaveModal(true);
    };

    const performExcelExport = async () => {
        // [Logic Removed] 을지-계산서는 아직 작업 시작 전이므로 추출 로직을 제거합니다.
        showToast('변압기 을지-계산서 추출 기능은 현재 개발 준비 중입니다.', 'info');
        /* 
        await exportPowerLoadToExcel(
            projectInfo,
            calculatedLoads,
            {
                totalLoad,
                phaseTotals,
                phaseLoad,
                totalCurrent: phaseTotals.totalCurrent,
                mainCT: mainCtValue ? `${mainCtValue}/5A` : '-',
                mainCapacity: projectInfo.mainCapacity || (projectInfo.mccbAF && projectInfo.mccbAT ? `${projectInfo.mccbAF}AF / ${projectInfo.mccbAT}AT` : ''),
                ...summaryStats
            },
            kecSettings
        );
        */
    };

    const handleExportSaveConfirm = async () => {
        setShowExportSaveModal(false);
        window.dispatchEvent(new CustomEvent('kelc_trigger_save', { detail: { panelId } }));

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

    const { powerLoads, setPowerLoads, recordHistory, undo, redo } = usePowerLoadHistory([]);

    // [NEW] Filtered panels list for the Transformer load list (乙紙 - 을지)
    // Only show panels with no existing SOURCE (fromId), or Dashboard/Main panels which are always allowed.
    // Also include panels already registered in this sheet to ensure they appear in the UI.
    const filteredPanelsForSelect = useMemo(() => {
        if (!panels || !lookupLoaded) return [];
        
        // Get currently connected panel IDs in this sheet to ensure they remain visible in the dropdown
        const currentConnectedIds = new Set(
            powerLoads
                .map(l => l.connectedPanelId)
                .filter(Boolean)
        );

        return panels.filter(p => {
            // 1. Exceptions for Dashboards: always allowed
            if (p.id.startsWith('transformer-main-') || p.id.startsWith('panel-feeder-')) {
                return true;
            }
            
            // 2. Already selected in THIS sheet: keep it
            if (currentConnectedIds.has(p.id)) {
                return true;
            }

            // 3. Regular rule: Only show if NO parent (SOURCE) is designated
            const parentId = getParentId(p.id);
            return !parentId;
        });
    }, [panels, lookupLoaded, getParentId, powerLoads]);

    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

    const showToast = (message, type = 'success') => {
        if (toast.show) return;
        setToast({ show: true, message, type });
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
    };

    const [hasChanges, setHasChanges] = useState(false);
    const [saveStatus, setSaveStatus] = useState('');
    const [editingPanelName, setEditingPanelName] = useState('');
    const isProcessingCommit = React.useRef(false);
    const loadingPanelsRef = React.useRef(new Set()); // [NEW] Track in-flight sub-panel loading requests
    const lastSyncedRef = React.useRef(''); // [NEW] Track last synced state to prevent infinite loops
    const latestDataRef = React.useRef(null); // [NEW] 실시간 데이터 참조 (제로-싱크 수신용)

    const [otherPanels, setOtherPanels] = useState([]);
    const [showSourceDropdown, setShowSourceDropdown] = useState(false);
    const sourceDropdownRef = React.useRef(null);

    const [selectedRows, setSelectedRows] = useState([]);
    const [lastSelectedRow, setLastSelectedRow] = useState(null);

    const [draggedRow, setDraggedRow] = useState(null);
    const [dropTarget, setDropTarget] = useState(null);

    const [contextMenu, setContextMenu] = useState({ show: false, x: 0, y: 0, loadId: null });
    const [activeDropdownId, setActiveDropdownId] = useState(null);
    const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

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

    useEffect(() => {
        if (!activeDropdownId) return;
        const handleScroll = (e) => {
            if (e.target === window || e.target === document || e.target.closest('.dropdown-viewport')) return;
            setActiveDropdownId(null);
        };
        window.addEventListener('scroll', handleScroll, true);
        return () => window.removeEventListener('scroll', handleScroll, true);
    }, [activeDropdownId]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (activeDropdownId && !e.target.closest('.SearchablePanelCell-container') && !e.target.closest('.fixed.z-\\[9999\\]')) {
                setActiveDropdownId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [activeDropdownId]);

    const [clipboard, setClipboardState] = useState(() => {
        try {
            const saved = localStorage.getItem('powerLoadClipboard');
            return saved ? JSON.parse(saved) : { loads: [], mode: null };
        } catch (e) {
            console.error('Failed to parse clipboard from localStorage:', e);
            return { loads: [], mode: null };
        }
    });

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.ctrlKey) {
                if (e.key === 'z') {
                    if (e.shiftKey) {
                        e.preventDefault();
                        if (redo()) {
                            showToast("다시 실행", "success");
                            markAsDirty(panelId);
                        }
                    } else {
                        e.preventDefault();
                        if (undo()) {
                            showToast("이전으로 되돌리기", "success");
                            markAsDirty(panelId);
                        }
                    }
                } else if (e.key === 'y') {
                    e.preventDefault();
                    if (redo()) {
                        showToast("다시 실행", "success");
                        markAsDirty(panelId);
                    }
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [undo, redo, panelId]);

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
                // 1. 메모리 업데이트 (Zustand)
                useDataStore.setState({ panelConnections: currentConnections });

                // 2. 서버 DB(호적) 선행 정리 - 현재 부모(panelId)에 남은 자식들만 필터링하여 즉시 저장
                const remainingConnections = Object.entries(currentConnections)
                    .filter(([childId, parentId]) => parentId === panelId)
                    .map(([childId]) => ({ child_panel_id: childId }));

                await savePanelConnections(projectId, panelId, remainingConnections);

                // 3. 방송 송출 (DB 정리가 끝난 후 안심하고 방송)
                const channel = new BroadcastChannel('KECLC_CONNECTION_SYNC');
                channel.postMessage({ type: 'CONNECTION_CHANGED', projectId });
                channel.close();

                console.log(`[Zero-Sync] Connections cleaned up for: ${panelIds.join(', ')}`);
            }
        } catch (e) {
            console.error('[Zero-Sync] Connection cleanup failed:', e);
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

            console.log(`[Zero-Sync] Connected child ${childId} to ${panelId}`);
        } catch (e) {
            console.error('[Zero-Sync] Connection failed:', e);
        }
    }, [projectId, panelId]);

    // [NEW] Keyboard Shortcuts for Row Operations (Ctrl+C, Ctrl+X, Ctrl+V, Del)
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
                } else if (e.key === 'Delete' || e.key === 'Backspace') {
                    return;
                } else if (!isControlKey) {
                    return;
                }
            }

            if (selectedRows.length === 0 && !(isControlKey && key === 'v')) return;

            if (isControlKey && key === 'c') {
                e.preventDefault();
                const loadsToCopy = powerLoads.filter(l => selectedRows.includes(l.id));
                setClipboard({ loads: loadsToCopy.map(l => ({ ...l })), mode: 'copy' });
            } else if (isControlKey && key === 'x') {
                e.preventDefault();
                recordHistory(powerLoads);
                const loadsToCut = powerLoads.filter(l => selectedRows.includes(l.id));
                // [CONNECTION SYNC] 잘라내기 시 글로벌 계통도 연결 해제
                const connectedIds = loadsToCut.map(l => l.connectedPanelId).filter(Boolean);
                disconnectPanels(connectedIds);
                
                setClipboard({ loads: loadsToCut.map(l => ({ ...l })), mode: 'cut' });
                setPowerLoads(powerLoads.filter(l => !selectedRows.includes(l.id)));
                setHasChanges(true);
                setSelectedRows([]);
            } else if (isControlKey && key === 'v') {
                e.preventDefault();
                if (clipboard.loads.length === 0) return;
                recordHistory(powerLoads);
                const foundIdx = lastSelectedRow ? powerLoads.findIndex(l => l.id === lastSelectedRow) : -1;
                const targetIdx = foundIdx !== -1 ? foundIdx : powerLoads.length - 1;
                const newLoads = clipboard.loads.map(l => ({ ...l, id: Date.now() + Math.random() }));
                const updatedLoads = [...powerLoads];

                for (let i = 0; i < newLoads.length; i++) {
                    const currentTargetIdx = targetIdx + i;
                    if (currentTargetIdx >= 0 && currentTargetIdx < updatedLoads.length) {
                        updatedLoads[currentTargetIdx] = { ...newLoads[i], id: updatedLoads[currentTargetIdx].id };
                    } else {
                        updatedLoads.push(newLoads[i]);
                    }
                }

                setPowerLoads(updatedLoads);
                setHasChanges(true);
                if (clipboard.mode === 'cut') {
                    const sourceIds = clipboard.loads.map(l => l.id);
                    setPowerLoads(prev => prev.filter(l => !sourceIds.includes(l.id)));
                    setClipboard({ loads: [], mode: null });
                }
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                recordHistory(powerLoads);
                const loadsToDelete = powerLoads.filter(l => selectedRows.includes(l.id));
                // [CONNECTION SYNC] 삭제 시 글로벌 계통도 연결 해제
                const connectedIds = loadsToDelete.map(l => l.connectedPanelId).filter(Boolean);
                disconnectPanels(connectedIds);

                setPowerLoads(powerLoads.filter(l => !selectedRows.includes(l.id)));
                setHasChanges(true);
                setSelectedRows([]);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedRows, powerLoads, clipboard, lastSelectedRow, panelId]);

    const setClipboard = (newClipboard) => {
        setClipboardState(newClipboard);
        try {
            localStorage.setItem('powerLoadClipboard', JSON.stringify(newClipboard));
        } catch (e) {
            console.error('Failed to save clipboard to localStorage:', e);
        }
    };

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

    const closeContextMenu = () => setContextMenu({ show: false, x: 0, y: 0, loadId: null });

    const handleCopy = () => {
        const loadsToCopy = powerLoads.filter(l => selectedRows.includes(l.id));
        setClipboard({ loads: loadsToCopy.map(l => ({ ...l })), mode: 'copy' });
        closeContextMenu();
    };

    const handleCut = () => {
        recordHistory(powerLoads);
        const loadsToCut = powerLoads.filter(l => selectedRows.includes(l.id));
        // [CONNECTION SYNC] 글로벌 계통도 연결 해제
        const connectedIds = loadsToCut.map(l => l.connectedPanelId).filter(Boolean);
        disconnectPanels(connectedIds);

        setClipboard({ loads: loadsToCut.map(l => ({ ...l })), mode: 'cut' });
        setPowerLoads(powerLoads.filter(l => !selectedRows.includes(l.id)));
        setHasChanges(true);
        setSelectedRows([]);
        closeContextMenu();
        useDataStore.getState().setSyncStatus('local', 'saved');
    };

    const handlePaste = () => {
        if (clipboard.loads.length === 0) return;
        isLocalChangeRef.current = true;
        recordHistory(powerLoads);
        const targetIdx = contextMenu.loadId ? powerLoads.findIndex(l => l.id === contextMenu.loadId) : powerLoads.length;
        const newLoads = clipboard.loads.map(l => ({ ...l, id: Date.now() + Math.random() }));
        const updatedLoads = [...powerLoads];
        for (let i = 0; i < newLoads.length; i++) {
            const currentIdx = targetIdx + i;
            if (currentIdx < updatedLoads.length) {
                // [CONNECTION SYNC] 덮어쓰기 전 기존 연결 해제
                const oldRow = updatedLoads[currentIdx];
                if (oldRow.connectedPanelId && oldRow.connectedPanelId !== newLoads[i].connectedPanelId) {
                    disconnectPanels([oldRow.connectedPanelId]);
                }
                updatedLoads[currentIdx] = { ...newLoads[i], id: updatedLoads[currentIdx].id };
            } else {
                updatedLoads.push(newLoads[i]);
            }
        }
        setPowerLoads(updatedLoads);
        setHasChanges(true);
        if (clipboard.mode === 'cut') {
            const sourceIds = clipboard.loads.map(l => l.id);
            setPowerLoads(prev => prev.filter(l => !sourceIds.includes(l.id)));
            setClipboard({ loads: [], mode: null });
        }
        closeContextMenu();
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
        setHasChanges(true);
        if (clipboard.mode === 'cut') {
            const sourceIds = clipboard.loads.map(l => l.id);
            setPowerLoads(prev => prev.filter(l => !sourceIds.includes(l.id)));
            setClipboard({ loads: [], mode: null });
        }
        closeContextMenu();
        useDataStore.getState().setSyncStatus('local', 'saved');
    };

    const handleInsertRow = () => {
        isLocalChangeRef.current = true;
        recordHistory(powerLoads);
        const targetIdx = contextMenu.loadId ? powerLoads.findIndex(l => l.id === contextMenu.loadId) : powerLoads.length - 1;
        const refLoad = powerLoads[targetIdx];
        const newLoad = {
            id: Date.now(),
            sectionName: refLoad?.sectionName || '',
            equipmentName: '',
            circuitNo: '',
            type: '',
            phase: '',
            startingMethod: '',
            startingTime: '',
            apparentPower: '',
            effectivePower: '',
            cbType: '',
            cbP: '',
            at: '',
            ct: '',
            capacitor: '',
            unitSize: '',
            powerFactor: '',
            efficiency: '',
            fixedDesignCurrent: '',
            fixedStartingCurrent: '',
            fixedInrushCurrent: '',
            method: '',
            wire: '',
            size: '',
            chk: 'Ok'
        };
        const updatedLoads = [...powerLoads];
        updatedLoads.splice(targetIdx + 1, 0, newLoad);
        setPowerLoads(updatedLoads);
        setHasChanges(true);
        closeContextMenu();
        
        // [Active Origin]
        isLocalChangeRef.current = true;

        // [ZERO SYNC] 🟢
        useDataStore.getState().setSyncStatus('local', 'saved');
    };

    const handleDeleteSelected = () => {
        recordHistory(powerLoads);
        setPowerLoads(powerLoads.filter(l => !selectedRows.includes(l.id)));
        setHasChanges(true);
        setSelectedRows([]);
        closeContextMenu();
        
        // [Active Origin]
        isLocalChangeRef.current = true;

        // [ZERO SYNC] 🟢
        useDataStore.getState().setSyncStatus('local', 'saved');
    };

    const handleDragStart = (e, loadId) => {
        setDraggedRow(loadId);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e, loadId) => {
        e.preventDefault();
        if (loadId !== draggedRow) {
            const rect = e.currentTarget.getBoundingClientRect();
            const y = e.clientY - rect.top;
            const position = y < rect.height / 2 ? 'above' : 'below';
            setDropTarget({ id: loadId, position });
        }
    };

    const handleDragLeave = () => {
        setDropTarget(null);
    };

    const handleDrop = (e, targetId) => {
        e.preventDefault();
        if (!draggedRow || draggedRow === targetId) {
            setDraggedRow(null);
            setDropTarget(null);
            return;
        }
        recordHistory(powerLoads);
        const position = dropTarget?.position || 'above';
        const draggedItems = selectedRows.includes(draggedRow) ? selectedRows : [draggedRow];
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
        setPowerLoads(newLoads);
        setHasChanges(true);
        setDraggedRow(null);
        setDropTarget(null);
        
        // [Active Origin]
        isLocalChangeRef.current = true;
        
        // [ZERO SYNC] 🟢
        useDataStore.getState().setSyncStatus('local', 'saved');
    };

    const handleDragEnd = () => {
        setDraggedRow(null);
        setDropTarget(null);
    };

    useEffect(() => {
        const loadRemoteSettings = async () => {
            if (!projectId) return;
            try {
                const defaultKey = 'kelc_setting_data';
                const projectKey = projectId ? `${defaultKey}_${projectId}` : defaultKey;
                
                let perProjectSettings = await getRemoteData(projectKey, projectId);
                if (!perProjectSettings && projectKey !== defaultKey) {
                    perProjectSettings = await getRemoteData(defaultKey, projectId);
                }

                if (perProjectSettings) {
                    if (perProjectSettings.cableCondition) {
                        setSettings({
                            powerFactor: perProjectSettings.cableCondition.powerFactor || 0.8,
                            efficiency: perProjectSettings.cableCondition.efficiency || 1.0,
                            area: perProjectSettings.cableCondition.area || 50
                        });
                    }
                    setKecSettings(prev => ({ ...prev, ...perProjectSettings }));
                }
                const defaultMccKey = 'kelc_mcc_settings';
                const projectMccKey = projectId ? `${defaultMccKey}_${projectId}` : defaultMccKey;
                let perProjectMcc = await getRemoteData(projectMccKey, projectId);
                if (!perProjectMcc && projectMccKey !== defaultMccKey) {
                    perProjectMcc = await getRemoteData(defaultMccKey, projectId);
                }
                if (perProjectMcc) {
                    setMccSettings(prev => ({ ...prev, ...perProjectMcc }));
                }
                // Load TCC Multiplier Data (saved by TCCMultiplierModal)
                const projectTccKey = projectId ? `kelc_tcc_multiplier_${projectId}` : 'tcc_multiplier_data';
                let perProjectTcc = await getRemoteData(projectTccKey, projectId);
                
                // Fallback for migration
                if (!perProjectTcc) {
                    perProjectTcc = await getRemoteData('tcc_multiplier_data', projectId);
                }

                if (perProjectTcc) {
                    setTccMultiplierData(perProjectTcc);
                    localStorage.setItem(`kelc_tcc_multiplier_${projectId}`, JSON.stringify(perProjectTcc));
                    localStorage.setItem('tccMultiplierData', JSON.stringify(perProjectTcc));
                }
            } catch (e) { console.error(e); }
        };

        const loadTccSettings = async () => {
            try {
                const projectTccKey = projectId ? `kelc_tcc_multiplier_${projectId}` : 'tcc_multiplier_data';
                let perProjectTcc = await getRemoteData(projectTccKey, projectId);
                
                if (!perProjectTcc) {
                    perProjectTcc = await getRemoteData('tcc_multiplier_data', projectId);
                }

                if (perProjectTcc) {
                    setTccMultiplierData(perProjectTcc);
                    localStorage.setItem(`kelc_tcc_multiplier_${projectId}`, JSON.stringify(perProjectTcc));
                }
            } catch (e) {
                console.error("Failed to reload TCC settings in Transformer:", e);
            }
        };

        loadRemoteSettings();

        window.addEventListener('kelc_tcc_multiplier_updated', loadTccSettings);
        return () => {
            window.removeEventListener('kelc_tcc_multiplier_updated', loadTccSettings);
        };
    }, [projectId]);

    useEffect(() => {
        const loadInitialData = async () => {
            if (!projectId || !panelId) return;
            setIsReadyToCheck(false);
            setIsHydrating(true); // [Blocking Hydration]
            try {
                const originKey = getOriginKey(panelId);
                const draftKey = getDraftKey(panelId);
                const cacheKey = `kelc_panel_cache_${panelId}`;

                let loadedInfo = {
                    name: '',
                    panelName: '',
                    fromId: '',
                    location: '',
                    phase: '3Φ-3W',
                    voltage: '380V',
                    mainBreakerType: 'MCCB',
                    mccbAT: '',
                    mccbAF: '',
                    usageType: 'OIL',
                    installType: '옥내형',
                    mainCapacity: '',
                    branchDistance: 30,
                    wire: 'FCV',
                    cableSize: '',
                    kecMethod: 'E',
                    demandFactor: 100
                };
                let loadedLoads = [];
                let hasLocalSource = false;

                const loadData = (data) => {
                    if (!data) return false;
                    if (data.projectInfo) loadedInfo = { ...loadedInfo, ...data.projectInfo };
                    if (data.powerLoads) loadedLoads = data.powerLoads;
                    return true;
                };

                // [Tier 0] Zustand Store (Memory-First)
                const storeData = useDataStore.getState().panels[panelId];
                if (storeData && (storeData.projectInfo || storeData.powerLoads)) {
                    if (loadData(storeData)) {
                        hasLocalSource = true;
                    }
                }

                if (!hasLocalSource) {
                    // [Tier 1] LocalStorage Cache
                    const cacheKey = `kelc_panel_cache_${panelId}`;
                    const cached = localStorage.getItem(cacheKey);
                    let cachedData = null;
                    if (cached) {
                        try {
                            cachedData = JSON.parse(cached);
                        } catch (e) { console.warn("Cache parse failed:", e); }
                    }

                    // [Status-Based Hydration] 로컬 캐시가 DIRTY/LOCAL_SAVED면 서버 조회 없이 신뢰
                    if (cachedData && (cachedData.status === 'DIRTY' || cachedData.status === 'LOCAL_SAVED')) {
                        console.log(`[Transformer Hydration] Local-First: Trusting Local Cache (${cachedData.status})`);
                        loadData(cachedData);
                    } else {
                        // [Tier 2] Remote Data 조회 (Draft -> Origin)
                        const draftKey = getDraftKey(panelId);
                        const originKey = getOriginKey(panelId);
                        const draftData = await getRemoteData(draftKey);
                        
                        if (draftData) {
                            loadData(draftData);
                        } else {
                            const originData = await getRemoteData(originKey);
                            if (originData) {
                                loadData(originData);
                            } else if (cachedData) {
                                // 서버에 없고 로컬에만 데이터가 있는 경우
                                loadData(cachedData);
                            }
                        }
                    }
                }

                // [Blocking Hydration] 자식 패널 일괄 로드
                const childPanelIds = loadedLoads
                    .filter(l => l.connectedPanelId)
                    .map(l => String(l.connectedPanelId));
                
                if (childPanelIds.length > 0) {
                    await Promise.all(childPanelIds.map(id => loadPanel(id)));
                }

                // 프로젝트 메타데이터 보완
                const project = await getProject(projectId);
                if (project) {
                    if (project.name) loadedInfo.name = project.name;
                    const findPanel = (items) => {
                        for (const item of items) {
                            if (item.id === panelId) return item.name;
                            if (item.children) {
                                const res = findPanel(item.children);
                                if (res) return res;
                            }
                        }
                        return null;
                    };
                    const treePanelName = project.calculators ? findPanel(project.calculators) : null;
                    if (treePanelName) loadedInfo.panelName = treePanelName;
                }

                setProjectInfo(loadedInfo);
                setEditingPanelName(loadedInfo.panelName);
                setPowerLoads(loadedLoads.map(l => ({ ...l, chk: l.chk || 'Ok' })));

                // [SSOT Sync] 전역 스토어에도 즉각 반영하여 헤더 및 타 컴포넌트와 동기화
                useDataStore.getState().updatePanelData(panelId, {
                    projectInfo: loadedInfo,
                    powerLoads: loadedLoads
                });

                lastSavedDataRef.current = getCoreDataString(loadedInfo, loadedLoads);
                
                // [Blocking Hydration] 완료 신호
                setIsDataLoaded(true);
                setIsHydrating(false);

                // [FIX] Sync Project Context for Header & Store
                initProject(projectId);
                const projectCtx = {
                    projectId: projectId,
                    projectName: loadedInfo.name || '',
                    panelName: loadedInfo.panelName
                };
                localStorage.setItem('kelc_project_info', JSON.stringify(projectCtx));
                localStorage.setItem('kelc_active_project_id', projectId);
                
                if (project?.calculators) {
                    const allPanels = [];
                    const extractPanels = (items) => {
                        if (!items) return;
                        items.forEach(item => {
                            if (item.id && item.name && item.id !== panelId) allPanels.push({ id: item.id, name: item.name });
                            if (item.children) extractPanels(item.children);
                        });
                    };
                    extractPanels(project.calculators);
                    setOtherPanels(allPanels);
                }
                setTimeout(() => setIsReadyToCheck(true), 1000);
            } catch (e) {
                console.error('Failed to load data:', e);
                setIsDataLoaded(true);
                setIsHydrating(false);
            }
        };
        loadInitialData();
    }, [projectId, panelId]);
    const updateProjectInfo = (key, value) => {
        setProjectInfo(prev => ({ ...prev, [key]: value }));
        setHasChanges(true);
        markAsDirty(panelId);
        
        // [Active Origin]
        isLocalChangeRef.current = true;
        
        // [ZERO SYNC] 즉시 로컬 저장 상태 표시 (🟢)
        useDataStore.getState().setSyncStatus('local', 'saved');

        // [OPTIMISTIC SOURCE UPDATE] 
        // SOURCE(fromId)가 변경될 경우, 서버 응답을 기다리지 않고 Zustand 전역 스토어의 
        // panelConnections 맵을 즉시 갱신하여 0.1초 내에 리액티브 반응을 유도합니다.
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
    };

    const broadcastListUpdate = useDataStore(state => state.broadcastListUpdate);
    const handlePanelNameCommit = async () => {
        if (isProcessingCommit.current) return;
        const trimmedName = editingPanelName.trim();
        if (!trimmedName || trimmedName === projectInfo.panelName) {
            setEditingPanelName(projectInfo.panelName);
            return;
        }
        const project = await getProject(projectId);
        if (isNameDuplicate(project, trimmedName, panelId)) {
            showToast('이미 사용 중인 이름입니다.', 'error');
            setEditingPanelName(projectInfo.panelName);
            return;
        }
        isProcessingCommit.current = true;
        try {
            const result = await updatePanelName(projectId, panelId, trimmedName);
            if (result) {
                setProjectInfo(prev => ({ ...prev, panelName: trimmedName }));
                
                // [Active Origin]
                isLocalChangeRef.current = true;

                // [ZERO SYNC] 즉시 전역 스토어 반영 및 브로드캐스팅
                syncPanel(panelId, 
                    { projectInfo: { ...projectInfo, panelName: trimmedName }, powerLoads },
                    { totalLoad, phaseTotals, summaryStats, mainCtValue, calculatedLoads }
                );

                // Header 및 사이드바 목록 갱신 트리거
                broadcastListUpdate();

                window.dispatchEvent(new Event('kelc_project_info_updated'));
                showToast('이름이 성공적으로 변경되었습니다.');

                // [ZERO SYNC] 이름 변경도 즉시 로컬 저장 상태 표시 (🟢)
                useDataStore.getState().setSyncStatus('local', 'saved');
            }
        } catch (e) {
            console.error('Failed to update panel name:', e);
            setEditingPanelName(projectInfo.panelName);
        } finally {
            isProcessingCommit.current = false;
        }
    };

    const updatePowerLoad = (id, field, value, selectedPanel = null) => {
        updatePowerLoadFields([id], { [field]: value }, selectedPanel);
    };

    const updatePowerLoadFields = (ids, fieldValues, selectedPanel = null) => {
        isLocalChangeRef.current = true;
        recordHistory(powerLoads);
        setPowerLoads(prev => prev.map(load => {
            if (!ids.includes(load.id)) return load;
            let updatedLoad = { ...load, ...fieldValues };

            if (fieldValues.equipmentName !== undefined && selectedPanel) {
                updatedLoad.connectedPanelId = selectedPanel.id;
            } else if (fieldValues.equipmentName !== undefined && !fieldValues.equipmentName) {
                updatedLoad.connectedPanelId = null;
                updatedLoad.phase = '';
                updatedLoad.voltage = '';
                updatedLoad.apparentPower = '';
                updatedLoad.demandFactor = '';
                updatedLoad.diversityFactor = '';
                updatedLoad.cbP = '';
                updatedLoad.at = '';
                updatedLoad.shortCircuitCurrent = '';
                updatedLoad.af = '';
            }

            if (fieldValues.phase !== undefined) {
                const cleanPh = String(fieldValues.phase || '').replace(/[-\s]/g, '').replace(/Ø/g, 'Φ').toUpperCase();
                if (cleanPh.includes('1Φ2W')) {
                    updatedLoad.cbP = '2';
                    updatedLoad.phaseLine = updatedLoad.phaseLine || 'L1';
                }
                else if (cleanPh.includes('3Φ3W')) updatedLoad.cbP = '3';
                else if (cleanPh.includes('3Φ4W')) updatedLoad.cbP = '4';
            }

            if (fieldValues.type !== undefined) {
                const value = fieldValues.type;
                if (value === 'LOAD') {
                    updatedLoad.fixedDesignCurrent = '';
                    updatedLoad.fixedStartingCurrent = '';
                    updatedLoad.fixedInrushCurrent = '';
                    updatedLoad.unitSize = '';
                    updatedLoad.capacitor = '';
                    updatedLoad.efficiency = '';
                    updatedLoad.powerFactor = '';
                    updatedLoad.startingTime = '';
                    updatedLoad.ct = '';
                    updatedLoad.startingMethod = '-';
                } else if (value === 'MOTOR' || value === 'PUMP') {
                    if (load.apparentPower && !load.effectivePower) {
                        updatedLoad.effectivePower = load.apparentPower;
                    }
                    updatedLoad.apparentPower = '';
                }
            }

            return updatedLoad;
        }));
        setHasChanges(true);
        markAsDirty(panelId);
        
        // [Active Origin]
        isLocalChangeRef.current = true;

        // [ZERO SYNC] 즉시 로컬 저장 상태 표시 (🟢)
        useDataStore.getState().setSyncStatus('local', 'saved');

        if (fieldValues.equipmentName !== undefined) {
            const value = fieldValues.equipmentName;
            const panel = selectedPanel || (panels && panels.find(p => p.name === value));
            if (panel && ids.length === 1) {
                // [CONNECTION SYNC] 새로운 연결 수립
                connectPanel(panel.id);
                fetchAndApplyPanelData(ids[0], panel);
            } else if (!value && ids.length === 1) {
                // [CONNECTION SYNC] 연결 해제 (이름 지움)
                // 기존에 연결되어 있던 ID를 찾아 해제해야 함
                const oldRow = powerLoads.find(l => l.id === ids[0]);
                if (oldRow?.connectedPanelId) {
                    disconnectPanels([oldRow.connectedPanelId]);
                }
            }
        }
    };

    const fetchAndApplyPanelData = async (loadId, selectedPanel) => {
        try {
            let data = await loadPanel(selectedPanel.id);
            let panelIdToFetchResult = selectedPanel.id;

            if ((!data || !data.projectInfo) && selectedPanel.children && selectedPanel.children.length > 0) {
                const firstChild = selectedPanel.children[0];
                data = await loadPanel(firstChild.id);
                panelIdToFetchResult = firstChild.id;
            }

            if (!data) return;

            const result = getPanelResult(panelIdToFetchResult);

            const realTimeLoad = result?.totalLoad;
            const cachedLoad = data?.projectInfo?.cachedTotalLoad;
            const manualCalculatedLoad = calculateTotalLoadFromData(data);

            const finalTotalVA = (realTimeLoad !== undefined && realTimeLoad !== null) ? realTimeLoad :
                (cachedLoad !== undefined && cachedLoad !== null) ? cachedLoad :
                    manualCalculatedLoad;

            const totalLoadKVA = (Number(finalTotalVA) / 1000).toFixed(2);

            const getP = (ph) => {
                const cleanPh = String(ph || '').replace(/[-\s]/g, '').replace(/Ø/g, 'Φ').toUpperCase();
                if (cleanPh.includes('1Φ')) return 2;
                if (cleanPh.includes('3Φ3W')) return 3;
                if (cleanPh.includes('3Φ4W')) return 4;
                return 4;
            };

            const phase = data.projectInfo?.phase || '3Ø-4W';
            const voltage = data.projectInfo?.voltage || (phase.includes('1Ø') ? '220V' : '380V');
            const pValue = getP(phase);

            setPowerLoads(current => current.map(load => {
                if (load.id === loadId) {
                    return {
                        ...load,
                        connectedPanelId: panelIdToFetchResult,
                        phase: phase,
                        voltage: voltage,
                        location: data.projectInfo?.location || '',
                        apparentPower: totalLoadKVA,
                        demandFactor: data.projectInfo?.demandFactor || '100',
                        cbP: String(pValue),
                        cbType: data.projectInfo?.mainBreakerType || 'MCCB',
                        at: data.projectInfo?.mccbAT || '',
                        shortCircuitCurrent: data.projectInfo?.shortCircuitCurrent || '',
                        diversityFactor: load.diversityFactor || '1.0'
                    };
                }
                return load;
            }));
            markAsDirty(panelId);


        } catch (e) {
            console.error('Failed to fetch and apply panel data:', e);
        }
    };

    const addPowerLoad = () => {
        recordHistory(powerLoads);
        const lastLoad = powerLoads[powerLoads.length - 1];
        const newLoad = {
            id: Date.now(),
            sectionName: lastLoad?.sectionName || '',
            equipmentName: '',
            circuitNo: '',
            type: '',
            phase: '',
            voltage: '',
            startingMethod: '',
            apparentPower: '',
            effectivePower: '',
            cbType: '',
            cbP: '',
            at: '',
            ct: '',
            capacitor: '',
            powerFactor: '',
            efficiency: '',
            diversityFactor: '1.0',
            remarks: '',
            chk: 'Ok'
        };
        setPowerLoads(prev => [...prev, newLoad]);
        setHasChanges(true);
        markAsDirty(panelId);
        
        // [Active Origin]
        isLocalChangeRef.current = true;

        // [ZERO SYNC] 🟢
        useDataStore.getState().setSyncStatus('local', 'saved');
    };

    const calculateTotalLoadFromData = (data) => {
        if (!data) return 0;
        let totalVA = 0;
        if (data.leftCircuits || data.rightCircuits) {
            ['leftCircuits', 'rightCircuits'].forEach(side => {
                if (data[side]) {
                    data[side].forEach(c => {
                        if (c.power !== undefined && c.power !== "") totalVA += Number(c.power);
                        else if (c.loads) c.loads.forEach(load => totalVA += (Number(load.qty) || 0) * (Number(load.va) || 0));
                    });
                }
            });
        } else if (data.powerLoads) {
            data.powerLoads.forEach(load => {
                if (load.type === 'SPARE') return;
                if (load.type === 'MOTOR' || load.type === 'PUMP') {
                    const kw = Number(load.effectivePower) || 0;
                    const pf = Number(load.powerFactor) || 0.85;
                    const eff = Number(load.efficiency) || 0.9;
                    if (pf > 0 && eff > 0) totalVA += (kw / (pf * eff)) * 1000;
                } else totalVA += (Number(load.apparentPower) || 0) * 1000;
            });
        }
        return Math.round(totalVA);
    };

    // [REACTIVE CALCULATION] Zustand Store 변경 시 즉각 재계산 (useTransition 적용)
    useEffect(() => {
        if (!isDataLoaded) return;

        startTransition(() => {
            // 1. calculatedLoads 계산
            const newCalculatedLoads = powerLoads.map((load, idx) => {
                let currentLoad = { ...load };
                // [REACTIVE NAME] 연결된 패널의 최신 이름을 실시간 반영 (Zero-Sync)
                if (load.connectedPanelId) {
                    currentLoad.equipmentName = getNameById(load.connectedPanelId) || currentLoad.equipmentName;
                }
                
                if (load.connectedPanelId) {
                    const subPanel = panelsData[load.connectedPanelId];
                    const subResult = results[load.connectedPanelId];
                    if (subPanel?.projectInfo) {
                        currentLoad.phase = subPanel.projectInfo.phase || currentLoad.phase;
                        currentLoad.voltage = subPanel.projectInfo.voltage || currentLoad.voltage;
                        currentLoad.location = subPanel.projectInfo.location || currentLoad.location;
                        currentLoad.at = subPanel.projectInfo.mccbAT || currentLoad.at;
                        currentLoad.cbType = subPanel.projectInfo.mainBreakerType || currentLoad.cbType || 'MCCB';
                        currentLoad.demandFactor = subPanel.projectInfo.demandFactor || currentLoad.demandFactor || '100';
                        const ph = String(currentLoad.phase || '');
                        const cleanPh = ph.replace(/[-\s]/g, '').replace(/Ø/g, 'Φ').toUpperCase();
                        if (cleanPh.includes('1Φ')) currentLoad.cbP = '2';
                        else if (cleanPh.includes('3Φ3W')) currentLoad.cbP = '3';
                        else if (cleanPh.includes('3Φ4W')) currentLoad.cbP = '4';
                        currentLoad.subPanelBreakerType = subPanel.projectInfo.mainBreakerType || currentLoad.cbType || 'MCCB';

                        // kA (단락용량) 연동
                        const bType = subPanel.projectInfo.mainBreakerType || 'MCCB';
                        const bAF = subPanel.projectInfo.mccbAF || '';
                        const bAT = subPanel.projectInfo.mccbAT || '';
                        if (bType && bAF && bAT) {
                            const afNum = Number(bAF);
                            const atNum = Number(bAT);
                            const match = CB_DATA.find(row => 
                                row[0] === bType && 
                                Number(row[5]) === afNum && 
                                Number(row[4]) === atNum
                            );
                            currentLoad.shortCircuitCurrent = match ? String(match[6]) : (subPanel.projectInfo.shortCircuitCurrent || '-');
                        }
                    }
                    const finalTotalVA = subResult?.totalLoad ?? subPanel?.projectInfo?.cachedTotalLoad ?? calculateTotalLoadFromData(subPanel);
                    if (finalTotalVA !== undefined) currentLoad.apparentPower = (Number(finalTotalVA) / 1000).toFixed(2);
                    const v = Number(currentLoad.voltage?.replace('V', '')) || 380;
                    const is3Ph = currentLoad.phase?.includes('3Φ') || currentLoad.phase?.includes('3Ø');
                    if (finalTotalVA > 0) currentLoad.subPanelTotalCurrent = (finalTotalVA / (is3Ph ? (v * 1.7320508) : v)).toFixed(2);
                    else currentLoad.subPanelTotalCurrent = 0;
                }
                const demandFactorValue = Number(currentLoad.demandFactor) || 100;
                const apparentPowerValue = Number(currentLoad.apparentPower) || 0;
                const demandLoadValue = (apparentPowerValue * demandFactorValue) / 100;
                const voltageVal = Number(currentLoad.voltage?.replace('V', '')) || 380;
                const is3Phase = currentLoad.phase?.includes('3Φ') || currentLoad.phase?.includes('3Ø');
                let demandCurrentValue = 0;
                if (demandLoadValue > 0 && voltageVal > 0) demandCurrentValue = (demandLoadValue * 1000) / (is3Phase ? (voltageVal * 1.7320508) : voltageVal);
                const diversityFactor = Number(currentLoad.diversityFactor) || 1.0;
                const compositeDemandPower = (demandLoadValue / diversityFactor).toFixed(2);
                const { af } = getAFValue(currentLoad.cbType, currentLoad.cbP, currentLoad.at);
                return {
                    ...currentLoad,
                    demandLoad: demandLoadValue.toFixed(2),
                    demandCurrent: demandCurrentValue.toFixed(2),
                    compositeDemandPower,
                    af
                };
            });

            // 2. Summary & Totals 계산
            let totalKva = 0;
            let totalA = 0;
            let totalOriginalKva = 0;
            newCalculatedLoads.forEach(l => {
                totalKva += Number(l.compositeDemandPower) || 0;
                totalA += Number(l.demandCurrent) || 0;
                totalOriginalKva += Number(l.apparentPower) || 0;
            });
            const avgPercent = totalOriginalKva > 0 ? (totalKva / totalOriginalKva) * 100 : 100;
            const newTotalLoad = newCalculatedLoads.reduce((sum, l) => sum + (Number(l.apparentPower) || 0), 0);

            // 3. phaseTotals 계산
            let l1 = 0, l2 = 0, l3 = 0;
            let i1 = 0, i2 = 0, i3 = 0;
            newCalculatedLoads.forEach(load => {
                const ib = Number(load.subPanelTotalCurrent) || 0;
                const v = Number(load.voltage?.replace('V', '')) || (load.phase?.includes('1Φ') ? 220 : 380);
                const power = load.phase?.includes('1Φ') ? (ib * v) : (ib * v * Math.sqrt(3));

                if (load.phase?.includes('3Φ')) {
                    const phaseCurrent = (power / 3) / 220;
                    l1 += power / 3; l2 += power / 3; l3 += power / 3;
                    i1 += phaseCurrent; i2 += phaseCurrent; i3 += phaseCurrent;
                } else {
                    const pl = load.phaseLine || 'L1';
                    const current = power / 220;
                    if (pl === 'L1') { l1 += power; i1 += current; }
                    else if (pl === 'L2') { l2 += power; i2 += current; }
                    else if (pl === 'L3') { l3 += power; i3 += current; }
                }
            });

            // 4. mainCtValue 계산
            const capacity = Number(projectInfo.mainCapacity) || 0;
            let newMainCtValue = null;
            if (capacity > 0) {
                const current = (capacity * 1000) / (380 * 1.7320508);
                const target = current * 1.25;
                const ctList = [5, 10, 15, 20, 30, 40, 50, 75, 100, 150, 200, 250, 300, 400, 500, 600, 750, 800, 1000, 1200, 1500, 2000];
                newMainCtValue = ctList.find(ct => ct >= target) || ctList[ctList.length - 1];
            }

            setCalculationResults({
                calculatedLoads: newCalculatedLoads,
                demandFactorSummary: { totalKva, totalA, avgPercent },
                totalLoad: newTotalLoad,
                mainCtValue: newMainCtValue,
                phaseTotals: {
                    l1, l2, l3, i1, i2, i3,
                    max: Math.max(l1, l2, l3),
                    maxCurrent: Math.max(i1, i2, i3),
                    totalCurrent: i1 + i2 + i3
                },
                summaryStats: {
                    maxMotorKva: 0, maxMotorKw: 0, maxMotorCircuitNo: '', othersSumKva: newTotalLoad,
                    maxTm: 0, maxAbsoluteTm: 0, maxDelta: 0, maxBetaMethod: ''
                }
            });
        });
    }, [powerLoads, panelsData, results, kecSettings, projectInfo.mainCapacity, isDataLoaded, getNameById]);

    // [Phase 1] External Sync (BroadcastChannel Support via panelsData)
    // 타 탭에서 수정된 내용을 전역 스토어(panelsData)를 통해 즉시 화면에 반영합니다.
    useEffect(() => {
        const storeData = panelsData[panelId];
        if (!storeData || !isDataLoaded || isLocalChangeRef.current) return;

        const currentDataStr = JSON.stringify({ projectInfo, powerLoads });
        const storeDataStr = JSON.stringify({
            projectInfo: storeData.projectInfo || {},
            powerLoads: storeData.powerLoads || []
        });

        if (currentDataStr !== storeDataStr) {
            console.log(`[ZERO SYNC] External update received for Transformer ${panelId}`);
            if (storeData.projectInfo) {
                setProjectInfo(prev => ({ ...prev, ...storeData.projectInfo }));
                // [PANEL NAME SYNC] 타 탭에서 패널 이름 변경 시 editingPanelName도 동기화
                if (storeData.projectInfo.panelName && storeData.projectInfo.panelName !== editingPanelName) {
                    setEditingPanelName(storeData.projectInfo.panelName);
                }
            }
            if (storeData.powerLoads) setPowerLoads(storeData.powerLoads);
            
            // 전파된 데이터와 동기화하여 에코 방지
            lastSyncedRef.current = JSON.stringify({
                currentData: {
                    projectInfo: storeData.projectInfo || {},
                    powerLoads: storeData.powerLoads || []
                },
                currentResult: results[panelId] || {}
            });
        }
    }, [panelsData, panelId, isDataLoaded]);

    // [Tier 1 -> Tier 2] 실시간 데이터 참조 업데이트
    useEffect(() => {
        latestDataRef.current = {
            projectInfo: { ...projectInfo, cachedTotalLoad: calculationResults.totalLoad * 1000 },
            powerLoads
        };
    }, [projectInfo, powerLoads, calculationResults.totalLoad]);

    const { calculatedLoads, demandFactorSummary, totalLoad, mainCtValue, phaseTotals, summaryStats } = calculationResults;
    const totalCurrentCalc = phaseTotals.totalCurrent;
    const phaseLoad = phaseTotals.max;

    // [CONNECTION SYNC] 부모-자식 연결 즉시 동기화 (projectInfo, powerLoads, totalLoad 선언 후 배치)
    const getFlushPayload = useCallback(() => {
        if (!isDataLoaded || !panelId) return null;
        const draftKey = getDraftKey(panelId);
        const connections = [];
        powerLoads.forEach(l => {
            if (l.connectedPanelId) connections.push({ child_panel_id: String(l.connectedPanelId) });
        });
        return {
            draftSaveFn: () => setRemoteData(projectId, draftKey, {
                projectInfo: { ...projectInfo, cachedTotalLoad: totalLoad * 1000 },
                powerLoads,
                savedAt: new Date().toISOString(),
                status: 'DIRTY',
                isDraft: true
            }),
            connections
        };
    }, [panelId, projectId, isDataLoaded, projectInfo, powerLoads, totalLoad]);
    const { flushNow: flushConnectionsNow } = useConnectionSync(projectId, panelId, getFlushPayload);

    // --- SSOT Sync Layer (Passive Background Sync) ---
    const syncPanel = useDataStore(state => state.syncPanel);
    
    // [NEW] 마운트 시 연결된 하위 계산서 자동 로드 (새로고침 대응)
    useEffect(() => {
        if (isDataLoaded && powerLoads.length > 0) {
            let delay = 0;
            powerLoads.forEach(load => {
                const pId = load.connectedPanelId;
                // Only load if not in store and not already being loaded
                if (pId && !panelsData[pId] && !loadingPanelsRef.current.has(pId)) {
                    loadingPanelsRef.current.add(pId);
                    
                    // Stagger loading (50ms interval) to prevent UI flickering and network burst
                    setTimeout(async () => {
                        try {
                            await loadPanel(pId);
                        } catch (e) {
                            console.error(`[Transformer Sync] Failed to load sub-panel ${pId}:`, e);
                        } finally {
                            loadingPanelsRef.current.delete(pId);
                        }
                    }, delay);
                    
                    delay += 50; 
                }
            });
        }
    }, [isDataLoaded, powerLoads, loadPanel, panelsData]);

    useEffect(() => {
        if (panelId && isDataLoaded) {
            // [FIX] Deep Equality Check using Ref to prevent infinite update loops
            // Only call syncPanel if the actual data or results have changed
            const currentData = { projectInfo, powerLoads };
            const currentResult = { totalLoad, phaseTotals, summaryStats, mainCtValue, calculatedLoads };
            const syncPayload = JSON.stringify({ currentData, currentResult });

            if (lastSyncedRef.current !== syncPayload) {
                // 즉시 상태 변경 알림 (인디케이터 초록색)
                if (isLocalChangeRef.current) {
                    useDataStore.getState().setSyncStatus('local', 'saving');
                }

                lastSyncedRef.current = syncPayload;
                syncPanel(panelId, { 
                    projectInfo, 
                    powerLoads,
                    cachedPhaseTotals: phaseTotals 
                }, currentResult);

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
                }
            }
        }
    }, [panelId, isDataLoaded, projectInfo, powerLoads, totalLoad, phaseTotals, summaryStats, mainCtValue, calculatedLoads, syncPanel]);

    useEffect(() => {
        const handleTriggerSave = async (e) => {
            if (e.detail?.panelId !== panelId) return;
            const originKey = getOriginKey(panelId);
            const draftKey = getDraftKey(panelId);
            try {
                const dataToSave = {
                    projectInfo: { ...projectInfo, cachedTotalLoad: totalLoad * 1000 },
                    powerLoads,
                    savedAt: new Date().toISOString(),
                    status: 'SERVER_SYNCED',
                    isDraft: false
                };
                await setRemoteData(projectId, originKey, dataToSave);
                
                // --- NEW CONNECTION SYNC ---
                const connections = [];
                powerLoads.forEach(l => {
                    if (l.connectedPanelId) {
                        connections.push({ child_panel_id: String(l.connectedPanelId) });
                    }
                });
                await savePanelConnections(projectId, panelId, connections);
                // ---------------------------

                await removeRemoteData(draftKey);
                lastSavedDataRef.current = getCoreDataString(projectInfo, powerLoads);
                markAsClean(panelId);
                
                // [SYNC STATUS] 수동 저장 완료 시 인디케이터 초기화 (⚪)
                useDataStore.getState().setSyncStatus('remote', 'idle');
                
                showToast('저장되었습니다.');
                window.dispatchEvent(new CustomEvent('kelc_save_finished', { detail: { panelId, success: true } }));
            } catch (e) {
                console.error('Failed to save:', e);
                showToast('저장에 실패했습니다.', 'error');
                window.dispatchEvent(new CustomEvent('kelc_save_finished', { detail: { panelId, success: false } }));
            }
        };
        window.addEventListener('kelc_trigger_save', handleTriggerSave);
        return () => window.removeEventListener('kelc_trigger_save', handleTriggerSave);
    }, [projectInfo, powerLoads, projectId, panelId, totalLoad]);

    useEffect(() => {
        if (!isDataLoaded || !isReadyToCheck || !panelId || !projectId) return;
        const timer = setTimeout(async () => {
            // [Active Origin] 실제 수정을 발생시킨 탭(Leader)만 자동 저장을 수행함
            if (!isLocalChangeRef.current) return;
            
            const currentDataStr = getCoreDataString(projectInfo, powerLoads);
            if (currentDataStr !== lastSavedDataRef.current) {
                // [SYNC STATUS] 🟡 SERVER_SYNCING (저장 시작)
                useDataStore.getState().setSyncStatus('remote', 'saving');
                const startTime = Date.now();

                const draftKey = getDraftKey(panelId);
                const dataToSave = {
                    projectInfo: { ...projectInfo, cachedTotalLoad: totalLoad * 1000 },
                    powerLoads,
                    savedAt: new Date().toISOString(),
                    status: 'DIRTY',
                    isDraft: true
                };

                try {
                    await setRemoteData(projectId, draftKey, dataToSave);

                    // --- NEW CONNECTION SYNC ---
                    const connections = [];
                    powerLoads.forEach(l => {
                        if (l.connectedPanelId) {
                            connections.push({ child_panel_id: String(l.connectedPanelId) });
                        }
                    });
                    await savePanelConnections(projectId, panelId, connections);
                    // ---------------------------

                    markAsDirty(panelId);
                    lastSavedDataRef.current = currentDataStr;

                    // [SYNC STATUS] 최소 800ms 동안 🟡 유지 (애니메이션 효과)
                    const elapsed = Date.now() - startTime;
                    const minDuration = 800;
                    if (elapsed < minDuration) {
                        await new Promise(resolve => setTimeout(resolve, minDuration - elapsed));
                    }

                    // [SYNC STATUS] 🔵 SERVER_SYNCED (서버 자동 저장 완료)
                    useDataStore.getState().setSyncStatus('remote', 'saved');
                    
                    // 리더 권한 반납
                    isLocalChangeRef.current = false;

                    // 2초 후에 다시 🟡 (DIRTY/UNSAVED) 상태로 전환하여 수동 저장 유도
                    setTimeout(() => {
                        if (useDataStore.getState().syncStatus.remote === 'saved') {
                            // 사용자의 요청에 따라 Yellow의 이중 의미(Saving/Dirty)를 유지하기 위해 'saving'으로 회귀
                            useDataStore.getState().setSyncStatus('remote', 'saving');
                        }
                    }, 2000);

                } catch (e) {
                    console.error('Transformer auto-save failed:', e);
                    // [SYNC STATUS] 🔴 ERROR (저장 실패)
                    useDataStore.getState().setSyncStatus('remote', 'error');
                }
            }
        }, 3000); // 3s debounce

        return () => clearTimeout(timer);
    }, [projectInfo, powerLoads, isDataLoaded, panelId, projectId, totalLoad]);

    // [Skeleton UI] Blocking Hydration 동안 표시 (더 어둡고 깊은 레이아웃)
    if (isHydrating) {
        return (
            <div className="min-h-screen bg-black text-gray-300 p-2 sm:p-4 lg:p-6 animate-pulse">
                <div className="max-w-[1920px] mx-auto w-full flex flex-col gap-6">
                    {/* Header Skeleton */}
                    <div className="h-20 bg-zinc-900/20 border border-zinc-900/40 rounded-sm w-full relative overflow-hidden">
                        <CornerBorders />
                    </div>
                    {/* Main Table Skeleton (확장형) */}
                    <div className="h-[650px] bg-zinc-900/20 border border-zinc-900/40 rounded-sm w-full relative overflow-hidden">
                        <CornerBorders />
                        <div className="p-4 flex flex-col gap-4">
                            <div className="h-10 bg-zinc-800/20 w-full rounded-sm"></div>
                            {[...Array(18)].map((_, i) => (
                                <div key={i} className="h-6 bg-zinc-800/10 w-full rounded-sm"></div>
                            ))}
                        </div>
                    </div>
                    {/* Summary & Calculations Skeleton (확장형) */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-20">
                        <div className="h-96 bg-zinc-900/20 border border-zinc-900/40 rounded-sm relative overflow-hidden">
                            <CornerBorders />
                        </div>
                        <div className="h-96 bg-zinc-900/20 border border-zinc-900/40 rounded-sm relative overflow-hidden">
                            <CornerBorders />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

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
                    panels={panels}
                    sourceSelectedIndex={sourceSelectedIndex}
                    showToast={showToast}
                />
                <FeederTable 
                    calculatedLoads={calculatedLoads}
                    selectedRows={selectedRows}
                    dropTarget={dropTarget}
                    draggedRow={draggedRow}
                    handleDragStart={handleDragStart}
                    handleDragOver={handleDragOver}
                    handleDragLeave={handleDragLeave}
                    handleDrop={handleDrop}
                    handleDragEnd={handleDragEnd}
                    handleContextMenu={handleContextMenu}
                    handleRowClick={handleRowClick}
                    projectInfo={projectInfo}
                    updatePowerLoad={updatePowerLoad}
                    panels={filteredPanelsForSelect}
                    activeDropdownId={activeDropdownId}
                    updateDropdownPosition={updateDropdownPosition}
                    dropdownPos={dropdownPos}
                    panelId={panelId}
                    globalUsedPanelIds={globalUsedPanelIds}
                    addPowerLoad={addPowerLoad}
                    updatePowerLoadFields={updatePowerLoadFields}
                />
                <LoadSummary 
                    projectInfo={projectInfo}
                    exportToExcel={exportToExcel}
                    updateProjectInfo={updateProjectInfo}
                    demandFactorSummary={demandFactorSummary}
                    totalLoad={totalLoad}
                    totalCurrentCalc={totalCurrentCalc}
                    mofData={mofData}
                    formatFuseRating={formatFuseRating}
                    mainCtValue={mainCtValue}
                    showExportSaveModal={showExportSaveModal}
                    setShowExportSaveModal={setShowExportSaveModal}
                    performExcelExport={performExcelExport}
                    handleExportSaveConfirm={handleExportSaveConfirm}
                />
                <TransformerContextMenu 
                    contextMenu={contextMenu}
                    closeContextMenu={closeContextMenu}
                    calculatedLoads={calculatedLoads}
                    projectId={projectId}
                    panels={filteredPanelsForSelect}
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
        </div>
    );
};

export default Transformer;

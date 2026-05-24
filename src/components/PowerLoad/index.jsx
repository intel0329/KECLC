import React, { useState, useEffect, useMemo, useRef, useCallback, useTransition } from 'react';
import { useParams } from 'react-router-dom';
import { Save, Plus, Minus, Trash2, X, Download, RotateCcw, ChevronRight, ChevronLeft, AlertCircle, CheckCircle } from 'lucide-react';
import { Header } from '../Header';
import CB_DATA from '../../data/CB.json';
import MCC_DATA from '../../data/MCC.json';
import { getProject, updateProject, updatePanelName, getRemoteData, setRemoteData, removeRemoteData, savePanelConnections, performBatchSave } from '../../services/projectService';
import projectService from '../../services/projectService';
import { usePanelLookup } from '../../hooks/usePanelLookup';
import { useConnectionSync } from '../../hooks/useConnectionSync';
import useDataStore from '../../store/useDataStore';
import { calculateKECJudgment, calculatePanelTotalLoad, isCableMethodValid, getMethodDisabledOptions } from '../../utils/kecCalculations';
import { exportPowerLoadToExcel } from '../../utils/excelExport';
import { useSafetyCheck } from '../../hooks/useSafetyCheck';
import PowerPanelKECDrawer from './sections/PowerPanelKECDrawer';
import ParallelConductorPopup from '../ParallelConductorPopup';
import PowerProjectInfoBar from './sections/PowerProjectInfoBar';
import PowerLoadTable from './sections/PowerLoadTable';

const STORAGE_KEY = 'kelc_setting_data';

// Derive unique breaker types from CB_DATA
const BREAKER_TYPES = [...new Set(
    CB_DATA.filter(row => row[0] && typeof row[3] === 'number')
        .map(row => row[0])
)].sort();

import PowerLoadKECDrawer from './sections/PowerLoadKECDrawer';
import { 
    isNameDuplicate, 
    normalizePhase, 
    getAFValue, 
    getVoltageByPhase, 
    findMCCData, 
    STARTING_MULTIPLIER,
    PHASE_LEVELS 
} from './utils/powerLoadHelpers';
import PowerLoadSummary from './sections/PowerLoadSummary';
import { ContextMenu, ExportSaveModal } from './sections/PowerLoadModals';
import { 
    CornerBorders, 
    TableHeader, 
    TableHeader2, 
    InputCell, 
    SelectCell 
} from './ui/PowerLoadUI';
import { usePowerLoadHistory } from './hooks/usePowerLoadHistory';

const PowerLoadContent = () => {
    const params = useParams();
    const projectId = params.projectId;
    const panelId = params.panelId;
    const [isPending, startTransition] = useTransition();

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
    const [isExtraExpanded, setIsExtraExpanded] = useState(false);

    // Parallel Conductor Popup State
    const [isParallelPopupOpen, setIsParallelPopupOpen] = useState(false);
    const [parallelPopupLoadId, setParallelPopupLoadId] = useState(null);

    // ID-based panel lookup hook (reactive to name changes)
    const { getNameById, getIdByName, getParentId, panels, globalUsedPanelIds, isLoaded: lookupLoaded, refresh: refreshPanelLookup } = usePanelLookup(projectId);

    // Track if initial data has been loaded to prevent overwriting on mount
    const [isDataLoaded, setIsDataLoaded] = useState(false);

    // [SSOT STORE] 전역 데이터 및 결과 스토어 구독
    const results = useDataStore(state => state.results);
    const panelsData = useDataStore(state => state.panels);
    const syncPanel = useDataStore(state => state.syncPanel);
    const loadPanelStore = useDataStore(state => state.loadPanel);
    const setSyncStatus = useDataStore(state => state.setSyncStatus);
    const syncStatus = useDataStore(state => state.syncStatus?.[panelId] || 'SAVED');
    const loadingPanelsRef = React.useRef(new Set()); // [NEW] 중복 로드 방지

    // [Phase 1] Hydration Gate & Sync Status
    const [isHydrating, setIsHydrating] = useState(true);
    const isLocalChangeRef = useRef(false);
    const forceSaveRef = useRef(false);
    const lastSavedDataRef = useRef(null); // [NEW] Server sync guard
    const lastSyncRef = useRef({ dataStr: '', resultStr: '' }); // [NEW] Deep check for loop prevention
    const latestDataRef = useRef(null); // [NEW] 실시간 데이터 참조 (Unmount Flush용)
    const [isReadyToCheck, setIsReadyToCheck] = useState(false); // Stabilization flag

    // Source Dropdown Keyboard Nav State
    const [sourceSelectedIndex, setSourceSelectedIndex] = useState(0);
    const [sourceSearchText, setSourceSearchText] = useState('');

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
            chk: String(l.chk || '')
        });

        const cleanInfo = {
            name: String(info.name || ''),
            panelName: String(info.panelName || ''),
            fromId: String(info.fromId || ''), // Changed from 'from' to 'fromId'
            location: String(info.location || ''),
            phase: String(info.phase || '3Ø-3W'),
            voltage: String(info.voltage || '380V'), // Include voltage in tracking
            installType: String(info.installType || '노출'),
            usageType: String(info.usageType || '일반'),
            branchDistance: String(info.branchDistance || 30),
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
            demandFactor: String(info.demandFactor || 100),
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

        // Listen for updates from TccMultiplierModal or other sources
        const handleStorageChange = (e) => {
            if (e.key === 'tccMultiplierData') {
                loadTccData();
            }
        };

        // Custom event handler for same-window updates
        const handleCustomUpdate = () => loadTccData();

        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('kelc_tcc_multiplier_updated', handleCustomUpdate);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('kelc_tcc_multiplier_updated', handleCustomUpdate);
        };
    }, []);

    // Helper to get Startup Multiplier (delta)
    const getStartupMultiplier = (tm, p, at, tccData) => {
        if (!tccData || !tm || !at) return 0;

        // Determine Phase Key
        // P=1 or 2 -> 1P (Assuming 1P/single phase uses 1P table)
        // P>=3 -> 3P (Assuming 3P uses 3P table)
        const poles = Number(p) || 3;
        const typeKey = poles <= 2 ? 'singlePhase' : 'threePhase';
        const headersKey = poles <= 2 ? 'singlePhaseHeaders' : 'threePhaseHeaders';

        const data = tccData[typeKey];
        const headers = tccData[headersKey];

        if (!data || !headers) return 0;

        // Find Column Index by tm (header match)
        const tmStr = String(tm).trim();
        const colIndex = headers.findIndex(h => String(h).trim() === tmStr);

        if (colIndex === -1) return 0;

        // Find Row by AT (Exact match on row key)
        const atStr = String(at).trim();
        const rowData = data[atStr];

        if (!rowData) return 0;

        return Number(rowData[colIndex]) || 0;
    };

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

        const handleStorageChange = (e) => {
            const defaultKey = 'kelc_mcc_settings';
            const projectKey = projectId ? `${defaultKey}_${projectId}` : defaultKey;
            // Listen for both global and project-specific key changes in other tabs
            if (e.key === defaultKey || e.key === projectKey || e.key === 'kelc_mcc_settings_updated') {
                loadMccSettings();
            }
        };

        const handleCustomUpdate = () => loadMccSettings();

        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('kelc_mcc_settings_updated', handleCustomUpdate);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('kelc_mcc_settings_updated', handleCustomUpdate);
        };
    }, [projectId]);



    // Load Summary Calculations (Moved and implemented below)
    const [showExportSaveModal, setShowExportSaveModal] = useState(false);

    const exportToExcel = () => {
        setShowExportSaveModal(true);
    };

    const performExcelExport = async () => {
        await exportPowerLoadToExcel(
            projectInfo,
            calculatedLoads,
            {
                totalLoad,
                phaseTotals,
                phaseLoad,
                totalCurrent: phaseTotals.totalCurrent,
                mainCT: mainCtValue ? `${mainCtValue}/5A` : '-',
                ...summaryStats
            },
            kecSettings
        );
    };

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



    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
    const lastSourceChangeRef = useRef(false);

    const showToast = (message, type = 'success') => {
        // Optimistic toast management: clear existing if same type, otherwise just show
        setToast({ show: true, message, type });
        // Standard timeout for visibility
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
    };

    // Helper to check for circular dependency
    const checkCircularDependency = (parentId, childId) => {
        if (!parentId || !childId) return false;
        if (parentId === childId) return true;
        
        let current = parentId;
        const visited = new Set();
        while (current) {
            if (visited.has(current)) break;
            visited.add(current);
            if (current === childId) return true;
            current = getParentId(current);
        }
        return false;
    };

    // UI State
    const [hasChanges, setHasChanges] = useState(false);
    const [isPanelKECDrawerOpen, setIsPanelKECDrawerOpen] = useState(false);
    const [panelHighlightSection, setPanelHighlightSection] = useState(null);
    const [saveStatus, setSaveStatus] = useState('');
    const [editingPanelName, setEditingPanelName] = useState('');
    const isProcessingCommit = React.useRef(false);
    const lastDraftRef = useRef(null);

    // Project Info
    const [projectInfo, setProjectInfo] = useState({
        name: '',
        panelName: 'PP-동력반',
        fromId: '', // Changed from 'from' to 'fromId' for ID-based storage
        location: '',
        phase: '3Φ-4W',
        voltage: '380V',
        mainBreakerType: 'MCCB',
        mccbAT: '',
        mccbAF: '',
        usageType: '일반',
        installType: '노출',
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

    // Power loads (동력 부하)
    const { powerLoads, setPowerLoads, recordHistory, undo, redo } = usePowerLoadHistory([]);

    // Helper to format number (remove trailing zeros, max 2 decimals)
    const formatValue = (val) => {
        if (!val) return '';
        return parseFloat(Number(val).toFixed(2)).toString();
    };


    // Derive calculated loads
    const calculatedLoads = useMemo(() => {
        return powerLoads.map(load => {
            // Priority: Load specific > Global Settings (From KEC Settings)
            const eff = Number(load.efficiency) || Number(kecSettings.cableCondition?.efficiency) || 1;
            const pf = Number(load.powerFactor) || Number(kecSettings.cableCondition?.powerFactor) || 1;
            const voltage = getVoltageByPhase(load.phase);

            // Logic Swap: LOAD uses kVA (Apparent), MOTOR/PUMP uses kW (Effective/Active)
            const isGeneral = load.type === 'LOAD';

            // 유효전력(P) 및 피상전력(Pa) 값 파싱
            const P = Number(load.effectivePower) || 0; // kW
            const Pa = Number(load.apparentPower) || 0; // kVA

            const hasKVA = Pa > 0;
            const hasKW = P > 0;
            const useKVAFormula = isGeneral && hasKVA;

            // 설계전류 IB [A] 계산
            let designCurrent = 0;
            const cleanPh = String(load.phase || '').replace(/[-\s]/g, '').replace(/Ø/g, 'Φ').toUpperCase();
            if (voltage) {
                if (cleanPh.includes('1Φ2W')) {
                    // 단상
                    if (useKVAFormula) {
                        // LOAD (kVA) -> 피상전력 기준: I = Pa / (V * eff)
                        designCurrent = (Pa * 1000) / (voltage * eff);
                    } else {
                        // LOAD (kW) or MOTOR/PUMP (kW) -> 유효전력 기준: I = P / (V * pf * eff)
                        designCurrent = (P * 1000) / (voltage * pf * eff);
                    }
                } else {
                    // 삼상
                    if (useKVAFormula) {
                        // LOAD (kVA) -> 피상전력 기준: I = Pa / (sqrt(3) * v * eff)
                        designCurrent = (Pa * 1000) / (Math.sqrt(3) * voltage * eff);
                    } else {
                        // LOAD (kW) or MOTOR/PUMP (kW) -> 유효전력 기준: I = P / (sqrt(3) * V * pf * eff)
                        designCurrent = (P * 1000) / (Math.sqrt(3) * voltage * pf * eff);
                    }
                }
            }

            // 기동전류 (IMS) 및 돌입전류 (IMI) 계산
            let ims = 0;
            let imi = 0;

            const kw = Number(load.effectivePower) || 0;
            const method = load.startingMethod;

            // Beta (β) Logic
            let beta = 0;
            if (method === 'DOL' || method.includes('직입')) {
                const cleanPhInner = String(load.phase || '').replace(/[-\s]/g, '').replace(/Ø/g, 'Φ').toUpperCase();
                if (cleanPhInner.includes('1Φ') || cleanPhInner.includes('1Ø')) {
                    beta = mccSettings.betaDirect1P;
                } else {
                    if (kw <= 2.2) beta = mccSettings.betaDirect3PSmall;
                    else beta = mccSettings.betaDirect3PLarge;
                }
            } else if (method === 'Y-D') {
                beta = mccSettings.betaYD;
            } else if (method === '리액터' || method.includes('REACTOR') || method === 'Reactor') {
                beta = mccSettings.betaReactor;
            }

            // C Logic & Calculation
            let startingC = 1;
            if (method === 'INV' || method.includes('INVERTER')) {
                // INV: IMS = IB * Lambda, IMI = IB * Lambda (as per user request)
                ims = designCurrent * mccSettings.lambdaInv;
                imi = designCurrent * mccSettings.lambdaInv;
            } else {
                let c = 1;
                if (method === 'Y-D') c = 1 / 3;
                else if (method === '리액터' || method.includes('REACTOR') || method === 'Reactor') c = mccSettings.reactorTap;

                startingC = c;

                ims = designCurrent * beta * c;
                // Inrush (IMI) = IMS * K
                imi = ims * mccSettings.globalK;
            }

            // kVA Calculations
            let apparentPowerInput = 0;
            let startingKva = 0;

            if (isGeneral) {
                const kvaValue = useKVAFormula ? Pa : (hasKW ? P / (pf * eff) : 0);
                apparentPowerInput = kvaValue;
                startingKva = kvaValue * (method === 'INV' ? mccSettings.lambdaInv : 1);
            } else if (load.type === 'SPARE') {
                apparentPowerInput = '-';
                startingKva = '-';
                designCurrent = '-';
                ims = '-';
                imi = '-';
            } else {
                apparentPowerInput = kw / (pf * eff);
                if (method === 'INV' || method.includes('INVERTER')) {
                    startingKva = apparentPowerInput * mccSettings.lambdaInv;
                } else {
                    startingKva = apparentPowerInput * beta * startingC;
                }
            }

            // AF 계산
            const { af } = getAFValue(load.cbType, load.cbP, load.at);


            // C & L Logic: Auto-fill based on Wire, Size, and Phase
            let autoC = '-'; // Default to dash
            let autoL = '-'; // Default to dash
            const sizeNum = Number(load.size) || 0;
            const areaSetting = Number(kecSettings.cableCondition?.area) || 50;
            const wireType = (load.wire || '').trim().toUpperCase();
            const phase = load.phase || '';
            const startingMethod = load.startingMethod || '';

            if (wireType && wireType !== 'WIRE') {
                if (wireType === 'HFIX') {
                    autoC = '1C';
                    // HFIX Line L logic
                    const cleanPhHfix = String(phase || '').replace(/[-\s]/g, '').replace(/Ø/g, 'Φ').toUpperCase();
                    if (cleanPhHfix.includes('1Φ2W')) autoL = '2L';
                    else if (cleanPhHfix.includes('3Φ3W')) autoL = '3L';
                    else if (cleanPhHfix.includes('3Φ4W')) autoL = '4L';
                    else autoL = '1L';
                } else if (wireType === 'FCV' || wireType === 'FR8') {
                    // C logic (existing)
                    const cleanPhFv = String(phase || '').replace(/[-\s]/g, '').replace(/Ø/g, 'Φ').toUpperCase();
                    if (sizeNum < areaSetting) {
                        if (cleanPhFv.includes('3Φ3W')) autoC = '3C';
                        else if (cleanPhFv.includes('3Φ4W')) autoC = '4C';
                        else if (cleanPhFv.includes('1Φ2W')) autoC = '2C';
                        else autoC = '1C';
                    } else {
                        autoC = '1C';
                    }

                    // Line L logic for FCV/FR8
                    if (startingMethod === 'Y-D') {
                        autoL = (sizeNum < areaSetting) ? '2L' : '6L';
                    } else {
                        if (sizeNum < areaSetting) {
                            autoL = '1L';
                        } else {
                            const cleanPhFvL = String(phase || '').replace(/[-\s]/g, '').replace(/Ø/g, 'Φ').toUpperCase();
                            if (cleanPhFvL.includes('1Φ2W')) autoL = '2L';
                            else if (cleanPhFvL.includes('3Φ3W')) autoL = '3L';
                            else if (cleanPhFvL.includes('3Φ4W')) autoL = '4L';
                            else autoL = '1L';
                        }
                    }
                } else {
                    // Other wires
                    autoC = '1C';
                    autoL = '1L'; // Default fallback
                }
            } else {
                autoC = '-';
                autoL = '-';
            }

            // PE Logic: Based on Conductor Size (from OD.json 5) 0.6/1kV F-GV 선정)
            let autoPE = '-';
            const wireTypeUpper = (load.wire || '').trim().toUpperCase();
            if (wireTypeUpper && wireTypeUpper !== 'WIRE' && load.size) {
                const s = load.size;
                const peMap = {
                    '1.5': '1.5', '2.5': '2.5', '4': '4', '6': '6', '10': '10', '16': '16',
                    '25': '16', '35': '16', '50': '25', '70': '35', '95': '50',
                    '120': '70', '150': '95', '185': '95', '240': '120', '300': '150'
                };
                autoPE = peMap[s] || '-';
            }

            // RECOMMENDED IN Logic
            const ibValue = Number(designCurrent) || 0;
            const cbPhaseNum = (Number(load.cbP) === 2) ? 2 : 3;
            
            // Refined filter for CB_DATA
            const recommendedIn = CB_DATA
                .filter(row => {
                    if (!row || row.length < 5) return false;
                    const rowType = String(row[0] || '').trim();
                    const targetType = String(load.cbType || '').trim();
                    if (rowType !== targetType) return false;
                    
                    const rowPhase = Number(row[2]);
                    const rowPoles = Number(row[3]);
                    
                    if (rowPhase !== cbPhaseNum) return false;
                    if (rowPoles !== Number(load.cbP)) return false;
                    
                    return true;
                })
                .map(row => Number(row[4]))
                .filter(at => at > ibValue)
                .sort((a, b) => a - b)[0];

            // 3. FULL KEC JUDGMENT (AT_TH, AT_SC, AT_MS, etc.)
            // Get effective starting time (tm)
            // Priority: Load specific (if user edited it) > Global MCC Setting by method
            let effectiveTm = Number(load.startingTime) || 0;
            
            if (!load.startingTime || load.startingTime === '') {
                // If row doesn't have a custom time, use global default for the method
                const methodUpper = String(method || '').toUpperCase().trim();
                if (methodUpper === 'INV' || methodUpper.includes('INVERTER')) {
                    effectiveTm = mccSettings.tmINV;
                } else if (methodUpper === 'DOL' || methodUpper.includes('직입')) {
                    effectiveTm = mccSettings.tmDOL;
                } else if (methodUpper === 'Y-D') {
                    effectiveTm = mccSettings.tmYD;
                } else if (methodUpper === '리액터' || methodUpper.includes('REACTOR')) {
                    effectiveTm = mccSettings.tmReactor;
                } else {
                    effectiveTm = 10; // Final fallback
                }
            }

            // Calculate Startup Multiplier (delta) dynamically
            // [FIX] Fallback to load.at if recommendedIn is missing to ensure lookup works for manually selected breakers
            const atForDelta = recommendedIn || Number(load.at) || 0;
            const delta = getStartupMultiplier(effectiveTm, load.cbP, atForDelta, tccMultiplierData);

            // Prepare circuit object for the utility
            const circuitForKEC = {
                ...load,
                startingTime: effectiveTm,
                at: load.at,
                size: load.size,
                type: load.cbType,
                p: Number(load.cbP) || (String(load.phase || '').replace(/[-\s]/g, '').replace(/Ø/g, 'Φ').toUpperCase().includes('1Φ') ? 2 : 4),
                af: af,
                wire: load.wire,
                method: load.method,
                isGeneral: load.type === 'LOAD',
                pa: load.apparentPower,
                p_kw: load.effectivePower,
                pf: load.powerFactor || kecSettings.cableCondition?.powerFactor,
                eff: load.efficiency || kecSettings.cableCondition?.efficiency,
                cableDistance: load.cableDistance || load.d || 15, // D in meters (Default 15m)
                delta: delta, // Pass the calculated delta
                delta2: (() => {
                    // Range-based δ₂ lookup from delta2Rows table
                    const rows = tccMultiplierData?.delta2Rows;
                    if (!rows || !Array.isArray(rows) || rows.length === 0) return 0;
                    const targetAt = Number(atForDelta) || 0;
                    if (targetAt <= 0) return 0;
                    // Sort rows by AT ascending, find the largest AT <= targetAt
                    const sorted = rows
                        .filter(r => r.at && r.delta2 && Number(r.at) > 0)
                        .sort((a, b) => Number(a.at) - Number(b.at));
                    let matched = null;
                    for (const r of sorted) {
                        if (Number(r.at) <= targetAt) matched = r;
                        else break;
                    }
                    return matched ? Number(matched.delta2) || 0 : (sorted.length > 0 ? Number(sorted[0].delta2) || 0 : 0);
                })(), // δ₂ from range-based table lookup
                atMiMultiplierType: kecSettings.atMiMultiplierType || 'delta2', // Type selection
                ib: designCurrent, // Pass calculated IB
                startingCurrent: ims, // Pass calculated IMS
                inrushCurrent: imi, // Pass calculated IMI
                globalK: mccSettings.globalK // Pass K (돌입전류 배율)
            };

            const fullJudgment = calculateKECJudgment(circuitForKEC, kecSettings, projectInfo);

            // Combined Status for "Chk" column
            const allJudgments = [
                fullJudgment.at_b?.status,
                fullJudgment.at_th?.status,
                fullJudgment.at_sc?.status,
                fullJudgment.at_ms?.status,
                fullJudgment.at_mi?.status,
                fullJudgment.sb?.status,
                fullJudgment.scb?.status,
                fullJudgment.se?.status,
                fullJudgment.smse?.status,
                fullJudgment.ssc?.status,
                fullJudgment.smsth?.status
            ];
            
            const combinedStatus = allJudgments.every(s => s === 'Ok') ? 'Ok' :
                allJudgments.some(s => s === 'Fail') ? 'Fail' : '-';

            return {
                ...load,
                designCurrent: (load.type === 'SPARE') ? '-' : (designCurrent > 0 ? designCurrent.toFixed(2) : '0.00'),
                startingCurrent: (load.type === 'SPARE' || load.type === 'LOAD') ? '-' : (ims > 0 ? ims.toFixed(2) : '0.00'),
                inrushCurrent: (load.type === 'SPARE' || load.type === 'LOAD') ? '-' : (imi > 0 ? imi.toFixed(2) : '0.00'),
                voltage,
                af,
                c: autoC,
                l: autoL,
                pe: autoPE,
                recommendedIn: recommendedIn || 'N/A',
                chk: combinedStatus, // Combined status
                kecJudgment: fullJudgment, // Store full results
                beta: beta, // Store beta for summary
                // [FIX] Return dynamic startingTime so UI shows live MCC updates 
                // when individual load.startingTime is empty.
                startingTime: effectiveTm, 
                // Use per-load PF/Eff if set, else display setting (visually handled in Table too, but good to have here)
                displayPF: formatValue(load.powerFactor || kecSettings.cableCondition?.powerFactor),
                displayEff: formatValue(load.efficiency || kecSettings.cableCondition?.efficiency),
                apparentPowerInput: load.type === 'SPARE' ? '-' : (apparentPowerInput > 0 ? apparentPowerInput.toFixed(2) : '0.00'),
                startingKva: (load.type === 'SPARE' || load.type === 'LOAD') ? '-' : (startingKva > 0 ? startingKva.toFixed(2) : '0.00'),
                // [NEW] 시각적 구분을 위한 플래그 추가: 사용자가 직접 입력했는지 여부
                isManualTm: !!load.startingTime
            };
        });
    }, [powerLoads, settings, mccSettings, kecSettings, projectInfo, tccMultiplierData]);

    const totalLoad = useMemo(() => {
        const total = calculatedLoads.reduce((sum, load) => {
            if (load.type === 'SPARE') return sum;
            const ib = Number(load.designCurrent) || 0;
            const cleanPhTotal = String(load.phase || '').replace(/[-\s]/g, '').replace(/Ø/g, 'Φ').toUpperCase();
            const v = Number(load.voltage) || (cleanPhTotal.includes('1Φ') ? 220 : 380);
            const power = cleanPhTotal.includes('1Φ') ? (ib * v) : (ib * v * Math.sqrt(3));
            return sum + power;
        }, 0);
        return Math.round(total);
    }, [calculatedLoads]);

    const phaseTotals = useMemo(() => {
        let l1 = 0, l2 = 0, l3 = 0;
        let i1 = 0, i2 = 0, i3 = 0;

        calculatedLoads.forEach(load => {
            const p = Number(load.cbP) || 4;
            const ib = Number(load.designCurrent) || 0;
            const cleanPhPhase = String(load.phase || '').replace(/[-\s]/g, '').replace(/Ø/g, 'Φ').toUpperCase();
            const v = Number(load.voltage) || (cleanPhPhase.includes('1Φ') ? 220 : 380);

            const power = cleanPhPhase.includes('1Φ') ? (ib * v) : (ib * v * Math.sqrt(3));

            if (cleanPhPhase.includes('3Φ')) {
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

        return {
            l1, l2, l3,
            i1, i2, i3,
            max: Math.max(l1, l2, l3),
            maxCurrent: Math.max(i1, i2, i3),
            totalCurrent: i1 + i2 + i3
        };
    }, [calculatedLoads]);

    const totalCurrentCalc = useMemo(() => {
        const v = Number(projectInfo.voltage?.replace('V', '')) || 220;
        const cleanPhMain = String(projectInfo.phase || '').replace(/[-\s]/g, '').replace(/Ø/g, 'Φ').toUpperCase();
        const voltageFactor = cleanPhMain.includes('3Φ') ? (v * Math.sqrt(3)) : v;
        return totalLoad / voltageFactor;
    }, [totalLoad, projectInfo.phase, projectInfo.voltage]);

    const mainCtValue = useMemo(() => {
        if (!totalCurrentCalc || totalCurrentCalc <= 0) return null;
        const targetValue = totalCurrentCalc * (mccSettings.globalCT || 1.25);
        const standardRatings = [5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100, 150, 200, 250, 300, 400, 500, 600, 750, 800, 1000, 1200, 1500, 2000, 2500, 3000, 4000];
        const matched = standardRatings.find(r => r >= targetValue);
        return matched || standardRatings[standardRatings.length - 1];
    }, [totalCurrentCalc, mccSettings.globalCT]);

    const summaryStats = useMemo(() => {
        let maxMotorLoad = null;
        let maxMotorKva = 0;
        let maxAbsoluteTm = 0;

        calculatedLoads.forEach(load => {
            const isMotor = load.type === 'MOTOR' || load.type === 'PUMP';
            if (isMotor) {
                const currentKva = Number(load.startingKva) || 0;
                if (currentKva > maxMotorKva || (currentKva === maxMotorKva && !maxMotorLoad)) {
                    maxMotorKva = currentKva;
                    maxMotorLoad = load;
                }
                const currentTm = load.startingMethod === 'INV' ? Number(mccSettings.tmINV) : Number(load.startingTime);
                if (!isNaN(currentTm) && currentTm > maxAbsoluteTm) {
                    maxAbsoluteTm = currentTm;
                }
            }
        });

        let othersSumKva = 0;
        calculatedLoads.forEach(load => {
            if (load !== maxMotorLoad && load.type !== 'SPARE') {
                othersSumKva += Number(load.apparentPowerInput) || 0;
            }
        });

        const maxTm = maxMotorLoad ? (Number(maxMotorLoad.startingTime) || 0) : 0;
        const maxDelta = maxMotorLoad ? (Number(maxMotorLoad.beta) || 0) : 0;
        const maxBetaMethod = maxMotorLoad ? (maxMotorLoad.startingMethod || '-') : '';
        const maxMotorKw = maxMotorLoad ? (Number(maxMotorLoad.effectivePower) || 0) : 0;
        const maxMotorCircuitNo = maxMotorLoad ? (maxMotorLoad.circuitNo || '') : '';

        return {
            maxMotorKva,
            maxMotorKw,
            maxMotorCircuitNo,
            othersSumKva,
            maxTm,
            maxAbsoluteTm,
            maxDelta,
            maxBetaMethod
        };
    }, [calculatedLoads, mccSettings.tmINV]);

    // [CONNECTION SYNC] 부모-자식 연결 즉시 동기화
    const collectConnections = useCallback((pLoads) => {
        const connections = [];
        pLoads.forEach(l => {
            if (l.connectedPanelId) connections.push({ child_panel_id: String(l.connectedPanelId) });
        });
        return connections;
    }, []);

    const getFlushPayload = useCallback(() => {
        if (!latestDataRef.current || !isDataLoaded) return null;
        const { projectInfo: pInfo, powerLoads: pLoads } = latestDataRef.current;
        const draftKey = getDraftKey(panelId);
        const connections = collectConnections(pLoads);
        return {
            draftSaveFn: () => setRemoteData(projectId, draftKey, {
                projectInfo: { ...pInfo, cachedTotalLoad: totalLoad, cachedPhaseTotals: phaseTotals },
                powerLoads: pLoads,
                savedAt: new Date().toISOString(), isDraft: true
            }),
            connections
        };
    }, [panelId, projectId, isDataLoaded, collectConnections, totalLoad, phaseTotals]);

    const { flushNow } = useConnectionSync(projectId, panelId, getFlushPayload);

    // [Optimistic Helper] 상태 변경 즉시 브로드캐스트 전파
    const handleImmediateConnectionSync = useCallback((nextLoads) => {
        const connections = collectConnections(nextLoads);
        const draftKey = getDraftKey(panelId);
        const pInfo = latestDataRef.current?.projectInfo || projectInfo;
        
        // 1. [Optimistic Local] 전역 계통 맵 즉시 갱신
        useDataStore.setState(state => {
            const nextMap = { ...state.panelConnections };
            Object.keys(nextMap).forEach(cid => {
                if (String(nextMap[cid]) === String(panelId)) delete nextMap[cid];
            });
            connections.forEach(c => {
                if (c.child_panel_id) nextMap[String(c.child_panel_id)] = String(panelId);
            });
            return { panelConnections: nextMap };
        });

        // 2. [Broadcast & Persist] 타 탭 전파 및 서버 저장
        flushNow(() => setRemoteData(projectId, draftKey, {
            projectInfo: pInfo, powerLoads: nextLoads,
            savedAt: new Date().toISOString(), isDraft: true
        }), connections);
    }, [panelId, projectId, projectInfo, collectConnections, flushNow]);

    // Source search state
    const [otherPanels, setOtherPanels] = useState([]);
    const [showSourceDropdown, setShowSourceDropdown] = useState(false);
    const sourceDropdownRef = React.useRef(null);

    // --- New Features States ---
    // Selection state for multi-select (Shift+Click)
    const [selectedRows, setSelectedRows] = useState([]); // Array of load ids
    const [lastSelectedRow, setLastSelectedRow] = useState(null); // load id

    // Drag and drop state
    const [draggedRow, setDraggedRow] = useState(null); // load id
    const [dropTarget, setDropTarget] = useState(null); // load id

    // Context menu state
    const [contextMenu, setContextMenu] = useState({ show: false, x: 0, y: 0, loadId: null });

    // KEC Judgment Drawer state
    const [judgmentDrawer, setJudgmentDrawer] = useState({ show: false, loadId: null, highlightSection: null });

    // Clipboard state with localStorage sync
    const [clipboard, setClipboardState] = useState(() => {
        try {
            const saved = localStorage.getItem('powerLoadClipboard');
            return saved ? JSON.parse(saved) : { loads: [], mode: null };
        } catch (e) {
            console.error('Failed to parse clipboard from localStorage:', e);
            return { loads: [], mode: null };
        }
    });

    // Undo/Redo Keyboard Listeners
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.ctrlKey) {
                if (e.key === 'z') {
                    if (e.shiftKey) {
                        // Ctrl+Shift+Z -> Redo
                        e.preventDefault();
                        if (redo()) {
                            showToast("다시 실행", "success");
                            markAsDirty(panelId);
                        }
                    } else {
                        // Ctrl+Z -> Undo
                        e.preventDefault();
                        if (undo()) {
                            showToast("이전으로 되돌리기", "success");
                            markAsDirty(panelId);
                        }
                    }
                } else if (e.key === 'y') {
                    // Ctrl+Y -> Redo
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

    const setClipboard = (newClipboard) => {
        setClipboardState(newClipboard);
        try {
            localStorage.setItem('powerLoadClipboard', JSON.stringify(newClipboard));
        } catch (e) {
            console.error('Failed to save clipboard to localStorage:', e);
        }
    };

    // --- Row Selection Handlers ---
    const handleRowClick = (loadId, event) => {
        event.stopPropagation(); // Stop propagation to prevent global deselect
        // Prevent default only if needed, but here we want input focus to work likely.
        // However, user said "clicking the column". If clicking input, we select the row.

        if (event.shiftKey && lastSelectedRow !== null) {
            // Shift+Click: Select range
            const startIdx = powerLoads.findIndex(l => l.id === lastSelectedRow);
            const endIdx = powerLoads.findIndex(l => l.id === loadId);
            if (startIdx !== -1 && endIdx !== -1) {
                const [from, to] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
                const rangeIds = powerLoads.slice(from, to + 1).map(l => l.id);
                setSelectedRows(prev => [...new Set([...prev, ...rangeIds])]);
            }
        } else if (event.ctrlKey || event.metaKey) {
            // Ctrl+Click: Toggle single
            setSelectedRows(prev => prev.includes(loadId) ? prev.filter(id => id !== loadId) : [...prev, loadId]);
        } else {
            // Normal click on this specific column: Select single (and clear others)
            // But we allow input editing? If we select row, does it stop editing?
            // Usually in Excel, clicking a cell selects it.
            // If the user wants to EDIT the text, they might need to double click or click again.
            // For now, dragging and selecting implies row-level operations.
            // Let's ensure we update selection but don't prevent default unless necessary.

            // If just clicking to edit, maybe we shouldn't clear selection if it's already selected?
            // But standard behavior is click = select only this.
            setSelectedRows([loadId]);
        }
        setLastSelectedRow(loadId);
    };

    // --- Context Menu Handlers ---
    const handleContextMenu = (e, loadId) => {
        // If clicking on an input or textarea, let the browser handle it (for native copy/paste menu)
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        e.preventDefault();
        // If row is not in selection, select it
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
        setClipboard({ loads: loadsToCut.map(l => ({ ...l })), mode: 'cut' });
        // Optimistic update
        isLocalChangeRef.current = true;
        setPowerLoads(powerLoads.filter(l => !selectedRows.includes(l.id)));
        setHasChanges(true); // Mark as dirty
        setSelectedRows([]);
        closeContextMenu();
    };

    const handlePaste = () => {
        if (clipboard.loads.length === 0) return;
        isLocalChangeRef.current = true;
        recordHistory(powerLoads);
        // Default to end if no context
        const targetIdx = contextMenu.loadId ? powerLoads.findIndex(l => l.id === contextMenu.loadId) : powerLoads.length;

        const newLoads = clipboard.loads.map(l => ({ ...l, id: Date.now() + Math.random() }));
        const updatedLoads = [...powerLoads];

        // Overwrite Logic
        for (let i = 0; i < newLoads.length; i++) {
            if (targetIdx + i < updatedLoads.length) {
                updatedLoads[targetIdx + i] = { ...newLoads[i], id: updatedLoads[targetIdx + i].id };
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
    };

    const handleInsertPaste = () => {
        if (clipboard.loads.length === 0) return;
        isLocalChangeRef.current = true;
        recordHistory(powerLoads);
        const targetIdx = contextMenu.loadId ? powerLoads.findIndex(l => l.id === contextMenu.loadId) : powerLoads.length - 1;
        const newLoads = clipboard.loads.map(l => ({ ...l, id: Date.now() + Math.random() }));
        const updatedLoads = [...powerLoads];

        // Insert ABOVE the target (AT targetIdx)
        updatedLoads.splice(targetIdx, 0, ...newLoads);

        setPowerLoads(updatedLoads);
        setHasChanges(true);

        if (clipboard.mode === 'cut') {
            const sourceIds = clipboard.loads.map(l => l.id);
            setPowerLoads(prev => prev.filter(l => !sourceIds.includes(l.id)));
            setClipboard({ loads: [], mode: null });
        }
        closeContextMenu();
    };

    const handleInsertRow = () => {
        isLocalChangeRef.current = true;
        recordHistory(powerLoads);
        // Default to end of list if no specific row context
        const targetIdx = contextMenu.loadId
            ? powerLoads.findIndex(l => l.id === contextMenu.loadId)
            : powerLoads.length - 1;

        const newLoad = {
            id: Date.now(),
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
    };

    const handleDeleteSelected = () => {
        if (selectedRows.length === 0) return;
        isLocalChangeRef.current = true;
        recordHistory(powerLoads);
        setPowerLoads(powerLoads.filter(l => !selectedRows.includes(l.id)));
        setHasChanges(true);
        setSelectedRows([]);
        closeContextMenu();
    };

    // --- Drag and Drop Handlers ---
    const handleDragStart = (e, loadId) => {
        setDraggedRow(loadId);
        e.dataTransfer.effectAllowed = 'move';
        // Optional: Set drag image
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

        isLocalChangeRef.current = true;
        recordHistory(powerLoads);

        const position = dropTarget?.position || 'above';

        const draggedItems = selectedRows.includes(draggedRow) ? selectedRows : [draggedRow];
        const remainingLoads = powerLoads.filter(l => !draggedItems.includes(l.id));
        const draggedLoadsData = powerLoads.filter(l => draggedItems.includes(l.id));
        const targetIdx = remainingLoads.findIndex(l => l.id === targetId);

        // If targetId is not in remainingLoads (e.g. it was part of selectedRows), targetIdx will be -1.
        // But handleDragOver should prevent dropping on itself anyway.
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
    };

    const handleDragEnd = () => {
        setDraggedRow(null);
        setDropTarget(null);
    };


    // Load settings from localStorage
    useEffect(() => {
        const loadSettings = () => {
            const defaultKey = STORAGE_KEY;
            const projectKey = projectId ? `${defaultKey}_${projectId}` : defaultKey;
            const saved = localStorage.getItem(projectKey) || localStorage.getItem(defaultKey);
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    if (parsed.cableCondition) {
                        setSettings({
                            powerFactor: parsed.cableCondition.powerFactor || 0.8,
                            efficiency: parsed.cableCondition.efficiency || 1.0,
                            area: parsed.cableCondition.area || 50
                        });
                        // Also sync KEC settings state
                        setKecSettings(prev => ({ ...prev, ...parsed }));
                    }
                } catch (e) {
                    console.error('Failed to load settings:', e);
                }
            }
        };

        const loadMccSettings = () => {
            const defaultKey = 'kelc_mcc_settings';
            const projectKey = projectId ? `${defaultKey}_${projectId}` : defaultKey;
            const saved = localStorage.getItem(projectKey) || localStorage.getItem(defaultKey);
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    setMccSettings(prev => ({ ...prev, ...parsed }));
                } catch (e) {
                    console.error("Failed to load MCC settings:", e);
                }
            }
        };

        const loadRemoteSettings = async () => {
            if (!projectId) return;
            try {
                // Load per-project settings from MariaDB (saved by SettingPage)
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
                } else {
                    // Fallback: legacy kelc_global_settings
                    const savedSettings = await getRemoteData('kelc_global_settings');
                    if (savedSettings) {
                        setKecSettings(prev => ({ ...prev, ...savedSettings }));
                    }
                }

                // Load per-project MCC settings from MariaDB (saved by MCCPage)
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
                console.error("Failed to reload TCC settings:", e);
            }
        };

        loadSettings();
        loadMccSettings();
        loadRemoteSettings();

        window.addEventListener('kelc_settings_updated', loadSettings);
        window.addEventListener('kelc_mcc_settings_updated', loadMccSettings);
        window.addEventListener('kelc_tcc_multiplier_updated', loadTccSettings);

        return () => {
            window.removeEventListener('kelc_settings_updated', loadSettings);
            window.removeEventListener('kelc_mcc_settings_updated', loadMccSettings);
            window.removeEventListener('kelc_tcc_multiplier_updated', loadTccSettings);
        };
    }, []);

    // Load project and panel data (including DRAFT logic)
    // Helper function to find panel name from project data
    const getPanelNameFromProject = (project, panelId) => {
        if (!project || !panelId) return null;
        for (const calc of project.calculators || []) {
            if (calc.children) {
                const directMatch = calc.children.find(child => child.id === panelId);
                if (directMatch) return directMatch.name;
                for (const child of calc.children) {
                    if (child.children) {
                        const nestedMatch = child.children.find(nested => nested.id === panelId);
                        if (nestedMatch) return nestedMatch.name;
                    }
                }
            }
        }
        return null;
    };

    // -------------------------------------------------------------
    // MCC Lookup & Initial Data Loading Helper
    // -------------------------------------------------------------

    // Helper to perform MCC Lookup and update load
    const performMCCLookup = (load) => {
        if (load.type !== 'MOTOR' && load.type !== 'PUMP') return load;
        // [NEW] INV method should NOT trigger MCC lookup as requested
        if (load.startingMethod === 'INV') return load;

        // Needs Phase, Method, Effective Power
        if (!load.phase || !load.startingMethod || !load.effectivePower) return load;

        const mccData = findMCCData(load.type, load.phase, load.startingMethod, load.effectivePower);
        if (mccData) {
            return {
                ...load,
                powerFactor: mccData.powerFactor,
                efficiency: mccData.efficiency,
                // [FIX] StartingTime is now dynamic based on GLOBAL MCC settings 
                // if it remains empty in the individual row.
                startingTime: '', 
                ct: mccData.ct,
                capacitor: mccData.capacitor,
                unitSize: mccData.unitSize,
                c: mccData.c,
                l: mccData.lambda,
                fixedDesignCurrent: mccData.designCurrent,
                fixedStartingCurrent: mccData.startingCurrent,
                fixedInrushCurrent: mccData.inrushCurrent
            };
        }
        return load;
    };

    // Load panel data from MariaDB when panelId changes
    useEffect(() => {
        const loadInitialData = async () => {
            if (isDataLoaded) return;
            setIsHydrating(true);
            
            try {
                // 1. [Memory First] Zustand 스토어 최우선 확인
                let currentData = panelsData[panelId];
                let loadedInfo = { ...projectInfo };
                let loadedLoads = [...powerLoads];
                let hasSource = false;

                if (currentData && (currentData.projectInfo || currentData.powerLoads)) {
                    console.log(`[POWER] Memory-First hydration: Main panel ${panelId} found in store`);
                    if (currentData.projectInfo) loadedInfo = { ...loadedInfo, ...currentData.projectInfo };
                    if (currentData.powerLoads) loadedLoads = currentData.powerLoads;
                    hasSource = true;
                } else {
                    // 2. [Tier 2] Local PC Cache 확인
                    const cacheKey = `kelc_panel_cache_${panelId}`; // Use consistent key
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
                        console.log(`[PowerLoad Hydration] Local-First: Trusting Local Cache (${cachedData.status})`);
                        finalData = cachedData;
                    } else {
                        // [Tier 3] 서버 데이터 조회 (Draft -> Origin)
                        const draftKey = getDraftKey(panelId);
                        const originKey = getOriginKey(panelId);
                        const draftData = await getRemoteData(draftKey);
                        
                        if (draftData) {
                            finalData = draftData;
                        } else {
                            const originData = await getRemoteData(originKey);
                            if (originData) {
                                finalData = originData;
                            } else if (cachedData) {
                                // 서버에 없고 로컬에만 데이터가 있는 경우
                                finalData = cachedData;
                            }
                        }
                    }

                    if (finalData) {
                        if (finalData.projectInfo) loadedInfo = { ...loadedInfo, ...finalData.projectInfo };
                        if (finalData.powerLoads) loadedLoads = finalData.powerLoads;
                        hasSource = true;
                    }
                }

                // Force project & panel name consistency
                const project = await getProject(projectId);
                if (project) {
                    if (project.name) loadedInfo.name = project.name;
                    const treePanelName = getPanelNameFromProject(project, panelId);
                    if (treePanelName) loadedInfo.panelName = treePanelName;
                }

                const sanitizedLoads = loadedLoads.map(l => {
                    let item = { ...l, chk: l.chk || 'Ok' };
                    const isMotor = item.type === 'MOTOR' || item.type === 'PUMP';
                    const hasCoreInfo = item.phase && item.startingMethod && item.effectivePower;
                    const isMccEmpty = !item.ct && !item.capacitor;

                    if (isMotor && hasCoreInfo && isMccEmpty) {
                        item = performMCCLookup(item);
                    }
                    return item;
                });

                startTransition(() => {
                    setProjectInfo(loadedInfo);
                    setEditingPanelName(loadedInfo.panelName);
                    setPowerLoads(sanitizedLoads);
                    
                    // [INITIALIZE] Initial state capture for save guard
                    lastSavedDataRef.current = getCoreDataString(loadedInfo, sanitizedLoads);

                    setIsDataLoaded(true);
                    setIsHydrating(false);
                    setTimeout(() => setIsReadyToCheck(true), 1000);
                });

                // 자식 데이터 로드 (Non-blocking)
                const childIds = sanitizedLoads
                    .map(l => l.connectedPanelId)
                    .filter(id => id && id !== panelId);
                
                if (childIds.length > 0) {
                    childIds.forEach(id => loadPanelStore(id));
                }

            } catch (e) {
                console.error('Critical failure in loadInitialData:', e);
                setIsDataLoaded(true);
                setIsHydrating(false);
            }
        };

        loadInitialData();

        const handleProjectUpdate = async () => {
            const project = await getProject(projectId);
            if (project) {
                if (project.name) {
                    setProjectInfo(prev => ({ ...prev, name: project.name }));
                }
                const newPanelName = getPanelNameFromProject(project, panelId);
                if (newPanelName) {
                    setProjectInfo(prev => ({ ...prev, panelName: newPanelName }));
                    setEditingPanelName(newPanelName);
                }
            }
        };

        window.addEventListener('kelc_project_info_updated', handleProjectUpdate);
        return () => window.removeEventListener('kelc_project_info_updated', handleProjectUpdate);
    }, [projectId, panelId]);

    // Save projectInfo to localStorage for Header compatibility
    useEffect(() => {
        if (!isDataLoaded) return;
        const existingData = JSON.parse(localStorage.getItem('kelc_project_info') || '{}');
        const dataToSave = {
            ...projectInfo,
            projectId: projectId || existingData.projectId || '',
            projectName: projectInfo.name
        };
        localStorage.setItem('kelc_project_info', JSON.stringify(dataToSave));
    }, [projectInfo, projectId, isDataLoaded]);


    const phaseLoad = phaseTotals.max;



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
            console.log(`[ZERO SYNC] External update received for PowerLoad ${panelId}`);
            if (storeData.projectInfo) {
                setProjectInfo(prev => ({ ...prev, ...storeData.projectInfo }));
                if (storeData.projectInfo.panelName && storeData.projectInfo.panelName !== editingPanelName) {
                    setEditingPanelName(storeData.projectInfo.panelName);
                }
            }
            if (storeData.powerLoads) setPowerLoads(storeData.powerLoads);
            lastSyncRef.current = { dataStr: storeDataStr, resultStr: lastSyncRef.current.resultStr };
        }
    }, [panelsData, panelId, isDataLoaded]);

    useEffect(() => {
        if (isDataLoaded) setIsHydrating(false);
    }, [isDataLoaded]);



    const broadcastListUpdate = useDataStore(state => state.broadcastListUpdate);
    const handlePanelNameCommit = async () => {
        if (isProcessingCommit.current) return;
        
        const trimmedName = editingPanelName?.trim();
        if (!trimmedName || trimmedName === projectInfo.panelName) {
            setEditingPanelName(projectInfo.panelName || '');
            return;
        }

        isProcessingCommit.current = true;
        try {
            // Check for duplicate names in the same project using the global lookup
            const isDuplicate = panels.some(p => p.id !== panelId && p.name === trimmedName);
            
            if (isDuplicate) {
                showToast(`'${trimmedName}' 이름은 이미 사용 중입니다.`, 'error');
                setEditingPanelName(projectInfo.panelName || '');
                return;
            }

            // 1. 서버 업데이트 및 브로드캐스트
            const success = await useDataStore.getState().updatePanelName(projectId, panelId, trimmedName);
            if (success) {
                // 2. 로컬 상태 업데이트
                updateProjectInfo('panelName', trimmedName);
                
                // 3. [ZERO SYNC] 즉시 전역 스토어 반영 및 브로드캐스팅
                syncPanel(panelId, 
                    { projectInfo: { ...projectInfo, panelName: trimmedName }, powerLoads },
                    { totalLoad, phaseTotals, summaryStats, mainCtValue, calculatedLoads }
                );

                broadcastListUpdate();
                window.dispatchEvent(new Event('kelc_project_info_updated'));
                showToast('판넬 이름이 변경되었습니다.');
            } else {
                throw new Error('Server update failed');
            }
        } catch (e) {
            console.error('Failed to update panel name:', e);
            showToast('이름 변경 중 오류가 발생했습니다.', 'error');
            setEditingPanelName(projectInfo.panelName || '');
        } finally {
            isProcessingCommit.current = false;
        }
    };

    // Handle MANUAL SAVE (Commit)
    useEffect(() => {
        const handleTriggerSave = async () => {
            const originKey = getOriginKey(panelId);
            const draftKey = getDraftKey(panelId);
            if (!originKey) return;

            try {
                const dataToSave = {
                    projectInfo: { ...projectInfo, cachedTotalLoad: totalLoad },
                    powerLoads,
                    savedAt: new Date().toISOString(),
                    status: 'SERVER_SYNCED',
                    isDraft: false
                };

                // 1. Save to Origin
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

                // 2. Remove Draft (Redis/MariaDB Cleanup)
                await removeRemoteData(draftKey);
                lastDraftRef.current = JSON.stringify({ projectInfo, powerLoads }); // 동기화
                
                // 3. Mark Clean
                markAsClean(panelId);
                isLocalChangeRef.current = false;

                // [UPDATE] Sync the guard ref after successful manual save
                lastSavedDataRef.current = getCoreDataString(projectInfo, powerLoads);

                // Update panel name logic on save if needed
                if (editingPanelName !== projectInfo.panelName) {
                    const project = await getProject(projectId);
                    if (!isNameDuplicate(project, editingPanelName, panelId)) {
                        await updatePanelName(projectId, panelId, editingPanelName);
                    }
                }

                window.dispatchEvent(new CustomEvent('kelc_save_finished', { detail: { panelId, success: true } }));
            } catch (e) {
                console.error('Failed to manual save:', e);
                window.dispatchEvent(new CustomEvent('kelc_save_finished', { detail: { panelId, success: false, error: e.message } }));
            }
        };

        window.addEventListener('kelc_trigger_save', handleTriggerSave);
        return () => window.removeEventListener('kelc_trigger_save', handleTriggerSave);
    }, [projectInfo, powerLoads, editingPanelName, projectId, panelId]);

    // Auto-sync SOURCE (fromId) when panel lookup is ready
    useEffect(() => {
        if (!lookupLoaded || !isDataLoaded || !panelId) return;

        const actualParentId = getParentId(panelId);
        
        // Refined sync logic with toast feedback
        if (actualParentId && projectInfo.fromId !== actualParentId) {
            updateProjectInfo('fromId', actualParentId);
            setHasChanges(true);
            markAsDirty(panelId);
            
            // If this was from a manual user selection, show success
            if (lastSourceChangeRef.current) {
                showToast("업데이트 완료되었습니다.", "success");
                lastSourceChangeRef.current = false;
            }
        } else if (!actualParentId && projectInfo.fromId) {
            // Refusal/Reset Case
            updateProjectInfo('fromId', '');
            setHasChanges(true);
            markAsDirty(panelId);
            
            // If the system refused a manual selection (e.g. hierarchy rule)
            if (lastSourceChangeRef.current) {
                showToast("해당 연결은 유효하지 않습니다.", "error");
                lastSourceChangeRef.current = false;
            }
        } else if (actualParentId && projectInfo.fromId === actualParentId && lastSourceChangeRef.current) {
            // Already synced correctly
            showToast("업데이트 완료되었습니다.", "success");
            lastSourceChangeRef.current = false;
        }
    }, [lookupLoaded, isDataLoaded, panelId, getParentId, projectInfo.fromId, projectId]);

    // [CONNECTION SYNC] 다른 탭에서 연결 변경 시 SOURCE 재동기화 강제 트리거
    useEffect(() => {
        const handleConnectionsChanged = (e) => {
            if (!lookupLoaded || !isDataLoaded || !panelId) return;

            // 만약 나 자신(부모)의 연결 정보가 변경된 거라면 (자식 삭제 등의 이유로)
            if (e && e.detail && e.detail.panelId === panelId) {
                const storeData = useDataStore.getState().panels[panelId];
                if (storeData) {
                    console.log(`[PowerLoad Reactive Sync] Hydrating parent panel from store: ${panelId}`);
                    if (storeData.projectInfo) {
                        setProjectInfo(prev => ({ ...prev, ...storeData.projectInfo }));
                        if (storeData.projectInfo.panelName) {
                            setEditingPanelName(storeData.projectInfo.panelName);
                        }
                    }
                    if (storeData.powerLoads) {
                        setPowerLoads(storeData.powerLoads);
                    }
                    // [STRICT GUARD] 외부 브로드캐스트 Hydration 완료 후:
                    // 1) guard string 갱신으로 "변경된 게 없음"을 선언
                    // 2) isLocalChangeRef = false 로 자동 저장 루프 원천 차단
                    lastSavedDataRef.current = getCoreDataString(
                        storeData.projectInfo || projectInfo,
                        storeData.powerLoads || powerLoads
                    );
                    isLocalChangeRef.current = false; // [AUTO-SAVE GUARD] 타 탭 수신 시 서버 저장 API 낭비 차단
                }
                return;
            }

            // usePanelLookup이 loadData()를 호출하여 갱신된 후,
            // 약간의 지연을 두고 SOURCE를 재검증합니다.
            setTimeout(() => {
                const actualParentId = getParentId(panelId);
                if (actualParentId && projectInfo.fromId !== actualParentId) {
                    updateProjectInfo('fromId', actualParentId);
                    setHasChanges(true);
                    markAsDirty(panelId);
                } else if (!actualParentId && projectInfo.fromId) {
                    updateProjectInfo('fromId', '');
                    setHasChanges(true);
                    markAsDirty(panelId);
                }
            }, 500);
        };

        window.addEventListener('kelc_connections_changed', handleConnectionsChanged);
        return () => window.removeEventListener('kelc_connections_changed', handleConnectionsChanged);
    }, [lookupLoaded, isDataLoaded, panelId, getParentId, projectInfo.fromId]);

    // Handle Internal Draft Save Trigger
    useEffect(() => {
        const handleTriggerDraftSave = async () => {
            if (!isDataLoaded || !panelId || !projectId) return;
            const draftKey = getDraftKey(panelId);
            try {
                // [Sync Status] 서버 동기화 시작
                useDataStore.getState().setSyncStatus('remote', 'saving');
                const startTime = Date.now();

                const dataToSave = {
                    projectInfo: { ...projectInfo, cachedTotalLoad: totalLoad },
                    powerLoads,
                    savedAt: new Date().toISOString(),
                    isDraft: true
                };
                await setRemoteData(projectId, draftKey, dataToSave);
                
                const connections = [];
                powerLoads.forEach(l => { if (l.connectedPanelId) connections.push({ child_panel_id: String(l.connectedPanelId) }); });
                await savePanelConnections(projectId, panelId, connections);

                // [UPDATE] Sync the guard ref after successful save
                lastSavedDataRef.current = getCoreDataString(projectInfo, powerLoads);

                // [Sync Status] 최소 표시 시간 보장
                const elapsed = Date.now() - startTime;
                if (elapsed < 800) await new Promise(resolve => setTimeout(resolve, 800 - elapsed));

                useDataStore.getState().setSyncStatus('remote', 'saved');
                setTimeout(() => {
                    if (useDataStore.getState().syncStatus.remote === 'saved') useDataStore.getState().setSyncStatus('remote', 'idle');
                }, 2000);

                window.dispatchEvent(new CustomEvent('kelc_save_draft_finished', { detail: { panelId, success: true } }));
            } catch (e) {
                console.error('Failed to save draft on trigger:', e);
                useDataStore.getState().setSyncStatus('remote', 'error');
                window.dispatchEvent(new CustomEvent('kelc_save_draft_finished', { detail: { panelId, success: false } }));
            }
        };
        window.addEventListener('kelc_trigger_save_draft', handleTriggerDraftSave);
        return () => window.removeEventListener('kelc_trigger_save_draft', handleTriggerDraftSave);
    }, [projectInfo, powerLoads, isDataLoaded, projectId, panelId, totalLoad]);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA';
            const isControlKey = e.ctrlKey || e.metaKey;
            if (!e.key) return;
            const key = e.key.toLowerCase();

            if (isInput) {
                // If focused in input, prioritize native text editing roles
                if (key === 'v' && isControlKey) {
                    // Always allow native paste for text
                    return;
                }

                if ((key === 'c' || key === 'x') && isControlKey) {
                    // If text is selected, let browser handle it. If NO text is selected, fall through to row copy/cut.
                    if (e.target.selectionStart !== e.target.selectionEnd) {
                        return;
                    }
                } else if (e.key === 'Delete' || e.key === 'Backspace') {
                    // Always allow deleting text in input
                    return;
                } else if (!isControlKey) {
                    // Normal typing
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
                setClipboard({ loads: loadsToCut.map(l => ({ ...l })), mode: 'cut' });
                isLocalChangeRef.current = true;
                setPowerLoads(powerLoads.filter(l => !selectedRows.includes(l.id)));
                setHasChanges(true);
                setSelectedRows([]);
            } else if (isControlKey && key === 'v') {
                e.preventDefault();
                if (clipboard.loads.length === 0) return;
                isLocalChangeRef.current = true;
                recordHistory(powerLoads);
                const foundIdx = lastSelectedRow ? powerLoads.findIndex(l => l.id === lastSelectedRow) : -1;
                const targetIdx = foundIdx !== -1 ? foundIdx : powerLoads.length - 1;
                const newLoads = clipboard.loads.map(l => ({ ...l, id: Date.now() + Math.random() }));
                const updatedLoads = [...powerLoads];

                // Overwrite Logic
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
                isLocalChangeRef.current = true;
                recordHistory(powerLoads);
                setPowerLoads(powerLoads.filter(l => !selectedRows.includes(l.id)));
                setHasChanges(true);
                setSelectedRows([]);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedRows, powerLoads, clipboard, lastSelectedRow]);

    // Handle click outside for SOURCE dropdown
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (sourceDropdownRef.current && !sourceDropdownRef.current.contains(e.target)) {
                setShowSourceDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Close context menu on click outside
    useEffect(() => {
        const handleClickOutside = () => closeContextMenu();
        if (contextMenu.show) {
            document.addEventListener('click', handleClickOutside);
        }
        return () => document.removeEventListener('click', handleClickOutside);
    }, [contextMenu.show]);

    // Context Menu Component

    const maxLoadLevel = useMemo(() => {
        if (!powerLoads || powerLoads.length === 0) return 0;
        return Math.max(...powerLoads.map(l => PHASE_LEVELS[l.phase] || 1));
    }, [powerLoads]);

    const isMainPhaseInvalid = useMemo(() => {
        const mainLevel = PHASE_LEVELS[projectInfo.phase] || 3;
        return mainLevel < maxLoadLevel;
    }, [projectInfo.phase, maxLoadLevel]);

    const syncMainPhaseWithLoads = useCallback((currentMaxLevel) => {
        if (currentMaxLevel === 0) return;
        const mainLevel = PHASE_LEVELS[projectInfo.phase] || 3;

        // Only auto-upgrade if local max exceeds current main phase
        if (currentMaxLevel > mainLevel) {
            let newPhase = projectInfo.phase;
            let newVoltage = projectInfo.voltage;

            if (currentMaxLevel === 2) {
                newPhase = '3Φ3W';
                newVoltage = '380V';
            } else if (currentMaxLevel === 3) {
                newPhase = '3Φ4W';
                newVoltage = '380V';
            }

            if (newPhase !== projectInfo.phase) {
                setProjectInfo(prev => ({ ...prev, phase: newPhase, voltage: newVoltage }));
                setHasChanges(true);
            }
        }
    }, [projectInfo.phase, projectInfo.voltage]);

    // Removed the automatic useEffect sync to allow manual overrides without system fighting back

    // 4. LOAD SUMMARY CALCULATIONS


    // [Phase 1] Zero-Sync (Zustand Store Sync)
    useEffect(() => {
        if (!panelId || !isDataLoaded) return;

        // Construct stable objects for sync
        const syncData = { projectInfo, powerLoads };
        const syncResult = { 
            totalLoad: totalLoad, 
            phaseTotals: phaseTotals,
            summaryStats: summaryStats,
            mainCtValue: mainCtValue,
            calculatedLoads: calculatedLoads 
        };

        const dataStr = JSON.stringify(syncData);
        const resultStr = JSON.stringify(syncResult);

        // 최신 데이터 참조 갱신 (Auto-Save용)
        latestDataRef.current = { projectInfo, powerLoads };

        // [STRICT] Break the reactive loop by guarding with a deep comparison ref
        if (lastSyncRef.current.dataStr !== dataStr || lastSyncRef.current.resultStr !== resultStr) {
            const wasLocalChange = isLocalChangeRef.current;
            lastSyncRef.current = { dataStr, resultStr };
            
            // 즉시 로컬 동기화 상태 표시 (Green)
            if (wasLocalChange) {
                useDataStore.getState().setSyncStatus('local', 'saving');
            }

            // [REACTIVE] Use transition for background sync to keep UI responsive
            startTransition(() => {
                syncPanel(panelId, {
                    ...syncData,
                    projectInfo: { ...projectInfo, cachedTotalLoad: totalLoad, cachedPhaseTotals: phaseTotals }
                }, syncResult);

                if (wasLocalChange) {
                    useDataStore.getState().setSyncStatus('local', 'saved');
                    const timer = setTimeout(() => {
                        const currentLocalStatus = useDataStore.getState().syncStatus?.local;
                        if (currentLocalStatus === 'saved') {
                            useDataStore.getState().setSyncStatus('local', 'idle');
                        }
                    }, 2000);
                    return () => clearTimeout(timer);
                }
            });

            // [MASTER GUIDE] 타 계산서(간선 등)의 즉각적 리액티브 반응을 위한 시그널 발송
            // [REMOVED] Legacy signal
            // localStorage.setItem('kelc_data_update_signal', Date.now().toString());
        }
    }, [panelId, isDataLoaded, projectInfo, powerLoads, totalLoad, phaseTotals, summaryStats, mainCtValue, calculatedLoads, syncPanel]);

    // [Phase 2] Auto-Save to Server (MariaDB / Redis Draft)
    useEffect(() => {
        if (!panelId || !isDataLoaded || !isReadyToCheck || !isLocalChangeRef.current) return;

        const draftKey = getDraftKey(panelId);
        if (!draftKey) return;

        let isActive = true;
        const timer = setTimeout(async () => {
            if (!isActive || !isLocalChangeRef.current) return;

            const { projectInfo: pInfo, powerLoads: pLoads } = latestDataRef.current || {};
            if (!pInfo) return;

            // [GUARD] Don't save to server if data hasn't changed since last save
            const currentDataString = getCoreDataString(pInfo, pLoads);
            if (lastSavedDataRef.current === currentDataString) {
                isLocalChangeRef.current = false;
                return;
            }

            try {
                // [Sync Status] 서버 동기화 시작 (노란색)
                useDataStore.getState().setSyncStatus('remote', 'saving');
                const startTime = Date.now();

                const dataToSave = {
                    projectInfo: { ...pInfo, cachedTotalLoad: totalLoad, cachedPhaseTotals: phaseTotals },
                    powerLoads: pLoads,
                    savedAt: new Date().toISOString(),
                    status: 'DIRTY',
                    isDraft: true
                };

                await setRemoteData(projectId, draftKey, dataToSave);

                // [CONNECTION SYNC] 부모-자식 연결 정보도 함께 갱신
                const connections = [];
                pLoads.forEach(l => {
                    if (l.connectedPanelId) connections.push({ child_panel_id: String(l.connectedPanelId) });
                });
                await savePanelConnections(projectId, panelId, connections);

                // [UPDATE] Sync the guard ref after successful save
                lastSavedDataRef.current = currentDataString;

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
                console.error('[POWER] Auto-save failed:', e);
                useDataStore.getState().setSyncStatus('remote', 'error');
            }
        }, 3000); // 3초 디바운스

        return () => {
            isActive = false;
            clearTimeout(timer);
        };
    }, [panelId, projectId, isDataLoaded, isReadyToCheck, totalLoad, projectInfo, powerLoads]);

    // [SAFETY] KEC 안전 규정 및 'Chk' 감시 훅 통합 (실시간)
    const { maxBranchAT, isATViolation } = useSafetyCheck('power', powerLoads, projectInfo, panelsData);

    // Check if there are any warnings/errors inside the Decide drawer
    const hasDecideWarning = useMemo(() => {
        if (!projectInfo) return false;

        // [GUARD] AT 감시: 메인 AT가 분기 최대 AT보다 작거나 같으면 경고 (Chk.)
        if (isATViolation) return true;

        if (!isCableMethodValid(projectInfo, kecSettings)) return true;

        // 2. Check KEC Judgment statuses
        const getP = (ph) => {
            const cleanPhGetP = String(ph || '').replace(/[-\s]/g, '').replace(/Ø/g, 'Φ').toUpperCase();
            if (cleanPhGetP.includes('1Φ')) return 2;
            if (cleanPhGetP.includes('3Φ3W')) return 3;
            return 4;
        };
        const p = getP(projectInfo.phase);
        const v = projectInfo.phase?.includes('1Φ') ? 220 : 380;
        const ib = p === 2 ? totalLoad / v : totalLoad / (v * Math.sqrt(3));

        // Calculate Panel-level Starting Current (IMS) - Unified with Summary & Drawer
        const sqrt3 = p === 2 ? 1 : Math.sqrt(3);
        const pureKvaSum = (summaryStats?.maxMotorKva || 0) + (summaryStats?.othersSumKva || 0);
        const panelIms = (pureKvaSum * 1000) / (sqrt3 * v);

        const panelCircuit = {
            ib,
            at: projectInfo.mccbAT || 0,
            af: projectInfo.mccbAF || 0,
            type: projectInfo.mainBreakerType || 'MCCB',
            size: projectInfo.cableSize || 0,
            wire: projectInfo.wire || 'FCV',
            method: projectInfo.kecMethod || 'E',
            p,
            cableDistance: projectInfo.branchDistance || 30, // Standardized to 30
            scb: projectInfo.shortCircuitCurrent || 0,
            isGeneral: false, // Set to false to enable ATMS/ATMI judgment
            isPanel: true,
            startingCurrent: panelIms,
            startingTime: summaryStats?.maxAbsoluteTm || 0,
            delta: Number(projectInfo.cachedDelta) || 0,
            delta2: Number(projectInfo.cachedK) || 0,
            inrushCurrent: Number(projectInfo.cachedImi) || 0
        };

        const judgment = calculateKECJudgment(panelCircuit, kecSettings, projectInfo);
        if (!judgment) return false;

        const isFail = (status) => status === 'Fail' || status === 'Error' || status === 'Chk';
        const sections = ['at_b', 'at_th', 'at_sc', 'at_ms', 'at_mi', 'sb', 'scb', 'se', 'smse', 'ssc', 'smsth'];

        return sections.some(sec => isFail(judgment[sec]?.status));
    }, [projectInfo, totalLoad, kecSettings, isATViolation, powerLoads]);

    const selectedLoadForDrawer = useMemo(() => {
        if (!judgmentDrawer.loadId) return null;
        return calculatedLoads.find(l => l.id === judgmentDrawer.loadId);
    }, [judgmentDrawer.loadId, calculatedLoads]);

    // Add new power load
    const addPowerLoad = () => {
        isLocalChangeRef.current = true;
        const newLoad = {
            id: Date.now(),
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
            fixedInrushCurrent: '',
            method: '',
            wire: '',
            size: '',
            phaseLine: 'L1',
            chk: 'Ok'
        };
        setPowerLoads([...powerLoads, newLoad]);
        setHasChanges(true);
    };

    const handleUpdateKecSettings = (field, value) => {
        isLocalChangeRef.current = true;
        const updated = { ...kecSettings, [field]: value };
        setKecSettings(updated);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent('kelc_settings_update_signal'));
    };

    const handleUpdateCableDistance = (newDistance) => {
        if (!judgmentDrawer.loadId) return;
        isLocalChangeRef.current = true;
        setPowerLoads(prev => prev.map(l => {
            if (l.id !== judgmentDrawer.loadId) return l;
            return { ...l, cableDistance: newDistance };
        }));
    };

    // Remove power load
    const removePowerLoad = (id) => {
        isLocalChangeRef.current = true;
        recordHistory(powerLoads);
        const nextLoads = powerLoads.filter(l => l.id !== id);
        setPowerLoads(nextLoads);
        // [CONNECTION SYNC] 즉시 동기화
        handleImmediateConnectionSync(nextLoads);
    };

    // Helper to switch kW/kVA inputs for LOAD type on click
    const handleCapacityFocus = (id, targetField) => {
        isLocalChangeRef.current = true;
        setPowerLoads(prevLoads => {
            let changed = false;
            const newLoads = prevLoads.map(load => {
                if (load.id !== id || load.type !== 'LOAD') return load;
                const otherField = targetField === 'apparentPower' ? 'effectivePower' : 'apparentPower';
                if (!load[targetField] && load[otherField]) {
                    changed = true;
                    return { ...load, [targetField]: load[otherField], [otherField]: '' };
                }
                return load;
            });
            if (changed) {
                // Try to avoid excessive renders, setting dirty flag is safe
                setTimeout(() => setHasChanges(true), 0);
            }
            return newLoads;
        });
    };

    // -------------------------------------------------------------
    // Load Management Handlers
    // -------------------------------------------------------------

    // Update power load field
    const updatePowerLoad = (id, field, value) => {
        isLocalChangeRef.current = true;
        recordHistory(powerLoads);
        setPowerLoads(prev => prev.map(load => {
            if (load.id !== id) return load;
            let updatedLoad = { ...load, [field]: value };

            // 2. [CONNECTION SYNC] connectedPanelId 변경 시 즉시 동기화
            if (field === 'connectedPanelId') {
                const nextLoads = prev.map(l => l.id === id ? { ...l, [field]: value } : l);
                handleImmediateConnectionSync(nextLoads);
            }


            // 1. 전원(PHASE) 선택에 따른 극수(P) 자동 업데이트
            if (field === 'phase') {
                const cleanPhSelect = String(value || '').replace(/[-\s]/g, '').replace(/Ø/g, 'Φ').toUpperCase();
                if (cleanPhSelect.includes('1Φ')) {
                    updatedLoad.cbP = '2';
                    updatedLoad.phaseLine = updatedLoad.phaseLine || 'L1';
                }
                else if (cleanPhSelect.includes('3Φ3W')) updatedLoad.cbP = '3';
                else if (cleanPhSelect.includes('3Φ4W')) updatedLoad.cbP = '4';
            }

            // 1.1 phaseLine 변경 처리
            if (field === 'phaseLine') {
                updatedLoad.phaseLine = value;
            }

            // 2. 종류(TYPE) 변경 시 데이터 이동 및 반대 칸 삭제
            if (field === 'type') {
                if (value === 'SPARE') {
                    showToast('Tip: 장비 사양 입력 후 SPARE 선택', 'info');
                }

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

            if (['type', 'phase', 'startingMethod', 'effectivePower'].includes(field)) {
                updatedLoad = performMCCLookup(updatedLoad);
            }

            // [NEW] Background Auto-sync when a load's phase is upgraded
            if (field === 'phase') {
                const newLevel = PHASE_LEVELS[value] || 1;
                syncMainPhaseWithLoads(newLevel);
            }

            return updatedLoad;
        }));
    };

    // Update project info
    const updateProjectInfo = (field, value) => {
        isLocalChangeRef.current = true;
        setProjectInfo(prev => {
            const next = { ...prev, [field]: value };
            
            // [Optimistic Update] SOURCE(fromId) 또는 주요 필드 변경 시 즉시 전역 스토어 및 타 탭 동기화
            if (['fromId', 'panelName', 'usageType', 'installType', 'branchDistance'].includes(field)) {
                // 1. [Memory-First] Zustand 스토어 즉시 갱신 (타 탭 UPDATE_PANEL 브로드캐스트 유발)
                syncPanel(panelId, 
                    { projectInfo: next, powerLoads },
                    { totalLoad, phaseTotals, summaryStats, mainCtValue, calculatedLoads }
                );
                
                // 2. [Optimistic Connection] fromId 변경 시 전역 계통 맵 업데이트
                if (field === 'fromId') {
                    useDataStore.setState(state => ({
                        panelConnections: { ...state.panelConnections, [panelId]: value }
                    }));
                }
            }
            return next;
        });
    };

    // Save data (Standardized in Phase 2/3)
    const handleSave = async () => {
        if (!projectId || !panelId) return;
        setSyncStatus(panelId, 'DIRTY'); // Mark as manual save needed
    };

    // --- SSOT Sync Layer (Passive Background Sync) ---
    // [Note] Zero-Sync and External Sync are already defined above Phase 1.

    // [NEW] 마운트 시 연결된 하위 계산서(connectedPanel) 자동 로드 (새로고침 대응)
    // syncPLCircuits가 panelsData[connectedPanelId]를 참조하므로,
    // 자식 데이터가 스토어에 반드시 먼저 로드되어야 합니다.
    useEffect(() => {
        if (!isDataLoaded || powerLoads.length === 0) return;

        let delay = 0;
        powerLoads.forEach(load => {
            const pId = load.connectedPanelId;
            if (pId && !panelsData[pId] && !loadingPanelsRef.current.has(pId)) {
                loadingPanelsRef.current.add(pId);
                setTimeout(async () => {
                    try {
                        await loadPanelStore(pId);
                    } catch (e) {
                        console.error(`[PowerLoad] Failed to pre-load child panel ${pId}:`, e);
                    } finally {
                        loadingPanelsRef.current.delete(pId);
                    }
                }, delay);
                delay += 50;
            }
        });
    }, [isDataLoaded, powerLoads, panelsData, loadPanelStore]);

    // --- PL Circuits Sync (Real-time child panel sync) ---
    const syncPLCircuits = useCallback(() => {
        if (!isDataLoaded || !projectId) return;

        startTransition(() => {
            let hasChangesLocal = false;
            const updatedPowerLoads = powerLoads.map((l) => {
                if (!l.connectedPanelId) return l;

                const remoteData = panelsData[l.connectedPanelId];
                if (!remoteData || !remoteData.projectInfo) return l;

                const subResult = results[l.connectedPanelId];
                
                const newVa = subResult?.totalLoad ?? 
                              remoteData.projectInfo?.cachedTotalLoad ?? 
                              calculatePanelTotalLoad(remoteData);
                
                const newName = remoteData.projectInfo?.panelName || l.equipmentName;
                
                const meta = {
                    type: remoteData.projectInfo.mainBreakerType || 'MCCB',
                    phase: remoteData.projectInfo.phase || '3Φ-4W',
                    at: remoteData.projectInfo.mccbAT || '',
                    af: remoteData.projectInfo.mccbAF || '',
                    method: remoteData.projectInfo.kecMethod || 'E',
                    wire: remoteData.projectInfo.wire || 'FCV',
                    size: remoteData.projectInfo.cableSize || ''
                };

                const vaDiffers = String(l.apparentPower) !== String(newVa);
                const nameDiffers = l.equipmentName !== newName;
                const metaDiffers = JSON.stringify(l.plMetadata) !== JSON.stringify(meta);

                if (vaDiffers || nameDiffers || metaDiffers) {
                    hasChangesLocal = true;
                    return { 
                        ...l, 
                        equipmentName: newName, 
                        apparentPower: newVa,
                        cbType: meta.type,
                        at: meta.at,
                        method: meta.method,
                        wire: meta.wire,
                        size: meta.size,
                        plMetadata: meta 
                    };
                }
                return l;
            });

            if (hasChangesLocal) {
                setPowerLoads(updatedPowerLoads);
                setHasChanges(true);
            }
        });
    }, [isDataLoaded, projectId, powerLoads, panelsData, results, setPowerLoads]);

    useEffect(() => {
        // [ZERO SYNC] 스토어 변경 시 즉시 동기화 실행
        syncPLCircuits();
    }, [panelsData, results]);

    if (isHydrating) {
        return (
            <div className="min-h-screen bg-black text-gray-400 p-2 sm:p-4 lg:p-6 flex flex-col gap-4 overflow-hidden">
                <div className="max-w-[1920px] mx-auto w-full flex flex-col gap-4">
                    <div className="h-20 bg-gray-900/20 rounded-xl border border-white/5 animate-pulse"></div>
                    <div className="h-16 bg-gray-900/10 rounded-xl border border-white/5 animate-pulse"></div>
                    <div className="flex-1 bg-gray-900/20 rounded-xl border border-white/5 p-4 space-y-3">
                        {[...Array(15)].map((_, i) => (
                            <div key={i} className="h-8 bg-white/5 rounded animate-pulse" />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div 
            className="min-h-screen bg-black text-gray-300 p-2 sm:p-4 lg:p-6 selection:bg-lime-500/30"
            onClick={() => setSelectedRows([])}
        >
            {toast.show && (
                <div className="fixed bottom-6 md:bottom-10 left-1/2 -translate-x-1/2 z-[10002] anim-fade-in group/toast">
                    <div className={`flex items-center gap-3 md:gap-4 px-4 md:px-6 py-3 md:py-4 rounded-xl md:rounded-2xl border shadow-2xl backdrop-blur-md min-w-[280px] md:min-w-[360px] max-w-[90%] 
                        ${toast.type === 'error'
                            ? 'bg-red-950/95 border-red-500/50 text-red-100 shadow-red-950/40'
                            : 'bg-indigo-950/95 border-indigo-500/50 text-indigo-100 shadow-indigo-950/40'
                        }`}>
                        <div className={`shrink-0 ${toast.type === 'error' ? 'text-red-500' : 'text-indigo-400'}`}>
                            {toast.type === 'error' ? <AlertCircle className="w-[22px] h-[22px] md:w-[28px] md:h-[28px]" /> : <CheckCircle className="w-[22px] h-[22px] md:w-[28px] md:h-[28px]" />}
                        </div>
                        <div className="flex-1 text-[12.5px] md:text-[14.5px] font-medium tracking-wide">
                            {toast.message}
                        </div>
                        <button
                            onClick={() => setToast(prev => ({ ...prev, show: false }))}
                            className="shrink-0 p-1 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
                        >
                            <X className="w-4 h-4 md:w-5 md:h-5" />
                        </button>
                    </div>
                </div>
            )}

            <div className="max-w-[1920px] mx-auto w-full">
                <PowerProjectInfoBar
                    projectInfo={projectInfo}
                    editingPanelName={editingPanelName}
                    setEditingPanelName={setEditingPanelName}
                    handlePanelNameCommit={handlePanelNameCommit}
                    getNameById={getNameById}
                    getIdByName={getIdByName}
                    getParentId={getParentId}
                    panelId={panelId}
                    sourceSearchText={sourceSearchText}
                    setSourceSearchText={setSourceSearchText}
                    showSourceDropdown={showSourceDropdown}
                    setShowSourceDropdown={setShowSourceDropdown}
                    sourceSelectedIndex={sourceSelectedIndex}
                    setSourceSelectedIndex={setSourceSelectedIndex}
                    sourceDropdownRef={sourceDropdownRef}
                    panels={panels}
                    updateProjectInfo={updateProjectInfo}
                    checkCircularDependency={checkCircularDependency}
                    lastSourceChangeRef={lastSourceChangeRef}
                    showToast={showToast}
                    isMainPhaseInvalid={isMainPhaseInvalid}
                    PHASE_LEVELS={PHASE_LEVELS}
                    maxLoadLevel={maxLoadLevel}
                    syncStatus={syncStatus}
                />

                <PowerLoadTable
                    isExtraExpanded={isExtraExpanded}
                    setIsExtraExpanded={setIsExtraExpanded}
                    calculatedLoads={calculatedLoads}
                    selectedRows={selectedRows}
                    handleRowClick={handleRowClick}
                    handleContextMenu={handleContextMenu}
                    handleDragStart={handleDragStart}
                    handleDragOver={handleDragOver}
                    handleDragLeave={handleDragLeave}
                    handleDrop={handleDrop}
                    handleDragEnd={handleDragEnd}
                    draggedRow={draggedRow}
                    dropTarget={dropTarget}
                    updatePowerLoad={updatePowerLoad}
                    addPowerLoad={addPowerLoad}
                    handleCapacityFocus={handleCapacityFocus}
                    openParallelPopup={(id) => { setIsParallelPopupOpen(true); setParallelPopupLoadId(id); }}
                    openJudgmentDrawer={(id, section = null) => setJudgmentDrawer({ show: true, loadId: id, highlightSection: section })}
                    BREAKER_TYPES={BREAKER_TYPES}
                    projectInfo={projectInfo}
                    kecSettings={kecSettings}
                    getMethodDisabledOptions={getMethodDisabledOptions}
                />

                <PowerLoadKECDrawer
                    isOpen={judgmentDrawer.show}
                    onClose={() => setJudgmentDrawer({ show: false, loadId: null, highlightSection: null })}
                    load={selectedLoadForDrawer}
                    highlightSection={judgmentDrawer.highlightSection}
                    onUpdateCableDistance={handleUpdateCableDistance}
                    onUpdateKecSettings={handleUpdateKecSettings}
                    onUpdateCircuit={updatePowerLoad}
                    kecSettings={kecSettings}
                    projectInfo={projectInfo}
                />

                <PowerLoadSummary
                    projectInfo={projectInfo}
                    updateProjectInfo={updateProjectInfo}
                    totalLoad={totalLoad}
                    phaseTotals={phaseTotals}
                    totalCurrentCalc={totalCurrentCalc}
                    mainCtValue={mainCtValue}
                    summaryStats={summaryStats}
                    hasDecideWarning={hasDecideWarning}
                    setIsPanelKECDrawerOpen={setIsPanelKECDrawerOpen}
                    setPanelHighlightSection={setPanelHighlightSection}
                    exportToExcel={exportToExcel}
                    PHASE_LEVELS={PHASE_LEVELS}
                    maxLoadLevel={maxLoadLevel}
                    showToast={showToast}
                    kecSettings={kecSettings}
                />

                <ContextMenu
                    contextMenu={contextMenu}
                    closeContextMenu={closeContextMenu}
                    handleInsertRow={handleInsertRow}
                    handleCopy={handleCopy}
                    handleCut={handleCut}
                    handlePaste={handlePaste}
                    clipboard={clipboard}
                    handleInsertPaste={handleInsertPaste}
                    handleDeleteSelected={handleDeleteSelected}
                    selectedRows={selectedRows}
                />

                <ParallelConductorPopup
                    isOpen={isParallelPopupOpen}
                    onClose={() => {
                        setIsParallelPopupOpen(false);
                        setParallelPopupLoadId(null);
                    }}
                    onApply={(newMethod) => {
                        if (parallelPopupLoadId) {
                            updatePowerLoad(parallelPopupLoadId, 'method', newMethod);
                        }
                        setIsParallelPopupOpen(false);
                        setParallelPopupLoadId(null);
                    }}
                    initialValue={calculatedLoads.find(l => l.id === parallelPopupLoadId)?.method || ''}
                    wire={calculatedLoads.find(l => l.id === parallelPopupLoadId)?.wire}
                    size={calculatedLoads.find(l => l.id === parallelPopupLoadId)?.size}
                    kecSettings={kecSettings}
                />

                <PowerPanelKECDrawer
                    isOpen={isPanelKECDrawerOpen}
                    onClose={() => {
                        setIsPanelKECDrawerOpen(false);
                        setPanelHighlightSection(null);
                    }}
                    projectInfo={projectInfo}
                    updateProjectInfo={updateProjectInfo}
                    onUpdateKecSettings={handleUpdateKecSettings}
                    totalLoad={totalLoad}
                    kecSettings={kecSettings}
                    summaryStats={summaryStats}
                    highlightSection={panelHighlightSection}
                    maxBranchAT={maxBranchAT}
                />

                <ExportSaveModal
                    showExportSaveModal={showExportSaveModal}
                    setShowExportSaveModal={setShowExportSaveModal}
                    performExcelExport={performExcelExport}
                    handleExportSaveConfirm={handleExportSaveConfirm}
                />
            </div>
        </div>
    );
};

export default PowerLoadContent;
// Force HMR Update

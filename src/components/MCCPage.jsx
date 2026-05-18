import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Save, RotateCcw, Search, X, Info, Trash2, BookOpen } from 'lucide-react';
import MCC_DATA from '../data/MCC.json';
import { getRemoteData, setRemoteData, getActiveProjectId } from '../services/projectService';
import MasterNavModal from './common/MasterNavModal';
import useDataStore from '../store/useDataStore';

const MCCPage = () => {
    const STORAGE_KEY = 'kelc_mcc_settings';
    const [searchTerm, setSearchTerm] = useState('');
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isNavOpen, setIsNavOpen] = useState(false);
    const searchRef = useRef(null);

    // Modal State
    const [modal, setModal] = useState({
        show: false,
        title: '',
        message: '',
        type: 'info', // 'info', 'warning'
        onConfirm: null
    });

    // Dirty Check Modal State
    const [dirtyCheckModal, setDirtyCheckModal] = useState({
        isOpen: false,
        pendingPath: null
    });

    // Store initial values to detect changes
    const [initialValues, setInitialValues] = useState(null);

    // Independent Slider States
    const [betaDirect1P, setBetaDirect1P] = useState(6.0);
    const [betaDirect3PSmall, setBetaDirect3PSmall] = useState(9.5); // 0.75 ~ 2.2 kW
    const [betaDirect3PLarge, setBetaDirect3PLarge] = useState(8.2); // 2.2 ~ 11 kW
    const [betaYD, setBetaYD] = useState(7.2);
    const [betaReactor, setBetaReactor] = useState(7.7);
    const [reactorTap, setReactorTap] = useState(0.65); // Default 65%
    const [lambdaInv, setLambdaInv] = useState(1.2); // Default 1.2 for INV

    // Starting Time States (tm)
    const [tmDOL, setTmDOL] = useState(2);
    const [tmYD, setTmYD] = useState(6);
    const [tmReactor, setTmReactor] = useState(10);
    const [tmINV, setTmINV] = useState(4);

    // Other Motor Settings States
    const [globalCosPhi, setGlobalCosPhi] = useState('Default');
    const [cosPhiS, setCosPhiS] = useState(0.2);
    const [globalK, setGlobalK] = useState(1.5);
    const [globalCT, setGlobalCT] = useState(1.25);
    const [customPFs, setCustomPFs] = useState({}); // Store custom PF values by row index

    // Get current values for comparison
    const getCurrentValues = useCallback(() => ({
        betaDirect1P,
        betaDirect3PSmall,
        betaDirect3PLarge,
        betaYD,
        betaReactor,
        reactorTap,
        lambdaInv,
        tmDOL,
        tmYD,
        tmReactor,
        tmINV,
        globalCosPhi,
        cosPhiS,
        globalK,
        globalCT,
        customPFs: JSON.stringify(customPFs)
    }), [betaDirect1P, betaDirect3PSmall, betaDirect3PLarge, betaYD, betaReactor, reactorTap, lambdaInv, tmDOL, tmYD, tmReactor, tmINV, globalCosPhi, cosPhiS, globalK, globalCT, customPFs]);

    // Check if there are unsaved changes
    const hasUnsavedChanges = useCallback(() => {
        if (!initialValues) return false;
        const current = getCurrentValues();
        return JSON.stringify(current) !== JSON.stringify(initialValues);
    }, [initialValues, getCurrentValues]);

    // Load saved data from MariaDB (per-project), fallback to localStorage
    useEffect(() => {
        const getDefaultLoadedValues = () => ({
            betaDirect1P: 6.0,
            betaDirect3PSmall: 9.5,
            betaDirect3PLarge: 8.2,
            betaYD: 7.2,
            betaReactor: 7.7,
            reactorTap: 0.65,
            lambdaInv: 1.2,
            tmDOL: 2,
            tmYD: 6,
            tmReactor: 10,
            tmINV: 4,
            globalCosPhi: 'Default',
            cosPhiS: 0.2,
            globalK: 1.5,
            globalCT: 1.25,
            customPFs: '{}'
        });

        const applyParsed = (parsed, loadedValues) => {
            if (parsed.independentSliders) {
                setBetaDirect1P(parsed.independentSliders.betaDirect1P);
                setBetaDirect3PSmall(parsed.independentSliders.betaDirect3PSmall);
                setBetaDirect3PLarge(parsed.independentSliders.betaDirect3PLarge);
                setBetaYD(parsed.independentSliders.betaYD);
                setBetaReactor(parsed.independentSliders.betaReactor);
                setReactorTap(parsed.independentSliders.reactorTap);
                setLambdaInv(parsed.independentSliders.lambdaInv);

                loadedValues.betaDirect1P = parsed.independentSliders.betaDirect1P;
                loadedValues.betaDirect3PSmall = parsed.independentSliders.betaDirect3PSmall;
                loadedValues.betaDirect3PLarge = parsed.independentSliders.betaDirect3PLarge;
                loadedValues.betaYD = parsed.independentSliders.betaYD;
                loadedValues.betaReactor = parsed.independentSliders.betaReactor;
                loadedValues.reactorTap = parsed.independentSliders.reactorTap;
                loadedValues.lambdaInv = parsed.independentSliders.lambdaInv;
            }
            if (parsed.startTimes) {
                setTmDOL(parsed.startTimes.tmDOL);
                setTmYD(parsed.startTimes.tmYD);
                setTmReactor(parsed.startTimes.tmReactor);
                setTmINV(parsed.startTimes.tmINV);

                loadedValues.tmDOL = parsed.startTimes.tmDOL;
                loadedValues.tmYD = parsed.startTimes.tmYD;
                loadedValues.tmReactor = parsed.startTimes.tmReactor;
                loadedValues.tmINV = parsed.startTimes.tmINV;
            }
            if (parsed.otherSettings) {
                setGlobalCosPhi(parsed.otherSettings.globalCosPhi);
                setCosPhiS(parsed.otherSettings.cosPhiS);
                setGlobalK(parsed.otherSettings.globalK);
                setGlobalCT(parsed.otherSettings.globalCT);
                setCustomPFs(parsed.otherSettings.customPFs || {});

                loadedValues.globalCosPhi = parsed.otherSettings.globalCosPhi;
                loadedValues.cosPhiS = parsed.otherSettings.cosPhiS;
                loadedValues.globalK = parsed.otherSettings.globalK;
                loadedValues.globalCT = parsed.otherSettings.globalCT;
                loadedValues.customPFs = JSON.stringify(parsed.otherSettings.customPFs || {});
            }
        };

        const loadInitialSettings = async () => {
            const defaultKey = 'kelc_mcc_settings';
            const projectId = getActiveProjectId();
            const projectKey = projectId ? `${defaultKey}_${projectId}` : defaultKey;
            
            let loadedValues = getDefaultLoadedValues();

            // 1. Try MariaDB (per-project) first
            let loaded = false;
            try {
                if (projectId) {
                    // Search for project-specific key first
                    let remote = await getRemoteData(projectKey, projectId);
                    
                    // Fallback to global key ONLY IF project-specific doesn't exist (Migration)
                    if (!remote && projectKey !== defaultKey) {
                        remote = await getRemoteData(defaultKey, projectId);
                        if (remote) {
                            console.log('Migrating global MCC settings to project-specific storage...');
                            await setRemoteData(projectId, projectKey, remote);
                        }
                    }

                    if (remote) {
                        applyParsed(remote, loadedValues);
                        // Sync to localStorage for consumer components
                        localStorage.setItem(projectKey, JSON.stringify(remote));
                        loaded = true;
                    }
                }
            } catch (e) {
                console.error('Failed to load MCC settings from MariaDB:', e);
            }

            // 2. Fallback to localStorage
            if (!loaded) {
                const saved = localStorage.getItem(projectKey) || localStorage.getItem(defaultKey);
                if (saved) {
                    try {
                        applyParsed(JSON.parse(saved), loadedValues);
                    } catch (e) {
                        console.error('Failed to load MCC settings from localStorage:', e);
                    }
                }
            }

            // Store initial values for dirty checking
            setInitialValues(loadedValues);
        };

        loadInitialSettings();
    }, []);

    // Update localStorage dirty state when values change
    useEffect(() => {
        if (initialValues) {
            const isDirty = hasUnsavedChanges();
            localStorage.setItem('kelc_mcc_is_dirty', isDirty ? 'true' : 'false');
        }
        // Cleanup on unmount
        return () => {
            localStorage.removeItem('kelc_mcc_is_dirty');
        };
    }, [hasUnsavedChanges, initialValues]);

    // Listen for navigation requests and intercept if dirty
    useEffect(() => {
        const handleNavRequest = (e) => {
            if (hasUnsavedChanges()) {
                e.preventDefault();
                e.stopImmediatePropagation();
                setDirtyCheckModal({ isOpen: true, pendingPath: e.detail.path });
            }
        };
        window.addEventListener('kelc_mcc_nav_check', handleNavRequest);
        return () => window.removeEventListener('kelc_mcc_nav_check', handleNavRequest);
    }, [hasUnsavedChanges]);

    // Save to MariaDB (per-project) + localStorage write-through
    const handleSave = async (showModal = true) => {
        const data = {
            independentSliders: {
                betaDirect1P,
                betaDirect3PSmall,
                betaDirect3PLarge,
                betaYD,
                betaReactor,
                reactorTap,
                lambdaInv
            },
            startTimes: {
                tmDOL,
                tmYD,
                tmReactor,
                tmINV
            },
            otherSettings: {
                globalCosPhi,
                cosPhiS,
                globalK,
                globalCT,
                customPFs
            }
        };

        const defaultKey = 'kelc_mcc_settings';
        const projectId = getActiveProjectId();
        const projectKey = projectId ? `${defaultKey}_${projectId}` : defaultKey;

        // 1. Write to localStorage for instant same-tab sync with consumers
        localStorage.setItem(projectKey, JSON.stringify(data));
        window.dispatchEvent(new Event('kelc_mcc_settings_updated'));

        // 2. Persist to MariaDB (per-project)
        try {
            if (projectId) {
                await setRemoteData(projectId, projectKey, data);
            }
        } catch (e) {
            console.error('Failed to save MCC settings to MariaDB:', e);
        }

        // Update initial values after save
        setInitialValues(getCurrentValues());

        if (showModal) {
            setModal({
                show: true,
                title: '설정 저장',
                message: '설정이 성공적으로 저장되었습니다.',
                type: 'info'
            });
        }

        // [ZERO SYNC] 타 탭 동기화
        useDataStore.getState().updateSettings('mcc', data);
    };

    // Listen for save trigger from Header's dirty check modal
    useEffect(() => {
        const handleTriggerSave = () => {
            if (hasUnsavedChanges()) {
                handleSave(false); // Save without showing modal
            }
            // Dispatch save finished event
            window.dispatchEvent(new Event('kelc_save_finished'));
        };
        window.addEventListener('kelc_trigger_save', handleTriggerSave);
        return () => window.removeEventListener('kelc_trigger_save', handleTriggerSave);
    }, [hasUnsavedChanges]);

    // Reset functionality
    const handleReset = () => {
        setModal({
            show: true,
            title: '설정 초기화',
            message: '모든 설정을 기본값으로 되돌리시겠습니까?',
            type: 'warning',
            onConfirm: async () => {
                // Independent Sliders
                setBetaDirect1P(6.0);
                setBetaDirect3PSmall(9.5);
                setBetaDirect3PLarge(8.2);
                setBetaYD(7.2);
                setBetaReactor(7.7);
                setReactorTap(0.65);
                setLambdaInv(1.2);

                // Starting Times
                setTmDOL(2);
                setTmYD(6);
                setTmReactor(10);
                setTmINV(4);

                // Other Settings
                setGlobalCosPhi('Default');
                setCosPhiS(0.2);
                setGlobalK(1.5);
                setGlobalCT(1.25);
                setCustomPFs({});

                // Build defaults data object for storage
                const defaults = {
                    independentSliders: {
                        betaDirect1P: 6.0,
                        betaDirect3PSmall: 9.5,
                        betaDirect3PLarge: 8.2,
                        betaYD: 7.2,
                        betaReactor: 7.7,
                        reactorTap: 0.65,
                        lambdaInv: 1.2
                    },
                    startTimes: { tmDOL: 2, tmYD: 6, tmReactor: 10, tmINV: 4 },
                    otherSettings: {
                        globalCosPhi: 'Default',
                        cosPhiS: 0.2,
                        globalK: 1.5,
                        globalCT: 1.25,
                        customPFs: {}
                    }
                };

                // 1. Write defaults to localStorage for instant sync
                const defaultKey = 'kelc_mcc_settings';
                const projectId = getActiveProjectId();
                const projectKey = projectId ? `${defaultKey}_${projectId}` : defaultKey;

                localStorage.setItem(projectKey, JSON.stringify(defaults));
                window.dispatchEvent(new Event('kelc_mcc_settings_updated'));

                // 2. Persist defaults to MariaDB (per-project)
                try {
                    if (projectId) {
                        await setRemoteData(projectId, projectKey, defaults);
                    }
                } catch (e) {
                    console.error('Failed to reset MCC settings in MariaDB:', e);
                }

                // [ZERO SYNC] 타 탭 동기화
                useDataStore.getState().updateSettings('mcc', defaults);

                setModal({ show: false, title: '', message: '', type: 'info' });
            }
        });
    };

    // Close search on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (searchRef.current && !searchRef.current.contains(event.target)) {
                // Only close if search term is empty, or if user intentionally clicks away
                // But typically, if they click away, they want it closed.
                setIsSearchOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const headers = [
        { label: '기동방식', sub: '', colSpan: 1 },
        { label: '정격출력', sub: '[kW]', colSpan: 1 },
        { label: '상수', sub: 'P', colSpan: 1 },
        { label: '전압', sub: '[V]', colSpan: 1 },
        { label: '역률', sub: 'cosθ', colSpan: 1 },
        { label: '효율', sub: 'η', colSpan: 1 },
        { label: '설계전류', sub: <>I<sub>B</sub> [A]</>, colSpan: 1 },
        { label: '기동배율', sub: 'β', colSpan: 1 },
        { label: '기동계수', sub: 'C', colSpan: 1 },
        { label: '전류제한', sub: 'λ', colSpan: 1 },
        { label: '전류배율', sub: 'k', colSpan: 1 },
        { label: '기동전류', sub: <>I<sub>MS</sub> [A]</>, colSpan: 1 },
        { label: '기동돌입전류', sub: <>I<sub>i</sub> [A]</>, colSpan: 1 },
        { label: '기동시간', sub: <>t<sub>m</sub> [sec]</>, colSpan: 1 },
        { label: 'CT', sub: '', colSpan: 1 },
        { label: '콘덴서', sub: '[μF]', colSpan: 1 },
        { label: 'UNIT SIZE', sub: '[mm]', colSpan: 1 },
    ];

    const CornerBorders = () => (
        <>
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-gray-800"></div>
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-gray-800"></div>
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-gray-800"></div>
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-gray-800"></div>
        </>
    );

    const Highlight = ({ text, query }) => {
        if (!query || !text) return text;
        const parts = text.toString().split(new RegExp(`(${query})`, 'gi'));
        return (
            <span>
                {parts.map((part, i) =>
                    part.toLowerCase() === query.toLowerCase() ? (
                        <mark key={i} className="bg-blue-500/40 text-white rounded-sm px-0.5">{part}</mark>
                    ) : (
                        part
                    )
                )}
            </span>
        );
    };

    // Helper function to calculate row data
    const calculateRowResult = (originalRow, rowIndex) => {
        // Clone row to avoid mutation
        const row = [...originalRow];

        const method = row[0]?.toString().trim().toUpperCase();  // Index 0: Method
        const kw = parseFloat(row[1]) || 0;                      // Index 1: kW
        const phase = parseInt(row[2]) || 3;                     // Index 2: Phase (Assuming 2=1P, 3=3P default)
        const volt = parseFloat(row[3]) || 380;                  // Index 3: Voltage
        const eff = parseFloat(row[4]) || 1;                     // Index 4: Efficiency

        // 0. Update Power Factor (Index 5)
        let pf = parseFloat(row[5]) || 1;
        if (globalCosPhi === 'Custom') {
            // Use custom value if exists, otherwise keep original
            if (customPFs[rowIndex] !== undefined) {
                pf = parseFloat(customPFs[rowIndex]);
            }
        }
        // If globalCosPhi is Default, we use the original row[5] which is already in pf
        // Ensure pf is valid number
        if (isNaN(pf)) pf = 0.8; // Fallback
        row[5] = pf.toString();


        let beta = row[7]; // Default from JSON
        let methodColor = "text-white"; // Default color

        // 1. Determine Beta & Color
        if (method === 'DOL' || method.includes('직입')) {
            // Check phase for Direct
            if (phase === 2 || volt === 220) { // Assuming 1-Phase logic
                beta = betaDirect1P;
                methodColor = "text-white";
            } else {
                // 3-Phase Logic: <= 2.2kW vs > 2.2kW
                if (kw <= 2.2) {
                    beta = betaDirect3PSmall;
                    methodColor = "text-blue-400"; // Blue for Small
                } else {
                    beta = betaDirect3PLarge;
                    methodColor = "text-green-400"; // Green for Large
                }
            }
        } else if (method === 'Y-D') {
            beta = betaYD;
            methodColor = "text-amber-400";
        } else if (method === '리액터' || method.includes('REACTOR')) {
            beta = betaReactor;
            methodColor = "text-rose-400";
        } else if (method === 'INV' || method.includes('INVERTER')) {
            methodColor = "text-gray-400"; // Inverter default
        }

        // Update Beta in row
        row[7] = typeof beta === 'number' ? beta.toFixed(1) : beta;

        // 1.5 Calculate Starting Coefficient (C) (Index 8)
        let cValue = 1; // Default
        if (method === 'DOL' || method.includes('직입')) {
            cValue = 1;
        } else if (method === 'Y-D') {
            cValue = 0.33;
        } else if (method === '리액터' || method.includes('REACTOR')) {
            cValue = reactorTap;
        } else if (method === 'INV' || method.includes('INVERTER')) {
            // For Inverter, C usually doesn't apply the same way, but let's keep it 1 or 0? 
            // Existing code used row[8] from JSON. 
            // Let's assume 1 if not specified, or use existing from JSON if we want to be safe for others?
            // But request implies "Connection" for all.
            cValue = 1;
            // Ideally Inv usually limits current via Lambda, so C might be irrelevant.
        }

        // Update C in row
        row[8] = cValue.toString();

        // 2. Calculate Design Current (IB) (Index 6)
        let ib = 0;
        const denominator = volt * eff * pf;

        if (denominator !== 0) {
            if (phase === 2 || (volt === 220 && phase !== 3)) { // 1-Phase
                ib = (kw * 1000) / denominator;
            } else { // 3-Phase
                ib = (kw * 1000) / (Math.sqrt(3) * denominator);
            }
        }
        // Update IB in row
        row[6] = ib.toFixed(2);

        // 3. Calculate Starting Current (IMS) (Index 11)
        let ims = 0;
        const betaVal = parseFloat(row[7]) || 0;
        const cVal = parseFloat(row[8]) || 0;
        const lambdaVal = parseFloat(row[9]) || 0;

        if (method === 'INV' || method.includes('INVERTER')) {
            // Override Lambda for INV with global setting
            row[9] = lambdaInv.toFixed(2); // Update displayed Lambda column
            ims = ib * lambdaInv;
        } else {
            ims = ib * betaVal * cVal;
        }
        row[11] = ims > 0 ? ims.toFixed(2) : '-';

        // 4. Calculate Inrush Current (Ii) (Index 12)
        // Ii = IMS * k (Index 10)
        // ** UPDATE: Use globalK **
        // 4. Calculate Inrush Current (Ii) (Index 12)
        // Ii = IMS * k (Index 10)
        // ** UPDATE: Use globalK, but set to 1.0 for INV **
        let kVal = globalK;
        if (method === 'INV' || method.includes('INVERTER')) {
            kVal = 1.0;
        }

        row[10] = kVal.toFixed(1); // Update displayed k
        const ii = ims * kVal;
        row[12] = ii > 0 ? ii.toFixed(2) : '-';

        // 5. Update Starting Time (tm) (Index 13)
        let tmValue = 0;
        if (method === 'DOL' || method.includes('직입')) {
            tmValue = tmDOL;
        } else if (method === 'Y-D') {
            tmValue = tmYD;
        } else if (method === '리액터' || method.includes('REACTOR')) {
            tmValue = tmReactor;
        } else if (method === 'INV' || method.includes('INVERTER')) {
            tmValue = tmINV;
        } else {
            // Fallback to json if exists or 0
            tmValue = parseFloat(row[13]) || 0;
        }
        row[13] = tmValue.toString();

        // Update Efficiency/PF strings to 2 decimals
        row[4] = eff.toFixed(2);
        row[5] = pf.toFixed(2);

        // Swap Efficiency (Index 4) and Power Factor (Index 5) for display
        const tempEff = row[4];
        row[4] = row[5]; // PF moves to 4
        row[5] = tempEff; // Eff moves to 5

        return { rowData: row, colorClass: methodColor, originalIndex: rowIndex };
    };


    // Process rows: Calculate then Filter
    const ProcessedResults = MCC_DATA.map((row, index) => calculateRowResult(row, index));

    const filteredResults = ProcessedResults.filter(item =>
        item.rowData.some(cell => cell.toString().toLowerCase().includes(searchTerm.toLowerCase()))
    );


    // Reusable Slider Component
    const renderSlider = (label, value, setValue, colorClass, textClass, bgClass) => (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <div className={`text-[13px] font-bold ${textClass} transition-colors duration-300`}>
                    {label}
                </div>
                <div className={`text-[13px] font-bold ${textClass} transition-colors duration-300`}>
                    {value.toFixed(1)}
                </div>
            </div>

            <div className="relative h-6 flex items-center">
                {/* Track Background */}
                <div className="absolute inset-x-0 h-1 bg-gray-800 rounded-full overflow-hidden">
                    <div className={`h-full opacity-20 ${bgClass}`}></div>
                </div>

                {/* Active Track */}
                <div
                    className={`absolute left-0 h-1 rounded-full ${colorClass} transition-all duration-75 ease-out opacity-70`}
                    style={{ width: `${((value - 1) / 9) * 100}%` }}
                ></div>

                {/* Slider Input */}
                <input
                    type="range"
                    min="1.0"
                    max="10.0"
                    step="0.1"
                    value={value}
                    onChange={(e) => setValue(parseFloat(e.target.value))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />

                {/* Custom Thumb */}
                <div
                    className={`absolute h-4 w-4 rounded-full border border-white/60 shadow-[0_0_10px_rgba(0,0,0,0.3)] flex items-center justify-center pointer-events-none transition-all duration-75 ease-out z-0 ${colorClass}`}
                    style={{ left: `calc(${((value - 1) / 9) * 100}% - 8px)` }}
                >
                    <div className="w-1 h-1 bg-white rounded-full"></div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-black text-gray-400 p-1 sm:p-4 lg:p-6 selection:bg-blue-500/30">
            <div className="max-w-[1920px] mx-auto w-full px-1 sm:px-4">
                {/* Header Section */}
                <div className="relative mb-4 sm:mb-6 mt-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center select-none">
                                <div className="w-1.5 sm:w-2 h-6 sm:h-8 bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.5)]"></div>
                            </div>
                            <h1 className="text-[19px] sm:text-[25.5px] font-bold text-white tracking-widest uppercase">
                                MCC <span className="text-gray-500 text-[14px] sm:text-[18px]">Motor Control Center</span>
                            </h1>
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                            {/* Expandable Rectangular Search Bar */}
                            <div
                                ref={searchRef}
                                className={`relative transition-all duration-300 ease-in-out ${isSearchOpen ? 'w-full sm:w-[280px]' : ''}`}
                            >
                                <div
                                    onClick={() => setIsSearchOpen(true)}
                                    className={`flex items-center bg-gray-900/50 border border-gray-800 transition-all duration-300 ${isSearchOpen ? 'border-blue-500/50 pr-4 h-9' : 'cursor-pointer hover:border-gray-700 w-9 h-9'}`}
                                >
                                    <div className="flex items-center justify-center w-9 h-9 flex-shrink-0">
                                        <Search size={16} className={`transition-colors ${isSearchOpen ? 'text-blue-500' : 'text-gray-500'}`} />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="SEARCH..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        onFocus={() => setIsSearchOpen(true)}
                                        className={`bg-transparent border-none text-white text-[12px] py-2 focus:outline-none transition-all duration-300 tracking-widest placeholder:text-gray-700 w-full ${isSearchOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none w-0'}`}
                                    />
                                    {searchTerm && isSearchOpen && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSearchTerm('');
                                            }}
                                            className="text-gray-500 hover:text-white transition-colors flex-shrink-0"
                                        >
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Reset Button */}
                            <button
                                onClick={handleReset}
                                title="RESET"
                                className="w-9 h-9 bg-gray-900/50 border border-gray-800 flex items-center justify-center transition-all flex-shrink-0 group/reset"
                            >
                                <RotateCcw size={16} className="text-gray-500 group-hover/reset:text-red-500 transition-colors" />
                            </button>

                            {/* Save Button */}
                            <button
                                onClick={handleSave}
                                title="SAVE"
                                className="w-9 h-9 bg-gray-900/50 border border-gray-800 flex items-center justify-center transition-all flex-shrink-0 group/save"
                            >
                                <Save size={16} className="text-gray-500 group-hover/save:text-blue-500 transition-colors" />
                            </button>

                            <button
                                onClick={() => setIsNavOpen(true)}
                                className="w-9 h-9 bg-gray-900/50 border border-gray-800 flex items-center justify-center transition-all hover:border-emerald-500/50 group/nav flex-shrink-0"
                                title="TECHNICAL STANDARDS"
                            >
                                <BookOpen size={16} className="text-gray-500 group-hover/nav:text-emerald-400 transition-colors" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Custom Notification Modal */}
                {modal.show && (
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100]" onClick={() => setModal({ ...modal, show: false })}>
                        <div className="border border-gray-900 bg-black p-6 max-w-md w-full mx-4 relative" onClick={e => e.stopPropagation()}>
                            <CornerBorders />
                            <div className="flex items-start gap-4">
                                <div className={`w-12 h-12 flex items-center justify-center flex-shrink-0 ${modal.type === 'warning' ? 'bg-red-500/20' : 'bg-blue-500/20'}`}>
                                    {modal.type === 'warning' ? (
                                        <Trash2 className="text-red-500" size={24} />
                                    ) : (
                                        <Info className="text-blue-500" size={24} />
                                    )}
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-white font-bold mb-2 uppercase tracking-widest text-sm">{modal.title}</h3>
                                    <p className="text-gray-500 text-[12.5px] mb-6 whitespace-pre-line leading-relaxed">
                                        {modal.message}
                                    </p>
                                    <div className="flex gap-2">
                                        {modal.type === 'warning' ? (
                                            <>
                                                <button
                                                    onClick={() => setModal({ ...modal, show: false })}
                                                    className="flex-1 px-4 py-3 border border-gray-800 text-gray-400 hover:text-white hover:bg-gray-900 text-xs font-bold uppercase tracking-widest transition-all"
                                                >
                                                    취소
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        modal.onConfirm?.();
                                                        setModal({ ...modal, show: false });
                                                    }}
                                                    className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white text-xs font-bold uppercase tracking-widest transition-all shadow-lg shadow-red-900/20"
                                                >
                                                    확인
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                onClick={() => setModal({ ...modal, show: false })}
                                                className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-widest transition-all shadow-lg shadow-blue-900/20"
                                            >
                                                확인
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Table Section (Moved to Top) */}
                <div className="space-y-12 mb-8">
                    <div className="border border-gray-900 bg-black relative overflow-hidden group">
                        <CornerBorders />

                        {/* Card Title */}
                        <div className="border-b border-gray-900 px-3 py-3 flex justify-between items-center bg-gray-950/30">
                            <div className="flex items-center gap-2">
                                <div className="w-1 h-3 bg-blue-500"></div>
                                <h2 className="text-gray-300 font-bold text-[12px] sm:text-[13px] tracking-tight sm:tracking-widest uppercase">
                                    Motor Specification Reference
                                </h2>
                            </div>
                            <div className="text-[10px] text-gray-700 tracking-tighter">KECG 1702A</div>
                        </div>

                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full border-collapse table-fixed min-w-[1200px]">
                                <thead>
                                    <tr className="border-b border-gray-900 bg-gray-950">
                                        {headers.map((h, idx) => (
                                            <th key={idx} className="px-2 py-3 text-[11px] sm:text-[12px] font-bold text-gray-300 text-center uppercase tracking-wider border-r border-gray-900 last:border-r-0">
                                                <div className="flex flex-col items-center justify-center gap-1">
                                                    <span>{h.label}</span>
                                                    {h.sub && <span className="text-gray-500 text-[10px] normal-case">{h.sub}</span>}
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-900">
                                    {filteredResults.length > 0 ? filteredResults.map((item, rIdx) => (
                                        <tr key={rIdx} className="hover:bg-blue-500/10 transition-colors group/row">
                                            {item.rowData.map((cell, cIdx) => (
                                                <td
                                                    key={cIdx}
                                                    className={`px-2 py-2 text-center text-[12px] sm:text-[13px] border-r border-gray-900 last:border-r-0 ${
                                                        // First cell (Method) gets Dynamic Color if calculated, else fallback
                                                        cIdx === 0
                                                            ? `${item.colorClass} font-bold bg-gray-900/20`
                                                            : 'text-gray-300 group-hover/row:text-white'
                                                        }`}
                                                >
                                                    {cIdx === 4 && globalCosPhi === 'Custom' ? (
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={cell}
                                                            onChange={(e) => {
                                                                const newVal = e.target.value;
                                                                setCustomPFs(prev => ({
                                                                    ...prev,
                                                                    [item.originalIndex]: newVal
                                                                }));
                                                            }}
                                                            className="w-full bg-transparent text-blue-400 font-bold text-center focus:outline-none appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none p-0 m-0"
                                                        />
                                                    ) : (
                                                        <Highlight text={cell} query={searchTerm} />
                                                    )}
                                                </td>
                                            ))}
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={headers.length} className="py-20 text-center">
                                                <div className="text-gray-600 text-sm tracking-[0.2em] uppercase">No matching data found</div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Settings Slider Section - 5 Columns */}
                <div className="mb-8 border border-gray-900 bg-gray-950/20 relative overflow-hidden group">
                    <CornerBorders />

                    <div className="border-b border-gray-900 px-3 py-3 flex justify-between items-center bg-gray-950/30">
                        <div className="flex items-center gap-2">
                            <div className="w-1 h-3 bg-blue-500"></div>
                            <h2 className="text-gray-300 font-bold text-[12px] sm:text-[13px] tracking-widest uppercase">
                                기동배율 Beta Factor <span className="normal-case">(β)</span>
                            </h2>
                        </div>
                    </div>

                    <div className="p-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-6">
                            {/* 1P Direct Starting */}
                            {renderSlider(
                                "1φ 직입 기동",
                                betaDirect1P,
                                setBetaDirect1P,
                                "bg-white",
                                "text-white",
                                "bg-gray-700"
                            )}

                            {/* 3P Direct Starting (Small) */}
                            {renderSlider(
                                "3φ 직입 (0.75~2.2kW)",
                                betaDirect3PSmall,
                                setBetaDirect3PSmall,
                                "bg-blue-400",
                                "text-blue-400/90",
                                "bg-blue-900"
                            )}

                            {/* 3P Direct Starting (Large) */}
                            {renderSlider(
                                "3φ 직입 (2.2~11kW)",
                                betaDirect3PLarge,
                                setBetaDirect3PLarge,
                                "bg-green-400",
                                "text-green-400/90",
                                "bg-green-900"
                            )}

                            {/* Y-D Starting */}
                            {renderSlider(
                                "Y-D 기동",
                                betaYD,
                                setBetaYD,
                                "bg-amber-400",
                                "text-amber-400/90",
                                "bg-amber-900"
                            )}

                            {/* Reactor Starting */}
                            {renderSlider(
                                "리액터 기동",
                                betaReactor,
                                setBetaReactor,
                                "bg-rose-400",
                                "text-rose-400/90",
                                "bg-rose-900"
                            )}
                        </div>
                    </div>
                </div>

                {/* Starting Coefficient & Current Limit Section */}
                <div className="mb-8 border border-gray-900 bg-gray-950/20 relative overflow-hidden group">
                    <CornerBorders />

                    <div className="border-b border-gray-900 px-3 py-3 flex justify-between items-center bg-gray-950/30">
                        <div className="flex items-center gap-2">
                            <div className="w-1 h-3 bg-blue-500"></div>
                            <h2 className="text-gray-300 font-bold text-[12px] sm:text-[13px] tracking-widest uppercase">
                                기동계수(C) 및 기동방식 전류제한 비율<span className="normal-case">(λ)</span>
                            </h2>
                        </div>
                    </div>

                    <div className="p-2">
                        <div className="w-full border border-gray-800 bg-gray-900/10">
                            {/* Header Row */}
                            <div className="grid grid-cols-4 divide-x divide-gray-800 border-b border-gray-800 bg-gray-900/30">
                                <div className="py-3 flex items-center justify-center text-[13px] sm:text-[12px] font-bold text-gray-300">DOL</div>
                                <div className="py-3 flex items-center justify-center text-[13px] sm:text-[12px] font-bold text-gray-300">Y-D</div>
                                <div className="py-3 flex items-center justify-center text-[13px] sm:text-[12px] font-bold text-gray-300">R-TAP</div>
                                <div className="py-3 flex items-center justify-center text-[13px] sm:text-[12px] font-bold text-gray-300">INV</div>
                            </div>
                            {/* Value Row */}
                            <div className="grid grid-cols-4 divide-x divide-gray-800">
                                <div className="py-3 flex items-center justify-center text-[13px] sm:text-[12px] font-bold text-white">
                                    1
                                </div>
                                <div className="py-3 flex items-center justify-center text-[13px] sm:text-[12px] font-bold text-white">
                                    0.33
                                </div>
                                <div className="py-0 flex items-center justify-center bg-gray-900/10 relative group/select">
                                    <div className="relative w-full h-full flex items-center justify-center">
                                        <select
                                            value={reactorTap}
                                            onChange={(e) => setReactorTap(parseFloat(e.target.value))}
                                            className="appearance-none bg-transparent border-none text-white text-[13px] sm:text-[13px] font-bold py-3 w-full text-center focus:outline-none focus:ring-0 cursor-pointer"
                                            style={{ textAlignLast: 'center' }}
                                        >
                                            <option value={0.5} className="bg-gray-900 text-gray-300">50%</option>
                                            <option value={0.65} className="bg-gray-900 text-gray-300">65%</option>
                                            <option value={0.8} className="bg-gray-900 text-gray-300">80%</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="py-0 flex items-center justify-center bg-gray-900/10 relative group/select">
                                    <div className="relative w-full h-full flex items-center justify-center">
                                        <select
                                            value={lambdaInv}
                                            onChange={(e) => setLambdaInv(parseFloat(e.target.value))}
                                            className="appearance-none bg-transparent border-none text-white text-[13px] sm:text-[13px] font-bold py-3 w-full text-center focus:outline-none focus:ring-0 cursor-pointer"
                                            style={{ textAlignLast: 'center' }}
                                        >
                                            <option value={1.0} className="bg-gray-900 text-gray-300">1.0</option>
                                            <option value={1.1} className="bg-gray-900 text-gray-300">1.1</option>
                                            <option value={1.2} className="bg-gray-900 text-gray-300">1.2</option>
                                            <option value={1.5} className="bg-gray-900 text-gray-300">1.5</option>
                                            <option value={1.8} className="bg-gray-900 text-gray-300">1.8</option>
                                            <option value={2.0} className="bg-gray-900 text-gray-300">2.0</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Motor Starting Time Section */}
                <div className="mb-8 border border-gray-900 bg-gray-950/20 relative overflow-hidden group">
                    <CornerBorders />

                    <div className="border-b border-gray-900 px-3 py-3 flex justify-between items-center bg-gray-950/30">
                        <div className="flex items-center gap-2">
                            <div className="w-1 h-3 bg-blue-500"></div>
                            <h2 className="text-gray-300 font-bold text-[12px] sm:text-[13px] tracking-widest uppercase">
                                전동기 기동시간 <span className="normal-case">(t<sub>m</sub>) <sub>[sec]</sub></span>
                            </h2>
                        </div>
                    </div>

                    <div className="p-2">
                        <div className="w-full border border-gray-800 bg-gray-900/10">
                            {/* Header Row */}
                            <div className="grid grid-cols-4 divide-x divide-gray-800 border-b border-gray-800 bg-gray-900/30">
                                <div className="py-3 flex items-center justify-center text-[13px] sm:text-[12px] font-bold text-gray-300">DOL</div>
                                <div className="py-3 flex items-center justify-center text-[13px] sm:text-[12px] font-bold text-gray-300">Y-D</div>
                                <div className="py-3 flex items-center justify-center text-[13px] sm:text-[12px] font-bold text-gray-300">리액터</div>
                                <div className="py-3 flex items-center justify-center text-[13px] sm:text-[12px] font-bold text-gray-300">INV</div>
                            </div>
                            {/* Value Row */}
                            <div className="grid grid-cols-4 divide-x divide-gray-800">
                                {/* DOL */}
                                <div className="py-0 flex items-center justify-center bg-gray-900/10 relative group/select">
                                    <div className="relative w-full h-full flex items-center justify-center">
                                        <select
                                            value={tmDOL}
                                            onChange={(e) => setTmDOL(parseFloat(e.target.value))}
                                            className="appearance-none bg-transparent border-none text-white text-[13px] sm:text-[13px] font-bold py-3 w-full text-center focus:outline-none focus:ring-0 cursor-pointer"
                                            style={{ textAlignLast: 'center' }}
                                        >
                                            {[2, 4, 6, 10, 15, 20].map(v => (
                                                <option key={v} value={v} className="bg-gray-900 text-gray-300">{v}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                {/* Y-D */}
                                <div className="py-0 flex items-center justify-center bg-gray-900/10 relative group/select">
                                    <div className="relative w-full h-full flex items-center justify-center">
                                        <select
                                            value={tmYD}
                                            onChange={(e) => setTmYD(parseFloat(e.target.value))}
                                            className="appearance-none bg-transparent border-none text-white text-[13px] sm:text-[13px] font-bold py-3 w-full text-center focus:outline-none focus:ring-0 cursor-pointer"
                                            style={{ textAlignLast: 'center' }}
                                        >
                                            {[4, 6, 10, 15, 20].map(v => (
                                                <option key={v} value={v} className="bg-gray-900 text-gray-300">{v}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                {/* Reactor */}
                                <div className="py-0 flex items-center justify-center bg-gray-900/10 relative group/select">
                                    <div className="relative w-full h-full flex items-center justify-center">
                                        <select
                                            value={tmReactor}
                                            onChange={(e) => setTmReactor(parseFloat(e.target.value))}
                                            className="appearance-none bg-transparent border-none text-white text-[13px] sm:text-[13px] font-bold py-3 w-full text-center focus:outline-none focus:ring-0 cursor-pointer"
                                            style={{ textAlignLast: 'center' }}
                                        >
                                            {[4, 6, 10, 15, 20].map(v => (
                                                <option key={v} value={v} className="bg-gray-900 text-gray-300">{v}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                {/* INV */}
                                <div className="py-0 flex items-center justify-center bg-gray-900/10 relative group/select">
                                    <div className="relative w-full h-full flex items-center justify-center">
                                        <select
                                            value={tmINV}
                                            onChange={(e) => setTmINV(parseFloat(e.target.value))}
                                            className="appearance-none bg-transparent border-none text-white text-[13px] sm:text-[13px] font-bold py-3 w-full text-center focus:outline-none focus:ring-0 cursor-pointer"
                                            style={{ textAlignLast: 'center' }}
                                        >
                                            {[4, 6, 10, 15, 20].map(v => (
                                                <option key={v} value={v} className="bg-gray-900 text-gray-300">{v}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Other Motor Settings Section */}
                <div className="mb-0 border border-gray-900 bg-gray-950/20 relative overflow-hidden group">
                    <CornerBorders />

                    <div className="border-b border-gray-900 px-3 py-3 flex justify-between items-center bg-gray-950/30">
                        <div className="flex items-center gap-2">
                            <div className="w-1 h-3 bg-blue-500"></div>
                            <h2 className="text-gray-300 font-bold text-[12px] sm:text-[13px] tracking-widest uppercase">
                                기타 전동기 설정
                            </h2>
                        </div>
                    </div>

                    <div className="p-2">
                        <div className="w-full border border-gray-800 bg-gray-900/10">
                            {/* Header Row */}
                            <div className="grid grid-cols-4 divide-x divide-gray-800 border-b border-gray-800 bg-gray-900/30">
                                <div className="py-3 flex items-center justify-center text-[13px] sm:text-[12px] font-bold text-gray-300">cosθ</div>
                                <div className="py-3 flex items-center justify-center text-[13px] sm:text-[12px] font-bold text-gray-300">cosθ<sub>s</sub></div>
                                <div className="py-3 flex items-center justify-center text-[13px] sm:text-[12px] font-bold text-gray-300">K</div>
                                <div className="py-3 flex items-center justify-center text-[13px] sm:text-[12px] font-bold text-gray-300">CT</div>
                            </div>
                            {/* Value Row */}
                            <div className="grid grid-cols-4 divide-x divide-gray-800">
                                {/* cosθ */}
                                <div className="py-0 flex items-center justify-center bg-gray-900/10 relative group/select">
                                    <div className="relative w-full h-full flex items-center justify-center">
                                        <select
                                            value={globalCosPhi}
                                            onChange={(e) => setGlobalCosPhi(e.target.value)}
                                            className="appearance-none bg-transparent border-none text-white text-[13px] sm:text-[13px] font-bold py-3 w-full text-center focus:outline-none focus:ring-0 cursor-pointer"
                                            style={{ textAlignLast: 'center' }}
                                        >
                                            <option value="Default" className="bg-gray-900 text-gray-300">Default</option>
                                            <option value="Custom" className="bg-gray-900 text-gray-300">Custom</option>
                                        </select>
                                    </div>
                                </div>
                                {/* cosθs */}
                                <div className="py-0 flex items-center justify-center bg-gray-900/10 relative group/select">
                                    <div className="relative w-full h-full flex items-center justify-center">
                                        <select
                                            value={cosPhiS}
                                            onChange={(e) => setCosPhiS(parseFloat(e.target.value))}
                                            className="appearance-none bg-transparent border-none text-white text-[13px] sm:text-[13px] font-bold py-3 w-full text-center focus:outline-none focus:ring-0 cursor-pointer"
                                            style={{ textAlignLast: 'center' }}
                                        >
                                            {[0.1, 0.15, 0.2, 0.25, 0.3].map(v => (
                                                <option key={v} value={v} className="bg-gray-900 text-gray-300">{v}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                {/* K */}
                                <div className="py-0 flex items-center justify-center bg-gray-900/10 relative group/select">
                                    <div className="relative w-full h-full flex items-center justify-center">
                                        <select
                                            value={globalK}
                                            onChange={(e) => setGlobalK(parseFloat(e.target.value))}
                                            className="appearance-none bg-transparent border-none text-white text-[13px] sm:text-[13px] font-bold py-3 w-full text-center focus:outline-none focus:ring-0 cursor-pointer"
                                            style={{ textAlignLast: 'center' }}
                                        >
                                            {[1.3, 1.4, 1.5].map(v => (
                                                <option key={v} value={v} className="bg-gray-900 text-gray-300">{v}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                {/* CT */}
                                <div className="py-0 flex items-center justify-center bg-gray-900/10 relative group/select">
                                    <div className="relative w-full h-full flex items-center justify-center">
                                        <select
                                            value={globalCT}
                                            onChange={(e) => setGlobalCT(parseFloat(e.target.value))}
                                            className="appearance-none bg-transparent border-none text-white text-[13px] sm:text-[13px] font-bold py-3 w-full text-center focus:outline-none focus:ring-0 cursor-pointer"
                                            style={{ textAlignLast: 'center' }}
                                        >
                                            {[1.25, 1.33, 1.5, 2.0, 2.5].map(v => (
                                                <option key={v} value={v} className="bg-gray-900 text-gray-300">{v}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                        {/* Description Section */}
                        <div className="mt-3 px-2 pb-2 text-gray-400 text-[11px] sm:text-[12px] space-y-1 font-medium select-none">
                            <p>* cosθ : 전동기 역률 일괄 조정</p>
                            <p>* cosθ<sub>s</sub> : 전동기 기동시 역률</p>
                            <p>* K : 전동기 돌입전류 배율</p>
                            <p>* CT : I<sub>N</sub>(전동기 정격) × 배율</p>
                        </div>
                    </div>
                </div>
                <div className="mt-8 mb-4 space-y-1">
                    <div className="text-[10px] lg:text-[11.5px] text-gray-400">※ K: KECG 1702에서 권장하는 보호협조 방식에 근거.</div>
                </div>
                {/* Footer */}
                <div className="mt-16 pb-8 text-center text-gray-800 text-[9px] tracking-[0.4em] uppercase">
                    KELC_SYSTEM_DATA_TERMINAL_V1.0
                </div>
            </div>
            <MasterNavModal 
                isOpen={isNavOpen}
                onClose={() => setIsNavOpen(false)}
            />
        </div>
    );
};

export default MCCPage;

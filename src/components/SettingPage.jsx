import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, RotateCcw, Settings, ChevronDown, ChevronUp, Check, Sliders, ChevronsUp, ChevronsDown, Info, Trash2, Download, X, Search, AlertCircle, BookOpen } from 'lucide-react';
import SETTING_DATA from '../data/설정.json';
import { getRemoteData, setRemoteData, getActiveProjectId } from '../services/projectService';
import useDataStore from '../store/useDataStore';
import { SETTING_NAV_ITEMS, scrollSettingToSection } from '../utils/SettingNavi';
import MasterNavModal from './common/MasterNavModal';

const STORAGE_KEY = 'kelc_setting_data';

// Corner border decorations
const CornerBorders = ({ colorClass = "" }) => (
    <>
        <div className={`corner-tl ${colorClass}`} />
        <div className={`corner-tr ${colorClass}`} />
        <div className={`corner-bl ${colorClass}`} />
        <div className={`corner-br ${colorClass}`} />
    </>
);

// Cable condition dropdown options - areas from allowable current table
const getCableConditionOptions = () => ({
    areas: [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300]
});

// Hardcoded correction factor data based on reference images
const getHardcodedFactors = () => {
    // Factor 2: 트레이 단수별 케이블 심수 보정계수 (from uploaded image)
    const factor2 = {
        title: '2. 기중개방의 다심케이블 집합에 대한 보정계수',
        headerLabel: '트레이 단수/회로',
        headers: [1, 2, 3, 4, 5, 6, 7, 8, 9],
        rows: [
            { label: '1', values: [1, 0.87, 0.82, 0.8, 0.8, 0.79, 0.79, 0.79, 0.78] },
            { label: '2', values: [1, 0.86, 0.8, 0.78, 0.78, 0.76, 0.76, 0.76, 0.73] },
            { label: '3', values: [1, 0.85, 0.79, 0.76, 0.76, 0.73, 0.73, 0.73, 0.7] },
            { label: '4', values: [1, 0.84, 0.77, 0.73, 0.73, 0.68, 0.68, 0.68, 0.64] },
            { label: '5', values: [1, 0.84, 0.77, 0.73, 0.73, 0.68, 0.68, 0.68, 0.64] },
            { label: '6', values: [1, 0.84, 0.77, 0.73, 0.73, 0.68, 0.68, 0.68, 0.64] }
        ]
    };

    // Factor 3: 기중 온도 보정계수
    const factor3 = {
        title: '3. XLPE 절연 - 기중 주위온도가 30℃ 이외인 경우 보정계수',
        headerLabel: '온도 [℃]',
        headers: [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65],
        rows: [
            { label: 'XLPE', values: [1.15, 1.12, 1.08, 1.04, 1, 0.96, 0.91, 0.87, 0.82, 0.76, 0.71, 0.65] }
        ]
    };

    // Factor 4: 지중 온도 보정계수
    const factor4 = {
        title: '4. XLPE 절연 - 지중 주위온도가 20℃ 이외인 경우 보정계수',
        headerLabel: '온도 [℃]',
        headers: [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65],
        rows: [
            { label: 'XLPE', values: [1.07, 1.04, 1, 0.96, 0.93, 0.89, 0.85, 0.8, 0.76, 0.71, 0.65, 0.6] }
        ]
    };

    // Factor 5: 토양 열저항률 보정계수
    const factor5 = {
        title: '5. 토양의 열저항률 보정계수 (기준 2.5 K·m/W)',
        headerLabel: '[K·m/W]',
        headers: [0.5, 0.7, 1, 1.5, 2, 2.5, 3],
        rows: [
            { label: '매설덕트', values: [1.28, 1.2, 1.18, 1.1, 1.05, 1, 0.96] },
            { label: '직접매설', values: [1.88, 1.62, 1.5, 1.28, 1.12, 1, 0.9] }
        ]
    };

    // Factor 6: 매설깊이 보정계수
    const factor6 = {
        title: '6. 지중매설깊이에 대한 보정계수 (기준 0.8m)',
        headerLabel: '깊이 [m]',
        headers: [0.6, 0.8, 1.0, 1.2],
        rows: [
            { label: '보정계수', values: [1.01, 1, 0.96, 0.96] }
        ]
    };

    // Factor 7: 전선관 내의 케이블 점유면적
    const factor7 = {
        title: '7. 전선관 내 케이블 점유면적 비율',
        headerLabel: '전선관 종류',
        headers: ['CD', 'HI', 'ST', 'ELP'],
        rows: [
            { label: '점유면적 비율', values: [32, 32, 32, 32] }
        ],
        unit: '%'
    };

    return [factor2, factor3, factor4, factor5, factor6, factor7];
};

// Parse the raw JSON data into structured tables
const parseSettingData = (rawData) => {
    const areas = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300];

    // Extract 3φ table data (columns 1-8, rows 10-25)
    const table3p = areas.map((area, idx) => {
        const rowIdx = 10 + idx;
        const row = rawData[rowIdx] || [];
        return {
            area,
            A1: row[2] || '',
            B1: row[3] || '',
            A2: row[4] || '',
            B2: row[5] || '',
            E: row[6] || '',
            F: row[7] || '',
            D1: row[8] || ''
        };
    });

    // Extract 1φ table data (columns 11-18, rows 10-25)
    const table1p = areas.map((area, idx) => {
        const rowIdx = 10 + idx;
        const row = rawData[rowIdx] || [];
        return {
            area,
            A1: row[12] || '',
            B1: row[13] || '',
            A2: row[14] || '',
            B2: row[15] || '',
            E: row[16] || '',
            F: row[17] || '',
            D1: row[18] || ''
        };
    });

    return {
        table3p,
        table1p,
        factors: getHardcodedFactors()
    };
};

// Default values for settings
const getDefaultSettings = () => ({
    selectedFactors: {
        factor2: { rowIdx: 0, colIdx: 0, value: 1 },
        factor3: { rowIdx: 0, colIdx: 4, value: 1 },
        factor4: { rowIdx: 0, colIdx: 2, value: 1 },
        factor5: { rowIdx: 0, colIdx: 5, value: 1 },
        factor6: { rowIdx: 0, colIdx: 1, value: 1 },
        factor7: { rowIdx: null, colIdx: null, value: null },
        factor9: { kg: '0.8', kIsc: '1.5', kr: '0.5', kx: '0.75' }
    },
    cableCondition: {
        area: 50,
        powerFactor: 0.8,
        efficiency: 1.0,
        demandFactor: 1.0,
        i2Type: 'industrial'
    },
    shortCircuitSettings: {
        tn: 0.03,
        is: 50,
        k: 143,
        alpha: 1.25,
        selectedK: { rowIdx: 2, colIdx: 4 }
    },
    marginFactors: {
        atms: 1.25,
        atmi: 1.1
    },
    factor7Values: [32, 32, 32, 32],
    smseSettings: {
        singleLimit: 15,
        feederLimit: 10,
        startingPowerFactor: 0.3
    },
    smsthSettings: {
        n: 1,
        alpha: 1.0,
        k: 143,
        selectedK: { rowIdx: 2, colIdx: 4 } // Default: Copper, XLPE (143)
    }
});

const SettingPage = () => {
    const [projectName, setProjectName] = useState('Setting');
    const broadcastReload = useDataStore(state => state.broadcastReload);

    useEffect(() => {
        const info = localStorage.getItem('kelc_project_info');
        if (info) {
            try {
                const parsed = JSON.parse(info);
                if (parsed.name) setProjectName(parsed.name);
            } catch (e) {}
        }
    }, []);

    const navigate = useNavigate();
    const parallelInfoRef = useRef(null);
    const scrollContainerRef = useRef(null);
    const searchContainerRef = useRef(null);
    const searchInputRef = useRef(null);
    const contentRef = useRef(null);
    // Parse initial data
    const initialData = useMemo(() => parseSettingData(SETTING_DATA), []);

    // State for tables (read-only now, but keeping state for future editability)
    const [table3p] = useState(initialData.table3p);
    const [table1p] = useState(initialData.table1p);
    const [factors] = useState(initialData.factors);

    // Cable condition options
    const cableOptions = useMemo(() => getCableConditionOptions(), []);

    // Store initial values for change detection
    const [initialValues, setInitialValues] = useState(null);

    // Helper for vertical labels in K-value table to unify cell heights (based on 4 chars)
    // Helper for vertical labels in K-value table - Modified to horizontal on mobile
    const renderVerticalLabel = (text) => {
        return (
            <div className="flex items-center justify-center w-full px-1">
                <span className="leading-tight break-keep">{text}</span>
            </div>
        );
    };

    // Cable condition dropdown state (Factor 1)
    const [cableCondition, setCableCondition] = useState({
        area: 50,
        powerFactor: 0.8,
        efficiency: 1.0,
        demandFactor: 1.0, // 수용률 (α)
        i2Type: 'industrial'
    });

    // Selected correction factors (index for each factor table) - starting from factor2
    const [selectedFactors, setSelectedFactors] = useState(getDefaultSettings().selectedFactors);

    // Expand/collapse state for factor tables
    const [expandedFactors, setExpandedFactors] = useState({
        factor1: false,
        factor2: false,
        factor3: false,
        factor4: false,
        factor5: false,
        factor6: false,
        factor7: false,
        factor8: false,
        factor9: false,
        // 추가 setting-1 tables
        elcb1p2w: false,
        mccb1p2w: false,
        elcb3p3w: false,
        mccb3p3w: false,
        elcb3p4w: false,
        mccb3p4w: false
    });

    // Short circuit calculation settings (Section 4)
    const [shortCircuitSettings, setShortCircuitSettings] = useState({
        tn: 0.03,
        is: 50,
        k: 143,
        alpha: 1.25,
        selectedK: { rowIdx: 2, colIdx: 4 } // Default: Copper, XLPE (143)
    });
    // Factor 7 values state (editable)
    const [factor7Values, setFactor7Values] = useState(getDefaultSettings().factor7Values);

    // Factor 8: ATMS/ATMI Margin Factors (α)
    const [marginFactors, setMarginFactors] = useState(getDefaultSettings().marginFactors);
    const [isMasterNavOpen, setIsMasterNavOpen] = useState(false);

    const [smseSettings, setSmseSettings] = useState(getDefaultSettings().smseSettings);

    const [smsthSettings, setSmsthSettings] = useState(getDefaultSettings().smsthSettings);

    // Custom Modal State
    const [modal, setModal] = useState({
        show: false,
        title: '',
        message: '',
        type: 'info', // 'info', 'confirm', 'warning'
        onConfirm: null
    });

    const [searchTerm, setSearchTerm] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [searchResults, setSearchResults] = useState([]);
    const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);

    // Outside click to close search
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showSearch && searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
                // Also check if the click was not on the toggle button
                const toggleButton = document.getElementById('search-toggle-btn');
                if (toggleButton && !toggleButton.contains(event.target)) {
                    setShowSearch(false);
                    setSearchTerm('');
                    clearHighlights();
                    setSearchResults([]);
                    setCurrentMatchIndex(-1);
                }
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showSearch]);

    const handleSearch = (e) => {
        const value = e.target.value;
        setSearchTerm(value);
        if (!value) {
            clearHighlights();
            setSearchResults([]);
            setCurrentMatchIndex(-1);
        } else {
            // Debounced or immediate highlight
            performSearch(value);
        }
    };

    const clearHighlights = () => {
        const marks = document.querySelectorAll('mark.search-highlight');
        marks.forEach(mark => {
            const parent = mark.parentNode;
            parent.replaceChild(document.createTextNode(mark.textContent), mark);
            parent.normalize();
        });
    };

    const performSearch = (term) => {
        if (!term || term.length < 1 || !contentRef.current) return;

        clearHighlights();
        
        const results = [];
        const walker = document.createTreeWalker(
            contentRef.current,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        let node;
        const nodesToProcess = [];
        while (node = walker.nextNode()) {
            if (node.parentElement.tagName !== 'SCRIPT' && node.parentElement.tagName !== 'STYLE') {
                nodesToProcess.push(node);
            }
        }

        nodesToProcess.forEach(textNode => {
            const text = textNode.nodeValue;
            const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
            
            if (regex.test(text)) {
                const parent = textNode.parentNode;
                const parts = text.split(regex);
                const fragment = document.createDocumentFragment();
                
                parts.forEach(part => {
                    if (part.toLowerCase() === term.toLowerCase()) {
                        const mark = document.createElement('mark');
                        mark.className = 'search-highlight';
                        mark.textContent = part;
                        fragment.appendChild(mark);
                        results.push(mark);
                    } else if (part) {
                        fragment.appendChild(document.createTextNode(part));
                    }
                });
                
                parent.replaceChild(fragment, textNode);
            }
        });

        setSearchResults(results);
        if (results.length > 0) {
            setCurrentMatchIndex(0);
            scrollToMatch(results[0], 0);
        } else {
            setCurrentMatchIndex(-1);
        }
    };

    const scrollToMatch = (element, index) => {
        if (!element) return;

        // Update active class
        document.querySelectorAll('mark.search-highlight').forEach((m, i) => {
            if (i === index) {
                m.classList.add('search-highlight-active');
            } else {
                m.classList.remove('search-highlight-active');
            }
        });

        element.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });
    };

    const findNextMatch = (e) => {
        if (e.key === 'Enter' && searchResults.length > 0) {
            e.preventDefault();
            const nextIndex = (currentMatchIndex + 1) % searchResults.length;
            setCurrentMatchIndex(nextIndex);
            scrollToMatch(searchResults[nextIndex], nextIndex);
            
            // Keep focus on input
            if (searchInputRef.current) {
                searchInputRef.current.focus();
            }
        }
    };

    const goToPrevMatch = (e) => {
        if (e) e.preventDefault();
        if (searchResults.length > 0) {
            const prevIndex = (currentMatchIndex - 1 + searchResults.length) % searchResults.length;
            setCurrentMatchIndex(prevIndex);
            scrollToMatch(searchResults[prevIndex], prevIndex);
            if (searchInputRef.current) searchInputRef.current.focus();
        }
    };

    const goToNextMatch = (e) => {
        if (e) e.preventDefault();
        if (searchResults.length > 0) {
            const nextIndex = (currentMatchIndex + 1) % searchResults.length;
            setCurrentMatchIndex(nextIndex);
            scrollToMatch(searchResults[nextIndex], nextIndex);
            if (searchInputRef.current) searchInputRef.current.focus();
        }
    };

    // MCC Settings for ATMI reference
    const [mccSettings, setMccSettings] = useState({
        betaDirect1P: 6.0,
        betaDirect3PSmall: 9.5,
        betaDirect3PLarge: 8.2,
        betaYD: 7.2,
        betaReactor: 7.7,
        reactorTap: 0.65,
        lambdaInv: 1.2,
        globalK: 1.5
    });

    // Load MCC settings
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
                    globalK: Number(parsed.otherSettings?.globalK ?? prev.globalK)
                }));
            }
        };

        const loadMCC = () => {
            const defaultKey = 'kelc_mcc_settings';
            const projectId = getActiveProjectId();
            const projectKey = projectId ? `${defaultKey}_${projectId}` : defaultKey;
            const saved = localStorage.getItem(projectKey) || localStorage.getItem(defaultKey);
            
            if (saved) {
                try {
                    applyMccData(JSON.parse(saved));
                } catch (e) {
                    console.error('Failed to load MCC settings:', e);
                }
            }
        };

        const loadRemoteMCC = async () => {
            try {
                const projectId = getActiveProjectId();
                if (projectId) {
                    const defaultKey = 'kelc_mcc_settings';
                    const projectKey = projectId ? `${defaultKey}_${projectId}` : defaultKey;
                    
                    let remote = await getRemoteData(projectKey, projectId);
                    if (!remote && projectKey !== defaultKey) {
                        remote = await getRemoteData(defaultKey, projectId);
                    }
                    
                    if (remote) {
                        applyMccData(remote);
                        return;
                    }
                }
            } catch (e) {
                console.error('Failed to load remote MCC settings:', e);
            }
        };

        loadMCC();
        loadRemoteMCC();
        window.addEventListener('storage', loadMCC);
        window.addEventListener('kelc_mcc_settings_updated', loadMCC);
        return () => {
            window.removeEventListener('storage', loadMCC);
            window.removeEventListener('kelc_mcc_settings_updated', loadMCC);
        };
    }, []);

    // Get current values for comparison
    const getCurrentValues = useCallback(() => ({
        selectedFactors: JSON.stringify(selectedFactors),
        cableCondition: JSON.stringify(cableCondition),
        shortCircuitSettings: JSON.stringify(shortCircuitSettings),
        factor7Values: JSON.stringify(factor7Values),
        marginFactors: JSON.stringify(marginFactors),
        smseSettings: JSON.stringify(smseSettings),
        smsthSettings: JSON.stringify(smsthSettings),
        factor9: JSON.stringify(selectedFactors.factor9)
    }), [selectedFactors, cableCondition, shortCircuitSettings, factor7Values, marginFactors, smseSettings, smsthSettings]);

    // Check if there are unsaved changes
    const hasUnsavedChanges = useCallback(() => {
        if (!initialValues) return false;
        const current = getCurrentValues();
        return JSON.stringify(current) !== JSON.stringify(initialValues);
    }, [initialValues, getCurrentValues]);

    // Update localStorage dirty state when values change
    useEffect(() => {
        if (initialValues) {
            const isDirty = hasUnsavedChanges();
            localStorage.setItem('kelc_setting_is_dirty', isDirty ? 'true' : 'false');
        }
        // Cleanup on unmount
        return () => {
            localStorage.removeItem('kelc_setting_is_dirty');
        };
    }, [hasUnsavedChanges, initialValues]);

    // Load saved data from MariaDB (per-project), fallback to localStorage
    useEffect(() => {
        const loadInitialSettings = async () => {
            const defaultKey = 'kelc_setting_data';
            const projectId = getActiveProjectId();
            const projectKey = projectId ? `${defaultKey}_${projectId}` : defaultKey;
            
            const defaults = getDefaultSettings();
            let loadedValues = {
                selectedFactors: JSON.stringify(defaults.selectedFactors),
                cableCondition: JSON.stringify(defaults.cableCondition),
                shortCircuitSettings: JSON.stringify(defaults.shortCircuitSettings),
                factor7Values: JSON.stringify(defaults.factor7Values),
                marginFactors: JSON.stringify(defaults.marginFactors),
                smseSettings: JSON.stringify(defaults.smseSettings),
                smsthSettings: JSON.stringify(defaults.smsthSettings),
                factor9: JSON.stringify(defaults.selectedFactors.factor9)
            };

            const applyParsed = (parsed) => {
                const defaults = getDefaultSettings();

                if (parsed.selectedFactors) {
                    // Merge with defaults to ensure new keys (kr, kx) are present even in old saved data
                    const mergedFactors = {
                        ...defaults.selectedFactors,
                        ...parsed.selectedFactors,
                        factor9: {
                            ...defaults.selectedFactors.factor9,
                            ...(parsed.selectedFactors.factor9 || (parsed.factor9 ? JSON.parse(JSON.stringify(parsed.factor9)) : {}))
                        }
                    };
                    setSelectedFactors(mergedFactors);
                    loadedValues.selectedFactors = JSON.stringify(mergedFactors);
                }
                if (parsed.cableCondition) {
                    setCableCondition(parsed.cableCondition);
                    loadedValues.cableCondition = JSON.stringify(parsed.cableCondition);
                }
                if (parsed.shortCircuitSettings) {
                    setShortCircuitSettings(parsed.shortCircuitSettings);
                    loadedValues.shortCircuitSettings = JSON.stringify(parsed.shortCircuitSettings);
                }
                if (parsed.factor7Values) {
                    setFactor7Values(parsed.factor7Values);
                    loadedValues.factor7Values = JSON.stringify(parsed.factor7Values);
                }
                if (parsed.marginFactors) {
                    setMarginFactors(parsed.marginFactors);
                    loadedValues.marginFactors = JSON.stringify(parsed.marginFactors);
                }
                if (parsed.smseSettings) {
                    setSmseSettings(parsed.smseSettings);
                    loadedValues.smseSettings = JSON.stringify(parsed.smseSettings);
                }
                if (parsed.smsthSettings) {
                    setSmsthSettings(parsed.smsthSettings);
                    loadedValues.smsthSettings = JSON.stringify(parsed.smsthSettings);
                }

                // Handle factor9 explicitly for consistency in initialValues check
                const f9 = parsed.factor9 || parsed.selectedFactors?.factor9;
                if (f9) {
                    loadedValues.factor9 = JSON.stringify({
                        ...defaults.selectedFactors.factor9,
                        ...f9
                    });
                }
            };

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
                            console.log('Migrating global settings to project-specific storage...');
                            await setRemoteData(projectId, projectKey, remote);
                        }
                    }

                    if (remote) {
                        applyParsed(remote);
                        // Sync to localStorage for consumer components
                        localStorage.setItem(projectKey, JSON.stringify(remote));
                        loaded = true;
                    }
                }
            } catch (e) {
                console.error('Failed to load settings from MariaDB:', e);
            }

            // 2. Fallback to localStorage
            if (!loaded) {
                const saved = localStorage.getItem(projectKey) || localStorage.getItem(defaultKey);
                if (saved) {
                    try {
                        applyParsed(JSON.parse(saved));
                    } catch (e) {
                        console.error('Failed to load saved settings from localStorage:', e);
                    }
                }
            }

            // Store initial values for dirty checking
            setInitialValues(loadedValues);
        };

        loadInitialSettings();
    }, []);

    // Handle Setting button click with dirty check
    const handleSettingsClick = () => {
        setModal({
            show: true,
            title: '저장 확인',
            message: '현재 설정을 저장하고 MCC 페이지로 이동하시겠습니까?',
            type: 'confirm',
            onConfirm: () => {
                handleSave(false);
                navigate('/mcc');
            }
        });
    };

    // Calculate column-specific correction factors
    const getColumnFactor = (col) => {
        // A1, B1, A2, B2: factor3 only (기중 온도)
        // E, F: factor2 + factor3 (트레이 단수 + 기중 온도)
        // D: factor4 + factor5 + factor6 (지중 온도 + 토양 열저항률 + 매설깊이)
        const f2 = selectedFactors.factor2?.value || 1;
        const f3 = selectedFactors.factor3?.value || 1;
        const f4 = selectedFactors.factor4?.value || 1;
        const f5 = selectedFactors.factor5?.value || 1;
        const f6 = selectedFactors.factor6?.value || 1;

        if (['A1', 'B1', 'A2', 'B2'].includes(col)) {
            return f3;
        } else if (['E', 'F'].includes(col)) {
            return f2 * f3;
        } else if (col === 'D') {
            return f4 * f5 * f6;
        }
        return 1;
    };

    // Calculate corrected values for display - column-specific
    const correctedTable3p = useMemo(() => {
        return table3p.map(row => ({
            ...row,
            A1_c: row.A1 ? (Number(row.A1) * getColumnFactor('A1')).toFixed(2) : '',
            B1_c: row.B1 ? (Number(row.B1) * getColumnFactor('B1')).toFixed(2) : '',
            A2_c: row.A2 ? (Number(row.A2) * getColumnFactor('A2')).toFixed(2) : '',
            B2_c: row.B2 ? (Number(row.B2) * getColumnFactor('B2')).toFixed(2) : '',
            E_c: row.E ? (Number(row.E) * getColumnFactor('E')).toFixed(2) : '',
            F_c: row.F ? (Number(row.F) * getColumnFactor('F')).toFixed(2) : '',
            D_c: row.D1 ? (Number(row.D1) * getColumnFactor('D')).toFixed(2) : ''
        }));
    }, [table3p, selectedFactors]);

    const correctedTable1p = useMemo(() => {
        return table1p.map(row => ({
            ...row,
            A1_c: row.A1 ? (Number(row.A1) * getColumnFactor('A1')).toFixed(2) : '',
            B1_c: row.B1 ? (Number(row.B1) * getColumnFactor('B1')).toFixed(2) : '',
            A2_c: row.A2 ? (Number(row.A2) * getColumnFactor('A2')).toFixed(2) : '',
            B2_c: row.B2 ? (Number(row.B2) * getColumnFactor('B2')).toFixed(2) : '',
            E_c: row.E ? (Number(row.E) * getColumnFactor('E')).toFixed(2) : '',
            F_c: row.F ? (Number(row.F) * getColumnFactor('F')).toFixed(2) : '',
            D_c: row.D1 ? (Number(row.D1) * getColumnFactor('D')).toFixed(2) : ''
        }));
    }, [table1p, selectedFactors]);

    // Handle factor selection
    const handleFactorSelect = (factorKey, rowIdx, colIdx, value) => {
        setSelectedFactors(prev => ({
            ...prev,
            [factorKey]: { rowIdx, colIdx, value: Number(value) || 1 }
        }));
    };

    // Handle factor deselect
    const handleFactorDeselect = (factorKey) => {
        setSelectedFactors(prev => ({
            ...prev,
            [factorKey]: { rowIdx: null, colIdx: null, value: factorKey === 'factor7' ? null : 1 }
        }));
    };

    // Save to MariaDB (per-project) + localStorage write-through
    const handleSave = async (showModal = true) => {
        const data = { selectedFactors, cableCondition, shortCircuitSettings, factor7Values, marginFactors, smseSettings, smsthSettings, factor9: selectedFactors.factor9 };

        const defaultKey = 'kelc_setting_data';
        const projectId = getActiveProjectId();
        const projectKey = projectId ? `${defaultKey}_${projectId}` : defaultKey;

        // 1. Write to localStorage for instant same-tab sync with consumers
        localStorage.setItem(projectKey, JSON.stringify(data));
        window.dispatchEvent(new Event('kelc_settings_updated'));

        // 2. Persist to MariaDB (per-project)
        try {
            if (projectId) {
                await setRemoteData(projectId, projectKey, data);
            }
        } catch (e) {
            console.error('Failed to save settings to MariaDB:', e);
        }

        // Update initial values after save
        setInitialValues(getCurrentValues());

        if (showModal) {
            window.dispatchEvent(new CustomEvent('kelc_show_toast', {
                detail: {
                    message: '설정이 성공적으로 저장되었습니다.',
                    type: 'success'
                }
            }));
        }

        // 3. 타 탭 동기화 (Zustand 스토어를 통한 실시간 반영)
        useDataStore.getState().updateSettings('kec', data);
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

    // Load from MariaDB (per-project)
    const handleLoad = async () => {
        try {
            const projectId = getActiveProjectId();
            let parsed = null;

            // 1. Try MariaDB (per-project) first
            if (projectId) {
                parsed = await getRemoteData(STORAGE_KEY, projectId);
            }

            // 2. Fallback to localStorage
            if (!parsed) {
                const saved = localStorage.getItem(STORAGE_KEY);
                if (saved) parsed = JSON.parse(saved);
            }

            if (parsed) {
                const defaults = getDefaultSettings();

                if (parsed.selectedFactors) {
                    // Merge with defaults to ensure new keys (kr, kx) provide defaults if missing in loaded data
                    const mergedFactors = {
                        ...defaults.selectedFactors,
                        ...parsed.selectedFactors,
                        factor9: {
                            ...defaults.selectedFactors.factor9,
                            ...(parsed.selectedFactors.factor9 || (parsed.factor9 ? JSON.parse(JSON.stringify(parsed.factor9)) : {}))
                        }
                    };
                    setSelectedFactors(mergedFactors);
                }

                if (parsed.cableCondition) setCableCondition(parsed.cableCondition);
                if (parsed.shortCircuitSettings) setShortCircuitSettings(parsed.shortCircuitSettings);
                if (parsed.factor7Values) setFactor7Values(parsed.factor7Values);
                if (parsed.marginFactors) setMarginFactors(parsed.marginFactors);
                if (parsed.smseSettings) setSmseSettings(parsed.smseSettings);
                if (parsed.smsthSettings) setSmsthSettings(parsed.smsthSettings);

                // Sync to localStorage for consumer components
                const defaultKey = 'kelc_setting_data';
                const projectId = getActiveProjectId();
                const projectKey = projectId ? `${defaultKey}_${projectId}` : defaultKey;
                
                localStorage.setItem(projectKey, JSON.stringify(parsed));
                window.dispatchEvent(new Event('kelc_settings_updated'));

                window.dispatchEvent(new CustomEvent('kelc_show_toast', {
                    detail: {
                        message: '저장된 설정을 성공적으로 불러왔습니다.',
                        type: 'success'
                    }
                }));
            } else {
                window.dispatchEvent(new CustomEvent('kelc_show_toast', {
                    detail: {
                        message: '저장된 설정이 없습니다.',
                        type: 'info'
                    }
                }));
            }
        } catch (e) {
            console.error('Failed to load settings:', e);
            window.dispatchEvent(new CustomEvent('kelc_show_toast', {
                detail: {
                    message: '설정을 불러오는 데 실패했습니다.',
                    type: 'error'
                }
            }));
        }
    };

    // Reset to default
    const handleReset = () => {
        setModal({
            show: true,
            title: '설정 초기화',
            message: '모든 설정을 초기값으로 되돌리시겠습니까?\n이 작업은 되돌릴 수 없습니다.',
            type: 'warning',
            onConfirm: async () => {
                const defaults = getDefaultSettings();
                setSelectedFactors(defaults.selectedFactors);
                setCableCondition(defaults.cableCondition);
                setShortCircuitSettings(defaults.shortCircuitSettings);
                setFactor7Values(defaults.factor7Values);
                setMarginFactors(defaults.marginFactors);
                setSmseSettings(defaults.smseSettings);
                setSmsthSettings(defaults.smsthSettings);

                // 1. Write defaults to localStorage for instant sync
                const defaultKey = 'kelc_setting_data';
                const projectId = getActiveProjectId();
                const projectKey = projectId ? `${defaultKey}_${projectId}` : defaultKey;

                localStorage.setItem(projectKey, JSON.stringify(defaults));
                window.dispatchEvent(new Event('kelc_settings_updated'));

                // 2. Persist defaults to MariaDB (per-project)
                try {
                    const projectId = getActiveProjectId();
                    if (projectId) {
                        await setRemoteData(projectId, STORAGE_KEY, defaults);
                    }
                } catch (e) {
                    console.error('Failed to reset settings in MariaDB:', e);
                }

                window.dispatchEvent(new CustomEvent('kelc_show_toast', {
                    detail: {
                        message: '설정이 초기화되었습니다.',
                        type: 'success'
                    }
                }));
            }
        });
    };


    // Toggle factor section
    const toggleFactor = (factorKey) => {
        setExpandedFactors(prev => ({
            ...prev,
            [factorKey]: !prev[factorKey]
        }));
    };

    // Render main current table (read-only)
    const renderMainTable = (data, correctedData, title, subtitle) => {
        const columns = ['A1', 'B1', 'A2', 'B2', 'E', 'F', 'D'];

        return (
            <div className="border border-gray-800 bg-black relative">
                <CornerBorders />
                <div className="p-4 border-b border-gray-800">
                    <h3 className="text-sm font-bold text-blue-400 uppercase tracking-wider">{title}</h3>
                    <p className="text-[10px] text-gray-500 mt-1">{subtitle}</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px] text-xs">
                        <thead>
                            <tr className="bg-gray-950">
                                <th className="border border-gray-800 px-2 py-2 text-gray-400 font-bold w-[50px]">도체</th>
                                {columns.map(col => (
                                    <th key={col} colSpan={2} className="border border-gray-800 px-2 py-2 text-gray-400 font-bold">
                                        {col}
                                    </th>
                                ))}
                            </tr>
                            <tr className="bg-gray-950">
                                <th className="border border-gray-800 px-2 py-1 text-gray-500 text-[10px] w-[50px]">㎟</th>
                                {columns.map(col => (
                                    <React.Fragment key={col}>
                                        <th className="border border-gray-800 px-1 py-1 text-gray-600 text-[9px] w-[45px]">기본</th>
                                        <th className="border border-gray-800 px-1 py-1 text-yellow-600 text-[9px] w-[45px]">보정</th>
                                    </React.Fragment>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((row, rowIdx) => (
                                <tr key={row.area} className="hover:bg-gray-900/50">
                                    <td className="border border-gray-800 px-2 py-1 text-center text-gray-300 font-bold bg-gray-950">
                                        {row.area}
                                    </td>
                                    {columns.map(col => {
                                        const dataKey = col === 'D' ? 'D1' : col;
                                        const correctedKey = `${col}_c`;
                                        return (
                                            <React.Fragment key={col}>
                                                <td className="border border-gray-800 px-1 py-1 text-center text-gray-400 w-[45px]">
                                                    {typeof row[dataKey] === 'number' ? row[dataKey] : row[dataKey] || '-'}
                                                </td>
                                                <td className="border border-gray-800 px-1 py-1 text-center text-yellow-500 font-medium bg-gray-950/50 w-[45px]">
                                                    {correctedData[rowIdx][correctedKey] || '-'}
                                                </td>
                                            </React.Fragment>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    // Render Factor 1: Cable Condition Dropdown
    const renderCableConditionSection = () => {
        const isExpanded = expandedFactors.factor1;

        return (
            <div className="border border-gray-800 bg-black relative mb-4">
                <CornerBorders />
                <div
                    className="h-12 px-3 border-b border-gray-800 flex items-center justify-between cursor-pointer hover:bg-gray-900/50"
                    onClick={() => toggleFactor('factor1')}
                >
                    <div className="flex items-center gap-3">
                        <h4 className="text-xs font-bold text-gray-300">1. 단심/다심 케이블 조건, 일반 부하의 역률 및 효율</h4>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="text-gray-500">
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                    </div>
                </div>

                {isExpanded && (
                    <div className="p-3">
                        <div className="flex flex-wrap items-center gap-4">
                            {/* 도체 단면적 */}
                            <div className="flex items-center gap-0.5 pl-2">
                                <label className="text-[12px] text-gray-400">단면적:</label>
                                <select
                                    value={cableCondition.area}
                                    onChange={(e) => setCableCondition(prev => ({ ...prev, area: Number(e.target.value) }))}
                                    className="bg-transparent border-none text-green-500 text-[13px] px-0 py-1 w-auto min-w-[30px] outline-none appearance-none cursor-pointer text-center font-bold"
                                >
                                    {cableOptions.areas.map(area => (
                                        <option key={area} value={area} className="bg-black text-white">{area}</option>
                                    ))}
                                </select>
                                <span className="text-[12px] text-gray-400">[㎟]</span>
                            </div>

                            {/* 역률 */}
                            <div className="flex items-center gap-0.5">
                                <label className="text-[12px] text-gray-400">역률 (φ):</label>
                                <input
                                    type="text"
                                    value={cableCondition.powerFactor}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                            setCableCondition(prev => ({ ...prev, powerFactor: val }));
                                        }
                                    }}
                                    className="bg-transparent border-none text-green-500 text-[13px] px-0 py-1 w-[32px] outline-none text-center font-bold"
                                />
                            </div>

                            {/* 효율 */}
                            <div className="flex items-center gap-0.5">
                                <label className="text-[12px] text-gray-400">효율 (η):</label>
                                <input
                                    type="text"
                                    value={cableCondition.efficiency}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                            setCableCondition(prev => ({ ...prev, efficiency: val }));
                                        }
                                    }}
                                    className="bg-transparent border-none text-green-500 text-[13px] px-0 py-1 w-[38px] outline-none text-center font-bold"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // Render correction factor table
    const renderFactorTable = (factor, factorIdx) => {
        // factorIdx 0 corresponds to factor2 (since factor1 is cable condition)
        const factorKey = `factor${factorIdx + 2}`;
        const selected = selectedFactors[factorKey];
        const isExpanded = expandedFactors[factorKey];
        // Factor 7 does not use "selection" mode in the UI anymore, just direct input
        const hasSelection = factorKey !== 'factor7' && selected && selected.value !== 1;
        const unit = factor.unit || '';

        return (
            <div key={factorIdx} className="border border-gray-800 bg-black relative mb-4">
                <CornerBorders />
                <div
                    className="h-12 px-3 border-b border-gray-800 flex items-center justify-between cursor-pointer hover:bg-gray-900/50"
                    onClick={() => toggleFactor(factorKey)}
                >
                    <div className="flex items-center gap-3">
                        <h4 className="text-xs font-bold text-gray-300">{factor.title}</h4>
                        {/* Badge for selected factories (hidden for Factor 7) */}
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded min-w-[60px] text-center transition-all ${hasSelection
                            ? 'bg-yellow-500/20 text-yellow-400 opacity-100'
                            : 'opacity-0'
                            }`}>
                            {hasSelection && (
                                `× ${selected.value.toFixed(2)}`
                            )}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleFactorDeselect(factorKey);
                            }}
                            className={`p-1.5 text-red-400 hover:bg-red-500/20 rounded-full border border-transparent hover:border-red-500/30 transition-all ${hasSelection ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'
                                }`}
                            title="해제"
                        >
                            <X size={14} />
                        </button>
                        <div className="text-gray-500 ml-1">
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                    </div>
                </div>

                {isExpanded && (
                    <div className="p-4 overflow-x-auto">
                        <table className="w-full text-xs border-collapse">
                            <thead>
                                <tr className="bg-gray-950">
                                    <th className="border border-gray-800 px-2 py-2 text-gray-400 text-left w-[140px] min-w-[140px]">
                                        {factor.headerLabel}
                                    </th>
                                    {factor.headers.map((header, idx) => (
                                        <th key={idx} className="border border-gray-800 px-2 py-2 text-gray-400 text-center min-w-[55px]">
                                            {header}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {factor.rows.map((row, rowIdx) => (
                                    <tr key={rowIdx}>
                                        <td className="border border-gray-800 px-2 py-2 text-gray-400 font-medium bg-gray-950 w-[140px] min-w-[140px]">
                                            {row.label}
                                        </td>
                                        {row.values.map((val, colIdx) => {
                                            const isSelected = selected?.rowIdx === rowIdx && selected?.colIdx === colIdx;
                                            const numVal = Number(val);
                                            const isFactor7 = factorKey === 'factor7';

                                            return (
                                                <td
                                                    key={colIdx}
                                                    onClick={() => !isFactor7 && handleFactorSelect(factorKey, rowIdx, colIdx, val)}
                                                    className={`border border-gray-800 px-2 py-2 text-center transition-all relative
                                                        ${!isFactor7 ? 'cursor-pointer' : ''}
                                                        ${isSelected && !isFactor7
                                                            ? 'z-10 outline outline-1 outline-yellow-500 text-green-500 font-bold'
                                                            : !isFactor7 ? 'hover:bg-blue-500/20 hover:text-blue-300 hover:border-blue-500/50' : ''}
                                                        ${!isSelected && !isFactor7 && (numVal === 1 ? 'text-blue-400' : 'text-white')}
                                                        ${isFactor7 ? 'text-white' : ''}
                                                    `}
                                                >
                                                    <span className="inline-flex items-center justify-center gap-1 w-full">
                                                        {isFactor7 ? (
                                                            <div className="flex items-center justify-center gap-1">
                                                                <input
                                                                    type="text"
                                                                    value={factor7Values[colIdx]}
                                                                    onChange={(e) => {
                                                                        const newVal = e.target.value;
                                                                        if (newVal === '' || /^\d*$/.test(newVal)) {
                                                                            const newValues = [...factor7Values];
                                                                            newValues[colIdx] = newVal === '' ? '' : Number(newVal);
                                                                            setFactor7Values(newValues);
                                                                        }
                                                                    }}
                                                                    className="bg-transparent border-none focus:outline-none text-center outline-none w-[30px] text-green-500 font-bold py-0.5"
                                                                />
                                                                <span className="text-gray-500">%</span>
                                                            </div>
                                                        ) : (
                                                            val.toFixed(2)
                                                        )}
                                                    </span>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        );
    };

    const renderMarginFactorSection = () => {
        const isExpanded = expandedFactors.factor8;

        return (
            <div className="border border-gray-800 bg-black relative mb-4">
                <CornerBorders />
                <div
                    className="h-12 px-3 border-b border-gray-800 flex items-center justify-between cursor-pointer hover:bg-gray-900/50"
                    onClick={() => toggleFactor('factor8')}
                >
                    <div className="flex items-center gap-3">
                        <h4 className="text-xs font-bold text-gray-300">8. AT<sub>MS</sub>와 AT<sub>MI</sub> 보호장치의 여유계수(α)</h4>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="text-gray-500">
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                    </div>
                </div>

                {isExpanded && (
                    <div className="p-3">
                        <div className="flex flex-nowrap items-center gap-3 sm:gap-6 pl-2 pb-1 overflow-x-auto no-scrollbar">
                            {/* ATMS 여유계수 */}
                            <div className="flex items-center gap-1 sm:gap-2 whitespace-nowrap">
                                <label className="text-[12px] text-gray-400">AT<sub>MS</sub> 여유계수(α):</label>
                                <input
                                    type="text"
                                    value={marginFactors.atms}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                            setMarginFactors(prev => ({ ...prev, atms: val }));
                                        }
                                    }}
                                    className="bg-transparent border-none text-green-500 text-[13px] px-0 py-1 w-[38px] outline-none text-center font-bold"
                                />
                            </div>

                            {/* ATMI 여유계수 */}
                            <div className="flex items-center gap-1 sm:gap-2 whitespace-nowrap">
                                <label className="text-[12px] text-gray-400">AT<sub>MI</sub> 여유계수(α):</label>
                                <input
                                    type="text"
                                    value={marginFactors.atmi}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                            setMarginFactors(prev => ({ ...prev, atmi: val }));
                                        }
                                    }}
                                    className="bg-transparent border-none text-green-500 text-[13px] px-0 py-1 w-[38px] outline-none text-center font-bold"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderParallelConductorSection = () => {
        const isExpanded = expandedFactors.factor9;
        const f9 = selectedFactors.factor9 || { kg: '0.8', kIsc: '1.5', kr: '0.5', kx: '0.75' };

        const handleChange = (key, val) => {
            if (val === '' || /^\d*\.?\d*$/.test(val)) {
                setSelectedFactors(prev => {
                    const currentF9 = prev.factor9 || { kg: '0.8', kIsc: '1.5', kr: '0.5', kx: '0.75' };
                    return {
                        ...prev,
                        factor9: {
                            ...currentF9,
                            [key]: val
                        }
                    };
                });
            }
        };

        return (
            <div className="border border-gray-800 bg-black relative mb-4">
                <CornerBorders />
                <div
                    className="h-12 px-3 border-b border-gray-800 flex items-center justify-between cursor-pointer hover:bg-gray-900/50"
                    onClick={() => toggleFactor('factor9')}
                >
                    <div className="flex items-center gap-3">
                        <h4 className="text-xs font-bold text-gray-300">9. 병렬 포설(Parallel Conductor) 조건</h4>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (parallelInfoRef.current) {
                                    const element = parallelInfoRef.current;
                                    const offset = 80;
                                    const elementPosition = element.getBoundingClientRect().top;
                                    const offsetPosition = elementPosition + window.pageYOffset - offset;
                                    window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
                                }
                            }}
                            className="px-2 py-1 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 text-[10px] font-bold border border-blue-500/30 transition-all rounded"
                        >
                            참고
                        </button>
                        <div className="text-gray-500">
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                    </div>
                </div>

                {isExpanded && (
                    <div className="p-3">
                        <div className="flex flex-nowrap items-center gap-3 sm:gap-6 pl-2 pb-1 overflow-x-auto no-scrollbar">
                            {/* 집합보정계수(Kg) */}
                            <div className="flex items-center gap-1 sm:gap-2 whitespace-nowrap">
                                <label className="text-[12px] text-gray-400">집합보정계수(K<sub>g</sub>):</label>
                                <input
                                    type="text"
                                    value={f9.kg ?? ''}
                                    onChange={(e) => handleChange('kg', e.target.value)}
                                    className="bg-transparent border-none text-green-500 text-[13px] px-0 py-1 w-[38px] outline-none text-center font-bold"
                                />
                            </div>

                            {/* 단락전류 할증계수(KIsc) */}
                            <div className="flex items-center gap-1 sm:gap-2 whitespace-nowrap">
                                <label className="text-[12px] text-gray-400">단락전류 할증계수(K<sub>Isc</sub>):</label>
                                <input
                                    type="text"
                                    value={f9.kIsc ?? ''}
                                    onChange={(e) => handleChange('kIsc', e.target.value)}
                                    className="bg-transparent border-none text-green-500 text-[13px] px-0 py-1 w-[38px] outline-none text-center font-bold"
                                />
                            </div>

                            {/* 합성저항 보정계수(KR) */}
                            <div className="flex items-center gap-1 sm:gap-2 whitespace-nowrap">
                                <label className="text-[12px] text-gray-400">합성저항 보정계수(K<sub>R</sub>):</label>
                                <input
                                    type="text"
                                    value={f9.kr ?? ''}
                                    onChange={(e) => handleChange('kr', e.target.value)}
                                    className="bg-transparent border-none text-green-500 text-[13px] px-0 py-1 w-[38px] outline-none text-center font-bold"
                                />
                            </div>

                            {/* 리액턴스 보정계수(KX) */}
                            <div className="flex items-center gap-1 sm:gap-2 whitespace-nowrap">
                                <label className="text-[12px] text-gray-400">리액턴스 보정계수(K<sub>X</sub>):</label>
                                <input
                                    type="text"
                                    value={f9.kx ?? ''}
                                    onChange={(e) => handleChange('kx', e.target.value)}
                                    className="bg-transparent border-none text-green-500 text-[13px] px-0 py-1 w-[38px] outline-none text-center font-bold"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderParallelConductorInfo = () => {
        return (
            <div className="mb-8" ref={parallelInfoRef}>
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-1 h-3 bg-blue-500"></div>
                    <h3 className="text-sm font-bold text-gray-200 uppercase tracking-widest">병렬 포설(Parallel Conductor) 조건</h3>
                </div>
                <div className="border border-gray-800 bg-black p-4 relative">
                    <CornerBorders />

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-center mb-6">
                        {/* Formula Section */}
                        <div className="border border-gray-800 p-4 bg-gray-900/30 flex flex-wrap items-center justify-center gap-x-1 h-full">
                            <div className="text-sm font-bold text-blue-400 font-mono tracking-tight">
                                <span>I<sub>total</sub> = ( I<sub>z</sub> × n ) × K<sub>g</sub></span>
                            </div>
                        </div>

                        {/* Terms Section */}
                        <div className="space-y-3 text-[11px] lg:text-[12.5px] text-gray-200">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                                <div className="flex items-center gap-1">
                                    <span className="text-blue-400 font-bold min-w-[35px]">I<sub>total</sub></span>
                                    <span>: 병렬 포설시 허용전류</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="text-blue-400 font-bold min-w-[35px]">I<sub>z</sub></span>
                                    <span>: 단일 전선 허용전류</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-1">
                                        <span className="text-blue-400 font-bold min-w-[35px]">K<sub>R</sub></span>
                                        <span>: 합성저항 보정계수</span>
                                    </div>
                                    <div className="pl-[39px] text-[10px] text-gray-500 font-medium leading-tight">
                                        * 단면적 증가에 따른 저항 성분의 보정 비율
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-1">
                                        <span className="text-blue-400 font-bold min-w-[35px]">K<sub>X</sub></span>
                                        <span>: 리액턴스 보정계수</span>
                                    </div>
                                    <div className="pl-[39px] text-[10px] text-gray-500 font-medium leading-tight">
                                        * 상호 인덕턴스 및 배치에 따른 리액턴스 보정
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="text-blue-400 font-bold min-w-[35px]">n</span>
                                    <span>: 한 상에 연결하는 전선수</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* KEC Requirements */}
                    <div className="pt-4 border-t border-gray-800">
                        <div className="text-[13px] lg:text-[14px] font-bold text-gray-200 mb-4 flex items-center gap-2">
                            <div className="w-1 h-3 bg-blue-500/50"></div>
                            KEC 232.5에 따른 필수 시공 조건
                        </div>
                        <div className="text-[11px] lg:text-[12.5px] text-gray-300 leading-relaxed bg-gray-900/10 p-4 border border-gray-800/50 space-y-3">
                            <div className="flex flex-col gap-1">
                                <p>병렬로 연결된 두 전선에 전류가 균일하게 흐르지 않으면, 한쪽 전선에만 과부하가 걸려 소손될 위험이 있다.</p>
                                <p>이를 방지하기 위해 다음 조건을 모두 만족한다.</p>
                            </div>

                            <div className="grid grid-cols-1 gap-y-2 pl-1">
                                <div className="flex items-start gap-2">
                                    <span className="text-blue-500 font-bold flex-shrink-0">•</span>
                                    <div className="flex flex-wrap gap-x-1">
                                        <span className="font-bold text-gray-200">동일 조건:</span>
                                        <span>도체의 재질, 굵기, 길이, 절연물(동일상표 권장)이 모두 같아야 한다.</span>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2">
                                    <span className="text-blue-500 font-bold flex-shrink-0">•</span>
                                    <div className="flex flex-wrap gap-x-1">
                                        <span className="font-bold text-gray-200">최소 굵기:</span>
                                        <span>구리는 50㎟ 이상, 알루미늄은 70㎟ 이상일 때만 병렬 접속을 허용한다.</span>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2">
                                    <span className="text-blue-500 font-bold flex-shrink-0">•</span>
                                    <div className="flex flex-wrap gap-x-1">
                                        <span className="font-bold text-gray-200">터미널 접속:</span>
                                        <span>각 상의 병렬 전선은 같은 터미널(또는 버스바)에 확실하게 접속되어야 한다.</span>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2">
                                    <span className="text-blue-500 font-bold flex-shrink-0">•</span>
                                    <div className="flex flex-wrap gap-x-1">
                                        <span className="font-bold text-gray-200">임피던스 일치:</span>
                                        <span>선로 중간에 접속점이 없어야 하며, 두 전선의 길이가 다르면 저항 값이 달라져 전류 불평형 주의.</span>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2">
                                    <span className="text-red-500 font-bold flex-shrink-0">•</span>
                                    <div className="space-y-1">
                                        <div className="flex flex-wrap gap-x-1">
                                            <span className="font-bold text-gray-200">배관의 사용:</span>
                                            <span className="text-red-500 font-medium whitespace-nowrap">금속관일 경우 1배관에 1가닥 시공을 주의해야 한다.</span>
                                        </div>
                                        <p className="text-gray-400 text-[11px] lg:text-[12px] leading-normal pl-0">
                                            금속관을 사용할 때는 반드시 모든 상(L1, L2, L3, N)을 한 배관에 넣어야 한다. 한 가닥만 넣으면 배관이 거대한 코일 역할을 하게 되어 <span className="text-red-400 font-bold underline decoration-red-500/30 underline-offset-4">와전류(Eddy Current)</span>가 발생. 배관이 순식간에 고온으로 상승함.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 집합보정계수(Kg) 상세 테이블 */}
                    <div className="pt-6 border-t border-gray-800 space-y-8">
                        <div>
                            <div className="text-[13px] lg:text-[14px] font-bold text-gray-200 mb-4 flex items-center gap-2">
                                <div className="w-1 h-3 bg-blue-500/50"></div>
                                <span>집합보정계수(K<sub className="ml-[-1px]">g</sub>)</span>
                            </div>

                            {/* Table 1: 기중 포설 */}
                            <div className="space-y-3 mb-8">
                                <div className="flex items-center gap-1.5 ml-1">
                                    <div className="w-1 h-2.5 bg-blue-400/70 rounded-sm"></div>
                                    <span className="text-[12px] lg:text-[13px] text-gray-200 font-bold">기중 포설 시 집합보정계수 (단층)</span>
                                </div>
                                <div className="overflow-x-auto border border-gray-800 scrollbar-thin scrollbar-thumb-gray-800">
                                    <table className="w-full min-w-[500px] text-[11px] sm:text-[12px] lg:text-[13px] text-center border-collapse table-fixed">
                                        <thead>
                                            <tr className="bg-gray-800/30 text-gray-300 lg:h-10">
                                                <th className="border border-gray-800 px-2 py-2.5 lg:py-1.5 font-bold uppercase whitespace-nowrap w-[20%]">포설 배열</th>
                                                <th className="border border-gray-800 px-2 py-2.5 lg:py-1.5 font-bold whitespace-nowrap w-[20%]">1회로</th>
                                                <th className="border border-gray-800 px-2 py-2.5 lg:py-1.5 font-bold whitespace-nowrap w-[20%]">2회로</th>
                                                <th className="border border-gray-800 px-2 py-2.5 lg:py-1.5 font-bold whitespace-nowrap w-[20%]">3회로</th>
                                                <th className="border border-gray-800 px-2 py-2.5 lg:py-1.5 font-bold whitespace-nowrap w-[20%]">4회로</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-gray-400 font-mono">
                                            {[
                                                { label: "매입/관내", v1: "1", v2: "0.8", v3: "0.7", v4: "0.65" },
                                                { label: "벽면 노출", v1: "1", v2: "0.85", v3: "0.79", v4: "0.75" },
                                                { label: "트레이래더", v1: "1", v2: "0.87", v3: "0.82", v4: "0.8" }
                                            ].map((row, idx) => (
                                                <tr key={idx} className="lg:h-10 hover:bg-white/5 transition-colors">
                                                    <td className="border border-gray-800 px-2 py-2.5 lg:py-1.5 bg-gray-900/20 text-gray-300 font-sans">{row.label}</td>
                                                    <td className="border border-gray-800 px-2 py-2.5 lg:py-1.5">{row.v1}</td>
                                                    <td className="border border-gray-800 px-2 py-2.5 lg:py-1.5">{row.v2}</td>
                                                    <td className="border border-gray-800 px-2 py-2.5 lg:py-1.5">{row.v3}</td>
                                                    <td className="border border-gray-800 px-2 py-2.5 lg:py-1.5">{row.v4}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Table 2: 지중 직접매설 */}
                            <div className="space-y-3 mb-8">
                                <div className="flex items-center gap-1.5 ml-1">
                                    <div className="w-1 h-2.5 bg-blue-400/70 rounded-sm"></div>
                                    <span className="text-[12px] lg:text-[13px] text-gray-200 font-bold">지중 직접매설 방식</span>
                                </div>
                                <div className="overflow-x-auto border border-gray-800 scrollbar-thin scrollbar-thumb-gray-800">
                                    <table className="w-full min-w-[500px] text-[11px] sm:text-[12px] lg:text-[13px] text-center border-collapse table-fixed">
                                        <thead>
                                            <tr className="bg-gray-800/30 text-gray-300 lg:h-10">
                                                <th className="border border-gray-800 px-2 py-2.5 lg:py-1.5 font-bold uppercase whitespace-nowrap w-[20%]">회로 수</th>
                                                <th className="border border-gray-800 px-2 py-2.5 lg:py-1.5 font-bold whitespace-nowrap w-[20%]">밀착</th>
                                                <th className="border border-gray-800 px-2 py-2.5 lg:py-1.5 font-bold whitespace-nowrap w-[20%]">0.25m 이격</th>
                                                <th className="border border-gray-800 px-2 py-2.5 lg:py-1.5 font-bold whitespace-nowrap w-[20%]">0.5m 이격</th>
                                                <th className="border border-gray-800 px-2 py-2.5 lg:py-1.5 font-bold whitespace-nowrap w-[20%]">1.0m 이격</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-gray-400 font-mono">
                                            {[
                                                { label: "2회로", v1: "0.75", v2: "0.85", v3: "0.9", v4: "0.95" },
                                                { label: "3회로", v1: "0.65", v2: "0.75", v3: "0.8", v4: "0.9" },
                                                { label: "4회로", v1: "0.6", v2: "0.7", v3: "0.75", v4: "0.85" }
                                            ].map((row, idx) => (
                                                <tr key={idx} className="lg:h-10 hover:bg-white/5 transition-colors">
                                                    <td className="border border-gray-800 px-2 py-2.5 lg:py-1.5 bg-gray-900/20 text-gray-300 font-sans">{row.label}</td>
                                                    <td className="border border-gray-800 px-2 py-2.5 lg:py-1.5">{row.v1}</td>
                                                    <td className="border border-gray-800 px-2 py-2.5 lg:py-1.5">{row.v2}</td>
                                                    <td className="border border-gray-800 px-2 py-2.5 lg:py-1.5">{row.v3}</td>
                                                    <td className="border border-gray-800 px-2 py-2.5 lg:py-1.5">{row.v4}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Table 3: 지중 관로매설 */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-1.5 ml-1">
                                    <div className="w-1 h-2.5 bg-blue-400/70 rounded-sm"></div>
                                    <span className="text-[12px] lg:text-[13px] text-gray-200 font-bold">지중 관로매설 방식 (1관 1회로 기준)</span>
                                </div>
                                <div className="overflow-x-auto border border-gray-800 scrollbar-thin scrollbar-thumb-gray-800">
                                    <table className="w-full min-w-[500px] text-[11px] sm:text-[12px] lg:text-[13px] text-center border-collapse table-fixed">
                                        <thead>
                                            <tr className="bg-gray-800/30 text-gray-300 lg:h-10">
                                                <th className="border border-gray-800 px-2 py-2.5 lg:py-1.5 font-bold uppercase whitespace-nowrap w-[20%]">회로 수</th>
                                                <th className="border border-gray-800 px-2 py-2.5 lg:py-1.5 font-bold whitespace-nowrap w-[20%]">밀착</th>
                                                <th className="border border-gray-800 px-2 py-2.5 lg:py-1.5 font-bold whitespace-nowrap w-[20%]">0.25m 이격</th>
                                                <th className="border border-gray-800 px-2 py-2.5 lg:py-1.5 font-bold whitespace-nowrap w-[20%]">0.5m 이격</th>
                                                <th className="border border-gray-800 px-2 py-2.5 lg:py-1.5 font-bold whitespace-nowrap w-[20%]">1.0m 이격</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-gray-400 font-mono">
                                            {[
                                                { label: "2회로", v1: "0.85", v2: "0.9", v3: "0.95", v4: "1" },
                                                { label: "3회로", v1: "0.75", v2: "0.8", v3: "0.9", v4: "0.95" },
                                                { label: "4회로", v1: "0.7", v2: "0.75", v3: "0.85", v4: "0.9" }
                                            ].map((row, idx) => (
                                                <tr key={idx} className="lg:h-10 hover:bg-white/5 transition-colors">
                                                    <td className="border border-gray-800 px-2 py-2.5 lg:py-1.5 bg-gray-900/20 text-gray-300 font-sans">{row.label}</td>
                                                    <td className="border border-gray-800 px-2 py-2.5 lg:py-1.5">{row.v1}</td>
                                                    <td className="border border-gray-800 px-2 py-2.5 lg:py-1.5">{row.v2}</td>
                                                    <td className="border border-gray-800 px-2 py-2.5 lg:py-1.5">{row.v3}</td>
                                                    <td className="border border-gray-800 px-2 py-2.5 lg:py-1.5">{row.v4}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div ref={scrollContainerRef} className="min-h-screen bg-black text-gray-300 p-4 lg:p-6 overflow-y-auto no-scrollbar">

            <div ref={contentRef} className="max-w-[1920px] mx-auto">
                {/* Header */}
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-3">
                            <Settings className="w-6 h-6 text-blue-400" />
                            <div>
                                <h1 className="text-lg font-bold text-white uppercase tracking-wider">Setting</h1>
                                <p className="text-[11px] lg:text-[12.5px] text-blue-400/80 font-bold uppercase tracking-[0.2em] flex items-center gap-2 max-w-[250px] sm:max-w-[400px] lg:max-w-[600px]">
                                    <span className="w-1 h-1 bg-blue-500 rounded-full animate-pulse flex-shrink-0"></span>
                                    <span className="truncate">{projectName}</span>
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 ml-auto">
                        {/* Desktop buttons */}
                        <div className="hidden sm:flex items-center gap-2">
                            <button
                                onClick={handleReset}
                                className="min-w-[100px] px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold uppercase tracking-widest transition-all relative group"
                            >
                                <div className="flex items-center justify-center gap-2">
                                    <RotateCcw size={12} />
                                    RESET
                                </div>
                            </button>
                            <button
                                onClick={handleLoad}
                                className="min-w-[100px] px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-[10px] font-bold uppercase tracking-widest transition-all relative group"
                            >
                                <div className="flex items-center justify-center gap-2">
                                    <Download size={12} />
                                    LOAD
                                </div>
                            </button>
                            <button
                                onClick={handleSave}
                                className="min-w-[100px] px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold uppercase tracking-widest transition-all relative group"
                            >
                                <div className="flex items-center justify-center gap-2">
                                    <Save size={12} />
                                    SAVE
                                </div>
                            </button>
                        </div>

                        {/* Mobile buttons */}
                        <div className="flex sm:hidden items-center gap-2">
                            <button
                                onClick={handleReset}
                                className="p-2.5 bg-red-600 text-white active:scale-95 transition-all relative"
                            >
                                <RotateCcw size={16} />
                            </button>
                            <button
                                onClick={handleLoad}
                                className="p-2.5 bg-gray-800 text-white active:scale-95 transition-all relative"
                            >
                                <Download size={16} />
                            </button>
                            <button
                                onClick={handleSave}
                                className="p-2.5 bg-blue-600 text-white active:scale-95 transition-all relative"
                            >
                                <Save size={16} />
                            </button>
                        </div>
                    </div>
                </div>

                <div id="sec-factors" className="flex items-center gap-2 mb-3">
                    <div className="w-1 h-3 bg-blue-500"></div>
                    <h3 className="text-sm font-bold text-gray-200 uppercase tracking-widest">I<sub>Z</sub> 케이블 허용전류의 결정</h3>
                </div>

                {/* Info banner */}
                <div className="mb-6 p-3 bg-blue-500/10 border border-blue-500/30 text-blue-300 text-[11px] lg:text-[12.5px]">
                    보정계수 테이블에서 값을 클릭하면 공사 방법에 따른 허용전류 값이 계산됩니다.
                </div>

                {/* Main Tables - 3φ and 1φ */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
                    {renderMainTable(
                        table3p,
                        correctedTable3p,
                        '3φ 허용전류',
                        'XLPE 또는 EPR 절연, 3개 부하 도체, 구리, 도체 온도: 90℃ / 주위온도: 기중 30℃, 지중 20℃'
                    )}
                    {renderMainTable(
                        table1p,
                        correctedTable1p,
                        '1φ 허용전류',
                        'XLPE 또는 EPR 절연, 2개 부하 도체, 구리, 도체 온도: 90℃ / 주위온도: 기중 30℃, 지중 20℃'
                    )}
                </div>

                {/* Correction Factor Tables */}
                <div className="mb-6">
                    <div id="sec-factors" className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Sliders size={14} className="text-gray-400" />
                            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">
                                보정계수 적용
                            </h2>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setExpandedFactors({
                                    factor1: true, factor2: true, factor3: true,
                                    factor4: true, factor5: true, factor6: true, factor7: true, factor8: true, factor9: true,
                                    elcb1p2w: true, mccb1p2w: true, elcb3p3w: true, mccb3p3w: true, elcb3p4w: true, mccb3p4w: true
                                })}
                                className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded transition-colors"
                                title="전부 펼치기"
                            >
                                <ChevronsDown size={14} />
                            </button>
                            <button
                                onClick={() => setExpandedFactors({
                                    factor1: false, factor2: false, factor3: false,
                                    factor4: false, factor5: false, factor6: false, factor7: false, factor8: false, factor9: false,
                                    elcb1p2w: false, mccb1p2w: false, elcb3p3w: false, mccb3p3w: false, elcb3p4w: false, mccb3p4w: false
                                })}
                                className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded transition-colors"
                                title="전부 접기"
                            >
                                <ChevronsUp size={14} />
                            </button>
                        </div>
                    </div>

                    {/* Factor 1: Cable Condition Dropdown */}
                    {renderCableConditionSection()}

                    {/* Factor 2-6: Table-based factors */}
                    {factors.map((factor, idx) => renderFactorTable(factor, idx))}

                    {/* Factor 8: ATMS/ATMI Margin Factors */}
                    {renderMarginFactorSection()}

                    {/* Factor 9: Parallel Conductor Conditions */}
                    {renderParallelConductorSection()}
                </div>

                {/* Additional Settings Section */}
                <div className="mb-6">
                    <div className="flex items-center gap-2 mb-6">
                        <Settings size={14} className="text-gray-400" />
                        <h2 className="text-base font-bold text-gray-300 uppercase tracking-wider">
                            추가 설정
                        </h2>
                    </div>

                    {/* [ 설비전류의 계산 ] */}
                    {/* [ 설계전류의 계산 ] */}
                    <div className="mb-8">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-1 h-3 bg-blue-500"></div>
                            <h3 className="text-sm font-bold text-gray-200 uppercase tracking-widest">I<sub>B</sub> 설계전류의 계산</h3>
                        </div>

                        <div className="border border-gray-800 bg-black relative p-4">
                            <CornerBorders />
                            <div className="mb-4 text-[11px] lg:text-[12px] text-gray-300 pl-1">
                                - 모선인 경우 P는 변압기 또는 수전용량으로 설계전류를 산정, 이외의 경우는 부하용량으로 한다.
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div className="border border-gray-800 bg-black p-4 relative">
                                    <CornerBorders />
                                    <div className="text-[12px] text-gray-300 uppercase tracking-wider mb-2 text-center">단상 (1Φ)</div>
                                    <div className="text-sm font-bold text-blue-400 font-mono flex flex-wrap items-center justify-center gap-x-1">
                                        <span>I<sub>B</sub></span>
                                        <span>= P / V</span>
                                        <span className="text-gray-400 ml-1">[A]</span>
                                    </div>
                                </div>
                                <div className="border border-gray-800 bg-black p-4 relative">
                                    <CornerBorders />
                                    <div className="text-[12px] text-gray-300 uppercase tracking-wider mb-2 text-center">삼상 (3Φ)</div>
                                    <div className="text-sm font-bold text-blue-400 font-mono flex flex-wrap items-center justify-center gap-x-1">
                                        <span>I<sub>B</sub></span>
                                        <span>= P / (√3 × V<sub>n</sub> × η × cosθ)</span>
                                        <span className="text-gray-400 ml-1">[A]</span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-gray-900/30 border border-gray-800 p-3">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[10px] lg:text-[11.5px]">
                                    <div className="flex items-center gap-2">
                                        <span className="text-gray-400 font-bold">P:</span>
                                        <span className="text-gray-300">유효전력 [kW]</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-gray-400 font-bold">V<sub>n</sub>:</span>
                                        <span className="text-gray-300">선간전압 [V]</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-gray-400 font-bold">η:</span>
                                        <span className="text-gray-300">효율</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-gray-400 font-bold">cosθ:</span>
                                        <span className="text-gray-300">역률</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* [ 과전류보호장치의 정격전류의 결정 ] */}
                    <div id="sec-cb" className="mb-8">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-1 h-3 bg-blue-500"></div>
                                <h3 className="text-sm font-bold text-gray-200 uppercase tracking-widest">I<sub>N</sub> 과전류보호장치의 정격전류</h3>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setExpandedFactors(prev => ({
                                        ...prev,
                                        elcb1p2w: true, mccb1p2w: true, elcb3p3w: true, mccb3p3w: true, elcb3p4w: true, mccb3p4w: true
                                    }))}
                                    className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded transition-colors"
                                    title="전부 펼치기"
                                >
                                    <ChevronsDown size={14} />
                                </button>
                                <button
                                    onClick={() => setExpandedFactors(prev => ({
                                        ...prev,
                                        elcb1p2w: false, mccb1p2w: false, elcb3p3w: false, mccb3p3w: false, elcb3p4w: false, mccb3p4w: false
                                    }))}
                                    className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded transition-colors"
                                    title="전부 접기"
                                >
                                    <ChevronsUp size={14} />
                                </button>
                            </div>
                        </div>

                        {/* 1. 단상2선 누전차단기 (ELCB) */}
                        <div className="border border-gray-800 bg-black relative mb-3">
                            <CornerBorders />
                            <div
                                className="p-2.5 flex items-center justify-between cursor-pointer hover:bg-gray-900 transition-colors"
                                onClick={() => setExpandedFactors(prev => ({ ...prev, elcb1p2w: !prev.elcb1p2w }))}
                            >
                                <h4 className="text-[11px] font-bold text-gray-300">단상2선 누전차단기 (ELCB)</h4>
                                {expandedFactors.elcb1p2w ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </div>
                            {expandedFactors.elcb1p2w && (
                                <div className="p-3 border-t border-gray-800 overflow-x-auto">
                                    <table className="w-full text-xs border-collapse table-fixed">
                                        <thead>
                                            <tr className="bg-gray-950">
                                                {['CB', 'P', 'W', 'AT', 'AF', 'TYPE', 'kA', '비고'].map(h => (
                                                    <th key={h} className="border border-gray-800 px-1 py-1.5 text-gray-400 font-medium">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {[
                                                ['ELCB', 2, 2, 20, 30, 'EBS', 14, 220],
                                                ['ELCB', 2, 2, 30, 30, 'EBS', 14, 220],
                                                ['ELCB', 2, 2, 20, 50, 'EBS', 18, 220],
                                                ['ELCB', 2, 2, 30, 50, 'EBS', 18, 220],
                                                ['ELCB', 2, 2, 40, 50, 'EBS', 18, 220],
                                                ['ELCB', 2, 2, 50, 50, 'EBS', 18, 220]
                                            ].map((row, idx) => (
                                                <tr key={idx} className="hover:bg-gray-900/50">
                                                    {row.map((cell, cIdx) => (
                                                        <td key={cIdx} className="border border-gray-800 px-1 py-1.5 text-center text-gray-300 truncate">{cell}</td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* 1-1. 단상2선 배선용차단기 (MCCB) */}
                        <div className="border border-gray-800 bg-black relative mb-3">
                            <CornerBorders />
                            <div
                                className="p-2.5 flex items-center justify-between cursor-pointer hover:bg-gray-900 transition-colors"
                                onClick={() => setExpandedFactors(prev => ({ ...prev, mccb1p2w: !prev.mccb1p2w }))}
                            >
                                <h4 className="text-[11px] font-bold text-gray-300">단상2선 배선용차단기 (MCCB)</h4>
                                {expandedFactors.mccb1p2w ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </div>
                            {expandedFactors.mccb1p2w && (
                                <div className="p-3 border-t border-gray-800 overflow-x-auto">
                                    <table className="w-full text-xs border-collapse table-fixed">
                                        <thead>
                                            <tr className="bg-gray-950">
                                                {['CB', 'P', 'W', 'AT', 'AF', 'TYPE', 'kA', '비고'].map(h => (
                                                    <th key={h} className="border border-gray-800 px-1 py-1.5 text-gray-400 font-medium">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {[
                                                ['MCCB', 2, 2, 20, 30, 'ABS', 14, 220],
                                                ['MCCB', 2, 2, 30, 30, 'ABS', 14, 220],
                                                ['MCCB', 2, 2, 20, 50, 'ABS', 18, 220],
                                                ['MCCB', 2, 2, 30, 50, 'ABS', 18, 220],
                                                ['MCCB', 2, 2, 40, 50, 'ABS', 18, 220],
                                                ['MCCB', 2, 2, 50, 50, 'ABS', 18, 220]
                                            ].map((row, idx) => (
                                                <tr key={idx} className="hover:bg-gray-900/50">
                                                    {row.map((cell, cIdx) => (
                                                        <td key={cIdx} className="border border-gray-800 px-1 py-1.5 text-center text-gray-300 truncate">{cell}</td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* 2. 3상3선 누전차단기 (ELCB) */}
                        <div className="border border-gray-800 bg-black relative mb-3">
                            <CornerBorders />
                            <div
                                className="p-2.5 flex items-center justify-between cursor-pointer hover:bg-gray-900 transition-colors"
                                onClick={() => setExpandedFactors(prev => ({ ...prev, elcb3p3w: !prev.elcb3p3w }))}
                            >
                                <h4 className="text-[11px] font-bold text-gray-300">3상3선 누전차단기 (ELCB)</h4>
                                {expandedFactors.elcb3p3w ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </div>
                            {expandedFactors.elcb3p3w && (
                                <div className="p-3 border-t border-gray-800 overflow-x-auto">
                                    <table className="w-full text-xs border-collapse table-fixed">
                                        <thead>
                                            <tr className="bg-gray-950">
                                                {['CB', 'P', 'W', 'AT', 'AF', 'TYPE', 'kA', '비고'].map(h => (
                                                    <th key={h} className="border border-gray-800 px-1 py-1.5 text-gray-400 font-medium">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {[
                                                ['ELCB', 3, 3, 20, 50, 'EBS', 18, 460],
                                                ['ELCB', 3, 3, 30, 50, 'EBS', 18, 460],
                                                ['ELCB', 3, 3, 40, 50, 'EBS', 18, 460],
                                                ['ELCB', 3, 3, 50, 50, 'EBS', 18, 460],
                                                ['ELCB', 3, 3, 75, 125, 'EBS', 37, 460],
                                                ['ELCB', 3, 3, 100, 125, 'EBS', 37, 460],
                                                ['ELCB', 3, 3, 125, 125, 'EBS', 37, 460],
                                                ['ELCB', 3, 3, 150, 250, 'EBS', 37, 460],
                                                ['ELCB', 3, 3, 175, 250, 'EBS', 37, 460],
                                                ['ELCB', 3, 3, 200, 250, 'EBS', 37, 460],
                                                ['ELCB', 3, 3, 225, 250, 'EBS', 37, 460],
                                                ['ELCB', 3, 3, 250, 400, 'EBS', 50, 460],
                                                ['ELCB', 3, 3, 300, 400, 'EBS', 50, 460],
                                                ['ELCB', 3, 3, 350, 400, 'EBS', 50, 460],
                                                ['ELCB', 3, 3, 400, 400, 'EBS', 50, 460],
                                                ['ELCB', 3, 3, 500, 630, 'EBS', 65, 460],
                                                ['ELCB', 3, 3, 630, 630, 'EBS', 65, 460],
                                                ['ELCB', 3, 3, 700, 800, 'EBS', 85, 460],
                                                ['ELCB', 3, 3, 800, 800, 'EBS', 85, 460]
                                            ].map((row, idx) => (
                                                <tr key={idx} className="hover:bg-gray-900/50">
                                                    {row.map((cell, cIdx) => (
                                                        <td key={cIdx} className="border border-gray-800 px-1 py-1.5 text-center text-gray-300 truncate">{cell}</td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* 3. 3상3선 배선용차단기 (MCCB) */}
                        <div className="border border-gray-800 bg-black relative mb-3">
                            <CornerBorders />
                            <div
                                className="p-2.5 flex items-center justify-between cursor-pointer hover:bg-gray-900 transition-colors"
                                onClick={() => setExpandedFactors(prev => ({ ...prev, mccb3p3w: !prev.mccb3p3w }))}
                            >
                                <h4 className="text-[11px] font-bold text-gray-300">3상3선 배선용차단기 (MCCB)</h4>
                                {expandedFactors.mccb3p3w ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </div>
                            {expandedFactors.mccb3p3w && (
                                <div className="p-3 border-t border-gray-800 overflow-x-auto">
                                    <table className="w-full text-xs border-collapse table-fixed">
                                        <thead>
                                            <tr className="bg-gray-950">
                                                {['CB', 'P', 'W', 'AT', 'AF', 'TYPE', 'kA', '비고'].map(h => (
                                                    <th key={h} className="border border-gray-800 px-1 py-1.5 text-gray-400 font-medium">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {[
                                                ['MCCB', 3, 3, 20, 50, 'ABS', 18, 460],
                                                ['MCCB', 3, 3, 30, 50, 'ABS', 18, 460],
                                                ['MCCB', 3, 3, 40, 50, 'ABS', 18, 460],
                                                ['MCCB', 3, 3, 50, 50, 'ABS', 18, 460],
                                                ['MCCB', 3, 3, 75, 125, 'ABS', 37, 460],
                                                ['MCCB', 3, 3, 100, 125, 'ABS', 37, 460],
                                                ['MCCB', 3, 3, 125, 125, 'ABS', 37, 460],
                                                ['MCCB', 3, 3, 150, 250, 'ABS', 37, 460],
                                                ['MCCB', 3, 3, 175, 250, 'ABS', 37, 460],
                                                ['MCCB', 3, 3, 200, 250, 'ABS', 37, 460],
                                                ['MCCB', 3, 3, 225, 250, 'ABS', 37, 460],
                                                ['MCCB', 3, 3, 250, 400, 'ABS', 50, 460],
                                                ['MCCB', 3, 3, 300, 400, 'ABS', 50, 460],
                                                ['MCCB', 3, 3, 350, 400, 'ABS', 50, 460],
                                                ['MCCB', 3, 3, 400, 400, 'ABS', 50, 460],
                                                ['MCCB', 3, 3, 500, 630, 'ABS', 65, 460],
                                                ['MCCB', 3, 3, 600, 630, 'ABS', 65, 460],
                                                ['MCCB', 3, 3, 630, 630, 'ABS', 65, 460],
                                                ['MCCB', 3, 3, 700, 800, 'ABS', 65, 460],
                                                ['MCCB', 3, 3, 800, 800, 'ABS', 65, 460]
                                            ].map((row, idx) => (
                                                <tr key={idx} className="hover:bg-gray-900/50">
                                                    {row.map((cell, cIdx) => (
                                                        <td key={cIdx} className="border border-gray-800 px-1 py-1.5 text-center text-gray-300 truncate">{cell}</td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* 4. 3상4선 누전차단기 (ELCB) */}
                        <div className="border border-gray-800 bg-black relative mb-3">
                            <CornerBorders />
                            <div
                                className="p-2.5 flex items-center justify-between cursor-pointer hover:bg-gray-900 transition-colors"
                                onClick={() => setExpandedFactors(prev => ({ ...prev, elcb3p4w: !prev.elcb3p4w }))}
                            >
                                <h4 className="text-[11px] font-bold text-gray-300">3상4선 누전차단기 (ELCB)</h4>
                                {expandedFactors.elcb3p4w ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </div>
                            {expandedFactors.elcb3p4w && (
                                <div className="p-3 border-t border-gray-800 overflow-x-auto">
                                    <table className="w-full text-xs border-collapse table-fixed">
                                        <thead>
                                            <tr className="bg-gray-950">
                                                {['CB', 'P', 'W', 'AT', 'AF', 'TYPE', 'kA', '비고'].map(h => (
                                                    <th key={h} className="border border-gray-800 px-1 py-1.5 text-gray-400 font-medium">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {[
                                                ['ELCB', 3, 4, 20, 50, 'EBS', 18, 460],
                                                ['ELCB', 3, 4, 30, 50, 'EBS', 18, 460],
                                                ['ELCB', 3, 4, 40, 50, 'EBS', 18, 460],
                                                ['ELCB', 3, 4, 50, 50, 'EBS', 18, 460],
                                                ['ELCB', 3, 4, 75, 125, 'EBS', 37, 460],
                                                ['ELCB', 3, 4, 100, 125, 'EBS', 37, 460],
                                                ['ELCB', 3, 4, 125, 125, 'EBS', 37, 460],
                                                ['ELCB', 3, 4, 150, 250, 'EBS', 37, 460],
                                                ['ELCB', 3, 4, 175, 250, 'EBS', 37, 460],
                                                ['ELCB', 3, 4, 200, 250, 'EBS', 37, 460],
                                                ['ELCB', 3, 4, 225, 250, 'EBS', 37, 460],
                                                ['ELCB', 3, 4, 250, 400, 'EBS', 50, 460],
                                                ['ELCB', 3, 4, 300, 400, 'EBS', 50, 460],
                                                ['ELCB', 3, 4, 350, 400, 'EBS', 50, 460],
                                                ['ELCB', 3, 4, 400, 400, 'EBS', 50, 460],
                                                ['ELCB', 3, 4, 500, 630, 'EBS', 65, 460],
                                                ['ELCB', 3, 4, 630, 630, 'EBS', 65, 460],
                                                ['ELCB', 3, 4, 700, 800, 'EBS', 85, 460],
                                                ['ELCB', 3, 4, 800, 800, 'EBS', 85, 460]
                                            ].map((row, idx) => (
                                                <tr key={idx} className="hover:bg-gray-900/50">
                                                    {row.map((cell, cIdx) => (
                                                        <td key={cIdx} className="border border-gray-800 px-1 py-1.5 text-center text-gray-300 truncate">{cell}</td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* 5. 3상4선 배선용차단기 (MCCB) */}
                        <div className="border border-gray-800 bg-black relative mb-3">
                            <CornerBorders />
                            <div
                                className="p-2.5 flex items-center justify-between cursor-pointer hover:bg-gray-900 transition-colors"
                                onClick={() => setExpandedFactors(prev => ({ ...prev, mccb3p4w: !prev.mccb3p4w }))}
                            >
                                <h4 className="text-[11px] font-bold text-gray-300">3상4선 배선용차단기 (MCCB)</h4>
                                {expandedFactors.mccb3p4w ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </div>
                            {expandedFactors.mccb3p4w && (
                                <div className="p-3 border-t border-gray-800 overflow-x-auto">
                                    <table className="w-full text-xs border-collapse table-fixed">
                                        <thead>
                                            <tr className="bg-gray-950">
                                                {['CB', 'P', 'W', 'AT', 'AF', 'TYPE', 'kA', '비고'].map(h => (
                                                    <th key={h} className="border border-gray-800 px-1 py-1.5 text-gray-400 font-medium">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {[
                                                ['MCCB', 3, 4, 20, 50, 'ABS', 18, 460],
                                                ['MCCB', 3, 4, 30, 50, 'ABS', 18, 460],
                                                ['MCCB', 3, 4, 40, 50, 'ABS', 18, 460],
                                                ['MCCB', 3, 4, 50, 50, 'ABS', 18, 460],
                                                ['MCCB', 3, 4, 75, 125, 'ABS', 37, 460],
                                                ['MCCB', 3, 4, 100, 125, 'ABS', 37, 460],
                                                ['MCCB', 3, 4, 125, 125, 'ABS', 37, 460],
                                                ['MCCB', 3, 4, 150, 250, 'ABS', 37, 460],
                                                ['MCCB', 3, 4, 175, 250, 'ABS', 37, 460],
                                                ['MCCB', 3, 4, 200, 250, 'ABS', 37, 460],
                                                ['MCCB', 3, 4, 225, 250, 'ABS', 37, 460],
                                                ['MCCB', 3, 4, 250, 400, 'ABS', 50, 460],
                                                ['MCCB', 3, 4, 300, 400, 'ABS', 50, 460],
                                                ['MCCB', 3, 4, 350, 400, 'ABS', 50, 460],
                                                ['MCCB', 3, 4, 400, 400, 'ABS', 50, 460],
                                                ['MCCB', 3, 4, 500, 630, 'ABS', 65, 460],
                                                ['MCCB', 3, 4, 600, 630, 'ABS', 65, 460],
                                                ['MCCB', 3, 4, 630, 630, 'ABS', 65, 460],
                                                ['MCCB', 3, 4, 700, 800, 'ABS', 85, 460],
                                                ['MCCB', 3, 4, 800, 800, 'ABS', 85, 460]
                                            ].map((row, idx) => (
                                                <tr key={idx} className="hover:bg-gray-900/50">
                                                    {row.map((cell, cIdx) => (
                                                        <td key={cIdx} className="border border-gray-800 px-1 py-1.5 text-center text-gray-300 truncate">{cell}</td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 1. 보호장치가 규약시간 이내에 유효하게 동작하는것을 보장하는 전류 (60분 정격) [ KEC-I P116 ] */}
                    <div id="sec-i2" className="mb-8">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-1 h-3 bg-blue-500"></div>
                            <h3 className="text-sm font-bold text-gray-200 uppercase tracking-widest">I<sub>2</sub> 보호장치 규약동작전류의 결정</h3>
                        </div>
                        <div className="border border-gray-800 bg-black p-4 relative mb-4">
                            <CornerBorders />
                            <div className="text-[11px] lg:text-[12.5px] text-gray-300 mb-3 leading-relaxed">
                                - I<sub>2</sub>는 보호장치가 규약시간 이내 유효하게 동작을 보장하는 전류.
                                <br />
                                - 1.45는 과부하 보호점으로 전선의 안전율을 의미하며, 정격전류의 1.45배 과전류가 60분 동안 흘러도 절연체가 손상되지 않는 한계 지점으로 과전류보호장치는 케이블 보호를 위해 그 전에 트립되어야함.
                                <br />
                                - 63[A]은 국제전기표준(IEC) 관련 규정에서 주택용과 산업용 차단기의 특성이 나뉘는 중요한 분기점.
                                <br />
                                - I<sub>B</sub> 및 I<sub>N</sub>와  I<sub>Z</sub> 간 보호협조 조건을 만족하여야 한다.
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                                <div className="border border-gray-800 bg-black p-3 relative">
                                    <CornerBorders />
                                    <div className="text-[10px] lg:text-[11.5px] text-gray-300 uppercase tracking-wider mb-2 text-center">[조건1]</div>
                                    <div className="text-sm font-bold text-blue-400 font-mono text-center">
                                        I<sub>B</sub> ≤ I<sub>N</sub> ≤ I<sub>Z</sub>
                                    </div>
                                </div>
                                <div className="border border-gray-800 bg-black p-3 relative">
                                    <CornerBorders />
                                    <div className="text-[10px] lg:text-[11.5px] text-gray-300 uppercase tracking-wider mb-2 text-center">[조건2]</div>
                                    <div className="text-sm font-bold text-blue-400 font-mono text-center">
                                        I<sub>2</sub> ≤ 1.45 × I<sub>Z</sub>
                                    </div>
                                </div>
                            </div>

                            <div className="text-[10px] lg:text-[11.5px] text-gray-300 mb-4">
                                * 우변의 1.45는 전선 보호를 위한 마지노선으로 항상 고정값.
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-xs lg:text-[13px] border-collapse">
                                    <thead>
                                        <tr className="bg-gray-950 lg:h-10">
                                            <th
                                                colSpan={2}
                                                className={`border border-gray-800 px-2 py-1.5 cursor-pointer transition-all ${cableCondition.i2Type === 'residential' ? 'bg-green-600 text-white' : 'text-gray-500 hover:bg-gray-900 hover:text-gray-300'}`}
                                                onClick={() => setCableCondition(prev => ({ ...prev, i2Type: 'residential' }))}
                                            >
                                                주택용
                                            </th>
                                            <th
                                                colSpan={2}
                                                className={`border border-gray-800 px-2 py-1.5 cursor-pointer transition-all ${cableCondition.i2Type === 'industrial' ? 'bg-green-600 text-white' : 'text-gray-500 hover:bg-gray-900 hover:text-gray-300'}`}
                                                onClick={() => setCableCondition(prev => ({ ...prev, i2Type: 'industrial' }))}
                                            >
                                                산업용
                                            </th>
                                        </tr>
                                        <tr className="bg-gray-950 lg:h-10">
                                            <th className={`border border-gray-800 px-2 py-1.5 transition-colors ${cableCondition.i2Type === 'residential' ? 'text-green-200' : 'text-gray-600'}`}>63A 이하</th>
                                            <th className={`border border-gray-800 px-2 py-1.5 transition-colors ${cableCondition.i2Type === 'residential' ? 'text-green-200' : 'text-gray-600'}`}>63A 초과</th>
                                            <th className={`border border-gray-800 px-2 py-1.5 transition-colors ${cableCondition.i2Type === 'industrial' ? 'text-green-200' : 'text-gray-600'}`}>63A 이하</th>
                                            <th className={`border border-gray-800 px-2 py-1.5 transition-colors ${cableCondition.i2Type === 'industrial' ? 'text-green-200' : 'text-gray-600'}`}>63A 초과</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="text-center lg:h-10">
                                            <td className={`border border-gray-800 px-2 py-1.5 transition-all ${cableCondition.i2Type === 'residential' ? 'text-green-400 font-bold bg-green-500/10' : 'text-gray-600'}`}>1.45</td>
                                            <td className={`border border-gray-800 px-2 py-1.5 transition-all ${cableCondition.i2Type === 'residential' ? 'text-green-400 font-bold bg-green-500/10' : 'text-gray-600'}`}>1.52</td>
                                            <td className={`border border-gray-800 px-2 py-1.5 transition-all ${cableCondition.i2Type === 'industrial' ? 'text-green-400 font-bold bg-green-500/10' : 'text-gray-600'}`}>1.3</td>
                                            <td className={`border border-gray-800 px-2 py-1.5 transition-all ${cableCondition.i2Type === 'industrial' ? 'text-green-400 font-bold bg-green-500/10' : 'text-gray-600'}`}>1.37</td>
                                        </tr>
                                    </tbody>
                                </table>
                                <div className="text-[10px] lg:text-[11.5px] text-gray-300 mt-1">* 동작시간: 63A 이하 60분, 63A 초과 120분 (부동작전류는 제외)</div>
                            </div>
                        </div>
                    </div>

                    {/* 2. 설계전류(IB)를 고려한 단면적 */}
                    <div id="sec-sb" className="mb-8">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-1 h-3 bg-blue-500"></div>
                            <h3 className="text-sm font-bold text-gray-200 uppercase tracking-widest">S<sub>B</sub> 설계전류(I<sub>B</sub>)를 고려한 단면적</h3>
                        </div>
                        <div className="border border-gray-800 bg-black p-4 relative">
                            <CornerBorders />
                            <div className="text-[11px] lg:text-[12.5px] text-gray-300 mb-3 leading-relaxed">
                                - 계산된 단면적 중 최대값을 선정, [조건1] I<sub>B</sub> ≤ I<sub>N</sub> ≤ I<sub>Z</sub> 을 만족.
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="border border-gray-800 p-3 bg-gray-900/30 flex flex-wrap items-center justify-center gap-x-1">
                                    <div className="text-[10px] lg:text-[11.5px] text-gray-400 mb-2 w-full text-center">단상 전류(I<sub>B</sub>)(상전압)</div>
                                    <div className="text-sm font-bold text-blue-400 font-mono">
                                        <span>I<sub>B</sub></span>
                                        <span className="ml-1">= (P / V) · α</span>
                                        <span className="text-gray-400 ml-1">[A]</span>
                                    </div>
                                </div>
                                <div className="border border-gray-800 p-3 bg-gray-900/30 flex flex-wrap items-center justify-center gap-x-1">
                                    <div className="text-[10px] lg:text-[11.5px] text-gray-400 mb-2 w-full text-center">3상 전류(I<sub>B</sub>)(선간전압)</div>
                                    <div className="text-sm font-bold text-blue-400 font-mono">
                                        <span>I<sub>B</sub></span>
                                        <span className="ml-1">= P / (√3·V<sub>n</sub>·η·cosθ) · α</span>
                                        <span className="text-gray-400 ml-1">[A]</span>
                                    </div>
                                </div>
                            </div>

                            {/* Reference and Input Values */}
                            <div className="mt-4 border-t border-gray-800 pt-4">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {/* Area */}
                                    <div className="flex flex-col items-center gap-1">
                                        <span className="text-[11px] text-gray-400">단심/다심 기준</span>
                                        <div className="text-xs font-bold text-gray-300">
                                            {cableCondition.area} <span className="text-xs text-gray-500">㎟</span>
                                        </div>
                                    </div>
                                    {/* Power Factor */}
                                    <div className="flex flex-col items-center gap-1">
                                        <span className="text-[11px] text-gray-400">역률 (φ)</span>
                                        <div className="text-xs font-bold text-gray-300">
                                            {cableCondition.powerFactor}
                                        </div>
                                    </div>
                                    {/* Efficiency */}
                                    <div className="flex flex-col items-center gap-1">
                                        <span className="text-[11px] text-gray-400">효율 (η)</span>
                                        <div className="text-xs font-bold text-gray-300">
                                            {typeof cableCondition.efficiency === 'number' ? cableCondition.efficiency.toFixed(1) : cableCondition.efficiency}
                                        </div>
                                    </div>
                                    {/* Demand Factor (Variable) */}
                                    <div className="flex flex-col items-center gap-1">
                                        <span className="text-[11px] text-gray-400">수용률 (α)</span>
                                        <div className="text-xs font-bold text-gray-300">
                                            가변
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 3. SCB 과전류 보호장치를 고려한 단면적 */}
                    <div id="sec-scb" className="mb-8">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-1 h-3 bg-blue-500"></div>
                            <h3 className="text-sm font-bold text-gray-200 uppercase tracking-widest">S<sub>CB</sub> 과전류 보호장치를 고려한 단면적</h3>
                        </div>
                        <div className="border border-gray-800 bg-black p-4 relative">
                            <CornerBorders />
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-center">
                                <div className="border border-gray-800 p-3 bg-gray-900/30 flex flex-wrap items-center justify-center gap-x-1">
                                    <div className="text-[10px] lg:text-[11.5px] text-gray-400 mb-2 w-full text-center">보호장치의 정격전류(I<sub>N</sub>)를 고려한 단면적</div>
                                    <div className="text-sm font-bold text-blue-400 font-mono">
                                        <span>I<sub>B</sub>(I<sub>M</sub>)</span>
                                        <span className="ml-1">≤ I<sub>N</sub> ≤ I<sub>Z</sub></span>
                                    </div>
                                </div>

                                <div className="space-y-3 text-[11px] lg:text-[12.5px] text-gray-200">
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                        <div className="flex items-center gap-1">
                                            <span className="text-blue-400 font-bold min-w-[30px]">I<sub>B</sub></span>
                                            <span>: 회로의 설계전류</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <span className="text-blue-400 font-bold min-w-[30px]">I<sub>N</sub></span>
                                            <span>: 차단기 정격전류</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <span className="text-blue-400 font-bold min-w-[30px]">I<sub>M</sub></span>
                                            <span>: 전동기 정격전류</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <span className="text-blue-400 font-bold min-w-[30px]">I<sub>Z</sub></span>
                                            <span>: 전선의 허용전류</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 4. 단락전류(Is)에 의한 도체의 온도상승을 고려한 단면적 [ KS C IEC 60364-4-43, KEC GUIDE P163 ] */}
                    <div id="sec-ssc" className="mb-8">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-1 h-3 bg-blue-500"></div>
                            <h3 className="text-sm font-bold text-gray-200 uppercase tracking-widest">S<sub>SC</sub> 단락전류를 고려한 단면적</h3>
                        </div>
                        <div className="border border-gray-800 bg-black p-4 relative mb-4">
                            <CornerBorders />
                            <div className="space-y-8">
                                {/* Formula & Descriptions */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                                    <div className="text-center space-y-3">
                                        <div className="text-sm font-bold text-blue-400 font-mono bg-gray-900/30 p-4 flex flex-wrap items-center justify-center gap-x-1">
                                            <span>S</span>
                                            <span>≥ (I<sub>SC</sub> √t<sub>n</sub> / K) × α</span>
                                            <span className="text-gray-400 ml-1">[㎟]</span>
                                        </div>
                                        <div className="text-sm font-bold text-blue-400 font-mono bg-gray-900/30 p-4 flex flex-wrap items-center justify-center gap-x-1">
                                            <span>t<sub>z</sub></span>
                                            <span>= (S × K / I<sub>SC</sub>)<sup>2</sup></span>
                                            <span className="text-gray-400 ml-1">[s]</span>
                                        </div>
                                        <div className="text-sm font-bold text-blue-400 font-mono bg-gray-900/30 p-4 text-center">
                                            t<sub>n</sub> ≤ t<sub>z</sub> : <span className="text-gray-400">Pass</span> , t<sub>n</sub> &gt; t<sub>z</sub> : <span className="text-gray-400">Fail</span>
                                        </div>
                                    </div>
                                    <div className="space-y-3 text-[11px] lg:text-[12.5px] text-gray-200">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                                            <div className="flex items-center gap-1">
                                                <span className="text-blue-400 font-bold min-w-[30px]">I<sub>SC</sub></span>
                                                <span>: 단락전류의 실효값 [A]</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <span className="text-blue-400 font-bold min-w-[30px]">t<sub>z</sub></span>
                                                <span>: 단시간 허용온도 도달 시간 [s]</span>
                                            </div>
                                            <div className="col-span-1 sm:col-span-2 py-1 border-y border-gray-800/30">
                                                <div className="flex items-center gap-1">
                                                    <span className="text-blue-400 font-bold min-w-[30px]">t<sub>n</sub></span>
                                                    <span>: 보호장치 동작시간 [s]</span>
                                                </div>
                                                <div className="text-[10px] text-gray-400 mt-1 pl-1">
                                                    * [0.1 ~ 0.5] 일반적으로 고압 0.5 이상, 저압 0.1 이상 (제조사 제공)
                                                </div>
                                            </div>
                                            <div className="col-span-1 sm:col-span-2">
                                                <div className="flex items-center gap-1">
                                                    <span className="text-blue-400 font-bold min-w-[30px]">α</span>
                                                    <span>: 여유계수</span>
                                                </div>
                                                <div className="text-[10px] text-gray-400 mt-0.5 pl-1">
                                                    * [1 ~ 1.25] 전압변화, 선로정수 변화 등을 고려하여 여유를 25%
                                                </div>
                                            </div>
                                            <div className="col-span-1 sm:col-span-2 pt-1 border-t border-gray-800/30">
                                                <div className="flex items-center gap-1">
                                                    <span className="text-blue-400 font-bold min-w-[30px]">K</span>
                                                    <span>: 절연물의 종류</span>
                                                </div>
                                                <div className="text-[10px] text-gray-400 mt-0.5 pl-1">
                                                    * [PVC: 115, XLPE: 143] 도체절연 형식에 따라 선택
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* 도체절연 형식 (K값 선택) */}
                                <div>
                                    <div className="text-sm font-bold text-gray-200 mb-3 flex items-center gap-2">
                                        <div className="w-1 h-3 bg-blue-500/50"></div>
                                        도체절연 형식 (K값 선택)
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full min-w-[600px] text-xs lg:text-[13px] border-collapse">
                                            <thead>
                                                <tr className="bg-gray-950 lg:h-10">
                                                    <th className="border border-gray-800 px-1 py-1.5 text-gray-400 w-[65px] lg:w-auto">
                                                        {renderVerticalLabel('구분')}
                                                    </th>
                                                    <th colSpan={2} className="border border-gray-800 px-2 py-1.5 text-gray-300">PVC (열가소성)</th>
                                                    <th colSpan={2} className="border border-gray-800 px-2 py-1.5 text-gray-300">PVC (열가소성)</th>
                                                    <th className="border border-gray-800 px-2 py-1.5 text-gray-300">XLPE (열경화성)</th>
                                                </tr>
                                                <tr className="bg-gray-950 lg:h-10">
                                                    <th className="border border-gray-800 px-1 py-1.5 text-gray-400 w-[65px] lg:w-auto">
                                                        {renderVerticalLabel('단면적')}
                                                    </th>
                                                    <th className="border border-gray-800 px-2 py-1.5 text-gray-400">≤300㎟</th>
                                                    <th className="border border-gray-800 px-2 py-1.5 text-gray-400">&gt;300㎟</th>
                                                    <th className="border border-gray-800 px-2 py-1.5 text-gray-400">≤300㎟</th>
                                                    <th className="border border-gray-800 px-2 py-1.5 text-gray-400">&gt;300㎟</th>
                                                    <th className="border border-gray-800 px-2 py-1.5 text-gray-400">-</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr className="text-center lg:h-10">
                                                    <td className="border border-gray-800 px-1 py-1.5 text-gray-400 bg-gray-950 w-[65px] lg:w-auto">
                                                        {renderVerticalLabel('초기온도')}
                                                    </td>
                                                    <td colSpan={2} className="border border-gray-800 px-2 py-1.5 text-gray-400">70℃</td>
                                                    <td colSpan={2} className="border border-gray-800 px-2 py-1.5 text-gray-400">90℃</td>
                                                    <td className="border border-gray-800 px-2 py-1.5 text-gray-400">90℃</td>
                                                </tr>
                                                <tr className="text-center lg:h-10">
                                                    <td className="border border-gray-800 px-1 py-1.5 text-gray-400 bg-gray-950 w-[65px] lg:w-auto">
                                                        {renderVerticalLabel('최종온도')}
                                                    </td>
                                                    <td className="border border-gray-800 px-2 py-1.5 text-gray-400">160℃</td>
                                                    <td className="border border-gray-800 px-2 py-1.5 text-gray-400">140℃</td>
                                                    <td className="border border-gray-800 px-2 py-1.5 text-gray-400">160℃</td>
                                                    <td className="border border-gray-800 px-2 py-1.5 text-gray-400">140℃</td>
                                                    <td className="border border-gray-800 px-2 py-1.5 text-gray-400">250℃</td>
                                                </tr>
                                                {[
                                                    { label: '구리', values: [115, 103, 100, 86, 143], rowIdx: 2 },
                                                    { label: '알루미늄', values: [76, 68, 66, 57, 94], rowIdx: 3 }
                                                ].map((row) => (
                                                    <tr key={row.label} className="text-center lg:h-10">
                                                        <td className="border border-gray-800 px-1 py-1.5 text-gray-400 bg-gray-950 w-[65px] lg:w-auto">
                                                            {renderVerticalLabel(row.label)}
                                                        </td>
                                                        {row.values.map((val, colIdx) => {
                                                            const isSelectedInSSC = shortCircuitSettings.selectedK.rowIdx === row.rowIdx && shortCircuitSettings.selectedK.colIdx === colIdx;
                                                            return (
                                                                <td
                                                                    key={colIdx}
                                                                    onClick={() => {
                                                                        setShortCircuitSettings(prev => ({ ...prev, k: val, selectedK: { rowIdx: row.rowIdx, colIdx } }));
                                                                        setSmsthSettings(prev => ({ ...prev, k: val, selectedK: { rowIdx: row.rowIdx, colIdx } }));
                                                                    }}
                                                                    className={`border border-gray-800 px-2 py-1.5 cursor-pointer transition-all font-mono text-sm relative
                                                                        ${isSelectedInSSC
                                                                            ? 'bg-green-600/30 text-green-300 font-bold z-10 ring-1 ring-green-500 ring-inset shadow-[0_0_15px_rgba(34,197,94,0.3)]'
                                                                            : 'text-gray-400 hover:bg-gray-900 hover:text-white'}`}
                                                                >
                                                                    {isSelectedInSSC && (
                                                                        <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-green-500 rounded-bl-sm" />
                                                                    )}
                                                                    {val}
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* 설계 표준 값의 결정 */}
                                <div>
                                    <div className="text-sm font-bold text-gray-200 mb-3 flex items-center gap-2">
                                        <div className="w-1 h-3 bg-blue-500/50"></div>
                                        설계 표준 값의 결정
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs lg:text-[13px] border-collapse table-fixed">
                                            <thead>
                                                <tr className="bg-gray-950 h-10">
                                                    <th className="border border-gray-800 px-2 text-gray-400 font-medium">(1) 예상단락전류 (I<sub>SC</sub>)</th>
                                                    <th className="border border-gray-800 px-2 text-gray-400 font-medium">(2) 보호장치 동작시간 (t<sub>n</sub>)</th>
                                                    <th className="border border-gray-800 px-2 text-gray-400 font-medium">(3) 여유계수 (α)</th>
                                                    <th className="border border-gray-800 px-2 text-gray-400 font-medium">(4) 절연물종류 (K)</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr className="text-center h-10">
                                                    <td className="border border-gray-800 px-2">
                                                        <div className="flex items-center justify-center h-full">
                                                            <input
                                                                type="text"
                                                                value={shortCircuitSettings.is}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                                                        setShortCircuitSettings(prev => ({ ...prev, is: val }));
                                                                    }
                                                                }}
                                                                className="w-[35px] bg-transparent text-green-400 font-mono text-[14px] lg:text-[15px] font-bold outline-none text-center appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                                            />
                                                            <span className="text-green-400 font-mono text-[14px] lg:text-[15px] font-bold">%</span>
                                                        </div>
                                                    </td>
                                                    <td className="border border-gray-800 px-2">
                                                        <div className="flex items-center justify-center h-full">
                                                            <input
                                                                type="text"
                                                                value={shortCircuitSettings.tn}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                                                        setShortCircuitSettings(prev => ({ ...prev, tn: val }));
                                                                    }
                                                                }}
                                                                className="w-full bg-transparent text-green-400 font-mono text-[14px] lg:text-[15px] font-bold outline-none text-center"
                                                            />
                                                        </div>
                                                    </td>
                                                    <td className="border border-gray-800 px-2">
                                                        <div className="flex items-center justify-center h-full">
                                                            <input
                                                                type="text"
                                                                value={shortCircuitSettings.alpha}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                                                        setShortCircuitSettings(prev => ({ ...prev, alpha: val }));
                                                                    }
                                                                }}
                                                                className="w-full bg-transparent text-green-400 font-mono text-[14px] lg:text-[15px] font-bold outline-none text-center"
                                                            />
                                                        </div>
                                                    </td>
                                                    <td className="border border-gray-800 px-2 bg-gray-900/50">
                                                        <div className="flex items-center justify-center h-full">
                                                            <input
                                                                type="number"
                                                                value={shortCircuitSettings.k}
                                                                readOnly
                                                                className="w-full bg-transparent text-green-400 font-mono text-[14px] lg:text-[15px] font-bold outline-none text-center cursor-default"
                                                            />
                                                        </div>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 5. S_MSTh 기동전류에 의한 도체의 온도상승을 고려한 단면적 */}
                    <div id="sec-smsth" className="mb-8">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-1 h-3 bg-blue-500"></div>
                            <h3 className="text-sm font-bold text-gray-200 uppercase tracking-widest">
                                <span className="hidden lg:inline">S<sub>MSTh</sub> 기동전류에 의한 도체의 온도상승을 고려한 단면적</span>
                                <span className="lg:hidden">S<sub>MSTh</sub> 기동전류에 의한 도체의 온도상승을...</span>
                            </h3>
                        </div>
                        <div className="border border-gray-800 bg-black p-4 relative mb-4">
                            <CornerBorders />
                            <div className="space-y-8">
                                {/* Formula & Descriptions */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                                    <div className="text-center space-y-3">
                                        <div className="text-sm font-bold text-blue-400 font-mono bg-gray-900/30 p-4 flex flex-wrap items-center justify-center gap-x-1">
                                            <span>S</span>
                                            <span>≥ [(I<sub>MS</sub> √t<sub>m</sub>) / (K × n)] × α</span>
                                            <span className="text-gray-400 ml-1">[㎟]</span>
                                        </div>
                                        <div className="text-sm font-bold text-blue-400 font-mono bg-gray-900/30 p-4 flex flex-wrap items-center justify-center gap-x-1">
                                            <span>I<sub>MS</sub></span>
                                            <span>= I<sub>M</sub> × β × C</span>
                                            <span className="text-gray-400 ml-1">[A]</span>
                                        </div>
                                    </div>
                                    <div className="space-y-3 text-[11px] lg:text-[12.5px] text-gray-200">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                                            <div className="flex items-center gap-1">
                                                <span className="text-blue-400 font-bold min-w-[30px]">I<sub>M</sub></span>
                                                <span>: 전동기 정격전류 [A]</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <span className="text-blue-400 font-bold min-w-[30px]">I<sub>MS</sub></span>
                                                <span>: 전동기 기동전류 [A]</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <span className="text-blue-400 font-bold min-w-[30px]">t<sub>m</sub></span>
                                                <span>: 전동기의 전전압 기동시간 [s]</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <span className="text-blue-400 font-bold min-w-[30px]">n</span>
                                                <span>: 병렬도체 수</span>
                                            </div>
                                            <div className="col-span-1 py-1 border-y border-gray-800/30">
                                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-blue-400 font-bold min-w-[30px]">β</span>
                                                        <span>: 전동기 기동배율</span>
                                                    </div>
                                                    <div className="text-gray-600 hidden sm:block">/</div>
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-blue-400 font-bold min-w-[30px]">C</span>
                                                        <span>: 전동기 기동계수</span>
                                                    </div>
                                                </div>
                                                <div className="text-[10px] text-gray-400 mt-1 pl-1">
                                                    * t<sub>m</sub>, β, C는 제조사가 제공하는 기술 사양서
                                                </div>
                                            </div>
                                            <div className="col-span-1 py-1 border-y border-gray-800/30">
                                                <div className="flex items-center gap-1">
                                                    <span className="text-blue-400 font-bold min-w-[30px]">K</span>
                                                    <span>: 절연물의 종류</span>
                                                </div>
                                                <div className="text-[10px] text-gray-400 mt-1 pl-1">
                                                    * K: [PVC: 115, XLPE: 143] 도체절연 형식에 따라 선택
                                                </div>
                                            </div>
                                            <div className="col-span-1 sm:col-span-2">
                                                <div className="flex items-center gap-1">
                                                    <span className="text-blue-400 font-bold min-w-[30px]">α</span>
                                                    <span>: 여유계수</span>
                                                </div>
                                                <div className="text-[10px] text-gray-400 mt-0.5 pl-1">
                                                    * [1 ~ 1.25] 전압변화, 선로정수 변화 등을 고려하여 여유를 25%
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* 설계 표준 값의 결정 */}
                                <div>
                                    <div className="text-sm font-bold text-gray-200 mb-3 flex items-center gap-2">
                                        <div className="w-1 h-3 bg-blue-500/50"></div>
                                        설계 표준 값의 결정
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs lg:text-[13px] border-collapse table-fixed">
                                            <thead>
                                                <tr className="bg-gray-950 h-10">
                                                    <th className="border border-gray-800 px-2 text-gray-400 font-medium">(1) MCC</th>
                                                    <th className="border border-gray-800 px-2 text-gray-400 font-medium">(2) 병렬도체 수 (n)</th>
                                                    <th className="border border-gray-800 px-2 text-gray-400 font-medium">(3) 여유계수 (α)</th>
                                                    <th className="border border-gray-800 px-2 text-gray-400 font-medium">(4) 절연물종류 (K)</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr className="text-center h-10">
                                                    <td className="border border-gray-800 p-0 text-center relative group/btn">
                                                        <button
                                                            onClick={handleSettingsClick}
                                                            className="w-full h-full flex items-center justify-center text-[12px] lg:text-[13px] font-bold text-yellow-500 hover:text-yellow-400 hover:bg-yellow-500/10 transition-all uppercase tracking-tighter"
                                                        >
                                                            설정
                                                        </button>
                                                    </td>
                                                    <td className="border border-gray-800 px-2">
                                                        <div className="flex items-center justify-center h-full">
                                                            <input
                                                                type="text"
                                                                value={smsthSettings.n}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    if (val === '' || /^\d*$/.test(val)) {
                                                                        setSmsthSettings(prev => ({ ...prev, n: val }));
                                                                    }
                                                                }}
                                                                className="w-full bg-transparent text-green-400 font-mono text-[14px] lg:text-[15px] font-bold outline-none text-center"
                                                            />
                                                        </div>
                                                    </td>
                                                    <td className="border border-gray-800 px-2">
                                                        <div className="flex items-center justify-center h-full">
                                                            <input
                                                                type="text"
                                                                value={smsthSettings.alpha}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                                                        setSmsthSettings(prev => ({ ...prev, alpha: val }));
                                                                    }
                                                                }}
                                                                className="w-full bg-transparent text-green-400 font-mono text-[14px] lg:text-[15px] font-bold outline-none text-center"
                                                            />
                                                        </div>
                                                    </td>
                                                    <td className="border border-gray-800 px-2 bg-gray-900/50">
                                                        <div className="flex items-center justify-center h-full">
                                                            <span className="text-green-400 font-mono text-[14px] lg:text-[15px] font-bold">
                                                                {smsthSettings.k}
                                                            </span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 6. 수용가 설비에서의 전압강하 [ KEC-I P110 ] */}
                    <div id="sec-edrop" className="mb-8">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-1 h-3 bg-blue-500"></div>
                            <h3 className="text-sm font-bold text-gray-200 uppercase tracking-widest">e<sub>%</sub> 수용가 설비에서의 전압강하</h3>
                        </div>
                        <div className="border border-gray-800 bg-black p-4 relative mb-4">
                            <CornerBorders />
                            <div className="text-sm font-bold text-gray-200 mb-3 flex items-center gap-2">
                                <div className="w-1 h-3 bg-blue-500/50"></div>
                                전압강하 표준식
                            </div>
                            <div className="text-[11px] lg:text-[12.5px] text-gray-300 mb-3">
                                - 저압수전: 인입구 계량기 2차측부터 말단 부하까지.
                                <br />- 고압수전: 전기실 저압반에서 각실의 말단 부하까지.
                                <br />- 배선설비가 100m 초과 부분의 전압강하는 미터 당 0.005% 증가할 수 있으나 이러한 증가분은 0.5%를 넘지 않아야 한다.
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div>
                                    <table className="w-full text-xs lg:text-[13px] border-collapse mb-4">
                                        <thead>
                                            <tr className="bg-gray-950 lg:h-10">
                                                <th className="border border-gray-800 px-2 py-1.5 text-gray-300">설비의 유형</th>
                                                <th className="border border-gray-800 px-2 py-1.5 text-gray-300">조명(%)</th>
                                                <th className="border border-gray-800 px-2 py-1.5 text-gray-300">기타(%)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr className="text-center lg:h-10">
                                                <td className="border border-gray-800 px-2 py-1.5 text-gray-300 bg-gray-950">저압수전</td>
                                                <td className="border border-gray-800 px-2 py-1.5 text-gray-300">3</td>
                                                <td className="border border-gray-800 px-2 py-1.5 text-gray-300">5</td>
                                            </tr>
                                            <tr className="text-center lg:h-10">
                                                <td className="border border-gray-800 px-2 py-1.5 text-gray-300 bg-gray-950">고압수전</td>
                                                <td className="border border-gray-800 px-2 py-1.5 text-gray-300">6</td>
                                                <td className="border border-gray-800 px-2 py-1.5 text-gray-300">8</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                    <div className="border border-gray-800 p-3 bg-gray-900/30 font-mono text-sm font-bold text-blue-400 flex flex-wrap items-center justify-center gap-x-1">
                                        <span>e</span>
                                        <span>= K(ρ/A cosθ + λL sinθ)I<sub>B</sub></span>
                                        <span>= K(Rcosθ + Xsinθ)I<sub>B</sub></span>
                                    </div>
                                </div>
                                <div className="space-y-3 text-[11px] lg:text-[12.5px] text-gray-200">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                                        <div className="flex items-center gap-1">
                                            <span className="text-blue-400 font-bold min-w-[30px]">e</span>
                                            <span>: 전압강하 [V]</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <span className="text-blue-400 font-bold min-w-[30px]">A</span>
                                            <span>: 도체의 단면적 [㎟]</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <span className="text-blue-400 font-bold min-w-[30px]">ρ</span>
                                            <span>: 도체의 저항률</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <span className="text-blue-400 font-bold min-w-[30px]">I<sub>B</sub></span>
                                            <span>: 전류(설계) [A]</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <span className="text-blue-400 font-bold min-w-[30px]">L</span>
                                            <span>: 배선의 길이 [m]</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <span className="text-blue-400 font-bold min-w-[35px]">cosθ</span>
                                            <span>: 역률 / sinθ: 무효율 [Ω/m]</span>
                                        </div>
                                        <div className="col-span-1 sm:col-span-2 pt-1 border-t border-gray-800/30">
                                            <div className="flex items-center gap-1">
                                                <span className="text-blue-400 font-bold min-w-[30px]">K</span>
                                                <span>: 배선방식의 계수</span>
                                            </div>
                                            <div className="text-[10px] text-gray-400 mt-0.5 pl-1 leading-relaxed">
                                                * 3상4선=1, 단상2선=1, 3상3선=√3, 불평형률 30%이상의 3상/단상=2
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 pt-4 border-t border-gray-800">
                                <div className="text-sm font-bold text-gray-200 mb-3 flex items-center gap-2">
                                    <div className="w-1 h-3 bg-blue-500/50"></div>
                                    전압강하 간단식
                                </div>
                                <div className="text-[11px] lg:text-[12.5px] text-gray-300 mb-3">
                                    - 옥내배선 등 전선의 길이가 짧고(100m 이하) 경우와
                                    <br />- 전선이 가는 경우 표피효과나 근접효과 등에 의한 도체저항 값의 증가분이나 리액턴스분을 무시해도 지장이 없을 때
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="border border-gray-800 p-3 bg-gray-900/30 flex flex-wrap items-center justify-center gap-x-1">
                                        <div className="text-[10px] lg:text-[11.5px] text-gray-400 mb-1 w-full text-center">단상 2선식(선간전압)</div>
                                        <div className="text-sm font-bold text-blue-400 font-mono">
                                            <span>e</span>
                                            <span className="ml-1">= (35.6 × L × I) / (1000 × A)</span>
                                        </div>
                                    </div>
                                    <div className="border border-gray-800 p-3 bg-gray-900/30 flex flex-wrap items-center justify-center gap-x-1">
                                        <div className="text-[10px] lg:text-[11.5px] text-gray-400 mb-1 w-full text-center">3상 3선식(선간전압)</div>
                                        <div className="text-sm font-bold text-blue-400 font-mono">
                                            <span>e</span>
                                            <span className="ml-1">= (30.8 × L × I) / (1000 × A)</span>
                                        </div>
                                    </div>
                                    <div className="border border-gray-800 p-3 bg-gray-900/30 flex flex-wrap items-center justify-center gap-x-1">
                                        <div className="text-[10px] lg:text-[11.5px] text-gray-400 mb-1 w-full text-center">단상 3선 및 3상 4선(상전압)</div>
                                        <div className="text-sm font-bold text-blue-400 font-mono">
                                            <span>e</span>
                                            <span className="ml-1">= (17.8 × L × I) / (1000 × A)</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>


                    {/* 7. Se% 전압강하를 고려한 단면적 */}
                    <div id="sec-se-pct" className="mb-8">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-1 h-3 bg-blue-500"></div>
                            <h3 className="text-sm font-bold text-gray-200 uppercase tracking-widest">S<sub>e%</sub> 전압강하를 고려한 단면적</h3>
                        </div>
                        <div className="border border-gray-800 bg-black p-4 relative">
                            <CornerBorders />
                            <div className="border border-gray-800 p-3 bg-gray-900/30 flex flex-wrap items-center justify-center gap-x-1 mb-6">
                                <div className="text-[10px] lg:text-[11.5px] text-gray-400 mb-2 w-full text-center">부하의 전압강하(e%)를 고려한 단면적</div>
                                <div className="text-sm font-bold text-blue-400 font-mono flex flex-wrap items-center justify-center gap-x-1">
                                    <span>e(%)</span>
                                    <span>= (ΔV / V) × 100</span>
                                    <span>= [K·I<sub>B</sub>·L(Rcosθ + Xsinθ) / V] × 100</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
                                {/* Table */}
                                <div className="col-span-3 overflow-x-auto">
                                    <table className="w-full text-xs lg:text-[13px] border-collapse table-fixed">
                                        <thead>
                                            <tr className="bg-gray-950 lg:h-10">
                                                <th className="border border-gray-800 px-2 py-1.5 text-gray-300 w-1/3">설비의 유형</th>
                                                <th className="border border-gray-800 px-2 py-1.5 text-gray-300 w-1/3">조명(%)</th>
                                                <th className="border border-gray-800 px-2 py-1.5 text-gray-300 w-1/3">기타(%)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr className="text-center lg:h-10">
                                                <td className="border border-gray-800 px-2 py-1.5 text-gray-300 bg-gray-950">A - 저압으로 수전하는 경우</td>
                                                <td className="border border-gray-800 px-2 py-1.5 text-gray-300">3</td>
                                                <td className="border border-gray-800 px-2 py-1.5 text-gray-300">5</td>
                                            </tr>
                                            <tr className="text-center lg:h-10">
                                                <td className="border border-gray-800 px-2 py-1.5 text-gray-300 bg-gray-950">B - 고압 이상 수전하는 경우<sup>a</sup></td>
                                                <td className="border border-gray-800 px-2 py-1.5 text-gray-300">6</td>
                                                <td className="border border-gray-800 px-2 py-1.5 text-gray-300">8</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                {/* Notes */}
                                <div className="col-span-2 text-[11px] lg:text-[12px] text-gray-400 space-y-3 pt-1 leading-relaxed">
                                    <div>a: 가능한 한 최종회로 내의 전압강하가 A 의 값을 넘지 않는 것이 바람.</div>
                                    <div>배선설비가 100m 초과 부분의 전압강하는 미터 당 0.005% 증가할 수 있으나 이러한 증가분은 0.5%를 넘지 않아야 한다.</div>
                                    <div>예시) B-조명의 경우 200m가 넘어도 허용전압강하는 6.5% 이하이다.</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 8. SMSe% 기동시 전압강하율을 고려한 단면적 */}
                    <div id="sec-smse-pct" className="mb-8">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-1 h-3 bg-blue-500"></div>
                            <h3 className="text-sm font-bold text-gray-200 uppercase tracking-widest">S<sub>MSe%</sub> 기동시 전압강하율을 고려한 단면적</h3>
                        </div>
                        <div className="border border-gray-800 bg-black p-4 relative">
                            <CornerBorders />
                            <div className="border border-gray-800 p-3 bg-gray-900/30 flex flex-wrap items-center justify-center gap-x-1 mb-6">
                                <div className="text-[10px] lg:text-[11.5px] text-gray-400 mb-2 w-full text-center">부하의 전압강하(SMSe%)를 고려한 단면적</div>
                                <div className="text-sm font-bold text-blue-400 font-mono flex flex-wrap items-center justify-center gap-x-1">
                                    <span>e(%)</span>
                                    <span>= (ΔV / V) × <span className="text-[10px] sm:text-xs">100</span></span>
                                    <span>= [K·I<sub>MS</sub>·L(Rcosθ + Xsinθ) / V] × <span className="text-[10px] sm:text-xs">100</span></span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
                                {/* Table */}
                                <div className="col-span-3 overflow-x-auto pb-2 sm:pb-0">
                                    <table className="w-full min-w-[480px] text-xs lg:text-[13px] border-collapse border border-gray-800 table-fixed">
                                        <tbody>
                                            <tr className="text-center lg:h-10">
                                                <td className="border border-gray-800 px-2 py-1.5 text-gray-300 bg-gray-950">전동기 단일 부하</td>
                                                <td className="border border-gray-800 px-2 py-1.5 text-white">15% 이하 권장</td>
                                                <td className="border border-gray-800 px-2 py-1.5">
                                                    <div className="flex items-center justify-center">
                                                        <input
                                                            type="text"
                                                            value={smseSettings.singleLimit}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                                                    setSmseSettings(prev => ({ ...prev, singleLimit: val }));
                                                                }
                                                            }}
                                                            className="bg-transparent border-none text-green-400 font-black font-mono text-center w-[28px] text-[14px] lg:text-[15px] outline-none p-0"
                                                        />
                                                    </div>
                                                </td>
                                            </tr>
                                            <tr className="text-center lg:h-10">
                                                <td className="border border-gray-800 px-2 py-1.5 text-gray-300 bg-gray-950">전동기 포함 간선</td>
                                                <td className="border border-gray-800 px-2 py-1.5 text-white">10% 이하 권장</td>
                                                <td className="border border-gray-800 px-2 py-1.5">
                                                    <div className="flex items-center justify-center">
                                                        <input
                                                            type="text"
                                                            value={smseSettings.feederLimit}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                                                    setSmseSettings(prev => ({ ...prev, feederLimit: val }));
                                                                }
                                                            }}
                                                            className="bg-transparent border-none text-green-400 font-black font-mono text-center w-[28px] text-[14px] lg:text-[15px] outline-none p-0"
                                                        />
                                                    </div>
                                                </td>
                                            </tr>
                                            <tr className="text-center lg:h-10">
                                                <td className="border border-gray-800 px-2 py-1.5 text-gray-300 bg-gray-950">전동기 기동 역률</td>
                                                <td className="border border-gray-800 px-2 py-1.5 text-white">0.1 ~ 0.3 권장</td>
                                                <td className="border border-gray-800 px-2 py-1.5">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <input
                                                            type="text"
                                                            value={smseSettings.startingPowerFactor}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                                                    setSmseSettings(prev => ({ ...prev, startingPowerFactor: val }));
                                                                }
                                                            }}
                                                            className="bg-transparent border-none text-green-400 font-black font-mono text-center w-[28px] text-[14px] lg:text-[15px] outline-none p-0"
                                                        />
                                                    </div>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                <div className="col-span-2 space-y-3 text-[11px] lg:text-[12.5px] text-gray-200 pt-1">
                                    <div className="flex items-center gap-1">
                                        <span className="text-blue-400 font-bold min-w-[35px]">I<sub>MS</sub></span>
                                        <span>: 전동기의 기동전류 [A]</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className="text-blue-400 font-bold min-w-[35px]">K</span>
                                        <span>: 배선 종류에 따른 계수</span>
                                    </div>
                                    <div className="pt-2 border-t border-gray-800/30 text-[10px] lg:text-[11px] text-gray-400 leading-relaxed">
                                        * 전동기 기동 시에는 전력계통의 일시적인 전압강하를 허용하여 경제적인 배선 설계를 권장함.
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 9. AT_B 설계전류를 고려한 보호장치 선정 */}
                    <div id="sec-atb" className="mb-8">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-1 h-3 bg-blue-500"></div>
                            <h3 className="text-sm font-bold text-gray-200 uppercase tracking-widest">AT<sub>B</sub> 설계전류를 고려한 보호장치 선정</h3>
                        </div>
                        <div className="border border-gray-800 bg-black p-4 relative">
                            <CornerBorders />

                            {/* KEC의 과전류보호장치 선정 원칙 */}
                            <div className="mb-4">
                                <div className="text-sm font-bold text-gray-200 mb-2 flex items-center gap-2">
                                    <div className="w-1 h-3 bg-blue-500/50"></div>
                                    KEC의 과전류보호장치 선정 원칙
                                </div>
                                <div className="text-[11px] lg:text-[12.5px] text-gray-300 leading-relaxed">
                                    KEC는 국제표준(IEC 60364)에 맞춰 '부하전류', '차단기 정격', '케이블 허용전류'의 상관관계를 고려해 차단기를 선정토록 규정.
                                </div>
                            </div>

                            {/* 과거 방식(1.1배, 1.25배)이 사라진 이유 */}
                            <div className="mb-4">
                                <div className="text-sm font-bold text-gray-200 mb-2 flex items-center gap-2">
                                    <div className="w-1 h-3 bg-blue-500/50"></div>
                                    과거 방식(1.1배, 1.25배)이 사라진 이유
                                </div>
                                <div className="text-[11px] lg:text-[12.5px] text-gray-300 leading-relaxed">
                                    이전 내선규정 방식은 부하전류에 일정 계수를 곱해 차단기 용량을 정하고, 그에 맞춰 전선 굵기를 선정하는 '부하 중심' 방식에서 KEC는 '전선 보호'에 초점을 맞춤.
                                </div>
                            </div>

                            {/* 조건1 & 조건2 Grid */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {/* 조건1: 설계전류와 허용전류 사이의 관계 */}
                                <div className="border border-gray-800 bg-gray-900/10 p-4">
                                    <div className="text-sm font-bold text-gray-200 mb-3 flex items-center gap-2">
                                        <div className="w-1 h-3 bg-blue-500/50"></div>
                                        조건1: 설계전류와 허용전류 사이의 관계
                                    </div>
                                    <div className="text-sm font-bold text-blue-400 font-mono mb-3 text-center">
                                        I<sub>B</sub> ≤ I<sub>N</sub> ≤ I<sub>Z</sub>
                                    </div>
                                    <div className="space-y-1 text-[11px] lg:text-[12.5px] text-gray-300">
                                        <div className="flex items-center">
                                            <span className="text-blue-400 font-bold min-w-[25px]">I<sub>B</sub></span>
                                            <span>: 부하가 정상적으로 작동할 때 흐르는 전류</span>
                                        </div>
                                        <div className="flex items-center">
                                            <span className="text-blue-400 font-bold min-w-[25px]">I<sub>N</sub></span>
                                            <span>: 차단기 명판에 기재된 정격 용량</span>
                                        </div>
                                        <div className="flex items-center">
                                            <span className="text-blue-400 font-bold min-w-[25px]">I<sub>Z</sub></span>
                                            <span>: 배선 방식, 주위 온도 등을 고려한 연속 허용전류</span>
                                        </div>
                                    </div>
                                </div>

                                {/* 조건2: 확실한 차단 조건 */}
                                <div className="border border-gray-800 bg-gray-900/10 p-4">
                                    <div className="text-sm font-bold text-gray-200 mb-3 flex items-center gap-2">
                                        <div className="w-1 h-3 bg-blue-500/50"></div>
                                        조건2: 확실한 차단 조건
                                    </div>
                                    <div className="text-sm font-bold text-blue-400 font-mono mb-3 text-center">
                                        I<sub>2</sub> ≤ 1.45 × I<sub>Z</sub>
                                    </div>
                                    <div className="space-y-1 text-[11px] lg:text-[12.5px] text-gray-300 mb-3">
                                        <div className="flex items-start">
                                            <span className="text-blue-400 font-bold min-w-[25px] mt-0.5">I<sub>2</sub></span>
                                            <span>: 보호장치가 규약시간 내에 유효하게 동작하는 것을 보장하는 전류로 63[A]이하에서 주택용 차단기 1.45 , 산업용 차단기는 1.3 적용.</span>
                                        </div>
                                    </div>
                                    <div className="text-[11px] lg:text-[12.5px] text-gray-300 leading-relaxed">
                                        과부하 시 차단기가 적절한 시간 내에 확실히 동작하여 전선을 보호할 수 있는지 확인 조건.
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 9. AT_TH 케이블의 열적강도를 고려한 보호장치 */}
                    <div id="sec-atth" className="mb-8">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-1 h-3 bg-blue-500"></div>
                            <h3 className="text-sm font-bold text-gray-200 uppercase tracking-widest">AT<sub>TH</sub> 케이블의 열적강도를 고려한 보호장치</h3>
                        </div>
                        <div className="border border-gray-800 bg-black relative p-4">
                            <CornerBorders />
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
                                {/* Left Section: 3x2 Grid Box (Formulas + Definitions) */}
                                <div className="border border-gray-800 bg-gray-900/10 p-4 h-full flex flex-col justify-center">
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                                        {/* Row 1: Formulas */}
                                        <div className="flex items-center">
                                            <div className="text-sm font-bold text-blue-400 font-mono flex items-center gap-1 whitespace-nowrap">
                                                <span>I<sub>B</sub></span>
                                                <span>≤</span>
                                                <span>I<sub>N</sub></span>
                                                <span>≤</span>
                                                <span>I<sub>Z</sub></span>
                                            </div>
                                        </div>
                                        <div className="flex items-center">
                                            <div className="text-sm font-bold text-blue-400 font-mono flex items-center gap-1 whitespace-nowrap">
                                                <span>I<sub>2</sub></span>
                                                <span>≤</span>
                                                <span>1.45</span>
                                                <span>×</span>
                                                <span>I<sub>Z</sub></span>
                                            </div>
                                        </div>

                                        {/* Row 2: Definitions (IB, In) */}
                                        <div className="text-[11px] lg:text-[12.5px] text-gray-300 flex items-center">
                                            <span className="text-blue-400 font-bold min-w-[25px]">I<sub>B</sub></span>
                                            <span>: 회로의 설계전류</span>
                                        </div>
                                        <div className="text-[11px] lg:text-[12.5px] text-gray-300 flex items-center">
                                            <span className="text-blue-400 font-bold min-w-[25px]">I<sub>N</sub></span>
                                            <span>: 보호장치 정격전류</span>
                                        </div>

                                        {/* Row 3: Definitions (IZ, I2) */}
                                        <div className="text-[11px] lg:text-[12.5px] text-gray-300 flex items-center">
                                            <span className="text-blue-400 font-bold min-w-[25px]">I<sub>Z</sub></span>
                                            <span>: 케이블 허용전류</span>
                                        </div>
                                        <div className="text-[11px] lg:text-[12.5px] text-gray-300 flex items-center">
                                            <span className="text-blue-400 font-bold min-w-[25px]">I<sub>2</sub></span>
                                            <span>: 규약 동작 전류</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Section: Table */}
                                <div className="overflow-x-auto h-full flex flex-col justify-center">
                                    <table className="w-full text-xs lg:text-[13px] border-collapse table-fixed h-full">
                                        <thead>
                                            <tr className="bg-gray-950 lg:h-10">
                                                <th className="border border-gray-800 px-2 py-3 text-gray-400 font-bold w-1/3">구 분</th>
                                                <th className="border border-gray-800 px-2 py-3 text-gray-400 font-bold w-1/3">63 A 이하</th>
                                                <th className="border border-gray-800 px-2 py-3 text-gray-400 font-bold w-1/3">63 A 초과</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr className="text-center bg-gray-950 lg:h-10">
                                                <td className="border border-gray-800 px-2 py-3 text-gray-300 font-bold">주택용</td>
                                                <td className="border border-gray-800 px-2 py-3 text-gray-300 font-mono">1.45 × I<sub>N</sub></td>
                                                <td className="border border-gray-800 px-2 py-3 text-gray-300 font-mono">1.52 × I<sub>N</sub></td>
                                            </tr>
                                            <tr className="text-center bg-gray-950 lg:h-10">
                                                <td className="border border-gray-800 px-2 py-3 text-gray-300 font-bold">산업용</td>
                                                <td className="border border-gray-800 px-2 py-3 text-gray-300 font-mono">1.3 × I<sub>N</sub></td>
                                                <td className="border border-gray-800 px-2 py-3 text-gray-300 font-mono">1.37 × I<sub>N</sub></td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 10. AT_SC 단락전류에 의한 도체 온도상승을 고려한 정격 */}
                    <div id="sec-atsc" className="mb-8">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-1 h-3 bg-blue-500"></div>
                            <h3 className="text-sm font-bold text-gray-200 uppercase tracking-widest">AT<sub>SC</sub> 단락전류에 의한 도체 온도상승을 고려</h3>
                        </div>
                        <div className="border border-gray-800 bg-black relative p-4">
                            <CornerBorders />
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
                                {/* Left Section: 3x2 Grid Box (Formulas + Definitions) */}
                                <div className="border border-gray-800 bg-gray-900/10 p-4 h-full flex flex-col">
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                                        {/* Row 1: Formulas */}
                                        <div className="flex items-center">
                                            <div className="text-sm font-bold text-blue-400 font-mono flex items-center gap-1 whitespace-nowrap">
                                                <span>t<sub>z</sub></span>
                                                <span>=</span>
                                                <span>(S·K / I<sub>S</sub>)<sup>2</sup></span>
                                            </div>
                                        </div>
                                        <div className="flex items-center">
                                            <div className="text-sm font-bold text-blue-400 font-mono flex items-center gap-1 whitespace-nowrap">
                                                <span>t<sub>n</sub></span>
                                                <span>≤</span>
                                                <span>t<sub>z</sub></span>
                                            </div>
                                        </div>

                                        {/* Row 2: Definitions (IS, tn) */}
                                        <div className="text-[11px] lg:text-[12.5px] text-gray-300 flex items-center">
                                            <span className="text-blue-400 font-bold min-w-[25px]">I<sub>SC</sub></span>
                                            <span>: 단락전류 실효값</span>
                                        </div>
                                        <div className="text-[11px] lg:text-[12.5px] text-gray-300 flex items-center">
                                            <span className="text-blue-400 font-bold min-w-[25px]">t<sub>n</sub></span>
                                            <span>: 보호장치 동작시간</span>
                                        </div>

                                        {/* Row 3: Definitions (tz, K) */}
                                        <div className="text-[11px] lg:text-[12.5px] text-gray-300 flex items-center">
                                            <span className="text-blue-400 font-bold min-w-[25px]">t<sub>z</sub></span>
                                            <span>: 허용온도 도달시간</span>
                                        </div>
                                        <div className="text-[11px] lg:text-[12.5px] text-gray-300 flex items-center">
                                            <span className="text-blue-400 font-bold min-w-[25px]">K</span>
                                            <span>: 절연물의 종류</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Section: Table */}
                                <div className="overflow-x-auto h-full flex flex-col">
                                    <table className="w-full text-xs lg:text-[13px] border-collapse table-fixed">
                                        <thead>
                                            <tr className="bg-gray-950 h-10">
                                                <th className="border border-gray-800 px-2 text-gray-400 font-bold w-1/3">
                                                    <div className="flex items-center justify-center h-full">I<sub>SC</sub></div>
                                                </th>
                                                <th className="border border-gray-800 px-2 text-gray-400 font-bold w-1/3">
                                                    <div className="flex items-center justify-center h-full">t<sub>n</sub></div>
                                                </th>
                                                <th className="border border-gray-800 px-2 text-gray-400 font-bold w-1/3">
                                                    <div className="flex items-center justify-center h-full">K</div>
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr className="bg-gray-950 h-10">
                                                <td className="border border-gray-800 px-2 bg-gray-900/50">
                                                    <div className="flex items-center justify-center h-full gap-0.5">
                                                        <span className="text-green-400 font-mono text-[14px] lg:text-[15px] font-bold">
                                                            {shortCircuitSettings.is}
                                                        </span>
                                                        <span className="text-green-400 font-mono text-[14px] lg:text-[15px] font-bold">%</span>
                                                    </div>
                                                </td>
                                                <td className="border border-gray-800 px-2">
                                                    <div className="flex items-center justify-center h-full">
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={shortCircuitSettings.tn}
                                                            onChange={(e) => setShortCircuitSettings(prev => ({ ...prev, tn: e.target.value === '' ? '' : Number(e.target.value) }))}
                                                            className="w-full bg-transparent text-green-400 font-mono text-[14px] lg:text-[15px] font-bold outline-none text-center appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                                        />
                                                    </div>
                                                </td>
                                                <td className="border border-gray-800 px-2 bg-gray-900/50">
                                                    <div className="flex items-center justify-center h-full">
                                                        <span className="text-green-400 font-mono text-[14px] lg:text-[15px] font-bold">
                                                            {shortCircuitSettings.k}
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                    <div className="text-[10px] lg:text-[11.5px] text-gray-400 mt-2 text-left">
                                        * 단락전류를 고려한 단면적의 "설계 표준 값의 결정" 참조
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 11. AT_ms 전동기 기동전류를 고려한 보호장치 */}
                <div id="sec-atms" className="mb-8">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-1 h-3 bg-blue-500"></div>
                        <h3 className="text-sm font-bold text-gray-200 uppercase tracking-widest">AT<sub>MS</sub> 전동기 기동전류를 고려한 보호장치</h3>
                    </div>
                    <div className="border border-gray-800 bg-black relative p-4">
                        <CornerBorders />
                        {/* Formula */}
                        <div className="grid grid-cols-1 md:grid-cols-1 gap-4 items-center mb-4">
                            <div className="border border-gray-800 bg-gray-900/30 p-4 flex flex-wrap items-center justify-center gap-x-1">
                                <div className="text-sm font-bold text-blue-400 font-mono flex items-center justify-center flex-wrap gap-2">
                                    <span>I<sub>N</sub></span>
                                    <span>=</span>
                                    <div className="flex flex-col items-center justify-center mx-1">
                                        <div className="border-b border-blue-400 px-1 mb-0.5">I<sub>M</sub> × β</div>
                                        <div>δ</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Description List */}
                        <div className="space-y-4 mb-4">
                            {/* Im */}
                            <div className="border border-gray-800 bg-gray-900/10 p-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-blue-400 font-bold font-mono min-w-[30px]">I<sub>M</sub></span>
                                    <span className="text-[13px] lg:text-[14px] font-bold text-gray-200">전동기 정격전류 [A]</span>
                                </div>
                                <div className="pl-[38px] space-y-1 text-[11px] lg:text-[12.5px] text-gray-300 leading-relaxed">
                                    <div>* 전동기가 지정된 조건(정격 전압, 정격 주파수 등)에서 온도 상승 한도를 넘지 않고 연속적으로 안전하게 흘릴 수 있는 최대 전류값.</div>
                                </div>
                            </div>

                            {/* β */}
                            <div className="border border-gray-800 bg-gray-900/10 p-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-blue-400 font-bold font-mono min-w-[30px]">β</span>
                                    <span className="text-[13px] lg:text-[14px] font-bold text-gray-200">전동기의 전전압 기동배율</span>
                                </div>
                                <div className="pl-[38px] space-y-1 text-[11px] lg:text-[12.5px] text-gray-300 leading-relaxed">
                                    <div>* 전동기를 직입기동(Full-voltage starting)시 정격전류의 몇 배의 전류가 흐르는지를 나타내는 수치입니다. 제조사 데이터 시트 참조.</div>
                                    <div>* 일반적인 유도전동기 기준 6.0 ~ 8.0 (보수적으로 7.0~7.5)</div>
                                </div>
                            </div>

                            {/* δ */}
                            <div className="border border-gray-800 bg-gray-900/10 p-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-blue-400 font-bold font-mono min-w-[30px]">δ</span>
                                    <span className="text-[13px] lg:text-[14px] font-bold text-gray-200">기동시간-기동전류에 따른 보호장치의 규약동작배율</span>
                                </div>
                                <div className="pl-[38px] space-y-1 text-[11px] lg:text-[12.5px] text-gray-300 leading-relaxed">
                                    <div>* 전동기 기동 시 차단기가 불필요하게 떨어지지 않도록 설계하기 위해 차단기 제조사가 제시한 동작 특성곡선에서 최소동작시간(t<sub>b</sub>)과 특성곡선의 교점에 해당하는 동작전류가 차단기의 규약동작배율(δ)이 된다.</div>
                                    <div>* 동작시간 선정: 전동기의 기동시간에 약 1.5 ~ 2배의 여유율을 가산하여 보호장치의 최소동작시간(t<sub>b</sub>)을 선정. 차단기의 '시간-전류 특성 곡선'에서 해당 시간에 대응하는 전류 배율을 찾기.</div>
                                </div>
                            </div>

                            {/* Ims section replicated from AT_MS */}
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-1 h-3 bg-blue-500/50"></div>
                                <h4 className="text-[14px] font-bold text-gray-200 uppercase tracking-widest"><span className="font-mono">I<sub>MS</sub></span> : 전동기 기동 전류</h4>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div className="border border-gray-800 bg-gray-900/30 p-4 flex flex-col items-center justify-center gap-2">
                                    <div className="text-[16px] font-bold font-mono text-blue-400 break-all text-center">
                                        I<sub>MS</sub> = I<sub>M</sub> × β × C
                                    </div>
                                </div>
                                <div className="border border-gray-800 bg-gray-900/30 p-4 flex flex-col items-center justify-center gap-2">
                                    <div className="text-[16px] font-bold font-mono text-blue-400 break-all text-center">
                                        I<sub>MS</sub> = I<sub>M</sub> × λ
                                    </div>
                                </div>
                            </div>

                            <div className="bg-gray-900/5 border border-gray-800 p-3 mb-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 md:gap-x-8 gap-y-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-blue-400 font-bold font-mono text-[13px] lg:text-[14px] w-[25px]">I<sub>MS</sub></span>
                                        <span className="text-[11px] lg:text-[12px] text-gray-200">: 전동기 기동 전류</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-blue-400 font-bold font-mono text-[13px] lg:text-[14px] w-[25px]">I<sub>M</sub></span>
                                        <span className="text-[11px] lg:text-[12px] text-gray-200">: 전동기 정격전류</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-blue-400 font-bold font-mono text-[13px] lg:text-[14px] w-[25px]">β</span>
                                        <span className="text-[11px] lg:text-[12px] text-gray-200">: 전동기 전전압 기동배율</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-blue-400 font-bold font-mono text-[13px] lg:text-[14px] w-[25px]">C</span>
                                        <span className="text-[11px] lg:text-[12px] text-gray-200">: 기동방식에 따른 계수</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-blue-400 font-bold font-mono text-[13px] lg:text-[14px] w-[25px]">λ</span>
                                        <span className="text-[11px] lg:text-[12px] text-gray-200">: 기동방식 전류제한 비율</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4 mb-4">
                                {/* IMS */}
                                <div className="border border-gray-800 bg-gray-900/10 p-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-blue-400 font-bold font-mono min-w-[30px]">I<sub>MS</sub></span>
                                        <span className="text-[12px] lg:text-[13px] font-bold text-gray-200">전동기 기동 전류</span>
                                    </div>
                                    <div className="pl-[38px] space-y-1 text-[11px] lg:text-[12.5px] text-gray-300 leading-relaxed">
                                        <div>* 전동기 전원을 투입한 후, 회전자가 가속되어 정상 속도에 도달하기 전까지 흐르는 전류.</div>
                                    </div>
                                </div>

                                {/* C */}
                                <div className="border border-gray-800 bg-gray-900/10 p-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-blue-400 font-bold font-mono min-w-[30px]">C</span>
                                        <span className="text-[12px] lg:text-[13px] font-bold text-gray-200">기동방식에 따른 계수</span>
                                    </div>
                                    <div className="pl-[38px] space-y-1 text-[11px] lg:text-[12.5px] text-gray-300 leading-relaxed">
                                        <div>* 기동시 큰 기동 전류가 계통에 무리를 주기 때문에, 여러 기동 방식 이용해 전류를 낮추는데 그때의 감소 비율.</div>
                                    </div>
                                </div>
                            </div>

                            {/* Beta Factor Summary Table */}
                            <div className="overflow-x-auto w-full max-w-full">
                                <table className="w-full min-w-[700px] border-collapse border border-gray-800 text-[12px] lg:text-[13px] table-fixed">
                                    <thead>
                                        <tr className="bg-gray-800/50 h-10 text-center uppercase">
                                            <th className="border border-gray-700 px-2 text-gray-200 bg-gray-700/30 font-bold w-[14.28%]">기동방식</th>
                                            <th className="border border-gray-700 px-2 text-gray-200 bg-gray-700/30 font-bold w-[14.28%]">1φ 직입</th>
                                            <th className="border border-gray-700 px-2 text-gray-200 bg-gray-700/30 font-bold w-[14.28%]">3φ 직입(S)</th>
                                            <th className="border border-gray-700 px-2 text-gray-200 bg-gray-700/30 font-bold w-[14.28%]">3φ 직입(L)</th>
                                            <th className="border border-gray-700 px-2 text-gray-200 bg-gray-700/30 font-bold w-[14.28%]">Y-Δ</th>
                                            <th className="border border-gray-700 px-2 text-gray-200 bg-gray-700/30 font-bold w-[14.28%]">리액터</th>
                                            <th className="border border-gray-700 px-2 text-gray-200 bg-gray-700/30 font-bold w-[14.28%]">MCC</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="bg-black h-10 text-center">
                                            <td className="border border-gray-700 px-2 bg-gray-800/30 font-bold text-gray-300">β</td>
                                            <td className="border border-gray-700 px-2 text-green-400 font-mono bg-green-400/5 font-bold text-[13px] lg:text-[14px]">{mccSettings.betaDirect1P?.toFixed(1) || '6.0'}</td>
                                            <td className="border border-gray-700 px-2 text-green-400 font-mono bg-green-400/5 font-bold text-[13px] lg:text-[14px]">{mccSettings.betaDirect3PSmall?.toFixed(1) || '9.5'}</td>
                                            <td className="border border-gray-700 px-2 text-green-400 font-mono bg-green-400/5 font-bold text-[13px] lg:text-[14px]">{mccSettings.betaDirect3PLarge?.toFixed(1) || '8.2'}</td>
                                            <td className="border border-gray-700 px-2 text-green-400 font-mono bg-green-400/5 font-bold text-[13px] lg:text-[14px]">{mccSettings.betaYD?.toFixed(1) || '7.2'}</td>
                                            <td className="border border-gray-700 px-2 text-green-400 font-mono bg-green-400/5 font-bold text-[13px] lg:text-[14px]">{mccSettings.betaReactor?.toFixed(1) || '7.7'}</td>
                                            <td className="border border-gray-700 p-0 relative group/btn">
                                                <button
                                                    onClick={handleSettingsClick}
                                                    className="w-full h-full flex items-center justify-center text-[12px] lg:text-[13px] font-bold text-yellow-500 hover:text-yellow-400 hover:bg-yellow-500/10 transition-all uppercase tracking-tighter"
                                                >
                                                    설정
                                                </button>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                                <div className="mt-2 text-[11px] text-gray-500 italic flex items-center gap-1">
                                    <Info size={12} className="text-green-500/70" />
                                    <span>녹색 수치는 MCC 설정 페이지의 현재 설정값을 참조함.</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* AT_mi 전동기 기동돌입전류를 고려한 보호장치 */}
                <div id="sec-atmi" className="mb-8">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-1 h-3 bg-blue-500"></div>
                        <h3 className="text-sm font-bold text-gray-200 uppercase tracking-widest">AT<sub>MI</sub> 전동기 기동돌입전류를 고려한 보호장치</h3>
                    </div>
                    <div className="border border-gray-800 bg-black relative p-4 overflow-hidden min-w-0">
                        <CornerBorders />

                        <div className="grid grid-cols-1 md:grid-cols-1 gap-4 items-center mb-4">
                            <div className="border border-gray-800 bg-gray-900/30 p-4 flex flex-wrap items-center justify-center gap-x-1">
                                <div className="text-sm font-bold text-blue-400 font-mono flex items-center justify-center flex-wrap gap-2">
                                    <span>I<sub>N</sub></span>
                                    <span>=</span>
                                    <div className="flex flex-col items-center justify-center mx-1">
                                        <div className="border-b border-blue-400 px-1 mb-0.5">I<sub>i</sub> × α</div>
                                        <div>δ</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 mb-4">
                            <div className="border border-gray-800 bg-gray-900/10 p-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-blue-400 font-bold font-mono min-w-[30px]">I<sub>i</sub></span>
                                    <span className="text-[13px] lg:text-[14px] font-bold text-gray-200">전동기 기동돌입 전류 [A]</span>
                                </div>
                                <div className="pl-[38px] space-y-1 text-[11px] lg:text-[12.5px] text-gray-300 leading-relaxed">
                                    <div>* 전동기 기동 시 혹은 기동 방식 전환 시 발생하는 일시적인 피크 전류.</div>
                                </div>
                            </div>

                            <div className="border border-gray-800 bg-gray-900/10 p-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-blue-400 font-bold font-mono min-w-[30px]">δ</span>
                                    <span className="text-[13px] lg:text-[14px] font-bold text-gray-200">기동시간과 기동돌입전류에 따른 보호장치의 규약동작배율</span>
                                </div>
                                <div className="pl-[38px] space-y-1 text-[11px] lg:text-[12.5px] text-gray-300 leading-relaxed">
                                    <div>* 기동돌입전류가 흐르는 짧은 시간(Cycle) 내 차단기가 오동작하지 않도록 보증되는 전류 배율.</div>
                                </div>
                            </div>

                            <div className="border border-gray-800 bg-gray-900/10 p-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-blue-400 font-bold font-mono min-w-[30px]">α</span>
                                    <span className="text-sm font-bold text-gray-200">여유율 (1.0 이상 설계값 인정)</span>
                                </div>
                                <div className="pl-[38px] space-y-1 text-[11px] lg:text-[12.5px] text-gray-300 leading-relaxed">
                                    <div>* 현장 조건 및 전동기 특성 편차를 고려하여 적용하는 설계 안전 계수.</div>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-1 h-3 bg-blue-500/50"></div>
                            <h4 className="text-[14px] font-bold text-gray-200 uppercase tracking-widest"><span className="font-mono normal-case">I<sub>i</sub></span> : 전동기 기동돌입 전류</h4>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div className="border border-gray-800 bg-gray-900/30 p-4 flex flex-col items-center justify-center gap-2">
                                <div className="text-[16px] font-bold font-mono text-blue-400 break-all text-center">
                                    I<sub>i</sub> = I<sub>M</sub> × β × C × K
                                </div>
                            </div>
                            <div className="border border-gray-800 bg-gray-900/30 p-4 flex flex-col items-center justify-center gap-2">
                                <div className="text-[16px] font-bold font-mono text-blue-400 break-all text-center">
                                    I<sub>i</sub> = I<sub>M</sub> × λ
                                </div>
                            </div>
                        </div>

                        <div className="bg-gray-900/5 border border-gray-800 p-3 mb-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 md:gap-x-8 gap-y-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-blue-400 font-bold font-mono text-[16px] w-[25px]">I<sub>i</sub></span>
                                    <span className="text-[12px] text-gray-200">: 전동기 기동돌입 전류</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-blue-400 font-bold font-mono text-[16px] w-[25px]">I<sub>M</sub></span>
                                    <span className="text-[12px] text-gray-200">: 전동기 정격전류</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-blue-400 font-bold font-mono text-[16px] w-[25px]">β</span>
                                    <span className="text-[12px] text-gray-200">: 전동기 전전압 기동배율</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-blue-400 font-bold font-mono text-[16px] w-[25px]">C</span>
                                    <span className="text-[12px] text-gray-200">: 기동방식에 따른 계수</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-blue-400 font-bold font-mono text-[16px] w-[25px]">λ</span>
                                    <span className="text-[12px] text-gray-200">: 기동방식 전류제한 비율</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-blue-400 font-bold font-mono text-[16px] w-[25px]">K</span>
                                    <span className="text-[12px] text-gray-200">: 전동기 돌입전류 배율</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 mb-4">
                            {/* IMS */}
                            <div className="border border-gray-800 bg-gray-900/10 p-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-blue-400 font-bold font-mono min-w-[30px]">I<sub>MS</sub></span>
                                    <span className="text-sm font-bold text-gray-200">전동기 기동 전류</span>
                                </div>
                                <div className="pl-[38px] space-y-1 text-[11px] lg:text-[12.5px] text-gray-300 leading-relaxed">
                                    <div>* 전동기 전원을 투입한 후, 회전자가 가속되어 정상 속도에 도달하기 전까지 흐르는 전류.</div>
                                </div>
                            </div>

                            {/* C */}
                            <div className="border border-gray-800 bg-gray-900/10 p-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-blue-400 font-bold font-mono min-w-[30px]">C</span>
                                    <span className="text-sm font-bold text-gray-200">기동방식에 따른 계수</span>
                                </div>
                                <div className="pl-[38px] space-y-1 text-[11px] lg:text-[12.5px] text-gray-300 leading-relaxed">
                                    <div>* 기동시 큰 기동 전류가 계통에 무리를 주기 때문에, 여러 기동 방식 이용해 전류를 낮추는데 그때의 감소 비율.</div>
                                </div>
                            </div>
                        </div>

                        <div className="overflow-x-auto w-full max-w-full">
                            <table className="w-full min-w-[700px] border-collapse border border-gray-800 text-[12px] lg:text-[13px] table-fixed">
                                <thead>
                                    <tr className="bg-gray-800/50 h-10 text-center uppercase">
                                        <th className="border border-gray-700 px-2 text-gray-200 bg-gray-700/30 font-bold w-[11.11%]">기동방식</th>
                                        <th className="border border-gray-700 px-2 text-gray-200 bg-gray-700/30 font-bold w-[11.11%]">DOL</th>
                                        <th className="border border-gray-700 px-2 text-gray-200 bg-gray-700/30 font-bold w-[11.11%]">Y-D</th>
                                        <th className="border border-gray-700 px-2 text-gray-200 bg-gray-700/30 font-bold w-[11.11%]">리액터</th>
                                        <th className="border border-gray-700 px-2 text-gray-200 bg-gray-700/30 font-bold w-[11.11%]">기동방식</th>
                                        <th className="border border-gray-700 px-2 text-gray-200 bg-gray-700/30 font-bold w-[11.11%]">S.S</th>
                                        <th className="border border-gray-700 px-2 text-gray-200 bg-gray-700/30 font-bold w-[11.11%]">INV</th>
                                        <th className="border border-gray-700 px-2 text-gray-200 bg-gray-700/30 font-bold w-[11.11%]">K</th>
                                        <th className="border border-gray-700 px-2 text-gray-200 bg-gray-700/30 font-bold w-[11.11%]">MCC</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="bg-black h-10 text-center">
                                        <td className="border border-gray-700 px-2 bg-gray-800/30 font-bold text-gray-300">C</td>
                                        <td className="border border-gray-700 px-2 text-green-400 font-mono bg-green-400/5 font-bold text-[13px] lg:text-[14px]">1.0</td>
                                        <td className="border border-gray-700 px-2 text-green-400 font-mono bg-green-400/5 font-bold text-[13px] lg:text-[14px]">0.33</td>
                                        <td className="border border-gray-700 px-2 text-green-400 font-mono bg-green-400/5 font-bold text-[13px] lg:text-[14px]">
                                            {Math.round((mccSettings.reactorTap || 0.65) * 100)}%
                                        </td>
                                        <td className="border border-gray-700 px-2 bg-gray-800/30 font-bold text-gray-300">λ</td>
                                        <td className="border border-gray-700 px-2 text-white font-mono bg-white/5 font-bold text-[13px] lg:text-[14px]">3.5 ~ 5</td>
                                        <td className="border border-gray-700 px-2 text-green-400 font-mono bg-green-400/5 font-bold text-[13px] lg:text-[14px]">
                                            {(mccSettings.lambdaInv || 1.2).toFixed(1)}
                                        </td>
                                        <td className="border border-gray-700 px-2 text-green-400 font-mono bg-green-400/5 font-bold text-[13px] lg:text-[14px]">
                                            {(mccSettings.globalK || 1.5).toFixed(1)}
                                        </td>
                                        <td className="border border-gray-700 p-0 relative group/btn">
                                            <button
                                                onClick={handleSettingsClick}
                                                className="w-full h-full flex items-center justify-center text-[12px] lg:text-[13px] font-bold text-yellow-500 hover:text-yellow-400 hover:bg-yellow-500/10 transition-all uppercase tracking-tighter"
                                            >
                                                설정
                                            </button>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                            <div className="mt-2 text-[11px] text-gray-500 italic flex items-center gap-1">
                                <Info size={12} className="text-green-500/70" />
                                <span>녹색 수치는 MCC 설정 페이지의 현재 설정값을 참조함.</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* CT Standard Section */}
                <div id="sec-ct" className="mb-8">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-1 h-3 bg-blue-500"></div>
                        <h3 className="text-sm font-bold text-gray-200 uppercase tracking-widest">CT 여유율(선정 배수) 표준</h3>
                    </div>

                    <div className="border border-gray-800 bg-black p-4 relative overflow-hidden group">
                        <CornerBorders />

                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
                            {/* Table (Left) */}
                            <div className="col-span-3 overflow-x-auto pb-2 sm:pb-0">
                                <div className="min-w-[450px] border border-gray-800 bg-gray-900/10">
                                    {/* Header Row */}
                                    <div className="grid grid-cols-[1fr_1fr_2fr] divide-x divide-gray-800 border-b border-gray-800 bg-gray-900/30 lg:h-10">
                                        <div className="py-2.5 flex items-center justify-center text-[12px] lg:text-[13px] font-bold text-gray-300 uppercase">부하 구분</div>
                                        <div className="py-2.5 flex items-center justify-center text-[12px] lg:text-[13px] font-bold text-gray-300 uppercase">추천 여유율</div>
                                        <div className="py-2.5 flex items-center justify-center text-[12px] lg:text-[13px] font-bold text-gray-300 uppercase tracking-tight">여유율 적용 상황</div>
                                    </div>
                                    {/* Value Rows */}
                                    {[
                                        { type: "일반 부하 (기본)", factor: "1.25", note: "KESCO 및 내선규정 권장 값" },
                                        { type: "일반 부하 (여유)", factor: "1.50", note: "수용률 변동 및 부하 증설 고려" },
                                        { type: "전동기 부하 (일반)", factor: "2.00", note: "기동 전류가 큰 전동기 부하" },
                                        { type: "전동기 부하 (특수)", factor: "2.50", note: "빈번한 기동이나 대형 모터" },
                                        { type: "간선/인입 (보수적)", factor: "1.33", note: "1/0.75 방식으로 계량기 오차범위 최소화" }
                                    ].map((row, idx) => (
                                        <div key={idx} className="grid grid-cols-[1fr_1fr_2fr] divide-x divide-gray-800 border-b border-gray-800 last:border-b-0 hover:bg-white/5 transition-colors lg:h-10">
                                            <div className="py-2.5 flex items-center justify-center text-[11px] sm:text-[12px] lg:text-[13px] text-gray-300 font-medium">{row.type}</div>
                                            <div className="py-2.5 flex items-center justify-center text-[12px] lg:text-[13px] text-blue-400 font-bold">{row.factor}</div>
                                            <div className="py-2.5 px-4 flex items-center text-[11px] sm:text-[12px] lg:text-[13px] text-gray-300 whitespace-pre-wrap">{row.note}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Description (Right) */}
                            <div className="col-span-2 text-gray-200 text-[11px] lg:text-[12.5px] leading-relaxed space-y-4 pt-1 break-keep">
                                <p>KESCO의 지침 및 설계 관행에 따라, CT 1차 전류는 최대 부하 전류에 다음의 여유율을 곱하여 상위 규격을 선정.</p>
                                <ul className="list-disc list-outside space-y-2 ml-5 text-gray-300">
                                    <li><span className="text-blue-400 font-bold">일반 부하</span>: 최대부하전류의 1.25 ~ 1.5배</li>
                                    <li><span className="text-blue-400 font-bold">전동기 부하</span>: 기동 전류를 고려하여 2.0 ~ 2.5배</li>
                                    <li><span className="text-blue-400 font-bold">한전 MOF(계량용)</span>: 수전 설비 경우 계약 전력에 맞게.</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 9. 병렬 포설(Parallel Conductor) 조건 */}
                <div id="sec-parallel">
                    {renderParallelConductorInfo()}
                </div>

                <div className="mt-8 mb-4 space-y-1">
                    <div className="text-[10px] lg:text-[11.5px] text-gray-400">※ 설계전류(I<sub>B</sub>)는 단상(1Φ) 220[V], 3상(3Φ) 380[V] 기준.</div>
                    <div className="text-[10px] lg:text-[11.5px] text-gray-400">※ 보호장치의 정격전류(I<sub>N</sub>)는 LS Metasol MCCB/ELCB ABS 기준.</div>
                    <div className="text-[10px] lg:text-[11.5px] text-gray-400">※ 전압강하(e%)는 저압수전(3%, 5%), 고압수전(6%, 8%) 기준.</div>
                    <div className="text-[10px] lg:text-[11.5px] text-gray-400">※ KS C IEC 60364-5-52, KECG 1701-2019.</div>
                </div>

                {/* Source reference */}
                <div className="text-[10px] lg:text-[11.5px] text-gray-400 text-right mt-4">
                    Copyrightⓒ2025 AVALANCHE Version 1.0.1
                </div>

                </div>

                {/* Navigation Bar & Search Overlay */}
                <div className="fixed bottom-0 sm:bottom-6 left-1/2 -translate-x-1/2 z-[80] flex flex-col items-center gap-3 w-full max-w-full sm:max-w-[95vw] lg:max-w-none">
                    {/* Search Bar (Conditional) */}
                    {showSearch && (
                        <div ref={searchContainerRef} className="w-full max-w-md bg-black/80 backdrop-blur-xl border-x border-t sm:border border-white/10 p-2 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="relative flex items-center">
                                <Search size={16} className="absolute left-3 text-blue-400" />
                                <input
                                    ref={searchInputRef}
                                    autoFocus
                                    type="text"
                                    placeholder="Find in Page"
                                    value={searchTerm}
                                    onChange={handleSearch}
                                    onKeyDown={findNextMatch}
                                    className="w-full bg-white/5 border border-white/10 py-2 pl-10 pr-[140px] text-sm text-white focus:outline-none focus:border-blue-500/50 transition-all font-medium"
                                />
                                {searchResults.length > 0 && (
                                    <div className="absolute right-9 flex items-center gap-2 pr-1.5 border-r border-white/10">
                                        <div className="flex items-center gap-0.5">
                                            <button 
                                                onClick={goToPrevMatch}
                                                className="p-1 hover:bg-white/10 rounded transition-colors text-gray-400 hover:text-white"
                                                title="이전 (Up)"
                                            >
                                                <ChevronUp size={14} />
                                            </button>
                                            <button 
                                                onClick={goToNextMatch}
                                                className="p-1 hover:bg-white/10 rounded transition-colors text-gray-400 hover:text-white"
                                                title="다음 (Down)"
                                            >
                                                <ChevronDown size={14} />
                                            </button>
                                        </div>
                                        <div className="text-[10px] bg-blue-600/20 text-blue-400 px-1.5 py-0.5 font-bold">
                                            {currentMatchIndex + 1} / {searchResults.length}
                                        </div>
                                    </div>
                                )}
                                <button
                                    onClick={() => { 
                                        setShowSearch(false); 
                                        setSearchTerm(''); 
                                        clearHighlights();
                                        setSearchResults([]);
                                        setCurrentMatchIndex(-1);
                                    }}
                                    className="absolute right-1.5 p-1 hover:bg-white/10 rounded-full transition-colors"
                                >
                                    <X size={16} className="text-gray-400" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Navigation Container */}
                    <div className="flex items-center p-1.5 bg-black/40 backdrop-blur-xl border-x border-t sm:border border-white/10 shadow-2xl max-w-full overflow-hidden">


                        {/* 1. Fixed Search Button Area */}
                        <div className="flex-shrink-0 pr-2 border-r border-white/10 mr-1.5">
                            <button
                                id="search-toggle-btn"
                                onClick={() => setShowSearch(!showSearch)}
                                className={`flex flex-col items-center justify-center min-w-[56px] lg:min-w-[64px] h-11 lg:h-12 border transition-all duration-300 group
                                    ${showSearch ? 'bg-blue-600/20 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.2)]' : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/20'}`}
                            >
                                <Search size={16} className={`${showSearch ? 'text-blue-400' : 'text-gray-400 group-hover:text-white'} transition-colors mb-0.5`} />
                                <span className={`text-[9px] font-bold uppercase tracking-tight ${showSearch ? 'text-blue-400' : 'text-gray-500 group-hover:text-gray-300'}`}>Search</span>
                            </button>
                        </div>

                        {/* 2. Scrollable Navigation Items */}
                        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                            {SETTING_NAV_ITEMS.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => scrollSettingToSection(item.id, scrollContainerRef)}
                                        className="flex flex-col items-center justify-center min-w-[56px] lg:min-w-[64px] h-11 lg:h-12 bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/20 transition-all duration-300 group relative active:scale-95 flex-shrink-0"
                                    >
                                        <Icon size={16} className={`${item.color} mb-0.5 group-hover:scale-110 transition-transform`} />
                                        <span className="text-[9px] font-bold text-gray-500 group-hover:text-gray-300 uppercase tracking-tight">{item.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Custom Notification Modal */}
                {
                    modal.show && (
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
                                        <h3 className="text-white font-bold mb-2">{modal.title}</h3>
                                        <p className="text-gray-500 text-[12px] mb-4 whitespace-pre-line">
                                            {modal.message}
                                        </p>
                                        <div className="flex gap-2">
                                            {modal.type === 'confirm' || modal.type === 'warning' ? (
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
                                                        className={`flex-1 px-4 py-3 text-xs font-bold uppercase tracking-widest transition-all shadow-lg ${modal.type === 'warning'
                                                            ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-900/20'
                                                            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-900/20'
                                                            }`}
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
                    )
                }
                <MasterNavModal 
                    isOpen={isMasterNavOpen}
                    onClose={() => setIsMasterNavOpen(false)}
                />
            </div>
    );
};

export default SettingPage;

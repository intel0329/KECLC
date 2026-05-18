/**
 * ⚠️ DEVELOPMENT WARNING ⚠️
 * This component is subject to strict architectural rules to ensure scalability.
 * BEFORE MODIFYING: Please read `DEVELOPMENT_GUIDE.md` in the project root.
 * 
 * - Logic must go to `src/utils/feederCalculations.js`
 * - Row rendering should be optimized
 */
import React, { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { usePanelLookup } from '../../hooks/usePanelLookup';
import { useFeederData } from './hooks/useFeederData';
import useDataStore from '../../store/useDataStore';
import { getRemoteData, setRemoteData } from '../../services/projectService';
import { 
    Plus, Minus, Trash2, X, Download, RotateCcw, ExternalLink, 
    ChevronLeft, ChevronRight, Table, FolderOpen, Activity, Shield, Layout, Zap,
    CheckCircle, AlertCircle
} from 'lucide-react';
import { NAV_ITEMS, scrollToSection } from './utils/feederNavi';
import CB_DATA from '../../data/CB.json';

// Derive unique breaker types from CB_DATA
const BREAKER_TYPES = [...new Set(
    CB_DATA.filter(row => row[0] && typeof row[3] === 'number')
        .map(row => row[0])
)].sort();

import FeederRow from './FeederRow';
import ParallelConductorPopup from '../ParallelConductorPopup';
import FeederSkeleton from './FeederSkeleton';
import * as feederChker from './utils/feederChker';
import * as groupingUtil from './utils/feederGrouping';
import { extractLinkedDataFromPanel, calculateFeederValues } from './utils/feederCalculations';

// Reusing style components from PowerLoadContent for consistency
// Helper to normalize phase string
const normalizePhase = (p) => {
    if (!p) return '';
    return String(p).replace(/[-\s]/g, '').replace(/Ø|ø/g, 'Φ').toUpperCase();
};

const CornerBorders = ({ colorClass = "" }) => (
    <>
        <div className={`corner-tl ${colorClass}`} />
        <div className={`corner-tr ${colorClass}`} />
        <div className={`corner-bl ${colorClass}`} />
        <div className={`corner-br ${colorClass}`} />
    </>
);

// 2-line header with Korean description and symbol
const TableHeader2 = ({ label, subLabel, children, rowSpan, colSpan, className = "", id }) => (
    <th
        id={id}
        className={`border border-gray-900 bg-black px-1 py-2 text-center whitespace-nowrap ${className}`}
        rowSpan={rowSpan}
        colSpan={colSpan}
    >
        <div className="flex flex-col items-center justify-center leading-tight">
            <span className="text-[11px] text-gray-500">{label}</span>
            <span className="text-[13px] font-normal text-gray-300">{children || subLabel}</span>
        </div>
    </th>
);

const TableHeader = ({ label, children, rowSpan, colSpan, className = "", id }) => (
    <th
        id={id}
        className={`border border-gray-900 bg-black px-1 py-2 text-[13px] font-normal text-gray-300 text-center whitespace-nowrap ${className}`}
        rowSpan={rowSpan}
        colSpan={colSpan}
    >
        {children || label}
    </th>
);

const HeaderWithChk = ({ label, errorRows, onScroll, className = "", id }) => (
    <th id={id} className={`border border-gray-900 bg-black px-1 py-2 text-[13px] font-normal text-gray-300 text-center whitespace-nowrap min-w-[70px] relative ${className}`}>
        <div className="relative">
            <span dangerouslySetInnerHTML={{ __html: label }}></span>
            {errorRows.length > 0 && (
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 z-[100]">
                    <button
                        onClick={() => onScroll(errorRows[0].id)}
                        title={`Total ${errorRows.length} errors. Click to move to first error.`}
                        className="bg-red-600/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-sm shadow-lg animate-bounce hover:opacity-100 transition-opacity whitespace-nowrap border border-red-500/30 relative"
                    >
                        {errorRows.length > 1 ? `Chk + ${errorRows.length - 1}` : 'Chk'}
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-red-600/70 rotate-45 border-r border-b border-red-500/30"></div>
                    </button>
                </div>
            )}
        </div>
    </th>
);

const Modal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/40"
            onClick={onClose}
        >
            <div
                className="relative bg-black border border-gray-800 w-full max-w-md mx-4 shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <CornerBorders />
                <div className="flex items-center justify-between p-4 border-b border-gray-800">
                    <h3 className="text-sm font-normal text-[#d1d5db] uppercase tracking-widest flex items-center gap-2">
                        <Trash2 size={16} className="text-red-500" />
                        {title}
                    </h3>
                    <button onClick={onClose} className="p-1 text-gray-500 hover:text-white transition-colors">
                        <X size={18} />
                    </button>
                </div>
                <div className="p-6">
                    {children}
                </div>
            </div>
        </div>
    );
};

const DEFAULT_FEEDER_DATA = {
    fromId: '', toId: '', cat: '',
    capacityKva: '', capacityKw: '',
    phase: '', wire: '', voltage: '',
    current: '',
    demandFactor: '', demandKva: '', demandA: '',
    breakerType1: '', breakerType2: '', breakerA: '', breakerAF: '', breakerAT: '', breakerKA: '',
    ib: '', in: '', ibInIz: '', atb: '',
    i2: '', iz145: '', i2Iz: '', atth: '',
    delta: '', ims: '', inIms: '', atms: '',
    k: '', imi: '', inImi: '', atmi: '',
    tn: '', tz: '', tnTz: '', atsc: '',
    in2: '', iz2: '', ibInIz2: '', scbSize: '',
    seEb: '', seL: '', seEv: '', seSize: '',
    sscTn: '', sscIsc: '', sscCalc: '', sscSize: '', sscStatus: '',
    smEb: '', smL: '', smIms: '', smSize: '',
    smsSize: '', smsBeta: '', smsTm: '', vDropInsulation: '',
    vDropEPer: '', vDropEV: '',
    pf: '', eff: '', r: '', x: '',
    dist: '',
    tray: '', air: '', ground: '', buried: '', thermal: '', method: '',
    cableVolt: '', cableIns: '', cableCore: '', cableD: '', cableCond: '', cableLine: '',
    cablePe: '', cableOuterD: '',
    conduitMat: '', conduitNom: '', conduitLine: '', conduitIn: ''
};

const MainCapacityInput = memo(({ value, onSave }) => {
    const [localValue, setLocalValue] = useState(value || '');
    const timerRef = React.useRef(null);

    useEffect(() => {
        setLocalValue(value || '');
    }, [value]);

    const handleChange = (val) => {
        setLocalValue(val);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            onSave(val);
        }, 800);
    };

    const handleBlur = () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        onSave(localValue);
    };

    return (
        <div className="w-[120px] shrink-0">
            <label className="text-[12px] text-gray-400 uppercase tracking-widest block mb-1">Main Capacity</label>
            <input
                value={localValue}
                onChange={(e) => handleChange(e.target.value)}
                onBlur={handleBlur}
                className="bg-transparent text-white font-bold outline-none w-full border-b border-gray-900 focus:border-gray-700 py-1"
            />
        </div>
    );
});

const PanelFeederContent = () => {
    const params = useParams();
    const navigate = useNavigate(); 
    const scrollContainerRef = React.useRef(null);
    const projectId = params.projectId;
    const panelId = params.panelId;

    // [Phase 1] Hydration Gate & Sync Status
    const [isHydrating, setIsHydrating] = useState(true);
    const isLocalChangeRef = useRef(false);
    const lastSavedDataRef = useRef(null);

    const { getNameById, getIdByName, getParentId, getChildrenIds, panels, idToName, isLoaded: lookupLoaded, refresh: refreshPanelLookup, panelParents } = usePanelLookup(projectId);

    // [REMOVED] handleImmediateConnectionSync 및 useConnectionSync 제거 (순수 관찰자 모드 전환)

    // Use custom hook for data management
    const {
        feeders,
        setFeeders,
        projectInfo,
        setProjectInfo,
        hasChanges,
        isDataLoaded,
        isInitialLoading,
        addFeeder,
        removeFeeder,
        updateFeeder,
        reorderFeedersByHierarchy,
        refreshLinkedLoads,
        settingsPF,
        settingsEff,
        settingsI2Type,
        kecSettings,
        mccSettings,
        setIsDataLoaded,
        panels: storePanels,
        results: storeResults
    } = useFeederData(projectId, panelId, getParentId, lookupLoaded, getChildrenIds, idToName, panelParents, panels, isLocalChangeRef);

    
    // [SoT Sync] Reactive Lookup for real-time UI updates (Zero-Sync Architecture)
    const displayFeeders = useMemo(() => {
        if (!feeders || feeders.length === 0) return feeders;

        return feeders.map(f => {
            // 그룹 헤더/푸터 또는 연결 패널이 없는 경우 원본 유지
            if (f.rowType || !f.toId || !f.cat) return f;

            const linkedData = storePanels[f.toId];
            if (!linkedData) return f;

            // [Memory-First] 전역 스토어에서 최신 기술 데이터(용량, 차단기, 전선 등) 실시간 추출
            const overrides = extractLinkedDataFromPanel(linkedData, f.cat, kecSettings, mccSettings);
            
            // 추출된 데이터로 덮어쓰기
            const merged = { ...f, ...overrides };
            
            // 변경된 기초 데이터를 바탕으로 파생 값(전류, 수용부하 등) 재계산
            const calculated = calculateFeederValues(merged, settingsPF, settingsEff, kecSettings);
            
            return { ...merged, ...calculated };
        });
    }, [feeders, storePanels, kecSettings, mccSettings, settingsPF, settingsEff]);

    // SOURCE dropdown state
    const [showSourceDropdown, setShowSourceDropdown] = useState(false);
    const [sourceSelectedIndex, setSourceSelectedIndex] = useState(0);
    const [sourceSearchText, setSourceSearchText] = useState('');
    const sourceDropdownRef = React.useRef(null);
    const [saveStatus, setSaveStatus] = useState('');

    // Selection state for multi-select (Shift+Click)
    const [selectedRows, setSelectedRows] = useState([]); // Array of feeder ids
    const [lastSelectedRow, setLastSelectedRow] = useState(null); // feeder id

    // Drag and drop state
    const [draggedRow, setDraggedRow] = useState(null); // feeder id
    const [dropTarget, setDropTarget] = useState(null); // feeder id

    // Context menu state
    const [contextMenu, setContextMenu] = useState({ show: false, x: 0, y: 0, feederId: null });

    // Parallel Conductor Popup State
    const [isParallelPopupOpen, setIsParallelPopupOpen] = useState(false);
    const [parallelPopupFeederId, setParallelPopupFeederId] = useState(null);

    // Clipboard state
    const [clipboard, setClipboard] = useState({ feeders: [], mode: null }); // mode: 'copy' or 'cut'
    const [isSmseExpanded, setIsSmseExpanded] = useState(false);
    
    // Highlight state for bulk added rows
    const [highlightedFeederIds, setHighlightedFeederIds] = useState(new Set());
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

    const showToast = useCallback((message, type = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
    }, []);


    // 접기 기능 상태 (groupId 세트)
    const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
    const [collapsedGroups, setCollapsedGroups] = useState(new Set());

    const toggleGroupCollapse = (groupId) => {
        setCollapsedGroups(prev => {
            const next = new Set(prev);
            if (next.has(groupId)) next.delete(groupId);
            else next.add(groupId);
            return next;
        });
    };

    const [modal, setModal] = useState({
        show: false,
        title: '',
        message: '',
        type: 'info', // 'info' | 'warning'
        onConfirm: null
    });

    // [REMOVED] Local state for Main Capacity moved to sub-component to fix lag

    const handleScrollToSection = (id) => {
        scrollToSection(id, scrollContainerRef);
    };

    // Global Floating Dropdown State
    const [activeDropdown, setActiveDropdown] = useState({
        show: false,
        x: 0, y: 0, width: 0,
        options: [],
        filteredOptions: [],
        selectedIndex: 0,
        filter: '',
        textAlign: 'left',
        onSelect: null
    });

    const handleDropdownInteract = (e, currentVal, options, onSelect, textAlign = 'left', selectedValue = null) => {
        const rect = e.currentTarget.getBoundingClientRect();

        // Support both string arrays ['a', 'b'] and object arrays [{value, label}]
        const normalizedOptions = options.map(opt =>
            typeof opt === 'string' ? { value: opt, label: opt } : opt
        );

        // Filter by label (display text)
        const filtered = normalizedOptions.filter(opt =>
            opt.label.toLowerCase().includes((currentVal || '').toLowerCase())
        );

        let initialIndex = 0;
        if (selectedValue !== null) {
            initialIndex = filtered.findIndex(opt => opt.value === selectedValue);
            if (initialIndex === -1 && filtered.length > 0) initialIndex = 0;
        }

        setActiveDropdown({
            show: true,
            x: rect.left + window.scrollX,
            y: rect.bottom + window.scrollY,
            width: rect.width,
            options: normalizedOptions,
            filteredOptions: filtered,
            selectedIndex: initialIndex,
            filter: currentVal,
            textAlign: textAlign,
            onSelect: (selected) => {
                // selected is now {value, label} - pass value (ID) to callback
                const val = typeof selected === 'object' ? selected.value : selected;
                onSelect(val);
                setActiveDropdown(prev => ({ ...prev, show: false }));
            }
        });
    };

    // [FIX] Close dropdown on any INTERNAL scroll (like the overflow-auto main table area)
    // Page-level vertical scroll is handled naturally by position:absolute on document body,
    // so it doesn't need to close or re-position there.
    useEffect(() => {
        if (!activeDropdown.show) return;

        const handleScroll = (e) => {
            // If it's the main window scrolling, it's fine (absolute handles it)
            if (e.target === window || e.target === document || e.target.closest('.dropdown-viewport')) return;

            // If it's an internal scroll (like the horizontal/vertical table scroll), close it
            setActiveDropdown(prev => prev.show ? { ...prev, show: false } : prev);
        };

        window.addEventListener('scroll', handleScroll, true);
        return () => window.removeEventListener('scroll', handleScroll, true);
    }, [activeDropdown.show]);

    const handleDropdownKeyDown = (e) => {
        if (!activeDropdown.show) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveDropdown(prev => {
                const len = prev.filteredOptions.length;
                if (len === 0) return prev;
                return { ...prev, selectedIndex: (prev.selectedIndex + 1) % len };
            });
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveDropdown(prev => {
                const len = prev.filteredOptions.length;
                if (len === 0) return prev;
                return { ...prev, selectedIndex: (prev.selectedIndex - 1 + len) % len };
            });
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (activeDropdown.filteredOptions.length > 0) {
                const selected = activeDropdown.filteredOptions[activeDropdown.selectedIndex];
                if (selected) activeDropdown.onSelect(selected);
            }
        } else if (e.key === 'Escape') {
            setActiveDropdown(prev => ({ ...prev, show: false }));
        }
    };



    // Calculate derived values (Current, Demand, etc.) based on inputs


    // --- Row Selection Handlers ---
    const handleRowClick = (feederId, event) => {
        if (event.shiftKey && lastSelectedRow !== null) {
            // Shift+Click: Select range
            const startIdx = feeders.findIndex(f => f.id === lastSelectedRow);
            const endIdx = feeders.findIndex(f => f.id === feederId);
            if (startIdx !== -1 && endIdx !== -1) {
                const [from, to] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
                const rangeIds = feeders.slice(from, to + 1).map(f => f.id);
                setSelectedRows(prev => [...new Set([...prev, ...rangeIds])]);
            }
        } else if (event.ctrlKey || event.metaKey) {
            // Ctrl+Click: Toggle single
            setSelectedRows(prev => prev.includes(feederId) ? prev.filter(id => id !== feederId) : [...prev, feederId]);
        } else {
            // Normal click: Select single
            setSelectedRows([feederId]);
        }
        setLastSelectedRow(feederId);
    };

    // --- Context Menu Handlers ---
    const handleContextMenu = (e, feederId) => {
        e.preventDefault();
        // If row is not in selection, select it
        if (!selectedRows.includes(feederId)) {
            setSelectedRows([feederId]);
            setLastSelectedRow(feederId);
        }
        setContextMenu({ show: true, x: e.clientX, y: e.clientY, feederId });
    };

    const closeContextMenu = () => setContextMenu({ show: false, x: 0, y: 0, feederId: null });

    const handleCopy = () => {
        const feedersToCopy = feeders.filter(f => selectedRows.includes(f.id));
        setClipboard({ feeders: feedersToCopy.map(f => ({ ...f })), mode: 'copy' });
        closeContextMenu();
    };

    const handleCut = () => {
        const feedersToCut = feeders.filter(f => selectedRows.includes(f.id));
        setClipboard({ feeders: feedersToCut.map(f => ({ ...f })), mode: 'cut' });
        setFeeders(feeders.filter(f => !selectedRows.includes(f.id)));
        setSelectedRows([]);
        closeContextMenu();
    };

    const handlePaste = () => {
        if (clipboard.feeders.length === 0) return;

        let targetIdx = -1;
        if (contextMenu.feederId) {
            targetIdx = feeders.findIndex(f => f.id === contextMenu.feederId);
        } else if (lastSelectedRow) {
            targetIdx = feeders.findIndex(f => f.id === lastSelectedRow);
        }

        // Default to end if no valid target found
        if (targetIdx === -1) targetIdx = feeders.length;

        const newFeeders = clipboard.feeders.map(f => ({ ...f, id: Date.now() + Math.random() }));
        const updatedFeeders = [...feeders];

        // OVERWRITE Logic
        for (let i = 0; i < newFeeders.length; i++) {
            if (targetIdx + i < updatedFeeders.length) {
                updatedFeeders[targetIdx + i] = { ...newFeeders[i], id: updatedFeeders[targetIdx + i].id };
            } else {
                updatedFeeders.push(newFeeders[i]);
            }
        }

        if (clipboard.mode === 'cut') {
            const sourceIds = clipboard.feeders.map(f => f.id);
            const finalFeeders = updatedFeeders.filter(f => !sourceIds.includes(f.id));
            setFeeders(finalFeeders);
            setClipboard({ feeders: [], mode: null });
        } else {
            setFeeders(updatedFeeders);
        }

        setHasChanges(true);
        closeContextMenu();
    };

    const handleInsertPaste = () => {
        if (clipboard.feeders.length === 0) return;

        let targetIdx = -1;
        if (contextMenu.feederId) {
            targetIdx = feeders.findIndex(f => f.id === contextMenu.feederId);
        } else if (lastSelectedRow) {
            targetIdx = feeders.findIndex(f => f.id === lastSelectedRow);
        }

        // Default to end if no valid target found
        if (targetIdx === -1) targetIdx = feeders.length;

        const newFeeders = clipboard.feeders.map(f => ({ ...f, id: Date.now() + Math.random() }));
        const updatedFeeders = [...feeders];

        // Insert ABOVE the target (AT targetIdx)
        updatedFeeders.splice(targetIdx, 0, ...newFeeders);

        if (clipboard.mode === 'cut') {
            const sourceIds = clipboard.feeders.map(f => f.id);
            const finalFeeders = updatedFeeders.filter(f => !sourceIds.includes(f.id));
            setFeeders(finalFeeders);
            setClipboard({ feeders: [], mode: null });
        } else {
            setFeeders(updatedFeeders);
        }

        closeContextMenu();
    };

    const handleDeleteSelected = () => {
        const selectedFeeders = feeders.filter(f => selectedRows.includes(f.id));
        if (selectedFeeders.length === 0) {
            closeContextMenu();
            return;
        }

        // "Empty" row criteria: BOTH fromId AND toId must be missing
        const emptyRows = selectedFeeders.filter(f => !f.fromId && !f.toId);
        const nonEmptyRows = selectedFeeders.filter(f => f.fromId || f.toId);

        // 1. Immediately delete empty rows
        if (emptyRows.length > 0 && nonEmptyRows.length === 0) {
            const updated = feeders.filter(f => !emptyRows.map(er => er.id).includes(f.id));
            setFeeders(groupingUtil.cleanEmptyGroups(updated));
            setSelectedRows([]);
            closeContextMenu();
            return;
        }

        // 2. If mixed or only non-empty, handle with modal
        if (nonEmptyRows.length > 0) {
            // If there were empty rows, delete them immediately first
            let currentFeeders = feeders;
            if (emptyRows.length > 0) {
                currentFeeders = feeders.filter(f => !emptyRows.map(er => er.id).includes(f.id));
                setFeeders(currentFeeders);
            }

            setModal({
                show: true,
                title: '항목 삭제',
                message: `선택된 ${nonEmptyRows.length}개의 항목을 삭제하시겠습니까?`,
                type: 'warning',
                onConfirm: () => {
                    // Use closure feeders - calculation done before passing to setFeeders
                    const updated = currentFeeders.filter(f => !nonEmptyRows.map(ner => ner.id).includes(f.id));
                    setFeeders(groupingUtil.cleanEmptyGroups(updated));
                    setSelectedRows([]);
                    setModal(prev => ({ ...prev, show: false }));
                }
            });
        }
        
        closeContextMenu();
    };

    const handleInsertRow = () => {
        // Default to end of list if no specific row context
        const targetIdx = contextMenu.feederId
            ? feeders.findIndex(f => f.id === contextMenu.feederId)
            : feeders.length - 1;

        const newFeeder = {
            ...DEFAULT_FEEDER_DATA,
            id: Date.now()
        };

        const updatedFeeders = [...feeders];
        updatedFeeders.splice(targetIdx + 1, 0, newFeeder);
        setFeeders(updatedFeeders);
        closeContextMenu();
    };

    const handleFindAllTo = (currentFeederId) => {
        // 이미 사용된 TO 패널 ID 집합 (현재 시트 기준)
        const currentUsedToIds = new Set(feeders.map(f => f.toId).filter(id => id));
        
        // 2. 변압기 및 저압 수전 용량 계산서 관련 패널 제외 (Source 타입)
        const missingPanels = lookup.panels.filter(p => 
            !currentUsedToIds.has(p.id) && 
            p.type !== 'transformer' &&
            p.type !== 'low-voltage-receiving'
        );

        if (missingPanels.length === 0) {
            showToast('일괄 등록할 새로운 패널이 없습니다.', 'info');
            return;
        }

        const updatedFeeders = [...feeders];
        const targetIdx = updatedFeeders.findIndex(f => f.id === currentFeederId);
        
        let firstRowUsed = false;
        const newRows = [];

        missingPanels.forEach((panel, idx) => {
            if (!firstRowUsed && targetIdx !== -1 && !updatedFeeders[targetIdx].toId) {
                // 현재 행이 비어있으면 현재 행 채움
                updatedFeeders[targetIdx] = { 
                    ...updatedFeeders[targetIdx], 
                    toId: panel.id,
                    cat: 'L' // 분류 자동 입력
                };
                firstRowUsed = true;
                setHighlightedFeederIds(prev => new Set([...prev, currentFeederId]));
            } else {
                // 나머지는 새로운 행으로 추가
                const newId = Date.now() + idx + Math.random();
                newRows.push({
                    ...DEFAULT_FEEDER_DATA,
                    id: newId,
                    toId: panel.id,
                    cat: 'L' // 분류 자동 입력
                });
                setHighlightedFeederIds(prev => new Set([...prev, newId]));
            }
        });

        if (newRows.length > 0) {
            const insertPos = targetIdx !== -1 ? targetIdx + 1 : updatedFeeders.length;
            updatedFeeders.splice(insertPos, 0, ...newRows);
        }

        setFeeders(updatedFeeders);
        
        showToast(`${missingPanels.length}개의 패널이 일괄 등록되었습니다.`, 'success');
    };

    // --- Drag and Drop Handlers ---
    const handleDragStart = (e, feederId) => {
        setDraggedRow(feederId);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e, feederId) => {
        e.preventDefault();
        if (feederId !== draggedRow) {
            setDropTarget(feederId);
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

        const draggedItems = selectedRows.includes(draggedRow) ? selectedRows : [draggedRow];
        const remainingFeeders = feeders.filter(f => !draggedItems.includes(f.id));
        const draggedFeeders = feeders.filter(f => draggedItems.includes(f.id));
        const targetIdx = remainingFeeders.findIndex(f => f.id === targetId);

        const newFeeders = [
            ...remainingFeeders.slice(0, targetIdx + 1),
            ...draggedFeeders,
            ...remainingFeeders.slice(targetIdx + 1)
        ];
        setFeeders(newFeeders);
        setDraggedRow(null);
        setDropTarget(null);
    };

    const handleDragEnd = () => {
        setDraggedRow(null);
        setDropTarget(null);
    };

    // Close context menu on click outside
    useEffect(() => {
        const handleClickOutside = () => closeContextMenu();
        if (contextMenu.show) {
            document.addEventListener('click', handleClickOutside);
        }
        return () => document.removeEventListener('click', handleClickOutside);
    }, [contextMenu.show]);

    // Background Click Handler to clear selection
    const handleBackgroundClick = (e) => {
        // Only clear if clicking directly on the container or areas not part of a row
        // This is a simple implementation; you might need to check target more carefully
        // But since the rows stop propagation on click (usually), this works for outside clicks
        // However, row click propagation was not stopped in previous implementation
        // Let's modify row click to stop propagation if needed, or check target here.
        // Actually, easiest is to let row click handle selection, and this handles clearing.
        // If bubbling, we need to check if e.target is not a row or inside a row.
        if (!e.target.closest('tr') && !e.target.closest('button')) {
            setSelectedRows([]);
            setLastSelectedRow(null);
        }
    };

    // [Phase 3] Initialization Effect (Blocking Hydration & Memory-First)
    useEffect(() => {
        const load = async () => {
            if (!projectId || !panelId || !lookupLoaded) return;
            
            try {
                // [Step 1] Load Main Panel Data
                const storeState = useDataStore.getState().panels[panelId];
                let loadedInfo = null;
                let loadedFeeders = null;

                if (storeState) {
                    console.log(`[Feeder Hydration] Memory-First Hit: ${panelId}`);
                    loadedInfo = storeState.projectInfo;
                    loadedFeeders = storeState.feeders;
                } else {
                    // Tier 1: LocalStorage Cache
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
                        console.log(`[Feeder Hydration] Local-First: Trusting Local Cache (${cachedData.status})`);
                        finalData = cachedData;
                    } else {
                        // [Tier 2] Remote Data 조회 (Draft -> Origin)
                        const draftKey = `kelc_panel_draft_${panelId}`;
                        const originKey = `kelc_panel_data_${panelId}`;
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
                        loadedFeeders = finalData.feeders;
                    }
                }

                // Push to Store immediately
                if (loadedInfo || loadedFeeders) {
                    useDataStore.getState().syncPanel(panelId, {
                        projectInfo: loadedInfo || {},
                        feeders: loadedFeeders || []
                    });
                }

                // [Step 2] Load Child Panels Data (Blocking Sync)
                const currentFeeders = loadedFeeders || [];
                const childPanelIds = [...new Set(currentFeeders.map(f => f.toId).filter(id => id))];
                
                if (childPanelIds.length > 0) {
                    console.log(`[Feeder Hydration] Pre-fetching ${childPanelIds.length} linked panels...`);
                    
                    await Promise.allSettled(childPanelIds.map(async (cId) => {
                        // Skip if already in memory (Memory-First)
                        if (useDataStore.getState().panels[cId]) return;

                        const cDraftKey = `kelc_panel_draft_${cId}`;
                        const cDraft = await getRemoteData(cDraftKey, projectId);
                        
                        if (cDraft) {
                            useDataStore.getState().syncPanel(cId, cDraft);
                        } else {
                            const cOriginKey = `kelc_panel_data_${cId}`;
                            const cOrigin = await getRemoteData(cOriginKey, projectId);
                            if (cOrigin) useDataStore.getState().syncPanel(cId, cOrigin);
                        }
                    }));
                }

                setIsDataLoaded(true);
                setTimeout(() => {
                    setIsHydrating(false);
                }, 800);

            } catch (error) {
                console.error('[Feeder Hydration] Critical Error:', error);
                setIsDataLoaded(true);
                setIsHydrating(false);
            }
        };

        load();
    }, [projectId, panelId, lookupLoaded, setIsDataLoaded]);

    // [Phase 3] Reactive Recalculation Listener
    // 다른 패널(을지)의 데이터가 변경될 때마다 간선 데이터를 최신화합니다.
    const [isCalculating, startTransition] = React.useTransition();
    useEffect(() => {
        if (isHydrating || !isDataLoaded) return;

        // linkedLoads에 대한 구독
        const unsubscribe = useDataStore.subscribe(
            (state) => state.panels,
            (newPanels, prevPanels) => {
                // 현재 간선 계산서에 등록된 모든 ToId 패널들의 변경 감지
                const linkedIds = feeders.map(f => f.toId).filter(id => id);
                let hasChange = false;
                
                for (const id of linkedIds) {
                    if (newPanels[id] !== prevPanels[id]) {
                        hasChange = true;
                        break;
                    }
                }

                if (hasChange) {
                    startTransition(() => {
                        refreshLinkedLoads();
                    });
                }
            }
        );

        return () => unsubscribe();
    }, [isHydrating, isDataLoaded, feeders, refreshLinkedLoads]);

    // Sync with global header
    useEffect(() => {
        if (projectInfo && projectId && isDataLoaded) {
            localStorage.setItem('kelc_project_info', JSON.stringify({
                projectId,
                projectName: projectInfo.name || projectInfo.projectName, // Fallback to handle both cases
                panelId,
                panelName: projectInfo.panelName
            }));
            // Dispatch event to update Header immediately
            window.dispatchEvent(new Event('kelc_project_info_updated'));
        }
    }, [projectId, panelId, projectInfo, isDataLoaded]);

    // Remove highlighting on any click
    useEffect(() => {
        const handleClearHighlight = () => {
            if (highlightedFeederIds.size > 0) {
                setHighlightedFeederIds(new Set());
            }
        };
        window.addEventListener('mousedown', handleClearHighlight);
        return () => window.removeEventListener('mousedown', handleClearHighlight);
    }, [highlightedFeederIds]);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA';
            const isControlKey = e.ctrlKey || e.metaKey;

            if (isInput) {
                // Determine if it's a row shortcut we want to allow even when in input
                const isRowShortcut = isControlKey && ['c', 'v', 'x'].includes(e.key.toLowerCase());

                if (isRowShortcut) {
                    // Check if user is NOT selecting text within the input. 
                    // If no text is selected, we assume they mean row operations.
                    if (e.target.selectionStart !== e.target.selectionEnd) {
                        return;
                    }
                } else {
                    return;
                }
            }

            if (selectedRows.length === 0 && !(isControlKey && e.key.toLowerCase() === 'v')) return;

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
                e.preventDefault();
                const feedersToCopy = feeders.filter(f => selectedRows.includes(f.id));
                setClipboard({ feeders: feedersToCopy.map(f => ({ ...f })), mode: 'copy' });
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') {
                e.preventDefault();
                const feedersToCut = feeders.filter(f => selectedRows.includes(f.id));
                setClipboard({ feeders: feedersToCut.map(f => ({ ...f })), mode: 'cut' });
                setFeeders(feeders.filter(f => !selectedRows.includes(f.id)));
                setSelectedRows([]);
                setHasChanges(true);
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
                e.preventDefault();
                if (clipboard.feeders.length === 0) return;

                let targetIdx = lastSelectedRow ? feeders.findIndex(f => f.id === lastSelectedRow) : feeders.length;
                if (targetIdx === -1) targetIdx = feeders.length;

                const newFeeders = clipboard.feeders.map(f => ({ ...f, id: Date.now() + Math.random() }));
                const updatedFeeders = [...feeders];

                // Standard OVERWRITE behavior for Ctrl+V
                for (let i = 0; i < newFeeders.length; i++) {
                    if (targetIdx + i < updatedFeeders.length) {
                        updatedFeeders[targetIdx + i] = { ...newFeeders[i], id: updatedFeeders[targetIdx + i].id };
                    } else {
                        updatedFeeders.push(newFeeders[i]);
                    }
                }

                if (clipboard.mode === 'cut') {
                    const sourceIds = clipboard.feeders.map(f => f.id);
                    const finalFeeders = updatedFeeders.filter(f => !sourceIds.includes(f.id));
                    setFeeders(finalFeeders);
                    setClipboard({ feeders: [], mode: null });
                } else {
                    setFeeders(updatedFeeders);
                }
                setHasChanges(true);
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                handleDeleteSelected();
            } else if (e.key === 'Enter' && modal.show && modal.onConfirm) {
                e.preventDefault();
                modal.onConfirm();
            } else if (e.key === 'Escape' && modal.show) {
                e.preventDefault();
                setModal(prev => ({ ...prev, show: false }));
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [selectedRows, feeders, clipboard, lastSelectedRow, modal]);



    // Context Menu Component
    const ContextMenuComponent = () => {
        if (!contextMenu.show) return null;

        // Find the panel ID and name for the 'Open' functionality (specifically for the 'TO' destination)
        const targetFeeder = feeders.find(f => f.id === contextMenu.feederId);
        const destinationPanelId = targetFeeder?.toId;
        const destinationPanel = destinationPanelId ? panels.find(p => p.id === destinationPanelId) : null;
        const destinationName = destinationPanel?.name || '';

        const handleOpenDestination = () => {
            if (!destinationPanel) return;
            const type = destinationPanel.type;
            const id = destinationPanel.id;

            // Map types to their respective routes
            const routeMap = {
                'panel-load': `/project/${projectId}/panel-load/${id}`,
                'power-load': `/project/${projectId}/power-load/${id}`,
                'panel-feeder': `/project/${projectId}/panel-feeder/${id}`,
                'transformer': `/project/${projectId}/transformer/${id}`,
                'generator': `/project/${projectId}/generator/${id}`,
                'ups': `/project/${projectId}/ups/${id}`,
                'tray': `/project/${projectId}/tray/${id}`
            };

            const route = routeMap[type];
            if (route) {
                navigate(route);
            }
            closeContextMenu();
        };

        const selectedFeeders = feeders.filter(f => selectedRows.includes(f.id));
        const isAnyAlreadyGrouped = selectedFeeders.some(f => f.groupId);

        const handleSystemGrouping = () => {
            const validation = groupingUtil.validateGrouping(selectedFeeders, getNameById);

            if (!validation.isValid) {
                showToast(validation.error, 'error');
                closeContextMenu();
                return;
            }

            const updatedFeeders = groupingUtil.applyGrouping(feeders, selectedRows, validation.fromName);
            setFeeders(updatedFeeders);
            setSelectedRows([]);
            closeContextMenu();

            showToast(`'${validation.fromName}' 시스템 그룹화가 완료되었습니다.`, 'success');
        };

        const handleUngroup = () => {
            if (!targetFeeder || !targetFeeder.groupId) return;
            const updatedFeeders = groupingUtil.ungroupSystem(feeders, targetFeeder.groupId);
            setFeeders(updatedFeeders);
            closeContextMenu();
        };

        const menuRef = React.useRef(null);
        React.useLayoutEffect(() => {
            if (menuRef.current && contextMenu.show) {
                const rect = menuRef.current.getBoundingClientRect();
                const { innerWidth: windowWidth, innerHeight: windowHeight } = window;
                
                let newTop = contextMenu.y;
                let newLeft = contextMenu.x;

                // Vertical overflow check
                if (contextMenu.y + rect.height > windowHeight) {
                    newTop = Math.max(0, contextMenu.y - rect.height);
                }

                // Horizontal overflow check
                if (contextMenu.x + rect.width > windowWidth) {
                    newLeft = Math.max(0, contextMenu.x - rect.width);
                }

                menuRef.current.style.top = `${newTop}px`;
                menuRef.current.style.left = `${newLeft}px`;
                menuRef.current.style.visibility = 'visible';
            }
        }, [contextMenu.show, contextMenu.x, contextMenu.y]);

        return (
            <>
                <div
                    className="fixed inset-0 z-[999]"
                    onClick={closeContextMenu}
                    onContextMenu={(e) => { e.preventDefault(); closeContextMenu(); }}
                />
                <div
                    ref={menuRef}
                    className="fixed z-[1000] bg-gray-950 border border-gray-800 shadow-xl min-w-[200px] py-1"
                    style={{ 
                        left: contextMenu.x, 
                        top: contextMenu.y,
                        visibility: contextMenu.show ? 'hidden' : 'visible' // Hide initially to prevent jump
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <CornerBorders />

                    {destinationPanel && (
                        <>
                            <button
                                onClick={handleOpenDestination}
                                className="w-full px-4 py-2 text-left text-[11px] text-blue-400 hover:bg-blue-500/20 hover:text-white flex items-center gap-3 transition-colors font-bold"
                            >
                                <ExternalLink size={14} />
                                Open {destinationName}
                            </button>
                            <div className="border-t border-gray-800 my-1"></div>
                        </>
                    )}

                    {!isAnyAlreadyGrouped && (
                        <button
                            onClick={handleSystemGrouping}
                            disabled={selectedRows.length < 1}
                            className={`w-full px-4 py-2 text-left text-[11px] flex items-center gap-3 transition-colors ${selectedRows.length >= 1 ? 'text-blue-400 hover:bg-blue-500/20 hover:text-white font-bold' : 'text-gray-700 cursor-not-allowed'}`}
                        >
                            <Table size={14} className={selectedRows.length >= 1 ? 'text-blue-500' : 'text-gray-700'} />
                            System grouping
                        </button>
                    )}

                    {targetFeeder?.groupId && (
                        <button
                            onClick={handleUngroup}
                            className="w-full px-4 py-2 text-left text-[11px] text-orange-400 hover:bg-orange-500/20 hover:text-white flex items-center gap-3 transition-colors"
                        >
                            <X size={14} className="text-orange-500" />
                            Ungroup system
                        </button>
                    )}

                    <div className="border-t border-gray-800 my-1"></div>

                    <button
                        onClick={handleInsertRow}
                        className="w-full px-4 py-2 text-left text-[11px] text-gray-300 hover:bg-blue-500/20 hover:text-white flex items-center gap-3 transition-colors"
                    >
                        <Plus size={14} className="text-green-500" />
                        Add an circuit
                    </button>
                    <div className="border-t border-gray-800 my-1"></div>
                    <button
                        onClick={handleCopy}
                        className="w-full px-4 py-2 text-left text-[11px] text-gray-300 hover:bg-blue-500/20 hover:text-white flex items-center gap-3 transition-colors"
                    >
                        <span className="text-gray-600 w-4 flex justify-center"><Download size={12} className="rotate-180" /></span>
                        Copy
                        <span className="ml-auto text-gray-600 text-[10px]">Ctrl+C</span>
                    </button>
                    <button
                        onClick={handleCut}
                        className="w-full px-4 py-2 text-left text-[11px] text-gray-300 hover:bg-blue-500/20 hover:text-white flex items-center gap-3 transition-colors"
                    >
                        <span className="text-gray-600 w-4 flex justify-center"><X size={12} /></span>
                        Cut
                        <span className="ml-auto text-gray-600 text-[10px]">Ctrl+X</span>
                    </button>
                    <div className="border-t border-gray-800 my-1"></div>
                    <button
                        onClick={handlePaste}
                        disabled={clipboard.feeders.length === 0}
                        className={`w-full px-4 py-2 text-left text-[11px] flex items-center gap-3 transition-colors ${clipboard.feeders.length > 0
                            ? 'text-gray-300 hover:bg-blue-500/20 hover:text-white'
                            : 'text-gray-700 cursor-not-allowed'
                            }`}
                    >
                        <span className="text-gray-600 w-4 flex justify-center"><Download size={12} /></span>
                        Paste (Overwrite)
                        <span className="ml-auto text-gray-600 text-[10px]">Ctrl+V</span>
                    </button>
                    <button
                        onClick={handleInsertPaste}
                        disabled={clipboard.feeders.length === 0}
                        className={`w-full px-4 py-2 text-left text-[11px] flex items-center gap-3 transition-colors ${clipboard.feeders.length > 0
                            ? 'text-gray-300 hover:bg-blue-500/20 hover:text-white'
                            : 'text-gray-700 cursor-not-allowed'
                            }`}
                    >
                        <Plus size={14} className="text-blue-500" />
                        Insert and Paste (Above)
                    </button>
                    <div className="border-t border-gray-800 my-1"></div>
                    <button
                        onClick={handleDeleteSelected}
                        className="w-full px-4 py-2 text-left text-[11px] text-red-400 hover:bg-red-500/20 hover:text-red-300 flex items-center gap-3 transition-colors"
                    >
                        <Trash2 size={14} />
                        Delete ({selectedRows.length})
                        <span className="ml-auto text-gray-600 text-[10px]">Del</span>
                    </button>
                    <div className="border-t border-gray-800 my-1" />
                    <div className="px-4 py-2 text-[9px] text-gray-600">
                        {selectedRows.length > 0
                            ? `${selectedRows.length} row(s) selected`
                            : 'Right-click to select'
                        }
                    </div>
                </div>
            </>
        );
    };

    const isDuplicateToId = useCallback((panelId) => {
        if (!panelId) return false;
        return feeders.filter(f => f.toId === panelId).length > 1;
    }, [feeders]);

    // Memoize handlers to prevent unnecessary re-renders of FeederRow
    const rowHandlers = useMemo(() => ({
        onRowClick: handleRowClick,
        onContextMenu: handleContextMenu,
        onDragStart: handleDragStart,
        onDragOver: handleDragOver,
        onDragLeave: handleDragLeave,
        onDrop: handleDrop,
        onDragEnd: handleDragEnd,
        updateFeeder: (id, field, value) => {
            if (field === 'method' && value === 'X') {
                setParallelPopupFeederId(id);
                setIsParallelPopupOpen(true);
            } else {
                updateFeeder(id, field, value);
            }
        },
        handleDropdownInteract: handleDropdownInteract,
        handleDropdownKeyDown: handleDropdownKeyDown,
        isDuplicateToId: isDuplicateToId,
        isMaterialMethodValid: feederChker.isMaterialMethodValid,
        handleFindAllTo: handleFindAllTo // 수용가 일괄 찾기 핸들러 추가
    }), [
        handleRowClick, handleContextMenu, handleDragStart, handleDragOver, 
        handleDragLeave, handleDrop, handleDragEnd, updateFeeder, 
        handleDropdownInteract, handleDropdownKeyDown, 
        isDuplicateToId, handleFindAllTo
    ]);

    const usedFromIds = useMemo(() => feeders.map(f => f.fromId).filter(id => !!id), [feeders]);
    const usedToIds = useMemo(() => feeders.map(f => f.toId).filter(id => !!id), [feeders]);

    const lookup = useMemo(() => ({ getNameById, getIdByName, panels }), [getNameById, getIdByName, panels]);
    
    const combinedHandlers = useMemo(() => ({
        ...rowHandlers,
        toggleGroupCollapse,
        isDuplicateToId // Ensure this is included
    }), [rowHandlers, toggleGroupCollapse, isDuplicateToId]);

    const handleParallelApply = (combinedMethod) => {
        if (!parallelPopupFeederId) return;

        setFeeders(prev => prev.map(f => {
            if (f.id === parallelPopupFeederId) {
                return { ...f, method: combinedMethod };
            }
            return f;
        }));

        setIsParallelPopupOpen(false);
        setParallelPopupFeederId(null);
    };

    const parallelTargetFeeder = useMemo(() => {
        if (!parallelPopupFeederId) return null;
        return feeders.find(f => f.id === parallelPopupFeederId);
    }, [parallelPopupFeederId, feeders]);

    const scrollToRow = (feederId) => {
        const element = document.getElementById(`feeder-row-${feederId}`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Brief highlight for visibility
            element.classList.add('bg-red-500/20');
            setTimeout(() => {
                element.classList.remove('bg-red-500/20');
            }, 2000);
        }
    };

    const sectionErrors = useMemo(() => {
        return {
            ATB: displayFeeders.filter(f => feederChker.hasSectionError(f, 'ATB', kecSettings)),
            ATTH: displayFeeders.filter(f => feederChker.hasSectionError(f, 'ATTH', kecSettings)),
            ATMS: displayFeeders.filter(f => feederChker.hasSectionError(f, 'ATMS', kecSettings)),
            ATMI: displayFeeders.filter(f => feederChker.hasSectionError(f, 'ATMI', kecSettings)),
            ATSC: displayFeeders.filter(f => feederChker.hasSectionError(f, 'ATSC', kecSettings)),
            SCB: displayFeeders.filter(f => feederChker.hasSectionError(f, 'SCB', kecSettings)),
            SE: displayFeeders.filter(f => feederChker.hasSectionError(f, 'SE', kecSettings)),
            VDROP: displayFeeders.filter(f => feederChker.hasSectionError(f, 'VDROP', kecSettings)), // 전압강하 섹션 추가
            METHOD: displayFeeders.filter(f => feederChker.hasSectionError(f, 'METHOD', kecSettings)),
            CABLE_COND: displayFeeders.filter(f => feederChker.hasSectionError(f, 'CABLE_COND', kecSettings)),
            CONDUIT_MAT: displayFeeders.filter(f => feederChker.hasSectionError(f, 'CONDUIT_MAT', kecSettings) || feederChker.hasSectionError(f, 'CONDUIT_MAT_EMPTY', kecSettings)), // 정합성 + 누락 체크 통합
            CONDUIT_NOM: displayFeeders.filter(f => feederChker.hasSectionError(f, 'CONDUIT_NOM', kecSettings)), // 호칭 섹션 추가
            SSC: displayFeeders.filter(f => feederChker.hasSectionError(f, 'SSC', kecSettings)),
            SMSE: displayFeeders.filter(f => feederChker.hasSectionError(f, 'SMSE', kecSettings)),
            SMSTH: displayFeeders.filter(f => feederChker.hasSectionError(f, 'SMSTH', kecSettings))
        };
    }, [displayFeeders, kecSettings]);

    const hasAnyFail = useMemo(() => {
        return displayFeeders.some(f => feederChker.getRowStatus(f, kecSettings) === 'FAIL');
    }, [displayFeeders, kecSettings]);

    // [NEW] Skeleton Loading Guard (Placed after all hooks to follow Rules of Hooks)
    if (isInitialLoading || !isDataLoaded) {
        return (
            <div className="flex flex-col h-full bg-black overflow-hidden">
                <div className="flex-grow overflow-auto scrollbar-hide">
                    <FeederSkeleton />
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-black text-gray-300 p-2 sm:p-4 lg:p-6 overflow-hidden selection:bg-lime-500/30" onClick={handleBackgroundClick}>
            {/* Delete Confirmation Modal */}
            {modal.show && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[2000]" onClick={() => setModal({ ...modal, show: false })}>
                    <div className="border border-gray-900 bg-black p-6 max-w-md w-full mx-4 relative" onClick={e => e.stopPropagation()}>
                        <CornerBorders />
                        <div className="flex items-start gap-4">
                            <div className={`w-12 h-12 flex items-center justify-center flex-shrink-0 ${modal.type === 'warning' ? 'bg-red-500/20' : 'bg-blue-500/20'}`}>
                                {modal.type === 'warning' ? (
                                    <Trash2 className="text-red-500" size={24} />
                                ) : (
                                    <Save className="text-blue-500" size={24} />
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
            <div className="max-w-[1920px] mx-auto w-full h-full flex flex-col">
                {/* Toast Notification - Unified Premium Style */}
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
                {/* Project Info Bar */}
                <div className="grid grid-cols-12 gap-4 mb-8 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <div className="col-span-12 lg:col-span-5 border-2 border-gray-900 bg-black p-4 relative">
                        <CornerBorders colorClass="border-blue-500/50" />
                        <div className="grid grid-cols-2 md:grid-cols-12 gap-2 md:gap-4">
                            <div className="col-span-2 md:col-span-6 order-1">
                                <label className="text-[12px] text-gray-400 uppercase tracking-widest block mb-1">Project</label>
                                <div className="bg-transparent text-white font-bold outline-none w-full border-b border-gray-900 focus:border-gray-700 cursor-default truncate h-[25px] leading-[25px]" title={projectInfo.name || ''}>
                                    {projectInfo.name || ''}
                                </div>
                            </div>
                            <div className="col-span-2 md:col-span-6 order-2">
                                <label className="text-[12px] text-gray-400 uppercase tracking-widest block mb-1">TITLE</label>
                                <input
                                    value="분전반 전력 간선 및 전압강하 계산서"
                                    readOnly
                                    className="bg-transparent text-white font-bold outline-none w-full border-b border-gray-900 focus:border-gray-700 cursor-default"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="col-span-12 lg:col-span-7 border-2 border-gray-900 bg-black p-4 relative flex flex-col justify-center">
                        <CornerBorders colorClass="border-blue-500/50" />
                        <div className="flex items-start gap-8">
                            <div className="flex gap-4 text-center">
                                <div>
                                    <label className="text-[12px] text-gray-400 uppercase tracking-widest block mb-1">Phase</label>
                                    <select
                                        value={projectInfo.phase || ''}
                                        onChange={(e) => {
                                            const newPhase = e.target.value;
                                            const cleanPhase = normalizePhase(newPhase);
                                            let newVoltage = '380V';
                                            if (cleanPhase.includes('1Φ2W')) newVoltage = '220V';
                                            else if (cleanPhase.includes('3Φ3W')) newVoltage = '380V';
                                            else if (cleanPhase.includes('3Φ4W')) newVoltage = '22.9kV';
                                            setProjectInfo({ phase: newPhase, voltage: newVoltage });
                                        }}
                                        className="bg-transparent border-none text-yellow-400 font-bold py-1 outline-none cursor-pointer appearance-none text-center w-fit mx-auto block min-w-[80px]"
                                        style={{ textAlignLast: 'center' }}
                                    >
                                        <option value="1Φ-2W" className="bg-black">1Φ-2W</option>
                                        <option value="3Φ-3W" className="bg-black">3Φ-3W</option>
                                        <option value="3Φ-4W" className="bg-black">3Φ-4W</option>
                                        {/* Legacy support for non-hyphenated formats in value matching */}
                                        <option value="1Φ2W" className="hidden">1Φ2W</option>
                                        <option value="3Φ3W" className="hidden">3Φ3W</option>
                                        <option value="3Φ4W" className="hidden">3Φ4W</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[12px] text-gray-400 uppercase tracking-widest block mb-1">Voltage</label>
                                    <select
                                        value={projectInfo.voltage || ''}
                                        onChange={(e) => setProjectInfo({ voltage: e.target.value })}
                                        className="bg-transparent border-none text-yellow-400 font-bold py-1 outline-none cursor-pointer appearance-none text-center w-fit mx-auto block min-w-[80px]"
                                        style={{ textAlignLast: 'center' }}
                                    >
                                        {normalizePhase(projectInfo.phase).includes('1Φ2W') && (
                                            <option value="220V" className="bg-black text-yellow-400">220V</option>
                                        )}
                                        {normalizePhase(projectInfo.phase).includes('3Φ3W') && (
                                            <>
                                                <option value="380V" className="bg-black text-yellow-400">380V</option>
                                                <option value="22.9kV" className="bg-black text-yellow-400">22.9kV</option>
                                            </>
                                        )}
                                        {normalizePhase(projectInfo.phase).includes('3Φ4W') && (
                                            <>
                                                <option value="22.9kV" className="bg-black text-yellow-400">22.9kV</option>
                                                <option value="380V" className="bg-black text-yellow-400">380V</option>
                                                <option value="220V" className="bg-black text-yellow-400">220V</option>
                                            </>
                                        )}
                                    </select>
                                </div>
                            </div>
                            <MainCapacityInput 
                                value={projectInfo.mainCapacity} 
                                onSave={(val) => setProjectInfo({ mainCapacity: val })} 
                            />
                        </div>
                    </div>
                </div>

                {/* Main Table Area */}
                <div className="flex-grow relative border border-gray-800 overflow-hidden">
                    <CornerBorders colorClass="border-blue-500/50" />
                    <div
                        ref={scrollContainerRef}
                        className="w-full h-full overflow-auto scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent pb-16"
                    >
                        <table className="w-full border-collapse">
                            <thead className="sticky top-0 z-10 shadow-lg shadow-black/50">
                                {/* Header Row 1 */}
                                <tr>
                                    <TableHeader rowSpan={2} className="w-[50px]" id="sec-no">No</TableHeader>
                                    <TableHeader2 label="Source" subLabel="FROM" rowSpan={2} className="min-w-[120px]" id="sec-route" />
                                    <TableHeader2 label="Destination" subLabel="TO" rowSpan={2} className="min-w-[120px]" />
                                    <TableHeader colSpan={3} id="sec-load" className="navi-target-sec-load">부하용량 (Load Capacity)</TableHeader>
                                    <TableHeader2 label="상" subLabel="Phase" rowSpan={2} className="min-w-[60px] navi-target-sec-load" />
                                    <TableHeader2 label="전압" subLabel="[V]" rowSpan={2} className="min-w-[70px] navi-target-sec-load" />
                                    <TableHeader2 label="전류" subLabel="[A]" rowSpan={2} className="min-w-[80px] navi-target-sec-load" />

                                    <TableHeader colSpan={2} className="border-l-2 border-l-blue-900/50" id="sec-vdrop">전압강하 (V-Drop)</TableHeader>
                                    <TableHeader colSpan={3} className="border-l-2 border-l-blue-900/50" id="sec-demand">수용률 (Demand)</TableHeader>
                                    <TableHeader colSpan={5} className="border-l-2 border-l-blue-900/50" id="sec-breaker">차단기 선정 (Breaker)</TableHeader>
                                    <TableHeader colSpan={4} className="border-l-2 border-l-blue-900/50" id="sec-overcurrent">AT<sub>B</sub></TableHeader>
                                    <TableHeader colSpan={4} className="border-l-2 border-l-blue-900/50 navi-target-sec-overcurrent">AT<sub>TH</sub></TableHeader>
                                    <TableHeader colSpan={4} className="border-l-2 border-l-blue-900/50 navi-target-sec-overcurrent">AT<sub>SC</sub></TableHeader>
                                    <TableHeader colSpan={4} className="border-l-2 border-l-blue-900/50 navi-target-sec-overcurrent">AT<sub>MS</sub></TableHeader>
                                    <TableHeader colSpan={4} className="border-l-2 border-l-blue-900/50 navi-target-sec-overcurrent">AT<sub>MI</sub></TableHeader>

                                    <TableHeader colSpan={4} className="border-l-2 border-l-blue-900/50" id="sec-conductor">S<sub>CB</sub></TableHeader>
                                    <TableHeader colSpan={4} className="border-l-2 border-l-blue-900/50 navi-target-sec-conductor">S<sub>e%</sub></TableHeader>
                                    <TableHeader colSpan={4} className="border-l-2 border-l-blue-900/50 navi-target-sec-conductor">S<sub>SC</sub></TableHeader>
                                    <TableHeader colSpan={isSmseExpanded ? 5 : 4} className="border-l-2 border-l-blue-900/50 navi-target-sec-conductor">S<sub>MSE%</sub></TableHeader>
                                    <TableHeader colSpan={4} className="border-l-2 border-l-blue-900/50 navi-target-sec-conductor">S<sub>MSTh</sub></TableHeader>

                                    <TableHeader2 label="역률" subLabel="cosθ" rowSpan={2} className="min-w-[70px] border-l-2 border-l-blue-900/50" id="sec-pf" />
                                    <TableHeader2 label="효율" subLabel="η" rowSpan={2} className="min-w-[70px] navi-target-sec-pf" />
                                    <TableHeader colSpan={2} className="border-l-2 border-l-blue-900/50 navi-target-sec-pf">임피던스</TableHeader>

                                    <TableHeader className="min-w-[70px] border-l-2 border-l-blue-900/50" id="sec-env">거리</TableHeader>
                                    <TableHeader className="min-w-[70px] navi-target-sec-env">TRAY</TableHeader>
                                    <TableHeader className="min-w-[70px] navi-target-sec-env">기중</TableHeader>
                                    <TableHeader className="min-w-[70px] navi-target-sec-env">지중</TableHeader>
                                    <TableHeader className="min-w-[70px] navi-target-sec-env">매설</TableHeader>
                                    <TableHeader className="min-w-[70px] navi-target-sec-env">열저항률</TableHeader>
                                    <TableHeader className="min-w-[70px] navi-target-sec-env">공사</TableHeader>

                                    <TableHeader colSpan={7} className="border-l-2 border-l-blue-900/50" id="sec-cable">CABLE SELECT</TableHeader>
                                    <TableHeader colSpan={3} className="min-w-[210px] border-l-2 border-l-blue-900/50 navi-target-sec-cable" id="sec-pe">PE (F-GV)</TableHeader>
                                    <TableHeader colSpan={5} className="border-l-2 border-l-blue-900/50" id="sec-conduit">CONDUIT SELECT</TableHeader>
                                    <TableHeader colSpan={1} className="border-l-2 border-l-blue-900/50" id="sec-review">검토</TableHeader>
                                </tr>
                                {/* Header Row 2 */}
                                <tr className="border-b-[3px] border-gray-600">
                                    <TableHeader2 label="분류" subLabel="Cat." className="min-w-[50px] border-l-2 border-l-blue-900/50 navi-target-sec-load" />
                                    <TableHeader2 label="Apparent" subLabel="[kVA]" className="min-w-[80px] navi-target-sec-load" />
                                    <TableHeader2 label="Effective" subLabel="[kW]" className="min-w-[80px] navi-target-sec-load" />

                                    <TableHeader className="min-w-[70px] border-l-2 border-l-blue-900/50">e[V]</TableHeader>
                                    <HeaderWithChk label="e[%]" errorRows={sectionErrors.VDROP} onScroll={scrollToRow} />

                                    <TableHeader className="min-w-[60px] border-l-2 border-l-blue-900/50">[%]</TableHeader>
                                    <TableHeader className="min-w-[80px]">[kVA]</TableHeader>
                                    <TableHeader className="min-w-[80px]">[A]</TableHeader>

                                    <TableHeader className="min-w-[80px] border-l-2 border-l-blue-900/50">TYPE</TableHeader>
                                    <TableHeader className="min-w-[80px]">CB</TableHeader>
                                    <TableHeader2 label="Frame" subLabel="[AF]" className="min-w-[70px]" />
                                    <TableHeader2 label="Trip" subLabel="[AT]" className="min-w-[70px]" />
                                    <TableHeader2 label="Icu" subLabel="[KA]" className="min-w-[70px]" />

                                    <TableHeader className="border-l-2 border-l-blue-900/50 min-w-[70px]">I<sub>B</sub></TableHeader>
                                    <TableHeader className="min-w-[70px]">I<sub>N</sub></TableHeader>
                                    <TableHeader className="text-[10px] min-w-[70px]">I<sub>B</sub> &lt; I<sub>N</sub> &lt; I<sub>Z</sub></TableHeader>
                                    <HeaderWithChk label="AT<sub>B</sub>" errorRows={sectionErrors.ATB} onScroll={scrollToRow} />

                                    <TableHeader className="border-l-2 border-l-blue-900/50 min-w-[70px]">I<sub>2</sub></TableHeader>
                                    <TableHeader className="min-w-[70px]">1.45 I<sub>Z</sub></TableHeader>
                                    <TableHeader className="text-[10px] min-w-[70px]">I<sub>2</sub> &lt; 1.45 I<sub>Z</sub></TableHeader>
                                    <HeaderWithChk label="AT<sub>TH</sub>" errorRows={sectionErrors.ATTH} onScroll={scrollToRow} />

                                    <TableHeader className="border-l-2 border-l-blue-900/50 min-w-[70px]">t<sub>n</sub></TableHeader>
                                    <TableHeader className="min-w-[70px]">t<sub>z</sub></TableHeader>
                                    <TableHeader className="text-[10px] min-w-[70px]">t<sub>n</sub> &lt; t<sub>z</sub></TableHeader>
                                    <HeaderWithChk label="AT<sub>SC</sub>" errorRows={sectionErrors.ATSC} onScroll={scrollToRow} />

                                    <TableHeader className="border-l-2 border-l-blue-900/50 min-w-[70px]">δ</TableHeader>
                                    <TableHeader className="min-w-[70px]">I<sub>MS</sub></TableHeader>
                                    <TableHeader className="text-[10px] min-w-[70px]">I<sub>N</sub> ≥ I<sub>MS</sub> / δ</TableHeader>
                                    <HeaderWithChk label="AT<sub>MS</sub>" errorRows={sectionErrors.ATMS} onScroll={scrollToRow} />

                                    <TableHeader className="border-l-2 border-l-blue-900/50 min-w-[70px]">δ₂</TableHeader>
                                    <TableHeader className="min-w-[70px]">I<sub>MI</sub></TableHeader>
                                    <TableHeader className="text-[10px] min-w-[70px]">I<sub>N</sub> ≥ I<sub>MI</sub> / δ₂</TableHeader>
                                    <HeaderWithChk label="AT<sub>MI</sub>" errorRows={sectionErrors.ATMI} onScroll={scrollToRow} />

                                    <TableHeader className="border-l-2 border-l-blue-900/50 min-w-[70px]">I<sub>N</sub></TableHeader>
                                    <TableHeader className="min-w-[70px]">I<sub>Z</sub></TableHeader>
                                    <TableHeader className="text-[10px] min-w-[70px]">I<sub>B</sub> &lt; I<sub>N</sub> &lt; I<sub>Z</sub></TableHeader>
                                    <HeaderWithChk label="[mm²]" errorRows={sectionErrors.SCB} onScroll={scrollToRow} />

                                    <TableHeader className="border-l-2 border-l-blue-900/50 min-w-[70px]">V<sub>D</sub></TableHeader>
                                    <TableHeader className="min-w-[70px]">V<sub>D</sub>[%]</TableHeader>
                                    <TableHeader className="min-w-[70px]">L</TableHeader>
                                    <HeaderWithChk label="[mm²]" errorRows={sectionErrors.SE} onScroll={scrollToRow} />

                                    <TableHeader className="border-l-2 border-l-blue-900/50 min-w-[70px]">t<sub>n</sub></TableHeader>
                                    <TableHeader className="min-w-[70px]">I<sub>SC</sub></TableHeader>
                                    <TableHeader className="text-[10px] min-w-[70px]">I<sub>SC</sub>²t<sub>n</sub>/k</TableHeader>
                                    <HeaderWithChk label="[mm²]" errorRows={sectionErrors.SSC} onScroll={scrollToRow} />

                                    <TableHeader className="border-l-2 border-l-blue-900/50 min-w-[70px]">V<sub>MSD</sub></TableHeader>
                                    <TableHeader className="min-w-[70px]">V<sub>MSD%</sub></TableHeader>
                                    <th className="border border-gray-900 bg-black px-1 py-1 text-center whitespace-nowrap min-w-[70px] relative">
                                        <button
                                            onClick={() => setIsSmseExpanded(!isSmseExpanded)}
                                            className="absolute top-1 left-1/2 -translate-x-1/2 flex items-center justify-center transition-colors group/expand"
                                            title={isSmseExpanded ? "접기" : "기준값 보기"}
                                        >
                                            {isSmseExpanded ? <ChevronLeft size={14} className="text-yellow-500" /> : <ChevronRight size={14} className="text-gray-500 group-hover/expand:text-yellow-500" />}
                                        </button>
                                        <div className={`${isSmseExpanded ? "text-[10px]" : "text-[13px]"} font-bold text-gray-300 mt-[18px]`}>
                                            {isSmseExpanded ? <>기준V<sub>MSD%</sub></> : "IMS"}
                                        </div>
                                    </th>
                                    {isSmseExpanded && <TableHeader className="min-w-[70px]">IMS</TableHeader>}
                                    <HeaderWithChk label="[mm²]" errorRows={sectionErrors.SMSE} onScroll={scrollToRow} />

                                    <TableHeader className="border-l-2 border-l-blue-900/50 min-w-[70px]">IMS</TableHeader>
                                    <TableHeader className="min-w-[70px]">t<sub>m</sub></TableHeader>
                                    <TableHeader className="min-w-[70px]">절연물</TableHeader>
                                    <HeaderWithChk label="[mm²]" errorRows={sectionErrors.SMSTH} onScroll={scrollToRow} />

                                    <TableHeader className="border-l-2 border-l-blue-900/50 min-w-[70px]">R</TableHeader>
                                    <TableHeader className="min-w-[70px]">X</TableHeader>

                                    <TableHeader className="border-l-2 border-l-blue-900/50 min-w-[70px]">[m]</TableHeader>
                                    <TableHeader className="min-w-[70px]">단수/회로</TableHeader>
                                    <TableHeader className="min-w-[70px]">[℃]</TableHeader>
                                    <TableHeader className="min-w-[70px]">[℃]</TableHeader>
                                    <TableHeader className="min-w-[70px]">[m]</TableHeader>
                                    <TableHeader className="min-w-[70px]"><div className="text-[10px] whitespace-nowrap">[K·m/W]</div></TableHeader>
                                    <HeaderWithChk label="방법" errorRows={sectionErrors.METHOD} onScroll={scrollToRow} className="border-l-2 border-l-blue-900/50" />

                                    <TableHeader className="border-l-2 border-l-blue-900/50 min-w-[70px]">규격전압</TableHeader>
                                    <TableHeader className="min-w-[70px]">절연</TableHeader>
                                    <TableHeader className="min-w-[70px]">CORE</TableHeader>
                                    <HeaderWithChk label="도체" errorRows={sectionErrors.CABLE_COND} onScroll={scrollToRow} />
                                    <TableHeader className="min-w-[70px]">단면적</TableHeader>
                                    <TableHeader className="min-w-[70px]">LINE</TableHeader>
                                    <TableHeader className="min-w-[70px]">X</TableHeader>

                                    <TableHeader className="border-l-2 border-l-blue-900/50 min-w-[70px]">도체</TableHeader>
                                    <TableHeader className="min-w-[70px]">단면적</TableHeader>
                                    <TableHeader className="min-w-[70px]">X</TableHeader>

                                    <HeaderWithChk label="재질" errorRows={sectionErrors.CONDUIT_MAT} onScroll={scrollToRow} className="border-l-2 border-l-blue-900/50" />
                                    <HeaderWithChk label="호칭" errorRows={sectionErrors.CONDUIT_NOM} onScroll={scrollToRow} />
                                    <TableHeader className="min-w-[70px]">LINE</TableHeader>
                                    <TableHeader className="min-w-[70px]">관내</TableHeader>
                                    <TableHeader className="min-w-[70px]">TOTAL</TableHeader>
                                    <TableHeader className="min-w-[70px] border-l-2 border-l-blue-900/50">Chk</TableHeader>
                                </tr>
                            </thead>
                            <tbody>
                                {(() => {
                                    const combinedHandlers = {
                                        onRowClick: handleRowClick,
                                        onContextMenu: handleContextMenu,
                                        onDragStart: handleDragStart,
                                        onDragOver: handleDragOver,
                                        onDragLeave: handleDragLeave,
                                        onDrop: handleDrop,
                                        onDragEnd: handleDragEnd,
                                        updateFeeder,
                                        handleDropdownInteract,
                                        handleDropdownKeyDown,
                                        handleFindAllTo,
                                        isDuplicateToId: (id) => displayFeeders.filter(f => f.toId === id).length > 1,
                                        isMaterialMethodValid: feederChker.isMaterialMethodValid,
                                        toggleGroupCollapse
                                    };

                                    const usedFromIds = displayFeeders.map(f => f.fromId).filter(id => id);
                                    const usedToIds = displayFeeders.map(f => f.toId).filter(id => id);

                                    let displayIndex = 0;
                                    return displayFeeders.map((feeder) => {
                                        // 접기 로직: 현재 행이 접힌 그룹에 속해 있다면 렌더링 스킵 (Header 제외)
                                        if (feeder.groupId && collapsedGroups.has(feeder.groupId) && feeder.rowType !== 'group-header') {
                                            return null;
                                        }

                                        if (feeder.rowType !== 'group-header' && feeder.rowType !== 'group-footer') {
                                            displayIndex++;
                                        }
                                        
                                        const isSelected = selectedRows.includes(feeder.id);
                                        const isDragging = draggedRow === feeder.id;
                                        const isDropTarget = dropTarget === feeder.id;

                                        return (
                                            <FeederRow
                                                key={feeder.id}
                                                feeder={feeder}
                                                index={displayIndex - 1}
                                                isSelected={isSelected}
                                                isDropTarget={isDropTarget}
                                                isDragging={isDragging}
                                                handlers={combinedHandlers}
                                                lookup={lookup}
                                                breakerType={settingsI2Type}
                                                breakerOptions={BREAKER_TYPES}
                                                settingsPF={settingsPF}
                                                settingsEff={settingsEff}
                                                isSmseExpanded={isSmseExpanded}
                                                usedFromIds={usedFromIds}
                                                usedToIds={usedToIds}
                                                isHighlighted={highlightedFeederIds.has(feeder.id)}
                                                isCollapsed={feeder.groupId ? collapsedGroups.has(feeder.groupId) : false}
                                                kecSettings={kecSettings}
                                            />
                                        );
                                    });
                                })()}
                                {/* Add Row Button Row */}
                                <tr className="hover:bg-gray-900/30">
                                    <td colSpan={isSmseExpanded ? 87 : 86} className="p-2 text-left pl-4 border-l-2 border-r-2 border-b-2 border-blue-500/20">
                                        <button
                                            onClick={addFeeder}
                                            className="flex items-center gap-2 text-green-500 hover:text-green-400 text-[12px] font-bold uppercase tracking-widest"
                                        >
                                            <Plus size={14} />
                                            Add Row
                                        </button>
                                        <button
                                            onClick={() => setIsSyncModalOpen(true)}
                                            className="flex items-center gap-2 text-blue-500 hover:text-blue-400 text-[12px] font-bold uppercase tracking-widest ml-4 transition-colors"
                                            title="에너지 플로우 계통 동기화 및 재배치"
                                        >
                                            <RotateCcw size={14} />
                                            Sync Energy Flow
                                        </button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                    </div>

                    {/* Horizontal Section Navigation Bar */}
                    <div className="fixed bottom-6 sm:bottom-10 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-1 sm:gap-1.5 p-1 sm:p-1.5 bg-gray-950/40 backdrop-blur-md border border-white/10 rounded-xl sm:rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] scale-90 sm:scale-100 transition-all duration-300 max-w-[95vw] overflow-x-auto scrollbar-hide">
                        {NAV_ITEMS.map((item, idx) => {
                            const isReview = item.id === 'sec-review';
                            const isBurning = isReview && hasAnyFail;

                            return (
                                <button
                                    key={idx}
                                    onClick={() => handleScrollToSection(item.id)}
                                    className={`group relative p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl hover:bg-white/10 transition-all duration-200 flex items-center justify-center flex-shrink-0 ${isBurning ? 'animate-comic-fire' : ''}`}
                                    title={item.label}
                                >
                                    <item.icon size={16} className={`${isBurning ? 'text-white' : item.color} sm:w-[18px] sm:h-[18px] group-hover:scale-110 transition-transform`} />
                                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 border border-gray-800 text-[10px] text-white opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap rounded shadow-xl">
                                        {item.label}
                                    </div>
                                    {/* Glow Effect on hover */}
                                    {!isBurning && <div className={`absolute inset-0 opacity-0 group-hover:opacity-20 rounded-xl blur-lg transition-opacity ${item.color.replace('text', 'bg')}`} />}
                                </button>
                            );
                        })}
                    </div>
                </div>
                <div className="h-4 shrink-0"></div>

                {/* Global Floating Dropdown */}
                {activeDropdown.show && createPortal(
                    <>
                        <div className="fixed inset-0 z-[1000] cursor-default" onClick={() => setActiveDropdown(prev => ({ ...prev, show: false }))} />
                        <div
                            className="absolute z-[2001] bg-black border border-gray-800 shadow-xl max-h-60 overflow-y-auto custom-scrollbar flex flex-col dropdown-viewport"
                            style={{ left: activeDropdown.x, top: activeDropdown.y, width: activeDropdown.width }}
                        >
                            {activeDropdown.filteredOptions.map((opt, index) => {
                                const isSpecial = opt.value?.toString().startsWith('FIND_ALL');
                                return (
                                    <div
                                        key={opt.value}
                                        onClick={() => activeDropdown.onSelect(opt)}
                                        onMouseEnter={() => setActiveDropdown(prev => ({ ...prev, selectedIndex: index }))}
                                        className={`px-2 py-2 text-[13px] cursor-pointer transition-all border-l-2 
                                            ${isSpecial 
                                                ? 'text-green-500 font-bold border-transparent hover:bg-white/5' 
                                                : index === activeDropdown.selectedIndex 
                                                    ? 'border-yellow-500 bg-white/5 text-white' 
                                                    : 'border-transparent text-gray-300 hover:border-yellow-500 hover:bg-white/5 hover:text-white'
                                            } 
                                            text-${activeDropdown.textAlign}`}
                                    >
                                        <div className="flex items-center gap-2">
                                            {isSpecial && <Zap size={14} fill="currentColor" />}
                                            {opt.label}
                                        </div>
                                    </div>
                                );
                            })}
                            {activeDropdown.filteredOptions.length === 0 && (
                                <div className="px-4 py-3 text-[12px] text-gray-600 italic">No Result</div>
                            )}
                        </div>
                    </>,
                    document.body
                )}

                {/* Delete Confirmation Modal */}
                <Modal
                    isOpen={modal.show}
                    onClose={() => setModal(prev => ({ ...prev, show: false }))}
                    title={modal.title}
                >
                    <div className="mb-6">
                        <p className="text-gray-300 text-[14px] leading-relaxed">
                            {modal.message}
                            <br />
                            <span className="text-red-500/80 text-[12px] mt-2 block font-medium">이 작업은 되돌릴 수 없습니다.</span>
                        </p>
                    </div>
                    <div className="flex gap-3 justify-end">
                        <button
                            onClick={() => setModal(prev => ({ ...prev, show: false }))}
                            className="px-5 py-2.5 border border-gray-800 text-gray-400 hover:text-white hover:bg-gray-900 text-[12px] font-bold uppercase tracking-widest transition-all"
                        >
                            취소(ESC)
                        </button>
                        <button
                            onClick={modal.onConfirm}
                            className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-[12px] font-bold uppercase tracking-widest transition-all shadow-lg shadow-red-900/20"
                        >
                            삭제(Enter)
                        </button>
                    </div>
                </Modal>

                {/* Sync Confirmation Modal - Premium Style */}
                {isSyncModalOpen && createPortal(
                    <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4">
                        <div 
                            className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-300"
                            onClick={() => setIsSyncModalOpen(false)}
                        />
                        <div className="relative bg-gray-950 border border-white/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                            {/* Accent Glow */}
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-blue-600/20 blur-3xl rounded-full" />
                            
                            <div className="relative p-8">
                                <div className="flex flex-col items-center text-center">
                                    <div className="mb-6 relative">
                                        <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full animate-pulse" />
                                        <div className="relative w-16 h-16 bg-blue-600/20 border border-blue-500/30 rounded-full flex items-center justify-center">
                                            <Zap size={30} className="text-blue-400 fill-blue-400/20" />
                                        </div>
                                    </div>

                                    <h3 className="text-xl font-bold text-white mb-2 tracking-tight">계통 동기화 시작</h3>
                                    <p className="text-gray-400 text-[14px] leading-relaxed mb-8">
                                        에너지 플로우와 간선계산서를 동기화합니다.<br />
                                        기존 그룹화 정보가 <span className="text-yellow-500 font-normal">에너지 플로우 순서</span>로 재배치됩니다.
                                    </p>

                                    <div className="flex flex-col gap-3 w-full">
                                        <button
                                            onClick={() => {
                                                reorderFeedersByHierarchy();
                                                setIsSyncModalOpen(false);
                                                showToast('에너지 플로우 계통 동기화 완료.', 'success');
                                            }}
                                            className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-[#d1d5db] text-[13px] font-normal uppercase tracking-widest rounded-xl transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] active:scale-95"
                                        >
                                            Update Now
                                        </button>
                                        <button
                                            onClick={() => setIsSyncModalOpen(false)}
                                            className="w-full py-3 text-gray-400 hover:text-white text-[12px] font-normal uppercase tracking-widest transition-colors"
                                        >
                                            CANCEL
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}

                <ContextMenuComponent />

                {/* Parallel Conductor Popup */}
                {isParallelPopupOpen && parallelTargetFeeder && (
                    <ParallelConductorPopup
                        isOpen={isParallelPopupOpen}
                        onClose={() => {
                            setIsParallelPopupOpen(false);
                            setParallelPopupFeederId(null);
                        }}
                        onApply={handleParallelApply}
                        initialValue={parallelTargetFeeder.method}
                        wire={parallelTargetFeeder.cableIns}
                        size={parallelTargetFeeder.cableCond}
                        kecSettings={{ cableCondition: { area: 50 } }}
                    />
                )}
            </div>
        </div>
    );
};

export default PanelFeederContent;
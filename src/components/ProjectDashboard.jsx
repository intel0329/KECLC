import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import Papa from 'papaparse';
import { createPortal } from 'react-dom';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronDown, Plus, Folder, FileText, Settings, ArrowLeft, X, FolderOpen, Copy, Trash2, Edit2, Check, Download, Loader, AlertTriangle, Zap, Layers, FileCode, FileSpreadsheet } from 'lucide-react';
import { getProject, setActiveProject, addPanelToProject, updateProject, updatePanelName, removePanelFromProject, removePanelsFromProject, duplicatePanel, reorderPanels, performBatchSave } from '../services/projectService';
import projectService from '../services/projectService';
import CalculatorTree from './CalculatorTree/CalculatorTree';
import { calculatePanelSize } from './PanelLoad/estpl/panelSizeCalculator';
import ExcelBulkImportModal from '../utils/excel/ExcelBulkImportModal'; // [Path Updated]
import ProjectSyncOverlay from './ProjectSyncOverlay';
import useDataStore from '../store/useDataStore';
import BulkCadExportModal from '../utils/cad/BulkCadExportModal';




// [Helper] 계산서 이름 중복 체크
const isNameDuplicate = (project, name) => {
    if (!project || !project.calculators) return false;
    const checkNames = (items) => {
        for (const item of items) {
            if (item.name && item.name.trim() === name.trim()) return true;
            if (item.children && checkNames(item.children)) return true;
        }
        return false;
    };
    return checkNames(project.calculators);
};

const CornerBorders = () => (
    <>
        <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-blue-500/50"></div>
        <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-blue-500/50"></div>
        <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-blue-500/50"></div>
        <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-blue-500/50"></div>
    </>
);



// Modal Component
const Modal = ({ isOpen, onClose, title, children }) => {
    const backdropRef = useRef(null);
    const [isBackdropTarget, setIsBackdropTarget] = useState(false);

    if (!isOpen) return null;

    const handleMouseDown = (e) => {
        if (e.target === backdropRef.current) {
            setIsBackdropTarget(true);
        } else {
            setIsBackdropTarget(false);
        }
    };

    const handleClick = (e) => {
        if (e.target === backdropRef.current && isBackdropTarget) {
            onClose();
        }
        setIsBackdropTarget(false);
    };

    return (
        <div
            ref={backdropRef}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
            onMouseDown={handleMouseDown}
            onClick={handleClick}
        >
            <div
                className="relative bg-black border border-gray-800 w-full max-w-md mx-4 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
            >
                <CornerBorders />
                <div className="flex items-center justify-between p-4 border-b border-gray-800">
                    <h3 className="text-sm font-bold text-white uppercase tracking-widest">{title}</h3>
                    <button onClick={onClose} className="p-1 text-gray-400 hover:text-white transition-colors">
                        <X size={18} />
                    </button>
                </div>
                <div className="p-4">
                    {children}
                </div>
            </div>
        </div>
    );
};

// Custom Delete Confirmation Modal
const DeleteConfirmModal = ({ isOpen, onClose, onConfirm, itemName }) => {
    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="항목 삭제">
            <div className="text-gray-300 text-sm mb-6">
                <span className="text-red-500 font-bold">'{itemName}'</span> 계산서를 삭제하시겠습니까?<br />
                삭제된 데이터는 복구할 수 없습니다.
            </div>
            <div className="flex gap-3 justify-end">
                <button
                    onClick={onClose}
                    className="px-4 py-2 border border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800 text-sm font-bold uppercase tracking-widest transition-colors min-w-[90px]"
                >
                    취소
                </button>
                <button
                    onClick={onConfirm}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold uppercase tracking-widest transition-colors shadow-lg shadow-red-900/20 min-w-[90px]"
                >
                    삭제
                </button>
            </div>
        </Modal>
    );
};



const ProjectDashboard = () => {
    const { projectId } = useParams();
    const navigate = useNavigate();
    const [selectedItem, setSelectedItem] = useState(null);
    const [project, setProject] = useState(null);
    const [loading, setLoading] = useState(true);
    const [draggedItem, setDraggedItem] = useState(null);
    const [dragOverId, setDragOverId] = useState(null);
    const [deleteModal, setDeleteModal] = useState({ isOpen: false, targetItem: null, parentId: null });
    const [isExporting, setIsExporting] = useState(false);
    const [showExportSaveModal, setShowExportSaveModal] = useState(false);

    // 분전반 추가 모달 상태
    const [addPanelModal, setAddPanelModal] = useState({ isOpen: false, calculatorType: null });
    const [showTRChoiceModal, setShowTRChoiceModal] = useState(false);
    const [newPanelName, setNewPanelName] = useState('');
    const [expandedGrid, setExpandedGrid] = useState({});

    // [NEW] 다중 선택 모드 상태
    const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    const [selectionFolderId, setSelectionFolderId] = useState(null);
    const [lastSelectedId, setLastSelectedId] = useState(null);
    const [multiDeleteModal, setMultiDeleteModal] = useState({ isOpen: false, itemIds: [] });

    // [NEW] 일괄 임포트 모달 제어
    const [bulkImportModal, setBulkImportModal] = useState({ isOpen: false, projectId: null, calculatorId: null });

    // [NEW] Bulk CAD Export 상태
    const [showBulkCadModal, setShowBulkCadModal] = useState(false);

    
    // [SYNC] 전역 활성 프로젝트 초기화 액션

    const initProject = useDataStore(state => state.initProject);

    // Listen for bulk import trigger
    useEffect(() => {
        const handleOpenBulk = (e) => {
            setBulkImportModal({ isOpen: true, projectId: e.detail.projectId, calculatorId: e.detail.calculatorId });
        };

        window.addEventListener('kelc_open_bulk_import', handleOpenBulk);
        return () => {
            window.removeEventListener('kelc_open_bulk_import', handleOpenBulk);
        };
    }, []);



    // [NEW] 동기화 상태 관리 - 스위칭 시에만 수행하도록 최적화
    const [isSyncing, setIsSyncing] = useState(() => {
        // [Stability] 프로젝트 리스트에서 '동일' 프로젝트 로드 시 싱크를 건너뜀 (사용자 요청)
        const activePid = localStorage.getItem('kelc_active_project_id');
        return activePid !== projectId;
    });

    const handleSyncComplete = () => {
        setIsSyncing(false);
        loadProject(); // 동기화 후 최신 데이터로 다시 로드
    };

    // 프로젝트 데이터 로드 및 동기화 상태 리셋
    const loadProject = async () => {
        const loadedProject = await getProject(projectId);
        if (loadedProject) {
            setProject({ ...loadedProject }); // Force re-render
            // [SYNC] 서비스 직접 호출 대신 스토어 초기화 사용 (상태 동기화 핵심)
            initProject(projectId);
        }
        setLoading(false);
    };

    useEffect(() => {
        // [Stability] 프로젝트 ID가 실제로 변경되었을 때만(스위칭) 동기화 프로세스 실행
        const activePid = localStorage.getItem('kelc_active_project_id');
        if (activePid !== projectId) {
            setIsSyncing(true);
        }
        loadProject();
    }, [projectId]);

    // Listen for global project updates (e.g., from Calculation Header)
    useEffect(() => {
        const handleUpdate = () => {
            loadProject();
        };
        window.addEventListener('kelc_project_info_updated', handleUpdate);
        return () => window.removeEventListener('kelc_project_info_updated', handleUpdate);
    }, []);

    const handleDragStart = (e, item, parentId) => {
        setDraggedItem({ item, parentId });
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e, item, parentId) => {
        if (!draggedItem || draggedItem.parentId !== parentId || draggedItem.item.id === item.id) return;
        e.preventDefault();
        setDragOverId(item.id);
    };

    const handleDragLeave = () => {
        setDragOverId(null);
    };

    const handleConfirmDelete = async () => {
        if (!deleteModal.targetItem) return;

        const result = await removePanelFromProject(projectId, deleteModal.parentId, deleteModal.targetItem.id);
        if (result) {
            await loadProject();
            window.dispatchEvent(new Event('kelc_project_info_updated'));

            // [SYNC] 리스트의 계산서 개수 등 정보 갱신 전파
            useDataStore.getState().broadcastListUpdate();

            // If the deleted item was selected, clear the selection
            if (selectedItem && selectedItem.id === deleteModal.targetItem.id) {
                setSelectedItem(null);
            }
        }
        setDeleteModal({ isOpen: false, targetItem: null, parentId: null });
    };

    const handleOpenDeleteModal = (item, parentId) => {
        setDeleteModal({ isOpen: true, targetItem: item, parentId });
    };

    const handleDrop = async (e, targetItem, parentId) => {
        setDragOverId(null);
        if (!draggedItem || draggedItem.parentId !== parentId || draggedItem.item.id === targetItem.id) return;
        e.preventDefault();

        const calculator = project.calculators.find(c => c.id === parentId);
        if (!calculator || !calculator.children) return;

        const newChildren = [...calculator.children];
        const draggedIndex = newChildren.findIndex(p => p.id === draggedItem.item.id);
        const targetIndex = newChildren.findIndex(p => p.id === targetItem.id);

        // Move item
        newChildren.splice(draggedIndex, 1);
        newChildren.splice(targetIndex, 0, draggedItem.item);

        const result = await reorderPanels(projectId, parentId, newChildren);
        if (result) {
            await loadProject();
            window.dispatchEvent(new Event('kelc_project_info_updated'));
        }
        setDraggedItem(null);
    };

    // [NEW] 다중 선택 핸들러
    const handleEnterMultiSelectMode = (folderId) => {
        setSelectionFolderId(folderId);
        setIsMultiSelectMode(true);
        setSelectedIds([]);
        setLastSelectedId(null);
    };

    const handleToggleSelect = (panelId, event) => {
        const isShift = event?.shiftKey;
        const isCtrl = event?.ctrlKey || event?.metaKey;

        if (isShift && lastSelectedId) {
            // Find children of selectionFolderId to determine range
            const folder = project.calculators.find(c => c.id === selectionFolderId);
            if (folder && folder.children) {
                const allIds = folder.children.map(c => c.id);
                const startIdx = allIds.indexOf(lastSelectedId);
                const endIdx = allIds.indexOf(panelId);
                
                if (startIdx !== -1 && endIdx !== -1) {
                    const range = allIds.slice(Math.min(startIdx, endIdx), Math.max(startIdx, endIdx) + 1);
                    setSelectedIds(prev => {
                        const next = new Set(prev);
                        range.forEach(id => next.add(id));
                        return Array.from(next);
                    });
                }
            }
        } else if (isCtrl) {
            // Individual selection toggle
            setSelectedIds(prev => 
                prev.includes(panelId) 
                    ? prev.filter(id => id !== panelId) 
                    : [...prev, panelId]
            );
        } else {
            // Regular click toggles (as before) or selects only one if desired. 
            // In multi-select mode, toggle is usually preferred.
            setSelectedIds(prev => 
                prev.includes(panelId) 
                    ? prev.filter(id => id !== panelId) 
                    : [...prev, panelId]
            );
        }
        
        setLastSelectedId(panelId);
    };

    const handleCancelMultiSelect = () => {
        setIsMultiSelectMode(false);
        setSelectedIds([]);
        setSelectionFolderId(null);
        setLastSelectedId(null);
    };

    const handleConfirmMultiDelete = async () => {
        if (multiDeleteModal.itemIds.length === 0) return;

        const panelItems = multiDeleteModal.itemIds.map(id => ({
            calculatorId: selectionFolderId,
            panelId: id
        }));

        const result = await removePanelsFromProject(projectId, panelItems);
        if (result) {
            await loadProject();
            window.dispatchEvent(new Event('kelc_project_info_updated'));
            
            // [SYNC] 리스트의 계산서 개수 등 정보 갱신 전파
            useDataStore.getState().broadcastListUpdate();
        }
        
        setMultiDeleteModal({ isOpen: false, itemIds: [] });
        handleCancelMultiSelect();
    };

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editFormData, setEditFormData] = useState({
        name: '',
        client: '',
        date: '',
        description: '',
        selectedCalculators: []
    });

    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        message: '',
        onConfirm: null
    });

    const handleOpenEditModal = () => {
        setEditFormData({
            name: project.name || '',
            client: project.client || '',
            date: project.date || '',
            description: project.description || '',
            selectedCalculators: project.calculators?.filter(c => c.enabled).map(c => c.id.split('_')[0]) || []
        });
        setIsEditModalOpen(true);
    };

    const toggleEditCalculator = (id) => {
        setEditFormData(prev => ({
            ...prev,
            selectedCalculators: prev.selectedCalculators.includes(id)
                ? prev.selectedCalculators.filter(c => c !== id)
                : [...prev.selectedCalculators, id]
        }));
    };

    const handleUpdateProject = async (force = false) => {
        if (!editFormData.name.trim()) return;

        // Check if any calculators with data are being removed
        if (force !== true) {
            const removedCalculators = (project.calculators || [])
                .filter(calc => calc.enabled && !editFormData.selectedCalculators.includes(calc.id.split('_')[0]));

            const calculatorsWithData = removedCalculators.filter(calc =>
                (calc.children && calc.children.length > 0) ||
                (calc.type === 'single') // Single calculators usually have global settings data
            );

            if (calculatorsWithData.length > 0) {
                const names = calculatorsWithData.map(c => c.name).join(', ');
                setConfirmModal({
                    isOpen: true,
                    message: `[${names}] 내 데이터가 존재합니다. 해제하고 저장하면 영구 삭제됩니다.`,
                    onConfirm: () => handleUpdateProject(true)
                });
                return;
            }
        }

        // Preserve children for disabled calculators by only updating 'enabled' property
        const updatedCalculators = (project.calculators || []).map(calc => ({
            ...calc,
            enabled: editFormData.selectedCalculators.includes(calc.id.split('_')[0])
        }));

        const updatePayload = {
            ...editFormData,
            calculators: updatedCalculators
        };

        const result = await updateProject(projectId, updatePayload);
        if (result) {
            setProject(result);
            setIsEditModalOpen(false);
            setConfirmModal({ isOpen: false, message: '', onConfirm: null });
            // Trigger header/sidebar refresh
            window.dispatchEvent(new Event('kelc_project_info_updated'));
            
            // [SYNC] 프로젝트 이름/정보 변경 사실을 리스트 탭에 전파
            useDataStore.getState().broadcastListUpdate();
        }
    };

    const handleSelect = (item, parentId = null) => {
        console.log('Selected item:', item, 'ParentId:', parentId);
        setSelectedItem(item);
        
        // Navigation priority: 
        // 1. Check parentId if provided
        // 2. Fallback to ID prefixes
        const type = parentId || (item.id.includes('-') ? item.id.split('-')[0] : '');

        // [STRICT] Low Voltage Receiving must come first to avoid hyphen conflicts
        if (item.id.startsWith('low-voltage-receiving')) {
            navigate(`/project/${projectId}/low-voltage-receiving/${item.id}`);
            return;
        }

        // [STRICT] UPS routing must come first to avoid being caught by generic prefixes
        if (type === 'ups' || item.id.startsWith('ups-')) {
            navigate(`/project/${projectId}/ups/${item.id}`);
            return;
        }

        if (type === 'panel-load' || item.id.startsWith('lp-') || item.id.startsWith('mcc-') || item.id.startsWith('panel-load-')) {
            navigate(`/project/${projectId}/panel-load/${item.id}`);
        } else if (type === 'power-load' || item.id.startsWith('power-load-') || item.id.startsWith('pp-')) {
            navigate(`/project/${projectId}/power-load/${item.id}`);
        } else if (item.id === 'panel-feeder' || item.id.startsWith('panel-feeder_')) {
            const targetId = item.id.includes('_') ? item.id : `${item.id}_${projectId}`;
            navigate(`/project/${projectId}/panel-feeder/${targetId}`);
        } else if (type === 'transformer' || item.id === 'transformer' || item.id.startsWith('transformer_') || item.id.startsWith('transformer-')) {
            const targetId = item.id.includes('_') ? item.id : (item.id.includes('-') ? item.id : `${item.id}_${projectId}`);
            navigate(`/project/${projectId}/transformer/${targetId}`);
        } else if (item.id === 'generator' || item.id.startsWith('generator_')) {
            const targetId = item.id.includes('_') ? item.id : `${item.id}_${projectId}`;
            navigate(`/project/${projectId}/generator/${targetId}`);
        } else if (type === 'visual' || item.id.startsWith('visual-')) {
            navigate(`/project/${projectId}/visual/${item.id}`);
        }
    };

    // ================================================================
    // 통합 엑셀 내보내기 핸들러
    // ================================================================
    const handleCombinedExcelExport = async () => {
        if (isExporting || !project) return;
        setIsExporting(true);

        try {
            const { getRemoteData } = await import('../services/projectService');
            const { exportCombinedExcel } = await import('../utils/excelExport');
            const { calculatePowerLoadExportData } = await import('../utils/powerLoadCalculations');

            const enabledCalcs = project.calculators?.filter(c => c.enabled) || [];
            const panels = [];

            // 패널 ID → 이름 매핑 (SOURCE 필드 변환용)
            const panelNameMap = {};
            for (const calc of project.calculators || []) {
                for (const child of calc.children || []) {
                    panelNameMap[child.id] = child.name;
                    for (const nested of child.children || []) {
                        panelNameMap[nested.id] = nested.name;
                    }
                }
            }

            for (const calc of enabledCalcs) {
                if (!calc.children || calc.children.length === 0) continue;

                for (const child of calc.children) {
                    // draft 우선, 없으면 origin 데이터 로드
                    let data = await getRemoteData(`kelc_panel_draft_${child.id}`);
                    if (!data || !data.projectInfo) {
                        data = await getRemoteData(`kelc_panel_data_${child.id}`);
                    }
                    if (!data) continue;

                    const projectInfo = {
                        ...data.projectInfo,
                        name: project.name,
                        panelName: data.projectInfo?.panelName || child.name,
                        // SOURCE 필드: fromId를 패널 이름으로 변환 (개별 내보내기의 getNameById 패턴과 동일)
                        sourceName: panelNameMap[data.projectInfo?.fromId] || data.projectInfo?.sourceName || '',
                        source: panelNameMap[data.projectInfo?.fromId] || data.projectInfo?.source || ''
                    };

                    if (calc.id === 'panel-load') {
                        // --- 분전반 데이터 준비 ---
                        const leftCircuits = data.leftCircuits || [];
                        const rightCircuits = data.rightCircuits || [];

                        // [피드백 반영] 판넬 사이즈 실시간 계산 추가 (통합 엑셀용)
                        const calculatedPanelSize = calculatePanelSize(
                            projectInfo.mccbAF,
                            projectInfo.phase,
                            leftCircuits,
                            rightCircuits
                        );

                        // getMaxRow 재계산
                        const leftMax = leftCircuits.length > 0 ? Math.max(...leftCircuits.map(c => c.row)) : 0;
                        const rightMax = rightCircuits.length > 0 ? Math.max(...rightCircuits.map(c => c.row)) : 0;
                        const getMaxRow = () => Math.max(leftMax, rightMax);

                        // selectedPhaseLine (read from projectInfo, default to L1)
                        const selectedPhaseLine = projectInfo.selectedPhaseLine || 'L1';

                        // totalLoad 재계산
                        const totalLoad = leftCircuits.reduce((sum, c) => sum + (Number(c.power) || 0), 0)
                            + rightCircuits.reduce((sum, c) => sum + (Number(c.power) || 0), 0);

                        // phaseTotals 재계산 (PanelLoad/index.jsx ~line 2241-2287 동일 로직)
                        let l1 = 0, l2 = 0, l3 = 0;
                        const processSide = (circuits) => {
                            circuits.forEach(c => {
                                const loadTotal = Number(c.power) || 0;
                                const p = Number(c.p) || 4;
                                if (projectInfo.phase === '1Ø-2W') {
                                    if (selectedPhaseLine === 'L1') l1 += loadTotal;
                                    else if (selectedPhaseLine === 'L2') l2 += loadTotal;
                                    else if (selectedPhaseLine === 'L3') l3 += loadTotal;
                                } else {
                                    if (p === 2) {
                                        const pl = c.phaseLine || 'L1';
                                        if (pl === 'L1') l1 += loadTotal;
                                        else if (pl === 'L2') l2 += loadTotal;
                                        else if (pl === 'L3') l3 += loadTotal;
                                    } else {
                                        const share = loadTotal / 3;
                                        l1 += share; l2 += share; l3 += share;
                                    }
                                }
                            });
                        };
                        processSide(leftCircuits);
                        processSide(rightCircuits);
                        const phaseTotals = {
                            l1, l2, l3,
                            max: Math.max(l1, l2, l3),
                            maxCurrent: Math.max(l1 / 220, l2 / 220, l3 / 220)
                        };

                        panels.push({
                            type: 'panel-load',
                            sheetName: child.name,
                            data: {
                                projectInfo: { ...projectInfo, calculatedPanelSize },
                                leftCircuits,
                                rightCircuits,
                                getMaxRow,
                                selectedPhaseLine,
                                phaseTotals,
                                totalLoad
                            }
                        });

                    } else if (calc.id === 'power-load') {
                        // --- 동력반 데이터 준비 ---
                        const powerLoads = data.powerLoads || [];

                        // KEC 설정 로드
                        let kecSettings = null;
                        try {
                            const perProjectSettings = await getRemoteData('kelc_setting_data', projectId);
                            if (perProjectSettings) {
                                kecSettings = perProjectSettings;
                            } else {
                                const globalSettings = await getRemoteData('kelc_global_settings');
                                if (globalSettings) kecSettings = globalSettings;
                            }
                        } catch (e) { console.error('KEC settings load error:', e); }

                        // MCC 설정 로드 (localStorage에 저장됨 - PowerLoadContent.jsx와 동일)
                        let mccSettings = {
                            betaDirect1P: 6.0, betaDirect3PSmall: 9.5, betaDirect3PLarge: 8.2,
                            betaYD: 7.2, betaReactor: 7.7, reactorTap: 0.65,
                            lambdaInv: 1.2, globalK: 1.5, globalCT: 1.25,
                            tmDOL: 2, tmYD: 6, tmReactor: 10, tmINV: 4
                        };
                        try {
                            const defaultKey = 'kelc_mcc_settings';
                            const projectKey = projectId ? `${defaultKey}_${projectId}` : defaultKey;
                            const savedMcc = localStorage.getItem(projectKey) || localStorage.getItem(defaultKey);
                            if (savedMcc) {
                                const parsed = JSON.parse(savedMcc);
                                const sliders = parsed.independentSliders;
                                if (sliders) {
                                    mccSettings = {
                                        ...mccSettings,
                                        betaDirect1P: Number(sliders.betaDirect1P ?? mccSettings.betaDirect1P),
                                        betaDirect3PSmall: Number(sliders.betaDirect3PSmall ?? mccSettings.betaDirect3PSmall),
                                        betaDirect3PLarge: Number(sliders.betaDirect3PLarge ?? mccSettings.betaDirect3PLarge),
                                        betaReactor: Number(sliders.betaReactor ?? mccSettings.betaReactor),
                                        reactorTap: Number(sliders.reactorTap ?? mccSettings.reactorTap),
                                        lambdaInv: Number(sliders.lambdaInv ?? mccSettings.lambdaInv),
                                        globalK: Number(parsed.otherSettings?.globalK ?? mccSettings.globalK),
                                        globalCT: Number(parsed.otherSettings?.globalCT ?? mccSettings.globalCT)
                                    };
                                }
                            }
                        } catch (e) { console.error('MCC settings load error:', e); }

                        // TCC 배율 데이터 로드
                        let tccMultiplierData = null;
                        try {
                            const perProjectTcc = await getRemoteData('tcc_multiplier_data', projectId);
                            if (perProjectTcc) tccMultiplierData = perProjectTcc;
                        } catch (e) { console.error('TCC data load error:', e); }

                        // 동력반 계산 실행
                        const calcResult = calculatePowerLoadExportData(
                            projectInfo, powerLoads, kecSettings, mccSettings, tccMultiplierData
                        );

                        const summaryStats = {
                            totalLoad: calcResult.totalLoad,
                            phaseTotals: calcResult.phaseTotals,
                            phaseLoad: calcResult.phaseLoad,
                            totalCurrent: calcResult.phaseTotals.totalCurrent,
                            mainCT: calcResult.mainCtValue ? `${calcResult.mainCtValue}/5A` : '-',
                            ...calcResult.summaryStats
                        };

                        panels.push({
                            type: 'power-load',
                            sheetName: child.name,
                            data: {
                                projectInfo,
                                powerLoads: calcResult.calculatedLoads,
                                summaryStats,
                                kecSettings
                            }
                        });
                    } else if (calc.id === 'transformer') {
                        // [Filter] 을지 계산서는 제외하고 갑지(transformer-main)만 통합 추출에 포함
                        if (!child.id.startsWith('transformer-main')) continue;

                        // --- 전기수용설비(갑지) 데이터 준비 ---
                        const { 
                            calculateReceivingCapacityExportData, 
                            calculateMofData, 
                            calculateInsulationTypes 
                        } = await import('../utils/receivingCapacityCalculations');
                        
                        const rawPowerLoads = data.powerLoads || [];
                        let mofData = data.mofData || {};
                        const projectInfo = data.projectInfo || {};

                        // --- [FIX] PRD.csv 실시간 로드 및 정밀 계산 ---
                        let mofDatabase = [];
                        try {
                            const csvRes = await fetch('/db/PRD.csv');
                            if (csvRes.ok) {
                                const csvText = await csvRes.text();
                                await new Promise(resolve => {
                                    Papa.parse(csvText, { complete: (results) => { mofDatabase = results.data; resolve(); } });
                                });
                            }
                        } catch (e) { console.error('Failed to load PRD.csv for unified export:', e); }

                        // --- 설정 데이터 수집 (LocalStorage/Remote) ---
                        const fuseSettings = JSON.parse(localStorage.getItem(`kelc_setting_data_${projectId}`) || 'null');
                        const mccSettings = JSON.parse(localStorage.getItem(`kelc_mcc_settings_${projectId}`) || 'null');

                        // MOF 데이터 정밀 계산
                        mofData = calculateMofData(projectInfo.mainCapacity, {
                            mofDatabase,
                            fuseSettings,
                            mccSettings
                        });

                        // --- 연결된 하위 패널 데이터 수집 (계산용) ---
                        const connectedPanelsData = {};
                        const allPanelIds = new Set();
                        rawPowerLoads.forEach(l => {
                            if (l.connectedPanelId) allPanelIds.add(l.connectedPanelId);
                            if (l.bankId) allPanelIds.add(l.bankId);
                        });

                        for (const pid of allPanelIds) {
                            let trData = await getRemoteData(`kelc_panel_draft_${pid}`);
                            if (!trData || !trData.projectInfo) trData = await getRemoteData(`kelc_panel_data_${pid}`);
                            if (trData) connectedPanelsData[pid] = trData;
                        }

                        // 실시간 행 계산 실행
                        const powerLoads = calculateReceivingCapacityExportData(rawPowerLoads, connectedPanelsData);

                        const totalLoad = powerLoads.reduce((sum, l) => l.type === 'SPARE' ? sum : sum + (Number(l.apparentPower) || 0), 0);
                        const totalCurrentCalc = powerLoads.reduce((sum, l) => l.type === 'SPARE' ? sum : sum + (Number(l.subPanelTotalCurrent) || 0), 0);

                        // --- [FIX] Insulation Types 단일화 로직 적용 ---
                        const finalInsulationTypes = calculateInsulationTypes(powerLoads, connectedPanelsData, projectInfo.insulationType);

                        panels.push({
                            type: 'transformer',
                            sheetName: child.name,
                            data: {
                                projectInfo,
                                powerLoads,
                                summaryStats: {
                                    totalLoad,
                                    totalCurrentCalc
                                },
                                mofData,
                                insulationTypes: finalInsulationTypes
                            }
                        });
                    }
                }
            }

            if (panels.length === 0) {
                window.dispatchEvent(new CustomEvent('kelc_show_toast', {
                    detail: { message: '내보낼 계산서 데이터가 없습니다.', type: 'error' }
                }));
                return;
            }

            await exportCombinedExcel(project.name, panels);

            window.dispatchEvent(new CustomEvent('kelc_show_toast', {
                detail: { message: `${panels.length}개 계산서가 통합 엑셀로 내보내기 되었습니다.`, type: 'success' }
            }));

        } catch (error) {
            console.error('Combined Excel Export Error:', error);
            window.dispatchEvent(new CustomEvent('kelc_show_toast', {
                detail: { message: '통합 엑셀 내보내기 중 오류가 발생했습니다.', type: 'error' }
            }));
        } finally {
            setIsExporting(false);
        }
    };

    const handleAddPanel = async (calculatorType) => {
        if (calculatorType === 'transformer') {
            setShowTRChoiceModal(true);
            return;
        }

        if (calculatorType === 'visual') {
            // 에너지 플로우 중복 체크 (갑지 로직 통일)
            const hasVisualPage = project.calculators
                .find(c => c.id === 'visual')?.children
                ?.some(child => child.id.startsWith('visual-network'));

            if (hasVisualPage) {
                window.dispatchEvent(new CustomEvent('kelc_show_toast', {
                    detail: { message: '에너지 플로우 화면은 이미 존재합니다.', type: 'error' }
                }));
                return;
            }

            // 즉시 생성
            const result = await addPanelToProject(projectId, 'visual', {
                name: '에너지 플로우',
                idPrefix: 'visual-network'
            });

            if (result) {
                await loadProject();
                window.dispatchEvent(new Event('kelc_project_info_updated'));
            }
            return;
        }

        let defaultName = 'PP-';
        let idPrefix = calculatorType;
        
        if (calculatorType === 'panel-load') {
            defaultName = 'LP-';
            idPrefix = 'lp';
        } else if (calculatorType === 'ups') {
            defaultName = 'UPS(-kVA)';
            idPrefix = 'ups';
        } else if (calculatorType === 'low-voltage-receiving') {
            defaultName = 'WHM';
        }
        
        setNewPanelName(defaultName);
        setAddPanelModal({ 
            isOpen: true, 
            calculatorType, 
            idPrefix 
        });
    };

    const handleConfirmAddTransformer = async (type) => {
        let name = '';
        let idPrefix = '';

        if (type === 'main') {
            // 갑지 중복 체크
            const hasMainPage = project.calculators
                .find(c => c.id === 'transformer')?.children
                ?.some(child => child.id.startsWith('transformer-main-'));

            if (hasMainPage) {
                window.dispatchEvent(new CustomEvent('kelc_show_toast', {
                    detail: { message: '전기 수용 설비 용량(갑지)은 이미 존재합니다.', type: 'error' }
                }));
                return;
            }
            name = 'HV(특고압)';
            idPrefix = 'transformer-main';
        } else {
            name = 'TR-1';
            idPrefix = 'transformer';
            // 이름 입력 모달로 전환
            setNewPanelName('TR-1');
            setAddPanelModal({ isOpen: true, calculatorType: 'transformer', idPrefix: 'transformer' });
            setShowTRChoiceModal(false);
            return;
        }

        const result = await addPanelToProject(projectId, 'transformer', {
            name,
            idPrefix
        });

        if (result) {
            await loadProject();
            window.dispatchEvent(new Event('kelc_project_info_updated'));
        }
        setShowTRChoiceModal(false);
    };

    const handleConfirmAddPanel = async () => {
        const trimmedName = newPanelName.trim();
        if (!trimmedName) return;

        // 중복 검사
        if (isNameDuplicate(project, trimmedName)) {
            window.dispatchEvent(new CustomEvent('kelc_show_toast', {
                detail: { message: `'${trimmedName}' 이름은 이미 사용 중입니다.`, type: 'error' }
            }));
            return;
        }

        const result = await addPanelToProject(projectId, addPanelModal.calculatorType, {
            name: trimmedName,
            idPrefix: addPanelModal.idPrefix
        });

        if (result) {
            await loadProject(); // 프로젝트 다시 로드
            // Notify other components
            window.dispatchEvent(new Event('kelc_project_info_updated'));
        }

        setAddPanelModal({ isOpen: false, calculatorType: null });
        setNewPanelName('');
    };

    // 로딩 중
    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <p className="text-gray-500">로딩 중...</p>
            </div>
        );
    }

    // 프로젝트를 찾을 수 없음
    if (!project) {
        return (
            <div className="px-4 md:px-6 lg:px-8 max-w-7xl mx-auto">
                <div className="text-center py-16">
                    <FileText size={48} className="mx-auto mb-4 text-gray-700" />
                    <p className="text-gray-500 mb-4">프로젝트를 찾을 수 없습니다.</p>
                    <Link
                        to="/projects"
                        className="text-blue-400 hover:text-blue-300"
                    >
                        프로젝트 목록으로 돌아가기
                    </Link>
                </div>
            </div>
        );
    }

    // enabled된 계산서만 표시
    const enabledCalculators = project.calculators?.filter(c => c.enabled) || [];

    return (
        <div className="px-4 md:px-6 lg:px-8 max-w-7xl mx-auto pb-8">
            {/* Project Stabilization Sync Overlay */}
            {isSyncing && (
                <ProjectSyncOverlay 
                    projectId={projectId} 
                    onComplete={handleSyncComplete} 
                />
            )}

            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <Link
                    to="/projects"
                    className="hidden sm:flex p-2 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                    title="프로젝트 목록으로 돌아가기"
                >
                    <ArrowLeft size={20} />
                </Link>
                <div className="flex items-stretch gap-4 min-h-[40px]">
                    <div className="w-1.5 bg-blue-600 rounded-full shrink-0"></div>
                    <div>
                        <h1 className="text-xl font-bold text-white break-keep leading-tight">{project.name}</h1>
                        <p className="text-gray-500 text-sm mt-0.5">프로젝트 대시보드</p>
                    </div>
                </div>
                <div className="ml-auto flex gap-1 sm:gap-2">
                    <Link
                        to="/projects"
                        className="flex sm:hidden p-2 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                        title="뒤로 가기"
                    >
                        <ArrowLeft size={18} />
                    </Link>
                    <button
                        onClick={() => setShowExportSaveModal(true)}
                        disabled={isExporting}
                        className="p-2 text-emerald-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="전체 계산서 통합 엑셀 내보내기"
                    >
                        {isExporting ? <Loader size={18} className="animate-spin" /> : <FileSpreadsheet size={18} />}
                    </button>
                    <button
                        onClick={() => setShowBulkCadModal(true)}
                        className="hidden md:flex p-2 text-blue-400 hover:text-white transition-colors"
                        title="전체 계산서 일괄 CAD 추출"
                    >
                        <FileCode size={18} />
                    </button>
                    <button
                        onClick={handleOpenEditModal}
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                        title="프로젝트 설정"
                    >
                        <Settings size={18} />
                    </button>
                </div>
            </div>

            {/* Export Save Confirmation Modal */}
            {showExportSaveModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={(e) => e.stopPropagation()}>
                    <div className="border border-gray-900 bg-black p-6 max-w-md w-full mx-4 relative">
                        <CornerBorders />
                        <div className="flex justify-between items-start mb-4">
                            <div className="text-gray-300 text-sm leading-relaxed">
                                최신 데이터로 엑셀을 추출하기 위해<br />
                                현재 변경 내용을 저장하시겠습니까?
                            </div>
                            <button
                                onClick={() => setShowExportSaveModal(false)}
                                className="text-gray-500 hover:text-white transition-colors -mt-1 -mr-1 p-1"
                                title="취소"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    setShowExportSaveModal(false);
                                    handleCombinedExcelExport();
                                }}
                                className="flex-1 px-4 py-3 border border-gray-800 text-gray-400 hover:text-white hover:bg-gray-900 text-sm font-bold uppercase tracking-widest transition-all"
                            >
                                저장 안함
                            </button>
                            <button
                                onClick={async () => {
                                    setShowExportSaveModal(false);
                                    
                                    // 1. 현재 탭에 열려있는 계산서들에게 저장 트리거 (메모리 상의 최신 데이터 반영을 위함)
                                    window.dispatchEvent(new Event('kelc_trigger_save'));
                                    
                                    // 2. 일괄 저장 수행 (모든 Draft를 영구 저장소로 이동)
                                    // 약간의 지연을 주어 각 계산서의 kelc_trigger_save 처리가 완료되기를 기다림
                                    await new Promise(resolve => setTimeout(resolve, 300));
                                    await projectService.performBatchSave(projectId);
                                    
                                    // 3. 엑셀 내보내기 실행
                                    handleCombinedExcelExport();
                                }}
                                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold uppercase tracking-widest transition-all shadow-lg shadow-blue-900/20"
                            >
                                저장 후 추출
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Tree Navigation */}
                <div className="lg:col-span-1">
                    <div className="relative bg-black border border-gray-800 sticky top-4 flex flex-col h-[75vh]">
                        <CornerBorders />
                        <div className="flex items-center p-3 border-b border-gray-800 gap-2">
                            <FolderOpen size={16} className="text-blue-500 shrink-0" />
                            <h3 className="text-sm font-bold text-white uppercase tracking-widest truncate" title={project.name}>
                                {project.name}
                            </h3>
                        </div>
                        <div className="flex-1 overflow-y-auto py-2 relative">
                            {enabledCalculators.length > 0 ? (
                                <CalculatorTree
                                    treeData={enabledCalculators}
                                    projectId={projectId}
                                    project={project}
                                    onSelect={handleSelect}
                                    onAddPanel={handleAddPanel}
                                    onUpdate={loadProject}
                                    onDelete={handleOpenDeleteModal}
                                    onDragStart={handleDragStart}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    dragOverId={dragOverId}
                                    expanded={expandedGrid}
                                    setExpanded={setExpandedGrid}
                                    isMultiSelectMode={isMultiSelectMode}
                                    selectedIds={selectedIds}
                                    onToggleSelect={handleToggleSelect}
                                    onEnterMultiSelectMode={handleEnterMultiSelectMode}
                                />
                            ) : (
                                <p className="text-gray-500 text-sm p-4">활성화된 계산서가 없습니다.</p>
                            )}
                        </div>

                        {/* [NEW] 다중 선택 편집 하단 바 (스타일리쉬 & 레드 네온) */}
                        {isMultiSelectMode && (
                            <div className="relative bg-black/60 backdrop-blur-md h-12 flex items-center justify-between px-4 border-t border-red-500/50 z-10 animate-in slide-in-from-bottom-2 duration-300 shadow-[0_-8px_25px_-5px_rgba(239,68,68,0.3)] overflow-hidden shrink-0">
                                {/* Top Edge Glow */}
                                <div className="absolute top-0 left-0 w-full h-[1px] bg-red-400 opacity-50 shadow-[0_0_10px_rgba(239,68,68,0.8)]"></div>
                                
                                {/* 1. Units (Left) */}
                                <div className="flex items-baseline gap-1 shrink-0">
                                    <span className="text-white font-black text-lg drop-shadow-[0_0_5px_rgba(239,68,68,0.5)]">
                                        {selectedIds.length}
                                    </span>
                                    <span className="text-[10px] text-gray-400 font-normal uppercase tracking-tight">Units</span>
                                </div>

                                {/* 2. CANCEL (Center) */}
                                <button 
                                    onClick={handleCancelMultiSelect}
                                    className="px-2 py-1 text-[10px] text-gray-400 hover:text-white transition-colors font-bold uppercase shrink-0"
                                >
                                    CANCEL
                                </button>

                                {/* 3. DELETE (Right) */}
                                <button 
                                    onClick={() => setMultiDeleteModal({ isOpen: true, itemIds: [...selectedIds] })}
                                    disabled={selectedIds.length === 0}
                                    className="px-3 py-1.5 text-[10px] bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-widest rounded shadow-[0_0_15px_rgba(239,68,68,0.3)] disabled:opacity-30 transition-all active:scale-95 shrink-0"
                                >
                                    DELETE
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="lg:col-span-3">
                    <div className="relative bg-black border border-gray-800 min-h-[400px]">
                        <CornerBorders />
                        {selectedItem ? (
                            <div className="p-6">
                                <h2 className="text-lg font-bold text-white mb-4">{selectedItem.name}</h2>
                                <p className="text-gray-400">
                                    이 계산서를 편집하려면 클릭하세요.
                                </p>
                                <div className="mt-4">
                                    <button
                                        onClick={() => {
                                            if (selectedItem.id.startsWith('low-voltage-receiving')) {
                                                navigate(`/project/${projectId}/low-voltage-receiving/${selectedItem.id}`);
                                            } else if (selectedItem.id === 'panel-feeder' || selectedItem.id.startsWith('panel-feeder_')) {
                                                const targetId = selectedItem.id.includes('_') ? selectedItem.id : `${selectedItem.id}_${projectId}`;
                                                navigate(`/project/${projectId}/panel-feeder/${targetId}`);
                                            } else if (selectedItem.id === 'generator' || selectedItem.id.startsWith('generator_')) {
                                                const targetId = selectedItem.id.includes('_') ? selectedItem.id : `${selectedItem.id}_${projectId}`;
                                                navigate(`/project/${projectId}/generator/${targetId}`);
                                            } else if (selectedItem.id.startsWith('visual-')) {
                                                navigate(`/project/${projectId}/visual/${selectedItem.id}`);
                                            } else if (selectedItem.id.startsWith('ups')) {
                                                navigate(`/project/${projectId}/ups/${selectedItem.id}`);
                                            } else {
                                                const isPowerLoad = selectedItem.id.startsWith('power-load-') || selectedItem.id.startsWith('pp-');
                                                navigate(`/project/${projectId}/${isPowerLoad ? 'power-load' : 'panel-load'}/${selectedItem.id}`);
                                            }
                                        }}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold uppercase tracking-widest"
                                    >
                                        계산서 열기
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-[400px] text-gray-500">
                                <div className="text-center">
                                    <FileText size={48} className="mx-auto mb-4 text-gray-700" />
                                    <p>왼쪽 트리에서 계산서를 선택하세요</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 분전반 추가 모달 */}
            <Modal
                isOpen={addPanelModal.isOpen}
                onClose={() => setAddPanelModal({ isOpen: false, calculatorType: null })}
                title={
                    addPanelModal.calculatorType === 'panel-load' ? '분전반 추가' : 
                    addPanelModal.calculatorType === 'transformer' ? '변압기 추가' : 
                    addPanelModal.calculatorType === 'low-voltage-receiving' ? '저압 수전 용량 계산서 추가' :
                    addPanelModal.calculatorType === 'ups' ? 'UPS 추가' : '동력반 추가'
                }
            >
                <div className="mb-4">
                    <label className="block text-xs text-gray-400 mb-2 uppercase tracking-widest">
                        {
                            addPanelModal.calculatorType === 'panel-load' ? '분전반 이름' : 
                            addPanelModal.calculatorType === 'transformer' ? '변압기 이름' : 
                            addPanelModal.calculatorType === 'low-voltage-receiving' ? '계산서 명칭' :
                            addPanelModal.calculatorType === 'ups' ? 'UPS 명칭' : '동력반 이름'
                        }
                    </label>
                    <input
                        type="text"
                        value={newPanelName}
                        onChange={(e) => setNewPanelName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && newPanelName.trim()) {
                                handleConfirmAddPanel();
                            } else if (e.key === 'Escape') {
                                setAddPanelModal({ isOpen: false, calculatorType: null });
                            }
                        }}
                        placeholder={
                            addPanelModal.calculatorType === 'panel-load' ? '예: LP-1층' : 
                            addPanelModal.calculatorType === 'transformer' ? '예: TR-1' : 
                            addPanelModal.calculatorType === 'low-voltage-receiving' ? '예: WHM-1' :
                            addPanelModal.calculatorType === 'ups' ? '예: UPS-전산실(100kVA)' : '예: PP-펌프'
                        }
                        className="w-full bg-gray-900 border border-gray-700 text-white px-4 py-3 text-sm outline-none focus:border-blue-500"
                        autoFocus
                    />
                </div>
                <div className="flex gap-3 justify-end">
                    <button
                        onClick={() => setAddPanelModal({ isOpen: false, calculatorType: null })}
                        className="px-4 py-2 border border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800 text-sm font-bold uppercase tracking-widest transition-colors"
                    >
                        취소
                    </button>
                    <button
                        onClick={handleConfirmAddPanel}
                        disabled={!newPanelName.trim()}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-bold uppercase tracking-widest transition-colors"
                    >
                        추가
                    </button>
                </div>
            </Modal>

            {/* 변압기 타입 선택 모달 */}
            {showTRChoiceModal && (
                <div 
                    className="fixed inset-0 bg-black/80 flex items-center justify-center z-[250]" 
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                        e.stopPropagation();
                        setShowTRChoiceModal(false);
                    }}
                >
                    <div 
                        className="border border-gray-800 bg-black p-6 max-w-sm w-full mx-4 relative shadow-2xl" 
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <CornerBorders />
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="text-white text-sm font-bold uppercase tracking-widest mb-1">변압기 계산서 추가</h3>
                                <p className="text-gray-500 text-[11px]">추가할 계산서의 종류를 선택하세요.</p>
                            </div>
                            <button 
                                onClick={() => setShowTRChoiceModal(false)}
                                className="text-gray-500 hover:text-white transition-colors p-1"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        
                        <div className="flex flex-col gap-3">
                            <button 
                                onClick={() => handleConfirmAddTransformer('main')}
                                className="group relative flex flex-col items-start p-5 border border-gray-800 bg-gray-900/40 hover:bg-blue-600/10 hover:border-blue-500/50 transition-all text-left overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <Layers size={40} className="text-blue-500" />
                                </div>
                                <span className="text-blue-400 text-[10px] font-bold uppercase tracking-tighter mb-1">갑지 (MAIN PAGE)</span>
                                <span className="text-white text-base font-bold mb-1">전기 수용 설비 용량</span>
                                <span className="text-gray-500 text-[11px] leading-relaxed">프로젝트당 1개만 생성 가능한<br/>전체 부하 요약 및 용량 계산서</span>
                            </button>

                            <button 
                                onClick={() => handleConfirmAddTransformer('unit')}
                                className="group relative flex flex-col items-start p-5 border border-gray-800 bg-gray-900/40 hover:bg-yellow-600/10 hover:border-yellow-500/50 transition-all text-left overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <Zap size={40} className="text-yellow-500" />
                                </div>
                                <span className="text-yellow-400 text-[10px] font-bold uppercase tracking-tighter mb-1">을지 (FEEDER SCHEDULE)</span>
                                <span className="text-white text-base font-bold mb-1">변압기 용량 및 간선 계산</span>
                                <span className="text-gray-500 text-[11px] leading-relaxed">개별 변압기 뱅크별<br/>부하 집계 및 간선 굵기 계산서</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <Modal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                title="프로젝트 정보 수정"
            >
                <div className="space-y-3 sm:space-y-4">
                    <div>
                        <label className="block text-[10px] sm:text-xs text-gray-400 mb-1 sm:mb-2 uppercase tracking-widest">프로젝트명</label>
                        <input
                            type="text"
                            value={editFormData.name}
                            onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                            className="w-full bg-gray-900 border border-gray-700 text-white px-3 py-2 sm:px-4 sm:py-3 text-sm outline-none focus:border-blue-500"
                            placeholder="프로젝트명을 입력하세요"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] sm:text-xs text-gray-400 mb-1 sm:mb-2 uppercase tracking-widest">고객사</label>
                        <input
                            type="text"
                            value={editFormData.client}
                            onChange={(e) => setEditFormData({ ...editFormData, client: e.target.value })}
                            className="w-full bg-gray-900 border border-gray-700 text-white px-3 py-2 sm:px-4 sm:py-3 text-sm outline-none focus:border-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] sm:text-xs text-gray-400 mb-1 sm:mb-2 uppercase tracking-widest">일자</label>
                        <input
                            type="date"
                            value={editFormData.date}
                            onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                            className="w-full bg-gray-900 border border-gray-700 text-white px-3 py-2 sm:px-4 sm:py-3 text-sm outline-none focus:border-blue-500 [color-scheme:dark]"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] sm:text-xs text-gray-400 mb-1 sm:mb-2 uppercase tracking-widest">상세 설명</label>
                        <textarea
                            value={editFormData.description}
                            onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                            className="w-full bg-gray-900 border border-gray-700 text-white px-3 py-2 sm:px-4 sm:py-3 text-sm outline-none focus:border-blue-500 h-16 sm:h-20 resize-none"
                        />
                    </div>
                    {/* Calculator Selection Edit */}
                    <div className="pt-3 sm:pt-4 border-t border-gray-800">
                        <label className="block text-[10px] sm:text-xs text-blue-400 mb-1 sm:mb-2 uppercase tracking-widest">계산서 관리 (포함할 계산서 선택)</label>
                        <div className="grid grid-cols-2 gap-2 mt-1 sm:mt-2 max-h-[160px] sm:max-h-[220px] overflow-y-auto pr-2">
                            {(project?.calculators || []).map(calc => {
                                const baseId = calc.id.split('_')[0];
                                const isChecked = editFormData.selectedCalculators.includes(baseId);

                                return (
                                    <div
                                        key={calc.id}
                                        onClick={() => toggleEditCalculator(baseId)}
                                        className={`flex items-center gap-2 sm:gap-3 p-1.5 sm:p-2 border cursor-pointer transition-colors ${isChecked
                                            ? 'bg-blue-500/10 border-blue-500/50'
                                            : 'bg-black border-gray-800 hover:border-gray-700'
                                            }`}
                                    >
                                        <div className={`w-4 h-4 shrink-0 border rounded flex items-center justify-center ${isChecked
                                            ? 'bg-blue-500 border-blue-500'
                                            : 'border-gray-600'
                                            }`}>
                                            {isChecked && <Check size={12} className="text-white" />}
                                        </div>
                                        <div className="flex-1 truncate">
                                            <div className="flex items-center gap-1">
                                                <span className="text-white font-bold text-xs truncate break-all">{calc.name.replace(' 계산서', '')}</span>
                                                {calc.type === 'multiple' && (
                                                    <span className="text-[9px] bg-yellow-500/20 text-yellow-400 px-1 py-0.5 rounded whitespace-nowrap">복수</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
                <div className="flex gap-2 sm:gap-3 justify-end mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-gray-800">
                    <button
                        onClick={() => setIsEditModalOpen(false)}
                        className="px-4 py-2 border border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800 text-sm font-bold uppercase tracking-widest transition-colors"
                    >
                        취소
                    </button>
                    <button
                        onClick={handleUpdateProject}
                        disabled={!editFormData.name.trim()}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-bold uppercase tracking-widest transition-colors"
                    >
                        저장
                    </button>
                </div>
            </Modal>

            {/* 삭제 확인 모달 (패널 삭제) */}
            <DeleteConfirmModal
                isOpen={deleteModal.isOpen}
                onClose={() => setDeleteModal({ isOpen: false, targetItem: null, parentId: null })}
                onConfirm={handleConfirmDelete}
                itemName={deleteModal.targetItem?.name || ''}
            />

            {/* 다중 삭제 확인 모달 */}
            <DeleteConfirmModal
                isOpen={multiDeleteModal.isOpen}
                onClose={() => setMultiDeleteModal({ isOpen: false, itemIds: [] })}
                onConfirm={handleConfirmMultiDelete}
                itemName={`${multiDeleteModal.itemIds.length}개의`}
            />

            {/* 계산서 해제 확인 모달 (데이터 유실 경고) */}
            <Modal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                title="데이터 삭제 경고"
            >
                <div className="py-4">
                    <div className="flex items-start gap-4 text-amber-400 mb-4 transition-all duration-300">
                        <AlertTriangle size={24} className="shrink-0 animate-pulse" />
                        <p className="text-sm leading-relaxed text-gray-200">
                            {confirmModal.message}
                        </p>
                    </div>
                </div>
                <div className="flex gap-3 justify-end mt-4 pt-4 border-t border-gray-800">
                    <button
                        onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                        className="px-4 py-2 bg-green-600 hover:text-white hover:bg-gray-800 text-sm font-bold uppercase tracking-widest transition-colors"
                    >
                        취소
                    </button>
                    <button
                        onClick={confirmModal.onConfirm}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold uppercase tracking-widest transition-colors"
                    >
                        삭제
                    </button>
                </div>
            </Modal>

            {/* [NEW] Excel Bulk Import Modal */}
            {bulkImportModal.isOpen && (
                <ExcelBulkImportModal 
                    isOpen={bulkImportModal.isOpen}
                    projectId={projectId}
                    project={project}
                    targetType={bulkImportModal.calculatorId}
                    onClose={() => setBulkImportModal({ ...bulkImportModal, isOpen: false })}
                    onComplete={() => {
                        setBulkImportModal({ ...bulkImportModal, isOpen: false });
                        loadProject(); // 사이드바 즉시 갱신
                        window.dispatchEvent(new Event('kelc_project_info_updated')); // 헤더 등 타 컴포넌트 갱신
                    }}
                />
            )}

            {/* [NEW] Bulk CAD Export Modal */}
            <BulkCadExportModal 
                isOpen={showBulkCadModal}
                onClose={() => setShowBulkCadModal(false)}
                project={project}
            />



        </div>
    );
};

export default ProjectDashboard;


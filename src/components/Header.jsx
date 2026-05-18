import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { GridIcon, BoxIcon, AnalyticsIcon, WalletIcon, BriefcaseIcon, TrendingUpIcon, GaugeIcon, BarChartIcon, PieChartIcon, SearchIcon, SettingsIcon, FolderIcon } from './icons';
import { ChevronRight, ChevronDown, Folder, FileText, X, FolderOpen, Plus, Save, Copy, Trash2, Edit2, AlertCircle, CheckCircle, Table, Activity, Shield, Zap, ZapOff, Layers, Cable, Ruler, Battery } from 'lucide-react';

import { getProject, setActiveProject, addPanelToProject, updatePanelName, removePanelFromProject, removePanelsFromProject, duplicatePanel, reorderPanels, getRemoteData, setRemoteData, removeRemoteData } from '../services/projectService';
import CalculatorTree from './CalculatorTree/CalculatorTree';
import ExcelBulkImportModal from '../utils/excel/ExcelBulkImportModal'; // [Path Updated]
import useDataStore from '../store/useDataStore';
import ImportPanelModal from './CalculatorTree/ImportPanelModal';
import VersionHistoryModal from './common/VersionHistoryModal';


const CornerBorders = () => (
    <>
        <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-blue-500/50"></div>
        <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-blue-500/50"></div>
        <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-blue-500/50"></div>
        <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-blue-500/50"></div>
    </>
);

/**
 * 프로젝트 내 중복 이름 검사 유틸리티
 */
const isNameDuplicate = (project, name, excludeId = null) => {
    if (!project || !project.calculators) return false;

    const checkInItems = (items) => {
        for (const item of items) {
            // ID가 다르고 이름이 같은 경우 중복으로 간주 (이름 부재 시 안전하게 처리)
            if (item.id !== excludeId && (item.name?.trim() || '') === name.trim()) {
                return true;
            }
            // 하위 항목(children)이 있으면 재귀적으로 검사
            if (item.children && checkInItems(item.children)) {
                return true;
            }
        }
        return false;
    };

    return checkInItems(project.calculators);
};



// Modal Component for Header
const Modal = ({ isOpen, onClose, title, children }) => {
    const backdropRef = useRef(null);
    const [isBackdropTarget, setIsBackdropTarget] = useState(false);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const handleMouseDown = (e) => {
        e.stopPropagation(); // 모달 내부 클릭/드래그가 사이드바 등 부모로 전파되지 않도록 함
        if (e.target === backdropRef.current) {
            setIsBackdropTarget(true);
        } else {
            setIsBackdropTarget(false);
        }
    };

    const handleClick = (e) => {
        e.stopPropagation(); // 모달 배경 클릭이 부모로 전파되어 사이드바가 닫히지 않도록 함
        if (e.target === backdropRef.current && isBackdropTarget) {
            onClose();
        }
        setIsBackdropTarget(false);
    };

    return (
        <div
            ref={backdropRef}
            className="fixed inset-0 z-[8500] flex items-center justify-center bg-black/70"
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

// Dirty Check Modal
const DirtyCheckModal = ({ isOpen, onClose, onSave, onDiscard, message }) => {
    if (!isOpen) return null;

    // Default message for project dirty check
    const defaultMessage = (
        <>
            프로젝트를 닫기 전 저장을 합니다.<br />
            저장하지 않고 이동하시겠습니까?
        </>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="저장 확인">
            <div className="text-gray-300 text-sm mb-6">
                {message || defaultMessage}
            </div>
            <div className="flex gap-3 justify-end">
                <button
                    onClick={onDiscard}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold uppercase tracking-widest transition-colors shadow-lg shadow-red-500/20"
                >
                    저장 안함
                </button>
                <button
                    onClick={onSave}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold uppercase tracking-widest transition-colors"
                >
                    저장 하기
                </button>
            </div>
        </Modal>
    );
};

// Custom Delete Confirmation Modal for Sidebar
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

// Toast Notification Component
const Toast = ({ message, type = 'info', isOpen, onClose }) => {
    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(onClose, 3000);
            return () => clearTimeout(timer);
        }
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const colors = {
        error: 'border-red-500/50 bg-red-500/10 text-red-400',
        success: 'border-green-500/50 bg-green-500/10 text-green-400',
        info: 'border-blue-500/50 bg-blue-500/10 text-blue-400'
    };

    const icons = {
        error: <AlertCircle size={18} />,
        success: <CheckCircle size={18} />,
        info: <AlertCircle size={18} />
    };

    return (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[8600] anim-toast-in">
            <div className={`flex items-center gap-3 px-6 py-4 rounded-xl border backdrop-blur-md shadow-2xl min-w-[320px] ${colors[type] || colors.info}`}>
                <div className="shrink-0">{icons[type]}</div>
                <div className="flex-1 text-sm font-medium tracking-tight whitespace-pre-wrap">{message}</div>
                <button onClick={onClose} className="p-1 hover:brightness-125 opacity-60 hover:opacity-100 transition-all">
                    <X size={16} />
                </button>
            </div>
        </div>
    );
};



// Calculator Tree Drawer Component
const CalculatorTreeDrawer = ({ isOpen, onClose, projectName, projectId, checkDirtyAndNavigate, currentPanelId }) => {
    const navigate = useNavigate();
    const globalActiveProjectId = useDataStore(state => state.activeProjectId); // [NEW] 전역 활성 세션 구독
    const [expanded, setExpanded] = useState({});
    const [calculatorTree, setCalculatorTree] = useState([]);
    const [displayProjectName, setDisplayProjectName] = useState('');
    const [activeProjectId, setActiveProjectId] = useState('');
    const [draggedItem, setDraggedItem] = useState(null);
    const [dragOverId, setDragOverId] = useState(null);
    const [projectData, setProjectData] = useState(null);
    const [deleteModal, setDeleteModal] = useState({ isOpen: false, targetItem: null, parentId: null });
    const [addPanelModal, setAddPanelModal] = useState({ isOpen: false, calculatorType: null });
    const [newPanelName, setNewPanelName] = useState('');
    const sidebarBackdropRef = useRef(null);
    const [isSidebarBackdropTarget, setIsSidebarBackdropTarget] = useState(false);
    const [showTRChoiceModal, setShowTRChoiceModal] = useState(false);
    const [showVisualChoiceModal, setShowVisualChoiceModal] = useState(false);

    // [NEW] 다중 선택 모드 상태
    const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    const [selectionFolderId, setSelectionFolderId] = useState(null);
    const [lastSelectedId, setLastSelectedId] = useState(null);
    const [multiDeleteModal, setMultiDeleteModal] = useState({ isOpen: false, itemIds: [] });

    // [NEW] 일괄 임포트 모달 제어
    const [bulkImportModal, setBulkImportModal] = useState({ isOpen: false, projectId: null, calculatorId: null });

    // Listen for bulk import trigger
    useEffect(() => {
        const handleOpenBulk = (e) => {
            setBulkImportModal({ isOpen: true, projectId: e.detail.projectId, calculatorId: e.detail.calculatorId });
        };
        window.addEventListener('kelc_open_bulk_import', handleOpenBulk);
        return () => window.removeEventListener('kelc_open_bulk_import', handleOpenBulk);
    }, []);

    const loadProjectData = async (pid) => {
        const project = await getProject(pid);
        if (project) {
            setProjectData(project);
            setDisplayProjectName(project.name || '');
            if (project.calculators) {
                const enabledCalcs = project.calculators.filter(c => c.enabled);
                setCalculatorTree([...enabledCalcs]);
            }
        }
    };

    // Prevent background scroll when open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    // Load project data when drawer opens or projectId changes
    useEffect(() => {
        if (isOpen) {
            // [SYNC] 로컬 projectId(URL 기반)가 없으면 전역 activeProjectId를 폴백으로 사용
            const effectivePid = projectId || globalActiveProjectId;
            setActiveProjectId(effectivePid || '');

            if (effectivePid) {
                loadProjectData(effectivePid);
            } else {
                setDisplayProjectName('');
                setCalculatorTree([]);
            }
        }
    }, [isOpen, projectId, globalActiveProjectId]);

    // Listen for project updates while the drawer is open
    useEffect(() => {
        if (isOpen && activeProjectId) {
            const handleUpdate = () => {
                loadProjectData(activeProjectId);
            };
            window.addEventListener('kelc_project_info_updated', handleUpdate);
            return () => window.removeEventListener('kelc_project_info_updated', handleUpdate);
        }
    }, [isOpen, activeProjectId]);

    const handleSelect = (item) => {
        if (activeProjectId) {
            let routeType = '';
            
            // Determine routeType based on ID patterns
            // [STRICT] Low Voltage Receiving must come first to avoid hyphen conflicts
            if (item.id.startsWith('low-voltage-receiving')) {
                routeType = 'low-voltage-receiving';
            } else if (item.id === 'ups' || item.id.startsWith('ups') || item.id.startsWith('ups-')) {
                routeType = 'ups';
            } else if (item.id === 'panel-feeder' || item.id.startsWith('panel-feeder_')) {
                routeType = 'panel-feeder';
            } else if (item.id === 'transformer' || item.id.startsWith('transformer_') || item.id.startsWith('transformer-')) {
                routeType = 'transformer';
            } else if (item.id.startsWith('power-load-') || item.id.startsWith('pp-')) {
                routeType = 'power-load';
            } else if (item.id.startsWith('lp-') || item.id.startsWith('mcc-') || item.id.startsWith('panel-load-')) {
                routeType = 'panel-load';
            } else if (item.id === 'generator' || item.id.startsWith('generator_')) {
                routeType = 'generator';
            } else if (item.id === 'visual' || item.id.startsWith('visual-')) {
                routeType = 'visual';
            }

            if (routeType) {
                // Ensure ID has PROJECT_ID if it's a single type calculator (feeder)
                const isSingleType = ['panel-feeder', 'generator'].includes(routeType);
                const targetId = (isSingleType && !item.id.includes('_')) ? `${item.id}_${activeProjectId}` : item.id;
                const newPath = `/project/${activeProjectId}/${routeType}/${targetId}`;

                // Silent draft save before moving
                const onDraftSaved = () => {
                    window.removeEventListener('kelc_save_draft_finished', onDraftSaved);
                    navigate(newPath);
                };
                window.addEventListener('kelc_save_draft_finished', onDraftSaved);
                window.dispatchEvent(new CustomEvent('kelc_trigger_save_draft'));

                // Safety fallback
                setTimeout(onDraftSaved, 1000);
            }
        } else {
            navigate('/');
        }
        onClose();
    };

    const handleAddPanel = (calculatorType) => {
        if (calculatorType === 'transformer') {
            setShowTRChoiceModal(true);
            return;
        }

        if (calculatorType === 'visual') {
            setShowVisualChoiceModal(true);
            return;
        }

        let defaultName = 'PP-';
        if (calculatorType === 'panel-load') defaultName = 'LP-';
        else if (calculatorType === 'visual') defaultName = '에너지 플로우';
        else if (calculatorType === 'ups') defaultName = 'UPS(-kVA)';
        else if (calculatorType === 'low-voltage-receiving') defaultName = 'WHM';
        
        setNewPanelName(defaultName);
        setAddPanelModal({ isOpen: true, calculatorType });
    };

    const handleConfirmAddPanel = async () => {
        const trimmedName = newPanelName.trim();
        if (!trimmedName || !activeProjectId) return;

        // 중복 검사
        if (isNameDuplicate(projectData, trimmedName)) {
            window.dispatchEvent(new CustomEvent('kelc_show_toast', {
                detail: { message: `'${trimmedName}' 이름은 이미 사용 중입니다.`, type: 'error' }
            }));
            return;
        }

        const result = await addPanelToProject(activeProjectId, addPanelModal.calculatorType, {
            name: trimmedName
        });

        if (result) {
            await loadProjectData(activeProjectId); // Reload tree
            // Notify other components
            window.dispatchEvent(new Event('kelc_project_info_updated'));
        }

        setAddPanelModal({ isOpen: false, calculatorType: null });
        setNewPanelName('');
    };

    const handleConfirmAddTransformer = async (type) => {
        let name = '';
        let idPrefix = '';

        if (type === 'main') {
            // 갑지 중복 체크
            const hasMainPage = projectData.calculators
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
            // 일반 TR 추가는 이름 입력 모달로 보냄
            setNewPanelName('TR-1');
            setAddPanelModal({ 
                isOpen: true, 
                calculatorType: 'transformer', 
                idPrefix: 'transformer' 
            });
            setShowTRChoiceModal(false);
            return;
        }

        const result = await addPanelToProject(activeProjectId, 'transformer', {
            name,
            idPrefix
        });

        if (result) {
            await loadProjectData(activeProjectId);
            window.dispatchEvent(new Event('kelc_project_info_updated'));
        }
        setShowTRChoiceModal(false);
    };

    const handleConfirmAddVisual = async (type) => {
        if (type === 'network') {
            const hasNetworkPage = projectData?.calculators
                ?.find(c => c.id === 'visual')?.children
                ?.some(child => child.id.startsWith('visual-network'));
            
            if (hasNetworkPage) {
                 window.dispatchEvent(new CustomEvent('kelc_show_toast', {
                     detail: { message: '에너지 플로우 화면은 이미 존재합니다.', type: 'error' }
                 }));
                 return;
            }

            const result = await addPanelToProject(activeProjectId, 'visual', {
                name: '에너지 플로우',
                idPrefix: 'visual-network'
            });

            if (result) {
                await loadProjectData(activeProjectId);
                window.dispatchEvent(new Event('kelc_project_info_updated'));
            }
            setShowVisualChoiceModal(false);
        }
    };

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

    const location = useLocation(); // Add hook for current path

    const handleConfirmDelete = async () => {
        if (!deleteModal.targetItem) return;

        // Find adjacent panel to navigate to
        let nextPanelId = null;
        const project = await getProject(activeProjectId);
        if (project) {
            const calculator = project.calculators.find(c => c.id === deleteModal.parentId);
            if (calculator && calculator.children) {
                const currentIndex = calculator.children.findIndex(c => c.id === deleteModal.targetItem.id);
                if (currentIndex !== -1) {
                    if (currentIndex > 0) {
                        nextPanelId = calculator.children[currentIndex - 1].id;
                    } else if (currentIndex === 0 && calculator.children.length > 1) {
                        nextPanelId = calculator.children[currentIndex + 1].id;
                    }
                }
            }
        }

        const result = await removePanelFromProject(activeProjectId, deleteModal.parentId, deleteModal.targetItem.id);
        if (result) {
            // If currently viewing the deleted panel
            if (location.pathname.includes(`/panel-load/${deleteModal.targetItem.id}`)) {
                if (nextPanelId) {
                    navigate(`/project/${activeProjectId}/panel-load/${nextPanelId}`);
                } else {
                    navigate(`/project/${activeProjectId}`);
                }
            }

            await loadProjectData(activeProjectId);
            window.dispatchEvent(new Event('kelc_project_info_updated'));
            window.dispatchEvent(new Event('kelc_project_deleted'));
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

        const project = await getProject(activeProjectId);
        const calculator = project.calculators.find(c => c.id === parentId);
        if (!calculator || !calculator.children) return;

        const newChildren = [...calculator.children];
        const draggedIndex = newChildren.findIndex(p => p.id === draggedItem.item.id);
        const targetIndex = newChildren.findIndex(p => p.id === targetItem.id);

        newChildren.splice(draggedIndex, 1);
        newChildren.splice(targetIndex, 0, draggedItem.item);

        const result = await reorderPanels(activeProjectId, parentId, newChildren);
        if (result) {
            await loadProjectData(activeProjectId);
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
            const folder = projectData?.calculators?.find(c => c.id === selectionFolderId);
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
            // Regular click toggles in multi-select mode
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

        const result = await removePanelsFromProject(activeProjectId, panelItems);
        if (result) {
            await loadProjectData(activeProjectId);
            window.dispatchEvent(new Event('kelc_project_info_updated'));
            window.dispatchEvent(new Event('kelc_project_deleted'));
        }
        
        setMultiDeleteModal({ isOpen: false, itemIds: [] });
        handleCancelMultiSelect();
    };

    // if (!isOpen) return null; // Remove conditional return for animation

    const titleToShow = displayProjectName || projectName || '프로젝트 선택 필요';

    return (
        <div
            className={`fixed inset-0 z-[8100] flex touch-none transition-all duration-300 ${isOpen ? 'visible' : 'invisible'}`}
            onMouseDown={(e) => {
                if (e.target === e.currentTarget || e.target === sidebarBackdropRef.current) {
                    setIsSidebarBackdropTarget(true);
                } else {
                    setIsSidebarBackdropTarget(false);
                }
            }}
            onClick={(e) => {
                if ((e.target === e.currentTarget || e.target === sidebarBackdropRef.current) && isSidebarBackdropTarget) {
                    onClose();
                }
                setIsSidebarBackdropTarget(false);
            }}
        >
            {/* Backdrop */}
            <div
                ref={sidebarBackdropRef}
                className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
            ></div>

            {/* Drawer */}
            <div
                className={`relative w-64 max-w-[80vw] bg-black border-r border-gray-800 h-full overflow-hidden flex flex-col touch-auto transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
                onClick={(e) => e.stopPropagation()}
            >
                <CornerBorders />

                {/* Header */}
                <div className="flex items-center p-4 border-b border-gray-800 gap-3">
                    <FolderOpen size={18} className="text-blue-500 shrink-0" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-widest truncate" title={titleToShow}>
                        {titleToShow}
                    </h3>
                </div>

                {/* Tree Content */}
                <div className="flex-1 overflow-y-auto py-2">
                    <CalculatorTree
                        key={isOpen ? 'sidebar-open' : 'sidebar-closed'}
                        treeData={calculatorTree}
                        projectId={activeProjectId}
                        project={projectData}
                        currentPanelId={currentPanelId}
                        onSelect={handleSelect}
                        onAddPanel={handleAddPanel}
                        onUpdate={() => loadProjectData(activeProjectId)}
                        onDelete={handleOpenDeleteModal}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        dragOverId={dragOverId}
                        expanded={expanded}
                        setExpanded={setExpanded}
                        isMultiSelectMode={isMultiSelectMode}
                        selectedIds={selectedIds}
                        onToggleSelect={handleToggleSelect}
                        onEnterMultiSelectMode={handleEnterMultiSelectMode}
                    />
                </div>

                {/* [NEW] 다중 선택 편집 하단 바 (스타일리쉬 & 레드 네온) */}
                {isMultiSelectMode && (
                    <div className="bg-black/40 backdrop-blur-xl border-t border-red-500/50 px-4 h-14 flex items-center justify-between shadow-[0_-10px_30px_-10px_rgba(239,68,68,0.4)] animate-in slide-in-from-bottom-4 duration-500 relative overflow-hidden">
                        {/* Neon Glow Accent */}
                        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_15px_rgba(239,68,68,1)]"></div>
                        
                        {/* 1. Unit Count (Left) */}
                        <div className="flex items-baseline gap-1 shrink-0">
                            <span className="text-white font-black text-xl drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]">
                                {selectedIds.length}
                            </span>
                            <span className="text-[10px] font-normal text-gray-500 tracking-tight uppercase">Units</span>
                        </div>

                        {/* 2. CANCEL Button (Center) */}
                        <button 
                            onClick={handleCancelMultiSelect}
                            className="px-2 py-1 text-[10px] text-gray-400 hover:text-white transition-colors font-bold uppercase tracking-widest shrink-0"
                        >
                            CANCEL
                        </button>

                        {/* 3. DELETE Button (Right) */}
                        <button 
                            onClick={() => setMultiDeleteModal({ isOpen: true, itemIds: [...selectedIds] })}
                            disabled={selectedIds.length === 0}
                            className="px-3.5 py-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-800 disabled:text-gray-500 text-white font-black text-[10px] uppercase tracking-widest rounded shadow-[0_0_20px_rgba(239,68,68,0.3)] hover:shadow-[0_0_25px_rgba(239,68,68,0.5)] transition-all duration-300 transform active:scale-95 shrink-0"
                        >
                            DELETE
                        </button>
                    </div>
                )}


            </div>

            {/* 분전반 추가 모달 */}
            <Modal
                isOpen={addPanelModal.isOpen}
                onClose={() => setAddPanelModal({ isOpen: false, calculatorType: null })}
                title={
                    addPanelModal.calculatorType === 'panel-load' ? '분전반 추가' : 
                    addPanelModal.calculatorType === 'visual' ? '비주얼라이제이션 추가' :
                    addPanelModal.calculatorType === 'transformer' ? '변압기 추가' : 
                    addPanelModal.calculatorType === 'low-voltage-receiving' ? '저압 수전 용량 계산서 추가' :
                    addPanelModal.calculatorType === 'ups' ? 'UPS 추가' : '동력반 추가'
                }
            >
                <div className="mb-4">
                    <label className="block text-xs text-gray-400 mb-2 uppercase tracking-widest">
                        {
                            addPanelModal.calculatorType === 'panel-load' ? '분전반 이름' : 
                            addPanelModal.calculatorType === 'visual' ? '시각화 화면 이름' :
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
                            addPanelModal.calculatorType === 'visual' ? '예: A동 간선 계통도' :
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

            {/* 삭제 확인 모달 */}
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

            {/* 변압기 선택 모달 */}
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
                                onClick={() => handleConfirmAddTransformer('feeder')}
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

            {/* 비주얼라이제이션 선택 모달 */}
            {showVisualChoiceModal && (
                <div 
                    className="fixed inset-0 bg-black/80 flex items-center justify-center z-[250]" 
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                        e.stopPropagation();
                        setShowVisualChoiceModal(false);
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
                                <h3 className="text-white text-sm font-bold uppercase tracking-widest mb-1">시각화 화면 추가</h3>
                                <p className="text-gray-500 text-[11px]">생성할 데이터 시각화의 종류를 선택하세요.</p>
                            </div>
                            <button 
                                onClick={() => setShowVisualChoiceModal(false)}
                                className="text-gray-500 hover:text-white transition-colors p-1"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        
                        <div className="flex flex-col gap-3">
                            <button 
                                onClick={() => handleConfirmAddVisual('network')}
                                className="group relative flex flex-col items-start p-5 border border-gray-800 bg-gray-900/40 hover:bg-cyan-600/10 hover:border-cyan-500/50 transition-all text-left overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <Activity size={40} className="text-cyan-500" />
                                </div>
                                <span className="text-cyan-400 text-[10px] font-bold uppercase tracking-tighter mb-1">에너지 플로우 (ENERGY FLOW)</span>
                                <span className="text-white text-base font-bold mb-1">전력 계통의 시각화</span>
                                <span className="text-gray-500 text-[11px] leading-relaxed">프로젝트의 전체 혹은 부분적인<br/>부하 연결 계통을 시각화합니다.</span>
                            </button>

                            <button 
                                disabled
                                className="group relative flex flex-col items-start p-5 border border-gray-800 bg-gray-900/20 opacity-60 cursor-not-allowed text-left overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 p-2 opacity-10 transition-opacity">
                                    <PieChartIcon size={40} className="text-purple-500" />
                                </div>
                                <span className="text-purple-400 text-[10px] font-bold uppercase tracking-tighter mb-1">통계 & 차트 (CHARTS)</span>
                                <span className="text-white text-base font-bold mb-1">스마트 부하 통계표</span>
                                <span className="text-gray-500 text-[11px] leading-relaxed">준비 중인 기능입니다.<br/>향후 용량 파이차트를 지원합니다.</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* [NEW] Excel Bulk Import Modal */}
            {bulkImportModal.isOpen && (
                <ExcelBulkImportModal 
                    isOpen={bulkImportModal.isOpen}
                    projectId={activeProjectId}
                    project={projectData}
                    targetType={bulkImportModal.calculatorId}
                    onClose={() => setBulkImportModal({ ...bulkImportModal, isOpen: false })}
                    onComplete={() => {
                        setBulkImportModal({ ...bulkImportModal, isOpen: false });
                        loadProjectData(activeProjectId); // 사이드바 즉시 갱신
                        window.dispatchEvent(new Event('kelc_project_info_updated')); // 헤더 등 타 컴포넌트 갱신
                    }}
                />
            )}
        </div>
    );
};


export const Header = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isTreeDrawerOpen, setIsTreeDrawerOpen] = useState(false);
    const [panelName, setPanelName] = useState('');
    const [projectName, setProjectName] = useState('');
    const [projectId, setProjectId] = useState('');
    const [currentPanelId, setCurrentPanelId] = useState('');
    const [projectPanels, setProjectPanels] = useState([]);
    const [toast, setToast] = useState({ isOpen: false, message: '', type: 'info' });
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [userProfile, setUserProfile] = useState({ username: 'User', profile_image: null });
    const menuRef = useRef(null);
    const buttonRef = useRef(null);
    const location = useLocation();
    const navigate = useNavigate();
    const { broadcastClose, closeProject, listUpdateTrigger } = useDataStore();
    const [safeRedirectModal, setSafeRedirectModal] = useState({ isOpen: false, path: null, isExecuting: false });
    const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);

    // [NEW] 타 프로젝트로부터 가져오기 모달 상태
    const [importModal, setImportModal] = useState({ isOpen: false, calculatorId: null });

    
    // Global Browser-level navigation protection (Save-on-close popup)
    // REMOVED as per user request to fix performance issues with multiple tabs
    /*
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            const isDirty = localStorage.getItem('kelc_project_is_dirty') === 'true';
            if (isDirty) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, []);
    */
    // [NEW] 타 프로젝트로부터 가져오기 이벤트 리스너
    useEffect(() => {
        const handleOpenImport = (e) => {
            setImportModal({ isOpen: true, calculatorId: e.detail.calculatorId });
        };
        window.addEventListener('kelc_open_import_panels', handleOpenImport);
        return () => window.removeEventListener('kelc_open_import_panels', handleOpenImport);
    }, []);


    // Reactive URL Syncing (Source of Truth)
    useEffect(() => {
        const path = location.pathname;
        const projectMatch = path.match(/\/project\/([^\/]+)/);
        
        // If we are definitely NOT in a project context, clear local project state
        // This ensures the sidebar and header don't show "ghost" data from previous projects
        if (!projectMatch && path !== '/project/new' && path.startsWith('/project/')) {
            if (projectId !== '') setProjectId('');
            if (projectName !== '') setProjectName('');
            if (projectPanels.length > 0) setProjectPanels([]);
            return;
        }

        const urlProjectId = (projectMatch && projectMatch[1] !== 'new') ? projectMatch[1] : null;

        // Panel ID extraction (supports various calculator routes)
        const panelMatch = path.match(/\/(?:panel-load|power-load|transformer|receiving-capacity|generator|panel-feeder|visual)\/([^\/]+)/);
        const urlPanelId = panelMatch ? panelMatch[1] : null;

        if (urlProjectId) {
            if (urlProjectId !== projectId) {
                // [CRITICAL GUARD] 주소창을 통한 강제 전환(뒤로가기 등) 시에도 
                // 다른 탭들이 정체된 이전 프로젝트 데이터를 비우도록 선제적으로 알림
                // 현재 실행 중(isExecuting)이라면 이미 확인을 거친 것이므로 중복 방지
                if (projectId !== '' && !safeRedirectModal.isExecuting) {
                    broadcastClose('/');
                }

                setProjectId(urlProjectId);
                
                // Sync with useDataStore if needed (though components should call initProject)
                const fetchAndSync = async () => {
                    const project = await getProject(urlProjectId);
                    if (project) {
                        setProjectName(project.name || '');
                        
                        // Update localStorage for other parts of the system
                        const info = {
                            projectId: urlProjectId,
                            projectName: project.name || '',
                            panelName: panelName // will be updated by local useEffect
                        };
                        localStorage.setItem('kelc_project_info', JSON.stringify(info));
                        localStorage.setItem('kelc_active_project_id', urlProjectId);
                    }
                };
                fetchAndSync();
                loadProjectPanels(urlProjectId);
            }
        } else {
            // URL에 프로젝트 ID가 없는 경우(홈, 프로젝트 목록 등) 상태 초기화
            // 유틸리티 페이지(/xlpe, /setting 등)에서는 프로젝트 상태를 유지하여 
            // 사이드바 트리 접근 및 'Close Project' 버튼을 계속 사용할 수 있게 함
            const pathSegments = path.split('/').filter(Boolean);
            const isUtilityPath = ['xlpe', 'cb', 'ct', 'od', 'rx', 'pl', 'TCC', 'prd', 'gen', 'mcc', 'cubicle', 'setting'].includes(pathSegments[0]);
            const isProjectRelatedPath = path.includes('/project/') || 
                                       ['panel-load', 'power-load', 'transformer', 'panel-feeder', 'generator', 'visual'].some(p => path.includes(p));
            
            if (!isProjectRelatedPath && !isUtilityPath && path !== '/project/new' && path !== '/projects') {
                // 정말로 홈(/)이거나 명시적으로 프로젝트를 떠난 경우에만 초기화
                if (path === '/') {
                    if (projectId !== '') setProjectId('');
                    if (projectName !== '') setProjectName('');
                    if (panelName !== '') setPanelName('');
                    if (projectPanels.length > 0) setProjectPanels([]);
                }
            }
        }

        if (urlPanelId !== currentPanelId) {
            setCurrentPanelId(urlPanelId || '');
        }
    }, [location.pathname, projectId, currentPanelId]);

    // Red Dot State
    const [isProjectDirty, setIsProjectDirty] = useState(false);

    // Monitor global dirty state
    useEffect(() => {
        const checkDirty = () => {
            const dirtyFlag = localStorage.getItem('kelc_project_is_dirty') === 'true';
            const dirtyList = JSON.parse(localStorage.getItem('kelc_dirty_panels') || '[]');
            
            // Flag가 true이거나, Dirty 리스트에 항목이 있으면 빨간 점 표시
            setIsProjectDirty(dirtyFlag || dirtyList.length > 0);
        };

        checkDirty();

        // Listen for storage events (cross-tab) and custom events (same-tab)
        window.addEventListener('storage', checkDirty);
        // [NEW] 명시적인 더티 상태 변경 이벤트 수신 시 즉시 갱신
        window.addEventListener('kelc_dirty_state_changed', checkDirty);
        // [NEW] 저장이 성공적으로 완료되었을 때도 상태 확인
        const handleSaveFinished = (e) => {
            if (e.detail?.success !== false) {
                checkDirty();
            }
        };
        window.addEventListener('kelc_save_finished', handleSaveFinished);

        const interval = setInterval(checkDirty, 1000); // Polling backup as a safety net

        return () => {
            window.removeEventListener('storage', checkDirty);
            window.removeEventListener('kelc_dirty_state_changed', checkDirty);
            window.removeEventListener('kelc_save_finished', handleSaveFinished);
            clearInterval(interval);
        };
    }, []);

    // Toast Listener
    useEffect(() => {
        const handleShowToast = (e) => {
            setToast({
                isOpen: true,
                message: e.detail.message,
                type: e.detail.type || 'info'
            });
        };
        window.addEventListener('kelc_show_toast', handleShowToast);
        return () => window.removeEventListener('kelc_show_toast', handleShowToast);
    }, []);

    // Dirty Check Logic for Header Navigation
    const [dirtyCheckModal, setDirtyCheckModal] = useState({ isOpen: false, pendingAction: null, message: null });

    const getDirtyPanels = () => {
        try {
            return JSON.parse(localStorage.getItem('kelc_dirty_panels') || '[]');
        } catch { return []; }
    };

    const performBatchSave = async () => {
        const dirtyPanels = getDirtyPanels();
        for (const pId of dirtyPanels) {
            const draftKey = `kelc_panel_draft_${pId}`;
            const originKey = `kelc_panel_data_${pId}`;
            try {
                const draftData = await getRemoteData(draftKey);
                if (draftData) {
                    draftData.isDraft = false;
                    await setRemoteData(projectId, originKey, draftData);
                    await removeRemoteData(draftKey);
                }
            } catch (e) { console.error(e); }
        }
        localStorage.setItem('kelc_dirty_panels', '[]');
        localStorage.setItem('kelc_project_is_dirty', 'false');
    };

    const performBatchDiscard = async () => {
        const dirtyPanels = getDirtyPanels();
        for (const pId of dirtyPanels) {
            await removeRemoteData(`kelc_panel_draft_${pId}`);
        }
        localStorage.setItem('kelc_dirty_panels', '[]');
        localStorage.setItem('kelc_project_is_dirty', 'false');
    };

    // Save Confirm Modal
    const [saveConfirmModalOpen, setSaveConfirmModalOpen] = useState(false);

    const checkDirtyAndNavigate = (path) => {
        const isDirty = localStorage.getItem('kelc_project_is_dirty') === 'true';
        const currentPath = location.pathname;

        // Check if leaving MCC or Setting page with unsaved changes
        const isMCCDirty = currentPath === '/mcc' && localStorage.getItem('kelc_mcc_is_dirty') === 'true';
        const isSettingDirty = currentPath === '/setting' && localStorage.getItem('kelc_setting_is_dirty') === 'true';

        // If leaving MCC or Setting page with unsaved changes, show prompt with custom message
        if ((isMCCDirty || isSettingDirty) && path !== currentPath) {
            const pageMessage = (
                <>
                    페이지를 나가기 전 저장을 합니다.<br />
                    저장하지 않고 이동하시겠습니까?
                </>
            );
            setDirtyCheckModal({ isOpen: true, pendingAction: () => navigate(path), message: pageMessage });
            return;
        }

        // Define paths that are safe to navigate to without prompting (references/settings)
        const safePaths = ['/xlpe', '/cb', '/ct', '/od', '/rx', '/prd', '/pl', '/setting', '/mcc', '/projects', '/', '/gen', '/ups', '/TCC'];
        const isSafePath = safePaths.some(p => {
            const lowPath = path.toLowerCase();
            const lowP = p.toLowerCase();
            return lowPath === lowP || lowPath.startsWith(lowP + '/');
        });

        // [STABILITY] 로컬 상태뿐만 아니라 전역(Browser-wide) 활성 프로젝트가 있는지 체크합니다.
        // 이를 통해 리스트 화면(ID가 비어있는 상태)에서도 배지가 있는 프로젝트가 존재하면 시스템이 이를 정확히 인식합니다.
        const activePid = projectId || useDataStore.getState().activeProjectId;

        // For external navigation (Home, Projects list, or other project), show prompt
        // ONLY if it's a completely different project ID and NOT a safe path
        const isExternal = (activePid ? !path.includes(`/project/${activePid}/`) : false) && !isSafePath;

        const proceedToSafeRedirect = (targetPath) => {
            // 정규식을 사용하여 /projects와 실제 프로젝트 경로(/project/ID)를 엄격히 구분
            const isDestinationProject = /^\/project\/[^\/]+/.test(targetPath) && !targetPath.includes('/project/new');
            // [FIX] 기존에 열려있는 프로젝트가 있을 때만 전환 팝업(Transition)을 띄움
            const isSwitchingProject = isDestinationProject && activePid && !targetPath.includes(`/project/${activePid}/`);
            
            // 프로젝트를 완전히 종료하거나(External && activePid), 다른 프로젝트로 전환할 때 팝업 노출
            if ((isExternal && activePid) || isSwitchingProject) {
                setSafeRedirectModal({ isOpen: true, path: targetPath, isExecuting: false });
            } else {
                navigate(targetPath);
            }
        };

        if (isDirty && isExternal) {
            setDirtyCheckModal({ isOpen: true, pendingAction: () => proceedToSafeRedirect(path) });
        } else {
            proceedToSafeRedirect(path);
        }
    };

    const handleConfirmSafeRedirect = () => {
        setSafeRedirectModal(prev => ({ ...prev, isExecuting: true }));
        
        const targetPath = safeRedirectModal.path;

        setTimeout(() => {
            setSafeRedirectModal({ isOpen: false, path: null, isExecuting: false });
            
            // [SYNC] 모든 상태 초기화 및 전파를 스토어 액션으로 일원화
            closeProject(targetPath);
        }, 1000);
    };

    // External Request for Dirty Check Navigation (Project List 등에서 호출)
    useEffect(() => {
        const handleRequestNav = (e) => {
            const { path } = e.detail;
            // [FIX] 기존의 navigate(path)를 우회하던 방식을 버리고 
            // 시스템 중앙 제어 로직인 checkDirtyAndNavigate로 통합
            checkDirtyAndNavigate(path);
        };
        window.addEventListener('kelc_request_dirty_check_nav', handleRequestNav);
        return () => window.removeEventListener('kelc_request_dirty_check_nav', handleRequestNav);
    }, [projectId, location.pathname]); // 의존성 추가하여 최신 상태 유지

    const closeMenu = () => setIsMenuOpen(false);

    const handleSaveAndNavigate = () => {
        const onSaveFinished = (e) => {
            window.removeEventListener('kelc_save_finished', onSaveFinished);
            performBatchSave().then(() => {
                if (dirtyCheckModal.pendingAction) dirtyCheckModal.pendingAction();
                setDirtyCheckModal({ isOpen: false, pendingAction: null });
            });
        };

        window.addEventListener('kelc_save_finished', onSaveFinished);
        window.dispatchEvent(new CustomEvent('kelc_trigger_save'));

        // Safety timeout in case PanelLoad is not responsive
        setTimeout(() => {
            window.removeEventListener('kelc_save_finished', onSaveFinished);
            if (dirtyCheckModal.isOpen) {
                performBatchSave().then(() => {
                    if (dirtyCheckModal.pendingAction) dirtyCheckModal.pendingAction();
                    setDirtyCheckModal({ isOpen: false, pendingAction: null });
                });
            }
        }, 2000);
    };

    const handleDiscardAndNavigate = () => {
        performBatchDiscard();
        if (dirtyCheckModal.pendingAction) dirtyCheckModal.pendingAction();
        setDirtyCheckModal({ isOpen: false, pendingAction: null });
    };

    const handleManualSaveClick = () => {
        setSaveConfirmModalOpen(true);
    };

    const executeManualSave = () => {
        window.dispatchEvent(new CustomEvent('kelc_trigger_save'));
        setTimeout(() => {
            performBatchSave();
            setSaveConfirmModalOpen(false);
        }, 100);
    };

    // Load user profile from server
    const fetchUserProfile = async () => {
        try {
            const response = await fetch('/api/user_profile.php');
            const result = await response.json();
            if (result.status === 'success') {
                setUserProfile(result.data);
            }
        } catch (e) {
            console.error('Failed to fetch user profile:', e);
        }
    };

    // Load project panels list
    const loadProjectPanels = async (pid) => {
        if (!pid || pid === 'new') {
            setProjectPanels([]);
            return;
        }
        try {
            const project = await getProject(pid);
            if (project && project.calculators) {
                const allPanels = [];
                const extractPanels = (items, defaultType = null) => {
                    if (!items) return;
                    items.forEach(item => {
                        let type = defaultType;
                        if (!type) {
                            if (item.id.startsWith('power-load-') || item.id.startsWith('pp-')) {
                                type = 'power';
                            } else if (item.id.startsWith('panel-load-') || item.id.startsWith('lp-') || item.id.startsWith('mcc-')) {
                                type = 'panel';
                            } else if (item.id.includes('load')) {
                                type = 'panel';
                            } else if (item.id.startsWith('visual-')) {
                                type = 'visual';
                            } else if (item.id.startsWith('ups-')) {
                                type = 'ups';
                            }
                        }

                        if (item.id && type) {
                            allPanels.push({ id: item.id, name: item.name, type });
                        }
                        if (item.children) extractPanels(item.children, type);
                    });
                };

                project.calculators.forEach(calc => {
                    if (calc.enabled) {
                        if (calc.id === 'panel-feeder' || calc.id.startsWith('panel-feeder_')) {
                            allPanels.push({ id: calc.id, name: calc.name, type: 'feeder' });
                        } else if (calc.id === 'transformer' || calc.id.startsWith('transformer_')) {
                            if (calc.children && calc.children.length > 0) {
                                extractPanels(calc.children, 'transformer');
                            } else {
                                allPanels.push({ id: calc.id, name: calc.name, type: 'transformer' });
                            }
                        } else if (calc.id === 'panel-load' || calc.id.startsWith('panel-load_')) {
                            extractPanels(calc.children, 'panel');
                        } else if (calc.id === 'power-load' || calc.id.startsWith('power-load_')) {
                            extractPanels(calc.children, 'power');
                        } else if (calc.id === 'generator' || calc.id.startsWith('generator_')) {
                            allPanels.push({ id: calc.id, name: calc.name, type: 'generator' });
                        } else if (calc.id === 'low-voltage-receiving' || calc.id.startsWith('low-voltage-receiving_')) {
                            extractPanels(calc.children, 'low-voltage-receiving');
                        } else if (calc.id === 'ups' || calc.id.startsWith('ups_')) {
                            extractPanels(calc.children, 'ups');
                        } else if (calc.children) {
                            extractPanels(calc.children);
                        }
                    }
                });
                setProjectPanels(allPanels);
            }
        } catch (e) {
            console.error('Failed to load project panels:', e);
        }
    };

    // Load panel name from localStorage
    useEffect(() => {
        const loadPanelName = () => {
            const path = location.pathname;
            // New Project 페이지인 경우 localStorage 동기화 중단 (무한 루프 방지)
            if (path === '/project/new') return;

            // [FIX] 홈 또는 프로젝트 목록 화면에서는 상태를 강제로 비움 (유령 이름 방지)
            const isHome = path === '/' || path === '/projects';
            if (isHome) {
                // [FIX] 리스트 화면 진입 시 이름을 비우되, ID는 유지하여 사이드바 컨텍스트 보존
                if (projectName !== '') setProjectName('');
                if (panelName !== '') setPanelName('');
                return;
            }

            try {
                const saved = localStorage.getItem('kelc_project_info');
                if (saved) {
                    const data = JSON.parse(saved);
                    
                    // 프로젝트 관련 경로이거나 유틸리티 경로일 때만 데이터 동기화
                    const isProjPath = path.includes('/project/') || 
                                     ['panel-load', 'power-load', 'transformer', 'panel-feeder', 'generator', 'visual', 'ups', 'low-voltage-receiving'].some(p => path.includes(p));
                    const pathSegments = path.split('/').filter(Boolean);
                    const isUtilityPath = ['xlpe', 'cb', 'ct', 'od', 'rx', 'pl', 'TCC', 'prd', 'gen', 'mcc', 'cubicle', 'setting'].includes(pathSegments[0]);

                    if (isProjPath || isUtilityPath) {
                        if (panelName !== (data.panelName || '')) setPanelName(data.panelName || '');
                        if (projectName !== (data.projectName || '')) setProjectName(data.projectName || '');

                        if (data.projectId && data.projectId !== projectId) {
                            setProjectId(data.projectId);
                            loadProjectPanels(data.projectId);
                        }
                    }
                }
            } catch (e) {
                console.error('Failed to load panel name:', e);
            }
        };

        loadPanelName();
        fetchUserProfile();

        const handleStorageChange = (e) => {
            if (e.key === 'kelc_project_info') {
                loadPanelName();
            }
        };
        const handleProjectInfoUpdate = () => {
            loadPanelName();
            if (projectId) loadProjectPanels(projectId);
        };

        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('kelc_project_info_updated', handleProjectInfoUpdate);
        window.addEventListener('kelc_panel_name_updated', handleProjectInfoUpdate);
        window.addEventListener('kelc_connections_changed', handleProjectInfoUpdate);
        window.addEventListener('kelc_results_updated', handleProjectInfoUpdate);
        
        const interval = setInterval(loadPanelName, 3000);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('kelc_project_info_updated', handleProjectInfoUpdate);
            window.removeEventListener('kelc_panel_name_updated', handleProjectInfoUpdate);
            window.removeEventListener('kelc_connections_changed', handleProjectInfoUpdate);
            window.removeEventListener('kelc_results_updated', handleProjectInfoUpdate);
            clearInterval(interval);
        };
    }, [projectId]);

    // [CROSS-TAB SYNC] 타 탭에서 패널 이름/구조 변경 시 바로가기 버튼 갱신
    useEffect(() => {
        if (listUpdateTrigger > 0 && projectId) {
            loadProjectPanels(projectId);
        }
    }, [listUpdateTrigger]);

    // Track Last Viewed Calculator Path
    useEffect(() => {
        const path = location.pathname;
        if (path.includes('/panel-load/')) {
            localStorage.setItem('kelc_last_calculator_path', path);
        }
    }, [location.pathname]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target) &&
                buttonRef.current && !buttonRef.current.contains(event.target)) {
                setIsMenuOpen(false);
            }
        };

        const handleKeyDown = (e) => {
            // 입력창(INPUT, TEXTAREA)이나 편집 가능한 요소에서는 단축키가 작동하지 않도록 함
            if (document.activeElement.tagName === 'INPUT' || 
                document.activeElement.tagName === 'TEXTAREA' || 
                document.activeElement.isContentEditable) {
                return;
            }

            const key = e.key.toLowerCase();

            // Open search on '/' if not in an input field
            if (key === '/' && !isSearchOpen) {
                e.preventDefault();
                setIsSearchOpen(true);
            }

            // [NEW] Toggle Sidebar Menu on 'q'
            if (key === 'q') {
                e.preventDefault();
                setIsMenuOpen(prev => !prev);
                if (isTreeDrawerOpen) setIsTreeDrawerOpen(false); // 트리 드로어가 열려있으면 닫음
            }

            // [NEW] Toggle Project Tree Drawer on 't'
            if (key === 't') {
                e.preventDefault();
                setIsTreeDrawerOpen(prev => !prev);
                if (isMenuOpen) setIsMenuOpen(false); // 사이드바 메뉴가 열려있으면 닫음
            }
        };

        document.addEventListener('mousedown', handleClickOutside, true);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside, true);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isSearchOpen]);

    // NavItem moved outside


    // Filter panels for HeaderPanelNav based on current view info
    const isPowerLoadView = location.pathname.includes('/power-load/');
    const isPanelLoadView = location.pathname.includes('/panel-load/');
    const isTransformerView = location.pathname.includes('/transformer/');

    const visiblePanels = useMemo(() => {
        if (isPowerLoadView) return projectPanels.filter(p => p.type === 'power');
        if (isTransformerView) return projectPanels.filter(p => p.type === 'transformer');
        if (isPanelLoadView) return projectPanels.filter(p => p.type === 'panel');
        if (location.pathname.includes('/panel-feeder/')) return projectPanels.filter(p => p.type === 'feeder');
        if (location.pathname.includes('/generator/')) return projectPanels.filter(p => p.type === 'generator');
        if (location.pathname.includes('/visual/')) return projectPanels.filter(p => p.type === 'visual');
        if (location.pathname.includes('/ups/')) return projectPanels.filter(p => p.type === 'ups');
        if (location.pathname.includes('/low-voltage-receiving/')) return projectPanels.filter(p => p.type === 'low-voltage-receiving');
        return [];
    }, [projectPanels, location.pathname, isPowerLoadView, isTransformerView, isPanelLoadView]);

    return (
        <>
            <header className={`relative z-[8000] bg-black border border-gray-900 py-0.5 px-1 ${['/TCC', '/cubicle'].includes(location.pathname) || location.pathname.includes('/visual/') ? '' : 'mb-6'}`}>
                <div className="flex justify-between items-center">
                    <div className="flex flex-1 min-w-0">
                        <div className="flex">
                            <div className="flex items-center p-2 border-r border-gray-900 relative">
                                <button
                                    ref={buttonRef}
                                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                                    className={`p-1.5 transition-colors ${isMenuOpen ? 'text-blue-400 bg-gray-800' : 'text-gray-400 hover:text-white'}`}
                                    title="메뉴 (Q)"
                                >
                                    <GridIcon className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => setIsTreeDrawerOpen(true)}
                                    className={`p-1.5 transition-colors ${isTreeDrawerOpen ? 'text-blue-400 bg-gray-800' : 'text-gray-400 hover:text-white'}`}
                                    title="프로젝트 트리 (T)"
                                >
                                    <BoxIcon className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={handleManualSaveClick}
                                    className="p-1.5 text-gray-400 hover:text-white transition-colors relative group"
                                    title="저장"
                                >
                                    <Save className={`w-5 h-5 ${isProjectDirty ? 'text-white' : ''}`} />
                                    {isProjectDirty && (
                                        <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 ring-2 ring-black animate-pulse" />
                                    )}
                                </button>
                                <button
                                    onClick={() => setIsSearchOpen(true)}
                                    className="p-1.5 text-gray-400 hover:text-white transition-colors"
                                    title="검색 (/)"
                                >
                                    <SearchIcon className="w-5 h-5" />
                                </button>

                                {/* Dropdown Menu */}
                                {isMenuOpen && (
                                    <div
                                        ref={menuRef}
                                        className="absolute top-full left-[-5px] mt-[3px] w-[150px] bg-black border border-gray-800 shadow-xl z-50"
                                    >

                                        <div className="py-1">
                                            <NavItem to="/projects" icon={<FolderIcon className="w-4 h-4" />} label="Projects" onClick={closeMenu} checkDirtyAndNavigate={checkDirtyAndNavigate} location={location} />
                                            <div className="border-t border-gray-800 my-1"></div>
                                            <button
                                                onClick={() => {
                                                    closeMenu();
                                                    const lastPath = localStorage.getItem('kelc_last_calculator_path');
                                                    navigate(lastPath || '/');
                                                }}
                                                className="w-full flex items-center space-x-3 px-4 py-3 text-gray-300 hover:bg-gray-800/50 hover:text-white border-l-2 border-transparent"
                                            >
                                                <GridIcon className="w-4 h-4" />
                                                <span className="text-[11px] uppercase tracking-widest font-bold">Home</span>
                                            </button>
                                            <NavItem to="/xlpe" icon={<Cable className="w-4 h-4" />} label="XLPE" onClick={closeMenu} checkDirtyAndNavigate={checkDirtyAndNavigate} location={location} />
                                            <NavItem to="/cb" icon={<Shield className="w-4 h-4" />} label="CB" onClick={closeMenu} checkDirtyAndNavigate={checkDirtyAndNavigate} location={location} />
                                            <NavItem to="/ct" icon={<PieChartIcon className="w-4 h-4" />} label="CT" onClick={closeMenu} checkDirtyAndNavigate={checkDirtyAndNavigate} location={location} />
                                            <NavItem to="/od" icon={<Ruler className="w-4 h-4" />} label="OD" onClick={closeMenu} checkDirtyAndNavigate={checkDirtyAndNavigate} location={location} />
                                            <NavItem to="/rx" icon={<AnalyticsIcon className="w-4 h-4" />} label="RX" onClick={closeMenu} checkDirtyAndNavigate={checkDirtyAndNavigate} location={location} />
                                            <NavItem to="/pl" icon={<Table className="w-4 h-4" />} label="PL" onClick={closeMenu} checkDirtyAndNavigate={checkDirtyAndNavigate} location={location} />
                                            <NavItem to="/prd" icon={<Zap className="w-4 h-4" />} label="PRD" onClick={closeMenu} checkDirtyAndNavigate={checkDirtyAndNavigate} location={location} />
                                            <NavItem to="/gen" icon={<ZapOff className="w-4 h-4" />} label="GEN" onClick={closeMenu} checkDirtyAndNavigate={checkDirtyAndNavigate} location={location} />
                                            <NavItem to="/ups" icon={<Battery className="w-4 h-4" />} label="UPS" onClick={closeMenu} checkDirtyAndNavigate={checkDirtyAndNavigate} location={location} />
                                            <NavItem to="/mcc" icon={<Layers className="w-4 h-4" />} label="MCC" onClick={closeMenu} checkDirtyAndNavigate={checkDirtyAndNavigate} location={location} />
                                            <NavItem to="/TCC" icon={<Activity className="w-4 h-4" />} label="TCC" onClick={closeMenu} checkDirtyAndNavigate={checkDirtyAndNavigate} location={location} />
                                            <NavItem to="/cubicle" icon={<BoxIcon className="w-4 h-4" />} label="Cubicle" onClick={closeMenu} checkDirtyAndNavigate={checkDirtyAndNavigate} location={location} />
                                            <div className="border-t border-gray-800 mt-1 pt-1">
                                                <NavItem to="/setting" icon={<SettingsIcon className="w-4 h-4" />} label="Setting" onClick={closeMenu} checkDirtyAndNavigate={checkDirtyAndNavigate} location={location} />
                                            </div>
                                            {projectId && (
                                                <div className="border-t border-gray-800 mt-1 pt-1">
                                                    <button
                                                        onClick={() => {
                                                            closeMenu();
                                                            // [FIX] CLOSE 버튼 클릭 시에만 명시적으로 종료 확인 팝업 노출
                                                            if (projectId) {
                                                                setSafeRedirectModal({ isOpen: true, path: '/', isExecuting: false });
                                                            } else {
                                                                navigate('/');
                                                            }
                                                        }}
                                                        className="w-full flex items-center space-x-3 px-4 py-3 text-red-500 hover:bg-red-950/30 transition-colors border-l-2 border-transparent"
                                                    >
                                                        <ZapOff className="w-4 h-4" />
                                                        <span className="text-[11px] uppercase tracking-widest font-bold">Close</span>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center px-3 sm:px-6 border-r border-gray-900 h-full">
                                <h1 className="text-sm font-bold text-white tracking-[0.2em] uppercase whitespace-nowrap">
                                    <span className="inline sm:hidden">KEC Logic</span>
                                    <span className="hidden sm:inline">KEC Logic Calculator</span>
                                </h1>
                            </div>
                        </div>

                        {/* Current Page Indicator / Panel Nav */}
                        <div className="flex items-center ml-4 mr-1 flex-1 min-w-0">
                            <HeaderPanelNav
                                panels={visiblePanels}
                                currentPanelId={location.pathname.split('/').pop()}
                                projectId={projectId}
                                projectName={projectName}
                                checkDirtyAndNavigate={checkDirtyAndNavigate}
                            />
                        </div>
                    </div>

                    <div className="flex items-center h-full">
                        {/* Vertical Divider */}
                        <div className="w-px bg-gray-700 h-8 self-center"></div>
                        {/* Profile Wrapper - Centered between divider and right edge */}
                        <div
                            className="flex items-center justify-center min-w-[64px] h-full cursor-pointer"
                            onClick={() => setIsProfileOpen(true)}
                        >
                            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-500 via-green-500 to-yellow-500 p-[1px] relative overflow-hidden">
                                <div className="absolute -inset-[0.5px] rounded-full bg-gradient-to-tr from-blue-500 via-green-500 to-yellow-500 blur-[0.5px] opacity-50"></div>
                                <div className="w-full h-full rounded-full bg-gray-800 flex items-center justify-center text-[11px] font-bold text-white relative z-10 overflow-hidden">
                                    {userProfile.profile_image ? (
                                        <img src={`/${userProfile.profile_image}`} alt="Profile" className="w-full h-full object-cover" />
                                    ) : (
                                        (userProfile.username || 'U').charAt(0).toUpperCase()
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Calculator Tree Drawer */}
            <CalculatorTreeDrawer
                isOpen={isTreeDrawerOpen}
                onClose={() => setIsTreeDrawerOpen(false)}
                projectName={projectName}
                projectId={projectId}
                checkDirtyAndNavigate={checkDirtyAndNavigate}
                currentPanelId={location.pathname.split('/').pop()}
            />

            {/* Dirty Check Modal for Header Navigation */}
            <DirtyCheckModal
                isOpen={dirtyCheckModal.isOpen}
                onClose={() => setDirtyCheckModal({ isOpen: false, pendingAction: null, message: null })}
                onSave={handleSaveAndNavigate}
                onDiscard={handleDiscardAndNavigate}
                message={dirtyCheckModal.message}
            />

            {/* Project Search Modal */}
            <ProjectSearchModal
                isOpen={isSearchOpen}
                onClose={() => setIsSearchOpen(false)}
                panels={projectPanels}
                projectId={projectId}
                checkDirtyAndNavigate={checkDirtyAndNavigate}
            />

            {/* User Profile Popup */}
            <UserProfilePopup
                isOpen={isProfileOpen}
                onClose={() => setIsProfileOpen(false)}
                onOpenConfig={() => checkDirtyAndNavigate('/setting')}
                onOpenVersionHistory={() => {
                    setIsProfileOpen(false);
                    setIsVersionHistoryOpen(true);
                }}
                userProfile={userProfile}
                onProfileUpdate={fetchUserProfile}
            />

            <VersionHistoryModal 
                isOpen={isVersionHistoryOpen}
                onClose={() => setIsVersionHistoryOpen(false)}
            />

            <Modal
                isOpen={safeRedirectModal.isOpen}
                onClose={() => !safeRedirectModal.isExecuting && setSafeRedirectModal({ isOpen: false, path: null, isExecuting: false })}
                title={projectId ? "프로젝트 종료" : "프로젝트 시작"}
            >
                <div className="flex flex-col items-center py-6">
                    {safeRedirectModal.isExecuting ? (
                        <>
                            <div className="relative mb-8 w-24 h-24 flex items-center justify-center">
                                {/* 외부 회전 링 (로딩 효과) */}
                                <div className="absolute inset-0 border-2 border-dashed border-blue-500/20 rounded-full animate-spin" style={{ animationDuration: '8s' }}></div>
                                <div className="absolute inset-1 border-b-2 border-blue-500 rounded-full animate-spin" style={{ animationDuration: '2s' }}></div>
                                
                                {/* 중앙 빤짝이는 방패 효과 */}
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-16 h-16 bg-emerald-500/10 rounded-full blur-xl animate-pulse"></div>
                                </div>
                                <div className="relative z-10 p-4 bg-black rounded-full border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.3)] anim-glow">
                                    <Shield size={32} className="text-emerald-500" />
                                </div>
                            </div>
                            <h4 className="text-white text-lg font-bold mb-2 tracking-tight">
                                {safeRedirectModal.path === '/' ? '프로젝트를 안전하게 종료하는 중' : '새 프로젝트 세션을 준비하는 중'}
                            </h4>
                            <p className="text-gray-500 text-sm text-center px-4 leading-relaxed">
                                모든 탭의 데이터와 상태를 동기화하고 있습니다.<br/>
                                프리징 방지를 위해 잠시만 기다려 주세요...
                            </p>
                        </>
                    ) : (
                        <>
                            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-6 border border-red-500/20">
                                <AlertCircle size={32} className="text-red-500" />
                            </div>
                            <h4 className="text-white text-lg font-bold mb-2 tracking-tight">프로젝트를 종료하시겠습니까?</h4>
                            <p className="text-gray-500 text-sm text-center px-4 leading-relaxed mb-8">
                                현재 열려있는 프로젝트의 모든 계산 세션이 종료됩니다.<br/>
                                계속하시려면 확인 버튼을 눌러주세요.
                            </p>
                            <div className="flex gap-3 w-full">
                                <button
                                    onClick={() => setSafeRedirectModal({ isOpen: false, path: null, isExecuting: false })}
                                    className="flex-1 px-4 py-3 border border-gray-800 text-gray-400 hover:text-white hover:bg-gray-800 text-xs font-bold uppercase tracking-widest transition-all"
                                >
                                    취소
                                </button>
                                <button
                                    onClick={handleConfirmSafeRedirect}
                                    className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-widest transition-all shadow-lg shadow-blue-500/20"
                                >
                                    확인
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </Modal>

            {/* Manual Save Confirm Modal */}
            <Modal isOpen={saveConfirmModalOpen} onClose={() => setSaveConfirmModalOpen(false)} title="저장 확인">
                <div className="text-gray-300 text-sm mb-6">
                    모든 변경 사항을 저장하시겠습니까?<br />
                    임시 저장된 내용이 확정됩니다
                </div>
                <div className="flex gap-3 justify-end">
                    <button
                        onClick={() => setSaveConfirmModalOpen(false)}
                        className="px-4 py-2 border border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800 text-sm font-bold uppercase tracking-widest transition-colors"
                    >
                        취소
                    </button>
                    <button
                        onClick={executeManualSave}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold uppercase tracking-widest transition-colors"
                    >
                        저장
                    </button>
                </div>
            </Modal>

            {/* Custom Toast System */}
            <Toast
                isOpen={toast.isOpen}
                message={toast.message}
                type={toast.type}
                onClose={() => setToast(prev => ({ ...prev, isOpen: false }))}
            />

            {/* [NEW] 타 프로젝트에서 가져오기 모달 */}
            <ImportPanelModal 
                isOpen={importModal.isOpen}
                onClose={() => setImportModal({ isOpen: false, calculatorId: null })}
                targetProjectId={projectId}
                calculatorId={importModal.calculatorId}
                onUpdate={() => {
                    // 트리 갱신을 위해 전역 알림
                    window.dispatchEvent(new Event('kelc_project_info_updated'));
                }}
            />
        </>
    );
};

// Component to show current page or panel name
const CurrentPageIndicator = ({ panelName, projectName }) => {
    const location = useLocation();

    const getPageInfo = () => {
        const path = location.pathname;

        if (path === '/' && panelName) {
            return { icon: <GridIcon className="w-4 h-4" />, label: panelName };
        }

        const projectLabel = projectName || 'PROJECT';

        if (path === '/' || path === '/projects') return { icon: <FolderIcon className="w-4 h-4" />, label: 'PROJECTS' };
        if (path.startsWith('/project/') && (path.includes('/panel-load/') || path.includes('/power-load/') || path.includes('/panel-feeder/') || path.includes('/transformer/') || path.includes('/ups/') || path.includes('/low-voltage-receiving/')) && panelName) {
            return { icon: <FileText className="w-4 h-4" />, label: panelName };
        }
        if (path.startsWith('/project/') && path.includes('/generator/')) return { icon: <FileText className="w-4 h-4" />, label: '발전기 용량 계산서' };
        if (path.startsWith('/project/') && path.includes('/visual/')) return { icon: <Activity className="w-4 h-4" />, label: '에너지 플로우' };
        if (path.startsWith('/project/') && path.includes('/ups/')) return { icon: <Battery className="w-4 h-4" />, label: 'UPS 용량 계산서' };
        
        if (path.startsWith('/project/')) return { icon: <FolderIcon className="w-4 h-4" />, label: projectLabel };

        switch (path) {
            case '/xlpe': return { icon: <AnalyticsIcon className="w-4 h-4" />, label: 'XLPE' };
            case '/cb': return { icon: <WalletIcon className="w-4 h-4" />, label: 'CB' };
            case '/ct': return { icon: <PieChartIcon className="w-4 h-4" />, label: 'CT' };
            case '/od': return { icon: <BriefcaseIcon className="w-4 h-4" />, label: 'OD' };
            case '/rx': return { icon: <TrendingUpIcon className="w-4 h-4" />, label: 'RX' };
            case '/prd': return { icon: <GaugeIcon className="w-4 h-4" />, label: 'PRD' };
            case '/gen': return { icon: <ZapOff className="w-4 h-4" />, label: 'GEN' };
            case '/ups': return { icon: <Battery className="w-4 h-4" />, label: 'UPS' };
            case '/mcc': return { icon: <Layers className="w-4 h-4" />, label: 'MCC' };
            case '/pl': return { icon: <BarChartIcon className="w-4 h-4" />, label: 'PL' };
            case '/TCC': return { icon: <Activity className="w-4 h-4" />, label: 'TCC' };
            case '/setting': return { icon: <SettingsIcon className="w-4 h-4" />, label: 'SETTING' };
            default: return { icon: <GridIcon className="w-4 h-4" />, label: 'HOME' };
        }
    };

    const { icon, label } = getPageInfo();

    return (
        <div className="flex items-center space-x-2 px-3 py-1.5 bg-blue-600/20 border border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.2)]">
            {icon}
            <span className="text-[12px] uppercase tracking-widest font-bold text-white">{label}</span>
        </div>
    );
};

// New Header Navigation Bar for Panels (PC only)
const HeaderPanelNav = ({ panels, currentPanelId, projectId, projectName, checkDirtyAndNavigate }) => {
    const scrollRef = useRef(null);
    const [showLeftArrow, setShowLeftArrow] = useState(false);
    const [showRightArrow, setShowRightArrow] = useState(false);
    const location = useLocation();
    const isProjectView = location.pathname.includes('/panel-load/') || 
                         location.pathname.includes('/power-load/') || 
                         location.pathname.includes('/panel-feeder/') ||
                         location.pathname.includes('/transformer/') ||
                         location.pathname.includes('/generator/') ||
                         location.pathname.includes('/ups/') ||
                         location.pathname.includes('/low-voltage-receiving/') ||
                         location.pathname.includes('/visual/');

    const checkScroll = useCallback(() => {
        if (scrollRef.current) {
            const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
            const newShowLeft = scrollLeft > 0;
            const newShowRight = scrollLeft + clientWidth < scrollWidth - 1;
            
            setShowLeftArrow(prev => prev !== newShowLeft ? newShowLeft : prev);
            setShowRightArrow(prev => prev !== newShowRight ? newShowRight : prev);
        }
    }, []);

    useEffect(() => {
        checkScroll();
        window.addEventListener('resize', checkScroll);
        return () => window.removeEventListener('resize', checkScroll);
    }, [panels]);

    const isFirstRender = useRef(true);
    const lastScrolledId = useRef(null);

    useEffect(() => {
        const scrollActiveIntoView = () => {
            if (scrollRef.current && panels.length > 0) {
                // 패널 ID가 실제로 바뀌었거나(클릭), 아직 한 번도 스크롤하지 않은 경우(새로고침)에만 실행
                if (lastScrolledId.current === currentPanelId) return;

                const activeItem = scrollRef.current.querySelector(`[data-active="true"]`);
                if (activeItem) {
                    activeItem.scrollIntoView({ 
                        behavior: isFirstRender.current ? 'auto' : 'smooth', 
                        block: 'nearest', 
                        inline: 'center' 
                    });
                    
                    lastScrolledId.current = currentPanelId;
                    if (isFirstRender.current) {
                        isFirstRender.current = false;
                    }
                }
            }
        };

        const timer = setTimeout(scrollActiveIntoView, 100);
        return () => clearTimeout(timer);
    }, [currentPanelId, panels]);

    const scroll = (direction) => {
        if (scrollRef.current) {
            const scrollAmount = 200;
            scrollRef.current.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
        }
    };

    if (!isProjectView || panels.length <= 1) {
        const utilityLinks = [
            { path: '/xlpe', label: 'XLPE', icon: <Cable className="w-3.5 h-3.5" /> },
            { path: '/cb', label: 'CB', icon: <Shield className="w-3.5 h-3.5" /> },
            { path: '/ct', label: 'CT', icon: <PieChartIcon className="w-3.5 h-3.5" /> },
            { path: '/od', label: 'OD', icon: <Ruler className="w-3.5 h-3.5" /> },
            { path: '/rx', label: 'RX', icon: <AnalyticsIcon className="w-3.5 h-3.5" /> },
            { path: '/pl', label: 'PL', icon: <Table className="w-3.5 h-3.5" /> },
            { path: '/prd', label: 'PRD', icon: <Zap className="w-3.5 h-3.5" /> },
            { path: '/gen', label: 'GEN', icon: <ZapOff className="w-3.5 h-3.5" /> },
            { path: '/ups', label: 'UPS', icon: <Battery className="w-3.5 h-3.5" /> },
            { path: '/mcc', label: 'MCC', icon: <Layers className="w-3.5 h-3.5" /> },
            { path: '/TCC', label: 'TCC', icon: <Activity className="w-3.5 h-3.5" /> },
            { path: '/cubicle', label: 'CUBICLE', icon: <BoxIcon className="w-3.5 h-3.5" /> },
            { path: '/setting', label: 'SETTING', icon: <SettingsIcon className="w-3.5 h-3.5" /> }
        ];
        
        const isUtilityView = utilityLinks.some(link => link.path === location.pathname);

        // Show indicator on mobile OR when not in project view
        return (
            <div className="hidden sm:flex w-full items-center">
                {isUtilityView ? (
                    <div className="flex items-center space-x-1 overflow-x-auto scrollbar-hide py-1 px-1">
                        {utilityLinks.map(link => {
                            const isActive = location.pathname === link.path;
                            return (
                                <button
                                    key={link.path}
                                    onClick={() => {
                                        if (!isActive) checkDirtyAndNavigate(link.path);
                                    }}
                                    className={`flex-shrink-0 flex items-center space-x-2 px-3 py-1.5 border transition-all ${isActive
                                        ? 'bg-blue-600/20 border-blue-500 text-white shadow-[0_0_10px_rgba(59,130,246,0.2)]'
                                        : 'bg-gray-900/50 border-gray-800 text-gray-500 hover:border-gray-600 hover:text-gray-300'
                                        }`}
                                >
                                    <span className={isActive ? 'text-blue-400' : 'text-gray-500'}>
                                        {link.icon}
                                    </span>
                                    <span className="text-[12px] uppercase tracking-widest font-bold whitespace-nowrap">{link.label}</span>
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <CurrentPageIndicator 
                        panelName={panels.find(p => p.id === currentPanelId)?.name} 
                        projectName={projectName}
                    />
                )}
            </div>
        );
    }

    return (
        <div className="hidden md:flex items-center group relative w-full px-8">
            {showLeftArrow && (
                <button
                    onClick={() => scroll('left')}
                    className="absolute left-1 z-10 p-1.5 transition-all bg-blue-600/10 border border-blue-500/50 text-blue-400 hover:text-white hover:bg-blue-600/20 hover:scale-110 shadow-[0_0_15px_rgba(59,130,246,0.2)]"
                >
                    <ChevronRight className="rotate-180" size={16} />
                </button>
            )}

            <div
                ref={scrollRef}
                onScroll={checkScroll}
                className="flex items-center space-x-1 overflow-x-auto scrollbar-hide py-1 px-1"
                style={{ scrollBehavior: 'smooth' }}
            >
                {panels.map((panel) => {
                    const isActive = panel.id === currentPanelId;
                    return (
                        <button
                            key={panel.id}
                            data-active={isActive}
                            onClick={() => {
                                if (!isActive) {
                                    let route;
                                    if (panel.type === 'power') route = 'power-load';
                                    else if (panel.type === 'transformer') route = 'transformer';
                                    else if (panel.type === 'generator') route = 'generator';
                                    else if (panel.type === 'ups') route = 'ups';
                                    else if (panel.type === 'low-voltage-receiving') route = 'low-voltage-receiving';
                                    else route = 'panel-load';
                                    checkDirtyAndNavigate(`/project/${projectId}/${route}/${panel.id}`);
                                }
                            }}
                            className={`flex-shrink-0 flex items-center space-x-2 px-3 py-1 border transition-all ${isActive
                                ? 'bg-blue-600/20 border-blue-500 text-white shadow-[0_0_10px_rgba(59,130,246,0.2)]'
                                : 'bg-gray-900/50 border-gray-800 text-gray-500 hover:border-gray-600 hover:text-gray-300'
                                }`}
                        >
                            <FileText size={12} className={isActive ? 'text-blue-400' : 'text-gray-600'} />
                            <span className="text-[12px] uppercase tracking-widest font-bold whitespace-nowrap">{panel.name}</span>
                        </button>
                    );
                })}
            </div>

            {showRightArrow && (
                <button
                    onClick={() => scroll('right')}
                    className="absolute right-1 z-10 p-1.5 transition-all bg-blue-600/10 border border-blue-500/50 text-blue-400 hover:text-white hover:bg-blue-600/20 hover:scale-110 shadow-[0_0_15px_rgba(59,130,246,0.2)]"
                >
                    <ChevronRight size={16} />
                </button>
            )}
        </div>
    );
};

// Extracted NavItem Component to prevent re-creation on render
const NavItem = ({ to, icon, label, onClick, checkDirtyAndNavigate, location }) => {
    const active = location.pathname === to;
    return (
        <button
            onClick={() => {
                if (onClick) onClick();
                checkDirtyAndNavigate(to);
            }}
            className={`w-full flex items-center space-x-3 px-4 py-3 transition-colors ${active ? 'bg-blue-500/20 text-blue-400 border-l-2 border-blue-500' : 'text-gray-300 hover:bg-gray-800/50 hover:text-white border-l-2 border-transparent'}`}
        >
            {icon}
            <span className="text-[11px] uppercase tracking-widest font-bold">{label}</span>
        </button>
    );
};



// User Profile Popup Component
const UserProfilePopup = ({ isOpen, onClose, onOpenConfig, onOpenVersionHistory, userProfile, onProfileUpdate }) => {
    const popupRef = useRef(null);
    const fileInputRef = useRef(null);
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (popupRef.current && !popupRef.current.contains(event.target)) {
                onClose();
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose]);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('profile_image', file);

        setIsUploading(true);
        try {
            const response = await fetch('/api/user_profile.php', {
                method: 'POST',
                body: formData
            });
            const result = await response.json();
            if (result.status === 'success') {
                onProfileUpdate();
            } else {
                alert(result.message || '업로드 실패');
            }
        } catch (error) {
            console.error('Upload Error:', error);
            alert('업로드 중 오류가 발생했습니다.');
        } finally {
            setIsUploading(false);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center sm:items-start sm:justify-end sm:pt-16 sm:pr-4">
            {/* Backdrop for mobile */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm sm:hidden" onClick={onClose}></div>

            <div
                ref={popupRef}
                className="bg-black border-2 border-gray-800 rounded-[28px] p-6 w-[320px] max-w-full shadow-2xl flex flex-col items-center relative anim-fade-in mx-4 sm:mx-0 z-10"
            >
                <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-blue-500/30 rounded-tl-[28px]"></div>
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-blue-500/30 rounded-br-[28px]"></div>

                {/* Profile Avatar with Ring */}
                <div className="relative mb-6 mt-4 group">
                    <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-blue-500 via-green-500 to-yellow-500 opacity-70 blur-[2px]"></div>
                    <div
                        className="rounded-full overflow-hidden border-4 border-black relative z-10 bg-gray-800 flex items-center justify-center"
                        style={{ width: '129px', height: '129px' }}
                    >
                        {userProfile.profile_image ? (
                            <img src={`/${userProfile.profile_image}`} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-5xl font-bold text-white">{(userProfile.username || 'U').charAt(0).toUpperCase()}</span>
                        )}

                        {/* Loading Overlay */}
                        {isUploading && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20">
                                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        )}
                    </div>

                    {/* Camera Button */}
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute bottom-0 right-0 z-20 bg-black border border-gray-700 rounded-full p-2 text-blue-400 hover:text-white hover:bg-gray-800 transition-all shadow-lg"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            <circle cx="12" cy="13" r="3" strokeWidth="2" />
                        </svg>
                    </button>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                </div>

                <div className="hidden sm:block">
                    <div className="text-xl text-white font-medium mb-1">Hello, <span className="text-blue-400">{userProfile.username || 'User'}</span>!</div>
                    <button 
                        onClick={onOpenVersionHistory}
                        className="text-xs text-gray-500 mb-8 uppercase tracking-widest hover:text-blue-400 transition-colors cursor-pointer border-b border-transparent hover:border-blue-400/30 pb-0.5"
                    >
                        KEC Logic Calculator
                    </button>
                </div>

                {/* Actions */}
                <div className="w-full space-y-3">
                    <button
                        onClick={onOpenConfig}
                        className="w-full bg-gray-900 border border-gray-800 rounded-full py-3 px-6 text-sm font-bold text-gray-300 hover:text-white hover:border-gray-600 transition-all flex items-center justify-between group"
                    >
                        <span>Manage Account</span>
                        <SettingsIcon className="w-4 h-4 text-gray-500 group-hover:text-blue-400" />
                    </button>

                    <button
                        onClick={onClose}
                        className="w-full border border-gray-800 rounded-full py-3 px-6 text-xs font-bold text-gray-500 hover:text-gray-300 transition-all uppercase tracking-widest"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

// Project Search Modal (Command Palette)
const ProjectSearchModal = ({ isOpen, onClose, panels, projectId, checkDirtyAndNavigate }) => {
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef(null);

    // Static page shortcuts for direct navigation
    const staticPages = useMemo(() => [
        { id: '_page_setting', name: 'Setting', type: '_page', path: '/setting', aliases: ['setting'], icon: 'settings' },
        { id: '_page_mcc', name: 'MCC', type: '_page', path: '/mcc', aliases: ['semcc', 'mcc', 'se'], icon: 'table' },
        { id: '_page_tcc', name: 'TCC', type: '_page', path: '/TCC', aliases: ['setcc', 'tcc', 'se'], icon: 'activity' },
        { id: '_page_prd', name: 'PRD', type: '_page', path: '/prd', aliases: ['seprd', 'prd', 'se'], icon: 'zap' },
        { id: '_page_gen', name: 'GEN', type: '_page', path: '/gen', aliases: ['segen', 'gen', 'se'], icon: 'zap-off' },
        { id: '_page_ups', name: 'UPS', type: '_page', path: '/ups', aliases: ['seups', 'ups', 'se'], icon: 'battery' },
        { id: '_page_ct', name: 'CT', type: '_page', path: '/ct', aliases: ['ct'], icon: 'pie-chart' },
    ], []);

    // Filter results based on fuzzy scoring
    const results = useMemo(() => {
        if (!query.trim()) {
            const feeder = panels.find(p => p.type === 'feeder');
            const otherPanels = panels.filter(p => p.type !== 'feeder');
            return feeder ? [feeder, ...otherPanels].slice(0, 8) : panels.slice(0, 8);
        }

        const lowerQuery = query.toLowerCase();

        // Score panels
        const panelResults = panels.map(panel => {
            let score = 0;
            const lowerName = panel.name.toLowerCase();

            if (lowerName === lowerQuery) score += 100;
            else if (lowerName.startsWith(lowerQuery)) score += 50;
            else if (lowerName.includes(lowerQuery)) score += 10;

            return { item: panel, score };
        });

        // Score static pages (match by name or aliases)
        const pageResults = staticPages.map(page => {
            let score = 0;
            const lowerName = page.name.toLowerCase();

            if (lowerName === lowerQuery) score += 100;
            else if (lowerName.startsWith(lowerQuery)) score += 50;
            else if (lowerName.includes(lowerQuery)) score += 10;

            // Also match aliases
            for (const alias of page.aliases) {
                if (alias === lowerQuery) { score = Math.max(score, 100); break; }
                else if (alias.startsWith(lowerQuery)) score = Math.max(score, 50);
                else if (alias.includes(lowerQuery)) score = Math.max(score, 10);
            }

            return { item: page, score };
        });

        return [...panelResults, ...pageResults]
            .filter(res => res.score > 0)
            .sort((a, b) => b.score - a.score)
            .map(res => res.item)
            .slice(0, 10);
    }, [query, panels, staticPages]);

    useEffect(() => {
        if (isOpen) {
            setSelectedIndex(0);
            setQuery('');
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!isOpen) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => (results.length > 0 ? (prev + 1) % results.length : 0));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => (results.length > 0 ? (prev - 1 + results.length) % results.length : 0));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (results[selectedIndex]) {
                    handleSelect(results[selectedIndex]);
                }
            } else if (e.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, results, selectedIndex]);

    const handleSelect = (panel) => {
        // Handle static page navigation
        if (panel.type === '_page') {
            checkDirtyAndNavigate(panel.path);
            onClose();
            return;
        }

        let route;
        if (panel.type === 'feeder') route = 'panel-feeder';
        else if (panel.type === 'power') route = 'power-load';
        else if (panel.type === 'transformer') route = 'transformer';
        else if (panel.type === 'generator') route = 'generator';
        else if (panel.type === 'ups') route = 'ups';
        else if (panel.type === 'low-voltage-receiving') route = 'low-voltage-receiving';
        else route = 'panel-load';

        checkDirtyAndNavigate(`/project/${projectId}/${route}/${panel.id}`);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[10000] flex items-start justify-center pt-[10vh] md:pt-[15vh] px-6 md:px-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-sm md:max-w-2xl bg-black border border-gray-800 shadow-2xl overflow-hidden anim-fade-in mx-auto">
                {/* Search Input */}
                <div className="flex items-center px-3 md:px-4 py-3 md:py-4 border-b border-gray-800">
                    <SearchIcon className="w-5 h-5 text-gray-500 mr-2 md:mr-3 shrink-0" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search For The Panel..."
                        className="flex-1 bg-transparent border-none outline-none text-white text-base md:text-lg placeholder-gray-600 min-w-0"
                    />
                    <div className="flex items-center space-x-1 ml-2 shrink-0">
                        <kbd className="hidden sm:inline-block px-1.5 py-0.5 bg-gray-900 border border-gray-800 rounded text-[10px] text-gray-400 font-sans">ESC</kbd>
                    </div>
                </div>

                {/* Results List */}
                <div className="max-h-[50vh] md:max-h-[60vh] overflow-y-auto scrollbar-hide">
                    {results.length > 0 ? (
                        <div className="py-2">
                            {results.map((panel, index) => {
                                // Determine icon for static pages
                                let itemIcon = <FileText size={18} />;
                                let itemSubLabel = panel.type === 'feeder' ? 'Panel Feeder Calculator' : 'Panel Load Calculator';
                                if (panel.type === '_page') {
                                    if (panel.icon === 'settings') itemIcon = <SettingsIcon size={18} />;
                                    else if (panel.icon === 'table') itemIcon = <Table size={18} />;
                                    else if (panel.icon === 'activity') itemIcon = <Activity size={18} />;
                                    else if (panel.icon === 'zap') itemIcon = <Zap size={18} />;
                                    else if (panel.icon === 'zap-off') itemIcon = <ZapOff size={18} />;
                                    else if (panel.icon === 'battery') itemIcon = <Battery size={18} />;
                                    itemSubLabel = 'Page Navigation';
                                }

                                return (
                                    <button
                                        key={panel.id}
                                        onClick={() => handleSelect(panel)}
                                        onMouseEnter={() => setSelectedIndex(index)}
                                        className={`w-full flex items-center px-3 md:px-4 py-3 text-left transition-colors ${index === selectedIndex ? 'bg-blue-600/10 border-l-2 border-blue-500' : 'border-l-2 border-transparent'
                                            }`}
                                    >
                                        <div className={`p-2 rounded-lg mr-3 md:mr-4 shrink-0 ${index === selectedIndex ? 'bg-blue-500 text-white' : 'bg-gray-800 text-gray-500'}`}>
                                            {itemIcon}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <span className={`font-bold block truncate text-sm md:text-base ${index === selectedIndex ? 'text-white' : 'text-gray-300'}`}>
                                                {panel.name}
                                            </span>
                                            <span className="text-[10px] text-gray-600 uppercase tracking-widest leading-none block truncate">
                                                {itemSubLabel}
                                            </span>
                                        </div>
                                        {index === selectedIndex && (
                                            <div className="hidden sm:block text-[10px] text-gray-500 font-bold uppercase tracking-widest shrink-0 ml-2">
                                                Select Enter
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="py-8 md:py-12 text-center text-gray-600 px-4">
                            <SearchIcon size={40} className="mx-auto mb-4 opacity-10" />
                            <p className="text-sm italic break-all">"{query}"에 대한 검색 결과가 없습니다</p>
                        </div>
                    )}
                </div>

                {/* Footer Tips */}
                <div className="px-3 md:px-4 py-2 bg-gray-950 border-t border-gray-900 flex justify-between text-[8px] md:text-[9px] text-gray-600 font-bold uppercase tracking-widest">
                    <div className="flex items-center space-x-2 md:space-x-4">
                        <span className="whitespace-nowrap">↑↓ Navigate</span>
                        <span className="whitespace-nowrap">Enter Select</span>
                    </div>
                    <span className="hidden sm:inline-block">Project Panel Search</span>
                </div>
            </div>
        </div>
    );
};

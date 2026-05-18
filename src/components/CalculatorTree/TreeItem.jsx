import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Folder, FileText, Plus, Edit2, Copy, Trash2, Layers, Check, Square, Zap, Database } from 'lucide-react';
import TreeContextMenu from './TreeContextMenu';
import { updatePanelName, duplicatePanel } from '../../services/projectService';

/**
 * 프로젝트 내 중복 이름 검사 유틸리티
 */
const isNameDuplicate = (project, name, excludeId = null) => {
    if (!project || !project.calculators) return false;
    const checkInItems = (items) => {
        for (const item of items) {
            if (item.id !== excludeId && (item.name?.trim() || '') === name.trim()) return true;
            if (item.children && checkInItems(item.children)) return true;
        }
        return false;
    };
    return checkInItems(project.calculators);
};

const TreeItem = ({ 
    item, 
    level = 0, 
    onSelect, 
    expanded = {}, 
    setExpanded, 
    onAddPanel, 
    projectId, 
    onUpdate, 
    parentId, 
    onDragStart, 
    onDragOver, 
    onDragLeave, 
    onDrop, 
    dragOverId, 
    onDelete, 
    project, 
    currentPanelId,
    // [NEW] 다중 선택 관련 Props
    isMultiSelectMode = false,
    selectedIds = [],
    onToggleSelect,
    onEnterMultiSelectMode
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(item.name);
    const [contextMenu, setContextMenu] = useState(null);

    const hasChildren = item.children && item.children.length > 0;
    const isMultiple = item.type === 'multiple';
    const isExpanded = expanded[item.id] !== false; // 기본값: 확장됨
    const isLeaf = !hasChildren && !isMultiple;
    const isDragOver = dragOverId === item.id;
    const isSelected = selectedIds.includes(item.id);

    const toggleExpand = () => {
        if (setExpanded) {
            setExpanded(prev => ({ ...prev, [item.id]: !isExpanded }));
        }
    };

    const handleContextMenu = (e) => {
        // 다중 선택 모드일 때는 우클릭 메뉴를 막음 (선택에 집중)
        if (isMultiSelectMode) return;

        // [NEW] 분전반 간선, 발전기 등 단일 항목은 우클릭 메뉴 비활성화
        const isSingleType = 
            item.id.startsWith('panel-feeder') || 
            item.id.startsWith('generator') || 
            item.id.startsWith('tray');

        if (isSingleType) return;

        const isTargetFolder = item.id === 'panel-load' || item.id === 'power-load';
        if (!isLeaf && !isTargetFolder) return;

        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY });
    };

    const handleRenameSubmit = async () => {
        const trimmedName = editName.trim();
        if (trimmedName && trimmedName !== item.name) {
            if (isNameDuplicate(project, trimmedName, item.id)) {
                window.dispatchEvent(new CustomEvent('kelc_show_toast', {
                    detail: { message: `'${trimmedName}' 이름은 이미 사용 중입니다.`, type: 'error' }
                }));
                // [FIX] 중복일 경우 원래 이름으로 복구하고 편집 모드 종료 (사용자 요청 반영)
                setEditName(item.name);
                setIsEditing(false);
                return;
            }
            const result = await updatePanelName(projectId, item.id, trimmedName);
            if (result) {
                onUpdate();
                window.dispatchEvent(new CustomEvent('kelc_panel_name_updated', {
                    detail: { panelId: item.id, newName: trimmedName }
                }));
                window.dispatchEvent(new Event('kelc_project_info_updated'));
            }
        }
        setIsEditing(false);
    };

    const handleDuplicate = async () => {
        const result = await duplicatePanel(projectId, parentId, item.id);
        if (result) {
            onUpdate();
            window.dispatchEvent(new Event('kelc_project_info_updated'));
        }
    };

    return (
        <div
            draggable={isLeaf && !isMultiSelectMode}
            onDragStart={(e) => isLeaf && !isMultiSelectMode && onDragStart(e, item, parentId)}
            onDragOver={(e) => isLeaf && !isMultiSelectMode && onDragOver(e, item, parentId)}
            onDragLeave={(e) => isLeaf && !isMultiSelectMode && onDragLeave(e, item, parentId)}
            onDrop={(e) => isLeaf && !isMultiSelectMode && onDrop(e, item, parentId)}
            className={`${isLeaf && !isMultiSelectMode ? 'cursor-grab active:cursor-grabbing' : ''}`}
        >
            <div
                className={`flex items-center ${isMultiSelectMode ? 'gap-1' : 'gap-2'} py-2 px-3 hover:bg-gray-800/50 cursor-pointer transition-colors group relative ${isDragOver ? 'border-b-2 border-blue-500' : ''} ${isSelected ? 'bg-blue-500/10' : ''}`}
                style={{ paddingLeft: `${level * 16 + 12}px` }}
                onClick={(event) => {
                    if (isMultiSelectMode) {
                        if (isLeaf) onToggleSelect(item.id, event);
                        return;
                    }
                    if (hasChildren || isMultiple) {
                        toggleExpand();
                    } else if (!isEditing) {
                        onSelect(item, parentId);
                    }
                }}
                onContextMenu={handleContextMenu}
            >
                {/* Checkbox for Multi-select (Only for leaf nodes) */}
                {isMultiSelectMode && isLeaf && (
                    <div 
                        className={`w-2.5 h-2.5 shrink-0 flex items-center justify-center rounded-[2px] border transition-all duration-200 ${isSelected ? 'bg-red-600 border-red-500 text-white shadow-[0_0_8px_rgba(239,68,68,0.4)]' : 'border-gray-600 text-transparent'}`}
                    >
                        <Check size={8} className={isSelected ? 'opacity-100 scale-100' : 'opacity-0 scale-50 transition-all'} />
                    </div>
                )}

                {/* Expand/Collapse Icon */}
                {(hasChildren || isMultiple) ? (
                    <span className="text-gray-500">
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                ) : (
                    <span className="w-[14px]"></span>
                )}

                {/* Icon */}
                {(hasChildren || isMultiple) ? (
                    <Folder size={14} className="text-yellow-500" />
                ) : (
                    <FileText size={14} className="text-blue-400" />
                )}

                {/* Label / Input */}
                {isEditing ? (
                    <input
                        autoFocus
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={handleRenameSubmit}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                handleRenameSubmit();
                            } else if (e.key === 'Escape') {
                                setEditName(item.name);
                                setIsEditing(false);
                            }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="text-sm bg-transparent border-none text-white px-0 py-0 outline-none flex-1 font-sans"
                    />
                ) : (
                    <span className={`text-sm flex-1 truncate ${item.id === currentPanelId ? 'text-white font-bold' : 'text-gray-300 group-hover:text-white'}`}>
                        {item.name}
                    </span>
                 )}

                {/* Add button for multiple type (Hide in multi-select mode) */}
                {isMultiple && !isMultiSelectMode && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onAddPanel) onAddPanel(item.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-700 rounded transition-all"
                    >
                        <Plus size={12} className="text-gray-400" />
                    </button>
                )}
            </div>

            {/* Children */}
            {isExpanded && hasChildren && (
                <div>
                    {item.children.map(child => (
                        <TreeItem
                            key={child.id}
                            item={child}
                            level={level + 1}
                            onSelect={onSelect}
                            expanded={expanded}
                            setExpanded={setExpanded}
                            onAddPanel={onAddPanel}
                            projectId={projectId}
                            onUpdate={onUpdate}
                            parentId={item.id}
                            onDragStart={onDragStart}
                            onDragOver={onDragOver}
                            onDragLeave={onDragLeave}
                            onDrop={onDrop}
                            dragOverId={dragOverId}
                            onDelete={onDelete}
                            project={project}
                            currentPanelId={currentPanelId}
                            isMultiSelectMode={isMultiSelectMode}
                            selectedIds={selectedIds}
                            onToggleSelect={onToggleSelect}
                        />
                    ))}
                </div>
            )}

            {/* Context Menu Instance */}
            {contextMenu && (
                <TreeContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    title={item.name}
                    onClose={() => setContextMenu(null)}
                    items={[
                        ...(isLeaf ? [
                            // 1. 이름 변경 (비주얼, 변압기 갑지 제외)
                            ...(parentId === 'visual' || item.id.startsWith('visual-') || item.id.startsWith('transformer-main-') ? [] : [
                                { label: '이름 변경', icon: <Edit2 size={14} />, onClick: () => setIsEditing(true) },
                            ]),
                            // 2. 복제 (비주얼, 모든 변압기, UPS 패널 제외)
                            ...(parentId === 'visual' || item.id.startsWith('visual-') || item.id.startsWith('transformer') || parentId === 'ups' || item.id.startsWith('ups') ? [] : [
                                { label: '복제', icon: <Copy size={14} />, onClick: handleDuplicate },
                            ]),
                            // 에너지 밴드 (Visual Context) - 변압기 포함 모든 부하 계통 지원 (UPS 제외)
                            ...(parentId === 'visual' || item.id.startsWith('visual-') || parentId === 'ups' || item.id.startsWith('ups') ? [] : [
                                { label: '에너지 밴드', icon: <Zap size={14} className="text-amber-400" />, onClick: () => {
                                    window.dispatchEvent(new CustomEvent('kelc_open_energy_band', { detail: { panelId: item.id } }));
                                }},
                            ]),
                            // 4. 삭제 (공통)
                            { label: '삭제', icon: <Trash2 size={14} />, variant: 'danger', onClick: () => onDelete(item, parentId) },
                        ] : [
                            // 폴더 전용 메뉴
                            ...(item.id === 'panel-load' || item.id === 'power-load' ? [
                                { 
                                    label: '엑셀 가져오기', 
                                    icon: <Layers size={14} className="text-green-500" />, 
                                    onClick: () => window.dispatchEvent(new CustomEvent('kelc_open_bulk_import', { detail: { projectId, calculatorId: item.id } }))
                                },
                                // [수정] 모바일(768px 미만)에서는 편입 기능 제외
                                ...(window.innerWidth >= 768 ? [{
                                    label: '편입 시키기',
                                    icon: <Database size={14} className="text-blue-500" />,
                                    onClick: () => window.dispatchEvent(new CustomEvent('kelc_open_import_panels', { detail: { calculatorId: item.id } }))
                                }] : []),
                                {
                                    label: '다중 삭제',
                                    icon: <Trash2 size={14} className="text-gray-400" />,
                                    onClick: () => onEnterMultiSelectMode && onEnterMultiSelectMode(item.id)
                                }
                            ] : [])
                        ])
                    ]}
                />
            )}
        </div>
    );
};

export default TreeItem;

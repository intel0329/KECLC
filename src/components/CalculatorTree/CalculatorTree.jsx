import React from 'react';
import TreeItem from './TreeItem';

/**
 * 계산서 트리 메인 컴포넌트
 * 데이터 배열을 받아 재귀적으로 TreeItem을 렌더링합니다.
 */

const CalculatorTree = ({
    treeData = [],
    projectId,
    project,
    currentPanelId,
    onSelect,
    onAddPanel,
    onUpdate,
    onDelete,
    onDragStart,
    onDragOver,
    onDragLeave,
    onDrop,
    dragOverId,
    expanded,
    setExpanded,
    
    // 다중 선택 관련 Props
    isMultiSelectMode = false,
    selectedIds = [],
    onToggleSelect,
    onEnterMultiSelectMode
}) => {
    if (!treeData || treeData.length === 0) {
        return (
            <div className="py-8 text-center">
                <p className="text-gray-500 text-xs italic font-sans tracking-wide">표시할 계산서가 없습니다.</p>
            </div>
        );
    }

    return (
        <div className="space-y-0.5 select-none" onContextMenu={(e) => e.preventDefault()}>
            {treeData.map((item) => (
                <TreeItem
                    key={item.id}
                    item={item}
                    projectId={projectId}
                    project={project}
                    currentPanelId={currentPanelId}
                    onSelect={onSelect}
                    onAddPanel={onAddPanel}
                    onUpdate={onUpdate}
                    onDelete={onDelete}
                    onDragStart={onDragStart}
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onDrop={onDrop}
                    dragOverId={dragOverId}
                    expanded={expanded}
                    setExpanded={setExpanded}
                    isMultiSelectMode={isMultiSelectMode}
                    selectedIds={selectedIds}
                    onToggleSelect={onToggleSelect}
                    onEnterMultiSelectMode={onEnterMultiSelectMode}
                />
            ))}
        </div>
    );
};

export default CalculatorTree;

/**
 * Feeder Grouping Logic Utility
 */

/**
 * 프로젝트의 계통(Panel Connections) 정보를 바탕으로 트리 구조를 생성합니다.
 */
export const buildHierarchyTree = (panels, panelParents) => {
    const tree = {};
    const roots = [];

    // All panel IDs
    const allIds = panels.map(p => p.id);

    // 조상(부모)이 프로젝트 내 패널 목록에 없는 경우를 Root로 간주
    allIds.forEach(id => {
        const parentId = panelParents[id];
        if (!parentId || !allIds.includes(parentId)) {
            roots.push(id);
        }
    });

    const buildNode = (id) => {
        const children = Object.keys(panelParents).filter(childId => panelParents[childId] === id && allIds.includes(childId));
        return {
            id,
            children: children.map(buildNode)
        };
    };

    return roots.map(buildNode);
};

/**
 * 계통 트리를 DFS 순회하며 피더 행의 최적 순서를 결정합니다.
 */
const getOrderedIds = (nodes) => {
    let result = [];
    nodes.forEach(node => {
        result.push(node.id);
        if (node.children && node.children.length > 0) {
            result = [...result, ...getOrderedIds(node.children)];
        }
    });
    return result;
};

/**
 * 에너지 플로우의 계통 구조를 기반으로 간선계산서를 재배치합니다.
 * 기준점: 변압기(Transformer)로부터 직접 연결되는 첫 번째 노드들을 그룹화의 핵심 'Anchor'로 사용합니다.
 */
export const syncHierarchyAndReorder = (currentFeeders, allPanels, panelParents, getNameById) => {
    const allIds = allPanels.map(p => p.id);
    
    // 1. 변압기 및 저압 수전 용량 계산서 노드 탐색 (원천 노드)
    const sourceIds = allPanels.filter(p => p.type === 'transformer' || p.type === 'low-voltage-receiving').map(p => p.id);
    
    // 2. 변압기에서 직접 연결된 첫 번째 자식 노드(Anchors) 찾기
    const anchors = [];
    allIds.forEach(id => {
        const parentId = panelParents[id];
        if (parentId && sourceIds.includes(parentId)) {
            anchors.push(id);
        }
    });

    // 만약 변압기 자식이 없으나 다른 루트가 있다면 (비정상 케이스 대비) 기존 로직 백업
    if (anchors.length === 0) {
        allIds.forEach(id => {
            const parentId = panelParents[id];
            if (!parentId || !allIds.includes(parentId)) {
                if (!sourceIds.includes(id)) { // 원천 노드 자체는 제외
                    anchors.push(id);
                }
            }
        });
    }

    const newFeeders = [];
    const processedToIds = new Set();

    // 3. 각 Anchor별로 거대 그룹 형성
    anchors.forEach(anchorId => {
        const groupId = `system_${anchorId}_${Date.now()}`;
        
        // 트리 하위 모든 노드 수집 (DFS)
        const getSubtreeIds = (id) => {
            let ids = [id];
            const children = Object.keys(panelParents).filter(cid => panelParents[cid] === id && allIds.includes(cid));
            children.forEach(cid => {
                ids = [...ids, ...getSubtreeIds(cid)];
            });
            return ids;
        };

        const subtreeIds = getSubtreeIds(anchorId);
        
        // Header 추가 (Anchor 이름)
        newFeeders.push({
            id: `header_${anchorId}_${Date.now()}`,
            rowType: 'group-header',
            groupId,
            label: getNameById(anchorId),
            fromId: '', toId: ''
        });

        // 서브트리의 모든 노드들을 행으로 추가 (DFS 순서 유지)
        subtreeIds.forEach(targetId => {
            const existingRow = currentFeeders.find(f => f.toId === targetId && (!f.rowType || f.rowType === 'normal'));
            
            if (existingRow) {
                newFeeders.push({ ...existingRow, groupId });
            } else {
                newFeeders.push({
                    id: `sync_${targetId}_${Date.now()}`,
                    fromId: panelParents[targetId] || '',
                    toId: targetId,
                    cat: 'L',
                    groupId
                });
            }
            processedToIds.add(targetId);
        });

        // Footer 추가 (계통 전압강하)
        newFeeders.push({
            id: `footer_${anchorId}_${Date.now()}`,
            rowType: 'group-footer',
            groupId,
            label: '계통 전압강하',
            value: '-%',
            fromId: '', toId: ''
        });
    });

    // 4. 계통에 속하지 않은 행들 (고아 노드) 및 발전기/변압기 제외 수동 행들
    allPanels.forEach(p => {
        const id = p.id;
        // 제외 대상: 이미 처리됨(계통 내), 원천(transformer, low-voltage-receiving), 발전기(generator)
        const isExcludedType = p.type === 'transformer' || p.type === 'low-voltage-receiving' || p.type === 'generator';
        
        if (!processedToIds.has(id) && !isExcludedType) {
            const existingRow = currentFeeders.find(f => f.toId === id && (!f.rowType || f.rowType === 'normal'));
            if (existingRow) {
                newFeeders.push(existingRow);
            } else {
                // 프로젝트에는 있으나 계산서에 없던 노드 자동 추가
                newFeeders.push({
                    id: `orphan_${id}_${Date.now()}`,
                    fromId: panelParents[id] || '',
                    toId: id,
                    cat: 'L'
                });
            }
            processedToIds.add(id);
        }
    });

    const manualRows = currentFeeders.filter(f => !f.toId && (!f.rowType || f.rowType === 'normal'));
    newFeeders.push(...manualRows);

    return newFeeders;
};

/**
 * Validates if the selected feeders can be grouped.
 */
export const validateGrouping = (selectedFeeders, getNameById) => {
    if (selectedFeeders.length === 0) return { isValid: false, error: '선택된 항목이 없습니다.' };

    const getNames = (f) => {
        const names = [];
        const fromName = getNameById(f.fromId);
        const toName = getNameById(f.toId);
        if (fromName) names.push(fromName);
        if (toName) names.push(toName);
        return names;
    };

    let commonNames = getNames(selectedFeeders[0]);

    for (let i = 1; i < selectedFeeders.length; i++) {
        const feeder = selectedFeeders[i];
        if (feeder.rowType && feeder.rowType !== 'normal') {
            return { isValid: false, error: '이미 그룹에 포함된 항목이거나 헤더/푸터입니다.' };
        }

        const currentNames = getNames(feeder);
        commonNames = commonNames.filter(name => currentNames.includes(name));

        if (commonNames.length === 0) {
            return { isValid: false, error: '공통된 시스템 명칭(From 또는 To)을 찾을 수 없습니다.' };
        }
    }

    let pivotName = commonNames[0];
    if (selectedFeeders.length === 1) {
        const toName = getNameById(selectedFeeders[0].toId);
        if (toName) pivotName = toName;
    }

    return { isValid: true, fromName: pivotName };
};

/**
 * Applies manual grouping.
 */
export const applyGrouping = (feeders, selectedIds, fromName) => {
    const newFeeders = [...feeders];
    const selectedIndices = selectedIds.map(id => newFeeders.findIndex(f => f.id === id)).sort((a, b) => a - b);
    const firstIdx = selectedIndices[0];
    const lastIdx = selectedIndices[selectedIndices.length - 1];

    const groupId = `group_${Date.now()}`;

    selectedIds.forEach(id => {
        const idx = newFeeders.findIndex(f => f.id === id);
        if (idx !== -1) {
            newFeeders[idx] = { ...newFeeders[idx], groupId };
        }
    });

    const footerRow = {
        id: `footer_${Date.now()}_${Math.random()}`,
        rowType: 'group-footer',
        groupId,
        label: '계통 전압강하',
        value: '-%',
        fromId: '', toId: ''
    };
    newFeeders.splice(lastIdx + 1, 0, footerRow);

    const headerRow = {
        id: `header_${Date.now()}_${Math.random()}`,
        rowType: 'group-header',
        groupId,
        label: fromName,
        fromId: '', toId: ''
    };
    newFeeders.splice(firstIdx, 0, headerRow);

    return newFeeders;
};

/**
 * Calculates and updates Group Footer values (Worst-case System Voltage Drop)
 * 그룹 내부의 계층 구조를 추적하여 루트부터 리프까지의 경로 중 '전압강하 합계'가 가장 큰 최악의 경로 값을 산출합니다.
 */
export const updateGroupFooters = (feeders, getNameById) => {
    const groups = {};
    feeders.forEach(f => {
        if (f.groupId) {
            if (!groups[f.groupId]) groups[f.groupId] = [];
            groups[f.groupId].push(f);
        }
    });

    const newFeeders = [...feeders];
    
    Object.keys(groups).forEach(groupId => {
        const groupRows = groups[groupId];
        const footerIdx = newFeeders.findIndex(f => f.groupId === groupId && f.rowType === 'group-footer');
        if (footerIdx === -1) return;

        // 1. 전압강하 파싱 유틸리티
        const parseVDrop = (val) => {
            if (val === undefined || val === null || val === '') return 0;
            const cleaned = String(val).replace(/[^0-9.]/g, '');
            return parseFloat(cleaned) || 0;
        };

        // 2. 그룹 내 노드 데이터 빌드 (ToId -> 행 매핑)
        const rowMap = {};
        groupRows.forEach(row => {
            if (!row.rowType && row.toId) {
                rowMap[row.toId] = row;
            }
        });

        // 3. 재귀적으로 최악 경로(Max Path Sum) 계산
        const calculateMaxPathSum = (targetId) => {
            const currentRow = rowMap[targetId];
            const currentDrop = parseVDrop(currentRow?.vDropEPer);
            
            // 이 노드를 '부모'로 가지는 자식 행들 찾기
            const childrenRows = groupRows.filter(r => !r.rowType && r.fromId === targetId);
            
            if (childrenRows.length === 0) {
                return currentDrop; // 리프 노드이면 자기 자신의 값 반환
            }

            // 자식 경로들 중 최대값 찾기
            const maxChildDrop = Math.max(...childrenRows.map(child => calculateMaxPathSum(child.toId)));
            
            return currentDrop + maxChildDrop;
        };

        // 4. 루트 노드들로부터 시작하여 전체 최악 경로 찾기
        const allToIdsInGroup = groupRows.filter(r => !r.rowType && r.toId).map(r => r.toId);
        const rootRows = groupRows.filter(r => !r.rowType && r.fromId && !allToIdsInGroup.includes(r.fromId));
        
        let totalWorstDrop = 0;
        if (rootRows.length > 0) {
            totalWorstDrop = Math.max(...rootRows.map(root => calculateMaxPathSum(root.toId)));
        } else {
            const allDrops = groupRows.filter(r => !r.rowType).map(r => parseVDrop(r.vDropEPer));
            totalWorstDrop = allDrops.length > 0 ? Math.max(...allDrops) : 0;
        }
        
        // 5. 값 업데이트 (사용자 요청에 따라 라벨은 '계통 전압강하' 유지)
        newFeeders[footerIdx] = { 
            ...newFeeders[footerIdx], 
            label: '계통 전압강하',
            value: totalWorstDrop > 0 ? `${totalWorstDrop.toFixed(2)}%` : '-%' 
        };
    });

    return newFeeders;
};

/**
 * Removes grouping for a specific groupId.
 */
export const ungroupSystem = (feeders, groupId) => {
    return feeders
        .filter(f => f.groupId !== groupId || (!f.rowType || f.rowType === 'normal'))
        .map(f => {
            if (f.groupId === groupId) {
                const { groupId, ...rest } = f;
                return rest;
            }
            return f;
        });
};
/**
 * Removes group headers and footers if the group contains no normal circuits.
 */
export const cleanEmptyGroups = (feeders) => {
    // 1. Identify all active groupIds that have at least one normal circuit
    const activeGroupIds = new Set(
        feeders
            .filter(f => f.groupId && (!f.rowType || f.rowType === 'normal'))
            .map(f => f.groupId)
    );

    // 2. Filter out headers/footers for groups that are no longer active
    return feeders.filter(f => {
        if (f.groupId && (f.rowType === 'group-header' || f.rowType === 'group-footer')) {
            return activeGroupIds.has(f.groupId);
        }
        return true;
    });
};

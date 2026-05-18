/**
 * usePanelLookup Hook
 * 
 * 프로젝트 내 모든 계산서(Panel)에 대한 ID↔이름 조회를 제공합니다.
 * 이름이 변경되어도 ID 기반으로 최신 이름을 항상 조회할 수 있습니다.
 * 
 * Usage:
 *   const { getNameById, getIdByName, panels, refresh } = usePanelLookup(projectId);
 *   
 *   // 저장 시: ID로 저장
 *   feeder.toId = getIdByName("LP-1");
 *   
 *   // 전역으로 사용된 PL 패널 필터링: globalUsedPanelIds (Set) 반환
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getProject, getPanelConnections } from '../services/projectService';
import useDataStore from '../store/useDataStore';

/**
 * 프로젝트 내 모든 패널의 ID↔이름 조회 훅
 * @param {string} projectId - 프로젝트 ID
 * @returns {Object} - { panels, idToName, nameToId, getNameById, getIdByName, refresh }
 */
export const usePanelLookup = (projectId) => {
    const listUpdateTrigger = useDataStore(state => state.listUpdateTrigger);
    const panelConnections = useDataStore(state => state.panelConnections); // Zustand SSOT
    const [panels, setPanels] = useState([]); // [{id, name, type, path}]
    const [idToName, setIdToName] = useState({}); // {id: name}
    const [nameToId, setNameToId] = useState({}); // {name: id}
    const [globalUsedPanelIds, setGlobalUsedPanelIds] = useState(new Set()); // 전역으로 연결된(자식으로 등록된) 패널 ID 집합
    const [enabledCalculators, setEnabledCalculators] = useState(new Set()); // 활성화된 계산서 ID 집합
    const [isLoaded, setIsLoaded] = useState(false);

    // [SoT Sync] 타 탭에서 패널 이름/구조 변경 시 즉시 갱신
    const lastRefreshTimeRef = useRef(0);
    useEffect(() => {
        if (projectId && listUpdateTrigger > 0) {
            const now = Date.now();
            if (now - lastRefreshTimeRef.current < 1000) return; // 1초 내 중복 요청 방지
            
            console.log(`[usePanelLookup] Refreshing due to listUpdateTrigger (${listUpdateTrigger})`);
            lastRefreshTimeRef.current = now;
            refresh();
        }
    }, [listUpdateTrigger, projectId]);

    // 프로젝트에서 모든 패널 정보 추출
    const extractPanels = useCallback((project) => {
        if (!project || !project.calculators) return [];

        const result = [];

        const traverse = (items, parentPath = '', inheritedType = 'unknown') => {
            if (!items) return;
            items.forEach(item => {
                const currentType = item.type || inheritedType;
                if (item.id && item.name) {
                    result.push({
                        id: item.id,
                        name: item.name,
                        type: currentType,
                        path: parentPath ? `${parentPath}/${item.name}` : item.name,
                        children: item.children // Include children for multi-tab detection
                    });
                }
                if (item.children) {
                    traverse(item.children, item.name, currentType);
                }
            });
        };

        project.calculators.forEach(calc => {
            if (calc.id === 'visual') return; // 시각화(Visual) 도구는 다른 계산서의 부모/검색 대상에서 제외합니다.
            
            // [NEW] Single calculator (like generator) metadata extraction
            if (calc.id && calc.name && (!calc.children || calc.children.length === 0)) {
                // Remove suffix like '_project-12345'
                const typeName = calc.id.split('_')[0];
                
                // [STRICT] 대시보드(관찰자)는 이름 번역 명단에서 영구 제외
                if (!calc.id.includes('panel-feeder') && !calc.id.includes('transformer-main')) {
                    result.push({
                        id: calc.id,
                        name: calc.name,
                        type: typeName,
                        path: calc.name
                    });
                }
            }

            if (calc.children) {
                // calc.id is 'panel-load', 'power-load', etc. which serves as the panel type
                traverse(calc.children, calc.name || calc.id, calc.id);
            }
        });

        return result;
    }, []);

    // 데이터 로드 및 맵 빌드
    const loadData = useCallback(async () => {
        if (!projectId) return;

        try {
            const project = await getProject(projectId);
            const extractedPanels = extractPanels(project);

            // Build maps
            const newIdToName = {};
            const newNameToId = {};

            extractedPanels.forEach(panel => {
                newIdToName[panel.id] = panel.name;
                newNameToId[panel.name] = panel.id;
            });

            // Fast DB-level check: Get all registered panel connections
            const usedIds = new Set();
            const childToParentMap = {};

            try {
                const connections = await getPanelConnections(projectId);
                if (Array.isArray(connections)) {
                    connections.forEach(conn => {
                        if (conn.child_panel_id) {
                            if (conn.parent_panel_id) {
                                const parentIdStr = String(conn.parent_panel_id);
                                // [Self-Healing] 대시보드(관찰자)가 부모로 등록된 쓰레기 데이터는 자동 무시 및 치유
                                if (!parentIdStr.includes('panel-feeder') && !parentIdStr.includes('transformer-main')) {
                                    usedIds.add(String(conn.child_panel_id));
                                    childToParentMap[String(conn.child_panel_id)] = parentIdStr;
                                } else {
                                    console.warn(`[Self-Healing] 대시보드 반란군 쓰레기 데이터 완벽 차단됨: ${parentIdStr}`);
                                }
                            }
                        }
                    });
                }
            } catch (err) {
                console.error('Failed to load panel connections for global usage tracking:', err);
            }

            setPanels(extractedPanels.filter(p => 
                !p.id.includes('transformer-main') && 
                !p.id.includes('panel-feeder') &&
                !p.id.includes('generator') && 
                !p.id.includes('tray')
            ));
            setIdToName(newIdToName);
            setNameToId(newNameToId);
            setGlobalUsedPanelIds(usedIds);
            
            // [SSOT Update] Zustand 전역 스토어에 연결 정보 반영
            useDataStore.setState({
                panelConnections: childToParentMap
            });

            // [NEW] 활성화된 계산서 ID 수집 (generator 등 단일 항목 체크용)
            const enabledSet = new Set();
            if (project.calculators) {
                project.calculators.forEach(c => {
                    if (c.enabled) {
                        // ID에서 프로젝트 ID 접미사 제거 (예: generator_PID -> generator)
                        const baseId = c.id.split('_')[0];
                        enabledSet.add(baseId);
                    }
                });
            }
            setEnabledCalculators(enabledSet);

            setIsLoaded(true);
        } catch (e) {
            console.error('usePanelLookup: Failed to load project data', e);
        }
    }, [projectId, extractPanels]);

    // 초기 로드
    useEffect(() => {
        loadData();
    }, [loadData]);

    // 프로젝트 정보 업데이트 이벤트 리스닝
    useEffect(() => {
        const handleUpdate = (e) => {
            // [NEW] storage 이벤트에 대해서는 지정된 키만 처리
            if (e && e.type === 'storage') {
                if (e.key === 'kelc_project_info_updated' || e.key === 'kelc_panel_name_updated') {
                    loadData();
                }
            } else {
                loadData();
            }
        };

        // [NEW] 연결 변경 이벤트 수신 (BroadcastChannel → useConnectionSync에서 전파)
        const handleConnectionsChanged = (e) => {
            const { connections, parentPanelId, fromBroadcast } = e.detail || {};
            
            // [Optimistic Update] 페이로드가 포함된 브로드캐스트인 경우 즉시 Zustand 메모리 갱신 (서버 조회 스킵)
            if (Array.isArray(connections) && parentPanelId) {
                console.log(`[usePanelLookup] Optimistic update for connections from parent: ${parentPanelId}`);
                
                useDataStore.setState(state => {
                    const next = { ...state.panelConnections };
                    
                    // 1. 기존에 이 부모에 연결되어 있던 자식들을 모두 찾아서 제거 (Reset current parent's children)
                    Object.keys(next).forEach(childId => {
                        if (String(next[childId]) === String(parentPanelId)) {
                            delete next[childId];
                        }
                    });
                    
                    // 2. 새로운 연결 정보 등록
                    connections.forEach(conn => {
                        if (conn.child_panel_id) {
                            next[String(conn.child_panel_id)] = String(parentPanelId);
                        }
                    });
                    
                    return { panelConnections: next };
                });

                // globalUsedPanelIds (Set) 업데이트 트리거를 위한 더미 데이터 갱신 (필요 시)
                setGlobalUsedPanelIds(prev => new Set(prev)); 
            } else {
                // 페이로드가 없는 레거시 신호거나 강제 새로고침이 필요한 경우만 Fetch
                loadData();
            }
        };

        window.addEventListener('kelc_project_info_updated', handleUpdate);
        window.addEventListener('kelc_panel_name_updated', handleUpdate);
        window.addEventListener('kelc_connections_changed', handleConnectionsChanged);
        window.addEventListener('storage', handleUpdate);

        return () => {
            window.removeEventListener('kelc_project_info_updated', handleUpdate);
            window.removeEventListener('kelc_panel_name_updated', handleUpdate);
            window.removeEventListener('kelc_connections_changed', handleConnectionsChanged);
            window.removeEventListener('storage', handleUpdate);
        };
    }, [loadData]);

    /**
     * ID로 이름 조회
     * @param {string} id - 패널 ID
     * @param {string} fallback - 찾지 못했을 때 반환할 값 (기본: "(없음)")
     * @returns {string} - 패널 이름 또는 fallback
     */
    const getNameById = useCallback((id, fallback = '') => {
        if (!id) return fallback;
        return idToName[id] || fallback || `(ID: ${id.slice(-6)})`;
    }, [idToName]);

    /**
     * 이름으로 ID 조회
     * @param {string} name - 패널 이름
     * @returns {string|null} - 패널 ID 또는 null
     */
    const getIdByName = useCallback((name) => {
        if (!name) return null;
        return nameToId[name] || null;
    }, [nameToId]);

    /**
     * 특정 패널(자식)의 부모 패널 ID 조회 (DB panel_connections 기준)
     * @param {string} childId - 자식 패널 ID
     * @returns {string|null} - 부모 패널 ID 또는 null
     */
    const getParentId = useCallback((childId) => {
        if (!childId) return null;
        return panelConnections[childId] || null;
    }, [panelConnections]);

    /**
     * 특정 패널(부모)에 연결된 모든 자식 패널 ID 조회
     * @param {string} parentId - 부모 패널 ID
     * @returns {string[]} - 자식 패널 ID 배열
     */
    const getChildrenIds = useCallback((parentId) => {
        if (!parentId) return [];
        return Object.keys(panelConnections).filter(childId => panelConnections[childId] === parentId);
    }, [panelConnections]);

    /**
     * 특정 계산서 유형이 프로젝트에서 활성화되어 있는지 확인
     * @param {string} calcId - 계산서 유형 ID (예: 'generator', 'panel-load' 등)
     * @returns {boolean}
     */
    const isCalculatorEnabled = useCallback((calcId) => {
        return enabledCalculators.has(calcId);
    }, [enabledCalculators]);

    /**
     * 수동 갱신
     */
    const refresh = useCallback(() => {
        loadData();
    }, [loadData]);

    return {
        panels,         // [{id, name, type, path}] 배열
        idToName,       // {id: name} 맵 (직접 접근용)
        nameToId,       // {name: id} 맵 (직접 접근용)
        globalUsedPanelIds, // 전역으로 사용된 패널 ID 집합
        getNameById,    // (id, fallback?) => name
        getIdByName,    // (name) => id
        getParentId,    // (childId) => parentId
        getChildrenIds, // (parentId) => childIds[] - 특정 부모의 자식들 찾기
        isCalculatorEnabled, // (calcId) => boolean - 특정 계산서 활성 여부
        refresh,        // () => void - 수동 갱신
        isLoaded,       // boolean - 로드 완료 여부
        panelParents: panelConnections    // {childId: parentId} 맵 (계통 구조 원본)
    };
};

export default usePanelLookup;

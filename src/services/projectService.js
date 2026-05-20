/**
 * Project Service
 * 
 * 프로젝트 데이터 관리를 위한 서비스 레이어
 * MariaDB + PHP API 기반
 */

const API_PROJECTS = '/api/projects.php';
const API_PROJECT_DATA = '/api/project_data.php';
const API_CONNECTIONS = '/api/panel_connections.php';

/**
 * API 호출 유틸리티
 */
async function apiCall(url, method = 'GET', data = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
        },
    };

    if (data && method !== 'GET') {
        options.body = JSON.stringify(data);
    }

    try {
        const response = await fetch(url, options);
        const result = await response.json();
        if (result.status === 'error') throw new Error(result.message);
        return result.data;
    } catch (e) {
        console.error(`API Error (${url}):`, e);
        throw e;
    }
}

// 기본 계산서 템플릿
const DEFAULT_CALCULATORS = [
    { id: 'visual', name: '비주얼라이제이션', type: 'multiple', enabled: true, children: [] },
    { id: 'transformer', name: '변압기 용량 계산서', type: 'multiple', enabled: true, children: [] },
    { id: 'low-voltage-receiving', name: '저압 수전 용량 계산서', type: 'multiple', enabled: true, children: [] },
    { id: 'generator', name: '발전기 용량 계산서', type: 'single', enabled: true },
    { id: 'panel-feeder', name: '분전반 간선 계산서', type: 'single', enabled: false },
    { id: 'panel-load', name: '분전반 부하 계산서', type: 'multiple', enabled: false, children: [] },
    { id: 'ups', name: 'UPS 용량 계산서', type: 'multiple', enabled: true, children: [] },
    { id: 'power-load', name: '동력 부하 계산서', type: 'multiple', enabled: false, children: [] },
    { id: 'tray', name: 'TRAY 계산서', type: 'single', enabled: false },
];

/**
 * 프로젝트 데이터 자동 보정 (Healing)
 * 구버전 프로젝트 데이터를 최신 스펙으로 동기화합니다.
 */
export const healProject = (project) => {
    if (!project || !project.calculators) return project;

    // 1. 비주얼라이제이션 호환성: 기존 프로젝트에 없는 경우 자동 주입
    // [FIX] Catch both standard and underscore-suffixed IDs
    let visualIndex = project.calculators.findIndex(c => c.id === 'visual' || c.id.startsWith('visual_'));
    
    if (visualIndex !== -1 && project.calculators[visualIndex].id.includes('_')) {
        project.calculators[visualIndex].id = 'visual';
    }

    if (visualIndex === -1) {
        project.calculators.unshift({ id: 'visual', name: '비주얼라이제이션', type: 'multiple', enabled: true, children: [] });
    }

    // 2. [HEALING] UPS가 'single' 타입인 경우 'multiple'로 자동 변환
    const upsIndex = project.calculators.findIndex(c => c.id === 'ups');
    if (upsIndex !== -1 && project.calculators[upsIndex].type === 'single') {
        project.calculators[upsIndex].type = 'multiple';
        project.calculators[upsIndex].children = project.calculators[upsIndex].children || [];
        // [FIX] Don't force enable here, respect existing state
    }

    // 3. [HEALING] 저압 수전 용량 계산서 자동 주입 및 타입 변환
    // [FIX] Catch both standard and underscore-suffixed IDs (legacy single-type)
    let lvIndex = project.calculators.findIndex(c => c.id === 'low-voltage-receiving' || c.id.startsWith('low-voltage-receiving_'));
    
    if (lvIndex !== -1 && project.calculators[lvIndex].id.includes('_')) {
        // ID 정규화 (single -> multiple 전환 시 ID에서 프로젝트 ID 접미사 제거)
        project.calculators[lvIndex].id = 'low-voltage-receiving';
    }

    if (lvIndex === -1) {
        // 변압기 다음에 삽입
        const trIndex = project.calculators.findIndex(c => c.id === 'transformer');
        if (trIndex !== -1) {
            project.calculators.splice(trIndex + 1, 0, { id: 'low-voltage-receiving', name: '저압 수전 용량 계산서', type: 'multiple', enabled: true, children: [] });
        } else {
            project.calculators.push({ id: 'low-voltage-receiving', name: '저압 수전 용량 계산서', type: 'multiple', enabled: true, children: [] });
        }
    } else {
        // 기존에 있는 경우 타입 보정 (single -> multiple)
        if (project.calculators[lvIndex].type === 'single') {
            project.calculators[lvIndex].type = 'multiple';
            project.calculators[lvIndex].children = project.calculators[lvIndex].children || [];
        }
        
        // 위치 보정 (변압기 아래로 이동)
        const trIndex = project.calculators.findIndex(c => c.id === 'transformer');
        if (trIndex !== -1 && lvIndex < trIndex) {
            const lvCalc = project.calculators.splice(lvIndex, 1)[0];
            const newTrIndex = project.calculators.findIndex(c => c.id === 'transformer');
            project.calculators.splice(newTrIndex + 1, 0, lvCalc);
        } else if (trIndex !== -1 && lvIndex !== trIndex + 1) {
            const lvCalc = project.calculators.splice(lvIndex, 1)[0];
            const newTrIndex = project.calculators.findIndex(c => c.id === 'transformer');
            project.calculators.splice(newTrIndex + 1, 0, lvCalc);
        }
    }
    
    // [제거 완료] '동력 간선' 찌꺼기는 백엔드(api/projects.php)에서 완전히 삭제되었습니다.

    return project;
};

/**
 * 모든 프로젝트 목록 가져오기
 */
export const getProjects = async () => {
    const projects = await apiCall(API_PROJECTS);
    if (Array.isArray(projects)) {
        return projects.map(p => healProject(p));
    }
    return projects;
};

export const getProject = async (projectId) => {
    const project = await apiCall(`${API_PROJECTS}?id=${projectId}`);
    return healProject(project);
};

/**
 * 새 프로젝트 생성
 */
export const createProject = async (projectData) => {
    const newProject = {
        name: projectData.name || '새 프로젝트',
        client: projectData.client || '',
        date: projectData.date || new Date().toISOString().split('T')[0],
        description: projectData.description || '',
        calculators: projectData.calculators || DEFAULT_CALCULATORS,
    };

    return await apiCall(API_PROJECTS, 'POST', newProject);
};

/**
 * 프로젝트 업데이트
 */
export const updateProject = async (projectId, updates) => {
    const project = await getProject(projectId);
    if (!project) return null;

    const updated = {
        ...project,
        ...updates,
        id: projectId
    };

    return await apiCall(API_PROJECTS, 'POST', updated);
};

/**
 * 프로젝트 삭제
 */
export const deleteProject = async (projectId) => {
    // Rely on database ON DELETE CASCADE for associated panel connections and data
    return await apiCall(`${API_PROJECTS}?id=${projectId}`, 'DELETE');
};

/**
 * 프로젝트 복사
 */
export const copyProject = async (projectId, newName) => {
    const original = await getProject(projectId);
    if (!original) return null;

    const timestamp = Date.now();
    const newId = 'project-' + timestamp;

    // Deep clone
    const copied = JSON.parse(JSON.stringify(original));
    copied.id = newId;
    copied.name = newName || `${original.name} (복사본)`;

    // Map of oldId -> newId to update data references later
    const idMap = {};
    idMap[original.id] = newId;

    // [IMPORTANT] Support legacy or direct projectId references that don't have the 'project-' prefix
    const oldIdRaw = original.id.replace('project-', '');
    const newIdRaw = newId.replace('project-', '');
    idMap[oldIdRaw] = newIdRaw;

    // Recursive helper to assign new IDs first
    const assignNewIds = (items, enforcedPrefix = null) => {
        if (!items) return;
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const oldId = item.id;
            
            // Try to preserve prefix but ensure it's unique
            // If enforcedPrefix is provided (e.g. from parent calculator type), use it.
            let prefix = enforcedPrefix || item.id.split('-')[0];
            
            // [HEAL & PROTECT] Restore multi-part prefixes like 'transformer-main'
            // We check ID first, then fallback to name-based heuristic (Healing)
            const isMainName = item.name && (
                item.name.includes('갑지') || 
                item.name.includes('Main') || 
                item.name.includes('Overview') ||
                item.name.includes('특고압')
            );

            if (item.id.includes(`${prefix}-main-`) || (prefix === 'transformer' && isMainName)) {
                prefix = `${prefix}-main`;
            }
            
            const newItemId = `${prefix}-${timestamp}-${i}-${Math.floor(Math.random() * 1000)}`;

            // Save the mapping so we can copy data later
            idMap[oldId] = newItemId;
            item.id = newItemId;

            if (item.children && item.children.length > 0) {
                assignNewIds(item.children, prefix);
            }
        }
    };

    if (copied.calculators) {
        for (const calc of copied.calculators) {
            if (calc.type === 'single') {
                const oldCalcId = calc.id;
                const baseType = calc.id.split('_')[0];
                const newCalcId = `${baseType}_${newId}`;
                
                idMap[oldCalcId] = newCalcId;
                calc.id = newCalcId;
            } else if (calc.children) {
                // Pass the calculator ID (e.g. 'panel-load') as enforced prefix for its children
                assignNewIds(calc.children, calc.id);
            }
        }
    }

    // 1. Save new project metadata with the NEW panel IDs
    // This will instruct projects.php to create the panels in the database
    const savedProject = await apiCall(API_PROJECTS, 'POST', copied);

    // 1.1 Sync panel_connections immediately
    try {
        const originalConnections = await apiCall(`${API_CONNECTIONS}?project_id=${original.id}`);
        if (originalConnections && originalConnections.length > 0) {
            // [STRICT] Only map connections if BOTH ends exist in the new project
            const mappedConnections = originalConnections
                .filter(conn => idMap[conn.parent_panel_id] && idMap[conn.child_panel_id])
                .map(conn => ({
                    parent_panel_id: idMap[conn.parent_panel_id],
                    child_panel_id: idMap[conn.child_panel_id]
                }));

            if (mappedConnections.length > 0) {
                await apiCall(API_CONNECTIONS, 'POST', {
                    project_id: newId,
                    connections: mappedConnections
                });
            }
        }
    } catch (err) {
        console.error('Failed to sync connections during duplication:', err);
    }

    // 2. Recursive helper to copy associated data
    const copyDataForItems = async (items) => {
        if (!items) return;
        for (const item of items) {
            const newItemId = item.id;
            // Find the original ID using the reverse map or by searching the idMap
            const oldId = Object.keys(idMap).find(key => idMap[key] === newItemId);

            if (oldId && newItemId && oldId !== original.id) {
                // Copy calculation data
                const keys = [`kelc_panel_data_${oldId}`, `kelc_panel_draft_${oldId}`];
                for (const key of keys) {
                    let data = await apiCall(`${API_PROJECT_DATA}?key_name=${key}`);
                    if (data) {
                        // [REFINED] Replace internal ID references within the data
                        let dataStr = JSON.stringify(data);
                        
                        // Sort keys by length descending to prevent partial match issues (e.g. project-1 matching project-12)
                        const sortedIdsToReplace = Object.keys(idMap).sort((a, b) => b.length - a.length);

                        sortedIdsToReplace.forEach(oldRefId => {
                            const newRefId = idMap[oldRefId];
                            // Use word boundary if possible, or simple replace with long-first priority
                            // Since these are strings in JSON, we search for the ID
                            const regex = new RegExp(oldRefId, 'g');
                            dataStr = dataStr.replace(regex, newRefId);
                        });
                        
                        const updatedData = JSON.parse(dataStr);
                        const newKey = key.replace(oldId, newItemId);
                        
                        await apiCall(API_PROJECT_DATA, 'POST', {
                            project_id: newId,
                            key_name: newKey,
                            data: updatedData
                        });
                    }
                }
            }

            if (item.children && item.children.length > 0) {
                await copyDataForItems(item.children);
            }
        }
    };

    if (copied.calculators) {
        await copyDataForItems(copied.calculators);
    }

    // 3. Copy Project-Wide Settings (Migration/Isolation Support)
    const projectWideKeys = [
        'kelc_setting_data',
        'kelc_mcc_settings',
        'tcc_multiplier_data',
        'kelc_project_clipboard'
    ];

    for (const baseKey of projectWideKeys) {
        // Try both project-specific and global (legacy) keys for the original project
        const sourceKeys = [
            `${baseKey}_${original.id}`,
            baseKey
        ];

        for (const key of sourceKeys) {
            let data = await apiCall(`${API_PROJECT_DATA}?key_name=${key}&project_id=${original.id}`);
            if (data) {
                // [REFINED] Replace internal ID references
                let dataStr = JSON.stringify(data);
                const sortedIdsToReplace = Object.keys(idMap).sort((a, b) => b.length - a.length);

                sortedIdsToReplace.forEach(oldRefId => {
                    const newRefId = idMap[oldRefId];
                    const regex = new RegExp(oldRefId, 'g');
                    dataStr = dataStr.replace(regex, newRefId);
                });

                const updatedData = JSON.parse(dataStr);
                const targetKey = `${baseKey}_${newId}`;

                await apiCall(API_PROJECT_DATA, 'POST', {
                    project_id: newId,
                    key_name: targetKey,
                    data: updatedData
                });
                break; // Copy first valid match and move to next baseKey
            }
        }
    }

    return savedProject;
};

/**
 * 프로젝트에 분전반 추가
 */
export const addPanelToProject = async (projectId, calculatorType, panelData) => {
    const project = await getProject(projectId);
    if (!project) return null;

    const calculator = project.calculators.find(c => c.id === calculatorType);
    if (!calculator || calculator.type !== 'multiple') return null;

    const idPrefix = panelData.idPrefix || calculatorType;
    const newPanel = {
        id: `${idPrefix}-${Date.now()}`,
        name: panelData.name || '새 분전반',
        children: panelData.children || [],
    };

    if (!calculator.children) calculator.children = [];
    calculator.children.push(newPanel);

    return await updateProject(projectId, { calculators: project.calculators });
};

/**
 * 분전반 이름 업데이트
 */
export const updatePanelName = async (projectId, panelId, newName) => {
    const project = await getProject(projectId);
    if (!project) return null;

    // Recursive helper to find and update panel
    const updateInItems = (items) => {
        if (!items) return false;
        for (const item of items) {
            if (item.id === panelId) {
                item.name = newName;
                return true;
            }
            if (item.children && updateInItems(item.children)) {
                return true;
            }
        }
        return false;
    };

    let found = false;
    for (const calc of project.calculators || []) {
        if (calc.children && updateInItems(calc.children)) {
            found = true;
            break;
        }
    }

    if (!found) return null;

    // Update metadata
    const result = await updateProject(projectId, { calculators: project.calculators });

    // Update internal names in specific data
    const keys = [`kelc_panel_data_${panelId}`, `kelc_panel_draft_${panelId}`];
    for (const key of keys) {
        const data = await apiCall(`${API_PROJECT_DATA}?key_name=${key}`);
        if (data && data.projectInfo) {
            data.projectInfo.panelName = newName;
            await apiCall(API_PROJECT_DATA, 'POST', {
                project_id: projectId,
                key_name: key,
                data: data
            });
        }
    }

    return result;
};

/**
 * 분전반 삭제
 */
export const removePanelFromProject = async (projectId, calculatorType, panelId) => {
    const project = await getProject(projectId);
    if (!project) return null;

    const calculator = project.calculators.find(c => c.id === calculatorType);
    if (!calculator || !calculator.children) return null;

    // 1. Remove calculation data
    const keys = [`kelc_panel_data_${panelId}`, `kelc_panel_draft_${panelId}`];
    for (const key of keys) {
        await apiCall(`${API_PROJECT_DATA}?key_name=${key}`, 'DELETE');
    }

    // 1-A. Remove browser local storage cache to prevent orphaned zombie panels
    try {
        localStorage.removeItem(`kelc_panel_cache_${panelId}`);
    } catch (e) {
        console.warn(`[Cleanup] Failed to remove local cache for panel ${panelId}:`, e);
    }

    // 2. Update structure
    calculator.children = calculator.children.filter(p => p.id !== panelId);

    return await updateProject(projectId, { calculators: project.calculators });
};

/**
 * 다수 분전반 일괄 삭제
 */
export const removePanelsFromProject = async (projectId, panelItems) => {
    // panelItems: Array of { calculatorId, panelId }
    const project = await getProject(projectId);
    if (!project) return null;

    for (const item of panelItems) {
        const { calculatorId, panelId } = item;
        // Recursive search for the calculator folder if needed, 
        // but currently they are all top-level in project.calculators
        const calculator = project.calculators.find(c => c.id === calculatorId);
        if (!calculator || !calculator.children) continue;

        // 1. Remove calculation data
        const keys = [`kelc_panel_data_${panelId}`, `kelc_panel_draft_${panelId}`];
        for (const key of keys) {
            try {
                await apiCall(`${API_PROJECT_DATA}?key_name=${key}`, 'DELETE');
            } catch (err) {
                console.warn(`Failed to delete data for ${panelId}:`, err);
            }
        }

        // 1-A. Remove browser local storage cache to prevent orphaned zombie panels
        try {
            localStorage.removeItem(`kelc_panel_cache_${panelId}`);
        } catch (e) {
            console.warn(`[Cleanup] Failed to remove local cache for panel ${panelId}:`, e);
        }

        // 2. Update structure in memory
        calculator.children = calculator.children.filter(p => p.id !== panelId);
    }

    // 3. Save final updated metadata
    return await updateProject(projectId, { calculators: project.calculators });
};

/**
 * 판넬 데이터 복제 시 충돌 방지를 위한 데이터 세척
 */
const cleanPanelDataForCloning = (data, calculatorId) => {
    if (!data) return data;

    if (data.projectInfo) {
        // 1. 충돌 방지: SOURCE 필드 제외 (분전반/동력 부하 계산서인 경우)
        if (calculatorId === 'panel-load' || calculatorId === 'power-load') {
            if (data.projectInfo.sourceName !== undefined) data.projectInfo.sourceName = '';
            if (data.projectInfo.source !== undefined) data.projectInfo.source = '';
            if (data.projectInfo.fromId !== undefined) data.projectInfo.fromId = '';
        }
    }

    // 2. 충돌 방지: 부하 종류 중 'PL'은 '예비'로 변환 (분전반 부하 계산서 전용)
    if (calculatorId === 'panel-load') {
        const sides = ['leftCircuits', 'rightCircuits'];
        sides.forEach(side => {
            if (data[side] && Array.isArray(data[side])) {
                data[side].forEach(circuit => {
                    let hasPL = false;
                    if (circuit.loads && Array.isArray(circuit.loads)) {
                        circuit.loads.forEach(load => {
                            if (load.category === 'PL') {
                                load.category = '예비';
                                load.name = '예비';
                                if (load.connectedPanelId) {
                                    delete load.connectedPanelId;
                                }
                                hasPL = true;
                            }
                        });
                    }
                    if (hasPL) {
                        circuit.loadName = '예비';
                        if (circuit.connectedPanelId) {
                            delete circuit.connectedPanelId;
                        }
                    }
                });
            }
        });
    }

    return data;
};

/**
 * 분전반 복제 (데이터 포함)
 */
export const duplicatePanel = async (projectId, calculatorId, panelId) => {
    const project = await getProject(projectId);
    if (!project) return null;

    const calculator = project.calculators.find(c => c.id === calculatorId);
    if (!calculator || !calculator.children) return null;

    const sourceIndex = calculator.children.findIndex(p => p.id === panelId);
    if (sourceIndex === -1) return null;

    const sourcePanel = calculator.children[sourceIndex];
    const timestamp = Date.now();
    const newId = `${calculatorId}-${timestamp}`;

    // 1. Clone object
    const newPanel = JSON.parse(JSON.stringify(sourcePanel));
    newPanel.id = newId;

    // Find a unique name
    let baseName = sourcePanel.name || '새 분전반';
    let counter = 1;

    // A(1) 형태가 이미 있으면 A 부분을 baseName으로 사용
    if (baseName) {
        const match = baseName.match(/^(.*?)(?:\s*\((\d+)\))?$/);
        if (match && match[2]) {
            baseName = match[1].trim();
        }
    }

    let uniqueName = `${baseName}(${counter})`;

    // Utility to check if name exists in the current project structure
    const nameExists = (name) => {
        const checkInItems = (items) => {
            if (!items) return false;
            for (const item of items) {
                if ((item.name?.trim() || '') === name.trim()) return true;
                if (item.children && checkInItems(item.children)) return true;
            }
            return false;
        };
        return checkInItems(project.calculators);
    };

    while (nameExists(uniqueName)) {
        counter++;
        uniqueName = `${baseName}(${counter})`;
    }

    newPanel.name = uniqueName;

    // 2. Insert into children list and save project metadata first
    calculator.children.splice(sourceIndex + 1, 0, newPanel);
    const updatedProject = await updateProject(projectId, { calculators: project.calculators });

    // 3. Clone associated data
    const keys = [`kelc_panel_data_${panelId}`, `kelc_panel_draft_${panelId}`];
    for (const key of keys) {
        const data = await apiCall(`${API_PROJECT_DATA}?key_name=${key}`);
        if (data) {
            if (data.projectInfo) {
                data.projectInfo.panelName = newPanel.name;
            }

            // 데이터 세척 (SOURCE 제거, PL -> 예비)
            const cleanedData = cleanPanelDataForCloning(data, calculatorId);

            const newKey = key.replace(panelId, newId);
            await apiCall(API_PROJECT_DATA, 'POST', {
                project_id: projectId,
                key_name: newKey,
                data: cleanedData
            });
        }
    }

    return updatedProject;
};

/**
 * 타 프로젝트로부터 분전반 편입 (복제)
 */
export const importPanelsFromProject = async (targetProjectId, sourceProjectId, calculatorId, sourcePanelIds, onProgress) => {
    const targetProject = await getProject(targetProjectId);
    const sourceProject = await getProject(sourceProjectId);
    if (!targetProject || !sourceProject) return null;

    const targetCalc = targetProject.calculators.find(c => c.id === calculatorId);
    const sourceCalc = sourceProject.calculators.find(c => c.id === calculatorId);
    if (!targetCalc || !sourceCalc) return null;

    if (!targetCalc.children) targetCalc.children = [];

    const total = sourcePanelIds.length;
    let completed = 0;

    // 편입할 패널들과 매핑 정보를 저장할 리스트
    const importQueue = [];

    // 1. 먼저 구조적 복제 및 이름 결정 (메모리 상에서)
    for (const panelId of sourcePanelIds) {
        const sourcePanel = sourceCalc.children.find(p => p.id === panelId);
        if (!sourcePanel) continue;

        const timestamp = Date.now() + completed;
        const newId = `${calculatorId}-${timestamp}`;

        // 이름 결정 (중복 방지)
        let baseName = sourcePanel.name || '새 분전반';
        let counter = 1;
        
        const nameExists = (name) => {
            const checkInItems = (items) => {
                if (!items) return false;
                for (const item of items) {
                    if ((item.name?.trim() || '') === name.trim()) return true;
                    if (item.children && checkInItems(item.children)) return true;
                }
                return false;
            };
            return checkInItems(targetProject.calculators);
        };

        let uniqueName = baseName;
        while (nameExists(uniqueName)) {
            uniqueName = `${baseName}(${counter})`;
            counter++;
        }

        // 패널 정보 복제
        const newPanel = JSON.parse(JSON.stringify(sourcePanel));
        newPanel.id = newId;
        newPanel.name = uniqueName;
        newPanel.children = []; // 자식 패널 비움

        targetCalc.children.push(newPanel);
        
        importQueue.push({
            sourceId: panelId,
            newId: newId,
            newName: uniqueName,
            sourcePanel: sourcePanel
        });
        
        completed++;
    }

    // 2. [중요] 프로젝트 구조를 먼저 서버에 저장하여 새로운 패널 ID들을 DB(panels 테이블)에 등록
    await updateProject(targetProjectId, { calculators: targetProject.calculators });

    // 3. 이제 등록된 ID에 대해 상세 데이터를 복제 및 세척하여 저장
    completed = 0;
    for (const item of importQueue) {
        const { sourceId, newId, newName } = item;
        const keys = [`kelc_panel_data_${sourceId}`, `kelc_panel_draft_${sourceId}`];
        
        for (const key of keys) {
            try {
                // 소스 프로젝트의 데이터를 명시적으로 요청
                const data = await apiCall(`${API_PROJECT_DATA}?key_name=${key}&project_id=${sourceProjectId}`);
                if (data) {
                    if (data.projectInfo) {
                        data.projectInfo.panelName = newName;
                        data.projectInfo.projectId = targetProjectId;
                    }

                    // 데이터 세척 (SOURCE 제거, PL -> 예비)
                    const cleanedData = cleanPanelDataForCloning(data, calculatorId);

                    const newKey = key.replace(sourceId, newId);
                    await apiCall(API_PROJECT_DATA, 'POST', {
                        project_id: targetProjectId,
                        key_name: newKey,
                        data: cleanedData
                    });
                }
            } catch (err) {
                console.warn(`Data sync failed for key ${key}, skipping...`, err);
            }
        }

        completed++;
        if (onProgress) onProgress(Math.round((completed / total) * 100));
    }

    return true;
};


/**
 * 프로젝트 내 분전반 순서 변경
 */
export const reorderPanels = async (projectId, calculatorId, newChildren) => {
    const project = await getProject(projectId);
    if (!project) return null;

    const calculator = project.calculators.find(c => c.id === calculatorId);
    if (!calculator) return null;

    calculator.children = newChildren;

    return await updateProject(projectId, { calculators: project.calculators });
};

/**
 * 기본 계산서 템플릿 가져오기
 */
export const getDefaultCalculators = () => {
    return JSON.parse(JSON.stringify(DEFAULT_CALCULATORS));
};

/**
 * 로컬 스토리지 호환 레이어 (특정 데이터 저장용)
 * 기존 localStorage.getItem/setItem을 API로 대체하기 위함
 */
export const getRemoteData = async (key, projectId = null) => {
    let url = `${API_PROJECT_DATA}?key_name=${key}`;
    if (projectId) {
        url += `&project_id=${projectId}`;
    }
    return await apiCall(url);
};

export const setRemoteData = async (projectId, key, data) => {
    const result = await apiCall(API_PROJECT_DATA, 'POST', {
        project_id: projectId,
        key_name: key,
        data: data
    });

    // Notify other tabs/windows about the update
    try {
        // [REMOVED] Legacy signal
        // localStorage.setItem('kelc_data_update_signal', Date.now().toString());
        // window.dispatchEvent(new Event('kelc_data_update_signal'));
    } catch (e) {
        console.error("Failed to set update signal:", e);
    }

    return result;
};

export const removeRemoteData = async (key, projectId = null) => {
    let url = `${API_PROJECT_DATA}?key_name=${key}`;
    if (projectId) {
        url += `&project_id=${projectId}`;
    }
    return await apiCall(url, 'DELETE');
};

/**
 * 활성 프로젝트 설정 (쿠키 또는 localStorage 유지)
 */
export const setActiveProject = (projectId) => {
    localStorage.setItem('kelc_active_project_id', projectId);
};

export const getActiveProjectId = () => {
    return localStorage.getItem('kelc_active_project_id');
};

/**
 * 전역 판넬 연결 그래프 (Adjacency List) API 연동
 */
export const getPanelConnections = async (projectId) => {
    return await apiCall(`${API_CONNECTIONS}?project_id=${projectId}`);
};

export const savePanelConnections = async (projectId, parentId, connections) => {
    const result = await apiCall(API_CONNECTIONS, 'POST', {
        project_id: projectId,
        parent_panel_id: parentId,
        connections: connections
    });

    // Notify other tabs/windows about the connections update
    try {
        // [REMOVED] Legacy signal
        // localStorage.setItem('kelc_data_update_signal', Date.now().toString());
        // window.dispatchEvent(new Event('kelc_data_update_signal'));
    } catch (e) {
        console.error("Failed to set update signal:", e);
    }

    return result;
};

/**
 * 프로젝트의 모든 Dirty 패널(Draft)을 영구 저장소로 일괄 저장
 */
export const performBatchSave = async (projectId) => {
    try {
        const dirtyList = JSON.parse(localStorage.getItem('kelc_dirty_panels') || '[]');
        if (dirtyList.length === 0) return true;

        for (const pId of dirtyList) {
            const draftKey = `kelc_panel_draft_${pId}`;
            const originKey = `kelc_panel_data_${pId}`;
            
            // Draft 데이터 가져오기
            const draftData = await getRemoteData(draftKey, projectId);
            if (draftData) {
                // Draft 상태 해제 후 영구 저장소로 이동
                draftData.isDraft = false;
                await setRemoteData(projectId, originKey, draftData);
                // Draft 데이터 삭제
                await removeRemoteData(draftKey, projectId);
            }
        }

        // 로컬 상태 초기화
        localStorage.setItem('kelc_dirty_panels', '[]');
        localStorage.setItem('kelc_project_is_dirty', 'false');
        
        // 헤더 등에 알림
        window.dispatchEvent(new Event('kelc_dirty_state_changed'));
        window.dispatchEvent(new CustomEvent('kelc_save_finished', { detail: { success: true, isBatch: true } }));
        
        return true;
    } catch (e) {
        console.error('[ProjectService] Batch save failed:', e);
        return false;
    }
};

export default {
    getProjects,
    getProject,
    createProject,
    updateProject,
    deleteProject,
    copyProject,
    addPanelToProject,
    updatePanelName,
    reorderPanels,
    duplicatePanel,
    importPanelsFromProject,
    removePanelFromProject,
    removePanelsFromProject,
    getDefaultCalculators,
    getRemoteData,
    setRemoteData,
    removeRemoteData,
    setActiveProject,
    getActiveProjectId,
    getPanelConnections,
    savePanelConnections,
    performBatchSave
};

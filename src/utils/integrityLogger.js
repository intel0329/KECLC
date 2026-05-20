/**
 * System Integrity Logger & Checker
 * 
 * [Core Principles]
 * 1. Read-only & Non-invasive: 기존 useDataStore.js 동기화 엔진은 단 1줄도 수정하지 않음.
 * 2. Performance Guard: setTimeout(..., 0) 또는 requestIdleCallback을 기반으로 비동기 실행하여 메인 스레드 블로킹 방지.
 * 3. Safe Execution: 모든 작업은 try-catch로 감싸 비정상 예외 발생 시에도 주 서비스 기능에 100% 무해함.
 */

const LOG_KEY = 'kelc_integrity_logs';
const MAX_LOGS = 150; // 최대 보관 로그 개수 (FIFO 버퍼)

/**
 * 지속성 로컬 로그 기록기 (LocalStorage 영구 누적)
 * 
 * @param {string} level - 'INFO' | 'WARN' | 'ERR_INTEGRITY'
 * @param {string} action - 'LOAD' | 'CHECK' | 'SAVE' | 'CLONE' | 'SYNC'
 * @param {string} message - 로그 제목/설명
 * @param {Object} [detail=null] - 부가 디버깅 정보 객체
 */
export const logIntegrityEvent = (level, action, message, detail = null) => {
    try {
        const rawLogs = localStorage.getItem(LOG_KEY);
        let logs = [];
        if (rawLogs) {
            try {
                logs = JSON.parse(rawLogs);
                if (!Array.isArray(logs)) logs = [];
            } catch (e) {
                logs = [];
            }
        }

        // [오탐 방지 및 중복 필터링] 최근 5초 이내 동일 패널 ID & 동일 에러 메시지가 이미 기록되었다면 스킵
        if (level === 'ERR_INTEGRITY' || level === 'WARN') {
            const nowTime = Date.now();
            const hasDuplicate = logs.some(log => {
                const logTime = new Date(log.timestamp).getTime();
                if (nowTime - logTime > 5000) return false; // 5초 초과된 로그는 무시

                if (log.message !== message) return false; // 메시지가 다르면 무시

                // detail 내의 판넬 ID(들) 추출 및 대조
                const currentPanelId = detail?.panelId || detail?.childId || detail?.parentId;
                const logPanelId = log.detail?.panelId || log.detail?.childId || log.detail?.parentId;

                return currentPanelId && logPanelId && String(currentPanelId) === String(logPanelId);
            });

            if (hasDuplicate) {
                return; // 중복 에러 로그는 기록하지 않음
            }
        }

        const now = new Date();
        const newLog = {
            id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            timestamp: now.toISOString(),
            timeString: now.toLocaleTimeString(),
            dateString: now.toLocaleDateString(),
            level,      // 'INFO' | 'WARN' | 'ERR_INTEGRITY'
            action,     // 'LOAD' | 'CHECK' | 'SAVE' ...
            message,
            detail: detail ? JSON.parse(JSON.stringify(detail)) : null // Deep copy
        };

        logs.push(newLog);

        // FIFO 버퍼 크기 제어
        if (logs.length > MAX_LOGS) {
            logs = logs.slice(logs.length - MAX_LOGS);
        }

        localStorage.setItem(LOG_KEY, JSON.stringify(logs));

        // [DEV RADAR Hook] 개발자 모드 Broadcast Radar에도 이벤트를 흘려보내 실시간 모니터링 가능케 함
        window.dispatchEvent(new CustomEvent('kelc_dev_radar_log', {
            detail: {
                type: level === 'ERR_INTEGRITY' ? 'WARN' : level,
                action: `INTEG_${action}`,
                panelId: detail?.panelId || detail?.childId || '-',
                senderId: 'SYSTEM'
            }
        }));

        // 영구 로그가 변경되었음을 UI 탭 등에 전파하는 이벤트 발송
        window.dispatchEvent(new CustomEvent('kelc_integrity_logs_changed'));
    } catch (err) {
        console.error('[IntegrityLogger] Failed to write log:', err);
    }
};


/**
 * 부모 회로(connectedPanelId)에서 유효한 자식 계산서 ID를 판정하기 위한 검증 필터 (Prefix Wildcard 지원)
 */
const VALID_CHILD_PREFIXES = ['panel-load-', 'ups-', 'power-load-'];
const isValidChildId = (id) => {
    if (!id) return false;
    const idStr = String(id).trim();
    return VALID_CHILD_PREFIXES.some(prefix => idStr.startsWith(prefix));
};

/**
 * 프로젝트 내 모든 계산서들의 관계 무결성 비동기 정밀 진단 (Dangling Link 검출)
 * 메인 렌더링 스레드를 블로킹하지 않기 위해 setTimeout 매크로 태스크로 감싸 유휴 시간에 실행됩니다.
 * 
 * @param {string} projectId - 프로젝트 ID
 * @param {Array<Object>} allExtractedPanels - usePanelLookup 등에서 추출된 [{id, name, type}] 명단
 */
export const checkProjectIntegrityAsync = (projectId, allExtractedPanels) => {
    if (!projectId || !Array.isArray(allExtractedPanels) || allExtractedPanels.length === 0) return;

    // 메인 스레드 실행 양보 (setTimeout 활용 비동기 매크로태스크화)
    setTimeout(() => {
        try {
            const startTime = performance.now();

            // 1. 필요한 상태 및 데이터 맵 구성
            const panelMap = {}; // { id: panelMeta }
            allExtractedPanels.forEach(p => {
                panelMap[p.id] = p;
            });

            // 로컬 스토리지 캐시 및 현재 Zustand 메모리 데이터 확보 (isIdMatch 유연성 탑재)
            const getCachedOrStoreData = (panelId) => {
                // Tier 1-A: LocalStorage 캐시 Exact Match 우선 조회
                const cacheKey = `kelc_panel_cache_${panelId}`;
                const cached = localStorage.getItem(cacheKey);
                if (cached) {
                    try {
                        const parsed = JSON.parse(cached);
                        if (parsed) return parsed;
                    } catch (e) { }
                }

                // Tier 1-B: LocalStorage 키 엄격 조회 (Exact Match)
                try {
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        if (key && key.startsWith('kelc_panel_cache_')) {
                            const candidateId = key.replace('kelc_panel_cache_', '');
                            if (String(candidateId).trim() === String(panelId).trim()) {
                                const cachedVal = localStorage.getItem(key);
                                if (cachedVal) {
                                    const parsed = JSON.parse(cachedVal);
                                    if (parsed) return parsed;
                                }
                            }
                        }
                    }
                } catch (e) { }

                // Tier 2: Zustand 스토어 내 엄격 매칭 조회
                try {
                    const storePanels = window.__KECLC_STORE_PANELS__;
                    if (storePanels) {
                        const matchedId = Object.keys(storePanels).find(id => String(id).trim() === String(panelId).trim());
                        if (matchedId && storePanels[matchedId]) return storePanels[matchedId];
                    }
                } catch (e) { }

                return null;
            };

            // DB 계통 관계 맵 가져오기
            let dbConnections = {};
            try {
                const globalState = window.useDataStore?.getState?.();
                if (globalState?.panelConnections) {
                    dbConnections = globalState.panelConnections;
                }
            } catch (err) { }

            let totalViolations = 0;

            // 2. 전체 패널 순회하며 양방향 무결성 정밀 검증
            allExtractedPanels.forEach(panel => {
                const panelData = getCachedOrStoreData(panel.id);
                if (!panelData) return; // 로컬 장치에 로드된 적이 없어 데이터가 없으면 패스

                // A. 부모 계산서 입장에서의 검증 (부모 -> 자식 링크)
                // 분전반 부하(panel-load), 동력 부하(power-load) 또는 UPS(ups)의 경우
                if (panel.type === 'panel-load' || panel.type === 'power-load' || panel.type === 'ups') {
                    const findCircuitsWithPL = () => {
                        const links = []; // [{ childId, circuitName, side }]

                        // 분전반 부하 계산서 구조 스캔
                        const sides = ['leftCircuits', 'rightCircuits'];
                        sides.forEach(side => {
                            if (Array.isArray(panelData[side])) {
                                panelData[side].forEach((circuit, index) => {
                                    // 1. 단일 회로 레벨의 connectedPanelId 스캔
                                    if (circuit.connectedPanelId && isValidChildId(circuit.connectedPanelId)) {
                                        links.push({
                                            childId: circuit.connectedPanelId,
                                            circuitName: circuit.loadName || `회로 #${index + 1}`,
                                            side: side === 'leftCircuits' ? '좌측' : '우측'
                                        });
                                    }
                                    // 2. 회로 내 중첩 부하(Nested Loads) 딥스캔
                                    if (Array.isArray(circuit.loads)) {
                                        circuit.loads.forEach((nestedLoad) => {
                                            if (nestedLoad.connectedPanelId && isValidChildId(nestedLoad.connectedPanelId)) {
                                                links.push({
                                                    childId: nestedLoad.connectedPanelId,
                                                    circuitName: nestedLoad.loadName || circuit.loadName || `중첩회로 #${index + 1}`,
                                                    side: side === 'leftCircuits' ? '좌측' : '우측'
                                                });
                                            }
                                        });
                                    }
                                });
                            }
                        });

                        // 동력 부하 및 UPS 계산서 구조 스캔 (powerLoads)
                        if (Array.isArray(panelData.powerLoads)) {
                            panelData.powerLoads.forEach((load, index) => {
                                // 일반 분전반/동력부하의 connectedPanelId 스캔 (UPS 제외)
                                if (panel.type !== 'ups' && load.connectedPanelId && isValidChildId(load.connectedPanelId)) {
                                    links.push({
                                        childId: load.connectedPanelId,
                                        circuitName: load.loadName || `동력부하 #${index + 1}`,
                                        side: '동력'
                                    });
                                }
                                // UPS의 bankId 스캔
                                if (panel.type === 'ups' && load.bankId && isValidChildId(load.bankId)) {
                                    links.push({
                                        childId: load.bankId,
                                        circuitName: load.bankName || load.loadName || `UPS Bank #${index + 1}`,
                                        side: 'UPS부하'
                                    });
                                }
                            });
                        }

                        return links;
                    };

                    const parentToChildLinks = findCircuitsWithPL();

                    parentToChildLinks.forEach(link => {
                        const childId = link.childId;
                        // 엄격 룩업 적용 (Exact Match)
                        const childMeta = Object.values(panelMap).find(p => String(p.id).trim() === String(childId).trim());

                        // 에러 탐지 1: 실제 프로젝트 리스트에서 해당 자식 판넬 ID가 삭제되었거나 존재하지 않는 경우
                        if (!childMeta) {
                            totalViolations++;
                            logIntegrityEvent('ERR_INTEGRITY', 'CHECK',
                                `유령 자식 참조 발견: 부모[${panel.name}]가 존재하지 않는 패널 ID를 참조하고 있습니다.`,
                                { parentId: panel.id, parentName: panel.name, childId, detail: `회로: ${link.circuitName} (${link.side})` }
                            );
                            return;
                        }

                        // 자식 패널 데이터 가져오기
                        const childData = getCachedOrStoreData(childId);
                        if (childData) {
                            const childFromId = childData.projectInfo?.fromId;

                            // 에러 탐지 2: 자식 패널의 부모 참조(fromId)가 끊어져 있거나 다른 부모로 지정된 경우 (엄격 검증)
                            if (!childFromId || String(childFromId).trim() !== String(panel.id).trim()) {
                                totalViolations++;
                                logIntegrityEvent('ERR_INTEGRITY', 'CHECK',
                                    `연결 단선(Dangling Link) 발견: 부모[${panel.name}]는 자식[${childMeta.name}]을 참조하나, 자식의 FROM이 비어있거나 다릅니다.`,
                                    {
                                        parentId: panel.id,
                                        parentName: panel.name,
                                        childId,
                                        childName: childMeta.name,
                                        childFromId: childFromId || '비어있음',
                                        detail: `부모 회로: ${link.circuitName} (${link.side})`
                                    }
                                );
                            }
                        }
                    });
                }

                // B. 자식 계산서 입장에서의 역방향 검증 (자식 -> 부모 링크)
                const fromId = panelData.projectInfo?.fromId;
                if (fromId) {
                    // 엄격 룩업 적용 (Exact Match)
                    const parentMeta = Object.values(panelMap).find(p => String(p.id).trim() === String(fromId).trim());

                    // 에러 탐지 3: 자식이 가리키는 부모 패널 ID가 프로젝트 내에 존재하지 않는 경우
                    if (!parentMeta) {
                        totalViolations++;
                        logIntegrityEvent('ERR_INTEGRITY', 'CHECK',
                            `유령 부모 지정 발견: 자식[${panel.name}]이 존재하지 않는 부모 ID를 지목하고 있습니다.`,
                            { childId: panel.id, childName: panel.name, parentId: fromId }
                        );
                    } else {
                        // 부모 패널 데이터 파싱하여 자식을 참조하는 회로가 있는지 교차 검증
                        const parentData = getCachedOrStoreData(fromId);
                        if (parentData) {
                            let parentHasReference = false;

                            // 부모 회로 스캔
                            const sides = ['leftCircuits', 'rightCircuits'];
                            sides.forEach(side => {
                                if (Array.isArray(parentData[side])) {
                                    parentData[side].forEach(circuit => {
                                        // 1. 단일 회로 레벨의 connectedPanelId 비교
                                        if (circuit.connectedPanelId && isValidChildId(circuit.connectedPanelId) && String(circuit.connectedPanelId).trim() === String(panel.id).trim()) {
                                            parentHasReference = true;
                                        }
                                        // 2. 회로 내 중첩 부하(Nested Loads) 내 connectedPanelId 딥스캔
                                        if (Array.isArray(circuit.loads)) {
                                            circuit.loads.forEach(nestedLoad => {
                                                if (nestedLoad.connectedPanelId && isValidChildId(nestedLoad.connectedPanelId) && String(nestedLoad.connectedPanelId).trim() === String(panel.id).trim()) {
                                                    parentHasReference = true;
                                                }
                                            });
                                        }
                                    });
                                }
                            });

                            if (Array.isArray(parentData.powerLoads)) {
                                parentData.powerLoads.forEach(load => {
                                    if (load.connectedPanelId && isValidChildId(load.connectedPanelId) && String(load.connectedPanelId).trim() === String(panel.id).trim()) {
                                        parentHasReference = true;
                                    }
                                    // 부모가 ups 타입이고 load.bankId가 매치되는 경우도 교차 검증 인정
                                    if (parentMeta.type === 'ups' && load.bankId && isValidChildId(load.bankId) && String(load.bankId).trim() === String(panel.id).trim()) {
                                        parentHasReference = true;
                                    }
                                });
                            }

                            // 에러 탐지 4: 자식은 부모를 가리키지만, 부모 계산서 내에 해당 자식을 포함한 회로 정보가 완전 소실된 경우
                            if (!parentHasReference) {
                                totalViolations++;
                                logIntegrityEvent('ERR_INTEGRITY', 'CHECK',
                                    `역방향 연결 소실 발견: 자식[${panel.name}]은 부모[${parentMeta.name}]를 바라보나, 부모 회로 목록에 자식 ID가 누락되었습니다.`,
                                    { childId: panel.id, childName: panel.name, parentId: fromId, parentName: parentMeta.name }
                                );
                            }
                        }
                    }
                }
            });

            const duration = (performance.now() - startTime).toFixed(2);

            // 무결성 진단 통계 기록
            if (totalViolations > 0) {
                console.warn(`[Integrity Check] Completed in ${duration}ms. Found ${totalViolations} issues.`);
            } else {
                console.log(`[Integrity Check] Completed in ${duration}ms. All local panel links are healthy.`);
            }

        } catch (err) {
            console.error('[IntegrityLogger] Background check crashed:', err);
        }
    }, 0); // 즉시 비동기화하여 콜스택 양보
};

/**
 * 현재 로컬에 저장되어 있는 모든 무결성 로그 가져오기
 * @returns {Array<Object>}
 */
export const getIntegrityLogs = () => {
    try {
        const raw = localStorage.getItem(LOG_KEY);
        if (!raw) return [];
        const logs = JSON.parse(raw);
        return Array.isArray(logs) ? logs : [];
    } catch (e) {
        return [];
    }
};

/**
 * 모든 무결성 로그 지우기
 */
export const clearIntegrityLogs = () => {
    try {
        localStorage.removeItem(LOG_KEY);
        logIntegrityEvent('INFO', 'CHECK', '무결성 진단 로그를 성공적으로 지웠습니다.');
    } catch (e) { }
};

/**
 * 로그 전체 목록을 텍스트 스트링 포맷으로 포매팅 (TXT 추출용)
 * @returns {string}
 */
export const formatLogsToText = () => {
    const logs = getIntegrityLogs();
    if (logs.length === 0) return '기록된 무결성 진단 로그가 존재하지 않습니다.';

    let output = `======================================================================\n`;
    output += `               KECLC SYSTEM INTEGRITY LOG ARCHIVE\n`;
    output += `               추출 일시: ${new Date().toLocaleString()}\n`;
    output += `======================================================================\n\n`;

    logs.forEach((log, index) => {
        output += `[${index + 1}] [${log.timestamp}] [${log.level}] [Action: ${log.action}]\n`;
        output += `    메시지: ${log.message}\n`;
        if (log.detail) {
            output += `    상세 정보:\n`;
            Object.keys(log.detail).forEach(key => {
                const val = typeof log.detail[key] === 'object' ? JSON.stringify(log.detail[key]) : log.detail[key];
                output += `        - ${key}: ${val}\n`;
            });
        }
        output += `----------------------------------------------------------------------\n`;
    });

    return output;
};

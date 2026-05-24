import { useState, useEffect, useMemo } from 'react';
import dagre from 'dagre';
import usePanelLookup from '../../../hooks/usePanelLookup';
import useDataStore from '../../../store/useDataStore';
import projectService from '../../../services/projectService';
import { useParams } from 'react-router-dom';
import { calculatePanelTotalLoad } from '../../../utils/kecCalculations';

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const NODE_WIDTH = 220;
const NODE_HEIGHT = 100;
const LEVEL_SPACING = 600; // 계층 간 수평 간격 (450 -> 600으로 추가 확대)

/**
 * 노드의 데이터와 부모 관계를 분석하여 계층 레벨(0~6)을 계산합니다.
 */
const calculateNodeLevelInfo = (node, parentMap, treePanels, childMap = new Map()) => {
    // 1. 고정 타입 및 핵심 계층(Level 0-2) 판정
    let baseFixedLevel = -1;
    if (node.id === 'SOURCE' || node.data.type === 'source' || node.data.type === 'receiving') baseFixedLevel = 0;
    else if (node.id === 'HV' || node.data.type === 'hv') baseFixedLevel = 1;
    else if (node.data.isTransformer || node.id === 'GENERATOR' || node.data.type === 'generator') baseFixedLevel = 2;

    // 핵심 노드는 즉시 해당 레벨 반환 (isOrphan: false)
    if (baseFixedLevel !== -1) return { level: baseFixedLevel, isOrphan: false, depth: 0, isKeyNode: true };

    // 2. 계통 추적 기반 매핑 (조상들을 찾아 올라감)
    let currentId = node.id;
    let depthCount = 0;
    const visited = new Set();

    let foundPowerSource = false;
    let powerSourceLevel = 3; // 기본 시작점

    while (currentId && !visited.has(currentId)) {
        visited.add(currentId);

        const pid = parentMap.get(currentId);
        if (!pid) break;

        // 부모 패널의 성격 파악
        const parentPanel = treePanels.find(p => p.id === pid);
        const isParentTR = parentPanel && (parentPanel.type === 'transformer' || parentPanel.type === 'low-voltage-receiving' || parentPanel.id.startsWith('transformer-main-'));
        const isParentGen = pid === 'GENERATOR';

        // 부모가 전원 공급원(TR/GEN)인 경우
        if (isParentTR || isParentGen) {
            foundPowerSource = true;
            powerSourceLevel = 2; // TR/GEN은 Level 2이므로 자식은 3부터 시작
            break;
        }

        // 부모가 HV나 SOURCE인 경우 (예외 케이스 대응)
        if (pid === 'HV') {
            foundPowerSource = true;
            powerSourceLevel = 1; // HV는 Level 1
            break;
        }
        if (pid === 'SOURCE') {
            foundPowerSource = true;
            powerSourceLevel = 0;
            break;
        }

        currentId = pid;
        depthCount++;
        if (depthCount > 15) break; // 무한루프 방지
    }

    // 3. 완전 고립 노드 감지 (Pure Orphans - 부모도 없고 자식도 없는 낱개 패널)
    const hasParent = parentMap.has(node.id);
    const hasChildren = childMap.has(node.id) && childMap.get(node.id).length > 0;
    const isPureOrphan = !hasParent && !hasChildren;

    return {
        level: foundPowerSource ? (powerSourceLevel + 1 + depthCount) : 0, // 0은 임시값 (이후 오프셋 적용 예정)
        isOrphan: !foundPowerSource,
        isPureOrphan,
        depth: depthCount,
        isKeyNode: false
    };
};

export const useGraphData = () => {
    const { projectId } = useParams();
    const { panels: treePanels, getChildrenIds, getParentId, isCalculatorEnabled, isLoaded: isTreeLoaded } = usePanelLookup(projectId);

    // Zustand Store구독 (SSOT)
    const storePanels = useDataStore(state => state.panels);
    const storeResults = useDataStore(state => state.results);
    const loadPanel = useDataStore(state => state.loadPanel);

    const [nodes, setNodes] = useState([]);
    const [edges, setEdges] = useState([]);
    const [loading, setLoading] = useState(true);

    // 1. 초기 데이터 로딩: 트리 구조상의 모든 패널 데이터를 스토어로 병렬 로드
    useEffect(() => {
        if (!isTreeLoaded || !treePanels) return;

        const fillStore = async () => {
            setLoading(true);
            try {
                // 1. 트리 내 판넬 ID 수집
                const missingIds = treePanels
                    .map(p => p.id)
                    .filter(id => !storePanels[id]);

                // 2. [FIX] 트리 외의 '단일 계산서'(발전기 등) 및 '갑지(HV)' 계산서 ID 수집
                const projectResponse = await projectService.getProject(projectId);
                if (projectResponse && projectResponse.calculators) {
                    // [REFINED] 'generator'로 시작하는 모든 ID를 찾습니다 (발전기가 활성화된 경우만)
                    if (isCalculatorEnabled('generator')) {
                        const genCalc = projectResponse.calculators.find(c =>
                            c.id === 'generator' ||
                            c.id?.startsWith('generator_') ||
                            c.id?.startsWith('generator-') ||
                            c.type === 'generator'
                        );
                        if (genCalc && !storePanels[genCalc.id]) {
                            missingIds.push(genCalc.id);
                        }
                    }

                    // [NEW] 'transformer-main-'으로 시작하는 모든 ID 수집 (갑지 데이터 참조용)
                    projectResponse.calculators.forEach(calc => {
                        if (calc.children) {
                            const findMain = (items) => {
                                items.forEach(item => {
                                    if (item.id?.startsWith('transformer-main-')) {
                                        if (!storePanels[item.id]) missingIds.push(item.id);
                                    }
                                    if (item.children) findMain(item.children);
                                });
                            };
                            findMain(calc.children);
                        }
                    });
                }

                if (missingIds.length > 0) {
                    // 중복 제거 후 로드
                    const uniqueIds = [...new Set(missingIds)];
                    await Promise.all(uniqueIds.map(id => loadPanel(id)));
                }
            } catch (e) {
                console.error('Failed to populate store for visualization:', e);
            } finally {
                setLoading(false);
            }
        };

        fillStore();
    }, [isTreeLoaded, treePanels, loadPanel]); // storePanels는 의존성에서 제외 (무한루프 방지)

    // 2. 그래프 구조 빌드 (Reactive Memo)
    const { rawNodes, rawEdges } = useMemo(() => {
        if (!isTreeLoaded || !treePanels) return { rawNodes: [], rawEdges: [] };

        const nodesList = [];
        const edgesList = [];
        const targetIds = new Set();

        // [NEW] 모든 노드의 부모 관계를 매핑 (조부모 추적용)
        const parentMap = new Map();
        treePanels.forEach(p => {
            const pid = getParentId(p.id);
            if (pid) parentMap.set(p.id, pid);
        });
        let totalTrCapacityValue = 0;
        const trCapacities = [];

        // [NEW] HV 노드가 연결될 실제 'transformer-main-' ID (갑지)를 찾습니다
        const registeredTrIds = new Set();
        let hasHvSheet = false;
        let mainHvId = null;
        Object.keys(storePanels).forEach(id => {
            if (id.startsWith('transformer-main-')) {
                if (!mainHvId) mainHvId = id; // 첫 번째 갑지 ID를 기본 이동 대상으로 지정
                hasHvSheet = true;
                const hvData = storePanels[id];
                if (hvData && hvData.powerLoads) {
                    hvData.powerLoads.forEach(load => {
                        if (load.bankId) registeredTrIds.add(String(load.bankId));
                    });
                }
            }
        });

        // --- 1차 패스: 모든 노드의 개별 속성 및 개별 수요전력 계산 ---
        const nodeTotalLoads = {};  // 각 노드의 설비용량 저장 (kVA)
        const nodeDemandLoads = {}; // 각 노드의 수요전력 저장 (kVA)

        treePanels.forEach(panel => {
            const pData = storePanels[panel.id];
            const pResult = storeResults[panel.id];

            let capacity = 0;
            let totalIb = 0;
            let demandIb = 0;
            let atValue = 0;
            let demandFactor = 100;
            let phase = "";
            let mainBreaker = "";
            let breakerType = "";
            let breakerAF = "";
            let breakerAT = "";
            let location = "";
            let isTransformer = panel.type === 'transformer' || panel.type === 'low-voltage-receiving' || panel.id.startsWith('transformer-main-');
            let trCapacity = "";
            let trType = "";

            if (pData) {
                const info = pData.projectInfo || {};
                demandFactor = info.demandFactor || 100;
                atValue = Number(info.mccbAT) || 0;
                location = info.location || "";
                phase = info.phase || "3Φ-4W";

                // --- 용량(Capacity) 산출 로직 ---
                const rawResult = pResult?.totalLoad;
                let normalizedVA = 0;

                if (rawResult !== undefined && rawResult !== null) {
                    // 스토어 결과가 있는 경우 타입별 단위 보정
                    // 동력부하, 간선, 변압기 계산서는 kVA 단위로 결과를 저장함 -> VA로 정규화
                    if (panel.type === 'panel-feeder' || panel.type === 'transformer' || panel.id.startsWith('transformer-main-') || panel.type === 'generator') {
                        // 간선, 변압기, 발전기 계산서는 kVA(kW) 단위로 결과를 저장함 -> VA로 정규화
                        normalizedVA = rawResult * 1000;
                    } else {
                        // 동력부하(power-load/MCC) 및 일반부하(panel-load)는 VA 단위로 저장됨
                        normalizedVA = rawResult;
                    }
                } else {
                    normalizedVA = calculatePanelTotalLoad(pData) || info.cachedTotalLoad || 0;
                }

                // 수용률(Demand Factor)을 반영한 수용부하 및 총부하(Capacity) 정상화 계산
                const dfRatio = (Number(demandFactor) || 100) / 100;
                const rawVA = normalizedVA; // 스토어의 totalLoad 결과가 순수 총부하(Raw)입니다.
                capacity = rawVA / 1000;

                const demandVA = normalizedVA * dfRatio; // 수용부하는 총부하에 수용률을 곱하여 계산합니다.

                // --- 전류(Ib) 산출 로직 (게이지용) ---
                const vStr = String(info.voltage || '380V');
                const v = Number(vStr.replace(/V/gi, '')) || 380;
                const cleanPh = String(info.phase || '').replace(/[-\s]/g, '').replace(/Ø/g, 'Φ').toUpperCase();
                const K = cleanPh.includes('1Φ') ? 1 : Math.sqrt(3);

                totalIb = rawVA / (v * K);
                demandIb = demandVA / (v * K);

                // 개별 노드 전력 데이터 저장 (합산용)
                nodeTotalLoads[panel.id] = capacity;
                nodeDemandLoads[panel.id] = demandVA / 1000;

                if (isTransformer) {
                    phase = "3P4W (Main)";
                    location = info.location || "MAIN TR";
                    trCapacity = info.mainCapacity || "0";
                    trType = info.insulationType || info.usageType || "";

                    // [NEW] 갑지에 등록된 변압기인 경우에만 HV 용량 합산에 포함
                    const isRegistered = !hasHvSheet || registeredTrIds.has(panel.id);
                    if (isRegistered) {
                        totalTrCapacityValue += (Number(trCapacity) || 0);
                        trCapacities.push(`${trCapacity}kVA`);
                    }
                } else {
                    breakerType = info.mainBreakerType || 'MCCB';
                    breakerAF = info.mccbAF || "";
                    breakerAT = info.mccbAT || "";
                    if (breakerAF && breakerAT) {
                        mainBreaker = `${breakerType} ${breakerAF}AF/${breakerAT}AT`;
                    }
                }
            }

            // 엣지 정보 수집을 위한 자식 목록 미리 가져오기 (노드 데이터 주입용)
            const children = getChildrenIds(panel.id);

            nodesList.push({
                id: panel.id,
                type: 'panelNode',
                data: {
                    id: panel.id,
                    label: isTransformer ? `${panel.name} ${trCapacity}kVA` : panel.name,
                    type: panel.type,
                    capacity: capacity,
                    demandFactor: demandFactor,
                    totalIb: totalIb,
                    demandIb: demandIb,
                    atValue: atValue,
                    phase: phase,
                    mainBreaker: mainBreaker,
                    breakerType: breakerType,
                    breakerAF: breakerAF,
                    breakerAT: breakerAT,
                    location: location,
                    isTransformer: isTransformer,
                    trCapacity: trCapacity,
                    trType: trType,
                    calculatedTotalLoad: 0,
                    calculatedDemandLoad: 0,
                    aggregatedDemandFactor: 100,
                    projectId: projectId,
                    panelId: panel.id,
                    primaryParentId: parentMap.get(panel.id), // [NEW] 물리 엔진의 클러스터링을 위한 부모 ID 주입
                    childCount: children.length // [NEW] 동적 간격 조절을 위한 자식 수 정보 주입
                },
                position: { x: 0, y: 0 }
            });

            children.forEach(childId => {
                const foundChild = treePanels.find(p => p.id === childId);
                if (foundChild) {
                    targetIds.add(childId);

                    // [LOGIC] 엣지 색상 결정 (TR 기반 계층 구조)
                    let edgeColor = '#94a3b8'; // 기본 회색 (Slate-400)
                    if (isTransformer) {
                        edgeColor = '#f59e0b'; // Amber-500
                    } else {
                        const pParentId = parentMap.get(panel.id);
                        const isGrandParentTR = pParentId && treePanels.some(p =>
                            p.id === pParentId && (p.type === 'transformer' || p.type === 'low-voltage-receiving' || p.id.startsWith('transformer-main-'))
                        );
                        if (isGrandParentTR) {
                            edgeColor = '#0ea5e9'; // Sky-500 (파란색)
                        }
                    }

                    // [NEW] 연결선 케이블 정보 추출 로직 (B노드 중심 및 단심 전환 로직 적용)
                    const getEdgeConnectionInfo = (sId, tId) => {
                        const targetData = storePanels[tId];
                        if (!targetData || !targetData.projectInfo) return null;

                        // 설정 데이터 로드 (단심/다심 기준값 추출)
                        const settingsKey = `kelc_setting_data_${projectId}`;
                        const settingsStr = localStorage.getItem(settingsKey) || localStorage.getItem('kelc_setting_data') || '{}';
                        const settings = JSON.parse(settingsStr);
                        const threshold = settings.cableCondition?.area || 50;

                        const info = targetData.projectInfo;
                        const wire = info.wire || '';
                        const cableSize = parseFloat(info.cableSize) || 0;
                        const sizeStr = info.cableSize ? `${info.cableSize}㎟` : '';

                        // 상(Phase) 정보를 분석하여 세트당 가닥수 판별
                        let wiresPerSet = 4;
                        const phase = String(info.phase || '').replace(/[-\s]/g, '').replace(/Ø/g, 'Φ').toUpperCase();
                        if (phase.includes('3Φ4W')) wiresPerSet = 4;
                        else if (phase.includes('3Φ3W')) wiresPerSet = 3;
                        else if (phase.includes('1Φ2W') || phase.includes('1Φ3W')) wiresPerSet = 2;
                        else if (phase.includes('1Φ')) wiresPerSet = 2;

                        // 병렬 세트 수 추출 (kecMethod: Ex2 등의 패턴 분석)
                        let setsCount = 1;
                        const method = String(info.kecMethod || '').toLowerCase();
                        if (method.includes('x')) {
                            const n = parseInt(method.split('x')[1]);
                            if (n && !isNaN(n)) setsCount = n;
                        }

                        // 단심/다심 조건에 따른 표기형식 결정
                        let coreValue = '';
                        let parallelStr = '';

                        if (cableSize >= threshold) {
                            // 단심 전선 조건 충족: 1C로 표기하고 총 가닥수(상별 가닥수 * 병렬 세트) 표시
                            coreValue = '1C';
                            parallelStr = ` X${wiresPerSet * setsCount}`;
                        } else {
                            // 단심 조건 미달: 다심(4C 등) 표기 유지 및 필요시 세트수 표시
                            coreValue = `${wiresPerSet}C`;
                            parallelStr = setsCount > 1 ? ` X${setsCount}` : '';
                        }

                        // 결과 문자열 조립: FCV 1C 150㎟ X8 또는 FCV 4C 25㎟
                        const spec = `${wire} ${coreValue} ${sizeStr}${parallelStr}`.replace(/\s+/g, ' ').trim();
                        return spec || null;
                    };

                    edgesList.push({
                        id: `e-${panel.id}-${childId}`,
                        source: panel.id,
                        target: childId,
                        type: 'default',
                        data: {
                            connectionInfo: getEdgeConnectionInfo(panel.id, childId)
                        },
                        style: {
                            stroke: edgeColor,
                            strokeWidth: 1.5,
                            opacity: (edgeColor === '#94a3b8') ? 0.7 : 0.9
                        },
                    });
                }
            });
        });

        // --- 2차 패스: 수배전반 노드에 하위 노드의 데이터 합계(Aggregation) 적용 ---
        nodesList.forEach(node => {
            if (node.data.isTransformer) {
                const childIds = getChildrenIds(node.id);
                let totalChildLoad = 0;
                let totalChildDemandLoad = 0;
                childIds.forEach(cId => {
                    totalChildLoad += (nodeTotalLoads[cId] || 0);
                    totalChildDemandLoad += (nodeDemandLoads[cId] || 0);
                });
                node.data.calculatedTotalLoad = totalChildLoad;
                node.data.calculatedDemandLoad = totalChildDemandLoad;
                node.data.aggregatedDemandFactor = totalChildLoad > 0 ? (totalChildDemandLoad / totalChildLoad) * 100 : 100;

                // [CRITICAL FIX] 합산된 을지 변압기의 최종 값을 nodeTotalLoads와 nodeDemandLoads에 주입하여
                // 상위 갑지-노드(HV)가 을지-노드의 최종 합산 결과를 읽어갈 수 있도록 보장합니다.
                nodeTotalLoads[node.id] = totalChildLoad;
                nodeDemandLoads[node.id] = totalChildDemandLoad;
            }
        });

        // SOURCE / HV 노드 생성
        const rootPanels = treePanels.filter(p => !targetIds.has(p.id));
        const transformerRoots = rootPanels.filter(p => p.type === 'transformer' || p.type === 'low-voltage-receiving' || p.id.startsWith('transformer-main-'));

        if (transformerRoots.length > 0) {
            nodesList.push({
                id: 'SOURCE',
                type: 'panelNode',
                data: { id: 'SOURCE', label: 'SOURCE', type: 'source', capacity: 0, location: 'EXTERNAL GRID' },
                position: { x: 0, y: 0 }
            });

            // [CRITICAL FIX] 갑지 계산서가 활성화(hasHvSheet === true)되어 있을 때,
            // 실제 갑지에 등록되어 연결선이 그려지는 을지 변압기들만 합산 대상으로 필터링합니다.
            // 등록되지 않은 을지 변압기까지 부하량에 더해져 수치가 불일치하는 현상을 완벽히 방지합니다.
            const connectedTrs = transformerRoots.filter(p => !hasHvSheet || registeredTrIds.has(p.id));

            const hvAggregatedTotalLoad = connectedTrs.reduce((sum, p) => {
                return sum + (nodeTotalLoads[p.id] || 0);
            }, 0);
            const hvAggregatedDemandLoad = connectedTrs.reduce((sum, p) => {
                return sum + (nodeDemandLoads[p.id] || 0);
            }, 0);

            nodesList.push({
                id: 'HV',
                type: 'panelNode',
                data: {
                    id: 'HV',
                    label: `HV ${totalTrCapacityValue.toLocaleString()}KVA`,
                    type: 'hv',
                    capacity: totalTrCapacityValue,
                    location: 'MAIN RECEIVING POINT',
                    trCapacities: trCapacities,
                    calculatedTotalLoad: hvAggregatedTotalLoad,
                    calculatedDemandLoad: hvAggregatedDemandLoad,
                    aggregatedDemandFactor: hvAggregatedTotalLoad > 0 ? (hvAggregatedDemandLoad / hvAggregatedTotalLoad) * 100 : 100,
                    projectId: projectId,
                    panelId: mainHvId, // [CRITICAL] 롤백 방지: 실제 갑지 계산서 ID 주입
                    primaryParentId: 'SOURCE' // [NEW] HV의 최상위 부모는 SOURCE
                },
                position: { x: 0, y: 0 }
            });

            edgesList.push({
                id: `e-SOURCE-HV`,
                source: 'SOURCE',
                target: 'HV',
                type: 'default',
                style: {
                    stroke: '#f59e0b', // Amber-500
                    strokeWidth: 1.5, // 굵기 통일
                    strokeDasharray: '6,4',
                    opacity: 0.9
                },
            });

            transformerRoots.forEach(p => {
                // [NEW] 갑지가 존재하면 등록된 경우에만, 갑지가 없으면 무조건 HV와 연결선을 생성
                const isRegistered = !hasHvSheet || registeredTrIds.has(p.id);

                if (isRegistered) {
                    edgesList.push({
                        id: `e-HV-${p.id}`,
                        source: 'HV',
                        target: p.id,
                        type: 'default',
                        style: {
                            stroke: '#f59e0b', // Amber-500
                            strokeWidth: 1.5, // 굵기 통일
                            strokeDasharray: '6,4',
                            opacity: 0.9
                        },
                    });
                }
            });
        }

        // --- 발전기(Generator) 노드 및 연결선(Edge) 생성 (특수 노드시스템) ---
        // 프로젝트 설정에서 발전기 계산서가 활성화되어 있는 경우에만 처리합니다.
        if (isCalculatorEnabled('generator')) {
            let generatorId = 'generator';
            const actualGenId = Object.keys(storePanels).find(id =>
                id === 'generator' ||
                id.startsWith('generator_') ||
                id.startsWith('generator-')
            );
            if (actualGenId) generatorId = actualGenId;

            const generatorData = storePanels[generatorId];
            const generatorResult = storeResults[generatorId];

            let genCapacity = 0;
            let genTotalLoad = 0;
            let genDemandLoad = 0;
            let genLocation = 'EMERGENCY POWER SYSTEM';

            if (generatorData) {
                const info = generatorData.projectInfo || {};
                genCapacity = Number(generatorResult?.totalCapacity || info.mainCapacity || info.generatorCapacity || 0);
                genTotalLoad = Number(generatorResult?.totalLoad || info.cachedTotalLoad || 0) / 1000;
                genDemandLoad = Number(generatorResult?.demandLoad || (info.cachedTotalLoad * (info.demandFactor || 100) / 100) || 0) / 1000;
                genLocation = info.location || 'EMERGENCY POWER SYSTEM';
            }

            nodesList.push({
                id: 'GENERATOR',
                type: 'panelNode',
                data: {
                    id: 'GENERATOR',
                    label: `GEN ${genCapacity > 0 ? genCapacity.toLocaleString() + 'KW' : '(EMERGENCY)'}`,
                    type: 'generator',
                    capacity: genCapacity,
                    location: genLocation,
                    phase: generatorData?.projectInfo?.phase || '3Φ4W',
                    voltage: generatorData?.projectInfo?.voltage || '380V',
                    installType: generatorData?.projectInfo?.installType || 'EMERGENCY',
                    usageType: generatorData?.projectInfo?.usageType || 'DIESEL',
                    calculatedTotalLoad: genTotalLoad,
                    calculatedDemandLoad: genDemandLoad,
                    aggregatedDemandFactor: genTotalLoad > 0 ? (genDemandLoad / genTotalLoad) * 100 : 100,
                    projectId: projectId,
                    panelId: actualGenId
                },
                position: { x: 0, y: 0 }
            });

            // 발전기 연결선(Edge) 생성
            if (generatorData && generatorData.powerLoads) {
                const processedTargetIds = new Set();
                generatorData.powerLoads.forEach((load) => {
                    const targetIdCandidate = load.bankId || load.connectedPanelId || load.panelId;
                    if (targetIdCandidate && targetIdCandidate !== 'generator') {
                        const sTargetId = String(targetIdCandidate);
                        const targetNode = nodesList.find(n =>
                            n.id === sTargetId ||
                            n.id.includes(sTargetId) ||
                            sTargetId.includes(n.id) ||
                            (n.id.includes('-') && sTargetId.includes(n.id.split('-').pop()))
                        );

                        if (targetNode && !processedTargetIds.has(targetNode.id)) {
                            processedTargetIds.add(targetNode.id);
                            edgesList.push({
                                id: `e-GENERATOR-to-${targetNode.id}`,
                                source: 'GENERATOR',
                                target: targetNode.id,
                                type: 'default',
                                style: {
                                    stroke: '#f43f5e',
                                    strokeWidth: 1.5,
                                    strokeDasharray: '6,4',
                                    opacity: 0.9
                                },
                            });
                        }
                    }
                });
            }
        }

        // --- 3차 패스: 노드 레벨 계산 및 엣지 가중치(minlen) 적용 ---
        // 모든 노드의 자식 관계를 수집 (고아 노드 판별용)
        const childMap = new Map();
        edgesList.forEach(edge => {
            if (!childMap.has(edge.source)) childMap.set(edge.source, []);
            childMap.get(edge.source).push(edge.target);
        });

        // 1. 모든 노드의 기본 계층 정보 1차 계산
        const rawLevelInfos = nodesList.map(node => ({
            id: node.id,
            info: calculateNodeLevelInfo(node, parentMap, treePanels, childMap)
        }));

        // 2. 정상 계통의 최대 레벨 탐색
        const normalLevels = rawLevelInfos
            .filter(item => !item.info.isOrphan)
            .map(item => item.info.level);
        const maxNormalLevel = normalLevels.length > 0 ? Math.max(...normalLevels) : 4;

        // 3. 고아 섬(Island)들의 최대 깊이 탐색 (격리를 위한 오프셋용)
        const orphanIslands = rawLevelInfos.filter(item => item.info.isOrphan && !item.info.isPureOrphan);
        const maxIslandDepth = orphanIslands.length > 0 ? Math.max(...orphanIslands.map(i => i.info.depth)) : 0;

        // 4. 최종 레벨 할당 (동적 오프셋 적용)
        const layoutNodes = nodesList.map(node => {
            const info = rawLevelInfos.find(item => item.id === node.id).info;
            let finalLevel = info.level;

            if (info.isOrphan) {
                if (info.isPureOrphan) {
                    // 완전 고립 노드: 정상 계통 + 고아 계통 이후의 가장 끝에 배치
                    finalLevel = maxNormalLevel + maxIslandDepth + 2;
                } else {
                    // 고아 계통(Island): 정상 계통 바로 다음 단계부터 시작하여 자신의 내부 계통 깊이(depth) 유지
                    finalLevel = maxNormalLevel + 1 + info.depth;
                }
            }

            // 전체 레벨은 최대 15레벨까지 허용 (캔버스 확장)
            finalLevel = Math.min(finalLevel, 15);

            return {
                ...node,
                data: {
                    ...node.data,
                    fixedLevel: finalLevel
                }
            };
        });

        // 엣지에 minlen을 적용하여 Dagre가 레벨 간격을 존중하도록 합니다.
        const layoutEdges = edgesList.map(edge => {
            const sourceNode = layoutNodes.find(n => n.id === edge.source);
            const targetNode = layoutNodes.find(n => n.id === edge.target);
            const minLen = (sourceNode && targetNode)
                ? Math.max(1, targetNode.data.fixedLevel - sourceNode.data.fixedLevel)
                : 1;

            return {
                ...edge,
                minlen: minLen
            };
        });

        return { rawNodes: layoutNodes, rawEdges: layoutEdges };
    }, [isTreeLoaded, treePanels, storePanels, storeResults, getChildrenIds, getParentId]);

    // 3. 레이아웃 엔진 적용 (Dagre)
    useEffect(() => {
        if (rawNodes.length === 0) return;

        // [FIX] 다그레 기본 설정 복구 (ranksep, nodesep 누락 해결)
        dagreGraph.setGraph({ rankdir: 'LR', ranksep: 450, nodesep: 180 });

        // 1. 노드 등록 (부모 계통의 논리적 순서를 고려하여 정렬하면 다그레가 훨씬 안정적인 수직 배치를 수행함)
        const sortedNodes = [...rawNodes].sort((a, b) => {
            // 레벨(X축) 우선 정렬
            if (a.data?.fixedLevel !== b.data?.fixedLevel) return a.data?.fixedLevel - b.data?.fixedLevel;
            
            // 동일 레벨 내에서는 부모 타입과 노드 타입을 조합해 일관된 순서 부여 (TR -> Generator -> Others)
            const getSortPriority = (node) => {
                if (node.data?.isTransformer) return 0;
                if (node.data?.type === 'hv') return 1;
                if (node.data?.type === 'source') return 2;
                if (node.id === 'GENERATOR' || node.data?.type === 'generator') return 10;
                return 5;
            };

            const pA = getSortPriority(a);
            const pB = getSortPriority(b);
            if (pA !== pB) return pA - pB;

            // 부모 ID가 있는 경우 부모끼리 묶기
            const parentA = a.data?.primaryParentId || "";
            const parentB = b.data?.primaryParentId || "";
            return parentA.localeCompare(parentB);
        });

        sortedNodes.forEach((node) => {
            const isGen = node.id === 'GENERATOR' || node.data.type === 'generator';
            dagreGraph.setNode(node.id, {
                width: NODE_WIDTH,
                height: isGen ? NODE_HEIGHT * 5 : NODE_HEIGHT,
                rank: node.data.fixedLevel
            });
        });

        // 2. 엣지 등록 (발전기 발 연결선은 다그레의 Y축 계산에서 제외하여 그룹 이탈 방지)
        rawEdges.forEach((edge) => {
            const isGenEdge = edge.source === 'GENERATOR' || edge.source?.id === 'GENERATOR';
            if (!isGenEdge) {
                dagreGraph.setEdge(edge.source, edge.target, {
                    minlen: edge.minlen || 1
                });
            }
        });

        try { dagre.layout(dagreGraph); } catch (e) { console.error("Dagre Layout Error", e); }

        const layoutedNodes = rawNodes.map((node) => {
            const nodeWithPosition = dagreGraph.node(node.id);
            if (!nodeWithPosition) return node;
            const targetX = node.data.fixedLevel * LEVEL_SPACING;
            const targetY = nodeWithPosition.y - NODE_HEIGHT / 2;

            return {
                ...node,
                targetPosition: 'left',
                sourcePosition: 'right',
                data: {
                    ...node.data,
                    dagreY: targetY, // 물리 엔진이 참고할 원래 높이
                    fixedLevel: node.data.fixedLevel // 물리 엔진이 참고할 레이어 정보
                },
                position: {
                    x: targetX, // 레벨 기반 X축 고정
                    y: targetY,
                },
            };
        });

        setNodes(layoutedNodes);
        setEdges(rawEdges);
    }, [rawNodes, rawEdges]);

    // 외부 명령에 의한 레이아웃 재배치 리스너
    useEffect(() => {
        const handleAutoLayout = (e) => {
            const currentNodes = e.detail?.nodes || nodes;
            const currentEdges = e.detail?.edges || edges;
            const targetSetNodes = e.detail?.setNodes || setNodes;

            if (currentNodes && currentNodes.length > 0) {
                // [SYNC] 메인 레이아웃 설정과 동기화 (ranksep 450, nodesep 180)
                dagreGraph.setGraph({ rankdir: 'LR', ranksep: 450, nodesep: 180 });
                currentNodes.forEach((node) => {
                    const isGen = node.id === 'GENERATOR' || node.data.type === 'generator';
                    dagreGraph.setNode(node.id, {
                        width: NODE_WIDTH,
                        height: isGen ? NODE_HEIGHT * 5 : NODE_HEIGHT
                    });
                });
                currentEdges.forEach((edge) => dagreGraph.setEdge(edge.source, edge.target));
                try { dagre.layout(dagreGraph); } catch (err) { console.error(err); }
                const newLayoutedNodes = currentNodes.map((node) => {
                    const nodeWithPosition = dagreGraph.node(node.id);
                    if (!nodeWithPosition) return node;
                    return {
                        ...node,
                        position: {
                            x: (node.data?.fixedLevel || 0) * LEVEL_SPACING,
                            y: nodeWithPosition.y - NODE_HEIGHT / 2,
                        },
                    };
                });
                targetSetNodes([...newLayoutedNodes]);
            }
        };
        document.addEventListener('kelc_trigger_auto_layout', handleAutoLayout);
        return () => document.removeEventListener('kelc_trigger_auto_layout', handleAutoLayout);
    }, [nodes, edges]);

    return { nodes, edges, loading };
};

export default useGraphData;

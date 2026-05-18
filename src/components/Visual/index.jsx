import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import {
    ReactFlow,
    MiniMap,
    Background,
    useNodesState,
    useEdgesState,
    BackgroundVariant,
    Panel,
    useReactFlow,
    ReactFlowProvider,
    EdgeLabelRenderer
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ZoomIn, ZoomOut, Maximize, Waypoints, Percent } from 'lucide-react';
import * as d3 from 'd3-force';

import useGraphData from './Logic/useGraphData';
import PanelNodeCard from './UI/PanelNodeCard';
import VisualSkeleton from './UI/VisualSkeleton';
import ConnectionTooltip from './UI/ConnectionTooltip';

const LEVEL_SPACING = 600;
const NODE_WIDTH = 220;
const NODE_HEIGHT = 100;

// 사용자 정의 통합 툴바 컴포넌트
const CustomToolbar = ({ onAutoLayout, isDemandMode, setIsDemandMode, position }) => {
    const { zoomIn, zoomOut, fitView } = useReactFlow();
    const isMobile = position === 'bottom-center';

    return (
        <Panel
            position={position}
            className={`${isMobile ? 'mb-12' : 'm-8'} flex items-center justify-center`}
        >
            <div
                className="flex items-center gap-1.5 bg-white/95 backdrop-blur-md shadow-[0_12px_40px_-10px_rgb(0,0,0,0.12)] rounded-full p-2 border border-slate-200/80 transition-all"
                style={{
                    transform: isMobile ? 'scale(0.8)' : 'scale(1)',
                    transformOrigin: 'bottom'
                }}
            >
                <button onClick={() => zoomIn()} className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50/80 rounded-full transition-all" title="확대">
                    <ZoomIn size={18} />
                </button>
                <button onClick={() => zoomOut()} className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50/80 rounded-full transition-all" title="축소">
                    <ZoomOut size={18} />
                </button>
                <div className="w-[1px] h-5 bg-slate-200 mx-1"></div>
                <button onClick={() => fitView({ duration: 800, padding: 0.2 })} className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50/80 rounded-full transition-all" title="화면 맞춤">
                    <Maximize size={18} />
                </button>
                <div className="w-[1px] h-5 bg-slate-200 mx-1"></div>
                <button
                    onClick={onAutoLayout}
                    className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50/80 rounded-full transition-all group"
                    title="자동 정렬"
                >
                    <Waypoints size={18} className="transition-transform group-hover:rotate-12" />
                </button>
                <div className="w-[1px] h-5 bg-slate-200 mx-1"></div>
                <button
                    onClick={() => setIsDemandMode(!isDemandMode)}
                    className={`p-2.5 rounded-full transition-all flex items-center justify-center ${isDemandMode ? 'text-indigo-600 bg-indigo-50 shadow-inner' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50/80'}`}
                    title={isDemandMode ? "토탈 부하 보기" : "수용률 적용 보기"}
                >
                    <Percent size={18} />
                </button>
            </div>
        </Panel>
    );
};

const VisualInternal = () => {
    const { nodes: initialNodes, edges: initialEdges, loading } = useGraphData();
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [isDemandMode, setIsDemandMode] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [clickedEdge, setClickedEdge] = useState(null);
    const { screenToFlowPosition } = useReactFlow();

    // 물리 시뮬레이션 관련 Refs
    const simulationRef = useRef(null);
    const nodesRef = useRef([]);

    // 에지 클릭 핸들러 (케이블 정보 말풍선)
    const onEdgeClick = useCallback((event, edge) => {
        if (edge.data?.connectionInfo) {
            const position = screenToFlowPosition({
                x: event.clientX,
                y: event.clientY
            });
            setClickedEdge({
                info: edge.data.connectionInfo,
                x: position.x,
                y: position.y
            });
        }
    }, [screenToFlowPosition]);

    const onPaneClick = useCallback(() => {
        setClickedEdge(null);
    }, []);

    // 물리 시뮬레이션 기반 노드 위치 업데이트
    const updateNodesFromSimulation = useCallback(() => {
        setNodes((nds) => {
            return nds.map((node) => {
                const simNode = nodesRef.current.find((n) => n.id === node.id);
                if (simNode) {
                    return {
                        ...node,
                        position: { x: simNode.x, y: simNode.y }
                    };
                }
                return node;
            });
        });
    }, [setNodes]);

    // 물리 시뮬레이션 초기화 및 관리
    useEffect(() => {
        if (loading || initialNodes.length === 0) return;

        // 시뮬레이션용 데이터 노드 구축
        nodesRef.current = initialNodes.map((n) => ({
            ...n,
            x: n.position.x,
            y: n.position.y,
            level: n.data.fixedLevel || 0,
            targetY: n.data.dagreY || n.position.y
        }));

        // 시뮬레이션 상세 설정 - 더 부드럽고 가벼운 느낌으로 튜닝
        simulationRef.current = d3
            .forceSimulation(nodesRef.current)
            // 1. 위상 고정: X축은 레벨별로 강력하게 유지 (계통 구조 보존)
            .force('x', d3.forceX((d) => d.level * LEVEL_SPACING).strength(1.2))
            // 2. 부모 추적 Force: 자식 노드가 부모의 Y축을 따라가도록 설정 (집단성 강화)
            .force('parentAlignment', (alpha) => {
                for (const node of nodesRef.current) {
                    const pId = node.data?.primaryParentId;
                    if (pId) {
                        const parent = nodesRef.current.find(n => n.id === pId);
                        if (parent) {
                            // [EXCLUSION] 발전기 관련 노드들은 수직 인력에서 비켜나게 설정
                            const isGenRelated = node.id === 'GENERATOR' || node.data?.type === 'generator' || parent.id === 'GENERATOR' || parent.data?.type === 'generator';
                            if (!isGenRelated) {
                                // 0.05 로 조절하여 낙오 노드를 당기되, 과도한 응집으로 인한 꼬임 방지
                                node.vy += (parent.y - node.y) * 0.05 * alpha;
                            }
                        }
                    }
                }
            })
            // 3. 수직 복원: 다그레의 계산 결과(겹치지 않는 순서)를 가장 강력한 기준으로 신뢰
            .force('y', d3.forceY((d) => d.targetY).strength(0.25)) // 0.12 -> 0.25 상향하여 겹침 강제 해소
            // 4. 충돌 방지: 노드 간 간격을 넉넉히 조절하여 엉킹 방지
            .force('collide', d3.forceCollide().radius(d => {
                const isGen = d.id === 'GENERATOR' || d.data?.type === 'generator';
                return isGen ? 250 : 120; // 115 -> 120 상향
            }).iterations(4))
            // 5. 전역 척력: 밀어내는 힘으로 전체 평면 고루 사용
            .force('charge', d3.forceManyBody().strength(-120)) // -100 -> -120 상향
            .alphaDecay(0.015) // 더 빠르게 안정된 위치로 안착 (0.008 -> 0.015)
            .velocityDecay(0.4) // 마찰을 적절히 조절하여 진동 억제
            .on('tick', updateNodesFromSimulation);

        return () => {
            if (simulationRef.current) simulationRef.current.stop();
        };
    }, [initialNodes, loading, updateNodesFromSimulation]);

    // 노드 드래그 시작: 물리 엔진에 고정 좌표(fx, fy) 할당
    const onNodeDragStart = useCallback((event, node) => {
        const simNode = nodesRef.current.find((n) => n.id === node.id);
        if (simNode) {
            simNode.fx = node.position.x;
            simNode.fy = node.position.y;
            if (simulationRef.current) simulationRef.current.alphaTarget(0.2).restart();
        }
    }, []);

    // 노드 드래그 중: 고정 좌표 실시간 업데이트 (주변 노드가 밀려남)
    const onNodeDrag = useCallback((event, node) => {
        const simNode = nodesRef.current.find((n) => n.id === node.id);
        if (simNode) {
            simNode.fx = node.position.x;
            simNode.fy = node.position.y;
        }
    }, []);

    // 노드 드래그 종료: 고정 해제하여 자연스럽게 최종 위치 정착
    const onNodeDragStop = useCallback((event, node) => {
        const simNode = nodesRef.current.find((n) => n.id === node.id);
        if (simNode) {
            simNode.fx = null;
            simNode.fy = null;
            // 드래그가 종료된 현재 위치를 새로운 '기준 높이'로 설정하여 다시 가라앉지 않게 함
            simNode.targetY = node.position.y;

            if (simulationRef.current) {
                simulationRef.current.alphaTarget(0);
                simulationRef.current.alpha(0.1).restart(); // 새로운 위치로의 정착 유도
            }
        }
    }, []);

    // 데이터 변경 시 초기화 (초기 로드 시에만 실행되도록 의존성 관리)
    useEffect(() => {
        if (!loading && initialNodes.length > 0) {
            setNodes(initialNodes.map(node => ({
                ...node,
                data: { ...node.data, isDemandMode }
            })));
            setEdges(initialEdges);
        }
    }, [initialNodes, initialEdges, loading, setNodes, setEdges]); // isDemandMode 제거 (리셋 방지)

    // 수용률 모드 전환 시 데이터만 업데이트 (위치는 보존)
    useEffect(() => {
        setNodes((nds) =>
            nds.map((node) => ({
                ...node,
                data: { ...node.data, isDemandMode }
            }))
        );
    }, [isDemandMode, setNodes]);

    const nodeTypes = useMemo(() => ({ panelNode: PanelNodeCard }), []);

    const onAutoLayout = useCallback(() => {
        if (simulationRef.current) {
            simulationRef.current.alpha(1).alphaTarget(0).restart();
        }
    }, []);

    const projectName = useMemo(() => {
        try {
            const saved = localStorage.getItem('kelc_project_info');
            if (saved) return JSON.parse(saved).projectName || 'Project';
        } catch (e) { }
        return 'Project';
    }, []);

    if (loading) {
        return <VisualSkeleton />;
    }

    return (
        <div className="w-full h-[calc(100dvh-50px)] relative" style={{ backgroundColor: '#f8fafc' }}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onEdgeClick={onEdgeClick}
                onPaneClick={onPaneClick}
                onNodeDragStart={onNodeDragStart}
                onNodeDrag={onNodeDrag}
                onNodeDragStop={onNodeDragStop}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                minZoom={0.1}
                maxZoom={1.5}
                defaultEdgeOptions={{
                    type: 'smoothstep', // [Refined] 직선보다 부드러운 라운드형 꺾임선 적용
                    style: { stroke: '#94a3b8', strokeWidth: 1.5, opacity: 0.7 },
                    pathOptions: { borderRadius: 30 } // [Aesthetic] 곡선미를 위한 큰 반지름 설정
                }}
            >
                <Background color="#cbd5e1" variant={BackgroundVariant.Dots} gap={24} size={2} />

                <CustomToolbar
                    onAutoLayout={onAutoLayout}
                    isDemandMode={isDemandMode}
                    setIsDemandMode={setIsDemandMode}
                    position={isMobile ? "bottom-center" : "bottom-left"}
                />

                <div className="hidden md:block">
                    <MiniMap
                        nodeColor={(n) => {
                            if (n.data?.type === 'generator') return '#f43f5e';
                            if (n.data?.type?.includes('transformer') || n.data?.type === 'source' || n.data?.type === 'receiving' || n.data?.type === 'hv') return '#fbbf24';
                            if (n.data?.type === 'power-load') return '#818cf8';
                            return '#38bdf8';
                        }}
                        nodeStrokeWidth={3}
                        zoomable
                        pannable
                        className="bg-white border-slate-200 !rounded-xl shadow-md overflow-hidden"
                        maskColor="rgba(240,245,250,0.7)"
                    />
                </div>

                <Panel
                    position="top-left"
                    className="p-4 md:p-8 mt-5 md:m-4 pointer-events-none"
                    style={{
                        transform: isMobile
                            ? 'translate(-15px, -24px)'
                            : 'translate(-20px, -30px)'
                    }}
                >
                    <h2 className="hidden md:block text-slate-800 font-black tracking-tighter text-[20.4px] mb-4">{projectName}</h2>
                    <div className="flex flex-row md:flex-col gap-4 md:gap-2.5 text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em] md:tracking-[0.15em] pl-0.5 md:pl-1">
                        <div className="flex items-center gap-2 md:gap-3">
                            <div className="w-2 md:w-2.5 h-2 md:h-2.5 rounded-full bg-amber-400 shadow-sm border border-white"></div>
                            <span>수배전반</span>
                        </div>
                        <div className="flex items-center gap-2 md:gap-3">
                            <div className="w-2 md:w-2.5 h-2 md:h-2.5 rounded-full bg-sky-400 shadow-sm border border-white"></div>
                            <span>일반부하</span>
                        </div>
                        <div className="flex items-center gap-2 md:gap-3">
                            <div className="w-2 md:w-2.5 h-2 md:h-2.5 rounded-full bg-indigo-400 shadow-sm border border-white"></div>
                            <span>동력부하</span>
                        </div>
                        <div className="flex items-center gap-2 md:gap-3">
                            <div className="w-2 md:w-2.5 h-2 md:h-2.5 rounded-full bg-rose-500 shadow-sm border border-white"></div>
                            <span>발전기</span>
                        </div>
                    </div>
                </Panel>

                <EdgeLabelRenderer>
                    <ConnectionTooltip
                        info={clickedEdge?.info}
                        x={clickedEdge?.x}
                        y={clickedEdge?.y}
                        visible={!!clickedEdge}
                    />
                </EdgeLabelRenderer>
            </ReactFlow>
        </div>
    );
};

const Visual = () => (
    <ReactFlowProvider>
        <VisualInternal />
    </ReactFlowProvider>
);

export default Visual;

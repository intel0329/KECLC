import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Header } from '../Header';
import { useParams, useLocation } from 'react-router-dom';
import { Save, Plus, Minus, Trash2, Download, Calculator, Settings, Info, ChevronRight, ChevronDown, GripVertical, X, FileText, Check, AlertCircle, CheckCircle } from 'lucide-react';
import CB_DATA from '../../data/CB.json';
import { calculateKECJudgment, calculatePanelTotalLoad } from '../../utils/kecCalculations';
import { calculatePanelSize } from './estpl/panelSizeCalculator';
import KECJudgmentDrawer from '../KECJudgmentDrawer';
import PanelKECDrawer from './sections/PanelKECDrawer';
import ParallelConductorPopup from '../ParallelConductorPopup';
import { getProject, updateProject, updatePanelName, getRemoteData, setRemoteData, removeRemoteData, savePanelConnections, performBatchSave } from '../../services/projectService';
import { usePanelLookup } from '../../hooks/usePanelLookup';
import { useConnectionSync } from '../../hooks/useConnectionSync';
import useDataStore from '../../store/useDataStore';
import projectService from '../../services/projectService';
import { useSafetyCheck } from '../../hooks/useSafetyCheck';
import { normalizePhase, isNameDuplicate, getAFValue, getStatusColor } from './utils/mainHelpers';
import { CornerBorders, TableHeader, InputCell, SelectCell } from './ui/PanelLoadUI';
import { SettingsModal } from './modals/SettingsModal';
import { useCircuitHistory } from './hooks/useCircuitHistory';
import { ProjectInfoBar } from './sections/ProjectInfoBar';
import { LoadSummary } from './sections/LoadSummary';
import { ActionModals } from './sections/ActionModals';
import { CircuitTable } from './sections/CircuitTable';
import DemandManager from './Demand/DemandManager';

// Derive unique breaker types from CB_DATA
const BREAKER_TYPES = [...new Set(
    CB_DATA.filter(row => row[0] && typeof row[3] === 'number')
        .map(row => row[0])
)].sort();

const PanelLoadContent = () => {
    // Get URL parameters
    const { projectId, panelId } = useParams();

    // ID-based panel lookup hook (reactive to name changes)
    const { getNameById, getIdByName, getParentId, getChildrenIds, panels, globalUsedPanelIds, isLoaded: lookupLoaded } = usePanelLookup(projectId);

    // [SSOT STORE] 전역 데이터 및 결과 스토어 구독
    const results = useDataStore(state => state.results);
    const panelsData = useDataStore(state => state.panels);
    const syncPanel = useDataStore(state => state.syncPanel);
    const loadPanelStore = useDataStore(state => state.loadPanel);

    // [Phase 1] Hydration Gate & Sync Status
    const [isHydrating, setIsHydrating] = useState(true);
    const isLocalChangeRef = useRef(false);
    
    // [NEW] 레프 및 상태 선언 (상단 이동)
    const lastSavedDataRef = useRef(null); // [GUARD] Server sync guard
    const lastSyncFingerprintRef = useRef(''); // [GUARD] Zustand Sync Fingerprint Guard
    const latestDataRef = useRef(null);
    const lastSyncedNameRef = useRef({ project: '', panel: '' });
    const [isReadyToCheck, setIsReadyToCheck] = useState(false);
    
    // Track if initial data has been loaded to prevent overwriting on mount
    const [isDataLoaded, setIsDataLoaded] = useState(false);
    const forceSaveRef = useRef(false);
    const loadingPanelsRef = useRef(new Set()); // [NEW] 중복 로드 방지

    // Default initial values
    const getDefaultProjectInfo = () => ({
        name: '',
        panelName: '',
        phase: '3Ø-4W',
        voltage: '380V',
        mccbAF: '',
        mccbAT: '',
        fromId: '', // Changed from 'from' to 'fromId' for ID-based storage
        location: '',
        panelSize: '',
        shortCircuitCurrent: '',
        voltageDropLimit: 3,
        branchDistance: 30,
        installType: '매입',
        usageType: '일반',
        door: '',
        box: '',
        wire: 'FCV',
        cableSize: '',
        kecMethod: 'E',
        selectedPhaseLine: 'L1',
        extraSpace: 0,
        demandFactor: 100,
        sourceName: ''
    });

    // Circuit Data Structure - row determines visual position, id is unique identifier
    const initialCircuit = (id, side, row) => ({
        id,
        side,
        row,
        type: '',
        p: '',
        af: '',
        at: '',
        at_th: '',
        at_sc: '',
        sb: '',
        scb: '',
        se: '',
        ssc: '',
        method: '',
        wire: '',
        size: '',
        circuitNo: '',
        loadName: '',
        power: 0,
        unit: 'EA',
        qty: 1,
        phaseLine: 'L1',
        afError: '',
        cableDistance: 15,
        loads: [],
        kecJudgment: {
            at_th: { status: '-', ib: 0, iz145: 0 },
            at_sc: { status: '-', tn: 0, scr: 0, iz: 0, ka1: 0, ka2: 0, ka3: 0 },
            sb: { status: '-', ib: 0, is: 0, iz: 0 },
            scb: { status: '-', ib: 0, is: 0, iz: 0 },
            se: { status: '-', ib: 0, e_percent: 0, e_v: 0, r: 0, cos: 0, x: 0, sin: 0 },
            ssc: { status: '-', size: 0, type: '신설' }
        }
    });

    // General Parameters
    const [projectInfo, setProjectInfo] = useState(getDefaultProjectInfo());

    // KEC Settings State
    const [kecSettings, setKecSettings] = useState({
        shortCircuitSettings: {
            is: 10,
            tn: 0.1,
            k: 143,
            selectedK: { rowIdx: 0, colIdx: 0 }
        },
        cableCondition: {
            area: 50,
            powerFactor: 0.8,
            efficiency: 1.0,
            i2Type: 'industrial'
        },
        selectedFactors: {
            factor2: { rowIdx: null, colIdx: null, value: 1 },
            factor3: { rowIdx: 0, colIdx: 4, value: 1 },
            factor4: { rowIdx: 0, colIdx: 2, value: 1 },
            factor5: { rowIdx: null, colIdx: 5, value: 1 },
            factor6: { rowIdx: 0, colIdx: 1, value: 1 }
        }
    });

    const {
        leftCircuits,
        setLeftCircuits,
        rightCircuits,
        setRightCircuits,
        recordHistory,
        undo,
        redo
    } = useCircuitHistory(
        [initialCircuit(1, 'left', 1)],
        [initialCircuit(1, 'right', 1)]
    );


    // [CONNECTION SYNC] 부모-자식 연결 즉시 동기화
    const collectConnections = useCallback((lCirc, rCirc) => {
        const connections = [];
        const addConns = (circuits) => circuits.forEach(c => c.loads?.forEach(l => {
            if (l.connectedPanelId) connections.push({ child_panel_id: String(l.connectedPanelId) });
        }));
        addConns(lCirc);
        addConns(rCirc);
        return connections;
    }, []);

    const getFlushPayload = useCallback(() => {
        if (!latestDataRef.current || !isDataLoaded) return null;
        const { projectInfo: pInfo, leftCircuits: lCirc, rightCircuits: rCirc } = latestDataRef.current;
        const draftKey = `kelc_panel_draft_${panelId}`;
        const connections = collectConnections(lCirc, rCirc);
        return {
            draftSaveFn: () => setRemoteData(projectId, draftKey, {
                projectInfo: pInfo, leftCircuits: lCirc, rightCircuits: rCirc,
                savedAt: new Date().toISOString(), isDraft: true
            }),
            connections
        };
    }, [panelId, projectId, isDataLoaded, collectConnections]);

    const { flushNow } = useConnectionSync(projectId, panelId, getFlushPayload);

    // [Optimistic Helper] 상태 변경 즉시 브로드캐스트 전파
    const handleImmediateConnectionSync = useCallback((nextLeft, nextRight) => {
        const connections = collectConnections(nextLeft, nextRight);
        const draftKey = `kelc_panel_draft_${panelId}`;
        const pInfo = latestDataRef.current?.projectInfo || projectInfo;
        
        // 1. [Optimistic Local] 전역 계통 맵 즉시 갱신
        useDataStore.setState(state => {
            const nextMap = { ...state.panelConnections };
            // 기존 자식들 제거
            Object.keys(nextMap).forEach(cid => {
                if (String(nextMap[cid]) === String(panelId)) delete nextMap[cid];
            });
            // 새 자식들 등록
            connections.forEach(c => {
                if (c.child_panel_id) nextMap[String(c.child_panel_id)] = String(panelId);
            });
            return { panelConnections: nextMap };
        });

        // 2. [Broadcast & Persist] 타 탭 전파 및 서버 저장
        flushNow(() => setRemoteData(projectId, draftKey, {
            projectInfo: pInfo, leftCircuits: nextLeft, rightCircuits: nextRight,
            savedAt: new Date().toISOString(), isDraft: true
        }), connections);
    }, [panelId, projectId, projectInfo, collectConnections, flushNow]);

    const lastSourceChangeRef = useRef(false); // 수동 SOURCE 변경 여부 추적
    const [isPanelKECDrawerOpen, setIsPanelKECDrawerOpen] = useState(false);

    // Parallel Conductor Popup State
    const [isParallelPopupOpen, setIsParallelPopupOpen] = useState(false);
    const [parallelPopupCircuitId, setParallelPopupCircuitId] = useState(null);

    const handleParallelApply = (updatedMethod) => {
        if (parallelPopupCircuitId) {
            updateCircuit(parallelPopupCircuitId.side, parallelPopupCircuitId.id, 'method', updatedMethod);
            setIsParallelPopupOpen(false);
            setParallelPopupCircuitId(null);
        }
    };


    // Helper functions for storage keys
    const getOriginKey = (pId) => pId ? `kelc_panel_data_${pId}` : null;
    const getDraftKey = (pId) => pId ? `kelc_panel_draft_${pId}` : null;

    // Helper to manage dirty list - now using setRemoteData for persistence
    const markAsDirty = async (pId) => {
        if (!pId) return;
        try {
            const dirtyList = JSON.parse(localStorage.getItem('kelc_dirty_panels') || '[]');
            if (!dirtyList.includes(pId)) {
                dirtyList.push(pId);
                localStorage.setItem('kelc_dirty_panels', JSON.stringify(dirtyList));
                localStorage.setItem('kelc_project_is_dirty', 'true'); // Global flag for UI
                // [NEW] 헤더 등에 즉시 상태 변경 알림
                window.dispatchEvent(new Event('kelc_dirty_state_changed'));
            }
        } catch (e) { console.error(e); }
    };

    const markAsClean = async (pId) => {
        if (!pId) return;
        try {
            const dirtyList = JSON.parse(localStorage.getItem('kelc_dirty_panels') || '[]');
            const newList = dirtyList.filter(id => id !== pId);
            localStorage.setItem('kelc_dirty_panels', JSON.stringify(newList));
            if (newList.length === 0) {
                localStorage.setItem('kelc_project_is_dirty', 'false');
            }
            // [NEW] 헤더 등에 즉시 상태 변경 알림
            window.dispatchEvent(new Event('kelc_dirty_state_changed'));
        } catch (e) { console.error(e); }
    };

    // Helper function to find panel name from project data
    const getPanelNameFromProject = (project, panelId) => {
        if (!project || !panelId) return null;

        // Search through all calculators
        for (const calc of project.calculators || []) {
            if (calc.children) {
                // Check direct children
                const directMatch = calc.children.find(child => child.id === panelId);
                if (directMatch) return directMatch.name;

                // Check nested children (e.g., LP-1층 > LP-식당)
                for (const child of calc.children) {
                    if (child.children) {
                        const nestedMatch = child.children.find(nested => nested.id === panelId);
                        if (nestedMatch) return nestedMatch.name;
                    }
                }
            }
        }
        return null;
    };





    // [Reactive Lookup Helper] Resolve metadata for connected panels from SSOT
    const getEffectiveCircuit = useCallback((c) => {
        if (!c) return null;
        const plLoad = c.loads?.find(l => l.category === 'PL');
        const connId = c.connectedPanelId || plLoad?.connectedPanelId;
        if (!connId || !panelsData[connId]?.projectInfo) return c;
        
        const info = panelsData[connId].projectInfo;
        const subRes = results[connId];

        // [Reactive Power Lookup] Priority: 1. Real-time store, 2. DB Cache, 3. Local stale value
        const effectivePower = subRes ? (subRes.totalLoad || 0) : (info.cachedTotalLoad || c.power || 0);

        // [Reactive Load Items Lookup] 하위 부하 칩(Chip) 표시용 데이터도 동기화
        const effectiveLoads = c.loads?.map(l => {
            if (l.category === 'PL' && l.connectedPanelId) {
                const childRes = results[l.connectedPanelId];
                const childInfo = panelsData[l.connectedPanelId]?.projectInfo || {};
                return {
                    ...l,
                    va: childRes ? (childRes.totalLoad || 0) : (childInfo.cachedTotalLoad || l.va || 0)
                };
            }
            return l;
        }) || [];

        // [Reactive phaseLine Lookup] 자식이 단상일 경우, 자식이 선택한 BUS 상 위치를 부모 회로에 강제 동기화
        const isSinglePhase = normalizePhase(info.phase).includes('1Φ2W') || normalizePhase(info.phase).includes('1Ø-2W');
        const effectivePhaseLine = isSinglePhase ? (info.selectedPhaseLine || 'L1') : (c.phaseLine || 'L1');

        return {
            ...c,
            power: effectivePower,
            loads: effectiveLoads,
            phaseLine: effectivePhaseLine, // 실시간 상 위치 동기화
            p: isSinglePhase ? 2 : (c.p || 4), // 극수 동기화 강화
            type: info.mainBreakerType || c.type || 'MCCB',
            at: info.mccbAT || c.at || '',
            af: info.mccbAF || c.af || '',
            method: info.kecMethod || c.method || '',
            wire: info.wire || c.wire || '',
            size: info.cableSize || c.size || '',
            cableDistance: info.branchDistance || c.cableDistance || 15
        };
    }, [panelsData, results]);

    // [Calculated Values] 상단 배치 (useEffect 종속성 해결)
    const selectedPhaseLine = projectInfo.selectedPhaseLine || 'L1';


    // [Zero-Sync] Recursive Reactive Phase Calculation
    const getAggregateTotals = useCallback((id, visited = new Set()) => {
        if (!id || visited.has(id)) return { 
            l1: 0, l2: 0, l3: 0, i1: 0, i2: 0, i3: 0,
            rawL1: 0, rawL2: 0, rawL3: 0, rawI1: 0, rawI2: 0, rawI3: 0
        };
        visited.add(id);

        let l1 = 0, l2 = 0, l3 = 0, i1 = 0, i2 = 0, i3 = 0;
        let rawL1 = 0, rawL2 = 0, rawL3 = 0, rawI1 = 0, rawI2 = 0, rawI3 = 0;
        let targetCircuits = [];
        let pI = {};

        if (id === panelId) {
            // [SSOT] For the current panel, ALWAYS use local state for immediate reactivity
            targetCircuits = [...leftCircuits, ...rightCircuits];
            pI = projectInfo;
        } else {
            // [Reactive Lookup] For other panels, check the global results store first
            const subResult = results[id];
            if (subResult && subResult.phaseTotals) {
                return {
                    l1: subResult.phaseTotals.l1 || 0,
                    l2: subResult.phaseTotals.l2 || 0,
                    l3: subResult.phaseTotals.l3 || 0,
                    i1: subResult.phaseTotals.i1 || 0,
                    i2: subResult.phaseTotals.i2 || 0,
                    i3: subResult.phaseTotals.i3 || 0,
                    rawL1: subResult.phaseTotals.rawL1 || subResult.phaseTotals.l1 || 0,
                    rawL2: subResult.phaseTotals.rawL2 || subResult.phaseTotals.l2 || 0,
                    rawL3: subResult.phaseTotals.rawL3 || subResult.phaseTotals.l3 || 0,
                    rawI1: subResult.phaseTotals.rawI1 || subResult.phaseTotals.i1 || 0,
                    rawI2: subResult.phaseTotals.rawI2 || subResult.phaseTotals.i2 || 0,
                    rawI3: subResult.phaseTotals.rawI3 || subResult.phaseTotals.i3 || 0
                };
            }

            const data = panelsData[id];
            if (!data) return { 
                l1: 0, l2: 0, l3: 0, i1: 0, i2: 0, i3: 0,
                rawL1: 0, rawL2: 0, rawL3: 0, rawI1: 0, rawI2: 0, rawI3: 0
            };

            pI = data.projectInfo || {};
            // [Fallback] If no real-time result, use persisted cache from DB
            if (pI.cachedPhaseTotals) {
                return {
                    l1: pI.cachedPhaseTotals.l1 || 0,
                    l2: pI.cachedPhaseTotals.l2 || 0,
                    l3: pI.cachedPhaseTotals.l3 || 0,
                    i1: pI.cachedPhaseTotals.i1 || 0,
                    i2: pI.cachedPhaseTotals.i2 || 0,
                    i3: pI.cachedPhaseTotals.i3 || 0,
                    rawL1: pI.cachedPhaseTotals.rawL1 || pI.cachedPhaseTotals.l1 || 0,
                    rawL2: pI.cachedPhaseTotals.rawL2 || pI.cachedPhaseTotals.l2 || 0,
                    rawL3: pI.cachedPhaseTotals.rawL3 || pI.cachedPhaseTotals.l3 || 0,
                    rawI1: pI.cachedPhaseTotals.rawI1 || pI.cachedPhaseTotals.i1 || 0,
                    rawI2: pI.cachedPhaseTotals.rawI2 || pI.cachedPhaseTotals.i2 || 0,
                    rawI3: pI.cachedPhaseTotals.rawI3 || pI.cachedPhaseTotals.i3 || 0
                };
            }

            // [Fallback 2] Recalculate from raw data if necessary
            const type = pI.type || (data.powerLoads ? 'power-load' : 'panel-load');
            if (type === 'panel-load' && (data.leftCircuits || data.rightCircuits)) {
                targetCircuits = [...(data.leftCircuits || []), ...(data.rightCircuits || [])];
            } else {
                targetCircuits = data.powerLoads || (data.leftCircuits || data.rightCircuits ? [...(data.leftCircuits || []), ...(data.rightCircuits || [])] : []);
            }
        }

        const isSinglePhase = normalizePhase(pI.phase).includes('1Φ2W') || normalizePhase(pI.phase).includes('1Ø-2W');
        const selPhase = pI.selectedPhaseLine || 'L1';
        const globalDf = (Number(pI.demandFactor) || 100) / 100;

        targetCircuits.forEach(c => {
            const cleanNum = (val) => Number(String(val || '').replace(/,/g, '')) || 0;
            
            // 1. Raw Connected Power (설비용량)
            let rawPwr = cleanNum(c.power) || cleanNum(c.va) || cleanNum(c.apparentPower);
            if (!rawPwr && c.effectivePower) {
                const pf = cleanNum(c.powerFactor) || 0.8;
                const eff = cleanNum(c.efficiency) || 1.0;
                rawPwr = (cleanNum(c.effectivePower) * 1000) / (pf * eff);
            }

            // 2. Demanded Power (수용용량)
            let demPwr = rawPwr;
            if (c.connectedPanelId) {
                // PL 부하는 하위 panelsData 계산값 그대로 활용 (하단 sub 취합에서 반영)
            } else if (c.loads && c.loads.length > 0) {
                // 상세 부하별 개별 수용률 개별 반영
                demPwr = c.loads.reduce((sum, l) => sum + ((Number(l.qty) || 0) * (Number(l.va) || 0) * ((l.demandFactor === undefined ? 100 : Number(l.demandFactor)) / 100)), 0);
            } else {
                // 직접 입력 회로 개별 수용률 반영
                demPwr = rawPwr * ((c.demandFactor === undefined ? 100 : Number(c.demandFactor)) / 100);
            }
            
            const pStr = String(c.p || c.phase || '4');
            const p = (pStr.includes('1Φ') || pStr.includes('1Ø') || pStr === '2') ? 2 : 4;

            if (isSinglePhase) {
                const demCurr = demPwr / 220;
                const rawCurr = rawPwr / 220;
                if (selPhase === 'L1') { 
                    l1 += demPwr; i1 += demCurr; 
                    rawL1 += rawPwr; rawI1 += rawCurr;
                } else if (selPhase === 'L2') { 
                    l2 += demPwr; i2 += demCurr; 
                    rawL2 += rawPwr; rawI2 += rawCurr;
                } else if (selPhase === 'L3') { 
                    l3 += demPwr; i3 += demCurr; 
                    rawL3 += rawPwr; rawI3 += rawCurr;
                }
            } else {
                if (c.connectedPanelId) {
                    const sub = getAggregateTotals(c.connectedPanelId, visited);
                    if (p === 2) {
                        const totalSubPwr = sub.l1 + sub.l2 + sub.l3;
                        const totalSubCurr = totalSubPwr / 220;
                        const totalSubRawPwr = sub.rawL1 + sub.rawL2 + sub.rawL3;
                        const totalSubRawCurr = totalSubRawPwr / 220;

                        const pl = c.phaseLine || 'L1';
                        if (pl === 'L1') { 
                            l1 += totalSubPwr; i1 += totalSubCurr; 
                            rawL1 += totalSubRawPwr; rawI1 += totalSubRawCurr;
                        } else if (pl === 'L2') { 
                            l2 += totalSubPwr; i2 += totalSubCurr; 
                            rawL2 += totalSubRawPwr; rawI2 += totalSubRawCurr;
                        } else if (pl === 'L3') { 
                            l3 += totalSubPwr; i3 += totalSubCurr; 
                            rawL3 += totalSubRawPwr; rawI3 += totalSubRawCurr;
                        }
                    } else {
                        l1 += sub.l1; l2 += sub.l2; l3 += sub.l3;
                        i1 += sub.i1; i2 += sub.i2; i3 += sub.i3;
                        rawL1 += sub.rawL1; rawL2 += sub.rawL2; rawL3 += sub.rawL3;
                        rawI1 += sub.rawI1; rawI2 += sub.rawI2; rawI3 += sub.rawI3;
                    }
                } else {
                    const demCurr = p === 2 ? demPwr / 220 : demPwr / (380 * Math.sqrt(3));
                    const rawCurr = p === 2 ? rawPwr / 220 : rawPwr / (380 * Math.sqrt(3));
                    if (p === 2) {
                        const pl = c.phaseLine || 'L1';
                        if (pl === 'L1') { 
                            l1 += demPwr; i1 += demCurr; 
                            rawL1 += rawPwr; rawI1 += rawCurr;
                        } else if (pl === 'L2') { 
                            l2 += demPwr; i2 += demCurr; 
                            rawL2 += rawPwr; rawI2 += rawCurr;
                        } else if (pl === 'L3') { 
                            l3 += demPwr; i3 += demCurr; 
                            rawL3 += rawPwr; rawI3 += rawCurr;
                        }
                    } else {
                        const demShare = demPwr / 3;
                        const rawShare = rawPwr / 3;
                        l1 += demShare; l2 += demShare; l3 += demShare;
                        i1 += demCurr; i2 += demCurr; i3 += demCurr;
                        rawL1 += rawShare; rawL2 += rawShare; rawL3 += rawShare;
                        rawI1 += rawCurr; rawI2 += rawCurr; rawI3 += rawCurr;
                    }
                }
            }
        });

        return {
            l1: Math.round(l1 * 10000) / 10000,
            l2: Math.round(l2 * 10000) / 10000,
            l3: Math.round(l3 * 10000) / 10000,
            i1: Math.round(i1 * 10000) / 10000,
            i2: Math.round(i2 * 10000) / 10000,
            i3: Math.round(i3 * 10000) / 10000,
            rawL1: Math.round(rawL1 * 10000) / 10000,
            rawL2: Math.round(rawL2 * 10000) / 10000,
            rawL3: Math.round(rawL3 * 10000) / 10000,
            rawI1: Math.round(rawI1 * 10000) / 10000,
            rawI2: Math.round(rawI2 * 10000) / 10000,
            rawI3: Math.round(rawI3 * 10000) / 10000
        };
    }, [panelId, leftCircuits, rightCircuits, projectInfo, panelsData, results]);

    const phaseTotals = useMemo(() => {
        const result = getAggregateTotals(panelId);
        const { l1, l2, l3, i1, i2, i3, rawL1, rawL2, rawL3, rawI1, rawI2, rawI3 } = result;
        const maxVal = Math.max(l1, l2, l3);
        const maxCurr = Math.max(i1, i2, i3);
        const totalCurr = i1 + i2 + i3;
        
        return { 
            l1, l2, l3, i1, i2, i3, 
            max: Math.round(maxVal * 10000) / 10000, 
            maxCurrent: Math.round(maxCurr * 10000) / 10000, 
            totalCurrent: Math.round(totalCurr * 10000) / 10000,
            rawL1, rawL2, rawL3,
            rawMax: Math.round(Math.max(rawL1, rawL2, rawL3) * 10000) / 10000,
            rawMaxPhaseLoad: Math.round(Math.max(rawL1, rawL2, rawL3) * 10000) / 10000,
            rawMaxCurrent: Math.round(Math.max(rawI1, rawI2, rawI3) * 10000) / 10000,
            rawI1, rawI2, rawI3
        };
    }, [panelId, getAggregateTotals]);
 
    const totalLoad = useMemo(() => {
        const sum = (phaseTotals.rawL1 || 0) + (phaseTotals.rawL2 || 0) + (phaseTotals.rawL3 || 0);
        return Math.round(sum * 10000) / 10000;
    }, [phaseTotals]);
 
    const phaseLoad = phaseTotals.max;

    const imbalanceColor = useMemo(() => { if (normalizePhase(projectInfo.phase).includes('1Φ2W') || totalLoad === 0) return 'text-green-500'; const p1 = (phaseTotals.l1 / totalLoad) * 100, p2 = (phaseTotals.l2 / totalLoad) * 100, p3 = (phaseTotals.l3 / totalLoad) * 100, gap = Math.max(p1, p2, p3) - Math.min(p1, p2, p3); return gap <= 10 ? 'text-green-500' : gap <= 20 ? 'text-sky-400' : gap <= 30 ? 'text-white' : gap <= 40 ? 'text-orange-500' : 'text-red-500'; }, [phaseTotals, totalLoad, projectInfo.phase]);

    const PHASE_LEVELS = { '1Φ2W': 1, '1Φ-2W': 1, '3Φ3W': 2, '3Φ-3W': 2, '3Φ4W': 3, '3Φ-4W': 3, '1Ø-2W': 1, '3Ø-3W': 2, '3Ø-4W': 3, '2': 1, '3': 2, '4': 3 };
    const maxLoadLevel = useMemo(() => { const allCircuits = [...leftCircuits, ...rightCircuits]; return allCircuits.length === 0 ? 0 : Math.max(...allCircuits.map(c => PHASE_LEVELS[String(c.p)] || 1)); }, [leftCircuits, rightCircuits]);
    const isMainPhaseInvalid = useMemo(() => (PHASE_LEVELS[projectInfo.phase] || 3) < maxLoadLevel, [projectInfo.phase, maxLoadLevel]);

    // [Tier 1 -> Tier 2] 실시간 데이터 참조 업데이트
    useEffect(() => {
        latestDataRef.current = { 
            projectInfo: { ...projectInfo, cachedTotalLoad: totalLoad, cachedPhaseTotals: phaseTotals }, 
            leftCircuits, 
            rightCircuits 
        };
    }, [projectInfo, leftCircuits, rightCircuits, totalLoad, phaseTotals]);

    // [판넬 사이즈 계산 로직]
    const calculatedPanelSize = useMemo(() => {
        return calculatePanelSize(
            projectInfo.mccbAF,
            projectInfo.phase,
            leftCircuits,
            rightCircuits
        );
    }, [projectInfo.mccbAF, projectInfo.phase, leftCircuits, rightCircuits]);

    const parallelTargetCircuit = useMemo(() => {
        if (!parallelPopupCircuitId) return null;
        const list = parallelPopupCircuitId.side === 'left' ? leftCircuits : rightCircuits;
        return list.find(c => c.id === parallelPopupCircuitId.id);
    }, [parallelPopupCircuitId, leftCircuits, rightCircuits]);

    // Toast State
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
    const [showExportSaveModal, setShowExportSaveModal] = useState(false);

    const showToast = (message, type = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
    };

    // Undo/Redo Keyboard Listeners
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.ctrlKey) {
                if (e.key === 'z') {
                    if (e.shiftKey) {
                        e.preventDefault();
                        if (redo()) {
                            isLocalChangeRef.current = true;
                            showToast("다시 실행", "success");
                            forceSaveRef.current = true;
                            markAsDirty(panelId);
                        }
                    } else {
                        e.preventDefault();
                        if (undo()) {
                            isLocalChangeRef.current = true;
                            showToast("이전으로 되돌리기", "success");
                            forceSaveRef.current = true;
                            markAsDirty(panelId);
                        }
                    }
                } else if (e.key === 'y') {
                    e.preventDefault();
                    if (redo()) {
                        isLocalChangeRef.current = true;
                        showToast("다시 실행", "success");
                        forceSaveRef.current = true;
                        markAsDirty(panelId);
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [undo, redo, panelId]);

    // Panel name editing state
    const [editingPanelName, setEditingPanelName] = useState('');

    // Source Dropdown Keyboard Nav State
    const [sourceSelectedIndex, setSourceSelectedIndex] = useState(0);
    const [sourceSearchText, setSourceSearchText] = useState('');
    const isProcessingCommit = useRef(false);

    // SOURCE NAME Search states
    const [otherPanels, setOtherPanels] = useState([]);
    const [showSourceDropdown, setShowSourceDropdown] = useState(false);
    const sourceDropdownRef = useRef(null);
    const sourceOptionsRef = useRef(null); 

    useEffect(() => {
        if (showSourceDropdown && sourceOptionsRef.current) {
            const selectedItem = sourceOptionsRef.current.children[sourceSelectedIndex];
            if (selectedItem) {
                selectedItem.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [sourceSelectedIndex, showSourceDropdown]);

    // PL Load Search states
    const [plSearchText, setPlSearchText] = useState('');
    const [activePLDropdown, setActivePLDropdown] = useState(null); 
    const [plSelectedIndex, setPlSelectedIndex] = useState(0); 
    const [plDropdownPos, setPlDropdownPos] = useState({ top: 0, left: 0, width: 0 }); 
    const plDropdownRef = useRef(null);

    const dragOriginRef = useRef(null);

    const updateDropdownPosition = (element) => {
        if (!element) return;
        const rect = element.getBoundingClientRect();
        setPlDropdownPos({
            top: rect.bottom,
            left: rect.left,
            width: rect.width
        });
    };

    const handleSelectPLPanel = async (rowIndex, selectedPanel) => {
        try {
            let remoteData = await getRemoteData(`kelc_panel_draft_${selectedPanel.id}`);
            if (!remoteData || !remoteData.projectInfo) {
                remoteData = await getRemoteData(`kelc_panel_data_${selectedPanel.id}`);
            }
            const totalLoadValue = calculatePanelTotalLoad(remoteData);

            setLoadModal(prev => ({
                ...prev,
                editLoads: prev.editLoads.map((l, i) =>
                    i === rowIndex ? {
                        ...l,
                        name: selectedPanel.name,
                        connectedPanelId: selectedPanel.id,
                        va: totalLoadValue,
                        qty: 1
                    } : l
                )
            }));
            setActivePLDropdown(null);
            setPlSearchText('');
        } catch (e) {
            console.error('Failed to load PL panel data:', e);
        }
    };

    const getCoreDataString = (info, left, right) => {
        const cleanCircuit = (c) => {
            const isConnected = !!(c.connectedPanelId || c.loads?.some(l => l.category === 'PL'));
            return {
                type: isConnected ? '' : String(c.type || ''),
                p: String(c.p || ''),
                at: isConnected ? '' : String(c.at || ''),
                method: isConnected ? '' : String(c.method || ''),
                wire: isConnected ? '' : String(c.wire || ''),
                size: isConnected ? '' : String(c.size || ''),
                circuitNo: String(c.circuitNo || ''),
                loadName: String(c.loadName || ''),
                power: String(c.power || 0),
                phaseLine: String(c.phaseLine || 'L1'),
                cableDistance: isConnected ? '' : String(c.cableDistance || c.cableLength || 15),
                loads: JSON.stringify((c.loads || []).map(l => ({
                    prefix: String(l.prefix || ''),
                    category: String(l.category || ''),
                    name: String(l.name || ''),
                    connectedPanelId: String(l.connectedPanelId || ''),
                    qty: String(l.qty || 0),
                    va: String(l.va || 0)
                })))
            };
        };

        const cleanInfo = {
            name: String(info.name || ''),
            panelName: String(info.panelName || ''),
            fromId: String(info.fromId || ''), 
            location: String(info.location || ''),
            phase: String(info.phase || '3Ø-4W'),
            installType: String(info.installType || '매입'),
            usageType: String(info.usageType || '일반'),
            branchDistance: String(info.branchDistance || 30),
            voltageDropLimit: String(info.voltageDropLimit || 3),
            mccbAF: String(info.mccbAF || ''),
            mccbAT: String(info.mccbAT || ''),
            mainBreakerType: String(info.mainBreakerType || 'MCCB'),
            panelSize: String(info.panelSize || ''),
            shortCircuitCurrent: String(info.shortCircuitCurrent || ''),
            door: String(info.door || ''),
            box: String(info.box || ''),
            wire: String(info.wire || 'FCV'),
            cableSize: String(info.cableSize || ''),
            kecMethod: String(info.kecMethod || 'E'),
            selectedPhaseLine: String(info.selectedPhaseLine || 'L1'),
            extraSpace: String(info.extraSpace || 0),
            demandFactor: String(info.demandFactor || 100),
            sourceName: String(info.sourceName || '')
        };

        return JSON.stringify({
            projectInfo: cleanInfo,
            leftCircuits: left.map(cleanCircuit),
            rightCircuits: right.map(cleanCircuit)
        });
    };



    useEffect(() => {
        const fetchOtherPanels = async () => {
            if (!projectId) return;
            try {
                const project = await getProject(projectId);
                if (project && project.calculators) {
                    const allPanels = [];
                    const extractPanels = (items) => {
                        if (!items) return;
                        items.forEach(item => {
                            if (item.id && item.name) {
                                if (item.id !== panelId) {
                                    allPanels.push({ id: item.id, name: item.name });
                                }
                            }
                            if (item.children) extractPanels(item.children);
                        });
                    };

                    project.calculators.forEach(calc => {
                        if (calc.children) extractPanels(calc.children);
                    });
                    setOtherPanels(allPanels);
                }
            } catch (e) {
                console.error("Failed to fetch other panels:", e);
            }
        };

        fetchOtherPanels();
    }, [projectId, panelId]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (sourceDropdownRef.current && !sourceDropdownRef.current.contains(e.target)) {
                setShowSourceDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (activePLDropdown === null) return; 

        const handlePLClickOutside = (e) => {
            const plContainer = document.querySelector(`[data-pl-dropdown="${activePLDropdown}"]`);
            if (plContainer && !plContainer.contains(e.target)) {
                setActivePLDropdown(null);
                setPlSelectedIndex(0);
            }
        };

        const timeoutId = setTimeout(() => {
            document.addEventListener('mousedown', handlePLClickOutside);
        }, 10);

        return () => {
            clearTimeout(timeoutId);
            document.removeEventListener('mousedown', handlePLClickOutside);
        };
    }, [activePLDropdown]);

    // [Phase 3] Initialization & Blocking Hydration
    useEffect(() => {
        const load = async () => {
            if (!panelId || !projectId || loadingPanelsRef.current.has(panelId)) return;
            loadingPanelsRef.current.add(panelId);
            
            try {
                // [Tier 0] Memory-First Barrier
                const storeState = useDataStore.getState().panels[panelId];
                let loadedInfo = null;
                let loadedLeft = null;
                let loadedRight = null;

                // [Tier 0] 스토어에 유효 데이터가 존재하면 서버 호출 없이 즉시 사용
                // 동일 탭 내 패널 이동 시 재마운트되어도 스토어의 최신 데이터를 신뢰합니다.
                // (새로고침/새 탭 시에는 스토어가 비어있으므로 else 분기의 서버 조회가 정상 작동)
                if (storeState && storeState.projectInfo) {
                    loadedInfo = storeState.projectInfo;
                    loadedLeft = storeState.leftCircuits;
                    loadedRight = storeState.rightCircuits;
                } else {
                    // [Tier 1] LocalStorage Cache
                    const cacheKey = `kelc_panel_cache_${panelId}`;
                    const cached = localStorage.getItem(cacheKey);
                    let cachedData = null;
                    if (cached) {
                        try {
                            cachedData = JSON.parse(cached);
                        } catch (e) { console.warn("Cache parse failed:", e); }
                    }

                    // [Status-Based Hydration] 로컬 캐시가 DIRTY/LOCAL_SAVED면 서버 조회 없이 신뢰
                    if (cachedData && (cachedData.status === 'DIRTY' || cachedData.status === 'LOCAL_SAVED')) {
                        console.log(`[Hydration] Local-First: Trusting Local Cache (${cachedData.status})`);
                        loadedInfo = cachedData.projectInfo;
                        loadedLeft = cachedData.leftCircuits;
                        loadedRight = cachedData.rightCircuits;
                    } else {
                        // [Tier 2] Remote Data 조회 (Draft -> Origin)
                        const draftKey = `kelc_panel_draft_${panelId}`;
                        const originKey = `kelc_panel_data_${panelId}`;
                        
                        const draftData = await getRemoteData(draftKey, projectId);
                        if (draftData) {
                            loadedInfo = draftData.projectInfo;
                            loadedLeft = draftData.leftCircuits;
                            loadedRight = draftData.rightCircuits;
                        } else {
                            const originData = await getRemoteData(originKey, projectId);
                            if (originData) {
                                loadedInfo = originData.projectInfo;
                                loadedLeft = originData.leftCircuits;
                                loadedRight = originData.rightCircuits;
                            } else if (cachedData) {
                                // 서버에 없고 로컬에만 데이터가 있는 경우 (SERVER_SYNCED 등)
                                loadedInfo = cachedData.projectInfo;
                                loadedLeft = cachedData.leftCircuits;
                                loadedRight = cachedData.rightCircuits;
                            }
                        }
                    }
                }

                // Default fallback
                if (!loadedInfo) loadedInfo = getDefaultProjectInfo();
                if (!loadedLeft) loadedLeft = [initialCircuit(1, 'left', 1)];
                if (!loadedRight) loadedRight = [initialCircuit(1, 'right', 1)];

                // 프로젝트 메타데이터 동기화
                try {
                    const project = await getProject(projectId);
                    if (project) {
                        if (project.name) loadedInfo.name = project.name;
                        // [SSOT] Force the actual name from project tree metadata
                        const treePanelName = getPanelNameFromProject(project, panelId);
                        if (treePanelName) loadedInfo.panelName = treePanelName;
                    }
                } catch (err) { console.error('Metadata fetch failed:', err); }

                // [Blocking Hydration] 하위 계산서(을지) 데이터 선제 로드
                // 부모 계산서 렌더링 시 하위 데이터 누락으로 인한 계산 오류 방지
                const subPanelIds = new Set();
                const collectSubIds = (circuits) => circuits.forEach(c => {
                    if (c.connectedPanelId) subPanelIds.add(String(c.connectedPanelId));
                    c.loads?.forEach(l => { if (l.connectedPanelId) subPanelIds.add(String(l.connectedPanelId)); });
                });
                collectSubIds(loadedLeft);
                collectSubIds(loadedRight);

                if (subPanelIds.size > 0) {
                    await Promise.all([...subPanelIds].map(id => loadPanelStore(id, false, projectId)));
                }

                // [INITIALIZE] Initial state capture for save guard
                lastSavedDataRef.current = getCoreDataString(loadedInfo, loadedLeft, loadedRight);

                // UI 상태 일괄 업데이트
                setIsDataLoaded(true);
                setProjectInfo(loadedInfo);
                setEditingPanelName(loadedInfo.panelName || '');
                setLeftCircuits(loadedLeft);
                setRightCircuits(loadedRight);

                // [SSOT Sync] 전역 스토어 즉시 동기화
                useDataStore.getState().syncPanel(panelId, {
                    projectInfo: loadedInfo,
                    leftCircuits: loadedLeft,
                    rightCircuits: loadedRight
                });
                
                // 최소 스켈레톤 노출 시간 보장 (600ms)
                setTimeout(() => {
                    setIsHydrating(false);
                    setIsReadyToCheck(true);
                }, 600);

            } catch (error) {
                console.error('[PanelLoad Hydration] Critical Error:', error);
                setIsDataLoaded(true);
                setIsHydrating(false);
            } finally {
                loadingPanelsRef.current.delete(panelId);
            }
        };

        load();
    }, [panelId, projectId, loadPanelStore]);




    // [NEW] 마운트 시 연결된 하위 계산서(PL 부하) 자동 로드 (새로고침 대응)
    // syncPLCircuits가 panelsData[connectedPanelId]를 참조하므로,
    // 자식 데이터가 스토어에 반드시 먼저 로드되어야 합니다.
    useEffect(() => {
        if (!isDataLoaded) return;

        const collectConnectedIds = (circuits) => {
            const ids = [];
            circuits.forEach(c => {
                const plLoad = c.loads?.find(l => l.category === 'PL');
                if (plLoad?.connectedPanelId) ids.push(plLoad.connectedPanelId);
            });
            return ids;
        };

        const connectedIds = [
            ...collectConnectedIds(leftCircuits),
            ...collectConnectedIds(rightCircuits)
        ];

        let delay = 0;
        connectedIds.forEach(pId => {
            if (pId && !panelsData[pId] && !loadingPanelsRef.current.has(pId)) {
                loadingPanelsRef.current.add(pId);
                setTimeout(async () => {
                    try {
                        await loadPanelStore(pId);
                    } catch (e) {
                        console.error(`[PanelLoad] Failed to pre-load child panel ${pId}:`, e);
                    } finally {
                        loadingPanelsRef.current.delete(pId);
                    }
                }, delay);
                delay += 50;
            }
        });
    }, [isDataLoaded, leftCircuits, rightCircuits, panelsData, loadPanelStore]);

    const syncPLCircuits = useCallback(() => {
        if (!isDataLoaded || !projectId) return;

        const syncSide = (setter, sideName) => {
            setter(prev => {
                let hasChanges = false;
                const updatedCircuits = prev.map((c) => {
                    const plLoad = c.loads?.find(l => l.category === 'PL');
                    if (!plLoad || !plLoad.connectedPanelId) return c;

                    // [ZERO SYNC] 서버/저장소가 아닌 전역 스토어(Zustand)에서 즉시 데이터를 가져옵니다.
                    const remoteData = panelsData[plLoad.connectedPanelId];
                    if (!remoteData || !remoteData.projectInfo) return c;

                    const subResult = results[plLoad.connectedPanelId];
                    
                    // VA 우선순위: Result Store > Cached VA > Raw Data Calculation (Fallback)
                    const newVa = subResult?.totalLoad ?? 
                                  remoteData.projectInfo?.cachedTotalLoad ?? 
                                  calculatePanelTotalLoad(remoteData);
                    
                    const newName = remoteData.projectInfo?.panelName || plLoad.name;
                    
                    const meta = {
                        type: remoteData.projectInfo.mainBreakerType || 'MCCB',
                        phase: remoteData.projectInfo.phase || '3Ø-4W',
                        selectedPhaseLine: remoteData.projectInfo.selectedPhaseLine || 'L1',
                        at: remoteData.projectInfo.mccbAT || '',
                        af: remoteData.projectInfo.mccbAF || '',
                        method: remoteData.projectInfo.kecMethod || 'E',
                        wire: remoteData.projectInfo.wire || 'FCV',
                        size: remoteData.projectInfo.cableSize || '',
                        branchDistance: remoteData.projectInfo.branchDistance || 15
                    };

                    const normalizeMeta = (m) => {
                        if (!m) return {};
                        return {
                            type: String(m.type || 'MCCB'),
                            phase: String(m.phase || '3Ø-4W'),
                            selectedPhaseLine: String(m.selectedPhaseLine || 'L1'),
                            at: String(m.at || ''),
                            af: String(m.af || ''),
                            method: String(m.method || 'E'),
                            wire: String(m.wire || 'FCV'),
                            size: String(m.size || ''),
                            branchDistance: Number(m.branchDistance) || 15
                        };
                    };

                    const normPlMeta = normalizeMeta(plLoad.plMetadata);
                    const normMeta = normalizeMeta(meta);

                    const vaDiffers = Math.abs((Number(plLoad.va) || 0) - (Number(newVa) || 0)) > 0.1;
                    const nameDiffers = String(plLoad.name || '').trim() !== String(newName || '').trim();
                    const childPhaseLine = normMeta.selectedPhaseLine || 'L1';
                    const childPhase = normalizePhase(normMeta.phase);
                    const phaseLineDiffers = (childPhase.includes('2W')) && String(c.phaseLine || 'L1') !== String(childPhaseLine);
                    const metaDiffers = JSON.stringify(normPlMeta) !== JSON.stringify(normMeta);

                    if (vaDiffers || nameDiffers || phaseLineDiffers || metaDiffers || !c.connectedPanelId) {
                        hasChanges = true;
                        let newP = c.p;
                        if (childPhase.includes('2W')) newP = 2;
                        else if (childPhase.includes('3W')) newP = 3;
                        else if (childPhase.includes('4W')) newP = 4;

                        const newLoads = c.loads.map(l =>
                            l.id === plLoad.id ? { 
                                ...l, 
                                name: newName, 
                                va: newVa, 
                                plMetadata: meta 
                            } : l
                        );

                        const updatedCircuit = {
                            ...c,
                            loads: newLoads,
                            // [SSOT 원칙] 자식의 메타데이터(at, af, wire 등)를 부모 상태에 복사 저장하지 않음. 
                            // 오직 구조적 필드(P, PhaseLine, Power)만 업데이트.
                            p: newP,
                            phaseLine: childPhase.includes('2W') ? childPhaseLine : c.phaseLine,
                            power: newLoads.reduce((sum, load) => sum + ((Number(load.qty) || 0) * (Number(load.va) || 0)), 0)
                        };

                        // 계산 시에만 룩업된 메타데이터를 포함한 'Effective' 데이터를 사용
                        const effectiveForCalc = { ...updatedCircuit, ...meta };
                        updatedCircuit.kecJudgment = calculateKECJudgment(effectiveForCalc, kecSettings, projectInfo);
                        updatedCircuit.connectedPanelId = plLoad.connectedPanelId;
                        return updatedCircuit;
                    }
                    return c;
                });

                if (hasChanges) return updatedCircuits;
                return prev;
            });
        };

        syncSide(setLeftCircuits, 'left');
        syncSide(setRightCircuits, 'right');
    }, [isDataLoaded, projectId, panelsData, results, kecSettings, projectInfo, setLeftCircuits, setRightCircuits]);

    useEffect(() => {
        // [ZERO SYNC] 전역 스토어 변경 시 즉시 동기화 실행
        syncPLCircuits();
    }, [panelsData, results]);

    useEffect(() => {
        const handlePanelNameUpdate = (e) => {
            const { panelId: updatedId, newName } = e.detail;
            if (updatedId === panelId) {
                setProjectInfo(prev => ({ ...prev, panelName: newName }));
                setEditingPanelName(newName);
                lastSyncedNameRef.current.panel = newName;
            }
        };

        const handleProjectUpdate = async () => {
            if (projectId) {
                const project = await getProject(projectId);
                if (project) {
                    if (project.name) {
                        setProjectInfo(prev => ({ ...prev, name: project.name }));
                        lastSyncedNameRef.current.project = project.name;
                    }
                    const currentPn = getPanelNameFromProject(project, panelId);
                    if (currentPn) {
                        setProjectInfo(prev => ({ ...prev, panelName: currentPn }));
                        setEditingPanelName(currentPn);
                        lastSyncedNameRef.current.panel = currentPn;
                    }
                }
            }
        };

        window.addEventListener('kelc_panel_name_updated', handlePanelNameUpdate);
        window.addEventListener('kelc_project_info_updated', handleProjectUpdate);

        return () => {
            window.removeEventListener('kelc_panel_name_updated', handlePanelNameUpdate);
            window.removeEventListener('kelc_project_info_updated', handleProjectUpdate);
        };
    }, [panelId, projectId, isDataLoaded, syncPLCircuits]);

    // [Phase 2] Draft 자동 저장 (3s Debounce, Active Origin Only)
    useEffect(() => {
        if (!isDataLoaded || !isReadyToCheck || !isLocalChangeRef.current) return;

        const draftKey = getDraftKey(panelId);
        if (!draftKey) return;

        let isActive = true;
        const timer = setTimeout(async () => {
            if (!isActive || !isLocalChangeRef.current) return;

            const { projectInfo: pInfo, leftCircuits: lCirc, rightCircuits: rCirc } = latestDataRef.current || {};
            if (!pInfo) return;

            // 프로젝트 이름 변경 시 즉시 동기화 (기존 로직 유지)
            if (projectId && panelId) {
                const currentProjName = pInfo.name || '';
                if (currentProjName !== lastSyncedNameRef.current.project) {
                    await updateProject(projectId, { name: currentProjName });
                    lastSyncedNameRef.current.project = currentProjName;
                    window.dispatchEvent(new Event('kelc_project_info_updated'));
                }
            }

            const currentDataString = getCoreDataString(pInfo, lCirc, rCirc);
            if (lastSavedDataRef.current === currentDataString) {
                // [GUARD] No changes since last server sync
                isLocalChangeRef.current = false;
                return;
            }

            try {
                // [Sync Status] 서버 동기화 시작 (Yellow Cloud)
                useDataStore.getState().setSyncStatus('remote', 'saving');
                const startTime = Date.now();

                const dataToSave = { 
                    projectInfo: { ...pInfo, cachedTotalLoad: totalLoad, cachedPhaseTotals: phaseTotals }, 
                    leftCircuits: lCirc, 
                    rightCircuits: rCirc, 
                    savedAt: new Date().toISOString(), 
                    status: 'DIRTY',
                    isDraft: true 
                };
                
                await setRemoteData(projectId, draftKey, dataToSave);

                // 연결 관계(Connections) 저장 (PanelLoad 특화 로직)
                const connections = [];
                const addConns = (circuits) => circuits.forEach(c => c.loads?.forEach(l => { 
                    if (l.connectedPanelId) connections.push({ child_panel_id: String(l.connectedPanelId) }); 
                }));
                addConns(lCirc);
                addConns(rCirc);
                await savePanelConnections(projectId, panelId, connections);

                // [UPDATE] Sync the guard ref after successful save
                lastSavedDataRef.current = currentDataString;
                
                // [Sync Status] 최소 800ms 유지
                const elapsed = Date.now() - startTime;
                const minDuration = 800;
                if (elapsed < minDuration) {
                    await new Promise(resolve => setTimeout(resolve, minDuration - elapsed));
                }

                // [Sync Status] 서버 동기화 완료 (Blue)
                useDataStore.getState().setSyncStatus('remote', 'saved');
                
                // 리더 권한 반납
                isLocalChangeRef.current = false;

                setTimeout(() => {
                    const { syncStatus } = useDataStore.getState();
                    if (syncStatus.remote === 'saved') useDataStore.getState().setSyncStatus('remote', 'idle');
                }, 2000);

            } catch (e) { 
                console.error('Failed to save draft:', e); 
                useDataStore.getState().setSyncStatus('remote', 'error');
            }
        }, 3000);

        return () => {
            isActive = false;
            clearTimeout(timer);
        };
    }, [panelId, projectId, isDataLoaded, isReadyToCheck, totalLoad, phaseTotals, leftCircuits, rightCircuits, syncPanel]);

    useEffect(() => {
        let totalRaw = 0;
        let totalDem = 0;

        const processList = (circuits) => {
            circuits.forEach(c => {
                const isPL = c.connectedPanelId || (typeof c.loadName === 'string' && c.loadName.endsWith('PL'));
                if (isPL) return;

                let rawPwr = Number(c.power) || Number(c.va) || 0;

                if (c.loads && c.loads.length > 0) {
                    c.loads.forEach(l => {
                        if (l.category === 'PL') return;
                        const qty = Number(l.qty) || 0;
                        const va = Number(l.va) || 0;
                        const df = l.demandFactor === undefined ? 100 : Number(l.demandFactor);
                        totalRaw += qty * va;
                        totalDem += qty * va * (df / 100);
                    });
                } else {
                    const df = c.demandFactor === undefined ? 100 : Number(c.demandFactor);
                    totalRaw += rawPwr;
                    totalDem += rawPwr * (df / 100);
                }
            });
        };

        processList(leftCircuits);
        processList(rightCircuits);

        const overallDf = totalRaw > 0 ? Math.round((totalDem / totalRaw) * 100) : 100;
        if (Number(projectInfo.demandFactor) !== overallDf) {
            setProjectInfo(prev => {
                if (Number(prev.demandFactor) === overallDf) return prev;
                return { ...prev, demandFactor: overallDf };
            });
        }
    }, [leftCircuits, rightCircuits, projectInfo.demandFactor]);

    useEffect(() => {
        const handleTriggerSave = async () => {
            const originKey = getOriginKey(panelId);
            const draftKey = getDraftKey(panelId);
            if (!originKey) return;
            try {
                const dataToSave = { 
                    projectInfo: { ...projectInfo, cachedTotalLoad: totalLoad, cachedPhaseTotals: phaseTotals }, 
                    leftCircuits, 
                    rightCircuits, 
                    savedAt: new Date().toISOString(), 
                    status: 'SERVER_SYNCED',
                    isDraft: false 
                };
                await setRemoteData(projectId, originKey, dataToSave);
                await removeRemoteData(draftKey);
                markAsClean(panelId);
                
                // [UPDATE] Sync the guard ref after successful manual save
                lastSavedDataRef.current = getCoreDataString(projectInfo, leftCircuits, rightCircuits);
                
                window.dispatchEvent(new CustomEvent('kelc_save_finished', { detail: { panelId, success: true } }));
            } catch (e) {
                console.error('Failed to manual save:', e);
                window.dispatchEvent(new CustomEvent('kelc_save_finished', { detail: { panelId, success: false, error: e.message } }));
            }
        };

        window.addEventListener('kelc_trigger_save', handleTriggerSave);
        return () => window.removeEventListener('kelc_trigger_save', handleTriggerSave);
    }, [projectInfo, leftCircuits, rightCircuits, panelId, isDataLoaded, projectId]);

    useEffect(() => {
        const handleTriggerDraftSave = async () => {
            if (!isDataLoaded || !panelId || !projectId) return;
            const draftKey = getDraftKey(panelId);
            try {
                const currentDataString = getCoreDataString(projectInfo, leftCircuits, rightCircuits);
                if (lastSavedDataRef.current === currentDataString) {
                    // [GUARD] No changes since last server sync
                    window.dispatchEvent(new CustomEvent('kelc_save_draft_finished', { detail: { panelId, success: true } }));
                    return;
                }

                // [Sync Status] 서버 동기화 시작
                useDataStore.getState().setSyncStatus('remote', 'saving');
                const startTime = Date.now();

                const dataToSave = { 
                    projectInfo: { ...projectInfo, cachedTotalLoad: totalLoad, cachedPhaseTotals: phaseTotals }, 
                    leftCircuits, 
                    rightCircuits, 
                    savedAt: new Date().toISOString(), 
                    status: 'DIRTY',
                    isDraft: true 
                };
                await setRemoteData(projectId, draftKey, dataToSave);
                const connections = [];
                const addConns = (circuits) => circuits.forEach(c => c.loads?.forEach(l => { if (l.connectedPanelId) connections.push({ child_panel_id: String(l.connectedPanelId) }); }));
                addConns(leftCircuits);
                addConns(rightCircuits);
                await savePanelConnections(projectId, panelId, connections);
                
                // [UPDATE] Sync the guard ref after successful save
                lastSavedDataRef.current = currentDataString;

                // [Sync Status] 최소 표시 시간 보장
                const elapsed = Date.now() - startTime;
                if (elapsed < 800) await new Promise(resolve => setTimeout(resolve, 800 - elapsed));

                useDataStore.getState().setSyncStatus('remote', 'saved');
                setTimeout(() => {
                    if (useDataStore.getState().syncStatus.remote === 'saved') useDataStore.getState().setSyncStatus('remote', 'idle');
                }, 2000);

                window.dispatchEvent(new CustomEvent('kelc_save_draft_finished', { detail: { panelId, success: true } }));
            } catch (e) {
                console.error('Failed to save draft on trigger:', e);
                useDataStore.getState().setSyncStatus('remote', 'error');
                window.dispatchEvent(new CustomEvent('kelc_save_draft_finished', { detail: { panelId, success: false } }));
            }
        };

        window.addEventListener('kelc_trigger_save_draft', handleTriggerDraftSave);
        return () => window.removeEventListener('kelc_trigger_save_draft', handleTriggerDraftSave);
    }, [projectInfo, leftCircuits, rightCircuits, panelId, isDataLoaded, projectId]);

    useEffect(() => {
        if (!isDataLoaded) return;
        const existingData = JSON.parse(localStorage.getItem('kelc_project_info') || '{}');
        const dataToSave = { ...projectInfo, projectId: projectId || existingData.projectId || '', projectName: projectInfo.name };
        localStorage.setItem('kelc_project_info', JSON.stringify(dataToSave));
        if (projectInfo.name !== (lastSyncedNameRef.current.project || '')) {
            window.dispatchEvent(new CustomEvent('kelc_project_info_updated'));
        }
    }, [projectInfo.name, projectId, isDataLoaded]);

    const [deleteConfirm, setDeleteConfirm] = useState({ show: false, side: null, row: null, circuitNo: '' });
    const [selectedCircuits, setSelectedCircuits] = useState([]); 
    const [lastSelectedCircuit, setLastSelectedCircuit] = useState(null); 
    const [draggedCircuit, setDraggedCircuit] = useState(null); 
    const [dropTarget, setDropTarget] = useState(null); 
    const [contextMenu, setContextMenu] = useState({ show: false, x: 0, y: 0, side: null, row: null });
    const [clipboard, setClipboard] = useState({ circuits: [], mode: null });

    useEffect(() => {
        const loadLocalSettings = () => {
            try {
                const defaultKey = 'kelc_setting_data';
                const projectKey = projectId ? `${defaultKey}_${projectId}` : defaultKey;
                const saved = localStorage.getItem(projectKey) || localStorage.getItem(defaultKey);
                if (saved) setKecSettings(prev => ({ ...prev, ...JSON.parse(saved) }));
            } catch (e) { console.error('Failed to load local settings:', e); }
        };
        loadLocalSettings();
        window.addEventListener('kelc_settings_updated', loadLocalSettings);
        return () => window.removeEventListener('kelc_settings_updated', loadLocalSettings);
    }, [projectId]);

    useEffect(() => {
        if (!projectId) return;
        const loadRemoteStates = async () => {
            try {
                let settingsLoaded = false;
                const defaultKey = 'kelc_setting_data';
                const projectKey = `${defaultKey}_${projectId}`;
                let perProjectSettings = await getRemoteData(projectKey, projectId);
                if (!perProjectSettings) perProjectSettings = await getRemoteData(defaultKey, projectId);
                if (perProjectSettings) { setKecSettings(prev => ({ ...prev, ...perProjectSettings })); settingsLoaded = true; }
                const savedClipboard = await getRemoteData('kelc_project_clipboard');
                if (savedClipboard) setClipboard(savedClipboard);
            } catch (e) { console.error('Failed to load remote states:', e); }
        };
        loadRemoteStates();
    }, [projectId]);

    const syncSettingsToServer = async (newSettings) => {
        try {
            const defaultKey = 'kelc_setting_data';
            const projectKey = `${defaultKey}_${projectId}`;
            await setRemoteData(projectId, projectKey, newSettings);
        } catch (e) { console.error('Failed to sync settings to server:', e); }
    };

    const syncClipboardToServer = async (newClipboard) => {
        try { await setRemoteData(projectId, 'kelc_project_clipboard', newClipboard); } catch (e) { console.error('Failed to sync clipboard to server:', e); }
    };

    useEffect(() => {
        const recalculate = (circuits) => circuits.map(c => {
            const effective = getEffectiveCircuit(c);
            const judgment = calculateKECJudgment(effective, kecSettings, projectInfo);
            return { ...c, kecJudgment: judgment, ssc: judgment?.ssc?.recommendedSize || c.ssc };
        });
        setLeftCircuits(prev => recalculate(prev));
        setRightCircuits(prev => recalculate(prev));
    }, [kecSettings, projectInfo]);

    const lastFromIdRef = useRef(projectInfo?.fromId || null);
    useEffect(() => {
        lastFromIdRef.current = projectInfo?.fromId || null;
    }, [projectInfo?.fromId]);

    useEffect(() => {
        if (!lookupLoaded || !isDataLoaded || !panelId) return;
        const actualParentId = getParentId(panelId);
        const currentFromId = lastFromIdRef.current;
        
        if (actualParentId && currentFromId !== actualParentId) {
            lastFromIdRef.current = actualParentId; // 즉시 ref를 갱신하여 연속된 렌더링 트랜잭션에서 무한 루프 차단
            updateProjectInfo('fromId', actualParentId);
            forceSaveRef.current = true;
            markAsDirty(panelId);
            if (lastSourceChangeRef.current) { showToast(`SOURCE Updated: ${getNameById(actualParentId)}`); lastSourceChangeRef.current = false; }
        } else if (!actualParentId && currentFromId) {
            lastFromIdRef.current = null; // 즉시 ref를 갱신하여 연속된 렌더링 트랜잭션에서 무한 루프 차단
            if (lastSourceChangeRef.current) { showToast("해당 연결은 유효하지 않습니다", "error"); lastSourceChangeRef.current = false; }
            updateProjectInfo('fromId', null);
            forceSaveRef.current = true;
            markAsDirty(panelId);
        } else if (lastSourceChangeRef.current && currentFromId === actualParentId) {
            if (currentFromId) showToast(`SOURCE Updated: ${getNameById(currentFromId)}`);
            lastSourceChangeRef.current = false;
        }
    }, [lookupLoaded, isDataLoaded, panelId, getParentId, projectInfo.fromId]);

    const [settingsModal, setSettingsModal] = useState(false);
    const handleSaveSettings = (newShortCircuitSettings) => {
        const newSettings = { ...kecSettings, shortCircuitSettings: newShortCircuitSettings };
        setKecSettings(newSettings);
        syncSettingsToServer(newSettings);
        setSettingsModal(false);
        const recalculate = (circuits) => circuits.map(c => { const judgment = calculateKECJudgment(c, newSettings, projectInfo); return { ...c, kecJudgment: judgment, ssc: judgment?.ssc?.recommendedSize || c.ssc }; });
        setLeftCircuits(prev => recalculate(prev));
        setRightCircuits(prev => recalculate(prev));
    };

    const [judgmentDrawer, setJudgmentDrawer] = useState({ show: false, circuit: null, highlightSection: null });
    const [panelHighlightSection, setPanelHighlightSection] = useState(null);
    const openJudgmentDrawer = (circuit, highlightSection = null) => { if (!circuit) return; setJudgmentDrawer({ show: true, circuit, highlightSection }); };
    const closeJudgmentDrawer = () => { setJudgmentDrawer({ show: false, circuit: null, highlightSection: null }); };

    const isCableMethodValid = (circuit) => {
        if (!circuit || !circuit.method || !circuit.size) return true;
        const methodUpper = String(circuit.method).toUpperCase().trim();
        const methodBase = methodUpper.split('X')[0].trim();
        if (methodUpper.includes('X') && circuit.wire === 'HFIX') return false;
        if (circuit.wire === 'HFIX') return ['A1', 'B1', 'D'].includes(methodBase);
        if (circuit.wire !== 'FCV' && circuit.wire !== 'FR8') return true;
        const thresholdArea = kecSettings.cableCondition?.area || 50;
        if (Number(circuit.size) >= thresholdArea) return ['A1', 'B1', 'D', 'F'].includes(methodBase);
        return ['A2', 'B2', 'D', 'E'].includes(methodBase);
    };

    const getMethodDisabledOptions = (circuit) => {
        if (!circuit) return [];
        const thresholdArea = kecSettings.cableCondition?.area || 50;
        if (circuit.wire === 'HFIX') return ['A2', 'B2', 'E', 'F'];
        if (circuit.wire === 'FCV' || circuit.wire === 'FR8') {
            if (Number(circuit.size) >= thresholdArea) return ['A2', 'B2', 'E'];
            return ['A1', 'B1', 'F'];
        }
        return [];
    };

    const [loadModal, setLoadModal] = useState({ show: false, side: null, circuitId: null, editLoads: [] });
    const [showDemandManager, setShowDemandManager] = useState(false);
    const filteredPLPanels = useMemo(() => {
        const usedPanelIds = new Set(globalUsedPanelIds || []);
        const collectFromCircuits = (circuits) => { circuits.forEach(c => { if (loadModal.show && loadModal.circuitId === c.id) return; c.loads?.forEach(l => { if (l.connectedPanelId) usedPanelIds.add(String(l.connectedPanelId)); }); }); };
        collectFromCircuits(leftCircuits);
        collectFromCircuits(rightCircuits);
        if (loadModal.show) loadModal.editLoads.forEach((l, idx) => { if (l.connectedPanelId && idx !== activePLDropdown) usedPanelIds.add(String(l.connectedPanelId)); });
        return (panels || []).filter(p => 
            String(p.id) !== String(panelId) && 
            p.type !== 'transformer' && 
            p.type !== 'low-voltage-receiving' && // [Filter] 저압 수전 용량 계산서 또한 원천으로 간주하여 제외
            !usedPanelIds.has(String(p.id)) && 
            p.name.toLowerCase().includes(plSearchText.toLowerCase())
        );
    }, [panels, panelId, plSearchText, leftCircuits, rightCircuits, loadModal, activePLDropdown, globalUsedPanelIds]);

    const openLoadModal = (side, circuitId) => {
        const circuits = side === 'left' ? leftCircuits : rightCircuits;
        const circuit = circuits.find(c => c.id === circuitId);
        const editLoads = (circuit?.loads || []).length > 0 
            ? circuit.loads.map(l => ({ 
                ...l, 
                qty: (l.qty === 0 || l.qty === undefined) ? '' : l.qty, 
                va: (l.va === 0 || l.va === undefined) ? '' : l.va,
                demandFactor: l.demandFactor === undefined ? 100 : l.demandFactor 
              })) 
            : [{ id: 1, prefix: '', category: '기타', name: '', qty: '', va: '', demandFactor: 100 }];
        setLoadModal({ show: true, side, circuitId, editLoads });
    };

    const closeLoadModal = () => setLoadModal({ show: false, side: null, circuitId: null, editLoads: [] });
    const updateModalLoad = (index, field, value) => setLoadModal(prev => ({ ...prev, editLoads: prev.editLoads.map((load, i) => i === index ? { ...load, [field]: value, ...(field === 'category' && value === 'PL' ? { qty: 1, prefix: '' } : {}) } : load) }));
    const addModalLoadRow = () => setLoadModal(prev => ({ ...prev, editLoads: [...prev.editLoads, { id: prev.editLoads.length > 0 ? Math.max(...prev.editLoads.map(l => l.id || 0)) + 1 : 1, prefix: '', category: '기타', name: '', qty: '', va: '', demandFactor: 100 }] }));
    const removeModalLoadRow = (index) => setLoadModal(prev => ({ ...prev, editLoads: prev.editLoads.filter((_, i) => i !== index) }));

    const saveLoads = () => {
        isLocalChangeRef.current = true;
        const { side, circuitId, editLoads } = loadModal;
        recordHistory(leftCircuits, rightCircuits);
        const validLoads = editLoads.filter(l => l.name && l.name.trim()).map((l, index) => ({ 
            id: index + 1, 
            prefix: l.prefix || '', 
            category: l.category || '기타', 
            name: l.name.trim(), 
            connectedPanelId: l.connectedPanelId, 
            qty: l.qty === '' ? 0 : (Number(l.qty) || 0), 
            va: l.va === '' ? 0 : (Number(l.va) || 0),
            demandFactor: l.demandFactor === undefined ? 100 : (l.demandFactor === '' ? 100 : Number(l.demandFactor))
        }));
        
        const setter = side === 'left' ? setLeftCircuits : setRightCircuits;
        setter(prev => {
            const next = prev.map(circuit => {
                if (String(circuit.id) !== String(circuitId)) return circuit;
                
                let updated = { ...circuit, loads: validLoads };
                
                if (!updated.loadName && validLoads.length > 0) {
                    updated.loadName = validLoads[0].name;
                }

                const plLoad = validLoads.find(l => l.category === 'PL');
                if (plLoad && plLoad.connectedPanelId) {
                    updated.loadName = `"${plLoad.name}"PL`; 
                    updated.connectedPanelId = plLoad.connectedPanelId;
                    
                    const childData = panelsData[plLoad.connectedPanelId];
                    if (childData?.projectInfo) {
                        const pStr = normalizePhase(childData.projectInfo.phase); 
                        if (pStr.includes('2W')) updated.p = 2; 
                        else if (pStr.includes('3W')) updated.p = 3; 
                        else if (pStr.includes('4W')) updated.p = 4;
                    }
                } else if (updated.connectedPanelId || (typeof updated.loadName === 'string' && updated.loadName.endsWith('"PL'))) {
                    updated.connectedPanelId = undefined; 
                    if (typeof updated.loadName === 'string' && updated.loadName.endsWith('"PL')) {
                        updated.loadName = '';
                    }
                    if (validLoads.length === 0) { updated.type = 'MCCB'; updated.at = ''; updated.af = ''; updated.method = ''; updated.wire = ''; updated.size = ''; }
                }
                
                updated.power = validLoads.reduce((sum, load) => sum + ((Number(load.qty) || 0) * (Number(load.va) || 0)), 0);
                
                const effective = getEffectiveCircuit(updated);
                updated.kecJudgment = calculateKECJudgment(effective, kecSettings, projectInfo);
                return updated;
            });

            // [CONNECTION SYNC] 즉시 동기화 실행 (Next State 기반)
            const nextLeft = side === 'left' ? next : leftCircuits;
            const nextRight = side === 'right' ? next : rightCircuits;
            handleImmediateConnectionSync(nextLeft, nextRight);
            
            return next;
        });
        
        closeLoadModal();
        syncPLCircuits();
    };

    const handleSaveDemandManager = (finalLoads) => {
        isLocalChangeRef.current = true;
        recordHistory(leftCircuits, rightCircuits);

        const processCircuitsList = (circuits) => {
            return circuits.map(c => {
                const circuitLoads = finalLoads.filter(l => l.circuitId === c.id);
                if (circuitLoads.length === 0) return c;

                if (c.loads && c.loads.length > 0) {
                    const nextLoads = c.loads.map((l, idx) => {
                        const matched = circuitLoads.find(cl => cl.loadIndex === idx && cl.isDetailed);
                        return matched ? { ...l, demandFactor: matched.demandFactor } : l;
                    });
                    return { ...c, loads: nextLoads };
                } else {
                    const matched = circuitLoads.find(cl => !cl.isDetailed);
                    return matched ? { ...c, demandFactor: matched.demandFactor } : c;
                }
            });
        };

        const updatedLeft = processCircuitsList(leftCircuits);
        const updatedRight = processCircuitsList(rightCircuits);

        setLeftCircuits(updatedLeft);
        setRightCircuits(updatedRight);
        
        handleImmediateConnectionSync(updatedLeft, updatedRight);
        syncPLCircuits();
        showToast("수용률이 성공적으로 연동되었습니다.", "success");
    };


    const getModalTotalVA = () => loadModal.editLoads.reduce((sum, load) => sum + ((Number(load.qty) || 0) * (Number(load.va) || 0)), 0);
    const getMaxRow = () => Math.max(leftCircuits.length > 0 ? Math.max(...leftCircuits.map(c => c.row)) : 0, rightCircuits.length > 0 ? Math.max(...rightCircuits.map(c => c.row)) : 0);
    const getCircuitForRow = (side, row) => (side === 'left' ? leftCircuits : rightCircuits).find(c => c.row === row) || null;
    const isSelected = (side, row) => selectedCircuits.some(s => s.side === side && s.row === row);

    const handleCircuitClick = (e, side, row, circuit) => {
        if (e.target.tagName === 'INPUT') return;
        e.preventDefault(); e.stopPropagation();
        if (e.shiftKey && lastSelectedCircuit) {
            const minRow = Math.min(lastSelectedCircuit.row, row); const maxRow = Math.max(lastSelectedCircuit.row, row);
            const rangeSelection = []; for (let r = minRow; r <= maxRow; r++) rangeSelection.push({ side, row: r });
            setSelectedCircuits(prev => [...prev.filter(s => !(s.side === side && s.row >= minRow && s.row <= maxRow)), ...rangeSelection]);
        } else if (e.ctrlKey || e.metaKey) {
            if (isSelected(side, row)) setSelectedCircuits(prev => prev.filter(s => !(s.side === side && s.row === row)));
            else { setSelectedCircuits(prev => [...prev, { side, row }]); setLastSelectedCircuit({ side, row }); }
        } else { setSelectedCircuits([{ side, row }]); setLastSelectedCircuit({ side, row }); }
    };

    const clearSelection = () => { setSelectedCircuits([]); setLastSelectedCircuit(null); };
    const handleContextMenu = (e, side, row, circuit) => { e.preventDefault(); e.stopPropagation(); if (!isSelected(side, row)) { setSelectedCircuits([{ side, row }]); setLastSelectedCircuit({ side, row }); } setContextMenu({ show: true, x: e.clientX, y: e.clientY, side, row }); };
    const closeContextMenu = () => setContextMenu({ show: false, x: 0, y: 0, side: null, row: null });
    const handleCopy = () => { const circuitsToCopy = selectedCircuits.map(({ side, row }) => { const circuit = getCircuitForRow(side, row); return circuit ? { ...circuit } : null; }).filter(Boolean); const newClipboard = { circuits: circuitsToCopy, mode: 'copy' }; setClipboard(newClipboard); syncClipboardToServer(newClipboard); closeContextMenu(); };
    const handleCut = () => { const circuitsToCut = selectedCircuits.map(({ side, row }) => { const circuit = getCircuitForRow(side, row); return circuit ? { ...circuit, originalSide: side, originalRow: row } : null; }).filter(Boolean); const newClipboard = { circuits: circuitsToCut, mode: 'cut' }; setClipboard(newClipboard); syncClipboardToServer(newClipboard); closeContextMenu(); };

    const handlePaste = () => {
        isLocalChangeRef.current = true;
        if (clipboard.circuits.length === 0) { closeContextMenu(); return; }
        recordHistory(leftCircuits, rightCircuits);
        const targetSide = contextMenu.side || lastSelectedCircuit?.side;
        const targetRow = contextMenu.row !== null ? contextMenu.row : lastSelectedCircuit?.row;
        if (!targetSide || targetRow === undefined || targetRow === null) { closeContextMenu(); return; }
        const mode = clipboard.mode;
        const sorted = [...clipboard.circuits].sort((a, b) => a.row !== b.row ? a.row - b.row : (a.side === 'left' ? 0 : 1) - (b.side === 'left' ? 0 : 1));
        const anchor = sorted[0]; const anchorSideVal = anchor.side === 'left' ? 0 : 1; const targetSideVal = targetSide === 'left' ? 0 : 1;
        const circuitsToPaste = clipboard.circuits.map((circuit) => { const rowOffset = circuit.row - anchor.row; const sideOffset = (circuit.side === 'left' ? 0 : 1) - anchorSideVal; const newRow = targetRow + rowOffset; const newSideVal = targetSideVal + sideOffset; return { ...circuit, side: newSideVal <= 0 ? 'left' : 'right', row: newRow }; });
        const cutPositions = mode === 'cut' ? clipboard.circuits.map(c => ({ side: c.originalSide, row: c.originalRow })) : [];
        let tempMaxId = Math.max(0, ...[...leftCircuits, ...rightCircuits].map(c => c.id));
        const updateSide = (side, setSide) => { setSide(prev => { let next = [...prev]; if (mode === 'cut') { const sideCuts = cutPositions.filter(p => p.side === side); next = next.filter(c => !sideCuts.some(cut => cut.row === c.row)); } const sideCircuitsToPaste = circuitsToPaste.filter(c => c.side === side); if (sideCircuitsToPaste.length > 0) { sideCircuitsToPaste.forEach(pastItem => { next = next.filter(c => c.row !== pastItem.row); tempMaxId++; next.push({ ...pastItem, id: tempMaxId }); }); } return next.sort((a, b) => a.row - b.row); }); };
        updateSide('left', setLeftCircuits); updateSide('right', setRightCircuits);
        if (mode === 'cut') { const emptyClipboard = { circuits: [], mode: null }; setClipboard(emptyClipboard); syncClipboardToServer(emptyClipboard); }
        closeContextMenu(); clearSelection();
    };

    const handleInsertPaste = () => { 
        if (clipboard.circuits.length === 0) { closeContextMenu(); return; } 
        isLocalChangeRef.current = true;
        recordHistory(leftCircuits, rightCircuits);
        const targetSide = contextMenu.side || lastSelectedCircuit?.side;
        const targetRow = contextMenu.row !== null ? contextMenu.row : lastSelectedCircuit?.row;
        if (!targetSide || targetRow === undefined || targetRow === null) { closeContextMenu(); return; }
        const mode = clipboard.mode;
        const sorted = [...clipboard.circuits].sort((a, b) => a.row !== b.row ? a.row - b.row : (a.side === 'left' ? 0 : 1) - (b.side === 'left' ? 0 : 1));
        const anchor = sorted[0]; const anchorSideVal = anchor.side === 'left' ? 0 : 1; const targetSideVal = targetSide === 'left' ? 0 : 1;
        const circuitsToPaste = clipboard.circuits.map((circuit) => { const rowOffset = circuit.row - anchor.row; const sideOffset = (circuit.side === 'left' ? 0 : 1) - anchorSideVal; const newRow = targetRow + rowOffset; const newSideVal = targetSideVal + sideOffset; return { ...circuit, side: newSideVal <= 0 ? 'left' : 'right', row: newRow }; });
        const cutPositions = mode === 'cut' ? clipboard.circuits.map(c => ({ side: c.originalSide, row: c.originalRow })) : [];
        let tempMaxId = Math.max(0, ...[...leftCircuits, ...rightCircuits].map(c => c.id));
        const updateSide = (side, setSide) => { setSide(prev => { let next = [...prev]; if (mode === 'cut') { const sideCuts = cutPositions.filter(p => p.side === side).sort((a, b) => b.row - a.row); sideCuts.forEach(cut => { next = next.filter(c => c.row !== cut.row); next = next.map(c => c.row > cut.row ? { ...c, row: c.row - 1 } : c); }); } const sideCircuitsToPaste = circuitsToPaste.filter(c => c.side === side); if (sideCircuitsToPaste.length > 0) { const minPasteRow = Math.min(...sideCircuitsToPaste.map(c => c.row)); const maxPasteRow = Math.max(...sideCircuitsToPaste.map(c => c.row)); const shiftAmount = maxPasteRow - minPasteRow + 1; next = next.map(c => c.row >= minPasteRow ? { ...c, row: c.row + shiftAmount } : c); const newCircuitsWithIds = sideCircuitsToPaste.map((c) => { tempMaxId++; return { ...c, id: tempMaxId }; }); next = [...next, ...newCircuitsWithIds]; } return next.sort((a, b) => a.row - b.row); }); };
        updateSide('left', setLeftCircuits); updateSide('right', setRightCircuits);
        if (mode === 'cut') { const emptyClipboard = { circuits: [], mode: null }; setClipboard(emptyClipboard); syncClipboardToServer(emptyClipboard); }
        closeContextMenu(); clearSelection();
    };

    const handleDeleteSelected = () => { 
        isLocalChangeRef.current = true;
        recordHistory(leftCircuits, rightCircuits); 
        const leftRowsToDelete = selectedCircuits.filter(s => s.side === 'left').map(s => s.row); 
        const rightRowsToDelete = selectedCircuits.filter(s => s.side === 'right').map(s => s.row); 
        
        let nextLeft = [...leftCircuits];
        let nextRight = [...rightCircuits];

        const getNextSide = (prev, rowsToDelete) => { 
            if (rowsToDelete.length === 0) return prev; 
            let next = [...prev]; 
            [...rowsToDelete].sort((a, b) => b - a).forEach(rowDel => { 
                if (next.some(c => c.row === rowDel)) next = next.filter(c => c.row !== rowDel); 
                else next = next.map(c => c.row > rowDel ? { ...c, row: c.row - 1 } : c); 
            }); 
            return next; 
        }; 

        nextLeft = getNextSide(nextLeft, leftRowsToDelete);
        nextRight = getNextSide(nextRight, rightRowsToDelete);

        setLeftCircuits(nextLeft);
        setRightCircuits(nextRight);
        
        // [CONNECTION SYNC] 즉시 동기화
        handleImmediateConnectionSync(nextLeft, nextRight);

        clearSelection(); 
        closeContextMenu(); 
    };
    const handleInsertRow = () => { 
        if (!contextMenu.side || !contextMenu.row) { closeContextMenu(); return; } 
        isLocalChangeRef.current = true;
        recordHistory(leftCircuits, rightCircuits);
        const targetSide = contextMenu.side; const targetRow = contextMenu.row; const setCircuits = targetSide === 'left' ? setLeftCircuits : setRightCircuits; const nextId = Math.max(0, ...[...leftCircuits, ...rightCircuits].map(c => c.id)) + 1; setCircuits(prev => [...prev.map(c => c.row > targetRow ? { ...c, row: c.row + 1 } : c), initialCircuit(nextId, targetSide, targetRow + 1)].sort((a, b) => a.row - b.row)); closeContextMenu(); };

    const handleDragStart = (e, side, row, circuit) => { if (document.body.dataset.dragFromInput === 'true') { delete document.body.dataset.dragFromInput; e.preventDefault(); return; } delete document.body.dataset.dragFromInput; if (!circuit) return; setDraggedCircuit({ side, row, circuit }); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', JSON.stringify({ side, row })); if (!isSelected(side, row)) setSelectedCircuits([{ side, row }]); };
    const handleDragOver = (e, targetSide, targetRow) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; const rect = e.currentTarget.getBoundingClientRect(); const position = (e.clientY - rect.top) < rect.height / 2 ? 'above' : 'below'; setDropTarget({ side: targetSide, row: targetRow, position }); };
    const handleDragLeave = () => setDropTarget(null);

    const handleDrop = (e, targetSide, targetRow) => {
        e.preventDefault(); const position = dropTarget?.position || 'above'; setDropTarget(null); if (!draggedCircuit) return;
        recordHistory(leftCircuits, rightCircuits); const { side: sourceSide, row: sourceRow, circuit: sourceCircuit } = draggedCircuit;
        if (sourceSide === targetSide && sourceRow === targetRow) { setDraggedCircuit(null); return; }
        const actualTargetRow = position === 'below' ? targetRow + 1 : targetRow;
        isLocalChangeRef.current = true;
        if (sourceSide === targetSide) { (sourceSide === 'left' ? setLeftCircuits : setRightCircuits)(prev => { let temp = prev.filter(c => c.row !== sourceRow).map(c => c.row > sourceRow ? { ...c, row: c.row - 1 } : c); let insertionRow = sourceRow < actualTargetRow ? actualTargetRow - 1 : actualTargetRow; return [...temp.map(c => c.row >= insertionRow ? { ...c, row: c.row + 1 } : c), { ...sourceCircuit, row: insertionRow, side: targetSide }].sort((a, b) => a.row - b.row); }); }
        else { (sourceSide === 'left' ? setLeftCircuits : setRightCircuits)(prev => prev.filter(c => c.row !== sourceRow).map(c => c.row > sourceRow ? { ...c, row: c.row - 1 } : c)); (targetSide === 'left' ? setLeftCircuits : setRightCircuits)(prev => [...prev.map(c => c.row >= actualTargetRow ? { ...c, row: c.row + 1 } : c), { ...sourceCircuit, row: actualTargetRow, side: targetSide }].sort((a, b) => a.row - b.row)); }
        setDraggedCircuit(null); clearSelection();
    };

    const handleDragEnd = () => { setDraggedCircuit(null); setDropTarget(null); clearSelection(); };
    const addCircuitAtRow = (side, row) => { 
        isLocalChangeRef.current = true;
        const circuits = side === 'left' ? leftCircuits : rightCircuits; if (circuits.some(c => c.row === row)) return; const nextId = Math.max(...circuits.map(c => c.id), 0) + 1; (side === 'left' ? setLeftCircuits : setRightCircuits)([...circuits, initialCircuit(nextId, side, row)].sort((a, b) => a.row - b.row)); 
    };
    const removeCircuit = (side, row) => { 
        const circuits = side === 'left' ? leftCircuits : rightCircuits; const circuit = circuits.find(c => c.row === row); if (!circuit) return; if (circuit.type || circuit.loadName || circuit.power > 0) setDeleteConfirm({ show: true, side, row, circuitNo: circuit.circuitNo }); else { isLocalChangeRef.current = true; recordHistory(leftCircuits, rightCircuits); (side === 'left' ? setLeftCircuits : setRightCircuits)(circuits.filter(c => c.row !== row)); } 
    };
    const confirmDelete = () => { 
        isLocalChangeRef.current = true;
        recordHistory(leftCircuits, rightCircuits); 
        const { side, row } = deleteConfirm; 
        
        let nextLeft = [...leftCircuits];
        let nextRight = [...rightCircuits];

        if (side === 'left') {
            nextLeft = nextLeft.filter(c => c.row !== row);
            setLeftCircuits(nextLeft);
        } else {
            nextRight = nextRight.filter(c => c.row !== row);
            setRightCircuits(nextRight);
        }

        // [CONNECTION SYNC] 즉시 동기화
        handleImmediateConnectionSync(nextLeft, nextRight);

        setDeleteConfirm({ show: false, side: null, row: null, circuitNo: '' }); 
    };

    const checkCircularDependency = (potentialParentId) => { if (!potentialParentId) return false; if (potentialParentId === panelId) return true; const isDescendant = (parentId, targetId) => { const children = getChildrenIds(parentId); if (children.includes(targetId)) return true; for (const child of children) { if (isDescendant(child, targetId)) return true; } return false; }; return isDescendant(panelId, potentialParentId); };
    const updateProjectInfo = (field, value) => { 
        isLocalChangeRef.current = true;
        forceSaveRef.current = true; 
        
        // 1. React 로컬 상태 업데이트 (순수 함수 유지)
        setProjectInfo(prev => ({ ...prev, [field]: value }));
        
        // 2. 부수 효과(Zustand 전역 업데이트)는 상태 갱신 콜백 바깥에서 즉시 실행!
        if (['fromId', 'panelName', 'usageType', 'installType', 'branchDistance'].includes(field)) {
            // 최신 상태를 반영하기 위해 현재 클로저의 projectInfo에 새 값을 병합
            const nextProjectInfo = { ...projectInfo, [field]: value };
            const dataToSync = {
                projectInfo: nextProjectInfo,
                leftCircuits,
                rightCircuits
            };
            
            // [Memory-First] Zustand 스토어 즉시 갱신
            syncPanel(panelId, dataToSync);
            
            // [Optimistic Connection] fromId 변경 시 전역 계통 맵 업데이트
            if (field === 'fromId') {
                useDataStore.setState(state => ({
                    panelConnections: { ...state.panelConnections, [panelId]: value }
                }));
            }
        }
    };

    const broadcastListUpdate = useDataStore(state => state.broadcastListUpdate);
    const handlePanelNameCommit = async () => {
        if (isProcessingCommit.current) return;
        const trimmedName = editingPanelName.trim(); 
        if (!trimmedName || trimmedName === projectInfo.panelName) { 
            setEditingPanelName(projectInfo.panelName || ''); 
            return; 
        }
        isProcessingCommit.current = true;
        try {
            const project = await getProject(projectId);
            if (isNameDuplicate(project, trimmedName, panelId)) { 
                showToast(`'${trimmedName}' 이름은 이미 사용 중입니다.`, 'error'); 
                setEditingPanelName(projectInfo.panelName || ''); 
                return; 
            }

            // 1. 로컬 상태 업데이트
            updateProjectInfo('panelName', trimmedName); 
            
            // 2. 서버 업데이트
            const result = await updatePanelName(projectId, panelId, trimmedName); 
            if (result) { 
                lastSyncedNameRef.current.panel = trimmedName; 
                
                // 3. [ZERO SYNC] 즉시 전역 스토어 반영 및 브로드캐스팅
                // syncPanel을 통해 타 탭의 panelsData가 즉시 최신 이름을 가지게 함
                syncPanel(panelId, 
                    { projectInfo: { ...projectInfo, panelName: trimmedName }, leftCircuits, rightCircuits },
                    { totalLoad, phaseTotals }
                );
                
                // Header 및 사이드바 목록 갱신 트리거
                broadcastListUpdate();
                
                window.dispatchEvent(new Event('kelc_project_info_updated'));
                showToast('계산서 이름이 변경되었습니다.');
            }
        } catch (e) { 
            console.error('Failed to update panel name:', e); 
            setEditingPanelName(projectInfo.panelName || ''); 
        } finally { 
            isProcessingCommit.current = false; 
        }
    };

    const updateCircuit = (side, id, field, value) => {
        isLocalChangeRef.current = true;
        const setter = side === 'left' ? setLeftCircuits : setRightCircuits;
        setter(prev => prev.map(c => {
            if (c.id === id) {
                const updated = { ...c, [field]: value };
                const effective = getEffectiveCircuit(updated);
                if (['type', 'p', 'at'].includes(field)) { const { af, error } = getAFValue(effective.type, effective.p, effective.at); updated.af = af; updated.afError = error; }
                if (field === 'p') syncMainPhaseWithLoads(PHASE_LEVELS[String(value)] || 1);
                if (['p', 'at', 'sb', 'scb', 'ssc', 'size', 'power', 'method', 'wire'].includes(field)) { 
                    const judgment = calculateKECJudgment(effective, kecSettings, projectInfo); 
                    updated.kecJudgment = judgment; 
                    updated.ssc = judgment?.ssc?.recommendedSize || updated.ssc; 
                }
                if (field === 'phaseLine') { const connId = updated.connectedPanelId || updated.loads?.find(l => l.category === 'PL')?.connectedPanelId; if (connId) { (async () => { try { let childData = await getRemoteData(`kelc_panel_draft_${connId}`) || await getRemoteData(`kelc_panel_data_${connId}`); if (childData?.projectInfo && normalizePhase(childData.projectInfo.phase).includes('2W')) { childData.projectInfo.selectedPhaseLine = value; await setRemoteData(projectId, `kelc_panel_draft_${connId}`, childData); } } catch (e) { console.error(`[PhaseLine Sync] Failed to sync child ${connId}:`, e); } })(); } }
                return updated;
            }
            return c;
        }));
    };

    const syncMainPhaseWithLoads = useCallback((currentMaxLevel) => { if (currentMaxLevel === 0) return; const mainLevel = PHASE_LEVELS[projectInfo.phase] || 3; if (currentMaxLevel > mainLevel) { let newPhase = projectInfo.phase, newVoltage = projectInfo.voltage; if (currentMaxLevel === 2) { newPhase = '3Ø-3W'; newVoltage = '380V'; } else if (currentMaxLevel === 3) { newPhase = '3Ø-4W'; newVoltage = '380V'; } if (newPhase !== projectInfo.phase) { setProjectInfo(prev => ({ ...prev, phase: newPhase, voltage: newVoltage })); forceSaveRef.current = true; } } }, [projectInfo.phase, projectInfo.voltage]);

    const performExcelExport = () => import('../../utils/excelExport').then(async ({ exportPanelToExcel }) => { const enrichedProjectInfo = { ...projectInfo, sourceName: getNameById(projectInfo.fromId) || '', calculatedPanelSize }; await exportPanelToExcel(enrichedProjectInfo, leftCircuits, rightCircuits, getMaxRow, selectedPhaseLine, phaseTotals, totalLoad); });

    const handleExportSaveConfirm = () => {
        const onSaveFinished = async (e) => {
            window.removeEventListener('kelc_save_finished', onSaveFinished);
            if (e.detail.success) {
                // [NEW] 프로젝트 전체 일괄 저장 수행하여 헤더의 빨간 점(Dirty) 제거
                await projectService.performBatchSave(projectId);
                performExcelExport();
            } else {
                showToast("저장 중 오류가 발생하여 엑셀 추출을 중단합니다.", "error");
            }
            setShowExportSaveModal(false);
        };
        window.addEventListener('kelc_save_finished', onSaveFinished);
        window.dispatchEvent(new CustomEvent('kelc_trigger_save'));
        // 타임아웃 처리
        setTimeout(() => {
            window.removeEventListener('kelc_save_finished', onSaveFinished);
            if (showExportSaveModal) setShowExportSaveModal(false);
        }, 5000);
    };

    const exportToExcel = () => { if (localStorage.getItem('kelc_project_is_dirty') === 'true') setShowExportSaveModal(true); else performExcelExport(); };

    useEffect(() => {
        const handleKeyDown = (e) => { 
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return; 
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
                e.preventDefault();
                setShowDemandManager(prev => !prev);
                return;
            }
            if (e.ctrlKey || e.metaKey) { 
                switch (e.key.toLowerCase()) { 
                    case 'c': if (selectedCircuits.length > 0) { e.preventDefault(); handleCopy(); } break; 
                    case 'x': if (selectedCircuits.length > 0) { e.preventDefault(); handleCut(); } break; 
                    case 'v': if (clipboard.circuits.length > 0) { e.preventDefault(); handlePaste(); } break; 
                    default: break; 
                } 
            } else if (e.key === 'Delete' || e.key === 'Backspace') { 
                if (selectedCircuits.length > 0) { 
                    e.preventDefault(); 
                    handleDeleteSelected(); 
                } 
            } 
        };
        window.addEventListener('keydown', handleKeyDown); 
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedCircuits, clipboard, lastSelectedCircuit, contextMenu]);

    // [SAFETY] KEC 안전 규정 및 'Chk' 감시 훅 통합 (실시간)
    const { maxBranchAT, isATViolation } = useSafetyCheck('panel', { leftCircuits, rightCircuits }, projectInfo, panelsData);

    const hasDecideWarning = useMemo(() => {
        if (!projectInfo) return false;

        // [GUARD] AT 감시: 메인 AT가 분기 최대 AT보다 작거나 같으면 경고 (Chk.)
        if (isATViolation) return true;

        const isCableMethodValid = (info) => { if (!info || !info.kecMethod || !info.cableSize) return true; const baseMethod = info.kecMethod.split(/x|X/)[0]; const isParallel = info.kecMethod.toUpperCase().includes('X'); if (info.wire === 'HFIX') return isParallel ? false : ['A1', 'B1', 'D'].includes(baseMethod); if (info.wire !== 'FCV' && info.wire !== 'FR8') return true; return Number(info.cableSize) >= (kecSettings?.cableCondition?.area || 50) ? ['A1', 'B1', 'D', 'F'].includes(baseMethod) : ['A2', 'B2', 'D', 'E'].includes(baseMethod); };
        if (!isCableMethodValid(projectInfo)) return true;
        const getP = (ph) => ph?.includes('1Ø') ? 2 : ph?.includes('3Ø-3W') ? 3 : 4;
        const p = getP(projectInfo.phase), ib = p === 2 ? totalLoad / 220 : totalLoad / (380 * Math.sqrt(3));
        const judgment = calculateKECJudgment({ ib, at: projectInfo.mccbAT || 0, af: projectInfo.mccbAF || 0, type: projectInfo.mainBreakerType || 'MCCB', size: projectInfo.cableSize || 0, wire: projectInfo.wire || 'FCV', method: projectInfo.kecMethod || 'E', p, cableDistance: projectInfo.branchDistance || 15, scb: projectInfo.shortCircuitCurrent || 0, isGeneral: true }, kecSettings, projectInfo);
        if (!judgment) return false;
        const isFail = (status) => status === 'Fail' || status === 'Error' || status === 'Chk';
        return isFail(judgment.at_b?.status) || isFail(judgment.at_th?.status) || isFail(judgment.at_sc?.status) || isFail(judgment.sb?.status) || isFail(judgment.scb?.status) || isFail(judgment.se?.status) || isFail(judgment.ssc?.status);
    }, [projectInfo, totalLoad, kecSettings, isATViolation]);

    // [Phase 3] Reactive Recalculation Listener
    // 다른 패널(을지)의 데이터가 변경될 때마다 부하 데이터를 최신화합니다.
    const [isCalculating, startTransition] = React.useTransition();
    const [, forceUpdate] = useState({});

    useEffect(() => {
        let prevResults = useDataStore.getState().results;
        
        // [Zustand Subscribe] 스토어 전체를 구독하되 results 슬라이스만 수동으로 비교
        const unsub = useDataStore.subscribe((state) => {
            const newResults = state.results;
            if (newResults === prevResults) return;

            // 현재 판넬과 연결된 하위 판넬의 데이터가 변경되었는지 확인
            const subPanelIds = new Set();
            const collectSubIds = (circuits) => circuits.forEach(c => {
                if (c.connectedPanelId) subPanelIds.add(String(c.connectedPanelId));
                c.loads?.forEach(l => { if (l.connectedPanelId) subPanelIds.add(String(l.connectedPanelId)); });
            });
            collectSubIds(leftCircuits);
            collectSubIds(rightCircuits);

            const hasChanged = [...subPanelIds].some(id => newResults[id] !== prevResults[id]);
            prevResults = newResults;

            if (hasChanged) {
                startTransition(() => {
                    forceUpdate({}); // 리렌더링 트리거
                });
            }
        });
        return () => unsub();
    }, [leftCircuits, rightCircuits]);

    // [Phase 1] External Sync (BroadcastChannel Support via panelsData)
    useEffect(() => {
        const storeData = panelsData[panelId];
        if (!storeData || !isDataLoaded || isLocalChangeRef.current) return;

        // [Optimized] getCoreDataString을 사용한 정밀 비교 및 루프 차단
        const storeDataStr = getCoreDataString(storeData.projectInfo || {}, storeData.leftCircuits || [], storeData.rightCircuits || []);
        if (lastSavedDataRef.current !== storeDataStr) {
            console.log(`[ZERO SYNC] External update received for ${panelId}`);
            if (storeData.projectInfo) {
                setProjectInfo(prev => ({ ...prev, ...storeData.projectInfo }));
                // [PANEL NAME SYNC] 타 탭에서 패널 이름 변경 시 editingPanelName도 동기화
                if (storeData.projectInfo.panelName && storeData.projectInfo.panelName !== editingPanelName) {
                    setEditingPanelName(storeData.projectInfo.panelName);
                }
            }
            if (storeData.leftCircuits) setLeftCircuits(storeData.leftCircuits);
            if (storeData.rightCircuits) setRightCircuits(storeData.rightCircuits);
            lastSavedDataRef.current = storeDataStr;
        }
    }, [panelsData, panelId, isDataLoaded]);

    // [Phase 1] Zero-Sync (Zustand Store Sync)
    useEffect(() => { 
        if (!panelId || !isDataLoaded || !isLocalChangeRef.current) return;
        
        const currentFingerprint = JSON.stringify({
            p: projectInfo,
            l: leftCircuits,
            r: rightCircuits,
            tl: totalLoad,
            pt: phaseTotals
        });

        if (lastSyncFingerprintRef.current === currentFingerprint) {
            return;
        }
        lastSyncFingerprintRef.current = currentFingerprint;

        // 즉시 상태 변경 알림 (인디케이터 초록색)
        useDataStore.getState().setSyncStatus('local', 'saving');

        syncPanel(panelId, { 
            projectInfo: { ...projectInfo, cachedTotalLoad: totalLoad, cachedPhaseTotals: phaseTotals }, 
            leftCircuits, 
            rightCircuits, 
        }, { totalLoad, phaseTotals }); 

        // 로컬 동기화 완료 후 인디케이터 유지
        const timer = setTimeout(() => {
            useDataStore.getState().setSyncStatus('local', 'saved');
            setTimeout(() => {
                const currentLocalStatus = useDataStore.getState().syncStatus?.local;
                if (currentLocalStatus === 'saved') {
                    useDataStore.getState().setSyncStatus('local', 'idle');
                }
            }, 2000);
        }, 500);
        return () => clearTimeout(timer);
    }, [panelId, isDataLoaded, projectInfo, leftCircuits, rightCircuits, totalLoad, phaseTotals, syncPanel]);

    if (isHydrating) {
        return (
            <div className="min-h-screen bg-black text-gray-400 p-2 sm:p-4 lg:p-6 flex flex-col gap-4 overflow-hidden">
                <div className="max-w-[1920px] mx-auto w-full flex flex-col gap-4">
                    {/* Compact Header Skeleton */}
                    <div className="flex justify-between items-center bg-gray-900/20 p-4 rounded-xl border border-white/5">
                        <div className="flex gap-3 items-center">
                            <div className="w-10 h-10 bg-white/5 rounded-lg animate-pulse"></div>
                            <div className="space-y-1.5">
                                <div className="w-48 h-5 bg-white/5 rounded animate-pulse"></div>
                                <div className="w-24 h-3.5 bg-white/5 rounded animate-pulse opacity-50"></div>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <div className="w-24 h-9 bg-white/5 rounded-lg animate-pulse"></div>
                            <div className="w-24 h-9 bg-white/5 rounded-lg animate-pulse"></div>
                        </div>
                    </div>
                    
                    {/* Summary Bar Skeleton */}
                    <div className="h-16 bg-gray-900/10 rounded-xl border border-white/5 animate-pulse"></div>

                    {/* Dual Column Table Skeleton */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-900/20 rounded-xl border border-white/5 p-4 space-y-3">
                            <div className="h-10 bg-white/5 rounded-lg mb-6 opacity-80"></div>
                            {[...Array(20)].map((_, i) => (
                                <div key={i} className="w-full h-8 bg-white/5 rounded-md animate-pulse" style={{ animationDelay: `${i * 50}ms` }}></div>
                            ))}
                        </div>
                        <div className="bg-gray-900/20 rounded-xl border border-white/5 p-4 space-y-3">
                            <div className="h-10 bg-white/5 rounded-lg mb-6 opacity-80"></div>
                            {[...Array(20)].map((_, i) => (
                                <div key={i} className="w-full h-8 bg-white/5 rounded-md animate-pulse" style={{ animationDelay: `${i * 50}ms` }}></div>
                            ))}
                        </div>
                    </div>

                    {/* Bottom Summary Area Skeleton (Covering the red area) */}
                    <div className="mt-2 p-6 bg-gray-900/20 rounded-xl border border-white/5 space-y-4">
                        <div className="flex justify-between items-center">
                            <div className="w-64 h-6 bg-white/5 rounded animate-pulse"></div>
                            <div className="w-32 h-10 bg-white/10 rounded-lg animate-pulse"></div>
                        </div>
                        <div className="grid grid-cols-4 gap-4">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="h-20 bg-white/5 rounded-xl animate-pulse"></div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-gray-300 p-2 sm:p-4 lg:p-6 selection:bg-lime-500/30" onClick={clearSelection}>
            {/* Toast Notification */}
            {toast.show && (
                <div className="fixed bottom-6 md:bottom-10 left-1/2 -translate-x-1/2 z-[9999] anim-fade-in">
                    <div className={`flex items-center gap-3 md:gap-4 px-4 md:px-6 py-3 md:py-4 rounded-xl md:rounded-2xl border shadow-2xl backdrop-blur-md min-w-[280px] md:min-w-[360px] max-w-[90%] ${toast.type === 'error' ? 'bg-red-950/95 border-red-500/50 text-red-100' : 'bg-indigo-950/95 border-indigo-500/50 text-indigo-100'}`}>
                        <div className={`shrink-0 ${toast.type === 'error' ? 'text-red-500' : 'text-indigo-400'}`}>
                            {toast.type === 'error' ? <AlertCircle className="w-[22px] h-[22px] md:w-[28px] md:h-[28px]" /> : <CheckCircle className="w-[22px] h-[22px] md:w-[28px] md:h-[28px]" />}
                        </div>
                        <div className="flex-1 text-[12.5px] md:text-[14.5px] font-medium tracking-wide whitespace-nowrap">{toast.message}</div>
                        <button onClick={() => setToast(prev => ({ ...prev, show: false }))} className="shrink-0 p-1 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"><X className="w-4 h-4 md:w-5 md:h-5" /></button>
                    </div>
                </div>
            )}

            <div className="max-w-[1920px] mx-auto w-full">
                <ProjectInfoBar
                    projectInfo={projectInfo}
                    editingPanelName={editingPanelName}
                    setEditingPanelName={setEditingPanelName}
                    handlePanelNameCommit={handlePanelNameCommit}
                    updateProjectInfo={updateProjectInfo}
                    sourceDropdownRef={sourceDropdownRef}
                    showSourceDropdown={showSourceDropdown}
                    sourceSearchText={sourceSearchText}
                    setSourceSearchText={setSourceSearchText}
                    setShowSourceDropdown={setShowSourceDropdown}
                    setSourceSelectedIndex={setSourceSelectedIndex}
                    sourceSelectedIndex={sourceSelectedIndex}
                    getNameById={getNameById}
                    getParentId={getParentId}
                    panelId={panelId}
                    panels={panels}
                    checkCircularDependency={checkCircularDependency}
                    lastSourceChangeRef={lastSourceChangeRef}
                    forceSaveRef={forceSaveRef}
                    showToast={showToast}
                    isMainPhaseInvalid={isMainPhaseInvalid}
                    maxLoadLevel={maxLoadLevel}
                    PHASE_LEVELS={PHASE_LEVELS}
                    setProjectInfo={setProjectInfo}
                />

                <CircuitTable
                    getMaxRow={getMaxRow}
                    getCircuitForRow={getCircuitForRow}
                    isSelected={isSelected}
                    removeCircuit={removeCircuit}
                    addCircuitAtRow={addCircuitAtRow}
                    updateCircuit={updateCircuit}
                    handleDragStart={handleDragStart}
                    handleDragOver={handleDragOver}
                    handleDragLeave={handleDragLeave}
                    handleDrop={handleDrop}
                    handleDragEnd={handleDragEnd}
                    handleCircuitClick={handleCircuitClick}
                    handleContextMenu={handleContextMenu}
                    openLoadModal={openLoadModal}
                    openJudgmentDrawer={openJudgmentDrawer}
                    results={results}
                    panelsData={panelsData}
                    getAggregateTotals={getAggregateTotals}
                    projectInfo={projectInfo}
                    selectedPhaseLine={selectedPhaseLine}
                    updateProjectInfo={updateProjectInfo}
                    setProjectInfo={setProjectInfo}
                    BREAKER_TYPES={BREAKER_TYPES}
                    isCableMethodValid={isCableMethodValid}
                    getMethodDisabledOptions={getMethodDisabledOptions}
                    setParallelPopupCircuitId={setParallelPopupCircuitId}
                    setIsParallelPopupOpen={setIsParallelPopupOpen}
                    dragOriginRef={dragOriginRef}
                    dropTarget={dropTarget}
                    draggedCircuit={draggedCircuit}
                    getNameById={getNameById}
                    totalLoad={totalLoad}
                    imbalanceColor={imbalanceColor}
                    phaseTotals={phaseTotals}
                />

                <LoadSummary
                    projectInfo={projectInfo}
                    totalLoad={totalLoad}
                    kecSettings={kecSettings}
                    calculateKECJudgment={calculateKECJudgment}
                    setPanelHighlightSection={setPanelHighlightSection}
                    setIsPanelKECDrawerOpen={setIsPanelKECDrawerOpen}
                    hasDecideWarning={hasDecideWarning}
                    exportToExcel={exportToExcel}
                    updateProjectInfo={updateProjectInfo}
                    BREAKER_TYPES={BREAKER_TYPES}
                    phaseLoad={phaseLoad}
                    phaseTotals={phaseTotals}
                    leftCircuits={leftCircuits}
                    rightCircuits={rightCircuits}
                    calculatedPanelSize={calculatedPanelSize}
                    maxLoadLevel={maxLoadLevel}
                    PHASE_LEVELS={PHASE_LEVELS}
                    showToast={showToast}
                    setProjectInfo={setProjectInfo}
                    getNameById={getNameById}
                    panelId={panelId}
                    projectId={projectId}
                />

                <ActionModals
                    contextMenu={contextMenu}
                    closeContextMenu={closeContextMenu}
                    handleCopy={handleCopy}
                    handleCut={handleCut}
                    handlePaste={handlePaste}
                    handleInsertPaste={handleInsertPaste}
                    handleInsertRow={handleInsertRow}
                    handleDeleteSelected={handleDeleteSelected}
                    selectedCircuits={selectedCircuits}
                    clipboard={clipboard}
                    showExportSaveModal={showExportSaveModal}
                    setShowExportSaveModal={setShowExportSaveModal}
                    performExcelExport={performExcelExport}
                    handleExportSaveConfirm={handleExportSaveConfirm}
                    deleteConfirm={deleteConfirm}
                    setDeleteConfirm={setDeleteConfirm}
                    confirmDelete={confirmDelete}
                    loadModal={loadModal}
                    setLoadModal={setLoadModal}
                    leftCircuits={leftCircuits}
                    rightCircuits={rightCircuits}
                    closeLoadModal={closeLoadModal}
                    addModalLoadRow={addModalLoadRow}
                    removeModalLoadRow={removeModalLoadRow}
                    updateModalLoad={updateModalLoad}
                    plSearchText={plSearchText}
                    setPlSearchText={setPlSearchText}
                    setActivePLDropdown={setActivePLDropdown}
                    activePLDropdown={activePLDropdown}
                    setPlSelectedIndex={setPlSelectedIndex}
                    updateDropdownPosition={updateDropdownPosition}
                    handleSelectPLPanel={handleSelectPLPanel}
                    filteredPLPanels={filteredPLPanels}
                    plSelectedIndex={plSelectedIndex}
                    plDropdownPos={plDropdownPos}
                    saveLoads={saveLoads}
                    getModalTotalVA={getModalTotalVA}
                    getNameById={getNameById}
                />

                <DemandManager
                    show={showDemandManager}
                    onClose={() => setShowDemandManager(false)}
                    leftCircuits={leftCircuits}
                    rightCircuits={rightCircuits}
                    onSave={handleSaveDemandManager}
                    getNameById={getNameById}
                />

                <KECJudgmentDrawer
                    isOpen={judgmentDrawer.show}
                    onClose={closeJudgmentDrawer}
                    circuit={judgmentDrawer.circuit}
                    highlightSection={judgmentDrawer.highlightSection}
                    kecSettings={kecSettings}
                    projectInfo={projectInfo}
                    onUpdateCableDistance={(newLength) => {
                        if (judgmentDrawer.circuit) {
                            const side = judgmentDrawer.circuit.side;
                            const circuitId = judgmentDrawer.circuit.id;
                            const setter = side === 'left' ? setLeftCircuits : setRightCircuits;
                            setter(prev => prev.map(c => {
                                if (c.id !== circuitId) return c;
                                const updated = { ...c, cableDistance: newLength };
                                updated.kecJudgment = calculateKECJudgment(updated, kecSettings, projectInfo);
                                return updated;
                            }));
                            setJudgmentDrawer(prev => {
                                if (!prev.circuit) return prev;
                                const updatedCircuit = { ...prev.circuit, cableDistance: newLength };
                                updatedCircuit.kecJudgment = calculateKECJudgment(updatedCircuit, kecSettings, projectInfo);
                                return { ...prev, circuit: updatedCircuit };
                            });
                        }
                    }}
                />

                <PanelKECDrawer
                    isOpen={isPanelKECDrawerOpen}
                    onClose={() => setIsPanelKECDrawerOpen(false)}
                    projectInfo={projectInfo}
                    updateProjectInfo={updateProjectInfo}
                    totalLoad={totalLoad}
                    kecSettings={kecSettings}
                    highlightSection={panelHighlightSection}
                    maxBranchAT={maxBranchAT}
                />

                <SettingsModal
                    show={settingsModal}
                    onClose={() => setSettingsModal(false)}
                    settings={kecSettings.shortCircuitSettings}
                    onSave={handleSaveSettings}
                />

                {isParallelPopupOpen && parallelTargetCircuit && (
                    <ParallelConductorPopup
                        isOpen={isParallelPopupOpen}
                        onClose={() => { setIsParallelPopupOpen(false); setParallelPopupCircuitId(null); }}
                        onApply={handleParallelApply}
                        initialValue={parallelTargetCircuit.method}
                        wire={parallelTargetCircuit.wire}
                        size={parallelTargetCircuit.size}
                        kecSettings={kecSettings}
                    />
                )}
            </div>
        </div>
    );
};

export default PanelLoadContent;

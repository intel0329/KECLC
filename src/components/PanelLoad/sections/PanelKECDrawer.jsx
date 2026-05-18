// src/components/PanelKECDrawer.jsx
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import CB_DATA from '../../../data/CB.json';
import { calculateKECJudgment } from '../../../utils/kecCalculations';
import ParallelConductorPopup from '../../ParallelConductorPopup';

const INSTALL_METHODS = ['A1', 'A2', 'B1', 'B2', 'D', 'E', 'F'];
const WIRE_TYPES = ['HFIX', 'FCV', 'FR8']; // HIV removed
const CABLE_SIZES = ['1.5', '2.5', '4', '6', '10', '16', '25', '35', '50', '70', '95', '120', '150', '185', '240', '300'];

const BREAKER_TYPES = [...new Set(
    CB_DATA.filter(row => row[0] && typeof row[3] === 'number')
        .map(row => row[0])
)].sort();

const CornerBorders = ({ colorClass = "" }) => (
    <>
        <div className={`corner-tl ${colorClass}`} />
        <div className={`corner-tr ${colorClass}`} />
        <div className={`corner-bl ${colorClass}`} />
        <div className={`corner-br ${colorClass}`} />
    </>
);

const PanelKECDrawer = ({ isOpen, onClose, projectInfo, updateProjectInfo, totalLoad, kecSettings, highlightSection, maxBranchAT }) => {
    const [activeHighlight, setActiveHighlight] = useState(null);
    const scrollContainerRef = useRef(null);
    const sectionRefs = useRef({});

    // Parallel Conductor 팝업 상태 관리
    const [isParallelPopupOpen, setIsParallelPopupOpen] = useState(false);
    const [previousMethod, setPreviousMethod] = useState('E');

    const panelPhase = projectInfo?.phase || '3Ø-4W';

    // Validate if installation method matches cable type
    const isCableMethodValid = (info) => {
        if (!info || !info.kecMethod || !info.cableSize) return true;

        const baseMethod = info.kecMethod.split('x')[0].split('X')[0];

        if (info.wire === 'HFIX') {
            if (info.kecMethod.toUpperCase().includes('X')) return false; // HFIX는 병렬포설 불가
            const hfixMethods = ['A1', 'B1', 'D'];
            return hfixMethods.includes(baseMethod);
        }

        if (info.wire !== 'FCV' && info.wire !== 'FR8') return true;

        const circuitSize = Number(info.cableSize);
        const thresholdArea = kecSettings?.cableCondition?.area || 50;

        const smallSizeMethods = ['A2', 'B2', 'D', 'E'];
        const largeSizeMethods = ['A1', 'B1', 'D', 'F'];

        if (circuitSize >= thresholdArea) {
            return largeSizeMethods.includes(baseMethod);
        } else {
            return smallSizeMethods.includes(baseMethod);
        }
    };

    // Get disabled options for method dropdown
    const getMethodDisabledOptions = (info) => {
        if (!info) return [];

        const wire = info.wire;
        const circuitSize = Number(info.cableSize) || 0;
        const thresholdArea = kecSettings?.cableCondition?.area || 50;

        if (wire === 'HFIX') {
            return ['A2', 'B2', 'E', 'F'];
        }

        if (wire === 'FCV' || wire === 'FR8') {
            if (circuitSize >= thresholdArea) {
                return ['A2', 'B2', 'E'];
            } else {
                return ['A1', 'B1', 'F'];
            }
        }
        return [];
    };

    // Helper to calculate the correct number of LINEs based on phase system and cable core type
    const getCableLineCount = (parallelN, size, phaseSystem) => {
        if (!parallelN || parallelN <= 1) return parallelN;
        const cableSize = Number(size) || 0;
        const threshold = Number(kecSettings?.cableCondition?.area) || 50;

        if (cableSize >= threshold) {
            // 단심 케이블 (Single-core)
            let wires = 1;
            if (phaseSystem) {
                const cleanPh = String(phaseSystem).replace(/[-\s]/g, '').replace(/Ø/g, 'Φ').toUpperCase();
                if (cleanPh.includes('3Φ4W') || cleanPh.includes('3상4선')) wires = 4;
                else if (cleanPh.includes('3Φ3W') || cleanPh.includes('3상3선')) wires = 3;
                else if (cleanPh.includes('1Φ') || cleanPh.includes('1상2선')) wires = 2;
                else wires = Number(panelCircuit.p) || 1;
            } else {
                wires = Number(panelCircuit.p) || 1;
            }
            return parallelN * wires;
        }

        // 다심 케이블 (Multi-core)
        return parallelN;
    };

    // Panel circuit construction for KEC Judgment
    const panelCircuit = useMemo(() => {
        if (!projectInfo) return null;

        const getP = (ph) => {
            const cleanPh = String(ph || '').replace(/[-\s]/g, '').replace(/Ø/g, 'Φ').toUpperCase();
            if (cleanPh.includes('1Φ')) return 2;
            if (cleanPh.includes('3Φ3W')) return 3;
            return 4; // default 3Ø-4W
        };

        const p = getP(panelPhase);
        const ib = p === 2 ? totalLoad / 220 : totalLoad / (380 * Math.sqrt(3));

        return {
            ib,
            at: projectInfo.mccbAT || 0,
            af: projectInfo.mccbAF || 0,
            type: projectInfo.mainBreakerType || 'MCCB',
            size: projectInfo.cableSize || 0,
            wire: projectInfo.wire || 'FCV',
            method: projectInfo.kecMethod || 'E',
            p,
            cableDistance: projectInfo.branchDistance || 30, // D
            scb: projectInfo.shortCircuitCurrent || 0,
            isGeneral: true, // Assume non-motor panel for now unless we add motor logic here
        };
    }, [projectInfo, totalLoad, panelPhase]);

    const judgment = useMemo(() => {
        if (!panelCircuit) return {};
        // The third arg to calculateKECJudgment is projectInfo, we pass it settings directly in the second arg
        return calculateKECJudgment(panelCircuit, kecSettings, projectInfo);
    }, [panelCircuit, kecSettings, projectInfo]);

    // [NEW] Calculate recommended size for Voltage Drop (Se%)
    const seRecommendedSize = useMemo(() => {
        if (!panelCircuit) return '-';
        const limit = Number(projectInfo?.voltageDropLimit) || 3;
        
        for (const s of CABLE_SIZES) {
            const testCircuit = { ...panelCircuit, size: s };
            const testJudgment = calculateKECJudgment(testCircuit, kecSettings, projectInfo);
            if (Number(testJudgment.se?.e_percent) <= limit) {
                return s;
            }
        }
        return '300+';
    }, [panelCircuit, kecSettings, projectInfo]);

    // Validation for Main Circuit Breaker (Type, AF, AT combination in CB_DATA)
    const isMainBreakerValid = useMemo(() => {
        const type = projectInfo.mainBreakerType || 'MCCB';
        const af = Number(projectInfo.mccbAF) || 0;
        const at = Number(projectInfo.mccbAT) || 0;

        if (!af || !at) return false;

        return CB_DATA.some(row =>
            row[0] === type &&
            Number(row[5]) === af &&
            Number(row[4]) === at
        );
    }, [projectInfo.mainBreakerType, projectInfo.mccbAF, projectInfo.mccbAT]);

    // [NEW] 분기 회로 AT 감시 (메인 AT보다 크거나 같은 분기 AT가 있는지 확인)
    const isATViolation = useMemo(() => {
        return (maxBranchAT || 0) >= (Number(projectInfo?.mccbAT) || 0);
    }, [maxBranchAT, projectInfo?.mccbAT]);

    useEffect(() => {
        if (isOpen && highlightSection && scrollContainerRef.current) {
            const timer = setTimeout(() => {
                const sectionElement = sectionRefs.current[highlightSection];
                if (sectionElement) {
                    sectionElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    setActiveHighlight(highlightSection);

                    const highlightTimer = setTimeout(() => {
                        setActiveHighlight(null);
                    }, 2000);

                    return () => clearTimeout(highlightTimer);
                }
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [isOpen, highlightSection]);

    const getHighlightClass = (sectionId) => {
        if (activeHighlight === sectionId) {
            return 'animate-pulse text-red-500 transition-colors duration-300';
        }
        return 'text-white';
    };

    if (!projectInfo) return null;

    return (
        <div
            className={`fixed inset-0 z-[1001] bg-black/50 transition-opacity duration-300 ${isOpen ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'}`}
            onClick={onClose}
        >
            <div
                className={`absolute inset-y-0 right-0 w-full max-w-[400px] bg-black border-l border-gray-800 shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex-grow flex flex-col p-6 relative h-full">
                    <CornerBorders />

                    <div className="flex items-center justify-between mb-6 flex-shrink-0">
                        <div>
                            <h2 className="text-xl font-bold text-white tracking-tight">KEC 기술기준 판정</h2>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-gray-900 rounded-full transition-colors font-bold text-gray-400">
                            <X size={24} />
                        </button>
                    </div>

                    <div className="flex-grow overflow-y-auto space-y-8 pr-2 scrollbar-hide pb-6" ref={scrollContainerRef}>

                        {/* 1. Main Specs Configuration */}
                        <section className="space-y-4">
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-4 bg-yellow-500"></div>
                                <h3 className="text-[14px] font-bold uppercase tracking-wider text-yellow-500">"{projectInfo.panelName || '미지정'}" 특성 설정</h3>
                            </div>

                            <div className="bg-gray-900/40 p-4 border border-gray-800/80 space-y-6">
                                {/* 1. Panel Details */}
                                <div className="space-y-2">
                                    <div className="text-[11px] text-gray-300 uppercase tracking-widest font-bold border-b border-gray-800/50 pb-1">Panel Details</div>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[10px] text-gray-400 px-1 text-center">Type</span>
                                            <select
                                                value={projectInfo.usageType || '일반'}
                                                onChange={(e) => updateProjectInfo('usageType', e.target.value)}
                                                className={`bg-black border border-gray-800 h-8 outline-none focus:border-blue-500 text-center w-full font-bold appearance-none cursor-pointer text-[12px] ${projectInfo.usageType === '비상' ? 'text-red-500' : 'text-white'}`}
                                                style={{ textAlignLast: 'center' }}
                                            >
                                                <option value="일반" className="text-white bg-black">일반</option>
                                                <option value="비상" className="text-red-400 bg-black">비상</option>
                                                <option value="필수" className="text-white bg-black">필수</option>
                                                <option value="ELEV" className="text-white bg-black">ELEV</option>
                                            </select>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[10px] text-gray-400 px-1 text-center">Mount</span>
                                            <select
                                                value={projectInfo.installType || '매입'}
                                                onChange={(e) => updateProjectInfo('installType', e.target.value)}
                                                className="bg-black border border-gray-800 h-8 text-white font-bold outline-none focus:border-blue-500 text-center w-full text-[12px] appearance-none cursor-pointer"
                                                style={{ textAlignLast: 'center' }}
                                            >
                                                <option value="매입" className="bg-black">매입</option>
                                                <option value="노출" className="bg-black">노출</option>
                                                <option value="방우" className="bg-black">방우</option>
                                            </select>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[10px] text-gray-400 px-1 text-center">Branch [m]</span>
                                            <input
                                                type="number"
                                                value={projectInfo.branchDistance || 30}
                                                onChange={(e) => updateProjectInfo('branchDistance', e.target.value)}
                                                className="bg-black border border-gray-800 h-8 text-white font-bold outline-none focus:border-blue-500 text-center w-full text-[12px] appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* 2. Power System */}
                                <div className="space-y-2">
                                    <div className="text-[11px] text-gray-300 uppercase tracking-widest font-bold border-b border-gray-800/50 pb-1">Power System</div>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[10px] text-gray-400 px-1 text-center">Phase</span>
                                            <select
                                                value={projectInfo.phase || '3Ø-4W'}
                                                onChange={(e) => updateProjectInfo('phase', e.target.value)}
                                                className="bg-black border border-gray-800 h-8 text-white font-bold outline-none focus:border-blue-500 text-center w-full text-[12px] appearance-none cursor-pointer"
                                                style={{ textAlignLast: 'center' }}
                                            >
                                                <option value="1Ø-2W">1Ø-2W</option>
                                                <option value="3Ø-3W">3Ø-3W</option>
                                                <option value="3Ø-4W">3Ø-4W</option>
                                            </select>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[10px] text-gray-400 px-1 text-center">Volt</span>
                                            <input
                                                type="text"
                                                value={String(projectInfo.phase || '').replace(/[-\s]/g, '').replace(/Ø/g, 'Φ').toUpperCase().includes('1Φ') ? '220V' : '380V'}
                                                readOnly
                                                className="bg-black border border-gray-800 h-8 text-white font-bold outline-none text-center w-full text-[12px] appearance-none cursor-default"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[10px] text-gray-400 px-1 text-center">VD%</span>
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={projectInfo.voltageDropLimit !== undefined ? projectInfo.voltageDropLimit : '3.0'}
                                                onChange={(e) => updateProjectInfo('voltageDropLimit', e.target.value)}
                                                className="bg-black border border-gray-800 h-8 text-white font-bold outline-none focus:border-blue-500 text-center w-full text-[12px] appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* 3. Main Circuit Breaker */}
                                <div className="space-y-2">
                                    <div className="relative">
                                        {(!isMainBreakerValid || isATViolation) && (
                                            <div className="absolute bottom-full mb-1 left-4 z-50 flex flex-col items-center animate-bounce drop-shadow-md">
                                                <div className="bg-red-500/85 backdrop-blur-sm text-white text-[11px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap border border-white/20 relative">
                                                    Chk.
                                                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-t-[8px] border-t-red-500/85"></div>
                                                </div>
                                            </div>
                                        )}
                                        <div className={`text-[11px] uppercase tracking-widest font-bold border-b border-gray-800/50 pb-1 transition-colors duration-300 ${(!isMainBreakerValid || isATViolation) ? 'text-red-500' : 'text-gray-300'}`}>
                                            Main Circuit Breaker
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[10px] text-gray-400 px-1 text-center">Type</span>
                                            <select
                                                value={projectInfo.mainBreakerType || 'MCCB'}
                                                onChange={(e) => updateProjectInfo('mainBreakerType', e.target.value)}
                                                className="bg-black border border-gray-800 h-8 text-white font-bold outline-none focus:border-blue-500 text-center w-full text-[12px] appearance-none cursor-pointer"
                                                style={{ textAlignLast: 'center' }}
                                            >
                                                {BREAKER_TYPES.map(type => (
                                                    <option key={type} value={type}>{type}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[10px] text-gray-400 px-1 text-center">AF</span>
                                            <input
                                                type="number"
                                                value={projectInfo.mccbAF || ''}
                                                onChange={(e) => updateProjectInfo('mccbAF', e.target.value)}
                                                className="bg-black border border-gray-800 h-8 text-white font-bold outline-none focus:border-blue-500 text-center w-full text-[12px] appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                placeholder="AF"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[10px] text-gray-400 px-1 text-center">AT</span>
                                            <input
                                                type="number"
                                                value={projectInfo.mccbAT || ''}
                                                onChange={(e) => updateProjectInfo('mccbAT', e.target.value)}
                                                className="bg-black border border-gray-800 h-8 text-white font-bold outline-none focus:border-blue-500 text-center w-full text-[12px] appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                placeholder="AT"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* 4. Feeder Cable System */}
                                <div className="space-y-2">
                                    <div className="text-[11px] text-gray-300 uppercase tracking-widest font-bold border-b border-gray-800/50 pb-1">Feeder Cable System</div>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[10px] text-gray-400 px-1 text-center">Method</span>
                                            <div className="relative">
                                                {!isCableMethodValid(projectInfo) && (
                                                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center animate-bounce drop-shadow-md">
                                                        <div className="bg-red-500/85 backdrop-blur-sm text-white text-[11px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap border border-white/20 relative">
                                                            Chk.
                                                            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-t-[8px] border-t-red-500/85"></div>
                                                        </div>
                                                    </div>
                                                )}
                                                <select
                                                    value={projectInfo.kecMethod || 'E'}
                                                    onChange={(e) => {
                                                        const v = e.target.value;
                                                        if (v === 'X') {
                                                            setPreviousMethod(projectInfo.kecMethod || 'E');
                                                            setIsParallelPopupOpen(true);
                                                        } else {
                                                            updateProjectInfo('kecMethod', v);
                                                        }
                                                    }}
                                                    className="bg-black border border-gray-800 h-8 text-white font-bold outline-none focus:border-blue-500 text-center w-full text-[12px] appearance-none cursor-pointer"
                                                    style={{ textAlignLast: 'center' }}
                                                >
                                                    {[...new Set([...INSTALL_METHODS, 'X', projectInfo.kecMethod])].filter(Boolean).map(method => (
                                                        <option
                                                            key={method}
                                                            value={method}
                                                            disabled={method !== 'X' && getMethodDisabledOptions(projectInfo).includes(method)}
                                                            className={method !== 'X' && getMethodDisabledOptions(projectInfo).includes(method) ? 'text-gray-700' : ''}
                                                        >
                                                            {method}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[10px] text-gray-400 px-1 text-center">WIRE</span>
                                            <select
                                                value={projectInfo.wire || 'FCV'}
                                                onChange={(e) => updateProjectInfo('wire', e.target.value)}
                                                className="bg-black border border-gray-800 h-8 text-white font-bold outline-none focus:border-blue-500 text-center w-full text-[12px] appearance-none cursor-pointer"
                                                style={{ textAlignLast: 'center' }}
                                            >
                                                {WIRE_TYPES.map(wire => (
                                                    <option key={wire} value={wire}>{wire}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[10px] text-gray-400 px-1 text-center">㎟</span>
                                            <select
                                                value={projectInfo.cableSize || ''}
                                                onChange={(e) => updateProjectInfo('cableSize', e.target.value)}
                                                className="bg-black border border-gray-800 h-8 text-white font-bold outline-none focus:border-blue-500 text-center w-full text-[12px] appearance-none cursor-pointer"
                                                style={{ textAlignLast: 'center' }}
                                            >
                                                <option value="">선택</option>
                                                {CABLE_SIZES.map(size => (
                                                    <option key={size} value={size}>{size}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* AT_B Section */}
                        <section className="space-y-4" ref={el => sectionRefs.current['at_b'] = el}>
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-4 bg-blue-500"></div>
                                <h3 className={`text-[14px] font-bold uppercase tracking-wider ${getHighlightClass('at_b')}`}>AT<sub>B</sub> 설계전류를 고려한 보호장치</h3>
                                <div className="flex items-center gap-2 ml-auto">
                                    <span className="text-[10px] text-white bg-gray-900 px-1.5 py-0.5 rounded border border-gray-800">
                                        {(judgment.at_b?.phase && String(judgment.at_b.phase).replace(/Ø/g, 'Φ').includes('Φ')) ? String(judgment.at_b.phase).replace(/Ø/g, 'Φ').split('Φ')[0] + 'Φ' : (judgment.at_b?.phase || '-')}
                                    </span>
                                    <span className={`text-[11px] px-2 py-1 rounded font-bold ${judgment.at_b?.status === 'Ok' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                        {judgment.at_b?.status || '-'}
                                    </span>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-gray-900/50 p-3 border border-gray-800 text-center">
                                    <div className="text-[9px] sm:text-[11px] text-gray-300 mb-1 leading-tight">I<sub>B</sub> [A]<br />(설계회로)</div>
                                    <div className="text-[13px] sm:text-[15px] font-mono text-white">{(judgment.at_b?.ib || 0).toFixed(2)}</div>
                                </div>
                                <div className="bg-gray-900/50 p-3 border border-gray-800 text-center">
                                    <div className="text-[9px] sm:text-[11px] text-gray-300 mb-1 leading-tight">I<sub>N</sub> [A]<br />(차단기 정격)</div>
                                    <div className="text-[13px] sm:text-[15px] font-mono text-white">{judgment.at_b?.in || '-'}</div>
                                </div>
                                <div 
                                    className="bg-gray-900/50 p-3 border border-blue-500/30 text-center cursor-pointer hover:bg-blue-500/10 transition-colors group"
                                    onClick={() => {
                                        const val = judgment.at_b?.recommendedIn;
                                        if (val && val !== 'N/A') {
                                            updateProjectInfo('mccbAT', val);
                                        }
                                    }}
                                >
                                    <div className="text-[9px] sm:text-[11px] text-blue-400 mb-1 leading-tight group-hover:text-blue-300 transition-colors">I<sub>N</sub> [A]<br />(추천 정격)</div>
                                    <div className="text-[13px] sm:text-[15px] font-mono text-blue-400 font-bold group-hover:text-blue-300 transition-colors">{judgment.at_b?.recommendedIn || '-'}</div>
                                </div>
                            </div>
                            <div className="text-[10px] text-white px-1 leading-tight">
                                * 조건: I<sub>B</sub> ≤ I<sub>N</sub>
                            </div>
                        </section>

                        {/* AT_TH Section */}
                        <section className="space-y-4" ref={el => sectionRefs.current['at_th'] = el}>
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-4 bg-blue-500"></div>
                                <h3 className={`text-[14px] font-bold uppercase tracking-wider ${getHighlightClass('at_th')}`}>AT<sub>TH</sub> 열적강도를 고려한 정격</h3>
                                <div className="flex items-center gap-2 ml-auto">
                                    <span className="text-[10px] text-white bg-gray-900 px-1.5 py-0.5 rounded border border-gray-800">
                                        {judgment.at_th?.i2Type === 'residential' ? '주택용' : '산업용'}
                                    </span>
                                    <span className={`text-[11px] px-2 py-1 rounded font-bold ${judgment.at_th?.status === 'Ok' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                        {judgment.at_th?.status || '-'}
                                    </span>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-gray-900/50 p-3 border border-gray-800 text-center">
                                    <div className="text-[9px] sm:text-[11px] text-gray-300 uppercase mb-1 leading-tight">I<sub>2</sub> [A]<br />(규약동작 전류)</div>
                                    <div className="text-[13px] sm:text-[15px] font-mono text-white">{(judgment.at_th?.i2 || 0).toFixed(2)}</div>
                                </div>
                                <div className="bg-gray-900/50 p-3 border border-gray-800 text-center">
                                    <div className="text-[9px] sm:text-[11px] text-gray-300 uppercase mb-1 leading-tight">1.45 * I<sub>z</sub> [A]<br />(판정식)</div>
                                    <div className="text-[13px] sm:text-[15px] font-mono text-white">{(judgment.at_th?.iz145 || 0).toFixed(2)}</div>
                                </div>
                                <div className="bg-gray-900/50 p-3 border border-gray-800 text-center">
                                    <div className="text-[9px] sm:text-[11px] text-gray-300 uppercase mb-1 leading-tight">I<sub>z</sub> [A]<br />(허용전류)</div>
                                    <div className="text-[13px] sm:text-[15px] font-mono text-white">{(judgment.at_th?.iz || 0).toFixed(2)}</div>
                                </div>
                            </div>
                            <div className="mt-1 flex flex-col gap-0.5 px-1 leading-tight">
                                <div className="text-[10px] text-white">* 조건: I<sub>2</sub> ≤ 1.45 × I<sub>z</sub></div>
                                {judgment.at_th?.parallelN > 1 && (
                                    <div className="text-[9px] sm:text-[10px] text-yellow-500 font-medium tracking-tighter">
                                        * 보정: ({(judgment.at_th?.baseIz || 0).toFixed(2)}×{judgment.at_th?.parallelN})×{judgment.at_th?.parallelKg}
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* AT_SC Section */}
                        <section className="space-y-4" ref={el => sectionRefs.current['at_sc'] = el}>
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-4 bg-blue-500"></div>
                                <h3 className={`text-[14px] font-bold uppercase tracking-wider ${getHighlightClass('at_sc')}`}>AT<sub>SC</sub> 단락전류를 고려한 정격</h3>
                                <div className="flex items-center gap-2 ml-auto">
                                    <span className="text-[10px] text-white bg-gray-900 px-1.5 py-0.5 rounded border border-gray-800">
                                        ISC {judgment.at_sc?.isPercent || 100}%
                                    </span>
                                    <span className={`text-[11px] px-2 py-1 rounded font-bold ${judgment.at_sc?.status === 'Ok' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                        {judgment.at_sc?.status || '-'}
                                    </span>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-gray-900/50 p-3 border border-gray-800 text-center">
                                    <div className="text-[9px] sm:text-[11px] text-gray-300 mb-1 leading-tight">t<sub>n</sub> [s]<br />(보호장치 동작)</div>
                                    <div className="text-[13px] sm:text-[15px] font-mono text-white">{judgment.at_sc?.tn || '0.1'}</div>
                                </div>
                                <div className="bg-gray-900/50 p-3 border border-gray-800 text-center">
                                    <div className="text-[9px] sm:text-[11px] text-gray-300 mb-1 leading-tight">t<sub>z</sub> [s]<br />(허용온도 도달)</div>
                                    <div className="text-[13px] sm:text-[15px] font-mono text-white">{(judgment.at_sc?.tz_calculated || 0).toFixed(4)}</div>
                                </div>
                                <div className="bg-gray-900/50 p-3 border border-gray-800 text-center">
                                    <div className="text-[9px] sm:text-[11px] text-gray-300 mb-1 leading-tight">I<sub>SC</sub> [kA]<br />(예상 단락전류)</div>
                                    <div className="text-[13px] sm:text-[15px] font-mono text-white">{(judgment.at_sc?.isc || 0).toFixed(1)}</div>
                                </div>
                            </div>
                            <div className="mt-1 flex flex-col gap-0.5 px-1 leading-tight">
                                <div className="text-[10px] text-white">* 조건: t<sub>n</sub> ≤ t<sub>z</sub></div>
                                {judgment.at_sc?.isParallel && (
                                    <div className="text-[10px] text-yellow-500 font-medium tracking-tighter">
                                        * 단락전류 할증계수(KIsc): {judgment.at_sc?.kIsc}
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* SB Section */}
                        <section className="space-y-4" ref={el => sectionRefs.current['sb'] = el}>
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-4 bg-blue-500"></div>
                                <h3 className={`text-[14px] font-bold uppercase tracking-wider ${getHighlightClass('sb')}`}>S<sub>B</sub> 설계전류를 고려한 단면적</h3>
                                <span className={`ml-auto text-[11px] px-2 py-1 rounded font-bold ${judgment.sb?.status === 'Ok' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                    {judgment.sb?.status || '-'}
                                </span>
                            </div>
                            <div className="bg-gray-900/50 p-4 border border-gray-800 space-y-3">
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="bg-black/30 p-2 rounded border border-gray-800/50 text-center">
                                        <div className="text-gray-400 text-[9px] sm:text-[11px] mb-1 font-bold">Phase</div>
                                        <div className="text-white font-bold font-mono text-[13px] sm:text-[15px]">{judgment.sb?.phase || '-'}</div>
                                    </div>
                                    <div className="bg-black/30 p-2 rounded border border-gray-800/50 text-center">
                                        <div className="text-gray-400 text-[9px] sm:text-[11px] mb-1 font-bold">WIRE</div>
                                        <div className="text-white font-bold font-mono text-[13px] sm:text-[15px]">{judgment.sb?.wire || '-'}</div>
                                    </div>
                                    <div className="bg-black/30 p-2 rounded border border-gray-800/50 text-center">
                                        <div className="text-gray-400 text-[9px] sm:text-[11px] mb-1 font-bold">공사</div>
                                        <div className="text-white font-bold font-mono text-[13px] sm:text-[15px]">{judgment.sb?.method || '-'}</div>
                                    </div>
                                </div>
                                <div className="flex justify-between text-[11px] sm:text-[13px] pt-1">
                                    <span className="text-gray-400">설계전류 (I<sub>B</sub>)</span>
                                    <span className="text-white font-mono text-[13px] sm:text-[15px]">{(judgment.sb?.ib || 0).toFixed(2)} <span className="text-[9px] sm:text-[11px] text-gray-500">[A]</span></span>
                                </div>
                                <div className="flex justify-between text-[11px] sm:text-[13px] border-t border-gray-800 pt-3">
                                    <span className="text-yellow-400 font-bold">적용 도체면적</span>
                                    <div className="text-right flex items-center gap-1">
                                        <span className="text-yellow-400 font-bold text-[11px] sm:text-[13px] whitespace-nowrap">
                                            {panelCircuit.size || '-'} <span className="text-[9px] sm:text-[11px] text-yellow-500/70">[㎟]</span>
                                        </span>
                                        {(judgment.sb?.parallelN || 1) > 1 && (
                                            <span className="text-yellow-400 font-bold text-[11px] sm:text-[13px] whitespace-nowrap">
                                                × {getCableLineCount(judgment.sb.parallelN, panelCircuit.size, judgment.sb.phase)} <span className="text-[9px] sm:text-[11px] text-yellow-500/70">LINE</span>
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex justify-between items-start text-[9px] sm:text-[11px] text-gray-300 pl-1 -mt-1 mb-1 pr-1">
                                    <div className="flex flex-col">
                                        <span>보정 계수: {(judgment.sb?.appliedFactor || 0).toFixed(2)}</span>
                                        {(judgment.at_th?.parallelN || 1) > 1 && (
                                            <div className="text-[9px] sm:text-[11px] text-yellow-500 font-medium tracking-tighter mt-0.5">
                                                보정: ({(judgment.at_th?.baseIz || 0).toFixed(2)}×{judgment.at_th?.parallelN})×{judgment.at_th?.parallelKg}
                                            </div>
                                        )}
                                    </div>
                                    <span className="underline decoration-yellow-500 underline-offset-2 decoration-2 text-white font-bold tracking-tight self-start">허용전류(I<sub>z</sub>): {Number((judgment.scb?.iz || 0).toFixed(2))} [A]</span>
                                </div>
                                <div className="flex justify-between text-[11px] sm:text-[13px] pt-1">
                                    <span className="text-blue-400 font-bold">추천 도체면적</span>
                                    <span 
                                        className="text-blue-400 font-bold text-[11px] sm:text-[13px] cursor-pointer hover:bg-blue-500/10 px-1 -mr-1 rounded transition-colors"
                                        onClick={() => {
                                            const val = judgment.sb?.recommendedSize;
                                            if (val && val !== '-') {
                                                updateProjectInfo('cableSize', val);
                                            }
                                        }}
                                    >
                                        {judgment.sb?.recommendedSize || '-'} <span className="text-[9px] sm:text-[11px] text-blue-500/70">[㎟]</span>
                                        {judgment.sb?.isParallelRecommendation && (
                                            <span className="text-yellow-400 ml-1 text-[9px] sm:text-[11px]">병렬 {judgment.sb?.recommendedParallelN}회선</span>
                                        )}
                                    </span>
                                </div>
                                <div className="flex justify-between text-[9px] sm:text-[11px] text-gray-300 pl-1">
                                    <span>보정 계수: {(judgment.sb?.totalFactor || 0).toFixed(2)}</span>
                                    <span className="underline decoration-yellow-500 underline-offset-2 decoration-2 text-white font-bold tracking-tight">보정 허용전류: {Number((judgment.sb?.correctedIz || 0).toFixed(2))} [A]</span>
                                </div>
                            </div>
                        </section>

                        {/* SCB Section */}
                        <section className="space-y-4" ref={el => sectionRefs.current['scb'] = el}>
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-4 bg-blue-500"></div>
                                <h3 className={`text-[14px] font-bold uppercase tracking-wider ${getHighlightClass('scb')}`}>S<sub>CB</sub> 차단기 정격을 고려한 단면적</h3>
                                <div className="flex items-center gap-2 ml-auto">
                                    <span className="text-[10px] text-white bg-gray-900 px-1.5 py-0.5 rounded border border-gray-800">
                                        {(judgment.at_b?.phase && String(judgment.at_b.phase).replace(/Ø/g, 'Φ').includes('Φ')) ? String(judgment.at_b.phase).replace(/Ø/g, 'Φ').split('Φ')[0] + 'Φ' : (judgment.at_b?.phase || '-')}
                                    </span>
                                    <span className={`text-[11px] px-2 py-1 rounded font-bold ${judgment.scb?.status === 'Ok' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                        {judgment.scb?.status || '-'}
                                    </span>
                                </div>
                            </div>
                            <div className="bg-gray-900/50 p-4 border border-gray-800 space-y-3">
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="bg-black/30 p-2 rounded border border-gray-800/50 text-center">
                                        <div className="text-gray-400 text-[9px] sm:text-[11px] mb-1 font-bold">I<sub>B</sub> (설계)</div>
                                        <div className="text-white font-bold font-mono text-[13px] sm:text-[15px]">{(judgment.scb?.ib || 0).toFixed(1)}</div>
                                    </div>
                                    <div className="bg-black/30 p-2 rounded border border-gray-800/50 text-center">
                                        <div className="text-gray-400 text-[9px] sm:text-[11px] mb-1 font-bold">I<sub>N</sub> (정격)</div>
                                        <div className="text-white font-bold font-mono text-[13px] sm:text-[15px]">{judgment.at_b?.in || '-'}</div>
                                    </div>
                                    <div className="bg-black/30 p-2 rounded border border-gray-800/50 text-center">
                                        <div className="text-gray-400 text-[9px] sm:text-[11px] mb-1 font-bold">I<sub>Z</sub> (허용)</div>
                                        <div className="text-white font-bold font-mono text-[13px] sm:text-[15px]">{(judgment.scb?.iz || 0).toFixed(1)}</div>
                                    </div>
                                </div>
                                <div className="flex justify-between text-[11px] sm:text-[13px] pt-1">
                                    <span className="text-yellow-400 font-bold">적용 도체면적</span>
                                    <div className="text-right flex items-center gap-1">
                                        <span className="text-yellow-400 font-bold text-[11px] sm:text-[13px] whitespace-nowrap">
                                            {panelCircuit.size || '-'} <span className="text-[9px] sm:text-[11px] text-yellow-500/70">[㎟]</span>
                                        </span>
                                        {(judgment.scb?.parallelN || 1) > 1 && (
                                            <span className="text-yellow-400 font-bold text-[11px] sm:text-[13px] whitespace-nowrap">
                                                × {getCableLineCount(judgment.scb.parallelN, panelCircuit.size, judgment.at_b?.phase)} <span className="text-[9px] sm:text-[11px] text-yellow-500/70">LINE</span>
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex justify-between text-[11px] sm:text-[13px] pt-1">
                                    <span className="text-blue-400 font-bold">추천 도체면적</span>
                                    <span 
                                        className="text-blue-400 font-bold text-[11px] sm:text-[13px] cursor-pointer hover:bg-blue-500/10 px-1 -mr-1 rounded transition-colors"
                                        onClick={() => {
                                            const rec = judgment.scb?.recommendedSize;
                                            const val = (rec && typeof rec === 'object') ? rec.size : rec;
                                            if (val && val !== '-') {
                                                updateProjectInfo('cableSize', val);
                                            }
                                        }}
                                    >
                                        {judgment.scb?.recommendedSize?.size || judgment.scb?.recommendedSize || '-'} <span className="text-[9px] sm:text-[11px] text-blue-500/70">[㎟]</span>
                                        {judgment.scb?.isParallelRecommendation && (
                                            <span className="text-yellow-400 ml-1 text-[9px] sm:text-[11px]">병렬 {judgment.scb?.recommendedParallelN}회선</span>
                                        )}
                                    </span>
                                </div>
                                <div className="text-[10px] text-gray-400 px-1 border-t border-gray-800 pt-2">
                                    * 조건: I<sub>B</sub> ≤ I<sub>N</sub> ≤ I<sub>Z</sub>
                                </div>
                            </div>
                        </section>

                        {/* S_e% Section */}
                        <section className="space-y-4" ref={el => sectionRefs.current['se'] = el}>
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-4 bg-blue-500"></div>
                                <h3 className={`text-[14px] font-bold uppercase tracking-wider ${getHighlightClass('se')}`}>S<sub>e%</sub> 전압강하를 고려한 단면적</h3>
                                <span className={`ml-auto text-[11px] px-2 py-1 rounded font-bold ${judgment.se?.status === 'Ok' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                    {judgment.se?.status || '-'}
                                </span>
                            </div>
                            <div className="space-y-3">
                                {/* Row 1: D, e, E - 3 columns */}
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="bg-gray-900/50 p-3 border border-gray-800 text-center">
                                        <div className="text-[9px] sm:text-[11px] text-gray-300 mb-1 leading-tight">D (간선 거리)</div>
                                        <div className="text-[13px] sm:text-[15px] font-mono text-white">
                                            {projectInfo.branchDistance || 15} <span className="text-[9px] sm:text-[10px] text-gray-600 ml-0.5">[m]</span>
                                        </div>
                                    </div>
                                    <div className="bg-gray-900/50 p-3 border border-gray-800 text-center">
                                        <div className="text-[9px] sm:text-[11px] text-gray-300 mb-1 leading-tight">e (전압강하)</div>
                                        <div className="text-[13px] sm:text-[15px] font-mono text-white">{judgment.se?.e_v || '-'} <span className="text-[9px] sm:text-[10px] text-gray-600">[V]</span></div>
                                    </div>
                                    <div className="bg-gray-900/50 p-3 border border-gray-800 text-center">
                                        <div className="text-[9px] sm:text-[11px] text-gray-300 mb-1 leading-tight">E (전압강하율)</div>
                                        <div className="text-[13px] sm:text-[15px] font-mono text-white">{judgment.se?.e_percent || '-'} <span className="text-[9px] sm:text-[10px] text-gray-600">[%]</span></div>
                                    </div>
                                </div>
                                {/* Row 2: R, X - 2 columns */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-gray-900/50 p-3 border border-gray-800 text-center">
                                        <div className="text-[9px] sm:text-[11px] text-gray-300 mb-1 font-bold">R (저항)</div>
                                        <div className="text-[13px] sm:text-[15px] font-mono text-white">{judgment.se?.r || '-'} <span className="text-[9px] sm:text-[10px] text-gray-600">[Ω]</span></div>
                                    </div>
                                    <div className="bg-gray-900/50 p-3 border border-gray-800 text-center">
                                        <div className="text-[9px] sm:text-[11px] text-gray-300 mb-1 font-bold">X (리액턴스)</div>
                                        <div className="text-[13px] sm:text-[15px] font-mono text-white">{judgment.se?.x || '-'} <span className="text-[9px] sm:text-[10px] text-gray-600">[Ω]</span></div>
                                    </div>
                                </div>
                                {/* Row 3: cosθ, sinθ - 2 columns */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-gray-900/50 p-3 border border-gray-800 text-center">
                                        <div className="text-[9px] sm:text-[11px] text-gray-300 mb-1 font-bold">cosθ (역률)</div>
                                        <div className="text-[13px] sm:text-[15px] font-mono text-white">{judgment.se?.cos_theta || '-'}</div>
                                    </div>
                                    <div className="bg-gray-900/50 p-3 border border-gray-800 text-center">
                                        <div className="text-[9px] sm:text-[11px] text-gray-300 mb-1 font-bold">sinθ (무효율)</div>
                                        <div className="text-[13px] sm:text-[15px] font-mono text-white">{judgment.se?.sin_theta || '-'}</div>
                                    </div>
                                </div>
                                <div className="mt-1 flex flex-col gap-0.5 px-1 leading-tight text-white font-medium">
                                    <div className="text-[10px] text-white italic">
                                        * 설계기준강하: {projectInfo.voltageDropLimit || 3}%
                                    </div>
                                    {judgment.se?.isParallel && (
                                        <div className="text-[10px] text-yellow-500 tracking-tighter">
                                            * 병렬보정: K<sub>R</sub>({judgment.se?.kr || '0.5'}), K<sub>X</sub>({judgment.se?.kx || '0.75'}) 적용됨
                                        </div>
                                    )}
                                </div>
                                <div className="flex justify-between text-[11px] sm:text-[13px] pt-1 border-t border-gray-800 mt-2">
                                    <span className="text-blue-400 font-bold">추천 도체면적</span>
                                    <span 
                                        className="text-blue-400 font-bold text-[11px] sm:text-[13px] cursor-pointer hover:bg-blue-500/10 px-1 -mr-1 rounded transition-colors"
                                        onClick={() => {
                                            const val = seRecommendedSize;
                                            if (val && val !== '300+') {
                                                updateProjectInfo('cableSize', val);
                                            }
                                        }}
                                    >
                                        {seRecommendedSize} <span className="text-[9px] sm:text-[11px] text-blue-500/70">[㎟]</span>
                                    </span>
                                </div>
                            </div>
                        </section>

                        {/* S_SC Section */}
                        <section className="space-y-4" ref={el => sectionRefs.current['ssc'] = el}>
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-4 bg-blue-500"></div>
                                <h3 className={`text-[14px] font-bold uppercase tracking-wider ${getHighlightClass('ssc')}`}>S<sub>SC</sub> 단락전류를 고려한 단면적</h3>
                                <div className="flex items-center gap-2 ml-auto">
                                    <span className="text-[10px] text-white bg-gray-900 px-1.5 py-0.5 rounded border border-gray-800">
                                        ISC {judgment.ssc?.isPercent || 100}%
                                    </span>
                                    <span className={`text-[11px] px-2 py-1 rounded font-bold ${judgment.ssc?.status === 'Ok' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                        {judgment.ssc?.status || '-'}
                                    </span>
                                </div>
                            </div>
                            <div className="space-y-3">
                                {/* Row 1: 선정, 추천, SSC */}
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="bg-gray-900/50 p-3 border border-gray-800 text-center">
                                        <div className="text-[9px] sm:text-[11px] text-gray-300 mb-1 leading-tight">선정 [㎟]<br />(도체 단면적)</div>
                                        <div className="text-[13px] sm:text-[15px] font-mono text-yellow-400 font-bold">
                                            {(judgment.ssc?.isParallel && (judgment.ssc?.n || 1) > 1)
                                                ? `${panelCircuit.size}x${judgment.ssc.n}`
                                                : (panelCircuit.size || '-')}
                                        </div>
                                    </div>
                                    <div 
                                        className="bg-gray-900/50 p-3 border border-gray-800 text-center cursor-pointer hover:bg-blue-500/10 transition-colors group"
                                        onClick={() => {
                                            const val = judgment.ssc?.recommendedSize;
                                            if (val && val !== '-') {
                                                updateProjectInfo('cableSize', val);
                                            }
                                        }}
                                    >
                                        <div className="text-[9px] sm:text-[11px] text-gray-300 mb-1 leading-tight group-hover:text-blue-400">추천 [㎟]<br />(표준 단면적)</div>
                                        <div className="text-[13px] sm:text-[15px] font-mono text-blue-400 font-bold group-hover:text-blue-300">{judgment.ssc?.recommendedSize || '-'}</div>
                                    </div>
                                    <div className="bg-gray-900/50 p-3 border border-gray-800 text-center">
                                        <div className="text-[9px] sm:text-[11px] text-gray-300 mb-1 leading-tight">S<sub>SC</sub> [㎟]<br />(계산 단면적)</div>
                                        <div className="text-[13px] sm:text-[15px] font-mono text-white">{(judgment.ssc?.ssc_calculated || 0).toFixed(2)}</div>
                                    </div>
                                </div>
                                {/* Row 2: 예상 ISC, tn, tz */}
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="bg-gray-900/50 p-3 border border-gray-800 text-center">
                                        <div className="text-[9px] sm:text-[11px] text-gray-300 mb-1 leading-tight">I<sub>SC</sub> [kA]<br />(예상 단락전류)</div>
                                        <div className="text-[13px] sm:text-[15px] font-mono text-white">{(judgment.ssc?.isc || 0).toFixed(1)}</div>
                                    </div>
                                    <div className="bg-gray-900/50 p-3 border border-gray-800 text-center">
                                        <div className="text-[9px] sm:text-[11px] text-gray-300 mb-1 leading-tight">t<sub>n</sub> [s]<br />(차단 시간)</div>
                                        <div className="text-[13px] sm:text-[15px] font-mono text-white">{judgment.ssc?.tn || '-'}</div>
                                    </div>
                                    <div className="bg-gray-900/50 p-3 border border-gray-800 text-center">
                                        <div className="text-[9px] sm:text-[11px] text-gray-300 mb-1 leading-tight">t<sub>z</sub> [s]<br />(판정식)</div>
                                        <div className="text-[13px] sm:text-[15px] font-mono text-white">{(judgment.ssc?.tz || 0).toFixed(4)}</div>
                                    </div>
                                </div>
                                {/* Row 3: 절연물, K(계수), α(여유) */}
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="bg-gray-900/50 p-3 border border-gray-800 text-center">
                                        <div className="text-[9px] sm:text-[11px] text-gray-300 mb-1 leading-tight">절연물<br />(K 계수 근거)</div>
                                        <div className="text-[13px] sm:text-[15px] font-mono text-white">{judgment.ssc?.insulation || 'XLPE'}</div>
                                    </div>
                                    <div className="bg-gray-900/50 p-3 border border-gray-800 text-center">
                                        <div className="text-[9px] sm:text-[11px] text-gray-300 mb-1 leading-tight">K<br />(K 계수)</div>
                                        <div className="text-[13px] sm:text-[15px] font-mono text-white">{judgment.ssc?.k || '-'}</div>
                                    </div>
                                    <div className="bg-gray-900/50 p-3 border border-gray-800 text-center">
                                        <div className="text-[9px] sm:text-[11px] text-gray-300 mb-1 leading-tight">α<br />(여유 계수)</div>
                                        <div className="text-[13px] sm:text-[15px] font-mono text-white">{judgment.ssc?.alpha || '-'}</div>
                                    </div>
                                </div>
                            </div>
                            <div className="text-[10px] text-white px-1 leading-tight mt-3">
                                * 계산: (I<sub>SC</sub> × √t<sub>n</sub> / K) × α = S<sub>SC</sub> [㎟]<br />
                                * 조건: t<sub>n</sub> ≤ t<sub>z</sub>
                                {judgment.ssc?.isParallel && (
                                    <div className="text-[10px] text-yellow-500 font-medium tracking-tighter mt-1">
                                        * 단락전류 할증계수(KIsc): {judgment.ssc?.kIsc}
                                    </div>
                                )}
                            </div>
                        </section>

                    </div>
                </div>
            </div >

            {/* Parallel Conductor Popup for Decide Drawer */}
            < ParallelConductorPopup
                isOpen={isParallelPopupOpen}
                onClose={() => {
                    // 사용자가 팝업에서 Cancel 클릭 시 이전 값으로 되돌림
                    updateProjectInfo('kecMethod', previousMethod);
                    setIsParallelPopupOpen(false);
                }}
                onApply={(selectedMethodStr) => {
                    updateProjectInfo('kecMethod', selectedMethodStr);
                    setIsParallelPopupOpen(false);
                }}
                initialValue={projectInfo?.kecMethod || ''}
                wire={projectInfo?.wire}
                size={projectInfo?.cableSize}
                kecSettings={kecSettings}
            />
        </div >
    );
};

export default PanelKECDrawer;

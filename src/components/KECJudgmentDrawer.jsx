import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { calculateKECJudgment } from '../utils/kecCalculations';

const CABLE_SIZES = ['1.5', '2.5', '4', '6', '10', '16', '25', '35', '50', '70', '95', '120', '150', '185', '240', '300'];

const CornerBorders = () => (
    <>
        <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-blue-500/50"></div>
        <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-blue-500/50"></div>
        <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-blue-500/50"></div>
        <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-blue-500/50"></div>
    </>
);

const KECJudgmentDrawer = ({ isOpen, onClose, circuit, onUpdateCableDistance, onUpdateCircuit, highlightSection, kecSettings, projectInfo }) => {
    const [activeHighlight, setActiveHighlight] = useState(null);
    const scrollContainerRef = useRef(null);
    const sectionRefs = useRef({});

    const judgment = circuit?.kecJudgment || {};
    const isPL = circuit?.loads?.some(l => l.category === 'PL');

    // [NEW] Calculate recommended size for Voltage Drop (Se%)
    const seRecommendedSize = useMemo(() => {
        if (!circuit) return '-';
        const limit = Number(projectInfo?.voltageDropLimit) || 3;
        
        for (const s of CABLE_SIZES) {
            const testCircuit = { ...circuit, size: s };
            const testJudgment = calculateKECJudgment(testCircuit, kecSettings, projectInfo);
            if (Number(testJudgment.se?.e_percent) <= limit) {
                return s;
            }
        }
        return '300+';
    }, [circuit, kecSettings, projectInfo]);

    // Handle scroll to section and highlight effect
    useEffect(() => {
        if (isOpen && highlightSection && scrollContainerRef.current) {
            // Small delay to ensure drawer is fully open
            const timer = setTimeout(() => {
                const sectionElement = sectionRefs.current[highlightSection];
                if (sectionElement) {
                    sectionElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    setActiveHighlight(highlightSection);

                    // Remove highlight after animation
                    const highlightTimer = setTimeout(() => {
                        setActiveHighlight(null);
                    }, 2000);

                    return () => clearTimeout(highlightTimer);
                }
            }, 300);

            return () => clearTimeout(timer);
        }
    }, [isOpen, highlightSection]);

    // Reset highlight when drawer closes
    useEffect(() => {
        if (!isOpen) {
            setActiveHighlight(null);
        }
    }, [isOpen]);

    // Prevent background scroll when open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!circuit) return null;

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
                else wires = Number(circuit.p) || 1;
            } else {
                wires = Number(circuit.p) || 1;
            }
            return parallelN * wires;
        }

        // 다심 케이블 (Multi-core)
        return parallelN;
    };



    // Helper function to get highlight class for section title
    const getHighlightClass = (sectionId) => {
        if (activeHighlight === sectionId) {
            return 'animate-pulse text-yellow-400 transition-colors duration-300';
        }
        return 'text-white';
    };

    return (
        <div
            className={`fixed inset-0 z-[1001] bg-black/50 transition-opacity duration-300 ${isOpen ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'}`}
            onClick={onClose}
        >
            <div
                className={`absolute inset-y-0 right-0 w-full max-w-[400px] bg-black border-l border-gray-800 shadow-2xl transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="h-full flex flex-col p-6 relative">
                    <CornerBorders />

                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-xl font-bold text-white tracking-tight">KEC 기술기준 판정</h2>
                            <p className="text-xs text-gray-400 mt-1">회로번호: {circuit.circuitNo} | 부하명: {circuit.loadName}</p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-gray-900 rounded-full transition-colors">
                            <X size={24} className="text-gray-400" />
                        </button>
                    </div>

                    {isPL && (
                        <div className="mb-6 p-3 bg-blue-500/10 border border-blue-500/30 rounded flex items-start gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                            <AlertCircle size={18} className="text-blue-400 mt-0.5 flex-shrink-0" />
                            <div className="text-[11px] text-blue-200 leading-relaxed">
                                <span className="font-bold text-blue-400">하위 판넬 전원 회로 안내:</span><br />
                                이 부분은 읽기 전용입니다. 해당 판넬의 수정은 본 계산서에 위치한
                                <span className="text-white font-bold mx-1">Decide Drawer</span>에서 수정해야 데이터 동기화됩니다.
                            </div>
                        </div>
                    )}

                    <div ref={scrollContainerRef} className="flex-grow overflow-y-auto space-y-8 pr-2 scrollbar-hide">
                        {/* AT_B Section */}
                        <section ref={el => sectionRefs.current['at_b'] = el} className="space-y-4">
                            <div className="flex items-center gap-2">
                                <div className={`w-1.5 h-4 ${activeHighlight === 'at_b' ? 'bg-yellow-400' : 'bg-blue-500'} transition-colors duration-300`}></div>
                                <h3 className={`text-[14px] font-bold uppercase tracking-wider ${getHighlightClass('at_b')}`}>AT<sub>B</sub> 설계전류를 고려한 보호장치</h3>
                                <div className="flex items-center gap-2 ml-auto">
                                    <span className="text-[10px] text-white bg-gray-900 px-1.5 py-0.5 rounded border border-gray-800">
                                        {judgment.at_b?.phase}
                                    </span>
                                    <span className={`text-[11px] px-2 py-1 rounded font-bold ${judgment.at_b?.status === 'Ok' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                        {judgment.at_b?.status}
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
                                    <div className="text-[13px] sm:text-[15px] font-mono text-white">{judgment.at_b?.in}</div>
                                </div>
                                <div 
                                    className={`bg-gray-900/50 p-3 border border-blue-500/30 text-center transition-colors group ${!isPL ? 'cursor-pointer hover:bg-blue-500/10' : 'cursor-not-allowed opacity-80'}`}
                                    onClick={() => {
                                        if (isPL) return;
                                        const val = judgment.at_b?.recommendedIn;
                                        if (val && val !== 'N/A' && val !== '-') {
                                            onUpdateCircuit && onUpdateCircuit('at', val);
                                        }
                                    }}
                                >
                                    <div className={`text-[9px] sm:text-[11px] mb-1 leading-tight transition-colors ${!isPL ? 'text-blue-400 group-hover:text-blue-300' : 'text-gray-500'}`}>I<sub>N</sub> [A]<br />(추천 정격)</div>
                                    <div className={`text-[13px] sm:text-[15px] font-mono font-bold transition-colors ${!isPL ? 'text-blue-400 group-hover:text-blue-300' : 'text-gray-500'}`}>{judgment.at_b?.recommendedIn}</div>
                                </div>
                            </div>
                            <div className="text-[10px] text-white px-1">
                                * 조건: I<sub>B</sub> ≤ I<sub>N</sub>
                            </div>
                        </section>

                        {/* AT_TH Section */}
                        <section ref={el => sectionRefs.current['at_th'] = el} className="space-y-4">
                            <div className="flex items-center gap-2">
                                <div className={`w-1.5 h-4 ${activeHighlight === 'at_th' ? 'bg-yellow-400' : 'bg-blue-500'} transition-colors duration-300`}></div>
                                <h3 className={`text-[14px] font-bold uppercase tracking-wider ${getHighlightClass('at_th')}`}>AT<sub>TH</sub> 열적강도를 고려한 정격</h3>
                                <div className="flex items-center gap-2 ml-auto">
                                    <span className="text-[10px] text-white bg-gray-900 px-1.5 py-0.5 rounded border border-gray-800">
                                        {judgment.at_th?.i2Type === 'residential' ? '주택용' : '산업용'}
                                    </span>
                                    <span className={`text-[11px] px-2 py-1 rounded font-bold ${judgment.at_th?.status === 'Ok' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                        {judgment.at_th?.status}
                                    </span>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-gray-900/50 p-3 border border-gray-800 text-center">
                                    <div className="text-[9px] sm:text-[11px] text-gray-300 uppercase mb-1 leading-tight">I<sub>2</sub> [A]<br />(규약동작 전류)</div>
                                    <div className="text-[13px] sm:text-[15px] font-mono text-white">{(judgment.at_th?.i2 || 0).toFixed(2)} </div>
                                </div>
                                <div className="bg-gray-900/50 p-3 border border-gray-800 text-center">
                                    <div className="text-[9px] sm:text-[11px] text-gray-300 uppercase mb-1 leading-tight">1.45 * I<sub>z</sub> [A]<br />(판정 조건)</div>
                                    <div className="text-[13px] sm:text-[15px] font-mono text-white">{judgment.at_th?.iz145?.toFixed(2)} </div>
                                </div>
                                <div className="bg-gray-900/50 p-3 border border-gray-800 text-center">
                                    <div className="text-[9px] sm:text-[11px] text-gray-300 uppercase mb-1 leading-tight">I<sub>z</sub> [A]<br />(허용전류)</div>
                                    <div className="text-[13px] sm:text-[15px] font-mono text-white">{judgment.at_th?.iz?.toFixed(2)} </div>
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
                        <section ref={el => sectionRefs.current['at_sc'] = el} className="space-y-4">
                            <div className="flex items-center gap-2">
                                <div className={`w-1.5 h-4 ${activeHighlight === 'at_sc' ? 'bg-yellow-400' : 'bg-blue-500'} transition-colors duration-300`}></div>
                                <h3 className={`text-[14px] font-bold uppercase tracking-wider ${getHighlightClass('at_sc')}`}>AT<sub>SC</sub> 단락전류를 고려한 정격</h3>
                                <div className="flex items-center gap-2 ml-auto">
                                    <span className="text-[10px] text-white bg-gray-900 px-1.5 py-0.5 rounded border border-gray-800">
                                        ISC {judgment.at_sc?.isPercent}%
                                    </span>
                                    <span className={`text-[11px] px-2 py-1 rounded font-bold ${judgment.at_sc?.status === 'Ok' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                        {judgment.at_sc?.status}
                                    </span>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-gray-900/50 p-3 border border-gray-800 text-center">
                                    <div className="text-[9px] sm:text-[11px] text-gray-300 mb-1 leading-tight">t<sub>n</sub> [s]<br />(보호장치 동작)</div>
                                    <div className="text-[13px] sm:text-[15px] font-mono text-white">{judgment.at_sc?.tn} <span className="text-[9px] sm:text-[10px] text-gray-600"></span></div>
                                </div>
                                <div className="bg-gray-900/50 p-3 border border-gray-800 text-center">
                                    <div className="text-[9px] sm:text-[11px] text-gray-300 mb-1 leading-tight">t<sub>z</sub> [s]<br />(허용온도 도달)</div>
                                    <div className="text-[13px] sm:text-[15px] font-mono text-white">{judgment.at_sc?.tz_calculated?.toFixed(4)} <span className="text-[9px] sm:text-[10px] text-gray-600"></span></div>
                                </div>
                                <div className="bg-gray-900/50 p-3 border border-gray-800 text-center">
                                    <div className="text-[9px] sm:text-[11px] text-gray-300 mb-1 leading-tight">I<sub>SC</sub> [kA]<br />(예상 단락전류)</div>
                                    <div className="text-[13px] sm:text-[15px] font-mono text-white">{judgment.at_sc?.isc?.toFixed(1)} <span className="text-[9px] sm:text-[10px] text-gray-600"></span></div>
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
                        <section ref={el => sectionRefs.current['sb'] = el} className="space-y-4">
                            <div className="flex items-center gap-2">
                                <div className={`w-1.5 h-4 ${activeHighlight === 'sb' ? 'bg-yellow-400' : 'bg-blue-500'} transition-colors duration-300`}></div>
                                <h3 className={`text-[14px] font-bold uppercase tracking-wider ${getHighlightClass('sb')}`}>S<sub>B</sub> 설계전류를 고려한 단면적</h3>
                                <span className={`ml-auto text-[11px] px-2 py-1 rounded font-bold ${judgment.sb?.status === 'Ok' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                    {judgment.sb?.status}
                                </span>
                            </div>
                            <div className="bg-gray-900/50 p-4 border border-gray-800 space-y-3">
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="bg-black/30 p-2 rounded border border-gray-800/50 text-center">
                                        <div className="text-gray-400 text-[9px] sm:text-[11px] mb-1 font-bold">Phase</div>
                                        <div className="text-white font-bold font-mono text-[13px] sm:text-[15px]">{judgment.sb?.phase}</div>
                                    </div>
                                    <div className="bg-black/30 p-2 rounded border border-gray-800/50 text-center">
                                        <div className="text-gray-400 text-[9px] sm:text-[11px] mb-1 font-bold">WIRE</div>
                                        <div className="text-white font-bold font-mono text-[13px] sm:text-[15px]">{judgment.sb?.wire}</div>
                                    </div>
                                    <div className="bg-black/30 p-2 rounded border border-gray-800/50 text-center">
                                        <div className="text-gray-400 text-[9px] sm:text-[11px] mb-1 font-bold">공사</div>
                                        <div className="text-white font-bold font-mono text-[13px] sm:text-[15px]">{judgment.sb?.method}</div>
                                    </div>
                                </div>
                                <div className="flex justify-between text-[11px] sm:text-[13px] pt-1">
                                    <span className="text-gray-400">설계전류 (I<sub>B</sub>)</span>
                                    <span className="text-white font-mono text-[13px] sm:text-[15px]">{judgment.sb?.ib?.toFixed(2)} <span className="text-[9px] sm:text-[11px] text-gray-500">[A]</span></span>
                                </div>
                                <div className="flex justify-between text-[11px] sm:text-[13px] border-t border-gray-800 pt-3">
                                    <span className="text-yellow-400 font-bold">적용 도체면적</span>
                                    <div className="text-right flex items-center gap-1">
                                        <span className="text-yellow-400 font-bold text-[11px] sm:text-[13px] whitespace-nowrap">
                                            {circuit.size} <span className="text-[9px] sm:text-[11px] text-yellow-500/70">[㎟]</span>
                                        </span>
                                        {(judgment.sb?.parallelN || 1) > 1 && (
                                            <span className="text-yellow-400 font-bold text-[11px] sm:text-[13px] whitespace-nowrap">
                                                × {getCableLineCount(judgment.sb.parallelN, circuit.size, judgment.sb.phase)} <span className="text-[9px] sm:text-[11px] text-yellow-500/70">LINE</span>
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex justify-between items-start text-[9px] sm:text-[11px] text-gray-300 pl-1 -mt-1 mb-1 pr-1">
                                    <div className="flex flex-col">
                                        <span>보정 계수: {judgment.sb?.appliedFactor?.toFixed(2)}</span>
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
                                        className={`text-blue-400 font-bold text-[11px] sm:text-[13px] whitespace-nowrap transition-colors rounded ${!isPL ? 'cursor-pointer hover:bg-blue-500/10 px-1 -mr-1' : 'opacity-80'}`}
                                        onClick={() => {
                                            if (isPL) return;
                                            const val = judgment.sb?.recommendedSize;
                                            if (val && val !== '-') {
                                                onUpdateCircuit && onUpdateCircuit('size', val);
                                            }
                                        }}
                                    >
                                        {judgment.sb?.recommendedSize} <span className="text-[9px] sm:text-[11px] text-blue-500/70">[㎟]</span>
                                        {judgment.sb?.isParallelRecommendation && (
                                            <span className="text-yellow-400 ml-1 text-[9px] sm:text-[11px]">병렬 {judgment.sb?.recommendedParallelN}회선</span>
                                        )}
                                    </span>
                                </div>
                                <div className="flex justify-between text-[9px] sm:text-[11px] text-gray-300 pl-1">
                                    <span>보정 계수: {judgment.sb?.totalFactor?.toFixed(2)}</span>
                                    <span className="underline decoration-yellow-500 underline-offset-2 decoration-2 text-white font-bold tracking-tight">보정 허용전류: {Number((judgment.sb?.correctedIz || 0).toFixed(2))} [A]</span>
                                </div>
                            </div>
                        </section>

                        {/* SCB Section */}
                        <section ref={el => sectionRefs.current['scb'] = el} className="space-y-4">
                            <div className="flex items-center gap-2">
                                <div className={`w-1.5 h-4 ${activeHighlight === 'scb' ? 'bg-yellow-400' : 'bg-blue-500'} transition-colors duration-300`}></div>
                                <h3 className={`text-[14px] font-bold uppercase tracking-wider ${getHighlightClass('scb')}`}>S<sub>CB</sub> 차단기 정격을 고려한 단면적</h3>
                                <div className="flex items-center gap-2 ml-auto">
                                    <span className="text-[10px] text-white bg-gray-900 px-1.5 py-0.5 rounded border border-gray-800">
                                        {judgment.at_b?.phase}
                                    </span>
                                    <span className={`text-[11px] px-2 py-1 rounded font-bold ${judgment.scb?.status === 'Ok' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                        {judgment.scb?.status}
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
                                        <div className="text-white font-bold font-mono text-[13px] sm:text-[15px]">{judgment.at_b?.in}</div>
                                    </div>
                                    <div className="bg-black/30 p-2 rounded border border-gray-800/50 text-center">
                                        <div className="text-gray-400 text-[9px] sm:text-[11px] mb-1 font-bold">I<sub>Z</sub> (허용)</div>
                                        <div className="text-white font-bold font-mono text-[13px] sm:text-[15px]">{judgment.scb?.iz?.toFixed(1)}</div>
                                    </div>
                                </div>
                                <div className="flex justify-between text-[11px] sm:text-[13px] pt-1">
                                    <span className="text-yellow-400 font-bold">적용 도체면적</span>
                                    <div className="text-right flex items-center gap-1">
                                        <span className="text-yellow-400 font-bold text-[11px] sm:text-[13px] whitespace-nowrap">
                                            {circuit.size} <span className="text-[9px] sm:text-[11px] text-yellow-500/70">[㎟]</span>
                                        </span>
                                        {(judgment.scb?.parallelN || 1) > 1 && (
                                            <span className="text-yellow-400 font-bold text-[11px] sm:text-[13px] whitespace-nowrap">
                                                × {getCableLineCount(judgment.scb.parallelN, circuit.size, judgment.at_b?.phase)} <span className="text-[9px] sm:text-[11px] text-yellow-500/70">LINE</span>
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex justify-between text-[11px] sm:text-[13px] pt-1">
                                    <span className="text-blue-400 font-bold">추천 도체면적</span>
                                    <span 
                                        className={`text-blue-400 font-bold text-[11px] sm:text-[13px] transition-colors rounded ${!isPL ? 'cursor-pointer hover:bg-blue-500/10 px-1 -mr-1' : 'opacity-80'}`}
                                        onClick={() => {
                                            if (isPL) return;
                                            const val = judgment.scb?.recommendedSize;
                                            if (val && val !== '-') {
                                                onUpdateCircuit && onUpdateCircuit('size', val);
                                            }
                                        }}
                                    >
                                        {judgment.scb?.recommendedSize} <span className="text-[9px] sm:text-[11px] text-blue-500/70">[㎟]</span>
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
                        <section ref={el => sectionRefs.current['se'] = el} className="space-y-4">
                            <div className="flex items-center gap-2">
                                <div className={`w-1.5 h-4 ${activeHighlight === 'se' ? 'bg-yellow-400' : 'bg-blue-500'} transition-colors duration-300`}></div>
                                <h3 className={`text-[14px] font-bold uppercase tracking-wider ${getHighlightClass('se')}`}>S<sub>e%</sub> 전압강하를 고려한 단면적</h3>
                                <span className={`ml-auto text-[11px] px-2 py-1 rounded font-bold ${judgment.se?.status === 'Ok' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                    {judgment.se?.status}
                                </span>
                            </div>
                            <div className="space-y-3">
                                {/* Row 1: L, e, E - 3 columns */}
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="bg-gray-900/50 p-3 border border-gray-800 text-center">
                                        <div className="text-[9px] sm:text-[11px] text-gray-300 mb-1">D (부하 거리)</div>
                                        <div className="flex items-center justify-center relative gap-1">
                                            <input
                                                type="number"
                                                value={circuit.cableDistance || circuit.cableLength || 15}
                                                onChange={(e) => !isPL && onUpdateCableDistance && onUpdateCableDistance(Number(e.target.value) || 15)}
                                                readOnly={isPL}
                                                className={`w-[30px] bg-transparent text-center text-[13px] sm:text-[15px] font-mono outline-none transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${isPL ? 'text-green-400 cursor-default' : 'text-white focus:bg-gray-800/50'}`}
                                            /><span className="text-[9px] sm:text-[10px] text-gray-600">[m]</span>
                                        </div>
                                    </div>
                                    <div className="bg-gray-900/50 p-3 border border-gray-800 text-center">
                                        <div className="text-[9px] sm:text-[11px] text-gray-300 mb-1">e (전압강하)</div>
                                        <div className="text-[13px] sm:text-[15px] font-mono text-white flex items-center justify-center gap-1">{judgment.se?.e_v || '-'} <span className="text-[9px] sm:text-[10px] text-gray-600">[V]</span></div>
                                    </div>
                                    <div className="bg-gray-900/50 p-3 border border-gray-800 text-center">
                                        <div className="text-[9px] sm:text-[11px] text-gray-300 mb-1">E (전압강하율)</div>
                                        <div className="text-[13px] sm:text-[15px] font-mono text-white flex items-center justify-center gap-1">{judgment.se?.e_percent || '-'} <span className="text-[9px] sm:text-[10px] text-gray-600">[%]</span></div>
                                    </div>
                                </div>
                                {/* Row 2: R, X - 2 columns */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-gray-900/50 p-3 border border-gray-800 text-center">
                                        <div className="text-[9px] sm:text-[11px] text-gray-300 mb-1">R (저항)</div>
                                        <div className="text-[13px] sm:text-[15px] font-mono text-white">{judgment.se?.r || '-'} <span className="text-[9px] sm:text-[10px] text-gray-600">[Ω]</span></div>
                                    </div>
                                    <div className="bg-gray-900/50 p-3 border border-gray-800 text-center">
                                        <div className="text-[9px] sm:text-[11px] text-gray-300 mb-1">X (리액턴스)</div>
                                        <div className="text-[13px] sm:text-[15px] font-mono text-white">{judgment.se?.x || '-'} <span className="text-[9px] sm:text-[10px] text-gray-600">[Ω]</span></div>
                                    </div>
                                </div>
                                {/* Row 3: cosθ, sinθ - 2 columns */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-gray-900/50 p-3 border border-gray-800 text-center">
                                        <div className="text-[9px] sm:text-[11px] text-gray-300 mb-1">cosθ (역률)</div>
                                        <div className="text-[13px] sm:text-[15px] font-mono text-white">{judgment.se?.cos_theta || '-'}</div>
                                    </div>
                                    <div className="bg-gray-900/50 p-3 border border-gray-800 text-center">
                                        <div className="text-[9px] sm:text-[11px] text-gray-300 mb-1">sinθ (무효율)</div>
                                        <div className="text-[13px] sm:text-[15px] font-mono text-white">{judgment.se?.sin_theta || '-'}</div>
                                    </div>
                                </div>
                                <div className="mt-2 flex flex-col gap-0.5 px-1 leading-tight">
                                    <div className="text-[10px] text-white font-medium italic">
                                        * 설계기준강하: {projectInfo?.voltageDropLimit || 3}%
                                    </div>
                                    {judgment.se?.isParallel && (
                                        <div className="text-[10px] text-yellow-500 font-medium tracking-tighter">
                                            * 병렬보정: K<sub>R</sub>({judgment.se?.kr || '0.5'}), K<sub>X</sub>({judgment.se?.kx || '0.75'}) 적용됨
                                        </div>
                                    )}
                                </div>
                                <div className="flex justify-between text-[11px] sm:text-[13px] pt-1 border-t border-gray-800 mt-2">
                                    <span className={`font-bold ${!isPL ? 'text-blue-400' : 'text-gray-500'}`}>추천 도체면적</span>
                                    <span 
                                        className={`font-bold text-[11px] sm:text-[13px] transition-colors rounded ${!isPL ? 'text-blue-400 cursor-pointer hover:bg-blue-500/10 px-1 -mr-1' : 'text-gray-500 opacity-80'}`}
                                        onClick={() => {
                                            if (isPL) return;
                                            const val = seRecommendedSize;
                                            if (val && val !== '300+') {
                                                onUpdateCircuit && onUpdateCircuit('size', val);
                                            }
                                        }}
                                    >
                                        {seRecommendedSize} <span className={`text-[9px] sm:text-[11px] ${!isPL ? 'text-blue-500/70' : 'text-gray-600'}`}>[㎟]</span>
                                    </span>
                                </div>
                            </div>
                        </section>

                        {/* S_SC Section */}
                        <section ref={el => sectionRefs.current['ssc'] = el} className="space-y-4">
                            <div className="flex items-center gap-2">
                                <div className={`w-1.5 h-4 ${activeHighlight === 'ssc' ? 'bg-yellow-400' : 'bg-blue-500'} transition-colors duration-300`}></div>
                                <h3 className={`text-[14px] font-bold uppercase tracking-wider ${getHighlightClass('ssc')}`}>S<sub>SC</sub> 단락전류를 고려한 단면적</h3>
                                <div className="flex items-center gap-2 ml-auto">
                                    <span className="text-[10px] text-white bg-gray-900 px-1.5 py-0.5 rounded border border-gray-800">
                                        ISC {judgment.ssc?.isPercent}%
                                    </span>
                                    <span className={`text-[11px] px-2 py-1 rounded font-bold ${judgment.ssc?.status === 'Ok' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                        {judgment.ssc?.status}
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
                                                ? `${circuit.size}x${judgment.ssc.n}`
                                                : (circuit.size || '-')}
                                        </div>
                                    </div>
                                    <div 
                                        className={`bg-gray-900/50 p-3 border border-gray-800 text-center transition-colors group ${!isPL ? 'cursor-pointer hover:bg-blue-500/10' : 'cursor-not-allowed opacity-80'}`}
                                        onClick={() => {
                                            if (isPL) return;
                                            const val = judgment.ssc?.recommendedSize;
                                            if (val && val !== '-') {
                                                onUpdateCircuit && onUpdateCircuit('size', val);
                                            }
                                        }}
                                    >
                                        <div className={`text-[9px] sm:text-[11px] mb-1 leading-tight transition-colors ${!isPL ? 'text-gray-300 group-hover:text-blue-400' : 'text-gray-500'}`}>추천 [㎟]<br />(표준 단면적)</div>
                                        <div className={`text-[13px] sm:text-[15px] font-mono font-bold transition-colors ${!isPL ? 'text-blue-400 group-hover:text-blue-300' : 'text-gray-500'}`}>{judgment.ssc?.recommendedSize || '-'}</div>
                                    </div>
                                    <div className="bg-gray-900/50 p-3 border border-gray-800 text-center">
                                        <div className="text-[9px] sm:text-[11px] text-gray-300 mb-1 leading-tight">S<sub>SC</sub> [㎟]<br />(계산 단면적)</div>
                                        <div className="text-[13px] sm:text-[15px] font-mono text-white">{judgment.ssc?.ssc_calculated?.toFixed(2) || '-'}</div>
                                    </div>
                                </div>
                                {/* Row 2: 예상 ISC, tn, tz */}
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="bg-gray-900/50 p-3 border border-gray-800 text-center">
                                        <div className="text-[9px] sm:text-[11px] text-gray-300 mb-1 leading-tight">I<sub>SC</sub> [kA]<br />(예상 단락전류)</div>
                                        <div className="text-[13px] sm:text-[15px] font-mono text-white">{judgment.ssc?.isc?.toFixed(1) || '-'}</div>
                                    </div>
                                    <div className="bg-gray-900/50 p-3 border border-gray-800 text-center">
                                        <div className="text-[9px] sm:text-[11px] text-gray-300 mb-1 leading-tight">t<sub>n</sub> [s]<br />(차단 시간)</div>
                                        <div className="text-[13px] sm:text-[15px] font-mono text-white">{judgment.ssc?.tn || '-'}</div>
                                    </div>
                                    <div className="bg-gray-900/50 p-3 border border-gray-800 text-center">
                                        <div className="text-[9px] sm:text-[11px] text-gray-300 mb-1 leading-tight">t<sub>z</sub> [s]<br />(판정식)</div>
                                        <div className="text-[13px] sm:text-[15px] font-mono text-white">{judgment.ssc?.tz?.toFixed(4) || '-'}</div>
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
            </div>
        </div>
    );
};

export default KECJudgmentDrawer;

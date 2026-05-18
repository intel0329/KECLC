import React, { useMemo, useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { CornerBorders } from '../ui/PowerLoadUI';
import { isCableMethodValid, calculateKECJudgment } from '../../../utils/kecCalculations';

const CABLE_SIZES = ['1.5', '2.5', '4', '6', '10', '16', '25', '35', '50', '70', '95', '120', '150', '185', '240', '300'];

const PowerLoadKECDrawer = ({ isOpen, onClose, load, onUpdateCableDistance, onUpdateKecSettings, onUpdateCircuit, highlightSection, kecSettings, projectInfo }) => {
    const [activeHighlight, setActiveHighlight] = useState(null);
    const scrollContainerRef = useRef(null);
    const sectionRefs = useRef({});

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

    useEffect(() => {
        if (!isOpen) {
            setActiveHighlight(null);
        }
    }, [isOpen]);

    const getHighlightClass = (sectionId) => {
        if (activeHighlight === sectionId) {
            return 'animate-pulse text-red-500 transition-colors duration-300';
        }
        return 'text-white';
    };

    const judgment = load?.kecJudgment || {};

    // Se% 추천 단면적 계산 (Decide Drawer 로직 참고)
    const seRecommendedSize = useMemo(() => {
        if (!load) return '-';
        const limit = Number(projectInfo?.voltageDropLimit) || 3;

        // Reconstruct circuit for calculation
        const baseCircuit = {
            ...load,
            ib: Number(load.designCurrent) || 0,
            cableDistance: load.cableDistance || 15,
            p: Number(load.cbP) || (String(load.phase || '').replace(/[-\s]/g, '').replace(/Ø/g, 'Φ').toUpperCase().includes('1Φ') ? 2 : 4),
        };

        for (const s of CABLE_SIZES) {
            const testCircuit = { ...baseCircuit, size: s };
            const testJudgment = calculateKECJudgment(testCircuit, kecSettings, projectInfo);
            if (Number(testJudgment.se?.e_percent) <= limit) {
                return s;
            }
        }
        return '300+';
    }, [load, kecSettings, projectInfo]);

    if (!load) return null;

    // Helper to calculate the correct number of LINEs based on phase system and cable core type
    const getCableLineCount = (parallelN, size, phaseSystem) => {
        if (!parallelN || parallelN <= 1) return parallelN;
        const cableSize = Number(size) || 0;
        const threshold = Number(kecSettings?.cableCondition?.area) || 50;

        if (cableSize >= threshold) {
            // 단심 케이블 (Single-core)
            let wires = 1; // Default fallback
            if (phaseSystem) {
                const cleanPh = String(phaseSystem).replace(/[-\s]/g, '').replace(/Ø/g, 'Φ').toUpperCase();
                if (cleanPh.includes('3Φ4W') || cleanPh.includes('3상4선')) wires = 4;
                else if (cleanPh.includes('3Φ3W') || cleanPh.includes('3상3선')) wires = 3;
                else if (cleanPh.includes('1Φ') || cleanPh.includes('1상2선')) wires = 2;
                else wires = Number(load.cbP) || 1; // Fallback to cbP if available but phase parsing fails
            } else {
                wires = Number(load.cbP) || 1;
            }
            return parallelN * wires;
        }

        // 다심 케이블 (Multi-core)
        return parallelN;
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
                            <p className="text-xs text-gray-400 mt-1">회로번호: {load.circuitNo || '-'} | 부하명: {load.equipmentName || '-'}</p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-gray-900 rounded-full transition-colors font-bold text-gray-400">
                            <X size={24} />
                        </button>
                    </div>

                    <div ref={scrollContainerRef} className="flex-grow overflow-y-auto space-y-8 pr-2 scrollbar-hide">
                        {/* AT_B Section */}
                        <section ref={el => sectionRefs.current['at_b'] = el} className="space-y-4">
                            <div className="flex items-center gap-2">
                                <div className={`w-1.5 h-4 ${activeHighlight === 'at_b' ? 'bg-red-500' : 'bg-blue-500'} transition-colors duration-300`}></div>
                                <h3 className={`text-[14px] font-bold uppercase tracking-wider ${getHighlightClass('at_b')}`}>AT<sub>B</sub> 설계전류를 고려한 보호장치</h3>
                                <div className="flex items-center gap-2 ml-auto">
                                    <span className="text-[10px] text-white bg-gray-900 px-1.5 py-0.5 rounded border border-gray-800">
                                        {(load.phase && String(load.phase).replace(/Ø/g, 'Φ').includes('Φ')) ? String(load.phase).replace(/Ø/g, 'Φ').split('Φ')[0] + 'Φ' : (load.phase || '-')}
                                    </span>
                                    <span className={`text-[11px] px-2 py-1 rounded font-bold ${judgment.at_b?.status === 'Ok' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                        {judgment.at_b?.status || '-'}
                                    </span>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-gray-900/50 p-3 border border-gray-800 text-center">
                                    <div className="text-[9px] sm:text-[11px] text-gray-300 mb-1 leading-tight">I<sub>B</sub> [A]<br />(설계회로)</div>
                                    <div className="text-[13px] sm:text-[15px] font-mono text-white">{load.designCurrent || '0.00'}</div>
                                </div>
                                <div className="bg-gray-900/50 p-3 border border-gray-800 text-center">
                                    <div className="text-[9px] sm:text-[11px] text-gray-300 mb-1 leading-tight">I<sub>N</sub> [A]<br />(차단기 정격)</div>
                                    <div className="text-[13px] sm:text-[15px] font-mono text-white">{load.at || '-'}</div>
                                </div>
                                <div
                                    className="bg-gray-900/50 p-3 border border-blue-500/30 text-center cursor-pointer hover:bg-blue-500/10 transition-colors group"
                                    onClick={() => {
                                        const val = load.recommendedIn;
                                        if (val && val !== 'N/A' && val !== '-') {
                                            onUpdateCircuit && onUpdateCircuit(load.id, 'at', val);
                                        }
                                    }}
                                >
                                    <div className="text-[9px] sm:text-[11px] text-blue-400 mb-1 leading-tight group-hover:text-blue-300">I<sub>N</sub> [A]<br />(추천 정격)</div>
                                    <div className="text-[13px] sm:text-[15px] font-mono text-blue-400 font-bold group-hover:text-blue-300">{load.recommendedIn || '-'}</div>
                                </div>
                            </div>
                            <div className="text-[10px] text-white px-1 leading-tight">
                                * 조건: I<sub>B</sub> ≤ I<sub>N</sub>
                            </div>
                        </section>

                        {/* AT_TH Section */}
                        <section ref={el => sectionRefs.current['at_th'] = el} className="space-y-4">
                            <div className="flex items-center gap-2">
                                <div className={`w-1.5 h-4 ${activeHighlight === 'at_th' ? 'bg-red-500' : 'bg-blue-500'} transition-colors duration-300`}></div>
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
                                <div className="bg-gray-900/50 p-2 sm:p-3 border border-gray-800 text-center flex flex-col justify-center">
                                    <div className="text-[9px] sm:text-[11px] text-gray-300 uppercase mb-1 leading-tight">
                                        I<sub>z</sub> [A]
                                        <br />(허용전류)
                                    </div>
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
                        <section ref={el => sectionRefs.current['at_sc'] = el} className="space-y-4">
                            <div className="flex items-center gap-2">
                                <div className={`w-1.5 h-4 ${activeHighlight === 'at_sc' ? 'bg-red-500' : 'bg-blue-500'} transition-colors duration-300`}></div>
                                <h3 className={`text-[14px] font-bold uppercase tracking-wider ${getHighlightClass('at_sc')}`}>AT<sub>SC</sub> 단락전류를 고려한 정격</h3>
                                <div className="flex items-center gap-2 ml-auto">
                                    <span className="text-[10px] text-white bg-gray-900 px-1.5 py-0.5 rounded border border-gray-800">
                                        ISC {judgment.at_sc?.isPercent}%
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

                        {/* AT_MS Section */}
                        <section ref={el => sectionRefs.current['at_ms'] = el} className="space-y-4">
                            <div className="flex items-center gap-2">
                                <div className={`w-1.5 h-4 ${activeHighlight === 'at_ms' ? 'bg-red-500' : 'bg-blue-500'} transition-colors duration-300`}></div>
                                <h3 className={`text-[14px] font-bold uppercase tracking-wider ${getHighlightClass('at_ms')}`}>AT<sub>MS</sub> 기동전류를 고려한 정격</h3>
                                <div className="flex items-center gap-2 ml-auto">
                                    <span className={`text-[11px] px-2 py-1 rounded font-bold ${judgment.at_ms?.status === 'Ok' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                        {judgment.at_ms?.status || '-'}
                                    </span>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-gray-900/50 p-3 border border-gray-800 text-center">
                                    <div className="text-[9px] sm:text-[11px] text-gray-300 mb-1 leading-tight">δ<br />(규약동작배율)</div>
                                    <div className="text-[13px] sm:text-[15px] font-mono text-white">{judgment.at_ms?.delta || '-'}</div>
                                </div>
                                <div className="bg-gray-900/50 p-3 border border-gray-800 text-center">
                                    <div className="text-[9px] sm:text-[11px] text-gray-300 mb-1 leading-tight">(I<sub>MS</sub> * α) / δ<br />(최소정격)</div>
                                    <div className="text-[13px] sm:text-[15px] font-mono text-white">{(judgment.at_ms?.ims_delta || 0).toFixed(2)}</div>
                                </div>
                                <div
                                    className="bg-gray-900/50 p-3 border border-blue-500/30 text-center cursor-pointer hover:bg-blue-500/10 transition-colors group"
                                    onClick={() => {
                                        const val = judgment.at_ms?.recommendedIn;
                                        if (val && val !== 'N/A' && val !== '-') {
                                            onUpdateCircuit && onUpdateCircuit(load.id, 'at', val);
                                        }
                                    }}
                                >
                                    <div className="text-[9px] sm:text-[11px] text-blue-400 mb-1 leading-tight group-hover:text-blue-300">I<sub>N</sub> [A]<br />(추천 정격)</div>
                                    <div className="text-[13px] sm:text-[15px] font-mono text-blue-400 font-bold group-hover:text-blue-300">{judgment.at_ms?.recommendedIn || '-'}</div>
                                </div>
                            </div>
                            <div className="mt-1 flex flex-col gap-0.5 px-1 leading-tight">
                                <div className="text-[10px] text-white">* 조건: I<sub>N</sub> ≥ (I<sub>MS</sub> × α) / δ</div>
                                <div className="text-[10px] text-white">* 여유계수(α): {judgment.at_ms?.alpha || '1.0'}</div>
                                <div className="text-[10px] text-white">* I<sub>MS</sub> = {judgment.at_ms?.ims > 0 ? Number(judgment.at_ms.ims).toFixed(2) : '-'} A</div>
                            </div>
                        </section>

                        {/* AT_MI Section */}
                        <section ref={el => sectionRefs.current['at_mi'] = el} className="space-y-4">
                            <div className="flex items-center gap-2">
                                <div className={`w-1.5 h-4 ${activeHighlight === 'at_mi' ? 'bg-red-500' : 'bg-blue-500'} transition-colors duration-300`}></div>
                                <h3 className={`text-[14px] font-bold uppercase tracking-wider ${getHighlightClass('at_mi')}`}>AT<sub>MI</sub> 기동돌입전류를 고려한 정격</h3>
                                <div className="flex items-center gap-2 ml-auto">
                                    <button
                                        onClick={() => {
                                            const current = judgment.at_mi?.multiplierType || 'delta2';
                                            const next = current === 'delta' ? 'delta2' : 'delta';
                                            onUpdateKecSettings && onUpdateKecSettings('atMiMultiplierType', next);
                                        }}
                                        className="text-[10px] text-white bg-gray-900 hover:bg-gray-800 px-1.5 py-0.5 rounded border border-gray-800 transition-colors cursor-pointer flex items-center gap-1"
                                        title="클릭하여 배율 선택 변경 (δ ↔ δ₂)"
                                    >
                                        <span>{judgment.at_mi?.multiplierType === 'delta' ? 'δ' : 'δ₂'}</span>
                                        <span className="hidden sm:inline">{judgment.at_mi?.multiplierValue || '-'}</span>
                                    </button>
                                    <span className={`text-[11px] px-2 py-1 rounded font-bold ${judgment.at_mi?.status === 'Ok' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                        {judgment.at_mi?.status || '-'}
                                    </span>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-gray-900/50 p-3 border border-gray-800 text-center">
                                    <div className="text-[9px] sm:text-[11px] text-gray-300 mb-1 leading-tight">
                                        {judgment.at_mi?.multiplierType === 'delta' ? 'δ' : 'δ₂'}<br />
                                        ({judgment.at_mi?.multiplierType === 'delta' ? '규약동작배율' : '순시특성 배율'})
                                    </div>
                                    <div className="text-[13px] sm:text-[15px] font-mono text-white">{judgment.at_mi?.multiplierValue || '-'}</div>
                                </div>
                                <div className="bg-gray-900/50 p-3 border border-gray-800 text-center">
                                    <div className="text-[9px] sm:text-[11px] text-gray-300 mb-1 leading-tight">
                                        (I<sub>MI</sub> * α) / {judgment.at_mi?.multiplierType === 'delta' ? 'δ' : 'δ₂'}<br />
                                        (최소정격)
                                    </div>
                                    <div className="text-[13px] sm:text-[15px] font-mono text-white">
                                        {(judgment.at_mi?.imi_status_val || 0).toFixed(2)}
                                    </div>
                                </div>
                                <div
                                    className="bg-gray-900/50 p-3 border border-blue-500/30 text-center cursor-pointer hover:bg-blue-500/10 transition-colors group"
                                    onClick={() => {
                                        const val = judgment.at_mi?.recommendedIn;
                                        if (val && val !== 'N/A' && val !== '-') {
                                            onUpdateCircuit && onUpdateCircuit(load.id, 'at', val);
                                        }
                                    }}
                                >
                                    <div className="text-[9px] sm:text-[11px] text-blue-400 mb-1 leading-tight group-hover:text-blue-300">I<sub>N</sub> [A]<br />(추천 정격)</div>
                                    <div className="text-[13px] sm:text-[15px] font-mono text-blue-400 font-bold group-hover:text-blue-300">{judgment.at_mi?.recommendedIn || '-'}</div>
                                </div>
                            </div>
                            <div className="mt-1 flex flex-col gap-0.5 px-1 leading-tight">
                                <div className="text-[10px] text-white">* 조건: I<sub>N</sub> ≥ (I<sub>MI</sub> × α) / {judgment.at_mi?.multiplierType === 'delta' ? 'δ' : 'δ₂'} (단, I<sub>MI</sub> = I<sub>MS</sub> × K)</div>
                                <div className="text-[10px] text-white">* K(돌입전류 배율): {judgment.at_mi?.globalK || '-'}</div>
                                <div className="text-[10px] text-white">* 여유계수(α): {judgment.at_mi?.alpha || '1.0'}</div>
                                <div className="text-[10px] text-white">* I<sub>MI</sub> = {judgment.at_mi?.imi > 0 ? Number(judgment.at_mi.imi).toFixed(2) : '-'} A</div>
                            </div>
                        </section>

                        {/* SB Section */}
                        <section ref={el => sectionRefs.current['sb'] = el} className="space-y-4">
                            <div className="flex items-center gap-2">
                                <div className={`w-1.5 h-4 ${activeHighlight === 'sb' ? 'bg-red-500' : 'bg-blue-500'} transition-colors duration-300`}></div>
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
                                    <div className="bg-black/30 p-2 rounded border border-gray-800/50 text-center relative">
                                        {!isCableMethodValid(load, kecSettings) && (
                                            <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center animate-bounce drop-shadow-md">
                                                <div className="bg-red-500/85 backdrop-blur-sm text-white text-[11px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap border border-white/20 relative">
                                                    Chk.
                                                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-t-[8px] border-t-red-500/85"></div>
                                                </div>
                                            </div>
                                        )}
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
                                            {load.size} <span className="text-[9px] sm:text-[11px] text-yellow-500/70">[㎟]</span>
                                        </span>
                                        {judgment.sb?.parallelN > 1 && (
                                            <span className="text-yellow-400 font-bold text-[11px] sm:text-[13px] whitespace-nowrap">
                                                × {getCableLineCount(judgment.sb.parallelN, load.size, load.phase)} <span className="text-[9px] sm:text-[11px] text-yellow-500/70">LINE</span>
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
                                        className="text-blue-400 font-bold text-[11px] sm:text-[13px] whitespace-nowrap cursor-pointer hover:bg-blue-500/10 px-1 -mr-1 rounded transition-colors"
                                        onClick={() => {
                                            const val = judgment.sb?.recommendedSize;
                                            if (val && val !== 'N/A' && val !== '-') {
                                                onUpdateCircuit && onUpdateCircuit(load.id, 'size', val.toString());
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
                                    <span>보정 계수: {(judgment.sb?.totalFactor || 0).toFixed(2)}</span>
                                    <span className="underline decoration-yellow-500 underline-offset-2 decoration-2 text-white font-bold tracking-tight">보정 허용전류: {Number((judgment.at_th?.iz || judgment.sb?.correctedIz || 0).toFixed(2))} [A]</span>
                                </div>
                            </div>
                        </section>

                        {/* SCB Section */}
                        <section ref={el => sectionRefs.current['scb'] = el} className="space-y-4">
                            <div className="flex items-center gap-2">
                                <div className={`w-1.5 h-4 ${activeHighlight === 'scb' ? 'bg-red-500' : 'bg-blue-500'} transition-colors duration-300`}></div>
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
                                <div className="flex justify-between items-center text-[11px] sm:text-[13px] pt-1">
                                    <span className="text-yellow-400 font-bold">적용 도체면적</span>
                                    <div className="text-right flex items-center gap-1">
                                        <span className="text-yellow-400 font-bold text-[11px] sm:text-[13px] whitespace-nowrap">
                                            {load.size} <span className="text-[9px] sm:text-[11px] text-yellow-500/70">[㎟]</span>
                                        </span>
                                        {judgment.scb?.parallelN > 1 && (
                                            <span className="text-yellow-400 font-bold text-[11px] sm:text-[13px] whitespace-nowrap">
                                                × {getCableLineCount(judgment.scb.parallelN, load.size, load.phase)} <span className="text-[9px] sm:text-[11px] text-yellow-500/70">LINE</span>
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex justify-between text-[11px] sm:text-[13px] pt-1">
                                    <span className="text-blue-400 font-bold">추천 도체면적</span>
                                    <span
                                        className="text-blue-400 font-bold text-[11px] sm:text-[13px] cursor-pointer hover:bg-blue-500/10 px-1 -mr-1 rounded transition-colors"
                                        onClick={() => {
                                            const val = judgment.scb?.recommendedSize;
                                            if (val && val !== 'N/A' && val !== '-') {
                                                onUpdateCircuit && onUpdateCircuit(load.id, 'size', val.toString());
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
                                <div className={`w-1.5 h-4 ${activeHighlight === 'se' ? 'bg-red-500' : 'bg-blue-500'} transition-colors duration-300`}></div>
                                <h3 className={`text-[14px] font-bold uppercase tracking-wider ${getHighlightClass('se')}`}>S<sub>e%</sub> 전압강하를 고려한 단면적</h3>
                                <span className={`ml-auto text-[11px] px-2 py-1 rounded font-bold ${judgment.se?.status === 'Ok' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                    {judgment.se?.status || '-'}
                                </span>
                            </div>
                            <div className="space-y-3">
                                {/* Row 1: D, e, E - 3 columns */}
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="bg-gray-900/50 p-3 border border-gray-800 text-center">
                                        <div className="text-[9px] sm:text-[11px] text-gray-300 mb-1 leading-tight">D (부하 거리)</div>
                                        <div className="flex items-center justify-center gap-1">
                                            <input
                                                type="number"
                                                value={load.cableDistance || load.d || 15}
                                                onChange={(e) => onUpdateCableDistance && onUpdateCableDistance(Number(e.target.value) || 15)}
                                                className="w-[30px] bg-transparent text-center text-[13px] sm:text-[15px] font-mono text-white outline-none focus:bg-gray-800/50 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            /><span className="text-[9px] sm:text-[10px] text-gray-600">[m]</span>
                                        </div>
                                    </div>
                                    <div className="bg-gray-900/50 p-3 border border-gray-800 text-center">
                                        <div className="text-[9px] sm:text-[11px] text-gray-300 mb-1 leading-tight">e (전압강하)</div>
                                        <div className="text-[13px] sm:text-[15px] font-mono text-white flex items-center justify-center gap-1">{judgment.se?.e_v || '-'} <span className="text-[9px] sm:text-[10px] text-gray-600">[V]</span></div>
                                    </div>
                                    <div className="bg-gray-900/50 p-3 border border-gray-800 text-center">
                                        <div className="text-[9px] sm:text-[11px] text-gray-300 mb-1 leading-tight">E (전압강하율)</div>
                                        <div className="text-[13px] sm:text-[15px] font-mono text-white flex items-center justify-center gap-1">{judgment.se?.e_percent || '-'} <span className="text-[9px] sm:text-[10px] text-gray-600">[%]</span></div>
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
                                <div className="mt-1 flex flex-col gap-0.5 px-1 leading-tight">
                                    <div className="text-[10px] text-white font-medium italic">
                                        * 설계기준강하: {judgment.se?.limit || 3}%
                                    </div>
                                    {judgment.se?.isParallel && (
                                        <div className="text-[9px] sm:text-[10px] text-yellow-500 font-medium tracking-tighter">
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
                                            if (val && val !== '300+' && val !== '-') {
                                                onUpdateCircuit && onUpdateCircuit(load.id, 'size', val.toString());
                                            }
                                        }}
                                    >
                                        {seRecommendedSize} <span className="text-[9px] sm:text-[11px] text-blue-500/70">[㎟]</span>
                                    </span>
                                </div>
                            </div>
                        </section>

                        {/* SMSe% Section */}
                        {judgment.smse?.status !== '-' && (
                            <section ref={el => sectionRefs.current['smse'] = el} className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <div className={`w-1.5 h-4 ${activeHighlight === 'smse' ? 'bg-red-500' : 'bg-blue-500'} transition-colors duration-300`}></div>
                                    <h3 className={`text-[14px] font-bold uppercase tracking-wider ${getHighlightClass('smse')}`}>S<sub>MSe%</sub> 기동시 전압강하를 고려한 단면적</h3>
                                    <span className={`ml-auto text-[11px] px-2 py-1 rounded font-bold ${judgment.smse?.status === 'Ok' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                        {judgment.smse?.status || '-'}
                                    </span>
                                </div>
                                <div className="space-y-3">
                                    {/* Row 1: e, E, limit */}
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="bg-gray-900/50 p-3 border border-gray-800 text-center">
                                            <div className="text-[9px] sm:text-[11px] text-gray-300 mb-1 leading-tight">e (전압강하)</div>
                                            <div className="text-[13px] sm:text-[15px] font-mono text-white">{judgment.smse?.e_v || '-'} <span className="text-[9px] sm:text-[10px] text-gray-600">[V]</span></div>
                                        </div>
                                        <div className="bg-gray-900/50 p-3 border border-gray-800 text-center">
                                            <div className="text-[9px] sm:text-[11px] text-gray-300 mb-1 leading-tight">E (전압강하율)</div>
                                            <div className="text-[13px] sm:text-[15px] font-mono text-white">{judgment.smse?.e_percent || '-'} <span className="text-[9px] sm:text-[10px] text-gray-600">[%]</span></div>
                                        </div>
                                        <div className="bg-gray-900/50 p-3 border border-gray-800 text-center">
                                            <div className="text-[9px] sm:text-[11px] text-gray-300 mb-1 leading-tight">E (기준강하율)</div>
                                            <div className="text-[13px] sm:text-[15px] font-mono text-white">{judgment.smse?.limit || '-'} <span className="text-[9px] sm:text-[10px] text-gray-600">[%]</span></div>
                                        </div>
                                    </div>
                                    {/* Applied and Recommended Sizes */}
                                    <div className="bg-gray-900/50 p-4 border border-gray-800 space-y-3">
                                        <div className="flex justify-between items-center text-[11px] sm:text-[13px]">
                                            <span className="text-yellow-400 font-bold">적용 도체면적</span>
                                            <div className="text-right flex items-center gap-1">
                                                <span className="text-yellow-400 font-bold text-[11px] sm:text-[13px] whitespace-nowrap">
                                                    {judgment.smse?.appliedSize || '-'} <span className="text-[9px] sm:text-[11px] text-yellow-500/70">[㎟]</span>
                                                </span>
                                                {judgment.smse?.parallelN > 1 && (
                                                    <span className="text-yellow-400 font-bold text-[11px] sm:text-[13px] whitespace-nowrap">
                                                        × {getCableLineCount(judgment.smse.parallelN, load.size, load.phase)} <span className="text-[9px] sm:text-[11px] text-yellow-500/70">LINE</span>
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex justify-between text-[11px] sm:text-[13px] border-t border-gray-800 pt-3">
                                            <span className="text-blue-400 font-bold">추천 도체면적</span>
                                            <span
                                                className="text-blue-400 font-bold text-[11px] sm:text-[13px] cursor-pointer hover:bg-blue-500/10 px-1 -mr-1 rounded transition-colors"
                                                onClick={() => {
                                                    const val = judgment.smse?.recommendedSize;
                                                    if (val && val !== 'N/A' && val !== '-') {
                                                        onUpdateCircuit && onUpdateCircuit(load.id, 'size', val.toString());
                                                    }
                                                }}
                                            >
                                                {judgment.smse?.recommendedSize || '-'} <span className="text-[9px] sm:text-[11px] text-blue-500/70">[㎟]</span>
                                            </span>
                                        </div>
                                    </div>
                                    <div className="mt-1 flex flex-col gap-0.5 px-1 leading-tight">
                                        <div className="text-[10px] text-white italic">
                                            * I<sub>MS</sub>(기동 전류): {judgment.smse?.ims || '-'} [A]
                                        </div>
                                        <div className="text-[10px] text-white italic">
                                            * 설계기준강하: {judgment.smse?.limit || '-'}%
                                        </div>
                                        {judgment.smse?.parallelN > 1 && judgment.smse?.kr && (
                                            <div className="text-[9px] sm:text-[10px] text-yellow-500 font-medium tracking-tighter">
                                                * 병렬보정: K<sub>R</sub>({judgment.smse?.kr}), K<sub>X</sub>({judgment.smse?.kx}) 적용됨
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </section>
                        )}

                        {/* S_SC Section */}
                        <section ref={el => sectionRefs.current['ssc'] = el} className="space-y-4">
                            <div className="flex items-center gap-2">
                                <div className={`w-1.5 h-4 ${activeHighlight === 'ssc' ? 'bg-red-500' : 'bg-blue-500'} transition-colors duration-300`}></div>
                                <h3 className={`text-[14px] font-bold uppercase tracking-wider ${getHighlightClass('ssc')}`}>S<sub>SC</sub> 단락전류를 고려한 단면적</h3>
                                <div className="flex items-center gap-2 ml-auto">
                                    <span className="text-[10px] text-white bg-gray-900 px-1.5 py-0.5 rounded border border-gray-800">
                                        ISC {judgment.ssc?.isPercent}%
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
                                            {judgment.ssc?.isParallel && (judgment.ssc?.n || 1) > 1
                                                ? `${load.size}x${judgment.ssc.n}`
                                                : (load.size || '-')}
                                        </div>
                                    </div>
                                    <div
                                        className="bg-gray-900/50 p-3 border border-blue-500/30 text-center cursor-pointer hover:bg-blue-500/10 transition-colors group"
                                        onClick={() => {
                                            const val = judgment.ssc?.recommendedSize;
                                            if (val && val !== 'N/A' && val !== '-') {
                                                onUpdateCircuit && onUpdateCircuit(load.id, 'size', val.toString());
                                            }
                                        }}
                                    >
                                        <div className="text-[9px] sm:text-[11px] text-blue-400 mb-1 leading-tight group-hover:text-blue-300">추천 [㎟]<br />(표준 단면적)</div>
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
                                        <div className="text-[9px] sm:text-[11px] text-gray-300 mb-1 leading-tight">예상 I<sub>SC</sub> [kA]<br />(단락전류)</div>
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
                            <div className="text-[10px] text-white px-1 leading-tight">
                                * 계산: (I<sub>SC</sub> × √t<sub>n</sub> / K) × α = S<sub>SC</sub> [㎟]<br />
                                * 조건: t<sub>n</sub> ≤ t<sub>z</sub>
                                {judgment.ssc?.isParallel && (
                                    <div className="text-[10px] text-yellow-500 font-medium tracking-tighter mt-0.5">
                                        * 단락전류 할증계수(KIsc): {judgment.ssc?.kIsc}
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* SMSTh Section */}
                        {judgment.smsth?.status !== '-' && (
                            <section ref={el => sectionRefs.current['smsth'] = el} className="space-y-4">
                                <div className="flex items-start gap-2">
                                    <div className={`w-1.5 self-stretch ${activeHighlight === 'smsth' ? 'bg-red-500' : 'bg-blue-500'} transition-colors duration-300`}></div>
                                    <h3 className={`text-[14px] font-bold uppercase tracking-wider leading-tight ${getHighlightClass('smsth')}`}>
                                        S<sub>MSTh</sub> 기동전류에 의한 도체의<br />
                                        온도상승을 고려한 단면적
                                    </h3>
                                    <span className={`ml-auto text-[11px] px-2 py-1 rounded font-bold shrink-0 ${judgment.smsth?.status === 'Ok' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                        {judgment.smsth?.status || '-'}
                                    </span>
                                </div>
                                <div className="space-y-3">
                                    {/* Row 1: 선정, 추천, SMSTh */}
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="bg-gray-900/50 p-3 border border-gray-800 text-center">
                                            <div className="text-[9px] sm:text-[11px] text-gray-300 mb-1 leading-tight">선정 [㎟]<br />(도체 단면적)</div>
                                            <div className="text-[13px] sm:text-[15px] font-mono text-yellow-400 font-bold">
                                                {judgment.smsth?.isParallel && (judgment.smsth?.n || 1) > 1
                                                    ? `${load.size}x${judgment.smsth.n}`
                                                    : (load.size || '-')}
                                            </div>
                                        </div>
                                        <div
                                            className="bg-gray-900/50 p-3 border border-blue-500/30 text-center cursor-pointer hover:bg-blue-500/10 transition-colors group"
                                            onClick={() => {
                                                const val = judgment.smsth?.recommendedSize;
                                                if (val && val !== 'N/A' && val !== '-') {
                                                    onUpdateCircuit && onUpdateCircuit(load.id, 'size', val.toString());
                                                }
                                            }}
                                        >
                                            <div className="text-[9px] sm:text-[11px] text-blue-400 mb-1 leading-tight group-hover:text-blue-300">추천 [㎟]<br />(표준 단면적)</div>
                                            <div className="text-[13px] sm:text-[15px] font-mono text-blue-400 font-bold group-hover:text-blue-300">{judgment.smsth?.recommendedSize || '-'}</div>
                                        </div>
                                        <div className="bg-gray-900/50 p-3 border border-gray-800 text-center">
                                            <div className="text-[9px] sm:text-[11px] text-gray-300 mb-1 leading-tight">S<sub>MSTh</sub> [㎟]<br />(계산 단면적)</div>
                                            <div className="text-[13px] sm:text-[15px] font-mono text-white">{(judgment.smsth?.smsth_calculated || 0).toFixed(2)}</div>
                                        </div>
                                    </div>
                                    {/* Row 2: IMS, tm, n */}
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="bg-gray-900/50 p-3 border border-gray-800 text-center">
                                            <div className="text-[9px] sm:text-[11px] text-gray-300 mb-1 leading-tight">I<sub>MS</sub> [A]<br />(기동전류)</div>
                                            <div className="text-[13px] sm:text-[15px] font-mono text-white">{(judgment.smsth?.ims || 0).toFixed(2)}</div>
                                        </div>
                                        <div className="bg-gray-900/50 p-3 border border-gray-800 text-center">
                                            <div className="text-[9px] sm:text-[11px] text-gray-300 mb-1 leading-tight">t<sub>m</sub> [s]<br />(기동 시간)</div>
                                            <div className="text-[13px] sm:text-[15px] font-mono text-white">{judgment.smsth?.tm || '-'}</div>
                                        </div>
                                        <div className="bg-gray-900/50 p-3 border border-gray-800 text-center">
                                            <div className="text-[9px] sm:text-[11px] text-gray-300 mb-1 leading-tight">n<br />(병렬도체 수)</div>
                                            <div className={`text-[13px] sm:text-[15px] font-mono ${(judgment.smsth?.n || 1) >= 2 ? 'text-yellow-400 font-bold' : 'text-white'}`}>
                                                {judgment.smsth?.n || '-'}
                                            </div>
                                        </div>
                                    </div>
                                    {/* Row 3: 절연물, K(계수), α(여유) */}
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="bg-gray-900/50 p-3 border border-gray-800 text-center">
                                            <div className="text-[9px] sm:text-[11px] text-gray-300 mb-1 leading-tight">절연물<br />(K 계수 근거)</div>
                                            <div className="text-[13px] sm:text-[15px] font-mono text-white">{judgment.smsth?.insulation || 'XLPE'}</div>
                                        </div>
                                        <div className="bg-gray-900/50 p-3 border border-gray-800 text-center">
                                            <div className="text-[9px] sm:text-[11px] text-gray-300 mb-1 leading-tight">K<br />(K 계수)</div>
                                            <div className="text-[13px] sm:text-[15px] font-mono text-white">{judgment.smsth?.k || '-'}</div>
                                        </div>
                                        <div className="bg-gray-900/50 p-3 border border-gray-800 text-center">
                                            <div className="text-[9px] sm:text-[11px] text-gray-300 mb-1 leading-tight">α<br />(여유 계수)</div>
                                            <div className="text-[13px] sm:text-[15px] font-mono text-white">{judgment.smsth?.alpha || '-'}</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-[10px] text-white px-1 leading-tight">
                                    * 계산: S ≥ [(I<sub>MS</sub> × √t<sub>m</sub>) / (K × n)] × α [㎟]
                                </div>
                            </section>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PowerLoadKECDrawer;

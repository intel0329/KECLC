import React, { useState, useEffect, useRef, memo } from 'react';
import { CheckCircle, Download, AlertCircle } from 'lucide-react';
import { CornerBorders } from '../ui/PowerLoadUI';
import { calculateKECJudgment } from '../../../utils/kecCalculations';

const SummaryInput = memo(({ value, onSave, className = "", style = {}, type = "number", ...props }) => {
    const [localValue, setLocalValue] = useState(value || '');
    const timerRef = useRef(null);

    useEffect(() => {
        setLocalValue(value || '');
    }, [value]);

    const handleChange = (val) => {
        setLocalValue(val);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            onSave(val);
        }, 800);
    };

    const handleBlur = () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        onSave(localValue);
    };

    return (
        <input
            {...props}
            type={type}
            value={localValue}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={handleBlur}
            className={className}
            style={{ ...style, width: `${String(localValue || '').length || 1}ch` }}
        />
    );
});

const PowerLoadSummary = ({
    projectInfo,
    updateProjectInfo,
    totalLoad,
    phaseTotals,
    totalCurrentCalc,
    mainCtValue,
    summaryStats,
    hasDecideWarning,
    setIsPanelKECDrawerOpen,
    setPanelHighlightSection,
    exportToExcel,
    PHASE_LEVELS,
    maxLoadLevel,
    showToast,
    kecSettings
}) => {
    return (
        <div className="grid grid-cols-12 gap-4 mb-4">
            <div className="col-span-12 border border-gray-900 bg-black p-4 relative">
                <CornerBorders />
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[12px] font-bold text-gray-400 uppercase tracking-[0.2em]">Load Summary</h3>
                    <div className="flex gap-2" data-html2canvas-ignore="true">
                        <button
                            onClick={() => {
                                let firstFail = null;
                                const getP = (ph) => {
                                    const cleanPh = String(ph || '').replace(/[-\s]/g, '').replace(/Ø/g, 'Φ').toUpperCase();
                                    if (cleanPh.includes('1Φ')) return 2;
                                    if (cleanPh.includes('3Φ3W')) return 3;
                                    return 4;
                                };
                                const p = getP(projectInfo.phase);
                                const v = projectInfo.phase?.includes('1Φ') ? 220 : 380;
                                const ib = p === 2 ? totalLoad / v : totalLoad / (v * Math.sqrt(3));

                                // Calculate Panel-level Starting Current (IMS)
                                const sqrt3 = p === 2 ? 1 : Math.sqrt(3);
                                const pureKvaSum = (summaryStats?.maxMotorKva || 0) + (summaryStats?.othersSumKva || 0);
                                const panelIms = (pureKvaSum * 1000) / (sqrt3 * v);

                                const panelCircuit = {
                                    ib,
                                    at: projectInfo.mccbAT || 0,
                                    af: projectInfo.mccbAF || 0,
                                    type: projectInfo.mainBreakerType || 'MCCB',
                                    size: projectInfo.cableSize || 0,
                                    wire: projectInfo.wire || 'FCV',
                                    method: projectInfo.kecMethod || 'E',
                                    p,
                                    cableDistance: projectInfo.branchDistance || 30, // Standardized to 30
                                    scb: projectInfo.shortCircuitCurrent || 0,
                                    isGeneral: false, // Set to false to enable ATMS/ATMI judgment
                                    isPanel: true,
                                    startingCurrent: panelIms,
                                    startingTime: summaryStats?.maxAbsoluteTm || 0,
                                    delta: Number(projectInfo.cachedDelta) || 0,
                                    delta2: Number(projectInfo.cachedK) || 0,
                                    inrushCurrent: Number(projectInfo.cachedImi) || 0
                                };

                                const judgment = calculateKECJudgment(panelCircuit, kecSettings, projectInfo);
                                if (judgment) {
                                    const sections = ['at_b', 'at_th', 'at_sc', 'at_ms', 'at_mi', 'sb', 'scb', 'se', 'smse', 'ssc', 'smsth'];
                                    for (const sec of sections) {
                                        const status = judgment[sec]?.status;
                                        if (status === 'Fail' || status === 'Error' || status === 'Chk') {
                                            firstFail = sec;
                                            break;
                                        }
                                    }
                                }
                                setPanelHighlightSection(firstFail);
                                setIsPanelKECDrawerOpen(true);
                            }}
                            title="Decide"
                            className="w-10 md:w-[100px] aspect-square md:aspect-auto md:px-3 md:py-2 bg-yellow-600 hover:bg-yellow-500 text-white text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center md:gap-2 border border-yellow-400/50 relative"
                        >
                            <CheckCircle size={14} /> <span className="hidden md:inline">Decide</span>
                            {hasDecideWarning && (
                                <div className="absolute -top-3 -right-2 flex flex-col items-center animate-bounce z-10 pointer-events-none drop-shadow-md">
                                    <div className="bg-red-500/85 backdrop-blur-sm text-white text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap border border-white/20 relative">
                                        Chk
                                        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-t-[8px] border-t-red-500/85"></div>
                                    </div>
                                </div>
                            )}
                        </button>
                        <button
                            onClick={exportToExcel}
                            title="Excel"
                            className="w-10 md:w-[100px] aspect-square md:aspect-auto md:px-3 md:py-2 bg-green-700 hover:bg-green-600 text-white text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center md:gap-2 border border-green-500/50"
                        >
                            <Download size={14} /> <span className="hidden md:inline">Excel</span>
                        </button>
                    </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    <div className="bg-gray-900/30 p-4 min-h-[100px]">
                        <div className={`text-[10px] uppercase tracking-widest mb-1 transition-colors duration-300 ${hasDecideWarning ? 'text-red-500 font-bold' : 'text-gray-300'}`}>Main Breaker</div>
                        <div className="text-2xl font-bold text-yellow-400 flex items-baseline flex-wrap">
                            <span className="flex items-baseline">
                                <SummaryInput
                                    value={projectInfo.mccbAF}
                                    onSave={(val) => updateProjectInfo('mccbAF', val)}
                                    className="bg-transparent border-none text-yellow-400 font-bold text-2xl outline-none text-left [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none p-0"
                                />
                                <span className="text-[12px] text-gray-400 ml-1">AF</span>
                            </span>
                            <span className="flex items-baseline ml-4">
                                <SummaryInput
                                    value={projectInfo.mccbAT}
                                    onSave={(val) => updateProjectInfo('mccbAT', val)}
                                    className="bg-transparent border-none text-yellow-400 font-bold text-2xl outline-none text-left [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none p-0"
                                />
                                <span className="text-[12px] text-gray-400 ml-1">AT</span>
                            </span>
                        </div>
                        <div className="flex items-baseline gap-2 mt-1">
                            <select
                                value={projectInfo.phase}
                                onChange={(e) => {
                                    const newPhase = e.target.value;
                                    const newLevel = PHASE_LEVELS[newPhase] || 1;

                                    if (newLevel < maxLoadLevel) {
                                        showToast("하위 부하를 수용할 수 없는 상 설정", "error");
                                    }

                                    let newVoltage = projectInfo.voltage;
                                    if (newPhase.includes('1Φ')) newVoltage = '220V';
                                    else newVoltage = '380V';
                                    updateProjectInfo('phase', newPhase);
                                    updateProjectInfo('voltage', newVoltage);
                                }}
                                className="bg-transparent border-none text-sm font-bold outline-none cursor-pointer appearance-none p-0 text-[#facc15]"
                            >
                                <option value="1Φ-2W" className="bg-black">1Φ-2W</option>
                                <option value="3Φ-3W" className="bg-black">3Φ-3W</option>
                                <option value="3Φ-4W" className="bg-black">3Φ-4W</option>
                            </select>
                            <select
                                value={projectInfo.mainBreakerType || 'MCCB'}
                                onChange={(e) => updateProjectInfo('mainBreakerType', e.target.value)}
                                className="bg-transparent border-none text-yellow-400 font-bold text-sm outline-none cursor-pointer appearance-none p-0"
                            >
                                <option value="MCCB" className="bg-black">MCCB</option>
                                <option value="ELCB" className="bg-black">ELCB</option>
                            </select>
                        </div>
                    </div>
                    <div className="bg-gray-900/30 p-4 min-h-[100px] flex flex-col justify-between">
                        <div className="text-gray-300 text-[10px] uppercase tracking-widest mb-1">Phase Load</div>
                        <div>
                            {(() => {
                                const phases = [
                                    { label: 'L1', val: phaseTotals.l1 / 1000 },
                                    { label: 'L2', val: phaseTotals.l2 / 1000 },
                                    { label: 'L3', val: phaseTotals.l3 / 1000 }
                                ];
                                phases.sort((a, b) => {
                                    if (b.val === a.val) {
                                        return a.label.localeCompare(b.label);
                                    }
                                    return b.val - a.val;
                                });

                                const maxPhase = phases[0];
                                const other1 = phases[1];
                                const other2 = phases[2];

                                return (
                                    <>
                                        <div className="hidden sm:block">
                                            <div className="text-2xl font-bold text-white flex items-baseline">
                                                <span className="text-[12px] text-gray-400 mr-2">{maxPhase.label}:</span>
                                                <span>{maxPhase.val > 0 ? maxPhase.val.toFixed(2) : '-'}</span>
                                                {maxPhase.val > 0 && <span className="text-[12px] text-gray-400 ml-1">kVA</span>}
                                            </div>
                                            <div className="flex items-baseline gap-4 mt-2 text-[14px] font-bold text-gray-300">
                                                <span>
                                                    <span className="text-[10px] text-gray-500 mr-1">{other1.label}:</span>
                                                    {other1.val > 0 ? other1.val.toFixed(2) : '-'}
                                                </span>
                                                <span>
                                                    <span className="text-[10px] text-gray-500 mr-1">{other2.label}:</span>
                                                    {other2.val > 0 ? other2.val.toFixed(2) : '-'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex sm:hidden flex-col gap-2">
                                            <div className="text-2xl font-bold text-white flex items-baseline">
                                                <span className="text-[12px] text-gray-400 mr-2">{maxPhase.label}:</span>
                                                <span>{maxPhase.val > 0 ? maxPhase.val.toFixed(2) : '-'}</span>
                                                {maxPhase.val > 0 && <span className="text-[12px] text-gray-400 ml-1">kVA</span>}
                                            </div>
                                            <div className="flex flex-col gap-2 text-[14px] font-bold text-gray-300">
                                                <div className="flex items-baseline">
                                                    <span className="text-[10px] text-gray-500 mr-2 w-5">{other1.label}:</span>
                                                    {other1.val > 0 ? other1.val.toFixed(2) : '-'}
                                                </div>
                                                <div className="flex items-baseline">
                                                    <span className="text-[10px] text-gray-500 mr-2 w-5">{other2.label}:</span>
                                                    {other2.val > 0 ? other2.val.toFixed(2) : '-'}
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                    <div className="bg-gray-900/30 p-4 min-h-[100px]">
                        <div className="text-gray-300 text-[10px] uppercase tracking-widest mb-1">Total Load</div>
                        <div className="text-2xl font-bold text-blue-400">{(totalLoad / 1000).toFixed(2)}<span className="text-[12px] text-gray-400 ml-1">kVA</span></div>
                    </div>
                    <div className="bg-gray-900/30 p-4 min-h-[100px]">
                        <div className="text-gray-300 text-[10px] uppercase tracking-widest mb-1">Total Current</div>
                        <div className="text-2xl font-bold text-blue-400">
                            {totalCurrentCalc.toFixed(1)}
                            <span className="text-[12px] text-gray-400 ml-1">A</span>
                        </div>
                    </div>
                    <div className="bg-gray-900/30 p-4 min-h-[100px]">
                        <div className="text-gray-300 text-[10px] uppercase tracking-widest mb-1">MAIN CT</div>
                        <div className="text-2xl font-bold text-white">
                            {mainCtValue ? (
                                <>
                                    {mainCtValue}/5<span className="text-[12px] text-gray-400 ml-1">A</span>
                                </>
                            ) : '-'}
                        </div>
                    </div>
                </div>
                <div className="border-t border-gray-900 my-4"></div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-4">
                    <div className="bg-gray-900/30 p-4 min-h-[100px]">
                        <div className="text-gray-300 text-[10px] uppercase tracking-widest mb-1">Max Motor Capacity</div>
                        <div className="text-2xl font-bold text-green-400 flex flex-col justify-center">
                            <div>
                                {summaryStats.maxMotorKva.toFixed(2)}<span className="text-[12px] text-gray-400 ml-1">kVA</span>
                            </div>
                            {summaryStats.maxMotorKw > 0 && (
                                <div className="text-[14px] font-bold text-blue-400 mt-1 flex items-baseline gap-2">
                                    {summaryStats.maxMotorCircuitNo && (
                                        <span>"{summaryStats.maxMotorCircuitNo}"</span>
                                    )}
                                    <span>
                                        {summaryStats.maxMotorKw.toFixed(1)} <span className="text-[12px] text-gray-400 font-bold">kW</span>
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="bg-gray-900/30 p-4 min-h-[100px]">
                        <div className="text-gray-300 text-[10px] uppercase tracking-widest mb-1">Sum of Other Capacities</div>
                        <div className="text-2xl font-bold text-white">{summaryStats.othersSumKva.toFixed(2)}<span className="text-[12px] text-gray-400 ml-1">kVA</span></div>
                    </div>
                    <div className="bg-gray-900/30 p-4 min-h-[100px]">
                        <div className="text-gray-300 text-[10px] uppercase tracking-widest mb-1">Max Starting Time <span className="normal-case">(t<sub>m</sub>)</span></div>
                        <div className="text-2xl font-bold text-blue-400">{summaryStats.maxTm}<span className="text-[12px] text-gray-400 ml-1">sec</span></div>
                    </div>
                    <div className="bg-gray-900/30 p-4 min-h-[100px]">
                        <div className="text-gray-300 text-[10px] uppercase tracking-widest mb-1">Max Starting Factor <span className="normal-case">(β)</span></div>
                        <div className="text-2xl font-bold text-blue-400">
                            {summaryStats.maxBetaMethod || '-'}
                            <span className="text-[12px] text-gray-400 ml-1">({summaryStats.maxDelta > 0 ? summaryStats.maxDelta.toFixed(1) : '-'})</span>
                        </div>
                    </div>
                    <div className="bg-gray-900/30 p-4 min-h-[100px]">
                        <div className="text-gray-300 text-[10px] uppercase tracking-widest mb-1">Demand Factor</div>
                        <div className="text-2xl font-bold text-yellow-400 flex items-baseline">
                            <SummaryInput
                                value={projectInfo.demandFactor ?? 100}
                                onSave={(val) => {
                                    const num = parseInt(val, 10);
                                    updateProjectInfo('demandFactor', isNaN(num) ? 0 : Math.min(999, num));
                                }}
                                className="bg-transparent border-none text-yellow-400 font-bold text-2xl outline-none text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none p-0"
                            />
                            <span className="text-[12px] text-gray-400 ml-1">%</span>
                        </div>
                        <div className="text-[14px] font-bold text-blue-400 mt-1 flex items-baseline gap-3 flex-wrap">
                            <span>
                                {((totalLoad / 1000) * (projectInfo.demandFactor / 100)).toFixed(2)}
                                <span className="text-[12px] text-gray-400 ml-0.5 font-bold">kVA</span>
                            </span>
                            <span>
                                {(totalCurrentCalc * (projectInfo.demandFactor / 100)).toFixed(1)}
                                <span className="text-[12px] text-gray-400 ml-0.5 font-bold">A</span>
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PowerLoadSummary;

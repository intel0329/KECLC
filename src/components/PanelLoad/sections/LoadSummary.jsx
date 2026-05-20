import React, { useState, useEffect, useRef, memo } from 'react';
import { Download, FileCode, CheckCircle, Plus } from 'lucide-react';
import { CornerBorders } from '../ui/PanelLoadUI';
import CadExportButton from '../../../utils/cad/CadExportButton';

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

export const LoadSummary = (props) => {
    const {
        projectInfo,
        totalLoad,
        kecSettings,
        calculateKECJudgment,
        setPanelHighlightSection,
        setIsPanelKECDrawerOpen,
        hasDecideWarning,
        exportToExcel,
        updateProjectInfo,
        BREAKER_TYPES,
        phaseLoad,
        phaseTotals,
        leftCircuits,
        rightCircuits,
        calculatedPanelSize,
        setProjectInfo,
        getNameById,
        panelId,
        projectId
    } = props;

    // 수용률(Demand Factor)에 다른 이중 계산 방지용 원시 부하(Raw Total Load) 및 원시 상 부하(Raw Phase Load) 연산
    // 만약 phaseTotals에 raw 변수가 전달되면 그것을 최우선 SSOT로 사용하고, 없으면 기존 역산 방식을 fallback으로 둡니다.
    const rawTotalLoad = phaseTotals.rawL1 !== undefined 
        ? (phaseTotals.rawL1 + phaseTotals.rawL2 + phaseTotals.rawL3) 
        : (totalLoad / (((Number(projectInfo.demandFactor) || 100)) / 100));
    const rawTotalCurrent = rawTotalLoad / (projectInfo.phase.includes('3Ø') ? (380 * Math.sqrt(3)) : 220);
    const rawPhaseLoad = phaseTotals.rawMaxPhaseLoad !== undefined 
        ? phaseTotals.rawMaxPhaseLoad 
        : (phaseLoad / (((Number(projectInfo.demandFactor) || 100)) / 100));
    const rawMaxCurrent = phaseTotals.rawMaxCurrent !== undefined 
        ? phaseTotals.rawMaxCurrent 
        : (phaseTotals.maxCurrent / (((Number(projectInfo.demandFactor) || 100)) / 100));

    return (
        <div className="grid grid-cols-12 gap-4 mb-4">
            <div className="col-span-12 border border-gray-900 bg-black p-4 relative">
                <CornerBorders />
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[12px] font-semibold text-gray-400 uppercase tracking-[0.2em]">Load Summary</h3>
                    <div className="flex gap-2" data-html2canvas-ignore="true">
                        <button
                            onClick={() => {
                                // Find first fail/warning
                                const getP = (ph) => {
                                    if (ph?.includes('1Ø')) return 2;
                                    if (ph?.includes('3Ø-3W')) return 3;
                                    return 4;
                                };
                                const p = getP(projectInfo.phase);
                                const ib = p === 2 ? totalLoad / 220 : totalLoad / (380 * Math.sqrt(3));
                                const panelCircuit = {
                                    ib,
                                    at: projectInfo.mccbAT || 0,
                                    af: projectInfo.mccbAF || 0,
                                    type: projectInfo.mainBreakerType || 'MCCB',
                                    size: projectInfo.cableSize || 0,
                                    wire: projectInfo.wire || 'FCV',
                                    method: projectInfo.kecMethod || 'E',
                                    p,
                                    cableDistance: projectInfo.branchDistance || 15,
                                    scb: projectInfo.shortCircuitCurrent || 0,
                                    isGeneral: true,
                                };
                                const judgment = calculateKECJudgment(panelCircuit, kecSettings, projectInfo);

                                const isFail = (status) => status === 'Fail' || status === 'Error' || status === 'Chk';
                                let firstFail = null;
                                if (isFail(judgment.at_b?.status)) firstFail = 'at_b';
                                else if (isFail(judgment.at_th?.status)) firstFail = 'at_th';
                                else if (isFail(judgment.at_sc?.status)) firstFail = 'at_sc';
                                else if (isFail(judgment.sb?.status)) firstFail = 'sb';
                                else if (isFail(judgment.scb?.status)) firstFail = 'scb';
                                else if (isFail(judgment.se?.status)) firstFail = 'se';
                                else if (isFail(judgment.ssc?.status)) firstFail = 'ssc';

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
                        <CadExportButton 
                            projectInfo={{
                                ...projectInfo,
                                sourceName: getNameById(projectInfo.fromId) || projectInfo.sourceName || ''
                            }}
                            leftCircuits={leftCircuits}
                            rightCircuits={rightCircuits}
                            panelId={panelId}
                            projectId={projectId}
                        />
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
                                    const newLevel = props.PHASE_LEVELS[newPhase];

                                    if (newLevel < props.maxLoadLevel) {
                                        props.showToast("하위 부하를 수용할 수 없는 상 설정", "error");
                                    }

                                    let newVoltage = projectInfo.voltage;
                                    if (newPhase === '1Ø-2W') newVoltage = '220V';
                                    else if (newPhase === '3Ø-3W') newVoltage = '380V';
                                    else if (newPhase === '3Ø-4W') newVoltage = '380V';
                                    setProjectInfo(prev => ({ ...prev, phase: newPhase, voltage: newVoltage }));
                                }}
                                className="bg-transparent border-none text-sm font-bold outline-none cursor-pointer appearance-none p-0 text-[#facc15]"
                            >
                                <option value="1Ø-2W" className="bg-black">1Ø-2W</option>
                                <option value="3Ø-3W" className="bg-black">3Ø-3W</option>
                                <option value="3Ø-4W" className="bg-black">3Ø-4W</option>
                            </select>
                            <select
                                value={projectInfo.mainBreakerType || 'MCCB'}
                                onChange={(e) => updateProjectInfo('mainBreakerType', e.target.value)}
                                className="bg-transparent border-none text-yellow-400 font-bold text-sm outline-none cursor-pointer appearance-none p-0"
                            >
                                {BREAKER_TYPES.map(type => (
                                    <option key={type} value={type} className="bg-black">{type}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="bg-gray-900/30 p-4 min-h-[100px]">
                        <div className="text-gray-300 text-[10px] uppercase tracking-widest mb-1">Total Load</div>
                        <div className="text-2xl font-bold text-blue-400">{Math.round(rawTotalLoad).toLocaleString()}<span className="text-[12px] text-gray-400 ml-1">VA</span></div>
                    </div>
                    <div className="bg-gray-900/30 p-4 min-h-[100px]">
                        <div className="text-gray-300 text-[10px] uppercase tracking-widest mb-1">Total Current</div>
                        <div className="text-2xl font-bold text-blue-400">
                            {Math.round(rawTotalCurrent).toLocaleString()}
                            <span className="text-[12px] text-gray-400 ml-1">A</span>
                        </div>
                    </div>
                    <div className="bg-gray-900/30 p-4 min-h-[100px]">
                        <div className="text-gray-300 text-[10px] uppercase tracking-widest mb-1">Max Phase Load</div>
                        <div className="text-2xl font-bold text-white">{Math.floor(rawPhaseLoad).toLocaleString()}<span className="text-[12px] text-gray-400 ml-1">VA</span></div>
                    </div>
                    <div className="bg-gray-900/30 p-4 min-h-[100px]">
                        <div className="text-gray-300 text-[10px] uppercase tracking-widest mb-1">Max Phase Current</div>
                        <div className="text-2xl font-bold text-white">{Math.round(rawMaxCurrent).toLocaleString()}<span className="text-[12px] text-gray-400 ml-1">A</span></div>
                        <div className="text-[10px] text-gray-400 mt-1">Based on 1-Phase</div>
                    </div>
                </div>

                <div className="border-t border-gray-900 my-4"></div>


                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    <div className="bg-gray-900/30 p-4 min-h-[100px]">
                        <div className="text-gray-300 text-[10px] uppercase tracking-widest mb-1">Circuits</div>
                        <div className="text-2xl font-bold text-green-400">{leftCircuits.length + rightCircuits.length}</div>
                    </div>
                    <div className="bg-gray-900/30 p-4 min-h-[100px]">
                        <div className="text-gray-300 text-[10px] uppercase tracking-widest mb-1">Max Distance</div>
                        <div className="text-2xl font-bold text-green-400">
                            {(() => {
                                const allCircuits = [...leftCircuits, ...rightCircuits];
                                if (allCircuits.length === 0) return 0;
                                const maxCircuit = allCircuits.reduce((max, curr) =>
                                    (Number(curr.cableDistance || curr.cableLength) || 0) > (Number(max.cableDistance || max.cableLength) || 0) ? curr : max
                                    , allCircuits[0]);
                                return Number(maxCircuit.cableDistance || maxCircuit.cableLength) || 0;
                            })()}
                            <span className="text-[12px] text-gray-400 ml-1">m</span>
                        </div>
                        <div className="text-[10px] text-gray-400 mt-1">
                            {(() => {
                                const allCircuits = [...leftCircuits, ...rightCircuits];
                                if (allCircuits.length === 0) return '-';
                                const maxCircuit = allCircuits.reduce((max, curr) =>
                                    (Number(curr.cableDistance || curr.cableLength) || 0) > (Number(max.cableDistance || max.cableLength) || 0) ? curr : max
                                    , allCircuits[0]);
                                return maxCircuit.loadName || `Circuit ${maxCircuit.id}`;
                            })()}
                        </div>
                    </div>
                    <div className="bg-gray-900/30 p-4 min-h-[100px]">
                        <div className="text-gray-300 text-[10px] uppercase tracking-widest mb-1">Voltage Drop</div>
                        <div className="text-2xl font-bold text-blue-400">
                            {(Number(projectInfo.voltageDropLimit) || 3).toFixed(1)}
                            <span className="text-[12px] text-gray-400 ml-1">%</span>
                        </div>
                        <div className="text-[10px] text-gray-400 mt-1">
                            Limit: {(Number(projectInfo.voltageDropLimit) || 3).toFixed(1)}%
                        </div>
                    </div>
                    <div className="bg-gray-900/30 p-4 min-h-[100px]">
                        <div className="text-gray-300 text-[10px] uppercase tracking-widest mb-1">Demand Factor</div>
                        <div className="text-2xl font-bold text-yellow-400 flex items-baseline">
                            <span className="bg-transparent border-none text-yellow-400 font-bold text-2xl outline-none text-right">
                                {projectInfo.demandFactor ?? 100}
                            </span>
                            <span className="text-[12px] text-gray-400 ml-1">%</span>
                        </div>
                        <div className="text-[14px] font-bold text-blue-400 mt-1 flex items-baseline gap-3 flex-wrap">
                            <span>
                                {((rawTotalLoad * (Number(projectInfo.demandFactor ?? 100) / 100)) / 1000).toFixed(2)}
                                <span className="text-[12px] text-gray-400 ml-0.5 font-normal">kVA</span>
                            </span>
                            <span>
                                {((rawTotalLoad * (Number(projectInfo.demandFactor ?? 100) / 100)) / (projectInfo.phase.includes('3Ø') ? (380 * Math.sqrt(3)) : 220)).toFixed(2)}
                                <span className="text-[12px] text-gray-400 ml-0.5 font-normal">A</span>
                            </span>
                        </div>
                    </div>
                    <div className="bg-gray-900/30 p-4 min-h-[100px]">
                        <div className="text-gray-300 text-[10px] uppercase tracking-widest mb-1">Est. Panel Size</div>
                        <div className="text-2xl font-bold text-white">
                            {calculatedPanelSize.width}<span className="text-[12px] text-gray-400 mx-1">x</span>{calculatedPanelSize.height}
                        </div>
                        <div className="text-[10px] text-gray-400 mt-1 flex items-center justify-between">
                            <span>W x H (mm)</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                            {calculatedPanelSize.auxiliaryDevices?.map(device => (
                                <div key={device} className="bg-blue-500/10 border border-blue-500/30 px-1.5 py-0.5 rounded text-[9px] text-blue-400 font-bold flex items-center gap-1 uppercase tracking-tight">
                                    <div className="w-1 h-1 bg-blue-500 rounded-full animate-pulse" />
                                    {device}
                                </div>
                            ))}
                            {(!calculatedPanelSize.auxiliaryDevices || calculatedPanelSize.auxiliaryDevices.length === 0) && (
                                <div className="text-[9px] text-gray-600 italic">No aux. devices</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

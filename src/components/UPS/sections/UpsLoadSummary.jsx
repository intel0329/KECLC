import React from 'react';
import { Download, CheckCircle, Plus } from 'lucide-react';
import { getUpsUnitSize, getBatteryCabinetSize } from '../../../utils/upsData';

import { CornerBorders } from '../ui/UpsUI';

const UpsLoadSummary = (props) => {
    const {
        projectInfo = { phase: '3Ø-4W', mccbAF: '', mccbAT: '', mainBreakerType: 'MCCB', voltage: '380V', demandFactor: 100 },
        totalLoad = 0,
        demandFactorSummary = { avgPercent: 100, totalKva: 0, totalKw: 0 },
        kecSettings = {},
        calculateKECJudgment = () => ({}),
        setPanelHighlightSection = () => { },
        setIsPanelKECDrawerOpen = () => { },
        hasDecideWarning = false,
        exportToExcel = () => { },
        updateProjectInfo = () => { },
        BREAKER_TYPES = ['MCCB', 'ELB', 'ACB', 'VCB'],
        phaseLoad = 0,
        phaseTotals = { maxCurrent: 0 },
        leftCircuits = [],
        rightCircuits = [],
        calculatedPanelSize = { width: 0, height: 0, auxiliaryDevices: [] },
        setProjectInfo = () => { }
    } = props;

    return (
        <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12 border border-gray-900 bg-black p-4 relative">
                <CornerBorders />
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[12px] font-normal text-[#d1d5db] uppercase tracking-[0.2em]">Load Summary</h3>
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
                                const ib = p === 2 ? (totalLoad * 1000) / 220 : (totalLoad * 1000) / (380 * Math.sqrt(3));
                                const panelCircuit = {
                                    ib,
                                    at: projectInfo.mccbAT || 0,
                                    af: projectInfo.mccbAF || 0,
                                    type: projectInfo.mainBreakerType || 'MCCB',
                                    size: projectInfo.cableSize || 0,
                                    wire: projectInfo.wire || 'FCV',
                                    method: projectInfo.kecMethod || 'E',
                                    p,
                                    cableDistance: projectInfo.branchDistance || 1.5,
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
                            className="w-10 md:w-[100px] aspect-square md:aspect-auto md:px-3 md:py-2 bg-yellow-600 hover:bg-yellow-500 text-white text-[10px] font-normal uppercase tracking-widest transition-all flex items-center justify-center md:gap-2 border border-yellow-400/50 relative"
                        >
                            <CheckCircle size={14} /> <span className="hidden md:inline">Decide</span>
                            {hasDecideWarning && (
                                <div className="absolute -top-3 -right-2 flex flex-col items-center animate-bounce z-10 pointer-events-none drop-shadow-md">
                                    <div className="bg-red-500/85 backdrop-blur-sm text-white text-[9px] font-normal px-1.5 py-0.5 rounded whitespace-nowrap border border-white/20 relative">
                                        Chk
                                        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-t-[8px] border-t-red-500/85"></div>
                                    </div>
                                </div>
                            )}
                        </button>
                        <button
                            onClick={exportToExcel}
                            title="Excel"
                            className="w-10 md:w-[100px] aspect-square md:aspect-auto md:px-3 md:py-2 bg-green-700 hover:bg-green-600 text-white text-[10px] font-normal uppercase tracking-widest transition-all flex items-center justify-center md:gap-2 border border-green-500/50"
                        >
                            <Download size={14} /> <span className="hidden md:inline">Excel</span>
                        </button>
                    </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    <div className="bg-gray-900/30 p-4 min-h-[100px]">
                        <div className={`text-[10px] uppercase tracking-widest mb-1 transition-colors duration-300 ${hasDecideWarning ? 'text-red-500 font-bold' : 'text-gray-300'}`}>Main Breaker</div>
                        <div className="text-2xl font-normal text-yellow-400 flex items-baseline flex-wrap">
                            <span className="flex items-baseline">
                                <input
                                    type="number"
                                    value={projectInfo.mccbAF}
                                    onChange={(e) => updateProjectInfo('mccbAF', e.target.value)}
                                    className="bg-transparent border-none text-yellow-400 font-normal text-2xl outline-none text-left [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none p-0"
                                    style={{ width: `${String(projectInfo.mccbAF || '').length || 1}ch` }}
                                />
                                <span className="text-[12px] text-gray-400 ml-1">AF</span>
                            </span>
                            <span className="flex items-baseline ml-4">
                                <input
                                    type="number"
                                    value={projectInfo.mccbAT}
                                    onChange={(e) => updateProjectInfo('mccbAT', e.target.value)}
                                    className="bg-transparent border-none text-yellow-400 font-normal text-2xl outline-none text-left [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none p-0"
                                    style={{ width: `${String(projectInfo.mccbAT || '').length || 1}ch` }}
                                />
                                <span className="text-[12px] text-gray-400 ml-1">AT</span>
                            </span>
                        </div>
                        <div className="flex items-baseline gap-2 mt-1">
                            <select
                                value={projectInfo.phase || '3Ø-4W'}
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
                                className="bg-transparent border-none text-sm font-normal outline-none cursor-pointer appearance-none p-0 text-[#facc15]"
                            >
                                <option value="1Ø-2W" className="bg-black">1Ø-2W</option>
                                <option value="3Ø-3W" className="bg-black">3Ø-3W</option>
                                <option value="3Ø-4W" className="bg-black">3Ø-4W</option>
                            </select>
                            <select
                                value={projectInfo.mainBreakerType || 'MCCB'}
                                onChange={(e) => updateProjectInfo('mainBreakerType', e.target.value)}
                                className="bg-transparent border-none text-yellow-400 font-normal text-sm outline-none cursor-pointer appearance-none p-0"
                            >
                                {BREAKER_TYPES.map(type => (
                                    <option key={type} value={type} className="bg-black">{type}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    {/* Row 1 - Item 2: UPS Capacity (Renamed & Moved) */}
                    <div className="bg-gray-900/30 p-4 min-h-[100px]">
                        <div className="text-gray-300 text-[10px] uppercase tracking-widest mb-1">UPS Capacity</div>
                        <div className="text-2xl font-normal text-yellow-400 flex items-baseline">
                            <span className="flex items-baseline">
                                <input
                                    type="number"
                                    value={projectInfo.mainCapacity}
                                    onChange={(e) => updateProjectInfo('mainCapacity', e.target.value)}
                                    className="bg-transparent border-none text-yellow-400 font-normal text-2xl outline-none text-left [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none p-0"
                                    style={{ width: `${Math.max(1, String(projectInfo.mainCapacity || 0).length)}ch` }}
                                />
                                <span className="text-[12px] text-gray-400 ml-1">kVA</span>
                            </span>
                        </div>
                        <div className="flex items-baseline gap-2 mt-1">
                            <div className="text-sm font-normal text-[#d1d5db]">
                                {(() => {
                                    const ph = projectInfo.phase || '3Ø-4W';
                                    if (ph === '1Ø-2W') return '1Ø-2W 220V';
                                    if (ph === '3Ø-3W') return '3Ø-3W 380V';
                                    if (ph === '3Ø-4W') return '3Ø-4W 380/220V';
                                    return `${ph} ${projectInfo.voltage || ''}`;
                                })()}
                            </div>
                        </div>
                    </div>

                    {/* Row 1 - Item 3: Total Load */}
                    <div className="bg-gray-900/30 p-4 min-h-[100px]">
                        <div className="text-gray-300 text-[10px] uppercase tracking-widest mb-1">Total Load</div>
                        <div className="text-2xl font-normal text-blue-400">{totalLoad.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<span className="text-[12px] text-gray-400 ml-1">kVA</span></div>
                        <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2 mt-2 text-[10px] text-zinc-500">
                            <span>L1: <span className="text-zinc-300 font-medium">{(phaseTotals?.l1 || 0).toFixed(1)}</span> <span className="text-blue-400/80">({(phaseTotals?.i1 || 0).toFixed(1)}A)</span></span>
                            <span className="text-zinc-700 hidden md:inline">|</span>
                            <span>L2: <span className="text-zinc-300 font-medium">{(phaseTotals?.l2 || 0).toFixed(1)}</span> <span className="text-blue-400/80">({(phaseTotals?.i2 || 0).toFixed(1)}A)</span></span>
                            <span className="text-zinc-700 hidden md:inline">|</span>
                            <span>L3: <span className="text-zinc-300 font-medium">{(phaseTotals?.l3 || 0).toFixed(1)}</span> <span className="text-blue-400/80">({(phaseTotals?.i3 || 0).toFixed(1)}A)</span></span>
                        </div>
                    </div>

                    {/* Row 1 - Item 4: Total Current */}
                    <div className="bg-gray-900/30 p-4 min-h-[100px]">
                        <div className="text-gray-300 text-[10px] uppercase tracking-widest mb-1">Total Current</div>
                        <div className="text-2xl font-normal text-blue-400">
                            {(() => {
                                const v = parseInt(projectInfo.voltage) || 380;
                                const is3P = (projectInfo.phase || '').includes('3Ø');
                                const current = is3P ? (totalLoad * 1000) / (v * Math.sqrt(3)) : (totalLoad * 1000) / v;
                                return isNaN(current) ? '0.0' : current.toFixed(1);
                            })()}
                            <span className="text-[12px] text-gray-400 ml-1">A</span>
                        </div>
                        <div className="text-[10px] text-gray-500 mt-1">Based on Connected Load</div>
                    </div>

                    {/* Row 1 - Item 5: Demand Factor (Moved from Row 2) */}
                    <div className="bg-gray-900/30 p-4 min-h-[100px]">
                        <div className="text-gray-300 text-[10px] uppercase tracking-widest mb-1">Demand Factor</div>
                        <div className={`text-2xl font-normal flex items-baseline ${Math.round(demandFactorSummary?.avgPercent || 100) === 100 ? 'text-[#d1d5db]' : 'text-green-400'}`}>
                            <span>{Math.round(demandFactorSummary?.avgPercent || 100)}</span>
                            <span className="text-[12px] text-gray-400 ml-1">%</span>
                        </div>
                        <div className="text-[14px] font-normal text-blue-400 mt-1 flex items-baseline gap-3 flex-wrap">
                            <span title="Demand Load Sum">
                                {(demandFactorSummary?.totalKva || 0).toFixed(2)}
                                <span className="text-[12px] text-gray-400 ml-0.5 font-normal">kVA</span>
                            </span>
                            <span title="Demand Current Sum">
                                {(() => {
                                    const v = parseInt(projectInfo.voltage) || 380;
                                    const is3P = (projectInfo.phase || '').includes('3Ø');
                                    const dKva = demandFactorSummary?.totalKva || 0;
                                    const current = is3P ? (dKva * 1000) / (v * Math.sqrt(3)) : (dKva * 1000) / v;
                                    return isNaN(current) ? '0.0' : current.toFixed(2);
                                })()}
                                <span className="text-[12px] text-gray-400 ml-0.5 font-normal">A</span>
                            </span>
                        </div>
                    </div>
                </div>

                <div className="border-t border-gray-900 my-4"></div>


                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {/* Row 2 - Item 1: UPS Max Demand Power (Renamed from Circuits) */}
                    <div className="bg-gray-900/30 p-4 min-h-[100px]">
                        <div className="text-gray-300 text-[11px] uppercase tracking-widest mb-1">UPS 최대 수요 전력</div>
                        <div className="text-2xl font-normal text-green-400">
                            {(() => {
                                const totalDemandKva = demandFactorSummary?.totalKva || 0;
                                const sparePercent = parseFloat(projectInfo.spareFactor ?? 20);
                                const alpha = 1 + (sparePercent / 100);
                                const efficiencyPercent = parseFloat(projectInfo.upsEfficiency ?? 90);
                                const eta = efficiencyPercent / 100;
                                const result = (totalDemandKva * alpha) / eta;
                                return isNaN(result) ? '0.0' : result.toFixed(1);
                            })()}
                            <span className="text-[12px] text-gray-400 ml-1 font-normal">kVA</span>
                        </div>
                        <div className="flex flex-col gap-0.5 mt-1">
                            <div className="flex items-baseline">
                                <span className="text-[13px] font-normal text-gray-400 mr-1">여유:</span>
                                <input
                                    type="number"
                                    value={projectInfo.spareFactor ?? 20}
                                    onChange={(e) => updateProjectInfo('spareFactor', e.target.value)}
                                    className="bg-transparent border-none text-yellow-400 text-sm font-normal outline-none text-left [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none p-0"
                                    style={{ width: `${String(projectInfo.spareFactor ?? 20).length}ch` }}
                                />
                                <span className="text-[11px] text-yellow-400">%</span>
                            </div>
                            <div className="flex items-baseline">
                                <span className="text-[13px] font-normal text-gray-400 mr-1">종합효율:</span>
                                <input
                                    type="number"
                                    value={projectInfo.upsEfficiency ?? 90}
                                    onChange={(e) => updateProjectInfo('upsEfficiency', e.target.value)}
                                    className="bg-transparent border-none text-yellow-400 text-sm font-normal outline-none text-left [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none p-0"
                                    style={{ width: `${String(projectInfo.upsEfficiency ?? 90).length}ch` }}
                                />
                                <span className="text-[11px] text-yellow-400">%</span>
                            </div>
                        </div>
                    </div>
                    {/* Row 2 - Item 2: Battery Cell Count (Changed from Max Distance) */}
                    <div className="bg-gray-900/30 p-4 min-h-[100px]">
                        <div className="text-gray-300 text-[11px] uppercase tracking-widest mb-1">축전지 Cell 수량</div>
                        <div className="text-2xl font-normal text-green-400">
                            {(() => {
                                const vdc = parseFloat(projectInfo.upsDcVoltage ?? 240);
                                const vb = parseFloat(projectInfo.batteryNominalVoltage ?? 2.0);
                                const count = vdc > 0 ? (vdc / vb).toFixed(0) : 0;
                                return count;
                            })()}
                            <span className="text-[12px] text-gray-400 ml-1">Cells</span>
                        </div>
                        <div className="flex flex-col gap-0.5 mt-1">
                            <div className="flex items-baseline">
                                <select
                                    value={Number(projectInfo.batteryNominalVoltage) || 2.0}
                                    onChange={(e) => {
                                        const val = parseFloat(e.target.value);
                                        const defaultSub = val === 1.2 ? 'AH' : 'IHS';
                                        
                                        // Update multiple fields at once to prevent state override
                                        setProjectInfo(prev => ({
                                            ...prev,
                                            batteryNominalVoltage: val,
                                            upsBatteryType: defaultSub
                                        }));
                                    }}
                                    className="bg-transparent border-none text-yellow-400 font-normal text-[12px] outline-none cursor-pointer appearance-none p-0"
                                >
                                    <option value={2.0} className="bg-black">연축전지 (2V)</option>
                                    <option value={1.2} className="bg-black">알칼리 (1.2V)</option>
                                </select>
                            </div>
                            <div className="flex items-baseline">
                                <span className="text-[12px] font-normal text-gray-400 mr-1">배터리형식:</span>
                                <select
                                    value={projectInfo.upsBatteryType || (Number(projectInfo.batteryNominalVoltage) === 1.2 ? 'AH' : 'IHS')}
                                    onChange={(e) => updateProjectInfo('upsBatteryType', e.target.value)}
                                    className="bg-transparent border-none text-yellow-400 font-normal text-[12px] outline-none cursor-pointer appearance-none p-0"
                                >
                                    {projectInfo.batteryNominalVoltage == 1.2 ? (
                                        <>
                                            <option value="AHH" className="bg-black">AHH</option>
                                            <option value="AH" className="bg-black">AH</option>
                                            <option value="AMH" className="bg-black">AMH</option>
                                            <option value="AM" className="bg-black">AM</option>
                                        </>
                                    ) : (
                                        <>
                                            <option value="IHS" className="bg-black">IHS</option>
                                            <option value="CS" className="bg-black">CS</option>
                                        </>
                                    )}
                                </select>
                            </div>
                            <div className="flex items-baseline">
                                <span className="text-[12px] font-normal text-gray-400 mr-1">직류정격전압:</span>
                                <input
                                    type="number"
                                    value={projectInfo.upsDcVoltage ?? 240}
                                    onChange={(e) => updateProjectInfo('upsDcVoltage', e.target.value)}
                                    placeholder="240"
                                    className="bg-transparent border-none text-yellow-400 text-sm font-normal outline-none text-left [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none p-0"
                                    style={{ width: `${String(projectInfo.upsDcVoltage ?? 240).length}ch` }}
                                />
                                <span className="text-[11px] text-yellow-400">V</span>
                            </div>
                        </div>
                    </div>
                    {/* Row 2 - Item 3: 방전 종지전압 (Moved from Item 5) */}
                    <div className="bg-gray-900/30 p-4 min-h-[100px]">
                        <div className="text-gray-300 text-[11px] uppercase tracking-widest mb-1">방전 종지전압</div>
                        <div className="text-2xl font-normal text-green-400">
                            {(() => {
                                const vdc = parseFloat(projectInfo.upsDcVoltage ?? 240);
                                const vb = parseFloat(projectInfo.batteryNominalVoltage ?? 2.0);
                                const cellCount = vdc > 0 ? Math.round(vdc / vb) : 0;
                                const blockCount = cellCount / 6;
                                const minDcVoltage = parseFloat(projectInfo.upsEndVoltage ?? 210);
                                
                                if (blockCount === 0) return '0.00';
                                const result = minDcVoltage / blockCount;
                                return isNaN(result) ? '0.00' : result.toFixed(2);
                            })()}
                            <span className="text-[12px] text-gray-400 ml-1 font-normal">V/Cell</span>
                        </div>
                        <div className="flex flex-col gap-0.5 mt-1">
                            <div className="flex items-baseline">
                                <span className="text-[13px] font-normal text-gray-400 mr-1">Block:</span>
                                <span className="text-sm font-normal text-blue-400">
                                    {(() => {
                                        const vdc = parseFloat(projectInfo.upsDcVoltage ?? 240);
                                        const vb = parseFloat(projectInfo.batteryNominalVoltage ?? 2.0);
                                        const cellCount = vdc > 0 ? Math.round(vdc / vb) : 0;
                                        return (cellCount / 6).toFixed(0);
                                    })()}
                                </span>
                                <span className="text-[11px] text-blue-400">Cells</span>
                            </div>
                            <div className="flex items-baseline">
                                <span className="text-[13px] font-normal text-gray-400 mr-1">직류최저전압:</span>
                                <input
                                    type="number"
                                    value={projectInfo.upsEndVoltage ?? 210}
                                    onChange={(e) => updateProjectInfo('upsEndVoltage', e.target.value)}
                                    className="bg-transparent border-none text-yellow-400 text-sm font-normal outline-none text-left [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none p-0"
                                    style={{ width: `${String(projectInfo.upsEndVoltage ?? 210).length}ch` }}
                                />
                                <span className="text-[11px] text-yellow-400">V</span>
                            </div>
                        </div>
                    </div>

                    {/* Row 2 - Item 4: UPS 방전전류 */}
                    <div className="bg-gray-900/30 p-4 min-h-[100px]">
                        <div className="text-gray-300 text-[11px] uppercase tracking-widest mb-1">UPS 방전전류</div>
                        <div className="text-2xl font-normal text-green-400">
                            {(() => {
                                const cap = parseFloat(projectInfo.mainCapacity ?? 0) || 0;
                                const pf = parseFloat(projectInfo.upsLoadPF ?? 0.8);
                                const eff = (parseFloat(projectInfo.upsInverterEff ?? 92.5)) / 100;
                                
                                // 방전 종지전압 및 Block 계산 (동일 로직 참조)
                                const vdc = parseFloat(projectInfo.upsDcVoltage ?? 240);
                                const vb = parseFloat(projectInfo.batteryNominalVoltage ?? 2.0);
                                const cellCount = vdc > 0 ? Math.round(vdc / vb) : 0;
                                const blockCount = cellCount / 6;
                                const minDcVoltage = parseFloat(projectInfo.upsEndVoltage ?? 210);
                                const dischargeEndVoltagePerBlock = blockCount > 0 ? minDcVoltage / blockCount : 0;

                                if (dischargeEndVoltagePerBlock === 0 || blockCount === 0 || eff === 0) return '0.0';
                                
                                // 공식: (Cap * 1000 * PF) / (방전종지전압 * Block * 효율)
                                const result = (cap * 1000 * pf) / (dischargeEndVoltagePerBlock * blockCount * eff);
                                return isNaN(result) ? '0.0' : result.toFixed(1);
                            })()}
                            <span className="text-[12px] text-gray-400 ml-1 font-normal">A</span>
                        </div>
                        <div className="flex flex-col gap-0.5 mt-1">
                            <div className="flex items-baseline">
                                <span className="text-[13px] font-normal text-gray-400 mr-1">부하역률:</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={projectInfo.upsLoadPF ?? 0.8}
                                    onChange={(e) => updateProjectInfo('upsLoadPF', e.target.value)}
                                    className="bg-transparent border-none text-yellow-400 text-sm font-normal outline-none text-left [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none p-0"
                                    style={{ width: `${String(projectInfo.upsLoadPF ?? 0.8).length}ch` }}
                                />
                            </div>
                            <div className="flex items-baseline">
                                <span className="text-[13px] font-normal text-gray-400 mr-1">인버터효율:</span>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={projectInfo.upsInverterEff ?? 92.5}
                                    onChange={(e) => updateProjectInfo('upsInverterEff', e.target.value)}
                                    className="bg-transparent border-none text-yellow-400 text-sm font-normal outline-none text-left [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none p-0"
                                    style={{ width: `${String(projectInfo.upsInverterEff ?? 92.5).length}ch` }}
                                />
                                <span className="text-[11px] text-yellow-400">%</span>
                            </div>
                        </div>
                    </div>

                    {/* Row 2 - Item 5: Est. UPS Units Size (Changed from Voltage Drop) */}
                    <div className="bg-gray-900/30 p-4 min-h-[100px]">
                        <div className="text-gray-300 text-[10px] uppercase tracking-widest mb-1">UPS Units Size</div>
                        <div className="text-xl font-normal text-[#d1d5db] mt-2">
                            {getUpsUnitSize(projectInfo.mainCapacity)}
                        </div>
                        <div className="text-[10px] text-gray-400 mt-1">
                            (W×D×H)
                        </div>
                    </div>
                </div>

                <div className="border-t border-gray-900 my-4"></div>

                {/* Row 3 - New Content */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {/* Row 3 - Item 1: 정전 보상 시간 */}
                    <div className="bg-gray-900/30 p-4 min-h-[100px]">
                        <div className="text-gray-300 text-[11px] uppercase tracking-widest mb-1">정전 보상 시간</div>
                        <div className="text-2xl font-normal text-yellow-400 flex items-baseline">
                            <select
                                value={projectInfo.upsBackupTime ?? 60}
                                onChange={(e) => updateProjectInfo('upsBackupTime', e.target.value)}
                                className="bg-transparent border-none text-yellow-400 font-normal text-2xl outline-none cursor-pointer appearance-none p-0"
                                style={{ width: `${String(projectInfo.upsBackupTime ?? 60).length}ch` }}
                            >
                                <option value={10} className="bg-black">10</option>
                                <option value={20} className="bg-black">20</option>
                                <option value={30} className="bg-black">30</option>
                                <option value={60} className="bg-black">60</option>
                                <option value={120} className="bg-black">120</option>
                            </select>
                            <span className="text-[12px] text-yellow-400 font-normal ml-1">분</span>
                        </div>
                        <div className="text-[10px] text-gray-400 mt-1">
                            Backup Time (min)
                        </div>
                    </div>

                    {/* Row 3 - Item 2: 용량환산 시간계수 K */}
                    <div className="bg-gray-900/30 p-4 min-h-[100px]">
                        <div className="text-gray-300 text-[11px] uppercase tracking-widest mb-1">용량환산 시간계수 K</div>
                        <div className="text-2xl font-normal text-green-400">
                            {(() => {
                                const kData = [
                                    { type: "AHH", minV: 1.10, values: [0.25, 0.28, 0.35, 0.44, 0.57, 0.70, 1.15, 0] },
                                    { type: "AHH", minV: 1.06, values: [0.19, 0.21, 0.28, 0.35, 0.50, 0.65, 1.08, 0] },
                                    { type: "AHH", minV: 1.00, values: [0.14, 0.16, 0.22, 0.30, 0.45, 0.60, 1.04, 0] },
                                    { type: "AH", minV: 1.10, values: [0.30, 0.46, 0.56, 0.66, 0.87, 1.04, 1.56, 2.60] },
                                    { type: "AH", minV: 1.06, values: [0.24, 0.33, 0.45, 0.53, 0.70, 0.85, 1.40, 2.45] },
                                    { type: "AH", minV: 1.00, values: [0.20, 0.27, 0.37, 0.45, 0.60, 0.77, 1.30, 2.30] },
                                    { type: "AMH", minV: 1.10, values: [0.67, 0.84, 1.00, 1.10, 1.23, 1.37, 1.90, 3.00] },
                                    { type: "AMH", minV: 1.06, values: [0.57, 0.71, 0.85, 0.93, 1.11, 1.15, 1.65, 2.70] },
                                    { type: "AMH", minV: 1.00, values: [0.46, 0.58, 0.69, 0.75, 0.84, 0.96, 1.40, 2.40] },
                                    { type: "AM", minV: 1.10, values: [0.97, 1.23, 1.52, 1.70, 1.92, 2.10, 2.75, 3.80] },
                                    { type: "AM", minV: 1.06, values: [0.75, 0.92, 1.15, 1.28, 1.50, 1.65, 2.23, 3.30] },
                                    { type: "AM", minV: 1.00, values: [0.63, 0.76, 0.95, 1.05, 1.26, 1.43, 1.90, 2.90] },
                                    { type: "CS", minV: 1.80, values: [0, 1.50, 1.60, 1.75, 2.05, 2.40, 3.10, 4.40] },
                                    { type: "CS", minV: 1.70, values: [0, 0.75, 0.92, 1.25, 1.50, 1.85, 2.60, 3.95] },
                                    { type: "CS", minV: 1.60, values: [0, 0.63, 0.75, 1.05, 1.44, 1.70, 2.40, 3.70] },
                                    { type: "IHS", minV: 1.80, values: [0.85, 0.88, 0.95, 1.05, 1.30, 1.55, 2.20, 3.40] },
                                    { type: "IHS", minV: 1.70, values: [0.56, 0.58, 0.65, 0.75, 1.00, 1.24, 1.90, 3.05] },
                                    { type: "IHS", minV: 1.60, values: [0.44, 0.47, 0.53, 0.63, 0.87, 1.10, 1.75, 2.90] },
                                ];

                                const vdc = parseFloat(projectInfo.upsDcVoltage ?? 240);
                                const vb = parseFloat(projectInfo.batteryNominalVoltage ?? 2.0);
                                const cellCount = Math.round(vdc / vb);
                                const blockCount = cellCount / 6;
                                const minDcVoltage = parseFloat(projectInfo.upsEndVoltage ?? 210);
                                const targetVpc = (minDcVoltage / blockCount) / 6;
                                const selectedType = projectInfo.upsBatteryType || (vb === 1.2 ? 'AH' : 'IHS');
                                const backupTime = parseInt(projectInfo.upsBackupTime ?? 60);
                                
                                const rowsForType = kData.filter(d => d.type === selectedType);
                                if (rowsForType.length === 0) return '0.00';
                                const sortedRows = [...rowsForType].sort((a, b) => a.minV - b.minV);
                                let matchedRow = sortedRows.find(r => r.minV >= targetVpc) || sortedRows[sortedRows.length - 1];
                                
                                const timeIndexMap = { 10: 3, 20: 4, 30: 5, 60: 6, 120: 7 };
                                const kValue = matchedRow.values[timeIndexMap[backupTime] || 6];
                                return kValue === 0 || kValue === "-" ? "0.00" : parseFloat(kValue).toFixed(2);
                            })()}
                        </div>
                        <div className="text-[10px] text-gray-400 mt-1">
                            K-Factor
                        </div>
                    </div>

                    {/* Row 3 - Item 3: 축전지 용량 */}
                    <div className="bg-gray-900/30 p-4 min-h-[100px]">
                        <div className="text-gray-300 text-[11px] uppercase tracking-widest mb-1">축전지 용량</div>
                        <div className="text-2xl font-normal text-green-500">
                            {(() => {
                                const kData = [
                                    { type: "AHH", minV: 1.10, values: [0.25, 0.28, 0.35, 0.44, 0.57, 0.70, 1.15, 0] },
                                    { type: "AHH", minV: 1.06, values: [0.19, 0.21, 0.28, 0.35, 0.50, 0.65, 1.08, 0] },
                                    { type: "AHH", minV: 1.00, values: [0.14, 0.16, 0.22, 0.30, 0.45, 0.60, 1.04, 0] },
                                    { type: "AH", minV: 1.10, values: [0.30, 0.46, 0.56, 0.66, 0.87, 1.04, 1.56, 2.60] },
                                    { type: "AH", minV: 1.06, values: [0.24, 0.33, 0.45, 0.53, 0.70, 0.85, 1.40, 2.45] },
                                    { type: "AH", minV: 1.00, values: [0.20, 0.27, 0.37, 0.45, 0.60, 0.77, 1.30, 2.30] },
                                    { type: "AMH", minV: 1.10, values: [0.67, 0.84, 1.00, 1.10, 1.23, 1.37, 1.90, 3.00] },
                                    { type: "AMH", minV: 1.06, values: [0.57, 0.71, 0.85, 0.93, 1.11, 1.15, 1.65, 2.70] },
                                    { type: "AMH", minV: 1.00, values: [0.46, 0.58, 0.69, 0.75, 0.84, 0.96, 1.40, 2.40] },
                                    { type: "AM", minV: 1.10, values: [0.97, 1.23, 1.52, 1.70, 1.92, 2.10, 2.75, 3.80] },
                                    { type: "AM", minV: 1.06, values: [0.75, 0.92, 1.15, 1.28, 1.50, 1.65, 2.23, 3.30] },
                                    { type: "AM", minV: 1.00, values: [0.63, 0.76, 0.95, 1.05, 1.26, 1.43, 1.90, 2.90] },
                                    { type: "CS", minV: 1.80, values: [0, 1.50, 1.60, 1.75, 2.05, 2.40, 3.10, 4.40] },
                                    { type: "CS", minV: 1.70, values: [0, 0.75, 0.92, 1.25, 1.50, 1.85, 2.60, 3.95] },
                                    { type: "CS", minV: 1.60, values: [0, 0.63, 0.75, 1.05, 1.44, 1.70, 2.40, 3.70] },
                                    { type: "IHS", minV: 1.80, values: [0.85, 0.88, 0.95, 1.05, 1.30, 1.55, 2.20, 3.40] },
                                    { type: "IHS", minV: 1.70, values: [0.56, 0.58, 0.65, 0.75, 1.00, 1.24, 1.90, 3.05] },
                                    { type: "IHS", minV: 1.60, values: [0.44, 0.47, 0.53, 0.63, 0.87, 1.10, 1.75, 2.90] },
                                ];

                                const vdc = parseFloat(projectInfo.upsDcVoltage ?? 240);
                                const vb = parseFloat(projectInfo.batteryNominalVoltage ?? 2.0);
                                const cellCount = Math.round(vdc / vb);
                                const blockCount = cellCount / 6;
                                const minDcVoltage = parseFloat(projectInfo.upsEndVoltage ?? 210);
                                const targetVpc = (minDcVoltage / blockCount) / 6;
                                const selectedType = projectInfo.upsBatteryType || (vb === 1.2 ? 'AH' : 'IHS');
                                const backupTime = parseInt(projectInfo.upsBackupTime ?? 60);
                                
                                const rowsForType = kData.filter(d => d.type === selectedType);
                                if (rowsForType.length === 0) return '0.00';
                                const sortedRows = [...rowsForType].sort((a, b) => a.minV - b.minV);
                                let matchedRow = sortedRows.find(r => r.minV >= targetVpc) || sortedRows[sortedRows.length - 1];
                                const kValue = matchedRow.values[{ 10: 3, 20: 4, 30: 5, 60: 6, 120: 7 }[backupTime] || 6];
                                
                                const upsCap = parseFloat(projectInfo.mainCapacity ?? 0) || 0;
                                const loadPF = parseFloat(projectInfo.upsLoadPF ?? 0.8);
                                const invEff = (parseFloat(projectInfo.upsInverterEff ?? 92.5)) / 100;
                                const dischargeCurrent = (upsCap * 1000 * loadPF) / (targetVpc * 6 * blockCount * invEff);
                                
                                const maintenanceFactor = parseFloat(projectInfo.upsMaintenanceFactor ?? 0.8);
                                const result = (1 / maintenanceFactor) * (kValue * dischargeCurrent);
                                return isNaN(result) ? '0.00' : result.toFixed(2);
                            })()}
                            <span className="text-[12px] text-gray-400 ml-1 font-normal">Ah</span>
                        </div>
                        <div className="flex flex-col gap-0.5 mt-1">
                            <div className="flex items-baseline">
                                <span className="text-[13px] font-normal text-gray-400 mr-1">보수율:</span>
                                <input
                                    type="number"
                                    step="0.05"
                                    value={projectInfo.upsMaintenanceFactor ?? 0.8}
                                    onChange={(e) => updateProjectInfo('upsMaintenanceFactor', e.target.value)}
                                    className="bg-transparent border-none text-yellow-400 text-sm font-normal outline-none text-left [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none p-0"
                                    style={{ width: `${String(projectInfo.upsMaintenanceFactor ?? 0.8).length}ch` }}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-900/30 p-4 min-h-[100px]">
                        <div className="text-gray-300 text-[11px] uppercase tracking-widest mb-1">축전지 TYPE</div>
                        <div className="flex flex-col gap-1 mt-2">
                            <div className="text-[15px] font-normal text-[#d1d5db]">무보수 밀폐형</div>
                            <div className="text-[15px] font-normal text-[#d1d5db]">무누액 연축전지</div>
                        </div>
                    </div>
                    <div className="bg-gray-900/30 p-4 min-h-[100px]">
                        <div className="text-gray-300 text-[10px] uppercase tracking-widest mb-1">Battery Cabinet Size</div>
                        <div className="text-xl font-normal text-[#d1d5db] mt-2">
                            {(() => {
                                const { size, qty } = getBatteryCabinetSize(projectInfo.mainCapacity);
                                if (qty === "-" || qty === "1") return size;
                                return `${size} (${qty}EA)`;
                            })()}
                        </div>
                        <div className="text-[10px] text-gray-500 mt-1">(W×D×H)</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UpsLoadSummary;

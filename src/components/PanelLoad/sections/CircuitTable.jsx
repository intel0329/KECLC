import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { CornerBorders, TableHeader, SelectCell, InputCell } from '../ui/PanelLoadUI';
import { normalizePhase, getStatusColor } from '../utils/mainHelpers';

export const CircuitTable = (props) => {
    const {
        getMaxRow,
        getCircuitForRow,
        isSelected,
        removeCircuit,
        addCircuitAtRow,
        updateCircuit,
        handleDragStart,
        handleDragOver,
        handleDragLeave,
        handleDrop,
        handleDragEnd,
        handleCircuitClick,
        handleContextMenu,
        openLoadModal,
        openJudgmentDrawer,
        results,
        panelsData,
        getAggregateTotals,
        projectInfo,
        selectedPhaseLine,
        updateProjectInfo,
        setProjectInfo,
        BREAKER_TYPES,
        isCableMethodValid,
        getMethodDisabledOptions,
        setParallelPopupCircuitId,
        setIsParallelPopupOpen,
        dragOriginRef,
        dropTarget,
        draggedCircuit,
        getNameById,
        totalLoad,
        imbalanceColor,
        phaseTotals
    } = props;

    return (
        <div className="border border-gray-900 bg-black relative overflow-hidden mb-8">
            <CornerBorders />
            <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="border-b border-gray-900">
                            <th colSpan={14} className="px-4 py-3 text-[12px] font-semibold text-gray-300 uppercase tracking-[0.2em] text-left border-l-2 border-blue-500/20">
                                Left Side Circuits
                            </th>
                            <th colSpan={7} className="bg-gray-900/20 px-4 py-3 text-[12px] font-bold text-gray-300 uppercase tracking-[0.2em] text-center">
                                Bus Bar / Load Info
                            </th>
                            <th colSpan={14} className="px-4 py-3 text-[12px] font-semibold text-gray-300 uppercase tracking-[0.2em] text-right border-r-2 border-blue-500/20">
                                Right Side Circuits
                            </th>
                        </tr>
                        <tr className="bg-black">
                            <th className="border-t border-r border-b border-gray-900 bg-black w-[40px] border-l-2 border-blue-500/20"></th>
                            <TableHeader label="CB" className="w-[70px] min-w-[70px] max-w-[70px] overflow-hidden" />
                            <TableHeader label="P" className="w-[40px]" />
                            <TableHeader label="AF" className="w-[50px]" />
                            <TableHeader className="w-[50px]">AT<sub>B</sub></TableHeader>
                            <TableHeader className="w-[45px]">AT<sub>TH</sub></TableHeader>
                            <TableHeader className="w-[45px]">AT<sub>SC</sub></TableHeader>
                            <TableHeader className="w-[45px]">S<sub>B</sub></TableHeader>
                            <TableHeader className="w-[45px]">S<sub>CB</sub></TableHeader>
                            <TableHeader className="w-[50px]">Se<sub>%</sub></TableHeader>
                            <TableHeader className="w-[45px]">S<sub>SC</sub></TableHeader>
                            <TableHeader label="공사" className="w-[50px]" />
                            <TableHeader label="WIRE" className="w-[60px]" />
                            <TableHeader label="㎟" className="w-[60px]" />

                            <TableHeader label="Load [VA]" className="min-w-[100px]" />
                            <TableHeader label="CIRCUIT" className="min-w-[120px]" />
                            <th
                                className={`border border-gray-900 min-w-[70px] px-2 py-2 text-[10px] font-bold uppercase tracking-widest ${projectInfo.phase === '1Ø-2W' ? 'cursor-pointer hover:bg-blue-500/20' : ''} ${projectInfo.phase === '1Ø-2W' && selectedPhaseLine === 'L1' ? 'bg-blue-500/30 text-blue-400' : 'text-gray-300'}`}
                                onClick={() => projectInfo.phase === '1Ø-2W' && updateProjectInfo('selectedPhaseLine', 'L1')}
                            >
                                L1
                            </th>
                            <th
                                className={`border border-gray-900 min-w-[70px] px-2 py-2 text-[10px] font-bold uppercase tracking-widest ${projectInfo.phase === '1Ø-2W' ? 'cursor-pointer hover:bg-blue-500/20' : ''} ${projectInfo.phase === '1Ø-2W' && selectedPhaseLine === 'L2' ? 'bg-blue-500/30 text-blue-400' : 'text-gray-300'}`}
                                onClick={() => projectInfo.phase === '1Ø-2W' && updateProjectInfo('selectedPhaseLine', 'L2')}
                            >
                                L2
                            </th>
                            <th
                                className={`border border-gray-900 min-w-[70px] px-2 py-2 text-[10px] font-bold uppercase tracking-widest ${projectInfo.phase === '1Ø-2W' ? 'cursor-pointer hover:bg-blue-500/20' : ''} ${projectInfo.phase === '1Ø-2W' && selectedPhaseLine === 'L3' ? 'bg-blue-500/30 text-blue-400' : 'text-gray-300'}`}
                                onClick={() => projectInfo.phase === '1Ø-2W' && updateProjectInfo('selectedPhaseLine', 'L3')}
                            >
                                L3
                            </th>
                            <TableHeader label="CIRCUIT" className="min-w-[120px]" />
                            <TableHeader label="Load [VA]" className="min-w-[100px]" />

                            <TableHeader label="CB" className="w-[70px] min-w-[70px] max-w-[70px] overflow-hidden" />
                            <TableHeader label="P" className="w-[40px]" />
                            <TableHeader label="AF" className="w-[50px]" />
                            <TableHeader className="w-[50px]">AT<sub>B</sub></TableHeader>
                            <TableHeader className="w-[45px]">AT<sub>TH</sub></TableHeader>
                            <TableHeader className="w-[45px]">AT<sub>SC</sub></TableHeader>
                            <TableHeader className="w-[45px]">S<sub>B</sub></TableHeader>
                            <TableHeader className="w-[45px]">S<sub>CB</sub></TableHeader>
                            <TableHeader className="w-[50px]">Se<sub>%</sub></TableHeader>
                            <TableHeader className="w-[45px]">S<sub>SC</sub></TableHeader>
                            <TableHeader label="공사" className="w-[50px]" />
                            <TableHeader label="WIRE" className="w-[60px]" />
                            <TableHeader label="㎟" className="w-[60px]" />
                            <th className="border-t border-l border-b border-gray-900 bg-black w-[40px] border-r-2 border-blue-500/20 text-[9px] text-gray-300 font-bold uppercase">DEL</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-900">
                        {Array.from({ length: getMaxRow() }, (_, i) => i + 1).map((row) => {
                            const leftRaw = getCircuitForRow('left', row);
                            const rightRaw = getCircuitForRow('right', row);
                            const hasData = !!(leftRaw || rightRaw);

                            // [Reactive Lookup] Resolve metadata for connected panels from SSOT
                            const getEffectiveCircuit = (c) => {
                                if (!c) return null;
                                const connId = c.connectedPanelId || c.loads?.find(l => l.category === 'PL')?.connectedPanelId;
                                if (!connId) return c;
                                
                                const childData = panelsData[connId];
                                if (!childData || !childData.projectInfo) return c;

                                const subRes = results[connId];
                                // [Reactive Power Lookup] 실시간 계산 결과를 우선 참조 (SSOT)
                                const effectivePower = subRes ? (subRes.totalLoad || 0) : (childData.projectInfo.cachedTotalLoad || c.power || 0);

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

                                return {
                                    ...c,
                                    connectedPanelId: connId,
                                    power: effectivePower,
                                    loads: effectiveLoads,
                                    type: childData.projectInfo.mainBreakerType || c.type || 'MCCB',
                                    at: childData.projectInfo.mccbAT || c.at || '',
                                    af: childData.projectInfo.mccbAF || c.af || '',
                                    p: (() => {
                                        const pStr = normalizePhase(childData.projectInfo.phase);
                                        if (pStr.includes('1Φ2W')) return '2';
                                        if (pStr.includes('3Φ3W')) return '3';
                                        if (pStr.includes('3Φ4W')) return '4';
                                        return c.p || '4';
                                    })(),
                                    method: childData.projectInfo.kecMethod || c.method || '',
                                    wire: childData.projectInfo.wire || c.wire || '',
                                    size: childData.projectInfo.cableSize || c.size || ''
                                };
                            };

                            const left = getEffectiveCircuit(leftRaw);
                            const right = getEffectiveCircuit(rightRaw);

                            // Calculate total load VA for this row using stored power to ensure consistency
                            const leftLoadTotal = Number(left?.power) || 0;
                            const rightLoadTotal = Number(right?.power) || 0;

                            // Calculate L1/L2/L3 based on phase type
                            let phaseL1 = 0, phaseL2 = 0, phaseL3 = 0;

                            const calculatePhaseContribution = (circuit, loadTotal) => {
                                const p = Number(circuit?.p) || 4;
                                const contrib = { l1: 0, l2: 0, l3: 0 };
                                
                                if (p === 2) {
                                    // [CONCENTRATION] 단상 회로(또는 단상 연결된 자식)는 지정된 상으로 모든 부하를 집약
                                    const pl = circuit.phaseLine || 'L1';
                                    let effectiveLoad = loadTotal;
                                    
                                    // 만약 자식이 단상인데 내부에 여러 회로가 있다면 그 합계를 가져옴
                                    if (circuit?.connectedPanelId) {
                                        const sub = getAggregateTotals(circuit.connectedPanelId);
                                        effectiveLoad = (sub.l1 || 0) + (sub.l2 || 0) + (sub.l3 || 0);
                                    }
                                    
                                    if (pl === 'L1') contrib.l1 = effectiveLoad;
                                    else if (pl === 'L2') contrib.l2 = effectiveLoad;
                                    else if (pl === 'L3') contrib.l3 = effectiveLoad;
                                } else if (circuit?.connectedPanelId) {
                                    // [DIRECT MAPPING] 3상 연결된 자식은 상별 분포를 그대로 흡수
                                    const sub = getAggregateTotals(circuit.connectedPanelId);
                                    contrib.l1 = Math.round(sub.l1);
                                    contrib.l2 = Math.round(sub.l2);
                                    contrib.l3 = Math.round(sub.l3);
                                } else {
                                    // Fallback: 일반 3상 부하는 1/3로 균등 배분
                                    const share = Math.round(loadTotal / 3);
                                    contrib.l1 = contrib.l2 = contrib.l3 = share;
                                }
                                return contrib;
                            };


                            if (normalizePhase(projectInfo.phase).includes('1Φ2W')) {
                                const rowLoadTotal = leftLoadTotal + rightLoadTotal;
                                if (selectedPhaseLine === 'L1') phaseL1 = rowLoadTotal;
                                else if (selectedPhaseLine === 'L2') phaseL2 = rowLoadTotal;
                                else if (selectedPhaseLine === 'L3') phaseL3 = rowLoadTotal;
                            } else {
                                const leftContrib = left ? calculatePhaseContribution(left, leftLoadTotal) : { l1: 0, l2: 0, l3: 0 };
                                const rightContrib = right ? calculatePhaseContribution(right, rightLoadTotal) : { l1: 0, l2: 0, l3: 0 };
                                phaseL1 = leftContrib.l1 + rightContrib.l1;
                                phaseL2 = leftContrib.l2 + rightContrib.l2;
                                phaseL3 = leftContrib.l3 + rightContrib.l3;
                            }

                            const checkDemandFactorApplied = (circuit) => {
                                if (!circuit) return false;
                                if (circuit.demandFactor !== undefined && circuit.demandFactor !== null && circuit.demandFactor !== '' && Number(circuit.demandFactor) < 100) {
                                    return true;
                                }
                                if (circuit.connectedPanelId && panelsData) {
                                    const childPanel = panelsData[circuit.connectedPanelId];
                                    if (childPanel?.projectInfo?.demandFactor !== undefined && childPanel?.projectInfo?.demandFactor !== null && childPanel?.projectInfo?.demandFactor !== '' && Number(childPanel.projectInfo.demandFactor) < 100) {
                                        return true;
                                    }
                                }
                                if (circuit.loads && panelsData) {
                                    const hasPLChildWithDf = circuit.loads.some(l => {
                                        if (l.category === 'PL' && l.connectedPanelId) {
                                            const childPanel = panelsData[l.connectedPanelId];
                                            if (childPanel?.projectInfo?.demandFactor !== undefined && childPanel?.projectInfo?.demandFactor !== null && childPanel?.projectInfo?.demandFactor !== '' && Number(childPanel.projectInfo.demandFactor) < 100) {
                                                return true;
                                            }
                                        }
                                        if (l.demandFactor !== undefined && l.demandFactor !== null && l.demandFactor !== '' && Number(l.demandFactor) < 100) {
                                            return true;
                                        }
                                        return false;
                                    });
                                    if (hasPLChildWithDf) return true;
                                }
                                return false;
                            };

                            const isDfApplied = checkDemandFactorApplied(left) || checkDemandFactorApplied(right);

                            // Determine occupancy (which phases should show a marker if load is 0)
                            const getOccupancy = (circuit) => {
                                if (!circuit) return { l1: false, l2: false, l3: false };
                                const p = Number(circuit.p) || 4;
                                if (p >= 3) return { l1: true, l2: true, l3: true };
                                if (p === 2) {
                                    const pl = circuit.phaseLine || 'L1';
                                    return {
                                        l1: pl === 'L1',
                                        l2: pl === 'L2',
                                        l3: pl === 'L3'
                                    };
                                }
                                return { l1: false, l2: false, l3: false };
                            };

                            let occL1 = false, occL2 = false, occL3 = false;
                            if (normalizePhase(projectInfo.phase).includes('1Φ2W')) {
                                if (hasData) {
                                    if (selectedPhaseLine === 'L1') occL1 = true;
                                    else if (selectedPhaseLine === 'L2') occL2 = true;
                                    else if (selectedPhaseLine === 'L3') occL3 = true;
                                }
                            } else {
                                const leftOcc = getOccupancy(left);
                                const rightOcc = getOccupancy(right);
                                occL1 = leftOcc.l1 || rightOcc.l1;
                                occL2 = leftOcc.l2 || rightOcc.l2;
                                occL3 = leftOcc.l3 || rightOcc.l3;
                            }

                            return (
                                <React.Fragment key={row}>
                                    <tr className={`group hover:bg-gray-900/50 transition-colors h-[49px] ${isSelected('left', row) || isSelected('right', row) ? 'bg-lime-500/10' : ''}`}>
                                        {/* Left Action Buttons */}
                                        <td rowSpan={hasData ? 2 : 1} className="border-r border-gray-900 p-1 w-[40px] text-center border-t-2 border-l-2 border-b-2 border-blue-500/20">
                                            <div className="flex flex-col gap-1 items-center transition-opacity">
                                                {left ? (
                                                    <button onClick={() => removeCircuit('left', row)} className="text-red-500 hover:text-red-400" title="Remove Circuit"><Minus size={12} /></button>
                                                ) : (
                                                    <button onClick={() => addCircuitAtRow('left', row)} className="text-green-500 hover:text-green-400" title="Add Circuit Here"><Plus size={12} /></button>
                                                )}
                                            </div>
                                        </td>

                                        {left ? (() => {
                                            const isPL = left.loads?.some(l => l.category === 'PL');
                                            return (
                                                <>
                                                    <td className="border-r border-gray-900 p-0 w-[70px] min-w-[70px] max-w-[70px] overflow-hidden border-t-2 border-blue-500/20">
                                                        {isPL ? (
                                                            <div className="flex items-center justify-center h-[48px] text-yellow-500 font-bold text-[12px]">{left.type || '-'}</div>
                                                        ) : (
                                                            <SelectCell value={left.type} onChange={(v) => updateCircuit('left', left.id, 'type', v)} options={BREAKER_TYPES} placeholder="CB" className="text-yellow-500 font-bold text-[12px]" />
                                                        )}
                                                    </td>
                                                    <td className="border-r border-gray-900 p-0 w-[40px] border-t-2 border-blue-500/20">
                                                        <div className="flex flex-col h-full">
                                                            {isPL ? (
                                                                <div className={`flex items-center justify-center text-yellow-400 text-[12px] ${Number(left.p) === 2 ? "h-[24px]" : "h-[48px]"}`}>{left.p || '-'}</div>
                                                            ) : (
                                                                <SelectCell
                                                                    value={left.p}
                                                                    onChange={(v) => updateCircuit('left', left.id, 'p', v)}
                                                                    options={['2', '3', '4']}
                                                                    placeholder="P"
                                                                    className="text-yellow-400 text-[12px]"
                                                                    heightClass={Number(left.p) === 2 ? "h-[24px]" : "h-[48px]"}
                                                                />
                                                            )}
                                                            {Number(left.p) === 2 && (
                                                                projectInfo.phase === '1Ø-2W' ? (
                                                                    <div className="text-sky-400 text-[10px] border-t border-gray-900 h-[24px] flex items-center justify-center font-bold">
                                                                        {selectedPhaseLine}
                                                                    </div>
                                                                ) : (
                                                                    isPL ? (
                                                                        <div className="text-sky-400 text-[10px] border-t border-gray-900 h-[24px] flex items-center justify-center font-bold">
                                                                            {left.phaseLine || 'L1'}
                                                                        </div>
                                                                    ) : (
                                                                        <SelectCell
                                                                            value={left.phaseLine}
                                                                            onChange={(v) => updateCircuit('left', left.id, 'phaseLine', v)}
                                                                            options={['L1', 'L2', 'L3']}
                                                                            className="text-sky-400 text-[10px] border-t border-gray-900"
                                                                            heightClass="h-[24px]"
                                                                        />
                                                                    )
                                                                )
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="border-r border-gray-900 p-0 w-[50px] border-t-2 border-blue-500/20">
                                                        <div className="relative w-full h-[48px] flex justify-center items-center">
                                                            {left.afError && (
                                                                <div className="absolute bottom-full mb-3 z-50 flex flex-col items-center animate-bounce">
                                                                    <div className="bg-red-600/80 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded shadow-xl relative">
                                                                        {left.afError}
                                                                        {/* Longer tail */}
                                                                        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[10px] border-t-red-600/80"></div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            <div className={`w-full text-center text-[12px] ${left.af === 'ERR' ? 'text-red-500 font-bold' : 'text-white'}`}>
                                                                {left.af || '-'}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="border-r border-gray-900 p-0 w-[50px] bg-yellow-500/5 border-t-2 border-blue-500/20">
                                                        <div className="relative w-full h-[48px] flex justify-center items-center">
                                                            {(() => {
                                                                const isAtHigherThanMain = (Number(left.at) || 0) >= (Number(projectInfo?.mccbAT) || 999999);
                                                                const isKecFail = left.kecJudgment?.at_b?.status === 'Fail';
                                                                if (isAtHigherThanMain || isKecFail) {
                                                                    return (
                                                                        <div className="absolute bottom-full mb-3 z-50 flex flex-col items-center animate-bounce">
                                                                            <div className="bg-red-600/80 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded shadow-xl relative">
                                                                                Chk.
                                                                                <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[10px] border-t-red-600/80"></div>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                }
                                                                return null;
                                                            })()}
                                                            {isPL ? (
                                                                <div className={`w-full text-center font-bold text-[12px] ${(Number(left.at) || 0) >= (Number(projectInfo?.mccbAT) || 999999) ? 'text-red-500' : 'text-yellow-400'}`}>{left.at || '-'}</div>
                                                            ) : (
                                                                <InputCell value={left.at} onChange={(v) => updateCircuit('left', left.id, 'at', v)} className={`font-bold text-[12px] ${(Number(left.at) || 0) >= (Number(projectInfo?.mccbAT) || 999999) ? '!text-red-500' : 'text-yellow-400'}`} />
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="border-r border-gray-900 p-0 w-[45px] border-t-2 border-blue-500/20 cursor-pointer hover:bg-gray-800" onClick={() => openJudgmentDrawer(left, 'at_th')}>
                                                        <div className={`flex items-center justify-center h-[48px] text-[12px] font-bold ${getStatusColor(left.kecJudgment?.at_th?.status)}`}>
                                                            {left.kecJudgment?.at_th?.status || '-'}
                                                        </div>
                                                    </td>
                                                    <td className="border-r border-gray-900 p-0 w-[45px] border-t-2 border-blue-500/20 cursor-pointer hover:bg-gray-800" onClick={() => openJudgmentDrawer(left, 'at_sc')}>
                                                        <div className={`flex items-center justify-center h-[48px] text-[12px] font-bold ${getStatusColor(left.kecJudgment?.at_sc?.status)}`}>
                                                            {left.kecJudgment?.at_sc?.status || '-'}
                                                        </div>
                                                    </td>
                                                    <td className="border-r border-gray-900 p-0 w-[45px] border-t-2 border-blue-500/20 cursor-pointer hover:bg-gray-800" onClick={() => openJudgmentDrawer(left, 'sb')}>
                                                        <div className="relative w-full h-[48px] flex justify-center items-center">
                                                            {left.kecJudgment?.sb?.recommendedSize === 'WIRE/공사 Chk' && (
                                                                <div className="absolute bottom-full mb-3 z-50 flex flex-col items-center animate-bounce">
                                                                    <div className="bg-red-600/80 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded shadow-xl relative text-center leading-tight whitespace-nowrap">
                                                                        WIRE/공사<br />Chk
                                                                        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[10px] border-t-red-600/80"></div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            <div className={`text-[12px] font-bold ${getStatusColor(left.kecJudgment?.sb?.status)}`}>
                                                                {left.kecJudgment?.sb?.recommendedSize === 'WIRE/공사 Chk' ? 'Fail' : (left.kecJudgment?.sb?.recommendedSize || '-')}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="border-r border-gray-900 p-0 w-[45px] border-t-2 border-blue-500/20 cursor-pointer hover:bg-gray-800" onClick={() => openJudgmentDrawer(left, 'scb')}>
                                                        <div className="relative w-full h-[48px] flex justify-center items-center">
                                                            {left.kecJudgment?.scb?.recommendedSize === 'WIRE/공사 Chk' && (
                                                                <div className="absolute bottom-full mb-3 z-50 flex flex-col items-center animate-bounce">
                                                                    <div className="bg-red-600/80 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded shadow-xl relative text-center leading-tight whitespace-nowrap">
                                                                        WIRE/공사<br />Chk
                                                                        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[10px] border-t-red-600/80"></div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            <div className={`text-[12px] font-bold ${getStatusColor(left.kecJudgment?.scb?.status)}`}>
                                                                {left.kecJudgment?.scb?.recommendedSize === 'WIRE/공사 Chk' ? 'Fail' : (left.kecJudgment?.scb?.recommendedSize || '-')}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="border-r border-gray-900 p-0 w-[50px] border-t-2 border-blue-500/20 cursor-pointer hover:bg-gray-800" onClick={() => openJudgmentDrawer(left, 'se')}>
                                                        <div className={`flex items-center justify-center h-[48px] text-[12px] font-bold ${getStatusColor(left.kecJudgment?.se?.status)}`}>
                                                            {left.kecJudgment?.se?.e_percent ? (parseFloat(left.kecJudgment.se.e_percent) >= 1 ? parseFloat(left.kecJudgment.se.e_percent).toFixed(1) : parseFloat(left.kecJudgment.se.e_percent).toFixed(2)) : '-'}
                                                        </div>
                                                    </td>
                                                    <td className="border-r border-gray-900 p-0 w-[45px] border-t-2 border-blue-500/20 cursor-pointer hover:bg-gray-800" onClick={() => openJudgmentDrawer(left, 'ssc')}>
                                                        <div className={`flex items-center justify-center h-[48px] text-[12px] font-bold ${getStatusColor(left.kecJudgment?.ssc?.status)}`}>
                                                            {left.kecJudgment?.ssc?.recommendedSize || '-'}
                                                        </div>
                                                    </td>
                                                    <td className="border-r border-gray-900 p-0 w-[50px] border-t-2 border-blue-500/20">
                                                        <div className="relative w-full h-[48px] flex justify-center items-center">
                                                            {!isCableMethodValid(left) && (
                                                                <div className="absolute bottom-full mb-3 z-50 flex flex-col items-center animate-bounce">
                                                                    <div className="bg-red-600/80 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded shadow-xl relative">
                                                                        Chk.
                                                                        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[10px] border-t-red-600/80"></div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {isPL ? (
                                                                <div className="w-full text-center text-yellow-400 text-[12px]">{left.method || '-'}</div>
                                                            ) : (
                                                                <SelectCell
                                                                    value={left.method}
                                                                    onChange={(v) => {
                                                                        if (v === 'X') {
                                                                            setParallelPopupCircuitId({ side: 'left', id: left.id });
                                                                            setIsParallelPopupOpen(true);
                                                                        } else {
                                                                            updateCircuit('left', left.id, 'method', v);
                                                                        }
                                                                    }}
                                                                    options={[...new Set(['A1', 'A2', 'B1', 'B2', 'D', 'E', 'F', 'X', left.method])].filter(Boolean)}
                                                                    placeholder="공사"
                                                                    className="text-yellow-400 text-[12px]"
                                                                    disabledOptions={getMethodDisabledOptions(left)}
                                                                />
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="border-r border-gray-900 p-0 w-[60px] border-t-2 border-blue-500/20">
                                                        {isPL ? (
                                                            <div className="flex items-center justify-center h-[48px] text-yellow-400 text-[12px]">{left.wire || '-'}</div>
                                                        ) : (
                                                            <SelectCell value={left.wire} onChange={(v) => updateCircuit('left', left.id, 'wire', v)} options={['HFIX', 'FCV', 'FR8']} placeholder="WIRE" className="text-yellow-400 text-[12px]" />
                                                        )}
                                                    </td>
                                                    <td className="border-r border-gray-900 p-0 w-[60px] bg-yellow-500/5 border-t-2 border-blue-500/20">
                                                        {isPL ? (
                                                            <div className="flex items-center justify-center h-[48px] text-yellow-400 font-bold text-[12px]">{left.size || '-'}</div>
                                                        ) : (
                                                            <SelectCell value={left.size} onChange={(v) => updateCircuit('left', left.id, 'size', v)} options={['1.5', '2.5', '4', '6', '10', '16', '25', '35', '50', '70', '95', '120', '150', '185', '240', '300']} placeholder="㎟" className="text-yellow-400 font-bold text-[12px]" />
                                                        )}
                                                    </td>

                                                    {/* Central Info - Left Side */}
                                                    <td className="border-r border-gray-900 p-0 text-right bg-black min-w-[100px] border-t-2 border-blue-500/20">
                                                        <div className="flex flex-col justify-center h-[48px] px-2">
                                                            <div className="text-white font-bold text-[12px]">{left.power.toLocaleString()} <span className="text-gray-400 font-normal">[VA]</span></div>
                                                            <div className="text-white text-[12px]">{(Number(left.p) === 2 ? left.power / 220 : left.power / 380 / Math.sqrt(3)).toFixed(1)} <span className="text-gray-400">[A]</span></div>
                                                        </div>
                                                    </td>
                                                    {/* Circuit Cell - Drag/Selection enabled */}
                                                    <td
                                                        className={`border-r border-gray-900 p-0 text-center bg-gray-900/30 min-w-[120px] cursor-grab active:cursor-grabbing select-none border-t-2 border-blue-500/20 relative ${isSelected('left', row) ? 'z-20 outline outline-2 outline-lime-400 !border-lime-400' : ''} ${dropTarget?.side === 'left' && dropTarget?.row === row ? (dropTarget.position === 'above' ? 'shadow-[inset_0_3px_0_0_rgb(74,222,128)]' : 'shadow-[inset_0_-3px_0_0_rgb(74,222,128)]') : ''} ${draggedCircuit?.side === 'left' && draggedCircuit?.row === row ? 'opacity-50' : ''}`}
                                                        draggable
                                                        onMouseDown={(e) => { dragOriginRef.current = e.target; }}
                                                        onDragStart={(e) => handleDragStart(e, 'left', row, left)}
                                                        onDragOver={(e) => handleDragOver(e, 'left', row)}
                                                        onDragLeave={handleDragLeave}
                                                        onDrop={(e) => handleDrop(e, 'left', row)}
                                                        onDragEnd={handleDragEnd}
                                                        onClick={(e) => handleCircuitClick(e, 'left', row, left)}
                                                        onContextMenu={(e) => handleContextMenu(e, 'left', row, left)}
                                                    >
                                                        <InputCell
                                                            value={
                                                                (left.connectedPanelId || left.loads?.find(l => l.category === 'PL')?.connectedPanelId)
                                                                    ? `"${getNameById(left.connectedPanelId || left.loads?.find(l => l.category === 'PL')?.connectedPanelId)}"`
                                                                    : left.loadName
                                                            }
                                                            onChange={(v) => updateCircuit('left', left.id, 'loadName', v)}
                                                            className={`font-bold text-[12px] ${(left.connectedPanelId || left.loads?.find(l => l.category === 'PL')?.connectedPanelId) || (left.loadName?.startsWith('"') && left.loadName?.endsWith('"')) ? 'text-purple-400' : 'text-yellow-400'}`}
                                                        />
                                                    </td>
                                                    <td
                                                        rowSpan={hasData ? 2 : 1}
                                                        className={`border-r border-gray-900 p-0 text-center ${isDfApplied ? 'text-blue-400 font-bold' : 'text-white'} text-[12px] min-w-[70px] border-t-2 border-b-2 border-blue-500/20 ${(left?.p == 2 || right?.p == 2) ? 'cursor-pointer hover:bg-blue-500/10' : ''}`}
                                                        onClick={() => {
                                                            if (left && Number(left.p) === 2) updateCircuit('left', left.id, 'phaseLine', 'L1');
                                                            else if (right && Number(right.p) === 2) updateCircuit('right', right.id, 'phaseLine', 'L1');
                                                        }}
                                                        onContextMenu={(e) => {
                                                            e.preventDefault();
                                                            if (right && Number(right.p) === 2) updateCircuit('right', right.id, 'phaseLine', 'L1');
                                                        }}
                                                    >
                                                        <div className="flex items-center justify-center h-full min-h-[48px]">{phaseL1 > 0 ? phaseL1.toLocaleString() : (occL1 ? '-' : '')}</div>
                                                    </td>
                                                    <td
                                                        rowSpan={hasData ? 2 : 1}
                                                        className={`border-r border-gray-900 p-0 text-center ${isDfApplied ? 'text-blue-400 font-bold' : 'text-white'} text-[12px] min-w-[70px] border-t-2 border-b-2 border-blue-500/20 ${(left?.p == 2 || right?.p == 2) ? 'cursor-pointer hover:bg-blue-500/10' : ''}`}
                                                        onClick={() => {
                                                            if (left && Number(left.p) === 2) updateCircuit('left', left.id, 'phaseLine', 'L2');
                                                            else if (right && Number(right.p) === 2) updateCircuit('right', right.id, 'phaseLine', 'L2');
                                                        }}
                                                        onContextMenu={(e) => {
                                                            e.preventDefault();
                                                            if (right && Number(right.p) === 2) updateCircuit('right', right.id, 'phaseLine', 'L2');
                                                        }}
                                                    >
                                                        <div className="flex items-center justify-center h-full min-h-[48px]">{phaseL2 > 0 ? phaseL2.toLocaleString() : (occL2 ? '-' : '')}</div>
                                                    </td>
                                                    <td
                                                        rowSpan={hasData ? 2 : 1}
                                                        className={`border-r border-gray-900 p-0 text-center ${isDfApplied ? 'text-blue-400 font-bold' : 'text-white'} text-[12px] min-w-[70px] border-t-2 border-b-2 border-blue-500/20 ${(left?.p == 2 || right?.p == 2) ? 'cursor-pointer hover:bg-blue-500/10' : ''}`}
                                                        onClick={() => {
                                                            if (left && Number(left.p) === 2) updateCircuit('left', left.id, 'phaseLine', 'L3');
                                                            else if (right && Number(right.p) === 2) updateCircuit('right', right.id, 'phaseLine', 'L3');
                                                        }}
                                                        onContextMenu={(e) => {
                                                            e.preventDefault();
                                                            if (right && Number(right.p) === 2) updateCircuit('right', right.id, 'phaseLine', 'L3');
                                                        }}
                                                    >
                                                        <div className="flex items-center justify-center h-full min-h-[48px]">{phaseL3 > 0 ? phaseL3.toLocaleString() : (occL3 ? '-' : '')}</div>
                                                    </td>
                                                </>
                                            );
                                        })() : (
                                            <>
                                                {/* Empty left circuit */}
                                                <td
                                                    colSpan={13}
                                                    className={`border-r border-gray-900 bg-gray-900/5 text-center text-gray-500 text-[10px] h-[48px] border-t-2 border-blue-500/20 ${!hasData ? 'border-b-2' : ''} ${isSelected('left', row) ? 'z-20 outline outline-2 outline-lime-400 !border-lime-400' : ''}`}
                                                    onClick={(e) => handleCircuitClick(e, 'left', row, null)}
                                                    onContextMenu={(e) => handleContextMenu(e, 'left', row, null)}
                                                >
                                                    <div className="flex items-center justify-center h-full">- EMPTY -</div>
                                                </td>
                                                <td className={`border-r border-gray-900 p-0 text-right bg-black min-w-[100px] h-[48px] border-t-2 border-blue-500/20 ${!hasData ? 'border-b-2' : ''}`}></td>
                                                <td
                                                    className={`border-r border-gray-900 p-0 text-center bg-gray-900/30 min-w-[120px] h-[48px] border-t-2 border-blue-500/20 ${!hasData ? 'border-b-2' : ''} ${dropTarget?.side === 'left' && dropTarget?.row === row ? (dropTarget.position === 'above' ? 'shadow-[inset_0_3px_0_0_rgb(74,222,128)]' : 'shadow-[inset_0_-3px_0_0_rgb(74,222,128)]') : ''}`}
                                                    onDragOver={(e) => handleDragOver(e, 'left', row)}
                                                    onDragLeave={handleDragLeave}
                                                    onDrop={(e) => handleDrop(e, 'left', row)}
                                                    onContextMenu={(e) => handleContextMenu(e, 'left', row, null)}
                                                ></td>
                                                <td
                                                    rowSpan={hasData ? 2 : 1}
                                                    className={`border-r border-gray-900 p-0 text-center ${isDfApplied ? 'text-blue-400 font-bold' : 'text-white'} text-[12px] min-w-[70px] h-[48px] border-t-2 border-b-2 border-blue-500/20 ${(right?.p == 2) ? 'cursor-pointer hover:bg-blue-500/10' : ''}`}
                                                    onClick={() => {
                                                        if (right && Number(right.p) === 2) updateCircuit('right', right.id, 'phaseLine', 'L1');
                                                    }}
                                                    onContextMenu={(e) => {
                                                        e.preventDefault();
                                                        if (right && Number(right.p) === 2) updateCircuit('right', right.id, 'phaseLine', 'L1');
                                                    }}
                                                >
                                                    <div className="flex items-center justify-center h-full">{phaseL1 > 0 ? phaseL1.toLocaleString() : (occL1 ? '-' : '')}</div>
                                                </td>
                                                <td
                                                    rowSpan={hasData ? 2 : 1}
                                                    className={`border-r border-gray-900 p-0 text-center ${isDfApplied ? 'text-blue-400 font-bold' : 'text-white'} text-[12px] min-w-[70px] h-[48px] border-t-2 border-b-2 border-blue-500/20 ${(right?.p == 2) ? 'cursor-pointer hover:bg-blue-500/10' : ''}`}
                                                    onClick={() => {
                                                        if (right && Number(right.p) === 2) updateCircuit('right', right.id, 'phaseLine', 'L2');
                                                    }}
                                                    onContextMenu={(e) => {
                                                        e.preventDefault();
                                                        if (right && Number(right.p) === 2) updateCircuit('right', right.id, 'phaseLine', 'L2');
                                                    }}
                                                >
                                                    <div className="flex items-center justify-center h-full">{phaseL2 > 0 ? phaseL2.toLocaleString() : (occL2 ? '-' : '')}</div>
                                                </td>
                                                <td
                                                    rowSpan={hasData ? 2 : 1}
                                                    className={`border-r border-gray-900 p-0 text-center ${isDfApplied ? 'text-blue-400 font-bold' : 'text-white'} text-[12px] min-w-[70px] h-[48px] border-t-2 border-b-2 border-blue-500/20 ${(right?.p == 2) ? 'cursor-pointer hover:bg-blue-500/10' : ''}`}
                                                    onClick={() => {
                                                        if (right && Number(right.p) === 2) updateCircuit('right', right.id, 'phaseLine', 'L3');
                                                    }}
                                                    onContextMenu={(e) => {
                                                        e.preventDefault();
                                                        if (right && Number(right.p) === 2) updateCircuit('right', right.id, 'phaseLine', 'L3');
                                                    }}
                                                >
                                                    <div className="flex items-center justify-center h-full">{phaseL3 > 0 ? phaseL3.toLocaleString() : (occL3 ? '-' : '')}</div>
                                                </td>
                                            </>
                                        )}

                                        {/* Right Circuit */}
                                        {right ? (() => {
                                            const isPL = right.loads?.some(l => l.category === 'PL');
                                            return (
                                                <>
                                                    <td
                                                        className={`border-r border-gray-900 p-0 text-center bg-gray-900/30 min-w-[120px] cursor-grab active:cursor-grabbing select-none border-t-2 border-blue-500/20 relative ${isSelected('right', row) ? 'z-20 outline outline-2 outline-lime-400 !border-lime-400' : ''} ${dropTarget?.side === 'right' && dropTarget?.row === row ? (dropTarget.position === 'above' ? 'shadow-[inset_0_3px_0_0_rgb(74,222,128)]' : 'shadow-[inset_0_-3px_0_0_rgb(74,222,128)]') : ''} ${draggedCircuit?.side === 'right' && draggedCircuit?.row === row ? 'opacity-50' : ''}`}
                                                        draggable
                                                        onMouseDown={(e) => { dragOriginRef.current = e.target; }}
                                                        onDragStart={(e) => handleDragStart(e, 'right', row, right)}
                                                        onDragOver={(e) => handleDragOver(e, 'right', row)}
                                                        onDragLeave={handleDragLeave}
                                                        onDrop={(e) => handleDrop(e, 'right', row)}
                                                        onDragEnd={handleDragEnd}
                                                        onClick={(e) => handleCircuitClick(e, 'right', row, right)}
                                                        onContextMenu={(e) => handleContextMenu(e, 'right', row, right)}
                                                    >
                                                        <InputCell
                                                            value={
                                                                (right.connectedPanelId || right.loads?.find(l => l.category === 'PL')?.connectedPanelId)
                                                                    ? `"${getNameById(right.connectedPanelId || right.loads?.find(l => l.category === 'PL')?.connectedPanelId)}"`
                                                                    : right.loadName
                                                            }
                                                            onChange={(v) => updateCircuit('right', right.id, 'loadName', v)}
                                                            className={`font-bold text-[12px] ${(right.connectedPanelId || right.loads?.find(l => l.category === 'PL')?.connectedPanelId) || (right.loadName?.startsWith('"') && right.loadName?.endsWith('"')) ? 'text-purple-400' : 'text-yellow-400'}`}
                                                        />
                                                    </td>
                                                    <td className="border-r border-gray-900 p-0 text-left bg-black min-w-[100px] border-t-2 border-blue-500/20">
                                                        <div className="flex flex-col justify-center h-[48px] px-2">
                                                            <div className="text-white font-bold text-[12px]">{right.power.toLocaleString()} <span className="text-gray-400 font-normal">[VA]</span></div>
                                                            <div className="text-white text-[12px]">{(Number(right.p) === 2 ? right.power / 220 : right.power / 380 / Math.sqrt(3)).toFixed(1)} <span className="text-gray-400">[A]</span></div>
                                                        </div>
                                                    </td>
                                                    <td className="border-r border-gray-900 p-0 w-[70px] min-w-[70px] max-w-[70px] overflow-hidden border-t-2 border-blue-500/20">
                                                        {isPL ? (
                                                            <div className="flex items-center justify-center h-[48px] text-yellow-500 font-bold text-[12px]">{right.type || '-'}</div>
                                                        ) : (
                                                            <SelectCell value={right.type} onChange={(v) => updateCircuit('right', right.id, 'type', v)} options={['MCCB', 'ELCB']} placeholder="CB" className="text-yellow-500 font-bold text-[12px]" />
                                                        )}
                                                    </td>
                                                    <td className="border-r border-gray-900 p-0 w-[40px] border-t-2 border-blue-500/20">
                                                        <div className="flex flex-col h-full">
                                                            {isPL ? (
                                                                <div className={`flex items-center justify-center text-yellow-400 text-[12px] ${Number(right.p) === 2 ? "h-[24px]" : "h-[48px]"}`}>{right.p || '-'}</div>
                                                            ) : (
                                                                <SelectCell
                                                                    value={right.p}
                                                                    onChange={(v) => updateCircuit('right', right.id, 'p', v)}
                                                                    options={['2', '3', '4']}
                                                                    placeholder="P"
                                                                    className="text-yellow-400 text-[12px]"
                                                                    heightClass={Number(right.p) === 2 ? "h-[24px]" : "h-[48px]"}
                                                                />
                                                            )}
                                                            {Number(right.p) === 2 && (
                                                                projectInfo.phase === '1Ø-2W' ? (
                                                                    <div className="text-sky-400 text-[10px] border-t border-gray-900 h-[24px] flex items-center justify-center font-bold">
                                                                        {selectedPhaseLine}
                                                                    </div>
                                                                ) : (
                                                                    isPL ? (
                                                                        <div className="text-sky-400 text-[10px] border-t border-gray-900 h-[24px] flex items-center justify-center font-bold">
                                                                            {right.phaseLine || 'L1'}
                                                                        </div>
                                                                    ) : (
                                                                        <SelectCell
                                                                            value={right.phaseLine}
                                                                            onChange={(v) => updateCircuit('right', right.id, 'phaseLine', v)}
                                                                            options={['L1', 'L2', 'L3']}
                                                                            className="text-sky-400 text-[10px] border-t border-gray-900"
                                                                            heightClass="h-[24px]"
                                                                        />
                                                                    )
                                                                )
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="border-r border-gray-900 p-0 w-[50px] border-t-2 border-blue-500/20">
                                                        <div className="relative w-full h-[48px] flex justify-center items-center">
                                                            {right.afError && (
                                                                <div className="absolute bottom-full mb-3 z-50 flex flex-col items-center animate-bounce">
                                                                    <div className="bg-red-600/80 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded shadow-xl relative">
                                                                        {right.afError}
                                                                        {/* Longer tail */}
                                                                        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[10px] border-t-red-600/80"></div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            <div className={`w-full text-center text-[12px] ${right.af === 'ERR' ? 'text-red-500 font-bold' : 'text-white'}`}>
                                                                {right.af || '-'}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="border-r border-gray-900 p-0 w-[50px] border-t-2 border-blue-500/20">
                                                        <div className="relative w-full h-[48px] flex justify-center items-center">
                                                            {(() => {
                                                                const isAtHigherThanMain = (Number(right.at) || 0) >= (Number(projectInfo?.mccbAT) || 999999);
                                                                const isKecFail = right.kecJudgment?.at_b?.status === 'Fail';
                                                                if (isAtHigherThanMain || isKecFail) {
                                                                    return (
                                                                        <div className="absolute bottom-full mb-3 z-50 flex flex-col items-center animate-bounce">
                                                                            <div className="bg-red-600/80 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded shadow-xl relative">
                                                                                Chk.
                                                                                <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[10px] border-t-red-600/80"></div>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                }
                                                                return null;
                                                            })()}
                                                            {isPL ? (
                                                                <div className={`w-full text-center font-bold text-[12px] ${(Number(right.at) || 0) >= (Number(projectInfo?.mccbAT) || 999999) ? 'text-red-500' : 'text-yellow-400'}`}>{right.at || '-'}</div>
                                                            ) : (
                                                                <InputCell value={right.at} onChange={(v) => updateCircuit('right', right.id, 'at', v)} className={`font-bold text-[12px] ${(Number(right.at) || 0) >= (Number(projectInfo?.mccbAT) || 999999) ? '!text-red-500' : 'text-yellow-400'}`} />
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="border-r border-gray-900 p-0 w-[45px] border-t-2 border-blue-500/20 cursor-pointer hover:bg-gray-800" onClick={() => openJudgmentDrawer(right, 'at_th')}>
                                                        <div className={`flex items-center justify-center h-[48px] text-[12px] font-bold ${getStatusColor(right.kecJudgment?.at_th?.status)}`}>
                                                            {right.kecJudgment?.at_th?.status || '-'}
                                                        </div>
                                                    </td>
                                                    <td className="border-r border-gray-900 p-0 w-[45px] border-t-2 border-blue-500/20 cursor-pointer hover:bg-gray-800" onClick={() => openJudgmentDrawer(right, 'at_sc')}>
                                                        <div className={`flex items-center justify-center h-[48px] text-[12px] font-bold ${getStatusColor(right.kecJudgment?.at_sc?.status)}`}>
                                                            {right.kecJudgment?.at_sc?.status || '-'}
                                                        </div>
                                                    </td>
                                                    <td className="border-r border-gray-900 p-0 w-[45px] border-t-2 border-blue-500/20 cursor-pointer hover:bg-gray-800" onClick={() => openJudgmentDrawer(right, 'sb')}>
                                                        <div className="relative w-full h-[48px] flex justify-center items-center">
                                                            {right.kecJudgment?.sb?.recommendedSize === 'WIRE/공사 Chk' && (
                                                                <div className="absolute bottom-full mb-3 z-50 flex flex-col items-center animate-bounce">
                                                                    <div className="bg-red-600/80 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded shadow-xl relative text-center leading-tight whitespace-nowrap">
                                                                        WIRE/공사<br />Chk
                                                                        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[10px] border-t-red-600/80"></div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            <div className={`text-[12px] font-bold ${getStatusColor(right.kecJudgment?.sb?.status)}`}>
                                                                {right.kecJudgment?.sb?.recommendedSize === 'WIRE/공사 Chk' ? 'Fail' : (right.kecJudgment?.sb?.recommendedSize || '-')}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="border-r border-gray-900 p-0 w-[45px] border-t-2 border-blue-500/20 cursor-pointer hover:bg-gray-800" onClick={() => openJudgmentDrawer(right, 'scb')}>
                                                        <div className="relative w-full h-[48px] flex justify-center items-center">
                                                            {right.kecJudgment?.scb?.recommendedSize === 'WIRE/공사 Chk' && (
                                                                <div className="absolute bottom-full mb-3 z-50 flex flex-col items-center animate-bounce">
                                                                    <div className="bg-red-600/80 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded shadow-xl relative text-center leading-tight whitespace-nowrap">
                                                                        WIRE/공사<br />Chk
                                                                        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[10px] border-t-red-600/80"></div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            <div className={`text-[12px] font-bold ${getStatusColor(right.kecJudgment?.scb?.status)}`}>
                                                                {right.kecJudgment?.scb?.recommendedSize === 'WIRE/공사 Chk' ? 'Fail' : (right.kecJudgment?.scb?.recommendedSize || '-')}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="border-r border-gray-900 p-0 w-[50px] border-t-2 border-blue-500/20 cursor-pointer hover:bg-gray-800" onClick={() => openJudgmentDrawer(right, 'se')}>
                                                        <div className={`flex items-center justify-center h-[48px] text-[12px] font-bold ${getStatusColor(right.kecJudgment?.se?.status)}`}>
                                                            {right.kecJudgment?.se?.e_percent ? (parseFloat(right.kecJudgment.se.e_percent) >= 1 ? parseFloat(right.kecJudgment.se.e_percent).toFixed(1) : parseFloat(right.kecJudgment.se.e_percent).toFixed(2)) : '-'}
                                                        </div>
                                                    </td>
                                                    <td className="border-r border-gray-900 p-0 w-[45px] border-t-2 border-blue-500/20 cursor-pointer hover:bg-gray-800" onClick={() => openJudgmentDrawer(right, 'ssc')}>
                                                        <div className={`flex items-center justify-center h-[48px] text-[12px] font-bold ${getStatusColor(right.kecJudgment?.ssc?.status)}`}>
                                                            {right.kecJudgment?.ssc?.recommendedSize || '-'}
                                                        </div>
                                                    </td>
                                                    <td className="border-r border-gray-900 p-0 w-[50px] border-t-2 border-blue-500/20">
                                                        <div className="relative w-full h-[48px] flex justify-center items-center">
                                                            {!isCableMethodValid(right) && (
                                                                <div className="absolute bottom-full mb-3 z-50 flex flex-col items-center animate-bounce">
                                                                    <div className="bg-red-600/80 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded shadow-xl relative">
                                                                        Chk.
                                                                        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[10px] border-t-red-600/80"></div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {isPL ? (
                                                                <div className="w-full text-center text-yellow-400 text-[12px]">{right.method || '-'}</div>
                                                            ) : (
                                                                <SelectCell
                                                                    value={right.method}
                                                                    onChange={(v) => {
                                                                        if (v === 'X') {
                                                                            setParallelPopupCircuitId({ side: 'right', id: right.id });
                                                                            setIsParallelPopupOpen(true);
                                                                        } else {
                                                                            updateCircuit('right', right.id, 'method', v);
                                                                        }
                                                                    }}
                                                                    options={[...new Set(['A1', 'A2', 'B1', 'B2', 'D', 'E', 'F', 'X', right.method])].filter(Boolean)}
                                                                    placeholder="공사"
                                                                    className="text-yellow-400 text-[12px]"
                                                                    disabledOptions={getMethodDisabledOptions(right)}
                                                                />
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="border-r border-gray-900 p-0 w-[60px] border-t-2 border-blue-500/20">
                                                        {isPL ? (
                                                            <div className="flex items-center justify-center h-[48px] text-yellow-400 text-[12px]">{right.wire || '-'}</div>
                                                        ) : (
                                                            <SelectCell value={right.wire} onChange={(v) => updateCircuit('right', right.id, 'wire', v)} options={['HFIX', 'FCV', 'FR8']} placeholder="WIRE" className="text-yellow-400 text-[12px]" />
                                                        )}
                                                    </td>
                                                    <td className="border-r border-gray-900 p-0 w-[60px] bg-yellow-500/5 border-t-2 border-blue-500/20">
                                                        {isPL ? (
                                                            <div className="flex items-center justify-center h-[48px] text-yellow-400 font-bold text-[12px]">{right.size || '-'}</div>
                                                        ) : (
                                                            <SelectCell value={right.size} onChange={(v) => updateCircuit('right', right.id, 'size', v)} options={['1.5', '2.5', '4', '6', '10', '16', '25', '35', '50', '70', '95', '120', '150', '185', '240', '300']} placeholder="㎟" className="text-yellow-400 font-bold text-[12px]" />
                                                        )}
                                                    </td>
                                                </>
                                            );
                                        })() : (
                                            <>
                                                <td
                                                    className={`border-r border-gray-900 p-0 text-center bg-gray-900/30 min-w-[120px] h-[48px] border-t-2 border-blue-500/20 ${!hasData ? 'border-b-2' : ''} ${dropTarget?.side === 'right' && dropTarget?.row === row ? (dropTarget.position === 'above' ? 'shadow-[inset_0_3px_0_0_rgb(74,222,128)]' : 'shadow-[inset_0_-3px_0_0_rgb(74,222,128)]') : ''}`}
                                                    onDragOver={(e) => handleDragOver(e, 'right', row)}
                                                    onDragLeave={handleDragLeave}
                                                    onDrop={(e) => handleDrop(e, 'right', row)}
                                                    onContextMenu={(e) => handleContextMenu(e, 'right', row, null)}
                                                ></td>
                                                <td className={`p-0 text-right bg-black min-w-[100px] h-[48px] border-t-2 border-blue-500/20 ${!hasData ? 'border-b-2' : ''}`}></td>
                                                <td
                                                    colSpan={13}
                                                    className={`bg-gray-900/5 text-center text-gray-500 text-[10px] h-[48px] border-t-2 border-blue-500/20 ${!hasData ? 'border-b-2' : ''} ${isSelected('right', row) ? 'z-20 outline outline-2 outline-lime-400 !border-lime-400' : ''}`}
                                                    onClick={(e) => handleCircuitClick(e, 'right', row, null)}
                                                    onContextMenu={(e) => handleContextMenu(e, 'right', row, null)}
                                                >
                                                    <div className="flex items-center justify-center h-full">- EMPTY -</div>
                                                </td>
                                            </>
                                        )}

                                        {/* Right Action Buttons */}
                                        <td rowSpan={hasData ? 2 : 1} className="p-1 w-[40px] text-center border-t-2 border-r-2 border-b-2 border-blue-500/20">
                                            <div className="flex flex-col gap-1 items-center transition-opacity">
                                                {right ? (
                                                    <button onClick={() => removeCircuit('right', row)} className="text-red-500 hover:text-red-400" title="Remove Circuit"><Minus size={12} /></button>
                                                ) : (
                                                    <button onClick={() => addCircuitAtRow('right', row)} className="text-green-500 hover:text-green-400" title="Add Circuit Here"><Plus size={12} /></button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>

                                    {/* Load Details Row - Only show for circuits with data */}
                                    {(left || right) && (
                                        <tr className={`bg-gray-950/30 ${isSelected('left', row) || isSelected('right', row) ? 'bg-lime-500/10' : ''}`}>
                                            {/* Left "부하" Label */}
                                            <td className="border-r border-gray-900 w-[40px] border-b-2 border-blue-500/20">
                                                <div className="flex items-center justify-center h-full text-[11px] text-gray-500 font-medium">부하</div>
                                            </td>
                                            {/* Left Circuit Load Details - 14 columns (Action and L123 are rowSpan) */}
                                            <td colSpan={14} className="border-r border-gray-900 p-1 overflow-hidden border-b-2 border-blue-500/20" style={{ maxWidth: '400px' }}>
                                                {left && (
                                                    <div
                                                        className="flex flex-nowrap gap-1 items-center cursor-pointer hover:bg-yellow-900/10 p-1 rounded transition-colors min-h-[30px] overflow-hidden"
                                                        onClick={() => openLoadModal('left', left.id)}
                                                    >
                                                        {left.loads?.length > 0 ? (
                                                            <>
                                                                {left.loads.slice(0, 3).map((load) => (
                                                                    <div
                                                                        key={load.id}
                                                                        className="flex-shrink-0 flex items-center text-[10px] px-2 py-0.5 bg-black/50 border border-gray-800 rounded"
                                                                    >
                                                                        {load.prefix && (
                                                                            <span className={`mr-1 ${load.prefix === '일괄소등' ? 'text-yellow-400' :
                                                                                load.prefix === '감전보호' ? 'text-sky-400' :
                                                                                    load.prefix === 'On/Off' ? 'text-orange-400' :
                                                                                        load.prefix === '타이머' ? 'text-white' :
                                                                                            'text-gray-500'
                                                                                }`}>
                                                                                {load.prefix}
                                                                            </span>
                                                                        )}
                                                                        <span className={`font-medium mr-1 ${load.category === '동력' ? 'text-orange-500' :
                                                                            load.category === '전등' ? 'text-yellow-400' :
                                                                                load.category === 'PL' ? 'text-purple-400' :
                                                                                    load.category === '예비' ? 'text-gray-500' :
                                                                                        load.prefix === '감전보호' ? 'text-sky-400' :
                                                                                            'text-white'
                                                                            }`}>{load.category === 'PL' && load.connectedPanelId ? getNameById(load.connectedPanelId) || load.name : load.name}</span>
                                                                        <span className="text-gray-400">{load.qty}</span>
                                                                        <span className="text-gray-500 mx-0.5">[EA]</span>
                                                                        <span className="text-white font-medium">{(Number(load.va) || 0).toLocaleString()}</span>
                                                                        <span className="text-gray-500">[VA]</span>
                                                                    </div>
                                                                ))}
                                                                {left.loads.length > 3 && (
                                                                    <span className="flex-shrink-0 text-[10px] px-2 py-0.5 bg-gray-800 border border-gray-700 rounded text-yellow-400 font-medium">+{left.loads.length - 3}</span>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <span className="text-[10px] text-gray-600 italic">+ 부하 입력 클릭</span>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            {/* L1, L2, L3 cells are rowSpan={2} from the row above, so no cells needed here */}
                                            {/* Right Circuit Load Details */}
                                            {/* Right Circuit Load Details - 14 columns */}
                                            <td colSpan={14} className="border-r border-gray-900 p-1 overflow-hidden border-b-2 border-blue-500/20" style={{ maxWidth: '400px' }}>
                                                {right && (
                                                    <div
                                                        className="flex flex-nowrap gap-1 items-center cursor-pointer hover:bg-yellow-900/10 p-1 rounded transition-colors min-h-[30px] overflow-hidden"
                                                        onClick={() => openLoadModal('right', right.id)}
                                                    >
                                                        {right.loads?.length > 0 ? (
                                                            <>
                                                                {right.loads.slice(0, 3).map((load) => (
                                                                    <div
                                                                        key={load.id}
                                                                        className="flex-shrink-0 flex items-center text-[10px] px-2 py-0.5 bg-black/50 border border-gray-800 rounded"
                                                                    >
                                                                        {load.prefix && (
                                                                            <span className={`mr-1 ${load.prefix === '일괄소등' ? 'text-yellow-400' :
                                                                                load.prefix === '감전보호' ? 'text-sky-400' :
                                                                                    load.prefix === 'On/Off' ? 'text-orange-400' :
                                                                                        load.prefix === '타이머' ? 'text-white' :
                                                                                            'text-gray-500'
                                                                                }`}>
                                                                                {load.prefix}
                                                                            </span>
                                                                        )}
                                                                        <span className={`font-medium mr-1 ${load.category === '동력' ? 'text-orange-500' :
                                                                            load.category === '전등' ? 'text-yellow-400' :
                                                                                load.category === 'PL' ? 'text-purple-400' :
                                                                                    load.category === '예비' ? 'text-gray-500' :
                                                                                        load.prefix === '감전보호' ? 'text-sky-400' :
                                                                                            'text-white'
                                                                            }`}>{load.category === 'PL' && load.connectedPanelId ? getNameById(load.connectedPanelId) || load.name : load.name}</span>
                                                                        <span className="text-gray-400">{load.qty}</span>
                                                                        <span className="text-gray-500 mx-0.5">[EA]</span>
                                                                        <span className="text-white font-medium">{(Number(load.va) || 0).toLocaleString()}</span>
                                                                        <span className="text-gray-500">[VA]</span>
                                                                    </div>
                                                                ))}
                                                                {right.loads.length > 3 && (
                                                                    <span className="flex-shrink-0 text-[10px] px-2 py-0.5 bg-gray-800 border border-gray-700 rounded text-yellow-400 font-medium">+{right.loads.length - 3}</span>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <span className="text-[10px] text-gray-600 italic">+ 부하 입력 클릭</span>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            {/* Right "부하" Label */}
                                            <td className="border-r border-gray-900 w-[40px] border-b-2 border-blue-500/20">
                                                <div className="flex items-center justify-center h-full text-[11px] text-gray-500 font-medium">부하</div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                        {/* Phase Raw Load Summary (수용률 미적용 순수 설비 합계) - UI 표시 전용, 계산 로직 무관 */}
                        <tr className="bg-black font-bold border-t-2 border-blue-500/20">
                            <td colSpan={16} className="border-r border-gray-900 p-2 text-right pr-4 text-[11px] text-[#d1d5db]">상별 총부하</td>
                            <td className="border-r border-gray-900 p-2 text-center text-[11px] text-[#d1d5db]">
                                {projectInfo.phase === '1Ø-2W'
                                    ? (selectedPhaseLine === 'L1' ? Math.round(phaseTotals.rawL1 || 0).toLocaleString() : '')
                                    : Math.round(phaseTotals.rawL1 || 0).toLocaleString()}
                            </td>
                            <td className="border-r border-gray-900 p-2 text-center text-[11px] text-[#d1d5db]">
                                {projectInfo.phase === '1Ø-2W'
                                    ? (selectedPhaseLine === 'L2' ? Math.round(phaseTotals.rawL2 || 0).toLocaleString() : '')
                                    : Math.round(phaseTotals.rawL2 || 0).toLocaleString()}
                            </td>
                            <td className="border-r border-gray-900 p-2 text-center text-[11px] text-[#d1d5db]">
                                {projectInfo.phase === '1Ø-2W'
                                    ? (selectedPhaseLine === 'L3' ? Math.round(phaseTotals.rawL3 || 0).toLocaleString() : '')
                                    : Math.round(phaseTotals.rawL3 || 0).toLocaleString()}
                            </td>
                            <td colSpan={16} className="border-r border-gray-900 p-2"></td>
                        </tr>
                        {/* Phase Load Summary (수용률 적용 합계) */}
                        <tr className="bg-black font-bold border-t border-gray-800">
                            <td colSpan={16} className="border-r border-gray-900 p-2 text-right pr-4 text-[11px] text-blue-400">상별 수용률</td>
                            <td className="border-r border-gray-900 p-2 text-center text-[11px] text-blue-400">
                                {projectInfo.phase === '1Ø-2W'
                                    ? (selectedPhaseLine === 'L1' ? Math.round(phaseTotals.l1).toLocaleString() : '')
                                    : Math.round(phaseTotals.l1).toLocaleString()}
                            </td>
                            <td className="border-r border-gray-900 p-2 text-center text-[11px] text-blue-400">
                                {projectInfo.phase === '1Ø-2W'
                                    ? (selectedPhaseLine === 'L2' ? Math.round(phaseTotals.l2).toLocaleString() : '')
                                    : Math.round(phaseTotals.l2).toLocaleString()}
                            </td>
                            <td className="border-r border-gray-900 p-2 text-center text-[11px] text-blue-400">
                                {projectInfo.phase === '1Ø-2W'
                                    ? (selectedPhaseLine === 'L3' ? Math.round(phaseTotals.l3).toLocaleString() : '')
                                    : Math.round(phaseTotals.l3).toLocaleString()}
                            </td>
                            <td colSpan={16} className="border-r border-gray-900 p-2"></td>
                        </tr>
                        <tr className="bg-black font-bold border-b-2 border-blue-500/20">
                            <td colSpan={16} className="border-r border-gray-900 p-2 text-right pr-4 text-[11px] text-green-400">상별 불평형</td>
                            <td className={`border-r border-gray-900 p-2 text-center text-[11px] ${imbalanceColor}`}>
                                {projectInfo.phase === '1Ø-2W'
                                    ? (selectedPhaseLine === 'L1' ? '100%' : '')
                                    : (totalLoad > 0 ? Math.round((phaseTotals.l1 / totalLoad) * 100) : 0) + '%'}
                            </td>
                            <td className={`border-r border-gray-900 p-2 text-center text-[11px] ${imbalanceColor}`}>
                                {projectInfo.phase === '1Ø-2W'
                                    ? (selectedPhaseLine === 'L2' ? '100%' : '')
                                    : (totalLoad > 0 ? Math.round((phaseTotals.l2 / totalLoad) * 100) : 0) + '%'}
                            </td>
                            <td className={`border-r border-gray-900 p-2 text-center text-[11px] ${imbalanceColor}`}>
                                {projectInfo.phase === '1Ø-2W'
                                    ? (selectedPhaseLine === 'L3' ? '100%' : '')
                                    : (totalLoad > 0 ? Math.round((phaseTotals.l3 / totalLoad) * 100) : 0) + '%'}
                            </td>
                            <td colSpan={16} className="border-r border-gray-900 p-2"></td>
                        </tr>

                        {/* Add Row Button */}
                        <tr className="hover:bg-gray-900/30 transition-colors">
                            <td colSpan={35} className="border-r border-gray-900 p-2 text-center">
                                <button
                                    onClick={() => {
                                        const newRow = getMaxRow() + 1;
                                        addCircuitAtRow('left', newRow);
                                        addCircuitAtRow('right', newRow);
                                    }}
                                    className="text-green-500 hover:text-green-400 text-[10px] uppercase tracking-widest flex items-center justify-center gap-2"
                                >
                                    <Plus size={14} /> Add New Row
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
};

import React, { useMemo } from 'react';
import { Plus, Check } from 'lucide-react';
import { CornerBorders, TableHeader, TableHeader2, InputCell, SearchablePanelCell, SelectCell } from '../ui/UpsUI';

const UpsTable = (props) => {
    // Dumb component: receives all data and handlers as props
    const {
        calculatedLoads = [],
        updatePowerLoad = () => { },
        handleBankSelection = () => { },
        addPowerLoad = () => { },
        panels = [],
        activeDropdownId = null,
        onOpenDropdown = () => { },
        dropdownPos = { top: 0, left: 0, width: 0 },
        selectedRows = [],
        handleContextMenu = () => { },
        handleGroupContextMenu = () => { },
        handleRowClick = () => { },
        handleGroupClick = () => { },
        demandFactorSummary = { avgPercent: 100, totalKva: 0, totalKw: 0 },
        draggedRow = null,
        dropTarget = null,
        handleDragStart = () => { },
        handleDragOver = () => { },
        handleDragLeave = () => { },
        handleDrop = () => { },
        handleDragEnd = () => { },
        projectInfo = {},
    } = props;

    // Grouping logic similar to GeneratorTable
    const groups = useMemo(() => {
        const result = [];
        let currentBankId = null;
        let currentGroup = null;

        calculatedLoads.forEach((load) => {
            const bId = load.bankId || `standalone-${load.id}`;
            if (currentBankId !== bId) {
                currentBankId = bId;
                currentGroup = {
                    groupId: bId,
                    bankId: load.bankId || '',
                    bankName: load.bankName || '',
                    bankMainType: load.bankMainType || 'MCCB',
                    bankMainP: load.bankMainP || '',
                    bankMainAF: load.bankMainAF || '',
                    bankMainAT: load.bankMainAT || '',
                    bankLocation: load.bankLocation || '',
                    bankCapacity: load.bankCapacity || '',
                    loads: []
                };
                result.push(currentGroup);
            }
            currentGroup.loads.push(load);
        });
        return result;
    }, [calculatedLoads]);

    return (
        <div className="border border-gray-900 bg-black relative overflow-hidden mb-8">
            <CornerBorders />
            <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full border-collapse min-w-[1460px] table-fixed">
                    {/* Balanced widths: UPS & PANEL identical, Classification restored */}
                    <colgroup>
                        <col className="w-[40px]" /><col className="w-[121px]" /><col className="w-[70px]" /><col className="w-[40px]" />
                        <col className="w-[50px]" /><col className="w-[50px]" /><col className="w-[171px]" /><col className="w-[40px]" /><col className="w-[108px]" />
                        <col className="w-[60px]" /><col className="w-[230px]" /><col className="w-[70px]" /><col className="w-[40px]" /><col className="w-[50px]" />
                        <col className="w-[50px]" /><col className="w-[65px]" /><col className="w-[50px]" /><col className="w-[75px]" /><col className="w-[55px]" />
                        <col className="w-[75px]" /><col className="w-[60px]" /><col className="w-[60px]" /><col className="w-[35px]" /><col className="w-[35px]" />
                    </colgroup>
                    <thead>
                        <tr className="border-b border-gray-900 bg-black/50">
                            <TableHeader label="NO." rowSpan={2} className="border-l-2 border-blue-500/20" />
                            <TableHeader label="PANEL" rowSpan={2} className="font-bold" />
                            <TableHeader label="MAIN BREAKER" colSpan={4} className="py-1 text-[#d1d5db]" />
                            <TableHeader label="LOCATION" rowSpan={2} />
                            <TableHeader label="NO." rowSpan={2} />
                            <TableHeader label="CIRCUIT" rowSpan={2} />
                            <TableHeader label="종류" rowSpan={1} className="py-1" />
                            <TableHeader label="부하내용" rowSpan={2} />
                            <TableHeader label="BREAKER" colSpan={4} className="py-1 text-[#d1d5db]" />
                            <TableHeader label="PHASE" rowSpan={2} />
                            <TableHeader label="VOLT" rowSpan={1} className="py-1" />
                            <TableHeader label="부하용량" rowSpan={1} className="py-1" />
                            <TableHeader label="수용률" rowSpan={1} className="py-1" />
                            <TableHeader label="수용부하" rowSpan={1} className="py-1" />
                            <TableHeader label="역률" rowSpan={1} className="py-1" />
                            <TableHeader label="효율" rowSpan={1} className="py-1" />
                            <TableHeader label="분류" colSpan={2} className="py-1 border-r-2 border-blue-500/20 text-[#d1d5db]" />
                        </tr>
                        <tr className="bg-black/30 border-b-2 border-gray-700">
                            <TableHeader label="TYPE" className="py-1 text-[11px] text-gray-500" />
                            <TableHeader label="P" className="py-1 text-[11px] text-gray-500" />
                            <TableHeader label="AF" className="py-1 text-[11px] text-gray-500" />
                            <TableHeader label="AT" className="py-1 text-[11px] text-gray-500" />
                            <TableHeader label="TYPE" className="py-1 text-[11px] text-gray-500" />
                            <TableHeader label="TYPE" className="py-1 text-[11px] text-gray-500" />
                            <TableHeader label="P" className="py-1 text-[11px] text-gray-500" />
                            <TableHeader label="AF" className="py-1 text-[11px] text-gray-500" />
                            <TableHeader label="AT" className="py-1 text-[11px] text-gray-500" />
                            <TableHeader label="[V]" className="py-1 text-[11px] text-gray-500" />
                            <TableHeader label="[kVA]" className="py-1 text-[11px] text-gray-500" />
                            <TableHeader label="[%]" className="py-1 text-[11px] text-gray-500" />
                            <TableHeader label="[kVA]" className="py-1 text-[11px] text-gray-500" />
                            <TableHeader label="cosθ" className="py-1 text-[11px] text-gray-500" />
                            <TableHeader label="η" className="py-1 text-[11px] text-gray-500" />
                            <TableHeader label="비상" className="py-1 text-[11px] text-gray-400 border-r border-gray-900 font-bold" />
                            <TableHeader label="정전" className="py-1 text-[11px] text-gray-400 border-r-2 border-blue-500/20 font-bold" />
                        </tr>
                    </thead>
                    <tbody>
                        {groups.map((group, groupIdx) => (
                            <React.Fragment key={group.groupId}>
                                {group.loads.map((load, idx) => {
                                    const isFromBank = !!load.bankId;
                                    const isSelected = selectedRows.includes(load.id);
                                    const isGroupSelected = group.loads.every(l => selectedRows.includes(l.id));
                                    const isDropTarget = dropTarget?.id === load.id;
                                    const dropPosition = dropTarget?.position;
                                    const isDragging = draggedRow === load.id || (selectedRows.includes(draggedRow) && selectedRows.includes(load.id));

                                    return (
                                        <tr key={load.id || idx} className={`group hover:bg-gray-900/50 border-b border-gray-900 h-[48px] transition-colors relative ${isDropTarget && dropPosition === 'above' ? 'border-t-2 border-t-lime-500' : ''} ${isDropTarget && dropPosition === 'below' ? 'border-b-2 border-b-lime-500' : ''} ${isDragging ? 'opacity-50' : ''}`}>
                                            {/* Bank Common Columns */}
                                            {idx === 0 && (
                                                <>
                                                    <td
                                                        rowSpan={group.loads.length}
                                                        className={`border-r border-gray-900 p-1 text-center text-[13px] border-l-2 border-blue-500/20 transition-colors cursor-grab active:cursor-grabbing ${isGroupSelected ? 'text-white bg-lime-500/10' : 'bg-black text-[#d1d5db] hover:text-white hover:bg-gray-800'}`}
                                                        onContextMenu={(e) => handleGroupContextMenu(e, group)}
                                                        onClick={(e) => handleGroupClick(group, e)}
                                                        draggable
                                                        onDragStart={(e) => handleDragStart(e, load.id, true)}
                                                        onDragOver={(e) => handleDragOver(e, load.id)}
                                                        onDragLeave={handleDragLeave}
                                                        onDrop={(e) => handleDrop(e, load.id)}
                                                        onDragEnd={handleDragEnd}
                                                    >
                                                        {groupIdx + 1}
                                                    </td>
                                                    <td rowSpan={group.loads.length} className={`border-r border-gray-900 p-0 transition-colors SearchablePanelCell-container ${isGroupSelected ? 'bg-lime-500/10' : 'bg-black'}`}>
                                                        <SearchablePanelCell
                                                            value={group.bankName}
                                                            onChange={(name, id) => {
                                                                if (id) {
                                                                    handleBankSelection(load.id, { id, name });
                                                                } else {
                                                                    updatePowerLoad(load.id, 'bankName', name);
                                                                }
                                                            }}
                                                            panels={panels}
                                                            activeDropdownId={activeDropdownId}
                                                            onOpen={(el) => onOpenDropdown(el, load.id)}
                                                            dropdownPos={dropdownPos}
                                                            loadId={load.id}
                                                            className="text-yellow-400 font-bold text-[13px]"
                                                        />
                                                    </td>
                                                    <td rowSpan={group.loads.length} className={`border-r border-gray-900 p-0 transition-colors ${isGroupSelected ? 'bg-lime-500/10' : 'bg-black'}`}>
                                                        <InputCell value={group.bankMainType} readOnly={true} className="text-blue-400 text-[13px] text-center" />
                                                    </td>
                                                    <td rowSpan={group.loads.length} className={`border-r border-gray-900 p-0 transition-colors ${isGroupSelected ? 'bg-lime-500/10' : 'bg-black'}`}>
                                                        <InputCell value={group.bankMainP} readOnly={true} className="text-blue-400 text-[13px] text-center" />
                                                    </td>
                                                    <td rowSpan={group.loads.length} className={`border-r border-gray-900 p-0 transition-colors ${isGroupSelected ? 'bg-lime-500/10' : 'bg-black'}`}>
                                                        <InputCell value={group.bankMainAF} readOnly={true} className="text-blue-400 text-[13px] text-center" />
                                                    </td>
                                                    <td rowSpan={group.loads.length} className={`border-r border-gray-900 p-0 transition-colors ${isGroupSelected ? 'bg-lime-500/10' : 'bg-black'}`}>
                                                        <div className="relative h-full w-full">
                                                            {(() => {
                                                                const groupMainAT = Number(group.bankMainAT) || 0;
                                                                const globalMainAT = Number(projectInfo?.mccbAT) || 0;
                                                                
                                                                // 1. 내부 회로가 뱅크 메인보다 큰 경우
                                                                const hasInternalViolation = group.loads.some(l => Number(l.at) >= groupMainAT && groupMainAT > 0);
                                                                // 2. 뱅크 메인이 UPS 메인보다 큰 경우
                                                                const isHigherThanGlobal = globalMainAT > 0 && groupMainAT >= globalMainAT;

                                                                if (hasInternalViolation || isHigherThanGlobal) {
                                                                    return (
                                                                        <div className="absolute bottom-[calc(100%-8px)] left-1/2 -translate-x-1/2 z-50 flex flex-col items-center animate-bounce pointer-events-none drop-shadow-md">
                                                                            <div className="bg-red-500/85 backdrop-blur-sm text-white text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap border border-white/20 relative">
                                                                                Chk.
                                                                                <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-t-[8px] border-t-red-500/85"></div>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                }
                                                                return null;
                                                            })()}
                                                            <InputCell
                                                                value={group.bankMainAT}
                                                                readOnly={true}
                                                                className={`text-[13px] text-center ${(() => {
                                                                    const groupMainAT = Number(group.bankMainAT) || 0;
                                                                    const globalMainAT = Number(projectInfo?.mccbAT) || 0;
                                                                    const hasInternalViolation = group.loads.some(l => Number(l.at) >= groupMainAT && groupMainAT > 0);
                                                                    const isHigherThanGlobal = globalMainAT > 0 && groupMainAT >= globalMainAT;
                                                                    
                                                                    return (hasInternalViolation || isHigherThanGlobal) ? 'text-red-500 font-bold' : 'text-blue-400';
                                                                })()}`}
                                                            />
                                                        </div>
                                                    </td>
                                                    <td rowSpan={group.loads.length} className={`border-r border-gray-900 p-0 transition-colors ${isGroupSelected ? 'bg-lime-500/10' : 'bg-black'}`}>
                                                        <InputCell value={group.bankLocation} onChange={(v) => updatePowerLoad(load.id, 'bankLocation', v)} className="text-[#d1d5db] text-[13px]" />
                                                    </td>
                                                </>
                                            )}

                                            {/* Circuit-specific Columns */}
                                            <td
                                                className={`border-r border-gray-900 p-1 text-center text-[13px] transition-colors cursor-grab active:cursor-grabbing ${isSelected ? 'text-white bg-lime-500/10' : 'text-[#d1d5db] hover:text-white hover:bg-gray-800'}`}
                                                onContextMenu={(e) => handleContextMenu(e, load.id)}
                                                onClick={(e) => handleRowClick(load.id, e)}
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, load.id, false)}
                                                onDragOver={(e) => handleDragOver(e, load.id)}
                                                onDragLeave={handleDragLeave}
                                                onDrop={(e) => handleDrop(e, load.id)}
                                                onDragEnd={handleDragEnd}
                                            >
                                                {idx + 1}
                                            </td>
                                            <td className={`border-r border-gray-900 p-0 ${isSelected ? 'bg-lime-500/10' : ''}`}>
                                                <InputCell
                                                    value={load.circuit}
                                                    readOnly={isFromBank}
                                                    onChange={(v) => updatePowerLoad(load.id, 'circuit', v)}
                                                    className={`${isFromBank ? 'text-[#d1d5db]' : 'text-yellow-500'} text-[13px]`}
                                                />
                                            </td>
                                            <td className={`border-r border-gray-900 p-0 ${isSelected ? 'bg-lime-500/10' : ''}`}>
                                                <InputCell
                                                    value={load.loadType || ''}
                                                    readOnly={isFromBank}
                                                    onChange={(v) => updatePowerLoad(load.id, 'loadType', v)}
                                                    className={`${isFromBank ? 'text-[#d1d5db]' : 'text-gray-400'} text-[13px]`}
                                                />
                                            </td>
                                            <td className={`border-r border-gray-900 p-0 ${isSelected ? 'bg-lime-500/10' : ''}`}>
                                                <InputCell
                                                    value={load.equipmentName}
                                                    readOnly={isFromBank}
                                                    onChange={(v) => updatePowerLoad(load.id, 'equipmentName', v)}
                                                    className={`${isFromBank ? 'text-[#d1d5db] italic' : 'text-[#d1d5db]'} text-[13px] text-left px-3`}
                                                    title={load.equipmentName}
                                                />
                                            </td>
                                            <td className={`border-r border-gray-900 p-0 ${isSelected ? 'bg-lime-500/10' : ''}`}>
                                                <InputCell
                                                    value={load.breakerType || 'MCCB'}
                                                    onChange={(v) => updatePowerLoad(load.id, 'breakerType', v)}
                                                    className="text-[#d1d5db] text-[13px]"
                                                />
                                            </td>
                                            <td className={`border-r border-gray-900 p-0 ${isSelected ? 'bg-lime-500/10' : ''}`}>
                                                <div className="flex flex-col h-full items-center justify-center">
                                                    <InputCell
                                                        value={load.p || '3'}
                                                        onChange={(v) => updatePowerLoad(load.id, 'p', v)}
                                                        readOnly={isFromBank}
                                                        className="text-[#d1d5db] text-[13px] text-center"
                                                        heightClass={load.p === '2' ? "h-[24px]" : "h-[48px]"}
                                                    />
                                                    {load.p === '2' && (
                                                        <div className="w-full h-[24px] flex items-center justify-center border-t border-gray-900">
                                                            <InputCell
                                                                value={load.phaseLine || 'L1'}
                                                                onChange={(v) => updatePowerLoad(load.id, 'phaseLine', v)}
                                                                readOnly={isFromBank}
                                                                className="text-sky-400 text-[11px] font-bold text-center"
                                                                heightClass="h-[24px]"
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className={`border-r border-gray-900 p-0 ${isSelected ? 'bg-lime-500/10' : ''}`}>
                                                <InputCell
                                                    value={load.af || ''}
                                                    onChange={(v) => updatePowerLoad(load.id, 'af', v)}
                                                    className="text-[#d1d5db] text-[13px] text-center"
                                                />
                                            </td>
                                            <td className={`border-r border-gray-900 p-0 ${isSelected ? 'bg-lime-500/10' : ''}`}>
                                                <div className="relative h-full w-full">
                                                    {(() => {
                                                        const branchAT = Number(load.at) || 0;
                                                        const mainAT = Number(load.bankMainAT) || 0;
                                                        const isAtHigherThanMain = mainAT > 0 && branchAT >= mainAT;

                                                        if (isAtHigherThanMain) {
                                                            return (
                                                                <div className="absolute bottom-[calc(100%-8px)] left-1/2 -translate-x-1/2 z-50 flex flex-col items-center animate-bounce pointer-events-none drop-shadow-md">
                                                                    <div className="bg-red-500/85 backdrop-blur-sm text-white text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap border border-white/20 relative">
                                                                        Chk.
                                                                        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-t-[8px] border-t-red-500/85"></div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        }
                                                        return null;
                                                    })()}
                                                    <InputCell
                                                        value={load.at || ''}
                                                        onChange={(v) => updatePowerLoad(load.id, 'at', v)}
                                                        className={`text-[13px] text-center ${(() => {
                                                            const branchAT = Number(load.at) || 0;
                                                            const mainAT = Number(load.bankMainAT) || 0;
                                                            return (mainAT > 0 && branchAT >= mainAT) ? 'text-red-500 font-bold' : 'text-[#d1d5db]';
                                                        })()}`}
                                                    />
                                                </div>
                                            </td>
                                            <td className={`border-r border-gray-900 p-0 ${isSelected ? 'bg-lime-500/10' : ''}`}>
                                                <InputCell
                                                    value={load.phase}
                                                    readOnly={isFromBank}
                                                    onChange={(v) => updatePowerLoad(load.id, 'phase', v)}
                                                    className={`${isFromBank ? 'text-[#d1d5db]' : 'text-[#d1d5db]'} text-[13px]`}
                                                />
                                            </td>
                                            <td className={`border-r border-gray-900 p-0 ${isSelected ? 'bg-lime-500/10' : ''}`}>
                                                <InputCell
                                                    value={load.voltage}
                                                    readOnly={isFromBank}
                                                    onChange={(v) => updatePowerLoad(load.id, 'voltage', v)}
                                                    className={`${isFromBank ? 'text-[#d1d5db]' : 'text-[#d1d5db]'} text-[13px]`}
                                                />
                                            </td>
                                            <td className={`border-r border-gray-900 p-0 ${isSelected ? 'bg-lime-500/10' : ''}`}>
                                                <InputCell
                                                    value={load.loadType === '예비' ? '-' : load.kva}
                                                    readOnly={isFromBank || load.loadType === '예비'}
                                                    onChange={(v) => updatePowerLoad(load.id, 'kva', v)}
                                                    className={`${isFromBank ? 'text-green-400' : 'text-green-400'} text-[13px]`}
                                                />
                                            </td>
                                            <td className={`border-r border-gray-900 p-0 ${isSelected ? 'bg-lime-500/10' : ''}`}>
                                                <InputCell 
                                                    value={load.loadType === '예비' ? '-' : load.demandFactor} 
                                                    readOnly={load.loadType === '예비'}
                                                    onChange={(v) => updatePowerLoad(load.id, 'demandFactor', v)} 
                                                    className="text-yellow-400 text-[13px]" 
                                                />
                                            </td>
                                            <td className={`border-r border-gray-900 p-0 text-center text-[13px] ${load.loadType === '예비' ? 'text-gray-500' : (parseFloat(load.demandFactor) || 100) !== 100 ? 'text-blue-400' : 'text-[#d1d5db]'} ${isSelected ? 'bg-lime-500/10' : ''}`}>
                                                {load.loadType === '예비' ? '-' : load.demandKva}
                                            </td>
                                            <td className={`border-r border-gray-900 p-0 ${isSelected ? 'bg-lime-500/10' : ''}`}>
                                                <InputCell 
                                                    value={load.loadType === '예비' ? '-' : load.pf} 
                                                    onChange={(v) => updatePowerLoad(load.id, 'pf', v)} 
                                                    className={`${isFromBank ? 'text-[#d1d5db]' : 'text-[#d1d5db]'} text-[13px]`} 
                                                    readOnly={isFromBank || load.loadType === '예비'} 
                                                />
                                            </td>
                                            <td className={`border-r border-gray-900 p-0 ${isSelected ? 'bg-lime-500/10' : ''}`}>
                                                <InputCell 
                                                    value={load.loadType === '예비' ? '-' : load.eff} 
                                                    onChange={(v) => updatePowerLoad(load.id, 'eff', v)} 
                                                    className={`${isFromBank ? 'text-[#d1d5db]' : 'text-[#d1d5db]'} text-[13px]`} 
                                                    readOnly={isFromBank || load.loadType === '예비'} 
                                                />
                                            </td>
                                            <td className={`border-r border-gray-900 p-0 text-center ${isSelected ? 'bg-lime-500/10' : ''}`}>
                                                <button
                                                    onClick={() => updatePowerLoad(load.id, 'isFire', !load.isFire)}
                                                    className={`w-full h-full flex items-center justify-center transition-colors ${load.isFire ? 'text-red-500 bg-red-500/20 shadow-[inset_0_0_10px_rgba(239,68,68,0.2)]' : 'text-gray-800'}`}
                                                >
                                                    <div className={`w-4 h-4 border-2 flex items-center justify-center transition-all ${load.isFire ? 'border-red-500 bg-red-500/10' : 'border-gray-800'}`}>
                                                        {load.isFire && <Check size={12} strokeWidth={4} />}
                                                    </div>
                                                </button>
                                            </td>
                                            <td className={`border-r-2 border-blue-500/20 p-0 text-center ${isSelected ? 'bg-lime-500/10' : ''}`}>
                                                <button
                                                    onClick={() => updatePowerLoad(load.id, 'isBlackout', !load.isBlackout)}
                                                    className={`w-full h-full flex items-center justify-center transition-colors ${load.isBlackout ? 'text-blue-500 bg-blue-500/20 shadow-[inset_0_0_10px_rgba(59,130,246,0.2)]' : 'text-gray-800'}`}
                                                >
                                                    <div className={`w-4 h-4 border-2 flex items-center justify-center transition-all ${load.isBlackout ? 'border-blue-500 bg-blue-500/10' : 'border-gray-800'}`}>
                                                        {load.isBlackout && <Check size={12} strokeWidth={4} />}
                                                    </div>
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </React.Fragment>
                        ))}
                        <tr className="hover:bg-gray-900/30 border-t border-gray-900">
                            <td colSpan={24} className="p-2 border-l border-r border-b border-gray-900 border-l-2 border-blue-500/20 border-r-2 border-blue-500/20">
                                <div className="flex items-center gap-4 pl-2">
                                    <button onClick={addPowerLoad} className="flex items-center gap-2 text-yellow-500 hover:text-yellow-400 text-[12px] font-bold uppercase tracking-widest">
                                        <Plus size={14} /> ADD CIRCUIT
                                    </button>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default UpsTable;

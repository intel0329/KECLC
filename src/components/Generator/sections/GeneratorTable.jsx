import React from 'react';
import { Plus, Check } from 'lucide-react';
import { CornerBorders, TableHeader, TableHeader2, InputCell, SearchablePanelCell, SelectCell } from '../ui/GeneratorUI';

const GeneratorTable = (props) => {
    const {
        calculatedLoads,
        selectedRows,
        dropTarget,
        draggedRow,
        handleDragStart,
        handleDragOver,
        handleDragLeave,
        handleDrop,
        handleDragEnd,
        handleContextMenu,
        handleGroupContextMenu,
        handleRowClick,
        handleGroupClick,
        handleBankSelection,
        updatePowerLoad,
        panels,
        activeDropdownId,
        updateDropdownPosition,
        dropdownPos,
        panelId,
        globalUsedPanelIds,
        addPowerLoad
    } = props;
    const { maxBlackoutKw, maxFireKw } = React.useMemo(() => {
        const motors = calculatedLoads.filter(l => (l.type === 'MOTOR' || l.type === 'PUMP') && !l.isDistributionLoad && l.type !== 'SPARE');
        const blackoutMotors = motors.filter(l => l.isBlackout);
        const fireMotors = motors.filter(l => l.isFire);
        return {
            maxBlackoutKw: blackoutMotors.length > 0 ? Math.max(...blackoutMotors.map(l => parseFloat(l.startingKw) || 0)) : 0,
            maxFireKw: fireMotors.length > 0 ? Math.max(...fireMotors.map(l => parseFloat(l.startingKw) || 0)) : 0
        };
    }, [calculatedLoads]);

    return (
        <div className="border border-gray-900 bg-black relative overflow-hidden mb-8">
            <CornerBorders />
            <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full border-collapse min-w-[1800px] table-fixed">
                    <colgroup>
                        <col className="w-[40px]" /><col className="w-[90px]" /><col className="w-[50px]" /><col className="w-[135px]" /><col className="w-[40px]" />
                        <col className="w-[80px]" /><col className="w-[55px]" /><col className="w-[195px]" /><col className="w-[60px]" /><col className="w-[60px]" />
                        <col className="w-[62px]" /><col className="w-[62px]" /><col className="w-[62px]" /><col className="w-[67px]" /><col className="w-[67px]" />
                        <col className="w-[70px]" /><col className="w-[55px]" /><col className="w-[55px]" /><col className="w-[55px]" /><col className="w-[55px]" /><col className="w-[55px]" />
                        <col className="w-[55px]" /><col className="w-[55px]" /><col className="w-[45px]" /><col className="w-[45px]" /><col className="w-[45px]" />
                    </colgroup>
                    <thead>
                        <tr className="border-b border-gray-900 bg-black/50">
                            <TableHeader label="NO." rowSpan={2} className="border-l-2 border-blue-500/20" />
                            <TableHeader label="PANEL" rowSpan={2} />
                            <TableHeader label="TYPE" rowSpan={2} />
                            <TableHeader label="LOCATION" rowSpan={2} />
                            <TableHeader label="NO." rowSpan={2} />
                            <TableHeader label="CIRCUIT" rowSpan={2} />
                            <TableHeader label="종류" rowSpan={1} className="py-1" />
                            <TableHeader label="부하내용" rowSpan={2} />
                            <TableHeader label="PHASE" rowSpan={2} />
                            <TableHeader label="VOLT" rowSpan={1} className="py-1" />
                            <TableHeader label="부하용량" colSpan={2} className="py-1" />
                            <TableHeader label="수용률" rowSpan={1} className="py-1" />
                            <TableHeader label="수용부하" colSpan={2} className="py-1" />
                            <TableHeader label="기동용량" rowSpan={1} className="py-1" />
                            <TableHeader label="용량계수" colSpan={2} className="py-1" />
                            <TableHeader label="기동배율 및 계수" colSpan={3} className="py-1" />
                             <TableHeader label="역률" rowSpan={1} className="py-1" />
                             <TableHeader label="효율" rowSpan={1} className="py-1" />
                             <TableHeader label="분류" colSpan={3} className="py-1 border-r-2 border-blue-500/20 text-blue-400" />
                         </tr>
                        <tr className="bg-black/30 border-b-2 border-gray-700">
                            <TableHeader label="TYPE" className="py-1 text-[11px] text-gray-500" />
                            <TableHeader label="[V]" className="py-1 text-[11px] text-gray-500" />
                            <TableHeader label="[kVA]" className="py-1 text-[11px] text-gray-500" />
                            <TableHeader label="[kW]" className="py-1 text-[11px] text-gray-500" />
                            <TableHeader label="[%]" className="py-1 text-[11px] text-gray-500" />
                            <TableHeader label="[kVA]" className="py-1 text-[11px] text-gray-500" />
                            <TableHeader label="[kW]" className="py-1 text-[11px] text-gray-500" />
                            <TableHeader label="[kVA]" className="py-1 text-[11px] text-gray-500" />
                            <TableHeader label="α" className="py-1 text-[11px] text-gray-500" />
                            <TableHeader label="α값" className="py-1 text-[11px] text-gray-500" />
                            <TableHeader label="β" className="py-1 text-[11px] text-gray-500" />
                            <TableHeader label="β값" className="py-1 text-[11px] text-gray-500" />
                            <TableHeader label="C" className="py-1 text-[11px] text-gray-500" />
                             <TableHeader label="cosθ" className="py-1 text-[11px] text-gray-500" />
                             <TableHeader label="η" className="py-1 text-[11px] text-gray-500" />
                             <TableHeader label="비상" className="py-1 text-[11px] text-gray-500" />
                             <TableHeader label="정전" className="py-1 text-[11px] text-gray-500 border-r border-gray-900" />
                             <TableHeader label="순차" className="py-1 text-[11px] text-gray-500 border-r-2 border-blue-500/20" />
                         </tr>
                    </thead>
                    <tbody className="outline-none" tabIndex={0}>
                        {(() => {
                            const groups = [];
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
                                        bankType: load.bankType || '',
                                        bankLocation: load.bankLocation || '',
                                        loads: []
                                    };
                                    groups.push(currentGroup);
                                }
                                currentGroup.loads.push(load);
                            });

                            return groups.map((group, groupIdx) => (
                                <React.Fragment key={group.groupId}>
                                    {group.loads.map((load, idx) => {
                                        const isSelected = selectedRows.includes(load.id);
                                        const isGroupSelected = group.loads.every(l => selectedRows.includes(l.id));
                                        const isDropTarget = dropTarget?.id === load.id;
                                        const dropPosition = dropTarget?.position;
                                        const isDragging = draggedRow === load.id;
                                        const sKw = parseFloat(load.startingKw) || 0;
                                        const isMaxBlackout = (load.isBlackout && sKw === maxBlackoutKw && maxBlackoutKw > 0);
                                        const isMaxFire = (load.isFire && sKw === maxFireKw && maxFireKw > 0);


                                        return (
                                            <tr
                                                key={load.id}
                                                className={`group transition-colors h-[48px] relative border-l-2 border-r-2 border-l-transparent border-r-transparent border-b border-gray-900 ${idx === 0 ? 'border-t border-gray-700' : ''} hover:bg-gray-900/50 ${isDropTarget && dropPosition === 'above' ? 'border-t-2 border-t-lime-500' : ''} ${isDropTarget && dropPosition === 'below' ? 'border-b-2 border-b-lime-500' : ''} ${isDragging ? 'opacity-50' : ''} focus-within:z-[100] z-[1]`}
                                            >
                                                {idx === 0 && (
                                                    <>
                                                        {/* NO. (Group) */}
                                                        <td rowSpan={group.loads.length}
                                                            className={`border-r border-gray-900 border-b border-gray-900 p-1 text-center ${isGroupSelected ? 'text-white bg-lime-500/10' : 'bg-black text-[#d1d5db]'} cursor-grab active:cursor-grabbing hover:text-white transition-colors select-none text-[13px] border-l-2 border-blue-500/20`}
                                                            draggable
                                                            onDragStart={(e) => handleDragStart(e, group.loads[0].id, true)}
                                                            onDragOver={(e) => handleDragOver(e, group.loads[0].id)}
                                                            onDragLeave={handleDragLeave}
                                                            onDrop={(e) => handleDrop(e, group.loads[0].id)}
                                                            onDragEnd={handleDragEnd}
                                                            onContextMenu={(e) => handleGroupContextMenu(e, group)}
                                                            onClick={(e) => handleGroupClick(group, e)}
                                                        >
                                                            {groupIdx + 1}
                                                        </td>
                                                        {/* PANEL */}
                                                        <td rowSpan={group.loads.length} 
                                                            className={`border-r border-gray-900 border-b border-gray-900 p-0 SearchablePanelCell-container ${isGroupSelected ? 'bg-lime-500/10' : 'bg-black'}`}
                                                            onClick={(e) => handleGroupClick(group, e)}
                                                            onContextMenu={(e) => handleGroupContextMenu(e, group)}
                                                        >
                                                            <SearchablePanelCell
                                                                loadId={`bank-${group.groupId}`}
                                                                value={group.bankName}
                                                                onChange={(name, panel) => handleBankSelection(load.id, name, panel)}
                                                                panels={panels}
                                                                className="text-yellow-400 placeholder:text-yellow-500 placeholder:opacity-100 font-bold text-[13px]"
                                                                activeDropdownId={activeDropdownId}
                                                                onOpen={updateDropdownPosition}
                                                                dropdownPos={dropdownPos}
                                                                excludeId={panelId}
                                                                globalUsedPanelIds={globalUsedPanelIds}
                                                                currentId={group.bankId}
                                                                placeholder="PANEL NO."
                                                            />
                                                        </td>
                                                        {/* TYPE */}
                                                        <td rowSpan={group.loads.length} className={`border-r border-gray-900 border-b border-gray-900 p-0 ${isGroupSelected ? 'bg-lime-500/10' : 'bg-black'}`}>
                                                            <InputCell value={group.bankType} onChange={(v) => updatePowerLoad(load.id, 'bankType', v)} className="text-purple-400 font-bold text-[13px]" />
                                                        </td>
                                                        {/* LOCATION */}
                                                        <td rowSpan={group.loads.length} className={`border-r border-gray-900 border-b border-gray-900 p-0 ${isGroupSelected ? 'bg-lime-500/10' : 'bg-black'}`}>
                                                            <InputCell value={group.bankLocation} onChange={(v) => updatePowerLoad(load.id, 'bankLocation', v)} className="text-[#d1d5db] text-[13px]" />
                                                        </td>
                                                    </>
                                                )}
                                                {/* NO. (Inner) */}
                                                <td
                                                    className={`border-r border-gray-900 p-1 text-center ${isSelected ? 'text-white bg-lime-500/10' : 'text-[#d1d5db]'} cursor-grab active:cursor-grabbing hover:text-white transition-colors select-none text-[13px]`}
                                                    draggable
                                                    onDragStart={(e) => handleDragStart(e, load.id, false)}
                                                    onDragOver={(e) => handleDragOver(e, load.id)}
                                                    onDragLeave={handleDragLeave}
                                                    onDrop={(e) => handleDrop(e, load.id)}
                                                    onDragEnd={handleDragEnd}
                                                    onContextMenu={(e) => handleContextMenu(e, load.id)}
                                                    onClick={(e) => handleRowClick(load.id, e)}
                                                >
                                                    {idx + 1}
                                                </td>
                                                {/* CIRCUIT */}
                                                <td className={`border-r border-gray-900 p-0 ${isSelected ? 'bg-lime-500/10' : ''}`}>
                                                    <InputCell value={load.circuit} onChange={(v) => updatePowerLoad(load.id, 'circuit', v)} className="text-yellow-500 text-[13px]" />
                                                </td>
                                                {/* 종류 TYPE */}
                                                <td className={`border-r border-gray-900 p-0 ${isSelected ? 'bg-lime-500/10' : ''}`}>
                                                    <InputCell value={load.type} onChange={(v) => updatePowerLoad(load.id, 'type', v)} className="text-[#d1d5db] text-[13px]" />
                                                </td>
                                                {/* 부하내용 */}
                                                <td className={`border-r border-gray-900 p-0 SearchablePanelCell-container ${isSelected ? 'bg-lime-500/10' : ''}`}>
                                                    {group.bankId ? (
                                                        load.isDistributionLoad ? (
                                                            <InputCell 
                                                                value={load.equipmentName} 
                                                                onChange={(v) => updatePowerLoad(load.id, 'equipmentName', v)} 
                                                                className="text-[#d1d5db] text-[13px]" 
                                                            />
                                                        ) : (
                                                            <InputCell value={load.equipmentName} onChange={() => {}} readOnly={true} className="text-[#d1d5db] text-[13px]" />
                                                        )
                                                    ) : (
                                                        <SearchablePanelCell
                                                            loadId={load.id}
                                                            value={load.equipmentName}
                                                            onChange={(name, panel) => updatePowerLoad(load.id, 'equipmentName', name, panel)}
                                                            panels={panels}
                                                            className="text-[#d1d5db] text-[13px]"
                                                            activeDropdownId={activeDropdownId}
                                                            onOpen={updateDropdownPosition}
                                                            dropdownPos={dropdownPos}
                                                            excludeId={panelId}
                                                            globalUsedPanelIds={globalUsedPanelIds}
                                                            currentId={load.connectedPanelId}
                                                        />
                                                    )}
                                                </td>
                                                {/* PHASE */}
                                                <td className={`border-r border-gray-900 p-0 ${isSelected ? 'bg-lime-500/10' : ''}`}>
                                                    <InputCell value={load.phase} onChange={(v) => updatePowerLoad(load.id, 'phase', v)} className="text-[#d1d5db] text-[12px]" />
                                                </td>
                                                {/* VOLTAGE */}
                                                <td className={`border-r border-gray-900 p-0 ${isSelected ? 'bg-lime-500/10' : ''}`}>
                                                    <InputCell value={load.voltage} onChange={(v) => updatePowerLoad(load.id, 'voltage', v)} className="text-[#d1d5db] text-[13px]" />
                                                </td>
                                                {/* 부하 kVA */}
                                                <td className={`border-r border-gray-900 p-0 ${isSelected ? 'bg-lime-500/10' : ''}`}>
                                                    <InputCell value={load.kva} onChange={(v) => updatePowerLoad(load.id, 'kva', v)} className="text-green-400 text-[13px]" />
                                                </td>
                                                {/* 부하 kW */}
                                                <td className={`border-r border-gray-900 p-0 ${isSelected ? 'bg-lime-500/10' : ''}`}>
                                                    <InputCell value={load.kw} onChange={(v) => updatePowerLoad(load.id, 'kw', v)} className="text-green-400 text-[13px]" />
                                                </td>
                                                {/* 수용률 (%) */}
                                                <td className={`border-r border-gray-900 p-0 ${isSelected ? 'bg-lime-500/10' : ''}`}>
                                                    <InputCell value={load.demandFactor} onChange={(v) => updatePowerLoad(load.id, 'demandFactor', v)} className="text-yellow-400 text-[13px]" />
                                                </td>
                                                {/* 수용 kVA */}
                                                <td className={`border-r border-gray-900 p-0 text-center text-[13px] ${isSelected ? 'bg-lime-500/10' : ''} ${(Number(load.demandFactor) || 100) !== 100 ? 'text-blue-400' : 'text-[#d1d5db]'}`}>
                                                    {load.demandKva}
                                                </td>
                                                {/* 수용 kW */}
                                                <td className={`border-r border-gray-900 p-0 text-center text-[13px] ${isSelected ? 'bg-lime-500/10' : ''} ${(Number(load.demandFactor) || 100) !== 100 ? 'text-blue-400' : 'text-[#d1d5db]'}`}>
                                                    {load.demandKw}
                                                </td>
                                                {/* 기동용량 */}
                                                 <td className={`border-r border-gray-900 p-0 ${
                                                     isSelected ? 'bg-lime-500/10' : 
                                                     (isMaxBlackout && isMaxFire) ? 'bg-orange-600/20' : 
                                                     isMaxBlackout ? 'bg-blue-600/20' : 
                                                     isMaxFire ? 'bg-red-600/20' : ''
                                                 }`}>
                                                    <InputCell value={load.startingKw} onChange={(v) => updatePowerLoad(load.id, 'startingKw', v)} className="text-orange-400 text-[13px]" />
                                                </td>
                                                {/* alpha label */}
                                                 <td className={`border-r border-gray-900 p-0 ${isSelected ? 'bg-lime-500/10' : ''}`}>
                                                     {load.alphaLabel === '-' ? (
                                                         <div className="flex items-center justify-center h-[48px] w-full text-gray-500 text-[12px]">-</div>
                                                     ) : load.hasOwnValue ? (
                                                         <div className="flex items-center justify-center h-[48px] w-full text-[#d1d5db] text-[12px]">설계값</div>
                                                     ) : (
                                                         <SelectCell 
                                                             value={load.alphaLabel || '표준형'} 
                                                             options={['표준형', '고효율']} 
                                                             onChange={(v) => updatePowerLoad(load.id, 'alphaLabel', v)} 
                                                             className="text-yellow-400 text-[12px]" 
                                                             hideArrow={true}
                                                         />
                                                     )}
                                                 </td>
                                                 {/* alpha value */}
                                                 <td className={`border-r border-gray-900 p-0 text-center text-[#d1d5db] text-[13px] ${isSelected ? 'bg-lime-500/10' : ''}`}>
                                                     {load.alphaValue}
                                                 </td>
                                                {/* beta label */}
                                                <td className={`border-r border-gray-900 p-0 ${isSelected ? 'bg-lime-500/10' : ''}`}>
                                                    <InputCell value={load.betaLabel} onChange={(v) => updatePowerLoad(load.id, 'betaLabel', v)} className="text-[#d1d5db] text-[12px]" />
                                                </td>
                                                {/* beta value */}
                                                <td className={`border-r border-gray-900 p-0 ${isSelected ? 'bg-lime-500/10' : ''}`}>
                                                    <InputCell value={load.betaValue} onChange={(v) => updatePowerLoad(load.id, 'betaValue', v)} className="text-yellow-500 text-[13px]" />
                                                </td>
                                                {/* c value */}
                                                <td className={`border-r border-gray-900 p-0 text-center text-blue-400 font-bold text-[13px] ${isSelected ? 'bg-lime-500/10' : ''}`}>
                                                    {load.cValue || '1.00'}
                                                </td>
                                                 {/* pf */}
                                                <td className={`border-r border-gray-900 p-0 ${isSelected ? 'bg-lime-500/10' : ''}`}>
                                                    <InputCell value={load.pf} onChange={(v) => updatePowerLoad(load.id, 'pf', v)} className="text-[#d1d5db] text-[13px]" />
                                                </td>
                                                {/* eff */}
                                                <td className={`border-r border-gray-900 p-0 ${isSelected ? 'bg-lime-500/10' : ''}`}>
                                                    <InputCell value={load.eff} onChange={(v) => updatePowerLoad(load.id, 'eff', v)} className="text-[#d1d5db] text-[13px]" />
                                                </td>
                                                {/* 하제 */}
                                                <td className={`border-r border-gray-900 p-0 text-center ${isSelected ? 'bg-lime-500/10' : ''}`}>
                                                    <button 
                                                        onClick={() => updatePowerLoad(load.id, 'isFire', !load.isFire)}
                                                        className={`w-full h-full flex items-center justify-center transition-colors ${load.isFire ? 'text-red-500 bg-red-500/10' : 'text-gray-800'}`}
                                                    >
                                                        {load.isFire ? <Check size={16} strokeWidth={4} /> : 'N'}
                                                    </button>
                                                </td>
                                                {/* 정전 */}
                                                <td className={`border-r border-gray-900 p-0 text-center ${isSelected ? 'bg-lime-500/10' : ''}`}>
                                                    <button 
                                                        onClick={() => updatePowerLoad(load.id, 'isBlackout', !load.isBlackout)}
                                                        className={`w-full h-full flex items-center justify-center transition-colors ${load.isBlackout ? 'text-blue-500 bg-blue-500/10' : 'text-gray-800'}`}
                                                    >
                                                        {load.isBlackout ? <Check size={16} strokeWidth={4} /> : 'N'}
                                                    </button>
                                                </td>
                                                {/* 순차 */}
                                                <td className={`border-r-2 border-blue-500/20 p-0 text-center ${isSelected ? 'bg-lime-500/10' : ''}`}>
                                                    <button 
                                                        onClick={() => updatePowerLoad(load.id, 'isSequential', !load.isSequential)}
                                                        className={`w-full h-full flex items-center justify-center transition-colors ${load.isSequential ? 'text-white bg-white/10' : 'text-gray-800'}`}
                                                    >
                                                        {load.isSequential ? <Check size={16} strokeWidth={4} /> : 'N'}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </React.Fragment>
                            ))})()}
                        <tr className="hover:bg-gray-900/30 border-t border-gray-900">
                             <td colSpan={26} className="p-2 border-l border-r border-b border-gray-900 border-l-2 border-blue-500/20 border-r-2 border-blue-500/20">
                                <div className="flex items-center gap-4 pl-2">
                                    <button
                                        onClick={addPowerLoad}
                                        className="flex items-center gap-2 text-yellow-500 hover:text-yellow-400 text-[12px] font-bold uppercase tracking-widest"
                                    >
                                        <Plus size={14} />
                                        ADD CIRCUIT
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

export default GeneratorTable;

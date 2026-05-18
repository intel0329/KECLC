import React from 'react';
import { Plus } from 'lucide-react';
import { CornerBorders, TableHeader, TableHeader2, InputCell, SearchablePanelCell, SelectCell } from '../ui/CapacityUI';

const CapacityTable = (props) => {
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
        handleTRSelection,
        updatePowerLoad,
        panels,
        panelsFullData,
        activeDropdownId,
        updateDropdownPosition,
        dropdownPos,
        panelId,
        globalUsedPanelIds,
        addPowerLoad
    } = props;

    return (
        <div className="border border-gray-900 bg-black relative overflow-hidden mb-8">
            <CornerBorders />
            <div className="overflow-x-auto">
                <table className="w-full border-collapse min-w-[1760px] table-fixed">
                    <colgroup><col className="w-[40px]" /><col className="w-[120px]" /><col className="w-[60px]" /><col className="w-[80px]" /><col className="w-[40px]" /><col className="w-[80px]" /><col className="w-[120px]" /><col className="w-[200px]" /><col className="w-[80px]" /><col className="w-[80px]" /><col className="w-[80px]" /><col className="w-[80px]" /><col className="w-[80px]" /><col className="w-[80px]" /><col className="w-[80px]" /><col className="w-[80px]" /><col className="w-[80px]" /><col className="w-[80px]" /><col className="w-[40px]" /><col className="w-[60px]" /><col className="w-[60px]" /><col className="w-[60px]" /><col className="w-[80px]" /></colgroup>
                    <thead>
                        <tr className="border-b border-gray-900 h-[52px]">
                            <th colSpan={23} className="px-4 py-3 text-[12px] font-semibold text-gray-300 uppercase tracking-[0.2em] text-left border-l-2 border-r-2 border-blue-500/20">
                                <span className="font-bold uppercase tracking-[0.2em] text-white">Electrical Receiving Capacity</span>
                            </th>
                        </tr>
                        <tr className="bg-black border-b-2 border-gray-700">
                            <TableHeader label="NO." className="w-[40px] min-w-[40px] border-l-2 border-blue-500/20" />
                            <TableHeader label="TR NO." className="w-[120px] min-w-[120px]" />
                            <TableHeader label="TYPE" className="w-[60px] min-w-[60px]" />
                            <TableHeader2 label="CAPACITY" subLabel="[kVA]" className="w-[80px] min-w-[80px]" />
                            <TableHeader label="NO." className="w-[40px] min-w-[40px]" />
                            <TableHeader label="SECTION" className="w-[80px] min-w-[80px]" />
                            <TableHeader label="PANEL" className="w-[120px] min-w-[120px]" />
                            <TableHeader label="LOCATION" className="w-[200px] min-w-[200px]" />
                            <TableHeader label="PHASE" className="w-[80px] min-w-[80px]" />
                            <TableHeader2 label="VOLTAGE" subLabel="[V]" className="w-[80px] min-w-[80px]" />
                            <TableHeader2 label="총부하" subLabel="[kVA]" className="w-[80px] min-w-[80px]" />
                            <TableHeader2 label="부하전류" subLabel="[A]" className="w-[80px] min-w-[80px]" />
                            <TableHeader2 label="수용률" subLabel="[%]" className="w-[80px] min-w-[80px]" />
                            <TableHeader2 label="수용부하" subLabel="[kVA]" className="w-[80px] min-w-[80px]" />
                            <TableHeader2 label="수용전류" subLabel="[A]" className="w-[80px] min-w-[80px]" />
                            <TableHeader label="부등률" className="w-[80px] min-w-[80px]" />
                            <TableHeader2 label="합성수용전력" subLabel="[kVA]" className="w-[80px] min-w-[80px]" />
                            <TableHeader label="TYPE" className="w-[80px] min-w-[80px]" />
                            <TableHeader label="P" className="w-[40px] min-w-[40px]" />
                            <TableHeader label="AF" className="w-[60px] min-w-[60px]" />
                            <TableHeader label="AT" className="w-[60px] min-w-[60px]" />
                            <TableHeader label="kA" className="w-[60px] min-w-[60px]" />
                            <TableHeader label="REMARKS" colSpan={1} className="w-[80px] min-w-[80px] border-r-2 border-blue-500/20" />
                        </tr>
                    </thead>
                    <tbody className="outline-none" tabIndex={0}>
                        {(() => {
                            // Find duplicate equipment names within this project's currently loaded panels
                            const nameCounts = {};
                            calculatedLoads.forEach(load => {
                                const name = (load.equipmentName || '').trim();
                                if (name) {
                                    nameCounts[name] = (nameCounts[name] || 0) + 1;
                                }
                            });
                            const duplicateNames = new Set(
                                Object.keys(nameCounts).filter(name => nameCounts[name] > 1)
                            );

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
                                        bankCapacity: load.bankCapacity || '',
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
                                        const isDemandChanged = load.connectedPanelId && load.demandFactor && Number(load.demandFactor) !== 100;
                                        const isDiversityChanged = load.connectedPanelId && load.diversityFactor && Number(load.diversityFactor) !== 1.0;
                                        
                                        // Duplicate check logic
                                        const isDuplicate = load.equipmentName && duplicateNames.has(load.equipmentName.trim());

                                        return (
                                            <tr
                                                key={load.id}
                                                className={`group transition-colors h-[48px] relative border-l-2 border-r-2 border-l-transparent border-r-transparent border-b border-gray-900 ${idx === 0 ? 'border-t border-gray-700' : ''} hover:bg-gray-900/50 ${isDropTarget && dropPosition === 'above' ? 'border-t-2 border-t-lime-500' : ''} ${isDropTarget && dropPosition === 'below' ? 'border-b-2 border-b-lime-500' : ''} ${isDragging ? 'opacity-50' : ''} focus-within:z-[100] z-[1]`}
                                            >
                                                {idx === 0 && (
                                                    <>
                                                        <td rowSpan={group.loads.length}
                                                            className={`border-r border-gray-900 border-b border-gray-900 p-1 w-[40px] min-w-[40px] text-center ${isGroupSelected ? 'text-white bg-lime-500/10' : 'bg-black text-[#d1d5db]'} cursor-grab active:cursor-grabbing hover:text-white transition-colors select-none text-[13px] border-l-2 border-blue-500/20`}
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
                                                        <td rowSpan={group.loads.length} 
                                                            className={`border-r border-gray-900 border-b border-gray-900 p-0 w-[120px] min-w-[120px] SearchablePanelCell-container ${isGroupSelected ? 'bg-lime-500/10' : 'bg-black'}`}
                                                            onClick={(e) => handleGroupClick(group, e)}
                                                            onContextMenu={(e) => handleGroupContextMenu(e, group)}
                                                        >
                                                            <SearchablePanelCell
                                                                loadId={`bank-${group.groupId}`}
                                                                value={group.bankName}
                                                                onChange={(name, panel) => handleTRSelection(load.id, name, panel)}
                                                                panels={panels.filter(p => (p.id.startsWith('transformer_') || p.id === 'transformer' || p.id.startsWith('transformer-')) && !p.id.startsWith('transformer-main-'))}
                                                                className="text-yellow-400 font-bold text-[13px]"
                                                                activeDropdownId={activeDropdownId}
                                                                onOpen={updateDropdownPosition}
                                                                dropdownPos={dropdownPos}
                                                                excludeId={panelId}
                                                                globalUsedPanelIds={globalUsedPanelIds}
                                                                currentId={group.bankId}
                                                                placeholder="TR NO."
                                                            />
                                                        </td>
                                                        <td rowSpan={group.loads.length} 
                                                            className={`border-r border-gray-900 border-b border-gray-900 p-1 w-[60px] min-w-[60px] text-center text-[#d1d5db] text-[13px] pointer-events-none select-none ${isGroupSelected ? 'bg-lime-500/10' : 'bg-black'}`}
                                                        >
                                                            {panelsFullData?.[group.bankId]?.projectInfo?.usageType || '-'}
                                                        </td>
                                                        <td rowSpan={group.loads.length} className={`border-r border-gray-900 border-b border-gray-900 p-1 w-[80px] min-w-[80px] text-center text-green-400 font-bold text-[13px] ${isGroupSelected ? 'bg-lime-500/10' : 'bg-black'}`}>
                                                            {panelsFullData?.[group.bankId]?.projectInfo?.mainCapacity || group.bankCapacity || ''}
                                                        </td>
                                                    </>
                                                )}
                                                {/* NO. */}
                                                <td
                                                    className={`border-r border-gray-900 p-1 w-[40px] min-w-[40px] text-center ${isSelected ? 'text-white bg-lime-500/10' : 'text-[#d1d5db]'} cursor-grab active:cursor-grabbing hover:text-white transition-colors select-none text-[13px]`}
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
                                                {/* Section */}
                                                <td className={`border-r border-gray-900 p-0 w-[80px] min-w-[80px] ${isSelected ? 'bg-lime-500/10' : ''}`}>
                                                    <InputCell 
                                                        value={load.sectionName} 
                                                        onChange={(v) => updatePowerLoad(load.id, 'sectionName', v)} 
                                                        readOnly={!!group.bankId}
                                                        className={`${group.bankId ? 'text-[#d1d5db]' : 'text-yellow-400 font-bold'} text-[13px]`} 
                                                    />
                                                </td>
                                                {/* 계통반명 (PANEL) - ReadOnly for AutoSynced */}
                                                <td className={`border-r border-gray-900 p-0 w-[120px] min-w-[120px] SearchablePanelCell-container ${isSelected ? 'bg-lime-500/10' : ''}`}>
                                                    {group.bankId ? (
                                                        <InputCell 
                                                            value={load.equipmentName} 
                                                            onChange={() => {}} 
                                                            readOnly={true} 
                                                            className={`${isDuplicate ? 'text-red-500 font-bold' : 'text-[#d1d5db]'} text-[13px]`} 
                                                        />
                                                    ) : (
                                                        <SearchablePanelCell
                                                            loadId={load.id}
                                                            value={load.equipmentName}
                                                            onChange={(name, panel) => updatePowerLoad(load.id, 'equipmentName', name, panel)}
                                                            panels={panels.filter(p => !p.id.startsWith('transformer-main-'))}
                                                            className={`${isDuplicate ? 'text-red-500 font-bold' : 'text-[#d1d5db]'} text-[13px]`}
                                                            activeDropdownId={activeDropdownId}
                                                            onOpen={updateDropdownPosition}
                                                            dropdownPos={dropdownPos}
                                                            excludeId={panelId}
                                                            globalUsedPanelIds={globalUsedPanelIds}
                                                            currentId={load.connectedPanelId}
                                                        />
                                                    )}
                                                </td>
                                            {/* 위치 */}
                                            <td className={`border-r border-gray-900 p-0 w-[200px] min-w-[200px] ${isSelected ? 'bg-lime-500/10' : ''}`}>
                                                <InputCell value={load.location} onChange={(v) => updatePowerLoad(load.id, 'location', v)} className="text-[#d1d5db] text-[13px]" />
                                            </td>
                                            {/* PHASE */}
                                            <td className={`border-r border-gray-900 p-0 w-[80px] min-w-[80px] ${isSelected ? 'bg-lime-500/10' : ''}`}>
                                                <InputCell value={load.phase} onChange={() => { }} readOnly={true} className="text-[#d1d5db] text-[13px]" />
                                            </td>
                                            {/* VOLTAGE */}
                                            <td className={`border-r border-gray-900 p-0 w-[80px] min-w-[80px] ${isSelected ? 'bg-lime-500/10' : ''}`}>
                                                <InputCell value={load.voltage} onChange={() => { }} readOnly={true} className="text-[#d1d5db] text-[13px]" />
                                            </td>
                                            {/* 총부하 [KVA] */}
                                            <td className={`border-r border-gray-900 p-0 w-[80px] min-w-[80px] ${isSelected ? 'bg-lime-500/10' : ''}`}>
                                                <InputCell
                                                    value={load.apparentPower}
                                                    onChange={(v) => updatePowerLoad(load.id, 'apparentPower', v)}
                                                    onFocus={() => { }}
                                                    type="text"
                                                    readOnly={true}
                                                    className="text-green-400 text-[13px]"
                                                />
                                            </td>
                                            {/* 부하전류 [A] */}
                                            <td className={`border-r border-gray-900 p-0 w-[80px] min-w-[80px] text-center text-green-400 text-[13px] ${isSelected ? 'bg-lime-500/10' : ''}`}>
                                                {load.subPanelTotalCurrent !== undefined && load.subPanelTotalCurrent !== null && load.subPanelTotalCurrent !== '' ? load.subPanelTotalCurrent : '-'}
                                            </td>
                                            {/* 수용률 [%] */}
                                            <td className={`border-r border-gray-900 p-0 w-[80px] min-w-[80px] ${isSelected ? 'bg-lime-500/10' : ''}`}>
                                                <InputCell
                                                    value={load.connectedPanelId ? (load.demandFactor ? `${load.demandFactor}%` : '') : '-'}
                                                    readOnly={true}
                                                    type="text"
                                                    className={`${isDemandChanged ? 'text-purple-400' : 'text-[#d1d5db]'} text-[13px]`}
                                                />
                                            </td>
                                            {/* 수용전력 [KVA] */}
                                            <td className={`border-r border-gray-900 p-0 w-[80px] min-w-[80px] text-center text-[13px] ${isDemandChanged ? 'text-blue-400' : 'text-[#d1d5db]'} ${isSelected ? 'bg-lime-500/10' : ''}`}>
                                                {load.demandLoad}
                                            </td>
                                            {/* 수용전류 [A] */}
                                            <td className={`border-r border-gray-900 p-0 w-[80px] min-w-[80px] text-center text-[13px] ${isDemandChanged ? 'text-blue-400' : 'text-[#d1d5db]'} ${isSelected ? 'bg-lime-500/10' : ''}`}>
                                                {load.connectedPanelId ? load.demandCurrent : '-'}
                                            </td>
                                            {/* 부등률 */}
                                            <td className={`border-r border-gray-900 p-0 w-[80px] min-w-[80px] ${isSelected ? 'bg-lime-500/10' : ''}`}>
                                                <InputCell
                                                    value={load.connectedPanelId ? (load.diversityFactor ?? '1.0') : '-'}
                                                    onChange={(v) => updatePowerLoad(load.id, 'diversityFactor', v)}
                                                    readOnly={!!load.connectedPanelId}
                                                    type="text"
                                                    placeholder={load.connectedPanelId ? "1.0" : "-"}
                                                    className="text-yellow-400 font-bold text-[13px]"
                                                />
                                            </td>
                                            {/* 합성수용전력 [KVA] */}
                                            <td className={`border-r border-gray-900 p-0 w-[80px] min-w-[80px] text-center text-[13px] ${isDiversityChanged ? 'text-blue-400' : 'text-[#d1d5db]'} ${isSelected ? 'bg-lime-500/10' : ''}`}>
                                                {load.compositeDemandPower}
                                            </td>
                                            {/* TYPE */}
                                            <td className={`border-r border-gray-900 p-0 w-[80px] min-w-[80px] text-center text-[#d1d5db] text-[13px] ${isSelected ? 'bg-lime-500/10' : ''}`}>
                                                {load.subPanelBreakerType || '-'}
                                            </td>
                                            {/* 차단기 P */}
                                            <td className={`border-r border-gray-900 p-0 w-[40px] min-w-[40px] ${isSelected ? 'bg-lime-500/10' : ''}`}>
                                                <InputCell value={load.cbP} onChange={() => { }} readOnly={true} className="text-[#d1d5db] text-[13px]" />
                                            </td>
                                            {/* 차단기 AF */}
                                            <td className={`border-r border-gray-900 p-0 w-[60px] min-w-[60px] text-center text-[#d1d5db] text-[13px] ${isSelected ? 'bg-lime-500/10' : ''}`}>
                                                {load.af || '-'}
                                            </td>
                                            {/* 차단기 AT */}
                                            <td className={`border-r border-gray-900 p-0 w-[60px] min-w-[60px] ${isSelected ? 'bg-lime-500/10' : ''}`}>
                                                <InputCell value={load.at} onChange={() => { }} readOnly={true} className="text-[#d1d5db] text-[13px]" />
                                            </td>
                                            {/* 차단기 kA */}
                                            <td className={`border-r border-gray-900 p-0 w-[60px] min-w-[60px] ${isSelected ? 'bg-lime-500/10' : ''}`}>
                                                <InputCell value={load.shortCircuitCurrent} onChange={() => { }} readOnly={true} className="text-[#d1d5db] text-[13px]" />
                                            </td>
                                            {/* Remarks */}
                                            <td className={`border-r-2 border-blue-500/20 p-0 w-[80px] min-w-[80px] ${isSelected ? 'bg-lime-500/10' : ''}`}>
                                                {group.bankId ? (
                                                    <InputCell 
                                                        value={load.remarks} 
                                                        onChange={() => {}} 
                                                        readOnly={true} 
                                                        className={`font-bold text-[13px] ${
                                                            load.remarks === '소방비상' || load.remarks === '동력비상' ? 'text-rose-400' :
                                                            load.remarks === '전기차' ? 'text-blue-400' :
                                                            load.remarks === '별도수전' ? 'text-green-400' :
                                                            load.remarks === '모자분리' ? 'text-orange-400' :
                                                            load.remarks === 'WHM' ? 'text-yellow-400' :
                                                            'text-gray-400'
                                                        }`}
                                                    />
                                                ) : (
                                                    <SelectCell
                                                        value={load.remarks}
                                                        onChange={(v) => updatePowerLoad(load.id, 'remarks', v)}
                                                        options={['소방비상', '동력비상', '전기차', '별도수전', '모자분리', 'WHM']}
                                                        placeholder="REMARKS"
                                                        className={`font-bold text-[13px] ${
                                                            load.remarks === '소방비상' || load.remarks === '동력비상' ? 'text-rose-400' :
                                                            load.remarks === '전기차' ? 'text-blue-400' :
                                                            load.remarks === '별도수전' ? 'text-green-400' :
                                                            load.remarks === '모자분리' ? 'text-orange-400' :
                                                            load.remarks === 'WHM' ? 'text-yellow-400' :
                                                            'text-yellow-400/60'
                                                        }`}
                                                    />
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                                </React.Fragment>
                            ))})()}
                        <tr className="hover:bg-gray-900/30 border-t border-gray-900">
                            <td colSpan={23} className="p-2 border-l border-r border-b border-gray-900">
                                <div className="flex items-center gap-4 pl-2">
                                    <button
                                        onClick={addPowerLoad}
                                        className="flex items-center gap-2 text-yellow-500 hover:text-yellow-400 text-[12px] font-bold uppercase tracking-widest"
                                    >
                                        <Plus size={14} />
                                        ADD TRANSFORMER
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

export default CapacityTable;

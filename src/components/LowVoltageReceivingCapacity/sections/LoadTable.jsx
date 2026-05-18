import React from 'react';
import { CornerBorders, TableHeader, TableHeader2, InputCell, SearchablePanelCell, SelectCell } from '../ui/LowVoltageUI';
import { Plus } from 'lucide-react';

const LoadTable = (props) => {
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
        handleRowClick,
        projectInfo,
        updatePowerLoad,
        updatePowerLoadFields,
        panels,
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
                    <colgroup><col className="w-[40px]" /><col className="w-[120px]" /><col className="w-[60px]" /><col className="w-[100px]" /><col className="w-[120px]" /><col className="w-[200px]" /><col className="w-[80px]" /><col className="w-[80px]" /><col className="w-[80px]" /><col className="w-[80px]" /><col className="w-[80px]" /><col className="w-[80px]" /><col className="w-[80px]" /><col className="w-[80px]" /><col className="w-[80px]" /><col className="w-[80px]" /><col className="w-[60px]" /><col className="w-[60px]" /><col className="w-[60px]" /><col className="w-[60px]" /><col className="w-[80px]" /></colgroup>
                    <thead>
                        <tr className="border-b border-gray-900 h-[52px]">
                            <th colSpan={21} className="px-4 py-3 text-[12px] font-semibold text-gray-300 uppercase tracking-[0.2em] text-left border-l-2 border-r-2 border-blue-500/20">
                                <span className="font-bold uppercase tracking-[0.2em] text-white">Low Voltage Incoming Load Schedule</span>
                            </th>
                        </tr>
                        <tr className="bg-black border-b-2 border-gray-700">
                            <TableHeader label="NO." className="w-[40px] min-w-[40px] border-l-2 border-blue-500/20" />
                            <TableHeader label="PANEL" className="w-[120px] min-w-[120px]" />
                            <TableHeader label="TYPE" className="w-[60px] min-w-[60px]" />
                            <TableHeader label="SECTION" className="w-[100px] min-w-[100px]" />
                            <TableHeader label="PANEL" className="w-[120px] min-w-[120px]" />
                            <TableHeader label="LOCATION" className="w-[200px] min-w-[200px]" />
                            <TableHeader label="PHASE" className="w-[80px] min-w-[80px]" />
                            <TableHeader2 label="VOLTAGE" subLabel="[V]" className="w-[80px] min-w-[80px]" />
                            <TableHeader2 label="총부하" subLabel="[kVA]" className="w-[80px] min-w-[80px]" />
                            <TableHeader2 label="부하전류" subLabel="[A]" className="w-[80px] min-w-[80px]" />
                            <TableHeader2 label="수용률" subLabel="[%]" className="w-[80px] min-w-[80px]" />
                            <TableHeader2 label="수용전력" subLabel="[kVA]" className="w-[80px] min-w-[80px]" />
                            <TableHeader2 label="수용전류" subLabel="[A]" className="w-[80px] min-w-[80px]" />
                            <TableHeader label="부등률" className="w-[80px] min-w-[80px]" />
                            <TableHeader2 label="합성수용전력" subLabel="[kVA]" className="w-[80px] min-w-[80px]" />
                            <TableHeader label="TYPE" className="w-[80px] min-w-[80px]" />
                            <TableHeader label="P" className="w-[60px] min-w-[60px]" />
                            <TableHeader label="AF" className="w-[60px] min-w-[60px]" />
                            <TableHeader label="AT" className="w-[60px] min-w-[60px]" />
                            <TableHeader label="kA" className="w-[60px] min-w-[60px]" />
                            <TableHeader label="REMARKS" colSpan={1} className="w-[80px] min-w-[80px] border-r-2 border-blue-500/20" />
                        </tr>
                    </thead>
                    <tbody className="outline-none" tabIndex={0}>
                        {(() => {
                            const groups = [];
                            let currentSectionName = null;
                            let currentGroup = null;

                            calculatedLoads.forEach((load) => {
                                const sName = load.sectionName || '';
                                if (currentSectionName !== sName || !currentGroup) {
                                    currentSectionName = sName;
                                    currentGroup = {
                                        sectionName: sName,
                                        loads: []
                                    };
                                    groups.push(currentGroup);
                                }
                                currentGroup.loads.push(load);
                            });

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

                            const localUsedIds = calculatedLoads
                                .map(l => l.connectedPanelId)
                                .filter(Boolean);

                            let globalRowIdx = 0;
                            return groups.map((group, groupIdx) => (
                                <React.Fragment key={`group-${groupIdx}`}>
                                    {group.loads.map((load, idx) => {
                                        const isSelected = selectedRows.includes(load.id);
                                        const isDropTarget = dropTarget?.id === load.id;
                                        const dropPosition = dropTarget?.position;
                                        const isDragging = draggedRow === load.id;

                                        const isDemandChanged = load.connectedPanelId && load.demandFactor && Number(load.demandFactor) !== 100;
                                        const isDiversityChanged = load.connectedPanelId && load.diversityFactor && Number(load.diversityFactor) !== 1.0;
                                        
                                        const isDuplicate = load.equipmentName && duplicateNames.has(load.equipmentName.trim());
                                        const currentRowIdx = globalRowIdx++;

                                        return (
                                            <tr
                                                key={load.id}
                                                className={`group transition-colors h-[48px] relative border-l-2 border-r-2 border-l-transparent border-r-transparent border-b border-gray-900 ${isSelected ? 'bg-lime-500/10' : 'hover:bg-gray-900/50'} ${isDropTarget && dropPosition === 'above' ? 'border-t-2 border-t-lime-500' : ''} ${isDropTarget && dropPosition === 'below' ? 'border-b-2 border-b-lime-500' : ''} ${isDragging ? 'opacity-50' : ''} focus-within:z-[100] z-[1]`}
                                            >
                                                <td
                                                    className={`border-r border-gray-900 p-1 w-[40px] min-w-[40px] border-l-2 border-blue-500/20 text-center ${isSelected ? 'text-white' : 'text-[#d1d5db]'} cursor-grab active:cursor-grabbing hover:text-white transition-colors select-none text-[13px]`}
                                                    draggable
                                                    onDragStart={(e) => handleDragStart(e, load.id)}
                                                    onDragOver={(e) => handleDragOver(e, load.id)}
                                                    onDragLeave={handleDragLeave}
                                                    onDrop={(e) => handleDrop(e, load.id)}
                                                    onDragEnd={handleDragEnd}
                                                    onContextMenu={(e) => handleContextMenu(e, load.id)}
                                                    onClick={(e) => handleRowClick(load.id, e)}
                                                >
                                                    {currentRowIdx + 1}
                                                </td>
                                                {currentRowIdx === 0 && (
                                                    <React.Fragment>
                                                        <td 
                                                            rowSpan={calculatedLoads.length}
                                                            className="border-r border-gray-900 p-1 w-[120px] min-w-[120px] text-center text-yellow-400 font-bold text-[13px] bg-black pointer-events-none select-none"
                                                        >
                                                            {projectInfo.panelName}
                                                        </td>
                                                        <td 
                                                            rowSpan={calculatedLoads.length}
                                                            className="border-r border-gray-900 p-1 w-[60px] min-w-[60px] text-center text-[#d1d5db] text-[13px] bg-black pointer-events-none select-none"
                                                        >
                                                            {projectInfo.usageType || 'LV'}
                                                        </td>
                                                    </React.Fragment>
                                                )}
                                                {idx === 0 && (
                                                        <td 
                                                            rowSpan={group.loads.length}
                                                            className="border-r border-gray-900 p-0 w-[100px] min-w-[100px] bg-black"
                                                        >
                                                            <InputCell 
                                                                value={group.sectionName} 
                                                                onChange={(v) => {
                                                                    const ids = group.loads.map(l => l.id);
                                                                    updatePowerLoadFields(ids, { sectionName: v });
                                                                }} 
                                                                className="text-yellow-400 font-bold text-[13px]" 
                                                            />
                                                        </td>
                                                )}
                                                <td className="border-r border-gray-900 p-0 w-[120px] min-w-[120px] SearchablePanelCell-container">
                                                    <SearchablePanelCell
                                                        loadId={load.id}
                                                        value={load.equipmentName}
                                                        onChange={(name, panel) => updatePowerLoad(load.id, 'equipmentName', name, panel)}
                                                        panels={panels}
                                                        className={`${isDuplicate ? 'text-red-500' : 'text-yellow-400'} font-bold text-[13px]`}
                                                        activeDropdownId={activeDropdownId}
                                                        onOpen={updateDropdownPosition}
                                                        dropdownPos={dropdownPos}
                                                        excludeId={panelId}
                                                        globalUsedPanelIds={globalUsedPanelIds}
                                                        localUsedIds={localUsedIds}
                                                        currentId={load.connectedPanelId}
                                                    />
                                                </td>
                                                <td className="border-r border-gray-900 p-0 w-[200px] min-w-[200px]">
                                                    <InputCell value={load.location} onChange={(v) => updatePowerLoad(load.id, 'location', v)} className="text-[#d1d5db] text-[13px]" />
                                                </td>
                                                <td className="border-r border-gray-900 p-0 w-[80px] min-w-[80px]">
                                                    <InputCell value={load.phase} onChange={() => { }} readOnly={true} className="text-[#d1d5db] text-[13px]" />
                                                </td>
                                                <td className="border-r border-gray-900 p-0 w-[80px] min-w-[80px]">
                                                    <InputCell value={load.voltage} onChange={() => { }} readOnly={true} className="text-[#d1d5db] text-[13px]" />
                                                </td>
                                                <td className="border-r border-gray-900 p-0 w-[80px] min-w-[80px]">
                                                    <InputCell
                                                        value={load.apparentPower}
                                                        onChange={(v) => updatePowerLoad(load.id, 'apparentPower', v)}
                                                        type="text"
                                                        readOnly={true}
                                                        className="text-green-400 text-[13px]"
                                                    />
                                                </td>
                                                <td className="border-r border-gray-900 p-0 w-[80px] min-w-[80px] text-center text-green-400 text-[13px]">
                                                    {load.subPanelTotalCurrent !== undefined && load.subPanelTotalCurrent !== null && load.subPanelTotalCurrent !== '' ? load.subPanelTotalCurrent : '-'}
                                                </td>
                                                <td className="border-r border-gray-900 p-0 w-[80px] min-w-[80px]">
                                                    <InputCell
                                                        value={load.connectedPanelId ? (load.demandFactor ? `${load.demandFactor}%` : '') : '-'}
                                                        readOnly={true}
                                                        type="text"
                                                        className={`${isDemandChanged ? 'text-purple-400' : 'text-[#d1d5db]'} text-[13px]`}
                                                    />
                                                </td>
                                                <td className={`border-r border-gray-900 p-0 w-[80px] min-w-[80px] text-center text-[13px] ${isDemandChanged ? 'text-blue-400' : 'text-[#d1d5db]'}`}>
                                                    {load.demandLoad}
                                                </td>
                                                <td className={`border-r border-gray-900 p-0 w-[80px] min-w-[80px] text-center text-[13px] ${isDemandChanged ? 'text-blue-400' : 'text-[#d1d5db]'}`}>
                                                    {load.connectedPanelId ? load.demandCurrent : '-'}
                                                </td>
                                                <td className="border-r border-gray-900 p-0 w-[80px] min-w-[80px]">
                                                    <InputCell
                                                        value={load.connectedPanelId ? (load.diversityFactor || '1.0') : '-'}
                                                        onChange={(v) => updatePowerLoad(load.id, 'diversityFactor', v)}
                                                        readOnly={!load.connectedPanelId}
                                                        type="text"
                                                        placeholder={load.connectedPanelId ? "1.0" : "-"}
                                                        className="text-yellow-400 font-bold text-[13px]"
                                                    />
                                                </td>
                                                <td className={`border-r border-gray-900 p-0 w-[80px] min-w-[80px] text-center text-[13px] ${isDiversityChanged ? 'text-blue-400' : 'text-[#d1d5db]'}`}>
                                                    {load.compositeDemandPower}
                                                </td>
                                                <td className="border-r border-gray-900 p-0 w-[80px] min-w-[80px] text-center text-[#d1d5db] text-[13px]">
                                                    {load.subPanelBreakerType || '-'}
                                                </td>
                                                <td className="border-r border-gray-900 p-0 w-[60px] min-w-[60px]">
                                                    <InputCell value={load.cbP} onChange={() => { }} readOnly={true} className="text-[#d1d5db] text-[13px]" />
                                                </td>
                                                <td className="border-r border-gray-900 p-0 w-[60px] min-w-[60px] text-center text-[#d1d5db] text-[13px]">
                                                    {load.af || '-'}
                                                </td>
                                                <td className="border-r border-gray-900 p-0 w-[60px] min-w-[60px]">
                                                    <InputCell value={load.at} onChange={() => { }} readOnly={true} className="text-[#d1d5db] text-[13px]" />
                                                </td>
                                                <td className="border-r border-gray-900 p-0 w-[60px] min-w-[60px]">
                                                    <InputCell value={load.shortCircuitCurrent} onChange={() => { }} readOnly={true} className="text-[#d1d5db] text-[13px]" />
                                                </td>
                                                <td className="border-r-2 border-blue-500/20 p-0 w-[80px] min-w-[80px]">
                                                    <SelectCell
                                                        value={load.remarks}
                                                        onChange={(v) => updatePowerLoad(load.id, 'remarks', v)}
                                                        options={['소방비상', '동력비상', '전기차', '별도수전', '모자분리', 'WHM']}
                                                        placeholder="REMARKS"
                                                        className={`${
                                                            !load.remarks ? 'text-gray-500' :
                                                            (load.remarks === '소방비상' || load.remarks === '동력비상') ? 'text-rose-500 font-bold' :
                                                            load.remarks === '전기차' ? 'text-blue-500 font-bold' :
                                                            load.remarks === '별도수전' ? 'text-green-500 font-bold' :
                                                            load.remarks === '모자분리' ? 'text-orange-500 font-bold' :
                                                            load.remarks === 'WHM' ? 'text-yellow-400 font-bold' :
                                                            'text-gray-500'
                                                        } text-[13px]`}
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </React.Fragment>
                            ));
                        })()}

                        <tr className="hover:bg-gray-900/30 border-t border-gray-900">
                            <td colSpan={21} className="p-2 border-l border-r border-b border-gray-900">
                                <div className="flex items-center gap-4 pl-2">
                                    <button
                                        onClick={addPowerLoad}
                                        className="flex items-center gap-2 text-yellow-500 hover:text-yellow-400 text-[12px] font-bold uppercase tracking-widest"
                                    >
                                        <Plus size={14} />
                                        ADD LOAD TO {projectInfo.panelName || 'LV-N'}
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

export default LoadTable;

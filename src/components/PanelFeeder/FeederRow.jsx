import React, { memo, useState } from 'react';
import { ChevronDown, ChevronRight, Activity } from 'lucide-react';
import { InputCell, SelectCell, SearchableSelectCell, InteractiveDivCell } from '../common/TableCells';
import * as feederChker from './utils/feederChker';

const FeederRow = memo(({
    feeder,
    index,
    isSelected,
    isDropTarget,
    isDragging,
    handlers,
    lookup,
    breakerType,
    breakerOptions,
    usedToIds,
    usedFromIds,
    isSmseExpanded,
    isHighlighted,
    isCollapsed,
    kecSettings
}) => {
    const [isDemandFocused, setIsDemandFocused] = useState(false);
    const {
        onRowClick,
        onContextMenu,
        onDragStart,
        onDragOver,
        onDragLeave,
        onDrop,
        onDragEnd,
        updateFeeder,
        handleDropdownInteract,
        handleDropdownKeyDown,
        toggleGroupCollapse
    } = handlers;

    const { getNameById, getIdByName, panels } = lookup;

    const getStatusColor = (val) => {
        if (!val) return '!text-[#d1d5db]';
        const upper = val.toString().toUpperCase();
        if (upper.includes('OK')) return 'text-green-400 font-bold';
        if (upper.includes('FAIL') || upper.includes('ERR')) return 'text-red-500 font-bold';
        return '!text-[#d1d5db]';
    };

    let borderClass = 'border-b border-gray-800'; // Default unselected state
    const bgClass = isSelected 
        ? 'bg-lime-500/15' 
        : (isHighlighted 
            ? 'bg-green-500/20 shadow-[inset_0_0_10px_rgba(34,197,94,0.1)]' // Highlight added rows
            : (isDropTarget ? 'bg-gray-900/70' : 'hover:bg-gray-900/50'));

    if (feeder.rowType === 'group-header') {
        return (
            <tr 
                id={`feeder-row-${feeder.id}`} 
                className="bg-gray-900/10 border-b border-gray-800 border-t-[3px] border-t-gray-700 h-[49px] group"
                onContextMenu={(e) => onContextMenu(e, feeder.id)}
            >
                <td className="border border-gray-900 bg-gray-950 p-1 text-center text-gray-400 text-[13px]">
                   {/* Icon removed to disable expand/collapse feature */}
                </td>
                <td colSpan={2} className="border border-gray-900 text-center h-[49px] p-0">
                    <div className="flex items-center justify-center gap-2 h-full px-4">
                        <span className="text-yellow-400 font-normal text-[14px] uppercase tracking-wider select-none">
                            {feeder.label}
                        </span>
                    </div>
                </td>
                <td colSpan={isSmseExpanded ? 84 : 83} className="border border-gray-900 h-[49px]"></td>
            </tr>
        );
    }

    if (feeder.rowType === 'group-footer') {
        return (
            <tr 
                id={`feeder-row-${feeder.id}`} 
                className="bg-gray-900/10 border-b-2 border-gray-700 h-[49px]"
                onContextMenu={(e) => onContextMenu(e, feeder.id)}
            >
                <td className="border border-gray-900 bg-gray-950 p-1 text-center text-gray-400 text-[13px]"></td>
                <td className="border border-gray-900 bg-blue-900/10 px-4 py-2 text-center text-[13px] font-normal text-blue-400 select-none h-[49px]">{feeder.label}</td>
                <td className="border border-gray-900 px-4 py-2 text-center text-[13px] font-normal text-blue-400 select-none h-[49px]">{feeder.value}</td>
                <td colSpan={isSmseExpanded ? 84 : 83} className="border border-gray-900 bg-blue-900/5"></td>
            </tr>
        );
    }

    return (
        <tr
            key={feeder.id}
            id={`feeder-row-${feeder.id}`}
            className={`transition-colors relative border-b border-gray-800 ${bgClass} ${isDragging ? 'opacity-50' : ''}`}
            onClick={(e) => onRowClick(feeder.id, e)}
            onContextMenu={(e) => onContextMenu(e, feeder.id)}
        >
            <td
                className="border border-gray-900 bg-gray-950 p-1 text-center text-gray-400 text-[13px] cursor-pointer select-none"
                draggable
                onDragStart={(e) => onDragStart(e, feeder.id)}
                onDragOver={(e) => onDragOver(e, feeder.id)}
                onDragLeave={onDragLeave}
                onDrop={(e) => onDrop(e, feeder.id)}
                onDragEnd={onDragEnd}
            >
                <div className="flex items-center justify-center gap-1">
                    <span className={`w-5 h-5 flex items-center justify-center rounded ${
                        isSelected 
                            ? 'bg-blue-500 text-[#d1d5db]' 
                            : (feederChker.getRowStatus(feeder, kecSettings) === 'FAIL' ? 'text-red-500 font-bold' : '')
                    }`}>
                        {index + 1}
                    </span>
                </div>
            </td>

            <td 
                className="border border-gray-900 p-0"
                onContextMenu={(e) => handlers.handleCellContextMenu ? handlers.handleCellContextMenu(e, feeder.fromId) : onContextMenu(e, feeder.id)}
            >
                <SearchableSelectCell
                    id={`feeder-${feeder.id}-fromId`}
                    value={getNameById(feeder.fromId)} // Display name from ID
                    onInteract={(e, val) => handleDropdownInteract(
                        e, val,
                        panels
                            .filter(p => !usedFromIds.includes(p.id) || p.id === feeder.fromId) // Filter out already used FROM panels (excluding current)
                            .map(p => ({ value: p.id, label: p.name })), // Pass ID as value, name as label
                        (selectedId) => updateFeeder(feeder.id, 'fromId', selectedId)
                    )}
                    onBlur={(val) => {
                        const matchedId = getIdByName(val);
                        if (matchedId) {
                            updateFeeder(feeder.id, 'fromId', matchedId);
                        } else if (!val.trim()) {
                            updateFeeder(feeder.id, 'fromId', '');
                        }
                    }}
                    onKeyDown={handleDropdownKeyDown}
                    placeholder="FROM"
                    className="!text-yellow-400 font-bold text-[13px]"
                    debounceDelay={300}
                />
            </td>
            <td 
                className="border border-gray-900 p-0"
                onContextMenu={(e) => handlers.handleCellContextMenu ? handlers.handleCellContextMenu(e, feeder.toId) : onContextMenu(e, feeder.id)}
            >
                <SearchableSelectCell
                    id={`feeder-${feeder.id}-toId`}
                    value={getNameById(feeder.toId)} // Display name from ID
                    onInteract={(e, val) => handleDropdownInteract(
                        e, val,
                        [
                            { value: 'FIND_ALL_TO', label: '모두 찾기' },
                            ...panels
                                .filter(p => p.type !== 'transformer' && p.type !== 'low-voltage-receiving' && (!usedToIds.includes(p.id) || p.id === feeder.toId)) // Filter out already used TO panels AND source types
                                .map(p => ({ value: p.id, label: p.name }))
                        ],
                        (selectedId) => {
                            if (selectedId === 'FIND_ALL_TO') {
                                handlers.handleFindAllTo(feeder.id);
                            } else {
                                updateFeeder(feeder.id, 'toId', selectedId);
                            }
                        }
                    )}
                    onBlur={(val) => {
                        const matchedId = getIdByName(val);
                        if (matchedId) {
                            updateFeeder(feeder.id, 'toId', matchedId);
                        } else if (!val.trim()) {
                            updateFeeder(feeder.id, 'toId', '');
                        }
                    }}
                    onKeyDown={handleDropdownKeyDown}
                    placeholder="TO"
                    className={`font-bold text-[13px] ${
                        handlers.isLinkBroken(feeder.toId, feeder.fromId)
                            ? '!text-red-500 font-bold underline'
                            : handlers.isDuplicateToId(feeder.toId)
                                ? '!text-red-500'
                                : '!text-yellow-400'
                    }`}
                    debounceDelay={300}
                />
            </td>

            {/* Capacity w/ Cat. (Simple Select, No Search) */}
            <td className="border border-gray-900 border-l-2 border-l-blue-900/50 p-0">
                <InteractiveDivCell
                    id={`feeder-${feeder.id}-cat`}
                    value={feeder.cat}
                    onClick={(e) => handleDropdownInteract(e, '', ['L', 'P', 'M'], (v) => updateFeeder(feeder.id, 'cat', v), 'center', feeder.cat)}
                    onKeyDown={handleDropdownKeyDown}
                    placeholder="Cat."
                    className={`font-normal text-center text-[13px] ${!handlers.isMaterialMethodValid(feeder) ? '!text-red-500 z-10' : 'text-yellow-400'}`}
                />
            </td>
            <td className="border border-gray-900 p-0"><InputCell value={feeder.capacityKva || '-'} readOnly={true} onChange={(v) => updateFeeder(feeder.id, 'capacityKva', v)} bgClass="bg-transparent" className="!text-blue-400 font-normal text-[13px]" /></td>
            <td className="border border-gray-900 p-0"><InputCell value={feeder.capacityKw || '-'} readOnly={true} onChange={(v) => updateFeeder(feeder.id, 'capacityKw', v)} bgClass="bg-transparent" className="!text-blue-400 font-normal text-[13px]" /></td>

            {/* Phase (Simple Select, No Search) - ReadOnly */}
            <td className="border border-gray-900 p-0">
                <InputCell
                    value={feeder.phase}
                    readOnly={true}
                    bgClass="bg-transparent"
                    className="!text-[#d1d5db] font-normal text-[13px]"
                    placeholder="Phase"
                />
            </td>

            {/* Voltage (Read-only, synced from store) */}
            <td className="border border-gray-900 p-0">
                <InputCell
                    value={feeder.voltage}
                    readOnly={true}
                    bgClass="bg-transparent"
                    className="!text-[#d1d5db] font-normal text-[13px]"
                />
            </td>
            <td className="border border-gray-900 p-0"><InputCell value={feeder.current} readOnly={true} onChange={(v) => updateFeeder(feeder.id, 'current', v)} bgClass="bg-transparent" className="!text-blue-400 font-normal text-[13px]" /></td>

            {/* Moved Voltage Drop Here - Swapped order e[V], e[%] */}
            <td className="border border-gray-900 border-l-2 border-l-blue-900/50 p-0"><InputCell id={`feeder-${feeder.id}-vDropEV`} value={feeder.vDropEV} readOnly={!!feeder.toId} onChange={(v) => updateFeeder(feeder.id, 'vDropEV', v)} bgClass="bg-transparent" className={`text-[13px] font-normal ${getStatusColor(feeder.seSize)}`} /></td>
            <td className="border border-gray-900 p-0"><InputCell id={`feeder-${feeder.id}-vDropEPer`} value={feeder.vDropEPer} readOnly={!!feeder.toId} onChange={(v) => updateFeeder(feeder.id, 'vDropEPer', v)} bgClass="bg-transparent" className={`text-[13px] font-normal ${getStatusColor(feeder.seSize)}`} /></td>

            {/* Demand */}
            <td className="border border-gray-900 border-l-2 border-l-blue-900/50 p-0">
                <InputCell 
                    value={feeder.demandFactor ? `${feeder.demandFactor}%` : ''} 
                    readOnly={true}
                    bgClass="bg-transparent"
                    className={`${(feeder.demandFactor && Number(feeder.demandFactor) !== 100) ? '!text-purple-400' : '!text-[#d1d5db]'} text-[13px]`} 
                />
            </td>
            <td className="border border-gray-900 p-0">
                <InputCell 
                    value={feeder.demandKva} 
                    onChange={(v) => updateFeeder(feeder.id, 'demandKva', v)} 
                    className={`${(feeder.demandFactor && Number(feeder.demandFactor) !== 100) ? '!text-blue-400' : '!text-[#d1d5db]'} text-[13px]`} 
                />
            </td>
            <td className="border border-gray-900 p-0">
                <InputCell 
                    value={feeder.demandA} 
                    onChange={(v) => updateFeeder(feeder.id, 'demandA', v)} 
                    className={`${(feeder.demandFactor && Number(feeder.demandFactor) !== 100) ? '!text-blue-400' : '!text-[#d1d5db]'} text-[13px]`} 
                />
            </td>

            {/* Breaker (TYPE: Household/Industrial) - Read Only & Synced */}
            <td className="border border-gray-900 border-l-2 border-l-blue-900/50 p-0">
                <div className="flex items-center justify-center h-[48px] w-full !text-[#d1d5db] font-normal text-center text-[13px] select-none uppercase">
                    {feeder.toId ? (breakerType === 'residential' ? '주택용' : '산업용') : ''}
                </div>
            </td>
            {/* Breaker (CB: MCCB/ELCB) */}
            <td className="border border-gray-900 p-0">
                <InteractiveDivCell
                    value={feeder.breakerType2}
                    onClick={(e) => handleDropdownInteract(e, '', breakerOptions, (v) => updateFeeder(feeder.id, 'breakerType2', v), 'center', feeder.breakerType2)}
                    onKeyDown={handleDropdownKeyDown}
                    placeholder="CB"
                    className="font-normal text-center text-[13px] text-purple-400"
                />
            </td>
            <td className="border border-gray-900 p-0"><InputCell value={feeder.breakerAF} onChange={(v) => updateFeeder(feeder.id, 'breakerAF', v)} className="text-[13px] text-purple-400 font-normal" /></td>
            <td className="border border-gray-900 p-0"><InputCell value={feeder.breakerAT} onChange={(v) => updateFeeder(feeder.id, 'breakerAT', v)} className="text-[13px] text-purple-400 font-normal" /></td>
            <td className="border border-gray-900 p-0"><InputCell value={feeder.breakerKA} readOnly={!!feeder.toId} onChange={(v) => updateFeeder(feeder.id, 'breakerKA', v)} bgClass="bg-transparent" className={`text-[13px] font-normal !text-[#d1d5db]`} /></td>

            {/* ATB */}
            <td className="border-l-2 border-x border-gray-900 border-l-blue-900/50 p-0"><InputCell id={`feeder-${feeder.id}-ib`} value={feeder.ib} onChange={(v) => updateFeeder(feeder.id, 'ib', v)} className="text-[13px] text-[#d1d5db]" /></td>
            <td className="border border-gray-900 p-0"><InputCell id={`feeder-${feeder.id}-in`} value={feeder.in} onChange={(v) => updateFeeder(feeder.id, 'in', v)} className="text-[13px] text-[#d1d5db]" /></td>
            <td className="border border-gray-900 p-0"><InputCell id={`feeder-${feeder.id}-ibInIz`} value={feeder.ibInIz} onChange={(v) => updateFeeder(feeder.id, 'ibInIz', v)} className={`text-[13px] ${getStatusColor(feeder.ibInIz)}`} /></td>
            <td className="border border-gray-900 p-0"><InputCell id={`feeder-${feeder.id}-atb`} value={feeder.atb} onChange={(v) => updateFeeder(feeder.id, 'atb', v)} className={`text-[13px] ${getStatusColor(feeder.atb)}`} /></td>

            {/* ATTH */}
            <td className="border-l-2 border-x border-gray-900 border-l-blue-900/50 p-0"><InputCell id={`feeder-${feeder.id}-i2`} value={feeder.i2} onChange={(v) => updateFeeder(feeder.id, 'i2', v)} className="text-[13px] text-[#d1d5db]" /></td>
            <td className="border border-gray-900 p-0"><InputCell id={`feeder-${feeder.id}-iz145`} value={feeder.iz145} onChange={(v) => updateFeeder(feeder.id, 'iz145', v)} className="text-[13px] text-[#d1d5db]" /></td>
            <td className="border border-gray-900 p-0"><InputCell id={`feeder-${feeder.id}-i2Iz`} value={feeder.i2Iz} onChange={(v) => updateFeeder(feeder.id, 'i2Iz', v)} className={`text-[13px] ${getStatusColor(feeder.i2Iz)}`} /></td>
            <td className="border border-gray-900 p-0"><InputCell id={`feeder-${feeder.id}-atth`} value={feeder.atth} onChange={(v) => updateFeeder(feeder.id, 'atth', v)} className={`text-[13px] ${getStatusColor(feeder.atth)}`} /></td>

            {/* ATSC */}
            <td className="border-l-2 border-x border-gray-900 border-l-blue-900/50 p-0"><InputCell id={`feeder-${feeder.id}-tn`} value={feeder.tn} onChange={(v) => updateFeeder(feeder.id, 'tn', v)} className="text-[13px] text-[#d1d5db]" /></td>
            <td className="border border-gray-900 p-0"><InputCell id={`feeder-${feeder.id}-tz`} value={feeder.tz} onChange={(v) => updateFeeder(feeder.id, 'tz', v)} className="text-[13px] text-[#d1d5db]" /></td>
            <td className="border border-gray-900 p-0"><InputCell id={`feeder-${feeder.id}-tnTz`} value={feeder.tnTz} onChange={(v) => updateFeeder(feeder.id, 'tnTz', v)} className={`text-[13px] ${getStatusColor(feeder.tnTz)}`} /></td>
            <td className="border border-gray-900 p-0"><InputCell id={`feeder-${feeder.id}-atsc`} value={feeder.atsc} onChange={(v) => updateFeeder(feeder.id, 'atsc', v)} className={`text-[13px] ${getStatusColor(feeder.atsc)}`} /></td>

            {/* ATMS */}
            <td className="border-l-2 border-x border-gray-900 border-l-blue-900/50 p-0"><InputCell id={`feeder-${feeder.id}-delta`} value={feeder.delta} onChange={(v) => updateFeeder(feeder.id, 'delta', v)} className="text-[13px] text-[#d1d5db]" /></td>
            <td className="border border-gray-900 p-0"><InputCell id={`feeder-${feeder.id}-ims`} value={feeder.ims} onChange={(v) => updateFeeder(feeder.id, 'ims', v)} className="text-[13px] text-[#d1d5db]" /></td>
            <td className="border border-gray-900 p-0"><InputCell id={`feeder-${feeder.id}-inIms`} value={feeder.inIms} onChange={(v) => updateFeeder(feeder.id, 'inIms', v)} className={`text-[13px] ${getStatusColor(feeder.inIms)}`} /></td>
            <td className="border border-gray-900 p-0"><InputCell id={`feeder-${feeder.id}-atms`} value={feeder.atms} onChange={(v) => updateFeeder(feeder.id, 'atms', v)} className={`text-[13px] ${getStatusColor(feeder.atms)}`} /></td>

            {/* ATMI */}
            <td className="border-l-2 border-x border-gray-900 border-l-blue-900/50 p-0"><InputCell id={`feeder-${feeder.id}-k`} value={feeder.k} onChange={(v) => updateFeeder(feeder.id, 'k', v)} className="text-[13px] text-[#d1d5db]" /></td>
            <td className="border border-gray-900 p-0"><InputCell id={`feeder-${feeder.id}-imi`} value={feeder.imi} onChange={(v) => updateFeeder(feeder.id, 'imi', v)} className="text-[13px] text-[#d1d5db]" /></td>
            <td className="border border-gray-900 p-0"><InputCell id={`feeder-${feeder.id}-inImi`} value={feeder.inImi} onChange={(v) => updateFeeder(feeder.id, 'inImi', v)} className={`text-[13px] ${getStatusColor(feeder.inImi)}`} /></td>
            <td className="border border-gray-900 p-0"><InputCell id={`feeder-${feeder.id}-atmi`} value={feeder.atmi} onChange={(v) => updateFeeder(feeder.id, 'atmi', v)} className={`text-[13px] ${getStatusColor(feeder.atmi)}`} /></td>

            {/* SCB */}
            <td className="border border-gray-900 border-l-2 border-l-blue-900/50 p-0"><InputCell id={`feeder-${feeder.id}-in2`} value={feeder.in2} onChange={(v) => updateFeeder(feeder.id, 'in2', v)} className="text-[13px] text-[#d1d5db]" /></td>
            <td className="border border-gray-900 p-0"><InputCell id={`feeder-${feeder.id}-iz2`} value={feeder.iz2} onChange={(v) => updateFeeder(feeder.id, 'iz2', v)} className="text-[13px] text-[#d1d5db]" /></td>
            <td className="border border-gray-900 p-0"><InputCell id={`feeder-${feeder.id}-ibInIz2`} value={feeder.ibInIz2} onChange={(v) => updateFeeder(feeder.id, 'ibInIz2', v)} className={`text-[13px] ${getStatusColor(feeder.ibInIz2)}`} /></td>
            <td className="border border-gray-900 p-0"><InputCell id={`feeder-${feeder.id}-scbSize`} value={feeder.scbSize} onChange={(v) => updateFeeder(feeder.id, 'scbSize', v)} className={`text-[13px] ${getStatusColor(feeder.scbSize)}`} /></td>

            {/* Se% */}
            <td className="border border-gray-900 border-l-2 border-l-blue-900/50 p-0"><InputCell id={`feeder-${feeder.id}-seEv`} value={feeder.seEv} onChange={(v) => updateFeeder(feeder.id, 'seEv', v)} className="text-[13px] text-[#d1d5db]" /></td>
            <td className="border border-gray-900 p-0"><InputCell id={`feeder-${feeder.id}-seEb`} value={feeder.seEb} onChange={(v) => updateFeeder(feeder.id, 'seEb', v)} className="text-[13px] text-[#d1d5db]" /></td>
            <td className="border border-gray-900 p-0"><InputCell id={`feeder-${feeder.id}-seL`} value={feeder.seL} onChange={(v) => updateFeeder(feeder.id, 'seL', v)} className="text-[13px] text-[#d1d5db]" /></td>
            <td className="border border-gray-900 p-0"><InputCell id={`feeder-${feeder.id}-seSize`} value={feeder.cableCond} readOnly={true} bgClass="bg-transparent" className={`text-[13px] ${getStatusColor(feeder.seSize)}`} /></td>

            {/* SSC */}
            <td className="border border-gray-900 border-l-2 border-l-blue-900/50 p-0"><InputCell id={`feeder-${feeder.id}-sscTn`} value={feeder.sscTn} onChange={(v) => updateFeeder(feeder.id, 'sscTn', v)} className="text-[13px] text-[#d1d5db]" /></td>
            <td className="border border-gray-900 p-0"><InputCell id={`feeder-${feeder.id}-sscIsc`} value={feeder.sscIsc} onChange={(v) => updateFeeder(feeder.id, 'sscIsc', v)} className="text-[13px] text-[#d1d5db]" /></td>
            <td className="border border-gray-900 p-0"><InputCell id={`feeder-${feeder.id}-sscCalc`} value={feeder.sscCalc} onChange={(v) => updateFeeder(feeder.id, 'sscCalc', v)} className="text-[13px] text-[#d1d5db]" /></td>
            <td className="border border-gray-900 p-0"><InputCell id={`feeder-${feeder.id}-sscStatus`} value={feeder.sscSize} readOnly={true} bgClass="bg-transparent" className={`text-[13px] ${getStatusColor(feeder.sscStatus)}`} /></td>

            {/* SMSE% */}
            <td className="border border-gray-900 border-l-2 border-l-blue-900/50 p-0"><InputCell value={feeder.smseEv || '-'} readOnly={true} bgClass="bg-transparent" className="text-[13px] !text-[#d1d5db]" /></td>
            <td className="border border-gray-900 p-0"><InputCell value={feeder.smseEPer || '-'} readOnly={true} bgClass="bg-transparent" className="text-[13px] !text-[#d1d5db]" /></td>
            <td className="border border-gray-900 p-0"><InputCell value={(isSmseExpanded ? feeder.smseLimit : feeder.smIms) || '-'} readOnly={true} bgClass="bg-transparent" className="text-[13px] !text-[#d1d5db]" /></td>
            {isSmseExpanded && <td className="border border-gray-900 p-0"><InputCell value={feeder.smIms || '-'} readOnly={true} bgClass="bg-transparent" className="text-[13px] !text-[#d1d5db]" /></td>}
            <td className="border border-gray-900 p-0"><InputCell id={`feeder-${feeder.id}-smSize`} value={feeder.smseRecommendedSize || '-'} readOnly={true} bgClass="bg-transparent" className={`text-[13px] ${getStatusColor(feeder.smSize)}`} /></td>
            {/* SMS */}
            <td className="border border-gray-900 border-l-2 border-l-blue-900/50 p-0"><InputCell value={feeder.smsIms || '-'} readOnly={true} bgClass="bg-transparent" className="text-[13px] !text-[#d1d5db]" /></td>
            <td className="border border-gray-900 p-0"><InputCell value={feeder.smsTm || '-'} readOnly={true} bgClass="bg-transparent" className="text-[13px] !text-[#d1d5db]" /></td>
            <td className="border border-gray-900 p-0"><InputCell value={feeder.smsInsulation || '-'} readOnly={true} bgClass="bg-transparent" className="text-[13px] !text-[#d1d5db]" /></td>
            <td className="border border-gray-900 p-0"><InputCell id={`feeder-${feeder.id}-smsStatus`} value={feeder.smsSize || '-'} readOnly={true} bgClass="bg-transparent" className={`text-[13px] ${getStatusColor(feeder.smsStatus)}`} /></td>

            {/* PF, Eff */}
            <td className="border border-gray-900 border-l-2 border-l-blue-900/50 p-0"><InputCell value={feeder.pf} readOnly={true} bgClass="bg-transparent" className="text-[13px] !text-[#d1d5db]" /></td>
            <td className="border border-gray-900 p-0"><InputCell value={feeder.eff} readOnly={true} bgClass="bg-transparent" className="text-[13px] !text-[#d1d5db]" /></td>

            {/* R, X */}
            <td className="border border-gray-900 border-l-2 border-l-blue-900/50 p-0"><InputCell value={feeder.r} readOnly={true} bgClass="bg-transparent" className="text-[13px] !text-[#d1d5db]" /></td>
            <td className="border border-gray-900 p-0"><InputCell value={feeder.x} readOnly={true} bgClass="bg-transparent" className="text-[13px] !text-[#d1d5db]" /></td>

            {/* Dist to Method */}
            <td className="border border-gray-900 border-l-2 border-l-blue-900/50 p-0"><InputCell value={feeder.dist} readOnly={true} bgClass="bg-transparent" className="text-[13px] !text-[#d1d5db]" /></td>
            <td className="border border-gray-900 p-0"><InputCell value={feeder.tray} readOnly={true} bgClass="bg-transparent" className="text-[13px] !text-[#d1d5db]" /></td>
            <td className="border border-gray-900 p-0"><InputCell value={feeder.air} readOnly={true} bgClass="bg-transparent" className="text-[13px] !text-[#d1d5db]" /></td>
            <td className="border border-gray-900 p-0"><InputCell value={feeder.ground} readOnly={true} bgClass="bg-transparent" className="text-[13px] !text-[#d1d5db]" /></td>
            <td className="border border-gray-900 p-0"><InputCell value={feeder.buried} readOnly={true} bgClass="bg-transparent" className="text-[13px] !text-[#d1d5db]" /></td>
            <td className="border border-gray-900 p-0"><InputCell value={feeder.thermal} readOnly={true} bgClass="bg-transparent" className="text-[13px] !text-[#d1d5db]" /></td>
            <td className="border border-gray-900 border-l-2 border-l-blue-900/50 p-0 relative">
                {((feeder.toId || feeder.capacityKva || feeder.capacityKw) && (!feeder.method || !feederChker.isCableMethodValid(feeder, kecSettings))) && (
                    <div className="absolute bottom-[90%] left-1/2 -translate-x-1/2 z-50 flex flex-col items-center animate-bounce pointer-events-none">
                        <div className="bg-red-600/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-sm shadow-lg whitespace-nowrap border border-red-500/30 relative">
                            Chk.
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-red-600/70 rotate-45 border-r border-b border-red-500/30"></div>
                        </div>
                    </div>
                )}
                <InputCell
                    id={`feeder-${feeder.id}-method`}
                    value={feeder.method}
                    readOnly={true}
                    bgClass="bg-transparent"
                    placeholder="Method"
                    className={`font-normal text-center text-[13px] ${(!feeder.method || !feederChker.isCableMethodValid(feeder, kecSettings)) ? '!text-red-500' : 'text-purple-400'}`}
                />
            </td>

            {/* Cable Select */}
            <td className="border border-gray-900 border-l-2 border-l-blue-900/50 p-0"><InputCell value={feeder.cableVolt} readOnly={true} bgClass="bg-transparent" className="text-[13px] !text-[#d1d5db]" /></td>
            <td className="border border-gray-900 p-0"><InputCell value={feeder.cableIns} readOnly={true} bgClass="bg-transparent" className="text-[13px] !text-purple-400 font-normal" /></td>
            <td className="border border-gray-900 p-0"><InputCell value={feeder.cableCore} readOnly={true} bgClass="bg-transparent" className="text-[13px] !text-purple-400 font-normal" /></td>
            <td className="border border-gray-900 p-0 relative">
                {(feeder.toId || feeder.capacityKva || feeder.capacityKw) && !feeder.cableCond && (
                    <div className="absolute bottom-[90%] left-1/2 -translate-x-1/2 z-50 flex flex-col items-center animate-bounce pointer-events-none">
                        <div className="bg-red-600/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-sm shadow-lg whitespace-nowrap border border-red-500/30 relative">
                            Chk.
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-red-600/70 rotate-45 border-r border-b border-red-500/30"></div>
                        </div>
                    </div>
                )}
                <InputCell id={`feeder-${feeder.id}-cableCond`} value={feeder.cableCond} readOnly={true} bgClass="bg-transparent" className={`text-[13px] font-normal ${!feeder.cableCond ? '!text-red-500' : '!text-purple-400'}`} />
            </td>
            <td className="border border-gray-900 p-0"><InputCell value={feeder.cableCondArea} readOnly={true} bgClass="bg-transparent" className="text-[13px] !text-[#d1d5db]" /></td>
            <td className="border border-gray-900 p-0"><InputCell value={feeder.cableLine} readOnly={true} bgClass="bg-transparent" className="text-[13px] !text-blue-400" /></td>
            <td className="border border-gray-900 p-0"><InputCell value={feeder.cableX || '-'} readOnly={true} bgClass="bg-transparent" className="text-[13px] !text-[#d1d5db]" /></td>

            {/* New Cable Specs */}
            <td className="border border-gray-900 border-l-2 border-l-blue-900/50 p-0"><InputCell value={feeder.cablePe} readOnly={true} bgClass="bg-transparent" className="text-[13px] !text-purple-400 font-normal" /></td>
            <td className="border border-gray-900 p-0"><InputCell value={feeder.cableOuterD} readOnly={true} bgClass="bg-transparent" className="text-[13px] !text-[#d1d5db]" /></td>
            <td className="border border-gray-900 p-0"><InputCell value={feeder.cablePeLine || '-'} readOnly={true} bgClass="bg-transparent" className="text-[13px] !text-[#d1d5db]" /></td>

            {/* Conduit Select */}
            <td className="border border-gray-900 border-l-2 border-l-blue-900/50 p-0 text-center relative">
                {(feeder.toId || feeder.capacityKva || feeder.capacityKw) && (!feeder.conduitMat || !feederChker.isMaterialMethodValid(feeder)) && (
                    <div className="absolute bottom-[90%] left-1/2 -translate-x-1/2 z-50 flex flex-col items-center animate-bounce pointer-events-none">
                        <div className="bg-red-600/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-sm shadow-lg whitespace-nowrap border border-red-500/30 relative">
                            Chk.
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-red-600/70 rotate-45 border-r border-b border-red-500/30"></div>
                        </div>
                    </div>
                )}
                <InteractiveDivCell
                    id={`feeder-${feeder.id}-conduitMat`}
                    value={feeder.conduitMat}
                    onClick={(e) => handleDropdownInteract(e, '', ['TRAY', 'ELP', 'ST', 'CD', 'HI'], (v) => updateFeeder(feeder.id, 'conduitMat', v), 'center', feeder.conduitMat)}
                    onKeyDown={handleDropdownKeyDown}
                    placeholder="MAT"
                    className={`font-normal text-center text-[13px] ${(!feeder.conduitMat || !feederChker.isMaterialMethodValid(feeder)) ? '!text-red-500 z-10' : 'text-yellow-400'}`}
                />
            </td>
            <td className="border border-gray-900 p-0 relative">
                <InputCell 
                    id={`feeder-${feeder.id}-conduitNom`}
                    value={feeder.conduitNom} 
                    readOnly={true} 
                    bgClass="bg-transparent" 
                    className={`text-[13px] ${
                        !feederChker.isNominalValid(feeder) 
                        ? '!text-red-500 font-normal' 
                        : '!text-blue-400 font-normal'
                    }`} 
                />
            </td>
            <td className="border border-gray-900 p-0"><InputCell value={feeder.conduitLine} readOnly={true} bgClass="bg-transparent" className="text-[13px] !text-blue-400" /></td>
            <td className="border border-gray-900 p-0"><InputCell value={feeder.conduitIn} readOnly={true} bgClass="bg-transparent" className="text-[13px] !text-[#d1d5db]" /></td>
            <td className="border border-gray-900 p-0">
                <InputCell 
                    value={feeder.conduitTotal} 
                    readOnly={true} 
                    bgClass="bg-transparent" 
                    className={`${
                        !feeder.conduitTotal ? 'text-[13px]' :
                        feeder.conduitTotal.length > 11 ? 'text-[9px]' :
                        feeder.conduitTotal.length > 9 ? 'text-[11px]' : 
                        'text-[13px]'
                    } text-[#d1d5db] !text-[#d1d5db]`} 
                />
            </td>

            {/* Review Section */}
            <td className="border border-gray-900 border-l-2 border-l-blue-900/50 p-0">
                <div 
                    className={`text-[13px] font-bold text-center py-2 ${feederChker.getRowStatus(feeder, kecSettings) === 'FAIL' ? 'text-red-500 cursor-pointer hover:bg-red-500/10' : 'text-green-500'}`}
                    onClick={() => {
                        if (feederChker.getRowStatus(feeder, kecSettings) === 'FAIL') {
                            const errorField = feederChker.getFirstErrorField(feeder, kecSettings);
                            if (errorField) {
                                const element = document.getElementById(`feeder-${feeder.id}-${errorField}`);
                                if (element) {
                                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    setTimeout(() => {
                                        element.focus();
                                        // If it's a div (InteractiveDivCell), we might want to trigger its click
                                        if (element.tagName === 'DIV') {
                                            element.click();
                                        }
                                    }, 300);
                                }
                            }
                        }
                    }}
                >
                    {feederChker.getRowStatus(feeder)}
                </div>
            </td>
        </tr>
    );
});

export default FeederRow;

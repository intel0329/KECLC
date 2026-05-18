import React from 'react';
import { ChevronRight, ChevronLeft, Plus } from 'lucide-react';
import { TableHeader, TableHeader2, InputCell, SelectCell, CornerBorders } from '../ui/PowerLoadUI';

const PowerLoadTable = ({
    isExtraExpanded,
    setIsExtraExpanded,
    calculatedLoads,
    selectedRows,
    handleRowClick,
    handleContextMenu,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
    draggedRow,
    dropTarget,
    updatePowerLoad,
    addPowerLoad,
    handleCapacityFocus,
    openParallelPopup,
    openJudgmentDrawer,
    BREAKER_TYPES,
    projectInfo,
    kecSettings,
    getMethodDisabledOptions
}) => {
    return (
        <div className="border border-gray-900 bg-black relative overflow-hidden mb-8">
            <CornerBorders />
            <div className="overflow-x-auto">
                <table className="w-full border-collapse min-w-[1386px] table-auto">
                    <thead>
                        <tr className="border-b border-gray-900">
                            <th colSpan={isExtraExpanded ? 36 : 31} className="px-4 py-3 text-[12px] font-semibold text-gray-300 uppercase tracking-[0.2em] text-left border-l-2 border-r-2 border-blue-500/20">
                                Power Load Circuit
                            </th>
                        </tr>
                        <tr className="bg-black">
                            <TableHeader label="No." className="w-[30px] min-w-[30px] border-l-2 border-blue-500/20" />
                            <TableHeader2 label="동력설비" subLabel="설비명" className="w-[170px] min-w-[170px]" />
                            <TableHeader2 label="회로" subLabel="NO." className="w-[50px] min-w-[50px]" />
                            <TableHeader2 label="종류" subLabel="TYPE" className="w-[55px] min-w-[55px]" />
                            <TableHeader2 label="전원" subLabel="PHASE" className="w-[55px] min-w-[55px]" />
                            <TableHeader2 label="전압" subLabel="V" className="w-[40px] min-w-[40px]" />
                            <TableHeader2 label="피상전력" subLabel="kVA" className="w-[52px] min-w-[52px]" />
                            <TableHeader2 label="유효전력" subLabel="kW" className="w-[52px] min-w-[52px]" />
                            <TableHeader2 label="설계전류" className="w-[52px] min-w-[52px]">I<sub>B</sub></TableHeader2>
                            <TableHeader2 label="기동전류" className="w-[52px] min-w-[52px]">I<sub>MS</sub></TableHeader2>
                            <TableHeader2 label="돌입전류" className="w-[52px] min-w-[52px]">I<sub>MI</sub></TableHeader2>
                            <TableHeader2 label="역률" subLabel="cosθ" className="w-[50px] min-w-[50px]" />
                            <TableHeader2 label="효율" subLabel="η" className="w-[45px] min-w-[45px]" />
                            <TableHeader2 label="기동" subLabel="방식" className="w-[46px] min-w-[46px]" />
                            <TableHeader2 label="기동시간" className="w-[50px] min-w-[50px]">t<sub>m</sub></TableHeader2>
                            <TableHeader2 label="차단기" subLabel="TYPE" className="w-[50px] min-w-[50px]" />
                            <TableHeader2 label="극수" subLabel="P" className="w-[30px] min-w-[30px]" />
                            <TableHeader2 label="프레임" subLabel="AF" className="w-[40px] min-w-[40px]" />
                            <TableHeader2 label="정격" subLabel="AT" className="w-[40px] min-w-[40px]" />
                            <TableHeader2 label="변류기" subLabel="CT" className="w-[50px] min-w-[50px]" />
                            <TableHeader2 label="콘덴서" subLabel="uF" className="w-[50px] min-w-[50px]" />
                            <TableHeader2 label="공사" subLabel="방법" className="w-[45px] min-w-[45px]" />
                            <TableHeader2 label="WIRE" subLabel="종류" className="w-[45px] min-w-[45px]" />
                            <TableHeader2 label="도체" subLabel="㎟" className="w-[45px] min-w-[45px]" />
                            <TableHeader2 label="코어" subLabel="C" className="w-[35px] min-w-[35px]" />
                            <TableHeader2 label="라인" subLabel="L" className="w-[35px] min-w-[35px]" />
                            <TableHeader2 label="접지" subLabel="PE" className="w-[35px] min-w-[35px]" />
                            <TableHeader2 label="UNIT SIZE" subLabel="mm" className="w-[50px] min-w-[50px] whitespace-normal leading-none" />
                            <th className="border border-gray-900 bg-black px-1 py-1 text-center whitespace-nowrap w-[30px] min-w-[30px] border-r-2 border-blue-500/20 relative group/expand">
                                <button
                                    onClick={() => setIsExtraExpanded(!isExtraExpanded)}
                                    className="absolute top-1 left-1/2 -translate-x-1/2 flex items-center justify-center transition-colors"
                                    title={isExtraExpanded ? "접기" : "상세보기 펼치기"}
                                >
                                    {isExtraExpanded ? <ChevronLeft size={16} className="text-yellow-500" /> : <ChevronRight size={16} className="text-gray-500 group-hover/expand:text-yellow-500" />}
                                </button>
                                <div className="text-[13px] font-bold text-[#d1d5db] mt-[18px]">Chk</div>
                            </th>
                            {isExtraExpanded && (
                                <>
                                    <TableHeader2 label="규약" subLabel="δ" className="w-[40px] min-w-[40px] bg-blue-500/5" />
                                    <TableHeader2 label="순시" subLabel="δ₂" className="w-[40px] min-w-[40px] bg-blue-500/5" />
                                    <TableHeader2 label="입력" subLabel="kVA" className="w-[65px] min-w-[65px] bg-green-500/5 text-green-400" />
                                    <TableHeader2 label="기동" subLabel="kVA" className="w-[65px] min-w-[65px] bg-green-500/5 text-green-400" />
                                    <TableHeader2 label="전류" subLabel="A" className="w-[50px] min-w-[50px] bg-purple-500/5 text-purple-400 border-r-2 border-blue-500/20" />
                                </>
                            )}
                        </tr>
                    </thead>
                    <tbody className="outline-none" tabIndex={0}>
                        {calculatedLoads.map((load, idx) => {
                            const isSelected = selectedRows.includes(load.id);
                            const isDropTarget = dropTarget?.id === load.id;
                            const dropPosition = dropTarget?.position;
                            const isDragging = draggedRow === load.id;

                            return (
                                <tr
                                    key={load.id}
                                    className={`group transition-colors h-[48px] relative border-l-2 border-r-2 border-l-transparent border-r-transparent border-b border-gray-900
                                        ${isSelected ? 'bg-lime-500/10' : 'hover:bg-gray-900/50'}
                                        ${isDropTarget && dropPosition === 'above' ? 'border-t-2 border-t-lime-500' : ''}
                                        ${isDropTarget && dropPosition === 'below' ? 'border-b-2 border-b-lime-500' : ''}
                                        ${isDragging ? 'opacity-50' : ''}
                                    `}
                                >
                                    <td
                                        className={`border-r border-gray-900 p-1 w-[30px] min-w-[30px] text-center border-l-2 border-blue-500/20
                                            ${isSelected ? 'text-[#d1d5db]' : 'text-[#d1d5db]'}
                                            cursor-grab active:cursor-grabbing hover:text-white transition-colors select-none text-[13px]`}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, load.id)}
                                        onDragOver={(e) => handleDragOver(e, load.id)}
                                        onDragLeave={handleDragLeave}
                                        onDrop={(e) => handleDrop(e, load.id)}
                                        onDragEnd={handleDragEnd}
                                        onContextMenu={(e) => handleContextMenu(e, load.id)}
                                        onClick={(e) => handleRowClick(load.id, e)}
                                    >
                                        {idx + 1}
                                    </td>
                                    <td className="border-r border-gray-900 p-0 w-[170px] min-w-[170px] cursor-pointer" onClick={(e) => handleRowClick(load.id, e)} onContextMenu={(e) => handleContextMenu(e, load.id)}>
                                        <InputCell value={load.equipmentName} onChange={(v) => updatePowerLoad(load.id, 'equipmentName', v)} className="text-yellow-400 text-[13px]" />
                                    </td>
                                    <td className="border-r border-gray-900 p-0 w-[50px] min-w-[50px]">
                                        <InputCell value={load.circuitNo} onChange={(v) => updatePowerLoad(load.id, 'circuitNo', v)} className="text-yellow-400 text-[13px]" />
                                    </td>
                                    <td className="border-r border-gray-900 p-0 w-[55px] min-w-[55px]">
                                        <SelectCell value={load.type} onChange={(v) => updatePowerLoad(load.id, 'type', v)} options={['MOTOR', 'PUMP', 'LOAD', 'SPARE']} placeholder="TYPE" className="text-yellow-400 text-[13px]" />
                                    </td>
                                    <td className="border-r border-gray-900 p-0 w-[55px] min-w-[55px]">
                                        <SelectCell value={load.phase} onChange={(v) => updatePowerLoad(load.id, 'phase', v)} options={['1Φ-2W', '3Φ-3W', '3Φ-4W']} placeholder="PHASE" className="text-yellow-400 text-[13px]" />
                                    </td>
                                    <td className="border-r border-gray-900 p-0 w-[40px] min-w-[40px] text-center text-sky-400 text-[13px]">
                                        {load.voltage || '-'}
                                    </td>
                                    <td className="border-r border-gray-900 p-0 w-[52px] min-w-[52px]">
                                        <InputCell value={load.apparentPower} onChange={(v) => updatePowerLoad(load.id, 'apparentPower', v)} onFocus={() => handleCapacityFocus(load.id, 'apparentPower')} type="text" readOnly={load.type !== 'LOAD' && load.type !== ''} noBackground={true} className="text-yellow-400 text-[13px]" />
                                    </td>
                                    <td className="border-r border-gray-900 p-0 w-[52px] min-w-[52px] text-center text-[13px]">
                                        <InputCell value={load.effectivePower} onChange={(v) => updatePowerLoad(load.id, 'effectivePower', v)} onFocus={() => handleCapacityFocus(load.id, 'effectivePower')} type="text" readOnly={load.type === 'LOAD' || load.type === 'SPARE'} noBackground={true} className="text-yellow-400 text-[13px]" />
                                    </td>
                                    <td className="border-r border-gray-900 p-0 w-[52px] min-w-[52px] text-center text-[#d1d5db] text-[13px]">{load.designCurrent || '-'}</td>
                                    <td className="border-r border-gray-900 p-0 w-[52px] min-w-[52px] text-center text-[#d1d5db] text-[13px]">{load.startingCurrent || '-'}</td>
                                    <td className="border-r border-gray-900 p-0 w-[52px] min-w-[52px] text-center text-[#d1d5db] text-[13px]">{load.inrushCurrent || '-'}</td>
                                    
                                    <td className="border-r border-gray-900 p-0 w-[50px] min-w-[50px] text-center text-[#d1d5db] text-[13px]">
                                        {load.displayPF}
                                    </td>
                                    <td className="border-r border-gray-900 p-0 w-[45px] min-w-[45px] text-center text-[#d1d5db] text-[13px]">
                                        {load.displayEff}
                                    </td>
                                    <td className="border-r border-gray-900 p-0 w-[46px] min-w-[46px]">
                                        <SelectCell
                                            value={load.startingMethod}
                                            onChange={(v) => updatePowerLoad(load.id, 'startingMethod', v)}
                                            options={load.type === 'LOAD' ? ['-', 'INV'] : ['DOL', 'Y-D', 'INV', '리액터']}
                                            placeholder={load.type === 'LOAD' ? "-" : "방식"}
                                            className="text-yellow-400 text-[13px]"
                                        />
                                    </td>
                                    <td className="border-r border-gray-900 p-0 w-[50px] min-w-[50px]">
                                        <InputCell
                                            value={load.startingTime}
                                            onChange={(v) => updatePowerLoad(load.id, 'startingTime', v)}
                                            type="text"
                                            placeholder={load.startingTime}
                                            className={`${load.isManualTm ? 'text-yellow-400' : 'text-green-400'} text-[13px]`}
                                        />
                                    </td>
                                    <td className="border-r border-gray-900 p-0 w-[50px] min-w-[50px]">
                                        <SelectCell value={load.cbType} onChange={(v) => updatePowerLoad(load.id, 'cbType', v)} options={BREAKER_TYPES} placeholder="Type" className="text-yellow-400 text-[13px]" />
                                    </td>
                                    <td className="border-r border-gray-900 p-0 w-[30px] min-w-[30px]">
                                        <div className="flex flex-col h-full">
                                            <SelectCell
                                                value={load.cbP}
                                                onChange={(v) => updatePowerLoad(load.id, 'cbP', v)}
                                                options={['4', '3', '2']}
                                                placeholder="P"
                                                className="text-[#d1d5db] text-[13px]"
                                                heightClass={load.cbP === '2' ? "h-[24px]" : "h-[48px]"}
                                            />
                                            {load.cbP === '2' && (
                                                <SelectCell
                                                    value={load.phaseLine || 'L1'}
                                                    onChange={(v) => updatePowerLoad(load.id, 'phaseLine', v)}
                                                    options={['L1', 'L2', 'L3']}
                                                    className="text-sky-400 text-[10px] border-t border-gray-900"
                                                    heightClass="h-[24px]"
                                                />
                                            )}
                                        </div>
                                    </td>
                                    <td className="border-r border-gray-900 p-0 w-[40px] min-w-[40px] text-center text-[#d1d5db] text-[13px]">{load.af || '-'}</td>
                                    <td className="border-r border-gray-900 p-0 w-[40px] min-w-[40px]">
                                        <div className="relative w-full h-[48px] flex justify-center items-center">
                                            {(() => {
                                                const isAtHigherThanMain = (Number(load.at) || 0) >= (Number(projectInfo?.mccbAT) || 999999);
                                                if (isAtHigherThanMain) {
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
                                            <InputCell 
                                                value={load.at} 
                                                onChange={(v) => updatePowerLoad(load.id, 'at', v)} 
                                                className={`${(Number(load.at) || 0) >= (Number(projectInfo?.mccbAT) || 999999) ? '!text-red-500 font-bold' : 'text-yellow-400'} text-[13px]`} 
                                            />
                                        </div>
                                    </td>
                                    <td className="border-r border-gray-900 p-0 w-[50px] min-w-[50px]">
                                        <InputCell value={load.startingMethod === 'INV' ? '-' : load.ct} onChange={(v) => updatePowerLoad(load.id, 'ct', v)} className="text-[#d1d5db] text-[13px]" readOnly={load.startingMethod === 'INV'} />
                                    </td>
                                    <td className="border-r border-gray-900 p-0 w-[50px] min-w-[50px]">
                                        <InputCell value={load.startingMethod === 'INV' ? '-' : load.capacitor} onChange={(v) => updatePowerLoad(load.id, 'capacitor', v)} className="text-[#d1d5db] text-[13px]" readOnly={load.startingMethod === 'INV'} />
                                    </td>
                                    <td className="border-r border-gray-900 p-0 w-[45px] min-w-[45px]">
                                        <SelectCell 
                                            value={load.method} 
                                            onChange={(v) => {
                                                if (v === 'X') {
                                                    openParallelPopup(load.id);
                                                } else {
                                                    updatePowerLoad(load.id, 'method', v);
                                                }
                                            }} 
                                            options={[
                                                'A1', 'A2', 'B1', 'B2', 'C', 'D', 'E', 'F', 'X',
                                                ...(load.method && load.method.toUpperCase().includes('X') && !['A1', 'A2', 'B1', 'B2', 'C', 'D', 'E', 'F', 'X'].includes(load.method.toUpperCase()) ? [load.method.toUpperCase()] : [])
                                            ]}
                                            disabledOptions={getMethodDisabledOptions(load, kecSettings)}
                                            placeholder="공사"
                                            className="text-yellow-400 text-[13px]" 
                                        />
                                    </td>
                                    <td className="border-r border-gray-900 p-0 w-[45px] min-w-[45px]">
                                        <SelectCell value={load.wire} onChange={(v) => updatePowerLoad(load.id, 'wire', v)} options={['FCV', 'FR8', 'HFIX']} placeholder="WIRE" className="text-yellow-400 text-[13px]" />
                                    </td>
                                    <td className="border-r border-gray-900 p-0 w-[45px] min-w-[45px]">
                                        <SelectCell
                                            value={load.size}
                                            onChange={(v) => updatePowerLoad(load.id, 'size', v)}
                                            options={['1.5', '2.5', '4', '6', '10', '16', '25', '35', '50', '70', '95', '120', '150', '185', '240', '300']}
                                            placeholder="㎟"
                                            className="text-yellow-400 text-[13px]"
                                        />
                                    </td>
                                    <td className="border-r border-gray-900 p-0 w-[35px] min-w-[35px] text-center text-[#d1d5db] text-[13px]">{load.c || '-'}</td>
                                    <td className="border-r border-gray-900 p-0 w-[35px] min-w-[35px] text-center text-[#d1d5db] text-[13px]">{load.l || '-'}</td>
                                    <td className="border-r border-gray-900 p-0 w-[35px] min-w-[35px] text-center text-[#d1d5db] text-[13px]">{load.pe || '-'}</td>
                                    <td className="border-r border-gray-900 p-0 w-[50px] min-w-[50px]">
                                        <InputCell 
                                            value={load.unitSize} 
                                            onChange={(v) => updatePowerLoad(load.id, 'unitSize', v)} 
                                            className="text-[#d1d5db] text-[13px]" 
                                        />
                                    </td>
                                    
                                    <td className="border-r-2 border-blue-500/20 p-0 w-[30px] min-w-[30px]">
                                        <div 
                                            className="w-full h-full cursor-pointer hover:bg-white/5 transition-colors relative flex items-center justify-center"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                let firstFail = null;
                                                if (load.chk === 'Fail' || load.chk === 'Error' || load.chk === 'Chk') {
                                                    if (load.kecJudgment) {
                                                        const sections = ['at_b', 'at_th', 'at_sc', 'at_ms', 'at_mi', 'sb', 'scb', 'se', 'smse', 'ssc', 'smsth'];
                                                        for (const sec of sections) {
                                                            const status = load.kecJudgment[sec]?.status;
                                                            if (status === 'Fail' || status === 'Error' || status === 'Chk') {
                                                                firstFail = sec;
                                                                break;
                                                            }
                                                        }
                                                    }
                                                }
                                                openJudgmentDrawer(load.id, firstFail);
                                            }}
                                        >
                                            <InputCell 
                                                value={load.chk} 
                                                readOnly 
                                                noBackground={true}
                                                className={`${load.chk === 'Ok' ? '!text-green-500' : load.chk === 'Fail' ? '!text-red-500' : '!text-[#d1d5db]'} text-[13px] cursor-pointer text-center font-bold`} 
                                            />
                                        </div>
                                    </td>

                                    {isExtraExpanded && (
                                        <>
                                            <td className="p-0 w-[40px] min-w-[40px] text-center text-[12px] text-blue-400 bg-blue-500/5 border-r border-gray-900 font-mono">
                                                {load.kecJudgment?.at_ms?.delta || '-'}
                                            </td>
                                            <td className="p-0 w-[40px] min-w-[40px] text-center text-blue-400 bg-blue-500/5 border-r border-gray-900 font-mono text-[12px]">
                                                {load.kecJudgment?.at_mi?.multiplierValue || '-'}
                                            </td>
                                            <td className="p-0 w-[65px] min-w-[65px] text-center text-[12px] text-green-400 bg-green-500/5 border-r border-gray-900 font-mono uppercase">
                                                {load.apparentPowerInput || '0.00'}
                                            </td>
                                            <td className="p-0 w-[65px] min-w-[65px] text-center text-[12px] text-green-400 bg-green-500/5 border-r border-gray-900 font-mono uppercase">
                                                {load.startingKva || '0.00'}
                                            </td>
                                            <td className="p-0 w-[50px] min-w-[50px] text-center text-[12px] text-purple-400 bg-purple-500/5 border-r-2 border-blue-500/20 font-mono">
                                                {load.designCurrent || '0.00'}
                                            </td>
                                        </>
                                    )}
                                </tr>
                            );
                        })}
                        <tr className="hover:bg-gray-900/30">
                            <td colSpan={isExtraExpanded ? 36 : 31} className="p-2 border-l-2 border-r-2 border-b-2 border-blue-500/20">
                                <button
                                    onClick={addPowerLoad}
                                    className="flex items-center gap-2 text-green-500 hover:text-green-400 text-[12px] font-bold uppercase tracking-widest pl-2"
                                >
                                    <Plus size={14} />
                                    Add Power Load
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default PowerLoadTable;

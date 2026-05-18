import React from 'react';
import { createPortal } from 'react-dom';
import { Save, Plus, Minus, Trash2, X, ChevronDown, ChevronRight, PieChart, Info, AlertTriangle, FileSpreadsheet, Layers, Filter } from 'lucide-react';
import { CornerBorders } from '../ui/PanelLoadUI';
import ExcelImportSection from '../../../utils/excel/ExcelImportSection'; // [Path Updated]

export const ActionModals = (props) => {
    const {
        contextMenu,
        closeContextMenu,
        handleCopy,
        handleCut,
        handlePaste,
        handleInsertPaste,
        handleInsertRow,
        handleDeleteSelected,
        selectedCircuits,
        clipboard,
        showExportSaveModal,
        setShowExportSaveModal,
        performExcelExport,
        handleExportSaveConfirm,
        deleteConfirm,
        setDeleteConfirm,
        confirmDelete,
        loadModal,
        leftCircuits,
        rightCircuits,
        closeLoadModal,
        addModalLoadRow,
        removeModalLoadRow,
        updateModalLoad,
        plSearchText,
        setPlSearchText,
        setActivePLDropdown,
        activePLDropdown,
        setPlSelectedIndex,
        updateDropdownPosition,
        handleSelectPLPanel,
        filteredPLPanels,
        plSelectedIndex,
        plDropdownPos,
        saveLoads,
        getModalTotalVA,
        getNameById,
        setLoadModal // [NEW] 엑셀 임포트 결과 반영을 위한 세터
    } = props;

    // 엑셀 임포트 섹션 표시 여부 상태
    const [showExcelImport, setShowExcelImport] = React.useState(false);

    return (
        <>
            {/* Context Menu (Right-click menu) */}
            {contextMenu.show && (
                <>
                    {/* Backdrop to close menu */}
                    <div
                        className="fixed inset-0 z-[999]"
                        onClick={closeContextMenu}
                        onContextMenu={(e) => { e.preventDefault(); closeContextMenu(); }}
                    />
                    {/* Menu */}
                    <div
                        className="fixed z-[1000] bg-gray-950 border border-gray-800 shadow-xl min-w-[150px] py-1"
                        style={{ left: contextMenu.x, top: contextMenu.y }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <CornerBorders />
                        {/* Menu Title Header */}
                        {(() => {
                            const firstSelected = selectedCircuits.length > 0 ? selectedCircuits[0] : null;
                            if (firstSelected) {
                                const circuits = firstSelected.side === 'left' ? leftCircuits : rightCircuits;
                                const circuit = circuits.find(c => c.row === firstSelected.row);
                                const title = circuit?.loadName || (circuit?.circuitNo ? `회로 ${circuit.circuitNo}` : '선택된 회로');
                                return (
                                <div className="px-4 py-2 border-b border-gray-900/50 mb-1">
                                    <div className="text-sm font-bold text-gray-300 truncate pr-2">{title}</div>
                                </div>
                                );
                            }
                            return null;
                        })()}
                        {selectedCircuits.length > 0 && (
                            <>
                                <button
                                    onClick={handleCopy}
                                    className="w-full px-4 py-2 text-left text-[11px] text-gray-300 hover:bg-blue-500/20 hover:text-white flex items-center gap-3 transition-colors"
                                >
                                    <span className="text-gray-600 w-4">📋</span>
                                    Copy
                                    <span className="ml-auto text-gray-600 text-[10px]">Ctrl+C</span>
                                </button>
                                <button
                                    onClick={handleCut}
                                    className="w-full px-4 py-2 text-left text-[11px] text-gray-300 hover:bg-blue-500/20 hover:text-white flex items-center gap-3 transition-colors"
                                >
                                    <span className="text-gray-600 w-4">✂️</span>
                                    Cut
                                    <span className="ml-auto text-gray-600 text-[10px]">Ctrl+X</span>
                                </button>
                                <div className="border-t border-gray-800 my-1" />
                            </>
                        )}
                        <button
                            onClick={handlePaste}
                            disabled={clipboard.circuits.length === 0}
                            className={`w-full px-4 py-2 text-left text-[11px] flex items-center gap-3 transition-colors ${clipboard.circuits.length > 0
                                ? 'text-gray-300 hover:bg-blue-500/20 hover:text-white'
                                : 'text-gray-700 cursor-not-allowed'
                                }`}
                        >
                            <span className="text-gray-600 w-4">📄</span>
                            Paste {clipboard.circuits.length > 0 && `(${clipboard.circuits.length})`}
                            <span className="ml-auto text-gray-600 text-[10px]">Ctrl+V</span>
                        </button>
                        <button
                            onClick={handleInsertPaste}
                            disabled={clipboard.circuits.length === 0}
                            className={`w-full px-4 py-2 text-left text-[11px] flex items-center gap-3 transition-colors ${clipboard.circuits.length > 0
                                ? 'text-gray-300 hover:bg-blue-500/20 hover:text-white'
                                : 'text-gray-700 cursor-not-allowed'
                                }`}
                        >
                            <span className="text-gray-600 w-4">📥</span>
                            Insert and Paste
                        </button>
                        <div className="border-t border-gray-800 my-1" />
                        <button
                            onClick={handleInsertRow}
                            className="w-full px-4 py-2 text-left text-[11px] text-gray-300 hover:bg-blue-500/20 hover:text-white flex items-center gap-3 transition-colors"
                        >
                            <Plus size={14} className="text-green-500" />
                            Add an circuit
                        </button>
                        {selectedCircuits.length > 0 && (
                            <>
                                <div className="border-t border-gray-800 my-1" />
                                <button
                                    onClick={handleDeleteSelected}
                                    className="w-full px-4 py-2 text-left text-[11px] text-red-400 hover:bg-red-500/20 hover:text-red-300 flex items-center gap-3 transition-colors"
                                >
                                    <span className="w-4">🗑️</span>
                                    Delete ({selectedCircuits.length})
                                    <span className="ml-auto text-gray-600 text-[10px]">Del</span>
                                </button>
                            </>
                        )}
                        <div className="border-t border-gray-800 my-1" />
                        <div className="px-4 py-2 text-[9px] text-gray-600">
                            {selectedCircuits.length > 0
                                ? `${selectedCircuits.length} circuit(s) selected`
                                : 'Right-click on circuit to select'
                            }
                        </div>
                    </div>
                </>
            )}

            {/* Export Save Confirmation Modal */}
            {showExportSaveModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={(e) => e.stopPropagation()}>
                    <div className="border border-gray-900 bg-black p-6 max-w-md w-full mx-4 relative">
                        <CornerBorders />
                        <div className="flex justify-between items-start mb-4">
                            <div className="text-gray-300 text-sm leading-relaxed">
                                최신 데이터로 엑셀을 추출하기 위해<br />
                                현재 변경 내용을 저장하시겠습니까?
                            </div>
                            <button
                                onClick={() => setShowExportSaveModal(false)}
                                className="text-gray-500 hover:text-white transition-colors -mt-1 -mr-1 p-1"
                                title="취소"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    setShowExportSaveModal(false);
                                    performExcelExport(); // Discard and just export current state
                                }}
                                className="flex-1 px-4 py-3 border border-gray-800 text-gray-400 hover:text-white hover:bg-gray-900 text-sm font-bold uppercase tracking-widest transition-all"
                            >
                                저장 안함
                            </button>
                            <button
                                onClick={handleExportSaveConfirm}
                                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold uppercase tracking-widest transition-all shadow-lg shadow-blue-900/20"
                            >
                                저장 후 추출
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirm.show && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={(e) => e.stopPropagation()}>
                    <div className="border border-gray-900 bg-black p-6 max-w-md w-full mx-4 relative">
                        <CornerBorders />
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-red-500/20 flex items-center justify-center flex-shrink-0">
                                <Trash2 className="text-red-500" size={24} />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-white font-bold mb-2">Delete Circuit?</h3>
                                <p className="text-gray-500 text-[12px] mb-4">
                                    Are you sure you want to delete this circuit? This action cannot be undone.
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setDeleteConfirm({ show: false, side: null, row: null, circuitNo: '' })}
                                        className="flex-1 px-4 py-3 border border-gray-800 text-gray-400 hover:text-white hover:bg-gray-900 text-sm font-bold uppercase tracking-widest transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={confirmDelete}
                                        className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white text-sm font-bold uppercase tracking-widest transition-all shadow-lg shadow-red-900/20"
                                    >
                                        Confirm
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Load Editing Modal - List Format */}
            {loadModal.show && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={(e) => e.stopPropagation()}>
                    <div className="border border-gray-900 bg-black p-6 max-w-2xl w-full mx-4 relative">
                        <CornerBorders />
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-white font-bold text-[16px]">
                                {(() => {
                                    const circuits = loadModal.side === 'left' ? leftCircuits : rightCircuits;
                                    const circuit = circuits.find(c => c.id === loadModal.circuitId);
                                    return circuit?.loadName || '부하 입력';
                                })()}
                            </h3>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => setShowExcelImport(!showExcelImport)}
                                    className={`text-[10px] px-2 py-1 border font-bold uppercase tracking-wider transition-all ${showExcelImport ? 'bg-green-600 border-green-500 text-white' : 'border-gray-800 text-gray-400 hover:text-white hover:border-gray-600'}`}
                                >
                                    Excel Import
                                </button>
                                <button onClick={closeLoadModal} className="text-gray-500 hover:text-white">
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Excel Import Section (Toggled) */}
                        {showExcelImport && (
                            <ExcelImportSection 
                                onImport={(newLoads) => {
                                    setLoadModal(prev => ({ ...prev, editLoads: newLoads }));
                                    setShowExcelImport(false);
                                }} 
                            />
                        )}

                        {/* Header Row */}
                        <div className="grid grid-cols-12 gap-2 mb-2 text-[11px] text-gray-400 uppercase tracking-widest">
                            <div className="col-span-1 text-center"></div>
                            <div className="col-span-2">구분</div>
                            <div className="col-span-2">종류</div>
                            <div className="col-span-2">부하</div>
                            <div className="col-span-1 text-center">수량</div>
                            <div className="col-span-2 text-center">용량</div>
                            <div className="col-span-2 text-right">합계 [VA]</div>
                        </div>

                        {/* Load Rows */}
                        <div className="space-y-2 max-h-[400px] overflow-y-auto">
                            {loadModal.editLoads.map((load, index) => (
                                <div key={load.id || index} className="grid grid-cols-12 gap-2 items-center">
                                    {/* Delete Button */}
                                    <div className="col-span-1 text-center">
                                        <button
                                            onClick={() => removeModalLoadRow(index)}
                                            className="text-red-500 hover:text-red-400 p-1"
                                            title="삭제"
                                        >
                                            <Minus size={14} />
                                        </button>
                                    </div>
                                    {/* Prefix Dropdown */}
                                    <div className="col-span-2">
                                        <select
                                            value={load.prefix || ''}
                                            onChange={(e) => updateModalLoad(index, 'prefix', e.target.value)}
                                            disabled={load.category === 'PL'}
                                            className={`w-full bg-gray-900 border border-gray-800 px-1 py-1.5 text-[11px] outline-none focus:border-yellow-500 font-bold ${load.category === 'PL' ? 'opacity-50 cursor-not-allowed' : ''} ${load.prefix === '일괄소등' ? 'text-yellow-400' :
                                                load.prefix === '감전보호' ? 'text-sky-400' :
                                                    load.prefix === 'On/Off' ? 'text-orange-400' :
                                                        load.prefix === '타이머' ? 'text-white' :
                                                            'text-gray-400'
                                                }`}
                                        >
                                            <option value="" className="text-gray-400">- 선택 -</option>
                                            <option value="감전보호" className="text-sky-400">감전보호</option>
                                            <option value="On/Off" className="text-orange-400">On/Off</option>
                                            <option value="타이머" className="text-white">타이머</option>
                                            <option value="일괄소등" className="text-yellow-400">일괄소등</option>
                                        </select>
                                    </div>
                                    {/* Category Dropdown */}
                                    <div className="col-span-2">
                                        <select
                                            value={load.category || '기타'}
                                            onChange={(e) => updateModalLoad(index, 'category', e.target.value)}
                                            className="w-full bg-gray-900 border border-gray-800 px-1 py-1.5 text-[11px] outline-none focus:border-yellow-500 font-bold text-white"
                                        >
                                            <option value="동력">동력</option>
                                            <option value="전열">전열</option>
                                            <option value="전등">전등</option>
                                            <option value="PL">PL</option>
                                            <option value="예비">예비</option>
                                            <option value="기타">기타</option>
                                        </select>
                                    </div>
                                    {/* Name Input */}
                                    <div className="col-span-2 relative" data-pl-dropdown={index}>
                                        <input
                                            type="text"
                                            value={load.category === 'PL' && activePLDropdown === index ? plSearchText : (load.category === 'PL' && load.connectedPanelId ? getNameById(load.connectedPanelId) || load.name : load.name || '')}
                                            onChange={(e) => {
                                                if (load.category === 'PL') {
                                                    setPlSearchText(e.target.value);
                                                    setActivePLDropdown(index);
                                                    setPlSelectedIndex(0); // Reset selection on search
                                                    updateDropdownPosition(e.target);
                                                } else {
                                                    updateModalLoad(index, 'name', e.target.value);
                                                }
                                            }}
                                            onFocus={(e) => {
                                                if (load.category === 'PL') {
                                                    setActivePLDropdown(index);
                                                    setPlSearchText(load.name || '');
                                                    setPlSelectedIndex(0);
                                                    updateDropdownPosition(e.target);
                                                }
                                            }}
                                            onClick={(e) => {
                                                if (load.category === 'PL') {
                                                    updateDropdownPosition(e.target);
                                                }
                                            }}
                                            onKeyDown={(e) => {
                                                if (load.category === 'PL') {
                                                    if (e.key === 'ArrowDown') {
                                                        e.preventDefault();
                                                        if (filteredPLPanels.length > 0) {
                                                            setPlSelectedIndex(prev => (prev + 1) % filteredPLPanels.length);
                                                        }
                                                    } else if (e.key === 'ArrowUp') {
                                                        e.preventDefault();
                                                        if (filteredPLPanels.length > 0) {
                                                            setPlSelectedIndex(prev => (prev - 1 + filteredPLPanels.length) % filteredPLPanels.length);
                                                        }
                                                    } else if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        if (filteredPLPanels.length > 0) {
                                                            handleSelectPLPanel(index, filteredPLPanels[plSelectedIndex]);
                                                        }
                                                    } else if (e.key === 'Escape') {
                                                        setActivePLDropdown(null);
                                                        setPlSelectedIndex(0);
                                                    }
                                                } else if (e.key === 'Enter') {
                                                    saveLoads();
                                                }
                                            }}
                                            className={`w-full bg-gray-900 border border-gray-800 px-2 py-1.5 text-[12px] outline-none focus:border-yellow-500 font-medium text-white ${load.category === 'PL' ? 'border-blue-500/50 pr-6' : ''}`}
                                            placeholder={load.category === 'PL' ? "패널 검색..." : "부하명"}
                                        />
                                        {load.category === 'PL' && (
                                            <button
                                                type="button"
                                                onMouseDown={(e) => {
                                                    e.preventDefault(); // Prevent input blur
                                                    e.stopPropagation();
                                                    if (activePLDropdown === index) {
                                                        setActivePLDropdown(null);
                                                    } else {
                                                        setActivePLDropdown(index);
                                                        setPlSearchText(''); // Show all on click
                                                        const container = e.currentTarget.parentElement;
                                                        const input = container.querySelector('input');
                                                        updateDropdownPosition(input);
                                                    }
                                                }}
                                                className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white p-1 transition-colors"
                                            >
                                                <ChevronDown size={14} />
                                            </button>
                                        )}
                                        {load.category === 'PL' && activePLDropdown === index && createPortal(
                                            <div
                                                className="fixed bg-gray-950 border border-gray-800 shadow-2xl z-[9999] max-h-[200px] overflow-y-auto overflow-x-hidden"
                                                style={{
                                                    top: `${plDropdownPos.top + 4}px`, // Slight offset
                                                    left: `${plDropdownPos.left}px`,
                                                    width: `${plDropdownPos.width}px`
                                                }}
                                                data-pl-dropdown={index}
                                            >
                                                {filteredPLPanels.length > 0 ? (
                                                    filteredPLPanels.map((p, pIdx) => (
                                                        <button
                                                            key={p.id}
                                                            className={`w-full px-3 py-2 text-left text-[11px] font-bold transition-colors whitespace-nowrap overflow-hidden text-ellipsis border-l-2 ${pIdx === plSelectedIndex ? 'border-yellow-500 bg-white/5 text-white' : 'border-transparent text-gray-300 hover:text-white hover:bg-white/5 hover:border-yellow-500'}`}
                                                            onMouseDown={() => handleSelectPLPanel(index, p)}
                                                            onMouseEnter={() => setPlSelectedIndex(pIdx)}
                                                        >
                                                            {p.name}
                                                        </button>
                                                    ))
                                                ) : (
                                                    <div className="px-3 py-2 text-[10px] text-gray-600 italic">No Panels Found</div>
                                                )}
                                            </div>,
                                            document.body
                                        )}
                                    </div>
                                    {/* Qty Input */}
                                    <div className="col-span-1">
                                        <input
                                            type="number"
                                            min="0"
                                            value={load.qty}
                                            onChange={(e) => {
                                                const val = e.target.value === '' ? '' : Math.max(0, Number(e.target.value));
                                                updateModalLoad(index, 'qty', val);
                                            }}
                                            disabled={load.category === 'PL'}
                                            onKeyDown={(e) => e.key === 'Enter' && saveLoads()}
                                            className={`w-full bg-gray-900 border border-gray-800 text-white px-1 py-1.5 text-[12px] outline-none focus:border-yellow-500 text-center ${load.category === 'PL' ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            placeholder=""
                                        />
                                    </div>
                                    {/* VA Input */}
                                    <div className="col-span-2">
                                        <input
                                            type="text"
                                            value={load.va === '' ? '' : (Number(load.va) || 0).toLocaleString()}
                                            onChange={(e) => {
                                                const raw = e.target.value.replace(/,/g, '');
                                                if (raw === '' || !isNaN(raw)) {
                                                    updateModalLoad(index, 'va', raw === '' ? '' : Number(raw));
                                                }
                                            }}
                                            disabled={load.category === 'PL'}
                                            onKeyDown={(e) => e.key === 'Enter' && saveLoads()}
                                            className={`w-full bg-gray-900 border border-gray-800 text-white px-1 py-1.5 text-[12px] outline-none focus:border-yellow-500 text-center ${load.category === 'PL' ? 'opacity-50 cursor-not-allowed font-bold' : ''}`}
                                            placeholder=""
                                        />
                                    </div>
                                    {/* Row Total */}
                                    <div className="col-span-2 text-right text-yellow-400 font-medium text-[13px]">
                                        {((Number(load.qty) || 0) * (Number(load.va) || 0)).toLocaleString()}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Add Row Button */}
                        <button
                            onClick={addModalLoadRow}
                            disabled={loadModal.editLoads.some(l => l.category === 'PL')}
                            className={`w-full mt-3 py-2 border border-dashed border-gray-700 hover:border-green-500 text-gray-500 hover:text-green-400 text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 transition-colors ${loadModal.editLoads.some(l => l.category === 'PL') ? 'opacity-30 cursor-not-allowed grayscale' : ''}`}
                        >
                            <Plus size={12} /> 행 추가
                        </button>

                        {/* Total Summary */}
                        <div className="mt-4 pt-4 border-t border-gray-800 flex items-center justify-between">
                            <div className="text-[11px] text-gray-400 uppercase tracking-widest">총 부하 용량</div>
                            <div className="text-yellow-400 font-bold text-[20px]">
                                {getModalTotalVA().toLocaleString()} <span className="text-[13px] text-gray-500">VA</span>
                            </div>
                        </div>

                        <div className="flex gap-2 mt-6">
                            <button
                                onClick={closeLoadModal}
                                className="flex-1 px-4 py-3 border border-gray-800 text-gray-400 hover:text-white hover:bg-gray-900 text-sm font-bold uppercase tracking-widest transition-all"
                            >
                                취소
                            </button>
                            <button
                                onClick={saveLoads}
                                className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-bold text-sm uppercase tracking-widest transition-all shadow-lg shadow-green-900/20"
                            >
                                저장
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

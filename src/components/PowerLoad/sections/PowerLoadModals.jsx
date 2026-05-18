import React from 'react';
import { Plus, X } from 'lucide-react';
import { CornerBorders } from '../ui/PowerLoadUI';

export const ContextMenu = ({
    contextMenu,
    closeContextMenu,
    handleInsertRow,
    handleCopy,
    handleCut,
    handlePaste,
    clipboard,
    handleInsertPaste,
    handleDeleteSelected,
    selectedRows
}) => {
    if (!contextMenu.show) return null;

    return (
        <>
            <div
                className="fixed inset-0 z-[999]"
                onClick={closeContextMenu}
                onContextMenu={(e) => { e.preventDefault(); closeContextMenu(); }}
            />
            <div
                className="fixed z-[1000] bg-gray-950 border border-gray-800 shadow-xl min-w-[180px] py-1"
                style={{ left: contextMenu.x, top: contextMenu.y }}
                onClick={(e) => e.stopPropagation()}
            >
                <CornerBorders />
                <button
                    onClick={handleInsertRow}
                    className="w-full px-4 py-2 text-left text-[11px] text-gray-300 hover:bg-blue-500/20 hover:text-white flex items-center gap-3 transition-colors"
                >
                    <Plus size={14} className="text-green-500" />
                    Add an circuit
                </button>
                <div className="border-t border-gray-800 my-1"></div>
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
                <div className="border-t border-gray-800 my-1"></div>
                <button
                    onClick={handlePaste}
                    disabled={clipboard.loads.length === 0}
                    className={`w-full px-4 py-2 text-left text-[11px] flex items-center gap-3 transition-colors ${clipboard.loads.length > 0
                        ? 'text-gray-300 hover:bg-blue-500/20 hover:text-white'
                        : 'text-gray-700 cursor-not-allowed'
                        } `}
                >
                    <span className="text-gray-600 w-4">📄</span>
                    Paste {clipboard.loads.length > 0 && `(${clipboard.loads.length})`}
                    <span className="ml-auto text-gray-600 text-[10px]">Ctrl+V</span>
                </button>
                <button
                    onClick={handleInsertPaste}
                    disabled={clipboard.loads.length === 0}
                    className={`w-full px-4 py-2 text-left text-[11px] flex items-center gap-3 transition-colors ${clipboard.loads.length > 0
                        ? 'text-gray-300 hover:bg-blue-500/20 hover:text-white'
                        : 'text-gray-700 cursor-not-allowed'
                        } `}
                >
                    <span className="text-gray-600 w-4">📥</span>
                    Insert and Paste
                </button>
                <div className="border-t border-gray-800 my-1"></div>
                <button
                    onClick={handleDeleteSelected}
                    className="w-full px-4 py-2 text-left text-[11px] text-red-400 hover:bg-red-500/20 hover:text-red-300 flex items-center gap-3 transition-colors"
                >
                    <span className="w-4">🗑️</span>
                    Delete ({selectedRows.length})
                    <span className="ml-auto text-gray-600 text-[10px]">Del</span>
                </button>
                <div className="border-t border-gray-800 my-1" />
                <div className="px-4 py-2 text-[9px] text-gray-600">
                    {selectedRows.length > 0
                        ? `${selectedRows.length} row(s) selected`
                        : 'Right-click to select'
                    }
                </div>
            </div>
        </>
    );
};

export const ExportSaveModal = ({
    showExportSaveModal,
    setShowExportSaveModal,
    performExcelExport,
    handleExportSaveConfirm
}) => {
    if (!showExportSaveModal) return null;

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[1000]" onClick={(e) => e.stopPropagation()}>
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
                            performExcelExport();
                        }}
                        className="flex-1 px-4 py-3 border border-gray-800 text-gray-400 hover:text-white hover:bg-gray-900 text-sm font-bold uppercase tracking-widest transition-all"
                    >
                        저장 안함
                    </button>
                    <button
                        onClick={handleExportSaveConfirm}
                        className="flex-1 px-4 py-3 bg-green-700 hover:bg-green-600 text-white text-sm font-bold uppercase tracking-widest transition-all shadow-lg shadow-green-900/20"
                    >
                        저장 후 추출
                    </button>
                </div>
            </div>
        </div>
    );
};

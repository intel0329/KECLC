import React from 'react';
import { ExternalLink, Plus } from 'lucide-react';
import { CornerBorders } from '../ui/UpsUI';

const UpsContextMenu = (props) => {
    const {
        contextMenu,
        closeContextMenu,
        calculatedLoads,
        projectId,
        panels,
        navigate,
        handleInsertRow,
        handleCopy,
        handleCut,
        handlePaste,
        handleDeleteSelected,
        clipboard,
        selectedRows
    } = props;

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
                {(() => {
                    const load = calculatedLoads.find(l => l.id === contextMenu.loadId);
                    if (load?.connectedPanelId) {
                        return (
                            <>
                                <button
                                    onClick={() => {
                                        const connectedPanel = panels.find(p => p.id === load.connectedPanelId);
                                        const panelType = connectedPanel?.type || 'panel-load';
                                        navigate(`/project/${projectId}/${panelType}/${load.connectedPanelId}`);
                                        closeContextMenu();
                                    }}
                                    className="w-full px-4 py-2 text-left text-[11px] text-blue-400 hover:bg-blue-500/20 hover:text-blue-300 flex items-center gap-3 transition-colors font-bold"
                                >
                                    <ExternalLink size={14} />
                                    Open {load.equipmentName || 'Sub-Panel'}
                                </button>
                                <div className="border-t border-gray-800 my-1"></div>
                            </>
                        );
                    }
                    return null;
                })()}
                <button
                    onClick={() => { handleInsertRow('above'); closeContextMenu(); }}
                    className="w-full px-4 py-2 text-left text-[11px] text-gray-300 hover:bg-blue-500/20 hover:text-white flex items-center gap-3 transition-colors"
                >
                    <Plus size={14} className="text-green-500" />
                    Insert Circuit Above
                </button>
                <button
                    onClick={() => { handleInsertRow('below'); closeContextMenu(); }}
                    className="w-full px-4 py-2 text-left text-[11px] text-gray-300 hover:bg-blue-500/20 hover:text-white flex items-center gap-3 transition-colors"
                >
                    <Plus size={14} className="text-blue-500" />
                    Insert Circuit Below
                </button>
                <div className="border-t border-gray-800 my-1"></div>
                <button
                    onClick={() => { handleCopy(); closeContextMenu(); }}
                    className="w-full px-4 py-2 text-left text-[11px] text-gray-300 hover:bg-blue-500/20 hover:text-white flex items-center gap-3 transition-colors"
                >
                    <span className="text-gray-600 w-4">📋</span>
                    Copy
                    <span className="ml-auto text-gray-600 text-[10px]">Ctrl+C</span>
                </button>
                <button
                    onClick={() => { handleCut(); closeContextMenu(); }}
                    className="w-full px-4 py-2 text-left text-[11px] text-gray-300 hover:bg-blue-500/20 hover:text-white flex items-center gap-3 transition-colors"
                >
                    <span className="text-gray-600 w-4">✂️</span>
                    Cut
                    <span className="ml-auto text-gray-600 text-[10px]">Ctrl+X</span>
                </button>
                <div className="border-t border-gray-800 my-1"></div>
                <button
                    onClick={() => { handlePaste(); closeContextMenu(); }}
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
                <div className="border-t border-gray-800 my-1"></div>
                <button
                    onClick={() => { handleDeleteSelected(); closeContextMenu(); }}
                    className="w-full px-4 py-2 text-left text-[11px] text-red-400 hover:bg-red-500/20 hover:text-red-300 flex items-center gap-3 transition-colors font-bold"
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

export default UpsContextMenu;

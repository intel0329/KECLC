import React from 'react';
import { Zap, Square, Database, Table, PenTool } from 'lucide-react';

const ITEMS = [
  { type: 'ch', label: 'C.H', icon: <Square size={20} /> },
  { type: 'cos', label: 'COS', icon: <Zap size={20} /> },
  { type: 'la', label: 'LA', icon: <Zap size={20} /> },
  { type: 'aiss', label: 'AISS', icon: <Database size={20} /> },
  { type: 'pf', label: 'PF (Fuse)', icon: <Zap size={20} /> },
  { type: 'pt', label: 'PT', icon: <Square size={20} /> },
  { type: 'mccb', label: 'MCCB', icon: <Zap size={20} /> },
  { type: 'ptt', label: 'PTT', icon: <Square size={20} /> },
  { type: 'digital_meter', label: 'DIGITAL METER', icon: <Table size={20} /> },
  { type: 'acb', label: 'ACB', icon: <Database size={20} /> },
  { type: 'spd', label: 'SPD', icon: <Square size={20} /> },
  { type: 'ctt', label: 'CTT', icon: <Square size={20} /> },
  { type: 'sc', label: 'S.C', icon: <Database size={20} /> },
  { type: 'mg', label: 'M.G', icon: <Zap size={20} /> },
  { type: 'zct', label: 'ZCT', icon: <Table size={20} /> },
  { type: 'transformer', label: 'Transformer', icon: <Database size={20} /> },
  { type: 'breaker', label: 'Breaker', icon: <Zap size={20} /> },
  { type: 'mof', label: 'M.O.F', icon: <Square size={20} /> },
  { type: 'ct', label: 'CT', icon: <Table size={20} /> },
  { type: 'load_table', label: 'Load Table', icon: <Table size={20} /> },
];

export default function Sidebar({ isDrawingMode, onToggleDrawing, onSymbolDragStart }) {
  return (
    <div className="w-64 bg-white border-r shadow-sm flex flex-col z-10 h-full">
      <div className="p-4 border-b bg-gray-50">
        <h2 className="font-semibold text-gray-700">Tools</h2>
      </div>
      <div className="p-4 flex flex-col gap-3">
        <button
          onClick={onToggleDrawing}
          className={`flex items-center gap-3 p-3 border rounded-md transition-colors w-full text-left ${
            isDrawingMode ? 'bg-blue-100 border-blue-400 text-blue-800' : 'bg-white hover:bg-gray-50'
          }`}
        >
          < PenTool size={20} className={isDrawingMode ? 'text-blue-600' : 'text-gray-500'} />
          <span className="text-sm font-medium">Draw Wire</span>
        </button>
      </div>

      <div className="p-4 border-t border-b bg-gray-50">
        <h2 className="font-semibold text-gray-700">Symbols</h2>
        <p className="text-xs text-gray-500 mt-1">Drag and drop to canvas</p>
      </div>
      <div className="p-4 flex flex-col gap-3 overflow-y-auto">
        {ITEMS.map((item) => (
          <div
            key={item.type}
            draggable={!isDrawingMode}
            onDragStart={(e) => {
              if (!isDrawingMode) {
                e.dataTransfer.setData('application/reactflow', item.type);
                e.dataTransfer.effectAllowed = 'move';
              } else {
                onSymbolDragStart();
                e.dataTransfer.setData('application/reactflow', item.type);
                e.dataTransfer.effectAllowed = 'move';
              }
            }}
            className={`flex items-center gap-3 p-3 border rounded-md transition-colors bg-white ${
              isDrawingMode ? 'opacity-50 cursor-not-allowed' : 'cursor-grab hover:bg-blue-50 hover:border-blue-300'
            }`}
          >
            <div className={isDrawingMode ? 'text-gray-400' : 'text-blue-600'}>{item.icon}</div>
            <span className="text-sm font-medium text-gray-700">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

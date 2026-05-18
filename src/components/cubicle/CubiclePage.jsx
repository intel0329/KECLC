import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Canvas from './Canvas';
import PropertiesPanel from './PropertiesPanel';

const TERMINAL_OFFSETS = {
  ch: [{ x: 0, y: -8 }, { x: 0, y: 8 }],
  cos: [{ x: 0, y: -40 }, { x: 0, y: 40 }],
  la: [{ x: 0, y: -20 }, { x: 0, y: 35 }],
  aiss: [{ x: 0, y: -45 }, { x: 0, y: 45 }],
  pf: [{ x: 0, y: -35 }, { x: 0, y: 40 }],
  ct: [{ x: 0, y: -30 }, { x: 0, y: 30 }],
  pt: [{ x: 0, y: -25 }, { x: 0, y: 25 }],
  mccb: [{ x: 0, y: -25 }, { x: 0, y: 25 }],
  ptt: [{ x: -8, y: 0 }, { x: 8, y: 0 }],
  ctt: [{ x: -8, y: 0 }, { x: 8, y: 0 }],
  digital_meter: [{ x: 0, y: -25 }, { x: 0, y: 25 }],
  acb: [{ x: 0, y: -45 }, { x: 0, y: 45 }],
  spd: [{ x: 0, y: -30 }, { x: 0, y: 30 }],
  sc: [{ x: 0, y: -30 }],
  mg: [{ x: 0, y: -30 }, { x: 0, y: 30 }],
  zct: [{ x: 0, y: -35 }, { x: 0, y: 35 }],
  transformer: [{ x: 0, y: -40 }, { x: 0, y: 40 }],
  breaker: [{ x: 0, y: -30 }, { x: 0, y: 30 }],
  mof: [{ x: 0, y: -40 }, { x: 0, y: 40 }],
  load_table: [{ x: 80, y: 0 }]
};

export default function CubiclePage() {
  const [elements, setElements] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [drawingStart, setDrawingStart] = useState(null);
  const [currentMousePos, setCurrentMousePos] = useState(null);

  const [activeWireId, setActiveWireId] = useState(null);

  const getSnappedPos = (x, y, threshold = 20) => {
    let closest = { x, y, dist: Infinity };

    elements.forEach((el) => {
      if (el.type === 'wire') {
        el.points.forEach((p) => {
          const d = Math.sqrt((p.x - x) ** 2 + (p.y - y) ** 2);
          if (d < threshold && d < closest.dist) {
            closest = { x: p.x, y: p.y, dist: d };
          }
        });
      } else {
        const offsets = TERMINAL_OFFSETS[el.type] || [];
        offsets.forEach((off) => {
          const px = el.x + off.x;
          const py = el.y + off.y;
          const d = Math.sqrt((px - x) ** 2 + (py - y) ** 2);
          if (d < threshold && d < closest.dist) {
            closest = { x: px, y: py, dist: d };
          }
        });
      }
    });

    return closest.dist <= threshold ? { x: closest.x, y: closest.y } : { x, y };
  };

  const handleStopDrawing = () => {
    setIsDrawingMode(false);
    setDrawingStart(null);
    // Remove the floating temporary end point if drafting
    if (activeWireId) {
      setElements((prev) => prev.map(el => {
        if (el.id === activeWireId) {
          return {
            ...el,
            points: el.points.slice(0, -1)
          };
        }
        return el;
      }));
    }
    setActiveWireId(null);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
        return;
      }

      if (e.key.toLowerCase() === 'l') {
        setIsDrawingMode(true);
        setDrawingStart(null);
        setActiveWireId(null);
        setSelectedIds([]);
      } else if (e.key === 'Escape') {
        if (isDrawingMode) {
          handleStopDrawing();
        } else {
          setIsDrawingMode(false);
          setDrawingStart(null);
          setActiveWireId(null);
        }
      } else if (e.key === 'Delete') {
        if (selectedIds.length > 0) {
          setElements((prev) => prev.filter((el) => !selectedIds.includes(el.id)));
          setSelectedIds([]);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, isDrawingMode, activeWireId]);

  const getConstrainedPos = (start, current) => {
    if (!start || !current) return current;
    const dx = Math.abs(current.x - start.x);
    const dy = Math.abs(current.y - start.y);
    if (dx > dy) {
      return { x: current.x, y: start.y };
    } else {
      return { x: start.x, y: current.y };
    }
  };

  const handleDrop = (type, x, y) => {
    const snapped = getSnappedPos(x, y);
    const newElement = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      x: snapped.x,
      y: snapped.y,
      properties: getDefaultProperties(type),
    };
    setElements([...elements, newElement]);
    setSelectedIds([newElement.id]);
    setActiveWireId(null);
  };

  const updateElements = (updatesMap) => {
    setElements((prev) => prev.map((el) => {
      const update = updatesMap[el.id];
      if (update) return { ...el, ...update };
      return el;
    }));
  };

  const updateElement = (id, updates) => {
    setElements((prev) => prev.map((el) => (el.id === id ? { ...el, ...updates } : el)));
  };

  const handleCanvasClick = (x, y) => {
    const snapped = getSnappedPos(x, y);
    if (isDrawingMode) {
      if (!activeWireId) {
        // Start a new wire
        const newId = Math.random().toString(36).substr(2, 9);
        const newElement = {
          id: newId,
          type: 'wire',
          points: [{ x: snapped.x, y: snapped.y }, { x: snapped.x, y: snapped.y }],
          properties: {},
        };
        setElements((prev) => [...prev, newElement]);
        setActiveWireId(newId);
        setDrawingStart({ x: snapped.x, y: snapped.y });
      } else {
        // Add a new segment to the current wire
        const constrained = getConstrainedPos(drawingStart, snapped);
        setElements((prev) => prev.map(el => {
          if (el.id === activeWireId) {
            const lastFixedPoint = el.points[el.points.length - 2];
            const actualConstrained = getConstrainedPos(lastFixedPoint, snapped);
            return {
              ...el,
              points: [...el.points.slice(0, -1), actualConstrained, actualConstrained]
            };
          }
          return el;
        }));
        setDrawingStart({ x: snapped.x, y: snapped.y });
      }
    } else {
      // Toggle logic for clicking a blank area (deselect all if not shift clicking handled in Canvas)
      // Actually handled in Canvas onSelect
    }
  };

  const selectedElement = selectedIds.length === 1 ? elements.find((el) => el.id === selectedIds[0]) : null;

  return (
    <div className="flex flex-1 w-full bg-gray-50 overflow-hidden" style={{ height: 'calc(100vh - 56px)' }}>
      <Sidebar
        isDrawingMode={isDrawingMode}
        onToggleDrawing={() => {
          setIsDrawingMode(!isDrawingMode);
          setDrawingStart(null);
          setActiveWireId(null);
          setSelectedIds([]);
        }}
        onSymbolDragStart={() => {
          setIsDrawingMode(false);
          setDrawingStart(null);
          setActiveWireId(null);
        }}
      />
      <div className="flex-1 flex flex-col relative">
        <header className="bg-white border-b px-4 py-2 flex justify-between items-center shadow-sm z-10">
          <h1 className="text-lg font-semibold text-gray-800">변압기 용량 계산서 (SLD Editor)</h1>
          <button
            onClick={() => {
              if (window.confirm('캔버스를 초기화하시겠습니까?')) {
                setElements([]);
                setSelectedIds([]);
                setActiveWireId(null);
              }
            }}
            className="px-3 py-1 text-sm bg-red-50 text-red-600 rounded hover:bg-red-100"
          >
            Clear Canvas
          </button>
        </header>
        <Canvas
          elements={elements}
          onDrop={handleDrop}
          selectedIds={selectedIds}
          onSelect={(ids) => {
            if (!isDrawingMode) setSelectedIds(ids);
          }}
          onUpdate={updateElements}
          isDrawingMode={isDrawingMode}
          onCanvasClick={handleCanvasClick}
          drawingStart={drawingStart}
          currentMousePos={currentMousePos}
          onMouseMove={(x, y) => {
            const snapped = getSnappedPos(x, y);
            if (activeWireId) {
              setElements((prev) => prev.map(el => {
                if (el.id === activeWireId) {
                  const lastFixedPoint = el.points[el.points.length - 2];
                  const constrained = getConstrainedPos(lastFixedPoint, snapped);
                  return {
                    ...el,
                    points: [...el.points.slice(0, -1), constrained]
                  };
                }
                return el;
              }));
            }
          }}
          onStopDrawing={handleStopDrawing}
        />
      </div>
      {selectedElement && (
        <PropertiesPanel
          element={selectedElement}
          onUpdate={(props) => updateElements({ [selectedElement.id]: { properties: props } })}
          onDelete={() => {
            setElements(elements.filter((el) => !selectedIds.includes(el.id)));
            setSelectedIds([]);
          }}
        />
      )}
    </div>
  );
}

function getDefaultProperties(type) {
  switch (type) {
    case 'ch':
      return {
        name: 'C.H',
        spec1: 'FR-CNCO-W',
        spec2: '3-1C/60mm²',
      };
    case 'cos':
      return {
        name: 'COSx3',
        spec1: '25.8kV',
        spec2: '100AF',
      };
    case 'la':
      return {
        name: 'LAx3',
        spec1: '18kV 2.5kA',
        spec2: '(W/DISC.)',
      };
    case 'aiss':
      return {
        name: 'AISS',
        spec1: '25.8kV 200AF',
        spec2: '15kA/sec',
      };
    case 'pf':
      return {
        name: 'PFx3',
        spec1: '24kV 50kA',
        spec2: 'FUSE : 31.5A',
      };
    case 'ct':
      return {
        name: 'CT',
        spec1: '20/5A',
        spec2: '40VA 1.0급',
      };
    case 'pt':
      return {
        name: '3-PT',
        spec1: 'F(1A) 380/110V',
        spec2: '',
      };
    case 'mccb':
      return {
        name: 'MCCB 3P',
        spec1: '100/30AT',
        spec2: '25kA',
      };
    case 'ptt':
      return {
        name: 'PTT',
        spec1: '',
        spec2: '',
      };
    case 'digital_meter':
      return {
        name: 'DIGITAL METER',
        spec1: '계측:V,A,kW,PF,kWH',
        spec2: 'APFC(자동역률조정장치 포함)',
      };
    case 'acb':
      return {
        name: 'ACB 4P',
        spec1: '1250AF, 55kA',
        spec2: '(W/OCR,OCGR)',
      };
    case 'spd':
      return {
        name: 'SPD',
        spec1: '12.5kA',
        spec2: '(KS인증, class I급 limp)',
      };
    case 'ctt':
      return {
        name: 'CTT',
        spec1: '',
        spec2: '',
      };
    case 'sc':
      return {
        name: 'S.C 3Ø 380V',
        spec1: '10kVA',
        spec2: '',
      };
    case 'mg':
      return {
        name: 'MG-M',
        spec1: '(32A)',
        spec2: '',
      };
    case 'zct':
      return {
        name: 'ZCT',
        spec1: '200mA/1.5mA',
        spec2: '',
      };
    case 'transformer':
      return {
        name: 'T.R (OIL TYPE)',
        spec1: '22,900V/380-220V',
        spec2: '3Ø 600kVA',
      };
    case 'breaker':
      return {
        name: 'VCB',
        spec1: '7.2kV 600A',
        spec2: '12.5kA',
      };
    case 'mof':
      return {
        name: 'M.O.F',
        spec1: 'PT: 13200/110V',
        spec2: 'CT: 20/5A',
      };
    case 'load_table':
      return {
        loadName: 'PP-Main',
        p: '4',
        af: '100',
        at: '75',
        ka: '25',
      };
    default:
      return {};
  }
}

import React, { useRef, useState } from 'react';

const ConnectionDot = ({ x, y, color = 'black' }) => (
  <circle cx={x} cy={y} r="3" fill={color} />
);

export default function Canvas({
  elements,
  onDrop,
  selectedIds,
  onSelect,
  onUpdate,
  isDrawingMode,
  onCanvasClick,
  drawingStart,
  currentMousePos,
  onMouseMove,
  onStopDrawing,
}) {
  const svgRef = useRef(null);
  const [draggingId, setDraggingId] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [selectionStart, setSelectionStart] = useState(null);
  const [selectionRect, setSelectionRect] = useState(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('application/reactflow');
    if (!type || !svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) / 10) * 10;
    const y = Math.round((e.clientY - rect.top) / 10) * 10;

    onDrop(type, x, y);
  };

  const handleMouseDown = (e, id) => {
    if (isDrawingMode) return;
    e.stopPropagation();

    const isShift = e.shiftKey;
    let newSelectedIds = [...selectedIds];

    if (id) {
      // Clicked an element
      if (isShift) {
        if (newSelectedIds.includes(id)) {
          newSelectedIds = newSelectedIds.filter(sid => sid !== id);
        } else {
          newSelectedIds.push(id);
        }
      } else {
        if (!newSelectedIds.includes(id)) {
          newSelectedIds = [id];
        }
      }
      onSelect(newSelectedIds);

      const el = elements.find((e) => e.id === id);
      if (el && svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect();
        setDragOffset({
          x: e.clientX - rect.left - el.x,
          y: e.clientY - rect.top - el.y,
        });
        setDraggingId(id);
      }
    } else {
      // Clicked the canvas background
      const rect = svgRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (!isShift) {
        onSelect([]);
      }
      setSelectionStart({ x, y });
    }
  };

  const handleMouseMoveLocal = (e) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) / 10) * 10;
    const y = Math.round((e.clientY - rect.top) / 10) * 10;

    onMouseMove(x, y);

    if (draggingId && !isDrawingMode) {
      const el = elements.find(e => e.id === draggingId);
      if (el) {
        const newX = x - Math.round(dragOffset.x / 10) * 10;
        const newY = y - Math.round(dragOffset.y / 10) * 10;
        const dx = newX - el.x;
        const dy = newY - el.y;

        if (dx !== 0 || dy !== 0) {
          const updates = {};
          selectedIds.forEach(id => {
            const selEl = elements.find(e => e.id === id);
            if (selEl) {
              if (selEl.type === 'wire') {
                updates[id] = { points: selEl.points.map(p => ({ x: p.x + dx, y: p.y + dy })) };
              } else {
                updates[id] = { x: selEl.x + dx, y: selEl.y + dy };
              }
            }
          });
          onUpdate(updates);
        }
      }
    } else if (selectionStart) {
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;
      setSelectionRect({
        x: Math.min(selectionStart.x, currentX),
        y: Math.min(selectionStart.y, currentY),
        width: Math.abs(selectionStart.x - currentX),
        height: Math.abs(selectionStart.y - currentY),
      });
    }
  };

  const handleMouseUp = (e) => {
    if (selectionRect) {
      const isShift = e.shiftKey;
      const newlySelected = elements.filter(el => {
        let elX, elY;
        if (el.type === 'wire') {
          // Check if any point is inside or if bounding box intersects
          return el.points.some(p =>
            p.x >= selectionRect.x &&
            p.x <= selectionRect.x + selectionRect.width &&
            p.y >= selectionRect.y &&
            p.y <= selectionRect.y + selectionRect.height
          );
        } else {
          elX = el.x;
          elY = el.y;
          // Approx symbol size for selection
          return (
            elX >= selectionRect.x - 40 &&
            elX <= selectionRect.x + selectionRect.width + 40 &&
            elY >= selectionRect.y - 40 &&
            elY <= selectionRect.y + selectionRect.height + 40
          );
        }
      }).map(el => el.id);

      if (isShift) {
        onSelect([...new Set([...selectedIds, ...newlySelected])]);
      } else {
        onSelect(newlySelected);
      }
    }
    setDraggingId(null);
    setSelectionStart(null);
    setSelectionRect(null);
  };

  const handleSvgClick = (e) => {
    if (isDrawingMode && svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const x = Math.round((e.clientX - rect.left) / 10) * 10;
      const y = Math.round((e.clientY - rect.top) / 10) * 10;
      onCanvasClick(x, y);
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-[#f8f9fa] relative">
      {/* Grid background */}
      <svg width="100%" height="100%" className="absolute inset-0 pointer-events-none">
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e5e7eb" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      <svg
        ref={svgRef}
        className={`w-full h-full min-w-[1200px] min-h-[800px] absolute inset-0 ${
          isDrawingMode ? 'cursor-crosshair' : ''
        }`}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onMouseMove={handleMouseMoveLocal}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onMouseDown={(e) => handleMouseDown(e, null)}
        onClick={handleSvgClick}
        onContextMenu={(e) => {
          if (isDrawingMode) {
            e.preventDefault();
            onStopDrawing();
          }
        }}
      >
        {/* Render selection rectangle */}
        {selectionRect && (
          <rect
            x={selectionRect.x}
            y={selectionRect.y}
            width={selectionRect.width}
            height={selectionRect.height}
            fill="rgba(59, 130, 246, 0.1)"
            stroke="#3b82f6"
            strokeWidth="1"
            strokeDasharray="4"
          />
        )}

        {/* Render wires */}
        {elements
          .filter((e) => e.type === 'wire')
          .map((el) => {
            const isSelected = selectedIds.includes(el.id);
            return (
              <g key={el.id} onMouseDown={(e) => handleMouseDown(e, el.id)}>
                {/* Segments of the wire */}
                {el.points.map((p, i) => {
                  if (i === 0) return null;
                  const prev = el.points[i - 1];
                  return (
                    <React.Fragment key={i}>
                      <line
                        x1={prev.x}
                        y1={prev.y}
                        x2={p.x}
                        y2={p.y}
                        stroke={isSelected ? '#3b82f6' : 'black'}
                        strokeWidth={isSelected ? '3' : '2'}
                      />
                      {/* Clear hit area for each segment */}
                      <line
                        x1={prev.x}
                        y1={prev.y}
                        x2={p.x}
                        y2={p.y}
                        stroke="transparent"
                        strokeWidth="10"
                        className={isDrawingMode ? 'cursor-crosshair' : 'cursor-pointer'}
                      />
                    </React.Fragment>
                  );
                })}
                {/* Connection dots only at start and end */}
                {el.points.length > 0 && (
                  <>
                    <ConnectionDot x={el.points[0].x} y={el.points[0].y} color={isSelected ? '#3b82f6' : 'black'} />
                    <ConnectionDot x={el.points[el.points.length - 1].x} y={el.points[el.points.length - 1].y} color={isSelected ? '#3b82f6' : 'black'} />
                  </>
                )}
              </g>
            );
          })}

        {/* Render symbols */}
        {elements
          .filter((e) => e.type !== 'line' && e.type !== 'wire')
          .map((el) => {
            const isSelected = selectedIds.includes(el.id);
            return (
              <g
                key={el.id}
                transform={`translate(${el.x}, ${el.y})`}
                onMouseDown={(e) => handleMouseDown(e, el.id)}
                style={{
                  cursor: isDrawingMode ? 'crosshair' : draggingId === el.id ? 'grabbing' : 'grab',
                }}
              >
                {isSelected && (
                  <rect
                    x="-40"
                    y="-40"
                    width="80"
                    height="80"
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2"
                    strokeDasharray="4"
                  />
                )}
                <SymbolRenderer element={el} />
              </g>
            );
          })}
      </svg>
    </div>
  );
}

function SymbolRenderer({ element }) {
  const { type, properties } = element;

  switch (type) {
    case 'ch':
      return (
        <g>
          <circle cx="0" cy="0" r="5" fill="black" />
          <circle cx="0" cy="0" r="8" fill="none" stroke="black" strokeWidth="1" />
          <ConnectionDot x={0} y={-8} />
          <ConnectionDot x={0} y={8} />
          <SpecText properties={properties} offsetX={15} offsetY={5} />
        </g>
      );
    case 'cos':
      return (
        <g>
          <circle cx="0" cy="-20" r="3" fill="black" />
          <path d="M 0 -20 C 15 -15, 15 5, 0 10" fill="none" stroke="black" strokeWidth="2" />
          <line x1="0" y1="-20" x2="0" y2="-40" stroke="black" strokeWidth="2" />
          <line x1="0" y1="20" x2="0" y2="40" stroke="black" strokeWidth="2" />
          <ConnectionDot x={0} y={-40} />
          <ConnectionDot x={0} y={40} />
          <SpecText properties={properties} offsetX={20} offsetY={0} />
        </g>
      );
    case 'la':
      return (
        <g>
          <rect x="-12" y="-20" width="24" height="40" fill="white" stroke="black" strokeWidth="2" />
          <path d="M -8 -8 L 8 8 M 8 -8 L -8 8" stroke="#ccc" strokeWidth="1" />
          <line x1="0" y1="20" x2="0" y2="35" stroke="black" strokeWidth="2" />
          <line x1="-12" y1="35" x2="12" y2="35" stroke="black" strokeWidth="2" />
          <line x1="-8" y1="40" x2="8" y2="40" stroke="black" strokeWidth="2" />
          <line x1="-4" y1="45" x2="4" y2="45" stroke="black" strokeWidth="2" />
          <ConnectionDot x={0} y={-20} />
          <ConnectionDot x={0} y={35} />
          <SpecText properties={properties} offsetX={20} offsetY={0} />
        </g>
      );
    case 'aiss':
      return (
        <g>
          <rect x="-18" y="-30" width="36" height="60" fill="white" stroke="black" strokeWidth="2" />
          <circle cx="0" cy="-15" r="3" fill="black" />
          <line x1="0" y1="-15" x2="12" y2="20" stroke="black" strokeWidth="2" />
          <line x1="0" y1="-30" x2="0" y2="-45" stroke="black" strokeWidth="2" />
          <line x1="0" y1="30" x2="0" y2="45" stroke="black" strokeWidth="2" />
          <ConnectionDot x={0} y={-45} />
          <ConnectionDot x={0} y={45} />
          <SpecText properties={properties} offsetX={25} offsetY={0} />
        </g>
      );
    case 'pf':
      return (
        <g>
          <circle cx="0" cy="-15" r="3" fill="black" />
          <line x1="0" y1="-15" x2="10" y2="20" stroke="black" strokeWidth="2" />
          <rect x="2" y="-5" width="10" height="2" fill="black" transform="rotate(70, 7, -4)" />
          <line x1="0" y1="-15" x2="0" y2="-35" stroke="black" strokeWidth="2" />
          <line x1="0" y1="20" x2="0" y2="40" stroke="black" strokeWidth="2" />
          <ConnectionDot x={0} y={-35} />
          <ConnectionDot x={0} y={40} />
          <SpecText properties={properties} offsetX={20} offsetY={0} />
        </g>
      );
    case 'ct':
      return (
        <g>
          <circle cx="0" cy="0" r="14" fill="none" stroke="black" strokeWidth="2" />
          <circle cx="0" cy="0" r="3" fill="black" />
          <line x1="0" y1="-14" x2="0" y2="-30" stroke="black" strokeWidth="2" />
          <line x1="0" y1="14" x2="0" y2="30" stroke="black" strokeWidth="2" />
          <ConnectionDot x={0} y={-30} />
          <ConnectionDot x={0} y={30} />
          <SpecText properties={properties} offsetX={20} offsetY={5} />
        </g>
      );
    case 'pt':
      return (
        <g>
          <rect x="-15" y="-10" width="30" height="20" fill="white" stroke="black" strokeWidth="2" />
          <line x1="-15" y1="10" x2="15" y2="-10" stroke="black" strokeWidth="1" />
          <path d="M -10 -15 L -5 -10 M 5 10 L 10 15" stroke="black" strokeWidth="1" />
          <line x1="0" y1="-10" x2="0" y2="-25" stroke="black" strokeWidth="2" />
          <line x1="0" y1="10" x2="0" y2="25" stroke="black" strokeWidth="2" />
          <ConnectionDot x={0} y={-25} />
          <ConnectionDot x={0} y={25} />
          <SpecText properties={properties} offsetX={20} offsetY={0} />
        </g>
      );
    case 'mccb':
      return (
        <g>
          <circle cx="0" cy="-12" r="3" fill="black" />
          <line x1="0" y1="-12" x2="10" y2="12" stroke="black" strokeWidth="2" />
          <path d="M 6 4 C 10 4, 10 -4, 6 -4" fill="none" stroke="black" strokeWidth="1" />
          <line x1="0" y1="-12" x2="0" y2="-25" stroke="black" strokeWidth="2" />
          <line x1="0" y1="12" x2="0" y2="25" stroke="black" strokeWidth="2" />
          <ConnectionDot x={0} y={-25} />
          <ConnectionDot x={0} y={25} />
          <SpecText properties={properties} offsetX={15} offsetY={0} />
        </g>
      );
    case 'ptt':
    case 'ctt':
      return (
        <g>
          <circle cx="-8" cy="0" r="3" fill="white" stroke="black" strokeWidth="1" />
          <circle cx="8" cy="0" r="3" fill="white" stroke="black" strokeWidth="1" />
          <rect x="-6" y="-1" width="12" height="2" fill="black" />
          <ConnectionDot x={-8} y={0} />
          <ConnectionDot x={8} y={0} />
          <SpecText properties={properties} offsetX={15} offsetY={5} />
        </g>
      );
    case 'digital_meter':
      return (
        <g>
          <rect x="-40" y="-25" width="80" height="50" fill="white" stroke="black" strokeWidth="2" />
          <rect x="-35" y="-20" width="70" height="20" fill="#eee" stroke="black" strokeWidth="1" />
          <line x1="-30" y1="-10" x2="-10" y2="-10" stroke="black" strokeWidth="2" />
          <line x1="-30" y1="-15" x2="-10" y2="-15" stroke="black" strokeWidth="2" />
          <text x="0" y="15" textAnchor="middle" fontSize="10" fontWeight="bold">DM / VAR</text>
          <ConnectionDot x={0} y={-25} />
          <ConnectionDot x={0} y={25} />
          <SpecText properties={properties} offsetX={45} offsetY={-10} />
        </g>
      );
    case 'acb':
      return (
        <g>
          <rect x="-20" y="-30" width="40" height="60" fill="white" stroke="black" strokeWidth="2" />
          <circle cx="0" cy="-15" r="4" fill="none" stroke="black" strokeWidth="2" />
          <circle cx="0" cy="15" r="4" fill="none" stroke="black" strokeWidth="2" />
          <path d="M 0 -11 C 8 -11, 8 11, 0 11" fill="none" stroke="black" strokeWidth="2" />
          <line x1="0" y1="-30" x2="0" y2="-45" stroke="black" strokeWidth="2" />
          <line x1="0" y1="30" x2="0" y2="45" stroke="black" strokeWidth="2" />
          <ConnectionDot x={0} y={-45} />
          <ConnectionDot x={0} y={45} />
          <SpecText properties={properties} offsetX={25} offsetY={0} />
        </g>
      );
    case 'spd':
      return (
        <g>
          <rect x="-15" y="-15" width="30" height="30" fill="white" stroke="black" strokeWidth="2" />
          <path d="M -10 10 L 0 -10 L 10 10" fill="none" stroke="black" strokeWidth="2" />
          <line x1="0" y1="-15" x2="0" y2="-30" stroke="black" strokeWidth="2" />
          <line x1="0" y1="15" x2="0" y2="30" stroke="black" strokeWidth="2" />
          <ConnectionDot x={0} y={-30} />
          <ConnectionDot x={0} y={30} />
          <SpecText properties={properties} offsetX={20} offsetY={0} />
        </g>
      );
    case 'sc':
      return (
        <g>
          {/* Delta Connection (Triangular 3-Phase Capacitor) */}
          {/* Top Capacitor */}
          <g transform="translate(0, -10)">
            <line x1="-8" y1="-2" x2="8" y2="-2" stroke="black" strokeWidth="2" />
            <line x1="-8" y1="2" x2="8" y2="2" stroke="black" strokeWidth="2" />
          </g>
          {/* Bottom Left Capacitor (Rotated) */}
          <g transform="translate(-8, 6) rotate(60)">
            <line x1="-8" y1="-2" x2="8" y2="-2" stroke="black" strokeWidth="2" />
            <line x1="-8" y1="2" x2="8" y2="2" stroke="black" strokeWidth="2" />
          </g>
          {/* Bottom Right Capacitor (Rotated) */}
          <g transform="translate(8, 6) rotate(-60)">
            <line x1="-10" y1="-2" x2="10" y2="-2" stroke="black" strokeWidth="2" />
            <line x1="-10" y1="2" x2="10" y2="2" stroke="black" strokeWidth="2" />
          </g>
          {/* Connecting lines for triangular appearance */}
          <line x1="0" y1="-12" x2="0" y2="-30" stroke="black" strokeWidth="2" />
          <ConnectionDot x={0} y={-30} />
          <SpecText properties={properties} offsetX={25} offsetY={0} />
        </g>
      );
    case 'mg':
      return (
        <g>
          <circle cx="0" cy="-10" r="4" fill="white" stroke="black" strokeWidth="1" />
          <circle cx="0" cy="10" r="4" fill="white" stroke="black" strokeWidth="1" />
          <line x1="-6" y1="-10" x2="6" y2="10" stroke="black" strokeWidth="2" />
          <line x1="0" y1="-14" x2="0" y2="-30" stroke="black" strokeWidth="2" />
          <line x1="0" y1="14" x2="0" y2="30" stroke="black" strokeWidth="2" />
          <ConnectionDot x={0} y={-30} />
          <ConnectionDot x={0} y={30} />
          <SpecText properties={properties} offsetX={15} offsetY={0} />
        </g>
      );
    case 'zct':
      return (
        <g>
          <circle cx="0" cy="0" r="18" fill="none" stroke="black" strokeWidth="2" />
          <ellipse cx="0" cy="0" rx="4" ry="12" fill="none" stroke="black" strokeWidth="1" />
          <line x1="0" y1="-18" x2="0" y2="-35" stroke="black" strokeWidth="2" />
          <line x1="0" y1="18" x2="0" y2="35" stroke="black" strokeWidth="2" />
          <ConnectionDot x={0} y={-35} />
          <ConnectionDot x={0} y={35} />
          <SpecText properties={properties} offsetX={22} offsetY={5} />
        </g>
      );
    case 'transformer':
      return (
        <g>
          <circle cx="0" cy="-12" r="16" fill="white" stroke="black" strokeWidth="2" />
          <circle cx="0" cy="12" r="16" fill="white" stroke="black" strokeWidth="2" />
          <path d="M 0 -28 L 0 -40 M 0 28 L 0 40" stroke="black" strokeWidth="2" />
          <ConnectionDot x={0} y={-40} />
          <ConnectionDot x={0} y={40} />
          <SpecText properties={properties} offsetX={25} offsetY={-10} />
        </g>
      );
    case 'breaker':
      return (
        <g>
          <rect x="-12" y="-16" width="24" height="32" fill="white" stroke="black" strokeWidth="2" />
          <line x1="0" y1="-16" x2="0" y2="-30" stroke="black" strokeWidth="2" />
          <line x1="0" y1="16" x2="0" y2="30" stroke="black" strokeWidth="2" />
          <ConnectionDot x={0} y={-30} />
          <ConnectionDot x={0} y={30} />
          <SpecText properties={properties} offsetX={20} offsetY={-5} />
        </g>
      );
    case 'mof':
      return (
        <g>
          <rect x="-30" y="-20" width="60" height="40" fill="white" stroke="black" strokeWidth="2" />
          <text x="0" y="5" textAnchor="middle" fontSize="14" fontWeight="bold" fill="black">
            MOF
          </text>
          <line x1="0" y1="-20" x2="0" y2="-40" stroke="black" strokeWidth="2" />
          <line x1="0" y1="20" x2="0" y2="40" stroke="black" strokeWidth="2" />
          <ConnectionDot x={0} y={-40} />
          <ConnectionDot x={0} y={40} />
          <SpecText properties={properties} offsetX={35} offsetY={0} />
        </g>
      );
    case 'load_table':
      return (
        <g>
          <rect x="0" y="0" width="160" height="60" fill="white" stroke="black" strokeWidth="2" />
          <rect x="0" y="0" width="160" height="20" fill="#f3f4f6" stroke="black" strokeWidth="1" />
          <text x="80" y="14" textAnchor="middle" fontSize="10" fontWeight="bold">
            LOAD NAME
          </text>
          <rect x="0" y="20" width="40" height="20" fill="none" stroke="black" strokeWidth="1" />
          <text x="20" y="34" textAnchor="middle" fontSize="10">
            MCCB
          </text>
          <rect x="40" y="20" width="30" height="20" fill="none" stroke="black" strokeWidth="1" />
          <text x="55" y="34" textAnchor="middle" fontSize="10">
            P
          </text>
          <rect x="70" y="20" width="30" height="20" fill="none" stroke="black" strokeWidth="1" />
          <text x="85" y="34" textAnchor="middle" fontSize="10">
            AF
          </text>
          <rect x="100" y="20" width="30" height="20" fill="none" stroke="black" strokeWidth="1" />
          <text x="115" y="34" textAnchor="middle" fontSize="10">
            AT
          </text>
          <rect x="130" y="20" width="30" height="20" fill="none" stroke="black" strokeWidth="1" />
          <text x="145" y="34" textAnchor="middle" fontSize="10">
            KA
          </text>
          <rect x="0" y="40" width="160" height="20" fill="none" stroke="black" strokeWidth="1" />
          <text x="20" y="54" textAnchor="middle" fontSize="10">
            {properties.loadName}
          </text>
          <rect x="40" y="40" width="30" height="20" fill="none" stroke="black" strokeWidth="1" />
          <text x="55" y="54" textAnchor="middle" fontSize="10">
            {properties.p}
          </text>
          <rect x="70" y="40" width="30" height="20" fill="none" stroke="black" strokeWidth="1" />
          <text x="85" y="54" textAnchor="middle" fontSize="10">
            {properties.af}
          </text>
          <rect x="100" y="40" width="30" height="20" fill="none" stroke="black" strokeWidth="1" />
          <text x="115" y="54" textAnchor="middle" fontSize="10">
            {properties.at}
          </text>
          <rect x="130" y="40" width="30" height="20" fill="none" stroke="black" strokeWidth="1" />
          <text x="145" y="54" textAnchor="middle" fontSize="10">
            {properties.ka}
          </text>
        </g>
      );
    default:
      return null;
  }
}

function SpecText({
  properties,
  offsetX,
  offsetY,
}) {
  const keys = Object.keys(properties);
  return (
    <g transform={`translate(${offsetX}, ${offsetY})`}>
      {keys.map((key, index) => (
        <text key={key} x="0" y={index * 14} fontSize="11" fill="#374151" fontFamily="monospace">
          {properties[key]}
        </text>
      ))}
    </g>
  );
}

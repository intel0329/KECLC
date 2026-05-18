import React, { useState, useEffect } from 'react';

const ParallelConductorPopup = ({ isOpen, onClose, onApply, initialValue, wire, size, kecSettings }) => {
    // Parse initial value if it exists, e.g., 'B1x2' -> method: 'B1', n: 2
    const [method, setMethod] = useState('B1');
    const [n, setN] = useState(2);

    useEffect(() => {
        if (isOpen) {
            if (initialValue && initialValue.includes('x')) {
                const parts = initialValue.split('x');
                setMethod(parts[0] || 'B1');
                setN(Number(parts[1]) || 2);
            } else {
                setMethod('B1');
                setN(2);
            }
        }
    }, [isOpen, initialValue]);

    if (!isOpen) return null;

    const handleApply = () => {
        onApply(`${method}X${n}`);
    };

    // Validation logic for disabled methods (copied/adapted from PowerLoadContent)
    const getDisabledMethods = () => {
        if (!wire || !size) return [];
        const circuitSize = Number(size) || 0;
        const thresholdArea = kecSettings?.cableCondition?.area || 50;

        if (wire === 'HFIX') {
            return ['A2', 'B2', 'E', 'F'];
        }

        if (wire === 'FCV' || wire === 'FR8') {
            if (circuitSize >= thresholdArea) {
                return ['A2', 'B2', 'E'];
            } else {
                return ['A1', 'B1', 'F'];
            }
        }
        return [];
    };

    const disabledMethods = getDisabledMethods();

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={(e) => e.stopPropagation()}
        >
            <div className="bg-black border-2 border-blue-500/50 p-5 relative min-w-[320px] shadow-2xl">
                {/* Corner Accents */}
                <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-blue-500"></div>
                <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-blue-500"></div>
                <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-blue-500"></div>
                <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-blue-500"></div>

                <div className="text-blue-400 font-bold tracking-widest uppercase mb-5 text-sm border-b border-gray-800 pb-2 flex items-center gap-2">
                    <div className="w-1.5 h-3 bg-blue-500"></div>
                    Parallel Conductor
                </div>

                <div className="grid grid-cols-2 gap-4 mb-5">
                    <div>
                        <label className="text-[10px] text-gray-400 uppercase tracking-widest block mb-1.5 font-bold">병렬 회선 수 (n)</label>
                        <select
                            value={n}
                            onChange={(e) => setN(Number(e.target.value))}
                            className="w-full bg-gray-900 border border-gray-700 text-white font-mono font-bold px-3 py-1.5 outline-none focus:border-blue-500 transition-colors appearance-none text-[13px]"
                        >
                            <option value={2}>2</option>
                            <option value={3}>3</option>
                            <option value={4}>4</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] text-gray-400 uppercase tracking-widest block mb-1.5 font-bold">공사 방법</label>
                        <select
                            value={method}
                            onChange={(e) => setMethod(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 text-white font-mono font-bold px-3 py-1.5 outline-none focus:border-blue-500 transition-colors appearance-none text-[13px]"
                        >
                            {['B1', 'B2', 'D', 'E', 'F'].map((m) => (
                                <option
                                    key={m}
                                    value={m}
                                    disabled={disabledMethods.includes(m)}
                                    className={disabledMethods.includes(m) ? "text-gray-600" : "text-white"}
                                >
                                    {m}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={onClose}
                        className="w-full py-2 border border-gray-600 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors text-[11px] font-bold uppercase tracking-widest"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleApply}
                        className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white transition-colors text-[11px] font-bold uppercase tracking-widest shadow-lg shadow-blue-500/20"
                    >
                        Apply
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ParallelConductorPopup;

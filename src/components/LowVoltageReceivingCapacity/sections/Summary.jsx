import React from 'react';
import { CornerBorders } from '../ui/LowVoltageUI';
import { Download, X } from 'lucide-react';

const Summary = (props) => {
    const {
        projectInfo,
        exportToExcel,
        updateProjectInfo,
        demandFactorSummary = { totalKva: 0, totalA: 0, avgPercent: 100 },
        totalLoad = 0,
        totalCurrentCalc = 0,
        showExportSaveModal,
        setShowExportSaveModal,
        performExcelExport,
        handleExportSaveConfirm
    } = props;

    return (
        <>
            <div className="grid grid-cols-12 gap-4 mb-4">
                <div className="col-span-12 border border-gray-900 bg-black p-4 relative">
                    <CornerBorders />
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-[12px] font-semibold text-gray-400 uppercase tracking-[0.2em]">Low Voltage System Overview</h3>
                        <div className="flex gap-2" data-html2canvas-ignore="true">
                            <button
                                onClick={exportToExcel}
                                title="Excel"
                                className="w-10 md:w-[100px] aspect-square md:aspect-auto md:px-3 md:py-2 bg-green-700 hover:bg-green-600 text-white text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center md:gap-2 border border-green-500/50"
                            >
                                <Download size={14} /> <span className="hidden md:inline">Excel</span>
                            </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        <div className="bg-gray-900/30 p-4 min-h-[100px]">
                            <div className="text-gray-300 text-[10px] uppercase tracking-widest mb-1">Incoming Capacity</div>
                            <div className="text-2xl font-bold text-yellow-400 flex items-baseline flex-wrap">
                                <span className="flex items-baseline">
                                    <input
                                        type="number"
                                        value={projectInfo.mainCapacity || ''}
                                        onChange={(e) => updateProjectInfo('mainCapacity', e.target.value)}
                                        className="bg-transparent border-none text-yellow-400 font-bold text-2xl outline-none text-left [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none p-0"
                                        style={{ width: `${String(projectInfo.mainCapacity || '').length || 1}ch` }}
                                    />
                                    <span className="text-[12px] text-gray-400 ml-1">kVA</span>
                                </span>
                            </div>
                            <div className="flex items-baseline gap-2 mt-1">
                                <div className="text-[#facc15] text-sm font-bold">
                                    {projectInfo.phase} {projectInfo.voltage}
                                </div>
                            </div>
                        </div>
                        <div className="bg-gray-900/30 p-4 min-h-[100px]">
                            <div className="text-gray-300 text-[10px] uppercase tracking-widest mb-1">Main Breaker</div>
                            <div className="text-2xl font-bold text-yellow-400 flex items-baseline flex-wrap">
                                <span className="flex items-baseline">
                                    <input
                                        type="number"
                                        value={projectInfo.mccbAF || ''}
                                        onChange={(e) => updateProjectInfo('mccbAF', e.target.value)}
                                        className="bg-transparent border-none text-yellow-400 font-bold text-2xl outline-none text-left [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none p-0"
                                        style={{ width: `${String(projectInfo.mccbAF || '').length || 1}ch` }}
                                    />
                                    <span className="text-[12px] text-gray-400 ml-1">AF</span>
                                </span>
                                <span className="flex items-baseline ml-4">
                                    <input
                                        type="number"
                                        value={projectInfo.mccbAT || ''}
                                        onChange={(e) => updateProjectInfo('mccbAT', e.target.value)}
                                        className="bg-transparent border-none text-yellow-400 font-bold text-2xl outline-none text-left [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none p-0"
                                        style={{ width: `${String(projectInfo.mccbAT || '').length || 1}ch` }}
                                    />
                                    <span className="text-[12px] text-gray-400 ml-1">AT</span>
                                </span>
                            </div>
                            <div className="flex items-baseline gap-2 mt-1">
                                <div className="text-[#facc15] text-sm font-bold">
                                    {projectInfo.phase}
                                </div>
                                <select
                                    value={projectInfo.mainBreakerType || 'MCCB'}
                                    onChange={(e) => updateProjectInfo('mainBreakerType', e.target.value)}
                                    className="bg-transparent border-none text-yellow-400 font-bold text-sm outline-none cursor-pointer appearance-none p-0"
                                >
                                    {['MCCB', 'ELCB', 'ACB', 'VCB'].map(type => (
                                        <option key={type} value={type} className="bg-black">{type}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="bg-gray-900/30 p-4 min-h-[100px]">
                            <div className="text-gray-300 text-[10px] uppercase tracking-widest mb-1">Demand Factor</div>
                            <div className={`text-2xl font-bold flex items-baseline ${demandFactorSummary.avgPercent !== 100 ? 'text-purple-400' : 'text-[#d1d5db]'}`}>
                                <input
                                    type="text"
                                    value={demandFactorSummary.avgPercent.toFixed(1)}
                                    readOnly={true}
                                    className={`bg-transparent border-none font-bold text-2xl outline-none text-right p-0 ${demandFactorSummary.avgPercent !== 100 ? 'text-purple-400' : 'text-[#d1d5db]'}`}
                                    style={{ width: `${String(demandFactorSummary.avgPercent.toFixed(1)).length || 1}ch` }}
                                />
                                <span className="text-[12px] text-gray-400 ml-1">%</span>
                            </div>
                            <div className="text-[14px] font-bold text-blue-400 mt-1 flex items-baseline gap-3 flex-wrap">
                                <span>
                                    {demandFactorSummary.totalKva.toFixed(2)}
                                    <span className="text-[12px] text-gray-400 ml-0.5 font-normal">kVA</span>
                                </span>
                                <span>
                                    {demandFactorSummary.totalA.toFixed(1)}
                                    <span className="text-[12px] text-gray-400 ml-0.5 font-normal">A</span>
                                </span>
                            </div>
                        </div>
                        <div className="bg-gray-900/30 p-4 min-h-[100px] flex flex-col justify-between">
                            <div className="text-gray-300 text-[10px] uppercase tracking-widest mb-1">Maximum Demand</div>
                            <div>
                                <div className="text-2xl font-bold text-blue-400 flex items-baseline">
                                    <span>{demandFactorSummary.totalKva.toFixed(2)}</span>
                                    <span className="text-[12px] text-gray-400 ml-1">kVA</span>
                                </div>
                                <div className="text-[14px] font-bold text-blue-400 mt-1 flex items-baseline">
                                    <span>{demandFactorSummary.totalA.toFixed(1)}</span>
                                    <span className="text-[12px] text-gray-400 ml-1 font-normal">A</span>
                                </div>
                            </div>
                        </div>
                        <div className="bg-gray-900/30 p-4 min-h-[100px] flex flex-col justify-between">
                            <div className="text-gray-300 text-[10px] uppercase tracking-widest mb-1">Total Load</div>
                            <div>
                                <div className="text-2xl font-bold text-green-400 flex items-baseline">
                                    <span>{totalLoad.toFixed(2)}</span>
                                    <span className="text-[12px] text-gray-400 ml-1">kVA</span>
                                </div>
                                <div className="text-[14px] font-bold text-green-400 mt-1 flex items-baseline">
                                    <span>{totalCurrentCalc.toFixed(1)}</span>
                                    <span className="text-[12px] text-gray-400 ml-1 font-normal">A</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {showExportSaveModal && (
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
            )}
        </>
    );
};

export default Summary;

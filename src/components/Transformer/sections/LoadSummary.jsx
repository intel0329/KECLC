import React from 'react';
import { CornerBorders } from '../ui/TransformerUI';
import { Download, X } from 'lucide-react';

const LoadSummary = (props) => {
    const {
        projectInfo,
        exportToExcel,
        updateProjectInfo,
        demandFactorSummary,
        totalLoad,
        totalCurrentCalc,
        mofData,
        formatFuseRating,
        mainCtValue,
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
                        <h3 className="text-[12px] font-semibold text-gray-400 uppercase tracking-[0.2em]">Power System Overview</h3>
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
                            <div className="text-gray-300 text-[10px] uppercase tracking-widest mb-1">Transformer Capacity</div>
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
                                    {projectInfo.phase?.substring(0, 2)} 22.9kV/380V
                                </div>
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
                        <div className="bg-gray-900/30 p-4 min-h-[100px]">
                            <div className="text-gray-300 text-[10px] uppercase tracking-widest mb-1">Total Load</div>
                            <div className="text-2xl font-bold text-green-400">{totalLoad.toFixed(2)}<span className="text-[12px] text-gray-400 ml-1">kVA</span></div>
                        </div>
                        <div className="bg-gray-900/30 p-4 min-h-[100px]">
                            <div className="text-gray-300 text-[10px] uppercase tracking-widest mb-1">Total Current</div>
                            <div className="text-2xl font-bold text-green-400">
                                {totalCurrentCalc.toFixed(1)}
                                <span className="text-[12px] text-gray-400 ml-1">A</span>
                            </div>
                        </div>
                    </div>
                    <div className="border-t border-gray-900 my-4"></div>

                    {/* Second Row */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-4">
                        <div className="bg-gray-900/30 p-4 min-h-[100px] flex flex-col justify-between">
                            <div className="text-gray-300 text-[10px] uppercase tracking-widest mb-1">Transformer Type</div>
                            <div>
                                <div className="text-2xl font-bold text-yellow-400 flex items-baseline">
                                    <div className="relative inline-flex items-baseline">
                                        <span className="invisible whitespace-pre select-none">{projectInfo.usageType || 'OIL'}</span>
                                        <select
                                            value={projectInfo.usageType}
                                            onChange={(e) => updateProjectInfo('usageType', e.target.value)}
                                            className="absolute inset-0 bg-transparent border-none text-yellow-400 font-bold text-2xl outline-none cursor-pointer appearance-none p-0 w-full"
                                        >
                                            <option value="OIL" className="bg-black">OIL</option>
                                            <option value="MOLD" className="bg-black">MOLD</option>
                                        </select>
                                    </div>
                                    <span className="text-[12px] text-gray-400 ml-1.5">TYPE</span>
                                </div>
                                <div className="text-[12px] font-bold text-[#d1d5db] mt-1 space-y-0.5">
                                    <div>1차: 22.9kV</div>
                                    <div>2차: 380-220V</div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-gray-900/30 p-4 min-h-[100px]">
                            <div className="text-gray-300 text-[10px] uppercase tracking-widest mb-3">M.O.F</div>
                            <div className="flex-1 flex flex-col justify-center gap-y-1">
                                {/* Row 1: PT */}
                                <div className="flex items-baseline leading-none">
                                    <div className="text-gray-400 text-[10px] font-bold uppercase w-[30px] shrink-0 flex justify-between pr-2">
                                        <span>PT</span>
                                        <span>:</span>
                                    </div>
                                    <div className="flex items-baseline">
                                        <span className="text-[18px] sm:text-[19px] font-bold text-white tracking-tight">
                                            {mofData.pt?.split('/')[0] || '-'}
                                        </span>
                                        {mofData.pt?.includes('/') && (
                                            <span className="text-[12px] text-gray-300 ml-1.5 font-normal">
                                                /{mofData.pt.split('/')[1]}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {/* Row 2: CT */}
                                <div className="flex items-baseline leading-none text-white">
                                    <div className="text-gray-400 text-[10px] font-bold uppercase w-[30px] shrink-0 flex justify-between pr-2">
                                        <span>CT</span>
                                        <span>:</span>
                                    </div>
                                    <div className="flex items-baseline">
                                        <span className="text-[18px] sm:text-[19px] font-bold tracking-tight">{mofData.ct}</span>
                                        {mofData.ct && mofData.ct !== '-' && (
                                            <span className="text-[12px] text-gray-300 ml-1.5 font-normal">/5A</span>
                                        )}
                                    </div>
                                </div>
                                {/* Row 3: 강도 */}
                                <div className="flex items-baseline leading-none text-white">
                                    <div className="text-gray-400 text-[10px] font-bold uppercase w-[30px] shrink-0 flex justify-between pr-2">
                                        <span>강도</span>
                                        <span>:</span>
                                    </div>
                                    <div className="flex items-baseline">
                                        <span className="text-[18px] sm:text-[19px] font-bold tracking-tight">{mofData.ocs}</span>
                                        {mofData.ocs && mofData.ocs !== '-' && (
                                            <span className="text-[12px] text-gray-300 ml-1.5 font-normal">배수</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-gray-900/30 p-4 min-h-[100px]">
                            <div className="text-gray-300 text-[11px] uppercase tracking-widest mb-1.5 text-left">TR-한류형 FUSE</div>
                            <div className="flex items-baseline leading-none">
                                <div className="flex items-baseline">
                                    <span className="text-2xl font-bold text-white tracking-tight">
                                        {formatFuseRating(mofData.trSidePF).split('/')[0].replace(/[^0-9.]/g, '') || '-'}
                                    </span>
                                    {formatFuseRating(mofData.trSidePF) !== '-' && (
                                        <span className="text-[12px] text-[#d1d5db] ml-1 font-normal uppercase">A</span>
                                    )}
                                    {formatFuseRating(mofData.trSidePF).includes('/') && (
                                        <>
                                            <span className="text-2xl font-normal text-[#d1d5db] leading-none">/</span>
                                            <span className="text-2xl font-bold text-white tracking-tight">
                                                {formatFuseRating(mofData.trSidePF).split('/')[1].replace(/[^0-9.]/g, '')}
                                            </span>
                                            <span className="text-[12px] text-[#d1d5db] ml-1 font-normal uppercase">kA</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="bg-gray-900/30 p-4 min-h-[100px]">
                            {mofData.type === 'VCB' ? (
                                <>
                                    <div className="text-gray-300 text-[10px] uppercase tracking-widest mb-1">Vacuum C.Breaker</div>
                                    <div className="text-2xl font-bold text-white flex items-baseline flex-wrap">
                                        <span className="flex items-baseline">
                                            <span className="text-[12px] text-gray-400 mr-1.5 font-normal uppercase">VCB</span>
                                            <span>{mofData.af || '-'}</span>
                                            <span className="text-[12px] text-[#d1d5db] ml-1 font-normal uppercase">AF</span>
                                        </span>
                                    </div>
                                    <div className="text-[14px] font-bold text-white mt-1 flex items-baseline">
                                        <span className="text-[10px] text-gray-400 mr-1.5 font-normal uppercase">ISC</span>
                                        <span>{mofData.icu || '-'}</span>
                                        <span className="text-[10px] text-[#d1d5db] ml-1 font-normal uppercase">kA</span>
                                        {mofData.am && mofData.am !== '-' && (
                                            <>
                                                <span className="text-[12px] text-[#d1d5db] ml-2 font-normal">/</span>
                                                <span className="text-[14px] text-white ml-2 font-bold">{mofData.am}</span>
                                                <span className="text-[10px] text-[#d1d5db] ml-1 font-normal uppercase">A</span>
                                            </>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="text-gray-300 text-[10px] uppercase tracking-widest mb-1">Air Circuit Breaker</div>
                                    <div className="text-2xl font-bold text-white flex items-baseline flex-wrap">
                                        <span className="flex items-baseline">
                                            <span className="text-[12px] text-gray-400 mr-1.5 font-normal uppercase">ACB</span>
                                            <span>{mofData.af || '-'}</span>
                                            <span className="text-[12px] text-[#d1d5db] ml-1 font-normal uppercase">AF</span>
                                        </span>
                                    </div>
                                    <div className="text-[14px] font-bold text-white mt-1 flex items-baseline">
                                        <span className="text-[10px] text-gray-400 mr-1.5 font-normal uppercase">ICU</span>
                                        <span>{mofData.icu || '-'}</span>
                                        <span className="text-[10px] text-[#d1d5db] ml-1 font-normal uppercase">kA</span>
                                        {mofData.icu && mofData.icu !== '-' && (
                                            <>
                                                <span className="text-[12px] text-[#d1d5db] ml-2 font-normal">/</span>
                                                <span className="text-[14px] text-white ml-2 font-bold">{mofData.am || '-'}</span>
                                                <span className="text-[10px] text-[#d1d5db] ml-1 font-normal uppercase">A</span>
                                            </>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="bg-gray-900/30 p-4 min-h-[100px]">
                            <div className="text-gray-300 text-[10px] uppercase tracking-widest mb-1">TR-Secondary Side CT</div>
                            <div className="text-2xl font-bold text-white">
                                {mainCtValue ? (
                                    <>
                                        <div className="flex items-baseline">
                                            {mainCtValue}/5<span className="text-[12px] text-gray-400 ml-1">A</span>
                                        </div>
                                        <div className="text-sm font-bold text-[#d1d5db] mt-1 leading-none">
                                            CTx3 / 15VA
                                        </div>
                                    </>
                                ) : '-'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Export Save Confirmation Modal */}
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

export default LoadSummary;

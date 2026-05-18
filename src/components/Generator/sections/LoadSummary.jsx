import React from 'react';
import Papa from 'papaparse';
import { Download, X } from 'lucide-react';
import { CornerBorders } from '../ui/GeneratorUI';

const LoadSummary = (props) => {
    const {
        projectInfo,
        exportToExcel,
        updateProjectInfo,
        demandFactorSummary,
        totalLoad,
        totalCurrentCalc,
        mainCtValue,
        isCapacityMatched,
        showExportSaveModal,
        setShowExportSaveModal,
        performExcelExport,
        blackoutMotorSummary = { epValue: '0.00', totalPmResult: '0.00', plResult: '0.00', gpResult: '0.00', plAlpha: '-' },
        fireMotorSummary = { epValue: '0.00', totalPmResult: '0.00', plResult: '0.00', gpResult: '0.00', plAlpha: '-' }
    } = props;

    const [airFlowData, setAirFlowData] = React.useState([]);
    const [genSpecs, setGenSpecs] = React.useState([]);

    const handleExportSaveConfirm = () => {
        setShowExportSaveModal(false);
        performExcelExport();
    };

    // 발전기 기본 사양 데이터 (GEN.csv) 로드
    React.useEffect(() => {
        fetch('/db/GEN.csv')
            .then(res => res.text())
            .then(csvText => {
                Papa.parse(csvText, {
                    complete: (results) => {
                        const rows = results.data;
                        // 첫 번째 열이 숫자인 행만 필터링
                        const specRows = rows.filter(row => row.length >= 7 && !isNaN(parseFloat(row[0])));
                        setGenSpecs(specRows);
                    }
                });
            })
            .catch(err => console.error("GEN.csv Load Error:", err));
    }, []);

    // 발전기 급기/배기 데이터 로드 (Google Sheets)
    React.useEffect(() => {
        const csvUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTp4X_BQoTa--JuRHVpsewIGW2IE57RNVoctPqa1cURG1NZ65MUgudF94xuv3GyMTwTrYlJkmsd05_j/pub?gid=505183513&single=true&output=csv";
        fetch(csvUrl)
            .then(res => res.text())
            .then(csvText => {
                Papa.parse(csvText, {
                    complete: (results) => {
                        if (results.data && results.data.length > 3) {
                            setAirFlowData(results.data.slice(3));
                        }
                    }
                });
            })
            .catch(err => console.error("AirFlow CSV Load Error:", err));
    }, []);

    // [통합 자동 업데이트] 용량 변경 시 모든 사양(상용출력, 연료탱크, 무게, PAD, 급배기) 즉시 업데이트
    React.useEffect(() => {
        if (!projectInfo.mainCapacity) return;
        const capacity = parseFloat(projectInfo.mainCapacity);
        if (isNaN(capacity) || capacity === 0) return;

        // 1. 기본 사양 (GEN.csv) 매칭
        if (genSpecs.length > 0) {
            const match = genSpecs.find(row => parseFloat(row[0]) === capacity);
            if (match) {
                if (projectInfo.primePowerKw !== match[2]) updateProjectInfo('primePowerKw', match[2]);
                if (projectInfo.primePowerKva !== match[3]) updateProjectInfo('primePowerKva', match[3]);
                if (projectInfo.fuelTank !== match[4]) updateProjectInfo('fuelTank', match[4]);
                if (projectInfo.weight !== match[5]) updateProjectInfo('weight', match[5]);
                if (projectInfo.padSize !== match[6]) updateProjectInfo('padSize', match[6]);
            }
        }

        // 2. 급기/배기 데이터 매칭
        if (airFlowData.length > 0) {
            const match = airFlowData.find(row => parseInt(row[1]) === capacity);
            if (match) {
                const exhaust = match[4] ? match[4].replace(/[^0-9.]/g, '') : '-';
                const intake = match[6] ? match[6].replace(/[^0-9.]/g, '') : '-';
                const newValue = `급기: ${intake} ㎡\n배기: ${exhaust} ㎡`;
                if (projectInfo.airFlow !== newValue) {
                    updateProjectInfo('airFlow', newValue);
                }
            }
        }
    }, [projectInfo.mainCapacity, genSpecs, airFlowData, updateProjectInfo]);

    return (
        <>
            {/* Load Summary Section */}
            <div className="grid grid-cols-12 gap-4 mb-4">
                <div className="col-span-12 border border-gray-900 bg-black p-4 relative">
                    <CornerBorders />
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-[12px] font-normal text-gray-400 uppercase tracking-[0.2em]">Generator System Overview</h3>
                        <div className="flex gap-2" data-html2canvas-ignore="true">
                            <button
                                onClick={exportToExcel}
                                title="Excel"
                                className="w-10 md:w-[100px] aspect-square md:aspect-auto md:px-3 md:py-2 bg-green-700 hover:bg-green-600 text-white text-[10px] font-normal uppercase tracking-widest transition-all flex items-center justify-center md:gap-2 border border-green-500/50"
                            >
                                <Download size={14} /> <span className="hidden md:inline">Excel</span>
                            </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        {/* Row 1: Standard Summary */}
                        <div className="bg-gray-900/30 p-4 min-h-[100px]">
                            <div className="text-gray-300 text-[10px] uppercase tracking-widest mb-1 font-normal">STANDBY Power <span className="block sm:inline">(비상출력)</span></div>
                            <div className="text-2xl font-normal flex flex-col sm:flex-row sm:items-baseline leading-tight gap-y-0.5 sm:gap-y-0">
                                <div className="flex items-baseline">
                                    <input
                                        type="number"
                                        value={projectInfo.mainCapacity || ''}
                                        onChange={(e) => updateProjectInfo('mainCapacity', e.target.value)}
                                        placeholder="0"
                                        className="bg-transparent border-none text-yellow-400 placeholder:text-yellow-500 placeholder:opacity-100 font-normal text-2xl outline-none text-left [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none p-0"
                                        style={{ width: `${(String(projectInfo.mainCapacity || '').length || 1)}ch` }}
                                    />
                                    <span className="text-[12px] text-yellow-500/60 ml-1 font-normal">kW</span>
                                </div>
                                {(() => {
                                    const kvaVal = parseFloat(projectInfo.mainCapacity || 0) / 0.8;
                                    const hasValue = kvaVal > 0;
                                    return (
                                        <div className="flex items-baseline">
                                            <span className="mx-1 text-gray-700 text-lg sm:mx-2">/</span>
                                            <span className="font-normal text-yellow-400">
                                                {kvaVal.toFixed(0)}
                                            </span>
                                            <span className="text-[12px] text-yellow-500/60 ml-1 font-normal">kVA</span>
                                        </div>
                                    );
                                })()}
                            </div>
                            <div className="flex items-baseline gap-2 mt-1">
                                <div className="text-[#facc15] text-sm font-normal">
                                    {projectInfo.phase?.substring(0, 2)} 380V/220V
                                </div>
                            </div>
                        </div>
                        <div className="bg-gray-900/30 p-4 min-h-[100px]">
                            <div className="text-gray-300 text-[10px] uppercase tracking-widest mb-1">Demand Factor</div>
                            <div className={`text-2xl font-normal flex items-baseline ${demandFactorSummary.avgPercent !== 100 ? 'text-purple-400' : 'text-[#d1d5db]'}`}>
                                <input
                                    type="text"
                                    value={demandFactorSummary.avgPercent.toFixed(0)}
                                    readOnly={true}
                                    className={`bg-transparent border-none font-normal text-2xl outline-none text-left p-0 ${demandFactorSummary.avgPercent !== 100 ? 'text-purple-400' : 'text-[#d1d5db]'}`}
                                    style={{ width: `${String(demandFactorSummary.avgPercent.toFixed(0)).length || 1}ch` }}
                                />
                                <span className="text-[12px] text-gray-400 ml-1">%</span>
                            </div>
                            <div className="text-[14px] font-normal text-blue-400 mt-1 flex items-baseline gap-3 flex-wrap">
                                <span>
                                    {demandFactorSummary.totalKva.toFixed(2)}
                                    <span className="text-[12px] text-gray-400 ml-0.5 font-normal">kVA</span>
                                </span>
                                <span>
                                    {demandFactorSummary.totalKw.toFixed(2)}
                                    <span className="text-[12px] text-gray-400 ml-0.5 font-normal">kW</span>
                                </span>
                            </div>
                        </div>
                        <div className="bg-gray-900/30 p-4 min-h-[100px] flex flex-col justify-between">
                            <div className="text-gray-300 text-[10px] uppercase tracking-widest mb-1">Maximum Demand</div>
                            <div>
                                <div className="text-2xl font-normal text-blue-400 flex items-baseline">
                                    <span>{demandFactorSummary.totalKva.toFixed(2)}</span>
                                    <span className="text-[12px] text-gray-400 ml-1">kVA</span>
                                </div>
                                <div className="text-[14px] font-normal text-blue-400 mt-1 flex items-baseline">
                                    <span>{demandFactorSummary.totalKw.toFixed(2)}</span>
                                    <span className="text-[12px] text-gray-400 ml-1 font-normal">kW</span>
                                </div>
                            </div>
                        </div>
                        <div className="bg-gray-900/30 p-4 min-h-[100px]">
                            <div className="text-gray-300 text-[10px] uppercase tracking-widest mb-1">Total Load</div>
                            <div className="text-2xl font-normal text-green-400">{totalLoad.toFixed(2)}<span className="text-[12px] text-gray-400 ml-1">kVA</span></div>
                        </div>
                        <div className="bg-gray-900/30 p-4 min-h-[100px]">
                            <div className="text-gray-300 text-[10px] uppercase tracking-widest mb-1">Total Power</div>
                            <div className="text-2xl font-normal text-green-400">
                                {(totalLoad * 0.8).toFixed(2)}
                                <span className="text-[12px] text-gray-400 ml-1">kW</span>
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-gray-900 my-4"></div>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        {/* Row 2: Equipment Specifications */}
                        <div className="bg-gray-900/30 p-4 min-h-[100px]">
                            <div className="text-gray-300 text-[11px] uppercase tracking-widest mb-1 font-normal">PRIME Power <span className="block sm:inline">(상용출력)</span></div>
                            <div className={`text-2xl font-normal flex flex-col sm:flex-row sm:items-baseline leading-tight gap-y-0.5 sm:gap-y-0 ${!isCapacityMatched ? 'text-red-500' : 'text-[#d1d5db]'}`}>
                                <div className="flex items-baseline">
                                    <input
                                        type="number"
                                        value={projectInfo.primePowerKw || ''}
                                        readOnly={true}
                                        placeholder="0"
                                        className={`bg-transparent border-none font-normal text-2xl outline-none text-left [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none p-0 ${!isCapacityMatched ? 'text-red-500' : 'text-[#d1d5db] placeholder:text-[#d1d5db]/50'}`}
                                        style={{ width: `${(String(projectInfo.primePowerKw || '').length || 1)}ch` }}
                                    />
                                    <span className={`text-[12px] ml-1 font-normal ${!isCapacityMatched ? 'text-red-700' : 'text-[#d1d5db]/60'}`}>kW</span>
                                </div>
                                <div className="flex items-baseline">
                                    <span className={`mx-1 text-lg sm:mx-2 ${!isCapacityMatched ? 'text-red-700' : 'text-gray-700'}`}>/</span>
                                    <div className="flex items-baseline">
                                        <input
                                            type="number"
                                            value={projectInfo.primePowerKva || ''}
                                            readOnly={true}
                                            placeholder="0"
                                            className={`bg-transparent border-none font-normal text-2xl outline-none text-left [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none p-0 ${!isCapacityMatched ? 'text-red-500' : 'text-[#d1d5db] placeholder:text-[#d1d5db]/50'}`}
                                            style={{ width: `${(String(projectInfo.primePowerKva || '').length || 1)}ch` }}
                                        />
                                        <span className={`text-[12px] ml-1 font-normal ${!isCapacityMatched ? 'text-red-700' : 'text-[#d1d5db]/60'}`}>kVA</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-baseline gap-2 mt-1">
                                <div className={`text-sm font-normal ${isCapacityMatched ? 'text-[#d1d5db]' : 'text-red-600'}`}>
                                    {projectInfo.phase?.substring(0, 2)} 380V/220V
                                </div>
                            </div>
                        </div>
                        <div className="bg-gray-900/30 p-4 min-h-[100px]">
                            <div className="text-gray-300 text-[11px] uppercase tracking-widest mb-1 font-normal">급기/배기</div>
                            <div className="text-[17px] leading-relaxed text-[#d1d5db] font-normal">
                                {(() => {
                                    const val = projectInfo.airFlow || '-';
                                    if (val === '-') return '-';
                                    return val.split('\n').map((line, idx) => {
                                        const [label, content] = line.split(': ');
                                        if (!content) return <div key={idx}>{line}</div>;
                                        const parts = content.trim().split(' ');
                                        const value = parts[0];
                                        const unit = parts[1] || '';
                                        return (
                                            <div key={idx} className="flex items-baseline gap-1">
                                                <span>{label}:</span>
                                                <span>{value}</span>
                                                <span className="text-gray-500 text-[12px]">{unit}</span>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        </div>
                        <div className="bg-gray-900/30 p-4 min-h-[100px]">
                            <div className="text-gray-300 text-[11px] uppercase tracking-widest mb-1 font-normal">연료탱크</div>
                            <div className="text-2xl font-normal text-green-400">
                                {(() => {
                                    const val = projectInfo.fuelTank || '';
                                    const isNumeric = val !== '별치형' && !isNaN(parseFloat(val));
                                    
                                    if (isNumeric) {
                                        return (
                                            <div className="flex flex-col leading-tight">
                                                <div className="flex items-baseline">
                                                    <input
                                                        type="text"
                                                        value={val}
                                                        onChange={(e) => updateProjectInfo('fuelTank', e.target.value)}
                                                        placeholder="0"
                                                        className="bg-transparent border-none text-[#d1d5db] font-normal text-2xl outline-none text-left p-0 w-auto"
                                                        style={{ width: `${(String(val).length || 1)}ch` }}
                                                    />
                                                    <span className="text-[12px] text-gray-500 ml-1 font-normal">L</span>
                                                </div>
                                                <div className="text-[12px] text-[#d1d5db] opacity-60 font-normal mt-1">탑재형</div>
                                            </div>
                                        );
                                    }
                                    return (
                                        <input
                                            type="text"
                                            value={val}
                                            onChange={(e) => updateProjectInfo('fuelTank', e.target.value)}
                                            placeholder="-"
                                            className="bg-transparent border-none text-[#d1d5db] font-normal text-2xl outline-none text-left p-0 w-full"
                                        />
                                    );
                                })()}
                            </div>
                        </div>
                        <div className="bg-gray-900/30 p-4 min-h-[100px]">
                            <div className="text-gray-300 text-[11px] uppercase tracking-widest mb-1 font-normal">무게</div>
                            <div className="text-2xl font-normal text-[#d1d5db] flex items-baseline">
                                <input
                                    type="text"
                                    value={projectInfo.weight || ''}
                                    onChange={(e) => updateProjectInfo('weight', e.target.value)}
                                    placeholder="-"
                                    className="bg-transparent border-none text-[#d1d5db] font-normal text-2xl outline-none text-left p-0 w-auto"
                                    style={{ width: `${(String(projectInfo.weight || '').length || 1)}ch` }}
                                />
                                <span className="text-[12px] text-gray-500 ml-1 font-normal">kg</span>
                            </div>
                        </div>
                        <div className="bg-gray-900/30 p-4 min-h-[100px]">
                            <div className="text-gray-300 text-[11px] uppercase tracking-widest mb-1 font-normal">PAD (L×W×H)</div>
                            <div className="text-[#d1d5db] font-normal text-2xl leading-tight">
                                {(() => {
                                    const val = projectInfo.padSize || '';
                                    const parts = val.split(' × ');
                                    const XSymbol = () => <span className="text-[0.6em] opacity-60 inline-block align-middle">×</span>;
                                    
                                    if (parts.length === 3) {
                                        return (
                                            <div className="flex flex-row items-baseline whitespace-nowrap">
                                                <span>{parts[0]}</span><XSymbol /><span>{parts[1]}</span><XSymbol /><span>{parts[2]}</span>
                                            </div>
                                        );
                                    }
                                    return (
                                        <input
                                            type="text"
                                            value={val}
                                            onChange={(e) => updateProjectInfo('padSize', e.target.value)}
                                            placeholder="-"
                                            className="bg-transparent border-none text-[#d1d5db] font-normal text-2xl outline-none text-left p-0 w-full"
                                        />
                                    );
                                })()}
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-gray-900 my-4"></div>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        {/* Row 3: Blackout Required Capacity & Exceed Motor */}
                        <div className="bg-gray-900/30 p-4 min-h-[100px]">
                            <div className="text-sky-400 text-[11px] uppercase tracking-widest mb-1 font-normal">정전 시 발전기 용량</div>
                            <div className="text-2xl font-normal text-green-400 flex items-baseline flex-wrap">
                                <span className="flex items-baseline">
                                    <span>{blackoutMotorSummary.gpResult || '0.00'}</span>
                                    <span className="text-[12px] text-gray-500 ml-1 font-normal">kVA</span>
                                </span>
                            </div>
                        </div>
                        <div className="bg-gray-900/30 p-4 min-h-[100px]">
                            <div className="text-sky-400 text-[11px] uppercase tracking-widest mb-1 font-normal">전동기를 제외한 부하</div>
                            <div>
                                <div className="text-2xl font-normal text-[#d1d5db] flex items-baseline">
                                    <span>{blackoutMotorSummary.epValue || '0.00'}</span>
                                    <span className="text-[12px] text-gray-500 ml-1 font-normal">kVA</span>
                                </div>
                                <div className="text-[13px] text-gray-400 font-normal italic -mt-1">ΣP × 수용률 (정전)</div>
                            </div>
                        </div>
                        <div className="bg-gray-900/30 p-4 min-h-[100px]">
                            <div className="text-sky-400 text-[11px] uppercase tracking-widest mb-1 font-normal">일반 전동기 부하 합계</div>
                            <div>
                                <div className="text-2xl font-normal text-[#d1d5db] flex items-baseline">
                                    <span>{blackoutMotorSummary.totalPmResult || '0.00'}</span>
                                    <span className="text-[12px] text-gray-500 ml-1 font-normal">kVA</span>
                                </div>
                                <div className="text-[13px] text-gray-400 font-normal italic -mt-1">
                                    ΣP<sub className="not-italic">M</sub>×α × 수용률 (정전)
                                </div>
                            </div>
                        </div>
                        <div className="bg-gray-900/30 p-4 min-h-[100px]">
                            <div className="text-sky-400 text-[11px] uppercase tracking-widest mb-1 font-normal">기동용량 최대 전동기</div>
                            <div>
                                <div className="text-2xl font-normal text-orange-400 flex items-baseline">
                                    <span>{blackoutMotorSummary.plResult || '0.00'}</span>
                                    <span className="text-[12px] text-gray-500 ml-1 font-normal">kVA</span>
                                </div>
                                <div className="text-[13px] text-gray-400 font-normal italic -mt-1">
                                    P<sub className="not-italic">L</sub>×α×β×C (정전)
                                </div>
                            </div>
                        </div>
                        <div className="bg-gray-900/30 p-4 min-h-[100px]">
                            <div className="text-sky-400 text-[11px] uppercase tracking-widest mb-1 font-normal">발전기 허용 전압강하 K</div>
                            <div>
                                <div className="text-2xl font-normal text-yellow-400 flex items-baseline h-[32px]">
                                    <select
                                        value={projectInfo.generatorKFactor || '1.13'}
                                        onChange={(e) => updateProjectInfo('generatorKFactor', e.target.value)}
                                        className="bg-transparent border-none text-yellow-400 font-normal text-2xl outline-none p-0 cursor-pointer appearance-none leading-none h-full"
                                    >
                                        <option value="1.13" className="bg-gray-900 text-white">1.13</option>
                                        <option value="1.10" className="bg-gray-900 text-white">1.10</option>
                                        <option value="1.07" className="bg-gray-900 text-white">1.07</option>
                                        <option value="1.05" className="bg-gray-900 text-white">1.05</option>
                                    </select>
                                </div>
                                <div className="text-sm text-transparent font-normal select-none -mt-1">&nbsp;</div>
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-gray-900 my-4"></div>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        {/* Row 4: Fire Required Capacity */}
                        <div className="bg-gray-900/30 p-4 min-h-[100px]">
                            <div className="text-rose-400 text-[11px] uppercase tracking-widest mb-1 font-normal">화재 시 발전기 용량</div>
                            <div className="text-2xl font-normal text-green-400 flex items-baseline flex-wrap">
                                <span className="flex items-baseline">
                                    <span>{fireMotorSummary.gpResult || '0.00'}</span>
                                    <span className="text-[12px] text-gray-500 ml-1 font-normal">kVA</span>
                                </span>
                            </div>
                        </div>
                        <div className="bg-gray-900/30 p-4 min-h-[100px]">
                            <div className="text-rose-400 text-[11px] uppercase tracking-widest mb-1 font-normal">전동기를 제외한 부하</div>
                            <div>
                                <div className="text-2xl font-normal text-[#d1d5db] flex items-baseline">
                                    <span>{fireMotorSummary.epValue || '0.00'}</span>
                                    <span className="text-[12px] text-gray-500 ml-1 font-normal">kVA</span>
                                </div>
                                <div className="text-[13px] text-gray-400 font-normal italic -mt-1">ΣP (비상)</div>
                            </div>
                        </div>
                        <div className="bg-gray-900/30 p-4 min-h-[100px]">
                            <div className="text-rose-400 text-[11px] uppercase tracking-widest mb-1 font-normal">일반 전동기 부하 합계</div>
                            <div>
                                <div className="text-2xl font-normal text-[#d1d5db] flex items-baseline">
                                    <span>{fireMotorSummary.totalPmResult || '0.00'}</span>
                                    <span className="text-[12px] text-gray-500 ml-1 font-normal">kVA</span>
                                </div>
                                <div className="text-[13px] text-gray-400 font-normal italic -mt-1">
                                    ΣP<sub className="not-italic">M</sub>×α (비상)
                                </div>
                            </div>
                        </div>
                        <div className="bg-gray-900/30 p-4 min-h-[100px]">
                            <div className="text-rose-400 text-[11px] uppercase tracking-widest mb-1 font-normal">기동용량 최대 전동기</div>
                            <div>
                                <div className="text-2xl font-normal text-orange-400 flex items-baseline">
                                    <span>{fireMotorSummary.plResult || '0.00'}</span>
                                    <span className="text-[12px] text-gray-500 ml-1 font-normal">kVA</span>
                                </div>
                                <div className="text-[13px] text-gray-400 font-normal italic -mt-1">
                                    P<sub className="not-italic">L</sub>×α×β×C (비상)
                                </div>
                            </div>
                        </div>
                        <div className="bg-gray-900/30 p-4 min-h-[100px]">
                            <div className="text-rose-400 text-[11px] uppercase tracking-widest mb-1 font-normal">발전기 허용 전압강하 K</div>
                            <div>
                                <div className="text-2xl font-normal text-yellow-400 flex items-baseline h-[32px]">
                                    <select
                                        value={projectInfo.generatorKFactor || '1.13'}
                                        onChange={(e) => updateProjectInfo('generatorKFactor', e.target.value)}
                                        className="bg-transparent border-none text-yellow-400 font-normal text-2xl outline-none p-0 cursor-pointer appearance-none leading-none h-full"
                                    >
                                        <option value="1.13" className="bg-gray-900 text-white">1.13</option>
                                        <option value="1.10" className="bg-gray-900 text-white">1.10</option>
                                        <option value="1.07" className="bg-gray-900 text-white">1.07</option>
                                        <option value="1.05" className="bg-gray-900 text-white">1.05</option>
                                    </select>
                                </div>
                                <div className="text-sm text-transparent font-normal select-none -mt-1">&nbsp;</div>
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

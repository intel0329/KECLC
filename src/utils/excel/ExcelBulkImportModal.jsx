import React, { useState, useRef, useEffect } from 'react';
import { X, FileSpreadsheet, FileUp, Check, AlertCircle, Loader, ChevronDown as ChevronDownIcon } from 'lucide-react';
import * as XLSX from 'xlsx';
import { parseSheetToPanelData, parseSheetToPowerLoadData } from './excelParser';
import { EXCEL_TEMPLATES } from './excelTemplates';
import projectService from '../../services/projectService';

/**
 * 전용 사이드바 엑셀 일괄 임포트 모달 (공통 모듈)
 */
const ExcelBulkImportModal = ({ isOpen, onClose, projectId, project, onComplete, targetType = 'panel-load' }) => {
    const [file, setFile] = useState(null);
    const [workbook, setWorkbook] = useState(null);
    const [sheets, setSheets] = useState([]);
    const [selectedSheets, setSelectedSheets] = useState([]);
    const [selectedTemplate, setSelectedTemplate] = useState('standard_keclc');
    const [isImporting, setIsImporting] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0, status: '' });

    // [NEW] targetType 변화에 따른 초기 상태 동기화
    useEffect(() => {
        if (isOpen) {
            setSelectedTemplate(targetType === 'power-load' ? 'sh_tech_power' : 'standard_keclc');
            // 파일이 이미 선택되어 있는 상태에서 타입이 바뀌면 시트 재필터링 (재선택 유도)
            if (workbook) {
                const sheetNames = workbook.SheetNames.filter(name => 
                    !['전선', '광속표', '조명율표', '목차', '표지'].some(kw => name.includes(kw))
                );
                if (targetType === 'power-load') {
                    setSelectedSheets(sheetNames.filter(name => 
                        name.startsWith('PP-') || name.startsWith('MCC-') || name.includes('동력')
                    ));
                } else {
                    setSelectedSheets(sheetNames.filter(name => 
                        name.startsWith('LP-') || name.startsWith('PP-')
                    ));
                }
            }
        }
    }, [isOpen, targetType, workbook]);
    const fileInputRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);
    if (!isOpen) return null;

    // 공통 파일 처리 로직
    const processExcelFile = (selectedFile) => {
        if (!selectedFile) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = new Uint8Array(event.target.result);
                const wb = XLSX.read(data, { type: 'array' });
                setFile(selectedFile);
                setWorkbook(wb);
                
                // 시트 목록 추출 및 필터링 (불필요한 시스템 시트 및 문서용 시트 제외)
                const excludedKeywords = ['전선', '광속표', '조명율표', '전동기 TABLE', 'Sheet', 'laroux', '목차', '표지'];
                const sheetNames = wb.SheetNames.filter(name => 
                    !excludedKeywords.some(keyword => name.toLowerCase().includes(keyword.toLowerCase()))
                );
                setSheets(sheetNames);
                
                // 타입에 따른 기본 시트 선택 로직
                if (targetType === 'power-load') {
                    setSelectedSheets(sheetNames.filter(name => 
                        name.startsWith('PP-') || name.startsWith('MCC-') || name.includes('동력')
                    ));
                } else {
                    setSelectedSheets(sheetNames.filter(name => 
                        name.startsWith('LP-') || name.startsWith('PP-')
                    ));
                }
            } catch (err) {
                window.dispatchEvent(new CustomEvent('kelc_show_toast', {
                    detail: { message: '엑셀 파일을 읽는 중 오류가 발생했습니다.', type: 'error' }
                }));
                console.error(err);
            }
        };
        reader.readAsArrayBuffer(selectedFile);
    };

    // 파일 선택 핸들러
    const handleFileChange = (e) => {
        processExcelFile(e.target.files[0]);
    };

    // 드래그 앤 드롭 핸들러
    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile && (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls'))) {
            processExcelFile(droppedFile);
        } else {
            alert('엑셀 파일(.xlsx, .xls)만 업로드 가능합니다.');
        }
    };

    // 시트 선택 토글
    const toggleSheet = (name) => {
        setSelectedSheets(prev => 
            prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]
        );
    };

    // 중복 방지 이름 생성기
    const getSafePanelName = (name) => {
        let uniqueName = name;
        let counter = 1;

        const exists = (n) => {
            const check = (items) => {
                for (const item of items) {
                    if (item.name === n) return true;
                    if (item.children && check(item.children)) return true;
                }
                return false;
            };
            return check(project.calculators);
        };

        while (exists(uniqueName)) {
            uniqueName = `${name}(${counter})`;
            counter++;
        }
        return uniqueName;
    };

    // 일괄 임포트 실행
    const handleExecuteImport = async () => {
        if (!workbook || selectedSheets.length === 0) return;

        setIsImporting(true);
        setProgress({ current: 0, total: selectedSheets.length, status: '시작 중...' });

        let successCount = 0;

        try {
            for (let i = 0; i < selectedSheets.length; i++) {
                const sheetName = selectedSheets[i];
                setProgress({ current: i + 1, total: selectedSheets.length, status: `'${sheetName}' 파싱 및 생성 중...` });

                // 1. 데이터 파싱
                let parsedData = null;
                if (targetType === 'power-load') {
                    parsedData = parseSheetToPowerLoadData(workbook, sheetName, selectedTemplate);
                } else {
                    parsedData = parseSheetToPanelData(workbook, sheetName, selectedTemplate);
                }
                
                // 데이터가 전혀 파싱되지 않은 경우 건너뜀 (안전 장치)
                if (!parsedData) continue;

                // 회로/부하 데이터 존재 여부 체크
                if (targetType === 'power-load') {
                    if (!parsedData.powerLoads || parsedData.powerLoads.length === 0) continue;
                } else {
                    if (!parsedData.leftCircuits.length && !parsedData.rightCircuits.length) continue;
                }

                // 2. 안전한 이름 확보
                const panelNameFromExcel = parsedData.projectInfo.panelName || sheetName;
                const safeName = getSafePanelName(panelNameFromExcel);
                parsedData.projectInfo.panelName = safeName;

                // 3. 판넬 등록 (API 호출)
                const updatedProject = await projectService.addPanelToProject(projectId, targetType, {
                    name: safeName,
                    idPrefix: targetType
                });

                // 생성된 판넬의 ID 찾기 (방금 추가된 마지막 자식)
                const calculator = updatedProject.calculators.find(c => c.id === targetType);
                if (!calculator || !calculator.children) continue;
                
                const newPanel = calculator.children[calculator.children.length - 1];

                if (newPanel) {
                    // 4. 세부 데이터 저장
                    const originKey = `kelc_panel_data_${newPanel.id}`;
                    const dataToSave = {
                        projectInfo: parsedData.projectInfo,
                        ...(targetType === 'power-load' 
                            ? { powerLoads: parsedData.powerLoads } 
                            : { leftCircuits: parsedData.leftCircuits, rightCircuits: parsedData.rightCircuits }),
                        savedAt: new Date().toISOString(),
                        isDraft: false
                    };
                    await projectService.setRemoteData(projectId, originKey, dataToSave);
                    successCount++;
                }
            }

            if (successCount > 0) {
                window.dispatchEvent(new CustomEvent('kelc_show_toast', {
                    detail: { 
                        message: `${successCount}개의 판넬이 성공적으로 생성되었습니다.`, 
                        type: 'success' 
                    }
                }));
            } else {
                window.dispatchEvent(new CustomEvent('kelc_show_toast', {
                    detail: { 
                        message: "가져올 수 있는 유효한 데이터가 없습니다. 시트 내용을 확인해주세요.", 
                        type: 'error' 
                    }
                }));
            }
            
            // 약간의 딜레이를 주어 DB 저장이 완료되고 UI가 갱신될 시간을 확보
            setTimeout(() => onComplete(), 500);
        } catch (err) {
            console.error('Bulk import failed:', err);
            window.dispatchEvent(new CustomEvent('kelc_show_toast', {
                detail: { message: '엑셀 데이터 처리 중 오류가 발생했습니다.', type: 'error' }
            }));
        } finally {
            setIsImporting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="relative bg-[#0a0a0a] border border-gray-800 w-full max-w-xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900/50">
                    <div className="flex items-center gap-2">
                        <FileSpreadsheet className="text-green-500" size={18} />
                        <h3 className="text-sm font-bold text-white uppercase tracking-widest">
                            {targetType === 'power-load' ? '동력 부하' : '분전반 부하'} 엑셀 가져오기
                        </h3>
                    </div>
                    {!isImporting && (
                        <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                    )}
                </div>

                <div className="p-6">
                    {!file ? (
                        <div 
                            onClick={() => fileInputRef.current.click()}
                            onDragOver={handleDragOver}
                            onDragEnter={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            className={`border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center cursor-pointer transition-all group ${isDragging ? 'border-green-500 bg-green-500/10 scale-[0.99]' : 'border-gray-800 hover:border-green-500/50 hover:bg-green-500/5'}`}
                        >
                            <FileUp size={48} className={`transition-colors mb-4 ${isDragging ? 'text-green-500' : 'text-gray-700 group-hover:text-green-500'}`} />
                            <div className={`text-[14px] font-medium transition-colors ${isDragging ? 'text-gray-200' : 'text-gray-400 group-hover:text-gray-200'}`}>엑셀 파일을 드래그하거나 클릭하여 업로드</div>
                            <div className="text-[11px] text-gray-600 mt-2 tracking-wide uppercase">지원 형식: .xlsx, .xls</div>
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                onChange={handleFileChange} 
                                accept=".xlsx, .xls"
                                className="hidden" 
                            />
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* File Info & Template */}
                            <div className="flex items-center justify-between bg-gray-900/80 border border-gray-800 p-3 rounded-lg">
                                <div className="flex items-center gap-3 overflow-hidden min-w-0">
                                    <div className="bg-green-500/10 p-2 rounded shrink-0">
                                        <Check size={16} className="text-green-500" />
                                    </div>
                                    <div className="overflow-hidden min-w-0">
                                        <div className="text-[12px] text-white font-bold truncate" title={file.name}>{file.name}</div>
                                        <div className="text-[10px] text-gray-500 uppercase font-medium">{sheets.length}개의 시트 확인됨</div>
                                    </div>
                                </div>
                                {!isImporting && (
                                    <button 
                                        onClick={() => { setFile(null); setWorkbook(null); setSheets([]); }}
                                        className="text-[11px] bg-red-500/10 text-red-500 hover:bg-red-500/20 px-3 py-1 rounded font-bold transition-all"
                                    >
                                        변경
                                    </button>
                                )}
                            </div>

                             <div className="space-y-2">
                                <label className="text-[11px] text-gray-500 font-bold uppercase tracking-widest">양식 선택</label>
                                <div className="relative">
                                    <select 
                                        value={selectedTemplate}
                                        onChange={(e) => setSelectedTemplate(e.target.value)}
                                        className="w-full bg-[#111] border border-gray-800 text-gray-300 text-[12px] pl-3 pr-10 py-2.5 rounded outline-none focus:border-green-500/50 transition-all font-medium appearance-none cursor-pointer"
                                        disabled={isImporting}
                                    >
                                        {EXCEL_TEMPLATES.map(t => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                                        <ChevronDownIcon size={14} />
                                    </div>
                                </div>
                            </div>

                            {/* Sheet Selection */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-[11px] text-gray-500 font-bold uppercase tracking-widest">가져올 시트 선택 ({selectedSheets.length})</label>
                                    {!isImporting && (
                                        <button 
                                            onClick={() => setSelectedSheets(selectedSheets.length === sheets.length ? [] : sheets)}
                                            className="text-[10px] text-blue-500 hover:text-blue-400 font-bold uppercase"
                                        >
                                            전체 {selectedSheets.length === sheets.length ? '해제' : '선택'}
                                        </button>
                                    )}
                                </div>
                                 <div className="grid grid-cols-2 gap-2 max-h-[240px] sm:max-h-[320px] overflow-y-auto custom-scrollbar">
                                    {sheets.map(name => (
                                        <div 
                                            key={name}
                                            onClick={() => !isImporting && toggleSheet(name)}
                                            className={`flex items-center gap-2 p-2.5 rounded border border-gray-800 transition-all cursor-pointer ${selectedSheets.includes(name) ? 'bg-green-500/5 border-green-500/30' : 'hover:bg-gray-800/50'}`}
                                        >
                                            <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center transition-all ${selectedSheets.includes(name) ? 'bg-green-500 border-green-500' : 'border-gray-700'}`}>
                                                {selectedSheets.includes(name) && <Check size={10} strokeWidth={4} className="text-black" />}
                                            </div>
                                            <span className={`text-[11px] font-medium truncate ${selectedSheets.includes(name) ? 'text-green-400' : 'text-gray-500'}`}>{name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Import Button or Progress */}
                            {isImporting ? (
                                <div className="space-y-3 bg-gray-900/50 p-4 rounded-lg border border-gray-800">
                                    <div className="flex items-center justify-between text-[11px] font-bold">
                                        <div className="flex items-center gap-2">
                                            <Loader size={14} className="animate-spin text-green-500" />
                                            <span className="text-gray-300">{progress.status}</span>
                                        </div>
                                        <span className="text-green-500">{progress.current} / {progress.total}</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-green-500 transition-all duration-300"
                                            style={{ width: `${(progress.current / progress.total) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <button 
                                    onClick={handleExecuteImport}
                                    disabled={selectedSheets.length === 0}
                                    className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-800 text-white font-bold text-[13px] py-3.5 rounded-lg transition-all shadow-lg shadow-green-900/10 flex items-center justify-center gap-2"
                                >
                                    {selectedSheets.length}개의 {targetType === 'power-load' ? '동력반' : '분전반'} 생성하기
                                </button>
                            )}

                            <div className="flex items-start gap-2 text-[11px] text-gray-500 leading-relaxed bg-blue-500/5 p-3 rounded border border-blue-500/10">
                                <AlertCircle size={14} className="shrink-0 mt-0.5 text-blue-500" />
                                <span>중복 이름은 끝에 (1), (2) 로 자동 처리됩니다. 임포트 완료 후 데이터를 동기화합니다.</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <style jsx="true">{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #222;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #333;
                }
            `}</style>
        </div>
    );
};

export default ExcelBulkImportModal;

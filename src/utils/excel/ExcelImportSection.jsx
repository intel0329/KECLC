import React, { useState, useRef } from 'react';
import { FileUp, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { parseExcelToLoads } from './excelParser';
import { EXCEL_TEMPLATES } from './excelTemplates';

/**
 * 엑셀 임포트 제어 UI 컴포넌트
 */
const ExcelImportSection = ({ onImport }) => {
    const [file, setFile] = useState(null);
    const [workbook, setWorkbook] = useState(null);
    const [sheets, setSheets] = useState([]);
    const [selectedSheet, setSelectedSheet] = useState('');
    const [selectedTemplate, setSelectedTemplate] = useState('standard_keclc');
    const [isImporting, setIsImporting] = useState(false);
    const fileInputRef = useRef(null);

    // 파일 선택 핸들러
    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
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
                if (sheetNames.length > 0) setSelectedSheet(sheetNames[0]);
            } catch (err) {
                window.dispatchEvent(new CustomEvent('kelc_show_toast', {
                    detail: { message: '엑셀 파일을 읽는 중 오류가 발생했습니다.', type: 'error' }
                }));
                console.error(err);
            }
        };
        reader.readAsArrayBuffer(selectedFile);
    };

    // 임포트 실행
    const handleExecuteImport = () => {
        if (!workbook || !selectedSheet) return;

        if (confirm(`'${selectedSheet}' 시트의 데이터를 불러오시겠습니까?\n현재 입력된 데이터는 덮어씌워집니다.`)) {
            setIsImporting(true);
            
            // 파싱 실행
            const loads = parseExcelToLoads(workbook, selectedSheet, selectedTemplate);
            
            if (loads.length > 0) {
                onImport(loads);
                window.dispatchEvent(new CustomEvent('kelc_show_toast', {
                    detail: { message: `'${selectedSheet}' 시트 데이터를 성공적으로 가져왔습니다.`, type: 'success' }
                }));
                // 초기화
                setFile(null);
                setWorkbook(null);
                setSheets([]);
            } else {
                window.dispatchEvent(new CustomEvent('kelc_show_toast', {
                    detail: { message: '가져올 부하 데이터가 없습니다. 양식을 확인해주세요.', type: 'error' }
                }));
            }
            setIsImporting(false);
        }
    };

    return (
        <div className="mb-6 p-4 border border-gray-800 bg-gray-950/50 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
                <FileSpreadsheet size={16} className="text-green-500" />
                <span className="text-[11px] font-bold text-gray-300 uppercase tracking-widest">엑셀 가져오기</span>
            </div>

            {!file ? (
                <div 
                    onClick={() => fileInputRef.current.click()}
                    className="border-2 border-dashed border-gray-800 hover:border-green-500/50 hover:bg-green-500/5 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-all group"
                >
                    <FileUp size={24} className="text-gray-600 group-hover:text-green-500 transition-colors mb-2" />
                    <div className="text-[12px] text-gray-500 group-hover:text-gray-300">클릭하여 엑셀 파일 업로드</div>
                    <div className="text-[10px] text-gray-600 mt-1">.xlsx, .xls 지원</div>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileChange} 
                        accept=".xlsx, .xls"
                        className="hidden" 
                    />
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="flex items-center justify-between bg-gray-900 border border-gray-800 px-3 py-2 rounded">
                        <div className="flex items-center gap-2 overflow-hidden">
                            <CheckCircle2 size={14} className="text-green-500 shrink-0" />
                            <span className="text-[11px] text-white font-medium truncate">{file.name}</span>
                        </div>
                        <button 
                            onClick={() => { setFile(null); setWorkbook(null); }}
                            className="text-[10px] text-red-500 hover:text-red-400 font-bold"
                        >
                            변경
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-[10px] text-gray-500 font-bold uppercase">양식 선택</label>
                            <select 
                                value={selectedTemplate}
                                onChange={(e) => setSelectedTemplate(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-800 text-white text-[11px] px-2 py-1.5 outline-none focus:border-green-500"
                            >
                                {EXCEL_TEMPLATES.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] text-gray-500 font-bold uppercase">대상 시트 선택</label>
                            <select 
                                value={selectedSheet}
                                onChange={(e) => setSelectedSheet(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-800 text-white text-[11px] px-2 py-1.5 outline-none focus:border-green-500"
                            >
                                {sheets.map(name => (
                                    <option key={name} value={name}>{name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <button 
                        onClick={handleExecuteImport}
                        disabled={isImporting}
                        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-800 text-white font-bold text-[12px] py-2 rounded transition-all shadow-lg shadow-green-900/10 flex items-center justify-center gap-2"
                    >
                        {isImporting ? '처리 중...' : '데이터 가져오기'}
                    </button>
                    
                    <div className="flex items-start gap-1.5 text-[10px] text-gray-500 leading-relaxed">
                        <AlertCircle size={12} className="shrink-0 mt-0.5" />
                        <span>데이터가 정상적으로 매핑되지 않으면 다른 양식을 선택해 보세요.</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExcelImportSection;

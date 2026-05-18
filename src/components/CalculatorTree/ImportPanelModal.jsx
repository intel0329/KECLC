import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Check, ArrowRight, Loader, Folder, FileText, Database } from 'lucide-react';
import { getProjects, getProject, importPanelsFromProject } from '../../services/projectService';

/**
 * 다른 프로젝트에서 계산서 복사하기 (편입) 모달
 * 디자인: 다크 글래스모피즘, 네온 블루 테마 (각진 스타일)
 */
const ImportPanelModal = ({ isOpen, onClose, targetProjectId, calculatorId, onUpdate }) => {
    const [projects, setProjects] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loadingProjects, setLoadingProjects] = useState(false);
    
    const [selectedProject, setSelectedProject] = useState(null);
    const [loadingPanels, setLoadingPanels] = useState(false);
    const [panels, setPanels] = useState([]);
    
    const [selectedPanelIds, setSelectedPanelIds] = useState([]);
    const [lastSelectedId, setLastSelectedId] = useState(null); // [NEW] 다중 선택용 마지막 선택 ID
    const [isImporting, setIsImporting] = useState(false);
    const [progress, setProgress] = useState(0);

    const backdropRef = useRef(null);

    // 프로젝트 목록 로드
    useEffect(() => {
        if (isOpen) {
            loadProjects();
        } else {
            // 초기화
            setSearchQuery('');
            setSelectedProject(null);
            setPanels([]);
            setSelectedPanelIds([]);
            setLastSelectedId(null);
            setProgress(0);
            setIsImporting(false);
        }
    }, [isOpen]);

    const loadProjects = async () => {
        setLoadingProjects(true);
        try {
            const list = await getProjects();
            // 현재 프로젝트는 제외
            setProjects(list.filter(p => p.id !== targetProjectId));
        } catch (err) {
            console.error('Failed to load projects:', err);
        } finally {
            setLoadingProjects(false);
        }
    };

    const handleSelectProject = async (project) => {
        setSelectedProject(project);
        setLoadingPanels(true);
        setSelectedPanelIds([]);
        setLastSelectedId(null);
        try {
            const detail = await getProject(project.id);
            const calc = detail.calculators.find(c => c.id === calculatorId);
            setPanels(calc?.children || []);
        } catch (err) {
            console.error('Failed to load panels:', err);
        } finally {
            setLoadingPanels(false);
        }
    };

    // [수정] Shift/Ctrl 지원 다중 선택 로직
    const togglePanelSelection = (id, event) => {
        if (event.shiftKey && lastSelectedId) {
            const lastIdx = panels.findIndex(p => p.id === lastSelectedId);
            const currIdx = panels.findIndex(p => p.id === id);
            
            if (lastIdx !== -1 && currIdx !== -1) {
                const start = Math.min(lastIdx, currIdx);
                const end = Math.max(lastIdx, currIdx);
                const rangeIds = panels.slice(start, end + 1).map(p => p.id);
                
                setSelectedPanelIds(prev => {
                    const newSet = new Set([...prev, ...rangeIds]);
                    return Array.from(newSet);
                });
            }
        } else if (event.ctrlKey || event.metaKey) {
            setSelectedPanelIds(prev => 
                prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
            );
        } else {
            // 일반 클릭시에도 토글 유지 (사용자 편의)
            setSelectedPanelIds(prev => 
                prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
            );
        }
        setLastSelectedId(id);
    };

    const handleImport = async () => {
        if (selectedPanelIds.length === 0 || !selectedProject) return;
        
        setIsImporting(true);
        setProgress(0);

        try {
            const result = await importPanelsFromProject(
                targetProjectId, 
                selectedProject.id, 
                calculatorId, 
                selectedPanelIds,
                (p) => setProgress(p)
            );

            if (result) {
                window.dispatchEvent(new CustomEvent('kelc_show_toast', {
                    detail: { message: `${selectedPanelIds.length}개의 계산서가 성공적으로 편입되었습니다.`, type: 'success' }
                }));
                
                // [보완] 해제 기능: 가져오기가 끝나면 선택 목록 초기화
                setSelectedPanelIds([]);
                setLastSelectedId(null);
                
                onUpdate();
                onClose();
            }
        } catch (err) {
            console.error('Import failed:', err);
            window.dispatchEvent(new CustomEvent('kelc_show_toast', {
                detail: { message: '계산서 편입 중 오류가 발생했습니다.', type: 'error' }
            }));
        } finally {
            setIsImporting(false);
        }
    };

    if (!isOpen) return null;

    const filteredProjects = projects.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.client?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div 
            ref={backdropRef}
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300"
            onClick={(e) => e.target === backdropRef.current && !isImporting && onClose()}
        >
            <div className="relative w-full max-w-2xl bg-gray-950/90 border border-blue-500/30 rounded-none shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col h-[700px]">
                {/* Neon Top Bar */}
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-blue-500 to-transparent shadow-[0_0_10px_#3b82f6]"></div>
                
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-white/5 bg-white/5 backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/20 rounded-none border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                            <Database size={18} className="text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-white font-bold text-base tracking-tight">다른 프로젝트에서 계산서 가져오기</h3>
                            <p className="text-blue-400/60 text-[11px] font-medium uppercase tracking-widest mt-0.5">Import Panels from Source Project</p>
                        </div>
                    </div>
                    {!isImporting && (
                        <button 
                            onClick={onClose}
                            className="p-2 hover:bg-white/10 rounded-none transition-colors text-gray-400 hover:text-white"
                        >
                            <X size={20} />
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden flex">
                    {/* Project List Column */}
                    <div className="w-1/2 border-r border-white/5 flex flex-col bg-black/20 min-w-0">
                        <div className="p-4 border-b border-white/5">
                            <div className="relative group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-400 transition-colors" size={14} />
                                <input 
                                    type="text"
                                    placeholder="프로젝트 검색..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 focus:border-blue-500/50 rounded-none pl-9 pr-4 py-2 text-sm text-white placeholder:text-gray-600 outline-none transition-all focus:shadow-[0_0_10px_rgba(59,130,246,0.1)]"
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin scrollbar-thumb-gray-800">
                            {loadingProjects ? (
                                <div className="flex flex-col items-center justify-center py-12 gap-3">
                                    <Loader size={20} className="text-blue-500 animate-spin" />
                                    <span className="text-gray-500 text-xs">프로젝트 로드 중...</span>
                                </div>
                            ) : filteredProjects.length === 0 ? (
                                <div className="py-12 text-center text-gray-600 text-xs italic">검색 결과가 없습니다.</div>
                            ) : (
                                filteredProjects.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => handleSelectProject(p)}
                                        className={`w-full text-left p-3 rounded-none transition-all border ${selectedProject?.id === p.id 
                                            ? 'bg-blue-600/20 border-blue-500/50 shadow-[inset_0_0_15px_rgba(59,130,246,0.1)]' 
                                            : 'border-transparent hover:bg-white/5 hover:border-white/10'}`}
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className={`p-2 rounded-none shrink-0 ${selectedProject?.id === p.id ? 'bg-blue-500 text-white' : 'bg-gray-800 text-gray-400'}`}>
                                                <Folder size={14} />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className={`text-xs font-bold truncate ${selectedProject?.id === p.id ? 'text-blue-400' : 'text-gray-300'}`}>{p.name}</div>
                                                <div className="text-[10px] text-gray-500 truncate mt-0.5">{p.client || 'Client N/A'}</div>
                                            </div>
                                            {selectedProject?.id === p.id && <ArrowRight size={14} className="text-blue-500 shrink-0" />}
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Panel List Column */}
                    <div className="w-1/2 flex flex-col bg-black/10 min-w-0">
                        <div className="p-4 border-b border-white/5 flex items-center justify-between">
                            <span className="text-[12px] font-bold text-gray-400 uppercase tracking-widest">계산서 목록</span>
                            {selectedPanelIds.length > 0 && (
                                <span className="text-[12px] text-blue-400 font-bold">{selectedPanelIds.length} 선택됨</span>
                            )}
                        </div>
                        {/* [수정] 높이 고정 및 리스트 제한 (12개 기준 약 530px) */}
                        <div className="flex-1 h-[530px] overflow-y-auto p-2 space-y-1 scrollbar-thin scrollbar-thumb-gray-800">
                            {!selectedProject ? (
                                <div className="flex flex-col items-center justify-center h-full text-gray-600 gap-4 opacity-50">
                                    <div className="w-12 h-12 rounded-none border-2 border-dashed border-gray-700 flex items-center justify-center">
                                        <ArrowRight className="rotate-180" size={20} />
                                    </div>
                                    <span className="text-xs text-center px-4">왼쪽에서 프로젝트를 먼저 선택하세요.</span>
                                </div>
                            ) : loadingPanels ? (
                                <div className="flex flex-col items-center justify-center py-12 gap-3">
                                    <Loader size={20} className="text-blue-500 animate-spin" />
                                    <span className="text-gray-500 text-xs">계산서 로드 중...</span>
                                </div>
                            ) : panels.length === 0 ? (
                                <div className="py-12 text-center text-gray-600 text-xs italic">이 프로젝트에는 대상 계산서가 없습니다.</div>
                            ) : (
                                panels.map(panel => (
                                    <button
                                        key={panel.id}
                                        onClick={(e) => togglePanelSelection(panel.id, e)}
                                        className={`w-full text-left p-2.5 rounded-none transition-all border flex items-center gap-3 ${selectedPanelIds.includes(panel.id)
                                            ? 'bg-blue-600/10 border-blue-500/40'
                                            : 'bg-transparent border-transparent hover:bg-white/5 hover:border-white/10'}`}
                                    >
                                        <div className={`w-3.5 h-3.5 rounded-none flex items-center justify-center border transition-all shrink-0 ${selectedPanelIds.includes(panel.id)
                                            ? 'bg-blue-500 border-blue-400 text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]'
                                            : 'border-white/10 text-transparent'}`}>
                                            <Check size={9} />
                                        </div>
                                        <div className="p-1.5 bg-gray-800/50 rounded-none shrink-0">
                                            <FileText size={14} className="text-blue-400" />
                                        </div>
                                        <span className={`text-xs font-medium truncate ${selectedPanelIds.includes(panel.id) ? 'text-white' : 'text-gray-400'}`}>
                                            {panel.name}
                                        </span>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer / Progress */}
                <div className="p-5 border-t border-white/5 bg-white/5 backdrop-blur-md">
                    {isImporting ? (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between text-xs mb-1">
                                <span className="text-blue-400 font-bold animate-pulse">복제 중...</span>
                                <span className="text-white font-mono">{progress}%</span>
                            </div>
                            <div className="h-2 w-full bg-white/5 rounded-none overflow-hidden border border-white/5 p-[1px]">
                                <div 
                                    className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-none transition-all duration-300 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                                    style={{ width: `${progress}%` }}
                                ></div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between">
                            <div className="text-[10px] text-gray-500 max-w-[60%] leading-relaxed">
                                * 편입된 계산서는 기존의 계통(Source) 정보가 삭제되며, <br />
                                내부의 'PL' 부하 항목은 모두 '예비'로 변경됩니다.
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={onClose}
                                    className="px-5 py-2.5 text-xs font-bold text-gray-400 hover:text-white border border-white/10 hover:bg-white/5 rounded-none transition-all"
                                >
                                    취소
                                </button>
                                <button
                                    disabled={selectedPanelIds.length === 0}
                                    onClick={handleImport}
                                    className={`px-6 py-2.5 text-xs font-bold text-white rounded-none transition-all flex items-center gap-2 ${selectedPanelIds.length > 0 
                                        ? 'bg-blue-600 hover:bg-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)] active:scale-95' 
                                        : 'bg-gray-800 text-gray-600 cursor-not-allowed'}`}
                                >
                                    편입하기
                                    <ArrowRight size={14} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ImportPanelModal;

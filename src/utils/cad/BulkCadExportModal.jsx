import React, { useState, useEffect, useRef } from 'react';
import { X, Download, Zap, Loader2, FileCode, CheckCircle2, AlertCircle } from 'lucide-react';

const CornerBorders = () => (
    <>
        <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-blue-500/50 z-10" />
        <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-blue-500/50 z-10" />
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-blue-500/50 z-10" />
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-blue-500/50 z-10" />
    </>
);

const BulkCadExportModal = ({ isOpen, onClose, project }) => {
    const [status, setStatus] = useState('idle'); // idle, exporting, completed, error
    const [progress, setProgress] = useState(0);
    const [currentTask, setCurrentTask] = useState('');
    const [logs, setLogs] = useState([]);
    const [downloadUrl, setDownloadUrl] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');
    const logContainerRef = useRef(null);
    const eventSourceRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            setStatus('idle');
            setProgress(0);
            setCurrentTask('');
            setLogs([]);
            setDownloadUrl(null);
            setErrorMsg('');
        }
        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }
        };
    }, [isOpen]);

    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [logs]);

    if (!isOpen) return null;

    const addLog = (message, type = 'info') => {
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
        setLogs(prev => [...prev, { id: Date.now() + Math.random(), time, message, type }]);
    };

    const handleStartExport = () => {
        setStatus('exporting');
        setProgress(0);
        setLogs([]);
        addLog('서버에 연결 중...', 'info');

        const url = `/api/bulk_cad_export.php?projectId=${project.id}&projectName=${encodeURIComponent(project.name)}`;
        const eventSource = new EventSource(url);
        eventSourceRef.current = eventSource;

        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            if (data.message) {
                addLog(data.message, data.type);
                setCurrentTask(data.message);
            }
            
            if (data.progress !== null) {
                setProgress(Math.round(data.progress));
            }

            if (data.type === 'error') {
                setStatus('error');
                setErrorMsg(data.message);
                eventSource.close();
            }

            if (data.data && data.data.download_url) {
                setDownloadUrl(data.data.download_url);
                setStatus('completed');
                setProgress(100);
                addLog('모든 작업이 성공적으로 완료되었습니다!', 'success');
                eventSource.close();
            }
        };

        eventSource.onerror = (err) => {
            console.error('SSE Error:', err);
            setStatus('error');
            setErrorMsg('서버와의 연결이 중단되었습니다. (네트워크 오류 또는 타임아웃)');
            addLog('서버 연결 오류가 발생했습니다.', 'error');
            eventSource.close();
        };
    };

    const handleDownload = () => {
        if (!downloadUrl) return;
        window.location.href = downloadUrl;
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="relative bg-[#0a0a0c] border border-blue-500/30 w-full max-w-xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden">
                <CornerBorders />
                
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-white/5 bg-gradient-to-r from-blue-900/10 to-transparent">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                            <Zap size={24} className="text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-white tracking-tighter uppercase">Panel Board CAD Export</h2>
                            <p className="text-[10px] text-blue-400/70 font-bold uppercase tracking-[0.2em]">전체 분전반 결선도 통합 추출 (SSE)</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-white/5 rounded-full transition-colors text-gray-500 hover:text-white"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-8">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[12px] font-bold text-gray-500 uppercase tracking-widest">{currentTask || '작업 요청 대기 중...'}</span>
                        <span className="text-xl font-black text-blue-400 tracking-tighter">{progress}%</span>
                    </div>
                    
                    <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden mb-8">
                        <div 
                            className="h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>

                    {/* Logs */}
                    <div 
                        ref={logContainerRef}
                        className="bg-black/40 border border-white/5 rounded p-4 h-48 overflow-y-auto font-mono text-[11px] space-y-1 custom-scrollbar"
                    >
                        {logs.length === 0 ? (
                            <div className="text-gray-600 italic">서버 연결 대기 중...</div>
                        ) : (
                            logs.map((log) => (
                                <div key={log.id} className="flex gap-2">
                                    <span className="text-gray-600 whitespace-nowrap">[{log.time}]</span>
                                    <span className={
                                        log.type === 'error' ? 'text-red-400' : 
                                        log.type === 'success' ? 'text-emerald-400' : 
                                        'text-blue-300/70'
                                    }>
                                        {log.type === 'success' ? '●' : log.type === 'error' ? '●' : '○'} {log.message}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-5 bg-white/5 border-t border-white/5 flex gap-3">
                    {status === 'idle' && (
                        <button
                            onClick={handleStartExport}
                            className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 rounded border border-blue-400/50 shadow-lg shadow-blue-900/20"
                        >
                            프로젝트 분전반 결선도 통합 시작
                        </button>
                    )}
                    
                    {status === 'exporting' && (
                        <div className="flex-1 py-3 bg-gray-800 text-gray-400 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-3 rounded border border-white/5">
                            <Loader2 size={16} className="animate-spin text-blue-400" />
                            실시간 도면 생성 및 통합 중...
                        </div>
                    )}

                    {status === 'completed' && (
                        <>
                            <button
                                onClick={handleDownload}
                                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 rounded border border-emerald-400/50 shadow-lg shadow-emerald-900/20"
                            >
                                <Download size={18} />
                                통합 도면 다운로드 (DXF)
                            </button>
                            <button
                                onClick={onClose}
                                className="px-6 py-3 border border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800 text-xs font-bold uppercase tracking-widest transition-all rounded"
                            >
                                닫기
                            </button>
                        </>
                    )}

                    {status === 'error' && (
                        <button
                            onClick={handleStartExport}
                            className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 rounded border border-red-400/50 shadow-lg shadow-red-900/20"
                        >
                            다시 시도 (RETRY)
                        </button>
                    )}
                </div>
            </div>
            
            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.2);
                }
            `}</style>
        </div>
    );
};

export default BulkCadExportModal;

import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { 
    getIntegrityLogs, 
    clearIntegrityLogs, 
    formatLogsToText, 
    logIntegrityEvent,
    deleteIntegrityLog,
    clearIntegrityLogsForPanel
} from '../../utils/integrityLogger';

const RADAR_STORAGE_KEY = 'kelc_radar_packets';
const MAX_RADAR_LOGS = 10;

/** localStorage에서 Radar 패킷 로그를 읽어옵니다 */
const getRadarLogs = () => {
    try {
        const raw = localStorage.getItem(RADAR_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
};

/** Radar 패킷 로그를 localStorage에 저장합니다 */
const saveRadarLogs = (logs) => {
    try {
        localStorage.setItem(RADAR_STORAGE_KEY, JSON.stringify(logs));
    } catch (e) { }
};

const BroadcastRadar = () => {
    const [devMode, setDevMode] = useState(false);
    // 새로고침 내성: 초기값을 localStorage에서 복원
    const [logs, setLogs] = useState(() => getRadarLogs());
    const [activeTab, setActiveTab] = useState('radar'); // 'radar' | 'integrity'
    const [integrityLogs, setIntegrityLogs] = useState([]);
    const [showConfirm, setShowConfirm] = useState(false);
    const [showRadarConfirm, setShowRadarConfirm] = useState(false);
    
    const location = useLocation();
    
    // 현재 경로(/project/:projectId/:type/:panelId)에서 panelId 추출
    const getActivePanelId = () => {
        const parts = location.pathname.split('/');
        if (parts.length >= 5 && parts[1] === 'project') {
            return parts[4]; // panelId
        }
        return null;
    };
    const activePanelId = getActivePanelId();
    
    const [confirmType, setConfirmType] = useState('clear'); // 'clear' | 'all'
    
    // 렌더링용 React 상태 (Zustand와 충돌 없는 순수 드로잉 데이터)
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [height, setHeight] = useState(300); // 기본 높이를 탭 추가에 따라 300px로 상향 조정
    
    const logsEndRef = useRef(null);
    const integrityEndRef = useRef(null);
    
    // 리액트 라이프사이클 클로저를 극복하기 위한 고속 좌표 동기화 Refs
    const positionRef = useRef({ x: 0, y: 0 });
    const heightRef = useRef(300);
    const dragStartRef = useRef(null);
    const resizeStartRef = useRef(null);

    // 드래그 시작 포인터 핸들러
    const handleDragStart = (e) => {
        if (e.button !== 0) return; // 왼쪽 마우스 클릭/터치만 허용
        
        // 브라우저 기본 드래그 및 텍스트 선택 동작 강제 중단
        e.preventDefault();
        
        // 포인터 캡처 활성화
        e.currentTarget.setPointerCapture(e.pointerId);
        
        dragStartRef.current = {
            pointerId: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
            posX: positionRef.current.x,
            posY: positionRef.current.y
        };
    };

    // 상단 가장자리 잡아당겨 높이 조절 포인터 핸들러
    const handleResizeStart = (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        
        e.currentTarget.setPointerCapture(e.pointerId);
        
        resizeStartRef.current = {
            pointerId: e.pointerId,
            startY: e.clientY,
            startHeight: heightRef.current
        };
    };

    // 파일 내보내기 핸들러 (UTF-8 BOM을 통한 엑셀/메모장 한글 깨짐 완벽 방지)
    const handleExportLogs = () => {
        try {
            const textContent = formatLogsToText();
            const blob = new Blob(['\uFEFF' + textContent], { type: 'text/plain;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = url;
            
            const now = new Date();
            const yyyymmdd = now.toISOString().slice(0, 10).replace(/-/g, '');
            const hhmmss = now.toTimeString().slice(0, 8).replace(/:/g, '');
            link.setAttribute('download', `kelc_integrity_log_${yyyymmdd}_${hhmmss}.txt`);
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            logIntegrityEvent('INFO', 'EXPORT', '무결성 로그 파일 다운로드가 정상적으로 수령되었습니다.');
        } catch (e) {
            console.error('Failed to export integrity logs:', e);
        }
    };

    // 'CLEAR' 버튼 핸들러 (현재 계산서 탭 전용)
    const handleClearLogsForPanel = () => {
        if (!activePanelId) {
            alert('현재 활성화된 계산서 탭을 찾을 수 없습니다.');
            return;
        }
        setConfirmType('clear');
        setShowConfirm(true);
    };

    // 'ALL' 버튼 핸들러 (전체 무결성 로그 리셋)
    const handleClearAllLogs = () => {
        setConfirmType('all');
        setShowConfirm(true);
    };

    useEffect(() => {
        const checkDevMode = () => {
            setDevMode(localStorage.getItem('KECLC_DEV_MODE') === 'true');
        };

        // 초기화 시점 검사
        checkDevMode();
        setIntegrityLogs(getIntegrityLogs());

        const handleToggle = () => {
            checkDevMode();
        };

        const handleLog = (e) => {
            const { type, action, panelId, senderId } = e.detail;
            const newLog = {
                id: Date.now() + Math.random(),
                time: new Date().toLocaleTimeString(),
                type,        // 'TX', 'RX', 'WARN'
                action,      // 예: 'UPDATE_PANEL', 'UPDATE_RESULTS'
                panelId: panelId || '-',
                senderId: senderId || '-'
            };

            setLogs((prev) => {
                const updated = [...prev, newLog];
                // FIFO 버퍼 유지
                const trimmed = updated.length > MAX_RADAR_LOGS ? updated.slice(updated.length - MAX_RADAR_LOGS) : updated;
                // [새로고침 내성] localStorage에 즉시 영구 저장
                saveRadarLogs(trimmed);
                return trimmed;
            });
        };

        const handleIntegrityChanged = () => {
            setIntegrityLogs(getIntegrityLogs());
        };

        // 전역 포인터 이동 통합 처리 핸들러 (Stale Closure 방지형 Ref 참조)
        const handlePointerMove = (e) => {
            if (dragStartRef.current) {
                const dx = e.clientX - dragStartRef.current.startX;
                const dy = e.clientY - dragStartRef.current.startY;
                const newX = dragStartRef.current.posX + dx;
                const newY = dragStartRef.current.posY + dy;
                
                positionRef.current = { x: newX, y: newY };
                setPosition({ x: newX, y: newY });
            } else if (resizeStartRef.current) {
                const dy = resizeStartRef.current.startY - e.clientY; // 위로 올릴수록 높이 증가
                const newHeight = Math.max(200, Math.min(750, resizeStartRef.current.startHeight + dy));
                
                heightRef.current = newHeight;
                setHeight(newHeight);
            }
        };

        // 전역 포인터 업 해제 통합 핸들러
        const handlePointerUp = (e) => {
            if (dragStartRef.current) {
                try {
                    e.target.releasePointerCapture(dragStartRef.current.pointerId);
                } catch (err) {}
                dragStartRef.current = null;
            }
            if (resizeStartRef.current) {
                try {
                    e.target.releasePointerCapture(resizeStartRef.current.pointerId);
                } catch (err) {}
                resizeStartRef.current = null;
            }
        };

        const handleStorageChange = (e) => {
            if (e.key === 'KECLC_DEV_MODE') {
                checkDevMode();
            }
            if (e.key === 'kelc_integrity_logs') {
                setIntegrityLogs(getIntegrityLogs());
            }
        };

        window.addEventListener('kelc_dev_mode_toggled', handleToggle);
        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('kelc_dev_radar_log', handleLog);
        window.addEventListener('kelc_integrity_logs_changed', handleIntegrityChanged);
        
        document.addEventListener('pointermove', handlePointerMove);
        document.addEventListener('pointerup', handlePointerUp);

        return () => {
            window.removeEventListener('kelc_dev_mode_toggled', handleToggle);
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('kelc_dev_radar_log', handleLog);
            window.removeEventListener('kelc_integrity_logs_changed', handleIntegrityChanged);
            
            document.removeEventListener('pointermove', handlePointerMove);
            document.removeEventListener('pointerup', handlePointerUp);
        };
    }, []);

    // 새 로그 수신 시 스무스한 아래로 스크롤링 적용
    useEffect(() => {
        if (activeTab === 'radar' && logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, activeTab]);

    useEffect(() => {
        if (activeTab === 'integrity' && integrityEndRef.current) {
            integrityEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [integrityLogs, activeTab]);

    if (!devMode) return null;

    return (
        <div 
            className="fixed bottom-6 right-6 z-[9999] w-85 backdrop-blur-md bg-black/85 border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.7)] rounded-xl p-4 flex flex-col pointer-events-auto select-none font-sans text-[12px] text-white transition-shadow duration-300"
            style={{ 
                transform: `translate(${position.x}px, ${position.y}px)`,
                height: `${height}px`,
                width: '355px'
            }}
        >
            {/* 상단 테두리 높이 조절 핸들러 레이어 */}
            <div 
                onPointerDown={handleResizeStart}
                className="absolute top-0 left-0 right-0 h-1.5 cursor-ns-resize z-[10010] border-t border-transparent hover:border-cyan-500/50 transition-colors"
                title="마우스로 상단 테두리를 끌어 올려 높이를 조절하세요"
            />

            {/* 헤더 섹션 (최우선 드래그 핸들) */}
            <div 
                onPointerDown={handleDragStart}
                className="flex items-center justify-between border-b border-white/10 pb-2 mb-2 cursor-grab active:cursor-grabbing select-none z-[10005]"
                title="마우스로 끌어서 이동하세요"
            >
                <div className="flex items-center gap-1.5 pointer-events-none">
                    <span className="relative flex h-2 w-2">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${activeTab === 'radar' ? 'bg-cyan-400' : 'bg-emerald-400'}`}></span>
                        <span className={`relative inline-flex rounded-full h-2 w-2 ${activeTab === 'radar' ? 'bg-cyan-500' : 'bg-emerald-500'}`}></span>
                    </span>
                    <span className="font-bold tracking-widest text-gray-200">
                        {activeTab === 'radar' ? 'BROADCAST RADAR' : 'INTEGRITY CHECKER'}
                    </span>
                </div>
                <span className="text-[9px] text-gray-500 pointer-events-none">v1.1 (DEV)</span>
            </div>

            {/* 탭 스위치 영역 */}
            <div className="flex border-b border-white/10 mb-3 text-[11px] font-bold select-none shrink-0">
                <button
                    onClick={() => setActiveTab('radar')}
                    className={`flex-1 pb-1.5 text-center transition-colors cursor-pointer ${activeTab === 'radar' ? 'text-cyan-400 border-b-2 border-cyan-400 font-bold' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    RADAR PACKETS
                </button>
                <button
                    onClick={() => setActiveTab('integrity')}
                    className={`flex-1 pb-1.5 text-center transition-colors cursor-pointer ${activeTab === 'integrity' ? 'text-emerald-400 border-b-2 border-emerald-400 font-bold' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    INTEGRITY LOGS ({integrityLogs.length})
                </button>
            </div>
            
            {/* 액티브 탭 뷰 렌더러 */}
            {activeTab === 'radar' ? (
                /* ── RADAR PACKETS 탭 ── */
                <div className="flex flex-col flex-grow overflow-hidden">
                    {/* RADAR Clear 버튼 */}
                    <div className="flex justify-end mb-2 shrink-0">
                        <button
                            onClick={() => setShowRadarConfirm(true)}
                            className="py-1 px-2.5 rounded-md bg-sky-950/60 hover:bg-sky-900 border border-sky-500/20 active:bg-sky-950 text-sky-400 hover:text-sky-300 transition-all duration-150 cursor-pointer text-[10px]"
                            title="RADAR 패킷 로그 전체 초기화"
                        >
                            Clear Packets
                        </button>
                    </div>
                    <div className="flex-grow overflow-y-auto space-y-1.5 pr-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent select-text">
                        {logs.length === 0 ? (
                            <div className="text-gray-500 text-center py-4 italic select-none">No packets captured yet.</div>
                        ) : (
                            logs.map((log) => {
                                const isTX = log.type === 'TX';
                                const isWARN = log.type === 'WARN';
                                
                                let colorClass = 'text-fuchsia-400';
                                if (isTX) colorClass = 'text-sky-400';
                                if (isWARN) colorClass = 'text-yellow-500';

                                return (
                                    <div key={log.id} className="border-b border-white/5 pb-1 flex flex-col gap-0.5 select-text">
                                        <div className="flex items-center justify-between select-none">
                                            <span className={`font-bold ${colorClass}`}>
                                                [{log.type}] {log.action}
                                            </span>
                                            <span className="text-[10px] text-gray-500">{log.time}</span>
                                        </div>
                                        <div className="text-[10px] text-gray-400 flex items-center justify-between pl-2 font-mono">
                                            <span className="truncate max-w-[170px]">
                                                Panel: {typeof log.panelId === 'string' ? log.panelId.slice(-6) : String(log.panelId || '-')}
                                            </span>
                                            <span>Sid: {log.senderId}</span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                        <div ref={logsEndRef} />
                    </div>
                </div>
            ) : (
                /* ── INTEGRITY LOGS 탭 ── */
                <div className="flex flex-col flex-grow overflow-hidden">
                    {/* 상단 로컬 디스크 내보내기 및 클리어 제어바 */}
                    <div className="flex gap-1.5 mb-2.5 select-none shrink-0">
                        <button
                            onClick={handleExportLogs}
                            className="flex-grow py-1.5 px-2 rounded-md bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold transition-all duration-150 cursor-pointer text-center text-[10px] shadow-sm hover:shadow-md"
                        >
                            📥 EXPORT LOGS
                        </button>
                        <button
                            onClick={handleClearLogsForPanel}
                            className={`py-1.5 px-2.5 rounded-md bg-red-950/60 hover:bg-red-900 border border-red-500/20 active:bg-red-950 text-red-400 hover:text-red-300 transition-all duration-150 cursor-pointer text-[10px] ${!activePanelId ? 'opacity-50 cursor-not-allowed' : ''}`}
                            title="현재 계산서 탭 전용 로그 삭제"
                            disabled={!activePanelId}
                        >
                            CLEAR
                        </button>
                        <button
                            onClick={handleClearAllLogs}
                            className="py-1.5 px-2.5 rounded-md bg-red-800 hover:bg-red-700 active:bg-red-900 text-white font-bold transition-all duration-150 cursor-pointer text-[10px] shadow-sm hover:shadow-md"
                            title="모든 무결성 로그 전체 삭제"
                        >
                            ALL
                        </button>
                    </div>

                    {/* 무결성 로그 리스트 */}
                    <div className="flex-grow overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent select-text">
                        {integrityLogs.length === 0 ? (
                            <div className="text-gray-500 text-center py-6 italic select-none">무결성 상태가 완벽히 건강합니다.<br/>(감지된 단선 오류 없음)</div>
                        ) : (
                            integrityLogs.map((log) => {
                                const isErr = log.level === 'ERR_INTEGRITY';
                                const isWarn = log.level === 'WARN';
                                
                                let labelColor = 'text-gray-400';
                                let borderClass = 'border-l-2 border-emerald-500/50';
                                if (isErr) {
                                    labelColor = 'text-red-400 font-bold';
                                    borderClass = 'border-l-2 border-red-500 bg-red-950/10';
                                } else if (isWarn) {
                                    labelColor = 'text-yellow-400 font-bold';
                                    borderClass = 'border-l-2 border-yellow-500 bg-yellow-950/10';
                                }

                                return (
                                    <div key={log.id} className={`pl-2.5 pb-1.5 border-b border-white/5 flex flex-col gap-1 relative ${borderClass}`}>
                                        <div className="flex items-center justify-between select-none pr-6">
                                            <span className={`${labelColor}`}>
                                                [{log.level}] {log.action}
                                            </span>
                                            <span className="text-[10px] text-gray-500">{log.timeString}</span>
                                        </div>
                                        {/* 개별 삭제 버튼 */}
                                        <button
                                            onClick={() => deleteIntegrityLog(log.id)}
                                            className="absolute top-1.5 right-2 text-gray-500 hover:text-red-400 active:text-red-600 transition-colors p-0.5 cursor-pointer text-[12px] font-bold"
                                            title="이 로그 항목만 지우기"
                                        >
                                            ✕
                                        </button>
                                        <div className="text-[11.5px] text-gray-300 leading-normal pl-1.5 select-text">
                                            {log.message}
                                        </div>
                                        {log.detail && (
                                            <div className="text-[9.5px] text-gray-500 bg-white/5 p-1 rounded-sm overflow-x-auto whitespace-pre pl-2 leading-relaxed font-mono">
                                                {Object.keys(log.detail).map(k => `${k}: ${log.detail[k]}`).join('\n')}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                        <div ref={integrityEndRef} />
                    </div>
                </div>
            )}

            {/* [Integrity] 다크 글래스모피즘 커스텀 Confirm 모달 레이어 */}
            {showConfirm && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 backdrop-blur-md rounded-xl p-6 z-[10020] border border-white/10 select-none transition-all duration-300">
                    <div className={`flex items-center gap-2 mb-3 ${confirmType === 'clear' ? 'text-yellow-500' : 'text-red-400'} font-bold text-[12px]`}>
                        <span className="relative flex h-2.5 w-2.5">
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${confirmType === 'clear' ? 'bg-yellow-500' : 'bg-red-400'} opacity-75`}></span>
                            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${confirmType === 'clear' ? 'bg-yellow-600' : 'bg-red-500'}`}></span>
                        </span>
                        <span>{confirmType === 'clear' ? 'WARNING: CLEAR TAB LOGS' : 'WARNING: CLEAR ALL LOGS'}</span>
                    </div>
                    <p className="text-gray-300 text-[12px] leading-relaxed text-center mb-5 font-medium px-2">
                        {confirmType === 'clear' ? (
                            <>
                                현재 활성화된 계산서 탭 관련<br />
                                무결성 로그만 삭제하시겠습니까?
                            </>
                        ) : (
                            <>
                                모든 지속성 무결성 로그를<br />
                                영구적으로 완전 삭제하시겠습니까?
                            </>
                        )}
                    </p>
                    <div className="flex gap-2.5 w-full max-w-[200px]">
                        <button
                            onClick={() => setShowConfirm(false)}
                            className="flex-1 py-1.5 rounded bg-white/5 border border-white/10 hover:bg-white/10 active:bg-white/5 text-gray-300 font-bold transition-all duration-150 cursor-pointer text-center text-[10px]"
                        >
                            취소
                        </button>
                        <button
                            onClick={() => {
                                if (confirmType === 'clear') {
                                    clearIntegrityLogsForPanel(activePanelId);
                                } else {
                                    clearIntegrityLogs();
                                }
                                setShowConfirm(false);
                            }}
                            className={`flex-1 py-1.5 rounded ${confirmType === 'clear' ? 'bg-yellow-700 hover:bg-yellow-600 active:bg-yellow-800 shadow-yellow-950/50' : 'bg-red-700 hover:bg-red-600 active:bg-red-800 shadow-red-950/50'} text-white font-bold transition-all duration-150 cursor-pointer text-center text-[10px] shadow-md`}
                        >
                            삭제 확정
                        </button>
                    </div>
                </div>
            )}

            {/* [Radar] RADAR 패킷 Clear Confirm 모달 레이어 */}
            {showRadarConfirm && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 backdrop-blur-md rounded-xl p-6 z-[10020] border border-white/10 select-none transition-all duration-300">
                    <div className="flex items-center gap-2 mb-3 text-sky-400 font-bold text-[12px]">
                        <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-sky-500"></span>
                        </span>
                        <span>CLEAR RADAR PACKETS</span>
                    </div>
                    <p className="text-gray-300 text-[12px] leading-relaxed text-center mb-5 font-medium px-2">
                        저장된 RADAR 패킷 로그를<br />
                        모두 지우시겠습니까?
                    </p>
                    <div className="flex gap-2.5 w-full max-w-[200px]">
                        <button
                            onClick={() => setShowRadarConfirm(false)}
                            className="flex-1 py-1.5 rounded bg-white/5 border border-white/10 hover:bg-white/10 active:bg-white/5 text-gray-300 font-bold transition-all duration-150 cursor-pointer text-center text-[10px]"
                        >
                            취소
                        </button>
                        <button
                            onClick={() => {
                                localStorage.removeItem(RADAR_STORAGE_KEY);
                                setLogs([]);
                                setShowRadarConfirm(false);
                            }}
                            className="flex-1 py-1.5 rounded bg-sky-700 hover:bg-sky-600 active:bg-sky-800 text-white font-bold transition-all duration-150 cursor-pointer text-center text-[10px] shadow-md shadow-sky-950/50"
                        >
                            삭제 확정
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BroadcastRadar;

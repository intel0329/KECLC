import React, { memo, useState, useRef, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Zap, ZapOff, Server, Activity, MoreHorizontal, Battery, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const PanelNodeCard = ({ data, isConnectable }) => {
    const isSource = data.id === 'SOURCE';
    const isHV = data.id === 'HV';
    const isTransformer = data.isTransformer || data.id.startsWith('transformer-main-');
    const isGenerator = data.id === 'GENERATOR' || data.type === 'generator';
    
    const navigate = useNavigate();
    
    // 툴팁 및 메뉴 상태 관리
    const [showTooltip, setShowTooltip] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const tooltipRef = useRef(null);
    const menuRef = useRef(null);

    // 외부 클릭 시 툴팁 및 메뉴 닫기 로직
    useEffect(() => {
        if (!showTooltip && !showMenu) return;
    
        const handleClickOutside = (event) => {
            if (tooltipRef.current && !tooltipRef.current.contains(event.target)) {
                setShowTooltip(false);
            }
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setShowMenu(false);
            }
        };

        // 캡처링(true) 단계를 사용하여 React Flow 내부 이벤트보다 우선 처리
        document.addEventListener('click', handleClickOutside, true);
        return () => {
            document.removeEventListener('click', handleClickOutside, true);
        };
    }, [showTooltip, showMenu]);

    let icon = <Activity size={12} className="text-white" />; // 기본값을 Server에서 Activity로 변경 (일반부하용)
    let bgClass = 'bg-sky-500';

    if (isSource) {
        icon = <Activity size={12} className="text-white" />;
        bgClass = 'bg-amber-500';
    } else if (isHV || isTransformer) {
        icon = <Zap size={12} className="text-white" />;
        bgClass = 'bg-amber-400';
    } else if (data.type === 'power-load') {
        icon = <Activity size={12} className="text-white" />;
        bgClass = 'bg-indigo-500';
    } else if (isGenerator) {
        icon = <ZapOff size={12} className="text-white" />; // Battery -> ZapOff로 변경
        bgClass = 'bg-rose-500';
    }

    // 게이지 퍼센트 계산
    const usagePercent = (Number(data.capacity) > 0 ? Math.min(100, (Number(data.calculatedTotalLoad || 0) / Number(data.capacity)) * 100) : 0);
    
    const gaugePercent = isGenerator ? usagePercent : (
        isSource ? 100 : (
            data.isDemandMode 
            ? ((isHV || isTransformer) ? Math.min(100, Number(data.aggregatedDemandFactor || 0)) : Math.min(100, Number(data.demandFactor || 0)))
            : (isHV 
                ? usagePercent
                : (isTransformer 
                    ? (Number(data.trCapacity) > 0 ? Math.min(100, (Number(data.calculatedTotalLoad || 0) / Number(data.trCapacity)) * 100) : 0)
                    : (data.atValue > 0 
                        ? Math.min(100, (Number(data.totalIb || 0) / Number(data.atValue)) * 100) 
                        : 0)))
        )
    );

    // 툴팁 라벨 결정
    const tooltipLabel = isGenerator ? '사용률' : (data.isDemandMode ? '수용률' : ((isTransformer || isHV) ? '사용률' : '한도율'));

    // 이동 로직 (라우팅)
    const handleNavigation = () => {
        if (isSource) return;

        const projectId = data.projectId;
        const panelId = data.panelId;

        if (!projectId || !panelId) {
            console.error('Missing projectId or panelId for navigation:', data);
            return;
        }

        let path = '';
        if (isHV || isTransformer) {
            // HV와 Transformer는 동일한 /transformer 경로를 사용 (App.jsx에서 분기)
            path = `/project/${projectId}/transformer/${panelId}`;
        } else if (isGenerator) {
            path = `/project/${projectId}/generator/${panelId}`;
        } else if (data.type === 'power-load') {
            path = `/project/${projectId}/power-load/${panelId}`;
        } else if (data.type === 'panel-load') {
            path = `/project/${projectId}/panel-load/${panelId}`;
        } else if (data.type === 'panel-feeder') {
            path = `/project/${projectId}/panel-feeder/${panelId}`;
        } else {
            // 기본값 (일반 판넬 로드)
            path = `/project/${projectId}/panel-load/${panelId}`;
        }

        if (path) {
            navigate(path);
            setShowMenu(false);
        }
    };

    return (
        <div className="w-[220px] bg-white rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-100 flex flex-col relative transition-transform hover:-translate-y-1 hover:shadow-[0_15px_40px_rgb(0,0,0,0.08)]">
            {/* Top-left colored circle badge */}
            <div className={`absolute -top-2 left-5 w-6 h-6 rounded-full ${bgClass} shadow-sm border-[3px] border-white flex justify-center items-center z-10`}>
                {icon}
            </div>

            <Handle 
                type="target" 
                position={Position.Left} 
                isConnectable={isConnectable} 
                className="!w-3 !h-3 !bg-slate-300 !border-[3px] !border-white shadow-sm -ml-1 transition-transform hover:scale-125" 
            />
            
            <div className="p-4 pt-5 pb-4">
                <div className="flex justify-between items-start">
                    <div className="pr-2 w-full">
                        <h3 className="text-slate-800 border-none font-bold text-[15px] truncate tracking-tight uppercase">
                            {data.label}
                        </h3>
                        <p className="text-slate-400 text-[10px] uppercase font-semibold mt-0.5 tracking-wide truncate">
                            {isSource ? 'EXTERNAL POWER GRID' : (data.location || (isHV ? 'MAIN RECEIVING POINT' : (isGenerator ? 'EMERGENCY POWER SYSTEM' : (isTransformer ? 'MAIN TR' : (data.type === 'power-load' ? 'MOTOR CONTROL CENTER' : 'PANEL BOARD')))))}
                        </p>
                    </div>
                    <div className="relative" ref={menuRef}>
                        <button 
                            className={`text-slate-300 hover:text-slate-500 transition-colors flex-shrink-0 p-1 rounded-full ${showMenu ? 'bg-slate-50 text-slate-500' : ''}`}
                            onClick={() => setShowMenu(!showMenu)}
                        >
                            <MoreHorizontal size={14} />
                        </button>

                        {/* 메뉴 드롭다운 */}
                        {showMenu && (
                            <div className="absolute right-0 top-full mt-1 w-24 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-in fade-in zoom-in slide-in-from-top-1 duration-150">
                                <button 
                                    className="w-full px-3 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-50 flex items-center justify-between transition-colors whitespace-nowrap"
                                    onClick={handleNavigation}
                                    disabled={isSource}
                                >
                                    OPEN
                                    <ExternalLink size={10} className="text-slate-400" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-50 space-y-2">
                    <div className="flex justify-between items-end">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest shadow-none border-none">
                            {isSource ? 'System Voltage' : ((data.isDemandMode && !isGenerator) ? 'Demand Load' : 'Total Load')}
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-xl font-black tracking-tighter text-slate-700">
                                {isSource ? '22.9' : (
                                    (isHV || isTransformer)
                                        ? (data.isDemandMode 
                                            ? Math.round(Number(data.calculatedDemandLoad || 0)).toLocaleString()
                                            : Math.round(Number(data.calculatedTotalLoad || 0)).toLocaleString()
                                          )
                                        : (isGenerator ? Math.round(Number(data.calculatedTotalLoad || 0)).toLocaleString() : (data.isDemandMode 
                                            ? Math.round(Number(data.capacity || 0) * (Number(data.demandFactor || 100) / 100)).toLocaleString()
                                            : Math.round(Number(data.capacity || 0)).toLocaleString()
                                        ))
                                )}
                            </span>
                            <span className="text-[9px] font-bold text-slate-400">{isSource ? 'kV' : 'kVA'}</span>
                        </div>
                    </div>
                    
                    {/* Modern progress-like visual element for Capacity/Phase */}
                    <div className="relative group/gauge" ref={tooltipRef}>
                        <div 
                            className="w-full bg-slate-100 rounded-full h-1.5 my-2 overflow-hidden flex cursor-help"
                            onClick={() => setShowTooltip(!showTooltip)}
                        >
                            <div 
                                className={`h-full ${bgClass} opacity-80 rounded-full transition-all duration-500 ease-out`} 
                                style={{ width: `${gaugePercent}%` }}
                            ></div>
                        </div>

                        {/* 툴팁 (말풍선) - 클릭 시 활성화 */}
                        {showTooltip && (
                            <div 
                                className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg text-white text-[10px] font-bold whitespace-nowrap shadow-xl z-20 animate-in fade-in zoom-in slide-in-from-bottom-2 duration-200 ${bgClass}`}
                                onClick={() => setShowTooltip(false)}
                            >
                                {tooltipLabel} {Math.round(gaugePercent)}%
                                {/* 말풍선 꼬리 */}
                                <div className={`absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent ${bgClass.replace('bg-', 'border-t-')}`}></div>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 mt-2">
                        <div className="flex items-center gap-1 flex-wrap w-full">
                            {isHV ? (
                                <>
                                    {data.trCapacities && data.trCapacities.map((cap, idx) => (
                                        <span key={idx} className="bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 text-slate-400 shrink-0 font-black tracking-tighter italic shadow-sm">
                                            {cap}
                                        </span>
                                    ))}
                                    <span className="bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 text-amber-600/70 shrink-0 font-black tracking-tighter italic shadow-sm uppercase">22.9kV</span>
                                </>
                            ) : isSource ? (
                                <span className="bg-amber-50 px-2 py-0.5 rounded border border-amber-100 text-amber-600/70 shrink-0 uppercase tracking-wider">Power Grid Source</span>
                            ) : (
                                <>
                                    {/* 변압기 전용 데이터 배너 (레이블 없이 값만 노출) */}
                                    {isTransformer && (
                                        <>
                                            <span className="bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 text-slate-400 shrink-0 font-black tracking-tighter italic shadow-sm">{data.trCapacity}kVA</span>
                                            {data.trType && (
                                                <span className="bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 text-slate-400 shrink-0 uppercase font-black tracking-tighter italic shadow-sm">{data.trType}</span>
                                            )}
                                            <span className="bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 text-amber-600/70 shrink-0 font-black tracking-tighter italic shadow-sm">22.9kV / 380V</span>
                                        </>
                                    )}
                                    {isGenerator && (
                                        <>
                                            {data.installType && (
                                                <span className="bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100 text-rose-500 shrink-0 font-bold text-[9px] shadow-sm">
                                                    {data.installType === 'EMERGENCY' ? '비상용' : '상용'}
                                                </span>
                                            )}
                                            {data.usageType && (
                                                <span className="bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 text-slate-400 shrink-0 uppercase font-black italic tracking-tighter shadow-sm">
                                                    {data.usageType}
                                                </span>
                                            )}
                                            {data.phase && (
                                                <span className="bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 text-slate-400 shrink-0 text-[10px]">
                                                    {data.phase.includes('3Φ') ? '3Φ' : data.phase}
                                                </span>
                                            )}
                                            {data.voltage && (
                                                <span className="bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 text-slate-400 shrink-0 text-[10px]">
                                                    {data.voltage}
                                                </span>
                                            )}
                                        </>
                                    )}
                                    {!isTransformer && !isGenerator && (
                                        <span className="bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 text-slate-400 shrink-0">{data.phase || '3Ø-4W'}</span>
                                    )}
                                    {data.breakerType && (
                                        <span className="bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 text-slate-400 shrink-0 uppercase">{data.breakerType}</span>
                                    )}
                                    {data.breakerAF && data.breakerAT && (
                                        <span className="bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 text-slate-400 shrink-0">
                                            {data.breakerAF}AF/{data.breakerAT}AT
                                        </span>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <Handle 
                type="source" 
                position={Position.Right} 
                isConnectable={isConnectable} 
                className="!w-3 !h-3 !bg-slate-300 !border-[3px] !border-white shadow-sm -mr-1 transition-transform hover:scale-125" 
            />
        </div>
    );
};

export default memo(PanelNodeCard);

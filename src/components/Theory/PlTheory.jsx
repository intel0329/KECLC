import React from 'react';
import { Box, Settings, Shield, Ruler, Maximize, Zap, Info, CheckCircle2, AlertTriangle } from 'lucide-react';

const PlTheory = () => {
    return (
        <div className="mb-12 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header Section */}
            <div className="relative">
                <div className="flex items-stretch gap-3 mb-2">
                    <div className="w-1 sm:w-1.5 bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.4)] self-stretch min-h-[1.2rem] sm:min-h-[1.5rem]"></div>
                    <h2 className="text-lg sm:text-xl font-bold text-white tracking-widest uppercase py-0.5">
                        Technical Guide for Distribution Panels
                    </h2>
                </div>
                <p className="text-gray-400 text-[11px] sm:text-xs font-medium tracking-tight ml-4 sm:ml-4.5 uppercase">
                    분전반 외함 재질, 보호 등급 및 설치 기술 기준 가이드
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Card 1: Enclosure Materials & Properties */}
                <div className="border border-yellow-500/30 bg-yellow-500/5 p-6 relative overflow-hidden group transition-all duration-300 hover:border-gray-500/50">
                    <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity text-yellow-500">
                        <Box size={140} />
                    </div>

                    <div className="relative z-10 space-y-5">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-lg font-bold text-white mb-1">1. 외함 재질 및 특성</h3>
                                <p className="text-xs text-yellow-500 font-bold tracking-widest uppercase">Enclosure Materials</p>
                            </div>
                            <div className="p-2 bg-black/40 border border-white/5 rounded-lg shadow-inner">
                                <Box size={24} className="text-yellow-500" />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm font-bold text-white">
                                    <div className="w-1.5 h-1.5 rounded-full bg-yellow-500"></div>
                                    SPCC (Cold Rolled Steel Plate)
                                </div>
                                <p className="text-[12px] text-gray-200 leading-relaxed ml-3.5">
                                    일반용 냉간 압연 강판. 표면이 매끄럽고 치수가 정밀하여 실내 건조한 장소의 표준 분전반 재질로 가장 널리 사용한다.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm font-bold text-white">
                                    <div className="w-1.5 h-1.5 rounded-full bg-yellow-500"></div>
                                    SUS (Stainless Steel)
                                </div>
                                <p className="text-[12px] text-gray-200 leading-relaxed ml-3.5">
                                    내식성과 내구성이 우수하여 습기가 많은 곳, 화학 공장, 해안 지역 등에 사용한다. (SUS304, SUS316 등)
                                </p>
                            </div>

                            <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="p-3 bg-black/40 border border-white/5 space-y-1.5">
                                    <div className="flex items-center gap-2 text-[11px] font-bold text-blue-400 uppercase tracking-wider">
                                        <Shield size={14} /> 보호 등급 (IP Code)
                                    </div>
                                    <ul className="text-[11px] text-gray-300 space-y-1">
                                        <li>• 실내용: IP4x (먼지 침입 방지)</li>
                                        <li>• 실외용: IP54 ~ IP65 (방진/방수)</li>
                                    </ul>
                                </div>
                                <div className="p-3 bg-black/40 border border-white/5 space-y-1.5">
                                    <div className="flex items-center gap-2 text-[11px] font-bold text-white-300 uppercase tracking-wider">
                                        <Ruler size={14} /> 외함 두께 (Thickness)
                                    </div>
                                    <p className="text-[11px] text-gray-200">
                                        800mm 초과 시 1.6mm 또는 2.3mm 이상의 강판 권장
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Card 2: Installation & Standards */}
                <div className="border border-orange-500/30 bg-orange-500/5 p-6 relative overflow-hidden group transition-all duration-300 hover:border-gray-500/50">
                    <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity text-orange-500">
                        <Settings size={140} />
                    </div>

                    <div className="relative z-10 space-y-5">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-lg font-bold text-white mb-1">2. 설치 및 기술 기준</h3>
                                <p className="text-xs text-orange-500 font-bold tracking-widest uppercase">Installation & Standards</p>
                            </div>
                            <div className="p-2 bg-black/40 border border-white/5 rounded-lg shadow-inner">
                                <Settings size={24} className="text-orange-500" />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex gap-4 p-3 bg-black/30 border border-white/5">
                                <div className="shrink-0 pt-1"><Zap size={18} className="text-orange-500" /></div>
                                <div className="space-y-1">
                                    <div className="text-[12px] font-bold text-white">설치 높이 및 조작성</div>
                                    <p className="text-[11px] text-gray-300 leading-relaxed">
                                        차단기 조작 핸들 높이는 바닥면으로부터 <span className="text-orange-400 font-bold">0.8m ~ 1.5m 이하</span>가 되도록 설치하여 비숙련자도 쉽게 조작 가능해야 한다.
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-4 p-3 bg-black/30 border border-white/5">
                                <div className="shrink-0 pt-1"><Maximize size={18} className="text-orange-500" /></div>
                                <div className="space-y-1">
                                    <div className="text-[12px] font-bold text-white">유지보수 공간 확보</div>
                                    <p className="text-[11px] text-gray-300 leading-relaxed">
                                        전면에는 점검 및 조작을 위한 충분한 이격 거리(<span className="text-orange-400 font-bold">보통 0.6m ~ 0.7m 이상</span>)를 확보해야 한다.
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-green-400">
                                        <CheckCircle2 size={12} /> 접지 및 절연
                                    </div>
                                    <p className="text-[10px] text-gray-400">
                                        외함 접지 필수 및 내부 충전부와 충분한 이격/격벽 설치
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-yellow-400">
                                        <AlertTriangle size={12} /> 예비 회로
                                    </div>
                                    <p className="text-[10px] text-gray-400">
                                        부하 증가 대비 10% ~ 20% 정도의 예비(Spare) 공간 권장
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Note */}
            <div className="flex items-start gap-2 pt-4 border-t border-white/5 text-[11px] text-gray-400 italic">
                <Info size={14} className="mt-0.5 shrink-0" />
                <p>
                    분전반의 설계 및 제작 시 KEC(한국전기설비규정) 및 내선규정의 기술 기준을 준수해야 하며, 설치 장소의 환경 조건에 적합한 외함 사양 선정이 필수적입니다.
                </p>
            </div>
        </div>
    );
};

export default PlTheory;

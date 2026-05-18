import React from 'react';
import { Activity, Layers, Zap, Info } from 'lucide-react';

const XlpeTheory = () => {
    return (
        <div className="mb-12 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header Section */}
            <div className="relative">
                <div className="flex items-stretch gap-3 mb-2">
                    <div className="w-1 sm:w-1.5 bg-yellow-600 shadow-[0_0_10px_rgba(37,99,235,0.4)] self-stretch min-h-[1.2rem] sm:min-h-[1.5rem]"></div>
                    <h2 className="text-lg sm:text-xl font-bold text-white tracking-widest uppercase py-0.5">
                        KEC Installation Methods & Cable Routing
                    </h2>
                </div>
                <p className="text-gray-500 text-[11px] sm:text-xs font-medium tracking-tight ml-4 sm:ml-4.5 uppercase">
                    공사방법에 따른 허용전류 산정 기준 및 기호 정의
                </p>
            </div>

            <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Card 1: Conduit Systems */}
                    <div className="border border-blue-500/30 bg-blue-500/5 p-6 relative overflow-hidden group transition-all duration-300 hover:border-gray-500/50">
                        {/* Decorative background icon */}
                        <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Activity size={120} className="text-blue-500" />
                        </div>

                        <div className="relative z-10 space-y-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-lg font-bold text-white mb-1">1. 전선관 시스템</h3>
                                    <p className="text-xs text-blue-400 font-bold tracking-widest uppercase mb-3">전선관 내부에 전선을 입선하는 건축물 배선 방식</p>
                                </div>
                                <div className="p-2 bg-black/40 border border-white/5 rounded-lg shadow-inner">
                                    <Activity size={24} className="text-blue-500" />
                                </div>
                            </div>

                            <div className="space-y-6 pt-2">
                                {[
                                    { id: "A1 (단심)", label: "단열벽 내부 매입 전선관 공사", desc: "전선관 내 단심 절연전선 또는 단심 케이블을 매입하여 시공하는 방식." },
                                    { id: "A2 (다심)", label: "단열벽 내부 매입 전선관 공사", desc: "전선관 내 다심 케이블을 매입하여 시공하는 방식." },
                                    { id: "B1 (단심)", label: "벽면 노출 전선관 공사 (벽부착)", desc: "벽면 표면에 전선관을 고정하고 단심 절연전선/케이블을 입선하는 방식." },
                                    { id: "B2 (다심)", label: "벽면 노출 전선관 공사 (벽부착)", desc: "벽면 표면에 전선관을 고정하고 다심 케이블을 입선하는 방식." }
                                ].map((item, i) => (
                                    <div key={i} className="space-y-1.5">
                                        <h4 className="text-[13px] font-bold text-blue-400 tracking-wide uppercase">{item.id}</h4>
                                        <p className="text-[13px] text-gray-200 leading-relaxed">
                                            <span className="font-bold text-white">{item.label}:</span> {item.desc}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Card 2: Open & Buried Systems */}
                    <div className="border border-green-500/30 bg-green-500/5 p-6 relative overflow-hidden group transition-all duration-300 hover:border-gray-500/50">
                        {/* Decorative background icon */}
                        <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Layers size={120} className="text-green-500" />
                        </div>

                        <div className="relative z-10 space-y-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-lg font-bold text-white mb-1">2. 트레이 및 지중 시스템</h3>
                                    <p className="text-xs text-green-400 font-bold tracking-widest uppercase mb-3">대용량 전송 트레이 및 지중 매설 방식</p>
                                </div>
                                <div className="p-2 bg-black/40 border border-white/5 rounded-lg shadow-inner">
                                    <Layers size={24} className="text-green-500" />
                                </div>
                            </div>

                            <div className="space-y-6 pt-2">
                                {[
                                    { id: "E (다심)", label: "사다리형 트레이 / 케이블 랙 공사", desc: "공기 중 노출된 사다리형 트레이 위에 다심 케이블을 포설하는 방식." },
                                    { id: "F (단심)", label: "사다리형 트레이 / 케이블 랙 공사", desc: "공기 중 노출된 트레이 위에 단심 케이블을 수평 또는 수직으로 배열." },
                                    { id: "D1 (지중)", label: "지중 매설 전선관 내 설치", desc: "케이블을 덕트나 전용 전선관(ELP 등)에 수용하여 땅속에 매설." },
                                    { id: "D2 (지중)", label: "지중 직접 매설 설치", desc: "별도의 관 없이 모래 채움 등 보호 조치 후 땅속에 직접 매설." }
                                ].map((item, i) => (
                                    <div key={i} className="space-y-1.5">
                                        <h4 className="text-[13px] font-bold text-green-400 tracking-wide uppercase">{item.id}</h4>
                                        <p className="text-[13px] text-gray-200 leading-relaxed">
                                            <span className="font-bold text-white">{item.label}:</span> {item.desc}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Note Section (Matching Screenshot Style) */}
                <div className="flex items-center gap-2 px-2">
                    <Info size={14} className="text-gray-600" />
                    <p className="text-[11px] text-gray-600 font-medium">
                        KEC 규정에 따라 공사방법별로 허용전류 보정계수가 다르게 적용된다.
                    </p>
                </div>
            </div>

        </div>
    );
};

export default XlpeTheory;

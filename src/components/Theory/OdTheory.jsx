import React from 'react';
import { Shield, Zap, Activity, Info, Layers, ListChecks, CheckCircle2, AlertTriangle } from 'lucide-react';

const OdTheory = () => {
    return (
        <div className="mb-12 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header Section */}
            <div className="relative">
                <div className="flex items-stretch gap-3 mb-2">
                    <div className="w-1 sm:w-1.5 bg-yellow-500 shadow-[0_0_10px_rgba(37,99,235,0.4)] self-stretch min-h-[1.2rem] sm:min-h-[1.5rem]"></div>
                    <h2 className="text-lg sm:text-xl font-bold text-white tracking-widest uppercase py-0.5">
                        Technical Guide for Distribution Cables
                    </h2>
                </div>
                <p className="text-gray-400 text-[11px] sm:text-xs font-medium tracking-tight ml-4 sm:ml-4.5 uppercase">
                    배전용 케이블의 종류, 전압 구분 및 약호 체계 가이드
                </p>
            </div>

            <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Card 1: Voltage Classification & Labeling */}
                    <div className="border border-blue-500/30 bg-blue-500/5 p-6 relative overflow-hidden group transition-all duration-300 hover:border-gray-500/50">
                        <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Zap size={120} className="text-blue-500" />
                        </div>

                        <div className="relative z-10 space-y-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-lg font-bold text-white mb-1">1. 배전 케이블의 전압 구분</h3>
                                    <p className="text-xs text-blue-400 font-bold tracking-widest uppercase mb-3">전압 등급별 분류 및 표기 방법 (KS기준)</p>
                                </div>
                                <div className="p-2 bg-black/40 border border-white/5 rounded-lg shadow-inner">
                                    <Zap size={24} className="text-blue-500" />
                                </div>
                            </div>

                            <div className="space-y-4 pt-2">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="p-3 bg-black/40 border border-white/5 space-y-2">
                                        <div className="text-[11px] font-bold text-blue-400 uppercase tracking-wider">MV (Medium Voltage)</div>
                                        <ul className="text-[12px] text-gray-200 space-y-1">
                                            <li>• 22.9kV (한전 표준)</li>
                                            <li>• 6/10(12)kV ~ 18/30(36)kV</li>
                                        </ul>
                                    </div>
                                    <div className="p-3 bg-black/40 border border-white/5 space-y-2">
                                        <div className="text-[11px] font-bold text-green-400 uppercase tracking-wider">LV (Low Voltage)</div>
                                        <ul className="text-[12px] text-gray-200 space-y-1">
                                            <li>• 0.6/1(1.2)kV (전력/제어)</li>
                                            <li>• 450/750V, 300/500V (배선)</li>
                                        </ul>
                                    </div>
                                </div>

                                <div className="p-4 bg-blue-500/10 border border-blue-500/20 space-y-3">
                                    <div className="flex items-center gap-2">
                                        <Activity size={14} className="text-blue-400" />
                                        <span className="text-[13px] font-bold text-white">전압 표기 방법 : U₀ / U (Uₘ) kV</span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-2 text-[12px]">
                                        <div className="flex gap-2">
                                            <span className="text-blue-400 font-bold min-w-[2rem]">U₀ :</span>
                                            <span className="text-gray-200">상 전압 (상 전압, 도체-대지 사이 전압)</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <span className="text-blue-400 font-bold min-w-[2rem]">U :</span>
                                            <span className="text-gray-200">선간 전압 (선간 전압, 도체-도체 사이 전압)</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <span className="text-blue-400 font-bold min-w-[2rem]">Uₘ :</span>
                                            <span className="text-gray-200">시스템 최고 전압 (가장 높은 전압의 최대값)</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Card 2: Cable Types */}
                    <div className="border border-green-500/30 bg-green-500/5 p-6 relative overflow-hidden group transition-all duration-300 hover:border-gray-500/50">
                        <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Shield size={120} className="text-green-500" />
                        </div>

                        <div className="relative z-10 space-y-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-lg font-bold text-white mb-1">2. 배전 케이블의 종류</h3>
                                    <p className="text-xs text-green-400 font-bold tracking-widest uppercase mb-3">용도별 주요 케이블 규격</p>
                                </div>
                                <div className="p-2 bg-black/40 border border-white/5 rounded-lg shadow-inner">
                                    <Shield size={24} className="text-green-500" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3 pt-2">
                                {[
                                    { category: "전력 케이블", items: "0.6/1kV ~ 22.9kV (FW-CV, HFCO, CNCV-W 등)" },
                                    { category: "소방용 케이블", items: "0.6/1kV 내화/난연 (F-FR-8, NFR-8)" },
                                    { category: "제어/계장 케이블", items: "0.6/1kV (CVV, CVV-S/-SB, HFCCO 등)" },
                                    { category: "절연 전선", items: "450/750V (HFIX, F-GV, HIV 등)" },
                                    { category: "태양광 케이블", items: "SOLAR CABLE, FLOATING SOLAR CABLE" }
                                ].map((type, i) => (
                                    <div key={i} className="flex items-center gap-3 p-2.5 bg-black/30 border border-white/5 hover:border-green-500/30 transition-colors">
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0"></div>
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                                            <span className="text-[12px] font-bold text-white min-w-[7rem]">{type.category}</span>
                                            <span className="text-[11px] text-gray-300">{type.items}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Card 3: Abbreviation Guide (Full Width) */}
                <div className="border border-purple-500/30 bg-purple-500/5 p-6 relative overflow-hidden group transition-all duration-300 hover:border-gray-500/50">
                    <div className="absolute -right-8 -bottom-8 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Layers size={200} className="text-purple-500" />
                    </div>

                    <div className="relative z-10 space-y-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-lg font-bold text-white mb-1">3. 케이블 약호 가이드</h3>
                                <p className="text-xs text-purple-400 font-bold tracking-widest uppercase">구조 및 특성별 주요 약호 정의</p>
                            </div>
                            <div className="p-2 bg-black/40 border border-white/5 rounded-lg shadow-inner">
                                <Layers size={24} className="text-purple-500" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                            {/* Properties Table */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 size={16} className="text-purple-400" />
                                    <span className="text-sm font-bold text-gray-200">특성 및 용도별 약호</span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-[11px] sm:text-[12px] border-collapse">
                                        <thead>
                                            <tr className="bg-purple-500/10 border-b border-purple-500/20 text-purple-300">
                                                <th className="p-2 text-left w-[80px] sm:w-[100px]">약호</th>
                                                <th className="p-2 text-left">주요 특성 / 용도</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5 text-gray-300">
                                            <tr><td className="p-2 font-bold text-white whitespace-nowrap">F- (FR-)</td><td className="p-2 text-gray-300">난연 (Flame Retardant), 트레이용 난연</td></tr>
                                            <tr><td className="p-2 font-bold text-white whitespace-nowrap">FW-</td><td className="p-2 text-gray-300">난연 + 차수 (Water Resistance)</td></tr>
                                            <tr><td className="p-2 font-bold text-white whitespace-nowrap">TR-</td><td className="p-2 text-gray-300">수트리 억제형 (Water-Tree Resistance)</td></tr>
                                            <tr><td className="p-2 font-bold text-white whitespace-nowrap">HF (N)</td><td className="p-2 text-gray-300">저독성 (Halogen Free / Non-Halogen)</td></tr>
                                            <tr><td className="p-2 font-bold text-white whitespace-nowrap">FR-8</td><td className="p-2 text-gray-300">소방용 내화 (Fire Resistance, 830℃/120min)</td></tr>
                                            <tr><td className="p-2 font-bold text-white whitespace-nowrap">C / G</td><td className="p-2 text-gray-300">제어용 (Control) / 접지용 (Ground)</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Structure Table */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <ListChecks size={16} className="text-purple-400" />
                                    <span className="text-sm font-bold text-gray-200">케이블 구조별 약호</span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-[11px] sm:text-[12px] border-collapse">
                                        <thead>
                                            <tr className="bg-purple-500/10 border-b border-purple-500/20 text-purple-300">
                                                <th className="p-2 text-left w-[80px] sm:w-[100px]">부분</th>
                                                <th className="p-2 text-left">약호 및 설명</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5 text-gray-300">
                                            <tr><td className="p-2 font-bold text-white whitespace-nowrap">도체</td><td className="p-2">Cu (생략), /AL (알루미늄), -W (수밀형)</td></tr>
                                            <tr><td className="p-2 font-bold text-white whitespace-nowrap">절연체</td><td className="p-2">C (XLPE - 가교폴리에틸렌), V (PVC)</td></tr>
                                            <tr><td className="p-2 font-bold text-white whitespace-nowrap">금속차폐</td><td className="p-2">-S (동 테이프), -SB (동 편조), -AMS (AL-Mylar), CN (중성선)</td></tr>
                                            <tr><td className="p-2 font-bold text-white whitespace-nowrap">시스</td><td className="p-2">V (PVC), O (폴리올레핀), E (폴리에틸렌)</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-start gap-2 pt-4 border-t border-white/5 text-[11px] text-gray-400 italic">
                            <Info size={14} className="mt-0.5" />
                            <p>통상적으로 도체(내부) → 절연체 → 차폐 → 시스(외부) 순으로 약호를 순차 표기하며, 계통의 전압 및 설치 환경에 따라 적정 약호 조합을 선정함.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OdTheory;

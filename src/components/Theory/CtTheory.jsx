import React from 'react';
import { Radio, Zap, Info, Activity, AlertTriangle } from 'lucide-react';

const CtTheory = () => {
    return (
        <div className="mb-12 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header Section */}
            <div className="relative">
                <div className="flex items-stretch gap-3 mb-2">
                    <div className="w-1 sm:w-1.5 bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.4)] self-stretch min-h-[1.2rem] sm:min-h-[1.5rem]"></div>
                    <h2 className="text-lg sm:text-xl font-bold text-white tracking-widest uppercase py-0.5">
                        Current Transformer Selection Guide
                    </h2>
                </div>
                <p className="text-gray-500 text-[11px] sm:text-xs font-medium tracking-tight ml-4 sm:ml-4.5 uppercase">
                    CT 기초 이론 및 규격 선정 가이드
                </p>
            </div>

            <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Card 1: CT Basics & Standards */}
                    <div className="border border-blue-500/30 bg-blue-500/5 p-6 relative overflow-hidden group transition-all duration-300 hover:border-gray-500/50">
                        {/* Decorative background icon */}
                        <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Radio size={120} className="text-blue-500" />
                        </div>

                        <div className="relative z-10 space-y-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-lg font-bold text-white mb-1">1. CT의 기초 및 규격</h3>
                                    <p className="text-xs text-blue-400 font-bold tracking-widest uppercase mb-3">변류비, 오차 등 CT 선정을 위한 기본 파라미터</p>
                                </div>
                                <div className="p-2 bg-black/40 border border-white/5 rounded-lg shadow-inner">
                                    <Radio size={24} className="text-blue-500" />
                                </div>
                            </div>

                            <div className="space-y-6 pt-2">
                                {[
                                    { id: "변류비 (CT Ratio)", label: "전류 변성", desc: "1차 대전류를 2차 소전류(5A)로 변성하여 계측 및 보호 기기에 공급하는 비율." },
                                    { id: "정격 부담 (Rated Burden)", label: "소비 전력량", desc: "CT 2차측에 연결되는 계측기, 계전기 및 배선 저항의 합계 소비 전력[VA]." },
                                    { id: "오차 계급 (Accuracy Class)", label: "변성 정밀도", desc: "사용 목적에 따라 계측용(0.2, 0.5)과 보호용(5P, 10P)으로 정밀도 등급을 구분." },
                                    { id: "극성 (Polarity)", label: "전류 방향성", desc: "1차측(K, L)과 2차측(k, l)의 방향 관계를 나타내며, 국내는 주로 감극성을 사용." }
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

                    {/* Card 2: Design & Precautions */}
                    <div className="border border-purple-500/30 bg-purple-500/5 p-6 relative overflow-hidden group transition-all duration-300 hover:border-gray-500/50">
                        {/* Decorative background icon */}
                        <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Zap size={120} className="text-purple-500" />
                        </div>

                        <div className="relative z-10 space-y-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-lg font-bold text-white mb-1">2. 설계 및 취급 주의사항</h3>
                                    <p className="text-xs text-purple-400 font-bold tracking-widest uppercase mb-3">사고 시 특성 및 현장 취급 시 필수 안전 가이드</p>
                                </div>
                                <div className="p-2 bg-black/40 border border-white/5 rounded-lg shadow-inner">
                                    <Zap size={24} className="text-purple-500" />
                                </div>
                            </div>

                            <div className="space-y-6 pt-2">
                                {[
                                    { id: "과전류 정수 (n)", label: "사고 시 포화 특성", desc: "고장 전류 시 CT가 포화되지 않고 정확한 전류를 전달하는 능력(보통 N > 10 이상)." },
                                    { id: "CT비 선정 기준", label: "적정 용량 선정", desc: "부하 정격전류에 1.25 ~ 1.5배의 여유를 두어 표준 규격의 CT를 선정." },
                                    { id: "정격 내전류", label: "단락 전류 견딤 능력", desc: "고장 전류 시 CT가 열적, 기계적으로 파손되지 않고 견딜 수 있는 최대 한계 전류." },
                                    { id: "2차측 개방 금지 (Open Circuit)", label: "최우선 안전 사항", desc: "통전 중 2차 개방 시 고전압으로 인한 절연 파괴 및 인명 사고 위험(반드시 단락 선행)." }
                                ].map((item, i) => (
                                    <div key={i} className="space-y-1.5">
                                        <h4 className={`text-[13px] font-bold tracking-wide uppercase ${item.id.includes('개방 금지') ? 'text-red-400' : 'text-purple-400'}`}>{item.id}</h4>
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
                        CT 선정 시 계통의 최대 부하전류와 보호계전기의 동작 특성을 고려하여 적정 규격을 설계해야 한다.
                    </p>
                </div>
            </div>

        </div>
    );
};

export default CtTheory;

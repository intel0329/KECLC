import React from 'react';
import { Shield, Zap, Info, Activity, AlertTriangle } from 'lucide-react';

const CbTheory = () => {
    return (
        <div className="mb-12 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header Section */}
            <div className="relative">
                <div className="flex items-stretch gap-3 mb-2">
                    <div className="w-1 sm:w-1.5 bg-yellow-500 shadow-[0_0_10px_rgba(37,99,235,0.4)] self-stretch min-h-[1.2rem] sm:min-h-[1.5rem]"></div>
                    <h2 className="text-lg sm:text-xl font-bold text-white tracking-widest uppercase py-0.5">
                        Circuit Breaker Selection Guide
                    </h2>
                </div>
                <p className="text-gray-500 text-[11px] sm:text-xs font-medium tracking-tight ml-4 sm:ml-4.5 uppercase">
                    차단기 종류별 특징 및 선정 파라미터 가이드
                </p>
            </div>

            <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Card 1: Breaker Types */}
                    <div className="border border-blue-500/30 bg-blue-500/5 p-6 relative overflow-hidden group transition-all duration-300 hover:border-gray-500/50">
                        {/* Decorative background icon */}
                        <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Shield size={120} className="text-blue-500" />
                        </div>

                        <div className="relative z-10 space-y-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-lg font-bold text-white mb-1">1. 차단기의 종류</h3>
                                    <p className="text-xs text-blue-400 font-bold tracking-widest uppercase mb-3">용도와 전압 레벨에 따른 주요 차단기 계열 구분</p>
                                </div>
                                <div className="p-2 bg-black/40 border border-white/5 rounded-lg shadow-inner">
                                    <Shield size={24} className="text-blue-500" />
                                </div>
                            </div>

                            <div className="space-y-6 pt-2">
                                {[
                                    { id: "MCCB (배선차단기)", label: "Molded Case Circuit Breaker", desc: "저압 전로의 과부하 및 단락 보호를 위한 가장 보편적인 차단기." },
                                    { id: "ELCB (누전차단기)", label: "Earth Leakage Circuit Breaker", desc: "단락/과부하 보호와 지락(누전) 감지 시 즉시 차단하여 감전 사고를 방지." },
                                    { id: "ACB (기중차단기)", label: "Air Circuit Breaker", desc: "저압 수전설비의 메인 차단기로 사용되며 정밀한 제어와 대전류 차단에 적합." },
                                    { id: "VCB (진공차단기)", label: "Vacuum Circuit Breaker", desc: "특고압(22.9kV) 계통에서 진공 상태의 소호 원리를 이용해 사고 전류를 차단." }
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

                    {/* Card 2: Ratings & Parameters */}
                    <div className="border border-purple-500/30 bg-purple-500/5 p-6 relative overflow-hidden group transition-all duration-300 hover:border-gray-500/50">
                        {/* Decorative background icon */}
                        <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Activity size={120} className="text-purple-500" />
                        </div>

                        <div className="relative z-10 space-y-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-lg font-bold text-white mb-1">2. 정격 파라미터</h3>
                                    <p className="text-xs text-purple-400 font-bold tracking-widest uppercase mb-3">차단기 선정 시 검토해야 하는 핵심 정격 데이터</p>
                                </div>
                                <div className="p-2 bg-black/40 border border-white/5 rounded-lg shadow-inner">
                                    <Activity size={24} className="text-purple-500" />
                                </div>
                            </div>

                            <div className="space-y-6 pt-2">
                                {[
                                    { id: "AF (Ampere Frame)", label: "프레임 용량", desc: "차단기 본체의 최대 견딤 전류 및 외형 사이즈를 결정하는 기준." },
                                    { id: "AT (Ampere Trip)", label: "트립 정격전류", desc: "차단기가 실제로 동작(Trip)을 시작하는 기준이 되는 설계 전류 값." },
                                    { id: "Icu (Ultimate Capacity)", label: "극한 차단 용량", desc: "차단기가 사고 시 안전하게 끊을 수 있는 최대 단락 전류값." },
                                    { id: "Selectivity (보호협조)", label: "차단기 간 동작 순서", desc: "사고 지점과 가장 가까운 차단기만 동작시켜 정전 범위를 최소화하는 설계 원칙." }
                                ].map((item, i) => (
                                    <div key={i} className="space-y-1.5">
                                        <h4 className="text-[13px] font-bold text-purple-400 tracking-wide uppercase">{item.id}</h4>
                                        <p className="text-[13px] text-gray-200 leading-relaxed">
                                            <span className="font-bold text-white">{item.label}:</span> {item.desc}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Selection Logic (Compact & Refined) */}
                <div className="border border-yellow-500/30 bg-yellow-500/5 p-6 relative overflow-hidden group transition-all duration-300 hover:border-gray-500/50">
                    {/* Decorative background icon */}
                    <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Zap size={120} className="text-yellow-500" />
                    </div>

                    <div className="relative z-10 space-y-4">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-lg font-bold text-white mb-1">선정 핵심 포인트</h3>
                                <p className="text-xs text-yellow-500 font-bold tracking-widest uppercase mb-3">계통의 단락용량과 부하 특성에 따라 최종 결정</p>
                            </div>
                            <div className="p-2 bg-black/40 border border-white/5 rounded-lg shadow-inner">
                                <Zap size={24} className="text-yellow-500" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-y-5 gap-x-12 pt-2">
                            {/* 1. Rating Selection */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 px-1">
                                    <div className="w-1 h-3 bg-blue-500/80 rounded-full"></div>
                                    <span className="text-[12px] font-bold text-gray-300">차단기 정격 선정</span>
                                </div>
                                <div className="pl-3 overflow-x-auto scrollbar-hide">
                                    <div className="flex items-center gap-x-2 whitespace-nowrap min-w-max text-[13px]">
                                        <span className="text-blue-500 font-bold">•</span>
                                        <div className="flex items-center gap-x-1.5">
                                            <span className="text-gray-300">부하전류</span>
                                            <span className="text-blue-400 font-mono font-bold">I<sub className="text-[0.6em] ml-0.5">B</sub></span>
                                            <span className="text-gray-400 mx-1">≤</span>
                                            <span className="text-gray-300">차단기 정격</span>
                                            <span className="text-white font-mono font-bold">I<sub className="text-[0.6em] ml-0.5">N</sub></span>
                                            <span className="text-gray-400 mx-1">≤</span>
                                            <span className="text-gray-300">전선 허용전류</span>
                                            <span className="text-green-400 font-mono font-bold">I<sub className="text-[0.6em] ml-0.5">Z</sub></span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 2. Breaking Capacity */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 px-1">
                                    <div className="w-1 h-3 bg-purple-500/80 rounded-full"></div>
                                    <span className="text-[12px] font-bold text-gray-300">차단기 차단 용량</span>
                                </div>
                                <div className="pl-3 overflow-x-auto scrollbar-hide">
                                    <div className="flex items-center gap-x-2 whitespace-nowrap min-w-max text-[13px]">
                                        <span className="text-purple-500 font-bold">•</span>
                                        <div className="flex items-center gap-x-1.5">
                                            <span className="text-gray-300">최대 고장전류</span>
                                            <span className="text-red-400 font-mono font-bold">I<sub className="text-[0.6em] ml-0.5">S</sub></span>
                                            <span className="text-gray-400 mx-1.5">≤</span>
                                            <span className="text-gray-300">차단기 극한 차단용량</span>
                                            <span className="text-purple-400 font-mono font-bold">I<sub className="text-[0.6em] ml-0.5">cu</sub></span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CbTheory;

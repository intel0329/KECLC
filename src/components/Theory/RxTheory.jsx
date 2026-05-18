import React from 'react';
import { Shield, Zap, Activity, Info, Layers } from 'lucide-react';

const RxTheory = () => {
    return (
        <div className="mb-12 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header Section */}
            <div className="relative">
                <div className="flex items-stretch gap-3 mb-2">
                    <div className="w-1 sm:w-1.5 bg-yellow-500 shadow-[0_0_10px_rgba(37,99,235,0.4)] self-stretch min-h-[1.2rem] sm:min-h-[1.5rem]"></div>
                    <h2 className="text-lg sm:text-xl font-bold text-white tracking-widest uppercase py-0.5">
                        Technical Guide for Cable Impedance
                    </h2>
                </div>
                <p className="text-gray-500 text-[11px] sm:text-xs font-medium tracking-tight ml-4 sm:ml-4.5 uppercase">
                    임피던스 데이터의 기술적 구성 및 계통 설계 활용 가이드
                </p>
            </div>

            <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Card 1: Technical Composition */}
                    <div className="border border-yellow-500/30 bg-yellow-500/5 p-6 relative overflow-hidden group transition-all duration-300 hover:border-gray-500/50">
                        {/* Decorative background icon */}
                        <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Zap size={120} className="text-yellow-500" />
                        </div>

                        <div className="relative z-10 space-y-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-lg font-bold text-white mb-1">1. 임피던스의 기술적 구성</h3>
                                    <p className="text-xs text-yellow-500 font-bold tracking-widest uppercase mb-3">임피던스(Z) 성분 및 물리적 구성 요소</p>
                                </div>
                                <div className="p-2 bg-black/40 border border-white/5 rounded-lg shadow-inner">
                                    <Zap size={24} className="text-yellow-500" />
                                </div>
                            </div>

                            <div className="space-y-6 pt-2">
                                {[
                                    { 
                                        id: "1. 임피던스 (Z)", 
                                        label: "교류 회로의 전류 흐름 방해 요소", 
                                        desc: (
                                            <>
                                                케이블의 저항(R)과 리액턴스(X)의 벡터 합을 의미. 
                                                <span className="text-yellow-400 font-mono ml-1">Z = √(R² + X²)</span>로 계산되며, 
                                                단위는 <span className="text-yellow-400 font-mono">[Ω/km]</span>를 사용한다.
                                            </>
                                        )
                                    },
                                    { 
                                        id: "2. 교류 저항 (R)", 
                                        label: "온도와 표피 효과의 반영", 
                                        desc: "도체의 고유 저항뿐만 아니라, 교류 전류가 흐를 때 발생하는 Skin Effect와 온도 상승에 따른 저항 변화를 고려한 실효 저항값이다." 
                                    },
                                    { 
                                        id: "3. 리액턴스 (X)", 
                                        label: "자기유도 및 배치 방식의 영향", 
                                        desc: "케이블 주변에 형성되는 자기장에 의해 발생하며, 전선의 배치 간격과 배열 방식(성형, 평면 배열 등)에 따라 값이 변동됩니다." 
                                    }
                                ].map((item, i) => (
                                    <div key={i} className="space-y-1.5">
                                        <h4 className="text-[13px] font-bold text-yellow-500 tracking-wide uppercase">{item.id}</h4>
                                        <p className="text-[13px] text-gray-200 leading-relaxed">
                                            <span className="font-bold text-white">{item.label}:</span> {item.desc}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Card 2: Application in System Design */}
                    <div className="border border-green-500/30 bg-green-500/5 p-6 relative overflow-hidden group transition-all duration-300 hover:border-gray-500/50">
                        {/* Decorative background icon */}
                        <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Activity size={120} className="text-green-500" />
                        </div>

                        <div className="relative z-10 space-y-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-lg font-bold text-white mb-1">2. 계통 설계 시 활용</h3>
                                    <p className="text-xs text-green-400 font-bold tracking-widest uppercase mb-3">전압강하 및 고장전류 산정을 위한 핵심 변수</p>
                                </div>
                                <div className="p-2 bg-black/40 border border-white/5 rounded-lg shadow-inner">
                                    <Activity size={24} className="text-green-500" />
                                </div>
                            </div>

                            <div className="space-y-6 pt-2">
                                {[
                                    { 
                                        id: "1. 전압강하 (e)", 
                                        label: "정확한 말단 전압 산출", 
                                        desc: (
                                            <>
                                                전압강하 계산식 <span className="text-green-400 font-mono ml-1">e = √3I(Rcosφ + Xsinφ)L</span>의 핵심 변수로, 케이블 길이에따른 임피던스에 의한 전압 손실을 반드시 확인해야 한다.
                                            </>
                                        )
                                    },
                                    { 
                                        id: "2. 단락 전류 (Iₛ)", 
                                        label: "차단기 차단 용량(kA) 결정", 
                                        desc: "사고 발생 시 흐르는 고장 전류는 계통 임피던스에 반비례한다. 케이블 임피던스 값은 차단기의 차단 능력을 산정하는 기준된다." 
                                    },
                                    { 
                                        id: "3. 케이블 종류별 특성", 
                                        label: "절연체 및 공사 환경의 차이", 
                                        desc: "0.6/1kV 케이블(CV 계열)과 450/750V 전선(HFIX)은 절연 두께와 재질이 다르며, 이는 단위 길이당 임피던스 값의 차이로 나타난다." 
                                    }
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


                {/* Note Section */}
                <div className="flex items-center gap-2 px-2">
                    <Info size={14} className="text-gray-600" />
                    <p className="text-[11px] text-gray-600 font-medium">
                        케이블의 포설 방식 및 주위 온도에 따라 임피던스 값이 변동될 수 있으므로 설계 시 이를 고려해야 합니다.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default RxTheory;

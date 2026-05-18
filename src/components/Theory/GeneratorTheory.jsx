import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { Zap, Info, Shield, ListChecks, Activity, Cpu, ZapOff, Repeat, Clock, Wind } from 'lucide-react';

/**
 * [HELPER] FormattedText & Highlight
 * 디자인 무결성을 위해 DataViewer의 핵심 로직을 그대로 가져옴
 */
const TheoryFormattedText = ({ text }) => {
    if (!text) return null;
    const str = text.toString();
    const parts = str.split(/(_[a-zA-Z0-9]+)/g);
    return (
        <>
            {parts.map((part, i) => (
                part.startsWith('_') ? (
                    <sub key={i} className="text-[0.8em] leading-none">{part.slice(1)}</sub>
                ) : (
                    part
                )
            ))}
        </>
    );
};

const TheoryHighlight = ({ text, query }) => {
    if (!text) return null;
    if (!query) return <TheoryFormattedText text={text} />;
    const str = text.toString();
    const parts = str.split(new RegExp(`(${query})`, 'gi'));
    return (
        <span>
            {parts.map((part, i) =>
                part.toLowerCase() === query.toLowerCase() ? (
                    <mark key={i} className="bg-blue-500/40 text-white rounded-sm px-0.5">{part}</mark>
                ) : (
                    <TheoryFormattedText key={i} text={part} />
                )
            )}
        </span>
    );
};

/**
 * [HELPER] CornerBorders
 */
const TheoryCornerBorders = () => (
    <>
        <div className="corner-tl border-gray-800" />
        <div className="corner-tr border-gray-800" />
        <div className="corner-bl border-gray-800" />
        <div className="corner-br border-gray-800" />
    </>
);

/**
 * 1. GeneratorTheoryMain (상단 섹션)
 * 공식 및 주요 용어 정의
 */
export const GeneratorTheoryMain = () => {
    const definitions = [
        { title: "1. 상용전원 (Commercial Power)", description: "평상시 전력 공급원을 의미함.", icon: <Zap size={20} className="text-blue-500" /> },
        { title: "2. 소방부하 (Firefighting Load)", description: "화재 시 인명 구조 및 화재 진압을 위해 필요한 설비(옥내소화전, 스프링클러, 제연설비 등)의 전력 부하.", icon: <Shield size={20} className="text-red-500" /> },
        { title: "3. 비상부하 (Emergency Load)", description: "상용전원 정전 시 인명의 안전이나 재산의 손실을 방지하기 위해 최소한의 작동이 필요한 부하 (비상승강기 등).", icon: <Activity size={20} className="text-yellow-500" /> },
        { title: "4. 정전부하 (Blackout Load)", description: "소방부하 및 비상부하를 제외하고 해당 건축물에서 정전 시에도 전기를 공급해야 하는 부하.", icon: <ListChecks size={20} className="text-green-500" /> },
        { title: "5. 예비전원설비 (Reserve Power)", description: "상용전원 정전 시 소방부하, 비상부하 및 그 밖에 정전 시 운전이 필요한 부하에 전기를 공급하는 독립된 예비전원.", icon: <Cpu size={20} className="text-purple-500" /> }
    ];

    const coefficients = {
        alpha: [
            { label: "표준형 전동기", value: "1.45", desc: "일반적인 유도 전동기 기준" },
            { label: "고효율 전동기", value: "1.38", desc: "고효율 에너지 인증 제품" }
        ],
        beta: [
            { method: "직입 기동 (Direct)", value: "6.0", range: "5.0 ~ 7.0", color: "text-red-400" },
            { method: "와이-델타 (Y-Δ)", value: "2.0", range: "2.0 ~ 3.0", color: "text-blue-400" },
            { method: "인버터 (VVVF)", value: "1.5", range: "1.0 ~ 1.5", color: "text-green-400" },
            { method: "리액터 기동", value: "4.8", range: "Tap에 따라 변동", color: "text-yellow-400" }
        ]
    };

    return (
        <div className="mb-12 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="relative">
                <div className="flex items-stretch gap-3 mb-2">
                    <div className="w-1 sm:w-1.5 bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.4)] self-stretch min-h-[1.2rem] sm:min-h-[1.5rem]"></div>
                    <h2 className="text-lg sm:text-xl font-bold text-white tracking-widest uppercase py-0.5">
                        Generator Capacity Calculation & Definitions
                    </h2>
                </div>
                <p className="text-gray-500 text-[11px] sm:text-xs font-medium tracking-tight ml-4 sm:ml-4.5">
                    비상발전기 용량 산정을 위한 주요 용어 정의 및 계산 공식 가이드
                </p>
            </div>

            <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-yellow-500/20 to-blue-500/20 rounded-xl blur opacity-75 group-hover:opacity-100 transition duration-1000"></div>
                <div className="relative bg-black border border-gray-800 p-8 rounded-xl overflow-hidden">
                    <div className="absolute top-0 right-0 p-6 opacity-5"><ZapOff size={140} /></div>
                    <div className="flex flex-col items-center justify-center space-y-8 py-4">
                        <div className="text-gray-400 text-xs font-bold uppercase tracking-[0.2em]">Calculation Formula</div>
                        <div className="flex flex-col lg:flex-row items-center justify-center gap-y-3 lg:gap-y-0 lg:gap-x-4 text-[22px] sm:text-4xl font-mono text-white tracking-tighter text-center">
                            <div className="flex items-center justify-center gap-2 lg:gap-4 shrink-0"><span className="text-yellow-500 font-bold">GP</span><span>≥</span></div>
                            <div className="flex flex-col lg:flex-row items-center justify-center gap-y-3 lg:gap-y-0 lg:gap-x-4 max-w-full lg:max-w-none">
                                <div className="max-w-full lg:max-w-none lg:overflow-visible overflow-x-auto scrollbar-hide py-1 px-4 lg:px-0">
                                    <div className="flex items-center justify-center gap-x-1 lg:gap-x-4 whitespace-nowrap min-w-max">
                                        <span className="text-gray-600">[</span>
                                        <div className="flex items-center gap-x-1 lg:gap-x-2">
                                            <span className="bg-blue-500/10 px-1 lg:px-2 py-0.5 lg:py-1 border border-blue-500/30 rounded text-blue-500 text-[18px] sm:text-[32px]">ΣP</span>
                                            <span className="text-gray-600">+</span>
                                            <div className="flex items-center">
                                                <span className="text-gray-600">(</span><span className="text-gray-300">ΣP<sub className="text-[0.6em] ml-0.5">M</sub></span><span className="text-gray-600">-</span><span className="text-red-400">P<sub className="text-[0.6em] ml-0.5">L</sub></span><span className="text-gray-600">)</span><span className="text-gray-600">×</span><span className="text-purple-400 italic">α</span>
                                            </div>
                                            <span className="text-gray-600">+</span>
                                            <div className="flex items-center">
                                                <span className="text-gray-600">(</span><span className="text-red-400">P<sub className="text-[0.6em] ml-0.5">L</sub></span><span className="text-gray-600">×</span><span className="text-purple-400 italic">α</span><span className="text-gray-600">×</span><span className="text-green-400 italic">β</span><span className="text-gray-600">×</span><span className="text-blue-400 italic">C</span><span className="text-gray-600">)</span>
                                            </div>
                                        </div>
                                        <span className="text-gray-600">]</span>
                                    </div>
                                </div>
                                <div className="flex items-center justify-center gap-2 lg:gap-4 shrink-0"><span className="text-gray-600">×</span><span className="text-orange-400 italic">K</span></div>
                            </div>
                        </div>
                        <div className="grid grid-cols-4 lg:grid-cols-8 gap-4 w-full pt-8 border-t border-gray-900">
                            {[
                                { label: "GP", desc: "발전기 출력 [kVA]", color: "text-yellow-500" },
                                { label: "ΣP", desc: "전동기 제외 부하 [kVA]", color: "text-blue-500" },
                                { label: <span>ΣP<sub className="text-[0.6em] ml-0.5">M</sub></span>, desc: "일반 전동기 부하 합계 [kW]", color: "text-gray-300" },
                                { label: <span>P<sub className="text-[0.6em] ml-0.5">L</sub></span>, desc: "기동용량 최대 전동기 [kW]", color: "text-red-400" },
                                { label: "α", desc: "입력 용량계수 [kVA/kW]", color: "text-purple-400" },
                                { label: "β", desc: "전동기 기동배율", color: "text-green-400" },
                                { label: "C", desc: "전동기 기동계수", color: "text-blue-400" },
                                { label: "K", desc: "전압강하 보정계수", color: "text-orange-400" }
                            ].map((item, i) => (
                                <div key={i} className="flex flex-col items-center text-center">
                                    <span className={`text-base font-bold ${item.color} mb-1`}>{item.label}</span>
                                    <span className="text-[9px] text-[#d1d5db] font-medium leading-tight">{item.desc}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-4 px-2"><Info size={16} className="text-blue-500" /><h3 className="text-sm font-bold text-gray-300 uppercase tracking-widest">용어의 정의</h3></div>
                    <div className="space-y-3">
                        {definitions.map((def, i) => (
                            <div key={i} className="group p-4 bg-gray-900/40 border border-gray-800 hover:border-gray-700 transition-all duration-300">
                                <div className="flex items-start gap-4">
                                    <div className="mt-1 p-1.5 bg-black rounded shadow-inner group-hover:scale-110 transition-transform">{def.icon}</div>
                                    <div className="space-y-1">
                                        <h4 className="text-sm font-bold text-white tracking-tight">{def.title}</h4>
                                        <p className="text-[11px] sm:text-xs text-[#d1d5db] leading-relaxed font-medium">{def.description}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="space-y-8">
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 px-2"><ListChecks size={16} className="text-purple-500" /><h3 className="text-sm font-bold text-gray-300 tracking-widest uppercase">입력 용량계수 <span className="normal-case">α</span></h3></div>
                        <div className="bg-black border border-gray-900 overflow-hidden">
                            <table className="w-full text-xs text-left table-fixed">
                                <thead className="bg-gray-900/50 text-[#d1d5db] font-bold uppercase tracking-tighter">
                                    <tr><th className="w-[30%] px-4 py-3">전동기 종류</th><th className="w-[20%] px-4 py-3 text-center">추천값</th><th className="w-[50%] px-4 py-3">설명</th></tr>
                                </thead>
                                <tbody className="divide-y divide-gray-900">
                                    {coefficients.alpha.map((row, i) => (
                                        <tr key={i} className="hover:bg-white/5 transition-colors">
                                            <td className="px-4 py-3 text-white font-medium">{row.label}</td>
                                            <td className="px-4 py-3 text-center text-purple-400 font-bold">{row.value}</td>
                                            <td className="px-4 py-3 text-[#d1d5db]">{row.desc}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 px-2"><ListChecks size={16} className="text-green-500" /><h3 className="text-sm font-bold text-gray-300 tracking-widest uppercase">기동 방식별 기동배율 <span className="normal-case">β</span> 및 기동계수 <span className="normal-case">C</span></h3></div>
                        <div className="bg-black border border-gray-900 overflow-hidden">
                            <table className="w-full text-xs text-left table-fixed">
                                <thead className="bg-gray-900/50 text-[#d1d5db] font-bold uppercase tracking-tighter">
                                    <tr><th className="w-[30%] px-4 py-3">기동 방식</th><th className="w-[20%] px-4 py-3 text-center">추천값</th><th className="w-[50%] px-4 py-3">범위</th></tr>
                                </thead>
                                <tbody className="divide-y divide-gray-900">
                                    {coefficients.beta.map((row, i) => (
                                        <tr key={i} className="hover:bg-white/5 transition-colors">
                                            <td className="px-4 py-3 text-white font-medium">{row.method}</td>
                                            <td className={`px-4 py-3 text-center font-bold ${row.color}`}>{row.value}</td>
                                            <td className="px-4 py-3 text-[#d1d5db]">{row.range}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <p className="px-4 text-[10px] text-[#d1d5db] italic">* 기동 방식 및 설계 사양에 따라 배율이 상이할 수 있어 사양서 확인 권장.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

/**
 * 2. GeneratorReactanceTheory (중간 테이블 섹션)
 * 가로축/세로축 및 K값 매칭 설명
 */
export const GeneratorReactanceTheory = ({ searchTerm }) => {
    return (
        <div className="mt-8 space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 1. 가로축: 발전기 정수 */}
                <div className="group relative">
                    <div className="absolute -inset-0.5 bg-gradient-to-b from-blue-500/20 to-transparent rounded-xl blur opacity-0 group-hover:opacity-100 transition duration-500"></div>
                    <div className="relative h-full bg-gray-900/20 border border-gray-800/50 p-6 rounded-xl hover:border-blue-500/30 transition-all duration-300">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-blue-500/10 rounded-lg">
                                <Activity size={20} className="text-blue-500" />
                            </div>
                            <h4 className="text-white font-bold text-[15px]">가로축: 발전기 정수 <TheoryFormattedText text="X_d'' [%]" /></h4>
                        </div>
                        <ul className="space-y-2.5 text-[12px] text-gray-400 leading-relaxed list-none">
                            <li className="flex gap-2">
                                <span className="text-blue-500 font-bold">•</span>
                                <span>발전기의 과도 리액턴스(Sub-transient Reactance)로 발전기 제조사 제시 값.</span>
                            </li>
                            <li className="flex gap-2">
                                <span className="text-blue-500 font-bold">•</span>
                                <span>보통 일반적인 발전기는 20% ~ 25% 사이 분포.</span>
                            </li>
                            <li className="flex gap-2">
                                <span className="text-blue-500 font-bold">•</span>
                                <span>과도 리액턴스가 작을수록 발전기가 전압 변동에 강함.</span>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* 2. 세로축: 전압 강하율 */}
                <div className="group relative">
                    <div className="absolute -inset-0.5 bg-gradient-to-b from-green-500/20 to-transparent rounded-xl blur opacity-0 group-hover:opacity-100 transition duration-500"></div>
                    <div className="relative h-full bg-gray-900/20 border border-gray-800/50 p-6 rounded-xl hover:border-green-500/30 transition-all duration-300">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-green-500/10 rounded-lg">
                                <Shield size={20} className="text-green-500" />
                            </div>
                            <h4 className="text-white font-bold text-[15px]">세로축: 허용 전압 강하율 (%)</h4>
                        </div>
                        <ul className="space-y-2.5 text-[12px] text-gray-400 leading-relaxed list-none">
                            <li className="flex gap-2">
                                <span className="text-green-500 font-bold">•</span>
                                <span>가장 큰 전동기가 기동 시, 발전기 전압이 순간적으로 몇 %까지 떨어지는 것을 허용할 것인가.</span>
                            </li>
                            <li className="flex gap-2">
                                <span className="text-green-500 font-bold">•</span>
                                <span>전압에 민감한 전자기기가 많다면 15%로 엄격하게 잡고, 일반적인 펌프 위주라면 20 ~ 25%.</span>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* 3. 매칭: K값 산출 */}
                <div className="group relative">
                    <div className="absolute -inset-0.5 bg-gradient-to-b from-orange-500/20 to-transparent rounded-xl blur opacity-0 group-hover:opacity-100 transition duration-500"></div>
                    <div className="relative h-full bg-gray-900/20 border border-gray-800/50 p-6 rounded-xl hover:border-orange-500/30 transition-all duration-300">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-orange-500/10 rounded-lg">
                                <Zap size={20} className="text-orange-500" />
                            </div>
                            <h4 className="text-white font-bold text-[15px]">가로축-세로축 매칭 (K값)</h4>
                        </div>
                        <ul className="space-y-2.5 text-[12px] text-gray-400 leading-relaxed list-none">
                            <li className="flex gap-2">
                                <span className="text-orange-500 font-bold">•</span>
                                <span>가로(리액턴스)와 세로(허용 전압 강하율)가 만나는 지점의 숫자가 바로 <span className="text-white font-bold underline underline-offset-4 decoration-orange-500/50">K값</span>.</span>
                            </li>
                            <li className="flex gap-2">
                                <span className="text-orange-500 font-bold">•</span>
                                <span>K 수치가 작아질수록 발전기 용량(GP)도 작아짐.</span>
                            </li>
                            <li className="flex gap-2">
                                <span className="text-orange-500 font-bold">•</span>
                                <span>전압강하를 너그럽게 잡으면, 큰 용량의 전동기 기동시 다른 전동기들의 MG 떨어지거나 UPS 오작동 위험 있음.</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

/**
 * 3. GeneratorRatingTheory (최하단 섹션)
 * 발전기 출력 등급 종류 설명
 */
export const GeneratorRatingTheory = () => {
    return (
        <div className="mt-24 pt-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            <div className="mb-10">
                <h2 className="text-lg sm:text-xl font-bold text-white/90 tracking-widest border-l-4 border-blue-600 pl-4">
                    Generator Rating (출력 등급)
                </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="group relative">
                    <div className="absolute -inset-0.5 bg-gradient-to-b from-blue-500/20 to-transparent rounded-xl blur opacity-0 group-hover:opacity-100 transition duration-500"></div>
                    <div className="relative h-full bg-gray-900/20 border border-gray-800/50 p-6 rounded-xl hover:border-blue-500/30 transition-all duration-300">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-blue-500/10 rounded-lg"><Zap size={20} className="text-blue-500" /></div>
                            <h4 className="text-white font-bold text-[15px]">상용출력 (Prime Power)</h4>
                        </div>
                        <ul className="space-y-2.5 text-[12px] text-gray-400 leading-relaxed list-none">
                            <li className="flex gap-2"><span className="text-blue-500 font-bold">•</span><span>상업용 전력이 없는 곳에서 주 전원으로 사용.</span></li>
                            <li className="flex gap-2"><span className="text-blue-500 font-bold">•</span><span>변동 부하가 있는 상태에서 장시간 운전.</span></li>
                            <li className="flex gap-2"><span className="text-blue-500 font-bold">•</span><span>부하율 제한을 두어 출력의 70~80%를 넘지 않아야 함.</span></li>
                            <li className="flex gap-2"><span className="text-blue-500 font-bold">•</span><span>현장용 발전기, 전력망이 없는 곳에서 사용.</span></li>
                        </ul>
                    </div>
                </div>
                <div className="group relative">
                    <div className="absolute -inset-0.5 bg-gradient-to-b from-green-500/20 to-transparent rounded-xl blur opacity-0 group-hover:opacity-100 transition duration-500"></div>
                    <div className="relative h-full bg-gray-900/20 border border-gray-800/50 p-6 rounded-xl hover:border-green-500/30 transition-all duration-300">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-green-500/10 rounded-lg"><Repeat size={20} className="text-green-500" /></div>
                            <h4 className="text-white font-bold text-[15px]">연속출력 (Continuous Power)</h4>
                        </div>
                        <ul className="space-y-2.5 text-[12px] text-gray-400 leading-relaxed list-none">
                            <li className="flex gap-2"><span className="text-green-500 font-bold">•</span><span>부하 변동 없이 100% 부하로 연간 사용</span></li>
                            <li className="flex gap-2"><span className="text-green-500 font-bold">•</span><span>전력망과 병렬 운전하여 24시간 지속적인 베이스 로드.</span></li>
                            <li className="flex gap-2"><span className="text-green-500 font-bold">•</span><span>가혹한 조건에서 운전되므로, 상용출력 등급의 발전기보다 엔진 수명이 길도록 낮은 출력으로 설정.</span></li>
                        </ul>
                    </div>
                </div>
                <div className="group relative">
                    <div className="absolute -inset-0.5 bg-gradient-to-b from-yellow-500/20 to-transparent rounded-xl blur opacity-0 group-hover:opacity-100 transition duration-500"></div>
                    <div className="relative h-full bg-gray-900/20 border border-gray-800/50 p-6 rounded-xl hover:border-yellow-500/30 transition-all duration-300">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-yellow-500/10 rounded-lg"><Clock size={20} className="text-yellow-500" /></div>
                            <h4 className="text-white font-bold text-[15px]">비상출력 (Standby)</h4>
                        </div>
                        <ul className="space-y-2.5 text-[12px] text-gray-400 leading-relaxed list-none">
                            <li className="flex gap-2"><span className="text-yellow-500 font-bold">•</span><span>상용전원(한전)이 정전됐을 때만 작동하는 비상 대기용.</span></li>
                            <li className="flex gap-2"><span className="text-yellow-500 font-bold">•</span><span>연간 가동 시간이 제한적이며, 과부하 허용이 안 됌.</span></li>
                            <li className="flex gap-2"><span className="text-yellow-500 font-bold">•</span><span>최대 출력으로 짧은 시간 작동하도록 설계되어 있음.</span></li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

/**
 * 4. GeneratorLoadClassification (신규 추가)
 * 비상용 예비발전설비 연결 부하의 구분
 */
export const GeneratorLoadClassification = () => {
    const motorLoads = {
        outageNeeded: ["인승/화물 승강기", "비상겸용 승강기", "배수 펌프", "냉장·냉동시설", "기계식 주차장", "정화조 동력", "환기팬", "그 외의 것"],
        emergency: ["배연설비", "방화셔터", "제연셔터", "피난용 승강기", "소방구조용 승강기", "급수 펌프", "의료시설", "그 외의 것"],
        firefighting: ["옥내소화전펌프", "스프링클러설비펌프", "물분무소화설비펌프", "연결송수관펌프", "거실 제연팬", "비상용승강장 제연팬", "비상콘센트설비", "그 외의 것"]
    };

    const nonMotorLoads = {
        outageNeeded: ["필수 전등·전열", "동파방지시설", "전산시설", "OA기기", "전기차충전기", "냉·난방시설", "공용부 전등", "그 외의 것"],
        emergency: ["비상조명 설비", "CCTV", "항공장애표시등", "방송·통신시설", "의료시설(전등전열)", "보안시설", "방송 설비", "그 외의 것"],
        firefighting: ["중앙감시반", "가스계소화설비", "비상조명등", "유도등", "비상콘센트(전등·전열)", "무선통신보조설비", "비상 방송 설비", "그 외의 것"]
    };

    const CornerBorders = () => (
        <>
            <div className="corner-tl border-gray-800" />
            <div className="corner-tr border-gray-800" />
            <div className="corner-bl border-gray-800" />
            <div className="corner-br border-gray-800" />
        </>
    );

    const LoadTable = ({ title, data, isLast = false }) => (
        <div className={`space-y-4 ${!isLast ? 'mb-8 lg:mb-0' : ''}`}>
            <div className="flex items-center gap-2 mb-2 px-2">
                <Activity size={16} className="text-blue-500" />
                <h3 className="text-sm font-bold text-gray-300 tracking-widest uppercase">
                    {title}
                </h3>
            </div>
            <div className="border border-gray-900 bg-black relative overflow-hidden group">
                <TheoryCornerBorders />
                <div className="overflow-x-auto custom-scrollbar">
                    <div className="p-2">
                        <table className="w-full border-collapse table-fixed sm:min-w-full min-w-[600px]">
                            <thead>
                                <tr className="bg-[#030712] border-b border-[#111827]">
                                    <th colSpan="2" className="px-2 py-3 text-[11px] sm:text-[12px] font-bold text-gray-300 text-center tracking-wider border-r border-[#111827]">정전 시 부하</th>
                                    <th className="px-2 py-3 text-[11px] sm:text-[12px] font-bold text-gray-300 text-center tracking-wider border-r border-[#111827]">화재 시 부하</th>
                                </tr>
                                <tr className="bg-[#030712] border-b border-[#111827]">
                                    <th className="px-2 py-2.5 text-[11px] sm:text-[12px] font-bold text-gray-400 text-center tracking-tight border-r border-[#111827]">정전 시 필요</th>
                                    <th className="px-2 py-2.5 text-[11px] sm:text-[12px] font-bold text-gray-400 text-center tracking-tight border-r border-[#111827]">비상 부하</th>
                                    <th className="px-2 py-2.5 text-[11px] sm:text-[12px] font-bold text-gray-400 text-center tracking-tight border-r border-[#111827]">소방 부하</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-900">
                                {Array.from({ length: 8 }).map((_, i) => (
                                    <tr key={i} className="hover:bg-blue-500/10 transition-colors group/row">
                                        <td className="px-2 py-2 text-center text-[12px] sm:text-[13px] text-gray-300 border-r border-gray-900 group-hover/row:text-white">{data.outageNeeded[i]}</td>
                                        <td className="px-2 py-2 text-center text-[12px] sm:text-[13px] text-gray-300 border-r border-gray-900 group-hover/row:text-white">{data.emergency[i]}</td>
                                        <td className="px-2 py-2 text-center text-[12px] sm:text-[13px] text-gray-300 border-r border-gray-900 last:border-r-0 group-hover/row:text-white">{data.firefighting[i]}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="mt-24 pt-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            <div className="mb-8">
                <h2 className="text-lg sm:text-xl font-bold text-white/90 tracking-widest border-l-4 border-blue-600 pl-4">
                    비상용 예비발전설비 연결 부하의 구분
                </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <LoadTable title="전동기 부하" data={motorLoads} />
                <LoadTable title="전동기 이외 부하" data={nonMotorLoads} isLast={true} />
            </div>

            <div className="mt-6 space-y-1.5 px-2">
                <p className="text-[11px] text-gray-500 font-medium">* 표의 부하는 예시이며, 건축물의 적용되는 법령에 따라 부하를 달리 적용할 수 있다.</p>
                <p className="text-[11px] text-gray-500 font-medium">* 화재 시 부하 : 소방부하 + 비상부하</p>
                <p className="text-[11px] text-gray-500 font-medium">* 정전 시 부하 : 정전 시 필요 부하 + 비상부하</p>
            </div>
        </div>
    );
};

/**
 * 5. GeneratorSetTable (CSV Data)
 * 구글 시트 기반 발전기 급배기 사양표
 */
export const GeneratorSetTable = () => {
    const [data, setData] = useState([]);

    useEffect(() => {
        fetch("/db/GEN.csv")
            .then(res => res.text())
            .then(csv => {
                Papa.parse(csv, {
                    complete: (results) => {
                        const allData = results.data;
                        const startIndex = allData.findIndex(row => 
                            row[0]?.toString().trim().includes("Diesel Generator Air Intake/Exhaust")
                        );
                        if (startIndex !== -1) {
                            // Extract the section
                            let sectionRows = [];
                            for (let i = startIndex + 1; i < allData.length; i++) {
                                const firstCell = allData[i][0]?.toString().trim();
                                if (firstCell && firstCell.startsWith('*')) break;
                                sectionRows.push(allData[i]);
                            }
                            
                            // Row 0: "1) 1800RPM(60Hz)"
                            // Row 1: Header row
                            if (sectionRows.length > 1) {
                                setData(sectionRows.slice(1));
                            }
                        }
                    }
                });
            })
            .catch(err => console.error("CSV Load Error:", err));
    }, []);

    if (data.length === 0) return null;

    const headers = data[0];
    const rows = data.slice(1);

    return (
        <div className="mt-24 pt-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            <div className="mb-8">
                <h2 className="text-lg sm:text-xl font-bold text-white/90 tracking-widest border-l-4 border-blue-600 pl-4">
                    Diesel Generator Air Intake/Exhaust
                </h2>
            </div>

            <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2 px-2">
                    <Activity size={16} className="text-blue-500" />
                    <h3 className="text-sm font-bold text-gray-300 tracking-widest uppercase">
                        발전기 용량별 급기 및 배기
                    </h3>
                </div>

            <div className="border border-gray-900 bg-black relative overflow-hidden group">
                <TheoryCornerBorders />
                <div className="overflow-x-auto custom-scrollbar">
                    <div className="p-2">
                        <table className="w-full border-collapse table-fixed min-w-[800px]">
                            <thead>
                                <tr className="bg-[#030712] border-b border-[#111827]">
                                    <th className="px-2 py-3 text-[11px] sm:text-[12px] font-bold text-gray-300 text-center border-r border-[#111827]">용량 (kW)</th>
                                    <th className="px-2 py-3 text-[11px] sm:text-[12px] font-bold text-gray-300 text-center border-r border-[#111827]">모델</th>
                                    <th className="px-2 py-3 text-[11px] sm:text-[12px] font-bold text-gray-300 text-center border-r border-[#111827]">엔진</th>
                                    <th colSpan="2" className="px-2 py-3 text-[11px] sm:text-[12px] font-bold text-gray-300 text-center border-r border-[#111827]">배기 (Exhaust)</th>
                                    <th colSpan="2" className="px-2 py-3 text-[11px] sm:text-[12px] font-bold text-gray-300 text-center">급기 (Intake)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-900">
                                {rows.filter(row => row[0]).map((row, i) => (
                                    <tr key={i} className="hover:bg-blue-500/10 transition-colors group/row">
                                        <td className="px-2 py-2 text-center text-[12px] sm:text-[13px] text-white font-bold bg-[#030712] border-r border-gray-900">
                                            {row[1]?.toString().replace(/kW/gi, '').trim()}
                                        </td>
                                        <td className="px-2 py-2 text-center text-[12px] sm:text-[13px] text-gray-200 border-r border-gray-900 group-hover/row:text-white">{row[0]}</td>
                                        <td className="px-2 py-2 text-center text-[12px] sm:text-[13px] text-gray-200 border-r border-gray-900 group-hover/row:text-white">{row[2]}</td>
                                        <td className="px-2 py-2 text-center text-[12px] sm:text-[13px] text-gray-200 border-r border-gray-900 group-hover/row:text-white">{row[3]}</td>
                                        <td className="px-2 py-2 text-center text-[12px] sm:text-[13px] text-gray-200 border-r border-gray-900 group-hover/row:text-white">{row[4]}</td>
                                        <td className="px-2 py-2 text-center text-[12px] sm:text-[13px] text-gray-200 border-r border-gray-900 group-hover/row:text-white">{row[5]}</td>
                                        <td className="px-2 py-2 text-center text-[12px] sm:text-[13px] text-gray-200 group-hover/row:text-white">{row[6]}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            </div>
            <p className="mt-3 text-[11px] text-gray-500 font-medium px-2">
                * 위 표는 두산엔진 기준이며, 사양에 따라 변경될 수 있음. (1800RPM)
            </p>
        </div>
    );
};

// 기본 내보내기는 유지 (이전 호환성용)
export default GeneratorTheoryMain;

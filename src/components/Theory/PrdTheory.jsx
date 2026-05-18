import React from 'react';
import { Shield, Zap, Info, ArrowRight, CheckCircle2, AlertTriangle, ListChecks, Layers, Activity } from 'lucide-react';

const PrdTheory = () => {
    const systems = [
        {
            title: "1. PF + S (Power Fuse + Switch)",
            subtitle: "전력퓨즈 + 개폐기 조합",
            description: "가장 전통적이고 간단한 조합으로, 경제적이고 구조가 단순하여 소규모 수전설비에 많이 쓰임.",
            features: [
                { icon: <Zap size={14} className="text-yellow-500" />, text: "PF(Power Fuse): 단락사고 시 빠르게 차단하여 계통 보호" },
                { icon: <SettingsIcon size={14} className="text-blue-500" />, text: "S(Switch): LBS, AISS 등을 평상시 부하 개폐용으로 사용" }
            ],
            pros: ["경제적인 초기 투자비", "간단한 구조 및 점유면적 최소화"],
            cons: ["퓨즈 소손 시 수동 교체 필요", "결상 사고 시 모터 소손 등 위험 (수동 차단 필요)"],
            color: "border-blue-500/30",
            bg: "bg-blue-500/5",
            icon: <Shield size={24} className="text-blue-500" />
        },
        {
            title: "2. PF + C (Power Fuse + Circuit Breaker)",
            subtitle: "전력퓨즈 + 차단기 조합",
            description: "보호 협조가 정밀하고 신뢰도가 높아 대용량 설비나 중요한 공정에서 주로 채택함.",
            features: [
                { icon: <Zap size={14} className="text-yellow-500" />, text: "PF가 앞단에서 '한류 특성'을 발휘해 차단기를 강력하게 보호" },
                { icon: <Activity size={14} className="text-red-500" />, text: "차단기(VCB 등)는 과부하 및 일반 사고를 정밀하게 차단" }
            ],
            pros: ["매우 높은 신뢰성 및 정밀한 보호 협조", "차단기의 재투입 용이성"],
            cons: ["비교적 높은 설치 비용", "넓은 설치 공간 필요"],
            color: "border-purple-500/30",
            bg: "bg-purple-500/5",
            icon: <Layers size={24} className="text-purple-500" />
        },
        {
            title: "3. S + PF (Switch + Power Fuse)",
            subtitle: "개폐기 + 전력퓨즈 조합 (현대적 방식)",
            description: "현재 22.9kV 계통에서 가장 흔히 볼 수 있는 방식. 사고 시 3상을 동시 차단 가능.",
            features: [
                { icon: <ListChecks size={14} className="text-green-500" />, text: "스트라이커(Striker) 장치가 퓨즈 소손 시 개폐기를 강제 개방" },
                { icon: <CheckCircle2 size={14} className="text-blue-500" />, text: "AISS + PF 연동: 결상 검출 시 컨트롤러가 즉시 트립(Open)" }
            ],
            pros: ["결상 사고 방지 (3상 일괄 차단)", "현대적인 소형화 및 신뢰성 확보"],
            cons: ["PF 소손 시 퓨즈 교체 비용 발생"],
            color: "border-green-500/30",
            bg: "bg-green-500/5",
            icon: <Zap size={24} className="text-green-500" />
        }
    ];

    const flows = [
        {
            type: "정식수전설비 (PF + C형)",
            items: ["LBS (부하개폐기)", "LA (피뢰기)", "PF (전력퓨즈)", "MOF (계기용변성기)", "VCB (진공차단기)", "SA (서지흡수기)", "TR (변압기)", "ACB (기중차단기)"],
            badge: "1,000kVA 이상 의무",
            color: "from-blue-600 to-blue-900"
        },
        {
            type: "간이수전설비 (S + PF형)",
            items: ["ASS/AISS (자동고장구분개폐기)", "LA (피뢰기)", "PF (전력퓨즈)", "MOF (계기용변성기)", "TR (변압기)", "ACB (기중차단기)"],
            badge: "1,000kVA 미만 적용 가능",
            color: "from-gray-700 to-gray-900"
        }
    ];

    return (
        <div className="mb-12 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header Section */}
            <div className="relative">
                <div className="flex items-stretch gap-3 mb-2">
                    <div className="w-1 sm:w-1.5 bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.4)] self-stretch min-h-[1.2rem] sm:min-h-[1.5rem]"></div>
                    <h2 className="text-lg sm:text-xl font-bold text-white tracking-widest uppercase py-0.5">
                        System Flow of 22.9kV Receiving Facilities
                    </h2>
                </div>
            </div>

            {/* Systems Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {systems.map((sys, idx) => (
                    <div key={idx} className={`border ${sys.color} ${sys.bg} p-6 relative overflow-hidden group transition-all duration-300 hover:border-gray-500/50`}>
                        {/* Decorative background icon */}
                        <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            {React.cloneElement(sys.icon, { size: 120 })}
                        </div>

                        <div className="relative z-10 space-y-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-lg font-bold text-white mb-1">{sys.title}</h3>
                                    <p className="text-xs text-blue-400 font-bold tracking-widest uppercase mb-3">{sys.subtitle}</p>
                                </div>
                                <div className="p-2 bg-black/40 border border-white/5 rounded-lg shadow-inner">
                                    {sys.icon}
                                </div>
                            </div>

                            <p className="text-sm text-gray-400 leading-relaxed min-h-[3rem]">
                                {sys.description}
                            </p>

                            <div className="space-y-2 py-2">
                                {sys.features.map((feat, fidx) => (
                                    <div key={fidx} className="flex items-start gap-2 text-xs text-gray-300">
                                        <div className="mt-0.5 shrink-0">{feat.icon}</div>
                                        <span>{feat.text}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/5">
                                <div>
                                    <span className="text-[10px] text-green-500 font-bold uppercase tracking-tighter block mb-2">● Pros</span>
                                    <ul className="text-[11px] text-gray-400 space-y-1">
                                        {sys.pros.map((p, i) => <li key={i} className="flex gap-1">• <span>{p}</span></li>)}
                                    </ul>
                                </div>
                                <div>
                                    <span className="text-[10px] text-red-500 font-bold uppercase tracking-tighter block mb-2">● Cons</span>
                                    <ul className="text-[11px] text-gray-400 space-y-1">
                                        {sys.cons.map((c, i) => <li key={i} className="flex gap-1">• <span>{c}</span></li>)}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Regulations & Flow */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
                {/* 1,000kVA Threshold Notice */}
                <div className="xl:col-span-4 flex flex-col justify-center border border-yellow-500/20 bg-yellow-500/5 p-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10 rotated-12">
                        <Info size={120} />
                    </div>
                    <div className="relative z-10 flex flex-col h-full">
                        <div className="flex items-center gap-2 mb-4">
                            <AlertTriangle className="text-yellow-500" size={20} />
                            <h3 className="text-lg font-bold text-yellow-500 tracking-tight">수전설비 구분 기준 (1,000kVA)</h3>
                        </div>
                        <div className="space-y-4 flex-grow">
                            <div className="p-4 bg-black/40 border border-yellow-500/10">
                                <p className="text-sm text-gray-300 leading-relaxed">
                                    내선규정 및 한전 지침상 <span className="text-white font-bold underline decoration-yellow-500 underline-offset-4">1,000kVA</span>를 기준으로 설비 형식이 결정됨.
                                </p>
                            </div>
                            <ul className="space-y-3">
                                <li className="flex items-start gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 mt-1.5 shadow-[0_0_5px_rgba(234,179,8,0.5)]"></div>
                                    <p className="text-sm text-gray-400">
                                        <span className="text-gray-200 font-bold">1,000kVA 미만</span>: 간이수전설비 적용. 공사비가 저렴하고 점유 면적이 작은 <span className="text-green-500">S + PF</span>이 유리.
                                    </p>
                                </li>
                                <li className="flex items-start gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 mt-1.5 shadow-[0_0_5px_rgba(234,179,8,0.5)]"></div>
                                    <p className="text-sm text-gray-400">
                                        <span className="text-gray-200 font-bold">1,000kVA 이상</span>: <span className="text-blue-500 font-bold">정식수전설비 의무 적용</span>. 대용량 보호 방식인 <span className="text-blue-500">PF + C 조합</span> 채택 필수.
                                    </p>
                                </li>
                                <li className="flex items-start gap-2 pt-2 border-t border-yellow-500/10 mt-2">
                                    <Info className="text-yellow-500/60 shrink-0 mt-0.5" size={14} />
                                    <div className="text-[11px] text-gray-400 leading-relaxed italic">
                                        <p>변압기 1,000kVA 이상 시 고장전류가 매우 크기 때문에 단순 ASS로는 보호 불충분함.</p>
                                        <p className="mt-1">대용량 수용가에서 ASS만 사용 시 한전 차단기가 동반 트립될 위험이 있어, LBS + PF 구조가 유리함.</p>
                                    </div>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Flow Sequences */}
                <div className="xl:col-span-8 space-y-4">
                    {flows.map((flow, fidx) => (
                        <div key={fidx} className="bg-gray-900/40 border border-gray-800 p-6 overflow-hidden relative group">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-1 h-5 bg-blue-500"></div>
                                    <h4 className="text-md font-bold text-white tracking-widest">{flow.type} 계통 흐름</h4>
                                </div>
                                <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                                    {flow.badge}
                                </span>
                            </div>

                            <div className="relative">
                                {/* Horizontal line for desktop */}
                                <div className="hidden md:block absolute top-[1.375rem] left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-gray-700 to-transparent z-0"></div>

                                <div className="flex flex-col md:flex-row md:justify-between gap-8 md:gap-2 relative z-10 overflow-x-auto pb-4 custom-scrollbar">
                                    {flow.items.map((item, iidx) => (
                                        <div key={iidx} className="flex flex-row md:flex-col items-center gap-3 md:gap-4 group/item">
                                            <div className="flex flex-col items-center">
                                                <div className={`w-11 h-11 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all duration-300 ${iidx === 0 ? "border-blue-500 text-blue-500 bg-blue-500/10" :
                                                    iidx === flow.items.length - 1 ? "border-green-500 text-green-500 bg-green-500/10" :
                                                        "border-gray-700 text-gray-500 bg-black group-hover/item:border-gray-500 group-hover/item:text-gray-300"
                                                    }`}>
                                                    {iidx + 1}
                                                </div>
                                                {/* Vertical line for mobile */}
                                                {iidx < flow.items.length - 1 && (
                                                    <div className="md:hidden w-0.5 h-4 bg-gray-800 my-1"></div>
                                                )}
                                            </div>
                                            <div className="text-center md:flex md:flex-col items-center">
                                                <div className="text-[12px] font-bold text-gray-300 whitespace-nowrap group-hover/item:text-white transition-colors">
                                                    {item}
                                                </div>
                                            </div>
                                            {/* Arrow for desktop */}
                                            {iidx < flow.items.length - 1 && (
                                                <div className="hidden md:flex absolute -right-4 top-[1.375rem] items-center">
                                                    {/* Arrow could go here if needed, but the current layout is cleaner without them */}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="mt-4 text-[10px] text-gray-400 italic">
                                * 주의: 현장 여건이나 설계 지침에 따라 설비 또는 순서는 변경 될 수 있음.
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Header Section 2: LA vs SA */}
            <div className="relative pt-12 border-t border-gray-900">
                <div className="flex items-stretch gap-3 mb-2">
                    <div className="w-1 sm:w-1.5 bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.4)] self-stretch min-h-[1.2rem] sm:min-h-[1.5rem]"></div>
                    <h2 className="text-lg sm:text-xl font-bold text-white tracking-widest uppercase py-0.5">
                        Lightning Arrester vs. Surge Absorber
                    </h2>
                </div>
            </div>

            {/* LA vs SA Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* LA Card */}
                <div className="border border-blue-500/30 bg-blue-500/5 p-6 space-y-4 relative overflow-hidden group">
                    <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Zap size={120} className="text-blue-500" />
                    </div>
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-lg font-bold text-white">LA (Lightning Arrester, 피뢰기)</h3>
                            <div className="p-2 bg-black/40 border border-white/5 rounded-lg shadow-inner">
                                <Zap size={24} className="text-blue-500" />
                            </div>
                        </div>
                        <p className="text-sm font-bold text-blue-400 mb-4 tracking-tight">● 뇌서지(낙뢰)로부터 선로 전체를 보호목적</p>
                        <ul className="space-y-3">
                            <li className="flex items-start gap-2 text-sm text-gray-400">
                                <Info size={14} className="mt-1 text-blue-500 shrink-0" />
                                <span>정격전압: 22.9kV 계통의 피뢰기 정격전압은 18kV를 사용하도록 규정.</span>
                            </li>
                            <li className="flex items-start gap-2 text-sm text-gray-400">
                                <CheckCircle2 size={14} className="mt-1 text-green-500 shrink-0" />
                                <span>폴리머형: 자기형 대비 가볍고 내오염성 우수, 파손 시 파편 비산이 없어 안전함.</span>
                            </li>
                        </ul>
                        <div className="mt-6 space-y-2">
                            <div className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-2">공칭방전전류 등급별 적용</div>
                            {[
                                { label: "18kV 2.5kA", text: "배전 선로 내의 소용량 기기 보호용" },
                                { label: "18kV 5kA", text: "변압기 용량 합계 2,500kVA 이하 일반 수용가 사양" },
                                { label: "18kV 10kA", text: "2,500kVA 초과 대용량 수용가, 낙뢰 빈발 지역 등" }
                            ].map((r, i) => (
                                <div key={i} className="flex items-center gap-3 p-2 bg-black/30 border border-white/5">
                                    <span className="text-[11px] font-bold text-blue-400 w-20 shrink-0">{r.label}</span>
                                    <span className="text-[11px] text-gray-300">{r.text}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* SA Card */}
                <div className="border border-purple-500/30 bg-purple-500/5 p-6 space-y-4 relative overflow-hidden group">
                    <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Zap size={120} className="text-purple-500" />
                    </div>
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-lg font-bold text-white">SA (Surge Absorber, 서지흡수기)</h3>
                            <div className="p-2 bg-black/40 border border-white/5 rounded-lg shadow-inner">
                                <Zap size={24} className="text-purple-500" />
                            </div>
                        </div>
                        <p className="text-sm font-bold text-purple-400 mb-4 tracking-tight">● 개폐서지(VCB 동작 충격전압)로부터 특정 기기 보호목적</p>
                        <ul className="space-y-3">
                            <li className="flex items-start gap-2 text-sm text-gray-400">
                                <AlertTriangle size={14} className="mt-1 text-red-500 shrink-0" />
                                <span>SA 설치 필수: 차단기(VCB)와 건식 기기(몰드/건식변압기, 전동기) 사이.</span>
                            </li>
                            <li className="flex items-start gap-2 text-sm text-gray-400">
                                <Info size={14} className="mt-1 text-purple-500 shrink-0" />
                                <span>VCB 차단 시 발생하는 높은 개폐서지가 절연 내력이 낮은 건식 기기에 직접 전달되는 것을 방지.</span>
                            </li>
                        </ul>
                        <div className="mt-6 p-4 bg-purple-500/10 border border-purple-500/20 rounded-md">
                            <p className="text-xs text-purple-300 leading-relaxed italic">
                                * VCB는 차단 능력이 매우 뛰어나지만 차단 시 높은 개폐서지를 발생시키며, 몰드/건식 기기는 유입식에 비해 절연 내력(BIL)이 낮아 보호가 필수적임.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Comparison Table */}
            <div className="border border-gray-900 bg-black relative overflow-hidden group">
                <div className="border-b border-gray-900 px-6 py-3 bg-gray-900/20">
                    <h3 className="text-gray-300 font-bold text-[13px] tracking-widest uppercase">LA vs SA Comparison Table</h3>
                </div>
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full border-collapse text-[12px] sm:text-[13px]">
                        <thead>
                            <tr className="border-b border-gray-900 bg-gray-900/30">
                                <th className="px-6 py-4 text-left font-bold text-gray-500 w-[20%] sm:w-[15%]">구분</th>
                                <th className="px-6 py-4 text-left font-bold text-blue-400 w-[40%] sm:w-[42.5%]">피뢰기 (LA)</th>
                                <th className="px-6 py-4 text-left font-bold text-purple-400 w-[40%] sm:w-[42.5%]">서지흡수기 (SA)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-900/50">
                            {[
                                { label: "주요 보호 원인", la: "낙뢰 (뇌서지), 외부 이상전압", sa: "차단기 동작 (개폐서지), 내부 이상전압" },
                                { label: "설치 위치", la: "전력계통의 인입구 (MOF 전단)", sa: "VCB 2차측과 보호기기(변압기 등) 사이" },
                                { label: "주요 보호 대상", la: "수전 설비 전체", sa: "몰드변압기, 건식변압기, 고압 전동기" },
                                { label: "정격 전압", la: "22.9kV 계통 기준 18kV", sa: "22.9kV 계통 기준 18kV (LA와 동일)" },
                                { label: "공칭방전전류", la: "2.5kA / 5kA / 10kA", sa: "주로 5kA" }
                            ].map((row, i) => (
                                <tr key={i} className="hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-4 font-bold text-gray-500 bg-gray-900/5">{row.label}</td>
                                    <td className="px-6 py-4 text-gray-300">{row.la}</td>
                                    <td className="px-6 py-4 text-gray-300">{row.sa}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// Helper component for SettingsIcon since it was missing but used
const SettingsIcon = ({ size, className }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
    </svg>
);

export default PrdTheory;

import React from 'react';
import { Zap, Battery, Activity, Shield, Info, ListChecks, Cpu, Clock, ZapOff } from 'lucide-react';
import { UPS_UNIT_SIZE_DATA, BATTERY_CABINET_SIZE_DATA } from '../../utils/upsData';

const upsUnitSizeData = UPS_UNIT_SIZE_DATA.map(d => ({ ...d, kva: String(d.kva) }));
const batteryCabinetSizeData = BATTERY_CABINET_SIZE_DATA.map(d => ({ ...d, kva: String(d.kva) }));

const Sub = ({ children }) => (
    <sub className="text-[0.7em] leading-none ml-0.5">{children}</sub>
);

const CornerBorders = () => (
    <>
        <div className="corner-tl border-gray-800" />
        <div className="corner-tr border-gray-800" />
        <div className="corner-bl border-gray-800" />
        <div className="corner-br border-gray-800" />
    </>
);

const SectionHeader = ({ title, barColor = "bg-blue-600", showIcon = false, icon: Icon }) => (
    <div className="relative mb-8">
        <div className="flex items-stretch gap-3 mb-2">
            <div className={`w-1 sm:w-1.5 ${barColor} shadow-[0_0_10px_rgba(37,99,235,0.4)] self-stretch min-h-[1.2rem] sm:min-h-[1.5rem]`}></div>
            <div className="flex items-center gap-2">
                {showIcon && Icon && <Icon size={18} className="text-blue-500" />}
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-widest uppercase py-0.5">
                    {title}
                </h2>
            </div>
        </div>
    </div>
);

const FormulaCard = ({ title, formula, variables, icon: Icon = Zap, color = "blue" }) => {
    const colorMap = {
        blue: "from-blue-500/20 to-transparent border-blue-500/30",
        yellow: "from-yellow-500/20 to-transparent border-yellow-500/30",
        green: "from-green-500/20 to-transparent border-green-500/30",
        purple: "from-purple-500/20 to-transparent border-purple-500/30",
        orange: "from-orange-500/20 to-transparent border-orange-500/30"
    };

    return (
        <div className="relative group">
            <div className={`absolute -inset-0.5 bg-gradient-to-r ${colorMap[color].split(' ')[0]} rounded-xl blur opacity-75 group-hover:opacity-100 transition duration-1000`}></div>
            <div className="relative bg-black border border-gray-800 p-6 sm:p-8 rounded-xl overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-5"><Icon size={140} /></div>
                <div className="flex flex-col items-center justify-center space-y-6 py-2">
                    <div className="text-gray-400 text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em]">{title}</div>

                    {/* formula area */}
                    <div className="w-full overflow-x-auto scrollbar-hide py-3 px-2">
                        <div className="flex items-center justify-center text-[22px] sm:text-4xl font-mono text-white tracking-tighter whitespace-nowrap min-w-max">
                            {formula}
                        </div>
                    </div>

                    {/* variables evenly distributed across width */}
                    <div className="flex flex-wrap justify-between gap-x-4 gap-y-4 w-full pt-6 border-t border-gray-800/60 px-2 sm:px-4 md:px-8">
                        {variables.map((v, i) => (
                            <div key={i} className="flex flex-col items-center text-center px-2 min-w-[80px] sm:min-w-[100px] flex-1">
                                <span className={`text-base font-bold ${v.color || 'text-blue-500'} mb-1`}>
                                    {v.label}
                                </span>
                                <span className="text-[10px] text-[#d1d5db] font-medium leading-tight max-w-[130px]">{v.desc}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

const TableHeader = ({ children }) => (
    <th className="px-2 py-3 text-[11px] sm:text-[12px] font-bold text-gray-300 text-center tracking-wider border-r last:border-r-0 border-[#111827] bg-[#030712]">
        {children}
    </th>
);

const TableCell = ({ children, isHeader = false }) => (
    <td className={`px-2 py-2 text-center text-[12px] sm:text-[13px] border-r last:border-r-0 border-gray-900 ${isHeader ? 'text-gray-400 bg-gray-900/10' : 'text-gray-300'} group-hover/row:text-white`}>
        {children}
    </td>
);

const UpsTheory = () => {
    // Colors based on user preference (Generator style)
    const colors = {
        result: "text-blue-500",
        sum: "text-white",
        kapha: "text-purple-400",
        eta: "text-green-400",
        maintenance: "text-blue-400",
        capacity: "text-yellow-500",
        current: "text-green-400",
        voltage: "text-red-400",
        cos: "text-blue-500",
        cell: "text-orange-400"
    };

    const upsCapacityVars = [
        { label: <span>P<Sub>UPS</Sub></span>, desc: "최대 수요 전력 [kVA]", color: colors.result },
        { label: <span>P<Sub>n</Sub></span>, desc: "각 부하용량", color: colors.sum },
        { label: <span>D<Sub>n</Sub></span>, desc: "수용률의 합", color: colors.sum },
        { label: "η", desc: "종합효율", color: colors.eta },
        { label: "α", desc: "여유율", color: colors.kapha }
    ];

    const batteryCapacityVars = [
        { label: "C", desc: "축전지 용량 [Ah]", color: colors.capacity },
        { label: "L", desc: "보수율 (일반적으로 0.8)", color: colors.maintenance },
        { label: "K", desc: "용량환산 시간계수", color: colors.kapha },
        { label: "I", desc: "방전전류 (A)", color: colors.current }
    ];

    const dischargeCurrentVars = [
        { label: "I", desc: "방전전류 [A]", color: colors.current },
        { label: "P", desc: "축전지 출력의 피상전력", color: colors.sum },
        { label: "cosθ", desc: "부하역률", color: colors.cos },
        { label: <span>V<Sub>p</Sub></span>, desc: "축전지 셀당 방전종지전압", color: colors.voltage },
        { label: "N", desc: "Block 또는 Cell수량", color: colors.cell },
        { label: <span>η<Sub>inv</Sub></span>, desc: "인버터 효율", color: colors.eta }
    ];

    const cellCountVars = [
        { label: "N", desc: "축전지 수량 [Cell]", color: colors.cell },
        { label: <span>V<Sub>DC</Sub></span>, desc: "UPS 직류전원 정격전압 [V]", color: colors.cos },
        { label: <span>V<Sub>B</Sub></span>, desc: "축전지 공칭전압 [V/Cell]", color: colors.sum }
    ];

    const kCoefficientData = [
        { type: "AHH", minV: "1.10", values: ["0.25", "0.28", "0.35", "0.44", "0.57", "0.70", "1.15", "-"] },
        { type: "AHH", minV: "1.06", values: ["0.19", "0.21", "0.28", "0.35", "0.50", "0.65", "1.08", "-"] },
        { type: "AHH", minV: "1.00", values: ["0.14", "0.16", "0.22", "0.30", "0.45", "0.60", "1.04", "-"] },
        { type: "AH", minV: "1.10", values: ["0.30", "0.46", "0.56", "0.66", "0.87", "1.04", "1.56", "2.60"] },
        { type: "AH", minV: "1.06", values: ["0.24", "0.33", "0.45", "0.53", "0.70", "0.85", "1.40", "2.45"] },
        { type: "AH", minV: "1.00", values: ["0.20", "0.27", "0.37", "0.45", "0.60", "0.77", "1.30", "2.30"] },
        { type: "AMH", minV: "1.10", values: ["0.67", "0.84", "1.00", "1.10", "1.23", "1.37", "1.90", "3.00"] },
        { type: "AMH", minV: "1.06", values: ["0.57", "0.71", "0.85", "0.93", "1.11", "1.15", "1.65", "2.70"] },
        { type: "AMH", minV: "1.00", values: ["0.46", "0.58", "0.69", "0.75", "0.84", "0.96", "1.40", "2.40"] },
        { type: "AM", minV: "1.10", values: ["0.97", "1.23", "1.52", "1.70", "1.92", "2.10", "2.75", "3.80"] },
        { type: "AM", minV: "1.06", values: ["0.75", "0.92", "1.15", "1.28", "1.50", "1.65", "2.23", "3.30"] },
        { type: "AM", minV: "1.00", values: ["0.63", "0.76", "0.95", "1.05", "1.26", "1.43", "1.90", "2.90"] },
        { type: "CS", minV: "1.80", values: ["-", "1.50", "1.60", "1.75", "2.05", "2.40", "3.10", "4.40"] },
        { type: "CS", minV: "1.70", values: ["-", "0.75", "0.92", "1.25", "1.50", "1.85", "2.60", "3.95"] },
        { type: "CS", minV: "1.60", values: ["-", "0.63", "0.75", "1.05", "1.44", "1.70", "2.40", "3.70"] },
        { type: "IHS", minV: "1.80", values: ["0.85", "0.88", "0.95", "1.05", "1.30", "1.55", "2.20", "3.40"] },
        { type: "IHS", minV: "1.70", values: ["0.56", "0.58", "0.65", "0.75", "1.00", "1.24", "1.90", "3.05"] },
        { type: "IHS", minV: "1.60", values: ["0.44", "0.47", "0.53", "0.63", "0.87", "1.10", "1.75", "2.90"] },
    ];




    return (
        <div className="mb-12 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Main Header */}
            <div className="relative">
                <div className="flex items-stretch gap-3 mb-2">
                    <div className="w-1 sm:w-1.5 bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.4)] self-stretch min-h-[1.2rem] sm:min-h-[1.5rem]"></div>
                    <h2 className="text-lg sm:text-xl font-bold text-white tracking-widest uppercase py-0.5">
                        UPS Capacity Calculation & Definitions
                    </h2>
                </div>
                <p className="text-gray-500 text-[11px] sm:text-xs font-medium tracking-tight ml-4 sm:ml-4.5">
                    UPS 용량 산정을 위한 주요 용어 정의 및 계산 공식 가이드
                </p>
            </div>

            {/* Sector 1: UPS Capacity */}
            <section>
                <SectionHeader title="UPS 최대 수요 전력" barColor="bg-blue-600" />
                <FormulaCard
                    title="UPS CAPACITY FORMULA"
                    formula={
                        <div className="flex items-center gap-x-2 sm:gap-x-4">
                            <span className={`${colors.result} font-bold`}>P<Sub>UPS</Sub></span>
                            <span className="text-gray-500">=</span>
                            <span className="text-gray-600 px-1">[</span>
                            <span className={colors.sum}>Σ(P<Sub>n</Sub> × D<Sub>n</Sub>)</span>
                            <span className="text-gray-600">×</span>
                            <span className={`${colors.kapha} italic`}>α</span>
                            <span className="text-gray-600 px-1">]</span>
                            <span className="text-gray-600">÷</span>
                            <span className={`${colors.eta} italic`}>η</span>
                        </div>
                    }
                    variables={upsCapacityVars}
                    icon={ZapOff}
                    color="blue"
                />

                <div className="mt-6 bg-black/40 border border-gray-900 rounded-xl p-6 relative overflow-hidden group hover:border-blue-500/30 transition-all duration-500">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl -mr-16 -mt-16 group-hover:bg-blue-500/10 transition-colors"></div>

                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-1.5 h-4 bg-blue-500 rounded-full"></div>
                        <h4 className="text-sm font-bold text-white uppercase tracking-wider italic">종합효율 (Overall Efficiency)</h4>
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-4">
                            <p className="text-[13px] text-gray-400 leading-relaxed">
                                UPS 내부의 정류기, 인버터, 변압기 등 모든 구성 요소에서 발생하는 손실을 제외하고, <span className="text-white font-semibold">실제로 부하에 공급되는 유효한 전력의 비율</span>을 의미한다.
                            </p>
                            <p className="text-[13px] text-gray-400 leading-relaxed">
                                AC(입력) → DC(정류/배터리) → AC(출력)의 <span className="text-blue-400 font-medium">전체 변환 과정</span>을 통합하여 계산하기 때문에 '종합' 효율이라는 용어를 사용한다.
                            </p>
                        </div>

                        <div className="bg-gray-950/50 rounded-xl p-6 border border-gray-800/50 flex flex-col items-center justify-center overflow-x-auto">
                            <div className="flex items-center gap-3 text-[13px] sm:text-[14px] font-semibold tracking-tight min-w-max">
                                <span className="text-white bg-gray-800 px-2 py-1 rounded text-[11px] uppercase tracking-widest mr-2">Formula</span>
                                <span className="text-green-400 text-xl font-bold italic mr-1">η</span>
                                <span className="text-gray-600 text-xl">=</span>
                                <div className="flex flex-col items-center px-4">
                                    <span className="text-white pb-1 border-b border-gray-700 w-full text-center px-4">Output Power</span>
                                    <span className="text-white pt-1 w-full text-center">Input Power</span>
                                </div>
                                <span className="text-gray-600 text-xl">×</span>
                                <span className="text-white text-base font-bold">100 (%)</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Sector 2-1: Battery Capacity */}
            <section>
                <SectionHeader title="UPS 축전지 용량 산정" barColor="bg-yellow-500" />
                <FormulaCard
                    title="BATTERY CAPACITY (Ah)"
                    formula={
                        <div className="flex items-center gap-x-2 sm:gap-x-4">
                            <span className={`${colors.capacity} font-bold`}>C</span>
                            <span className="text-gray-500">=</span>
                            <span className="text-gray-600 px-1">[</span>
                            <span className="text-white">1</span>
                            <span className="text-gray-600">÷</span>
                            <span className={`${colors.maintenance} italic`}>L</span>
                            <span className="text-gray-600 px-1">]</span>
                            <span className="text-gray-600">×</span>
                            <span className="text-gray-600 px-1">[</span>
                            <span className="text-white">Σ(</span>
                            <span className={`${colors.kapha} italic`}>K<Sub>n</Sub></span>
                            <span className="text-gray-600">×</span>
                            <span className={`${colors.current} italic`}>ΔI<Sub>n</Sub></span>
                            <span className="text-white">)</span>
                            <span className="text-gray-600 px-1">]</span>
                        </div>
                    }
                    variables={batteryCapacityVars}
                    icon={Zap}
                    color="yellow"
                />

                <div className="mt-6 bg-black/40 border border-gray-900 rounded-xl p-6 relative overflow-hidden group hover:border-yellow-500/30 transition-all duration-500">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 blur-3xl -mr-16 -mt-16 group-hover:bg-yellow-500/10 transition-colors"></div>

                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-1.5 h-4 bg-yellow-500 rounded-full"></div>
                        <h4 className="text-sm font-bold text-white uppercase tracking-wider italic">보수율 (Maintenance Factor)</h4>
                    </div>

                    <div className="space-y-4">
                        <p className="text-[13px] text-gray-400 leading-relaxed">
                            국제 표준 및 국내 기준에서 권장하는 <span className="text-white font-semibold">표준 노화 계수(Aging Factor)</span>에 근거하여, 축전지는 시간이 지나면서 화학적 반응 효율이 떨어져 용량이 감소한다. 일반적으로 축전지 용량이 초기 정격의 80% 이하로 떨어지면 교체를 권장한다.
                        </p>
                        <p className="text-[13px] text-gray-400 leading-relaxed">
                            여유 확보 측면으로 <span className="text-yellow-500 font-bold italic">0.8</span>이라는 수치는 축전지가 수명을 다하는 시점(80% 용량)에서도 설계된 부하를 충분히 견딜 수 있도록 초기 용량을 약 <span className="text-white font-semibold">25%(1/0.8=1.25)</span> 더 크게 산정하기 위한 보정 계수임.
                        </p>
                    </div>
                </div>

                <div className="mt-4 bg-black/40 border border-gray-900 rounded-xl p-6 relative overflow-hidden group hover:border-yellow-500/30 transition-all duration-500">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 blur-3xl -mr-16 -mt-16 group-hover:bg-yellow-500/10 transition-colors"></div>
                    
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-1.5 h-4 bg-yellow-500 rounded-full"></div>
                        <h4 className="text-sm font-bold text-white uppercase tracking-wider italic">용량환산 시간계수 (K-Factor)</h4>
                    </div>

                    <div className="space-y-4">
                        <p className="text-[13px] text-gray-400 leading-relaxed">
                            배터리가 얼마나 버텨줄 것인가를 계산하기 위한 수치로, 배터리는 <span className="text-white font-semibold">방전 전류의 크기</span>에 따라 에너지의 양이 달라진다. (강하게 빨리 쓰면 전체 용량을 다 못 쓰고 금방 전압이 떨어지기 때문에) 
                        </p>
                        <p className="text-[13px] text-gray-400 leading-relaxed">
                            제조사가 제공하는 <span className="text-yellow-500 font-medium">'방전 특성표(K-Factor Table)'</span>에 의해 결정되며, 백업 시간이 길어질수록, 온도가 낮을수록 배터리 효율이 떨어지므로 <span className="text-white">K 값은 커지게 된다.</span>
                        </p>
                    </div>
                </div>
            </section>

            {/* Sector 2-2: Discharge Current */}
            <section>
                <SectionHeader title="UPS 방전전류 계산" barColor="bg-green-500" />
                <FormulaCard
                    title="DISCHARGE CURRENT (A)"
                    formula={
                        <div className="flex items-center gap-x-2 sm:gap-x-4">
                            <span className={`${colors.current} font-bold`}>I</span>
                            <span className="text-gray-500">=</span>
                            <span className="text-gray-600 px-1">(</span>
                            <span className={colors.sum}>P × <span className={colors.cos}>cosθ</span></span>
                            <span className="text-gray-600 px-1">)</span>
                            <span className="text-gray-600">÷</span>
                            <span className="text-gray-600 px-1">(</span>
                            <span className={colors.voltage}>V<Sub>p</Sub></span>
                            <span className="text-gray-600">×</span>
                            <span className={colors.cell}>N</span>
                            <span className="text-gray-600">×</span>
                            <span className={`${colors.eta} italic`}>η<Sub>inv</Sub></span>
                            <span className="text-gray-600 px-1">)</span>
                        </div>
                    }
                    variables={dischargeCurrentVars}
                    icon={Activity}
                    color="green"
                />

                <div className="mt-6 bg-black/40 border border-gray-900 rounded-xl p-6 relative overflow-hidden group hover:border-green-500/30 transition-all duration-500">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 blur-3xl -mr-16 -mt-16 group-hover:bg-green-500/10 transition-colors"></div>
                    
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-1.5 h-4 bg-green-500 rounded-full"></div>
                        <h4 className="text-sm font-bold text-white uppercase tracking-wider italic">축전지 셀당 방전종지전압</h4>
                    </div>

                    <div className="space-y-4">
                        <p className="text-[13px] text-gray-400 leading-relaxed">
                            배터리는 방전될수록 전압이 서서히 떨어진다. 하지만 전압이 0V가 될 때까지 쓰면 배터리가 영구적으로 손상(과방전)되기 때문에 <span className="text-white font-semibold">"여기까지만 쓰고 멈추자"</span>고 정한 마지노선 전압을 뜻한다. 즉, 안전하게 에너지를 다 썼다고 판단하는 전압이다.
                        </p>
                        <p className="text-[13px] text-gray-400 leading-relaxed">
                            전력(P) = 전압(V) x 전류(I) 일 때, UPS가 일정한 출력(P)을 유지해야 한다면 전압(V)이 낮아질수록 전류(I)는 더 많이 흐르게 된다. 따라서 전압이 가장 높은 '만충 전압'이 아닌 <span className="text-red-400 font-bold italic">가장 낮은 '종지 전압'을 대입</span>하여 최대 방전전류(I)를 구한다.
                        </p>

                        <div className="mt-4 bg-gray-950/50 rounded-xl p-6 border border-gray-800/50 flex flex-col items-center justify-center overflow-x-auto">
                            <div className="flex items-center gap-3 text-[13px] sm:text-[14px] font-semibold tracking-tight min-w-max">
                                <span className="text-white bg-gray-800 px-2 py-1 rounded text-[11px] uppercase tracking-widest mr-2">Formula</span>
                                <span className="text-gray-200">방전 종지전압</span>
                                <span className="text-gray-600 text-xl">=</span>
                                <div className="flex flex-col items-center px-2">
                                    <span className="text-red-400 pb-1 border-b border-gray-700 w-full text-center px-4">직류전원 최저전압</span>
                                    <span className="text-orange-400 pt-1 w-full text-center">12V Block 수</span>
                                </div>
                                <span className="text-gray-600 text-xl">=</span>
                                <div className="flex flex-col items-center px-2">
                                    <span className="text-red-400 pb-1 border-b border-gray-700 w-full text-center px-4">직류전원 최저전압</span>
                                    <span className="text-orange-400 pt-1 w-full text-center">Block 수 × 6 Cells</span>
                                </div>
                                <span className="text-blue-400 font-bold ml-2">[V/Cell]</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-4 px-4 text-[11px] text-gray-400 italic font-medium">
                    * 연축전지 12V Block 10.5 [V/Cell] , 축전지 개당 1.75 [V/Cell]
                </div>

                <div className="mt-6 bg-black/40 border border-gray-900 rounded-xl p-6 relative overflow-hidden group hover:border-green-500/30 transition-all duration-500">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 blur-3xl -mr-16 -mt-16 group-hover:bg-green-500/10 transition-colors"></div>
                    
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-1.5 h-4 bg-green-500 rounded-full"></div>
                        <h4 className="text-sm font-bold text-white uppercase tracking-wider italic">인버터 효율</h4>
                    </div>

                    <div className="space-y-4">
                        <p className="text-[13px] text-gray-400 leading-relaxed">
                            정전이 발생해서 배터리로부터 전기를 뽑아 쓸 때는 정류기(Rectifier)를 거치지 않고 배터리에서 곧장 인버터(Inverter)를 통해 부하로 가기 때문에 방전전류를 계산 할 때는, 그 경로에 있는 인버터의 손실만 고려하면 된다. 따라서 앞서 종합 효율과는 다른 의미의 효율이다.
                        </p>
                        <p className="text-[13px] text-gray-400 leading-relaxed font-medium">
                            인버터 효율은 <span className="text-white">DC(직류)를 AC(교류)로 바꿀 때의 효율</span>로 정의하고, 종합 효율은 <span className="text-white">AC(입력)를 AC(출력)로 바꿀 때의 전체 효율</span>로 정의함.
                        </p>
                    </div>
                </div>

                <div className="mt-8 bg-gray-900/20 border border-gray-800 p-6 rounded-xl">
                    <div className="flex items-start gap-4">
                        <Info size={18} className="text-blue-400 mt-1 shrink-0" />
                        <div className="space-y-1">
                            <h4 className="text-sm font-bold text-white tracking-tight uppercase">계산 방식의 구분</h4>
                            <p className="text-[12px] text-gray-400 leading-relaxed font-medium">
                                • 방전전류가 시간에 따라 증가하는 경우: 각 단계별 증가분을 고려한 합산 용량 산정.<br />
                                • 방전전류가 감소하는 경우: 기간별 각각의 용량을 산출하여 가장 큰 용량으로 선정.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Sector 3: Cell Count */}
            <section>
                <SectionHeader title="축전지 Cell 산정" barColor="bg-purple-600" />
                <FormulaCard
                    title="NUMBER OF BATTERY CELLS"
                    formula={
                        <div className="flex items-center gap-x-4">
                            <span className={`${colors.cell} font-bold`}>N</span>
                            <span className="text-gray-500">=</span>
                            <span className={colors.cos}>V<Sub>DC</Sub></span>
                            <span className="text-gray-600">÷</span>
                            <span className={colors.sum}>V<Sub>B</Sub></span>
                        </div>
                    }
                    variables={cellCountVars}
                    icon={Battery}
                    color="purple"
                />
                <div className="mt-4 px-4 text-[11px] text-gray-300 italic space-y-1.5">
                    <div className="flex gap-x-1 items-start">
                        <span className="shrink-0">* V<Sub>B</Sub> (축전지 공칭전압) :</span>
                        <span className="flex-1">연축전지(2.0V/Cell), 알칼리전지(1.2V/Cell), 리튬이온(3.6V/Cell)</span>
                    </div>
                    <div className="flex gap-x-1 items-start">
                        <span className="shrink-0">*</span>
                        <span className="flex-1">12V Block 배터리 1개 = 6 Cells (연축전지 기준)</span>
                    </div>
                </div>
            </section>

            {/* Sector 4: Coefficient Table */}
            <section className="pt-8 scroll-mt-20" id="capacity-coefficient-table">
                <div className="mb-0">
                    <SectionHeader title="용량환산 시간계수 K" barColor="bg-gray-600" />
                </div>

                <div className="border border-gray-900 bg-black relative overflow-hidden group">
                    <CornerBorders />
                    <div className="overflow-x-auto custom-scrollbar">
                        <div className="p-2">
                            <table className="w-full border-collapse table-fixed min-w-[900px]">
                                <thead>
                                    <tr className="bg-[#030712] border-b border-[#111827]">
                                        <TableHeader>형식</TableHeader>
                                        <TableHeader>최저허용 전압[V/셀]</TableHeader>
                                        <TableHeader>0.1분</TableHeader>
                                        <TableHeader>1분</TableHeader>
                                        <TableHeader>5분</TableHeader>
                                        <TableHeader>10분</TableHeader>
                                        <TableHeader>20분</TableHeader>
                                        <TableHeader>30분</TableHeader>
                                        <TableHeader>60분</TableHeader>
                                        <TableHeader>120분</TableHeader>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-900">
                                    {kCoefficientData.map((row, idx) => {
                                        const isFirstOfType = idx === 0 || kCoefficientData[idx - 1].type !== row.type;
                                        return (
                                            <tr key={idx} className="hover:bg-blue-500/10 transition-colors group/row">
                                                {isFirstOfType ? (
                                                    <td rowSpan="3" className="px-2 py-4 text-center text-[12px] sm:text-[13px] font-bold text-white border-r border-gray-900 bg-[#030712] uppercase tracking-wider">
                                                        {row.type}
                                                    </td>
                                                ) : null}
                                                <TableCell isHeader>{row.minV}</TableCell>
                                                {row.values.map((v, vidx) => (
                                                    <TableCell key={vidx}>{v}</TableCell>
                                                ))}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                <div className="mt-4 px-2 text-[11px] text-gray-300 font-medium italic flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                        <Info size={12} />
                        <span>( ) 내의 수치는 200[Ah]를 넘는 축전지에 적용됩니다.</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Info size={12} />
                        <span>최저허용 전압[V/셀] = 축전지 셀당 방전종지전압 V<sub>P</sub></span>
                    </div>
                </div>

                {/* Battery Type Descriptions */}
                <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-12">
                    {/* 1. Alkali Series */}
                    <div className="bg-gray-900/10 border border-gray-800 rounded-xl p-6 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                            <Zap size={100} />
                        </div>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-1 h-5 bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]"></div>
                            <h3 className="text-[15px] sm:text-base font-bold text-white tracking-tight">
                                1. 알칼리(Ni-Cd) 축전지 계열
                            </h3>
                        </div>
                        <div className="space-y-1 text-[13px] text-gray-500 mb-6">
                            알칼리 축전지는 'A'로 시작하며, 방전 속도에 따라 다음과 같이 구분된다.
                        </div>
                        <div className="space-y-6">
                            {[
                                { code: "AHH", full: "Ultra High Rate", short: "초고율 방전형", desc: "아주 짧은 시간(초 단위)에 매우 큰 전류를 필요로 하는 경우(예: 발전기 기동용)에 사용." },
                                { code: "AH", full: "High Rate", short: "고율 방전형", desc: "1시간 이내의 비교적 짧은 시간 동안 큰 전류를 방전하는 UPS나 비상전원용으로 가장 흔히 사용." },
                                { code: "AMH", full: "Medium-High Rate", short: "중고율 방전형", desc: "장시간 부하와 단시간 대전류 부하가 혼재된 환경에 적합." },
                                { code: "AM", full: "Medium Rate", short: "중율 방전형", desc: "표준적인 방전 특성을 가지며, 일반적인 비상 조명이나 제어용 전원으로 사용." }
                            ].map((item, idx) => (
                                <div key={idx} className="relative pl-5 border-l border-gray-800 hover:border-blue-500/50 transition-colors py-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[13px] font-black text-blue-400 tracking-wider font-mono">{item.code}</span>
                                        <span className="text-[10px] text-gray-600 font-bold uppercase tracking-tighter">({item.full})</span>
                                    </div>
                                    <p className="text-[12px] text-gray-400 leading-relaxed font-medium whitespace-pre-line">
                                        <span className="text-gray-200 font-bold mr-1">{item.short}:</span>
                                        {item.desc}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 2. Lead-Acid Series */}
                    <div className="bg-gray-900/10 border border-gray-800 rounded-xl p-6 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                            <Shield size={100} />
                        </div>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-1 h-5 bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]"></div>
                            <h3 className="text-[15px] sm:text-base font-bold text-white tracking-tight">
                                2. 연(Lead-Acid) 축전지 계열
                            </h3>
                        </div>
                        <div className="space-y-1 text-[13px] text-gray-500 mb-6">
                            납축전지 계열은 구조나 밀폐 여부에 따라 다음과 같이 구분된다.
                        </div>
                        <div className="space-y-6">
                            {[
                                { code: "CS", full: "Clad Stationary", short: "완만 방전형", desc: "클레이드식 연축전지. 수명이 길고 안정적이지만, 주로 긴 시간(10시간율 등) 동안 천천히 방전하는 용도에 적합." },
                                { code: "IHS", full: "Improved High Speed", short: "고율 방전용 무보수 밀폐형", desc: "VRLA(연축전지) 중에서도 UPS처럼 짧은 시간에 큰 힘을 써야 하는 장비에 최적화된 형식.\n최근 UPS 설계 시 연축전지를 선택하면 대부분 이 IHS나 HS(고율 방전형) 계열의 계수를 사용." }
                            ].map((item, idx) => (
                                <div key={idx} className="relative pl-5 border-l border-gray-800 hover:border-green-500/50 transition-colors py-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[13px] font-black text-green-400 tracking-wider font-mono">{item.code}</span>
                                        <span className="text-[10px] text-gray-600 font-bold uppercase tracking-tighter">({item.full})</span>
                                    </div>
                                    <p className="text-[12px] text-gray-400 leading-relaxed font-medium whitespace-pre-line">
                                        <span className="text-gray-200 font-bold mr-1">{item.short}:</span>
                                        {item.desc}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* Sector 5: UPS Units & Battery Cabinet Size Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 pt-8">
                {/* 5.1 UPS Units Size Chart */}
                <section id="ups-units-size-chart">
                    <SectionHeader title="UPS Units Size Chart" barColor="bg-blue-500" />
                    <div className="border border-gray-900 bg-black relative overflow-hidden group">
                        <CornerBorders />
                        <div className="overflow-x-auto custom-scrollbar">
                            <div className="p-2">
                                <table className="w-full border-collapse table-fixed min-w-[400px]">
                                    <thead>
                                        <tr className="bg-[#030712] border-b border-[#111827]">
                                            <TableHeader>용량 (kVA)</TableHeader>
                                            <TableHeader>가로(W)</TableHeader>
                                            <TableHeader>깊이(D)</TableHeader>
                                            <TableHeader>높이(H)</TableHeader>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-900">
                                        {upsUnitSizeData.map((row, idx) => (
                                            <tr key={idx} className="hover:bg-blue-500/10 transition-colors group/row">
                                                <TableCell isHeader>{row.kva}</TableCell>
                                                <TableCell>{row.w}</TableCell>
                                                <TableCell>{row.d}</TableCell>
                                                <TableCell>{row.h}</TableCell>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                    <div className="mt-4 px-2 text-[11px] text-gray-500 font-medium italic flex items-center gap-2">
                        <Info size={12} />
                        <span>수치는 참고용 일뿐 제조사와 백업시간에 따라 다름.</span>
                    </div>
                </section>

                {/* 5.2 Battery Cabinet Size Chart */}
                <section id="battery-cabinet-size-chart">
                    <SectionHeader title="Battery Cabinet Size Chart" barColor="bg-yellow-500" />
                    <div className="border border-gray-900 bg-black relative overflow-hidden group">
                        <CornerBorders />
                        <div className="overflow-x-auto custom-scrollbar">
                            <div className="p-2">
                                <table className="w-full border-collapse table-fixed min-w-[500px]">
                                    <thead>
                                        <tr className="bg-[#030712] border-b border-[#111827]">
                                            <TableHeader>용량 (kVA)</TableHeader>
                                            <TableHeader>가로(W)</TableHeader>
                                            <TableHeader>깊이(D)</TableHeader>
                                            <TableHeader>높이(H)</TableHeader>
                                            <TableHeader>함체 수량</TableHeader>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-900">
                                        {batteryCabinetSizeData.map((row, idx) => (
                                            <tr key={idx} className="hover:bg-yellow-500/10 transition-colors group/row">
                                                <TableCell isHeader>{row.kva}</TableCell>
                                                <TableCell>{row.w}</TableCell>
                                                <TableCell>{row.d}</TableCell>
                                                <TableCell>{row.h}</TableCell>
                                                <TableCell>{row.qty}</TableCell>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                    <div className="mt-4 px-2 text-[11px] text-gray-500 font-medium italic flex items-center gap-2">
                        <Info size={12} />
                        <span>수치는 참고용 일뿐 제조사와 백업시간에 따라 다름.</span>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default UpsTheory;

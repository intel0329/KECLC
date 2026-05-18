import React from 'react';
import { X, ChevronRight, BookOpen } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

const tocData = [
    {
        id: 'xlpe',
        title: 'XLPE Insulated Cable',
        path: '/xlpe',
        sections: [
            '케이블 배선 방법별 가이드',
            '1φ XLPE 공사방법별 허용전류',
            '3φ XLPE 공사방법별 허용전류'
        ]
    },
    {
        id: 'cb',
        title: 'Circuit Breaker Data',
        path: '/cb',
        sections: [
            '차단기 종류와 용어 가이드',
            '배선용차단기(MCCB) 정격 및 특성',
            '누전차단기(ELCB) 정격 및 특성',
            '차단기 프레임별 차단용량 및 사이즈'
        ]
    },
    {
        id: 'ct',
        title: 'Current Transformer',
        path: '/ct',
        sections: [
            '변류기 선정을 위한 기본 파라미터',
            '저전류군 변류기 정격 표준 리스트',
            '중전류군 변류기 정격 표준 리스트',
            '고전류군 변류기 정격 표준 리스트'
        ]
    },
    {
        id: 'od',
        title: 'Cable Detailed',
        path: '/od',
        sections: [
            '배전케이블 전압 및 종류 구분',
            '0.6/1kV CV/FR-8 케이블 특성',
            '0.6/1kV F-GV 케이블 특성',
            '450/750V HFIX 특성',
            'F-GV 케이블 선정',
            '전선관 내 케이블 점유율 산출 데이터'
        ]
    },
    {
        id: 'rx',
        title: 'Cable Impedance',
        path: '/rx',
        sections: [
            '0.6/1kV F-CV 단심/다심 케이블 임피던스',
            '0.6/1kV FR-8 단심/다심 케이블 임피던스',
            '450/750V HFIX 케이블 임피던스',
            'TRAY 내 포설 방법에 따른 임피던스'
        ]
    },
    {
        id: 'pl',
        title: 'Panel Layout',
        path: '/pl',
        sections: [
            '외함 재질 및 설치 특성',
            '차단기 외형 치수 (W/H/D) 데이터',
            '분전반 내부 배치 및 이격거리 표준'
        ]
    },
    {
        id: 'prd',
        title: 'Power System Standards',
        path: '/prd',
        sections: [
            '수변전 설비 보호협조 기준',
            '피뢰기(LA) 및 서지흡수기(SA) 비교',
            '변압기 용량별 특성 표',
            '변압기 용량에 따른 전력기기 정격표',
            '한류형 퓨즈 규격 및 정격',
            '기중차단기 및 진공차단기 규격'
        ]
    },
    {
        id: 'gen',
        title: 'Generator Guide',
        path: '/gen',
        sections: [
            '발전기 용량 산정 및 부하 분류 가이드',
            '허용전압강하계수(K)',
            '발전기 용량별 설비 제원표',
			'발전기 용량별 급기 및 배기표',
            '비상용 예비발전설비 연결 부하의 구분'
        ]
    },
    {
        id: 'ups',
        title: 'Uninterruptible Power Supply (UPS)',
        path: '/ups',
        sections: [
            'UPS 최대 수요 전력',
            'UPS 축전지 용량 산정',
            'UPS 방전전류 계산',
            '축전지 Cell 산정',
            '용량환산 시간계수 K',
            'UPS 용량별 제원 및 배터리 사이즈',
        ]
    },
];

const MasterNavModal = ({ isOpen, onClose }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const activeItemRef = React.useRef(null);

    React.useEffect(() => {
        if (isOpen && activeItemRef.current) {
            // Small delay to ensure modal animation is settled
            const timer = setTimeout(() => {
                activeItemRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleNavigate = (path, sectionTitle = null) => {
        if (location.pathname === path && sectionTitle) {
            // Same page scroll
            const event = new CustomEvent('scroll-to-section', { detail: { title: sectionTitle } });
            window.dispatchEvent(event);
            onClose();
        } else {
            // Cross page navigation
            navigate(path + (sectionTitle ? `#${encodeURIComponent(sectionTitle)}` : ''));
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 sm:p-6 md:p-8 overflow-hidden">
            {/* Backdrop with extreme blur */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-xl transition-opacity duration-300 ease-in-out"
                onClick={onClose}
            />

            {/* Modal Container */}
            <div className="relative w-full max-w-2xl max-h-[85vh] bg-[#0A0A0A]/90 border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)] rounded-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300">

                {/* Glow Effects */}
                <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-500/10 blur-[100px] pointer-events-none" />
                <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-emerald-500/10 blur-[100px] pointer-events-none" />

                {/* Header */}
                <div className="px-4 sm:px-8 py-4 sm:py-5 border-b border-white/10 flex items-center justify-between bg-[#0A0A0A] backdrop-blur-xl sticky top-0 z-20">
                    <div className="flex items-center gap-2 sm:gap-4">
                        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                            <BookOpen size={15} className="sm:text-lg text-blue-400" />
                        </div>
                        <h2 className="text-[14px] sm:text-xl font-bold text-white tracking-tight italic bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent whitespace-nowrap">
                            Technical Standards
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 sm:p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-all duration-200"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 sm:px-10 pt-16 pb-10 custom-scrollbar space-y-12">
                    {tocData.map((item, idx) => {
                        const isActive = location.pathname === item.path;

                        return (
                            <div key={item.id} className="relative pl-10 group">
                                {/* Vertical Timeline Line */}
                                {idx !== tocData.length - 1 && (
                                    <div className="absolute left-3 top-8 bottom-[-48px] w-[1px] bg-white/10 group-hover:bg-blue-500/30 transition-colors" />
                                )}

                                {/* Timeline Dot */}
                                <div 
                                    ref={isActive ? activeItemRef : null}
                                    className={`absolute left-0 top-0.5 w-6 h-6 rounded-full bg-black border-2 transition-all duration-300 flex items-center justify-center z-[5] ${isActive
                                        ? 'border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.8)] scale-110'
                                        : 'border-white/20 group-hover:border-blue-500/50'
                                    }`}>
                                    <div className={`w-2 h-2 rounded-full transition-all ${isActive ? 'bg-blue-500 animate-pulse' : 'bg-white/10 group-hover:bg-blue-500/30'
                                        }`} />
                                </div>

                                {/* Main Item */}
                                <button
                                    onClick={() => handleNavigate(item.path)}
                                    className="w-full text-left focus:outline-none"
                                >
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className={`text-[16px] sm:text-xl font-bold tracking-tight transition-colors duration-300 ${isActive ? 'text-white' : 'text-gray-300 group-hover:text-blue-400'
                                            }`}>
                                            {item.title}
                                        </h3>
                                        <ChevronRight size={18} className={`transition-all duration-300 ${isActive ? 'text-blue-500 opacity-100' : 'text-gray-800 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 group-hover:text-blue-500/50'
                                            }`} />
                                    </div>

                                    {/* Sub-sections */}
                                    <ul className="space-y-2.5">
                                        {item.sections.map((section, sIdx) => (
                                            <li 
                                                key={sIdx} 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleNavigate(item.path, section);
                                                }}
                                                className="flex items-start gap-3 text-[11px] sm:text-sm text-gray-400 hover:text-blue-400 cursor-pointer transition-colors group/sub"
                                            >
                                                <span className="mt-1.5 w-1 h-1 rounded-full bg-white/20 shrink-0 group-hover/sub:bg-blue-500/30 transition-colors" />
                                                <span className="font-light tracking-tight leading-snug">{section}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </button>
                            </div>
                        );
                    })}
                </div>


            </div>
        </div>
    );
};

export default MasterNavModal;

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronLeft, Check, AlertCircle, Shield, X } from 'lucide-react';
import { createProject, getDefaultCalculators } from '../services/projectService';
import useDataStore from '../store/useDataStore';

const CornerBorders = () => (
    <>
        <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-blue-500/50"></div>
        <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-blue-500/50"></div>
        <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-blue-500/50"></div>
        <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-blue-500/50"></div>
    </>
);

// 계산서 목록
const CALCULATOR_OPTIONS = [
    { id: 'transformer', name: '변압기 용량 계산서', desc: 'TR 용량 산정' },
    { id: 'generator', name: '발전기 용량 계산서', desc: '비상발전기 용량 산정' },
    { id: 'low-voltage-receiving', name: '저압 수전 용량 계산서', desc: '저압 수전 설비 용량 산정', multiple: true },
    { id: 'panel-feeder', name: '분전반 간선 계산서', desc: '분전반 간선 케이블 산정' },
    { id: 'panel-load', name: '분전반 부하 계산서', desc: '분전반별 부하 계산', multiple: true },
    { id: 'ups', name: 'UPS 용량 계산서', desc: 'UPS 용량 산정', multiple: true },
    { id: 'power-load', name: '동력 부하 계산서', desc: 'MCC별 부하 계산', multiple: true },
    { id: 'tray', name: 'TRAY 계산서', desc: '케이블 트레이 사이즈 산정' },
];

// 오늘 날짜를 YYYY-MM-DD 형식으로 반환
const getTodayDate = () => {
    return new Date().toISOString().split('T')[0];
};

// Modal Component (Shared structure with Header)
const Modal = ({ isOpen, onClose, title, children }) => {
    React.useEffect(() => {
        if (isOpen) document.body.style.overflow = 'hidden';
        else document.body.style.overflow = 'unset';
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
            <div className="relative bg-black border border-gray-800 w-full max-w-md mx-4 shadow-2xl animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                <CornerBorders />
                <div className="flex items-center justify-between p-4 border-b border-gray-800">
                    <h3 className="text-sm font-bold text-white uppercase tracking-widest">{title}</h3>
                    <button onClick={onClose} className="p-1 text-gray-400 hover:text-white transition-colors">
                        <X size={18} />
                    </button>
                </div>
                <div className="p-4">
                    {children}
                </div>
            </div>
        </div>
    );
};

const ProjectSetup = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);

    // 프로젝트 정보
    const [projectName, setProjectName] = useState('');
    const [clientName, setClientName] = useState('');
    const [projectDate, setProjectDate] = useState(getTodayDate());

    const [selectedCalculators, setSelectedCalculators] = useState([]);
    
    // [NEW] 활성 프로젝트 세션 실시간 구독
    const activeProjectId = useDataStore(state => state.activeProjectId);

    // Exit Confirmation Modal States
    const [isExitModalOpen, setIsExitModalOpen] = useState(false);
    const [isExecuting, setIsExecuting] = useState(false);

    const toggleCalculator = (id) => {
        setSelectedCalculators(prev =>
            prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
        );
    };

    const executeCreate = async () => {
        // 선택된 계산서만 enabled 처리
        const calculators = getDefaultCalculators().map(calc => ({
            ...calc,
            enabled: selectedCalculators.includes(calc.id),
        }));

        try {
            // 프로젝트 생성
            const newProject = await createProject({
                name: projectName,
                client: clientName,
                date: projectDate,
                calculators,
            });

            console.log('Created project:', newProject);

            // 프로젝트 대시보드로 이동
            if (newProject && newProject.id) {
                // [SYNC] 프로젝트 리스트 갱신 전파 (타 탭 리스트 자동 업데이트)
                useDataStore.getState().broadcastListUpdate();

                // [STRICT] Ensure the newly created project becomes the active one
                useDataStore.getState().initProject(newProject.id);
                navigate(`/project/${newProject.id}`);
            }
        } catch (e) {
            console.error('Failed to create project:', e);
            window.dispatchEvent(new CustomEvent('kelc_show_toast', {
                detail: { message: '프로젝트 생성에 실패했습니다.', type: 'error' }
            }));
        } finally {
            setIsExecuting(false);
            setIsExitModalOpen(false);
        }
    };

    const handleCreate = async () => {
        // [SESSION CHECK] 활성 프로젝트가 있는 경우 종료 확인 팝업 (실시간 구독 값 활용)
        if (activeProjectId) {
            setIsExitModalOpen(true);
        } else {
            setIsExecuting(true);
            executeCreate();
        }
    };

    const handleConfirmExit = () => {
        setIsExecuting(true);
        
        // [FIX] 자신(현재 탭)은 홈으로 가지 않고, 다른 탭들만 프로젝트 종료 신호 전송
        useDataStore.getState().broadcastClose('/'); 
        
        // 현재 탭의 상태를 수동으로 클린업 (새 프로젝트 생성을 위해)
        useDataStore.setState({ activeProjectId: null, panels: {}, results: {} });
        localStorage.removeItem('kelc_active_project_id');
        localStorage.removeItem('kelc_project_info');
        localStorage.removeItem('kelc_dirty_panels');
        localStorage.setItem('kelc_project_is_dirty', 'false');
        
        // 애니메이션 및 신호 전송을 위한 짧은 대기 후 생성 로직 실행
        setTimeout(() => {
            executeCreate();
        }, 800);
    };

    // Step 1 다음으로 넘어가기 위한 조건
    const canProceedStep1 = projectName.trim() !== '';

    return (
        <div className="px-4 md:px-6 lg:px-8 max-w-2xl mx-auto">
            {/* Progress Indicator */}
            <div className="flex items-center justify-center gap-4 mb-8">
                <div className={`flex items-center gap-2 ${step >= 1 ? 'text-blue-400' : 'text-gray-600'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 1 ? 'bg-blue-500 text-white' : 'bg-gray-800 text-gray-500'}`}>1</div>
                    <span className="text-sm font-bold hidden sm:inline">프로젝트 정보</span>
                </div>
                <div className="w-8 h-px bg-gray-700"></div>
                <div className={`flex items-center gap-2 ${step >= 2 ? 'text-blue-400' : 'text-gray-600'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 2 ? 'bg-blue-500 text-white' : 'bg-gray-800 text-gray-500'}`}>2</div>
                    <span className="text-sm font-bold hidden sm:inline">계산서 선택</span>
                </div>
            </div>

            {/* Step 1: Project Info */}
            {step === 1 && (
                <div className="relative bg-black border border-gray-800 p-6">
                    <CornerBorders />
                    <h2 className="text-xl font-bold text-white mb-6">NEW PROJECT</h2>

                    {/* 프로젝트 이름 */}
                    <div className="mb-5">
                        <label className="block text-xs text-gray-400 mb-2 uppercase tracking-widest">
                            프로젝트 이름 <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="text"
                            value={projectName}
                            onChange={(e) => setProjectName(e.target.value)}
                            placeholder="예: OOOO 신축공사"
                            className="w-full bg-gray-900 border border-gray-700 text-white px-4 py-3 text-sm outline-none focus:border-blue-500"
                        />
                    </div>

                    {/* 발주사 이름 */}
                    <div className="mb-5">
                        <label className="block text-xs text-gray-400 mb-2 uppercase tracking-widest">
                            발주사
                        </label>
                        <input
                            type="text"
                            value={clientName}
                            onChange={(e) => setClientName(e.target.value)}
                            placeholder="예: (주)한국전기"
                            className="w-full bg-gray-900 border border-gray-700 text-white px-4 py-3 text-sm outline-none focus:border-blue-500"
                        />
                    </div>

                    {/* 제작일 */}
                    <div className="mb-6">
                        <label className="block text-xs text-gray-400 mb-2 uppercase tracking-widest">
                            제작일
                        </label>
                        <input
                            type="date"
                            value={projectDate}
                            onChange={(e) => setProjectDate(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 text-white px-4 py-3 text-sm outline-none focus:border-blue-500 [color-scheme:dark]"
                        />
                    </div>

                    <div className="flex justify-end gap-3">
                        <button
                            onClick={() => navigate('/projects')}
                            className="px-6 py-3 border border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800 text-sm font-bold uppercase tracking-widest transition-colors"
                        >
                            취소
                        </button>
                        <button
                            onClick={() => setStep(2)}
                            disabled={!canProceedStep1}
                            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-bold uppercase tracking-widest flex items-center gap-2 transition-colors"
                        >
                            다음 <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* Step 2: Calculator Selection */}
            {step === 2 && (
                <div className="relative bg-black border border-gray-800 p-6">
                    <CornerBorders />
                    <h2 className="text-xl font-bold text-white mb-2">계산서 선택</h2>
                    <p className="text-gray-400 text-sm mb-6">이 프로젝트에서 사용할 계산서를 선택하세요. (나중에 추가/수정 가능)</p>

                    <div className="space-y-2 mb-6">
                        {CALCULATOR_OPTIONS.map(calc => (
                            <div
                                key={calc.id}
                                onClick={() => toggleCalculator(calc.id)}
                                className={`flex items-center gap-4 p-4 border cursor-pointer transition-colors ${selectedCalculators.includes(calc.id)
                                    ? 'bg-blue-500/10 border-blue-500/50'
                                    : 'border-gray-800 hover:border-gray-700'
                                    }`}
                            >
                                <div className={`w-5 h-5 border rounded flex items-center justify-center ${selectedCalculators.includes(calc.id)
                                    ? 'bg-blue-500 border-blue-500'
                                    : 'border-gray-600'
                                    }`}>
                                    {selectedCalculators.includes(calc.id) && <Check size={14} className="text-white" />}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-white font-bold text-sm">{calc.name}</span>
                                        {calc.multiple && (
                                            <span className="text-[9px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded uppercase">복수</span>
                                        )}
                                    </div>
                                    <span className="text-gray-500 text-xs">{calc.desc}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-between gap-3">
                        <button
                            onClick={() => setStep(1)}
                            className="px-6 py-3 border border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800 text-sm font-bold uppercase tracking-widest flex items-center gap-2 transition-colors"
                        >
                            <ChevronLeft size={16} /> 이전
                        </button>
                        <button
                            onClick={handleCreate}
                            disabled={selectedCalculators.length === 0}
                            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-bold uppercase tracking-widest flex items-center gap-2 transition-colors"
                        >
                            프로젝트 생성 <Check size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* Project Exit Confirmation Modal */}
            <Modal
                isOpen={isExitModalOpen}
                onClose={() => !isExecuting && setIsExitModalOpen(false)}
                title="프로젝트 종료"
            >
                <div className="flex flex-col items-center py-6">
                    {isExecuting ? (
                        <>
                            <div className="relative mb-8 w-24 h-24 flex items-center justify-center">
                                <div className="absolute inset-0 border-2 border-dashed border-blue-500/20 rounded-full animate-spin" style={{ animationDuration: '8s' }}></div>
                                <div className="absolute inset-1 border-b-2 border-blue-500 rounded-full animate-spin" style={{ animationDuration: '2s' }}></div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-16 h-16 bg-emerald-500/10 rounded-full blur-xl animate-pulse"></div>
                                </div>
                                <div className="relative z-10 p-4 bg-black rounded-full border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                                    <Shield size={32} className="text-emerald-500" />
                                </div>
                            </div>
                            <h4 className="text-white text-lg font-bold mb-2 tracking-tight">새 프로젝트 세션을 준비하는 중</h4>
                            <p className="text-gray-500 text-sm text-center px-4 leading-relaxed">
                                모든 탭의 데이터와 상태를 동기화하고 있습니다.<br/>
                                프리징 방지를 위해 잠시만 기다려 주세요...
                            </p>
                        </>
                    ) : (
                        <>
                            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-6 border border-red-500/20">
                                <AlertCircle size={32} className="text-red-500" />
                            </div>
                            <h4 className="text-white text-lg font-bold mb-2 tracking-tight">프로젝트를 종료하시겠습니까?</h4>
                            <p className="text-gray-500 text-sm text-center px-4 leading-relaxed mb-8">
                                현재 열려있는 프로젝트의 모든 계산 세션이 종료됩니다.<br/>
                                계속하시려면 확인 버튼을 눌러주세요.
                            </p>
                            <div className="flex gap-3 w-full">
                                <button
                                    onClick={() => setIsExitModalOpen(false)}
                                    className="flex-1 px-4 py-3 border border-gray-800 text-gray-400 hover:text-white hover:bg-gray-800 text-xs font-bold uppercase tracking-widest transition-all"
                                >
                                    취소
                                </button>
                                <button
                                    onClick={handleConfirmExit}
                                    className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-widest transition-all shadow-lg shadow-blue-500/20"
                                >
                                    확인
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </Modal>
        </div>
    );
};

export default ProjectSetup;

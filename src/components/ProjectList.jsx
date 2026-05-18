import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Plus, Folder, Trash2, ChevronRight, Copy, X, Search, Loader2 } from 'lucide-react';
import { getProjects, deleteProject, copyProject } from '../services/projectService';
import useDataStore from '../store/useDataStore';

const CornerBorders = ({ isActive }) => (
    <>
        <div className={`absolute top-0 left-0 w-2 h-2 border-t border-l transition-colors ${isActive ? 'border-emerald-500/50' : 'border-blue-500/50'}`}></div>
        <div className={`absolute top-0 right-0 w-2 h-2 border-t border-r transition-colors ${isActive ? 'border-emerald-500/50' : 'border-blue-500/50'}`}></div>
        <div className={`absolute bottom-0 left-0 w-2 h-2 border-b border-l transition-colors ${isActive ? 'border-emerald-500/50' : 'border-blue-500/50'}`}></div>
        <div className={`absolute bottom-0 right-0 w-2 h-2 border-b border-r transition-colors ${isActive ? 'border-emerald-500/50' : 'border-blue-500/50'}`}></div>
    </>
);

// Custom Modal Component
const Modal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
            onClick={onClose}
        >
            <div
                className="relative bg-black border border-gray-800 w-full max-w-md mx-4 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
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

const ProjectList = () => {
    const navigate = useNavigate();
    const location = useLocation();
    
    // [SYNC] 전역 리스트 업데이트 트리거 및 활성 세션 구독
    const activeProjectId = useDataStore(state => state.activeProjectId);
    const listUpdateTrigger = useDataStore(state => state.listUpdateTrigger);
    const broadcastListUpdate = useDataStore(state => state.broadcastListUpdate);
    const requestActiveProject = useDataStore(state => state.requestActiveProject);

    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchProjects = async () => {
        setLoading(true);
        try {
            const data = await getProjects();
            setProjects(data || []);
        } catch (e) {
            console.error('Failed to load projects:', e);
        } finally {
            setLoading(false);
        }
    };

    // [SYNC] 다른 탭의 리스트 변경 신호 감지 시 자동 새로고침
    useEffect(() => {
        fetchProjects();
    }, [listUpdateTrigger]);

    // 초기 로드 (listUpdateTrigger가 0일 때)
    useEffect(() => {
        if (listUpdateTrigger === 0) {
            fetchProjects();
        }
    }, []);

    // [SYNC] 뒤늦게 진입한 탭을 위한 타 탭 상태 확인 (Request-Response)
    useEffect(() => {
        requestActiveProject();
    }, []);
    
    // Modal states
    const [deleteModal, setDeleteModal] = useState({ isOpen: false, projectId: null, projectName: '' });
    const [copyModal, setCopyModal] = useState({ isOpen: false, projectId: null, projectName: '' });
    const [searchTerm, setSearchTerm] = useState('');
    const [isSearchVisible, setIsSearchVisible] = useState(false);
    const [copyNewName, setCopyNewName] = useState('');
    const [isCopying, setIsCopying] = useState(false);
    const searchInputRef = useRef(null);

    // [UX] 전역 키 이벤트를 통한 자동 검색 활성화
    useEffect(() => {
        const handleGlobalKeyDown = (e) => {
            // 모달이 열려있으면 무시
            if (deleteModal.isOpen || copyModal.isOpen) return;

            // 입력창에 이미 포커스가 있으면 무시
            const isInputFocused = document.activeElement.tagName === 'INPUT' || 
                                 document.activeElement.tagName === 'TEXTAREA' ||
                                 document.activeElement.isContentEditable;
            
            // ESC 키 처리
            if (e.key === 'Escape') {
                if (isSearchVisible) {
                    setIsSearchVisible(false);
                    setSearchTerm('');
                    searchInputRef.current?.blur();
                }
                return;
            }

            // [NEW] '`' (Backtick) 단축키: 검색바 토글
            if (e.key === '`') {
                e.preventDefault();
                const nextVisible = !isSearchVisible;
                setIsSearchVisible(nextVisible);
                if (nextVisible) {
                    setSearchTerm('');
                    setTimeout(() => searchInputRef.current?.focus(), 50);
                } else {
                    setSearchTerm('');
                    searchInputRef.current?.blur();
                }
                return;
            }

            // [NEW] 's' 또는 '/' 단축키: 검색바 열기 (입력 방지)
            if (!isSearchVisible && (e.key.toLowerCase() === 's' || e.key === '/')) {
                e.preventDefault();
                setIsSearchVisible(true);
                setSearchTerm('');
                setTimeout(() => searchInputRef.current?.focus(), 50);
                return;
            }

            // 글로벌 단축키(Q, T, /) 우선순위 보장 (Header.jsx와 연동)
            const isGlobalShortcut = ['q', 't', '/'].includes(e.key.toLowerCase());
            if (!isSearchVisible && isGlobalShortcut && e.key !== '/') {
                return;
            }

            if (isInputFocused) return;

            // 출력 가능한 문자인지 확인 (한글/영문/숫자 등) - Type to Search
            if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
                // 검색바가 닫혀있다면 열기
                if (!isSearchVisible) {
                    setIsSearchVisible(true);
                    setSearchTerm(e.key);
                    // 상태 업데이트 후 포커스
                    setTimeout(() => {
                        searchInputRef.current?.focus();
                        // 포커스 후 커서를 끝으로 보냄
                        const val = searchInputRef.current.value;
                        searchInputRef.current.value = '';
                        searchInputRef.current.value = val;
                    }, 50);
                    e.preventDefault();
                }
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [isSearchVisible, deleteModal.isOpen, copyModal.isOpen]);

    const handleDeleteClick = (project) => {
        setDeleteModal({ isOpen: true, projectId: project.id, projectName: project.name });
    };

    const handleDeleteConfirm = async () => {
        const targetId = deleteModal.projectId;
        await deleteProject(targetId);
        
        // [SYNC] 타 탭 활성 세션 종료 및 전체 리스트 갱신 전파
        useDataStore.getState().broadcastDelete(targetId);
        broadcastListUpdate(); 
        
        setDeleteModal({ isOpen: false, projectId: null, projectName: '' });
    };

    const handleCopyClick = (project) => {
        setCopyNewName(`${project.name} (복사본)`);
        setCopyModal({ isOpen: true, projectId: project.id, projectName: project.name });
    };

    const handleCopyConfirm = async () => {
        if (!copyNewName.trim() || isCopying) return;
        
        setIsCopying(true);
        try {
            await copyProject(copyModal.projectId, copyNewName);
            
            // [SYNC] 전체 리스트 갱신 전파
            broadcastListUpdate();
            
            setCopyModal({ isOpen: false, projectId: null, projectName: '' });
            setCopyNewName('');
        } catch (error) {
            console.error('Failed to copy project:', error);
            alert('프로젝트 복사 중 오류가 발생했습니다.');
        } finally {
            setIsCopying(false);
        }
    };

    // 날짜 포맷팅 함수 (YY-MM-DD HH:mm)
    const formatModifiedDate = (dateStr) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        const y = String(date.getFullYear()).slice(-2);
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        const h = String(date.getHours()).padStart(2, '0');
        const min = String(date.getMinutes()).padStart(2, '0');
        return `${y}-${m}-${d} ${h}:${min}`;
    };

    return (
        <div className="px-4 md:px-6 lg:px-8 max-w-7xl mx-auto pb-8">
            {/* Page Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-white mb-2">PROJECT LIST</h1>
                <p className="text-gray-400 text-sm">작업을 위해 프로젝트를 선택하거나 새로 생성하세요.</p>
            </div>

            {/* Controls: New Project & Search */}
            <div className="mb-8 flex items-center gap-3">
                {/* Square New Button */}
                <button
                    onClick={() => {
                        window.dispatchEvent(new CustomEvent('kelc_request_dirty_check_nav', {
                            detail: { path: '/project/new' }
                        }));
                    }}
                    className="w-12 h-12 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-lg shadow-blue-900/20 active:scale-95 shrink-0"
                    title="새 프로젝트 생성"
                >
                    <Plus size={22} />
                </button>

                {/* Square Search Icon Button (Toggle) */}
                <button
                    onClick={() => {
                        const nextVisible = !isSearchVisible;
                        setIsSearchVisible(nextVisible);
                        if (nextVisible) {
                            setSearchTerm('');
                            setTimeout(() => searchInputRef.current?.focus(), 100);
                        } else {
                            setSearchTerm('');
                        }
                    }}
                    className={`w-12 h-12 flex items-center justify-center border transition-all active:scale-95 shrink-0 ${isSearchVisible ? 'bg-blue-500/10 border-blue-500/50 text-blue-400' : 'bg-black border-gray-800 text-gray-400 hover:text-white hover:border-gray-700'}`}
                    title="프로젝트 검색"
                >
                    <Search size={22} />
                </button>

                {/* Search Input (Animated/Toggleable) */}
                <div className={`flex-1 transition-all duration-300 overflow-hidden ${isSearchVisible ? 'max-w-md opacity-100' : 'max-w-0 opacity-0'}`}>
                    <div className="relative group">
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="프로젝트 이름 검색..."
                            className="w-full bg-gray-900/50 border border-gray-800 text-white pl-4 pr-10 py-3 text-sm outline-none focus:border-blue-500/50 focus:bg-gray-900 transition-all"
                        />
                        {searchTerm && (
                            <button 
                                onClick={() => {
                                    setSearchTerm('');
                                    searchInputRef.current?.focus();
                                }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white p-1"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Projects Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects
                    .filter(project => 
                        project.name.replace(/\s/g, '').toLowerCase().includes(searchTerm.replace(/\s/g, '').toLowerCase())
                    )
                    .sort((a, b) => {
                        if (a.id === activeProjectId) return -1;
                        if (b.id === activeProjectId) return 1;
                        return 0;
                    })
                    .map(project => {
                        const isActive = project.id === activeProjectId;
                        
                        return (
                        <div
                            key={project.id}
                            className={`relative bg-black border transition-all duration-500 group ${
                                isActive ? 'border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.1)]' : 'border-gray-800 hover:border-gray-700'
                            }`}
                        >
                            <CornerBorders isActive={isActive} />
                            <div className="p-5">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-start gap-3">
                                        <div className={`p-2 rounded flex-shrink-0 transition-colors ${
                                            isActive ? 'bg-emerald-500/20' : 'bg-blue-500/20'
                                        }`}>
                                            <Folder size={20} className={isActive ? 'text-emerald-400' : 'text-blue-400'} />
                                        </div>
                                        <div>
                                            <h3 className="text-white font-bold text-sm break-keep">{project.name}</h3>
                                            <p className="text-gray-500 text-xs">{project.date} | {project.client || '-'}</p>
                                        </div>
                                    </div>
                                <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                    <button
                                        onClick={() => handleDeleteClick(project)}
                                        className="p-1 text-gray-600 hover:text-red-500 transition-colors"
                                        title="삭제"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleCopyClick(project)}
                                        className="p-1 text-gray-600 hover:text-yellow-500 transition-colors"
                                        title="복사"
                                    >
                                        <Copy size={16} />
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-gray-400 text-[10px] sm:text-xs">
                                        {project.calculators?.filter(c => c.enabled).length || 0}개 계산서
                                    </span>
                                    <span className="text-gray-600 text-[10px]">|</span>
                                    <span className={`${project.is_last_draft ? 'text-gray-500' : 'text-blue-400'} text-[10px]`}>
                                        수정: {formatModifiedDate(project.updated_at)}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3">
                                    {isActive && (
                                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 rounded-full animate-pulse">
                                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_5px_#10b981]"></div>
                                            <span className="text-emerald-400 text-[10px] font-black tracking-tighter uppercase whitespace-nowrap">Active</span>
                                        </div>
                                    )}
                                    <button
                                        onClick={() => {
                                            const currentPid = localStorage.getItem('kelc_active_project_id');
                                            if (project.id === currentPid) {
                                                navigate(`/project/${project.id}`);
                                            } else {
                                                window.dispatchEvent(new CustomEvent('kelc_request_dirty_check_nav', {
                                                    detail: { path: `/project/${project.id}` }
                                                }));
                                            }
                                        }}
                                        className={`flex items-center gap-1 text-[11px] sm:text-xs font-bold uppercase tracking-widest transition-colors ${
                                            isActive ? 'text-emerald-400 hover:text-emerald-300' : 'text-blue-400 hover:text-blue-300'
                                        }`}
                                    >
                                        열기 <ChevronRight size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );})}

                {/* Empty State */}
                {projects.filter(project => 
                    project.name.replace(/\s/g, '').toLowerCase().includes(searchTerm.replace(/\s/g, '').toLowerCase())
                ).length === 0 && (
                    <div className="col-span-full text-center py-16">
                        <Folder size={48} className="text-gray-700 mx-auto mb-4" />
                        <p className="text-gray-500 mb-4">
                            {searchTerm ? `'${searchTerm}'에 대한 검색 결과가 없습니다.` : '프로젝트가 없습니다.'}
                        </p>
                        <button
                            onClick={() => {
                                window.dispatchEvent(new CustomEvent('kelc_request_dirty_check_nav', {
                                    detail: { path: '/project/new' }
                                }));
                            }}
                            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300"
                        >
                            <Plus size={16} />
                            새 프로젝트 만들기
                        </button>
                    </div>
                )}
            </div>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={deleteModal.isOpen}
                onClose={() => setDeleteModal({ isOpen: false, projectId: null, projectName: '' })}
                title="프로젝트 삭제"
            >
                <p className="text-gray-300 text-sm mb-6">
                    <span className="text-white font-bold">"{deleteModal.projectName}"</span> 를 삭제합니다.
                    <br />
                    <span className="text-red-400 text-xs">이 작업은 되돌릴 수 없습니다.</span>
                </p>
                <div className="flex gap-3 justify-end">
                    <button
                        onClick={() => setDeleteModal({ isOpen: false, projectId: null, projectName: '' })}
                        className="px-4 py-2 border border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800 text-sm font-bold uppercase tracking-widest transition-colors"
                    >
                        취소
                    </button>
                    <button
                        onClick={handleDeleteConfirm}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold uppercase tracking-widest transition-colors"
                    >
                        삭제
                    </button>
                </div>
            </Modal>

            {/* Copy Project Modal */}
            <Modal
                isOpen={copyModal.isOpen}
                onClose={() => setCopyModal({ isOpen: false, projectId: null, projectName: '' })}
                title="프로젝트 복사"
            >
                <p className="text-gray-300 text-sm mb-3">
                    <span className="text-white font-bold">"{copyModal.projectName}"</span> 를 복사합니다.
                </p>
                <div className="mb-6">
                    <label className="block text-xs text-blue-500 mb-2 uppercase tracking-widest">새 프로젝트 이름</label>
                    <input
                        type="text"
                        value={copyNewName}
                        onChange={(e) => setCopyNewName(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-500 text-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                    />
                </div>
                <div className="flex gap-3 justify-end">
                    <button
                        onClick={() => setCopyModal({ isOpen: false, projectId: null, projectName: '' })}
                        disabled={isCopying}
                        className="px-4 py-2 border border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-bold uppercase tracking-widest transition-colors"
                    >
                        취소
                    </button>
                    <button
                        onClick={handleCopyConfirm}
                        disabled={!copyNewName.trim() || isCopying}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white text-sm font-bold uppercase tracking-widest transition-colors flex items-center gap-2"
                    >
                        {isCopying ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                복사 중...
                            </>
                        ) : (
                            '복사'
                        )}
                    </button>
                </div>
            </Modal>
        </div>
    );
};

export default ProjectList;

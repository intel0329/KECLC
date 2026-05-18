import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, ShieldCheck, Database, Zap } from 'lucide-react';
import useDataStore from '../store/useDataStore';
import projectService from '../services/projectService';

/**
 * Project Sync Overlay
 * Provides a clean, safe initialization phase for newly opened or copied projects.
 * Prevents infinite loops by pre-loading data and cleaning cache.
 */
const ProjectSyncOverlay = ({ projectId, onComplete }) => {
    const { loadPanel, initProject } = useDataStore();
    const [status, setStatus] = useState('initializing');
    const [progress, setProgress] = useState(0);
    const [message, setMessage] = useState('프로젝트 데이터를 구성하고 있습니다...');
    const [isDone, setIsDone] = useState(false);

    useEffect(() => {
        const performSync = async () => {
            if (!projectId) return;

            try {
                // 1. Initial Delay for visual comfort
                await new Promise(r => setTimeout(r, 500));
                
                // 2. Clear Old Caches (Emergency run)
                setMessage('로컬 캐시를 최적화하고 있습니다...');
                setStatus('clearing_cache');
                
                // [Stability] 기존 로컬 캐시를 초기화하여 서버 데이터와의 정합성을 보장합니다.
                const keys = Object.keys(localStorage);
                keys.forEach(k => {
                    if (k.startsWith('kelc_panel_cache_') && k.includes(projectId)) {
                        localStorage.removeItem(k);
                    }
                });
                
                setProgress(20);
                await new Promise(r => setTimeout(r, 600));

                // 3. Fetch Project Structure
                setMessage('프로젝트 구성을 불러오고 있습니다...');
                setStatus('loading_structure');
                const project = await projectService.getProject(projectId);
                if (!project || !project.calculators) {
                    throw new Error("Project structure not found");
                }
                setProgress(40);

                // 4. Collect all Panel IDs
                const panelIds = [];
                const collectIds = (items) => {
                    if (!items) return;
                    items.forEach(item => {
                        if (item.id) panelIds.push(item.id);
                        if (item.children) collectIds(item.children);
                    });
                };
                collectIds(project.calculators);

                // 5. Sequential Pre-loading (Prevents network & loop explosion)
                setMessage(`${panelIds.length}개의 계산서 데이터를 동기화하고 있습니다...`);
                setStatus('syncing_panels');
                
                for (let i = 0; i < panelIds.length; i++) {
                    const id = panelIds[i];
                    // [Stability] force=true를 전달하여 로컬 저장소 대신 서버의 최신 데이터를 강제로 가져옵니다.
                    await loadPanel(id, true);
                    // Update progress incrementally
                    const currentProgress = 40 + ((i + 1) / panelIds.length) * 50;
                    setProgress(currentProgress);
                }

                // 6. Complete
                setMessage('모든 데이터가 최신 상태로 동기화되었습니다.');
                setStatus('completed');
                setProgress(100);
                setIsDone(true);

                // Final wait for user to see the success state
                await new Promise(r => setTimeout(r, 800));
                if (onComplete) onComplete();

            } catch (err) {
                console.error("Sync failed:", err);
                setMessage('동기화 중 오류가 발생했습니다. 잠시 후 상단 저장 버튼을 눌러주세요.');
                setStatus('error');
                await new Promise(r => setTimeout(r, 2000));
                if (onComplete) onComplete();
            }
        };

        performSync();
    }, [projectId, loadPanel, onComplete]);

    return (
        <div className="fixed inset-0 z-[9999] bg-gray-950/95 backdrop-blur-sm flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-black border border-gray-800 p-8 relative overflow-hidden shadow-2xl">
                {/* Decorative Background Elements */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-cyan-400 to-blue-600 animate-pulse" />
                <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl" />

                <div className="relative z-10">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="p-3 bg-blue-500/20 rounded-xl">
                            {status === 'completed' ? (
                                <ShieldCheck className="text-blue-400 w-8 h-8" />
                            ) : (
                                <Loader2 className="text-blue-400 w-8 h-8 animate-spin" />
                            )}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white tracking-tight">PROJECT SYNC</h2>
                            <p className="text-blue-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                                <Zap size={10} /> 시스템 안정화 프로세스 가동 중
                            </p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {/* Progress Bar Container */}
                        <div className="space-y-2">
                            <div className="flex justify-between text-[10px] uppercase font-bold tracking-widest">
                                <span className={status === 'error' ? 'text-red-400' : 'text-gray-500 italic'}>
                                    {status === 'error' ? 'FAILED' : 'Processing...'}
                                </span>
                                <span className="text-blue-400">{Math.round(progress)}%</span>
                            </div>
                            <div className="h-1.5 bg-gray-900 overflow-hidden">
                                <div 
                                    className="h-full bg-blue-500 transition-all duration-500 ease-out shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>

                        {/* Status Message */}
                        <div className={`p-4 border transition-colors ${status === 'error' ? 'bg-red-500/5 border-red-500/20' : 'bg-gray-900/50 border-gray-800'}`}>
                            <p className={`text-xs leading-relaxed ${status === 'error' ? 'text-red-400' : 'text-gray-300'}`}>
                                {message}
                            </p>
                        </div>

                        {/* Detail Steps */}
                        <div className="grid grid-cols-2 gap-3">
                            <StepItem 
                                label="Cache" 
                                active={status === 'clearing_cache'} 
                                done={progress > 20} 
                                icon={<Database size={12} />}
                            />
                            <StepItem 
                                label="Calculators" 
                                active={status === 'syncing_panels'} 
                                done={status === 'completed'} 
                                icon={<CheckCircle2 size={12} />}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const StepItem = ({ label, active, done, icon }) => (
    <div className={`flex items-center gap-2 p-2 px-3 border transition-colors ${active ? 'border-blue-500/50 bg-blue-500/5' : (done ? 'border-gray-800 bg-gray-900/30' : 'border-gray-900 bg-transparent')}`}>
        <span className={active ? 'text-blue-400' : (done ? 'text-green-500' : 'text-gray-700')}>
            {icon}
        </span>
        <span className={`text-[10px] font-bold uppercase tracking-widest ${active ? 'text-white' : (done ? 'text-gray-400' : 'text-gray-700')}`}>
            {label}
        </span>
    </div>
);

export default ProjectSyncOverlay;

import React from 'react';

/**
 * 에너지 플로우의 개별 노드 카드(PanelNodeCard)를 본뜬 스켈레톤 아이템
 */
const SkeletonNode = () => (
    <div className="w-[220px] bg-white rounded-2xl p-5 border border-slate-100 shadow-sm shrink-0">
        <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden">
                <div className="w-full h-full skeleton-box opacity-30" />
            </div>
            <div className="flex-grow">
                <div className="h-4 w-28 skeleton-box mb-1.5" />
                <div className="h-2.5 w-20 skeleton-box opacity-30" />
            </div>
        </div>
        
        <div className="mt-4 pt-4 border-t border-slate-50 space-y-3">
            <div className="flex justify-between items-end">
                <div className="h-2.5 w-16 skeleton-box opacity-40" />
                <div className="h-7 w-24 skeleton-box" />
            </div>
            <div className="w-full bg-slate-50 rounded-full h-1.5 my-2 overflow-hidden">
                <div className="h-full w-1/2 skeleton-box opacity-30" />
            </div>
            <div className="flex gap-2 pt-1">
                <div className="h-4.5 w-14 skeleton-box rounded opacity-50" />
                <div className="h-4.5 w-14 skeleton-box rounded opacity-50" />
                <div className="h-4.5 w-20 skeleton-box rounded opacity-50" />
            </div>
        </div>
    </div>
);

/**
 * 전체 에너지 플로우 화면을 덮는 스켈레톤 레이아웃
 */
const VisualSkeleton = () => {
    return (
        <div className="w-full h-[calc(100dvh-50px)] bg-[#f8fafc] flex flex-col overflow-hidden relative z-50">
            {/* 상단 프로젝트 정보 영역 (Project Info Panel Placeholder) */}
            <div className="p-4 md:p-8 mt-5 md:m-4">
                <div className="hidden md:block h-8 w-72 skeleton-box mb-5" />
                <div className="flex flex-row md:flex-col gap-4 md:gap-3.5 mt-2">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="flex items-center gap-2 md:gap-3.5">
                            <div className="w-2 md:w-2.5 h-2 md:h-2.5 rounded-full skeleton-box opacity-60" />
                            <div className="h-2 md:h-2.5 w-16 md:w-24 skeleton-box opacity-30" />
                        </div>
                    ))}
                </div>
            </div>

            {/* 메인 그래프 영역 (Tree Structure Simulation) */}
            <div className="flex-grow flex items-center justify-center p-6 md:p-12 overflow-hidden pointer-events-none">
                <div className="flex items-center gap-12 md:gap-24 opacity-60 scale-75 md:scale-95 translate-y-[-20px]">
                    {/* Level 0 (Main TR) */}
                    <SkeletonNode />
                    
                    {/* Level 1 (Panels) */}
                    <div className="flex flex-col gap-12 md:gap-16">
                        <SkeletonNode />
                        <SkeletonNode />
                    </div>

                    {/* Level 2 (Sub Panels) */}
                    <div className="flex flex-col gap-12 md:gap-16">
                        <SkeletonNode />
                        <SkeletonNode />
                    </div>
                </div>
            </div>

            {/* 좌측 하단 툴바 영역 (ToolBar Placeholder) - 중앙 정렬로 변경 */}
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/80 backdrop-blur-md rounded-full p-2 md:p-2.5 border border-slate-200/50 shadow-sm">
                {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="w-8 md:w-10 h-8 md:h-10 rounded-full skeleton-box opacity-20" />
                ))}
            </div>

            {/* 로딩 텍스트 알림 */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 font-mono text-[9px] md:text-[10px] text-slate-300 font-bold uppercase tracking-[0.3em] md:tracking-[0.4em] mt-24 md:mt-32">
                Mapping Power Grid...
            </div>
        </div>
    );
};

export default VisualSkeleton;

import React from 'react';

const SkeletonBox = ({ className = "" }) => (
    <div className={`skeleton-box ${className}`} />
);

const FeederSkeleton = () => {
    return (
        <div className="skeleton-container fixed inset-0 z-[5000] bg-black flex flex-col overflow-hidden">
            {/* Top Header Skeleton Overlay (Centered like real header) */}
            <div className="h-[60px] border-b border-gray-900 bg-black flex justify-center">
                <div className="w-full max-w-[1920px] flex items-center px-4 sm:px-6 justify-between">
                    <div className="flex items-center gap-8">
                        <div className="flex gap-2">
                            <SkeletonBox className="w-5 h-5 bg-gray-800 opacity-60" />
                            <SkeletonBox className="w-5 h-5 bg-gray-800 opacity-60" />
                            <SkeletonBox className="w-5 h-5 bg-gray-800 opacity-60" />
                        </div>
                        <SkeletonBox className="w-40 h-4 bg-gray-800 opacity-50" />
                    </div>
                    <div className="flex items-center gap-4">
                        <SkeletonBox className="w-32 h-8 rounded-md bg-blue-900/30 opacity-60" />
                        <SkeletonBox className="w-8 h-8 rounded-full bg-gray-800 opacity-40" />
                    </div>
                </div>
            </div>

            {/* Content Area (Constrained to 1920px) */}
            <div className="flex-grow overflow-hidden flex justify-center">
                <div className="w-full max-w-[1920px] h-full flex flex-col p-4 sm:p-6 lg:p-8 space-y-8 overflow-hidden">
                    {/* Top Project Bar */}
                    <div className="flex flex-col sm:flex-row gap-8 items-end border-b border-gray-900 pb-10">
                        <div className="flex-grow space-y-4">
                            <SkeletonBox className="w-20 h-2 bg-gray-800 opacity-40" />
                            <SkeletonBox className="w-2/3 max-w-2xl h-10 rounded-sm bg-gray-800 opacity-60" />
                        </div>
                        <div className="flex gap-6">
                            <div className="space-y-3">
                                <SkeletonBox className="w-12 h-2 bg-gray-800 opacity-40" />
                                <SkeletonBox className="w-32 h-8 rounded-sm bg-gray-800 opacity-50" />
                            </div>
                            <div className="space-y-3">
                                <SkeletonBox className="w-12 h-2 bg-gray-800 opacity-40" />
                                <SkeletonBox className="w-32 h-8 rounded-sm bg-gray-800 opacity-50" />
                            </div>
                        </div>
                    </div>

                    {/* Main Table Block */}
                    <div className="flex-grow border border-gray-900 rounded-sm bg-gray-950/20 flex flex-col overflow-hidden shadow-2xl">
                        <div className="grid grid-cols-6 border-b border-gray-900 bg-black/60">
                            {['LOAD', 'V-DROP', 'BREAKER', 'CONDUCTOR', 'CABLE', 'CONDUIT'].map((_, i) => (
                                <div key={i} className="p-5 border-r border-gray-900 last:border-r-0 flex flex-col items-center gap-3">
                                    <SkeletonBox className="w-16 h-4 opacity-20" />
                                </div>
                            ))}
                        </div>

                        <div className="flex-grow p-6 space-y-5 overflow-hidden">
                            {Array.from({ length: 12 }).map((_, i) => (
                                <div key={i} className="flex gap-6 items-center">
                                    <SkeletonBox className="w-6 h-6 rounded-sm bg-gray-800 opacity-30" />
                                    <SkeletonBox className="w-48 h-5 rounded-sm bg-gray-800 opacity-40" />
                                    <SkeletonBox className="flex-grow h-5 rounded-sm bg-gray-800 opacity-20" />
                                    <SkeletonBox className="w-32 h-5 rounded-sm bg-gray-800 opacity-30" />
                                    <SkeletonBox className="w-32 h-5 rounded-sm bg-gray-800 opacity-30" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Nav Bar (Centered) */}
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2">
                <SkeletonBox className="w-[450px] h-14 rounded-2xl opacity-15 shadow-[0_0_50px_rgba(0,0,0,0.8)]" />
            </div>
        </div>
    );
};

export default FeederSkeleton;


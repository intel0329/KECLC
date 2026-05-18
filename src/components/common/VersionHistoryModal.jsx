import React from 'react';
import { X, Calendar } from 'lucide-react';
import versions from '../../data/versions.json';

const VersionHistoryModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 sm:p-6 md:p-8 overflow-hidden">
            {/* Backdrop with extreme blur */}
            <div 
                className="absolute inset-0 bg-black/60 backdrop-blur-xl transition-opacity duration-300 ease-in-out"
                onClick={onClose}
            />
            
            {/* Modal Container */}
            <div className="relative w-full max-w-2xl max-h-[80vh] bg-[#0A0A0A]/90 border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)] rounded-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300">
                
                {/* Glow Effect */}
                <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-500/10 blur-[100px] pointer-events-none" />
                <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-500/10 blur-[100px] pointer-events-none" />

                {/* Header */}
                <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between bg-white/5 backdrop-blur-md">
                    <div>
                        <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
                            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Version History</span>
                        </h2>
                        <p className="text-gray-400 text-xs mt-1 font-light tracking-wide italic">KEC Logic Calculator Update Log</p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-all duration-200"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-10">
                    {versions.map((version, idx) => (
                        <div key={idx} className="relative pl-8 group">
                            {/* Vertical Timeline Line */}
                            {idx !== versions.length - 1 && (
                                <div className="absolute left-3 top-7 bottom-[-40px] w-[1px] bg-gradient-to-b from-blue-500/50 to-transparent" />
                            )}
                            
                            {/* Timeline Dot */}
                            <div className="absolute left-0 top-1.5 w-6 h-6 rounded-full bg-black border border-blue-500/50 flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.3)] group-hover:scale-110 transition-transform">
                                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                            </div>

                            <div className="space-y-4">
                                <div className="flex flex-wrap items-baseline gap-3">
                                    <span className="text-blue-400 font-mono text-sm flex items-center gap-1.5">
                                        <Calendar size={12} /> {version.date}
                                    </span>
                                    <h3 className="text-lg font-semibold text-white tracking-tight">{version.title}</h3>
                                </div>

                                <div className="grid gap-2.5">
                                    {version.changes.map((change, cIdx) => (
                                        <div key={cIdx} className="flex items-start gap-3 text-gray-400 text-sm leading-relaxed group/item">
                                            <div className="mt-1.5 w-1 h-1 rounded-full bg-gray-600 group-hover/item:bg-blue-400 transition-colors shrink-0" />
                                            <span className="group-hover/item:text-gray-200 transition-colors">{change}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="px-8 py-5 border-t border-white/5 bg-black/40 flex justify-center">
                    <p className="text-[10px] text-gray-600 uppercase tracking-[0.3em] font-medium">Always evolving for professional precision</p>
                </div>
            </div>
        </div>
    );
};

export default VersionHistoryModal;

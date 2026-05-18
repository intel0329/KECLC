import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import BandChart from './BandChart';

/**
 * 에너지 밴드 풀스크린 팝업 (Supernova Edition)
 * 
 * 대격변된 확산형 차트에 맞춘 심연의 블랙 테마와 강렬한 광원 연출.
 */
const VisualBandPopup = ({ data, onClose }) => {
    const [visible, setVisible] = useState(false);
    const [closing, setClosing] = useState(false);

    useEffect(() => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => setVisible(true));
        });

        const onKey = (e) => {
            if (e.key === 'Escape') handleClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, []);

    const handleClose = () => {
        setClosing(true);
        setTimeout(() => onClose(), 800);
    };

    if (!data) return null;

    const show = visible && !closing;

    return (
        <div
            className="fixed inset-0 z-[9999] flex flex-col items-stretch overflow-hidden"
            style={{
                backgroundColor: show ? 'rgba(2, 2, 4, 0.98)' : 'rgba(0,0,0,0)',
                backdropFilter: show ? 'blur(80px) saturate(1.5)' : 'blur(0px)',
                WebkitBackdropFilter: show ? 'blur(80px) saturate(1.5)' : 'blur(0px)',
                transition: 'all 0.8s cubic-bezier(0.16,1,0.3,1)'
            }}
            onClick={(e) => {
                if (e.target === e.currentTarget) handleClose();
            }}
        >
            {/* ── 심연의 비네팅 ── */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    background: 'radial-gradient(circle at 30% 50%, rgba(255,100,0,0.03) 0%, rgba(0,0,0,0) 70%)',
                    boxShadow: 'inset 0 0 300px rgba(0,0,0,1)',
                    opacity: show ? 1 : 0,
                    transition: 'opacity 1.5s ease'
                }}
            />

            {/* ── 입자 질감 (Micro Dust) ── */}
            <div
                className="absolute inset-0 pointer-events-none opacity-20"
                style={{
                    backgroundImage: 'url("https://www.transparenttextures.com/patterns/stardust.png")',
                    backgroundRepeat: 'repeat',
                    mixBlendMode: 'overlay',
                    opacity: show ? 0.3 : 0,
                    transition: 'opacity 2s ease'
                }}
            />

            {/* ════════════════════════════════════════ */}
            {/*  Top Navigation (Ultra Minimal)          */}
            {/* ════════════════════════════════════════ */}
            <div
                className="absolute top-10 left-12 right-12 flex items-center justify-between z-50 pointer-events-none"
                style={{
                    opacity: show ? 1 : 0,
                    transform: show ? 'translateY(0)' : 'translateY(-30px)',
                    transition: 'all 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) 0.4s'
                }}
            >
                <div className="flex flex-col">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-[1px] bg-gradient-to-r from-transparent via-orange-500 to-transparent" />
                        <span className="text-orange-500 font-black text-[10px] tracking-[0.4em] uppercase">System Pulse</span>
                        <div className="w-12 h-[1px] bg-gradient-to-r from-transparent via-orange-500 to-transparent" />
                    </div>
                    <h2 className="text-white text-4xl font-black italic tracking-tighter mt-1" style={{ filter: 'drop-shadow(0 0 20px rgba(255,100,0,0.3))' }}>
                        ENERGY FLOW <span className="text-white/20 not-italic font-thin">X</span>
                    </h2>
                </div>

                <button
                    onClick={handleClose}
                    className="group relative p-3 rounded-full pointer-events-auto bg-white/5 border border-white/10 hover:bg-orange-600 hover:border-orange-500 transition-all duration-500"
                >
                    <X size={28} strokeWidth={3} className="text-white/40 group-hover:text-white group-hover:rotate-90 transition-all duration-500" />
                    <div className="absolute inset-0 rounded-full group-hover:blur-xl group-hover:bg-orange-600/50 transition-all" />
                </button>
            </div>

            {/* ════════════════════════════════════════ */}
            {/*  Expansion Engine Canvas                 */}
            {/* ════════════════════════════════════════ */}
            <div
                className="flex-1 w-full h-full relative"
                style={{
                    opacity: show ? 1 : 0,
                    transform: show ? 'scale(1)' : 'scale(1.05) translateZ(0)',
                    transition: 'all 1.2s cubic-bezier(0.16,1,0.3,1) 0.5s'
                }}
            >
                <BandChart data={data} />
            </div>

            {/* ════════════════════════════════════════ */}
            {/*  Bottom Metrics (High-Tech)               */}
            {/* ════════════════════════════════════════ */}
            <div
                className="absolute bottom-12 left-12 right-12 flex items-center justify-between pointer-events-none"
                style={{
                    opacity: show ? 1 : 0,
                    transform: show ? 'translateY(0)' : 'translateY(30px)',
                    transition: 'all 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) 0.7s'
                }}
            >
                <div className="flex items-baseline gap-4">
                    <span className="text-white/40 font-black text-6xl italic leading-none">{data.circuitCount}</span>

                    {/* --- Load Type Statistics (Vivid Colors for Readability) --- */}
                    {data.typeStats && data.typeStats.length > 0 && (
                        <div className="flex items-center gap-8 pl-8 ml-4 border-l border-white/10 h-10 self-center">
                            {data.typeStats.map((s, si) => (
                                <div key={si} className="flex flex-col">
                                    <span className="text-white/50 text-[9px] font-black uppercase tracking-[0.2em]">{s.label}</span>
                                    <div className="flex items-baseline gap-1 mt-0.5">
                                        <span className="text-white/90 text-sm font-black tabular-nums tracking-tighter">{s.kva.toFixed(1)}</span>
                                        <span className="text-white/30 text-[9px] font-bold uppercase ml-0.5">kVA</span>
                                        <span className="text-white/40 text-[10px] font-bold ml-1.5 small-caps">({s.percent.toFixed(0)}%)</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex flex-col items-end">
                    <span className="text-white/30 text-[10px] font-black tracking-[0.3em] uppercase mb-2">Power Consumption Index</span>
                    <div className="flex gap-1.5">
                        {[...Array(12)].map((_, i) => (
                            <div 
                                key={i} 
                                className="w-1.5 h-6 rounded-full" 
                                style={{ 
                                    backgroundColor: i < 8 ? fireColor(i/12, 0.8) : 'rgba(255,255,255,0.05)',
                                    boxShadow: i < 8 ? `0 0 15px ${fireColor(i/12, 0.4)}` : 'none',
                                    animation: i < 8 ? `pulse 2s infinite ease-in-out ${i * 0.1}s` : 'none'
                                }} 
                            />
                        ))}
                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes pulse {
                    0%, 100% { opacity: 0.6; transform: scaleY(1); }
                    50% { opacity: 1; transform: scaleY(1.2); }
                }
            `}} />
        </div>
    );
};

// Helper for consistent styling
const fireColor = (r, a = 1) => {
    const h = 48 - r * 52;
    const s = 90 + r * 10;
    const l = 50 + r * 15;
    return `hsla(${h},${s}%,${l}%,${a})`;
};

export default VisualBandPopup;

import React, { useRef, useEffect, useState, useMemo } from 'react';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  Constants & Config
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const PANEL_BAR_W = 12; // 더 슬림하고 세련된 판넬 코어
const BASE_MIN_BAND = 1.5;
const BASE_GAP = 5; // 우측 확산 지점에서의 간격 확대
const LABEL_VISIBLE_THRESHOLD = 40;
const HOVER_EXPAND = 1.5; // 하이라이트 시 미세 확대 폭 (픽셀)

/**
 * Premium Energy Palette (Neon Fire)
 * 가시성을 높이고 화려한 색감을 위해 HSL 범위를 확장합니다.
 */
const fireColor = (r, a = 1, lOffset = 0) => {
    const h = 48 - r * 52; // 48(Gold) -> -4(Deep Crimson)
    const s = 90 + r * 10;
    const l = 50 + r * 15 + lOffset;
    return `hsla(${h},${s}%,${l}%,${a})`;
};

const neonGlow = (r) => `hsla(${48 - r * 52}, 100%, 65%, 0.6)`;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  유선형(S-Curve) 경로 생성기
//  더 역동적인 곡률을 위해 제어점(cp)을 높이 차이에 반응하게 설계
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const expansionPath = (lx, ly, lh, rx, ry, rh, cpX) => {
    // 중앙 흐름을 더 유연하게 만들기 위해 제어점을 좌우로 배치
    const c1x = lx + cpX * 0.4;
    const c2x = rx - cpX * 0.6;
    
    return `M${lx},${ly} ` +
           `C${c1x},${ly} ${c2x},${ry} ${rx},${ry} ` +
           `L${rx},${ry + rh} ` +
           `C${c2x},${ry + rh} ${c1x},${ly + lh} ${lx},${ly + lh} ` +
           `Z`;
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  BandChart Component (Expansion Edition)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const BandChart = ({ data }) => {
    const containerRef = useRef(null);
    const [size, setSize] = useState({ w: 0, h: 0 });
    const [ready, setReady] = useState(false);
    const [hovered, setHovered] = useState(null);
    const [grow, setGrow] = useState(0);
    const hoverTimeoutRef = useRef(null); // 지능형 지연 복구를 위한 타이머 레프

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const ro = new ResizeObserver(entries => {
            const { width, height } = entries[0].contentRect;
            setSize({ w: Math.floor(width), h: Math.floor(height) });
        });
        ro.observe(el);

        const t = setTimeout(() => {
            setReady(true);
            setGrow(1);
        }, 100);

        return () => { 
            ro.disconnect(); 
            clearTimeout(t);
            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        };
    }, []);

    // ══════════════════════════════════════
    //  Expansion Layout Engine (클리핑 무결성 유지)
    // ══════════════════════════════════════
    const layout = useMemo(() => {
        if (!data?.circuits?.length || size.w < 100 || size.h < 100) return null;

        const { circuits, totalVA } = data;
        const n = circuits.length;

        // 1920x1080 최적화 마진
        const mg = {
            t: size.h * 0.05,
            b: size.h * 0.05,
            l: Math.max(120, size.w * 0.1),
            r: Math.max(220, size.w * 0.25)
        };

        const canvasH = size.h - mg.t - mg.b;
        
        // --- [대격변 2단계: 가변 굵기(Dynamic Thickness) 도입] ---
        const minWeight = 1.0;     // 모든 회로가 기본으로 갖는 최소 무게
        const scaleFactor = 12.0;   // 부하 비중에 따른 추가 가중치 (극적인 효과를 위해 높게 설정)

        let hs = circuits.map(c => {
            const ratio = totalVA > 0 ? (c.va / totalVA) : 0;
            return minWeight + (ratio * scaleFactor);
        });

        // 비대칭 높이 설계 (판넬 8% 초압축 vs 회로 92% 광폭 확산)
        const panelTotalAreaH = canvasH * 0.08;
        const circuitTotalAreaH = canvasH * 0.92; 

        // 회로 간 gap 고려한 유효 높이 (최소 간격 보장)
        const gap = Math.max(0.5, Math.min(BASE_GAP, circuitTotalAreaH / (n * 4)));
        const totalGap = (n - 1) * gap;
        const circuitAvailBandH = Math.max(n * 2, circuitTotalAreaH - totalGap);

        const sumRatios = hs.reduce((a, b) => a + b, 0);
        
        // 최종 픽셀 높이 변환 (가중치 기반 배분)
        const panelHS = hs.map(h => (h / sumRatios) * panelTotalAreaH);
        const circuitHS = hs.map(h => (h / sumRatios) * circuitAvailBandH);

        // 1. LEFT Points (Center Pinch) - 모든 회로가 밀착하여 하나의 소스를 형성
        const panelStart = mg.t + (canvasH - panelTotalAreaH) / 2;
        const lp = [];
        let curLY = panelStart;
        for (let i = 0; i < n; i++) {
            lp.push({ y: curLY, h: panelHS[i] });
            curLY += panelHS[i];
        }

        // 2. RIGHT Points (Wide Spread) - 회로 간 간격을 두어 확산 표현
        const circuitStart = mg.t + (canvasH - circuitTotalAreaH) / 2;
        const rp = [];
        let curRY = circuitStart;
        for (let i = 0; i < n; i++) {
            rp.push({ y: curRY, h: circuitHS[i] });
            curRY += circuitHS[i] + gap;
        }

        return {
            lp, rp,
            lx: mg.l + PANEL_BAR_W,
            rx: size.w - mg.r,
            panelCenterX: mg.l,
            mg
        };
    }, [data, size]);

    if (!layout || !data?.circuits?.length) return <div ref={containerRef} className="w-full h-full" />;

    const { lp, rp, lx, rx, panelCenterX } = layout;
    const cpX = (rx - lx) * 0.65; // 초압축 소스에 맞춘 유연한 곡률 장력 상향

    return (
        <div ref={containerRef} className="w-full h-full relative select-none overflow-hidden" onMouseLeave={() => setHovered(null)}>
            {/* ── [PERFORMANCE] CSS-based Global Dimming ── */}
            <style dangerouslySetInnerHTML={{ __html: `
                .energy-band-root[data-focusing="true"] .energy-band-item {
                    opacity: 0.1 !important;
                }
                .energy-band-root[data-focusing="true"] .energy-band-item.is-hovered {
                    opacity: 1 !important;
                }
                .energy-band-item {
                    /* 조명이 다시 밝아질 때(복귀) 0.1s 지연을 주어 여운 형성 */
                    transition: opacity 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) 0.1s, d 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) !important;
                }
                .energy-band-item.is-hovered {
                    /* 하이라이트 진입 시에는 즉각 반응 */
                    transition: opacity 0.4s cubic-bezier(0.2, 0.8, 0.2, 1), d 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) !important;
                }
                .energy-aura {
                    transition: opacity 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) 0.1s !important;
                }
                .energy-band-root[data-focusing="true"] .energy-aura {
                    opacity: 0.05 !important;
                }
                .energy-band-root[data-focusing="true"] .energy-aura.is-hovered {
                    opacity: 1 !important;
                }
                .energy-band-root[data-focusing="true"] .energy-core {
                    opacity: 0.05 !important;
                }
                .energy-band-root[data-focusing="true"] .energy-core.is-hovered {
                    opacity: 1 !important;
                }
                .energy-core {
                    transition: opacity 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) 0.1s !important;
                }
                .energy-band-root[data-focusing="true"] .energy-label {
                    opacity: 0.2 !important;
                }
                .energy-band-root[data-focusing="true"] .energy-label.is-hovered {
                    opacity: 1 !important;
                }
                .energy-label {
                    transition: opacity 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) 0.1s !important;
                }
            `}} />

            <svg width={size.w} height={size.h} className="absolute inset-0 energy-band-root" data-focusing={hovered !== null}>
                <defs>
                    {/* 에너지 방출 광원 (Source Glow) */}
                    <radialGradient id="sourceGlow" cx="10%" cy="50%" r="70%">
                        <stop offset="0%" stopColor="rgba(255,180,50,0.2)" />
                        <stop offset="40%" stopColor="rgba(255,80,0,0.08)" />
                        <stop offset="70%" stopColor="rgba(255,40,0,0.03)" />
                        <stop offset="100%" stopColor="rgba(0,0,0,0)" />
                    </radialGradient>

                    {/* 네온 필터 */}
                    <filter id="neonFilter" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur in="SourceAlpha" stdDeviation="6" result="blur" />
                        <feFlood floodColor="rgba(255,130,50,0.5)" result="color" />
                        <feComposite in="color" in2="blur" operator="in" result="glow" />
                        <feMerge>
                            <feMergeNode in="glow" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>

                    <clipPath id="reveal">
                        <rect x={0} y={0} width={size.w * grow} height={size.h} />
                    </clipPath>

                    {/* 밴드별 그라데이션 - 에너지 흐름 표현 */}
                    {data.circuits.map((c, i) => (
                        <linearGradient key={`grad${i}`} id={`grad${i}`} x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor={fireColor(1, 1, 20)} />
                            <stop offset="30%" stopColor={fireColor(c.ratio, 1, 5)} />
                            <stop offset="100%" stopColor={fireColor(c.ratio, 0.7, -10)} />
                        </linearGradient>
                    ))}
                </defs>

                {/* --- Background Ambience --- */}
                <rect 
                    x={0} y={0} 
                    width={size.w} height={size.h} 
                    fill="url(#sourceGlow)" 
                    opacity={ready ? 1 : 0}
                    style={{ transition: 'opacity 1.5s ease' }}
                    onMouseEnter={() => {
                        // 허공 진입 시 즉시 끄지 않고 120ms 대기 (확장된 밴드와 시너지로 플리커 완벽 제거)
                        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                        hoverTimeoutRef.current = setTimeout(() => {
                            setHovered(null);
                        }, 120);
                    }}
                />

                <g clipPath="url(#reveal)" style={{ transition: 'all 1.2s cubic-bezier(0.16,1,0.3,1)' }}>
                    {/* --- Layer 1: Ambient Aura --- */}
                    {data.circuits.map((c, i) => {
                        const isH = hovered === i;
                        const d = expansionPath(lx, lp[i].y, lp[i].h, rx, rp[i].y, rp[i].h, cpX);
                        return (
                            <path key={`aura${i}`} d={d}
                                fill={fireColor(c.ratio, 0.12)}
                                filter="blur(12px)"
                                className={`energy-aura ${isH ? 'is-hovered' : ''}`}
                                opacity={ready ? 1 : 0}
                            />
                        );
                    })}

                    {/* --- Layer 2: Main Energy Bands --- */}
                    {data.circuits.map((c, i) => {
                        const isH = hovered === i;
                        const dim = hovered !== null && !isH;
                        
                        // 하이라이트 시 미세 확대 (오른쪽 확산 지점은 간격이 더 넓으므로 조금 더 확장)
                        const hExp = isH ? HOVER_EXPAND : 0;
                        const d = expansionPath(
                            lx, lp[i].y - hExp/4, lp[i].h + hExp/2, 
                            rx, rp[i].y - hExp, rp[i].h + hExp * 2, 
                            cpX
                        );
                        
                        return (
                            <path key={`band${i}`} d={d}
                                fill={`url(#grad${i})`}
                                opacity={ready ? 0.85 : 0}
                                filter={isH ? 'url(#neonFilter)' : 'none'}
                                className={`energy-band-item cursor-pointer ${isH ? 'is-hovered' : ''}`}
                                style={{
                                    stroke: isH ? 'rgba(255,255,255,0.4)' : 'none',
                                    strokeWidth: 0.5
                                }}
                                onMouseEnter={() => {
                                    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                                    setHovered(i);
                                }}
                            />
                        );
                    })}

                    {/* --- Layer 3: Neon Core Lines (두께 비례 적용) --- */}
                    {data.circuits.map((c, i) => {
                        const isH = hovered === i;
                        if (rp[i].h < 1.5 && !isH) return null; 
                        
                        // 밴드 굵기의 30% 정도를 코어로 사용
                        const ch = Math.max(0.8, lp[i].h * 0.3);
                        const d = expansionPath(lx, lp[i].y + lp[i].h/2 - ch/2, ch, rx, rp[i].y + rp[i].h/2 - ch/2, ch, cpX);
                        return (
                            <path key={`core${i}`} d={d}
                                fill="rgba(255,255,255,0.7)"
                                className={`energy-core ${isH ? 'is-hovered' : ''}`}
                                opacity={ready ? 0.85 : 0}
                                pointerEvents="none"
                            />
                        );
                    })}

                    {/* --- Layer 4: Panel Core Bar --- */}
                    <g opacity={ready ? 1 : 0} style={{ transition: 'opacity 0.8s ease 0.5s' }}>
                        {data.circuits.map((c, i) => (
                            <rect key={`pcore${i}`}
                                x={panelCenterX} y={lp[i].y} width={PANEL_BAR_W} height={lp[i].h}
                                fill={fireColor(c.ratio, 1, 10)}
                            />
                        ))}
                        {/* 글로우 엣지 */}
                        <rect 
                            x={panelCenterX - 2} y={lp[0].y - 4} 
                            width={PANEL_BAR_W + 4} height={lp[lp.length-1].y + lp[lp.length-1].h - lp[0].y + 8}
                            rx={4} fill="none" stroke="rgba(255,180,80,0.3)" strokeWidth={1}
                            filter="blur(2px)"
                        />
                    </g>
                </g>

                {/* --- Labels & Meta --- */}
                {data.circuits.map((c, i) => {
                    const isH = hovered === i;
                    const dim = hovered !== null && !isH;
                    const cy = rp[i].y + rp[i].h / 2;
                    if (rp[i].h < 8 && !isH && data.circuits.length > LABEL_VISIBLE_THRESHOLD) return null;

                    return (
                        <g key={`lbl${i}`} 
                            className={`energy-label ${isH ? 'is-hovered' : ''}`}
                            opacity={ready && grow > 0.8 ? 1 : 0}
                            style={{ 
                                cursor: 'pointer' 
                            }}
                            onMouseEnter={() => {
                                if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                                setHovered(i);
                            }}
                        >
                            <text
                                x={rx + 15} y={cy}
                                dominantBaseline="middle"
                                fill={isH ? '#fff' : 'rgba(255,255,255,0.5)'}
                                fontSize={isH ? 14 : 11}
                                fontWeight={isH ? 800 : 400}
                                style={{ transition: 'all 0.2s ease', textShadow: isH ? '0 0 10px rgba(255,150,50,0.8)' : 'none' }}
                            >
                                {c.name}
                                <tspan dx={10} fill={isH ? fireColor(c.ratio, 1, 10) : 'rgba(255,255,255,0.2)'} fontSize={isH ? 11 : 9} fontWeight={500}>
                                    {c.kva.toFixed(1)} kVA ({c.percent.toFixed(0)}%)
                                </tspan>
                            </text>
                            
                            {/* 마커 라인 */}
                            <line 
                                x1={rx} y1={cy} x2={rx + 10} y2={cy} 
                                stroke={isH ? '#fff' : 'rgba(255,255,255,0.2)'} 
                                strokeWidth={isH ? 2 : 0.5} 
                            />
                        </g>
                    );
                })}

                {/* Panel Info */}
                <g transform={`translate(${panelCenterX}, ${lp[0].y - 30})`} opacity={ready ? 1 : 0} style={{ transition: 'opacity 1s ease 0.8s' }}>
                    <text fill="#fff" fontSize={18} fontWeight={900} letterSpacing="0.1em">{data.panelName}</text>
                    <text y={20} fill="rgba(255,200,50,0.6)" fontSize={12} fontWeight={600} style={{ fontFamily: 'monospace' }}>
                        TOTAL SOURCE: {data.totalKVA.toFixed(1)} kVA
                    </text>
                </g>
            </svg>

            {/* Hover Tooltip (Dynamic Glass) */}
            {hovered !== null && (() => {
                const c = data.circuits[hovered];
                const tx = rx - 50;
                const ty = rp[hovered].y + rp[hovered].h/2;
                return (
                    <div 
                        className="absolute pointer-events-none z-50 flex flex-col gap-1 px-5 py-3 rounded-2xl border backdrop-blur-3xl animate-in fade-in zoom-in duration-200"
                        style={{ 
                            left: tx, top: ty, transform: 'translate(-100%, -50%)',
                            backgroundColor: 'rgba(0,0,0,0.85)',
                            borderColor: neonGlow(c.ratio),
                            boxShadow: `0 0 40px ${fireColor(c.ratio, 0.4)}`
                        }}
                    >
                        <span className="text-white/40 text-[10px] uppercase font-black tracking-widest">Circuit Node</span>
                        <div className="flex items-center gap-2">
                            <span className="text-white text-lg font-black tracking-tight leading-none">{c.name}</span>
                            {c.bankName && (() => {
                                const getColor = (name) => {
                                    const colors = ['emerald', 'blue', 'amber', 'purple', 'rose', 'cyan', 'indigo', 'orange'];
                                    const num = parseInt(name.replace(/[^0-9]/g, '')) || name.length || 0;
                                    const color = colors[num % colors.length];
                                    const schemes = {
                                        emerald: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
                                        blue:    'bg-blue-500/20 text-blue-400 border-blue-500/30',
                                        amber:   'bg-amber-500/20 text-amber-400 border-amber-500/30',
                                        purple:  'bg-purple-500/20 text-purple-400 border-purple-500/30',
                                        rose:    'bg-rose-500/20 text-rose-400 border-rose-500/30',
                                        cyan:    'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
                                        indigo:  'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
                                        orange:  'bg-orange-500/20 text-orange-400 border-orange-500/30',
                                    };
                                    return schemes[color] || schemes.emerald;
                                };
                                return (
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-md border font-bold uppercase tracking-wider leading-none ${getColor(c.bankName)}`}>
                                        {c.bankName}
                                    </span>
                                );
                            })()}
                        </div>
                        <div className="h-px w-full bg-white/10 my-1" />
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-black italic tabular-nums" style={{ color: fireColor(c.ratio, 1, 15) }}>
                                {c.kva.toFixed(2)}
                            </span>
                            <span className="text-white/60 text-xs font-bold">kVA</span>
                            <span className="ml-auto text-white/30 text-xs font-black">{c.percent.toFixed(1)}%</span>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

export default BandChart;

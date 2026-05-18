import React from 'react';

/**
 * ConnectionTooltip Component
 * Displays cable specification in a premium speech-bubble style popover.
 * 
 * @param {string} info - Formatted cable specification string
 * @param {number} x - Horizontal position (px)
 * @param {number} y - Vertical position (px)
 * @param {boolean} visible - Visibility state
 */
const ConnectionTooltip = ({ info, x, y, visible }) => {
    if (!visible || !info) return null;

    return (
        <div 
            className="absolute z-[1000] pointer-events-none"
            style={{ 
                left: x, 
                top: y, 
                transform: 'translate(calc(-100% + 34px), calc(-100% - 14px))'
            }}
        >
            <div className="relative bg-white/98 backdrop-blur-sm border border-slate-300 rounded-[14px] px-5 py-2.5 shadow-[0_10px_35px_-5px_rgba(0,0,0,0.1)] min-w-max animate-in fade-in zoom-in duration-200 flex items-center justify-center">
                {/* Content */}
                <span className="text-slate-600 font-mono font-bold text-[13.5px] tracking-tight whitespace-nowrap leading-none">
                    {info}
                </span>

                {/* Speech Bubble Tail - Redesigned for Natural Curved Style */}
                <div className="absolute -bottom-[14px] right-[22px] w-[24px] h-[16px] overflow-visible">
                    <svg width="24" height="16" viewBox="0 0 24 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        {/* Shadow mask or offset if needed, but simple path is cleaner */}
                        <path 
                            d="M24 0C18 0 14 2 12 14C11 5 6 1 0 0H24Z" 
                            fill="rgba(255, 255, 255, 0.98)"
                        />
                        {/* Border that blends with the box stroke - Darkened to slate-300 (#cbd5e1) */}
                        <path 
                            d="M24 0C18 0 14 2 12 14C11 5 6 1 0 0" 
                            stroke="#cbd5e1" 
                            strokeWidth="1.2"
                            strokeLinecap="round"
                        />
                    </svg>
                    {/* Cover point where tail meets box to ensure seamless look */}
                    <div className="absolute top-[-1.5px] left-0 right-0 h-[3px] bg-white"></div>
                </div>
            </div>
        </div>
    );
};

export default ConnectionTooltip;

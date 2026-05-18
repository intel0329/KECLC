import {
    Grid, Zap, ZapOff, Percent, Shield, ShieldCheck, Cable,
    Ruler, Layers, Power, Box, CheckCircle2, 
} from 'lucide-react';

/**
 * Panel Feeder Section Navigation Configuration
 * Each item represents a clickable category in the navigation bar.
 */
export const NAV_ITEMS = [
    { id: 'sec-no', icon: Grid, color: 'text-blue-400', label: 'Grid' },
    { id: 'sec-load', icon: Zap, color: 'text-yellow-400', label: 'Load' },
    { id: 'sec-vdrop', icon: ZapOff, color: 'text-yellow-400', label: 'V-Drop' },
    { id: 'sec-demand', icon: Percent, color: 'text-emerald-400', label: 'Demand' },
    { id: 'sec-breaker', icon: ShieldCheck, color: 'text-purple-400', label: 'Breaker' },
    { id: 'sec-overcurrent', icon: ShieldCheck, color: 'text-green-400', label: 'KEC CB' },
    { id: 'sec-conductor', icon: Cable, color: 'text-pink-400', label: 'KEC CABLE' },
    { id: 'sec-pf', icon: Ruler, color: 'text-slate-400', label: 'PF/Eff/Imp' },
    { id: 'sec-env', icon: Layers, color: 'text-indigo-400', label: 'Condition' },
    { id: 'sec-cable', icon: Power, color: 'text-red-400', label: 'Cable' },
    { id: 'sec-conduit', icon: Box, color: 'text-amber-400', label: 'Conduit' },
    { id: 'sec-review', icon: CheckCircle2, color: 'text-green-400', label: 'Review' },
];

/**
 * Scroll to a specific section by its ID with smooth behavior and horizontal offset.
 */
export const scrollToSection = (id, scrollContainerRef) => {
    const element = document.getElementById(id);
    const container = scrollContainerRef.current;

    if (element && container) {
        const containerRect = container.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();
        const scrollLeft = container.scrollLeft + (elementRect.left - containerRect.left) - 20;

        container.scrollTo({
            left: scrollLeft,
            behavior: 'smooth'
        });

        // Apply blink effect to target ID and all elements with 'navi-target-{id}' class
        const targets = document.querySelectorAll(`[id="${id}"], .navi-target-${id}`);
        targets.forEach(el => {
            el.classList.add('animate-section-blink');
            setTimeout(() => {
                el.classList.remove('animate-section-blink');
            }, 800);
        });
    }
};

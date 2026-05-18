import {
    Layers, Zap, ShieldCheck, Ruler, Shield, ArrowDown, Activity, TrendingUp,
    ZapOff, Thermometer, CheckCircle2, Flame, AlertTriangle, RotateCcw,
    Wind, Box, List, Cable
} from 'lucide-react';

/**
 * Setting Page Section Navigation Configuration
 * Abbreviated labels as requested by the user.
 */
export const SETTING_NAV_ITEMS = [
    { id: 'sec-factors', icon: Layers, color: 'text-blue-400', label: 'Factors' },
    { id: 'sec-cb', icon: Shield, color: 'text-green-400', label: 'CB' },
    { id: 'sec-i2', icon: CheckCircle2, color: 'text-green-400', label: 'I2' },
    { id: 'sec-sb', icon: Cable, color: 'text-green-500', label: 'SB' },
    { id: 'sec-scb', icon: Cable, color: 'text-red-500', label: 'SCB' },
    { id: 'sec-ssc', icon: Cable, color: 'text-blue-500', label: 'SSC' },
    { id: 'sec-smsth', icon: Cable, color: 'text-yellow-500', label: 'SMSTh' },
    { id: 'sec-edrop', icon: ZapOff, color: 'text-green-500', label: 'e%' },
    { id: 'sec-se-pct', icon: ZapOff, color: 'text-blue-500', label: 'Se%' },
    { id: 'sec-smse-pct', icon: ZapOff, color: 'text-yellow-500', label: 'SMSe%' },
    { id: 'sec-atb', icon: ShieldCheck, color: 'text-green-500', label: 'ATb' },
    { id: 'sec-atth', icon: ShieldCheck, color: 'text-amber-500', label: 'ATth' },
    { id: 'sec-atsc', icon: ShieldCheck, color: 'text-red-500', label: 'ATsc' },
    { id: 'sec-atms', icon: Zap, color: 'text-sky-500', label: 'ATms' },
    { id: 'sec-atmi', icon: Zap, color: 'text-yellow-500', label: 'ATmi' },
    { id: 'sec-ct', icon: Box, color: 'text-slate-500', label: 'CT' },
    { id: 'sec-parallel', icon: Cable, color: 'text-purple-500', label: 'Parallel' },
];

/**
 * Smoothly scrolls to a section header in the Setting Page and applies a blink effect.
 */
export const scrollSettingToSection = (id, scrollContainerRef) => {
    const element = document.getElementById(id);
    const container = scrollContainerRef.current;

    if (element && container) {
        element.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });

        // Apply blink effect
        element.classList.add('animate-section-blink');
        setTimeout(() => {
            element.classList.remove('animate-section-blink');
        }, 1500);
    }
};

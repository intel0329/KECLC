import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    LineController,
    Title,
    Tooltip,
    Legend,
    TimeScale,
    LogarithmicScale,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';
import zoomPlugin from 'chartjs-plugin-zoom';
import annotationPlugin from 'chartjs-plugin-annotation';
import { EX_VALUE_CONFIG, CHART_CONFIG } from './TCCConfig';
import { parseTccCSV, createSplineInterpolator } from '../../utils/tccUtils';
import { useConfig } from './TCCConfigContext';

ChartJS.register(
    CategoryScale,
    LinearScale,
    LogarithmicScale,
    PointElement,
    LineElement,
    LineController,
    Title,
    Tooltip,
    Legend,
    TimeScale,
    zoomPlugin,
    annotationPlugin
);

const verticalLinePlugin = {
    id: 'verticalLine',
    afterDatasetsDraw: (chart) => {
        if (chart.tooltip?.getActiveElements().length) {
            const activePoint = chart.tooltip.getActiveElements()[0];
            const ctx = chart.ctx;
            const x = activePoint.element.x;
            const topY = chart.scales.y.top;
            const bottomY = chart.scales.y.bottom;

            ctx.save();
            ctx.beginPath();
            ctx.moveTo(x, topY);
            ctx.lineTo(x, bottomY);
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(255, 193, 7, 0.9)'; // Yellow color match Analysis
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.restore();
        }
    }
};

import TCCMultiplierModal from './TCCMultiplierModal';

const TCCDetail = ({ symbol }) => {
    const config = symbol ? EX_VALUE_CONFIG[symbol] : null;
    const { switchModel, accumulatedDataUrl, currentModel } = useConfig();

    const [protoData, setProtoData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [itemsPerPage, setItemsPerPage] = useState(50);
    const [isMultiplierModalOpen, setIsMultiplierModalOpen] = useState(false);
    const chartRef = useRef(null);
    const tooltipRef = useRef(null);

    useEffect(() => {
        const handleResize = () => {
            setItemsPerPage(window.innerWidth < 768 ? 10 : 50);
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (symbol && symbol !== currentModel) {
            switchModel(symbol);
        }
    }, [symbol, currentModel, switchModel]);

    useEffect(() => {
        if (config && symbol === currentModel) {
            // Skip data loading for the multiplier modal "ticker"
            if (symbol === '규약동작배율') {
                setLoading(false);
                return;
            }

            setLoading(true);
            if (config.csvUrl) {
                fetch(config.csvUrl)
                    .then(res => res.text())
                    .then(csvText => {
                        const parsed = parseTccCSV(csvText);
                        setProtoData(parsed);
                        setLoading(false);
                    })
                    .catch(err => {
                        console.error('Failed to load TCC CSV', err);
                        setLoading(false);
                    });
            } else {
                setProtoData([]);
                setLoading(false);
            }
        }
    }, [config, symbol, currentModel]);

    const chartData = useMemo(() => {
        if (protoData.length === 0) return { datasets: [] };

        const sortedProto = [...protoData].sort((a, b) => a.time - b.time);

        return {
            datasets: [
                {
                    label: 'MAX',
                    data: sortedProto.map(d => ({ x: d.max, y: d.time })),
                    borderColor: '#ef4444', // Red
                    backgroundColor: '#ef444420',
                    borderWidth: 2,
                    pointRadius: 3,
                    pointHoverRadius: 6,
                    tension: 0.1,
                    fill: false
                },
                {
                    label: 'MIN',
                    data: sortedProto.map(d => ({ x: d.min, y: d.time })),
                    borderColor: '#3b82f6', // Blue
                    backgroundColor: '#3b82f620',
                    borderWidth: 2,
                    pointRadius: 3,
                    pointHoverRadius: 6,
                    tension: 0.1,
                    fill: false
                }
            ]
        };
    }, [protoData]);

    const { maxInterpolator, minInterpolator } = useMemo(() => {
        if (protoData.length === 0) return { maxInterpolator: null, minInterpolator: null };

        const sortedByMax = [...protoData].sort((a, b) => a.max - b.max || a.time - b.time);
        const sortedByMin = [...protoData].sort((a, b) => a.min - b.min || a.time - b.time);

        const uniqueMax = [];
        if (sortedByMax.length > 0) {
            uniqueMax.push(sortedByMax[0]);
            for (let i = 1; i < sortedByMax.length; i++) {
                if (sortedByMax[i].max !== sortedByMax[i - 1].max) {
                    uniqueMax.push(sortedByMax[i]);
                }
            }
        }

        const uniqueMin = [];
        if (sortedByMin.length > 0) {
            uniqueMin.push(sortedByMin[0]);
            for (let i = 1; i < sortedByMin.length; i++) {
                if (sortedByMin[i].min !== sortedByMin[i - 1].min) {
                    uniqueMin.push(sortedByMin[i]);
                }
            }
        }

        return {
            maxInterpolator: createSplineInterpolator(uniqueMax.map(d => d.max), uniqueMax.map(d => d.time)),
            minInterpolator: createSplineInterpolator(uniqueMin.map(d => d.min), uniqueMin.map(d => d.time))
        };
    }, [protoData]);

    const options = useMemo(() => {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: false },
                legend: { display: false },
                tooltip: {
                    enabled: false,
                    external: (context) => {
                        const tooltipModel = context.tooltip;
                        if (!chartRef.current) return;

                        let tooltipEl = document.getElementById('chartjs-tooltip');
                        if (!tooltipEl) {
                            tooltipEl = document.createElement('div');
                            tooltipEl.id = 'chartjs-tooltip';
                            tooltipEl.style.background = 'rgba(255, 255, 255, 0.95)';
                            tooltipEl.style.borderRadius = '8px';
                            tooltipEl.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
                            tooltipEl.style.color = '#1f2937';
                            tooltipEl.style.opacity = '1';
                            tooltipEl.style.pointerEvents = 'none';
                            tooltipEl.style.position = 'absolute';
                            tooltipEl.style.zIndex = '9999';
                            tooltipEl.style.transform = 'translate(-50%, 0)';
                            tooltipEl.style.transition = 'all .1s ease';
                            tooltipEl.style.padding = '8px 12px';
                            tooltipEl.style.border = '1px solid #e5e7eb';
                            tooltipEl.style.fontFamily = 'Michroma';
                            document.body.appendChild(tooltipEl);
                        }

                        if (tooltipModel.opacity === 0) {
                            tooltipEl.style.opacity = '0';
                            return;
                        }

                        if (tooltipModel.body) {
                            const dataPoints = tooltipModel.dataPoints;
                            const isMobile = window.innerWidth <= 768;
                            const labelSize = isMobile ? '9px' : '12px';
                            const valueSize = isMobile ? '8px' : '10px';

                            const xValue = dataPoints[0].parsed.x;
                            let innerHtml = `<div style="margin-bottom: 6px; font-size: ${labelSize}; opacity: 0.9;">Value: ${xValue}</div>`;

                            if (maxInterpolator && minInterpolator) {
                                const maxTime = maxInterpolator(xValue);
                                const minTime = minInterpolator(xValue);

                                const formatTime = (t) => {
                                    if (t === null) return '';
                                    return t >= 60 ? (t / 60).toFixed(2) + ' min' : t.toFixed(2) + ' sec';
                                };

                                if (maxTime !== null) {
                                    innerHtml += `
                                    <div style="display: flex; align-items: center; margin-bottom: 3px;">
                                        <div style="width: 8px; height: 8px; background: #ef4444; margin-right: 6px; border-radius: 50%;"></div>
                                        <span style="font-size: ${labelSize}; margin-right: 8px;">MAX:</span>
                                        <span style="font-size: ${valueSize}; font-weight: 600;">${formatTime(maxTime)}</span>
                                    </div>
                                    `;
                                }

                                if (minTime !== null) {
                                    innerHtml += `
                                    <div style="display: flex; align-items: center; margin-bottom: 3px;">
                                        <div style="width: 8px; height: 8px; background: #3b82f6; margin-right: 6px; border-radius: 50%;"></div>
                                        <span style="font-size: ${labelSize}; margin-right: 8px;">MIN:</span>
                                        <span style="font-size: ${valueSize}; font-weight: 600;">${formatTime(minTime)}</span>
                                    </div>
                                    `;
                                }
                            }

                            tooltipEl.innerHTML = innerHtml;

                            const chart = context.chart;
                            const { offsetLeft: positionX, offsetTop: positionY } = chart.canvas;
                            const tooltipWidth = tooltipEl.offsetWidth;
                            const tooltipHeight = tooltipEl.offsetHeight;
                            const chartArea = chart.chartArea;

                            let left, top;
                            if (isMobile) {
                                left = chartArea.right - tooltipWidth - 5;
                                top = chartArea.top + 100;
                            } else {
                                left = chartArea.right - tooltipWidth - -550;
                                top = chartArea.bottom - tooltipHeight - 20;
                                if (left < chartArea.left) left = chartArea.left + 10;
                                if (top < chartArea.top) top = chartArea.top + 10;
                            }

                            tooltipEl.style.opacity = '1';
                            tooltipEl.style.transform = 'none';
                            tooltipEl.style.left = positionX + left + 'px';
                            tooltipEl.style.top = positionY + top + 'px';
                        }
                    }
                },
                zoom: {
                    zoom: {
                        wheel: { enabled: true },
                        pinch: { enabled: true },
                        mode: 'y',
                    },
                    pan: { enabled: true, mode: 'y' },
                    limits: {
                        y: { min: 0.01, max: 20000, minRange: 0.01 }
                    }
                },
                annotation: {
                    annotations: {
                        line1: {
                            type: 'line',
                            yMin: 60,
                            yMax: 60,
                            borderColor: '#9ca3af',
                            borderWidth: 1,
                            borderDash: [4, 4],
                            label: {
                                display: true,
                                content: '1 min',
                                position: 'end',
                                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                                color: '#6b7280',
                                font: { size: 9, family: 'Michroma' },
                                yAdjust: -10
                            }
                        }
                    }
                },
                indexAxis: 'x',
            },
            scales: {
                x: {
                    type: 'logarithmic',
                    position: 'bottom',
                    title: {
                        display: true,
                        text: 'MAX / MIN Value',
                        color: '#6b7280',
                        font: { family: 'Michroma', size: 10 }
                    },
                    grid: { color: CHART_CONFIG.gridColor, drawBorder: false },
                    ticks: {
                        color: '#6b7280',
                        font: { family: 'Michroma', size: 10 },
                        maxTicksLimit: 20,
                        callback: function (value) {
                            const val = Number(value);
                            return Number.isInteger(val) ? val.toString() : val.toFixed(2).replace(/\.00$/, '');
                        }
                    }
                },
                y: {
                    type: 'logarithmic',
                    display: true,
                    position: 'left',
                    min: 0.01,
                    max: 20000,
                    title: {
                        display: true,
                        text: 'TIME (min | sec)',
                        color: '#6b7280',
                        font: { family: 'Michroma', size: 10 }
                    },
                    grid: { color: CHART_CONFIG.gridColor, drawBorder: false },
                    afterBuildTicks: function (axis) {
                        const targetValues = [
                            0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 30,
                            60, 120, 300, 600, 900, 1200, 1800, 2700, 3600,
                            7200, 10800, 14400, 21600, 28800, 43200, 86400
                        ];
                        axis.ticks = targetValues
                            .filter(v => v >= axis.min && v <= axis.max)
                            .map(v => ({ value: v }));
                    },
                    ticks: {
                        color: '#6b7280',
                        font: { family: 'Michroma', size: 10 },
                        autoSkip: false,
                        maxTicksLimit: 100,
                        callback: function (value) {
                            const val = Number(value);
                            if (val >= 60) {
                                const minutes = val / 60;
                                return Number.isInteger(minutes) ? minutes.toString() : minutes.toFixed(2).replace(/\.00$/, '');
                            }
                            return Number.isInteger(val) ? val.toString() : val.toFixed(2).replace(/\.00$/, '');
                        }
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'nearest',
                axis: 'x'
            }
        };
    }, [maxInterpolator, minInterpolator]);

    if (!config) return <div>Invalid Symbol</div>;

    return (
        <div className="min-h-screen bg-[#f8f9fa] font-['Michroma'] overflow-x-hidden">
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Michroma&display=swap');
            `}</style>

            <TCCMultiplierModal
                isOpen={isMultiplierModalOpen}
                onClose={() => setIsMultiplierModalOpen(false)}
            />

            {/* Header */}
            <header className="bg-white shadow-[0_2px_4px_rgba(0,0,0,0.1)] sticky top-0 z-10">
                <div className="max-w-[1200px] mx-auto px-[10px] h-[60px] flex items-center justify-between md:px-[20px] md:h-[50px]">
                    <div className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                        <div className="flex items-center gap-2 text-inherit cursor-pointer" onClick={() => switchModel('100A')}>
                            <img src={config.logo} alt="Logo" className="h-10 w-10 object-contain rounded-lg md:h-[42px] md:w-[42px]" />
                            <h1 className="text-[18px] font-normal text-[#1f2937] md:text-[16px] sm:text-[14px]">Time-Current Characteristic</h1>
                        </div>
                    </div>

                    <nav className={`${isMenuOpen ? 'opacity-100 visible translate-y-0' : 'opacity-0 invisible -translate-y-[10px] md:opacity-100 md:visible md:translate-y-0'} absolute top-full right-0 w-[150px] bg-white shadow-lg flex-col p-4 gap-0 border-2 border-[#22c55e] rounded-lg transition-all duration-300 md:static md:w-auto md:bg-transparent md:flex-row md:border-0 md:p-0 md:gap-[20px] md:shadow-none flex`}>
                        {Object.values(EX_VALUE_CONFIG).map(c => (
                            <button
                                key={c.id}
                                onClick={() => {
                                    if (c.id === '규약동작배율') {
                                        setIsMultiplierModalOpen(true);
                                        setIsMenuOpen(false);
                                    } else {
                                        switchModel(c.id);
                                        setIsMenuOpen(false);
                                    }
                                }}
                                className={`${c.id === '규약동작배율' ? 'text-[13px]' : 'text-[12px]'} font-normal py-2 md:border-0 md:py-1 md:px-[10px] rounded-md transition-colors relative group block text-center md:inline-block bg-transparent border-none cursor-pointer ${c.id === symbol ? 'text-[#22c55e] font-medium' : 'text-[#6b7280] hover:text-[#22c55e]'}`}
                            >
                                <span className="relative inline-block px-3 pb-1">
                                    {c.id}
                                    <span className={`absolute bottom-0 left-0 w-full h-[2px] bg-[#22c55e] rounded-[1px] transition-all duration-300 origin-center transform ${c.id === symbol ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100 md:group-hover:scale-x-0'}`}></span>
                                </span>
                            </button>
                        ))}
                    </nav>

                    <button
                        className="flex md:hidden flex-col justify-center items-center w-[30px] h-[30px] gap-[4px] bg-transparent border-none cursor-pointer p-0 group"
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                    >
                        <span
                            className={`w-[20px] h-[2px] bg-[#6b7280] rounded-[1px] transition-all duration-300 group-hover:bg-[#22c55e] ${isMenuOpen ? 'bg-[#22c55e]' : ''}`}
                            style={{ transform: isMenuOpen ? 'rotate(45deg) translate(5px, 5px)' : 'none' }}
                        ></span>
                        <span className={`w-[20px] h-[2px] bg-[#6b7280] rounded-[1px] transition-all duration-300 group-hover:bg-[#22c55e] ${isMenuOpen ? 'opacity-0' : ''}`}></span>
                        <span
                            className={`w-[20px] h-[2px] bg-[#6b7280] rounded-[1px] transition-all duration-300 group-hover:bg-[#22c55e] ${isMenuOpen ? 'bg-[#22c55e]' : ''}`}
                            style={{ transform: isMenuOpen ? 'rotate(-45deg) translate(7px, -6px)' : 'none' }}
                        ></span>
                    </button>
                </div>
            </header>

            <div className="max-w-[1200px] mx-auto my-[5px] p-[5px] bg-white rounded-xl shadow-[0_4px_6px_rgba(0,0,0,0.1)] md:mx-auto md:my-[15px] md:p-[20px]">
                <div className="flex flex-col md:flex-row gap-5 items-stretch">
                    <div className="w-full md:flex-[3] mb-[20px] md:mb-0 flex flex-col">
                        <div className="flex justify-between items-center mb-[10px] px-[10px]">
                            <h2 className="text-[13px] font-normal text-[#374151] font-['Michroma'] m-0">
                                Time-Current Multiple Comparison
                            </h2>
                            <button
                                onClick={() => chartRef.current?.resetZoom()}
                                className="w-[24px] h-[24px] bg-white border border-[#22c55e] rounded-full cursor-pointer flex items-center justify-center text-[#22c55e] transition-all duration-300 shadow-[0_2px_6px_rgba(0,0,0,0.08)] hover:bg-[#22c55e] hover:text-white hover:scale-110 hover:shadow-[0_3px_10px_rgba(34,197,94,0.25)] active:scale-90 md:w-[20px] md:h-[20px]"
                                title="Reset Zoom"
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="transition-transform duration-300 hover:rotate-180 md:w-[10px] md:h-[10px]">
                                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                                    <path d="M21 3v5h-5" />
                                    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                                    <path d="M3 21v-5h5" />
                                </svg>
                            </button>
                        </div>
                        <div className="relative w-full h-[400px] sm:h-[450px] md:h-auto md:flex-1 min-h-[500px]">
                            {loading ? (
                                <div className="flex items-center justify-center h-full text-[#6b7280] text-xs">Loading Chart...</div>
                            ) : (
                                <>
                                    <Line ref={chartRef} data={chartData} options={options} plugins={[verticalLinePlugin]} />
                                    <div
                                        ref={tooltipRef}
                                        className="absolute bg-white text-[#374151] p-[8px_12px] rounded-md border border-[#22c55e] text-[11px] font-medium pointer-events-none transition-opacity duration-200 z-[1000] shadow-[0_4px_12px_rgba(0,0,0,0.15)] min-w-[140px] font-['Michroma'] md:p-[6px_10px] md:min-w-[120px] md:text-[10px] sm:p-[4px_8px] sm:min-w-[100px] sm:text-[9px]"
                                        style={{ opacity: 0 }}
                                    />
                                </>
                            )}
                        </div>

                        {/* Custom Legend */}
                        <div className="flex justify-center items-center gap-6 mt-4 mb-2">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-[#ef4444]"></div>
                                <span className="text-[10px] text-gray-600 font-medium">MAX</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-[#3b82f6]"></div>
                                <span className="text-[10px] text-gray-600 font-medium">MIN</span>
                            </div>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="w-full md:flex-[1] flex flex-col mt-[0px] rounded-none shadow-[0_2px_4px_rgba(0,0,0,0.1)] overflow-hidden border-t-2 border-[#22c55e] relative bg-white">
                        <style>{`
                        .scrollbar-custom::-webkit-scrollbar {
                            width: 2px;
                            height: 2px;
                        }
                        .scrollbar-custom::-webkit-scrollbar-track {
                            background: transparent;
                        }
                        .scrollbar-custom::-webkit-scrollbar-thumb {
                            background: #22C55E;
                            border-radius: 1px;
                        }
                        .scrollbar-custom::-webkit-scrollbar-thumb:hover {
                            background: #15803d;
                        }
                    `}</style>

                        {/* Header Table (Fixed) */}
                        <div className="w-full pr-0 md:pr-[2px] bg-[#6366F1]">
                            <table className="w-full border-collapse font-['Michroma'] bg-white table-fixed md:min-w-full md:whitespace-nowrap">
                                <thead>
                                    <tr>
                                        <th className="bg-[#6366F1] text-white p-[12px_8px] text-left font-normal text-[8.5px] border-b border-[#4f46e5] sm:p-[8px_6px] sm:text-[8px] w-[33.33%]">Time</th>
                                        <th className="bg-[#6366F1] text-white p-[12px_8px] text-left font-normal text-[8.5px] border-b border-[#4f46e5] sm:p-[8px_6px] sm:text-[8px] md:text-center w-[33.33%]">MAX</th>
                                        <th className="bg-[#6366F1] text-white p-[12px_8px] text-left font-normal text-[8.5px] border-b border-[#4f46e5] sm:p-[8px_6px] sm:text-[8px] md:text-center w-[33.33%]">MIN</th>
                                    </tr>
                                </thead>
                            </table>
                        </div>

                        {/* Body Table (Scrollable) */}
                        <div className="max-h-[500px] md:max-h-[850px] overflow-y-auto overflow-x-hidden sm:max-h-[300px] scrollbar-custom">
                            <table className="w-full border-collapse font-['Michroma'] bg-white table-fixed md:min-w-full md:whitespace-nowrap">
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan={3} className="p-[20px] text-center text-[10px] text-[#6b7280]">Loading data...</td></tr>
                                    ) : protoData.slice().reverse().map((row, i) => (
                                        <tr key={i} className="hover:bg-[#f9fafb] transition-colors border-b border-[#f3f4f6] last:border-0">
                                            <td className="p-[10px_8px] text-left font-light text-[11px] text-[#4b5563] sm:p-[6px_6px] sm:text-[9.5px]">{row.time}</td>
                                            <td className="p-[10px_8px] text-left font-normal text-[11px] text-[#111827] sm:p-[6px_6px] sm:text-[9.5px] md:text-center">{row.max}</td>
                                            <td className="p-[10px_8px] text-left font-normal text-[11px] text-[#111827] sm:p-[6px_6px] sm:text-[9.5px] md:text-center">{row.min}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TCCDetail;

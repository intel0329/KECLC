import React, { useState, useEffect, useMemo } from 'react';
import { X, Sliders, Check, RotateCcw, ShieldAlert, Layers } from 'lucide-react';

export default function DemandManager({ show, onClose, leftCircuits, rightCircuits, onSave, getNameById }) {
    if (!show) return null;

    // 1. 회로 데이터를 평탄화(Flatten)하여 통합 부하 목록 추출
    const initialLoads = useMemo(() => {
        const list = [];

        const processCircuits = (circuits, side) => {
            circuits.forEach(c => {
                const circuitNoStr = `${side === 'left' ? 'L' : 'R'}${c.circuitNo || c.row}`;
                
                if (c.loads && c.loads.length > 0) {
                    // 상세 부하가 있는 경우 (PL 부하는 수용률 조절에서 제외)
                    c.loads.forEach((l, idx) => {
                        if (l.category === 'PL') return;
                        list.push({
                            id: `${c.id}_load_${l.id || idx}`,
                            circuitId: c.id,
                            side,
                            circuitNo: c.circuitNo || c.row,
                            circuitNoStr,
                            loadIndex: idx,
                            isDetailed: true,
                            name: l.name || '',
                            qty: Number(l.qty) || 0,
                            va: Number(l.va) || 0,
                            category: l.category || '기타',
                            demandFactor: Number(l.demandFactor !== undefined ? l.demandFactor : 100),
                            originalLoad: l
                        });
                    });
                } else {
                    // 상세 부하가 없고 직접 부하 용량을 입력한 회로 (예비 회로 포함)
                    // PL 성격(계산서 연결)을 가졌는지 확인
                    const isPL = c.connectedPanelId || (typeof c.loadName === 'string' && c.loadName.endsWith('PL'));
                    if (isPL) return;

                    list.push({
                        id: `${c.id}_direct`,
                        circuitId: c.id,
                        side,
                        circuitNo: c.circuitNo || c.row,
                        circuitNoStr,
                        isDetailed: false,
                        name: c.loadName || '직접 입력 부하',
                        qty: Number(c.qty) || 1,
                        va: Number(c.power) || 0,
                        category: (c.loadName || '').includes('동력') ? '동력' : 
                                  (c.loadName || '').includes('전등') ? '전등' : 
                                  (c.loadName || '').includes('전열') ? '전열' : '기타',
                        demandFactor: Number(c.demandFactor !== undefined ? c.demandFactor : 100)
                    });
                }
            });
        };

        processCircuits(leftCircuits, 'left');
        processCircuits(rightCircuits, 'right');
        
        // 부하 종류별(동력 -> 전열 -> 전등 -> 기타/예비) 우선 정렬 후 회로 번호 순 정렬
        const categoryPriority = {
            '동력': 1,
            '전열': 2,
            '전등': 3,
            '기타': 4,
            '예비': 5
        };
        const getPri = (cat) => categoryPriority[cat] || 9;

        return list.sort((a, b) => {
            const priA = getPri(a.category);
            const priB = getPri(b.category);
            if (priA !== priB) return priA - priB;
            
            if (a.side !== b.side) return a.side === 'left' ? -1 : 1;
            return Number(a.circuitNo) - Number(b.circuitNo);
        });
    }, [leftCircuits, rightCircuits]);

    // 실시간 편집용 부하 상태
    const [editLoads, setEditLoads] = useState([]);
    
    // 섹터별(종류별) 일괄 설정 수치 상태
    const [batchValues, setBatchValues] = useState({
        '전등': 100,
        '전열': 100,
        '동력': 100,
        '기타': 100
    });

    // 각 부하 종류별 실제 등록 개수 산정 (슬라이더 비활성화용)
    const categoryCounts = useMemo(() => {
        const counts = { '전등': 0, '전열': 0, '동력': 0, '기타': 0 };
        editLoads.forEach(l => {
            const cat = (l.category === '예비' || l.category === '기타') ? '기타' : l.category;
            if (counts[cat] !== undefined) {
                counts[cat]++;
            }
        });
        return counts;
    }, [editLoads]);

    // 팝업이 켜질 때 초기 데이터 주입
    useEffect(() => {
        setEditLoads(initialLoads);
        
        // 평균 수용률 계산하여 섹터별 대표값 추정 (선택 사항)
        const categories = ['전등', '전열', '동력', '기타'];
        const batchInit = { '전등': 100, '전열': 100, '동력': 100, '기타': 100 };
        categories.forEach(cat => {
            const filtered = initialLoads.filter(l => l.category === cat);
            if (filtered.length > 0) {
                const avg = Math.round(filtered.reduce((sum, l) => sum + l.demandFactor, 0) / filtered.length);
                batchInit[cat] = avg;
            }
        });
        setBatchValues(batchInit);
    }, [initialLoads, show]);

    // 섹터별 일괄 수용률 적용 핸들러
    const handleApplyBatch = (category, value) => {
        const val = Math.max(0, Math.min(100, Number(value)));
        setBatchValues(prev => ({ ...prev, [category]: val }));
        
        setEditLoads(prev => prev.map(l => {
            // 예비 부하 등도 '기타'에 포함하여 일괄 처리
            const targetCat = (l.category === '예비' || l.category === '기타') ? '기타' : l.category;
            if (targetCat === category) {
                return { ...l, demandFactor: val };
            }
            return l;
        }));
    };

    // 개별 부하 수용률 수동 조정 핸들러
    const handleIndividualChange = (id, value) => {
        const val = value === '' ? '' : Math.max(0, Math.min(100, Number(value)));
        setEditLoads(prev => prev.map(l => l.id === id ? { ...l, demandFactor: val } : l));
    };

    // 초기값 리셋 핸들러 - 모든 부하 수용률 및 일괄 조절 수치를 100% 표준 규격으로 일제히 리셋
    const handleReset = () => {
        setEditLoads(prev => prev.map(l => ({ ...l, demandFactor: 100 })));
        setBatchValues({ '전등': 100, '전열': 100, '동력': 100, '기타': 100 });
    };

    // 최종 변경 사항 저장 핸들러
    const handleSave = () => {
        // 부하 데이터가 비어 있는 경우(인풋 공백) 100%로 안전 백업
        const finalLoads = editLoads.map(l => ({
            ...l,
            demandFactor: l.demandFactor === '' ? 100 : Number(l.demandFactor)
        }));

        onSave(finalLoads);
        onClose();
    };

    // 카테고리 컬러 유틸
    const getCategoryBadgeClass = (cat) => {
        switch(cat) {
            case '동력': return 'text-orange-400 bg-orange-500/10 border border-orange-500/20';
            case '전등': return 'text-yellow-400 bg-yellow-500/10 border border-yellow-500/20';
            case '전열': return 'text-sky-400 bg-sky-500/10 border border-sky-500/20';
            case '예비': return 'text-zinc-500 bg-zinc-500/10 border border-zinc-500/20';
            default: return 'text-zinc-300 bg-zinc-800/20 border border-zinc-700/30';
        }
    };

    return (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-50 selection:bg-lime-500/20" onClick={onClose}>
            <div 
                className="border border-white/10 bg-zinc-950/95 backdrop-blur-xl p-6 md:p-8 rounded-2xl max-w-4xl w-full mx-4 shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <style>{`
                    .spinner-visible::-webkit-inner-spin-button,
                    .spinner-visible::-webkit-outer-spin-button {
                        opacity: 1 !important;
                        display: block !important;
                        cursor: pointer;
                    }
                    .spinner-visible {
                        -moz-appearance: number-input !important;
                    }
                    /* Chrome, Safari, Opera, Edge - Custom Range Thumb */
                    .custom-slider::-webkit-slider-thumb {
                        -webkit-appearance: none !important;
                        appearance: none !important;
                        width: 11px !important;
                        height: 11px !important;
                        border-radius: 50% !important;
                        background: #facc15 !important; /* yellow-400 */
                        cursor: pointer !important;
                        border: none !important;
                        transition: transform 0.1s ease-in-out, background-color 0.1s ease-in-out !important;
                        box-shadow: 0 0 4px rgba(0,0,0,0.5) !important;
                    }
                    .custom-slider::-webkit-slider-thumb:hover {
                        background: #eab308 !important; /* yellow-500 */
                        transform: scale(1.25) !important;
                    }
                    /* Firefox - Custom Range Thumb */
                    .custom-slider::-moz-range-thumb {
                        width: 11px !important;
                        height: 11px !important;
                        border-radius: 50% !important;
                        background: #facc15 !important;
                        cursor: pointer !important;
                        border: none !important;
                        transition: transform 0.1s ease-in-out, background-color 0.1s ease-in-out !important;
                        box-shadow: 0 0 4px rgba(0,0,0,0.5) !important;
                    }
                    .custom-slider::-moz-range-thumb:hover {
                        background: #eab308 !important;
                        transform: scale(1.25) !important;
                    }
                `}</style>
                {/* 우측 상단 X 닫기 */}
                <button 
                    onClick={onClose} 
                    className="absolute right-5 top-5 text-zinc-500 hover:text-white transition-colors p-1"
                    title="닫기"
                >
                    <X size={20} />
                </button>

                {/* 타이틀 및 서브타이틀 */}
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2.5 bg-yellow-500/10 rounded-xl border border-yellow-500/20 text-yellow-400">
                        <Sliders size={22} className="animate-pulse" />
                    </div>
                    <div>
                        <h3 className="text-white font-extrabold text-[18px] tracking-tight">부하별 정밀 수용률 종합 매니저</h3>
                        <p className="text-zinc-500 text-[11px] font-medium tracking-wide mt-0.5">
                            계산서의 개별 부하 종류별로 수용률을 일괄 튜닝하거나 개별 상세 조정할 수 있는 전용 컨트롤 룸입니다.
                        </p>
                    </div>
                </div>

                {/* 안내 박스 */}
                <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-4 mb-6 flex items-center gap-3">
                    <ShieldAlert size={18} className="text-lime-500 shrink-0" />
                    <div className="text-[11px] text-zinc-400 font-medium leading-relaxed flex items-center">
                        <span>
                            <span className="text-lime-400 font-bold">KEC 준수 :</span> 본 수용률은 차단기 정격 선정 및 케이블 단면적 판정(KEC)에는 영향을 미치지 않습니다. 수용률은 오직 종합적인 전기 수전 용량 산정 연산에만 적용됩니다.
                        </span>
                    </div>
                </div>

                {/* 마스터 일괄 설정 섹션 */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-zinc-900/30 border border-zinc-900 rounded-xl mb-6">
                    {['동력', '전열', '전등', '기타'].map(cat => {
                        const hasLoads = categoryCounts[cat] > 0;
                        return (
                            <div key={cat} className={`flex flex-col gap-2 transition-all duration-300 ${hasLoads ? '' : 'opacity-25 pointer-events-none'}`}>
                                <div className="flex justify-between items-center px-1">
                                    <span className={`text-[12px] font-bold ${
                                        !hasLoads ? 'text-zinc-600' :
                                        cat === '동력' ? 'text-orange-400' :
                                        cat === '전등' ? 'text-yellow-400' :
                                        cat === '전열' ? 'text-sky-400' : 'text-zinc-400'
                                    }`}>{cat} 일괄 조절</span>
                                    <span className="text-[12px] font-black text-white">{hasLoads ? `${batchValues[cat]}%` : '-'}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="range" 
                                        min="0" 
                                        max="100" 
                                        value={batchValues[cat]} 
                                        disabled={!hasLoads}
                                        onChange={(e) => handleApplyBatch(cat, e.target.value)}
                                        className={`flex-1 custom-slider cursor-pointer h-1 bg-zinc-800 rounded-lg appearance-none ${hasLoads ? '' : 'opacity-10'}`}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* 부하 리스트 테이블 */}
                <div className="border border-zinc-900 rounded-xl overflow-hidden bg-black/40">
                    <div className="grid grid-cols-12 gap-2 bg-zinc-950 px-4 py-3 text-[12px] text-zinc-500 font-bold uppercase tracking-widest border-b border-zinc-900 text-center">
                        <div className="col-span-1.5 text-center">회로</div>
                        <div className="col-span-2 text-center">구분</div>
                        <div className="col-span-4 text-left pl-2">부하 이름</div>
                        <div className="col-span-1.5 text-center">수량</div>
                        <div className="col-span-2 text-right">용량 [VA]</div>
                        <div className="col-span-2 text-center">수용률 [%]</div>
                    </div>

                    <div className="max-h-[260px] overflow-y-auto divide-y divide-zinc-900/50">
                        {editLoads.length > 0 ? (
                            editLoads.map((load) => (
                                <div key={load.id} className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center hover:bg-zinc-900/10 transition-colors text-[12px] text-center">
                                    {/* 회로 번호 */}
                                    <div className="col-span-1.5 font-bold text-zinc-400 text-[12px] bg-zinc-900/60 rounded px-1 py-0.5 border border-zinc-800/40 truncate">
                                        {load.circuitNoStr}
                                    </div>
                                    
                                    {/* 종류 뱃지 */}
                                    <div className="col-span-2 flex justify-center">
                                        <span className={`px-2 py-0.5 rounded text-[11px] font-extrabold tracking-wider ${getCategoryBadgeClass(load.category)}`}>
                                            {load.category}
                                        </span>
                                    </div>

                                    {/* 부하 이름 */}
                                    <div className="col-span-4 text-left pl-2 text-white font-medium truncate" title={load.name}>
                                        {load.name || <span className="text-zinc-700 italic font-normal">부하명 미입력</span>}
                                    </div>

                                    {/* 수량 */}
                                    <div className="col-span-1.5 font-semibold text-zinc-300">
                                        {load.qty} EA
                                    </div>

                                    {/* 용량 */}
                                    <div className="col-span-2 text-right text-zinc-300 font-semibold pr-1">
                                        {load.va.toLocaleString()}
                                    </div>

                                    {/* 수용률 입력칸 - w-18로 확장하고 스피너 표시 */}
                                    <div className="col-span-2 flex justify-center">
                                        <input 
                                            type="number"
                                            min="0"
                                            max="100"
                                            value={load.demandFactor}
                                            onChange={(e) => handleIndividualChange(load.id, e.target.value)}
                                            className={`w-18 bg-zinc-900/90 border border-zinc-800/80 hover:border-zinc-700 focus:border-yellow-400 font-normal rounded pl-3.5 pr-1 py-1 text-xs text-center outline-none transition-all focus:shadow-[0_0_8px_rgba(234,179,8,0.2)] spinner-visible ${
                                                (load.demandFactor === '' || Number(load.demandFactor) === 100) ? 'text-white' : 'text-yellow-400'
                                            }`}
                                        />
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-8 text-center text-zinc-600 text-xs italic">
                                등록된 유효 부하가 없습니다. 회로의 부하 상세 입력을 먼저 진행해 주세요.
                            </div>
                        )}
                    </div>
                </div>

                {/* 실시간 부하 종류별 수용량/수용률 통계 대시보드 - 확보된 여백을 활용해 크기와 텍스트 가동성을 대폭 확장 */}
                <div className="mt-5 grid grid-cols-4 gap-4 p-5 bg-zinc-900/35 border border-zinc-800/80 rounded-xl">
                    {['동력', '전열', '전등', '기타'].map(cat => {
                        const filtered = editLoads.filter(l => {
                            const targetCat = (l.category === '예비' || l.category === '기타') ? '기타' : l.category;
                            return targetCat === cat;
                        });

                        const rawSum = filtered.reduce((sum, l) => sum + (Number(l.qty || 0) * Number(l.va || 0)), 0);
                        const demSum = filtered.reduce((sum, l) => sum + (Number(l.qty || 0) * Number(l.va || 0) * (Number(l.demandFactor !== undefined ? l.demandFactor : 100) / 100)), 0);
                        const percent = rawSum > 0 ? Math.round((demSum / rawSum) * 100) : null;

                        return (
                            <div key={cat} className="flex flex-col gap-1.5 text-left border-r border-zinc-800 last:border-0 pr-3">
                                <span className={`text-[13px] font-extrabold tracking-wider ${
                                    cat === '동력' ? 'text-orange-400' :
                                    cat === '전열' ? 'text-sky-400' :
                                    cat === '전등' ? 'text-yellow-400' : 'text-zinc-400'
                                }`}>{cat} 부하 통계</span>
                                <div className="flex flex-col gap-1 text-[12px] text-zinc-400 mt-1.5">
                                    <div className="flex justify-between">
                                        <span>설비:</span>
                                        <span className="text-zinc-100 font-semibold">{rawSum.toLocaleString()} VA</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>수용:</span>
                                        <span className="text-zinc-100 font-semibold">{rawSum > 0 ? `${Math.round(demSum).toLocaleString()} VA` : '-'}</span>
                                    </div>
                                    <div className="flex justify-between border-t border-zinc-800/60 mt-1.5 pt-1.5 font-bold">
                                        <span>수용률:</span>
                                        <span className={rawSum > 0 ? 'text-white font-extrabold text-[13px]' : 'text-zinc-600 font-normal'}>
                                            {percent !== null ? `${percent}%` : '-'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* 액션 버튼 그룹 - 심플한 스타일 & 확보된 공간 최적화 */}
                <div className="flex gap-3 mt-5">
                    {/* 리셋 */}
                    <button
                        onClick={handleReset}
                        className="w-36 justify-center px-3 py-2 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900 hover:border-zinc-700 text-[12px] font-bold uppercase tracking-wider transition-all rounded-lg flex items-center gap-1.5"
                        title="초기화"
                    >
                        <RotateCcw size={13} /> 초기화
                    </button>

                    {/* 취소 */}
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900 hover:border-zinc-700 text-[12px] font-bold uppercase tracking-wider transition-all rounded-lg"
                    >
                        취소
                    </button>

                    {/* 저장 */}
                    <button
                        onClick={handleSave}
                        className="flex-1 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-zinc-950 font-bold text-[12px] uppercase tracking-wider transition-all rounded-lg shadow-md flex items-center justify-center gap-1.5"
                    >
                        <Check size={14} /> 설정 저장
                    </button>
                </div>
            </div>
        </div>
    );
}

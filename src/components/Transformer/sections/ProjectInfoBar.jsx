import React from 'react';
import { CornerBorders } from '../ui/TransformerUI';

const ProjectInfoBar = (props) => {
    const {
        projectInfo,
        editingPanelName,
        setEditingPanelName,
        handlePanelNameCommit,
        sourceDropdownRef,
        getParentId,
        panelId,
        getNameById,
        showSourceDropdown,
        sourceSearchText,
        setSourceSearchText,
        setShowSourceDropdown,
        setSourceSelectedIndex,
        updateProjectInfo,
        panels,
        sourceSelectedIndex,
        showToast
    } = props;

    return (
        <div className="grid grid-cols-12 gap-4 mb-8">
            <div className="col-span-12 lg:col-span-6 border-2 border-gray-900 bg-black p-4 relative">
                <CornerBorders />
                <div className="grid grid-cols-2 md:grid-cols-12 gap-2 md:gap-4">
                    <div className="col-span-2 md:col-span-5 order-1">
                        <label className="text-[12px] text-gray-400 uppercase tracking-widest block mb-1">Project</label>
                        <div className="bg-transparent text-white font-bold outline-none w-full border-b border-gray-900 cursor-default truncate h-[25px] leading-[25px]" title={projectInfo.name || ''}>
                            {projectInfo.name || ''}
                        </div>
                    </div>
                    <div className="col-span-1 md:col-span-2 order-2">
                        <label className="text-[12px] text-gray-400 uppercase tracking-widest block mb-1">BANK</label>
                        <input
                            value={editingPanelName || ''}
                            onChange={(e) => setEditingPanelName(e.target.value)}
                            onBlur={handlePanelNameCommit}
                            onKeyDown={(e) => e.key === 'Enter' && handlePanelNameCommit()}
                            className="bg-transparent text-yellow-400 font-bold outline-none w-full border-b border-gray-900 focus:border-gray-700"
                        />
                    </div>
                    <div className="col-span-1 md:col-span-2 order-3 relative" ref={sourceDropdownRef}>
                        <label className="text-[12px] text-gray-400 uppercase tracking-widest block mb-1">
                            SOURCE {getParentId(panelId) && <span className="text-[10px] text-green-500 ml-1 font-normal">(Linked)</span>}
                        </label>
                        <input
                            value={showSourceDropdown ? sourceSearchText : (getNameById(projectInfo.fromId) || projectInfo.sourceName || '')}
                            onChange={(e) => {
                                if (getParentId(panelId)) return;
                                const val = e.target.value;
                                setSourceSearchText(val);
                                setShowSourceDropdown(true);
                                setSourceSelectedIndex(0);
                                if (!projectInfo.fromId) {
                                    updateProjectInfo('sourceName', val);
                                }
                            }}
                            onFocus={() => {
                                if (getParentId(panelId)) return;
                                setSourceSearchText(getNameById(projectInfo.fromId) || projectInfo.sourceName || '');
                                setShowSourceDropdown(true);
                            }}
                            onBlur={() => {
                                if (!projectInfo.fromId) {
                                    updateProjectInfo('sourceName', sourceSearchText);
                                }
                                setTimeout(() => setShowSourceDropdown(false), 150);
                            }}
                            onKeyDown={(e) => {
                                if (getParentId(panelId)) return;

                                const filteredPanels = panels.filter(p => {
                                    const search = sourceSearchText.toLowerCase();
                                    const name = p.name.toLowerCase();
                                    const excludedPrefixes = ['transformer-main-', 'panel-feeder-'];
                                    const isExcluded = excludedPrefixes.some(prefix => p.id.startsWith(prefix));
                                    return p.id !== panelId && !isExcluded && name.includes(search);
                                });

                                // index 0 is "Direct Input"
                                const totalOptions = filteredPanels.length + 1;

                                if (e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    setSourceSelectedIndex(prev => (prev + 1) % totalOptions);
                                } else if (e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    setSourceSelectedIndex(prev => (prev - 1 + totalOptions) % totalOptions);
                                } else if (e.key === 'Enter') {
                                    e.preventDefault();
                                    if (sourceSelectedIndex === 0) {
                                        // Handle Direct Input
                                        updateProjectInfo('fromId', '');
                                        updateProjectInfo('sourceName', sourceSearchText);
                                        setShowSourceDropdown(false);
                                    } else if (filteredPanels.length > 0) {
                                        const selected = filteredPanels[sourceSelectedIndex - 1];
                                        if (selected) {
                                            // [STRICT] 상향식(Bottom-Up) 직접 연결 차단
                                            showToast("유효하지 않은 연결입니다.", "error");
                                            setShowSourceDropdown(false);
                                        }
                                    }
                                } else if (e.key === 'Escape') {
                                    setShowSourceDropdown(false);
                                }
                            }}
                            readOnly={!!getParentId(panelId)}
                            className={`bg-transparent font-bold outline-none w-full border-b focus:border-gray-700 ${!!getParentId(panelId) ? 'text-green-400 border-green-900/50 cursor-default' : 'text-white border-gray-900'}`}
                        />
                        {showSourceDropdown && !getParentId(panelId) && (
                            <div className="absolute z-[1001] left-0 right-0 top-full mt-1 bg-black border border-gray-800 shadow-2xl max-h-48 overflow-y-auto custom-scrollbar anim-fade-in">
                                {/* Direct Input Option */}
                                <div
                                    onMouseDown={() => {
                                        updateProjectInfo('fromId', '');
                                        updateProjectInfo('sourceName', sourceSearchText);
                                        setShowSourceDropdown(false);
                                    }}
                                    className={`px-4 py-2 text-sm cursor-pointer transition-colors border-l-2 ${sourceSelectedIndex === 0 ? 'border-yellow-500 bg-white/5 text-white' : 'border-transparent text-gray-400 hover:text-white hover:bg-white/5'} `}
                                >
                                    <div className="flex items-center justify-between">
                                        <span>직접입력</span>
                                    </div>
                                </div>

                                {panels
                                    .filter(p => {
                                        const search = sourceSearchText.toLowerCase();
                                        const name = p.name.toLowerCase();
                                        const excludedPrefixes = ['transformer-main-', 'panel-feeder-'];
                                        const isExcluded = excludedPrefixes.some(prefix => p.id.startsWith(prefix));
                                        return p.id !== panelId && !isExcluded && name.includes(search);
                                    })
                                    .map((panel, index) => (
                                        <div
                                            key={panel.id}
                                            onMouseDown={() => {
                                                // [STRICT] 상향식(Bottom-Up) 직접 연결 차단
                                                showToast("유효하지 않은 연결입니다.", "error");
                                                setShowSourceDropdown(false);
                                            }}
                                            className={`px-4 py-2 text-sm cursor-pointer transition-colors border-l-2 ${index + 1 === sourceSelectedIndex ? 'border-yellow-500 bg-white/5 text-white' : 'border-transparent text-gray-300 hover:text-white hover:bg-white/5 hover:border-yellow-500'} `}
                                        >
                                            {panel.name}
                                        </div>
                                    ))
                                }
                            </div>
                        )}
                    </div>
                    <div className="col-span-2 md:col-span-3 order-4">
                        <label className="text-[12px] text-gray-400 uppercase tracking-widest block mb-1">Location</label>
                        <input
                            value={projectInfo.location || ''}
                            onChange={(e) => updateProjectInfo('location', e.target.value)}
                            className="bg-transparent text-white font-bold outline-none w-full border-b border-gray-900 focus:border-gray-700"
                        />
                    </div>
                </div>
            </div>
            <div className="col-span-12 lg:col-span-3 border-2 border-gray-900 bg-black p-4 relative">
                <CornerBorders />
                <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                        <label className="text-[12px] text-gray-400 uppercase tracking-widest block mb-1">Phase</label>
                        <div className="text-white font-bold py-1 text-[14px] text-center w-full">
                            3Φ
                        </div>
                    </div>
                    <div>
                        <label className="text-[12px] text-gray-400 uppercase tracking-widest block mb-1">Voltage</label>
                        <div className="text-white font-bold py-1 text-[14px] text-center w-full">
                            22.9kV
                        </div>
                    </div>
                    <div>
                        <label className="text-[12px] text-gray-400 uppercase tracking-widest block mb-1">TR CAP</label>
                        <div className="flex items-center justify-center">
                            <input
                                type="number"
                                value={projectInfo.mainCapacity || ''}
                                onChange={(e) => updateProjectInfo('mainCapacity', e.target.value)}
                                className="bg-transparent border-none text-yellow-400 font-bold py-1 text-[14px] outline-none text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none p-0"
                                style={{ width: `${Math.max(1, String(projectInfo.mainCapacity || '').length)}ch` }}
                            />
                            <span className="text-gray-400 text-[12px] ml-1">kVA</span>
                        </div>
                    </div>
                </div>
            </div>
            <div className="col-span-12 lg:col-span-3 border-2 border-gray-900 bg-black p-4 relative">
                <CornerBorders />
                <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                        <label className="text-[12px] text-gray-400 uppercase tracking-widest block mb-1">Type</label>
                        <select
                            value={projectInfo.usageType}
                            onChange={(e) => updateProjectInfo('usageType', e.target.value)}
                            className="bg-transparent border-none text-yellow-400 font-bold py-1 text-[14px] outline-none cursor-pointer appearance-none text-center w-fit mx-auto block min-w-[60px]"
                            style={{ textAlignLast: 'center' }}
                        >
                            <option value="OIL" className="bg-black">OIL</option>
                            <option value="MOLD" className="bg-black">MOLD</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-[12px] text-gray-400 uppercase tracking-widest block mb-1">Mount</label>
                        <select
                            value={projectInfo.installType}
                            onChange={(e) => updateProjectInfo('installType', e.target.value)}
                            className="bg-transparent border-none text-yellow-400 font-bold py-1 text-[14px] outline-none cursor-pointer appearance-none text-center w-fit mx-auto block min-w-[60px]"
                            style={{ textAlignLast: 'center' }}
                        >
                            <option value="옥내형" className="bg-black">옥내형</option>
                            <option value="옥외형" className="bg-black">옥외형</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-[12px] text-gray-400 uppercase tracking-widest block mb-1">인입긍장</label>
                        <div className="flex items-center justify-center">
                            <input
                                type="number"
                                value={projectInfo.branchDistance || 0}
                                onChange={(e) => updateProjectInfo('branchDistance', Number(e.target.value) || 0)}
                                className="bg-transparent border-none text-yellow-400 font-bold py-1 text-[14px] outline-none w-12 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <span className="text-gray-500 text-[12px] ml-0.5">m</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProjectInfoBar;

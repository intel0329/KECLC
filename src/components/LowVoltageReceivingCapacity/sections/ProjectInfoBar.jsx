import React from 'react';
import { CornerBorders } from '../ui/LowVoltageUI';

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
                        <label className="text-[12px] text-gray-400 uppercase tracking-widest block mb-1">PANEL</label>
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
                        <select
                            value={projectInfo.phase || '3Φ4W'}
                            onChange={(e) => updateProjectInfo('phase', e.target.value)}
                            className="bg-transparent border-none text-yellow-400 font-bold py-1 text-[14px] outline-none cursor-pointer appearance-none text-center w-fit mx-auto block min-w-[60px]"
                            style={{ textAlignLast: 'center' }}
                        >
                            <option value="1Φ2W" className="bg-black">1Φ2W</option>
                            <option value="3Φ4W" className="bg-black">3Φ4W</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-[12px] text-gray-400 uppercase tracking-widest block mb-1">Voltage</label>
                        <select
                            value={projectInfo.voltage || '380/220V'}
                            onChange={(e) => updateProjectInfo('voltage', e.target.value)}
                            className="bg-transparent border-none text-yellow-400 font-bold py-1 text-[14px] outline-none cursor-pointer appearance-none text-center w-fit mx-auto block min-w-[60px]"
                            style={{ textAlignLast: 'center' }}
                        >
                            <option value="220V" className="bg-black">220V</option>
                            <option value="380/220V" className="bg-black">380/220V</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-[12px] text-gray-400 uppercase tracking-widest block mb-1">수전 용량</label>
                        <div className="flex items-center justify-center">
                            <input
                                type="number"
                                value={projectInfo.mainCapacity || ''}
                                onChange={(e) => updateProjectInfo('mainCapacity', e.target.value)}
                                className="bg-transparent border-none text-yellow-400 font-bold py-1 text-[14px] outline-none text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none p-0"
                                style={{ width: `${Math.max(1, String(projectInfo.mainCapacity || '').length)}ch` }}
                            />
                            <span className="text-gray-400 text-[12px] ml-1">kW</span>
                        </div>
                    </div>
                </div>
            </div>
            <div className="col-span-12 lg:col-span-3 border-2 border-gray-900 bg-black p-4 relative">
                <CornerBorders />
                <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                        <label className="text-[12px] text-gray-400 uppercase tracking-widest block mb-1">TYPE</label>
                        <select
                            value={projectInfo.contractType || '일반(갑)'}
                            onChange={(e) => updateProjectInfo('contractType', e.target.value)}
                            className="bg-transparent border-none text-yellow-400 font-bold py-1 text-[14px] outline-none cursor-pointer appearance-none text-center w-fit mx-auto block min-w-[60px]"
                            style={{ textAlignLast: 'center' }}
                        >
                            <option value="일반(갑)" className="bg-black">일반(갑)</option>
                            <option value="일반(을)" className="bg-black">일반(을)</option>
                            <option value="주택(저압)" className="bg-black">주택(저압)</option>
                            <option value="주택(고압)" className="bg-black">주택(고압)</option>
                            <option value="교육(갑)" className="bg-black">교육(갑)</option>
                            <option value="교육(을)" className="bg-black">교육(을)</option>
                            <option value="산업(갑)" className="bg-black">산업(갑)</option>
                            <option value="산업(을)" className="bg-black">산업(을)</option>
                            <option value="농사(갑)" className="bg-black">농사(갑)</option>
                            <option value="농사(을)" className="bg-black">농사(을)</option>
                            <option value="전기차" className="bg-black">전기차</option>
                            <option value="태양광" className="bg-black">태양광</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-[12px] text-gray-400 uppercase tracking-widest block mb-1">MOUNT</label>
                        <select
                            value={projectInfo.mountType || '노출'}
                            onChange={(e) => updateProjectInfo('mountType', e.target.value)}
                            className="bg-transparent border-none text-yellow-400 font-bold py-1 text-[14px] outline-none cursor-pointer appearance-none text-center w-fit mx-auto block min-w-[60px]"
                            style={{ textAlignLast: 'center' }}
                        >
                            <option value="매입" className="bg-black">매입</option>
                            <option value="노출" className="bg-black">노출</option>
                            <option value="방우" className="bg-black">방우</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-[12px] text-gray-400 uppercase tracking-widest block mb-1">BRANCH</label>
                        <div className="flex items-center justify-center">
                            <input
                                type="number"
                                value={projectInfo.branchDistance || 0}
                                onChange={(e) => updateProjectInfo('branchDistance', Number(e.target.value) || 0)}
                                className="bg-transparent border-none text-yellow-400 font-bold py-1 text-[14px] outline-none w-10 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none p-0"
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

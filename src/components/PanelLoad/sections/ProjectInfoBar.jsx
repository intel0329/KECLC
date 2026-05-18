import React from 'react';
import { CornerBorders } from '../ui/PanelLoadUI';

export const ProjectInfoBar = (props) => {
    const {
        projectInfo,
        editingPanelName,
        setEditingPanelName,
        handlePanelNameCommit,
        updateProjectInfo,
        sourceDropdownRef,
        showSourceDropdown,
        sourceSearchText,
        setSourceSearchText,
        setShowSourceDropdown,
        setSourceSelectedIndex,
        sourceSelectedIndex,
        getNameById,
        getParentId,
        panelId,
        panels,
        checkCircularDependency,
        lastSourceChangeRef,
        forceSaveRef,
        showToast,
        isMainPhaseInvalid,
        maxLoadLevel,
        PHASE_LEVELS,
        setProjectInfo
    } = props;

    return (
        <div className="grid grid-cols-12 gap-4 mb-8">
            <div className="col-span-12 lg:col-span-6 border-2 border-gray-900 bg-black p-4 relative">
                <CornerBorders />
                <div className="grid grid-cols-2 md:grid-cols-12 gap-2 md:gap-4">
                    <div className="col-span-2 md:col-span-5 order-1">
                        <label className="text-[12px] text-gray-400 uppercase tracking-widest block mb-1">Project</label>
                        <div className="bg-transparent text-white font-bold outline-none w-full border-b border-gray-900 focus:border-gray-700 cursor-default truncate h-[25px] leading-[25px]" title={projectInfo.name}>
                            {projectInfo.name}
                        </div>
                    </div>
                    <div className="col-span-1 md:col-span-2 order-2">
                        <label className="text-[12px] text-gray-400 uppercase tracking-widest block mb-1">Panel</label>
                        <input
                            value={editingPanelName}
                            onChange={(e) => setEditingPanelName(e.target.value)}
                            onBlur={handlePanelNameCommit}
                            onKeyDown={(e) => e.key === 'Enter' && handlePanelNameCommit()}
                            className="bg-transparent text-yellow-400 font-bold outline-none w-full border-b border-gray-900 focus:border-gray-700"
                        />
                    </div>
                    <div className="col-span-2 md:col-span-2 order-4 md:order-3 relative" ref={sourceDropdownRef}>
                        <label className="text-[12px] text-gray-400 uppercase tracking-widest block mb-1">
                            SOURCE {getParentId(panelId) && <span className="text-[10px] text-green-500 ml-1 font-normal">(Linked)</span>}
                        </label>
                        <input
                            value={showSourceDropdown ? sourceSearchText : (getNameById(projectInfo.fromId) || projectInfo.sourceName || '')}
                            onChange={(e) => {
                                if (getParentId(panelId)) return;
                                const newValue = e.target.value;
                                setSourceSearchText(newValue);
                                setShowSourceDropdown(true);
                                setSourceSelectedIndex(0);

                                if (!projectInfo.fromId) {
                                    updateProjectInfo('sourceName', newValue);
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
                                
                                const filteredPanels = panels.filter(p => p.id !== panelId && p.name.toLowerCase().includes(sourceSearchText.toLowerCase()));
                                const totalOptions = filteredPanels.length + 1; // +1 for "Direct Input"

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
                                        forceSaveRef.current = true;
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
                                        forceSaveRef.current = true;
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
                                    .filter(p => p.id !== panelId && p.name.toLowerCase().includes(sourceSearchText.toLowerCase()))
                                    .map((panel, index) => (
                                        <div
                                            key={panel.id}
                                            onMouseDown={() => {
                                                // [STRICT] 상향식(Bottom-Up) 직접 연결 차단
                                                showToast("유효하지 않은 연결입니다.", "error");
                                                setShowSourceDropdown(false);
                                            }}
                                            className={`px-4 py-2 text-sm cursor-pointer transition-colors border-l-2 ${index + 1 === sourceSelectedIndex ? 'border-yellow-500 bg-white/5 text-white' : 'border-transparent text-gray-300 hover:text-white hover:bg-white/5 hover:border-yellow-500'}`}
                                        >
                                            {panel.name}
                                        </div>
                                    ))
                                }
                            </div>
                        )}
                    </div>
                    <div className="col-span-1 md:col-span-3 order-3 md:order-4">
                        <label className="text-[12px] text-gray-400 uppercase tracking-widest block mb-1">Location</label>
                        <input
                            value={projectInfo.location}
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
                        <div className="relative w-fit mx-auto">
                            {isMainPhaseInvalid && (
                                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center animate-bounce">
                                    <div className="bg-red-600/90 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded shadow-xl relative whitespace-nowrap">
                                        Chk.
                                        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-red-600/90"></div>
                                    </div>
                                </div>
                            )}
                            <select
                                value={projectInfo.phase}
                                onChange={(e) => {
                                    const newPhase = e.target.value;
                                    const newLevel = PHASE_LEVELS[newPhase];

                                    if (newLevel < maxLoadLevel) {
                                        showToast("하위 부하를 수용할 수 없는 상 설정", "error");
                                    }

                                    let newVoltage = projectInfo.voltage;
                                    if (newPhase === '1Ø-2W') newVoltage = '220V';
                                    else if (newPhase === '3Ø-3W') newVoltage = '380V';
                                    else if (newPhase === '3Ø-4W') newVoltage = '380V';
                                    
                                    // [BROADCAST TRIGGER] updateProjectInfo를 통해 변경하여 isLocalChangeRef와 브로드캐스트 작동 보장
                                    updateProjectInfo('voltage', newVoltage);
                                    updateProjectInfo('phase', newPhase);
                                }}
                                className="bg-transparent border-none text-yellow-400 font-bold py-1 text-[14px] outline-none cursor-pointer appearance-none text-center w-fit mx-auto block min-w-[80px]"
                                style={{ textAlignLast: 'center' }}
                            >
                                <option value="1Ø-2W" className="bg-black">1Ø-2W</option>
                                <option value="3Ø-3W" className="bg-black">3Ø-3W</option>
                                <option value="3Ø-4W" className="bg-black">3Ø-4W</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="text-[12px] text-gray-400 uppercase tracking-widest block mb-1">Voltage</label>
                        <div className="bg-transparent border-none text-blue-400 font-bold py-1 text-[14px] w-fit mx-auto min-w-[80px]">{projectInfo.voltage}</div>
                    </div>
                    <div>
                        <label className="text-[12px] text-gray-400 uppercase tracking-widest block mb-1">{projectInfo.mainBreakerType || 'MCCB'}</label>
                        <div className="bg-transparent border-none text-blue-400 font-bold py-1 text-[14px] w-fit mx-auto flex flex-col items-center leading-tight">
                            <span>{projectInfo.mccbAF}AF</span>
                            <span>{projectInfo.mccbAT}AT</span>
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
                            className={`bg-transparent border-none font-bold py-1 text-[14px] outline-none cursor-pointer appearance-none text-center w-fit mx-auto block min-w-[60px] ${projectInfo.usageType === '비상' ? 'text-red-500' : 'text-yellow-400'}`}
                            style={{ textAlignLast: 'center' }}
                        >
                            <option value="일반" className="bg-black">일반</option>
                            <option value="비상" className="text-red-500 bg-black">비상</option>
                            <option value="필수" className="bg-black">필수</option>
                            <option value="ELEV" className="bg-black">ELEV</option>
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
                            <option value="매입" className="bg-black">매입</option>
                            <option value="노출" className="bg-black">노출</option>
                            <option value="방우" className="bg-black">방우</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-[12px] text-gray-400 uppercase tracking-widest block mb-1">Branch</label>
                        <div className="flex items-center justify-center">
                            <input
                                type="number"
                                value={projectInfo.branchDistance}
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

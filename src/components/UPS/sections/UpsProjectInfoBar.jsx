import React from 'react';
import { CornerBorders } from '../ui/UpsUI';
import SyncStatusIndicator from '../../SyncStatusIndicator';

const UpsProjectInfoBar = (props) => {
    // Dumb component: receiving all data as props
    const {
        projectName,
        panelName,
        projectInfo,
        updateProjectInfo,
        editingPanelName,
        setEditingPanelName,
        handlePanelNameCommit,
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
        setProjectInfo,
        isMainPhaseInvalid,
        maxLoadLevel,
        PHASE_LEVELS
    } = props;

    return (
        <div className="grid grid-cols-12 gap-4 mb-8">
            <div className="col-span-12 lg:col-span-6 border-2 border-gray-900 bg-black pt-4 pb-[22px] px-4 relative">
                <CornerBorders />
                <div className="grid grid-cols-2 md:grid-cols-12 gap-2 md:gap-4">
                    <div className="col-span-2 md:col-span-5 order-1">
                        <label className="text-[12px] text-gray-400 uppercase tracking-widest block mb-1">Project</label>
                        <div className="bg-transparent text-white font-bold outline-none w-full border-b border-gray-900 cursor-default truncate h-[25px] leading-[25px]" title={projectName || projectInfo.name || ''}>
                            {projectName || projectInfo.name || ''}
                        </div>
                    </div>
                    <div className="col-span-1 md:col-span-2 order-2">
                        <label className="text-[12px] text-gray-400 uppercase tracking-widest block mb-1">Panel</label>
                        <input
                            value={props.editingPanelName}
                            onChange={(e) => props.setEditingPanelName(e.target.value)}
                            onBlur={props.handlePanelNameCommit}
                            onKeyDown={(e) => e.key === 'Enter' && props.handlePanelNameCommit()}
                            className="bg-transparent text-yellow-400 font-bold outline-none w-full border-b border-gray-900 focus:border-gray-700"
                        />
                    </div>
                    <div className="col-span-2 md:col-span-2 order-4 md:order-3 relative" ref={props.sourceDropdownRef}>
                        <label className="text-[12px] text-gray-400 uppercase tracking-widest block mb-1">
                            SOURCE {props.getParentId(props.panelId) && <span className="text-[10px] text-green-500 ml-1 font-normal">(Linked)</span>}
                        </label>
                        <input
                            value={props.showSourceDropdown ? props.sourceSearchText : (props.getNameById(projectInfo.fromId) || projectInfo.sourceName || '')}
                            onChange={(e) => {
                                if (props.getParentId(props.panelId)) return;
                                const newValue = e.target.value;
                                props.setSourceSearchText(newValue);
                                props.setShowSourceDropdown(true);
                                props.setSourceSelectedIndex(0);

                                if (!projectInfo.fromId) {
                                    updateProjectInfo('sourceName', newValue);
                                }
                            }}
                            onFocus={() => {
                                if (props.getParentId(props.panelId)) return;
                                props.setSourceSearchText(props.getNameById(projectInfo.fromId) || projectInfo.sourceName || '');
                                props.setShowSourceDropdown(true);
                            }}
                            onBlur={() => {
                                if (!projectInfo.fromId) {
                                    updateProjectInfo('sourceName', props.sourceSearchText);
                                }
                                setTimeout(() => props.setShowSourceDropdown(false), 150);
                            }}
                            onKeyDown={(e) => {
                                if (props.getParentId(props.panelId)) return;

                                const filteredPanels = props.panels.filter(p => p.id !== props.panelId && p.name.toLowerCase().includes(props.sourceSearchText.toLowerCase()));
                                const totalOptions = filteredPanels.length + 1; // +1 for "Direct Input"

                                if (e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    props.setSourceSelectedIndex(prev => (prev + 1) % totalOptions);
                                } else if (e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    props.setSourceSelectedIndex(prev => (prev - 1 + totalOptions) % totalOptions);
                                } else if (e.key === 'Enter') {
                                    e.preventDefault();
                                    if (props.sourceSelectedIndex === 0) {
                                        // Handle Direct Input
                                        props.forceSaveRef.current = true;
                                        updateProjectInfo('fromId', '');
                                        updateProjectInfo('sourceName', props.sourceSearchText);
                                        props.setShowSourceDropdown(false);
                                    } else if (filteredPanels.length > 0) {
                                        const selected = filteredPanels[props.sourceSelectedIndex - 1];
                                        if (selected) {
                                            // [STRICT] 상향식(Bottom-Up) 직접 연결 차단
                                            props.showToast("유효하지 않은 연결입니다.", "error");
                                            props.setShowSourceDropdown(false);
                                        }
                                    }
                                } else if (e.key === 'Escape') {
                                    props.setShowSourceDropdown(false);
                                }
                            }}
                            readOnly={!!props.getParentId(props.panelId)}
                            className={`bg-transparent font-bold outline-none w-full border-b focus:border-gray-700 ${!!props.getParentId(props.panelId) ? 'text-green-400 border-green-900/50 cursor-default' : 'text-white border-gray-900'}`}
                        />
                        {props.showSourceDropdown && !props.getParentId(props.panelId) && (
                            <div className="absolute z-[1001] left-0 right-0 top-full mt-1 bg-black border border-gray-800 shadow-2xl max-h-48 overflow-y-auto custom-scrollbar anim-fade-in">
                                {/* Direct Input Option */}
                                <div
                                    onMouseDown={() => {
                                        props.forceSaveRef.current = true;
                                        updateProjectInfo('fromId', '');
                                        updateProjectInfo('sourceName', props.sourceSearchText);
                                        props.setShowSourceDropdown(false);
                                    }}
                                    className={`px-4 py-2 text-sm cursor-pointer transition-colors border-l-2 ${props.sourceSelectedIndex === 0 ? 'border-yellow-500 bg-white/5 text-white' : 'border-transparent text-gray-400 hover:text-white hover:bg-white/5'} `}
                                >
                                    <div className="flex items-center justify-between">
                                        <span>직접입력</span>
                                    </div>
                                </div>

                                {props.panels
                                    .filter(p => p.id !== props.panelId && p.name.toLowerCase().includes(props.sourceSearchText.toLowerCase()))
                                    .map((panel, index) => (
                                        <div
                                            key={panel.id}
                                            onMouseDown={() => {
                                                // [STRICT] 상향식(Bottom-Up) 직접 연결 차단
                                                props.showToast("유효하지 않은 연결입니다.", "error");
                                                props.setShowSourceDropdown(false);
                                            }}
                                            className={`px-4 py-2 text-sm cursor-pointer transition-colors border-l-2 ${index + 1 === props.sourceSelectedIndex ? 'border-yellow-500 bg-white/5 text-white' : 'border-transparent text-gray-300 hover:text-white hover:bg-white/5 hover:border-yellow-500'}`}
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
                            value={projectInfo.location || ''}
                            onChange={(e) => updateProjectInfo('location', e.target.value)}
                            className="bg-transparent text-white font-bold outline-none w-full border-b border-gray-900 focus:border-gray-700"
                        />
                    </div>
                </div>
            </div>
            <div className="col-span-12 lg:col-span-3 border-2 border-gray-900 bg-black pt-4 pb-[22px] px-4 relative">
                <CornerBorders />
                <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                        <label className="text-[12px] text-gray-400 uppercase tracking-widest block mb-1">Phase</label>
                        <div className="relative w-fit mx-auto">
                            {props.isMainPhaseInvalid && (
                                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center animate-bounce">
                                    <div className="bg-red-600/90 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded shadow-xl relative whitespace-nowrap">
                                        Chk.
                                        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-red-600/90"></div>
                                    </div>
                                </div>
                            )}
                            <select
                                value={projectInfo.phase || '3Ø-4W'}
                                onChange={(e) => {
                                    const newPhase = e.target.value;
                                    const newLevel = props.PHASE_LEVELS[newPhase];

                                    if (newLevel < props.maxLoadLevel) {
                                        props.showToast("하위 부하를 수용할 수 없는 상 설정", "error");
                                    }

                                    let newVoltage = '380V';
                                    if (newPhase === '1Ø-2W') newVoltage = '220V';
                                    else if (newPhase === '3Ø-3W') newVoltage = '380V';
                                    else if (newPhase === '3Ø-4W') newVoltage = '380V';
                                    setProjectInfo(prev => ({ ...prev, phase: newPhase, voltage: newVoltage }));
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
                        <div className="bg-transparent border-none text-blue-400 font-bold py-1 text-[14px] w-fit mx-auto min-w-[60px] text-center">
                            {projectInfo.voltage || '380V'}
                        </div>
                    </div>
                    <div>
                        <label className="text-[12px] text-gray-400 uppercase tracking-widest block mb-1">{projectInfo.mainBreakerType || 'MCCB'}</label>
                        <div className="flex flex-col items-center leading-tight mt-1.5">
                            <div className="flex items-center justify-center">
                                <input
                                    type="text"
                                    value={(projectInfo.mccbAF === 0 || projectInfo.mccbAF === '0') ? '' : (projectInfo.mccbAF || '')}
                                    placeholder=""
                                    onChange={(e) => updateProjectInfo('mccbAF', e.target.value)}
                                    className="bg-transparent border-none text-blue-400 font-bold py-0 text-[14px] outline-none text-right"
                                    style={{ width: (projectInfo.mccbAF && projectInfo.mccbAF !== '0' && projectInfo.mccbAF !== 0) ? `${String(projectInfo.mccbAF).length}ch` : '0px' }}
                                />
                                <span className="text-blue-400 font-bold text-[14px]">AF</span>
                            </div>
                            <div className="flex items-center justify-center">
                                <input
                                    type="text"
                                    value={(projectInfo.mccbAT === 0 || projectInfo.mccbAT === '0') ? '' : (projectInfo.mccbAT || '')}
                                    placeholder=""
                                    onChange={(e) => updateProjectInfo('mccbAT', e.target.value)}
                                    className="bg-transparent border-none text-blue-400 font-bold py-0 text-[14px] outline-none text-right"
                                    style={{ width: (projectInfo.mccbAT && projectInfo.mccbAT !== '0' && projectInfo.mccbAT !== 0) ? `${String(projectInfo.mccbAT).length}ch` : '0px' }}
                                />
                                <span className="text-blue-400 font-bold text-[14px]">AT</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div className="col-span-12 lg:col-span-3 border-2 border-gray-900 bg-black pt-4 pb-[22px] px-4 relative">
                <CornerBorders />
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="text-[12px] text-gray-400 uppercase tracking-widest block mb-1 text-center">CAPACITY</label>
                        <div className="flex items-center justify-center">
                            <input
                                type="text"
                                value={projectInfo.mainCapacity || ''}
                                onChange={(e) => updateProjectInfo('mainCapacity', e.target.value)}
                                className="bg-transparent border-none text-yellow-400 font-bold py-1 text-[14px] outline-none text-center w-fit"
                                style={{ width: `${Math.max(1, String(projectInfo.mainCapacity || '').length)}ch` }}
                            />
                            <span className="text-yellow-400 font-bold text-[12px] ml-0.5">kVA</span>
                        </div>
                    </div>
                    <div>
                        <label className="text-[12px] text-gray-400 uppercase tracking-widest block mb-1 text-center">BACKUP</label>
                        <select
                            value={projectInfo.upsBackupTime || '60'}
                            onChange={(e) => updateProjectInfo('upsBackupTime', e.target.value)}
                            className="bg-transparent border-none text-yellow-400 font-bold py-1 text-[14px] outline-none cursor-pointer appearance-none text-center w-fit mx-auto block min-w-[60px]"
                            style={{ textAlignLast: 'center' }}
                        >
                            <option value="10" className="bg-black">10분</option>
                            <option value="20" className="bg-black">20분</option>
                            <option value="30" className="bg-black">30분</option>
                            <option value="60" className="bg-black">60분</option>
                            <option value="120" className="bg-black">120분</option>
                        </select>
                    </div>
                    <div className="flex flex-col items-end w-fit mx-auto">
                        <label className="text-[12px] text-gray-400 uppercase tracking-widest block mb-1 text-right">BRANCH</label>
                        <div className="flex items-baseline justify-end">
                            <input
                                type="text"
                                value={projectInfo.branchDistance || 1.5}
                                onChange={(e) => updateProjectInfo('branchDistance', e.target.value)}
                                className="bg-transparent border-none text-yellow-400 font-bold py-1 text-[14px] outline-none text-right w-fit"
                                style={{ width: `${Math.max(1, String(projectInfo.branchDistance || 1.5).length)}ch` }}
                            />
                            <span className="text-gray-500 font-bold text-[12px] ml-0.5">m</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UpsProjectInfoBar;

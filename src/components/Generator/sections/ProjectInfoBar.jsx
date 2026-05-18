import React from 'react';
import { CornerBorders } from '../ui/GeneratorUI';

const ProjectInfoBar = (props) => {
    const { projectInfo, updateProjectInfo } = props;

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
                    <div className="col-span-2 md:col-span-4 order-2">
                        <label className="text-[12px] text-gray-400 uppercase tracking-widest block mb-1">TITLE</label>
                        <input
                            value="발전기 용량 계산서"
                            readOnly
                            className="bg-transparent text-white font-bold outline-none w-full border-b border-gray-900 cursor-default"
                        />
                    </div>
                    <div className="col-span-2 md:col-span-3 order-3">
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
                            380V
                        </div>
                    </div>
                    <div>
                        <label className="text-[12px] text-gray-400 uppercase tracking-widest block mb-1">GEN CAP</label>
                        <div className="flex items-center justify-center">
                            <input
                                type="number"
                                value={projectInfo.mainCapacity || ''}
                                readOnly
                                className="bg-transparent border-none text-yellow-400 font-bold py-1 text-[14px] outline-none text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none p-0 cursor-default"
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
                        <label className="text-[12px] text-gray-400 uppercase tracking-widest block mb-1">Type</label>
                        <select
                            value={projectInfo.usageType || 'DIESEL'}
                            onChange={(e) => updateProjectInfo('usageType', e.target.value)}
                            className="bg-transparent border-none text-yellow-400 font-bold py-1 text-[14px] outline-none cursor-pointer appearance-none text-center w-fit mx-auto block min-w-[60px]"
                            style={{ textAlignLast: 'center' }}
                        >
                            <option value="DIESEL" className="bg-black">디젤형</option>
                            <option value="GAS" className="bg-black">가스형</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-[12px] text-gray-400 uppercase tracking-widest block mb-1">Usage</label>
                        <select
                            value={projectInfo.installType || 'EMERGENCY'}
                            onChange={(e) => updateProjectInfo('installType', e.target.value)}
                            className="bg-transparent border-none text-yellow-400 font-bold py-1 text-[14px] outline-none cursor-pointer appearance-none text-center w-fit mx-auto block min-w-[60px]"
                            style={{ textAlignLast: 'center' }}
                        >
                            <option value="EMERGENCY" className="bg-black">비상용</option>
                            <option value="COMMON" className="bg-black">상용</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-[12px] text-gray-400 uppercase tracking-widest block mb-1">GCP</label>
                        <select
                            value={projectInfo.gcpType || '별치형'}
                            onChange={(e) => updateProjectInfo('gcpType', e.target.value)}
                            className="bg-transparent border-none text-yellow-400 font-bold py-1 text-[14px] outline-none cursor-pointer appearance-none text-center w-fit mx-auto block min-w-[60px]"
                            style={{ textAlignLast: 'center' }}
                        >
                            <option value="별치형" className="bg-black">별치형</option>
                            <option value="내장형" className="bg-black">내장형</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProjectInfoBar;

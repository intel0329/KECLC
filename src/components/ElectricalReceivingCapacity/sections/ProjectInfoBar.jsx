import React from 'react';
import { CornerBorders } from '../ui/CapacityUI';

const ProjectInfoBar = (props) => {
    const { projectInfo, updateProjectInfo, insulationTypes = ['OIL'] } = props;

    return (
        <div className="grid grid-cols-12 gap-4 mb-8">
            <div className="col-span-12 lg:col-span-6 border-2 border-gray-900 bg-black p-4 relative">
                <CornerBorders />
                <div className="grid grid-cols-2 md:grid-cols-12 gap-2 md:gap-4">
                    <div className="col-span-2 md:col-span-5 order-1">
                        <label className="text-[12px] text-gray-400 uppercase tracking-widest block mb-1">Project</label>
                        <input
                            value={projectInfo.name || ''}
                            readOnly
                            className="bg-transparent text-white font-bold outline-none w-full border-b border-gray-900 cursor-default"
                        />
                    </div>
                    <div className="col-span-1 md:col-span-2 order-2">
                        <label className="text-[12px] text-gray-400 uppercase tracking-widest block mb-1">TITLE</label>
                        <input
                            value="수배전반 계산서"
                            readOnly
                            className="bg-transparent text-white font-bold outline-none w-full border-b border-gray-900 cursor-default"
                        />
                    </div>
                    <div className="col-span-1 md:col-span-2 order-2 md:order-3">
                        <label className="text-[12px] text-gray-400 uppercase tracking-widest block mb-1">SOURCE</label>
                        <input
                            value={projectInfo.source || ''}
                            onChange={(e) => updateProjectInfo('source', e.target.value)}
                            className="bg-transparent text-yellow-500 font-bold outline-none w-full border-b border-gray-900 focus:border-gray-700"
                        />
                    </div>
                    <div className="col-span-2 md:col-span-3 order-3 md:order-4">
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
                                readOnly
                                className="bg-transparent border-none text-white font-bold py-1 text-[14px] outline-none text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none p-0 cursor-default"
                                style={{ width: `${Math.max(1, String(projectInfo.mainCapacity || '').length)}ch` }}
                            />
                            <span className="text-gray-400 text-[12px] ml-1">kVA</span>
                        </div>
                    </div>
                </div>
            </div>
            <div className="col-span-12 lg:col-span-3 border-2 border-gray-900 bg-black p-4 relative">
                <CornerBorders />
                <div className="grid grid-cols-3 gap-4 text-center h-full">
                    <div className="flex flex-col h-full justify-start">
                        <label className="text-[12px] text-gray-400 uppercase tracking-widest block mb-1">Type</label>
                        <div className="text-white font-bold text-[14px] leading-tight flex-1 flex flex-col justify-center gap-0.5">
                            {insulationTypes.map((type, i) => (
                                <div key={i}>{type}</div>
                            ))}
                        </div>
                    </div>
                    <div className="flex flex-col h-full justify-start">
                        <label className="text-[12px] text-gray-400 uppercase tracking-widest block mb-1">Mount</label>
                        <select
                            value={projectInfo.installType}
                            onChange={(e) => updateProjectInfo('installType', e.target.value)}
                            className="bg-transparent border-none text-yellow-400 font-bold py-1 text-[14px] outline-none cursor-pointer appearance-none text-center w-fit mx-auto block min-w-[60px] flex-1"
                            style={{ textAlignLast: 'center' }}
                        >
                            <option value="옥내형" className="bg-black">옥내형</option>
                            <option value="옥외형" className="bg-black">옥외형</option>
                        </select>
                    </div>
                    <div className="flex flex-col h-full justify-start">
                        <label className="text-[12px] text-gray-400 uppercase tracking-widest block mb-1">인입긍장</label>
                        <div className="flex-1 flex items-center justify-center">
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

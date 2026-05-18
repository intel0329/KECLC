import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { CornerBorders } from '../ui/PanelLoadUI';

export const SettingsModal = ({ show, onClose, settings, onSave }) => {
    const [localSettings, setLocalSettings] = useState(settings);

    useEffect(() => {
        setLocalSettings(settings);
    }, [settings]);

    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[1002]" onClick={onClose}>
            <div className="border border-gray-900 bg-black p-6 max-w-md w-full mx-4 relative" onClick={e => e.stopPropagation()}>
                <CornerBorders />
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-white font-bold uppercase tracking-widest">KEC Settings</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={20} /></button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-[11px] text-gray-400 uppercase tracking-widest mb-1">단락전류 (Is) [kA]</label>
                        <input
                            type="number"
                            value={localSettings.is}
                            onChange={e => setLocalSettings({ ...localSettings, is: Number(e.target.value) })}
                            className="w-full bg-gray-900 border border-gray-800 text-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-[11px] text-gray-400 uppercase tracking-widest mb-1">차단시간 (tn) [sec]</label>
                        <input
                            type="number"
                            value={localSettings.tn}
                            onChange={e => setLocalSettings({ ...localSettings, tn: Number(e.target.value) })}
                            className="w-full bg-gray-900 border border-gray-800 text-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-[11px] text-gray-400 uppercase tracking-widest mb-1">계수 (k)</label>
                        <input
                            type="number"
                            value={localSettings.k}
                            onChange={e => setLocalSettings({ ...localSettings, k: Number(e.target.value) })}
                            className="w-full bg-gray-900 border border-gray-800 text-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                        />
                    </div>
                </div>

                <div className="flex gap-2 mt-8">
                    <button onClick={onClose} className="flex-1 px-4 py-3 border border-gray-800 text-gray-400 hover:text-white hover:bg-gray-900 text-sm font-bold uppercase tracking-widest transition-all">
                        Cancel
                    </button>
                    <button onClick={() => onSave(localSettings)} className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm uppercase tracking-widest transition-all shadow-lg shadow-blue-900/20">
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
};

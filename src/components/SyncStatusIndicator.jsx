import React from 'react';
import { Monitor, Cloud, Check, RefreshCw, AlertCircle } from 'lucide-react';
import useDataStore from '../store/useDataStore';

const SyncStatusIndicator = () => {
    const syncStatus = useDataStore(state => state.syncStatus);

    if (!syncStatus) return null;

    const { local, remote } = syncStatus;

    // Show indicator if not idle, or briefly after being saved
    const showLocal = local !== 'idle';
    const showRemote = remote !== 'idle';

    if (!showLocal && !showRemote) return null;

    return (
        <div className="fixed bottom-6 left-6 z-[200] flex flex-col gap-2 pointer-events-none select-none">
            {/* Tier 1: Local PC Status */}
            {showLocal && (
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-md border shadow-lg transition-all duration-500 animate-in fade-in slide-in-from-left-4 ${
                    local === 'saved' ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                }`}>
                    <Monitor size={14} className={local === 'saving' ? 'animate-pulse' : ''} />
                    <span className="text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">
                        {local === 'saved' ? 'Local PC Saved' : 'Local Syncing'}
                    </span>
                    {local === 'saved' && <Check size={12} className="animate-in zoom-in duration-300" />}
                </div>
            )}

            {/* Tier 2: Remote Server Status */}
            {showRemote && (
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-md border shadow-lg transition-all duration-500 animate-in fade-in slide-in-from-left-4 ${
                    remote === 'saved' ? 'bg-blue-600/10 border-blue-600/30 text-blue-400' : 
                    remote === 'saving' ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' :
                    remote === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-gray-500/10 border-gray-500/30 text-gray-400'
                }`}>
                    {remote === 'saving' ? (
                        <RefreshCw size={14} className="animate-spin" />
                    ) : remote === 'error' ? (
                        <AlertCircle size={14} />
                    ) : (
                        <Cloud size={14} />
                    )}
                    <span className="text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">
                        {remote === 'saving' ? 'Server Syncing' : 
                         remote === 'saved' ? 'Server Match' : 
                         remote === 'error' ? 'Sync Error' : 'Remote Idle'}
                    </span>
                    {remote === 'saved' && <Check size={12} className="animate-in zoom-in duration-300" />}
                </div>
            )}
        </div>
    );
};

export default SyncStatusIndicator;

import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import projectService from '../../services/projectService';
import useDataStore from '../../store/useDataStore';

// Toast Notification Component
const Toast = ({ message, type, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, 1800);
        return () => clearTimeout(timer);
    }, [onClose]);

    return ReactDOM.createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999999, pointerEvents: 'none' }}>
            <div className={`px-4 md:px-8 py-2 md:py-4 rounded-xl shadow-2xl flex items-center gap-2 md:gap-3 pointer-events-auto ${type === 'success' ? 'bg-[#22c55e] text-white' : 'bg-red-500 text-white'}`}
                style={{ animation: 'fadeInScale 0.3s ease-out forwards' }}>
                {type === 'success' ? (
                    <svg className="w-4 h-4 md:w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                ) : (
                    <svg className="w-4 h-4 md:w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                )}
                <span className="font-medium font-['Michroma'] text-[10px] md:text-base">{message}</span>
            </div>
        </div>,
        document.body
    );
};

// Custom Confirmation Modal
const ConfirmationModal = ({ isOpen, message, onConfirm, onCancel }) => {
    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[99998] flex items-center justify-center p-4 bg-black/30 backdrop-blur-[2px] animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 transform transition-all scale-100 font-['Michroma'] border border-gray-100">
                <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-4">
                        <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Notice</h3>
                    <p className="text-sm text-gray-500 mb-6">{message}</p>
                    <div className="flex gap-3 w-full">
                        <button
                            onClick={onCancel}
                            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onConfirm}
                            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors shadow-sm"
                        >
                            Confirm
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

// Helper component for Time Input with "sec" suffix (For Headers)
const TimeInput = ({ value, onChange, placeholder = "sec" }) => {
    const [isFocused, setIsFocused] = useState(false);

    const handleChange = (e) => {
        // Allow only numbers and decimals
        const newValue = e.target.value.replace(/[^0-9.]/g, '');
        onChange(newValue);
    };

    const getDisplayValue = () => {
        if (isFocused) return value;
        return value ? `${value} sec` : '';
    };

    return (
        <input
            type="text"
            inputMode="decimal"
            className="w-full h-full p-2 text-center border-none focus:ring-2 focus:ring-[#22c55e] focus:outline-none bg-transparent text-gray-900 font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-gray-400 text-[7px] md:text-[11px]"
            value={getDisplayValue()}
            onChange={handleChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
                if (value) onChange(value)
                setIsFocused(false)
            }}
            placeholder={placeholder}
        />
    );
};

// Helper component for Simple Numeric Input (For Body Cells)
const SimpleNumberInput = ({ value, onChange }) => {
    const handleChange = (e) => {
        // Allow numbers, decimals, and empty string
        const newValue = e.target.value.replace(/[^0-9.]/g, '');
        onChange(newValue);
    };

    return (
        <input
            type="text"
            inputMode="decimal"
            className="w-full h-full p-2 text-center border-none focus:ring-2 focus:ring-[#22c55e] focus:outline-none bg-transparent text-gray-900 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-[7px] md:text-[11px]"
            value={value}
            onChange={handleChange}
        />
    );
};

const TCCMultiplierModal = ({ isOpen, onClose }) => {
    const [singlePhaseData, setSinglePhaseData] = useState({});
    const [threePhaseData, setThreePhaseData] = useState({});

    // Header states (5 columns for each table)
    const [singlePhaseHeaders, setSinglePhaseHeaders] = useState(['', '', '', '', '']);
    const [threePhaseHeaders, setThreePhaseHeaders] = useState(['', '', '', '', '']);

    // δ₂ table state: array of {at, delta2} rows
    const [delta2Rows, setDelta2Rows] = useState([{ at: '', delta2: '' }, { at: '', delta2: '' }, { at: '', delta2: '' }, { at: '', delta2: '' }]);

    // UI States
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, message: '', onConfirm: () => { } });

    // Default rows configuration
    const singlePhaseRows = [20, 30, 40, 50];
    const threePhaseRows = [20, 30, 40, 50, 75, 100, 125, 150, 175, 200, 225, 250, 300, 350, 400, 500, 630, 700, 800];

    useEffect(() => {
        if (isOpen) {
            loadInitialData();
        }
    }, [isOpen]);

    const loadInitialData = async () => {
        try {
            const defaultKey = 'tcc_multiplier_data';
            const projectId = projectService.getActiveProjectId() || 'GLOBAL';
            const projectKey = projectId !== 'GLOBAL' ? `${defaultKey}_${projectId}` : defaultKey;

            // 1. Try to load from server specifically for this project
            let remoteData = await projectService.getRemoteData(projectKey, projectId);
            
            // Fallback to global key ONLY IF project-specific doesn't exist (Migration)
            if (!remoteData && projectKey !== defaultKey) {
                remoteData = await projectService.getRemoteData(defaultKey, projectId);
                if (remoteData) {
                    console.log('Migrating global TCC settings to project-specific storage...');
                    await projectService.setRemoteData(projectId, projectKey, remoteData);
                }
            }

            if (remoteData) {
                setSinglePhaseData(remoteData.singlePhase || {});
                setThreePhaseData(remoteData.threePhase || {});
                if (remoteData.singlePhaseHeaders) setSinglePhaseHeaders(remoteData.singlePhaseHeaders);
                if (remoteData.threePhaseHeaders) setThreePhaseHeaders(remoteData.threePhaseHeaders);
                if (remoteData.delta2Rows && Array.isArray(remoteData.delta2Rows)) setDelta2Rows(remoteData.delta2Rows);
                else if (remoteData.instantaneousTripMultiplier) setDelta2Rows([{ at: '', delta2: remoteData.instantaneousTripMultiplier }]);

                // Sync to localStorage as a backup with project-specific key
                localStorage.setItem(`kelc_tcc_multiplier_${projectId}`, JSON.stringify(remoteData));
                // Forward compatibility: also update general key for legacy components if needed
                localStorage.setItem('tccMultiplierData', JSON.stringify(remoteData));
            } else {
                // 2. Migration: If no project-specific server data, check localStorage
                const localData = localStorage.getItem('tccMultiplierData');
                if (localData) {
                    const parsed = JSON.parse(localData);
                    setSinglePhaseData(parsed.singlePhase || {});
                    setThreePhaseData(parsed.threePhase || {});
                    if (parsed.singlePhaseHeaders) setSinglePhaseHeaders(parsed.singlePhaseHeaders);
                    if (parsed.threePhaseHeaders) setThreePhaseHeaders(parsed.threePhaseHeaders);
                    if (parsed.delta2Rows && Array.isArray(parsed.delta2Rows)) setDelta2Rows(parsed.delta2Rows);
                    else if (parsed.instantaneousTripMultiplier) setDelta2Rows([{ at: '', delta2: parsed.instantaneousTripMultiplier }]);

                    // Force save to server for THIS project so it's backed up for future project-specific use
                    await projectService.setRemoteData(projectId, projectKey, parsed);
                    localStorage.setItem(`kelc_tcc_multiplier_${projectId}`, JSON.stringify(parsed));
                }
            }
        } catch (e) {
            console.error("Failed to load data from server", e);
            // Fallback to local if server fails
            const localData = localStorage.getItem('tccMultiplierData');
            if (localData) {
                try {
                    const parsed = JSON.parse(localData);
                    setSinglePhaseData(parsed.singlePhase || {});
                    setThreePhaseData(parsed.threePhase || {});
                    if (parsed.singlePhaseHeaders) setSinglePhaseHeaders(parsed.singlePhaseHeaders);
                    if (parsed.threePhaseHeaders) setThreePhaseHeaders(parsed.threePhaseHeaders);
                    if (parsed.delta2Rows && Array.isArray(parsed.delta2Rows)) setDelta2Rows(parsed.delta2Rows);
                    else if (parsed.instantaneousTripMultiplier) setDelta2Rows([{ at: '', delta2: parsed.instantaneousTripMultiplier }]);
                } catch (pe) {
                    console.error("Failed to parse local fallback data", pe);
                }
            }
        }
    };

    const handleInputChange = (type, row, colIndex, value) => {
        const setData = type === '1P' ? setSinglePhaseData : setThreePhaseData;

        setData(prev => ({
            ...prev,
            [row]: {
                ...(prev[row] || {}),
                [colIndex]: value
            }
        }));
    };

    const handleHeaderChange = (type, colIndex, value) => {
        if (type === '1P') {
            const newHeaders = [...singlePhaseHeaders];
            newHeaders[colIndex] = value;
            setSinglePhaseHeaders(newHeaders);
        } else {
            const newHeaders = [...threePhaseHeaders];
            newHeaders[colIndex] = value;
            setThreePhaseHeaders(newHeaders);
        }
    };

    const showToast = (message, type = 'success') => {
        setToast({ show: true, message, type });
    };

    const handleSave = async () => {
        const dataToSave = {
            singlePhase: singlePhaseData,
            threePhase: threePhaseData,
            singlePhaseHeaders,
            threePhaseHeaders,
            delta2Rows
        };

        const defaultKey = 'tcc_multiplier_data';
        const projectId = projectService.getActiveProjectId() || 'GLOBAL';
        const projectKey = projectId !== 'GLOBAL' ? `${defaultKey}_${projectId}` : defaultKey;

        try {
            await projectService.setRemoteData(projectId, projectKey, dataToSave);
            // Always update localStorage as a local cache with project-specific key
            localStorage.setItem(`kelc_tcc_multiplier_${projectId}`, JSON.stringify(dataToSave));
            localStorage.setItem('tccMultiplierData', JSON.stringify(dataToSave));
            
            showToast('데이터가 서버에 저장되었습니다!');
            // [ZERO SYNC] 타 탭 동기화
            useDataStore.getState().updateSettings('tcc', dataToSave);
            // [REMOVED] Legacy signal
            // window.dispatchEvent(new CustomEvent('kelc_data_update_signal'));
        } catch (e) {
            console.error("Failed to save to server", e);
            // If server fails, save to local storage at least
            localStorage.setItem('tccMultiplierData', JSON.stringify(dataToSave));
            showToast('서버 저장 실패. 로컬에 임시 저장.', 'error');
            // [REMOVED] Legacy signal
            // window.dispatchEvent(new CustomEvent('kelc_data_update_signal'));
        }
    };

    const handleReset = () => {
        setConfirmModal({
            isOpen: true,
            message: '데이터가 초기화됩니다. 진행하시겠습니까?',
            onConfirm: async () => {
                setSinglePhaseData({});
                setThreePhaseData({});
                setSinglePhaseHeaders(['', '', '', '', '']);
                setThreePhaseHeaders(['', '', '', '', '']);
                setDelta2Rows([{ at: '', delta2: '' }, { at: '', delta2: '' }, { at: '', delta2: '' }, { at: '', delta2: '' }]);

                // Clear both
                localStorage.removeItem('tccMultiplierData');
                try {
                    const defaultKey = 'tcc_multiplier_data';
                    const projectId = projectService.getActiveProjectId() || 'GLOBAL';
                    const projectKey = projectId !== 'GLOBAL' ? `${defaultKey}_${projectId}` : defaultKey;

                    await projectService.removeRemoteData(projectKey, projectId);
                    if (projectKey !== defaultKey) {
                        await projectService.removeRemoteData(defaultKey, projectId);
                    }
                } catch (e) {
                    console.error("Failed to remove remote data", e);
                }

                setConfirmModal({ ...confirmModal, isOpen: false });
                showToast('데이터가 초기화되었습니다.', 'success');
                // [ZERO SYNC] 타 탭 동기화
                useDataStore.getState().updateSettings('tcc', null);
                // [REMOVED] Legacy signal
                // window.dispatchEvent(new CustomEvent('kelc_data_update_signal'));
            }
        });
    };

    const handleExtract = () => {
        const dataToSave = {
            singlePhase: singlePhaseData,
            threePhase: threePhaseData,
            singlePhaseHeaders,
            threePhaseHeaders,
            delta2Rows
        };
        const blob = new Blob([JSON.stringify(dataToSave, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'tcc_multiplier_config.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleLoad = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const parsed = JSON.parse(event.target.result);
                if (parsed.singlePhase && parsed.threePhase) {
                    setSinglePhaseData(parsed.singlePhase);
                    setThreePhaseData(parsed.threePhase);
                    if (parsed.singlePhaseHeaders) setSinglePhaseHeaders(parsed.singlePhaseHeaders);
                    if (parsed.threePhaseHeaders) setThreePhaseHeaders(parsed.threePhaseHeaders);
                    if (parsed.delta2Rows && Array.isArray(parsed.delta2Rows)) setDelta2Rows(parsed.delta2Rows);

                    showToast('데이터를 불러왔습니다.', 'success');
                    // [REMOVED] Legacy signal
                    // window.dispatchEvent(new CustomEvent('kelc_data_update_signal'));
                } else {
                    showToast('잘못된 파일 형식입니다.', 'error');
                }
            } catch (err) {
                console.error(err);
                showToast('파일을 불러오지 못했습니다.', 'error');
            }
        };
        reader.readAsText(file);
        // Reset file input
        e.target.value = '';
    };

    if (!isOpen) return null;

    const renderTable = (title, rows, data, headers, type, bgHeaderColor) => (
        <div className="mb-6">
            <h3 className="text-[12px] md:text-[13px] font-medium text-[#374151] mb-2 font-['Michroma']">{title}</h3>
            <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
                <table className="w-full border-collapse text-[7px] md:text-[11px] font-['Michroma'] min-w-[280px] md:min-w-0">
                    <thead>
                        <tr>
                            <th className="border-b border-r border-gray-200 p-1 md:p-2 text-center w-7 md:w-16 bg-gray-100 font-medium text-gray-600">AT</th>
                            {headers.map((headerValue, i) => (
                                <th key={i} className={`border-b border-r border-gray-200 p-0 text-center w-10 md:w-20 font-medium text-gray-700 ${bgHeaderColor}`}>
                                    <TimeInput
                                        value={headerValue}
                                        onChange={(val) => handleHeaderChange(type, i, val)}
                                    />
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => (
                            <tr key={row} className="hover:bg-gray-50">
                                {/* Explicitly set text color to black/gray-900 for AT column */}
                                <td className={`border-b border-r border-gray-200 p-0.5 md:p-1 text-center font-medium text-gray-900 ${bgHeaderColor}`}>{row}</td>
                                {[...Array(5)].map((_, i) => (
                                    <td key={i} className="border-b border-r border-gray-200 p-0">
                                        <SimpleNumberInput
                                            value={data[row]?.[i] || ''}
                                            onChange={(val) => handleInputChange(type, row, i, val)}
                                        />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity duration-300">
            {toast.show && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast({ ...toast, show: false })}
                />
            )}

            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                message={confirmModal.message}
                onConfirm={confirmModal.onConfirm}
                onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })}
            />

            <div className="bg-white rounded-xl shadow-2xl w-[98%] md:w-[95%] max-w-4xl h-[85vh] md:h-auto max-h-[85vh] md:max-h-[90vh] overflow-hidden flex flex-col font-['Michroma'] animate-scale-in">
                {/* Header */}
                <div className="flex items-center justify-between p-2.5 md:p-4 border-b border-gray-100 bg-white sticky top-0 z-10">
                    <div className="flex items-center gap-1.5 md:gap-3">
                        <div className="w-1 h-4 md:h-6 bg-[#22c55e] rounded-full"></div>
                        <h2 className="text-[12px] md:text-lg font-medium text-gray-800">규약동작배율 설정</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 md:p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <svg className="w-4 h-4 md:w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-2.5 md:p-6 bg-[#f8f9fa] custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-8">
                        {/* Single Phase Table */}
                        <div className="flex flex-col">
                            {renderTable('1P CB TIME MULTIPLIER (δ)', singlePhaseRows, singlePhaseData, singlePhaseHeaders, '1P', 'bg-orange-50')}

                            {/* δ₂ Table - Below 1P Table */}
                            <div className="mb-6">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-[13px] md:text-[14px] font-medium text-[#374151] font-['Michroma']">순시특성 배율 (δ₂)</h3>
                                    <button
                                        onClick={() => setDelta2Rows(prev => [...prev, { at: '', delta2: '' }])}
                                        className="text-[10px] md:text-[11px] px-2 py-1 bg-[#22c55e]/10 text-[#22c55e] rounded hover:bg-[#22c55e]/20 transition-colors font-['Michroma']"
                                    >
                                        + Row
                                    </button>
                                </div>
                                <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
                                    <table className="w-full border-collapse text-[7px] md:text-[11px] font-['Michroma'] min-w-[280px] md:min-w-0">
                                        <thead>
                                            <tr>
                                                <th className="border-b border-r border-gray-200 p-1 md:p-2 text-center w-7 md:w-16 bg-gray-100 font-medium text-gray-600">AT</th>
                                                <th className="border-b border-r border-gray-200 p-1 md:p-2 text-center w-10 md:w-20 bg-purple-50 font-medium text-gray-700">δ₂</th>
                                                <th className="border-b border-r border-gray-200 p-1 md:p-2 text-center w-10 md:w-20 bg-gray-100"></th>
                                                <th className="border-b border-r border-gray-200 p-1 md:p-2 text-center w-10 md:w-20 bg-gray-100"></th>
                                                <th className="border-b border-r border-gray-200 p-1 md:p-2 text-center w-10 md:w-20 bg-gray-100"></th>
                                                <th className="border-b border-gray-200 p-1 md:p-2 text-center w-10 md:w-20 bg-gray-100"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {delta2Rows.map((row, idx) => (
                                                <tr key={idx} className="hover:bg-gray-50">
                                                    <td className="border-b border-r border-gray-200 p-0 bg-purple-50/30">
                                                        <input
                                                            type="text"
                                                            inputMode="decimal"
                                                            className="w-full h-full p-2 text-center border-none focus:ring-2 focus:ring-[#22c55e] focus:outline-none bg-transparent text-gray-900 font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-[7px] md:text-[11px]"
                                                            value={row.at}
                                                            onChange={(e) => {
                                                                const val = e.target.value.replace(/[^0-9.]/g, '');
                                                                setDelta2Rows(prev => prev.map((r, i) => i === idx ? { ...r, at: val } : r));
                                                            }}
                                                            placeholder=""
                                                        />
                                                    </td>
                                                    <td className="border-b border-r border-gray-200 p-0">
                                                        <input
                                                            type="text"
                                                            inputMode="decimal"
                                                            className="w-full h-full p-2 text-center border-none focus:ring-2 focus:ring-[#22c55e] focus:outline-none bg-transparent text-gray-900 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-[7px] md:text-[11px]"
                                                            value={row.delta2}
                                                            onChange={(e) => {
                                                                const val = e.target.value.replace(/[^0-9.]/g, '');
                                                                setDelta2Rows(prev => prev.map((r, i) => i === idx ? { ...r, delta2: val } : r));
                                                            }}
                                                            placeholder=""
                                                        />
                                                    </td>
                                                    <td className="border-b border-r border-gray-200 p-2 bg-gray-100/60"></td>
                                                    <td className="border-b border-r border-gray-200 p-2 bg-gray-100/60"></td>
                                                    <td className="border-b border-r border-gray-200 p-2 bg-gray-100/60"></td>
                                                    <td className="border-b border-gray-200 p-0 bg-gray-100/60 text-center">
                                                        {delta2Rows.length > 1 && (
                                                            <button
                                                                onClick={() => setDelta2Rows(prev => prev.filter((_, i) => i !== idx))}
                                                                className="text-gray-400 hover:text-red-500 transition-colors p-1"
                                                                title="행 삭제"
                                                            >
                                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                                </svg>
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Three Phase Table */}
                        <div className="flex flex-col">
                            {renderTable('3P CB TIME MULTIPLIER (δ)', threePhaseRows, threePhaseData, threePhaseHeaders, '3P', 'bg-blue-50')}
                        </div>
                    </div>
                </div>

                {/* Footer Controls */}
                <div className="p-2.5 md:p-4 border-t border-gray-100 bg-white grid grid-cols-2 md:flex md:flex-wrap justify-end gap-2 md:gap-3">
                    <input
                        type="file"
                        id="load-config"
                        className="hidden"
                        accept=".json"
                        onChange={handleLoad}
                    />

                    <label
                        htmlFor="load-config"
                        className="h-[34px] md:h-[40px] px-2 md:px-4 text-[10px] md:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors flex items-center justify-center gap-1 md:gap-2"
                    >
                        <svg className="w-3 md:w-4 h-3 md:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        Load
                    </label>

                    <button
                        onClick={handleExtract}
                        className="h-[34px] md:h-[40px] px-2 md:px-4 text-[10px] md:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-1 md:gap-2"
                    >
                        Extract
                    </button>

                    <button
                        onClick={handleReset}
                        className="h-[34px] md:h-[40px] px-2 md:px-4 text-[10px] md:text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors flex items-center justify-center"
                    >
                        Reset
                    </button>

                    <button
                        onClick={handleSave}
                        className="h-[34px] md:h-[40px] px-2 md:px-6 text-[10px] md:text-sm font-medium text-white bg-[#22c55e] hover:bg-[#16a34a] rounded-lg shadow-sm transition-colors flex items-center justify-center gap-1 md:gap-2"
                    >
                        <svg className="w-3 md:w-4 h-3 md:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Save
                    </button>
                </div>
            </div>

            {/* Styles for animations */}
            <style>{`
                @keyframes fade-in-down {
                    0% {
                        opacity: 0;
                        transform: translateY(-20px);
                    }
                    100% {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                @keyframes scale-in {
                    0% {
                        opacity: 0;
                        transform: scale(0.95);
                    }
                    100% {
                        opacity: 1;
                        transform: scale(1);
                    }
                }
                .animate-fade-in-down {
                    animation: fade-in-down 0.3s ease-out forwards;
                }
                .animate-scale-in {
                    animation: scale-in 0.2s ease-out forwards;
                }
                @keyframes fadeInScale {
                    0% {
                        opacity: 0;
                        transform: scale(0.85);
                    }
                    100% {
                        opacity: 1;
                        transform: scale(1);
                    }
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background-color: #cbd5e1;
                    border-radius: 3px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background-color: #94a3b8;
                }
            `}</style>
        </div>
    );
};

export default TCCMultiplierModal;

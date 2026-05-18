import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

export const CornerBorders = ({ colorClass = "" }) => (
    <>
        <div className={`corner-tl ${colorClass} `} />
        <div className={`corner-tr ${colorClass} `} />
        <div className={`corner-bl ${colorClass} `} />
        <div className={`corner-br ${colorClass} `} />
    </>
);

// 2-line header with Korean description and symbol
export const TableHeader2 = ({ label, subLabel, children, className = "", rowSpan, colSpan }) => (
    <th 
        rowSpan={rowSpan} 
        colSpan={colSpan} 
        className={`border border-gray-900 bg-black px-1 py-2 text-center whitespace-nowrap ${className} `}
    >
        <div className="flex flex-col items-center justify-center leading-tight">
            <span className="text-[11px] text-gray-500">{label}</span>
            <span className="text-[13px] font-bold text-gray-300">{children || subLabel}</span>
        </div>
    </th>
);

export const TableHeader = ({ label, children, className = "", rowSpan, colSpan }) => (
    <th 
        rowSpan={rowSpan} 
        colSpan={colSpan} 
        className={`border border-gray-900 bg-black px-1 py-2 text-[13px] font-bold text-gray-300 text-center whitespace-nowrap ${className} `}
    >
        {children || label}
    </th>
);

export const InputCell = ({ value, onChange, type = "text", className = "", heightClass = "h-[48px]", readOnly = false, onFocus }) => (
    <div className={`flex items-center justify-center ${heightClass} w-full`}>
        <input
            type={type}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            onFocus={onFocus}
            readOnly={readOnly}
            className={`w-full bg-transparent text-center outline-none focus:bg-gray-900 transition-colors ${readOnly ? 'cursor-default' : ''} ${className} `}
            style={type === "text" ? {} : { MozAppearance: 'textfield' }}
        />
    </div>
);

export const SelectCell = ({ value, onChange, options, className = "", placeholder = "", heightClass = "h-[48px]", disabledOptions = [], disabled = false, hideArrow = false }) => {
    return (
        <div className={`flex items-center justify-center ${heightClass} w-full`}>
            <select
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                className={`w-full bg-transparent text-center outline-none focus:bg-blue-500/10 transition-colors ${disabled ? 'cursor-default opacity-50' : 'cursor-pointer'} ${className} `}
                style={hideArrow ? { appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none' } : {}}
            >
                <option value="" className="bg-gray-950 text-gray-600">{placeholder}</option>
                {options.map(opt => (
                    <option
                        key={opt}
                        value={opt}
                        disabled={disabledOptions.includes(opt)}
                        className={`bg-gray-950 ${disabledOptions.includes(opt) ? 'text-gray-700' : 'text-white'} `}
                    >
                        {opt}
                    </option>
                ))}
            </select>
        </div>
    );
};

export const SearchablePanelCell = ({ value, onChange, panels, className = "", placeholder = "", heightClass = "h-[48px]", activeDropdownId, onOpen, dropdownPos, loadId, excludeId, globalUsedPanelIds, currentId }) => {
    const [searchText, setSearchText] = useState(value || '');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const containerRef = useRef(null);
    const isOpen = activeDropdownId === `panel-${loadId}`;

    useEffect(() => {
        setSearchText(value || '');
    }, [value]);

    const filteredPanels = useMemo(() => {
        if (!panels) return [];
        const search = searchText.toLowerCase();
        return panels.filter(p => {
            const name = p.name.toLowerCase();

            // 1. 자기 자신 제외 (BANK self-reference 제외)
            if (p.id === excludeId) return false;

            const excludedPrefixes = ['transformer-main-', 'panel-feeder-', 'low-voltage-receiving-'];
            const isExcluded = excludedPrefixes.some(prefix => p.id.startsWith(prefix));
            if (isExcluded) return false;

            // 2. 이미 다른 곳에(혹은 현재 계산서에) 사용된 패널 제외 (현재 선택된 값은 제외하지 않음)
            if (globalUsedPanelIds && globalUsedPanelIds.has(p.id) && p.id !== currentId) return false;
            
            return name.includes(search);
        });
    }, [panels, searchText, excludeId, globalUsedPanelIds, currentId]);

    const handleSelect = (panel) => {
        onChange(panel.name, panel);
        onOpen(null);
        setSearchText(panel.name);
    };

    const handleFocus = () => {
        onOpen(containerRef.current);
        setSelectedIndex(0);
    };

    return (
        <div className={`relative flex items-center justify-center ${heightClass} w-full SearchablePanelCell-container`} ref={containerRef} data-row-id={loadId}>
            <input
                type="text"
                value={searchText}
                onChange={(e) => {
                    const val = e.target.value;
                    setSearchText(val);
                    onChange(val, null);
                    if (!isOpen) onOpen(containerRef.current);
                    setSelectedIndex(0);
                }}
                onFocus={handleFocus}
                onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        if (filteredPanels.length > 0)
                            setSelectedIndex(prev => (prev + 1) % filteredPanels.length);
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        if (filteredPanels.length > 0)
                            setSelectedIndex(prev => (prev - 1 + filteredPanels.length) % filteredPanels.length);
                    } else if (e.key === 'Enter') {
                        e.preventDefault();
                        if (filteredPanels.length > 0 && isOpen) {
                            handleSelect(filteredPanels[selectedIndex]);
                        } else {
                            onOpen(null);
                        }
                    } else if (e.key === 'Escape') {
                        onOpen(null);
                    }
                }}
                className={`w-full bg-transparent text-center outline-none focus:bg-gray-900 transition-colors ${className}`}
                placeholder={placeholder}
            />
            {isOpen && filteredPanels.length > 0 && createPortal(
                <div
                    className="absolute z-[1001] bg-black border border-gray-800 shadow-2xl max-h-48 overflow-y-auto custom-scrollbar anim-fade-in dropdown-viewport"
                    style={{
                        top: dropdownPos.top,
                        left: dropdownPos.left,
                        width: dropdownPos.width
                    }}
                >
                    {filteredPanels.map((panel, index) => (
                        <div
                            key={panel.id}
                            onMouseDown={() => handleSelect(panel)}
                            className={`px-4 py-2 text-sm cursor-pointer transition-colors border-l-2 text-left ${index === selectedIndex ? 'border-yellow-500 bg-white/5 text-white' : 'border-transparent text-gray-300 hover:text-white hover:bg-white/5 hover:border-yellow-500'}`}
                        >
                            {panel.name}
                        </div>
                    ))}
                </div>,
                document.body
            )}
        </div>
    );
};

export const HeaderViewDropdown = ({ value, onChange, options, className = "" }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (isOpen && containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const selectedOption = options.find(opt => opt.value === value);

    return (
        <div className={`relative inline-block ${className}`} ref={containerRef}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 cursor-pointer text-yellow-400 hover:text-yellow-300 transition-colors"
                style={{ height: '100%' }}
            >
                <span className="font-bold uppercase tracking-[0.2em]">{selectedOption?.label}</span>
                <ChevronDown size={14} className={`transition-transform duration-200 text-yellow-600 ${isOpen ? 'rotate-180' : ''}`} />
            </div>
            {isOpen && (
                <div className="absolute top-[calc(100%+8px)] left-[-16px] z-[1001] bg-black border border-gray-800 shadow-2xl min-w-[300px] py-1 anim-fade-in shadow-[0_10px_40px_rgba(0,0,0,0.8)]">
                    {options.map(opt => (
                        <div
                            key={opt.value}
                            onMouseDown={(e) => {
                                e.preventDefault(); // Prevent focus loss
                                onChange(opt.value);
                                setIsOpen(false);
                            }}
                            className={`px-4 py-2 text-[11px] cursor-pointer transition-colors border-l-2 font-bold uppercase ${
                                opt.value === value 
                                ? 'border-yellow-500 bg-white/10 text-white' 
                                : 'border-transparent text-yellow-400/60 hover:text-yellow-400 hover:bg-white/5 hover:border-yellow-500'
                            }`}
                        >
                            {opt.label}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

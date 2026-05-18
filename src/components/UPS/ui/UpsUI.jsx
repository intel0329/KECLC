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

export const TableHeader2 = ({ label, subLabel, children, className = "", rowSpan, colSpan }) => (
    <th 
        rowSpan={rowSpan} 
        colSpan={colSpan} 
        className={`border border-gray-900 bg-black px-1 py-2 text-center whitespace-nowrap ${className} `}
    >
        <div className="flex flex-col items-center justify-center leading-tight">
            <span className="text-[11px] text-gray-500">{label}</span>
            <span className="text-[13px] text-[#d1d5db] font-normal">{children || subLabel}</span>
        </div>
    </th>
);

export const TableHeader = ({ label, children, className = "", rowSpan, colSpan }) => (
    <th 
        rowSpan={rowSpan} 
        colSpan={colSpan} 
        className={`border border-gray-900 bg-black px-1 py-2 text-[13px] text-[#d1d5db] font-normal text-center whitespace-nowrap ${className} `}
    >
        {children || label}
    </th>
);

export const InputCell = ({ value, onChange, type = "text", className = "", heightClass = "h-[48px]", readOnly = false, onFocus }) => (
    <div className={`flex items-center justify-center ${heightClass} w-full`}>
        <input
            type={type}
            value={value || ''}
            title={value || ''}
            onChange={(e) => onChange && onChange(e.target.value)}
            onFocus={onFocus}
            readOnly={readOnly}
            className={`w-full bg-transparent text-center outline-none focus:bg-gray-900 transition-colors overflow-hidden text-ellipsis whitespace-nowrap ${readOnly ? 'cursor-default' : ''} ${className} `}
            style={type === "text" ? {} : { MozAppearance: 'textfield' }}
        />
    </div>
);

export const SelectCell = ({ value, onChange, options, className = "", placeholder = "", heightClass = "h-[48px]", disabled = false }) => (
    <div className={`flex items-center justify-center ${heightClass} w-full`}>
        <select
            value={value || ''}
            onChange={(e) => onChange && onChange(e.target.value)}
            disabled={disabled}
            className={`w-full bg-transparent text-center outline-none focus:bg-blue-500/10 transition-colors ${disabled ? 'cursor-default opacity-50' : 'cursor-pointer'} ${className} `}
        >
            <option value="" className="bg-gray-950 text-gray-600">{placeholder}</option>
            {options.map(opt => (
                <option key={opt} value={opt} className="bg-gray-950 text-white">
                    {opt}
                </option>
            ))}
        </select>
    </div>
);

// Advanced SearchablePanelCell with Dropdown and Portal
export const SearchablePanelCell = ({ value, onChange, panels, className = "", placeholder = "", heightClass = "h-[48px]", activeDropdownId, onOpen, dropdownPos, loadId, currentId }) => {
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
            const excludedPrefixes = ['transformer-main-', 'panel-feeder-', 'low-voltage-receiving-'];
            if (excludedPrefixes.some(prefix => p.id.startsWith(prefix))) return false;
            return name.includes(search);
        });
    }, [panels, searchText]);

    const handleSelect = (panel) => {
        onChange(panel.name, panel.id); // Return name and ID
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
                className={`w-full bg-transparent text-center outline-none focus:bg-gray-900 transition-colors overflow-hidden text-ellipsis whitespace-nowrap ${className}`}
                placeholder={placeholder}
                title={searchText}
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

export const HeaderViewDropdown = ({ value, options, onChange, className = "" }) => (
    <div className={`relative inline-block ${className}`}>
        <div className="flex items-center gap-2 text-yellow-500 font-bold uppercase tracking-[0.2em] text-[11px]">
            <span>{options.find(opt => opt.value === value)?.label || 'VIEW'}</span>
            <ChevronDown size={14} className="text-yellow-600" />
        </div>
    </div>
);

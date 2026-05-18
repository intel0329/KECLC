import React from 'react';

export const CornerBorders = ({ colorClass = "" }) => (
    <>
        <div className={`corner-tl ${colorClass}`} />
        <div className={`corner-tr ${colorClass}`} />
        <div className={`corner-bl ${colorClass}`} />
        <div className={`corner-br ${colorClass}`} />
    </>
);

export const TableHeader = ({ label, children, className = "" }) => (
    <th className={`border border-gray-900 bg-black px-1 py-1 text-[11px] font-bold text-gray-300 text-center ${className}`}>
        {children || label}
    </th>
);

export const InputCell = ({ value, onChange, type = "text", className = "", heightClass = "h-[48px]" }) => (
    <div
        className={`flex items-center justify-center ${heightClass} w-full pointer-events-none`}
        onMouseDown={(e) => {
            // Only set flag if clicking directly on the input element
            if (e.target.tagName === 'INPUT') {
                document.body.dataset.dragFromInput = 'true';
            }
            e.stopPropagation();
        }}
        onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); }}
        draggable={false}
    >
        <input
            type={type}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={`w-full bg-transparent text-center outline-none focus:bg-gray-900 transition-colors select-text cursor-text pointer-events-auto ${className}`}
        />
    </div>
);

export const SelectCell = ({ value, onChange, options, className = "", placeholder = "", heightClass = "h-[48px]", disabledOptions = [] }) => {
    return (
        <div
            className={`flex items-center justify-center ${heightClass} w-full`}
            onMouseDown={(e) => e.stopPropagation()}
            onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); }}
            draggable={false}
        >
            <select
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                className={`w-full bg-transparent text-center outline-none focus:bg-blue-500/10 transition-colors cursor-pointer appearance-none ${className}`}
            >
                <option value="" className="bg-gray-950 text-gray-600">{placeholder}</option>
                {options.map(opt => {
                    const isDisabled = disabledOptions ? disabledOptions.includes(opt) : false;
                    return (
                        <option
                            key={opt}
                            value={opt}
                            className={`bg-gray-950 ${isDisabled ? 'text-gray-600 font-normal italic' : 'text-white'}`}
                            disabled={isDisabled}
                        >
                            {opt}
                        </option>
                    );
                })}
            </select>
        </div>
    );
};

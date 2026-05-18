import React from 'react';

/**
 * 테이블 모서리 보더 컴포넌트
 */
export const CornerBorders = ({ colorClass = "" }) => (
    <>
        <div className={`corner-tl ${colorClass} `} />
        <div className={`corner-tr ${colorClass} `} />
        <div className={`corner-bl ${colorClass} `} />
        <div className={`corner-br ${colorClass} `} />
    </>
);

/**
 * 2줄 헤더 (한글 설명 + 심볼)
 */
export const TableHeader2 = ({ label, subLabel, children, className = "" }) => (
    <th className={`border border-gray-900 bg-black px-1 py-2 text-center whitespace-nowrap ${className} `}>
        <div className="flex flex-col items-center justify-center leading-tight">
            <span className="text-[11px] text-gray-500">{label}</span>
            <span className="text-[13px] text-[#d1d5db]">{children || subLabel}</span>
        </div>
    </th>
);

/**
 * 일반 테이블 헤더
 */
export const TableHeader = ({ label, children, className = "" }) => (
    <th className={`border border-gray-900 bg-black px-1 py-2 text-[13px] text-[#d1d5db] text-center whitespace-nowrap ${className} `}>
        {children || label}
    </th>
);

/**
 * 입력 셀 컴포넌트
 */
export const InputCell = ({ value, onChange, type = "text", className = "", heightClass = "h-[48px]", readOnly = false, onFocus, noBackground = false }) => (
    <div className={`flex items-center justify-center ${heightClass} w-full ${(readOnly && !noBackground) ? 'bg-gray-900/50' : ''} `}>
        <input
            type={type}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            onFocus={onFocus}
            readOnly={readOnly}
            className={`w-full bg-transparent text-center outline-none focus:bg-gray-900 transition-colors ${readOnly ? 'cursor-default text-gray-500' : ''} ${className} `}
            style={type === "text" ? {} : { MozAppearance: 'textfield' }}
        />
    </div>
);

/**
 * 선택(Select) 셀 컴포넌트
 */
export const SelectCell = ({ value, onChange, options, className = "", placeholder = "", heightClass = "h-[48px]", disabledOptions = [] }) => {
    return (
        <div className={`flex items-center justify-center ${heightClass} w-full`}>
            <select
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                className={`w-full bg-transparent text-center outline-none focus:bg-blue-500/10 transition-colors cursor-pointer appearance-none ${className} `}
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

import React, { useState, useEffect, useRef } from 'react';

export const InputCell = ({ id, value, onChange, onFocus, onBlur, onKeyDown, type = "text", className = "", heightClass = "h-[48px]", readOnly = false, bgClass = "" }) => (
    <div className={`flex items-center justify-center ${heightClass} w-full ${bgClass ? bgClass : (readOnly ? 'bg-gray-900/50' : '')}`}>
        <input
            id={id}
            type={type}
            value={value || ''}
            onChange={(e) => onChange && onChange(e.target.value)}
            onFocus={onFocus}
            onBlur={onBlur}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    e.currentTarget.blur();
                }
                if (onKeyDown) onKeyDown(e);
            }}
            readOnly={readOnly}
            className={`w-full bg-transparent text-center outline-none focus:bg-gray-900/80 transition-colors px-2 ${readOnly ? 'cursor-default text-gray-500' : ''} ${className}`}
            style={type === "text" ? {} : { MozAppearance: 'textfield' }}
        />
    </div>
);

export const DebouncedInputCell = ({ value, onChange, delay = 1000, ...props }) => {
    const [localValue, setLocalValue] = useState(value || '');
    const timerRef = useRef(null);

    useEffect(() => {
        setLocalValue(value || '');
    }, [value]);

    const handleChange = (val) => {
        setLocalValue(val);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            onChange && onChange(val);
        }, delay);
    };

    const handleBlur = (e) => {
        if (timerRef.current) clearTimeout(timerRef.current);
        onChange && onChange(localValue);
        props.onBlur && props.onBlur(e);
    };

    return <InputCell {...props} value={localValue} onChange={handleChange} onBlur={handleBlur} />;
};

export const SelectCell = ({ value, onChange, options, disabledOptions = [], className = "", placeholder = "", heightClass = "h-[48px]", readOnly = false }) => (
    <div className={`flex items-center justify-center ${heightClass} w-full ${readOnly ? 'bg-gray-900/50' : ''}`}>
        <select
            value={value || ''}
            onChange={(e) => onChange && onChange(e.target.value)}
            disabled={readOnly}
            className={`w-full bg-transparent text-center outline-none focus:bg-blue-500/10 transition-colors cursor-pointer px-2 ${readOnly ? 'cursor-default text-gray-500' : ''} ${className}`}
            style={{ textAlign: 'center', textAlignLast: 'center' }}
        >
            <option value="" className="bg-gray-950 text-gray-600 font-bold text-center" disabled style={{ textAlign: 'center' }}>{placeholder}</option>
            {options.map((opt, i) => {
                const val = typeof opt === 'object' ? opt.value : opt;
                const label = typeof opt === 'object' ? opt.label : opt;
                const isDisabled = disabledOptions ? disabledOptions.includes(val) : false;
                return (
                    <option key={i} value={val} disabled={isDisabled} className={isDisabled ? "bg-gray-900 text-gray-500 font-normal italic text-center" : "bg-gray-950 text-white font-normal text-center"} style={{ textAlign: 'center' }}>
                        {label}
                    </option>
                );
            })}
        </select>
    </div>
);

export const SearchableSelectCell = ({ id, value, onChange, onInteract, onKeyDown, onBlur, placeholder = "", className = "", readOnly = false, debounceDelay = 0 }) => {
    const [localValue, setLocalValue] = useState(value || '');
    const interactTimerRef = useRef(null);

    // Sync local value when external value changes
    useEffect(() => {
        setLocalValue(value || '');
    }, [value]);

    const handleInteract = (e, val) => {
        if (readOnly) return;
        
        // Capture event data immediately before timeout
        const currentTarget = e.currentTarget;
        const eventType = e.type;

        if (debounceDelay > 0 && eventType === 'change') {
            if (interactTimerRef.current) clearTimeout(interactTimerRef.current);
            interactTimerRef.current = setTimeout(() => {
                // Mock a synthetic-like object for handleDropdownInteract
                onInteract && onInteract({ currentTarget, type: eventType }, val);
            }, debounceDelay);
        } else {
            // Immediate interaction for focus/click
            if (interactTimerRef.current) clearTimeout(interactTimerRef.current);
            onInteract && onInteract(e, val);
        }
    };

    return (
        <div className="flex items-center justify-center h-[48px] w-full">
            <input
                id={id}
                type="text"
                readOnly={readOnly}
                value={localValue}
                onChange={(e) => {
                    if (readOnly) return;
                    const newVal = e.target.value;
                    setLocalValue(newVal);
                    // onChange is usually not debounced as it might update row state
                    onChange && onChange(newVal); 
                    handleInteract(e, newVal);
                }}
                onBlur={(e) => {
                    if (interactTimerRef.current) clearTimeout(interactTimerRef.current);
                    onBlur && onBlur(localValue);
                }}
                onFocus={(e) => handleInteract(e, readOnly ? '' : localValue)}
                onClick={(e) => handleInteract(e, readOnly ? '' : localValue)}
                onKeyDown={onKeyDown}
                placeholder={placeholder}
                className={`w-full h-full bg-transparent text-white text-center outline-none focus:bg-blue-500/10 transition-colors px-2 placeholder-gray-600 font-bold ${readOnly ? 'cursor-pointer' : 'cursor-text'} ${className}`}
            />
        </div>
    );
};

export const InteractiveDivCell = ({ id, value, onClick, onKeyDown, className = "", placeholder = "", readOnly = false }) => (
    <div
        id={id}
        className={`flex items-center justify-center h-[48px] w-full outline-none focus:bg-blue-500/10 transition-colors px-2 ${readOnly ? 'cursor-default' : 'cursor-pointer'} ${className}`}
        onClick={!readOnly ? onClick : undefined}
        onKeyDown={!readOnly ? onKeyDown : undefined}
        tabIndex={!readOnly ? 0 : -1}
    >
        {value ? value : <span className="text-gray-600 font-bold">{placeholder}</span>}
    </div>
);

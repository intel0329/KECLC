import React, { useRef, useLayoutEffect, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * 계산서 트리 전용 컨텍스트 메뉴 컴포넌트
 * 우클릭 시 나타나는 메뉴의 위치 보정 및 렌더링을 담당합니다.
 */

const CornerBorders = () => (
    <>
        <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-blue-500/50"></div>
        <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-blue-500/50"></div>
        <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-blue-500/50"></div>
        <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-blue-500/50"></div>
    </>
);

const TreeContextMenu = ({ x, y, onClose, items, title }) => {
    const menuRef = useRef(null);
    const [adjustedPos, setAdjustedPos] = useState({ x, y });
    const [isVisible, setIsVisible] = useState(false);

    // 외부 클릭 시 닫기
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    // 화면 경계 보정
    useLayoutEffect(() => {
        if (menuRef.current) {
            const rect = menuRef.current.getBoundingClientRect();
            let newX = x;
            let newY = y;

            // 가로 넘침 방지
            if (x + rect.width > window.innerWidth) {
                newX = window.innerWidth - rect.width - 8;
            }
            
            // 세로 넘침 방지
            if (y + rect.height > window.innerHeight) {
                newY = y - rect.height;
                if (newY < 0) newY = 8;
            }

            setAdjustedPos({ x: newX, y: newY });
            setIsVisible(true);
        }
    }, [x, y]);

    return createPortal(
        <div
            ref={menuRef}
            className={`fixed z-[9999] bg-black/90 border border-gray-800 backdrop-blur-md shadow-2xl py-1 min-w-[140px] transition-opacity duration-100 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
            style={{ top: adjustedPos.y, left: adjustedPos.x }}
            onContextMenu={(e) => e.preventDefault()}
        >
            <CornerBorders />
            
            {title && (
                <div className="px-4 py-2 border-b border-gray-900/50 mb-1">
                    <div className="text-xs font-bold text-blue-400 truncate pr-2">{title}</div>
                </div>
            )}

            {items.map((item, idx) => (
                <button
                    key={idx}
                    onClick={(e) => {
                        e.stopPropagation();
                        item.onClick();
                        onClose();
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs transition-colors ${item.variant === 'danger' ? 'text-red-500 hover:bg-red-500/10' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}
                >
                    <span className={item.variant === 'danger' ? 'text-red-500' : 'text-gray-400'}>{item.icon}</span>
                    <span className="font-medium tracking-tight">{item.label}</span>
                </button>
            ))}
        </div>,
        document.body
    );
};

export default TreeContextMenu;

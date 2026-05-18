import { useState, useRef } from 'react';

/**
 * 동력 부하 데이터의 Undo/Redo 기록을 관리하는 커스텀 훅입니다.
 * @param {Array} initialLoads 초기 부하 데이터 배열
 */
export function usePowerLoadHistory(initialLoads) {
    const [loadsState, setLoadsState] = useState(initialLoads);

    // 스냅샷 저장소
    const historyRef = useRef([]);
    const historyIndexRef = useRef(-1);

    // Undo/Redo 동작에 의한 상태 변경인지 확인하는 플래그
    const isUndoRedoAction = useRef(false);

    /**
     * 현재 상태의 스냅샷을 기록합니다.
     */
    const recordHistory = (loads) => {
        if (isUndoRedoAction.current) {
            isUndoRedoAction.current = false;
            return;
        }

        const currentState = JSON.stringify(loads);

        // 현재 스냅샷과 동일하면 기록하지 않음
        if (historyIndexRef.current >= 0) {
            const head = historyRef.current[historyIndexRef.current];
            if (head && head === currentState) return;
        }

        // Undo 후 새로운 변경이 발생하면 이후의 기록을 삭제 (Branching)
        const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
        newHistory.push(currentState);

        // 메모리 관리를 위해 최근 5단계만 유지
        if (newHistory.length > 5) {
            newHistory.shift();
        } else {
            historyIndexRef.current += 1;
        }

        historyRef.current = newHistory;
    };

    /**
     * 이전 상태로 되돌립니다.
     */
    const undo = () => {
        // 현재 상태가 아직 기록되지 않았다면 팁으로 저장
        if (historyIndexRef.current === historyRef.current.length - 1) {
            const tipState = historyRef.current[historyIndexRef.current];
            const currentStateStr = JSON.stringify(loadsState);

            if (!tipState || tipState !== currentStateStr) {
                historyRef.current.push(currentStateStr);
                if (historyRef.current.length > 5) {
                    historyRef.current.shift();
                } else {
                    historyIndexRef.current += 1;
                }
            }
        }

        if (historyIndexRef.current > 0) {
            isUndoRedoAction.current = true;
            historyIndexRef.current -= 1;
            const previousState = historyRef.current[historyIndexRef.current];
            setLoadsState(JSON.parse(previousState));
            return true;
        }
        return false;
    };

    /**
     * 다음 상태로 다시 진행합니다.
     */
    const redo = () => {
        if (historyIndexRef.current < historyRef.current.length - 1) {
            isUndoRedoAction.current = true;
            historyIndexRef.current += 1;
            const nextState = historyRef.current[historyIndexRef.current];
            setLoadsState(JSON.parse(nextState));
            return true;
        }
        return false;
    };

    return {
        powerLoads: loadsState,
        setPowerLoads: setLoadsState,
        recordHistory,
        undo,
        redo
    };
}

import { useState, useRef, useCallback } from 'react';

// Custom Hook for Undo/Redo logic specific to circuit arrays
export function useCircuitHistory(initialLeft, initialRight) {
    const [leftState, setLeftState] = useState(initialLeft);
    const [rightState, setRightState] = useState(initialRight);

    // Refs that always track the latest state (eliminates stale closure issues)
    const leftRef = useRef(leftState);
    const rightRef = useRef(rightState);
    leftRef.current = leftState;
    rightRef.current = rightState;

    // Store snapshots
    const historyRef = useRef([]);
    const historyIndexRef = useRef(-1);

    // Flag to prevent recording state changes caused by undo/redo itself
    const isUndoRedoAction = useRef(false);

    // Records a state snapshot ONLY when explicitly called
    const recordHistory = useCallback((left, right) => {
        if (isUndoRedoAction.current) {
            isUndoRedoAction.current = false;
            return;
        }

        const currentState = {
            left: JSON.stringify(left),
            right: JSON.stringify(right)
        };

        // Don't record if identical to the current snapshot
        if (historyIndexRef.current >= 0) {
            const head = historyRef.current[historyIndexRef.current];
            if (head && head.left === currentState.left && head.right === currentState.right) return;
        }

        // Slice out future history if we are overwriting after an Undo (branching)
        const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
        newHistory.push(currentState);

        // Keep only the last 5 steps to save memory
        if (newHistory.length > 5) {
            newHistory.shift();
        } else {
            historyIndexRef.current += 1;
        }

        historyRef.current = newHistory;
    }, []);

    const undo = useCallback(() => {
        // If we are at the edge of the history, we may have unrecorded ongoing state (e.g. typing)
        // or the very last completed action that wasn't recorded afterwards.
        // We push it to the stack so we can redo back to it if requested.
        if (historyIndexRef.current === historyRef.current.length - 1) {
            const tipState = historyRef.current[historyIndexRef.current];
            // Use refs to always get the latest state (avoids stale closure)
            const currentLeft = JSON.stringify(leftRef.current);
            const currentRight = JSON.stringify(rightRef.current);

            if (!tipState || tipState.left !== currentLeft || tipState.right !== currentRight) {
                const newTip = { left: currentLeft, right: currentRight };
                historyRef.current.push(newTip);
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
            setLeftState(JSON.parse(previousState.left));
            setRightState(JSON.parse(previousState.right));
            return true;
        }
        return false;
    }, []);

    const redo = useCallback(() => {
        if (historyIndexRef.current < historyRef.current.length - 1) {
            isUndoRedoAction.current = true;
            historyIndexRef.current += 1;
            const nextState = historyRef.current[historyIndexRef.current];
            setLeftState(JSON.parse(nextState.left));
            setRightState(JSON.parse(nextState.right));
            return true;
        }
        return false;
    }, []);

    return {
        leftCircuits: leftState,
        setLeftCircuits: setLeftState,
        rightCircuits: rightState,
        setRightCircuits: setRightState,
        recordHistory,
        undo,
        redo
    };
}

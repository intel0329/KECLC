/**
 * useConnectionSync Hook
 * 
 * 부모-자식 패널 연결(panel_connections)의 즉시 동기화를 담당합니다.
 * 
 * 핵심 기능:
 * 1. flushNow() - Draft 데이터 + Connection을 세트로 묶어 즉시 DB 저장
 * 2. visibilitychange - 탭 이탈 시 자동 flush
 * 3. BroadcastChannel - 다른 탭에 연결 변경 즉시 전파
 * 
 * Usage:
 *   const { flushNow } = useConnectionSync(projectId, panelId, getFlushPayload);
 *   
 *   // PL 부하 등록/삭제 시 즉시 호출
 *   flushNow(draftSaveFn, connections);
 */

import { useEffect, useRef, useCallback } from 'react';
import { savePanelConnections } from '../services/projectService';

import useDataStore from '../store/useDataStore';

const CHANNEL_NAME = 'KECLC_CONNECTION_SYNC';

/**
 * @param {string} projectId
 * @param {string} panelId
 * @param {Function} getFlushPayload - () => { draftSaveFn, connections } | null
 *   visibilitychange 시 자동 호출되어 현재 최신 데이터를 기반으로 flush payload를 반환
 */
export const useConnectionSync = (projectId, panelId, getFlushPayload) => {
    const channelRef = useRef(null);
    const tabId = useRef(`${Date.now()}_${Math.random().toString(36).slice(2)}`);
    const lastSyncedRef = useRef('');
    const getFlushPayloadRef = useRef(getFlushPayload);
    const setSyncStatus = useDataStore(state => state.setSyncStatus);

    // 항상 최신 콜백을 ref에 유지
    useEffect(() => {
        getFlushPayloadRef.current = getFlushPayload;
    });

    // ── BroadcastChannel 설정 ──
    useEffect(() => {
        if (!projectId) return;

        try {
            channelRef.current = new BroadcastChannel(CHANNEL_NAME);
            channelRef.current.onmessage = (e) => {
                if (e.data.tabId === tabId.current) return; // 자기 자신 무시
                if (e.data.projectId !== projectId) return; // 다른 프로젝트 무시

                if (e.data.type === 'CONNECTION_CHANGED') {
                    // 로컬 이벤트로 전파 → usePanelLookup, PowerLoadContent 등이 수신
                    window.dispatchEvent(new CustomEvent('kelc_connections_changed', {
                        detail: { ...e.data, fromBroadcast: true }
                    }));
                }
            };
        } catch (e) {
            console.warn('[ConnectionSync] BroadcastChannel not supported:', e);
        }

        return () => {
            channelRef.current?.close();
            channelRef.current = null;
        };
    }, [projectId]);

    // ── 즉시 Flush (Draft + Connections 세트 저장) ──
    const flushNow = useCallback(async (draftSaveFn, connections) => {
        if (!projectId || !panelId) return;

        // Deduplication: 동일 데이터 연속 저장 방지
        const signature = JSON.stringify({ p: panelId, c: connections });
        if (lastSyncedRef.current === signature) return;

        // [Optimistic Broadcast] 다른 탭에 즉시 알림 (API 완료 대기 안함)
        channelRef.current?.postMessage({
            type: 'CONNECTION_CHANGED',
            tabId: tabId.current,
            projectId,
            parentPanelId: panelId,
            connections, // [Optimistic] 연결 데이터 포함
            timestamp: Date.now()
        });

        // [Optimistic Local] 같은 탭 내 다른 컴포넌트에도 즉시 알림
        window.dispatchEvent(new CustomEvent('kelc_connections_changed', {
            detail: { projectId, parentPanelId: panelId, connections, fromLocal: true }
        }));

        try {
            // [Sync Status] 서버 동기화 시작 (노란색 인디케이터 유발)
            setSyncStatus('remote', 'saving');
            const startTime = Date.now();

            // Draft 데이터와 Connections를 병렬로 즉시 저장
            const promises = [];
            if (draftSaveFn) promises.push(draftSaveFn());
            promises.push(savePanelConnections(projectId, panelId, connections));
            await Promise.all(promises);

            lastSyncedRef.current = signature;

            // [Sync Status] 최소 표시 시간 보장 (깜빡임 방지)
            const elapsed = Date.now() - startTime;
            if (elapsed < 500) {
                await new Promise(resolve => setTimeout(resolve, 500 - elapsed));
            }

            // [Sync Status] 서버 동기화 완료
            setSyncStatus('remote', 'saved');
            setTimeout(() => {
                // 현재 상태가 여전히 saved일 때만 idle로 전환
                const currentStatus = useDataStore.getState().syncStatus.remote;
                if (currentStatus === 'saved') setSyncStatus('remote', 'idle');
            }, 2000);
        } catch (e) {
            console.error('[ConnectionSync] flushNow failed:', e);
            setSyncStatus('remote', 'error');
        }
    }, [projectId, panelId, setSyncStatus]);

    // ── visibilitychange 핸들러 (탭 이탈 시 자동 flush) ──
    useEffect(() => {
        if (!projectId || !panelId) return;

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden' && getFlushPayloadRef.current) {
                const payload = getFlushPayloadRef.current();
                if (payload) {
                    const { draftSaveFn, connections } = payload;
                    // fire-and-forget: 탭이 hidden이 되는 시점이므로 await 불필요
                    // (브라우저는 visibilitychange 핸들러 내 fetch를 완료까지 유지)
                    flushNow(draftSaveFn, connections);
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [projectId, panelId, flushNow]);

    return { flushNow };
};

export default useConnectionSync;

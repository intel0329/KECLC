# KECLC 통합 동기화 마스터 가이드 (Zero-Sync Architecture)

본 문서는 KECLC 프로젝트의 핵심 기술인 **실시간 제로-싱크(Zero-Sync)** 시스템의 작동 원리와 아키텍처를 정의합니다. 이 시스템은 여러 브라우저 탭에서 계산서를 열어두고 작업할 때 데이터의 불일치를 방지하고, 엑셀과 같은 즉각적인 반응성을 제공합니다.

---

## 1. 핵심 철학: SSOT (Single Source of Truth)

모든 데이터의 원천은 서버(DB)가 아닌 **사용자의 브라우저 메모리(Zustand 스토어)**입니다.
- **최우선 순위:** 현재 활성화된 탭의 메모리 데이터
- **차선 순위:** 브라우저 로컬 저장소(localStorage)의 Draft 데이터
- **최종 순위:** 서버 DB 데이터

---

## 2. 3단계 데이터 동기화 흐름

사용자가 데이터를 수정하는 순간부터 서버에 저장되기까지의 과정은 다음과 같습니다.

### [Step 1] 실시간 메모리 전파 (Zero-Sync)
- **타이밍:** 수정 즉시 (0.1초 미만)
- **메커니즘:** `syncPanel()` 호출 → `BroadcastChannel('KECLC_STATE_SYNC')` 메시지 발송
- **효과:** 현재 열려 있는 다른 모든 탭의 Zustand 스토어가 즉시 갱신됩니다. 화면 새로고침 없이 다른 탭의 부하 계산 결과가 실시간으로 변합니다.

### [Step 2] 강제 리액티브 트리거 (Reactive Signal)
- **타이밍:** 메모리 전파와 동시
- **메커니즘:** `localStorage.setItem('kelc_data_update_signal', Date.now())` + `CustomEvent` 발생
- **효과:** React의 기본 `useState`가 감지하지 못하는 깊은 객체(Deep Object)의 변화나 다른 탭에서의 변경 사항을 강제로 감지하여, 헤더의 프로젝트 이름이나 계산서의 연결 상태 등을 즉시 리렌더링합니다.

### [Step 3] 서버 영구 저장 (Persistence)
- **타이밍:** 입력 중단 후 3초 (Debounce)
- **메커니즘:** `savePanel()` 호출 → `api/project_data.php` 전송
- **핵심 정책:** 저장 시점에 현재의 합계 부하(`cachedTotalLoad`)와 상별 합계(`cachedPhaseTotals`)를 `projectInfo` 내에 포함하여 함께 저장합니다. 이는 부모 패널이 자식 데이터를 참조할 때 별도의 계산 없이도 합계값을 즉시 알 수 있게 하기 위함입니다.
- **효과:** 네트워크 부하를 줄이면서 데이터의 영구성과 효율적인 참조를 보장합니다.

---

## 3. 계통 연결 동기화 (Connection Sync)

부모 패널과 자식 패널 사이의 공급-수용 관계를 관리합니다.
- **Hook:** `useConnectionSync.js`
- **저장 위치:** DB `panel_connections` 테이블
- **동작:** 
    - 부하 등록/삭제 시 즉시 DB에 관계 저장.
    - `visibilitychange`(탭 전환) 발생 시 누락된 연결 정보를 즉시 Flush.
    - 다른 탭에서 연결이 바뀌면 `usePanelLookup`을 통해 계통 정보를 재조회하여 SOURCE(전원) 정보를 최신화.

---

## 4. 특수 케이스 처리

### 분전반 (PanelLoad)
- **독립적 동기화:** 왼쪽(Left)과 오른쪽(Right) 회로 데이터를 각각 감시하지만, 전송 시에는 하나의 판넬 데이터로 통합하여 브로드캐스팅합니다.
- **하위 연동:** 하위 판넬(PL)의 이름이나 부하가 바뀌면 `syncPLCircuits`가 이를 감지하여 즉시 자신의 합산 부하를 재계산하고 상위로 전파합니다.

### UPS 및 변압기
- **최종 소비자:** 하위의 모든 부하를 합산한 결과를 `syncPanel`을 통해 상위 계통(예: 변압기 갑지)으로 전달합니다.
- **단위 변환:** UPS 등에서 계산된 VA 단위 데이터를 상위 계통의 규격(kVA 등)에 맞게 자동 변환하여 전달합니다.

---

## 5. 장애 대응 및 데이터 복구

- **Dirty Check:** 수정이 발생했으나 서버에 저장되지 않은 패널은 헤더의 '저장' 버튼에 주황색 표시가 나타납니다.
- **Draft 복구:** 페이지 새로고침 시 서버 데이터보다 최신인 로컬 Draft 데이터가 있다면 이를 우선적으로 로드하여 작업 손실을 방지합니다.
- **탭 고유 ID:** 각 탭은 고유한 `TAB_ID`를 가져 자신이 보낸 브로드캐스팅 메시지에 무한 루프에 빠지지 않도록 설계되었습니다.
- **Heal & Protect (데이터 자동 복구):** `useDataStore.js`의 `loadPanel` 로직에는 비정상적인 데이터 오염을 감지하고 복구하는 엔진이 탑재되어 있습니다. 만약 임시저장(Draft) 데이터의 합계 부하가 0VA인데 원본(Origin) 데이터에 부하가 존재한다면, 시스템이 이를 감지하고 자동으로 원본 데이터를 로드하여 계통의 무결성을 유지합니다.

---

## 6. ⚠️ 주의 사항 (Critical Implementation Rules)

아래 규칙은 Zero-Sync 아키텍처를 구현/수정할 때 반드시 준수해야 합니다. 위반 시 **자식 패널의 부하 데이터가 표시되지 않는** 치명적 버그가 발생합니다.

### 6-1. 자식 패널 사전 로딩 (Child Panel Pre-load) — 필수

`syncPLCircuits` 및 `calculatedLoads`는 자식 패널 데이터를 **서버 API가 아닌 Zustand 메모리 스토어(`panelsData[connectedPanelId]`)**에서 참조합니다. 따라서 부모 컴포넌트가 마운트될 때 연결된 모든 자식 패널의 데이터를 스토어에 미리 로드해야 합니다.

**모든 부모형 계산서 컴포넌트에 아래 패턴을 반드시 포함해야 합니다:**

```javascript
// 1. 스토어 구독: loadPanel 함수를 반드시 가져올 것
const loadPanelStore = useDataStore(state => state.loadPanel);
const loadingPanelsRef = useRef(new Set()); // 중복 로드 방지

// 2. 마운트 시 연결된 하위 계산서 자동 로드
useEffect(() => {
    if (!isDataLoaded) return;
    
    // connectedPanelId 수집 (컴포넌트 유형에 맞게 조정)
    const connectedIds = collectAllConnectedPanelIds();
    
    let delay = 0;
    connectedIds.forEach(pId => {
        if (pId && !panelsData[pId] && !loadingPanelsRef.current.has(pId)) {
            loadingPanelsRef.current.add(pId);
            setTimeout(async () => {
                try {
                    await loadPanelStore(pId);
                } catch (e) {
                    console.error(`Failed to pre-load child panel ${pId}:`, e);
                } finally {
                    loadingPanelsRef.current.delete(pId);
                }
            }, delay);
            delay += 50; // 50ms 간격으로 네트워크 부하 분산
        }
    });
}, [isDataLoaded, /* 부하 데이터 의존성 */, panelsData, loadPanelStore]);
```

**현재 적용 상태:**

| 컴포넌트 | 프리로드 로직 | 비고 |
|:---|:---|:---|
| PanelLoad | ✅ 적용됨 | `leftCircuits`/`rightCircuits`에서 PL 카테고리 부하의 `connectedPanelId` 수집 |
| PowerLoad | ✅ 적용됨 | `powerLoads`에서 `connectedPanelId` 수집 |
| Transformer | ✅ 적용됨 | `powerLoads`에서 `connectedPanelId` 수집 |
| UPS | ✅ 적용됨 | `powerLoads`에서 `bankId` 수집 |
| Generator | ✅ 적용됨 | 부하 목록에서 `connectedPanelId` 수집 |
| 수전설비 | ✅ 적용됨 | 부하 목록에서 `connectedPanelId` 수집 |

> **새로운 계산서 타입을 추가할 때, 자식 패널을 참조하는 로직이 있다면 반드시 이 프리로드 패턴을 포함해야 합니다.**

### 6-2. syncPanel 무한 루프 방지 — 필수

`syncPanel()` 호출은 Zustand 스토어를 업데이트하고, 이 업데이트가 다시 `useEffect`를 트리거할 수 있습니다. 반드시 아래 가드 패턴을 적용해야 합니다:

```javascript
const lastSyncRef = useRef({ dataStr: '', resultStr: '' });

useEffect(() => {
    if (panelId && isDataLoaded) {
        const syncData = { projectInfo, powerLoads };
        const syncResult = { totalLoad, phaseTotals };
        
        const dataStr = JSON.stringify(syncData);
        const resultStr = JSON.stringify(syncResult);
        
        // 실제 변화가 있을 때만 syncPanel 호출
        if (lastSyncRef.current.dataStr !== dataStr || 
            lastSyncRef.current.resultStr !== resultStr) {
            lastSyncRef.current = { dataStr, resultStr };
            syncPanel(panelId, syncData, syncResult);
        }
    }
}, [/* 의존성 */]);
```

### 6-3. Background Sync 데이터 비교 시 타입 안정성 — 권장

자식 패널에서 가져온 데이터와 현재 부하 데이터를 비교할 때, 숫자(`10`)와 문자열(`"10.00"`) 간의 타입 차이로 인해 매 렌더링마다 "변경됨"으로 판단되어 무한 업데이트가 발생할 수 있습니다. 반드시 **`String()` 변환 후 비교**하세요:

```javascript
// ❌ 위험: 타입 불일치로 무한 루프 가능
const fieldsChanged = load.kva !== sc.kva;

// ✅ 안전: 문자열 통일 비교
const fieldsChanged = String(load.kva) !== String(sc.kva);
```

### 6-4. 3중 VA 참조 체인 (VA Fallback Chain) — 필수

자식 패널의 부하량을 가져올 때, 자식 페이지 방문 여부와 상관없이 부하를 표시하기 위해 반드시 아래 **3단계 참조 체인**을 준수해야 합니다.

```javascript
// VA 참조 우선순위 가이드
const newVa = 
    subResult?.totalLoad ??                      // 1순위: 런타임 결과 스토어 (가장 정확함)
    remoteData.projectInfo?.cachedTotalLoad ??   // 2순위: 서버에 저장된 합계 캐시 필드
    calculatePanelTotalLoad(remoteData);         // 3순위: 원시 데이터 기반 즉시 계산 (Ultimate Fallback)
```

이 체인을 통해 사용자가 자식 페이지를 한 번도 열지 않은 상태에서 프로젝트를 처음 로드하더라도, 부모 페이지에서 즉시 모든 부하를 확인할 수 있습니다.

---

**Last Updated:** 2026-04-29
**Architecture by:** Antigravity AI-Agent

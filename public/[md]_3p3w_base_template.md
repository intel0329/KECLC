========================================================================================================
템플릿 이름: 3p3w_base_template.dxf

[분전반 명판]
블록 이름: PANEL_NAME
속성 태그 (ATTDEF):
PNL_NAME: 판넬 이름
PNL_MOUNT: 분전반 Mount
PNL_DOOR: 분전반 도어 재질
PNL_BOX: 분전반 재질

[메인 차단기]
블록 이름: MAIN_BREAKER_3
속성 태그 (ATTDEF):
SOURCE: 전원 공급원
PNL_NAME: 판넬 이름
CB_TYPE: 차단기 타입
AF: Ampere Frame
AT: Ampere Trip

[LEFT_3P3W 분기 차단기]
블록 이름: 3P3W_LEFT_BRANCH_BREAKER_3
속성 태그 (ATTDEF):
CIR_NO: 회로 번호
CB_TYPE: 차단기 타입
AF: 분기 차단기 AF
AT: 분기 차단기 AT

[RIGHT_3P3W 분기 차단기]
블록 이름: 3P3W_RIGHT_BRANCH_BREAKER_3
속성 태그 (ATTDEF):
CIR_NO: 회로 번호
CB_TYPE: 차단기 타입
AF: 분기 차단기 AF
AT: 분기 차단기 AT

[LEFT_1P2W 분기 차단기]
블록 이름: 1P2W_LEFT_BRANCH_BREAKER_3
속성 태그 (ATTDEF):
CIR_NO: 회로 번호
CB_TYPE: 차단기 타입
AF: 분기 차단기 AF
AT: 분기 차단기 AT

[RIGHT_1P2W 분기 차단기]
블록 이름: 1P2W_RIGHT_BRANCH_BREAKER_3
속성 태그 (ATTDEF):
CIR_NO: 회로 번호
CB_TYPE: 차단기 타입
AF: 분기 차단기 AF
AT: 분기 차단기 AT

[버스바 레이어 층 분리]
BUS_L1
BUS_L2
BUS_L3

[감전보호(상_선_왼쪽/오른쪽)]
3P3W_L_SYM_ELB_3 - 누전차단기 또는 감전보호 관련 심볼
3P3W_R_SYM_ELB_3 - 누전차단기 또는 감전보호 관련 심볼
1P2W_L_SYM_ELB_3 - 누전차단기 또는 감전보호 관련 심볼
1P2W_R_SYM_ELB_3 - 누전차단기 또는 감전보호 관련 심볼

[온/오프 스위치(상_선_왼쪽/오른쪽)]
3P3W_L_SYM_ONOFF_3 - 온/오프 스위치 또는 접점 심볼
3P3W_R_SYM_ONOFF_3 - 온/오프 스위치 또는 접점 심볼
1P2W_L_SYM_ONOFF_3 - 온/오프 스위치 또는 접점 심볼
1P2W_R_SYM_ONOFF_3 - 온/오프 스위치 또는 접점 심볼

[타이머(상_선_왼쪽/오른쪽)]
3P3W_L_SYM_TIMER_3 - 타이머 심볼
3P3W_R_SYM_TIMER_3 - 타이머 심볼
1P2W_L_SYM_TIMER_3 - 타이머 심볼
1P2W_R_SYM_TIMER_3 - 타이머 심볼

[일괄소등(왼쪽/오른쪽)]
1P2W_LEFT_SYM_REMOTE_3 - 리모트 또는 일괄소등 제어 심볼
1P2W_RIGHT_SYM_REMOTE_3 - 리모트 또는 일괄소등 제어 심볼
========================================================================================================
========================================================================================================
캐드로 추출시 해당 블록은 아래와 같고, 거기서 노출/매입/방우를 선택하면 아래 DOOR/BOX 재질이 나와야 하는데. 
이 재질 까지는 아직 분전반 부하 계산서에 정보가 없기 떄문에 캐드 상으로 로직을 넣어야 할 것같아.

[분전반 명판]
블록 이름: PANEL_NAME
속성 태그 (ATTDEF):
PNL_NAME: 판넬 이름
PNL_MOUNT: 분전반 Mount
PNL_DOOR: 분전반 도어 재질
PNL_BOX: 분전반 재질

'매입'
PNL_DOOR: SUS
PNL_BOX: STEEL

'노출'
PNL_DOOR: STEEL
PNL_BOX: STEEL
(예외적으로 'PANEL_NAME' 이름에 정육/수산/농산 이라는 단어가 들어갈 경우 모두 'SUS')

'방우'
PNL_DOOR: ALL SUS
PNL_BOX: ALL SUS
========================================================================================================
========================================================================================================
ATTDEF
ATTSYNC 
BATTORDER
========================================================================================================
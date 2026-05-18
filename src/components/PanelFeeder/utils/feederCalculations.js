/**
 * Utility functions for Panel Feeder calculations.
 * Extracted from PanelFeederContent.jsx to improve maintainability.
 */

import CB_DATA from '../../../data/CB.json';
import OD_DATA from '../../../data/OD.json';
import { calculateKECJudgment } from '../../../utils/kecCalculations';

/**
 * CB_DATA에서 차단기의 kA 정격을 조회합니다.
 * @param {string} type - CB 타입 (MCCB, ELCB 등)
 * @param {number|string} af - 차단기 AF
 * @param {number|string} at - 차단기 AT
 * @returns {string} kA 값 또는 빈 문자열
 */
export const lookupBreakerKA = (type, af, at) => {
    if (!type || !af || !at) return '';
    const afNum = Number(af);
    const atNum = Number(at);
    if (!afNum || !atNum) return '';

    const match = CB_DATA.find(row =>
        row[0] === type &&
        Number(row[5]) === afNum &&
        Number(row[4]) === atNum
    );
    return match ? String(match[6]) : '';
};

const FACTOR_HEADERS = {
    tray: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    trayRows: ['1', '2', '3', '4', '5', '6'],
    air: [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65],
    ground: [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65],
    thermal: [0.5, 0.7, 1, 1.5, 2, 2.5, 3],
    buried: [0.6, 0.8, 1.0, 1.2]
};

/**
 * 대상 패널 데이터에서 간선 계산서에 필요한 모든 링크 데이터를 추출합니다.
 */
export const extractLinkedDataFromPanel = (data, cat, kecSettings, mccSettings = null) => {
    const result = {};
    if (!data) return result;

    const totalVA = calculatePanelTotalLoad(data);
    const totalKVA = totalVA / 1000;

    // --- 글로벌 세팅 데이터 추출 (수기 입력 셀이 아닌 설정값 기반 데이터) ---
    if (kecSettings && kecSettings.selectedFactors) {
        const sf = kecSettings.selectedFactors;
        if (sf.factor2 && sf.factor2.colIdx !== null && sf.factor2.colIdx !== undefined) {
            const rowLabel = FACTOR_HEADERS.trayRows[sf.factor2.rowIdx] ?? '';
            const colLabel = FACTOR_HEADERS.tray[sf.factor2.colIdx] ?? '';
            result.tray = (rowLabel && colLabel) ? `${rowLabel}/${colLabel}` : String(colLabel || '');
        }
        
        if (sf.factor3 && sf.factor3.colIdx !== null && sf.factor3.colIdx !== undefined) 
            result.air = String(FACTOR_HEADERS.air[sf.factor3.colIdx] ?? '');
            
        if (sf.factor4 && sf.factor4.colIdx !== null && sf.factor4.colIdx !== undefined) 
            result.ground = String(FACTOR_HEADERS.ground[sf.factor4.colIdx] ?? '');
            
        if (sf.factor6 && sf.factor6.colIdx !== null && sf.factor6.colIdx !== undefined) 
            result.buried = String(FACTOR_HEADERS.buried[sf.factor6.colIdx] ?? '');
            
        if (sf.factor5 && sf.factor5.colIdx !== null && sf.factor5.colIdx !== undefined) 
            result.thermal = String(FACTOR_HEADERS.thermal[sf.factor5.colIdx] ?? '');
    }

    // ========== Phase 1: FROM ~ 차단기 선정 ==========

    // 1. Load Capacity — Cat에 따라 kVA 또는 kW 결정. Cat 없으면 kVA에 기본 표시
    if (cat === 'L' || !cat) {
        result.capacityKva = totalKVA.toFixed(2);
        result.capacityKw = '';
    }
    if (cat === 'P' || cat === 'M') {
        result.capacityKw = totalKVA.toFixed(2);
        result.capacityKva = '';
    }

    // 2. Phase Sync
    const pi = data.projectInfo || {};
    const rawPhase = pi.phase || '3Ø-4W'; 
    result.phase = normalizePhase(rawPhase);
    result.voltage = result.phase.includes('1Φ') ? '220' : '380';

    // 3. Main Breaker Info (from Decide Drawer settings)
    const bType = pi.mainBreakerType || 'MCCB'; 
    const bAF = pi.mccbAF ? String(pi.mccbAF) : '';
    const bAT = pi.mccbAT ? String(pi.mccbAT) : '';

    result.breakerType2 = bType;
    result.breakerAF = bAF;
    result.breakerAT = bAT;

    // Use the centralized lookup utility for kA rating
    result.breakerKA = lookupBreakerKA(bType, bAF, bAT);

    // 4. Demand Factor (수용률) - SSOT 보존을 위해 간선 계산서 연동 시에만 기본값 100 부여
    // 동력 부하 계산서는 자체 필드가 있고, 분전반 부하 계산서는 없으므로 없는 경우 100으로 세팅
    result.demandFactor = (pi.demandFactor !== undefined && pi.demandFactor !== "") 
        ? String(pi.demandFactor) 
        : '100';

    // ========== Phase 2 & 3: KEC Judgment Data ==========
    // Decide Drawer의 판정 결과를 가져오기 위해 calculateKECJudgment 호출
    if (pi && pi.mccbAT && pi.cableSize) {
        const panelPhase = pi.phase || '3Ø-4W';
        const getP = (ph) => {
            const cleanPh = normalizePhase(ph);
            if (cleanPh.includes('1Φ')) return 2;
            if (cleanPh.includes('3Φ3W')) return 3;
            return 4;
        };
        const p = getP(panelPhase);
        const ib = p === 2 ? totalVA / 220 : totalVA / (380 * Math.sqrt(3));

        const circuit = {
            ib,
            at: pi.mccbAT || 0,
            af: pi.mccbAF || 0,
            type: pi.mainBreakerType || 'MCCB',
            size: pi.cableSize || 0,
            wire: pi.wire || 'FCV',
            method: pi.kecMethod || 'E',
            p,
            cableDistance: pi.branchDistance || 15,
            scb: pi.shortCircuitCurrent || 0,
            startingCurrent: Number(pi.cachedIms) || 0,
            startingTime: Number(pi.cachedSmsthTm) || 0,
            inrushCurrent: Number(pi.cachedImi) || 0,
            globalK: mccSettings?.globalK || 0,
            isFeeder: true // 패널 레벨에서는 간선으로 취급하여 기준 강하율 10% 적용
        };

        // --- Dynamic S_MSTH Data Extraction from Power Loads ---
        // 하위 판넬이 동력 부하 계산서인 경우, 실시간 세팅을 반영하기 위해 부하 목록에서 직접 최대 전동기 기동 데이터 추출
        if (data.powerLoads && data.powerLoads.length > 0 && mccSettings) {
            let maxIms = 0;
            let effectiveTm = 0;
            let effectiveImi = 0;

            data.powerLoads.forEach(load => {
                if (load.type !== 'MOTOR' && load.type !== 'PUMP') return;

                const kw = Number(load.effectivePower) || 0;
                const pf = Number(load.powerFactor) || 0.85;
                const eff = Number(load.efficiency) || 0.9;
                const phaseNum = normalizePhase(load.phase || pi.phase).includes('1Φ') ? 2 : 4;
                const v = phaseNum === 2 ? 220 : 380;
                const sqrt3 = 1.732;

                const baseCurrent = phaseNum === 2 ? (kw * 1000) / (v * pf * eff) : (kw * 1000) / (sqrt3 * v * pf * eff);
                const method = (load.startingMethod || 'DOL').toUpperCase();
                
                // Determine Beta (Starting Current Multiplier)
                let beta = 6.0;
                if (method === 'DOL' || method.includes('직입')) beta = Number(mccSettings.betaDOL) || 6.0;
                else if (method === 'Y-D') beta = Number(mccSettings.betaYD) || 2.0;
                else if (method === '리액터' || method.includes('REACTOR')) beta = Number(mccSettings.betaReactor) || 4.2;
                else if (method === 'INV' || method.includes('INVERTER')) beta = Number(mccSettings.betaINV) || 1.1;

                const currentIms = baseCurrent * beta;

                if (currentIms > maxIms) {
                    maxIms = currentIms;
                    
                    // Determine effective Tm
                    let tm = Number(load.startingTime) || 0;
                    if (!tm) {
                        if (method === 'DOL' || method.includes('직입')) tm = Number(mccSettings.tmDOL) || 6;
                        else if (method === 'Y-D') tm = Number(mccSettings.tmYD) || 15;
                        else if (method === '리액터' || method.includes('REACTOR')) tm = Number(mccSettings.tmReactor) || 10;
                        else if (method === 'INV' || method.includes('INVERTER')) tm = Number(mccSettings.tmINV) || 10;
                        else tm = 10;
                    }
                    effectiveTm = tm;

                    // Determine Imi (Inrush)
                    const globalK = Number(mccSettings.globalK) || 1.1;
                    effectiveImi = currentIms * globalK;
                }
            });

            if (maxIms > 0) {
                circuit.startingCurrent = maxIms;
                circuit.startingTime = effectiveTm;
                circuit.inrushCurrent = effectiveImi;
            }
        }

        try {
            const j = calculateKECJudgment(circuit, kecSettings || {}, pi);

            // --- ATB ---
            if (j.at_b) {
                result.ib = j.at_b.ib ? j.at_b.ib.toFixed(2) : '';
                result.in = j.at_b.in ? String(j.at_b.in) : '';
                result.ibInIz = j.at_b.status || '';
                result.atb = j.at_b.recommendedIn !== 'N/A' ? String(j.at_b.recommendedIn) : '';
                
                const pf = kecSettings?.cableCondition?.powerFactor ?? pi.powerFactor;
                const eff = kecSettings?.cableCondition?.efficiency ?? pi.efficiency;
                result.pf = pf !== undefined && pf !== null ? String(pf) : ''; 
                result.eff = eff !== undefined && eff !== null ? String(eff) : ''; 
            }

            // --- ATTH ---
            if (j.at_th) {
                result.i2 = j.at_th.i2 ? j.at_th.i2.toFixed(2) : '';
                result.iz145 = j.at_th.iz145 ? j.at_th.iz145.toFixed(2) : '';
                result.i2Iz = j.at_th.status || '';
                // ATTH should refer to ATB value per user request
                result.atth = j.at_b?.recommendedIn !== 'N/A' ? String(j.at_b.recommendedIn) : '';
            }

            // --- ATMS ---
            // Priority: Use cached results from sub-panel (Power Load) if available
            if (pi.cachedAtms) {
                result.delta = pi.cachedDelta || '-';
                result.ims = pi.cachedIms || '-';
                result.inIms = pi.cachedAtmsStatus || '';
                result.atms = pi.cachedAtms || '';
            } else if (j.at_ms) {
                result.delta = String(j.at_ms.delta);
                result.ims = String(j.at_ms.ims); 
                result.inIms = j.at_ms.status || '';
                result.atms = j.at_ms.recommendedIn !== 'N/A' ? String(j.at_ms.recommendedIn) : '';
            }

            // --- ATMI ---
            if (pi.cachedAtmi) {
                result.k = pi.cachedK || '-';
                result.imi = pi.cachedImi || '-';
                result.inImi = pi.cachedAtmiStatus || '';
                result.atmi = pi.cachedAtmi || '';
            } else if (j.at_mi) {
                result.k = String(j.at_mi.globalK);
                result.imi = String(j.at_mi.imi); 
                result.inImi = j.at_mi.status || '';
                result.atmi = j.at_mi.recommendedIn !== 'N/A' ? String(j.at_mi.recommendedIn) : '';
            }

            // --- ATSC ---
            if (j.at_sc) {
                result.tn = j.at_sc.tn ? String(j.at_sc.tn) : '';
                result.tz = j.at_sc.tz_calculated ? j.at_sc.tz_calculated.toFixed(4) : '';
                result.tnTz = j.at_sc.status || '';
                result.atsc = j.at_sc.isc ? j.at_sc.isc.toFixed(1) : '';
            }

            // ========== Phase 3: SCB ~ SMSTh ==========

            // --- SCB ---
            if (j.scb) {
                result.in2 = j.at_b?.in ? String(j.at_b.in) : '';
                result.iz2 = j.scb.iz ? j.scb.iz.toFixed(2) : '';
                result.ibInIz2 = j.scb.status || '';
                result.scbSize = j.scb.recommendedSize?.size || j.scb.recommendedSize || '';
            }

            // --- Se% ---
            if (j.se) {
                result.seEb = j.se.e_percent || '';
                result.seL = j.se.d ? String(j.se.d) : '';
                result.seIb = j.at_b?.ib ? j.at_b.ib.toFixed(2) : '';
                result.seEv = j.se.e_v ? String(j.se.e_v) : ''; 
                result.seSize = j.se.status || '';
                
                result.vDropEPer = result.seEb;
                result.vDropEV = result.seEv;

                result.r = j.se.r !== undefined ? String(j.se.r) : ''; 
                result.x = j.se.x !== undefined ? String(j.se.x) : ''; 
                result.dist = j.se.d !== undefined ? String(j.se.d) : ''; 
            }
            
            // [SYNC] 도체 굵기는 전압강하 판정 여부와 상관없이 항상 추출
            result.cableCond = pi.cableSize ? String(pi.cableSize) : ''; 

            // --- SSC ---
            if (j.ssc) {
                result.sscTn = j.ssc.tn ? String(j.ssc.tn) : '';
                result.sscIsc = j.ssc.isc ? j.ssc.isc.toFixed(1) : '';
                result.sscCalc = j.ssc.ssc_calculated ? j.ssc.ssc_calculated.toFixed(2) : '';
                result.sscSize = j.ssc.recommendedSize || '';
                result.sscStatus = j.ssc.status || ''; 
            }

            // --- SMSe% --- 
            if (j.smse) {
                result.smseEv = j.smse.e_v || '';
                result.smseEPer = j.smse.e_percent || '';
                result.smseLimit = j.smse.limit !== undefined ? String(j.smse.limit) : '';
                result.smIms = j.smse.ims || pi.cachedIms || ''; 
                result.smseRecommendedSize = j.smse.recommendedSize || '';
                result.smSize = j.smse.status || ''; // Status (Ok/Fail)
            }

            // --- SMSTh ---
            // SMSTh는 j.smsth 결과값(실시간 연산)을 우선 사용하되, j.smsth가 없는 경우에만 캐시 사용
            if (j.smsth && j.smsth.status !== '-') {
                result.smsIms = (Number(j.smsth.ims) || 0).toFixed(2); 
                result.smsTm = j.smsth.tm ? String(j.smsth.tm) : '';
                result.smsInsulation = j.smsth.insulation || '';
                result.smsSize = j.smsth.recommendedSize || '';
                result.smsStatus = j.smsth.status || '';
            } else if (pi.cachedSmsthSize && pi.cachedSmsthInsulation) {
                result.smsIms = pi.cachedIms || ''; 
                result.smsTm = pi.cachedSmsthTm || '';
                result.smsInsulation = pi.cachedSmsthInsulation; 
                result.smsSize = pi.cachedSmsthSize;
                result.smsStatus = pi.cachedSmsthStatus || '';
            } else {
                result.smsIms = '';
                result.smsTm = '';
                result.smsInsulation = '';
                result.smsSize = '';
                result.smsStatus = '';
            }
        } catch (err) {
            console.error('Failed to calculate KEC judgment for linked panel:', err);
        }

    }

    // ========== Phase 4: CABLE Specs & PE Mapping (Zero-Sync) ==========
    // 차단기 정격이 입력되지 않았더라도 전선 규격 정보가 있다면 간선 시트에 즉시 반영합니다.
    if (pi.kecMethod) {
        result.method = pi.kecMethod;
        
        // [ADD] 공사방법이 E 또는 F일 경우 재질을 자동으로 TRAY로 설정
        const m = String(pi.kecMethod).toUpperCase().trim();
        if (m === 'E' || m === 'F') {
            result.conduitMat = 'TRAY';
        }

        if (pi.kecMethod.toUpperCase().includes('X')) {
            result.cableX = pi.parallelCount ? `x${pi.parallelCount}` : 'x2';
        } else {
            result.cableX = '-';
        }
    }

    if (pi.wire) {
        result.cableIns = pi.wire;
        result.cableVolt = pi.wire === 'HFIX' ? '450/750V' : '0.6/1kV';
        
        const pStr = normalizePhase(pi.phase || '3Φ-4W');
        let phaseNum = 4;
        if (pStr.includes('1Φ')) phaseNum = 2;
        else if (pStr.includes('3Φ3')) phaseNum = 3;
        else if (pStr.includes('3Φ4')) phaseNum = 4;
        
        const cableCond = Number(pi.cableSize) || 0;
        const areaSetting = Number(kecSettings?.cableCondition?.area) || 50;
        
        if (pi.wire === 'HFIX') {
            result.cableCore = '1C';
            result.cableLine = `${phaseNum}L`;
        } else if (pi.wire === 'FCV' || pi.wire === 'FR8') {
            if (cableCond < areaSetting) {
                result.cableCore = `${phaseNum}C`;
                result.cableLine = '1L';
            } else {
                result.cableCore = '1C';
                result.cableLine = `${phaseNum}L`;
            }
        }

        // --- Cable Area (단면적) Automation ---
        if (pi.cableSize) {
            const wire = pi.wire;
            const condSize = String(pi.cableSize);
            const coreVal = result.cableCore || '1C';
            
            let startIndex = -1;
            if (wire === 'FCV') {
                startIndex = OD_DATA.findIndex(row => row[0]?.includes('1)') && row[0]?.includes('CV'));
            } else if (wire === 'FR8') {
                startIndex = OD_DATA.findIndex(row => row[0]?.includes('2)') && row[0]?.includes('FR-8'));
            } else if (wire === 'HFIX') {
                startIndex = OD_DATA.findIndex(row => row[0]?.includes('4)') && row[0]?.includes('HFIX'));
            }

            if (startIndex !== -1) {
                let colIdx = -1;
                if (wire === 'HFIX') {
                    colIdx = 2; // HFIX 1C Section Column
                } else {
                    const coreNum = parseInt(coreVal);
                    if (coreNum >= 1 && coreNum <= 4) {
                        colIdx = (coreNum - 1) * 3 + 2;
                    }
                }

                if (colIdx !== -1) {
                    const dataStart = startIndex + 4;
                    const mappingRow = OD_DATA.slice(dataStart).find(row => String(row[0]) === condSize);
                    if (mappingRow) {
                        result.cableCondArea = mappingRow[colIdx] || '';
                    }
                }
            }
        }
    }

    // --- PE Spec Automation ---
    const condSize = pi.cableSize ? String(pi.cableSize) : '';
    if (condSize) {
        const fvStartIndex = OD_DATA.findIndex(row => row[0]?.includes('5) 0.6/1kV F-GV 선정'));
        if (fvStartIndex !== -1) {
            const dataStart = fvStartIndex + 3;
            const mappingRow = OD_DATA.slice(dataStart).find(row => String(row[0]) === condSize);
            if (mappingRow) {
                result.cablePe = mappingRow[1] || '';
                result.cableOuterD = mappingRow[4] || '';
                
                if (result.cableX && result.cableX.startsWith('x')) {
                    const xVal = result.cableX.substring(1);
                    if (xVal && !isNaN(xVal)) {
                        result.cablePeLine = `x${xVal}`;
                    } else {
                        result.cablePeLine = '-';
                    }
                } else {
                    result.cablePeLine = '-';
                }
            }
        }
    }

    return result;
};

// Helper to normalize phase string
export const normalizePhase = (p) => {
    if (!p) return '';
    return String(p).replace(/[-\s]/g, '').replace(/Ø|ø/g, 'Φ').toUpperCase();
};

// Calculate total load for a panel
export const calculatePanelTotalLoad = (data) => {
    if (!data) return 0;
    let totalVA = 0;

    // 1. UPS Panel Handling (Special Case)
    // Check type explicitly or check for UPS-specific mainCapacity field
    if (data.type === 'ups' || (data.projectInfo && data.projectInfo.mainCapacity !== undefined)) {
        return Math.round((Number(data.projectInfo?.mainCapacity) || 0) * 1000);
    }

    if (data.leftCircuits || data.rightCircuits) {
        ['leftCircuits', 'rightCircuits'].forEach(side => {
            if (data[side]) {
                data[side].forEach(c => {
                    if (c.power !== undefined && c.power !== "") {
                        totalVA += Number(c.power);
                    } else if (c.loads) {
                        c.loads.forEach(load => {
                            totalVA += (Number(load.qty) || 0) * (Number(load.va) || 0);
                        });
                    }
                });
            }
        });
    }
    else if (data.powerLoads) {
        if (data.projectInfo?.cachedTotalLoad !== undefined && data.projectInfo.cachedTotalLoad !== null) {
            totalVA = Number(data.projectInfo.cachedTotalLoad) || 0;
        } else {
            data.powerLoads.forEach(load => {
                if (load.type === 'SPARE') return;
                if (load.type === 'MOTOR' || load.type === 'PUMP') {
                    const kw = Number(load.effectivePower) || 0;
                    const pf = Number(load.powerFactor) || 0.85;
                    const eff = Number(load.efficiency) || 0.9;
                    if (pf > 0 && eff > 0) {
                        totalVA += (kw / (pf * eff)) * 1000;
                    }
                } else {
                    totalVA += (Number(load.apparentPower) || 0) * 1000;
                }
            });
        }
    }
    else if (data.feeders) {
        data.feeders.forEach(f => {
            totalVA += (Number(f.demandKva) || 0) * 1000;
        });
    }

    return Math.round(totalVA);
};

// Calculate all dependent values for a single feeder row
export const calculateFeederValues = (feeder, settingsPF = 0.8, settingsEff = 1.0, kecSettings = null) => {
    const newValues = {};

    // [FIX] 부하 명칭(toId)이나 용량 등 주요 데이터가 없는 '비어있는 행'은 자동 계산 필드를 비워둠
    if (!feeder.toId && !feeder.capacityKva && !feeder.capacityKw) {
        return {
            current: '',
            demandKva: '',
            demandA: '',
            conduitLine: '',
            conduitTotal: '',
            conduitNom: '',
            conduitIn: ''
        };
    }

    const voltage = Number(feeder.voltage) || 0;
    const is3Ph = normalizePhase(feeder.phase).includes('3Φ');
    const sqrt3 = 1.7320508;

    let kva = Number(feeder.capacityKva) || 0;
    let kw = Number(feeder.capacityKw) || 0;

    const pf = Number(settingsPF) || 0.8;
    const eff = Number(settingsEff) || 1.0;

    let current = 0;
    if (kw > 0) {
        if (is3Ph) {
            current = (kw * 1000) / (sqrt3 * voltage * pf * eff);
        } else {
            current = (kw * 1000) / (voltage * pf * eff);
        }
    } else if (kva > 0) {
        if (is3Ph) {
            current = (kva * 1000) / (sqrt3 * voltage);
        } else {
            current = (kva * 1000) / voltage;
        }
    }

    newValues.current = current > 0 ? current.toFixed(2) : '';
    newValues.demandKva = (kva * (Number(feeder.demandFactor) || 100) / 100).toFixed(2);
    newValues.demandA = (current * (Number(feeder.demandFactor) || 100) / 100).toFixed(2);

    // --- Conduit Select Automation ---
    if (feeder.cableX && feeder.cableX.startsWith('x')) {
        const xVal = feeder.cableX.substring(1);
        if (xVal && !isNaN(xVal)) {
            newValues.conduitLine = `${xVal}L`;
        } else {
            newValues.conduitLine = '1L';
        }
    } else {
        newValues.conduitLine = '1L';
    }

    const mat = feeder.conduitMat;
    if (mat === 'TRAY') {
        newValues.conduitIn = '-';
    } else if (mat && kecSettings?.factor7Values) {
        const matIndexMap = { 'CD': 0, 'HI': 1, 'ST': 2, 'ELP': 3 };
        const idx = matIndexMap[mat];
        if (idx !== undefined) {
            const ratio = kecSettings.factor7Values[idx];
            newValues.conduitIn = ratio !== undefined ? `${ratio}%` : '';
        } else {
            newValues.conduitIn = '';
        }
    } else {
        newValues.conduitIn = '';
    }

    // 3. Conduit Total Logic: (Cable Area x Cable Line) + PE Area (1SET Standard)
    const cableArea = Number(feeder.cableCondArea) || 0;
    const peArea = Number(feeder.cableOuterD) || 0;
    let cableLineNum = 1;
    if (feeder.cableLine) {
        const match = feeder.cableLine.match(/(\d+)/);
        if (match) cableLineNum = Number(match[1]);
    }
    
    if (cableArea > 0) {
        const total = (cableArea * cableLineNum) + peArea;
        const totalArea = total;
        newValues.conduitTotal = total.toFixed(2);

        // --- Conduit Nominal Size (호칭) Automation ---
        if (mat === 'TRAY') {
            newValues.conduitNom = '-';
        } else if (mat) {
            const ratioStr = newValues.conduitIn || '';
            const ratioNum = parseInt(ratioStr);

            if (ratioNum >= 49) {
                newValues.conduitNom = 'Chk';
            } else {
                let startIndex = -1;
                let endIndex = -1;
                
                if (mat === 'CD') {
                    startIndex = OD_DATA.findIndex(row => row[0]?.includes('1) CD'));
                    endIndex = OD_DATA.findIndex(row => row[0]?.includes('2) HI'));
                } else if (mat === 'HI') {
                    startIndex = OD_DATA.findIndex(row => row[0]?.includes('2) HI'));
                    endIndex = OD_DATA.findIndex(row => row[0]?.includes('3) ST'));
                } else if (mat === 'ST') {
                    startIndex = OD_DATA.findIndex(row => row[0]?.includes('3) ST'));
                    endIndex = OD_DATA.findIndex(row => row[0]?.includes('4) ELP'));
                } else if (mat === 'ELP') {
                    startIndex = OD_DATA.findIndex(row => row[0]?.includes('4) ELP'));
                    endIndex = OD_DATA.length;
                }

                if (startIndex !== -1) {
                    const dataStart = startIndex + 4;
                    const searchEnd = (endIndex !== -1 && endIndex > dataStart) ? endIndex : OD_DATA.length;
                    
                    // Determine which column to check: 32%(4), 40%(5), 48%(6)
                    let colIdx = 4;
                    if (ratioNum > 40) colIdx = 6;
                    else if (ratioNum > 32) colIdx = 5;

                    const matchRow = OD_DATA.slice(dataStart, searchEnd).find(row => {
                        // Stop if we hit an empty row or title row within the slice
                        if (!row[0] || (typeof row[0] === 'string' && row[0].match(/^\s*\d\)/))) return false;
                        const limit = parseFloat(String(row[colIdx] || '0').replace(/,/g, ''));
                        return limit >= totalArea;
                    });

                    if (matchRow) {
                        const baseNom = String(matchRow[0]);
                        
                        // Add units based on material
                        if (mat === 'ELP') {
                            newValues.conduitNom = `${baseNom}Φ`;
                        } else {
                            newValues.conduitNom = `${baseNom}C`;
                        }
                    } else {
                        newValues.conduitNom = 'Chk';
                    }
                } else {
                    newValues.conduitNom = '';
                }
            }
        } else {
            newValues.conduitNom = '';
        }
    } else {
        newValues.conduitTotal = '';
        newValues.conduitNom = '';
    }

    return newValues;
};

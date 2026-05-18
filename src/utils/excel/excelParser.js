import * as XLSX from 'xlsx';
import { mapCategoryByName, getLoadClassification, getWireClassification } from './categoryMapper';
import { getTemplateById } from './excelTemplates';

/**
 * 차단기 종류 명칭을 규격에 맞게 변환합니다.
 */
const normalizeBreakerType = (type) => {
    if (!type) return 'MCCB';
    const t = String(type).toUpperCase().trim();
    if (t === 'ELB') return 'ELCB'; // 엑셀 ELB -> 웹 ELCB 매핑
    return t;
};

/**
 * 엑셀의 형태(Mount) 텍스트를 웹 UI 옵션값으로 매핑합니다.
 */
const mapInstallType = (text) => {
    if (!text) return '노출';
    const t = String(text).trim();
    if (t.includes('매입')) return '매입';
    if (t.includes('노출')) return '노출';
    if (t.includes('방우')) return '방우';
    return '노출'; // 기본값
};

/**
 * 엑셀의 전압/상수 복합 텍스트(예: 1Φ-2W 220V)를 분리합니다.
 */
const parsePhaseVoltage = (text) => {
    const result = { phase: '3Ø-4W', voltage: '380V' };
    if (!text) return result;

    const t = String(text).trim();
    
    // 1. 상수 추출 (1Φ-2W, 3Ø-4W 등)
    // 웹 피드백: Φ (Greek)와 Ø (Slashed O) 둘 다 고려하여 내부 규격(Ø)으로 변환
    const phaseMatch = t.match(/[13][ΦØ]-[234]W/i);
    if (phaseMatch) {
        result.phase = phaseMatch[0].toUpperCase().replace('Φ', 'Ø');
        
        // 2. 상에 따른 표준 전압 자동 설정 (기본값)
        if (result.phase === '3Ø-4W') result.voltage = '380V';
        else if (result.phase === '1Ø-2W') result.voltage = '220V';
    }

    // 3. 전압 추출 (데이터 보정)
    const voltages = t.match(/\d{3}/g) || [];
    
    if (voltages.length > 0) {
        const contains380 = voltages.includes('380');
        const contains220 = voltages.includes('220');

        if (result.phase === '3Ø-4W') {
            if (contains380) result.voltage = '380V';
            else if (voltages.length === 1) result.voltage = voltages[0] + 'V';
        } else if (result.phase === '1Ø-2W') {
            if (contains220) result.voltage = '220V';
            else if (voltages.length === 1) result.voltage = voltages[0] + 'V';
        } else if (voltages.length === 1) {
            result.voltage = voltages[0] + 'V';
        }
    }

    return result;
};

/**
 * 불규칙한 공백과 라벨(키워드) 및 특수문자를 제거하여 순수 데이터만 반환합니다.
 */
const cleanValue = (val, keywords) => {
    if (!val) return '';
    let cleaned = String(val).trim();

    if (cleaned.includes(':')) {
        const parts = cleaned.split(':');
        if (parts.length > 1) {
            const afterColon = parts.slice(1).join(':').trim();
            if (afterColon) {
                cleaned = afterColon;
            } else {
                return '';
            }
        }
    }

    const noSpaceCleaned = cleaned.replace(/\s+/g, '').toLowerCase();
    
    if (keywords && keywords.length > 0) {
        for (let i = 0; i < keywords.length; i++) {
            const noSpaceK = keywords[i].replace(/\s+/g, '').toLowerCase();
            if (noSpaceCleaned === noSpaceK || noSpaceCleaned === noSpaceK + ':') {
                return '';
            }
        }
    }

    return cleaned;
};

/**
 * 엑셀 시트 전체를 스캔하여 키워드를 찾고 그 오른쪽 셀의 값을 반환합니다. (하이브리드 방식)
 */
const findValueByHybrid = (jsonData, config) => {
    if (!config) return '';
    const { keywords, fallback } = config;

    const normalizedKeywords = keywords ? keywords.map(k => k.replace(/\s+/g, '').toLowerCase()) : [];

    if (normalizedKeywords.length > 0) {
        for (let r = 0; r < Math.min(jsonData.length, 25); r++) {
            const row = jsonData[r];
            if (!row) continue;
            for (let c = 0; c < row.length; c++) {
                const cellValue = String(row[c] || '').trim();
                const noSpaceCell = cellValue.replace(/\s+/g, '').toLowerCase();
                
                if (normalizedKeywords.some(nk => noSpaceCell.includes(nk))) {
                    const selfCleaned = cleanValue(cellValue, keywords);
                    if (selfCleaned) return selfCleaned;

                    for (let nextC = c + 1; nextC < Math.min(row.length, c + 10); nextC++) {
                        const val = String(row[nextC] || '').trim();
                        if (val) {
                            const cleaned = cleanValue(val, keywords);
                            if (cleaned) return cleaned;
                        }
                    }
                }
            }
        }
    }

    if (fallback && jsonData[fallback.r] && jsonData[fallback.r][fallback.c]) {
        const fallbackVal = String(jsonData[fallback.r][fallback.c]).trim();
        return cleanValue(fallbackVal, keywords);
    }

    return '';
};

/**
 * 엑셀 시트에서 컬럼 헤더 키워드를 검색하여 각 필드의 실제 열(Column) 인덱스를 결정합니다.
 */
const resolveColumnIndexes = (jsonData, columnDefinitions) => {
    const resolved = {};
    let bestHeaderRow = -1;
    let maxMatches = -1;

    for (let r = 0; r < Math.min(jsonData.length, 20); r++) {
        const row = jsonData[r];
        const nextRow = jsonData[r + 1] || [];
        if (!row) continue;
        
        let matches = 0;
        const tempIndexes = {};
        
        Object.entries(columnDefinitions).forEach(([field, config]) => {
            const keywords = config.keywords;
            if (!keywords) return;
            const normalizedKeywords = keywords.map(k => k.replace(/\s+/g, '').toLowerCase());
            
            for (let c = 0; c < Math.max(row.length, nextRow.length); c++) {
                const cellValue = String(row[c] || '').replace(/\s+/g, '').toLowerCase();
                const nextCellValue = String(nextRow[c] || '').replace(/\s+/g, '').toLowerCase();
                
                if (normalizedKeywords.some(nk => cellValue.includes(nk) || nextCellValue.includes(nk))) {
                    tempIndexes[field] = c;
                    matches++;
                    break;
                }
            }
        });

        if (matches > maxMatches && matches >= 2) {
            maxMatches = matches;
            bestHeaderRow = r;
            Object.assign(resolved, tempIndexes);
        }
    }

    Object.entries(columnDefinitions).forEach(([field, config]) => {
        if (resolved[field] === undefined && config.fallbackColumn !== undefined) {
            resolved[field] = config.fallbackColumn;
        }
    });

    let dataStartRow = bestHeaderRow !== -1 ? bestHeaderRow + 1 : 1;
    for (let i = dataStartRow; i < Math.min(jsonData.length, dataStartRow + 5); i++) {
        const row = jsonData[i];
        if (row && row.some(cell => String(cell || '').trim().length > 0)) {
            const isHeaderExtension = row.some(cell => String(cell || '').replace(/\s+/g, '').toUpperCase().includes('LOAD') || String(cell || '').replace(/\s+/g, '').includes('합계'));
            if (!isHeaderExtension) {
                dataStartRow = i;
                break;
            }
        }
    }

    return { 
        indexes: resolved, 
        dataStartRow,
        successCount: maxMatches
    };
};

/**
 * 엑셀 워크북에서 특정 시트의 데이터를 읽어 부하 목록(loads)으로 변환합니다.
 */
export const parseExcelToLoads = (workbook, sheetName, templateId = 'standard_keclc') => {
    try {
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) return [];

        const template = getTemplateById(templateId);
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        const { indexes, dataStartRow } = resolveColumnIndexes(jsonData, template.columns);
        
        const loads = [];
        for (let i = dataStartRow; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || row.length === 0) continue;

            let name = row[indexes.name];
            const circuitNoFromExcel = String(row[indexes.id] || '').trim();

            if (!name) {
                for (let nextI = i + 1; nextI < Math.min(jsonData.length, i + 6); nextI++) {
                    const nextRowCandidate = jsonData[nextI];
                    if (!nextRowCandidate) continue;
                    const nextNameValue = String(nextRowCandidate[indexes.name] || '').trim();
                    const nextCircuitNo = String(nextRowCandidate[indexes.id] || '').trim();
                    if (nextCircuitNo) break;
                    if (nextNameValue && !['TOTAL', '합계'].some(k => nextNameValue.toUpperCase().includes(k))) {
                        name = nextNameValue;
                        break;
                    }
                }
            }

            const unitLoad = parseFloat(row[indexes.unitLoad]) || 0;
            const qty = parseFloat(row[indexes.qty]) || 0;

            if (!name && !circuitNoFromExcel) continue;

            const noSpaceCircuitNo = circuitNoFromExcel.replace(/\s+/g, '');
            const noSpaceLoadName = String(name || '').replace(/\s+/g, '');
            if (noSpaceCircuitNo.includes('일괄소등스위치') || noSpaceLoadName.includes('일괄소등스위치')) {
                continue;
            }

            const isMetadataRow = ['TOTAL', '합계', '수용', '차단기', '메인'].some(k => noSpaceLoadName.toUpperCase().includes(k));
            if (isMetadataRow) continue;

            const { prefix, category } = getLoadClassification(name, templateId);
            loads.push({
                category,
                name: String(name || 'Spare').trim(),
                qty: Math.max(1, qty),
                capacity: unitLoad,
                prefix: prefix,
                unit: 'VA',
                demandFactor: 100,
                mccbAF: row[indexes.af] || '',
                mccbAT: row[indexes.at] || '',
                poles: row[indexes.poles] || 2,
                type: normalizeBreakerType(row[indexes.breakerType]),
                connectedPanelId: null
            });
        }
        return loads;
    } catch (error) {
        console.error('Excel parsing failed:', error);
        return [];
    }
};

/**
 * 특정 시트를 읽어 전체 판넬 데이터(projectInfo, circuits)를 추출합니다.
 */
export const parseSheetToPanelData = (workbook, sheetName, templateId = 'standard_keclc') => {
    try {
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) return null;

        const template = getTemplateById(templateId);
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        const projectInfo = {
            panelName: sheetName,
            location: '',
            voltage: '380V',
            phase: '3Ø-4W',
            sourceName: '',
            wire: 'FCV',
            kecMethod: 'E'
        };

        if (template.panelHeader) {
            const h = template.panelHeader;
            projectInfo.panelName = findValueByHybrid(jsonData, h.panelName) || sheetName;
            projectInfo.location = findValueByHybrid(jsonData, h.location);
            projectInfo.sourceName = findValueByHybrid(jsonData, h.source);
            
            const rawVoltagePhase = findValueByHybrid(jsonData, h.voltage);
            const { phase, voltage } = parsePhaseVoltage(rawVoltagePhase);
            projectInfo.phase = phase;
            projectInfo.voltage = voltage;

            const rawInstallType = findValueByHybrid(jsonData, h.installType);
            projectInfo.installType = mapInstallType(rawInstallType);
        }

        const leftCircuits = [];
        const rightCircuits = [];
        let circuitCount = 0;
        let currentCircuit = null;

        const { indexes, dataStartRow } = resolveColumnIndexes(jsonData, template.columns);

        for (let i = dataStartRow; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || row.length === 0) continue;

            const circuitNo = String(row[indexes.id] || '').trim();
            const loadName = String(row[indexes.name] || '').trim();
            const unitLoad = parseFloat(row[indexes.unitLoad]) || 0;
            const qty = parseFloat(row[indexes.qty]) || 0;
            const totalLoad = parseFloat(row[indexes.totalLoad]) || (unitLoad * qty);

            const noSpaceCircuitNo = circuitNo.replace(/\s+/g, '');
            const noSpaceLoadName = loadName.replace(/\s+/g, '');
            
            if (noSpaceLoadName.includes('주차단기선정') || noSpaceCircuitNo.includes('주차단기선정')) {
                projectInfo.mainBreakerType = normalizeBreakerType(row[indexes.breakerType] || row[11]);
                projectInfo.mccbPoles = parseInt(row[indexes.poles] || row[12]) || (projectInfo.phase.includes('3Ø') ? 4 : 2);
                projectInfo.mccbAF = parseFloat(row[indexes.af] || row[13]) || '';
                projectInfo.mccbAT = parseFloat(row[indexes.at] || row[14]) || '';
                continue;
            }

            if (noSpaceCircuitNo.includes('일괄소등스위치') || noSpaceLoadName.includes('일괄소등스위치')) {
                continue;
            }

            if (circuitNo && circuitNo.toLowerCase() !== 'undefined') {
                const atValue = row[indexes.at] || '';
                const poles = parseInt(row[indexes.poles]) || (projectInfo.phase.includes('3Ø') ? 3 : 2);
                let phase = poles >= 3 ? '3Ø-4W' : '1Ø-2W';

                const { category: firstLoadCat } = getLoadClassification(loadName, templateId);
                const wireInfo = getWireClassification(atValue, firstLoadCat, phase, templateId);

                currentCircuit = {
                    id: Date.now() + circuitCount++,
                    circuitNo: circuitNo,
                    loadName: circuitNo,
                    power: 0,
                    type: normalizeBreakerType(row[indexes.breakerType]),
                    p: poles,
                    af: row[indexes.af] || '',
                    at: atValue,
                    wire: wireInfo.wire,
                    method: wireInfo.method,
                    size: wireInfo.size,
                    cableDistance: 15,
                    loads: []
                };

                const rowIndex = Math.floor((leftCircuits.length + rightCircuits.length) / 2) + 1;
                currentCircuit.row = rowIndex;

                if (leftCircuits.length <= rightCircuits.length) {
                    currentCircuit.side = 'left';
                    leftCircuits.push(currentCircuit);
                } else {
                    currentCircuit.side = 'right';
                    rightCircuits.push(currentCircuit);
                }
            }

            if (currentCircuit && (loadName || totalLoad > 0)) {
                const isMetadataRow = ['TOTAL', '합계', '수용', '차단기', '메인'].some(k => noSpaceLoadName.toUpperCase().includes(k));
                if (isMetadataRow) continue;

                const { prefix, category } = getLoadClassification(loadName, templateId);
                currentCircuit.loads.push({
                    id: Date.now() + (i * 100),
                    category,
                    name: loadName,
                    qty: qty || 1,
                    va: unitLoad,
                    prefix: prefix
                });
                currentCircuit.power += totalLoad;
            }
        }

        return { projectInfo, leftCircuits, rightCircuits };
    } catch (error) {
        console.error(`Sheet parsing failed (${sheetName}):`, error);
        return null;
    }
};

/**
 * 특정 시트를 읽어 전체 동력 판넬 데이터(projectInfo, powerLoads)를 추출합니다.
 */
export const parseSheetToPowerLoadData = (workbook, sheetName, templateId = 'sh_tech_power') => {
    try {
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) return null;

        const template = getTemplateById(templateId);
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        const projectInfo = {
            panelName: sheetName,
            location: '',
            voltage: '380V',
            phase: '3Φ-4W',
            sourceName: '',
            installType: '노출',
            wire: 'FCV',
            kecMethod: 'E'
        };

        if (template.panelHeader) {
            const h = template.panelHeader;
            projectInfo.panelName = findValueByHybrid(jsonData, h.panelName) || sheetName;
            projectInfo.location = findValueByHybrid(jsonData, h.location) || '';
            projectInfo.sourceName = findValueByHybrid(jsonData, h.source) || '';
            
            const rawVoltagePhase = findValueByHybrid(jsonData, h.voltage);
            if (rawVoltagePhase) {
                const { phase, voltage } = parsePhaseVoltage(rawVoltagePhase);
                projectInfo.phase = phase.replace('Ø', 'Φ'); // UI 표준에 맞추기 위해 Φ 사용
                if (!projectInfo.phase.includes('-')) {
                    projectInfo.phase = projectInfo.phase.replace(/([13])Φ([234])W/, '$1Φ-$2W');
                }
                projectInfo.voltage = voltage;
            }

            const rawInstallType = findValueByHybrid(jsonData, h.installType);
            if (rawInstallType && rawInstallType.includes('자립')) {
                projectInfo.installType = '방우';
            } else {
                projectInfo.installType = mapInstallType(rawInstallType);
            }
        }

        const powerLoads = [];
        const { indexes, dataStartRow } = resolveColumnIndexes(jsonData, template.columns);

        for (let i = dataStartRow; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || row.length === 0) continue;

            const equipmentName = String(row[indexes.name] || '').trim();
            const circuitNo = String(row[indexes.id] || '').trim();

            if (!equipmentName && !circuitNo) continue;
            
            // [NEW] 장비명 키워드 분석을 통한 종류 자동 판별 (getLoadClassification 연동)
            const { category: mappedType } = getLoadClassification(equipmentName, templateId);

            const rawType = String(row[indexes.type] || '').trim().replace(/\s+/g, '').toUpperCase();
            let type = 'MOTOR'; 
            
            if (['MOTOR', 'PUMP', 'LOAD', 'SPARE'].includes(mappedType)) {
                type = mappedType;
            } else if (rawType.includes('N') || rawType.includes('LOAD')) {
                type = 'LOAD';
            } else if (rawType.includes('P') || rawType.includes('PUMP')) {
                type = 'PUMP';
            } else if (rawType.includes('M') || rawType.includes('MOTOR')) {
                type = 'MOTOR';
            } else {
                type = 'MOTOR'; // Default
            }

            // 부하 데이터가 아닌 메타데이터 행(합계, 최대용량, 주차단기 등) 필터링
            const noSpaceName = equipmentName.replace(/\s+/g, '');
            const noSpaceId = circuitNo.replace(/\s+/g, '');
            const metaKeywords = ['합계', '최대용량', '주차단기', '전체정격', '부하계산', '비고'];
            if (metaKeywords.some(k => noSpaceName.includes(k) || noSpaceId.includes(k))) continue;

            const rawPhase = String(row[indexes.phase] || '').trim().replace(/\s+/g, '');
            let phase = '3Φ-4W';
            if (rawPhase === '1' || rawPhase.includes('1상') || rawPhase.includes('1Φ')) phase = '1Φ-2W';
            else if (rawPhase === '3' || rawPhase.includes('3상') || rawPhase.includes('3Φ')) phase = '3Φ-3W';

            const rawMethod = String(row[indexes.startingMethod] || '').trim().replace(/\s+/g, '').toUpperCase();
            let startingMethod = ''; // Default to placeholder
            if (rawMethod === '-' || rawMethod === '') {
                startingMethod = (type === 'LOAD') ? '-' : '';
            } else if (rawMethod.includes('Y') || rawMethod.includes('와이')) {
                startingMethod = 'Y-D';
            } else if (rawMethod.includes('INV') || rawMethod.includes('인버')) {
                startingMethod = 'INV';
            } else if (rawMethod.includes('리액터') || rawMethod.includes('REAC')) {
                startingMethod = '리액터';
            } else if (rawMethod.includes('직입') || rawMethod.includes('DOL')) {
                startingMethod = 'DOL';
            } else {
                startingMethod = ''; // Unknown values default to placeholder
            }

            const kw = parseFloat(row[indexes.kw]) || 0;
            const kva = parseFloat(row[indexes.kva]) || 0;
            const atValue = String(row[indexes.at] || '').trim();
            const af = String(row[indexes.af] || '').trim();

            // [FIX] 부하 종류와 상관없이 엑셀에 데이터가 있다면 모두 추출 (데이터 유실 방지)
            const effectivePower = kw || '';
            const apparentPower = kva || '';

            // [NEW] 전선 정보 자동 매핑 (wireMappingRules.js 연동)
            // MOTOR, PUMP 등은 시스템 매핑 규칙상 '동력' 카테고리를 참조하도록 변환
            let wireCategory = '기타';
            if (type === 'MOTOR' || type === 'PUMP') wireCategory = '동력';
            else if (type === 'SPARE') wireCategory = 'SPARE';
            
            const wireInfo = getWireClassification(atValue, wireCategory, phase, templateId);

            powerLoads.push({
                id: Date.now() + i,
                equipmentName,
                circuitNo,
                type,
                phase,
                startingMethod,
                effectivePower,
                apparentPower,
                startingTime: '', // 엑셀에 정보가 없으므로 시스템 자동 계산에 맡김 (초록색 노출 위함)
                cbType: 'MCCB',
                cbP: (phase.includes('1Φ') ? '2' : (phase.includes('3Φ-3W') ? '3' : '4')),
                at: atValue,
                af: af,
                wire: wireInfo.wire,
                method: wireInfo.method,
                size: wireInfo.size,
                powerFactor: 0.8,
                efficiency: 0.9,
                l: 15,
                chk: 'Ok'
            });
        }
        
        // [NEW] 하단 요약 섹션(메인 차단기, 수용률) 추출 로직
        if (template.summary) {
            const findValue = (keyword, searchDirection = 'right') => {
                if (!keyword) return null;
                // 하단에서부터 찾는 것이 안전 (메인 테이블 헤더와 겹칠 수 있음)
                for (let r = jsonData.length - 1; r >= 0; r--) {
                    const row = jsonData[r];
                    if (!row) continue;
                    for (let c = 0; c < row.length; c++) {
                        const cellVal = String(row[c] || '').replace(/\s+/g, '');
                        if (cellVal === keyword || (cellVal.includes(keyword) && keyword.length >= 2)) {
                            if (searchDirection === 'right') return row[c + 1];
                            if (searchDirection === 'below' && jsonData[r + 1]) return jsonData[r + 1][c];
                        }
                    }
                }
                return null;
            };

            const demandVal = findValue(template.summary.demandFactor, 'right');
            if (demandVal !== null && demandVal !== undefined) {
                const numericDemand = parseFloat(String(demandVal).replace(/[^0-9.]/g, ''));
                if (!isNaN(numericDemand)) projectInfo.demandFactor = numericDemand;
            }

            const afVal = findValue(template.summary.mccbAF, 'below');
            if (afVal) projectInfo.mccbAF = String(afVal).trim();

            const atVal = findValue(template.summary.mccbAT, 'below');
            if (atVal) projectInfo.mccbAT = String(atVal).trim();
            
            // Phase 결정 보조 (Poles 정보가 있다면)
            const polesVal = findValue(template.summary.mainPoles, 'below');
            if (polesVal) {
                const p = parseInt(polesVal);
                if (p === 2) {
                    projectInfo.phase = '1Φ-2W';
                    projectInfo.voltage = '220V';
                } else if (p === 3) {
                    projectInfo.phase = '3Φ-3W';
                    projectInfo.voltage = '380V';
                } else if (p === 4) {
                    projectInfo.phase = '3Φ-4W';
                    projectInfo.voltage = '380V';
                }
            }
        }

        return { projectInfo, powerLoads };
    } catch (error) {
        console.error(`Power Load Sheet parsing failed (${sheetName}):`, error);
        return null;
    }
};

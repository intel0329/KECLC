export const UPS_UNIT_SIZE_DATA = [
    { kva: 5, w: "450", d: "800", h: "1200" },
    { kva: 7.5, w: "450", d: "800", h: "1200" },
    { kva: 10, w: "450", d: "800", h: "1200" },
    { kva: 15, w: "500", d: "800", h: "1200" },
    { kva: 20, w: "500", d: "800", h: "1200" },
    { kva: 30, w: "550", d: "850", h: "1400" },
    { kva: 40, w: "650", d: "850", h: "1500" },
    { kva: 50, w: "650", d: "850", h: "1500" },
    { kva: 60, w: "750", d: "850", h: "1700" },
    { kva: 70, w: "750", d: "850", h: "1700" },
    { kva: 100, w: "800", d: "850", h: "1800" },
];

export const BATTERY_CABINET_SIZE_DATA = [
    { kva: 5, w: "600", d: "800", h: "1200", qty: "1" },
    { kva: 7.5, w: "600", d: "800", h: "1200", qty: "1" },
    { kva: 10, w: "600", d: "800", h: "1200", qty: "1" },
    { kva: 15, w: "600", d: "800", h: "1800", qty: "1" },
    { kva: 20, w: "600", d: "800", h: "1800", qty: "1" },
    { kva: 30, w: "750", d: "850", h: "1800", qty: "1" },
    { kva: 40, w: "750", d: "850", h: "1800", qty: "1" },
    { kva: 50, w: "750", d: "850", h: "1800", qty: "2" },
    { kva: 60, w: "750", d: "850", h: "1700", qty: "2" },
    { kva: 70, w: "750", d: "850", h: "1700", qty: "2" },
    { kva: 100, w: "800", d: "850", h: "1800", qty: "3" },
];

/**
 * UPS Capacity (kVA)를 기준으로 UPS 본체 규격을 조회합니다.
 * @param {number|string} capacityKva 
 * @returns {string} (W×D×H)
 */
export const getUpsUnitSize = (capacityKva) => {
    const cap = parseFloat(capacityKva);
    if (isNaN(cap) || cap <= 0) return "-";
    
    // 차트에서 용량 이상인 첫 번째 항목 찾기 (상위 규격 선정)
    const size = UPS_UNIT_SIZE_DATA.find(item => item.kva >= cap);
    if (size) {
        return `${size.w}×${size.d}×${size.h}`;
    }
    return "별도 협의";
};

/**
 * UPS Capacity (kVA)를 기준으로 배터리 함체 규격 및 수량을 조회합니다.
 * @param {number|string} capacityKva 
 * @returns {object} { size: "W×D×H", qty: "N" }
 */
export const getBatteryCabinetSize = (capacityKva) => {
    const cap = parseFloat(capacityKva);
    if (isNaN(cap) || cap <= 0) return { size: "-", qty: "-" };
    
    const size = BATTERY_CABINET_SIZE_DATA.find(item => item.kva >= cap);
    if (size) {
        return {
            size: `${size.w}×${size.d}×${size.h}`,
            qty: size.qty
        };
    }
    return { size: "별도 협의", qty: "-" };
};

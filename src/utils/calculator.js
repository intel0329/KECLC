// src/utils/calculator.js
import kecData from '../data/설정.json';

/**
 * Calculate Circuit Current (IB)
 * @param {number} power - Power in VA
 * @param {number} voltage - Voltage in V (e.g., 220, 380)
 * @param {number} phase - Phase (1 or 3)
 * @returns {number} Current in Amperes
 */
export const calculateIB = (power, voltage, phase) => {
    if (phase === 1) {
        return power / voltage;
    } else {
        return power / (voltage * Math.sqrt(3));
    }
};

/**
 * Find Breaker Rating (IN)
 * Simplified lookup for now
 */
export const findBreakerRating = (ib) => {
    const ratings = [15, 20, 30, 40, 50, 60, 75, 100, 125, 150, 175, 200, 225, 250, 300, 400, 500, 630];
    return ratings.find(r => r >= ib) || ratings[ratings.length - 1];
};

/**
 * Calculate Voltage Drop
 * @param {number} ib - Current
 * @param {number} length - Distance in meters
 * @param {number} size - Cable size in mm2
 * @param {number} voltage - Voltage
 * @param {number} phase - Phase
 * @returns {number} Voltage drop percentage
 */
export const calculateVoltageDrop = (ib, length, size, voltage, phase) => {
    // Approximate formula for copper at 70C
    // V = (35.6 * L * I) / (1000 * S) for 1P
    // V = (30.8 * L * I) / (1000 * S) for 3P
    const k = phase === 1 ? 35.6 : 30.8;
    const dropV = (k * length * ib) / (1000 * size);
    return (dropV / voltage) * 100;
};

/**
 * Find Cable Size (IZ)
 * This would normally use the KEC tables in 설정.json
 */
export const findCableSize = (in_rating, method = 'B1') => {
    // Simplified lookup based on B1 method (3-core XLPE)
    const table = [
        { size: 1.5, amp: 19.5 },
        { size: 2.5, amp: 26 },
        { size: 4, amp: 35 },
        { size: 6, amp: 44 },
        { size: 10, amp: 60 },
        { size: 16, amp: 80 },
        { size: 25, amp: 105 },
        { size: 35, amp: 128 },
        { size: 50, amp: 154 },
        { size: 70, amp: 194 },
        { size: 95, amp: 233 },
        { size: 120, amp: 268 },
        { size: 150, amp: 300 },
        { size: 185, amp: 340 },
        { size: 240, amp: 400 },
    ];

    const match = table.find(t => t.amp >= in_rating);
    return match ? match.size : 240;
};

/**
 * Parses TCC CSV data (Time, MAX, MIN)
 * @param {string} csvText 
 * @returns {Array<{time: number, max: number, min: number}>}
 */
export function parseTccCSV(csvText) {
    const lines = csvText.trim().split('\n');
    const data = [];

    // Skip header (1st row)
    for (let i = 1; i < lines.length; i++) {
        const columns = lines[i].split(',');
        if (columns.length >= 3) {
            const time = parseFloat(columns[0]);
            const max = parseFloat(columns[1]);
            const min = parseFloat(columns[2]);

            if (!isNaN(time) && !isNaN(max) && !isNaN(min)) {
                data.push({ time, max, min });
            }
        }
    }
    return data;
}

/**
 * Creates a Monotonic Cubic Spline Interpolator
 * @param {number[]} xs 
 * @param {number[]} ys 
 * @returns {(x: number) => number | null}
 */
export function createSplineInterpolator(xs, ys) {
    const n = xs.length;
    if (n !== ys.length) throw new Error("Input arrays must have same length");
    if (n === 0) return () => 0;
    if (n === 1) return () => ys[0];

    // Calculate differences
    const dx = new Array(n - 1);
    const dy = new Array(n - 1);
    const slope = new Array(n - 1);
    for (let i = 0; i < n - 1; i++) {
        dx[i] = xs[i + 1] - xs[i];
        dy[i] = ys[i + 1] - ys[i];
        slope[i] = dy[i] / dx[i];
    }

    // Calculate tangents
    const m = new Array(n);
    m[0] = slope[0];
    m[n - 1] = slope[n - 2];
    for (let i = 1; i < n - 1; i++) {
        const m1 = slope[i - 1];
        const m2 = slope[i];
        if (m1 * m2 <= 0) {
            m[i] = 0;
        } else {
            m[i] = (2 * m1 * m2) / (m1 + m2); // Harmonic mean for monotonicity
        }
    }

    return function interpolate(x) {
        // Handle out of bounds - return null to indicate no data
        if (x < xs[0] || x > xs[n - 1]) return null;

        // Binary search to find interval
        let low = 0, high = n - 2;
        while (low <= high) {
            const mid = (low + high) >>> 1;
            if (xs[mid] <= x) {
                if (mid === n - 2 || xs[mid + 1] > x) {
                    low = mid;
                    break;
                }
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }
        const i = low;

        const h = dx[i];
        const t = (x - xs[i]) / h;
        const t2 = t * t;
        const t3 = t2 * t;

        // Hermite basis functions
        const h00 = 2 * t3 - 3 * t2 + 1;
        const h10 = t3 - 2 * t2 + t;
        const h01 = -2 * t3 + 3 * t2;
        const h11 = t3 - t2;

        return h00 * ys[i] + h10 * h * m[i] + h01 * ys[i + 1] + h11 * h * m[i + 1];
    };
}

export function formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

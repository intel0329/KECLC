import lsLogo from './img/LS.png';

// Configuration for CSV Data Sources and UI Settings

export const DATA_CONFIG = {
    // Common settings used across all models
    COMMON: {
        // TCC Amperage Symbols
        TCC_SYMBOLS: ['32A', '100A', '225A', '400A', '800A', '규약동작배율'],

        // Data refresh interval (in milliseconds)
        REFRESH_INTERVAL: 60000, // 1 minute

        // Display settings
        MAX_DISPLAY_ROWS: 50,
        TABLE_HEIGHT: '200px',
    },

    // Model-specific data sources
    MODELS: {
        '32A': {
            MAIN_TITLE: '32A TCC Analysis',
            LOGO_URL: lsLogo,
            ACCUMULATED_DATA_CSV_URL: '', // Placeholder
        },
        '100A': {
            MAIN_TITLE: '100A TCC Analysis',
            LOGO_URL: lsLogo,
            ACCUMULATED_DATA_CSV_URL: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSECMgxsfPmi379YPUKLAm2YQyLqx4QiMgRlRMjhW3npIsb0Rav7v7q8lMm_AaLuAs1-WPKmHZYYCIR/pub?gid=845891264&single=true&output=csv',
        },
        '225A': {
            MAIN_TITLE: '225A TCC Analysis',
            LOGO_URL: lsLogo,
            ACCUMULATED_DATA_CSV_URL: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSECMgxsfPmi379YPUKLAm2YQyLqx4QiMgRlRMjhW3npIsb0Rav7v7q8lMm_AaLuAs1-WPKmHZYYCIR/pub?gid=169271352&single=true&output=csv',
        },
        '400A': {
            MAIN_TITLE: '400A TCC Analysis',
            LOGO_URL: lsLogo,
            ACCUMULATED_DATA_CSV_URL: '',
        },
        '800A': {
            MAIN_TITLE: '800A TCC Analysis',
            LOGO_URL: lsLogo,
            ACCUMULATED_DATA_CSV_URL: '',
        },
        '규약동작배율': {
            MAIN_TITLE: '규약동작배율',
            LOGO_URL: lsLogo,
            ACCUMULATED_DATA_CSV_URL: '',
        }
    },

    // Default model to load
    DEFAULT_MODEL: '100A'
};

// ExValue Type Config for UI
export const EX_VALUE_CONFIG = Object.keys(DATA_CONFIG.MODELS).reduce((acc, key) => {
    const modelConfig = DATA_CONFIG.MODELS[key];

    acc[key] = {
        id: key,
        name: key,
        description: `Detailed analysis for ${key}`,
        logo: modelConfig.LOGO_URL,
        csvUrl: modelConfig.ACCUMULATED_DATA_CSV_URL
    };
    return acc;
}, {});

export const CHART_CONFIG = {
    title: 'Time-Current Multiple Comparison',
    colors: {
        max: '#ef4444',
        min: '#3b82f6',
    },
    gridColor: '#e5e7eb',
    textColor: '#374151'
};

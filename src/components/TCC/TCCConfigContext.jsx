import React, { createContext, useState, useContext, useMemo } from 'react';
import { DATA_CONFIG } from './TCCConfig';

const ConfigContext = createContext();

export const ConfigProvider = ({ children }) => {
    // State for the currently selected model (32A, 100A, etc.)
    const [currentModel, setCurrentModel] = useState(() => {
        const savedModel = localStorage.getItem('currentTccModel');
        // Fallback to DEFAULT_MODEL if savedModel doesn't exist in MODELS
        return (savedModel && DATA_CONFIG.MODELS[savedModel]) ? savedModel : DATA_CONFIG.DEFAULT_MODEL;
    });

    const [isLoading] = useState(false);

    // Construct the current configuration object
    const modelConfig = DATA_CONFIG.MODELS[currentModel];
    const commonConfig = DATA_CONFIG.COMMON;

    const switchModel = (model) => {
        if (DATA_CONFIG.MODELS[model]) {
            setCurrentModel(model);
            localStorage.setItem('currentTccModel', model);
        }
    };

    const configValue = useMemo(() => ({
        currentModel,
        availableModels: Object.keys(DATA_CONFIG.MODELS),

        // Common
        tccSymbols: commonConfig.TCC_SYMBOLS,
        refreshInterval: commonConfig.REFRESH_INTERVAL,
        maxDisplayRows: commonConfig.MAX_DISPLAY_ROWS,
        tableHeight: commonConfig.TABLE_HEIGHT,

        // Model Specific
        mainTitle: modelConfig.MAIN_TITLE,
        logoUrl: modelConfig.LOGO_URL,
        accumulatedDataUrl: modelConfig.ACCUMULATED_DATA_CSV_URL,

        switchModel,
    }), [currentModel]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-black text-green-500 font-mono">
                LOADING TCC CONFIGURATION...
            </div>
        );
    }

    return (
        <ConfigContext.Provider value={configValue}>
            {children}
        </ConfigContext.Provider>
    );
};

export const useConfig = () => {
    const context = useContext(ConfigContext);
    if (context === undefined) {
        throw new Error('useConfig must be used within a ConfigProvider');
    }
    return context;
};

import React from 'react';
import { ConfigProvider, useConfig } from './TCCConfigContext';
import TCCDetail from './TCCDetail';

const TCCPageContent = () => {
    console.log("TCCPageContent rendering");
    const { currentModel } = useConfig();
    return <TCCDetail symbol={currentModel} />;
};

const TCCPage = () => {
    console.log("TCCPage rendering");
    return (
        <ConfigProvider>
            <TCCPageContent />
        </ConfigProvider>
    );
};

export default TCCPage;

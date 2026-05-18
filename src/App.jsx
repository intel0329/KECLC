import React, { useEffect } from 'react';
import { Routes, Route, useParams } from 'react-router-dom';
import { Header } from './components/Header';
import PanelLoadContent from './components/PanelLoad/index';
import PowerLoadContent from './components/PowerLoad/index';
import PanelFeederContent from './components/PanelFeeder';
import DataViewer from './components/DataViewer';
import SettingPage from './components/SettingPage';
import ProjectList from './components/ProjectList';
import ProjectSetup from './components/ProjectSetup';
import ProjectDashboard from './components/ProjectDashboard';
import MCCPage from './components/MCCPage';
import TCCPage from './components/TCC';
import Transformer from './components/Transformer';
import ElectricalReceivingCapacity from './components/ElectricalReceivingCapacity';
import Generator from './components/Generator';
import CubiclePage from './components/cubicle/CubiclePage';
import Visual from './components/Visual';
import VisualBand from './components/VisualBand';
import SyncStatusIndicator from './components/SyncStatusIndicator';
import useDataStore from './store/useDataStore';
import UPS from './components/UPS';
import LowVoltageReceivingCapacity from './components/LowVoltageReceivingCapacity';



const PanelLoadWrapper = () => {
    const params = useParams();
    return <PanelLoadContent key={params.panelId || 'default'} />;
};

const PowerLoadWrapper = () => {
    const params = useParams();
    return <PowerLoadContent key={params.panelId || 'default'} />;
};

const PanelFeederWrapper = () => {
    const params = useParams();
    return <PanelFeederContent key={params.panelId || 'default'} />;
};

const TransformerWrapper = () => {
    const params = useParams();
    const panelId = params.panelId || '';
    if (panelId.startsWith('transformer-main-') || panelId.includes('-main-')) {
        return <ElectricalReceivingCapacity key={panelId} />;
    }
    return <Transformer key={panelId} />;
};

const ElectricalReceivingCapacityWrapper = () => {
    const params = useParams();
    return <ElectricalReceivingCapacity key={params.panelId || 'default'} />;
};

const GeneratorWrapper = () => {
    const params = useParams();
    return <Generator key={params.panelId || 'default'} />;
};

const UpsWrapper = () => {
    const params = useParams();
    return <UPS key={params.panelId || 'default'} />;
};

const LowVoltageReceivingCapacityWrapper = () => {
    const params = useParams();
    return <LowVoltageReceivingCapacity key={params.panelId || 'default'} />;
};


function App() {
    // Removed: Session initialization logic that was unintentionally clearing the active project state across tabs.

    return (
        <div className="flex flex-col min-h-screen bg-black text-white">
            <Header />
            <SyncStatusIndicator />
            <main className="flex-grow relative">
                <Routes>
                    {/* 프로젝트 관리 - 메인 홈 */}
                    <Route path="/" element={<ProjectList />} />
                    <Route path="/projects" element={<ProjectList />} />

                    {/* 독립 분전반 부하 계산서 */}
                    <Route path="/panel-load" element={<PanelLoadWrapper />} />
                    <Route path="/project/new" element={<ProjectSetup />} />
                    <Route path="/project/:projectId" element={<ProjectDashboard />} />
                    <Route path="/project/:projectId/panel-load/:panelId" element={<PanelLoadWrapper />} />
                    <Route path="/project/:projectId/power-load/:panelId" element={<PowerLoadWrapper />} />
                    <Route path="/project/:projectId/transformer/:panelId" element={<TransformerWrapper />} />
                    <Route path="/project/:projectId/receiving-capacity/:panelId" element={<ElectricalReceivingCapacityWrapper />} />
                    <Route path="/project/:projectId/generator/:panelId" element={<GeneratorWrapper />} />
                    <Route path="/project/:projectId/panel-feeder/:panelId" element={<PanelFeederWrapper />} />
                    <Route path="/project/:projectId/ups/:panelId" element={<UpsWrapper />} />
                    <Route path="/project/:projectId/low-voltage-receiving/:panelId" element={<LowVoltageReceivingCapacityWrapper />} />


                    <Route path="/project/:projectId/visual/:panelId" element={<Visual />} />

                    {/* 데이터 뷰어 */}
                    <Route path="/xlpe" element={<DataViewer csvFile="XLPE" title="XLPE Insulated Cable" subtitle="XLPE 절연 케이블" />} />
                    <Route path="/cb" element={<DataViewer csvFile="CB" title="Circuit Breaker" />} />
                    <Route path="/ct" element={<DataViewer csvFile="CT" title="CT Standard Specifications Table" />} />
                    <Route path="/od" element={<DataViewer csvFile="OD" title="Cable detailed" />} />
                    <Route path="/rx" element={<DataViewer csvFile="RX" title="Cable Impedance" />} />
                    <Route path="/pl" element={<DataViewer csvFile="PL" title="Panel Layout Dimensions" subtitle="차단기 외형 치수 및 레이아웃" />} />
                    <Route path="/mcc" element={<MCCPage />} />
                    <Route path="/prd" element={<DataViewer csvFile="PRD" title="POWER RECEIVING AND DISTRIBUTION" />} />
                    <Route path="/gen" element={<DataViewer csvFile="GEN" title="Generator Selection Guide" />} />
                    <Route path="/ups" element={<DataViewer csvFile="UPS" title="Uninterruptible Power Supply" />} />
                    <Route path="/pl" element={<DataViewer csvFile="PL" title="Electrical Panelboard Size Table" />} />
                    <Route path="/TCC" element={<TCCPage />} />
                    <Route path="/cubicle" element={<CubiclePage />} />
                    <Route path="/setting" element={<SettingPage />} />
                </Routes>
            </main>
            <VisualBand />
        </div>
    );
}

export default App;


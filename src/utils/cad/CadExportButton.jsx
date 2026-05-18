import React, { useState } from 'react';
import { Download, FileCode, Loader2 } from 'lucide-react';

const CadExportButton = ({ projectInfo, leftCircuits, rightCircuits, panelId, projectId }) => {
    const [isExporting, setIsExporting] = useState(false);

    const handleCadExport = async () => {
        if (isExporting) return;
        setIsExporting(true);

        try {
            // Prepare data for export
            const exportData = {
                projectInfo,
                leftCircuits,
                rightCircuits,
                panelId,
                projectId,
                exportedAt: new Date().toISOString()
            };

            const response = await fetch('/api/cad_export.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(exportData),
            });

            if (!response.ok) {
                throw new Error('CAD 추출 중 오류가 발생했습니다.');
            }

            // Handle file download
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const fileName = `${projectInfo.panelName || 'panel'}_${new Date().toISOString().slice(0, 10)}.dxf`;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

        } catch (error) {
            console.error('CAD Export failed:', error);
            alert(error.message);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <button
            onClick={handleCadExport}
            disabled={isExporting}
            title="CAD (DXF)"
            className="w-10 md:w-[100px] aspect-square md:aspect-auto md:px-3 md:py-2 bg-blue-700 hover:bg-blue-600 text-white text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center md:gap-2 border border-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
            {isExporting ? (
                <Loader2 size={14} className="animate-spin" />
            ) : (
                <FileCode size={14} />
            )}
            <span className="hidden md:inline">{isExporting ? 'Exporting...' : 'CAD'}</span>
        </button>
    );
};

export default CadExportButton;

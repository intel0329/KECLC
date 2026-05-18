
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export const exportToPDF = async (elementRef, fileName) => {
    if (!elementRef.current) return;

    try {
        const element = elementRef.current;

        // Apply temporary print-friendly styles
        const originalStyles = [];
        const allElements = element.querySelectorAll('*');

        // Store original styles and apply print styles
        allElements.forEach((el, i) => {
            originalStyles[i] = {
                backgroundColor: el.style.backgroundColor,
                color: el.style.color,
                borderColor: el.style.borderColor
            };
        });

        // Add temporary class for print mode
        element.classList.add('print-mode');

        // Create a style element for print mode
        const printStyle = document.createElement('style');
        printStyle.id = 'pdf-print-style';
        printStyle.innerHTML = `
            .print-mode, .print-mode * {
                background-color: white !important;
                background: white !important;
                color: black !important;
                border-color: #333 !important;
            }
            .print-mode .text-green-500, .print-mode .text-green-400 { color: #16a34a !important; }
            .print-mode .text-red-500, .print-mode .text-red-400 { color: #dc2626 !important; }
            .print-mode .text-orange-500, .print-mode .text-orange-400 { color: #ea580c !important; }
            .print-mode .text-yellow-400 { color: #ca8a04 !important; }
            .print-mode .text-blue-400 { color: #2563eb !important; }
            .print-mode .text-sky-400 { color: #0284c7 !important; }
        `;
        document.head.appendChild(printStyle);

        const canvas = await html2canvas(element, {
            scale: 2,
            backgroundColor: '#FFFFFF',
            useCORS: true,
            logging: false,
            windowWidth: element.scrollWidth,
            windowHeight: element.scrollHeight
        });

        // Restore original styles
        element.classList.remove('print-mode');
        document.getElementById('pdf-print-style')?.remove();

        const imgData = canvas.toDataURL('image/png');

        // A4 Landscape size in mm
        const pdfWidth = 297;
        const pdfHeight = 210;

        const pdf = new jsPDF('l', 'mm', 'a4');

        const imgProps = pdf.getImageProperties(imgData);
        const imgWidth = pdfWidth;
        const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
        pdf.save(`${fileName}.pdf`);

    } catch (error) {
        console.error('PDF Export Failed:', error);
        // Cleanup on error
        document.getElementById('pdf-print-style')?.remove();
        alert('PDF 내보내기에 실패했습니다.');
    }
};

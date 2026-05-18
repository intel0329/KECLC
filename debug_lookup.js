
import { getProject } from './src/services/projectService.js';
import { usePanelLookup } from './src/hooks/usePanelLookup.js';

async function debugLookup(projectId) {
    const project = await getProject(projectId);
    console.log("Project Name:", project.name);
    
    // Simulate usePanelLookup's extractPanels
    const result = [];
    const traverse = (items, parentPath = '', inheritedType = 'unknown') => {
        if (!items) return;
        items.forEach(item => {
            const currentType = item.type || inheritedType;
            if (item.id && item.name) {
                result.push({
                    id: item.id,
                    name: item.name,
                    type: currentType
                });
            }
            if (item.children) {
                traverse(item.children, item.name, currentType);
            }
        });
    };

    if (project.calculators) {
        project.calculators.forEach(calc => {
            // Check if calc itself should be included?
            if (calc.id && calc.name) {
                console.log("Root Calculator Found:", calc.name, "(", calc.id, ")");
            }
            if (calc.children) {
                traverse(calc.children, calc.name || calc.id, calc.id);
            }
        });
    }

    console.log("Extracted Panels Count:", result.length);
    result.slice(0, 10).forEach(p => console.log(` - ${p.name} (${p.id}) type: ${p.type}`));
}

// In a real environment, I can't run this easily because of imports/DOM context.
// But I can infer from the code.

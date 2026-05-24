<?php
/**
 * Projects API
 * Rewritten for Centralized Panel Management (RDB structure)
 */
require_once 'db.php';

$method = $_SERVER['REQUEST_METHOD'];

function buildCalculatorsTree($pdo, $projectId) {
    // 1. Fetch all panels for this project
    $stmt = $pdo->prepare("SELECT id, type, name, order_idx FROM panels WHERE project_id = ? ORDER BY order_idx ASC");
    $stmt->execute([$projectId]);
    $panels = $stmt->fetchAll();
    
    // Group panels by type
    $panelsByType = [];
    foreach ($panels as $p) {
        $panelsByType[$p['type']][] = [
            'id' => $p['id'],
            'name' => $p['name'],
            'type' => $p['type']
        ];
    }
    
    // Build the default static tree structure, injecting children where appropriate
    return [
        [ 'id' => 'visual', 'name' => '비주얼라이제이션', 'type' => 'multiple', 'enabled' => true, 'children' => $panelsByType['visual'] ?? [] ],
        [ 'id' => 'transformer', 'name' => '변압기 용량 계산서', 'type' => 'multiple', 'enabled' => (!empty($panelsByType['transformer']) || !empty($panelsByType['transformer-main']) || !empty($panelsByType['transformer-root'])), 'children' => array_merge($panelsByType['transformer-main'] ?? [], $panelsByType['transformer'] ?? []) ],
        [ 'id' => 'low-voltage-receiving', 'name' => '저압 수전 용량 계산서', 'type' => 'multiple', 'enabled' => (!empty($panelsByType['low-voltage-receiving']) || !empty($panelsByType['low-voltage-receiving-root'])), 'children' => $panelsByType['low-voltage-receiving'] ?? [] ],
        [ 'id' => 'generator_' . $projectId, 'name' => '발전기 용량 계산서', 'type' => 'single', 'enabled' => !empty($panelsByType['generator']) ],
        [ 'id' => 'panel-feeder_' . $projectId, 'name' => '분전반 간선 계산서', 'type' => 'single', 'enabled' => !empty($panelsByType['panel-feeder']) ],
        [ 'id' => 'panel-load', 'name' => '분전반 부하 계산서', 'type' => 'multiple', 'enabled' => (!empty($panelsByType['panel-load']) || !empty($panelsByType['panel-load-root'])), 'children' => $panelsByType['panel-load'] ?? [] ],
        [ 'id' => 'ups', 'name' => 'UPS 용량 계산서', 'type' => 'multiple', 'enabled' => (!empty($panelsByType['ups']) || !empty($panelsByType['ups-root'])), 'children' => $panelsByType['ups'] ?? [] ],
        [ 'id' => 'power-load', 'name' => '동력 부하 계산서', 'type' => 'multiple', 'enabled' => (!empty($panelsByType['power-load']) || !empty($panelsByType['power-load-root'])), 'children' => $panelsByType['power-load'] ?? [] ],
        [ 'id' => 'tray_' . $projectId, 'name' => 'TRAY 계산서', 'type' => 'single', 'enabled' => !empty($panelsByType['tray']) ],
    ];
}

switch ($method) {
    case 'GET':
        if (isset($_GET['id'])) {
            $stmt = $pdo->prepare("SELECT * FROM projects WHERE id = ?");
            $stmt->execute([$_GET['id']]);
            $project = $stmt->fetch();
            
            if ($project) {
                $project['calculators'] = buildCalculatorsTree($pdo, $project['id']);
                sendSuccess($project);
            } else {
                sendError("Project not found", 404);
            }
        } else {
            $stmt = $pdo->query("SELECT * FROM projects ORDER BY updated_at DESC");
            $projects = $stmt->fetchAll();
            
            foreach ($projects as &$p) {
                $p['calculators'] = buildCalculatorsTree($pdo, $p['id']);
            }
            sendSuccess($projects);
        }
        break;

    case 'POST':
        // Create or Update
        $data = json_decode(file_get_contents('php://input'), true);
        if (!$data) sendError("Invalid data");

        $id = $data['id'] ?? null;
        $name = $data['name'] ?? '새 프로젝트';
        $client = $data['client'] ?? '';
        $date = $data['date'] ?? null;
        $description = $data['description'] ?? '';
        $calculators = $data['calculators'] ?? []; // Legacy array

        try {
            $pdo->beginTransaction();

            if ($id) {
                $stmt = $pdo->prepare("SELECT id FROM projects WHERE id = ?");
                $stmt->execute([$id]);
                $exists = $stmt->fetch();

                if ($exists) {
                    $stmt = $pdo->prepare("UPDATE projects SET name = ?, client = ?, date = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
                    $stmt->execute([$name, $client, $date, $description, $id]);
                } else {
                    $stmt = $pdo->prepare("INSERT INTO projects (id, name, client, date, description) VALUES (?, ?, ?, ?, ?)");
                    $stmt->execute([$id, $name, $client, $date, $description]);
                }
            } else {
                $id = 'project-' . round(microtime(true) * 1000);
                $stmt = $pdo->prepare("INSERT INTO projects (id, name, client, date, description) VALUES (?, ?, ?, ?, ?)");
                $stmt->execute([$id, $name, $client, $date, $description]);
            }

            // Sync panels based on the passed calculators array
            // This allows the frontend to continue using 'addPanelToProject' via project updates
            // First, get all existing panel IDs for this project to handle deletions
            $stmt = $pdo->prepare("SELECT id FROM panels WHERE project_id = ?");
            $stmt->execute([$id]);
            $existing_panel_ids = $stmt->fetchAll(PDO::FETCH_COLUMN);
            $new_panel_ids = [];

            foreach ($calculators as $calc) {
                // The client might send the base ID ('panel-feeder') or the full ID ('panel-feeder_project-xxx')
                // Strip the suffix to securely get the base type
                $type = explode('_', $calc['id'])[0]; 
                
                // Only process enabled calculators
                if (!isset($calc['enabled']) || !$calc['enabled']) continue;

                if ($calc['type'] === 'multiple' && isset($calc['children'])) {
                    foreach ($calc['children'] as $idx => $child) {
                        $panelId = $child['id'];
                        $panelName = $child['name'];
                        $new_panel_ids[] = $panelId;
                        
                        // [NEW] Intelligent type detection from panel ID prefix
                        // If ID starts with transformer-main-, it MUST be stored as transformer-main type
                        $childType = $type;
                        if ($type === 'transformer' && strpos($panelId, 'transformer-main-') === 0) {
                            $childType = 'transformer-main';
                        }
                        
                        // Insert or update panel
                        $stmt = $pdo->prepare("INSERT INTO panels (id, project_id, type, name, order_idx) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE type = VALUES(type), name = VALUES(name), order_idx = VALUES(order_idx)");
                        $stmt->execute([$panelId, $id, $childType, $panelName, $idx]);
                    }
                    
                    // Always ensure a root marker exists for enabled multiple-type calculators 
                    // to persist the 'enabled' state even when no children exist.
                    $rootMarkerId = $type . '-root_' . $id;
                    $new_panel_ids[] = $rootMarkerId;
                    $stmt = $pdo->prepare("INSERT IGNORE INTO panels (id, project_id, type, name, order_idx) VALUES (?, ?, ?, ?, ?)");
                    $stmt->execute([$rootMarkerId, $id, $type . '-root', 'ROOT_MARKER', -1]);
                } else if ($calc['type'] === 'single') {
                    // For single type panels, the panel ID must be unique per project
                    $panelId = $type . '_' . $id; 
                    $panelName = $calc['name'];
                    $new_panel_ids[] = $panelId;
                    
                    // Insert or update panel
                    $stmt = $pdo->prepare("INSERT INTO panels (id, project_id, type, name, order_idx) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), order_idx = VALUES(order_idx)");
                    $stmt->execute([$panelId, $id, $type, $panelName, 0]);
                }
            }

            // Delete panels that were removed from the array
            $panels_to_delete = array_diff($existing_panel_ids, $new_panel_ids);
            if (!empty($panels_to_delete)) {
                $placeholders = implode(',', array_fill(0, count($panels_to_delete), '?'));
                
                // 1) First delete from panel_connections where parent_panel_id IN (...) OR child_panel_id IN (...)
                $stmt = $pdo->prepare("DELETE FROM panel_connections WHERE project_id = ? AND (parent_panel_id IN ($placeholders) OR child_panel_id IN ($placeholders))");
                $stmt->execute(array_merge([$id], $panels_to_delete, $panels_to_delete));
                
                // 2) Then delete from panels
                $stmt = $pdo->prepare("DELETE FROM panels WHERE project_id = ? AND id IN ($placeholders)");
                $stmt->execute(array_merge([$id], $panels_to_delete));
            }

            $pdo->commit();

            // Return the updated project
            $stmt = $pdo->prepare("SELECT * FROM projects WHERE id = ?");
            $stmt->execute([$id]);
            $project = $stmt->fetch();
            $project['calculators'] = buildCalculatorsTree($pdo, $id);
            sendSuccess($project);
        } catch (Exception $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            sendError("Database error during project save: " . $e->getMessage(), 500);
        }
        break;

    case 'DELETE':
        if (!isset($_GET['id'])) sendError("ID required");
        // Cascades to panels, panel_data, and panel_connections
        $stmt = $pdo->prepare("DELETE FROM projects WHERE id = ?");
        $stmt->execute([$_GET['id']]);
        sendSuccess(["id" => $_GET['id']]);
        break;

    default:
        sendError("Method not allowed", 405);
}
?>

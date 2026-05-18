<?php
/**
 * Project Data API
 * Handles saving individual calculator states to `panel_data` 
 * and global configurations to `global_settings`
 */
require_once 'db.php';

$method = $_SERVER['REQUEST_METHOD'];

function parseKey($keyName) {
    // [Phase 2] panel-feeder now exists in panels table, so it should use panel_data for Draft/TTL support.
    // Removed legacy special case.

    if (strpos($keyName, 'kelc_panel_draft_') === 0) {
        return ['is_panel' => true, 'id' => str_replace('kelc_panel_draft_', '', $keyName), 'is_draft' => 1];
    } else if (strpos($keyName, 'kelc_panel_data_') === 0) {
        return ['is_panel' => true, 'id' => str_replace('kelc_panel_data_', '', $keyName), 'is_draft' => 0];
    }
    return ['is_panel' => false];
}

switch ($method) {
    case 'GET':
        if (!isset($_GET['key_name'])) sendError("key_name required");
        $keyName = $_GET['key_name'];
        $parsed = parseKey($keyName);

        if ($parsed['is_panel']) {
            $stmt = $pdo->prepare("SELECT data_json FROM panel_data WHERE panel_id = ? AND is_draft = ?");
            $stmt->execute([$parsed['id'], $parsed['is_draft']]);
            $data = $stmt->fetch();
        } else {
            // Include project_id in global settings query if provided to keep it scoped
            $projectId = $_GET['project_id'] ?? null;
            if ($projectId) {
                // We use a composite key approach for global settings if needed, 
                // but for now, we'll use the unique key_name which includes the panelId/projectId intent.
                $stmt = $pdo->prepare("SELECT data_json FROM global_settings WHERE key_name = ?");
                $stmt->execute([$keyName]);
            } else {
                $stmt = $pdo->prepare("SELECT data_json FROM global_settings WHERE key_name = ?");
                $stmt->execute([$keyName]);
            }
            $data = $stmt->fetch();
        }

        if ($data) {
            sendSuccess(json_decode($data['data_json'], true));
        } else {
            sendSuccess(null);
        }
        break;

    case 'POST':
        $body = json_decode(file_get_contents('php://input'), true);
        if (!$body || !isset($body['key_name'])) sendError("Invalid data or key_name missing");

        $keyName = $body['key_name'];
        $dataJson = json_encode($body['data'] ?? []);
        $parsed = parseKey($keyName);

        try {
            // [Phase 2] TTL Policy: Delete drafts older than 6 hours
            $pdo->exec("DELETE FROM panel_data WHERE is_draft = 1 AND updated_at < DATE_SUB(NOW(), INTERVAL 6 HOUR)");
            
            if ($parsed['is_panel']) {
                // Ensure panel exists first, otherwise foreign key fails.
                $stmt = $pdo->prepare("SELECT project_id FROM panels WHERE id = ?");
                $stmt->execute([$parsed['id']]);
                $panel = $stmt->fetch();
                if (!$panel) {
                    sendError("Panel ID {$parsed['id']} does not exist in the panels table.", 404);
                }

                $stmt = $pdo->prepare("INSERT INTO panel_data (panel_id, is_draft, data_json) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE data_json = VALUES(data_json), updated_at = CURRENT_TIMESTAMP");
                $stmt->execute([$parsed['id'], $parsed['is_draft'], $dataJson]);

                // Update project updated_at status
                $stmt = $pdo->prepare("UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?");
                $stmt->execute([$panel['project_id']]);
            } else {
                $stmt = $pdo->prepare("INSERT INTO global_settings (key_name, data_json) VALUES (?, ?) ON DUPLICATE KEY UPDATE data_json = VALUES(data_json), updated_at = CURRENT_TIMESTAMP");
                $stmt->execute([$keyName, $dataJson]);

                // If project_id is provided in the body, update its updated_at
                $projectId = $body['project_id'] ?? null;
                if ($projectId) {
                    $stmt = $pdo->prepare("UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?");
                    $stmt->execute([$projectId]);
                }
            }
            sendSuccess(["key_name" => $keyName]);
        } catch (Exception $e) {
            sendError("Database error: " . $e->getMessage(), 500);
        }
        break;

    case 'DELETE':
        if (!isset($_GET['key_name'])) sendError("key_name required");
        
        $keyName = $_GET['key_name'];
        $parsed = parseKey($keyName);

        if ($parsed['is_panel']) {
            $stmt = $pdo->prepare("DELETE FROM panel_data WHERE panel_id = ? AND is_draft = ?");
            $stmt->execute([$parsed['id'], $parsed['is_draft']]);
        } else {
            $stmt = $pdo->prepare("DELETE FROM global_settings WHERE key_name = ?");
            $stmt->execute([$keyName]);
        }
        sendSuccess(["key_name" => $keyName]);
        break;

    default:
        sendError("Method not allowed", 405);
}
?>

<?php
/**
 * Panel Connections API
 * Manages parent/child relationships.
 */
require_once 'db.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $projectId = $_GET['project_id'] ?? null;
        if (!$projectId) sendError("project_id required");

        $stmt = $pdo->prepare("SELECT * FROM panel_connections WHERE project_id = ?");
        $stmt->execute([$projectId]);
        sendSuccess($stmt->fetchAll());
        break;

    case 'POST':
        $data = json_decode(file_get_contents('php://input'), true);
        if (!$data || !isset($data['project_id']) || !isset($data['connections'])) {
            sendError("Invalid payload. Need project_id and connections array.");
        }

        $projectId = $data['project_id'];
        $connections = $data['connections']; // Array of { parent_panel_id, child_panel_id }

        try {
            $pdo->beginTransaction();

            // To sync, we delete existing connections for this project and insert the new ones.
            // Wait, this might be dangerous if we only post partial connections.
            // Better to handle connections per parent or per project?
            // If the frontend maintains the full state of a parent, we can just sync per parent.
            if (isset($data['parent_panel_id'])) {
                $parentId = $data['parent_panel_id'];
                
                // Only replace connections for THIS parent
                $stmt = $pdo->prepare("DELETE FROM panel_connections WHERE project_id = ? AND parent_panel_id = ?");
                $stmt->execute([$projectId, $parentId]);

                $stmt = $pdo->prepare("INSERT INTO panel_connections (project_id, parent_panel_id, child_panel_id) VALUES (?, ?, ?)");
                foreach ($connections as $conn) {
                    $stmt->execute([$projectId, $parentId, $conn['child_panel_id']]);
                }
            } else {
                // If no specific parent is passed, we assume a full project replacement.
                $stmt = $pdo->prepare("DELETE FROM panel_connections WHERE project_id = ?");
                $stmt->execute([$projectId]);

                $stmt = $pdo->prepare("INSERT IGNORE INTO panel_connections (project_id, parent_panel_id, child_panel_id) VALUES (?, ?, ?)");
                foreach ($connections as $conn) {
                    $stmt->execute([$projectId, $conn['parent_panel_id'], $conn['child_panel_id']]);
                }
            }

            $pdo->commit();
            sendSuccess(["status" => "synced"]);
        } catch (Exception $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            sendError("Database error: " . $e->getMessage(), 500);
        }
        break;

    default:
        sendError("Method not allowed", 405);
}
?>

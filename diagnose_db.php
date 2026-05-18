<?php
require_once 'api/db.php';

try {
    echo "--- Database Diagnosis ---\n";
    
    // Check project_data indexes
    $stmt = $pdo->query("SHOW INDEX FROM project_data");
    $indexes = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "Indexes on project_data:\n";
    foreach ($indexes as $index) {
        echo "- " . $index['Key_name'] . " (Column: " . $index['Column_name'] . ", Unique: " . ($index['Non_unique'] == 0 ? 'Yes' : 'No') . ")\n";
    }
    
    // Check if GLOBAL project exists
    $stmt = $pdo->query("SELECT id, name FROM projects WHERE id = 'GLOBAL'");
    $global = $stmt->fetch(PDO::FETCH_ASSOC);
    echo "\nGLOBAL Project record: " . ($global ? "Exists (" . $global['name'] . ")" : "MISSING") . "\n";
    
    // Sample record test
    $stmt = $pdo->query("SELECT project_id, key_name FROM project_data LIMIT 5");
    $samples = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo "\nSample records (Top 5):\n";
    foreach ($samples as $s) {
        echo "- Project: [" . $s['project_id'] . "] Key: [" . $s['key_name'] . "]\n";
    }
    
    echo "\n--- Diagnosis Complete ---\n";

} catch (Exception $e) {
    echo "Diagnosis failed: " . $e->getMessage() . "\n";
}
?>

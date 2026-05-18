<?php
/**
 * User Profile API
 */
require_once 'db.php';

// Ensure upload directory exists
$uploadDir = '../uploads/profiles/';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0777, true);
}

// Auto-create table if missing
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS user_profiles (
        id VARCHAR(50) PRIMARY KEY,
        username VARCHAR(100),
        email VARCHAR(100),
        profile_image TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )");
    
    // Seed default user if empty
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM user_profiles WHERE id = 'default'");
    $stmt->execute();
    if ($stmt->fetchColumn() == 0) {
        $pdo->exec("INSERT INTO user_profiles (id, username) VALUES ('default', 'User')");
    }
} catch (PDOException $e) {
    // Silence error if table already exists or other minor DB issues
}

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $stmt = $pdo->prepare("SELECT * FROM user_profiles WHERE id = 'default'");
        $stmt->execute();
        $user = $stmt->fetch();
        
        if ($user) {
            // Convert path to URL if it exists
            if ($user['profile_image']) {
                $user['profile_image'] = 'uploads/profiles/' . basename($user['profile_image']);
            }
            sendSuccess($user);
        } else {
            sendError("User profile not found", 404);
        }
        break;

    case 'POST':
        // Check if image upload
        if (isset($_FILES['profile_image'])) {
            $file = $_FILES['profile_image'];
            $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
            $fileName = 'profile_' . time() . '.' . $ext;
            $targetPath = $uploadDir . $fileName;

            if (move_uploaded_file($file['tmp_name'], $targetPath)) {
                // Update DB with just the filename or partial path
                $stmt = $pdo->prepare("UPDATE user_profiles SET profile_image = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 'default'");
                $stmt->execute([$fileName]);
                
                sendSuccess([
                    "message" => "Profile image updated",
                    "profile_image" => 'uploads/profiles/' . $fileName
                ]);
            } else {
                sendError("Failed to save uploaded file");
            }
        } 
        // Handle normal profile data update
        else {
            $data = json_decode(file_get_contents('php://input'), true);
            if (!$data) sendError("Invalid data");

            $username = $data['username'] ?? 'User';
            $email = $data['email'] ?? '';

            $stmt = $pdo->prepare("UPDATE user_profiles SET username = ?, email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 'default'");
            $stmt->execute([$username, $email]);
            
            sendSuccess(["message" => "Profile updated"]);
        }
        break;

    default:
        sendError("Method not allowed", 405);
}
?>

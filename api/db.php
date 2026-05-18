<?php
/**
 * Database Connection Configuration
 */

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$host = 'localhost';
$dbname = 'keclc_db';
$username = 'root'; // XAMPP default
$password = '';     // XAMPP default

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Connection failed: " . $e->getMessage()]);
    exit();
}

/**
 * Handle errors consistently
 */
function sendError($message, $code = 400) {
    http_response_code($code);
    echo json_encode(["status" => "error", "message" => $message]);
    exit();
}

/**
 * Handle success consistently
 */
function sendSuccess($data = null) {
    echo json_encode(["status" => "success", "data" => $data]);
    exit();
}
?>

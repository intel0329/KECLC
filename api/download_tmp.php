<?php
/**
 * Simple helper to download temporary files
 */
$file = $_GET['file'] ?? '';
if (!$file || !preg_match('/^Merged_[a-f0-9]+\.dxf$/', $file)) {
    die("Invalid file");
}

$path = realpath(__DIR__ . '/../temp/' . $file);
$download_name = $_GET['name'] ?? 'Combined_CAD_Export.dxf';

if ($path && file_exists($path)) {
    header('Content-Type: application/octet-stream');
    header('Content-Disposition: attachment; filename="' . $download_name . '"');
    header('Content-Length: ' . filesize($path));
    readfile($path);
    // Delete after download
    unlink($path);
    exit;
} else {
    die("File not found");
}
?>

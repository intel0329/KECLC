<?php
// 에러 출력 비활성화 (운영용)
ini_set('display_errors', 0);
error_reporting(0);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

$input = file_get_contents('php://input');
if (!$input) {
    echo json_encode(['error' => 'No data received']);
    exit;
}

$data = json_decode($input, true);

// 임시 디렉토리 설정
$tmp_dir = __DIR__ . '/../temp';
if (!is_dir($tmp_dir)) {
    mkdir($tmp_dir, 0777, true);
}

$unique_id = uniqid();
$json_file = $tmp_dir . '/data_' . $unique_id . '.json';
file_put_contents($json_file, $input);

// 파이썬 스크립트 경로
$python_script = __DIR__ . '/../src/utils/cad/generate_dxf.py';

// 환경별 파이썬 실행 명령어 설정 (집, 회사, 시놀로지 대응)
if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
    // 후보 경로 리스트
    $home_path = 'C:\\Users\\intel\\AppData\\Local\\Programs\\Python\\Python313\\python.exe';
    $office_path = 'C:\\Users\\장재균\\AppData\\Local\\Programs\\Python\\Python313\\python.exe';

    if (file_exists($home_path)) {
        $python_cmd = '"' . $home_path . '"';
    } elseif (file_exists($office_path)) {
        $python_cmd = '"' . $office_path . '"';
    } else {
        // 후보 경로에 없으면 환경 변수에 등록된 기본 python 명령 사용
        $python_cmd = 'python';
    }
} else {
    // 시놀로지 NAS / 리눅스 환경
    $python_cmd = 'python3';
}

// 파이썬 실행
$command = "$python_cmd " . escapeshellarg($python_script) . " " . escapeshellarg($json_file) . " 2>&1";
$output = shell_exec($command);

// 결과 확인
$output = trim($output);
if ($output && !str_contains($output, 'Error') && !str_contains($output, 'Traceback') && !str_contains($output, 'not recognized')) {
    $dxf_file = __DIR__ . '/../' . $output;
    
    if (file_exists($dxf_file)) {
        header('Content-Description: File Transfer');
        header('Content-Type: application/octet-stream');
        $download_name = ($data['projectInfo']['panelName'] ?? 'panel') . '.dxf';
        header('Content-Disposition: attachment; filename="' . $download_name . '"');
        header('Content-Length: ' . filesize($dxf_file));
        readfile($dxf_file);
        
        unlink($json_file);
        unlink($dxf_file);
        exit;
    }
}

// 실패 시 상세 정보 반환
http_response_code(500);
echo json_encode([
    'error' => 'DXF generation failed',
    'python_output' => $output,
    'command' => $command
]);

if (file_exists($json_file)) {
    unlink($json_file);
}

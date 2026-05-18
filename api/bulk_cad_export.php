<?php
/**
 * Bulk CAD Export with Real-time Progress (SSE)
 */
require_once 'db.php';
@ini_set('zlib.output_compression', 0);
@ini_set('implicit_flush', 1);

// SSE를 위해 Content-Type 재설정
header('Content-Type: text/event-stream');
header('Cache-Control: no-cache');
header('Connection: keep-alive');
header('X-Accel-Buffering: no'); 

// 세션 종료 방지 및 시간 제한 해제
set_time_limit(0);
if (ob_get_level()) ob_end_clean(); 

function send_progress($message, $type = 'info', $progress = null, $data = null) {
    $msg = json_encode([
        'message' => $message,
        'type' => $type,
        'progress' => $progress,
        'data' => $data
    ]);
    echo "data: $msg\n\n";
    flush();
}

$project_id = $_GET['projectId'] ?? '';
if (!$project_id) {
    send_progress("Project ID is missing", "error");
    exit;
}

require_once 'db.php';

// 1. 프로젝트에 속한 모든 분전반 부하 계산서(panel-load) 조회
try {
    // Draft(1)을 우선적으로 가져오기 위해 is_draft DESC 정렬
    $stmt = $pdo->prepare("
        SELECT p.id as panel_id, p.name, pd.data_json, pd.is_draft 
        FROM panels p
        JOIN panel_data pd ON p.id = pd.panel_id
        WHERE p.project_id = ? AND p.type = 'panel-load'
        ORDER BY p.id, pd.is_draft DESC
    ");
    $stmt->execute([$project_id]);
    $raw_panels = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // 각 패널별로 가장 최신(Draft가 있으면 Draft, 없으면 Saved) 하나만 선택
    $panels = [];
    $processed_ids = [];
    foreach ($raw_panels as $rp) {
        if (!in_array($rp['panel_id'], $processed_ids)) {
            $panels[] = $rp;
            $processed_ids[] = $rp['panel_id'];
        }
    }
} catch (Exception $e) {
    send_progress("DB Error: " . $e->getMessage(), "error");
    exit;
}

$total = count($panels);
if ($total === 0) {
    send_progress("내보낼 수 있는 '저장된' 분전반 계산서가 없습니다. (먼저 각 계산서에서 [저장] 버튼을 눌러주세요)", "error");
    exit;
}

send_progress("총 {$total}개의 계산서를 DB에서 확인했습니다. 생성을 시작합니다.", "success", 5);

// 임시 디렉토리 설정
$tmp_parent = realpath(__DIR__ . '/../temp');
$unique_id = uniqid();
$tmp_dir = $tmp_parent . DIRECTORY_SEPARATOR . 'bulk_' . $unique_id;
if (!is_dir($tmp_dir)) mkdir($tmp_dir, 0777, true);

// 파이썬 실행 경로
if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
    $home_path = 'C:\\Users\\intel\\AppData\\Local\\Programs\\Python\\Python313\\python.exe';
    $office_path = 'C:\\Users\\장재균\\AppData\\Local\\Programs\\Python\\Python313\\python.exe';
    $python_cmd = file_exists($home_path) ? '"' . $home_path . '"' : (file_exists($office_path) ? '"' . $office_path . '"' : 'python');
} else {
    $python_cmd = 'python3';
}

$gen_script = realpath(__DIR__ . '/../src/utils/cad/generate_dxf.py');
$merge_script = realpath(__DIR__ . '/../src/utils/cad/merge_dxf_files.py');
chdir(__DIR__ . '/../');

// 1.5. 패널 ID -> 이름 매핑 데이터 준비 (SOURCE 필드 변환용)
$panelNameMap = [];
try {
    $stmtMap = $pdo->prepare("SELECT id, name FROM panels WHERE project_id = ?");
    $stmtMap->execute([$project_id]);
    $all_panels = $stmtMap->fetchAll(PDO::FETCH_ASSOC);
    foreach ($all_panels as $ap) {
        $panelNameMap[$ap['id']] = $ap['name'];
    }
} catch (Exception $e) {
    // 매핑 실패해도 중단은 하지 않음
}

$generated_files = [];

// 2. 순차적 도면 생성
foreach ($panels as $idx => $p) {
    $current_num = $idx + 1;
    $panel_name = $p['name'];
    send_progress("[{$current_num}/{$total}] {$panel_name} 생성 중...", "info", 5 + ($idx / $total * 75));
    
    // [HEALING] JSON 데이터 가공: fromId를 sourceName으로 변환 (CAD 도면 표시용)
    $data = json_decode($p['data_json'], true);
    if ($data && isset($data['projectInfo'])) {
        $fromId = $data['projectInfo']['fromId'] ?? '';
        if ($fromId && isset($panelNameMap[$fromId])) {
            $data['projectInfo']['sourceName'] = $panelNameMap[$fromId];
        }
    }
    
    $temp_json = $tmp_dir . DIRECTORY_SEPARATOR . uniqid() . '.json';
    file_put_contents($temp_json, json_encode($data));
    
    $output = shell_exec("$python_cmd " . escapeshellarg($gen_script) . " " . escapeshellarg($temp_json) . " 2>&1");
    $lines = explode("\n", trim($output));
    $dxf_rel_path = trim(end($lines));
    $dxf_abs_path = __DIR__ . '/../' . $dxf_rel_path;
    
    if (file_exists($dxf_abs_path)) {
        $generated_files[] = $dxf_abs_path;
        send_progress("{$panel_name} 완료!", "success");
    } else {
        send_progress("{$panel_name} 실패: " . substr($output, -100), "error");
    }
    @unlink($temp_json);
}

if (empty($generated_files)) {
    send_progress("생성된 도면이 없습니다.", "error");
    exit;
}

// 3. 통합 (Merge)
send_progress("모든 도면 통합 작업 시작...", "info", 85);
$merge_json = $tmp_dir . DIRECTORY_SEPARATOR . 'merge_config.json';
$master_dxf_rel = 'temp/Merged_' . $unique_id . '.dxf';
$master_dxf_abs = __DIR__ . '/../' . $master_dxf_rel;

file_put_contents($merge_json, json_encode([
    'files' => $generated_files,
    'output' => $master_dxf_rel,
    'spacing' => 15000
]));

$merge_output = shell_exec("$python_cmd " . escapeshellarg($merge_script) . " " . escapeshellarg($merge_json) . " 2>&1");

if (file_exists($master_dxf_abs)) {
    // 임시 파일 정리
    @unlink($merge_json);
    foreach ($generated_files as $f) @unlink($f);
    rmdir($tmp_dir);
    
    // 최종 결과 URL 전송 (클라이언트에서 이를 보고 다운로드 트리거)
    $project_name_str = $_GET['projectName'] ?? 'Combined';
    $download_name = $project_name_str . '_분전반 결선도.dxf';
    send_progress("모든 작업 완료!", "success", 100, [
        'download_url' => '/api/download_tmp.php?file=' . basename($master_dxf_rel) . '&name=' . urlencode($download_name),
        'filename' => $download_name
    ]);
} else {
    send_progress("통합 실패: $merge_output", "error");
}
?>

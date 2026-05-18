<?php
// update_db.php

$dataSources = [
    'XLPE' => 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTp4X_BQoTa--JuRHVpsewIGW2IE57RNVoctPqa1cURG1NZ65MUgudF94xuv3GyMTwTrYlJkmsd05_j/pub?gid=1570383382&single=true&output=csv',
    'CB' => 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTp4X_BQoTa--JuRHVpsewIGW2IE57RNVoctPqa1cURG1NZ65MUgudF94xuv3GyMTwTrYlJkmsd05_j/pub?gid=0&single=true&output=csv',
    'OD' => 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTp4X_BQoTa--JuRHVpsewIGW2IE57RNVoctPqa1cURG1NZ65MUgudF94xuv3GyMTwTrYlJkmsd05_j/pub?gid=1000507755&single=true&output=csv',
    'RX' => 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTp4X_BQoTa--JuRHVpsewIGW2IE57RNVoctPqa1cURG1NZ65MUgudF94xuv3GyMTwTrYlJkmsd05_j/pub?gid=926491920&single=true&output=csv',
    'TRZ' => 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTp4X_BQoTa--JuRHVpsewIGW2IE57RNVoctPqa1cURG1NZ65MUgudF94xuv3GyMTwTrYlJkmsd05_j/pub?gid=790150993&single=true&output=csv',
    'PL' => 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTp4X_BQoTa--JuRHVpsewIGW2IE57RNVoctPqa1cURG1NZ65MUgudF94xuv3GyMTwTrYlJkmsd05_j/pub?gid=2092081241&single=true&output=csv'
];

$dbDir = __DIR__ . '/db';

if (!is_dir($dbDir)) {
    mkdir($dbDir, 0777, true);
}

$results = [];

foreach ($dataSources as $name => $url) {
    $content = file_get_contents($url);
    if ($content !== false) {
        $filePath = $dbDir . '/' . $name . '.csv';
        if (file_put_contents($filePath, $content) !== false) {
            $results[$name] = "Success";
        } else {
            $results[$name] = "Failed to write file";
        }
    } else {
        $results[$name] = "Failed to fetch URL";
    }
}

header('Content-Type: application/json');
echo json_encode($results);
?>

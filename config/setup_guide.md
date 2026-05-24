# KECLC PHP + MariaDB 구축 가이드

이 가이드는 KECLC 웹 애플리케이션을 로컬(XAMPP) 및 시놀로지 NAS(MariaDB + PHP) 환경에 구축하는 방법을 설명합니다.

## 1. 데이터베이스 초기 구축 (MariaDB)

1. **phpMyAdmin 접속**:
   - 로컬: `http://localhost/phpmyadmin`
   - 시놀로지: 웹스테이션/MariaDB 설정 후 phpMyAdmin 패키지 실행
2. **SQL 실행**:
   - 상단 메뉴의 `SQL` 탭을 클릭합니다.
   - `config/database.sql` 파일의 내용을 모두 복사하여 붙여넣습니다.
   - `실행(Go)` 버튼을 눌러 데이터베이스(`keclc_db`)와 테이블을 생성합니다.

## 2. PHP 환경 설정

1. **파일 업로드**:
   - `dist` 폴더 내의 빌드된 결과물과 `api` 폴더를 웹 서버의 루트 폴더(XAMPP의 경우 `htdocs/KECLC`, 시놀로지의 경우 `web/KECLC` 등)에 업로드합니다.
2. **데이터베이스 연결 설정**:
   - `api/db.php` 파일을 열어 데이터베이스 접속 정보를 수정합니다.
   - `$host`, `$dbname`, `$username`, `$password`를 본인의 환경에 맞게 입력하세요.

## 3. 웹페이지 접속

- 브라우저에서 서버 주소로 접속합니다 (예: `http://localhost/KECLC`).
- 이제 모든 데이터는 브라우저의 `localStorage`가 아닌 MariaDB에 안전하게 저장됩니다.

## 4. 시놀로지 특이 사항
- **Web Station**: PHP 8.x 버전 이상을 권장합니다.
- **권한 설정**: PHP 스크립트가 실행될 수 있도록 해당 폴더에 적절한 읽기/쓰기 권한이 있는지 확인하세요.
- **MariaDB 외부 접속**: 필요한 경우 MariaDB 설정에서 외부 접속을 허용해야 할 수도 있습니다.

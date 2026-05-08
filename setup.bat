@echo off
chcp 65001 > nul
echo.
echo =============================================
echo  대부호 서버 환경 설정
echo =============================================
echo.

:: Node.js 설치 확인
node --version > nul 2>&1
if %errorlevel% neq 0 (
  echo [오류] Node.js가 설치되어 있지 않습니다.
  echo.
  echo  https://nodejs.org 에서 LTS 버전을 설치한 뒤 다시 실행하세요.
  echo.
  pause
  exit /b 1
)

:: Node.js 버전 출력
for /f "tokens=*" %%v in ('node --version') do set NODE_VER=%%v
echo  Node.js %NODE_VER% 확인

:: npm 설치 확인
npm --version > nul 2>&1
if %errorlevel% neq 0 (
  echo [오류] npm을 찾을 수 없습니다. Node.js를 다시 설치해주세요.
  pause
  exit /b 1
)

for /f "tokens=*" %%v in ('npm --version') do set NPM_VER=%%v
echo  npm v%NPM_VER% 확인
echo.

:: 의존성 설치
echo  패키지 설치 중...
npm install
if %errorlevel% neq 0 (
  echo.
  echo [오류] npm install 실패. 오류 메시지를 확인하세요.
  pause
  exit /b 1
)

echo.
echo =============================================
echo  설치 완료!
echo =============================================
echo.
echo  서버 실행:  npm start
echo  접속 주소:  http://localhost:3000
echo.
pause

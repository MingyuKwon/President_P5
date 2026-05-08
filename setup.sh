#!/bin/bash
echo ""
echo "============================================="
echo " 대부호 서버 환경 설정"
echo "============================================="
echo ""

# Node.js 설치 확인
if ! command -v node &> /dev/null; then
  echo "[오류] Node.js가 설치되어 있지 않습니다."
  echo ""
  echo " https://nodejs.org 에서 LTS 버전을 설치한 뒤 다시 실행하세요."
  echo " 또는 nvm 사용: https://github.com/nvm-sh/nvm"
  echo ""
  exit 1
fi

NODE_VER=$(node --version)
echo " Node.js $NODE_VER 확인"

# npm 설치 확인
if ! command -v npm &> /dev/null; then
  echo "[오류] npm을 찾을 수 없습니다. Node.js를 다시 설치해주세요."
  exit 1
fi

NPM_VER=$(npm --version)
echo " npm v$NPM_VER 확인"
echo ""

# 의존성 설치
echo " 패키지 설치 중..."
npm install
if [ $? -ne 0 ]; then
  echo ""
  echo "[오류] npm install 실패. 오류 메시지를 확인하세요."
  exit 1
fi

echo ""
echo "============================================="
echo " 설치 완료!"
echo "============================================="
echo ""
echo " 서버 실행:  npm start"
echo " 접속 주소:  http://localhost:3000"
echo ""

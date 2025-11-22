#!/bin/bash

# 백엔드 의존성 설치 스크립트

echo "🚀 백엔드 의존성 설치를 시작합니다..."

# Python 버전 확인
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3가 설치되지 않았습니다."
    exit 1
fi

echo "📦 Python 패키지 설치 중..."
python3 -m pip install --upgrade pip
python3 -m pip install -r requirements.txt

echo ""
echo "✅ 의존성 설치 완료!"
echo ""
echo "다음 단계:"
echo "  1. python3 scripts/setup_mdm.py  # MDM 설정"
echo "  2. python3 main.py               # 서버 실행"


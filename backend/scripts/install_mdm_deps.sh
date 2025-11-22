#!/bin/bash

# MDM 의존성 자동 설치 스크립트

echo "🚀 MDM 의존성 설치를 시작합니다..."

cd "$(dirname "$0")/.."
MDM_REPO="external/motion-diffusion-model"

# 1. CLIP 설치
echo ""
echo "📦 CLIP 설치 중..."
pip install git+https://github.com/openai/CLIP.git || {
    echo "⚠️  CLIP 설치 실패 (계속 진행)"
}

# 2. SMPL 파일 다운로드
echo ""
echo "📥 SMPL 모델 파일 다운로드 중..."
if [ -d "$MDM_REPO" ]; then
    cd "$MDM_REPO"
    if [ -f "prepare/download_smpl_files.sh" ]; then
        bash prepare/download_smpl_files.sh || {
            echo "⚠️  SMPL 파일 다운로드 실패 (계속 진행)"
        }
    else
        echo "⚠️  download_smpl_files.sh를 찾을 수 없습니다"
    fi
    cd ../..
else
    echo "⚠️  MDM 저장소를 찾을 수 없습니다"
fi

# 3. GloVe 다운로드
echo ""
echo "📥 GloVe 임베딩 다운로드 중..."
if [ -d "$MDM_REPO" ]; then
    cd "$MDM_REPO"
    if [ -f "prepare/download_glove.sh" ]; then
        bash prepare/download_glove.sh || {
            echo "⚠️  GloVe 다운로드 실패 (계속 진행)"
        }
    else
        echo "⚠️  download_glove.sh를 찾을 수 없습니다"
    fi
    cd ../..
fi

# 4. spaCy 설치
echo ""
echo "📦 spaCy 설치 중..."
pip install spacy || {
    echo "⚠️  spaCy 설치 실패"
}

echo ""
echo "📥 spaCy 모델 다운로드 중..."
python -m spacy download en_core_web_sm || {
    echo "⚠️  spaCy 모델 다운로드 실패"
}

echo ""
echo "✅ 의존성 설치 완료!"
echo ""
echo "다음 단계:"
echo "  1. python3.12 -c \"from services.mdm_integration import MDM_AVAILABLE; print(MDM_AVAILABLE)\""
echo "  2. 서버 재시작: python3.12 main.py"


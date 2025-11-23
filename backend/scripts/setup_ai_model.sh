#!/bin/bash
# 실제 AI 모델 (MDM) 설정 스크립트

set -e

echo "🚀 실제 AI 모델 설정을 시작합니다..."

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$BASE_DIR"

# 1. PyTorch 설치 확인 및 설치
echo ""
echo "📦 PyTorch 설치 확인 중..."
python3.12 -c "import torch; print(f'✅ PyTorch {torch.__version__} 설치됨')" 2>/dev/null || {
    echo "⚠️  PyTorch가 설치되지 않았습니다. 설치 중..."
    pip3.12 install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
    # GPU가 있으면 CUDA 버전 설치 권장
    # pip3.12 install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
}

# 2. MDM 저장소 클론
echo ""
echo "📥 MDM 저장소 클론 중..."
MDM_REPO_DIR="$BASE_DIR/external/motion-diffusion-model"
if [ ! -d "$MDM_REPO_DIR" ]; then
    mkdir -p "$BASE_DIR/external"
    git clone https://github.com/GuyTevet/motion-diffusion-model.git "$MDM_REPO_DIR"
    echo "✅ MDM 저장소 클론 완료"
else
    echo "✅ MDM 저장소가 이미 존재합니다"
fi

# 3. MDM 의존성 설치
echo ""
echo "📦 MDM 의존성 설치 중..."
cd "$MDM_REPO_DIR"
if [ -f "requirements.txt" ]; then
    pip3.12 install -r requirements.txt
    echo "✅ MDM 의존성 설치 완료"
else
    echo "⚠️  requirements.txt를 찾을 수 없습니다"
fi

# 4. 모델 디렉토리 확인
echo ""
echo "📁 모델 디렉토리 확인 중..."
MODEL_DIR="$BASE_DIR/models/mdm/humanml_trans_enc_512"
mkdir -p "$MODEL_DIR"

MODEL_FILE="$MODEL_DIR/model000475000.pt"
if [ -f "$MODEL_FILE" ]; then
    echo "✅ 모델 파일이 존재합니다: $MODEL_FILE"
else
    echo "⚠️  모델 파일을 찾을 수 없습니다: $MODEL_FILE"
    echo ""
    echo "📥 모델 다운로드 방법:"
    echo "   1. 다음 링크에서 모델을 다운로드하세요:"
    echo "      https://github.com/GuyTevet/motion-diffusion-model#pretrained-models"
    echo ""
    echo "   2. HumanML3D 모델을 다운로드하여 다음 위치에 저장하세요:"
    echo "      $MODEL_FILE"
    echo ""
    echo "   3. 또는 다음 명령어로 자동 다운로드 (gdown 필요):"
    echo "      pip3.12 install gdown"
    echo "      gdown <MODEL_GOOGLE_DRIVE_ID> -O $MODEL_FILE"
fi

# 5. 설정 파일 생성
echo ""
echo "📝 설정 파일 생성 중..."
CONFIG_FILE="$BASE_DIR/mdm_config.json"
cat > "$CONFIG_FILE" << EOF
{
  "mdm_repo_path": "$MDM_REPO_DIR",
  "model_path": "$MODEL_FILE",
  "data_path": "$BASE_DIR/data",
  "dataset": "humanml"
}
EOF
echo "✅ 설정 파일 생성 완료: $CONFIG_FILE"

# 6. 테스트
echo ""
echo "🧪 모델 로드 테스트 중..."
cd "$BASE_DIR"
python3.12 -c "
from services.mdm_loader import get_mdm_loader
loader = get_mdm_loader()
if loader.is_loaded():
    print('✅ 모델 로드 성공!')
else:
    print('⚠️  모델 로드 실패 (모의 모드로 작동)')
" || echo "⚠️  테스트 실패 (의존성 확인 필요)"

echo ""
echo "✅ 설정 완료!"
echo ""
echo "📝 다음 단계:"
echo "   1. 모델 파일이 없다면 다운로드"
echo "   2. 백엔드 서버 재시작"
echo "   3. 모션 생성 테스트"


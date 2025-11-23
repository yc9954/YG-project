#!/bin/bash
# HumanML3D 데이터셋 설정 스크립트

set -e

echo "🚀 HumanML3D 데이터셋 설정을 시작합니다..."

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MDM_REPO_DIR="$BASE_DIR/external/motion-diffusion-model"
DATASET_DIR="$MDM_REPO_DIR/dataset/HumanML3D"

cd "$BASE_DIR"

# 1. 데이터셋 디렉토리 생성
echo ""
echo "📁 데이터셋 디렉토리 생성 중..."
mkdir -p "$DATASET_DIR"

# 2. HumanML3D 저장소 클론 (텍스트만 필요)
echo ""
echo "📥 HumanML3D 저장소 클론 중..."
HUMANML_DIR="$BASE_DIR/external/HumanML3D"
if [ ! -d "$HUMANML_DIR" ]; then
    mkdir -p "$BASE_DIR/external"
    cd "$BASE_DIR/external"
    git clone https://github.com/EricGuo5513/HumanML3D.git
    echo "✅ HumanML3D 저장소 클론 완료"
else
    echo "✅ HumanML3D 저장소가 이미 존재합니다"
fi

# 3. 텍스트 데이터 추출
echo ""
echo "📥 텍스트 데이터 추출 중..."
cd "$HUMANML_DIR/HumanML3D"
if [ -f "texts.zip" ]; then
    unzip -q -o texts.zip -d . 2>/dev/null || echo "이미 추출됨"
    echo "✅ 텍스트 데이터 추출 완료"
else
    echo "⚠️  texts.zip을 찾을 수 없습니다"
fi

# 4. 데이터셋 복사
echo ""
echo "📁 데이터셋 복사 중..."
if [ -d "$HUMANML_DIR/HumanML3D" ]; then
    cp -r "$HUMANML_DIR/HumanML3D"/* "$DATASET_DIR/" 2>/dev/null || true
    echo "✅ 데이터셋 복사 완료"
else
    echo "⚠️  HumanML3D 데이터를 찾을 수 없습니다"
fi

# 5. 필요한 파일 확인
echo ""
echo "🔍 필요한 파일 확인 중..."
REQUIRED_FILES=("Mean.npy" "Std.npy" "humanml_opt.txt")
MISSING_FILES=()

for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$DATASET_DIR/$file" ]; then
        MISSING_FILES+=("$file")
        echo "❌ 누락: $file"
    else
        echo "✅ 존재: $file"
    fi
done

if [ ${#MISSING_FILES[@]} -gt 0 ]; then
    echo ""
    echo "⚠️  일부 파일이 누락되었습니다."
    echo "   다음 링크에서 전체 데이터셋을 다운로드하세요:"
    echo "   https://drive.google.com/drive/folders/1OZrTlAGRvLjXhXwnRiOC-oxYry1vf-Uu?usp=drive_link"
    echo ""
    echo "   또는 MDM 저장소의 prepare 스크립트를 실행하세요:"
    echo "   cd $MDM_REPO_DIR"
    echo "   bash prepare/download_smpl_files.sh"
    echo "   bash prepare/download_glove.sh"
else
    echo ""
    echo "✅ 모든 필수 파일이 존재합니다!"
fi

echo ""
echo "✅ 데이터셋 설정 완료!"
echo ""
echo "📝 다음 단계:"
echo "   1. 누락된 파일이 있다면 다운로드"
echo "   2. 백엔드 서버 재시작"
echo "   3. 모션 생성 테스트"


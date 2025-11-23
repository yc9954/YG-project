#!/bin/bash
# 모델 파일 찾기 스크립트

echo "🔍 모델 파일 검색 중..."
echo ""

# 여러 위치에서 검색
SEARCH_DIRS=(
    "/Users/iyuchan/YG-project-1/backend/models"
    "/Users/iyuchan/YG-project-1/backend/models/mdm"
    "/Users/iyuchan/Downloads"
    "$HOME/Downloads"
)

for dir in "${SEARCH_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        echo "📁 검색 중: $dir"
        find "$dir" -type f \( -name "*.pt" -o -name "*.pth" -o -name "*.ckpt" -o -name "*model*" \) 2>/dev/null | head -10
        echo ""
    fi
done

echo "💡 모델 파일을 찾았다면 다음 위치로 이동하세요:"
echo "   /Users/iyuchan/YG-project-1/backend/models/mdm/humanml_trans_enc_512/model000475000.pt"


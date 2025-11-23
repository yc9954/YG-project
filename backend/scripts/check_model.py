"""
모델 파일 확인 스크립트
"""
import os
from pathlib import Path

def check_model():
    """모델 파일 확인"""
    base_dir = Path(__file__).parent.parent
    model_dir = base_dir / "models" / "mdm"
    
    print("🔍 모델 파일 검색 중...")
    print(f"   검색 경로: {model_dir}")
    print()
    
    # 모든 파일 검색
    all_files = []
    for root, dirs, files in os.walk(model_dir):
        for file in files:
            file_path = Path(root) / file
            all_files.append(file_path)
            print(f"   발견: {file_path.relative_to(base_dir)}")
    
    print()
    
    # 모델 파일 검색
    model_extensions = ['.pt', '.pth', '.ckpt', '.npz', '.bin']
    model_files = []
    
    for file_path in all_files:
        if file_path.suffix.lower() in model_extensions:
            size_mb = file_path.stat().st_size / (1024 * 1024)
            model_files.append((file_path, size_mb))
            print(f"✅ 모델 파일 발견: {file_path.relative_to(base_dir)} ({size_mb:.1f} MB)")
    
    if not model_files:
        print("❌ 모델 파일을 찾을 수 없습니다.")
        print()
        print("📥 모델 다운로드 방법:")
        print("   1. 다음 링크에서 HumanML3D 모델을 다운로드하세요:")
        print("      https://github.com/GuyTevet/motion-diffusion-model#pretrained-models")
        print()
        print("   2. 다운로드한 파일을 다음 위치에 저장하세요:")
        expected_path = base_dir / "models" / "mdm" / "humanml_trans_enc_512" / "model000475000.pt"
        print(f"      {expected_path}")
        print()
        print("   3. 또는 다른 위치에 있다면 경로를 알려주세요.")
    else:
        print()
        print("✅ 모델 파일을 찾았습니다!")
        print()
        print("📝 설정 파일 업데이트:")
        for file_path, size_mb in model_files:
            rel_path = file_path.relative_to(base_dir)
            print(f"   모델 경로: {rel_path}")
            print(f"   크기: {size_mb:.1f} MB")
            print()
            print(f"   mdm_config.json에 다음 경로를 설정하세요:")
            print(f"   \"model_path\": \"{file_path}\"")

if __name__ == "__main__":
    check_model()


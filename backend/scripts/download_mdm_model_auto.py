"""
MDM 모델 자동 다운로드 (실제 Google Drive 링크 사용)
"""
import os
import sys
from pathlib import Path

def download_model():
    """MDM HumanML3D 모델 다운로드"""
    try:
        import gdown
    except ImportError:
        print("❌ gdown이 설치되지 않았습니다.")
        print("   pip install gdown 으로 설치하세요.")
        return False
    
    base_dir = Path(__file__).parent.parent
    model_dir = base_dir / "models" / "mdm" / "humanml_trans_enc_512"
    model_dir.mkdir(parents=True, exist_ok=True)
    
    model_file = model_dir / "model000475000.pt"
    
    if model_file.exists():
        size_mb = model_file.stat().st_size / (1024 * 1024)
        print(f"✅ 모델 파일이 이미 존재합니다: {model_file} ({size_mb:.1f} MB)")
        response = input("다시 다운로드하시겠습니까? (y/n): ")
        if response.lower() != 'y':
            return True
    
    print("📥 MDM HumanML3D 모델 다운로드를 시작합니다...")
    print("   이 작업은 시간이 걸릴 수 있습니다 (모델 크기: ~500MB)")
    print()
    
    # MDM HumanML3D 모델 Google Drive ID
    # 50 diffusion steps 모델 (더 빠름, 권장)
    model_50_steps_id = "1cfadR1eZ116TIdXK7qDX1RugAerEiJXr"
    
    # 원본 1000 steps 모델 (더 느리지만 더 정확)
    # model_1000_steps_id = "원본_모델_ID"  # README에서 확인 필요
    
    print("다운로드할 모델을 선택하세요:")
    print("1. 50 diffusion steps 모델 (빠름, 권장) - 약 500MB")
    print("2. 원본 1000 steps 모델 (느리지만 더 정확) - 약 500MB")
    choice = input("선택 (1 또는 2, 기본값: 1): ").strip() or "1"
    
    if choice == "1":
        model_id = model_50_steps_id
        print("✅ 50 steps 모델 다운로드 중...")
    else:
        print("⚠️  원본 모델 ID가 필요합니다. README에서 확인하세요.")
        print("   https://github.com/GuyTevet/motion-diffusion-model#pretrained-models")
        url = input("Google Drive 공유 링크를 입력하세요: ").strip()
        if not url:
            return False
        
        # URL에서 ID 추출
        if "/file/d/" in url:
            model_id = url.split("/file/d/")[1].split("/")[0]
        elif "id=" in url:
            model_id = url.split("id=")[1].split("&")[0]
        else:
            model_id = url
    
    try:
        print(f"다운로드 중... (ID: {model_id})")
        gdown.download(
            f"https://drive.google.com/uc?id={model_id}",
            str(model_file),
            quiet=False
        )
        
        if model_file.exists():
            size_mb = model_file.stat().st_size / (1024 * 1024)
            print(f"✅ 모델 다운로드 완료: {model_file} ({size_mb:.1f} MB)")
            return True
        else:
            print("❌ 다운로드 실패")
            return False
    except Exception as e:
        print(f"❌ 다운로드 중 오류: {e}")
        print()
        print("💡 수동 다운로드 방법:")
        print("   1. 다음 링크에서 모델을 다운로드하세요:")
        print("      https://drive.google.com/file/d/1cfadR1eZ116TIdXK7qDX1RugAerEiJXr/view?usp=sharing")
        print()
        print(f"   2. 다운로드한 파일을 다음 위치에 저장하세요:")
        print(f"      {model_file}")
        return False

if __name__ == "__main__":
    success = download_model()
    sys.exit(0 if success else 1)


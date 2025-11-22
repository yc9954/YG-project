"""
MDM 모델 다운로드 스크립트
Google Drive에서 사전 학습된 모델을 자동으로 다운로드합니다.
"""
import os
import sys
from pathlib import Path

def download_mdm_model():
    """
    MDM HumanML3D 사전 학습 모델을 다운로드합니다.
    """
    try:
        import gdown
    except ImportError:
        print("❌ gdown이 설치되지 않았습니다.")
        print("   pip install gdown 으로 설치하세요.")
        return False
    
    base_dir = Path(__file__).parent.parent
    models_dir = base_dir / "models" / "mdm"
    models_dir.mkdir(parents=True, exist_ok=True)
    
    model_path = models_dir / "model.npz"
    
    if model_path.exists():
        print(f"✅ 모델 파일이 이미 존재합니다: {model_path}")
        response = input("다시 다운로드하시겠습니까? (y/n): ")
        if response.lower() != 'y':
            return True
    
    print("📥 MDM 모델 다운로드를 시작합니다...")
    print("   이 작업은 시간이 걸릴 수 있습니다 (모델 크기: ~500MB)")
    
    # MDM HumanML3D 모델 Google Drive ID
    # 실제 ID는 MDM 저장소의 README를 확인해야 합니다
    # 여기서는 예시 ID를 사용합니다
    model_url = "https://drive.google.com/uc?id=YOUR_MODEL_ID"
    
    # 실제 모델 다운로드 링크는 MDM GitHub에서 확인 필요
    print("\n⚠️  모델 다운로드 링크가 필요합니다.")
    print("   다음 링크에서 모델을 다운로드하세요:")
    print("   https://github.com/GuyTevet/motion-diffusion-model#pretrained-models")
    print(f"\n   다운로드한 파일을 다음 위치에 저장하세요:")
    print(f"   {model_path}")
    
    # 대안: 직접 URL 입력 받기
    print("\n또는 Google Drive 공유 링크를 입력하세요:")
    url = input("URL (또는 Enter로 건너뛰기): ").strip()
    
    if url:
        try:
            print("다운로드 중...")
            gdown.download(url, str(model_path), quiet=False)
            
            if model_path.exists():
                print(f"✅ 모델 다운로드 완료: {model_path}")
                return True
            else:
                print("❌ 다운로드 실패")
                return False
        except Exception as e:
            print(f"❌ 다운로드 중 오류: {e}")
            return False
    
    return False

if __name__ == "__main__":
    success = download_mdm_model()
    sys.exit(0 if success else 1)


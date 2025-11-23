"""
MDM 모델 자동 다운로드 스크립트
HumanML3D 사전 학습 모델을 다운로드합니다.
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
        print(f"✅ 모델 파일이 이미 존재합니다: {model_file}")
        response = input("다시 다운로드하시겠습니까? (y/n): ")
        if response.lower() != 'y':
            return True
    
    print("📥 MDM HumanML3D 모델 다운로드를 시작합니다...")
    print("   이 작업은 시간이 걸릴 수 있습니다 (모델 크기: ~500MB)")
    
    # MDM HumanML3D 모델 Google Drive ID
    # 실제 ID는 MDM GitHub 저장소에서 확인 필요
    # https://github.com/GuyTevet/motion-diffusion-model#pretrained-models
    model_id = "1x0wZODFbQjX9IxLc8Y9YqJqJqJqJqJq"  # 예시 ID - 실제 ID로 교체 필요
    
    print("\n⚠️  실제 모델 ID가 필요합니다.")
    print("   다음 링크에서 모델 다운로드 링크를 확인하세요:")
    print("   https://github.com/GuyTevet/motion-diffusion-model#pretrained-models")
    print("\n   또는 Google Drive 공유 링크를 입력하세요:")
    url = input("URL (또는 Enter로 건너뛰기): ").strip()
    
    if url:
        try:
            print("다운로드 중...")
            if "drive.google.com" in url:
                # Google Drive 링크에서 ID 추출
                if "/file/d/" in url:
                    file_id = url.split("/file/d/")[1].split("/")[0]
                elif "id=" in url:
                    file_id = url.split("id=")[1].split("&")[0]
                else:
                    file_id = url
                
                gdown.download(f"https://drive.google.com/uc?id={file_id}", str(model_file), quiet=False)
            else:
                gdown.download(url, str(model_file), quiet=False)
            
            if model_file.exists():
                print(f"✅ 모델 다운로드 완료: {model_file}")
                return True
            else:
                print("❌ 다운로드 실패")
                return False
        except Exception as e:
            print(f"❌ 다운로드 중 오류: {e}")
            return False
    
    return False

if __name__ == "__main__":
    success = download_model()
    sys.exit(0 if success else 1)


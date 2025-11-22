"""
MDM (Motion Diffusion Model) 설정 스크립트
모델 다운로드 및 설정을 자동화합니다.
"""
import os
import subprocess
import sys
from pathlib import Path

def setup_mdm():
    """
    MDM 모델을 다운로드하고 설정합니다.
    """
    print("🚀 MDM 모델 설정을 시작합니다...")
    
    # 1. 디렉토리 구조 생성
    base_dir = Path(__file__).parent.parent
    models_dir = base_dir / "models" / "mdm"
    mdm_repo_dir = base_dir / "external" / "motion-diffusion-model"
    
    print(f"📁 모델 디렉토리: {models_dir}")
    print(f"📁 MDM 저장소 디렉토리: {mdm_repo_dir}")
    
    # 디렉토리 생성
    models_dir.mkdir(parents=True, exist_ok=True)
    mdm_repo_dir.parent.mkdir(parents=True, exist_ok=True)
    
    # 2. MDM 저장소 클론 (없는 경우)
    if not (mdm_repo_dir / ".git").exists():
        print("\n📥 MDM 저장소를 클론합니다...")
        try:
            subprocess.run([
                "git", "clone",
                "https://github.com/GuyTevet/motion-diffusion-model.git",
                str(mdm_repo_dir)
            ], check=True)
            print("✅ 저장소 클론 완료")
        except subprocess.CalledProcessError as e:
            print(f"❌ 저장소 클론 실패: {e}")
            print("\n💡 수동으로 클론하세요:")
            print(f"   git clone https://github.com/GuyTevet/motion-diffusion-model.git {mdm_repo_dir}")
            return False
    else:
        print("✅ MDM 저장소가 이미 존재합니다")
    
    # 3. 의존성 설치
    print("\n📦 MDM 의존성을 설치합니다...")
    requirements_file = mdm_repo_dir / "requirements.txt"
    if requirements_file.exists():
        try:
            subprocess.run([
                sys.executable, "-m", "pip", "install", "-r", str(requirements_file)
            ], check=True)
            print("✅ 의존성 설치 완료")
        except subprocess.CalledProcessError as e:
            print(f"⚠️  의존성 설치 중 오류 (계속 진행): {e}")
    else:
        print("⚠️  requirements.txt를 찾을 수 없습니다")
    
    # 4. 모델 다운로드 안내
    print("\n📥 모델 파일 다운로드:")
    print("   MDM 사전 학습 모델을 다운로드해야 합니다.")
    print("   다음 링크에서 모델을 다운로드하세요:")
    print("   https://github.com/GuyTevet/motion-diffusion-model#pretrained-models")
    print("\n   다운로드한 모델 파일을 다음 위치에 저장하세요:")
    print(f"   {models_dir / 'model.npz'}")
    
    # 5. 설정 파일 생성
    config = {
        "mdm_repo_path": str(mdm_repo_dir),
        "model_path": str(models_dir / "model.npz"),
        "data_path": str(base_dir / "data"),
    }
    
    config_file = base_dir / "mdm_config.json"
    import json
    with open(config_file, "w") as f:
        json.dump(config, f, indent=2)
    
    print(f"\n✅ 설정 파일 생성: {config_file}")
    print("\n📝 다음 단계:")
    print("   1. 모델 파일을 다운로드하여 models/mdm/model.npz에 저장")
    print("   2. backend/services/motion_generator.py에서 모델 로드 코드 확인")
    print("   3. 테스트 실행")
    
    return True

if __name__ == "__main__":
    success = setup_mdm()
    if success:
        print("\n✅ MDM 설정이 완료되었습니다!")
    else:
        print("\n❌ MDM 설정 중 오류가 발생했습니다.")
        sys.exit(1)


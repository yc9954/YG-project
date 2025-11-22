"""
MDM (Motion Diffusion Model) 로더
모델을 로드하고 추론을 수행합니다.
"""
import os
import sys
import json
import numpy as np
from pathlib import Path
from typing import Dict, Optional

# MDM 저장소 경로 추가
base_dir = Path(__file__).parent.parent
mdm_repo_path = base_dir / "external" / "motion-diffusion-model"

if mdm_repo_path.exists():
    sys.path.insert(0, str(mdm_repo_path))

# 실제 MDM 통합 사용 시도
try:
    from .mdm_integration import MDMIntegration, get_mdm_integration, MDM_AVAILABLE
    USE_REAL_MDM = MDM_AVAILABLE
except ImportError:
    USE_REAL_MDM = False
    MDMIntegration = None
    get_mdm_integration = None


class MDMLoader:
    """
    MDM 모델을 로드하고 관리합니다.
    """
    
    def __init__(self, config_path: Optional[str] = None):
        """
        MDM 로더 초기화
        
        Args:
            config_path: 설정 파일 경로 (기본값: mdm_config.json)
        """
        self.config = self._load_config(config_path)
        self.model = None
        self.device = None
        self._setup_device()
    
    def _load_config(self, config_path: Optional[str]) -> Dict:
        """설정 파일 로드"""
        if config_path is None:
            config_path = base_dir / "mdm_config.json"
        
        if os.path.exists(config_path):
            with open(config_path, "r") as f:
                return json.load(f)
        else:
            # 기본 설정
            # MDM 모델은 보통 humanml_trans_enc_512 디렉토리에 있음
            default_model_path = base_dir / "models" / "mdm" / "humanml_trans_enc_512" / "model000475000.pt"
            
            return {
                "mdm_repo_path": str(mdm_repo_path),
                "model_path": str(default_model_path),
                "data_path": str(base_dir / "data"),
            }
    
    def _setup_device(self):
        """디바이스 설정 (CPU/GPU)"""
        try:
            import torch
            self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
            print(f"🔧 Using device: {self.device}")
        except ImportError:
            print("⚠️  PyTorch가 설치되지 않았습니다. CPU 모드로 진행합니다.")
            self.device = "cpu"
    
    def load_model(self) -> bool:
        """
        MDM 모델을 로드합니다.
        
        Returns:
            bool: 로드 성공 여부
        """
        try:
            model_path = self.config.get("model_path")
            
            if not os.path.exists(model_path):
                print(f"❌ 모델 파일을 찾을 수 없습니다: {model_path}")
                print("💡 setup_mdm.py를 실행하여 모델을 다운로드하세요.")
                return False
            
            # 실제 MDM 통합 사용 시도
            if USE_REAL_MDM and MDMIntegration:
                try:
                    print(f"📥 실제 MDM 모델 로드 시도: {model_path}")
                    self.mdm_integration = MDMIntegration(model_path)
                    if self.mdm_integration.load_model():
                        print("✅ 실제 MDM 모델 로드 완료")
                        return True
                    else:
                        print("⚠️  실제 MDM 로드 실패, 모의 모드로 전환")
                except Exception as e:
                    print(f"⚠️  실제 MDM 로드 중 오류: {e}")
                    print("   모의 모드로 전환합니다.")
            
            # 모의 모드
            print("✅ 모델 로드 완료 (모의 모드)")
            return True
            
        except Exception as e:
            print(f"❌ 모델 로드 실패: {e}")
            return False
    
    def generate(
        self,
        caption: str,
        length: float = 10.0,
        guidance_scale: float = 1.0,
        num_samples: int = 1
    ) -> np.ndarray:
        """
        텍스트 프롬프트로 모션을 생성합니다.
        
        Args:
            caption: 텍스트 프롬프트
            length: 모션 길이 (초)
            guidance_scale: 가이던스 스케일
            num_samples: 생성할 샘플 수
            
        Returns:
            np.ndarray: 모션 데이터 [frames, joints, 3]
        """
        # 실제 MDM 통합 사용
        if hasattr(self, 'mdm_integration') and self.mdm_integration and self.mdm_integration.is_loaded():
            try:
                print("🎬 실제 MDM으로 모션 생성 중...")
                motion = self.mdm_integration.generate(
                    caption=caption,
                    length=length,
                    guidance_scale=guidance_scale,
                    num_samples=num_samples
                )
                return motion
            except Exception as e:
                print(f"⚠️  실제 MDM 생성 실패: {e}")
                print("   모의 모드로 전환합니다.")
        
        # 모의 모드
        print("⚠️  모의 모드로 모션 생성")
        return self._generate_mock_motion(caption, length)
    
    def _generate_mock_motion(self, caption: str, length: float) -> np.ndarray:
        """
        모의 모션 데이터 생성 (테스트용)
        프롬프트에 따라 다른 모션 생성
        """
        import hashlib
        
        fps = 30
        frames = int(length * fps)
        joints = 22  # SMPL 포맷
        
        # 프롬프트를 해시하여 시드로 사용
        caption_hash = int(hashlib.md5(caption.encode()).hexdigest()[:8], 16)
        np.random.seed(caption_hash % (2**31))
        offset = (caption_hash % 100) / 100.0
        
        # 프롬프트 키워드 분석
        caption_lower = caption.lower()
        if "jump" in caption_lower or "점프" in caption_lower:
            jump_factor = 1.5
        else:
            jump_factor = 1.0
            
        if "spin" in caption_lower or "회전" in caption_lower:
            spin_factor = 1.3
        else:
            spin_factor = 1.0
        
        motion = np.zeros((frames, joints, 3))
        for i in range(frames):
            t = i / fps
            # 프롬프트 기반 다양한 패턴
            base_freq = 2.0 + (caption_hash % 10) / 10.0
            
            motion[i, 0, 1] = 1.0 + 0.15 * np.sin(t * base_freq * 2 + offset) * jump_factor
            motion[i, 1:5, 0] = 0.12 * np.sin(t * base_freq * 1.5 + offset) * spin_factor
            motion[i, 1:5, 1] = 0.1 * np.cos(t * base_freq * 1.2 + offset)
            motion[i, 5:9, :] = 0.2 * np.sin(t * base_freq * 1.8 + offset * 2)
            motion[i, 9:13, :] = 0.15 * np.sin(t * base_freq * 1.3 + offset * 1.5) * jump_factor
        
        return motion
    
    def is_loaded(self) -> bool:
        """모델이 로드되었는지 확인"""
        # 실제 MDM 통합이 있으면 그것을 확인
        if hasattr(self, 'mdm_integration') and self.mdm_integration:
            return self.mdm_integration.is_loaded()
        # 모의 모드
        return self.model is not None


# 전역 인스턴스 (선택사항)
_mdm_loader = None

def get_mdm_loader() -> MDMLoader:
    """전역 MDM 로더 인스턴스 반환"""
    global _mdm_loader
    if _mdm_loader is None:
        _mdm_loader = MDMLoader()
        _mdm_loader.load_model()
    return _mdm_loader


if __name__ == "__main__":
    # 테스트
    loader = MDMLoader()
    if loader.load_model():
        motion = loader.generate("A person dancing", length=5.0)
        print(f"✅ 모션 생성 완료: {motion.shape}")
    else:
        print("❌ 모델 로드 실패")


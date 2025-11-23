"""
실제 MDM 모델 통합
MDM 저장소의 코드를 사용하여 실제 모션 생성
"""
import os
import sys
import json
import torch
import numpy as np
from pathlib import Path
from typing import Optional

# MDM 저장소 경로 추가
base_dir = Path(__file__).parent.parent
mdm_repo_path = base_dir / "external" / "motion-diffusion-model"

if mdm_repo_path.exists():
    sys.path.insert(0, str(mdm_repo_path))

try:
    from utils.fixseed import fixseed
    from utils.model_util import create_model_and_diffusion, load_saved_model
    from utils import dist_util
    from utils.sampler_util import ClassifierFreeSampleModel
    from data_loaders.get_data import get_dataset_loader
    from data_loaders.tensors import collate
    MDM_AVAILABLE = True
except ImportError as e:
    print(f"⚠️  MDM 모듈을 임포트할 수 없습니다: {e}")
    print("   MDM 저장소의 의존성을 설치해야 합니다.")
    MDM_AVAILABLE = False


class MDMIntegration:
    """
    실제 MDM 모델을 사용하여 모션을 생성합니다.
    """
    
    def __init__(self, model_path: str, args_path: Optional[str] = None):
        """
        MDM 통합 초기화
        
        Args:
            model_path: 모델 체크포인트 경로 (.pt 파일)
            args_path: args.json 경로 (없으면 자동으로 찾음)
        """
        self.model_path = model_path
        self.args_path = args_path or str(Path(model_path).parent / "args.json")
        
        self.model = None
        self.diffusion = None
        self.args = None
        self.device = None
        
        if not MDM_AVAILABLE:
            raise ImportError("MDM 모듈을 사용할 수 없습니다. 의존성을 설치하세요.")
        
        self._setup_device()
        self._load_args()
    
    def _setup_device(self):
        """디바이스 설정"""
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        device_id = 0 if torch.cuda.is_available() else -1
        dist_util.setup_dist(device=device_id)
        print(f"🔧 Using device: {self.device}")
    
    def _load_args(self):
        """모델 args.json 로드"""
        if not os.path.exists(self.args_path):
            raise FileNotFoundError(f"args.json을 찾을 수 없습니다: {self.args_path}")
        
        with open(self.args_path, 'r') as f:
            args_dict = json.load(f)
        
        # Namespace 객체 생성
        from argparse import Namespace
        self.args = Namespace(**args_dict)
        
        # 필수 속성 설정
        if not hasattr(self.args, 'guidance_param'):
            self.args.guidance_param = 2.5
        if not hasattr(self.args, 'num_samples'):
            self.args.num_samples = 1
        if not hasattr(self.args, 'num_repetitions'):
            self.args.num_repetitions = 1
        if not hasattr(self.args, 'motion_length'):
            self.args.motion_length = 10.0
        if not hasattr(self.args, 'text_prompt'):
            self.args.text_prompt = ''
        if not hasattr(self.args, 'batch_size'):
            self.args.batch_size = 1
        if not hasattr(self.args, 'seed'):
            self.args.seed = 10
        if not hasattr(self.args, 'use_ema'):
            self.args.use_ema = False
        
        print(f"✅ 모델 설정 로드 완료: {self.args.dataset}")
    
    def load_model(self) -> bool:
        """
        MDM 모델 로드
        
        Returns:
            bool: 로드 성공 여부
        """
        try:
            print("📥 데이터 로더 생성 중...")
            abs_path = str(mdm_repo_path)

            # 작업 디렉토리를 MDM 저장소로 변경 (상대 경로 문제 해결)
            original_cwd = os.getcwd()
            try:
                os.chdir(abs_path)
                data = get_dataset_loader(
                    name=self.args.dataset,
                    batch_size=self.args.batch_size,
                    num_frames=6000,  # 5분 영상 지원 (300초 × 20fps)
                    split='test',
                    hml_mode='text_only'
                )
            finally:
                os.chdir(original_cwd)
            
            print("📥 모델 및 Diffusion 생성 중...")
            self.model, self.diffusion = create_model_and_diffusion(self.args, data)
            
            print(f"📥 체크포인트 로드 중: {self.model_path}")
            load_saved_model(self.model, self.model_path, use_avg=self.args.use_ema)
            
            # Classifier-free guidance 설정
            if self.args.guidance_param != 1:
                self.model = ClassifierFreeSampleModel(self.model)
            
            self.model.to(self.device)
            self.model.eval()
            
            print("✅ MDM 모델 로드 완료")
            return True
            
        except Exception as e:
            print(f"❌ 모델 로드 실패: {e}")
            return False
    
    def generate(
        self,
        caption: str,
        length: float = 10.0,
        guidance_scale: float = 2.5,
        num_samples: int = 1
    ) -> np.ndarray:
        """
        텍스트 프롬프트로 모션 생성
        
        Args:
            caption: 텍스트 프롬프트
            length: 모션 길이 (초)
            guidance_scale: 가이던스 스케일
            num_samples: 생성할 샘플 수
            
        Returns:
            np.ndarray: 모션 데이터 [frames, joints, features]
        """
        if self.model is None:
            raise RuntimeError("모델이 로드되지 않았습니다. load_model()을 먼저 호출하세요.")
        
        try:
            fixseed(self.args.seed)
            
            # 프레임 수 계산
            fps = 20.0 if self.args.dataset == 'humanml' else 12.5
            max_frames = 6000 if self.args.dataset in ['kit', 'humanml'] else 60  # 5분 영상 지원
            n_frames = min(max_frames, int(length * fps))
            
            # 텍스트 설정
            texts = [caption] * num_samples
            
            # 모션 shape
            motion_shape = (num_samples, self.model.njoints, self.model.nfeats, n_frames)
            
            # 모델 kwargs 생성
            collate_args = [
                {'inp': torch.zeros(n_frames), 'tokens': None, 'lengths': n_frames, 'text': txt}
                for txt in texts
            ]
            _, model_kwargs = collate(collate_args)
            model_kwargs['y'] = {
                key: val.to(self.device) if torch.is_tensor(val) else val
                for key, val in model_kwargs['y'].items()
            }
            
            # Guidance scale 설정
            if guidance_scale != 1:
                model_kwargs['y']['scale'] = torch.ones(num_samples, device=self.device) * guidance_scale
            
            # 텍스트 임베딩 (한 번만 인코딩)
            if 'text' in model_kwargs['y'].keys():
                model_kwargs['y']['text_embed'] = self.model.encode_text(model_kwargs['y']['text'])
            
            print(f"🎬 모션 생성 중... (길이: {length}초, 프레임: {n_frames})")
            
            # 샘플링
            sample = self.diffusion.p_sample_loop(
                self.model,
                motion_shape,
                clip_denoised=False,
                model_kwargs=model_kwargs,
                skip_timesteps=0,
                init_image=None,
                progress=True,
                dump_steps=None,
                noise=None,
                const_noise=False,
            )
            
            # 첫 번째 샘플만 반환
            # HumanML3D 벡터 표현은 나중에 변환 필요
            motion = sample[0].cpu().numpy()  # [frames, joints, features]
            
            print(f"✅ 모션 생성 완료: {motion.shape}")
            return motion
            
        except Exception as e:
            print(f"❌ 모션 생성 실패: {e}")
            raise
    
    def is_loaded(self) -> bool:
        """모델이 로드되었는지 확인"""
        return self.model is not None


# 전역 인스턴스
_mdm_integration = None

def get_mdm_integration() -> Optional[MDMIntegration]:
    """전역 MDM 통합 인스턴스 반환"""
    global _mdm_integration
    if _mdm_integration is None and MDM_AVAILABLE:
        try:
            config_path = base_dir / "mdm_config.json"
            if config_path.exists():
                with open(config_path, 'r') as f:
                    config = json.load(f)
                model_path = config.get("model_path")
                if model_path and os.path.exists(model_path):
                    _mdm_integration = MDMIntegration(model_path)
                    if _mdm_integration.load_model():
                        return _mdm_integration
        except Exception as e:
            print(f"⚠️  MDM 통합 초기화 실패: {e}")
    return _mdm_integration


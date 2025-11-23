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
import inspect

# Python 3.12 호환성 패치 (chumpy)
if not hasattr(inspect, 'getargspec'):
    inspect.getargspec = inspect.getfullargspec

# NumPy 호환성 패치 (chumpy가 numpy에서 bool, int 등을 직접 import하려고 함)
import numpy
if not hasattr(numpy, 'bool'):
    numpy.bool = numpy.bool_
    numpy.int = numpy.int_
    numpy.float = numpy.float_
    numpy.complex = numpy.complex_
    numpy.object = numpy.object_
    numpy.unicode = numpy.str_
    numpy.str = numpy.str_

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
        
        # 필수 속성 설정 (누락된 속성에 기본값 설정)
        default_attrs = {
            'guidance_param': 2.5,
            'num_samples': 1,
            'num_repetitions': 1,
            'motion_length': 10.0,
            'text_prompt': '',
            'batch_size': 1,
            'seed': 10,
            'use_ema': False,
            'unconstrained': False,
            'text_encoder_type': 'clip',
            'data_dir': '',
            'pos_embed_max_len': 5000,  # Position embedding 최대 길이 (기본값)
            'mask_frames': False,
            'gen_during_training': False,
        }
        
        for attr, default_value in default_attrs.items():
            if not hasattr(self.args, attr):
                setattr(self.args, attr, default_value)
        
        print(f"✅ 모델 설정 로드 완료: {self.args.dataset}")
    
    def load_model(self) -> bool:
        """
        MDM 모델 로드
        
        Returns:
            bool: 로드 성공 여부
        """
        try:
            abs_path = str(mdm_repo_path)
            
            # 작업 디렉토리를 MDM 저장소로 먼저 변경 (모든 상대 경로 문제 해결)
            original_cwd = os.getcwd()
            os.chdir(abs_path)
            
            try:
                print("📥 데이터 로더 생성 중...")
                
                # SMPL 경로 확인 및 복사 (필요시)
                smpl_src = os.path.join(abs_path, 'smpl')
                smpl_dst = os.path.join(abs_path, 'body_models', 'smpl')
                if os.path.exists(smpl_src) and not os.path.exists(smpl_dst):
                    import shutil
                    os.makedirs(os.path.dirname(smpl_dst), exist_ok=True)
                    shutil.copytree(smpl_src, smpl_dst)
                    print("✅ SMPL 파일 복사 완료")
                
                # SMPL 파일 존재 확인
                smpl_path = os.path.join(abs_path, 'body_models', 'smpl', 'SMPL_NEUTRAL.pkl')
                if not os.path.exists(smpl_path):
                    # 절대 경로로도 확인
                    if os.path.exists('./body_models/smpl/SMPL_NEUTRAL.pkl'):
                        print("✅ SMPL 파일 확인됨 (상대 경로)")
                    else:
                        print(f"⚠️  SMPL 파일을 찾을 수 없습니다: {smpl_path}")
                        print(f"   현재 디렉토리: {os.getcwd()}")
                        print(f"   body_models/smpl 존재: {os.path.exists('./body_models/smpl')}")
                
                data = get_dataset_loader(
                    name=self.args.dataset,
                    batch_size=self.args.batch_size,
                    num_frames=196,
                    split='test',
                    hml_mode='text_only'
                )
            
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
            finally:
                # 작업 디렉토리 복원
                os.chdir(original_cwd)
            
        except Exception as e:
            import traceback
            print(f"❌ 모델 로드 실패: {e}")
            traceback.print_exc()
            # 작업 디렉토리 복원
            if 'original_cwd' in locals():
                os.chdir(original_cwd)
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
            max_frames = 196 if self.args.dataset in ['kit', 'humanml'] else 60
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
            # HumanML3D 벡터 형식 (263차원)을 관절 회전 형식으로 변환
            motion = sample[0].cpu().numpy()  # 실제 형식 확인 필요
            
            # 형식 확인 및 변환
            print(f"🔍 원본 모션 shape: {motion.shape}")
            
            # [features, 1, frames] 형식 -> [frames, joints, 3]
            if len(motion.shape) == 3:
                if motion.shape[0] == 263 and motion.shape[1] == 1:
                    # [263, 1, frames] -> [frames, 263] -> [frames, 22, 3]
                    motion = motion.transpose(2, 0, 1)  # [frames, 263, 1]
                    if motion.shape[2] == 1:
                        motion = motion.squeeze(2)  # [frames, 263]
                    # 263차원에서 처음 66개 값이 관절 회전 (22관절 * 3)
                    motion = motion[:, :66].reshape(motion.shape[0], 22, 3)
                    print(f"✅ 모션 생성 완료 (변환됨): {motion.shape}")
                elif motion.shape[2] == 1:
                    # [frames, features, 1] -> [frames, features]
                    motion = motion.squeeze(2)
                    if motion.shape[1] == 263:
                        motion = motion[:, :66].reshape(motion.shape[0], 22, 3)
                        print(f"✅ 모션 생성 완료 (변환됨): {motion.shape}")
            elif len(motion.shape) == 2:
                # [frames, features] 형식
                if motion.shape[1] == 263:
                    motion = motion[:, :66].reshape(motion.shape[0], 22, 3)
                    print(f"✅ 모션 생성 완료 (변환됨): {motion.shape}")
            
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


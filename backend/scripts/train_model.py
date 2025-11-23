"""
K-pop 안무 데이터셋으로 MDM 모델 파인튜닝
"""
import os
import sys
import json
import torch
import numpy as np
from pathlib import Path
from typing import Dict, List, Optional

# MDM 저장소 경로 추가
base_dir = Path(__file__).parent.parent
mdm_repo_path = base_dir / "external" / "motion-diffusion-model"

if mdm_repo_path.exists():
    sys.path.insert(0, str(mdm_repo_path))

try:
    from utils.fixseed import fixseed
    from utils.model_util import create_model_and_diffusion
    from utils import dist_util
    from data_loaders.get_data import get_dataset_loader
    MDM_AVAILABLE = True
except ImportError as e:
    print(f"❌ MDM 모듈을 임포트할 수 없습니다: {e}")
    print("   먼저 setup_ai_model.sh를 실행하여 MDM을 설정하세요.")
    MDM_AVAILABLE = False
    sys.exit(1)


class KPopModelTrainer:
    """
    K-pop 안무 데이터셋으로 MDM 모델을 파인튜닝합니다.
    """
    
    def __init__(
        self,
        base_model_path: str,
        training_data_path: str,
        output_dir: str,
        epochs: int = 100,
        batch_size: int = 32,
        learning_rate: float = 1e-4
    ):
        """
        Args:
            base_model_path: 사전 학습된 MDM 모델 경로
            training_data_path: 학습 데이터 경로 (JSON 또는 NPZ 형식)
            output_dir: 학습된 모델 저장 디렉토리
            epochs: 학습 에포크 수
            batch_size: 배치 크기
            learning_rate: 학습률
        """
        self.base_model_path = base_model_path
        self.training_data_path = training_data_path
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        self.epochs = epochs
        self.batch_size = batch_size
        self.learning_rate = learning_rate
        
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        dist_util.setup_dist(device=0 if torch.cuda.is_available() else -1)
        
        self.model = None
        self.diffusion = None
        self.optimizer = None
    
    def load_base_model(self):
        """사전 학습된 모델 로드"""
        print(f"📥 사전 학습 모델 로드 중: {self.base_model_path}")
        
        # args.json 로드
        args_path = Path(self.base_model_path).parent / "args.json"
        with open(args_path, 'r') as f:
            args_dict = json.load(f)
        
        from argparse import Namespace
        args = Namespace(**args_dict)
        
        # 데이터 로더 생성
        original_cwd = os.getcwd()
        try:
            os.chdir(str(mdm_repo_path))
            data = get_dataset_loader(
                name=args.dataset,
                batch_size=self.batch_size,
                num_frames=196,
                split='train',
                hml_mode='text_only'
            )
        finally:
            os.chdir(original_cwd)
        
        # 모델 및 Diffusion 생성
        self.model, self.diffusion = create_model_and_diffusion(args, data)
        
        # 사전 학습된 가중치 로드
        checkpoint = torch.load(self.base_model_path, map_location=self.device)
        self.model.load_state_dict(checkpoint)
        self.model.to(self.device)
        
        # 옵티마이저 설정
        self.optimizer = torch.optim.Adam(
            self.model.parameters(),
            lr=self.learning_rate
        )
        
        print("✅ 모델 로드 완료")
    
    def load_training_data(self) -> List[Dict]:
        """
        학습 데이터 로드
        데이터 형식: [{"motion": np.ndarray, "text": str, "style": str}, ...]
        """
        print(f"📥 학습 데이터 로드 중: {self.training_data_path}")
        
        training_data_path = Path(self.training_data_path)
        
        if training_data_path.suffix == '.json':
            with open(training_data_path, 'r') as f:
                data = json.load(f)
        elif training_data_path.suffix == '.npz':
            data = np.load(training_data_path, allow_pickle=True)
            data = data['data'].tolist()
        else:
            raise ValueError(f"지원하지 않는 데이터 형식: {training_data_path.suffix}")
        
        print(f"✅ 학습 데이터 로드 완료: {len(data)}개 샘플")
        return data
    
    def train(self):
        """모델 학습"""
        if self.model is None:
            raise RuntimeError("모델이 로드되지 않았습니다. load_base_model()을 먼저 호출하세요.")
        
        # 학습 데이터 로드
        training_data = self.load_training_data()
        
        print(f"🚀 학습 시작 (에포크: {self.epochs}, 배치 크기: {self.batch_size})")
        
        for epoch in range(self.epochs):
            total_loss = 0.0
            num_batches = 0
            
            # 배치 생성 및 학습
            for i in range(0, len(training_data), self.batch_size):
                batch = training_data[i:i + self.batch_size]
                
                # 배치 데이터 준비
                motions = torch.stack([
                    torch.from_numpy(item['motion']).float()
                    for item in batch
                ]).to(self.device)
                
                texts = [item['text'] for item in batch]
                
                # 모델 forward
                self.optimizer.zero_grad()
                
                # Diffusion loss 계산
                t = torch.randint(
                    0, self.diffusion.num_timesteps,
                    (motions.shape[0],), device=self.device
                )
                noise = torch.randn_like(motions)
                x_t = self.diffusion.q_sample(motions, t, noise=noise)
                
                # 텍스트 임베딩
                model_kwargs = {'y': {'text': texts}}
                if hasattr(self.model, 'encode_text'):
                    model_kwargs['y']['text_embed'] = self.model.encode_text(texts)
                
                # 예측
                model_output = self.model(x_t, t, **model_kwargs)
                
                # Loss 계산
                loss = torch.nn.functional.mse_loss(model_output, noise)
                
                # Backward
                loss.backward()
                self.optimizer.step()
                
                total_loss += loss.item()
                num_batches += 1
            
            avg_loss = total_loss / num_batches if num_batches > 0 else 0.0
            print(f"Epoch {epoch + 1}/{self.epochs}, Loss: {avg_loss:.6f}")
            
            # 체크포인트 저장 (매 10 에포크마다)
            if (epoch + 1) % 10 == 0:
                checkpoint_path = self.output_dir / f"checkpoint_epoch_{epoch + 1}.pt"
                torch.save(self.model.state_dict(), checkpoint_path)
                print(f"💾 체크포인트 저장: {checkpoint_path}")
        
        # 최종 모델 저장
        final_model_path = self.output_dir / "final_model.pt"
        torch.save(self.model.state_dict(), final_model_path)
        print(f"✅ 학습 완료! 최종 모델 저장: {final_model_path}")


def main():
    """메인 함수"""
    import argparse
    
    parser = argparse.ArgumentParser(description="K-pop 안무 데이터셋으로 MDM 모델 파인튜닝")
    parser.add_argument("--base_model", type=str, required=True,
                       help="사전 학습된 MDM 모델 경로")
    parser.add_argument("--data", type=str, required=True,
                       help="학습 데이터 경로 (JSON 또는 NPZ)")
    parser.add_argument("--output", type=str, required=True,
                       help="출력 디렉토리")
    parser.add_argument("--epochs", type=int, default=100,
                       help="학습 에포크 수 (기본값: 100)")
    parser.add_argument("--batch_size", type=int, default=32,
                       help="배치 크기 (기본값: 32)")
    parser.add_argument("--lr", type=float, default=1e-4,
                       help="학습률 (기본값: 1e-4)")
    
    args = parser.parse_args()
    
    trainer = KPopModelTrainer(
        base_model_path=args.base_model,
        training_data_path=args.data,
        output_dir=args.output,
        epochs=args.epochs,
        batch_size=args.batch_size,
        learning_rate=args.lr
    )
    
    trainer.load_base_model()
    trainer.train()


if __name__ == "__main__":
    main()


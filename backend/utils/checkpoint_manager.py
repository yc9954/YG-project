"""
체크포인트 저장/로드 유틸리티
Colab 환경에서 Google Drive와 호환되도록 설계
"""
import os
import json
import torch
from pathlib import Path
from typing import Dict, Optional, Any
from datetime import datetime


class CheckpointManager:
    """
    모델 체크포인트를 관리합니다.
    Google Drive와의 동기화를 지원합니다.
    """

    def __init__(
        self,
        checkpoint_dir: str = "checkpoints",
        max_checkpoints: int = 5,
        google_drive_sync: bool = False,
        drive_folder: str = "MDM_Checkpoints"
    ):
        """
        체크포인트 매니저 초기화

        Args:
            checkpoint_dir: 체크포인트 저장 디렉토리
            max_checkpoints: 유지할 최대 체크포인트 수
            google_drive_sync: Google Drive 동기화 사용 여부
            drive_folder: Google Drive 폴더 이름
        """
        self.checkpoint_dir = Path(checkpoint_dir)
        self.checkpoint_dir.mkdir(parents=True, exist_ok=True)
        self.max_checkpoints = max_checkpoints
        self.google_drive_sync = google_drive_sync
        self.drive_folder = drive_folder

        # Colab 환경 감지
        self.is_colab = self._detect_colab()

        # Google Drive 마운트 확인
        if self.is_colab and self.google_drive_sync:
            self.drive_checkpoint_dir = self._setup_drive_sync()
        else:
            self.drive_checkpoint_dir = None

    def _detect_colab(self) -> bool:
        """Colab 환경인지 감지"""
        try:
            import google.colab
            return True
        except ImportError:
            return False

    def _setup_drive_sync(self) -> Optional[Path]:
        """Google Drive 동기화 설정"""
        try:
            from google.colab import drive

            # Drive 마운트
            mount_point = Path("/content/drive")
            if not mount_point.exists():
                print("📂 Google Drive 마운트 중...")
                drive.mount(str(mount_point))

            # 체크포인트 디렉토리 생성
            drive_dir = mount_point / "MyDrive" / self.drive_folder
            drive_dir.mkdir(parents=True, exist_ok=True)

            print(f"✅ Google Drive 동기화 활성화: {drive_dir}")
            return drive_dir

        except Exception as e:
            print(f"⚠️  Google Drive 동기화 설정 실패: {e}")
            return None

    def save_checkpoint(
        self,
        model: torch.nn.Module,
        optimizer: Optional[torch.optim.Optimizer] = None,
        epoch: int = 0,
        step: int = 0,
        loss: float = 0.0,
        metrics: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        checkpoint_name: Optional[str] = None
    ) -> str:
        """
        체크포인트 저장

        Args:
            model: 저장할 모델
            optimizer: 옵티마이저 (선택사항)
            epoch: 에폭 번호
            step: 스텝 번호
            loss: 현재 손실값
            metrics: 평가 지표들
            metadata: 추가 메타데이터
            checkpoint_name: 체크포인트 이름 (None이면 자동 생성)

        Returns:
            str: 저장된 체크포인트 경로
        """
        if checkpoint_name is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            checkpoint_name = f"checkpoint_epoch{epoch}_step{step}_{timestamp}.pt"

        checkpoint_path = self.checkpoint_dir / checkpoint_name

        # 체크포인트 데이터 구성
        checkpoint_data = {
            'epoch': epoch,
            'step': step,
            'model_state_dict': model.state_dict(),
            'loss': loss,
            'timestamp': datetime.now().isoformat(),
        }

        # 옵티마이저 상태 저장
        if optimizer is not None:
            checkpoint_data['optimizer_state_dict'] = optimizer.state_dict()

        # 메트릭 저장
        if metrics is not None:
            checkpoint_data['metrics'] = metrics

        # 메타데이터 저장
        if metadata is not None:
            checkpoint_data['metadata'] = metadata

        # 로컬에 저장
        try:
            torch.save(checkpoint_data, checkpoint_path)
            print(f"✅ 체크포인트 저장 완료: {checkpoint_path}")

            # 메타정보 JSON 파일 저장
            meta_path = checkpoint_path.with_suffix('.json')
            with open(meta_path, 'w') as f:
                json.dump({
                    'epoch': epoch,
                    'step': step,
                    'loss': float(loss),
                    'metrics': metrics,
                    'metadata': metadata,
                    'timestamp': checkpoint_data['timestamp']
                }, f, indent=2)

        except Exception as e:
            print(f"❌ 체크포인트 저장 실패: {e}")
            raise

        # Google Drive에 백업
        if self.drive_checkpoint_dir is not None:
            try:
                drive_path = self.drive_checkpoint_dir / checkpoint_name
                torch.save(checkpoint_data, drive_path)

                drive_meta_path = drive_path.with_suffix('.json')
                with open(drive_meta_path, 'w') as f:
                    json.dump({
                        'epoch': epoch,
                        'step': step,
                        'loss': float(loss),
                        'metrics': metrics,
                        'metadata': metadata,
                        'timestamp': checkpoint_data['timestamp']
                    }, f, indent=2)

                print(f"✅ Google Drive 백업 완료: {drive_path}")
            except Exception as e:
                print(f"⚠️  Google Drive 백업 실패: {e}")

        # 오래된 체크포인트 정리
        self._cleanup_old_checkpoints()

        return str(checkpoint_path)

    def load_checkpoint(
        self,
        checkpoint_path: str,
        model: torch.nn.Module,
        optimizer: Optional[torch.optim.Optimizer] = None,
        device: str = 'cpu'
    ) -> Dict[str, Any]:
        """
        체크포인트 로드

        Args:
            checkpoint_path: 체크포인트 파일 경로
            model: 로드할 모델
            optimizer: 옵티마이저 (선택사항)
            device: 디바이스 ('cpu' 또는 'cuda')

        Returns:
            Dict: 체크포인트 정보 (epoch, step, loss 등)
        """
        checkpoint_path = Path(checkpoint_path)

        # Google Drive에서 먼저 찾기
        if self.drive_checkpoint_dir is not None:
            drive_path = self.drive_checkpoint_dir / checkpoint_path.name
            if drive_path.exists():
                checkpoint_path = drive_path
                print(f"📂 Google Drive에서 체크포인트 로드: {drive_path}")

        if not checkpoint_path.exists():
            raise FileNotFoundError(f"체크포인트를 찾을 수 없습니다: {checkpoint_path}")

        try:
            # 체크포인트 로드
            checkpoint = torch.load(checkpoint_path, map_location=device)

            # 모델 상태 로드
            model.load_state_dict(checkpoint['model_state_dict'])
            print(f"✅ 모델 상태 로드 완료")

            # 옵티마이저 상태 로드
            if optimizer is not None and 'optimizer_state_dict' in checkpoint:
                optimizer.load_state_dict(checkpoint['optimizer_state_dict'])
                print(f"✅ 옵티마이저 상태 로드 완료")

            # 정보 반환
            info = {
                'epoch': checkpoint.get('epoch', 0),
                'step': checkpoint.get('step', 0),
                'loss': checkpoint.get('loss', 0.0),
                'metrics': checkpoint.get('metrics', {}),
                'metadata': checkpoint.get('metadata', {}),
                'timestamp': checkpoint.get('timestamp', '')
            }

            print(f"✅ 체크포인트 로드 완료: Epoch {info['epoch']}, Step {info['step']}, Loss {info['loss']:.4f}")
            return info

        except Exception as e:
            print(f"❌ 체크포인트 로드 실패: {e}")
            raise

    def load_latest_checkpoint(
        self,
        model: torch.nn.Module,
        optimizer: Optional[torch.optim.Optimizer] = None,
        device: str = 'cpu',
        from_drive: bool = False
    ) -> Optional[Dict[str, Any]]:
        """
        가장 최근 체크포인트 로드

        Args:
            model: 로드할 모델
            optimizer: 옵티마이저 (선택사항)
            device: 디바이스
            from_drive: Google Drive에서 로드할지 여부

        Returns:
            Optional[Dict]: 체크포인트 정보 (없으면 None)
        """
        # 체크포인트 디렉토리 선택
        if from_drive and self.drive_checkpoint_dir is not None:
            search_dir = self.drive_checkpoint_dir
        else:
            search_dir = self.checkpoint_dir

        # .pt 파일 찾기
        checkpoints = list(search_dir.glob("*.pt"))

        if not checkpoints:
            print("⚠️  체크포인트를 찾을 수 없습니다.")
            return None

        # 최신 파일 찾기 (수정 시간 기준)
        latest_checkpoint = max(checkpoints, key=lambda p: p.stat().st_mtime)

        print(f"📂 최신 체크포인트 발견: {latest_checkpoint}")
        return self.load_checkpoint(str(latest_checkpoint), model, optimizer, device)

    def _cleanup_old_checkpoints(self):
        """오래된 체크포인트 삭제"""
        checkpoints = sorted(
            self.checkpoint_dir.glob("*.pt"),
            key=lambda p: p.stat().st_mtime,
            reverse=True
        )

        # max_checkpoints 이상이면 오래된 것 삭제
        for checkpoint in checkpoints[self.max_checkpoints:]:
            try:
                checkpoint.unlink()
                # 메타 파일도 삭제
                meta_file = checkpoint.with_suffix('.json')
                if meta_file.exists():
                    meta_file.unlink()
                print(f"🗑️  오래된 체크포인트 삭제: {checkpoint.name}")
            except Exception as e:
                print(f"⚠️  체크포인트 삭제 실패: {e}")

    def list_checkpoints(self, from_drive: bool = False) -> list:
        """
        저장된 체크포인트 목록 반환

        Args:
            from_drive: Google Drive에서 목록 가져오기

        Returns:
            list: 체크포인트 정보 리스트
        """
        if from_drive and self.drive_checkpoint_dir is not None:
            search_dir = self.drive_checkpoint_dir
        else:
            search_dir = self.checkpoint_dir

        checkpoints = []
        for pt_file in sorted(search_dir.glob("*.pt"), key=lambda p: p.stat().st_mtime, reverse=True):
            meta_file = pt_file.with_suffix('.json')
            if meta_file.exists():
                with open(meta_file, 'r') as f:
                    info = json.load(f)
                    info['path'] = str(pt_file)
                    checkpoints.append(info)
            else:
                checkpoints.append({
                    'path': str(pt_file),
                    'name': pt_file.name
                })

        return checkpoints


# 편의 함수들
def save_model_checkpoint(
    model: torch.nn.Module,
    save_path: str,
    **kwargs
) -> str:
    """
    간단한 체크포인트 저장

    Args:
        model: 저장할 모델
        save_path: 저장 경로
        **kwargs: CheckpointManager.save_checkpoint에 전달될 추가 인자
    """
    manager = CheckpointManager()
    return manager.save_checkpoint(model, checkpoint_name=save_path, **kwargs)


def load_model_checkpoint(
    model: torch.nn.Module,
    checkpoint_path: str,
    device: str = 'cpu',
    **kwargs
) -> Dict[str, Any]:
    """
    간단한 체크포인트 로드

    Args:
        model: 로드할 모델
        checkpoint_path: 체크포인트 경로
        device: 디바이스
        **kwargs: CheckpointManager.load_checkpoint에 전달될 추가 인자
    """
    manager = CheckpointManager()
    return manager.load_checkpoint(checkpoint_path, model, device=device, **kwargs)


if __name__ == "__main__":
    # 테스트
    print("체크포인트 매니저 테스트")

    manager = CheckpointManager(
        checkpoint_dir="test_checkpoints",
        max_checkpoints=3,
        google_drive_sync=False
    )

    # 더미 모델 생성
    model = torch.nn.Linear(10, 5)
    optimizer = torch.optim.Adam(model.parameters())

    # 체크포인트 저장 테스트
    manager.save_checkpoint(
        model=model,
        optimizer=optimizer,
        epoch=1,
        step=100,
        loss=0.5,
        metrics={'accuracy': 0.85}
    )

    # 체크포인트 목록
    checkpoints = manager.list_checkpoints()
    print(f"\n저장된 체크포인트: {len(checkpoints)}개")
    for cp in checkpoints:
        print(f"  - {cp.get('path', 'N/A')}")

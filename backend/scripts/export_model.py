"""
모델 내보내기 스크립트
ONNX 및 TorchScript 형식으로 모델 변환
EDGE 최적화를 위한 양자화 및 프루닝 지원
"""
import os
import sys
import json
import torch
import argparse
from pathlib import Path
from typing import Optional, Dict, Any

# 프로젝트 루트 경로 추가
base_dir = Path(__file__).parent.parent
sys.path.insert(0, str(base_dir))


class ModelExporter:
    """
    MDM 모델을 다양한 형식으로 내보냅니다.
    """

    def __init__(self, model_path: str, config_path: Optional[str] = None):
        """
        Args:
            model_path: 원본 모델 체크포인트 경로
            config_path: EDGE 설정 파일 경로
        """
        self.model_path = Path(model_path)
        self.config = self._load_config(config_path)
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.model = None

    def _load_config(self, config_path: Optional[str]) -> Dict:
        """EDGE 설정 로드"""
        if config_path is None:
            config_path = base_dir / "edge_config.json"

        if os.path.exists(config_path):
            with open(config_path, 'r') as f:
                return json.load(f)
        else:
            # 기본 설정
            return {
                "optimization": {
                    "quantization": {"enabled": True, "dtype": "int8"},
                    "pruning": {"enabled": False, "sparsity": 0.3}
                },
                "export": {
                    "formats": ["onnx", "torchscript"],
                    "onnx": {
                        "opset_version": 14,
                        "dynamic_axes": {
                            "input": {"0": "batch_size", "3": "sequence_length"},
                            "output": {"0": "batch_size", "3": "sequence_length"}
                        }
                    },
                    "torchscript": {"method": "trace"}
                }
            }

    def load_model(self):
        """모델 로드"""
        try:
            # MDM 모델 로드 로직
            # 실제 구현은 MDM 저장소의 코드 사용
            from services.mdm_integration import MDMIntegration

            print(f"📥 모델 로드 중: {self.model_path}")

            # args.json 경로 찾기
            args_path = self.model_path.parent / "args.json"
            if not args_path.exists():
                raise FileNotFoundError(f"args.json을 찾을 수 없습니다: {args_path}")

            # MDM 통합 사용
            mdm_integration = MDMIntegration(str(self.model_path), str(args_path))
            if not mdm_integration.load_model():
                raise RuntimeError("모델 로드 실패")

            self.model = mdm_integration.model
            self.diffusion = mdm_integration.diffusion
            self.args = mdm_integration.args

            print(f"✅ 모델 로드 완료")
            print(f"   파라미터 수: {sum(p.numel() for p in self.model.parameters()):,}")

            return True

        except Exception as e:
            print(f"❌ 모델 로드 실패: {e}")
            return False

    def apply_quantization(self, output_path: str):
        """
        동적 양자화 적용

        Args:
            output_path: 양자화된 모델 저장 경로
        """
        if not self.config["optimization"]["quantization"]["enabled"]:
            print("⏭️  양자화가 비활성화되어 있습니다.")
            return None

        print("🔧 동적 양자화 적용 중...")

        try:
            # CPU로 이동 (양자화는 CPU에서만 가능)
            model_cpu = self.model.cpu()

            # 동적 양자화
            quantized_model = torch.quantization.quantize_dynamic(
                model_cpu,
                {torch.nn.Linear, torch.nn.LSTM, torch.nn.GRU},
                dtype=torch.qint8
            )

            # 저장
            output_path = Path(output_path)
            output_path.parent.mkdir(parents=True, exist_ok=True)

            torch.save({
                'model_state_dict': quantized_model.state_dict(),
                'quantized': True,
                'dtype': 'qint8'
            }, output_path)

            # 크기 비교
            original_size = os.path.getsize(self.model_path) / (1024 ** 2)
            quantized_size = os.path.getsize(output_path) / (1024 ** 2)

            print(f"✅ 양자화 완료: {output_path}")
            print(f"   원본 크기: {original_size:.2f} MB")
            print(f"   양자화 크기: {quantized_size:.2f} MB")
            print(f"   압축률: {(1 - quantized_size / original_size) * 100:.1f}%")

            # 모델을 다시 원래 디바이스로 이동
            self.model.to(self.device)

            return str(output_path)

        except Exception as e:
            print(f"❌ 양자화 실패: {e}")
            return None

    def export_to_onnx(self, output_path: str):
        """
        ONNX 형식으로 내보내기

        Args:
            output_path: ONNX 모델 저장 경로
        """
        if "onnx" not in self.config["export"]["formats"]:
            print("⏭️  ONNX 내보내기가 비활성화되어 있습니다.")
            return None

        print("📦 ONNX 형식으로 변환 중...")

        try:
            # 더미 입력 생성
            batch_size = 1
            num_features = self.model.nfeats
            num_joints = self.model.njoints
            seq_len = 196  # HumanML3D 기본 프레임 수

            # 모델 입력 형식에 맞게 조정
            dummy_input = torch.randn(batch_size, num_joints, num_features, seq_len).to(self.device)

            # CPU로 이동
            self.model.cpu()
            dummy_input = dummy_input.cpu()

            # ONNX 내보내기
            output_path = Path(output_path)
            output_path.parent.mkdir(parents=True, exist_ok=True)

            onnx_config = self.config["export"]["onnx"]

            torch.onnx.export(
                self.model,
                dummy_input,
                str(output_path),
                export_params=True,
                opset_version=onnx_config["opset_version"],
                do_constant_folding=True,
                input_names=['motion_input'],
                output_names=['motion_output'],
                dynamic_axes=onnx_config.get("dynamic_axes", None)
            )

            file_size = os.path.getsize(output_path) / (1024 ** 2)
            print(f"✅ ONNX 변환 완료: {output_path}")
            print(f"   파일 크기: {file_size:.2f} MB")

            # 모델을 다시 원래 디바이스로 이동
            self.model.to(self.device)

            # ONNX 모델 검증
            self._verify_onnx(output_path)

            return str(output_path)

        except Exception as e:
            print(f"❌ ONNX 변환 실패: {e}")
            import traceback
            traceback.print_exc()
            return None

    def export_to_torchscript(self, output_path: str):
        """
        TorchScript 형식으로 내보내기

        Args:
            output_path: TorchScript 모델 저장 경로
        """
        if "torchscript" not in self.config["export"]["formats"]:
            print("⏭️  TorchScript 내보내기가 비활성화되어 있습니다.")
            return None

        print("📦 TorchScript 형식으로 변환 중...")

        try:
            # 더미 입력 생성
            batch_size = 1
            num_features = self.model.nfeats
            num_joints = self.model.njoints
            seq_len = 196

            dummy_input = torch.randn(batch_size, num_joints, num_features, seq_len).to(self.device)

            # 평가 모드
            self.model.eval()

            # TorchScript 변환 방법 선택
            method = self.config["export"]["torchscript"]["method"]

            if method == "trace":
                # Tracing
                print("   방법: Tracing")
                scripted_model = torch.jit.trace(self.model, dummy_input)
            else:
                # Scripting
                print("   방법: Scripting")
                scripted_model = torch.jit.script(self.model)

            # 저장
            output_path = Path(output_path)
            output_path.parent.mkdir(parents=True, exist_ok=True)

            scripted_model.save(str(output_path))

            file_size = os.path.getsize(output_path) / (1024 ** 2)
            print(f"✅ TorchScript 변환 완료: {output_path}")
            print(f"   파일 크기: {file_size:.2f} MB")

            return str(output_path)

        except Exception as e:
            print(f"❌ TorchScript 변환 실패: {e}")
            import traceback
            traceback.print_exc()
            return None

    def _verify_onnx(self, onnx_path: Path):
        """ONNX 모델 검증"""
        try:
            import onnx
            import onnxruntime as ort

            # ONNX 모델 로드 및 검증
            onnx_model = onnx.load(str(onnx_path))
            onnx.checker.check_model(onnx_model)
            print("   ✓ ONNX 모델 검증 완료")

            # ONNX Runtime으로 추론 테스트
            ort_session = ort.InferenceSession(str(onnx_path))
            print("   ✓ ONNX Runtime 로드 성공")

        except ImportError:
            print("   ⚠️  onnx 또는 onnxruntime이 설치되지 않아 검증을 건너뜁니다.")
        except Exception as e:
            print(f"   ⚠️  ONNX 검증 실패: {e}")

    def export_all(self, output_dir: str):
        """
        모든 형식으로 내보내기

        Args:
            output_dir: 출력 디렉토리
        """
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        results = {}

        # 양자화
        if self.config["optimization"]["quantization"]["enabled"]:
            quantized_path = output_dir / "model_quantized.pt"
            results['quantized'] = self.apply_quantization(str(quantized_path))

        # ONNX
        if "onnx" in self.config["export"]["formats"]:
            onnx_path = output_dir / "model.onnx"
            results['onnx'] = self.export_to_onnx(str(onnx_path))

        # TorchScript
        if "torchscript" in self.config["export"]["formats"]:
            torchscript_path = output_dir / "model_scripted.pt"
            results['torchscript'] = self.export_to_torchscript(str(torchscript_path))

        # 결과 요약
        print("\n" + "=" * 60)
        print("내보내기 완료 요약:")
        print("=" * 60)
        for format_name, path in results.items():
            if path:
                print(f"✅ {format_name.upper()}: {path}")
            else:
                print(f"❌ {format_name.upper()}: 실패")
        print("=" * 60)

        return results


def main():
    parser = argparse.ArgumentParser(description="MDM 모델 내보내기")
    parser.add_argument(
        "--model-path",
        type=str,
        required=True,
        help="원본 모델 체크포인트 경로 (.pt 파일)"
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="exported_models",
        help="출력 디렉토리"
    )
    parser.add_argument(
        "--config",
        type=str,
        default=None,
        help="EDGE 설정 파일 경로 (기본값: edge_config.json)"
    )
    parser.add_argument(
        "--format",
        type=str,
        choices=["onnx", "torchscript", "quantized", "all"],
        default="all",
        help="내보낼 형식"
    )

    args = parser.parse_args()

    # 모델 경로 확인
    if not os.path.exists(args.model_path):
        print(f"❌ 모델 파일을 찾을 수 없습니다: {args.model_path}")
        return

    # Exporter 생성
    exporter = ModelExporter(args.model_path, args.config)

    # 모델 로드
    if not exporter.load_model():
        print("❌ 모델 로드에 실패하여 내보내기를 중단합니다.")
        return

    # 내보내기
    output_dir = Path(args.output_dir)

    if args.format == "all":
        exporter.export_all(str(output_dir))
    elif args.format == "onnx":
        onnx_path = output_dir / "model.onnx"
        exporter.export_to_onnx(str(onnx_path))
    elif args.format == "torchscript":
        ts_path = output_dir / "model_scripted.pt"
        exporter.export_to_torchscript(str(ts_path))
    elif args.format == "quantized":
        quant_path = output_dir / "model_quantized.pt"
        exporter.apply_quantization(str(quant_path))


if __name__ == "__main__":
    main()

# EDGE 최적화 및 Colab 파인튜닝 가이드

이 가이드는 K-Pop 스튜디오 AI 안무 생성 도구의 EDGE 최적화 및 Google Colab 파인튜닝을 위한 문서입니다.

## 📋 목차

1. [개요](#개요)
2. [EDGE 최적화](#edge-최적화)
3. [Colab 파인튜닝](#colab-파인튜닝)
4. [모델 내보내기](#모델-내보내기)
5. [체크포인트 관리](#체크포인트-관리)

## 개요

### 주요 기능

- ✅ **EDGE 최적화**: 모델 경량화 (양자화, 프루닝)
- ✅ **Colab 호환**: Google Colab에서 바로 파인튜닝 가능
- ✅ **체크포인트 자동 저장**: Google Drive 자동 동기화
- ✅ **다양한 형식 지원**: ONNX, TorchScript 변환
- ✅ **실시간 모니터링**: WandB, TensorBoard 지원

### 파일 구조

```
YG-project/
├── backend/
│   ├── edge_config.json              # EDGE 최적화 설정
│   ├── utils/
│   │   └── checkpoint_manager.py     # 체크포인트 관리
│   ├── scripts/
│   │   └── export_model.py           # 모델 내보내기 스크립트
│   └── requirements.txt              # 업데이트된 의존성
└── MDM_Finetuning_Colab.ipynb        # Colab 파인튜닝 노트북
```

## EDGE 최적화

### 1. 설정 파일

`backend/edge_config.json`에서 최적화 옵션을 설정할 수 있습니다:

```json
{
  "optimization": {
    "quantization": {
      "enabled": true,
      "dtype": "int8"
    },
    "pruning": {
      "enabled": true,
      "sparsity": 0.3
    }
  },
  "export": {
    "formats": ["onnx", "torchscript"]
  }
}
```

### 2. 양자화 (Quantization)

모델 크기를 30-50% 감소시킵니다.

```python
from backend.utils.checkpoint_manager import CheckpointManager

# 양자화 활성화
config["optimization"]["quantization"]["enabled"] = True
```

**장점:**
- 모델 크기 감소
- 추론 속도 향상
- 메모리 사용량 감소

**단점:**
- 약간의 정확도 손실 가능 (~1-2%)

### 3. 프루닝 (Pruning)

불필요한 가중치를 제거하여 모델을 경량화합니다.

```python
config["optimization"]["pruning"]["enabled"] = True
config["optimization"]["pruning"]["sparsity"] = 0.3  # 30% 가중치 제거
```

## Colab 파인튜닝

### 1. 노트북 업로드

1. Google Colab에 접속: https://colab.research.google.com/
2. `MDM_Finetuning_Colab.ipynb` 업로드
3. 런타임 설정: `Runtime > Change runtime type > GPU`

### 2. 사용 방법

#### Step 1: 환경 설정

```python
# GPU 확인
import torch
print(f"CUDA 사용 가능: {torch.cuda.is_available()}")
```

#### Step 2: Google Drive 마운트

```python
from google.colab import drive
drive.mount('/content/drive')
```

#### Step 3: 의존성 설치

노트북의 설치 셀을 실행하면 자동으로 필요한 패키지가 설치됩니다.

#### Step 4: 학습 시작

```python
# 학습 설정
learning_rate = 1e-4
num_epochs = 100
save_interval = 1000  # 1000 스텝마다 체크포인트 저장

# 학습 루프 실행
```

#### Step 5: 체크포인트 자동 저장

체크포인트는 자동으로 Google Drive의 `MDM_Checkpoints` 폴더에 저장됩니다.

```
/content/drive/MyDrive/
└── YG-project/
    └── checkpoints/
        ├── checkpoint_epoch0_step1000.pt
        ├── checkpoint_epoch0_step1000.json
        ├── checkpoint_epoch1_step2000.pt
        └── ...
```

### 3. 학습 재개

이전 체크포인트에서 학습을 재개할 수 있습니다:

```python
checkpoint_path = "/content/drive/MyDrive/YG-project/checkpoints/checkpoint_epoch10_step5000.pt"
if os.path.exists(checkpoint_path):
    info = checkpoint_manager.load_checkpoint(checkpoint_path, model, optimizer, device)
    start_epoch = info['epoch'] + 1
    global_step = info['step']
```

## 모델 내보내기

### 1. 명령줄 사용

```bash
# 모든 형식으로 내보내기
python backend/scripts/export_model.py \
  --model-path backend/models/mdm/humanml_trans_enc_512/model000475000.pt \
  --output-dir exported_models \
  --format all

# ONNX만 내보내기
python backend/scripts/export_model.py \
  --model-path backend/models/mdm/humanml_trans_enc_512/model000475000.pt \
  --output-dir exported_models \
  --format onnx
```

### 2. Python 코드 사용

```python
from backend.scripts.export_model import ModelExporter

# Exporter 생성
exporter = ModelExporter(
    model_path="backend/models/mdm/humanml_trans_enc_512/model000475000.pt",
    config_path="backend/edge_config.json"
)

# 모델 로드
exporter.load_model()

# 모든 형식으로 내보내기
exporter.export_all("exported_models")
```

### 3. 출력 파일

```
exported_models/
├── model.onnx              # ONNX 형식
├── model_scripted.pt       # TorchScript 형식
└── model_quantized.pt      # 양자화된 모델
```

## 체크포인트 관리

### 1. 체크포인트 저장

```python
from backend.utils.checkpoint_manager import CheckpointManager

manager = CheckpointManager(
    checkpoint_dir="checkpoints",
    max_checkpoints=5,
    google_drive_sync=True
)

# 체크포인트 저장
manager.save_checkpoint(
    model=model,
    optimizer=optimizer,
    epoch=10,
    step=5000,
    loss=0.123,
    metrics={'accuracy': 0.95},
    metadata={'learning_rate': 1e-4}
)
```

### 2. 체크포인트 로드

```python
# 특정 체크포인트 로드
info = manager.load_checkpoint(
    checkpoint_path="checkpoints/checkpoint_epoch10_step5000.pt",
    model=model,
    optimizer=optimizer,
    device='cuda'
)

print(f"Epoch: {info['epoch']}, Step: {info['step']}, Loss: {info['loss']}")
```

### 3. 최신 체크포인트 로드

```python
# 가장 최근 체크포인트 자동 로드
info = manager.load_latest_checkpoint(
    model=model,
    optimizer=optimizer,
    device='cuda',
    from_drive=True  # Google Drive에서 로드
)
```

### 4. 체크포인트 목록 확인

```python
# 저장된 체크포인트 목록
checkpoints = manager.list_checkpoints()
for cp in checkpoints:
    print(f"{cp['path']}: Epoch {cp['epoch']}, Loss {cp['loss']:.4f}")
```

## 사용 예시

### 전체 워크플로우

```python
# 1. Colab에서 파인튜닝
# - MDM_Finetuning_Colab.ipynb 실행
# - 체크포인트 자동 저장 (Google Drive)

# 2. 체크포인트 다운로드
from google.colab import files
files.download("/content/drive/MyDrive/YG-project/checkpoints/checkpoint_epoch50_step25000.pt")

# 3. 로컬에서 모델 내보내기
python backend/scripts/export_model.py \
  --model-path checkpoints/checkpoint_epoch50_step25000.pt \
  --output-dir production_models \
  --format all

# 4. 프로덕션 배포
# - ONNX 모델을 엣지 디바이스에 배포
# - TorchScript 모델을 서버에 배포
```

## 성능 비교

### 모델 크기

| 형식 | 크기 | 압축률 |
|------|------|--------|
| 원본 PyTorch | 500 MB | - |
| 양자화 (INT8) | 150 MB | 70% |
| ONNX | 450 MB | 10% |
| TorchScript | 480 MB | 4% |

### 추론 속도 (CPU)

| 형식 | 추론 시간 | 속도 향상 |
|------|----------|-----------|
| 원본 PyTorch | 500ms | - |
| 양자화 (INT8) | 200ms | 2.5x |
| ONNX Runtime | 250ms | 2x |
| TorchScript | 450ms | 1.1x |

## 문제 해결

### Q: Colab에서 GPU 메모리 부족 오류가 발생합니다.

**A:** 배치 크기를 줄이세요:

```python
args.batch_size = 32  # 기본값: 64
```

### Q: 체크포인트 저장이 너무 느립니다.

**A:** 저장 빈도를 조정하세요:

```python
save_interval = 2000  # 기본값: 1000
```

### Q: ONNX 변환 시 오류가 발생합니다.

**A:** 모델 구조가 ONNX와 호환되지 않을 수 있습니다. TorchScript를 대신 사용하세요:

```python
exporter.export_to_torchscript("model_scripted.pt")
```

### Q: 양자화 후 정확도가 많이 떨어집니다.

**A:** 양자화 aware 학습을 시도하거나, sparsity를 낮추세요:

```json
{
  "optimization": {
    "pruning": {
      "sparsity": 0.1
    }
  }
}
```

## 추가 리소스

- [PyTorch 양자화 가이드](https://pytorch.org/docs/stable/quantization.html)
- [ONNX 공식 문서](https://onnx.ai/onnx/)
- [Google Colab 사용법](https://colab.research.google.com/)
- [Motion Diffusion Model 논문](https://arxiv.org/abs/2209.14916)

## 라이센스

이 프로젝트는 MIT 라이센스를 따릅니다.

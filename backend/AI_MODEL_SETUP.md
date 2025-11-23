# 실제 AI 모델 설정 가이드

## 개요

현재 시스템은 모의(mock) 모션 데이터를 생성하고 있습니다. 실제 AI 모델(MDM - Motion Diffusion Model)을 사용하여 더 자연스러운 안무를 생성할 수 있습니다.

## 빠른 시작

### 1. 자동 설정 스크립트 실행

```bash
cd backend
./scripts/setup_ai_model.sh
```

이 스크립트는 다음을 수행합니다:
- PyTorch 설치 확인 및 설치
- MDM 저장소 클론
- MDM 의존성 설치
- 설정 파일 생성
- 모델 로드 테스트

### 2. 모델 다운로드

모델 파일이 없다면 다운로드해야 합니다:

```bash
# 방법 1: 자동 다운로드 (gdown 필요)
pip3.12 install gdown
python3.12 scripts/download_mdm_model.py

# 방법 2: 수동 다운로드
# 1. https://github.com/GuyTevet/motion-diffusion-model#pretrained-models 방문
# 2. HumanML3D 모델 다운로드
# 3. backend/models/mdm/humanml_trans_enc_512/model000475000.pt 에 저장
```

### 3. 서버 재시작

```bash
python3.12 -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## 수동 설정

### 1. PyTorch 설치

```bash
# CPU 버전
pip3.12 install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu

# GPU 버전 (CUDA 11.8)
pip3.12 install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
```

### 2. MDM 저장소 클론

```bash
cd backend
mkdir -p external
cd external
git clone https://github.com/GuyTevet/motion-diffusion-model.git
cd motion-diffusion-model
pip3.12 install -r requirements.txt
```

### 3. 모델 다운로드

MDM GitHub 저장소에서 HumanML3D 사전 학습 모델을 다운로드:
- 링크: https://github.com/GuyTevet/motion-diffusion-model#pretrained-models
- 저장 위치: `backend/models/mdm/humanml_trans_enc_512/model000475000.pt`

### 4. 설정 파일 확인

`backend/mdm_config.json` 파일이 올바르게 설정되었는지 확인:

```json
{
  "mdm_repo_path": "/path/to/backend/external/motion-diffusion-model",
  "model_path": "/path/to/backend/models/mdm/humanml_trans_enc_512/model000475000.pt",
  "data_path": "/path/to/backend/data",
  "dataset": "humanml"
}
```

## 모델 학습 (파인튜닝)

K-pop 안무에 특화된 모델을 만들려면 파인튜닝이 필요합니다.

### 1. 학습 데이터 준비

학습 데이터는 다음 형식이어야 합니다:

```json
[
  {
    "motion": [[[x, y, z], ...], ...],  // [frames, joints, 3]
    "text": "powerful hip-hop dance",
    "style": "hiphop"
  },
  ...
]
```

또는 NPZ 형식:
```python
import numpy as np
data = {
    'motions': np.array([...]),  # [num_samples, frames, joints, 3]
    'texts': ['text1', 'text2', ...],
    'styles': ['hiphop', 'pop', ...]
}
np.savez('training_data.npz', data=data)
```

### 2. 학습 실행

```bash
python3.12 scripts/train_model.py \
  --base_model models/mdm/humanml_trans_enc_512/model000475000.pt \
  --data training_data.json \
  --output trained_models/kpop_model \
  --epochs 100 \
  --batch_size 32 \
  --lr 1e-4
```

### 3. 학습된 모델 사용

학습이 완료되면 `mdm_config.json`에서 모델 경로를 업데이트:

```json
{
  "model_path": "trained_models/kpop_model/final_model.pt",
  ...
}
```

## 문제 해결

### 모델 로드 실패

1. **모델 파일 확인**
   ```bash
   ls -lh backend/models/mdm/humanml_trans_enc_512/model000475000.pt
   ```

2. **의존성 확인**
   ```bash
   python3.12 -c "import torch; print(torch.__version__)"
   python3.12 -c "from utils.model_util import create_model_and_diffusion; print('OK')"
   ```

3. **경로 확인**
   - `mdm_config.json`의 경로가 올바른지 확인
   - MDM 저장소가 `external/motion-diffusion-model`에 있는지 확인

### 메모리 부족

- 배치 크기 줄이기: `--batch_size 16` 또는 `--batch_size 8`
- CPU 모드 사용 (GPU가 없는 경우)
- 모델을 더 작은 버전으로 변경

### 학습 속도가 느림

- GPU 사용 (CUDA 버전 PyTorch 설치)
- 배치 크기 증가 (메모리 허용 시)
- Mixed precision training 사용

## 다음 단계

1. ✅ 실제 모델 사용 설정
2. 📊 학습 데이터 수집 및 정제
3. 🎓 모델 파인튜닝
4. 🧪 생성 품질 평가 및 개선
5. 🚀 프로덕션 배포

## 참고 자료

- MDM GitHub: https://github.com/GuyTevet/motion-diffusion-model
- HumanML3D 데이터셋: https://github.com/EricGuo5513/HumanML3D
- PyTorch 문서: https://pytorch.org/docs/stable/index.html


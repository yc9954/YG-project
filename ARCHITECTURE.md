# K-Pop 안무 생성 AI 시스템 아키텍처

## 🎯 시스템 목표

K-pop 안무 영상을 학습하여 다음을 수행하는 SOTA(State-of-the-Art) 성능의 AI 시스템:
1. **음악-안무 싱크 학습**: 오디오 비트와 안무 동작의 정확한 동기화
2. **안무 스타일 분류**: 다양한 K-pop 안무 스타일(힙합, 팝, 발라드 등) 학습
3. **반응 예측**: 어떤 안무 패턴이 시청자에게 좋은 반응을 얻는지 학습
4. **프롬프트 기반 생성**: 텍스트 프롬프트로 원하는 스타일의 안무 생성

---

## 🏗️ 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React + Three.js)               │
│  - 3D 뷰어 (안무 미리보기)                                    │
│  - 프롬프트 입력 UI                                           │
│  - 파라미터 조정 (에너지, 스타일, 싱크 등)                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ HTTP/WebSocket
                       │
┌──────────────────────▼──────────────────────────────────────┐
│              Backend API Server (FastAPI/Flask)              │
│  - 프롬프트 처리                                              │
│  - 모델 추론 요청 관리                                        │
│  - 결과 스트리밍                                              │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
┌───────▼──────┐ ┌─────▼──────┐ ┌─────▼──────┐
│ Motion Gen   │ │ Audio Sync │ │ Style      │
│ Model        │ │ Model      │ │ Classifier │
│ (Diffusion)  │ │            │ │            │
└──────────────┘ └────────────┘ └────────────┘
        │              │              │
        └──────────────┼──────────────┘
                       │
            ┌──────────▼──────────┐
            │  Response Predictor │
            │  (Engagement Model) │
            └─────────────────────┘
```

---

## 🔬 핵심 기술 스택

### 1. **모션 생성 모델 (Motion Generation)**

#### SOTA 옵션:
- **MDM (Motion Diffusion Model)** - Google Research
  - Text-to-Motion 생성
  - Diffusion 기반
  - HumanML3D 데이터셋 사용
  
- **T2M-GPT** - ByteDance
  - Transformer 기반
  - 긴 시퀀스 생성 가능
  
- **MotionGPT** - 최신 LLM 기반 접근

#### K-pop 특화 커스터마이징:
```python
# 모델 구조 예시
class KPopMotionDiffusion:
    - Base: MDM (Motion Diffusion Model)
    - Fine-tuning: K-pop 안무 데이터셋
    - Multi-modal: Audio + Text → Motion
    - Style conditioning: 힙합, 팝, 발라드 등
```

### 2. **오디오-모션 동기화 (Audio-Motion Sync)**

#### 기술:
- **Beat Detection**: Librosa, Madmom
- **Temporal Alignment**: Dynamic Time Warping (DTW)
- **Cross-modal Attention**: 오디오 특징과 모션 특징 간 어텐션

```python
# 오디오 특징 추출
audio_features = {
    'beat_times': beat_detection(audio),
    'tempo': tempo_estimation(audio),
    'energy': spectral_energy(audio),
    'mel_spectrogram': mel_spectrogram(audio)
}

# 모션-오디오 정렬
aligned_motion = align_motion_to_beat(motion, audio_features)
```

### 3. **안무 스타일 분류기 (Style Classifier)**

#### 학습 데이터:
- K-pop 안무 영상 → 스타일 라벨링
  - 힙합 (Hip-hop)
  - 팝 (Pop)
  - 발라드 (Ballad)
  - 걸크러시 (Girl Crush)
  - 컨셉추얼 (Conceptual)

#### 모델:
- **3D Pose Estimator**: MediaPipe, OpenPose
- **Style Classifier**: CNN + LSTM 또는 Transformer
- **Feature Extraction**: 모션 패턴, 속도, 공간적 배치

### 4. **반응 예측 모델 (Engagement Predictor)**

#### 데이터 수집:
- YouTube 조회수, 좋아요, 댓글 수
- 안무 구간별 반응 분석
- 시청자 피드백 데이터

#### 모델:
- **Multi-task Learning**:
  - Task 1: 조회수 예측 (회귀)
  - Task 2: 좋아요율 예측 (회귀)
  - Task 3: 바이럴 가능성 (분류)

```python
class EngagementPredictor:
    inputs = [
        motion_features,      # 안무 특징
        audio_features,       # 음악 특징
        style_features,       # 스타일 특징
        sync_score           # 싱크 점수
    ]
    outputs = {
        'view_prediction': float,
        'like_ratio': float,
        'viral_probability': float
    }
```

---

## 📊 데이터 파이프라인

### 1. **데이터 수집**
```python
# K-pop 안무 영상 수집
- YouTube API로 K-pop 뮤직비디오 수집
- 안무 영상 추출 (댄스 커버, 공연 영상)
- 메타데이터: 아티스트, 곡명, 스타일, 조회수 등
```

### 2. **데이터 전처리**
```python
# 영상 → 모션 데이터 변환
1. Pose Estimation (MediaPipe/OpenPose)
   - 2D/3D 관절 위치 추출
   - 프레임별 포즈 시퀀스 생성

2. 오디오 처리
   - 비트 추출
   - 템포 분석
   - 에너지 계산

3. 정렬 및 정규화
   - 모션-오디오 시간 정렬
   - 좌표계 정규화
   - 프레임 레이트 통일
```

### 3. **데이터셋 구조**
```
kpop_motion_dataset/
├── videos/
│   ├── newjeans_supershy.mp4
│   └── bts_dynamite.mp4
├── motions/
│   ├── newjeans_supershy.npy  # [T, J, 3] - 시간, 관절, 좌표
│   └── bts_dynamite.npy
├── audio/
│   ├── newjeans_supershy.wav
│   └── bts_dynamite.wav
├── metadata/
│   ├── newjeans_supershy.json
│   └── bts_dynamite.json
└── labels/
    ├── style_labels.csv
    └── engagement_scores.csv
```

---

## 🚀 구현 단계

### Phase 1: 데이터 수집 및 전처리
- [ ] K-pop 안무 영상 수집 스크립트
- [ ] Pose Estimation 파이프라인
- [ ] 오디오 처리 파이프라인
- [ ] 데이터 정렬 및 정규화

### Phase 2: 모델 학습
- [ ] MDM 기반 모션 생성 모델 학습
- [ ] 오디오-모션 동기화 모델 학습
- [ ] 스타일 분류기 학습
- [ ] 반응 예측 모델 학습

### Phase 3: 통합 및 최적화
- [ ] 백엔드 API 구축
- [ ] 프론트엔드-백엔드 연동
- [ ] 실시간 추론 최적화
- [ ] 모델 압축 및 배포

### Phase 4: 평가 및 개선
- [ ] 생성 품질 평가 (FID, Diversity 등)
- [ ] 사용자 테스트
- [ ] 피드백 반영 및 개선

---

## 📈 SOTA 성능 달성을 위한 핵심 요소

### 1. **대규모 데이터셋**
- 최소 10,000+ K-pop 안무 시퀀스
- 다양한 스타일과 아티스트 포함
- 고품질 포즈 추정 데이터

### 2. **멀티모달 학습**
- 텍스트 + 오디오 + 모션 동시 학습
- Cross-modal attention 메커니즘
- Temporal alignment 정확도

### 3. **도메인 특화 Fine-tuning**
- 일반 모션 데이터 → K-pop 안무 특화
- 스타일별 세부 조정
- 아티스트별 특징 학습

### 4. **평가 메트릭**
- **Motion Quality**: FID, Diversity, R-Precision
- **Audio Sync**: Beat Alignment Score
- **Style Accuracy**: Style Classification Accuracy
- **Engagement Prediction**: MAE, R² Score

---

## 🛠️ 기술 스택 상세

### Backend
- **Framework**: FastAPI (Python)
- **ML Framework**: PyTorch
- **Audio Processing**: Librosa, Madmom
- **Pose Estimation**: MediaPipe, OpenPose
- **Model Serving**: TorchServe, ONNX Runtime

### Frontend
- **Framework**: React + Vite
- **3D Rendering**: Three.js
- **UI**: Tailwind CSS
- **State Management**: React Hooks

### Infrastructure
- **GPU**: NVIDIA A100/V100 (학습)
- **Inference**: GPU 서버 또는 Edge TPU
- **Storage**: S3 또는 로컬 스토리지
- **Database**: PostgreSQL (메타데이터)

---

## 📚 참고 논문 및 리소스

1. **MDM (Motion Diffusion Model)**
   - "Human Motion Diffusion Model" - Google Research

2. **Audio-Motion Alignment**
   - "Dance to Music" - 여러 연구

3. **Style Transfer**
   - "Motion Style Transfer" - SIGGRAPH

4. **Datasets**
   - HumanML3D
   - KIT-ML
   - AIST++ (댄스 데이터셋)

---

## 🎯 다음 단계

1. **프로토타입 구축**: 간단한 모션 생성 파이프라인
2. **데이터 수집 시작**: K-pop 안무 영상 수집 자동화
3. **베이스라인 모델**: MDM 또는 T2M-GPT로 시작
4. **점진적 개선**: 도메인 특화 Fine-tuning


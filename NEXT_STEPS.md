# 다음 단계 구현 가이드

## 🎯 목표
음악 + 텍스트 프롬프트 → K-pop 안무 생성 AI 시스템 완성

---

## 📋 Phase 1: 백엔드 인프라 구축 (1-2주)

### 1.1 FastAPI 서버 설정

```python
# backend/main.py
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import uvicorn

app = FastAPI(title="K-Pop Motion Generation API")

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"status": "K-Pop Motion Generation API"}

@app.post("/api/analyze-audio")
async def analyze_audio(audio_file: UploadFile = File(...)):
    """
    오디오 파일 분석
    - 템포 (BPM)
    - 비트 타임스탬프
    - 에너지 레벨
    - 키 정보
    """
    # TODO: 오디오 분석 로직
    pass

@app.post("/api/generate-motion")
async def generate_motion(
    prompt: str,
    audio_file: UploadFile = File(...),
    style: str = "hiphop",
    energy: float = 0.75,
    smoothness: float = 0.5,
    bounce: float = 0.6,
    creativity: float = 0.4
):
    """
    음악 + 프롬프트로 안무 생성
    """
    # TODO: 모션 생성 로직
    pass

@app.get("/api/generation-status/{job_id}")
async def get_generation_status(job_id: str):
    """
    생성 작업 상태 조회
    """
    pass

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

### 1.2 프로젝트 구조

```
backend/
├── main.py                 # FastAPI 앱
├── requirements.txt        # 의존성
├── services/
│   ├── audio_processor.py # 오디오 분석
│   ├── motion_generator.py # 모션 생성
│   └── model_loader.py    # 모델 로딩
├── models/
│   └── (다운로드된 모델 파일들)
├── utils/
│   ├── audio_utils.py
│   └── motion_utils.py
└── config.py              # 설정 파일
```

### 1.3 requirements.txt

```txt
fastapi==0.104.1
uvicorn[standard]==0.24.0
python-multipart==0.0.6
numpy==1.24.3
torch==2.1.0
torchaudio==2.1.0
librosa==0.10.1
madmom==0.16.1
scipy==1.11.4
Pillow==10.1.0
```

---

## 🤖 Phase 2: AI 모델 선택 및 통합 (2-3주)

### 2.1 모션 생성 모델 옵션

#### 옵션 A: MDM (Motion Diffusion Model) - 추천 ⭐
**장점:**
- Text-to-Motion 생성에 최적화
- Diffusion 기반으로 고품질 생성
- HumanML3D 데이터셋으로 학습됨
- 오픈소스 (GitHub에서 다운로드 가능)

**단점:**
- K-pop 특화 데이터로 Fine-tuning 필요
- 오디오 동기화 기능 없음 (별도 구현 필요)

**통합 방법:**
```python
# backend/services/motion_generator.py
import torch
from mdm.model import MDM
from mdm.sample import generate

class MotionGenerator:
    def __init__(self):
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.model = self.load_mdm_model()
        
    def load_mdm_model(self):
        # MDM 모델 로드
        model_path = "models/mdm_humanml3d_ft/model.npz"
        model = MDM(...)
        # 가중치 로드
        return model.to(self.device)
    
    def generate(self, prompt, style, audio_features=None):
        # 1. 프롬프트 임베딩
        # 2. 스타일 조건부 생성
        # 3. 모션 생성
        motion = generate(
            model=self.model,
            caption=prompt,
            length=audio_features['duration'] if audio_features else 10.0,
            ...
        )
        return motion
```

**리소스:**
- GitHub: https://github.com/GuyTevet/motion-diffusion-model
- 논문: "Human Motion Diffusion Model"
- 사전 학습 모델 다운로드 필요

#### 옵션 B: T2M-GPT
**장점:**
- Transformer 기반으로 긴 시퀀스 생성 가능
- ByteDance에서 개발

**단점:**
- 코드/모델 접근성 낮을 수 있음

#### 옵션 C: MotionGPT
**장점:**
- LLM 기반으로 자연어 이해 우수

**단점:**
- 최신 모델이라 안정성 검증 필요

### 2.2 오디오 분석 모델

```python
# backend/services/audio_processor.py
import librosa
import madmom
import numpy as np

class AudioProcessor:
    def analyze(self, audio_path):
        """
        오디오 파일 분석
        """
        # 1. 템포 추정
        tempo, beats = librosa.beat.beat_track(
            y=audio, sr=sr, units='time'
        )
        
        # 2. 비트 감지 (더 정확)
        proc = madmom.features.beats.DBNBeatTrackingProcessor(fps=100)
        act = madmom.features.beats.RNNBeatProcessor()(audio_path)
        beats = proc(act)
        
        # 3. 에너지 계산
        energy = np.mean(librosa.feature.rms(y=audio))
        
        # 4. 키 추정
        key = self.estimate_key(audio)
        
        return {
            'tempo': float(tempo),
            'beats': beats.tolist(),
            'energy': float(energy),
            'duration': float(librosa.get_duration(y=audio, sr=sr)),
            'key': key
        }
```

### 2.3 오디오-모션 동기화

```python
# backend/services/audio_sync.py
from scipy.interpolate import interp1d

class AudioMotionSync:
    def align_motion_to_beat(self, motion, audio_features):
        """
        모션을 오디오 비트에 맞춰 정렬
        """
        beats = audio_features['beats']
        motion_frames = len(motion)
        
        # 비트 타임스탬프를 프레임 인덱스로 변환
        fps = 30  # 모션 FPS
        beat_frames = [int(b * fps) for b in beats]
        
        # 모션을 비트에 맞춰 리샘플링
        aligned_motion = self.resample_motion(motion, beat_frames)
        
        return aligned_motion
```

---

## 🎨 Phase 3: K-pop 특화 Fine-tuning (3-4주)

### 3.1 데이터 수집

```python
# scripts/collect_kpop_data.py
import yt_dlp
import cv2
from pose_estimator import PoseEstimator

class KPopDataCollector:
    def collect_videos(self, video_urls):
        """
        YouTube에서 K-pop 안무 영상 수집
        """
        ydl_opts = {
            'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]',
            'outtmpl': 'data/videos/%(title)s.%(ext)s',
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            for url in video_urls:
                ydl.download([url])
    
    def extract_motion(self, video_path):
        """
        영상에서 모션 데이터 추출
        """
        pose_estimator = PoseEstimator()
        motions = []
        
        cap = cv2.VideoCapture(video_path)
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            
            # 포즈 추정
            pose = pose_estimator.estimate(frame)
            motions.append(pose)
        
        return np.array(motions)
```

### 3.2 데이터 전처리

```python
# scripts/preprocess_data.py
import numpy as np
from scipy import signal

class DataPreprocessor:
    def normalize_motion(self, motion):
        """
        모션 데이터 정규화
        - 좌표계 통일
        - 스케일 정규화
        - 프레임 레이트 통일
        """
        # 1. 루트 관절(엉덩이)을 원점으로 이동
        motion = motion - motion[:, 0:1, :]  # 첫 번째 관절이 루트
        
        # 2. 스케일 정규화
        motion = motion / np.std(motion)
        
        # 3. FPS 통일 (30fps로 리샘플링)
        if len(motion) != target_frames:
            motion = signal.resample(motion, target_frames)
        
        return motion
    
    def align_with_audio(self, motion, audio_beats):
        """
        모션을 오디오 비트에 정렬
        """
        # Dynamic Time Warping 사용
        from dtaidistance import dtw
        alignment = dtw.warp(motion, audio_beats)
        return alignment
```

### 3.3 Fine-tuning

```python
# scripts/finetune_mdm.py
import torch
from torch.utils.data import Dataset, DataLoader
from mdm.model import MDM

class KPopMotionDataset(Dataset):
    def __init__(self, motion_files, captions):
        self.motions = [np.load(f) for f in motion_files]
        self.captions = captions
    
    def __len__(self):
        return len(self.motions)
    
    def __getitem__(self, idx):
        return {
            'motion': self.motions[idx],
            'caption': self.captions[idx]
        }

def finetune_mdm():
    # 1. 사전 학습된 MDM 모델 로드
    model = MDM(...)
    model.load_state_dict(torch.load('models/mdm_pretrained.pth'))
    
    # 2. K-pop 데이터셋 로드
    dataset = KPopMotionDataset(...)
    dataloader = DataLoader(dataset, batch_size=32)
    
    # 3. Fine-tuning
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-4)
    
    for epoch in range(10):
        for batch in dataloader:
            # Forward pass
            loss = model(batch['motion'], batch['caption'])
            
            # Backward pass
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
    
    # 4. 모델 저장
    torch.save(model.state_dict(), 'models/mdm_kpop_finetuned.pth')
```

---

## 🔗 Phase 4: 프론트엔드-백엔드 연동 (1주)

### 4.1 API 클라이언트 생성

```javascript
// frontend/services/api.js
const API_BASE_URL = 'http://localhost:8000';

export const analyzeAudio = async (audioFile) => {
  const formData = new FormData();
  formData.append('audio_file', audioFile);
  
  const response = await fetch(`${API_BASE_URL}/api/analyze-audio`, {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    throw new Error('Audio analysis failed');
  }
  
  return response.json();
};

export const generateMotion = async (prompt, audioFile, params) => {
  const formData = new FormData();
  formData.append('audio_file', audioFile);
  formData.append('prompt', prompt);
  formData.append('style', params.style);
  formData.append('energy', params.energy);
  formData.append('smoothness', params.smoothness);
  formData.append('bounce', params.bounce);
  formData.append('creativity', params.creativity);
  
  const response = await fetch(`${API_BASE_URL}/api/generate-motion`, {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    throw new Error('Motion generation failed');
  }
  
  return response.json();
};

export const getGenerationStatus = async (jobId) => {
  const response = await fetch(`${API_BASE_URL}/api/generation-status/${jobId}`);
  return response.json();
};
```

### 4.2 프론트엔드 수정

```javascript
// Sota_KPop_Studio.jsx에 추가
import { analyzeAudio, generateMotion, getGenerationStatus } from './services/api';

// handleAudioUpload 수정
const handleAudioUpload = async (e) => {
  const file = e.target.files[0];
  if (file) {
    setAudioFile(file);
    setIsAnalyzingAudio(true);
    
    try {
      const analysis = await analyzeAudio(file);
      setAudioAnalysis(analysis);
      setTotalDuration(analysis.duration);
      // ...
    } catch (error) {
      alert('오디오 분석 실패: ' + error.message);
    } finally {
      setIsAnalyzingAudio(false);
    }
  }
};

// handleGenerateMotion 수정
const handleGenerateMotion = async () => {
  // ... 검증 코드 ...
  
  setIsGenerating(true);
  setGenerationProgress(0);
  
  try {
    const result = await generateMotion(prompt, audioFile, {
      style: selectedStyle,
      ...params
    });
    
    // 폴링으로 진행 상황 확인
    const pollStatus = async () => {
      const status = await getGenerationStatus(result.job_id);
      setGenerationProgress(status.progress);
      
      if (status.status === 'completed') {
        // 생성된 모션 데이터를 타임라인에 추가
        setTracks(prev => ({
          ...prev,
          motion: [{
            id: `motion_${Date.now()}`,
            start: 0,
            duration: 100,
            name: `${selectedStyle} - ${prompt.substring(0, 15)}...`,
            active: true,
            motionData: status.motion_data, // 실제 모션 데이터
            ...
          }]
        }));
        setIsGenerating(false);
      } else if (status.status === 'processing') {
        setTimeout(pollStatus, 1000);
      }
    };
    
    pollStatus();
  } catch (error) {
    alert('안무 생성 실패: ' + error.message);
    setIsGenerating(false);
  }
};
```

---

## 🚀 Phase 5: 배포 및 최적화 (1-2주)

### 5.1 모델 최적화

```python
# 모델 양자화 및 최적화
import torch.quantization as quantization

def optimize_model(model):
    # 1. 모델 양자화
    quantized_model = quantization.quantize_dynamic(
        model, {torch.nn.Linear}, dtype=torch.qint8
    )
    
    # 2. ONNX 변환 (더 빠른 추론)
    torch.onnx.export(
        model,
        dummy_input,
        "models/mdm_optimized.onnx",
        opset_version=11
    )
    
    return quantized_model
```

### 5.2 GPU 서버 설정

```dockerfile
# Dockerfile
FROM nvidia/cuda:11.8.0-cudnn8-runtime-ubuntu22.04

WORKDIR /app

# Python 설치
RUN apt-get update && apt-get install -y python3.10 python3-pip

# 의존성 설치
COPY requirements.txt .
RUN pip install -r requirements.txt

# 모델 파일 복사
COPY models/ ./models/
COPY backend/ ./backend/

# 서버 실행
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 5.3 배포 옵션

1. **로컬 개발**: `uvicorn backend.main:app --reload`
2. **클라우드 (AWS/GCP)**: GPU 인스턴스에 배포
3. **Docker**: 컨테이너화하여 배포
4. **Edge 배포**: ONNX Runtime으로 모바일/엣지 디바이스

---

## 📊 우선순위 및 타임라인

### Week 1-2: 백엔드 인프라
- [ ] FastAPI 서버 구축
- [ ] 오디오 분석 파이프라인
- [ ] 기본 API 엔드포인트

### Week 3-4: 모델 통합
- [ ] MDM 모델 다운로드 및 로드
- [ ] 기본 Text-to-Motion 생성 테스트
- [ ] 오디오 분석 통합

### Week 5-6: 오디오-모션 동기화
- [ ] 비트 감지 및 정렬
- [ ] 모션 리샘플링
- [ ] 동기화 테스트

### Week 7-10: Fine-tuning
- [ ] K-pop 데이터 수집
- [ ] 데이터 전처리
- [ ] Fine-tuning 실행
- [ ] 모델 평가

### Week 11: 프론트엔드 연동
- [ ] API 클라이언트 구현
- [ ] 실시간 상태 업데이트
- [ ] 에러 처리

### Week 12: 배포 및 최적화
- [ ] 모델 최적화
- [ ] 성능 튜닝
- [ ] 배포

---

## 🎯 빠른 시작 (MVP)

최소 기능으로 빠르게 시작하려면:

1. **MDM 모델 다운로드** (사전 학습된 모델 사용)
2. **오디오 분석만 구현** (librosa 사용)
3. **기본 Text-to-Motion 생성** (오디오 동기화는 나중에)
4. **프론트엔드 연동**

이렇게 하면 2-3주 안에 기본 버전을 만들 수 있습니다.

---

## 📚 참고 리소스

### 모델
- MDM: https://github.com/GuyTevet/motion-diffusion-model
- HumanML3D Dataset: https://github.com/EricGuo5513/HumanML3D

### 오디오 처리
- Librosa: https://librosa.org/
- Madmom: https://github.com/CPJKU/madmom

### 포즈 추정
- MediaPipe: https://mediapipe.dev/
- OpenPose: https://github.com/CMU-Perceptual-Computing-Lab/openpose

### 학습 데이터
- AIST++: 댄스 데이터셋
- YouTube K-pop 안무 영상

---

## 💡 팁

1. **점진적 개발**: 먼저 기본 기능부터, 나중에 고급 기능 추가
2. **모델 캐싱**: 모델을 한 번만 로드하고 재사용
3. **비동기 처리**: 긴 작업은 백그라운드에서 처리
4. **에러 처리**: 모든 API 호출에 try-catch 추가
5. **로깅**: 디버깅을 위해 상세한 로그 남기기


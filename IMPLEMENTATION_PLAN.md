# 구현 계획 및 코드 구조

## 현재 상태 분석

현재 `Sota_KPop_Studio.jsx`는 **프론트엔드 UI만** 구현되어 있으며:
- ✅ 3D 뷰어 (Three.js)
- ✅ UI 컴포넌트 (타임라인, 컨트롤 패널)
- ❌ 실제 AI 모델 통합 없음
- ❌ 백엔드 API 없음
- ❌ 데이터 처리 파이프라인 없음

---

## 단계별 구현 계획

### Phase 1: 백엔드 API 구축 (우선순위: 높음)

#### 1.1 FastAPI 서버 생성
```python
# backend/main.py
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="K-Pop Motion Generation API")

# CORS 설정 (프론트엔드와 통신)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/generate-motion")
async def generate_motion(
    prompt: str,
    audio_file: UploadFile = None,
    style: str = "hiphop",
    energy: float = 0.75
):
    """
    프롬프트 기반 안무 생성
    """
    # TODO: 모델 추론 로직
    return {"status": "generating", "motion_id": "..."}

@app.post("/api/analyze-audio")
async def analyze_audio(audio_file: UploadFile):
    """
    오디오 분석 (비트, 템포 등)
    """
    # TODO: 오디오 처리
    return {"beats": [...], "tempo": 120}
```

#### 1.2 모델 추론 서비스
```python
# backend/services/motion_generator.py
class MotionGenerator:
    def __init__(self):
        # TODO: 모델 로드
        self.model = None
    
    def generate(self, prompt, style, audio_features=None):
        """
        안무 생성
        """
        # 1. 프롬프트 임베딩
        # 2. 스타일 조건부 생성
        # 3. 오디오 싱크 조정
        # 4. 모션 시퀀스 생성
        pass
```

### Phase 2: 데이터 처리 파이프라인

#### 2.1 포즈 추정
```python
# backend/processors/pose_estimator.py
import mediapipe as mp

class PoseEstimator:
    def extract_motion(self, video_path):
        """
        영상에서 모션 데이터 추출
        """
        # MediaPipe로 포즈 추정
        # 3D 좌표 변환
        # 시퀀스 생성
        pass
```

#### 2.2 오디오 처리
```python
# backend/processors/audio_processor.py
import librosa

class AudioProcessor:
    def extract_features(self, audio_path):
        """
        오디오 특징 추출
        """
        # 비트 감지
        # 템포 추정
        # 에너지 계산
        pass
```

### Phase 3: 프론트엔드-백엔드 연동

#### 3.1 API 클라이언트
```javascript
// frontend/services/api.js
export const generateMotion = async (prompt, params) => {
  const response = await fetch('http://localhost:8000/api/generate-motion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, ...params })
  });
  return response.json();
};
```

#### 3.2 실시간 업데이트
```javascript
// WebSocket 또는 Server-Sent Events로 실시간 생성 진행 상황 전송
```

---

## 빠른 시작: 프로토타입 구현

### 옵션 1: 모의(Mock) 백엔드로 시작
실제 모델 없이도 UI 테스트 가능

### 옵션 2: 기존 모델 통합
- MDM 모델 다운로드 및 통합
- 또는 Hugging Face의 Motion Generation 모델 사용

### 옵션 3: 간단한 규칙 기반 생성
복잡한 AI 없이도 기본 기능 구현

---

## 필요한 파일 구조

```
YG project/
├── frontend/
│   ├── Sota_KPop_Studio.jsx
│   ├── services/
│   │   └── api.js          # API 클라이언트
│   └── ...
├── backend/
│   ├── main.py             # FastAPI 서버
│   ├── models/
│   │   └── motion_generator.py
│   ├── processors/
│   │   ├── pose_estimator.py
│   │   └── audio_processor.py
│   └── requirements.txt
└── data/
    ├── videos/
    ├── motions/
    └── audio/
```

---

## 다음 작업 제안

1. **백엔드 API 서버 생성** (FastAPI)
2. **프론트엔드 API 연동 코드 추가**
3. **모의 데이터로 UI 테스트**
4. **실제 모델 통합 준비**

어떤 것부터 시작할까요?


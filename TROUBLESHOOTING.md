# 문제 해결 가이드

## 안무 생성 실패 문제

### 1. 에러 로그 확인 방법

#### 백엔드 로그 확인
백엔드 서버를 실행한 터미널에서 다음 로그를 확인:

```
❌ 모션 생성 오류 (job_id: ...):
   에러 메시지: ...
   상세 트레이스:
   ...
```

#### 프론트엔드 콘솔 확인
브라우저 개발자 도구(F12) → Console 탭에서:
```
❌ 모션 생성 오류: ...
```

---

## 🔍 일반적인 문제들

### 문제 1: "생성 실패: ..."

**원인**: 모션 생성 중 예외 발생

**해결**:
1. 백엔드 터미널에서 상세 에러 로그 확인
2. 에러 메시지에 따라 수정

### 문제 2: 모의 모드로 작동

**현재 상태**: 정상 (MDM 데이터셋이 없어서 모의 모드 사용)

**확인**:
- 백엔드 로그에 `✅ 모델 로드 완료 (모의 모드)` 표시
- 모의 모드로도 모션 생성은 작동함

### 문제 3: API 요청 실패

**증상**: 프론트엔드에서 "Failed to fetch" 에러

**해결**:
1. 백엔드 서버가 실행 중인지 확인: `curl http://localhost:8000/health`
2. CORS 설정 확인
3. 네트워크 탭에서 요청 상태 확인

---

## 🛠️ 디버깅 단계

### Step 1: 백엔드 로그 확인
```bash
# 백엔드 터미널에서 에러 로그 확인
# ❌ 모션 생성 오류: ... 부분 확인
```

### Step 2: 프론트엔드 콘솔 확인
```javascript
// 브라우저 콘솔에서
// ❌ 모션 생성 오류: ... 확인
```

### Step 3: API 직접 테스트
```bash
# http://localhost:8000/docs 접속
# /api/generate-motion 엔드포인트 테스트
```

---

## ✅ 정상 작동 확인

다음 로그가 보이면 정상:
- 백엔드: `✅ 모델 로드 완료 (모의 모드)`
- 프론트엔드: `✅ 모션 생성 완료`
- 타임라인에 모션이 추가됨

---

## 📦 패키지 및 의존성 문제

### MediaPipe 관련 오류

#### ❌ `NameError: name 'core' is not defined`

**원인**: MediaPipe와 Python 버전 호환성 문제 (특히 Python 3.12)

**해결 방법**:

##### 방법 1: MediaPipe 버전 업데이트 (권장)
```bash
pip uninstall mediapipe
pip install mediapipe==0.10.9
```

##### 방법 2: Google Colab에서
```python
# 노트북 셀에서 실행
!pip install -q opencv-python-headless==4.9.0.80
!pip install -q mediapipe==0.10.9

# Runtime 재시작 필요
# Runtime > Restart runtime
```

##### 방법 3: Python 다운그레이드
```bash
# Python 3.11 사용 (가장 안정적)
pyenv install 3.11.7
pyenv local 3.11.7
```

#### ❌ `ImportError: cannot import name 'core'`

**원인**: MediaPipe 패키지 손상 또는 불완전한 설치

**해결 방법**:
```bash
# 완전 제거 및 재설치
pip uninstall -y mediapipe opencv-python opencv-python-headless
pip cache purge
pip install opencv-python-headless==4.9.0.80
pip install mediapipe==0.10.9
```

### OpenCV 관련 오류

#### ❌ `ImportError: libGL.so.1: cannot open shared object file`

**원인**: 서버/Docker 환경에서 GUI 라이브러리 누락

**해결 방법**:
```bash
# Ubuntu/Debian
apt-get update
apt-get install -y libgl1-mesa-glx libglib2.0-0

# opencv-python 대신 headless 버전 사용
pip install opencv-python-headless
```

### CUDA/PyTorch 관련 오류

#### ❌ `RuntimeError: CUDA out of memory`

**해결 방법**:
1. Batch size 줄이기:
```python
config.batch_size = 2  # 기본값 4에서 줄이기
```

2. 모델 복잡도 낮추기:
```python
mp_pose.Pose(
    model_complexity=1,  # 2 대신 1 사용
)
```

### 권장 패키지 버전

#### Python 3.11 (가장 안정적)
```txt
torch>=2.1.0
mediapipe==0.10.9
opencv-python-headless==4.9.0.80
numpy>=1.26.0
```

#### Python 3.12 (최신)
```txt
torch>=2.1.0
mediapipe==0.10.9  # 필수!
opencv-python-headless==4.9.0.80
numpy>=1.26.0
```

### 디버깅 팁

#### 버전 확인
```python
import sys
import torch
import mediapipe as mp
import cv2

print(f"Python: {sys.version}")
print(f"PyTorch: {torch.__version__}")
print(f"MediaPipe: {mp.__version__}")
print(f"OpenCV: {cv2.__version__}")
print(f"CUDA: {torch.cuda.is_available()}")
```

#### MediaPipe 단독 테스트
```python
import mediapipe as mp
mp_pose = mp.solutions.pose
pose = mp_pose.Pose()
print("✅ MediaPipe 정상 작동")
pose.close()
```


# K-Pop Motion Generation Backend

FastAPI 기반 백엔드 서버

## 설치

```bash
# 가상 환경 생성
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 의존성 설치
pip install -r requirements.txt
```

## 실행

```bash
# 개발 모드
python main.py

# 또는
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

서버가 실행되면:
- API 문서: http://localhost:8000/docs
- API 엔드포인트: http://localhost:8000

## API 엔드포인트

### 1. 오디오 분석
```
POST /api/analyze-audio
Content-Type: multipart/form-data

파라미터:
- audio_file: 오디오 파일

응답:
{
  "tempo": 120.0,
  "beats": [0.5, 1.0, 1.5, ...],
  "energy": 0.75,
  "duration": 120.0,
  "key": "C major"
}
```

### 2. 안무 생성
```
POST /api/generate-motion
Content-Type: multipart/form-data

파라미터:
- audio_file: 오디오 파일
- prompt: 텍스트 프롬프트
- style: 스타일 (hiphop, pop, ballad 등)
- energy: 0.75
- smoothness: 0.5
- bounce: 0.6
- creativity: 0.4

응답:
{
  "job_id": "uuid",
  "status": "pending",
  "message": "안무 생성이 시작되었습니다."
}
```

### 3. 생성 상태 조회
```
GET /api/generation-status/{job_id}

응답:
{
  "job_id": "uuid",
  "status": "processing",  # pending, processing, completed, failed
  "progress": 50,
  "message": "모션 생성 중...",
  "motion_data": {...}  # 완료 시
}
```

## 다음 단계

1. **오디오 분석 구현**: `services/audio_processor.py` 완성
2. **모션 생성 모델 통합**: MDM 또는 다른 모델 추가
3. **오디오-모션 동기화**: 비트 정렬 알고리즘 구현
4. **Fine-tuning**: K-pop 데이터로 모델 학습

자세한 내용은 `../NEXT_STEPS.md` 참고


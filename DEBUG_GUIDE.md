# 백엔드 응답 확인 가이드

## 🔍 방법 1: 브라우저 개발자 도구 (가장 쉬움)

### 1. 콘솔 탭 확인
1. 브라우저에서 **F12** 또는 **Cmd+Option+I** (Mac) / **Ctrl+Shift+I** (Windows) 누르기
2. **Console** 탭 열기
3. 오디오 파일 업로드
4. 콘솔에서 다음 로그 확인:
   - `🎵 오디오 분석 요청 시작:` - 요청이 시작되었는지 확인
   - `📡 백엔드 응답 상태:` - 응답 상태 코드 확인
   - `✅ 백엔드 분석 결과:` - 실제 분석 데이터 확인
   - `❌` - 에러가 있으면 여기서 확인

### 2. 네트워크 탭 확인
1. 개발자 도구에서 **Network** 탭 열기
2. 오디오 파일 업로드
3. `/api/analyze-audio` 요청 찾기
4. 클릭하여 확인:
   - **Headers**: 요청/응답 헤더 확인
   - **Preview**: 응답 데이터 미리보기
   - **Response**: 실제 응답 내용
   - **Status**: 상태 코드 (200 = 성공)

### 3. 응답 확인 예시
```
✅ 백엔드 분석 결과: {
  tempo: 124.5,
  duration: 189.23,
  energy: 0.59,
  key: "A major",
  beatsCount: 94
}
```

---

## 🔍 방법 2: 백엔드 로그 확인

### 터미널에서 확인
백엔드 서버를 실행한 터미널에서:
```
INFO:     127.0.0.1:xxxxx - "POST /api/analyze-audio HTTP/1.1" 200 OK
```

### 상세 로그 보기
백엔드 코드에 로그 추가 (선택사항):
```python
# backend/main.py
import logging
logging.basicConfig(level=logging.INFO)

@app.post("/api/analyze-audio")
async def analyze_audio(audio_file: UploadFile = File(...)):
    logging.info(f"오디오 파일 수신: {audio_file.filename}")
    # ... 분석 코드 ...
    logging.info(f"분석 완료: tempo={analysis['tempo']}, duration={analysis['duration']}")
    return analysis
```

---

## 🔍 방법 3: API 직접 테스트

### curl 명령어
```bash
curl -X POST http://localhost:8000/api/analyze-audio \
  -F "audio_file=@your_audio.mp3" \
  -v
```

### 브라우저에서 API 문서 확인
1. http://localhost:8000/docs 접속
2. `/api/analyze-audio` 엔드포인트 찾기
3. "Try it out" 클릭
4. 오디오 파일 업로드
5. "Execute" 클릭
6. 응답 확인

---

## 🔍 방법 4: 프론트엔드 코드에 디버깅 추가

이미 추가된 로그:
- `console.log('🎵 오디오 분석 요청 시작:')` - 요청 시작
- `console.log('📡 백엔드 응답 상태:')` - 응답 상태
- `console.log('✅ 백엔드 분석 결과:')` - 분석 결과
- `console.error('❌')` - 에러 발생

---

## 🐛 문제 해결

### 문제 1: CORS 오류
**증상**: 콘솔에 `CORS policy` 에러
**해결**: 백엔드 CORS 설정 확인

### 문제 2: 404 Not Found
**증상**: 네트워크 탭에서 404 에러
**해결**: API URL 확인 (`http://localhost:8000/api/analyze-audio`)

### 문제 3: 500 Internal Server Error
**증상**: 백엔드에서 500 에러
**해결**: 백엔드 로그 확인, librosa 설치 확인

### 문제 4: 응답이 오지 않음
**증상**: 네트워크 탭에서 요청이 pending 상태
**해결**: 
- 백엔드 서버가 실행 중인지 확인
- `http://localhost:8000/health` 접속 테스트

---

## ✅ 정상 작동 확인 체크리스트

- [ ] 브라우저 콘솔에 `🎵 오디오 분석 요청 시작:` 로그가 보임
- [ ] 네트워크 탭에서 `/api/analyze-audio` 요청이 200 OK
- [ ] 콘솔에 `✅ 백엔드 분석 결과:` 로그가 보임
- [ ] 실제 음악 길이와 일치하는 duration 값
- [ ] 템포, 에너지, 키 값이 표시됨

---

## 💡 팁

1. **항상 콘솔 확인**: 개발 중에는 콘솔을 열어두고 확인
2. **네트워크 탭 활용**: 요청/응답을 자세히 확인
3. **백엔드 로그 확인**: 서버 터미널에서 에러 확인
4. **API 문서 활용**: `/docs`에서 직접 테스트


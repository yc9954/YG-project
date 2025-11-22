# 실행 가이드

## 🚀 빠른 실행

### 백엔드 실행

```bash
cd backend
python3.12 main.py
```

또는:

```bash
cd backend
python3.12 -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**확인**: http://localhost:8000/health 접속 → `{"status":"healthy"}` 응답 확인

---

### 프론트엔드 실행

```bash
npm run dev
```

**확인**: http://localhost:5173 접속 → UI 표시 확인

---

## 📋 전체 실행 순서

### 1. 백엔드 서버 시작 (터미널 1)

```bash
cd "/Users/iyuchan/YG project/backend"
python3.12 main.py
```

**예상 출력**:
```
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### 2. 프론트엔드 서버 시작 (터미널 2)

```bash
cd "/Users/iyuchan/YG project"
npm run dev
```

**예상 출력**:
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

### 3. 브라우저에서 접속

- 프론트엔드: http://localhost:5173
- 백엔드 API 문서: http://localhost:8000/docs

---

## 🔍 실행 확인

### 백엔드 확인

```bash
curl http://localhost:8000/health
```

**예상 응답**: `{"status":"healthy"}`

### 프론트엔드 확인

브라우저에서 http://localhost:5173 접속하여 UI가 표시되는지 확인

---

## ⚠️ 문제 해결

### 백엔드가 실행되지 않을 때

```bash
# Python 버전 확인
python3.12 --version

# 의존성 확인
cd backend
python3.12 -c "import fastapi; print('OK')"

# 포트가 이미 사용 중일 때
lsof -ti:8000 | xargs kill -9
```

### 프론트엔드가 실행되지 않을 때

```bash
# 의존성 설치
npm install

# 포트가 이미 사용 중일 때
lsof -ti:5173 | xargs kill -9
```

---

## 📝 한 줄 명령어 (백그라운드 실행)

### 백엔드 (백그라운드)

```bash
cd "/Users/iyuchan/YG project/backend" && python3.12 main.py &
```

### 프론트엔드 (백그라운드)

```bash
cd "/Users/iyuchan/YG project" && npm run dev &
```

---

## 🛑 서버 종료

### 백엔드 종료
터미널에서 `Ctrl+C` 또는:
```bash
lsof -ti:8000 | xargs kill -9
```

### 프론트엔드 종료
터미널에서 `Ctrl+C` 또는:
```bash
lsof -ti:5173 | xargs kill -9
```

---

## ⚠️ 포트 충돌 해결

### 포트가 이미 사용 중일 때

```bash
# 백엔드 포트 (8000) 해제
lsof -ti:8000 | xargs kill -9

# 프론트엔드 포트 (5173) 해제
lsof -ti:5173 | xargs kill -9

# 또는 한 번에 해제
lsof -ti:8000,5173 | xargs kill -9
```

### 포트 확인

```bash
# 8000 포트 확인
lsof -i:8000

# 5173 포트 확인
lsof -i:5173
```

---

## 💡 팁

1. **두 개의 터미널 사용**: 백엔드와 프론트엔드를 각각 다른 터미널에서 실행
2. **로그 확인**: 각 터미널에서 로그를 확인하여 문제 파악
3. **포트 확인**: 8000(백엔드), 5173(프론트엔드) 포트가 사용 가능한지 확인


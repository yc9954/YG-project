#!/bin/bash
# 백엔드 서버 실행 스크립트 (파일 크기 제한 증가)

# Starlette의 기본 본문 크기 제한은 약 1MB입니다.
# 큰 파일을 처리하려면 환경 변수나 uvicorn 설정을 조정해야 합니다.

# Python 환경 활성화 (필요시)
# source venv/bin/activate

# uvicorn 실행 (파일 크기 제한 증가)
# 참고: Starlette의 본문 크기 제한은 코드에서 직접 설정해야 합니다.
python3.12 -m uvicorn main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --reload \
    --limit-concurrency 1000 \
    --limit-max-requests 10000 \
    --timeout-keep-alive 30


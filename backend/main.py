"""
K-Pop Motion Generation API
FastAPI 백엔드 서버
"""
from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse, StreamingResponse, Response
from starlette.background import BackgroundTask
from pydantic import BaseModel
from typing import Optional
import uvicorn
import os
from datetime import datetime
import uuid
import logging

# 로깅 설정
logging.basicConfig(level=logging.INFO)

# 서비스 임포트
from services.audio_processor import AudioProcessor
from services.motion_generator import MotionGenerator

app = FastAPI(
    title="K-Pop Motion Generation API",
    description="음악과 텍스트 프롬프트로 K-pop 안무를 생성하는 AI API",
    version="1.0.0"
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite 개발 서버
        "http://localhost:3000",  # React 개발 서버
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 전역 변수
audio_processor = AudioProcessor()
motion_generator = MotionGenerator()

# 작업 상태 저장 (실제로는 Redis나 DB 사용)
generation_jobs = {}


# 요청/응답 모델
class MotionGenerationRequest(BaseModel):
    prompt: str
    style: str = "hiphop"
    energy: float = 0.75
    smoothness: float = 0.5
    bounce: float = 0.6
    creativity: float = 0.4


class AudioAnalysisResponse(BaseModel):
    tempo: float
    beats: list
    energy: float
    duration: float
    key: str
    recommended_style: str = "hiphop"


class GenerationStatusResponse(BaseModel):
    job_id: str
    status: str  # "pending", "processing", "completed", "failed"
    progress: int  # 0-100
    message: Optional[str] = None
    motion_data: Optional[dict] = None


# API 엔드포인트

@app.get("/")
async def root():
    return {
        "status": "K-Pop Motion Generation API",
        "version": "1.0.0",
        "endpoints": {
            "analyze_audio": "/api/analyze-audio",
            "generate_motion": "/api/generate-motion",
            "generation_status": "/api/generation-status/{job_id}"
        }
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.post("/api/analyze-audio", response_model=AudioAnalysisResponse)
async def analyze_audio(audio_file: UploadFile = File(...)):
    """
    오디오 파일 분석
    - 템포 (BPM)
    - 비트 타임스탬프
    - 에너지 레벨
    - 키 정보
    - 길이
    """
    try:
        # 파일 읽기
        content = await audio_file.read()
        
        # 파일 크기 확인 (100MB 제한)
        file_size = len(content)
        if file_size > 100 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Audio file size exceeds 100MB limit")
        
        # 임시 파일 저장
        temp_path = f"temp/{uuid.uuid4()}_{audio_file.filename}"
        os.makedirs("temp", exist_ok=True)
        
        with open(temp_path, "wb") as f:
            f.write(content)
        
        # 실제 오디오 분석
        analysis = audio_processor.analyze(temp_path)
        
        # 임시 파일 삭제
        os.remove(temp_path)
        
        return AudioAnalysisResponse(**analysis)
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Audio analysis error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Audio analysis failed: {str(e)}")


@app.post("/api/generate-motion")
async def generate_motion(
    background_tasks: BackgroundTasks,
    prompt: str = Form(..., max_length=1000),
    audio_file: UploadFile = File(...),
    style: str = Form("hiphop"),
    energy: float = Form(0.75),
    smoothness: float = Form(0.5),
    bounce: float = Form(0.6),
    creativity: float = Form(0.4)
):
    """
    음악 + 프롬프트로 안무 생성
    
    백그라운드에서 처리되며, job_id를 반환합니다.
    상태는 /api/generation-status/{job_id}로 확인할 수 있습니다.
    """
    try:
        # 작업 ID 생성
        job_id = str(uuid.uuid4())
        
        # 작업 상태 초기화
        generation_jobs[job_id] = {
            "status": "pending",
            "progress": 0,
            "message": "작업이 대기 중입니다.",
            "motion_data": None,
            "created_at": datetime.now().isoformat()
        }
        
        # 파일 읽기 및 크기 확인 (100MB 제한)
        content = await audio_file.read()
        file_size = len(content)
        if file_size > 100 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Audio file size exceeds 100MB limit")
        
        # 임시 파일 저장
        temp_audio_path = f"temp/{job_id}_audio_{audio_file.filename}"
        os.makedirs("temp", exist_ok=True)
        
        with open(temp_audio_path, "wb") as f:
            f.write(content)
        
        # 백그라운드 작업 시작
        background_tasks.add_task(
            process_motion_generation,
            job_id=job_id,
            prompt=prompt,
            audio_path=temp_audio_path,
            style=style,
            energy=energy,
            smoothness=smoothness,
            bounce=bounce,
            creativity=creativity
        )
        
        return {
            "job_id": job_id,
            "status": "pending",
            "message": "안무 생성이 시작되었습니다."
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Motion generation failed: {str(e)}")


async def process_motion_generation(
    job_id: str,
    prompt: str,
    audio_path: str,
    style: str,
    energy: float,
    smoothness: float,
    bounce: float,
    creativity: float
):
    """
    실제 모션 생성 처리 (백그라운드 작업)
    """
    print(f"🎬 모션 생성 시작 (job_id: {job_id})")
    print(f"   프롬프트: {prompt}")
    print(f"   스타일: {style}")
    print(f"   오디오 경로: {audio_path}")
    
    try:
        # 상태 업데이트: 처리 중
        generation_jobs[job_id]["status"] = "processing"
        generation_jobs[job_id]["progress"] = 10
        generation_jobs[job_id]["message"] = "오디오 분석 중..."
        
        # 실제 오디오 분석
        audio_analysis = audio_processor.analyze(audio_path)
        
        generation_jobs[job_id]["progress"] = 30
        generation_jobs[job_id]["message"] = "모션 생성 중..."
        
        # 실제 모션 생성
        motion_data = motion_generator.generate(
            prompt=prompt,
            style=style,
            audio_features=audio_analysis,
            energy=energy,
            smoothness=smoothness,
            bounce=bounce,
            creativity=creativity
        )
        
        # 진행 상황 업데이트
        generation_jobs[job_id]["progress"] = 90
        generation_jobs[job_id]["message"] = "모션 데이터 처리 중..."
        
        # 상태 업데이트: 완료
        generation_jobs[job_id]["status"] = "completed"
        generation_jobs[job_id]["progress"] = 100
        generation_jobs[job_id]["message"] = "안무 생성이 완료되었습니다."
        generation_jobs[job_id]["motion_data"] = motion_data
        
        print(f"✅ 모션 생성 완료 (job_id: {job_id})")
        print(f"   프레임: {motion_data.get('frames', 'N/A')}")
        print(f"   관절: {motion_data.get('joints', 'N/A')}")
        
        # 임시 파일 삭제
        if os.path.exists(audio_path):
            os.remove(audio_path)
            
    except Exception as e:
        # 에러 로깅
        import traceback
        error_trace = traceback.format_exc()
        print(f"❌ 모션 생성 오류 (job_id: {job_id}):")
        print(f"   에러 메시지: {str(e)}")
        print(f"   상세 트레이스:")
        print(error_trace)
        
        # 상태 업데이트: 실패
        generation_jobs[job_id]["status"] = "failed"
        generation_jobs[job_id]["message"] = f"생성 실패: {str(e)}"
        generation_jobs[job_id]["error"] = str(e)
        
        # 임시 파일 삭제
        if os.path.exists(audio_path):
            os.remove(audio_path)


@app.get("/api/generation-status/{job_id}", response_model=GenerationStatusResponse)
async def get_generation_status(job_id: str):
    """
    생성 작업 상태 조회
    """
    if job_id not in generation_jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = generation_jobs[job_id]
    return GenerationStatusResponse(
        job_id=job_id,
        status=job["status"],
        progress=job["progress"],
        message=job["message"],
        motion_data=job["motion_data"]
    )


@app.post("/api/export-motion")
async def export_motion(
    request: Request
):
    """
    모션 데이터를 다양한 형식으로 내보내기
    큰 파일 처리를 위해 Request 객체로 직접 읽기
    """
    try:
        import json
        import tempfile
        import os
        from datetime import datetime
        import re
        
        # Content-Type 확인
        content_type = request.headers.get("content-type", "")
        if "multipart/form-data" not in content_type:
            raise HTTPException(status_code=400, detail="Content-Type must be multipart/form-data")
        
        # boundary 추출
        boundary_match = re.search(r'boundary=([^;]+)', content_type)
        if not boundary_match:
            raise HTTPException(status_code=400, detail="Invalid multipart/form-data: no boundary")
        
        boundary = boundary_match.group(1).strip('"')
        
        # body 읽기
        body_bytes = await request.body()
        
        # multipart 파싱 (큰 파일 지원)
        parts = body_bytes.split(f'--{boundary}'.encode())
        
        format = "json"
        motion_data_str = ""
        
        for part in parts:
            if not part.strip() or part.strip() == b'--':
                continue
            
            # 헤더와 본문 분리
            if b'\r\n\r\n' in part:
                header_bytes, body_bytes_part = part.split(b'\r\n\r\n', 1)
            elif b'\n\n' in part:
                header_bytes, body_bytes_part = part.split(b'\n\n', 1)
            else:
                continue
            
            # Content-Disposition에서 필드 이름 추출
            header_str = header_bytes.decode('utf-8', errors='ignore')
            name_match = re.search(r'name="([^"]+)"', header_str)
            if not name_match:
                continue
            
            field_name = name_match.group(1)
            
            # 본문에서 끝부분 제거 (다음 boundary 전까지)
            if body_bytes_part.endswith(b'\r\n'):
                body_bytes_part = body_bytes_part[:-2]
            elif body_bytes_part.endswith(b'\n'):
                body_bytes_part = body_bytes_part[:-1]
            
            # 필드 값 추출
            try:
                field_value = body_bytes_part.decode('utf-8')
            except UnicodeDecodeError:
                continue
            
            if field_name == "format":
                format = field_value.strip()
            elif field_name == "motion_data":
                motion_data_str = field_value
        
        logging.info(f"📤 Export 요청: format={format}, motion_data 길이={len(motion_data_str) if motion_data_str else 0}")
        
        if not motion_data_str:
            logging.error("❌ motion_data가 없습니다")
            raise HTTPException(status_code=400, detail="motion_data is required")
        
        # JSON 문자열을 파싱
        try:
            motion_dict = json.loads(motion_data_str)
            logging.info(f"✅ JSON 파싱 성공: keys={list(motion_dict.keys()) if isinstance(motion_dict, dict) else 'not a dict'}")
        except json.JSONDecodeError as e:
            logging.error(f"❌ JSON 파싱 실패: {str(e)}")
            raise HTTPException(status_code=400, detail=f"Invalid JSON: {str(e)}")
        
        # 임시 파일 생성
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        if format == "json":
            # JSON 형식으로 내보내기
            temp_file = tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8')
            json.dump(motion_dict, temp_file, indent=2, ensure_ascii=False)
            temp_file.close()
            
            def cleanup():
                try:
                    os.unlink(temp_file.name)
                except:
                    pass
            
            return FileResponse(
                temp_file.name,
                media_type='application/json',
                filename=f'motion_export_{timestamp}.json',
                background=BackgroundTask(cleanup)
            )
        
        elif format == "bvh":
            # BVH 형식으로 변환
            bvh_content = convert_to_bvh(motion_dict)
            temp_file = tempfile.NamedTemporaryFile(mode='w', suffix='.bvh', delete=False, encoding='utf-8')
            temp_file.write(bvh_content)
            temp_file.close()
            
            def cleanup():
                try:
                    os.unlink(temp_file.name)
                except:
                    pass
            
            return FileResponse(
                temp_file.name,
                media_type='text/plain',
                filename=f'motion_export_{timestamp}.bvh',
                background=BackgroundTask(cleanup)
            )
        
        elif format == "fbx":
            # FBX 형식으로 변환 (간단한 구현)
            fbx_content = convert_to_fbx(motion_dict)
            temp_file = tempfile.NamedTemporaryFile(mode='wb', suffix='.fbx', delete=False)
            temp_file.write(fbx_content)
            temp_file.close()
            
            def cleanup():
                try:
                    os.unlink(temp_file.name)
                except:
                    pass
            
            return FileResponse(
                temp_file.name,
                media_type='application/octet-stream',
                filename=f'motion_export_{timestamp}.fbx',
                background=BackgroundTask(cleanup)
            )
        
        else:
            logging.error(f"❌ 지원하지 않는 형식: {format}")
            raise HTTPException(status_code=400, detail=f"Unsupported format: {format}")
            
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"❌ Export 오류: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")


def convert_to_bvh(motion_data: dict) -> str:
    """
    모션 데이터를 BVH 형식으로 변환
    """
    # 간단한 BVH 헤더 생성
    bvh_lines = [
        "HIERARCHY",
        "ROOT Hips",
        "{",
        "  OFFSET 0.0 0.0 0.0",
        "  CHANNELS 6 Xposition Yposition Zposition Zrotation Xrotation Yrotation",
        "  JOINT Spine",
        "  {",
        "    OFFSET 0.0 1.0 0.0",
        "    CHANNELS 3 Zrotation Xrotation Yrotation",
        "    JOINT Chest",
        "    {",
        "      OFFSET 0.0 0.4 0.0",
        "      CHANNELS 3 Zrotation Xrotation Yrotation",
        "      JOINT Head",
        "      {",
        "        OFFSET 0.0 0.3 0.0",
        "        CHANNELS 3 Zrotation Xrotation Yrotation",
        "        End Site",
        "        {",
        "          OFFSET 0.0 0.1 0.0",
        "        }",
        "      }",
        "    }",
        "  }",
        "}",
        "",
        "MOTION",
        f"Frames: {motion_data.get('frames', 0)}",
        f"Frame Time: {1.0 / motion_data.get('fps', 30):.6f}",
        ""
    ]
    
    # 모션 데이터 추가
    motion_frames = motion_data.get('data', [])
    for frame in motion_frames:
        if frame and len(frame) > 0:
            # 간단한 변환 (실제로는 더 복잡한 변환이 필요)
            hips_pos = frame[0] if len(frame) > 0 and isinstance(frame[0], list) else [0, 0, 0]
            spine_rot = frame[1] if len(frame) > 1 and isinstance(frame[1], list) else [0, 0, 0]
            chest_rot = frame[2] if len(frame) > 2 and isinstance(frame[2], list) else [0, 0, 0]
            head_rot = frame[15] if len(frame) > 15 and isinstance(frame[15], list) else [0, 0, 0]
            
            # BVH 형식: X Y Z Zrot Xrot Yrot (각 관절)
            line = f"{hips_pos[0]*100:.6f} {hips_pos[1]*100:.6f} {hips_pos[2]*100:.6f} "
            line += f"{spine_rot[2]*57.3:.6f} {spine_rot[0]*57.3:.6f} {spine_rot[1]*57.3:.6f} "
            line += f"{chest_rot[2]*57.3:.6f} {chest_rot[0]*57.3:.6f} {chest_rot[1]*57.3:.6f} "
            line += f"{head_rot[2]*57.3:.6f} {head_rot[0]*57.3:.6f} {head_rot[1]*57.3:.6f}"
            bvh_lines.append(line)
    
    return "\n".join(bvh_lines)


def convert_to_fbx(motion_data: dict) -> bytes:
    """
    모션 데이터를 FBX 형식으로 변환 (간단한 텍스트 기반 구현)
    실제 프로덕션에서는 FBX SDK 사용 권장
    """
    # 간단한 FBX 텍스트 형식 (실제 FBX는 바이너리 형식)
    # 여기서는 JSON을 기반으로 한 간단한 변환만 제공
    import json
    fbx_json = {
        "version": "FBX 7.4",
        "motion_data": motion_data,
        "note": "This is a simplified FBX export. For production use, please use FBX SDK."
    }
    return json.dumps(fbx_json, indent=2, ensure_ascii=False).encode('utf-8')


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True  # 개발 모드
    )


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
    모션 데이터는 각 프레임이 [x0, y0, z0, x1, y1, z1, ...] 형식의 1D 배열 (22개 관절 * 3 = 66개 값)
    """
    import math
    
    # BVH 스켈레톤 구조 정의 (22개 관절)
    joints = [
        {"name": "Hips", "parent": None, "offset": [0.0, 0.0, 0.0], "channels": 6, "idx": 0},
        {"name": "Spine", "parent": "Hips", "offset": [0.0, 0.1, 0.0], "channels": 3, "idx": 1},
        {"name": "Chest", "parent": "Spine", "offset": [0.0, 0.15, 0.0], "channels": 3, "idx": 2},
        {"name": "Head", "parent": "Chest", "offset": [0.0, 0.2, 0.0], "channels": 3, "idx": 3},
        {"name": "LeftUpperArm", "parent": "Chest", "offset": [-0.15, 0.1, 0.0], "channels": 3, "idx": 4},
        {"name": "LeftForearm", "parent": "LeftUpperArm", "offset": [0.0, 0.25, 0.0], "channels": 3, "idx": 5},
        {"name": "RightUpperArm", "parent": "Chest", "offset": [0.15, 0.1, 0.0], "channels": 3, "idx": 6},
        {"name": "RightForearm", "parent": "RightUpperArm", "offset": [0.0, 0.25, 0.0], "channels": 3, "idx": 7},
        {"name": "LeftThigh", "parent": "Hips", "offset": [-0.1, 0.0, 0.0], "channels": 3, "idx": 8},
        {"name": "LeftShin", "parent": "LeftThigh", "offset": [0.0, 0.4, 0.0], "channels": 3, "idx": 9},
        {"name": "RightThigh", "parent": "Hips", "offset": [0.1, 0.0, 0.0], "channels": 3, "idx": 10},
        {"name": "RightShin", "parent": "RightThigh", "offset": [0.0, 0.4, 0.0], "channels": 3, "idx": 11},
    ]
    
    # BVH 헤더 생성
    bvh_lines = ["HIERARCHY"]
    
    def add_joint(joint, indent=0):
        indent_str = "  " * indent
        parent = joint["parent"]
        name = joint["name"]
        offset = joint["offset"]
        channels = joint["channels"]
        
        if parent is None:
            bvh_lines.append(f"{indent_str}ROOT {name}")
        else:
            bvh_lines.append(f"{indent_str}JOINT {name}")
        
        bvh_lines.append(f"{indent_str}{{")
        bvh_lines.append(f"{indent_str}  OFFSET {offset[0]:.6f} {offset[1]:.6f} {offset[2]:.6f}")
        
        if channels == 6:
            bvh_lines.append(f"{indent_str}  CHANNELS 6 Xposition Yposition Zposition Zrotation Xrotation Yrotation")
        else:
            bvh_lines.append(f"{indent_str}  CHANNELS 3 Zrotation Xrotation Yrotation")
        
        # 자식 관절 추가
        children = [j for j in joints if j.get("parent") == name]
        if children:
            for child in children:
                add_joint(child, indent + 1)
        else:
            # End Site
            bvh_lines.append(f"{indent_str}  End Site")
            bvh_lines.append(f"{indent_str}  {{")
            bvh_lines.append(f"{indent_str}    OFFSET 0.0 0.0 0.0")
            bvh_lines.append(f"{indent_str}  }}")
        
        bvh_lines.append(f"{indent_str}}}")
    
    # 루트 관절부터 시작
    root_joint = next(j for j in joints if j["parent"] is None)
    add_joint(root_joint)
    
    # MOTION 섹션
    fps = motion_data.get('fps', 30)
    frames = motion_data.get('frames', 0)
    bvh_lines.extend([
        "",
        "MOTION",
        f"Frames: {frames}",
        f"Frame Time: {1.0 / fps:.6f}",
        ""
    ])
    
    # 모션 데이터 추가
    motion_frames = motion_data.get('data', [])
    for frame in motion_frames:
        if not frame or not isinstance(frame, list) or len(frame) < 66:
            # 기본값으로 채우기
            frame = [0.0] * 66
        
        frame_values = []
        
        # 각 관절의 회전 데이터 추출 (라디안 → 도 변환)
        for joint in joints:
            idx = joint["idx"]
            base_idx = idx * 3
            
            if base_idx + 2 < len(frame):
                # 회전 값 (라디안)을 도로 변환
                rx = math.degrees(frame[base_idx] if frame[base_idx] is not None else 0.0)
                ry = math.degrees(frame[base_idx + 1] if frame[base_idx + 1] is not None else 0.0)
                rz = math.degrees(frame[base_idx + 2] if frame[base_idx + 2] is not None else 0.0)
            else:
                rx = ry = rz = 0.0
            
            if joint["channels"] == 6:
                # 루트 관절: 위치 + 회전
                # 위치는 기본값 (0, 0, 0) 또는 엉덩이 높이
                pos_x = 0.0
                pos_y = 1.0  # 기본 높이
                pos_z = 0.0
                frame_values.extend([f"{pos_x:.6f}", f"{pos_y:.6f}", f"{pos_z:.6f}", 
                                    f"{rz:.6f}", f"{rx:.6f}", f"{ry:.6f}"])
            else:
                # 일반 관절: 회전만
                frame_values.extend([f"{rz:.6f}", f"{rx:.6f}", f"{ry:.6f}"])
        
        bvh_lines.append(" ".join(frame_values))
    
    return "\n".join(bvh_lines)


def convert_to_fbx(motion_data: dict) -> bytes:
    """
    모션 데이터를 FBX 형식으로 변환
    참고: 실제 FBX는 바이너리 형식이지만, 여기서는 ASCII FBX 형식으로 변환
    프로덕션 환경에서는 Autodesk FBX SDK 사용을 권장합니다.
    """
    import json
    import math
    
    # FBX ASCII 형식으로 변환
    fps = motion_data.get('fps', 30)
    frames = motion_data.get('frames', 0)
    joints = motion_data.get('joints', 22)
    motion_frames = motion_data.get('data', [])
    
    # FBX ASCII 헤더
    fbx_lines = [
        "; FBX 7.4.0 project file",
        "; Created by SOTA K-Pop Studio",
        "",
        "FBXHeaderExtension:  {",
        "    FBXHeaderVersion: 1003",
        "    FBXVersion: 7400",
        "}",
        "",
        "GlobalSettings:  {",
        "    Version: 1000",
        "}",
        "",
        "Objects:  {",
        "    Model: \"Model::RootNode\", \"Mesh\" {",
        "        Version: 232",
        "        Properties70:  {",
        "            P: \"Lcl Translation\", \"Lcl Translation\", \"\", \"A\",0,0,0",
        "            P: \"Lcl Rotation\", \"Lcl Rotation\", \"\", \"A\",0,0,0",
        "            P: \"Lcl Scaling\", \"Lcl Scaling\", \"\", \"A\",1,1,1",
        "        }",
        "    }",
        "}",
        "",
        "AnimationStack: \"Take 001\", \"Take\" {",
        "    Version: 1",
        "}",
        "",
        "AnimationLayer: \"AnimLayer::BaseLayer\", \"AnimLayer\" {",
        "    Version: 1",
        "}",
        ""
    ]
    
    # 모션 데이터를 FBX 형식으로 변환
    # 실제 FBX는 더 복잡하지만, 여기서는 기본 구조만 제공
    # 프로덕션에서는 FBX SDK를 사용하여 정확한 변환 수행
    
    # JSON 형식으로 모션 데이터 포함 (호환성을 위해)
    fbx_data = {
        "version": "FBX 7.4 (ASCII)",
        "fps": fps,
        "frames": frames,
        "joints": joints,
        "motion_data": motion_data,
        "note": "This is a simplified FBX export. For production use, please use Autodesk FBX SDK (https://www.autodesk.com/developer-network/platform-technologies/fbx-sdk-2020-2)."
    }
    
    # JSON을 바이너리로 인코딩
    return json.dumps(fbx_data, indent=2, ensure_ascii=False).encode('utf-8')


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True  # 개발 모드
    )


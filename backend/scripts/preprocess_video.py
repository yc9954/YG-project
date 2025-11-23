"""
K-pop 영상 전처리 스크립트
영상에서 모션 데이터를 추출하여 HumanML3D 형식으로 변환
"""
import cv2
import numpy as np
import json
from pathlib import Path
from typing import List, Dict, Tuple, Optional
import argparse


class VideoMotionExtractor:
    """
    비디오에서 모션 데이터를 추출합니다.
    MediaPipe Pose를 사용하여 포즈 추정을 수행합니다.
    """

    def __init__(self):
        """초기화"""
        self.pose_detector = None
        self._init_pose_detector()

    def _init_pose_detector(self):
        """MediaPipe Pose 초기화"""
        try:
            import mediapipe as mp
            self.mp_pose = mp.solutions.pose
            self.pose_detector = self.mp_pose.Pose(
                static_image_mode=False,
                model_complexity=2,
                smooth_landmarks=True,
                min_detection_confidence=0.5,
                min_tracking_confidence=0.5
            )
            print("✅ MediaPipe Pose 초기화 완료")
        except ImportError:
            print("❌ MediaPipe가 설치되지 않았습니다. pip install mediapipe를 실행하세요.")
            raise

    def extract_motion_from_video(
        self,
        video_path: str,
        output_path: Optional[str] = None,
        fps: int = 30
    ) -> np.ndarray:
        """
        비디오에서 모션 데이터 추출

        Args:
            video_path: 비디오 파일 경로
            output_path: 출력 파일 경로 (선택사항)
            fps: 타겟 FPS

        Returns:
            np.ndarray: 모션 데이터 [frames, joints, 3 (x, y, z)]
        """
        video_path = Path(video_path)
        if not video_path.exists():
            raise FileNotFoundError(f"비디오 파일을 찾을 수 없습니다: {video_path}")

        print(f"📹 비디오 처리 중: {video_path}")

        # 비디오 로드
        cap = cv2.VideoCapture(str(video_path))
        if not cap.isOpened():
            raise RuntimeError(f"비디오를 열 수 없습니다: {video_path}")

        # 비디오 정보
        video_fps = int(cap.get(cv2.CAP_PROP_FPS))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

        print(f"   비디오 정보: {width}x{height}, {video_fps}fps, {total_frames}프레임")

        # 프레임 샘플링 간격 계산
        frame_interval = max(1, int(video_fps / fps))

        motion_data = []
        frame_count = 0
        processed_count = 0

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            # FPS 맞춰서 샘플링
            if frame_count % frame_interval == 0:
                # BGR을 RGB로 변환
                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

                # 포즈 추정
                results = self.pose_detector.process(frame_rgb)

                if results.pose_landmarks:
                    # 랜드마크 추출
                    landmarks = self._extract_landmarks(results.pose_landmarks, width, height)
                    motion_data.append(landmarks)
                    processed_count += 1
                else:
                    # 랜드마크가 감지되지 않으면 이전 프레임 복사 또는 제로
                    if motion_data:
                        motion_data.append(motion_data[-1])
                    else:
                        motion_data.append(np.zeros((33, 3)))

            frame_count += 1

            # 진행 상황 표시
            if frame_count % 100 == 0:
                print(f"   처리 중: {frame_count}/{total_frames} 프레임")

        cap.release()

        if not motion_data:
            raise RuntimeError("포즈를 감지할 수 없습니다. 다른 비디오를 시도하세요.")

        motion_array = np.array(motion_data)
        print(f"✅ 모션 추출 완료: {motion_array.shape[0]}프레임, {motion_array.shape[1]}관절")
        print(f"   포즈 감지율: {processed_count}/{len(motion_data)} ({processed_count/len(motion_data)*100:.1f}%)")

        # 저장
        if output_path:
            output_path = Path(output_path)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            np.save(output_path, motion_array)
            print(f"💾 모션 데이터 저장: {output_path}")

        return motion_array

    def _extract_landmarks(self, pose_landmarks, width: int, height: int) -> np.ndarray:
        """
        MediaPipe 랜드마크를 numpy 배열로 변환

        Args:
            pose_landmarks: MediaPipe pose landmarks
            width: 이미지 너비
            height: 이미지 높이

        Returns:
            np.ndarray: [33, 3] 형태의 랜드마크 좌표
        """
        landmarks = np.zeros((33, 3))

        for idx, landmark in enumerate(pose_landmarks.landmark):
            # 정규화된 좌표를 픽셀 좌표로 변환
            landmarks[idx, 0] = landmark.x * width
            landmarks[idx, 1] = landmark.y * height
            landmarks[idx, 2] = landmark.z * width  # z도 스케일 조정

        return landmarks

    def convert_to_humanml3d(
        self,
        motion_data: np.ndarray,
        fps: int = 20
    ) -> np.ndarray:
        """
        MediaPipe 포즈를 HumanML3D 형식으로 변환

        Args:
            motion_data: MediaPipe 모션 데이터 [frames, 33, 3]
            fps: 타겟 FPS (HumanML3D는 20fps)

        Returns:
            np.ndarray: HumanML3D 형식 [frames, joints, features]
        """
        print("🔄 HumanML3D 형식으로 변환 중...")

        # MediaPipe 33개 관절을 22개 SMPL 관절로 매핑
        # MediaPipe: 0=nose, 11=left_shoulder, 12=right_shoulder, 13=left_elbow, etc.
        # SMPL/HumanML3D: pelvis, left_hip, right_hip, spine, etc.

        mapping = {
            # 중심 관절
            0: [23, 24],  # pelvis <- 좌우 힙 중간
            1: [11, 12],  # spine1 <- 좌우 어깨 중간
            2: [0],       # spine2 <- 코
            3: [0],       # spine3 <- 코

            # 왼쪽 다리
            4: [23],      # left_hip
            5: [25],      # left_knee
            6: [27],      # left_ankle
            7: [31],      # left_foot

            # 오른쪽 다리
            8: [24],      # right_hip
            9: [26],      # right_knee
            10: [28],     # right_ankle
            11: [32],     # right_foot

            # 왼쪽 팔
            12: [11],     # left_collar
            13: [13],     # left_shoulder -> left_elbow
            14: [15],     # left_elbow -> left_wrist
            15: [19],     # left_wrist -> left_hand

            # 오른쪽 팔
            16: [12],     # right_collar
            17: [14],     # right_shoulder -> right_elbow
            18: [16],     # right_elbow -> right_wrist
            19: [20],     # right_wrist -> right_hand

            # 머리
            20: [0],      # neck <- 코
            21: [0],      # head <- 코
        }

        frames = motion_data.shape[0]
        humanml_data = np.zeros((frames, 22, 3))

        for frame_idx in range(frames):
            for smpl_idx, mp_indices in mapping.items():
                # MediaPipe 관절들의 평균 위치 사용
                positions = [motion_data[frame_idx, mp_idx] for mp_idx in mp_indices]
                humanml_data[frame_idx, smpl_idx] = np.mean(positions, axis=0)

        # 정규화: 중심을 원점으로, 스케일 조정
        humanml_data = self._normalize_motion(humanml_data)

        print(f"✅ 변환 완료: {humanml_data.shape}")
        return humanml_data

    def _normalize_motion(self, motion_data: np.ndarray) -> np.ndarray:
        """
        모션 데이터 정규화

        Args:
            motion_data: [frames, joints, 3]

        Returns:
            np.ndarray: 정규화된 모션 데이터
        """
        # 각 프레임에서 pelvis(0번 관절)를 중심으로 이동
        pelvis = motion_data[:, 0:1, :]
        motion_data = motion_data - pelvis

        # 전체 모션의 스케일 정규화 (평균 거리 기준)
        distances = np.linalg.norm(motion_data, axis=2)
        mean_distance = np.mean(distances[distances > 0])
        if mean_distance > 0:
            motion_data = motion_data / mean_distance

        return motion_data


class MotionDatasetBuilder:
    """
    파인튜닝을 위한 데이터셋 생성
    """

    def __init__(self, output_dir: str = "training_data"):
        """
        Args:
            output_dir: 데이터셋 출력 디렉토리
        """
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.dataset = []

    def add_sample(
        self,
        motion_data: np.ndarray,
        caption: str,
        video_name: str
    ):
        """
        데이터셋에 샘플 추가

        Args:
            motion_data: 모션 데이터 [frames, joints, 3]
            caption: 텍스트 설명
            video_name: 비디오 이름
        """
        sample_id = len(self.dataset)
        sample_name = f"sample_{sample_id:04d}"

        # 모션 데이터 저장
        motion_path = self.output_dir / f"{sample_name}.npy"
        np.save(motion_path, motion_data)

        # 메타데이터 추가
        self.dataset.append({
            'id': sample_id,
            'name': sample_name,
            'caption': caption,
            'video_name': video_name,
            'frames': motion_data.shape[0],
            'motion_path': str(motion_path)
        })

        print(f"✅ 샘플 추가: {sample_name} - {caption}")

    def save_dataset(self):
        """데이터셋 메타데이터 저장"""
        metadata_path = self.output_dir / "dataset.json"
        with open(metadata_path, 'w', encoding='utf-8') as f:
            json.dump(self.dataset, f, indent=2, ensure_ascii=False)

        print(f"💾 데이터셋 저장 완료: {metadata_path}")
        print(f"   총 샘플 수: {len(self.dataset)}")

        return str(metadata_path)


def main():
    parser = argparse.ArgumentParser(description="K-pop 영상 전처리")
    parser.add_argument("--video", type=str, required=True, help="비디오 파일 경로")
    parser.add_argument("--caption", type=str, required=True, help="텍스트 설명")
    parser.add_argument("--output-dir", type=str, default="training_data", help="출력 디렉토리")
    parser.add_argument("--fps", type=int, default=20, help="타겟 FPS")

    args = parser.parse_args()

    # 모션 추출
    extractor = VideoMotionExtractor()
    motion_data = extractor.extract_motion_from_video(args.video, fps=args.fps)

    # HumanML3D 형식 변환
    humanml_data = extractor.convert_to_humanml3d(motion_data, fps=args.fps)

    # 데이터셋 생성
    builder = MotionDatasetBuilder(args.output_dir)
    builder.add_sample(
        motion_data=humanml_data,
        caption=args.caption,
        video_name=Path(args.video).name
    )
    builder.save_dataset()

    print("\n✅ 전처리 완료!")


if __name__ == "__main__":
    main()

"""
모션 생성 서비스
- Text-to-Motion 생성
- 오디오 동기화
- 스타일 조건부 생성
"""
from typing import Dict, Optional
import numpy as np
from .mdm_loader import MDMLoader, get_mdm_loader


class MotionGenerator:
    """
    텍스트 프롬프트와 오디오 특징을 사용하여 안무를 생성합니다.
    
    MDM (Motion Diffusion Model)을 사용하여 모션을 생성합니다.
    """
    
    def __init__(self, model_path: Optional[str] = None):
        """
        모델 초기화
        
        Args:
            model_path: 사전 학습된 모델 경로 (선택사항)
        """
        self.mdm_loader = None
        self._initialize_model()
    
    def _initialize_model(self):
        """MDM 모델 초기화"""
        try:
            self.mdm_loader = get_mdm_loader()
            if not self.mdm_loader.is_loaded():
                print("⚠️  MDM 모델이 로드되지 않았습니다. 모의 모드로 작동합니다.")
        except Exception as e:
            print(f"⚠️  MDM 모델 초기화 실패: {e}")
            print("   모의 모드로 작동합니다.")
    
    def generate(
        self,
        prompt: str,
        style: str = "hiphop",
        audio_features: Optional[Dict] = None,
        energy: float = 0.75,
        smoothness: float = 0.5,
        bounce: float = 0.6,
        creativity: float = 0.4
    ) -> Dict:
        """
        안무 생성
        
        Args:
            prompt: 텍스트 프롬프트
            style: 스타일 (hiphop, pop, ballad 등)
            audio_features: 오디오 분석 결과
            energy: 에너지 레벨 (0-1)
            smoothness: 부드러움 (0-1)
            bounce: 바운스 (0-1)
            creativity: 창의성 (0-2)
            
        Returns:
            {
                'frames': int,           # 프레임 수
                'joints': int,          # 관절 수
                'data': list,            # 모션 데이터 [frames, joints, 3]
                'style': str,
                'prompt': str,
                'fps': int,
                'duration': float
            }
        """
        """
        안무 생성
        
        Args:
            prompt: 텍스트 프롬프트
            style: 스타일 (hiphop, pop, ballad 등)
            audio_features: 오디오 분석 결과
            energy: 에너지 레벨 (0-1)
            smoothness: 부드러움 (0-1)
            bounce: 바운스 (0-1)
            creativity: 창의성 (0-2)
            
        Returns:
            {
                'frames': int,           # 프레임 수
                'joints': int,          # 관절 수
                'data': np.ndarray,      # 모션 데이터 [frames, joints, 3]
                'style': str,
                'prompt': str
            }
        """
        # 오디오 길이 가져오기
        duration = audio_features['duration'] if audio_features else 10.0
        
        # 스타일을 프롬프트에 추가
        enhanced_prompt = f"{style} style, {prompt}"
        
        # 비트 정보 추출
        beats = audio_features.get('beats', []) if audio_features else []
        
        # MDM으로 모션 생성
        if self.mdm_loader and self.mdm_loader.is_loaded():
            try:
                # 가이던스 스케일 조정 (creativity에 따라)
                guidance_scale = 1.0 + (creativity * 0.5)
                
                motion_data = self.mdm_loader.generate(
                    caption=enhanced_prompt,
                    length=duration,
                    guidance_scale=guidance_scale
                )
            except Exception as e:
                print(f"⚠️  MDM 생성 실패, 모의 모드로 전환: {e}")
                motion_data = self._generate_mock_motion(duration, energy, bounce, prompt, style, beats)
        else:
            # 모의 생성 (MDM이 없을 때)
            motion_data = self._generate_mock_motion(duration, energy, bounce, prompt, style, beats)
        
        fps = 30
        frames = motion_data.shape[0]
        joints = motion_data.shape[1]
        
        # 오디오 비트에 맞춰 정렬
        try:
            if audio_features and 'beats' in audio_features and audio_features.get('beats'):
                motion_data = self._align_to_beats(motion_data, audio_features['beats'], fps)
        except Exception as e:
            print(f"⚠️  비트 정렬 실패 (계속 진행): {e}")
        
        # 파라미터에 따라 모션 조정
        try:
            motion_data = self._apply_parameters(motion_data, energy, smoothness, bounce)
        except Exception as e:
            print(f"⚠️  파라미터 적용 실패 (원본 사용): {e}")
        
        # 데이터 타입 확인 및 변환
        if isinstance(motion_data, np.ndarray):
            motion_data_list = motion_data.tolist()
        else:
            motion_data_list = motion_data
        
        return {
            'frames': int(frames),
            'joints': int(joints),
            'data': motion_data_list,  # JSON 직렬화를 위해 리스트로 변환
            'style': style,
            'prompt': prompt,
            'fps': int(fps),
            'duration': float(duration)
        }
    
    def _generate_mock_motion(self, duration: float, energy: float, bounce: float, prompt: str = "", style: str = "hiphop", beats: Optional[list] = None) -> np.ndarray:
        """
        모의 모션 데이터 생성 (MDM이 없을 때)
        프롬프트와 파라미터에 따라 다른 모션 생성
        """
        import hashlib
        
        fps = 30
        frames = int(duration * fps)
        joints = 22  # SMPL 포맷
        
        # 프롬프트를 해시하여 시드로 사용 (같은 프롬프트면 같은 모션)
        prompt_hash = int(hashlib.md5(prompt.encode()).hexdigest()[:8], 16)
        np.random.seed(prompt_hash % (2**31))
        
        # 스타일에 따라 기본 주파수 및 움직임 특성 조정
        style_configs = {
            "hiphop": {
                "base": 2.5, "arms": 3.5, "legs": 2.0,
                "arm_amplitude": 0.3, "leg_amplitude": 0.25,
                "body_sway": 0.2, "head_movement": 0.1,
                "sharpness": 0.8, "grounded": True
            },
            "pop": {
                "base": 2.0, "arms": 2.5, "legs": 1.8,
                "arm_amplitude": 0.25, "leg_amplitude": 0.2,
                "body_sway": 0.15, "head_movement": 0.15,
                "sharpness": 0.6, "grounded": False
            },
            "ballad": {
                "base": 1.5, "arms": 1.8, "legs": 1.2,
                "arm_amplitude": 0.15, "leg_amplitude": 0.1,
                "body_sway": 0.1, "head_movement": 0.2,
                "sharpness": 0.3, "grounded": True
            },
            "jazz": {
                "base": 2.2, "arms": 3.0, "legs": 2.3,
                "arm_amplitude": 0.28, "leg_amplitude": 0.22,
                "body_sway": 0.18, "head_movement": 0.12,
                "sharpness": 0.7, "grounded": True
            },
            "kpop": {
                "base": 2.8, "arms": 3.2, "legs": 2.1,
                "arm_amplitude": 0.32, "leg_amplitude": 0.24,
                "body_sway": 0.22, "head_movement": 0.18,
                "sharpness": 0.75, "grounded": False
            },
            "girlcrush": {
                "base": 2.6, "arms": 3.4, "legs": 2.2,
                "arm_amplitude": 0.35, "leg_amplitude": 0.28,
                "body_sway": 0.25, "head_movement": 0.12,
                "sharpness": 0.85, "grounded": True
            },
            "conceptual": {
                "base": 2.3, "arms": 2.8, "legs": 1.9,
                "arm_amplitude": 0.22, "leg_amplitude": 0.18,
                "body_sway": 0.2, "head_movement": 0.25,
                "sharpness": 0.5, "grounded": False
            }
        }
        config = style_configs.get(style.lower(), style_configs["hiphop"])
        freqs = {"base": config["base"], "arms": config["arms"], "legs": config["legs"]}
        
        # 프롬프트 키워드에 따른 움직임 패턴
        prompt_lower = prompt.lower()
        if "jump" in prompt_lower or "점프" in prompt_lower:
            jump_factor = 1.5
        else:
            jump_factor = 1.0
            
        if "spin" in prompt_lower or "회전" in prompt_lower:
            spin_factor = 1.3
        else:
            spin_factor = 1.0
            
        if "wave" in prompt_lower or "파도" in prompt_lower:
            wave_factor = 1.4
        else:
            wave_factor = 1.0
        
        motion = np.zeros((frames, joints, 3))
        
        # 비트 정보를 프레임 인덱스로 변환
        beat_frames = []
        if beats:
            beat_frames = [int(b * fps) for b in beats if 0 <= b * fps < frames]
        
        for i in range(frames):
            t = i / fps
            
            # 랜덤 오프셋 추가 (프롬프트 기반)
            offset = (prompt_hash % 100) / 100.0
            
            # 비트에 가까운지 확인하여 에너지 강조
            beat_boost = 1.0
            if beat_frames:
                min_beat_distance = min([abs(i - bf) for bf in beat_frames])
                if min_beat_distance <= 2:  # 비트 2프레임 이내
                    beat_boost = 1.0 + (1.0 - min_beat_distance / 2.0) * 0.3
            
            # 스타일별 특화 움직임 패턴
            sharpness = config["sharpness"]
            arm_amp = config["arm_amplitude"]
            leg_amp = config["leg_amplitude"]
            body_sway = config["body_sway"]
            head_mov = config["head_movement"]
            grounded = config["grounded"]
            
            # 엉덩이 높이 (바운스에 따라, 비트에 맞춰 강조, 스타일별 차별화)
            base_height = 1.0
            if grounded:
                # Grounded 스타일: 더 낮은 중심, 강한 바운스
                motion[i, 0, 1] = base_height + bounce * 0.25 * np.sin(t * freqs["base"] * 2 + offset) * jump_factor * beat_boost
            else:
                # Floating 스타일: 더 높은 중심, 부드러운 움직임
                motion[i, 0, 1] = base_height + 0.1 + bounce * 0.15 * np.sin(t * freqs["base"] * 1.5 + offset) * jump_factor * beat_boost
            
            # 상체 움직임 (에너지와 스타일 특성에 따라)
            body_phase = offset * 1.2
            # Sharpness에 따라 움직임의 날카로움 조정
            sharp_func = lambda x: np.sign(x) * (abs(x) ** (1.0 / (1.0 + sharpness)))
            
            motion[i, 1:5, 0] = energy * body_sway * sharp_func(np.sin(t * freqs["base"] * 1.5 + body_phase)) * spin_factor
            motion[i, 1:5, 1] = energy * body_sway * 0.7 * np.cos(t * freqs["base"] * 1.2 + body_phase)
            motion[i, 1:5, 2] = energy * body_sway * 0.8 * sharp_func(np.sin(t * freqs["base"] * 1.8 + body_phase))
            
            # 팔 움직임 (스타일별 진폭과 패턴 차별화, 비트에 맞춰 강조)
            arm_phase = offset * 2
            # K-pop과 Girl Crush는 더 넓은 팔 움직임
            if style.lower() in ["kpop", "girlcrush"]:
                arm_symmetry = 0.8  # 대칭적 움직임
            else:
                arm_symmetry = 1.0  # 비대칭적 움직임
            
            motion[i, 5:9, 0] = energy * arm_amp * np.sin(t * freqs["arms"] + arm_phase) * wave_factor * beat_boost * arm_symmetry
            motion[i, 5:9, 1] = energy * arm_amp * 0.8 * np.cos(t * freqs["arms"] * 1.3 + arm_phase) * beat_boost
            motion[i, 5:9, 2] = energy * arm_amp * 0.7 * sharp_func(np.sin(t * freqs["arms"] * 0.8 + arm_phase)) * beat_boost
            
            # 다리 움직임 (스타일별 차별화)
            leg_phase = offset * 1.5
            if grounded:
                # Grounded: 더 강한 다리 움직임, 명확한 스텝
                motion[i, 9:13, 0] = bounce * leg_amp * 1.2 * np.sin(t * freqs["legs"] + leg_phase)
                motion[i, 9:13, 1] = bounce * leg_amp * np.cos(t * freqs["legs"] * 1.5 + leg_phase) * jump_factor
                motion[i, 9:13, 2] = bounce * leg_amp * 1.1 * np.sin(t * freqs["legs"] * 0.9 + leg_phase)
            else:
                # Floating: 부드러운 다리 움직임
                motion[i, 9:13, 0] = bounce * leg_amp * 0.8 * np.sin(t * freqs["legs"] * 0.8 + leg_phase)
                motion[i, 9:13, 1] = bounce * leg_amp * 0.6 * np.cos(t * freqs["legs"] * 1.2 + leg_phase) * jump_factor
                motion[i, 9:13, 2] = bounce * leg_amp * 0.7 * np.sin(t * freqs["legs"] * 0.7 + leg_phase)
            
            # 머리 움직임 (스타일별 차별화)
            if style.lower() in ["kpop", "pop", "conceptual"]:
                # K-pop, Pop, Conceptual: 더 활발한 머리 움직임
                motion[i, 15:17, 0] = head_mov * np.sin(t * freqs["base"] * 2.5 + offset)
                motion[i, 15:17, 1] = head_mov * 0.8 * np.cos(t * freqs["base"] * 2.0 + offset)
            elif style.lower() == "ballad":
                # Ballad: 부드러운 머리 움직임
                motion[i, 15:17, 0] = head_mov * 0.5 * np.sin(t * freqs["base"] * 1.5 + offset)
                motion[i, 15:17, 1] = head_mov * 0.4 * np.cos(t * freqs["base"] * 1.2 + offset)
            else:
                # Hip-hop, Jazz: 중간 수준의 머리 움직임
                motion[i, 15:17, 0] = head_mov * 0.7 * np.sin(t * freqs["base"] * 2.0 + offset)
                motion[i, 15:17, 1] = head_mov * 0.6 * np.cos(t * freqs["base"] * 1.8 + offset)
        
        # 생성된 모션에 사전 스무딩 적용 (더 자연스러운 움직임)
        motion = self._pre_smooth_motion(motion.astype(np.float32))
        
        # 관절 간 연결성 개선 (부모-자식 관계 고려)
        motion = self._improve_joint_connectivity(motion)
        
        # 물리적으로 자연스러운 움직임 보정
        motion = self._apply_physics_constraints(motion, fps)
        
        return motion
    
    def _pre_smooth_motion(self, motion: np.ndarray) -> np.ndarray:
        """
        모션 생성 후 사전 스무딩 적용
        급격한 변화를 완화하여 더 자연스러운 움직임 생성
        """
        try:
            from scipy.ndimage import gaussian_filter1d
            
            # 경미한 가우시안 스무딩 (특징은 유지하면서 노이즈 제거)
            smoothed = motion.copy()
            for j in range(motion.shape[1]):
                for d in range(3):
                    smoothed[:, j, d] = gaussian_filter1d(
                        motion[:, j, d],
                        sigma=0.8,
                        mode='nearest'
                    )
            
            # 원본과 스무딩된 버전을 블렌딩 (70% 스무딩, 30% 원본)
            motion = smoothed * 0.7 + motion * 0.3
            
        except Exception as e:
            # scipy가 없으면 원본 반환
            pass
        
        return motion
    
    def _improve_joint_connectivity(self, motion: np.ndarray) -> np.ndarray:
        """
        관절 간 연결성 개선 - 부모-자식 관계를 고려하여 더 자연스러운 움직임 생성
        """
        try:
            # 관절 계층 구조 정의 (부모-자식 관계)
            # 0: Hips (root)
            # 1: Spine (child of Hips)
            # 2: Chest (child of Spine)
            # 3: Head (child of Chest)
            # 4-7: Arms (children of Chest)
            # 8-11: Legs (children of Hips)
            
            # 부모 관절의 움직임이 자식에게 영향을 주도록 조정
            for i in range(1, len(motion)):
                # Spine은 Hips의 움직임을 일부 상속
                motion[i, 1, :] = motion[i, 1, :] * 0.7 + motion[i, 0, :] * 0.3
                
                # Chest는 Spine의 움직임을 일부 상속
                motion[i, 2, :] = motion[i, 2, :] * 0.8 + motion[i, 1, :] * 0.2
                
                # Head는 Chest의 움직임을 일부 상속
                if motion.shape[1] > 3:
                    motion[i, 3, :] = motion[i, 3, :] * 0.9 + motion[i, 2, :] * 0.1
                
                # Arms는 Chest의 움직임을 일부 상속
                for arm_idx in [4, 6]:  # LeftUpperArm, RightUpperArm
                    if arm_idx < motion.shape[1]:
                        motion[i, arm_idx, :] = motion[i, arm_idx, :] * 0.85 + motion[i, 2, :] * 0.15
                
                # Legs는 Hips의 움직임을 일부 상속
                for leg_idx in [8, 10]:  # LeftThigh, RightThigh
                    if leg_idx < motion.shape[1]:
                        motion[i, leg_idx, :] = motion[i, leg_idx, :] * 0.8 + motion[i, 0, :] * 0.2
        except Exception as e:
            print(f"⚠️  관절 연결성 개선 실패 (무시): {e}")
        
        return motion
    
    def _apply_physics_constraints(self, motion: np.ndarray, fps: int) -> np.ndarray:
        """
        물리적으로 자연스러운 움직임 보정
        - 속도 제한
        - 가속도 제한
        - 관절 각도 제한
        """
        try:
            # 속도 제한 (프레임 간 변화량 제한)
            max_velocity = 0.5  # 라디안/프레임
            dt = 1.0 / fps
            
            for j in range(motion.shape[1]):
                for d in range(3):
                    for i in range(1, len(motion)):
                        velocity = (motion[i, j, d] - motion[i-1, j, d]) / dt
                        if abs(velocity) > max_velocity:
                            # 속도 제한 적용
                            limited_velocity = np.sign(velocity) * max_velocity
                            motion[i, j, d] = motion[i-1, j, d] + limited_velocity * dt
            
            # 관절 각도 제한 (과도한 회전 방지)
            max_angle = np.pi * 0.8  # 약 144도
            for i in range(len(motion)):
                for j in range(motion.shape[1]):
                    for d in range(3):
                        if abs(motion[i, j, d]) > max_angle:
                            motion[i, j, d] = np.sign(motion[i, j, d]) * max_angle
            
            # 부드러운 가속도/감속도
            for j in range(motion.shape[1]):
                for d in range(3):
                    # 가속도 제한을 위한 추가 스무딩
                    if len(motion) > 2:
                        for i in range(1, len(motion) - 1):
                            # 이전 프레임과 다음 프레임의 평균으로 조정
                            avg = (motion[i-1, j, d] + motion[i+1, j, d]) / 2
                            motion[i, j, d] = motion[i, j, d] * 0.7 + avg * 0.3
        except Exception as e:
            print(f"⚠️  물리적 제약 적용 실패 (무시): {e}")
        
        return motion
    
    def _apply_parameters(
        self,
        motion: np.ndarray,
        energy: float,
        smoothness: float,
        bounce: float
    ) -> np.ndarray:
        """
        파라미터에 따라 모션을 조정합니다.
        개선된 스무딩과 자연스러운 전환을 적용합니다.
        """
        # 에너지: 움직임의 크기 조정
        motion = motion * (0.5 + energy * 0.5)
        
        # 부드러움: 다단계 스무딩 적용
        if smoothness > 0.3:
            try:
                from scipy import signal
                from scipy.ndimage import gaussian_filter1d
                
                # Smoothness 레벨에 따라 다른 스무딩 강도 적용
                smoothing_strength = smoothness
                
                for j in range(motion.shape[1]):
                    for d in range(3):
                        # 1. Savitzky-Golay 필터 (고주파 노이즈 제거, 특징 보존)
                        if smoothing_strength > 0.5:
                            window_len = min(11, max(5, int(len(motion) * 0.1) * 2 + 1))
                            if window_len >= 5 and len(motion) > window_len:
                                motion[:, j, d] = signal.savgol_filter(
                                    motion[:, j, d],
                                    window_length=window_len,
                                    polyorder=min(3, window_len - 1)
                                )
                        
                        # 2. 가우시안 필터 (전체적인 부드러움)
                        if smoothing_strength > 0.7:
                            sigma = 0.5 + (smoothing_strength - 0.7) * 1.5
                            motion[:, j, d] = gaussian_filter1d(
                                motion[:, j, d],
                                sigma=sigma,
                                mode='nearest'
                            )
                        
                        # 3. 이동 평균 (극단적인 변화 완화)
                        if smoothing_strength > 0.8:
                            window_size = 3
                            if len(motion) > window_size:
                                kernel = np.ones(window_size) / window_size
                                motion[:, j, d] = np.convolve(
                                    motion[:, j, d],
                                    kernel,
                                    mode='same'
                                )
                
            except Exception as e:
                print(f"⚠️  스무딩 적용 실패 (무시): {e}")
        
        # 바운스: 수직 움직임 강조 (부드러운 곡선으로)
        if bounce > 0.5:
            bounce_factor = 1.0 + (bounce - 0.5) * 0.3
            # 부드러운 전환을 위해 가중치 적용
            motion[:, :, 1] *= bounce_factor
        
        # 자연스러운 시작/종료를 위한 페이드 인/아웃
        fade_frames = min(10, len(motion) // 10)
        if fade_frames > 0:
            # Fade in
            for i in range(fade_frames):
                fade = i / fade_frames
                motion[i] = motion[i] * fade + motion[fade_frames] * (1 - fade)
            
            # Fade out
            for i in range(fade_frames):
                fade = i / fade_frames
                idx = len(motion) - fade_frames + i
                if idx < len(motion):
                    motion[idx] = motion[idx] * (1 - fade) + motion[len(motion) - fade_frames - 1] * fade
        
        return motion
    
    def _align_to_beats(self, motion: np.ndarray, beats: list, fps: int) -> np.ndarray:
        """
        모션을 오디오 비트에 맞춰 정렬 및 강조
        비트 타임스탬프에 맞춰 모션의 에너지를 증가시키고, 비트에 정확히 맞춥니다.
        """
        try:
            # beats가 비어있거나 None이면 원본 반환
            if not beats or len(beats) == 0:
                return motion
            
            frames = motion.shape[0]
            
            # 비트를 프레임 인덱스로 변환
            beat_frames = [int(b * fps) for b in beats if 0 <= b * fps < frames]
            if not beat_frames:
                return motion
            
            # 각 비트에 대해 모션 강조
            for beat_frame in beat_frames:
                if 0 <= beat_frame < frames:
                    # 비트 전후 2프레임 범위에서 강조
                    for offset in range(-2, 3):
                        frame_idx = beat_frame + offset
                        if 0 <= frame_idx < frames:
                            # 거리에 따른 강조 강도 (비트 중심에서 멀어질수록 약해짐)
                            intensity = 1.0 - abs(offset) * 0.3
                            intensity = max(0.3, intensity)
                            
                            # 에너지 부스트 적용
                            motion[frame_idx, :, :] *= (1.0 + intensity * 0.2)
            
            # 강한 비트와 약한 비트 구분 (첫 번째 비트는 강하게)
            if len(beat_frames) > 0:
                # 메인 비트 (첫 번째 비트) 강조
                main_beat = beat_frames[0]
                if 0 <= main_beat < frames:
                    motion[main_beat, :, :] *= 1.3
                
                # 4박자 패턴 인식 (첫 번째 비트를 더 강하게)
                for i, beat_frame in enumerate(beat_frames):
                    if i % 4 == 0 and 0 <= beat_frame < frames:
                        motion[beat_frame, :, :] *= 1.2
            motion_enhanced = motion.copy()
            
            # 비트를 프레임 인덱스로 변환
            beat_frames = [int(b * fps) for b in beats if 0 <= b * fps < frames]
            
            if len(beat_frames) == 0:
                return motion
            
            # 각 비트 주변에서 모션 강조
            for beat_frame in beat_frames:
                # 비트 전후 3프레임 범위에서 강조
                beat_window = 3
                start_frame = max(0, beat_frame - beat_window)
                end_frame = min(frames, beat_frame + beat_window + 1)
                
                for frame_idx in range(start_frame, end_frame):
                    # 비트 중심에서 거리에 따른 강조 강도 (가우시안 분포)
                    distance = abs(frame_idx - beat_frame)
                    intensity = np.exp(-(distance ** 2) / (2 * (beat_window / 2) ** 2))
                    
                    # 에너지 강조: 비트에 맞춰 움직임 크기 증가
                    # 상체와 팔에 더 강한 효과 적용
                    motion_enhanced[frame_idx, 1:5, :] *= (1.0 + intensity * 0.3)  # Spine
                    motion_enhanced[frame_idx, 5:9, :] *= (1.0 + intensity * 0.4)  # Arms
                    
                    # 비트 정확히 맞춰서 수직 움직임 강조 (바운스 효과)
                    if distance <= 1:
                        motion_enhanced[frame_idx, 0, 1] *= (1.0 + intensity * 0.2)  # Hips vertical
            
            # 비트 간격에 맞춰 리듬 조정
            if len(beat_frames) > 1:
                # 평균 비트 간격 계산
                beat_intervals = [beat_frames[i+1] - beat_frames[i] 
                                 for i in range(len(beat_frames) - 1)]
                avg_interval = np.mean(beat_intervals) if beat_intervals else fps
                
                # 리듬에 맞춰 전체 모션의 주파수 조정
                # 빠른 비트면 더 빠른 움직임, 느린 비트면 더 느린 움직임
                tempo_factor = fps / avg_interval if avg_interval > 0 else 1.0
                tempo_factor = np.clip(tempo_factor, 0.8, 1.2)  # 너무 극단적 변화 방지
                
                # 전체 모션에 템포 팩터 적용 (미세 조정)
                motion_enhanced = motion_enhanced * (0.95 + tempo_factor * 0.05)
            
            return motion_enhanced
        except Exception as e:
            print(f"⚠️  비트 정렬 실패 (원본 반환): {e}")
            return motion
    


# 사용 예시
if __name__ == "__main__":
    generator = MotionGenerator()
    
    audio_features = {
        'tempo': 120,
        'beats': [0.5, 1.0, 1.5, 2.0],
        'duration': 10.0
    }
    
    motion = generator.generate(
        prompt="Powerful hip-hop routine",
        style="hiphop",
        audio_features=audio_features
    )
    
    print(f"Generated motion: {motion['frames']} frames, {motion['joints']} joints")


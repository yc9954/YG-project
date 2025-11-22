"""
오디오 파일 분석 서비스
- 템포 추정
- 비트 감지
- 에너지 계산
- 키 추정
"""
import librosa
import numpy as np
from typing import Dict, List


class AudioProcessor:
    """
    오디오 파일을 분석하여 모션 생성에 필요한 특징을 추출합니다.
    """
    
    def __init__(self):
        self.sample_rate = 22050  # 기본 샘플 레이트
    
    def analyze(self, audio_path: str) -> Dict:
        """
        오디오 파일을 분석합니다.
        
        Args:
            audio_path: 오디오 파일 경로
            
        Returns:
            {
                'tempo': float,      # BPM
                'beats': List[float], # 비트 타임스탬프 (초)
                'energy': float,     # 에너지 레벨 (0-1)
                'duration': float,   # 길이 (초)
                'key': str           # 키 정보
            }
        """
        try:
            # 오디오 로드
            y, sr = librosa.load(audio_path, sr=self.sample_rate)
            
            # 1. 템포 추정
            tempo, beats = librosa.beat.beat_track(y=y, sr=sr, units='time')
            
            # 2. 에너지 계산 (RMS)
            rms = librosa.feature.rms(y=y)[0]
            energy = float(np.mean(rms))
            
            # 3. 길이
            duration = float(librosa.get_duration(y=y, sr=sr))
            
            # 4. 키 추정 (간단한 버전)
            key = self._estimate_key(y, sr)
            
            # 5. 스타일 추천 (템포와 에너지 기반)
            recommended_style = self._recommend_style(tempo, energy)
            
            return {
                'tempo': float(tempo),
                'beats': beats.tolist(),
                'energy': float(energy),
                'duration': duration,
                'key': key,
                'recommended_style': recommended_style
            }
            
        except Exception as e:
            raise Exception(f"Audio analysis failed: {str(e)}")
    
    def _estimate_key(self, y: np.ndarray, sr: int) -> str:
        """
        간단한 키 추정 (실제로는 더 정교한 알고리즘 사용 가능)
        """
        # 크로마그램 계산
        chroma = librosa.feature.chroma_stft(y=y, sr=sr)
        
        # 가장 강한 크로마 평균
        chroma_mean = np.mean(chroma, axis=1)
        key_idx = np.argmax(chroma_mean)
        
        keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
        key = keys[key_idx]
        
        # Major/Minor 판단 (간단한 휴리스틱)
        mode = 'major'  # 실제로는 더 정교한 분석 필요
        
        return f"{key} {mode}"
    
    def _recommend_style(self, tempo: float, energy: float) -> str:
        """
        오디오 특징을 기반으로 적합한 스타일 추천
        
        Args:
            tempo: BPM
            energy: 에너지 레벨 (0-1)
            
        Returns:
            추천 스타일 이름
        """
        # 템포와 에너지 기반 스타일 분류
        # 에너지를 0-1 범위로 정규화 (RMS는 보통 0.01-0.5 범위)
        normalized_energy = min(1.0, max(0.0, energy * 2.0))
        
        if tempo < 80:
            # 느린 템포: Ballad
            return "ballad"
        elif tempo < 100:
            # 중간 템포: Ballad 또는 Conceptual
            if normalized_energy < 0.4:
                return "ballad"
            else:
                return "conceptual"
        elif tempo < 120:
            # 중간-빠른 템포: Pop 또는 Conceptual
            if normalized_energy < 0.5:
                return "pop"
            else:
                return "conceptual"
        elif tempo < 140:
            # 빠른 템포: K-pop 또는 Pop
            if normalized_energy < 0.6:
                return "pop"
            else:
                return "kpop"
        elif tempo < 160:
            # 매우 빠른 템포: K-pop 또는 Girl Crush
            if normalized_energy < 0.7:
                return "kpop"
            else:
                return "girlcrush"
        else:
            # 초고속 템포: Hip-hop 또는 Girl Crush
            if normalized_energy < 0.7:
                return "hiphop"
            else:
                return "girlcrush"


# 사용 예시
if __name__ == "__main__":
    processor = AudioProcessor()
    result = processor.analyze("test_audio.mp3")
    print(result)


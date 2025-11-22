/**
 * 백엔드 API 클라이언트
 * K-Pop Motion Generation API와 통신
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * 오디오 파일 분석
 * @param {File} audioFile - 오디오 파일
 * @returns {Promise<Object>} 분석 결과
 */
export const analyzeAudio = async (audioFile) => {
  const formData = new FormData();
  formData.append('audio_file', audioFile);
  
  console.log('🎵 오디오 분석 요청 시작:', {
    fileName: audioFile.name,
    fileSize: audioFile.size,
    fileType: audioFile.type,
    apiUrl: `${API_BASE_URL}/api/analyze-audio`
  });
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/analyze-audio`, {
      method: 'POST',
      body: formData,
    });
    
    console.log('📡 백엔드 응답 상태:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries())
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.error('❌ 백엔드 오류 응답:', error);
      throw new Error(error.detail || 'Audio analysis failed');
    }
    
    const data = await response.json();
    console.log('✅ 백엔드 분석 결과:', {
      tempo: data.tempo,
      duration: data.duration,
      energy: data.energy,
      key: data.key,
      beatsCount: data.beats?.length || 0
    });
    
    return data;
  } catch (error) {
    console.error('❌ 오디오 분석 오류:', error);
    throw error;
  }
};

/**
 * 모션 데이터 내보내기
 * @param {Object} motionData - 모션 데이터
 * @param {string} format - 내보내기 형식 ('fbx', 'bvh', 'json')
 * @returns {Promise<Blob>} 다운로드할 파일
 */
export const exportMotion = async (motionData, format = 'json') => {
  const formData = new FormData();
  const motionDataString = JSON.stringify(motionData);
  formData.append('motion_data', motionDataString);
  formData.append('format', format);
  
  const dataSize = motionDataString.length;
  console.log('📤 모션 내보내기 요청:', { format, dataSize, dataSizeMB: (dataSize / 1024 / 1024).toFixed(2) + 'MB' });
  
  // 데이터가 너무 크면 경고
  if (dataSize > 50 * 1024 * 1024) { // 50MB 이상
    console.warn('⚠️ 모션 데이터가 큽니다:', (dataSize / 1024 / 1024).toFixed(2) + 'MB');
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/export-motion`, {
      method: 'POST',
      body: formData,
      // 타임아웃 증가 (큰 파일 처리)
      signal: AbortSignal.timeout(300000) // 5분
    });
    
    if (!response.ok) {
      let error;
      try {
        error = await response.json();
      } catch (e) {
        error = { detail: `HTTP ${response.status}: ${response.statusText}` };
      }
      console.error('❌ 내보내기 오류:', {
        status: response.status,
        statusText: response.statusText,
        error: error
      });
      throw new Error(error.detail || 'Export failed');
    }
    
    const blob = await response.blob();
    console.log('✅ 모션 내보내기 완료:', { format, size: blob.size });
    
    return blob;
  } catch (error) {
    console.error('❌ 모션 내보내기 오류:', error);
    throw error;
  }
};

/**
 * 안무 생성 요청
 * @param {Object} params - 생성 파라미터
 * @param {string} params.prompt - 텍스트 프롬프트
 * @param {File} params.audioFile - 오디오 파일
 * @param {string} params.style - 스타일
 * @param {number} params.energy - 에너지 레벨
 * @param {number} params.smoothness - 부드러움
 * @param {number} params.bounce - 바운스
 * @param {number} params.creativity - 창의성
 * @returns {Promise<Object>} 작업 ID 및 상태
 */
export const generateMotion = async ({
  prompt,
  audioFile,
  style,
  energy,
  smoothness,
  bounce,
  creativity
}) => {
  const formData = new FormData();
  formData.append('audio_file', audioFile);
  formData.append('prompt', prompt);
  formData.append('style', style);
  formData.append('energy', energy.toString());
  formData.append('smoothness', smoothness.toString());
  formData.append('bounce', bounce.toString());
  formData.append('creativity', creativity.toString());
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/generate-motion`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Motion generation failed');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Motion generation error:', error);
    throw error;
  }
};

/**
 * 생성 작업 상태 조회
 * @param {string} jobId - 작업 ID
 * @returns {Promise<Object>} 작업 상태
 */
export const getGenerationStatus = async (jobId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/generation-status/${jobId}`);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to get generation status');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Get generation status error:', error);
    throw error;
  }
};

/**
 * 생성 작업 상태를 폴링하여 완료까지 대기
 * @param {string} jobId - 작업 ID
 * @param {Function} onProgress - 진행 상황 콜백 (progress: number)
 * @param {number} interval - 폴링 간격 (ms)
 * @returns {Promise<Object>} 완료된 모션 데이터
 */
export const pollGenerationStatus = async (jobId, onProgress, interval = 1000) => {
  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        const status = await getGenerationStatus(jobId);
        
        // 진행 상황 콜백 호출
        if (onProgress) {
          onProgress(status.progress);
        }
        
        if (status.status === 'completed') {
          resolve(status);
        } else if (status.status === 'failed') {
          reject(new Error(status.message || 'Generation failed'));
        } else {
          // 계속 폴링
          setTimeout(poll, interval);
        }
      } catch (error) {
        reject(error);
      }
    };
    
    poll();
  });
};

/**
 * API 서버 상태 확인
 * @returns {Promise<boolean>} 서버가 응답하는지 여부
 */
export const checkServerHealth = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    return response.ok;
  } catch (error) {
    return false;
  }
};


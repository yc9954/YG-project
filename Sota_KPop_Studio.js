import React, { useState, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { 
  Play, Pause, SkipBack, SkipForward, Wand2, Layers, 
  Download, Sparkles, Users, Zap, Activity, 
  Lock, Unlock, Sliders, Video, Grid3X3, Bone
} from 'lucide-react';
import { analyzeAudio as analyzeAudioAPI } from './frontend/services/api';

/**
 * [시스템 설명]
 * 이 코드는 실제 SOTA(State-of-the-Art) 모션 생성 모델(Motion Diffusion Model)을
 * 제어하기 위한 프론트엔드 인터페이스입니다.
 * * [수정 사항]
 * - React-Three-Fiber 라이브러리 의존성 제거 (호환성 문제 해결)
 * - Native Three.js 엔진으로 3D 뷰어 재구현 (최적화 및 안정성 확보)
 */

// --- 1. Native Three.js 3D 엔진 ---
const NativeThreeViewer = ({ isPlaying, params, locks }) => {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const dancerRef = useRef(null);
  const frameIdRef = useRef(null);

  // 3D 씬 초기화
  useEffect(() => {
    if (!containerRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#111');
    scene.fog = new THREE.Fog('#111', 5, 20);

    // Camera setup
    const camera = new THREE.PerspectiveCamera(50, containerRef.current.clientWidth / containerRef.current.clientHeight, 0.1, 100);
    camera.position.set(0, 2, 5);
    camera.lookAt(0, 1, 0);

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    containerRef.current.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const spotLight = new THREE.SpotLight(0xffffff, 20);
    spotLight.position.set(5, 8, 5);
    spotLight.castShadow = true;
    scene.add(spotLight);

    const pointLight = new THREE.PointLight(0x3b82f6, 5);
    pointLight.position.set(-5, 2, -5);
    scene.add(pointLight);

    // Grid
    const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
    scene.add(gridHelper);

    // Dancer Group
    const dancerGroup = new THREE.Group();
    scene.add(dancerGroup);

    // Helper to create bone mesh
    const createBone = (length, color, locked) => {
      const group = new THREE.Group();
      
      const geometry = new THREE.CylinderGeometry(0.08, 0.06, length, 16);
      const material = new THREE.MeshStandardMaterial({ 
        color: locked ? 0xef4444 : color,
        emissive: locked ? 0x7f1d1d : 0x000000,
        roughness: 0.3,
        metalness: 0.8
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.y = length / 2;
      mesh.castShadow = true;
      
      const jointGeo = new THREE.SphereGeometry(0.12, 16, 16);
      const jointMat = new THREE.MeshStandardMaterial({ color: locked ? 0xef4444 : color });
      const joint = new THREE.Mesh(jointGeo, jointMat);
      
      group.add(joint);
      group.add(mesh);
      return group;
    };

    // Construct Skeleton
    const hips = new THREE.Group();
    hips.position.y = 1;
    dancerGroup.add(hips);

    // Spine & Head
    const spine = createBone(0.4, 0x3b82f6, false);
    hips.add(spine);

    const chest = createBone(0.3, 0x60a5fa, false);
    chest.position.y = 0.4;
    spine.add(chest);

    const headGroup = new THREE.Group();
    headGroup.position.y = 0.5; // Top of chest
    chest.add(headGroup);
    
    const headGeo = new THREE.BoxGeometry(0.2, 0.25, 0.2);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 0.125;
    headGroup.add(head);

    // Arms
    const leftArm = createBone(0.5, 0x94a3b8, false);
    leftArm.position.set(-0.25, 0.3, 0);
    leftArm.rotation.z = 0.2;
    chest.add(leftArm);

    const rightArm = createBone(0.5, 0x94a3b8, false);
    rightArm.position.set(0.25, 0.3, 0);
    rightArm.rotation.z = -0.2;
    chest.add(rightArm);

    // Legs
    const leftLeg = createBone(0.7, 0x475569, false);
    leftLeg.position.set(-0.15, 0, 0);
    leftLeg.rotation.z = 0.05;
    leftLeg.rotation.x = Math.PI; // Point down
    hips.add(leftLeg);

    const rightLeg = createBone(0.7, 0x475569, false);
    rightLeg.position.set(0.15, 0, 0);
    rightLeg.rotation.z = -0.05;
    rightLeg.rotation.x = Math.PI; // Point down
    hips.add(rightLeg);

    // Store references for animation
    dancerRef.current = {
      hips, spine, chest, headGroup, leftArm, rightArm, leftLeg, rightLeg,
      materials: [headMat, head.material] 
    };

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;

    return () => {
      if (containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
      cancelAnimationFrame(frameIdRef.current);
    };
  }, []);

  // Animation Loop
  useEffect(() => {
    const animate = () => {
      frameIdRef.current = requestAnimationFrame(animate);
      
      const t = isPlaying ? Date.now() * 0.003 : 0;
      const { energy, smoothness, bounce, creativity } = params;
      const d = dancerRef.current;

      if (d && rendererRef.current && sceneRef.current && cameraRef.current) {
        
        // Procedural Animation Logic
        const noise = Math.sin(t * 5) * 0.05 * creativity;

        if (!locks.spine) {
          d.hips.position.y = 1 + Math.abs(Math.sin(t)) * 0.1 * bounce;
          d.spine.rotation.x = Math.sin(t * 0.5) * 0.2 * smoothness;
          d.spine.rotation.y = Math.cos(t * 0.25) * 0.3 * energy;
        }

        if (!locks.head) {
          d.headGroup.rotation.y = Math.sin(t * 0.5) * 0.3;
        }

        if (!locks.arms) {
          const armAmp = 0.5 + energy * 0.5;
          d.leftArm.rotation.z = Math.PI/2 - 0.5 + Math.sin(t) * armAmp + noise;
          d.leftArm.rotation.x = Math.cos(t * 2) * 0.5;
          
          d.rightArm.rotation.z = -Math.PI/2 + 0.5 - Math.sin(t) * armAmp - noise;
          d.rightArm.rotation.x = Math.cos(t * 2 + Math.PI) * 0.5;
        }

        if (!locks.legs) {
          const contact = Math.sin(t * 2) > 0;
          d.leftLeg.rotation.x = Math.PI + (contact ? 0 : Math.sin(t * 2) * 0.5);
          d.rightLeg.rotation.x = Math.PI + (contact ? Math.sin(t * 2) * 0.5 : 0);
        }

        // Camera Orbit
        cameraRef.current.position.x = Math.sin(t * 0.1) * 5;
        cameraRef.current.position.z = Math.cos(t * 0.1) * 5;
        cameraRef.current.lookAt(0, 1, 0);

        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();
    return () => cancelAnimationFrame(frameIdRef.current);
  }, [isPlaying, params, locks]);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && cameraRef.current && rendererRef.current) {
        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;
        cameraRef.current.aspect = width / height;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(width, height);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return <div ref={containerRef} className="w-full h-full" />;
};

// --- 2. UI 컴포넌트: 타임라인 트랙 ---
const TimelineTrack = ({ label, color, segments, active, onSelect }) => (
  <div className="flex h-12 border-b border-slate-800 bg-slate-900/50 relative group">
    <div className="w-32 flex-shrink-0 border-r border-slate-700 flex items-center px-4 text-xs font-mono text-slate-400 bg-slate-900 z-10">
      {label}
    </div>
    <div className="flex-1 relative overflow-hidden">
      <div className="absolute inset-0 flex">
        {Array.from({length: 20}).map((_, i) => (
          <div key={i} className="flex-1 border-r border-slate-800/30"></div>
        ))}
      </div>
      {segments.map((seg, idx) => (
        <div 
          key={idx}
          className={`absolute top-1 bottom-1 rounded cursor-pointer transition-all border
            ${seg.active ? 'ring-2 ring-white z-20' : 'opacity-80 hover:opacity-100'}
          `}
          style={{ 
            left: `${seg.start}%`, 
            width: `${seg.duration}%`,
            backgroundColor: color,
            borderColor: 'rgba(255,255,255,0.1)'
          }}
          onClick={(e) => { e.stopPropagation(); onSelect(seg.id); }}
        >
          <div className="px-2 py-1 text-[10px] font-bold text-white/90 truncate flex items-center gap-1">
             {seg.icon} {seg.name}
          </div>
        </div>
      ))}
    </div>
  </div>
);

// --- 3. 메인 애플리케이션 ---
export default function SotaDanceStudio() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState('generation');
  const [viewMode, setViewMode] = useState('render');
  const [currentTime, setCurrentTime] = useState(0); // 재생 시간 (초)
  const [totalDuration, setTotalDuration] = useState(120); // 총 길이 (초)
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [prompt, setPrompt] = useState("Powerful hip-hop routine with popping elements.");
  const [selectedStyle, setSelectedStyle] = useState("hiphop");
  const [audioFile, setAudioFile] = useState(null);
  const [timelineZoom, setTimelineZoom] = useState(1);
  const [playheadPosition, setPlayheadPosition] = useState(25); // 재생 헤드 위치 (%)
  
  // SOTA 기능 상태 관리 (Locks & Params)
  const [locks, setLocks] = useState({ head: false, spine: false, arms: false, legs: false });
  const [params, setParams] = useState({
    energy: 0.75,
    smoothness: 0.5,
    bounce: 0.6,
    creativity: 0.4,
  });

  // 타임라인 데이터
  const [tracks, setTracks] = useState({
    music: [{ id: 'm1', start: 0, duration: 100, name: 'NewJeans_SuperShy.mp3', active: true }],
    motion: [
      { id: 'd1', start: 0, duration: 25, name: 'Intro_Groove', active: false, icon: <Activity size={10}/> },
      { id: 'd2', start: 25, duration: 30, name: 'Verse_HipHop', active: true, icon: <Zap size={10}/> },
      { id: 'd3', start: 55, duration: 20, name: 'Chorus_Point', active: false, icon: <Sparkles size={10}/> },
    ],
    formation: [
       { id: 'f1', start: 55, duration: 20, name: 'V-Shape Formation', active: false, icon: <Users size={10}/> }
    ]
  });

  // 재생 시간 업데이트
  useEffect(() => {
    let interval = null;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentTime(prev => {
          const newTime = prev + 0.1;
          if (newTime >= totalDuration) {
            setIsPlaying(false);
            return totalDuration;
          }
          // 재생 헤드 위치 업데이트 (0-100%)
          setPlayheadPosition((newTime / totalDuration) * 100);
          return newTime;
        });
      }, 100);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, totalDuration]);

  // 시간 포맷팅 (MM:SS:FF)
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const frames = Math.floor((seconds % 1) * 30); // 30fps 가정
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
  };

  // 모션 생성 함수
  const handleGenerateMotion = async () => {
    if (!prompt.trim()) {
      alert('프롬프트를 입력해주세요.');
      return;
    }
    
    setIsGenerating(true);
    setGenerationProgress(0);
    
    // 모의 생성 프로세스 (실제로는 API 호출)
    const simulateGeneration = () => {
      const interval = setInterval(() => {
        setGenerationProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setIsGenerating(false);
            // 생성된 모션을 타임라인에 추가
            const newMotion = {
              id: `d${Date.now()}`,
              start: playheadPosition,
              duration: 15,
              name: prompt.substring(0, 20) + '...',
              active: true,
              icon: <Sparkles size={10}/>
            };
            setTracks(prev => ({
              ...prev,
              motion: [...prev.motion, newMotion]
            }));
            return 100;
          }
          return prev + 2;
        });
      }, 100);
    };
    
    simulateGeneration();
  };

  // 타임라인 클릭으로 재생 헤드 이동
  const handleTimelineClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = (x / rect.width) * 100;
    setPlayheadPosition(Math.max(0, Math.min(100, percent)));
    setCurrentTime((percent / 100) * totalDuration);
  };

  // Skip 기능
  const handleSkip = (direction) => {
    const skipAmount = 5; // 5초
    if (direction === 'back') {
      const newTime = Math.max(0, currentTime - skipAmount);
      setCurrentTime(newTime);
      setPlayheadPosition((newTime / totalDuration) * 100);
    } else {
      const newTime = Math.min(totalDuration, currentTime + skipAmount);
      setCurrentTime(newTime);
      setPlayheadPosition((newTime / totalDuration) * 100);
    }
  };

  // Export FBX
  const handleExportFBX = () => {
    // 모의 내보내기
    const data = {
      motions: tracks.motion,
      params: params,
      locks: locks
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'motion_export.json';
    a.click();
    URL.revokeObjectURL(url);
    alert('모션 데이터가 내보내졌습니다. (실제 FBX는 백엔드 연동 필요)');
  };

  // 오디오 파일 길이 가져오기
  const getAudioDuration = (file) => {
    return new Promise((resolve) => {
      const audio = new Audio();
      const url = URL.createObjectURL(file);
      audio.src = url;
      audio.addEventListener('loadedmetadata', () => {
        URL.revokeObjectURL(url);
        resolve(audio.duration);
      });
      audio.addEventListener('error', () => {
        URL.revokeObjectURL(url);
        resolve(120); // 기본값
      });
    });
  };

  // 오디오 분석 함수 (실제 백엔드 API 호출)
  const analyzeAudio = async (file) => {
    setIsAnalyzingAudio(true);
    try {
      const analysis = await analyzeAudioAPI(file);
      setAudioAnalysis(analysis);
      // 백엔드에서 반환한 실제 duration 사용
      setTotalDuration(analysis.duration);
      setIsAnalyzingAudio(false);
      return analysis;
    } catch (error) {
      console.error('오디오 분석 실패:', error);
      setIsAnalyzingAudio(false);
      // 에러 발생 시 브라우저로 길이 가져오기
      const duration = await getAudioDuration(file);
      setTotalDuration(duration);
      alert('오디오 분석에 실패했습니다. 기본 길이를 사용합니다.');
      throw error;
    }
  };

  // 오디오 파일 업로드 및 분석
  const handleAudioUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setAudioFile(file);
      setAudioAnalysis(null); // 이전 분석 결과 초기화
      setIsPlaying(false); // 재생 중지
      setCurrentTime(0);
      setPlayheadPosition(0);
      
      // 타임라인에 음악 트랙 추가 (임시)
      setTracks(prev => ({
        ...prev,
        music: [{ id: 'm1', start: 0, duration: 100, name: file.name, active: true }],
        motion: [] // 새 음악 업로드 시 기존 안무 제거
      }));
      
      // 실제 백엔드 API로 오디오 분석
      try {
        await analyzeAudio(file);
      } catch (error) {
        // 에러 발생 시 기본값 설정
        const duration = await getAudioDuration(file);
        setTotalDuration(duration);
      }
    }
  };

  const toggleLock = (part) => setLocks(p => ({ ...p, [part]: !p[part] }));

  return (
    <div className="w-full h-screen bg-[#050505] text-slate-200 font-sans flex flex-col overflow-hidden selection:bg-pink-500 selection:text-white">
      
      {/* 상단 네비게이션 */}
      <nav className="h-12 border-b border-slate-800 bg-[#0a0a0a] flex items-center justify-between px-4 select-none">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-pink-500 font-bold tracking-tighter text-lg">
            <Layers className="fill-current" /> SOTA<span className="text-white">STUDIO</span>
          </div>
          <div className="h-4 w-[1px] bg-slate-700 mx-2"></div>
          <div className="flex gap-1 bg-slate-900 p-1 rounded-lg">
            {['generation', 'editing', 'rigging'].map(tab => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 text-xs font-medium rounded transition-all capitalize
                  ${activeTab === tab ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}
                `}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs font-mono text-slate-500 hidden md:flex gap-4">
            <span>MEM: 2.4GB</span>
            <span className="text-green-500">Latency: 12ms</span>
          </div>
          <button 
            onClick={handleExportFBX}
            className="bg-pink-600 hover:bg-pink-500 text-white px-3 py-1.5 rounded text-xs font-bold flex items-center gap-2 transition"
          >
            <Download size={14}/> Export FBX
          </button>
        </div>
      </nav>

      {/* 메인 작업 공간 */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* 좌측 패널: 생성 제어 및 잠금(Locks) */}
        <aside className="w-72 bg-[#0a0a0a] border-r border-slate-800 flex flex-col overflow-y-auto">
          {activeTab === 'generation' && (
            <div className="p-4 space-y-6">
              
              {/* 오디오 업로드 */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                  <Video size={12} className="text-blue-400"/> Audio File
                </label>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleAudioUpload}
                  className="hidden"
                  id="audio-upload"
                />
                <label
                  htmlFor="audio-upload"
                  className="block w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm cursor-pointer hover:border-pink-500 transition text-center"
                >
                  {audioFile ? audioFile.name : '오디오 파일 업로드'}
                </label>
              </div>
              
              {/* 프롬프트 입력 */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                  <Wand2 size={12} className="text-pink-400"/> Text-to-Motion
                </label>
                <textarea 
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm focus:outline-none focus:border-pink-500 transition resize-none h-24"
                  placeholder="예: 강렬한 비트의 K-Pop 보이그룹 군무, 절도 있는 동작"
                />
              </div>

              {/* 스타일 선택 */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                  <Sparkles size={12} className="text-purple-400"/> Style
                </label>
                <select
                  value={selectedStyle}
                  onChange={(e) => setSelectedStyle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm focus:outline-none focus:border-pink-500 transition"
                >
                  <option value="hiphop">Hip-Hop</option>
                  <option value="pop">Pop</option>
                  <option value="ballad">Ballad</option>
                  <option value="girlcrush">Girl Crush</option>
                  <option value="conceptual">Conceptual</option>
                </select>
              </div>

              {/* In-painting 잠금 제어 */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-400 uppercase flex items-center justify-between">
                   <span className="flex items-center gap-2"><Lock size={12} className="text-blue-400"/> 부분 고정 (In-painting)</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.keys(locks).map(part => (
                    <button
                      key={part}
                      onClick={() => toggleLock(part)}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium border transition-all
                        ${locks[part] 
                          ? 'bg-red-500/10 border-red-500/50 text-red-400' 
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}
                      `}
                    >
                      <span className="capitalize">{part}</span>
                      {locks[part] ? <Lock size={12}/> : <Unlock size={12}/>}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  * 잠금(Lock)된 부위는 고정되고 나머지 부위만 AI가 새로 생성합니다.
                </p>
              </div>

              {/* 파라미터 슬라이더 */}
              <div className="space-y-4 pt-4 border-t border-slate-800">
                <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                   <Sliders size={12} className="text-green-400"/> Diffusion Parameters
                </label>
                
                <div className="space-y-1">
                   <div className="flex justify-between text-xs text-slate-400">
                      <span>Energy</span> <span>{(params.energy * 100).toFixed(0)}%</span>
                   </div>
                   <input type="range" min="0" max="1" step="0.01" 
                     value={params.energy} onChange={e=>setParams({...params, energy: parseFloat(e.target.value)})}
                     className="w-full h-1 bg-slate-800 rounded-lg accent-pink-500 cursor-pointer"
                   />
                </div>
                <div className="space-y-1">
                   <div className="flex justify-between text-xs text-slate-400">
                      <span>Smoothness</span> <span>{(params.smoothness * 100).toFixed(0)}%</span>
                   </div>
                   <input type="range" min="0" max="1" step="0.01" 
                     value={params.smoothness} onChange={e=>setParams({...params, smoothness: parseFloat(e.target.value)})}
                     className="w-full h-1 bg-slate-800 rounded-lg accent-blue-500 cursor-pointer"
                   />
                </div>
                <div className="space-y-1">
                   <div className="flex justify-between text-xs text-slate-400">
                      <span>Bounce</span> <span>{(params.bounce * 100).toFixed(0)}%</span>
                   </div>
                   <input type="range" min="0" max="1" step="0.01" 
                     value={params.bounce} onChange={e=>setParams({...params, bounce: parseFloat(e.target.value)})}
                     className="w-full h-1 bg-slate-800 rounded-lg accent-yellow-500 cursor-pointer"
                   />
                </div>
                <div className="space-y-1">
                   <div className="flex justify-between text-xs text-slate-400">
                      <span>Creativity</span> <span>{params.creativity.toFixed(1)}</span>
                   </div>
                   <input type="range" min="0" max="2" step="0.1" 
                     value={params.creativity} onChange={e=>setParams({...params, creativity: parseFloat(e.target.value)})}
                     className="w-full h-1 bg-slate-800 rounded-lg accent-purple-500 cursor-pointer"
                   />
                </div>
              </div>

              <button 
                onClick={handleGenerateMotion}
                disabled={isGenerating}
                className={`w-full py-3 bg-gradient-to-r from-pink-600 to-violet-600 rounded-lg text-sm font-bold shadow-lg flex items-center justify-center gap-2 mt-4 transition-all ${
                  isGenerating ? 'opacity-50 cursor-not-allowed' : 'hover:from-pink-500 hover:to-violet-500'
                }`}
              >
                {isGenerating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Generating... {generationProgress}%
                  </>
                ) : (
                  <>
                 <Sparkles size={16} /> Generate Motion
                  </>
                )}
              </button>
              
              {isGenerating && (
                <div className="w-full bg-slate-900 rounded-lg h-2 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-pink-500 to-violet-500 transition-all duration-300"
                    style={{ width: `${generationProgress}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {activeTab === 'editing' && (
            <div className="p-4 space-y-6">
              <h3 className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                <Sliders size={12} className="text-blue-400"/> Motion Editing
              </h3>
              
              <div className="space-y-3">
                <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                  <div className="text-xs text-slate-500 mb-2">선택된 모션 세그먼트</div>
                  <div className="text-sm text-slate-300">
                    {tracks.motion.find(m => m.active)?.name || 'None selected'}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-slate-400">시작 시간 (초)</label>
                  <input
                    type="number"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm"
                    placeholder="0"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-slate-400">지속 시간 (초)</label>
                  <input
                    type="number"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm"
                    placeholder="10"
                  />
                </div>

                <button className="w-full py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm transition">
                  세그먼트 삭제
                </button>
              </div>
            </div>
          )}

          {activeTab === 'rigging' && (
            <div className="p-4 space-y-6">
              <h3 className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                <Bone size={12} className="text-yellow-400"/> Skeleton Rigging
              </h3>
              
              <div className="space-y-3">
                <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                  <div className="text-xs text-slate-500 mb-2">관절 제약 설정</div>
                  <div className="space-y-2">
                    {['Hips', 'Spine', 'Shoulders', 'Elbows', 'Knees'].map(joint => (
                      <div key={joint} className="flex items-center justify-between">
                        <span className="text-xs text-slate-300">{joint}</span>
                        <input
                          type="range"
                          min="0"
                          max="180"
                          defaultValue="90"
                          className="w-24 h-1 bg-slate-800 rounded-lg accent-yellow-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <button className="w-full py-2 bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-600/50 rounded-lg text-sm transition text-yellow-400">
                  리깅 적용
                </button>
              </div>
            </div>
          )}
        </aside>

        {/* 중앙: 3D 뷰포트 (Native Three.js) */}
        <main className="flex-1 flex flex-col relative bg-[#0f0f0f]">
          
          <div className="absolute top-4 left-4 z-10 flex gap-2">
             <button onClick={()=>setViewMode('render')} className={`p-2 rounded-md backdrop-blur-md border ${viewMode==='render' ? 'bg-white/10 border-white/30 text-white':'bg-black/50 border-white/5 text-slate-400'}`}>
               <Video size={16}/>
             </button>
             <button onClick={()=>setViewMode('skeleton')} className={`p-2 rounded-md backdrop-blur-md border ${viewMode==='skeleton' ? 'bg-white/10 border-white/30 text-white':'bg-black/50 border-white/5 text-slate-400'}`}>
               <Bone size={16}/>
             </button>
          </div>

          <div className="flex-1 relative overflow-hidden">
             <NativeThreeViewer isPlaying={isPlaying} params={params} locks={locks} />
          </div>

          {/* 하단: 타임라인 패널 */}
          <div className="h-64 bg-[#0a0a0a] border-t border-slate-800 flex flex-col">
            <div className="h-10 border-b border-slate-800 flex items-center justify-between px-4 bg-slate-900/80">
              <div className="flex items-center gap-4">
                 <button onClick={() => setIsPlaying(!isPlaying)} className="text-white hover:text-pink-400 transition">
                   {isPlaying ? <Pause size={20} fill="currentColor"/> : <Play size={20} fill="currentColor"/>}
                 </button>
                 <div className="flex gap-2 text-slate-400">
                    <button 
                      onClick={() => handleSkip('back')}
                      className="hover:text-white transition cursor-pointer"
                    >
                      <SkipBack size={16}/>
                    </button>
                    <button 
                      onClick={() => handleSkip('forward')}
                      className="hover:text-white transition cursor-pointer"
                    >
                      <SkipForward size={16}/>
                    </button>
                 </div>
                 <div className="text-xs font-mono text-pink-500 bg-pink-500/10 px-2 py-0.5 rounded border border-pink-500/20">
                   {formatTime(currentTime)} / {formatTime(totalDuration)}
                 </div>
              </div>
            </div>

            <div 
              className="flex-1 overflow-y-auto overflow-x-hidden relative cursor-pointer"
              onClick={handleTimelineClick}
            >
              <TimelineTrack label="AUDIO" color="#db2777" segments={tracks.music} active={true} onSelect={() => {}}/>
              <TimelineTrack label="MOTION" color="#4f46e5" segments={tracks.motion} active={true} onSelect={(id) => {
                  setTracks(prev => ({...prev, motion: prev.motion.map(m => ({...m, active: m.id === id}))}));
              }}/>
              <TimelineTrack label="FORMATION" color="#059669" segments={tracks.formation} active={false} onSelect={() => {}}/>
              
              {/* 재생 헤드 (Playhead) */}
              <div 
                className="absolute top-0 bottom-0 w-[2px] bg-red-500 z-50 pointer-events-none"
                style={{ left: `${playheadPosition}%` }}
              >
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-transparent border-t-red-500"></div>
              </div>
            </div>
          </div>
        </main>

        {/* 우측 패널: 대형 뷰 (Formation) */}
        <aside className="w-64 bg-[#0a0a0a] border-l border-slate-800 hidden xl:flex flex-col">
          <div className="p-4 border-b border-slate-800">
             <h3 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
               <Grid3X3 size={12}/> Formation View
             </h3>
             <div className="aspect-square bg-slate-900 rounded-lg border border-slate-800 relative p-4 flex items-center justify-center overflow-hidden cursor-crosshair">
                <div className="absolute inset-0 grid grid-cols-4 grid-rows-4 divide-x divide-y divide-slate-800/30 opacity-50"></div>
                {/* Formation 포인트들 - 클릭 가능 */}
                <div 
                  className="w-3 h-3 bg-pink-500 rounded-full shadow-[0_0_10px_rgba(236,72,153,0.8)] z-10 relative cursor-move hover:scale-125 transition-transform"
                  style={{ transform: 'translate(0, 0)' }}
                ></div>
                <div className="absolute w-2 h-2 bg-slate-600 rounded-full top-1/3 left-1/4 cursor-move hover:bg-slate-500 transition-colors"></div>
                <div className="absolute w-2 h-2 bg-slate-600 rounded-full top-1/3 right-1/4 cursor-move hover:bg-slate-500 transition-colors"></div>
                <div className="absolute w-2 h-2 bg-slate-600 rounded-full bottom-1/3 left-1/4 cursor-move hover:bg-slate-500 transition-colors"></div>
                <div className="absolute w-2 h-2 bg-slate-600 rounded-full bottom-1/3 right-1/4 cursor-move hover:bg-slate-500 transition-colors"></div>
             </div>
             <div className="mt-2 flex gap-2">
               <button className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs transition">
                 Reset
               </button>
               <button className="flex-1 py-1.5 bg-green-600/20 hover:bg-green-600/30 border border-green-600/50 rounded text-xs text-green-400 transition">
                 Save
               </button>
             </div>
          </div>
          <div className="p-4 flex-1">
             <h3 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
               <Activity size={12}/> Analysis
             </h3>
             <div className="space-y-2">
             <div className="bg-slate-900 p-2 rounded text-[10px] text-slate-400 border border-slate-800">
                <span className="block text-slate-500 mb-1">Beat Sync Score</span>
                <div className="flex items-end gap-1">
                   <span className="text-lg font-bold text-green-400">98.2</span>
                   <span className="mb-1">%</span>
                  </div>
               </div>
               <div className="bg-slate-900 p-2 rounded text-[10px] text-slate-400 border border-slate-800">
                  <span className="block text-slate-500 mb-1">Engagement Score</span>
                  <div className="flex items-end gap-1">
                     <span className="text-lg font-bold text-pink-400">87.5</span>
                     <span className="mb-1">%</span>
                  </div>
               </div>
               <div className="bg-slate-900 p-2 rounded text-[10px] text-slate-400 border border-slate-800">
                  <span className="block text-slate-500 mb-1">Style Match</span>
                  <div className="flex items-end gap-1">
                     <span className="text-lg font-bold text-blue-400">{selectedStyle}</span>
                  </div>
                </div>
             </div>
          </div>
        </aside>

      </div>
    </div>
  );
}
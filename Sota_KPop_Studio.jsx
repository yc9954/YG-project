import React, { useState, useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { 
  Play, Pause, SkipBack, SkipForward, Wand2, Layers, 
  Download, Sparkles, Users, Zap, Activity, 
  Lock, Unlock, Sliders, Video, Grid3X3, Bone,
  Copy, Clipboard, Scissors, Trash2, Save, FolderOpen,
  BookOpen, Search, Filter, Tag, Star, X
} from 'lucide-react';

/**
 * SOTA K-Pop Studio - AI 기반 안무 생성 도구
 * Motion Diffusion Model을 활용한 음악-프롬프트 기반 안무 생성
 */

// --- 1. Native Three.js 3D 엔진 ---
const NativeThreeViewer = ({ isPlaying, params, locks, currentTime, motionData, fps = 30, beats = null, dancers = [] }) => {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const dancerRefs = useRef({});
  const dancersGroupRef = useRef(null);
  const frameIdRef = useRef(null);

  // 3D 씬 초기화
  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#111');
    scene.fog = new THREE.Fog('#111', 5, 20);

    const camera = new THREE.PerspectiveCamera(50, containerRef.current.clientWidth / containerRef.current.clientHeight, 0.1, 100);
    camera.position.set(0, 2, 5);
    camera.lookAt(0, 1, 0);

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

    const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
    scene.add(gridHelper);

    // 다중 캐릭터를 위한 그룹
    const dancersGroup = new THREE.Group();
    scene.add(dancersGroup);
    dancersGroupRef.current = dancersGroup;

    // 캐릭터 생성 함수
    const createDancer = (id, position = { x: 0, y: 0, z: 0 }, color = 0x3b82f6) => {
      const dancerGroup = new THREE.Group();
      dancerGroup.position.set(position.x, position.y, position.z);
      dancersGroup.add(dancerGroup);

      const createBone = (length, boneColor, locked) => {
        const group = new THREE.Group();
        const geometry = new THREE.CylinderGeometry(0.08, 0.06, length, 16);
        const material = new THREE.MeshStandardMaterial({ 
          color: locked ? 0xef4444 : boneColor,
          emissive: locked ? 0x7f1d1d : 0x000000,
          roughness: 0.3,
          metalness: 0.8
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.y = length / 2;
        mesh.castShadow = true;
        
        const jointGeo = new THREE.SphereGeometry(0.12, 16, 16);
        const jointMat = new THREE.MeshStandardMaterial({ color: locked ? 0xef4444 : boneColor });
        const joint = new THREE.Mesh(jointGeo, jointMat);
        
        group.add(joint);
        group.add(mesh);
        return group;
      };

      const hips = new THREE.Group();
      hips.position.y = 1;
      dancerGroup.add(hips);

      const spine = createBone(0.4, color, locks.spine);
      hips.add(spine);

      const chest = createBone(0.3, color, locks.spine);
      chest.position.y = 0.4;
      spine.add(chest);

      // 목 추가 (HumanML3D 관절 9)
      const neck = createBone(0.15, color, locks.spine);
      neck.position.y = 0.3;
      chest.add(neck);

      // 머리 추가 (HumanML3D 관절 12)
      const head = createBone(0.2, 0xff6b6b, locks.head);
      head.position.y = 0.15;
      neck.add(head);

      // 왼쪽 어깨/팔 (HumanML3D 관절 13)
      const leftUpperArm = createBone(0.35, 0x4ecdc4, locks.arms);
      leftUpperArm.position.set(-0.15, 0.1, 0);
      leftUpperArm.rotation.z = 0.3;
      neck.add(leftUpperArm);

      const leftForearm = createBone(0.3, 0x4ecdc4, locks.arms);
      leftForearm.position.y = 0.35;
      leftUpperArm.add(leftForearm);

      // 오른쪽 어깨/팔 (HumanML3D 관절 14)
      const rightUpperArm = createBone(0.35, 0x4ecdc4, locks.arms);
      rightUpperArm.position.set(0.15, 0.1, 0);
      rightUpperArm.rotation.z = -0.3;
      neck.add(rightUpperArm);

      const rightForearm = createBone(0.3, 0x4ecdc4, locks.arms);
      rightForearm.position.y = 0.35;
      rightUpperArm.add(rightForearm);

      const leftThigh = createBone(0.4, 0x95e1d3, locks.legs);
      leftThigh.position.set(-0.1, 0, 0);
      leftThigh.rotation.x = -0.1; // 다리가 아래로 향하도록 수정
      hips.add(leftThigh);

      const leftShin = createBone(0.4, 0x95e1d3, locks.legs);
      leftShin.position.y = -0.4; // 아래로 향하도록 수정
      leftThigh.add(leftShin);

      const rightThigh = createBone(0.4, 0x95e1d3, locks.legs);
      rightThigh.position.set(0.1, 0, 0);
      rightThigh.rotation.x = -0.1; // 다리가 아래로 향하도록 수정
      hips.add(rightThigh);

      const rightShin = createBone(0.4, 0x95e1d3, locks.legs);
      rightShin.position.y = -0.4; // 아래로 향하도록 수정
      rightThigh.add(rightShin);

      // 발목과 발 추가 (HumanML3D 22개 관절 지원)
      const leftAnkle = createBone(0.15, 0x95e1d3, locks.legs);
      leftAnkle.position.y = -0.4;
      leftShin.add(leftAnkle);

      const leftFoot = createBone(0.2, 0x95e1d3, locks.legs);
      leftFoot.position.y = -0.15;
      leftFoot.rotation.x = Math.PI / 6; // 발이 바닥에 평행하도록
      leftAnkle.add(leftFoot);

      const rightAnkle = createBone(0.15, 0x95e1d3, locks.legs);
      rightAnkle.position.y = -0.4;
      rightShin.add(rightAnkle);

      const rightFoot = createBone(0.2, 0x95e1d3, locks.legs);
      rightFoot.position.y = -0.15;
      rightFoot.rotation.x = Math.PI / 6; // 발이 바닥에 평행하도록
      rightAnkle.add(rightFoot);


      // 손목과 손 추가
      const leftWrist = createBone(0.1, 0x4ecdc4, locks.arms);
      leftWrist.position.y = 0.3;
      leftForearm.add(leftWrist);

      const leftHand = createBone(0.15, 0x4ecdc4, locks.arms);
      leftHand.position.y = 0.1;
      leftWrist.add(leftHand);

      const rightWrist = createBone(0.1, 0x4ecdc4, locks.arms);
      rightWrist.position.y = 0.3;
      rightForearm.add(rightWrist);

      const rightHand = createBone(0.15, 0x4ecdc4, locks.arms);
      rightHand.position.y = 0.1;
      rightWrist.add(rightHand);

      // 모든 관절을 참조할 수 있도록 반환
      return { 
        group: dancerGroup, 
        hips,
        // HumanML3D 22개 관절 매핑
        joints: {
          0: hips,           // root
          1: leftThigh,      // left hip
          2: rightThigh,     // right hip
          3: spine,          // spine
          4: leftShin,       // left knee
          5: rightShin,      // right knee
          6: chest,          // chest
          7: leftAnkle,      // left ankle
          8: rightAnkle,     // right ankle
          9: neck,           // neck
          10: leftFoot,      // left foot
          11: rightFoot,     // right foot
          12: head,          // head
          13: leftUpperArm,  // left shoulder
          14: rightUpperArm, // right shoulder
          15: head,          // head end (head와 동일)
          16: leftForearm,   // left elbow
          17: rightForearm,  // right elbow
          18: leftWrist,     // left wrist
          19: rightWrist,    // right wrist
          20: leftHand,      // left hand
          21: rightHand      // right hand
        }
      };
    };

    // 다중 캐릭터 생성
    const colors = [0x3b82f6, 0xef4444, 0x10b981, 0xf59e0b, 0x8b5cf6];
    dancers.forEach((dancer, index) => {
      const color = colors[index % colors.length];
      const dancerData = createDancer(dancer.id, dancer.position, color);
      dancerRefs.current[dancer.id] = { 
        group: dancerData.group, 
        hips: dancerData.hips,
        joints: dancerData.joints,
        motionData: dancer.motionData 
      };
    });

    // 기본 캐릭터 (dancers가 없을 때)
    if (dancers.length === 0) {
      const dancerData = createDancer('default', { x: 0, y: 0, z: 0 }, 0x3b82f6);
      dancerRefs.current['default'] = { 
        group: dancerData.group, 
        hips: dancerData.hips,
        joints: dancerData.joints,
        motionData: null 
      };
    }

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;

    return () => {
      if (containerRef.current && renderer.domElement.parentNode) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [locks, dancers]);


  // 모션 데이터 적용 (여러 캐릭터 지원)
  const applyMotionFrame = (frameData, frameTime, dancerId = null) => {
    // 프레임 데이터는 최소 66개 값(22개 관절 * 3)이어야 함 (HumanML3D 전체 관절)
    if (!frameData || !Array.isArray(frameData) || frameData.length < 66) {
      if (frameData && Array.isArray(frameData)) {
        console.warn(`⚠️  모션 데이터 길이 부족: ${frameData.length}/66 (22개 관절 * 3)`);
      }
      return;
    }

    // 특정 캐릭터에 적용하거나, 모든 캐릭터에 적용
    const targetDancers = dancerId 
      ? [dancerRefs.current[dancerId]].filter(Boolean)
      : Object.values(dancerRefs.current);

    targetDancers.forEach((dancerRef) => {
      if (!dancerRef || !dancerRef.hips) return;

      try {
        const hips = dancerRef.hips;
        if (!hips) {
          console.warn('hips 본을 찾을 수 없음');
          return;
        }
        
        // 캐릭터가 보이도록 visibility 확인
        if (dancerRef.group && dancerRef.group.visible === false) {
          dancerRef.group.visible = true;
        }
        if (hips.visible === false) {
          hips.visible = true;
        }

        // 회전 스케일 조정 - 백엔드에서 생성하는 모션 데이터는 작은 값이므로 스케일 증가
        // 백엔드 코드를 보면 모션 값이 0.1~0.3 범위로 생성되므로, 이를 라디안으로 변환
        const rotationScale = 3.0; // 모션 데이터를 더 크게 스케일링하여 움직임이 잘 보이도록 증가
        const smoothness = params.smoothness || 0.5;

        const lerp = (a, b, t) => a + (b - a) * t;

        // 관절 매핑 - HumanML3D 22 관절 포맷 (전체 지원)
        // HumanML3D 관절 순서 (t2m_kinematic_chain 기반):
        // 0: root (hips), 1: left hip, 2: right hip, 3: spine, 4: left knee, 5: right knee,
        // 6: chest, 7: left ankle, 8: right ankle, 9: neck, 10: left foot, 11: right foot,
        // 12: head, 13: left shoulder, 14: right shoulder, 15: head end,
        // 16: left elbow, 17: right elbow, 18: left wrist, 19: right wrist,
        // 20: left hand, 21: right hand
        // 참고: t2m_kinematic_chain = [[0, 2, 5, 8, 11], [0, 1, 4, 7, 10], [0, 3, 6, 9, 12, 15], [9, 14, 17, 19, 21], [9, 13, 16, 18, 20]]
        const jointMap = [
          { name: 'hips', idx: 0, parent: null },
          { name: 'leftThigh', idx: 1, parent: 'hips' },      // left hip
          { name: 'rightThigh', idx: 2, parent: 'hips' },    // right hip
          { name: 'spine', idx: 3, parent: 'hips' },
          { name: 'leftShin', idx: 4, parent: 'leftThigh' }, // left knee
          { name: 'rightShin', idx: 5, parent: 'rightThigh' }, // right knee
          { name: 'chest', idx: 6, parent: 'spine' },
          { name: 'leftAnkle', idx: 7, parent: 'leftShin' },
          { name: 'rightAnkle', idx: 8, parent: 'rightShin' },
          { name: 'neck', idx: 9, parent: 'chest' },
          { name: 'leftFoot', idx: 10, parent: 'leftAnkle' },
          { name: 'rightFoot', idx: 11, parent: 'rightAnkle' },
          { name: 'head', idx: 12, parent: 'neck' },
          { name: 'leftUpperArm', idx: 13, parent: 'neck' },  // left shoulder
          { name: 'rightUpperArm', idx: 14, parent: 'neck' }, // right shoulder
          { name: 'headEnd', idx: 15, parent: 'head' }, // head와 동일 (head chain의 끝)
          { name: 'leftForearm', idx: 16, parent: 'leftUpperArm' }, // left elbow
          { name: 'rightForearm', idx: 17, parent: 'rightUpperArm' }, // right elbow
          { name: 'leftWrist', idx: 18, parent: 'leftForearm' },
          { name: 'rightWrist', idx: 19, parent: 'rightForearm' },
          { name: 'leftHand', idx: 20, parent: 'leftWrist' },
          { name: 'rightHand', idx: 21, parent: 'rightWrist' },
        ];

        // 스켈레톤 구조 - joints 객체 사용 (22개 관절 모두 지원)
        const joints = dancerRef.joints || {};
        
        // 기존 방식과의 호환성을 위해 boneMap 생성
        const boneMap = {
          hips: joints[0] || hips,
          leftThigh: joints[1],
          rightThigh: joints[2],
          spine: joints[3],
          leftShin: joints[4],
          rightShin: joints[5],
          chest: joints[6],
          leftAnkle: joints[7],
          rightAnkle: joints[8],
          neck: joints[9],
          leftFoot: joints[10],
          rightFoot: joints[11],
          head: joints[12],
          leftUpperArm: joints[13],
          rightUpperArm: joints[14],
          headEnd: joints[15] || joints[12], // head와 동일
          leftForearm: joints[16],
          rightForearm: joints[17],
          leftWrist: joints[18],
          rightWrist: joints[19],
          leftHand: joints[20],
          rightHand: joints[21]
        };

        // 모든 본이 제대로 찾아졌는지 확인
        const missingBones = Object.entries(boneMap).filter(([name, bone]) => !bone);
        if (missingBones.length > 0) {
          console.warn('일부 본을 찾을 수 없음:', missingBones.map(([name]) => name));
        }

        // 부드러움에 따른 블렌드 팩터 계산
        // smoothness가 낮을수록 즉시 반영 (0.0 = 즉시, 1.0 = 매우 부드럽게)
        // 모션이 잘 보이도록 기본값을 높게 설정
        const blendFactor = Math.max(0.7, Math.min(1.0, 0.7 + (1.0 - smoothness) * 0.3));

        jointMap.forEach(({ name, idx }) => {
          if (idx * 3 + 2 >= frameData.length) return;

          const baseIdx = idx * 3;
          
          // 모션 데이터에서 회전 값 추출 (라디안 단위)
          // 백엔드 데이터는 보통 작은 값이므로 스케일 조정
          // 실제 안무가 잘 보이도록 스케일을 더 크게 조정
          let rx = (frameData[baseIdx] || 0) * rotationScale;
          let ry = (frameData[baseIdx + 1] || 0) * rotationScale;
          let rz = (frameData[baseIdx + 2] || 0) * rotationScale;
          
          // 관절별로 추가 스케일 조정 (더 자연스러운 움직임)
          if (name === 'hips') {
            rx *= 1.5; // 엉덩이 회전을 더 크게
            ry *= 1.5;
            rz *= 1.5;
          } else if (name.includes('Arm') || name.includes('Forearm') || name.includes('Wrist') || name.includes('Hand')) {
            rx *= 1.8; // 팔 부위 움직임을 더 크게
            ry *= 1.8;
            rz *= 1.8;
          } else if (name.includes('Thigh') || name.includes('Shin') || name.includes('Ankle') || name.includes('Foot')) {
            rx *= 1.6; // 다리 부위 움직임을 더 크게
            ry *= 1.6;
            rz *= 1.6;
          } else if (name === 'spine' || name === 'chest' || name === 'neck') {
            rx *= 1.2; // 척추 부위 움직임
            ry *= 1.2;
            rz *= 1.2;
          } else if (name === 'head' || name === 'headEnd') {
            rx *= 1.0; // 머리는 자연스럽게
            ry *= 1.0;
            rz *= 1.0;
          }
          
          // 회전 값을 합리적인 범위로 제한 (너무 큰 회전 방지)
          rx = Math.max(-Math.PI * 0.9, Math.min(Math.PI * 0.9, rx));
          ry = Math.max(-Math.PI * 0.9, Math.min(Math.PI * 0.9, ry));
          rz = Math.max(-Math.PI * 0.9, Math.min(Math.PI * 0.9, rz));

          const target = boneMap[name];
          if (target) {
            // 관절별로 회전 축 조정 (Three.js 좌표계에 맞춤)
            // 팔과 다리는 다른 축으로 회전해야 자연스러움
            let finalRx = rx, finalRy = ry, finalRz = rz;
            
            if (name.includes('Arm')) {
              // 팔: 주로 Z축 회전 (앞뒤), Y축 회전 (좌우), X축 회전 (위아래)
              finalRx = rx;
              finalRy = ry;
              finalRz = rz;
            } else if (name.includes('Thigh') || name.includes('Shin')) {
              // 다리: 주로 X축 회전 (앞뒤), Y축 회전 (좌우), Z축 회전 (회전)
              finalRx = rx;
              finalRy = ry;
              finalRz = rz;
            } else if (name === 'hips') {
              // 엉덩이: Y축 회전 (회전), X축 회전 (앞뒤 기울임), Z축 회전 (좌우 기울임)
              // 이미 스케일이 적용되었으므로 추가 제한은 줄임
              finalRx = rx * 0.8;
              finalRy = ry;
              finalRz = rz * 0.8;
            } else if (name === 'spine' || name === 'chest') {
              // 척추: Y축 회전 (회전), X축 회전 (앞뒤), Z축 회전 (좌우)
              finalRx = rx * 1.0;
              finalRy = ry;
              finalRz = rz * 1.0;
            } else if (name === 'head') {
              // 머리: 모든 축 회전 가능
              finalRx = rx * 1.0;
              finalRy = ry;
              finalRz = rz * 1.0;
            }
            
            // 현재 회전과 새 회전을 블렌딩
            const currentRot = target.rotation;
            const newRot = {
              x: lerp(currentRot.x, finalRx, blendFactor),
              y: lerp(currentRot.y, finalRy, blendFactor),
              z: lerp(currentRot.z, finalRz, blendFactor)
            };
            
            // Three.js는 YXZ 오일러 각도 순서를 사용 (기본값)
            target.rotation.set(newRot.x, newRot.y, newRot.z);
          } else {
            // 본을 찾지 못한 경우 기본값 유지
            console.warn(`본을 찾을 수 없음: ${name}`);
          }
        });
        
        // hips 위치가 화면 밖으로 나가지 않도록 확인
        if (hips) {
          const pos = hips.position;
          if (Math.abs(pos.x) > 10 || Math.abs(pos.y) > 10 || Math.abs(pos.z) > 10) {
            console.warn('캐릭터 위치 이상:', pos);
            hips.position.set(0, 1, 0);
          }
        }
        
        // 캐릭터가 보이도록 강제 렌더링
        if (rendererRef.current && sceneRef.current && cameraRef.current) {
          rendererRef.current.render(sceneRef.current, cameraRef.current);
        }
    } catch (error) {
      console.error('모션 프레임 적용 오류:', error, {
        dancerId: dancerId,
        frameDataLength: frameData?.length
      });
    }
    });
  };

  // 애니메이션 루프
  useEffect(() => {
    if (!sceneRef.current || !cameraRef.current || !rendererRef.current) return;

    const animate = () => {
      frameIdRef.current = requestAnimationFrame(animate);

      // 성능 최적화: 변경사항이 있을 때만 렌더링
      let needsRender = false;
      
      // 모션 데이터 확인 (블록 밖에서도 사용 가능하도록)
      const hasMotionData = motionData && motionData.data && Array.isArray(motionData.data) && motionData.data.length > 0;
      
      // 여러 캐릭터에 모션 적용
      const dancerIds = Object.keys(dancerRefs.current);
      
      if (dancerIds.length === 0) {
        // 캐릭터가 없어도 렌더링은 계속
        rendererRef.current.render(sceneRef.current, cameraRef.current);
        return;
      }

      // 각 캐릭터에 모션 적용
      dancerIds.forEach((dancerId) => {
        const dancerRef = dancerRefs.current[dancerId];
        if (!dancerRef || !dancerRef.hips) return;

        const hips = dancerRef.hips;
        
        // 캐릭터가 항상 보이도록 visibility 확인
        if (dancerRef.group && dancerRef.group.visible === false) {
          dancerRef.group.visible = true;
          needsRender = true;
        }
        if (hips.visible === false) {
          hips.visible = true;
          needsRender = true;
        }
        
        // 각 캐릭터의 모션 데이터 또는 전역 모션 데이터 사용
        const dancerMotionData = dancerRef.motionData || motionData;
        const hasDancerMotion = dancerMotionData && dancerMotionData.data && Array.isArray(dancerMotionData.data) && dancerMotionData.data.length > 0;
        
        if (hasDancerMotion) {
          // 모션 데이터가 있을 때
          const frameIndex = Math.floor(currentTime * (dancerMotionData.fps || fps));
          const frameTime = (currentTime * (dancerMotionData.fps || fps)) % 1;
          
          if (frameIndex >= 0 && frameIndex < dancerMotionData.data.length) {
            const frameData = dancerMotionData.data[frameIndex];
            const nextFrameData = frameIndex + 1 < dancerMotionData.data.length 
              ? dancerMotionData.data[frameIndex + 1] 
              : frameData;
            
            // 프레임 데이터는 최소 66개 값(22개 관절 * 3)이어야 함
            if (frameData && Array.isArray(frameData) && frameData.length >= 66) {
              const interpolated = frameData.map((val, i) => {
                const t = frameTime;
                const nextVal = nextFrameData && Array.isArray(nextFrameData) && nextFrameData[i] !== undefined 
                  ? nextFrameData[i] 
                  : val;
                return val + (nextVal - val) * t;
              });
              
              // 모션 데이터 적용 (특정 캐릭터에)
              applyMotionFrame(interpolated, frameTime, dancerId);
              needsRender = true;
            }
          }
        } else {
          // 기본 애니메이션 (모션 데이터가 없을 때만)
          const t = currentTime;
          if (!locks.spine) {
            hips.rotation.set(0, Math.sin(t * 0.5) * 0.2, 0);
          }
          const spine = hips.children[0];
          if (spine && !locks.spine) {
            spine.rotation.set(Math.sin(t * 0.7) * 0.1, 0, 0);
          }
        }
      });

      // 비트 기반 조명 효과 및 모션 강조 (정확한 동기화)
      if (beats && beats.length > 0) {
        // 현재 시간과 가장 가까운 비트 찾기
        const beatTimes = beats.map(b => typeof b === 'number' ? b : b.time);
        const closestBeat = beatTimes.reduce((prev, curr) => {
          return Math.abs(curr - currentTime) < Math.abs(prev - currentTime) ? curr : prev;
        });
        
        const beatDistance = Math.abs(closestBeat - currentTime);
        
        // 비트에 가까울수록 강한 효과 (0.05초 이내)
        if (beatDistance < 0.05) {
          const intensity = 1.0 - (beatDistance / 0.05);
          const spotLight = sceneRef.current.children.find(c => c.type === 'SpotLight');
          if (spotLight) {
            spotLight.intensity = 20 + intensity * 15;
          }
          
          // 비트에 맞춰 모션 강조 (모든 캐릭터가 비트에 반응)
          Object.values(dancerRefs.current).forEach(dancerRef => {
            if (dancerRef && dancerRef.hips) {
              const bounceAmount = intensity * 0.05;
              dancerRef.hips.position.y = 1.0 + bounceAmount;
            }
          });
        } else {
          const spotLight = sceneRef.current.children.find(c => c.type === 'SpotLight');
          if (spotLight) {
            spotLight.intensity = 20;
          }
        }
      }

      // 카메라 애니메이션 (성능 최적화: 느리게 업데이트)
      const cameraT = currentTime * 0.1;
      const newCamX = Math.sin(cameraT) * 5;
      const newCamZ = Math.cos(cameraT) * 5;
      
      // 카메라 위치가 변경되었는지 확인
      if (Math.abs(cameraRef.current.position.x - newCamX) > 0.01 ||
          Math.abs(cameraRef.current.position.z - newCamZ) > 0.01) {
        cameraRef.current.position.x = newCamX;
        cameraRef.current.position.z = newCamZ;
        cameraRef.current.lookAt(0, 1, 0);
        needsRender = true;
      }

      // 변경사항이 있거나 재생 중일 때만 렌더링
      if (needsRender || isPlaying || hasMotionData) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    
    // 즉시 한 번 렌더링하여 캐릭터가 보이도록
    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
    
    animate();
    return () => {
      if (frameIdRef.current) {
        cancelAnimationFrame(frameIdRef.current);
      }
    };
  }, [isPlaying, params, locks, currentTime, motionData, fps, beats]);

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

// --- 2. 타임라인 트랙 컴포넌트 ---
const TimelineTrack = ({ label, color, segments, active, onSelect, onUpdate, beats = null, totalDuration = 120 }) => {
  const [dragging, setDragging] = useState(null);
  const [resizing, setResizing] = useState(null);

  const handleMouseDown = (e, seg, type) => {
    e.stopPropagation();
    if (type === 'drag') {
      setDragging({ seg, startX: e.clientX, startLeft: seg.start });
    } else if (type === 'resize') {
      setResizing({ seg, startX: e.clientX, startWidth: seg.duration });
    }
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (dragging) {
        const deltaX = e.clientX - dragging.startX;
        const containerWidth = e.currentTarget?.clientWidth || window.innerWidth;
        const deltaPercent = (deltaX / containerWidth) * 100;
        const newStart = Math.max(0, Math.min(100 - dragging.seg.duration, dragging.startLeft + deltaPercent));
        if (onUpdate) {
          onUpdate(dragging.seg.id, { start: newStart });
        }
      } else if (resizing) {
        const deltaX = e.clientX - resizing.startX;
        const containerWidth = e.currentTarget?.clientWidth || window.innerWidth;
        const deltaPercent = (deltaX / containerWidth) * 100;
        const newDuration = Math.max(5, Math.min(100 - resizing.seg.start, resizing.startWidth + deltaPercent));
        if (onUpdate) {
          onUpdate(resizing.seg.id, { duration: newDuration });
        }
      }
    };

    const handleMouseUp = () => {
      setDragging(null);
      setResizing(null);
    };

    if (dragging || resizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragging, resizing, onUpdate]);

  return (
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
        
        {beats && Array.isArray(beats) && beats.length > 0 && (
          <div className="absolute inset-0 pointer-events-none z-20">
            {beats.map((beat, idx) => {
              const beatTime = typeof beat === 'number' ? beat : (beat.time || beat);
              const beatPercent = totalDuration > 0 ? (beatTime / totalDuration) * 100 : 0;
              if (beatPercent < 0 || beatPercent > 100) return null;
              
              const nextBeat = idx < beats.length - 1 ? (typeof beats[idx + 1] === 'number' ? beats[idx + 1] : (beats[idx + 1].time || beats[idx + 1])) : totalDuration;
              const prevBeat = idx > 0 ? (typeof beats[idx - 1] === 'number' ? beats[idx - 1] : (beats[idx - 1].time || beats[idx - 1])) : 0;
              const interval = Math.min(nextBeat - beatTime, beatTime - prevBeat);
              const intensity = Math.min(1.0, interval / 0.5);
              
              return (
                <div
                  key={idx}
                  className="absolute top-0 bottom-0 transition-all cursor-pointer pointer-events-auto group"
                  style={{ 
                    left: `${beatPercent}%`,
                    width: `${1 + intensity * 1}px`
                  }}
                  title={`Beat at ${beatTime.toFixed(2)}s`}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (onSelect && typeof onSelect === 'function') {
                      onSelect(beatTime);
                    }
                  }}
                >
                  <div 
                    className="absolute top-0 bottom-0 bg-yellow-400/60 group-hover:bg-yellow-400 transition-all"
                    style={{ 
                      width: '100%',
                      opacity: 0.4 + intensity * 0.4
                    }}
                  />
                </div>
              );
            })}
          </div>
        )}

        {segments.map((seg) => (
          <div 
            key={seg.id}
            className={`absolute top-1 bottom-1 rounded cursor-pointer transition-all border
              ${seg.active ? 'ring-2 ring-white z-20' : 'opacity-80 hover:opacity-100'}
            `}
            style={{ 
              left: `${seg.start}%`, 
              width: `${seg.duration}%`,
              backgroundColor: color,
              borderColor: 'rgba(255,255,255,0.1)'
            }}
            onClick={(e) => { 
              e.stopPropagation(); 
              if (onSelect) {
                onSelect(seg.id);
              }
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              if (onSelect) {
                const copy = { ...seg, id: `${seg.id}_copy_${Date.now()}`, active: false };
                if (onUpdate) {
                  onUpdate(copy.id, copy);
                }
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              // 우클릭 메뉴는 상위 컴포넌트에서 처리
            }}
          >
            <div className="px-2 py-1 text-[10px] font-bold text-white/90 truncate flex items-center gap-1">
              {seg.icon} {seg.name}
            </div>
            <div 
              className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-white/50"
              onMouseDown={(e) => handleMouseDown(e, seg, 'resize')}
            />
            <div 
              className="absolute right-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-white/50"
              onMouseDown={(e) => handleMouseDown(e, seg, 'resize')}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

// --- 3. 메인 애플리케이션 ---
export default function SotaDanceStudio() {
  // 상태 관리
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState('generation');
  const [viewMode, setViewMode] = useState('render');
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(120);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [prompt, setPrompt] = useState("Powerful hip-hop routine with popping elements.");
  const [selectedStyle, setSelectedStyle] = useState("hiphop");
  const [audioFile, setAudioFile] = useState(null);
  const [audioAnalysis, setAudioAnalysis] = useState(null);
  const [isAnalyzingAudio, setIsAnalyzingAudio] = useState(false);
  const [playheadPosition, setPlayheadPosition] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [locks, setLocks] = useState({ head: false, spine: false, arms: false, legs: false });
  const [params, setParams] = useState({
    energy: 0.75,
    smoothness: 0.5,
    bounce: 0.6,
    creativity: 0.4,
  });
  const [tracks, setTracks] = useState({
    music: [],
    motion: [],
    formation: []
  });
  const [formationPoints, setFormationPoints] = useState([]);
  const [isDraggingFormation, setIsDraggingFormation] = useState(null);
  const [copiedSegment, setCopiedSegment] = useState(null);
  const [pastePosition, setPastePosition] = useState(null);
  const [isRenderingVideo, setIsRenderingVideo] = useState(false);
  const [videoRenderProgress, setVideoRenderProgress] = useState(0);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [videoSettings, setVideoSettings] = useState({
    resolution: '1080p',
    fps: 30,
    format: 'webm'
  });
  
  // 모션 라이브러리 상태
  const [motionLibrary, setMotionLibrary] = useState(() => {
    // localStorage에서 로드
    try {
      const saved = localStorage.getItem('motionLibrary');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [librarySearch, setLibrarySearch] = useState('');
  const [libraryFilter, setLibraryFilter] = useState('all');
  const [showLibrary, setShowLibrary] = useState(false);
  
  // 다중 캐릭터 상태
  const [dancers, setDancers] = useState([{ id: 'dancer1', position: { x: 0, y: 0, z: 0 }, motionData: null }]);
  const [selectedDancer, setSelectedDancer] = useState('dancer1');
  
  // 실시간 모션 편집 상태
  const [isEditingMotion, setIsEditingMotion] = useState(false);
  const [editingKeyframes, setEditingKeyframes] = useState([]);
  const [selectedJoint, setSelectedJoint] = useState(null);
  const [localStartTime, setLocalStartTime] = useState('');
  const [localDuration, setLocalDuration] = useState('');

  const audioRef = useRef(null);
  const startTimeRef = useRef(0);

  // 유틸리티 함수
  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds) || seconds < 0) return '00:00';
    const totalSeconds = Math.floor(seconds);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const calculatePlayheadPosition = (time) => {
    if (totalDuration <= 0) return 0;
    const position = Math.max(0, Math.min(100, (time / totalDuration) * 100));
    return position;
  };

  const seekToTime = (time, maintainPlayback = true) => {
    if (audioRef.current) {
      const wasPlaying = maintainPlayback && !audioRef.current.paused;
      audioRef.current.currentTime = time;
      setCurrentTime(time);
      setPlayheadPosition(calculatePlayheadPosition(time));
      
      if (wasPlaying) {
        setTimeout(() => {
          if (audioRef.current && !audioRef.current.paused) {
            audioRef.current.play().catch(() => {});
          }
        }, 10);
      }
    } else {
      setCurrentTime(time);
      setPlayheadPosition(calculatePlayheadPosition(time));
    }
  };

  // 메모이제이션
  const selectedMotion = useMemo(() => {
    return tracks.motion.find(m => m.active);
  }, [tracks.motion.map(m => `${m.id}-${m.active}`).join(',')]);

  const startTimePercent = useMemo(() => selectedMotion?.start || 0, [selectedMotion?.id, selectedMotion?.start]);
  const durationPercent = useMemo(() => selectedMotion?.duration || 0, [selectedMotion?.id, selectedMotion?.duration]);
  const startTimeSeconds = useMemo(() => (startTimePercent / 100) * totalDuration, [startTimePercent, totalDuration]);
  const durationSeconds = useMemo(() => (durationPercent / 100) * totalDuration, [durationPercent, totalDuration]);

  useEffect(() => {
    if (selectedMotion && activeTab === 'editing') {
      setLocalStartTime(startTimeSeconds.toFixed(1));
      setLocalDuration(durationSeconds.toFixed(1));
    } else if (!selectedMotion && activeTab === 'editing') {
      setLocalStartTime('');
      setLocalDuration('');
    }
  }, [selectedMotion?.id, startTimeSeconds, durationSeconds, activeTab]);

  // 재생 버튼 핸들러
  const handlePlayPause = () => {
    // 오디오가 없어도 모션만 재생할 수 있도록 허용
    setIsPlaying(!isPlaying);
    
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause().catch(() => {
          // 오디오 재생 실패해도 모션은 계속 재생
        });
      } else {
        audioRef.current.play().catch((error) => {
          console.error('오디오 재생 오류:', error);
          // 오디오 재생 실패해도 모션은 계속 재생
        });
      }
    }
  };

  // 오디오 재생 제어
  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch((error) => {
          console.error('재생 오류:', error);
          setIsPlaying(false);
        });
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying]);

  // 오디오 시간 동기화
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    let rafId = null;
    let lastTime = 0;

    const updateTime = () => {
      if (audio && !isNaN(audio.currentTime)) {
        const currentAudioTime = audio.currentTime;
        // 재생 헤드가 부드럽게 움직이도록 매 프레임 업데이트
        setCurrentTime(currentAudioTime);
        if (totalDuration > 0) {
          const newPosition = calculatePlayheadPosition(currentAudioTime);
          setPlayheadPosition(newPosition);
          // 디버깅: 재생 헤드 위치 확인
          if (Math.floor(currentAudioTime) % 5 === 0 && Math.abs(currentAudioTime - Math.floor(currentAudioTime)) < 0.1) {
            console.log('재생 헤드 위치:', { currentTime: currentAudioTime, position: newPosition, totalDuration });
          }
        }
        lastTime = currentAudioTime;
      }
    };

    const handleTimeUpdate = () => updateTime();
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      setPlayheadPosition(0);
      if (rafId) cancelAnimationFrame(rafId);
    };
    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setTotalDuration(audio.duration);
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    
    // 초기 시간 업데이트
    updateTime();
    
    const smoothUpdate = () => {
      if (isPlaying && audio && !audio.paused) {
        updateTime();
        rafId = requestAnimationFrame(smoothUpdate);
      } else if (!isPlaying && rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };

    if (isPlaying) {
      rafId = requestAnimationFrame(smoothUpdate);
    }

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [totalDuration, isPlaying]);

  // 오디오가 없을 때도 시간 업데이트 (모션만 재생)
  useEffect(() => {
    if (!audioRef.current && isPlaying && totalDuration > 0) {
      let rafId = null;
      
      // 재생 시작 시 시작 시간 업데이트
      startTimeRef.current = Date.now() - (currentTime * 1000);
      
      const updateTime = () => {
        if (!isPlaying) {
          if (rafId) cancelAnimationFrame(rafId);
          return;
        }
        
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        if (elapsed >= totalDuration) {
          setIsPlaying(false);
          setCurrentTime(0);
          setPlayheadPosition(0);
          if (rafId) cancelAnimationFrame(rafId);
          return;
        }
        
        setCurrentTime(elapsed);
        const newPosition = calculatePlayheadPosition(elapsed);
        setPlayheadPosition(newPosition);
        rafId = requestAnimationFrame(updateTime);
      };
      
      rafId = requestAnimationFrame(updateTime);
      
      return () => {
        if (rafId) cancelAnimationFrame(rafId);
      };
    }
  }, [isPlaying, totalDuration]);

  // 포메이션 포인트 드래그 처리
  useEffect(() => {
    if (!isDraggingFormation) return;

    const handleMouseMove = (e) => {
      const formationView = document.querySelector('.aspect-square');
      if (!formationView) return;

      const rect = formationView.getBoundingClientRect();
      const x = Math.max(5, Math.min(95, ((e.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(5, Math.min(95, ((e.clientY - rect.top) / rect.height) * 100));

      setFormationPoints(prev =>
        prev.map(p => p.id === isDraggingFormation ? { ...p, x, y } : p)
      );
    };

    const handleMouseUp = () => {
      setIsDraggingFormation(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingFormation]);

  // 타임라인 편집 기능: 복사/붙여넣기
  const handleCopySegment = (segmentId) => {
    const segment = tracks.motion.find(m => m.id === segmentId);
    if (segment) {
      setCopiedSegment({ ...segment });
      setSuccessMessage('모션 세그먼트가 복사되었습니다.');
      setTimeout(() => setSuccessMessage(null), 2000);
    }
  };

  const handlePasteSegment = (positionPercent) => {
    if (!copiedSegment) {
      setErrorMessage('복사된 세그먼트가 없습니다.');
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    const newSegment = {
      ...copiedSegment,
      id: `motion_${Date.now()}`,
      start: positionPercent,
      active: false
    };

    // 다른 세그먼트와 겹치지 않도록 조정
    const overlapping = tracks.motion.find(m => {
      const segEnd = newSegment.start + newSegment.duration;
      const mEnd = m.start + m.duration;
      return (newSegment.start >= m.start && newSegment.start < mEnd) ||
             (segEnd > m.start && segEnd <= mEnd) ||
             (newSegment.start <= m.start && segEnd >= mEnd);
    });

    if (overlapping) {
      // 겹치면 오른쪽으로 이동
      newSegment.start = overlapping.start + overlapping.duration;
    }

    setTracks(prev => ({
      ...prev,
      motion: [...prev.motion, newSegment]
    }));
    setSuccessMessage('모션 세그먼트가 붙여넣어졌습니다.');
    setTimeout(() => setSuccessMessage(null), 2000);
  };

  const handleDeleteSegment = (segmentId) => {
    setTracks(prev => ({
      ...prev,
      motion: prev.motion.filter(m => m.id !== segmentId)
    }));
    setSuccessMessage('모션 세그먼트가 삭제되었습니다.');
    setTimeout(() => setSuccessMessage(null), 2000);
  };

  // 여러 모션 세그먼트 조합 및 전환 효과
  const handleCombineSegments = () => {
    const activeSegments = tracks.motion.filter(m => m.active);
    if (activeSegments.length < 2) {
      setErrorMessage('2개 이상의 세그먼트를 선택해주세요.');
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    // 세그먼트들을 시간순으로 정렬
    const sorted = [...activeSegments].sort((a, b) => a.start - b.start);
    const firstStart = sorted[0].start;
    const lastEnd = sorted[sorted.length - 1].start + sorted[sorted.length - 1].duration;

    // 전환 효과를 위한 블렌딩 구간 생성
    const combinedData = [];
    sorted.forEach((seg, idx) => {
      if (seg.motionData && seg.motionData.data) {
        const segData = seg.motionData.data;
        
        // 이전 세그먼트와의 전환 구간 (마지막 10프레임)
        if (idx > 0 && sorted[idx - 1].motionData && sorted[idx - 1].motionData.data) {
          const prevData = sorted[idx - 1].motionData.data;
          const transitionFrames = Math.min(10, Math.floor(prevData.length * 0.1));
          
          // 전환 구간 블렌딩
          for (let i = 0; i < transitionFrames; i++) {
            const t = i / transitionFrames;
            const prevFrame = prevData[prevData.length - transitionFrames + i];
            const currFrame = segData[i];
            
            if (prevFrame && currFrame && Array.isArray(prevFrame) && Array.isArray(currFrame)) {
              const blended = prevFrame.map((val, j) => {
                return val * (1 - t) + (currFrame[j] || 0) * t;
              });
              combinedData.push(blended);
            }
          }
        }
        
        // 나머지 프레임 추가
        const startFrame = idx > 0 ? Math.min(10, Math.floor(segData.length * 0.1)) : 0;
        for (let i = startFrame; i < segData.length; i++) {
          combinedData.push(segData[i]);
        }
      }
    });

    // 결합된 세그먼트 생성
    const combinedSegment = {
      id: `motion_combined_${Date.now()}`,
      start: firstStart,
      duration: lastEnd - firstStart,
      name: `Combined (${sorted.length} segments)`,
      active: true,
      icon: <Sparkles size={10}/>,
      style: sorted[0].style || selectedStyle,
      prompt: sorted.map(s => s.prompt).join(' + '),
      motionData: {
        frames: combinedData.length,
        joints: sorted[0].motionData?.joints || 22,
        data: combinedData,
        fps: sorted[0].motionData?.fps || 30,
        duration: (lastEnd - firstStart) / 100 * totalDuration,
        style: sorted[0].style || selectedStyle
      }
    };

    // 기존 세그먼트 제거하고 결합된 세그먼트 추가
    setTracks(prev => ({
      ...prev,
      motion: prev.motion.filter(m => !m.active).concat([combinedSegment])
    }));

    setSuccessMessage(`${sorted.length}개의 세그먼트가 결합되었습니다.`);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // 키보드 단축키 지원
  useEffect(() => {
    const handleKeyDown = (e) => {
      // 입력 필드에 포커스가 있으면 단축키 무시
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }
      
      // 스페이스바: 재생/일시정지
      if (e.code === 'Space') {
        e.preventDefault();
        handlePlayPause();
      }
      // 왼쪽 화살표: 5초 뒤로
      else if (e.code === 'ArrowLeft' && !e.shiftKey) {
        e.preventDefault();
        handleSkip('back');
      }
      // 오른쪽 화살표: 5초 앞으로
      else if (e.code === 'ArrowRight' && !e.shiftKey) {
        e.preventDefault();
        handleSkip('forward');
      }
      // Shift + 왼쪽: 1초 뒤로
      else if (e.code === 'ArrowLeft' && e.shiftKey) {
        e.preventDefault();
        seekToTime(Math.max(0, currentTime - 1), true);
      }
      // Shift + 오른쪽: 1초 앞으로
      else if (e.code === 'ArrowRight' && e.shiftKey) {
        e.preventDefault();
        seekToTime(Math.min(totalDuration, currentTime + 1), true);
      }
      // Home: 처음으로
      else if (e.code === 'Home') {
        e.preventDefault();
        seekToTime(0, false);
      }
      // End: 끝으로
      else if (e.code === 'End') {
        e.preventDefault();
        seekToTime(totalDuration, false);
      }
      // Ctrl+C: 복사 (선택된 세그먼트)
      else if (e.ctrlKey && e.code === 'KeyC') {
        e.preventDefault();
        const selected = tracks.motion.find(m => m.active);
        if (selected) {
          handleCopySegment(selected.id);
        }
      }
      // Ctrl+V: 붙여넣기
      else if (e.ctrlKey && e.code === 'KeyV') {
        e.preventDefault();
        const positionPercent = (currentTime / totalDuration) * 100;
        handlePasteSegment(positionPercent);
      }
      // Delete: 삭제 (선택된 세그먼트)
      else if (e.code === 'Delete' || e.code === 'Backspace') {
        e.preventDefault();
        const selected = tracks.motion.find(m => m.active);
        if (selected) {
          handleDeleteSegment(selected.id);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPlaying, currentTime, totalDuration, tracks.motion, copiedSegment]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio && !isNaN(currentTime) && currentTime >= 0) {
      const timeDiff = Math.abs(audio.currentTime - currentTime);
      if (timeDiff > 0.1) {
        const wasPlaying = !audio.paused;
        audio.currentTime = currentTime;
        if (wasPlaying) {
          setTimeout(() => {
            if (audioRef.current && !audioRef.current.paused) {
              audioRef.current.play().catch(() => {});
            }
          }, 10);
        }
      }
    }
  }, [currentTime]);

  // API 함수
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
        resolve(120);
      });
    });
  };

  const analyzeAudio = async (file) => {
    setIsAnalyzingAudio(true);
    try {
      const { analyzeAudio: analyzeAudioAPI } = await import('./frontend/services/api.js');
      const analysis = await analyzeAudioAPI(file);
      setAudioAnalysis(analysis);
      if (analysis.recommended_style) {
        setSelectedStyle(analysis.recommended_style);
      }
      setTotalDuration(analysis.duration);
      setIsAnalyzingAudio(false);
      return analysis;
    } catch (error) {
      setIsAnalyzingAudio(false);
      const duration = await getAudioDuration(file);
      setTotalDuration(duration);
      setErrorMessage(`오디오 분석에 실패했습니다: ${error.message}\n기본 길이를 사용합니다.`);
      setTimeout(() => setErrorMessage(null), 5000);
      throw error;
    }
  };

  const handleGenerateMotion = async () => {
    if (!prompt.trim()) {
      setErrorMessage('텍스트 프롬프트를 입력해주세요.');
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }
    if (!audioFile) {
      setErrorMessage('음악 파일을 먼저 업로드해주세요.');
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }
    if (!audioAnalysis) {
      setErrorMessage('음악 분석이 완료되지 않았습니다. 잠시만 기다려주세요.');
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }
    
    setIsGenerating(true);
    setGenerationProgress(0);
    
    try {
      const { generateMotion: generateMotionAPI, pollGenerationStatus } = await import('./frontend/services/api.js');
      const result = await generateMotionAPI({
        prompt,
        audioFile,
        style: selectedStyle,
        energy: params.energy,
        smoothness: params.smoothness,
        bounce: params.bounce,
        creativity: params.creativity
      });
      
      const finalStatus = await pollGenerationStatus(
        result.job_id,
        (progress) => setGenerationProgress(progress),
        1000
      );
      
      if (finalStatus.status === 'completed' && finalStatus.motion_data) {
        // 모션 데이터 구조 확인 및 정규화
        const motionData = finalStatus.motion_data;
        
        // 백엔드에서 반환하는 데이터 형식 변환
        // 백엔드는 (frames, joints, 3) 형태로 반환하지만
        // 프론트엔드는 각 프레임이 1D 배열(66개 값)이어야 함
        let convertedData = [];
        if (Array.isArray(motionData.data) && motionData.data.length > 0) {
          // 첫 번째 프레임의 구조 확인
          const firstFrame = motionData.data[0];
          
          if (Array.isArray(firstFrame) && Array.isArray(firstFrame[0])) {
            // 3D 배열 형태: [[[x,y,z], [x,y,z], ...], [[x,y,z], ...], ...]
            // 각 프레임을 1D 배열로 변환: [x0,y0,z0, x1,y1,z1, ...]
            convertedData = motionData.data.map(frame => {
              if (!Array.isArray(frame)) return [];
              const flatFrame = [];
              for (let joint of frame) {
                if (Array.isArray(joint) && joint.length >= 3) {
                  flatFrame.push(joint[0] || 0, joint[1] || 0, joint[2] || 0);
                } else {
                  flatFrame.push(0, 0, 0);
                }
              }
              return flatFrame;
            });
          } else if (Array.isArray(firstFrame) && firstFrame.length >= 66) {
            // 이미 1D 배열 형태: [x0,y0,z0, x1,y1,z1, ...] (22개 관절 * 3 = 66개 값)
            // HumanML3D 22개 관절을 모두 포함
            convertedData = motionData.data;
          } else {
            console.warn('알 수 없는 모션 데이터 형식:', firstFrame);
            convertedData = [];
          }
        }
        
        const normalizedMotionData = {
          frames: convertedData.length || motionData.frames || 0,
          joints: motionData.joints || 22,
          data: convertedData,
          fps: motionData.fps || 30,
          duration: motionData.duration || totalDuration,
          style: motionData.style || selectedStyle,
          prompt: motionData.prompt || prompt
        };
        
        console.log('✅ 모션 데이터 저장:', {
          frames: normalizedMotionData.frames,
          dataLength: normalizedMotionData.data.length,
          hasData: normalizedMotionData.data.length > 0,
          firstFrameLength: normalizedMotionData.data[0]?.length || 0,
          sampleFrame: normalizedMotionData.data[0]?.slice(0, 9) || []
        });
        
        const newMotion = {
          id: `motion_${Date.now()}`,
          start: 0,
          duration: 100,
          name: `${selectedStyle} - ${prompt.substring(0, 15)}...`,
          active: true,
          icon: <Sparkles size={10}/>,
          style: selectedStyle,
          prompt: prompt,
          motionData: normalizedMotionData
        };
        
        setTracks(prev => ({ ...prev, motion: [newMotion] }));
        setCurrentTime(0);
        setPlayheadPosition(0);
        setSuccessMessage('안무 생성이 완료되었습니다!');
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        throw new Error(finalStatus.message || '모션 생성 실패');
      }
    } catch (error) {
      setErrorMessage(`안무 생성에 실패했습니다: ${error.message}`);
      setTimeout(() => setErrorMessage(null), 5000);
    } finally {
      setIsGenerating(false);
      setGenerationProgress(0);
    }
  };

  const handleBeatClick = (beatTime) => {
    seekToTime(beatTime, true);
  };

  const handleTimelineClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const labelWidth = 128;
    const timelineWidth = rect.width - labelWidth;
    const clickX = x - labelWidth;
    
    if (clickX >= 0 && timelineWidth > 0 && totalDuration > 0) {
      const percent = Math.max(0, Math.min(100, (clickX / timelineWidth) * 100));
      const newTime = (percent / 100) * totalDuration;
      seekToTime(newTime, true);
    }
  };

  // 모션 라이브러리 함수들
  const saveToLibrary = (motion) => {
    if (!motion || !motion.motionData) {
      setErrorMessage('저장할 모션이 없습니다.');
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    const libraryItem = {
      id: `lib_${Date.now()}`,
      name: motion.name || `Motion ${new Date().toLocaleDateString()}`,
      category: motion.style || selectedStyle,
      tags: motion.prompt ? motion.prompt.split(' ').filter(w => w.length > 3) : [],
      motionData: motion.motionData,
      prompt: motion.prompt || prompt,
      style: motion.style || selectedStyle,
      params: params,
      createdAt: new Date().toISOString(),
      favorite: false
    };

    const updated = [...motionLibrary, libraryItem];
    setMotionLibrary(updated);
    localStorage.setItem('motionLibrary', JSON.stringify(updated));
    setSuccessMessage('모션이 라이브러리에 저장되었습니다.');
    setTimeout(() => setSuccessMessage(null), 2000);
  };

  const loadFromLibrary = (libraryItem) => {
    const newMotion = {
      id: `motion_${Date.now()}`,
      start: 0,
      duration: 100,
      name: libraryItem.name,
      active: true,
      icon: <Sparkles size={10}/>,
      style: libraryItem.style,
      prompt: libraryItem.prompt,
      motionData: libraryItem.motionData
    };

    setTracks(prev => ({
      ...prev,
      motion: [...prev.motion, newMotion]
    }));

    setSuccessMessage('모션이 라이브러리에서 불러와졌습니다.');
    setTimeout(() => setSuccessMessage(null), 2000);
    setShowLibrary(false);
  };

  const deleteFromLibrary = (id) => {
    const updated = motionLibrary.filter(item => item.id !== id);
    setMotionLibrary(updated);
    localStorage.setItem('motionLibrary', JSON.stringify(updated));
    setSuccessMessage('모션이 라이브러리에서 삭제되었습니다.');
    setTimeout(() => setSuccessMessage(null), 2000);
  };

  const toggleFavorite = (id) => {
    const updated = motionLibrary.map(item =>
      item.id === id ? { ...item, favorite: !item.favorite } : item
    );
    setMotionLibrary(updated);
    localStorage.setItem('motionLibrary', JSON.stringify(updated));
  };

  // 필터링된 라이브러리
  const filteredLibrary = useMemo(() => {
    let filtered = motionLibrary;

    // 검색 필터
    if (librarySearch) {
      const searchLower = librarySearch.toLowerCase();
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchLower) ||
        item.prompt?.toLowerCase().includes(searchLower) ||
        item.tags.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }

    // 카테고리 필터
    if (libraryFilter !== 'all') {
      if (libraryFilter === 'favorites') {
        filtered = filtered.filter(item => item.favorite);
      } else {
        filtered = filtered.filter(item => item.category === libraryFilter);
      }
    }

    // 즐겨찾기 우선 정렬
    return filtered.sort((a, b) => {
      if (a.favorite && !b.favorite) return -1;
      if (!a.favorite && b.favorite) return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }, [motionLibrary, librarySearch, libraryFilter]);

  // 카테고리 목록
  const categories = useMemo(() => {
    const cats = new Set(motionLibrary.map(item => item.category));
    return Array.from(cats).sort();
  }, [motionLibrary]);

  // 모션 프리뷰 이미지 생성
  const handleGeneratePreview = async () => {
    const selectedMotion = tracks.motion.find(m => m.active);
    if (!selectedMotion || !selectedMotion.motionData) {
      setErrorMessage('프리뷰할 모션이 없습니다.');
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(0);

    try {
      // Three.js canvas를 DOM에서 찾기
      const threeCanvas = document.querySelector('canvas');
      if (!threeCanvas) {
        throw new Error('3D 뷰어를 찾을 수 없습니다.');
      }

      // 원래 시간 저장
      const originalTime = currentTime;
      const motionData = selectedMotion.motionData;
      
      // 현재 프레임의 스크린샷 캡처
      const frameIndex = Math.floor(currentTime * (motionData.fps || 30));
      const frameTime = frameIndex / (motionData.fps || 30);
      
      // 모션 적용을 위해 잠시 시간 설정
      setCurrentTime(frameTime);
      
      // 렌더링이 완료될 때까지 대기
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Canvas를 이미지로 변환
      const dataURL = threeCanvas.toDataURL('image/png');
      
      // 이미지 다운로드
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `motion-preview-${Date.now()}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            setSuccessMessage('프리뷰 이미지가 생성되었습니다.');
            setTimeout(() => setSuccessMessage(null), 3000);
          }
        }, 'image/png');
      };
      img.src = dataURL;
      
      // 원래 시간으로 복원
      setCurrentTime(originalTime);
      
    } catch (error) {
      console.error('프리뷰 생성 오류:', error);
      setErrorMessage(`프리뷰 생성 실패: ${error.message}`);
      setTimeout(() => setErrorMessage(null), 5000);
    } finally {
      setIsGenerating(false);
      setGenerationProgress(0);
    }
  };

  const handleSkip = (direction) => {
    const skipAmount = 5;
    const newTime = direction === 'back' 
      ? Math.max(0, currentTime - skipAmount)
      : Math.min(totalDuration, currentTime + skipAmount);
    seekToTime(newTime, false);
  };

  // 비디오 렌더링 함수
  const handleRenderVideo = async () => {
    const selectedMotion = tracks.motion.find(m => m.active);
    if (!selectedMotion || !selectedMotion.motionData) {
      setErrorMessage('렌더링할 모션이 없습니다.');
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    setIsRenderingVideo(true);
    setVideoRenderProgress(0);

    try {
      // Three.js canvas 찾기
      const threeCanvas = document.querySelector('canvas');
      if (!threeCanvas) {
        throw new Error('3D 뷰어를 찾을 수 없습니다.');
      }

      const motionData = selectedMotion.motionData;
      const duration = motionData.duration || totalDuration;
      const fps = videoSettings.fps;
      const totalFrames = Math.ceil(duration * fps);
      const originalTime = currentTime;
      const originalIsPlaying = isPlaying;

      // 재생 중지
      setIsPlaying(false);
      if (audioRef.current) {
        audioRef.current.pause();
      }

      // MediaRecorder 지원 확인
      let mediaRecorder;
      let stream;
      
      if (threeCanvas.captureStream) {
        // captureStream 지원
        stream = threeCanvas.captureStream(fps);
        const mimeTypes = [
          'video/webm;codecs=vp9',
          'video/webm;codecs=vp8',
          'video/webm',
          'video/mp4'
        ];
        
        let selectedMimeType = 'video/webm';
        for (const mimeType of mimeTypes) {
          if (MediaRecorder.isTypeSupported(mimeType)) {
            selectedMimeType = mimeType;
            break;
          }
        }

        mediaRecorder = new MediaRecorder(stream, {
          mimeType: selectedMimeType,
          videoBitsPerSecond: 8000000
        });
      } else {
        throw new Error('이 브라우저는 비디오 렌더링을 지원하지 않습니다. Chrome 또는 Edge를 사용해주세요.');
      }

      const chunks = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      // 렌더링 시작
      mediaRecorder.start(100); // 100ms마다 데이터 수집

      // 프레임별 렌더링
      for (let frame = 0; frame < totalFrames; frame++) {
        const frameTime = (frame / fps);
        setCurrentTime(frameTime);

        // 모션 적용을 위한 대기 (렌더링이 완료될 때까지)
        await new Promise(resolve => {
          // 여러 프레임을 기다려서 렌더링이 완료되도록 함
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                resolve();
              });
            });
          });
        });

        setVideoRenderProgress((frame + 1) / totalFrames * 100);
      }

      // 마지막 프레임 렌더링 대기
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 녹화 중지
      if (mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }

      // 스트림 정리
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      // 비디오 생성 대기
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('비디오 생성 시간 초과'));
        }, 30000); // 30초 타임아웃

        mediaRecorder.onstop = () => {
          clearTimeout(timeout);
          
          if (chunks.length === 0) {
            reject(new Error('비디오 데이터가 없습니다.'));
            return;
          }

          const blob = new Blob(chunks, { 
            type: mediaRecorder.mimeType || 'video/webm'
          });
          
          // 다운로드
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          const extension = mediaRecorder.mimeType.includes('mp4') ? 'mp4' : 'webm';
          a.download = `motion-video-${Date.now()}.${extension}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          // 원래 상태 복원
          setCurrentTime(originalTime);
          setIsPlaying(originalIsPlaying);

          setSuccessMessage('비디오 렌더링이 완료되었습니다!');
          setTimeout(() => setSuccessMessage(null), 3000);
          resolve();
        };

        mediaRecorder.onerror = (error) => {
          clearTimeout(timeout);
          reject(error);
        };
      });

    } catch (error) {
      console.error('비디오 렌더링 오류:', error);
      setErrorMessage(`비디오 렌더링 실패: ${error.message}`);
      setTimeout(() => setErrorMessage(null), 5000);
    } finally {
      setIsRenderingVideo(false);
      setVideoRenderProgress(0);
    }
  };

  const handleExportFBX = async (format = 'json') => {
    const selectedMotion = tracks.motion.find(m => m.active);
    if (!selectedMotion || !selectedMotion.motionData) {
      alert('내보낼 모션이 없습니다. 먼저 모션을 생성해주세요.');
      return;
    }
    
    try {
      const { exportMotion } = await import('./frontend/services/api.js');
      const motionData = {
        frames: selectedMotion.motionData.frames || 0,
        joints: selectedMotion.motionData.joints || 22,
        data: selectedMotion.motionData.data || [],
        fps: selectedMotion.motionData.fps || 30,
        duration: selectedMotion.motionData.duration || totalDuration,
        style: selectedMotion.style || selectedStyle,
        prompt: selectedMotion.prompt || prompt,
        params: params,
        locks: locks
      };
      
      const dataSize = JSON.stringify(motionData).length;
      const dataSizeMB = (dataSize / 1024 / 1024).toFixed(2);
      
      if (dataSize > 50 * 1024 * 1024) {
        const confirm = window.confirm(`모션 데이터가 큽니다 (${dataSizeMB}MB). 내보내기를 계속하시겠습니까?`);
        if (!confirm) return;
      }
      
      const blob = await exportMotion(motionData, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const extension = format === 'fbx' ? 'fbx' : format === 'bvh' ? 'bvh' : 'json';
      a.download = `motion_export_${Date.now()}.${extension}`;
      a.click();
      URL.revokeObjectURL(url);
      alert(`${format.toUpperCase()} 형식으로 모션 데이터가 내보내졌습니다!`);
    } catch (error) {
      if (error.message.includes('size') || error.message.includes('maximum')) {
        alert(`파일 크기가 너무 큽니다. 모션 데이터를 줄이거나 다른 형식을 시도해주세요.\n\n오류: ${error.message}`);
      } else {
        alert(`내보내기에 실패했습니다: ${error.message}`);
      }
    }
  };

  const handleAudioUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setAudioFile(file);
      setAudioAnalysis(null);
      setIsPlaying(false);
      setCurrentTime(0);
      setPlayheadPosition(0);
      
      const previousUrl = audioUrl;
      const url = URL.createObjectURL(file);
      setAudioUrl(url);
      
      if (previousUrl) {
        setTimeout(() => {
          try {
            URL.revokeObjectURL(previousUrl);
          } catch (e) {
            // 조용히 처리
          }
        }, 100);
      }
      
      const duration = await getAudioDuration(file);
      setTotalDuration(duration);
      
      setTracks(prev => ({
        ...prev,
        music: [{ id: 'm1', start: 0, duration: 100, name: file.name, active: true }],
        motion: []
      }));
      
      try {
        await analyzeAudio(file);
      } catch (error) {
        // 에러는 이미 analyzeAudio에서 처리됨
      }
    }
  };

  const toggleLock = (part) => setLocks(p => ({ ...p, [part]: !p[part] }));

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  // UI 렌더링
  return (
    <div className="w-full h-screen bg-[#050505] text-slate-200 font-sans flex flex-col overflow-hidden selection:bg-pink-500 selection:text-white">
      {/* 토스트 메시지 */}
      {errorMessage && (
        <div className="fixed top-4 right-4 z-50 bg-red-500/90 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-slide-in">
          <span>❌</span>
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="ml-2 hover:opacity-70">✕</button>
        </div>
      )}
      {successMessage && (
        <div className="fixed top-4 right-4 z-50 bg-green-500/90 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-slide-in">
          <span>✅</span>
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage(null)} className="ml-2 hover:opacity-70">✕</button>
        </div>
      )}
      
      {/* 로딩 오버레이 */}
      {isGenerating && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center">
          <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-pink-500"></div>
              <h3 className="text-lg font-semibold">안무 생성 중...</h3>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2 mb-2">
              <div 
                className="bg-pink-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${generationProgress}%` }}
              ></div>
            </div>
            <p className="text-sm text-slate-400 text-center">{generationProgress}%</p>
          </div>
        </div>
      )}

      {/* 비디오 렌더링 오버레이 */}
      {isRenderingVideo && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center">
          <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-pink-500"></div>
              <h3 className="text-lg font-semibold">비디오 렌더링 중...</h3>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2 mb-2">
              <div 
                className="bg-pink-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${videoRenderProgress}%` }}
              ></div>
            </div>
            <p className="text-sm text-slate-400 text-center">{Math.round(videoRenderProgress)}%</p>
            <p className="text-xs text-slate-500 text-center mt-2">렌더링 중에는 창을 닫지 마세요</p>
          </div>
        </div>
      )}

      {/* 비디오 렌더링 설정 모달 */}
      {showVideoModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowVideoModal(false)}>
          <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full mx-4 border border-slate-700" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">비디오 렌더링 설정</h3>
              <button
                onClick={() => setShowVideoModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-400 block mb-2">해상도</label>
                <select
                  value={videoSettings.resolution}
                  onChange={(e) => setVideoSettings(prev => ({ ...prev, resolution: e.target.value }))}
                  className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-sm focus:outline-none focus:border-pink-500"
                >
                  <option value="720p">720p (1280x720)</option>
                  <option value="1080p">1080p (1920x1080)</option>
                  <option value="4K">4K (3840x2160)</option>
                </select>
              </div>

              <div>
                <label className="text-sm text-slate-400 block mb-2">프레임레이트 (FPS)</label>
                <select
                  value={videoSettings.fps}
                  onChange={(e) => setVideoSettings(prev => ({ ...prev, fps: parseInt(e.target.value) }))}
                  className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-sm focus:outline-none focus:border-pink-500"
                >
                  <option value="24">24 FPS</option>
                  <option value="30">30 FPS</option>
                  <option value="60">60 FPS</option>
                </select>
              </div>

              <div>
                <label className="text-sm text-slate-400 block mb-2">형식</label>
                <select
                  value={videoSettings.format}
                  onChange={(e) => setVideoSettings(prev => ({ ...prev, format: e.target.value }))}
                  className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-sm focus:outline-none focus:border-pink-500"
                >
                  <option value="webm">WebM (권장)</option>
                  <option value="mp4">MP4</option>
                </select>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  onClick={() => setShowVideoModal(false)}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm transition"
                >
                  취소
                </button>
                <button
                  onClick={async () => {
                    setShowVideoModal(false);
                    await handleRenderVideo();
                  }}
                  className="flex-1 px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded text-sm transition"
                >
                  렌더링 시작
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 모션 라이브러리 모달 */}
      {showLibrary && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowLibrary(false)}>
          <div className="bg-slate-800 rounded-lg p-6 max-w-4xl w-full mx-4 border border-slate-700 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <BookOpen size={20} />
                모션 라이브러리
              </h3>
              <button
                onClick={() => setShowLibrary(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            
            {/* 검색 및 필터 */}
            <div className="flex gap-2 mb-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  value={librarySearch}
                  onChange={(e) => setLibrarySearch(e.target.value)}
                  placeholder="모션 검색..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded text-sm focus:outline-none focus:border-pink-500"
                />
              </div>
              <select
                value={libraryFilter}
                onChange={(e) => setLibraryFilter(e.target.value)}
                className="px-4 py-2 bg-slate-900 border border-slate-700 rounded text-sm focus:outline-none focus:border-pink-500"
              >
                <option value="all">모든 카테고리</option>
                <option value="favorites">즐겨찾기</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* 라이브러리 목록 */}
            <div className="flex-1 overflow-y-auto">
              {filteredLibrary.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <BookOpen size={48} className="mx-auto mb-4 opacity-30" />
                  <p>저장된 모션이 없습니다.</p>
                  <p className="text-xs mt-2">모션을 생성한 후 라이브러리에 저장하세요.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {filteredLibrary.map((item) => (
                    <div
                      key={item.id}
                      className="bg-slate-900 rounded-lg p-4 border border-slate-700 hover:border-pink-500 transition cursor-pointer group"
                      onClick={() => loadFromLibrary(item)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h4 className="font-semibold text-sm flex items-center gap-2">
                            {item.favorite && <Star size={14} className="text-yellow-400 fill-yellow-400" />}
                            {item.name}
                          </h4>
                          <p className="text-xs text-slate-400 mt-1 line-clamp-2">{item.prompt}</p>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(item.id);
                            }}
                            className="p-1 hover:bg-slate-800 rounded"
                          >
                            <Star size={14} className={item.favorite ? 'text-yellow-400 fill-yellow-400' : 'text-slate-400'} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteFromLibrary(item.id);
                            }}
                            className="p-1 hover:bg-slate-800 rounded text-red-400"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <Tag size={12} className="text-slate-500" />
                        <span className="text-xs text-slate-500">{item.category}</span>
                        {item.tags.length > 0 && (
                          <span className="text-xs text-slate-500">• {item.tags.slice(0, 2).join(', ')}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="metadata"
          onLoadedMetadata={() => {
            if (audioRef.current && audioRef.current.duration) {
              setTotalDuration(audioRef.current.duration);
              setCurrentTime(0);
              setPlayheadPosition(0);
            }
          }}
          onCanPlay={() => {
            // 오디오 로드 완료
          }}
          onError={(e) => {
            if (audioRef.current && audioUrl) {
              const currentSrc = audioRef.current.src;
              audioRef.current.src = '';
              setTimeout(() => {
                if (audioRef.current) {
                  audioRef.current.src = currentSrc;
                }
              }, 100);
            }
            setIsPlaying(false);
          }}
          onEnded={() => {
            setIsPlaying(false);
            setCurrentTime(0);
            setPlayheadPosition(0);
          }}
        />
      )}
      
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
                className={`px-3 py-1 text-xs font-medium rounded transition ${
                  activeTab === tab
                    ? 'bg-pink-500 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {tab === 'generation' ? '생성' : tab === 'editing' ? '편집' : '리깅'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-xs text-slate-400 font-mono">
            MEM: 2.4GB | Latency: 12ms
          </div>
          <div className="flex gap-2">
            <div className="relative group">
              <button className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium rounded transition flex items-center gap-2">
                <Save size={14} />
                저장
              </button>
              <div className="absolute right-0 top-full mt-1 bg-slate-800 border border-slate-700 rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                <button 
                  onClick={() => {
                    const projectData = {
                      version: '1.0',
                      timestamp: new Date().toISOString(),
                      audioFile: audioFile ? { name: audioFile.name, size: audioFile.size } : null,
                      audioAnalysis: audioAnalysis,
                      prompt: prompt,
                      selectedStyle: selectedStyle,
                      params: params,
                      tracks: tracks,
                      totalDuration: totalDuration
                    };
                    const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `sota-project-${Date.now()}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                    setSuccessMessage('프로젝트가 저장되었습니다.');
                    setTimeout(() => setSuccessMessage(null), 2000);
                  }}
                  className="block w-full text-left px-4 py-2 text-sm hover:bg-slate-700"
                >
                  프로젝트 저장
                </button>
              </div>
            </div>
            <button
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'application/json';
                input.onchange = (e) => {
                  const file = e.target.files[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      try {
                        const projectData = JSON.parse(event.target.result);
                        if (projectData.tracks) setTracks(projectData.tracks);
                        if (projectData.prompt) setPrompt(projectData.prompt);
                        if (projectData.selectedStyle) setSelectedStyle(projectData.selectedStyle);
                        if (projectData.params) setParams(projectData.params);
                        if (projectData.totalDuration) setTotalDuration(projectData.totalDuration);
                        if (projectData.audioAnalysis) setAudioAnalysis(projectData.audioAnalysis);
                        setSuccessMessage('프로젝트가 불러와졌습니다.');
                        setTimeout(() => setSuccessMessage(null), 2000);
                      } catch (error) {
                        setErrorMessage('프로젝트 파일을 불러올 수 없습니다.');
                        setTimeout(() => setErrorMessage(null), 3000);
                      }
                    };
                    reader.readAsText(file);
                  }
                };
                input.click();
              }}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium rounded transition flex items-center gap-2"
            >
              <FolderOpen size={14} />
              불러오기
            </button>
            <div className="relative group">
              <button className="px-3 py-1.5 bg-pink-500 hover:bg-pink-600 text-white text-xs font-medium rounded transition flex items-center gap-2">
                <Download size={14} />
                내보내기
              </button>
              <div className="absolute right-0 top-full mt-1 bg-slate-800 border border-slate-700 rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[150px]">
                <button onClick={() => handleExportFBX('json')} className="block w-full text-left px-4 py-2 text-sm hover:bg-slate-700">JSON</button>
                <button onClick={() => handleExportFBX('bvh')} className="block w-full text-left px-4 py-2 text-sm hover:bg-slate-700">BVH</button>
                <button onClick={() => handleExportFBX('fbx')} className="block w-full text-left px-4 py-2 text-sm hover:bg-slate-700">FBX</button>
                <div className="border-t border-slate-700 my-1"></div>
                <button 
                  onClick={() => setShowVideoModal(true)}
                  className="block w-full text-left px-4 py-2 text-sm hover:bg-slate-700 text-pink-400"
                >
                  <Video size={14} className="inline mr-2" />
                  비디오 렌더링
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-80 bg-[#0a0a0a] border-r border-slate-800 flex flex-col overflow-y-auto">
          {activeTab === 'generation' && (
            <div className="p-4 space-y-6">
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase mb-3">STEP 1: 음악 업로드</h3>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleAudioUpload}
                  className="hidden"
                  id="audio-upload"
                />
                <label
                  htmlFor="audio-upload"
                  className="block w-full p-4 border-2 border-dashed border-slate-700 rounded-lg text-center cursor-pointer hover:border-pink-500 transition"
                >
                  <Video size={24} className="mx-auto mb-2 text-slate-400" />
                  <div className="text-sm text-slate-300">음악 파일 선택</div>
                  {audioFile && <div className="text-xs text-slate-500 mt-1">{audioFile.name}</div>}
                </label>
                {isAnalyzingAudio && (
                  <div className="mt-2 text-xs text-pink-400">분석 중...</div>
                )}
                {audioAnalysis && (
                  <div className="mt-4 p-3 bg-slate-900 rounded text-xs space-y-1">
                    <div>템포: <span className="text-pink-400">{Math.round(audioAnalysis.tempo)} BPM</span></div>
                    <div>길이: <span className="text-pink-400">{formatTime(audioAnalysis.duration)}</span></div>
                    <div>에너지: <span className="text-pink-400">{Math.round(audioAnalysis.energy * 100)}%</span></div>
                    <div>키: <span className="text-pink-400">{audioAnalysis.key}</span></div>
                    {audioAnalysis.recommended_style && (
                      <div className="mt-2 pt-2 border-t border-slate-700">
                        추천 스타일: <span className="text-pink-400 font-bold">{audioAnalysis.recommended_style}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase">STEP 2: 안무 프롬프트 입력</h3>
                  <button
                    onClick={() => setShowLibrary(true)}
                    className="text-xs text-pink-400 hover:text-pink-300 flex items-center gap-1"
                    title="모션 라이브러리"
                  >
                    <BookOpen size={12} />
                    라이브러리
                  </button>
                </div>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="예: Powerful hip-hop routine with popping elements."
                  className="w-full p-3 bg-slate-900 border border-slate-700 rounded text-sm resize-none focus:outline-none focus:border-pink-500"
                  rows={3}
                />
              </div>

              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase mb-3">STYLE</h3>
                <select
                  value={selectedStyle}
                  onChange={(e) => setSelectedStyle(e.target.value)}
                  className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-sm focus:outline-none focus:border-pink-500"
                >
                  <option value="hiphop">Hip-Hop</option>
                  <option value="pop">Pop</option>
                  <option value="ballad">Ballad</option>
                  <option value="kpop">K-pop</option>
                  <option value="girlcrush">Girl Crush</option>
                  <option value="conceptual">Conceptual</option>
                  <option value="jazz">Jazz</option>
                </select>
              </div>

              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase mb-3">부분 고정 (IN-PAINTING)</h3>
                <div className="grid grid-cols-2 gap-2">
                  {['head', 'spine', 'arms', 'legs'].map(part => (
                    <button
                      key={part}
                      onClick={() => toggleLock(part)}
                      className={`p-2 rounded border transition flex items-center gap-2 ${
                        locks[part]
                          ? 'bg-red-500/20 border-red-500 text-red-400'
                          : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      {locks[part] ? <Lock size={14} /> : <Unlock size={14} />}
                      <span className="text-xs capitalize">{part}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
                  <Sliders size={12} /> DIFFUSION PARAMETERS
                </h3>
                <div className="space-y-4">
                  {[
                    { key: 'energy', label: 'Energy', value: params.energy },
                    { key: 'smoothness', label: 'Smoothness', value: params.smoothness },
                    { key: 'bounce', label: 'Bounce', value: params.bounce },
                    { key: 'creativity', label: 'Creativity', value: params.creativity }
                  ].map(({ key, label, value }) => (
                    <div key={key}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-400">{label}</span>
                        <span className="text-pink-400">{Math.round(value * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={value}
                        onChange={(e) => setParams(p => ({ ...p, [key]: parseFloat(e.target.value) }))}
                        className="w-full"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={handleGenerateMotion}
                disabled={isGenerating || !audioFile || !audioAnalysis}
                className="w-full p-4 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-bold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <Activity className="animate-spin" size={20} />
                    생성 중... {generationProgress}%
                  </>
                ) : (
                  <>
                    <Wand2 size={20} />
                    음악 + 프롬프트로 안무 생성
                  </>
                )}
              </button>
            </div>
          )}

          {activeTab === 'editing' && (
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase">모션 편집</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const activeSegments = tracks.motion.filter(m => m.active);
                      if (activeSegments.length > 0) {
                        handleCopySegment(activeSegments[0].id);
                      }
                    }}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition"
                    title="복사 (Ctrl+C)"
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    onClick={() => {
                      const positionPercent = (currentTime / totalDuration) * 100;
                      handlePasteSegment(positionPercent);
                    }}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition"
                    title="붙여넣기 (Ctrl+V)"
                    disabled={!copiedSegment}
                  >
                    <Clipboard size={14} />
                  </button>
                  <button
                    onClick={handleCombineSegments}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition"
                    title="선택된 세그먼트 결합"
                  >
                    <Layers size={14} />
                  </button>
                </div>
              </div>
              {selectedMotion ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">시작 시간 (초)</label>
                    <input
                      type="number"
                      value={localStartTime}
                      onChange={(e) => setLocalStartTime(e.target.value)}
                      onBlur={() => {
                        const time = parseFloat(localStartTime);
                        if (!isNaN(time) && time >= 0) {
                          const percent = (time / totalDuration) * 100;
                          setTracks(prev => ({
                            ...prev,
                            motion: prev.motion.map(m => m.id === selectedMotion.id ? { ...m, start: Math.max(0, Math.min(100, percent)) } : m)
                          }));
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.target.blur();
                        }
                      }}
                      className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-sm focus:outline-none focus:border-pink-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">지속 시간 (초)</label>
                    <input
                      type="number"
                      value={localDuration}
                      onChange={(e) => setLocalDuration(e.target.value)}
                      onBlur={() => {
                        const duration = parseFloat(localDuration);
                        if (!isNaN(duration) && duration > 0) {
                          const percent = (duration / totalDuration) * 100;
                          setTracks(prev => ({
                            ...prev,
                            motion: prev.motion.map(m => m.id === selectedMotion.id ? { ...m, duration: Math.max(5, Math.min(100 - selectedMotion.start, percent)) } : m)
                          }));
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.target.blur();
                        }
                      }}
                      className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-sm focus:outline-none focus:border-pink-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleCopySegment(selectedMotion.id)}
                      className="p-2 bg-slate-800 hover:bg-slate-700 rounded text-sm flex items-center justify-center gap-2 transition"
                    >
                      <Copy size={14} /> 복사
                    </button>
                    <button
                      onClick={() => handleDeleteSegment(selectedMotion.id)}
                      className="p-2 bg-red-500/20 border border-red-500 text-red-400 rounded text-sm hover:bg-red-500/30 transition flex items-center justify-center gap-2"
                    >
                      <Trash2 size={14} /> 삭제
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleGeneratePreview}
                      className="p-2 bg-pink-500/20 border border-pink-500 text-pink-400 rounded text-sm hover:bg-pink-500/30 transition flex items-center justify-center gap-2"
                    >
                      <Video size={14} /> 프리뷰
                    </button>
                    <button
                      onClick={() => {
                        const selected = tracks.motion.find(m => m.active);
                        if (selected) {
                          saveToLibrary(selected);
                        }
                      }}
                      className="p-2 bg-blue-500/20 border border-blue-500 text-blue-400 rounded text-sm hover:bg-blue-500/30 transition flex items-center justify-center gap-2"
                    >
                      <Save size={14} /> 라이브러리에 저장
                    </button>
                  </div>

                  {/* 실시간 모션 편집 */}
                  <div className="mt-4 pt-4 border-t border-slate-700">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-bold text-slate-400 uppercase">실시간 편집</h4>
                      <button
                        onClick={() => setIsEditingMotion(!isEditingMotion)}
                        className={`text-xs px-2 py-1 rounded ${
                          isEditingMotion
                            ? 'bg-pink-500 text-white'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                      >
                        {isEditingMotion ? '편집 중' : '편집 시작'}
                      </button>
                    </div>

                    {isEditingMotion && selectedMotion?.motionData && (
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs text-slate-400 block mb-1">관절 선택</label>
                          <select
                            value={selectedJoint || ''}
                            onChange={(e) => setSelectedJoint(e.target.value)}
                            className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-sm"
                          >
                            <option value="">관절 선택...</option>
                            {['hips', 'spine', 'chest', 'head', 'leftUpperArm', 'rightUpperArm', 'leftThigh', 'rightThigh'].map(joint => (
                              <option key={joint} value={joint}>{joint}</option>
                            ))}
                          </select>
                        </div>

                        {selectedJoint && (
                          <div className="space-y-2">
                            <label className="text-xs text-slate-400 block">회전 조정 (라디안)</label>
                            {['x', 'y', 'z'].map(axis => (
                              <div key={axis}>
                                <label className="text-xs text-slate-500">{axis.toUpperCase()}</label>
                                <input
                                  type="range"
                                  min="-3.14"
                                  max="3.14"
                                  step="0.1"
                                  defaultValue="0"
                                  onChange={(e) => {
                                    const value = parseFloat(e.target.value);
                                    setSuccessMessage(`${selectedJoint}의 ${axis}축이 ${value.toFixed(2)}로 조정되었습니다.`);
                                    setTimeout(() => setSuccessMessage(null), 2000);
                                  }}
                                  className="w-full"
                                />
                              </div>
                            ))}
                          </div>
                        )}

                        <div>
                          <label className="text-xs text-slate-400 block mb-1">스무딩 강도</label>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={params.smoothness}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value);
                              setParams(prev => ({ ...prev, smoothness: value }));
                            }}
                            className="w-full"
                          />
                          <div className="text-xs text-slate-500 text-center mt-1">
                            {Math.round(params.smoothness * 100)}%
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-400 text-center py-8">선택된 모션이 없습니다</div>
              )}
            </div>
          )}

          {activeTab === 'rigging' && (
            <div className="p-4 space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase mb-3">다중 캐릭터</h3>
              
              <div className="space-y-2">
                {dancers.map((dancer) => (
                  <div
                    key={dancer.id}
                    className={`p-3 bg-slate-900 rounded border cursor-pointer transition ${
                      selectedDancer === dancer.id ? 'border-pink-500' : 'border-slate-700'
                    }`}
                    onClick={() => setSelectedDancer(dancer.id)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{dancer.id}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDancers(prev => prev.filter(d => d.id !== dancer.id));
                        }}
                        className="text-red-400 hover:text-red-300"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <div className="mt-2 text-xs text-slate-400">
                      위치: ({dancer.position.x.toFixed(1)}, {dancer.position.y.toFixed(1)}, {dancer.position.z.toFixed(1)})
                    </div>
                    {tracks.motion.find(m => m.active) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const activeMotion = tracks.motion.find(m => m.active);
                          setDancers(prev => prev.map(d =>
                            d.id === dancer.id
                              ? { ...d, motionData: activeMotion.motionData }
                              : d
                          ));
                          setSuccessMessage(`${dancer.id}에 모션이 적용되었습니다.`);
                          setTimeout(() => setSuccessMessage(null), 2000);
                        }}
                        className="mt-2 w-full text-xs px-2 py-1 bg-blue-500/20 border border-blue-500 text-blue-400 rounded hover:bg-blue-500/30 transition"
                      >
                        현재 모션 적용
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button
                onClick={() => {
                  const newId = `dancer${dancers.length + 1}`;
                  setDancers(prev => [...prev, {
                    id: newId,
                    position: { x: (prev.length * 2), y: 0, z: 0 },
                    motionData: null
                  }]);
                  setSuccessMessage('새 캐릭터가 추가되었습니다.');
                  setTimeout(() => setSuccessMessage(null), 2000);
                }}
                className="w-full p-2 bg-pink-500/20 border border-pink-500 text-pink-400 rounded text-sm hover:bg-pink-500/30 transition"
              >
                + 캐릭터 추가
              </button>

              {selectedDancer && (
                <div className="mt-4 space-y-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase">위치 조정</h4>
                  {['x', 'y', 'z'].map(axis => (
                    <div key={axis}>
                      <label className="text-xs text-slate-400 block mb-1">{axis.toUpperCase()}</label>
                      <input
                        type="number"
                        value={dancers.find(d => d.id === selectedDancer)?.position[axis] || 0}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value) || 0;
                          setDancers(prev => prev.map(d =>
                            d.id === selectedDancer
                              ? { ...d, position: { ...d.position, [axis]: value } }
                              : d
                          ));
                        }}
                        className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-sm"
                        step="0.1"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </aside>

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
            <NativeThreeViewer
              beats={audioAnalysis?.beats || null} 
              isPlaying={isPlaying} 
              params={params} 
              locks={locks}
              currentTime={currentTime}
              motionData={tracks.motion.find(m => m.active)?.motionData}
              fps={30}
              dancers={dancers.map(d => ({
                ...d,
                motionData: d.motionData || tracks.motion.find(m => m.active)?.motionData
              }))}
            />
          </div>

          <div className="h-64 bg-[#0a0a0a] border-t border-slate-800 flex flex-col">
            <div className="h-10 border-b border-slate-800 flex items-center justify-between px-4 bg-slate-900/80">
              <div className="flex items-center gap-4">
                <button 
                  onClick={handlePlayPause} 
                  className="text-white hover:text-pink-400 transition"
                  title={isPlaying ? '일시정지' : '재생'}
                >
                  {isPlaying ? <Pause size={20} fill="currentColor"/> : <Play size={20} fill="currentColor"/>}
                </button>
                <div className="flex gap-2 text-slate-400">
                  <button onClick={() => handleSkip('back')} className="hover:text-white transition cursor-pointer">
                    <SkipBack size={16}/>
                  </button>
                  <button onClick={() => handleSkip('forward')} className="hover:text-white transition cursor-pointer">
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
              style={{ position: 'relative' }}
            >
              {tracks.music.length > 0 ? (
                <>
                  <TimelineTrack 
                    label="AUDIO" 
                    color="#db2777" 
                    segments={tracks.music} 
                    active={true} 
                    onSelect={handleBeatClick}
                    onUpdate={(id, updates) => {
                      setTracks(prev => ({
                        ...prev,
                        music: prev.music.map(m => m.id === id ? { ...m, ...updates } : m)
                      }));
                    }}
                    beats={audioAnalysis?.beats || null}
                    totalDuration={totalDuration}
                  />
                  <TimelineTrack 
                    label="MOTION" 
                    color="#4f46e5" 
                    segments={tracks.motion} 
                    active={true} 
                    onSelect={(idOrTime) => {
                      if (typeof idOrTime === 'number') {
                        handleBeatClick(idOrTime);
                      } else {
                        setTracks(prev => ({...prev, motion: prev.motion.map(m => ({...m, active: m.id === idOrTime}))}));
                      }
                    }}
                    onUpdate={(id, updates) => {
                      setTracks(prev => ({
                        ...prev,
                        motion: prev.motion.map(m => m.id === id ? { ...m, ...updates } : m)
                      }));
                    }}
                    beats={audioAnalysis?.beats || null}
                    totalDuration={totalDuration}
                  />
                  {/* 비트 마커 시각화 - 타임라인 중앙에 표시 */}
                  {audioAnalysis?.beats && Array.isArray(audioAnalysis.beats) && audioAnalysis.beats.length > 0 && (
                    <div className="absolute inset-0 pointer-events-none z-30" style={{ top: '50%', height: '2px', transform: 'translateY(-50%)' }}>
                      {audioAnalysis.beats.map((beat, idx) => {
                        const beatTime = typeof beat === 'number' ? beat : (beat.time || beat);
                        const beatPercent = totalDuration > 0 ? (beatTime / totalDuration) * 100 : 0;
                        if (beatPercent < 0 || beatPercent > 100) return null;
                        
                        // 현재 재생 위치와의 거리
                        const distance = Math.abs(beatTime - currentTime);
                        const intensity = Math.max(0, 1 - (distance / 0.5)); // 0.5초 이내에서 강조
                        
                        return (
                          <div
                            key={idx}
                            className="absolute top-0 bottom-0 pointer-events-auto cursor-pointer group"
                            style={{ 
                              left: `calc(128px + (100% - 128px) * ${beatPercent} / 100)`,
                              width: '3px',
                              transform: 'translateX(-50%)',
                              transition: 'all 0.1s ease-out'
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              seekToTime(beatTime, true);
                            }}
                            title={`Beat ${idx + 1} at ${beatTime.toFixed(2)}s`}
                          >
                            <div 
                              className="absolute top-0 bottom-0 bg-yellow-400 rounded-full group-hover:bg-yellow-300 transition-all shadow-lg"
                              style={{ 
                                width: '100%',
                                height: intensity > 0.5 ? '8px' : '4px',
                                opacity: 0.6 + intensity * 0.4,
                                boxShadow: intensity > 0.5 ? '0 0 8px rgba(250, 204, 21, 0.8)' : 'none'
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <TimelineTrack 
                    label="FORMATION" 
                    color="#059669" 
                    segments={tracks.formation} 
                    active={false} 
                    onSelect={handleBeatClick}
                    onUpdate={(id, updates) => {
                      setTracks(prev => ({
                        ...prev,
                        formation: prev.formation.map(f => f.id === id ? { ...f, ...updates } : f)
                      }));
                    }}
                    beats={audioAnalysis?.beats || null}
                    totalDuration={totalDuration}
                  />
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500 text-sm">
                  <div className="text-center">
                    <Video size={32} className="mx-auto mb-2 opacity-50" />
                    <div>음악 파일을 업로드하면 타임라인이 표시됩니다</div>
                    <div className="text-xs mt-1">음악과 프롬프트를 함께 사용하여 안무를 생성합니다</div>
                  </div>
                </div>
              )}
              
              {/* 재생 헤드 - 노래 업로드 후에만 표시, 재생 시간에 맞춰 움직임 */}
              {totalDuration > 0 && (audioFile || audioUrl || tracks.music.length > 0) && (
                <div 
                  className="absolute top-0 bottom-0 w-[2px] bg-red-500 z-50 pointer-events-none"
                  style={{ 
                    // currentTime과 totalDuration을 직접 사용하여 위치 계산
                    // 라벨 영역(128px) 이후부터 시작하여 타임라인 영역의 비율만큼 이동
                    left: `calc(128px + (100% - 128px) * ${Math.max(0, Math.min(100, (currentTime / totalDuration) * 100))} / 100)`,
                    width: '2px',
                    transform: 'translateX(-50%)'
                  }}
                >
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-transparent border-t-red-500"></div>
                </div>
              )}
            </div>
          </div>
        </main>

        <aside className="w-64 bg-[#0a0a0a] border-l border-slate-800 hidden xl:flex flex-col">
          <div className="p-4 border-b border-slate-800">
            <h3 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
              <Users size={12} /> FORMATION VIEW
            </h3>
            <div 
              className="aspect-square bg-slate-900 rounded-lg border border-slate-800 relative p-4 overflow-hidden cursor-crosshair"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget || e.target.classList.contains('formation-grid')) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = ((e.clientX - rect.left) / rect.width) * 100;
                  const y = ((e.clientY - rect.top) / rect.height) * 100;
                  const newPoint = {
                    id: `fp_${Date.now()}`,
                    x: Math.max(5, Math.min(95, x)),
                    y: Math.max(5, Math.min(95, y)),
                    label: `Dancer ${formationPoints.length + 1}`
                  };
                  setFormationPoints([...formationPoints, newPoint]);
                }
              }}
            >
              {/* 그리드 배경 */}
              <div className="absolute inset-0 formation-grid" style={{
                backgroundImage: `
                  linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px),
                  linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)
                `,
                backgroundSize: '20px 20px'
              }}></div>
              
              {/* 포메이션 포인트 */}
              {formationPoints.map((point) => (
                <div
                  key={point.id}
                  className="absolute w-3 h-3 bg-pink-500 rounded-full cursor-move transform -translate-x-1/2 -translate-y-1/2 hover:scale-125 transition-transform z-10"
                  style={{
                    left: `${point.x}%`,
                    top: `${point.y}%`
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setIsDraggingFormation(point.id);
                  }}
                  title={point.label}
                />
              ))}
              
              {formationPoints.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-xs text-slate-500 text-center">
                    <Grid3X3 size={24} className="mx-auto mb-2 opacity-30" />
                    <div>포메이션 편집</div>
                    <div className="text-[10px] mt-1">클릭하여 포인트 추가</div>
                  </div>
                </div>
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <button 
                onClick={() => {
                  setFormationPoints([]);
                  setTracks(prev => ({ ...prev, formation: [] }));
                }}
                className="flex-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs rounded transition"
              >
                Reset
              </button>
              <button 
                onClick={() => {
                  if (formationPoints.length > 0) {
                    const newFormation = {
                      id: `formation_${Date.now()}`,
                      start: 0,
                      duration: 100,
                      name: `Formation (${formationPoints.length} dancers)`,
                      active: true,
                      points: formationPoints,
                      icon: <Users size={10}/>
                    };
                    setTracks(prev => ({ ...prev, formation: [newFormation] }));
                    setSuccessMessage('포메이션이 저장되었습니다!');
                    setTimeout(() => setSuccessMessage(null), 2000);
                  }
                }}
                className="flex-1 px-3 py-1.5 bg-pink-500 hover:bg-pink-600 text-white text-xs rounded transition"
              >
                Save
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

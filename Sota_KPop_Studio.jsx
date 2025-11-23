import React, { useState, useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { 
  Play, Pause, SkipBack, SkipForward, Wand2, Layers, 
  Download, Sparkles, Users, Zap, Activity, 
  Lock, Unlock, Sliders, Video, Grid3X3, Bone
} from 'lucide-react';

/**
 * SOTA K-Pop Studio - AI 기반 안무 생성 도구
 * Motion Diffusion Model을 활용한 음악-프롬프트 기반 안무 생성
 */

// --- 1. Native Three.js 3D 엔진 ---
const NativeThreeViewer = ({ isPlaying, params, locks, currentTime, motionData, fps = 30, beats = null }) => {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const dancerRef = useRef(null);
  const frameIdRef = useRef(null);

  // 3D 씬 초기화
  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#050505'); // Deep Black
    scene.fog = new THREE.Fog('#050505', 8, 25);

    const camera = new THREE.PerspectiveCamera(50, containerRef.current.clientWidth / containerRef.current.clientHeight, 0.1, 100);
    camera.position.set(0, 2, 5);
    camera.lookAt(0, 1, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    containerRef.current.appendChild(renderer.domElement);

    // Cold Rim Lights (Studio Lighting Setup)
    const ambientLight = new THREE.AmbientLight(0x404060, 0.15); // Very low ambient
    scene.add(ambientLight);

    // Main Key Light (Cold White)
    const keyLight = new THREE.SpotLight(0xe0f0ff, 35);
    keyLight.position.set(4, 6, 6);
    keyLight.angle = Math.PI / 4;
    keyLight.penumbra = 0.3;
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    scene.add(keyLight);

    // Rim Light 1 (Cold Blue-White from behind)
    const rimLight1 = new THREE.SpotLight(0xb0d0ff, 25);
    rimLight1.position.set(-5, 5, -5);
    rimLight1.angle = Math.PI / 3;
    rimLight1.penumbra = 0.4;
    scene.add(rimLight1);

    // Rim Light 2 (Silver highlight)
    const rimLight2 = new THREE.SpotLight(0xc0c0d0, 20);
    rimLight2.position.set(5, 4, -4);
    rimLight2.angle = Math.PI / 3.5;
    rimLight2.penumbra = 0.5;
    scene.add(rimLight2);

    // Accent Point Light (Subtle cold accent)
    const accentLight = new THREE.PointLight(0x8090a0, 3);
    accentLight.position.set(0, 3, -3);
    scene.add(accentLight);

    const gridHelper = new THREE.GridHelper(20, 20, 0x303040, 0x101015);
    scene.add(gridHelper);

    const dancerGroup = new THREE.Group();
    scene.add(dancerGroup);

    const createBone = (length, color, locked) => {
      const group = new THREE.Group();
      const geometry = new THREE.CylinderGeometry(0.08, 0.06, length, 24);

      // Determine material: Polished Chrome (silver) or Matte Black Rubber
      const isChrome = color >= 0x808080; // Silver colors get chrome
      const isMatte = color < 0x808080;   // Darker colors get matte black

      let material;
      if (locked) {
        // Locked joints: Red chrome with emission
        material = new THREE.MeshStandardMaterial({
          color: 0xff3030,
          emissive: 0x800000,
          roughness: 0.15,
          metalness: 0.95,
          envMapIntensity: 1.5
        });
      } else if (isChrome) {
        // Polished Chrome
        material = new THREE.MeshStandardMaterial({
          color: color,
          roughness: 0.1,
          metalness: 1.0,
          envMapIntensity: 2.0
        });
      } else {
        // Matte Black Rubber
        material = new THREE.MeshStandardMaterial({
          color: color,
          roughness: 0.9,
          metalness: 0.05,
          envMapIntensity: 0.3
        });
      }

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.y = length / 2;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const jointGeo = new THREE.SphereGeometry(0.12, 24, 24);
      const jointMat = material.clone();
      const joint = new THREE.Mesh(jointGeo, jointMat);
      joint.castShadow = true;
      joint.receiveShadow = true;

      group.add(joint);
      group.add(mesh);
      return group;
    };

    const hips = new THREE.Group();
    hips.position.y = 1;
    hips.name = 'hips';
    dancerGroup.add(hips);

    // Spine Chain
    const spine = createBone(0.15, 0x2a2a2a, locks.spine);
    spine.position.y = 0;
    spine.name = 'spine';
    hips.add(spine);

    const spine1 = createBone(0.15, 0x2a2a2a, locks.spine);
    spine1.position.y = 0.15;
    spine1.name = 'spine1';
    spine.add(spine1);

    const spine2 = createBone(0.15, 0x2a2a2a, locks.spine);
    spine2.position.y = 0.15;
    spine2.name = 'spine2';
    spine1.add(spine2);

    const chest = createBone(0.2, 0xc0c0c0, locks.spine);
    chest.position.y = 0.15;
    chest.name = 'chest';
    spine2.add(chest);

    const neck = createBone(0.1, 0xc0c0c0, locks.head);
    neck.position.y = 0.2;
    neck.name = 'neck';
    chest.add(neck);

    const head = createBone(0.2, 0xe0e0e0, locks.head);
    head.position.y = 0.1;
    head.name = 'head';
    neck.add(head);

    // Left Arm Chain
    const leftShoulder = createBone(0.08, 0xa0a0a0, locks.arms);
    leftShoulder.position.set(-0.2, 0.15, 0);
    leftShoulder.rotation.z = Math.PI / 2;
    leftShoulder.name = 'leftShoulder';
    chest.add(leftShoulder);

    const leftUpperArm = createBone(0.3, 0x808080, locks.arms);
    leftUpperArm.position.set(0, 0.08, 0);
    leftUpperArm.rotation.z = -Math.PI / 2;
    leftUpperArm.name = 'leftUpperArm';
    leftShoulder.add(leftUpperArm);

    const leftForearm = createBone(0.28, 0x606060, locks.arms);
    leftForearm.position.y = 0.3;
    leftForearm.name = 'leftForearm';
    leftUpperArm.add(leftForearm);

    const leftWrist = createBone(0.05, 0x505050, locks.arms);
    leftWrist.position.y = 0.28;
    leftWrist.name = 'leftWrist';
    leftForearm.add(leftWrist);

    const leftHand = createBone(0.08, 0x404040, locks.arms);
    leftHand.position.y = 0.05;
    leftHand.name = 'leftHand';
    leftWrist.add(leftHand);

    // Left Fingers
    const leftThumb1 = createBone(0.03, 0xc0c0c0, locks.arms);
    leftThumb1.position.set(0.02, 0.08, 0);
    leftThumb1.rotation.z = -0.5;
    leftThumb1.name = 'leftThumb1';
    leftHand.add(leftThumb1);

    const leftThumb2 = createBone(0.02, 0xc0c0c0, locks.arms);
    leftThumb2.position.y = 0.03;
    leftThumb2.name = 'leftThumb2';
    leftThumb1.add(leftThumb2);

    const leftIndex1 = createBone(0.035, 0xb0b0b0, locks.arms);
    leftIndex1.position.set(0.01, 0.08, 0);
    leftIndex1.rotation.z = -0.1;
    leftIndex1.name = 'leftIndex1';
    leftHand.add(leftIndex1);

    const leftIndex2 = createBone(0.025, 0xb0b0b0, locks.arms);
    leftIndex2.position.y = 0.035;
    leftIndex2.name = 'leftIndex2';
    leftIndex1.add(leftIndex2);

    const leftMiddle1 = createBone(0.04, 0xa0a0a0, locks.arms);
    leftMiddle1.position.set(0, 0.08, 0);
    leftMiddle1.name = 'leftMiddle1';
    leftHand.add(leftMiddle1);

    const leftMiddle2 = createBone(0.03, 0xa0a0a0, locks.arms);
    leftMiddle2.position.y = 0.04;
    leftMiddle2.name = 'leftMiddle2';
    leftMiddle1.add(leftMiddle2);

    // Right Arm Chain
    const rightShoulder = createBone(0.08, 0xa0a0a0, locks.arms);
    rightShoulder.position.set(0.2, 0.15, 0);
    rightShoulder.rotation.z = -Math.PI / 2;
    rightShoulder.name = 'rightShoulder';
    chest.add(rightShoulder);

    const rightUpperArm = createBone(0.3, 0x808080, locks.arms);
    rightUpperArm.position.set(0, 0.08, 0);
    rightUpperArm.rotation.z = Math.PI / 2;
    rightUpperArm.name = 'rightUpperArm';
    rightShoulder.add(rightUpperArm);

    const rightForearm = createBone(0.28, 0x606060, locks.arms);
    rightForearm.position.y = 0.3;
    rightForearm.name = 'rightForearm';
    rightUpperArm.add(rightForearm);

    const rightWrist = createBone(0.05, 0x505050, locks.arms);
    rightWrist.position.y = 0.28;
    rightWrist.name = 'rightWrist';
    rightForearm.add(rightWrist);

    const rightHand = createBone(0.08, 0x404040, locks.arms);
    rightHand.position.y = 0.05;
    rightHand.name = 'rightHand';
    rightWrist.add(rightHand);

    // Right Fingers
    const rightThumb1 = createBone(0.03, 0xc0c0c0, locks.arms);
    rightThumb1.position.set(-0.02, 0.08, 0);
    rightThumb1.rotation.z = 0.5;
    rightThumb1.name = 'rightThumb1';
    rightHand.add(rightThumb1);

    const rightThumb2 = createBone(0.02, 0xc0c0c0, locks.arms);
    rightThumb2.position.y = 0.03;
    rightThumb2.name = 'rightThumb2';
    rightThumb1.add(rightThumb2);

    const rightIndex1 = createBone(0.035, 0xb0b0b0, locks.arms);
    rightIndex1.position.set(-0.01, 0.08, 0);
    rightIndex1.rotation.z = 0.1;
    rightIndex1.name = 'rightIndex1';
    rightHand.add(rightIndex1);

    const rightIndex2 = createBone(0.025, 0xb0b0b0, locks.arms);
    rightIndex2.position.y = 0.035;
    rightIndex2.name = 'rightIndex2';
    rightIndex1.add(rightIndex2);

    const rightMiddle1 = createBone(0.04, 0xa0a0a0, locks.arms);
    rightMiddle1.position.set(0, 0.08, 0);
    rightMiddle1.name = 'rightMiddle1';
    rightHand.add(rightMiddle1);

    const rightMiddle2 = createBone(0.03, 0xa0a0a0, locks.arms);
    rightMiddle2.position.y = 0.04;
    rightMiddle2.name = 'rightMiddle2';
    rightMiddle1.add(rightMiddle2);

    // Left Leg Chain
    const leftThigh = createBone(0.4, 0x404040, locks.legs);
    leftThigh.position.set(-0.1, -0.05, 0);
    leftThigh.rotation.x = 0.1;
    leftThigh.name = 'leftThigh';
    hips.add(leftThigh);

    const leftShin = createBone(0.38, 0x303030, locks.legs);
    leftShin.position.y = 0.4;
    leftShin.name = 'leftShin';
    leftThigh.add(leftShin);

    const leftAnkle = createBone(0.05, 0x505050, locks.legs);
    leftAnkle.position.y = 0.38;
    leftAnkle.name = 'leftAnkle';
    leftShin.add(leftAnkle);

    const leftFoot = createBone(0.08, 0x606060, locks.legs);
    leftFoot.position.y = 0.05;
    leftFoot.rotation.x = -1.3;
    leftFoot.name = 'leftFoot';
    leftAnkle.add(leftFoot);

    const leftToe = createBone(0.04, 0x707070, locks.legs);
    leftToe.position.y = 0.08;
    leftToe.name = 'leftToe';
    leftFoot.add(leftToe);

    // Right Leg Chain
    const rightThigh = createBone(0.4, 0x404040, locks.legs);
    rightThigh.position.set(0.1, -0.05, 0);
    rightThigh.rotation.x = 0.1;
    rightThigh.name = 'rightThigh';
    hips.add(rightThigh);

    const rightShin = createBone(0.38, 0x303030, locks.legs);
    rightShin.position.y = 0.4;
    rightShin.name = 'rightShin';
    rightThigh.add(rightShin);

    const rightAnkle = createBone(0.05, 0x505050, locks.legs);
    rightAnkle.position.y = 0.38;
    rightAnkle.name = 'rightAnkle';
    rightShin.add(rightAnkle);

    const rightFoot = createBone(0.08, 0x606060, locks.legs);
    rightFoot.position.y = 0.05;
    rightFoot.rotation.x = -1.3;
    rightFoot.name = 'rightFoot';
    rightAnkle.add(rightFoot);

    const rightToe = createBone(0.04, 0x707070, locks.legs);
    rightToe.position.y = 0.08;
    rightToe.name = 'rightToe';
    rightFoot.add(rightToe);

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;
    dancerRef.current = dancerGroup;

    return () => {
      if (containerRef.current && renderer.domElement.parentNode) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [locks]);

  // 모션 데이터 적용
  const applyMotionFrame = (frameData, frameTime) => {
    if (!dancerRef.current || !frameData || !Array.isArray(frameData) || frameData.length < 22) {
      return;
    }

    try {
      const hips = dancerRef.current.children[0];
      if (!hips) return;

      const scale = 0.5;
      const smoothness = params.smoothness || 0.5;

      const lerp = (a, b, t) => a + (b - a) * t;
      const smoothstep = (t) => t * t * (3 - 2 * t);
      const easeInOutCubic = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const smootherstep = (t) => t * t * t * (t * (t * 6 - 15) + 10);
      const catmullRom = (t, p0, p1, p2, p3) => {
        const t2 = t * t;
        const t3 = t2 * t;
        return 0.5 * (
          (2 * p1) +
          (-p0 + p2) * t +
          (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
          (-p0 + 3 * p1 - 3 * p2 + p3) * t3
        );
      };

      let easingFunc;
      if (smoothness < 0.4) {
        easingFunc = smoothstep;
      } else if (smoothness < 0.6) {
        easingFunc = easeInOutCubic;
      } else if (smoothness < 0.8) {
        easingFunc = smootherstep;
      } else {
        easingFunc = (t) => smoothstep(t);
      }

      // blendFactor는 0~1 사이 값으로 클램핑
      const blendFactor = Math.max(0, Math.min(1, easingFunc(Math.max(0, Math.min(1, smoothness)))));

      // 확장된 관절 매핑 (50+ 관절)
      const jointMap = [
        { name: 'hips', idx: 0, parent: null },
        { name: 'spine', idx: 1, parent: 'hips' },
        { name: 'spine1', idx: 2, parent: 'spine' },
        { name: 'spine2', idx: 3, parent: 'spine1' },
        { name: 'chest', idx: 4, parent: 'spine2' },
        { name: 'neck', idx: 5, parent: 'chest' },
        { name: 'head', idx: 6, parent: 'neck' },

        // Left Arm Chain
        { name: 'leftShoulder', idx: 7, parent: 'chest' },
        { name: 'leftUpperArm', idx: 8, parent: 'leftShoulder' },
        { name: 'leftForearm', idx: 9, parent: 'leftUpperArm' },
        { name: 'leftWrist', idx: 10, parent: 'leftForearm' },
        { name: 'leftHand', idx: 11, parent: 'leftWrist' },
        { name: 'leftThumb1', idx: 12, parent: 'leftHand' },
        { name: 'leftThumb2', idx: 13, parent: 'leftThumb1' },
        { name: 'leftIndex1', idx: 14, parent: 'leftHand' },
        { name: 'leftIndex2', idx: 15, parent: 'leftIndex1' },
        { name: 'leftMiddle1', idx: 16, parent: 'leftHand' },
        { name: 'leftMiddle2', idx: 17, parent: 'leftMiddle1' },

        // Right Arm Chain
        { name: 'rightShoulder', idx: 18, parent: 'chest' },
        { name: 'rightUpperArm', idx: 19, parent: 'rightShoulder' },
        { name: 'rightForearm', idx: 20, parent: 'rightUpperArm' },
        { name: 'rightWrist', idx: 21, parent: 'rightForearm' },
        { name: 'rightHand', idx: 22, parent: 'rightWrist' },
        { name: 'rightThumb1', idx: 23, parent: 'rightHand' },
        { name: 'rightThumb2', idx: 24, parent: 'rightThumb1' },
        { name: 'rightIndex1', idx: 25, parent: 'rightHand' },
        { name: 'rightIndex2', idx: 26, parent: 'rightIndex1' },
        { name: 'rightMiddle1', idx: 27, parent: 'rightHand' },
        { name: 'rightMiddle2', idx: 28, parent: 'rightMiddle1' },

        // Left Leg Chain
        { name: 'leftThigh', idx: 29, parent: 'hips' },
        { name: 'leftShin', idx: 30, parent: 'leftThigh' },
        { name: 'leftAnkle', idx: 31, parent: 'leftShin' },
        { name: 'leftFoot', idx: 32, parent: 'leftAnkle' },
        { name: 'leftToe', idx: 33, parent: 'leftFoot' },

        // Right Leg Chain
        { name: 'rightThigh', idx: 34, parent: 'hips' },
        { name: 'rightShin', idx: 35, parent: 'rightThigh' },
        { name: 'rightAnkle', idx: 36, parent: 'rightShin' },
        { name: 'rightFoot', idx: 37, parent: 'rightAnkle' },
        { name: 'rightToe', idx: 38, parent: 'rightFoot' },
      ];

      // 확장된 스켈레톤 구조 직접 참조 (name 기반)
      const findBoneByName = (parent, name) => {
        if (!parent || !parent.children) return null;
        for (const child of parent.children) {
          if (child.name === name) return child;
          const found = findBoneByName(child, name);
          if (found) return found;
        }
        return null;
      };

      const boneMap = {
        hips: hips,
        spine: findBoneByName(hips, 'spine'),
        spine1: findBoneByName(hips, 'spine1'),
        spine2: findBoneByName(hips, 'spine2'),
        chest: findBoneByName(hips, 'chest'),
        neck: findBoneByName(hips, 'neck'),
        head: findBoneByName(hips, 'head'),

        leftShoulder: findBoneByName(hips, 'leftShoulder'),
        leftUpperArm: findBoneByName(hips, 'leftUpperArm'),
        leftForearm: findBoneByName(hips, 'leftForearm'),
        leftWrist: findBoneByName(hips, 'leftWrist'),
        leftHand: findBoneByName(hips, 'leftHand'),
        leftThumb1: findBoneByName(hips, 'leftThumb1'),
        leftThumb2: findBoneByName(hips, 'leftThumb2'),
        leftIndex1: findBoneByName(hips, 'leftIndex1'),
        leftIndex2: findBoneByName(hips, 'leftIndex2'),
        leftMiddle1: findBoneByName(hips, 'leftMiddle1'),
        leftMiddle2: findBoneByName(hips, 'leftMiddle2'),

        rightShoulder: findBoneByName(hips, 'rightShoulder'),
        rightUpperArm: findBoneByName(hips, 'rightUpperArm'),
        rightForearm: findBoneByName(hips, 'rightForearm'),
        rightWrist: findBoneByName(hips, 'rightWrist'),
        rightHand: findBoneByName(hips, 'rightHand'),
        rightThumb1: findBoneByName(hips, 'rightThumb1'),
        rightThumb2: findBoneByName(hips, 'rightThumb2'),
        rightIndex1: findBoneByName(hips, 'rightIndex1'),
        rightIndex2: findBoneByName(hips, 'rightIndex2'),
        rightMiddle1: findBoneByName(hips, 'rightMiddle1'),
        rightMiddle2: findBoneByName(hips, 'rightMiddle2'),

        leftThigh: findBoneByName(hips, 'leftThigh'),
        leftShin: findBoneByName(hips, 'leftShin'),
        leftAnkle: findBoneByName(hips, 'leftAnkle'),
        leftFoot: findBoneByName(hips, 'leftFoot'),
        leftToe: findBoneByName(hips, 'leftToe'),

        rightThigh: findBoneByName(hips, 'rightThigh'),
        rightShin: findBoneByName(hips, 'rightShin'),
        rightAnkle: findBoneByName(hips, 'rightAnkle'),
        rightFoot: findBoneByName(hips, 'rightFoot'),
        rightToe: findBoneByName(hips, 'rightToe')
      };

      jointMap.forEach(({ name, idx }) => {
        if (idx * 3 + 2 >= frameData.length) return;

        const baseIdx = idx * 3;
        // 회전 값을 제한하여 캐릭터가 화면 밖으로 나가지 않도록 함
        const rx = Math.max(-Math.PI, Math.min(Math.PI, (frameData[baseIdx] || 0) * scale));
        const ry = Math.max(-Math.PI, Math.min(Math.PI, (frameData[baseIdx + 1] || 0) * scale));
        const rz = Math.max(-Math.PI, Math.min(Math.PI, (frameData[baseIdx + 2] || 0) * scale));

        const target = boneMap[name];
        if (target) {
          const currentRot = target.rotation;
          // blendFactor를 사용하여 부드럽게 전환
          const blend = Math.max(0.1, Math.min(1, blendFactor));
          const newRot = {
            x: lerp(currentRot.x, rx, blend),
            y: lerp(currentRot.y, ry, blend),
            z: lerp(currentRot.z, rz, blend)
          };
          target.rotation.set(newRot.x, newRot.y, newRot.z);
        }
      });
    } catch (error) {
      console.error('모션 프레임 적용 오류:', error, {
        frameDataLength: frameData?.length,
        dancerRef: !!dancerRef.current
      });
    }
  };

  // 애니메이션 루프
  useEffect(() => {
    if (!sceneRef.current || !cameraRef.current || !rendererRef.current) return;

    const animate = () => {
      frameIdRef.current = requestAnimationFrame(animate);

      // 항상 렌더링 (캐릭터가 보이도록)
      if (dancerRef.current && dancerRef.current.children && dancerRef.current.children.length > 0) {
        const hips = dancerRef.current.children[0];

        // 캐릭터 visible 설정 확인
        if (hips) {
          hips.visible = true;
          dancerRef.current.visible = true;
        }

        // 모션 데이터 확인 및 적용
        const hasMotionData = motionData && motionData.data && Array.isArray(motionData.data) && motionData.data.length > 0;

        if (hasMotionData) {
          // 모션 데이터가 있을 때
          const frameIndex = Math.floor(currentTime * fps);
          const frameTime = (currentTime * fps) % 1;

          if (frameIndex >= 0 && frameIndex < motionData.data.length) {
            const frameData = motionData.data[frameIndex];
            const nextFrameData = frameIndex + 1 < motionData.data.length
              ? motionData.data[frameIndex + 1]
              : frameData;

            if (frameData && Array.isArray(frameData) && frameData.length >= 22) {
              const interpolated = frameData.map((val, i) => {
                const t = frameTime;
                const nextVal = nextFrameData && Array.isArray(nextFrameData) && nextFrameData[i] !== undefined
                  ? nextFrameData[i]
                  : val;
                return val + (nextVal - val) * t;
              });

              applyMotionFrame(interpolated, frameTime);
            }
          }
        } else {
          // 기본 애니메이션 (모션 데이터가 없을 때)
          const t = currentTime;
          if (hips && !locks.spine) {
            hips.rotation.y = Math.sin(t * 0.5) * 0.2;
          }
          const spine = hips?.children?.[0];
          if (spine && !locks.spine) {
            spine.rotation.x = Math.sin(t * 0.7) * 0.1;
          }
          const chest = spine?.children?.[0];
          if (chest && !locks.arms) {
            const leftUpperArm = chest.children.find(c => c.position.x < 0);
            const rightUpperArm = chest.children.find(c => c.position.x > 0);
            if (leftUpperArm) {
              leftUpperArm.rotation.x = Math.sin(t * 2) * 0.3;
            }
            if (rightUpperArm) {
              rightUpperArm.rotation.x = Math.sin(t * 2 + Math.PI) * 0.3;
            }
          }
        }
      }

      // 비트 기반 조명 효과
      if (beats && beats.length > 0) {
        const currentBeat = beats.find(b => Math.abs((typeof b === 'number' ? b : b.time) - currentTime) < 0.1);
        if (currentBeat) {
          const spotLight = sceneRef.current.children.find(c => c.type === 'SpotLight');
          if (spotLight) {
            spotLight.intensity = 30;
          }
        } else {
          const spotLight = sceneRef.current.children.find(c => c.type === 'SpotLight');
          if (spotLight) {
            spotLight.intensity = 20;
          }
        }
      }

      const cameraT = currentTime * 0.1;
      cameraRef.current.position.x = Math.sin(cameraT) * 5;
      cameraRef.current.position.z = Math.cos(cameraT) * 5;
      cameraRef.current.lookAt(0, 1, 0);

      // 항상 렌더링
      rendererRef.current.render(sceneRef.current, cameraRef.current);
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
      <div className="w-32 flex-shrink-0 border-r border-[#303030] flex items-center px-4 text-xs font-mono text-[#c0c0c0] bg-[#0a0a0a]/95 z-10">
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
  const [localStartTime, setLocalStartTime] = useState('');
  const [localDuration, setLocalDuration] = useState('');

  const audioRef = useRef(null);

  // 유틸리티 함수
  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds) || seconds < 0) return '00:00';
    const totalSeconds = Math.floor(seconds);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const calculatePlayheadPosition = (time) => {
    return totalDuration > 0 ? Math.max(0, Math.min(100, (time / totalDuration) * 100)) : 0;
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

  // 오디오 재생 제어
  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(() => setIsPlaying(false));
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

    const updateTime = () => {
      if (audio && !isNaN(audio.currentTime)) {
        const currentAudioTime = audio.currentTime;
        setCurrentTime(currentAudioTime);
        if (totalDuration > 0) {
          const position = calculatePlayheadPosition(currentAudioTime);
          setPlayheadPosition(position);
        }
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
      alert(`오디오 분석에 실패했습니다: ${error.message}\n기본 길이를 사용합니다.`);
      throw error;
    }
  };

  const handleGenerateMotion = async () => {
    if (!prompt.trim()) {
      alert('텍스트 프롬프트를 입력해주세요.');
      return;
    }
    if (!audioFile) {
      alert('음악 파일을 먼저 업로드해주세요.');
      return;
    }
    if (!audioAnalysis) {
      alert('음악 분석이 완료되지 않았습니다. 잠시만 기다려주세요.');
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
        const normalizedMotionData = {
          frames: motionData.frames || (Array.isArray(motionData.data) ? motionData.data.length : 0),
          joints: motionData.joints || 22,
          data: Array.isArray(motionData.data) ? motionData.data : [],
          fps: motionData.fps || 30,
          duration: motionData.duration || totalDuration,
          style: motionData.style || selectedStyle,
          prompt: motionData.prompt || prompt
        };
        
        console.log('✅ 모션 데이터 저장:', {
          frames: normalizedMotionData.frames,
          dataLength: normalizedMotionData.data.length,
          hasData: normalizedMotionData.data.length > 0
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
        alert('안무 생성이 완료되었습니다!');
      } else {
        throw new Error(finalStatus.message || '모션 생성 실패');
      }
    } catch (error) {
      alert(`안무 생성에 실패했습니다: ${error.message}`);
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

  const handleSkip = (direction) => {
    const skipAmount = 5;
    const newTime = direction === 'back' 
      ? Math.max(0, currentTime - skipAmount)
      : Math.min(totalDuration, currentTime + skipAmount);
    seekToTime(newTime, false);
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
      
      <nav className="h-12 border-b border-[#2a2a2e] bg-[#0a0a0a]/95 backdrop-blur-lg flex items-center justify-between px-4 select-none shadow-lg">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-[#c0c0c0] font-bold tracking-tighter text-lg">
            <Layers className="fill-current" /> SOTA<span className="text-white">STUDIO</span>
          </div>
          <div className="h-4 w-[1px] bg-slate-700 mx-2"></div>
          <div className="flex gap-1 bg-black/40 backdrop-blur-md p-1 rounded-lg border border-[#2a2a2e]">
            {['generation', 'editing', 'rigging'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 text-xs font-medium rounded transition ${
                  activeTab === tab
                    ? 'bg-gradient-to-r from-[#606060] to-[#404040] text-white shadow-lg border border-[#808080]'
                    : 'text-[#a0a0a0] hover:text-white hover:bg-[#1a1a1a] border border-transparent'
                }`}
              >
                {tab === 'generation' ? '생성' : tab === 'editing' ? '편집' : '리깅'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-xs text-[#a0a0a0] font-mono">
            MEM: 2.4GB | Latency: 12ms
          </div>
          <div className="relative group">
            <button className="px-3 py-1.5 bg-gradient-to-r from-[#707070] via-[#505050] to-[#606060] hover:from-[#808080] hover:via-[#606060] hover:to-[#707070] text-white text-xs font-medium rounded transition flex items-center gap-2 shadow-lg border border-[#909090]/50">
              <Download size={14} />
              내보내기
            </button>
            <div className="absolute right-0 top-full mt-1 bg-[#1a1a1a]/95 backdrop-blur-lg border border-[#404040] rounded shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <button onClick={() => handleExportFBX('json')} className="block w-full text-left px-4 py-2 text-sm text-[#d0d0d0] hover:bg-[#2a2a2a] hover:text-white transition">JSON</button>
              <button onClick={() => handleExportFBX('bvh')} className="block w-full text-left px-4 py-2 text-sm text-[#d0d0d0] hover:bg-[#2a2a2a] hover:text-white transition">BVH</button>
              <button onClick={() => handleExportFBX('fbx')} className="block w-full text-left px-4 py-2 text-sm text-[#d0d0d0] hover:bg-[#2a2a2a] hover:text-white transition">FBX</button>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-80 bg-[#0a0a0a]/90 backdrop-blur-xl border-r border-[#2a2a2e] flex flex-col overflow-y-auto shadow-2xl">
          {activeTab === 'generation' && (
            <div className="p-4 space-y-6">
              <div>
                <h3 className="text-xs font-bold text-[#c0c0c0] uppercase mb-3 tracking-wider">STEP 1: 음악 업로드</h3>
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
                  <Video size={24} className="mx-auto mb-2 text-[#808080]" />
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
                <h3 className="text-xs font-bold text-[#c0c0c0] uppercase mb-3 tracking-wider">STEP 2: 안무 프롬프트 입력</h3>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="예: Powerful hip-hop routine with popping elements."
                  className="w-full p-3 bg-slate-900 border border-slate-700 rounded text-sm resize-none focus:outline-none focus:border-pink-500"
                  rows={3}
                />
              </div>

              <div>
                <h3 className="text-xs font-bold text-[#c0c0c0] uppercase mb-3 tracking-wider">STYLE</h3>
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
                <h3 className="text-xs font-bold text-[#c0c0c0] uppercase mb-3 tracking-wider">부분 고정 (IN-PAINTING)</h3>
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
                <h3 className="text-xs font-bold text-[#c0c0c0] uppercase mb-3 flex items-center gap-2 tracking-wider">
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
                        <span className="text-[#b0b0b0]">{label}</span>
                        <span className="text-[#e0e0e0] font-semibold">{Math.round(value * 100)}%</span>
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
                className="w-full p-4 bg-gradient-to-r from-[#808080] via-[#606060] to-[#707070] hover:from-[#909090] hover:via-[#707070] hover:to-[#808080] text-white font-bold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-xl border border-[#a0a0a0]/50"
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
              <h3 className="text-xs font-bold text-[#c0c0c0] uppercase mb-3 tracking-wider">모션 편집</h3>
              {selectedMotion ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-[#b0b0b0] block mb-1">시작 시간 (초)</label>
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
                    <label className="text-xs text-[#b0b0b0] block mb-1">지속 시간 (초)</label>
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
                  <button
                    onClick={() => {
                      setTracks(prev => ({
                        ...prev,
                        motion: prev.motion.filter(m => m.id !== selectedMotion.id)
                      }));
                    }}
                    className="w-full p-2 bg-gradient-to-r from-red-600/20 to-red-700/20 border border-red-500 text-red-400 rounded text-sm hover:from-red-600/30 hover:to-red-700/30 transition shadow-lg shadow-red-500/10"
                  >
                    삭제
                  </button>
                </div>
              ) : (
                <div className="text-sm text-[#909090] text-center py-8">선택된 모션이 없습니다</div>
              )}
            </div>
          )}

          {activeTab === 'rigging' && (
            <div className="p-4">
              <h3 className="text-xs font-bold text-[#c0c0c0] uppercase mb-3 tracking-wider">리깅</h3>
              <div className="text-sm text-[#909090] text-center py-8">리깅 기능은 준비 중입니다</div>
            </div>
          )}
        </aside>

        <main className="flex-1 flex flex-col relative bg-[#050505]">
          <div className="absolute top-4 left-4 z-10 flex gap-2">
            <button onClick={()=>setViewMode('render')} className={`p-2 rounded-md backdrop-blur-md border ${viewMode==='render' ? 'bg-gradient-to-r from-[#505050] to-[#404040] border-[#707070] text-white shadow-lg':'bg-black/50 border-[#303030] text-[#808080] hover:text-[#c0c0c0]'}`}>
              <Video size={16}/>
            </button>
            <button onClick={()=>setViewMode('skeleton')} className={`p-2 rounded-md backdrop-blur-md border ${viewMode==='skeleton' ? 'bg-gradient-to-r from-[#505050] to-[#404040] border-[#707070] text-white shadow-lg':'bg-black/50 border-[#303030] text-[#808080] hover:text-[#c0c0c0]'}`}>
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
            />
          </div>

          <div className="h-64 bg-[#0a0a0a]/90 backdrop-blur-xl border-t border-[#2a2a2e] flex flex-col shadow-2xl">
            <div className="h-10 border-b border-slate-800 flex items-center justify-between px-4 bg-slate-900/80">
              <div className="flex items-center gap-4">
                <button onClick={() => setIsPlaying(!isPlaying)} className="text-white hover:text-pink-400 transition">
                  {isPlaying ? <Pause size={20} fill="currentColor"/> : <Play size={20} fill="currentColor"/>}
                </button>
                <div className="flex gap-2 text-[#a0a0a0]">
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
              
              {tracks.music.length > 0 && totalDuration > 0 && (
                <div
                  className="absolute top-0 bottom-0 w-[2px] bg-red-500 z-50 pointer-events-none transition-all duration-100"
                  style={{
                    left: `calc(128px + (100% - 128px) * ${Math.max(0, Math.min(100, playheadPosition || 0)) / 100})`,
                    width: '2px'
                  }}
                >
                  <div className="absolute top-0 left-0 transform -translate-x-1/2 -translate-y-1 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-transparent border-t-red-500"></div>
                </div>
              )}
            </div>
          </div>
        </main>

        <aside className="w-64 bg-[#0a0a0a]/90 backdrop-blur-xl border-l border-[#2a2a2e] hidden xl:flex flex-col shadow-2xl">
          <div className="p-4 border-b border-slate-800">
            <h3 className="text-xs font-bold text-[#c0c0c0] uppercase mb-3 flex items-center gap-2 tracking-wider">
              <Users size={12} /> FORMATION VIEW
            </h3>
            <div className="aspect-square bg-slate-900 rounded-lg border border-slate-800 relative p-4 flex items-center justify-center overflow-hidden cursor-crosshair">
              <div className="text-xs text-slate-500 text-center">
                <Grid3X3 size={24} className="mx-auto mb-2 opacity-30" />
                <div>포메이션 편집</div>
                <div className="text-[10px] mt-1">드래그하여 포인트 배치</div>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button className="flex-1 px-3 py-1.5 bg-gradient-to-r from-[#3a3a3a] to-[#2a2a2a] hover:from-[#4a4a4a] hover:to-[#3a3a3a] text-xs rounded transition border border-[#505050] text-[#c0c0c0]">
                Reset
              </button>
              <button className="flex-1 px-3 py-1.5 bg-gradient-to-r from-[#707070] to-[#505050] hover:from-[#808080] hover:to-[#606060] text-white text-xs rounded transition border border-[#909090]/50 shadow-lg">
                Save
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { Asset, vectorMatrixVector } from '../services/portfolioEngine';
import { Play, Pause, RotateCcw, Eye, Layers, Compass } from 'lucide-react';

interface QuadraticSurface3DProps {
  assets: Asset[];
  covMatrix: number[][];
  mvpWeights: number[];
  tangencyWeights: number[];
}

export const QuadraticSurface3D: React.FC<QuadraticSurface3DProps> = ({
  assets,
  covMatrix,
  mvpWeights,
  tangencyWeights
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps] = useState(30);
  const [showWireframe, setShowWireframe] = useState(false);
  const [showContours, setShowContours] = useState(true);
  const [activeView, setActiveView] = useState<'3d' | 'top' | 'side'>('3d');

  // We focus on the first 3 assets for the 3D Simplex w1 + w2 + w3 = 1
  const sub3Assets = useMemo(() => assets.slice(0, 3), [assets]);
  const sub3Cov = useMemo(() => {
    return [
      [covMatrix[0]?.[0] || 0.04, covMatrix[0]?.[1] || 0.01, covMatrix[0]?.[2] || 0.01],
      [covMatrix[1]?.[0] || 0.01, covMatrix[1]?.[1] || 0.04, covMatrix[1]?.[2] || 0.01],
      [covMatrix[2]?.[0] || 0.01, covMatrix[2]?.[1] || 0.01, covMatrix[2]?.[2] || 0.04]
    ];
  }, [covMatrix]);

  // Compute 3D simplex equilateral coordinates
  // A1 at top (0, sqrt(3)/2), A2 at bottom-left (-0.5, 0), A3 at bottom-right (0.5, 0)
  const simplexScale = 4.0;
  const H = (Math.sqrt(3) / 2) * simplexScale;
  const V1 = new THREE.Vector2(0, H - H / 3);
  const V2 = new THREE.Vector2(-simplexScale / 2, -H / 3);
  const V3 = new THREE.Vector2(simplexScale / 2, -H / 3);

  const getSimplexPosition = (w1: number, w2: number, w3: number): { x: number; z: number } => {
    const x = w1 * V1.x + w2 * V2.x + w3 * V3.x;
    const z = w1 * V1.y + w2 * V2.y + w3 * V3.y;
    return { x, z };
  };

  // Trajectory points from random start to MVP
  const trajectory = useMemo(() => {
    const startW = [0.85, 0.10, 0.05];
    const targetW = [
      mvpWeights[0] ?? 0.33,
      mvpWeights[1] ?? 0.33,
      mvpWeights[2] ?? 0.34
    ];
    const sumT = targetW[0] + targetW[1] + targetW[2];
    const normTarget = targetW.map(v => v / sumT);

    const path: { w: number[]; x: number; y: number; z: number; vol: number }[] = [];
    for (let s = 0; s <= totalSteps; s++) {
      const t = s / totalSteps;
      // Nonlinear easing (smooth convergence)
      const ease = 1 - Math.pow(1 - t, 2.5);
      const w1 = startW[0] + (normTarget[0] - startW[0]) * ease;
      const w2 = startW[1] + (normTarget[1] - startW[1]) * ease;
      const w3 = 1 - w1 - w2;
      const w = [w1, w2, w3];
      const variance = Math.max(vectorMatrixVector(w, sub3Cov), 1e-6);
      const vol = Math.sqrt(variance);
      const { x, z } = getSimplexPosition(w1, w2, w3);
      const y = vol * 8.0; // height scaling
      path.push({ w, x, y, z, vol });
    }
    return path;
  }, [mvpWeights, sub3Cov, totalSteps]);

  // Keep trajectory and scene refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sphereRef = useRef<THREE.Mesh | null>(null);
  const pathLineRef = useRef<THREE.Line | null>(null);
  const surfaceMeshRef = useRef<THREE.Mesh | null>(null);

  // Animation loop for step-by-step convergence
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlaying) {
      timer = setInterval(() => {
        setCurrentStep(prev => {
          if (prev >= totalSteps) {
            setIsPlaying(false);
            return totalSteps;
          }
          return prev + 1;
        });
      }, 90);
    }
    return () => clearInterval(timer);
  }, [isPlaying, totalSteps]);

  // Three.js Mount & Render
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight || 420;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0xF8FAFC); // Slate 50 light background

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 7.5, 9.5);
    camera.lookAt(0, 0.8, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(6, 12, 8);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x93C5FD, 0.4);
    fillLight.position.set(-6, 4, -4);
    scene.add(fillLight);

    // 1. Simplex Base Floor
    const simplexShape = new THREE.Shape();
    simplexShape.moveTo(V1.x, V1.y);
    simplexShape.lineTo(V2.x, V2.y);
    simplexShape.lineTo(V3.x, V3.y);
    simplexShape.closePath();

    const simplexGeom = new THREE.ShapeGeometry(simplexShape);
    simplexGeom.rotateX(-Math.PI / 2);
    const simplexMat = new THREE.MeshBasicMaterial({
      color: 0xE2E8F0,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85
    });
    const simplexFloor = new THREE.Mesh(simplexGeom, simplexMat);
    scene.add(simplexFloor);

    // Simplex Edge Outline
    const edgePoints = [
      new THREE.Vector3(V1.x, 0.01, V1.y),
      new THREE.Vector3(V2.x, 0.01, V2.y),
      new THREE.Vector3(V3.x, 0.01, V3.y),
      new THREE.Vector3(V1.x, 0.01, V1.y)
    ];
    const edgeGeom = new THREE.BufferGeometry().setFromPoints(edgePoints);
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x94A3B8, linewidth: 2 });
    const edgeLine = new THREE.Line(edgeGeom, edgeMat);
    scene.add(edgeLine);

    // 2. Paraboloid Curved Surface over Simplex
    const resolution = 36;
    const vertices: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const grid: (number | null)[][] = [];

    let vertexCount = 0;
    const minVol = 0.03;
    const maxVol = 0.25;

    for (let i = 0; i <= resolution; i++) {
      grid[i] = [];
      const w1 = i / resolution;
      for (let j = 0; j <= resolution - i; j++) {
        const w2 = j / resolution;
        const w3 = Math.max(0, 1 - w1 - w2);

        const { x, z } = getSimplexPosition(w1, w2, w3);
        const wVec = [w1, w2, w3];
        const varP = Math.max(vectorMatrixVector(wVec, sub3Cov), 1e-6);
        const vol = Math.sqrt(varP);
        const y = vol * 8.0;

        vertices.push(x, y, z);

        // Heatmap color: low vol = blue/emerald, high vol = amber/crimson
        const normalized = Math.min(Math.max((vol - minVol) / (maxVol - minVol), 0), 1);
        const color = new THREE.Color();
        color.setHSL(0.6 - normalized * 0.55, 0.85, 0.52);
        colors.push(color.r, color.g, color.b);

        grid[i][j] = vertexCount++;
      }
    }

    // Triangular face indices
    for (let i = 0; i < resolution; i++) {
      for (let j = 0; j < resolution - i; j++) {
        const idxA = grid[i]?.[j];
        const idxB = grid[i + 1]?.[j];
        const idxC = grid[i]?.[j + 1];

        if (idxA !== undefined && idxB !== undefined && idxC !== undefined &&
            idxA !== null && idxB !== null && idxC !== null) {
          indices.push(idxA, idxB, idxC);
        }

        const idxD = grid[i + 1]?.[j + 1];
        if (idxB !== undefined && idxD !== undefined && idxC !== undefined &&
            idxB !== null && idxD !== null && idxC !== null) {
          indices.push(idxB, idxD, idxC);
        }
      }
    }

    const surfaceGeom = new THREE.BufferGeometry();
    surfaceGeom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    surfaceGeom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    surfaceGeom.setIndex(indices);
    surfaceGeom.computeVertexNormals();

    const surfaceMat = new THREE.MeshPhongMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      wireframe: showWireframe,
      shininess: 40,
      transparent: true,
      opacity: 0.90
    });
    const surfaceMesh = new THREE.Mesh(surfaceGeom, surfaceMat);
    scene.add(surfaceMesh);
    surfaceMeshRef.current = surfaceMesh;

    // 3. Highlight MVP Point on Surface
    const mvpW1 = mvpWeights[0] ?? 0.33;
    const mvpW2 = mvpWeights[1] ?? 0.33;
    const mvpW3 = 1 - mvpW1 - mvpW2;
    const mvpPos = getSimplexPosition(mvpW1, mvpW2, mvpW3);
    const mvpVol = Math.sqrt(Math.max(vectorMatrixVector([mvpW1, mvpW2, mvpW3], sub3Cov), 1e-6));
    const mvpY = mvpVol * 8.0;

    const mvpMarkerGeom = new THREE.SphereGeometry(0.12, 16, 16);
    const mvpMarkerMat = new THREE.MeshStandardMaterial({ color: 0x10B981, roughness: 0.2, metalness: 0.8 });
    const mvpMarker = new THREE.Mesh(mvpMarkerGeom, mvpMarkerMat);
    mvpMarker.position.set(mvpPos.x, mvpY, mvpPos.z);
    scene.add(mvpMarker);

    // Drop line from MVP to floor
    const dropLineGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(mvpPos.x, mvpY, mvpPos.z),
      new THREE.Vector3(mvpPos.x, 0.01, mvpPos.z)
    ]);
    const dropLineMat = new THREE.LineDashedMaterial({ color: 0x059669, dashSize: 0.15, gapSize: 0.08 });
    const dropLine = new THREE.Line(dropLineGeom, dropLineMat);
    dropLine.computeLineDistances();
    scene.add(dropLine);

    // 4. Moving Convergence Sphere
    const sphereGeom = new THREE.SphereGeometry(0.16, 24, 24);
    const sphereMat = new THREE.MeshStandardMaterial({
      color: 0xEF4444,
      emissive: 0x991B1B,
      roughness: 0.1,
      metalness: 0.6
    });
    const moveSphere = new THREE.Mesh(sphereGeom, sphereMat);
    const startPoint = trajectory[0] || { x: 0, y: 1, z: 0 };
    moveSphere.position.set(startPoint.x, startPoint.y, startPoint.z);
    scene.add(moveSphere);
    sphereRef.current = moveSphere;

    // 5. Trajectory Line
    const pathLineGeom = new THREE.BufferGeometry();
    const pathLineMat = new THREE.LineBasicMaterial({ color: 0xDC2626, linewidth: 3 });
    const pathLine = new THREE.Line(pathLineGeom, pathLineMat);
    scene.add(pathLine);
    pathLineRef.current = pathLine;

    // Mouse Interaction for 3D Orbiting
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;
    let spherical = { radius: 12.0, theta: 0.0, phi: Math.PI / 3.5 };

    const updateCameraFromSpherical = () => {
      camera.position.x = spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta);
      camera.position.y = spherical.radius * Math.cos(spherical.phi);
      camera.position.z = spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta);
      camera.lookAt(0, 0.8, 0);
    };
    updateCameraFromSpherical();

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - prevMouseX;
      const dy = e.clientY - prevMouseY;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;

      spherical.theta -= dx * 0.008;
      spherical.phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, spherical.phi - dy * 0.008));
      updateCameraFromSpherical();
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      spherical.radius = Math.max(5.0, Math.min(22.0, spherical.radius + e.deltaY * 0.01));
      updateCameraFromSpherical();
    };

    const domElement = renderer.domElement;
    domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    domElement.addEventListener('wheel', onWheel, { passive: false });

    // Touch support for mobile / tablets
    let touchStartX = 0;
    let touchStartY = 0;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const dx = e.touches[0].clientX - touchStartX;
        const dy = e.touches[0].clientY - touchStartY;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;

        spherical.theta -= dx * 0.01;
        spherical.phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, spherical.phi - dy * 0.01));
        updateCameraFromSpherical();
      }
    };
    domElement.addEventListener('touchstart', onTouchStart);
    domElement.addEventListener('touchmove', onTouchMove);

    // Animation Render Loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight || 420;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      domElement.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      domElement.removeEventListener('wheel', onWheel);
      domElement.removeEventListener('touchstart', onTouchStart);
      domElement.removeEventListener('touchmove', onTouchMove);
      renderer.dispose();
      surfaceGeom.dispose();
      surfaceMat.dispose();
    };
  }, [sub3Assets, sub3Cov, mvpWeights]);

  // Update sphere position & trajectory line when currentStep changes
  useEffect(() => {
    if (!sphereRef.current || !pathLineRef.current || trajectory.length === 0) return;
    const pt = trajectory[currentStep] || trajectory[0];
    sphereRef.current.position.set(pt.x, pt.y, pt.z);

    const visitedPoints = trajectory.slice(0, currentStep + 1).map(p => new THREE.Vector3(p.x, p.y + 0.02, p.z));
    pathLineRef.current.geometry.setFromPoints(visitedPoints);
  }, [currentStep, trajectory]);

  // Update wireframe mode
  useEffect(() => {
    if (surfaceMeshRef.current) {
      (surfaceMeshRef.current.material as THREE.MeshPhongMaterial).wireframe = showWireframe;
    }
  }, [showWireframe]);

  // Change camera view preset
  const handleViewChange = (view: '3d' | 'top' | 'side') => {
    setActiveView(view);
    if (!cameraRef.current) return;
    if (view === '3d') {
      cameraRef.current.position.set(0, 7.5, 9.5);
    } else if (view === 'top') {
      cameraRef.current.position.set(0, 13.0, 0.01);
    } else if (view === 'side') {
      cameraRef.current.position.set(11.0, 3.0, 0);
    }
    cameraRef.current.lookAt(0, 0.8, 0);
  };

  const activeTrajectoryPoint = trajectory[currentStep] || trajectory[0];

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
      {/* Header controls bar */}
      <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <h3 className="font-semibold text-slate-800 text-sm">
            三资产权重单纯形 (w₁ + w₂ + w₃ = 1) 抛物面 3D 二次规划演播
          </h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-600 font-mono">
            Three.js WebGL
          </span>
        </div>

        {/* View Angle and Rendering Toggles */}
        <div className="flex items-center space-x-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs">
            <button
              onClick={() => handleViewChange('3d')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                activeView === '3d' ? 'bg-slate-900 text-white font-medium' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              3D 透视
            </button>
            <button
              onClick={() => handleViewChange('top')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                activeView === 'top' ? 'bg-slate-900 text-white font-medium' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              俯视等高线
            </button>
            <button
              onClick={() => handleViewChange('side')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                activeView === 'side' ? 'bg-slate-900 text-white font-medium' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              侧视抛物碗
            </button>
          </div>

          <button
            onClick={() => setShowWireframe(!showWireframe)}
            className={`p-1.5 rounded-md border text-xs flex items-center gap-1 transition-colors ${
              showWireframe ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            title="切换网格线框"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>网格</span>
          </button>
        </div>
      </div>

      {/* 3D Canvas Viewport */}
      <div className="relative w-full h-[400px] bg-gradient-to-b from-slate-50 to-slate-100/60 select-none">
        <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        {/* Floating Simplex Vertex Indicators */}
        <div className="absolute top-3 left-4 pointer-events-none text-xs bg-white/90 backdrop-blur-sm border border-slate-200/80 rounded-lg p-2.5 shadow-sm space-y-1">
          <div className="font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-indigo-600" />
            <span>单纯形顶点基底</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-600">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: sub3Assets[0]?.color || '#2563EB' }} />
            <span>顶点 A (顶部): {sub3Assets[0]?.symbol || 'Asset 1'} (100%)</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-600">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: sub3Assets[1]?.color || '#059669' }} />
            <span>顶点 B (左下): {sub3Assets[1]?.symbol || 'Asset 2'} (100%)</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-600">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: sub3Assets[2]?.color || '#D97706' }} />
            <span>顶点 C (右下): {sub3Assets[2]?.symbol || 'Asset 3'} (100%)</span>
          </div>
        </div>

        {/* Convergence State Inspector Card */}
        <div className="absolute bottom-3 right-4 pointer-events-none text-xs bg-white/95 backdrop-blur-sm border border-slate-200/80 rounded-xl p-3 shadow-md min-w-[210px]">
          <div className="text-[11px] font-medium text-slate-500 mb-1 flex items-center justify-between">
            <span>当前求解收敛轨迹</span>
            <span className="font-mono text-indigo-600 font-bold">步数 {currentStep}/{totalSteps}</span>
          </div>
          <div className="space-y-1 font-mono text-[11px] text-slate-700">
            <div className="flex justify-between">
              <span className="text-slate-500">w1 ({sub3Assets[0]?.name.slice(0, 4)}):</span>
              <span className="font-semibold">{((activeTrajectoryPoint.w[0] || 0) * 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">w2 ({sub3Assets[1]?.name.slice(0, 4)}):</span>
              <span className="font-semibold">{((activeTrajectoryPoint.w[1] || 0) * 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">w3 ({sub3Assets[2]?.name.slice(0, 4)}):</span>
              <span className="font-semibold">{((activeTrajectoryPoint.w[2] || 0) * 100).toFixed(1)}%</span>
            </div>
            <div className="pt-1.5 border-t border-slate-100 flex justify-between text-slate-800">
              <span className="text-slate-500">组合波动率 σ_p:</span>
              <span className="font-bold text-emerald-600">{(activeTrajectoryPoint.vol * 100).toFixed(2)}%</span>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="absolute bottom-3 left-4 pointer-events-none text-xs bg-white/80 backdrop-blur-sm px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-500 flex items-center gap-2">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> 理论 MVP 最优点
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> 迭代演播球
          </span>
          <span>按住鼠标左键任意角度旋转 / 滚轮缩放</span>
        </div>
      </div>

      {/* Stepper playback controller */}
      <div className="px-5 py-3 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              if (currentStep >= totalSteps) setCurrentStep(0);
              setIsPlaying(!isPlaying);
            }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-medium text-xs transition-colors ${
              isPlaying
                ? 'bg-amber-500 text-white hover:bg-amber-600'
                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
            }`}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlaying ? '暂停演播' : currentStep >= totalSteps ? '重放收敛' : '演播梯度收敛'}</span>
          </button>

          <button
            onClick={() => {
              setIsPlaying(false);
              setCurrentStep(0);
            }}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
            title="重置到起点"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Step Slider */}
        <div className="flex-1 max-w-md flex items-center gap-3">
          <span className="text-xs text-slate-500 whitespace-nowrap">初始点 w₀</span>
          <input
            type="range"
            min={0}
            max={totalSteps}
            value={currentStep}
            onChange={e => {
              setIsPlaying(false);
              setCurrentStep(Number(e.target.value));
            }}
            className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg appearance-none"
          />
          <span className="text-xs text-emerald-600 font-medium whitespace-nowrap">收敛至 MVP</span>
        </div>

        <div className="text-xs text-slate-500 font-mono hidden sm:block">
          min 0.5·wᵀΣw  s.t. 1ᵀw = 1, w ≥ 0
        </div>
      </div>
    </div>
  );
};

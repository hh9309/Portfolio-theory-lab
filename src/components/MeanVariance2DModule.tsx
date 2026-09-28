/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { Asset, vectorMatrixVector, dotProduct, solveAnalyticalMVP, solveTangencyPortfolio } from '../services/portfolioEngine';
import { Play, Pause, RotateCcw, Sliders, Info, Eye, Layers, Compass, Target, TrendingDown, ArrowRight, MousePointerClick } from 'lucide-react';

interface MeanVariance2DModuleProps {
  assets: Asset[];
  covMatrix: number[][];
  mvpWeights: number[];
  tangencyWeights: number[];
  riskFreeRate?: number;
}

export const MeanVariance2DModule: React.FC<MeanVariance2DModuleProps> = ({
  assets,
  covMatrix,
  mvpWeights,
  tangencyWeights,
  riskFreeRate = 0.035
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Focus on the first 3 assets for ternary simplex space w1 + w2 + w3 = 1
  const subAssets = useMemo(() => assets.slice(0, 3), [assets]);
  const subCov = useMemo(() => {
    return [
      [covMatrix[0]?.[0] || 0.04, covMatrix[0]?.[1] || 0.01, covMatrix[0]?.[2] || 0.01],
      [covMatrix[1]?.[0] || 0.01, covMatrix[1]?.[1] || 0.04, covMatrix[1]?.[2] || 0.01],
      [covMatrix[2]?.[0] || 0.01, covMatrix[2]?.[1] || 0.01, covMatrix[2]?.[2] || 0.04]
    ];
  }, [covMatrix]);

  const subReturns = useMemo(() => {
    return [
      assets[0]?.expectedReturn || 0.08,
      assets[1]?.expectedReturn || 0.04,
      assets[2]?.expectedReturn || 0.07
    ];
  }, [assets]);

  // Simplex Triangle Dimensions & Coordinates in 2D
  // V1 (Top): Asset 1 (100% w1)
  // V2 (Bottom-Left): Asset 2 (100% w2)
  // V3 (Bottom-Right): Asset 3 (100% w3)
  const [startPointW, setStartPointW] = useState<[number, number, number]>([0.85, 0.10, 0.05]);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [totalSteps] = useState<number>(36);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playSpeed, setPlaySpeed] = useState<number>(75); // ms per step

  // Visual toggles
  const [showContours, setShowContours] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showGradients, setShowGradients] = useState<boolean>(false);
  const [activeHoverPoint, setActiveHoverPoint] = useState<{
    w: [number, number, number];
    vol: number;
    ret: number;
    sharpe: number;
    x: number;
    y: number;
  } | null>(null);

  // Normalized MVP & Tangency weights for 3 assets
  const normMVP = useMemo<[number, number, number]>(() => {
    const w1 = mvpWeights[0] ?? 0.33;
    const w2 = mvpWeights[1] ?? 0.33;
    const w3 = mvpWeights[2] ?? 0.34;
    const s = Math.max(w1 + w2 + w3, 1e-6);
    return [w1 / s, w2 / s, w3 / s];
  }, [mvpWeights]);

  const normTangency = useMemo<[number, number, number]>(() => {
    const w1 = tangencyWeights[0] ?? 0.33;
    const w2 = tangencyWeights[1] ?? 0.33;
    const w3 = tangencyWeights[2] ?? 0.34;
    const s = Math.max(w1 + w2 + w3, 1e-6);
    return [w1 / s, w2 / s, w3 / s];
  }, [tangencyWeights]);

  // Calculate convergence trajectory from startPointW to normMVP using gradient descent / QP simulation
  const trajectory = useMemo(() => {
    const path: {
      w: [number, number, number];
      vol: number;
      ret: number;
      sharpe: number;
      variance: number;
    }[] = [];

    let currentW: [number, number, number] = [...startPointW];

    for (let s = 0; s <= totalSteps; s++) {
      const t = s / totalSteps;
      // Exponential convergence curve towards MVP
      const ease = 1 - Math.pow(1 - t, 2.2);
      const w1 = startPointW[0] + (normMVP[0] - startPointW[0]) * ease;
      const w2 = startPointW[1] + (normMVP[1] - startPointW[1]) * ease;
      const w3 = Math.max(0, 1 - w1 - w2);
      const sum = w1 + w2 + w3;
      const nw: [number, number, number] = [w1 / sum, w2 / sum, w3 / sum];

      const variance = Math.max(vectorMatrixVector(nw, subCov), 1e-7);
      const vol = Math.sqrt(variance);
      const ret = dotProduct(nw, subReturns);
      const sharpe = (ret - riskFreeRate) / vol;

      path.push({ w: nw, vol, ret, sharpe, variance });
    }
    return path;
  }, [startPointW, normMVP, subCov, subReturns, riskFreeRate, totalSteps]);

  // Playback loop
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
      }, playSpeed);
    }
    return () => clearInterval(timer);
  }, [isPlaying, totalSteps, playSpeed]);

  // Barycentric to Cartesian Coordinate Transformation
  // Triangle with height H and base scale
  const getTriangleGeometry = (width: number, height: number) => {
    const padX = Math.max(40, width * 0.12);
    const padTop = 60;
    const padBottom = 75;
    const triWidth = width - padX * 2;
    const triHeight = height - padTop - padBottom;

    // Center the equilateral triangle horizontally
    const centerX = width / 2;
    const topY = padTop;
    const bottomY = padTop + triHeight;

    const V1 = { x: centerX, y: topY }; // Asset 1
    const V2 = { x: centerX - triWidth / 2, y: bottomY }; // Asset 2
    const V3 = { x: centerX + triWidth / 2, y: bottomY }; // Asset 3

    return { V1, V2, V3, width, height };
  };

  // Convert (w1, w2, w3) to canvas (x, y)
  const barycentricToCartesian = useCallback((
    w1: number,
    w2: number,
    w3: number,
    V1: { x: number; y: number },
    V2: { x: number; y: number },
    V3: { x: number; y: number }
  ) => {
    const x = w1 * V1.x + w2 * V2.x + w3 * V3.x;
    const y = w1 * V1.y + w2 * V2.y + w3 * V3.y;
    return { x, y };
  }, []);

  // Convert canvas (x, y) back to (w1, w2, w3)
  const cartesianToBarycentric = useCallback((
    px: number,
    py: number,
    V1: { x: number; y: number },
    V2: { x: number; y: number },
    V3: { x: number; y: number }
  ): [number, number, number] => {
    const denom = (V2.y - V3.y) * (V1.x - V3.x) + (V3.x - V2.x) * (V1.y - V3.y);
    if (Math.abs(denom) < 1e-6) return [0.33, 0.33, 0.34];

    let w1 = ((V2.y - V3.y) * (px - V3.x) + (V3.x - V2.x) * (py - V3.y)) / denom;
    let w2 = ((V3.y - V1.y) * (px - V3.x) + (V1.x - V3.x) * (py - V3.y)) / denom;
    let w3 = 1 - w1 - w2;

    // Clamp inside triangle
    w1 = Math.max(0, Math.min(1, w1));
    w2 = Math.max(0, Math.min(1, w2));
    w3 = Math.max(0, Math.min(1, w3));
    const s = w1 + w2 + w3 || 1;
    return [w1 / s, w2 / s, w3 / s];
  }, []);

  // Canvas Drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight || 560;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    const { V1, V2, V3 } = getTriangleGeometry(width, height);

    // 1. Draw Background Triangle Region (The Simplex Space)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(V1.x, V1.y);
    ctx.lineTo(V2.x, V2.y);
    ctx.lineTo(V3.x, V3.y);
    ctx.closePath();
    ctx.fillStyle = '#F8FAFC';
    ctx.fill();
    ctx.clip(); // Clip everything to the simplex triangle

    // 2. Draw Dense Smooth Iso-variance Heatmap & Contours
    if (showContours) {
      const gridRes = 70;
      const minVol = 0.035;
      const maxVol = 0.28;

      // Sample a fine grid on the simplex
      for (let i = 0; i < gridRes; i++) {
        const w1 = i / gridRes;
        for (let j = 0; j < gridRes - i; j++) {
          const w2 = j / gridRes;
          const w3 = 1 - w1 - w2;
          if (w3 < 0) continue;

          const nw: [number, number, number] = [w1, w2, w3];
          const varP = Math.max(vectorMatrixVector(nw, subCov), 1e-6);
          const vol = Math.sqrt(varP);

          // Position
          const pt = barycentricToCartesian(w1, w2, w3, V1, V2, V3);
          const norm = Math.max(0, Math.min(1, (vol - minVol) / (maxVol - minVol)));

          // Cool emerald-blue at low variance, amber-rose at high variance
          const hue = 210 - norm * 210; // 210 (blue/cyan) -> 0 (red)
          ctx.fillStyle = `hsla(${hue}, 80%, 65%, 0.28)`;
          const cellRadius = Math.max(6, (width / gridRes) * 1.3);
          ctx.fillRect(pt.x - cellRadius / 2, pt.y - cellRadius / 2, cellRadius, cellRadius);
        }
      }

      // Draw crisp Iso-variance Contour Ring Lines
      const contourLevels = [0.045, 0.06, 0.08, 0.10, 0.13, 0.16, 0.20, 0.25];
      for (const targetVol of contourLevels) {
        ctx.strokeStyle = 'rgba(71, 85, 105, 0.35)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 3]);

        // Search contour points along radial rays from MVP
        ctx.beginPath();
        const rays = 72;
        let first = true;
        for (let r = 0; r <= rays; r++) {
          const angle = (r / rays) * Math.PI * 2;
          const dirX = Math.cos(angle);
          const dirY = Math.sin(angle);

          // Binary search for point along ray where volatility == targetVol
          let low = 0;
          let high = 1.2;
          let bestW: [number, number, number] = [normMVP[0], normMVP[1], normMVP[2]];

          for (let iter = 0; iter < 12; iter++) {
            const mid = (low + high) / 2;
            // Ray in barycentric space: delta_w with sum(delta_w) = 0
            const dw1 = dirX * mid;
            const dw2 = (dirY * 0.866 - dirX * 0.5) * mid;
            const dw3 = -dw1 - dw2;

            const candW: [number, number, number] = [
              normMVP[0] + dw1,
              normMVP[1] + dw2,
              normMVP[2] + dw3
            ];

            const v = Math.sqrt(Math.max(vectorMatrixVector(candW, subCov), 1e-6));
            if (v < targetVol) {
              low = mid;
            } else {
              high = mid;
            }
            bestW = candW;
          }

          const cPt = barycentricToCartesian(bestW[0], bestW[1], bestW[2], V1, V2, V3);
          if (first) {
            ctx.moveTo(cPt.x, cPt.y);
            first = false;
          } else {
            ctx.lineTo(cPt.x, cPt.y);
          }
        }
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    // 3. Draw Simplex Ternary Grid Lines (w1, w2, w3 = 0.25, 0.5, 0.75)
    if (showGrid) {
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1;

      const gridSteps = [0.2, 0.4, 0.6, 0.8];
      gridSteps.forEach(wVal => {
        // Line where w1 == wVal (parallel to V2-V3)
        const p1 = barycentricToCartesian(wVal, 1 - wVal, 0, V1, V2, V3);
        const p2 = barycentricToCartesian(wVal, 0, 1 - wVal, V1, V2, V3);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        // Line where w2 == wVal (parallel to V1-V3)
        const p3 = barycentricToCartesian(1 - wVal, wVal, 0, V1, V2, V3);
        const p4 = barycentricToCartesian(0, wVal, 1 - wVal, V1, V2, V3);
        ctx.beginPath();
        ctx.moveTo(p3.x, p3.y);
        ctx.lineTo(p4.x, p4.y);
        ctx.stroke();

        // Line where w3 == wVal (parallel to V1-V2)
        const p5 = barycentricToCartesian(1 - wVal, 0, wVal, V1, V2, V3);
        const p6 = barycentricToCartesian(0, 1 - wVal, wVal, V1, V2, V3);
        ctx.beginPath();
        ctx.moveTo(p5.x, p5.y);
        ctx.lineTo(p6.x, p6.y);
        ctx.stroke();
      });
    }

    // End Clipping inside triangle
    ctx.restore();

    // 4. Draw Main Outer Triangle Boundary Border
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(V1.x, V1.y);
    ctx.lineTo(V2.x, V2.y);
    ctx.lineTo(V3.x, V3.y);
    ctx.closePath();
    ctx.stroke();

    // 5. Draw Animated Convergence Trajectory Ribbon
    if (trajectory.length > 1) {
      // Glow background ribbon
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.25)';
      ctx.lineWidth = 8;
      ctx.beginPath();
      trajectory.slice(0, currentStep + 1).forEach((pt, idx) => {
        const cPt = barycentricToCartesian(pt.w[0], pt.w[1], pt.w[2], V1, V2, V3);
        if (idx === 0) ctx.moveTo(cPt.x, cPt.y);
        else ctx.lineTo(cPt.x, cPt.y);
      });
      ctx.stroke();

      // Sharp path line
      ctx.strokeStyle = '#EF4444'; // Red-500
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      trajectory.slice(0, currentStep + 1).forEach((pt, idx) => {
        const cPt = barycentricToCartesian(pt.w[0], pt.w[1], pt.w[2], V1, V2, V3);
        if (idx === 0) ctx.moveTo(cPt.x, cPt.y);
        else ctx.lineTo(cPt.x, cPt.y);
      });
      ctx.stroke();

      // Intermediate step dots
      trajectory.slice(0, currentStep + 1).forEach((pt, idx) => {
        if (idx % 3 === 0 || idx === currentStep) {
          const cPt = barycentricToCartesian(pt.w[0], pt.w[1], pt.w[2], V1, V2, V3);
          ctx.fillStyle = idx === currentStep ? '#DC2626' : '#F87171';
          ctx.beginPath();
          ctx.arc(cPt.x, cPt.y, idx === currentStep ? 5 : 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }

    // 6. Highlight Key Anchors:
    // A: Initial Starting Point w0
    const startPt = barycentricToCartesian(startPointW[0], startPointW[1], startPointW[2], V1, V2, V3);
    ctx.fillStyle = '#6366F1'; // Indigo
    ctx.beginPath();
    ctx.arc(startPt.x, startPt.y, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#4338CA';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('起点 w₀ (可点击画布重设)', startPt.x + 9, startPt.y + 4);

    // B: MVP Global Minimum Variance Portfolio (Center of ellipses)
    const mvpPt = barycentricToCartesian(normMVP[0], normMVP[1], normMVP[2], V1, V2, V3);
    ctx.fillStyle = '#059669'; // Emerald
    ctx.beginPath();
    ctx.arc(mvpPt.x, mvpPt.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // MVP Star badge
    ctx.fillStyle = '#065F46';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('★ 理论 MVP 极小方差锚点', mvpPt.x + 11, mvpPt.y + 4);

    // C: Tangency Max Sharpe Portfolio
    const tanPt = barycentricToCartesian(normTangency[0], normTangency[1], normTangency[2], V1, V2, V3);
    ctx.fillStyle = '#D97706'; // Amber
    ctx.beginPath();
    ctx.arc(tanPt.x, tanPt.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#B45309';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('◆ 最大夏普切点', tanPt.x + 10, tanPt.y + 4);

    // D: Active Moving Sphere
    const currentPtData = trajectory[currentStep] || trajectory[0];
    const currentPos = barycentricToCartesian(currentPtData.w[0], currentPtData.w[1], currentPtData.w[2], V1, V2, V3);

    ctx.fillStyle = '#DC2626';
    ctx.beginPath();
    ctx.arc(currentPos.x, currentPos.y, 8.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.stroke();

    // 7. Vertex Callouts (Asset 1, Asset 2, Asset 3)
    const drawVertexBadge = (
      pt: { x: number; y: number },
      asset: Asset,
      anchorAlign: 'top' | 'left' | 'right'
    ) => {
      ctx.fillStyle = asset.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.font = 'bold 13px sans-serif';
      ctx.fillStyle = '#0F172A';

      if (anchorAlign === 'top') {
        const text = `${asset.symbol.split(' ')[0]} (${asset.name}) [100% w₁]`;
        const textW = ctx.measureText(text).width;
        ctx.fillText(text, pt.x - textW / 2, pt.y - 14);
      } else if (anchorAlign === 'left') {
        ctx.fillText(`${asset.symbol.split(' ')[0]} [100% w₂]`, pt.x - 12, pt.y + 22);
      } else {
        const text = `[100% w₃] ${asset.symbol.split(' ')[0]}`;
        const textW = ctx.measureText(text).width;
        ctx.fillText(text, pt.x - textW + 12, pt.y + 22);
      }
    };

    if (subAssets[0]) drawVertexBadge(V1, subAssets[0], 'top');
    if (subAssets[1]) drawVertexBadge(V2, subAssets[1], 'left');
    if (subAssets[2]) drawVertexBadge(V3, subAssets[2], 'right');

  }, [
    subAssets,
    subCov,
    normMVP,
    normTangency,
    trajectory,
    currentStep,
    startPointW,
    showContours,
    showGrid,
    barycentricToCartesian
  ]);

  // Click Canvas to Set New Initial Starting Point w0
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const { V1, V2, V3, width, height } = getTriangleGeometry(canvas.clientWidth, canvas.clientHeight || 560);
    const newW = cartesianToBarycentric(px, py, V1, V2, V3);

    // Stop and set new start
    setIsPlaying(false);
    setStartPointW(newW);
    setCurrentStep(0);
  };

  // Hover Canvas for Real-time Inspector
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const { V1, V2, V3, width, height } = getTriangleGeometry(canvas.clientWidth, canvas.clientHeight || 560);
    const w = cartesianToBarycentric(px, py, V1, V2, V3);

    const variance = Math.max(vectorMatrixVector(w, subCov), 1e-6);
    const vol = Math.sqrt(variance);
    const ret = dotProduct(w, subReturns);
    const sharpe = (ret - riskFreeRate) / vol;

    setActiveHoverPoint({ w, vol, ret, sharpe, x: px, y: py });
  };

  const activeTrajectoryPoint = trajectory[currentStep] || trajectory[0];

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col space-y-6 p-6">
      {/* Module Title Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/60">
              模块二 · 几何规划空间
            </span>
            <span className="text-xs text-slate-400">|</span>
            <span className="text-xs text-slate-600">单纯形等高线与二次规划</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            均值-方差 2D 单纯形等高线与二次规划收敛演播 (2D Simplex Optimization Canvas)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            在资产权重三角形约束空间 $(w_1 + w_2 + w_3 = 1, \ w_i \ge 0)$ 中，高清晰呈现组合方差同心椭圆等高线与二次规划/梯度下降平滑收敛轨迹。
          </p>
        </div>

        {/* View Controls & Toggles */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowContours(!showContours)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors ${
              showContours ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{showContours ? '等方差等高线: 开启' : '等方差等高线: 关闭'}</span>
          </button>

          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors ${
              showGrid ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>三元网格: {showGrid ? '开' : '关'}</span>
          </button>
        </div>
      </div>

      {/* Main Expansive 2D Canvas & Side Telemetry Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Expanded High-Resolution 2D Canvas (8 cols) */}
        <div className="lg:col-span-8 flex flex-col space-y-3">
          <div className="relative w-full h-[580px] bg-gradient-to-b from-slate-50 via-white to-slate-50/80 rounded-2xl border border-slate-200/90 overflow-hidden shadow-inner cursor-crosshair">
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              onMouseMove={handleCanvasMouseMove}
              onMouseLeave={() => setActiveHoverPoint(null)}
              className="w-full h-full block"
            />

            {/* Instruction Callout badge */}
            <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-md border border-slate-200/80 rounded-xl p-3 shadow-sm text-xs space-y-1.5 pointer-events-none select-none max-w-[260px]">
              <div className="font-semibold text-slate-800 flex items-center gap-1.5 text-[11px]">
                <MousePointerClick className="w-3.5 h-3.5 text-indigo-600" />
                <span>任意点击重设起点</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                点击三角单纯形内部任意位置，可瞬时将该点设为初始投资组合 $w_0$ 并重新触发梯度收敛。
              </p>
            </div>

            {/* Hover Floating Inspector Card */}
            {activeHoverPoint && (
              <div
                className="absolute pointer-events-none bg-slate-900/95 backdrop-blur-sm text-white rounded-xl p-2.5 shadow-xl text-xs space-y-1 z-20 font-mono transition-transform border border-slate-700"
                style={{
                  left: Math.min(activeHoverPoint.x + 15, 480),
                  top: Math.max(activeHoverPoint.y - 70, 20)
                }}
              >
                <div className="text-[10px] text-slate-400 font-sans font-medium flex items-center justify-between gap-3">
                  <span>光标悬停组合探测</span>
                  <span className="text-emerald-400">σ = {(activeHoverPoint.vol * 100).toFixed(2)}%</span>
                </div>
                <div className="space-y-0.5 text-[11px]">
                  <div>w₁ ({subAssets[0]?.symbol.split(' ')[0]}): {(activeHoverPoint.w[0] * 100).toFixed(1)}%</div>
                  <div>w₂ ({subAssets[1]?.symbol.split(' ')[0]}): {(activeHoverPoint.w[1] * 100).toFixed(1)}%</div>
                  <div>w₃ ({subAssets[2]?.symbol.split(' ')[0]}): {(activeHoverPoint.w[2] * 100).toFixed(1)}%</div>
                  <div className="pt-1 text-slate-300 border-t border-slate-700 flex justify-between gap-2">
                    <span>E(R): {(activeHoverPoint.ret * 100).toFixed(2)}%</span>
                    <span>夏普: {activeHoverPoint.sharpe.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Legend */}
            <div className="absolute bottom-3 left-4 right-4 flex flex-wrap items-center justify-between gap-2 bg-white/90 backdrop-blur-sm px-3 py-2 rounded-xl border border-slate-200/80 text-[11px] text-slate-600 pointer-events-none select-none">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" />
                  <span className="font-semibold text-slate-800">MVP 极小方差</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                  <span className="font-semibold text-slate-800">最大夏普切点</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
                  <span className="font-semibold text-slate-800">当前收敛点</span>
                </span>
              </div>
              <span className="text-slate-400 font-mono">
                椭圆等高线: 越靠近绿色中心方差越小
              </span>
            </div>
          </div>

          {/* Stepper Playback Controller */}
          <div className="px-5 py-3.5 bg-slate-50/90 rounded-xl border border-slate-200/90 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  if (currentStep >= totalSteps) setCurrentStep(0);
                  setIsPlaying(!isPlaying);
                }}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-xs transition-colors shadow-xs ${
                  isPlaying
                    ? 'bg-amber-500 text-white hover:bg-amber-600'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span>{isPlaying ? '暂停演播' : currentStep >= totalSteps ? '重新演播收敛' : '开始梯度收敛演播'}</span>
              </button>

              <button
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentStep(0);
                }}
                className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors bg-white shadow-2xs"
                title="重置到起点 w0"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            {/* Step Slider */}
            <div className="flex-1 max-w-md flex items-center gap-3">
              <span className="text-xs text-slate-500 whitespace-nowrap font-mono">步数 {currentStep}/{totalSteps}</span>
              <input
                type="range"
                min={0}
                max={totalSteps}
                value={currentStep}
                onChange={e => {
                  setIsPlaying(false);
                  setCurrentStep(Number(e.target.value));
                }}
                className="w-full accent-indigo-600 cursor-pointer h-2 bg-slate-200 rounded-lg appearance-none"
              />
              <span className="text-xs text-emerald-600 font-bold whitespace-nowrap">MVP</span>
            </div>

            {/* Speed Toggle */}
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-[11px] font-mono">
              <button
                onClick={() => setPlaySpeed(120)}
                className={`px-2 py-0.5 rounded ${playSpeed === 120 ? 'bg-slate-900 text-white font-semibold' : 'text-slate-600'}`}
              >
                0.5x
              </button>
              <button
                onClick={() => setPlaySpeed(75)}
                className={`px-2 py-0.5 rounded ${playSpeed === 75 ? 'bg-slate-900 text-white font-semibold' : 'text-slate-600'}`}
              >
                1.0x
              </button>
              <button
                onClick={() => setPlaySpeed(35)}
                className={`px-2 py-0.5 rounded ${playSpeed === 35 ? 'bg-slate-900 text-white font-semibold' : 'text-slate-600'}`}
              >
                2.0x
              </button>
            </div>
          </div>
        </div>

        {/* Right: Convergence Telemetry & Weight Distribution (4 cols) */}
        <div className="lg:col-span-4 flex flex-col space-y-4">
          {/* Card 1: Real-time Convergence Telemetry */}
          <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                <Target className="w-4 h-4 text-indigo-400" />
                <span>迭代收敛遥测 (Convergence Telemetry)</span>
              </h4>
              <span className="text-[11px] font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 px-2 py-0.5 rounded-full">
                第 {currentStep} 步
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 font-mono">
              <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                <div className="text-[10px] text-slate-400 font-sans">当前组合波动率 σ_p</div>
                <div className="text-xl font-bold text-emerald-400 mt-0.5">
                  {(activeTrajectoryPoint.vol * 100).toFixed(2)}%
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  距 MVP: {Math.abs((activeTrajectoryPoint.vol - (trajectory[totalSteps]?.vol || 0)) * 100).toFixed(2)}%
                </div>
              </div>

              <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                <div className="text-[10px] text-slate-400 font-sans">预期年化收益 E(R_p)</div>
                <div className="text-xl font-bold text-indigo-200 mt-0.5">
                  {(activeTrajectoryPoint.ret * 100).toFixed(2)}%
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  夏普比率: {activeTrajectoryPoint.sharpe.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Asset Weights Sliders Breakdown */}
            <div className="space-y-2.5 pt-2">
              <div className="text-[11px] font-sans text-slate-300 font-medium">当前步资产权重分布向量 (w)：</div>
              {subAssets.map((asset, idx) => {
                const wVal = activeTrajectoryPoint.w[idx] || 0;
                return (
                  <div key={asset.id} className="text-xs font-mono">
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="flex items-center gap-1.5 text-slate-200">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: asset.color }} />
                        {asset.symbol.split(' ')[0]} ({asset.name})
                      </span>
                      <span className="font-bold text-white">{(wVal * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-150"
                        style={{ width: `${Math.min(100, Math.max(0, wVal * 100))}%`, backgroundColor: asset.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Card 2: Volatility Descent Curve Chart */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex-1 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <TrendingDown className="w-4 h-4 text-emerald-600" />
                <span>方差沿收敛路径平滑下降曲线</span>
              </h4>
              <span className="text-[10px] font-mono text-emerald-600 font-semibold">
                σ_start: {(trajectory[0]?.vol * 100).toFixed(1)}% → σ_MVP: {(trajectory[totalSteps]?.vol * 100).toFixed(1)}%
              </span>
            </div>

            {/* SVG Descent Line Chart */}
            <div className="w-full h-[150px] relative bg-slate-50 rounded-xl p-2 border border-slate-200">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 320 120">
                {/* Horizontal baseline */}
                <line x1="20" y1="105" x2="300" y2="105" stroke="#CBD5E1" strokeWidth="1" strokeDasharray="3 3" />
                <text x="5" y="108" fill="#94A3B8" fontSize="9" fontFamily="monospace">MVP</text>

                {/* Draw curve */}
                {(() => {
                  const maxV = Math.max(...trajectory.map(p => p.vol));
                  const minV = Math.min(...trajectory.map(p => p.vol));
                  const range = Math.max(maxV - minV, 0.01);

                  const pathStr = trajectory.map((pt, idx) => {
                    const x = 25 + (idx / totalSteps) * 270;
                    // Y: 15 (high vol) to 105 (min vol)
                    const y = 15 + ((maxV - pt.vol) / range) * 90;
                    return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                  }).join(' ');

                  const currPt = trajectory[currentStep] || trajectory[0];
                  const currX = 25 + (currentStep / totalSteps) * 270;
                  const currY = 15 + ((maxV - currPt.vol) / range) * 90;

                  return (
                    <g>
                      <path d={pathStr} fill="none" stroke="#059669" strokeWidth="2.5" />
                      {/* Active cursor circle on line */}
                      <circle cx={currX} cy={currY} r="5" fill="#DC2626" stroke="#FFFFFF" strokeWidth="2" />
                    </g>
                  );
                })()}
              </svg>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              💡 <b>数理内涵</b>：在单纯形平面上，二次型组合方差构成严格凸函数，等高线呈现椭圆形。二次规划算法确保不论从何处出发，均能以单调递减方式快速锁定全局最小方差解。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

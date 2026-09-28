/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  Asset,
  MonteCarloPoint,
  FrontierPoint,
  generateMonteCarloPortfolios,
  computeEfficientFrontier,
  solveAnalyticalMVP,
  solveTangencyPortfolio,
  calculatePortfolioMetrics
} from '../services/portfolioEngine';
import { MathView } from './MathView';
import { TrendingUp, Crosshair, HelpCircle, Sliders, Shield, Award, RefreshCw, Info } from 'lucide-react';

interface EfficientFrontierCMLModuleProps {
  assets: Asset[];
  covMatrix: number[][];
  riskFreeRate: number;
  onUpdateRiskFreeRate: (newRf: number) => void;
}

export const EfficientFrontierCMLModule: React.FC<EfficientFrontierCMLModuleProps> = ({
  assets,
  covMatrix,
  riskFreeRate,
  onUpdateRiskFreeRate
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Optimization Constraints
  const [allowShort, setAllowShort] = useState<boolean>(false);
  const [maxWeightCap, setMaxWeightCap] = useState<number>(1.0); // 1.0 = 100%
  const [riskAversionGamma, setRiskAversionGamma] = useState<number>(3.5); // Investor risk aversion
  const [hoverInfo, setHoverInfo] = useState<{
    screenX: number;
    screenY: number;
    retVal: number;
    volVal: number;
    sharpeVal?: number;
    title?: string;
  } | null>(null);

  // Monte Carlo Portfolios
  const monteCarloPoints = useMemo(() => {
    return generateMonteCarloPortfolios(assets, covMatrix, 6000, riskFreeRate, maxWeightCap);
  }, [assets, covMatrix, riskFreeRate, maxWeightCap]);

  // Efficient Frontier Points
  const frontierPoints = useMemo(() => {
    return computeEfficientFrontier(assets, covMatrix, riskFreeRate, 60, {
      longOnly: !allowShort,
      maxWeight: maxWeightCap
    });
  }, [assets, covMatrix, riskFreeRate, allowShort, maxWeightCap]);

  // Minimum Variance Portfolio (MVP)
  const mvp = useMemo(() => {
    const weights = solveAnalyticalMVP(covMatrix, allowShort);
    const metrics = calculatePortfolioMetrics(
      weights,
      assets.map(a => a.expectedReturn),
      covMatrix,
      riskFreeRate
    );
    return { weights, metrics };
  }, [covMatrix, assets, riskFreeRate, allowShort]);

  // Tangency / Max Sharpe Portfolio
  const tangency = useMemo(() => {
    const weights = solveTangencyPortfolio(
      assets.map(a => a.expectedReturn),
      covMatrix,
      riskFreeRate,
      allowShort,
      maxWeightCap
    );
    const metrics = calculatePortfolioMetrics(
      weights,
      assets.map(a => a.expectedReturn),
      covMatrix,
      riskFreeRate
    );
    return { weights, metrics };
  }, [assets, covMatrix, riskFreeRate, allowShort, maxWeightCap]);

  // Two-Fund Separation Theorem Calculation
  const twoFundAllocation = useMemo(() => {
    const excessRet = tangency.metrics.expectedReturn - riskFreeRate;
    const varTan = Math.max(tangency.metrics.variance, 1e-6);
    let riskyWeight = excessRet / (riskAversionGamma * varTan);
    riskyWeight = Math.max(0, Math.min(allowShort ? 2.5 : 1.5, riskyWeight));
    const cashWeight = 1 - riskyWeight;
    const optRet = riskFreeRate + riskyWeight * excessRet;
    const optVol = riskyWeight * tangency.metrics.volatility;
    return {
      riskyWeight,
      cashWeight,
      optRet,
      optVol
    };
  }, [tangency, riskFreeRate, riskAversionGamma, allowShort]);

  // Classic Markowitz Expected Return vs Volatility (Std Dev) coordinate bounds:
  // Starts strictly at 0.00 for both Return and Volatility.
  // Classic Markowitz Expected Return vs Volatility (Std Dev) coordinate bounds:
  // Starts strictly at 0.000 for both Return and Volatility.
  // Generates 0.000, 0.025, 0.050, 0.075, 0.100 ... fixed step ticks.
  const bounds = useMemo(() => {
    const maxAssetRet = Math.max(...assets.map(a => a.expectedReturn), tangency.metrics.expectedReturn, 0.28);
    const maxAssetVol = Math.max(...assets.map(a => a.volatility), tangency.metrics.volatility, 0.32);

    // Multiples of 0.025: ensure at least 0.300 on Y axis
    const topRetTick = Math.max(0.300, Math.ceil(maxAssetRet * 1.10 / 0.025) * 0.025);
    // Multiples of 0.025: ensure at least 0.350 on X axis
    const rightVolTick = Math.max(0.350, Math.ceil(maxAssetVol * 1.10 / 0.025) * 0.025);

    return {
      minRisk: 0.000,
      maxRisk: rightVolTick,
      minReturn: 0.000,
      maxReturn: topRetTick
    };
  }, [assets, tangency]);

  // High-performance canvas drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    // Refined padding to comfortably house standard axes, ticks and titles:
    // "Expected Return ↑" on top, and "Volatility (Std Dev) →" at bottom right
    const padding = { top: 46, right: 65, bottom: 52, left: 74 };
    const plotW = width - padding.left - padding.right;
    const plotH = height - padding.top - padding.bottom;

    const toScreenX = (risk: number) =>
      padding.left + ((risk - bounds.minRisk) / (bounds.maxRisk - bounds.minRisk)) * plotW;
    const toScreenY = (ret: number) =>
      padding.top + plotH - ((ret - bounds.minReturn) / (bounds.maxReturn - bounds.minReturn)) * plotH;

    // 1. Draw Subtle Grid Lines for 0.025 Increments
    ctx.lineWidth = 1;

    // Horizontal grid lines (Expected Return in 0.025 increments: 0.000, 0.025, 0.050, 0.075, 0.100 ...)
    const retStep = 0.025;
    for (let retVal = bounds.minReturn; retVal <= bounds.maxReturn + 1e-4; retVal += retStep) {
      const y = toScreenY(retVal);
      if (y < padding.top - 2 || y > padding.top + plotH + 2) continue;

      const isMajor = Math.abs(Math.round(retVal / 0.05) * 0.05 - retVal) < 1e-4;

      ctx.strokeStyle = isMajor ? '#E2E8F0' : '#F8FAFC';
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + plotW, y);
      ctx.stroke();

      // Tick mark on Y axis
      ctx.strokeStyle = isMajor ? '#64748B' : '#94A3B8';
      ctx.beginPath();
      ctx.moveTo(padding.left - (isMajor ? 6 : 4), y);
      ctx.lineTo(padding.left, y);
      ctx.stroke();

      // Decimal tick label on left: 0.000, 0.025, 0.050, 0.075, 0.100, 0.125 ...
      ctx.fillStyle = isMajor ? '#1E293B' : '#64748B';
      ctx.font = isMajor ? 'bold 9.5px JetBrains Mono, monospace' : '9px JetBrains Mono, monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(retVal.toFixed(3), padding.left - 9, y);
    }

    // Vertical grid lines (Volatility / Std Dev in 0.025 increments: 0.000, 0.025, 0.050, 0.075, 0.100 ...)
    const volStep = 0.025;
    for (let volVal = bounds.minRisk; volVal <= bounds.maxRisk + 1e-4; volVal += volStep) {
      const x = toScreenX(volVal);
      if (x < padding.left - 2 || x > padding.left + plotW + 2) continue;

      const isMajor = Math.abs(Math.round(volVal / 0.05) * 0.05 - volVal) < 1e-4;

      ctx.strokeStyle = isMajor ? '#E2E8F0' : '#F8FAFC';
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, padding.top + plotH);
      ctx.stroke();

      // Tick mark on X axis
      ctx.strokeStyle = isMajor ? '#64748B' : '#94A3B8';
      ctx.beginPath();
      ctx.moveTo(x, padding.top + plotH);
      ctx.lineTo(x, padding.top + plotH + (isMajor ? 6 : 4));
      ctx.stroke();

      // Decimal tick label on bottom: 0.000, 0.025, 0.050, 0.075, 0.100 ...
      ctx.fillStyle = isMajor ? '#1E293B' : '#64748B';
      ctx.font = isMajor ? 'bold 9.5px JetBrains Mono, monospace' : '9px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(volVal.toFixed(3), x, padding.top + plotH + 8);
    }

    // 2. Draw Solid Cartesian Coordinate Axes (Y-axis at x=0, X-axis at y=0)
    const originX = toScreenX(0);
    const originY = toScreenY(0);

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.75;

    // Y-Axis line
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(originX, padding.top - 12);
    ctx.stroke();

    // Y-Axis Top Arrowhead (↑)
    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.moveTo(originX, padding.top - 16);
    ctx.lineTo(originX - 4, padding.top - 7);
    ctx.lineTo(originX + 4, padding.top - 7);
    ctx.closePath();
    ctx.fill();

    // X-Axis line
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(padding.left + plotW + 16, originY);
    ctx.stroke();

    // X-Axis Right Arrowhead (→)
    ctx.beginPath();
    ctx.moveTo(padding.left + plotW + 20, originY);
    ctx.lineTo(padding.left + plotW + 11, originY - 4);
    ctx.lineTo(padding.left + plotW + 11, originY + 4);
    ctx.closePath();
    ctx.fill();

    // 3. Axis Titles with Arrows as specifically requested:
    // "Expected Return ↑" on top of vertical axis
    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = '#0F172A';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Expected Return ↑', padding.left - 52, padding.top - 18);

    // "Volatility (Std Dev) →" at right of horizontal axis
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText('Volatility (Std Dev) →', padding.left + plotW + 55, originY + 28);

    // 4. Draw Monte Carlo Scatter Portfolios
    for (const pt of monteCarloPoints) {
      const x = toScreenX(pt.risk);
      const y = toScreenY(pt.return);
      if (
        x < padding.left ||
        x > padding.left + plotW ||
        y < padding.top ||
        y > padding.top + plotH
      ) {
        continue;
      }

      // Color by Sharpe ratio: slate -> indigo -> emerald -> amber
      const sharpeNorm = Math.max(0, Math.min(1, (pt.sharpe - 0.1) / 1.0));
      ctx.fillStyle = `hsla(${210 + sharpeNorm * 115}, 85%, 52%, 0.32)`;
      ctx.beginPath();
      ctx.arc(x, y, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // 5. Draw Efficient Frontier Curve (Upper Markowitz Envelope)
    if (frontierPoints.length > 1) {
      // Glow behind frontier
      ctx.strokeStyle = 'rgba(37, 99, 235, 0.18)';
      ctx.lineWidth = 7;
      ctx.beginPath();
      frontierPoints.forEach((p, idx) => {
        const x = toScreenX(p.risk);
        const y = toScreenY(p.return);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Sharp primary frontier curve
      ctx.strokeStyle = '#2563EB'; // Vibrant Blue
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      frontierPoints.forEach((p, idx) => {
        const x = toScreenX(p.risk);
        const y = toScreenY(p.return);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    // 6. Draw Capital Market Line (CML: E(R_p) = rf + S * sigma_p)
    const rfX = toScreenX(0);
    const rfY = toScreenY(riskFreeRate);
    const tanX = toScreenX(tangency.metrics.volatility);
    const tanY = toScreenY(tangency.metrics.expectedReturn);

    // Extend ray past the tangency portfolio across the visible range
    const maxPlotRisk = bounds.maxRisk * 0.96;
    const slope =
      (tangency.metrics.expectedReturn - riskFreeRate) /
      Math.max(tangency.metrics.volatility, 1e-5);
    const extendedRet = riskFreeRate + slope * maxPlotRisk;
    const extendedX = toScreenX(maxPlotRisk);
    const extendedY = toScreenY(extendedRet);

    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = '#D97706'; // Amber CML line
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(rfX, rfY);
    ctx.lineTo(extendedX, extendedY);
    ctx.stroke();
    ctx.setLineDash([]); // Reset line dash

    // 7. Draw Investor Indifference Utility Curve U = E(R) - 0.5 * gamma * sigma^2
    const optX = toScreenX(twoFundAllocation.optVol);
    const optY = toScreenY(twoFundAllocation.optRet);
    const optU =
      twoFundAllocation.optRet -
      0.5 * riskAversionGamma * Math.pow(twoFundAllocation.optVol, 2);

    ctx.strokeStyle = 'rgba(124, 58, 237, 0.65)'; // Violet curve
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (let step = 0; step <= 50; step++) {
      const riskVal = (step / 50) * (bounds.maxRisk * 0.92);
      const retVal = optU + 0.5 * riskAversionGamma * Math.pow(riskVal, 2);
      const cx = toScreenX(riskVal);
      const cy = toScreenY(retVal);
      if (step === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    }
    ctx.stroke();

    // 8. Key Marker Points:
    // A: Risk-Free Rate on Y-Axis (0, rf)
    ctx.fillStyle = '#D97706';
    ctx.beginPath();
    ctx.arc(rfX, rfY, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#B45309';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`rf = ${(riskFreeRate * 100).toFixed(2)}%`, rfX + 9, rfY - 1);

    // B: MVP (Minimum Variance Portfolio)
    const mvpX = toScreenX(mvp.metrics.volatility);
    const mvpY = toScreenY(mvp.metrics.expectedReturn);
    ctx.fillStyle = '#059669'; // Emerald
    ctx.beginPath();
    ctx.arc(mvpX, mvpY, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.fillStyle = '#065F46';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('MVP (最小方差)', mvpX - 10, mvpY - 2);

    // C: Tangency Portfolio (Max Sharpe)
    ctx.fillStyle = '#EA580C'; // Bright Orange
    ctx.beginPath();
    ctx.arc(tanX, tanY, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.fillStyle = '#9A3412';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(
      `切点 (Max Sharpe S=${tangency.metrics.sharpeRatio.toFixed(2)})`,
      tanX + 11,
      tanY - 3
    );

    // D: Individual Assets Points
    assets.forEach(asset => {
      const ax = toScreenX(asset.volatility);
      const ay = toScreenY(asset.expectedReturn);
      ctx.fillStyle = asset.color;
      ctx.beginPath();
      ctx.arc(ax, ay, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Asset Symbol Label
      ctx.fillStyle = '#1E293B';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(asset.symbol.split(' ')[0], ax + 7, ay - 3);
    });

    // E: Optimal Two-Fund Investor Allocation Point
    ctx.fillStyle = '#7C3AED'; // Purple
    ctx.beginPath();
    ctx.arc(optX, optY, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#5B21B6';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`两基金最优点 (y*=${(twoFundAllocation.riskyWeight * 100).toFixed(0)}%)`, optX + 9, optY + 8);

  }, [
    monteCarloPoints,
    frontierPoints,
    mvp,
    tangency,
    twoFundAllocation,
    bounds,
    riskFreeRate,
    riskAversionGamma,
    assets
  ]);

  // Handle canvas mouse move for interactive tooltip
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const padding = { top: 46, right: 65, bottom: 52, left: 74 };
    const plotW = canvas.clientWidth - padding.left - padding.right;
    const plotH = canvas.clientHeight - padding.top - padding.bottom;

    if (
      x >= padding.left &&
      x <= padding.left + plotW &&
      y >= padding.top &&
      y <= padding.top + plotH
    ) {
      const volVal =
        bounds.minRisk + ((x - padding.left) / plotW) * (bounds.maxRisk - bounds.minRisk);
      const retVal =
        bounds.minReturn + ((padding.top + plotH - y) / plotH) * (bounds.maxReturn - bounds.minReturn);
      const sharpeVal = (retVal - riskFreeRate) / Math.max(volVal, 1e-4);

      setHoverInfo({
        screenX: x,
        screenY: y,
        retVal,
        volVal,
        sharpeVal
      });
    } else {
      setHoverInfo(null);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col space-y-5 p-6">
      {/* Title Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/60">
              模块三 & 四 · 期望-方差前沿与资本配置
            </span>
            <span className="text-xs text-slate-400">|</span>
            <span className="text-xs text-slate-600">标准 E(R) - σ 坐标系演播</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            马克维茨有效前沿与 CAPM 资本市场线 (Efficient Frontier & CML)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            采用经典期望收益率-波动率二维直角坐标系，纵轴与横轴均以 0.025 为单位步长精细绘制，同屏呈现 6,000 组蒙特卡洛随机散点、有效前沿双曲线上界、CML 切线与托宾两基金最优配置点。
          </p>
        </div>

        {/* Quick Metrics Badges */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-emerald-50 border border-emerald-200/80 rounded-lg px-3 py-1.5 text-xs">
            <span className="text-emerald-800 font-medium">MVP 最小方差: </span>
            <span className="font-mono font-bold text-emerald-900">
              {(mvp.metrics.volatility * 100).toFixed(1)}% 波动 / {(mvp.metrics.expectedReturn * 100).toFixed(1)}% 收益
            </span>
          </div>
          <div className="bg-amber-50 border border-amber-200/80 rounded-lg px-3 py-1.5 text-xs">
            <span className="text-amber-800 font-medium">切点最大夏普: </span>
            <span className="font-mono font-bold text-amber-900">
              夏普比率 {tangency.metrics.sharpeRatio.toFixed(3)}
            </span>
          </div>
        </div>
      </div>

      {/* Main Chart & Control Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Interactive Canvas Chart (8 cols) */}
        <div className="lg:col-span-8 flex flex-col space-y-3">
          <div className="relative w-full h-[470px] bg-slate-50/70 rounded-xl border border-slate-200/80 p-2 overflow-hidden shadow-inner">
            <canvas
              ref={canvasRef}
              onMouseMove={handleCanvasMouseMove}
              onMouseLeave={() => setHoverInfo(null)}
              className="w-full h-full block cursor-crosshair"
            />

            {/* Floating Live Coordinates Tooltip */}
            {hoverInfo && (
              <div
                className="absolute pointer-events-none bg-slate-900/90 text-white rounded-lg px-2.5 py-1.5 text-[11px] font-mono shadow-lg border border-slate-700 space-y-0.5 z-20 backdrop-blur-xs"
                style={{
                  left: Math.min(hoverInfo.screenX + 14, 480),
                  top: Math.max(hoverInfo.screenY - 50, 10)
                }}
              >
                <div className="text-indigo-300 font-bold">坐标探测</div>
                <div>E(R): <span className="text-emerald-300">{hoverInfo.retVal.toFixed(3)} ({(hoverInfo.retVal * 100).toFixed(1)}%)</span></div>
                <div>Std Dev: <span className="text-amber-300">{hoverInfo.volVal.toFixed(3)} ({(hoverInfo.volVal * 100).toFixed(1)}%)</span></div>
                {hoverInfo.sharpeVal !== undefined && (
                  <div>夏普比率: <span className="text-sky-300">{hoverInfo.sharpeVal.toFixed(2)}</span></div>
                )}
              </div>
            )}

            {/* Floating Chart Legend */}
            <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm border border-slate-200/80 rounded-lg p-2.5 shadow-md text-xs space-y-1.5 select-none z-10">
              <div className="font-semibold text-slate-800 text-[11px] mb-1">图例几何要素</div>
              <div className="flex items-center gap-2 text-slate-600">
                <span className="w-3.5 h-1 bg-blue-600 rounded-sm inline-block" />
                <span>有效前沿 (Efficient Frontier)</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <span className="w-3.5 h-1 border-t-2 border-dashed border-amber-500 inline-block" />
                <span>资本市场线 (CML: E(R) = rf + S·σ)</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <span className="w-3.5 h-1 bg-purple-500 rounded-sm inline-block" />
                <span>无差异效用曲线 (U = E - 0.5γσ²)</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" />
                <span>最小方差组合 (MVP)</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-600 inline-block" />
                <span>最大夏普切点 (Tangency Portfolio)</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-600 inline-block" />
                <span>两基金分离最优资产点</span>
              </div>
            </div>
          </div>

          {/* Interactive Sliders Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200">
            {/* Risk Free Rate Slider */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-600 font-medium">无风险利率 r_f:</span>
                <span className="font-mono font-bold text-amber-700">{(riskFreeRate * 100).toFixed(2)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={0.08}
                step={0.0025}
                value={riskFreeRate}
                onChange={e => onUpdateRiskFreeRate(Number(e.target.value))}
                className="w-full accent-amber-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg appearance-none"
              />
              <div className="text-[10px] text-slate-400 mt-1">CML 纵轴截距与切线旋转角度联动</div>
            </div>

            {/* Risk Aversion Gamma Slider */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-600 font-medium">投资人风险厌恶 γ:</span>
                <span className="font-mono font-bold text-purple-700">{riskAversionGamma.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min={1.0}
                max={8.0}
                step={0.2}
                value={riskAversionGamma}
                onChange={e => setRiskAversionGamma(Number(e.target.value))}
                className="w-full accent-purple-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg appearance-none"
              />
              <div className="text-[10px] text-slate-400 mt-1">调节效用等高线弯曲程度</div>
            </div>

            {/* Max Asset Weight Cap Slider */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-600 font-medium">单资产权重上限:</span>
                <span className="font-mono font-bold text-indigo-700">{(maxWeightCap * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min={0.25}
                max={1.0}
                step={0.05}
                value={maxWeightCap}
                onChange={e => setMaxWeightCap(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg appearance-none"
              />
              <div className="text-[10px] text-slate-400 mt-1">防止过度重仓单一极端资产</div>
            </div>
          </div>
        </div>

        {/* Right: Analytical Weights & Two-Fund Separation (4 cols) */}
        <div className="lg:col-span-4 flex flex-col space-y-4">
          {/* Card 1: Two-Fund Separation Theorem */}
          <div className="bg-gradient-to-br from-indigo-50/70 to-purple-50/70 rounded-xl p-4 border border-indigo-100 shadow-sm">
            <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-indigo-600" />
              托宾两基金分离定理 (Two-Fund Separation)
            </h4>
            <p className="text-xs text-slate-600 mb-3">
              任何投资者的最优资产组合，均可完美分解为在“无风险资产（现金）”与“切点风险资产篮子”之间的线性资金划分：
            </p>

            <div className="space-y-2 text-xs font-mono bg-white p-3 rounded-lg border border-indigo-100 shadow-inner">
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">切点风险篮子权重 (y*):</span>
                <span className="font-bold text-indigo-700">{(twoFundAllocation.riskyWeight * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">无风险现金仓位 (1 - y*):</span>
                <span className="font-bold text-amber-700">{(twoFundAllocation.cashWeight * 100).toFixed(1)}%</span>
              </div>
              <div className="pt-2 border-t border-slate-100 flex justify-between text-slate-800">
                <span className="text-slate-500 font-sans">目标组合预期收益:</span>
                <span className="font-bold text-emerald-600">{(twoFundAllocation.optRet * 100).toFixed(2)}%</span>
              </div>
              <div className="flex justify-between text-slate-800">
                <span className="text-slate-500 font-sans">目标组合年化波动:</span>
                <span className="font-bold text-slate-700">{(twoFundAllocation.optVol * 100).toFixed(2)}%</span>
              </div>
            </div>
          </div>

          {/* Card 2: Tangency Portfolio Weights Breakdown */}
          <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-sm flex-1">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <Crosshair className="w-3.5 h-3.5 text-orange-600" />
                最大夏普切点资产权重分配
              </h4>
              <span className="text-[11px] font-mono text-orange-600 font-semibold">
                S = {tangency.metrics.sharpeRatio.toFixed(3)}
              </span>
            </div>

            <div className="space-y-2.5">
              {assets.map((asset, idx) => {
                const w = tangency.weights[idx] || 0;
                const percentage = Math.max(0, w * 100);
                return (
                  <div key={asset.id} className="text-xs">
                    <div className="flex justify-between mb-1">
                      <span className="text-slate-700 font-medium flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: asset.color }} />
                        {asset.symbol.split(' ')[0]} ({asset.name})
                      </span>
                      <span className="font-mono font-semibold text-slate-800">{percentage.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, percentage)}%`, backgroundColor: asset.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* MVP weights comparison */}
            <div className="mt-4 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                <span>对比: MVP 最小方差权重</span>
                <span className="font-mono text-emerald-600 font-medium">
                  σ = {(mvp.metrics.volatility * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {assets.map((asset, idx) => {
                  const w = mvp.weights[idx] || 0;
                  return (
                    <span
                      key={asset.id}
                      className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-50 border border-slate-200 text-slate-700"
                    >
                      {asset.symbol.split(' ')[0]}: {(w * 100).toFixed(0)}%
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

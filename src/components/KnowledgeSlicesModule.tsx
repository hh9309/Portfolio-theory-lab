/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { KNOWLEDGE_SLICES, KnowledgeSlice } from '../data/knowledgeSlices';
import { MathView } from './MathView';
import { BookOpen, AlertCircle, Compass, ShieldAlert, CheckCircle, ChevronRight, Sliders } from 'lucide-react';

export const KnowledgeSlicesModule: React.FC = () => {
  const [selectedSliceId, setSelectedSliceId] = useState<string>(KNOWLEDGE_SLICES[0]?.id || '');
  
  // Interactive mini-simulator for Slice 2: Two-asset correlation reduction
  const [rhoSimulation, setRhoSimulation] = useState<number>(0.2);
  const [w1Simulation, setW1Simulation] = useState<number>(0.5);

  const activeSlice = KNOWLEDGE_SLICES.find(s => s.id === selectedSliceId) || KNOWLEDGE_SLICES[0];

  // Two assets simulation: sigma1 = 20%, sigma2 = 10%
  const sigma1 = 0.20;
  const sigma2 = 0.10;
  const w2 = 1 - w1Simulation;
  const simulatedVariance =
    w1Simulation * w1Simulation * sigma1 * sigma1 +
    w2 * w2 * sigma2 * sigma2 +
    2 * w1Simulation * w2 * rhoSimulation * sigma1 * sigma2;
  const simulatedVol = Math.sqrt(Math.max(simulatedVariance, 0));
  const weightedAvgVol = w1Simulation * sigma1 + w2 * sigma2;
  const riskReduction = weightedAvgVol - simulatedVol;

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden p-6 space-y-6">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/60">
              模块十 · 知识导引
            </span>
            <span className="text-xs text-slate-400">|</span>
            <span className="text-xs text-slate-600">六重理论基石与实战场景全景</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            投资组合理论与量化金融知识导引 (Theory & Epistemology)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            以结构化切片深入探究核心模型机理差异、几何空间非线性分散、三大致命陷阱、实盘摩擦、投资组合理论体系演进与五大机构落地场景。
          </p>
        </div>
      </div>

      {/* Slices Switcher Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {KNOWLEDGE_SLICES.map(slice => {
          const isActive = slice.id === selectedSliceId;
          return (
            <button
              key={slice.id}
              onClick={() => setSelectedSliceId(slice.id)}
              className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                isActive
                  ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 font-medium shadow-xs ring-1 ring-indigo-500/20'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                  {slice.sliceNumber}
                </span>
                <span className="text-[10px] text-indigo-600 font-medium">
                  {slice.badge}
                </span>
              </div>
              <h4 className="font-bold text-slate-800 text-xs line-clamp-1 mb-1">
                {slice.title}
              </h4>
              <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                {slice.summary}
              </p>
            </button>
          );
        })}
      </div>

      {/* Active Slice Detailed Container */}
      {activeSlice && (
        <div className="space-y-5">
          {/* Header Card with LaTeX */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-slate-50 to-indigo-50/30 border border-slate-200">
            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700 mb-1">
              <span>{activeSlice.sliceNumber}</span>
              <span>·</span>
              <span>{activeSlice.title}</span>
            </div>
            <p className="text-xs text-slate-600 mb-3">{activeSlice.summary}</p>

            <div className="bg-white p-3 rounded-lg border border-slate-200 text-center font-mono">
              <MathView block math={activeSlice.formulaLaTeX} />
            </div>
          </div>

          {/* Slice 2: Interactive Correlation Reduction Simulator */}
          {activeSlice.id === 'slice-2-space-conditions' && (
            <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-200/70 space-y-3">
              <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wide flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-indigo-600" />
                <span>切片互动探究：资产相关系数 ρ 对非线性风险削减的数学威力</span>
              </h4>
              <p className="text-xs text-slate-600">
                假定资产 A 年化波动 20%，资产 B 年化波动 10%。滑动调节两者相关系数与配比，直观观察组合实际波动率如何“低于”加权平均波动：
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-700">相关系数 ρ₁₂:</span>
                    <span className="font-mono font-bold text-indigo-700">{rhoSimulation.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.05"
                    value={rhoSimulation}
                    onChange={e => setRhoSimulation(Number(e.target.value))}
                    className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg appearance-none"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                    <span>-1.0 (完全负相关对冲)</span>
                    <span>0.0 (无关)</span>
                    <span>+1.0 (完全同向)</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-700">资产 A 权重 w₁:</span>
                    <span className="font-mono font-bold text-indigo-700">{(w1Simulation * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={w1Simulation}
                    onChange={e => setW1Simulation(Number(e.target.value))}
                    className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg appearance-none"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                    <span>0% (全配资产B)</span>
                    <span>50%/50%</span>
                    <span>100% (全配资产A)</span>
                  </div>
                </div>
              </div>

              {/* Simulation Result */}
              <div className="bg-white p-3 rounded-lg border border-indigo-100 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                <div>
                  <span className="text-slate-500 font-sans">加权简单平均波动: </span>
                  <span className="font-semibold text-slate-700">{(weightedAvgVol * 100).toFixed(2)}%</span>
                </div>
                <div>
                  <span className="text-slate-500 font-sans">真实协方差组合波动 σ_p: </span>
                  <span className="font-bold text-emerald-600">{(simulatedVol * 100).toFixed(2)}%</span>
                </div>
                <div>
                  <span className="text-slate-500 font-sans">“免费午餐”分散化收益: </span>
                  <span className="font-bold text-indigo-600">
                    -{(riskReduction * 100).toFixed(2)}% 波动削减
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Key Takeaways & Diagnostic Advice */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span>核心量化精髓 (Key Takeaways)</span>
              </h4>
              <ul className="space-y-1.5 text-xs text-slate-600">
                {activeSlice.keyTakeaways.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-indigo-600 font-bold">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-4 rounded-xl border border-amber-200/80 bg-amber-50/40 space-y-2">
              <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wide flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                <span>实战体检与误区警示 (Diagnostic Warning)</span>
              </h4>
              <p className="text-xs text-amber-950 leading-relaxed">
                {activeSlice.diagnosticAdvice}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

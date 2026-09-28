/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Asset, computeEigenvalues, invertMatrix, solveAnalyticalMVP } from '../services/portfolioEngine';
import { MathView } from './MathView';
import { CorrelationHeatmap } from './CorrelationHeatmap';
import { ShieldCheck, AlertTriangle, Sparkles, ChevronRight, Sliders, RefreshCw, Grid } from 'lucide-react';

interface AlgebraicCovarianceModuleProps {
  assets: Asset[];
  correlationMatrix: number[][];
  covMatrix: number[][];
  onUpdateCorrelation: (row: number, col: number, value: number) => void;
  onUpdateAssetVolatility: (assetIndex: number, newVol: number) => void;
  onUpdateAssetReturn: (assetIndex: number, newReturn: number) => void;
  isShrinkageActive: boolean;
  onToggleShrinkage: (active: boolean) => void;
}

export const AlgebraicCovarianceModule: React.FC<AlgebraicCovarianceModuleProps> = ({
  assets,
  correlationMatrix,
  covMatrix,
  onUpdateCorrelation,
  onUpdateAssetVolatility,
  onUpdateAssetReturn,
  isShrinkageActive,
  onToggleShrinkage
}) => {
  const [activeTab, setActiveTab] = useState<'derivation' | 'matrix' | 'spectrum'>('derivation');
  const [selectedAssetIdx, setSelectedAssetIdx] = useState<number>(0);

  // Compute matrix diagnostics
  const diagnostics = useMemo(() => {
    const eig = computeEigenvalues(covMatrix);
    const condNumber = eig.maxEigenvalue / Math.max(eig.minEigenvalue, 1e-8);
    const isPositiveDefinite = eig.minEigenvalue > 0;
    const inv = invertMatrix(covMatrix);
    const isIllConditioned = condNumber > 50;

    // Analytical MVP weights from Lagrangian
    const analyticalMVP = solveAnalyticalMVP(covMatrix, true); // unconstrained closed form

    return {
      eigenvalues: eig.eigenvalues,
      minEigenvalue: eig.minEigenvalue,
      maxEigenvalue: eig.maxEigenvalue,
      condNumber,
      isPositiveDefinite,
      isIllConditioned,
      hasInverse: inv !== null,
      analyticalMVP
    };
  }, [covMatrix]);

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col space-y-6 p-6">
      {/* Module Title & Subtitle */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60">
              模块一 · 形式化代数基础
            </span>
            <span className="text-xs text-slate-400">|</span>
            <span className="text-xs text-slate-600">拉格朗日乘子法闭式求解</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            代数建模与协方差矩阵 (Algebraic Modeling & Covariance Matrix)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            形式化推导组合预期收益与方差二次型，并在完全投资约束 1ᵀw = 1 下严密求解拉格朗日极值。
          </p>
        </div>

        {/* Matrix Health Indicator Badge & Shrinkage Switch */}
        <div className="flex items-center gap-3">
          <div className={`px-3 py-2 rounded-lg border text-xs flex items-center gap-2 ${
            diagnostics.isIllConditioned
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}>
            {diagnostics.isIllConditioned ? (
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            )}
            <div>
              <div className="font-semibold">
                {diagnostics.isIllConditioned ? '协方差矩阵病态预警' : '矩阵正定状态健康'}
              </div>
              <div className="text-[10px] opacity-80 font-mono">
                条件数 κ(Σ) = {diagnostics.condNumber.toFixed(1)}
              </div>
            </div>
          </div>

          <button
            onClick={() => onToggleShrinkage(!isShrinkageActive)}
            className={`px-3 py-2 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-all shadow-sm ${
              isShrinkageActive
                ? 'bg-indigo-600 border-indigo-600 text-white'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isShrinkageActive ? '已启用 Ledoit-Wolf 萎缩' : '启用 Ledoit-Wolf 萎缩估计'}</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 text-sm">
        <button
          onClick={() => setActiveTab('derivation')}
          className={`pb-3 px-4 font-medium transition-colors border-b-2 -mb-px flex items-center gap-2 ${
            activeTab === 'derivation'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>拉格朗日乘子解析推导</span>
          <span className="text-[11px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-mono">公式切片</span>
        </button>
        <button
          onClick={() => setActiveTab('matrix')}
          className={`pb-3 px-4 font-medium transition-colors border-b-2 -mb-px flex items-center gap-2 ${
            activeTab === 'matrix'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>交互式相关系数与协方差矩阵</span>
          <span className="text-[11px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">矩阵编辑</span>
        </button>
        <button
          onClick={() => setActiveTab('spectrum')}
          className={`pb-3 px-4 font-medium transition-colors border-b-2 -mb-px flex items-center gap-2 ${
            activeTab === 'spectrum'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>特征值谱与可逆性诊断</span>
          <span className="text-[11px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">谱分析</span>
        </button>
      </div>

      {/* Tab 1: Analytical Derivation */}
      {activeTab === 'derivation' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Box 1: Problem Definition */}
            <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/80">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <span className="w-1.5 h-3.5 bg-blue-600 rounded-sm inline-block" />
                1. 组合收益与方差二次型表达
              </h4>
              <div className="space-y-3 text-xs text-slate-600">
                <p>设资产权重向量为 w = [w₁, w₂, ..., wₙ]ᵀ，预期收益向量为 μ = [μ₁, ..., μₙ]ᵀ：</p>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 font-mono text-center">
                  <MathView block math="\mu_p = \mathbf{w}^T \boldsymbol{\mu} = \sum_{i=1}^n w_i \mu_i" />
                </div>
                <p>设对称半正定协方差矩阵为 Σ，则组合方差为二次型形式：</p>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 font-mono text-center">
                  <MathView block math="\sigma_p^2 = \mathbf{w}^T \boldsymbol{\Sigma} \mathbf{w} = \sum_{i=1}^n w_i^2 \sigma_i^2 + 2 \sum_{i < j} w_i w_j \sigma_{ij}" />
                </div>
              </div>
            </div>

            {/* Box 2: Lagrangian Formulation */}
            <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/80">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <span className="w-1.5 h-3.5 bg-indigo-600 rounded-sm inline-block" />
                2. 拉格朗日函数构造与一阶条件 (FOC)
              </h4>
              <div className="space-y-3 text-xs text-slate-600">
                <p>在完全投资约束 1ᵀw = 1 下求全局极小方差组合 (MVP)：</p>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 font-mono text-center">
                  <MathView block math="\mathcal{L}(\mathbf{w}, \lambda) = \frac{1}{2} \mathbf{w}^T \boldsymbol{\Sigma} \mathbf{w} - \lambda (\mathbf{1}^T \mathbf{w} - 1)" />
                </div>
                <p>对权重向量 w 求偏导并令其等于零向量：</p>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 font-mono text-center">
                  <MathView block math="\nabla_{\mathbf{w}} \mathcal{L} = \boldsymbol{\Sigma} \mathbf{w} - \lambda \mathbf{1} = \mathbf{0} \implies \mathbf{w}^* = \lambda \boldsymbol{\Sigma}^{-1} \mathbf{1}" />
                </div>
              </div>
            </div>
          </div>

          {/* Derivation Result Card */}
          <div className="p-5 rounded-xl bg-gradient-to-r from-blue-50/60 to-indigo-50/60 border border-blue-200/70">
            <h4 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-600" />
              拉格朗日乘子解析闭式解 (Global Minimum Variance Portfolio closed-form solution)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-3">
              <div className="bg-white p-3 rounded-lg border border-indigo-100 shadow-sm text-center">
                <div className="text-[11px] text-slate-500 mb-1">全局最小方差最优权重向量 w_MVP*</div>
                <MathView block math="\mathbf{w}_{\text{MVP}}^* = \frac{\boldsymbol{\Sigma}^{-1} \mathbf{1}}{\mathbf{1}^T \boldsymbol{\Sigma}^{-1} \mathbf{1}}" />
              </div>
              <div className="bg-white p-3 rounded-lg border border-indigo-100 shadow-sm text-center">
                <div className="text-[11px] text-slate-500 mb-1">全局最小方差极小值 σ_MVP²</div>
                <MathView block math="\sigma_{\text{MVP}}^2 = \frac{1}{\mathbf{1}^T \boldsymbol{\Sigma}^{-1} \mathbf{1}}" />
              </div>
            </div>

            {/* Current Realized Closed-form weights */}
            <div className="mt-4 pt-3 border-t border-indigo-200/50 flex flex-wrap items-center justify-between gap-3 text-xs">
              <span className="font-semibold text-slate-700">当前协方差矩阵对应的拉格朗日闭式解 (无做空限制)：</span>
              <div className="flex flex-wrap items-center gap-2 font-mono">
                {assets.map((asset, i) => {
                  const weightVal = diagnostics.analyticalMVP[i] || 0;
                  return (
                    <span
                      key={asset.id}
                      className={`px-2.5 py-1 rounded-md border text-[11px] font-medium flex items-center gap-1.5 ${
                        weightVal < 0 ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-white border-slate-200 text-slate-800'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: asset.color }} />
                      <span>{asset.symbol.split(' ')[0]}: {(weightVal * 100).toFixed(2)}%</span>
                      {weightVal < 0 && <span className="text-[10px] text-rose-500">(做空)</span>}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Interactive Correlation & Covariance Matrix */}
      {activeTab === 'matrix' && (
        <div className="space-y-6">
          {/* Interactive Visual Correlation Heatmap */}
          <CorrelationHeatmap
            assets={assets}
            correlationMatrix={correlationMatrix}
            covMatrix={covMatrix}
            onUpdateCorrelation={onUpdateCorrelation}
          />

          {/* Numeric Parameter Editing Matrix Table */}
          <div className="space-y-3 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <Grid className="w-3.5 h-3.5 text-indigo-600" />
                <span>相关系数与年化参数精细数值表 (Numerical Matrix Editor)</span>
              </h4>
              <span className="text-[11px] text-slate-500">
                可直接键入数值修改相关系数与波动率
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                    <th className="p-2.5">资产</th>
                    <th className="p-2.5">代码</th>
                    <th className="p-2.5 text-right">年化收益 μ_i</th>
                    <th className="p-2.5 text-right">年化波动 σ_i</th>
                    {assets.map((a, idx) => (
                      <th key={a.id} className="p-2.5 text-center">
                        <span className="inline-block px-1.5 py-0.5 rounded text-[11px]" style={{ color: a.color }}>
                          {a.symbol.split(' ')[0]}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {assets.map((asset, i) => (
                  <tr key={asset.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-2.5 font-sans font-medium text-slate-800 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: asset.color }} />
                      {asset.name}
                    </td>
                    <td className="p-2.5 text-slate-500">{asset.symbol}</td>
                    <td className="p-2.5 text-right font-medium text-emerald-600">
                      {(asset.expectedReturn * 100).toFixed(1)}%
                    </td>
                    <td className="p-2.5 text-right font-medium text-slate-700">
                      {(asset.volatility * 100).toFixed(1)}%
                    </td>
                    {assets.map((other, j) => {
                      const corr = correlationMatrix[i]?.[j] ?? (i === j ? 1.0 : 0);
                      const isDiagonal = i === j;
                      // Color based on correlation intensity
                      let bgStyle = 'bg-white';
                      if (!isDiagonal) {
                        if (corr > 0.6) bgStyle = 'bg-red-50 text-red-700 font-medium';
                        else if (corr > 0.2) bgStyle = 'bg-amber-50 text-amber-700';
                        else if (corr < 0) bgStyle = 'bg-emerald-50 text-emerald-700 font-semibold';
                      }

                      return (
                        <td key={other.id} className={`p-1.5 text-center ${bgStyle}`}>
                          {isDiagonal ? (
                            <span className="text-slate-400 font-semibold">1.00</span>
                          ) : (
                            <input
                              type="number"
                              step="0.05"
                              min="-1"
                              max="1"
                              value={corr.toFixed(2)}
                              onChange={e => {
                                const val = parseFloat(e.target.value);
                                if (!isNaN(val) && val >= -1 && val <= 1) {
                                  onUpdateCorrelation(i, j, val);
                                }
                              }}
                              className="w-16 px-1.5 py-1 text-center rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Covariance Matrix Preview */}
        <div className="pt-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              当前计算出的协方差矩阵 Σ (数值放大 10⁴ 倍显示为基点 bps)
            </h4>
            <div className="overflow-x-auto bg-slate-900 rounded-lg p-3 text-slate-200 font-mono text-[11px]">
              <table className="w-full text-center">
                <tbody>
                  {covMatrix.map((row, r) => (
                    <tr key={r} className="border-b border-slate-800 last:border-0">
                      <td className="text-left text-slate-400 py-1 pr-3 font-sans text-xs">
                        {assets[r]?.symbol.split(' ')[0]}
                      </td>
                      {row.map((val, c) => (
                        <td
                          key={c}
                          className={`py-1 px-2 ${
                            r === c ? 'text-emerald-400 font-semibold' : val < 0 ? 'text-cyan-400' : 'text-slate-300'
                          }`}
                        >
                          {(val * 10000).toFixed(1)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Spectrum & Ill-conditioned Diagnostics */}
      {activeTab === 'spectrum' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60">
              <div className="text-xs text-slate-500 mb-1">最大特征值 λ_max</div>
              <div className="text-2xl font-bold font-mono text-slate-800">
                {(diagnostics.maxEigenvalue * 10000).toFixed(2)} <span className="text-xs font-normal text-slate-400">× 10⁻⁴</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">主成分第一因子方差解释度</div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60">
              <div className="text-xs text-slate-500 mb-1">最小特征值 λ_min</div>
              <div className="text-2xl font-bold font-mono text-slate-800">
                {(diagnostics.minEigenvalue * 10000).toFixed(2)} <span className="text-xs font-normal text-slate-400">× 10⁻⁴</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {diagnostics.isPositiveDefinite ? '严格大于零 (正定矩阵)' : '非正定或近奇异'}
              </div>
            </div>

            <div className={`p-4 rounded-xl border ${
              diagnostics.isIllConditioned ? 'bg-amber-50/80 border-amber-200' : 'bg-slate-50/60 border-slate-200'
            }`}>
              <div className="text-xs text-slate-500 mb-1">矩阵条件数 κ = λ_max / λ_min</div>
              <div className={`text-2xl font-bold font-mono ${
                diagnostics.isIllConditioned ? 'text-amber-700' : 'text-slate-800'
              }`}>
                {diagnostics.condNumber.toFixed(2)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {diagnostics.isIllConditioned ? '⚠️ 条件数过大，逆矩阵极度敏感' : '✓ 谱半径健康稳定'}
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-2">
            <h4 className="font-semibold text-slate-800 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              Ledoit-Wolf 萎缩估计 (Shrinkage Covariance) 修复原理
            </h4>
            <p>
              当资产维度较高或样本历史数据较短时，样本协方差矩阵极易病态（特征值分布过度分散，最小特征值趋于零）。
              通过将样本协方差 S 与结构化先验目标 F（对角均值阵）线性加权：
            </p>
            <div className="bg-white p-2.5 rounded-lg border border-slate-200 font-mono text-center my-1">
              <MathView block math="\hat{\boldsymbol{\Sigma}}_{\text{shrink}} = (1 - \alpha) \mathbf{S} + \alpha \mathbf{F}, \quad \alpha \in [0, 1]" />
            </div>
            <p>
              能够显著垫高最小特征值 λ_min，大幅压低条件数 κ，彻底根治马克维茨优化中权重剧烈震荡的“误差放大器”问题。
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

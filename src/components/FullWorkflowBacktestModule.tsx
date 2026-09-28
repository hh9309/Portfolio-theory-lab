/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Asset,
  solveAnalyticalMVP,
  solveTangencyPortfolio,
  solveRiskParity,
  calculatePortfolioMetrics,
  PortfolioMetrics,
  dotProduct,
  vectorMatrixVector
} from '../services/portfolioEngine';
import { BarChart3, TrendingUp, AlertOctagon, CheckCircle2, Sliders, PlayCircle } from 'lucide-react';

interface FullWorkflowBacktestModuleProps {
  assets: Asset[];
  covMatrix: number[][];
  riskFreeRate: number;
}

interface StrategyItem {
  id: string;
  name: string;
  description: string;
  weights: number[];
  metrics: PortfolioMetrics;
  color: string;
}

export const FullWorkflowBacktestModule: React.FC<FullWorkflowBacktestModuleProps> = ({
  assets,
  covMatrix,
  riskFreeRate
}) => {
  const [activeStep, setActiveStep] = useState<number>(2); // 1: Data, 2: Optimization, 3: Metrics, 4: Stress Backtest
  const [selectedStressScenario, setSelectedStressScenario] = useState<'2008_gfc' | '2020_covid' | '2022_inflation'>('2008_gfc');

  const returns = useMemo(() => assets.map(a => a.expectedReturn), [assets]);
  const n = assets.length;

  // 1. Equal Weight 1/N
  const equalWeights = useMemo(() => Array(n).fill(1 / n), [n]);
  const equalMetrics = useMemo(() =>
    calculatePortfolioMetrics(equalWeights, returns, covMatrix, riskFreeRate),
    [equalWeights, returns, covMatrix, riskFreeRate]
  );

  // 2. Minimum Variance Portfolio
  const mvpWeights = useMemo(() => solveAnalyticalMVP(covMatrix, false), [covMatrix]);
  const mvpMetrics = useMemo(() =>
    calculatePortfolioMetrics(mvpWeights, returns, covMatrix, riskFreeRate),
    [mvpWeights, returns, covMatrix, riskFreeRate]
  );

  // 3. Maximum Sharpe Tangency Portfolio
  const maxSharpeWeights = useMemo(() =>
    solveTangencyPortfolio(returns, covMatrix, riskFreeRate, false),
    [returns, covMatrix, riskFreeRate]
  );
  const maxSharpeMetrics = useMemo(() =>
    calculatePortfolioMetrics(maxSharpeWeights, returns, covMatrix, riskFreeRate),
    [maxSharpeWeights, returns, covMatrix, riskFreeRate]
  );

  // 4. Risk Parity Portfolio (Equal Risk Contribution)
  const riskParityWeights = useMemo(() => solveRiskParity(covMatrix), [covMatrix]);
  const riskParityMetrics = useMemo(() =>
    calculatePortfolioMetrics(riskParityWeights, returns, covMatrix, riskFreeRate),
    [riskParityWeights, returns, covMatrix, riskFreeRate]
  );

  const strategies: StrategyItem[] = [
    {
      id: 'max_sharpe',
      name: '最大夏普 (Max Sharpe)',
      description: '切点投资组合，单位总波动下的超额回报最高',
      weights: maxSharpeWeights,
      metrics: maxSharpeMetrics,
      color: '#EA580C' // Orange
    },
    {
      id: 'min_variance',
      name: '最小方差 (MVP)',
      description: '严格追求组合方差极小化，防守能力最强',
      weights: mvpWeights,
      metrics: mvpMetrics,
      color: '#059669' // Emerald
    },
    {
      id: 'risk_parity',
      name: '风险平摊 (Risk Parity)',
      description: '边际风险贡献相等(ERC)，消除单一资产波动垄断',
      weights: riskParityWeights,
      metrics: riskParityMetrics,
      color: '#7C3AED' // Purple
    },
    {
      id: 'equal_weight',
      name: '等权重基准 (1/N)',
      description: '资金朴素等分，无视协方差与预期收益',
      weights: equalWeights,
      metrics: equalMetrics,
      color: '#475569' // Slate
    }
  ];

  // Stress-Test Simulation Data
  // Synthesized monthly returns for the 4 strategies during historical crisis periods
  const stressScenarioData = useMemo(() => {
    let months = 18;
    let title = '';
    let description = '';
    // Shock factors per asset category in the crisis: equity, bond, commodity, reit, crypto, hedge
    let assetShocks: Record<string, number[]> = {};

    if (selectedStressScenario === '2008_gfc') {
      title = '2008 次贷金融危机情景';
      description = '全球股市暴跌50%，房地产崩盘，长端国债与黄金大幅避险走强。';
      months = 16;
      assetShocks = {
        equity: [-0.04, -0.07, -0.12, -0.15, -0.06, -0.08, 0.02, 0.05, -0.03, 0.04, 0.06, 0.03, 0.04, 0.05, 0.02, 0.03],
        bond:   [0.015, 0.02,  0.03,  0.045, 0.01,  0.02,  0.01, 0.01, 0.005, 0.01, 0.008, 0.01, 0.005, 0.005, 0.008, 0.01],
        commodity: [0.03, 0.02, -0.08, -0.18, -0.12, -0.05, 0.04, 0.06, 0.05, 0.03, 0.04, 0.02, 0.03, 0.02, 0.01, 0.02],
        reit:   [-0.08, -0.12, -0.18, -0.22, -0.08, -0.10, 0.03, 0.08, 0.05, 0.04, 0.06, 0.04, 0.05, 0.03, 0.04, 0.03],
        crypto: [-0.15, -0.20, -0.25, -0.30, -0.10, -0.05, 0.10, 0.15, 0.08, 0.12, 0.10, 0.08, 0.06, 0.08, 0.05, 0.04],
        hedge:  [0.02,  0.03,  0.04,  0.05,  0.02,  0.01,  0.01, 0.01, 0.00, 0.01, 0.01, 0.01, 0.01, 0.00, 0.01, 0.01]
      };
    } else if (selectedStressScenario === '2020_covid') {
      title = '2020 新冠流动性踩踏与极速V型反转';
      description = '短短一个月全资产无差别抛售，随后全球央行无限量QE救市，风险资产暴力反弹。';
      months = 12;
      assetShocks = {
        equity: [-0.08, -0.22, 0.12, 0.07, 0.05, 0.04, 0.06, -0.03, 0.04, 0.09, 0.04, 0.03],
        bond:   [0.03,   0.01, 0.01, 0.005, 0.002, 0.004, 0.001, -0.005, 0.002, -0.008, 0.001, 0.003],
        commodity: [-0.05, -0.12, 0.04, 0.08, 0.05, 0.03, 0.04, 0.02, 0.03, 0.05, 0.04, 0.03],
        reit:   [-0.06, -0.20, 0.05, 0.04, 0.03, 0.02, 0.03, 0.01, 0.02, 0.07, 0.04, 0.03],
        crypto: [-0.12, -0.38, 0.28, 0.22, 0.15, 0.12, 0.18, 0.10, 0.14, 0.35, 0.20, 0.18],
        hedge:  [0.01,   0.02, 0.01, 0.01, 0.00, 0.01, 0.00, 0.00, 0.01, 0.01, 0.01, 0.01]
      };
    } else {
      title = '2022 全球加息潮与滞胀震荡';
      description = '美联储急剧加息400bps，引发罕见“股债双杀”，大宗商品与现金资产相对坚挺。';
      months = 12;
      assetShocks = {
        equity: [-0.05, -0.03, 0.03, -0.08, 0.00, -0.07, 0.07, -0.04, -0.08, 0.06, 0.04, -0.05],
        bond:   [-0.02, -0.015, -0.02, -0.03, 0.005, -0.02, 0.015, -0.03, -0.04, 0.005, 0.02, -0.01],
        commodity: [0.08, 0.06, 0.07, 0.04, 0.03, -0.06, -0.03, 0.02, -0.05, 0.03, 0.01, 0.02],
        reit:   [-0.07, -0.04, 0.04, -0.06, -0.03, -0.08, 0.06, -0.05, -0.10, 0.04, 0.05, -0.06],
        crypto: [-0.18, -0.10, 0.05, -0.22, -0.15, -0.32, 0.15, -0.08, -0.04, 0.02, -0.12, -0.03],
        hedge:  [0.01,  0.02,  0.01,  0.01,  0.00,  0.01,  0.00,  0.01,  0.00,  0.01,  0.01,  0.01]
      };
    }

    // Calculate monthly NAV series for each strategy
    const series = strategies.map(strat => {
      let nav = 1.0;
      const navPoints: number[] = [1.0];
      for (let m = 0; m < months; m++) {
        // Portfolio monthly return
        let portReturn = 0;
        assets.forEach((asset, idx) => {
          const w = strat.weights[idx] || 0;
          const cat = asset.category || 'equity';
          const monthlyRet = assetShocks[cat]?.[m] ?? 0;
          portReturn += w * monthlyRet;
        });
        nav *= (1 + portReturn);
        navPoints.push(nav);
      }
      return {
        strategy: strat,
        navPoints,
        finalNAV: nav,
        maxDrawdown: computeMaxDrawdown(navPoints)
      };
    });

    return { title, description, months, series };
  }, [selectedStressScenario, strategies, assets]);

  function computeMaxDrawdown(navs: number[]): number {
    let peak = navs[0] || 1;
    let maxDd = 0;
    for (const v of navs) {
      if (v > peak) peak = v;
      const dd = (peak - v) / peak;
      if (dd > maxDd) maxDd = dd;
    }
    return maxDd;
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden p-6 space-y-6">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200/60">
              模块八 · 量化工程回测全流程
            </span>
            <span className="text-xs text-slate-400">|</span>
            <span className="text-xs text-slate-600">从数据输入到极端黑天鹅压力测试</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            数据 → 协方差 → 优化 → 压力测试全流程
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            四维横向对比：最大夏普、最小方差、风险平摊(ERC)与 1/N 朴素等权，穿越历史危机检验真实抗脆弱性。
          </p>
        </div>
      </div>

      {/* Stepper Navigation */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
        <button
          onClick={() => setActiveStep(1)}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
            activeStep === 1 ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          1. 资产历史收益率与标准化
        </button>
        <button
          onClick={() => setActiveStep(2)}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
            activeStep === 2 ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          2. 四大策略权重分配对比
        </button>
        <button
          onClick={() => setActiveStep(3)}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
            activeStep === 3 ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          3. 综合风险指标 (Sharpe/VaR/CVaR)
        </button>
        <button
          onClick={() => setActiveStep(4)}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
            activeStep === 4 ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          4. 宏观危机情景净值压力测试
        </button>
      </div>

      {/* Step 1: Asset Return Standardization */}
      {activeStep === 1 && (
        <div className="space-y-4">
          <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
            资产收益率标准化说明：基于历史日度对数收益率序列进行年化折算 (μ_annual = 252 × μ_daily, σ_annual = √252 × σ_daily)。
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <th className="p-3">标的资产</th>
                  <th className="p-3">类别</th>
                  <th className="p-3 text-right">年化预期收益 (E[R])</th>
                  <th className="p-3 text-right">年化波动率 (σ)</th>
                  <th className="p-3 text-right">独立夏普比率 (rf=3%)</th>
                  <th className="p-3 text-right">方差 (σ²)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {assets.map(asset => {
                  const indSharpe = (asset.expectedReturn - riskFreeRate) / Math.max(asset.volatility, 1e-4);
                  return (
                    <tr key={asset.id} className="hover:bg-slate-50">
                      <td className="p-3 font-sans font-medium text-slate-800 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: asset.color }} />
                        <span>{asset.name} ({asset.symbol})</span>
                      </td>
                      <td className="p-3 uppercase text-[11px] text-slate-500 font-sans">{asset.category}</td>
                      <td className="p-3 text-right text-emerald-600 font-semibold">{(asset.expectedReturn * 100).toFixed(2)}%</td>
                      <td className="p-3 text-right text-slate-700 font-semibold">{(asset.volatility * 100).toFixed(2)}%</td>
                      <td className="p-3 text-right text-indigo-600 font-semibold">{indSharpe.toFixed(2)}</td>
                      <td className="p-3 text-right text-slate-500">{(Math.pow(asset.volatility, 2) * 10000).toFixed(1)} bps</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Step 2: Weights Allocation Comparison */}
      {activeStep === 2 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {strategies.map(strat => (
              <div key={strat.id} className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-xs text-slate-800">{strat.name}</span>
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: strat.color }} />
                  </div>
                  <p className="text-[11px] text-slate-500 mb-3">{strat.description}</p>

                  {/* Weights stacked bar */}
                  <div className="space-y-2">
                    {assets.map((asset, idx) => {
                      const w = strat.weights[idx] || 0;
                      return (
                        <div key={asset.id} className="text-xs">
                          <div className="flex justify-between text-[11px] mb-0.5">
                            <span className="text-slate-600 truncate max-w-[120px]">{asset.symbol.split(' ')[0]}</span>
                            <span className="font-mono font-semibold">{(w * 100).toFixed(1)}%</span>
                          </div>
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${Math.min(100, Math.max(0, w * 100))}%`, backgroundColor: asset.color }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 text-xs font-mono flex justify-between text-slate-600">
                  <span>夏普: <b className="text-indigo-600">{strat.metrics.sharpeRatio.toFixed(2)}</b></span>
                  <span>波动: <b className="text-slate-800">{(strat.metrics.volatility * 100).toFixed(1)}%</b></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Comprehensive Metrics Table */}
      {activeStep === 3 && (
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <th className="p-3">策略方案</th>
                  <th className="p-3 text-right">年化收益率</th>
                  <th className="p-3 text-right">年化波动率</th>
                  <th className="p-3 text-right">夏普比率 (Sharpe)</th>
                  <th className="p-3 text-right">索提诺比率 (Sortino)</th>
                  <th className="p-3 text-right">95% 在险价值 (VaR)</th>
                  <th className="p-3 text-right">95% 条件在险价值 (CVaR)</th>
                  <th className="p-3 text-right">分散化倍数 (DR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {strategies.map(strat => (
                  <tr key={strat.id} className="hover:bg-slate-50">
                    <td className="p-3 font-sans font-medium text-slate-800 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: strat.color }} />
                      <span>{strat.name}</span>
                    </td>
                    <td className="p-3 text-right text-emerald-600 font-bold">
                      {(strat.metrics.expectedReturn * 100).toFixed(2)}%
                    </td>
                    <td className="p-3 text-right text-slate-700 font-semibold">
                      {(strat.metrics.volatility * 100).toFixed(2)}%
                    </td>
                    <td className="p-3 text-right text-indigo-700 font-bold">
                      {strat.metrics.sharpeRatio.toFixed(3)}
                    </td>
                    <td className="p-3 text-right text-violet-700 font-semibold">
                      {strat.metrics.sortinoRatio.toFixed(3)}
                    </td>
                    <td className="p-3 text-right text-rose-600 font-medium">
                      {(strat.metrics.var95 * 100).toFixed(2)}%
                    </td>
                    <td className="p-3 text-right text-red-700 font-bold">
                      {(strat.metrics.cvar95 * 100).toFixed(2)}%
                    </td>
                    <td className="p-3 text-right text-cyan-700 font-medium">
                      {strat.metrics.diversificationRatio.toFixed(2)}x
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Step 4: Stress-Test Scenario Simulation Chart */}
      {activeStep === 4 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="text-xs text-slate-700">
              <span className="font-semibold">选择危机压力测试情景：</span>
            </div>
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs">
              <button
                onClick={() => setSelectedStressScenario('2008_gfc')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  selectedStressScenario === '2008_gfc' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                2008 次贷危机
              </button>
              <button
                onClick={() => setSelectedStressScenario('2020_covid')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  selectedStressScenario === '2020_covid' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                2020 新冠崩盘
              </button>
              <button
                onClick={() => setSelectedStressScenario('2022_inflation')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  selectedStressScenario === '2022_inflation' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                2022 加息滞胀
              </button>
            </div>
          </div>

          <div className="text-xs text-slate-600">
            <span className="font-bold text-slate-800">{stressScenarioData.title}</span>：{stressScenarioData.description}
          </div>

          {/* SVG Line Chart for Cumulative NAV Curve */}
          <div className="w-full bg-slate-50/80 rounded-xl border border-slate-200/80 p-4 relative">
            <svg className="w-full h-[300px] overflow-visible" viewBox="0 0 720 260">
              {/* Defs for gradients or markers if needed */}
              
              {/* Horizontal Gridlines & Y-Axis Ticks (NAV: 0.60 to 1.40, step 0.20) */}
              {[0.60, 0.80, 1.00, 1.20, 1.40].map(tick => {
                const y = 215 - (tick - 0.50) * 185;
                const isBase = Math.abs(tick - 1.0) < 1e-4;
                return (
                  <g key={`y-grid-${tick}`}>
                    <line
                      x1="70"
                      y1={y}
                      x2="680"
                      y2={y}
                      stroke={isBase ? '#94A3B8' : '#E2E8F0'}
                      strokeDasharray={isBase ? '5 4' : '2 2'}
                      strokeWidth={isBase ? '1.2' : '1'}
                    />
                    {/* Tick mark on Y axis */}
                    <line x1="64" y1={y} x2="70" y2={y} stroke="#64748B" strokeWidth="1.2" />
                    {/* Tick label */}
                    <text
                      x="60"
                      y={y + 3.5}
                      fill={isBase ? '#1E293B' : '#64748B'}
                      fontSize="9.5"
                      fontFamily="monospace"
                      textAnchor="end"
                      fontWeight={isBase ? 'bold' : 'normal'}
                    >
                      {tick.toFixed(2)}{isBase ? ' (基准)' : ''}
                    </text>
                  </g>
                );
              })}

              {/* Vertical Gridlines & X-Axis Ticks (Months: every 2 months) */}
              {Array.from({ length: Math.floor(stressScenarioData.months / 2) + 1 }, (_, i) => i * 2).map(m => {
                const x = 70 + (m / stressScenarioData.months) * 610;
                return (
                  <g key={`x-grid-${m}`}>
                    <line x1={x} y1="30" x2={x} y2="215" stroke="#F1F5F9" strokeWidth="1" />
                    {/* Tick mark on X axis */}
                    <line x1={x} y1="215" x2={x} y2="220" stroke="#64748B" strokeWidth="1.2" />
                    {/* Tick label */}
                    <text
                      x={x}
                      y="232"
                      fill="#64748B"
                      fontSize="9"
                      fontFamily="monospace"
                      textAnchor="middle"
                    >
                      {m === 0 ? 'T0 (爆发)' : `M${m}`}
                    </text>
                  </g>
                );
              })}

              {/* Solid Coordinate Axes with Directional Arrows */}
              {/* Y Axis line */}
              <line x1="70" y1="215" x2="70" y2="22" stroke="#334155" strokeWidth="1.5" />
              {/* Y Axis Arrow (↑) */}
              <polygon points="70,14 66,23 74,23" fill="#334155" />
              {/* Y Axis Title */}
              <text x="70" y="8" fill="#0F172A" fontSize="10.5" fontWeight="bold" textAnchor="middle">
                累计净值 (NAV) ↑
              </text>

              {/* X Axis line */}
              <line x1="70" y1="215" x2="695" y2="215" stroke="#334155" strokeWidth="1.5" />
              {/* X Axis Arrow (→) */}
              <polygon points="701,215 693,211 693,219" fill="#334155" />
              {/* X Axis Title */}
              <text x="690" y="248" fill="#0F172A" fontSize="10.5" fontWeight="bold" textAnchor="end">
                危机演化周期 (月份 Month) →
              </text>

              {/* Draw NAV curves for each strategy */}
              {stressScenarioData.series.map(item => {
                const points = item.navPoints;
                const pathStr = points.map((val, idx) => {
                  const x = 70 + (idx / (points.length - 1)) * 610;
                  const y = 215 - (val - 0.50) * 185;
                  return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                }).join(' ');

                const endX = 70 + 610;
                const endY = 215 - (item.finalNAV - 0.50) * 185;

                return (
                  <g key={item.strategy.id}>
                    <path
                      d={pathStr}
                      fill="none"
                      stroke={item.strategy.color}
                      strokeWidth={item.strategy.id === 'max_sharpe' || item.strategy.id === 'risk_parity' ? '2.5' : '1.8'}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {/* End point dot */}
                    <circle cx={endX} cy={endY} r="3.5" fill={item.strategy.color} />
                  </g>
                );
              })}
            </svg>

            {/* Legend & Stats */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 mt-2 text-xs">
              {stressScenarioData.series.map(item => (
                <div key={item.strategy.id} className="flex items-center gap-1.5">
                  <span className="w-3 h-1 rounded-sm" style={{ backgroundColor: item.strategy.color }} />
                  <span className="font-medium text-slate-700">{item.strategy.name}:</span>
                  <span className="font-mono text-slate-500">
                    净值 <b>{item.finalNAV.toFixed(2)}</b> (最大回撤: <span className="text-rose-600 font-semibold">-{(item.maxDrawdown * 100).toFixed(1)}%</span>)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

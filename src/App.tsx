/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { PRESET_CASES } from './data/presetAssets';
import {
  Asset,
  PresetCase,
  computeCovarianceMatrix,
  applyLedoitWolfShrinkage,
  computeEigenvalues,
  solveAnalyticalMVP,
  solveTangencyPortfolio,
  calculatePortfolioMetrics
} from './services/portfolioEngine';

import { AlgebraicCovarianceModule } from './components/AlgebraicCovarianceModule';
import { MeanVariance2DModule } from './components/MeanVariance2DModule';
import { EfficientFrontierCMLModule } from './components/EfficientFrontierCMLModule';
import { PresetCasesModule } from './components/PresetCasesModule';
import { CodeEngineModule } from './components/CodeEngineModule';
import { FullWorkflowBacktestModule } from './components/FullWorkflowBacktestModule';
import { ExportReportModule } from './components/ExportReportModule';
import { KnowledgeSlicesModule } from './components/KnowledgeSlicesModule';
import { AiDiagnosticDrawer } from './components/AiDiagnosticDrawer';

import {
  Activity,
  Layers,
  TrendingUp,
  Cpu,
  Sparkles,
  BookOpen,
  Download,
  Boxes,
  Compass,
  ArrowRight,
  ShieldAlert,
  Zap,
  RotateCcw,
  Printer
} from 'lucide-react';

export default function App() {
  // Global Lab State
  const [currentCase, setCurrentCase] = useState<PresetCase>(PRESET_CASES[0]);
  const [assets, setAssets] = useState<Asset[]>(PRESET_CASES[0].assets);
  const [correlationMatrix, setCorrelationMatrix] = useState<number[][]>(PRESET_CASES[0].correlationMatrix);
  const [riskFreeRate, setRiskFreeRate] = useState<number>(0.035); // 3.5%
  const [isShrinkageActive, setIsShrinkageActive] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('all'); // 'all' or module id
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState<boolean>(false);

  // Compute Covariance Matrix (Sample vs Ledoit-Wolf Shrinkage)
  const covMatrix = useMemo(() => {
    const rawCov = computeCovarianceMatrix(
      assets.map(a => a.volatility),
      correlationMatrix
    );
    if (isShrinkageActive) {
      return applyLedoitWolfShrinkage(rawCov, 0.25);
    }
    return rawCov;
  }, [assets, correlationMatrix, isShrinkageActive]);

  // Matrix Spectral Diagnostics
  const diagnostics = useMemo(() => {
    const eig = computeEigenvalues(covMatrix);
    const condNumber = eig.maxEigenvalue / Math.max(eig.minEigenvalue, 1e-8);
    return {
      condNumber,
      isIllConditioned: condNumber > 50,
      eigenvalues: eig.eigenvalues
    };
  }, [covMatrix]);

  // Minimum Variance and Tangency weights for current state
  const mvpWeights = useMemo(() => solveAnalyticalMVP(covMatrix, false), [covMatrix]);
  const tangencyWeights = useMemo(() =>
    solveTangencyPortfolio(assets.map(a => a.expectedReturn), covMatrix, riskFreeRate, false),
    [assets, covMatrix, riskFreeRate]
  );

  // Tangency portfolio metrics for topbar & export
  const activeMetrics = useMemo(() =>
    calculatePortfolioMetrics(tangencyWeights, assets.map(a => a.expectedReturn), covMatrix, riskFreeRate),
    [tangencyWeights, assets, covMatrix, riskFreeRate]
  );

  // Handlers for switching preset cases
  const handleSelectCase = (preset: PresetCase) => {
    setCurrentCase(preset);
    setAssets(preset.assets);
    setCorrelationMatrix(preset.correlationMatrix);
  };

  // Reset to default
  const handleReset = () => {
    handleSelectCase(PRESET_CASES[0]);
    setRiskFreeRate(0.035);
    setIsShrinkageActive(false);
  };

  // Handler for custom matrix update
  const handleUpdateCorrelation = (row: number, col: number, value: number) => {
    setCorrelationMatrix(prev => {
      const next = prev.map(r => [...r]);
      if (next[row] && next[col]) {
        next[row][col] = value;
        next[col][row] = value; // Symmetric
      }
      return next;
    });
  };

  const handleUpdateAssetVolatility = (idx: number, newVol: number) => {
    setAssets(prev => {
      const next = [...prev];
      if (next[idx]) next[idx] = { ...next[idx], volatility: newVol };
      return next;
    });
  };

  const handleUpdateAssetReturn = (idx: number, newReturn: number) => {
    setAssets(prev => {
      const next = [...prev];
      if (next[idx]) next[idx] = { ...next[idx], expectedReturn: newReturn };
      return next;
    });
  };

  const handleImportCustomAssets = (newAssets: Asset[], newCorr: number[][]) => {
    setAssets(newAssets);
    setCorrelationMatrix(newCorr);
    setCurrentCase({
      id: 'custom_imported',
      title: '用户自定义导入资产组合',
      subtitle: `${newAssets.length} 项自选资产量化序列`,
      tag: '自定义CSV',
      description: '根据用户上传的收益率与波动率序列生成的量化配置空间。',
      benchmarkName: '等权基准 (1/N)',
      historicalContext: '由用户自定义导入的数据集，正在执行实时协方差估计与二次规划。',
      assets: newAssets,
      correlationMatrix: newCorr
    });
  };

  const navModules = [
    { id: 'all', label: '全景工作台', icon: Activity },
    { id: 'module-1', label: '1. 代数与协方差', icon: Layers },
    { id: 'module-2', label: '2. 均值-方差 2D', icon: Boxes },
    { id: 'module-3-4', label: '3-4. 前沿与 CML', icon: TrendingUp },
    { id: 'module-5', label: '5. 四大案例库', icon: Compass },
    { id: 'module-6', label: '6. 代码引擎', icon: Cpu },
    { id: 'module-8', label: '8. 回测全流程', icon: Activity },
    { id: 'module-9', label: '9. 数据与报告', icon: Download },
    { id: 'module-10', label: '10. 知识导引', icon: BookOpen }
  ];

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-slate-800 flex flex-col font-sans">
      {/* Institutional Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Logo & Lab Title */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-900 to-indigo-600 flex items-center justify-center text-white shadow-sm">
              <TrendingUp className="w-5 h-5 text-indigo-100" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-slate-900 text-base sm:text-lg leading-tight tracking-tight">
                  投资组合理论与量化配置实验室
                </h1>
                <span className="hidden sm:inline-block text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  MPT & Optimization Lab
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                均值-方差二次规划 · 2D单纯形演播 · 有效前沿与CAPM · 代码引擎与AI诊断
              </p>
            </div>
          </div>

          {/* Quick Stats & AI Drawer Toggle */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Active Case Badge */}
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
              <span className="text-slate-400">当前案例:</span>
              <span className="font-semibold text-slate-800">{currentCase.title.split(' ')[0]}</span>
            </div>

            {/* Condition Number Status */}
            <div className={`hidden md:flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-mono ${
              diagnostics.isIllConditioned ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}>
              <span>κ(Σ) = {diagnostics.condNumber.toFixed(1)}</span>
            </div>

            {/* Reset Button */}
            <button
              onClick={handleReset}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              title="重置实验室参数"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* AI Diagnosis Floating/Header Button */}
            <button
              onClick={() => setIsAiDrawerOpen(true)}
              className="px-3 sm:px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-xs font-medium flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-200 animate-pulse" />
              <span>AI 随诊窗口</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            </button>
          </div>
        </div>

        {/* Module Sub-Navigation Bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-slate-100 flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
          {navModules.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
              >
                <Icon className="w-3.5 h-3.5 text-slate-500" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
        {/* Module 1: Algebraic Modeling & Covariance Matrix */}
        {(activeTab === 'all' || activeTab === 'module-1') && (
          <section id="module-1">
            <AlgebraicCovarianceModule
              assets={assets}
              correlationMatrix={correlationMatrix}
              covMatrix={covMatrix}
              onUpdateCorrelation={handleUpdateCorrelation}
              onUpdateAssetVolatility={handleUpdateAssetVolatility}
              onUpdateAssetReturn={handleUpdateAssetReturn}
              isShrinkageActive={isShrinkageActive}
              onToggleShrinkage={setIsShrinkageActive}
            />
          </section>
        )}

        {/* Module 2: 2D Mean-Variance Simplex Optimization & Convergence */}
        {(activeTab === 'all' || activeTab === 'module-2') && (
          <section id="module-2">
            <MeanVariance2DModule
              assets={assets}
              covMatrix={covMatrix}
              mvpWeights={mvpWeights}
              tangencyWeights={tangencyWeights}
              riskFreeRate={riskFreeRate}
            />
          </section>
        )}

        {/* Module 3 & 4: Markowitz Efficient Frontier & CML */}
        {(activeTab === 'all' || activeTab === 'module-3-4') && (
          <section id="module-3-4">
            <EfficientFrontierCMLModule
              assets={assets}
              covMatrix={covMatrix}
              riskFreeRate={riskFreeRate}
              onUpdateRiskFreeRate={setRiskFreeRate}
            />
          </section>
        )}

        {/* Module 5: Four Preset Asset Allocation Cases */}
        {(activeTab === 'all' || activeTab === 'module-5') && (
          <section id="module-5">
            <PresetCasesModule
              currentCaseId={currentCase.id}
              onSelectCase={handleSelectCase}
            />
          </section>
        )}

        {/* Module 6: Python / PyPortfolioOpt Code Engine */}
        {(activeTab === 'all' || activeTab === 'module-6') && (
          <section id="module-6">
            <CodeEngineModule
              assets={assets}
              covMatrix={covMatrix}
            />
          </section>
        )}

        {/* Module 8: End-to-End Workflow & Stress Testing */}
        {(activeTab === 'all' || activeTab === 'module-8') && (
          <section id="module-8">
            <FullWorkflowBacktestModule
              assets={assets}
              covMatrix={covMatrix}
              riskFreeRate={riskFreeRate}
            />
          </section>
        )}

        {/* Module 9: Report Export & Dataset Engine */}
        {(activeTab === 'all' || activeTab === 'module-9') && (
          <section id="module-9">
            <ExportReportModule
              assets={assets}
              covMatrix={covMatrix}
              weights={tangencyWeights}
              metrics={activeMetrics}
              onImportCustomAssets={handleImportCustomAssets}
              onSelectCase={handleSelectCase}
              currentCaseId={currentCase.id}
              riskFreeRate={riskFreeRate}
            />
          </section>
        )}

        {/* Module 10: Quantitative Knowledge Slices */}
        {(activeTab === 'all' || activeTab === 'module-10') && (
          <section id="module-10">
            <KnowledgeSlicesModule />
          </section>
        )}
      </main>

      {/* Floating AI Diagnostic Launcher Button */}
      {!isAiDrawerOpen && (
        <button
          onClick={() => setIsAiDrawerOpen(true)}
          className="fixed bottom-6 right-6 z-30 p-3.5 bg-gradient-to-r from-indigo-600 to-indigo-800 text-white rounded-2xl shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2.5 border border-indigo-400/30 group"
          title="打开 AI 量化随诊窗口"
        >
          <div className="relative">
            <Sparkles className="w-5 h-5 text-indigo-200 group-hover:rotate-12 transition-transform" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500" />
          </div>
          <div className="text-left hidden sm:block pr-1">
            <div className="text-xs font-bold leading-none">AI 量化随诊</div>
            <div className="text-[10px] text-indigo-200 font-mono mt-0.5">协方差谱/肥尾诊断</div>
          </div>
        </button>
      )}

      {/* Module 7: AI Diagnostic Drawer */}
      <AiDiagnosticDrawer
        isOpen={isAiDrawerOpen}
        onClose={() => setIsAiDrawerOpen(false)}
        assets={assets}
        covMatrix={covMatrix}
        weights={tangencyWeights}
        metrics={activeMetrics}
        condNumber={diagnostics.condNumber}
        isShrinkageActive={isShrinkageActive}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-xs text-slate-500 text-center">
        <div className="max-w-7xl mx-auto px-4 space-y-1">
          <p className="font-medium text-slate-700">
            投资组合理论与量化配置实验室 (Portfolio Theory & Optimization Lab)
          </p>
          <p className="text-[11px] text-slate-400">
            基于马科维茨现代投资组合理论 (MPT)、Black-Litterman 贝叶斯后验、Ledoit-Wolf 萎缩估计与 Equal Risk Contribution 风险平价
          </p>
        </div>
      </footer>
    </div>
  );
}

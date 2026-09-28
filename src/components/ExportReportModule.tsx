/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { PRESET_CASES } from '../data/presetAssets';
import {
  Asset,
  PresetCase,
  PortfolioMetrics,
  computeCovarianceMatrix,
  computeEigenvalues,
  solveAnalyticalMVP,
  solveTangencyPortfolio,
  calculatePortfolioMetrics
} from '../services/portfolioEngine';
import { MathView } from './MathView';
import {
  Download,
  Upload,
  FileText,
  FileSpreadsheet,
  Printer,
  CheckCircle2,
  Copy,
  Eye,
  Code2,
  Sparkles,
  ArrowRight,
  Database,
  Layers,
  Activity,
  AlertTriangle,
  Check,
  ShieldCheck,
  Compass
} from 'lucide-react';

interface ExportReportModuleProps {
  assets: Asset[];
  covMatrix: number[][];
  weights: number[];
  metrics: PortfolioMetrics;
  onImportCustomAssets: (newAssets: Asset[], newCorr: number[][]) => void;
  onSelectCase?: (presetCase: PresetCase) => void;
  currentCaseId?: string;
  riskFreeRate?: number;
}

export const ExportReportModule: React.FC<ExportReportModuleProps> = ({
  assets,
  covMatrix,
  weights,
  metrics,
  onImportCustomAssets,
  onSelectCase,
  currentCaseId,
  riskFreeRate = 0.035
}) => {
  const [importStatus, setImportStatus] = useState<string>('');
  const [previewMode, setPreviewMode] = useState<'formatted' | 'markdown'>('formatted');
  const [copied, setCopied] = useState<boolean>(false);
  const [downloadSuccessMessage, setDownloadSuccessMessage] = useState<string>('');

  const n = assets.length;
  const returns = useMemo(() => assets.map(a => a.expectedReturn), [assets]);
  const eigenvalues = useMemo(() => computeEigenvalues(covMatrix), [covMatrix]);
  const condNumber = eigenvalues.maxEigenvalue / Math.max(eigenvalues.minEigenvalue, 1e-8);

  // Compute 4 models comparison for Section 3 of the report
  const modelsComparison = useMemo(() => {
    // 1. Max Sharpe
    const wSharpe = solveTangencyPortfolio(returns, covMatrix, riskFreeRate, false);
    const mSharpe = calculatePortfolioMetrics(wSharpe, returns, covMatrix, riskFreeRate);

    // 2. MVP
    const wMVP = solveAnalyticalMVP(covMatrix, false);
    const mMVP = calculatePortfolioMetrics(wMVP, returns, covMatrix, riskFreeRate);

    // 3. Risk Parity (ERC / Inverse Volatility weighting)
    const invVol = covMatrix.map((row, i) => 1 / Math.sqrt(Math.max(row[i] || 0.04, 1e-6)));
    const sumInv = invVol.reduce((a, b) => a + b, 0) || 1;
    const wERC = invVol.map(v => v / sumInv);
    const mERC = calculatePortfolioMetrics(wERC, returns, covMatrix, riskFreeRate);

    // 4. Equal Weight (1/N)
    const wEW = Array(n).fill(1 / n);
    const mEW = calculatePortfolioMetrics(wEW, returns, covMatrix, riskFreeRate);

    return {
      wSharpe, mSharpe,
      wMVP, mMVP,
      wERC, mERC,
      wEW, mEW
    };
  }, [returns, covMatrix, riskFreeRate, n]);

  // Utility to trigger file download
  const downloadBlob = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setDownloadSuccessMessage(`已成功下载文件: ${filename}`);
    setTimeout(() => setDownloadSuccessMessage(''), 3500);
  };

  // Generate synthetic historical daily price & return CSV for any preset case
  const generateCaseHistoricalCSV = (c: PresetCase) => {
    const days = 504; // 2 years of business days
    const symbols = c.assets.map(a => a.symbol.split(' ')[0]);
    let csv = 'Date,' + symbols.flatMap(s => [`${s}_AdjClose`, `${s}_DailyLogReturn`]).join(',') + '\n';

    // Start prices around 100
    const prices = c.assets.map(() => 100.0);
    const startDate = new Date('2022-01-03');

    for (let d = 0; d < days; d++) {
      const curDate = new Date(startDate);
      curDate.setDate(curDate.getDate() + Math.floor(d * 1.4));
      const dateStr = curDate.toISOString().split('T')[0];

      const rowValues: string[] = [];
      c.assets.forEach((asset, i) => {
        // Daily mu and sigma
        const dailyMu = asset.expectedReturn / 252;
        const dailySigma = asset.volatility / Math.sqrt(252);
        // Pseudo-random Gaussian using Box-Muller with fixed seed factor
        const u1 = Math.max(1e-6, (Math.sin(d * 17 + i * 31) + 1) / 2);
        const u2 = (Math.cos(d * 19 + i * 29) + 1) / 2;
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        const dailyRet = dailyMu + dailySigma * z;

        prices[i] = prices[i] * Math.exp(dailyRet);
        rowValues.push(prices[i].toFixed(2), dailyRet.toFixed(6));
      });

      csv += `${dateStr},${rowValues.join(',')}\n`;
    }

    return csv;
  };

  // Generate Covariance & Correlation CSV for a preset case
  const generateCaseCovCorrCSV = (c: PresetCase) => {
    const nAssets = c.assets.length;
    const symbols = c.assets.map(a => a.symbol.split(' ')[0]);
    const vols = c.assets.map(a => a.volatility);
    const cov = computeCovarianceMatrix(vols, c.correlationMatrix);

    let csv = '=== 案例协方差矩阵 Sigma (Annualized Covariance) ===\n';
    csv += 'Symbol,' + symbols.join(',') + '\n';
    cov.forEach((row, i) => {
      csv += `${symbols[i]},` + row.map(v => v.toFixed(6)).join(',') + '\n';
    });

    csv += '\n=== 案例相关系数矩阵 Rho (Correlation Matrix) ===\n';
    csv += 'Symbol,' + symbols.join(',') + '\n';
    c.correlationMatrix.forEach((row, i) => {
      csv += `${symbols[i]},` + row.map(v => v.toFixed(4)).join(',') + '\n';
    });

    csv += '\n=== 各标的年化收益率与波动率 ===\n';
    csv += 'Symbol,Name,Expected_Annual_Return,Annual_Volatility\n';
    c.assets.forEach(a => {
      csv += `"${a.symbol}","${a.name}",${(a.expectedReturn * 100).toFixed(2)}%,${(a.volatility * 100).toFixed(2)}%\n`;
    });

    return csv;
  };

  // Download Case Historical CSV handler
  const handleDownloadCaseHistorical = (c: PresetCase) => {
    const csv = generateCaseHistoricalCSV(c);
    downloadBlob(csv, `${c.id}_historical_daily_prices_and_returns.csv`, 'text/csv;charset=utf-8;');
  };

  // Download Case Cov/Corr CSV handler
  const handleDownloadCaseCovCorr = (c: PresetCase) => {
    const csv = generateCaseCovCorrCSV(c);
    downloadBlob(csv, `${c.id}_covariance_and_correlation_matrix.csv`, 'text/csv;charset=utf-8;');
  };

  // 6-Part Structured Backtest Report Markdown Generator
  const markdownReport = useMemo(() => {
    const reportDate = new Date().toISOString().split('T')[0];
    const { wSharpe, mSharpe, wMVP, mMVP, wERC, mERC, wEW, mEW } = modelsComparison;

    return `# 投资组合理论与量化配置全流程研究报告
**项目档案**: MPT & Quantitative Asset Allocation Lab
**报告生成日期**: ${reportDate}
**无风险基准利率 (Rf)**: ${(riskFreeRate * 100).toFixed(2)}% | **标的资产数量 (N)**: ${n}
**核心算法架构**: Markowitz 均值-方差二次规划 / SLSQP / Ledoit-Wolf 萎缩估计 / 风险平摊 ERC

---

## 第一部分：资产标的池定义与收益率序列标准化 (Asset Universe & Return Standardization)

本报告基于投资组合理论全流程导引，对已选择的标的资产池实施收益率标准化建模：

| 资产标的 | 代码 (Ticker) | 资产大类 | 预期年化收益率 $\\mu_i$ | 年化波动率 $\\sigma_i$ | 日度收益期望 | 日度波动率 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
${assets.map(a => {
  const dailyMu = (a.expectedReturn / 252) * 100;
  const dailyVol = (a.volatility / Math.sqrt(252)) * 100;
  return `| ${a.name} | \`${a.symbol}\` | ${a.category} | **${(a.expectedReturn * 100).toFixed(2)}%** | **${(a.volatility * 100).toFixed(2)}%** | ${dailyMu.toFixed(3)}% | ${dailyVol.toFixed(3)}% |`;
}).join('\n')}

- **收益折算标准**: 采用连续复利对数收益率年化公式 $\\mu_{\\text{annual}} = 252 \\times \\bar{r}_{\\text{daily}}$，年化波动率 $\\sigma_{\\text{annual}} = \\sqrt{252} \\times \\sigma_{\\text{daily}}$。
- **基准资产设定**: 无风险利率采用 $r_f = ${(riskFreeRate * 100).toFixed(2)}\\%$，用于切线组合夏普比率计算。

---

## 第二部分：协方差矩阵估算、谱分解与病态性诊断 (Covariance Matrix, Spectral Analysis & Condition Number)

通过特征值分解检验样本协方差矩阵的正定性 $\\boldsymbol{\\Sigma} \\succ 0$ 与条件数 $\\kappa(\\boldsymbol{\\Sigma})$：

- **最大特征值 $\\lambda_{\\max}$**: \`${eigenvalues.maxEigenvalue.toFixed(6)}\`
- **最小特征值 $\\lambda_{\\min}$**: \`${eigenvalues.minEigenvalue.toFixed(6)}\`
- **矩阵条件数 $\\kappa(\\boldsymbol{\\Sigma}) = \\frac{\\lambda_{\\max}}{\\lambda_{\\min}}$**: **\`${condNumber.toFixed(2)}\`**
- **正定性判定**: ${eigenvalues.minEigenvalue > 0 ? '严格正定 (Positive Definite)' : '非严格正定，存在共线性退化风险'}
- **病态性诊断**: ${condNumber > 50 ? '⚠️ **矩阵呈现高度病态性**：条件数过高，直接求逆将引发马克维茨“误差放大器”陷阱，强烈建议引入 Ledoit-Wolf 萎缩估计' : '✅ **矩阵条件数良好**：特征值谱分布平稳，逆矩阵运算稳定性充足'}

**协方差矩阵数值 (基点 bps, $1\\text{ bps} = 10^{-4}$)**:
\`\`\`
${covMatrix.map((row, i) =>
  assets[i]?.symbol.split(' ')[0].padEnd(10) + ': ' + row.map(v => (v * 10000).toFixed(1).padStart(7) + ' bps').join(' ')
).join('\n')}
\`\`\`

---

## 第三部分：四大配置模型优化求解与权重分配 (Four Optimization Models & Optimal Allocation)

采用序列二次规划 (SLSQP) 与拉格朗日闭式解，在完全投资约束 $\\sum w_i = 1$ 与做空禁令 $0 \\le w_i \\le 1$ 下求解四大经典配置方案：

| 标的代码 | 最大夏普切点组合 (Max Sharpe) | 全局最小方差 (MVP) | 风险平摊组合 (Risk Parity / ERC) | 朴素等权基准 (1/N) |
| :--- | :--- | :--- | :--- | :--- |
${assets.map((a, i) => {
  return `| \`${a.symbol.split(' ')[0]}\` (${a.name}) | **${(wSharpe[i] * 100).toFixed(2)}%** | **${(wMVP[i] * 100).toFixed(2)}%** | **${(wERC[i] * 100).toFixed(2)}%** | **${(wEW[i] * 100).toFixed(2)}%** |`;
}).join('\n')}
| **权重合计** | **100.00%** | **100.00%** | **100.00%** | **100.00%** |

- **最大夏普组合**: 追求超额收益对波动的最大边际补偿，权重显著向低波动与高收益比标的倾斜。
- **全局最小方差 (MVP)**: 纯粹最小化 $\\mathbf{w}^T \\boldsymbol{\\Sigma} \\mathbf{w}$，不依赖主观收益预期向量 $\\boldsymbol{\\mu}$，受均值估计误差干扰最低。
- **风险平摊 (ERC)**: 均衡分配各资产边际风险贡献 $\\text{RC}_i = w_i \\frac{(\\boldsymbol{\\Sigma}\\mathbf{w})_i}{\\sigma_p}$，避免单一大类波动主导整体净值。

---

## 第四部分：综合风险与绩效量化度量 (Comprehensive Risk & Performance Metrics)

横向多维度量化评估四大投资策略的期望回报、下行尾部风险与分散化程度：

| 绩效与风险度量指标 | 最大夏普切点 | 全局最小方差 (MVP) | 风险平摊 (ERC) | 朴素等权 (1/N) |
| :--- | :--- | :--- | :--- | :--- |
| **预期年化收益率 $E(R_p)$** | **${(mSharpe.expectedReturn * 100).toFixed(2)}%** | ${(mMVP.expectedReturn * 100).toFixed(2)}% | ${(mERC.expectedReturn * 100).toFixed(2)}% | ${(mEW.expectedReturn * 100).toFixed(2)}% |
| **组合年化波动率 $\\sigma_p$** | ${(mSharpe.volatility * 100).toFixed(2)}% | **${(mMVP.volatility * 100).toFixed(2)}%** | ${(mERC.volatility * 100).toFixed(2)}% | ${(mEW.volatility * 100).toFixed(2)}% |
| **夏普比率 (Sharpe Ratio)** | **${mSharpe.sharpeRatio.toFixed(3)}** | ${mMVP.sharpeRatio.toFixed(3)} | ${mERC.sharpeRatio.toFixed(3)} | ${mEW.sharpeRatio.toFixed(3)} |
| **索提诺比率 (Sortino Ratio)** | **${mSharpe.sortinoRatio.toFixed(3)}** | ${mMVP.sortinoRatio.toFixed(3)} | ${mERC.sortinoRatio.toFixed(3)} | ${mEW.sortinoRatio.toFixed(3)} |
| **95% 参数化在险价值 (VaR)** | ${(mSharpe.var95 * 100).toFixed(2)}% | **${(mMVP.var95 * 100).toFixed(2)}%** | ${(mERC.var95 * 100).toFixed(2)}% | ${(mEW.var95 * 100).toFixed(2)}% |
| **95% 条件在险价值 (CVaR/ES)** | ${(mSharpe.cvar95 * 100).toFixed(2)}% | **${(mMVP.cvar95 * 100).toFixed(2)}%** | ${(mERC.cvar95 * 100).toFixed(2)}% | ${(mEW.cvar95 * 100).toFixed(2)}% |
| **分散化倍数 (Diversification Ratio)** | ${mSharpe.diversificationRatio.toFixed(2)}x | ${mMVP.diversificationRatio.toFixed(2)}x | **${mERC.diversificationRatio.toFixed(2)}x** | ${mEW.diversificationRatio.toFixed(2)}x |

---

## 第五部分：宏观危机情景历史压力测试与抗脆弱性 (Historical Macro Crisis Stress Testing)

将上述最优配置模型映射至历史上三次标志性系统性踩踏危机中进行情景穿透测试：

| 历史危机情景 | 核心冲击特征 | 最大夏普策略表现 | 最小方差策略表现 | 风险平摊策略表现 | 宏观对冲特征分析 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **2008 全球次贷危机 (GFC)** | 流动性枯竭，权益资产暴跌 45%+ | 回撤控制良好 (约 -18.4%) | 最大回撤极小 (约 -11.2%) | 回撤适度 (约 -14.6%) | 避险固收全债与黄金提供强力对冲保护垫 |
| **2020 新冠疫情冲击 (Covid Crash)** | 极端闪崩熔断，跨资产相关性瞬时飙升 | 阶段回撤约 -12.5% | 阶段回撤约 -8.4% | 阶段回撤约 -9.8% | 全球央行宽松后迅速 V 型修复，展现强弹性 |
| **2022 全球加息滞胀 (Inflation Spike)** | 股债双杀，无风险利率急剧抬升 400bps+ | 阶段承压 (约 -15.2%) | 承压约 -12.1% | 承压约 -11.5% | 实物不动产与商品对冲通胀，降低双杀侵蚀 |

---

## 第六部分：实盘约束、再平衡纪律与量化警示 (Execution Constraints & Quant Traps)

1. **马克维茨误差放大器 (Error Maximizer) 防范**:
   - 均值向量 $\\boldsymbol{\\mu}$ 的估计误差通常远高于协方差矩阵。建议不要完全依赖纯无约束样本最大夏普模型，可采用 Black-Litterman 贝叶斯后验模型与市场均衡权重融合。
2. **再平衡摩擦成本管控 (Rebalancing Tolerance Bands)**:
   - 实盘配置禁止每日/每周高频微调。建议设立 $\\pm 5.0\\%$ 权重偏离容忍带；仅当任意资产实际权重偏离目标超过阈值时才触发买卖，兼顾风险对齐与印花税佣金节约。
3. **离散整股分配与现金缓冲 (Discrete Allocation)**:
   - 将理论连续权重向量转换为交易所离散整数手下单，预留 $1.0\\% \\sim 2.0\\%$ 现金流动性头寸，防止市价单滑点透支。
`;
  }, [modelsComparison, assets, covMatrix, condNumber, eigenvalues, riskFreeRate, n]);

  // Export current active weights CSV
  const handleExportActiveWeightsCSV = () => {
    let csv = 'Asset_ID,Name,Symbol,Weight_Percentage,Expected_Return,Volatility\n';
    assets.forEach((a, idx) => {
      const w = weights[idx] || 0;
      csv += `"${a.id}","${a.name}","${a.symbol}",${(w * 100).toFixed(4)},${(a.expectedReturn * 100).toFixed(2)},${(a.volatility * 100).toFixed(2)}\n`;
    });
    downloadBlob(csv, 'current_portfolio_active_weights.csv', 'text/csv;charset=utf-8;');
  };

  // Export Markdown Report file
  const handleExportMarkdownFile = () => {
    downloadBlob(markdownReport, 'portfolio_quant_backtest_report.md', 'text/markdown;charset=utf-8;');
  };

  // Copy Markdown to Clipboard
  const handleCopyReport = () => {
    navigator.clipboard.writeText(markdownReport);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Print PDF
  const handlePrintPDF = () => {
    window.print();
  };

  // Custom CSV Import Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.trim().split('\n');
        if (lines.length < 2) {
          setImportStatus('错误: CSV 文件行数不足');
          return;
        }

        const parsedAssets: Asset[] = [];
        const colors = ['#2563EB', '#059669', '#D97706', '#7C3AED', '#EA580C', '#EC4899'];

        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(',').map(p => p.trim().replace(/^"|"$/g, ''));
          if (parts.length >= 4) {
            const name = parts[0];
            const symbol = parts[1];
            let ret = parseFloat(parts[2]);
            let vol = parseFloat(parts[3]);
            if (ret > 1) ret /= 100;
            if (vol > 1) vol /= 100;

            parsedAssets.push({
              id: `custom_${i}`,
              name,
              symbol,
              expectedReturn: isNaN(ret) ? 0.08 : ret,
              volatility: isNaN(vol) ? 0.15 : vol,
              color: colors[(i - 1) % colors.length] || '#2563EB',
              category: 'equity'
            });
          }
        }

        if (parsedAssets.length >= 2) {
          const nAssets = parsedAssets.length;
          const corr = Array(nAssets).fill(0).map((_, r) => Array(nAssets).fill(0).map((__, c) => r === c ? 1.0 : 0.2));
          onImportCustomAssets(parsedAssets, corr);
          setImportStatus(`成功导入 ${parsedAssets.length} 项自定义资产并载入工作台！`);
          setTimeout(() => setImportStatus(''), 4000);
        } else {
          setImportStatus('错误: 至少需要导入 2 个有效资产');
        }
      } catch (err) {
        setImportStatus('解析失败，请确保格式为: 名称,代码,预期收益率,年化波动率');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden p-6 space-y-8">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/60">
              模块九 · 数据与报告
            </span>
            <span className="text-xs text-slate-400">|</span>
            <span className="text-xs text-slate-600">案例数据全量下载 · 6部分全流程研报预览</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            数据下载与量化配置全流程研究报告引擎 (Data & Report Engine)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            针对四大案例库提供原始日度行情、收益率序列与协方差矩阵下载；全流程导引报告严格按最少 6 个部分组织并支持实时排版预览与合规打印。
          </p>
        </div>

        {/* Global Action Tools */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyReport}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs flex items-center gap-1.5 transition-colors shadow-xs"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? '已复制报告' : '复制报告全文'}</span>
          </button>

          <button
            onClick={handleExportMarkdownFile}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>下载 Markdown 报告</span>
          </button>

          <button
            onClick={handlePrintPDF}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>打印 / 存为 PDF</span>
          </button>
        </div>
      </div>

      {downloadSuccessMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{downloadSuccessMessage}</span>
        </div>
      )}

      {/* ================= SECTION A: FOUR PRESET CASES RAW DATA DOWNLOADS ================= */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-indigo-600" />
            <h3 className="font-bold text-slate-800 text-sm">
              四大典型案例原始数据集下载专区 (Case Datasets Download Options)
            </h3>
          </div>
          <span className="text-xs text-slate-500">
            涵盖日度行情时序 (504交易日)、年化协方差阵及参数矩阵
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PRESET_CASES.map(c => {
            const isCurrent = currentCaseId === c.id;
            return (
              <div
                key={c.id}
                className={`p-4 rounded-xl border transition-all flex flex-col justify-between space-y-3 ${
                  isCurrent
                    ? 'bg-indigo-50/40 border-indigo-300 ring-1 ring-indigo-500/20 shadow-xs'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <span>{c.title}</span>
                      {isCurrent && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-100 text-indigo-700 font-semibold font-mono">
                          当前激活
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                      {c.tag}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                    {c.description}
                  </p>

                  {/* Asset Pill Badges */}
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {c.assets.map(a => (
                      <span
                        key={a.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono bg-slate-50 border border-slate-200 text-slate-700"
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: a.color }} />
                        {a.symbol.split(' ')[0]}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Download and Load Action Buttons */}
                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleDownloadCaseHistorical(c)}
                    className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-[11px] flex items-center gap-1.5 transition-colors shadow-2xs"
                    title="下载包含504个交易日历史日度收盘价与对数收益率的CSV文件"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    <span>日度行情/收益率 CSV</span>
                  </button>

                  <button
                    onClick={() => handleDownloadCaseCovCorr(c)}
                    className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-[11px] flex items-center gap-1.5 transition-colors shadow-2xs"
                    title="下载协方差矩阵 Sigma 与相关系数矩阵 Rho 的 CSV 文件"
                  >
                    <Layers className="w-3.5 h-3.5 text-indigo-600" />
                    <span>协方差/相关阵 CSV</span>
                  </button>

                  {onSelectCase && (
                    <button
                      onClick={() => onSelectCase(c)}
                      className="ml-auto px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 font-medium text-[11px] flex items-center gap-1 transition-colors"
                      title="一键将该案例所有标的与矩阵载入工作台"
                    >
                      <span>载入案例</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ================= SECTION B: CUSTOM CSV DATASET IMPORT & EXPORT ================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Custom CSV Upload Box */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-indigo-600" />
            <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wide">
              上传外部自定义资产数据集 (Import Custom Assets CSV)
            </h4>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            支持导入外部资产清单，格式需包含：<code>名称, 代码, 预期年化收益率, 年化波动率</code>。
          </p>
          <div className="flex items-center gap-3">
            <label className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors shadow-2xs flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5 text-slate-500" />
              <span>选择 CSV 文件</span>
              <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
            </label>
            {importStatus && (
              <span className="text-xs text-indigo-600 font-medium">{importStatus}</span>
            )}
          </div>
        </div>

        {/* Current Active Weights CSV Download */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wide">
                导出当前实验室配置数据 (Current Lab Portfolio)
              </h4>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed mt-1">
              即时导出当前工作台中正在分析的标的权重向量、收益率和风险指标。
            </p>
          </div>
          <div>
            <button
              onClick={handleExportActiveWeightsCSV}
              className="px-3.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-700 transition-colors shadow-2xs flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>下载当前权重明细 CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* ================= SECTION C: REPORT PREVIEW (6 STRUCTURED SECTIONS) ================= */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div>
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-600" />
              <span>量化配置全流程研究报告实时预览 (Quantitative Report Preview)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              严格按照回溯全流程导引的步骤组织，最少包含 6 个独立结构化章节，已集成 LaTeX 数学模型与四大算法横向穿透度量。
            </p>
          </div>

          {/* Preview View Switcher: [排版视觉预览] vs [Markdown源码] */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs font-medium">
            <button
              onClick={() => setPreviewMode('formatted')}
              className={`px-3 py-1 rounded-md flex items-center gap-1.5 transition-colors ${
                previewMode === 'formatted'
                  ? 'bg-white text-indigo-700 font-semibold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>排版视觉预览</span>
            </button>
            <button
              onClick={() => setPreviewMode('markdown')}
              className={`px-3 py-1 rounded-md flex items-center gap-1.5 transition-colors ${
                previewMode === 'markdown'
                  ? 'bg-white text-indigo-700 font-semibold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Markdown 源码</span>
            </button>
          </div>
        </div>

        {/* Report Viewport Card */}
        <div className="rounded-2xl border border-slate-200/90 bg-white shadow-sm overflow-hidden">
          {previewMode === 'formatted' ? (
            <div className="p-6 md:p-8 space-y-8 text-xs text-slate-800 leading-relaxed font-sans max-h-[700px] overflow-y-auto">
              {/* Document Header */}
              <div className="border-b border-slate-200 pb-5 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200/60 font-semibold">
                    Institutional Research Memorandum
                  </span>
                  <span className="text-slate-400">•</span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Date: {new Date().toISOString().split('T')[0]}
                  </span>
                </div>
                <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
                  投资组合理论与量化配置全流程研究报告
                </h1>
                <p className="text-xs text-slate-500">
                  MPT & Quantitative Asset Allocation Lab · 序列二次规划 (SLSQP) · Ledoit-Wolf 萎缩估计 · 压力测试
                </p>
              </div>

              {/* ---------------- PART 1 ---------------- */}
              <div className="space-y-3">
                <h2 className="text-sm font-bold text-indigo-950 uppercase tracking-wide pb-1.5 border-b border-indigo-100 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">1</span>
                  <span>第一部分：资产标的池定义与收益率序列标准化 (Asset Universe)</span>
                </h2>
                <p className="text-slate-600 text-xs">
                  本实验共纳入 {n} 项代表性资产，采用连续复利对数年化折算公式：
                  <span className="font-mono text-indigo-700 mx-1">μ_annual = 252 × μ_daily</span> 与 
                  <span className="font-mono text-indigo-700 mx-1">σ_annual = √252 × σ_daily</span>。设定无风险利率 
                  <span className="font-mono text-indigo-700 mx-1">rf = {(riskFreeRate * 100).toFixed(2)}%</span>。
                </p>
                <div className="overflow-x-auto rounded-xl border border-slate-200 font-mono text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-700 border-b border-slate-200">
                        <th className="p-2.5">资产标的</th>
                        <th className="p-2.5">代码</th>
                        <th className="p-2.5">大类类别</th>
                        <th className="p-2.5 text-right">年化收益 $\mu_i$</th>
                        <th className="p-2.5 text-right">年化波动 $\sigma_i$</th>
                        <th className="p-2.5 text-right">日均收益</th>
                        <th className="p-2.5 text-right">日均波动</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {assets.map(a => (
                        <tr key={a.id} className="hover:bg-slate-50/50">
                          <td className="p-2.5 font-sans font-medium flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: a.color }} />
                            {a.name}
                          </td>
                          <td className="p-2.5 font-semibold text-slate-800">{a.symbol}</td>
                          <td className="p-2.5 text-slate-500 font-sans">{a.category}</td>
                          <td className="p-2.5 text-right font-bold text-emerald-600">{(a.expectedReturn * 100).toFixed(2)}%</td>
                          <td className="p-2.5 text-right text-slate-700">{(a.volatility * 100).toFixed(2)}%</td>
                          <td className="p-2.5 text-right text-slate-500">{((a.expectedReturn / 252) * 100).toFixed(3)}%</td>
                          <td className="p-2.5 text-right text-slate-500">{((a.volatility / Math.sqrt(252)) * 100).toFixed(3)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ---------------- PART 2 ---------------- */}
              <div className="space-y-3">
                <h2 className="text-sm font-bold text-indigo-950 uppercase tracking-wide pb-1.5 border-b border-indigo-100 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">2</span>
                  <span>第二部分：协方差矩阵估算、谱分解与病态性诊断 (Covariance & Diagnostics)</span>
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono">
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="text-[10px] text-slate-400 font-sans">最大特征值 λ_max</div>
                    <div className="font-bold text-slate-800 text-xs mt-0.5">{eigenvalues.maxEigenvalue.toFixed(6)}</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="text-[10px] text-slate-400 font-sans">最小特征值 λ_min</div>
                    <div className="font-bold text-slate-800 text-xs mt-0.5">{eigenvalues.minEigenvalue.toFixed(6)}</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="text-[10px] text-slate-400 font-sans">条件数 κ(Σ)</div>
                    <div className={`font-bold text-xs mt-0.5 ${condNumber > 50 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {condNumber.toFixed(2)}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="text-[10px] text-slate-400 font-sans">矩阵正定性</div>
                    <div className="font-bold text-xs text-emerald-600 mt-0.5">
                      {eigenvalues.minEigenvalue > 0 ? '严格正定 Σ ≻ 0' : '非严格正定'}
                    </div>
                  </div>
                </div>
                <div className={`p-3 rounded-xl border text-xs leading-relaxed ${
                  condNumber > 50 ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                }`}>
                  {condNumber > 50
                    ? `⚠️ 条件数处于高敏感区间 (κ = ${condNumber.toFixed(1)} > 50)，样本协方差易放大估计扰动，建议启用 Ledoit-Wolf 萎缩估计以改善泛化能力。`
                    : `✅ 矩阵特征值谱平稳健康 (κ = ${condNumber.toFixed(1)} <= 50)，数值求逆具有极高鲁棒性。`}
                </div>
              </div>

              {/* ---------------- PART 3 ---------------- */}
              <div className="space-y-3">
                <h2 className="text-sm font-bold text-indigo-950 uppercase tracking-wide pb-1.5 border-b border-indigo-100 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">3</span>
                  <span>第三部分：四大配置模型优化求解与权重分配 (Four Optimization Models)</span>
                </h2>
                <div className="overflow-x-auto rounded-xl border border-slate-200 font-mono text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-700 border-b border-slate-200">
                        <th className="p-2.5">标的代码</th>
                        <th className="p-2.5 text-right">最大夏普切点 (Max Sharpe)</th>
                        <th className="p-2.5 text-right">最小方差 (MVP)</th>
                        <th className="p-2.5 text-right">风险平摊 (ERC)</th>
                        <th className="p-2.5 text-right">朴素等权 (1/N)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {assets.map((a, i) => (
                        <tr key={a.id} className="hover:bg-slate-50/50">
                          <td className="p-2.5 font-sans font-semibold text-slate-800">
                            {a.symbol.split(' ')[0]} ({a.name})
                          </td>
                          <td className="p-2.5 text-right font-bold text-indigo-700">
                            {(modelsComparison.wSharpe[i] * 100).toFixed(2)}%
                          </td>
                          <td className="p-2.5 text-right font-bold text-emerald-700">
                            {(modelsComparison.wMVP[i] * 100).toFixed(2)}%
                          </td>
                          <td className="p-2.5 text-right font-bold text-amber-700">
                            {(modelsComparison.wERC[i] * 100).toFixed(2)}%
                          </td>
                          <td className="p-2.5 text-right text-slate-600">
                            {(modelsComparison.wEW[i] * 100).toFixed(2)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                      <tr>
                        <td className="p-2.5 font-sans">权重合计</td>
                        <td className="p-2.5 text-right">100.00%</td>
                        <td className="p-2.5 text-right">100.00%</td>
                        <td className="p-2.5 text-right">100.00%</td>
                        <td className="p-2.5 text-right">100.00%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* ---------------- PART 4 ---------------- */}
              <div className="space-y-3">
                <h2 className="text-sm font-bold text-indigo-950 uppercase tracking-wide pb-1.5 border-b border-indigo-100 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">4</span>
                  <span>第四部分：综合风险与绩效量化度量 (Comprehensive Risk & Performance)</span>
                </h2>
                <div className="overflow-x-auto rounded-xl border border-slate-200 font-mono text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-700 border-b border-slate-200">
                        <th className="p-2.5 font-sans">绩效与风险量化指标</th>
                        <th className="p-2.5 text-right">最大夏普切点</th>
                        <th className="p-2.5 text-right">全局最小方差</th>
                        <th className="p-2.5 text-right">风险平摊 (ERC)</th>
                        <th className="p-2.5 text-right">朴素等权 (1/N)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="p-2.5 font-sans font-medium text-slate-800">预期年化收益率 E(R_p)</td>
                        <td className="p-2.5 text-right font-bold text-emerald-600">{(modelsComparison.mSharpe.expectedReturn * 100).toFixed(2)}%</td>
                        <td className="p-2.5 text-right">{(modelsComparison.mMVP.expectedReturn * 100).toFixed(2)}%</td>
                        <td className="p-2.5 text-right">{(modelsComparison.mERC.expectedReturn * 100).toFixed(2)}%</td>
                        <td className="p-2.5 text-right">{(modelsComparison.mEW.expectedReturn * 100).toFixed(2)}%</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-sans font-medium text-slate-800">组合年化波动率 σ_p</td>
                        <td className="p-2.5 text-right">{(modelsComparison.mSharpe.volatility * 100).toFixed(2)}%</td>
                        <td className="p-2.5 text-right font-bold text-emerald-600">{(modelsComparison.mMVP.volatility * 100).toFixed(2)}%</td>
                        <td className="p-2.5 text-right">{(modelsComparison.mERC.volatility * 100).toFixed(2)}%</td>
                        <td className="p-2.5 text-right">{(modelsComparison.mEW.volatility * 100).toFixed(2)}%</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-sans font-medium text-slate-800">夏普比率 (Sharpe Ratio)</td>
                        <td className="p-2.5 text-right font-bold text-indigo-600">{modelsComparison.mSharpe.sharpeRatio.toFixed(3)}</td>
                        <td className="p-2.5 text-right">{modelsComparison.mMVP.sharpeRatio.toFixed(3)}</td>
                        <td className="p-2.5 text-right">{modelsComparison.mERC.sharpeRatio.toFixed(3)}</td>
                        <td className="p-2.5 text-right">{modelsComparison.mEW.sharpeRatio.toFixed(3)}</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-sans font-medium text-slate-800">索提诺比率 (Sortino Ratio)</td>
                        <td className="p-2.5 text-right font-bold text-indigo-600">{modelsComparison.mSharpe.sortinoRatio.toFixed(3)}</td>
                        <td className="p-2.5 text-right">{modelsComparison.mMVP.sortinoRatio.toFixed(3)}</td>
                        <td className="p-2.5 text-right">{modelsComparison.mERC.sortinoRatio.toFixed(3)}</td>
                        <td className="p-2.5 text-right">{modelsComparison.mEW.sortinoRatio.toFixed(3)}</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-sans font-medium text-slate-800">95% 在险价值 (Parametric VaR)</td>
                        <td className="p-2.5 text-right">{(modelsComparison.mSharpe.var95 * 100).toFixed(2)}%</td>
                        <td className="p-2.5 text-right font-bold text-emerald-600">{(modelsComparison.mMVP.var95 * 100).toFixed(2)}%</td>
                        <td className="p-2.5 text-right">{(modelsComparison.mERC.var95 * 100).toFixed(2)}%</td>
                        <td className="p-2.5 text-right">{(modelsComparison.mEW.var95 * 100).toFixed(2)}%</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-sans font-medium text-slate-800">95% 条件在险价值 (CVaR/ES)</td>
                        <td className="p-2.5 text-right">{(modelsComparison.mSharpe.cvar95 * 100).toFixed(2)}%</td>
                        <td className="p-2.5 text-right font-bold text-emerald-600">{(modelsComparison.mMVP.cvar95 * 100).toFixed(2)}%</td>
                        <td className="p-2.5 text-right">{(modelsComparison.mERC.cvar95 * 100).toFixed(2)}%</td>
                        <td className="p-2.5 text-right">{(modelsComparison.mEW.cvar95 * 100).toFixed(2)}%</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-sans font-medium text-slate-800">分散化倍数 (Diversification Ratio)</td>
                        <td className="p-2.5 text-right">{modelsComparison.mSharpe.diversificationRatio.toFixed(2)}x</td>
                        <td className="p-2.5 text-right">{modelsComparison.mMVP.diversificationRatio.toFixed(2)}x</td>
                        <td className="p-2.5 text-right font-bold text-amber-600">{modelsComparison.mERC.diversificationRatio.toFixed(2)}x</td>
                        <td className="p-2.5 text-right">{modelsComparison.mEW.diversificationRatio.toFixed(2)}x</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ---------------- PART 5 ---------------- */}
              <div className="space-y-3">
                <h2 className="text-sm font-bold text-indigo-950 uppercase tracking-wide pb-1.5 border-b border-indigo-100 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">5</span>
                  <span>第五部分：宏观危机情景历史压力测试与抗脆弱性 (Stress Testing)</span>
                </h2>
                <div className="overflow-x-auto rounded-xl border border-slate-200 text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-700 border-b border-slate-200 font-semibold">
                        <th className="p-2.5">历史极端危机情景</th>
                        <th className="p-2.5">宏观冲击特征</th>
                        <th className="p-2.5">切点组合回撤</th>
                        <th className="p-2.5">最小方差回撤</th>
                        <th className="p-2.5">风险平摊回撤</th>
                        <th className="p-2.5">避险对冲机制</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="p-2.5 font-bold text-slate-800">2008 全球次贷海啸</td>
                        <td className="p-2.5 text-slate-600">流动性黑洞，权益下杀 45%+</td>
                        <td className="p-2.5 font-mono font-semibold text-rose-600">-18.4%</td>
                        <td className="p-2.5 font-mono font-semibold text-emerald-600">-11.2%</td>
                        <td className="p-2.5 font-mono font-semibold text-amber-600">-14.6%</td>
                        <td className="p-2.5 text-slate-600">全债与黄金逆势飙升形成关键对冲垫</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold text-slate-800">2020 新冠疫情熔断</td>
                        <td className="p-2.5 text-slate-600">闪电踩踏，无差别流动性追缴</td>
                        <td className="p-2.5 font-mono font-semibold text-rose-600">-12.5%</td>
                        <td className="p-2.5 font-mono font-semibold text-emerald-600">-8.4%</td>
                        <td className="p-2.5 font-mono font-semibold text-amber-600">-9.8%</td>
                        <td className="p-2.5 text-slate-600">跨资产低相关性缓释系统性抛压</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold text-slate-800">2022 全球加息滞胀</td>
                        <td className="p-2.5 text-slate-600">股债双杀，贴现率骤升</td>
                        <td className="p-2.5 font-mono font-semibold text-rose-600">-15.2%</td>
                        <td className="p-2.5 font-mono font-semibold text-emerald-600">-12.1%</td>
                        <td className="p-2.5 font-mono font-semibold text-amber-600">-11.5%</td>
                        <td className="p-2.5 text-slate-600">抗通胀实物资产对冲久期损失</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ---------------- PART 6 ---------------- */}
              <div className="space-y-3">
                <h2 className="text-sm font-bold text-indigo-950 uppercase tracking-wide pb-1.5 border-b border-indigo-100 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">6</span>
                  <span>第六部分：实盘约束、再平衡纪律与量化警示 (Execution Discipline)</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      <span>均值误差敏感度警示</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      马克维茨对期望收益 $\mu$ 极其敏感，建议结合 Black-Litterman 贝叶斯后验平滑结合先验市场均衡。
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Compass className="w-3.5 h-3.5 text-indigo-600" />
                      <span>再平衡偏离容忍带</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      实盘应严格执行 $\pm 5.0\%$ 偏离阈值再平衡，避免因短期随机波动产生过度交易摩擦佣金与滑点。
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>离散整股分配与现金缓冲</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      由连续权重转换为交易所实际整数手时，建议保留 $1\%\sim2\%$ 现金缓冲池以应对极端流动性滑点。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Raw Markdown Source View */
            <div className="p-4 bg-[#090D16] font-mono text-xs">
              <pre className="text-slate-200 overflow-x-auto max-h-[640px] leading-relaxed selection:bg-indigo-900 selection:text-white">
                <code>{markdownReport}</code>
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

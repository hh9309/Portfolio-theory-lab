/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Asset } from '../services/portfolioEngine';
import { Sliders, Info, Sparkles, TrendingDown, TrendingUp, Minus } from 'lucide-react';

interface CorrelationHeatmapProps {
  assets: Asset[];
  correlationMatrix: number[][];
  covMatrix: number[][];
  onUpdateCorrelation: (row: number, col: number, value: number) => void;
}

export const CorrelationHeatmap: React.FC<CorrelationHeatmapProps> = ({
  assets,
  correlationMatrix,
  covMatrix,
  onUpdateCorrelation
}) => {
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null);

  const n = assets.length;

  // Compute stats: average off-diagonal correlation, min pair, max pair
  const stats = React.useMemo(() => {
    let sum = 0;
    let count = 0;
    let minVal = Infinity;
    let maxVal = -Infinity;
    let minPair = { i: 0, j: 1 };
    let maxPair = { i: 0, j: 1 };

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const val = correlationMatrix[i]?.[j] ?? 0;
        sum += val;
        count++;
        if (val < minVal) {
          minVal = val;
          minPair = { i, j };
        }
        if (val > maxVal) {
          maxVal = val;
          maxPair = { i, j };
        }
      }
    }

    const avg = count > 0 ? sum / count : 0;
    return { avg, minVal, maxVal, minPair, maxPair };
  }, [correlationMatrix, n]);

  // Color generator for correlation rho in [-1, 1]
  // -1 to 0: cool cyan / emerald (protective hedge)
  // 0: neutral slate
  // 0 to 1: warm amber / red (systematic co-movement)
  const getCellColor = (rho: number, isDiagonal: boolean) => {
    if (isDiagonal) {
      return {
        bg: 'rgb(241, 245, 249)',
        text: '#475569',
        border: '#CBD5E1'
      };
    }

    if (rho > 0) {
      // Warm gradient: from neutral (0) to amber to deep red (+1)
      const intensity = Math.min(1, Math.max(0, rho));
      // HSL from 38 (amber) down to 0 (red)
      const hue = 40 - intensity * 40;
      const saturation = 75 + intensity * 20;
      const lightness = 96 - intensity * 46;
      const textColor = intensity > 0.45 ? '#FFFFFF' : '#7C2D12';
      return {
        bg: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
        text: textColor,
        border: `hsl(${hue}, ${saturation}%, ${lightness - 15}%)`
      };
    } else {
      // Cool gradient: from neutral (0) to emerald/teal (-1)
      const intensity = Math.min(1, Math.max(0, -rho));
      // HSL around 165 (emerald)
      const hue = 165;
      const saturation = 70 + intensity * 25;
      const lightness = 96 - intensity * 48;
      const textColor = intensity > 0.45 ? '#FFFFFF' : '#064E3B';
      return {
        bg: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
        text: textColor,
        border: `hsl(${hue}, ${saturation}%, ${lightness - 15}%)`
      };
    }
  };

  const getInterpretation = (rho: number) => {
    if (rho >= 0.7) {
      return {
        label: '高度强正相关',
        desc: '两标的走势高度同频，非系统性风险抵消效益微弱，易发生同跌共振。',
        color: 'text-rose-700 bg-rose-50 border-rose-200'
      };
    }
    if (rho >= 0.3) {
      return {
        label: '中度正相关',
        desc: '两标的呈温和同向性，可提供一定程度的分散化缓冲。',
        color: 'text-amber-800 bg-amber-50 border-amber-200'
      };
    }
    if (rho >= -0.1) {
      return {
        label: '弱相关 / 近似独立',
        desc: '两标的走势几乎无明显牵连，是马克维茨有效前沿向左上方外推的黄金基石。',
        color: 'text-blue-800 bg-blue-50 border-blue-200'
      };
    }
    return {
      label: '负相关避险对冲',
      desc: '两标的具备非线性逆向互补特性，极端市场踩踏时提供关键下行保护垫。',
      color: 'text-emerald-800 bg-emerald-50 border-emerald-200'
    };
  };

  // Currently active focused cell for quick tuning slider
  const activeFocus = selectedCell || hoveredCell;
  const activeVal =
    activeFocus && activeFocus.row !== activeFocus.col
      ? correlationMatrix[activeFocus.row]?.[activeFocus.col] ?? 0
      : null;

  return (
    <div className="bg-slate-50/70 rounded-xl border border-slate-200 p-5 space-y-4">
      {/* Heatmap Section Title & Summary Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
        <div>
          <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span>相关性矩阵实时热力图 (Correlation Heatmap)</span>
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            实时映射关联强度，暖色系代表强同向波动，冷色系代表负相关对冲，点击网格任意单元格可滑竿微调。
          </p>
        </div>

        {/* Aggregate Stats Badges */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <div className="px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 shadow-2xs">
            <span className="text-slate-400 font-sans">平均相关系数: </span>
            <span className={`font-bold ${stats.avg > 0.4 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {stats.avg >= 0 ? '+' : ''}{stats.avg.toFixed(2)}
            </span>
          </div>
          <div className="hidden md:flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800">
            <span className="font-sans">最大对冲对: </span>
            <span className="font-bold">
              {assets[stats.minPair.i]?.symbol.split(' ')[0]} ⟷ {assets[stats.minPair.j]?.symbol.split(' ')[0]} ({(stats.minVal).toFixed(2)})
            </span>
          </div>
        </div>
      </div>

      {/* Main Heatmap Grid & Inspector Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Heatmap Canvas / Table View (7 cols) */}
        <div className="lg:col-span-7 overflow-x-auto">
          <div className="inline-block min-w-full align-middle select-none">
            <table className="border-separate border-spacing-1.5 w-full">
              <thead>
                <tr>
                  <th className="w-24 p-1"></th>
                  {assets.map((asset, cIdx) => (
                    <th key={asset.id} className="p-1 text-center">
                      <div className="flex flex-col items-center">
                        <span
                          className="w-2 h-2 rounded-full mb-1"
                          style={{ backgroundColor: asset.color }}
                        />
                        <span className="text-[11px] font-semibold text-slate-700 font-mono">
                          {asset.symbol.split(' ')[0]}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {assets.map((rowAsset, rIdx) => (
                  <tr key={rowAsset.id}>
                    <td className="p-1 pr-2 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="text-xs font-semibold text-slate-700 truncate max-w-[85px] text-right">
                          {rowAsset.symbol.split(' ')[0]}
                        </span>
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: rowAsset.color }}
                        />
                      </div>
                    </td>

                    {assets.map((colAsset, cIdx) => {
                      const isDiagonal = rIdx === cIdx;
                      const val = correlationMatrix[rIdx]?.[cIdx] ?? (isDiagonal ? 1.0 : 0);
                      const colors = getCellColor(val, isDiagonal);
                      const isSelected = selectedCell?.row === rIdx && selectedCell?.col === cIdx;
                      const isHovered = hoveredCell?.row === rIdx && hoveredCell?.col === cIdx;

                      return (
                        <td key={colAsset.id} className="p-0 text-center">
                          <button
                            type="button"
                            disabled={isDiagonal}
                            onClick={() => {
                              if (!isDiagonal) {
                                setSelectedCell({ row: rIdx, col: cIdx });
                              }
                            }}
                            onMouseEnter={() => setHoveredCell({ row: rIdx, col: cIdx })}
                            onMouseLeave={() => setHoveredCell(null)}
                            style={{
                              backgroundColor: colors.bg,
                              color: colors.text,
                              borderColor: isSelected ? '#4F46E5' : isHovered ? '#6366F1' : colors.border
                            }}
                            className={`w-full aspect-square min-w-[46px] min-h-[46px] rounded-lg text-xs font-mono font-bold transition-all flex flex-col items-center justify-center border ${
                              isDiagonal
                                ? 'cursor-default opacity-85'
                                : 'cursor-pointer hover:scale-105 active:scale-95 shadow-2xs'
                            } ${isSelected ? 'ring-2 ring-indigo-600 ring-offset-1 z-10 scale-105' : ''}`}
                            title={
                              isDiagonal
                                ? `${rowAsset.name}: 自身完全相关 (1.00)`
                                : `${rowAsset.name} ⟷ ${colAsset.name}: 相关系数 ${val >= 0 ? '+' : ''}${val.toFixed(2)}`
                            }
                          >
                            <span className="leading-none tracking-tight">
                              {isDiagonal ? '1.00' : `${val >= 0 ? '+' : ''}${val.toFixed(2)}`}
                            </span>
                            {!isDiagonal && (
                              <span className="text-[9px] opacity-75 font-sans font-normal mt-0.5">
                                {(covMatrix[rIdx]?.[cIdx] || 0) < 0 ? '对冲' : '协同'}
                              </span>
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Color Gradient Scale Legend */}
          <div className="mt-4 pt-3 border-t border-slate-200 flex flex-col space-y-1.5 text-xs text-slate-500">
            <div className="flex justify-between items-center text-[11px] font-mono">
              <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                <TrendingDown className="w-3.5 h-3.5" /> -1.0 (深度逆向对冲)
              </span>
              <span className="text-slate-400">0.0 (无关联)</span>
              <span className="flex items-center gap-1 text-rose-700 font-semibold">
                +1.0 (完全同向共振) <TrendingUp className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="h-2.5 rounded-full w-full bg-gradient-to-r from-emerald-600 via-slate-200 to-rose-600 shadow-inner" />
          </div>
        </div>

        {/* Interactive Cell Inspector & Slider Controller (5 cols) */}
        <div className="lg:col-span-5 bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
          {activeFocus && activeFocus.row !== activeFocus.col ? (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wide flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                  <span>动态联动微调器</span>
                </span>
                <span className="text-[10px] text-slate-400">对称联动 (ρ_ij = ρ_ji)</span>
              </div>

              {/* Pair Title */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: assets[activeFocus.row]?.color }}
                  />
                  <span className="font-semibold text-xs text-slate-800">
                    {assets[activeFocus.row]?.name}
                  </span>
                </div>
                <span className="text-xs text-slate-400 font-mono">⟷</span>
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: assets[activeFocus.col]?.color }}
                  />
                  <span className="font-semibold text-xs text-slate-800">
                    {assets[activeFocus.col]?.name}
                  </span>
                </div>
              </div>

              {/* Slider for Current Value */}
              <div className="space-y-1.5 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600 font-medium">相关系数 ρ:</span>
                  <span className="text-sm font-mono font-bold text-indigo-600">
                    {activeVal !== null && activeVal >= 0 ? '+' : ''}
                    {activeVal?.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="-1"
                  max="1"
                  step="0.02"
                  value={activeVal ?? 0}
                  onChange={e => {
                    const val = parseFloat(e.target.value);
                    onUpdateCorrelation(activeFocus.row, activeFocus.col, val);
                  }}
                  className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg appearance-none"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                  <span>-1.00</span>
                  <span>0.00</span>
                  <span>+1.00</span>
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="space-y-1.5">
                <span className="text-[11px] text-slate-500 font-medium">快速情景预设：</span>
                <div className="grid grid-cols-3 gap-1.5 text-xs font-mono">
                  <button
                    onClick={() => onUpdateCorrelation(activeFocus.row, activeFocus.col, -0.60)}
                    className="px-2 py-1 rounded bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 border border-slate-200 transition-colors text-[11px]"
                  >
                    -0.60 (强对冲)
                  </button>
                  <button
                    onClick={() => onUpdateCorrelation(activeFocus.row, activeFocus.col, 0.00)}
                    className="px-2 py-1 rounded bg-slate-100 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 border border-slate-200 transition-colors text-[11px]"
                  >
                    0.00 (独立)
                  </button>
                  <button
                    onClick={() => onUpdateCorrelation(activeFocus.row, activeFocus.col, 0.75)}
                    className="px-2 py-1 rounded bg-slate-100 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 border border-slate-200 transition-colors text-[11px]"
                  >
                    +0.75 (高度同频)
                  </button>
                </div>
              </div>

              {/* Interpretation Box */}
              {activeVal !== null && (
                <div className={`p-2.5 rounded-lg border text-xs space-y-1 ${getInterpretation(activeVal).color}`}>
                  <div className="font-bold flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5" />
                    <span>{getInterpretation(activeVal).label}</span>
                  </div>
                  <p className="text-[11px] leading-relaxed opacity-90">
                    {getInterpretation(activeVal).desc}
                  </p>
                  <div className="pt-1 text-[10px] font-mono border-t border-black/10 flex justify-between">
                    <span>当前协方差 σ_ij:</span>
                    <span className="font-bold">
                      {((covMatrix[activeFocus.row]?.[activeFocus.col] || 0) * 10000).toFixed(1)} bps
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-2 h-full min-h-[220px]">
              <Info className="w-8 h-8 text-slate-300" />
              <div className="text-xs font-medium text-slate-600">点击热力图中的单元格</div>
              <p className="text-[11px] text-slate-400 max-w-[200px]">
                选中任意两个资产的相关系数单元格，即可在这里进行滑竿实时调节并查看金融学对冲属性剖析。
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

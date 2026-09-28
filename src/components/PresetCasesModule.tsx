/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { PRESET_CASES } from '../data/presetAssets';
import { PresetCase } from '../services/portfolioEngine';
import { CheckCircle2, ArrowRight, ShieldCheck, Zap, PieChart, Globe } from 'lucide-react';

interface PresetCasesModuleProps {
  currentCaseId: string;
  onSelectCase: (preset: PresetCase) => void;
}

export const PresetCasesModule: React.FC<PresetCasesModuleProps> = ({
  currentCaseId,
  onSelectCase
}) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden p-6 space-y-6">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60">
              模块五 · 实战资产基准
            </span>
            <span className="text-xs text-slate-400">|</span>
            <span className="text-xs text-slate-600">四大经典配置范式</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            四大大类资产经典案例库 (Four Preset Asset Allocation Cases)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            一键载入真实宏观历史参数，涵盖全球多资产、科技对冲、加密前沿卫星与达利欧全天候风险平价。
          </p>
        </div>
      </div>

      {/* 4 Preset Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PRESET_CASES.map(preset => {
          const isSelected = preset.id === currentCaseId;
          return (
            <div
              key={preset.id}
              className={`rounded-xl border p-5 transition-all flex flex-col justify-between relative ${
                isSelected
                  ? 'border-indigo-500 bg-indigo-50/20 shadow-md ring-1 ring-indigo-500/20'
                  : 'border-slate-200 hover:border-slate-300 hover:shadow-sm bg-white'
              }`}
            >
              {isSelected && (
                <div className="absolute top-3.5 right-3.5 flex items-center gap-1 text-xs font-semibold text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                  <span>当前激活</span>
                </div>
              )}

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    {preset.tag}
                  </span>
                  <span className="text-xs text-slate-400">基准: {preset.benchmarkName}</span>
                </div>

                <h3 className="text-base font-bold text-slate-900">{preset.title}</h3>
                <p className="text-xs text-indigo-700 font-medium mt-0.5">{preset.subtitle}</p>

                <p className="text-xs text-slate-600 mt-2.5 leading-relaxed">
                  {preset.description}
                </p>

                {/* Assets Chips */}
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <div className="text-[11px] text-slate-400 font-medium mb-1.5">包含底层资产标的：</div>
                  <div className="flex flex-wrap gap-1.5">
                    {preset.assets.map(asset => (
                      <span
                        key={asset.id}
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-mono bg-slate-50 border border-slate-200 text-slate-700"
                      >
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: asset.color }} />
                        <span>{asset.symbol.split(' ')[0]}</span>
                        <span className="text-[10px] text-slate-400">
                          (E:{(asset.expectedReturn * 100).toFixed(0)}%/σ:{(asset.volatility * 100).toFixed(0)}%)
                        </span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Historical context note */}
                <div className="mt-3 text-[11px] text-slate-500 italic bg-slate-50/70 p-2.5 rounded-lg border border-slate-100">
                  “{preset.historicalContext}”
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-4 pt-3 flex justify-end">
                <button
                  onClick={() => onSelectCase(preset)}
                  disabled={isSelected}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                    isSelected
                      ? 'bg-slate-100 text-slate-400 cursor-default'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                  }`}
                >
                  <span>{isSelected ? '实验室正在运算此组合' : '一键载入到实验室'}</span>
                  {!isSelected && <ArrowRight className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

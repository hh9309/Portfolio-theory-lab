/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Asset, PortfolioMetrics } from '../services/portfolioEngine';
import { callBrowserLLM, ModelType } from '../services/llmClient';
import {
  Sparkles,
  X,
  Send,
  MessageSquare,
  AlertTriangle,
  ShieldCheck,
  Compass,
  Zap,
  Minimize2,
  Maximize2,
  Bot,
  User,
  Settings,
  Key,
  Eye,
  EyeOff,
  CheckCircle2,
  Cpu,
  Info,
  ExternalLink
} from 'lucide-react';

interface AiDiagnosticDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  assets: Asset[];
  covMatrix: number[][];
  weights: number[];
  metrics: PortfolioMetrics;
  condNumber: number;
  isShrinkageActive: boolean;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  modelUsed?: string;
}

export const AiDiagnosticDrawer: React.FC<AiDiagnosticDrawerProps> = ({
  isOpen,
  onClose,
  assets,
  covMatrix,
  weights,
  metrics,
  condNumber,
  isShrinkageActive
}) => {
  // Settings state
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [selectedModel, setSelectedModel] = useState<ModelType>(() => {
    return (localStorage.getItem('ai_lab_selected_model') as ModelType) || 'gemini 3 flash';
  });
  
  // Model-specific API keys stored in localStorage
  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => {
    return localStorage.getItem('ai_lab_gemini_api_key') || '';
  });
  const [deepseekApiKey, setDeepseekApiKey] = useState<string>(() => {
    return localStorage.getItem('ai_lab_deepseek_api_key') || '';
  });

  const [showKeyPassword, setShowKeyPassword] = useState<boolean>(false);
  const [settingsSaveSuccess, setSettingsSaveSuccess] = useState<boolean>(false);
  const [keyMissingWarning, setKeyMissingWarning] = useState<string>('');

  // Active key based on chosen model
  const currentApiKey = selectedModel === 'gemini 3 flash' ? geminiApiKey : deepseekApiKey;

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: `您好！我是您的**量化配置与投资组合理论 AI 专家顾问**。
本项目支持静态部署至 GitHub 并由浏览器直接发起调用。
所有大模型调用必须先输入您的 API-Key：
请点击右上角小齿轮 **⚙️ 设置大模型** 输入并确认您的 **Gemini** 或 **DeepSeek** 密钥，即可进行协方差病态性、角点解与尾部风险深度问诊！`,
      timestamp: '刚刚',
      modelUsed: '系统就绪'
    }
  ]);

  const [inputPrompt, setInputPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, showSettings]);

  // Save Settings Handler
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentApiKey.trim()) {
      setKeyMissingWarning(`请先输入 ${selectedModel} 的 API-Key 后方可保存确认！`);
      return;
    }

    localStorage.setItem('ai_lab_selected_model', selectedModel);
    localStorage.setItem('ai_lab_gemini_api_key', geminiApiKey.trim());
    localStorage.setItem('ai_lab_deepseek_api_key', deepseekApiKey.trim());

    setKeyMissingWarning('');
    setSettingsSaveSuccess(true);
    setTimeout(() => {
      setSettingsSaveSuccess(false);
      setShowSettings(false);
    }, 1200);
  };

  const sendDiagnosticQuery = async (queryText: string) => {
    if (!queryText.trim() || isLoading) return;

    // Strict validation: API-Key must be entered before calling
    if (!currentApiKey || !currentApiKey.trim()) {
      setKeyMissingWarning(`所有大模型调用必须输入 API-Key！请在此处设置您的 ${selectedModel} 密钥。`);
      setShowSettings(true);
      return;
    }

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: queryText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputPrompt('');
    setIsLoading(true);

    try {
      // Direct browser-side LLM call using user's configured API-Key
      const replyText = await callBrowserLLM({
        model: selectedModel,
        apiKey: currentApiKey.trim(),
        prompt: queryText,
        context: {
          assets: assets.map(a => ({
            name: a.name,
            symbol: a.symbol,
            expectedReturn: a.expectedReturn,
            volatility: a.volatility
          })),
          weights,
          metrics,
          condNumber,
          isShrinkageActive
        }
      });

      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'assistant',
          text: replyText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          modelUsed: selectedModel
        }
      ]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'assistant',
          text: `调用失败 [${selectedModel}]: ${err?.message || '网络连接超时或密钥无效'}。\n\n请点击右上角小齿轮 ⚙️ 检查您的 API-Key 是否正确无误。`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          modelUsed: selectedModel
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={`fixed bottom-0 right-0 z-50 transition-all duration-300 flex flex-col bg-white shadow-2xl border-l border-t border-slate-200 ${
        isExpanded
          ? 'w-full md:w-[740px] h-[88vh] rounded-tl-2xl'
          : 'w-full md:w-[480px] h-[640px] rounded-tl-xl'
      }`}
    >
      {/* Header */}
      <div className="px-5 py-3.5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between rounded-tl-xl select-none">
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/30 flex items-center justify-center border border-indigo-400/40">
            <Sparkles className="w-4 h-4 text-indigo-300" />
          </div>
          <div>
            <h3 className="font-bold text-sm leading-tight flex items-center gap-1.5">
              <span>AI 量化随诊与模型顾问</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-normal">
                在线
              </span>
            </h3>
            <p className="text-[10px] text-slate-300 font-mono flex items-center gap-1.5 mt-0.5">
              <span className="text-indigo-300 font-semibold">{selectedModel}</span>
              <span>•</span>
              <span>{currentApiKey ? '已配密钥' : '未配置密钥'}</span>
            </p>
          </div>
        </div>

        {/* Right header controls with Gear Settings icon */}
        <div className="flex items-center space-x-1.5">
          {/* Gear icon to open LLM Settings */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-1.5 rounded-md transition-colors relative ${
              showSettings
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
            title="大模型与 API-Key 设置 (小齿轮)"
          >
            <Settings className={`w-4 h-4 ${showSettings ? 'rotate-90 transition-transform' : ''}`} />
            {!currentApiKey && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            )}
            {!currentApiKey && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-500" />
            )}
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-white/10 transition-colors"
            title={isExpanded ? '缩小窗口' : '最大化窗口'}
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-white/10 transition-colors"
            title="关闭窗口"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Settings Modal Overlay / Panel (Triggered by Gear Icon) */}
      {showSettings ? (
        <div className="flex-1 bg-slate-50 p-5 overflow-y-auto space-y-5 text-xs text-slate-700">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-indigo-600" />
              <h4 className="font-bold text-slate-900 text-sm">大模型与 API-Key 设置</h4>
            </div>
            <button
              onClick={() => setShowSettings(false)}
              className="text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed bg-white p-3 rounded-xl border border-slate-200">
            🛡️ <b>本地浏览器直连保护</b>：本项目专为部署至 <b>GitHub Pages / 静态 Web 托管</b> 优化。所有大模型请求均从您的浏览器直接加密发起，API-Key 仅保存在您本地的 <code>localStorage</code> 中，绝不经过任何第三方服务器中转。
          </p>

          <form onSubmit={handleSaveSettings} className="space-y-4">
            {/* Step 2: Choose Model */}
            <div className="space-y-2">
              <label className="font-bold text-slate-800 flex items-center justify-between">
                <span>1. 选择大模型 (Select Model)：</span>
                <span className="text-[10px] text-indigo-600 font-mono">2选1</span>
              </label>

              <div className="grid grid-cols-2 gap-3">
                {/* Model 1: gemini 3 flash */}
                <button
                  type="button"
                  onClick={() => setSelectedModel('gemini 3 flash')}
                  className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                    selectedModel === 'gemini 3 flash'
                      ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 font-semibold shadow-xs ring-1 ring-indigo-500/20'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-slate-900">gemini 3 flash</span>
                    <Cpu className={`w-3.5 h-3.5 ${selectedModel === 'gemini 3 flash' ? 'text-indigo-600' : 'text-slate-400'}`} />
                  </div>
                  <div className="text-[10px] text-slate-500">Google AI Studio</div>
                  <div className="text-[10px] text-indigo-600 font-mono mt-1">极速高并发推理</div>
                </button>

                {/* Model 2: deepseek-v4-pro */}
                <button
                  type="button"
                  onClick={() => setSelectedModel('deepseek-v4-pro')}
                  className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                    selectedModel === 'deepseek-v4-pro'
                      ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 font-semibold shadow-xs ring-1 ring-indigo-500/20'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-slate-900">deepseek-v4-pro</span>
                    <Cpu className={`w-3.5 h-3.5 ${selectedModel === 'deepseek-v4-pro' ? 'text-indigo-600' : 'text-slate-400'}`} />
                  </div>
                  <div className="text-[10px] text-slate-500">DeepSeek Platform</div>
                  <div className="text-[10px] text-indigo-600 font-mono mt-1">深度数理推导</div>
                </button>
              </div>
            </div>

            {/* Step 1: Input API-Key */}
            <div className="space-y-2">
              <label className="font-bold text-slate-800 flex items-center justify-between">
                <span>2. 手工输入 API-Key ({selectedModel})：</span>
                <span className="text-[10px] text-rose-500 font-medium">* 必填项</span>
              </label>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Key className="w-3.5 h-3.5" />
                </div>
                <input
                  type={showKeyPassword ? 'text' : 'password'}
                  value={selectedModel === 'gemini 3 flash' ? geminiApiKey : deepseekApiKey}
                  onChange={e => {
                    if (selectedModel === 'gemini 3 flash') {
                      setGeminiApiKey(e.target.value);
                    } else {
                      setDeepseekApiKey(e.target.value);
                    }
                  }}
                  placeholder={
                    selectedModel === 'gemini 3 flash'
                      ? '输入 Gemini API-Key (如 AIzaSy...)'
                      : '输入 DeepSeek API-Key (如 sk-...)'
                  }
                  className="w-full pl-9 pr-10 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono shadow-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowKeyPassword(!showKeyPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showKeyPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1">
                <span>
                  {selectedModel === 'gemini 3 flash'
                    ? '免费获取: aistudio.google.com'
                    : '获取地址: platform.deepseek.com'}
                </span>
                <span className="text-slate-500 font-mono">
                  {currentApiKey ? `已输入 (${currentApiKey.slice(0, 6)}...)` : '未录入'}
                </span>
              </div>
            </div>

            {keyMissingWarning && (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{keyMissingWarning}</span>
              </div>
            )}

            {settingsSaveSuccess && (
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>大模型与 API-Key 设置已确认保存！</span>
              </div>
            )}

            {/* Step 3: Confirm Model Button */}
            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>确认大模型与 API-Key (Confirm Settings)</span>
              </button>
            </div>
          </form>
        </div>
      ) : (
        <>
          {/* Quick Diagnostic Preset Chips */}
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-200/80 flex items-center gap-1.5 overflow-x-auto text-xs no-scrollbar">
            <button
              onClick={() => sendDiagnosticQuery('请评估当前协方差矩阵的条件数 kappa、正定性与病态程度，指出逆矩阵敏感度风险。')}
              className="whitespace-nowrap px-2.5 py-1 rounded-full bg-white border border-slate-200 hover:border-indigo-400 text-slate-700 hover:text-indigo-600 transition-colors shadow-2xs font-medium"
            >
              🔍 协方差病态性体检
            </button>
            <button
              onClick={() => sendDiagnosticQuery('请诊断当前组合是否存在极端角点解权重偏向与马克维茨“误差放大器”现象。')}
              className="whitespace-nowrap px-2.5 py-1 rounded-full bg-white border border-slate-200 hover:border-amber-400 text-slate-700 hover:text-amber-600 transition-colors shadow-2xs font-medium"
            >
              ⚠️ 极端角点权重体检
            </button>
            <button
              onClick={() => sendDiagnosticQuery('请评估正态分布假设下的尖峰肥尾风险，并说明 Ledoit-Wolf 萎缩估计如何改善泛化能力。')}
              className="whitespace-nowrap px-2.5 py-1 rounded-full bg-white border border-slate-200 hover:border-emerald-400 text-slate-700 hover:text-emerald-600 transition-colors shadow-2xs font-medium"
            >
              🛡️ 肥尾与萎缩估计建议
            </button>
            <button
              onClick={() => sendDiagnosticQuery('如何运用 Black-Litterman 贝叶斯后验模型结合市场均衡与专家主观观点进行优化？')}
              className="whitespace-nowrap px-2.5 py-1 rounded-full bg-white border border-slate-200 hover:border-purple-400 text-slate-700 hover:text-purple-600 transition-colors shadow-2xs font-medium"
            >
              💡 Black-Litterman 建议
            </button>
          </div>

          {/* Missing Key Warning Prompt Banner */}
          {!currentApiKey && (
            <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-900 text-xs flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>尚未输入 {selectedModel} 的 API-Key</span>
              </div>
              <button
                onClick={() => setShowSettings(true)}
                className="underline font-bold text-amber-950 hover:text-indigo-600 ml-2"
              >
                点此输入
              </button>
            </div>
          )}

          {/* Chat Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs leading-relaxed bg-[#FBFBFC]">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex items-start gap-2.5 ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white ${
                    msg.sender === 'user' ? 'bg-indigo-600' : 'bg-slate-800'
                  }`}
                >
                  {msg.sender === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5 text-indigo-300" />}
                </div>

                <div
                  className={`max-w-[85%] rounded-2xl p-3.5 shadow-2xs ${
                    msg.sender === 'user'
                      ? 'bg-indigo-600 text-white rounded-tr-xs'
                      : 'bg-white border border-slate-200/80 text-slate-800 rounded-tl-xs'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.text}</div>
                  <div
                    className={`text-[9px] mt-1.5 flex items-center justify-between gap-2 font-mono ${
                      msg.sender === 'user' ? 'text-indigo-200' : 'text-slate-400'
                    }`}
                  >
                    <span>{msg.modelUsed || ''}</span>
                    <span>{msg.timestamp}</span>
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center gap-2 text-slate-400 text-xs italic p-2">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
                <span>[{selectedModel}] 正在深入解析协方差谱分解与凸优化参数...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Box Footer */}
          <div className="p-3 bg-white border-t border-slate-200">
            <form
              onSubmit={e => {
                e.preventDefault();
                sendDiagnosticQuery(inputPrompt);
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={inputPrompt}
                onChange={e => setInputPrompt(e.target.value)}
                placeholder={
                  currentApiKey
                    ? `向 ${selectedModel} 提问，如：条件数过大如何影响逆矩阵求解？...`
                    : `请先点击右上角 ⚙️ 输入 API-Key...`
                }
                className="flex-1 px-3.5 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50 focus:bg-white text-slate-800"
              />
              <button
                type="submit"
                disabled={isLoading || !inputPrompt.trim()}
                className="p-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-lg transition-colors shadow-xs"
                title="发送问题"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
};

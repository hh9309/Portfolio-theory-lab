/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ModelType = 'gemini 3 flash' | 'deepseek-v4-pro';

export interface LLMRequestOptions {
  model: ModelType;
  apiKey: string;
  prompt: string;
  context: any;
}

const SYSTEM_INSTRUCTION = `你是一位世界顶级的量化投资与投资组合理论(MPT/Black-Litterman/Risk Parity)专家顾问。
用户正在“投资组合理论与量化配置实验室”中分析资产协方差矩阵、均值-方差优化、有效前沿与风险归因。
请用专业、淡雅、严谨、深具金融洞见的语言回答。
在回答中：
1. 深入分析协方差矩阵的条件数 kappa、正定性与病态性(Ill-conditioned Matrix)；
2. 指出马克维茨“误差放大器(Error Maximizer)”导致的角点解过度集中陷阱；
3. 对比分析常规样本协方差 vs Ledoit-Wolf 萎缩估计 (Shrinkage) 的数理优势；
4. 若涉及观点修正，建议如何使用 Black-Litterman 贝叶斯后验平滑结合市场均衡；
5. 分段明晰，并给出明确可落地的操作建议。`;

/**
 * Direct browser-side LLM invoker for GitHub static deployment and AI Studio environments.
 * Strictly requires user-provided API-Key.
 */
export async function callBrowserLLM(options: LLMRequestOptions): Promise<string> {
  const { model, apiKey, prompt, context } = options;

  if (!apiKey || !apiKey.trim()) {
    throw new Error('未检测到有效 API-Key。请先点击右上角小齿轮 ⚙️ 输入并确认您的 API-Key 后再进行调用。');
  }

  const cleanKey = apiKey.trim();
  const contextStr = JSON.stringify(context || {}, null, 2);
  const fullPrompt = `${SYSTEM_INSTRUCTION}\n\n【当前组合资产与协方差矩阵上下文数据】:\n${contextStr}\n\n【用户量化问诊需求】:\n${prompt}`;

  if (model === 'gemini 3 flash') {
    return await callGeminiFlash(cleanKey, fullPrompt);
  } else if (model === 'deepseek-v4-pro') {
    return await callDeepSeek(cleanKey, prompt, contextStr);
  } else {
    throw new Error(`不支持的模型类型: ${model}`);
  }
}

// 1. Google Gemini Flash Browser Call
async function callGeminiFlash(apiKey: string, fullPrompt: string): Promise<string> {
  // Use Gemini 2.5/2.0 Flash REST endpoint directly supported in all browsers
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: fullPrompt }]
        }
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2048,
      }
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMsg = errorData?.error?.message || response.statusText || 'Gemini API 请求失败';
    throw new Error(`Gemini API 错误 (${response.status}): ${errorMsg}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Gemini API 未返回有效分析文本，请检查响应。');
  }

  return text;
}

// 2. DeepSeek Browser Call
async function callDeepSeek(apiKey: string, prompt: string, contextStr: string): Promise<string> {
  const url = 'https://api.deepseek.com/chat/completions';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: SYSTEM_INSTRUCTION
        },
        {
          role: 'user',
          content: `【当前组合资产与协方差矩阵上下文数据】:\n${contextStr}\n\n【用户量化问诊需求】:\n${prompt}`
        }
      ],
      temperature: 0.3,
      max_tokens: 2048
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMsg = errorData?.error?.message || response.statusText || 'DeepSeek API 请求失败';
    throw new Error(`DeepSeek API 错误 (${response.status}): ${errorMsg}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('DeepSeek API 未返回有效分析文本，请检查响应。');
  }

  return text;
}

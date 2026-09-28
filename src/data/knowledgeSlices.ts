/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface KnowledgeSlice {
  id: string;
  sliceNumber: string;
  title: string;
  badge: string;
  summary: string;
  contentMarkdown: string;
  keyTakeaways: string[];
  formulaLaTeX: string;
  diagnosticAdvice: string;
}

export const KNOWLEDGE_SLICES: KnowledgeSlice[] = [
  {
    id: 'slice-1-models',
    sliceNumber: '切片一',
    title: '三大核心量化配置模型机理差异',
    badge: '模型机理对比',
    summary: 'Markowitz 均值-方差、Risk Parity 风险平摊与 Black-Litterman 贝叶斯后验的本质数学假设、信息输入与稳健性评析。',
    formulaLaTeX: '\\text{MVO: } \\max \\frac{w^T \\mu - r_f}{\\sqrt{w^T \\Sigma w}} \\quad \\longleftrightarrow \\quad \\text{ERC: } w_i (\\Sigma w)_i = \\frac{1}{N} \\sigma_p^2 \\quad \\longleftrightarrow \\quad \\text{BL: } E[R] = \\left[(\\tau \\Sigma)^{-1} + P^T \\Omega^{-1} P\\right]^{-1} [\\dots]',
    contentMarkdown: `
### 1. 马克维茨均值-方差 (MVO - Markowitz Mean-Variance)
* **核心思想**: 给定预期收益率下最小化方差，或给定方差约束下最大化预期收益。
* **致命痛点**: 对期望收益率 $\\mu$ 的估计极度敏感。Michaud (1989) 称其为“误差放大器 (Error Maximizer)”。轻微的期望收益率扰动会导致最优化权重在极端角点之间剧烈晃动（如全仓单一资产）。
* **适用场景**: 拥有强预测能力的阿尔法因子或配合严密二次收缩惩罚约束。

### 2. 风险平摊 (Risk Parity / Equal Risk Contribution)
* **核心思想**: 抛弃对不可知未来期望收益 $\\mu$ 的主观预测，仅依赖相对稳定的资产协方差矩阵 $\\Sigma$，强制使每个资产对组合总方差的边际贡献相等：
  $$RC_i = w_i \\frac{(\\Sigma w)_i}{\\sigma_p} = \\frac{\\sigma_p}{N}$$
* **优势与代价**: 绝不会出现单一资产（如高波动股票）主导组合风险。但在低利率环境下需杠杆放大债券仓位，面临利率大幅上行时的久期风险。

### 3. 贝叶斯布莱克-利特曼 (Black-Litterman)
* **核心思想**: 以资本资产定价模型 (CAPM) 市场均衡权重反推的“中性隐含收益率 $\\Pi$”作为先验锚点，利用贝叶斯法则平滑揉合投研团队的主观观点 (Views)，并由信心矩阵 $\\Omega$ 决定权重倾斜幅度。
* **卓越优势**: 彻底杜绝极端非理性角点解，输出极其直观且符合机构投资人逻辑的平滑配置方案。
    `,
    keyTakeaways: [
      'MVO 依赖历史均值，常退化为“垃圾进，垃圾出”',
      'Risk Parity 规避收益估计，追求风险贡献几何均衡',
      'Black-Litterman 融合市场均衡先验与专家主观观点，最具工程实操韧性'
    ],
    diagnosticAdvice: '在实践中，建议以 Black-Litterman 或收缩后的协方差矩阵为底座，严控最大持仓权重（如不超过 35%），杜绝极端角点仓位。'
  },
  {
    id: 'slice-2-space-conditions',
    sliceNumber: '切片二',
    title: '适用条件与多资产几何空间表示',
    badge: '几何分散原理',
    summary: '多资产低相关性（$\\rho < 1$）非线性抵消非系统性风险的几何抛物面机理与夏普边界外推。',
    formulaLaTeX: '\\sigma_p^2 = w_1^2 \\sigma_1^2 + w_2^2 \\sigma_2^2 + 2 w_1 w_2 \\rho_{12} \\sigma_1 \\sigma_2 < (w_1 \\sigma_1 + w_2 \\sigma_2)^2 \\quad (\\text{当 } \\rho_{12} < 1)',
    contentMarkdown: `
### 1. 均方差双曲边界的几何成因
在 $(\\sigma_p, \\mu_p)$ 坐标系中，当两个资产相关系数 $\\rho = 1$ 时，组合的风险收益轨迹是一条连接两点的直线（无法获得任何分散化收益红利）。
一旦 $\\rho < 1$，轨迹立即弯曲为朝左凸出的抛物双曲线（Hyperbola）：
* 当 $\\rho = 0$ 时，交叉项彻底归零，方差直接等于平方和；
* 当 $\\rho = -1$ 时，甚至存在权重组合使 $\\sigma_p = 0$（构建完全无风险套期保值组合）。

### 2. 单纯形权重空间 (Weight Simplex) 约束
在 $N$ 资产的权重空间中，组合完全投资约束 $\\sum_{i=1}^N w_i = 1$ 与做空限制 $w_i \\ge 0$ 定义了一个标准单纯形 (Simplex)。
在三资产空间中，该单纯形是一个等边三角形平面。组合方差曲面 $w^T \\Sigma w$ 是一个开口向上的椭圆抛物面 (Paraboloid)。最优化过程本质是在单纯形三角形约束区域内寻找该抛物面等高线的最底点或等夏普射线的切点。
    `,
    keyTakeaways: [
      '分散化是金融界唯一的“免费午餐”，源于协方差交叉项的非线性抵消',
      '资产间负相关或低相关是有效前沿向左上方大幅扩张的充要条件',
      '单纯形几何投影直观展现了有效边界与不可行解的物理边界'
    ],
    diagnosticAdvice: '检查当前协方差矩阵中的平均相关系数。若平均相关系数高于 0.75，分散化效用将发生严重衰减，须补充非同质化资产（如大宗商品、宏观中性对冲）。'
  },
  {
    id: 'slice-3-pitfalls',
    sliceNumber: '切片三',
    title: '三大致命量化配置陷阱',
    badge: '实务避坑指南',
    summary: '均值估计误差导致“垃圾进垃圾出”、历史协方差非稳态时变性、以及正态分布假设忽略资产肥尾（Fat-tail）穿仓崩盘。',
    formulaLaTeX: '\\text{Kurtosis: } \\kappa = E\\left[\\left(\\frac{X-\\mu}{\\sigma}\\right)^4\\right] > 3 \\implies \\text{Fat-tail Crash Risk under Gaussian MVO}',
    contentMarkdown: `
### 陷阱一：均值估计误差与“误差放大器”
* Merton (1980) 严密证明：估计资产期望收益 $\\mu$ 所需的历史数据跨度以“几十年”计，而估计方差与协方差仅需几个月的高频采样。
* 直接将历史样本均值作为未来 $\\mu$ 输入，会导致 MVO 极度重配过去表现优异的“幸运资产”，而这些资产往往正处于估值泡沫破裂的前夕。

### 陷阱二：历史协方差矩阵的“假定稳态”
* 资产间的相关系数在牛市与熊市具有极度非对称性。在流动性踩踏危机（如 2008 雷曼兄弟、2020 疫情流动性危机）中，**“所有资产的相关性迅速趋近于 1”**，原本设计的抵消效应在瞬间失效。

### 陷阱三：正态分布假设忽略尖峰肥尾 (Fat-tail)
* 传统均值-方差理论假定收益率服从正态高斯分布。然而真实金融资产的对数收益具有高阶矩偏度 (Skewness) 与超额峰度 (Excess Kurtosis)。
* 在正态分布下，5 个标准差的“百年一遇”暴跌事件在现实市场每 3-5 年就会发生一次。单纯依赖方差指标会严重低估尾部破产概率 (Tail Risk)。
    `,
    keyTakeaways: [
      '切勿直接使用历史收益率均值作为未来预期输入，应采用先验收缩或宏观资本市场假设',
      '极端踩踏时资产相关性大幅飙升，应借助极值理论 (EVT) 或 CVaR 检验下行风险',
      '采用峰度修正与萎缩估计 (Ledoit-Wolf) 提高协方差矩阵抗病态能力'
    ],
    diagnosticAdvice: '启用实验室内置的 Ledoit-Wolf 萎缩估计与 95% CVaR（条件在险价值）指标，替代单纯的标准差作为真实尾部下行风险的度量尺。'
  },
  {
    id: 'slice-4-warnings',
    sliceNumber: '切片四',
    title: '误区警示与实盘诊断陷阱',
    badge: '合规与回测真伪',
    summary: '警惕高夏普比率伪象（卖空期权虚高）、未限制做空导致杠杆失控、以及忽视再平衡摩擦成本与滑点拖累。',
    formulaLaTeX: '\\text{Sharpe Bias: } S_{\\text{pseudo}} = \\frac{r_{\\text{premium}} - r_f}{\\sigma_{\\text{calm}}} \\quad \\text{vs} \\quad \\text{Max Loss} \\to -100\\%',
    contentMarkdown: `
### 1. 虚高夏普比率陷阱 (Fake High Sharpe Ratio)
* 某些策略通过“做空深度虚值看跌期权”或长期赚取流动性溢价，其净值曲线在 99% 的平静时期极其平稳，夏普比率可高达 3.0 以上。
* 然而在尾部黑天鹅触发时，单日跌幅即可能吞噬数年累积利润。**没有考虑最大回撤与尾部偏度的单维度夏普比率是极具欺骗性的指标。**

### 2. 允许做空与杠杆失控 ($w_i < 0$)
* 在无约束 MVO 优化中，若允许做空，算法往往会给出“200% 做多资产 A、-100% 做空资产 B”的极端杠杆配比。
* 实盘中面临融资融券利息、强制平仓线以及保证金追加要求，微小的估值基差走阔即可触发链式清算。

### 3. 再平衡摩擦成本 (Rebalancing Friction)
* 理论上的动态最优权重每天都在发生漂移。如果频繁调整权重，交易佣金、买卖价差 (Bid-Ask Spread) 与冲击成本将吃掉组合大部分的超额收益。
* 实盘应设置**再平衡容忍带 (Tolerance Band)**，例如当资产实际权重偏离目标权重超过 $\\pm 5\\%$ 时才触发再平衡操作。
    `,
    keyTakeaways: [
      '单看夏普比率极易踩雷，必须与 Sortino 比率、最大回撤、CVaR 联袂审视',
      '实盘必须添加非负权重约束 ($w_i \\ge 0$) 或硬性杠杆上限',
      '必须将换手率、交易滑点与周期性再平衡成本计入策略真实收益评估'
    ],
    diagnosticAdvice: '若当前组合计算出的夏普比率异常高（> 2.5）且资产包含期权或衍生套利，务必进入全流程回测面板，查验其在 2008 与 2020 危机情景下的最大单次回撤深度。'
  },
  {
    id: 'slice-5-portfolio-theory',
    sliceNumber: '切片五',
    title: '投资组合理论 (Modern Portfolio Theory & Evolution)',
    badge: '理论脉络与基石',
    summary: '从 Markowitz 均值-方差基石、Tobin 两基金分离定理、Sharpe 资本资产定价模型 (CAPM) 到多因子与后验稳健配置的数理演进全景。',
    formulaLaTeX: '\\text{CAPM: } \\mathbb{E}[R_i] = R_f + \\beta_i (\\mathbb{E}[R_m] - R_f) \\quad \\Longleftrightarrow \\quad \\text{CML: } \\mathbb{E}[R_p] = R_f + \\frac{\\mathbb{E}[R_m] - R_f}{\\sigma_m} \\sigma_p',
    contentMarkdown: `
### 1. 马克维茨奠基 (Markowitz, 1952)
* **核心突破**: 首次将“期望收益”与“方差（波动率）”作为资产配置的二维坐标轴，证明资产的特质风险 (Idiosyncratic Risk) 可以通过非完全相关的资产组合抵消。
* **数学表达**:
  $$\\min_{\\mathbf{w}} \\frac{1}{2} \\mathbf{w}^T \\boldsymbol{\\Sigma} \\mathbf{w} \\quad \\text{s.t.} \\quad \\mathbf{w}^T \\boldsymbol{\\mu} \\ge \\mu_0, \\quad \\sum_{i=1}^N w_i = 1$$
* **理论地位**: 金融学从主观选股与经验直觉迈向公理化数理优化的里程碑。

### 2. 托宾两基金分离定理 (Tobin, 1958)
* **核心思想**: 任何理性投资者的资产配置决策都可以严格分解为相互独立的两个步骤：
  1. **技术步骤 (客观)**: 仅依赖风险资产协方差与预期收益，求解出全局最优的**风险资产切点组合 (Tangency Portfolio)**；
  2. **偏好步骤 (主观)**: 根据投资者的个人风险厌恶程度，在“无风险资产”与“切点风险组合”之间进行一维资金分配。
* **几何意义**: 引入无风险利率 $R_f$ 后，从 $(0, R_f)$ 向双曲有效前沿引切线，得到的切线即为**资本市场线 (CML, Capital Market Line)**，全方位占优于原有的纯风险资产双曲前沿。

### 3. 资本资产定价模型 (CAPM: Sharpe, Lintner, Mossin, 1964-1966)
* **核心命题**: 市场在均衡状态下，只有无法被分散的**系统性风险 (Systematic Risk, $\\beta$)** 才能获得风险溢价补偿：
  $$\\mathbb{E}[R_i] - R_f = \\beta_i (\\mathbb{E}[R_m] - R_f), \\quad \\beta_i = \\frac{\\text{Cov}(R_i, R_m)}{\\sigma_m^2}$$
* **阿尔法与贝塔解耦**: 组合收益被清晰划分为市场基准贡献 $\\beta \\cdot R_m$ 与经理人主动选股超额收益 $\\alpha$。

### 4. 理论演进与现代扩展 (1970s - 至今)
* **Roll 批判 (1977)**: 真实的“全市场组合 $R_m$”包含全人类所有资产（未上市股权、房产、人力资本），在现实中永远不可完全观测；
* **Fama-French 多因子模型**: 从单因子 $\\beta$ 扩展至规模 (SMB)、价值 (HML)、盈利 (RMW)、投资 (CMA) 等多维风险溢价；
* **现代稳健优化 (Robust MPT)**: 引入凸优化锥规划、Ledoit-Wolf 收缩估计与 Black-Litterman 贝叶斯后验，克服传统马克维茨对参数扰动极端脆弱的工程缺陷。
    `,
    keyTakeaways: [
      '两基金分离定理将资产配置解耦为“寻找切点组合”与“杠杆/现金无风险配比”两步',
      'CAPM 奠定了系统性风险与非系统性风险的根本分水岭',
      '现代量化配置是经典 MPT 理论与现代矩阵收缩、因子模型和贝叶斯统计的工程融合'
    ],
    diagnosticAdvice: '在分析切点组合时，务必核对当前的无风险基准利率 $R_f$。当市场利率上行时，切点组合将沿有效前沿显著向高收益、高波动标的右移漂移。'
  },
  {
    id: 'slice-6-application-scenarios',
    sliceNumber: '切片六',
    title: '理论应用场景 (Practical Application Scenarios)',
    badge: '实战机构场景',
    summary: '涵盖主权基金与养老金负债匹配 (LDI)、全天候大类宏观对冲、公募养老目标日期基金 (TDF) 以及家办核心-卫星配置落地。',
    formulaLaTeX: '\\min_{\\mathbf{w}} \\mathbf{w}^T \\boldsymbol{\\Sigma} \\mathbf{w} \\quad \\text{s.t.} \\quad \\mathbf{w}^T \\boldsymbol{\\mu} \\ge \\mu_{\\text{target}}, \\quad \\mathbf{l} \\le \\mathbf{w} \\le \\mathbf{u}, \\quad \\text{TrackingError}(\\mathbf{w}) \\le \\tau_{\\max}',
    contentMarkdown: `
### 场景一：主权财富基金与大学捐赠基金 (如耶鲁模式 / 中投公司)
* **核心目标**: 超长久期跨周期资本保值增值，抵御法币超发与长期通胀侵蚀。
* **模型落地**: 采用**多大类资产宏观分散框架**，将权益（公开市场+PE私募股权）、不动产 (REITs)、抗通胀大宗商品（黄金、能源）与超长端国债进行结构化配比。
* **量化特征**: 极度注重非流动性溢价 (Illiquidity Premium) 与跨周期低相关性，设置严格的战略资产配置 (SAA) 容忍区间。

### 场景二：企业年金、社保基金与负债驱动投资 (LDI)
* **核心目标**: 匹配未来刚性养老金退休金支出现金流，杜绝资产负债错配引发的支付危机。
* **模型落地**: 
  * **避险免疫资产池 (Hedging Portfolio)**: 运用长久期国债与利率互换精准对齐未来负债折现现金流；
  * **收益增厚资产池 (Growth Portfolio)**: 运用**风险平摊 (Risk Parity)** 或**最小方差 (MVP)** 优化组合，在极小尾部回撤下获取稳健复利。

### 场景三：公募目标日期基金 (Target Date Funds, TDF / 养老FOF)
* **核心目标**: 适配持有人生命周期风险承受能力的动态演变。
* **模型落地**: 
  * **下滑轨道模型 (Glide Path)**: 投资者年轻时权益类资产占比高达 85% 以上，随着退休年龄临近，权重沿抛物线平滑自动收缩至以高等级债券和货币基金为主（80%+）；
  * **黑天鹅防爆**: 引入**下行尾部 CVaR 约束**，防止退休前夕遭遇类似 2008 次贷危机的单年毁灭性打击。

### 场景四：量化宏观对冲基金与风险平摊策略 (如桥水全天候)
* **核心目标**: 实现穿越经济周期“经济增长超预期/低于预期、通胀超预期/低于预期”四象限的稳定夏普比率。
* **模型落地**:
  * 不预测宏观经济走向，而是将各个资产按**风险暴露对等 (Equal Risk Contribution)** 分配；
  * 引入国债期货加杠杆平衡低波动债券与高波动股票的真实风险贡献，实现年化 1.0+ 的稳健夏普比率。

### 场景五：家族办公室与高净值财富管理 (Core-Satellite 核心-卫星)
* **核心目标**: 家族财富保全传承 (Capital Preservation) 与税务优化。
* **模型落地**: 
  * **核心盘 (70%-80%)**: 部署全球低成本宽基指数 ETF、全球优质高息债券与实体黄金，运用经典均值-方差模型定期被动再平衡；
  * **卫星盘 (20%-30%)**: 结合投研专家观点运用 **Black-Litterman 贝叶斯模型** 进行卫星阿尔法战术微调 (TAA)。
    `,
    keyTakeaways: [
      '不同机构的资金久期、流动性约束与负债属性决定了所适用的量化配置模型',
      '养老金与保险机构侧重负债现金流匹配与最小方差控制',
      '宏观对冲与对冲基金侧重风险平摊、因子中性化与跨周期全天候抗脆弱性'
    ],
    diagnosticAdvice: '在为实际资金制定量化方案时，首先明确该资金的持有周期与流动性刚性要求。若属于低风险短期资金，应首选 MVP 或风险平摊模型，而非单纯追逐高预期收益的最大夏普切点。'
  }
];

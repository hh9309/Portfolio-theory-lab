/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PresetCase } from '../services/portfolioEngine';

export const PRESET_CASES: PresetCase[] = [
  {
    id: 'global_multi_asset',
    title: '全球多资产宏观配置组合',
    subtitle: '股票 / 债券 / 黄金 / 房地产REITs 经典低相关性四分法',
    tag: '宏观稳健',
    description: '通过跨资产类别（全球权益、固收避险、大宗黄金、实物不动产）配置，利用资产间低相关性甚至负相关性显著降低非系统性风险，平滑跨周期回撤。',
    benchmarkName: 'MSCI 全球纯股票指数 (URTH)',
    historicalContext: '经历 2008 次贷危机、2020 疫情流动性冲击与 2022 全球加息潮，跨大类配置展示了极强的抗脆弱性，黄金与债券在权益大跌时形成关键下行保护缓冲垫。',
    assets: [
      {
        id: 'equity_global',
        name: '全球发达市场股票',
        symbol: 'MSCI World (URTH)',
        expectedReturn: 0.088,
        volatility: 0.154,
        color: '#2563EB', // Blue
        category: 'equity'
      },
      {
        id: 'bond_us_agg',
        name: '美国综合全债',
        symbol: 'US Agg Bond (BND)',
        expectedReturn: 0.038,
        volatility: 0.058,
        color: '#059669', // Emerald
        category: 'bond'
      },
      {
        id: 'commodity_gold',
        name: '现货黄金ETF',
        symbol: 'Gold Trust (GLD)',
        expectedReturn: 0.072,
        volatility: 0.148,
        color: '#D97706', // Amber
        category: 'commodity'
      },
      {
        id: 'real_estate_reit',
        name: '全球不动产信托',
        symbol: 'Global REITs (VNQ)',
        expectedReturn: 0.068,
        volatility: 0.182,
        color: '#7C3AED', // Violet
        category: 'reit'
      }
    ],
    correlationMatrix: [
      [ 1.00,  0.08,  0.05,  0.72],
      [ 0.08,  1.00,  0.22,  0.25],
      [ 0.05,  0.22,  1.00,  0.12],
      [ 0.72,  0.25,  0.12,  1.00]
    ]
  },
  {
    id: 'tech_giants_hedged',
    title: '科技巨头Alpha与防御对冲组合',
    subtitle: '成长巨头(AAPL/MSFT/NVDA) + 公用事业避险(XLU) + 黄金对冲',
    tag: '成长对冲',
    description: '捕获全球顶级科技龙头（苹果、微软、英伟达）高复合资本增值红利，同时引入负Beta公用事业板块与抗通胀黄金削减极端高波动回撤。',
    benchmarkName: '纳斯达克100指数 (QQQ)',
    historicalContext: '高估值科技股在流动性收缩周期易现30%+剧烈回撤，通过在协方差矩阵中引入低相关防御标的，能够在不损失过多上行弹性前提下大幅抬升组合夏普比率。',
    assets: [
      {
        id: 'aapl',
        name: '苹果公司',
        symbol: 'Apple (AAPL)',
        expectedReturn: 0.165,
        volatility: 0.225,
        color: '#6366F1', // Indigo
        category: 'equity'
      },
      {
        id: 'msft',
        name: '微软公司',
        symbol: 'Microsoft (MSFT)',
        expectedReturn: 0.158,
        volatility: 0.218,
        color: '#0EA5E9', // Sky
        category: 'equity'
      },
      {
        id: 'nvda',
        name: '英伟达',
        symbol: 'NVIDIA (NVDA)',
        expectedReturn: 0.280,
        volatility: 0.420,
        color: '#10B981', // Emerald
        category: 'equity'
      },
      {
        id: 'xlu',
        name: '公用事业防御ETF',
        symbol: 'Utilities (XLU)',
        expectedReturn: 0.065,
        volatility: 0.142,
        color: '#EAB308', // Yellow
        category: 'hedge'
      },
      {
        id: 'gld_hedge',
        name: '黄金避险对冲',
        symbol: 'Gold (GLD)',
        expectedReturn: 0.072,
        volatility: 0.148,
        color: '#F59E0B', // Amber
        category: 'commodity'
      }
    ],
    correlationMatrix: [
      [ 1.00,  0.74,  0.62,  0.22,  0.08],
      [ 0.74,  1.00,  0.68,  0.25,  0.06],
      [ 0.62,  0.68,  1.00,  0.15, -0.02],
      [ 0.22,  0.25,  0.15,  1.00,  0.18],
      [ 0.08,  0.06, -0.02,  0.18,  1.00]
    ]
  },
  {
    id: 'crypto_traditional_hybrid',
    title: '加密资产与传统核心卫星混合配置',
    subtitle: '数字原生(BTC/ETH) + 美股大盘(SPY) + 长期国债(TLT)',
    tag: '前沿核心卫星',
    description: '以传统股债组合为防守底仓（85%~95%），以微量高预期收益/高特异波动的加密资产为卫星增强仓位（5%~15%），探索非对称收益凸性对有效前沿的外推效应。',
    benchmarkName: '传统股债 60/40 组合',
    historicalContext: '由于加密货币独特的四年减半周期与对冲法币贬值叙事，其与传统资产的短期相关性较低，即使仅配置3%~5%权重，也能在几乎不增加组合年化破位风险的前提下极大拉高整体几何年化收益。',
    assets: [
      {
        id: 'btc',
        name: '比特币',
        symbol: 'Bitcoin (BTC)',
        expectedReturn: 0.350,
        volatility: 0.580,
        color: '#F97316', // Orange
        category: 'crypto'
      },
      {
        id: 'eth',
        name: '以太坊',
        symbol: 'Ethereum (ETH)',
        expectedReturn: 0.400,
        volatility: 0.680,
        color: '#8B5CF6', // Purple
        category: 'crypto'
      },
      {
        id: 'spy',
        name: '标普500大盘ETF',
        symbol: 'S&P 500 (SPY)',
        expectedReturn: 0.095,
        volatility: 0.160,
        color: '#1E40AF', // Dark Blue
        category: 'equity'
      },
      {
        id: 'tlt',
        name: '20年+长期美债',
        symbol: '20+ Year Treasury (TLT)',
        expectedReturn: 0.042,
        volatility: 0.125,
        color: '#047857', // Forest
        category: 'bond'
      }
    ],
    correlationMatrix: [
      [ 1.00,  0.82,  0.35, -0.15],
      [ 0.82,  1.00,  0.38, -0.12],
      [ 0.35,  0.38,  1.00,  0.10],
      [-0.15, -0.12,  0.10,  1.00]
    ]
  },
  {
    id: 'risk_parity_all_weather',
    title: '达利欧风险平摊 (Risk Parity) 全天候组合',
    subtitle: '均衡各资产风险贡献度 (ERC) · 穿越增长与通胀四象限',
    tag: '风险平摊ERC',
    description: '颠覆传统“名义资本等分”误区，采用“边际风险贡献相等(Equal Risk Contribution)”原则，通过超配低波债券、低配高波权益与大宗商品，使组合在任一经济环境下都不会被单一资产的剧烈波动所绑架。',
    benchmarkName: '传统资本等权 1/N 组合',
    historicalContext: '在桥水全天候基金（Bridgewater All-Weather）四十余年实践中，当传统60/40股债因高通胀或股市熔断蒙受重创时，全天候风险平价以近半于大盘的极低波动率持续创出历史新高。',
    assets: [
      {
        id: 'rp_equity',
        name: '标普500股票',
        symbol: 'S&P 500 (SPY)',
        expectedReturn: 0.095,
        volatility: 0.162,
        color: '#3B82F6',
        category: 'equity'
      },
      {
        id: 'rp_long_treasury',
        name: '20年+超长美债',
        symbol: 'Long Treasury (TLT)',
        expectedReturn: 0.045,
        volatility: 0.128,
        color: '#10B981',
        category: 'bond'
      },
      {
        id: 'rp_mid_treasury',
        name: '7-10年中期美债',
        symbol: 'Interm Treasury (IEF)',
        expectedReturn: 0.035,
        volatility: 0.065,
        color: '#065F46',
        category: 'bond'
      },
      {
        id: 'rp_gold',
        name: '黄金信托ETF',
        symbol: 'Gold Trust (GLD)',
        expectedReturn: 0.070,
        volatility: 0.145,
        color: '#F59E0B',
        category: 'commodity'
      },
      {
        id: 'rp_commodities',
        name: '大宗商品指数ETF',
        symbol: 'Commodities (DBC)',
        expectedReturn: 0.055,
        volatility: 0.185,
        color: '#B45309',
        category: 'commodity'
      }
    ],
    correlationMatrix: [
      [ 1.00,  0.08,  0.04,  0.06,  0.38],
      [ 0.08,  1.00,  0.88,  0.22, -0.15],
      [ 0.04,  0.88,  1.00,  0.18, -0.22],
      [ 0.06,  0.22,  0.18,  1.00,  0.35],
      [ 0.38, -0.15, -0.22,  0.35,  1.00]
    ]
  }
];

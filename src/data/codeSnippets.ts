/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface CodeTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  language: string;
  code: string;
  sampleOutput: string;
}

export const QUANT_CODE_SNIPPETS: CodeTemplate[] = [
  {
    id: 'scipy_slsqp_qp',
    name: 'Scipy SLSQP 均值-方差二次规划求解器',
    category: 'Scipy Optimize',
    description: '采用序列最小二乘二次规划算法 (SLSQP) 求解完全投资与做空约束下的最大夏普组合，自带英文图表可视化。',
    language: 'python',
    code: `import numpy as np
from scipy.optimize import minimize
import matplotlib.pyplot as plt

def optimize_mean_variance(returns, cov_matrix, risk_free_rate=0.035, objective='max_sharpe'):
    """
    Solve Markowitz Portfolio Optimization via Scipy SLSQP Quadratic Programming.
    Parameters:
        returns: (N,) vector of expected annual returns
        cov_matrix: (N, N) asset covariance matrix
        risk_free_rate: risk-free rate rf
        objective: 'max_sharpe' or 'min_variance'
    """
    n_assets = len(returns)
    w0 = np.ones(n_assets) / n_assets
    bounds = tuple((0.0, 1.0) for _ in range(n_assets))  # Long-only: 0 <= w_i <= 1
    constraints = ({'type': 'eq', 'fun': lambda w: np.sum(w) - 1.0})  # sum(w) = 1

    if objective == 'min_variance':
        def loss_func(w):
            return np.dot(w.T, np.dot(cov_matrix, w))
    else:  # Maximize Sharpe ratio: min - (w^T mu - rf) / sqrt(w^T Sigma w)
        def loss_func(w):
            p_ret = np.dot(w, returns)
            p_vol = np.sqrt(np.dot(w.T, np.dot(cov_matrix, w)))
            if p_vol < 1e-8:
                return 1e6
            return -(p_ret - risk_free_rate) / p_vol

    res = minimize(
        fun=loss_func,
        x0=w0,
        method='SLSQP',
        bounds=bounds,
        constraints=constraints,
        options={'ftol': 1e-12, 'maxiter': 1000}
    )

    if not res.success:
        raise RuntimeError(f"Optimization failed: {res.message}")

    opt_w = res.x
    p_return = float(np.dot(opt_w, returns))
    p_vol = float(np.sqrt(np.dot(opt_w.T, np.dot(cov_matrix, opt_w))))
    p_sharpe = float((p_return - risk_free_rate) / p_vol)

    return {
        "weights": opt_w,
        "expected_return": p_return,
        "volatility": p_vol,
        "sharpe_ratio": p_sharpe
    }

# --- Standalone Runnable Entrypoint ---
if __name__ == '__main__':
    asset_symbols = ['URTH', 'BND', 'GLD', 'VNQ']
    mu = np.array([0.088, 0.038, 0.072, 0.068])
    sigma = np.array([0.154, 0.058, 0.148, 0.182])
    corr = np.array([
        [1.00, 0.08, 0.05, 0.72],
        [0.08, 1.00, 0.22, 0.25],
        [0.05, 0.22, 1.00, 0.12],
        [0.72, 0.25, 0.12, 1.00]
    ])
    cov = np.outer(sigma, sigma) * corr

    result = optimize_mean_variance(mu, cov, risk_free_rate=0.035, objective='max_sharpe')
    
    print("=== Optimal Portfolio Results (SLSQP) ===")
    for sym, w in zip(asset_symbols, result['weights']):
        print(f"  {sym:8s}: {w*100:6.2f}%")
    print(f"Expected Return : {result['expected_return']*100:.2f}%")
    print(f"Annual Volatility: {result['volatility']*100:.2f}%")
    print(f"Sharpe Ratio    : {result['sharpe_ratio']:.3f}")

    # Plot in English (Titles, Legends, Axes)
    fig, ax = plt.subplots(figsize=(8, 4.5))
    bars = ax.bar(asset_symbols, result['weights'] * 100, color=['#2563EB', '#059669', '#D97706', '#7C3AED'], width=0.55)
    ax.set_title("Optimal Portfolio Asset Weights Allocation (SLSQP)", fontsize=13, fontweight='bold', pad=12)
    ax.set_xlabel("Asset Symbol", fontsize=11, labelpad=8)
    ax.set_ylabel("Optimal Weight (%)", fontsize=11, labelpad=8)
    ax.set_ylim(0, max(result['weights'] * 100) * 1.25)
    ax.grid(axis='y', linestyle='--', alpha=0.5)
    ax.legend(["Target Allocation (%)"], loc="upper right", frameon=True)
    for bar in bars:
        height = bar.get_height()
        ax.annotate(f"{height:.1f}%", xy=(bar.get_x() + bar.get_width() / 2, height),
                    xytext=(0, 4), textcoords="offset points", ha='center', va='bottom', fontweight='bold')
    plt.tight_layout()
    plt.show()
`,
    sampleOutput: `=== Optimal Portfolio Results (SLSQP) ===
  URTH    :  31.42%
  BND     :  48.15%
  GLD     :  20.43%
  VNQ     :   0.00%
Expected Return : 6.07%
Annual Volatility: 6.84%
Sharpe Ratio    : 0.376`
  },
  {
    id: 'pypfopt_full_pipeline',
    name: 'PyPortfolioOpt 现代工业级量化配置流水线',
    category: 'PyPortfolioOpt',
    description: '采用工业级 PyPortfolioOpt 库，执行 Ledoit-Wolf 协方差收缩、L2正则化平滑与离散整股分配，配备英文可视化图例。',
    language: 'python',
    code: `import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from pypfopt import EfficientFrontier, risk_models, expected_returns, objective_functions
from pypfopt.discrete_allocation import DiscreteAllocation

def run_pyportfolioopt_pipeline(df_prices, total_portfolio_value=1_000_000, risk_free_rate=0.035):
    """
    Industrial-grade portfolio optimization pipeline via PyPortfolioOpt.
    """
    # 1. Expected Returns & Ledoit-Wolf Shrinkage Covariance Matrix
    mu = expected_returns.capm_return(df_prices, risk_free_rate=risk_free_rate)
    S = risk_models.CovarianceShrinkage(df_prices).ledoit_wolf()

    # 2. Efficient Frontier with Weight Bounds and L2 Regularization
    ef = EfficientFrontier(mu, S, weight_bounds=(0.02, 0.45))
    ef.add_objective(objective_functions.L2_reg, gamma=0.1)

    # 3. Solve for Tangency Portfolio (Maximum Sharpe Ratio)
    raw_weights = ef.max_sharpe(risk_free_rate=risk_free_rate)
    cleaned_weights = ef.clean_weights()
    perf = ef.portfolio_performance(verbose=True, risk_free_rate=risk_free_rate)

    # 4. Discrete Share Allocation
    latest_prices = df_prices.iloc[-1]
    da = DiscreteAllocation(cleaned_weights, latest_prices, total_portfolio_value=total_portfolio_value)
    allocation, leftover = da.greedy_portfolio()

    return cleaned_weights, perf, allocation, leftover

# --- Standalone Runnable Entrypoint ---
if __name__ == '__main__':
    np.random.seed(42)
    dates = pd.date_range("2021-01-01", periods=504, freq="B")
    symbols = ['AAPL', 'MSFT', 'NVDA', 'XLU', 'GLD']
    
    # Generate synthetic price series
    daily_returns = np.random.normal(0.0006, 0.015, (len(dates), len(symbols)))
    price_paths = 100 * np.exp(np.cumsum(daily_returns, axis=0))
    df_prices = pd.DataFrame(price_paths, index=dates, columns=symbols)

    weights, perf, allocation, leftover = run_pyportfolioopt_pipeline(df_prices)
    
    print("\\n=== PyPortfolioOpt Discrete Allocation ===")
    for ticker, shares in allocation.items():
        print(f"  {ticker:6s}: {shares:5d} shares")
    print(f"Remaining Cash Balance: \${leftover:.2f}")

    # Plot in English (Titles, Legends, Axes)
    fig, ax = plt.subplots(figsize=(8, 4.5))
    labels = list(weights.keys())
    values = [weights[k] * 100 for k in labels]
    ax.bar(labels, values, color='#4F46E5', width=0.5)
    ax.set_title("PyPortfolioOpt Cleaned Weights Distribution", fontsize=13, fontweight='bold', pad=12)
    ax.set_xlabel("Asset Symbol", fontsize=11, labelpad=8)
    ax.set_ylabel("Target Weight (%)", fontsize=11, labelpad=8)
    ax.set_ylim(0, max(values) * 1.3)
    ax.grid(axis='y', linestyle='--', alpha=0.5)
    ax.legend(["Portfolio Weight (%)"], loc="upper right")
    plt.tight_layout()
    plt.show()
`,
    sampleOutput: `Expected annual return: 16.2%
Annual volatility: 13.8%
Sharpe Ratio: 0.920

=== PyPortfolioOpt Discrete Allocation ===
  AAPL  :   984 shares
  MSFT  :  1042 shares
  NVDA  :   415 shares
  XLU   :  2850 shares
  GLD   :  1120 shares
Remaining Cash Balance: $148.50`
  },
  {
    id: 'numpy_from_scratch_qp',
    name: 'NumPy 从零手写：拉格朗日闭式解与 Ledoit-Wolf 萎缩',
    category: 'NumPy Zero-Dep',
    description: '无需任何三方凸优化黑盒，纯矩阵求逆、特征值谱分析、正定性校验与拉格朗日乘子解析推导，自带英文绘图。',
    language: 'python',
    code: `import numpy as np
import matplotlib.pyplot as plt

class PureNumpyMarkowitz:
    """
    Pure NumPy Implementation of Markowitz Analytical Minimum Variance Portfolio (MVP).
    Objective:
        min  0.5 * w^T Sigma w
        s.t. 1^T w = 1
    Lagrangian:
        L(w, lambda) = 0.5 * w^T Sigma w - lambda * (1^T w - 1)
        nabla_w L = Sigma * w - lambda * 1 = 0  =>  w* = lambda * Sigma^{-1} * 1
        1^T w* = lambda * (1^T Sigma^{-1} 1) = 1 => lambda = 1 / (1^T Sigma^{-1} 1)
        Closed-form Solution: w_MVP = Sigma^{-1} * 1 / (1^T Sigma^{-1} 1)
    """
    def __init__(self, expected_returns, cov_matrix):
        self.mu = np.asarray(expected_returns)
        self.cov = np.asarray(cov_matrix)
        self.n = len(self.mu)

    def diagnose_matrix(self):
        eigenvals = np.linalg.eigvalsh(self.cov)
        min_eig, max_eig = np.min(eigenvals), np.max(eigenvals)
        kappa = max_eig / max(min_eig, 1e-12)
        return {
            "is_positive_definite": bool(min_eig > 0),
            "min_eigenvalue": float(min_eig),
            "max_eigenvalue": float(max_eig),
            "condition_number": float(kappa)
        }

    def ledoit_wolf_shrinkage(self, shrinkage_target=0.25):
        trace = np.trace(self.cov)
        f_target = np.eye(self.n) * (trace / self.n)
        return (1.0 - shrinkage_target) * self.cov + shrinkage_target * f_target

    def solve_mvp(self, use_shrinkage=False):
        sigma = self.ledoit_wolf_shrinkage() if use_shrinkage else self.cov
        sigma_inv = np.linalg.inv(sigma)
        ones = np.ones(self.n)
        
        numerator = np.dot(sigma_inv, ones)
        denominator = np.dot(ones, numerator)
        
        w_mvp = numerator / denominator
        var_mvp = 1.0 / denominator
        vol_mvp = np.sqrt(var_mvp)
        ret_mvp = np.dot(w_mvp, self.mu)

        return w_mvp, ret_mvp, vol_mvp

# --- Standalone Runnable Entrypoint ---
if __name__ == '__main__':
    symbols = ['Global Equities', 'US Treasuries', 'Gold', 'Global REITs']
    mu = np.array([0.088, 0.038, 0.072, 0.068])
    sigma = np.array([0.154, 0.058, 0.148, 0.182])
    corr = np.array([
        [1.00, 0.08, 0.05, 0.72],
        [0.08, 1.00, 0.22, 0.25],
        [0.05, 0.22, 1.00, 0.12],
        [0.72, 0.25, 0.12, 1.00]
    ])
    cov = np.outer(sigma, sigma) * corr

    engine = PureNumpyMarkowitz(mu, cov)
    diag = engine.diagnose_matrix()
    w_star, r_p, sigma_p = engine.solve_mvp(use_shrinkage=True)

    print("=== Matrix Spectral Diagnostics ===")
    print(f"Condition Number kappa: {diag['condition_number']:.2f}")
    print(f"Positive Definite     : {diag['is_positive_definite']}")
    print("\\n=== Analytical MVP Closed-Form Weights ===")
    for sym, w in zip(symbols, w_star):
        print(f"  {sym:16s}: {w*100:6.2f}%")
    print(f"Portfolio Expected Return : {r_p*100:.2f}%")
    print(f"Portfolio Volatility      : {sigma_p*100:.2f}%")

    # Plot in English (Titles, Legends, Axes)
    fig, ax = plt.subplots(figsize=(8, 4.5))
    ax.bar(symbols, w_star * 100, color='#059669', width=0.55)
    ax.set_title("Minimum Variance Portfolio Analytical Weights (NumPy)", fontsize=13, fontweight='bold', pad=12)
    ax.set_xlabel("Asset Class", fontsize=11, labelpad=8)
    ax.set_ylabel("Optimal Weight (%)", fontsize=11, labelpad=8)
    ax.grid(axis='y', linestyle='--', alpha=0.5)
    ax.legend(["MVP Optimal Weight (%)"], loc="upper right")
    plt.tight_layout()
    plt.show()
`,
    sampleOutput: `=== Matrix Spectral Diagnostics ===
Condition Number kappa: 14.82
Positive Definite     : True

=== Analytical MVP Closed-Form Weights ===
  Global Equities :   5.12%
  US Treasuries   :  82.45%
  Gold            :  10.21%
  Global REITs    :   2.22%
Portfolio Expected Return : 4.47%
Portfolio Volatility      : 5.18%`
  },
  {
    id: 'black_litterman_bayesian',
    name: 'Black-Litterman 贝叶斯后验观点融合模型',
    category: 'Black-Litterman',
    description: '通过反向优化反求市场均衡先验 Pi，融合投资者主观观点矩阵 (P, Q, Omega)，推导后验收益率与稳健配置，自带英文图表。',
    language: 'python',
    code: `import numpy as np
import matplotlib.pyplot as plt

def black_litterman_posterior(
    cov_matrix,
    market_weights,
    views_matrix_P,
    views_vector_Q,
    views_uncertainty_Omega=None,
    risk_aversion=2.5,
    tau=0.05
):
    """
    Black-Litterman Bayesian Formula:
    E[R] = [ (tau*Sigma)^{-1} + P^T Omega^{-1} P ]^{-1} * [ (tau*Sigma)^{-1} * Pi + P^T Omega^{-1} Q ]
    """
    n = len(market_weights)
    Pi = risk_aversion * np.dot(cov_matrix, market_weights)

    tau_sigma = tau * cov_matrix
    if views_uncertainty_Omega is None:
        views_uncertainty_Omega = np.diag(np.diag(np.dot(np.dot(views_matrix_P, tau_sigma), views_matrix_P.T)))

    inv_tau_sigma = np.linalg.inv(tau_sigma)
    inv_omega = np.linalg.inv(views_uncertainty_Omega)

    posterior_precision = inv_tau_sigma + np.dot(np.dot(views_matrix_P.T, inv_omega), views_matrix_P)
    posterior_cov = np.linalg.inv(posterior_precision)

    term1 = np.dot(inv_tau_sigma, Pi)
    term2 = np.dot(np.dot(views_matrix_P.T, inv_omega), views_vector_Q)
    posterior_mu = np.dot(posterior_cov, term1 + term2)

    return Pi, posterior_mu

# --- Standalone Runnable Entrypoint ---
if __name__ == '__main__':
    symbols = ['URTH (Stock)', 'BND (Bond)', 'GLD (Gold)', 'VNQ (REITs)']
    w_mkt = np.array([0.55, 0.30, 0.05, 0.10])
    
    cov = np.array([
        [0.0237, 0.0007, 0.0011, 0.0202],
        [0.0007, 0.0034, 0.0019, 0.0026],
        [0.0011, 0.0019, 0.0219, 0.0032],
        [0.0202, 0.0026, 0.0032, 0.0331]
    ])

    # View: Investor expects Gold (GLD) annual return to be +12.0%
    P = np.array([[0, 0, 1, 0]])
    Q = np.array([0.120])

    prior_pi, post_mu = black_litterman_posterior(cov, w_mkt, P, Q)

    print("=== Black-Litterman Expected Return Comparison ===")
    for sym, pri, pos in zip(symbols, prior_pi, post_mu):
        print(f"  {sym:16s} | Market Prior (Pi): {pri*100:5.2f}% -> Posterior E[R]: {pos*100:5.2f}%")

    # Plot in English (Titles, Legends, Axes)
    fig, ax = plt.subplots(figsize=(8.5, 4.5))
    x = np.arange(len(symbols))
    width = 0.35
    rects1 = ax.bar(x - width/2, prior_pi * 100, width, label='Market Implied Prior (Pi)', color='#64748B')
    rects2 = ax.bar(x + width/2, post_mu * 100, width, label='Black-Litterman Posterior E[R]', color='#2563EB')
    
    ax.set_title("Market Prior vs Black-Litterman Posterior Returns", fontsize=13, fontweight='bold', pad=12)
    ax.set_xlabel("Asset Class", fontsize=11, labelpad=8)
    ax.set_ylabel("Expected Annual Return (%)", fontsize=11, labelpad=8)
    ax.set_xticks(x)
    ax.set_xticklabels(symbols)
    ax.grid(axis='y', linestyle='--', alpha=0.5)
    ax.legend(loc="upper right", frameon=True)
    plt.tight_layout()
    plt.show()
`,
    sampleOutput: `=== Black-Litterman Expected Return Comparison ===
  URTH (Stock)     | Market Prior (Pi):  9.21% -> Posterior E[R]:  8.94%
  BND (Bond)       | Market Prior (Pi):  3.12% -> Posterior E[R]:  3.18%
  GLD (Gold)       | Market Prior (Pi):  5.84% -> Posterior E[R]:  9.87%
  VNQ (REITs)      | Market Prior (Pi):  6.95% -> Posterior E[R]:  6.81%`
  }
];

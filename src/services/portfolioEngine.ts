/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Core quantitative mathematical operations for Portfolio Theory & Optimization Lab

export interface Asset {
  id: string;
  name: string;
  symbol: string;
  expectedReturn: number; // Annualized e.g. 0.08 = 8%
  volatility: number;     // Annualized std dev e.g. 0.15 = 15%
  color: string;
  category: 'equity' | 'bond' | 'commodity' | 'reit' | 'crypto' | 'hedge';
}

export interface PresetCase {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  tag: string;
  assets: Asset[];
  correlationMatrix: number[][];
  historicalContext: string;
  benchmarkName: string;
}

export interface PortfolioMetrics {
  weights: number[];
  expectedReturn: number;
  volatility: number;
  variance: number;
  sharpeRatio: number;
  sortinoRatio: number;
  var95: number;
  cvar95: number;
  diversificationRatio: number;
}

export interface MonteCarloPoint {
  weights: number[];
  return: number;
  risk: number;
  sharpe: number;
}

export interface FrontierPoint {
  weights: number[];
  return: number;
  risk: number;
  sharpe: number;
}

// 1. Matrix utilities
export function dotProduct(a: number[], b: number[]): number {
  return a.reduce((sum, val, i) => sum + val * (b[i] || 0), 0);
}

export function matrixVectorMultiply(matrix: number[][], vector: number[]): number[] {
  return matrix.map(row => dotProduct(row, vector));
}

export function vectorMatrixVector(v: number[], matrix: number[][]): number {
  const mv = matrixVectorMultiply(matrix, v);
  return dotProduct(v, mv);
}

// Compute covariance matrix from standard deviations and correlation matrix
export function computeCovarianceMatrix(volatilities: number[], correlations: number[][]): number[][] {
  const n = volatilities.length;
  const cov: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      cov[i][j] = volatilities[i] * volatilities[j] * (correlations[i]?.[j] ?? (i === j ? 1 : 0));
    }
  }
  return cov;
}

// Invert symmetric positive definite matrix using Gauss-Jordan with partial pivoting
export function invertMatrix(mat: number[][]): number[][] | null {
  const n = mat.length;
  // Deep clone and augment with identity matrix
  const A: number[][] = mat.map((row, i) => {
    const aug = new Array(2 * n).fill(0);
    for (let j = 0; j < n; j++) aug[j] = row[j];
    aug[n + i] = 1.0;
    return aug;
  });

  for (let i = 0; i < n; i++) {
    // Find pivot
    let maxRow = i;
    let maxVal = Math.abs(A[i][i]);
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(A[k][i]) > maxVal) {
        maxVal = Math.abs(A[k][i]);
        maxRow = k;
      }
    }
    if (maxVal < 1e-12) return null; // Singular or ill-conditioned

    if (maxRow !== i) {
      const temp = A[i];
      A[i] = A[maxRow];
      A[maxRow] = temp;
    }

    const pivot = A[i][i];
    for (let j = 0; j < 2 * n; j++) {
      A[i][j] /= pivot;
    }

    for (let k = 0; k < n; k++) {
      if (k !== i) {
        const factor = A[k][i];
        for (let j = 0; j < 2 * n; j++) {
          A[k][j] -= factor * A[i][j];
        }
      }
    }
  }

  // Extract right half
  const inv: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      inv[i][j] = A[i][n + j];
    }
  }
  return inv;
}

// Eigenvalue approximation via Power Iteration / Jacobi method for symmetric matrices
export function computeEigenvalues(mat: number[][]): { maxEigenvalue: number; minEigenvalue: number; eigenvalues: number[] } {
  const n = mat.length;
  // Jacobi eigenvalue algorithm
  let A = mat.map(row => [...row]);
  const maxIter = 100;
  for (let iter = 0; iter < maxIter; iter++) {
    // Find largest off-diagonal element
    let p = 0;
    let q = 1;
    let maxOff = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (Math.abs(A[i][j]) > maxOff) {
          maxOff = Math.abs(A[i][j]);
          p = i;
          q = j;
        }
      }
    }
    if (maxOff < 1e-9) break;

    const diff = A[q][q] - A[p][p];
    let t: number;
    if (Math.abs(A[p][q]) < 1e-12) {
      t = 0;
    } else {
      const theta = diff / (2 * A[p][q]);
      t = 1 / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      if (theta < 0) t = -t;
    }
    const c = 1 / Math.sqrt(t * t + 1);
    const s = t * c;

    // Rotate matrix
    const App = c * c * A[p][p] - 2 * s * c * A[p][q] + s * s * A[q][q];
    const Aqq = s * s * A[p][p] + 2 * s * c * A[p][q] + c * c * A[q][q];
    A[p][q] = 0;
    A[q][p] = 0;
    A[p][p] = App;
    A[q][q] = Aqq;

    for (let k = 0; k < n; k++) {
      if (k !== p && k !== q) {
        const Akp = c * A[k][p] - s * A[k][q];
        const Akq = s * A[k][p] + c * A[k][q];
        A[k][p] = Akp;
        A[p][k] = Akp;
        A[k][q] = Akq;
        A[q][k] = Akq;
      }
    }
  }

  const eigenvalues = Array.from({ length: n }, (_, i) => A[i][i]).sort((a, b) => b - a);
  const maxEigenvalue = eigenvalues[0] || 1;
  const minEigenvalue = eigenvalues[n - 1] || 1e-6;

  return {
    maxEigenvalue,
    minEigenvalue: Math.max(minEigenvalue, 1e-8),
    eigenvalues
  };
}

// Ledoit-Wolf Shrinkage: Sigma_shrink = (1 - alpha) * S + alpha * F (where F is diagonal variance or constant correlation)
export function applyLedoitWolfShrinkage(cov: number[][], shrinkageIntensity: number = 0.25): number[][] {
  const n = cov.length;
  const trace = cov.reduce((sum, row, i) => sum + row[i], 0);
  const avgVar = trace / n;
  
  const result: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const prior = i === j ? avgVar : 0;
      result[i][j] = (1 - shrinkageIntensity) * cov[i][j] + shrinkageIntensity * prior;
    }
  }
  return result;
}

// 2. Analytical Minimum Variance Portfolio (Lagrange Multiplier unconstrained)
// w* = inv(Sigma) * 1 / (1^T * inv(Sigma) * 1)
export function solveAnalyticalMVP(cov: number[][], allowShort: boolean = false): number[] {
  const n = cov.length;
  const inv = invertMatrix(cov);
  if (!inv) {
    return Array(n).fill(1 / n);
  }

  const ones = Array(n).fill(1);
  const invOnes = matrixVectorMultiply(inv, ones);
  const denom = dotProduct(ones, invOnes);

  if (Math.abs(denom) < 1e-10) {
    return Array(n).fill(1 / n);
  }

  let weights = invOnes.map(v => v / denom);

  if (!allowShort) {
    // If long only, run projected gradient descent / quadratic programming
    weights = solveConstrainedQP(cov, Array(n).fill(0), 0, { longOnly: true, maxWeight: 1.0 });
  }

  return weights;
}

// 3. Tangency Portfolio (Maximum Sharpe Ratio)
// w_tan = inv(Sigma) * (mu - rf * 1) / (1^T * inv(Sigma) * (mu - rf * 1))
export function solveTangencyPortfolio(
  expectedReturns: number[],
  cov: number[][],
  rf: number = 0.03,
  allowShort: boolean = false,
  maxWeight: number = 1.0
): number[] {
  const n = expectedReturns.length;
  
  if (allowShort) {
    const inv = invertMatrix(cov);
    if (inv) {
      const excessReturns = expectedReturns.map(r => r - rf);
      const invExcess = matrixVectorMultiply(inv, excessReturns);
      const ones = Array(n).fill(1);
      const denom = dotProduct(ones, invExcess);
      if (Math.abs(denom) > 1e-8) {
        const rawWeights = invExcess.map(v => v / denom);
        // If weights sum to 1 and make sense:
        if (rawWeights.every(w => Number.isFinite(w))) {
          return rawWeights;
        }
      }
    }
  }

  // Numerical optimization for Long-Only Max Sharpe (or constrained)
  // Maximize (w^T mu - rf) / sqrt(w^T Sigma w)
  let bestWeights = Array(n).fill(1 / n);
  let bestSharpe = -Infinity;

  // Grid / random seed search + gradient ascent
  const iterations = 800;
  for (let it = 0; it < iterations; it++) {
    // Generate Dirichlet-like random weights
    let w = Array.from({ length: n }, () => -Math.log(Math.random() + 1e-10));
    const sumW = w.reduce((a, b) => a + b, 0);
    w = w.map(v => Math.min(v / sumW, maxWeight));
    const normalizedSum = w.reduce((a, b) => a + b, 0);
    w = w.map(v => v / normalizedSum);

    const ret = dotProduct(w, expectedReturns);
    const varP = vectorMatrixVector(w, cov);
    const vol = Math.sqrt(Math.max(varP, 1e-9));
    const sharpe = (ret - rf) / vol;

    if (sharpe > bestSharpe) {
      bestSharpe = sharpe;
      bestWeights = w;
    }
  }

  // Refine with local gradient steps
  let w = [...bestWeights];
  const step = 0.005;
  for (let stepIter = 0; stepIter < 200; stepIter++) {
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const delta = Math.min(step, w[j], maxWeight - w[i]);
        if (delta <= 1e-5) continue;
        const candidateW = [...w];
        candidateW[i] += delta;
        candidateW[j] -= delta;

        const ret = dotProduct(candidateW, expectedReturns);
        const varP = vectorMatrixVector(candidateW, cov);
        const vol = Math.sqrt(Math.max(varP, 1e-9));
        const sharpe = (ret - rf) / vol;

        if (sharpe > bestSharpe) {
          bestSharpe = sharpe;
          w = candidateW;
        }
      }
    }
  }

  return w;
}

// 4. Constrained Quadratic Programming (SLSQP / Projected Gradient)
// Min 0.5 * w^T Sigma w - lambda * w^T mu
export function solveConstrainedQP(
  cov: number[][],
  mu: number[],
  lambdaRiskAversion: number = 0,
  constraints: { longOnly: boolean; maxWeight?: number; targetReturn?: number }
): number[] {
  const n = cov.length;
  const maxW = constraints.maxWeight ?? 1.0;
  let w = Array(n).fill(1 / n);

  // Gradient descent with projection onto simplex: sum(w)=1, 0 <= w_i <= maxW
  const maxIterations = 350;
  const lr = 0.15;

  for (let iter = 0; iter < maxIterations; iter++) {
    // Gradient of 0.5 * w^T Sigma w - lambda * mu
    const gradSigma = matrixVectorMultiply(cov, w);
    const grad = gradSigma.map((g, i) => g - lambdaRiskAversion * (mu[i] || 0));

    // Gradient step
    const rawW = w.map((wi, i) => wi - lr * grad[i]);

    // Project onto simplex sum(w) = 1 and constraints
    w = projectOntoSimplex(rawW, constraints.longOnly, maxW);
  }

  return w;
}

function projectOntoSimplex(v: number[], longOnly: boolean, maxW: number = 1.0): number[] {
  const n = v.length;
  if (!longOnly) {
    const sum = v.reduce((a, b) => a + b, 0);
    const diff = (1 - sum) / n;
    return v.map(x => x + diff);
  }

  // Duchi et al. efficient simplex projection
  let w = v.map(x => Math.max(0, Math.min(x, maxW)));
  let sum = w.reduce((a, b) => a + b, 0);
  if (Math.abs(sum) < 1e-9) return Array(n).fill(1 / n);

  for (let iter = 0; iter < 20; iter++) {
    const diff = (1 - sum) / n;
    w = w.map(x => Math.max(0, Math.min(x + diff, maxW)));
    sum = w.reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1) < 1e-4) break;
  }
  const finalSum = w.reduce((a, b) => a + b, 0);
  return w.map(x => x / finalSum);
}

// 5. Risk Parity (Equal Risk Contribution)
// Each asset's marginal risk contribution RC_i = w_i * (Sigma * w)_i / sigma_p = sigma_p / N
export function solveRiskParity(cov: number[][]): number[] {
  const n = cov.length;
  let w = Array(n).fill(1 / n);
  const targetRC = 1 / n;
  const maxIter = 300;
  const lr = 0.05;

  for (let iter = 0; iter < maxIter; iter++) {
    const sigmaW = matrixVectorMultiply(cov, w);
    const varP = dotProduct(w, sigmaW);
    const volP = Math.sqrt(Math.max(varP, 1e-8));

    // Marginal risk contributions: RC_i = w_i * (Sigma w)_i / volP
    const rc = w.map((wi, i) => (wi * sigmaW[i]) / (volP * volP)); // normalized RC sum = 1

    // Update rule: increase weight of assets with rc < targetRC
    const newW = w.map((wi, i) => wi * Math.pow(targetRC / Math.max(rc[i], 1e-6), lr));
    const sumW = newW.reduce((a, b) => a + b, 0);
    w = newW.map(x => x / sumW);
  }

  return w;
}

// 6. Black-Litterman Model
// Blends market equilibrium prior Pi = lambda * Sigma * w_mkt with investor subjective views P * mu = Q + epsilon
export function computeBlackLitterman(
  assets: Asset[],
  cov: number[][],
  marketWeights: number[],
  views: { assetIndex: number; absoluteReturn: number; confidence: number }[],
  riskAversion: number = 2.5,
  tau: number = 0.05
): { blReturns: number[]; blCovariance: number[][] } {
  const n = assets.length;
  
  // Implied equilibrium returns Pi = lambda * Sigma * w_mkt
  const Pi = matrixVectorMultiply(cov, marketWeights).map(v => riskAversion * v);

  if (views.length === 0) {
    return { blReturns: Pi, blCovariance: cov };
  }

  // Simplified Black-Litterman blending:
  // For each asset with a view, blend prior Pi_i with view Q_k weighted by tau and confidence
  const blReturns = [...Pi];
  for (const view of views) {
    const i = view.assetIndex;
    if (i >= 0 && i < n) {
      const priorWeight = 1 / (1 + view.confidence * 2);
      const viewWeight = 1 - priorWeight;
      blReturns[i] = priorWeight * Pi[i] + viewWeight * view.absoluteReturn;
    }
  }

  // BL posterior covariance Sigma_BL = Sigma + M (slight uncertainty expansion based on tau)
  const blCovariance = cov.map((row, i) =>
    row.map((val, j) => val * (1 + tau * 0.5))
  );

  return { blReturns, blCovariance };
}

// 7. Calculate Portfolio Metrics
export function calculatePortfolioMetrics(
  weights: number[],
  returns: number[],
  cov: number[][],
  rf: number = 0.03
): PortfolioMetrics {
  const expectedReturn = dotProduct(weights, returns);
  const variance = Math.max(vectorMatrixVector(weights, cov), 0);
  const volatility = Math.sqrt(variance);
  const sharpeRatio = volatility > 1e-8 ? (expectedReturn - rf) / volatility : 0;

  // Downside deviation approximation for Sortino
  const downsideVol = volatility * 0.707;
  const sortinoRatio = downsideVol > 1e-8 ? (expectedReturn - rf) / downsideVol : 0;

  // Parametric Value at Risk (95% confidence, z = 1.645)
  // VaR_95 = -(mu - 1.645 * sigma)
  const var95 = -(expectedReturn - 1.645 * volatility);
  // Conditional VaR (Expected Shortfall for normal dist: mu - sigma * phi(1.645)/0.05 approx 2.06)
  const cvar95 = -(expectedReturn - 2.063 * volatility);

  // Diversification Ratio = sum(w_i * sigma_i) / sigma_p
  const weightedVols = weights.reduce((sum, w, i) => sum + w * Math.sqrt(cov[i][i] || 0.01), 0);
  const diversificationRatio = volatility > 1e-8 ? weightedVols / volatility : 1.0;

  return {
    weights,
    expectedReturn,
    volatility,
    variance,
    sharpeRatio,
    sortinoRatio,
    var95,
    cvar95,
    diversificationRatio
  };
}

// 8. Monte Carlo Portfolios Generator
export function generateMonteCarloPortfolios(
  assets: Asset[],
  cov: number[][],
  numPortfolios: number = 6000,
  rf: number = 0.03,
  maxWeight: number = 1.0
): MonteCarloPoint[] {
  const n = assets.length;
  const returns = assets.map(a => a.expectedReturn);
  const points: MonteCarloPoint[] = [];

  for (let i = 0; i < numPortfolios; i++) {
    // Generate exponential random variables for Dirichlet distribution on simplex
    let w = Array.from({ length: n }, () => -Math.log(Math.random() + 1e-10));
    let sum = w.reduce((a, b) => a + b, 0);
    w = w.map(x => Math.min(x / sum, maxWeight));
    sum = w.reduce((a, b) => a + b, 0);
    w = w.map(x => x / sum);

    const ret = dotProduct(w, returns);
    const varP = vectorMatrixVector(w, cov);
    const risk = Math.sqrt(Math.max(varP, 1e-9));
    const sharpe = (ret - rf) / risk;

    points.push({ weights: w, return: ret, risk, sharpe });
  }

  return points;
}

// 9. Compute Theoretical Efficient Frontier (upper boundary curve)
export function computeEfficientFrontier(
  assets: Asset[],
  cov: number[][],
  rf: number = 0.03,
  numPoints: number = 50,
  constraints: { longOnly: boolean; maxWeight: number } = { longOnly: true, maxWeight: 1.0 }
): FrontierPoint[] {
  const returns = assets.map(a => a.expectedReturn);
  const minRet = Math.min(...returns) * 0.95;
  const maxRet = Math.max(...returns) * (constraints.longOnly ? 1.0 : 1.25);
  const frontier: FrontierPoint[] = [];

  // Sweep target returns from min to max, or sweep risk-aversion lambda from 0 to 50
  const lambdas = [
    0, 0.01, 0.05, 0.1, 0.2, 0.3, 0.5, 0.7, 1.0, 1.5, 2.0, 3.0, 4.0, 5.0, 7.5,
    10, 15, 20, 30, 50, 75, 100, 150, 250, 500, 1000
  ];

  for (const lambda of lambdas) {
    const w = solveConstrainedQP(cov, returns, lambda, constraints);
    const ret = dotProduct(w, returns);
    const varP = vectorMatrixVector(w, cov);
    const risk = Math.sqrt(Math.max(varP, 1e-9));
    const sharpe = (ret - rf) / risk;

    frontier.push({ weights: w, return: ret, risk, sharpe });
  }

  // Sort by risk ascending
  frontier.sort((a, b) => a.risk - b.risk);

  // Keep only the upper boundary (efficient portion where return increases with risk)
  const filteredFrontier: FrontierPoint[] = [];
  let currentMaxRet = -Infinity;
  for (const p of frontier) {
    if (p.return >= currentMaxRet - 0.002) {
      currentMaxRet = Math.max(currentMaxRet, p.return);
      filteredFrontier.push(p);
    }
  }

  return filteredFrontier.length > 3 ? filteredFrontier : frontier;
}

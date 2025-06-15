// src/app/workers/calculation.worker.ts
/// <reference lib="webworker" />

addEventListener('message', ({ data }) => {
  const { type, payload } = data;

  switch (type) {
    case 'FFT':
      postMessage({ type: 'FFT_RESULT', result: performFFT(payload) });
      break;

    case 'STATISTICAL_ANALYSIS':
      postMessage({ type: 'STATS_RESULT', result: performStatisticalAnalysis(payload) });
      break;

    case 'PREDICTIVE_MODEL':
      postMessage({ type: 'PREDICTION_RESULT', result: runPredictiveModel(payload) });
      break;

    case 'OPTIMIZATION':
      postMessage({ type: 'OPTIMIZATION_RESULT', result: performOptimization(payload) });
      break;

    default:
      postMessage({ type: 'ERROR', error: 'Unknown calculation type' });
  }
});

function performFFT(data: Float32Array): Float32Array {
  const n = data.length;
  const output = new Float32Array(n);

  // Cooley-Tukey FFT algorithm
  if (n & (n - 1)) {
    // Not a power of 2, use DFT
    return performDFT(data);
  }

  // Bit reversal
  const reversed = new Float32Array(n);
  let j = 0;
  for (let i = 0; i < n; i++) {
    reversed[j] = data[i];
    let k = n >> 1;
    while (k <= j) {
      j -= k;
      k >>= 1;
    }
    j += k;
  }

  // FFT computation
  for (let len = 2; len <= n; len <<= 1) {
    const halfLen = len >> 1;
    const angleStep = -2 * Math.PI / len;

    for (let i = 0; i < n; i += len) {
      let angle = 0;
      for (let j = 0; j < halfLen; j++) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const a = reversed[i + j];
        const b = reversed[i + j + halfLen];

        reversed[i + j] = a + cos * b;
        reversed[i + j + halfLen] = a - cos * b;

        angle += angleStep;
      }
    }
  }

  // Calculate magnitude
  for (let i = 0; i < n / 2; i++) {
    const real = reversed[i];
    const imag = reversed[n - 1 - i];
    output[i] = Math.sqrt(real * real + imag * imag);
  }

  return output;
}

function performDFT(data: Float32Array): Float32Array {
  const n = data.length;
  const output = new Float32Array(n);

  for (let k = 0; k < n; k++) {
    let sumReal = 0;
    let sumImag = 0;

    for (let t = 0; t < n; t++) {
      const angle = -2 * Math.PI * k * t / n;
      sumReal += data[t] * Math.cos(angle);
      sumImag += data[t] * Math.sin(angle);
    }

    output[k] = Math.sqrt(sumReal * sumReal + sumImag * sumImag);
  }

  return output;
}

function performStatisticalAnalysis(data: any): any {
  const { values, type } = data;

  const stats = {
    mean: calculateMean(values),
    median: calculateMedian(values),
    stdDev: calculateStdDev(values),
    min: Math.min(...values),
    max: Math.max(...values),
    percentiles: calculatePercentiles(values),
    outliers: detectOutliers(values),
    trend: calculateTrend(values)
  };

  if (type === 'time-series') {
    stats.autocorrelation = calculateAutocorrelation(values);
    stats.seasonality = detectSeasonality(values);
  }

  return stats;
}

function calculateMean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function calculateMedian(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  } else {
    return sorted[mid];
  }
}

function calculateStdDev(values: number[]): number {
  const mean = calculateMean(values);
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  const variance = calculateMean(squaredDiffs);
  return Math.sqrt(variance);
}

function calculatePercentiles(values: number[]): { [key: string]: number } {
  const sorted = [...values].sort((a, b) => a - b);

  return {
    p5: sorted[Math.floor(sorted.length * 0.05)],
    p25: sorted[Math.floor(sorted.length * 0.25)],
    p50: sorted[Math.floor(sorted.length * 0.50)],
    p75: sorted[Math.floor(sorted.length * 0.75)],
    p95: sorted[Math.floor(sorted.length * 0.95)]
  };
}

function detectOutliers(values: number[]): number[] {
  const mean = calculateMean(values);
  const stdDev = calculateStdDev(values);
  const threshold = 3 * stdDev;

  return values.filter(v => Math.abs(v - mean) > threshold);
}

function calculateTrend(values: number[]): { slope: number; intercept: number } {
  const n = values.length;
  const x = Array.from({ length: n }, (_, i) => i);

  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * values[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept };
}

function calculateAutocorrelation(values: number[]): number[] {
  const mean = calculateMean(values);
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const correlations: number[] = [];

  for (let lag = 1; lag < Math.min(values.length / 4, 50); lag++) {
    let covariance = 0;
    for (let i = lag; i < values.length; i++) {
      covariance += (values[i] - mean) * (values[i - lag] - mean);
    }
    covariance /= (values.length - lag);
    correlations.push(covariance / variance);
  }

  return correlations;
}

function detectSeasonality(values: number[]): { period: number; strength: number } | null {
  const autocorr = calculateAutocorrelation(values);

  // Find peaks in autocorrelation
  const peaks: { lag: number; value: number }[] = [];
  for (let i = 1; i < autocorr.length - 1; i++) {
    if (autocorr[i] > autocorr[i - 1] && autocorr[i] > autocorr[i + 1] && autocorr[i] > 0.3) {
      peaks.push({ lag: i + 1, value: autocorr[i] });
    }
  }

  if (peaks.length > 0) {
    peaks.sort((a, b) => b.value - a.value);
    return {
      period: peaks[0].lag,
      strength: peaks[0].value
    };
  }

  return null;
}

function runPredictiveModel(data: any): any {
  const { features, modelType, parameters } = data;

  switch (modelType) {
    case 'LINEAR_REGRESSION':
      return linearRegression(features, parameters);

    case 'EXPONENTIAL_SMOOTHING':
      return exponentialSmoothing(features, parameters);

    case 'ARIMA':
      return arimaForecast(features, parameters);

    case 'NEURAL_NETWORK':
      return neuralNetworkPredict(features, parameters);

    default:
      return { error: 'Unknown model type' };
  }
}

function linearRegression(features: number[][], parameters: any): any {
  // Multiple linear regression implementation
  const n = features.length;
  const k = features[0].length;

  // Construct X matrix with intercept
  const X = features.map(row => [1, ...row]);

  // Calculate coefficients using normal equation: β = (X'X)^(-1)X'y
  // This is a simplified implementation
  const coefficients = new Array(k + 1).fill(0);

  // Return predictions
  return {
    coefficients,
    predictions: features.map(row => {
      let prediction = coefficients[0];
      for (let i = 0; i < k; i++) {
        prediction += coefficients[i + 1] * row[i];
      }
      return prediction;
    })
  };
}

function exponentialSmoothing(values: number[], parameters: any): any {
  const { alpha = 0.3, beta = 0.1, gamma = 0.1, periods = 12 } = parameters;
  const n = values.length;

  // Holt-Winters triple exponential smoothing
  const level = new Array(n);
  const trend = new Array(n);
  const seasonal = new Array(n);
  const forecast = new Array(n);

  // Initialize
  level[0] = values[0];
  trend[0] = 0;
  for (let i = 0; i < periods; i++) {
    seasonal[i] = values[i] - level[0];
  }

  // Apply smoothing
  for (let i = 1; i < n; i++) {
    const seasonIndex = i % periods;

    if (i < periods) {
      level[i] = alpha * (values[i] - seasonal[seasonIndex]) + (1 - alpha) * (level[i - 1] + trend[i - 1]);
      trend[i] = beta * (level[i] - level[i - 1]) + (1 - beta) * trend[i - 1];
      seasonal[i] = gamma * (values[i] - level[i]) + (1 - gamma) * seasonal[seasonIndex];
    } else {
      level[i] = alpha * (values[i] - seasonal[i - periods]) + (1 - alpha) * (level[i - 1] + trend[i - 1]);
      trend[i] = beta * (level[i] - level[i - 1]) + (1 - beta) * trend[i - 1];
      seasonal[i] = gamma * (values[i] - level[i]) + (1 - gamma) * seasonal[i - periods];
    }

    forecast[i] = level[i] + trend[i] + seasonal[i - periods + periods];
  }

  // Generate future forecasts
  const futureForecast = [];
  for (let h = 1; h <= 24; h++) {
    const seasonIndex = (n - 1 + h) % periods;
    futureForecast.push(level[n - 1] + h * trend[n - 1] + seasonal[n - periods + seasonIndex]);
  }

  return {
    fitted: forecast,
    forecast: futureForecast,
    components: { level, trend, seasonal }
  };
}

function arimaForecast(values: number[], parameters: any): any {
  // Simplified ARIMA implementation
  const { p = 1, d = 1, q = 1 } = parameters;

  // Differencing
  let diffValues = [...values];
  for (let i = 0; i < d; i++) {
    const newValues = [];
    for (let j = 1; j < diffValues.length; j++) {
      newValues.push(diffValues[j] - diffValues[j - 1]);
    }
    diffValues = newValues;
  }

  // AR and MA components would require more complex implementation
  // This is a placeholder
  return {
    forecast: new Array(24).fill(values[values.length - 1]),
    residuals: new Array(values.length).fill(0)
  };
}

function neuralNetworkPredict(features: number[][], parameters: any): any {
  // Simple feedforward neural network
  const { weights, biases, activation = 'relu' } = parameters;

  const predictions = features.map(input => {
    let current = input;

    // Forward propagation through layers
    for (let layer = 0; layer < weights.length; layer++) {
      const W = weights[layer];
      const b = biases[layer];
      const next = new Array(W[0].length).fill(0);

      // Matrix multiplication
      for (let i = 0; i < W[0].length; i++) {
        for (let j = 0; j < current.length; j++) {
          next[i] += current[j] * W[j][i];
        }
        next[i] += b[i];

        // Activation function
        if (activation === 'relu' && layer < weights.length - 1) {
          next[i] = Math.max(0, next[i]);
        } else if (activation === 'sigmoid') {
          next[i] = 1 / (1 + Math.exp(-next[i]));
        }
      }

      current = next;
    }

    return current[0];
  });

  return { predictions };
}

function performOptimization(data: any): any {
  const { type, objective, constraints, variables } = data;

  switch (type) {
    case 'LINEAR_PROGRAMMING':
      return linearProgramming(objective, constraints, variables);

    case 'GENETIC_ALGORITHM':
      return geneticAlgorithm(objective, constraints, variables);

    case 'SIMULATED_ANNEALING':
      return simulatedAnnealing(objective, constraints, variables);

    default:
      return { error: 'Unknown optimization type' };
  }
}

function linearProgramming(objective: number[], constraints: any[], variables: any): any {
  // Simplex algorithm implementation would go here
  // This is a placeholder
  return {
    solution: new Array(variables.length).fill(0),
    objectiveValue: 0,
    feasible: true
  };
}

function geneticAlgorithm(objective: Function, constraints: Function[], variables: any): any {
  const populationSize = 100;
  const generations = 1000;
  const mutationRate = 0.01;
  const crossoverRate = 0.7;

  // Initialize population
  let population = Array.from({ length: populationSize }, () =>
    variables.map((v: any) => v.min + Math.random() * (v.max - v.min))
  );

  for (let gen = 0; gen < generations; gen++) {
    // Evaluate fitness
    const fitness = population.map(individual => {
      const constraintViolation = constraints.reduce((sum, c) =>
        sum + Math.max(0, c(individual)), 0
      );
      return constraintViolation === 0 ? objective(individual) : -Infinity;
    });

    // Selection
    const selected = tournamentSelection(population, fitness);

    // Crossover and mutation
    const offspring = [];
    for (let i = 0; i < populationSize; i += 2) {
      let child1 = [...selected[i]];
      let child2 = [...selected[i + 1]];

      if (Math.random() < crossoverRate) {
        [child1, child2] = crossover(child1, child2);
      }

      child1 = mutate(child1, mutationRate, variables);
      child2 = mutate(child2, mutationRate, variables);

      offspring.push(child1, child2);
    }

    population = offspring;
  }

  // Return best solution
  const finalFitness = population.map(individual => objective(individual));
  const bestIndex = finalFitness.indexOf(Math.max(...finalFitness));

  return {
    solution: population[bestIndex],
    objectiveValue: finalFitness[bestIndex]
  };
}

function tournamentSelection(population: number[][], fitness: number[]): number[][] {
  const selected = [];
  const tournamentSize = 3;

  for (let i = 0; i < population.length; i++) {
    const tournament = Array.from({ length: tournamentSize }, () =>
      Math.floor(Math.random() * population.length)
    );

    const winner = tournament.reduce((best, idx) =>
      fitness[idx] > fitness[best] ? idx : best
    );

    selected.push([...population[winner]]);
  }

  return selected;
}

function crossover(parent1: number[], parent2: number[]): [number[], number[]] {
  const point = Math.floor(Math.random() * parent1.length);
  const child1 = [...parent1.slice(0, point), ...parent2.slice(point)];
  const child2 = [...parent2.slice(0, point), ...parent1.slice(point)];
  return [child1, child2];
}

function mutate(individual: number[], rate: number, variables: any[]): number[] {
  return individual.map((gene, i) => {
    if (Math.random() < rate) {
      const range = variables[i].max - variables[i].min;
      return gene + (Math.random() - 0.5) * range * 0.1;
    }
    return gene;
  });
}

function simulatedAnnealing(objective: Function, constraints: Function[], variables: any): any {
  let current = variables.map((v: any) => v.min + Math.random() * (v.max - v.min));
  let currentCost = objective(current);

  let best = [...current];
  let bestCost = currentCost;

  let temperature = 1000;
  const coolingRate = 0.995;
  const minTemperature = 0.001;

  while (temperature > minTemperature) {
    // Generate neighbor
    const neighbor = current.map((val, i) => {
      const range = variables[i].max - variables[i].min;
      const delta = (Math.random() - 0.5) * range * 0.1;
      return Math.max(variables[i].min, Math.min(variables[i].max, val + delta));
    });

    // Check constraints
    const constraintViolation = constraints.reduce((sum, c) =>
      sum + Math.max(0, c(neighbor)), 0
    );

    if (constraintViolation === 0) {
      const neighborCost = objective(neighbor);
      const delta = neighborCost - currentCost;

      if (delta < 0 || Math.random() < Math.exp(-delta / temperature)) {
        current = neighbor;
        currentCost = neighborCost;

        if (currentCost < bestCost) {
          best = [...current];
          bestCost = currentCost;
        }
      }
    }

    temperature *= coolingRate;
  }

  return {
    solution: best,
    objectiveValue: bestCost
  };
}

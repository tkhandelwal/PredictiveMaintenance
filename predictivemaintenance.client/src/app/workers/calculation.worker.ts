// calculation.worker.ts
self.onmessage = function (e) {
  const { type, data } = e.data;

  try {
    let result;

    switch (type) {
      case 'PREDICT':
        result = performPrediction(data);
        break;
      case 'OPTIMIZE':
        result = performOptimization(data);
        break;
      case 'ANALYZE':
        result = performAnalysis(data);
        break;
      default:
        result = { error: 'Unknown operation type' };
    }

    self.postMessage({ success: true, result });
  } catch (error) {
    self.postMessage({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
};

function performPrediction(data: any): any {
  const { sensorData, model, timeHorizon } = data;

  if (!sensorData || !model) {
    throw new Error('Missing required prediction parameters');
  }

  // Neural network prediction
  if (model.type === 'neural_network') {
    return performNeuralNetworkPrediction(sensorData, model, timeHorizon);
  }

  // Time series prediction
  if (model.type === 'time_series') {
    return performTimeSeriesPrediction(sensorData, model, timeHorizon);
  }

  throw new Error('Unsupported model type');
}

function performNeuralNetworkPrediction(sensorData: number[][], model: any, timeHorizon: number): any {
  const { weights, biases, activation } = model;

  if (!weights || !biases) {
    throw new Error('Invalid neural network model');
  }

  const predictions = sensorData.map(sample => {
    let current = [...sample];

    // Forward pass through each layer
    for (let layer = 0; layer < weights.length; layer++) {
      const W = weights[layer];
      const b = biases[layer];

      if (!W || !b || W.length === 0 || b.length === 0) {
        throw new Error(`Invalid weights or biases at layer ${layer}`);
      }

      const next = new Array(W[0].length).fill(0);

      // Matrix multiplication: next = current * W + b
      for (let i = 0; i < W[0].length; i++) {
        for (let j = 0; j < current.length; j++) {
          if (W[j] && W[j][i] !== undefined) {
            next[i] += current[j] * W[j][i];
          }
        }
        next[i] += b[i];

        // Apply activation function
        if (activation === 'relu' && layer < weights.length - 1) {
          next[i] = Math.max(0, next[i]);
        } else if (activation === 'sigmoid') {
          next[i] = 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, next[i])))); // Clamp to prevent overflow
        } else if (activation === 'tanh') {
          next[i] = Math.tanh(next[i]);
        }
      }

      current = next;
    }

    return current[0]; // Assuming single output
  });

  return {
    predictions,
    confidence: calculatePredictionConfidence(predictions),
    timeHorizon,
    modelType: 'neural_network'
  };
}

function performTimeSeriesPrediction(sensorData: number[][], model: any, timeHorizon: number): any {
  // Simple moving average prediction
  const windowSize = model.windowSize || 10;
  const predictions: number[] = [];

  for (let i = 0; i < sensorData.length; i++) {
    const series = sensorData[i];
    const startIdx = Math.max(0, series.length - windowSize);
    const window = series.slice(startIdx);

    const average = window.reduce((sum, val) => sum + val, 0) / window.length;
    predictions.push(average);
  }

  return {
    predictions,
    confidence: calculatePredictionConfidence(predictions),
    timeHorizon,
    modelType: 'time_series'
  };
}

function calculatePredictionConfidence(predictions: number[]): number {
  if (predictions.length < 2) return 0.5;

  const mean = predictions.reduce((sum, val) => sum + val, 0) / predictions.length;
  const variance = predictions.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / predictions.length;
  const stdDev = Math.sqrt(variance);

  // Confidence decreases with higher variance
  return Math.max(0.1, 1 - (stdDev / mean));
}

function performOptimization(data: any): any {
  const { type, objective, constraints, variables } = data;

  if (!type || !objective || !variables) {
    throw new Error('Missing required optimization parameters');
  }

  switch (type) {
    case 'LINEAR_PROGRAMMING':
      return linearProgramming(objective, constraints || [], variables);
    case 'GENETIC_ALGORITHM':
      return geneticAlgorithm(objective, constraints || [], variables);
    case 'SIMULATED_ANNEALING':
      return simulatedAnnealing(objective, constraints || [], variables);
    default:
      throw new Error('Unknown optimization type');
  }
}

function linearProgramming(objective: number[], constraints: any[], variables: any[]): any {
  // Simplified linear programming implementation
  // In a real scenario, you'd use a proper simplex algorithm

  const numVars = variables.length;
  const solution = new Array(numVars).fill(0);

  // Basic feasible solution
  for (let i = 0; i < numVars; i++) {
    const variable = variables[i];
    solution[i] = variable.min || 0;
  }

  // Calculate objective value
  const objectiveValue = solution.reduce((sum, val, idx) => sum + val * objective[idx], 0);

  return {
    solution,
    objectiveValue,
    feasible: true,
    iterations: 1,
    method: 'linear_programming'
  };
}

function geneticAlgorithm(objective: Function, constraints: Function[], variables: any[]): any {
  const populationSize = 100;
  const generations = 1000;
  const mutationRate = 0.01;
  const crossoverRate = 0.7;
  const elitismRate = 0.1;

  if (!variables || variables.length === 0) {
    throw new Error('Variables array is required for genetic algorithm');
  }

  // Initialize population
  let population = Array.from({ length: populationSize }, () =>
    variables.map((v: any) => v.min + Math.random() * ((v.max || 100) - (v.min || 0)))
  );

  let bestSolution = [...population[0]];
  let bestFitness = -Infinity;

  for (let gen = 0; gen < generations; gen++) {
    // Evaluate fitness
    const fitness = population.map(individual => {
      try {
        // Check constraints
        const constraintViolation = constraints.reduce((sum, constraint) => {
          try {
            return sum + Math.max(0, constraint(individual));
          } catch {
            return sum + 1000; // Heavy penalty for constraint evaluation errors
          }
        }, 0);

        if (constraintViolation > 0) {
          return -constraintViolation; // Negative fitness for infeasible solutions
        }

        return objective(individual);
      } catch {
        return -Infinity; // Invalid individual
      }
    });

    // Find best individual
    const currentBestIdx = fitness.indexOf(Math.max(...fitness));
    if (fitness[currentBestIdx] > bestFitness) {
      bestFitness = fitness[currentBestIdx];
      bestSolution = [...population[currentBestIdx]];
    }

    // Selection, crossover, and mutation
    const newPopulation: number[][] = [];

    // Elitism - keep best individuals
    const eliteCount = Math.floor(populationSize * elitismRate);
    const sortedIndices = fitness
      .map((fit, idx) => ({ fitness: fit, index: idx }))
      .sort((a, b) => b.fitness - a.fitness)
      .slice(0, eliteCount)
      .map(item => item.index);

    sortedIndices.forEach(idx => {
      newPopulation.push([...population[idx]]);
    });

    // Generate new individuals
    while (newPopulation.length < populationSize) {
      const parent1 = tournamentSelection(population, fitness);
      const parent2 = tournamentSelection(population, fitness);

      let offspring1 = [...parent1];
      let offspring2 = [...parent2];

      // Crossover
      if (Math.random() < crossoverRate) {
        [offspring1, offspring2] = crossover(parent1, parent2);
      }

      // Mutation
      offspring1 = mutate(offspring1, variables, mutationRate);
      offspring2 = mutate(offspring2, variables, mutationRate);

      newPopulation.push(offspring1);
      if (newPopulation.length < populationSize) {
        newPopulation.push(offspring2);
      }
    }

    population = newPopulation;

    // Early termination check
    if (gen % 100 === 0 && bestFitness > -1e-6) {
      break;
    }
  }

  return {
    solution: bestSolution,
    objectiveValue: bestFitness,
    feasible: bestFitness > -Infinity,
    generations: generations,
    method: 'genetic_algorithm'
  };
}

function tournamentSelection(population: number[][], fitness: number[], tournamentSize: number = 3): number[] {
  let bestIdx = Math.floor(Math.random() * population.length);
  let bestFitness = fitness[bestIdx];

  for (let i = 1; i < tournamentSize; i++) {
    const idx = Math.floor(Math.random() * population.length);
    if (fitness[idx] > bestFitness) {
      bestFitness = fitness[idx];
      bestIdx = idx;
    }
  }

  return [...population[bestIdx]];
}

function crossover(parent1: number[], parent2: number[]): [number[], number[]] {
  const crossoverPoint = Math.floor(Math.random() * parent1.length);

  const offspring1 = [
    ...parent1.slice(0, crossoverPoint),
    ...parent2.slice(crossoverPoint)
  ];

  const offspring2 = [
    ...parent2.slice(0, crossoverPoint),
    ...parent1.slice(crossoverPoint)
  ];

  return [offspring1, offspring2];
}

function mutate(individual: number[], variables: any[], mutationRate: number): number[] {
  return individual.map((gene, idx) => {
    if (Math.random() < mutationRate) {
      const variable = variables[idx];
      const min = variable.min || 0;
      const max = variable.max || 100;
      return min + Math.random() * (max - min);
    }
    return gene;
  });
}

function simulatedAnnealing(objective: Function, constraints: Function[], variables: any[]): any {
  const maxIterations = 10000;
  const initialTemp = 1000;
  const coolingRate = 0.995;
  const minTemp = 0.01;

  // Generate initial solution
  let currentSolution = variables.map((v: any) =>
    (v.min || 0) + Math.random() * ((v.max || 100) - (v.min || 0))
  );

  let currentObjective = evaluateWithConstraints(currentSolution, objective, constraints);
  let bestSolution = [...currentSolution];
  let bestObjective = currentObjective;
  let temperature = initialTemp;

  for (let iter = 0; iter < maxIterations && temperature > minTemp; iter++) {
    // Generate neighbor solution
    const neighbor = [...currentSolution];
    const randomIdx = Math.floor(Math.random() * neighbor.length);
    const variable = variables[randomIdx];
    const min = variable.min || 0;
    const max = variable.max || 100;

    // Small random change
    const change = (Math.random() - 0.5) * (max - min) * 0.1;
    neighbor[randomIdx] = Math.max(min, Math.min(max, neighbor[randomIdx] + change));

    const neighborObjective = evaluateWithConstraints(neighbor, objective, constraints);

    // Accept or reject the neighbor
    const delta = neighborObjective - currentObjective;
    if (delta > 0 || Math.random() < Math.exp(delta / temperature)) {
      currentSolution = neighbor;
      currentObjective = neighborObjective;

      if (currentObjective > bestObjective) {
        bestSolution = [...currentSolution];
        bestObjective = currentObjective;
      }
    }

    temperature *= coolingRate;
  }

  return {
    solution: bestSolution,
    objectiveValue: bestObjective,
    feasible: bestObjective > -Infinity,
    iterations: maxIterations,
    method: 'simulated_annealing'
  };
}

function evaluateWithConstraints(solution: number[], objective: Function, constraints: Function[]): number {
  try {
    // Check constraints
    const constraintViolation = constraints.reduce((sum, constraint) => {
      try {
        return sum + Math.max(0, constraint(solution));
      } catch {
        return sum + 1000;
      }
    }, 0);

    if (constraintViolation > 0) {
      return -constraintViolation;
    }

    return objective(solution);
  } catch {
    return -Infinity;
  }
}

function performAnalysis(data: any): any {
  const { type, dataset, parameters } = data;

  switch (type) {
    case 'STATISTICAL':
      return performStatisticalAnalysis(dataset, parameters);
    case 'CORRELATION':
      return performCorrelationAnalysis(dataset, parameters);
    case 'TREND':
      return performTrendAnalysis(dataset, parameters);
    default:
      throw new Error('Unknown analysis type');
  }
}

function performStatisticalAnalysis(dataset: number[][], parameters: any): any {
  if (!dataset || dataset.length === 0) {
    throw new Error('Dataset is required for statistical analysis');
  }

  const results = dataset.map(series => {
    const n = series.length;
    const mean = series.reduce((sum, val) => sum + val, 0) / n;
    const variance = series.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);

    const sorted = [...series].sort((a, b) => a - b);
    const median = n % 2 === 0
      ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
      : sorted[Math.floor(n / 2)];

    return {
      mean,
      median,
      variance,
      stdDev,
      min: Math.min(...series),
      max: Math.max(...series),
      count: n
    };
  });

  return {
    type: 'statistical',
    results,
    summary: {
      totalSeries: dataset.length,
      avgMean: results.reduce((sum, r) => sum + r.mean, 0) / results.length
    }
  };
}

function performCorrelationAnalysis(dataset: number[][], parameters: any): any {
  if (!dataset || dataset.length < 2) {
    throw new Error('At least 2 data series required for correlation analysis');
  }

  const correlationMatrix: number[][] = [];

  for (let i = 0; i < dataset.length; i++) {
    correlationMatrix[i] = [];
    for (let j = 0; j < dataset.length; j++) {
      if (i === j) {
        correlationMatrix[i][j] = 1;
      } else {
        correlationMatrix[i][j] = calculateCorrelation(dataset[i], dataset[j]);
      }
    }
  }

  return {
    type: 'correlation',
    correlationMatrix,
    strongCorrelations: findStrongCorrelations(correlationMatrix, 0.7)
  };
}

function calculateCorrelation(series1: number[], series2: number[]): number {
  const n = Math.min(series1.length, series2.length);
  const mean1 = series1.slice(0, n).reduce((sum, val) => sum + val, 0) / n;
  const mean2 = series2.slice(0, n).reduce((sum, val) => sum + val, 0) / n;

  let numerator = 0;
  let sum1Sq = 0;
  let sum2Sq = 0;

  for (let i = 0; i < n; i++) {
    const diff1 = series1[i] - mean1;
    const diff2 = series2[i] - mean2;

    numerator += diff1 * diff2;
    sum1Sq += diff1 * diff1;
    sum2Sq += diff2 * diff2;
  }

  const denominator = Math.sqrt(sum1Sq * sum2Sq);
  return denominator === 0 ? 0 : numerator / denominator;
}

function findStrongCorrelations(matrix: number[][], threshold: number): Array<{ i: number, j: number, correlation: number }> {
  const strong: Array<{ i: number, j: number, correlation: number }> = [];

  for (let i = 0; i < matrix.length; i++) {
    for (let j = i + 1; j < matrix[i].length; j++) {
      if (Math.abs(matrix[i][j]) >= threshold) {
        strong.push({ i, j, correlation: matrix[i][j] });
      }
    }
  }

  return strong;
}

function performTrendAnalysis(dataset: number[][], parameters: any): any {
  const results = dataset.map(series => {
    const trend = calculateLinearTrend(series);
    const seasonality = detectSeasonality(series);

    return {
      trend,
      seasonality,
      volatility: calculateVolatility(series)
    };
  });

  return {
    type: 'trend',
    results
  };
}

function calculateLinearTrend(series: number[]): { slope: number, intercept: number, r2: number } {
  const n = series.length;
  const x = Array.from({ length: n }, (_, i) => i);

  const sumX = x.reduce((sum, val) => sum + val, 0);
  const sumY = series.reduce((sum, val) => sum + val, 0);
  const sumXY = x.reduce((sum, val, i) => sum + val * series[i], 0);
  const sumXX = x.reduce((sum, val) => sum + val * val, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Calculate R²
  const meanY = sumY / n;
  const ssTotal = series.reduce((sum, val) => sum + Math.pow(val - meanY, 2), 0);
  const ssRes = series.reduce((sum, val, i) => sum + Math.pow(val - (slope * i + intercept), 2), 0);
  const r2 = 1 - (ssRes / ssTotal);

  return { slope, intercept, r2 };
}

function detectSeasonality(series: number[]): { detected: boolean, period?: number } {
  // Simple autocorrelation-based seasonality detection
  const maxLag = Math.min(series.length / 4, 50);
  let bestCorrelation = 0;
  let bestPeriod = 0;

  for (let lag = 2; lag <= maxLag; lag++) {
    const correlation = calculateAutocorrelation(series, lag);
    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestPeriod = lag;
    }
  }

  return {
    detected: bestCorrelation > 0.3,
    period: bestCorrelation > 0.3 ? bestPeriod : undefined
  };
}

function calculateAutocorrelation(series: number[], lag: number): number {
  const n = series.length - lag;
  const series1 = series.slice(0, n);
  const series2 = series.slice(lag, lag + n);

  return calculateCorrelation(series1, series2);
}

function calculateVolatility(series: number[]): number {
  const returns = [];
  for (let i = 1; i < series.length; i++) {
    if (series[i - 1] !== 0) {
      returns.push((series[i] - series[i - 1]) / series[i - 1]);
    }
  }

  if (returns.length === 0) return 0;

  const meanReturn = returns.reduce((sum, val) => sum + val, 0) / returns.length;
  const variance = returns.reduce((sum, val) => sum + Math.pow(val - meanReturn, 2), 0) / returns.length;

  return Math.sqrt(variance);
}

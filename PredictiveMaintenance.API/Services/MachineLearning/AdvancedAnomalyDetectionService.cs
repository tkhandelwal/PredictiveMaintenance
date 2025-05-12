using Microsoft.ML;
using Microsoft.ML.Data;
using PredictiveMaintenance.API.Models;

namespace PredictiveMaintenance.API.Services.MachineLearning
{
    public interface IAdvancedAnomalyDetectionService
    {
        Task<bool> DetectAnomalyAsync(SensorReading reading, List<SensorReading> historicalData);
        Task<double> CalculateAnomalyScoreAsync(SensorReading reading, List<SensorReading> historicalData);
        Task TrainModelsAsync(int equipmentId);
    }

    public class AdvancedAnomalyDetectionService : IAdvancedAnomalyDetectionService
    {
        private readonly ILogger<AdvancedAnomalyDetectionService> _logger;
        private readonly MLContext _mlContext;
        private readonly Dictionary<string, ITransformer> _models = new Dictionary<string, ITransformer>();
        private readonly Dictionary<string, ModelPerformanceMetrics> _modelPerformance = new Dictionary<string, ModelPerformanceMetrics>();
        private readonly Dictionary<int, Dictionary<string, List<double>>> _historicalValues = new Dictionary<int, Dictionary<string, List<double>>>();
        private readonly IServiceScopeFactory _serviceScopeFactory;

        // Configurable parameters for detection algorithms
        private readonly double _zScoreThreshold = 3.0;
        private readonly double _movingAverageWindow = 10;
        private readonly double _movingAverageThreshold = 2.0;
        private readonly double _seasonalDifferenceThreshold = 2.5;

        // Equipment-specific thresholds
        private readonly Dictionary<string, Dictionary<string, ThresholdConfig>> _equipmentThresholds;

        public AdvancedAnomalyDetectionService(
            ILogger<AdvancedAnomalyDetectionService> logger,
            IServiceScopeFactory serviceScopeFactory)
        {
            _logger = logger;
            _mlContext = new MLContext(seed: 42);
            _serviceScopeFactory = serviceScopeFactory;

            // Initialize equipment and sensor-specific thresholds
            _equipmentThresholds = InitializeThresholds();
        }

        private Dictionary<string, Dictionary<string, ThresholdConfig>> InitializeThresholds()
        {
            // Define thresholds for each equipment type and sensor type
            return new Dictionary<string, Dictionary<string, ThresholdConfig>>
            {
                // Pumps
                ["Centrifugal Pump"] = new Dictionary<string, ThresholdConfig>
                {
                    ["temperature"] = new ThresholdConfig { LowerBound = 20, UpperBound = 90, Unit = "°C" },
                    ["vibration"] = new ThresholdConfig { LowerBound = 0, UpperBound = 35, Unit = "mm/s" },
                    ["flow"] = new ThresholdConfig { LowerBound = 20, UpperBound = 70, Unit = "L/min" },
                    ["pressure"] = new ThresholdConfig { LowerBound = 40, UpperBound = 110, Unit = "psi" }
                },

                // Motors
                ["Electric Motor"] = new Dictionary<string, ThresholdConfig>
                {
                    ["temperature"] = new ThresholdConfig { LowerBound = 20, UpperBound = 85, Unit = "°C" },
                    ["vibration"] = new ThresholdConfig { LowerBound = 0, UpperBound = 30, Unit = "mm/s" },
                    ["rpm"] = new ThresholdConfig { LowerBound = 1200, UpperBound = 2400, Unit = "rpm" }
                },

                // Compressors
                ["Air Compressor"] = new Dictionary<string, ThresholdConfig>
                {
                    ["temperature"] = new ThresholdConfig { LowerBound = 20, UpperBound = 95, Unit = "°C" },
                    ["pressure"] = new ThresholdConfig { LowerBound = 30, UpperBound = 120, Unit = "psi" },
                    ["vibration"] = new ThresholdConfig { LowerBound = 0, UpperBound = 40, Unit = "mm/s" }
                },

                // Fans
                ["Industrial Fan"] = new Dictionary<string, ThresholdConfig>
                {
                    ["temperature"] = new ThresholdConfig { LowerBound = 15, UpperBound = 80, Unit = "°C" },
                    ["vibration"] = new ThresholdConfig { LowerBound = 0, UpperBound = 25, Unit = "mm/s" },
                    ["rpm"] = new ThresholdConfig { LowerBound = 500, UpperBound = 2000, Unit = "rpm" }
                }
            };
        }

        public async Task<bool> DetectAnomalyAsync(SensorReading reading, List<SensorReading> historicalData)
        {
            try
            {
                // Filter historical data for the same sensor type
                var relevantReadings = historicalData
                    .Where(r => r.SensorType == reading.SensorType)
                    .OrderBy(r => r.Timestamp)
                    .ToList();

                if (relevantReadings.Count < 10)
                {
                    // Not enough data for advanced analysis, use a simple threshold
                    return IsAnomalyByThreshold(reading);
                }

                // Calculate anomaly score using multiple methods and ensemble the results
                double anomalyScore = await CalculateAnomalyScoreAsync(reading, relevantReadings);
                bool isAnomaly = anomalyScore > 0.7; // Threshold for final ensemble decision

                if (isAnomaly)
                {
                    _logger.LogWarning($"Anomaly detected for equipment {reading.EquipmentId}, sensor {reading.SensorType}: value={reading.Value}, score={anomalyScore:F2}");
                }

                return isAnomaly;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error detecting anomaly for reading {reading.SensorType}={reading.Value}");
                // Fallback to simple detection
                return IsAnomalyByThreshold(reading);
            }
        }

        public async Task<double> CalculateAnomalyScoreAsync(SensorReading reading, List<SensorReading> historicalData)
        {
            // Ensure we have historical data
            if (historicalData.Count < 10)
            {
                return IsAnomalyByThreshold(reading) ? 1.0 : 0.0;
            }

            // Calculate various anomaly scores using different methods
            double zScoreAnomaly = DetectAnomalyByZScore(reading, historicalData);
            double pcaAnomaly = await DetectAnomalyByPcaAsync(reading, historicalData);
            double movingAverageAnomaly = DetectAnomalyByMovingAverage(reading, historicalData);
            double seasonalAnomaly = DetectAnomalyBySeasonal(reading, historicalData);
            double rateOfChangeAnomaly = DetectAnomalyByRateOfChange(reading, historicalData);

            // CUSUM detection for trends
            double cusumAnomaly = DetectAnomalyByCUSUM(reading, historicalData);

            // Ensemble the results (weighted average)
            double finalScore = (
                zScoreAnomaly * 0.2 +
                pcaAnomaly * 0.3 +
                movingAverageAnomaly * 0.15 +
                seasonalAnomaly * 0.15 +
                rateOfChangeAnomaly * 0.1 +
                cusumAnomaly * 0.1
            );

            _logger.LogInformation($"Anomaly scores for {reading.SensorType}={reading.Value}: " +
                $"Z={zScoreAnomaly:F2}, PCA={pcaAnomaly:F2}, MA={movingAverageAnomaly:F2}, " +
                $"Seasonal={seasonalAnomaly:F2}, RoC={rateOfChangeAnomaly:F2}, CUSUM={cusumAnomaly:F2}, " +
                $"Final={finalScore:F2}");

            return finalScore;
        }

        private bool IsAnomalyByThreshold(SensorReading reading)
        {
            try
            {
                // Get equipment type for this reading
                string equipmentType = GetEquipmentType(reading.EquipmentId);

                // Check if we have thresholds for this equipment and sensor type
                if (_equipmentThresholds.TryGetValue(equipmentType, out var sensorThresholds) &&
                    sensorThresholds.TryGetValue(reading.SensorType.ToLower(), out var thresholdConfig))
                {
                    // Use equipment and sensor-specific thresholds
                    return reading.Value < thresholdConfig.LowerBound || reading.Value > thresholdConfig.UpperBound;
                }

                // Fallback to generic thresholds by sensor type
                switch (reading.SensorType.ToLower())
                {
                    case "temperature":
                        return reading.Value > 90 || reading.Value < 20;
                    case "vibration":
                        return reading.Value > 35;
                    case "pressure":
                        return reading.Value > 110 || reading.Value < 40;
                    case "flow":
                        return reading.Value < 20 || reading.Value > 70;
                    case "rpm":
                        return reading.Value > 2400 || reading.Value < 1200;
                    default:
                        // Generic threshold based on equipment ID for unknown types
                        // Different equipment might have different normal ranges
                        double baseValue = 50 + (reading.EquipmentId % 10) * 5;
                        return reading.Value > baseValue * 1.5 || reading.Value < baseValue * 0.5;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error in threshold detection for reading {reading.SensorType}={reading.Value}");

                // Very basic fallback - consider values outside 0-100 as anomalies
                return reading.Value < 0 || reading.Value > 100;
            }
        }

        private string GetEquipmentType(int equipmentId)
        {
            // In a real implementation, this would retrieve the equipment type from a service or cache
            // For this example, we'll use a simplistic mapping
            switch (equipmentId)
            {
                case 1: return "Centrifugal Pump";
                case 2: return "Electric Motor";
                case 3: return "Air Compressor";
                case 4: return "Industrial Fan";
                default: return "Unknown";
            }
        }

        private double DetectAnomalyByZScore(SensorReading reading, List<SensorReading> historicalData)
        {
            var values = historicalData.Select(r => r.Value).ToList();
            double mean = values.Average();
            double stdDev = Math.Sqrt(values.Select(x => Math.Pow(x - mean, 2)).Average());

            // Avoid division by zero
            stdDev = Math.Max(stdDev, 0.0001);

            // Calculate Z-score (how many standard deviations from mean)
            double zScore = Math.Abs(reading.Value - mean) / stdDev;

            // Convert to probability score between 0 and 1
            return Math.Min(zScore / _zScoreThreshold, 1.0);
        }

        private async Task<double> DetectAnomalyByPcaAsync(SensorReading reading, List<SensorReading> historicalData)
        {
            // Unique key for this equipment+sensor combination
            string modelKey = $"{reading.EquipmentId}_{reading.SensorType}";

            try
            {
                // Check if we need to train a model
                if (!_models.ContainsKey(modelKey) || historicalData.Count >= 100)
                {
                    await TrainPcaModelAsync(modelKey, historicalData);
                }

                // If model exists, use it to predict
                if (_models.ContainsKey(modelKey))
                {
                    // Prepare data for prediction
                    var predictionEngine = _mlContext.Model.CreatePredictionEngine<SensorData, SensorPrediction>(_models[modelKey]);

                    // Make prediction
                    var prediction = predictionEngine.Predict(new SensorData { Value = (float)reading.Value });

                    // If we have performance metrics, use them to standardize the score
                    if (_modelPerformance.TryGetValue(modelKey, out var metrics))
                    {
                        // Standardize scores based on model's average and stddev
                        double standardizedScore = (prediction.Score - metrics.AverageScore) / metrics.StdDevScore;
                        return Math.Min(Math.Abs(standardizedScore) / 3.0, 1.0);
                    }

                    // Return raw anomaly score (higher is more anomalous)
                    return prediction.Score;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error in PCA anomaly detection for {modelKey}");
            }

            // Fallback to Z-score if model fails
            return DetectAnomalyByZScore(reading, historicalData);
        }

        private double DetectAnomalyByMovingAverage(SensorReading reading, List<SensorReading> historicalData)
        {
            if (historicalData.Count < _movingAverageWindow)
            {
                return 0;
            }

            // Calculate moving average of the last N values
            var recentValues = historicalData
                .OrderByDescending(r => r.Timestamp)
                .Take((int)_movingAverageWindow)
                .Select(r => r.Value)
                .ToList();

            double movingAvg = recentValues.Average();
            double movingStdDev = Math.Sqrt(recentValues.Select(x => Math.Pow(x - movingAvg, 2)).Average());

            // Avoid division by zero
            movingStdDev = Math.Max(movingStdDev, 0.0001);

            // How many moving average std devs from the moving average?
            double deviation = Math.Abs(reading.Value - movingAvg) / movingStdDev;

            // Convert to a score
            return Math.Min(deviation / _movingAverageThreshold, 1.0);
        }

        private double DetectAnomalyBySeasonal(SensorReading reading, List<SensorReading> historicalData)
        {
            // This is a simplified seasonal detection - for real applications,
            // you might want more sophisticated time series decomposition.
            // Assuming daily patterns repeat (e.g. every 24 hours)

            if (historicalData.Count < 24)
            {
                return 0;
            }

            // Try to find readings from same time of day
            var timestamp = reading.Timestamp;
            var hourOfDay = timestamp.Hour;

            var similarTimeReadings = historicalData
                .Where(r => Math.Abs((r.Timestamp.Hour - hourOfDay)) <= 1)
                .OrderByDescending(r => r.Timestamp)
                .Take(10)
                .ToList();

            if (similarTimeReadings.Count < 5)
            {
                return 0;
            }

            // Calculate mean and stddev of similar time readings
            double similarTimeMean = similarTimeReadings.Select(r => r.Value).Average();
            double similarTimeStdDev = Math.Sqrt(similarTimeReadings
                .Select(r => Math.Pow(r.Value - similarTimeMean, 2))
                .Average());

            // Avoid division by zero
            similarTimeStdDev = Math.Max(similarTimeStdDev, 0.0001);

            // Calculate seasonal deviation
            double seasonalDeviation = Math.Abs(reading.Value - similarTimeMean) / similarTimeStdDev;

            // Convert to score
            return Math.Min(seasonalDeviation / _seasonalDifferenceThreshold, 1.0);
        }

        private double DetectAnomalyByRateOfChange(SensorReading reading, List<SensorReading> historicalData)
        {
            if (historicalData.Count < 2)
            {
                return 0;
            }

            // Get the most recent previous reading
            var previousReading = historicalData
                .Where(r => r.Timestamp < reading.Timestamp)
                .OrderByDescending(r => r.Timestamp)
                .FirstOrDefault();

            if (previousReading == null)
            {
                return 0;
            }

            // Calculate time difference in seconds
            double timeDiffSeconds = (reading.Timestamp - previousReading.Timestamp).TotalSeconds;
            if (timeDiffSeconds < 0.1) timeDiffSeconds = 0.1; // Avoid division by zero

            // Calculate rate of change per second
            double rateOfChange = Math.Abs(reading.Value - previousReading.Value) / timeDiffSeconds;

            // Calculate typical rates of change from historical data
            var ratesOfChange = new List<double>();
            for (int i = 1; i < historicalData.Count; i++)
            {
                var current = historicalData[i];
                var prev = historicalData[i - 1];
                double timeDiff = (current.Timestamp - prev.Timestamp).TotalSeconds;
                if (timeDiff < 0.1) timeDiff = 0.1;
                ratesOfChange.Add(Math.Abs(current.Value - prev.Value) / timeDiff);
            }

            // Calculate mean and stddev of historical rates of change
            double meanRateOfChange = ratesOfChange.Average();
            double stdDevRateOfChange = Math.Sqrt(ratesOfChange
                .Select(r => Math.Pow(r - meanRateOfChange, 2))
                .Average());

            // Avoid division by zero
            stdDevRateOfChange = Math.Max(stdDevRateOfChange, 0.0001);

            // Calculate how unusual this rate of change is
            double rateOfChangeZScore = Math.Abs(rateOfChange - meanRateOfChange) / stdDevRateOfChange;

            // Convert to score
            return Math.Min(rateOfChangeZScore / 3.0, 1.0);
        }

        private double DetectAnomalyByCUSUM(SensorReading reading, List<SensorReading> historicalData)
        {
            // Cumulative Sum Control Chart (CUSUM) for trend detection
            if (historicalData.Count < 10)
            {
                return 0;
            }

            // Calculate baseline parameters from first portion of data
            var baselineData = historicalData
                .OrderBy(r => r.Timestamp)
                .Take(historicalData.Count / 2)
                .Select(r => r.Value)
                .ToList();

            double baselineMean = baselineData.Average();
            double baselineStdDev = Math.Sqrt(baselineData
                .Select(x => Math.Pow(x - baselineMean, 2))
                .Average());

            // Avoid division by zero
            baselineStdDev = Math.Max(baselineStdDev, 0.0001);

            // Choose parameters for CUSUM
            double k = 0.5 * baselineStdDev; // Reference value (often 0.5 sigma)
            double h = 5 * baselineStdDev;   // Decision threshold (often 5 sigma)

            // Calculate CUSUM statistics
            double cusumHigh = 0;
            double cusumLow = 0;

            foreach (var r in historicalData.OrderBy(r => r.Timestamp))
            {
                double deviation = r.Value - baselineMean;
                cusumHigh = Math.Max(0, cusumHigh + deviation - k);
                cusumLow = Math.Max(0, cusumLow - deviation - k);
            }

            // Calculate for current reading
            double currentDeviation = reading.Value - baselineMean;
            double newCusumHigh = Math.Max(0, cusumHigh + currentDeviation - k);
            double newCusumLow = Math.Max(0, cusumLow - currentDeviation - k);

            // Check if either CUSUM exceeds threshold
            double maxCusum = Math.Max(newCusumHigh, newCusumLow);

            // Convert to score
            return Math.Min(maxCusum / h, 1.0);
        }

        /// <summary>
        /// Trains anomaly detection models for all sensor types of the specified equipment
        /// </summary>
        /// <param name="equipmentId">The ID of the equipment to train models for</param>
        public async Task TrainModelsAsync(int equipmentId)
        {
            _logger.LogInformation($"Training ML models for equipment {equipmentId}...");

            try
            {
                // Fetch historical data for this equipment
                // You'll need to inject IInfluxDbService or similar to access sensor data
                var from = DateTime.UtcNow.AddDays(-30); // Get last 30 days of data
                var to = DateTime.UtcNow;

                List<SensorReading> historicalData;
                using (var scope = _serviceScopeFactory.CreateScope())
                {
                    var influxDbService = scope.ServiceProvider.GetRequiredService<IInfluxDbService>();
                    historicalData = await influxDbService.GetReadingsForEquipmentAsync(equipmentId, from, to);
                }

                if (historicalData.Count < 50)
                {
                    _logger.LogWarning($"Insufficient data ({historicalData.Count} readings) for equipment {equipmentId}. Need at least 50 readings to train models.");
                    return;
                }

                // Group readings by sensor type
                var sensorGroups = historicalData.GroupBy(r => r.SensorType);

                // Track successful trainings 
                int successCount = 0;
                int totalCount = 0;

                // Train a model for each sensor type
                foreach (var group in sensorGroups)
                {
                    string sensorType = group.Key;
                    var readings = group.ToList();
                    totalCount++;

                    if (readings.Count < 30)
                    {
                        _logger.LogWarning($"Insufficient data ({readings.Count} readings) for sensor type {sensorType}. Skipping model training.");
                        continue;
                    }

                    string modelKey = $"{equipmentId}_{sensorType}";
                    _logger.LogInformation($"Training model for {modelKey} using {readings.Count} readings");

                    try
                    {
                        // Split data into training (80%) and validation (20%) sets
                        readings.Sort((a, b) => a.Timestamp.CompareTo(b.Timestamp));
                        int splitPoint = (int)(readings.Count * 0.8);
                        var trainingData = readings.Take(splitPoint).ToList();
                        var validationData = readings.Skip(splitPoint).ToList();

                        // Train each algorithm type
                        await TrainPcaModelAsync(modelKey, trainingData);

                        // Evaluate models on validation data
                        await EvaluateModelAsync(modelKey, validationData);

                        successCount++;
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, $"Error training model for {modelKey}");
                    }
                }

                _logger.LogInformation($"Model training complete for equipment {equipmentId}. " +
                                     $"Successfully trained {successCount} out of {totalCount} models.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error in model training process for equipment {equipmentId}");
            }
        }

        /// <summary>
        /// Trains a PCA-based anomaly detection model for the specified sensor
        /// </summary>
        private async Task TrainPcaModelAsync(string modelKey, List<SensorReading> data)
        {
            try
            {
                // Convert readings to training data format
                var trainData = _mlContext.Data.LoadFromEnumerable(
                    data.Select(r => new SensorData { Value = (float)r.Value }));

                // Define the PCA pipeline
                var pipeline = _mlContext.Transforms.NormalizeMinMax("NormalizedValue", "Value")
                    .Append(_mlContext.AnomalyDetection.Trainers.RandomizedPca(
                        featureColumnName: "NormalizedValue",
                        rank: Math.Min(10, data.Count / 2), // Adjust rank based on data size
                        ensureZeroMean: true,
                        seed: 42)); // Set seed for reproducibility

                // Train the model
                _logger.LogInformation($"Started training PCA model for {modelKey}");
                var model = await Task.Run(() => pipeline.Fit(trainData));

                // Store the trained model
                _models[modelKey] = model;

                _logger.LogInformation($"Completed PCA model training for {modelKey}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error training PCA model for {modelKey}");
                throw; // Re-throw to let the calling method handle the error
            }
        }

        /// <summary>
        /// Evaluates model performance on validation data
        /// </summary>
        /// <summary>
        /// Evaluates model performance on validation data
        /// </summary>
        private async Task EvaluateModelAsync(string modelKey, List<SensorReading> validationData)
        {
            try
            {
                // Skip if no model or insufficient validation data
                if (!_models.ContainsKey(modelKey) || validationData.Count < 5)
                    return;

                // Convert validation data
                var valData = _mlContext.Data.LoadFromEnumerable(
                    validationData.Select(r => new SensorData { Value = (float)r.Value }));

                // Apply the model to validation data - offload CPU-intensive work to Task.Run
                var model = _models[modelKey];
                var transformedData = await Task.Run(() => model.Transform(valData));

                // Extract scores from transformed data - also potentially CPU-intensive
                var scoredData = await Task.Run(() => _mlContext.Data.CreateEnumerable<SensorPrediction>(
                    transformedData, reuseRowObject: false).ToList());

                // Calculate metrics (we use basic metrics as PCA doesn't have true labels)
                double avgScore = scoredData.Average(p => p.Score);
                double stdDevScore = Math.Sqrt(scoredData.Select(p => Math.Pow(p.Score - avgScore, 2)).Average());

                // Estimate approximate false positive rate
                int anomalyCount = scoredData.Count(p => p.Score > avgScore + 3 * stdDevScore);
                double falsePositiveRate = (double)anomalyCount / scoredData.Count;

                _logger.LogInformation($"Model evaluation for {modelKey}: " +
                                      $"Avg score: {avgScore:F4}, StdDev: {stdDevScore:F4}, " +
                                      $"Est. anomaly rate: {falsePositiveRate:P2}");

                // Store performance metrics for adaptive thresholding
                _modelPerformance[modelKey] = new ModelPerformanceMetrics
                {
                    AverageScore = avgScore,
                    StdDevScore = stdDevScore,
                    ThresholdMultiplier = 3.0 // Default, can be adjusted
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error evaluating model for {modelKey}");
            }
        }
    }

    // Supporting classes for ML.NET operations
    public class SensorData
    {
        [LoadColumn(0)]
        public float Value { get; set; }
    }

    public class SensorPrediction
    {
        [VectorType(1)]
        public float[] PredictedLabel { get; set; } = new float[1]; // Initialize with empty array

        public float Score { get; set; }
    }

    // Helper class to track model performance metrics
    public class ModelPerformanceMetrics
    {
        public double AverageScore { get; set; }
        public double StdDevScore { get; set; }
        public double ThresholdMultiplier { get; set; }
    }

    // Equipment-specific threshold configuration
    public class ThresholdConfig
    {
        public double LowerBound { get; set; }
        public double UpperBound { get; set; }
        public string Unit { get; set; } = "";
    }
}
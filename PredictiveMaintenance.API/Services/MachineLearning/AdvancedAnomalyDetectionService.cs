using Microsoft.ML;
using Microsoft.ML.Data;
using Microsoft.ML.Trainers;
using Microsoft.ML.Transforms.TimeSeries;
using PredictiveMaintenance.API.Models;
using System.Collections.Concurrent;
using MathNet.Numerics.Statistics;
using MathNet.Numerics.LinearAlgebra;

namespace PredictiveMaintenance.API.Services.MachineLearning
{
    public interface IAdvancedAnomalyDetectionService
    {
        Task<bool> DetectAnomalyAsync(SensorReading reading, List<SensorReading> historicalData);
        Task<double> CalculateAnomalyScoreAsync(SensorReading reading, List<SensorReading> historicalData);
        Task TrainModelsAsync(int equipmentId);
        Task<AnomalyReport> GenerateAnomalyReportAsync(int equipmentId, DateTime from, DateTime to);
        Task<List<AnomalyPattern>> IdentifyAnomalyPatternsAsync(int equipmentId);
        Task<AnomalyPrediction> PredictFutureAnomaliesAsync(int equipmentId, int horizonHours);
        Task<RootCauseAnalysis> PerformRootCauseAnalysisAsync(int equipmentId, Anomaly anomaly);
    }

    public class AdvancedAnomalyDetectionService : IAdvancedAnomalyDetectionService
    {
        private readonly ILogger<AdvancedAnomalyDetectionService> _logger;
        private readonly MLContext _mlContext;
        private readonly IServiceScopeFactory _serviceScopeFactory;
        private readonly IInfluxDbService _influxDbService;

        // Model storage
        private readonly ConcurrentDictionary<string, ITransformer> _isolationForestModels;
        private readonly ConcurrentDictionary<string, ITransformer> _autoencoderModels;
        private readonly ConcurrentDictionary<string, ITransformer> _lstmModels;
        private readonly ConcurrentDictionary<string, ITransformer> _spectralModels;
        private readonly ConcurrentDictionary<string, ITransformer> _changePointModels;

        // Performance tracking
        private readonly ConcurrentDictionary<string, ModelPerformanceMetrics> _modelPerformance;
        private readonly ConcurrentDictionary<int, AnomalyProfile> _equipmentProfiles;

        // Pattern recognition
        private readonly ConcurrentDictionary<int, List<AnomalyPattern>> _knownPatterns;
        private readonly ConcurrentDictionary<string, AnomalySignature> _anomalySignatures;

        // Configuration
        private readonly AnomalyDetectionConfig _config;

        public AdvancedAnomalyDetectionService(
            ILogger<AdvancedAnomalyDetectionService> logger,
            IServiceScopeFactory serviceScopeFactory,
            IInfluxDbService influxDbService,
            IConfiguration configuration)
        {
            _logger = logger;
            _mlContext = new MLContext(seed: 42);
            _serviceScopeFactory = serviceScopeFactory;
            _influxDbService = influxDbService;

            _isolationForestModels = new ConcurrentDictionary<string, ITransformer>();
            _autoencoderModels = new ConcurrentDictionary<string, ITransformer>();
            _lstmModels = new ConcurrentDictionary<string, ITransformer>();
            _spectralModels = new ConcurrentDictionary<string, ITransformer>();
            _changePointModels = new ConcurrentDictionary<string, ITransformer>();

            _modelPerformance = new ConcurrentDictionary<string, ModelPerformanceMetrics>();
            _equipmentProfiles = new ConcurrentDictionary<int, AnomalyProfile>();
            _knownPatterns = new ConcurrentDictionary<int, List<AnomalyPattern>>();
            _anomalySignatures = new ConcurrentDictionary<string, AnomalySignature>();

            _config = configuration.GetSection("AnomalyDetection").Get<AnomalyDetectionConfig>()
                     ?? new AnomalyDetectionConfig();

            InitializeAnomalyDetection();
        }

        public async Task<bool> DetectAnomalyAsync(SensorReading reading, List<SensorReading> historicalData)
        {
            try
            {
                var anomalyScore = await CalculateAnomalyScoreAsync(reading, historicalData);

                // Dynamic threshold based on equipment profile
                var profile = await GetOrCreateEquipmentProfileAsync(reading.EquipmentId);
                var threshold = CalculateDynamicThreshold(profile, reading.SensorType);

                return anomalyScore > threshold;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error detecting anomaly for reading {reading.SensorType}={reading.Value}");
                return false;
            }
        }

        public async Task<double> CalculateAnomalyScoreAsync(SensorReading reading, List<SensorReading> historicalData)
        {
            if (historicalData.Count < _config.MinimumDataPoints)
            {
                return await CalculateSimpleAnomalyScoreAsync(reading, historicalData);
            }

            // Multi-algorithm ensemble
            var scores = new Dictionary<string, double>();

            // Statistical methods
            scores["statistical"] = await CalculateStatisticalAnomalyScoreAsync(reading, historicalData);

            // Machine learning methods
            scores["isolationForest"] = await CalculateIsolationForestScoreAsync(reading, historicalData);
            scores["autoencoder"] = await CalculateAutoencoderScoreAsync(reading, historicalData);
            scores["spectral"] = await CalculateSpectralResidualScoreAsync(reading, historicalData);

            // Time series methods
            scores["changePoint"] = await DetectChangePointAsync(reading, historicalData);
            scores["seasonal"] = await CalculateSeasonalAnomalyScoreAsync(reading, historicalData);

            // Pattern-based detection
            scores["pattern"] = await CalculatePatternAnomalyScoreAsync(reading, historicalData);

            // Contextual anomaly detection
            scores["contextual"] = await CalculateContextualAnomalyScoreAsync(reading, historicalData);

            // Weighted ensemble
            var ensembleScore = CalculateEnsembleScore(scores, reading, historicalData);

            // Update anomaly profile
            await UpdateAnomalyProfileAsync(reading.EquipmentId, reading.SensorType, ensembleScore);

            return ensembleScore;
        }

        private async Task<double> CalculateStatisticalAnomalyScoreAsync(SensorReading reading, List<SensorReading> historicalData)
        {
            var values = historicalData.Select(r => r.Value).ToList();

            // Robust statistics (resistant to outliers)
            var median = values.Median();
            var mad = MedianAbsoluteDeviation(values);

            // Modified Z-score using MAD
            var modifiedZScore = 0.6745 * Math.Abs(reading.Value - median) / mad;

            // Grubbs' test for outliers
            var grubbsScore = await PerformGrubbsTestAsync(reading.Value, values);

            // Mahalanobis distance for multivariate anomaly detection
            var mahalanobisDistance = await CalculateMahalanobisDistanceAsync(reading, historicalData);

            // Combine scores
            var statisticalScore = (modifiedZScore / 3.5 + grubbsScore + mahalanobisDistance / 3.0) / 3.0;

            return Math.Min(1.0, statisticalScore);
        }

        private async Task<double> CalculateIsolationForestScoreAsync(SensorReading reading, List<SensorReading> historicalData)
        {
            var modelKey = $"isolation_{reading.EquipmentId}_{reading.SensorType}";

            if (!_isolationForestModels.ContainsKey(modelKey))
            {
                await TrainIsolationForestModelAsync(reading.EquipmentId, reading.SensorType, historicalData);
            }

            if (_isolationForestModels.TryGetValue(modelKey, out var model))
            {
                var predictionEngine = _mlContext.Model.CreatePredictionEngine<IsolationForestData, IsolationForestPrediction>(model);

                var features = ExtractIsolationForestFeatures(reading, historicalData);
                var prediction = predictionEngine.Predict(features);

                // Normalize score to [0, 1]
                return 1.0 / (1.0 + Math.Exp(-prediction.Score));
            }

            return 0.5;
        }

        private async Task<double> CalculateAutoencoderScoreAsync(SensorReading reading, List<SensorReading> historicalData)
        {
            var modelKey = $"autoencoder_{reading.EquipmentId}_{reading.SensorType}";

            if (!_autoencoderModels.ContainsKey(modelKey))
            {
                await TrainAutoencoderModelAsync(reading.EquipmentId, reading.SensorType, historicalData);
            }

            if (_autoencoderModels.TryGetValue(modelKey, out var model))
            {
                // Extract time window features
                var windowFeatures = ExtractTimeWindowFeatures(reading, historicalData, windowSize: 10);

                // Get reconstruction error
                var reconstructionError = await CalculateReconstructionErrorAsync(model, windowFeatures);

                // Normalize based on historical reconstruction errors
                var threshold = await GetReconstructionErrorThresholdAsync(modelKey);

                return Math.Min(1.0, reconstructionError / threshold);
            }

            return 0.5;
        }

        private async Task<double> CalculateSpectralResidualScoreAsync(SensorReading reading, List<SensorReading> historicalData)
        {
            // Spectral Residual algorithm for time series anomaly detection
            var values = historicalData.Select(r => r.Value).ToList();
            values.Add(reading.Value);

            // Apply FFT
            var fftResult = ApplyFFT(values.ToArray());

            // Calculate spectral residual
            var spectralResidual = CalculateSpectralResidual(fftResult);

            // Apply inverse FFT
            var saliencyMap = ApplyInverseFFT(spectralResidual);

            // Get anomaly score for the current point
            var score = saliencyMap[saliencyMap.Length - 1];

            // Normalize
            return Math.Min(1.0, Math.Abs(score) / 3.0);
        }

        private async Task<double> DetectChangePointAsync(SensorReading reading, List<SensorReading> historicalData)
        {
            var modelKey = $"changepoint_{reading.EquipmentId}_{reading.SensorType}";

            // Prepare data for change point detection
            var timeSeriesData = historicalData
                .OrderBy(r => r.Timestamp)
                .Select(r => new TimeSeriesData
                {
                    Timestamp = r.Timestamp,
                    Value = (float)r.Value
                })
                .ToList();

            timeSeriesData.Add(new TimeSeriesData
            {
                Timestamp = reading.Timestamp,
                Value = (float)reading.Value
            });

            var dataView = _mlContext.Data.LoadFromEnumerable(timeSeriesData);

            // Change point detection pipeline
            var pipeline = _mlContext.Transforms.DetectChangePointBySsa(
                outputColumnName: "Prediction",
                inputColumnName: nameof(TimeSeriesData.Value),
                confidence: 95,
                changeHistoryLength: Math.Min(20, historicalData.Count / 4));

            var model = pipeline.Fit(dataView);
            var transformedData = model.Transform(dataView);

            var predictions = _mlContext.Data.CreateEnumerable<ChangePointPrediction>(transformedData, false).ToList();
            var lastPrediction = predictions.Last();

            return lastPrediction.Prediction[0]; // Anomaly score
        }

        private async Task<double> CalculatePatternAnomalyScoreAsync(SensorReading reading, List<SensorReading> historicalData)
        {
            // Get known patterns for this equipment
            var patterns = await GetKnownPatternsAsync(reading.EquipmentId);

            // Extract current pattern
            var currentPattern = ExtractPattern(reading, historicalData, patternLength: 20);

            // Compare with known patterns
            var minDistance = double.MaxValue;
            AnomalyPattern? matchedPattern = null;

            foreach (var pattern in patterns)
            {
                var distance = CalculatePatternDistance(currentPattern, pattern);
                if (distance < minDistance)
                {
                    minDistance = distance;
                    matchedPattern = pattern;
                }
            }

            // If pattern matches a known anomaly pattern
            if (matchedPattern != null && matchedPattern.IsAnomalous)
            {
                return 1.0 - Math.Exp(-minDistance);
            }

            // If pattern doesn't match any known normal pattern
            if (minDistance > _config.PatternDistanceThreshold)
            {
                return minDistance / (_config.PatternDistanceThreshold * 2);
            }

            return 0.0;
        }

        private async Task<double> CalculateContextualAnomalyScoreAsync(SensorReading reading, List<SensorReading> historicalData)
        {
            // Get contextual information
            var context = await GetEquipmentContextAsync(reading.EquipmentId);

            // Check operational state
            if (context.OperationalState == "Maintenance" || context.OperationalState == "Shutdown")
            {
                return 0.0; // Expected behavior during maintenance
            }

            // Consider related sensors
            var relatedSensorData = await GetRelatedSensorDataAsync(reading.EquipmentId, reading.Timestamp);

            // Multi-sensor correlation analysis
            var correlationScore = AnalyzeMultiSensorCorrelation(reading, relatedSensorData, historicalData);

            // Environmental context
            var environmentalScore = await AnalyzeEnvironmentalContextAsync(reading, context);

            // Operational context
            var operationalScore = AnalyzeOperationalContext(reading, context, historicalData);

            return (correlationScore + environmentalScore + operationalScore) / 3.0;
        }

        public async Task TrainModelsAsync(int equipmentId)
        {
            _logger.LogInformation($"Training advanced anomaly detection models for equipment {equipmentId}");

            try
            {
                var historicalData = await _influxDbService.GetReadingsForEquipmentAsync(
                    equipmentId,
                    DateTime.UtcNow.AddDays(-90),
                    DateTime.UtcNow);

                if (historicalData.Count < _config.MinimumTrainingDataPoints)
                {
                    _logger.LogWarning($"Insufficient data for equipment {equipmentId}. Need at least {_config.MinimumTrainingDataPoints} data points.");
                    return;
                }

                // Group by sensor type
                var sensorGroups = historicalData.GroupBy(r => r.SensorType);

                foreach (var group in sensorGroups)
                {
                    var sensorType = group.Key;
                    var sensorData = group.OrderBy(r => r.Timestamp).ToList();

                    // Train multiple models in parallel
                    var tasks = new List<Task>
                    {
                        TrainIsolationForestModelAsync(equipmentId, sensorType, sensorData),
                        TrainAutoencoderModelAsync(equipmentId, sensorType, sensorData),
                        TrainLSTMAnomalyModelAsync(equipmentId, sensorType, sensorData),
                        TrainSpectralModelAsync(equipmentId, sensorType, sensorData)
                    };

                    await Task.WhenAll(tasks);

                    // Learn patterns
                    await LearnAnomalyPatternsAsync(equipmentId, sensorType, sensorData);
                }

                // Update equipment profile
                await UpdateEquipmentAnomalyProfileAsync(equipmentId);

                _logger.LogInformation($"Successfully trained all anomaly detection models for equipment {equipmentId}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error training anomaly detection models for equipment {equipmentId}");
                throw;
            }
        }

        public async Task<AnomalyReport> GenerateAnomalyReportAsync(int equipmentId, DateTime from, DateTime to)
        {
            var report = new AnomalyReport
            {
                EquipmentId = equipmentId,
                ReportPeriod = new DateRange { From = from, To = to },
                GeneratedAt = DateTime.UtcNow
            };

            try
            {
                // Get all anomalies in the period
                var anomalies = await GetAnomaliesInPeriodAsync(equipmentId, from, to);
                report.TotalAnomalies = anomalies.Count;

                // Categorize anomalies
                report.AnomaliesBySensor = anomalies.GroupBy(a => a.SensorType)
                    .ToDictionary(g => g.Key, g => g.ToList());

                report.AnomaliesBySeverity = anomalies.GroupBy(a => a.Severity)
                    .ToDictionary(g => g.Key, g => g.Count());

                // Time distribution
                report.TimeDistribution = AnalyzeTimeDistribution(anomalies);

                // Pattern analysis
                report.IdentifiedPatterns = await IdentifyAnomalyPatternsAsync(equipmentId);

                // Root cause analysis for major anomalies
                var majorAnomalies = anomalies.Where(a => a.Severity == "High" || a.Severity == "Critical").ToList();
                report.RootCauseAnalyses = new List<RootCauseAnalysis>();

                foreach (var anomaly in majorAnomalies.Take(10)) // Top 10 major anomalies
                {
                    var rca = await PerformRootCauseAnalysisAsync(equipmentId, anomaly);
                    report.RootCauseAnalyses.Add(rca);
                }

                // Trend analysis
                report.TrendAnalysis = AnalyzeAnomalyTrends(anomalies);

                // Recommendations
                report.Recommendations = GenerateAnomalyRecommendations(report);

                // Executive summary
                report.ExecutiveSummary = GenerateExecutiveSummary(report);

                return report;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error generating anomaly report for equipment {equipmentId}");
                throw;
            }
        }

        public async Task<List<AnomalyPattern>> IdentifyAnomalyPatternsAsync(int equipmentId)
        {
            if (_knownPatterns.TryGetValue(equipmentId, out var cachedPatterns))
            {
                return cachedPatterns;
            }

            var patterns = new List<AnomalyPattern>();

            try
            {
                // Get historical anomalies
                var anomalies = await GetHistoricalAnomaliesAsync(equipmentId);

                if (anomalies.Count < 10)
                {
                    return patterns;
                }

                // Cluster anomalies
                var clusters = await ClusterAnomaliesAsync(anomalies);

                foreach (var cluster in clusters)
                {
                    var pattern = new AnomalyPattern
                    {
                        PatternId = Guid.NewGuid().ToString(),
                        Name = GeneratePatternName(cluster),
                        Description = AnalyzeClusterCharacteristics(cluster),
                        Frequency = cluster.Count,
                        AverageScore = cluster.Average(a => a.AnomalyScore ?? 0),
                        Characteristics = ExtractPatternCharacteristics(cluster),
                        IsAnomalous = true,
                        PredictiveIndicators = IdentifyPredictiveIndicators(cluster),
                        RecommendedActions = GeneratePatternActions(cluster)
                    };

                    patterns.Add(pattern);
                }

                // Cache patterns
                _knownPatterns[equipmentId] = patterns;

                return patterns;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error identifying anomaly patterns for equipment {equipmentId}");
                return patterns;
            }
        }

        public async Task<AnomalyPrediction> PredictFutureAnomaliesAsync(int equipmentId, int horizonHours)
        {
            var prediction = new AnomalyPrediction
            {
                EquipmentId = equipmentId,
                PredictionHorizon = horizonHours,
                GeneratedAt = DateTime.UtcNow
            };

            try
            {
                // Get equipment profile and patterns
                var profile = await GetOrCreateEquipmentProfileAsync(equipmentId);
                var patterns = await IdentifyAnomalyPatternsAsync(equipmentId);

                // Time series forecasting for each sensor
                var sensorTypes = await GetEquipmentSensorTypesAsync(equipmentId);

                foreach (var sensorType in sensorTypes)
                {
                    var sensorPredictions = await PredictSensorAnomaliesAsync(
                        equipmentId,
                        sensorType,
                        horizonHours);

                    prediction.SensorPredictions[sensorType] = sensorPredictions;
                }

                // Pattern-based prediction
                prediction.PredictedPatterns = await PredictFuturePatternsAsync(equipmentId, patterns, horizonHours);

                // Risk assessment
                prediction.RiskTimeline = GenerateRiskTimeline(prediction.SensorPredictions, prediction.PredictedPatterns);

                // High-risk periods
                prediction.HighRiskPeriods = IdentifyHighRiskPeriods(prediction.RiskTimeline);

                // Preventive actions
                prediction.PreventiveActions = GeneratePreventiveActions(prediction);

                return prediction;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error predicting future anomalies for equipment {equipmentId}");
                throw;
            }
        }

        public async Task<RootCauseAnalysis> PerformRootCauseAnalysisAsync(int equipmentId, Anomaly anomaly)
        {
            var analysis = new RootCauseAnalysis
            {
                AnomalyId = anomaly.Id,
                EquipmentId = equipmentId,
                AnalysisDate = DateTime.UtcNow
            };

            try
            {
                // Get comprehensive data around anomaly time
                var contextData = await GetAnomalyContextDataAsync(equipmentId, anomaly.DetectedAt);

                // Correlation analysis
                analysis.CorrelatedFactors = await AnalyzeCorrelatedFactorsAsync(anomaly, contextData);

                // Causal inference
                analysis.CausalChain = await InferCausalChainAsync(anomaly, contextData);

                // Similar historical incidents
                analysis.SimilarIncidents = await FindSimilarIncidentsAsync(anomaly);

                // Environmental factors
                analysis.EnvironmentalFactors = await AnalyzeEnvironmentalFactorsAsync(anomaly.DetectedAt);

                // Operational factors
                analysis.OperationalFactors = await AnalyzeOperationalFactorsAsync(equipmentId, anomaly.DetectedAt);

                // Component analysis
                analysis.ComponentAnalysis = await AnalyzeComponentContributionsAsync(equipmentId, anomaly);

                // Determine most likely root cause
                analysis.PrimaryRootCause = DeterminePrimaryRootCause(analysis);
                analysis.ConfidenceScore = CalculateRootCauseConfidence(analysis);

                // Recommendations
                analysis.Recommendations = GenerateRootCauseRecommendations(analysis);

                return analysis;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error performing root cause analysis for anomaly {anomaly.Id}");
                throw;
            }
        }

        // Private helper methods

        private async Task<AnomalyProfile> GetOrCreateEquipmentProfileAsync(int equipmentId)
        {
            if (_equipmentProfiles.TryGetValue(equipmentId, out var profile))
            {
                return profile;
            }

            profile = new AnomalyProfile
            {
                EquipmentId = equipmentId,
                SensorProfiles = new Dictionary<string, SensorAnomalyProfile>(),
                LastUpdated = DateTime.UtcNow
            };

            var sensorTypes = await GetEquipmentSensorTypesAsync(equipmentId);

            foreach (var sensorType in sensorTypes)
            {
                profile.SensorProfiles[sensorType] = new SensorAnomalyProfile
                {
                    SensorType = sensorType,
                    BaselineThreshold = _config.DefaultAnomalyThreshold,
                    AdaptiveThreshold = _config.DefaultAnomalyThreshold,
                    HistoricalAnomalyRate = 0.0
                };
            }

            _equipmentProfiles[equipmentId] = profile;
            return profile;
        }

        private double CalculateDynamicThreshold(AnomalyProfile profile, string sensorType)
        {
            if (!profile.SensorProfiles.TryGetValue(sensorType, out var sensorProfile))
            {
                return _config.DefaultAnomalyThreshold;
            }

            // Adaptive threshold based on historical performance
            var adaptiveFactor = 1.0;

            // Adjust based on false positive rate
            if (sensorProfile.FalsePositiveRate > 0.1)
            {
                adaptiveFactor += 0.1; // Increase threshold
            }
            else if (sensorProfile.FalsePositiveRate < 0.02)
            {
                adaptiveFactor -= 0.05; // Decrease threshold
            }

            // Adjust based on time of day/week patterns
            var timeBasedFactor = GetTimeBasedThresholdFactor(DateTime.UtcNow);

            return sensorProfile.AdaptiveThreshold * adaptiveFactor * timeBasedFactor;
        }

        private double CalculateEnsembleScore(Dictionary<string, double> scores, SensorReading reading, List<SensorReading> historicalData)
        {
            // Dynamic weighting based on algorithm performance
            var weights = GetDynamicWeights(reading.EquipmentId, reading.SensorType);

            // Calculate weighted average
            double ensembleScore = 0;
            double totalWeight = 0;

            foreach (var (algorithm, score) in scores)
            {
                if (weights.TryGetValue(algorithm, out var weight))
                {
                    ensembleScore += score * weight;
                    totalWeight += weight;
                }
            }

            if (totalWeight > 0)
            {
                ensembleScore /= totalWeight;
            }

            // Apply confidence adjustment
            var confidence = CalculateConfidence(scores);
            ensembleScore *= confidence;

            return Math.Min(1.0, Math.Max(0.0, ensembleScore));
        }

        private Dictionary<string, double> GetDynamicWeights(int equipmentId, string sensorType)
        {
            var modelKey = $"{equipmentId}_{sensorType}";

            // Default weights
            var weights = new Dictionary<string, double>
            {
                ["statistical"] = 0.15,
                ["isolationForest"] = 0.20,
                ["autoencoder"] = 0.20,
                ["spectral"] = 0.10,
                ["changePoint"] = 0.10,
                ["seasonal"] = 0.10,
                ["pattern"] = 0.10,
                ["contextual"] = 0.05
            };

            // Adjust based on model performance if available
            if (_modelPerformance.TryGetValue($"isolation_{modelKey}", out var isoPerf))
            {
                weights["isolationForest"] *= isoPerf.F1Score;
            }

            if (_modelPerformance.TryGetValue($"autoencoder_{modelKey}", out var aePerf))
            {
                weights["autoencoder"] *= aePerf.F1Score;
            }

            // Normalize weights
            var totalWeight = weights.Values.Sum();
            foreach (var key in weights.Keys.ToList())
            {
                weights[key] /= totalWeight;
            }

            return weights;
        }

        private double MedianAbsoluteDeviation(List<double> values)
        {
            var median = values.Median();
            var absoluteDeviations = values.Select(v => Math.Abs(v - median)).ToList();
            return absoluteDeviations.Median();
        }

        private async Task TrainIsolationForestModelAsync(int equipmentId, string sensorType, List<SensorReading> data)
        {
            try
            {
                // Prepare training data with features
                var trainingData = data.Select(r => ExtractIsolationForestFeatures(r, data)).ToList();
                var dataView = _mlContext.Data.LoadFromEnumerable(trainingData);

                // Split data
                var split = _mlContext.Data.TrainTestSplit(dataView, testFraction: 0.2);

                // Define pipeline
                var pipeline = _mlContext.Transforms.NormalizeMinMax("Features")
                    .Append(_mlContext.AnomalyDetection.Trainers.RandomizedPca(
                        featureColumnName: "Features",
                        rank: 20,
                        ensureZeroMean: true,
                        seed: 42));

                // Train model
                var model = pipeline.Fit(split.TrainSet);

                // Evaluate model
                var predictions = model.Transform(split.TestSet);
                var metrics = EvaluateAnomalyDetectionModel(predictions);

                // Store model
                var modelKey = $"isolation_{equipmentId}_{sensorType}";
                _isolationForestModels[modelKey] = model;
                _modelPerformance[modelKey] = metrics;

                _logger.LogInformation($"Isolation Forest model trained for {modelKey}: F1={metrics.F1Score:F2}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error training Isolation Forest model for equipment {equipmentId}, sensor {sensorType}");
            }
        }

        private async Task TrainAutoencoderModelAsync(int equipmentId, string sensorType, List<SensorReading> data)
        {
            try
            {
                // Prepare sequence data for autoencoder
                var sequences = PrepareSequenceData(data, windowSize: 20);
                var dataView = _mlContext.Data.LoadFromEnumerable(sequences);

                // Define autoencoder pipeline (simplified - in production, use deep learning framework)
                var pipeline = _mlContext.Transforms.NormalizeMinMax("Features")
                    .Append(_mlContext.Transforms.ApproximatedKernelMap("Features", rank: 10))
                    .Append(_mlContext.AnomalyDetection.Trainers.RandomizedPca(
                        featureColumnName: "Features",
                        rank: 5)); // Bottleneck dimension

                // Train model
                var model = pipeline.Fit(dataView);

                // Store model
                var modelKey = $"autoencoder_{equipmentId}_{sensorType}";
                _autoencoderModels[modelKey] = model;

                _logger.LogInformation($"Autoencoder model trained for {modelKey}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error training Autoencoder model for equipment {equipmentId}, sensor {sensorType}");
            }
        }

        private IsolationForestData ExtractIsolationForestFeatures(SensorReading reading, List<SensorReading> historicalData)
        {
            var recentData = historicalData
                .Where(r => r.Timestamp < reading.Timestamp)
                .OrderByDescending(r => r.Timestamp)
                .Take(20)
                .ToList();

            var features = new List<float>
            {
                (float)reading.Value,
                (float)(recentData.Any() ? reading.Value - recentData.First().Value : 0), // Delta
                (float)(recentData.Any() ? recentData.Average(r => r.Value) : reading.Value), // Recent average
                (float)(recentData.Any() ? recentData.StandardDeviation(r => r.Value) : 0), // Recent std dev
                (float)reading.Timestamp.Hour, // Hour of day
                (float)reading.Timestamp.DayOfWeek, // Day of week
                (float)(recentData.Count > 1 ? CalculateTrend(recentData) : 0) // Trend
            };

            // Add lag features
            for (int i = 0; i < 5; i++)
            {
                if (i < recentData.Count)
                {
                    features.Add((float)recentData[i].Value);
                }
                else
                {
                    features.Add(0);
                }
            }

            return new IsolationForestData { Features = features.ToArray() };
        }

        private double CalculateTrend(List<SensorReading> readings)
        {
            if (readings.Count < 2) return 0;

            var x = Enumerable.Range(0, readings.Count).Select(i => (double)i).ToArray();
            var y = readings.Select(r => r.Value).ToArray();

            var xMean = x.Average();
            var yMean = y.Average();

            var numerator = x.Zip(y, (xi, yi) => (xi - xMean) * (yi - yMean)).Sum();
            var denominator = x.Sum(xi => Math.Pow(xi - xMean, 2));

            return denominator == 0 ? 0 : numerator / denominator;
        }

        private void InitializeAnomalyDetection()
        {
            // Start background model performance monitoring
            Task.Run(async () =>
            {
                while (true)
                {
                    try
                    {
                        await Task.Delay(TimeSpan.FromHours(1));
                        await MonitorModelPerformanceAsync();
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error in model performance monitoring");
                    }
                }
            });

            // Start pattern learning task
            Task.Run(async () =>
            {
                while (true)
                {
                    try
                    {
                        await Task.Delay(TimeSpan.FromHours(6));
                        await UpdateAnomalyPatternsAsync();
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error in pattern learning task");
                    }
                }
            });
        }

        private async Task MonitorModelPerformanceAsync()
        {
            foreach (var (modelKey, metrics) in _modelPerformance)
            {
                if (metrics.LastUpdated < DateTime.UtcNow.AddDays(-7))
                {
                    // Retrain models that haven't been updated in a week
                    var parts = modelKey.Split('_');
                    if (parts.Length >= 3 && int.TryParse(parts[1], out var equipmentId))
                    {
                        await TrainModelsAsync(equipmentId);
                    }
                }
            }
        }

        private async Task UpdateAnomalyPatternsAsync()
        {
            foreach (var equipmentId in _equipmentProfiles.Keys)
            {
                await IdentifyAnomalyPatternsAsync(equipmentId);
            }
        }

        // Additional helper methods would be implemented here...
    }

    // Supporting classes
    public class AnomalyProfile
    {
        public int EquipmentId { get; set; }
        public Dictionary<string, SensorAnomalyProfile> SensorProfiles { get; set; } = new();
        public DateTime LastUpdated { get; set; }
        public double OverallAnomalyRate { get; set; }
    }

    public class SensorAnomalyProfile
    {
        public string SensorType { get; set; } = "";
        public double BaselineThreshold { get; set; }
        public double AdaptiveThreshold { get; set; }
        public double HistoricalAnomalyRate { get; set; }
        public double FalsePositiveRate { get; set; }
        public Dictionary<int, double> HourlyThresholds { get; set; } = new();
    }

    public class AnomalyPattern
    {
        public string PatternId { get; set; } = "";
        public string Name { get; set; } = "";
        public string Description { get; set; } = "";
        public int Frequency { get; set; }
        public double AverageScore { get; set; }
        public Dictionary<string, object> Characteristics { get; set; } = new();
        public bool IsAnomalous { get; set; }
        public List<string> PredictiveIndicators { get; set; } = new();
        public List<string> RecommendedActions { get; set; } = new();
    }

    public class AnomalySignature
    {
        public string SignatureId { get; set; } = "";
        public string SensorType { get; set; } = "";
        public List<double> FeatureVector { get; set; } = new();
        public double Severity { get; set; }
        public string Category { get; set; } = "";
    }

    public class AnomalyReport
    {
        public int EquipmentId { get; set; }
        public DateRange ReportPeriod { get; set; } = new();
        public DateTime GeneratedAt { get; set; }
        public int TotalAnomalies { get; set; }
        public Dictionary<string, List<Anomaly>> AnomaliesBySensor { get; set; } = new();
        public Dictionary<string, int> AnomaliesBySeverity { get; set; } = new();
        public TimeDistribution TimeDistribution { get; set; } = new();
        public List<AnomalyPattern> IdentifiedPatterns { get; set; } = new();
        public List<RootCauseAnalysis> RootCauseAnalyses { get; set; } = new();
        public TrendAnalysis TrendAnalysis { get; set; } = new();
        public List<string> Recommendations { get; set; } = new();
        public string ExecutiveSummary { get; set; } = "";
    }

    public class AnomalyPrediction
    {
        public int EquipmentId { get; set; }
        public int PredictionHorizon { get; set; }
        public DateTime GeneratedAt { get; set; }
        public Dictionary<string, List<TimeSeries<double>>> SensorPredictions { get; set; } = new();
        public List<FuturePattern> PredictedPatterns { get; set; } = new();
        public List<RiskTimePoint> RiskTimeline { get; set; } = new();
        public List<HighRiskPeriod> HighRiskPeriods { get; set; } = new();
        public List<PreventiveAction> PreventiveActions { get; set; } = new();
    }

    public class RootCauseAnalysis
    {
        public int AnomalyId { get; set; }
        public int EquipmentId { get; set; }
        public DateTime AnalysisDate { get; set; }
        public List<CorrelatedFactor> CorrelatedFactors { get; set; } = new();
        public CausalChain CausalChain { get; set; } = new();
        public List<SimilarIncident> SimilarIncidents { get; set; } = new();
        public EnvironmentalFactors EnvironmentalFactors { get; set; } = new();
        public OperationalFactors OperationalFactors { get; set; } = new();
        public ComponentAnalysis ComponentAnalysis { get; set; } = new();
        public string PrimaryRootCause { get; set; } = "";
        public double ConfidenceScore { get; set; }
        public List<string> Recommendations { get; set; } = new();
    }

    public class AnomalyDetectionConfig
    {
        public double DefaultAnomalyThreshold { get; set; } = 0.7;
        public int MinimumDataPoints { get; set; } = 100;
        public int MinimumTrainingDataPoints { get; set; } = 1000;
        public double PatternDistanceThreshold { get; set; } = 2.0;
        public int AnomalyRetentionDays { get; set; } = 365;
    }

    // ML.NET specific classes
    public class IsolationForestData
    {
        [VectorType(12)]
        public float[] Features { get; set; } = new float[12];
    }

    public class IsolationForestPrediction
    {
        public float Score { get; set; }
        public bool IsAnomaly { get; set; }
    }

    public class ChangePointPrediction
    {
        [VectorType(4)]
        public double[] Prediction { get; set; } = new double[4];
    }

    // Additional supporting classes
    public class DateRange
    {
        public DateTime From { get; set; }
        public DateTime To { get; set; }
    }

    public class TimeDistribution
    {
        public Dictionary<int, int> HourlyDistribution { get; set; } = new();
        public Dictionary<DayOfWeek, int> DailyDistribution { get; set; } = new();
        public Dictionary<int, int> MonthlyDistribution { get; set; } = new();
    }

    public class TrendAnalysis
    {
        public string TrendDirection { get; set; } = "";
        public double TrendStrength { get; set; }
        public List<string> Insights { get; set; } = new();
    }

    public class TimeSeries<T>
    {
        public DateTime Timestamp { get; set; }
        public T Value { get; set; } = default!;
        public double Confidence { get; set; }
    }

    public class FuturePattern
    {
        public DateTime PredictedTime { get; set; }
        public AnomalyPattern Pattern { get; set; } = new();
        public double Probability { get; set; }
    }

    public class RiskTimePoint
    {
        public DateTime Timestamp { get; set; }
        public double RiskScore { get; set; }
        public List<string> ContributingFactors { get; set; } = new();
    }

    public class HighRiskPeriod
    {
        public DateTime Start { get; set; }
        public DateTime End { get; set; }
        public double MaxRiskScore { get; set; }
        public string PrimaryRisk { get; set; } = "";
    }

    public class PreventiveAction
    {
        public string Action { get; set; } = "";
        public DateTime RecommendedTime { get; set; }
        public double ExpectedRiskReduction { get; set; }
        public string Priority { get; set; } = "";
    }

    public class CorrelatedFactor
    {
        public string FactorName { get; set; } = "";
        public double CorrelationStrength { get; set; }
        public string Direction { get; set; } = "";
        public double TimeLag { get; set; }
    }

    public class CausalChain
    {
        public List<CausalLink> Links { get; set; } = new();
        public double OverallConfidence { get; set; }
    }

    public class CausalLink
    {
        public string Cause { get; set; } = "";
        public string Effect { get; set; } = "";
        public double Strength { get; set; }
        public double TimeDelay { get; set; }
    }

    public class SimilarIncident
    {
        public DateTime IncidentDate { get; set; }
        public double SimilarityScore { get; set; }
        public string Resolution { get; set; } = "";
        public double ResolutionEffectiveness { get; set; }
    }

    public class EnvironmentalFactors
    {
        public double Temperature { get; set; }
        public double Humidity { get; set; }
        public string WeatherCondition { get; set; } = "";
        public Dictionary<string, double> OtherFactors { get; set; } = new();
    }

    public class OperationalFactors
    {
        public string OperationalState { get; set; } = "";
        public double LoadPercentage { get; set; }
        public int RuntimeHours { get; set; }
        public Dictionary<string, object> Parameters { get; set; } = new();
    }

    public class ComponentAnalysis
    {
        public Dictionary<string, double> ComponentContributions { get; set; } = new();
        public string MostLikelyComponent { get; set; } = "";
        public List<string> AffectedComponents { get; set; } = new();
    }
}
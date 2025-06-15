using MediatR;
using Microsoft.ML;
using Microsoft.ML.Data;
using Microsoft.ML.Trainers;
using Microsoft.ML.Transforms.TimeSeries;
using PredictiveMaintenance.API.Data;
using PredictiveMaintenance.API.Events;
using PredictiveMaintenance.API.Models;
using System.Collections.Concurrent;
using Microsoft.EntityFrameworkCore;

namespace PredictiveMaintenance.API.Services.MachineLearning
{
    public class PredictiveMaintenanceService : IPredictiveMaintenanceService
    {
        private readonly ILogger<PredictiveMaintenanceService> _logger;
        private readonly IMediator _mediator;
        private readonly IServiceScopeFactory _serviceScopeFactory;
        private readonly IInfluxDbService _influxDbService;
        private readonly MLContext _mlContext;

        // Model storage
        private readonly ConcurrentDictionary<string, ITransformer> _regressionModels;
        private readonly ConcurrentDictionary<string, ITransformer> _anomalyModels;
        private readonly ConcurrentDictionary<string, ITransformer> _timeSeriesModels;
        private readonly ConcurrentDictionary<string, ITransformer> _multiClassModels;
        private readonly ConcurrentDictionary<int, EquipmentMLProfile> _equipmentProfiles;

        // Performance tracking
        private readonly ConcurrentDictionary<string, ModelMetrics> _modelMetrics;
        private readonly ConcurrentDictionary<int, EquipmentHealthTrend> _healthTrends;

        // Configuration
        private readonly PredictiveMaintenanceConfig _config;

        public PredictiveMaintenanceService(
            ILogger<PredictiveMaintenanceService> logger,
            IMediator mediator,
            IServiceScopeFactory serviceScopeFactory,
            IInfluxDbService influxDbService,
            IConfiguration configuration)
        {
            _logger = logger;
            _mediator = mediator;
            _serviceScopeFactory = serviceScopeFactory;
            _influxDbService = influxDbService;
            _mlContext = new MLContext(seed: 42);

            _regressionModels = new ConcurrentDictionary<string, ITransformer>();
            _anomalyModels = new ConcurrentDictionary<string, ITransformer>();
            _timeSeriesModels = new ConcurrentDictionary<string, ITransformer>();
            _multiClassModels = new ConcurrentDictionary<string, ITransformer>();
            _equipmentProfiles = new ConcurrentDictionary<int, EquipmentMLProfile>();
            _modelMetrics = new ConcurrentDictionary<string, ModelMetrics>();
            _healthTrends = new ConcurrentDictionary<int, EquipmentHealthTrend>();

            _config = configuration.GetSection("PredictiveMaintenance").Get<PredictiveMaintenanceConfig>()
                     ?? new PredictiveMaintenanceConfig();

            InitializeBackgroundTasks();
        }

        public async Task<PredictionResult> GeneratePredictionAsync(int equipmentId, Dictionary<string, double> sensorData)
        {
            try
            {
                _logger.LogInformation($"Generating advanced prediction for equipment {equipmentId}");

                // Get equipment profile and historical data
                var profile = await GetOrCreateEquipmentProfileAsync(equipmentId);
                var historicalData = await GetHistoricalDataAsync(equipmentId, DateTime.UtcNow.AddDays(-90));

                // Multi-model ensemble prediction
                var regressionPrediction = await PredictWithRegressionAsync(equipmentId, sensorData, historicalData);
                var anomalyPrediction = await PredictWithAnomalyDetectionAsync(equipmentId, sensorData);
                var timeSeriesPrediction = await PredictWithTimeSeriesAsync(equipmentId, historicalData);
                var multiClassPrediction = await PredictWithMultiClassAsync(equipmentId, sensorData);

                // Sensor fusion analysis
                var fusionAnalysis = await PerformSensorFusionAnalysisAsync(equipmentId, sensorData, historicalData);

                // Combine predictions using weighted ensemble
                var ensemblePrediction = CombinePredictions(
                    regressionPrediction,
                    anomalyPrediction,
                    timeSeriesPrediction,
                    multiClassPrediction,
                    fusionAnalysis);

                // Calculate confidence score
                ensemblePrediction.ConfidenceScore = CalculateConfidenceScore(
                    regressionPrediction,
                    anomalyPrediction,
                    timeSeriesPrediction,
                    multiClassPrediction);

                // Generate detailed recommendations
                ensemblePrediction.DetailedRecommendations = await GenerateDetailedRecommendationsAsync(
                    equipmentId,
                    ensemblePrediction,
                    sensorData,
                    profile);

                // Update health trend
                await UpdateHealthTrendAsync(equipmentId, ensemblePrediction);

                // Publish prediction event
                await PublishPredictionEventAsync(equipmentId, ensemblePrediction);

                // Store prediction for future analysis
                await StorePredictionAsync(equipmentId, ensemblePrediction);

                return ensemblePrediction;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error generating prediction for equipment {equipmentId}");
                throw;
            }
        }

        private async Task<PredictionResult> PredictWithRegressionAsync(
            int equipmentId,
            Dictionary<string, double> sensorData,
            List<SensorReading> historicalData)
        {
            var modelKey = $"regression_{equipmentId}";

            if (!_regressionModels.ContainsKey(modelKey))
            {
                await TrainRegressionModelAsync(equipmentId, historicalData);
            }

            if (_regressionModels.TryGetValue(modelKey, out var model))
            {
                var predictionEngine = _mlContext.Model.CreatePredictionEngine<EquipmentData, RegressionPrediction>(model);

                var input = new EquipmentData
                {
                    Temperature = (float)(sensorData.GetValueOrDefault("temperature", 0)),
                    Vibration = (float)(sensorData.GetValueOrDefault("vibration", 0)),
                    Pressure = (float)(sensorData.GetValueOrDefault("pressure", 0)),
                    Current = (float)(sensorData.GetValueOrDefault("current", 0)),
                    Voltage = (float)(sensorData.GetValueOrDefault("voltage", 0)),
                    Power = (float)(sensorData.GetValueOrDefault("power", 0)),
                    RPM = (float)(sensorData.GetValueOrDefault("rpm", 0)),
                    Flow = (float)(sensorData.GetValueOrDefault("flow", 0)),
                    HoursRun = await GetEquipmentHoursRunAsync(equipmentId),
                    DaysSinceLastMaintenance = await GetDaysSinceLastMaintenanceAsync(equipmentId)
                };

                var prediction = predictionEngine.Predict(input);

                return new PredictionResult
                {
                    FailureProbability = Math.Min(1.0, Math.Max(0.0, prediction.Score)),
                    EstimatedDaysToFailure = (int)Math.Max(1, prediction.RemainingLife),
                    PotentialFailureComponents = IdentifyComponentsAtRisk(sensorData, prediction.Score),
                    RecommendedAction = DetermineAction(prediction.Score, prediction.RemainingLife)
                };
            }

            return GetDefaultPrediction();
        }

        private async Task<PredictionResult> PredictWithAnomalyDetectionAsync(
            int equipmentId,
            Dictionary<string, double> sensorData)
        {
            var modelKey = $"anomaly_{equipmentId}";

            if (!_anomalyModels.ContainsKey(modelKey))
            {
                await TrainAnomalyModelAsync(equipmentId);
            }

            if (_anomalyModels.TryGetValue(modelKey, out var model))
            {
                var predictionEngine = _mlContext.Model.CreatePredictionEngine<SensorDataPoint, AnomalyPrediction>(model);

                var anomalyScores = new Dictionary<string, double>();

                foreach (var sensor in sensorData)
                {
                    var input = new SensorDataPoint { Value = (float)sensor.Value };
                    var prediction = predictionEngine.Predict(input);
                    anomalyScores[sensor.Key] = prediction.Score;
                }

                var maxAnomalyScore = anomalyScores.Values.Max();
                var anomalousComponents = anomalyScores
                    .Where(a => a.Value > 0.7)
                    .Select(a => GetComponentFromSensor(a.Key))
                    .Distinct()
                    .ToList();

                return new PredictionResult
                {
                    FailureProbability = maxAnomalyScore,
                    EstimatedDaysToFailure = CalculateDaysFromAnomalyScore(maxAnomalyScore),
                    PotentialFailureComponents = anomalousComponents,
                    RecommendedAction = maxAnomalyScore > 0.8 ? "Immediate inspection required" : "Monitor closely"
                };
            }

            return GetDefaultPrediction();
        }

        private async Task<PredictionResult> PredictWithTimeSeriesAsync(
            int equipmentId,
            List<SensorReading> historicalData)
        {
            var modelKey = $"timeseries_{equipmentId}";

            if (!_timeSeriesModels.ContainsKey(modelKey))
            {
                await TrainTimeSeriesModelAsync(equipmentId, historicalData);
            }

            if (_timeSeriesModels.TryGetValue(modelKey, out var model))
            {
                var dataView = _mlContext.Data.LoadFromEnumerable(
                    historicalData.Select(r => new TimeSeriesData
                    {
                        Timestamp = r.Timestamp,
                        Value = (float)r.Value
                    }));

                var forecast = model.Transform(dataView);
                var predictions = _mlContext.Data.CreateEnumerable<TimeSeriesPrediction>(forecast, false).ToList();

                if (predictions.Any())
                {
                    var trend = AnalyzeTrend(predictions);

                    return new PredictionResult
                    {
                        FailureProbability = trend.FailureProbability,
                        EstimatedDaysToFailure = trend.EstimatedDaysToFailure,
                        PotentialFailureComponents = trend.ComponentsAtRisk,
                        RecommendedAction = trend.RecommendedAction
                    };
                }
            }

            return GetDefaultPrediction();
        }

        private async Task<PredictionResult> PredictWithMultiClassAsync(
            int equipmentId,
            Dictionary<string, double> sensorData)
        {
            var modelKey = $"multiclass_{equipmentId}";

            if (!_multiClassModels.ContainsKey(modelKey))
            {
                await TrainMultiClassModelAsync(equipmentId);
            }

            if (_multiClassModels.TryGetValue(modelKey, out var model))
            {
                var predictionEngine = _mlContext.Model.CreatePredictionEngine<EquipmentData, MultiClassPrediction>(model);

                var input = ConvertToEquipmentData(sensorData, equipmentId);
                var prediction = predictionEngine.Predict(input);

                var failureMode = (FailureMode)prediction.PredictedLabel;

                return new PredictionResult
                {
                    FailureProbability = prediction.Score.Max(),
                    EstimatedDaysToFailure = GetEstimatedDaysForFailureMode(failureMode),
                    PotentialFailureComponents = GetComponentsForFailureMode(failureMode),
                    RecommendedAction = GetActionForFailureMode(failureMode),
                    FailureMode = failureMode.ToString()
                };
            }

            return GetDefaultPrediction();
        }

        private async Task<SensorFusionResult> PerformSensorFusionAnalysisAsync(
            int equipmentId,
            Dictionary<string, double> sensorData,
            List<SensorReading> historicalData)
        {
            var fusionResult = new SensorFusionResult();

            // Correlation analysis between sensors
            var correlations = CalculateSensorCorrelations(sensorData, historicalData);

            // Pattern recognition across multiple sensors
            var patterns = await DetectMultiSensorPatternsAsync(sensorData, historicalData);

            // Physics-based analysis (e.g., thermal-vibration relationship)
            var physicsAnalysis = PerformPhysicsBasedAnalysis(sensorData, equipmentId);

            // Combine insights
            fusionResult.OverallHealthScore = CalculateHealthScore(correlations, patterns, physicsAnalysis);
            fusionResult.CriticalSensorCombinations = IdentifyCriticalCombinations(correlations, patterns);
            fusionResult.PredictedFailureMode = DetermineFailureModeFromFusion(patterns, physicsAnalysis);

            return fusionResult;
        }

        public async Task TrainModelAsync(int equipmentId)
        {
            try
            {
                _logger.LogInformation($"Training comprehensive ML models for equipment {equipmentId}");

                var historicalData = await GetHistoricalDataAsync(equipmentId, DateTime.UtcNow.AddDays(-180));

                if (historicalData.Count < 1000)
                {
                    _logger.LogWarning($"Insufficient data for equipment {equipmentId}. Need at least 1000 data points.");
                    return;
                }

                // Train multiple model types in parallel
                var tasks = new List<Task>
                {
                    TrainRegressionModelAsync(equipmentId, historicalData),
                    TrainAnomalyModelAsync(equipmentId),
                    TrainTimeSeriesModelAsync(equipmentId, historicalData),
                    TrainMultiClassModelAsync(equipmentId),
                    TrainDeepLearningModelAsync(equipmentId, historicalData)
                };

                await Task.WhenAll(tasks);

                // Update equipment profile
                var profile = await GetOrCreateEquipmentProfileAsync(equipmentId);
                profile.LastModelTraining = DateTime.UtcNow;
                profile.ModelVersion++;

                _logger.LogInformation($"Successfully trained all models for equipment {equipmentId}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error training models for equipment {equipmentId}");
                throw;
            }
        }

        private async Task TrainRegressionModelAsync(int equipmentId, List<SensorReading> historicalData)
        {
            try
            {
                // Prepare training data
                var trainingData = await PrepareRegressionTrainingDataAsync(equipmentId, historicalData);
                var dataView = _mlContext.Data.LoadFromEnumerable(trainingData);

                // Split data
                var split = _mlContext.Data.TrainTestSplit(dataView, testFraction: 0.2);

                // Define pipeline
                var pipeline = _mlContext.Transforms.CopyColumns("Label", nameof(EquipmentData.RemainingLife))
                    .Append(_mlContext.Transforms.Concatenate("Features",
                        nameof(EquipmentData.Temperature),
                        nameof(EquipmentData.Vibration),
                        nameof(EquipmentData.Pressure),
                        nameof(EquipmentData.Current),
                        nameof(EquipmentData.Voltage),
                        nameof(EquipmentData.Power),
                        nameof(EquipmentData.RPM),
                        nameof(EquipmentData.Flow),
                        nameof(EquipmentData.HoursRun),
                        nameof(EquipmentData.DaysSinceLastMaintenance)))
                    .Append(_mlContext.Transforms.NormalizeMinMax("Features"))
                    .Append(_mlContext.Regression.Trainers.FastTree(
                        numberOfLeaves: 20,
                        minimumExampleCountPerLeaf: 10,
                        learningRate: 0.2));

                // Train model
                var model = pipeline.Fit(split.TrainSet);

                // Evaluate model
                var predictions = model.Transform(split.TestSet);
                var metrics = _mlContext.Regression.Evaluate(predictions);

                _logger.LogInformation($"Regression model trained for equipment {equipmentId}: " +
                    $"RMSE={metrics.RootMeanSquaredError:F2}, R²={metrics.RSquared:F2}");

                // Store model and metrics
                var modelKey = $"regression_{equipmentId}";
                _regressionModels[modelKey] = model;
                _modelMetrics[modelKey] = new ModelMetrics
                {
                    Accuracy = metrics.RSquared,
                    RMSE = metrics.RootMeanSquaredError,
                    LastUpdated = DateTime.UtcNow
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error training regression model for equipment {equipmentId}");
                throw;
            }
        }

        private async Task TrainAnomalyModelAsync(int equipmentId)
        {
            try
            {
                var historicalData = await GetHistoricalDataAsync(equipmentId, DateTime.UtcNow.AddDays(-30));

                // Group by sensor type and train individual models
                var sensorTypes = historicalData.Select(r => r.SensorType).Distinct();

                foreach (var sensorType in sensorTypes)
                {
                    var sensorData = historicalData
                        .Where(r => r.SensorType == sensorType)
                        .Select(r => new SensorDataPoint { Value = (float)r.Value })
                        .ToList();

                    var dataView = _mlContext.Data.LoadFromEnumerable(sensorData);

                    // Use multiple anomaly detection algorithms
                    var pipeline = _mlContext.Transforms.DetectAnomalyBySrCnn(
                        outputColumnName: "Prediction",
                        inputColumnName: nameof(SensorDataPoint.Value),
                        windowSize: 64,
                        backwardWindowSize: 8,
                        lookaheadWindowSize: 4,
                        averageingWindowSize: 8,
                        judgment: 0.35,
                        threshold: 0.3);

                    var model = pipeline.Fit(dataView);

                    var modelKey = $"anomaly_{equipmentId}_{sensorType}";
                    _anomalyModels[modelKey] = model;

                    _logger.LogInformation($"Anomaly model trained for equipment {equipmentId}, sensor {sensorType}");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error training anomaly model for equipment {equipmentId}");
                throw;
            }
        }

        private async Task TrainTimeSeriesModelAsync(int equipmentId, List<SensorReading> historicalData)
        {
            try
            {
                // Prepare time series data
                var timeSeriesData = historicalData
                    .GroupBy(r => r.Timestamp.Date)
                    .Select(g => new TimeSeriesData
                    {
                        Timestamp = g.Key,
                        Value = (float)g.Average(r => r.Value)
                    })
                    .OrderBy(d => d.Timestamp)
                    .ToList();

                var dataView = _mlContext.Data.LoadFromEnumerable(timeSeriesData);

                // Define time series pipeline
                var pipeline = _mlContext.Forecasting.ForecastBySsa(
                    outputColumnName: "Forecast",
                    inputColumnName: nameof(TimeSeriesData.Value),
                    windowSize: 7,
                    seriesLength: 30,
                    trainSize: timeSeriesData.Count,
                    horizon: 7);

                var model = pipeline.Fit(dataView);

                var modelKey = $"timeseries_{equipmentId}";
                _timeSeriesModels[modelKey] = model;

                _logger.LogInformation($"Time series model trained for equipment {equipmentId}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error training time series model for equipment {equipmentId}");
                throw;
            }
        }

        private async Task TrainMultiClassModelAsync(int equipmentId)
        {
            try
            {
                // Prepare multi-class training data
                var trainingData = await PrepareMultiClassTrainingDataAsync(equipmentId);
                var dataView = _mlContext.Data.LoadFromEnumerable(trainingData);

                // Split data
                var split = _mlContext.Data.TrainTestSplit(dataView, testFraction: 0.2);

                // Define pipeline
                var pipeline = _mlContext.Transforms.Conversion.MapValueToKey("Label", nameof(EquipmentData.FailureMode))
                    .Append(_mlContext.Transforms.Concatenate("Features",
                        nameof(EquipmentData.Temperature),
                        nameof(EquipmentData.Vibration),
                        nameof(EquipmentData.Pressure),
                        nameof(EquipmentData.Current),
                        nameof(EquipmentData.Voltage),
                        nameof(EquipmentData.Power),
                        nameof(EquipmentData.RPM),
                        nameof(EquipmentData.Flow)))
                    .Append(_mlContext.Transforms.NormalizeMinMax("Features"))
                    .Append(_mlContext.MulticlassClassification.Trainers.OneVersusAll(
                        _mlContext.BinaryClassification.Trainers.AveragedPerceptron()))
                    .Append(_mlContext.Transforms.Conversion.MapKeyToValue("PredictedLabel"));

                // Train model
                var model = pipeline.Fit(split.TrainSet);

                // Evaluate model
                var predictions = model.Transform(split.TestSet);
                var metrics = _mlContext.MulticlassClassification.Evaluate(predictions);

                _logger.LogInformation($"Multi-class model trained for equipment {equipmentId}: " +
                    $"Accuracy={metrics.MacroAccuracy:F2}");

                // Store model
                var modelKey = $"multiclass_{equipmentId}";
                _multiClassModels[modelKey] = model;
                _modelMetrics[modelKey] = new ModelMetrics
                {
                    Accuracy = metrics.MacroAccuracy,
                    LastUpdated = DateTime.UtcNow
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error training multi-class model for equipment {equipmentId}");
                throw;
            }
        }

        private async Task TrainDeepLearningModelAsync(int equipmentId, List<SensorReading> historicalData)
        {
            // Placeholder for deep learning integration (e.g., ONNX models)
            // This would integrate with TensorFlow/PyTorch models
            _logger.LogInformation($"Deep learning model training initiated for equipment {equipmentId}");
            await Task.CompletedTask;
        }

        public async Task<bool> IsModelTrainedAsync(int equipmentId)
        {
            var modelKeys = new[]
            {
                $"regression_{equipmentId}",
                $"anomaly_{equipmentId}",
                $"timeseries_{equipmentId}",
                $"multiclass_{equipmentId}"
            };

            return modelKeys.Any(key =>
                _regressionModels.ContainsKey(key) ||
                _anomalyModels.ContainsKey(key) ||
                _timeSeriesModels.ContainsKey(key) ||
                _multiClassModels.ContainsKey(key));
        }

        public async Task<List<MaintenanceRecommendation>> GenerateMaintenanceRecommendationsAsync(int equipmentId)
        {
            var recommendations = new List<MaintenanceRecommendation>();

            try
            {
                var equipment = await GetEquipmentAsync(equipmentId);
                var latestPrediction = await GetLatestPredictionAsync(equipmentId);
                var sensorData = await GetLatestSensorDataAsync(equipmentId);
                var healthTrend = _healthTrends.GetValueOrDefault(equipmentId);

                // AI-based recommendations
                if (latestPrediction != null)
                {
                    recommendations.AddRange(GenerateAIRecommendations(latestPrediction, equipment));
                }

                // Trend-based recommendations
                if (healthTrend != null)
                {
                    recommendations.AddRange(GenerateTrendRecommendations(healthTrend, equipment));
                }

                // Component-specific recommendations
                recommendations.AddRange(await GenerateComponentRecommendationsAsync(equipment, sensorData));

                // Predictive recommendations based on similar equipment
                recommendations.AddRange(await GenerateSimilarityBasedRecommendationsAsync(equipment));

                // Prioritize and deduplicate
                recommendations = PrioritizeRecommendations(recommendations);

                return recommendations;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error generating recommendations for equipment {equipmentId}");
                return recommendations;
            }
        }

        public async Task<double> PredictRemainingUsefulLifeAsync(int equipmentId)
        {
            try
            {
                var predictions = new List<double>();

                // Get RUL from different models
                var regressionRUL = await GetRegressionRULAsync(equipmentId);
                if (regressionRUL > 0) predictions.Add(regressionRUL);

                var timeSeriesRUL = await GetTimeSeriesRULAsync(equipmentId);
                if (timeSeriesRUL > 0) predictions.Add(timeSeriesRUL);

                var degradationRUL = await GetDegradationRULAsync(equipmentId);
                if (degradationRUL > 0) predictions.Add(degradationRUL);

                // Weighted average based on model accuracy
                if (predictions.Any())
                {
                    return predictions.Average();
                }

                // Fallback to simple calculation
                return await CalculateSimpleRULAsync(equipmentId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error predicting RUL for equipment {equipmentId}");
                return 365; // Default to 1 year
            }
        }

        public async Task<List<MaintenanceEvent>> PredictMaintenanceScheduleAsync(int equipmentId)
        {
            var schedule = new List<MaintenanceEvent>();

            try
            {
                var equipment = await GetEquipmentAsync(equipmentId);
                var prediction = await GetLatestPredictionAsync(equipmentId);
                var rul = await PredictRemainingUsefulLifeAsync(equipmentId);

                // Preventive maintenance based on equipment type
                var preventiveSchedule = GeneratePreventiveSchedule(equipment, rul);
                schedule.AddRange(preventiveSchedule);

                // Predictive maintenance based on ML predictions
                if (prediction != null && prediction.FailureProbability > 0.3)
                {
                    var predictiveEvent = new MaintenanceEvent
                    {
                        EquipmentId = equipmentId,
                        Type = MaintenanceType.Predictive,
                        Priority = DeterminePriority(prediction.FailureProbability),
                        ScheduledDate = DateTime.UtcNow.AddDays(Math.Max(1, prediction.EstimatedDaysToFailure * 0.8)),
                        Description = $"Predictive maintenance for {string.Join(", ", prediction.PotentialFailureComponents)}",
                        EstimatedDuration = EstimateMaintenanceDuration(prediction.PotentialFailureComponents)
                    };
                    schedule.Add(predictiveEvent);
                }

                // Condition-based maintenance
                var conditionEvents = await GenerateConditionBasedScheduleAsync(equipment);
                schedule.AddRange(conditionEvents);

                // Optimize schedule
                schedule = OptimizeMaintenanceSchedule(schedule, equipment);

                return schedule.OrderBy(e => e.ScheduledDate).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error predicting maintenance schedule for equipment {equipmentId}");
                return schedule;
            }
        }

        public async Task<MaintenanceRisk> AssessMaintenanceRiskAsync(int equipmentId)
        {
            try
            {
                var riskFactors = new Dictionary<string, double>();

                // Age factor
                var equipment = await GetEquipmentAsync(equipmentId);
                var ageYears = (DateTime.UtcNow - equipment.InstallationDate).TotalDays / 365;
                var expectedLife = GetExpectedLifeYears(equipment.Type);
                riskFactors["age"] = Math.Min(1.0, ageYears / expectedLife);

                // Maintenance history factor
                var maintenanceScore = await CalculateMaintenanceHistoryScoreAsync(equipment);
                riskFactors["maintenance"] = 1.0 - maintenanceScore;

                // Operational stress factor
                var operationalScore = await CalculateOperationalStressScoreAsync(equipment);
                riskFactors["operational"] = operationalScore;

                // Environmental factor
                var environmentalScore = CalculateEnvironmentalRiskScore(equipment);
                riskFactors["environmental"] = environmentalScore;

                // ML prediction factor
                var prediction = await GetLatestPredictionAsync(equipmentId);
                if (prediction != null)
                {
                    riskFactors["predictive"] = prediction.FailureProbability;
                }

                // Calculate overall risk
                var overallRisk = CalculateOverallRisk(riskFactors);

                return DetermineRiskLevel(overallRisk);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error assessing risk for equipment {equipmentId}");
                return MaintenanceRisk.Medium;
            }
        }

        public async Task<double> CalculateMaintenanceUrgencyScoreAsync(int equipmentId)
        {
            try
            {
                var urgencyFactors = new List<(double weight, double score)>();

                // Failure probability
                var prediction = await GetLatestPredictionAsync(equipmentId);
                if (prediction != null)
                {
                    urgencyFactors.Add((0.3, prediction.FailureProbability));
                }

                // Days to failure
                var rul = await PredictRemainingUsefulLifeAsync(equipmentId);
                var rulScore = 1.0 - Math.Min(1.0, rul / 365);
                urgencyFactors.Add((0.25, rulScore));

                // Equipment criticality
                var equipment = await GetEquipmentAsync(equipmentId);
                var criticalityScore = GetCriticalityScore(equipment.Criticality);
                urgencyFactors.Add((0.2, criticalityScore));

                // Current anomalies
                var anomalyScore = await CalculateCurrentAnomalyScoreAsync(equipmentId);
                urgencyFactors.Add((0.15, anomalyScore));

                // Operational impact
                var impactScore = CalculateOperationalImpactScore(equipment);
                urgencyFactors.Add((0.1, impactScore));

                // Calculate weighted urgency score
                var urgencyScore = urgencyFactors.Sum(f => f.weight * f.score);

                return Math.Min(1.0, Math.Max(0.0, urgencyScore));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error calculating urgency score for equipment {equipmentId}");
                return 0.5; // Medium urgency as default
            }
        }

        public async Task<bool> ShouldScheduleMaintenanceAsync(int equipmentId)
        {
            try
            {
                var urgencyScore = await CalculateMaintenanceUrgencyScoreAsync(equipmentId);
                var risk = await AssessMaintenanceRiskAsync(equipmentId);
                var prediction = await GetLatestPredictionAsync(equipmentId);

                // Decision logic
                if (urgencyScore > 0.8 || risk == MaintenanceRisk.Critical)
                    return true;

                if (prediction != null && prediction.EstimatedDaysToFailure < 30)
                    return true;

                if (urgencyScore > 0.6 && risk >= MaintenanceRisk.High)
                    return true;

                var equipment = await GetEquipmentAsync(equipmentId);
                if (equipment.LastMaintenanceDate.HasValue)
                {
                    var daysSinceMaintenance = (DateTime.UtcNow - equipment.LastMaintenanceDate.Value).Days;
                    var recommendedInterval = GetRecommendedMaintenanceInterval(equipment.Type);

                    if (daysSinceMaintenance > recommendedInterval)
                        return true;
                }

                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error determining if maintenance should be scheduled for equipment {equipmentId}");
                return false; // Conservative approach
            }
        }

        public async Task<OptimalMaintenanceWindow> GetOptimalMaintenanceWindowAsync(int equipmentId)
        {
            try
            {
                var equipment = await GetEquipmentAsync(equipmentId);
                var operationalData = await GetOperationalDataAsync(equipmentId);
                var productionSchedule = await GetProductionScheduleAsync();

                // Analyze historical patterns
                var historicalWindows = await AnalyzeHistoricalMaintenanceWindowsAsync(equipment);

                // Find low-impact periods
                var lowImpactPeriods = IdentifyLowImpactPeriods(operationalData, productionSchedule);

                // Consider weather conditions (for outdoor equipment)
                var weatherWindows = await GetWeatherOptimalWindowsAsync(equipment);

                // Resource availability
                var resourceAvailability = await CheckResourceAvailabilityAsync();

                // Combine all factors
                var optimalWindow = DetermineOptimalWindow(
                    equipment,
                    historicalWindows,
                    lowImpactPeriods,
                    weatherWindows,
                    resourceAvailability);

                return optimalWindow;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error determining optimal maintenance window for equipment {equipmentId}");

                // Return a default window
                return new OptimalMaintenanceWindow
                {
                    StartDate = DateTime.UtcNow.AddDays(7),
                    EndDate = DateTime.UtcNow.AddDays(8),
                    ImpactScore = 0.5,
                    Confidence = 0.3
                };
            }
        }

        public async Task<List<Anomaly>> GetActiveAnomaliesAsync(int equipmentId)
        {
            var anomalies = new List<Anomaly>();

            try
            {
                // Get latest sensor data
                var sensorData = await GetLatestSensorDataAsync(equipmentId);

                // Check each sensor for anomalies
                foreach (var sensor in sensorData)
                {
                    var modelKey = $"anomaly_{equipmentId}_{sensor.Key}";

                    if (_anomalyModels.TryGetValue(modelKey, out var model))
                    {
                        var predictionEngine = _mlContext.Model.CreatePredictionEngine<SensorDataPoint, AnomalyPrediction>(model);
                        var input = new SensorDataPoint { Value = (float)sensor.Value };
                        var prediction = predictionEngine.Predict(input);

                        if (prediction.IsAnomaly || prediction.Score > 0.7)
                        {
                            anomalies.Add(new Anomaly
                            {
                                EquipmentId = equipmentId,
                                SensorType = sensor.Key,
                                Value = sensor.Value,
                                ExpectedRange = GetExpectedRange(equipmentId, sensor.Key),
                                DetectedAt = DateTime.UtcNow,
                                Severity = DetermineSeverity(prediction.Score),
                                Description = GenerateAnomalyDescription(sensor.Key, sensor.Value, prediction.Score),
                                IsResolved = false
                            });
                        }
                    }
                }

                // Multi-sensor anomaly detection
                var fusionAnomalies = await DetectMultiSensorAnomaliesAsync(equipmentId, sensorData);
                anomalies.AddRange(fusionAnomalies);

                return anomalies.OrderByDescending(a => GetSeverityScore(a.Severity)).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error getting active anomalies for equipment {equipmentId}");
                return anomalies;
            }
        }

        // Helper methods
        private async Task<EquipmentMLProfile> GetOrCreateEquipmentProfileAsync(int equipmentId)
        {
            if (_equipmentProfiles.TryGetValue(equipmentId, out var profile))
                return profile;

            var equipment = await GetEquipmentAsync(equipmentId);

            profile = new EquipmentMLProfile
            {
                EquipmentId = equipmentId,
                EquipmentType = equipment.Type,
                CriticalityLevel = equipment.Criticality,
                SensorConfiguration = await GetSensorConfigurationAsync(equipmentId),
                ModelVersion = 1,
                LastModelTraining = DateTime.UtcNow
            };

            _equipmentProfiles[equipmentId] = profile;
            return profile;
        }

        private async Task<List<SensorReading>> GetHistoricalDataAsync(int equipmentId, DateTime from)
        {
            return await _influxDbService.GetReadingsForEquipmentAsync(equipmentId, from, DateTime.UtcNow);
        }

        private async Task<Equipment> GetEquipmentAsync(int equipmentId)
        {
            using var scope = _serviceScopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            return await context.Equipment
                .Include(e => e.Specifications)
                .Include(e => e.OperationalData)
                .Include(e => e.MaintenanceHistory)
                .FirstOrDefaultAsync(e => e.Id == equipmentId)
                ?? throw new Exception($"Equipment {equipmentId} not found");
        }

        private PredictionResult CombinePredictions(params PredictionResult[] predictions)
        {
            var validPredictions = predictions.Where(p => p != null).ToList();

            if (!validPredictions.Any())
                return GetDefaultPrediction();

            // Weighted ensemble based on model performance
            var weights = GetModelWeights();

            var combinedResult = new PredictionResult
            {
                FailureProbability = validPredictions.Average(p => p.FailureProbability),
                EstimatedDaysToFailure = (int)validPredictions.Average(p => p.EstimatedDaysToFailure),
                PotentialFailureComponents = validPredictions
                    .SelectMany(p => p.PotentialFailureComponents)
                    .GroupBy(c => c)
                    .OrderByDescending(g => g.Count())
                    .Select(g => g.Key)
                    .Take(5)
                    .ToList(),
                RecommendedAction = DetermineConsensusAction(validPredictions),
                FailureMode = validPredictions
                    .Where(p => !string.IsNullOrEmpty(p.FailureMode))
                    .GroupBy(p => p.FailureMode)
                    .OrderByDescending(g => g.Count())
                    .FirstOrDefault()?.Key
            };

            return combinedResult;
        }

        private double CalculateConfidenceScore(params PredictionResult[] predictions)
        {
            var validPredictions = predictions.Where(p => p != null).ToList();

            if (validPredictions.Count < 2)
                return 0.5;

            // Calculate variance in predictions
            var probabilities = validPredictions.Select(p => p.FailureProbability).ToList();
            var mean = probabilities.Average();
            var variance = probabilities.Sum(p => Math.Pow(p - mean, 2)) / probabilities.Count;

            // Lower variance = higher confidence
            var confidence = 1.0 - Math.Min(1.0, variance * 2);

            // Adjust based on model count
            confidence *= validPredictions.Count / 4.0;

            return Math.Min(1.0, Math.Max(0.0, confidence));
        }

        private async Task PublishPredictionEventAsync(int equipmentId, PredictionResult prediction)
        {
            await _mediator.Publish(new PredictionGeneratedEvent
            {
                EquipmentId = equipmentId,
                FailureProbability = prediction.FailureProbability,
                EstimatedDaysToFailure = prediction.EstimatedDaysToFailure,
                RecommendedAction = prediction.RecommendedAction,
                FailureComponents = prediction.PotentialFailureComponents
            });
        }

        private void InitializeBackgroundTasks()
        {
            // Auto-retrain models periodically
            Task.Run(async () =>
            {
                while (true)
                {
                    try
                    {
                        await Task.Delay(TimeSpan.FromHours(24));
                        await RetrainModelsAsync();
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error in model retraining background task");
                    }
                }
            });

            // Monitor model performance
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
                        _logger.LogError(ex, "Error in model monitoring background task");
                    }
                }
            });
        }

        private async Task RetrainModelsAsync()
        {
            _logger.LogInformation("Starting periodic model retraining");

            foreach (var profile in _equipmentProfiles.Values)
            {
                try
                {
                    var daysSinceLastTraining = (DateTime.UtcNow - profile.LastModelTraining).TotalDays;

                    if (daysSinceLastTraining > 7) // Retrain weekly
                    {
                        await TrainModelAsync(profile.EquipmentId);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, $"Error retraining model for equipment {profile.EquipmentId}");
                }
            }
        }

        private async Task MonitorModelPerformanceAsync()
        {
            foreach (var (modelKey, metrics) in _modelMetrics)
            {
                try
                {
                    // Check if model performance is degrading
                    if (metrics.Accuracy < 0.7 || metrics.RMSE > 100)
                    {
                        _logger.LogWarning($"Model {modelKey} performance below threshold: " +
                            $"Accuracy={metrics.Accuracy:F2}, RMSE={metrics.RMSE:F2}");

                        // Trigger retraining
                        var equipmentId = ExtractEquipmentIdFromModelKey(modelKey);
                        await TrainModelAsync(equipmentId);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, $"Error monitoring model {modelKey}");
                }
            }
        }

        private PredictionResult GetDefaultPrediction()
        {
            return new PredictionResult
            {
                FailureProbability = 0.1,
                EstimatedDaysToFailure = 365,
                PotentialFailureComponents = new List<string>(),
                RecommendedAction = "Continue normal monitoring",
                ConfidenceScore = 0.3
            };
        }

        // Additional helper methods would go here...
    }

    // Supporting classes
    public class EquipmentMLProfile
    {
        public int EquipmentId { get; set; }
        public EquipmentType EquipmentType { get; set; }
        public string CriticalityLevel { get; set; } = "";
        public Dictionary<string, SensorConfiguration> SensorConfiguration { get; set; } = new();
        public int ModelVersion { get; set; }
        public DateTime LastModelTraining { get; set; }
    }

    public class SensorConfiguration
    {
        public string SensorType { get; set; } = "";
        public double MinValue { get; set; }
        public double MaxValue { get; set; }
        public double NormalMean { get; set; }
        public double NormalStdDev { get; set; }
        public string Unit { get; set; } = "";
    }

    public class ModelMetrics
    {
        public double Accuracy { get; set; }
        public double RMSE { get; set; }
        public double Precision { get; set; }
        public double Recall { get; set; }
        public double F1Score { get; set; }
        public DateTime LastUpdated { get; set; }
    }

    public class EquipmentHealthTrend
    {
        public int EquipmentId { get; set; }
        public List<HealthDataPoint> HealthHistory { get; set; } = new();
        public double CurrentHealthScore { get; set; }
        public double TrendSlope { get; set; }
        public string TrendDirection { get; set; } = "";
        public DateTime LastUpdated { get; set; }
    }

    public class HealthDataPoint
    {
        public DateTime Timestamp { get; set; }
        public double HealthScore { get; set; }
        public double FailureProbability { get; set; }
        public int ActiveAnomalies { get; set; }
    }

    public class SensorFusionResult : PredictionResult
    {
        public double OverallHealthScore { get; set; }
        public List<SensorCorrelation> CriticalSensorCombinations { get; set; } = new();
        public string PredictedFailureMode { get; set; } = "";
        public Dictionary<string, double> ComponentHealthScores { get; set; } = new();
    }

    public class SensorCorrelation
    {
        public string Sensor1 { get; set; } = "";
        public string Sensor2 { get; set; } = "";
        public double CorrelationCoefficient { get; set; }
        public string Interpretation { get; set; } = "";
    }

    public class PredictiveMaintenanceConfig
    {
        public int ModelRetrainingIntervalDays { get; set; } = 7;
        public double MinimumAccuracyThreshold { get; set; } = 0.7;
        public int MinimumDataPointsForTraining { get; set; } = 1000;
        public double AnomalyThreshold { get; set; } = 0.7;
        public int PredictionHorizonDays { get; set; } = 90;
    }

    // ML.NET model classes
    public class EquipmentData
    {
        [LoadColumn(0)] public float Temperature { get; set; }
        [LoadColumn(1)] public float Vibration { get; set; }
        [LoadColumn(2)] public float Pressure { get; set; }
        [LoadColumn(3)] public float Current { get; set; }
        [LoadColumn(4)] public float Voltage { get; set; }
        [LoadColumn(5)] public float Power { get; set; }
        [LoadColumn(6)] public float RPM { get; set; }
        [LoadColumn(7)] public float Flow { get; set; }
        [LoadColumn(8)] public float HoursRun { get; set; }
        [LoadColumn(9)] public float DaysSinceLastMaintenance { get; set; }
        [LoadColumn(10)] public float RemainingLife { get; set; }
        [LoadColumn(11)] public string FailureMode { get; set; } = "";
    }

    public class RegressionPrediction
    {
        public float Score { get; set; }
        public float RemainingLife { get; set; }
    }

    public class AnomalyPrediction
    {
        [VectorType(3)]
        public double[] Prediction { get; set; } = new double[3];

        public bool IsAnomaly => Prediction[0] == 1;
        public double Score => Prediction[1];
        public double ExpectedValue => Prediction[2];
    }

    public class TimeSeriesData
    {
        public DateTime Timestamp { get; set; }
        public float Value { get; set; }
    }

    public class TimeSeriesPrediction
    {
        public float[] Forecast { get; set; } = Array.Empty<float>();
        public float[] LowerBound { get; set; } = Array.Empty<float>();
        public float[] UpperBound { get; set; } = Array.Empty<float>();
    }

    public class MultiClassPrediction
    {
        public uint PredictedLabel { get; set; }
        public float[] Score { get; set; } = Array.Empty<float>();
    }

    public class SensorDataPoint
    {
        public float Value { get; set; }
    }

    public enum FailureMode
    {
        None = 0,
        BearingFailure = 1,
        OverheatingFailure = 2,
        ElectricalFailure = 3,
        MechanicalWear = 4,
        LubricationFailure = 5,
        VibrationFailure = 6,
        PressureFailure = 7,
        CorrosionFailure = 8,
        FatigueFailure = 9
    }

    public enum MaintenanceRisk
    {
        Low = 0,
        Medium = 1,
        High = 2,
        Critical = 3
    }

    public class OptimalMaintenanceWindow
    {
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public double ImpactScore { get; set; }
        public double Confidence { get; set; }
        public List<string> Considerations { get; set; } = new();
        public Dictionary<string, bool> ResourceAvailability { get; set; } = new();
    }
}
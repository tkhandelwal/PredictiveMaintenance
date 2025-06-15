using MediatR;
using Microsoft.EntityFrameworkCore;
using PredictiveMaintenance.API.Data;
using PredictiveMaintenance.API.Events;
using PredictiveMaintenance.API.Models;
using PredictiveMaintenance.API.Services.DigitalTwin;
using PredictiveMaintenance.API.Services.EventProcessing;
using PredictiveMaintenance.API.Services.MachineLearning;
using System.Collections.Concurrent;

namespace PredictiveMaintenance.API.Services.Monitoring
{
    public interface IEquipmentMonitoringService
    {
        Task StartMonitoringAsync(int equipmentId);
        Task StopMonitoringAsync(int equipmentId);
        Task<bool> IsMonitoringAsync(int equipmentId);
        Task ProcessSensorDataAsync(int equipmentId, Dictionary<string, double> sensorData);
        Task<Equipment> GetEquipmentByIdAsync(int equipmentId);
        Task<List<Equipment>> GetAllEquipmentAsync();
        Task<EquipmentStatus> GetEquipmentStatusAsync(int equipmentId);
        Task<List<SensorReading>> GetLatestReadingsForEquipmentAsync(int equipmentId, int limit);
        Task<MonitoringDashboard> GetMonitoringDashboardAsync();
        Task<EquipmentHealth> GetEquipmentHealthAsync(int equipmentId);
        Task<List<MonitoringAlert>> GetActiveAlertsAsync(int? equipmentId = null);
        Task AcknowledgeAlertAsync(int alertId, string acknowledgedBy);
    }

    public class EnhancedEquipmentMonitoringService : IEquipmentMonitoringService
    {
        private readonly IMediator _mediator;
        private readonly ILogger<EnhancedEquipmentMonitoringService> _logger;
        private readonly IServiceScopeFactory _serviceScopeFactory;
        private readonly IInfluxDbService _influxDbService;
        private readonly IAdvancedAnomalyDetectionService _anomalyService;
        private readonly IPredictiveMaintenanceService _predictiveService;
        private readonly IDigitalTwinService _digitalTwinService;
        private readonly IRealTimeEventProcessingService _eventService;

        // Monitoring state
        private readonly ConcurrentDictionary<int, MonitoringState> _monitoringStates;
        private readonly ConcurrentDictionary<int, EquipmentHealthProfile> _healthProfiles;
        private readonly ConcurrentDictionary<int, List<MonitoringAlert>> _activeAlerts;
        private readonly ConcurrentDictionary<int, EquipmentPerformanceMetrics> _performanceMetrics;

        // Threshold configurations
        private readonly ConcurrentDictionary<string, ThresholdConfiguration> _thresholdConfigs;
        private readonly ConcurrentDictionary<int, CustomMonitoringRules> _customRules;

        // Real-time tracking
        private readonly ConcurrentDictionary<int, RealTimeMetrics> _realTimeMetrics;
        private readonly ConcurrentDictionary<int, TrendAnalysis> _trendAnalyses;

        public EnhancedEquipmentMonitoringService(
            IMediator mediator,
            ILogger<EnhancedEquipmentMonitoringService> logger,
            IServiceScopeFactory serviceScopeFactory,
            IInfluxDbService influxDbService,
            IAdvancedAnomalyDetectionService anomalyService,
            IPredictiveMaintenanceService predictiveService,
            IDigitalTwinService digitalTwinService,
            IRealTimeEventProcessingService eventService)
        {
            _mediator = mediator;
            _logger = logger;
            _serviceScopeFactory = serviceScopeFactory;
            _influxDbService = influxDbService;
            _anomalyService = anomalyService;
            _predictiveService = predictiveService;
            _digitalTwinService = digitalTwinService;
            _eventService = eventService;

            _monitoringStates = new ConcurrentDictionary<int, MonitoringState>();
            _healthProfiles = new ConcurrentDictionary<int, EquipmentHealthProfile>();
            _activeAlerts = new ConcurrentDictionary<int, List<MonitoringAlert>>();
            _performanceMetrics = new ConcurrentDictionary<int, EquipmentPerformanceMetrics>();
            _thresholdConfigs = new ConcurrentDictionary<string, ThresholdConfiguration>();
            _customRules = new ConcurrentDictionary<int, CustomMonitoringRules>();
            _realTimeMetrics = new ConcurrentDictionary<int, RealTimeMetrics>();
            _trendAnalyses = new ConcurrentDictionary<int, TrendAnalysis>();

            InitializeMonitoring();
        }

        public async Task StartMonitoringAsync(int equipmentId)
        {
            try
            {
                var equipment = await GetEquipmentByIdAsync(equipmentId);
                if (equipment == null)
                {
                    throw new Exception($"Equipment {equipmentId} not found");
                }

                var state = new MonitoringState
                {
                    EquipmentId = equipmentId,
                    IsActive = true,
                    StartedAt = DateTime.UtcNow,
                    MonitoringMode = DetermineMonitoringMode(equipment),
                    SamplingInterval = DetermineSamplingInterval(equipment)
                };

                _monitoringStates[equipmentId] = state;

                // Initialize health profile
                await InitializeHealthProfileAsync(equipment);

                // Load custom monitoring rules
                await LoadCustomMonitoringRulesAsync(equipment);

                // Start real-time tracking
                await StartRealTimeTrackingAsync(equipment);

                // Initialize digital twin sync
                await _digitalTwinService.SyncWithPhysicalAssetAsync(equipmentId);

                _logger.LogInformation($"Started monitoring for equipment {equipmentId} ({equipment.Name}) in {state.MonitoringMode} mode");

                // Publish event
                await _mediator.Publish(new MonitoringStartedEvent
                {
                    EquipmentId = equipmentId,
                    EquipmentName = equipment.Name,
                    MonitoringMode = state.MonitoringMode.ToString()
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error starting monitoring for equipment {equipmentId}");
                throw;
            }
        }

        public Task StopMonitoringAsync(int equipmentId)
        {
            if (_monitoringStates.TryGetValue(equipmentId, out var state))
            {
                state.IsActive = false;
                state.StoppedAt = DateTime.UtcNow;

                _logger.LogInformation($"Stopped monitoring for equipment {equipmentId}");

                // Clean up real-time tracking
                _realTimeMetrics.TryRemove(equipmentId, out _);
            }

            return Task.CompletedTask;
        }

        public Task<bool> IsMonitoringAsync(int equipmentId)
        {
            return Task.FromResult(
                _monitoringStates.TryGetValue(equipmentId, out var state) && state.IsActive
            );
        }

        public async Task ProcessSensorDataAsync(int equipmentId, Dictionary<string, double> sensorData)
        {
            if (!await IsMonitoringAsync(equipmentId))
            {
                _logger.LogWarning($"Equipment {equipmentId} is not being monitored");
                return;
            }

            try
            {
                var processingTasks = new List<Task>();

                // Update real-time metrics
                UpdateRealTimeMetrics(equipmentId, sensorData);

                // Check thresholds
                processingTasks.Add(CheckThresholdsAsync(equipmentId, sensorData));

                // Detect anomalies
                processingTasks.Add(DetectAnomaliesAsync(equipmentId, sensorData));

                // Update digital twin
                processingTasks.Add(_digitalTwinService.UpdateTwinStateAsync(equipmentId, sensorData));

                // Apply custom rules
                processingTasks.Add(ApplyCustomRulesAsync(equipmentId, sensorData));

                // Update trend analysis
                processingTasks.Add(UpdateTrendAnalysisAsync(equipmentId, sensorData));

                // Process through event system
                foreach (var sensor in sensorData)
                {
                    var reading = new SensorReading
                    {
                        EquipmentId = equipmentId,
                        SensorType = sensor.Key,
                        Value = sensor.Value,
                        Timestamp = DateTime.UtcNow
                    };

                    processingTasks.Add(_eventService.ProcessSensorDataAsync(reading));
                }

                await Task.WhenAll(processingTasks);

                // Update health score
                await UpdateHealthScoreAsync(equipmentId, sensorData);

                // Check for maintenance needs
                await CheckMaintenanceNeedsAsync(equipmentId);

            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error processing sensor data for equipment {equipmentId}");

                // Don't throw - log and continue monitoring
                await CreateSystemAlertAsync(equipmentId, "ProcessingError",
                    $"Error processing sensor data: {ex.Message}");
            }
        }

        public async Task<Equipment> GetEquipmentByIdAsync(int equipmentId)
        {
            using var scope = _serviceScopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            return await context.Equipment
                .Include(e => e.Specifications)
                .Include(e => e.OperationalData)
                .Include(e => e.MaintenanceHistory)
                .Include(e => e.SensorData)
                .FirstOrDefaultAsync(e => e.Id == equipmentId);
        }

        public async Task<List<Equipment>> GetAllEquipmentAsync()
        {
            using var scope = _serviceScopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            return await context.Equipment
                .Include(e => e.OperationalData)
                .Where(e => e.IsActive)
                .ToListAsync();
        }

        public async Task<EquipmentStatus> GetEquipmentStatusAsync(int equipmentId)
        {
            var equipment = await GetEquipmentByIdAsync(equipmentId);
            if (equipment == null) return EquipmentStatus.Unknown;

            // Check for active critical alerts
            if (_activeAlerts.TryGetValue(equipmentId, out var alerts))
            {
                if (alerts.Any(a => a.Severity == AlertSeverity.Critical && !a.IsAcknowledged))
                {
                    return EquipmentStatus.Critical;
                }
                if (alerts.Any(a => a.Severity == AlertSeverity.High && !a.IsAcknowledged))
                {
                    return EquipmentStatus.Warning;
                }
            }

            // Check health score
            if (_healthProfiles.TryGetValue(equipmentId, out var health))
            {
                if (health.CurrentHealthScore < 30)
                    return EquipmentStatus.Critical;
                if (health.CurrentHealthScore < 60)
                    return EquipmentStatus.Warning;
            }

            // Check operational state
            if (!await IsMonitoringAsync(equipmentId))
                return EquipmentStatus.Offline;

            return EquipmentStatus.Operational;
        }

        public async Task<List<SensorReading>> GetLatestReadingsForEquipmentAsync(int equipmentId, int limit)
        {
            var to = DateTime.UtcNow;
            var from = to.AddHours(-1);

            var readings = await _influxDbService.GetReadingsForEquipmentAsync(equipmentId, from, to);

            return readings
                .OrderByDescending(r => r.Timestamp)
                .Take(limit)
                .ToList();
        }

        public async Task<MonitoringDashboard> GetMonitoringDashboardAsync()
        {
            var dashboard = new MonitoringDashboard
            {
                GeneratedAt = DateTime.UtcNow
            };

            var allEquipment = await GetAllEquipmentAsync();

            // Equipment summary
            dashboard.TotalEquipment = allEquipment.Count;
            dashboard.MonitoredEquipment = _monitoringStates.Count(s => s.Value.IsActive);
            dashboard.CriticalEquipment = 0;
            dashboard.WarningEquipment = 0;
            dashboard.HealthyEquipment = 0;

            foreach (var equipment in allEquipment)
            {
                var status = await GetEquipmentStatusAsync(equipment.Id);
                switch (status)
                {
                    case EquipmentStatus.Critical:
                        dashboard.CriticalEquipment++;
                        break;
                    case EquipmentStatus.Warning:
                        dashboard.WarningEquipment++;
                        break;
                    case EquipmentStatus.Operational:
                        dashboard.HealthyEquipment++;
                        break;
                }
            }

            // Active alerts
            dashboard.ActiveAlerts = _activeAlerts
                .SelectMany(a => a.Value)
                .Where(a => !a.IsAcknowledged)
                .OrderByDescending(a => a.CreatedAt)
                .ToList();

            // Performance metrics
            dashboard.OverallEfficiency = CalculateOverallEfficiency(allEquipment);
            dashboard.AverageHealthScore = CalculateAverageHealthScore();

            // Equipment by type
            dashboard.EquipmentByType = allEquipment
                .GroupBy(e => e.Type)
                .ToDictionary(g => g.Key.ToString(), g => g.Count());

            // Recent events
            dashboard.RecentEvents = await GetRecentEventsAsync(limit: 20);

            // Predictions
            dashboard.UpcomingMaintenance = await GetUpcomingMaintenanceAsync();
            dashboard.PredictedFailures = await GetPredictedFailuresAsync();

            return dashboard;
        }

        public async Task<EquipmentHealth> GetEquipmentHealthAsync(int equipmentId)
        {
            var health = new EquipmentHealth
            {
                EquipmentId = equipmentId,
                AssessmentTime = DateTime.UtcNow
            };

            // Get current health profile
            if (_healthProfiles.TryGetValue(equipmentId, out var profile))
            {
                health.HealthScore = profile.CurrentHealthScore;
                health.HealthTrend = profile.HealthTrend;
                health.ComponentHealth = profile.ComponentHealthScores;
            }

            // Get equipment details
            var equipment = await GetEquipmentByIdAsync(equipmentId);
            if (equipment == null) return health;

            // Performance metrics
            if (_performanceMetrics.TryGetValue(equipmentId, out var metrics))
            {
                health.Availability = metrics.Availability;
                health.Performance = metrics.Performance;
                health.Quality = metrics.Quality;
                health.OEE = metrics.OEE;
            }

            // Recent issues
            health.RecentIssues = await GetRecentIssuesAsync(equipmentId);

            // Sensor health
            health.SensorHealth = await AssessSensorHealthAsync(equipmentId);

            // Maintenance history impact
            health.MaintenanceImpact = await CalculateMaintenanceImpactAsync(equipment);

            // Remaining useful life
            health.RemainingUsefulLife = await _predictiveService.PredictRemainingUsefulLifeAsync(equipmentId);

            // Risk factors
            health.RiskFactors = await IdentifyRiskFactorsAsync(equipment);

            // Recommendations
            health.Recommendations = await GenerateHealthRecommendationsAsync(health, equipment);

            return health;
        }

        public async Task<List<MonitoringAlert>> GetActiveAlertsAsync(int? equipmentId = null)
        {
            if (equipmentId.HasValue)
            {
                return _activeAlerts.GetValueOrDefault(equipmentId.Value, new List<MonitoringAlert>())
                    .Where(a => !a.IsResolved)
                    .OrderByDescending(a => a.CreatedAt)
                    .ToList();
            }

            return _activeAlerts
                .SelectMany(kvp => kvp.Value)
                .Where(a => !a.IsResolved)
                .OrderByDescending(a => a.CreatedAt)
                .ToList();
        }

        public async Task AcknowledgeAlertAsync(int alertId, string acknowledgedBy)
        {
            foreach (var alertList in _activeAlerts.Values)
            {
                var alert = alertList.FirstOrDefault(a => a.AlertId == alertId);
                if (alert != null)
                {
                    alert.IsAcknowledged = true;
                    alert.AcknowledgedBy = acknowledgedBy;
                    alert.AcknowledgedAt = DateTime.UtcNow;

                    _logger.LogInformation($"Alert {alertId} acknowledged by {acknowledgedBy}");

                    // Publish event
                    await _mediator.Publish(new AlertAcknowledgedEvent
                    {
                        AlertId = alertId,
                        EquipmentId = alert.EquipmentId,
                        AcknowledgedBy = acknowledgedBy
                    });

                    break;
                }
            }
        }

        // Private methods

        private void InitializeMonitoring()
        {
            LoadThresholdConfigurations();
            StartBackgroundTasks();
        }

        private void LoadThresholdConfigurations()
        {
            // Temperature thresholds
            _thresholdConfigs["temperature"] = new ThresholdConfiguration
            {
                SensorType = "temperature",
                WarningThreshold = 80,
                CriticalThreshold = 90,
                Unit = "°C"
            };

            // Vibration thresholds
            _thresholdConfigs["vibration"] = new ThresholdConfiguration
            {
                SensorType = "vibration",
                WarningThreshold = 7,
                CriticalThreshold = 10,
                Unit = "mm/s"
            };

            // Pressure thresholds
            _thresholdConfigs["pressure"] = new ThresholdConfiguration
            {
                SensorType = "pressure",
                WarningThreshold = 8,
                CriticalThreshold = 10,
                Unit = "bar"
            };

            // Current thresholds
            _thresholdConfigs["current"] = new ThresholdConfiguration
            {
                SensorType = "current",
                WarningThreshold = 1.1, // 110% of rated
                CriticalThreshold = 1.25, // 125% of rated
                Unit = "xIn",
                IsRelative = true
            };
        }

        private void StartBackgroundTasks()
        {
            // Health score update task
            Task.Run(async () =>
            {
                while (true)
                {
                    try
                    {
                        await Task.Delay(TimeSpan.FromMinutes(5));
                        await UpdateAllHealthScoresAsync();
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error in health score update task");
                    }
                }
            });

            // Alert cleanup task
            Task.Run(async () =>
            {
                while (true)
                {
                    try
                    {
                        await Task.Delay(TimeSpan.FromHours(1));
                        await CleanupResolvedAlertsAsync();
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error in alert cleanup task");
                    }
                }
            });

            // Performance metrics calculation
            Task.Run(async () =>
            {
                while (true)
                {
                    try
                    {
                        await Task.Delay(TimeSpan.FromMinutes(15));
                        await CalculatePerformanceMetricsAsync();
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error in performance metrics calculation");
                    }
                }
            });
        }

        private MonitoringMode DetermineMonitoringMode(Equipment equipment)
        {
            // Critical equipment gets continuous monitoring
            if (equipment.Criticality == "critical")
                return MonitoringMode.Continuous;

            // Equipment with recent issues gets intensive monitoring
            if (equipment.HealthScore < 70)
                return MonitoringMode.Intensive;

            // Normal monitoring for others
            return MonitoringMode.Normal;
        }

        private TimeSpan DetermineSamplingInterval(Equipment equipment)
        {
            return equipment.Criticality switch
            {
                "critical" => TimeSpan.FromSeconds(5),
                "high" => TimeSpan.FromSeconds(15),
                "medium" => TimeSpan.FromSeconds(30),
                _ => TimeSpan.FromMinutes(1)
            };
        }

        private async Task InitializeHealthProfileAsync(Equipment equipment)
        {
            var profile = new EquipmentHealthProfile
            {
                EquipmentId = equipment.Id,
                CurrentHealthScore = equipment.HealthScore,
                BaselineHealthScore = equipment.HealthScore,
                LastUpdated = DateTime.UtcNow
            };

            // Initialize component health scores
            profile.ComponentHealthScores = await InitializeComponentHealthAsync(equipment);

            // Set health trend
            profile.HealthTrend = HealthTrend.Stable;

            _healthProfiles[equipment.Id] = profile;
        }

        private async Task LoadCustomMonitoringRulesAsync(Equipment equipment)
        {
            var rules = new CustomMonitoringRules
            {
                EquipmentId = equipment.Id,
                Rules = new List<MonitoringRule>()
            };

            // Load equipment-specific rules based on type
            switch (equipment.Type)
            {
                case EquipmentType.Motor:
                    rules.Rules.AddRange(GetMotorMonitoringRules());
                    break;

                case EquipmentType.Transformer:
                    rules.Rules.AddRange(GetTransformerMonitoringRules());
                    break;

                case EquipmentType.CircuitBreaker:
                    rules.Rules.AddRange(GetCircuitBreakerMonitoringRules());
                    break;

                case EquipmentType.BatteryStorage:
                    rules.Rules.AddRange(GetBatteryMonitoringRules());
                    break;
            }

            _customRules[equipment.Id] = rules;
        }

        private async Task StartRealTimeTrackingAsync(Equipment equipment)
        {
            var realTimeMetrics = new RealTimeMetrics
            {
                EquipmentId = equipment.Id,
                StartTime = DateTime.UtcNow,
                SensorValues = new ConcurrentDictionary<string, double>(),
                TrendIndicators = new ConcurrentDictionary<string, TrendIndicator>()
            };

            _realTimeMetrics[equipment.Id] = realTimeMetrics;
        }

        private void UpdateRealTimeMetrics(int equipmentId, Dictionary<string, double> sensorData)
        {
            if (_realTimeMetrics.TryGetValue(equipmentId, out var metrics))
            {
                foreach (var sensor in sensorData)
                {
                    // Update current value
                    metrics.SensorValues[sensor.Key] = sensor.Value;

                    // Update trend
                    UpdateTrendIndicator(metrics, sensor.Key, sensor.Value);
                }

                metrics.LastUpdate = DateTime.UtcNow;
            }
        }

        private void UpdateTrendIndicator(RealTimeMetrics metrics, string sensorType, double value)
        {
            var indicator = metrics.TrendIndicators.GetOrAdd(sensorType,
                key => new TrendIndicator { SensorType = key });

            indicator.AddValue(value);
        }

        private async Task CheckThresholdsAsync(int equipmentId, Dictionary<string, double> sensorData)
        {
            var equipment = await GetEquipmentByIdAsync(equipmentId);
            if (equipment == null) return;

            foreach (var sensor in sensorData)
            {
                if (_thresholdConfigs.TryGetValue(sensor.Key.ToLower(), out var config))
                {
                    var value = sensor.Value;

                    // Apply relative threshold if needed
                    if (config.IsRelative && equipment.Specifications != null)
                    {
                        value = GetRelativeValue(value, sensor.Key, equipment.Specifications);
                    }

                    // Check thresholds
                    if (value >= config.CriticalThreshold)
                    {
                        await CreateAlertAsync(equipmentId, sensor.Key, value,
                            AlertSeverity.Critical, config);
                    }
                    else if (value >= config.WarningThreshold)
                    {
                        await CreateAlertAsync(equipmentId, sensor.Key, value,
                            AlertSeverity.High, config);
                    }
                }
            }
        }

        private async Task DetectAnomaliesAsync(int equipmentId, Dictionary<string, double> sensorData)
        {
            foreach (var sensor in sensorData)
            {
                var reading = new SensorReading
                {
                    EquipmentId = equipmentId,
                    SensorType = sensor.Key,
                    Value = sensor.Value,
                    Timestamp = DateTime.UtcNow
                };

                var historicalData = await _influxDbService.GetReadingsForEquipmentAsync(
                    equipmentId,
                    DateTime.UtcNow.AddHours(-24),
                    DateTime.UtcNow);

                var sensorHistory = historicalData
                    .Where(r => r.SensorType == sensor.Key)
                    .ToList();

                if (await _anomalyService.DetectAnomalyAsync(reading, sensorHistory))
                {
                    reading.IsAnomaly = true;

                    var anomalyScore = await _anomalyService.CalculateAnomalyScoreAsync(reading, sensorHistory);

                    await CreateAnomalyAlertAsync(equipmentId, sensor.Key, sensor.Value, anomalyScore);

                    // Publish anomaly event
                    await _mediator.Publish(new EquipmentAnomalyDetectedEvent
                    {
                        EquipmentId = equipmentId,
                        EquipmentName = (await GetEquipmentByIdAsync(equipmentId))?.Name ?? "",
                        AnomalyScore = anomalyScore,
                        SensorReadings = sensorData,
                        AnomalyType = sensor.Key
                    });
                }
            }
        }

        private async Task ApplyCustomRulesAsync(int equipmentId, Dictionary<string, double> sensorData)
        {
            if (!_customRules.TryGetValue(equipmentId, out var rules)) return;

            foreach (var rule in rules.Rules.Where(r => r.IsActive))
            {
                try
                {
                    if (await rule.EvaluateAsync(sensorData))
                    {
                        await HandleRuleViolationAsync(equipmentId, rule, sensorData);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, $"Error evaluating rule {rule.RuleId} for equipment {equipmentId}");
                }
            }
        }

        private async Task UpdateTrendAnalysisAsync(int equipmentId, Dictionary<string, double> sensorData)
        {
            var analysis = _trendAnalyses.GetOrAdd(equipmentId,
                id => new TrendAnalysis { EquipmentId = id });

            foreach (var sensor in sensorData)
            {
                analysis.UpdateTrend(sensor.Key, sensor.Value);
            }

            // Check for concerning trends
            var concerningTrends = analysis.GetConcerningTrends();
            foreach (var trend in concerningTrends)
            {
                await CreateTrendAlertAsync(equipmentId, trend);
            }
        }

        private async Task UpdateHealthScoreAsync(int equipmentId, Dictionary<string, double> sensorData)
        {
            if (!_healthProfiles.TryGetValue(equipmentId, out var profile)) return;

            var equipment = await GetEquipmentByIdAsync(equipmentId);
            if (equipment == null) return;

            // Calculate component scores
            var componentScores = await CalculateComponentHealthScoresAsync(equipment, sensorData);
            profile.ComponentHealthScores = componentScores;

            // Calculate overall health score
            double healthScore = 100.0;

            // Factor in component health
            if (componentScores.Any())
            {
                healthScore *= componentScores.Values.Average() / 100.0;
            }

            // Factor in anomalies
            var recentAnomalies = await GetRecentAnomaliesAsync(equipmentId, TimeSpan.FromHours(24));
            healthScore -= recentAnomalies.Count * 2; // 2 points per anomaly

            // Factor in active alerts
            var activeAlerts = _activeAlerts.GetValueOrDefault(equipmentId, new List<MonitoringAlert>());
            foreach (var alert in activeAlerts.Where(a => !a.IsResolved))
            {
                healthScore -= alert.Severity switch
                {
                    AlertSeverity.Critical => 10,
                    AlertSeverity.High => 5,
                    AlertSeverity.Medium => 2,
                    _ => 1
                };
            }

            // Factor in performance
            if (_performanceMetrics.TryGetValue(equipmentId, out var metrics))
            {
                healthScore *= (metrics.OEE / 100.0);
            }

            // Update profile
            profile.PreviousHealthScore = profile.CurrentHealthScore;
            profile.CurrentHealthScore = Math.Max(0, Math.Min(100, healthScore));
            profile.LastUpdated = DateTime.UtcNow;

            // Determine trend
            if (profile.CurrentHealthScore < profile.PreviousHealthScore - 5)
                profile.HealthTrend = HealthTrend.Declining;
            else if (profile.CurrentHealthScore > profile.PreviousHealthScore + 5)
                profile.HealthTrend = HealthTrend.Improving;
            else
                profile.HealthTrend = HealthTrend.Stable;

            // Update equipment health score
            equipment.HealthScore = profile.CurrentHealthScore;
            await UpdateEquipmentAsync(equipment);
        }

        private async Task CheckMaintenanceNeedsAsync(int equipmentId)
        {
            if (await _predictiveService.ShouldScheduleMaintenanceAsync(equipmentId))
            {
                await CreateMaintenanceAlertAsync(equipmentId);

                // Publish maintenance required event
                await _mediator.Publish(new MaintenanceRequiredEvent
                {
                    EquipmentId = equipmentId,
                    Priority = MaintenancePriority.High,
                    MaintenanceType = "Predictive"
                });
            }
        }

        private async Task CreateAlertAsync(int equipmentId, string sensorType, double value,
            AlertSeverity severity, ThresholdConfiguration config)
        {
            var alert = new MonitoringAlert
            {
                AlertId = GenerateAlertId(),
                EquipmentId = equipmentId,
                AlertType = AlertType.ThresholdExceeded,
                Severity = severity,
                Title = $"{sensorType} {severity} Threshold Exceeded",
                Description = $"{sensorType} value ({value:F2} {config.Unit}) exceeds {severity.ToString().ToLower()} threshold ({GetThresholdValue(severity, config):F2} {config.Unit})",
                SensorType = sensorType,
                SensorValue = value,
                ThresholdValue = GetThresholdValue(severity, config),
                CreatedAt = DateTime.UtcNow,
                IsActive = true
            };

            AddAlert(equipmentId, alert);

            // Send real-time notification
            await SendAlertNotificationAsync(alert);
        }

        private void AddAlert(int equipmentId, MonitoringAlert alert)
        {
            var alerts = _activeAlerts.GetOrAdd(equipmentId, id => new List<MonitoringAlert>());

            // Check for duplicate alerts
            var existingAlert = alerts.FirstOrDefault(a =>
                a.AlertType == alert.AlertType &&
                a.SensorType == alert.SensorType &&
                a.IsActive &&
                (DateTime.UtcNow - a.CreatedAt).TotalMinutes < 5);

            if (existingAlert == null)
            {
                alerts.Add(alert);
                _logger.LogWarning($"Alert created for equipment {equipmentId}: {alert.Title}");
            }
        }

        private async Task UpdateEquipmentAsync(Equipment equipment)
        {
            using var scope = _serviceScopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            context.Equipment.Update(equipment);
            await context.SaveChangesAsync();
        }

        // Additional helper methods
        private List<MonitoringRule> GetMotorMonitoringRules()
        {
            return new List<MonitoringRule>
            {
                new MonitoringRule
                {
                    RuleId = "MOTOR_OVERLOAD",
                    Name = "Motor Overload Protection",
                    Description = "Detect motor overload conditions",
                    EvaluateAsync = async (data) =>
                    {
                        if (data.TryGetValue("current", out var current) &&
                            data.TryGetValue("temperature", out var temp))
                        {
                            return current > 1.15 && temp > 85; // 115% current and high temp
                        }
                        return false;
                    },
                    Actions = new List<string> { "ReduceLoad", "Alert", "CoolDown" }
                },
                new MonitoringRule
                {
                    RuleId = "MOTOR_BEARING_FAILURE",
                    Name = "Bearing Failure Detection",
                    Description = "Detect potential bearing failures",
                    EvaluateAsync = async (data) =>
                    {
                        if (data.TryGetValue("vibration", out var vibration))
                        {
                            return vibration > 7.1; // ISO 10816 threshold
                        }
                        return false;
                    },
                    Actions = new List<string> { "ScheduleMaintenance", "Alert" }
                }
            };
        }

        // Additional supporting classes and methods would continue...
    }

    // Supporting classes
    public class MonitoringState
    {
        public int EquipmentId { get; set; }
        public bool IsActive { get; set; }
        public DateTime StartedAt { get; set; }
        public DateTime? StoppedAt { get; set; }
        public MonitoringMode MonitoringMode { get; set; }
        public TimeSpan SamplingInterval { get; set; }
    }

    public enum MonitoringMode
    {
        Normal,
        Intensive,
        Continuous,
        Predictive
    }

    public class EquipmentHealthProfile
    {
        public int EquipmentId { get; set; }
        public double CurrentHealthScore { get; set; }
        public double PreviousHealthScore { get; set; }
        public double BaselineHealthScore { get; set; }
        public HealthTrend HealthTrend { get; set; }
        public DateTime LastUpdated { get; set; }
        public Dictionary<string, double> ComponentHealthScores { get; set; } = new();
        public List<HealthEvent> HealthHistory { get; set; } = new();
    }

    public enum HealthTrend
    {
        Improving,
        Stable,
        Declining,
        Critical
    }

    public class MonitoringAlert
    {
        public int AlertId { get; set; }
        public int EquipmentId { get; set; }
        public AlertType AlertType { get; set; }
        public AlertSeverity Severity { get; set; }
        public string Title { get; set; } = "";
        public string Description { get; set; } = "";
        public string? SensorType { get; set; }
        public double? SensorValue { get; set; }
        public double? ThresholdValue { get; set; }
        public DateTime CreatedAt { get; set; }
        public bool IsActive { get; set; }
        public bool IsAcknowledged { get; set; }
        public string? AcknowledgedBy { get; set; }
        public DateTime? AcknowledgedAt { get; set; }
        public bool IsResolved { get; set; }
        public DateTime? ResolvedAt { get; set; }
        public string? Resolution { get; set; }
    }

    public enum AlertType
    {
        ThresholdExceeded,
        AnomalyDetected,
        TrendAlert,
        MaintenanceRequired,
        SystemError,
        PerformanceDegradation,
        PredictiveAlert
    }

    public enum AlertSeverity
    {
        Low,
        Medium,
        High,
        Critical
    }

    public class EquipmentPerformanceMetrics
    {
        public int EquipmentId { get; set; }
        public double Availability { get; set; }
        public double Performance { get; set; }
        public double Quality { get; set; }
        public double OEE { get; set; }
        public DateTime CalculatedAt { get; set; }
        public Dictionary<string, double> DetailedMetrics { get; set; } = new();
    }

    public class ThresholdConfiguration
    {
        public string SensorType { get; set; } = "";
        public double WarningThreshold { get; set; }
        public double CriticalThreshold { get; set; }
        public string Unit { get; set; } = "";
        public bool IsRelative { get; set; }
        public Dictionary<string, double> TimeBasedThresholds { get; set; } = new();
    }

    public class CustomMonitoringRules
    {
        public int EquipmentId { get; set; }
        public List<MonitoringRule> Rules { get; set; } = new();
    }

    public class MonitoringRule
    {
        public string RuleId { get; set; } = "";
        public string Name { get; set; } = "";
        public string Description { get; set; } = "";
        public bool IsActive { get; set; } = true;
        public Func<Dictionary<string, double>, Task<bool>> EvaluateAsync { get; set; } = _ => Task.FromResult(false);
        public List<string> Actions { get; set; } = new();
        public Dictionary<string, object> Parameters { get; set; } = new();
    }

    public class RealTimeMetrics
    {
        public int EquipmentId { get; set; }
        public DateTime StartTime { get; set; }
        public DateTime LastUpdate { get; set; }
        public ConcurrentDictionary<string, double> SensorValues { get; set; } = new();
        public ConcurrentDictionary<string, TrendIndicator> TrendIndicators { get; set; } = new();
    }

    public class TrendIndicator
    {
        public string SensorType { get; set; } = "";
        private readonly Queue<(DateTime time, double value)> _values = new();
        private readonly object _lock = new();

        public void AddValue(double value)
        {
            lock (_lock)
            {
                _values.Enqueue((DateTime.UtcNow, value));

                // Keep last 100 values
                while (_values.Count > 100)
                {
                    _values.Dequeue();
                }
            }
        }

        public double GetTrend()
        {
            lock (_lock)
            {
                if (_values.Count < 2) return 0;

                var values = _values.ToArray();
                var n = values.Length;

                // Linear regression
                var sumX = 0.0;
                var sumY = 0.0;
                var sumXY = 0.0;
                var sumX2 = 0.0;

                for (int i = 0; i < n; i++)
                {
                    sumX += i;
                    sumY += values[i].value;
                    sumXY += i * values[i].value;
                    sumX2 += i * i;
                }

                var slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
                return slope;
            }
        }
    }

    public class TrendAnalysis
    {
        public int EquipmentId { get; set; }
        private readonly ConcurrentDictionary<string, TrendData> _trends = new();

        public void UpdateTrend(string sensorType, double value)
        {
            var trend = _trends.GetOrAdd(sensorType, key => new TrendData { SensorType = key });
            trend.AddValue(value);
        }

        public List<TrendAlert> GetConcerningTrends()
        {
            var alerts = new List<TrendAlert>();

            foreach (var (sensorType, trend) in _trends)
            {
                var analysis = trend.Analyze();
                if (analysis.IsConcerning)
                {
                    alerts.Add(new TrendAlert
                    {
                        SensorType = sensorType,
                        TrendDirection = analysis.Direction,
                        TrendStrength = analysis.Strength,
                        Message = analysis.Message
                    });
                }
            }

            return alerts;
        }
    }

    public class TrendData
    {
        public string SensorType { get; set; } = "";
        private readonly List<double> _recentValues = new();
        private readonly object _lock = new();

        public void AddValue(double value)
        {
            lock (_lock)
            {
                _recentValues.Add(value);
                if (_recentValues.Count > 50)
                {
                    _recentValues.RemoveAt(0);
                }
            }
        }

        public TrendAnalysisResult Analyze()
        {
            lock (_lock)
            {
                if (_recentValues.Count < 10)
                {
                    return new TrendAnalysisResult { IsConcerning = false };
                }

                // Calculate trend
                var trend = CalculateTrend();
                var volatility = CalculateVolatility();

                return new TrendAnalysisResult
                {
                    Direction = trend > 0 ? "Increasing" : "Decreasing",
                    Strength = Math.Abs(trend),
                    Volatility = volatility,
                    IsConcerning = Math.Abs(trend) > 0.5 || volatility > 0.3,
                    Message = GenerateTrendMessage(trend, volatility)
                };
            }
        }

        private double CalculateTrend()
        {
            // Simple linear regression
            var n = _recentValues.Count;
            var sumX = 0.0;
            var sumY = 0.0;
            var sumXY = 0.0;
            var sumX2 = 0.0;

            for (int i = 0; i < n; i++)
            {
                sumX += i;
                sumY += _recentValues[i];
                sumXY += i * _recentValues[i];
                sumX2 += i * i;
            }

            return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        }

        private double CalculateVolatility()
        {
            if (_recentValues.Count < 2) return 0;

            var mean = _recentValues.Average();
            var variance = _recentValues.Sum(v => Math.Pow(v - mean, 2)) / _recentValues.Count;
            return Math.Sqrt(variance) / mean;
        }

        private string GenerateTrendMessage(double trend, double volatility)
        {
            if (Math.Abs(trend) > 1.0)
                return $"Rapid {(trend > 0 ? "increase" : "decrease")} detected";
            if (volatility > 0.5)
                return "High volatility detected";
            if (Math.Abs(trend) > 0.5)
                return $"Steady {(trend > 0 ? "increase" : "decrease")} observed";
            return "Normal variation";
        }
    }

    public class TrendAnalysisResult
    {
        public string Direction { get; set; } = "";
        public double Strength { get; set; }
        public double Volatility { get; set; }
        public bool IsConcerning { get; set; }
        public string Message { get; set; } = "";
    }

    public class TrendAlert
    {
        public string SensorType { get; set; } = "";
        public string TrendDirection { get; set; } = "";
        public double TrendStrength { get; set; }
        public string Message { get; set; } = "";
    }

    public class MonitoringDashboard
    {
        public DateTime GeneratedAt { get; set; }
        public int TotalEquipment { get; set; }
        public int MonitoredEquipment { get; set; }
        public int CriticalEquipment { get; set; }
        public int WarningEquipment { get; set; }
        public int HealthyEquipment { get; set; }
        public List<MonitoringAlert> ActiveAlerts { get; set; } = new();
        public double OverallEfficiency { get; set; }
        public double AverageHealthScore { get; set; }
        public Dictionary<string, int> EquipmentByType { get; set; } = new();
        public List<RecentEvent> RecentEvents { get; set; } = new();
        public List<UpcomingMaintenance> UpcomingMaintenance { get; set; } = new();
        public List<PredictedFailure> PredictedFailures { get; set; } = new();
    }

    public class EquipmentHealth
    {
        public int EquipmentId { get; set; }
        public DateTime AssessmentTime { get; set; }
        public double HealthScore { get; set; }
        public HealthTrend HealthTrend { get; set; }
        public Dictionary<string, double> ComponentHealth { get; set; } = new();
        public double Availability { get; set; }
        public double Performance { get; set; }
        public double Quality { get; set; }
        public double OEE { get; set; }
        public List<HealthIssue> RecentIssues { get; set; } = new();
        public Dictionary<string, SensorHealthStatus> SensorHealth { get; set; } = new();
        public MaintenanceImpactAnalysis MaintenanceImpact { get; set; } = new();
        public double RemainingUsefulLife { get; set; }
        public List<RiskFactor> RiskFactors { get; set; } = new();
        public List<string> Recommendations { get; set; } = new();
    }

    // Events
    public class MonitoringStartedEvent : INotification
    {
        public int EquipmentId { get; set; }
        public string EquipmentName { get; set; } = "";
        public string MonitoringMode { get; set; } = "";
    }

    public class AlertAcknowledgedEvent : INotification
    {
        public int AlertId { get; set; }
        public int EquipmentId { get; set; }
        public string AcknowledgedBy { get; set; } = "";
    }

    // Additional supporting classes
    public class HealthEvent
    {
        public DateTime Timestamp { get; set; }
        public double HealthScore { get; set; }
        public string Event { get; set; } = "";
    }

    public class RecentEvent
    {
        public DateTime Timestamp { get; set; }
        public string EventType { get; set; } = "";
        public string Description { get; set; } = "";
        public int EquipmentId { get; set; }
        public string Severity { get; set; } = "";
    }

    public class UpcomingMaintenance
    {
        public int EquipmentId { get; set; }
        public string EquipmentName { get; set; } = "";
        public DateTime ScheduledDate { get; set; }
        public string MaintenanceType { get; set; } = "";
        public string Priority { get; set; } = "";
    }

    public class PredictedFailure
    {
        public int EquipmentId { get; set; }
        public string EquipmentName { get; set; } = "";
        public double FailureProbability { get; set; }
        public int EstimatedDaysToFailure { get; set; }
        public List<string> FailureComponents { get; set; } = new();
    }

    public class HealthIssue
    {
        public DateTime DetectedAt { get; set; }
        public string IssueType { get; set; } = "";
        public string Description { get; set; } = "";
        public string Severity { get; set; } = "";
        public bool IsResolved { get; set; }
    }

    public class SensorHealthStatus
    {
        public string SensorType { get; set; } = "";
        public bool IsHealthy { get; set; }
        public double DataQuality { get; set; }
        public DateTime LastReading { get; set; }
        public List<string> Issues { get; set; } = new();
    }

    public class MaintenanceImpactAnalysis
    {
        public double ImpactScore { get; set; }
        public string ImpactLevel { get; set; } = "";
        public Dictionary<string, double> ComponentImpacts { get; set; } = new();
    }

    public class RiskFactor
    {
        public string FactorName { get; set; } = "";
        public double RiskLevel { get; set; }
        public string Description { get; set; } = "";
        public string Mitigation { get; set; } = "";
    }
}
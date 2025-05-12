using Microsoft.AspNetCore.SignalR;
using PredictiveMaintenance.API.Hubs;
using PredictiveMaintenance.API.Models;

namespace PredictiveMaintenance.API.Services.DataGeneration
{
    public class SyntheticDataGenerator : ISyntheticDataGenerator
    {
        private readonly ILogger<SyntheticDataGenerator> _logger;
        private readonly IInfluxDbService _influxDbService;
        private readonly Random _random = new Random();
        private readonly IHubContext<MonitoringHub> _hubContext;

        // Add more sensor types for realistic monitoring
        private readonly Dictionary<string, SensorConfig> _sensorConfigs = new Dictionary<string, SensorConfig>
        {
            { "temperature", new SensorConfig(60, 10, 0.05, 100) },
            { "vibration", new SensorConfig(25, 8, 0.08, 40) },
            { "pressure", new SensorConfig(90, 15, 0.03, 120) },
            { "rpm", new SensorConfig(1800, 100, 0.02, 2500) },
            { "flow", new SensorConfig(45, 5, 0.04, 60) }
        };

        // Add equipment profiles with different behaviors
        private readonly Dictionary<int, EquipmentProfile> _equipmentProfiles = new Dictionary<int, EquipmentProfile>
        {
            { 1, new EquipmentProfile("Pump", new[] { "temperature", "vibration", "flow" }, false) },
            { 2, new EquipmentProfile("Motor", new[] { "temperature", "vibration", "rpm" }, false) },
            { 3, new EquipmentProfile("Compressor", new[] { "temperature", "pressure", "vibration" }, true) }, // This one is deteriorating
            { 4, new EquipmentProfile("Fan", new[] { "temperature", "vibration", "rpm" }, false) }
        };

        // Time-based factors to simulate real patterns
        private double _timeOfDayFactor = 1.0;
        private int _anomalyCounter = 0;
        private Dictionary<int, Dictionary<string, TrendData>> _equipmentTrendData = new Dictionary<int, Dictionary<string, TrendData>>();

        // Simulation state
        private Dictionary<int, SimulationState> _simulationStates = new Dictionary<int, SimulationState>();

        public SyntheticDataGenerator(ILogger<SyntheticDataGenerator> logger, IInfluxDbService influxDbService, IHubContext<MonitoringHub> hubContext)
        {
            _logger = logger;
            _influxDbService = influxDbService;
            _hubContext = hubContext;

            // Initialize trend data for each equipment
            foreach (var equipmentId in _equipmentProfiles.Keys)
            {
                _equipmentTrendData[equipmentId] = new Dictionary<string, TrendData>();
                foreach (var sensorType in _equipmentProfiles[equipmentId].SensorTypes)
                {
                    _equipmentTrendData[equipmentId][sensorType] = new TrendData();
                }

                // Initialize simulation state to normal for all equipment
                _simulationStates[equipmentId] = new SimulationState
                {
                    Mode = SimulationMode.Normal,
                    StartTime = DateTime.UtcNow
                };
            }
        }

        public async Task<SensorReading> GenerateSensorReadingAsync(int equipmentId, string? sensorType = null)
        {
            // Check if equipment profile exists
            if (!_equipmentProfiles.TryGetValue(equipmentId, out var profile))
            {
                _logger.LogWarning($"No profile found for equipment {equipmentId}");
                // Return a minimal valid reading instead of null
                return new SensorReading
                {
                    EquipmentId = equipmentId,
                    Timestamp = DateTime.UtcNow,
                    SensorType = "unknown",
                    Value = 0,
                    IsAnomaly = false
                };
            }

            // If sensorType is not specified, pick one randomly from the equipment's available sensors
            if (string.IsNullOrEmpty(sensorType))
            {
                var availableSensors = profile.SensorTypes;
                if (availableSensors != null && availableSensors.Length > 0)
                {
                    sensorType = availableSensors[_random.Next(availableSensors.Length)];
                }
                else
                {
                    // Handle case where SensorTypes array might be null or empty
                    sensorType = "default";
                }
            }
            else if (profile.SensorTypes?.Contains(sensorType) != true)
            {
                _logger.LogWarning($"Sensor type {sensorType} not available for equipment {equipmentId}");
                // Return a minimal valid reading instead of null
                return new SensorReading
                {
                    EquipmentId = equipmentId,
                    Timestamp = DateTime.UtcNow,
                    SensorType = sensorType,
                    Value = 0,
                    IsAnomaly = false
                };
            }

            // Check if sensor configuration exists
            if (!_sensorConfigs.TryGetValue(sensorType, out var sensorConfig))
            {
                _logger.LogWarning($"No configuration found for sensor type {sensorType}");
                // Return a minimal valid reading instead of null
                return new SensorReading
                {
                    EquipmentId = equipmentId,
                    Timestamp = DateTime.UtcNow,
                    SensorType = sensorType,
                    Value = 0,
                    IsAnomaly = false
                };
            }

            // Ensure trend data exists for this equipment and sensor
            if (!_equipmentTrendData.ContainsKey(equipmentId))
            {
                _equipmentTrendData[equipmentId] = new Dictionary<string, TrendData>();
            }

            if (!_equipmentTrendData[equipmentId].ContainsKey(sensorType))
            {
                _equipmentTrendData[equipmentId][sensorType] = new TrendData();
            }

            // Get trend data for this equipment and sensor
            var trendData = _equipmentTrendData[equipmentId][sensorType];

            // Calculate current value based on trends and patterns
            double value = GenerateValue(equipmentId, sensorType, sensorConfig, profile, trendData);

            // Check if it's an anomaly
            bool isAnomaly = IsAnomaly(value, sensorConfig, profile);

            var reading = new SensorReading
            {
                EquipmentId = equipmentId,
                Timestamp = DateTime.UtcNow,
                SensorType = sensorType,
                Value = value,
                IsAnomaly = isAnomaly
            };

            // Store in InfluxDB
            try
            {
                await _influxDbService.WriteSensorReadingAsync(reading);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Failed to write reading to database for equipment {equipmentId}");
                // Continue execution even if db write fails
            }

            // Update trend data
            UpdateTrendData(trendData, value, isAnomaly);

            _logger.LogInformation($"Generated {sensorType} reading for equipment {equipmentId}: {value}{(isAnomaly ? " (ANOMALY)" : "")}");

            return reading;
        }

        public async Task<List<SensorReading>> GenerateBatchReadingsAsync(int count)
        {
            var readings = new List<SensorReading>();
            UpdateTimeFactors();

            // Generate readings for each equipment and each of its sensor types
            foreach (var equipmentId in _equipmentProfiles.Keys)
            {
                foreach (var sensorType in _equipmentProfiles[equipmentId].SensorTypes)
                {
                    var reading = await GenerateSensorReadingAsync(equipmentId, sensorType);
                    if (reading != null)
                    {
                        readings.Add(reading);

                        // Send to clients through SignalR
                        try
                        {
                            await _hubContext.Clients.Group($"Equipment_{equipmentId}")
                                .SendAsync("ReceiveSensorReading", reading);

                            // Also notify about anomalies
                            if (reading.IsAnomaly)
                            {
                                await _hubContext.Clients.All.SendAsync("AnomalyDetected", reading);
                            }
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, "Error sending reading to SignalR clients");
                        }
                    }
                }
            }

            return readings;
        }

        public void SetSimulationMode(int equipmentId, SimulationMode mode, int durationSeconds = 0)
        {
            if (!_equipmentProfiles.ContainsKey(equipmentId))
            {
                _logger.LogWarning($"Cannot set simulation mode for unknown equipment ID: {equipmentId}");
                return;
            }

            var state = new SimulationState
            {
                Mode = mode,
                StartTime = DateTime.UtcNow,
                EndTime = durationSeconds > 0 ? DateTime.UtcNow.AddSeconds(durationSeconds) : null
            };

            _simulationStates[equipmentId] = state;
            _logger.LogInformation($"Set simulation mode for equipment {equipmentId} to {mode}" +
                                 (durationSeconds > 0 ? $" for {durationSeconds} seconds" : ""));
        }

        public void ResetAllSimulations()
        {
            foreach (var equipmentId in _equipmentProfiles.Keys)
            {
                _simulationStates[equipmentId] = new SimulationState
                {
                    Mode = SimulationMode.Normal,
                    StartTime = DateTime.UtcNow
                };

                // Reset trend data
                foreach (var sensorType in _equipmentProfiles[equipmentId].SensorTypes)
                {
                    _equipmentTrendData[equipmentId][sensorType] = new TrendData();
                }
            }

            _logger.LogInformation("Reset all equipment simulations to normal mode");
        }

        private double GenerateValue(int equipmentId, string sensorType, SensorConfig sensorConfig,
                                  EquipmentProfile profile, TrendData trendData)
        {
            // Get simulation state for this equipment
            var simulationState = _simulationStates.ContainsKey(equipmentId) ?
                _simulationStates[equipmentId] :
                new SimulationState { Mode = SimulationMode.Normal };

            // Check if simulation has ended
            if (simulationState.EndTime.HasValue && DateTime.UtcNow > simulationState.EndTime.Value)
            {
                // Revert to normal operation
                simulationState.Mode = SimulationMode.Normal;
                simulationState.EndTime = null;
                _simulationStates[equipmentId] = simulationState;
            }

            // Base value from sensor config
            double baseValue = sensorConfig.BaseValue;

            // Daily pattern effect (e.g., temperature is higher during the day)
            if (sensorType == "temperature")
            {
                baseValue *= _timeOfDayFactor;
            }

            // Apply seasonal variation
            double seasonalEffect = Math.Sin(DateTime.Now.DayOfYear / 365.0 * 2 * Math.PI) * 0.05 * baseValue;

            // Reduced random noise for clearer patterns
            double noise = (_random.NextDouble() * 2 - 1) * sensorConfig.Variance * 0.3;

            // Enhanced simulation effects
            double simulationEffect = 0;

            switch (simulationState.Mode)
            {
                case SimulationMode.Normal:
                    // Normal operation - minimal effect
                    break;

                case SimulationMode.Failure:
                    // Calculate dramatic failure effects
                    double secondsSinceStart = (DateTime.UtcNow - simulationState.StartTime).TotalSeconds;
                    double failureFactor = Math.Min(20, secondsSinceStart * 0.5);

                    switch (sensorType.ToLower())
                    {
                        case "temperature":
                            // Temperature skyrockets during failure
                            simulationEffect = sensorConfig.Variance * failureFactor * 3.0;
                            break;

                        case "vibration":
                            // Vibration increases dramatically 
                            simulationEffect = sensorConfig.Variance * failureFactor * 4.0;
                            break;

                        case "pressure":
                            // Pressure fluctuates wildly
                            simulationEffect = sensorConfig.Variance * failureFactor *
                                            Math.Sin(secondsSinceStart * 0.5) * 3.0;
                            break;

                        case "flow":
                            // Flow drops significantly
                            simulationEffect = -sensorConfig.Variance * failureFactor * 2.0;
                            break;

                        case "rpm":
                            // RPM becomes erratic
                            simulationEffect = sensorConfig.Variance * failureFactor *
                                            (Math.Sin(secondsSinceStart * 0.3) + 1) * 2.0;
                            break;

                        default:
                            // Generic failure pattern
                            simulationEffect = sensorConfig.Variance * failureFactor * 2.0;
                            break;
                    }
                    break;

                case SimulationMode.Deterioration:
                    // Gradual deterioration effect
                    double deteriorationTime = (DateTime.UtcNow - simulationState.StartTime).TotalSeconds;
                    double deteriorationFactor = Math.Min(15, deteriorationTime * 0.1);

                    switch (sensorType.ToLower())
                    {
                        case "temperature":
                            // Temperature gradually increases
                            simulationEffect = baseValue * 0.006 * deteriorationFactor;
                            break;

                        case "vibration":
                            // Vibration steadily worsens
                            simulationEffect = baseValue * 0.01 * deteriorationFactor;
                            break;

                        case "flow":
                            // Flow gradually decreases
                            simulationEffect = -baseValue * 0.005 * deteriorationFactor;
                            break;

                        default:
                            // Generic deterioration pattern
                            simulationEffect = baseValue * 0.004 * deteriorationFactor;
                            break;
                    }
                    break;

                case SimulationMode.Maintenance:
                    // Maintenance improvement effect
                    double maintenanceTime = (DateTime.UtcNow - simulationState.StartTime).TotalSeconds;
                    double improvementFactor = Math.Min(1.0, maintenanceTime / 20.0);

                    switch (sensorType.ToLower())
                    {
                        case "temperature":
                            // Temperature normalizes
                            simulationEffect = -sensorConfig.Variance * 3.0 * improvementFactor;
                            break;

                        case "vibration":
                            // Vibration drops significantly
                            simulationEffect = -sensorConfig.Variance * 4.0 * improvementFactor;
                            break;

                        case "flow":
                            // Flow improves 
                            simulationEffect = sensorConfig.Variance * 2.0 * improvementFactor;
                            break;

                        default:
                            // Generic improvement
                            simulationEffect = -sensorConfig.Variance * 2.0 * improvementFactor;
                            break;
                    }
                    break;
            }

            // Long-term trend for deteriorating equipment
            double trendEffect = 0;
            if (profile.IsDeteriorating)
            {
                // This makes the value gradually drift away from normal over time
                double trendFactor = trendData.TrendFactor;
                trendEffect = trendFactor * baseValue * 0.002;
            }

            // Calculate final value
            double value = baseValue + seasonalEffect + noise + simulationEffect + trendEffect;

            // Ensure value is reasonable (non-negative)
            value = Math.Max(value, 0);

            return Math.Round(value, 2);
        }

        private bool IsAnomaly(double value, SensorConfig sensorConfig, EquipmentProfile profile)
        {
            // Check if value exceeds threshold
            if (Math.Abs(value - sensorConfig.BaseValue) > sensorConfig.Variance * 2.5)
            {
                return true;
            }

            // Check against absolute threshold if configured
            if (sensorConfig.ThresholdValue > 0 && value > sensorConfig.ThresholdValue)
            {
                return true;
            }

            return false;
        }

        private double CalculateAnomalyProbability(SensorConfig sensorConfig, EquipmentProfile profile,
                                               TrendData trendData, SimulationState simulationState)
        {
            // Base probability from sensor config
            double probability = sensorConfig.AnomalyProbability;

            // Adjust based on simulation mode
            switch (simulationState.Mode)
            {
                case SimulationMode.Normal:
                    // Normal probability
                    break;

                case SimulationMode.Deterioration:
                    // Increasing probability over time
                    probability += (DateTime.UtcNow - simulationState.StartTime).TotalMinutes * 0.002;
                    break;

                case SimulationMode.Failure:
                    // High probability during failure
                    probability += 0.25;
                    break;

                case SimulationMode.Maintenance:
                    // Lower probability during maintenance
                    probability *= 0.3;
                    break;
            }

            // Deteriorating equipment has increasing anomaly probability
            if (profile.IsDeteriorating)
            {
                probability += trendData.TrendFactor * 0.0005;
            }

            // Equipment with previous recent anomalies more likely to have more
            if (trendData.RecentAnomalyCount > 0)
            {
                probability += trendData.RecentAnomalyCount * 0.01;
            }

            return Math.Min(probability, 0.35); // Cap probability
        }

        private void UpdateTrendData(TrendData trendData, double value, bool isAnomaly)
        {
            // Increment trend counter
            trendData.TrendFactor++;

            // Update recent anomaly count
            if (isAnomaly)
            {
                trendData.RecentAnomalyCount++;
            }
            else
            {
                // Decay recent anomaly count
                trendData.RecentAnomalyCount = Math.Max(0, trendData.RecentAnomalyCount - 0.1);
            }

            // Store value in history
            trendData.ValueHistory.Add(value);
            if (trendData.ValueHistory.Count > 100)
            {
                trendData.ValueHistory.RemoveAt(0);
            }
        }

        private void UpdateTimeFactors()
        {
            // Simulate time-of-day effects
            var hour = DateTime.Now.Hour;
            _timeOfDayFactor = 1.0 + Math.Sin((hour - 12) / 24.0 * Math.PI) * 0.1;
        }
    }

    public class SensorConfig
    {
        public double BaseValue { get; }
        public double Variance { get; }
        public double AnomalyProbability { get; }
        public double ThresholdValue { get; }

        public SensorConfig(double baseValue, double variance, double anomalyProbability, double thresholdValue = 0)
        {
            BaseValue = baseValue;
            Variance = variance;
            AnomalyProbability = anomalyProbability;
            ThresholdValue = thresholdValue;
        }
    }

    public class EquipmentProfile
    {
        public string Type { get; }
        public string[] SensorTypes { get; }
        public bool IsDeteriorating { get; }

        public EquipmentProfile(string type, string[] sensorTypes, bool isDeteriorating)
        {
            Type = type;
            SensorTypes = sensorTypes;
            IsDeteriorating = isDeteriorating;
        }
    }

    public class TrendData
    {
        public double TrendFactor { get; set; } = 0;
        public double RecentAnomalyCount { get; set; } = 0;
        public List<double> ValueHistory { get; set; } = new List<double>();
    }

    public class SimulationState
    {
        public SimulationMode Mode { get; set; }
        public DateTime StartTime { get; set; }
        public DateTime? EndTime { get; set; }
    }

    public enum SimulationMode
    {
        Normal,
        Deterioration,
        Failure,
        Maintenance
    }
}
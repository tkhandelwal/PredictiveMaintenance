// Services/EquipmentService.cs
using InfluxDB.Client.Core.Exceptions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using PredictiveMaintenance.API.Data;
using PredictiveMaintenance.API.Models;
using PredictiveMaintenance.API.Services.MachineLearning;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

// Use alias to avoid ambiguity
using ModelsSensorData = PredictiveMaintenance.API.Models.SensorData;
using MLSensorData = PredictiveMaintenance.API.Services.MachineLearning.SensorData;

namespace PredictiveMaintenance.API.Services
{
    public interface IEquipmentService
    {
        Task<List<Equipment>> GetAllEquipmentAsync();
        Task<Equipment> GetEquipmentByIdAsync(int id);
        Task<List<Equipment>> GetEquipmentBySiteAsync(string siteId);
        Task<Equipment> CreateEquipmentAsync(Equipment equipment);
        Task<Equipment> UpdateEquipmentAsync(int id, Equipment equipment);
        Task<bool> DeleteEquipmentAsync(int id);
        Task<List<Equipment>> GetCriticalEquipmentAsync();
        Task<Dictionary<string, object>> GetEquipmentMetricsAsync(int id);
        Task<List<MaintenanceRecommendation>> GetMaintenanceRecommendationsAsync(int id);
    }

    public class EquipmentService : IEquipmentService
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<EquipmentService> _logger;
        private readonly IPredictiveMaintenanceService _predictionService;
        private readonly ISensorDataService _sensorService;
        private readonly IEnergyOptimizationService _energyService;

        public EquipmentService(
            ApplicationDbContext context,
            ILogger<EquipmentService> logger,
            IPredictiveMaintenanceService predictionService,
            ISensorDataService sensorService,
            IEnergyOptimizationService energyService)
        {
            _context = context;
            _logger = logger;
            _predictionService = predictionService;
            _sensorService = sensorService;
            _energyService = energyService;
        }

        public async Task<List<Equipment>> GetAllEquipmentAsync()
        {
            try
            {
                var equipment = await _context.Equipment
                    .Include(e => e.Specifications)
                    .Include(e => e.OperationalData)
                    .Include(e => e.SensorData)
                    .Include(e => e.MaintenanceHistory)
                    .ToListAsync();

                // Enrich with real-time data
                foreach (var item in equipment)
                {
                    await EnrichEquipmentDataAsync(item);
                }

                return equipment;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving all equipment");
                throw;
            }
        }

        public async Task<Equipment> GetEquipmentByIdAsync(int id)
        {
            try
            {
                var equipment = await _context.Equipment
                    .Include(e => e.Specifications)
                    .Include(e => e.OperationalData)
                    .Include(e => e.SensorData)
                    .Include(e => e.MaintenanceHistory)
                    .Include(e => e.Documents)
                    .FirstOrDefaultAsync(e => e.Id == id);

                if (equipment != null)
                {
                    await EnrichEquipmentDataAsync(equipment);
                }

                return equipment;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error retrieving equipment {id}");
                throw;
            }
        }

        public async Task<List<Equipment>> GetEquipmentBySiteAsync(string siteId)
        {
            try
            {
                var equipment = await _context.Equipment
                    .Where(e => e.SiteId == siteId)
                    .Include(e => e.Specifications)
                    .Include(e => e.OperationalData)
                    .ToListAsync();

                foreach (var item in equipment)
                {
                    await EnrichEquipmentDataAsync(item);
                }

                return equipment;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error retrieving equipment for site {siteId}");
                throw;
            }
        }

        public async Task<Equipment> CreateEquipmentAsync(Equipment equipment)
        {
            try
            {
                // Initialize operational data
                equipment.OperationalData = new OperationalData
                {
                    HoursRun = 0,
                    StartStopCycles = 0,
                    EnergyConsumed = 0,
                    CurrentLoad = 0,
                    AverageLoad = 0,
                    PeakLoad = 0,
                    Availability = 100,
                    Performance = 100,
                    Quality = 100,
                    OEE = 100
                };

                // Set installation date if not provided
                if (equipment.InstallationDate == default)
                {
                    equipment.InstallationDate = DateTime.UtcNow;
                }

                _context.Equipment.Add(equipment);
                await _context.SaveChangesAsync();

                // Initialize sensor monitoring
                await _sensorService.InitializeSensorMonitoringAsync(equipment.Id);

                // Create digital twin if applicable
                if (equipment.Type == EquipmentType.Motor ||
                    equipment.Type == EquipmentType.Transformer ||
                    equipment.Type == EquipmentType.WindTurbine)
                {
                    await CreateDigitalTwinAsync(equipment);
                }

                _logger.LogInformation($"Created new equipment: {equipment.Name} (ID: {equipment.Id})");
                return equipment;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating equipment");
                throw;
            }
        }

        public async Task<Equipment> UpdateEquipmentAsync(int id, Equipment equipment)
        {
            try
            {
                var existingEquipment = await _context.Equipment
                    .Include(e => e.Specifications)
                    .Include(e => e.OperationalData)
                    .FirstOrDefaultAsync(e => e.Id == id);

                if (existingEquipment == null)
                {
                    throw new PredictiveMaintenance.API.Exceptions.NotFoundException($"Equipment {id} not found");
                }

                // Update properties
                existingEquipment.Name = equipment.Name;
                existingEquipment.Type = equipment.Type;
                existingEquipment.SubType = equipment.SubType;
                existingEquipment.Location = equipment.Location;
                existingEquipment.Status = equipment.Status;
                existingEquipment.Criticality = equipment.Criticality;
                existingEquipment.Manufacturer = equipment.Manufacturer;
                existingEquipment.Model = equipment.Model;
                existingEquipment.SerialNumber = equipment.SerialNumber;

                // Update specifications
                if (equipment.Specifications != null)
                {
                    if (existingEquipment.Specifications == null)
                    {
                        existingEquipment.Specifications = new EquipmentSpecifications();
                    }
                    UpdateSpecifications(existingEquipment.Specifications, equipment.Specifications);
                }

                // Update operational data
                if (equipment.OperationalData != null)
                {
                    UpdateOperationalData(existingEquipment.OperationalData, equipment.OperationalData);
                }

                await _context.SaveChangesAsync();

                _logger.LogInformation($"Updated equipment: {existingEquipment.Name} (ID: {id})");
                return existingEquipment;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error updating equipment {id}");
                throw;
            }
        }

        public async Task<bool> DeleteEquipmentAsync(int id)
        {
            try
            {
                var equipment = await _context.Equipment.FindAsync(id);
                if (equipment == null)
                {
                    return false;
                }

                // Remove related data
                await _sensorService.RemoveSensorMonitoringAsync(id);

                _context.Equipment.Remove(equipment);
                await _context.SaveChangesAsync();

                _logger.LogInformation($"Deleted equipment: {equipment.Name} (ID: {id})");
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error deleting equipment {id}");
                throw;
            }
        }

        public async Task<List<Equipment>> GetCriticalEquipmentAsync()
        {
            try
            {
                var criticalEquipment = await _context.Equipment
                    .Where(e => e.Status == EquipmentStatus.Critical ||
                               e.Status == EquipmentStatus.Warning ||
                               e.Criticality == "critical" ||
                               e.Criticality == "high")
                    .Include(e => e.Specifications)
                    .Include(e => e.OperationalData)
                    .ToListAsync();

                foreach (var item in criticalEquipment)
                {
                    await EnrichEquipmentDataAsync(item);
                }

                return criticalEquipment.OrderByDescending(e => GetCriticalityScore(e)).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving critical equipment");
                throw;
            }
        }

        public async Task<Dictionary<string, object>> GetEquipmentMetricsAsync(int id)
        {
            try
            {
                var equipment = await GetEquipmentByIdAsync(id);
                if (equipment == null)
                {
                    throw new PredictiveMaintenance.API.Exceptions.NotFoundException($"Equipment {id} not found");
                }

                var metrics = new Dictionary<string, object>();

                // Operational metrics
                metrics["hoursRun"] = equipment.OperationalData?.HoursRun ?? 0;
                metrics["availability"] = equipment.OperationalData?.Availability ?? 0;
                metrics["performance"] = equipment.OperationalData?.Performance ?? 0;
                metrics["quality"] = equipment.OperationalData?.Quality ?? 0;
                metrics["oee"] = equipment.OperationalData?.OEE ?? 0;

                // Energy metrics
                metrics["energyConsumed"] = equipment.OperationalData?.EnergyConsumed ?? 0;
                metrics["energyGenerated"] = equipment.OperationalData?.EnergyGenerated ?? 0;
                metrics["currentLoad"] = equipment.OperationalData?.CurrentLoad ?? 0;
                metrics["peakLoad"] = equipment.OperationalData?.PeakLoad ?? 0;

                // Health metrics
                var healthScore = await CalculateHealthScoreAsync(equipment);
                metrics["healthScore"] = healthScore;
                metrics["remainingUsefulLife"] = await _predictionService.PredictRemainingUsefulLifeAsync(id);

                // Maintenance metrics
                metrics["daysSinceLastMaintenance"] = equipment.LastMaintenanceDate.HasValue ?
                    (DateTime.UtcNow - equipment.LastMaintenanceDate.Value).Days : -1;
                metrics["maintenanceCount"] = equipment.MaintenanceHistory?.Count ?? 0;

                // Financial metrics
                var financialMetrics = await CalculateFinancialMetricsAsync(equipment);
                metrics["maintenanceCost"] = financialMetrics["totalCost"];
                metrics["downTimeCost"] = financialMetrics["downTimeCost"];

                // Sensor metrics
                var latestSensorData = equipment.SensorData?.OrderByDescending(s => s.Timestamp).FirstOrDefault();
                if (latestSensorData != null)
                {
                    metrics["temperature"] = GetSensorValue(equipment.SensorData, "temperature");
                    metrics["vibration"] = GetSensorValue(equipment.SensorData, "vibration");
                    metrics["current"] = GetSensorValue(equipment.SensorData, "current");
                    metrics["voltage"] = GetSensorValue(equipment.SensorData, "voltage");
                }

                // Power quality metrics (for electrical equipment)
                if (IsElectricalEquipment(equipment.Type))
                {
                    var powerQuality = await CalculatePowerQualityMetricsAsync(equipment);
                    metrics["powerFactor"] = powerQuality["powerFactor"];
                    metrics["thd"] = powerQuality["thd"];
                    metrics["voltageImbalance"] = powerQuality["voltageImbalance"];
                }

                return metrics;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error calculating metrics for equipment {id}");
                throw;
            }
        }

        public async Task<List<MaintenanceRecommendation>> GetMaintenanceRecommendationsAsync(int id)
        {
            try
            {
                var equipment = await GetEquipmentByIdAsync(id);
                if (equipment == null)
                {
                    throw new PredictiveMaintenance.API.Exceptions.NotFoundException($"Equipment {id} not found");
                }

                var recommendations = new List<MaintenanceRecommendation>();

                // Get AI-based recommendations
                var aiRecommendations = await _predictionService.GenerateMaintenanceRecommendationsAsync(id);
                recommendations.AddRange(aiRecommendations);

                // Rule-based recommendations
                var ruleBasedRecommendations = GenerateRuleBasedRecommendations(equipment);
                recommendations.AddRange(ruleBasedRecommendations);

                // Prioritize recommendations
                return recommendations.OrderByDescending(r => r.Priority)
                                   .ThenBy(r => r.EstimatedCost)
                                   .ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error generating recommendations for equipment {id}");
                throw;
            }
        }

        private async Task EnrichEquipmentDataAsync(Equipment equipment)
        {
            // Get latest sensor readings from the service
            var latestReadings = await _sensorService.GetLatestSensorDataAsync(equipment.Id, 5);

            // Convert to SensorData model
            equipment.SensorData = latestReadings.Select(r => new ModelsSensorData
            {
                EquipmentId = r.EquipmentId,
                SensorId = $"SENSOR_{r.EquipmentId}_{r.SensorType}",
                Type = r.SensorType,
                Value = r.Value,
                Unit = GetUnitForSensorType(r.SensorType),
                Timestamp = r.Timestamp,
                Quality = "good",
                AnomalyScore = r.IsAnomaly ? 1.0 : 0.0
            }).ToList();

            // Update real-time operational metrics
            if (equipment.OperationalData != null)
            {
                equipment.OperationalData.CurrentLoad = GetCurrentLoad(equipment);
                equipment.OperationalData.OEE = CalculateOEE(equipment.OperationalData);
            }

            // Get active anomalies
            equipment.ActiveAnomalies = await _predictionService.GetActiveAnomaliesAsync(equipment.Id);

            // Calculate health score
            equipment.HealthScore = await CalculateHealthScoreAsync(equipment);
        }

        private async Task<double> CalculateHealthScoreAsync(Equipment equipment)
        {
            double healthScore = 100.0;

            // Factor in equipment status
            switch (equipment.Status)
            {
                case EquipmentStatus.Critical:
                    healthScore -= 40;
                    break;
                case EquipmentStatus.Warning:
                    healthScore -= 20;
                    break;
                case EquipmentStatus.UnderMaintenance:
                    healthScore -= 10;
                    break;
            }

            // Factor in sensor anomalies
            if (equipment.ActiveAnomalies?.Any() == true)
            {
                healthScore -= equipment.ActiveAnomalies.Count * 5;
            }

            // Factor in age
            var ageYears = (DateTime.UtcNow - equipment.InstallationDate).TotalDays / 365;
            var expectedLifeYears = GetExpectedLifeYears(equipment.Type);
            var ageRatio = ageYears / expectedLifeYears;
            healthScore -= ageRatio * 20;

            // Factor in maintenance history
            if (equipment.LastMaintenanceDate.HasValue)
            {
                var daysSinceLastMaintenance = (DateTime.UtcNow - equipment.LastMaintenanceDate.Value).Days;
                var recommendedMaintenanceInterval = GetRecommendedMaintenanceInterval(equipment.Type);

                if (daysSinceLastMaintenance > recommendedMaintenanceInterval)
                {
                    healthScore -= 10;
                }
            }

            // Factor in operational efficiency
            if (equipment.OperationalData != null)
            {
                var efficiencyPenalty = (100 - equipment.OperationalData.OEE) * 0.3;
                healthScore -= efficiencyPenalty;
            }

            return Math.Max(0, Math.Min(100, healthScore));
        }

        private double GetCurrentLoad(Equipment equipment)
        {
            // Get current sensor reading for load/power
            var currentSensor = equipment.SensorData?.Where(s => s.Type == "current" || s.Type == "power")
                                                     .OrderByDescending(s => s.Timestamp)
                                                     .FirstOrDefault();

            if (currentSensor == null) return 0;

            // Calculate load percentage based on equipment type and specifications
            double ratedPower = 0;

            switch (equipment.Type)
            {
                case EquipmentType.Motor:
                    ratedPower = equipment.Specifications?.HP ?? 100;
                    ratedPower *= 0.746; // Convert HP to kW
                    break;

                case EquipmentType.Transformer:
                    var powerStr = equipment.Specifications?.Power ?? "1000kVA";
                    ratedPower = ExtractNumericValue(powerStr);
                    break;

                default:
                    ratedPower = ExtractNumericValue(equipment.Specifications?.RatedPower ?? "100");
                    break;
            }

            return ratedPower > 0 ? (currentSensor.Value / ratedPower) * 100 : 0;
        }

        private double CalculateOEE(OperationalData opData)
        {
            var availability = opData.Availability / 100.0;
            var performance = opData.Performance / 100.0;
            var quality = opData.Quality / 100.0;

            return availability * performance * quality * 100;
        }

        private double GetCriticalityScore(Equipment equipment)
        {
            double score = 0;

            // Status weight
            switch (equipment.Status)
            {
                case EquipmentStatus.Critical:
                    score += 100;
                    break;
                case EquipmentStatus.Warning:
                    score += 50;
                    break;
            }

            // Criticality weight
            switch (equipment.Criticality?.ToLower())
            {
                case "critical":
                    score += 80;
                    break;
                case "high":
                    score += 60;
                    break;
                case "medium":
                    score += 40;
                    break;
                case "low":
                    score += 20;
                    break;
            }

            // Factor in health score
            score += (100 - equipment.HealthScore) * 0.5;

            return score;
        }

        private async Task<Dictionary<string, double>> CalculateFinancialMetricsAsync(Equipment equipment)
        {
            var metrics = new Dictionary<string, double>();

            // Calculate total maintenance cost
            double totalCost = 0;
            if (equipment.MaintenanceHistory != null)
            {
                totalCost = equipment.MaintenanceHistory.Sum(m => (double)m.Cost);  // Cast decimal to double
            }
            metrics["totalCost"] = totalCost;

            // Calculate downtime cost
            double downtimeHours = 0;
            if (equipment.MaintenanceHistory != null)
            {
                downtimeHours = equipment.MaintenanceHistory.Sum(m => m.Duration);
            }

            // Estimate cost per hour of downtime based on equipment type
            double costPerHour = EstimateDowntimeCostPerHour(equipment);
            metrics["downTimeCost"] = downtimeHours * costPerHour;

            // Energy cost
            double energyCost = 0;
            if (equipment.OperationalData != null)
            {
                double energyRate = 0.12; // $/kWh
                energyCost = equipment.OperationalData.EnergyConsumed * energyRate;
            }
            metrics["energyCost"] = energyCost;

            return metrics;
        }

        private async Task<Dictionary<string, double>> CalculatePowerQualityMetricsAsync(Equipment equipment)
        {
            var metrics = new Dictionary<string, double>();

            // Get latest electrical measurements
            var voltageSensors = equipment.SensorData?.Where(s => s.Type == "voltage").ToList();
            var currentSensors = equipment.SensorData?.Where(s => s.Type == "current").ToList();

            // Calculate power factor
            double powerFactor = 0.95; // Default
            var powerFactorSensor = equipment.SensorData?.FirstOrDefault(s => s.Type == "powerFactor");
            if (powerFactorSensor != null)
            {
                powerFactor = powerFactorSensor.Value;
            }
            metrics["powerFactor"] = powerFactor;

            // Calculate THD (Total Harmonic Distortion)
            double thd = 2.5; // Default acceptable level
            var thdSensor = equipment.SensorData?.FirstOrDefault(s => s.Type == "thd");
            if (thdSensor != null)
            {
                thd = thdSensor.Value;
            }
            metrics["thd"] = thd;

            // Calculate voltage imbalance
            double voltageImbalance = 0;
            if (voltageSensors?.Count >= 3)
            {
                var voltages = voltageSensors.OrderByDescending(v => v.Timestamp)
                                           .Take(3)
                                           .Select(v => v.Value)
                                           .ToList();

                var avgVoltage = voltages.Average();
                var maxDeviation = voltages.Max(v => Math.Abs(v - avgVoltage));
                voltageImbalance = (maxDeviation / avgVoltage) * 100;
            }
            metrics["voltageImbalance"] = voltageImbalance;

            return metrics;
        }

        private List<MaintenanceRecommendation> GenerateRuleBasedRecommendations(Equipment equipment)
        {
            var recommendations = new List<MaintenanceRecommendation>();

            // Check maintenance schedule
            if (equipment.LastMaintenanceDate.HasValue)
            {
                var daysSinceLastMaintenance = (DateTime.UtcNow - equipment.LastMaintenanceDate.Value).Days;
                var recommendedInterval = GetRecommendedMaintenanceInterval(equipment.Type);

                if (daysSinceLastMaintenance > recommendedInterval)
                {
                    recommendations.Add(new MaintenanceRecommendation
                    {
                        Type = "Scheduled Maintenance",
                        Description = $"Routine maintenance overdue by {daysSinceLastMaintenance - recommendedInterval} days",
                        Priority = MaintenancePriority.High,
                        EstimatedCost = EstimateMaintenanceCost(equipment.Type, "routine"),
                        EstimatedDuration = EstimateMaintenanceDuration(equipment.Type, "routine"),
                        RecommendedDate = DateTime.UtcNow.AddDays(7),
                        Actions = GetRoutineMaintenanceActions(equipment.Type)
                    });
                }
            }

            // Check operational parameters
            if (equipment.OperationalData != null)
            {
                // High runtime hours
                if (equipment.Type == EquipmentType.Motor && equipment.OperationalData.HoursRun > 8760)
                {
                    recommendations.Add(new MaintenanceRecommendation
                    {
                        Type = "Bearing Replacement",
                        Description = "Motor has exceeded recommended bearing life",
                        Priority = MaintenancePriority.Medium,
                        EstimatedCost = EstimateMaintenanceCost(equipment.Type, "bearing"),
                        EstimatedDuration = 4,
                        RecommendedDate = DateTime.UtcNow.AddDays(30),
                        Actions = new List<string>
                        {
                            "Perform vibration analysis",
                            "Check bearing temperature",
                            "Schedule bearing replacement if necessary"
                        }
                    });
                }

                // Low efficiency
                if (equipment.OperationalData.OEE < 70)
                {
                    recommendations.Add(new MaintenanceRecommendation
                    {
                        Type = "Performance Optimization",
                        Description = $"OEE below target: {equipment.OperationalData.OEE:F1}%",
                        Priority = MaintenancePriority.Medium,
                        EstimatedCost = 0,
                        EstimatedDuration = 2,
                        RecommendedDate = DateTime.UtcNow.AddDays(14),
                        Actions = new List<string>
                        {
                            "Analyze performance losses",
                            "Check alignment and calibration",
                            "Review operational procedures",
                            "Consider equipment upgrade"
                        }
                    });
                }
            }

            // Sensor-based recommendations
            if (equipment.SensorData != null && equipment.SensorData.Any())
            {
                // High temperature
                var tempSensor = equipment.SensorData.FirstOrDefault(s => s.Type == "temperature");
                if (tempSensor != null && tempSensor.Value > GetTemperatureThreshold(equipment.Type))
                {
                    recommendations.Add(new MaintenanceRecommendation
                    {
                        Type = "Cooling System Check",
                        Description = $"Temperature exceeding normal range: {tempSensor.Value:F1}°C",
                        Priority = MaintenancePriority.High,
                        EstimatedCost = EstimateMaintenanceCost(equipment.Type, "cooling"),
                        EstimatedDuration = 2,
                        RecommendedDate = DateTime.UtcNow.AddDays(3),
                        Actions = new List<string>
                        {
                            "Check cooling system operation",
                            "Clean heat exchangers/radiators",
                            "Verify coolant levels and quality",
                            "Inspect thermal insulation"
                        }
                    });
                }

                // High vibration
                var vibrationSensor = equipment.SensorData.FirstOrDefault(s => s.Type == "vibration");
                if (vibrationSensor != null && vibrationSensor.Value > GetVibrationThreshold(equipment.Type))
                {
                    recommendations.Add(new MaintenanceRecommendation
                    {
                        Type = "Vibration Analysis",
                        Description = $"Abnormal vibration detected: {vibrationSensor.Value:F2} mm/s",
                        Priority = MaintenancePriority.High,
                        EstimatedCost = EstimateMaintenanceCost(equipment.Type, "vibration"),
                        EstimatedDuration = 3,
                        RecommendedDate = DateTime.UtcNow.AddDays(7),
                        Actions = new List<string>
                        {
                            "Perform detailed vibration analysis",
                            "Check mounting and foundation",
                            "Verify alignment",
                            "Inspect rotating components",
                            "Balance if necessary"
                        }
                    });
                }
            }

            return recommendations;
        }

        private async Task CreateDigitalTwinAsync(Equipment equipment)
        {
            try
            {
                var digitalTwin = new DigitalTwinConfig
                {
                    ModelUrl = GetDigitalTwinModelUrl(equipment.Type),
                    ScadaIntegration = true,
                    RealtimeSync = true,
                    PhysicsEnabled = true
                };

                // Configure thermal model for motors and transformers
                if (equipment.Type == EquipmentType.Motor || equipment.Type == EquipmentType.Transformer)
                {
                    digitalTwin.ThermalModel = new ThermalModel
                    {
                        AmbientTemp = 25,
                        MaxTemp = GetMaxTemperature(equipment.Type),
                        CoolingMethod = equipment.Type == EquipmentType.Transformer ? "liquid" : "air",
                        ThermalCapacity = CalculateThermalCapacity(equipment),
                        DissipationRate = CalculateDissipationRate(equipment)
                    };
                }

                // Configure electrical model
                digitalTwin.ElectricalModel = new ElectricalModel
                {
                    NominalVoltage = ExtractNumericValue(equipment.Specifications?.RatedVoltage ?? "400"),
                    NominalCurrent = ExtractNumericValue(equipment.Specifications?.RatedCurrent ?? "100"),
                    PowerFactor = equipment.Specifications?.PowerFactor != null ?
                        double.Parse(equipment.Specifications.PowerFactor) : 0.85,
                    Harmonics = new HarmonicProfile
                    {
                        THD = 5.0,
                        IndividualHarmonics = GenerateHarmonicProfile(equipment.Type)
                    }
                };

                equipment.DigitalTwin = digitalTwin;
                await _context.SaveChangesAsync();

                _logger.LogInformation($"Created digital twin for equipment {equipment.Id}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error creating digital twin for equipment {equipment.Id}");
            }
        }

        // Helper methods - Fixed to use Models.SensorData
        private double GetSensorValue(ICollection<ModelsSensorData> sensorData, string sensorType)
        {
            return sensorData?.Where(s => s.Type == sensorType)
                            .OrderByDescending(s => s.Timestamp)
                            .FirstOrDefault()?.Value ?? 0;
        }

        private bool IsElectricalEquipment(EquipmentType type)
        {
            return type == EquipmentType.Transformer ||
                   type == EquipmentType.CircuitBreaker ||
                   type == EquipmentType.Motor ||
                   type == EquipmentType.Generator ||
                   type == EquipmentType.Switchgear ||
                   type == EquipmentType.Inverter;
        }

        private double GetExpectedLifeYears(EquipmentType type)
        {
            return type switch
            {
                EquipmentType.Transformer => 30,
                EquipmentType.Motor => 20,
                EquipmentType.CircuitBreaker => 25,
                EquipmentType.Cable => 40,
                EquipmentType.SolarPanel => 25,
                EquipmentType.WindTurbine => 20,
                EquipmentType.BatteryStorage => 10,
                EquipmentType.Inverter => 15,
                _ => 20
            };
        }

        private int GetRecommendedMaintenanceInterval(EquipmentType type)
        {
            return type switch
            {
                EquipmentType.Motor => 180,
                EquipmentType.Transformer => 365,
                EquipmentType.CircuitBreaker => 365,
                EquipmentType.WindTurbine => 90,
                EquipmentType.SolarPanel => 180,
                EquipmentType.BatteryStorage => 90,
                _ => 180
            };
        }

        private double EstimateMaintenanceCost(EquipmentType type, string maintenanceType)
        {
            var baseCost = type switch
            {
                EquipmentType.Motor => 500,
                EquipmentType.Transformer => 2000,
                EquipmentType.CircuitBreaker => 1000,
                EquipmentType.WindTurbine => 5000,
                _ => 1000
            };

            return maintenanceType switch
            {
                "routine" => baseCost,
                "bearing" => baseCost * 2,
                "cooling" => baseCost * 0.5,
                "vibration" => baseCost * 0.3,
                _ => baseCost
            };
        }

        private double EstimateMaintenanceDuration(EquipmentType type, string maintenanceType)
        {
            return maintenanceType switch
            {
                "routine" => 4,
                "bearing" => 8,
                "cooling" => 2,
                "vibration" => 3,
                _ => 4
            };
        }

        private List<string> GetRoutineMaintenanceActions(EquipmentType type)
        {
            var commonActions = new List<string>
            {
                "Visual inspection",
                "Clean equipment",
                "Check and tighten connections",
                "Verify safety devices",
                "Update maintenance log"
            };

            var specificActions = type switch
            {
                EquipmentType.Motor => new List<string>
                {
                    "Check bearing temperature and vibration",
                    "Measure insulation resistance",
                    "Verify alignment",
                    "Lubricate bearings",
                    "Check cooling system"
                },
                EquipmentType.Transformer => new List<string>
                {
                    "Oil sample analysis",
                    "Check oil level and temperature",
                    "Test protection relays",
                    "Measure winding resistance",
                    "Check tap changer operation"
                },
                EquipmentType.CircuitBreaker => new List<string>
                {
                    "Test operation mechanism",
                    "Check contact resistance",
                    "Verify protection settings",
                    "Lubricate moving parts",
                    "Test auxiliary circuits"
                },
                _ => new List<string>()
            };

            commonActions.AddRange(specificActions);
            return commonActions;
        }

        private double GetTemperatureThreshold(EquipmentType type)
        {
            return type switch
            {
                EquipmentType.Motor => 80,
                EquipmentType.Transformer => 85,
                EquipmentType.Inverter => 70,
                EquipmentType.BatteryStorage => 45,
                _ => 75
            };
        }

        private double GetVibrationThreshold(EquipmentType type)
        {
            return type switch
            {
                EquipmentType.Motor => 4.5,
                EquipmentType.WindTurbine => 7.0,
                _ => 5.0
            };
        }

        private double EstimateDowntimeCostPerHour(Equipment equipment)
        {
            var baseCost = equipment.Criticality switch
            {
                "critical" => 5000,
                "high" => 2000,
                "medium" => 500,
                "low" => 100,
                _ => 1000
            };

            // Adjust for equipment type
            var typeFactor = equipment.Type switch
            {
                EquipmentType.Transformer => 2.0,
                EquipmentType.Motor => equipment.Specifications?.HP > 1000 ? 1.5 : 1.0,
                EquipmentType.WindTurbine => 3.0,
                _ => 1.0
            };

            return baseCost * typeFactor;
        }

        private string GetDigitalTwinModelUrl(EquipmentType type)
        {
            return type switch
            {
                EquipmentType.Motor => "/assets/models/digital-twins/motor.glb",
                EquipmentType.Transformer => "/assets/models/digital-twins/transformer.glb",
                EquipmentType.WindTurbine => "/assets/models/digital-twins/wind-turbine.glb",
                _ => "/assets/models/digital-twins/generic.glb"
            };
        }

        private double GetMaxTemperature(EquipmentType type)
        {
            return type switch
            {
                EquipmentType.Motor => 155,
                EquipmentType.Transformer => 105,
                EquipmentType.Inverter => 85,
                EquipmentType.BatteryStorage => 60,
                _ => 100
            };
        }

        private double CalculateThermalCapacity(Equipment equipment)
        {
            // Simplified calculation based on equipment size
            var power = ExtractNumericValue(equipment.Specifications?.RatedPower ?? "100");
            return power * 0.5; // kJ/K
        }

        private double CalculateDissipationRate(Equipment equipment)
        {
            // Simplified calculation
            var power = ExtractNumericValue(equipment.Specifications?.RatedPower ?? "100");
            return power * 0.02; // kW/K
        }

        private List<HarmonicData> GenerateHarmonicProfile(EquipmentType type)
        {
            var harmonics = new List<HarmonicData>();

            if (type == EquipmentType.Inverter || type == EquipmentType.VFD)
            {
                harmonics.Add(new HarmonicData { Order = 5, Magnitude = 4.0, Phase = 0, Limit = 4.0 });
                harmonics.Add(new HarmonicData { Order = 7, Magnitude = 3.0, Phase = 0, Limit = 3.0 });
                harmonics.Add(new HarmonicData { Order = 11, Magnitude = 2.0, Phase = 0, Limit = 2.0 });
                harmonics.Add(new HarmonicData { Order = 13, Magnitude = 1.5, Phase = 0, Limit = 1.5 });
            }

            return harmonics;
        }

        private double ExtractNumericValue(string valueString)
        {
            if (string.IsNullOrEmpty(valueString)) return 0;

            // Extract numeric value from strings like "100kW", "50MVA", etc.
            var match = System.Text.RegularExpressions.Regex.Match(valueString, @"[\d.]+");
            if (!match.Success) return 0;

            var value = double.Parse(match.Value);

            // Apply multipliers
            if (valueString.Contains("k", StringComparison.OrdinalIgnoreCase))
                value *= 1000;
            else if (valueString.Contains("M", StringComparison.OrdinalIgnoreCase))
                value *= 1000000;

            return value;
        }

        private void UpdateSpecifications(EquipmentSpecifications existing, EquipmentSpecifications updated)
        {
            // Update all specification properties
            var properties = typeof(EquipmentSpecifications).GetProperties();
            foreach (var prop in properties)
            {
                var newValue = prop.GetValue(updated);
                if (newValue != null)
                {
                    prop.SetValue(existing, newValue);
                }
            }
        }

        private void UpdateOperationalData(OperationalData existing, OperationalData updated)
        {
            existing.HoursRun = updated.HoursRun;
            existing.StartStopCycles = updated.StartStopCycles;
            existing.EnergyConsumed = updated.EnergyConsumed;
            existing.EnergyGenerated = updated.EnergyGenerated;
            existing.CurrentLoad = updated.CurrentLoad;
            existing.AverageLoad = updated.AverageLoad;
            existing.PeakLoad = updated.PeakLoad;
            existing.Availability = updated.Availability;
            existing.Performance = updated.Performance;
            existing.Quality = updated.Quality;
            existing.OEE = CalculateOEE(existing);
        }

        // Helper method for getting unit for sensor type
        private string GetUnitForSensorType(string sensorType)
        {
            return sensorType.ToLower() switch
            {
                "temperature" => "°C",
                "vibration" => "mm/s",
                "current" => "A",
                "voltage" => "V",
                "power" => "kW",
                "pressure" => "bar",
                "flow" => "m³/h",
                "speed" or "rpm" => "RPM",
                "oil_quality" => "%",
                _ => ""
            };
        }
    }
}
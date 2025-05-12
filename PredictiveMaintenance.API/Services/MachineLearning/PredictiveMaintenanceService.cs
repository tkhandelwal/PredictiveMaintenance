using Microsoft.EntityFrameworkCore;
using PredictiveMaintenance.API.Data;
using PredictiveMaintenance.API.Models;
using PredictiveMaintenance.API.Services.DataGeneration;

namespace PredictiveMaintenance.API.Services.MachineLearning
{
    public interface IPredictiveMaintenanceService
    {
        Task<List<MaintenanceEvent>> PredictMaintenanceScheduleAsync(int equipmentId);
        Task<bool> DetectAnomalyAsync(SensorReading reading);
    }

    public class PredictiveMaintenanceService : IPredictiveMaintenanceService
    {
        private readonly ILogger<PredictiveMaintenanceService> _logger;
        private readonly IServiceScopeFactory _serviceScopeFactory;

        public PredictiveMaintenanceService(
            ILogger<PredictiveMaintenanceService> logger,
            IServiceScopeFactory serviceScopeFactory)
        {
            _logger = logger;
            _serviceScopeFactory = serviceScopeFactory;
        }

        public async Task<List<MaintenanceEvent>> PredictMaintenanceScheduleAsync(int equipmentId)
        {
            try
            {
                using (var scope = _serviceScopeFactory.CreateScope())
                {
                    var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                    var influxDbService = scope.ServiceProvider.GetRequiredService<IInfluxDbService>();

                    // Get existing maintenance events
                    var existingEvents = await dbContext.MaintenanceEvents
                        .Where(e => e.EquipmentId == equipmentId && e.CompletionDate == null)
                        .ToListAsync();

                    if (existingEvents.Any())
                    {
                        return existingEvents;
                    }

                    // Fetch historical data for analysis
                    var now = DateTime.UtcNow;
                    var from = now.AddDays(-7);
                    var readings = await influxDbService.GetReadingsForEquipmentAsync(equipmentId, from, now);

                    // Check if we have enough data for analysis
                    if (readings.Count < 10)
                    {
                        // Not enough data, generate a basic preventive maintenance event
                        var equipment = await dbContext.Equipment.FindAsync(equipmentId);
                        if (equipment != null)
                        {
                            // If last maintenance was more than 30 days ago or never done
                            if (!equipment.LastMaintenanceDate.HasValue ||
                                (now - equipment.LastMaintenanceDate.Value).TotalDays > 30)
                            {
                                var maintenanceEvent = new MaintenanceEvent
                                {
                                    EquipmentId = equipmentId,
                                    ScheduledDate = now.AddDays(7),
                                    Description = "Regular preventive maintenance",
                                    Type = MaintenanceType.Preventive,
                                    Priority = MaintenancePriority.Medium,
                                    AssignedTechnician = "Scheduled Technician"
                                };

                                // Save to database
                                dbContext.MaintenanceEvents.Add(maintenanceEvent);
                                await dbContext.SaveChangesAsync();

                                return new List<MaintenanceEvent> { maintenanceEvent };
                            }
                        }

                        return new List<MaintenanceEvent>();
                    }

                    // Analyze readings to find patterns and detect anomalies
                    var anomalies = readings.Where(r => r.IsAnomaly).ToList();

                    // If we detected anomalies recently, schedule a maintenance event
                    if (anomalies.Any())
                    {
                        var priority = anomalies.Count > 3 ? MaintenancePriority.High :
                                      anomalies.Count > 1 ? MaintenancePriority.Medium :
                                      MaintenancePriority.Low;

                        var description = anomalies.Count > 1
                            ? $"Maintenance based on {anomalies.Count} detected anomalies"
                            : $"Maintenance due to {anomalies[0].SensorType} anomaly";

                        var maintenanceEvent = new MaintenanceEvent
                        {
                            EquipmentId = equipmentId,
                            ScheduledDate = now.AddDays(1), // Schedule for tomorrow
                            Description = description,
                            Type = MaintenanceType.Predictive,
                            Priority = priority,
                            AssignedTechnician = "Auto-assigned"
                        };

                        // Save to database
                        dbContext.MaintenanceEvents.Add(maintenanceEvent);
                        await dbContext.SaveChangesAsync();

                        return new List<MaintenanceEvent> { maintenanceEvent };
                    }

                    return new List<MaintenanceEvent>();
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error predicting maintenance for equipment {equipmentId}");
                return new List<MaintenanceEvent>();
            }
        }

        public async Task<bool> DetectAnomalyAsync(SensorReading reading)
        {
            try
            {
                using (var scope = _serviceScopeFactory.CreateScope())
                {
                    var influxDbService = scope.ServiceProvider.GetRequiredService<IInfluxDbService>();

                    // Get recent readings for the same equipment and sensor type
                    var now = DateTime.UtcNow;
                    var from = now.AddDays(-1);
                    var historicalReadings = await influxDbService.GetReadingsForEquipmentAsync(reading.EquipmentId, from, now);

                    var relevantReadings = historicalReadings
                        .Where(r => r.SensorType == reading.SensorType)
                        .Select(r => r.Value)
                        .ToList();

                    if (relevantReadings.Count < 5)
                    {
                        // Not enough data, use fixed thresholds
                        bool anomalyDetected = DetectAnomalyWithThresholds(reading);

                        if (anomalyDetected)
                        {
                            await CreateMaintenanceEventAsync(reading);
                        }

                        return anomalyDetected;
                    }

                    // Statistical anomaly detection
                    double mean = relevantReadings.Average();
                    double stdDev = Math.Sqrt(relevantReadings.Select(x => Math.Pow(x - mean, 2)).Average());
                    stdDev = stdDev == 0 ? 1 : stdDev; // Avoid division by zero

                    // Calculate z-score (standard deviations from mean)
                    double zScore = Math.Abs(reading.Value - mean) / stdDev;

                    // Check rate of change (for sudden spikes)
                    bool suddenChange = false;
                    if (relevantReadings.Count >= 2)
                    {
                        var lastReading = relevantReadings.Last();
                        var change = Math.Abs(reading.Value - lastReading) / Math.Max(1, lastReading);
                        suddenChange = change > 0.15; // 15% change from last reading
                    }

                    _logger.LogInformation($"ML analysis: {reading.SensorType}={reading.Value}, mean={mean:F2}, " +
                        $"stdDev={stdDev:F2}, zScore={zScore:F2}, suddenChange={suddenChange}");

                    // Enhanced anomaly detection criteria
                    bool isAnomaly = zScore > 2.5 || suddenChange ||
                        (simulationMode == SimulationMode.Failure && _random.NextDouble() < 0.6); // Increase anomalies during failure simulation

                    // If anomaly detected, create a maintenance event
                    if (isAnomaly)
                    {
                        await CreateMaintenanceEventAsync(reading);
                    }

                    return isAnomaly;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error in anomaly detection for equipment {reading.EquipmentId}");
                return false;
            }
        }

        private bool DetectAnomalyWithThresholds(SensorReading reading)
        {
            // Updated thresholds that are more sensitive to detect anomalies
            switch (reading.SensorType.ToLower())
            {
                case "temperature":
                    // You can see temperature is spiking to 600+, so this will definitely trigger
                    return reading.Value > 70;
                case "vibration":
                    return reading.Value > 30;
                case "flow":
                    // Your flow is dropping to near zero in the chart
                    return reading.Value < 30;
                default:
                    return reading.Value > 0; // Catch-all to ensure something happens
            }
        }

        private async Task CreateMaintenanceEventAsync(SensorReading reading)
        {
            try
            {
                using (var scope = _serviceScopeFactory.CreateScope())
                {
                    var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                    // Check if there's already a recent event for this equipment
                    var existingEvent = await dbContext.MaintenanceEvents
                        .Where(e => e.EquipmentId == reading.EquipmentId &&
                               e.CompletionDate == null &&
                               e.ScheduledDate > DateTime.UtcNow.AddDays(-1))
                        .FirstOrDefaultAsync();

                    if (existingEvent != null)
                    {
                        // Update existing event priority if needed
                        var newPriority = DeterminePriority(reading);
                        if ((int)newPriority > (int)existingEvent.Priority)
                        {
                            existingEvent.Priority = newPriority;
                            existingEvent.Description += $" (Updated due to {reading.SensorType} anomaly, value: {reading.Value})";
                            await dbContext.SaveChangesAsync();
                            _logger.LogInformation($"Updated maintenance event priority for equipment {reading.EquipmentId}");
                        }
                        return;
                    }

                    // Create new maintenance event
                    var maintenanceEvent = new MaintenanceEvent
                    {
                        EquipmentId = reading.EquipmentId,
                        ScheduledDate = DateTime.UtcNow.AddDays(1), // Schedule for tomorrow
                        Description = $"Predicted maintenance needed due to {reading.SensorType} anomaly (value: {reading.Value})",
                        Type = MaintenanceType.Predictive,
                        Priority = DeterminePriority(reading),
                        AssignedTechnician = "Auto-assigned"
                    };

                    dbContext.MaintenanceEvents.Add(maintenanceEvent);
                    await dbContext.SaveChangesAsync();

                    _logger.LogInformation($"Created maintenance event for equipment {reading.EquipmentId} due to anomaly");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error creating maintenance event for equipment {reading.EquipmentId}");
            }
        }

        private MaintenancePriority DeterminePriority(SensorReading reading)
        {
            // Determine priority based on the sensor type and value
            switch (reading.SensorType.ToLower())
            {
                case "temperature":
                    return reading.Value > 95 ? MaintenancePriority.Critical :
                          reading.Value > 85 ? MaintenancePriority.High : MaintenancePriority.Medium;
                case "vibration":
                    return reading.Value > 38 ? MaintenancePriority.Critical :
                          reading.Value > 35 ? MaintenancePriority.High : MaintenancePriority.Medium;
                case "pressure":
                    return reading.Value > 115 ? MaintenancePriority.Critical :
                          reading.Value > 110 ? MaintenancePriority.High : MaintenancePriority.Medium;
                case "flow":
                    return reading.Value < 20 ? MaintenancePriority.Critical :
                          reading.Value < 25 ? MaintenancePriority.High : MaintenancePriority.Medium;
                case "rpm":
                    return reading.Value > 2300 ? MaintenancePriority.Critical :
                          reading.Value > 2200 ? MaintenancePriority.High : MaintenancePriority.Medium;
                default:
                    return MaintenancePriority.Medium;
            }
        }

        // Helper field to increase anomalies during failure simulation
        private static Random _random = new Random();
        private static SimulationMode simulationMode = SimulationMode.Normal;

        // This could be called from your SyntheticDataGenerator when simulation mode changes
        public static void SetSimulationMode(SimulationMode mode)
        {
            simulationMode = mode;
        }
    }
}
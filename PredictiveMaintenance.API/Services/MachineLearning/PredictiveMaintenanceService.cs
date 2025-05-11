using Microsoft.Extensions.Logging;
using Microsoft.ML;
using Microsoft.ML.Data;
using PredictiveMaintenance.API.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

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
        private readonly IInfluxDbService _influxDbService;
        private readonly MLContext _mlContext;

        public PredictiveMaintenanceService(
            ILogger<PredictiveMaintenanceService> logger,
            IInfluxDbService influxDbService)
        {
            _logger = logger;
            _influxDbService = influxDbService;
            _mlContext = new MLContext(seed: 0);
        }

        public async Task<List<MaintenanceEvent>> PredictMaintenanceScheduleAsync(int equipmentId)
        {
            try
            {
                // Fetch historical data for equipment
                var now = DateTime.UtcNow;
                var from = now.AddDays(-30);
                var readings = await _influxDbService.GetReadingsForEquipmentAsync(equipmentId, from, now);

                if (readings.Count < 10)
                {
                    _logger.LogWarning($"Not enough data for equipment {equipmentId} to predict maintenance");
                    return new List<MaintenanceEvent>();
                }

                // Analyze readings to find patterns and detect anomalies
                var anomalies = await DetectAnomaliesInBatchAsync(readings);

                // Generate maintenance schedule based on detected anomalies
                var maintenanceEvents = new List<MaintenanceEvent>();

                if (anomalies.Any(a => a.IsAnomaly))
                {
                    // If we detected anomalies, schedule a maintenance event
                    var maintenanceEvent = new MaintenanceEvent
                    {
                        EquipmentId = equipmentId,
                        ScheduledDate = now.AddDays(1), // Schedule for tomorrow
                        Description = "Preventive maintenance due to detected anomalies",
                        Type = MaintenanceType.Predictive,
                        Priority = MaintenancePriority.Medium,
                        AssignedTechnician = "Auto-assigned"
                    };

                    maintenanceEvents.Add(maintenanceEvent);
                }

                return maintenanceEvents;
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
                // Get recent readings for the same equipment and sensor type
                var now = DateTime.UtcNow;
                var from = now.AddDays(-7);
                var historicalReadings = await _influxDbService.GetReadingsForEquipmentAsync(reading.EquipmentId, from, now);

                if (historicalReadings.Count < 10)
                {
                    // Not enough data for reliable anomaly detection
                    return false;
                }

                // Use a simple statistical approach for anomaly detection
                // In a real-world scenario, use ML.NET's anomaly detection algorithms
                var relevantReadings = historicalReadings
                    .Where(r => r.SensorType == reading.SensorType)
                    .Select(r => r.Value)
                    .ToList();

                if (relevantReadings.Count == 0)
                {
                    return false;
                }

                double mean = relevantReadings.Average();
                double stdDev = Math.Sqrt(relevantReadings.Select(x => Math.Pow(x - mean, 2)).Average());

                // Mark as anomaly if more than 3 standard deviations from mean
                double zScore = Math.Abs(reading.Value - mean) / stdDev;
                bool isAnomaly = zScore > 3.0;

                _logger.LogInformation($"Anomaly detection for equipment {reading.EquipmentId}: " +
                    $"value = {reading.Value}, mean = {mean}, stdDev = {stdDev}, zScore = {zScore}, isAnomaly = {isAnomaly}");

                return isAnomaly;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error detecting anomaly for equipment {reading.EquipmentId}");
                return false;
            }
        }

        private async Task<List<SensorReading>> DetectAnomaliesInBatchAsync(List<SensorReading> readings)
        {
            // Group readings by sensor type
            var readingsByType = readings.GroupBy(r => r.SensorType).ToList();

            foreach (var group in readingsByType)
            {
                var sensorType = group.Key;
                var sensorReadings = group.ToList();

                // Simple statistical approach for anomaly detection
                double mean = sensorReadings.Select(r => r.Value).Average();
                double stdDev = Math.Sqrt(sensorReadings.Select(r => Math.Pow(r.Value - mean, 2)).Average());

                // Mark readings as anomalies if they're more than 3 standard deviations from the mean
                foreach (var reading in sensorReadings)
                {
                    double zScore = Math.Abs(reading.Value - mean) / stdDev;
                    reading.IsAnomaly = zScore > 3.0;
                }
            }

            return readings;
        }
    }
}
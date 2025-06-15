using MediatR;
using PredictiveMaintenance.API.Events;
using System.Collections.Concurrent;

namespace PredictiveMaintenance.API.Services.Monitoring
{
    public class EquipmentMonitoringService : IEquipmentMonitoringService
    {
        private readonly IMediator _mediator;
        private readonly ILogger<EquipmentMonitoringService> _logger;
        private readonly ConcurrentDictionary<int, bool> _monitoringStatus;

        // Threshold configurations (you can move these to appsettings.json)
        private readonly Dictionary<string, (double min, double max)> _normalRanges = new()
        {
            ["Temperature"] = (20.0, 80.0),
            ["Vibration"] = (0.0, 5.0),
            ["Pressure"] = (1.0, 10.0),
            ["RPM"] = (1000.0, 3000.0)
        };

        public EquipmentMonitoringService(
            IMediator mediator,
            ILogger<EquipmentMonitoringService> logger)
        {
            _mediator = mediator;
            _logger = logger;
            _monitoringStatus = new ConcurrentDictionary<int, bool>();
        }

        public Task StartMonitoringAsync(int equipmentId)
        {
            _monitoringStatus[equipmentId] = true;
            _logger.LogInformation($"Started monitoring equipment {equipmentId}");
            return Task.CompletedTask;
        }

        public Task StopMonitoringAsync(int equipmentId)
        {
            _monitoringStatus[equipmentId] = false;
            _logger.LogInformation($"Stopped monitoring equipment {equipmentId}");
            return Task.CompletedTask;
        }

        public Task<bool> IsMonitoringAsync(int equipmentId)
        {
            return Task.FromResult(_monitoringStatus.ContainsKey(equipmentId) && _monitoringStatus[equipmentId]);
        }

        public async Task ProcessSensorDataAsync(int equipmentId, Dictionary<string, double> sensorData)
        {
            if (!await IsMonitoringAsync(equipmentId))
            {
                _logger.LogWarning($"Equipment {equipmentId} is not being monitored");
                return;
            }

            // Check for anomalies
            var anomalies = DetectAnomalies(sensorData);

            if (anomalies.Any())
            {
                foreach (var anomaly in anomalies)
                {
                    _logger.LogWarning($"Anomaly detected for equipment {equipmentId}: {anomaly.Key} = {anomaly.Value}");

                    // Publish anomaly event
                    await _mediator.Publish(new EquipmentAnomalyDetectedEvent
                    {
                        EquipmentId = equipmentId,
                        EquipmentName = $"Equipment-{equipmentId}", // You'd fetch this from DB
                        AnomalyScore = CalculateAnomalyScore(anomaly.Key, anomaly.Value),
                        SensorReadings = sensorData,
                        AnomalyType = anomaly.Key
                    });
                }
            }
        }

        private Dictionary<string, double> DetectAnomalies(Dictionary<string, double> sensorData)
        {
            var anomalies = new Dictionary<string, double>();

            foreach (var reading in sensorData)
            {
                if (_normalRanges.ContainsKey(reading.Key))
                {
                    var (min, max) = _normalRanges[reading.Key];
                    if (reading.Value < min || reading.Value > max)
                    {
                        anomalies[reading.Key] = reading.Value;
                    }
                }
            }

            return anomalies;
        }

        private double CalculateAnomalyScore(string sensorType, double value)
        {
            if (!_normalRanges.ContainsKey(sensorType))
                return 0.5;

            var (min, max) = _normalRanges[sensorType];
            var range = max - min;

            if (value < min)
                return Math.Min(1.0, (min - value) / range);
            else if (value > max)
                return Math.Min(1.0, (value - max) / range);

            return 0.0;
        }
    }
}
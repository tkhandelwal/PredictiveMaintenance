using PredictiveMaintenance.API.Models;

namespace PredictiveMaintenance.API.Services
{
    public class InMemoryInfluxDbService : IInfluxDbService
    {
        private readonly ILogger<InMemoryInfluxDbService> _logger;
        private static Dictionary<int, List<SensorReading>> _readings = new Dictionary<int, List<SensorReading>>();
        private static object _lock = new object();

        public InMemoryInfluxDbService(ILogger<InMemoryInfluxDbService> logger)
        {
            _logger = logger;
            _logger.LogInformation("Using in-memory storage for sensor readings");
        }

        public Task WriteSensorReadingAsync(SensorReading reading)
        {
            lock (_lock)
            {
                if (!_readings.ContainsKey(reading.EquipmentId))
                {
                    _readings[reading.EquipmentId] = new List<SensorReading>();
                }

                _readings[reading.EquipmentId].Add(reading);

                // Keep only the most recent readings (1000 per equipment)
                if (_readings[reading.EquipmentId].Count > 1000)
                {
                    _readings[reading.EquipmentId].RemoveAt(0);
                }
            }

            _logger.LogDebug("Stored reading: {SensorType}={Value} for equipment {EquipmentId}",
                reading.SensorType, reading.Value, reading.EquipmentId);

            return Task.CompletedTask;
        }

        public Task<List<SensorReading>> GetReadingsForEquipmentAsync(int equipmentId, DateTime from, DateTime to)
        {
            List<SensorReading> result;

            lock (_lock)
            {
                if (_readings.TryGetValue(equipmentId, out var equipment))
                {
                    result = equipment
                        .Where(r => r.Timestamp >= from && r.Timestamp <= to)
                        .OrderByDescending(r => r.Timestamp)
                        .ToList();
                }
                else
                {
                    result = new List<SensorReading>();
                }
            }

            _logger.LogInformation("Retrieved {Count} readings for equipment {EquipmentId}",
                result.Count, equipmentId);

            return Task.FromResult(result);
        }

        public Task<List<SensorReading>> GetLatestReadingsAsync(int limit = 100)
        {
            List<SensorReading> result;

            lock (_lock)
            {
                result = _readings
                    .SelectMany(kvp => kvp.Value)
                    .OrderByDescending(r => r.Timestamp)
                    .Take(limit)
                    .ToList();
            }

            _logger.LogInformation("Retrieved {Count} latest readings across all equipment", result.Count);
            return Task.FromResult(result);
        }
    }
}
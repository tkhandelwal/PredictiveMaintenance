using PredictiveMaintenance.API.Models;
using PredictiveMaintenance.API.Services.MachineLearning;

namespace PredictiveMaintenance.API.Services.Monitoring
{
    public interface IEquipmentMonitoringService
    {
        Task<List<Equipment>> GetAllEquipmentAsync();
        Task<Equipment> GetEquipmentByIdAsync(int id);
        Task<MaintenanceStatus> GetEquipmentStatusAsync(int id);
        Task<List<SensorReading>> GetLatestReadingsForEquipmentAsync(int id, int limit = 50);
    }

    public class EquipmentMonitoringService : IEquipmentMonitoringService
    {
        private readonly ILogger<EquipmentMonitoringService> _logger;
        private readonly IInfluxDbService _influxDbService;
        private readonly IPredictiveMaintenanceService _maintenanceService;

        // In a real application, this would come from a database
        private readonly List<Equipment> _equipment = new List<Equipment>
        {
            new Equipment
            {
                Id = 1,
                Name = "Pump 1",
                Type = "Centrifugal Pump",
                InstallationDate = DateTime.UtcNow.AddYears(-2),
                LastMaintenanceDate = DateTime.UtcNow.AddMonths(-3),
                Status = MaintenanceStatus.Operational
            },
            new Equipment
            {
                Id = 2,
                Name = "Motor 1",
                Type = "Electric Motor",
                InstallationDate = DateTime.UtcNow.AddYears(-1),
                LastMaintenanceDate = DateTime.UtcNow.AddMonths(-1),
                Status = MaintenanceStatus.Operational
            },
            new Equipment
            {
                Id = 3,
                Name = "Compressor 1",
                Type = "Air Compressor",
                InstallationDate = DateTime.UtcNow.AddYears(-3),
                LastMaintenanceDate = DateTime.UtcNow.AddMonths(-6),
                Status = MaintenanceStatus.Warning
            },
            new Equipment
            {
                Id = 4,
                Name = "Fan 1",
                Type = "Industrial Fan",
                InstallationDate = DateTime.UtcNow.AddMonths(-11),
                LastMaintenanceDate = DateTime.UtcNow.AddMonths(-2),
                Status = MaintenanceStatus.Operational
            },
        };

        public EquipmentMonitoringService(
            ILogger<EquipmentMonitoringService> logger,
            IInfluxDbService influxDbService,
            IPredictiveMaintenanceService maintenanceService)
        {
            _logger = logger;
            _influxDbService = influxDbService;
            _maintenanceService = maintenanceService;
        }

        public Task<List<Equipment>> GetAllEquipmentAsync()
        {
            return Task.FromResult(_equipment);
        }

        public Task<Equipment> GetEquipmentByIdAsync(int id)
        {
            var equipment = _equipment.Find(e => e.Id == id);

            if (equipment == null)
            {
                throw new KeyNotFoundException($"Equipment with ID {id} not found");
            }

            return Task.FromResult(equipment);
        }

        public async Task<MaintenanceStatus> GetEquipmentStatusAsync(int id)
        {
            try
            {
                // Get latest readings
                var readings = await GetLatestReadingsForEquipmentAsync(id, 10);

                if (readings.Count == 0)
                {
                    return MaintenanceStatus.Operational;
                }

                // Check for anomalies
                int anomalyCount = 0;
                foreach (var reading in readings)
                {
                    bool isAnomaly = await _maintenanceService.DetectAnomalyAsync(reading);
                    if (isAnomaly)
                    {
                        anomalyCount++;
                    }
                }

                // Update status based on anomaly percentage
                double anomalyPercentage = (double)anomalyCount / readings.Count;

                if (anomalyPercentage > 0.5)
                {
                    return MaintenanceStatus.Critical;
                }
                else if (anomalyPercentage > 0.2)
                {
                    return MaintenanceStatus.Warning;
                }
                else
                {
                    return MaintenanceStatus.Operational;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error getting status for equipment {id}");
                return MaintenanceStatus.Operational;
            }
        }

        public class NotFoundException : Exception
        {
            public NotFoundException(string message) : base(message) { }
        }

        public async Task<List<SensorReading>> GetLatestReadingsForEquipmentAsync(int id, int limit = 50)
        {
            try
            {
                var now = DateTime.UtcNow;
                var from = now.AddDays(-1);
                var readings = await _influxDbService.GetReadingsForEquipmentAsync(id, from, now);

                return readings.Count > limit
                    ? readings.OrderByDescending(r => r.Timestamp).Take(limit).ToList()
                    : readings;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error getting latest readings for equipment {id}");
                return new List<SensorReading>();
            }
        }
    }
}
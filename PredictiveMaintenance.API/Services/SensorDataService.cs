// Services/SensorDataService.cs
using Microsoft.EntityFrameworkCore;
using PredictiveMaintenance.API.Data;
using PredictiveMaintenance.API.Models;

namespace PredictiveMaintenance.API.Services
{
    public interface ISensorDataService
    {
        Task<List<SensorReading>> GetLatestSensorDataAsync(int equipmentId, int count);
        Task RemoveSensorMonitoringAsync(int equipmentId);
    }

    public class SensorDataService : ISensorDataService
    {
        private readonly ApplicationDbContext _context;
        private readonly IInfluxDbService _influxDbService;
        private readonly ILogger<SensorDataService> _logger;

        public SensorDataService(
            ApplicationDbContext context,
            IInfluxDbService influxDbService,
            ILogger<SensorDataService> logger)
        {
            _context = context;
            _influxDbService = influxDbService;
            _logger = logger;
        }

        public async Task<List<SensorReading>> GetLatestSensorDataAsync(int equipmentId, int count)
        {
            try
            {
                var now = DateTime.UtcNow;
                var from = now.AddHours(-24);
                var readings = await _influxDbService.GetReadingsForEquipmentAsync(equipmentId, from, now);

                return readings.OrderByDescending(r => r.Timestamp)
                               .Take(count)
                               .ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error getting sensor data for equipment {equipmentId}");
                return new List<SensorReading>();
            }
        }

        public async Task RemoveSensorMonitoringAsync(int equipmentId)
        {
            try
            {
                var sensorData = await _context.Set<SensorData>()
                    .Where(s => s.EquipmentId == equipmentId)
                    .ToListAsync();

                _context.RemoveRange(sensorData);
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error removing sensor monitoring for equipment {equipmentId}");
            }
        }
    }
}


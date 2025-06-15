using PredictiveMaintenance.API.Models;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace PredictiveMaintenance.API.Services
{
    public interface ISensorDataService
    {
        Task<List<SensorReading>> GetLatestSensorDataAsync(int equipmentId, int count);
        Task RemoveSensorMonitoringAsync(int equipmentId);
        Task InitializeSensorMonitoringAsync(int equipmentId);
    }
}
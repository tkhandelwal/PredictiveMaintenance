// Services/MachineLearning/IPredictiveMaintenanceService.cs
using PredictiveMaintenance.API.Models;

namespace PredictiveMaintenance.API.Services.MachineLearning
{
    public interface IPredictiveMaintenanceService
    {
        Task<bool> DetectAnomalyAsync(SensorReading reading);
        Task<double> PredictRemainingUsefulLifeAsync(int equipmentId);
        Task<List<MaintenanceRecommendation>> GenerateMaintenanceRecommendationsAsync(int equipmentId);
        Task<List<Anomaly>> GetActiveAnomaliesAsync(int equipmentId);
    }
}
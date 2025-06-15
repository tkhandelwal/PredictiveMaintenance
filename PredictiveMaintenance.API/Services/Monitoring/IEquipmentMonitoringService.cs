namespace PredictiveMaintenance.API.Services.Monitoring
{
    public interface IEquipmentMonitoringService
    {
        Task StartMonitoringAsync(int equipmentId);
        Task StopMonitoringAsync(int equipmentId);
        Task<bool> IsMonitoringAsync(int equipmentId);
        Task ProcessSensorDataAsync(int equipmentId, Dictionary<string, double> sensorData);
    }
}
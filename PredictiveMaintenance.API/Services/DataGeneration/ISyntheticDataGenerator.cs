using PredictiveMaintenance.API.Models;

namespace PredictiveMaintenance.API.Services.DataGeneration
{
    public interface ISyntheticDataGenerator
    {
        Task<SensorReading> GenerateSensorReadingAsync(int equipmentId, string sensorType = null);
        Task<List<SensorReading>> GenerateBatchReadingsAsync(int count);
        void SetSimulationMode(int equipmentId, SimulationMode mode, int durationSeconds = 0);
        void ResetAllSimulations();
    }
}
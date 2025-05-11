// Services/DataGeneration/ISyntheticDataGenerator.cs
using PredictiveMaintenance.API.Models;

namespace PredictiveMaintenance.API.Services.DataGeneration
{
    public interface ISyntheticDataGenerator
    {
        Task<SensorReading> GenerateSensorReadingAsync(int equipmentId);
        Task<List<SensorReading>> GenerateBatchReadingsAsync(int count);
    }
}
using Microsoft.ML.Data;

namespace PredictiveMaintenance.API.Services.MachineLearning
{
    public class MLSensorData
    {
        [LoadColumn(0)]
        public float Value { get; set; }
    }
}
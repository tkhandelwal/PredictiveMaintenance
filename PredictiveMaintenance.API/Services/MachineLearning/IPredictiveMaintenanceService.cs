namespace PredictiveMaintenance.API.Services.MachineLearning
{
    public class PredictionResult
    {
        public double FailureProbability { get; set; }
        public int EstimatedDaysToFailure { get; set; }
        public List<string> PotentialFailureComponents { get; set; }
        public string RecommendedAction { get; set; }
    }

    public interface IPredictiveMaintenanceService
    {
        Task<PredictionResult> GeneratePredictionAsync(int equipmentId, Dictionary<string, double> sensorData);
        Task TrainModelAsync(int equipmentId);
        Task<bool> IsModelTrainedAsync(int equipmentId);
    }
}
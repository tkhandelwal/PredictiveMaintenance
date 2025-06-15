using MediatR;
using PredictiveMaintenance.API.Events;
using System.Collections.Concurrent;

namespace PredictiveMaintenance.API.Services.MachineLearning
{
    public class PredictiveMaintenanceService : IPredictiveMaintenanceService
    {
        private readonly ILogger<PredictiveMaintenanceService> _logger;
        private readonly IMediator _mediator;
        private readonly ConcurrentDictionary<int, bool> _trainedModels;

        public PredictiveMaintenanceService(
            ILogger<PredictiveMaintenanceService> logger,
            IMediator mediator)
        {
            _logger = logger;
            _mediator = mediator;
            _trainedModels = new ConcurrentDictionary<int, bool>();
        }

        public async Task<PredictionResult> GeneratePredictionAsync(int equipmentId, Dictionary<string, double> sensorData)
        {
            _logger.LogInformation($"Generating prediction for equipment {equipmentId}");

            // Simulate ML prediction (replace with your actual ML logic)
            var prediction = await SimulateMachineLearningPrediction(equipmentId, sensorData);

            // Publish prediction event
            await _mediator.Publish(new PredictionGeneratedEvent
            {
                EquipmentId = equipmentId,
                FailureProbability = prediction.FailureProbability,
                EstimatedDaysToFailure = prediction.EstimatedDaysToFailure,
                RecommendedAction = prediction.RecommendedAction,
                FailureComponents = prediction.PotentialFailureComponents
            });

            return prediction;
        }

        public async Task TrainModelAsync(int equipmentId)
        {
            _logger.LogInformation($"Training model for equipment {equipmentId}");

            // Simulate model training (replace with actual ML training)
            await Task.Delay(1000); // Simulate training time

            _trainedModels[equipmentId] = true;
            _logger.LogInformation($"Model trained for equipment {equipmentId}");
        }

        public Task<bool> IsModelTrainedAsync(int equipmentId)
        {
            return Task.FromResult(_trainedModels.ContainsKey(equipmentId) && _trainedModels[equipmentId]);
        }

        private async Task<PredictionResult> SimulateMachineLearningPrediction(
            int equipmentId,
            Dictionary<string, double> sensorData)
        {
            // This is where you'd integrate your actual ML model
            // For now, let's simulate based on sensor readings

            await Task.Delay(100); // Simulate inference time

            var avgTemp = sensorData.ContainsKey("Temperature") ? sensorData["Temperature"] : 50.0;
            var avgVibration = sensorData.ContainsKey("Vibration") ? sensorData["Vibration"] : 2.5;

            // Simple rule-based prediction (replace with actual ML)
            var failureProbability = 0.0;
            var daysToFailure = 365;
            var components = new List<string>();
            var action = "Continue normal operation";

            if (avgTemp > 75)
            {
                failureProbability += 0.3;
                daysToFailure = Math.Min(daysToFailure, 90);
                components.Add("Cooling System");
            }

            if (avgVibration > 4)
            {
                failureProbability += 0.4;
                daysToFailure = Math.Min(daysToFailure, 60);
                components.Add("Bearings");
            }

            if (failureProbability > 0.5)
            {
                action = "Schedule preventive maintenance";
                if (failureProbability > 0.7)
                {
                    action = "Immediate inspection required";
                    daysToFailure = Math.Min(daysToFailure, 7);
                }
            }

            return new PredictionResult
            {
                FailureProbability = Math.Min(failureProbability, 1.0),
                EstimatedDaysToFailure = daysToFailure,
                PotentialFailureComponents = components,
                RecommendedAction = action
            };
        }
    }
}
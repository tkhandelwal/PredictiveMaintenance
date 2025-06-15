using MediatR;
using PredictiveMaintenance.API.Events;
using PredictiveMaintenance.API.Services.MachineLearning;

namespace PredictiveMaintenance.API.Handlers
{
    public class EquipmentAnomalyHandler : INotificationHandler<EquipmentAnomalyDetectedEvent>
    {
        private readonly IPredictiveMaintenanceService _predictiveService;
        private readonly ILogger<EquipmentAnomalyHandler> _logger;

        public EquipmentAnomalyHandler(
            IPredictiveMaintenanceService predictiveService,
            ILogger<EquipmentAnomalyHandler> logger)
        {
            _predictiveService = predictiveService;
            _logger = logger;
        }

        public async Task Handle(EquipmentAnomalyDetectedEvent notification, CancellationToken cancellationToken)
        {
            _logger.LogInformation($"Handling anomaly for equipment {notification.EquipmentId}");

            // Generate prediction based on anomaly
            if (notification.AnomalyScore > 0.3) // Threshold for prediction
            {
                await _predictiveService.GeneratePredictionAsync(
                    notification.EquipmentId,
                    notification.SensorReadings);
            }
        }
    }
}
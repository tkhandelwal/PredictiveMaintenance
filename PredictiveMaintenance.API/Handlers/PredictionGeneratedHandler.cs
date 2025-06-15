using MediatR;
using PredictiveMaintenance.API.Events;

namespace PredictiveMaintenance.API.Handlers
{
    public class PredictionGeneratedHandler : INotificationHandler<PredictionGeneratedEvent>
    {
        private readonly IMediator _mediator;
        private readonly ILogger<PredictionGeneratedHandler> _logger;

        public PredictionGeneratedHandler(
            IMediator mediator,
            ILogger<PredictionGeneratedHandler> logger)
        {
            _mediator = mediator;
            _logger = logger;
        }

        public async Task Handle(PredictionGeneratedEvent notification, CancellationToken cancellationToken)
        {
            _logger.LogInformation($"Processing prediction for equipment {notification.EquipmentId}");

            // Determine if maintenance is required
            if (notification.FailureProbability > 0.6 || notification.EstimatedDaysToFailure < 30)
            {
                var priority = DeterminePriority(notification.FailureProbability, notification.EstimatedDaysToFailure);

                await _mediator.Publish(new MaintenanceRequiredEvent
                {
                    EquipmentId = notification.EquipmentId,
                    EquipmentName = $"Equipment-{notification.EquipmentId}",
                    Priority = priority,
                    MaintenanceType = DetermineMaintenanceType(notification.FailureComponents),
                    RequiredBy = DateTime.UtcNow.AddDays(notification.EstimatedDaysToFailure),
                    RequiredParts = notification.FailureComponents,
                    EstimatedDowntime = EstimateDowntime(notification.FailureComponents)
                }, cancellationToken);
            }
        }

        private MaintenancePriority DeterminePriority(double failureProbability, int daysToFailure)
        {
            if (daysToFailure <= 7 || failureProbability > 0.9)
                return MaintenancePriority.Critical;
            if (daysToFailure <= 14 || failureProbability > 0.7)
                return MaintenancePriority.High;
            if (daysToFailure <= 30 || failureProbability > 0.5)
                return MaintenancePriority.Medium;
            return MaintenancePriority.Low;
        }

        private string DetermineMaintenanceType(List<string> components)
        {
            if (components.Count > 2)
                return "Major Overhaul";
            if (components.Contains("Bearings"))
                return "Bearing Replacement";
            if (components.Contains("Cooling System"))
                return "Cooling System Service";
            return "Preventive Maintenance";
        }

        private double EstimateDowntime(List<string> components)
        {
            // Base hours per component
            var hoursPerComponent = new Dictionary<string, double>
            {
                ["Bearings"] = 4.0,
                ["Cooling System"] = 2.0,
                ["Electrical"] = 3.0,
                ["Hydraulics"] = 5.0
            };

            return components.Sum(c => hoursPerComponent.ContainsKey(c) ? hoursPerComponent[c] : 2.0);
        }
    }
}
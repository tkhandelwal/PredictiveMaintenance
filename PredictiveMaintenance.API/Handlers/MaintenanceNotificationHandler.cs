using MediatR;
using Microsoft.AspNetCore.SignalR;
using PredictiveMaintenance.API.Events;
using PredictiveMaintenance.API.Hubs;

namespace PredictiveMaintenance.API.Handlers
{
    public class MaintenanceNotificationHandler : INotificationHandler<MaintenanceRequiredEvent>
    {
        private readonly IHubContext<EquipmentHub> _hubContext;
        private readonly ILogger<MaintenanceNotificationHandler> _logger;

        public MaintenanceNotificationHandler(
            IHubContext<EquipmentHub> hubContext,
            ILogger<MaintenanceNotificationHandler> logger)
        {
            _hubContext = hubContext;
            _logger = logger;
        }

        public async Task Handle(MaintenanceRequiredEvent notification, CancellationToken cancellationToken)
        {
            _logger.LogWarning($"Maintenance required for equipment {notification.EquipmentId} - Priority: {notification.Priority}");

            // Send real-time notification to connected clients
            await _hubContext.Clients.All.SendAsync(
                "MaintenanceRequired",
                new
                {
                    notification.EquipmentId,
                    notification.EquipmentName,
                    Priority = notification.Priority.ToString(),
                    notification.MaintenanceType,
                    RequiredBy = notification.RequiredBy.ToString("yyyy-MM-dd"),
                    notification.EstimatedDowntime
                },
                cancellationToken);

            // Here you could also:
            // - Send email notifications
            // - Create work orders in your maintenance system
            // - Update equipment status in database
            // - Log to external monitoring systems
        }
    }
}
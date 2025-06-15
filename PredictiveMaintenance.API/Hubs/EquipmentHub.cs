using Microsoft.AspNetCore.SignalR;

namespace PredictiveMaintenance.API.Hubs
{
    public class EquipmentHub : Hub
    {
        private readonly ILogger<EquipmentHub> _logger;

        public EquipmentHub(ILogger<EquipmentHub> logger)
        {
            _logger = logger;
        }

        public override async Task OnConnectedAsync()
        {
            _logger.LogInformation($"Client connected: {Context.ConnectionId}");
            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception exception)
        {
            _logger.LogInformation($"Client disconnected: {Context.ConnectionId}");
            await base.OnDisconnectedAsync(exception);
        }

        public async Task SubscribeToEquipment(int equipmentId)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"equipment-{equipmentId}");
            _logger.LogInformation($"Client {Context.ConnectionId} subscribed to equipment {equipmentId}");
        }

        public async Task UnsubscribeFromEquipment(int equipmentId)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"equipment-{equipmentId}");
            _logger.LogInformation($"Client {Context.ConnectionId} unsubscribed from equipment {equipmentId}");
        }
    }
}
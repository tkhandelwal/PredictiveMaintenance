using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;
using PredictiveMaintenance.API.Models;
using System;
using System.Threading.Tasks;

namespace PredictiveMaintenance.API.Hubs
{
    public class MonitoringHub : Hub
    {
        private readonly ILogger<MonitoringHub> _logger;

        public MonitoringHub(ILogger<MonitoringHub> logger)
        {
            _logger = logger;
        }

        public override async Task OnConnectedAsync()
        {
            _logger.LogInformation($"Client connected: {Context.ConnectionId}");
            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception) // Add the ? to make it nullable
        {
            _logger.LogInformation($"Client disconnected: {Context.ConnectionId}");
            await base.OnDisconnectedAsync(exception);
        }

        public async Task SubscribeToEquipment(int equipmentId)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"Equipment_{equipmentId}");
            _logger.LogInformation($"Client {Context.ConnectionId} subscribed to Equipment_{equipmentId}");
        }

        public async Task UnsubscribeFromEquipment(int equipmentId)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"Equipment_{equipmentId}");
            _logger.LogInformation($"Client {Context.ConnectionId} unsubscribed from Equipment_{equipmentId}");
        }
    }
}
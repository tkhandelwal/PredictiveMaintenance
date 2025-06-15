// Services/DataGeneration/DataGenerationBackgroundService.cs
using Microsoft.AspNetCore.SignalR;
using PredictiveMaintenance.API.Hubs;
using PredictiveMaintenance.API.Models;
using PredictiveMaintenance.API.Services.Monitoring;

namespace PredictiveMaintenance.API.Services.DataGeneration
{
    public class DataGenerationBackgroundService : BackgroundService
    {
        private readonly ILogger<DataGenerationBackgroundService> _logger;
        private readonly ISyntheticDataGenerator _dataGenerator;
        private readonly IHubContext<MonitoringHub> _hubContext;
        private readonly IServiceScopeFactory _serviceScopeFactory;
        private readonly TimeSpan _interval = TimeSpan.FromSeconds(3); // More frequent updates

        // Dictionary to track the last known status of each equipment
        private readonly Dictionary<int, EquipmentStatus> _lastKnownStatus = new Dictionary<int, EquipmentStatus>();

        // Use object lock to coordinate data generation
        private readonly object _lock = new object();
        private bool _isGenerating = false;

        public DataGenerationBackgroundService(
            ILogger<DataGenerationBackgroundService> logger,
            ISyntheticDataGenerator dataGenerator,
            IHubContext<MonitoringHub> hubContext,
            IServiceScopeFactory serviceScopeFactory)
        {
            _logger = logger;
            _dataGenerator = dataGenerator;
            _hubContext = hubContext;
            _serviceScopeFactory = serviceScopeFactory;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Data Generation Background Service is starting.");

            // Initialize the last known status dictionary
            await InitializeLastKnownStatusAsync(stoppingToken);

            while (!stoppingToken.IsCancellationRequested)
            {
                if (!_isGenerating)
                {
                    lock (_lock)
                    {
                        _isGenerating = true;
                    }

                    try
                    {
                        _logger.LogInformation("Generating synthetic data batch...");

                        // Generate readings for all equipment and sensor types
                        var readings = await _dataGenerator.GenerateBatchReadingsAsync(4);

                        // Send readings to SignalR clients
                        foreach (var reading in readings)
                        {
                            try
                            {
                                // Send to clients subscribed to this specific equipment
                                await _hubContext.Clients.Group($"Equipment_{reading.EquipmentId}")
                                    .SendAsync("ReceiveSensorReading", reading, cancellationToken: stoppingToken);

                                // Broadcast anomalies to all clients
                                if (reading.IsAnomaly)
                                {
                                    await _hubContext.Clients.All.SendAsync("AnomalyDetected", new
                                    {
                                        reading.EquipmentId,
                                        reading.SensorType,
                                        reading.Value,
                                        reading.Timestamp,
                                        reading.IsAnomaly
                                    }, cancellationToken: stoppingToken);
                                }
                            }
                            catch (Exception ex)
                            {
                                _logger.LogError(ex, "Failed to send data to SignalR clients");
                            }
                        }

                        // Check and notify about equipment status changes
                        await NotifyStatusChangesAsync(stoppingToken);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error occurred while generating synthetic data.");
                    }
                    finally
                    {
                        lock (_lock)
                        {
                            _isGenerating = false;
                        }
                    }
                }
                else
                {
                    _logger.LogDebug("Previous data generation still in progress, skipping cycle.");
                }

                await Task.Delay(_interval, stoppingToken);
            }

            _logger.LogInformation("Data Generation Background Service is stopping.");
        }

        private async Task InitializeLastKnownStatusAsync(CancellationToken cancellationToken)
        {
            try
            {
                using (var scope = _serviceScopeFactory.CreateScope())
                {
                    var monitoringService = scope.ServiceProvider.GetRequiredService<IEquipmentMonitoringService>();
                    var equipment = await monitoringService.GetAllEquipmentAsync();

                    foreach (var item in equipment)
                    {
                        _lastKnownStatus[item.Id] = item.Status;
                    }

                    _logger.LogInformation("Initialized status tracking for {Count} equipment items", equipment.Count);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error initializing equipment status tracking");
            }
        }

        private async Task NotifyStatusChangesAsync(CancellationToken cancellationToken)
        {
            try
            {
                using (var scope = _serviceScopeFactory.CreateScope())
                {
                    var monitoringService = scope.ServiceProvider.GetRequiredService<IEquipmentMonitoringService>();

                    // Get all equipment
                    var allEquipment = await monitoringService.GetAllEquipmentAsync();

                    foreach (var equipment in allEquipment)
                    {
                        // Get the current status directly from the monitoring service
                        var currentStatus = await monitoringService.GetEquipmentStatusAsync(equipment.Id);

                        // Check if we have a record of the last status
                        if (_lastKnownStatus.TryGetValue(equipment.Id, out var lastStatus))
                        {
                            // If status has changed, notify clients
                            if (currentStatus != lastStatus)
                            {
                                _logger.LogInformation("Equipment {Id} status changed from {OldStatus} to {NewStatus}",
                                    equipment.Id, lastStatus, currentStatus);

                                // Update the stored status
                                _lastKnownStatus[equipment.Id] = currentStatus;

                                // Create a status update object
                                var statusUpdate = new
                                {
                                    EquipmentId = equipment.Id,
                                    EquipmentName = equipment.Name,
                                    PreviousStatus = lastStatus.ToString(),
                                    CurrentStatus = currentStatus.ToString(),
                                    Timestamp = DateTime.UtcNow
                                };

                                // Notify clients through SignalR
                                await _hubContext.Clients.All.SendAsync("EquipmentStatusChanged",
                                    statusUpdate, cancellationToken);

                                // Also notify the specific equipment group
                                await _hubContext.Clients.Group($"Equipment_{equipment.Id}")
                                    .SendAsync("StatusChanged", statusUpdate, cancellationToken);
                            }
                        }
                        else
                        {
                            // First time seeing this equipment, add it to our tracking
                            _lastKnownStatus[equipment.Id] = currentStatus;
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking equipment status changes");
            }
        }

        public override async Task StopAsync(CancellationToken cancellationToken)
        {
            _logger.LogInformation("Data Generation Background Service is stopping.");

            // Allow any in-progress operation to complete
            while (_isGenerating)
            {
                await Task.Delay(100, cancellationToken);
            }

            await base.StopAsync(cancellationToken);
        }
    }
}
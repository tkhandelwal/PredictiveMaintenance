// PredictiveMaintenance.API/Services/DataGeneration/EnhancedDataGenerationBackgroundService.cs
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using PredictiveMaintenance.API.Hubs;
using PredictiveMaintenance.API.Models;
using PredictiveMaintenance.API.Services.DataGeneration;
using PredictiveMaintenance.API.Services.Monitoring;
using PredictiveMaintenance.API.Services.MachineLearning;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace PredictiveMaintenance.API.Services.DataGeneration
{
    public class EnhancedDataGenerationBackgroundService : BackgroundService
    {
        private readonly ILogger<EnhancedDataGenerationBackgroundService> _logger;
        private readonly ISyntheticDataGenerator _dataGenerator;
        private readonly IHubContext<MonitoringHub> _hubContext;
        private readonly IServiceScopeFactory _serviceScopeFactory;
        private readonly TimeSpan _interval = TimeSpan.FromSeconds(2); // More frequent updates

        // Dictionary to track the last known status of each equipment
        private readonly Dictionary<int, MaintenanceStatus> _lastKnownStatus = new Dictionary<int, MaintenanceStatus>();

        // Keep track of sent readings to avoid duplication
        private readonly HashSet<string> _sentReadingsCache = new HashSet<string>();

        // Cache TTL timer (clear every 5 minutes to prevent unbounded growth)
        private readonly TimeSpan _cacheTtl = TimeSpan.FromMinutes(5);
        private DateTime _lastCacheClear = DateTime.UtcNow;

        // Use object lock to coordinate data generation
        private readonly object _lock = new object();
        private bool _isGenerating = false;
        private int _errorCount = 0;
        private const int _maxErrorsBeforeBackoff = 3;
        private TimeSpan _currentInterval;

        public EnhancedDataGenerationBackgroundService(
            ILogger<EnhancedDataGenerationBackgroundService> logger,
            ISyntheticDataGenerator dataGenerator,
            IHubContext<MonitoringHub> hubContext,
            IServiceScopeFactory serviceScopeFactory)
        {
            _logger = logger;
            _dataGenerator = dataGenerator;
            _hubContext = hubContext;
            _serviceScopeFactory = serviceScopeFactory;
            _currentInterval = _interval;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Enhanced Data Generation Background Service is starting.");

            // Initialize the last known status dictionary
            await InitializeLastKnownStatusAsync(stoppingToken);

            // Periodically train ML models for each equipment
            _ = TrainModelsPeriodicAsync(stoppingToken);

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
                        _logger.LogDebug("Generating synthetic data batch...");

                        // Generate readings for all equipment and sensor types
                        var readings = await _dataGenerator.GenerateBatchReadingsAsync(4);

                        // Send readings to SignalR clients
                        await SendReadingsToClientsAsync(readings, stoppingToken);

                        // Check and notify about equipment status changes
                        await NotifyStatusChangesAsync(stoppingToken);

                        // Reset error count on success
                        _errorCount = 0;

                        // Reset interval if it had been increased
                        if (_currentInterval != _interval)
                        {
                            _currentInterval = _interval;
                            _logger.LogInformation("Resetting data generation interval to normal after successful cycle");
                        }

                        // Clear cache if needed
                        if ((DateTime.UtcNow - _lastCacheClear) > _cacheTtl)
                        {
                            _sentReadingsCache.Clear();
                            _lastCacheClear = DateTime.UtcNow;
                        }
                    }
                    catch (Exception ex)
                    {
                        _errorCount++;
                        _logger.LogError(ex, "Error occurred while generating synthetic data.");

                        // If we've had multiple consecutive errors, back off
                        if (_errorCount >= _maxErrorsBeforeBackoff)
                        {
                            // Double the interval up to a maximum of 30 seconds
                            _currentInterval = TimeSpan.FromSeconds(Math.Min(30, _currentInterval.TotalSeconds * 2));
                            _logger.LogWarning($"Multiple errors detected, backing off to {_currentInterval.TotalSeconds} seconds interval");
                        }
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

                await Task.Delay(_currentInterval, stoppingToken);
            }

            _logger.LogInformation("Enhanced Data Generation Background Service is stopping.");
        }

        private async Task SendReadingsToClientsAsync(List<SensorReading> readings, CancellationToken stoppingToken)
        {
            var tasks = new List<Task>();

            foreach (var reading in readings)
            {
                try
                {
                    // Generate a unique key for this reading
                    string readingKey = $"{reading.EquipmentId}_{reading.SensorType}_{reading.Timestamp.Ticks}_{reading.Value}";

                    // Skip if we've already sent this exact reading
                    if (_sentReadingsCache.Contains(readingKey))
                    {
                        continue;
                    }

                    // Add to cache
                    _sentReadingsCache.Add(readingKey);

                    // Send to specific equipment group
                    tasks.Add(_hubContext.Clients
                        .Group($"Equipment_{reading.EquipmentId}")
                        .SendAsync("ReceiveSensorReading", reading, cancellationToken: stoppingToken));

                    // Check for anomaly using advanced detection
                    if (reading.IsAnomaly)
                    {
                        // Broadcast anomalies to all clients with additional context
                        var anomalyEvent = new
                        {
                            reading.EquipmentId,
                            EquipmentName = GetEquipmentName(reading.EquipmentId),
                            reading.SensorType,
                            reading.Value,
                            reading.Timestamp,
                            reading.IsAnomaly,
                            Severity = CalculateAnomalySeverity(reading),
                            RecommendedAction = GetRecommendedAction(reading)
                        };

                        tasks.Add(_hubContext.Clients.All.SendAsync(
                            "AnomalyDetected", anomalyEvent, cancellationToken: stoppingToken));

                        _logger.LogWarning($"Anomaly detected: {reading.SensorType}={reading.Value} for Equipment {reading.EquipmentId}");
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, $"Failed to send reading for equipment {reading.EquipmentId} to SignalR clients");
                }
            }

            // Wait for all tasks to complete
            if (tasks.Count > 0)
            {
                await Task.WhenAll(tasks);
            }
        }

        private string GetEquipmentName(int equipmentId)
        {
            // This should be implemented to return the actual equipment name
            // For now, just return a placeholder
            return $"Equipment {equipmentId}";
        }

        private string CalculateAnomalySeverity(SensorReading reading)
        {
            // Calculate severity based on sensor type and value
            switch (reading.SensorType.ToLower())
            {
                case "temperature":
                    if (reading.Value > 95) return "High";
                    if (reading.Value > 85) return "Medium";
                    return "Low";

                case "vibration":
                    if (reading.Value > 38) return "High";
                    if (reading.Value > 35) return "Medium";
                    return "Low";

                case "pressure":
                    if (reading.Value > 115) return "High";
                    if (reading.Value > 110) return "Medium";
                    return "Low";

                case "flow":
                    if (reading.Value < 20) return "High";
                    if (reading.Value < 25) return "Medium";
                    return "Low";

                case "rpm":
                    if (reading.Value > 2300) return "High";
                    if (reading.Value > 2200) return "Medium";
                    return "Low";

                default:
                    return "Medium";
            }
        }

        private string GetRecommendedAction(SensorReading reading)
        {
            // Provide intelligent recommendations based on the anomaly
            switch (reading.SensorType.ToLower())
            {
                case "temperature":
                    if (reading.Value > 95) return "Immediate inspection required - risk of overheating";
                    if (reading.Value > 85) return "Schedule inspection within 24 hours";
                    return "Monitor closely for changes";

                case "vibration":
                    if (reading.Value > 38) return "Immediate maintenance required - possible component failure";
                    if (reading.Value > 35) return "Schedule vibration analysis within 48 hours";
                    return "Check mounting and balance";

                case "pressure":
                    if (reading.Value > 115) return "Reduce system pressure immediately";
                    if (reading.Value > 110) return "Inspect pressure relief systems";
                    return "Monitor for pressure fluctuations";

                case "flow":
                    if (reading.Value < 20) return "Check for blockages or valve issues";
                    if (reading.Value < 25) return "Verify pump operation";
                    return "Monitor system intake";

                case "rpm":
                    if (reading.Value > 2300) return "Reduce speed immediately - risk of mechanical failure";
                    if (reading.Value > 2200) return "Inspect drive system";
                    return "Verify control system operation";

                default:
                    return "Investigate cause of anomaly";
            }
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

                                // Create a status update object with rich context
                                var statusUpdate = new
                                {
                                    EquipmentId = equipment.Id,
                                    EquipmentName = equipment.Name,
                                    PreviousStatus = lastStatus.ToString(),
                                    CurrentStatus = currentStatus.ToString(),
                                    Timestamp = DateTime.UtcNow,
                                    IsEscalation = IsStatusEscalation(lastStatus, currentStatus),
                                    RecommendedAction = GetStatusChangeRecommendation(lastStatus, currentStatus, equipment)
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

        private bool IsStatusEscalation(MaintenanceStatus previousStatus, MaintenanceStatus currentStatus)
        {
            // Consider it an escalation if the status is getting worse
            return (int)currentStatus > (int)previousStatus &&
                   currentStatus != MaintenanceStatus.UnderMaintenance;
        }

        private string GetStatusChangeRecommendation(MaintenanceStatus previousStatus,
                                                 MaintenanceStatus currentStatus,
                                                 Equipment equipment)
        {
            // Provide intelligent recommendations based on status changes
            if (currentStatus == MaintenanceStatus.Critical &&
                previousStatus != MaintenanceStatus.Critical)
            {
                return "Immediate inspection required - equipment in critical condition";
            }

            if (currentStatus == MaintenanceStatus.Warning &&
                previousStatus == MaintenanceStatus.Operational)
            {
                return "Schedule maintenance within 48 hours";
            }

            if (currentStatus == MaintenanceStatus.Operational &&
                previousStatus != MaintenanceStatus.Operational)
            {
                return "Equipment returned to normal operation - verify performance";
            }

            if (currentStatus == MaintenanceStatus.UnderMaintenance)
            {
                return "Equipment is under maintenance - update maintenance logs when complete";
            }

            // Default recommendation
            return "Monitor equipment status for further changes";
        }

        private async Task TrainModelsPeriodicAsync(CancellationToken stoppingToken)
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    _logger.LogInformation("Starting periodic training of ML models...");

                    using (var scope = _serviceScopeFactory.CreateScope())
                    {
                        var equipment = await scope.ServiceProvider
                            .GetRequiredService<IEquipmentMonitoringService>()
                            .GetAllEquipmentAsync();

                        var anomalyService = scope.ServiceProvider
                            .GetRequiredService<IAdvancedAnomalyDetectionService>();

                        foreach (var item in equipment)
                        {
                            await anomalyService.TrainModelsAsync(item.Id);
                        }
                    }

                    _logger.LogInformation("Completed periodic training of ML models");
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error during periodic ML model training");
                }

                // Train once every 6 hours
                await Task.Delay(TimeSpan.FromHours(6), stoppingToken);
            }
        }

        public override async Task StopAsync(CancellationToken cancellationToken)
        {
            _logger.LogInformation("Enhanced Data Generation Background Service is stopping.");

            // Allow any in-progress operation to complete
            while (_isGenerating)
            {
                await Task.Delay(100, cancellationToken);
            }

            await base.StopAsync(cancellationToken);
        }
    }
}
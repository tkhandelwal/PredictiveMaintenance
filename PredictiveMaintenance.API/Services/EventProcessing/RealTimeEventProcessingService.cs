using MediatR;
using Microsoft.AspNetCore.SignalR;
using PredictiveMaintenance.API.Events;
using PredictiveMaintenance.API.Hubs;
using PredictiveMaintenance.API.Models;
using System.Collections.Concurrent;
using System.Reactive.Linq;
using System.Reactive.Subjects;
using System.Threading.Channels;

namespace PredictiveMaintenance.API.Services.EventProcessing
{
    public interface IRealTimeEventProcessingService
    {
        Task ProcessSensorDataAsync(SensorReading reading);
        Task ProcessEquipmentEventAsync(EquipmentEvent equipmentEvent);
        Task<EventStreamAnalysis> AnalyzeEventStreamAsync(int equipmentId, TimeSpan window);
        Task RegisterEventHandlerAsync(string eventType, Func<IEvent, Task> handler);
        Task<List<EventCorrelation>> CorrelateEventsAsync(DateTime from, DateTime to);
        Task<ComplexEventPattern> DetectComplexEventPatternAsync(List<IEvent> events);
    }

    public class RealTimeEventProcessingService : IRealTimeEventProcessingService
    {
        private readonly ILogger<RealTimeEventProcessingService> _logger;
        private readonly IMediator _mediator;
        private readonly IHubContext<MonitoringHub> _monitoringHub;
        private readonly IHubContext<EquipmentHub> _equipmentHub;
        private readonly IServiceScopeFactory _serviceScopeFactory;

        // Event streams
        private readonly Subject<SensorReading> _sensorDataStream;
        private readonly Subject<EquipmentEvent> _equipmentEventStream;
        private readonly Subject<Anomaly> _anomalyStream;
        private readonly Subject<Alert> _alertStream;

        // Event processing
        private readonly Channel<IEvent> _eventQueue;
        private readonly ConcurrentDictionary<string, List<Func<IEvent, Task>>> _eventHandlers;
        private readonly ConcurrentDictionary<int, EquipmentEventWindow> _eventWindows;
        private readonly ConcurrentDictionary<string, EventPattern> _eventPatterns;

        // Complex event processing
        private readonly ConcurrentDictionary<string, ComplexEventProcessor> _complexProcessors;
        private readonly ConcurrentDictionary<string, EventCorrelationRule> _correlationRules;

        // Performance tracking
        private readonly ConcurrentDictionary<string, EventProcessingMetrics> _metrics;

        public RealTimeEventProcessingService(
            ILogger<RealTimeEventProcessingService> logger,
            IMediator mediator,
            IHubContext<MonitoringHub> monitoringHub,
            IHubContext<EquipmentHub> equipmentHub,
            IServiceScopeFactory serviceScopeFactory)
        {
            _logger = logger;
            _mediator = mediator;
            _monitoringHub = monitoringHub;
            _equipmentHub = equipmentHub;
            _serviceScopeFactory = serviceScopeFactory;

            _sensorDataStream = new Subject<SensorReading>();
            _equipmentEventStream = new Subject<EquipmentEvent>();
            _anomalyStream = new Subject<Anomaly>();
            _alertStream = new Subject<Alert>();

            _eventQueue = Channel.CreateUnbounded<IEvent>();
            _eventHandlers = new ConcurrentDictionary<string, List<Func<IEvent, Task>>>();
            _eventWindows = new ConcurrentDictionary<int, EquipmentEventWindow>();
            _eventPatterns = new ConcurrentDictionary<string, EventPattern>();
            _complexProcessors = new ConcurrentDictionary<string, ComplexEventProcessor>();
            _correlationRules = new ConcurrentDictionary<string, EventCorrelationRule>();
            _metrics = new ConcurrentDictionary<string, EventProcessingMetrics>();

            InitializeEventProcessing();
            InitializeComplexEventProcessing();
            SetupEventStreams();
        }

        public async Task ProcessSensorDataAsync(SensorReading reading)
        {
            try
            {
                var startTime = DateTime.UtcNow;

                // Update metrics
                IncrementEventCount("SensorReading");

                // Publish to stream
                _sensorDataStream.OnNext(reading);

                // Check for immediate alerts
                await CheckImmediateAlertsAsync(reading);

                // Update event window
                UpdateEventWindow(reading.EquipmentId, new SensorDataEvent(reading));

                // Process through event queue
                await _eventQueue.Writer.WriteAsync(new SensorDataEvent(reading));

                // Update processing time
                UpdateProcessingTime("SensorReading", DateTime.UtcNow - startTime);

            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error processing sensor data for equipment {reading.EquipmentId}");
                IncrementErrorCount("SensorReading");
            }
        }

        public async Task ProcessEquipmentEventAsync(EquipmentEvent equipmentEvent)
        {
            try
            {
                var startTime = DateTime.UtcNow;

                // Update metrics
                IncrementEventCount(equipmentEvent.EventType);

                // Publish to stream
                _equipmentEventStream.OnNext(equipmentEvent);

                // Update event window
                UpdateEventWindow(equipmentEvent.EquipmentId, equipmentEvent);

                // Check for patterns
                await DetectEventPatternsAsync(equipmentEvent);

                // Process through event queue
                await _eventQueue.Writer.WriteAsync(equipmentEvent);

                // Notify connected clients
                await NotifyClientsAsync(equipmentEvent);

                // Update processing time
                UpdateProcessingTime(equipmentEvent.EventType, DateTime.UtcNow - startTime);

            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error processing equipment event for equipment {equipmentEvent.EquipmentId}");
                IncrementErrorCount(equipmentEvent.EventType);
            }
        }

        public async Task<EventStreamAnalysis> AnalyzeEventStreamAsync(int equipmentId, TimeSpan window)
        {
            var analysis = new EventStreamAnalysis
            {
                EquipmentId = equipmentId,
                AnalysisWindow = window,
                AnalysisTime = DateTime.UtcNow
            };

            try
            {
                // Get events in window
                var events = GetEventsInWindow(equipmentId, window);

                // Basic statistics
                analysis.TotalEvents = events.Count;
                analysis.EventsByType = events.GroupBy(e => e.GetType().Name)
                    .ToDictionary(g => g.Key, g => g.Count());

                // Event rate analysis
                analysis.EventRate = CalculateEventRate(events, window);
                analysis.PeakEventRate = CalculatePeakEventRate(events);

                // Pattern detection
                analysis.DetectedPatterns = await DetectPatternsInWindowAsync(events);

                // Anomaly detection
                analysis.AnomalousEvents = DetectAnomalousEvents(events);

                // Correlation analysis
                analysis.EventCorrelations = await AnalyzeEventCorrelationsAsync(events);

                // Trend analysis
                analysis.Trends = AnalyzeEventTrends(events, window);

                // Risk assessment
                analysis.RiskScore = CalculateEventRiskScore(events);

                // Predictions
                analysis.PredictedEvents = await PredictUpcomingEventsAsync(equipmentId, events);

                return analysis;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error analyzing event stream for equipment {equipmentId}");
                throw;
            }
        }

        public async Task RegisterEventHandlerAsync(string eventType, Func<IEvent, Task> handler)
        {
            _eventHandlers.AddOrUpdate(eventType,
                new List<Func<IEvent, Task>> { handler },
                (key, list) =>
                {
                    list.Add(handler);
                    return list;
                });

            _logger.LogInformation($"Registered event handler for {eventType}");
            await Task.CompletedTask;
        }

        public async Task<List<EventCorrelation>> CorrelateEventsAsync(DateTime from, DateTime to)
        {
            var correlations = new List<EventCorrelation>();

            try
            {
                // Get all events in time range
                var events = await GetEventsInTimeRangeAsync(from, to);

                // Group by equipment
                var equipmentGroups = events.GroupBy(e => e.EquipmentId);

                foreach (var group in equipmentGroups)
                {
                    var equipmentEvents = group.OrderBy(e => e.Timestamp).ToList();

                    // Apply correlation rules
                    foreach (var rule in _correlationRules.Values)
                    {
                        var ruleCorrelations = await ApplyCorrelationRuleAsync(rule, equipmentEvents);
                        correlations.AddRange(ruleCorrelations);
                    }

                    // Statistical correlation
                    var statCorrelations = await PerformStatisticalCorrelationAsync(equipmentEvents);
                    correlations.AddRange(statCorrelations);

                    // Temporal correlation
                    var tempCorrelations = await PerformTemporalCorrelationAsync(equipmentEvents);
                    correlations.AddRange(tempCorrelations);
                }

                // Cross-equipment correlations
                var crossCorrelations = await FindCrossEquipmentCorrelationsAsync(events);
                correlations.AddRange(crossCorrelations);

                return correlations.OrderByDescending(c => c.CorrelationStrength).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error correlating events");
                throw;
            }
        }

        public async Task<ComplexEventPattern> DetectComplexEventPatternAsync(List<IEvent> events)
        {
            var pattern = new ComplexEventPattern
            {
                DetectionTime = DateTime.UtcNow
            };

            try
            {
                // Apply each complex event processor
                foreach (var processor in _complexProcessors.Values)
                {
                    var detectedPatterns = await processor.ProcessEventsAsync(events);
                    pattern.DetectedSequences.AddRange(detectedPatterns);
                }

                // Analyze pattern characteristics
                pattern.PatternType = DeterminePatternType(pattern.DetectedSequences);
                pattern.Confidence = CalculatePatternConfidence(pattern.DetectedSequences);
                pattern.Severity = CalculatePatternSeverity(pattern.DetectedSequences);

                // Generate insights
                pattern.Insights = GeneratePatternInsights(pattern);

                // Predict next events
                pattern.PredictedNextEvents = await PredictNextEventsInPatternAsync(pattern);

                return pattern;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error detecting complex event pattern");
                throw;
            }
        }

        // Private methods

        private void InitializeEventProcessing()
        {
            // Start event processing task
            Task.Run(async () => await ProcessEventQueueAsync());

            // Initialize default event handlers
            RegisterDefaultEventHandlers();

            // Initialize correlation rules
            LoadCorrelationRules();

            // Start metrics collection
            Task.Run(async () => await CollectMetricsAsync());
        }

        private void InitializeComplexEventProcessing()
        {
            // Cascade failure detection
            _complexProcessors["CascadeFailure"] = new CascadeFailureProcessor(_logger);

            // Performance degradation detection
            _complexProcessors["PerformanceDegradation"] = new PerformanceDegradationProcessor(_logger);

            // Maintenance window detection
            _complexProcessors["MaintenanceWindow"] = new MaintenanceWindowProcessor(_logger);

            // Energy anomaly detection
            _complexProcessors["EnergyAnomaly"] = new EnergyAnomalyProcessor(_logger);
        }

        private void SetupEventStreams()
        {
            // Sensor data stream processing
            _sensorDataStream
                .Buffer(TimeSpan.FromSeconds(5))
                .Where(buffer => buffer.Count > 0)
                .Subscribe(async buffer =>
                {
                    await ProcessSensorDataBatchAsync(buffer.ToList());
                });

            // Anomaly detection on sensor stream
            _sensorDataStream
                .Where(reading => reading.IsAnomaly)
                .Subscribe(async reading =>
                {
                    var anomaly = new Anomaly
                    {
                        EquipmentId = reading.EquipmentId,
                        SensorType = reading.SensorType,
                        Value = reading.Value,
                        DetectedAt = reading.Timestamp,
                        Severity = "Medium"
                    };

                    _anomalyStream.OnNext(anomaly);
                    await ProcessAnomalyAsync(anomaly);
                });

            // Alert aggregation
            _alertStream
                .GroupBy(alert => alert.EquipmentId)
                .Subscribe(group =>
                {
                    group.Buffer(TimeSpan.FromMinutes(1))
                        .Where(buffer => buffer.Count > 0)
                        .Subscribe(async buffer =>
                        {
                            await ProcessAlertBatchAsync(group.Key, buffer.ToList());
                        });
                });

            // Complex event detection on equipment events
            _equipmentEventStream
                .Window(TimeSpan.FromMinutes(5))
                .Subscribe(async window =>
                {
                    var events = new List<EquipmentEvent>();
                    window.Subscribe(e => events.Add(e));

                    await Task.Delay(TimeSpan.FromMinutes(5));
                    if (events.Any())
                    {
                        await DetectComplexEventPatternAsync(events.Cast<IEvent>().ToList());
                    }
                });
        }

        private async Task ProcessEventQueueAsync()
        {
            await foreach (var evt in _eventQueue.Reader.ReadAllAsync())
            {
                try
                {
                    // Get handlers for event type
                    var eventType = evt.GetType().Name;

                    if (_eventHandlers.TryGetValue(eventType, out var handlers))
                    {
                        // Execute handlers in parallel
                        var tasks = handlers.Select(handler => handler(evt));
                        await Task.WhenAll(tasks);
                    }

                    // Store event for analysis
                    await StoreEventAsync(evt);

                    // Update real-time analytics
                    await UpdateRealTimeAnalyticsAsync(evt);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, $"Error processing event from queue: {evt.GetType().Name}");
                }
            }
        }

        private void RegisterDefaultEventHandlers()
        {
            // Sensor data handler
            RegisterEventHandlerAsync("SensorDataEvent", async evt =>
            {
                if (evt is SensorDataEvent sensorEvent)
                {
                    await HandleSensorDataEventAsync(sensorEvent);
                }
            });

            // Anomaly handler
            RegisterEventHandlerAsync("AnomalyEvent", async evt =>
            {
                if (evt is AnomalyEvent anomalyEvent)
                {
                    await HandleAnomalyEventAsync(anomalyEvent);
                }
            });

            // Maintenance handler
            RegisterEventHandlerAsync("MaintenanceEvent", async evt =>
            {
                if (evt is MaintenanceEvent maintenanceEvent)
                {
                    await HandleMaintenanceEventAsync(maintenanceEvent);
                }
            });

            // Alert handler
            RegisterEventHandlerAsync("AlertEvent", async evt =>
            {
                if (evt is AlertEvent alertEvent)
                {
                    await HandleAlertEventAsync(alertEvent);
                }
            });
        }

        private void LoadCorrelationRules()
        {
            // Temperature-Vibration correlation
            _correlationRules["TempVibration"] = new EventCorrelationRule
            {
                Name = "Temperature-Vibration Correlation",
                EventTypes = new[] { "TemperatureReading", "VibrationReading" },
                TimeWindow = TimeSpan.FromMinutes(5),
                CorrelationFunction = events => CalculateTemperatureVibrationCorrelation(events)
            };

            // Cascade failure detection
            _correlationRules["CascadeFailure"] = new EventCorrelationRule
            {
                Name = "Cascade Failure Detection",
                EventTypes = new[] { "EquipmentFailure", "AnomalyDetected" },
                TimeWindow = TimeSpan.FromMinutes(30),
                CorrelationFunction = events => DetectCascadeFailurePattern(events)
            };

            // Load-Power correlation
            _correlationRules["LoadPower"] = new EventCorrelationRule
            {
                Name = "Load-Power Consumption Correlation",
                EventTypes = new[] { "LoadChange", "PowerReading" },
                TimeWindow = TimeSpan.FromMinutes(15),
                CorrelationFunction = events => CalculateLoadPowerCorrelation(events)
            };
        }

        private void UpdateEventWindow(int equipmentId, IEvent evt)
        {
            var window = _eventWindows.GetOrAdd(equipmentId, id => new EquipmentEventWindow(id));
            window.AddEvent(evt);

            // Clean old events
            window.RemoveOldEvents(TimeSpan.FromHours(24));
        }

        private async Task CheckImmediateAlertsAsync(SensorReading reading)
        {
            // Critical thresholds
            var thresholds = GetCriticalThresholds(reading.EquipmentId, reading.SensorType);

            if (reading.Value > thresholds.Critical)
            {
                var alert = new Alert
                {
                    EquipmentId = reading.EquipmentId,
                    AlertType = "CriticalThreshold",
                    Severity = "Critical",
                    Message = $"{reading.SensorType} reading ({reading.Value}) exceeds critical threshold ({thresholds.Critical})",
                    Timestamp = DateTime.UtcNow
                };

                _alertStream.OnNext(alert);
                await SendImmediateAlertAsync(alert);
            }
        }

        private async Task DetectEventPatternsAsync(EquipmentEvent equipmentEvent)
        {
            var window = _eventWindows.GetOrAdd(equipmentEvent.EquipmentId, id => new EquipmentEventWindow(id));
            var recentEvents = window.GetRecentEvents(TimeSpan.FromHours(1));

            foreach (var pattern in _eventPatterns.Values)
            {
                if (pattern.Matches(recentEvents))
                {
                    await HandleDetectedPatternAsync(pattern, equipmentEvent);
                }
            }
        }

        private async Task NotifyClientsAsync(EquipmentEvent equipmentEvent)
        {
            var notification = new EventNotification
            {
                EventId = equipmentEvent.EventId,
                EquipmentId = equipmentEvent.EquipmentId,
                EventType = equipmentEvent.EventType,
                Severity = equipmentEvent.Severity,
                Message = equipmentEvent.Description,
                Timestamp = equipmentEvent.Timestamp
            };

            // Notify monitoring hub
            await _monitoringHub.Clients.All.SendAsync("EquipmentEvent", notification);

            // Notify equipment-specific group
            await _equipmentHub.Clients.Group($"equipment-{equipmentEvent.EquipmentId}")
                .SendAsync("EquipmentEvent", notification);
        }

        private void IncrementEventCount(string eventType)
        {
            var metrics = _metrics.GetOrAdd(eventType, type => new EventProcessingMetrics { EventType = type });
            Interlocked.Increment(ref metrics.EventCount);
        }

        private void IncrementErrorCount(string eventType)
        {
            var metrics = _metrics.GetOrAdd(eventType, type => new EventProcessingMetrics { EventType = type });
            Interlocked.Increment(ref metrics.ErrorCount);
        }

        private void UpdateProcessingTime(string eventType, TimeSpan processingTime)
        {
            var metrics = _metrics.GetOrAdd(eventType, type => new EventProcessingMetrics { EventType = type });
            metrics.UpdateProcessingTime(processingTime);
        }

        private async Task CollectMetricsAsync()
        {
            while (true)
            {
                try
                {
                    await Task.Delay(TimeSpan.FromMinutes(1));

                    foreach (var (eventType, metrics) in _metrics)
                    {
                        _logger.LogInformation($"Event metrics for {eventType}: " +
                            $"Count={metrics.EventCount}, " +
                            $"Errors={metrics.ErrorCount}, " +
                            $"AvgProcessingTime={metrics.AverageProcessingTime.TotalMilliseconds}ms");

                        // Reset counters
                        metrics.Reset();
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error collecting event processing metrics");
                }
            }
        }

        // Additional helper methods would be implemented here...
    }

    // Supporting classes
    public interface IEvent
    {
        string EventId { get; }
        int EquipmentId { get; }
        DateTime Timestamp { get; }
        string EventType { get; }
    }

    public class EquipmentEvent : IEvent
    {
        public string EventId { get; set; } = Guid.NewGuid().ToString();
        public int EquipmentId { get; set; }
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
        public string EventType { get; set; } = "";
        public string Severity { get; set; } = "";
        public string Description { get; set; } = "";
        public Dictionary<string, object> Properties { get; set; } = new();
    }

    public class SensorDataEvent : IEvent
    {
        public string EventId { get; set; } = Guid.NewGuid().ToString();
        public int EquipmentId { get; set; }
        public DateTime Timestamp { get; set; }
        public string EventType => "SensorData";
        public SensorReading Reading { get; set; }

        public SensorDataEvent(SensorReading reading)
        {
            Reading = reading;
            EquipmentId = reading.EquipmentId;
            Timestamp = reading.Timestamp;
        }
    }

    public class Alert
    {
        public int EquipmentId { get; set; }
        public string AlertType { get; set; } = "";
        public string Severity { get; set; } = "";
        public string Message { get; set; } = "";
        public DateTime Timestamp { get; set; }
    }

    public class EventStreamAnalysis
    {
        public int EquipmentId { get; set; }
        public TimeSpan AnalysisWindow { get; set; }
        public DateTime AnalysisTime { get; set; }
        public int TotalEvents { get; set; }
        public Dictionary<string, int> EventsByType { get; set; } = new();
        public double EventRate { get; set; }
        public double PeakEventRate { get; set; }
        public List<EventPattern> DetectedPatterns { get; set; } = new();
        public List<IEvent> AnomalousEvents { get; set; } = new();
        public List<EventCorrelation> EventCorrelations { get; set; } = new();
        public EventTrends Trends { get; set; } = new();
        public double RiskScore { get; set; }
        public List<PredictedEvent> PredictedEvents { get; set; } = new();
    }

    public class EventCorrelation
    {
        public List<IEvent> CorrelatedEvents { get; set; } = new();
        public double CorrelationStrength { get; set; }
        public string CorrelationType { get; set; } = "";
        public TimeSpan TimeLag { get; set; }
        public string Description { get; set; } = "";
    }

    public class ComplexEventPattern
    {
        public DateTime DetectionTime { get; set; }
        public List<EventSequence> DetectedSequences { get; set; } = new();
        public string PatternType { get; set; } = "";
        public double Confidence { get; set; }
        public string Severity { get; set; } = "";
        public List<string> Insights { get; set; } = new();
        public List<PredictedEvent> PredictedNextEvents { get; set; } = new();
    }

    public class EventPattern
    {
        public string PatternId { get; set; } = "";
        public string Name { get; set; } = "";
        public List<string> RequiredEventTypes { get; set; } = new();
        public TimeSpan TimeWindow { get; set; }
        public Func<List<IEvent>, bool> MatchFunction { get; set; } = _ => false;

        public bool Matches(List<IEvent> events)
        {
            return MatchFunction(events);
        }
    }

    public class EquipmentEventWindow
    {
        private readonly int _equipmentId;
        private readonly List<IEvent> _events;
        private readonly object _lock = new object();

        public EquipmentEventWindow(int equipmentId)
        {
            _equipmentId = equipmentId;
            _events = new List<IEvent>();
        }

        public void AddEvent(IEvent evt)
        {
            lock (_lock)
            {
                _events.Add(evt);
            }
        }

        public List<IEvent> GetRecentEvents(TimeSpan window)
        {
            lock (_lock)
            {
                var cutoff = DateTime.UtcNow - window;
                return _events.Where(e => e.Timestamp >= cutoff).ToList();
            }
        }

        public void RemoveOldEvents(TimeSpan retention)
        {
            lock (_lock)
            {
                var cutoff = DateTime.UtcNow - retention;
                _events.RemoveAll(e => e.Timestamp < cutoff);
            }
        }
    }

    public class EventProcessingMetrics
    {
        public string EventType { get; set; } = "";
        public long EventCount;
        public long ErrorCount;
        private readonly List<double> _processingTimes = new();
        private readonly object _lock = new object();

        public TimeSpan AverageProcessingTime
        {
            get
            {
                lock (_lock)
                {
                    return _processingTimes.Any()
                        ? TimeSpan.FromMilliseconds(_processingTimes.Average())
                        : TimeSpan.Zero;
                }
            }
        }

        public void UpdateProcessingTime(TimeSpan time)
        {
            lock (_lock)
            {
                _processingTimes.Add(time.TotalMilliseconds);
                if (_processingTimes.Count > 1000)
                {
                    _processingTimes.RemoveAt(0);
                }
            }
        }

        public void Reset()
        {
            Interlocked.Exchange(ref EventCount, 0);
            Interlocked.Exchange(ref ErrorCount, 0);
        }
    }

    public class ComplexEventProcessor
    {
        protected readonly ILogger _logger;

        public ComplexEventProcessor(ILogger logger)
        {
            _logger = logger;
        }

        public virtual Task<List<EventSequence>> ProcessEventsAsync(List<IEvent> events)
        {
            return Task.FromResult(new List<EventSequence>());
        }
    }

    public class CascadeFailureProcessor : ComplexEventProcessor
    {
        public CascadeFailureProcessor(ILogger logger) : base(logger) { }

        public override async Task<List<EventSequence>> ProcessEventsAsync(List<IEvent> events)
        {
            var sequences = new List<EventSequence>();

            // Implement cascade failure detection logic
            await Task.CompletedTask;

            return sequences;
        }
    }

    public class EventCorrelationRule
    {
        public string Name { get; set; } = "";
        public string[] EventTypes { get; set; } = Array.Empty<string>();
        public TimeSpan TimeWindow { get; set; }
        public Func<List<IEvent>, double> CorrelationFunction { get; set; } = _ => 0;
    }

    public class EventSequence
    {
        public List<IEvent> Events { get; set; } = new();
        public string SequenceType { get; set; } = "";
        public double Confidence { get; set; }
    }

    public class PredictedEvent
    {
        public string EventType { get; set; } = "";
        public DateTime PredictedTime { get; set; }
        public double Probability { get; set; }
        public string Description { get; set; } = "";
    }

    public class EventTrends
    {
        public string TrendDirection { get; set; } = "";
        public double TrendStrength { get; set; }
        public Dictionary<string, double> EventTypeGrowthRates { get; set; } = new();
    }

    public class EventNotification
    {
        public string EventId { get; set; } = "";
        public int EquipmentId { get; set; }
        public string EventType { get; set; } = "";
        public string Severity { get; set; } = "";
        public string Message { get; set; } = "";
        public DateTime Timestamp { get; set; }
    }

    // Additional processors
    public class PerformanceDegradationProcessor : ComplexEventProcessor
    {
        public PerformanceDegradationProcessor(ILogger logger) : base(logger) { }
    }

    public class MaintenanceWindowProcessor : ComplexEventProcessor
    {
        public MaintenanceWindowProcessor(ILogger logger) : base(logger) { }
    }

    public class EnergyAnomalyProcessor : ComplexEventProcessor
    {
        public EnergyAnomalyProcessor(ILogger logger) : base(logger) { }
    }
}
using Microsoft.AspNetCore.Mvc;
using PredictiveMaintenance.API.Services.Monitoring;
using PredictiveMaintenance.API.Services.MachineLearning;

namespace PredictiveMaintenance.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class MonitoringController : ControllerBase
    {
        private readonly IEquipmentMonitoringService _monitoringService;
        private readonly IAdvancedAnomalyDetectionService _anomalyService;
        private readonly ILogger<MonitoringController> _logger;

        public MonitoringController(
            IEquipmentMonitoringService monitoringService,
            IAdvancedAnomalyDetectionService anomalyService,
            ILogger<MonitoringController> logger)
        {
            _monitoringService = monitoringService;
            _anomalyService = anomalyService;
            _logger = logger;
        }

        [HttpPost("{equipmentId}/start")]
        public async Task<ActionResult> StartMonitoring(int equipmentId)
        {
            try
            {
                await _monitoringService.StartMonitoringAsync(equipmentId);
                return Ok(new { Message = $"Monitoring started for equipment {equipmentId}" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error starting monitoring for equipment {equipmentId}");
                return StatusCode(500, "Error starting monitoring");
            }
        }

        [HttpPost("{equipmentId}/stop")]
        public async Task<ActionResult> StopMonitoring(int equipmentId)
        {
            try
            {
                await _monitoringService.StopMonitoringAsync(equipmentId);
                return Ok(new { Message = $"Monitoring stopped for equipment {equipmentId}" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error stopping monitoring for equipment {equipmentId}");
                return StatusCode(500, "Error stopping monitoring");
            }
        }

        [HttpGet("{equipmentId}/status")]
        public async Task<ActionResult<object>> GetMonitoringStatus(int equipmentId)
        {
            try
            {
                var isMonitoring = await _monitoringService.IsMonitoringAsync(equipmentId);
                var status = await _monitoringService.GetEquipmentStatusAsync(equipmentId);

                return Ok(new
                {
                    EquipmentId = equipmentId,
                    IsMonitoring = isMonitoring,
                    Status = status.ToString(),
                    Timestamp = DateTime.UtcNow
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error getting monitoring status for equipment {equipmentId}");
                return StatusCode(500, "Error retrieving monitoring status");
            }
        }

        [HttpGet("dashboard")]
        public async Task<ActionResult<MonitoringDashboard>> GetDashboard()
        {
            try
            {
                var dashboard = await _monitoringService.GetMonitoringDashboardAsync();
                return Ok(dashboard);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting monitoring dashboard");
                return StatusCode(500, "Error retrieving dashboard");
            }
        }

        [HttpGet("{equipmentId}/health")]
        public async Task<ActionResult<EquipmentHealth>> GetEquipmentHealth(int equipmentId)
        {
            try
            {
                var health = await _monitoringService.GetEquipmentHealthAsync(equipmentId);
                return Ok(health);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error getting health for equipment {equipmentId}");
                return StatusCode(500, "Error retrieving equipment health");
            }
        }

        [HttpGet("alerts")]
        public async Task<ActionResult<List<MonitoringAlert>>> GetActiveAlerts([FromQuery] int? equipmentId = null)
        {
            try
            {
                var alerts = await _monitoringService.GetActiveAlertsAsync(equipmentId);
                return Ok(alerts);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting active alerts");
                return StatusCode(500, "Error retrieving alerts");
            }
        }

        [HttpPost("alerts/{alertId}/acknowledge")]
        public async Task<ActionResult> AcknowledgeAlert(int alertId, [FromBody] AcknowledgeRequest request)
        {
            try
            {
                await _monitoringService.AcknowledgeAlertAsync(alertId, request.AcknowledgedBy);
                return Ok(new { Message = "Alert acknowledged successfully" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error acknowledging alert {alertId}");
                return StatusCode(500, "Error acknowledging alert");
            }
        }

        [HttpPost("{equipmentId}/anomaly-report")]
        public async Task<ActionResult<AnomalyReport>> GenerateAnomalyReport(
            int equipmentId,
            [FromBody] ReportRequest request)
        {
            try
            {
                var report = await _anomalyService.GenerateAnomalyReportAsync(
                    equipmentId,
                    request.From,
                    request.To);
                return Ok(report);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error generating anomaly report for equipment {equipmentId}");
                return StatusCode(500, "Error generating report");
            }
        }
    }

    public class AcknowledgeRequest
    {
        public string AcknowledgedBy { get; set; } = "";
    }

    public class ReportRequest
    {
        public DateTime From { get; set; }
        public DateTime To { get; set; }
    }
}
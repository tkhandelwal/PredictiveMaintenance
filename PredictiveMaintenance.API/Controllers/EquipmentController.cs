using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using PredictiveMaintenance.API.Hubs;
using PredictiveMaintenance.API.Models;
using PredictiveMaintenance.API.Services;
using PredictiveMaintenance.API.Services.DataGeneration;
using PredictiveMaintenance.API.Services.Monitoring;

namespace PredictiveMaintenance.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class EquipmentController : ControllerBase
    {
        private readonly IEquipmentMonitoringService _monitoringService;
        private readonly IEquipmentService _equipmentService;
        private readonly IHubContext<MonitoringHub> _hubContext;
        private readonly ISyntheticDataGenerator _dataGenerator;
        private readonly ILogger<EquipmentController> _logger;

        public EquipmentController(
            IEquipmentMonitoringService monitoringService,
            IEquipmentService equipmentService,
            IHubContext<MonitoringHub> hubContext,
            ISyntheticDataGenerator dataGenerator,
            ILogger<EquipmentController> logger)
        {
            _monitoringService = monitoringService;
            _equipmentService = equipmentService;
            _hubContext = hubContext;
            _dataGenerator = dataGenerator;
            _logger = logger;
        }

        [HttpGet]
        public async Task<ActionResult<List<Equipment>>> GetAll()
        {
            try
            {
                var equipment = await _equipmentService.GetAllEquipmentAsync();
                return Ok(equipment);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving equipment");
                return StatusCode(500, "Internal server error");
            }
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Equipment>> GetById(int id)
        {
            try
            {
                var equipment = await _equipmentService.GetEquipmentByIdAsync(id);
                if (equipment == null)
                {
                    return NotFound($"Equipment with ID {id} not found");
                }
                return Ok(equipment);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error retrieving equipment {id}");
                return StatusCode(500, "Internal server error");
            }
        }

        [HttpGet("site/{siteId}")]
        public async Task<ActionResult<List<Equipment>>> GetBySite(string siteId)
        {
            try
            {
                var equipment = await _equipmentService.GetEquipmentBySiteAsync(siteId);
                return Ok(equipment);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error retrieving equipment for site {siteId}");
                return StatusCode(500, "Internal server error");
            }
        }

        [HttpGet("critical")]
        public async Task<ActionResult<List<Equipment>>> GetCritical()
        {
            try
            {
                var equipment = await _equipmentService.GetCriticalEquipmentAsync();
                return Ok(equipment);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving critical equipment");
                return StatusCode(500, "Internal server error");
            }
        }

        [HttpGet("{id}/metrics")]
        public async Task<ActionResult<Dictionary<string, object>>> GetMetrics(int id)
        {
            try
            {
                var metrics = await _equipmentService.GetEquipmentMetricsAsync(id);
                return Ok(metrics);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error retrieving metrics for equipment {id}");
                return StatusCode(500, "Internal server error");
            }
        }

        [HttpGet("{id}/recommendations")]
        public async Task<ActionResult<List<MaintenanceRecommendation>>> GetRecommendations(int id)
        {
            try
            {
                var recommendations = await _equipmentService.GetMaintenanceRecommendationsAsync(id);
                return Ok(recommendations);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error retrieving recommendations for equipment {id}");
                return StatusCode(500, "Internal server error");
            }
        }

        [HttpGet("{id}/status")]
        public async Task<ActionResult<MaintenanceStatus>> GetEquipmentStatus(int id)
        {
            var equipment = await _monitoringService.GetEquipmentByIdAsync(id);

            if (equipment == null)
            {
                return NotFound();
            }

            var status = await _monitoringService.GetEquipmentStatusAsync(id);
            return Ok(status);
        }

        [HttpGet("{id}/readings")]
        public async Task<ActionResult<IEnumerable<SensorReading>>> GetEquipmentReadings(int id, [FromQuery] int limit = 50)
        {
            var equipment = await _monitoringService.GetEquipmentByIdAsync(id);

            if (equipment == null)
            {
                return NotFound();
            }

            var readings = await _monitoringService.GetLatestReadingsForEquipmentAsync(id, limit);
            return Ok(readings);
        }

        [HttpPost]
        public async Task<ActionResult<Equipment>> Create(Equipment equipment)
        {
            try
            {
                var created = await _equipmentService.CreateEquipmentAsync(equipment);
                return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating equipment");
                return StatusCode(500, "Internal server error");
            }
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<Equipment>> Update(int id, Equipment equipment)
        {
            try
            {
                var updated = await _equipmentService.UpdateEquipmentAsync(id, equipment);
                if (updated == null)
                {
                    return NotFound($"Equipment with ID {id} not found");
                }
                return Ok(updated);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error updating equipment {id}");
                return StatusCode(500, "Internal server error");
            }
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult> Delete(int id)
        {
            try
            {
                var deleted = await _equipmentService.DeleteEquipmentAsync(id);
                if (!deleted)
                {
                    return NotFound($"Equipment with ID {id} not found");
                }
                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error deleting equipment {id}");
                return StatusCode(500, "Internal server error");
            }
        }

        [HttpPost("simulate")]
        public async Task<ActionResult> SimulateScenario([FromBody] SimulationRequest request)
        {
            if (request == null)
            {
                return BadRequest("Invalid simulation request");
            }

            _logger.LogInformation($"Starting simulation scenario: {request.ScenarioType} for equipment {request.EquipmentId}");

            try
            {
                // Check if equipment exists
                var equipment = await _monitoringService.GetEquipmentByIdAsync(request.EquipmentId);
                if (equipment == null)
                {
                    return NotFound($"Equipment with ID {request.EquipmentId} not found");
                }

                // Map string scenario type to enum
                if (!Enum.TryParse<SimulationMode>(request.ScenarioType, true, out var simulationMode))
                {
                    return BadRequest($"Unknown scenario type: {request.ScenarioType}");
                }

                // Set simulation mode in the data generator
                _dataGenerator.SetSimulationMode(request.EquipmentId, simulationMode, request.Duration);

                // Notify clients via SignalR
                await _hubContext.Clients.All.SendAsync("SimulationStarted", new
                {
                    EquipmentId = request.EquipmentId,
                    ScenarioType = request.ScenarioType,
                    Duration = request.Duration,
                    StartTime = DateTime.UtcNow
                });

                return Ok(new
                {
                    Message = $"Simulation '{request.ScenarioType}' started for equipment {request.EquipmentId}"
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error starting simulation: {request.ScenarioType}");
                return StatusCode(500, ex.Message);
            }
        }

        [HttpPost("simulate/stop")]
        public ActionResult StopSimulation([FromBody] StopSimulationRequest request)
        {
            try
            {
                if (request == null || request.EquipmentId <= 0)
                {
                    return BadRequest("Invalid request");
                }

                _logger.LogInformation($"Stopping simulation for equipment {request.EquipmentId}");

                // Check if equipment exists
                var equipment = _monitoringService.GetEquipmentByIdAsync(request.EquipmentId).Result;
                if (equipment == null)
                {
                    return NotFound($"Equipment with ID {request.EquipmentId} not found");
                }

                // Reset simulation for this equipment only
                _dataGenerator.SetSimulationMode(request.EquipmentId, SimulationMode.Normal);

                // Notify clients via SignalR
                _hubContext.Clients.All.SendAsync("SimulationComplete", new
                {
                    EquipmentId = request.EquipmentId,
                    ScenarioType = "Normal",
                    EndTime = DateTime.UtcNow
                }).Wait();

                return Ok(new { Message = $"Simulation stopped for equipment {request.EquipmentId}" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error stopping simulation for equipment {request.EquipmentId}");
                return StatusCode(500, ex.Message);
            }
        }

        public class StopSimulationRequest
        {
            public int EquipmentId { get; set; }
        }

        [HttpPost("simulate/reset")]
        public ActionResult ResetSimulations()
        {
            try
            {
                _dataGenerator.ResetAllSimulations();

                return Ok(new { Message = "All simulations reset to normal operation" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error resetting simulations");
                return StatusCode(500, ex.Message);
            }
        }
    }

    public class SimulationRequest
    {
        public int EquipmentId { get; set; }
        public string ScenarioType { get; set; } = "Normal"; // Initialize with default value
        public int Duration { get; set; } = 60; // Seconds
    }
}
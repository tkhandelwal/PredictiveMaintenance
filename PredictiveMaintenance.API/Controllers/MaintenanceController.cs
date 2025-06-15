// Controllers/MaintenanceController.cs
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PredictiveMaintenance.API.Data;
using PredictiveMaintenance.API.Models;
using PredictiveMaintenance.API.Services.MachineLearning;
using PredictiveMaintenance.API.Services.Monitoring;

namespace PredictiveMaintenance.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class MaintenanceController : ControllerBase
    {
        private readonly IEquipmentMonitoringService _monitoringService;
        private readonly IPredictiveMaintenanceService _maintenanceService;
        private readonly ApplicationDbContext _context;
        private readonly ILogger<MaintenanceController> _logger;

        public MaintenanceController(
            IEquipmentMonitoringService monitoringService,
            IPredictiveMaintenanceService maintenanceService,
            ApplicationDbContext context,
            ILogger<MaintenanceController> logger)
        {
            _monitoringService = monitoringService;
            _maintenanceService = maintenanceService;
            _context = context;
            _logger = logger;
        }

        [HttpGet("schedule/{equipmentId}")]
        public async Task<ActionResult<IEnumerable<MaintenanceEvent>>> GetMaintenanceSchedule(int equipmentId)
        {
            try
            {
                var equipment = await _monitoringService.GetEquipmentByIdAsync(equipmentId);

                if (equipment == null)
                {
                    return NotFound($"Equipment with ID {equipmentId} not found");
                }

                // Get predicted maintenance events using the ML service
                var predictedEvents = await _maintenanceService.PredictMaintenanceScheduleAsync(equipmentId);

                // Get existing events from the database
                var existingEvents = await _context.MaintenanceEvents
                    .Where(e => e.EquipmentId == equipmentId)
                    .ToListAsync();

                // Combine both lists and remove duplicates
                var allEvents = predictedEvents
                    .Concat(existingEvents)
                    .GroupBy(e => new { e.EquipmentId, e.ScheduledDate.Date, e.Type })
                    .Select(g => g.First())
                    .OrderBy(e => e.ScheduledDate)
                    .ToList();

                _logger.LogInformation($"Returning {allEvents.Count} maintenance events for equipment {equipmentId}");

                return Ok(allEvents);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error fetching maintenance schedule for equipment {equipmentId}");
                return StatusCode(500, $"An error occurred while fetching maintenance schedule: {ex.Message}");
            }
        }

        [HttpGet("all")]
        public async Task<ActionResult<IEnumerable<MaintenanceEvent>>> GetAllMaintenanceEvents()
        {
            try
            {
                var events = await _context.MaintenanceEvents
                    .OrderBy(e => e.ScheduledDate)
                    .ToListAsync();

                _logger.LogInformation($"Returning {events.Count} maintenance events across all equipment");
                return Ok(events);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching all maintenance events");
                return StatusCode(500, $"An error occurred while fetching maintenance events: {ex.Message}");
            }
        }

        [HttpPost("create")]
        public async Task<ActionResult<MaintenanceEvent>> CreateMaintenanceEvent([FromBody] MaintenanceEvent maintenanceEvent)
        {
            try
            {
                if (!ModelState.IsValid)
                {
                    return BadRequest(ModelState);
                }

                // Validate equipment exists
                var equipment = await _context.Equipment.FindAsync(maintenanceEvent.EquipmentId);
                if (equipment == null)
                {
                    return BadRequest($"Equipment with ID {maintenanceEvent.EquipmentId} not found");
                }

                maintenanceEvent.CreatedDate = DateTime.UtcNow;
                maintenanceEvent.Status = MaintenanceStatus.Scheduled;

                _context.MaintenanceEvents.Add(maintenanceEvent);
                await _context.SaveChangesAsync();

                _logger.LogInformation($"Created maintenance event {maintenanceEvent.Id} for equipment {maintenanceEvent.EquipmentId}");
                return CreatedAtAction(nameof(GetMaintenanceSchedule), new { equipmentId = maintenanceEvent.EquipmentId }, maintenanceEvent);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating maintenance event");
                return StatusCode(500, $"An error occurred while creating maintenance event: {ex.Message}");
            }
        }

        [HttpPost("complete/{id}")]
        public async Task<ActionResult> CompleteMaintenanceEvent(int id)
        {
            try
            {
                var maintenanceEvent = await _context.MaintenanceEvents.FindAsync(id);

                if (maintenanceEvent == null)
                {
                    return NotFound($"Maintenance event with ID {id} not found");
                }

                maintenanceEvent.CompletionDate = DateTime.UtcNow;
                maintenanceEvent.Status = MaintenanceStatus.Completed;

                // Update equipment's last maintenance date
                var equipment = await _context.Equipment.FindAsync(maintenanceEvent.EquipmentId);
                if (equipment != null)
                {
                    equipment.LastMaintenanceDate = DateTime.UtcNow;
                    equipment.Status = EquipmentStatus.Operational;
                }

                await _context.SaveChangesAsync();

                _logger.LogInformation($"Completed maintenance event {id} for equipment {maintenanceEvent.EquipmentId}");
                return Ok(new { Message = "Maintenance event completed successfully" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error completing maintenance event {id}");
                return StatusCode(500, $"An error occurred while completing maintenance event: {ex.Message}");
            }
        }

        [HttpGet("recommendations/{equipmentId}")]
        public async Task<ActionResult<List<MaintenanceRecommendation>>> GetMaintenanceRecommendations(int equipmentId)
        {
            try
            {
                var equipment = await _context.Equipment.FindAsync(equipmentId);
                if (equipment == null)
                {
                    return NotFound($"Equipment with ID {equipmentId} not found");
                }

                var recommendations = await _maintenanceService.GenerateMaintenanceRecommendationsAsync(equipmentId);
                return Ok(recommendations);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error fetching recommendations for equipment {equipmentId}");
                return StatusCode(500, $"An error occurred while fetching recommendations: {ex.Message}");
            }
        }

        [HttpGet("risk/{equipmentId}")]
        public async Task<ActionResult<object>> GetMaintenanceRisk(int equipmentId)
        {
            try
            {
                var risk = await _maintenanceService.AssessMaintenanceRiskAsync(equipmentId);
                var urgency = await _maintenanceService.CalculateMaintenanceUrgencyScoreAsync(equipmentId);
                var shouldSchedule = await _maintenanceService.ShouldScheduleMaintenanceAsync(equipmentId);

                return Ok(new
                {
                    EquipmentId = equipmentId,
                    Risk = risk.ToString(),
                    UrgencyScore = urgency,
                    ShouldScheduleMaintenance = shouldSchedule,
                    AssessedAt = DateTime.UtcNow
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error assessing risk for equipment {equipmentId}");
                return StatusCode(500, $"An error occurred while assessing maintenance risk: {ex.Message}");
            }
        }

        [HttpGet("window/{equipmentId}")]
        public async Task<ActionResult<OptimalMaintenanceWindow>> GetOptimalMaintenanceWindow(int equipmentId)
        {
            try
            {
                var window = await _maintenanceService.GetOptimalMaintenanceWindowAsync(equipmentId);
                return Ok(window);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error calculating optimal window for equipment {equipmentId}");
                return StatusCode(500, $"An error occurred while calculating optimal maintenance window: {ex.Message}");
            }
        }

        [HttpGet("rul/{equipmentId}")]
        public async Task<ActionResult<object>> GetRemainingUsefulLife(int equipmentId)
        {
            try
            {
                var rul = await _maintenanceService.PredictRemainingUsefulLifeAsync(equipmentId);
                return Ok(new
                {
                    EquipmentId = equipmentId,
                    RemainingUsefulLifeDays = rul,
                    PredictedAt = DateTime.UtcNow
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error predicting RUL for equipment {equipmentId}");
                return StatusCode(500, $"An error occurred while predicting remaining useful life: {ex.Message}");
            }
        }
    }
}
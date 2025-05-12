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
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<MaintenanceController> _logger;

        public MaintenanceController(
            IEquipmentMonitoringService monitoringService,
            IPredictiveMaintenanceService maintenanceService,
            IServiceProvider serviceProvider,
            ILogger<MaintenanceController> logger)
        {
            _monitoringService = monitoringService;
            _maintenanceService = maintenanceService;
            _serviceProvider = serviceProvider;
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

                // First predict maintenance events using the ML service
                var predictedEvents = await _maintenanceService.PredictMaintenanceScheduleAsync(equipmentId);

                // Then get existing events from the database
                using (var scope = _serviceProvider.CreateScope())
                {
                    var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                    var existingEvents = await dbContext.MaintenanceEvents
                        .Where(e => e.EquipmentId == equipmentId)
                        .ToListAsync();

                    // Combine both lists
                    var allEvents = predictedEvents
                        .Concat(existingEvents)
                        .GroupBy(e => e.Id)
                        .Select(g => g.First())
                        .OrderBy(e => e.ScheduledDate)
                        .ToList();

                    _logger.LogInformation($"Returning {allEvents.Count} maintenance events for equipment {equipmentId}");

                    return Ok(allEvents);
                }
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
                using (var scope = _serviceProvider.CreateScope())
                {
                    var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                    var events = await dbContext.MaintenanceEvents
                        .OrderBy(e => e.ScheduledDate)
                        .ToListAsync();

                    _logger.LogInformation($"Returning {events.Count} maintenance events across all equipment");
                    return Ok(events);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching all maintenance events");
                return StatusCode(500, $"An error occurred while fetching maintenance events: {ex.Message}");
            }
        }

        [HttpPost("complete/{id}")]
        public async Task<ActionResult> CompleteMaintenanceEvent(int id)
        {
            try
            {
                using (var scope = _serviceProvider.CreateScope())
                {
                    var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                    var maintenanceEvent = await dbContext.MaintenanceEvents.FindAsync(id);

                    if (maintenanceEvent == null)
                    {
                        return NotFound($"Maintenance event with ID {id} not found");
                    }

                    maintenanceEvent.CompletionDate = DateTime.UtcNow;
                    await dbContext.SaveChangesAsync();

                    // Update equipment's last maintenance date
                    var equipment = await dbContext.Equipment.FindAsync(maintenanceEvent.EquipmentId);
                    if (equipment != null)
                    {
                        equipment.LastMaintenanceDate = DateTime.UtcNow;
                        equipment.Status = MaintenanceStatus.Operational;
                        await dbContext.SaveChangesAsync();
                    }

                    _logger.LogInformation($"Completed maintenance event {id} for equipment {maintenanceEvent.EquipmentId}");
                    return Ok(new { Message = "Maintenance event completed successfully" });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error completing maintenance event {id}");
                return StatusCode(500, $"An error occurred while completing maintenance event: {ex.Message}");
            }
        }
    }
}
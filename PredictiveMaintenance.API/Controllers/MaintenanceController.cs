using Microsoft.AspNetCore.Mvc;
using PredictiveMaintenance.API.Models;
using PredictiveMaintenance.API.Services.MachineLearning;
using PredictiveMaintenance.API.Services.Monitoring;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace PredictiveMaintenance.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class MaintenanceController : ControllerBase
    {
        private readonly IEquipmentMonitoringService _monitoringService;
        private readonly IPredictiveMaintenanceService _maintenanceService;

        public MaintenanceController(
            IEquipmentMonitoringService monitoringService,
            IPredictiveMaintenanceService maintenanceService)
        {
            _monitoringService = monitoringService;
            _maintenanceService = maintenanceService;
        }

        [HttpGet("schedule/{equipmentId}")]
        public async Task<ActionResult<IEnumerable<MaintenanceEvent>>> GetMaintenanceSchedule(int equipmentId)
        {
            var equipment = await _monitoringService.GetEquipmentByIdAsync(equipmentId);

            if (equipment == null)
            {
                return NotFound();
            }

            var maintenanceEvents = await _maintenanceService.PredictMaintenanceScheduleAsync(equipmentId);
            return Ok(maintenanceEvents);
        }
    }
}
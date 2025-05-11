using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using PredictiveMaintenance.API.Hubs;
using PredictiveMaintenance.API.Models;
using PredictiveMaintenance.API.Services.Monitoring;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace PredictiveMaintenance.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class EquipmentController : ControllerBase
    {
        private readonly IEquipmentMonitoringService _monitoringService;
        private readonly IHubContext<MonitoringHub> _hubContext;

        public EquipmentController(
            IEquipmentMonitoringService monitoringService,
            IHubContext<MonitoringHub> hubContext)
        {
            _monitoringService = monitoringService;
            _hubContext = hubContext;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Equipment>>> GetAllEquipment()
        {
            var equipment = await _monitoringService.GetAllEquipmentAsync();
            return Ok(equipment);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Equipment>> GetEquipment(int id)
        {
            var equipment = await _monitoringService.GetEquipmentByIdAsync(id);

            if (equipment == null)
            {
                return NotFound();
            }

            return Ok(equipment);
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
    }
}
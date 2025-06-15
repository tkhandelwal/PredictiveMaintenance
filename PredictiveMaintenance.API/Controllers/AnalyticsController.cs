using Microsoft.AspNetCore.Mvc;
using PredictiveMaintenance.API.Services;
using PredictiveMaintenance.API.Services.DigitalTwin;
using PredictiveMaintenance.API.Services.PowerSystem;

namespace PredictiveMaintenance.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AnalyticsController : ControllerBase
    {
        private readonly IEnergyOptimizationService _energyService;
        private readonly IDigitalTwinService _digitalTwinService;
        private readonly IPowerSystemAnalysisService _powerSystemService;
        private readonly ILogger<AnalyticsController> _logger;

        public AnalyticsController(
            IEnergyOptimizationService energyService,
            IDigitalTwinService digitalTwinService,
            IPowerSystemAnalysisService powerSystemService,
            ILogger<AnalyticsController> logger)
        {
            _energyService = energyService;
            _digitalTwinService = digitalTwinService;
            _powerSystemService = powerSystemService;
            _logger = logger;
        }

        [HttpGet("energy/{equipmentId}/efficiency")]
        public async Task<ActionResult<double>> GetEnergyEfficiency(int equipmentId)
        {
            try
            {
                var efficiency = await _energyService.CalculateEnergyEfficiencyAsync(equipmentId);
                return Ok(new { EquipmentId = equipmentId, Efficiency = efficiency });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error calculating energy efficiency for equipment {equipmentId}");
                return StatusCode(500, "Error calculating efficiency");
            }
        }

        [HttpGet("energy/{equipmentId}/optimization")]
        public async Task<ActionResult<List<EnergyRecommendation>>> GetOptimizationRecommendations(int equipmentId)
        {
            try
            {
                var recommendations = await _energyService.GetOptimizationRecommendationsAsync(equipmentId);
                return Ok(recommendations);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error getting optimization recommendations for equipment {equipmentId}");
                return StatusCode(500, "Error retrieving recommendations");
            }
        }

        [HttpGet("energy/{equipmentId}/profile")]
        public async Task<ActionResult<EnergyProfile>> GetEnergyProfile(int equipmentId)
        {
            try
            {
                var profile = await _energyService.GetEnergyProfileAsync(equipmentId);
                return Ok(profile);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error getting energy profile for equipment {equipmentId}");
                return StatusCode(500, "Error retrieving energy profile");
            }
        }

        [HttpPost("energy/{equipmentId}/forecast")]
        public async Task<ActionResult<EnergyForecast>> ForecastEnergyConsumption(
            int equipmentId,
            [FromQuery] int horizonHours = 24)
        {
            try
            {
                var forecast = await _energyService.ForecastEnergyConsumptionAsync(equipmentId, horizonHours);
                return Ok(forecast);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error forecasting energy consumption for equipment {equipmentId}");
                return StatusCode(500, "Error generating forecast");
            }
        }

        [HttpGet("digital-twin/{equipmentId}/state")]
        public async Task<ActionResult<DigitalTwinState>> GetDigitalTwinState(int equipmentId)
        {
            try
            {
                var state = await _digitalTwinService.GetTwinStateAsync(equipmentId);
                return Ok(state);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error getting digital twin state for equipment {equipmentId}");
                return StatusCode(500, "Error retrieving twin state");
            }
        }

        [HttpPost("digital-twin/{equipmentId}/simulate")]
        public async Task<ActionResult<SimulationResult>> SimulateScenario(
            int equipmentId,
            [FromBody] SimulationScenario scenario)
        {
            try
            {
                var result = await _digitalTwinService.SimulateScenarioAsync(equipmentId, scenario);
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error simulating scenario for equipment {equipmentId}");
                return StatusCode(500, "Error running simulation");
            }
        }

        [HttpGet("digital-twin/{equipmentId}/insights")]
        public async Task<ActionResult<DigitalTwinInsights>> GetDigitalTwinInsights(int equipmentId)
        {
            try
            {
                var insights = await _digitalTwinService.GetTwinInsightsAsync(equipmentId);
                return Ok(insights);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error getting digital twin insights for equipment {equipmentId}");
                return StatusCode(500, "Error retrieving insights");
            }
        }

        [HttpPost("power-system/load-flow")]
        public async Task<ActionResult<LoadFlowAnalysis>> PerformLoadFlowAnalysis()
        {
            try
            {
                var analysis = await _powerSystemService.PerformLoadFlowAnalysisAsync();
                return Ok(analysis);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error performing load flow analysis");
                return StatusCode(500, "Error performing analysis");
            }
        }

        [HttpPost("power-system/harmonic-analysis")]
        public async Task<ActionResult<HarmonicAnalysis>> PerformHarmonicAnalysis()
        {
            try
            {
                var analysis = await _powerSystemService.PerformHarmonicAnalysisAsync();
                return Ok(analysis);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error performing harmonic analysis");
                return StatusCode(500, "Error performing analysis");
            }
        }

        [HttpGet("power-system/power-quality")]
        public async Task<ActionResult<PowerQualityReport>> GetPowerQualityReport()
        {
            try
            {
                var report = await _powerSystemService.GeneratePowerQualityReportAsync();
                return Ok(report);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating power quality report");
                return StatusCode(500, "Error generating report");
            }
        }
    }
}
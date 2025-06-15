// Services/EnergyOptimizationService.cs
using PredictiveMaintenance.API.Data;

namespace PredictiveMaintenance.API.Services
{
    public interface IEnergyOptimizationService
    {
        Task<double> CalculateEnergyEfficiencyAsync(int equipmentId);
        Task<List<EnergyRecommendation>> GetOptimizationRecommendationsAsync(int equipmentId);
    }

    public class EnergyOptimizationService : IEnergyOptimizationService
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<EnergyOptimizationService> _logger;

        public EnergyOptimizationService(
            ApplicationDbContext context,
            ILogger<EnergyOptimizationService> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task<double> CalculateEnergyEfficiencyAsync(int equipmentId)
        {
            var equipment = await _context.Equipment
                .Include(e => e.OperationalData)
                .FirstOrDefaultAsync(e => e.Id == equipmentId);

            if (equipment?.OperationalData == null) return 0;

            // Simple efficiency calculation
            var efficiency = equipment.OperationalData.Performance *
                           equipment.OperationalData.Quality / 100;

            return Math.Min(efficiency, 100);
        }

        public async Task<List<EnergyRecommendation>> GetOptimizationRecommendationsAsync(int equipmentId)
        {
            var recommendations = new List<EnergyRecommendation>();

            var equipment = await _context.Equipment
                .Include(e => e.OperationalData)
                .FirstOrDefaultAsync(e => e.Id == equipmentId);

            if (equipment?.OperationalData != null)
            {
                if (equipment.OperationalData.CurrentLoad > equipment.OperationalData.PeakLoad * 0.9)
                {
                    recommendations.Add(new EnergyRecommendation
                    {
                        Title = "High Load Alert",
                        Description = "Equipment operating near peak capacity. Consider load balancing.",
                        PotentialSavings = equipment.OperationalData.EnergyConsumed * 0.1
                    });
                }
            }

            return recommendations;
        }
    }

    public class EnergyRecommendation
    {
        public string Title { get; set; } = "";
        public string Description { get; set; } = "";
        public double PotentialSavings { get; set; }
    }
}
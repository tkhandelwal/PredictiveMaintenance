using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace PredictiveMaintenance.API.Services.DataGeneration
{
    public class DataGenerationBackgroundService : BackgroundService
    {
        private readonly ILogger<DataGenerationBackgroundService> _logger;
        private readonly ISyntheticDataGenerator _dataGenerator;
        private readonly TimeSpan _interval = TimeSpan.FromSeconds(10);

        public DataGenerationBackgroundService(
            ILogger<DataGenerationBackgroundService> logger,
            ISyntheticDataGenerator dataGenerator)
        {
            _logger = logger;
            _dataGenerator = dataGenerator;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Data Generation Background Service is starting.");

            while (!stoppingToken.IsCancellationRequested)
            {
                _logger.LogInformation("Generating synthetic data batch...");

                try
                {
                    // Generate readings for each equipment
                    await _dataGenerator.GenerateBatchReadingsAsync(4);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error occurred while generating synthetic data.");
                }

                await Task.Delay(_interval, stoppingToken);
            }

            _logger.LogInformation("Data Generation Background Service is stopping.");
        }
    }
}
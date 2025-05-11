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
        private readonly TimeSpan _interval = TimeSpan.FromSeconds(3); // More frequent updates

        // Use ConcurrentQueue to accumulate readings for batch processing
        private readonly object _lock = new object();
        private bool _isGenerating = false;

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
                if (!_isGenerating)
                {
                    lock (_lock)
                    {
                        _isGenerating = true;
                    }

                    try
                    {
                        _logger.LogInformation("Generating synthetic data batch...");

                        // Generate readings for all equipment and sensor types
                        await _dataGenerator.GenerateBatchReadingsAsync(4);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error occurred while generating synthetic data.");
                    }
                    finally
                    {
                        lock (_lock)
                        {
                            _isGenerating = false;
                        }
                    }
                }
                else
                {
                    _logger.LogDebug("Previous data generation still in progress, skipping cycle.");
                }

                await Task.Delay(_interval, stoppingToken);
            }

            _logger.LogInformation("Data Generation Background Service is stopping.");
        }

        public override async Task StopAsync(CancellationToken cancellationToken)
        {
            _logger.LogInformation("Data Generation Background Service is stopping.");

            // Allow any in-progress operation to complete
            while (_isGenerating)
            {
                await Task.Delay(100, cancellationToken);
            }

            await base.StopAsync(cancellationToken);
        }
    }
}
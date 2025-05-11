// Services/DataGeneration/SyntheticDataGenerator.cs
using Microsoft.Extensions.Logging;
using PredictiveMaintenance.API.Models;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace PredictiveMaintenance.API.Services.DataGeneration
{
    public class SyntheticDataGenerator : ISyntheticDataGenerator
    {
        private readonly ILogger<SyntheticDataGenerator> _logger;
        private readonly IInfluxDbService _influxDbService;
        private readonly Random _random = new Random();

        // Default equipment configurations for synthetic data
        private readonly Dictionary<int, EquipmentConfig> _equipmentConfigs = new Dictionary<int, EquipmentConfig>
        {
            { 1, new EquipmentConfig("Pump", 60, 10, 0.05) },
            { 2, new EquipmentConfig("Motor", 120, 15, 0.08) },
            { 3, new EquipmentConfig("Compressor", 90, 8, 0.03) },
            { 4, new EquipmentConfig("Fan", 40, 5, 0.02) }
        };

        public SyntheticDataGenerator(ILogger<SyntheticDataGenerator> logger, IInfluxDbService influxDbService)
        {
            _logger = logger;
            _influxDbService = influxDbService;
        }

        public async Task<SensorReading> GenerateSensorReadingAsync(int equipmentId)
        {
            if (!_equipmentConfigs.TryGetValue(equipmentId, out var config))
            {
                config = new EquipmentConfig("Unknown", 50, 10, 0.05);
            }

            var reading = new SensorReading
            {
                EquipmentId = equipmentId,
                Timestamp = DateTime.UtcNow,
                SensorType = "temperature",
                Value = GenerateValue(config)
            };

            await _influxDbService.WriteSensorReadingAsync(reading);
            _logger.LogInformation($"Generated reading for equipment {equipmentId}: {reading.Value}");

            return reading;
        }

        public async Task<List<SensorReading>> GenerateBatchReadingsAsync(int count)
        {
            var readings = new List<SensorReading>();

            for (int i = 0; i < count; i++)
            {
                int equipmentId = _random.Next(1, 5);
                var reading = await GenerateSensorReadingAsync(equipmentId);
                readings.Add(reading);
            }

            return readings;
        }

        private double GenerateValue(EquipmentConfig config)
        {
            // Generate a baseline value with some randomness
            double value = config.BaseValue + (_random.NextDouble() * 2 - 1) * config.Variance;

            // Occasionally introduce anomalies
            if (_random.NextDouble() < config.AnomalyProbability)
            {
                value += config.Variance * 3 * (_random.NextDouble() * 2 - 1);
            }

            return Math.Round(value, 2);
        }
    }

    public class EquipmentConfig
    {
        public string Type { get; }
        public double BaseValue { get; }
        public double Variance { get; }
        public double AnomalyProbability { get; }

        public EquipmentConfig(string type, double baseValue, double variance, double anomalyProbability)
        {
            Type = type;
            BaseValue = baseValue;
            Variance = variance;
            AnomalyProbability = anomalyProbability;
        }
    }
}
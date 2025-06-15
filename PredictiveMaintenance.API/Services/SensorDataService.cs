// Services/SensorDataService.cs
using Microsoft.EntityFrameworkCore;
using PredictiveMaintenance.API.Data;
using PredictiveMaintenance.API.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace PredictiveMaintenance.API.Services
{
    public class SensorDataService : ISensorDataService
    {
        private readonly ApplicationDbContext _context;
        private readonly IInfluxDbService _influxDbService;
        private readonly ILogger<SensorDataService> _logger;

        public SensorDataService(
            ApplicationDbContext context,
            IInfluxDbService influxDbService,
            ILogger<SensorDataService> logger)
        {
            _context = context;
            _influxDbService = influxDbService;
            _logger = logger;
        }

        public async Task<List<SensorReading>> GetLatestSensorDataAsync(int equipmentId, int count)
        {
            try
            {
                var now = DateTime.UtcNow;
                var from = now.AddHours(-24);
                var readings = await _influxDbService.GetReadingsForEquipmentAsync(equipmentId, from, now);

                return readings.OrderByDescending(r => r.Timestamp)
                               .Take(count)
                               .ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error getting sensor data for equipment {equipmentId}");
                return new List<SensorReading>();
            }
        }

        public async Task RemoveSensorMonitoringAsync(int equipmentId)
        {
            try
            {
                var sensorData = await _context.Set<SensorData>()
                    .Where(s => s.EquipmentId == equipmentId)
                    .ToListAsync();

                _context.RemoveRange(sensorData);
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error removing sensor monitoring for equipment {equipmentId}");
            }
        }

        public async Task InitializeSensorMonitoringAsync(int equipmentId)
        {
            try
            {
                _logger.LogInformation($"Initializing sensor monitoring for equipment {equipmentId}");

                var equipment = await _context.Equipment
                    .Include(e => e.SensorData)
                    .FirstOrDefaultAsync(e => e.Id == equipmentId);

                if (equipment == null)
                {
                    _logger.LogWarning($"Equipment {equipmentId} not found for sensor initialization");
                    return;
                }

                // Check if sensors already exist
                if (equipment.SensorData != null && equipment.SensorData.Any())
                {
                    _logger.LogInformation($"Sensors already configured for equipment {equipmentId}");
                    return;
                }

                var sensorsToAdd = new List<SensorData>();

                // Configure sensors based on equipment type
                switch (equipment.Type)
                {
                    case EquipmentType.Motor:
                    case EquipmentType.ElectricMotor:
                        sensorsToAdd.AddRange(CreateMotorSensors(equipmentId));
                        break;

                    case EquipmentType.Transformer:
                        sensorsToAdd.AddRange(CreateTransformerSensors(equipmentId));
                        break;

                    case EquipmentType.CentrifugalPump:
                        sensorsToAdd.AddRange(CreatePumpSensors(equipmentId));
                        break;

                    case EquipmentType.AirCompressor:
                        sensorsToAdd.AddRange(CreateCompressorSensors(equipmentId));
                        break;

                    case EquipmentType.WindTurbine:
                        sensorsToAdd.AddRange(CreateWindTurbineSensors(equipmentId));
                        break;

                    case EquipmentType.SolarPanel:
                        sensorsToAdd.AddRange(CreateSolarPanelSensors(equipmentId));
                        break;

                    case EquipmentType.BatteryStorage:
                        sensorsToAdd.AddRange(CreateBatteryStorageSensors(equipmentId));
                        break;

                    default:
                        // Add basic sensors for all equipment types
                        sensorsToAdd.AddRange(CreateBasicSensors(equipmentId));
                        break;
                }

                if (sensorsToAdd.Any())
                {
                    _context.SensorData.AddRange(sensorsToAdd);
                    await _context.SaveChangesAsync();
                    _logger.LogInformation($"Added {sensorsToAdd.Count} sensors for equipment {equipmentId}");
                }

                // Initialize first readings in InfluxDB
                await GenerateInitialReadings(equipmentId, sensorsToAdd);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error initializing sensor monitoring for equipment {equipmentId}");
                throw;
            }
        }

        private List<SensorData> CreateBasicSensors(int equipmentId)
        {
            return new List<SensorData>
            {
                new SensorData
                {
                    EquipmentId = equipmentId,
                    SensorId = $"TEMP_{equipmentId}_001",
                    Type = "temperature",
                    Unit = "°C",
                    Value = 25.0,
                    Timestamp = DateTime.UtcNow,
                    Quality = "good"
                },
                new SensorData
                {
                    EquipmentId = equipmentId,
                    SensorId = $"PWR_{equipmentId}_001",
                    Type = "power",
                    Unit = "kW",
                    Value = 0.0,
                    Timestamp = DateTime.UtcNow,
                    Quality = "good"
                }
            };
        }

        private List<SensorData> CreateMotorSensors(int equipmentId)
        {
            return new List<SensorData>
            {
                new SensorData
                {
                    EquipmentId = equipmentId,
                    SensorId = $"TEMP_{equipmentId}_001",
                    Type = "temperature",
                    Unit = "°C",
                    Value = 40.0,
                    Timestamp = DateTime.UtcNow,
                    Quality = "good"
                },
                new SensorData
                {
                    EquipmentId = equipmentId,
                    SensorId = $"VIB_{equipmentId}_001",
                    Type = "vibration",
                    Unit = "mm/s",
                    Value = 2.5,
                    Timestamp = DateTime.UtcNow,
                    Quality = "good"
                },
                new SensorData
                {
                    EquipmentId = equipmentId,
                    SensorId = $"CURR_{equipmentId}_001",
                    Type = "current",
                    Unit = "A",
                    Value = 15.0,
                    Timestamp = DateTime.UtcNow,
                    Quality = "good"
                },
                new SensorData
                {
                    EquipmentId = equipmentId,
                    SensorId = $"RPM_{equipmentId}_001",
                    Type = "speed",
                    Unit = "RPM",
                    Value = 1800.0,
                    Timestamp = DateTime.UtcNow,
                    Quality = "good"
                }
            };
        }

        private List<SensorData> CreateTransformerSensors(int equipmentId)
        {
            return new List<SensorData>
            {
                new SensorData
                {
                    EquipmentId = equipmentId,
                    SensorId = $"TEMP_{equipmentId}_OIL",
                    Type = "temperature",
                    Unit = "°C",
                    Value = 65.0,
                    Timestamp = DateTime.UtcNow,
                    Quality = "good"
                },
                new SensorData
                {
                    EquipmentId = equipmentId,
                    SensorId = $"VOLT_{equipmentId}_PRI",
                    Type = "voltage",
                    Unit = "kV",
                    Value = 11.0,
                    Timestamp = DateTime.UtcNow,
                    Quality = "good"
                },
                new SensorData
                {
                    EquipmentId = equipmentId,
                    SensorId = $"CURR_{equipmentId}_SEC",
                    Type = "current",
                    Unit = "A",
                    Value = 100.0,
                    Timestamp = DateTime.UtcNow,
                    Quality = "good"
                },
                new SensorData
                {
                    EquipmentId = equipmentId,
                    SensorId = $"OIL_{equipmentId}_LEVEL",
                    Type = "oil_quality",
                    Unit = "%",
                    Value = 95.0,
                    Timestamp = DateTime.UtcNow,
                    Quality = "good"
                }
            };
        }

        private List<SensorData> CreatePumpSensors(int equipmentId)
        {
            return new List<SensorData>
            {
                new SensorData
                {
                    EquipmentId = equipmentId,
                    SensorId = $"FLOW_{equipmentId}_001",
                    Type = "flow",
                    Unit = "m³/h",
                    Value = 50.0,
                    Timestamp = DateTime.UtcNow,
                    Quality = "good"
                },
                new SensorData
                {
                    EquipmentId = equipmentId,
                    SensorId = $"PRESS_{equipmentId}_IN",
                    Type = "pressure",
                    Unit = "bar",
                    Value = 1.0,
                    Timestamp = DateTime.UtcNow,
                    Quality = "good"
                },
                new SensorData
                {
                    EquipmentId = equipmentId,
                    SensorId = $"PRESS_{equipmentId}_OUT",
                    Type = "pressure",
                    Unit = "bar",
                    Value = 5.0,
                    Timestamp = DateTime.UtcNow,
                    Quality = "good"
                },
                new SensorData
                {
                    EquipmentId = equipmentId,
                    SensorId = $"VIB_{equipmentId}_001",
                    Type = "vibration",
                    Unit = "mm/s",
                    Value = 3.0,
                    Timestamp = DateTime.UtcNow,
                    Quality = "good"
                }
            };
        }

        private List<SensorData> CreateCompressorSensors(int equipmentId)
        {
            return new List<SensorData>
            {
                new SensorData
                {
                    EquipmentId = equipmentId,
                    SensorId = $"PRESS_{equipmentId}_001",
                    Type = "pressure",
                    Unit = "bar",
                    Value = 8.0,
                    Timestamp = DateTime.UtcNow,
                    Quality = "good"
                },
                new SensorData
                {
                    EquipmentId = equipmentId,
                    SensorId = $"TEMP_{equipmentId}_AIR",
                    Type = "temperature",
                    Unit = "°C",
                    Value = 35.0,
                    Timestamp = DateTime.UtcNow,
                    Quality = "good"
                }
            };
        }

        private List<SensorData> CreateWindTurbineSensors(int equipmentId)
        {
            return new List<SensorData>
            {
                new SensorData
                {
                    EquipmentId = equipmentId,
                    SensorId = $"PWR_{equipmentId}_GEN",
                    Type = "power",
                    Unit = "MW",
                    Value = 1.5,
                    Timestamp = DateTime.UtcNow,
                    Quality = "good"
                },
                new SensorData
                {
                    EquipmentId = equipmentId,
                    SensorId = $"RPM_{equipmentId}_ROTOR",
                    Type = "speed",
                    Unit = "RPM",
                    Value = 15.0,
                    Timestamp = DateTime.UtcNow,
                    Quality = "good"
                }
            };
        }

        private List<SensorData> CreateSolarPanelSensors(int equipmentId)
        {
            return new List<SensorData>
            {
                new SensorData
                {
                    EquipmentId = equipmentId,
                    SensorId = $"PWR_{equipmentId}_OUT",
                    Type = "power",
                    Unit = "kW",
                    Value = 250.0,
                    Timestamp = DateTime.UtcNow,
                    Quality = "good"
                },
                new SensorData
                {
                    EquipmentId = equipmentId,
                    SensorId = $"TEMP_{equipmentId}_PANEL",
                    Type = "temperature",
                    Unit = "°C",
                    Value = 45.0,
                    Timestamp = DateTime.UtcNow,
                    Quality = "good"
                }
            };
        }

        private List<SensorData> CreateBatteryStorageSensors(int equipmentId)
        {
            return new List<SensorData>
            {
                new SensorData
                {
                    EquipmentId = equipmentId,
                    SensorId = $"VOLT_{equipmentId}_BATT",
                    Type = "voltage",
                    Unit = "V",
                    Value = 48.0,
                    Timestamp = DateTime.UtcNow,
                    Quality = "good"
                },
                new SensorData
                {
                    EquipmentId = equipmentId,
                    SensorId = $"CURR_{equipmentId}_BATT",
                    Type = "current",
                    Unit = "A",
                    Value = 50.0,
                    Timestamp = DateTime.UtcNow,
                    Quality = "good"
                }
            };
        }

        private async Task GenerateInitialReadings(int equipmentId, List<SensorData> sensors)
        {
            try
            {
                var initialReadings = sensors.Select(s => new SensorReading
                {
                    EquipmentId = equipmentId,
                    SensorType = s.Type,
                    Value = s.Value,
                    Timestamp = DateTime.UtcNow,
                    IsAnomaly = false
                }).ToList();

                foreach (var reading in initialReadings)
                {
                    // Fixed: Use WriteSensorReadingAsync instead of WriteReadingAsync
                    await _influxDbService.WriteSensorReadingAsync(reading);
                }

                _logger.LogInformation($"Generated {initialReadings.Count} initial readings for equipment {equipmentId}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error generating initial readings for equipment {equipmentId}");
            }
        }

        // Helper method to get appropriate unit for sensor type
        private string GetUnitForSensorType(string sensorType)
        {
            return sensorType.ToLower() switch
            {
                "temperature" => "°C",
                "vibration" => "mm/s",
                "current" => "A",
                "voltage" => "V",
                "power" => "kW",
                "pressure" => "bar",
                "flow" => "m³/h",
                "speed" or "rpm" => "RPM",
                "oil_quality" => "%",
                _ => ""
            };
        }
    }
}
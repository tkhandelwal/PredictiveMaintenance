// Models/OperationalData.cs
namespace PredictiveMaintenance.API.Models
{
    public class OperationalData
    {
        public int Id { get; set; }
        public int EquipmentId { get; set; }
        public virtual Equipment Equipment { get; set; } = null!;

        // Runtime metrics
        public double HoursRun { get; set; }
        public double HoursLoaded { get; set; }         // Hours under load
        public double HoursIdle { get; set; }           // Hours at idle
        public int StartStopCycles { get; set; }
        public int LoadCycles { get; set; }             // Number of load changes
        public DateTime? LastStartTime { get; set; }
        public DateTime? LastStopTime { get; set; }
        public TimeSpan? CurrentRuntime { get; set; }   // Current continuous run time

        // Energy metrics
        public double EnergyConsumed { get; set; }      // kWh
        public double EnergyGenerated { get; set; }     // kWh
        public double ReactiveEnergyConsumed { get; set; } // kVARh
        public double ReactiveEnergyGenerated { get; set; } // kVARh
        public double PeakDemand { get; set; }          // kW
        public DateTime? PeakDemandTime { get; set; }

        // Load metrics
        public double CurrentLoad { get; set; }         // % or kW
        public double AverageLoad { get; set; }         // % or kW
        public double PeakLoad { get; set; }            // % or kW
        public double MinimumLoad { get; set; }         // % or kW
        public string? LoadProfile { get; set; }        // JSON array of hourly loads

        // Efficiency metrics
        public double CurrentEfficiency { get; set; }    // %
        public double AverageEfficiency { get; set; }    // %
        public double CurrentPowerFactor { get; set; }
        public double AveragePowerFactor { get; set; }

        // OEE Metrics (Overall Equipment Effectiveness)
        public double Availability { get; set; }         // %
        public double Performance { get; set; }          // %
        public double Quality { get; set; }              // %
        public double OEE { get; set; }                  // %

        // Reliability metrics
        public double? MTBF { get; set; }                // Mean Time Between Failures (hours)
        public double? MTTR { get; set; }                // Mean Time To Repair (hours)
        public double? MTTF { get; set; }                // Mean Time To Failure (hours)
        public double? Reliability { get; set; }         // %
        public int FailureCount { get; set; }
        public int UnplannedStops { get; set; }

        // Production metrics (if applicable)
        public double? ProductionRate { get; set; }      // units/hour
        public double? ProductionTotal { get; set; }     // total units
        public double? DefectRate { get; set; }          // %
        public double? YieldRate { get; set; }           // %

        // Temperature tracking
        public double? MaxRecordedTemp { get; set; }     // °C
        public DateTime? MaxTempTime { get; set; }
        public double? AverageOperatingTemp { get; set; } // °C

        // Vibration tracking
        public double? MaxRecordedVibration { get; set; } // mm/s
        public DateTime? MaxVibrationTime { get; set; }
        public double? AverageVibration { get; set; }     // mm/s

        // Electrical stress tracking
        public int VoltageExcursions { get; set; }        // Count of over/under voltage
        public int CurrentExcursions { get; set; }        // Count of overcurrent
        public int PowerQualityEvents { get; set; }       // Harmonics, sags, swells

        // Maintenance impact
        public double MaintenanceDowntime { get; set; }   // hours
        public double UnplannedDowntime { get; set; }     // hours
        public double PlannedDowntime { get; set; }       // hours
        public double DowntimeCost { get; set; }          // $

        // Cost tracking
        public decimal OperatingCost { get; set; }        // $/hour
        public decimal EnergyCost { get; set; }           // $
        public decimal MaintenanceCost { get; set; }      // $
        public decimal TotalCostOfOwnership { get; set; }  // $

        // Emissions tracking (for generators, etc.)
        public double? CO2_Emissions { get; set; }        // kg
        public double? NOx_Emissions { get; set; }        // kg
        public double? SO2_Emissions { get; set; }        // kg
        public double? PM_Emissions { get; set; }         // kg particulate matter

        // Fuel consumption (for generators)
        public double? FuelConsumed { get; set; }         // liters or m³
        public double? SpecificFuelConsumption { get; set; } // L/kWh or m³/kWh

        // Battery specific (if applicable)
        public int? ChargeCycles { get; set; }
        public int? DischargeCycles { get; set; }
        public double? StateOfCharge { get; set; }        // %
        public double? StateOfHealth { get; set; }        // %
        public double? CumulativeAhThroughput { get; set; } // Ah

        // Wind turbine specific
        public double? WindSpeedAverage { get; set; }     // m/s
        public double? CapacityFactor { get; set; }       // %
        public double? RotorSpeed { get; set; }           // RPM
        public double? PitchAngle { get; set; }           // degrees
        public double? YawPosition { get; set; }          // degrees

        // Solar specific
        public double? Irradiance { get; set; }           // W/m²
        public double? ModuleTemperature { get; set; }    // °C
        public double? ArrayEfficiency { get; set; }      // %
        public double? PerformanceRatio { get; set; }     // PR

        // Timestamps
        public DateTime LastUpdated { get; set; } = DateTime.UtcNow;
        public DateTime? LastResetDate { get; set; }      // When counters were reset

        // Methods
        public void CalculateOEE()
        {
            OEE = (Availability * Performance * Quality) / 10000;
        }

        public void UpdateReliabilityMetrics()
        {
            if (FailureCount > 0 && HoursRun > 0)
            {
                MTBF = HoursRun / FailureCount;

                if (UnplannedDowntime > 0)
                {
                    MTTR = UnplannedDowntime / FailureCount;
                }

                Reliability = Math.Exp(-HoursRun / (MTBF ?? 1)) * 100;
            }
        }

        public double CalculateUtilization()
        {
            if (HoursRun == 0) return 0;
            return (HoursLoaded / HoursRun) * 100;
        }

        public double CalculateCapacityFactor(double ratedPower)
        {
            if (ratedPower == 0 || HoursRun == 0) return 0;
            return (EnergyGenerated / (ratedPower * HoursRun)) * 100;
        }
    }
}
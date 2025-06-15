// Models/ProtectionSettings.cs
namespace PredictiveMaintenance.API.Models
{
    public class ProtectionSettings
    {
        public int Id { get; set; }
        public int EquipmentId { get; set; }
        public virtual Equipment Equipment { get; set; } = null!;

        // Overcurrent protection
        public double? PhaseOvercurrentPickup { get; set; }     // A or xIn
        public double? PhaseOvercurrentDelay { get; set; }      // s
        public string? PhaseOvercurrentCurve { get; set; }      // IEC/IEEE curve

        public double? GroundOvercurrentPickup { get; set; }
        public double? GroundOvercurrentDelay { get; set; }
        public string? GroundOvercurrentCurve { get; set; }

        public double? InstantaneousPickup { get; set; }
        public bool InstantaneousEnabled { get; set; }

        // Differential protection
        public double? DifferentialPickup { get; set; }         // %
        public double? DifferentialSlope1 { get; set; }         // %
        public double? DifferentialSlope2 { get; set; }         // %
        public double? HarmonicRestraint2nd { get; set; }       // %
        public double? HarmonicRestraint5th { get; set; }       // %

        // Voltage protection
        public double? OvervoltagePickup { get; set; }          // V or %
        public double? OvervoltageDelay { get; set; }           // s
        public double? UndervoltagePickup { get; set; }
        public double? UndervoltageDelay { get; set; }

        // Frequency protection
        public double? OverfrequencyPickup { get; set; }        // Hz
        public double? OverfrequencyDelay { get; set; }         // s
        public double? UnderfrequencyPickup { get; set; }
        public double? UnderfrequencyDelay { get; set; }

        // Motor protection
        public double? ThermalOverloadPickup { get; set; }      // xFLA
        public string? ThermalOverloadClass { get; set; }       // Class 10, 20, 30
        public double? LockedRotorPickup { get; set; }          // xFLA
        public double? LockedRotorDelay { get; set; }           // s
        public double? UnbalancePickup { get; set; }            // %
        public double? UnbalanceDelay { get; set; }             // s

        // Distance protection
        public double? Zone1Reach { get; set; }                 // Ω or %
        public double? Zone1Angle { get; set; }                 // degrees
        public double? Zone1Delay { get; set; }                 // s
        public double? Zone2Reach { get; set; }
        public double? Zone2Angle { get; set; }
        public double? Zone2Delay { get; set; }

        // Arc flash protection
        public double? ArcFlashLightPickup { get; set; }        // lux
        public double? ArcFlashCurrentPickup { get; set; }      // A
        public double? ArcFlashDelay { get; set; }              // ms

        // Settings metadata
        public string? SettingsVersion { get; set; }
        public DateTime? LastModified { get; set; }
        public string? ModifiedBy { get; set; }
        public string? ApprovedBy { get; set; }
        public string? SettingsFile { get; set; }               // Path to settings file
    }
}

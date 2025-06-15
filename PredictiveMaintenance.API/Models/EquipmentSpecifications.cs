// Models/EquipmentSpecifications.cs
namespace PredictiveMaintenance.API.Models
{
    public class EquipmentSpecifications
    {
        public int Id { get; set; }
        public int EquipmentId { get; set; }
        public virtual Equipment Equipment { get; set; } = null!;

        // Common specifications
        public string? RatedPower { get; set; }
        public string? RatedVoltage { get; set; }
        public string? RatedCurrent { get; set; }
        public string? Frequency { get; set; }

        // Motor specific
        public double? HP { get; set; }
        public string? RPM { get; set; }
        public string? Efficiency { get; set; }
        public string? PowerFactor { get; set; }
        public string? Insulation { get; set; }
        public string? Enclosure { get; set; }

        // Additional specifications as JSON
        public string? AdditionalSpecs { get; set; } // Store as JSON
    }

    public class OperationalData
    {
        public int Id { get; set; }
        public int EquipmentId { get; set; }
        public virtual Equipment Equipment { get; set; } = null!;

        public double HoursRun { get; set; }
        public int StartStopCycles { get; set; }
        public DateTime? LastStartTime { get; set; }
        public DateTime? LastStopTime { get; set; }

        public double EnergyConsumed { get; set; }
        public double EnergyGenerated { get; set; }
        public double CurrentLoad { get; set; }
        public double AverageLoad { get; set; }
        public double PeakLoad { get; set; }

        // OEE Metrics
        public double Availability { get; set; }
        public double Performance { get; set; }
        public double Quality { get; set; }
        public double OEE => Availability * Performance * Quality / 10000; // Calculated property

        public double? MTBF { get; set; }
        public double? MTTR { get; set; }
    }

    public class SensorData
    {
        public int Id { get; set; }
        public int EquipmentId { get; set; }
        public virtual Equipment Equipment { get; set; } = null!;

        public string SensorId { get; set; } = "";
        public string Type { get; set; } = ""; // temperature, vibration, etc.
        public double Value { get; set; }
        public string Unit { get; set; } = "";
        public DateTime Timestamp { get; set; }
        public string Quality { get; set; } = "good"; // good, uncertain, bad
        public double? AnomalyScore { get; set; }
    }

    public class MaintenanceRecommendation
    {
        public string Title { get; set; } = "";
        public string Description { get; set; } = "";
        public int Priority { get; set; } // 1-5, 5 being highest
        public double EstimatedCost { get; set; }
        public DateTime? RecommendedDate { get; set; }
        public string Type { get; set; } = "preventive"; // preventive, predictive, corrective
        public string? EquipmentComponent { get; set; }
        public double? ConfidenceScore { get; set; }
    }

    public class Document
    {
        public int Id { get; set; }
        public int EquipmentId { get; set; }
        public virtual Equipment Equipment { get; set; } = null!;

        public string Name { get; set; } = "";
        public string Type { get; set; } = ""; // manual, report, certificate, etc.
        public string FilePath { get; set; } = "";
        public DateTime UploadedDate { get; set; }
        public string? UploadedBy { get; set; }
    }

    public class Anomaly
    {
        public int Id { get; set; }
        public int EquipmentId { get; set; }
        public virtual Equipment Equipment { get; set; } = null!;

        public string Type { get; set; } = "";
        public string Description { get; set; } = "";
        public double Severity { get; set; } // 0-1
        public DateTime DetectedAt { get; set; }
        public DateTime? ResolvedAt { get; set; }
        public bool IsActive => ResolvedAt == null;
    }

    public class DigitalTwinConfig
    {
        public int Id { get; set; }
        public int EquipmentId { get; set; }
        public virtual Equipment Equipment { get; set; } = null!;

        public string ModelUrl { get; set; } = "";
        public bool ScadaIntegration { get; set; }
        public bool RealtimeSync { get; set; }
        public bool PhysicsEnabled { get; set; }
        public string? Configuration { get; set; } // JSON for thermal/electrical models
    }

    // For complex configurations
    public class ThermalModel
    {
        public double AmbientTemp { get; set; }
        public double MaxTemp { get; set; }
        public string CoolingMethod { get; set; } = "air"; // air, liquid, hybrid
        public double ThermalCapacity { get; set; }
        public double DissipationRate { get; set; }
    }

    public class ElectricalModel
    {
        public double NominalVoltage { get; set; }
        public double NominalCurrent { get; set; }
        public double PowerFactor { get; set; }
        public string? HarmonicsProfile { get; set; } // JSON
        public string? InsulationData { get; set; } // JSON
    }

    public class HarmonicData
    {
        public int Order { get; set; }
        public double Magnitude { get; set; }
        public double Phase { get; set; }
    }

    public class HarmonicProfile
    {
        public List<HarmonicData> Harmonics { get; set; } = new();
        public double THD { get; set; }
    }
}
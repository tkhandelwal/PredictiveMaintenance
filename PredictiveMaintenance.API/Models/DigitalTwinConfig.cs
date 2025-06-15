namespace PredictiveMaintenance.API.Models
{
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

        // Navigation properties for complex models
        public virtual ThermalModel? ThermalModel { get; set; }
        public virtual ElectricalModel? ElectricalModel { get; set; }
    }

    public class ThermalModel
    {
        public int Id { get; set; }
        public int DigitalTwinConfigId { get; set; }
        public virtual DigitalTwinConfig DigitalTwinConfig { get; set; } = null!;

        public double AmbientTemp { get; set; }
        public double MaxTemp { get; set; }
        public string CoolingMethod { get; set; } = "air"; // air, liquid, hybrid
        public double ThermalCapacity { get; set; }
        public double DissipationRate { get; set; }
    }

    public class ElectricalModel
    {
        public int Id { get; set; }
        public int DigitalTwinConfigId { get; set; }
        public virtual DigitalTwinConfig DigitalTwinConfig { get; set; } = null!;

        public double NominalVoltage { get; set; }
        public double NominalCurrent { get; set; }
        public double PowerFactor { get; set; }
        public string? HarmonicsProfile { get; set; } // JSON string

        // Navigation property
        public virtual HarmonicProfile? Harmonics { get; set; }
    }

    public class HarmonicProfile
    {
        public int Id { get; set; }
        public int ElectricalModelId { get; set; }
        public virtual ElectricalModel ElectricalModel { get; set; } = null!;

        public double THD { get; set; } // Total Harmonic Distortion
        public virtual ICollection<HarmonicData> IndividualHarmonics { get; set; } = new List<HarmonicData>();
    }

    public class HarmonicData
    {
        public int Id { get; set; }
        public int HarmonicProfileId { get; set; }
        public virtual HarmonicProfile HarmonicProfile { get; set; } = null!;

        public int Order { get; set; }
        public double Magnitude { get; set; }
        public double Phase { get; set; }
        public double Limit { get; set; }
    }
}
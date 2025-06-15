// Models/Equipment.cs
using PredictiveMaintenance.API.Services.MachineLearning;
using System.ComponentModel.DataAnnotations;
using System.Reflection.Metadata;

namespace PredictiveMaintenance.API.Models
{
    public class Equipment
    {
        public int Id { get; set; }

        [Required]
        public string Name { get; set; } = "";

        public EquipmentType Type { get; set; }
        public string? SubType { get; set; }
        public string? SiteId { get; set; }
        public string? Location { get; set; }

        public DateTime InstallationDate { get; set; }
        public DateTime? LastMaintenanceDate { get; set; }

        public MaintenanceStatus Status { get; set; }

        public string? Manufacturer { get; set; }
        public string? Model { get; set; }
        public string? SerialNumber { get; set; }
        public string Criticality { get; set; } = "medium"; // low, medium, high, critical
        public double HealthScore { get; set; } = 100.0;

        // Navigation properties
        public virtual EquipmentSpecifications? Specifications { get; set; }
        public virtual OperationalData? OperationalData { get; set; }
        public virtual DigitalTwinConfig? DigitalTwin { get; set; }

        // Collections
        public virtual ICollection<SensorData> SensorData { get; set; } = new List<SensorData>();
        public virtual ICollection<MaintenanceEvent> MaintenanceHistory { get; set; } = new List<MaintenanceEvent>();
        public virtual ICollection<Document> Documents { get; set; } = new List<Document>();
        public virtual ICollection<Anomaly> ActiveAnomalies { get; set; } = new List<Anomaly>();
    }

    public enum EquipmentType
    {
        CircuitBreaker,
        Transformer,
        Motor,
        Cable,
        OverheadLine,
        SolarPanel,
        WindTurbine,
        BatteryStorage,
        Inverter,
        Generator,
        Switchgear,
        CapacitorBank,
        Reactor,
        BusBar,
        Isolator,
        VFD,
        MCC,
        RelayPanel,
        CentrifugalPump,
        ElectricMotor,
        AirCompressor,
        IndustrialFan
    }

    public enum MaintenanceStatus
    {
        Operational = 0,
        Warning = 1,
        Critical = 2,
        UnderMaintenance = 3,
        Offline = 4,
        Commissioning = 5,
        Unknown = 99
    }
}
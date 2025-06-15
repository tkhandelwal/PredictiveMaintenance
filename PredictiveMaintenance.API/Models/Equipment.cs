// Models/Equipment.cs
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Reflection.Metadata;

namespace PredictiveMaintenance.API.Models
{
    public class Equipment
    {
        public int Id { get; set; }

        [Required]
        [StringLength(100)]
        public string Name { get; set; } = "";

        [Required]
        public EquipmentType Type { get; set; }

        [StringLength(50)]
        public string? SubType { get; set; }

        [StringLength(50)]
        public string? SiteId { get; set; }

        [StringLength(200)]
        public string? Location { get; set; }

        [Required]
        public DateTime InstallationDate { get; set; }

        public DateTime? LastMaintenanceDate { get; set; }

        [Required]
        public EquipmentStatus Status { get; set; } = EquipmentStatus.Operational;

        [StringLength(100)]
        public string? Manufacturer { get; set; }

        [StringLength(100)]
        public string? Model { get; set; }

        [StringLength(100)]
        public string? SerialNumber { get; set; }

        [Required]
        [StringLength(20)]
        public string Criticality { get; set; } = "medium"; // low, medium, high, critical

        [Range(0, 100)]
        public double HealthScore { get; set; } = 100.0;

        // Additional properties for tracking
        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
        public DateTime? LastModifiedDate { get; set; }
        public string? CreatedBy { get; set; }
        public string? LastModifiedBy { get; set; }

        // Operational tracking
        public bool IsActive { get; set; } = true;
        public string? Notes { get; set; }

        // Navigation properties
        public virtual EquipmentSpecifications? Specifications { get; set; }
        public virtual OperationalData? OperationalData { get; set; }
        public virtual DigitalTwinConfig? DigitalTwin { get; set; }

        // Collections
        public virtual ICollection<SensorData> SensorData { get; set; } = new List<SensorData>();
        public virtual ICollection<MaintenanceEvent> MaintenanceHistory { get; set; } = new List<MaintenanceEvent>();
        public virtual ICollection<EquipmentDocument> Documents { get; set; } = new List<EquipmentDocument>();
        public virtual ICollection<Anomaly> ActiveAnomalies { get; set; } = new List<Anomaly>();
        public virtual ICollection<MaintenanceRecommendation> Recommendations { get; set; } = new List<MaintenanceRecommendation>();

        // Computed properties
        [NotMapped]
        public int DaysSinceLastMaintenance => LastMaintenanceDate.HasValue
            ? (int)(DateTime.UtcNow - LastMaintenanceDate.Value).TotalDays
            : -1;

        [NotMapped]
        public bool IsOverdue => DaysSinceLastMaintenance > GetMaintenanceIntervalDays();

        // Methods
        public int GetMaintenanceIntervalDays()
        {
            return Criticality?.ToLower() switch
            {
                "critical" => 30,
                "high" => 60,
                "medium" => 90,
                "low" => 180,
                _ => 90
            };
        }

        public bool IsElectricalEquipment()
        {
            return Type == EquipmentType.Transformer ||
                   Type == EquipmentType.CircuitBreaker ||
                   Type == EquipmentType.Motor ||
                   Type == EquipmentType.Generator ||
                   Type == EquipmentType.Switchgear ||
                   Type == EquipmentType.VFD ||
                   Type == EquipmentType.MCC ||
                   Type == EquipmentType.ElectricMotor;
        }

        public bool IsRotatingEquipment()
        {
            return Type == EquipmentType.Motor ||
                   Type == EquipmentType.Generator ||
                   Type == EquipmentType.CentrifugalPump ||
                   Type == EquipmentType.AirCompressor ||
                   Type == EquipmentType.IndustrialFan ||
                   Type == EquipmentType.ElectricMotor ||
                   Type == EquipmentType.WindTurbine;
        }

        public bool IsRenewableEnergy()
        {
            return Type == EquipmentType.SolarPanel ||
                   Type == EquipmentType.WindTurbine ||
                   Type == EquipmentType.BatteryStorage ||
                   Type == EquipmentType.Inverter;
        }
    }

    public enum EquipmentType
    {
        CircuitBreaker = 0,
        Transformer = 1,
        Motor = 2,
        Cable = 3,
        OverheadLine = 4,
        SolarPanel = 5,
        WindTurbine = 6,
        BatteryStorage = 7,
        Inverter = 8,
        Generator = 9,
        Switchgear = 10,
        CapacitorBank = 11,
        Reactor = 12,
        BusBar = 13,
        Isolator = 14,
        VFD = 15,
        MCC = 16,
        RelayPanel = 17,
        CentrifugalPump = 18,
        ElectricMotor = 19,
        AirCompressor = 20,
        IndustrialFan = 21
    }

    public enum EquipmentStatus
    {
        Operational = 0,
        Warning = 1,
        Critical = 2,
        UnderMaintenance = 3,
        Offline = 4,
        Commissioning = 5,
        Decommissioned = 6,
        Unknown = 99
    }
}
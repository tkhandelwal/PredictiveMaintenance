// Models/Equipment.cs
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

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

        // Enhanced location tracking
        public double? Latitude { get; set; }
        public double? Longitude { get; set; }

        [StringLength(50)]
        public string? Building { get; set; }

        [StringLength(50)]
        public string? Floor { get; set; }

        [StringLength(50)]
        public string? Room { get; set; }

        [StringLength(50)]
        public string? Rack { get; set; }

        [Required]
        public DateTime InstallationDate { get; set; }

        public DateTime? LastMaintenanceDate { get; set; }

        public DateTime? NextScheduledMaintenance { get; set; }

        [Required]
        public EquipmentStatus Status { get; set; } = EquipmentStatus.Operational;

        [StringLength(100)]
        public string? Manufacturer { get; set; }

        [StringLength(100)]
        public string? Model { get; set; }

        [StringLength(100)]
        public string? SerialNumber { get; set; }

        [StringLength(50)]
        public string? AssetTag { get; set; }

        [StringLength(100)]
        public string? PurchaseOrderNumber { get; set; }

        public decimal? PurchasePrice { get; set; }

        [Required]
        [StringLength(20)]
        public string Criticality { get; set; } = "medium"; // low, medium, high, critical

        [Range(0, 100)]
        public double HealthScore { get; set; } = 100.0;

        // Financial tracking
        public decimal? ResidualValue { get; set; }
        public int? WarrantyMonths { get; set; }
        public DateTime? WarrantyExpiry { get; set; }

        // Performance metrics
        public double? Efficiency { get; set; }
        public double? PowerFactor { get; set; }
        public double? LoadFactor { get; set; }

        // Environmental conditions
        public string? EnvironmentType { get; set; } // indoor, outdoor, hazardous, marine, etc.
        public string? IP_Rating { get; set; } // IP65, IP67, etc.
        public string? NEMA_Rating { get; set; } // NEMA 4X, etc.

        // Additional properties for tracking
        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
        public DateTime? LastModifiedDate { get; set; }
        public string? CreatedBy { get; set; }
        public string? LastModifiedBy { get; set; }

        // Operational tracking
        public bool IsActive { get; set; } = true;
        public bool IsCommissioned { get; set; } = false;
        public DateTime? CommissioningDate { get; set; }
        public string? Notes { get; set; }

        // Integration properties
        public string? SCADA_TagName { get; set; }
        public string? ERP_AssetId { get; set; }
        public string? CMMS_AssetId { get; set; }
        public string? IoT_DeviceId { get; set; }

        // Hierarchy relationships
        public int? ParentEquipmentId { get; set; }
        public virtual Equipment? ParentEquipment { get; set; }
        public virtual ICollection<Equipment> ChildEquipment { get; set; } = new List<Equipment>();

        // Navigation properties
        public virtual EquipmentSpecifications? Specifications { get; set; }
        public virtual OperationalData? OperationalData { get; set; }
        public virtual DigitalTwinConfig? DigitalTwin { get; set; }
        public virtual ProtectionSettings? ProtectionSettings { get; set; }
        public virtual CommunicationConfig? CommunicationConfig { get; set; }

        // Collections
        public virtual ICollection<SensorData> SensorData { get; set; } = new List<SensorData>();
        public virtual ICollection<MaintenanceEvent> MaintenanceHistory { get; set; } = new List<MaintenanceEvent>();
        public virtual ICollection<EquipmentDocument> Documents { get; set; } = new List<EquipmentDocument>();
        public virtual ICollection<Anomaly> ActiveAnomalies { get; set; } = new List<Anomaly>();
        public virtual ICollection<MaintenanceRecommendation> Recommendations { get; set; } = new List<MaintenanceRecommendation>();
        public virtual ICollection<EquipmentCertificate> Certificates { get; set; } = new List<EquipmentCertificate>();
        public virtual ICollection<EquipmentCalibration> Calibrations { get; set; } = new List<EquipmentCalibration>();
        public virtual ICollection<SparePartInventory> SpareParts { get; set; } = new List<SparePartInventory>();

        // Computed properties
        [NotMapped]
        public int DaysSinceLastMaintenance => LastMaintenanceDate.HasValue
            ? (int)(DateTime.UtcNow - LastMaintenanceDate.Value).TotalDays
            : -1;

        [NotMapped]
        public bool IsOverdue => NextScheduledMaintenance.HasValue &&
            DateTime.UtcNow > NextScheduledMaintenance.Value;

        [NotMapped]
        public int? DaysUntilWarrantyExpiry => WarrantyExpiry.HasValue
            ? (int)(WarrantyExpiry.Value - DateTime.UtcNow).TotalDays
            : null;

        [NotMapped]
        public bool IsUnderWarranty => WarrantyExpiry.HasValue &&
            DateTime.UtcNow < WarrantyExpiry.Value;

        [NotMapped]
        public double Age => (DateTime.UtcNow - InstallationDate).TotalDays / 365.25;

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
                   Type == EquipmentType.ElectricMotor ||
                   Type == EquipmentType.PowerTransformer ||
                   Type == EquipmentType.DistributionTransformer ||
                   Type == EquipmentType.InstrumentTransformer ||
                   Type == EquipmentType.Rectifier ||
                   Type == EquipmentType.UPS ||
                   Type == EquipmentType.Inverter ||
                   Type == EquipmentType.DCCharger ||
                   Type == EquipmentType.PowerSupply;
        }

        public bool IsRotatingEquipment()
        {
            return Type == EquipmentType.Motor ||
                   Type == EquipmentType.Generator ||
                   Type == EquipmentType.CentrifugalPump ||
                   Type == EquipmentType.PositiveDisplacementPump ||
                   Type == EquipmentType.AirCompressor ||
                   Type == EquipmentType.IndustrialFan ||
                   Type == EquipmentType.ElectricMotor ||
                   Type == EquipmentType.WindTurbine ||
                   Type == EquipmentType.GasTurbine ||
                   Type == EquipmentType.SteamTurbine ||
                   Type == EquipmentType.Blower ||
                   Type == EquipmentType.Mixer ||
                   Type == EquipmentType.Agitator ||
                   Type == EquipmentType.Centrifuge ||
                   Type == EquipmentType.Conveyor;
        }

        public bool IsRenewableEnergy()
        {
            return Type == EquipmentType.SolarPanel ||
                   Type == EquipmentType.SolarInverter ||
                   Type == EquipmentType.WindTurbine ||
                   Type == EquipmentType.BatteryStorage ||
                   Type == EquipmentType.BatteryInverter ||
                   Type == EquipmentType.HydrogenElectrolyzer ||
                   Type == EquipmentType.FuelCell ||
                   Type == EquipmentType.Inverter;
        }

        public bool RequiresCooling()
        {
            return Type == EquipmentType.Transformer ||
                   Type == EquipmentType.PowerTransformer ||
                   Type == EquipmentType.Motor ||
                   Type == EquipmentType.ElectricMotor ||
                   Type == EquipmentType.VFD ||
                   Type == EquipmentType.Rectifier ||
                   Type == EquipmentType.UPS ||
                   Type == EquipmentType.BatteryStorage ||
                   Type == EquipmentType.Inverter ||
                   Type == EquipmentType.SolarInverter ||
                   Type == EquipmentType.AirCompressor ||
                   (Type == EquipmentType.Generator && SubType != "Air-Cooled");
        }

        public bool RequiresLubrication()
        {
            return IsRotatingEquipment() ||
                   Type == EquipmentType.Gearbox ||
                   Type == EquipmentType.CircuitBreaker ||
                   Type == EquipmentType.DisconnectSwitch ||
                   Type == EquipmentType.LoadBreakSwitch;
        }

        public bool HasHarmonics()
        {
            return Type == EquipmentType.VFD ||
                   Type == EquipmentType.Rectifier ||
                   Type == EquipmentType.UPS ||
                   Type == EquipmentType.SolarInverter ||
                   Type == EquipmentType.BatteryInverter ||
                   Type == EquipmentType.DCCharger ||
                   Type == EquipmentType.LED_Lighting ||
                   Type == EquipmentType.ArcFurnace;
        }

        public string GetMaintenanceCategory()
        {
            if (IsRotatingEquipment()) return "Mechanical";
            if (IsElectricalEquipment()) return "Electrical";
            if (IsRenewableEnergy()) return "Renewable";
            if (Type.ToString().Contains("Instrument")) return "Instrumentation";
            if (Type.ToString().Contains("Protection")) return "Protection";
            return "General";
        }
    }

    public enum EquipmentType
    {
        // Circuit Protection (0-19)
        CircuitBreaker = 0,
        DisconnectSwitch = 1,
        LoadBreakSwitch = 2,
        Fuse = 3,
        Recloser = 4,
        Sectionalizer = 5,
        AutomaticTransferSwitch = 6,

        // Transformers (20-39)
        PowerTransformer = 20,
        DistributionTransformer = 21,
        InstrumentTransformer = 22,
        CurrentTransformer = 23,
        VoltageTransformer = 24,
        GroundingTransformer = 25,
        AutoTransformer = 26,
        ScottTransformer = 27,
        ZigzagTransformer = 28,

        // Motors (40-59)
        Motor = 40,
        ElectricMotor = 41,
        SynchronousMotor = 42,
        InductionMotor = 43,
        DCMotor = 44,
        ServoMotor = 45,
        StepperMotor = 46,
        LinearMotor = 47,

        // Cables and Lines (60-79)
        Cable = 60,
        OverheadLine = 61,
        UndergroundCable = 62,
        SubmarineCable = 63,
        FiberOpticCable = 64,
        ControlCable = 65,
        InstrumentationCable = 66,

        // Renewable Energy (80-99)
        SolarPanel = 80,
        SolarInverter = 81,
        WindTurbine = 82,
        WindInverter = 83,
        BatteryStorage = 84,
        BatteryInverter = 85,
        BatteryManagementSystem = 86,
        HydrogenElectrolyzer = 87,
        FuelCell = 88,

        // Power Electronics (100-119)
        Inverter = 100,
        Rectifier = 101,
        VFD = 102,
        SoftStarter = 103,
        DCCharger = 104,
        PowerSupply = 105,
        UPS = 106,
        StaticVarCompensator = 107,
        ActiveHarmonicFilter = 108,

        // Generators (120-139)
        Generator = 120,
        DieselGenerator = 121,
        GasGenerator = 122,
        SteamTurbine = 123,
        GasTurbine = 124,
        HydroTurbine = 125,
        CombinedCycleUnit = 126,

        // Switchgear and Panels (140-159)
        Switchgear = 140,
        MCC = 141,
        PanelBoard = 142,
        DistributionPanel = 143,
        ControlPanel = 144,
        RelayPanel = 145,
        MeteringPanel = 146,

        // Capacitors and Reactors (160-179)
        CapacitorBank = 160,
        Reactor = 161,
        ShuntReactor = 162,
        SeriesReactor = 163,
        SmoothingReactor = 164,

        // Busbars and Connections (180-199)
        BusBar = 180,
        BusDuct = 181,
        CableTray = 182,
        CableTermination = 183,
        Joint = 184,

        // Protection and Control (200-219)
        ProtectionRelay = 200,
        DifferentialRelay = 201,
        DistanceRelay = 202,
        OvercurrentRelay = 203,
        RTU = 204,
        IED = 205,
        MergingUnit = 206,

        // Pumps (220-239)
        CentrifugalPump = 220,
        PositiveDisplacementPump = 221,
        SubmersiblePump = 222,
        VacuumPump = 223,
        BoosterPump = 224,

        // Compressors and Fans (240-259)
        AirCompressor = 240,
        GasCompressor = 241,
        RefrigerationCompressor = 242,
        IndustrialFan = 243,
        Blower = 244,
        ExhaustFan = 245,

        // Heat Exchange Equipment (260-279)
        HeatExchanger = 260,
        Condenser = 261,
        Evaporator = 262,
        CoolingTower = 263,
        Radiator = 264,

        // Industrial Equipment (280-299)
        Conveyor = 280,
        Mixer = 281,
        Agitator = 282,
        Centrifuge = 283,
        Gearbox = 284,
        Coupling = 285,

        // Instrumentation (300-319)
        PressureTransmitter = 300,
        TemperatureTransmitter = 301,
        FlowMeter = 302,
        LevelTransmitter = 303,
        Analyzer = 304,
        ControlValve = 305,

        // Lighting (320-339)
        LED_Lighting = 320,
        HighBayLighting = 321,
        StreetLighting = 322,
        EmergencyLighting = 323,

        // Special Equipment (340-359)
        ArcFurnace = 340,
        InductionFurnace = 341,
        Electrolyzer = 342,
        Plating_Rectifier = 343,

        // Other (360+)
        Isolator = 360,
        SurgeArrester = 361,
        NeutralGroundingResistor = 362,
        PotentialTransformer = 363,
        Unknown = 999
    }

    public enum EquipmentStatus
    {
        Operational = 0,           // Normal operation
        Warning = 1,               // Minor issues detected
        Critical = 2,              // Major issues, immediate attention needed
        UnderMaintenance = 3,      // Currently being maintained
        Offline = 4,               // Not operating
        Commissioning = 5,         // Being commissioned
        Decommissioned = 6,        // Permanently out of service
        Standby = 7,               // Available but not in use
        Testing = 8,               // Under test
        Failed = 9,                // Complete failure
        ReducedCapacity = 10,      // Operating at reduced capacity
        StartingUp = 11,           // In startup sequence
        ShuttingDown = 12,         // In shutdown sequence
        EmergencyStop = 13,        // Emergency stopped
        Unknown = 99
    }
}
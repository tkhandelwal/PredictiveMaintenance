// Models/EquipmentTypes.cs
namespace PredictiveMaintenance.API.Models
{
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
        CentrifugalPump,  // Add your existing types
        AirCompressor,
        IndustrialFan,
        ElectricMotor
    }

    public class EquipmentSpecifications
    {
        public int Id { get; set; }
        public int EquipmentId { get; set; }
        public string? RatedPower { get; set; }
        public string? RatedVoltage { get; set; }
        public string? RatedCurrent { get; set; }
        public string? Frequency { get; set; }
        // Add more as needed
    }

    public class OperationalData
    {
        public int Id { get; set; }
        public int EquipmentId { get; set; }
        public double HoursRun { get; set; }
        public double Availability { get; set; }
        public double Performance { get; set; }
        public double Quality { get; set; }
        public double OEE { get; set; }
        public double EnergyConsumed { get; set; }
        public double EnergyGenerated { get; set; }
        public double CurrentLoad { get; set; }
        public double PeakLoad { get; set; }
    }

    public class MaintenanceRecommendation
    {
        public string Title { get; set; } = "";
        public string Description { get; set; } = "";
        public int Priority { get; set; }
        public double EstimatedCost { get; set; }
        public DateTime? RecommendedDate { get; set; }
    }
}
namespace PredictiveMaintenance.API.Models
{
    public class EquipmentSpecifications
    {
        public int Id { get; set; }
        public int EquipmentId { get; set; }
        public virtual Equipment Equipment { get; set; } = null!;

        public string? RatedPower { get; set; }
        public string? Power { get; set; } // Add this for compatibility
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

        public string? AdditionalSpecs { get; set; }
    }
}
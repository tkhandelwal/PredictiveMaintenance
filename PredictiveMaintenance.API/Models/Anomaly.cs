namespace PredictiveMaintenance.API.Models
{
    public class Anomaly
    {
        public int Id { get; set; }
        public int EquipmentId { get; set; }
        public string SensorType { get; set; } = "";
        public double Value { get; set; }
        public string ExpectedRange { get; set; } = "";
        public DateTime DetectedAt { get; set; }
        public string Severity { get; set; } = "";
        public string Description { get; set; } = "";
        public bool IsResolved { get; set; }
        public DateTime? ResolvedAt { get; set; }

        public virtual Equipment? Equipment { get; set; }
    }
}
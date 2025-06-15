namespace PredictiveMaintenance.API.Models
{
    public class SensorData
    {
        public int Id { get; set; }
        public int EquipmentId { get; set; }
        public virtual Equipment Equipment { get; set; } = null!;

        public string SensorId { get; set; } = "";
        public string Type { get; set; } = "";
        public double Value { get; set; }
        public string Unit { get; set; } = "";
        public DateTime Timestamp { get; set; }
        public string Quality { get; set; } = "good";
        public double? AnomalyScore { get; set; }
    }
}
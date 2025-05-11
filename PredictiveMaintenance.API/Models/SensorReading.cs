namespace PredictiveMaintenance.API.Models
{
    public class SensorReading
    {
        public long Id { get; set; }
        public int EquipmentId { get; set; }
        public DateTime Timestamp { get; set; }
        public string SensorType { get; set; }
        public double Value { get; set; }

        // For ML prediction
        public bool IsAnomaly { get; set; }
    }
}
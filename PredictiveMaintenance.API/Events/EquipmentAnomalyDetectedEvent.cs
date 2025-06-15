using MediatR;

namespace PredictiveMaintenance.API.Events
{
    public class EquipmentAnomalyDetectedEvent : INotification
    {
        public int EquipmentId { get; set; }
        public string EquipmentName { get; set; }
        public double AnomalyScore { get; set; }
        public DateTime DetectedAt { get; set; }
        public Dictionary<string, double> SensorReadings { get; set; }
        public string AnomalyType { get; set; } // Temperature, Vibration, Pressure, etc.

        public EquipmentAnomalyDetectedEvent()
        {
            DetectedAt = DateTime.UtcNow;
            SensorReadings = new Dictionary<string, double>();
        }
    }
}
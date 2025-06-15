namespace PredictiveMaintenance.API.Models
{
    public class OperationalData
    {
        public int Id { get; set; }
        public int EquipmentId { get; set; }
        public virtual Equipment Equipment { get; set; } = null!;

        public double HoursRun { get; set; }
        public int StartStopCycles { get; set; }
        public DateTime? LastStartTime { get; set; }
        public DateTime? LastStopTime { get; set; }

        public double EnergyConsumed { get; set; }
        public double EnergyGenerated { get; set; }
        public double CurrentLoad { get; set; }
        public double AverageLoad { get; set; }
        public double PeakLoad { get; set; }

        // OEE Metrics
        public double Availability { get; set; }
        public double Performance { get; set; }
        public double Quality { get; set; }

        // Change OEE to a regular property that can be set
        public double OEE { get; set; }

        public double? MTBF { get; set; }
        public double? MTTR { get; set; }

        // Add a method to calculate OEE when needed
        public void CalculateOEE()
        {
            OEE = (Availability * Performance * Quality) / 10000;
        }

        // Or use a property that allows both getting calculated value and setting
        public double CalculatedOEE => (Availability * Performance * Quality) / 10000;
    }
}
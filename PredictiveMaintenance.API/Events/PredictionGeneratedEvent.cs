using MediatR;

namespace PredictiveMaintenance.API.Events
{
    public class PredictionGeneratedEvent : INotification
    {
        public int EquipmentId { get; set; }
        public double FailureProbability { get; set; }
        public int EstimatedDaysToFailure { get; set; }
        public string RecommendedAction { get; set; }
        public DateTime PredictionGeneratedAt { get; set; }
        public List<string> FailureComponents { get; set; }

        public PredictionGeneratedEvent()
        {
            PredictionGeneratedAt = DateTime.UtcNow;
            FailureComponents = new List<string>();
        }
    }
}
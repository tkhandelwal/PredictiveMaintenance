using MediatR;

namespace PredictiveMaintenance.API.Events
{
    public enum MaintenancePriority
    {
        Low = 1,
        Medium = 2,
        High = 3,
        Critical = 4
    }

    public class MaintenanceRequiredEvent : INotification
    {
        public int EquipmentId { get; set; }
        public string EquipmentName { get; set; }
        public MaintenancePriority Priority { get; set; }
        public string MaintenanceType { get; set; }
        public DateTime RequiredBy { get; set; }
        public List<string> RequiredParts { get; set; }
        public double EstimatedDowntime { get; set; } // in hours

        public MaintenanceRequiredEvent()
        {
            RequiredParts = new List<string>();
        }
    }
}
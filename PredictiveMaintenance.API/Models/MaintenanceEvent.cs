namespace PredictiveMaintenance.API.Models
{
    public class MaintenanceEvent
    {
        public int Id { get; set; }
        public int EquipmentId { get; set; }
        public DateTime ScheduledDate { get; set; }
        public DateTime? CompletionDate { get; set; }
        public string Description { get; set; }
        public MaintenanceType Type { get; set; }
        public MaintenancePriority Priority { get; set; }
        public string AssignedTechnician { get; set; }
    }

    public enum MaintenanceType
    {
        Preventive,
        Predictive,
        Corrective,
        Emergency
    }

    public enum MaintenancePriority
    {
        Low,
        Medium,
        High,
        Critical
    }
}
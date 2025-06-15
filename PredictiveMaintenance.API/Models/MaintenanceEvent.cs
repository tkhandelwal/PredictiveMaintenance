namespace PredictiveMaintenance.API.Models
{
    public class MaintenanceEvent
    {
        public int Id { get; set; }
        public int EquipmentId { get; set; }
        public DateTime ScheduledDate { get; set; }
        public DateTime? CompletionDate { get; set; }
        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
        public string Description { get; set; } = "";
        public MaintenanceType Type { get; set; }
        public MaintenancePriority Priority { get; set; }
        public MaintenanceStatus Status { get; set; } = MaintenanceStatus.Scheduled;
        public string AssignedTechnician { get; set; } = "";
        public decimal Cost { get; set; }
        public double Duration { get; set; } // in hours
        public double EstimatedDuration { get; set; } // in hours

        // Navigation property
        public virtual Equipment? Equipment { get; set; }
    }

    public enum MaintenanceType
    {
        Preventive = 0,
        Predictive = 1,
        Corrective = 2,
        Emergency = 3
    }

    public enum MaintenancePriority
    {
        Low = 0,
        Medium = 1,
        High = 2,
        Critical = 3
    }

    public enum MaintenanceStatus
    {
        Scheduled = 0,
        InProgress = 1,
        Completed = 2,
        Cancelled = 3,
        Overdue = 4
    }
}
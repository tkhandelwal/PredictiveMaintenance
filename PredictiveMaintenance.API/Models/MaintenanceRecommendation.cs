namespace PredictiveMaintenance.API.Models
{
    public class MaintenanceRecommendation
    {
        public int Id { get; set; }
        public int EquipmentId { get; set; }
        public string Title { get; set; } = "";
        public string Description { get; set; } = "";
        public MaintenancePriority Priority { get; set; } // Use enum instead of int
        public double EstimatedCost { get; set; }
        public double EstimatedDuration { get; set; } // in hours
        public DateTime? RecommendedDate { get; set; }
        public string Type { get; set; } = "preventive"; // Add Type property
        public List<string> Actions { get; set; } = new List<string>();
        public string? EquipmentComponent { get; set; }
        public double? ConfidenceScore { get; set; }

        // Navigation property
        public virtual Equipment? Equipment { get; set; }
    }
}
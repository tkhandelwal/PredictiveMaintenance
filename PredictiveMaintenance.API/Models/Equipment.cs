
namespace PredictiveMaintenance.API.Models
{
    public class Equipment
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string Type { get; set; }
        public DateTime InstallationDate { get; set; }
        public DateTime? LastMaintenanceDate { get; set; }
        public MaintenanceStatus Status { get; set; }
    }

    public enum MaintenanceStatus
    {
        Operational,
        Warning,
        Critical,
        UnderMaintenance
    }
}
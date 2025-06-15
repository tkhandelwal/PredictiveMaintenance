// Models/EquipmentCertificate.cs
namespace PredictiveMaintenance.API.Models
{
    public class EquipmentCertificate
    {
        public int Id { get; set; }
        public int EquipmentId { get; set; }
        public virtual Equipment Equipment { get; set; } = null!;

        public string CertificateType { get; set; } = "";  // Calibration, Inspection, Test
        public string CertificateNumber { get; set; } = "";
        public string IssuingAuthority { get; set; } = "";
        public DateTime IssueDate { get; set; }
        public DateTime ExpiryDate { get; set; }
        public string Status { get; set; } = "Valid";      // Valid, Expired, Revoked
        public string? FilePath { get; set; }
        public string? Notes { get; set; }
    }
}
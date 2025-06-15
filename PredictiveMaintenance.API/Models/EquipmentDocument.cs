namespace PredictiveMaintenance.API.Models
{
    public class EquipmentDocument  // Renamed from Document
    {
        public int Id { get; set; }
        public int EquipmentId { get; set; }
        public virtual Equipment Equipment { get; set; } = null!;

        public string Name { get; set; } = "";
        public string Type { get; set; } = ""; // manual, report, certificate, etc.
        public string FilePath { get; set; } = "";
        public DateTime UploadedDate { get; set; }
        public string? UploadedBy { get; set; }
        public long? FileSize { get; set; }
        public string? MimeType { get; set; }
    }
}
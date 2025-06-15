using System;
using System.ComponentModel.DataAnnotations;

namespace PredictiveMaintenance.API.Models
{
    public class Document
    {
        public int Id { get; set; }

        [Required]
        public int EquipmentId { get; set; }

        [Required]
        [StringLength(255)]
        public string Name { get; set; } = "";

        [Required]
        [StringLength(50)]
        public string Type { get; set; } = ""; // manual, report, certificate, datasheet, etc.

        [Required]
        [StringLength(500)]
        public string FilePath { get; set; } = "";

        [Required]
        public DateTime UploadedDate { get; set; } = DateTime.UtcNow;

        [StringLength(100)]
        public string? UploadedBy { get; set; }

        public long? FileSize { get; set; }

        [StringLength(100)]
        public string? MimeType { get; set; }

        [StringLength(1000)]
        public string? Description { get; set; }

        [StringLength(500)]
        public string? Tags { get; set; } // Comma-separated tags

        public bool IsActive { get; set; } = true;

        // Navigation property
        public virtual Equipment Equipment { get; set; } = null!;
    }
}
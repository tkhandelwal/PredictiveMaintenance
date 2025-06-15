// Models/EquipmentCalibration.cs
namespace PredictiveMaintenance.API.Models
{
    public class EquipmentCalibration
    {
        public int Id { get; set; }
        public int EquipmentId { get; set; }
        public virtual Equipment Equipment { get; set; } = null!;

        public DateTime CalibrationDate { get; set; }
        public DateTime NextCalibrationDue { get; set; }
        public string CalibratedBy { get; set; } = "";
        public string CalibrationStandard { get; set; } = "";
        public string CalibrationProcedure { get; set; } = "";

        // Calibration results
        public string? AsFoundCondition { get; set; }
        public string? AsLeftCondition { get; set; }
        public double? AsFoundError { get; set; }          // %
        public double? AsLeftError { get; set; }           // %
        public bool PassFail { get; set; }

        public string? CalibrationCertificate { get; set; }
        public string? CalibrationReport { get; set; }
        public string? Notes { get; set; }
    }
}
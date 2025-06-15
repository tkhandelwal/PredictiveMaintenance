// Models/SparePartInventory.cs
namespace PredictiveMaintenance.API.Models
{
    public class SparePartInventory
    {
        public int Id { get; set; }
        public int EquipmentId { get; set; }
        public virtual Equipment Equipment { get; set; } = null!;

        public string PartNumber { get; set; } = "";
        public string PartDescription { get; set; } = "";
        public string Manufacturer { get; set; } = "";
        public string Category { get; set; } = "";          // Critical, Essential, Consumable

        public int QuantityOnHand { get; set; }
        public int MinimumStock { get; set; }
        public int MaximumStock { get; set; }
        public int ReorderPoint { get; set; }
        public int ReorderQuantity { get; set; }

        public decimal UnitPrice { get; set; }
        public string? SupplierName { get; set; }
        public string? SupplierPartNumber { get; set; }
        public int? LeadTimeDays { get; set; }

        public string? StorageLocation { get; set; }
        public string? BinNumber { get; set; }
        public DateTime? LastRestockDate { get; set; }
        public DateTime? LastUsedDate { get; set; }

        public string? Notes { get; set; }
    }
}
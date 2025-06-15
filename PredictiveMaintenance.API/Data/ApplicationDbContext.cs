using Microsoft.EntityFrameworkCore;
using PredictiveMaintenance.API.Models;

namespace PredictiveMaintenance.API.Data
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
            : base(options)
        {
        }

        // Core entities
        public DbSet<Equipment> Equipment { get; set; }
        public DbSet<MaintenanceEvent> MaintenanceEvents { get; set; }
        public DbSet<EquipmentSpecifications> EquipmentSpecifications { get; set; }
        public DbSet<OperationalData> OperationalData { get; set; }
        public DbSet<SensorData> SensorData { get; set; }
        public DbSet<SensorReading> SensorReadings { get; set; }
        public DbSet<PredictiveMaintenance.API.Models.Document> Documents { get; set; }
        public DbSet<Anomaly> Anomalies { get; set; }

        // Digital Twin related
        public DbSet<DigitalTwinConfig> DigitalTwinConfigs { get; set; }
        public DbSet<ThermalModel> ThermalModels { get; set; }
        public DbSet<ElectricalModel> ElectricalModels { get; set; }
        public DbSet<HarmonicProfile> HarmonicProfiles { get; set; }
        public DbSet<HarmonicData> HarmonicData { get; set; }

        // Maintenance related
        public DbSet<MaintenanceRecommendation> MaintenanceRecommendations { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Configure relationships
            modelBuilder.Entity<Equipment>()
                .HasOne(e => e.Specifications)
                .WithOne(s => s.Equipment)
                .HasForeignKey<EquipmentSpecifications>(s => s.EquipmentId);

            modelBuilder.Entity<Equipment>()
                .HasOne(e => e.OperationalData)
                .WithOne(o => o.Equipment)
                .HasForeignKey<OperationalData>(o => o.EquipmentId);

            modelBuilder.Entity<Equipment>()
                .HasOne(e => e.DigitalTwin)
                .WithOne(d => d.Equipment)
                .HasForeignKey<DigitalTwinConfig>(d => d.EquipmentId);

            // Configure enum conversions
            modelBuilder.Entity<Equipment>()
                .Property(e => e.Type)
                .HasConversion<string>();

            modelBuilder.Entity<Equipment>()
                .Property(e => e.Status)
                .HasConversion<string>();

            modelBuilder.Entity<MaintenanceEvent>()
                .Property(e => e.Type)
                .HasConversion<string>();

            modelBuilder.Entity<MaintenanceEvent>()
                .Property(e => e.Priority)
                .HasConversion<string>();

            modelBuilder.Entity<MaintenanceEvent>()
                .Property(e => e.Status)
                .HasConversion<string>();
        }
    }
}
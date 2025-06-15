// Data/ApplicationDbContext.cs
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

        public DbSet<Equipment> Equipment { get; set; }
        public DbSet<MaintenanceEvent> MaintenanceEvents { get; set; }
        public DbSet<EquipmentSpecifications> EquipmentSpecifications { get; set; }
        public DbSet<OperationalData> OperationalData { get; set; }
        public DbSet<SensorData> SensorData { get; set; }
        public DbSet<Document> Documents { get; set; }
        public DbSet<Anomaly> Anomalies { get; set; }
        public DbSet<DigitalTwinConfig> DigitalTwinConfigs { get; set; }

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

            // Seed data
            modelBuilder.Entity<Equipment>().HasData(
                new Equipment
                {
                    Id = 1,
                    Name = "Pump 1",
                    Type = EquipmentType.CentrifugalPump,
                    SiteId = "SITE001",
                    Location = "Building A - Floor 1",
                    InstallationDate = DateTime.UtcNow.AddYears(-2),
                    LastMaintenanceDate = DateTime.UtcNow.AddMonths(-3),
                    Status = MaintenanceStatus.Operational,
                    Manufacturer = "PumpCo",
                    Model = "CP-2000",
                    SerialNumber = "CP2000-001",
                    Criticality = "high",
                    HealthScore = 85.5
                },
                new Equipment
                {
                    Id = 2,
                    Name = "Motor 1",
                    Type = EquipmentType.Motor,
                    SiteId = "SITE001",
                    Location = "Building A - Floor 1",
                    InstallationDate = DateTime.UtcNow.AddYears(-1),
                    LastMaintenanceDate = DateTime.UtcNow.AddMonths(-1),
                    Status = MaintenanceStatus.Operational,
                    Manufacturer = "MotorTech",
                    Model = "MT-500HP",
                    SerialNumber = "MT500-2023-001",
                    Criticality = "critical",
                    HealthScore = 92.0
                }
            );

            // Seed operational data
            modelBuilder.Entity<OperationalData>().HasData(
                new OperationalData
                {
                    Id = 1,
                    EquipmentId = 1,
                    HoursRun = 12500,
                    StartStopCycles = 3200,
                    EnergyConsumed = 450000,
                    CurrentLoad = 75,
                    AverageLoad = 68,
                    PeakLoad = 95,
                    Availability = 98.5,
                    Performance = 94.2,
                    Quality = 99.1
                },
                new OperationalData
                {
                    Id = 2,
                    EquipmentId = 2,
                    HoursRun = 8760,
                    StartStopCycles = 1200,
                    EnergyConsumed = 850000,
                    CurrentLoad = 82,
                    AverageLoad = 78,
                    PeakLoad = 100,
                    Availability = 99.2,
                    Performance = 96.5,
                    Quality = 99.8
                }
            );

            // Seed specifications
            modelBuilder.Entity<EquipmentSpecifications>().HasData(
                new EquipmentSpecifications
                {
                    Id = 1,
                    EquipmentId = 1,
                    RatedPower = "75 kW",
                    RatedVoltage = "480V",
                    RatedCurrent = "150A",
                    Frequency = "60Hz"
                },
                new EquipmentSpecifications
                {
                    Id = 2,
                    EquipmentId = 2,
                    RatedPower = "500 HP",
                    RatedVoltage = "4160V",
                    RatedCurrent = "85A",
                    Frequency = "60Hz",
                    HP = 500,
                    RPM = "1800",
                    Efficiency = "95.5%",
                    PowerFactor = "0.92"
                }
            );
        }
    }
}
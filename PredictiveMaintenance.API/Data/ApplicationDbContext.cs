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

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Seed some initial data
            modelBuilder.Entity<Equipment>().HasData(
                new Equipment
                {
                    Id = 1,
                    Name = "Pump 1",
                    Type = "Centrifugal Pump",
                    InstallationDate = DateTime.UtcNow.AddYears(-2),
                    LastMaintenanceDate = DateTime.UtcNow.AddMonths(-3),
                    Status = MaintenanceStatus.Operational
                },
                new Equipment
                {
                    Id = 2,
                    Name = "Motor 1",
                    Type = "Electric Motor",
                    InstallationDate = DateTime.UtcNow.AddYears(-1),
                    LastMaintenanceDate = DateTime.UtcNow.AddMonths(-1),
                    Status = MaintenanceStatus.Operational
                },
                new Equipment
                {
                    Id = 3,
                    Name = "Compressor 1",
                    Type = "Air Compressor",
                    InstallationDate = DateTime.UtcNow.AddYears(-3),
                    LastMaintenanceDate = DateTime.UtcNow.AddMonths(-6),
                    Status = MaintenanceStatus.Warning
                },
                new Equipment
                {
                    Id = 4,
                    Name = "Fan 1",
                    Type = "Industrial Fan",
                    InstallationDate = DateTime.UtcNow.AddMonths(-11),
                    LastMaintenanceDate = DateTime.UtcNow.AddMonths(-2),
                    Status = MaintenanceStatus.Operational
                }
            );
        }
    }
}
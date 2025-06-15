using PredictiveMaintenance.API.Models;

namespace PredictiveMaintenance.API.Data
{
    public static class DbInitializer
    {
        public static void Initialize(ApplicationDbContext context)
        {
            context.Database.EnsureCreated();

            // Check if data already exists
            if (context.Equipment.Any())
            {
                return; // DB has been seeded
            }

            // Seed Equipment
            var equipment = new[]
            {
                new Equipment
                {
                    Name = "Main Production Motor",
                    Type = EquipmentType.Motor,
                    SubType = "Induction Motor",
                    SiteId = "SITE001",
                    Location = "Building A, Floor 1",
                    InstallationDate = DateTime.UtcNow.AddYears(-5),
                    Status = EquipmentStatus.Operational,
                    Manufacturer = "ABB",
                    Model = "M3BP 355 SMB",
                    SerialNumber = "MOT-2019-001",
                    Criticality = "critical",
                    HealthScore = 85.0,
                    Specifications = new EquipmentSpecifications
                    {
                        RatedPower = "250 kW",
                        RatedVoltage = "400 V",
                        RatedCurrent = "450 A",
                        Frequency = "50 Hz",
                        RatedSpeed = "1485 RPM",
                        HP = 335,
                        Efficiency = "96.5%",
                        PowerFactor = "0.89"
                    },
                    OperationalData = new OperationalData
                    {
                        HoursRun = 43800,
                        StartStopCycles = 1250,
                        EnergyConsumed = 9500000,
                        CurrentLoad = 75,
                        AverageLoad = 70,
                        PeakLoad = 95,
                        Availability = 98.5,
                        Performance = 92.0,
                        Quality = 99.0
                    }
                },
                new Equipment
                {
                    Name = "Distribution Transformer T1",
                    Type = EquipmentType.Transformer,
                    SubType = "Oil-Immersed",
                    SiteId = "SITE001",
                    Location = "Substation 1",
                    InstallationDate = DateTime.UtcNow.AddYears(-10),
                    Status = EquipmentStatus.Operational,
                    Manufacturer = "Siemens",
                    Model = "GEAFOL",
                    SerialNumber = "TRF-2014-001",
                    Criticality = "critical",
                    HealthScore = 78.0,
                    Specifications = new EquipmentSpecifications
                    {
                        ApparentPower = "1000 kVA",
                        PrimaryVoltage = "11 kV",
                        SecondaryVoltage = "0.4 kV",
                        VectorGroup = "Dyn11",
                        CoolingType = "ONAN",
                        ImpedanceVoltage = "6%"
                    },
                    OperationalData = new OperationalData
                    {
                        HoursRun = 87600,
                        EnergyConsumed = 500000,
                        CurrentLoad = 65,
                        AverageLoad = 60,
                        PeakLoad = 85,
                        CurrentEfficiency = 98.2
                    }
                },
                new Equipment
                {
                    Name = "Centrifugal Pump P-101",
                    Type = EquipmentType.CentrifugalPump,
                    SubType = "Single Stage",
                    SiteId = "SITE001",
                    Location = "Pump House 1",
                    InstallationDate = DateTime.UtcNow.AddYears(-3),
                    Status = EquipmentStatus.Operational,
                    Manufacturer = "Grundfos",
                    Model = "NK 125-315",
                    SerialNumber = "PUMP-2021-001",
                    Criticality = "high",
                    HealthScore = 90.0,
                    Specifications = new EquipmentSpecifications
                    {
                        RatedPower = "75 kW",
                        RatedSpeed = "2980 RPM"
                    }
                }
            };

            context.Equipment.AddRange(equipment);
            context.SaveChanges();

            // Seed some maintenance history
            var maintenanceEvents = new[]
            {
                new MaintenanceEvent
                {
                    EquipmentId = 1,
                    ScheduledDate = DateTime.UtcNow.AddMonths(-6),
                    CompletionDate = DateTime.UtcNow.AddMonths(-6).AddDays(1),
                    Description = "Routine bearing inspection and lubrication",
                    Type = MaintenanceType.Preventive,
                    Priority = MaintenancePriority.Medium,
                    Status = MaintenanceStatus.Completed,
                    AssignedTechnician = "John Smith",
                    Cost = 500,
                    Duration = 4
                },
                new MaintenanceEvent
                {
                    EquipmentId = 2,
                    ScheduledDate = DateTime.UtcNow.AddMonths(-3),
                    CompletionDate = DateTime.UtcNow.AddMonths(-3),
                    Description = "Oil sampling and analysis",
                    Type = MaintenanceType.Predictive,
                    Priority = MaintenancePriority.High,
                    Status = MaintenanceStatus.Completed,
                    AssignedTechnician = "Jane Doe",
                    Cost = 800,
                    Duration = 2
                }
            };

            context.MaintenanceEvents.AddRange(maintenanceEvents);
            context.SaveChanges();
        }
    }
}
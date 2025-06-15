// Models/EquipmentSpecifications.cs
namespace PredictiveMaintenance.API.Models
{
    public class EquipmentSpecifications
    {
        public int Id { get; set; }
        public int EquipmentId { get; set; }
        public virtual Equipment Equipment { get; set; } = null!;

        // Power specifications
        public string? RatedPower { get; set; }      // kW, MW, HP
        public string? ApparentPower { get; set; }   // kVA, MVA
        public string? ReactivePower { get; set; }   // kVAR, MVAR

        // Voltage specifications
        public string? RatedVoltage { get; set; }    // V, kV
        public string? PrimaryVoltage { get; set; }  // For transformers
        public string? SecondaryVoltage { get; set; }
        public string? TertiaryVoltage { get; set; }
        public string? VoltageRange { get; set; }    // Min-Max

        // Current specifications
        public string? RatedCurrent { get; set; }    // A, kA
        public string? PrimaryCurrent { get; set; }
        public string? SecondaryCurrent { get; set; }
        public string? ShortCircuitCurrent { get; set; }
        public string? InrushCurrent { get; set; }

        // Frequency and speed
        public string? Frequency { get; set; }       // Hz
        public string? FrequencyRange { get; set; }  // 47-52 Hz
        public string? RatedSpeed { get; set; }      // RPM
        public string? SynchronousSpeed { get; set; }
        public string? SpeedRange { get; set; }      // Min-Max RPM

        // Motor specific
        public double? HP { get; set; }
        public string? Poles { get; set; }
        public string? Slip { get; set; }            // %
        public string? ServiceFactor { get; set; }
        public string? Efficiency { get; set; }      // % at different loads
        public string? PowerFactor { get; set; }     // at different loads
        public string? StartingTorque { get; set; }  // % of rated
        public string? BreakdownTorque { get; set; } // % of rated
        public string? LockedRotorCode { get; set; } // A-V
        public string? Insulation { get; set; }      // Class F, H
        public string? Enclosure { get; set; }       // TEFC, ODP
        public string? Frame { get; set; }           // NEMA frame size
        public string? MountingType { get; set; }    // Horizontal, Vertical

        // Transformer specific
        public string? VectorGroup { get; set; }     // Dyn11, YNyn0
        public string? TapSettings { get; set; }     // +/-2.5%, 5%
        public string? CoolingType { get; set; }     // ONAN, ONAF, OFAF
        public string? ImpedanceVoltage { get; set; }// % Uk
        public string? NoLoadLosses { get; set; }    // kW
        public string? LoadLosses { get; set; }      // kW
        public string? BIL_Rating { get; set; }      // kV
        public string? TemperatureRise { get; set; } // K

        // Cable specific
        public string? ConductorMaterial { get; set; }  // Copper, Aluminum
        public string? ConductorSize { get; set; }      // mm², AWG
        public string? NumberOfCores { get; set; }      // 1, 3, 4
        public string? VoltageRating { get; set; }      // 0.6/1kV, etc
        public string? InsulationType { get; set; }     // XLPE, PVC, EPR
        public string? ArmourType { get; set; }         // SWA, STA
        public string? ScreenType { get; set; }         // Copper tape, wire
        public string? CableLength { get; set; }        // m, km
        public string? InstallationType { get; set; }   // Direct buried, tray

        // Protection equipment specific
        public string? BreakingCapacity { get; set; }   // kA
        public string? MakingCapacity { get; set; }     // kA
        public string? OperatingMechanism { get; set; } // Spring, Hydraulic
        public string? InterruptingMedium { get; set; } // SF6, Vacuum, Oil
        public string? RatedOperatingSequence { get; set; } // O-0.3s-CO-3min-CO

        // Generator specific
        public string? PrimeMover { get; set; }         // Diesel, Gas, Steam
        public string? FuelType { get; set; }           // Diesel, Natural Gas
        public string? FuelConsumption { get; set; }    // L/hr, m³/hr
        public string? Excitation { get; set; }         // Brushless, Static
        public string? AVR_Type { get; set; }           // Digital, Analog

        // Battery specific
        public string? BatteryType { get; set; }        // Li-ion, Lead Acid
        public string? CellChemistry { get; set; }      // NMC, LFP
        public string? Capacity { get; set; }           // Ah, kWh
        public string? NominalVoltage { get; set; }     // VDC
        public string? ChargingVoltage { get; set; }    // VDC
        public string? MaxChargeCurrent { get; set; }   // A
        public string? MaxDischargeCurrent { get; set; }// A
        public string? CycleLife { get; set; }          // cycles
        public string? DOD_Rating { get; set; }         // % Depth of Discharge

        // Solar specific
        public string? ModuleType { get; set; }         // Mono, Poly, Thin-film
        public string? PeakPower { get; set; }          // Wp
        public string? OpenCircuitVoltage { get; set; } // Voc
        public string? ShortCircuitCurrent_Solar { get; set; }  // Isc
        public string? MPPT_Voltage { get; set; }       // Vmpp
        public string? MPPT_Current { get; set; }       // Impp
        public string? TempCoefficient_Voc { get; set; }// %/°C
        public string? TempCoefficient_Isc { get; set; }// %/°C

        // Wind turbine specific
        public string? RotorDiameter { get; set; }      // m
        public string? HubHeight { get; set; }          // m
        public string? CutInSpeed { get; set; }         // m/s
        public string? RatedWindSpeed { get; set; }     // m/s
        public string? CutOutSpeed { get; set; }        // m/s
        public string? SurvivalWindSpeed { get; set; }  // m/s

        // VFD/Inverter specific
        public string? ControlMethod { get; set; }      // V/F, Vector, DTC
        public string? InputVoltageRange { get; set; }  // V
        public string? OutputVoltageRange { get; set; } // V
        public string? OutputFrequencyRange { get; set; }// Hz
        public string? SwitchingFrequency { get; set; } // kHz
        public string? Harmonics_THD { get; set; }      // %

        // Physical specifications
        public string? Dimensions { get; set; }         // LxWxH mm
        public string? Weight { get; set; }             // kg
        public string? Color { get; set; }              // RAL code
        public string? Material { get; set; }           // Steel, Aluminum

        // Environmental specifications
        public string? OperatingTempRange { get; set; } // °C
        public string? StorageTempRange { get; set; }   // °C
        public string? HumidityRange { get; set; }      // % RH
        public string? AltitudeRating { get; set; }     // m
        public string? SeismicRating { get; set; }      // Zone
        public string? CorrosionClass { get; set; }     // C1-C5

        // Standards and certifications
        public string? Standards { get; set; }          // IEC, IEEE, NEMA
        public string? CertificationMarks { get; set; } // CE, UL, CSA

        // Communication specifications
        public string? CommunicationProtocols { get; set; } // Modbus, IEC61850
        public string? NetworkInterfaces { get; set; }      // Ethernet, RS485

        // Additional specifications
        public string? AdditionalSpecs { get; set; }    // JSON for any other specs
    }
}
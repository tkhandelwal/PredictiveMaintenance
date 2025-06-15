// Models/CommunicationConfig.cs
namespace PredictiveMaintenance.API.Models
{
    public class CommunicationConfig
    {
        public int Id { get; set; }
        public int EquipmentId { get; set; }
        public virtual Equipment Equipment { get; set; } = null!;

        // Protocol configurations
        public string? PrimaryProtocol { get; set; }     // IEC61850, Modbus, DNP3
        public string? SecondaryProtocol { get; set; }

        // IEC 61850 configuration
        public string? IED_Name { get; set; }
        public string? LogicalDevice { get; set; }
        public string? SCL_File { get; set; }
        public string? GOOSE_AppID { get; set; }
        public string? SampledValues_AppID { get; set; }

        // Modbus configuration
        public int? ModbusAddress { get; set; }
        public string? ModbusBaudRate { get; set; }
        public string? ModbusParity { get; set; }
        public string? ModbusDataBits { get; set; }
        public string? ModbusStopBits { get; set; }

        // Network configuration
        public string? IPAddress { get; set; }
        public string? SubnetMask { get; set; }
        public string? DefaultGateway { get; set; }
        public string? MACAddress { get; set; }
        public int? Port { get; set; }

        // DNP3 configuration
        public int? DNP3_MasterAddress { get; set; }
        public int? DNP3_SlaveAddress { get; set; }

        // SNMP configuration
        public string? SNMP_Community { get; set; }
        public string? SNMP_Version { get; set; }

        // Security
        public bool EncryptionEnabled { get; set; }
        public string? EncryptionType { get; set; }
        public bool AuthenticationEnabled { get; set; }
        public string? AuthenticationType { get; set; }

        // Data points
        public string? DataPointMapping { get; set; }    // JSON mapping
        public int? PollingInterval { get; set; }        // seconds
        public int? ResponseTimeout { get; set; }        // milliseconds
    }
}
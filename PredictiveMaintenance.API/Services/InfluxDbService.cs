using InfluxDB.Client;
using InfluxDB.Client.Api.Domain;
using InfluxDB.Client.Writes;
using PredictiveMaintenance.API.Models;
using System.Text;

namespace PredictiveMaintenance.API.Services
{
    public interface IInfluxDbService
    {
        Task WriteSensorReadingAsync(SensorReading reading);
        Task<List<SensorReading>> GetReadingsForEquipmentAsync(int equipmentId, DateTime from, DateTime to);
        Task<List<SensorReading>> GetLatestReadingsAsync(int limit = 100);
    }

    public class InfluxDbService : IInfluxDbService
    {
        private readonly string _url;
        private readonly string _token;
        private readonly string _bucket;
        private readonly string _org;
        private readonly ILogger<InfluxDbService> _logger;

        public InfluxDbService(IConfiguration configuration, ILogger<InfluxDbService> logger)
        {
            _url = configuration["InfluxDB:Url"] ?? "http://localhost:8086";
            _token = configuration["InfluxDB:Token"] ?? "your-token";
            _bucket = configuration["InfluxDB:Bucket"] ?? "equipment_monitoring";
            _org = configuration["InfluxDB:Org"] ?? "your-org";
            _logger = logger;
        }

        public async Task WriteSensorReadingAsync(SensorReading reading)
        {
            try
            {
                using var client = new InfluxDBClient(_url, _token);
                var point = PointData.Measurement("sensor_readings")
                    .Tag("equipment_id", reading.EquipmentId.ToString())
                    .Tag("sensor_type", reading.SensorType)
                    .Field("value", reading.Value)
                    .Timestamp(reading.Timestamp, WritePrecision.Ms);

                await client.GetWriteApiAsync().WritePointAsync(point, _bucket, _org);
                _logger.LogDebug($"Successfully wrote reading for equipment {reading.EquipmentId} to InfluxDB");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error writing sensor reading to InfluxDB for equipment {reading.EquipmentId}");
                throw;
            }
        }

        public async Task<List<SensorReading>> GetReadingsForEquipmentAsync(int equipmentId, DateTime from, DateTime to)
        {
            var readings = new List<SensorReading>();
            try
            {
                using var client = new InfluxDBClient(_url, _token);

                var query = new StringBuilder();
                query.AppendLine($"from(bucket: \"{_bucket}\")");
                query.AppendLine($"|> range(start: {from:yyyy-MM-ddTHH:mm:ssZ}, stop: {to:yyyy-MM-ddTHH:mm:ssZ})");
                query.AppendLine($"|> filter(fn: (r) => r._measurement == \"sensor_readings\" and r.equipment_id == \"{equipmentId}\")");
                query.AppendLine("|> pivot(rowKey:[\"_time\"], columnKey: [\"sensor_type\"], valueColumn: \"_value\")");

                var queryApi = client.GetQueryApi();
                var tables = await queryApi.QueryAsync(query.ToString(), _org);

                foreach (var table in tables)
                {
                    foreach (var record in table.Records)
                    {
                        // Safe extraction of values with null checking
                        var equipmentIdValue = record.GetValueByKey("equipment_id")?.ToString();
                        var timeValue = record.GetTime();
                        var recordValue = record.GetValue();

                        if (!string.IsNullOrEmpty(equipmentIdValue) && timeValue.HasValue && recordValue != null)
                        {
                            readings.Add(new SensorReading
                            {
                                EquipmentId = int.Parse(equipmentIdValue),
                                Timestamp = timeValue.Value.ToDateTimeUtc(),
                                SensorType = "temperature", // Simplified for this example
                                Value = Convert.ToDouble(recordValue)
                            });
                        }
                        else
                        {
                            _logger.LogWarning("Skipping record with missing values in GetReadingsForEquipmentAsync");
                        }
                    }
                }

                return readings;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error fetching readings for equipment {equipmentId} from InfluxDB");
                return readings; // Return empty list on error
            }
        }

        public async Task<List<SensorReading>> GetLatestReadingsAsync(int limit = 100)
        {
            var readings = new List<SensorReading>();
            try
            {
                using var client = new InfluxDBClient(_url, _token);

                var query = new StringBuilder();
                query.AppendLine($"from(bucket: \"{_bucket}\")");
                query.AppendLine("|> range(start: -24h)");
                query.AppendLine($"|> filter(fn: (r) => r._measurement == \"sensor_readings\")");
                query.AppendLine("|> last()");
                query.AppendLine($"|> limit(n: {limit})");

                var queryApi = client.GetQueryApi();
                var tables = await queryApi.QueryAsync(query.ToString(), _org);

                foreach (var table in tables)
                {
                    foreach (var record in table.Records)
                    {
                        // Safe extraction of values with null checking
                        var equipmentIdValue = record.GetValueByKey("equipment_id")?.ToString();
                        var sensorTypeValue = record.GetValueByKey("sensor_type")?.ToString();
                        var timeValue = record.GetTime();
                        var recordValue = record.GetValue();

                        if (!string.IsNullOrEmpty(equipmentIdValue) &&
                            !string.IsNullOrEmpty(sensorTypeValue) &&
                            timeValue.HasValue &&
                            recordValue != null)
                        {
                            readings.Add(new SensorReading
                            {
                                EquipmentId = int.Parse(equipmentIdValue),
                                Timestamp = timeValue.Value.ToDateTimeUtc(),
                                SensorType = sensorTypeValue,
                                Value = Convert.ToDouble(recordValue)
                            });
                        }
                        else
                        {
                            _logger.LogWarning("Skipping record with missing values in GetLatestReadingsAsync");
                        }
                    }
                }

                return readings;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching latest readings from InfluxDB");
                return readings; // Return empty list on error
            }
        }
    }
}
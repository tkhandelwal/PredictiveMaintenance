using InfluxDB.Client;
using InfluxDB.Client.Api.Domain;
using InfluxDB.Client.Core.Flux.Domain;
using InfluxDB.Client.Writes;
using Microsoft.Extensions.Configuration;
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

        public InfluxDbService(IConfiguration configuration)
        {
            _url = configuration["InfluxDB:Url"] ?? "http://localhost:8086";
            _token = configuration["InfluxDB:Token"] ?? "your-token";
            _bucket = configuration["InfluxDB:Bucket"] ?? "equipment_monitoring";
            _org = configuration["InfluxDB:Org"] ?? "your-org";
        }

        public async Task WriteSensorReadingAsync(SensorReading reading)
        {
            using var client = new InfluxDBClient(_url, _token);
            var point = PointData.Measurement("sensor_readings")
                .Tag("equipment_id", reading.EquipmentId.ToString())
                .Tag("sensor_type", reading.SensorType)
                .Field("value", reading.Value)
                .Timestamp(reading.Timestamp, WritePrecision.Ms);

            await client.GetWriteApiAsync().WritePointAsync(point, _bucket, _org);
        }

        public async Task<List<SensorReading>> GetReadingsForEquipmentAsync(int equipmentId, DateTime from, DateTime to)
        {
            using var client = new InfluxDBClient(_url, _token);

            var query = new StringBuilder();
            query.AppendLine($"from(bucket: \"{_bucket}\")");
            query.AppendLine($"|> range(start: {from:yyyy-MM-ddTHH:mm:ssZ}, stop: {to:yyyy-MM-ddTHH:mm:ssZ})");
            query.AppendLine($"|> filter(fn: (r) => r._measurement == \"sensor_readings\" and r.equipment_id == \"{equipmentId}\")");
            query.AppendLine("|> pivot(rowKey:[\"_time\"], columnKey: [\"sensor_type\"], valueColumn: \"_value\")");

            var queryApi = client.GetQueryApi();
            var tables = await queryApi.QueryAsync(query.ToString(), _org);

            var readings = new List<SensorReading>();
            foreach (var table in tables)
            {
                foreach (var record in table.Records)
                {
                    readings.Add(new SensorReading
                    {
                        EquipmentId = int.Parse(record.GetValueByKey("equipment_id").ToString()),
                        Timestamp = record.GetTime().Value.ToDateTimeUtc(),
                        SensorType = "temperature", // Simplified for this example
                        Value = Convert.ToDouble(record.GetValue())
                    });
                }
            }

            return readings;
        }

        public async Task<List<SensorReading>> GetLatestReadingsAsync(int limit = 100)
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

            var readings = new List<SensorReading>();
            foreach (var table in tables)
            {
                foreach (var record in table.Records)
                {
                    readings.Add(new SensorReading
                    {
                        EquipmentId = int.Parse(record.GetValueByKey("equipment_id").ToString()),
                        Timestamp = record.GetTime().Value.ToDateTimeUtc(),
                        SensorType = record.GetValueByKey("sensor_type").ToString(),
                        Value = Convert.ToDouble(record.GetValue())
                    });
                }
            }

            return readings;
        }
    }
}
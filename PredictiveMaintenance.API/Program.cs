using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using PredictiveMaintenance.API.Data;
using PredictiveMaintenance.API.Hubs;
using PredictiveMaintenance.API.Services;
using PredictiveMaintenance.API.Services.DataGeneration;
using PredictiveMaintenance.API.Services.MachineLearning;
using PredictiveMaintenance.API.Services.Monitoring;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();



// Add CORS for Angular
builder.Services.AddCors(options =>
{
    options.AddPolicy("CorsPolicy", builder =>
        builder.WithOrigins("http://localhost:4200")
               .AllowAnyMethod()
               .AllowAnyHeader()
               .AllowCredentials());
});

// Add SignalR for real-time communication
builder.Services.AddSignalR();

// Register DbContext
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseInMemoryDatabase("EquipmentMonitoring"));

// Register services
builder.Services.AddScoped<IPredictiveMaintenanceService, PredictiveMaintenanceService>();
builder.Services.AddSingleton<IInfluxDbService, InMemoryInfluxDbService>();

//builder.Services.AddSingleton<IInfluxDbService, InfluxDbService>();
builder.Services.AddScoped<IEquipmentMonitoringService, EquipmentMonitoringService>();
builder.Services.AddSingleton<IAdvancedAnomalyDetectionService, AdvancedAnomalyDetectionService>();
builder.Services.AddSingleton<ISyntheticDataGenerator, SyntheticDataGenerator>();
builder.Services.AddHostedService<DataGenerationBackgroundService>();

var app = builder.Build();

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseCors("CorsPolicy");
app.UseAuthorization();
app.MapControllers();
app.MapHub<MonitoringHub>("/hubs/monitoring");

app.Run();
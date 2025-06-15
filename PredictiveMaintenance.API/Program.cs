using Asp.Versioning;
using Microsoft.EntityFrameworkCore;
using PredictiveMaintenance.API.Data;
using PredictiveMaintenance.API.Hubs;
using PredictiveMaintenance.API.Middleware;
using PredictiveMaintenance.API.Services;
using PredictiveMaintenance.API.Services.DataGeneration;
using PredictiveMaintenance.API.Services.DigitalTwin;
using PredictiveMaintenance.API.Services.EventProcessing;
using PredictiveMaintenance.API.Services.MachineLearning;
using PredictiveMaintenance.API.Services.Monitoring;
using PredictiveMaintenance.API.Services.PowerSystem;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Add SignalR
builder.Services.AddSignalR();

// Add MediatR
builder.Services.AddMediatR(cfg => {
    cfg.RegisterServicesFromAssembly(typeof(Program).Assembly);
});

builder.Services.AddApiVersioning(options =>
{
    options.DefaultApiVersion = new ApiVersion(1, 0);
    options.AssumeDefaultVersionWhenUnspecified = true;
    options.ReportApiVersions = true;
});

// Add CORS for Angular
builder.Services.AddCors(options =>
{
    options.AddPolicy("CorsPolicy", builder =>
        builder.WithOrigins("https://127.0.0.1:4200", "http://localhost:4200")
               .AllowAnyMethod()
               .AllowAnyHeader()
               .AllowCredentials());
});


// Register DbContext
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseInMemoryDatabase("EquipmentMonitoring"));
builder.Services.AddHealthChecks()
    .AddDbContextCheck<ApplicationDbContext>();

// Register services
builder.Services.AddScoped<IPredictiveMaintenanceService, PredictiveMaintenanceService>();
builder.Services.AddSingleton<IInfluxDbService, InMemoryInfluxDbService>();
builder.Services.AddHostedService<EnhancedDataGenerationBackgroundService>();


//builder.Services.AddSingleton<IInfluxDbService, InfluxDbService>();
builder.Services.AddScoped<IEquipmentMonitoringService, EnhancedEquipmentMonitoringService>();
builder.Services.AddScoped<IPredictiveMaintenanceService, PredictiveMaintenanceService>();
builder.Services.AddScoped<IEquipmentService, EquipmentService>();
builder.Services.AddSingleton<ISyntheticDataGenerator, SyntheticDataGenerator>();
builder.Services.AddScoped<IAdvancedAnomalyDetectionService, AdvancedAnomalyDetectionService>();
builder.Services.AddScoped<IDigitalTwinService, DigitalTwinService>();
builder.Services.AddScoped<IPowerSystemAnalysisService, PowerSystemAnalysisService>();
builder.Services.AddScoped<IRealTimeEventProcessingService, RealTimeEventProcessingService>();
builder.Services.AddScoped<ISensorDataService, SensorDataService>();



var app = builder.Build();



// Ensure database is created with seed data
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    DbInitializer.Initialize(context);
}


// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseMiddleware<ErrorHandlingMiddleware>();

app.UseHttpsRedirection();
app.UseCors("CorsPolicy");
app.UseAuthorization();

app.MapControllers();
app.MapHealthChecks("/health");
app.MapHub<MonitoringHub>("/monitoringHub");
app.MapHub<EquipmentHub>("/equipmentHub");

app.Run();
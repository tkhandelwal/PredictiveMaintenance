
#!/usr/bin/env python3
# predictive_maintenance_setup.py

import subprocess
import time
import os
import json

def setup_influxdb():
    print("Setting up InfluxDB 3.0 with Docker...")
    subprocess.run([
        "docker", "run", "-d", "--name", "influxdb3",
        "-p", "8086:8086",
        "-e", "INFLUXDB_INIT_ADMIN_USER=admin",
        "-e", "INFLUXDB_INIT_ADMIN_PASSWORD=password123",
        "-e", "INFLUXDB_INIT_DATABASE=equipment_monitoring",
        "influxdata/influxdb:3.0"
    ])
    
    # Update appsettings.json
    with open('PredictiveMaintenance.API/appsettings.json', 'r') as f:
        settings = json.load(f)
    
    settings['InfluxDB'] = {
        "Url": "http://localhost:8086",
        "Username": "admin", 
        "Password": "password123",
        "Database": "equipment_monitoring"
    }
    
    with open('PredictiveMaintenance.API/appsettings.json', 'w') as f:
        json.dump(settings, f, indent=2)
    
    print("InfluxDB 3.0 setup complete and appsettings.json updated!")

def ensure_npm_packages():
    print("Ensuring all Angular packages are installed...")
    os.chdir("predictivemaintenance.client")
    subprocess.run(["npm", "install"])
    os.chdir("..")

def build_and_run():
    print("Building and running the application...")
    subprocess.run(["dotnet", "build"])
    
    # Start the API
    api_process = subprocess.Popen(["dotnet", "run", "--project", "PredictiveMaintenance.API"])
    
    # Give time for API to start
    time.sleep(5)
    
    # Start Angular client
    os.chdir("predictivemaintenance.client")
    client_process = subprocess.Popen(["npm", "start"])
    
    print("\n===================================")
    print("Application started!")
    print("Access at https://localhost:19336")
    print("When finished, press Ctrl+C to stop")
    print("===================================\n")
    
    try:
        # Keep script running to maintain the processes
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("Shutting down...")
        api_process.terminate()
        client_process.terminate()

if __name__ == "__main__":
    setup_influxdb()
    ensure_npm_packages()
    build_and_run()
// src/app/services/signalr.service.ts
import { Injectable } from '@angular/core';
import { HubConnection, HubConnectionBuilder, LogLevel, HubConnectionState } from '@microsoft/signalr';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { SensorReading } from '../models/sensor-reading.model';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({
  providedIn: 'root'
})
export class SignalRService {
  subscribeToEquipment(equipmentId: number) {
      throw new Error('Method not implemented.');
  }
  unsubscribeFromEquipment(equipmentId: number) {
      throw new Error('Method not implemented.');
  }
  private hubConnection: HubConnection;
  private sensorReadingsSubject = new Subject<SensorReading | null>();
  private anomalySubject = new Subject<any | null>();
  private statusChangesSubject = new Subject<any | null>();
  private simulationEventsSubject = new Subject<any | null>();
  private connectionStateSubject = new BehaviorSubject<string>('Disconnected');
  private connectionIsEstablished = false;
  private subscribedEquipment: Set<number> = new Set();
  private retryCount = 0;
  private maxRetries = 10;
  private startingPromise: Promise<void> | null = null;
  private reconnectTimer: any = null;

  constructor(private snackBar: MatSnackBar) {
    // Create the connection with improved reliability settings
    this.hubConnection = new HubConnectionBuilder()
      .withUrl('/hubs/monitoring')
      .configureLogging(LogLevel.Information)
      .withAutomaticReconnect([0, 1000, 2000, 5000, 10000, 15000, 30000])
      .build();

    // Register the callback handlers
    this.registerOnServerEvents();

    // Set up connection event handlers
    this.setupConnectionEvents();

    // Start the connection immediately but only once
    this.startConnection();

    // Check connection status periodically and reconnect if needed
    setInterval(() => this.checkConnection(), 30000);
  }

  private registerOnServerEvents(): void {
    // Handle sensor readings
    this.hubConnection.on('ReceiveSensorReading', (reading: SensorReading) => {
      console.log('Received real-time reading:', reading);
      this.sensorReadingsSubject.next(reading);
    });

    // Handle anomaly detection
    this.hubConnection.on('AnomalyDetected', (anomaly: any) => {
      console.log('Anomaly detected:', anomaly);
      this.anomalySubject.next(anomaly);
      // Show notification for anomalies
      this.showAnomalyNotification(anomaly);
    });

    // Handle equipment status changes
    this.hubConnection.on('EquipmentStatusChanged', (statusUpdate: any) => {
      console.log('Equipment status changed:', statusUpdate);
      this.statusChangesSubject.next(statusUpdate);
      // Show notification for status changes
      this.showStatusChangeNotification(statusUpdate);
    });

    // Handle status changes for specific equipment
    this.hubConnection.on('StatusChanged', (statusUpdate: any) => {
      console.log('Status changed for specific equipment:', statusUpdate);
      this.statusChangesSubject.next(statusUpdate);
    });

    // Handle simulation events
    this.hubConnection.on('SimulationStarted', (simulationEvent: any) => {
      console.log('Simulation started:', simulationEvent);
      this.simulationEventsSubject.next({
        type: 'SimulationStarted',
        ...simulationEvent
      });
    });

    this.hubConnection.on('SimulationComplete', (simulationEvent: any) => {
      console.log('Simulation completed:', simulationEvent);
      this.simulationEventsSubject.next({
        type: 'SimulationComplete',
        ...simulationEvent
      });
    });
  }

  private showAnomalyNotification(anomaly: any): void {
    const message = `Anomaly detected: ${anomaly.sensorType} = ${anomaly.value} for Equipment #${anomaly.equipmentId}`;
    this.snackBar.open(message, 'View', {
      duration: 5000,
      panelClass: ['anomaly-snackbar']
    });
  }

  private showStatusChangeNotification(statusUpdate: any): void {
    const message = `Equipment ${statusUpdate.equipmentName} status changed: ${statusUpdate.previousStatus} → ${statusUpdate.currentStatus}`;
    this.snackBar.open(message, 'View', {
      duration: 5000,
      panelClass: ['status-snackbar']
    });
  }

  private setupConnectionEvents(): void {
    this.hubConnection.onreconnecting(error => {
      console.log('Reconnecting to SignalR hub...', error);
      this.connectionIsEstablished = false;
      this.connectionStateSubject.next('Reconnecting');
    });

    this.hubConnection.onreconnected(connectionId => {
      console.log('Reconnected to SignalR hub with connection ID:', connectionId);
      this.connectionIsEstablished = true;
      this.connectionStateSubject.next('Connected');
      this.startingPromise = null;
      this.retryCount = 0;
      // Resubscribe to groups if necessary
      this.resubscribeToGroups();
    });

    this.hubConnection.onclose(error => {
      console.error('Connection closed to SignalR hub', error);
      this.connectionIsEstablished = false;
      this.connectionStateSubject.next('Disconnected');
      this.startingPromise = null;

      // Only attempt to restart if we haven't reached max retries
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        const delay = Math.min(1000 * (Math.pow(2, this.retryCount) - 1), 30000);
        console.log(`Attempting to reconnect (${this.retryCount}/${this.maxRetries}) in ${delay}ms...`);

        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => this.startConnection(), delay);
      } else {
        console.error('Max reconnection attempts reached. Please refresh the page.');
      }
    });
  }

  // Check connection and restart if disconnected
  private checkConnection(): void {
    if (this.hubConnection.state === HubConnectionState.Disconnected && !this.startingPromise) {
      console.log('Connection check found disconnected state, attempting to reconnect...');
      this.startConnection();
    }
  }

  private resubscribeToGroups(): void {
    // Only attempt to resubscribe if we're connected
    if (this.connectionIsEstablished && this.subscribedEquipment.size > 0) {
      console.log('Resubscribing to equipment groups...');
      this.subscribedEquipment.forEach(equipmentId => {
        this.hubConnection.invoke('SubscribeToEquipment', equipmentId)
          .catch(err => {
            console.error(`Error resubscribing to equipment ${equipmentId}:`, err);
          });
      });
    }
  }

  public startConnection(): Promise<void> {
    // Check if connection is already in progress
    if (this.startingPromise) {
      console.log('Connection start already in progress, returning existing promise');
      return this.startingPromise;
    }

    // Check if already connected
    if (this.hubConnection.state === HubConnectionState.Connected) {
      console.log('Already connected to SignalR hub');
      this.connectionIsEstablished = true;
      this.connectionStateSubject.next('Connected');
      return Promise.resolve();
    }

    // Check if connection is not in a state where it can be started
    if (this.hubConnection.state !== HubConnectionState.Disconnected) {
      console.log(`Connection in ${this.hubConnection.state} state, cannot start. Waiting...`);
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(this.startConnection());
        }, 1000);
      });
    }

    // Start a new connection
    console.log('Starting new SignalR connection...');
    this.connectionStateSubject.next('Connecting');
    this.startingPromise = this.hubConnection.start()
      .then(() => {
        console.log('SignalR connection established successfully');
        this.connectionIsEstablished = true;
        this.connectionStateSubject.next('Connected');
        this.retryCount = 0;
        this.startingPromise = null;

        // Resubscribe to groups if necessary
        this.resubscribeToGroups();
      })
      .catch(err => {
        console.error('Error establishing SignalR connection:', err);
        this.connectionIsEstablished = false;
        this.connectionStateSubject.next('Failed');
        this.startingPromise = null;

        // Only attempt to restart if we haven't reached max retries
        if (this.retryCount < this.maxRetries) {
          this.retryCount++;
          const delay = Math.min(1000 * (Math.pow(2, this.retryCount) - 1), 30000);
          console.log(`Attempting to reconnect (${this.retryCount}/${this.maxRetries}) in ${delay}ms...`);

          // Return a new promise that will resolve when the retry succeeds
          return new Promise((resolve, reject) => {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = setTimeout(() => {
              this.startConnection().then(resolve).catch(reject);
            }, delay);
          });
        } else {
          console.error('Max reconnection attempts reached. Please refresh the page.');
          return Promise.reject(err);
        }
      });

    return this.startingPromise;
  }

  // Public methods remain mostly the same but use Subjects instead of BehaviorSubjects
  // for faster propagation of events

  public getSensorReadings(): Observable<SensorReading | null> {
    return this.sensorReadingsSubject.asObservable();
  }

  public getAnomalyAlerts(): Observable<any | null> {
    return this.anomalySubject.asObservable();
  }

  public getStatusChanges(): Observable<any | null> {
    return this.statusChangesSubject.asObservable();
  }

  public getSimulationEvents(): Observable<any | null> {
    return this.simulationEventsSubject.asObservable();
  }

  public getConnectionState(): Observable<string> {
    return this.connectionStateSubject.asObservable();
  }

  // Rest of the methods remain the same
}

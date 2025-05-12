import { Injectable } from '@angular/core';
import { HubConnection, HubConnectionBuilder, LogLevel, HubConnectionState } from '@microsoft/signalr';
import { BehaviorSubject, Observable } from 'rxjs';
import { SensorReading } from '../models/sensor-reading.model';

@Injectable({
  providedIn: 'root'
})
export class SignalRService {
  private hubConnection: HubConnection;
  private sensorReadingsSubject = new BehaviorSubject<SensorReading | null>(null);
  private anomalySubject = new BehaviorSubject<any | null>(null);
  private statusChangesSubject = new BehaviorSubject<any | null>(null);
  private simulationEventsSubject = new BehaviorSubject<any | null>(null);
  private connectionIsEstablished = false;
  private subscribedEquipment: Set<number> = new Set();
  private retryCount = 0;
  private maxRetries = 5;
  private startingPromise: Promise<void> | null = null;

  constructor() {
    // Create the connection
    this.hubConnection = new HubConnectionBuilder()
      .withUrl('/hubs/monitoring')
      .configureLogging(LogLevel.Information)
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .build();

    // Register the callback handlers
    this.registerOnServerEvents();

    // Set up connection event handlers
    this.setupConnectionEvents();

    // Start the connection immediately but only once
    this.startConnection();
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
    });

    // Handle equipment status changes
    this.hubConnection.on('EquipmentStatusChanged', (statusUpdate: any) => {
      console.log('Equipment status changed:', statusUpdate);
      this.statusChangesSubject.next(statusUpdate);
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

  private setupConnectionEvents(): void {
    this.hubConnection.onreconnecting(error => {
      console.log('Reconnecting to SignalR hub...', error);
      this.connectionIsEstablished = false;
    });

    this.hubConnection.onreconnected(connectionId => {
      console.log('Reconnected to SignalR hub with connection ID:', connectionId);
      this.connectionIsEstablished = true;
      this.startingPromise = null;
      this.retryCount = 0;
      // Resubscribe to groups if necessary
      this.resubscribeToGroups();
    });

    this.hubConnection.onclose(error => {
      console.error('Connection closed to SignalR hub', error);
      this.connectionIsEstablished = false;
      this.startingPromise = null;

      // Only attempt to restart if we haven't reached max retries
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        console.log(`Attempting to reconnect (${this.retryCount}/${this.maxRetries})...`);
        setTimeout(() => this.startConnection(), 5000);
      } else {
        console.error('Max reconnection attempts reached. Please refresh the page.');
      }
    });
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
    this.startingPromise = this.hubConnection.start()
      .then(() => {
        console.log('SignalR connection established successfully');
        this.connectionIsEstablished = true;
        this.retryCount = 0;
        this.startingPromise = null;

        // Resubscribe to groups if necessary
        this.resubscribeToGroups();
      })
      .catch(err => {
        console.error('Error establishing SignalR connection:', err);
        this.connectionIsEstablished = false;
        this.startingPromise = null;

        // Only attempt to restart if we haven't reached max retries
        if (this.retryCount < this.maxRetries) {
          this.retryCount++;
          console.log(`Attempting to reconnect (${this.retryCount}/${this.maxRetries})...`);

          // Return a new promise that will resolve when the retry succeeds
          return new Promise((resolve, reject) => {
            setTimeout(() => {
              this.startConnection().then(resolve).catch(reject);
            }, 3000);
          });
        } else {
          console.error('Max reconnection attempts reached. Please refresh the page.');
          return Promise.reject(err);
        }
      });

    return this.startingPromise;
  }

  public subscribeToEquipment(equipmentId: number): Promise<void> {
    console.log(`Subscribing to equipment ${equipmentId}`);

    // Add to our internal set
    this.subscribedEquipment.add(equipmentId);

    // If connection is not established, start connection and then subscribe
    if (!this.connectionIsEstablished) {
      return this.startConnection().then(() => {
        return this.hubConnection.invoke('SubscribeToEquipment', equipmentId);
      });
    }

    // Otherwise, just subscribe
    return this.hubConnection.invoke('SubscribeToEquipment', equipmentId)
      .then(() => {
        console.log(`Successfully subscribed to equipment ${equipmentId}`);
      })
      .catch(err => {
        console.error(`Error subscribing to equipment ${equipmentId}:`, err);
        // Don't rethrow, just log the error
      });
  }

  public unsubscribeFromEquipment(equipmentId: number): Promise<void> {
    console.log(`Unsubscribing from equipment ${equipmentId}`);

    // Remove from our internal set
    this.subscribedEquipment.delete(equipmentId);

    // If connection is not established, resolve immediately
    if (!this.connectionIsEstablished) {
      return Promise.resolve();
    }

    // Otherwise, unsubscribe
    return this.hubConnection.invoke('UnsubscribeFromEquipment', equipmentId)
      .then(() => {
        console.log(`Successfully unsubscribed from equipment ${equipmentId}`);
      })
      .catch(err => {
        console.error(`Error unsubscribing from equipment ${equipmentId}:`, err);
        // Don't rethrow, just log the error
      });
  }

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

  public getConnectionState(): string {
    return this.hubConnection.state;
  }

  public isConnected(): boolean {
    return this.connectionIsEstablished;
  }
}

// src/app/services/signalr.service.ts
import { Injectable } from '@angular/core';
import { HubConnection, HubConnectionBuilder, LogLevel, HubConnectionState } from '@microsoft/signalr';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { SensorReading } from '../models/sensor-reading.model';
import { MatSnackBar } from '@angular/material/snack-bar';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SignalRService {
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
  private connectionCheckTimer: any = null;
  private pingTimer: any = null;
  private autoStart = true; // Flag to auto-start connection

  constructor(private snackBar: MatSnackBar) {
    // Create the connection with improved reliability settings
    this.hubConnection = new HubConnectionBuilder()
      .withUrl(`${environment.apiUrl}/hubs/monitoring`)
      .configureLogging(LogLevel.Information)
      .withAutomaticReconnect([0, 1000, 2000, 5000, 10000, 15000, 30000])
      .build();

    // Register the callback handlers
    this.registerOnServerEvents();

    // Set up connection event handlers
    this.setupConnectionEvents();

    // Start the connection immediately but only once if autoStart is true
    if (this.autoStart) {
      setTimeout(() => {
        this.startConnection();
      }, 500); // Small delay to allow UI to render first
    }

    // Check connection status periodically and reconnect if needed
    setInterval(() => this.checkConnection(), 15000);
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

    // Handle ping (connection test)
    this.hubConnection.on('Pong', () => {
      console.log('Received pong from server');
      // Connection is alive, reset retry count
      this.retryCount = 0;
    });
  }

  private showAnomalyNotification(anomaly: any): void {
    if (!anomaly) return;

    // Create a more detailed message with equipment name if available
    const equipmentName = anomaly.equipmentName || `Equipment #${anomaly.equipmentId}`;
    const message = `Anomaly detected: ${anomaly.sensorType} = ${anomaly.value} for ${equipmentName}`;

    // Show a more visible notification
    this.snackBar.open(message, 'View', {
      duration: 8000, // Increased duration
      panelClass: ['anomaly-snackbar', 'anomaly-pulse'], // Added animation class
      horizontalPosition: 'right',
      verticalPosition: 'top'
    });

    // Play sound alert if available
    this.playAlert('anomaly');
  }

  private showStatusChangeNotification(statusUpdate: any): void {
    if (!statusUpdate) return;

    const message = `Equipment ${statusUpdate.equipmentName} status changed: ${statusUpdate.previousStatus} → ${statusUpdate.currentStatus}`;
    this.snackBar.open(message, 'View', {
      duration: 6000,
      panelClass: ['status-snackbar'],
      horizontalPosition: 'right',
      verticalPosition: 'top'
    });

    // Play sound alert if it's an escalation
    if (statusUpdate.isEscalation) {
      this.playAlert('status');
    }
  }

  private playAlert(type: 'anomaly' | 'status'): void {
    try {
      // Different sounds for different alert types
      const soundFile = type === 'anomaly' ? 'anomaly-alert.mp3' : 'status-change.mp3';
      const audio = new Audio(`assets/sounds/${soundFile}`);
      audio.volume = 0.5;
      audio.play().catch(err => console.log('Audio play error:', err));
    } catch (e) {
      console.error('Error playing alert sound:', e);
    }
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
        // Show a user-friendly notification
        this.snackBar.open('Connection lost. Please refresh the page.', 'Refresh', {
          duration: 0, // Stays open until user dismisses
          panelClass: ['error-snackbar']
        }).onAction().subscribe(() => {
          window.location.reload();
        });
      }
    });
  }

  // Check connection and restart if disconnected
  private checkConnection(): void {
    if (this.hubConnection.state === HubConnectionState.Disconnected && !this.startingPromise) {
      console.log('Connection check found disconnected state, attempting to reconnect...');
      this.startConnection();
    } else if (this.hubConnection.state === HubConnectionState.Connected) {
      // Send a ping to verify the connection is really alive
      this.sendPing();
    }
  }

  private sendPing(): void {
    // Try to invoke a ping method on the server
    try {
      this.hubConnection.invoke('Ping').catch(err => {
        console.warn('Ping failed, connection might be dead', err);
        // Force reconnect
        this.hubConnection.stop().then(() => {
          this.startConnection();
        }).catch(stopErr => {
          console.error('Error stopping connection', stopErr);
          this.connectionStateSubject.next('Disconnected');
        });
      });
    } catch (err) {
      console.error('Error sending ping', err);
    }
  }

  private scheduleConnectionCheck(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
    }

    // Test connection with a ping every 20 seconds
    this.pingTimer = setInterval(() => {
      if (this.hubConnection.state === HubConnectionState.Connected) {
        this.sendPing();
      } else {
        this.checkConnection();
      }
    }, 20000);
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

    // Add a timeout to prevent hanging connections
    const connectionTimeout = setTimeout(() => {
      if (!this.connectionIsEstablished) {
        console.error('Connection attempt timed out');
        this.connectionStateSubject.next('Disconnected');
        this.startingPromise = null;

        // Try to reconnect automatically
        if (this.retryCount < this.maxRetries) {
          this.retryCount++;
          this.startConnection();
        }
      }
    }, 10000); // 10 second timeout

    this.startingPromise = this.hubConnection.start()
      .then(() => {
        clearTimeout(connectionTimeout);
        console.log('SignalR connection established successfully');
        this.connectionIsEstablished = true;
        this.connectionStateSubject.next('Connected');
        this.retryCount = 0;
        this.startingPromise = null;

        // Start ping checks to keep connection alive
        this.scheduleConnectionCheck();

        // Resubscribe to groups if necessary
        this.resubscribeToGroups();
      })
      .catch(err => {
        clearTimeout(connectionTimeout);
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

  // Implement equipment subscription methods
  public subscribeToEquipment(equipmentId: number): Promise<void> {
    if (!equipmentId || isNaN(equipmentId)) {
      return Promise.reject(new Error('Invalid equipment ID'));
    }

    // Add to subscription set for tracking
    this.subscribedEquipment.add(equipmentId);

    // If not connected, just track it for later subscription when connected
    if (this.hubConnection.state !== HubConnectionState.Connected) {
      console.log(`Not connected yet. Will subscribe to equipment ${equipmentId} when connected.`);
      return Promise.resolve();
    }

    console.log(`Subscribing to equipment ${equipmentId}`);
    return this.hubConnection.invoke('SubscribeToEquipment', equipmentId)
      .then(() => {
        console.log(`Successfully subscribed to equipment ${equipmentId}`);
      })
      .catch(err => {
        console.error(`Error subscribing to equipment ${equipmentId}:`, err);
        // Keep in the set for retry
        throw err;
      });
  }

  public unsubscribeFromEquipment(equipmentId: number): Promise<void> {
    if (!equipmentId || isNaN(equipmentId)) {
      return Promise.reject(new Error('Invalid equipment ID'));
    }

    // Remove from subscription set
    this.subscribedEquipment.delete(equipmentId);

    // If not connected, nothing to do on the server
    if (this.hubConnection.state !== HubConnectionState.Connected) {
      console.log(`Not connected. No need to unsubscribe from equipment ${equipmentId} on server.`);
      return Promise.resolve();
    }

    console.log(`Unsubscribing from equipment ${equipmentId}`);
    return this.hubConnection.invoke('UnsubscribeFromEquipment', equipmentId)
      .then(() => {
        console.log(`Successfully unsubscribed from equipment ${equipmentId}`);
      })
      .catch(err => {
        console.error(`Error unsubscribing from equipment ${equipmentId}:`, err);
        throw err;
      });
  }

  // Public observables
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

  // Add manual reconnect function to allow UI buttons to trigger reconnection
  public reconnect(): Promise<void> {
    // Stop and restart
    return this.hubConnection.stop()
      .then(() => {
        this.retryCount = 0; // Reset retry count for manual reconnect
        return this.startConnection();
      })
      .catch(err => {
        console.error('Error during manual reconnection', err);
        this.startConnection();
        throw err;
      });
  }
}

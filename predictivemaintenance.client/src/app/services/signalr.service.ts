// src/app/services/signalr.service.ts
import { Injectable, OnDestroy } from '@angular/core';
import { HubConnection, HubConnectionBuilder, LogLevel, HubConnectionState } from '@microsoft/signalr';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { SensorReading } from '../models/sensor-reading.model';
import { MatSnackBar } from '@angular/material/snack-bar';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SignalRService implements OnDestroy {
  private hubConnection: HubConnection;
  private sensorReadingsSubject = new Subject<SensorReading | null>();
  private anomalySubject = new Subject<any | null>();
  private statusChangesSubject = new Subject<any | null>();
  private simulationEventsSubject = new Subject<any | null>();
  private connectionStateSubject = new BehaviorSubject<string>('Disconnected');
  private connectionIsEstablished = false;
  private subscribedEquipment: Set<number> = new Set();
  private reconnectTimer: any = null;
  private connectionCheckTimer: any = null;
  private pingTimer: any = null;

  constructor(private snackBar: MatSnackBar) {
    // Create hub connection with a more reliable configuration
    this.hubConnection = new HubConnectionBuilder()
      .withUrl(`${environment.apiUrl}/hubs/monitoring`)
      .configureLogging(LogLevel.Warning) // Reduce log noise
      .withAutomaticReconnect([0, 1000, 3000, 5000]) // Faster reconnection attempts
      .build();

    // Register event handlers
    this.registerOnServerEvents();
    this.setupConnectionEvents();

    // Start connection with small delay to ensure DOM is loaded
    setTimeout(() => {
      this.startConnection().catch(() => {
        console.log('Retrying initial connection...');
        // If first attempt fails, try once more after a delay
        setTimeout(() => this.startConnection(), 2000);
      });
    }, 500);

    // Setup connection health checks
    this.connectionCheckTimer = setInterval(() => this.checkConnection(), 15000);
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
      this.showAnomalyNotification(anomaly);
    });

    // Handle equipment status changes
    this.hubConnection.on('EquipmentStatusChanged', (statusUpdate: any) => {
      console.log('Equipment status changed:', statusUpdate);
      this.statusChangesSubject.next(statusUpdate);
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
    });
  }

  private showAnomalyNotification(anomaly: any): void {
    if (!anomaly) return;

    // Create a more detailed message with equipment name if available
    const equipmentName = anomaly.equipmentName || `Equipment #${anomaly.equipmentId}`;
    const message = `Anomaly detected: ${anomaly.sensorType} = ${anomaly.value} for ${equipmentName}`;

    // Show a more visible notification
    this.snackBar.open(message, 'View', {
      duration: 8000,
      panelClass: ['anomaly-snackbar', 'anomaly-pulse'],
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
      console.log('Reconnected to SignalR hub with ID:', connectionId);
      this.connectionIsEstablished = true;
      this.connectionStateSubject.next('Connected');
      this.resubscribeToGroups();
    });

    this.hubConnection.onclose(error => {
      console.error('Connection closed to SignalR hub', error);
      this.connectionIsEstablished = false;
      this.connectionStateSubject.next('Disconnected');

      // Schedule a reconnection attempt
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => {
        console.log("Attempting reconnection after connection close");
        this.startConnection();
      }, 2000);
    });
  }

  // Check connection and restart if disconnected
  private checkConnection(): void {
    const state = this.hubConnection.state;

    // If we're in a connecting state for too long, force reconnect
    if (state === HubConnectionState.Connecting && !this.connectionIsEstablished) {
      console.log('Connection stuck in Connecting state, forcing reconnect...');
      this.forceReconnect();
      return;
    }

    // If we're disconnected, try to reconnect
    if (state === HubConnectionState.Disconnected) {
      console.log('Connection check found disconnected state, attempting to reconnect...');
      this.startConnection();
    } else if (state === HubConnectionState.Connected) {
      // If we're connected, ping to verify connection health
      this.sendPing();
    }
  }

  private forceReconnect(): Promise<void> {
    return new Promise((resolve) => {
      try {
        // Try to stop gracefully first
        this.hubConnection.stop().then(() => {
          console.log('Connection stopped for force reconnect');
          // Reset connection flags
          this.connectionIsEstablished = false;
          this.connectionStateSubject.next('Disconnected');

          // Delay before restarting
          setTimeout(() => {
            this.startConnection().then(resolve).catch(() => resolve());
          }, 1000);
        }).catch(err => {
          console.error('Error stopping connection during force reconnect', err);
          // Still try to reconnect
          setTimeout(() => {
            this.startConnection().then(resolve).catch(() => resolve());
          }, 1000);
        });
      } catch (err) {
        console.error('Exception in force reconnect', err);
        // Still try to reconnect
        setTimeout(() => {
          this.startConnection().then(resolve).catch(() => resolve());
        }, 1000);
      }
    });
  }

  private sendPing(): void {
    // Try to invoke a ping method on the server
    try {
      this.hubConnection.invoke('Ping').catch(err => {
        console.warn('Ping failed, connection might be dead', err);
        this.forceReconnect();
      });
    } catch (err) {
      console.error('Error sending ping', err);
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
    // If already connected, just return
    if (this.hubConnection.state === HubConnectionState.Connected) {
      this.connectionIsEstablished = true;
      this.connectionStateSubject.next('Connected');
      return Promise.resolve();
    }

    // If in a state other than Disconnected, force a restart
    if (this.hubConnection.state !== HubConnectionState.Disconnected) {
      return this.forceReconnect();
    }

    console.log('Starting new SignalR connection...');
    this.connectionStateSubject.next('Connecting');

    // Set a timeout for the connection attempt
    const connectionTimeout = setTimeout(() => {
      if (this.hubConnection.state === HubConnectionState.Connecting) {
        console.error('Connection attempt timed out');
        this.forceReconnect();
      }
    }, 7000);

    return this.hubConnection.start()
      .then(() => {
        clearTimeout(connectionTimeout);
        console.log('SignalR connection established successfully');
        this.connectionIsEstablished = true;
        this.connectionStateSubject.next('Connected');
        this.resubscribeToGroups();
        return Promise.resolve();
      })
      .catch(err => {
        clearTimeout(connectionTimeout);
        console.error('Error establishing SignalR connection:', err);
        this.connectionIsEstablished = false;
        this.connectionStateSubject.next('Failed');

        // Schedule a retry
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            this.startConnection().then(resolve).catch(reject);
          }, 3000);
        });
      });
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
    console.log('Manual reconnection requested by user');
    return this.forceReconnect();
  }

  ngOnDestroy(): void {
    // Clean up timers
    if (this.connectionCheckTimer) {
      clearInterval(this.connectionCheckTimer);
    }

    if (this.pingTimer) {
      clearInterval(this.pingTimer);
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    // Close the connection
    if (this.hubConnection) {
      this.hubConnection.stop().catch(err => {
        console.error('Error stopping connection during cleanup', err);
      });
    }
  }
}

import { Injectable } from '@angular/core';
import { HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { BehaviorSubject, Observable } from 'rxjs';
import { SensorReading } from '../models/sensor-reading.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SignalRService {
  private hubConnection: HubConnection;
  private sensorReadingsSubject = new BehaviorSubject<SensorReading | null>(null);
  private simulationEventsSubject = new BehaviorSubject<any | null>(null);
  private subscribedEquipment: Set<number> = new Set();
  private connectionIsEstablished = false;

  constructor() {
    this.hubConnection = new HubConnectionBuilder()
      .withUrl(`${environment.apiUrl}/hubs/monitoring`)
      .configureLogging(LogLevel.Information)
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000]) // Retry intervals in milliseconds
      .build();

    this.registerOnServerEvents();
    this.setupConnectionEvents();
    this.startConnection();
  }

  private registerOnServerEvents(): void {
    this.hubConnection.on('ReceiveSensorReading', (reading: SensorReading) => {
      this.sensorReadingsSubject.next(reading);
    });

    this.hubConnection.on('EquipmentStatusChanged', (equipmentId: number, status: string) => {
      console.log(`Equipment ${equipmentId} status changed to ${status}`);
    });

    this.hubConnection.on('SimulationStarted', (simulationEvent: any) => {
      this.simulationEventsSubject.next({
        type: 'SimulationStarted',
        ...simulationEvent
      });
    });

    this.hubConnection.on('SimulationComplete', (simulationEvent: any) => {
      this.simulationEventsSubject.next({
        type: 'SimulationComplete',
        ...simulationEvent
      });
    });
  }

  public startConnection(): Promise<void> {
    if (this.connectionIsEstablished) {
      return Promise.resolve();
    }

    return this.hubConnection.start()
      .then(() => {
        console.log('SignalR connection established');
        this.connectionIsEstablished = true;

        // Resubscribe to previously subscribed equipment
        this.resubscribeToGroups();
      })
      .catch(err => {
        console.error('Error while starting SignalR connection:', err);
        this.connectionIsEstablished = false;
        // Try to reconnect after 5 seconds
        setTimeout(() => this.startConnection(), 5000);
        return Promise.reject(err);
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
      // Resubscribe to groups if necessary
      this.resubscribeToGroups();
    });

    this.hubConnection.onclose(error => {
      console.error('Connection closed to SignalR hub', error);
      this.connectionIsEstablished = false;
      setTimeout(() => this.startConnection(), 5000);
    });
  }

  private resubscribeToGroups(): void {
    // Resubscribe to all previously subscribed equipment
    if (this.subscribedEquipment.size > 0) {
      console.log('Resubscribing to equipment groups...');
      this.subscribedEquipment.forEach(equipmentId => {
        this.subscribeToEquipment(equipmentId).catch(err => {
          console.error(`Error resubscribing to equipment ${equipmentId}:`, err);
        });
      });
    }
  }

  public subscribeToEquipment(equipmentId: number): Promise<void> {
    // Add to our internal set
    this.subscribedEquipment.add(equipmentId);

    // If connection is not established, resolve immediately
    // (we'll resubscribe when connection is established)
    if (!this.connectionIsEstablished) {
      return Promise.resolve();
    }

    return this.hubConnection.invoke('SubscribeToEquipment', equipmentId);
  }

  public unsubscribeFromEquipment(equipmentId: number): Promise<void> {
    // Remove from our internal set
    this.subscribedEquipment.delete(equipmentId);

    // If connection is not established, resolve immediately
    if (!this.connectionIsEstablished) {
      return Promise.resolve();
    }

    return this.hubConnection.invoke('UnsubscribeFromEquipment', equipmentId);
  }

  public getSensorReadings(): Observable<SensorReading | null> {
    return this.sensorReadingsSubject.asObservable();
  }

  public getSimulationEvents(): Observable<any | null> {
    return this.simulationEventsSubject.asObservable();
  }
}

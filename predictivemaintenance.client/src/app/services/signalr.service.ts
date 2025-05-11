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

  constructor() {
    this.hubConnection = new HubConnectionBuilder()
      .withUrl(`${environment.apiUrl}/hubs/monitoring`)
      .configureLogging(LogLevel.Information)
      .withAutomaticReconnect()
      .build();

    this.hubConnection.on('ReceiveSensorReading', (reading: SensorReading) => {
      this.sensorReadingsSubject.next(reading);
    });

    this.hubConnection.on('EquipmentStatusChanged', (equipmentId: number, status: string) => {
      console.log(`Equipment ${equipmentId} status changed to ${status}`);
    });

    this.startConnection();
  }

  public startConnection(): Promise<void> {
    return this.hubConnection.start().catch(err => {
      console.error('Error while starting SignalR connection:', err);
      // Try to reconnect after 5 seconds
      setTimeout(() => this.startConnection(), 5000);
      return Promise.reject(err);
    });
  }

  public subscribeToEquipment(equipmentId: number): Promise<void> {
    return this.hubConnection.invoke('SubscribeToEquipment', equipmentId);
  }

  public unsubscribeFromEquipment(equipmentId: number): Promise<void> {
    return this.hubConnection.invoke('UnsubscribeFromEquipment', equipmentId);
  }

  public getSensorReadings(): Observable<SensorReading | null> {
    return this.sensorReadingsSubject.asObservable();
  }
}

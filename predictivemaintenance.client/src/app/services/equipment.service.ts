import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Equipment, MaintenanceStatus } from '../models/equipment.model';
import { SensorReading } from '../models/sensor-reading.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class EquipmentService {
  private apiUrl = `${environment.apiUrl}/api/equipment`;

  constructor(private http: HttpClient) { }

  getAllEquipment(): Observable<Equipment[]> {
    return this.http.get<Equipment[]>(this.apiUrl);
  }

  getEquipmentById(id: number): Observable<Equipment> {
    return this.http.get<Equipment>(`${this.apiUrl}/${id}`);
  }

  getEquipmentStatus(id: number): Observable<MaintenanceStatus> {
    return this.http.get<MaintenanceStatus>(`${this.apiUrl}/${id}/status`);
  }

  getEquipmentReadings(id: number, limit: number = 50): Observable<SensorReading[]> {
    return this.http.get<SensorReading[]>(`${this.apiUrl}/${id}/readings`, {
      params: { limit: limit.toString() }
    });
  }
}

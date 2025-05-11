import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { MaintenanceEvent } from '../models/maintenance-event.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class MaintenanceService {
  private apiUrl = `${environment.apiUrl}/api/maintenance`;

  constructor(private http: HttpClient) { }

  getMaintenanceSchedule(equipmentId: number): Observable<MaintenanceEvent[]> {
    return this.http.get<MaintenanceEvent[]>(`${this.apiUrl}/schedule/${equipmentId}`);
  }
}

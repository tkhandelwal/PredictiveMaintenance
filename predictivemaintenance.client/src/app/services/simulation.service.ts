// src/app/services/simulation.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface SimulationRequest {
  equipmentId: number;
  scenarioType: string;
  duration: number;
}

@Injectable({
  providedIn: 'root'
})
export class SimulationService {
  private apiUrl = `${environment.apiUrl}/api/equipment`;

  constructor(private http: HttpClient) { }

  startSimulation(request: SimulationRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/simulate`, request);
  }

  stopSimulation(equipmentId: number): Observable<any> {
    // If you have a dedicated endpoint for stopping simulations
    return this.http.post(`${this.apiUrl}/simulate/stop`, { equipmentId });
  }

  resetAllSimulations(): Observable<any> {
    return this.http.post(`${this.apiUrl}/simulate/reset`, {});
  }
}

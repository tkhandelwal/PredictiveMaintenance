import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { ErrorHandlingService } from './error-handling.service';
import { EquipmentService } from './equipment.service';

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

  constructor(
    private http: HttpClient,
    private errorService: ErrorHandlingService,
    private equipmentService: EquipmentService
  ) { }

  startSimulation(request: SimulationRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/simulate`, request).pipe(
      tap(() => {
        // After successful simulation, refresh equipment cache
        this.equipmentService.refreshCache();
      }),
      catchError(error => {
        this.errorService.handleError(error, `Error starting simulation for equipment ${request.equipmentId}`);
        return throwError(() => error);
      })
    );
  }

  stopSimulation(equipmentId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/simulate/stop`, { equipmentId }).pipe(
      tap(() => {
        // Refresh equipment cache after stopping simulation
        this.equipmentService.refreshCache();
      }),
      catchError(error => {
        this.errorService.handleError(error, `Error stopping simulation for equipment ${equipmentId}`);
        return throwError(() => error);
      })
    );
  }

  resetAllSimulations(): Observable<any> {
    return this.http.post(`${this.apiUrl}/simulate/reset`, {}).pipe(
      tap(() => {
        // Refresh equipment cache after resetting all simulations
        this.equipmentService.refreshCache();
      }),
      catchError(error => {
        this.errorService.handleError(error, 'Error resetting simulations');
        return throwError(() => error);
      })
    );
  }
}

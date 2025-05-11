import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { MaintenanceEvent } from '../models/maintenance-event.model';
import { environment } from '../../environments/environment';
import { CacheService } from './cache.service';
import { ErrorHandlingService } from './error-handling.service';

@Injectable({
  providedIn: 'root'
})
export class MaintenanceService {
  private apiUrl = `${environment.apiUrl}/api/maintenance`;

  constructor(
    private http: HttpClient,
    private cacheService: CacheService,
    private errorService: ErrorHandlingService
  ) { }

  getMaintenanceSchedule(equipmentId: number): Observable<MaintenanceEvent[]> {
    const cacheKey = `maintenance-schedule-${equipmentId}`;
    const cachedData = this.cacheService.get<MaintenanceEvent[]>(cacheKey);

    if (cachedData) {
      return of(cachedData);
    }

    return this.http.get<MaintenanceEvent[]>(`${this.apiUrl}/schedule/${equipmentId}`).pipe(
      tap(data => this.cacheService.set(cacheKey, data, 60)), // Cache for 1 minute
      catchError(error => {
        this.errorService.handleError(error, `Error loading maintenance schedule for equipment ${equipmentId}`);
        return of([]);
      })
    );
  }
}

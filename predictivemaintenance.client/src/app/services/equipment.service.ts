import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Equipment, MaintenanceStatus } from '../models/equipment.model';
import { SensorReading } from '../models/sensor-reading.model';
import { environment } from '../../environments/environment';
import { CacheService } from './cache.service';
import { ErrorHandlingService } from './error-handling.service';

@Injectable({
  providedIn: 'root'
})
export class EquipmentService {
  private apiUrl = `${environment.apiUrl}/api/equipment`;

  constructor(
    private http: HttpClient,
    private cacheService: CacheService,
    private errorService: ErrorHandlingService
  ) { }

  getAllEquipment(): Observable<Equipment[]> {
    const cacheKey = 'all-equipment';
    const cachedData = this.cacheService.get<Equipment[]>(cacheKey);

    if (cachedData) {
      return of(cachedData);
    }

    return this.http.get<Equipment[]>(this.apiUrl).pipe(
      tap(data => this.cacheService.set(cacheKey, data, 60)), // Cache for 1 minute
      catchError(error => {
        this.errorService.handleError(error, 'Error loading equipment data');
        return of([]);
      })
    );
  }

  getEquipmentById(id: number): Observable<Equipment> {
    const cacheKey = `equipment-${id}`;
    const cachedData = this.cacheService.get<Equipment>(cacheKey);

    if (cachedData) {
      return of(cachedData);
    }

    return this.http.get<Equipment>(`${this.apiUrl}/${id}`).pipe(
      tap(data => this.cacheService.set(cacheKey, data, 60)),
      catchError(error => {
        this.errorService.handleError(error, `Error loading equipment ${id}`);
        // Return a more appropriate error that won't break the UI
        return throwError(() => new Error(`Failed to load equipment ${id}`));
      })
    );
  }

  getEquipmentStatus(id: number): Observable<MaintenanceStatus> {
    return this.http.get<MaintenanceStatus>(`${this.apiUrl}/${id}/status`).pipe(
      catchError(error => {
        this.errorService.handleError(error, `Error fetching status for equipment ${id}`);
        throw error;
      })
    );
  }

  getEquipmentReadings(id: number, limit: number = 50): Observable<SensorReading[]> {
    return this.http.get<SensorReading[]>(`${this.apiUrl}/${id}/readings`, {
      params: { limit: limit.toString() }
    }).pipe(
      catchError(error => {
        this.errorService.handleError(error, `Error fetching readings for equipment ${id}`);
        return of([]);
      })
    );
  }

  refreshCache(): void {
    this.cacheService.clear('all-equipment');
    this.getAllEquipment().subscribe();
  }
}

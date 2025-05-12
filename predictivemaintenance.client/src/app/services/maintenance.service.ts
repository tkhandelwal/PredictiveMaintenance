import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { MaintenanceEvent } from '../models/maintenance-event.model';
import { CacheService } from './cache.service';
import { ErrorHandlingService } from './error-handling.service';
import { BaseApiService } from './base-api.service';

@Injectable({
  providedIn: 'root'
})
export class MaintenanceService extends BaseApiService {
  protected override endpoint = '/api/maintenance';

  constructor(
    protected override http: HttpClient,
    protected override cacheService: CacheService,
    protected override errorService: ErrorHandlingService
  ) {
    super(http, cacheService, errorService);
  }

  /**
   * Get maintenance schedule for equipment
   */
  getMaintenanceSchedule(equipmentId: number): Observable<MaintenanceEvent[]> {
    return this.get<MaintenanceEvent[]>(`schedule/${equipmentId}`);
  }

  /**
   * Get all maintenance events
   */
  getAllMaintenanceEvents(): Observable<MaintenanceEvent[]> {
    return this.get<MaintenanceEvent[]>('all');
  }

  /**
   * Complete a maintenance event
   */
  completeMaintenanceEvent(id: number): Observable<any> {
    return this.post<any>(`complete/${id}`, {});
  }

  /**
   * Create a new maintenance event
   */
  createMaintenanceEvent(event: MaintenanceEvent): Observable<MaintenanceEvent> {
    return this.post<MaintenanceEvent>('create', event);
  }

  /**
   * Refresh cache for maintenance data
   */
  refreshCache(): void {
    this.invalidateCache();
  }
}

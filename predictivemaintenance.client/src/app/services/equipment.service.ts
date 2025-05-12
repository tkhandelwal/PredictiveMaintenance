import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Equipment, MaintenanceStatus } from '../models/equipment.model';
import { SensorReading } from '../models/sensor-reading.model';
import { CacheService } from './cache.service';
import { ErrorHandlingService } from './error-handling.service';
import { BaseApiService } from './base-api.service';

@Injectable({
  providedIn: 'root'
})
export class EquipmentService extends BaseApiService {
  protected override endpoint = '/api/equipment';

  constructor(
    protected override http: HttpClient,
    protected override cacheService: CacheService,
    protected override errorService: ErrorHandlingService
  ) {
    super(http, cacheService, errorService);
  }

  /**
   * Get all equipment
   */
  getAllEquipment(): Observable<Equipment[]> {
    return this.getAll<Equipment>();
  }

  /**
   * Get equipment by ID
   */
  getEquipmentById(id: number): Observable<Equipment> {
    return this.getById<Equipment>(id);
  }

  /**
   * Get equipment status
   */
  getEquipmentStatus(id: number): Observable<MaintenanceStatus> {
    return this.get<MaintenanceStatus>(`${id}/status`);
  }

  /**
   * Get equipment readings with optional limit
   */
  getEquipmentReadings(id: number, limit: number = 50): Observable<SensorReading[]> {
    return this.get<SensorReading[]>(`${id}/readings`, { limit });
  }

  /**
   * Start a simulation scenario
   */
  startSimulation(request: any): Observable<any> {
    return this.post<any>('simulate', request);
  }

  /**
   * Stop a simulation
   */
  stopSimulation(equipmentId: number): Observable<any> {
    return this.post<any>('simulate/stop', { equipmentId });
  }

  /**
   * Reset all simulations
   */
  resetAllSimulations(): Observable<any> {
    return this.post<any>('simulate/reset', {});
  }

  /**
   * Refresh cache for equipment data
   */
  refreshCache(): void {
    this.invalidateCache();
  }
}

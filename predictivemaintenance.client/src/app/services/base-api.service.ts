import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, tap, retry, timeout, map } from 'rxjs/operators';
import { CacheService } from './cache.service';
import { ErrorHandlingService } from './error-handling.service';
import { environment } from '../../environments/environment';

// Type-safe HTTP options interface
interface HttpOptions {
  params?: HttpParams;
  observe?: 'body';
  responseType?: 'json';
  headers?: any;
  [key: string]: any;
}

@Injectable()
export abstract class BaseApiService {
  protected abstract endpoint: string;
  protected baseUrl: string;
  private defaultTimeout = 30000; // 30 seconds

  constructor(
    protected http: HttpClient,
    protected cacheService: CacheService,
    protected errorService: ErrorHandlingService
  ) {
    this.baseUrl = environment.apiUrl;
  }

  /**
   * Get all items
   */
  protected getAll<T>(path: string = '', options: HttpOptions = {}): Observable<T[]> {
    const url = this.buildUrl(path);
    const cacheKey = this.createCacheKey('get-all', path, options);
    const cachedData = this.cacheService.get<T[]>(cacheKey);

    if (cachedData) {
      return of(cachedData);
    }

    return this.http.get<T[]>(url, options).pipe(
      timeout(this.defaultTimeout),
      retry({ count: 1, delay: 1000 }),
      tap(data => this.cacheService.set(cacheKey, data, 60)), // cache for 1 minute
      catchError(err => this.handleError(err, `Error fetching data from ${url}`))
    );
  }

  /**
   * Get item by ID
   */
  protected getById<T>(id: number | string, path: string = '', options: HttpOptions = {}): Observable<T> {
    const url = this.buildUrl(`${path}/${id}`);
    const cacheKey = this.createCacheKey('get-by-id', `${path}/${id}`, options);
    const cachedData = this.cacheService.get<T>(cacheKey);

    if (cachedData) {
      return of(cachedData);
    }

    return this.http.get<T>(url, options).pipe(
      timeout(this.defaultTimeout),
      retry({ count: 1, delay: 1000 }),
      tap(data => this.cacheService.set(cacheKey, data, 60)), // cache for 1 minute
      catchError(err => this.handleError(err, `Error fetching item ${id} from ${url}`))
    );
  }

  /**
   * Create new item
   */
  protected create<T>(data: any, path: string = '', options: HttpOptions = {}): Observable<T> {
    const url = this.buildUrl(path);

    return this.http.post<T>(url, data, options).pipe(
      timeout(this.defaultTimeout),
      tap(() => this.invalidateCache()),
      catchError(err => this.handleError(err, `Error creating item at ${url}`))
    );
  }

  /**
   * Update existing item
   */
  protected update<T>(id: number | string, data: any, path: string = '', options: HttpOptions = {}): Observable<T> {
    const url = this.buildUrl(`${path}/${id}`);

    return this.http.put<T>(url, data, options).pipe(
      timeout(this.defaultTimeout),
      tap(() => this.invalidateCache()),
      catchError(err => this.handleError(err, `Error updating item ${id} at ${url}`))
    );
  }

  /**
   * Delete item
   */
  protected delete<T>(id: number | string, path: string = '', options: HttpOptions = {}): Observable<T> {
    const url = this.buildUrl(`${path}/${id}`);

    return this.http.delete<T>(url, options).pipe(
      timeout(this.defaultTimeout),
      tap(() => this.invalidateCache()),
      catchError(err => this.handleError(err, `Error deleting item ${id} at ${url}`))
    );
  }

  /**
   * Generic GET request
   */
  protected get<T>(path: string = '', options: HttpOptions = {}): Observable<T> {
    const url = this.buildUrl(path);
    const cacheKey = this.createCacheKey('get', path, options);
    const cachedData = this.cacheService.get<T>(cacheKey);

    if (cachedData) {
      return of(cachedData);
    }

    return this.http.get<T>(url, options).pipe(
      timeout(this.defaultTimeout),
      retry({ count: 1, delay: 1000 }),
      tap(data => this.cacheService.set(cacheKey, data, 60)),
      catchError(err => this.handleError(err, `Error fetching from ${url}`))
    );
  }

  /**
   * Generic POST request
   */
  protected post<T>(path: string = '', data: any = {}, options: HttpOptions = {}): Observable<T> {
    const url = this.buildUrl(path);

    return this.http.post<T>(url, data, options).pipe(
      timeout(this.defaultTimeout),
      tap(() => this.invalidateCache()),
      catchError(err => this.handleError(err, `Error posting to ${url}`))
    );
  }

  /**
   * Generic PUT request
   */
  protected put<T>(path: string = '', data: any = {}, options: HttpOptions = {}): Observable<T> {
    const url = this.buildUrl(path);

    return this.http.put<T>(url, data, options).pipe(
      timeout(this.defaultTimeout),
      tap(() => this.invalidateCache()),
      catchError(err => this.handleError(err, `Error updating at ${url}`))
    );
  }

  /**
   * Build full URL
   */
  private buildUrl(path: string): string {
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    const cleanEndpoint = this.endpoint.startsWith('/') ? this.endpoint.slice(1) : this.endpoint;

    if (cleanPath) {
      return `${this.baseUrl}/${cleanEndpoint}/${cleanPath}`;
    }
    return `${this.baseUrl}/${cleanEndpoint}`;
  }

  /**
   * Create cache key
   */
  private createCacheKey(method: string, path: string, options: any): string {
    const paramsString = options.params ? options.params.toString() : '';
    return `${this.endpoint}-${method}-${path}-${paramsString}`;
  }

  /**
   * Handle HTTP errors
   */
  private handleError(error: HttpErrorResponse, message: string): Observable<never> {
    return this.errorService.handleError(error, message);
  }

  /**
   * Invalidate cache for this service
   */
  protected invalidateCache(): void {
    this.cacheService.clearByPattern(this.endpoint);
  }
}

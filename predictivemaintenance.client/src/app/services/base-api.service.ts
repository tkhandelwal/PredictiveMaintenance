import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, tap, retry, timeout, map } from 'rxjs/operators';
import { CacheService } from './cache.service';
import { ErrorHandlingService } from './error-handling.service';
import { environment } from '../../environments/environment';

// Type-safe HTTP options interface
interface HttpGetOptions {
  params?: HttpParams;
  observe: 'body';
  responseType?: 'json';
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
  protected getAll<T>(path: string = '', options: any = {}): Observable<T[]> {
    const url = this.buildUrl(path);
    const cacheKey = this.createCacheKey('get-all', path, options);
    const cachedData = this.cacheService.get<T[]>(cacheKey);

    if (cachedData) {
      return of(cachedData);
    }

    const httpOptions: HttpGetOptions = {
      ...options,
      observe: 'body'
    };

    return this.http.get<T[]>(url, httpOptions).pipe(
      timeout(this.defaultTimeout),
      retry({ count: 1, delay: 1000 }),
      tap(data => this.cacheService.set(cacheKey, data, 60)), // cache for 1 minute
      catchError(err => this.handleError(err, `Error fetching data from ${url}`))
    );
  }

  /**
   * Get item by ID
   */
  protected getById<T>(id: number | string, path: string = '', options: any = {}): Observable<T> {
    const url = this.buildUrl(`${path}/${id}`);
    const cacheKey = this.createCacheKey('get-by-id', `${path}/${id}`, options);
    const cachedData = this.cacheService.get<T>(cacheKey);

    if (cachedData) {
      return of(cachedData);
    }

    const httpOptions: HttpGetOptions = {
      ...options,
      observe: 'body'
    };

    return this.http.get<T>(url, httpOptions).pipe(
      timeout(this.defaultTimeout),
      retry({ count: 1, delay: 1000 }),
      tap(data => this.cacheService.set(cacheKey, data, 60)), // cache for 1 minute
      catchError(err => this.handleError(err, `Error fetching item ${id} from ${url}`))
    );
  }

  /**
   * Create new item
   */
  protected create<T>(data: any, path: string = '', options: any = {}): Observable<T> {
    const url = this.buildUrl(path);

    const httpOptions: HttpGetOptions = {
      ...options,
      observe: 'body'
    };

    return this.http.post<T>(url, data, httpOptions).pipe(
      timeout(this.defaultTimeout),
      tap(() => this.invalidateCache()),
      catchError(err => this.handleError(err, `Error creating item in ${url}`))
    );
  }

  /**
   * Update existing item
   */
  protected update<T>(id: number | string, data: any, path: string = '', options: any = {}): Observable<T> {
    const url = this.buildUrl(`${path}/${id}`);

    const httpOptions: HttpGetOptions = {
      ...options,
      observe: 'body'
    };

    return this.http.put<T>(url, data, httpOptions).pipe(
      timeout(this.defaultTimeout),
      tap(() => this.invalidateCache()),
      catchError(err => this.handleError(err, `Error updating item ${id} in ${url}`))
    );
  }

  /**
   * Delete item
   */
  protected delete<T>(id: number | string, path: string = '', options: any = {}): Observable<T> {
    const url = this.buildUrl(`${path}/${id}`);

    const httpOptions: HttpGetOptions = {
      ...options,
      observe: 'body'
    };

    return this.http.delete<T>(url, httpOptions).pipe(
      timeout(this.defaultTimeout),
      tap(() => this.invalidateCache()),
      catchError(err => this.handleError(err, `Error deleting item ${id} from ${url}`))
    );
  }

  /**
   * Execute custom GET request
   */
  protected get<T>(path: string, params?: any, useCache: boolean = true, cacheDuration: number = 60): Observable<T> {
    const url = this.buildUrl(path);

    const httpParams = this.createHttpParams(params);
    const httpOptions: HttpGetOptions = {
      params: httpParams,
      observe: 'body'
    };

    const cacheKey = useCache ? this.createCacheKey('get', path, params) : null;

    if (cacheKey) {
      const cachedData = this.cacheService.get<T>(cacheKey);
      if (cachedData) {
        return of(cachedData);
      }
    }

    return this.http.get<T>(url, httpOptions).pipe(
      timeout(this.defaultTimeout),
      retry({ count: 1, delay: 1000 }),
      tap(data => { if (cacheKey) this.cacheService.set(cacheKey, data, cacheDuration); }),
      catchError(err => this.handleError(err, `Error fetching from ${url}`))
    );
  }

  /**
   * Execute custom POST request
   */
  protected post<T>(path: string, body: any = {}, params?: any): Observable<T> {
    const url = this.buildUrl(path);

    const httpParams = this.createHttpParams(params);
    const httpOptions: HttpGetOptions = {
      params: httpParams,
      observe: 'body'
    };

    return this.http.post<T>(url, body, httpOptions).pipe(
      timeout(this.defaultTimeout),
      tap(() => this.invalidateCache()),
      catchError(err => this.handleError(err, `Error posting to ${url}`))
    );
  }

  /**
   * Build full URL
   */
  protected buildUrl(path: string): string {
    // Handle paths with or without leading slash
    const cleanEndpoint = this.endpoint.startsWith('/') ? this.endpoint : `/${this.endpoint}`;
    const cleanPath = path ? (path.startsWith('/') ? path : `/${path}`) : '';

    return `${this.baseUrl}${cleanEndpoint}${cleanPath}`;
  }

  /**
   * Convert params object to HttpParams
   */
  protected createHttpParams(params: any): HttpParams {
    if (!params) return new HttpParams();

    let httpParams = new HttpParams();

    Object.keys(params).forEach(key => {
      if (params[key] !== null && params[key] !== undefined) {
        httpParams = httpParams.set(key, params[key].toString());
      }
    });

    return httpParams;
  }

  /**
   * Create cache key from path and parameters
   */
  protected createCacheKey(operation: string, path: string, params?: any): string {
    let key = `${this.endpoint}-${operation}-${path}`;

    if (params) {
      // Convert params to a stable string representation
      if (typeof params === 'object') {
        const sortedKeys = Object.keys(params).sort();
        key += '-' + sortedKeys.map(k => `${k}=${params[k]}`).join('&');
      } else {
        key += `-${params}`;
      }
    }

    return key;
  }

  /**
   * Invalidate all cache entries for this endpoint
   */
  public invalidateCache(): void {
    this.cacheService.clear(this.endpoint);
  }

  /**
   * Standard error handling with logging
   */
  protected handleError(error: HttpErrorResponse, message: string): Observable<never> {
    return this.errorService.handleError(error, message);
  }
}

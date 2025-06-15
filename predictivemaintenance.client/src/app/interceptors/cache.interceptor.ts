// src/app/interceptors/cache.interceptor.ts
import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CacheService } from '../services/cache.service';

@Injectable()
export class CacheInterceptor implements HttpInterceptor {
  constructor(private cacheService: CacheService) { }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next.handle(req);
    }

    // Check if request should be cached
    const shouldCache = !req.headers.has('X-No-Cache');

    if (!shouldCache) {
      return next.handle(req);
    }

    // Check cache first
    const cachedResponse = this.cacheService.get<HttpResponse<any>>(req.url);
    if (cachedResponse) {
      return of(cachedResponse);
    }

    // Make request and cache response
    return next.handle(req).pipe(
      tap(event => {
        if (event instanceof HttpResponse) {
          this.cacheService.set(req.url, event, 60); // Cache for 1 minute
        }
      })
    );
  }
}

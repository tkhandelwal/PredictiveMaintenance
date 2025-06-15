// src/app/interceptors/auth.interceptor.ts
import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Get auth token from storage
    const authToken = localStorage.getItem('auth_token');

    if (authToken) {
      // Clone the request and add the authorization header
      const authReq = req.clone({
        setHeaders: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });
      return next.handle(authReq);
    }

    return next.handle(req);
  }
}

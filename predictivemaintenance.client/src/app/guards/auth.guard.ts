// src/app/guards/auth.guard.ts
import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(private router: Router) { }

  canActivate(): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    // Check if user is authenticated
    const token = localStorage.getItem('auth_token');

    if (token) {
      // Add token validation logic here
      return true;
    }

    // Redirect to login page
    return this.router.createUrlTree(['/login']);
  }
}

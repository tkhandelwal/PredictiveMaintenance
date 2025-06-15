// src/app/guards/admin.guard.ts
import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AdminGuard implements CanActivate {
  constructor(private router: Router) { }

  canActivate(): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    // Check if user has admin role
    const userRole = localStorage.getItem('user_role');

    if (userRole === 'admin' || userRole === 'operator') {
      return true;
    }

    // Redirect to access denied page
    return this.router.createUrlTree(['/error/403']);
  }
}

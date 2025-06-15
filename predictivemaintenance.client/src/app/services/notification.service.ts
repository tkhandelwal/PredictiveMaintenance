// src/app/services/notification.service.ts
import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actionLabel?: string;
  actionCallback?: () => void;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notifications$ = new BehaviorSubject<Notification[]>([]);
  private notificationId = 0;

  constructor(private snackBar: MatSnackBar) { }

  getNotifications(): Observable<Notification[]> {
    return this.notifications$.asObservable();
  }

  showSuccess(title: string, message: string, actionLabel?: string, actionCallback?: () => void): void {
    this.addNotification('success', title, message, actionLabel, actionCallback);
    this.snackBar.open(`${title}: ${message}`, 'Close', {
      duration: 3000,
      panelClass: ['success-snackbar']
    });
  }

  showError(title: string, message: string, actionLabel?: string, actionCallback?: () => void): void {
    this.addNotification('error', title, message, actionLabel, actionCallback);
    this.snackBar.open(`${title}: ${message}`, 'Close', {
      duration: 5000,
      panelClass: ['error-snackbar']
    });
  }

  showWarning(title: string, message: string, actionLabel?: string, actionCallback?: () => void): void {
    this.addNotification('warning', title, message, actionLabel, actionCallback);
    this.snackBar.open(`${title}: ${message}`, 'Close', {
      duration: 4000,
      panelClass: ['warning-snackbar']
    });
  }

  showInfo(title: string, message: string, actionLabel?: string, actionCallback?: () => void): void {
    this.addNotification('info', title, message, actionLabel, actionCallback);
    this.snackBar.open(`${title}: ${message}`, 'Close', {
      duration: 3000,
      panelClass: ['info-snackbar']
    });
  }

  private addNotification(
    type: 'success' | 'error' | 'warning' | 'info',
    title: string,
    message: string,
    actionLabel?: string,
    actionCallback?: () => void
  ): void {
    const notification: Notification = {
      id: (++this.notificationId).toString(),
      type,
      title,
      message,
      timestamp: new Date(),
      read: false,
      actionLabel,
      actionCallback
    };

    const current = this.notifications$.value;
    this.notifications$.next([notification, ...current]);
  }

  markAsRead(notificationId: string): void {
    const current = this.notifications$.value;
    const updated = current.map(notification =>
      notification.id === notificationId
        ? { ...notification, read: true }
        : notification
    );
    this.notifications$.next(updated);
  }

  clearAll(): void {
    this.notifications$.next([]);
  }

  removeNotification(notificationId: string): void {
    const current = this.notifications$.value;
    const updated = current.filter(notification => notification.id !== notificationId);
    this.notifications$.next(updated);
  }
}

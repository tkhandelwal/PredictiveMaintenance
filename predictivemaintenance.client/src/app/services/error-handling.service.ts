import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, Subject, throwError } from 'rxjs';

export enum ErrorType {
  Network = 'Network Error',
  Authentication = 'Authentication Error',
  Authorization = 'Authorization Error',
  Validation = 'Validation Error',
  NotFound = 'Not Found',
  ServerError = 'Server Error',
  Timeout = 'Timeout Error',
  Unknown = 'Unknown Error'
}

export interface AppError {
  type: ErrorType;
  message: string;
  originalError?: any;
  timestamp: Date;
  statusCode?: number;
  recoverable: boolean;
  recoveryAction?: () => void;
}

@Injectable({
  providedIn: 'root'
})
export class ErrorHandlingService {
  private errors$ = new Subject<AppError>();

  constructor(private snackBar: MatSnackBar) { }

  handleError(error: any, message: string = 'An error occurred'): Observable<never> {
    console.error(error);

    const appError = this.processError(error, message);

    // Emit the error for any components that want to listen
    this.errors$.next(appError);

    // Show the error as a snackbar
    this.showErrorSnackbar(appError);

    // Return a throwError Observable with the error
    return throwError(() => appError);
  }

  getAllErrors(): Observable<AppError> {
    return this.errors$.asObservable();
  }

  private processError(error: any, customMessage: string): AppError {
    let errorType = ErrorType.Unknown;
    let statusCode: number | undefined = undefined;
    let errorMessage = customMessage;
    let recoverable = false;

    if (error instanceof HttpErrorResponse) {
      statusCode = error.status;

      // Process based on HTTP status code
      switch (error.status) {
        case 0:
          errorType = ErrorType.Network;
          errorMessage = 'Network connectivity error. Please check your connection.';
          recoverable = true;
          break;
        case 401:
          errorType = ErrorType.Authentication;
          errorMessage = 'You need to log in to access this resource.';
          break;
        case 403:
          errorType = ErrorType.Authorization;
          errorMessage = 'You do not have permission to access this resource.';
          break;
        case 404:
          errorType = ErrorType.NotFound;
          errorMessage = 'The requested resource was not found.';
          break;
        case 400:
        case 422:
          errorType = ErrorType.Validation;
          errorMessage = error.error?.message || 'Invalid data provided.';
          recoverable = true;
          break;
        case 408:
        case 504:
          errorType = ErrorType.Timeout;
          errorMessage = 'The request timed out. Please try again.';
          recoverable = true;
          break;
        case 500:
        case 502:
        case 503:
          errorType = ErrorType.ServerError;
          errorMessage = 'Server error. Our team has been notified.';
          break;
        default:
          // Use the custom message for unknown errors
          break;
      }

      // Add server-provided error message if available
      if (error.error?.message && errorType !== ErrorType.Validation) {
        errorMessage += ` Server message: ${error.error.message}`;
      }
    } else if (error instanceof Error) {
      // For JavaScript errors
      if (error.message.includes('timeout')) {
        errorType = ErrorType.Timeout;
        errorMessage = 'The operation timed out. Please try again.';
        recoverable = true;
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        errorType = ErrorType.Network;
        errorMessage = 'Network error. Please check your connection.';
        recoverable = true;
      }
    }

    // Create and return the AppError object
    return {
      type: errorType,
      message: errorMessage,
      originalError: error,
      timestamp: new Date(),
      statusCode,
      recoverable
    };
  }

  private showErrorSnackbar(error: AppError): void {
    const duration = error.recoverable ? 8000 : 5000;
    const action = error.recoverable ? 'Retry' : 'Close';

    const snackBarRef = this.snackBar.open(error.message, action, {
      duration: duration,
      panelClass: ['error-snackbar'],
      horizontalPosition: 'center',
      verticalPosition: 'bottom'
    });

    if (error.recoverable) {
      snackBarRef.onAction().subscribe(() => {
        if (error.recoveryAction) {
          error.recoveryAction();
        }
      });
    }
  }

  // Helper methods for specific error types
  handleNetworkError(error: any, retryAction?: () => void): Observable<never> {
    const appError: AppError = {
      type: ErrorType.Network,
      message: 'Network error. Please check your connection and try again.',
      originalError: error,
      timestamp: new Date(),
      recoverable: true,
      recoveryAction: retryAction
    };

    this.errors$.next(appError);
    this.showErrorSnackbar(appError);

    return throwError(() => appError);
  }

  handleValidationError(error: any, fieldErrors?: Record<string, string>): Observable<never> {
    let errorMessage = 'Please check the form for errors';

    if (fieldErrors && Object.keys(fieldErrors).length > 0) {
      // Get the first field error
      const firstField = Object.keys(fieldErrors)[0];
      errorMessage = `${fieldErrors[firstField]}`;
    }

    const appError: AppError = {
      type: ErrorType.Validation,
      message: errorMessage,
      originalError: error,
      timestamp: new Date(),
      recoverable: true
    };

    this.errors$.next(appError);
    this.showErrorSnackbar(appError);

    return throwError(() => appError);
  }

  // Log an error without displaying it to the user
  logError(error: any, message: string = 'An error occurred'): void {
    console.error(message, error);
    const appError = this.processError(error, message);
    this.errors$.next(appError);
  }
}

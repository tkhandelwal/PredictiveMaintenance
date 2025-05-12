import { HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { throwError, catchError } from 'rxjs';
import { ErrorHandlingService } from '../services/error-handling.service';

export const errorInterceptor = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const errorService = inject(ErrorHandlingService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      let errorMessage = 'An unknown error occurred';

      if (error.error instanceof ErrorEvent) {
        // Client-side error
        errorMessage = `Client error: ${error.error.message}`;
      } else {
        // Server-side error
        errorMessage = `Server error: ${error.status} - ${error.statusText}`;
        if (error.error?.message) {
          errorMessage += ` - ${error.error.message}`;
        }
      }

      errorService.handleError(error, errorMessage);
      return throwError(() => error);
    })
  );
};

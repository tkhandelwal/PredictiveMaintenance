import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LoadingService {
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$: Observable<boolean> = this.loadingSubject.asObservable();

  private requestsCounter = 0;

  constructor() { }

  setLoading(loading: boolean): void {
    if (loading) {
      this.requestsCounter++;
      this.loadingSubject.next(true);
    } else {
      this.requestsCounter--;
      if (this.requestsCounter <= 0) {
        this.requestsCounter = 0;
        this.loadingSubject.next(false);
      }
    }
  }
}

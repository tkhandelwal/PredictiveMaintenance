import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class CacheService {
  private cache = new Map<string, any>();
  private expirationTimes = new Map<string, number>();

  get<T>(key: string): T | null {
    if (!this.cache.has(key)) {
      return null;
    }

    const expirationTime = this.expirationTimes.get(key);
    if (expirationTime && Date.now() > expirationTime) {
      this.cache.delete(key);
      this.expirationTimes.delete(key);
      return null;
    }

    return this.cache.get(key);
  }

  set<T>(key: string, value: T, expirationInSeconds: number = 300): void {
    this.cache.set(key, value);
    if (expirationInSeconds > 0) {
      this.expirationTimes.set(key, Date.now() + (expirationInSeconds * 1000));
    }
  }

  clear(key?: string): void {
    if (key) {
      this.cache.delete(key);
      this.expirationTimes.delete(key);
    } else {
      this.cache.clear();
      this.expirationTimes.clear();
    }
  }
}

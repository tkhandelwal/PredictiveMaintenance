// src/app/services/theme.service.ts
import { Injectable, Renderer2, RendererFactory2 } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private isDarkTheme = new BehaviorSubject<boolean>(false);
  private renderer: Renderer2;

  constructor(rendererFactory: RendererFactory2) {
    this.renderer = rendererFactory.createRenderer(null, null);

    // Check if user previously set a preference
    const savedTheme = localStorage.getItem('darkMode');
    if (savedTheme) {
      this.setDarkTheme(savedTheme === 'true');
    } else {
      // Check if user prefers dark mode from system
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.setDarkTheme(prefersDark);
    }

    // Listen for system theme changes
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        // Only auto-switch if user hasn't explicitly set a preference
        if (!localStorage.getItem('darkMode')) {
          this.setDarkTheme(e.matches);
        }
      });
    }
  }

  setDarkTheme(isDark: boolean): void {
    this.isDarkTheme.next(isDark);
    localStorage.setItem('darkMode', isDark.toString());

    if (isDark) {
      this.renderer.addClass(document.body, 'dark-theme');
    } else {
      this.renderer.removeClass(document.body, 'dark-theme');
    }
  }

  toggleDarkTheme(): void {
    this.setDarkTheme(!this.isDarkTheme.value);
  }

  isDarkTheme$(): Observable<boolean> {
    return this.isDarkTheme.asObservable();
  }
}

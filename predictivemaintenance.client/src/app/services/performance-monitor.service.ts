// src/app/services/performance-monitor.service.ts
import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

interface PerformanceMetrics {
  fps: number;
  memoryUsage: number;
  renderTime: number;
  apiLatency: number;
  gpuUsage?: number;
}

@Injectable({
  providedIn: 'root'
})
export class PerformanceMonitorService {
  private metricsSubject = new Subject<PerformanceMetrics>();
  private frameCount = 0;
  private lastFrameTime = performance.now();
  private fpsHistory: number[] = [];
  private renderTimes: number[] = [];
  private apiLatencies: number[] = [];
  private monitoringInterval: any;

  constructor() { }

  startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.calculateMetrics();
    }, 1000);

    // Start FPS monitoring
    this.monitorFPS();
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
  }

  private monitorFPS(): void {
    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastFrameTime;

    if (deltaTime >= 1000) {
      const fps = Math.round((this.frameCount * 1000) / deltaTime);
      this.fpsHistory.push(fps);

      if (this.fpsHistory.length > 60) {
        this.fpsHistory.shift();
      }

      this.frameCount = 0;
      this.lastFrameTime = currentTime;
    } else {
      this.frameCount++;
    }

    requestAnimationFrame(() => this.monitorFPS());
  }

  recordRenderTime(time: number): void {
    this.renderTimes.push(time);
    if (this.renderTimes.length > 100) {
      this.renderTimes.shift();
    }
  }

  recordApiLatency(latency: number): void {
    this.apiLatencies.push(latency);
    if (this.apiLatencies.length > 100) {
      this.apiLatencies.shift();
    }
  }

  private calculateMetrics(): void {
    const metrics: PerformanceMetrics = {
      fps: this.calculateAverageFPS(),
      memoryUsage: this.getMemoryUsage(),
      renderTime: this.calculateAverageRenderTime(),
      apiLatency: this.calculateAverageApiLatency()
    };

    // Try to get GPU usage if available
    if ('gpu' in navigator) {
      metrics.gpuUsage = this.estimateGPUUsage();
    }

    this.metricsSubject.next(metrics);
  }

  private calculateAverageFPS(): number {
    if (this.fpsHistory.length === 0) return 60;
    const sum = this.fpsHistory.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.fpsHistory.length);
  }

  private getMemoryUsage(): number {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return Math.round((memory.usedJSHeapSize / memory.totalJSHeapSize) * 100);
    }
    return 0;
  }

  private calculateAverageRenderTime(): number {
    if (this.renderTimes.length === 0) return 0;
    const sum = this.renderTimes.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.renderTimes.length);
  }

  private calculateAverageApiLatency(): number {
    if (this.apiLatencies.length === 0) return 0;
    const sum = this.apiLatencies.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.apiLatencies.length);
  }

  private estimateGPUUsage(): number {
    // Estimate based on render times and complexity
    const avgRenderTime = this.calculateAverageRenderTime();
    const targetRenderTime = 16.67; // 60 FPS target

    return Math.min(100, Math.round((avgRenderTime / targetRenderTime) * 100));
  }

  getMetrics() {
    return this.metricsSubject.asObservable();
  }

  // Performance optimization suggestions
  getOptimizationSuggestions(): string[] {
    const suggestions: string[] = [];
    const avgFPS = this.calculateAverageFPS();
    const memoryUsage = this.getMemoryUsage();
    const avgRenderTime = this.calculateAverageRenderTime();

    if (avgFPS < 30) {
      suggestions.push('Low FPS detected. Consider reducing visual effects or switching to eco mode.');
    }

    if (memoryUsage > 80) {
      suggestions.push('High memory usage. Consider closing unused tabs or clearing cache.');
    }

    if (avgRenderTime > 32) {
      suggestions.push('Slow render times. Reduce the number of elements in 3D view.');
    }

    return suggestions;
  }
}

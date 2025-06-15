// src/app/services/energy-optimization.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, interval } from 'rxjs';
import { map, tap, switchMap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface EnergyData {
  timestamp: Date;
  totalConsumption: number;
  totalGeneration: number;
  gridImport: number;
  gridExport: number;
  renewableGeneration: number;
  batteryCharge: number;
  batteryDischarge: number;
  powerFactor: number;
  frequency: number;
  voltage: number;
  peakDemand: number;
  energyCost: number;
  carbonEmissions: number;
}

export interface EnergyOptimization {
  id: string;
  type: 'load-shifting' | 'peak-shaving' | 'renewable-optimization' | 'power-factor' | 'demand-response';
  title: string;
  description: string;
  potentialSavings: number;
  implementation: string[];
  priority: 'high' | 'medium' | 'low';
  requiredInvestment: number;
  paybackPeriod: number; // months
  carbonReduction: number; // tons CO2
}

export interface EnergyForecast {
  timestamp: Date;
  predictedConsumption: number;
  predictedGeneration: number;
  confidence: number;
  factors: {
    weather: number;
    production: number;
    historical: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class EnergyOptimizationService {
  private apiUrl = `${environment.apiUrl}/api/energy`;

  private energyDataSubject = new BehaviorSubject<EnergyData | null>(null);
  public energyData$ = this.energyDataSubject.asObservable();

  private optimizationsSubject = new BehaviorSubject<EnergyOptimization[]>([]);
  public optimizations$ = this.optimizationsSubject.asObservable();

  private forecastSubject = new BehaviorSubject<EnergyForecast[]>([]);
  public forecast$ = this.forecastSubject.asObservable();

  constructor(private http: HttpClient) {
    this.startRealTimeMonitoring();
    this.startOptimizationAnalysis();
  }

  private startRealTimeMonitoring(): void {
    // Update every 5 seconds
    interval(5000).pipe(
      switchMap(() => this.getCurrentEnergyData())
    ).subscribe(data => {
      this.energyDataSubject.next(data);
    });
  }

  private startOptimizationAnalysis(): void {
    // Analyze every 5 minutes
    interval(300000).pipe(
      switchMap(() => this.analyzeOptimizationOpportunities())
    ).subscribe(optimizations => {
      this.optimizationsSubject.next(optimizations);
    });
  }

  getCurrentEnergyData(): Observable<EnergyData> {
    return this.http.get<EnergyData>(`${this.apiUrl}/current`).pipe(
      map(data => ({
        ...data,
        timestamp: new Date(data.timestamp)
      }))
    );
  }

  getHistoricalEnergyData(startDate: Date, endDate: Date): Observable<EnergyData[]> {
    const params = {
      start: startDate.toISOString(),
      end: endDate.toISOString()
    };

    return this.http.get<EnergyData[]>(`${this.apiUrl}/historical`, { params }).pipe(
      map(data => data.map(d => ({
        ...d,
        timestamp: new Date(d.timestamp)
      })))
    );
  }

  analyzeOptimizationOpportunities(): Observable<EnergyOptimization[]> {
    return this.http.get<any>(`${this.apiUrl}/analyze`).pipe(
      map(analysis => {
        const optimizations: EnergyOptimization[] = [];

        // Load shifting opportunities
        if (analysis.peakDemand > analysis.averageDemand * 1.5) {
          optimizations.push({
            id: 'load-shift-1',
            type: 'load-shifting',
            title: 'Shift Non-Critical Loads to Off-Peak Hours',
            description: `Peak demand is ${((analysis.peakDemand / analysis.averageDemand - 1) * 100).toFixed(0)}% above average`,
            potentialSavings: analysis.peakDemand * 15 * 12, // Monthly savings
            implementation: [
              'Reschedule batch processes to 10 PM - 6 AM',
              'Implement automated load control system',
              'Stagger equipment startup times',
              'Use thermal storage for cooling loads'
            ],
            priority: 'high',
            requiredInvestment: 50000,
            paybackPeriod: 8,
            carbonReduction: analysis.peakDemand * 0.5
          });
        }

        // Renewable optimization
        if (analysis.renewableUtilization < 0.8) {
          optimizations.push({
            id: 'renewable-opt-1',
            type: 'renewable-optimization',
            title: 'Increase Renewable Energy Utilization',
            description: `Current utilization is ${(analysis.renewableUtilization * 100).toFixed(0)}%, can be improved to 95%`,
            potentialSavings: analysis.unusedRenewable * 0.08 * 30 * 24,
            implementation: [
              'Install additional battery storage capacity',
              'Implement predictive renewable forecasting',
              'Optimize load scheduling based on generation',
              'Add smart inverters for grid stability'
            ],
            priority: 'medium',
            requiredInvestment: 200000,
            paybackPeriod: 24,
            carbonReduction: analysis.unusedRenewable * 0.4 * 365
          });
        }

        // Power factor correction
        if (analysis.averagePowerFactor < 0.95) {
          optimizations.push({
            id: 'pf-correction-1',
            type: 'power-factor',
            title: 'Improve Power Factor',
            description: `Current PF is ${analysis.averagePowerFactor.toFixed(2)}, target is 0.98`,
            potentialSavings: analysis.totalConsumption * 0.02 * 0.08 * 30 * 24,
            implementation: [
              'Install automatic capacitor banks',
              'Upgrade to high-efficiency motors',
              'Implement real-time PF monitoring',
              'Replace oversized transformers'
            ],
            priority: 'medium',
            requiredInvestment: 75000,
            paybackPeriod: 18,
            carbonReduction: 0
          });
        }

        // Demand response
        optimizations.push({
          id: 'demand-response-1',
          type: 'demand-response',
          title: 'Enroll in Demand Response Program',
          description: 'Participate in utility demand response for additional revenue',
          potentialSavings: analysis.peakDemand * 50 * 10, // 10 events per year
          implementation: [
            'Install automated demand response system',
            'Identify curtailable loads',
            'Train operators on DR procedures',
            'Integrate with utility signals'
          ],
          priority: 'low',
          requiredInvestment: 30000,
          paybackPeriod: 6,
          carbonReduction: analysis.peakDemand * 0.2 * 10
        });

        return optimizations;
      })
    );
  }

  getEnergyForecast(hours: number = 24): Observable<EnergyForecast[]> {
    return this.http.get<any>(`${this.apiUrl}/forecast`, { params: { hours: hours.toString() } }).pipe(
      map(data => {
        const forecasts: EnergyForecast[] = [];
        const now = new Date();

        for (let i = 0; i < hours; i++) {
          const timestamp = new Date(now.getTime() + i * 3600000);
          const baseConsumption = this.getTypicalConsumption(timestamp);
          const baseGeneration = this.getTypicalGeneration(timestamp);

          // Apply factors
          const weatherFactor = data.weather[i] || 1;
          const productionFactor = data.production[i] || 1;
          const historicalFactor = 1;

          forecasts.push({
            timestamp,
            predictedConsumption: baseConsumption * productionFactor,
            predictedGeneration: baseGeneration * weatherFactor,
            confidence: 85 + Math.random() * 10,
            factors: {
              weather: weatherFactor,
              production: productionFactor,
              historical: historicalFactor
            }
          });
        }

        return forecasts;
      }),
      tap(forecasts => this.forecastSubject.next(forecasts))
    );
  }

  optimizeEnergySchedule(constraints: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/optimize`, constraints).pipe(
      map(schedule => {
        // Process optimization results
        return {
          ...schedule,
          estimatedSavings: this.calculateScheduleSavings(schedule),
          carbonReduction: this.calculateCarbonReduction(schedule)
        };
      })
    );
  }

  getEnergyFlowData(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/flow`).pipe(
      map(flow => {
        // Transform for visualization
        return {
          nodes: [
            { id: 'grid', label: 'Grid Supply', type: 'source' },
            { id: 'solar', label: 'Solar Generation', type: 'source' },
            { id: 'wind', label: 'Wind Generation', type: 'source' },
            { id: 'battery', label: 'Battery Storage', type: 'storage' },
            { id: 'motors', label: 'Motors', type: 'load' },
            { id: 'lighting', label: 'Lighting', type: 'load' },
            { id: 'hvac', label: 'HVAC', type: 'load' },
            { id: 'production', label: 'Production', type: 'load' },
            { id: 'other', label: 'Other Loads', type: 'load' }
          ],
          links: [
            { source: 'grid', target: 'motors', value: flow.gridToMotors || 500 },
            { source: 'grid', target: 'lighting', value: flow.gridToLighting || 100 },
            { source: 'grid', target: 'hvac', value: flow.gridToHVAC || 200 },
            { source: 'solar', target: 'battery', value: flow.solarToBattery || 150 },
            { source: 'solar', target: 'production', value: flow.solarToProduction || 200 },
            { source: 'wind', target: 'motors', value: flow.windToMotors || 300 },
            { source: 'wind', target: 'battery', value: flow.windToBattery || 100 },
            { source: 'battery', target: 'production', value: flow.batteryToProduction || 150 },
            { source: 'battery', target: 'other', value: flow.batteryToOther || 50 }
          ],
          efficiency: flow.systemEfficiency || 0.87,
          losses: flow.totalLosses || 150,
          powerQuality: {
            voltage: flow.voltage || 415,
            frequency: flow.frequency || 50,
            thd: flow.thd || 2.5,
            powerFactor: flow.powerFactor || 0.92
          }
        };
      })
    );
  }

  // Utility methods
  private getTypicalConsumption(timestamp: Date): number {
    const hour = timestamp.getHours();
    const dayOfWeek = timestamp.getDay();

    // Base consumption pattern
    let base = 1000; // kW

    // Time of day factor
    if (hour >= 8 && hour <= 17) {
      base *= 1.5; // Peak hours
    } else if (hour >= 18 && hour <= 22) {
      base *= 1.2; // Evening
    } else {
      base *= 0.7; // Night
    }

    // Day of week factor
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      base *= 0.6; // Weekend
    }

    // Add some randomness
    base += (Math.random() - 0.5) * 200;

    return Math.max(base, 500);
  }

  private getTypicalGeneration(timestamp: Date): number {
    const hour = timestamp.getHours();
    let solar = 0;
    let wind = 300; // Base wind generation

    // Solar generation pattern
    if (hour >= 6 && hour <= 18) {
      const peakHour = 12;
      const hourDiff = Math.abs(hour - peakHour);
      solar = Math.max(0, (1 - hourDiff / 6) * 800);
    }

    // Wind variability
    wind += (Math.random() - 0.5) * 200;

    return Math.max(solar + wind, 0);
  }

  private calculateScheduleSavings(schedule: any): number {
    // Calculate savings from optimized schedule
    const currentCost = schedule.currentCost || 10000;
    const optimizedCost = schedule.optimizedCost || 8000;
    return currentCost - optimizedCost;
  }

  private calculateCarbonReduction(schedule: any): number {
    // Calculate CO2 reduction from optimization
    const currentEmissions = schedule.currentEmissions || 100;
    const optimizedEmissions = schedule.optimizedEmissions || 75;
    return currentEmissions - optimizedEmissions;
  }

  // Real-time optimization commands
  executeLoadShedding(loads: string[], duration: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/control/shed`, { loads, duration });
  }

  activateDemandResponse(level: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/control/demand-response`, { level });
  }

  switchToRenewable(percentage: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/control/renewable`, { percentage });
  }

  optimizeBatteryOperation(mode: 'peak-shaving' | 'arbitrage' | 'backup'): Observable<any> {
    return this.http.post(`${this.apiUrl}/control/battery`, { mode });
  }
}

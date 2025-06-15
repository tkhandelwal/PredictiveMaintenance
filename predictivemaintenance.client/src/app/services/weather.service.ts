// src/app/services/weather.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, timer } from 'rxjs';
import { map, switchMap, tap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

export interface WeatherData {
  temperature: number;
  humidity: number;
  pressure: number;
  windSpeed: number;
  windDirection: number;
  cloudCover: number;
  precipitation: number;
  solarIrradiance: number;
  uvIndex: number;
  visibility: number;
  conditions: string;
  icon: string;
  alerts: WeatherAlert[];
}

export interface WeatherAlert {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'extreme';
  title: string;
  description: string;
  startTime: Date;
  endTime: Date;
  affectedEquipment: string[];
}

export interface WeatherForecast {
  time: Date;
  temperature: number;
  windSpeed: number;
  cloudCover: number;
  precipitation: number;
  precipitationProbability: number;
  solarIrradiance: number;
  conditions: string;
  icon: string;
}

export interface WeatherImpact {
  equipmentType: string;
  impactType: 'performance' | 'reliability' | 'safety';
  severity: number; // 0-100
  description: string;
  mitigationActions: string[];
}

@Injectable({
  providedIn: 'root'
})
export class WeatherService {
  private apiKey = 'your-weather-api-key'; // Replace with actual API key
  private apiUrl = 'https://api.openweathermap.org/data/2.5';

  private currentWeatherSubject = new BehaviorSubject<WeatherData | null>(null);
  public currentWeather$ = this.currentWeatherSubject.asObservable();

  private forecastSubject = new BehaviorSubject<WeatherForecast[]>([]);
  public forecast$ = this.forecastSubject.asObservable();

  private weatherImpactsSubject = new BehaviorSubject<WeatherImpact[]>([]);
  public weatherImpacts$ = this.weatherImpactsSubject.asObservable();

  constructor(private http: HttpClient) {
    // Update weather every 10 minutes
    timer(0, 600000).pipe(
      switchMap(() => this.updateAllWeatherData())
    ).subscribe();
  }

  private updateAllWeatherData(): Observable<any> {
    // In production, use actual coordinates from site service
    const coordinates = { lat: 34.0522, lng: -118.2437 }; // Los Angeles

    return this.getCurrentWeather(coordinates).pipe(
      tap(() => this.getForecast(coordinates)),
      catchError(error => {
        console.error('Weather update failed:', error);
        return of(null);
      })
    );
  }

  getCurrentWeather(coordinates: { lat: number; lng: number }): Observable<WeatherData> {
    // For demo, return mock data
    // In production, call actual weather API
    const mockWeather: WeatherData = {
      temperature: 22 + Math.random() * 10,
      humidity: 40 + Math.random() * 30,
      pressure: 1010 + Math.random() * 20,
      windSpeed: 5 + Math.random() * 15,
      windDirection: Math.random() * 360,
      cloudCover: Math.random() * 100,
      precipitation: Math.random() < 0.3 ? Math.random() * 10 : 0,
      solarIrradiance: this.calculateSolarIrradiance(),
      uvIndex: 5 + Math.random() * 5,
      visibility: 8 + Math.random() * 2,
      conditions: this.getRandomCondition(),
      icon: '01d',
      alerts: this.generateWeatherAlerts()
    };

    this.currentWeatherSubject.next(mockWeather);
    this.analyzeWeatherImpacts(mockWeather);

    return of(mockWeather);
  }

  getForecast(coordinates: { lat: number; lng: number }, days: number = 7): Observable<WeatherForecast[]> {
    const forecast: WeatherForecast[] = [];
    const now = new Date();

    for (let i = 0; i < days * 24; i += 3) { // 3-hour intervals
      const time = new Date(now.getTime() + i * 3600000);
      const hour = time.getHours();

      forecast.push({
        time,
        temperature: this.getTemperatureForHour(hour) + (Math.random() - 0.5) * 5,
        windSpeed: 5 + Math.random() * 20,
        cloudCover: Math.random() * 100,
        precipitation: Math.random() < 0.2 ? Math.random() * 5 : 0,
        precipitationProbability: Math.random() * 100,
        solarIrradiance: this.getSolarIrradianceForHour(hour),
        conditions: this.getRandomCondition(),
        icon: hour >= 6 && hour <= 18 ? '01d' : '01n'
      });
    }

    this.forecastSubject.next(forecast);
    return of(forecast);
  }

  private calculateSolarIrradiance(): number {
    const hour = new Date().getHours();
    return this.getSolarIrradianceForHour(hour);
  }

  private getSolarIrradianceForHour(hour: number): number {
    // Simplified solar irradiance calculation
    if (hour < 6 || hour > 18) return 0;

    const peakHour = 12;
    const hourDiff = Math.abs(hour - peakHour);
    const baseIrradiance = 1000; // W/m² at solar noon

    return Math.max(0, baseIrradiance * (1 - hourDiff / 6) * (0.8 + Math.random() * 0.2));
  }

  private getTemperatureForHour(hour: number): number {
    // Temperature pattern
    const minTemp = 15;
    const maxTemp = 30;
    const range = maxTemp - minTemp;

    // Peak temperature around 3 PM
    const peakHour = 15;
    const hourDiff = Math.abs(hour - peakHour);

    return minTemp + range * (1 - hourDiff / 12);
  }

  private getRandomCondition(): string {
    const conditions = ['Clear', 'Partly Cloudy', 'Cloudy', 'Overcast', 'Light Rain', 'Rain', 'Thunderstorm', 'Foggy'];
    return conditions[Math.floor(Math.random() * conditions.length)];
  }

  private generateWeatherAlerts(): WeatherAlert[] {
    const alerts: WeatherAlert[] = [];

    // Randomly generate alerts
    if (Math.random() < 0.2) {
      alerts.push({
        type: 'High Wind',
        severity: 'medium',
        title: 'High Wind Warning',
        description: 'Wind speeds expected to exceed 40 mph',
        startTime: new Date(),
        endTime: new Date(Date.now() + 6 * 3600000),
        affectedEquipment: ['Wind Turbines', 'Overhead Lines']
      });
    }

    if (Math.random() < 0.1) {
      alerts.push({
        type: 'Extreme Heat',
        severity: 'high',
        title: 'Extreme Heat Advisory',
        description: 'Temperatures expected to exceed 40°C',
        startTime: new Date(Date.now() + 12 * 3600000),
        endTime: new Date(Date.now() + 24 * 3600000),
        affectedEquipment: ['Transformers', 'Motors', 'Solar Panels']
      });
    }

    return alerts;
  }

  private analyzeWeatherImpacts(weather: WeatherData): void {
    const impacts: WeatherImpact[] = [];

    // Temperature impacts
    if (weather.temperature > 35) {
      impacts.push({
        equipmentType: 'Transformer',
        impactType: 'performance',
        severity: Math.min(100, (weather.temperature - 35) * 10),
        description: `High ambient temperature (${weather.temperature.toFixed(1)}°C) reduces transformer cooling efficiency`,
        mitigationActions: [
          'Increase cooling fan speed',
          'Monitor winding temperature closely',
          'Consider load reduction if temperature exceeds limits'
        ]
      });

      impacts.push({
        equipmentType: 'Solar Panel',
        impactType: 'performance',
        severity: Math.min(100, (weather.temperature - 25) * 2),
        description: `High temperature reduces solar panel efficiency by ${((weather.temperature - 25) * 0.4).toFixed(1)}%`,
        mitigationActions: [
          'Ensure proper ventilation',
          'Clean panels to minimize additional heating',
          'Adjust inverter settings for temperature compensation'
        ]
      });
    }

    // Wind impacts
    if (weather.windSpeed > 20) {
      impacts.push({
        equipmentType: 'Wind Turbine',
        impactType: weather.windSpeed > 25 ? 'safety' : 'performance',
        severity: Math.min(100, (weather.windSpeed - 20) * 5),
        description: `${weather.windSpeed > 25 ? 'Extreme' : 'High'} wind speed: ${weather.windSpeed.toFixed(1)} m/s`,
        mitigationActions: weather.windSpeed > 25 ? [
          'Activate storm shutdown procedures',
          'Feather blades to safe position',
          'Monitor tower vibration levels'
        ] : [
          'Monitor for optimal power generation',
          'Check yaw system operation',
          'Verify pitch control response'
        ]
      });

      impacts.push({
        equipmentType: 'Overhead Line',
        impactType: 'reliability',
        severity: Math.min(100, (weather.windSpeed - 15) * 3),
        description: `High wind increases risk of line galloping and tree contact`,
        mitigationActions: [
          'Increase line patrol frequency',
          'Monitor for vegetation encroachment',
          'Check vibration dampers'
        ]
      });
    }

    // Precipitation impacts
    if (weather.precipitation > 5) {
      impacts.push({
        equipmentType: 'Outdoor Equipment',
        impactType: 'reliability',
        severity: Math.min(100, weather.precipitation * 5),
        description: `Heavy precipitation: ${weather.precipitation.toFixed(1)} mm/hr`,
        mitigationActions: [
          'Verify all enclosure seals',
          'Check drainage systems',
          'Monitor insulation resistance',
          'Inspect for water ingress after rain'
        ]
      });
    }

    // Solar irradiance impacts
    if (weather.solarIrradiance < 200 && weather.cloudCover > 80) {
      impacts.push({
        equipmentType: 'Solar Panel',
        impactType: 'performance',
        severity: 100 - (weather.solarIrradiance / 10),
        description: `Low solar irradiance: ${weather.solarIrradiance.toFixed(0)} W/m² due to ${weather.cloudCover.toFixed(0)}% cloud cover`,
        mitigationActions: [
          'Switch to alternative power sources',
          'Optimize battery discharge strategy',
          'Delay non-critical loads'
        ]
      });
    }

    // Lightning risk
    if (weather.conditions.toLowerCase().includes('thunder')) {
      impacts.push({
        equipmentType: 'All Outdoor Equipment',
        impactType: 'safety',
        severity: 90,
        description: 'Thunderstorm activity detected - high lightning risk',
        mitigationActions: [
          'Verify surge protection systems active',
          'Postpone outdoor maintenance work',
          'Monitor grounding system integrity',
          'Prepare for possible power quality issues'
        ]
      });
    }

    this.weatherImpactsSubject.next(impacts);
  }

  // Get historical weather data
  getHistoricalWeather(coordinates: { lat: number; lng: number }, days: number): Observable<WeatherData[]> {
    const historical: WeatherData[] = [];
    const now = new Date();

    for (let i = 0; i < days * 24; i++) {
      const time = new Date(now.getTime() - i * 3600000);

      historical.push({
        temperature: this.getTemperatureForHour(time.getHours()) + (Math.random() - 0.5) * 5,
        humidity: 40 + Math.random() * 30,
        pressure: 1010 + Math.random() * 20,
        windSpeed: 5 + Math.random() * 15,
        windDirection: Math.random() * 360,
        cloudCover: Math.random() * 100,
        precipitation: Math.random() < 0.2 ? Math.random() * 5 : 0,
        solarIrradiance: this.getSolarIrradianceForHour(time.getHours()),
        uvIndex: 5 + Math.random() * 5,
        visibility: 8 + Math.random() * 2,
        conditions: this.getRandomCondition(),
        icon: '01d',
        alerts: []
      });
    }

    return of(historical);
  }

  // Analyze correlation between weather and equipment performance
  analyzeWeatherCorrelation(equipmentId: number, metric: string): Observable<any> {
    // This would typically correlate historical weather with equipment performance
    return of({
      correlation: 0.7 + Math.random() * 0.2,
      significantFactors: [
        { factor: 'temperature', impact: 0.8 },
        { factor: 'humidity', impact: 0.3 },
        { factor: 'windSpeed', impact: 0.5 }
      ],
      optimalConditions: {
        temperature: { min: 15, max: 25 },
        humidity: { min: 30, max: 60 },
        windSpeed: { min: 5, max: 15 }
      },
      recommendations: [
        'Schedule maintenance during optimal weather windows',
        'Implement weather-based operational adjustments',
        'Install additional weather monitoring sensors'
      ]
    });
  }

  // Get weather-based operational recommendations
  getOperationalRecommendations(weather: WeatherData, equipment: any[]): Observable<any[]> {
    const recommendations: any[] = [];

    // Temperature-based recommendations
    if (weather.temperature > 35) {
      recommendations.push({
        priority: 'high',
        category: 'cooling',
        title: 'Activate Enhanced Cooling Protocols',
        actions: [
          'Increase transformer cooling fan speeds',
          'Reduce load on temperature-sensitive equipment',
          'Monitor hot spot temperatures closely'
        ],
        estimatedImpact: 'Prevent 2-3% efficiency loss'
      });
    }

    // Solar optimization
    if (weather.solarIrradiance > 800) {
      recommendations.push({
        priority: 'medium',
        category: 'energy',
        title: 'Optimize for High Solar Generation',
        actions: [
          'Shift loads to match solar peak',
          'Charge batteries for evening use',
          'Reduce grid import'
        ],
        estimatedImpact: 'Save $500-800 in energy costs today'
      });
    }

    // Wind turbine optimization
    if (weather.windSpeed >= 12 && weather.windSpeed <= 20) {
      recommendations.push({
        priority: 'medium',
        category: 'generation',
        title: 'Wind Turbines at Optimal Speed',
        actions: [
          'Ensure all turbines are operational',
          'Monitor for maximum power point tracking',
          'Schedule non-critical maintenance for low-wind periods'
        ],
        estimatedImpact: 'Generate additional 500 MWh today'
      });
    }

    return of(recommendations);
  }

  // Emergency weather response
  triggerWeatherEmergencyProtocol(alert: WeatherAlert): Observable<any> {
    return of({
      protocolId: `WEP-${Date.now()}`,
      actions: [
        'Notify operations team',
        'Secure outdoor equipment',
        'Switch to backup power if needed',
        'Implement load shedding if required'
      ],
      affectedSystems: alert.affectedEquipment,
      estimatedDuration: Math.floor((alert.endTime.getTime() - alert.startTime.getTime()) / 3600000),
      status: 'activated'
    });
  }
}

// src/app/services/site.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface Site {
  id: string;
  name: string;
  type: 'manufacturing' | 'distribution' | 'generation' | 'substation';
  location: string;
  address: string;
  coordinates: { lat: number; lng: number };
  timezone: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  status: 'online' | 'offline' | 'partial';
  equipmentCount: number;
  activeAlerts: number;
  metrics: SiteMetrics;
  weatherData?: WeatherData;
  energyData?: EnergyData;
}

export interface SiteMetrics {
  availability: number;
  efficiency: number;
  utilization: number;
  mtbf: number;
  mttr: number;
}

export interface WeatherData {
  temperature: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  solarIrradiance?: number;
  conditions: string;
}

export interface EnergyData {
  consumption: number;
  generation: number;
  netEnergy: number;
  peakDemand: number;
  powerFactor: number;
  carbonEmissions: number;
}

@Injectable({
  providedIn: 'root'
})
export class SiteService {
  private apiUrl = `${environment.apiUrl}/api/sites`;

  constructor(private http: HttpClient) { }

  getAllSites(): Observable<Site[]> {
    return this.http.get<Site[]>(this.apiUrl).pipe(
      catchError(error => {
        console.error('Error loading sites:', error);
        return of(this.getMockSites());
      })
    );
  }

  getSiteById(id: string): Observable<Site> {
    return this.http.get<Site>(`${this.apiUrl}/${id}`).pipe(
      catchError(error => {
        console.error('Error loading site:', error);
        const mockSites = this.getMockSites();
        const site = mockSites.find(s => s.id === id);
        return of(site || mockSites[0]);
      })
    );
  }

  getSiteMetrics(siteId: string): Observable<SiteMetrics> {
    return this.http.get<SiteMetrics>(`${this.apiUrl}/${siteId}/metrics`).pipe(
      catchError(() => of({
        availability: 96.5,
        efficiency: 87.3,
        utilization: 78.9,
        mtbf: 720,
        mttr: 4.5
      }))
    );
  }

  updateSite(site: Site): Observable<Site> {
    return this.http.put<Site>(`${this.apiUrl}/${site.id}`, site);
  }

  private getMockSites(): Site[] {
    return [
      {
        id: 'site-1',
        name: 'Main Manufacturing Plant',
        type: 'manufacturing',
        location: 'Los Angeles, CA',
        address: '1234 Industrial Way, Los Angeles, CA 90001',
        coordinates: { lat: 34.0522, lng: -118.2437 },
        timezone: 'America/Los_Angeles',
        contactPerson: 'John Smith',
        contactEmail: 'john.smith@company.com',
        contactPhone: '+1 (555) 123-4567',
        status: 'online',
        equipmentCount: 245,
        activeAlerts: 3,
        metrics: {
          availability: 96.5,
          efficiency: 87.3,
          utilization: 78.9,
          mtbf: 720,
          mttr: 4.5
        },
        weatherData: {
          temperature: 72,
          humidity: 65,
          windSpeed: 8,
          windDirection: 270,
          conditions: 'Partly Cloudy'
        },
        energyData: {
          consumption: 2456.8,
          generation: 0,
          netEnergy: -2456.8,
          peakDemand: 3200,
          powerFactor: 0.92,
          carbonEmissions: 1234.5
        }
      },
      {
        id: 'site-2',
        name: 'East Coast Distribution Center',
        type: 'distribution',
        location: 'Newark, NJ',
        address: '5678 Logistics Blvd, Newark, NJ 07102',
        coordinates: { lat: 40.7357, lng: -74.1724 },
        timezone: 'America/New_York',
        contactPerson: 'Jane Doe',
        contactEmail: 'jane.doe@company.com',
        contactPhone: '+1 (555) 234-5678',
        status: 'online',
        equipmentCount: 128,
        activeAlerts: 1,
        metrics: {
          availability: 98.2,
          efficiency: 91.5,
          utilization: 82.3,
          mtbf: 960,
          mttr: 3.2
        }
      },
      {
        id: 'site-3',
        name: 'Solar Farm Alpha',
        type: 'generation',
        location: 'Phoenix, AZ',
        address: '9012 Solar Drive, Phoenix, AZ 85001',
        coordinates: { lat: 33.4484, lng: -112.0740 },
        timezone: 'America/Phoenix',
        contactPerson: 'Mike Johnson',
        contactEmail: 'mike.johnson@company.com',
        contactPhone: '+1 (555) 345-6789',
        status: 'partial',
        equipmentCount: 89,
        activeAlerts: 5,
        metrics: {
          availability: 92.1,
          efficiency: 89.7,
          utilization: 95.2,
          mtbf: 480,
          mttr: 6.8
        },
        weatherData: {
          temperature: 95,
          humidity: 25,
          windSpeed: 12,
          windDirection: 180,
          solarIrradiance: 850,
          conditions: 'Clear'
        },
        energyData: {
          consumption: 50,
          generation: 856.3,
          netEnergy: 806.3,
          peakDemand: 60,
          powerFactor: 0.98,
          carbonEmissions: -428.2
        }
      },
      {
        id: 'site-4',
        name: 'Wind Farm Beta',
        type: 'generation',
        location: 'Amarillo, TX',
        address: '3456 Turbine Road, Amarillo, TX 79101',
        coordinates: { lat: 35.2220, lng: -101.8313 },
        timezone: 'America/Chicago',
        contactPerson: 'Sarah Williams',
        contactEmail: 'sarah.williams@company.com',
        contactPhone: '+1 (555) 456-7890',
        status: 'online',
        equipmentCount: 156,
        activeAlerts: 2,
        metrics: {
          availability: 94.8,
          efficiency: 88.2,
          utilization: 76.5,
          mtbf: 600,
          mttr: 5.5
        },
        weatherData: {
          temperature: 68,
          humidity: 45,
          windSpeed: 18,
          windDirection: 315,
          conditions: 'Windy'
        },
        energyData: {
          consumption: 75,
          generation: 1243.7,
          netEnergy: 1168.7,
          peakDemand: 90,
          powerFactor: 0.95,
          carbonEmissions: -621.9
        }
      }
    ];
  }
}

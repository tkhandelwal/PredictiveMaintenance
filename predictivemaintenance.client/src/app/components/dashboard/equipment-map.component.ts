// src/app/components/dashboard/equipment-map/equipment-map.component.ts
import { Component, Input, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';

interface MapSite {
  id: string;
  name: string;
  location: string;
  coordinates: { lat: number; lng: number };
  status: 'online' | 'offline' | 'partial';
  equipmentCount: number;
}

@Component({
  selector: 'app-equipment-map',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="map-container">
      <div #mapElement class="map"></div>
      <div class="map-legend">
        <h4>Site Status</h4>
        <div class="legend-item">
          <span class="status-dot online"></span>
          <span>Online</span>
        </div>
        <div class="legend-item">
          <span class="status-dot partial"></span>
          <span>Partial</span>
        </div>
        <div class="legend-item">
          <span class="status-dot offline"></span>
          <span>Offline</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .map-container {
      position: relative;
      height: 400px;
      width: 100%;
    }

    .map {
      height: 100%;
      width: 100%;
      border-radius: 8px;
      z-index: 1;
    }

    .map-legend {
      position: absolute;
      bottom: 20px;
      right: 20px;
      background: white;
      padding: 12px 16px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      z-index: 1000;

      h4 {
        margin: 0 0 8px 0;
        font-size: 14px;
        font-weight: 600;
      }

      .legend-item {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 4px;
        font-size: 12px;

        .status-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          
          &.online { background: #10b981; }
          &.partial { background: #f59e0b; }
          &.offline { background: #ef4444; }
        }
      }
    }

    /* Dark theme */
    :host-context(.dark-theme) {
      .map-legend {
        background: #1e293b;
        color: #f1f5f9;
      }
    }
  `]
})
export class EquipmentMapComponent implements OnInit, OnDestroy {
  @ViewChild('mapElement', { static: true }) mapElement!: ElementRef;
  @Input() sites: MapSite[] = [];
  @Input() selectedSite?: MapSite;

  private map?: L.Map;
  private markers: L.Marker[] = [];

  ngOnInit(): void {
    this.initializeMap();
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
  }

  ngOnChanges(): void {
    if (this.map) {
      this.updateMarkers();
    }
  }

  private initializeMap(): void {
    // Initialize map centered on US
    this.map = L.map(this.mapElement.nativeElement).setView([39.8283, -98.5795], 4);

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 18
    }).addTo(this.map);

    // Add markers for sites
    this.updateMarkers();
  }

  private updateMarkers(): void {
    if (!this.map) return;

    // Clear existing markers
    this.markers.forEach(marker => marker.remove());
    this.markers = [];

    // Add markers for each site
    this.sites.forEach(site => {
      const icon = this.createCustomIcon(site.status);

      const marker = L.marker(
        [site.coordinates.lat, site.coordinates.lng],
        { icon }
      ).addTo(this.map!);

      // Add popup
      marker.bindPopup(`
        <div style="text-align: center;">
          <h4 style="margin: 0 0 8px 0;">${site.name}</h4>
          <p style="margin: 0 0 4px 0; color: #666;">${site.location}</p>
          <p style="margin: 0; font-weight: bold;">
            ${site.equipmentCount} Equipment
          </p>
          <span style="display: inline-block; margin-top: 8px; padding: 4px 12px; 
                       background: ${this.getStatusColor(site.status)}; 
                       color: white; border-radius: 12px; font-size: 12px;">
            ${site.status.toUpperCase()}
          </span>
        </div>
      `);

      this.markers.push(marker);

      // Highlight selected site
      if (this.selectedSite && site.id === this.selectedSite.id) {
        marker.openPopup();
      }
    });

    // Fit bounds to show all markers
    if (this.markers.length > 0) {
      const group = L.featureGroup(this.markers);
      this.map.fitBounds(group.getBounds().pad(0.1));
    }
  }

  private createCustomIcon(status: string): L.Icon {
    const color = this.getStatusColor(status);

    const svgIcon = `
      <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
        <circle cx="20" cy="20" r="18" fill="${color}" opacity="0.3"/>
        <circle cx="20" cy="20" r="12" fill="${color}"/>
        <circle cx="20" cy="20" r="6" fill="white"/>
      </svg>
    `;

    return L.divIcon({
      html: svgIcon,
      className: 'custom-marker',
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });
  }

  private getStatusColor(status: string): string {
    switch (status) {
      case 'online': return '#10b981';
      case 'partial': return '#f59e0b';
      case 'offline': return '#ef4444';
      default: return '#6b7280';
    }
  }
}

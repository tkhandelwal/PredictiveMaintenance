// src/app/components/dashboard/kpi-cards/kpi-cards.component.ts
import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';

interface KPICard {
  title: string;
  value: number | string;
  unit: string;
  icon: string;
  trend: 'up' | 'down' | 'stable';
  trendValue: number;
  color: string;
  target?: number;
  description: string;
}

@Component({
  selector: 'app-kpi-cards',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressBarModule
  ],
  template: `
    <div class="kpi-container">
      <div class="kpi-grid">
        <mat-card *ngFor="let kpi of kpiCards" class="kpi-card" [class]="'kpi-' + kpi.color">
          <div class="kpi-header">
            <div class="kpi-icon" [style.background]="getGradient(kpi.color)">
              <mat-icon>{{ kpi.icon }}</mat-icon>
            </div>
            <button mat-icon-button [matTooltip]="kpi.description">
              <mat-icon>info_outline</mat-icon>
            </button>
          </div>
          
          <div class="kpi-content">
            <h3 class="kpi-title">{{ kpi.title }}</h3>
            <div class="kpi-value-container">
              <span class="kpi-value">{{ formatValue(kpi.value) }}</span>
              <span class="kpi-unit">{{ kpi.unit }}</span>
            </div>
            
            <div class="kpi-trend" [class]="'trend-' + kpi.trend">
              <mat-icon>{{ getTrendIcon(kpi.trend) }}</mat-icon>
              <span>{{ kpi.trendValue }}%</span>
              <span class="trend-label">vs last period</span>
            </div>
            
            <mat-progress-bar 
              *ngIf="kpi.target" 
              mode="determinate" 
              [value]="calculateProgress(kpi.value, kpi.target)"
              [color]="getProgressColor(kpi.value, kpi.target)">
            </mat-progress-bar>
            <div *ngIf="kpi.target" class="kpi-target">
              Target: {{ kpi.target }}{{ kpi.unit }}
            </div>
          </div>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    .kpi-container {
      margin-bottom: 24px;
    }

    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 20px;
    }

    .kpi-card {
      position: relative;
      overflow: hidden;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      cursor: pointer;
      
      &:hover {
        transform: translateY(-5px);
        box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15);
      }
      
      &::before {
        content: '';
        position: absolute;
        top: 0;
        right: 0;
        width: 100px;
        height: 100px;
        background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
        transform: translate(30px, -30px);
      }
    }

    .kpi-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;
    }

    .kpi-icon {
      width: 56px;
      height: 56px;
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 28px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .kpi-content {
      .kpi-title {
        font-size: 14px;
        font-weight: 500;
        color: #64748b;
        margin: 0 0 8px 0;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .kpi-value-container {
        display: flex;
        align-items: baseline;
        margin-bottom: 12px;
        
        .kpi-value {
          font-size: 32px;
          font-weight: 700;
          color: #1e293b;
          line-height: 1;
        }
        
        .kpi-unit {
          font-size: 16px;
          color: #64748b;
          margin-left: 4px;
        }
      }

      .kpi-trend {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 14px;
        margin-bottom: 12px;
        
        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
        }
        
        &.trend-up {
          color: #10b981;
          mat-icon { transform: rotate(-90deg); }
        }
        
        &.trend-down {
          color: #ef4444;
          mat-icon { transform: rotate(90deg); }
        }
        
        &.trend-stable {
          color: #6b7280;
        }
        
        .trend-label {
          color: #94a3b8;
          font-size: 12px;
        }
      }

      mat-progress-bar {
        height: 6px;
        border-radius: 3px;
        margin-bottom: 8px;
      }

      .kpi-target {
        font-size: 12px;
        color: #64748b;
      }
    }

    /* Dark theme adjustments */
    :host-context(.dark-theme) {
      .kpi-card {
        background: #1e293b;
        
        .kpi-value {
          color: #f1f5f9;
        }
        
        .kpi-title, .kpi-unit, .kpi-target {
          color: #94a3b8;
        }
      }
    }

    @media (max-width: 768px) {
      .kpi-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class KpiCardsComponent implements OnInit {
  @Input() metrics: any;

  kpiCards: KPICard[] = [];

  ngOnInit(): void {
    this.updateKPICards();
  }

  ngOnChanges(): void {
    this.updateKPICards();
  }

  private updateKPICards(): void {
    if (!this.metrics) return;

    this.kpiCards = [
      {
        title: 'Availability Rate',
        value: this.metrics.availabilityRate,
        unit: '%',
        icon: 'speed',
        trend: this.metrics.availabilityRate > 95 ? 'up' : 'down',
        trendValue: 2.3,
        color: 'primary',
        target: 99,
        description: 'Percentage of equipment currently operational'
      },
      {
        title: 'MTBF',
        value: this.metrics.mtbf,
        unit: 'hrs',
        icon: 'schedule',
        trend: 'up',
        trendValue: 5.7,
        color: 'success',
        description: 'Mean Time Between Failures'
      },
      {
        title: 'MTTR',
        value: this.metrics.mttr,
        unit: 'hrs',
        icon: 'build_circle',
        trend: 'down',
        trendValue: -12.4,
        color: 'warning',
        target: 4,
        description: 'Mean Time To Repair'
      },
      {
        title: 'OEE',
        value: this.metrics.oee,
        unit: '%',
        icon: 'analytics',
        trend: 'stable',
        trendValue: 0.2,
        color: 'info',
        target: 90,
        description: 'Overall Equipment Effectiveness'
      },
      {
        title: 'Energy Consumption',
        value: this.metrics.energyConsumption,
        unit: 'MWh',
        icon: 'electric_bolt',
        trend: 'down',
        trendValue: -8.3,
        color: 'accent',
        description: 'Total energy consumed today'
      },
      {
        title: 'Carbon Footprint',
        value: this.metrics.carbonFootprint,
        unit: 'tCO₂',
        icon: 'eco',
        trend: 'down',
        trendValue: -15.2,
        color: 'success',
        target: 1000,
        description: 'CO₂ emissions this month'
      }
    ];
  }

  formatValue(value: number | string): string {
    if (typeof value === 'number') {
      if (value >= 1000) {
        return (value / 1000).toFixed(1) + 'k';
      }
      return value.toFixed(1);
    }
    return value;
  }

  getTrendIcon(trend: string): string {
    switch (trend) {
      case 'up': return 'arrow_right';
      case 'down': return 'arrow_right';
      case 'stable': return 'remove';
      default: return 'remove';
    }
  }

  getGradient(color: string): string {
    const gradients: { [key: string]: string } = {
      primary: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      success: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
      warning: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
      danger: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      info: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      accent: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)'
    };
    return gradients[color] || gradients.primary;
  }

  calculateProgress(value: number | string, target: number): number {
    const numValue = typeof value === 'number' ? value : parseFloat(value);
    return Math.min((numValue / target) * 100, 100);
  }

  getProgressColor(value: number | string, target: number): string {
    const progress = this.calculateProgress(value, target);
    if (progress >= 90) return 'primary';
    if (progress >= 70) return 'warn';
    return 'accent';
  }
}

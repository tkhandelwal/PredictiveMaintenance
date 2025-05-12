// src/app/components/dashboard/predictive-insights/predictive-insights.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';

@Component({
  selector: 'app-predictive-insights',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatProgressBarModule],
  template: `
    <mat-card class="insights-card">
      <mat-card-header>
        <mat-card-title>
          <div class="header-with-icon">
            <mat-icon>insights</mat-icon>
            <span>Predictive Maintenance Insights</span>
          </div>
        </mat-card-title>
        <mat-card-subtitle>
          Powered by advanced machine learning algorithms
        </mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        <div class="algorithms-section">
          <h3>Detection Algorithms</h3>
          <div class="algorithm-items">
            <div class="algorithm-item" *ngFor="let algorithm of algorithms">
              <div class="algorithm-header">
                <mat-icon>{{ algorithm.icon }}</mat-icon>
                <h4>{{ algorithm.name }}</h4>
              </div>
              <p class="algorithm-desc">{{ algorithm.description }}</p>
              <div class="algorithm-metrics">
                <div class="metric">
                  <span class="metric-label">Confidence</span>
                  <mat-progress-bar mode="determinate" [value]="algorithm.confidence"></mat-progress-bar>
                  <span class="metric-value">{{ algorithm.confidence }}%</span>
                </div>
                <div class="metric">
                  <span class="metric-label">Weight</span>
                  <span class="metric-value">{{ algorithm.weight }}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="models-section">
          <h3>Model Performance</h3>
          <div class="model-metrics">
            <div class="metric-card">
              <div class="metric-value">97.8%</div>
              <div class="metric-label">Accuracy</div>
            </div>
            <div class="metric-card">
              <div class="metric-value">93.2%</div>
              <div class="metric-label">Precision</div>
            </div>
            <div class="metric-card">
              <div class="metric-value">91.5%</div>
              <div class="metric-label">Recall</div>
            </div>
            <div class="metric-card">
              <div class="metric-value">92.3%</div>
              <div class="metric-label">F1 Score</div>
            </div>
          </div>
        </div>

        <div class="explanation-section">
          <h3>How It Works</h3>
          <div class="steps">
            <div class="step">
              <div class="step-number">1</div>
              <div class="step-content">
                <h4>Data Collection</h4>
                <p>Real-time sensor data is collected from equipment including temperature, vibration, pressure, flow rate and RPM.</p>
              </div>
            </div>
            <div class="step">
              <div class="step-number">2</div>
              <div class="step-content">
                <h4>Multi-Model Analysis</h4>
                <p>Data is analyzed using multiple statistical and machine learning models to detect anomalies and patterns.</p>
              </div>
            </div>
            <div class="step">
              <div class="step-number">3</div>
              <div class="step-content">
                <h4>Ensemble Decision</h4>
                <p>Results from all detection methods are combined using a weighted ensemble approach for higher accuracy.</p>
              </div>
            </div>
            <div class="step">
              <div class="step-number">4</div>
              <div class="step-content">
                <h4>Predictive Maintenance</h4>
                <p>The system recommends optimal maintenance timing based on detected anomalies and historical performance.</p>
              </div>
            </div>
          </div>
        </div>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .insights-card {
      margin-bottom: 24px;
    }

    .header-with-icon {
      display: flex;
      align-items: center;
    }

    .header-with-icon mat-icon {
      margin-right: 8px;
      color: #3f51b5;
    }

    .algorithms-section, .models-section, .explanation-section {
      margin-bottom: 24px;
    }

    h3 {
      color: #3f51b5;
      font-size: 18px;
      margin-bottom: 16px;
      border-bottom: 1px solid rgba(0,0,0,0.1);
      padding-bottom: 8px;
    }

    .algorithm-items {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
    }

    .algorithm-item {
      background: rgba(0,0,0,0.02);
      border-radius: 8px;
      padding: 16px;
      transition: transform 0.3s, box-shadow 0.3s;
    }

    .algorithm-item:hover {
      transform: translateY(-5px);
      box-shadow: 0 5px 15px rgba(0,0,0,0.1);
    }

    .algorithm-header {
      display: flex;
      align-items: center;
      margin-bottom: 8px;
    }

    .algorithm-header mat-icon {
      margin-right: 8px;
      color: #3f51b5;
    }

    .algorithm-header h4 {
      margin: 0;
      font-weight: 500;
    }

    .algorithm-desc {
      color: rgba(0,0,0,0.6);
      font-size: 14px;
      margin-bottom: 16px;
    }

    .algorithm-metrics {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .metric {
      display: flex;
      align-items: center;
    }

    .metric-label {
      width: 80px;
      font-size: 14px;
      color: rgba(0,0,0,0.6);
    }

    .metric-value {
      margin-left: 8px;
      font-weight: 500;
    }

    mat-progress-bar {
      flex: 1;
    }

    .model-metrics {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 16px;
      margin-bottom: 16px;
    }

    .metric-card {
      background: linear-gradient(135deg, #3f51b5, #2196f3);
      color: white;
      padding: 16px;
      border-radius: 8px;
      text-align: center;
    }

    .metric-card .metric-value {
      font-size: 24px;
      font-weight: 700;
      margin: 0;
    }

    .metric-card .metric-label {
      font-size: 14px;
      width: auto;
      margin: 0;
      color: rgba(255,255,255,0.8);
    }

    .steps {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .step {
      display: flex;
      align-items: flex-start;
    }

    .step-number {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      background: #3f51b5;
      color: white;
      border-radius: 50%;
      font-weight: 700;
      margin-right: 16px;
      flex-shrink: 0;
    }

    .step-content h4 {
      margin: 0 0 8px 0;
      font-weight: 500;
    }

    .step-content p {
      margin: 0;
      color: rgba(0,0,0,0.6);
    }

    @media (max-width: 768px) {
      .algorithm-items {
        grid-template-columns: 1fr;
      }

      .model-metrics {
        grid-template-columns: 1fr 1fr;
      }
    }
  `]
})
export class PredictiveInsightsComponent implements OnInit {
  algorithms = [
    {
      name: 'Statistical Z-Score',
      icon: 'analytics',
      description: 'Detects outliers based on how many standard deviations a value is from the mean of historical data.',
      confidence: 92,
      weight: 20
    },
    {
      name: 'Isolation Forest',
      icon: 'account_tree',
      description: 'Machine learning algorithm that isolates anomalies by recursively partitioning the data space.',
      confidence: 95,
      weight: 30
    },
    {
      name: 'Moving Average',
      icon: 'show_chart',
      description: 'Compares current values to the average of recent readings to detect sudden changes.',
      confidence: 89,
      weight: 15
    },
    {
      name: 'Seasonal Pattern',
      icon: 'date_range',
      description: 'Identifies anomalies by comparing with values from similar times in past cycles.',
      confidence: 87,
      weight: 15
    },
    {
      name: 'Rate of Change',
      icon: 'trending_up',
      description: 'Monitors how quickly values are changing to detect unusually rapid shifts.',
      confidence: 91,
      weight: 10
    },
    {
      name: 'CUSUM Analysis',
      icon: 'stacked_line_chart',
      description: 'Tracks cumulative sums of deviations to detect small but persistent changes over time.',
      confidence: 88,
      weight: 10
    }
  ];

  constructor() { }

  ngOnInit(): void {
  }
}

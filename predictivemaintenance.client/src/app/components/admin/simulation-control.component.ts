import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { forkJoin, Subscription } from 'rxjs';

import { Equipment } from '../../models/equipment.model';
import { EquipmentService } from '../../services/equipment.service';
import { SimulationService } from '../../services/simulation.service';
import { SignalRService } from '../../services/signalr.service';
import { LoadingService } from '../../services/loading.service';
import { LoadingSpinnerComponent } from '../../components/shared/loading-spinner.component';

interface ActiveSimulation {
  id: string;
  equipmentId: number;
  scenarioType: string;
  startTime: Date;
  duration: number;
  progress: number;
  status: 'Running' | 'Completed' | 'Failed' | 'Paused';
}

interface SimulationScenario {
  type: string;
  name: string;
  description: string;
  defaultDuration: number;
}

@Component({
  selector: 'app-simulation-control',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatDividerModule,
    MatProgressBarModule,
    LoadingSpinnerComponent
  ],
  templateUrl: './simulation-control.component.html',
  styleUrls: ['./simulation-control.component.scss']
})
export class SimulationControlComponent implements OnInit, OnDestroy {
  simulationForm!: FormGroup;
  equipmentList: Equipment[] = [];
  activeSimulations: ActiveSimulation[] = [];
  isLoading = false;

  simulationScenarios: SimulationScenario[] = [
    {
      type: 'degradation',
      name: 'Equipment Degradation',
      description: 'Simulate gradual equipment degradation over time',
      defaultDuration: 3600
    },
    {
      type: 'failure',
      name: 'Critical Failure',
      description: 'Simulate sudden equipment failure scenario',
      defaultDuration: 1800
    },
    {
      type: 'maintenance',
      name: 'Maintenance Impact',
      description: 'Simulate the impact of maintenance activities',
      defaultDuration: 2700
    },
    {
      type: 'overload',
      name: 'System Overload',
      description: 'Simulate system overload conditions',
      defaultDuration: 1200
    }
  ];

  private subscriptions = new Subscription();

  constructor(
    private fb: FormBuilder,
    private equipmentService: EquipmentService,
    private simulationService: SimulationService,
    private signalRService: SignalRService,
    private loadingService: LoadingService,
    private snackBar: MatSnackBar
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    this.loadEquipment();
    this.subscribeToSimulationUpdates();
    this.loadActiveSimulations();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private initializeForm(): void {
    this.simulationForm = this.fb.group({
      equipmentId: ['', [Validators.required]],
      scenarioType: ['', [Validators.required]],
      duration: [3600, [Validators.required, Validators.min(60), Validators.max(86400)]],
      parameters: this.fb.group({
        severity: [50, [Validators.min(1), Validators.max(100)]],
        randomSeed: [Math.floor(Math.random() * 10000)],
        includeWeatherEffects: [false],
        includeLoadVariations: [true]
      })
    });

    // Update duration when scenario type changes
    this.subscriptions.add(
      this.simulationForm.get('scenarioType')?.valueChanges.subscribe(scenarioType => {
        const scenario = this.simulationScenarios.find(s => s.type === scenarioType);
        if (scenario) {
          this.simulationForm.patchValue({ duration: scenario.defaultDuration });
        }
      })
    );
  }

  private loadEquipment(): void {
    this.isLoading = true;

    this.subscriptions.add(
      this.equipmentService.getAllEquipment().subscribe({
        next: (equipment) => {
          this.equipmentList = equipment.filter(eq => eq.status === 'Online');
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error loading equipment:', error);
          this.showError('Failed to load equipment list');
          this.isLoading = false;
        }
      })
    );
  }

  private loadActiveSimulations(): void {
    this.subscriptions.add(
      this.simulationService.getActiveSimulations().subscribe({
        next: (simulations) => {
          this.activeSimulations = simulations;
        },
        error: (error) => {
          console.error('Error loading active simulations:', error);
        }
      })
    );
  }

  private subscribeToSimulationUpdates(): void {
    this.subscriptions.add(
      this.signalRService.onSimulationUpdate().subscribe({
        next: (update) => {
          this.updateSimulationProgress(update);
        },
        error: (error) => {
          console.error('Error receiving simulation updates:', error);
        }
      })
    );

    this.subscriptions.add(
      this.signalRService.onSimulationCompleted().subscribe({
        next: (simulationId) => {
          this.handleSimulationCompleted(simulationId);
        }
      })
    );
  }

  startSimulation(): void {
    if (this.simulationForm.valid) {
      const formValue = this.simulationForm.value;

      const simulationRequest = {
        equipmentId: formValue.equipmentId,
        scenarioType: formValue.scenarioType,
        duration: formValue.duration,
        parameters: formValue.parameters
      };

      this.isLoading = true;

      this.subscriptions.add(
        this.simulationService.startSimulation(simulationRequest).subscribe({
          next: (response) => {
            const newSimulation: ActiveSimulation = {
              id: response.simulationId,
              equipmentId: formValue.equipmentId,
              scenarioType: formValue.scenarioType,
              startTime: new Date(),
              duration: formValue.duration,
              progress: 0,
              status: 'Running'
            };

            this.activeSimulations.push(newSimulation);
            this.showSuccess('Simulation started successfully');
            this.simulationForm.reset();
            this.isLoading = false;
          },
          error: (error) => {
            console.error('Error starting simulation:', error);
            this.showError('Failed to start simulation');
            this.isLoading = false;
          }
        })
      );
    } else {
      this.markFormGroupTouched();
    }
  }

  stopSimulation(simulationId: string): void {
    this.subscriptions.add(
      this.simulationService.stopSimulation(simulationId).subscribe({
        next: () => {
          const simulation = this.activeSimulations.find(s => s.id === simulationId);
          if (simulation) {
            simulation.status = 'Completed';
          }
          this.showSuccess('Simulation stopped successfully');
        },
        error: (error) => {
          console.error('Error stopping simulation:', error);
          this.showError('Failed to stop simulation');
        }
      })
    );
  }

  pauseSimulation(simulationId: string): void {
    this.subscriptions.add(
      this.simulationService.pauseSimulation(simulationId).subscribe({
        next: () => {
          const simulation = this.activeSimulations.find(s => s.id === simulationId);
          if (simulation) {
            simulation.status = 'Paused';
          }
          this.showSuccess('Simulation paused');
        },
        error: (error) => {
          console.error('Error pausing simulation:', error);
          this.showError('Failed to pause simulation');
        }
      })
    );
  }

  resumeSimulation(simulationId: string): void {
    this.subscriptions.add(
      this.simulationService.resumeSimulation(simulationId).subscribe({
        next: () => {
          const simulation = this.activeSimulations.find(s => s.id === simulationId);
          if (simulation) {
            simulation.status = 'Running';
          }
          this.showSuccess('Simulation resumed');
        },
        error: (error) => {
          console.error('Error resuming simulation:', error);
          this.showError('Failed to resume simulation');
        }
      })
    );
  }

  private updateSimulationProgress(update: any): void {
    const simulation = this.activeSimulations.find(s => s.id === update.simulationId);
    if (simulation) {
      simulation.progress = update.progress;
      simulation.status = update.status;
    }
  }

  private handleSimulationCompleted(simulationId: string): void {
    const simulation = this.activeSimulations.find(s => s.id === simulationId);
    if (simulation) {
      simulation.status = 'Completed';
      simulation.progress = 100;
      this.showSuccess(`Simulation for ${this.getEquipmentName(simulation.equipmentId)} completed`);
    }
  }

  getEquipmentName(equipmentId: number): string {
    const equipment = this.equipmentList.find(eq => eq.id === equipmentId);
    return equipment?.name || `Equipment ${equipmentId}`;
  }

  getScenarioName(scenarioType: string): string {
    const scenario = this.simulationScenarios.find(s => s.type === scenarioType);
    return scenario?.name || scenarioType;
  }

  getSimulationStatusIcon(status: string): string {
    switch (status) {
      case 'Running': return 'play_circle_filled';
      case 'Paused': return 'pause_circle_filled';
      case 'Completed': return 'check_circle';
      case 'Failed': return 'error';
      default: return 'help';
    }
  }

  getSimulationStatusColor(status: string): string {
    switch (status) {
      case 'Running': return 'accent';
      case 'Paused': return 'warn';
      case 'Completed': return 'primary';
      case 'Failed': return 'warn';
      default: return 'basic';
    }
  }

  private markFormGroupTouched(): void {
    Object.keys(this.simulationForm.controls).forEach(key => {
      const control = this.simulationForm.get(key);
      control?.markAsTouched();
    });
  }

  private showSuccess(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      panelClass: ['success-snackbar']
    });
  }

  private showError(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 5000,
      panelClass: ['error-snackbar']
    });
  }
}

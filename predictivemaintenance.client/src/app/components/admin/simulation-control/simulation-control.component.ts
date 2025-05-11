import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { forkJoin, Subscription } from 'rxjs';

// Material imports
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';

import { Equipment } from '../../../models/equipment.model';
import { EquipmentService } from '../../../services/equipment.service';
import { SimulationService } from '../../../services/simulation.service';
import { SignalRService } from '../../../services/signalr.service';
import { LoadingService } from '../../../services/loading.service';
import { LoadingSpinnerComponent } from '../../shared/loading-spinner/loading-spinner.component';

interface ActiveSimulation {
  id: string;
  equipmentId: number;
  scenarioType: string;
  startTime: Date;
  duration: number;
}

@Component({
  selector: 'app-simulation-control',
  templateUrl: './simulation-control.component.html',
  styleUrls: ['./simulation-control.component.scss']
})
export class SimulationControlComponent implements OnInit, OnDestroy {
  simulationForm!: FormGroup;
  equipmentList: Equipment[] = [];
  activeSimulations: ActiveSimulation[] = [];
  isLoading = false;

  presets: { name: string, description: string, config: any }[] = [
    {
      name: 'Normal Operation',
      description: 'All equipment operating normally',
      config: { scenarioType: 'Normal', duration: 60 }
    },
    {
      name: 'Gradual Deterioration',
      description: 'Simulate gradual wear on all equipment',
      config: { scenarioType: 'Deterioration', duration: 180 }
    },
    {
      name: 'Sudden Failure',
      description: 'Simulate sudden equipment failure',
      config: { scenarioType: 'Failure', duration: 90 }
    },
    {
      name: 'Maintenance Effect',
      description: 'Show improvement after maintenance',
      config: { scenarioType: 'Maintenance', duration: 120 }
    },
  ];

  private subscriptions: Subscription[] = [];

  constructor(
    private fb: FormBuilder,
    private equipmentService: EquipmentService,
    private simulationService: SimulationService,
    private signalRService: SignalRService,
    private loadingService: LoadingService,
    private snackBar: MatSnackBar
  ) { }

  ngOnInit(): void {
    this.createForm();
    this.loadEquipment();
    this.subscribeToLoading();
    this.subscribeToSimulationEvents();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private subscribeToLoading(): void {
    this.subscriptions.push(
      this.loadingService.loading$.subscribe(loading => {
        this.isLoading = loading;
      })
    );
  }

  private subscribeToSimulationEvents(): void {
    this.subscriptions.push(
      this.signalRService.getSimulationEvents().subscribe(event => {
        if (event && event.type === 'SimulationComplete') {
          // Remove the simulation from active list when it completes
          this.activeSimulations = this.activeSimulations.filter(
            sim => sim.equipmentId !== event.equipmentId || sim.scenarioType !== event.scenarioType
          );

          this.snackBar.open(`Simulation completed for ${this.getEquipmentName(event.equipmentId)}`, 'Close', {
            duration: 3000
          });
        }
      })
    );
  }

  createForm(): void {
    this.simulationForm = this.fb.group({
      equipmentId: [null, Validators.required],
      scenarioType: ['Normal', Validators.required],
      duration: [60, [Validators.min(10), Validators.max(300)]]
    });
  }

  loadEquipment(): void {
    this.equipmentService.getAllEquipment().subscribe({
      next: equipment => {
        this.equipmentList = equipment;
      },
      error: error => {
        console.error('Error loading equipment:', error);
        this.snackBar.open('Error loading equipment', 'Close', {
          duration: 5000,
          panelClass: ['error-snackbar']
        });
      }
    });
  }

  startSimulation(): void {
    if (this.simulationForm.invalid) return;

    const request = this.simulationForm.value;

    this.simulationService.startSimulation(request).subscribe({
      next: (response: any) => {
        this.snackBar.open(`Simulation started successfully`, 'Close', {
          duration: 3000,
          panelClass: ['success-snackbar']
        });

        this.activeSimulations.push({
          id: this.generateSimId(),
          equipmentId: request.equipmentId,
          scenarioType: request.scenarioType,
          startTime: new Date(),
          duration: request.duration
        });
      },
      error: (error: any) => {
        this.snackBar.open(`Error starting simulation: ${error.message}`, 'Close', {
          duration: 5000,
          panelClass: ['error-snackbar']
        });
      }
    });
  }

  runPreset(preset: any): void {
    const requests = this.equipmentList.map(equipment => {
      const request = {
        equipmentId: equipment.id,
        scenarioType: preset.config.scenarioType,
        duration: preset.config.duration
      };
      return this.simulationService.startSimulation(request);
    });

    forkJoin(requests).subscribe({
      next: () => {
        this.snackBar.open(`Preset "${preset.name}" started on all equipment`, 'Close', {
          duration: 3000,
          panelClass: ['success-snackbar']
        });

        // Add simulations to active list
        this.equipmentList.forEach(equipment => {
          this.activeSimulations.push({
            id: this.generateSimId(),
            equipmentId: equipment.id,
            scenarioType: preset.config.scenarioType,
            startTime: new Date(),
            duration: preset.config.duration
          });
        });
      },
      error: (error) => {
        this.snackBar.open(`Error starting simulation: ${error.message}`, 'Close', {
          duration: 5000,
          panelClass: ['error-snackbar']
        });
      }
    });
  }

  getEquipmentName(equipmentId: number): string {
    const equipment = this.equipmentList.find(e => e.id === equipmentId);
    return equipment ? equipment.name : `Equipment ${equipmentId}`;
  }

  getScenarioIcon(scenarioType: string): string {
    switch (scenarioType) {
      case 'Normal': return 'check_circle';
      case 'Deterioration': return 'trending_down';
      case 'Failure': return 'error';
      case 'Maintenance': return 'build';
      default: return 'help';
    }
  }

  getScenarioIconClass(scenarioType: string): string {
    return `scenario-icon-${scenarioType.toLowerCase()}`;
  }

  private generateSimId(): string {
    return Math.random().toString(36).substring(2, 9);
  }

  stopSimulation(simulation: ActiveSimulation): void {
    this.simulationService.stopSimulation(simulation.equipmentId).subscribe({
      next: () => {
        this.snackBar.open(`Simulation stopped`, 'Close', { duration: 3000 });
        this.activeSimulations = this.activeSimulations.filter(s => s.id !== simulation.id);
      },
      error: (error: any) => {
        this.snackBar.open(`Error stopping simulation: ${error.message}`, 'Close', {
          duration: 5000,
          panelClass: ['error-snackbar']
        });
      }
    });
  }

  resetAll(): void {
    this.simulationService.resetAllSimulations().subscribe({
      next: () => {
        this.snackBar.open(`All simulations reset to normal operation`, 'Close', {
          duration: 3000,
          panelClass: ['success-snackbar']
        });
        this.activeSimulations = [];
      },
      error: (error: any) => {
        this.snackBar.open(`Error resetting simulations: ${error.message}`, 'Close', {
          duration: 5000,
          panelClass: ['error-snackbar']
        });
      }
    });
  }
}

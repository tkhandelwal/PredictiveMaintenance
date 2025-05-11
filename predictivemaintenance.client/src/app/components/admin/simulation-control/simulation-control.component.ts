// src/app/components/admin/simulation-control/simulation-control.component.ts
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Equipment } from '../../../models/equipment.model';
import { EquipmentService } from '../../../services/equipment.service';
import { SimulationService } from '../../../services/simulation.service';

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
export class SimulationControlComponent implements OnInit {
  simulationForm!: FormGroup; // Using non-null assertion operator
  equipmentList: Equipment[] = [];
  activeSimulations: ActiveSimulation[] = [];
  isLoading = false;

  constructor(
    private fb: FormBuilder,
    private equipmentService: EquipmentService,
    private simulationService: SimulationService,
    private snackBar: MatSnackBar
  ) { }

  ngOnInit(): void {
    this.createForm();
    this.loadEquipment();
  }

  createForm(): void {
    this.simulationForm = this.fb.group({
      equipmentId: [null, Validators.required],
      scenarioType: ['Normal', Validators.required],
      duration: [60, [Validators.min(10), Validators.max(300)]]
    });
  }

  loadEquipment(): void {
    this.equipmentService.getAllEquipment().subscribe(equipment => {
      this.equipmentList = equipment;
    });
  }

  startSimulation(): void {
    if (this.simulationForm.invalid) return;

    const request = this.simulationForm.value;
    this.isLoading = true;

    this.simulationService.startSimulation(request).subscribe({
      next: (response: any) => {
        this.isLoading = false;
        this.snackBar.open(`Simulation started successfully`, 'Close', { duration: 3000 });

        this.activeSimulations.push({
          id: this.generateSimId(),
          equipmentId: request.equipmentId,
          scenarioType: request.scenarioType,
          startTime: new Date(),
          duration: request.duration
        });
      },
      error: (error: any) => {
        this.isLoading = false;
        this.snackBar.open(`Error starting simulation: ${error.message}`, 'Close', {
          duration: 5000,
          panelClass: ['error-snackbar']
        });
      }
    });
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
        this.snackBar.open(`All simulations reset to normal operation`, 'Close', { duration: 3000 });
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
}

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription } from 'rxjs';

//import { StatusIndicatorComponent } from '../../shared/status-indicator/status-indicator.component';
import { LoadingSpinnerComponent } from '../../shared/loading-spinner/loading-spinner.component';
import { Equipment, MaintenanceStatus } from '../../../models/equipment.model';
import { EquipmentService } from '../../../services/equipment.service';
import { LoadingService } from '../../../services/loading.service';

@Component({
  selector: 'app-equipment-list',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    //StatusIndicatorComponent,
    LoadingSpinnerComponent
  ],
  templateUrl: './equipment-list.component.html',
  styleUrls: ['./equipment-list.component.scss']
})
export class EquipmentListComponent implements OnInit, OnDestroy {
  MaintenanceStatus = MaintenanceStatus;

  displayedColumns: string[] = ['name', 'type', 'installationDate', 'lastMaintenanceDate', 'status', 'actions'];
  dataSource = new MatTableDataSource<Equipment>([]);
  isLoading = false;
  private subscriptions: Subscription[] = [];

  constructor(
    private equipmentService: EquipmentService,
    private loadingService: LoadingService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.subscribeToLoading();
    this.loadEquipment();
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

  loadEquipment(): void {
    this.subscriptions.push(
      this.equipmentService.getAllEquipment().subscribe(equipment => {
        this.dataSource.data = equipment;
      })
    );
  }

  viewEquipment(id: number): void {
    this.router.navigate(['/equipment', id]);
  }

  getStatusIcon(status: MaintenanceStatus): string {
    switch (status) {
      case MaintenanceStatus.Operational:
        return 'check_circle';
      case MaintenanceStatus.Warning:
        return 'warning';
      case MaintenanceStatus.Critical:
        return 'error';
      case MaintenanceStatus.UnderMaintenance:
        return 'build';
      default:
        return 'help';
    }
  }

  getStatusIconClass(status: MaintenanceStatus): string {
    switch (status) {
      case MaintenanceStatus.Operational:
        return 'status-icon operational';
      case MaintenanceStatus.Warning:
        return 'status-icon warning';
      case MaintenanceStatus.Critical:
        return 'status-icon critical';
      case MaintenanceStatus.UnderMaintenance:
        return 'status-icon under-maintenance';
      default:
        return 'status-icon';
    }
  }

  getStatusClass(status: MaintenanceStatus): string {
    switch (status) {
      case MaintenanceStatus.Operational:
        return 'operational';
      case MaintenanceStatus.Warning:
        return 'warning';
      case MaintenanceStatus.Critical:
        return 'critical';
      case MaintenanceStatus.UnderMaintenance:
        return 'under-maintenance';
      default:
        return '';
    }
  }
}

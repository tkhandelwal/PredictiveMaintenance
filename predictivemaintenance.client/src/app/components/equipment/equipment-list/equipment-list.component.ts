import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription } from 'rxjs';

import { StatusIndicatorComponent } from '../../shared/status-indicator/status-indicator.component';
import { LoadingSpinnerComponent } from '../../shared/loading-spinner/loading-spinner.component';
import { Equipment } from '../../../models/equipment.model';
import { EquipmentService } from '../../../services/equipment.service';
import { LoadingService } from '../../../services/loading.service';

@Component({
  selector: 'app-equipment-list',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,  // Make sure this is here
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    StatusIndicatorComponent,
    LoadingSpinnerComponent
  ],
  templateUrl: './equipment-list.component.html',
  styleUrls: ['./equipment-list.component.scss']
})
export class EquipmentListComponent implements OnInit, OnDestroy {
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

  getStatusClass(status: string): string {
    return status.toLowerCase().replace(/\s/g, '-');
  }
}

import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { EquipmentListComponent } from './components/equipment/equipment-list/equipment-list.component';
import { EquipmentDetailComponent } from './components/equipment/equipment-detail/equipment-detail.component';
import { MaintenanceScheduleComponent } from './components/maintenance/maintenance-schedule/maintenance-schedule.component';

export const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'equipment', component: EquipmentListComponent },
  { path: 'equipment/:id', component: EquipmentDetailComponent },
  { path: 'maintenance', component: MaintenanceScheduleComponent },
  { path: '**', redirectTo: '/dashboard' }
];

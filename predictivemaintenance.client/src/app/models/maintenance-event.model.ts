export interface MaintenanceEvent {
  id?: number;
  equipmentId: number;
  scheduledDate: Date;
  completionDate?: Date;
  description: string;
  type: MaintenanceType;
  priority: MaintenancePriority;
  assignedTechnician?: string;
}

export enum MaintenanceType {
  Preventive = 'Preventive',
  Predictive = 'Predictive',
  Corrective = 'Corrective',
  Emergency = 'Emergency'
}

export enum MaintenancePriority {
  Low = 'Low',
  Medium = 'Medium',
  High = 'High',
  Critical = 'Critical'
}

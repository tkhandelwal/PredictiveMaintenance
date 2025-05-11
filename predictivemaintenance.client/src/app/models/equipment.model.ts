export interface Equipment {
  id: number;
  name: string;
  type: string;
  installationDate: Date;
  lastMaintenanceDate?: Date;
  status: MaintenanceStatus;
}

export enum MaintenanceStatus {
  Operational = 'Operational',
  Warning = 'Warning',
  Critical = 'Critical',
  UnderMaintenance = 'UnderMaintenance'
}

export interface Equipment {
  id: number;
  name: string;
  type: string;
  installationDate: Date;
  lastMaintenanceDate?: Date;
  status: MaintenanceStatus;
}

export enum MaintenanceStatus {
  Operational = 0,
  Warning = 1,
  Critical = 2,
  UnderMaintenance = 3
}

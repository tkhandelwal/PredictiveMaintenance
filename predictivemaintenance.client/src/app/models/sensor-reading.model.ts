export interface SensorReading {
  id?: number;
  equipmentId: number;
  timestamp: Date;
  sensorType: string;
  value: number;
  isAnomaly?: boolean;
}

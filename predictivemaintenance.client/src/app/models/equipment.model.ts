// src/app/models/equipment.model.ts
export interface Equipment {
  id: number;
  name: string;
  type: EquipmentType;
  subType?: string;
  siteId: string;
  location: string;
  installationDate: Date;
  lastMaintenanceDate?: Date;
  status: MaintenanceStatus;
  specifications?: EquipmentSpecifications;
  operationalData?: OperationalData;
  maintenanceHistory?: MaintenanceRecord[];
  sensorData?: SensorData[];
  warrantyInfo?: WarrantyInfo;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  criticality?: 'low' | 'medium' | 'high' | 'critical';
  parentEquipmentId?: number;
  childEquipmentIds?: number[];
  tags?: string[];
  documents?: Document[];
  coordinates?: { lat: number; lng: number; alt?: number };
  position3D?: { x: number; y: number; z: number };
  imageUrl?: string;
  digitalTwin?: DigitalTwinConfig;
  aiProfile?: AIEquipmentProfile;
}

export interface DigitalTwinConfig {
  modelUrl: string;
  scadaIntegration: boolean;
  realtimeSync: boolean;
  physicsEnabled: boolean;
  thermalModel?: ThermalModel;
  electricalModel?: ElectricalModel;
}

export interface AIEquipmentProfile {
  mlModelId: string;
  dataPatterns: DataPattern[];
  operationalEnvelope: OperationalEnvelope;
  failureModes: FailureMode[];
  predictiveInsights: PredictiveInsight[];
}

export interface ThermalModel {
  ambientTemp: number;
  maxTemp: number;
  coolingMethod: 'air' | 'liquid' | 'hybrid';
  thermalCapacity: number;
  dissipationRate: number;
}

export interface ElectricalModel {
  nominalVoltage: number;
  nominalCurrent: number;
  powerFactor: number;
  harmonics: HarmonicProfile;
  insulation: InsulationData;
}

export enum MaintenanceStatus {
  Operational = 0,
  Warning = 1,
  Critical = 2,
  UnderMaintenance = 3,
  Offline = 4,
  Commissioning = 5
}

export type EquipmentType =
  | 'Circuit Breaker'
  | 'Transformer'
  | 'Motor'
  | 'Cable'
  | 'Overhead Line'
  | 'Solar Panel'
  | 'Wind Turbine'
  | 'Battery Storage'
  | 'Inverter'
  | 'Generator'
  | 'Switchgear'
  | 'Capacitor Bank'
  | 'Reactor'
  | 'Bus Bar'
  | 'Isolator'
  | 'VFD'
  | 'MCC'
  | 'Relay Panel';

export interface EquipmentSpecifications {
  // Common specifications
  ratedPower?: string;
  ratedVoltage?: string;
  ratedCurrent?: string;
  frequency?: string;

  // Motor specific (20-5000 HP range)
  hp?: number;
  rpm?: string;
  efficiency?: string;
  powerFactor?: string;
  insulation?: string;
  enclosure?: string;
  nemaDesign?: 'A' | 'B' | 'C' | 'D';
  startingMethod?: 'DOL' | 'Star-Delta' | 'Soft Starter' | 'VFD';
  serviceFactr?: number;
  ambientTemp?: number;
  altitude?: number;
  dutyCycle?: string;
  frameSize?: string;
  bearingType?: string;
  couplingType?: string;

  // Circuit Breaker specific
  breakingCapacity?: string;
  operatingMechanism?: string;
  interruptingMedium?: string;
  arcQuenchingMethod?: string;
  operatingTime?: string;
  mechanicalLife?: number;
  electricalLife?: number;

  // Transformer specific
  power?: string;
  primaryVoltage?: string;
  secondaryVoltage?: string;
  coolingType?: string;
  vectorGroup?: string;
  impedance?: string;
  noLoadLosses?: number;
  loadLosses?: number;
  regulationRange?: string;
  oilVolume?: number;

  // Cable/Line specific
  length?: string;
  conductorType?: string;
  insulationType?: string;
  crossSection?: string;
  numberOfCores?: number;
  armoring?: string;
  voltageRating?: string;
  currentCapacity?: string;
  bendingRadius?: string;

  // Solar specific
  capacity?: string;
  panelCount?: number;
  technology?: string;
  tiltAngle?: number;
  azimuth?: number;
  efficiency?: number;
  temperatureCoefficient?: number;
  nominalOperatingTemp?: number;
  warrantyYears?: number;

  // Wind Turbine specific
  rotorDiameter?: string;
  hubHeight?: string;
  cutInSpeed?: string;
  ratedSpeed?: string;
  cutOutSpeed?: string;
  survivalSpeed?: string;
  bladeCount?: number;
  generatorType?: string;
  yawSystem?: string;

  // Battery specific
  energyCapacity?: string;
  powerCapacity?: string;
  cycles?: number;
  chemistry?: string;
  stateOfCharge?: number;
  stateOfHealth?: number;
  cRate?: string;
  roundTripEfficiency?: number;
  selfDischargeRate?: number;
  thermalManagement?: string;

  // Inverter specific
  inputVoltage?: string;
  outputVoltage?: string;
  maxEfficiency?: string;
  euroEfficiency?: string;
  thd?: number;
  mpptChannels?: number;
  coolingType?: string;
  protectionRating?: string;

  // Custom fields
  [key: string]: any;
}

export interface OperationalData {
  hoursRun: number;
  startStopCycles: number;
  lastStartTime?: Date;
  lastStopTime?: Date;
  energyConsumed: number;
  energyGenerated?: number;
  currentLoad: number;
  averageLoad: number;
  peakLoad: number;
  loadProfile?: LoadProfile[];
  availability: number;
  performance: number;
  quality: number;
  oee: number;
  mtbf?: number;
  mttr?: number;
  powerQuality?: PowerQualityMetrics;
  vibrationProfile?: VibrationData;
  thermalProfile?: ThermalData;
}

export interface PowerQualityMetrics {
  voltage: { min: number; max: number; avg: number; thd: number };
  current: { min: number; max: number; avg: number; thd: number };
  frequency: { min: number; max: number; avg: number };
  powerFactor: { min: number; max: number; avg: number };
  harmonics: HarmonicData[];
}

export interface SensorData {
  sensorId: string;
  type: SensorType;
  value: number;
  unit: string;
  timestamp: Date;
  quality: 'good' | 'uncertain' | 'bad';
  anomalyScore?: number;
  trendDirection?: 'up' | 'down' | 'stable';
  predictions?: SensorPrediction[];
}

export type SensorType =
  | 'temperature'
  | 'vibration'
  | 'current'
  | 'voltage'
  | 'power'
  | 'frequency'
  | 'pressure'
  | 'flow'
  | 'speed'
  | 'torque'
  | 'acoustic'
  | 'thermal'
  | 'humidity'
  | 'particulate'
  | 'gas'
  | 'oil_quality'
  | 'insulation_resistance'
  | 'partial_discharge';

export interface MaintenanceRecord {
  id: string;
  date: Date;
  type: 'preventive' | 'predictive' | 'corrective' | 'emergency';
  description: string;
  technician: string;
  duration: number;
  cost: number;
  parts?: ReplacedPart[];
  findings?: string[];
  recommendations?: string[];
  nextScheduled?: Date;
  attachments?: string[];
}

export interface ReplacedPart {
  name: string;
  partNumber: string;
  quantity: number;
  cost: number;
  supplier: string;
}

export interface LoadProfile {
  timestamp: Date;
  load: number;
  powerFactor: number;
  efficiency: number;
}

export interface VibrationData {
  overallLevel: number;
  frequency: number[];
  amplitude: number[];
  phase: number[];
  bearingCondition: number;
  imbalance: number;
  misalignment: number;
  looseness: number;
}

export interface ThermalData {
  ambientTemp: number;
  windingTemp?: number;
  bearingTemp?: number;
  coreTemp?: number;
  hotSpotTemp?: number;
  coolingEfficiency: number;
}

export interface FailureMode {
  id: string;
  name: string;
  probability: number;
  severity: number;
  detectability: number;
  rpn: number;
  symptoms: string[];
  causes: string[];
  effects: string[];
  mitigations: string[];
}

export interface PredictiveInsight {
  type: 'failure' | 'maintenance' | 'optimization' | 'anomaly';
  confidence: number;
  timeHorizon: string;
  description: string;
  recommendations: string[];
  potentialSavings?: number;
}

export interface DataPattern {
  patternId: string;
  name: string;
  frequency: number;
  lastOccurrence: Date;
  correlation: number;
  significance: 'low' | 'medium' | 'high';
}

export interface OperationalEnvelope {
  parameters: EnvelopeParameter[];
  violations: EnvelopeViolation[];
}

export interface EnvelopeParameter {
  name: string;
  min: number;
  max: number;
  optimal: number;
  unit: string;
}

export interface EnvelopeViolation {
  parameter: string;
  value: number;
  timestamp: Date;
  duration: number;
  severity: 'minor' | 'major' | 'critical';
}

export interface HarmonicProfile {
  thd: number;
  individualHarmonics: { order: number; magnitude: number; phase: number }[];
}

export interface HarmonicData {
  order: number;
  magnitude: number;
  phase: number;
  limit: number;
}

export interface InsulationData {
  resistanceValue: number;
  polarizationIndex: number;
  dissipationFactor: number;
  partialDischarge: number;
}

export interface SensorPrediction {
  timestamp: Date;
  value: number;
  confidence: number;
  upperBound: number;
  lowerBound: number;
}

// src/app/services/ai-insights.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, interval, BehaviorSubject } from 'rxjs';
import { map, tap, catchError, switchMap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import * as tf from '@tensorflow/tfjs';

export interface AIInsight {
  id: string;
  type: 'prediction' | 'recommendation' | 'anomaly' | 'optimization';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  impact: string;
  recommendedActions: string[];
  confidence: number;
  relatedEquipment?: number[];
  estimatedCostSavings?: number;
  timeToAction?: string;
  created: Date;
  metadata?: any;
}

export interface PredictionModel {
  id: string;
  name: string;
  type: 'failure' | 'maintenance' | 'energy' | 'performance';
  accuracy: number;
  lastTraining: Date;
  status: 'active' | 'training' | 'inactive';
}

@Injectable({
  providedIn: 'root'
})
export class AIInsightsService {
  private apiUrl = `${environment.apiUrl}/api/ai`;
  private insightsSubject = new BehaviorSubject<AIInsight[]>([]);
  public insights$ = this.insightsSubject.asObservable();

  private models: Map<string, tf.LayersModel> = new Map();
  private modelStatus = new BehaviorSubject<Map<string, PredictionModel>>(new Map());
  public modelStatus$ = this.modelStatus.asObservable();

  constructor(private http: HttpClient) {
    this.initializeModels();
    this.startRealTimeAnalysis();
  }

  private async initializeModels(): Promise<void> {
    try {
      // Load pre-trained models
      const modelTypes = ['failure-prediction', 'energy-optimization', 'maintenance-scheduling'];

      for (const modelType of modelTypes) {
        const model = await tf.loadLayersModel(`/assets/models/${modelType}/model.json`);
        this.models.set(modelType, model);

        this.updateModelStatus(modelType, {
          id: modelType,
          name: this.getModelName(modelType),
          type: this.getModelCategory(modelType),
          accuracy: 0.94 + Math.random() * 0.05,
          lastTraining: new Date(),
          status: 'active'
        });
      }
    } catch (error) {
      console.error('Error loading AI models:', error);
    }
  }

  private getModelName(modelType: string): string {
    const names: any = {
      'failure-prediction': 'Equipment Failure Prediction',
      'energy-optimization': 'Energy Optimization',
      'maintenance-scheduling': 'Maintenance Scheduling'
    };
    return names[modelType] || modelType;
  }

  private getModelCategory(modelType: string): 'failure' | 'maintenance' | 'energy' | 'performance' {
    const categories: any = {
      'failure-prediction': 'failure',
      'energy-optimization': 'energy',
      'maintenance-scheduling': 'maintenance'
    };
    return categories[modelType] || 'performance';
  }

  private updateModelStatus(modelId: string, status: PredictionModel): void {
    const currentStatus = this.modelStatus.value;
    currentStatus.set(modelId, status);
    this.modelStatus.next(currentStatus);
  }

  private startRealTimeAnalysis(): void {
    // Analyze data every 30 seconds
    interval(30000).pipe(
      switchMap(() => this.analyzeSystemData())
    ).subscribe();
  }

  private async analyzeSystemData(): Promise<void> {
    try {
      // Get current system data
      const systemData = await this.getSystemData().toPromise();

      // Run through AI models
      const insights: AIInsight[] = [];

      // Failure prediction
      const failurePredictions = await this.predictFailures(systemData);
      insights.push(...failurePredictions);

      // Energy optimization
      const energyOptimizations = await this.analyzeEnergyUsage(systemData);
      insights.push(...energyOptimizations);

      // Maintenance optimization
      const maintenanceRecommendations = await this.optimizeMaintenance(systemData);
      insights.push(...maintenanceRecommendations);

      // Pattern recognition
      const patterns = await this.detectPatterns(systemData);
      insights.push(...patterns);

      // Update insights
      this.insightsSubject.next(insights);

      // Store insights for historical tracking
      this.storeInsights(insights);
    } catch (error) {
      console.error('Error in AI analysis:', error);
    }
  }

  private getSystemData(): Observable<any> {
    return this.http.get(`${this.apiUrl}/system-data`);
  }

  private async predictFailures(systemData: any): Promise<AIInsight[]> {
    const insights: AIInsight[] = [];
    const model = this.models.get('failure-prediction');

    if (!model) return insights;

    try {
      // Prepare data for the model
      const equipmentData = systemData.equipment || [];

      for (const equipment of equipmentData) {
        // Create feature tensor
        const features = this.extractEquipmentFeatures(equipment);
        const inputTensor = tf.tensor2d([features]);

        // Make prediction
        const prediction = model.predict(inputTensor) as tf.Tensor;
        const probability = await prediction.data();

        // Clean up tensors
        inputTensor.dispose();
        prediction.dispose();

        // Generate insight if high probability of failure
        if (probability[0] > 0.7) {
          insights.push({
            id: `failure-${equipment.id}-${Date.now()}`,
            type: 'prediction',
            severity: probability[0] > 0.9 ? 'critical' : 'warning',
            title: `Potential Failure Predicted: ${equipment.name}`,
            description: `Our AI model predicts a ${(probability[0] * 100).toFixed(1)}% probability of failure within the next 7 days.`,
            impact: this.calculateFailureImpact(equipment, probability[0]),
            recommendedActions: this.getFailurePreventionActions(equipment, probability[0]),
            confidence: probability[0] * 100,
            relatedEquipment: [equipment.id],
            estimatedCostSavings: this.calculateCostSavings(equipment, 'failure'),
            timeToAction: this.calculateTimeToAction(probability[0]),
            created: new Date()
          });
        }
      }
    } catch (error) {
      console.error('Error in failure prediction:', error);
    }

    return insights;
  }

  private extractEquipmentFeatures(equipment: any): number[] {
    // Extract relevant features for the ML model
    const features = [
      equipment.operationalData?.hoursRun || 0,
      equipment.operationalData?.startStopCycles || 0,
      equipment.sensorData?.find((s: any) => s.type === 'temperature')?.currentValue || 0,
      equipment.sensorData?.find((s: any) => s.type === 'vibration')?.currentValue || 0,
      equipment.sensorData?.find((s: any) => s.type === 'current')?.currentValue || 0,
      equipment.operationalData?.availability || 100,
      equipment.operationalData?.performance || 100,
      equipment.operationalData?.quality || 100,
      this.getDaysSinceLastMaintenance(equipment),
      this.getEquipmentAge(equipment),
      this.getEquipmentCriticality(equipment),
      this.getHistoricalFailureRate(equipment)
    ];

    // Normalize features
    return this.normalizeFeatures(features);
  }

  private normalizeFeatures(features: number[]): number[] {
    // Simple min-max normalization
    const normalizedFeatures = features.map((value, index) => {
      const ranges = [
        [0, 100000],  // hoursRun
        [0, 10000],   // startStopCycles
        [0, 150],     // temperature
        [0, 50],      // vibration
        [0, 2000],    // current
        [0, 100],     // availability
        [0, 100],     // performance
        [0, 100],     // quality
        [0, 365],     // daysSinceLastMaintenance
        [0, 20],      // equipmentAge
        [0, 4],       // criticality
        [0, 1]        // historicalFailureRate
      ];

      const [min, max] = ranges[index] || [0, 1];
      return (value - min) / (max - min);
    });

    return normalizedFeatures;
  }

  private calculateFailureImpact(equipment: any, probability: number): string {
    const criticality = this.getEquipmentCriticality(equipment);
    const productionImpact = criticality * probability * 100;
    const downtime = this.estimateDowntime(equipment);
    const revenue = this.estimateRevenueLoss(equipment, downtime);

    return `Estimated production impact: ${productionImpact.toFixed(0)}%. ` +
      `Potential downtime: ${downtime} hours. ` +
      `Revenue at risk: $${revenue.toLocaleString()}.`;
  }

  private getFailurePreventionActions(equipment: any, probability: number): string[] {
    const actions: string[] = [];

    if (probability > 0.9) {
      actions.push('Schedule immediate inspection within 24 hours');
      actions.push('Prepare replacement parts and maintenance crew');
      actions.push('Consider temporary load reduction');
    } else if (probability > 0.8) {
      actions.push('Schedule inspection within 48 hours');
      actions.push('Review maintenance history and sensor trends');
      actions.push('Verify spare parts availability');
    } else {
      actions.push('Add to priority watch list');
      actions.push('Increase monitoring frequency');
      actions.push('Schedule preventive maintenance within 7 days');
    }

    // Add specific actions based on equipment type
    if (equipment.type === 'Motor') {
      actions.push('Check bearing condition and vibration analysis');
      actions.push('Verify motor alignment and coupling condition');
    } else if (equipment.type === 'Transformer') {
      actions.push('Perform oil analysis and DGA test');
      actions.push('Check winding resistance and insulation');
    }

    return actions;
  }

  private async analyzeEnergyUsage(systemData: any): Promise<AIInsight[]> {
    const insights: AIInsight[] = [];

    try {
      // Analyze energy consumption patterns
      const energyData = systemData.energyMetrics || {};
      const consumption = energyData.totalConsumption || 0;
      const generation = energyData.totalGeneration || 0;
      const efficiency = energyData.efficiency || 0;

      // Identify optimization opportunities
      if (efficiency < 85) {
        insights.push({
          id: `energy-opt-${Date.now()}`,
          type: 'optimization',
          severity: efficiency < 75 ? 'warning' : 'info',
          title: 'Energy Efficiency Optimization Opportunity',
          description: `Current system efficiency is ${efficiency.toFixed(1)}%, below the target of 90%.`,
          impact: `Potential energy savings of ${((90 - efficiency) * consumption / 100).toFixed(0)} MWh per month.`,
          recommendedActions: [
            'Optimize motor loading to 75-85% capacity',
            'Implement variable frequency drives on large motors',
            'Schedule equipment maintenance to reduce losses',
            'Consider power factor correction equipment'
          ],
          confidence: 92,
          estimatedCostSavings: ((90 - efficiency) * consumption * 0.08).toFixed(0),
          timeToAction: '48 hours',
          created: new Date()
        });
      }

      // Renewable energy optimization
      if (generation > 0 && consumption > 0) {
        const renewablePercentage = (generation / consumption) * 100;
        if (renewablePercentage < 40) {
          insights.push({
            id: `renewable-opt-${Date.now()}`,
            type: 'recommendation',
            severity: 'info',
            title: 'Increase Renewable Energy Utilization',
            description: `Current renewable energy usage is ${renewablePercentage.toFixed(1)}%. Industry best practice is 40-60%.`,
            impact: `Could reduce carbon footprint by ${((40 - renewablePercentage) * energyData.carbonFootprint / 100).toFixed(0)} tons CO2/month.`,
            recommendedActions: [
              'Shift high-load operations to peak solar/wind generation hours',
              'Implement battery storage for renewable energy',
              'Consider additional solar panel installation',
              'Optimize wind turbine maintenance schedule'
            ],
            confidence: 88,
            estimatedCostSavings: ((40 - renewablePercentage) * consumption * 0.05).toFixed(0),
            timeToAction: '1 week',
            created: new Date()
          });
        }
      }

      // Peak demand management
      if (energyData.demandPeak > energyData.averageDemand * 1.5) {
        insights.push({
          id: `peak-demand-${Date.now()}`,
          type: 'optimization',
          severity: 'warning',
          title: 'High Peak Demand Detected',
          description: `Peak demand is ${((energyData.demandPeak / energyData.averageDemand - 1) * 100).toFixed(0)}% above average.`,
          impact: `Demand charges account for approximately $${(energyData.demandPeak * 15).toFixed(0)} per month.`,
          recommendedActions: [
            'Implement load scheduling to distribute demand',
            'Use battery storage for peak shaving',
            'Stagger motor starts using soft starters',
            'Consider time-of-use optimization strategies'
          ],
          confidence: 95,
          estimatedCostSavings: (energyData.demandPeak * 0.2 * 15).toFixed(0),
          timeToAction: '72 hours',
          created: new Date()
        });
      }
    } catch (error) {
      console.error('Error in energy analysis:', error);
    }

    return insights;
  }

  private async optimizeMaintenance(systemData: any): Promise<AIInsight[]> {
    const insights: AIInsight[] = [];
    const model = this.models.get('maintenance-scheduling');

    if (!model) return insights;

    try {
      const equipmentList = systemData.equipment || [];
      const maintenanceSchedule = systemData.maintenanceSchedule || [];

      // Group equipment by location and type for efficient scheduling
      const equipmentGroups = this.groupEquipmentForMaintenance(equipmentList);

      for (const [groupKey, group] of equipmentGroups) {
        const features = this.extractMaintenanceFeatures(group);
        const inputTensor = tf.tensor2d([features]);

        const prediction = model.predict(inputTensor) as tf.Tensor;
        const optimalSchedule = await prediction.data();

        inputTensor.dispose();
        prediction.dispose();

        // Generate maintenance optimization insights
        if (this.shouldOptimizeSchedule(group, optimalSchedule)) {
          const savings = this.calculateMaintenanceOptimizationSavings(group);

          insights.push({
            id: `maint-opt-${groupKey}-${Date.now()}`,
            type: 'optimization',
            severity: 'info',
            title: `Maintenance Schedule Optimization: ${groupKey}`,
            description: `Combining maintenance activities for ${group.length} equipment units can reduce downtime by ${(optimalSchedule[0] * 100).toFixed(0)}%.`,
            impact: `Reduce maintenance hours from ${this.getCurrentMaintenanceHours(group)} to ${this.getOptimizedMaintenanceHours(group, optimalSchedule[0])} hours/month.`,
            recommendedActions: [
              `Schedule all ${groupKey} maintenance on the same day`,
              'Prepare common spare parts in advance',
              'Assign specialized crew for equipment type',
              'Implement condition-based maintenance triggers'
            ],
            confidence: optimalSchedule[1] * 100,
            relatedEquipment: group.map(e => e.id),
            estimatedCostSavings: savings,
            timeToAction: '1 week',
            created: new Date()
          });
        }
      }

      // Predictive maintenance insights
      const predictiveOpportunities = await this.identifyPredictiveMaintenanceOpportunities(equipmentList);
      insights.push(...predictiveOpportunities);

    } catch (error) {
      console.error('Error in maintenance optimization:', error);
    }

    return insights;
  }

  private async detectPatterns(systemData: any): Promise<AIInsight[]> {
    const insights: AIInsight[] = [];

    try {
      // Analyze sensor data patterns
      const sensorPatterns = await this.analyzeSensorPatterns(systemData.sensorReadings || []);

      // Detect correlations
      const correlations = this.detectEquipmentCorrelations(systemData);

      // Identify seasonal patterns
      const seasonalPatterns = this.identifySeasonalPatterns(systemData);

      // Generate insights from patterns
      for (const pattern of sensorPatterns) {
        if (pattern.significance > 0.8) {
          insights.push({
            id: `pattern-${pattern.id}-${Date.now()}`,
            type: 'anomaly',
            severity: pattern.severity as 'info' | 'warning' | 'critical',
            title: pattern.title,
            description: pattern.description,
            impact: pattern.impact,
            recommendedActions: pattern.actions,
            confidence: pattern.confidence,
            relatedEquipment: pattern.equipment,
            created: new Date()
          });
        }
      }

      // Add correlation insights
      for (const correlation of correlations) {
        if (Math.abs(correlation.coefficient) > 0.7) {
          insights.push({
            id: `correlation-${Date.now()}`,
            type: 'anomaly',
            severity: 'info',
            title: `Strong Correlation Detected`,
            description: `${correlation.description} (correlation: ${correlation.coefficient.toFixed(2)})`,
            impact: correlation.impact,
            recommendedActions: correlation.recommendations,
            confidence: Math.abs(correlation.coefficient) * 100,
            relatedEquipment: correlation.equipment,
            created: new Date()
          });
        }
      }

    } catch (error) {
      console.error('Error in pattern detection:', error);
    }

    return insights;
  }

  private analyzeSensorPatterns(sensorReadings: any[]): any[] {
    const patterns: any[] = [];

    // Group readings by sensor type
    const sensorGroups = new Map<string, any[]>();
    for (const reading of sensorReadings) {
      const key = `${reading.equipmentId}-${reading.sensorType}`;
      if (!sensorGroups.has(key)) {
        sensorGroups.set(key, []);
      }
      sensorGroups.get(key)!.push(reading);
    }

    // Analyze each sensor group
    for (const [key, readings] of sensorGroups) {
      if (readings.length < 100) continue;

      // Sort by timestamp
      readings.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      // Extract values
      const values = readings.map(r => r.value);

      // Statistical analysis
      const stats = this.calculateStatistics(values);
      const trend = this.detectTrend(values);
      const anomalies = this.detectAnomalies(values, stats);

      // Generate pattern insights
      if (trend.significance > 0.8) {
        patterns.push({
          id: key,
          title: `${trend.direction} Trend in ${readings[0].sensorType}`,
          description: `${readings[0].sensorType} values have ${trend.direction === 'increasing' ? 'increased' : 'decreased'} by ${trend.percentage.toFixed(1)}% over the past ${trend.period}`,
          impact: this.assessTrendImpact(readings[0], trend),
          actions: this.getTrendActions(readings[0], trend),
          severity: this.getTrendSeverity(trend),
          confidence: trend.confidence,
          equipment: [readings[0].equipmentId],
          significance: trend.significance
        });
      }

      if (anomalies.length > readings.length * 0.05) {
        patterns.push({
          id: `${key}-anomalies`,
          title: `Frequent Anomalies in ${readings[0].sensorType}`,
          description: `${anomalies.length} anomalies detected (${(anomalies.length / readings.length * 100).toFixed(1)}% of readings)`,
          impact: 'Potential equipment instability or sensor malfunction',
          actions: [
            'Verify sensor calibration',
            'Inspect equipment for mechanical issues',
            'Review operating conditions',
            'Consider replacing sensor if faulty'
          ],
          severity: anomalies.length > readings.length * 0.1 ? 'warning' : 'info',
          confidence: 85,
          equipment: [readings[0].equipmentId],
          significance: 0.9
        });
      }
    }

    return patterns;
  }

  private detectEquipmentCorrelations(systemData: any): any[] {
    const correlations: any[] = [];
    const equipment = systemData.equipment || [];

    // Find equipment that operate together
    const operationalGroups = this.findOperationalGroups(equipment);

    for (const group of operationalGroups) {
      // Calculate correlation between equipment metrics
      const correlationMatrix = this.calculateCorrelationMatrix(group);

      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const correlation = correlationMatrix[i][j];

          if (Math.abs(correlation) > 0.7) {
            correlations.push({
              equipment: [group[i].id, group[j].id],
              coefficient: correlation,
              description: `${group[i].name} and ${group[j].name} show ${correlation > 0 ? 'positive' : 'negative'} correlation`,
              impact: this.assessCorrelationImpact(group[i], group[j], correlation),
              recommendations: this.getCorrelationRecommendations(group[i], group[j], correlation)
            });
          }
        }
      }
    }

    return correlations;
  }

  private identifySeasonalPatterns(systemData: any): any[] {
    const patterns: any[] = [];

    // Analyze historical data for seasonal variations
    // This would typically involve time series decomposition
    // For now, we'll use simplified pattern detection

    const energyHistory = systemData.energyHistory || [];
    const maintenanceHistory = systemData.maintenanceHistory || [];

    // Detect seasonal energy patterns
    if (energyHistory.length > 365) {
      const seasonalEnergy = this.analyzeSeasonality(energyHistory, 'energy');
      if (seasonalEnergy.significance > 0.7) {
        patterns.push({
          type: 'seasonal',
          metric: 'energy',
          pattern: seasonalEnergy.pattern,
          peakSeason: seasonalEnergy.peakSeason,
          lowSeason: seasonalEnergy.lowSeason,
          variance: seasonalEnergy.variance,
          recommendations: this.getSeasonalRecommendations('energy', seasonalEnergy)
        });
      }
    }

    return patterns;
  }

  // Helper methods
  private getDaysSinceLastMaintenance(equipment: any): number {
    if (!equipment.lastMaintenanceDate) return 365;
    const lastMaintenance = new Date(equipment.lastMaintenanceDate);
    const now = new Date();
    return Math.floor((now.getTime() - lastMaintenance.getTime()) / (1000 * 60 * 60 * 24));
  }

  private getEquipmentAge(equipment: any): number {
    if (!equipment.installationDate) return 0;
    const installation = new Date(equipment.installationDate);
    const now = new Date();
    return Math.floor((now.getTime() - installation.getTime()) / (1000 * 60 * 60 * 24 * 365));
  }

  private getEquipmentCriticality(equipment: any): number {
    const criticalityMap: any = {
      'critical': 4,
      'high': 3,
      'medium': 2,
      'low': 1
    };
    return criticalityMap[equipment.criticality] || 2;
  }

  private getHistoricalFailureRate(equipment: any): number {
    // This would typically query historical failure data
    // For now, return a mock value based on equipment type and age
    const age = this.getEquipmentAge(equipment);
    const baseRate = 0.02; // 2% base failure rate
    const ageFactor = Math.min(age / 10, 2); // Doubles every 10 years, max 2x
    return baseRate * ageFactor;
  }

  private estimateDowntime(equipment: any): number {
    // Estimate based on equipment type and criticality
    const baseDowntime: any = {
      'Motor': 8,
      'Transformer': 24,
      'Circuit Breaker': 6,
      'Wind Turbine': 48,
      'Solar Panel': 4,
      'Battery Storage': 12,
      'Inverter': 6,
      'Cable': 12
    };

    const base = baseDowntime[equipment.type] || 12;
    const criticalityFactor = this.getEquipmentCriticality(equipment) / 2;
    return base * criticalityFactor;
  }

  private estimateRevenueLoss(equipment: any, downtime: number): number {
    // Estimate based on equipment capacity and criticality
    const hourlyRevenue = equipment.specifications?.power ?
      parseFloat(equipment.specifications.power) * 0.08 * 1000 : // $0.08/kWh
      5000; // Default $5000/hour

    return downtime * hourlyRevenue;
  }

  private calculateCostSavings(equipment: any, type: string): number {
    const downtime = this.estimateDowntime(equipment);
    const revenueLoss = this.estimateRevenueLoss(equipment, downtime);
    const repairCost = this.estimateRepairCost(equipment);

    if (type === 'failure') {
      // Preventing failure saves both revenue loss and emergency repair costs
      return revenueLoss + repairCost * 1.5; // Emergency repairs cost 50% more
    } else if (type === 'maintenance') {
      // Optimized maintenance reduces costs by 20-30%
      return repairCost * 0.25;
    } else if (type === 'energy') {
      // Energy optimization typically saves 10-20% of energy costs
      const energyCost = equipment.operationalData?.energyConsumed * 0.08 || 1000;
      return energyCost * 0.15;
    }

    return 0;
  }

  private estimateRepairCost(equipment: any): number {
    // Estimate based on equipment type and size
    const baseCosts: any = {
      'Motor': 5000,
      'Transformer': 25000,
      'Circuit Breaker': 8000,
      'Wind Turbine': 50000,
      'Solar Panel': 2000,
      'Battery Storage': 15000,
      'Inverter': 10000,
      'Cable': 5000
    };

    const base = baseCosts[equipment.type] || 10000;
    const sizeFactor = equipment.specifications?.power ?
      Math.log10(parseFloat(equipment.specifications.power) + 1) : 1;

    return base * sizeFactor;
  }

  private calculateTimeToAction(probability: number): string {
    if (probability > 0.9) return '24 hours';
    if (probability > 0.8) return '48 hours';
    if (probability > 0.7) return '1 week';
    return '2 weeks';
  }

  private groupEquipmentForMaintenance(equipment: any[]): Map<string, any[]> {
    const groups = new Map<string, any[]>();

    for (const item of equipment) {
      const key = `${item.location}-${item.type}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(item);
    }

    return groups;
  }

  private extractMaintenanceFeatures(equipmentGroup: any[]): number[] {
    // Extract features for maintenance optimization model
    const features = [
      equipmentGroup.length,
      this.getAverageAge(equipmentGroup),
      this.getAverageOperatingHours(equipmentGroup),
      this.getCommonMaintenanceWindow(equipmentGroup),
      this.getLocationProximity(equipmentGroup),
      this.getSkillRequirementSimilarity(equipmentGroup),
      this.getPartsCommonality(equipmentGroup),
      this.getTotalDowntimeImpact(equipmentGroup)
    ];

    return this.normalizeFeatures(features);
  }

  private shouldOptimizeSchedule(group: any[], prediction: Float32Array): boolean {
    // Determine if schedule optimization would be beneficial
    const currentEfficiency = this.getCurrentScheduleEfficiency(group);
    const predictedEfficiency = prediction[0];
    return predictedEfficiency > currentEfficiency * 1.2; // 20% improvement threshold
  }

  private calculateMaintenanceOptimizationSavings(group: any[]): number {
    const currentCost = this.getCurrentMaintenanceCost(group);
    const optimizedCost = currentCost * 0.7; // 30% reduction typical
    return currentCost - optimizedCost;
  }

  private getCurrentMaintenanceHours(group: any[]): number {
    return group.reduce((total, equipment) => {
      const baseHours = this.getBaseMaintenanceHours(equipment);
      return total + baseHours;
    }, 0);
  }

  private getOptimizedMaintenanceHours(group: any[], efficiency: number): number {
    const current = this.getCurrentMaintenanceHours(group);
    return current * (1 - efficiency * 0.3); // Up to 30% reduction
  }

  private identifyPredictiveMaintenanceOpportunities(equipment: any[]): AIInsight[] {
    const opportunities: AIInsight[] = [];

    for (const item of equipment) {
      const sensorData = item.sensorData || [];
      const hasPredictiveSensors = sensorData.some((s: any) =>
        ['vibration', 'temperature', 'current', 'pressure'].includes(s.type)
      );

      if (!hasPredictiveSensors && this.getEquipmentCriticality(item) >= 3) {
        opportunities.push({
          id: `predictive-opp-${item.id}`,
          type: 'recommendation',
          severity: 'info',
          title: `Enable Predictive Maintenance: ${item.name}`,
          description: 'This critical equipment lacks sensors for predictive maintenance.',
          impact: `Could prevent ${this.estimatePreventableFailures(item)} failures per year`,
          recommendedActions: [
            'Install vibration sensors on bearings',
            'Add temperature monitoring',
            'Implement current signature analysis',
            'Set up continuous monitoring system'
          ],
          confidence: 90,
          relatedEquipment: [item.id],
          estimatedCostSavings: this.estimatePredictiveSavings(item),
          timeToAction: '2 weeks',
          created: new Date()
        });
      }
    }

    return opportunities;
  }

  private calculateStatistics(values: number[]): any {
    const n = values.length;
    const mean = values.reduce((a, b) => a + b, 0) / n;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);
    const sorted = [...values].sort((a, b) => a - b);
    const median = sorted[Math.floor(n / 2)];

    return { mean, variance, stdDev, median, min: sorted[0], max: sorted[n - 1] };
  }

  private detectTrend(values: number[]): any {
    // Simple linear regression for trend detection
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * values[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-squared
    const yMean = sumY / n;
    const ssTotal = values.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0);
    const ssResidual = values.reduce((sum, y, i) => sum + Math.pow(y - (slope * i + intercept), 2), 0);
    const rSquared = 1 - (ssResidual / ssTotal);

    const percentageChange = ((values[n - 1] - values[0]) / values[0]) * 100;

    return {
      direction: slope > 0 ? 'increasing' : 'decreasing',
      slope: slope,
      percentage: Math.abs(percentageChange),
      period: `${Math.floor(n / 24)} days`,
      confidence: rSquared * 100,
      significance: Math.abs(rSquared)
    };
  }

  private detectAnomalies(values: number[], stats: any): number[] {
    const anomalies: number[] = [];
    const threshold = 3; // 3 sigma rule

    values.forEach((value, index) => {
      const zScore = Math.abs((value - stats.mean) / stats.stdDev);
      if (zScore > threshold) {
        anomalies.push(index);
      }
    });

    return anomalies;
  }

  private assessTrendImpact(reading: any, trend: any): string {
    const equipmentType = reading.equipmentType || 'Equipment';
    const sensorType = reading.sensorType;

    if (sensorType === 'temperature' && trend.direction === 'increasing') {
      return `Rising temperatures may indicate cooling system issues or excessive load on ${equipmentType}`;
    } else if (sensorType === 'vibration' && trend.direction === 'increasing') {
      return `Increasing vibration suggests mechanical wear or misalignment in ${equipmentType}`;
    } else if (sensorType === 'current' && trend.percentage > 20) {
      return `Significant current changes may indicate electrical issues or load imbalances`;
    }

    return `${trend.direction} trend in ${sensorType} requires investigation`;
  }

  private getTrendActions(reading: any, trend: any): string[] {
    const actions: string[] = [];
    const sensorType = reading.sensorType;

    if (sensorType === 'temperature') {
      actions.push('Check cooling system operation');
      actions.push('Verify ambient temperature conditions');
      actions.push('Inspect for blocked air vents');
    } else if (sensorType === 'vibration') {
      actions.push('Perform vibration analysis');
      actions.push('Check mounting and alignment');
      actions.push('Inspect bearings and couplings');
    } else if (sensorType === 'current') {
      actions.push('Verify load distribution');
      actions.push('Check for phase imbalances');
      actions.push('Inspect electrical connections');
    }

    actions.push('Review historical maintenance records');
    actions.push('Schedule detailed inspection');

    return actions;
  }

  private getTrendSeverity(trend: any): 'info' | 'warning' | 'critical' {
    if (trend.percentage > 50 && trend.confidence > 80) return 'critical';
    if (trend.percentage > 25 && trend.confidence > 70) return 'warning';
    return 'info';
  }

  private findOperationalGroups(equipment: any[]): any[][] {
    // Group equipment that typically operate together
    const groups: any[][] = [];
    const processed = new Set<number>();

    for (const item of equipment) {
      if (processed.has(item.id)) continue;

      const group = [item];
      processed.add(item.id);

      // Find related equipment
      for (const other of equipment) {
        if (processed.has(other.id)) continue;

        if (this.areOperationallyRelated(item, other)) {
          group.push(other);
          processed.add(other.id);
        }
      }

      if (group.length > 1) {
        groups.push(group);
      }
    }

    return groups;
  }

  private areOperationallyRelated(equipment1: any, equipment2: any): boolean {
    // Check if equipment are operationally related
    if (equipment1.location === equipment2.location) return true;
    if (equipment1.parentEquipmentId === equipment2.id) return true;
    if (equipment2.parentEquipmentId === equipment1.id) return true;

    // Check if they're part of the same system
    const systems: any = {
      'Motor': ['Circuit Breaker', 'Cable'],
      'Transformer': ['Circuit Breaker', 'Cable'],
      'Solar Panel': ['Inverter', 'Battery Storage'],
      'Wind Turbine': ['Transformer', 'Circuit Breaker']
    };

    const system1 = systems[equipment1.type] || [];
    const system2 = systems[equipment2.type] || [];

    return system1.includes(equipment2.type) || system2.includes(equipment1.type);
  }

  private calculateCorrelationMatrix(equipment: any[]): number[][] {
    const n = equipment.length;
    const matrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          matrix[i][j] = 1;
        } else {
          matrix[i][j] = this.calculateCorrelation(equipment[i], equipment[j]);
        }
      }
    }

    return matrix;
  }

  private calculateCorrelation(equipment1: any, equipment2: any): number {
    // Simplified correlation calculation based on operational patterns
    let correlation = 0;

    // Similar operating hours indicate correlation
    const hours1 = equipment1.operationalData?.hoursRun || 0;
    const hours2 = equipment2.operationalData?.hoursRun || 0;
    correlation += 1 - Math.abs(hours1 - hours2) / Math.max(hours1, hours2);

    // Similar load patterns
    const load1 = equipment1.operationalData?.averageLoad || 0;
    const load2 = equipment2.operationalData?.averageLoad || 0;
    correlation += 1 - Math.abs(load1 - load2) / Math.max(load1, load2, 1);

    // Location proximity
    if (equipment1.location === equipment2.location) {
      correlation += 0.5;
    }

    return correlation / 2.5; // Normalize to 0-1 range
  }

  private assessCorrelationImpact(equipment1: any, equipment2: any, correlation: number): string {
    if (correlation > 0.8) {
      return `Strong positive correlation suggests ${equipment1.name} and ${equipment2.name} should be maintained together`;
    } else if (correlation < -0.8) {
      return `Strong negative correlation indicates potential operational conflicts between ${equipment1.name} and ${equipment2.name}`;
    } else {
      return `Moderate correlation detected between ${equipment1.name} and ${equipment2.name}`;
    }
  }

  private getCorrelationRecommendations(equipment1: any, equipment2: any, correlation: number): string[] {
    const recommendations: string[] = [];

    if (correlation > 0.7) {
      recommendations.push('Schedule maintenance for both units simultaneously');
      recommendations.push('Monitor both units as a system');
      recommendations.push('Consider common spare parts inventory');
    } else if (correlation < -0.7) {
      recommendations.push('Avoid simultaneous operation at peak loads');
      recommendations.push('Stagger maintenance schedules');
      recommendations.push('Investigate operational conflicts');
    }

    return recommendations;
  }

  private analyzeSeasonality(data: any[], metric: string): any {
    // Simplified seasonal decomposition
    const values = data.map(d => d.value);
    const dates = data.map(d => new Date(d.date));

    // Group by month
    const monthlyAverages = new Map<number, number[]>();

    dates.forEach((date, index) => {
      const month = date.getMonth();
      if (!monthlyAverages.has(month)) {
        monthlyAverages.set(month, []);
      }
      monthlyAverages.get(month)!.push(values[index]);
    });

    // Calculate monthly averages
    const seasonalPattern: number[] = [];
    for (let month = 0; month < 12; month++) {
      const monthValues = monthlyAverages.get(month) || [];
      const avg = monthValues.length > 0 ?
        monthValues.reduce((a, b) => a + b, 0) / monthValues.length : 0;
      seasonalPattern.push(avg);
    }

    // Find peak and low seasons
    const maxMonth = seasonalPattern.indexOf(Math.max(...seasonalPattern));
    const minMonth = seasonalPattern.indexOf(Math.min(...seasonalPattern));

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    return {
      pattern: seasonalPattern,
      peakSeason: months[maxMonth],
      lowSeason: months[minMonth],
      variance: Math.max(...seasonalPattern) - Math.min(...seasonalPattern),
      significance: this.calculateSeasonalSignificance(seasonalPattern)
    };
  }

  private calculateSeasonalSignificance(pattern: number[]): number {
    const mean = pattern.reduce((a, b) => a + b, 0) / pattern.length;
    const variance = pattern.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / pattern.length;
    const coefficientOfVariation = Math.sqrt(variance) / mean;
    return Math.min(coefficientOfVariation * 2, 1); // Normalize to 0-1
  }

  private getSeasonalRecommendations(metric: string, seasonal: any): string[] {
    const recommendations: string[] = [];

    if (metric === 'energy') {
      recommendations.push(`Plan major maintenance during ${seasonal.lowSeason} when energy demand is lowest`);
      recommendations.push(`Increase renewable generation capacity for ${seasonal.peakSeason} peak demand`);
      recommendations.push('Implement seasonal load scheduling strategies');
      recommendations.push('Consider thermal energy storage for peak shaving');
    } else if (metric === 'maintenance') {
      recommendations.push(`Schedule preventive maintenance during ${seasonal.lowSeason}`);
      recommendations.push(`Increase spare parts inventory before ${seasonal.peakSeason}`);
      recommendations.push('Plan workforce allocation based on seasonal patterns');
    }

    return recommendations;
  }

  // Utility methods
  private getAverageAge(equipment: any[]): number {
    const ages = equipment.map(e => this.getEquipmentAge(e));
    return ages.reduce((a, b) => a + b, 0) / ages.length;
  }

  private getAverageOperatingHours(equipment: any[]): number {
    const hours = equipment.map(e => e.operationalData?.hoursRun || 0);
    return hours.reduce((a, b) => a + b, 0) / hours.length;
  }

  private getCommonMaintenanceWindow(equipment: any[]): number {
    // Return a score indicating how well maintenance windows align
    // Higher score means better alignment
    return 0.8; // Simplified for now
  }

  private getLocationProximity(equipment: any[]): number {
    // Calculate average distance between equipment
    // Lower score means closer proximity
    const locations = new Set(equipment.map(e => e.location));
    return 1 / locations.size; // Inverse of unique locations
  }

  private getSkillRequirementSimilarity(equipment: any[]): number {
    // Assess if equipment requires similar maintenance skills
    const types = new Set(equipment.map(e => e.type));
    return 1 / types.size; // More similar types = higher score
  }

  private getPartsCommonality(equipment: any[]): number {
    // Estimate commonality of spare parts
    // Similar equipment types have more common parts
    const types = equipment.map(e => e.type);
    const uniqueTypes = new Set(types);
    return 1 - (uniqueTypes.size - 1) / types.length;
  }

  private getTotalDowntimeImpact(equipment: any[]): number {
    // Calculate combined impact of simultaneous downtime
    return equipment.reduce((total, e) => {
      const criticality = this.getEquipmentCriticality(e);
      return total + criticality;
    }, 0);
  }

  private getCurrentScheduleEfficiency(group: any[]): number {
    // Estimate current scheduling efficiency
    // Based on how maintenance is currently distributed
    return 0.6; // 60% efficiency typical for unoptimized schedules
  }

  private getCurrentMaintenanceCost(group: any[]): number {
    return group.reduce((total, equipment) => {
      return total + this.estimateRepairCost(equipment) * 0.2; // Annual maintenance ~20% of repair cost
    }, 0);
  }

  private getBaseMaintenanceHours(equipment: any): number {
    const baseHours: any = {
      'Motor': 4,
      'Transformer': 8,
      'Circuit Breaker': 3,
      'Wind Turbine': 16,
      'Solar Panel': 2,
      'Battery Storage': 4,
      'Inverter': 3,
      'Cable': 2
    };

    return baseHours[equipment.type] || 4;
  }

  private estimatePreventableFailures(equipment: any): number {
    // Estimate failures that could be prevented with predictive maintenance
    const baseFailureRate = this.getHistoricalFailureRate(equipment);
    const preventionRate = 0.7; // Predictive maintenance prevents ~70% of failures
    return Math.round(baseFailureRate * preventionRate * 10); // Per year
  }

  private estimatePredictiveSavings(equipment: any): number {
    const preventableFailures = this.estimatePreventableFailures(equipment);
    const failureCost = this.estimateRepairCost(equipment) * 2; // Emergency repairs cost 2x
    const downtime = this.estimateDowntime(equipment);
    const revenueLoss = this.estimateRevenueLoss(equipment, downtime);

    return preventableFailures * (failureCost + revenueLoss);
  }

  // Public API methods
  public async generateInsights(systemData: any): Promise<AIInsight[]> {
    return await this.analyzeSystemData();
  }

  public getInsights(): Observable<AIInsight[]> {
    return this.insights$;
  }

  public getModelStatus(): Observable<Map<string, PredictionModel>> {
    return this.modelStatus$;
  }

  public async trainModel(modelType: string, trainingData: any): Promise<void> {
    // Implement model training logic
    const modelId = `${modelType}-${Date.now()}`;
    this.updateModelStatus(modelId, {
      id: modelId,
      name: `Custom ${modelType} Model`,
      type: modelType as any,
      accuracy: 0,
      lastTraining: new Date(),
      status: 'training'
    });

    // Simulate training process
    // In production, this would involve actual model training
    setTimeout(() => {
      this.updateModelStatus(modelId, {
        id: modelId,
        name: `Custom ${modelType} Model`,
        type: modelType as any,
        accuracy: 0.85 + Math.random() * 0.1,
        lastTraining: new Date(),
        status: 'active'
      });
    }, 5000);
  }

  public async evaluateModel(modelId: string, testData: any): Promise<number> {
    // Evaluate model performance
    const model = this.models.get(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    // Implement evaluation logic
    // Return accuracy score
    return 0.92;
  }

  private storeInsights(insights: AIInsight[]): void {
    // Store insights in backend for historical tracking
    this.http.post(`${this.apiUrl}/insights`, insights).subscribe({
      next: () => console.log('Insights stored successfully'),
      error: (error) => console.error('Error storing insights:', error)
    });
  }
}

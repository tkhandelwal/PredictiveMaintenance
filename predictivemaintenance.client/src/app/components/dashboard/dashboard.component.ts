// src/app/components/dashboard/dashboard.component.ts
import { Component, OnInit, OnDestroy, ViewChild, ElementRef, HostListener, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Subject, Subscription, interval, fromEvent, combineLatest, timer, animationFrameScheduler } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, takeUntil, throttleTime, observeOn } from 'rxjs/operators';
import {
  MatCardModule, MatIconModule, MatButtonModule, MatSelectModule, MatTabsModule,
  MatProgressBarModule, MatTooltipModule, MatMenuModule, MatBadgeModule,
  MatChipsModule, MatRippleModule, MatExpansionModule, MatSlideToggleModule,
  MatDialogModule, MatDialog, MatSnackBar, MatSnackBarModule,
  MatAutocompleteModule, MatCheckboxModule
} from '@angular/material';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { BreakpointObserver } from '@angular/cdk/layout';

// Three.js imports for advanced 3D visualization
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';

// Chart imports
import { ChartConfiguration, ChartData, ChartOptions } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';

// Services
import { EquipmentService } from '../../services/equipment.service';
import { SignalRService } from '../../services/signalr.service';
import { AIInsightsService, AIInsight } from '../../services/ai-insights.service';
import { WeatherService, WeatherData } from '../../services/weather.service';
import { ThemeService } from '../../services/theme.service';
import { VoiceCommandService } from '../../services/voice-command.service';
import { NotificationService } from '../../services/notification.service';
import { PerformanceMonitorService } from '../../services/performance-monitor.service';

// Models
import { Equipment, MaintenanceStatus, EquipmentType } from '../../models/equipment.model';
import { Site } from '../../models/site.model';
import { DashboardMetrics, DashboardWidget } from '../../models/dashboard.model';

// GPU Computation Service for CUDA integration
import { GPUComputeService } from '../../services/gpu-compute.service';

// WebAssembly modules
import { WasmModule } from '../../wasm/wasm-loader';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, RouterModule, MatCardModule, MatIconModule, MatButtonModule,
    MatSelectModule, MatTabsModule, MatProgressBarModule, MatTooltipModule,
    MatMenuModule, MatBadgeModule, MatChipsModule, MatRippleModule, MatExpansionModule,
    MatSlideToggleModule, MatDialogModule, DragDropModule, BaseChartDirective,
    MatSnackBarModule, MatAutocompleteModule, MatCheckboxModule
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  @ViewChild('threeDView', { static: true }) threeDViewElement!: ElementRef;
  @ViewChild('cssRenderer', { static: true }) cssRendererElement!: ElementRef;

  // 3D Scene Management
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private cssRenderer!: CSS2DRenderer;
  private composer!: EffectComposer;
  private controls!: OrbitControls;
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private equipmentModels: Map<number, THREE.Object3D> = new Map();
  private selectedObject: THREE.Object3D | null = null;
  private outlinePass!: OutlinePass;
  private bloomPass!: UnrealBloomPass;
  private ssaoPass!: SSAOPass;
  private modelLoader!: GLTFLoader;
  private dracoLoader!: DRACOLoader;

  // Particle Systems for visual effects
  private particleSystems: Map<string, THREE.Points> = new Map();
  private energyFlowLines: Map<string, THREE.Line> = new Map();

  // Dashboard State
  sites: Site[] = [];
  selectedSiteId: string = 'all';
  currentSite?: Site;
  equipmentList: Equipment[] = [];
  metrics: DashboardMetrics = this.initializeMetrics();

  // Real-time data streams
  upcomingMaintenance: any[] = [];
  recentAnomalies: any[] = [];
  activeAlerts: any[] = [];
  aiInsights: AIInsight[] = [];
  energyFlowData: any = {};
  weatherData?: WeatherData;

  // Equipment categories with realistic distribution
  equipmentCategories = [
    { type: 'breaker', name: 'Circuit Breakers', icon: 'electrical_services', count: 0, health: 0, color: '#e91e63' },
    { type: 'transformer', name: 'Transformers', icon: 'transform', count: 0, health: 0, color: '#9c27b0' },
    { type: 'motor', name: 'Motors (20-5000HP)', icon: 'settings_input_component', count: 0, health: 0, color: '#3f51b5' },
    { type: 'cable', name: 'Cables/Lines', icon: 'cable', count: 0, health: 0, color: '#009688' },
    { type: 'solar', name: 'Solar Arrays', icon: 'solar_power', count: 0, health: 0, color: '#ff9800' },
    { type: 'wind', name: 'Wind Turbines', icon: 'air', count: 0, health: 0, color: '#00bcd4' },
    { type: 'battery', name: 'BESS', icon: 'battery_charging_full', count: 0, health: 0, color: '#8bc34a' },
    { type: 'inverter', name: 'Inverters', icon: 'power', count: 0, health: 0, color: '#795548' }
  ];

  // Dashboard customization
  widgets: DashboardWidget[] = this.getDefaultWidgets();
  dashboardLayout: 'grid' | 'freeform' | 'focus' = 'grid';
  editMode = false;

  // Performance optimization
  private performanceMode: 'ultra' | 'high' | 'balanced' | 'eco' = 'high';
  private updateQueue: any[] = [];
  private batchUpdateTimer: any;
  private workerPool: Worker[] = [];
  private gpuAvailable = false;

  // Advanced Features State
  isLoading = false;
  isDarkTheme = true;
  showAdvancedFeatures = true;
  enableAnimations = true;
  enable3DView = true;
  enableVoiceCommands = false;
  enableAIPredictions = true;
  enableRealtimeSync = true;
  fullscreenMode = false;
  vrModeAvailable = false;

  // Voice Command State
  isListening = false;
  voiceTranscript = '';

  // Real-time update management
  lastUpdated = new Date();
  private destroy$ = new Subject<void>();
  private refreshInterval?: Subscription;
  private animationFrameId?: number;
  private sceneAnimationId?: number;

  // Chart configurations
  powerFlowChartData: ChartData<'line'> = this.initializePowerFlowChart();
  healthTrendChartData: ChartData<'line'> = this.initializeHealthTrendChart();
  energyDistributionData: ChartData<'doughnut'> = this.initializeEnergyDistribution();

  // Advanced metrics
  gridFrequency = 50.00;
  gridVoltage = { phase1: 230, phase2: 230, phase3: 230 };
  totalHarmonics = 2.3;
  powerFactor = 0.95;
  carbonIntensity = 0.233; // kg CO2/kWh

  constructor(
    private equipmentService: EquipmentService,
    private signalRService: SignalRService,
    private aiInsightsService: AIInsightsService,
    private weatherService: WeatherService,
    private themeService: ThemeService,
    private voiceCommandService: VoiceCommandService,
    private notificationService: NotificationService,
    private performanceMonitor: PerformanceMonitorService,
    private gpuCompute: GPUComputeService,
    private router: Router,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private breakpointObserver: BreakpointObserver,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {
    this.checkGPUAvailability();
    this.initializeWorkerPool();
  }

  async ngOnInit(): Promise<void> {
    this.isLoading = true;

    try {
      // Initialize theme
      this.themeService.isDarkTheme$()
        .pipe(takeUntil(this.destroy$))
        .subscribe(isDark => {
          this.isDarkTheme = isDark;
          this.updateTheme();
        });

      // Load WebAssembly modules for performance-critical calculations
      await this.loadWasmModules();

      // Initialize 3D scene
      this.ngZone.runOutsideAngular(() => {
        this.init3DScene();
        this.animate3DScene();
      });

      // Load initial data
      await this.loadDashboardData();

      // Setup real-time connections
      await this.setupRealtimeConnections();

      // Initialize AI models
      await this.aiInsightsService.initializeModels();

      // Start performance monitoring
      this.performanceMonitor.startMonitoring();

      // Setup responsive layout
      this.setupResponsiveLayout();

      // Initialize voice commands if enabled
      if (this.enableVoiceCommands) {
        this.initializeVoiceCommands();
      }

      // Start real-time updates
      this.startRealtimeUpdates();

    } catch (error) {
      console.error('Dashboard initialization error:', error);
      this.notificationService.showError('Failed to initialize dashboard');
    } finally {
      this.isLoading = false;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();

    // Cleanup 3D scene
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.sceneAnimationId) {
      cancelAnimationFrame(this.sceneAnimationId);
    }

    this.dispose3DScene();

    // Cleanup workers
    this.workerPool.forEach(worker => worker.terminate());

    // Stop performance monitoring
    this.performanceMonitor.stopMonitoring();

    // Disconnect real-time services
    this.signalRService.disconnect();
  }

  private async loadWasmModules(): Promise<void> {
    try {
      const wasmModule = await WasmModule.load();
      // Initialize WASM functions for high-performance calculations
      (window as any).wasmCalculations = wasmModule;
    } catch (error) {
      console.warn('WebAssembly modules not available:', error);
    }
  }

  private checkGPUAvailability(): void {
    this.gpuAvailable = this.gpuCompute.isAvailable();
    if (this.gpuAvailable) {
      console.log('GPU acceleration available');
    }
  }

  private initializeWorkerPool(): void {
    const workerCount = navigator.hardwareConcurrency || 4;
    for (let i = 0; i < workerCount; i++) {
      const worker = new Worker(new URL('../../workers/calculation.worker', import.meta.url));
      this.workerPool.push(worker);
    }
  }

  private init3DScene(): void {
    const container = this.threeDViewElement.nativeElement;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene setup with advanced lighting
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.isDarkTheme ? 0x0a0a0a : 0xf0f0f0);
    this.scene.fog = new THREE.FogExp2(this.isDarkTheme ? 0x0a0a0a : 0xf0f0f0, 0.002);

    // Camera setup
    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 10000);
    this.camera.position.set(100, 50, 100);
    this.camera.lookAt(0, 0, 0);

    // Advanced renderer setup
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      precision: 'highp',
      logarithmicDepthBuffer: true
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    container.appendChild(this.renderer.domElement);

    // CSS renderer for labels
    this.cssRenderer = new CSS2DRenderer();
    this.cssRenderer.setSize(width, height);
    this.cssRenderer.domElement.style.position = 'absolute';
    this.cssRenderer.domElement.style.top = '0';
    this.cssRenderer.domElement.style.pointerEvents = 'none';
    this.cssRendererElement.nativeElement.appendChild(this.cssRenderer.domElement);

    // Advanced lighting setup
    this.setupAdvancedLighting();

    // Post-processing setup
    this.setupPostProcessing();

    // Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxDistance = 500;
    this.controls.minDistance = 10;
    this.controls.autoRotate = false;
    this.controls.autoRotateSpeed = 0.5;

    // Model loaders
    this.dracoLoader = new DRACOLoader();
    this.dracoLoader.setDecoderPath('/assets/draco/');
    this.modelLoader = new GLTFLoader();
    this.modelLoader.setDRACOLoader(this.dracoLoader);

    // Grid and helpers
    this.addGridAndHelpers();

    // Load facility layout
    this.loadFacilityLayout();

    // Event listeners
    this.setupEventListeners();
  }

  private setupAdvancedLighting(): void {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    // Directional light (sun)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 4096;
    directionalLight.shadow.mapSize.height = 4096;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.left = -100;
    directionalLight.shadow.camera.right = 100;
    directionalLight.shadow.camera.top = 100;
    directionalLight.shadow.camera.bottom = -100;
    this.scene.add(directionalLight);

    // Hemisphere light for realistic ambient
    const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x664422, 0.3);
    this.scene.add(hemisphereLight);

    // Point lights for equipment
    this.equipmentList.forEach((equipment, index) => {
      if (equipment.status === MaintenanceStatus.Critical) {
        const pointLight = new THREE.PointLight(0xff0000, 0.5, 20);
        pointLight.position.set(
          Math.sin(index * 0.5) * 30,
          5,
          Math.cos(index * 0.5) * 30
        );
        this.scene.add(pointLight);
      }
    });
  }

  private setupPostProcessing(): void {
    this.composer = new EffectComposer(this.renderer);

    // Render pass
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    // SSAO for ambient occlusion
    this.ssaoPass = new SSAOPass(
      this.scene,
      this.camera,
      this.renderer.domElement.width,
      this.renderer.domElement.height
    );
    this.ssaoPass.kernelRadius = 16;
    this.ssaoPass.minDistance = 0.005;
    this.ssaoPass.maxDistance = 0.1;
    this.composer.addPass(this.ssaoPass);

    // Bloom for glowing effects
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.5, 0.4, 0.85
    );
    this.composer.addPass(this.bloomPass);

    // Outline pass for selection
    this.outlinePass = new OutlinePass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      this.scene,
      this.camera
    );
    this.outlinePass.edgeStrength = 3;
    this.outlinePass.edgeGlow = 1;
    this.outlinePass.edgeThickness = 2;
    this.outlinePass.pulsePeriod = 2;
    this.composer.addPass(this.outlinePass);
  }

  private addGridAndHelpers(): void {
    // Grid
    const gridHelper = new THREE.GridHelper(200, 40, 0x444444, 0x222222);
    this.scene.add(gridHelper);

    // Axes helper
    const axesHelper = new THREE.AxesHelper(50);
    this.scene.add(axesHelper);

    // Add measurement units
    this.addMeasurementGrid();
  }

  private addMeasurementGrid(): void {
    // Add measurement labels at grid intersections
    for (let x = -100; x <= 100; x += 50) {
      for (let z = -100; z <= 100; z += 50) {
        if (x === 0 && z === 0) continue;

        const label = document.createElement('div');
        label.className = 'measurement-label';
        label.textContent = `${Math.abs(x)}m, ${Math.abs(z)}m`;

        const cssObject = new CSS2DObject(label);
        cssObject.position.set(x, 0, z);
        this.scene.add(cssObject);
      }
    }
  }

  private async loadFacilityLayout(): Promise<void> {
    try {
      // Load facility base model
      const facilityModel = await this.modelLoader.loadAsync('/assets/models/facility/industrial_facility.glb');
      facilityModel.scene.scale.set(0.1, 0.1, 0.1);
      facilityModel.scene.position.set(0, 0, 0);
      facilityModel.scene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      this.scene.add(facilityModel.scene);

      // Load and position equipment models
      await this.loadEquipmentModels();

      // Add particle effects
      this.addParticleEffects();

      // Add energy flow visualization
      this.visualizeEnergyFlow();

    } catch (error) {
      console.error('Error loading facility layout:', error);
      // Fallback to procedural generation
      this.generateProceduralFacility();
    }
  }

  private async loadEquipmentModels(): Promise<void> {
    const modelPromises = this.equipmentList.map(async (equipment) => {
      try {
        let modelPath = '';
        let scale = 1;

        switch (equipment.type) {
          case 'Motor':
            const hp = equipment.specifications?.hp || 100;
            modelPath = hp > 1000 ? '/assets/models/equipment/motor_large.glb' : '/assets/models/equipment/motor_medium.glb';
            scale = hp / 1000;
            break;
          case 'Transformer':
            modelPath = '/assets/models/equipment/transformer.glb';
            scale = 2;
            break;
          case 'Circuit Breaker':
            modelPath = '/assets/models/equipment/circuit_breaker.glb';
            scale = 1.5;
            break;
          case 'Solar Panel':
            modelPath = '/assets/models/equipment/solar_array.glb';
            scale = 5;
            break;
          case 'Wind Turbine':
            modelPath = '/assets/models/equipment/wind_turbine.glb';
            scale = 10;
            break;
          case 'Battery Storage':
            modelPath = '/assets/models/equipment/battery_container.glb';
            scale = 3;
            break;
          default:
            modelPath = '/assets/models/equipment/generic_equipment.glb';
        }

        const model = await this.modelLoader.loadAsync(modelPath);
        const equipmentGroup = new THREE.Group();
        equipmentGroup.add(model.scene);
        equipmentGroup.scale.set(scale, scale, scale);

        // Position based on equipment data or layout algorithm
        const position = this.calculateEquipmentPosition(equipment);
        equipmentGroup.position.set(position.x, position.y, position.z);

        // Add to scene and map
        this.scene.add(equipmentGroup);
        this.equipmentModels.set(equipment.id, equipmentGroup);

        // Add status indicator
        this.addStatusIndicator(equipmentGroup, equipment);

        // Add label
        this.addEquipmentLabel(equipmentGroup, equipment);

      } catch (error) {
        console.error(`Error loading model for ${equipment.name}:`, error);
        // Fallback to procedural model
        const fallbackModel = this.createProceduralEquipmentModel(equipment);
        this.scene.add(fallbackModel);
        this.equipmentModels.set(equipment.id, fallbackModel);
      }
    });

    await Promise.all(modelPromises);
  }

  private calculateEquipmentPosition(equipment: Equipment): THREE.Vector3 {
    // Intelligent layout algorithm based on equipment type and connections
    const typePositions: { [key: string]: { x: number, z: number } } = {
      'Transformer': { x: -50, z: -50 },
      'Circuit Breaker': { x: -30, z: -50 },
      'Motor': { x: 0, z: 0 },
      'Solar Panel': { x: 50, z: 50 },
      'Wind Turbine': { x: 80, z: 80 },
      'Battery Storage': { x: 50, z: -50 },
      'Inverter': { x: 30, z: -30 }
    };

    const basePos = typePositions[equipment.type] || { x: 0, z: 0 };
    const offset = {
      x: (Math.random() - 0.5) * 20,
      z: (Math.random() - 0.5) * 20
    };

    return new THREE.Vector3(
      basePos.x + offset.x,
      0,
      basePos.z + offset.z
    );
  }

  private createProceduralEquipmentModel(equipment: Equipment): THREE.Group {
    const group = new THREE.Group();

    // Base geometry
    let geometry: THREE.BufferGeometry;
    let material: THREE.Material;

    switch (equipment.type) {
      case 'Motor':
        geometry = new THREE.CylinderGeometry(2, 2, 4, 32);
        material = new THREE.MeshPhysicalMaterial({
          color: 0x3f51b5,
          metalness: 0.8,
          roughness: 0.2,
          clearcoat: 0.3
        });
        break;
      case 'Transformer':
        geometry = new THREE.BoxGeometry(6, 8, 6);
        material = new THREE.MeshPhysicalMaterial({
          color: 0x9c27b0,
          metalness: 0.7,
          roughness: 0.3
        });
        break;
      case 'Circuit Breaker':
        geometry = new THREE.BoxGeometry(3, 4, 2);
        material = new THREE.MeshPhysicalMaterial({
          color: 0xe91e63,
          metalness: 0.6,
          roughness: 0.4
        });
        break;
      default:
        geometry = new THREE.BoxGeometry(4, 4, 4);
        material = new THREE.MeshPhysicalMaterial({
          color: 0x607d8b,
          metalness: 0.5,
          roughness: 0.5
        });
    }

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    // Add details
    this.addEquipmentDetails(group, equipment);

    return group;
  }

  private addEquipmentDetails(group: THREE.Group, equipment: Equipment): void {
    // Add cooling fins for motors
    if (equipment.type === 'Motor') {
      const finGeometry = new THREE.BoxGeometry(2.2, 0.1, 4.2);
      const finMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x2c3e50,
        metalness: 0.9,
        roughness: 0.1
      });

      for (let i = 0; i < 10; i++) {
        const fin = new THREE.Mesh(finGeometry, finMaterial);
        fin.position.y = -1.5 + i * 0.3;
        group.add(fin);
      }
    }

    // Add insulators for transformers
    if (equipment.type === 'Transformer') {
      const insulatorGeometry = new THREE.CylinderGeometry(0.3, 0.5, 2, 8);
      const insulatorMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x8b4513,
        metalness: 0.1,
        roughness: 0.8,
        transmission: 0.1
      });

      const positions = [
        { x: -2, z: -2 }, { x: 2, z: -2 },
        { x: -2, z: 2 }, { x: 2, z: 2 }
      ];

      positions.forEach(pos => {
        const insulator = new THREE.Mesh(insulatorGeometry, insulatorMaterial);
        insulator.position.set(pos.x, 5, pos.z);
        group.add(insulator);
      });
    }
  }

  private addStatusIndicator(model: THREE.Object3D, equipment: Equipment): void {
    // Create status light
    const lightGeometry = new THREE.SphereGeometry(0.5, 16, 16);
    const lightMaterial = new THREE.MeshPhysicalMaterial({
      emissive: this.getStatusColor(equipment.status),
      emissiveIntensity: 2,
      metalness: 0,
      roughness: 0,
      transmission: 0.9,
      thickness: 0.5
    });

    const statusLight = new THREE.Mesh(lightGeometry, lightMaterial);
    statusLight.position.y = 8;
    model.add(statusLight);

    // Add point light for glow effect
    const pointLight = new THREE.PointLight(this.getStatusColor(equipment.status), 0.5, 10);
    pointLight.position.copy(statusLight.position);
    model.add(pointLight);

    // Animate status light
    this.animateStatusLight(statusLight, equipment.status);
  }

  private getStatusColor(status: MaintenanceStatus): number {
    switch (status) {
      case MaintenanceStatus.Operational:
        return 0x00ff00;
      case MaintenanceStatus.Warning:
        return 0xffaa00;
      case MaintenanceStatus.Critical:
        return 0xff0000;
      case MaintenanceStatus.UnderMaintenance:
        return 0x0000ff;
      default:
        return 0x888888;
    }
  }

  private animateStatusLight(light: THREE.Mesh, status: MaintenanceStatus): void {
    if (status === MaintenanceStatus.Critical || status === MaintenanceStatus.Warning) {
      // Pulsing animation for critical/warning status
      const animate = () => {
        const time = Date.now() * 0.001;
        const scale = 1 + Math.sin(time * 5) * 0.2;
        light.scale.setScalar(scale);

        if (this.equipmentModels.has(light.parent?.userData.equipmentId)) {
          requestAnimationFrame(animate);
        }
      };
      animate();
    }
  }

  private addEquipmentLabel(model: THREE.Object3D, equipment: Equipment): void {
    const labelDiv = document.createElement('div');
    labelDiv.className = 'equipment-label';
    labelDiv.innerHTML = `
      <div class="label-header">${equipment.name}</div>
      <div class="label-status status-${equipment.status}">
        ${this.getStatusText(equipment.status)}
      </div>
      <div class="label-metrics">
        <span>Load: ${equipment.operationalData?.currentLoad || 0}%</span>
        <span>Temp: ${this.getLatestTemperature(equipment)}°C</span>
      </div>
    `;

    const label = new CSS2DObject(labelDiv);
    label.position.set(0, 10, 0);
    model.add(label);

    // Store reference for updates
    model.userData.label = labelDiv;
    model.userData.equipmentId = equipment.id;
  }

  private getStatusText(status: MaintenanceStatus): string {
    const statusTexts = {
      [MaintenanceStatus.Operational]: 'Operational',
      [MaintenanceStatus.Warning]: 'Warning',
      [MaintenanceStatus.Critical]: 'Critical',
      [MaintenanceStatus.UnderMaintenance]: 'Maintenance',
      [MaintenanceStatus.Offline]: 'Offline',
      [MaintenanceStatus.Commissioning]: 'Commissioning'
    };
    return statusTexts[status] || 'Unknown';
  }

  private getLatestTemperature(equipment: Equipment): number {
    const tempSensor = equipment.sensorData?.find(s => s.type === 'temperature');
    return tempSensor?.value || 0;
  }

  private addParticleEffects(): void {
    // Add dust particles for industrial atmosphere
    const particleCount = 1000;
    const particles = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 200;
      positions[i + 1] = Math.random() * 50;
      positions[i + 2] = (Math.random() - 0.5) * 200;

      const color = new THREE.Color();
      color.setHSL(0.1, 0.2, 0.5 + Math.random() * 0.5);
      colors[i] = color.r;
      colors[i + 1] = color.g;
      colors[i + 2] = color.b;
    }

    particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particles.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const particleMaterial = new THREE.PointsMaterial({
      size: 0.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending
    });

    const particleSystem = new THREE.Points(particles, particleMaterial);
    this.scene.add(particleSystem);
    this.particleSystems.set('dust', particleSystem);

    // Add steam/exhaust effects for certain equipment
    this.addSteamEffects();
  }

  private addSteamEffects(): void {
    this.equipmentList.forEach(equipment => {
      if (equipment.type === 'Motor' && equipment.operationalData?.currentLoad > 80) {
        const steamParticles = this.createSteamEffect(equipment);
        const model = this.equipmentModels.get(equipment.id);
        if (model) {
          model.add(steamParticles);
        }
      }
    });
  }

  private createSteamEffect(equipment: Equipment): THREE.Points {
    const particleCount = 200;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const lifetimes = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 2;
      positions[i3 + 1] = 0;
      positions[i3 + 2] = (Math.random() - 0.5) * 2;
      lifetimes[i] = Math.random();
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1));

    const material = new THREE.PointsMaterial({
      size: 2,
      color: 0xffffff,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      map: this.createSteamTexture()
    });

    return new THREE.Points(geometry, material);
  }

  private createSteamTexture(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext('2d')!;

    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.5, 'rgba(255,255,255,0.5)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');

    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    return texture;
  }

  private visualizeEnergyFlow(): void {
    // Create energy flow lines between connected equipment
    const connections = this.identifyEquipmentConnections();

    connections.forEach(connection => {
      const startModel = this.equipmentModels.get(connection.from);
      const endModel = this.equipmentModels.get(connection.to);

      if (startModel && endModel) {
        const flowLine = this.createEnergyFlowLine(
          startModel.position,
          endModel.position,
          connection.power
        );
        this.scene.add(flowLine);
        this.energyFlowLines.set(`${connection.from}-${connection.to}`, flowLine);
      }
    });
  }

  private identifyEquipmentConnections(): Array<{ from: number, to: number, power: number }> {
    // Intelligent connection identification based on equipment types and electrical topology
    const connections: Array<{ from: number, to: number, power: number }> = [];

    // Example: Connect transformers to breakers
    const transformers = this.equipmentList.filter(e => e.type === 'Transformer');
    const breakers = this.equipmentList.filter(e => e.type === 'Circuit Breaker');

    transformers.forEach(transformer => {
      const nearestBreaker = this.findNearestEquipment(transformer, breakers);
      if (nearestBreaker) {
        connections.push({
          from: transformer.id,
          to: nearestBreaker.id,
          power: transformer.operationalData?.currentLoad || 0
        });
      }
    });

    // Connect renewable sources to inverters
    const renewables = this.equipmentList.filter(e =>
      e.type === 'Solar Panel' || e.type === 'Wind Turbine'
    );
    const inverters = this.equipmentList.filter(e => e.type === 'Inverter');

    renewables.forEach(source => {
      const nearestInverter = this.findNearestEquipment(source, inverters);
      if (nearestInverter) {
        connections.push({
          from: source.id,
          to: nearestInverter.id,
          power: source.operationalData?.energyGenerated || 0
        });
      }
    });

    return connections;
  }

  private findNearestEquipment(source: Equipment, targets: Equipment[]): Equipment | null {
    let nearest: Equipment | null = null;
    let minDistance = Infinity;

    targets.forEach(target => {
      const sourceModel = this.equipmentModels.get(source.id);
      const targetModel = this.equipmentModels.get(target.id);

      if (sourceModel && targetModel) {
        const distance = sourceModel.position.distanceTo(targetModel.position);
        if (distance < minDistance) {
          minDistance = distance;
          nearest = target;
        }
      }
    });

    return nearest;
  }

  private createEnergyFlowLine(start: THREE.Vector3, end: THREE.Vector3, power: number): THREE.Line {
    const points = [];
    const segments = 50;

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const point = new THREE.Vector3();
      point.lerpVectors(start, end, t);

      // Add some curve to the line
      const midPoint = 0.5;
      const curveHeight = 10 * Math.sin(t * Math.PI);
      point.y += curveHeight;

      points.push(point);
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);

    // Animated shader material for energy flow
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        power: { value: power / 100 },
        color: { value: new THREE.Color(0x00ff00) }
      },
      vertexShader: `
        uniform float time;
        varying float vProgress;
        
        void main() {
          vProgress = position.x + time;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float power;
        uniform vec3 color;
        varying float vProgress;
        
        void main() {
          float alpha = sin(vProgress * 10.0) * 0.5 + 0.5;
          alpha *= power;
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending
    });

    return new THREE.Line(geometry, material);
  }

  private setupEventListeners(): void {
    // Mouse events for 3D interaction
    this.renderer.domElement.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.renderer.domElement.addEventListener('click', this.onClick.bind(this));
    this.renderer.domElement.addEventListener('dblclick', this.onDoubleClick.bind(this));

    // Touch events for mobile
    this.renderer.domElement.addEventListener('touchstart', this.onTouchStart.bind(this));
    this.renderer.domElement.addEventListener('touchmove', this.onTouchMove.bind(this));

    // Keyboard shortcuts
    fromEvent<KeyboardEvent>(document, 'keydown')
      .pipe(takeUntil(this.destroy$))
      .subscribe(event => this.handleKeyboardShortcut(event));

    // Window resize
    fromEvent(window, 'resize')
      .pipe(
        debounceTime(200),
        takeUntil(this.destroy$)
      )
      .subscribe(() => this.onWindowResize());
  }

  private onMouseMove(event: MouseEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Hover effect
    this.checkIntersections();
  }

  private onClick(event: MouseEvent): void {
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const intersects = this.raycaster.intersectObjects(
      Array.from(this.equipmentModels.values()),
      true
    );

    if (intersects.length > 0) {
      const selected = intersects[0].object;
      const equipmentGroup = this.findEquipmentGroup(selected);

      if (equipmentGroup) {
        const equipmentId = equipmentGroup.userData.equipmentId;
        const equipment = this.equipmentList.find(e => e.id === equipmentId);

        if (equipment) {
          this.selectEquipment(equipment);
        }
      }
    }
  }

  private onDoubleClick(event: MouseEvent): void {
    const intersects = this.raycaster.intersectObjects(
      Array.from(this.equipmentModels.values()),
      true
    );

    if (intersects.length > 0) {
      const selected = intersects[0].object;
      const equipmentGroup = this.findEquipmentGroup(selected);

      if (equipmentGroup) {
        const equipmentId = equipmentGroup.userData.equipmentId;
        this.router.navigate(['/equipment', equipmentId]);
      }
    }
  }

  private onTouchStart(event: TouchEvent): void {
    event.preventDefault();
    const touch = event.touches[0];
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private onTouchMove(event: TouchEvent): void {
    event.preventDefault();
    const touch = event.touches[0];
    this.onMouseMove(touch as any);
  }

  private handleKeyboardShortcut(event: KeyboardEvent): void {
    // Keyboard shortcuts
    switch (event.key) {
      case 'f':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          this.toggleFullscreen();
        }
        break;
      case 'Escape':
        if (this.fullscreenMode) {
          this.toggleFullscreen();
        }
        break;
      case 'r':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          this.resetCamera();
        }
        break;
      case 'v':
        if (event.altKey) {
          event.preventDefault();
          this.toggleVoiceCommands();
        }
        break;
      case '1':
      case '2':
      case '3':
      case '4':
        if (event.ctrlKey) {
          event.preventDefault();
          this.switchDashboardView(parseInt(event.key));
        }
        break;
    }
  }

  private findEquipmentGroup(object: THREE.Object3D): THREE.Object3D | null {
    let current = object;
    while (current.parent) {
      if (current.userData.equipmentId) {
        return current;
      }
      current = current.parent;
    }
    return null;
  }

  private checkIntersections(): void {
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const intersects = this.raycaster.intersectObjects(
      Array.from(this.equipmentModels.values()),
      true
    );

    // Reset previous hover
    if (this.selectedObject && this.selectedObject !== this.outlinePass.selectedObjects[0]) {
      // Remove hover effect
    }

    if (intersects.length > 0) {
      const selected = intersects[0].object;
      const equipmentGroup = this.findEquipmentGroup(selected);

      if (equipmentGroup && equipmentGroup !== this.selectedObject) {
        this.selectedObject = equipmentGroup;
        // Add hover effect
        this.renderer.domElement.style.cursor = 'pointer';
      }
    } else {
      this.selectedObject = null;
      this.renderer.domElement.style.cursor = 'default';
    }
  }

  private selectEquipment(equipment: Equipment): void {
    const model = this.equipmentModels.get(equipment.id);
    if (model) {
      // Update outline pass
      this.outlinePass.selectedObjects = [model];

      // Animate camera to focus on equipment
      this.focusOnEquipment(model);

      // Show equipment details
      this.showEquipmentDetails(equipment);
    }
  }

  private focusOnEquipment(model: THREE.Object3D): void {
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = this.camera.fov * (Math.PI / 180);
    const cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 2;

    const targetPosition = new THREE.Vector3(
      center.x + cameraZ * 0.5,
      center.y + cameraZ * 0.3,
      center.z + cameraZ * 0.5
    );

    // Animate camera movement
    this.animateCameraTo(targetPosition, center);
  }

  private animateCameraTo(position: THREE.Vector3, target: THREE.Vector3): void {
    const startPosition = this.camera.position.clone();
    const startTarget = this.controls.target.clone();

    const duration = 1000;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function
      const easeProgress = 1 - Math.pow(1 - progress, 3);

      this.camera.position.lerpVectors(startPosition, position, easeProgress);
      this.controls.target.lerpVectors(startTarget, target, easeProgress);
      this.controls.update();

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  }

  private showEquipmentDetails(equipment: Equipment): void {
    // Implement equipment details popup or panel
    this.snackBar.open(`Selected: ${equipment.name}`, 'View Details', {
      duration: 3000,
      horizontalPosition: 'right',
      verticalPosition: 'bottom'
    }).onAction().subscribe(() => {
      this.router.navigate(['/equipment', equipment.id]);
    });
  }

  private animate3DScene(): void {
    this.sceneAnimationId = requestAnimationFrame(() => this.animate3DScene());

    // Update controls
    this.controls.update();

    // Update particle systems
    this.updateParticleSystems();

    // Update energy flow animations
    this.updateEnergyFlows();

    // Update equipment animations
    this.updateEquipmentAnimations();

    // Render scene
    this.ngZone.runOutsideAngular(() => {
      if (this.composer && this.performanceMode !== 'eco') {
        this.composer.render();
      } else {
        this.renderer.render(this.scene, this.camera);
      }
      this.cssRenderer.render(this.scene, this.camera);
    });
  }

  private updateParticleSystems(): void {
    // Animate dust particles
    const dustParticles = this.particleSystems.get('dust');
    if (dustParticles) {
      const positions = dustParticles.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const i3 = i * 3;
        positions.array[i3 + 1] += 0.01;

        if (positions.array[i3 + 1] > 50) {
          positions.array[i3 + 1] = 0;
        }
      }
      positions.needsUpdate = true;
    }

    // Update steam effects
    this.equipmentModels.forEach((model, equipmentId) => {
      const equipment = this.equipmentList.find(e => e.id === equipmentId);
      if (equipment && equipment.type === 'Motor') {
        this.updateSteamEffect(model, equipment);
      }
    });
  }

  private updateSteamEffect(model: THREE.Object3D, equipment: Equipment): void {
    const steamEffect = model.children.find(child => child instanceof THREE.Points);
    if (steamEffect && steamEffect instanceof THREE.Points) {
      const positions = steamEffect.geometry.attributes.position;
      const lifetimes = steamEffect.geometry.attributes.lifetime;

      for (let i = 0; i < positions.count; i++) {
        const i3 = i * 3;

        // Update lifetime
        lifetimes.array[i] -= 0.01;

        if (lifetimes.array[i] <= 0) {
          // Reset particle
          positions.array[i3] = (Math.random() - 0.5) * 2;
          positions.array[i3 + 1] = 0;
          positions.array[i3 + 2] = (Math.random() - 0.5) * 2;
          lifetimes.array[i] = 1;
        } else {
          // Move particle up and outward
          positions.array[i3 + 1] += 0.1;
          positions.array[i3] += (Math.random() - 0.5) * 0.02;
          positions.array[i3 + 2] += (Math.random() - 0.5) * 0.02;
        }

        // Update opacity based on lifetime
        const material = steamEffect.material as THREE.PointsMaterial;
        material.opacity = 0.4 * equipment.operationalData!.currentLoad / 100;
      }

      positions.needsUpdate = true;
      lifetimes.needsUpdate = true;
    }
  }

  private updateEnergyFlows(): void {
    const time = Date.now() * 0.001;

    this.energyFlowLines.forEach((line, key) => {
      const material = line.material as THREE.ShaderMaterial;
      material.uniforms.time.value = time;

      // Update power based on real-time data
      const [fromId, toId] = key.split('-').map(Number);
      const fromEquipment = this.equipmentList.find(e => e.id === fromId);
      const toEquipment = this.equipmentList.find(e => e.id === toId);

      if (fromEquipment && toEquipment) {
        const power = fromEquipment.operationalData?.currentLoad || 0;
        material.uniforms.power.value = power / 100;

        // Update color based on power level
        const color = new THREE.Color();
        color.setHSL(0.3 - (power / 100) * 0.3, 1, 0.5);
        material.uniforms.color.value = color;
      }
    });
  }

  private updateEquipmentAnimations(): void {
    const time = Date.now() * 0.001;

    this.equipmentModels.forEach((model, equipmentId) => {
      const equipment = this.equipmentList.find(e => e.id === equipmentId);

      if (equipment) {
        // Rotate wind turbines
        if (equipment.type === 'Wind Turbine') {
          const rotor = model.getObjectByName('rotor');
          if (rotor) {
            const windSpeed = this.weatherData?.windSpeed || 5;
            rotor.rotation.z += windSpeed * 0.001;
          }
        }

        // Animate solar panel tracking
        if (equipment.type === 'Solar Panel') {
          const panel = model.getObjectByName('panel');
          if (panel) {
            const sunAngle = (time % 86400) / 86400 * Math.PI;
            panel.rotation.x = -Math.PI / 6 + Math.sin(sunAngle) * Math.PI / 12;
          }
        }

        // Update equipment label
        this.updateEquipmentLabel(model, equipment);
      }
    });
  }

  private updateEquipmentLabel(model: THREE.Object3D, equipment: Equipment): void {
    const labelDiv = model.userData.label;
    if (labelDiv) {
      const load = equipment.operationalData?.currentLoad || 0;
      const temp = this.getLatestTemperature(equipment);

      labelDiv.querySelector('.label-metrics').innerHTML = `
        <span>Load: ${load.toFixed(1)}%</span>
        <span>Temp: ${temp.toFixed(1)}°C</span>
      `;

      // Update status if changed
      const statusElement = labelDiv.querySelector('.label-status');
      statusElement.className = `label-status status-${equipment.status}`;
      statusElement.textContent = this.getStatusText(equipment.status);
    }
  }

  private onWindowResize(): void {
    const container = this.threeDViewElement.nativeElement;
    const width = container.clientWidth;
    const height = container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    this.cssRenderer.setSize(width, height);

    if (this.composer) {
      this.composer.setSize(width, height);
    }
  }

  private dispose3DScene(): void {
    // Dispose of all Three.js resources
    this.scene.traverse((object) => {
      if ((object as any).geometry) {
        (object as any).geometry.dispose();
      }
      if ((object as any).material) {
        if (Array.isArray((object as any).material)) {
          (object as any).material.forEach((material: any) => material.dispose());
        } else {
          (object as any).material.dispose();
        }
      }
    });

    this.renderer.dispose();
    this.controls.dispose();
  }

  // Dashboard Data Management
  private async loadDashboardData(): Promise<void> {
    try {
      // Load sites
      this.sites = await this.equipmentService.getSites().toPromise();

      // Load equipment
      if (this.selectedSiteId === 'all') {
        this.equipmentList = await this.equipmentService.getAllEquipment().toPromise();
      } else {
        this.equipmentList = await this.equipmentService.getEquipmentBySite(this.selectedSiteId).toPromise();
      }

      // Calculate metrics
      this.calculateDashboardMetrics();

      // Load AI insights
      this.aiInsights = await this.aiInsightsService.getLatestInsights().toPromise();

      // Load weather data
      this.weatherData = await this.weatherService.getCurrentWeather().toPromise();

      // Initialize charts
      this.initializeCharts();

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      throw error;
    }
  }

  private calculateDashboardMetrics(): void {
    this.metrics = {
      totalEquipment: this.equipmentList.length,
      operationalCount: this.equipmentList.filter(e => e.status === MaintenanceStatus.Operational).length,
      warningCount: this.equipmentList.filter(e => e.status === MaintenanceStatus.Warning).length,
      criticalCount: this.equipmentList.filter(e => e.status === MaintenanceStatus.Critical).length,
      maintenanceCount: this.equipmentList.filter(e => e.status === MaintenanceStatus.UnderMaintenance).length,
      availabilityRate: this.calculateAvailability(),
      mtbf: this.calculateMTBF(),
      mttr: this.calculateMTTR(),
      oee: this.calculateOEE(),
      energyConsumption: this.calculateEnergyConsumption(),
      powerGeneration: this.calculatePowerGeneration(),
      carbonFootprint: this.calculateCarbonFootprint()
    };

    // Update equipment categories
    this.updateEquipmentCategories();
  }

  private calculateAvailability(): number {
    const totalTime = this.equipmentList.reduce((sum, eq) =>
      sum + (eq.operationalData?.hoursRun || 0), 0
    );
    const downtime = this.equipmentList.reduce((sum, eq) => {
      if (eq.status !== MaintenanceStatus.Operational) {
        return sum + 24; // Assume 24 hours downtime for non-operational
      }
      return sum;
    }, 0);

    return ((totalTime - downtime) / totalTime) * 100;
  }

  private calculateMTBF(): number {
    // Mean Time Between Failures calculation
    const totalOperatingTime = this.equipmentList.reduce((sum, eq) =>
      sum + (eq.operationalData?.hoursRun || 0), 0
    );
    const failureCount = this.equipmentList.filter(e =>
      e.status === MaintenanceStatus.Critical
    ).length || 1;

    return totalOperatingTime / failureCount;
  }

  private calculateMTTR(): number {
    // Mean Time To Repair calculation
    const totalRepairTime = this.equipmentList.reduce((sum, eq) => {
      if (eq.maintenanceHistory && eq.maintenanceHistory.length > 0) {
        const avgRepairTime = eq.maintenanceHistory.reduce((time, record) =>
          time + record.duration, 0
        ) / eq.maintenanceHistory.length;
        return sum + avgRepairTime;
      }
      return sum;
    }, 0);

    const repairCount = this.equipmentList.filter(e =>
      e.maintenanceHistory && e.maintenanceHistory.length > 0
    ).length || 1;

    return totalRepairTime / repairCount;
  }

  private calculateOEE(): number {
    // Overall Equipment Effectiveness
    const availability = this.metrics.availabilityRate / 100;
    const performance = this.equipmentList.reduce((sum, eq) =>
      sum + (eq.operationalData?.performance || 0), 0
    ) / this.equipmentList.length / 100;
    const quality = this.equipmentList.reduce((sum, eq) =>
      sum + (eq.operationalData?.quality || 0), 0
    ) / this.equipmentList.length / 100;

    return availability * performance * quality * 100;
  }

  private calculateEnergyConsumption(): number {
    return this.equipmentList.reduce((sum, eq) => {
      if (eq.type === 'Motor' || eq.type === 'Transformer') {
        const power = parseFloat(eq.specifications?.ratedPower || '0');
        const load = eq.operationalData?.currentLoad || 0;
        return sum + (power * load / 100);
      }
      return sum;
    }, 0);
  }

  private calculatePowerGeneration(): number {
    return this.equipmentList.reduce((sum, eq) => {
      if (eq.type === 'Solar Panel' || eq.type === 'Wind Turbine') {
        return sum + (eq.operationalData?.energyGenerated || 0);
      }
      return sum;
    }, 0);
  }

  private calculateCarbonFootprint(): number {
    const netEnergy = this.metrics.energyConsumption - this.metrics.powerGeneration;
    return netEnergy * this.carbonIntensity;
  }

  private updateEquipmentCategories(): void {
    this.equipmentCategories.forEach(category => {
      const equipment = this.equipmentList.filter(e =>
        e.type.toLowerCase().includes(category.type)
      );
      category.count = equipment.length;

      // Calculate average health
      if (equipment.length > 0) {
        const healthSum = equipment.reduce((sum, eq) => {
          const health = eq.status === MaintenanceStatus.Operational ? 100 :
            eq.status === MaintenanceStatus.Warning ? 70 :
              eq.status === MaintenanceStatus.Critical ? 30 : 0;
          return sum + health;
        }, 0);
        category.health = healthSum / equipment.length;
      } else {
        category.health = 0;
      }
    });
  }

  private initializeCharts(): void {
    // Power flow chart
    this.updatePowerFlowChart();

    // Health trend chart
    this.updateHealthTrendChart();

    // Energy distribution
    this.updateEnergyDistribution();
  }

  private initializePowerFlowChart(): ChartData<'line'> {
    return {
      labels: [],
      datasets: [
        {
          label: 'Power Consumption',
          data: [],
          borderColor: '#e91e63',
          backgroundColor: 'rgba(233, 30, 99, 0.1)',
          tension: 0.4
        },
        {
          label: 'Power Generation',
          data: [],
          borderColor: '#4caf50',
          backgroundColor: 'rgba(76, 175, 80, 0.1)',
          tension: 0.4
        }
      ]
    };
  }

  private initializeHealthTrendChart(): ChartData<'line'> {
    return {
      labels: [],
      datasets: [
        {
          label: 'System Health',
          data: [],
          borderColor: '#2196f3',
          backgroundColor: 'rgba(33, 150, 243, 0.1)',
          tension: 0.4
        }
      ]
    };
  }

  private initializeEnergyDistribution(): ChartData<'doughnut'> {
    return {
      labels: ['Motors', 'Transformers', 'Lighting', 'HVAC', 'Other'],
      datasets: [{
        data: [35, 25, 15, 20, 5],
        backgroundColor: [
          '#3f51b5',
          '#9c27b0',
          '#ffc107',
          '#00bcd4',
          '#607d8b'
        ]
      }]
    };
  }

  private updatePowerFlowChart(): void {
    // Generate time labels for last 24 hours
    const labels = [];
    const consumption = [];
    const generation = [];

    for (let i = 23; i >= 0; i--) {
      const time = new Date();
      time.setHours(time.getHours() - i);
      labels.push(time.toLocaleTimeString('en-US', { hour: '2-digit' }));

      // Simulate realistic power patterns
      const hour = time.getHours();
      const baseConsumption = 1000; // kW
      const consumptionVariation = hour >= 8 && hour <= 17 ? 1.5 : 0.7;
      consumption.push(baseConsumption * consumptionVariation + Math.random() * 200);

      // Solar generation peaks at noon
      const solarGeneration = hour >= 6 && hour <= 18 ?
        Math.sin((hour - 6) / 12 * Math.PI) * 500 : 0;

      // Wind generation is more random
      const windGeneration = Math.random() * 300;

      generation.push(solarGeneration + windGeneration);
    }

    this.powerFlowChartData.labels = labels;
    this.powerFlowChartData.datasets[0].data = consumption;
    this.powerFlowChartData.datasets[1].data = generation;
  }

  private updateHealthTrendChart(): void {
    const labels = [];
    const healthData = [];

    // Last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      labels.push(date.toLocaleDateString('en-US', { weekday: 'short' }));

      // Calculate daily health score
      const baseHealth = 95;
      const variation = Math.random() * 10 - 5;
      healthData.push(Math.max(0, Math.min(100, baseHealth + variation)));
    }

    this.healthTrendChartData.labels = labels;
    this.healthTrendChartData.datasets[0].data = healthData;
  }

  private updateEnergyDistribution(): void {
    // Calculate actual distribution from equipment
    const distribution = {
      motors: 0,
      transformers: 0,
      lighting: 0,
      hvac: 0,
      other: 0
    };

    this.equipmentList.forEach(eq => {
      const consumption = eq.operationalData?.energyConsumed || 0;

      switch (eq.type) {
        case 'Motor':
          distribution.motors += consumption;
          break;
        case 'Transformer':
          distribution.transformers += consumption * 0.02; // Transformer losses
          break;
        default:
          distribution.other += consumption;
      }
    });

    // Add estimated lighting and HVAC
    const totalConsumption = Object.values(distribution).reduce((a, b) => a + b, 0);
    distribution.lighting = totalConsumption * 0.15;
    distribution.hvac = totalConsumption * 0.20;

    this.energyDistributionData.datasets[0].data = [
      distribution.motors,
      distribution.transformers,
      distribution.lighting,
      distribution.hvac,
      distribution.other
    ];
  }

  // Real-time Updates
  private async setupRealtimeConnections(): Promise<void> {
    // Connect to SignalR hub
    await this.signalRService.connect();

    // Subscribe to real-time equipment updates
    this.signalRService.onEquipmentUpdate()
      .pipe(takeUntil(this.destroy$))
      .subscribe(update => {
        this.handleEquipmentUpdate(update);
      });

    // Subscribe to anomaly alerts
    this.signalRService.onAnomalyDetected()
      .pipe(takeUntil(this.destroy$))
      .subscribe(anomaly => {
        this.handleAnomalyAlert(anomaly);
      });

    // Subscribe to maintenance events
    this.signalRService.onMaintenanceScheduled()
      .pipe(takeUntil(this.destroy$))
      .subscribe(maintenance => {
        this.handleMaintenanceEvent(maintenance);
      });
  }

  private startRealtimeUpdates(): void {
    // Update dashboard every 5 seconds
    this.refreshInterval = interval(5000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.updateDashboardData();
      });

    // High-frequency updates for critical metrics
    interval(1000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.updateCriticalMetrics();
      });
  }

  private updateDashboardData(): void {
    // Batch update equipment data
    this.equipmentService.getEquipmentUpdates(this.lastUpdated)
      .pipe(takeUntil(this.destroy$))
      .subscribe(updates => {
        updates.forEach(update => {
          const equipment = this.equipmentList.find(e => e.id === update.id);
          if (equipment) {
            Object.assign(equipment, update);
          }
        });

        this.calculateDashboardMetrics();
        this.updateCharts();
        this.lastUpdated = new Date();
      });
  }

  private updateCriticalMetrics(): void {
    // Update grid frequency with realistic variations
    this.gridFrequency = 50 + (Math.random() - 0.5) * 0.1;

    // Update grid voltage
    this.gridVoltage = {
      phase1: 230 + (Math.random() - 0.5) * 5,
      phase2: 230 + (Math.random() - 0.5) * 5,
      phase3: 230 + (Math.random() - 0.5) * 5
    };

    // Update power factor
    this.powerFactor = 0.95 + (Math.random() - 0.5) * 0.05;

    // Update THD
    this.totalHarmonics = 2.3 + (Math.random() - 0.5) * 0.5;
  }

  private handleEquipmentUpdate(update: any): void {
    const equipment = this.equipmentList.find(e => e.id === update.equipmentId);
    if (equipment) {
      // Update equipment data
      equipment.operationalData = update.operationalData;
      equipment.sensorData = update.sensorData;
      equipment.status = update.status;

      // Update 3D visualization
      this.ngZone.runOutsideAngular(() => {
        const model = this.equipmentModels.get(equipment.id);
        if (model) {
          this.updateEquipmentVisualization(model, equipment);
        }
      });

      // Recalculate metrics if significant change
      if (update.status !== equipment.status) {
        this.calculateDashboardMetrics();
      }
    }
  }

  private updateEquipmentVisualization(model: THREE.Object3D, equipment: Equipment): void {
    // Update status indicator color
    const statusLight = model.getObjectByName('statusLight') as THREE.Mesh;
    if (statusLight) {
      const material = statusLight.material as THREE.MeshPhysicalMaterial;
      material.emissive = new THREE.Color(this.getStatusColor(equipment.status));
    }

    // Update label
    this.updateEquipmentLabel(model, equipment);
  }

  private handleAnomalyAlert(anomaly: any): void {
    // Add to anomaly list
    this.recentAnomalies.unshift(anomaly);
    if (this.recentAnomalies.length > 10) {
      this.recentAnomalies.pop();
    }

    // Show notification
    const equipment = this.equipmentList.find(e => e.id === anomaly.equipmentId);
    if (equipment) {
      this.notificationService.showWarning(
        `Anomaly detected on ${equipment.name}: ${anomaly.description}`
      );

      // Highlight equipment in 3D view
      const model = this.equipmentModels.get(equipment.id);
      if (model) {
        this.highlightEquipment(model, '#ff0000');
      }
    }
  }

  private highlightEquipment(model: THREE.Object3D, color: string): void {
    // Create highlight effect
    const highlightMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color),
      transparent: true,
      opacity: 0.3
    });

    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const originalMaterial = mesh.material;
        mesh.material = highlightMaterial;

        // Restore original material after 3 seconds
        setTimeout(() => {
          mesh.material = originalMaterial;
        }, 3000);
      }
    });
  }

  private handleMaintenanceEvent(maintenance: any): void {
    // Add to upcoming maintenance
    this.upcomingMaintenance.push(maintenance);
    this.upcomingMaintenance.sort((a, b) =>
      new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()
    );

    // Update equipment status
    const equipment = this.equipmentList.find(e => e.id === maintenance.equipmentId);
    if (equipment && maintenance.type === 'scheduled') {
      // Show notification
      this.notificationService.showInfo(
        `Maintenance scheduled for ${equipment.name} on ${new Date(maintenance.scheduledDate).toLocaleDateString()}`
      );
    }
  }

  // Voice Commands
  private initializeVoiceCommands(): void {
    this.voiceCommandService.initialize();

    this.voiceCommandService.onCommand()
      .pipe(takeUntil(this.destroy$))
      .subscribe(command => {
        this.handleVoiceCommand(command);
      });

    this.voiceCommandService.onTranscript()
      .pipe(takeUntil(this.destroy$))
      .subscribe(transcript => {
        this.voiceTranscript = transcript;
      });
  }

  toggleVoiceCommands(): void {
    this.enableVoiceCommands = !this.enableVoiceCommands;

    if (this.enableVoiceCommands) {
      this.voiceCommandService.startListening();
      this.isListening = true;
      this.notificationService.showInfo('Voice commands activated');
    } else {
      this.voiceCommandService.stopListening();
      this.isListening = false;
      this.voiceTranscript = '';
    }
  }

  private handleVoiceCommand(command: any): void {
    console.log('Voice command:', command);

    switch (command.intent) {
      case 'show_equipment':
        if (command.parameters.type) {
          this.filterEquipmentByType(command.parameters.type);
        }
        break;

      case 'navigate':
        if (command.parameters.destination) {
          this.router.navigate([command.parameters.destination]);
        }
        break;

      case 'show_alerts':
        this.showAlertsPanel();
        break;

      case 'generate_report':
        this.generateReport(command.parameters.type || 'summary');
        break;

      case 'emergency_shutdown':
        this.confirmEmergencyShutdown();
        break;

      default:
        this.notificationService.showInfo(`Command not recognized: ${command.text}`);
    }
  }

  // UI Actions
  onSiteChange(siteId: string): void {
    this.selectedSiteId = siteId;
    this.currentSite = this.sites.find(s => s.id === siteId);
    this.loadDashboardData();
  }

  toggleFullscreen(): void {
    this.fullscreenMode = !this.fullscreenMode;

    if (this.fullscreenMode) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }

  resetCamera(): void {
    this.camera.position.set(100, 50, 100);
    this.camera.lookAt(0, 0, 0);
    this.controls.reset();
  }

  switchDashboardView(view: number): void {
    switch (view) {
      case 1:
        this.dashboardLayout = 'grid';
        break;
      case 2:
        this.dashboardLayout = 'focus';
        break;
      case 3:
        this.enable3DView = !this.enable3DView;
        break;
      case 4:
        this.showAdvancedFeatures = !this.showAdvancedFeatures;
        break;
    }
  }

  setPerformanceMode(mode: 'ultra' | 'high' | 'balanced' | 'eco'): void {
    this.performanceMode = mode;

    // Adjust rendering settings based on mode
    switch (mode) {
      case 'ultra':
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.enableAnimations = true;
        this.composer.passes.forEach(pass => pass.enabled = true);
        break;

      case 'eco':
        this.renderer.setPixelRatio(1);
        this.enableAnimations = false;
        this.composer.passes.forEach((pass, index) => {
          if (index > 0) pass.enabled = false;
        });
        break;

      default:
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.enableAnimations = true;
    }

    this.notificationService.showInfo(`Performance mode set to ${mode}`);
  }

  // Widget Management
  private getDefaultWidgets(): DashboardWidget[] {
    return [
      {
        id: 'metrics-overview',
        title: 'System Overview',
        type: 'metrics',
        position: { x: 0, y: 0 },
        size: { width: 4, height: 2 },
        config: {}
      },
      {
        id: 'equipment-status',
        title: 'Equipment Status',
        type: 'equipment-grid',
        position: { x: 4, y: 0 },
        size: { width: 4, height: 2 },
        config: {}
      },
      {
        id: 'power-flow',
        title: 'Power Flow Analysis',
        type: 'chart',
        position: { x: 8, y: 0 },
        size: { width: 4, height: 2 },
        config: { chartType: 'line' }
      },
      {
        id: '3d-view',
        title: 'Facility 3D View',
        type: '3d-scene',
        position: { x: 0, y: 2 },
        size: { width: 8, height: 4 },
        config: {}
      },
      {
        id: 'ai-insights',
        title: 'AI Insights',
        type: 'insights',
        position: { x: 8, y: 2 },
        size: { width: 4, height: 2 },
        config: {}
      },
      {
        id: 'weather',
        title: 'Weather Impact',
        type: 'weather',
        position: { x: 8, y: 4 },
        size: { width: 4, height: 2 },
        config: {}
      }
    ];
  }

  onWidgetDrop(event: CdkDragDrop<DashboardWidget[]>): void {
    moveItemInArray(this.widgets, event.previousIndex, event.currentIndex);
    this.saveDashboardLayout();
  }

  addWidget(type: string): void {
    const newWidget: DashboardWidget = {
      id: `widget-${Date.now()}`,
      title: 'New Widget',
      type: type,
      position: { x: 0, y: 0 },
      size: { width: 4, height: 2 },
      config: {}
    };

    this.widgets.push(newWidget);
    this.saveDashboardLayout();
  }

  removeWidget(widgetId: string): void {
    this.widgets = this.widgets.filter(w => w.id !== widgetId);
    this.saveDashboardLayout();
  }

  private saveDashboardLayout(): void {
    localStorage.setItem('dashboardLayout', JSON.stringify(this.widgets));
  }

  // Helper Methods
  private initializeMetrics(): DashboardMetrics {
    return {
      totalEquipment: 0,
      operationalCount: 0,
      warningCount: 0,
      criticalCount: 0,
      maintenanceCount: 0,
      availabilityRate: 0,
      mtbf: 0,
      mttr: 0,
      oee: 0,
      energyConsumption: 0,
      powerGeneration: 0,
      carbonFootprint: 0
    };
  }

  private generateProceduralFacility(): void {
    // Generate a basic facility layout procedurally
    const floorGeometry = new THREE.BoxGeometry(200, 1, 200);
    const floorMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x333333,
      metalness: 0.9,
      roughness: 0.1
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.position.y = -0.5;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Add walls
    const wallMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x666666,
      metalness: 0.7,
      roughness: 0.3
    });

    const wallPositions = [
      { x: 0, z: -100, rotation: 0 },
      { x: 0, z: 100, rotation: 0 },
      { x: -100, z: 0, rotation: Math.PI / 2 },
      { x: 100, z: 0, rotation: Math.PI / 2 }
    ];

    wallPositions.forEach(pos => {
      const wallGeometry = new THREE.BoxGeometry(200, 30, 2);
      const wall = new THREE.Mesh(wallGeometry, wallMaterial);
      wall.position.set(pos.x, 15, pos.z);
      wall.rotation.y = pos.rotation;
      wall.castShadow = true;
      wall.receiveShadow = true;
      this.scene.add(wall);
    });
  }

  private setupResponsiveLayout(): void {
    this.breakpointObserver.observe([
      '(max-width: 768px)',
      '(max-width: 1024px)',
      '(max-width: 1440px)'
    ]).pipe(takeUntil(this.destroy$))
      .subscribe(result => {
        if (result.matches) {
          if (result.breakpoints['(max-width: 768px)']) {
            this.dashboardLayout = 'focus';
          } else if (result.breakpoints['(max-width: 1024px)']) {
            this.enable3DView = false;
          }
        }
      });
  }

  private updateTheme(): void {
    if (this.scene) {
      this.scene.background = new THREE.Color(this.isDarkTheme ? 0x0a0a0a : 0xf0f0f0);
      this.scene.fog = new THREE.FogExp2(this.isDarkTheme ? 0x0a0a0a : 0xf0f0f0, 0.002);
    }
  }

  private updateCharts(): void {
    this.updatePowerFlowChart();
    this.updateHealthTrendChart();
    this.updateEnergyDistribution();
    this.cdr.detectChanges();
  }

  // Public action methods
  filterEquipmentByType(type: string): void {
    // Implementation for filtering equipment
    console.log('Filtering by type:', type);
  }

  showAlertsPanel(): void {
    // Implementation for showing alerts
    console.log('Showing alerts panel');
  }

  generateReport(type: string): void {
    // Implementation for report generation
    console.log('Generating report:', type);
  }

  confirmEmergencyShutdown(): void {
    // Implementation for emergency shutdown
    console.log('Emergency shutdown requested');
  }

  navigateToEquipment(equipmentId: number): void {
    this.router.navigate(['/equipment', equipmentId]);
  }

  openEquipmentDetails(equipment: Equipment): void {
    // Open detailed view dialog or navigate
    this.router.navigate(['/equipment', equipment.id]);
  }

  exportDashboard(): void {
    // Export dashboard data
    const exportData = {
      metrics: this.metrics,
      equipment: this.equipmentList,
      timestamp: new Date()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dashboard-export-${new Date().toISOString()}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  printDashboard(): void {
    window.print();
  }
}

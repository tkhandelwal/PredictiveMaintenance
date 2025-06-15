// src/app/services/voice-command.service.ts
import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

export interface VoiceCommand {
  transcript: string;
  confidence: number;
  intent: string;
  entities: any;
  action: string;
  parameters: any;
}

export interface CommandResult {
  success: boolean;
  message: string;
  data?: any;
  followUp?: string;
}

@Injectable({
  providedIn: 'root'
})
export class VoiceCommandService {
  private recognition: any;
  private isListening = false;
  private commandSubject = new Subject<VoiceCommand>();
  private resultSubject = new Subject<CommandResult>();

  public command$ = this.commandSubject.asObservable();
  public result$ = this.resultSubject.asObservable();

  private commands = new Map<RegExp, (matches: RegExpMatchArray) => void>();

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    this.initializeRecognition();
    this.registerCommands();
  }

  private initializeRecognition(): void {
    if ('webkitSpeechRecognition' in window) {
      this.recognition = new (window as any).webkitSpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';

      this.recognition.onresult = (event: any) => {
        const transcript = event.results[event.results.length - 1][0].transcript;
        const confidence = event.results[event.results.length - 1][0].confidence;

        if (event.results[event.results.length - 1].isFinal) {
          this.processCommand(transcript, confidence);
        }
      };

      this.recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        this.isListening = false;
      };

      this.recognition.onend = () => {
        this.isListening = false;
      };
    }
  }

  private registerCommands(): void {
    // Navigation commands
    this.commands.set(
      /(?:show|go to|open|navigate to) (?:the )?dashboard/i,
      () => this.navigateTo('/dashboard')
    );

    this.commands.set(
      /(?:show|go to|open) (?:the )?equipment (?:list)?/i,
      () => this.navigateTo('/equipment')
    );

    this.commands.set(
      /(?:show|go to|open) maintenance (?:schedule)?/i,
      () => this.navigateTo('/maintenance')
    );

    // Equipment commands
    this.commands.set(
      /(?:show|display|find) equipment (?:with )?status (\w+)/i,
      (matches) => this.filterEquipmentByStatus(matches[1])
    );

    this.commands.set(
      /(?:show|display) (?:details for|information about) equipment (?:number |#)?(\d+)/i,
      (matches) => this.showEquipmentDetails(parseInt(matches[1]))
    );

    // Analysis commands
    this.commands.set(
      /(?:analyze|check|show) energy (?:consumption|usage)/i,
      () => this.showEnergyAnalysis()
    );

    this.commands.set(
      /(?:show|display|what are) (?:the )?(?:current )?anomalies/i,
      () => this.showAnomalies()
    );

    this.commands.set(
      /predict failures (?:for )?(?:the )?next (\d+) (days?|weeks?|months?)/i,
      (matches) => this.predictFailures(parseInt(matches[1]), matches[2])
    );

    // Control commands
    this.commands.set(
      /(?:start|begin|initiate) simulation (?:for )?(?:equipment )?(?:number |#)?(\d+)/i,
      (matches) => this.startSimulation(parseInt(matches[1]))
    );

    this.commands.set(
      /(?:schedule|create|add) maintenance (?:for )?(?:equipment )?(?:number |#)?(\d+)/i,
      (matches) => this.scheduleMaintenance(parseInt(matches[1]))
    );

    // Report commands
    this.commands.set(
      /(?:generate|create|export) (?:a )?report (?:for )?(\w+)?/i,
      (matches) => this.generateReport(matches[1])
    );

    // System commands
    this.commands.set(
      /(?:enable|turn on|activate) dark mode/i,
      () => this.toggleDarkMode(true)
    );

    this.commands.set(
      /(?:disable|turn off|deactivate) dark mode/i,
      () => this.toggleDarkMode(false)
    );

    // Help command
    this.commands.set(
      /(?:help|what can you do|commands)/i,
      () => this.showHelp()
    );
  }

  startListening(): void {
    if (this.recognition && !this.isListening) {
      this.isListening = true;
      this.recognition.start();
    }
  }

  stopListening(): void {
    if (this.recognition && this.isListening) {
      this.isListening = false;
      this.recognition.stop();
    }
  }

  private processCommand(transcript: string, confidence: number): void {
    console.log('Processing command:', transcript, 'Confidence:', confidence);

    // Try to match command with registered patterns
    let matched = false;

    for (const [pattern, handler] of this.commands) {
      const matches = transcript.match(pattern);
      if (matches) {
        matched = true;
        handler(matches);

        this.commandSubject.next({
          transcript,
          confidence,
          intent: 'matched',
          entities: {},
          action: pattern.source,
          parameters: matches
        });

        break;
      }
    }

    if (!matched) {
      // Use NLP service for complex commands
      this.processWithNLP(transcript, confidence);
    }
  }

  private async processWithNLP(transcript: string, confidence: number): Promise<void> {
    try {
      // In production, this would call an NLP service like Dialogflow or Luis
      const nlpResult = await this.analyzeIntent(transcript);

      this.commandSubject.next({
        transcript,
        confidence,
        intent: nlpResult.intent,
        entities: nlpResult.entities,
        action: nlpResult.action,
        parameters: nlpResult.parameters
      });

      // Execute the interpreted command
      this.executeNLPCommand(nlpResult);
    } catch (error) {
      this.resultSubject.next({
        success: false,
        message: 'Sorry, I didn\'t understand that command. Try saying "help" for available commands.'
      });
    }
  }

  private analyzeIntent(transcript: string): any {
    // Simplified intent analysis
    // In production, use a proper NLP service

    const lowercaseTranscript = transcript.toLowerCase();

    // Equipment-related intents
    if (lowercaseTranscript.includes('equipment') || lowercaseTranscript.includes('motor') ||
      lowercaseTranscript.includes('transformer')) {

      if (lowercaseTranscript.includes('failing') || lowercaseTranscript.includes('problem')) {
        return {
          intent: 'find_problematic_equipment',
          entities: { status: 'critical' },
          action: 'filter_equipment',
          parameters: { status: 'critical' }
        };
      }

      if (lowercaseTranscript.includes('efficient') || lowercaseTranscript.includes('performing')) {
        return {
          intent: 'analyze_equipment_performance',
          entities: {},
          action: 'show_performance',
          parameters: {}
        };
      }
    }

    // Energy-related intents
    if (lowercaseTranscript.includes('energy') || lowercaseTranscript.includes('power')) {
      if (lowercaseTranscript.includes('save') || lowercaseTranscript.includes('optimize')) {
        return {
          intent: 'optimize_energy',
          entities: {},
          action: 'show_optimization',
          parameters: {}
        };
      }
    }

    // Default
    return {
      intent: 'unknown',
      entities: {},
      action: 'search',
      parameters: { query: transcript }
    };
  }

  private executeNLPCommand(nlpResult: any): void {
    switch (nlpResult.action) {
      case 'filter_equipment':
        this.filterEquipmentByStatus(nlpResult.parameters.status);
        break;

      case 'show_performance':
        this.showPerformanceAnalysis();
        break;

      case 'show_optimization':
        this.showEnergyOptimization();
        break;

      case 'search':
        this.performSearch(nlpResult.parameters.query);
        break;

      default:
        this.resultSubject.next({
          success: false,
          message: 'I understood your request but I\'m not sure how to help with that yet.'
        });
    }
  }

  // Command implementations
  private navigateTo(path: string): void {
    this.router.navigate([path]);
    this.resultSubject.next({
      success: true,
      message: `Navigating to ${path}`
    });
  }

  private filterEquipmentByStatus(status: string): void {
    this.router.navigate(['/equipment'], { queryParams: { status: status.toLowerCase() } });
    this.resultSubject.next({
      success: true,
      message: `Showing equipment with ${status} status`
    });
  }

  private showEquipmentDetails(equipmentId: number): void {
    this.router.navigate(['/equipment', equipmentId]);
    this.resultSubject.next({
      success: true,
      message: `Showing details for equipment ${equipmentId}`
    });
  }

  private showEnergyAnalysis(): void {
    this.router.navigate(['/dashboard'], { fragment: 'energy-analysis' });
    this.resultSubject.next({
      success: true,
      message: 'Displaying energy consumption analysis'
    });
  }

  private showAnomalies(): void {
    this.router.navigate(['/dashboard'], { fragment: 'anomalies' });
    this.resultSubject.next({
      success: true,
      message: 'Showing current anomalies'
    });
  }

  private predictFailures(duration: number, unit: string): void {
    // Trigger failure prediction
    this.http.post(`${environment.apiUrl}/api/ai/predict-failures`, {
      duration,
      unit
    }).subscribe(result => {
      this.resultSubject.next({
        success: true,
        message: `Analyzing failure predictions for the next ${duration} ${unit}`,
        data: result
      });
    });
  }

  private startSimulation(equipmentId: number): void {
    this.router.navigate(['/admin/simulation'], {
      queryParams: { equipmentId, autoStart: true }
    });
    this.resultSubject.next({
      success: true,
      message: `Starting simulation for equipment ${equipmentId}`
    });
  }

  private scheduleMaintenance(equipmentId: number): void {
    this.resultSubject.next({
      success: true,
      message: `Opening maintenance scheduler for equipment ${equipmentId}`,
      followUp: 'What type of maintenance would you like to schedule?'
    });
  }

  private generateReport(reportType: string): void {
    const type = reportType || 'summary';
    this.resultSubject.next({
      success: true,
      message: `Generating ${type} report. This may take a few moments...`
    });

    // Trigger report generation
    setTimeout(() => {
      this.resultSubject.next({
        success: true,
        message: `${type} report has been generated and is ready for download`,
        data: { downloadUrl: '/reports/latest' }
      });
    }, 3000);
  }

  private toggleDarkMode(enable: boolean): void {
    // This would integrate with your theme service
    document.body.classList.toggle('dark-theme', enable);
    this.resultSubject.next({
      success: true,
      message: `Dark mode ${enable ? 'enabled' : 'disabled'}`
    });
  }

  private showHelp(): void {
    const helpMessage = `
    Available voice commands:
    
    Navigation:
    - "Show dashboard"
    - "Go to equipment"
    - "Open maintenance schedule"
    
    Equipment:
    - "Show equipment with status [operational/warning/critical]"
    - "Show details for equipment [number]"
    
    Analysis:
    - "Analyze energy consumption"
    - "Show current anomalies"
    - "Predict failures for next [number] [days/weeks]"
    
    Control:
    - "Start simulation for equipment [number]"
    - "Schedule maintenance for equipment [number]"
    
    Reports:
    - "Generate report"
    - "Create energy report"
    
    System:
    - "Enable/Disable dark mode"
    `;

    this.resultSubject.next({
      success: true,
      message: helpMessage
    });
  }

  private showPerformanceAnalysis(): void {
    this.router.navigate(['/dashboard'], { fragment: 'performance' });
    this.resultSubject.next({
      success: true,
      message: 'Analyzing equipment performance metrics'
    });
  }

  private showEnergyOptimization(): void {
    this.router.navigate(['/dashboard'], { fragment: 'energy-optimization' });
    this.resultSubject.next({
      success: true,
      message: 'Showing energy optimization opportunities'
    });
  }

  private performSearch(query: string): void {
    this.router.navigate(['/search'], { queryParams: { q: query } });
    this.resultSubject.next({
      success: true,
      message: `Searching for: ${query}`
    });
  }

  // Text-to-speech for responses
  speak(text: string): void {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = 0.8;

      // Select a natural-sounding voice
      const voices = speechSynthesis.getVoices();
      const preferredVoice = voices.find(voice =>
        voice.name.includes('Google') || voice.name.includes('Microsoft')
      );

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      speechSynthesis.speak(utterance);
    }
  }

  // Get command suggestions based on context
  getSuggestions(partialCommand: string): string[] {
    const suggestions: string[] = [];
    const partial = partialCommand.toLowerCase();

    const allCommands = [
      'show dashboard',
      'go to equipment',
      'open maintenance schedule',
      'show equipment with status operational',
      'show equipment with status warning',
      'show equipment with status critical',
      'analyze energy consumption',
      'show current anomalies',
      'predict failures for next 7 days',
      'generate report',
      'enable dark mode',
      'help'
    ];

    return allCommands.filter(cmd => cmd.includes(partial));
  }
}

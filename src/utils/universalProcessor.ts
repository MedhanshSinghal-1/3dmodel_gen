/**
 * UniversalProcessor - Multi-format blueprint processing
 * 
 * This module coordinates the entire processing pipeline:
 * - Multi-format input handling (PDF, DWG, DXF, images)
 * - Integration of all analysis components
 * - Progressive processing with real-time feedback
 * - Error handling and recovery mechanisms
 * - Caching and optimization
 */

import BlueprintAnalyzer, { BlueprintType, InputFormat, AnalysisResult } from './blueprintAnalyzer';
import TextFilterEngine, { FilterResult, FilterOptions } from './textFilterEngine';
import LineClassifier, { ClassificationResult, Line, LineType } from './lineClassifier';
import FloorPlanAnalyzer from './computerVision';

export interface ProcessingInput {
  data: string | File;
  format?: InputFormat;
  name?: string;
}

export interface ProcessingOptions {
  enableTextFiltering: boolean;
  enableLineClassification: boolean;
  enableOCR: boolean;
  preserveDimensions: boolean;
  autoDetectScale: boolean;
  generatePreview: boolean;
  debugMode: boolean;
  progressCallback?: (stage: string, progress: number, details?: string) => void;
}

export interface ProcessingStage {
  name: string;
  description: string;
  progress: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  error?: string;
  duration?: number;
}

export interface ProcessedBlueprint {
  // Original data
  originalInput: ProcessingInput;
  
  // Analysis results
  blueprintAnalysis: AnalysisResult;
  textFilterResult?: FilterResult;
  lineClassificationResult?: ClassificationResult;
  
  // Processed data for 3D generation
  rooms: Room[];
  walls: Wall[];
  doors: Door[];
  windows: Window[];
  
  // Metadata
  processingTime: number;
  confidence: number;
  stages: ProcessingStage[];
  warnings: string[];
  errors: string[];
  
  // Preview images
  originalImage?: string;
  processedImage?: string;
  annotatedImage?: string;
}

export interface Room {
  id: string;
  name: string;
  type: string;
  color: string;
  vertices: Array<[number, number]>;
  center: [number, number];
  area: number;
  confidence: number;
}

export interface Wall {
  id: string;
  startPoint: [number, number];
  endPoint: [number, number];
  thickness: number;
  height: number;
  type: string;
  confidence: number;
}

export interface Door {
  id: string;
  position: [number, number];
  width: number;
  angle: number;
  type: string;
  confidence: number;
}

export interface Window {
  id: string;
  position: [number, number];
  width: number;
  height: number;
  angle: number;
  type: string;
  confidence: number;
}

/**
 * Universal Blueprint Processor
 */
export class UniversalProcessor {
  private blueprintAnalyzer: BlueprintAnalyzer;
  private textFilterEngine: TextFilterEngine;
  private lineClassifier: LineClassifier;
  private floorPlanAnalyzer: FloorPlanAnalyzer;
  
  private isInitialized: boolean = false;
  private cache: Map<string, ProcessedBlueprint> = new Map();

  constructor() {
    this.blueprintAnalyzer = new BlueprintAnalyzer();
    this.textFilterEngine = new TextFilterEngine();
    this.lineClassifier = new LineClassifier();
    this.floorPlanAnalyzer = new FloorPlanAnalyzer();
  }

  /**
   * Initialize all processing components
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await Promise.all([
        this.textFilterEngine.initialize(),
        this.lineClassifier.initialize()
      ]);
      
      this.isInitialized = true;
      console.log('Universal processor initialized successfully');
    } catch (error) {
      console.error('Failed to initialize universal processor:', error);
      throw new Error('Processor initialization failed');
    }
  }

  /**
   * Main processing function
   */
  async process(
    input: ProcessingInput, 
    options: Partial<ProcessingOptions> = {}
  ): Promise<ProcessedBlueprint> {
    const startTime = Date.now();
    
    const opts: ProcessingOptions = {
      enableTextFiltering: true,
      enableLineClassification: true,
      enableOCR: true,
      preserveDimensions: false,
      autoDetectScale: true,
      generatePreview: true,
      debugMode: false,
      ...options
    };

    // Initialize stages
    const stages: ProcessingStage[] = this.initializeStages(opts);
    
    // Check cache first
    const cacheKey = this.generateCacheKey(input, opts);
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      opts.progressCallback?.('cache', 100, 'Using cached result');
      return cached;
    }

    const result: ProcessedBlueprint = {
      originalInput: input,
      blueprintAnalysis: { metadata: { type: BlueprintType.UNKNOWN, format: InputFormat.IMAGE_PNG, confidence: 0 } },
      rooms: [],
      walls: [],
      doors: [],
      windows: [],
      processingTime: 0,
      confidence: 0,
      stages,
      warnings: [],
      errors: []
    };

    try {
      // Ensure initialized
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Stage 1: Blueprint Analysis
      await this.executeStage(stages, 'blueprint_analysis', async () => {
        opts.progressCallback?.('blueprint_analysis', 0, 'Analyzing blueprint type and format...');
        result.blueprintAnalysis = await this.blueprintAnalyzer.analyze(input.data, input.format);
        opts.progressCallback?.('blueprint_analysis', 100, `Detected: ${result.blueprintAnalysis.metadata.type}`);
      });

      // Stage 2: Text Filtering (if enabled)
      if (opts.enableTextFiltering && result.blueprintAnalysis.processedImage) {
        await this.executeStage(stages, 'text_filtering', async () => {
          opts.progressCallback?.('text_filtering', 0, 'Detecting and filtering text...');
          
          const filterOptions: Partial<FilterOptions> = {
            enableOCR: opts.enableOCR,
            removeText: true,
            preserveDimensions: opts.preserveDimensions,
            debugMode: opts.debugMode
          };
          
          result.textFilterResult = await this.textFilterEngine.filterText(
            result.blueprintAnalysis.processedImage,
            filterOptions
          );
          
          opts.progressCallback?.('text_filtering', 100, 
            `Filtered ${result.textFilterResult.textRegions.length} text regions`);
        });
      }

      // Stage 3: Line Classification (if enabled)
      if (opts.enableLineClassification) {
        await this.executeStage(stages, 'line_classification', async () => {
          opts.progressCallback?.('line_classification', 0, 'Classifying structural lines...');
          
          const imageForClassification = result.textFilterResult?.cleanedImage || 
                                       result.blueprintAnalysis.processedImage ||
                                       await this.convertInputToImageData(input.data);
          
          result.lineClassificationResult = await this.lineClassifier.classifyLines(
            imageForClassification,
            [],
            { debugMode: opts.debugMode }
          );
          
          opts.progressCallback?.('line_classification', 100, 
            `Classified ${result.lineClassificationResult.lines.length} lines`);
        });
      }

      // Stage 4: 3D Structure Generation
      await this.executeStage(stages, 'structure_generation', async () => {
        opts.progressCallback?.('structure_generation', 0, 'Generating 3D structure...');
        
        const imageForGeneration = result.textFilterResult?.cleanedImage || 
                                  result.blueprintAnalysis.processedImage ||
                                  await this.convertInputToImageData(input.data);
        
        const cvResult = await this.floorPlanAnalyzer.processFloorPlan(
          this.imageDataToDataURL(imageForGeneration),
          (step, progress) => {
            opts.progressCallback?.('structure_generation', progress * 0.8, step);
          }
        );
        
        // Convert CV results to universal format
        result.rooms = this.convertRooms(cvResult.rooms);
        result.walls = this.convertWalls(cvResult.walls, result.lineClassificationResult);
        result.doors = this.extractDoors(cvResult, result.lineClassificationResult);
        result.windows = this.extractWindows(cvResult, result.lineClassificationResult);
        
        opts.progressCallback?.('structure_generation', 100, 
          `Generated ${result.rooms.length} rooms, ${result.walls.length} walls`);
      });

      // Stage 5: Quality Assessment
      await this.executeStage(stages, 'quality_assessment', async () => {
        opts.progressCallback?.('quality_assessment', 0, 'Assessing result quality...');
        
        result.confidence = this.calculateOverallConfidence(result);
        result.warnings = this.generateWarnings(result);
        
        opts.progressCallback?.('quality_assessment', 100, 
          `Quality assessment complete (${Math.round(result.confidence * 100)}% confidence)`);
      });

      // Stage 6: Preview Generation (if enabled)
      if (opts.generatePreview) {
        await this.executeStage(stages, 'preview_generation', async () => {
          opts.progressCallback?.('preview_generation', 0, 'Generating preview images...');
          
          result.originalImage = await this.generateOriginalPreview(input.data);
          result.processedImage = result.textFilterResult?.cleanedImage ? 
            this.imageDataToDataURL(result.textFilterResult.cleanedImage) : 
            result.originalImage;
          result.annotatedImage = await this.generateAnnotatedPreview(result);
          
          opts.progressCallback?.('preview_generation', 100, 'Preview images generated');
        });
      }

      // Finalize
      result.processingTime = Date.now() - startTime;
      
      // Cache the result
      this.cache.set(cacheKey, result);
      
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown processing error';
      result.errors.push(errorMessage);
      result.processingTime = Date.now() - startTime;
      
      console.error('Processing failed:', error);
      
      // Mark current stage as error
      const currentStage = stages.find(s => s.status === 'processing');
      if (currentStage) {
        currentStage.status = 'error';
        currentStage.error = errorMessage;
      }
      
      return result;
    }
  }

  /**
   * Initialize processing stages
   */
  private initializeStages(options: ProcessingOptions): ProcessingStage[] {
    const stages: ProcessingStage[] = [
      {
        name: 'blueprint_analysis',
        description: 'Analyzing blueprint type and format',
        progress: 0,
        status: 'pending'
      },
      {
        name: 'structure_generation',
        description: 'Generating 3D structure from blueprint',
        progress: 0,
        status: 'pending'
      },
      {
        name: 'quality_assessment',
        description: 'Assessing result quality',
        progress: 0,
        status: 'pending'
      }
    ];

    if (options.enableTextFiltering) {
      stages.splice(1, 0, {
        name: 'text_filtering',
        description: 'Detecting and filtering text elements',
        progress: 0,
        status: 'pending'
      });
    }

    if (options.enableLineClassification) {
      stages.splice(options.enableTextFiltering ? 2 : 1, 0, {
        name: 'line_classification',
        description: 'Classifying structural lines',
        progress: 0,
        status: 'pending'
      });
    }

    if (options.generatePreview) {
      stages.push({
        name: 'preview_generation',
        description: 'Generating preview images',
        progress: 0,
        status: 'pending'
      });
    }

    return stages;
  }

  /**
   * Execute a processing stage with error handling
   */
  private async executeStage(
    stages: ProcessingStage[], 
    stageName: string, 
    execution: () => Promise<void>
  ): Promise<void> {
    const stage = stages.find(s => s.name === stageName);
    if (!stage) return;

    const startTime = Date.now();
    stage.status = 'processing';
    
    try {
      await execution();
      stage.status = 'completed';
      stage.progress = 100;
    } catch (error) {
      stage.status = 'error';
      stage.error = error instanceof Error ? error.message : 'Unknown error';
      throw error;
    } finally {
      stage.duration = Date.now() - startTime;
    }
  }

  /**
   * Convert input to ImageData
   */
  private async convertInputToImageData(input: string | File): Promise<ImageData> {
    if (typeof input === 'string') {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d')!;
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          resolve(ctx.getImageData(0, 0, img.width, img.height));
        };
        img.onerror = reject;
        img.src = input;
      });
    } else {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d')!;
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            resolve(ctx.getImageData(0, 0, img.width, img.height));
          };
          img.src = e.target?.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(input);
      });
    }
  }

  /**
   * Convert ImageData to data URL
   */
  private imageDataToDataURL(imageData: ImageData): string {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL();
  }

  /**
   * Convert CV rooms to universal format
   */
  private convertRooms(cvRooms: any[]): Room[] {
    return cvRooms.map((room, index) => ({
      id: room.id || `room_${index}`,
      name: room.name || `Room ${index + 1}`,
      type: room.type || 'unknown',
      color: room.color || '#e3f2fd',
      vertices: room.vertices || [],
      center: room.center || [0, 0],
      area: room.area || 0,
      confidence: 0.8
    }));
  }

  /**
   * Convert CV walls to universal format
   */
  private convertWalls(cvWalls: any[], lineClassification?: ClassificationResult): Wall[] {
    const walls: Wall[] = [];
    
    for (let i = 0; i < cvWalls.length; i++) {
      const wall = cvWalls[i];
      
      // Find corresponding classified line
      const classifiedLine = lineClassification?.lines.find(line => 
        line.type === LineType.WALL && 
        this.isLineNearWall(line, wall)
      );
      
      walls.push({
        id: `wall_${i}`,
        startPoint: wall[0] || [0, 0],
        endPoint: wall[1] || [0, 0],
        thickness: classifiedLine?.thickness || 4,
        height: 2.4, // Default ceiling height in meters
        type: 'interior',
        confidence: classifiedLine?.confidence || 0.7
      });
    }
    
    return walls;
  }

  /**
   * Check if a classified line corresponds to a CV-detected wall
   */
  private isLineNearWall(line: Line, wall: any): boolean {
    if (!wall[0] || !wall[1]) return false;
    
    const tolerance = 20; // pixels
    const dist1 = Math.sqrt((line.startPoint.x - wall[0][0]) ** 2 + (line.startPoint.y - wall[0][1]) ** 2);
    const dist2 = Math.sqrt((line.endPoint.x - wall[1][0]) ** 2 + (line.endPoint.y - wall[1][1]) ** 2);
    
    return dist1 < tolerance && dist2 < tolerance;
  }

  /**
   * Extract doors from processing results
   */
  private extractDoors(cvResult: any, lineClassification?: ClassificationResult): Door[] {
    // For now, return empty array - door detection would be implemented here
    return [];
  }

  /**
   * Extract windows from processing results
   */
  private extractWindows(cvResult: any, lineClassification?: ClassificationResult): Window[] {
    // For now, return empty array - window detection would be implemented here
    return [];
  }

  /**
   * Calculate overall confidence score
   */
  private calculateOverallConfidence(result: ProcessedBlueprint): number {
    let totalConfidence = 0;
    let components = 0;
    
    if (result.blueprintAnalysis.metadata.confidence !== undefined) {
      totalConfidence += result.blueprintAnalysis.metadata.confidence;
      components++;
    }
    
    if (result.textFilterResult) {
      totalConfidence += result.textFilterResult.confidence;
      components++;
    }
    
    if (result.lineClassificationResult) {
      totalConfidence += result.lineClassificationResult.confidence;
      components++;
    }
    
    if (result.rooms.length > 0) {
      const avgRoomConfidence = result.rooms.reduce((sum, room) => sum + room.confidence, 0) / result.rooms.length;
      totalConfidence += avgRoomConfidence;
      components++;
    }
    
    return components > 0 ? totalConfidence / components : 0;
  }

  /**
   * Generate warnings based on processing results
   */
  private generateWarnings(result: ProcessedBlueprint): string[] {
    const warnings: string[] = [];
    
    if (result.confidence < 0.5) {
      warnings.push('Low confidence in processing results. Manual review recommended.');
    }
    
    if (result.rooms.length === 0) {
      warnings.push('No rooms were detected in the blueprint.');
    }
    
    if (result.walls.length === 0) {
      warnings.push('No walls were detected in the blueprint.');
    }
    
    if (result.textFilterResult && result.textFilterResult.textRegions.length > 50) {
      warnings.push('High amount of text detected. Some structural lines may have been filtered.');
    }
    
    if (result.blueprintAnalysis.metadata.type === BlueprintType.UNKNOWN) {
      warnings.push('Blueprint type could not be determined automatically.');
    }
    
    return warnings;
  }

  /**
   * Generate original preview image
   */
  private async generateOriginalPreview(input: string | File): Promise<string> {
    if (typeof input === 'string') {
      return input;
    } else {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(input);
      });
    }
  }

  /**
   * Generate annotated preview image
   */
  private async generateAnnotatedPreview(result: ProcessedBlueprint): Promise<string> {
    // Create a canvas with annotations showing detected elements
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    
    // For now, return the processed image
    return result.processedImage || result.originalImage || '';
  }

  /**
   * Generate cache key for processing results
   */
  private generateCacheKey(input: ProcessingInput, options: ProcessingOptions): string {
    const optionsStr = JSON.stringify(options);
    const inputStr = typeof input.data === 'string' ? input.data.slice(0, 100) : input.data.name;
    return btoa(inputStr + optionsStr).slice(0, 32);
  }

  /**
   * Clear processing cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get supported input formats
   */
  static getSupportedFormats(): InputFormat[] {
    return BlueprintAnalyzer.getSupportedFormats();
  }

  /**
   * Get blueprint type descriptions
   */
  static getBlueprintTypes(): Record<BlueprintType, string> {
    return BlueprintAnalyzer.getBlueprintTypeDescriptions();
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await Promise.all([
      this.textFilterEngine.cleanup(),
      this.lineClassifier.cleanup()
    ]);
    
    this.clearCache();
    this.isInitialized = false;
  }
}

export default UniversalProcessor;
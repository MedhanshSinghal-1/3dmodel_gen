/**
 * ScaleCalibrator - Automatic scale detection and measurement
 * 
 * This module provides comprehensive scale detection and calibration capabilities:
 * - Automatic scale detection from blueprints
 * - Measurement extraction and validation
 * - Reference point identification
 * - Unit conversion and standardization
 * - Scale bar recognition and analysis
 */

export enum Unit {
  MILLIMETER = 'mm',
  CENTIMETER = 'cm',
  METER = 'm',
  INCH = 'in',
  FOOT = 'ft',
  YARD = 'yd'
}

export enum ScaleType {
  ARCHITECTURAL = 'architectural',  // 1:50, 1:100, etc.
  ENGINEERING = 'engineering',     // 1:20, 1:40, etc.
  METRIC = 'metric',               // 1:500, 1:1000, etc.
  IMPERIAL = 'imperial',           // 1/4"=1', 1/8"=1', etc.
  CUSTOM = 'custom'                // User-defined scale
}

export interface ScaleReference {
  id: string;
  type: 'scale_bar' | 'dimension' | 'grid' | 'known_object';
  pixelLength: number;
  realLength: number;
  unit: Unit;
  confidence: number;
  position: Point;
  orientation: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Dimension {
  id: string;
  value: number;
  unit: Unit;
  pixelLength: number;
  startPoint: Point;
  endPoint: Point;
  textPosition: Point;
  confidence: number;
  orientation: 'horizontal' | 'vertical' | 'diagonal';
}

export interface Scale {
  ratio: number;           // pixels per unit
  unit: Unit;
  type: ScaleType;
  confidence: number;
  references: ScaleReference[];
  standardScale?: string;  // e.g., "1:50", "1/4\"=1'"
}

export interface CalibrationResult {
  detectedScale: Scale | null;
  possibleScales: Scale[];
  dimensions: Dimension[];
  scaleReferences: ScaleReference[];
  gridSpacing?: number;
  confidence: number;
  warnings: string[];
  errors: string[];
  processingTime: number;
}

export interface CalibrationOptions {
  enableOCR: boolean;
  searchForScaleBars: boolean;
  searchForDimensions: boolean;
  searchForGrids: boolean;
  enableKnownObjects: boolean;
  expectedUnit?: Unit;
  expectedScaleType?: ScaleType;
  minConfidence: number;
  debugMode: boolean;
}

/**
 * Scale Calibrator for automatic measurement and scale detection
 */
export class ScaleCalibrator {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  // Common architectural scales (ratio format)
  private readonly ARCHITECTURAL_SCALES = [
    { scale: '1:20', ratio: 20 },
    { scale: '1:50', ratio: 50 },
    { scale: '1:100', ratio: 100 },
    { scale: '1:200', ratio: 200 },
    { scale: '1:500', ratio: 500 }
  ];

  // Common imperial scales
  private readonly IMPERIAL_SCALES = [
    { scale: '1/4"=1\'', ratio: 48 },    // 1/4 inch = 1 foot
    { scale: '1/8"=1\'', ratio: 96 },    // 1/8 inch = 1 foot
    { scale: '3/16"=1\'', ratio: 64 },   // 3/16 inch = 1 foot
    { scale: '1/2"=1\'', ratio: 24 },    // 1/2 inch = 1 foot
    { scale: '1"=1\'', ratio: 12 }       // 1 inch = 1 foot
  ];

  // Unit conversion factors to meters
  private readonly UNIT_TO_METERS = {
    [Unit.MILLIMETER]: 0.001,
    [Unit.CENTIMETER]: 0.01,
    [Unit.METER]: 1.0,
    [Unit.INCH]: 0.0254,
    [Unit.FOOT]: 0.3048,
    [Unit.YARD]: 0.9144
  };

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
  }

  /**
   * Main calibration function
   */
  async calibrate(
    imageData: ImageData, 
    textRegions: any[] = [], 
    options: Partial<CalibrationOptions> = {}
  ): Promise<CalibrationResult> {
    const startTime = Date.now();
    
    const opts: CalibrationOptions = {
      enableOCR: false, // Use provided text regions instead
      searchForScaleBars: true,
      searchForDimensions: true,
      searchForGrids: true,
      enableKnownObjects: false,
      minConfidence: 0.5,
      debugMode: false,
      ...options
    };

    const result: CalibrationResult = {
      detectedScale: null,
      possibleScales: [],
      dimensions: [],
      scaleReferences: [],
      confidence: 0,
      warnings: [],
      errors: [],
      processingTime: 0
    };

    try {
      // Search for scale bars
      if (opts.searchForScaleBars) {
        const scaleBars = await this.detectScaleBars(imageData, textRegions);
        result.scaleReferences.push(...scaleBars);
      }

      // Search for dimensions
      if (opts.searchForDimensions) {
        const dimensions = await this.detectDimensions(imageData, textRegions);
        result.dimensions = dimensions;
        
        // Convert dimensions to scale references
        const dimensionRefs = this.dimensionsToScaleReferences(dimensions);
        result.scaleReferences.push(...dimensionRefs);
      }

      // Search for grid patterns
      if (opts.searchForGrids) {
        const gridRefs = await this.detectGridReferences(imageData);
        result.scaleReferences.push(...gridRefs);
        
        if (gridRefs.length > 0) {
          result.gridSpacing = this.calculateGridSpacing(gridRefs);
        }
      }

      // Search for known objects (future implementation)
      if (opts.enableKnownObjects) {
        const objectRefs = await this.detectKnownObjects(imageData);
        result.scaleReferences.push(...objectRefs);
      }

      // Calculate possible scales from references
      result.possibleScales = this.calculatePossibleScales(result.scaleReferences, opts);

      // Select best scale
      if (result.possibleScales.length > 0) {
        result.detectedScale = this.selectBestScale(result.possibleScales, opts);
        result.confidence = result.detectedScale.confidence;
      }

      // Generate warnings
      result.warnings = this.generateWarnings(result, opts);

      result.processingTime = Date.now() - startTime;
      
      return result;

    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown calibration error');
      result.processingTime = Date.now() - startTime;
      return result;
    }
  }

  /**
   * Detect scale bars in the image
   */
  private async detectScaleBars(imageData: ImageData, textRegions: any[]): Promise<ScaleReference[]> {
    const scaleRefs: ScaleReference[] = [];
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    // Look for horizontal lines that could be scale bars
    const horizontalLines = this.findHorizontalLines(data, width, height);
    
    for (const line of horizontalLines) {
      // Check if there's text near this line that indicates scale
      const nearbyText = this.findNearbyText(line, textRegions, 30);
      
      for (const text of nearbyText) {
        const scaleInfo = this.parseScaleText(text.text);
        if (scaleInfo) {
          const scaleRef: ScaleReference = {
            id: `scale_bar_${scaleRefs.length}`,
            type: 'scale_bar',
            pixelLength: line.length,
            realLength: scaleInfo.length,
            unit: scaleInfo.unit,
            confidence: scaleInfo.confidence,
            position: { x: line.startX, y: line.y },
            orientation: 0
          };
          
          scaleRefs.push(scaleRef);
        }
      }
    }

    return scaleRefs;
  }

  /**
   * Find horizontal lines that could be scale bars
   */
  private findHorizontalLines(data: Uint8ClampedArray, width: number, height: number): any[] {
    const lines = [];
    const threshold = 100;
    
    for (let y = 0; y < height; y += 5) {
      let lineStart = -1;
      let lineLength = 0;
      
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const intensity = data[idx];
        
        if (intensity < threshold) { // Dark pixel (potential line)
          if (lineStart === -1) {
            lineStart = x;
          }
          lineLength++;
        } else { // Light pixel
          if (lineStart !== -1 && lineLength > 20) {
            lines.push({
              startX: lineStart,
              endX: x - 1,
              y: y,
              length: lineLength
            });
          }
          lineStart = -1;
          lineLength = 0;
        }
      }
      
      // Check end of row
      if (lineStart !== -1 && lineLength > 20) {
        lines.push({
          startX: lineStart,
          endX: width - 1,
          y: y,
          length: lineLength
        });
      }
    }
    
    return lines.filter(line => line.length > 50 && line.length < 500); // Reasonable scale bar lengths
  }

  /**
   * Find text near a line
   */
  private findNearbyText(line: any, textRegions: any[], radius: number): any[] {
    const nearbyText = [];
    
    for (const text of textRegions) {
      const textCenter = {
        x: text.bbox.x + text.bbox.width / 2,
        y: text.bbox.y + text.bbox.height / 2
      };
      
      const lineCenter = {
        x: (line.startX + line.endX) / 2,
        y: line.y
      };
      
      const distance = Math.sqrt(
        (textCenter.x - lineCenter.x) ** 2 + 
        (textCenter.y - lineCenter.y) ** 2
      );
      
      if (distance <= radius) {
        nearbyText.push(text);
      }
    }
    
    return nearbyText;
  }

  /**
   * Parse scale information from text
   */
  private parseScaleText(text: string): { length: number; unit: Unit; confidence: number } | null {
    const cleanText = text.trim().toLowerCase();
    
    // Common scale patterns
    const patterns = [
      // "5m", "10 ft", "2.5 meters"
      /(\d+(?:\.\d+)?)\s*(m|meters?|ft|feet|in|inches?|cm|centimeters?|mm|millimeters?)/,
      // "5'-0"", "10'", "6""
      /(\d+)['′]\s*(?:(\d+)["″])?/,
      // "1000mm", "50cm"
      /(\d+)\s*(mm|cm)/
    ];
    
    for (const pattern of patterns) {
      const match = cleanText.match(pattern);
      if (match) {
        let length = parseFloat(match[1]);
        let unit = this.parseUnit(match[2] || '');
        let confidence = 0.8;
        
        // Handle feet and inches
        if (match[2] && match[2].includes("'") && match[3]) {
          length = length + parseFloat(match[3]) / 12; // Convert inches to feet
          unit = Unit.FOOT;
        }
        
        if (length > 0 && unit !== null) {
          return { length, unit, confidence };
        }
      }
    }
    
    return null;
  }

  /**
   * Parse unit string to Unit enum
   */
  private parseUnit(unitStr: string): Unit {
    const clean = unitStr.toLowerCase().trim();
    
    if (clean.includes('mm') || clean.includes('millimeter')) return Unit.MILLIMETER;
    if (clean.includes('cm') || clean.includes('centimeter')) return Unit.CENTIMETER;
    if (clean.includes('m') || clean.includes('meter')) return Unit.METER;
    if (clean.includes('in') || clean.includes('inch') || clean.includes('"')) return Unit.INCH;
    if (clean.includes('ft') || clean.includes('feet') || clean.includes("'")) return Unit.FOOT;
    if (clean.includes('yd') || clean.includes('yard')) return Unit.YARD;
    
    return Unit.METER; // Default
  }

  /**
   * Detect dimensions in the image
   */
  private async detectDimensions(imageData: ImageData, textRegions: any[]): Promise<Dimension[]> {
    const dimensions: Dimension[] = [];
    
    // Look for text that appears to be dimension values
    for (const text of textRegions) {
      if (text.isDimension) {
        const dimensionInfo = this.parseScaleText(text.text);
        if (dimensionInfo) {
          // Try to find associated dimension lines
          const associatedLine = this.findDimensionLine(text, imageData);
          
          if (associatedLine) {
            const dimension: Dimension = {
              id: `dim_${dimensions.length}`,
              value: dimensionInfo.length,
              unit: dimensionInfo.unit,
              pixelLength: associatedLine.length,
              startPoint: associatedLine.start,
              endPoint: associatedLine.end,
              textPosition: { x: text.bbox.x, y: text.bbox.y },
              confidence: dimensionInfo.confidence,
              orientation: this.getDimensionOrientation(associatedLine)
            };
            
            dimensions.push(dimension);
          }
        }
      }
    }
    
    return dimensions;
  }

  /**
   * Find dimension line associated with dimension text
   */
  private findDimensionLine(text: any, imageData: ImageData): any | null {
    // Simplified implementation - look for lines near the text
    const searchRadius = 50;
    const textCenter = {
      x: text.bbox.x + text.bbox.width / 2,
      y: text.bbox.y + text.bbox.height / 2
    };
    
    // This would use line detection algorithms to find dimension lines
    // For now, return a mock line
    return {
      start: { x: textCenter.x - 25, y: textCenter.y },
      end: { x: textCenter.x + 25, y: textCenter.y },
      length: 50
    };
  }

  /**
   * Get dimension orientation
   */
  private getDimensionOrientation(line: any): 'horizontal' | 'vertical' | 'diagonal' {
    const dx = Math.abs(line.end.x - line.start.x);
    const dy = Math.abs(line.end.y - line.start.y);
    
    if (dx > dy * 3) return 'horizontal';
    if (dy > dx * 3) return 'vertical';
    return 'diagonal';
  }

  /**
   * Detect grid references
   */
  private async detectGridReferences(imageData: ImageData): Promise<ScaleReference[]> {
    const gridRefs: ScaleReference[] = [];
    
    // Analyze image for regular grid patterns
    const gridSpacing = this.detectGridSpacing(imageData);
    
    if (gridSpacing > 0) {
      // Assume grid represents a standard unit (this would need refinement)
      const gridRef: ScaleReference = {
        id: 'grid_reference',
        type: 'grid',
        pixelLength: gridSpacing,
        realLength: 1.0, // Assume 1 unit per grid
        unit: Unit.METER, // Default assumption
        confidence: 0.6,
        position: { x: 0, y: 0 },
        orientation: 0
      };
      
      gridRefs.push(gridRef);
    }
    
    return gridRefs;
  }

  /**
   * Detect grid spacing in pixels
   */
  private detectGridSpacing(imageData: ImageData): number {
    // Simplified grid detection using FFT or autocorrelation
    // For now, return 0 (no grid detected)
    return 0;
  }

  /**
   * Calculate grid spacing from grid references
   */
  private calculateGridSpacing(gridRefs: ScaleReference[]): number {
    if (gridRefs.length === 0) return 0;
    
    const avgSpacing = gridRefs.reduce((sum, ref) => sum + ref.pixelLength, 0) / gridRefs.length;
    return avgSpacing;
  }

  /**
   * Detect known objects for scale reference
   */
  private async detectKnownObjects(imageData: ImageData): Promise<ScaleReference[]> {
    // This would detect common objects with known sizes (doors, windows, etc.)
    // For now, return empty array
    return [];
  }

  /**
   * Convert dimensions to scale references
   */
  private dimensionsToScaleReferences(dimensions: Dimension[]): ScaleReference[] {
    return dimensions.map(dim => ({
      id: `dim_ref_${dim.id}`,
      type: 'dimension' as const,
      pixelLength: dim.pixelLength,
      realLength: dim.value,
      unit: dim.unit,
      confidence: dim.confidence,
      position: dim.startPoint,
      orientation: 0
    }));
  }

  /**
   * Calculate possible scales from references
   */
  private calculatePossibleScales(references: ScaleReference[], options: CalibrationOptions): Scale[] {
    const scales: Scale[] = [];
    
    for (const ref of references) {
      if (ref.pixelLength > 0 && ref.realLength > 0) {
        const pixelsPerUnit = ref.pixelLength / ref.realLength;
        
        const scale: Scale = {
          ratio: pixelsPerUnit,
          unit: ref.unit,
          type: this.determineScaleType(pixelsPerUnit, ref.unit),
          confidence: ref.confidence,
          references: [ref],
          standardScale: this.findStandardScale(pixelsPerUnit, ref.unit)
        };
        
        scales.push(scale);
      }
    }
    
    // Group similar scales and average them
    const groupedScales = this.groupSimilarScales(scales);
    
    return groupedScales.filter(scale => scale.confidence >= options.minConfidence);
  }

  /**
   * Determine scale type based on ratio and unit
   */
  private determineScaleType(ratio: number, unit: Unit): ScaleType {
    if (unit === Unit.FOOT || unit === Unit.INCH) {
      return ScaleType.IMPERIAL;
    }
    
    if (unit === Unit.METER || unit === Unit.CENTIMETER) {
      // Check if it matches common architectural scales
      const commonRatios = [20, 50, 100, 200, 500];
      for (const commonRatio of commonRatios) {
        if (Math.abs(ratio - commonRatio) / commonRatio < 0.1) {
          return ScaleType.ARCHITECTURAL;
        }
      }
      return ScaleType.METRIC;
    }
    
    return ScaleType.CUSTOM;
  }

  /**
   * Find standard scale designation
   */
  private findStandardScale(ratio: number, unit: Unit): string | undefined {
    if (unit === Unit.METER || unit === Unit.CENTIMETER) {
      for (const archScale of this.ARCHITECTURAL_SCALES) {
        if (Math.abs(ratio - archScale.ratio) / archScale.ratio < 0.1) {
          return archScale.scale;
        }
      }
    }
    
    if (unit === Unit.FOOT || unit === Unit.INCH) {
      for (const impScale of this.IMPERIAL_SCALES) {
        if (Math.abs(ratio - impScale.ratio) / impScale.ratio < 0.1) {
          return impScale.scale;
        }
      }
    }
    
    return undefined;
  }

  /**
   * Group similar scales and average them
   */
  private groupSimilarScales(scales: Scale[]): Scale[] {
    const grouped: Scale[] = [];
    const tolerance = 0.15; // 15% tolerance
    
    for (const scale of scales) {
      let found = false;
      
      for (const group of grouped) {
        if (Math.abs(scale.ratio - group.ratio) / group.ratio < tolerance && 
            scale.unit === group.unit) {
          // Merge into existing group
          const totalRefs = group.references.length + scale.references.length;
          group.ratio = (group.ratio * group.references.length + scale.ratio * scale.references.length) / totalRefs;
          group.confidence = Math.max(group.confidence, scale.confidence);
          group.references.push(...scale.references);
          found = true;
          break;
        }
      }
      
      if (!found) {
        grouped.push({ ...scale });
      }
    }
    
    return grouped;
  }

  /**
   * Select the best scale from possible scales
   */
  private selectBestScale(scales: Scale[], options: CalibrationOptions): Scale {
    // Sort by confidence and number of references
    scales.sort((a, b) => {
      const aScore = a.confidence * Math.log(a.references.length + 1);
      const bScore = b.confidence * Math.log(b.references.length + 1);
      return bScore - aScore;
    });
    
    // Prefer expected unit if specified
    if (options.expectedUnit) {
      const preferredScales = scales.filter(s => s.unit === options.expectedUnit);
      if (preferredScales.length > 0) {
        return preferredScales[0];
      }
    }
    
    // Prefer expected scale type if specified
    if (options.expectedScaleType) {
      const preferredScales = scales.filter(s => s.type === options.expectedScaleType);
      if (preferredScales.length > 0) {
        return preferredScales[0];
      }
    }
    
    return scales[0];
  }

  /**
   * Generate warnings based on calibration results
   */
  private generateWarnings(result: CalibrationResult, options: CalibrationOptions): string[] {
    const warnings: string[] = [];
    
    if (result.scaleReferences.length === 0) {
      warnings.push('No scale references found. Scale detection may be inaccurate.');
    }
    
    if (result.possibleScales.length === 0) {
      warnings.push('No valid scales could be calculated from available references.');
    }
    
    if (result.detectedScale && result.detectedScale.confidence < 0.7) {
      warnings.push('Low confidence in detected scale. Manual verification recommended.');
    }
    
    if (result.possibleScales.length > 3) {
      warnings.push('Multiple conflicting scales detected. Results may be ambiguous.');
    }
    
    if (result.dimensions.length === 0 && options.searchForDimensions) {
      warnings.push('No dimensions found in the blueprint. Scale detection relies on other methods.');
    }
    
    return warnings;
  }

  /**
   * Convert between units
   */
  convertUnit(value: number, fromUnit: Unit, toUnit: Unit): number {
    if (fromUnit === toUnit) return value;
    
    const fromMeters = this.UNIT_TO_METERS[fromUnit];
    const toMeters = this.UNIT_TO_METERS[toUnit];
    
    return value * fromMeters / toMeters;
  }

  /**
   * Apply scale to measurements
   */
  applyScale(pixelLength: number, scale: Scale): { value: number; unit: Unit } {
    const realLength = pixelLength / scale.ratio;
    return {
      value: realLength,
      unit: scale.unit
    };
  }

  /**
   * Get supported units
   */
  static getSupportedUnits(): Unit[] {
    return Object.values(Unit);
  }

  /**
   * Get scale type descriptions
   */
  static getScaleTypeDescriptions(): Record<ScaleType, string> {
    return {
      [ScaleType.ARCHITECTURAL]: 'Architectural scale (e.g., 1:50, 1:100)',
      [ScaleType.ENGINEERING]: 'Engineering scale (e.g., 1:20, 1:40)',
      [ScaleType.METRIC]: 'Metric scale (e.g., 1:500, 1:1000)',
      [ScaleType.IMPERIAL]: 'Imperial scale (e.g., 1/4"=1\', 1/8"=1\')',
      [ScaleType.CUSTOM]: 'Custom or non-standard scale'
    };
  }
}

export default ScaleCalibrator;
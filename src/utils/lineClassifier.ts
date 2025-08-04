/**
 * LineClassifier - ML-based line type identification
 * 
 * This module provides intelligent line classification capabilities:
 * - Machine learning-based line type identification
 * - Distinction between structural lines, annotations, and dimensions
 * - Advanced line feature extraction and analysis
 * - Context-aware classification using surrounding elements
 */

import * as tf from '@tensorflow/tfjs';

export enum LineType {
  WALL = 'wall',
  DIMENSION = 'dimension',
  ANNOTATION = 'annotation',
  SYMBOL_BOUNDARY = 'symbol_boundary',
  GRID_LINE = 'grid_line',
  CONSTRUCTION_LINE = 'construction_line',
  HIDDEN_LINE = 'hidden_line',
  CENTER_LINE = 'center_line',
  SECTION_LINE = 'section_line',
  ELEVATION_LINE = 'elevation_line',
  UNKNOWN = 'unknown'
}

export enum LineStyle {
  SOLID = 'solid',
  DASHED = 'dashed',
  DOTTED = 'dotted',
  DASH_DOT = 'dash_dot',
  HIDDEN = 'hidden',
  CENTER = 'center'
}

export interface Line {
  id: string;
  startPoint: Point;
  endPoint: Point;
  type: LineType;
  style: LineStyle;
  thickness: number;
  confidence: number;
  length: number;
  angle: number;
  features: LineFeatures;
}

export interface Point {
  x: number;
  y: number;
}

export interface LineFeatures {
  thickness: number;
  style: LineStyle;
  intensity: number;
  straightness: number;
  continuity: number;
  parallelLines: number;
  perpendicularLines: number;
  nearbyText: boolean;
  nearbySymbols: boolean;
  junctionCount: number;
  cornerPoints: Point[];
}

export interface ClassificationResult {
  lines: Line[];
  confidence: number;
  processingTime: number;
  statistics: {
    totalLines: number;
    wallLines: number;
    dimensionLines: number;
    annotationLines: number;
    unknownLines: number;
  };
}

export interface ClassificationOptions {
  enableMLClassification: boolean;
  useContextAnalysis: boolean;
  minLineLength: number;
  confidenceThreshold: number;
  debugMode: boolean;
}

/**
 * Machine Learning-based Line Classifier
 */
export class LineClassifier {
  private model: tf.LayersModel | null = null;
  private isModelLoaded: boolean = false;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
  }

  /**
   * Initialize the classifier and load ML model
   */
  async initialize(): Promise<void> {
    if (this.isModelLoaded) return;

    try {
      // For now, create a simple neural network for line classification
      // In a production environment, this would load a pre-trained model
      this.model = await this.createLineClassificationModel();
      this.isModelLoaded = true;
      console.log('Line classifier initialized successfully');
    } catch (error) {
      console.error('Failed to initialize line classifier:', error);
      // Continue without ML model - fall back to heuristic classification
    }
  }

  /**
   * Main line classification function
   */
  async classifyLines(
    imageData: ImageData, 
    detectedLines: any[] = [], 
    options: Partial<ClassificationOptions> = {}
  ): Promise<ClassificationResult> {
    const startTime = Date.now();
    
    const opts: ClassificationOptions = {
      enableMLClassification: true,
      useContextAnalysis: true,
      minLineLength: 10,
      confidenceThreshold: 0.5,
      debugMode: false,
      ...options
    };

    try {
      // Detect lines if not provided
      const rawLines = detectedLines.length > 0 ? detectedLines : await this.detectLines(imageData);
      
      // Extract features for each line
      const linesWithFeatures = await this.extractLineFeatures(imageData, rawLines);
      
      // Classify lines using ML or heuristics
      const classifiedLines = opts.enableMLClassification && this.isModelLoaded
        ? await this.classifyWithML(linesWithFeatures, imageData)
        : await this.classifyWithHeuristics(linesWithFeatures, imageData);
      
      // Apply context analysis
      if (opts.useContextAnalysis) {
        this.applyContextAnalysis(classifiedLines, imageData);
      }
      
      // Filter by confidence threshold
      const filteredLines = classifiedLines.filter(line => 
        line.confidence >= opts.confidenceThreshold && 
        line.length >= opts.minLineLength
      );
      
      const processingTime = Date.now() - startTime;
      const statistics = this.calculateStatistics(filteredLines);
      
      return {
        lines: filteredLines,
        confidence: this.calculateOverallConfidence(filteredLines),
        processingTime,
        statistics
      };
    } catch (error) {
      console.error('Line classification failed:', error);
      
      return {
        lines: [],
        confidence: 0,
        processingTime: Date.now() - startTime,
        statistics: {
          totalLines: 0,
          wallLines: 0,
          dimensionLines: 0,
          annotationLines: 0,
          unknownLines: 0
        }
      };
    }
  }

  /**
   * Create a simple neural network for line classification
   */
  private async createLineClassificationModel(): Promise<tf.LayersModel> {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({
          inputShape: [15], // 15 features per line
          units: 32,
          activation: 'relu'
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({
          units: 16,
          activation: 'relu'
        }),
        tf.layers.dense({
          units: Object.keys(LineType).length,
          activation: 'softmax'
        })
      ]
    });

    model.compile({
      optimizer: 'adam',
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    // In a real implementation, you would load pre-trained weights here
    // For now, we'll use a simple untrained model as a placeholder
    
    return model;
  }

  /**
   * Detect lines in the image using edge detection and line extraction
   */
  private async detectLines(imageData: ImageData): Promise<any[]> {
    const lines: any[] = [];
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    // Apply edge detection
    const edges = this.sobelEdgeDetection(data, width, height);
    
    // Use Hough transform to detect lines
    const houghLines = this.houghLineTransform(edges, width, height);
    
    return houghLines;
  }

  /**
   * Sobel edge detection
   */
  private sobelEdgeDetection(data: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
    const output = new Uint8ClampedArray(data.length);
    const sobelX = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
    const sobelY = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0, gy = 0;

        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4;
            const intensity = data[idx];
            gx += intensity * sobelX[ky + 1][kx + 1];
            gy += intensity * sobelY[ky + 1][kx + 1];
          }
        }

        const magnitude = Math.sqrt(gx * gx + gy * gy);
        const idx = (y * width + x) * 4;
        output[idx] = Math.min(255, magnitude);
        output[idx + 1] = Math.min(255, magnitude);
        output[idx + 2] = Math.min(255, magnitude);
        output[idx + 3] = 255;
      }
    }

    return output;
  }

  /**
   * Simplified Hough line transform
   */
  private houghLineTransform(edges: Uint8ClampedArray, width: number, height: number): any[] {
    const lines: any[] = [];
    const threshold = 100;
    
    // Simplified line detection - in production, use a proper Hough transform
    for (let y = 0; y < height - 1; y += 5) {
      for (let x = 0; x < width - 1; x += 5) {
        const idx = (y * width + x) * 4;
        if (edges[idx] > threshold) {
          // Look for line continuations
          const line = this.traceLine(edges, width, height, x, y);
          if (line && line.length > 20) {
            lines.push(line);
          }
        }
      }
    }

    return lines;
  }

  /**
   * Trace a line from a starting point
   */
  private traceLine(edges: Uint8ClampedArray, width: number, height: number, startX: number, startY: number): any | null {
    const points = [];
    const visited = new Set<string>();
    const stack = [{x: startX, y: startY}];
    
    while (stack.length > 0 && points.length < 1000) {
      const {x, y} = stack.pop()!;
      const key = `${x},${y}`;
      
      if (visited.has(key) || x < 0 || x >= width || y < 0 || y >= height) {
        continue;
      }
      
      const idx = (y * width + x) * 4;
      if (edges[idx] < 100) continue;
      
      visited.add(key);
      points.push({x, y});
      
      // Add neighbors
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          stack.push({x: x + dx, y: y + dy});
        }
      }
    }
    
    if (points.length < 10) return null;
    
    // Find start and end points
    const startPoint = points[0];
    const endPoint = points[points.length - 1];
    const length = Math.sqrt((endPoint.x - startPoint.x) ** 2 + (endPoint.y - startPoint.y) ** 2);
    
    return {
      startPoint,
      endPoint,
      length,
      points
    };
  }

  /**
   * Extract features for each detected line
   */
  private async extractLineFeatures(imageData: ImageData, rawLines: any[]): Promise<Line[]> {
    const lines: Line[] = [];
    
    for (let i = 0; i < rawLines.length; i++) {
      const rawLine = rawLines[i];
      
      const features = this.calculateLineFeatures(rawLine, imageData);
      const thickness = this.estimateLineThickness(rawLine, imageData);
      const style = this.detectLineStyle(rawLine, imageData);
      const angle = Math.atan2(
        rawLine.endPoint.y - rawLine.startPoint.y,
        rawLine.endPoint.x - rawLine.startPoint.x
      );
      
      const line: Line = {
        id: `line_${i}`,
        startPoint: rawLine.startPoint,
        endPoint: rawLine.endPoint,
        type: LineType.UNKNOWN, // Will be classified later
        style,
        thickness,
        confidence: 0, // Will be set during classification
        length: rawLine.length,
        angle,
        features
      };
      
      lines.push(line);
    }
    
    return lines;
  }

  /**
   * Calculate comprehensive line features
   */
  private calculateLineFeatures(rawLine: any, imageData: ImageData): LineFeatures {
    const thickness = this.estimateLineThickness(rawLine, imageData);
    const style = this.detectLineStyle(rawLine, imageData);
    const intensity = this.calculateLineIntensity(rawLine, imageData);
    const straightness = this.calculateStraightness(rawLine);
    const continuity = this.calculateContinuity(rawLine, imageData);
    
    return {
      thickness,
      style,
      intensity,
      straightness,
      continuity,
      parallelLines: 0, // Will be calculated in context analysis
      perpendicularLines: 0, // Will be calculated in context analysis
      nearbyText: false, // Will be detected separately
      nearbySymbols: false, // Will be detected separately
      junctionCount: 0, // Will be calculated in context analysis
      cornerPoints: []
    };
  }

  /**
   * Estimate line thickness
   */
  private estimateLineThickness(rawLine: any, imageData: ImageData): number {
    // Sample points along the line and measure thickness
    const samples = 10;
    let totalThickness = 0;
    
    for (let i = 0; i < samples; i++) {
      const t = i / (samples - 1);
      const x = Math.round(rawLine.startPoint.x + t * (rawLine.endPoint.x - rawLine.startPoint.x));
      const y = Math.round(rawLine.startPoint.y + t * (rawLine.endPoint.y - rawLine.startPoint.y));
      
      const thickness = this.measureThicknessAtPoint(x, y, rawLine, imageData);
      totalThickness += thickness;
    }
    
    return totalThickness / samples;
  }

  /**
   * Measure thickness at a specific point
   */
  private measureThicknessAtPoint(x: number, y: number, rawLine: any, imageData: ImageData): number {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    
    // Calculate perpendicular direction
    const dx = rawLine.endPoint.x - rawLine.startPoint.x;
    const dy = rawLine.endPoint.y - rawLine.startPoint.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const perpX = -dy / length;
    const perpY = dx / length;
    
    let thickness = 0;
    const maxSample = 20;
    
    // Sample in both directions perpendicular to the line
    for (let d = 1; d < maxSample; d++) {
      const px1 = Math.round(x + d * perpX);
      const py1 = Math.round(y + d * perpY);
      const px2 = Math.round(x - d * perpX);
      const py2 = Math.round(y - d * perpY);
      
      if (px1 >= 0 && px1 < width && py1 >= 0 && py1 < height) {
        const idx1 = (py1 * width + px1) * 4;
        if (data[idx1] > 200) { // Found background
          thickness = d;
          break;
        }
      }
      
      if (px2 >= 0 && px2 < width && py2 >= 0 && py2 < height) {
        const idx2 = (py2 * width + px2) * 4;
        if (data[idx2] > 200) { // Found background
          thickness = Math.max(thickness, d);
          break;
        }
      }
    }
    
    return Math.max(1, thickness);
  }

  /**
   * Detect line style (solid, dashed, etc.)
   */
  private detectLineStyle(rawLine: any, imageData: ImageData): LineStyle {
    if (!rawLine.points || rawLine.points.length < 10) {
      return LineStyle.SOLID;
    }
    
    // Analyze pixel continuity along the line
    const gaps = this.findGapsInLine(rawLine.points, imageData);
    
    if (gaps.length === 0) return LineStyle.SOLID;
    if (gaps.length > 5) {
      const avgGapSize = gaps.reduce((sum, gap) => sum + gap.size, 0) / gaps.length;
      if (avgGapSize < 5) return LineStyle.DOTTED;
      return LineStyle.DASHED;
    }
    
    return LineStyle.DASH_DOT;
  }

  /**
   * Find gaps in a line
   */
  private findGapsInLine(points: Point[], imageData: ImageData): any[] {
    const gaps = [];
    const data = imageData.data;
    const width = imageData.width;
    
    let gapStart = -1;
    
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      const idx = (point.y * width + point.x) * 4;
      const intensity = data[idx];
      
      if (intensity > 150) { // Background pixel
        if (gapStart === -1) {
          gapStart = i;
        }
      } else { // Line pixel
        if (gapStart !== -1) {
          gaps.push({
            start: gapStart,
            end: i - 1,
            size: i - gapStart
          });
          gapStart = -1;
        }
      }
    }
    
    return gaps;
  }

  /**
   * Calculate line intensity
   */
  private calculateLineIntensity(rawLine: any, imageData: ImageData): number {
    if (!rawLine.points) return 0;
    
    const data = imageData.data;
    const width = imageData.width;
    let totalIntensity = 0;
    
    for (const point of rawLine.points) {
      const idx = (point.y * width + point.x) * 4;
      totalIntensity += 255 - data[idx]; // Invert to get line intensity
    }
    
    return totalIntensity / rawLine.points.length / 255;
  }

  /**
   * Calculate line straightness
   */
  private calculateStraightness(rawLine: any): number {
    if (!rawLine.points || rawLine.points.length < 3) return 1;
    
    const start = rawLine.startPoint;
    const end = rawLine.endPoint;
    const idealLength = Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2);
    
    let totalDeviation = 0;
    for (const point of rawLine.points) {
      const distanceToLine = this.pointToLineDistance(point, start, end);
      totalDeviation += distanceToLine;
    }
    
    const avgDeviation = totalDeviation / rawLine.points.length;
    return Math.max(0, 1 - avgDeviation / 10); // Normalize to 0-1
  }

  /**
   * Calculate point to line distance
   */
  private pointToLineDistance(point: Point, lineStart: Point, lineEnd: Point): number {
    const A = point.x - lineStart.x;
    const B = point.y - lineStart.y;
    const C = lineEnd.x - lineStart.x;
    const D = lineEnd.y - lineStart.y;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    
    if (lenSq === 0) return Math.sqrt(A * A + B * B);

    const param = dot / lenSq;
    
    let xx, yy;
    if (param < 0) {
      xx = lineStart.x;
      yy = lineStart.y;
    } else if (param > 1) {
      xx = lineEnd.x;
      yy = lineEnd.y;
    } else {
      xx = lineStart.x + param * C;
      yy = lineStart.y + param * D;
    }

    const dx = point.x - xx;
    const dy = point.y - yy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Calculate line continuity
   */
  private calculateContinuity(rawLine: any, imageData: ImageData): number {
    if (!rawLine.points) return 0;
    
    const gaps = this.findGapsInLine(rawLine.points, imageData);
    const totalGapSize = gaps.reduce((sum, gap) => sum + gap.size, 0);
    
    return Math.max(0, 1 - totalGapSize / rawLine.points.length);
  }

  /**
   * Classify lines using machine learning
   */
  private async classifyWithML(lines: Line[], imageData: ImageData): Promise<Line[]> {
    if (!this.model) {
      console.warn('ML model not available, falling back to heuristics');
      return this.classifyWithHeuristics(lines, imageData);
    }

    const features = lines.map(line => this.extractMLFeatures(line));
    const featureTensor = tf.tensor2d(features);
    
    try {
      const predictions = this.model.predict(featureTensor) as tf.Tensor;
      const predictionData = await predictions.data();
      
      const classifiedLines = lines.map((line, i) => {
        const startIdx = i * Object.keys(LineType).length;
        const confidences = Array.from(predictionData.slice(startIdx, startIdx + Object.keys(LineType).length));
        const maxIdx = confidences.indexOf(Math.max(...confidences));
        const types = Object.values(LineType);
        
        return {
          ...line,
          type: types[maxIdx],
          confidence: confidences[maxIdx]
        };
      });
      
      featureTensor.dispose();
      predictions.dispose();
      
      return classifiedLines;
    } catch (error) {
      console.error('ML classification failed:', error);
      featureTensor.dispose();
      return this.classifyWithHeuristics(lines, imageData);
    }
  }

  /**
   * Extract features for ML model
   */
  private extractMLFeatures(line: Line): number[] {
    return [
      line.length / 1000,
      line.thickness / 10,
      line.features.intensity,
      line.features.straightness,
      line.features.continuity,
      line.angle / Math.PI,
      line.features.style === LineStyle.SOLID ? 1 : 0,
      line.features.style === LineStyle.DASHED ? 1 : 0,
      line.features.style === LineStyle.DOTTED ? 1 : 0,
      line.features.nearbyText ? 1 : 0,
      line.features.nearbySymbols ? 1 : 0,
      line.features.parallelLines / 10,
      line.features.perpendicularLines / 10,
      line.features.junctionCount / 10,
      line.features.cornerPoints.length / 10
    ];
  }

  /**
   * Classify lines using heuristic rules
   */
  private async classifyWithHeuristics(lines: Line[], imageData: ImageData): Promise<Line[]> {
    return lines.map(line => {
      let type = LineType.UNKNOWN;
      let confidence = 0.5;
      
      // Wall detection heuristics
      if (line.thickness > 2 && line.length > 50 && line.features.straightness > 0.8) {
        type = LineType.WALL;
        confidence = 0.8;
      }
      // Dimension line heuristics
      else if (line.features.style === LineStyle.DASHED && line.features.nearbyText) {
        type = LineType.DIMENSION;
        confidence = 0.7;
      }
      // Annotation line heuristics
      else if (line.thickness < 2 && line.features.nearbyText) {
        type = LineType.ANNOTATION;
        confidence = 0.6;
      }
      // Grid line heuristics
      else if (line.features.style === LineStyle.DOTTED && line.features.parallelLines > 2) {
        type = LineType.GRID_LINE;
        confidence = 0.7;
      }
      
      return {
        ...line,
        type,
        confidence
      };
    });
  }

  /**
   * Apply context analysis to improve classification
   */
  private applyContextAnalysis(lines: Line[], imageData: ImageData): void {
    // Find parallel and perpendicular relationships
    for (let i = 0; i < lines.length; i++) {
      for (let j = i + 1; j < lines.length; j++) {
        const line1 = lines[i];
        const line2 = lines[j];
        
        const angleDiff = Math.abs(line1.angle - line2.angle);
        
        // Check for parallel lines
        if (angleDiff < 0.1 || Math.abs(angleDiff - Math.PI) < 0.1) {
          line1.features.parallelLines++;
          line2.features.parallelLines++;
        }
        
        // Check for perpendicular lines
        if (Math.abs(angleDiff - Math.PI / 2) < 0.1 || Math.abs(angleDiff - 3 * Math.PI / 2) < 0.1) {
          line1.features.perpendicularLines++;
          line2.features.perpendicularLines++;
        }
      }
    }
    
    // Update classifications based on context
    for (const line of lines) {
      if (line.features.parallelLines > 3 && line.type === LineType.UNKNOWN) {
        line.type = LineType.WALL;
        line.confidence = Math.min(0.9, line.confidence + 0.2);
      }
    }
  }

  /**
   * Calculate overall confidence
   */
  private calculateOverallConfidence(lines: Line[]): number {
    if (lines.length === 0) return 0;
    
    const avgConfidence = lines.reduce((sum, line) => sum + line.confidence, 0) / lines.length;
    return avgConfidence;
  }

  /**
   * Calculate classification statistics
   */
  private calculateStatistics(lines: Line[]): any {
    const stats = {
      totalLines: lines.length,
      wallLines: 0,
      dimensionLines: 0,
      annotationLines: 0,
      unknownLines: 0
    };
    
    for (const line of lines) {
      switch (line.type) {
        case LineType.WALL:
          stats.wallLines++;
          break;
        case LineType.DIMENSION:
          stats.dimensionLines++;
          break;
        case LineType.ANNOTATION:
          stats.annotationLines++;
          break;
        default:
          stats.unknownLines++;
      }
    }
    
    return stats;
  }

  /**
   * Get line type descriptions
   */
  static getLineTypeDescriptions(): Record<LineType, string> {
    return {
      [LineType.WALL]: 'Structural wall lines',
      [LineType.DIMENSION]: 'Measurement and dimension lines',
      [LineType.ANNOTATION]: 'Annotation and label lines',
      [LineType.SYMBOL_BOUNDARY]: 'Symbol boundary lines',
      [LineType.GRID_LINE]: 'Grid and reference lines',
      [LineType.CONSTRUCTION_LINE]: 'Construction guide lines',
      [LineType.HIDDEN_LINE]: 'Hidden or dashed lines',
      [LineType.CENTER_LINE]: 'Center and axis lines',
      [LineType.SECTION_LINE]: 'Section cut lines',
      [LineType.ELEVATION_LINE]: 'Elevation marker lines',
      [LineType.UNKNOWN]: 'Unclassified lines'
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.model) {
      this.model.dispose();
      this.model = null;
      this.isModelLoaded = false;
    }
  }
}

export default LineClassifier;
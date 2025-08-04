/**
 * TextFilterEngine - OCR and text removal from structural analysis
 * 
 * This module provides comprehensive text detection and filtering capabilities:
 * - OCR-based text detection using Tesseract.js
 * - Text removal from structural line analysis
 * - Distinction between structural elements and annotations
 * - Advanced image preprocessing for text layer separation
 */

import { createWorker, Worker } from 'tesseract.js';

export interface TextRegion {
  id: string;
  text: string;
  confidence: number;
  bbox: BoundingBox;
  fontSize: number;
  rotation: number;
  isAnnotation: boolean;
  isDimension: boolean;
  isLabel: boolean;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FilterResult {
  cleanedImage: ImageData;
  textRegions: TextRegion[];
  maskImage: ImageData;
  confidence: number;
  processingTime: number;
}

export interface FilterOptions {
  enableOCR: boolean;
  removeText: boolean;
  preserveDimensions: boolean;
  minConfidence: number;
  languageHints: string[];
  debugMode: boolean;
}

/**
 * Text Filter Engine for blueprint processing
 */
export class TextFilterEngine {
  private ocrWorker: Worker | null = null;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private isInitialized: boolean = false;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
  }

  /**
   * Initialize the OCR engine
   */
  async initialize(languages: string[] = ['eng']): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.ocrWorker = await createWorker(languages, 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        }
      });
      
      // Optimize for blueprint text recognition
      await this.ocrWorker.setParameters({
        tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz .-\'"',
        tessedit_pageseg_mode: '6', // Single block of text
        preserve_interword_spaces: '1'
      });
      
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize OCR engine:', error);
      throw new Error('OCR initialization failed');
    }
  }

  /**
   * Main text filtering function
   */
  async filterText(imageData: ImageData, options: Partial<FilterOptions> = {}): Promise<FilterResult> {
    const startTime = Date.now();
    
    const opts: FilterOptions = {
      enableOCR: true,
      removeText: true,
      preserveDimensions: false,
      minConfidence: 30,
      languageHints: ['eng'],
      debugMode: false,
      ...options
    };

    try {
      // Initialize OCR if needed
      if (opts.enableOCR && !this.isInitialized) {
        await this.initialize(opts.languageHints);
      }

      // Preprocess image for better text detection
      const preprocessedImage = this.preprocessForOCR(imageData);
      
      // Detect text regions using OCR
      const textRegions = opts.enableOCR 
        ? await this.detectTextRegions(preprocessedImage, opts)
        : await this.detectTextHeuristically(preprocessedImage, opts);

      // Create text mask
      const maskImage = this.createTextMask(imageData, textRegions);

      // Remove text from image
      const cleanedImage = opts.removeText 
        ? this.removeTextFromImage(imageData, textRegions, opts)
        : imageData;

      const processingTime = Date.now() - startTime;

      return {
        cleanedImage,
        textRegions,
        maskImage,
        confidence: this.calculateOverallConfidence(textRegions),
        processingTime
      };
    } catch (error) {
      console.error('Text filtering failed:', error);
      
      // Return original image on error
      return {
        cleanedImage: imageData,
        textRegions: [],
        maskImage: new ImageData(imageData.width, imageData.height),
        confidence: 0,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Preprocess image for better OCR results
   */
  private preprocessForOCR(imageData: ImageData): ImageData {
    const width = imageData.width;
    const height = imageData.height;
    const data = new Uint8ClampedArray(imageData.data);
    
    // Convert to grayscale
    for (let i = 0; i < data.length; i += 4) {
      const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
    }

    // Apply contrast enhancement
    this.enhanceContrast(data, width, height);
    
    // Apply noise reduction
    const denoised = this.medianFilter(data, width, height);
    
    return new ImageData(denoised, width, height);
  }

  /**
   * Enhance contrast for better text recognition
   */
  private enhanceContrast(data: Uint8ClampedArray, width: number, height: number): void {
    // Calculate histogram
    const histogram = new Array(256).fill(0);
    for (let i = 0; i < data.length; i += 4) {
      histogram[data[i]]++;
    }

    // Calculate cumulative distribution
    const cdf = new Array(256);
    cdf[0] = histogram[0];
    for (let i = 1; i < 256; i++) {
      cdf[i] = cdf[i - 1] + histogram[i];
    }

    // Normalize CDF
    const totalPixels = width * height;
    for (let i = 0; i < 256; i++) {
      cdf[i] = Math.round((cdf[i] / totalPixels) * 255);
    }

    // Apply histogram equalization
    for (let i = 0; i < data.length; i += 4) {
      const newValue = cdf[data[i]];
      data[i] = newValue;
      data[i + 1] = newValue;
      data[i + 2] = newValue;
    }
  }

  /**
   * Apply median filter for noise reduction
   */
  private medianFilter(data: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
    const output = new Uint8ClampedArray(data.length);
    const kernelSize = 3;
    const half = Math.floor(kernelSize / 2);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const values = [];
        
        for (let ky = -half; ky <= half; ky++) {
          for (let kx = -half; kx <= half; kx++) {
            const nx = Math.max(0, Math.min(width - 1, x + kx));
            const ny = Math.max(0, Math.min(height - 1, y + ky));
            const idx = (ny * width + nx) * 4;
            values.push(data[idx]);
          }
        }
        
        values.sort((a, b) => a - b);
        const median = values[Math.floor(values.length / 2)];
        
        const idx = (y * width + x) * 4;
        output[idx] = median;
        output[idx + 1] = median;
        output[idx + 2] = median;
        output[idx + 3] = data[idx + 3];
      }
    }

    return output;
  }

  /**
   * Detect text regions using OCR
   */
  private async detectTextRegions(imageData: ImageData, options: FilterOptions): Promise<TextRegion[]> {
    if (!this.ocrWorker) {
      throw new Error('OCR worker not initialized');
    }

    try {
      // Convert ImageData to canvas for OCR
      this.canvas.width = imageData.width;
      this.canvas.height = imageData.height;
      this.ctx.putImageData(imageData, 0, 0);
      
      // Perform OCR
      const { data } = await this.ocrWorker.recognize(this.canvas);
      
      const textRegions: TextRegion[] = [];
      let regionId = 0;

      // Process OCR results
      if (data.words) {
        for (const word of data.words) {
          if (word.confidence < options.minConfidence) continue;
          
          const bbox = word.bbox;
          const region: TextRegion = {
            id: `text_${regionId++}`,
            text: word.text,
            confidence: word.confidence,
            bbox: {
              x: bbox.x0,
              y: bbox.y0,
              width: bbox.x1 - bbox.x0,
              height: bbox.y1 - bbox.y0
            },
            fontSize: this.estimateFontSize(bbox.y1 - bbox.y0),
            rotation: 0, // TODO: Detect text rotation
            isAnnotation: this.isAnnotationText(word.text),
            isDimension: this.isDimensionText(word.text),
            isLabel: this.isLabelText(word.text)
          };
          
          textRegions.push(region);
        }
      }

      return textRegions;
    } catch (error) {
      console.error('OCR detection failed:', error);
      return [];
    }
  }

  /**
   * Detect text regions using heuristic methods (fallback)
   */
  private async detectTextHeuristically(imageData: ImageData, options: FilterOptions): Promise<TextRegion[]> {
    const textRegions: TextRegion[] = [];
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    // Simple text region detection using connected components
    const visited = new Array(height).fill(null).map(() => new Array(width).fill(false));
    let regionId = 0;

    for (let y = 0; y < height; y += 10) { // Sample every 10 pixels for performance
      for (let x = 0; x < width; x += 10) {
        if (visited[y][x]) continue;
        
        const idx = (y * width + x) * 4;
        const intensity = data[idx];
        
        // Look for dark pixels (potential text)
        if (intensity < 100) {
          const region = this.traceTextRegion(data, width, height, x, y, visited);
          
          if (region && this.isValidTextRegion(region)) {
            const textRegion: TextRegion = {
              id: `heuristic_${regionId++}`,
              text: '[detected]',
              confidence: 50,
              bbox: region,
              fontSize: Math.max(8, region.height),
              rotation: 0,
              isAnnotation: true,
              isDimension: false,
              isLabel: false
            };
            
            textRegions.push(textRegion);
          }
        }
      }
    }

    return textRegions;
  }

  /**
   * Trace a potential text region
   */
  private traceTextRegion(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    startX: number,
    startY: number,
    visited: boolean[][]
  ): BoundingBox | null {
    const stack = [{x: startX, y: startY}];
    const pixels = [];
    
    while (stack.length > 0 && pixels.length < 5000) { // Limit region size
      const {x, y} = stack.pop()!;
      
      if (x < 0 || x >= width || y < 0 || y >= height || visited[y][x]) {
        continue;
      }
      
      const idx = (y * width + x) * 4;
      if (data[idx] > 100) continue; // Not dark enough
      
      visited[y][x] = true;
      pixels.push({x, y});
      
      // Add neighbors
      stack.push({x: x + 1, y}, {x: x - 1, y}, {x, y: y + 1}, {x, y: y - 1});
    }
    
    if (pixels.length < 10) return null;
    
    const minX = Math.min(...pixels.map(p => p.x));
    const maxX = Math.max(...pixels.map(p => p.x));
    const minY = Math.min(...pixels.map(p => p.y));
    const maxY = Math.max(...pixels.map(p => p.y));
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  /**
   * Check if region is likely to be text
   */
  private isValidTextRegion(region: BoundingBox): boolean {
    const aspectRatio = region.width / region.height;
    return region.width > 5 && region.height > 5 && 
           region.width < 500 && region.height < 100 &&
           aspectRatio > 0.5 && aspectRatio < 20;
  }

  /**
   * Create a mask image showing detected text regions
   */
  private createTextMask(imageData: ImageData, textRegions: TextRegion[]): ImageData {
    const width = imageData.width;
    const height = imageData.height;
    const maskData = new Uint8ClampedArray(width * height * 4);
    
    // Initialize to transparent
    for (let i = 3; i < maskData.length; i += 4) {
      maskData[i] = 255;
    }
    
    // Mark text regions in red
    for (const region of textRegions) {
      for (let y = region.bbox.y; y < region.bbox.y + region.bbox.height; y++) {
        for (let x = region.bbox.x; x < region.bbox.x + region.bbox.width; x++) {
          if (x >= 0 && x < width && y >= 0 && y < height) {
            const idx = (y * width + x) * 4;
            maskData[idx] = 255;     // Red
            maskData[idx + 1] = 0;   // Green
            maskData[idx + 2] = 0;   // Blue
            maskData[idx + 3] = 128; // Alpha
          }
        }
      }
    }
    
    return new ImageData(maskData, width, height);
  }

  /**
   * Remove text from the image
   */
  private removeTextFromImage(
    imageData: ImageData, 
    textRegions: TextRegion[], 
    options: FilterOptions
  ): ImageData {
    const width = imageData.width;
    const height = imageData.height;
    const cleanedData = new Uint8ClampedArray(imageData.data);
    
    for (const region of textRegions) {
      // Skip dimensions if preserveDimensions is enabled
      if (options.preserveDimensions && region.isDimension) continue;
      
      // Remove text by replacing with background color
      const backgroundColor = this.estimateBackgroundColor(imageData, region.bbox);
      
      for (let y = region.bbox.y; y < region.bbox.y + region.bbox.height; y++) {
        for (let x = region.bbox.x; x < region.bbox.x + region.bbox.width; x++) {
          if (x >= 0 && x < width && y >= 0 && y < height) {
            const idx = (y * width + x) * 4;
            cleanedData[idx] = backgroundColor;
            cleanedData[idx + 1] = backgroundColor;
            cleanedData[idx + 2] = backgroundColor;
            cleanedData[idx + 3] = 255;
          }
        }
      }
    }
    
    return new ImageData(cleanedData, width, height);
  }

  /**
   * Estimate background color around a text region
   */
  private estimateBackgroundColor(imageData: ImageData, bbox: BoundingBox): number {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    
    let sum = 0;
    let count = 0;
    
    // Sample pixels around the text region
    const margin = 5;
    for (let y = Math.max(0, bbox.y - margin); y < Math.min(height, bbox.y + bbox.height + margin); y++) {
      for (let x = Math.max(0, bbox.x - margin); x < Math.min(width, bbox.x + bbox.width + margin); x++) {
        // Skip pixels inside the text region
        if (x >= bbox.x && x < bbox.x + bbox.width && y >= bbox.y && y < bbox.y + bbox.height) {
          continue;
        }
        
        const idx = (y * width + x) * 4;
        sum += data[idx]; // Use red channel for grayscale
        count++;
      }
    }
    
    return count > 0 ? Math.round(sum / count) : 255; // Default to white
  }

  /**
   * Calculate overall confidence score
   */
  private calculateOverallConfidence(textRegions: TextRegion[]): number {
    if (textRegions.length === 0) return 0;
    
    const avgConfidence = textRegions.reduce((sum, region) => sum + region.confidence, 0) / textRegions.length;
    return avgConfidence / 100; // Convert to 0-1 range
  }

  /**
   * Text classification helpers
   */
  private estimateFontSize(height: number): number {
    return Math.max(8, Math.min(72, height * 0.8));
  }

  private isAnnotationText(text: string): boolean {
    const annotationPatterns = /^(note|label|title|annotation|desc|description)/i;
    return annotationPatterns.test(text) || text.length > 20;
  }

  private isDimensionText(text: string): boolean {
    const dimensionPatterns = /^\d+[\.\']?\s*\d*[\"]?\s*(ft|in|m|cm|mm)?$/i;
    return dimensionPatterns.test(text.trim());
  }

  private isLabelText(text: string): boolean {
    const labelPatterns = /^(room|kitchen|bedroom|bathroom|living|office|hall|entry)/i;
    return labelPatterns.test(text) && text.length < 20;
  }

  /**
   * Get filtered image as data URL
   */
  getFilteredImageDataURL(imageData: ImageData): string {
    this.canvas.width = imageData.width;
    this.canvas.height = imageData.height;
    this.ctx.putImageData(imageData, 0, 0);
    return this.canvas.toDataURL();
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.ocrWorker) {
      await this.ocrWorker.terminate();
      this.ocrWorker = null;
      this.isInitialized = false;
    }
  }
}

export default TextFilterEngine;
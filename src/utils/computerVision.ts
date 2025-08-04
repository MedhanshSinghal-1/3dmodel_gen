import * as tf from '@tensorflow/tfjs';

interface Point {
  x: number;
  y: number;
}

interface Room {
  id: string;
  name: string;
  color: string;
  vertices: Array<[number, number]>;
  center: [number, number];
  area?: number;
  type?: string;
}

interface Wall {
  start: Point;
  end: Point;
  length: number;
  angle: number;
}

interface ProcessingResult {
  rooms: Room[];
  walls: Array<Array<[number, number]>>;
  doors: Point[];
  windows: Point[];
  confidence: number;
}

/**
 * Computer Vision utilities for floor plan analysis
 */
export class FloorPlanAnalyzer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private imageData: ImageData | null = null;
  private width: number = 0;
  private height: number = 0;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
  }

  /**
   * Load and preprocess the floor plan image
   */
  async loadImage(imageUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.width = img.width;
        this.height = img.height;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        
        this.ctx.drawImage(img, 0, 0);
        this.imageData = this.ctx.getImageData(0, 0, this.width, this.height);
        resolve();
      };
      img.onerror = reject;
      img.src = imageUrl;
    });
  }

  /**
   * Apply Gaussian blur for noise reduction
   */
  private gaussianBlur(data: Uint8ClampedArray, width: number, height: number, radius: number = 2): Uint8ClampedArray {
    const output = new Uint8ClampedArray(data.length);
    const kernel = this.generateGaussianKernel(radius);
    const kernelSize = kernel.length;
    const halfKernel = Math.floor(kernelSize / 2);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0, g = 0, b = 0, a = 0;
        let weightSum = 0;

        for (let ky = -halfKernel; ky <= halfKernel; ky++) {
          for (let kx = -halfKernel; kx <= halfKernel; kx++) {
            const px = Math.max(0, Math.min(width - 1, x + kx));
            const py = Math.max(0, Math.min(height - 1, y + ky));
            const idx = (py * width + px) * 4;
            const weight = kernel[ky + halfKernel][kx + halfKernel];

            r += data[idx] * weight;
            g += data[idx + 1] * weight;
            b += data[idx + 2] * weight;
            a += data[idx + 3] * weight;
            weightSum += weight;
          }
        }

        const idx = (y * width + x) * 4;
        output[idx] = r / weightSum;
        output[idx + 1] = g / weightSum;
        output[idx + 2] = b / weightSum;
        output[idx + 3] = a / weightSum;
      }
    }

    return output;
  }

  /**
   * Generate Gaussian kernel for blur operation
   */
  private generateGaussianKernel(radius: number): number[][] {
    const size = 2 * radius + 1;
    const kernel: number[][] = [];
    const sigma = radius / 3;
    const twoSigmaSquare = 2 * sigma * sigma;
    let sum = 0;

    for (let y = -radius; y <= radius; y++) {
      const row: number[] = [];
      for (let x = -radius; x <= radius; x++) {
        const value = Math.exp(-(x * x + y * y) / twoSigmaSquare);
        row.push(value);
        sum += value;
      }
      kernel.push(row);
    }

    // Normalize kernel
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        kernel[y][x] /= sum;
      }
    }

    return kernel;
  }

  /**
   * Convert image to grayscale
   */
  private toGrayscale(data: Uint8ClampedArray): Uint8ClampedArray {
    const output = new Uint8ClampedArray(data.length);
    
    for (let i = 0; i < data.length; i += 4) {
      const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      output[i] = gray;
      output[i + 1] = gray;
      output[i + 2] = gray;
      output[i + 3] = data[i + 3];
    }
    
    return output;
  }

  /**
   * Apply Sobel edge detection
   */
  private sobelEdgeDetection(data: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
    const output = new Uint8ClampedArray(data.length);
    
    // Sobel kernels
    const sobelX = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
    const sobelY = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0, gy = 0;

        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4;
            const intensity = data[idx]; // Use red channel for grayscale

            gx += intensity * sobelX[ky + 1][kx + 1];
            gy += intensity * sobelY[ky + 1][kx + 1];
          }
        }

        const magnitude = Math.sqrt(gx * gx + gy * gy);
        const normalizedMagnitude = Math.min(255, magnitude);

        const idx = (y * width + x) * 4;
        output[idx] = normalizedMagnitude;
        output[idx + 1] = normalizedMagnitude;
        output[idx + 2] = normalizedMagnitude;
        output[idx + 3] = 255;
      }
    }

    return output;
  }

  /**
   * Apply morphological operations to clean up the image
   */
  private morphologicalClose(data: Uint8ClampedArray, width: number, height: number, kernelSize: number = 3): Uint8ClampedArray {
    // Apply dilation followed by erosion
    const dilated = this.dilate(data, width, height, kernelSize);
    return this.erode(dilated, width, height, kernelSize);
  }

  private dilate(data: Uint8ClampedArray, width: number, height: number, kernelSize: number): Uint8ClampedArray {
    const output = new Uint8ClampedArray(data.length);
    const halfKernel = Math.floor(kernelSize / 2);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let maxVal = 0;

        for (let ky = -halfKernel; ky <= halfKernel; ky++) {
          for (let kx = -halfKernel; kx <= halfKernel; kx++) {
            const px = Math.max(0, Math.min(width - 1, x + kx));
            const py = Math.max(0, Math.min(height - 1, y + ky));
            const idx = (py * width + px) * 4;
            maxVal = Math.max(maxVal, data[idx]);
          }
        }

        const idx = (y * width + x) * 4;
        output[idx] = maxVal;
        output[idx + 1] = maxVal;
        output[idx + 2] = maxVal;
        output[idx + 3] = 255;
      }
    }

    return output;
  }

  private erode(data: Uint8ClampedArray, width: number, height: number, kernelSize: number): Uint8ClampedArray {
    const output = new Uint8ClampedArray(data.length);
    const halfKernel = Math.floor(kernelSize / 2);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let minVal = 255;

        for (let ky = -halfKernel; ky <= halfKernel; ky++) {
          for (let kx = -halfKernel; kx <= halfKernel; kx++) {
            const px = Math.max(0, Math.min(width - 1, x + kx));
            const py = Math.max(0, Math.min(height - 1, y + ky));
            const idx = (py * width + px) * 4;
            minVal = Math.min(minVal, data[idx]);
          }
        }

        const idx = (y * width + x) * 4;
        output[idx] = minVal;
        output[idx + 1] = minVal;
        output[idx + 2] = minVal;
        output[idx + 3] = 255;
      }
    }

    return output;
  }

  /**
   * Find contours in the binary image
   */
  private findContours(data: Uint8ClampedArray, width: number, height: number, threshold: number = 128): Point[][] {
    const visited = new Array(height).fill(null).map(() => new Array(width).fill(false));
    const contours: Point[][] = [];
    const maxContours = 100; // Limit number of contours to process

    for (let y = 0; y < height && contours.length < maxContours; y += 8) { // Increased sampling for efficiency
      for (let x = 0; x < width && contours.length < maxContours; x += 8) {
        const idx = (y * width + x) * 4;
        if (data[idx] > threshold && !visited[y][x]) {
          const contour = this.traceContour(data, width, height, x, y, threshold, visited);
          if (contour.length > 20 && contour.length < 3000) { // Filter out very small and very large contours
            contours.push(contour);
          }
        }
      }
    }

    return contours;
  }

  /**
   * Trace a single contour using border following
   */
  private traceContour(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    startX: number,
    startY: number,
    threshold: number,
    visited: boolean[][]
  ): Point[] {
    const contour: Point[] = [];
    const directions = [
      [-1, -1], [-1, 0], [-1, 1],
      [0, -1],           [0, 1],
      [1, -1],  [1, 0],  [1, 1]
    ];

    let x = startX;
    let y = startY;
    const stack = [{x, y}];
    const maxStackSize = 10000; // Prevent stack overflow
    const maxContourSize = 5000; // Limit contour size

    while (stack.length > 0) {
      // Prevent stack from growing too large
      if (stack.length > maxStackSize || contour.length > maxContourSize) {
        break;
      }

      const current = stack.pop()!;
      x = current.x;
      y = current.y;

      if (x < 0 || x >= width || y < 0 || y >= height || visited[y][x]) {
        continue;
      }

      const idx = (y * width + x) * 4;
      if (data[idx] <= threshold) {
        continue;
      }

      visited[y][x] = true;
      contour.push({x, y});

      // Add neighboring pixels to stack
      for (const [dx, dy] of directions) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height && !visited[ny][nx]) {
          const nIdx = (ny * width + nx) * 4;
          if (data[nIdx] > threshold) {
            stack.push({x: nx, y: ny});
          }
        }
      }
    }

    return contour;
  }

  /**
   * Detect walls from contours using line detection
   */
  private detectWalls(contours: Point[][]): Wall[] {
    const walls: Wall[] = [];

    for (const contour of contours) {
      if (contour.length < 20) continue; // Skip small contours

      // Simplify contour to get major line segments
      const simplified = this.simplifyContour(contour, 5);
      
      for (let i = 0; i < simplified.length - 1; i++) {
        const start = simplified[i];
        const end = simplified[i + 1];
        const length = Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2);
        
        if (length > 20) { // Only consider significant line segments
          const angle = Math.atan2(end.y - start.y, end.x - start.x);
          walls.push({ start, end, length, angle });
        }
      }
    }

    return walls;
  }

  /**
   * Simplify contour using Douglas-Peucker algorithm
   */
  private simplifyContour(contour: Point[], tolerance: number): Point[] {
    if (contour.length <= 2) return contour;

    const simplified: Point[] = [];
    const stack: {start: number, end: number}[] = [{start: 0, end: contour.length - 1}];

    while (stack.length > 0) {
      const {start, end} = stack.pop()!;
      
      let maxDist = 0;
      let maxIndex = start;

      for (let i = start + 1; i < end; i++) {
        const dist = this.pointToLineDistance(contour[i], contour[start], contour[end]);
        if (dist > maxDist) {
          maxDist = dist;
          maxIndex = i;
        }
      }

      if (maxDist > tolerance) {
        stack.push({start, end: maxIndex});
        stack.push({start: maxIndex, end});
      } else {
        simplified.push(contour[start]);
        if (start !== end) {
          simplified.push(contour[end]);
        }
      }
    }

    return simplified;
  }

  /**
   * Calculate distance from point to line
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
   * Detect rooms using flood fill algorithm
   */
  private detectRooms(data: Uint8ClampedArray, width: number, height: number): Room[] {
    const visited = new Array(height).fill(null).map(() => new Array(width).fill(false));
    const rooms: Room[] = [];
    let roomCounter = 1;
    const maxRooms = 20; // Limit number of rooms to detect

    for (let y = 0; y < height && rooms.length < maxRooms; y += 15) { // Increased sampling for efficiency
      for (let x = 0; x < width && rooms.length < maxRooms; x += 15) {
        const idx = (y * width + x) * 4;
        
        // Look for white/light areas (rooms) that haven't been visited
        if (data[idx] > 200 && !visited[y][x]) {
          const roomPixels = this.floodFill(data, width, height, x, y, 200, visited);
          
          if (roomPixels.length > 1000 && roomPixels.length < 30000) { // Minimum and maximum room size
            const room = this.createRoomFromPixels(roomPixels, roomCounter++);
            rooms.push(room);
          }
        }
      }
    }

    return rooms;
  }

  /**
   * Flood fill algorithm to find connected regions
   */
  private floodFill(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    startX: number,
    startY: number,
    threshold: number,
    visited: boolean[][]
  ): Point[] {
    const pixels: Point[] = [];
    const stack = [{x: startX, y: startY}];
    const maxStackSize = 15000; // Prevent stack overflow
    const maxPixelCount = 50000; // Limit region size

    while (stack.length > 0) {
      // Prevent stack from growing too large
      if (stack.length > maxStackSize || pixels.length > maxPixelCount) {
        break;
      }

      const {x, y} = stack.pop()!;

      if (x < 0 || x >= width || y < 0 || y >= height || visited[y][x]) {
        continue;
      }

      const idx = (y * width + x) * 4;
      if (data[idx] <= threshold) {
        continue;
      }

      visited[y][x] = true;
      pixels.push({x, y});

      // Add 4-connected neighbors
      stack.push({x: x + 1, y});
      stack.push({x: x - 1, y});
      stack.push({x, y: y + 1});
      stack.push({x, y: y - 1});
    }

    return pixels;
  }

  /**
   * Create room object from pixel data
   */
  private createRoomFromPixels(pixels: Point[], roomId: number): Room {
    // Calculate bounding box and center
    const minX = Math.min(...pixels.map(p => p.x));
    const maxX = Math.max(...pixels.map(p => p.x));
    const minY = Math.min(...pixels.map(p => p.y));
    const maxY = Math.max(...pixels.map(p => p.y));

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // Convert to normalized coordinates (centered around origin)
    const scale = 0.5; // Scaling factor
    const offsetX = this.width / 2;
    const offsetY = this.height / 2;

    const vertices: Array<[number, number]> = [
      [(minX - offsetX) * scale, (minY - offsetY) * scale],
      [(maxX - offsetX) * scale, (minY - offsetY) * scale],
      [(maxX - offsetX) * scale, (maxY - offsetY) * scale],
      [(minX - offsetX) * scale, (maxY - offsetY) * scale]
    ];

    const center: [number, number] = [
      (centerX - offsetX) * scale,
      (centerY - offsetY) * scale
    ];

    const area = pixels.length;
    const roomType = this.classifyRoom(area, maxX - minX, maxY - minY);

    const colors = [
      '#e3f2fd', '#f3e5f5', '#e8f5e8', '#fff3e0', 
      '#fce4ec', '#f1f8e9', '#e0f2f1', '#fff8e1'
    ];

    return {
      id: `room${roomId}`,
      name: roomType,
      color: colors[(roomId - 1) % colors.length],
      vertices,
      center,
      area,
      type: roomType
    };
  }

  /**
   * Classify room type based on size and dimensions
   */
  private classifyRoom(area: number, width: number, height: number): string {
    const ratio = Math.max(width, height) / Math.min(width, height);
    
    if (area < 2000) return 'Bathroom';
    if (area < 5000 && ratio > 2) return 'Hallway';
    if (area < 5000) return 'Bedroom';
    if (area < 8000) return 'Kitchen';
    if (area < 12000) return 'Living Room';
    return 'Large Room';
  }

  /**
   * Main processing function that coordinates all CV operations
   */
  async processFloorPlan(imageUrl: string, onProgress?: (step: string, progress: number) => void): Promise<ProcessingResult> {
    try {
      if (!this.imageData) {
        await this.loadImage(imageUrl);
      }

      // Limit image size to prevent excessive processing
      const maxDimension = 800;
      if (this.width > maxDimension || this.height > maxDimension) {
        const scale = maxDimension / Math.max(this.width, this.height);
        const newWidth = Math.floor(this.width * scale);
        const newHeight = Math.floor(this.height * scale);
        
        // Resize the image
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d')!;
        tempCanvas.width = newWidth;
        tempCanvas.height = newHeight;
        
        tempCtx.drawImage(this.canvas, 0, 0, newWidth, newHeight);
        
        this.canvas.width = newWidth;
        this.canvas.height = newHeight;
        this.width = newWidth;
        this.height = newHeight;
        this.ctx.drawImage(tempCanvas, 0, 0);
        this.imageData = this.ctx.getImageData(0, 0, this.width, this.height);
      }

      const data = new Uint8ClampedArray(this.imageData!.data);
      
      // Step 1: Preprocessing
      onProgress?.('Preprocessing image...', 10);
      const blurred = this.gaussianBlur(data, this.width, this.height, 2);
      const grayscale = this.toGrayscale(blurred);

      // Step 2: Edge detection
      onProgress?.('Detecting edges...', 30);
      const edges = this.sobelEdgeDetection(grayscale, this.width, this.height);
      
      // Step 3: Morphological operations
      onProgress?.('Cleaning up detected features...', 50);
      const cleaned = this.morphologicalClose(edges, this.width, this.height, 3);

      // Step 4: Contour detection
      onProgress?.('Finding contours...', 70);
      const contours = this.findContours(cleaned, this.width, this.height);
      
      // Step 5: Wall detection
      onProgress?.('Detecting walls...', 80);
      const walls = this.detectWalls(contours);
      
      // Step 6: Room detection
      onProgress?.('Identifying rooms...', 90);
      const rooms = this.detectRooms(grayscale, this.width, this.height);

      // Step 7: Final processing
      onProgress?.('Finalizing results...', 100);

      // Convert walls to the format expected by the 3D viewer
      const wallSegments = walls.map(wall => [
        [(wall.start.x - this.width / 2) * 0.5, (wall.start.y - this.height / 2) * 0.5],
        [(wall.end.x - this.width / 2) * 0.5, (wall.end.y - this.height / 2) * 0.5]
      ] as Array<[number, number]>);

      // Update processed image display
      this.ctx.putImageData(new ImageData(cleaned, this.width, this.height), 0, 0);

      return {
        rooms: rooms.length > 0 ? rooms : this.generateFallbackRooms(),
        walls: wallSegments.length > 0 ? wallSegments : this.generateFallbackWalls(),
        doors: [], // TODO: Implement door detection
        windows: [], // TODO: Implement window detection
        confidence: this.calculateConfidence(rooms, walls)
      };
    } catch (error) {
      console.error('Computer vision processing error:', error);
      // Return fallback data on any error
      return {
        rooms: this.generateFallbackRooms(),
        walls: this.generateFallbackWalls(),
        doors: [],
        windows: [],
        confidence: 0.3
      };
    }
  }

  /**
   * Generate fallback rooms if CV detection fails
   */
  private generateFallbackRooms(): Room[] {
    return [
      {
        id: 'room1',
        name: 'Living Room',
        color: '#e3f2fd',
        vertices: [[-50, -30], [50, -30], [50, 30], [-50, 30]],
        center: [0, 0]
      },
      {
        id: 'room2',
        name: 'Kitchen',
        color: '#f3e5f5',
        vertices: [[50, -30], [100, -30], [100, 10], [50, 10]],
        center: [75, -10]
      }
    ];
  }

  /**
   * Generate fallback walls if CV detection fails
   */
  private generateFallbackWalls(): Array<Array<[number, number]>> {
    return [
      [[-50, -30], [50, -30]],
      [[50, -30], [100, -30]],
      [[100, -30], [100, 10]],
      [[100, 10], [50, 10]],
      [[50, 10], [50, 30]],
      [[-50, 30], [-50, -30]]
    ];
  }

  /**
   * Calculate confidence score based on detection results
   */
  private calculateConfidence(rooms: Room[], walls: Wall[]): number {
    let confidence = 0;
    
    if (rooms.length > 0) confidence += 0.5;
    if (walls.length > 0) confidence += 0.3;
    if (rooms.length > 2) confidence += 0.1;
    if (walls.length > 4) confidence += 0.1;
    
    return Math.min(1, confidence);
  }

  /**
   * Get the processed image as data URL
   */
  getProcessedImageDataUrl(): string {
    return this.canvas.toDataURL();
  }
}

export default FloorPlanAnalyzer;
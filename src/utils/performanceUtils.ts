interface CacheEntry {
  imageData: string;
  processedData: any;
  timestamp: number;
}

interface UndoRedoState {
  rooms: any[];
  walls: any[];
  timestamp: number;
}

/**
 * Performance optimization utilities
 */
export class PerformanceManager {
  private static readonly CACHE_KEY = 'floorplan_cache';
  private static readonly MAX_CACHE_SIZE = 10;
  private static readonly CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Cache processed results
   */
  static cacheResult(imageData: string, processedData: any): void {
    try {
      const cache = this.getCache();
      const newEntry: CacheEntry = {
        imageData,
        processedData,
        timestamp: Date.now()
      };

      // Remove expired entries
      const validEntries = cache.filter(entry => 
        Date.now() - entry.timestamp < this.CACHE_EXPIRY
      );

      // Add new entry
      validEntries.push(newEntry);

      // Keep only the most recent entries
      const trimmedCache = validEntries
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, this.MAX_CACHE_SIZE);

      localStorage.setItem(this.CACHE_KEY, JSON.stringify(trimmedCache));
    } catch (error) {
      console.warn('Failed to cache result:', error);
    }
  }

  /**
   * Retrieve cached result
   */
  static getCachedResult(imageData: string): any | null {
    try {
      const cache = this.getCache();
      const entry = cache.find(entry => 
        entry.imageData === imageData && 
        Date.now() - entry.timestamp < this.CACHE_EXPIRY
      );
      return entry?.processedData || null;
    } catch (error) {
      console.warn('Failed to retrieve cache:', error);
      return null;
    }
  }

  /**
   * Get all cache entries
   */
  private static getCache(): CacheEntry[] {
    try {
      const cacheData = localStorage.getItem(this.CACHE_KEY);
      return cacheData ? JSON.parse(cacheData) : [];
    } catch (error) {
      console.warn('Failed to parse cache:', error);
      return [];
    }
  }

  /**
   * Clear cache
   */
  static clearCache(): void {
    try {
      localStorage.removeItem(this.CACHE_KEY);
    } catch (error) {
      console.warn('Failed to clear cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(): { size: number; totalSize: string; oldestEntry: Date | null } {
    const cache = this.getCache();
    const totalSize = new Blob([JSON.stringify(cache)]).size;
    const oldestEntry = cache.length > 0 
      ? new Date(Math.min(...cache.map(entry => entry.timestamp)))
      : null;

    return {
      size: cache.length,
      totalSize: `${(totalSize / 1024).toFixed(1)} KB`,
      oldestEntry
    };
  }
}

/**
 * Undo/Redo functionality
 */
export class UndoRedoManager {
  private static undoStack: UndoRedoState[] = [];
  private static redoStack: UndoRedoState[] = [];
  private static readonly MAX_HISTORY = 20;

  /**
   * Save current state to undo stack
   */
  static saveState(rooms: any[], walls: any[]): void {
    const state: UndoRedoState = {
      rooms: JSON.parse(JSON.stringify(rooms)),
      walls: JSON.parse(JSON.stringify(walls)),
      timestamp: Date.now()
    };

    this.undoStack.push(state);
    
    // Limit history size
    if (this.undoStack.length > this.MAX_HISTORY) {
      this.undoStack.shift();
    }

    // Clear redo stack when new state is saved
    this.redoStack = [];
  }

  /**
   * Undo last change
   */
  static undo(): UndoRedoState | null {
    if (this.undoStack.length === 0) return null;

    const currentState = this.undoStack.pop()!;
    this.redoStack.push(currentState);

    return this.undoStack.length > 0 ? this.undoStack[this.undoStack.length - 1] : null;
  }

  /**
   * Redo last undone change
   */
  static redo(): UndoRedoState | null {
    if (this.redoStack.length === 0) return null;

    const state = this.redoStack.pop()!;
    this.undoStack.push(state);

    return state;
  }

  /**
   * Check if undo is available
   */
  static canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /**
   * Check if redo is available
   */
  static canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Clear history
   */
  static clearHistory(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  /**
   * Get history statistics
   */
  static getHistoryStats(): { undoCount: number; redoCount: number } {
    return {
      undoCount: this.undoStack.length,
      redoCount: this.redoStack.length
    };
  }
}

/**
 * Measurement and scale detection utilities
 */
export class MeasurementTools {
  /**
   * Calculate distance between two points
   */
  static calculateDistance(point1: [number, number], point2: [number, number]): number {
    const dx = point2[0] - point1[0];
    const dy = point2[1] - point1[1];
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Calculate area of a polygon
   */
  static calculatePolygonArea(vertices: Array<[number, number]>): number {
    if (vertices.length < 3) return 0;

    let area = 0;
    for (let i = 0; i < vertices.length; i++) {
      const j = (i + 1) % vertices.length;
      area += vertices[i][0] * vertices[j][1];
      area -= vertices[j][0] * vertices[i][1];
    }
    return Math.abs(area) / 2;
  }

  /**
   * Calculate perimeter of a polygon
   */
  static calculatePerimeter(vertices: Array<[number, number]>): number {
    if (vertices.length < 2) return 0;

    let perimeter = 0;
    for (let i = 0; i < vertices.length; i++) {
      const next = (i + 1) % vertices.length;
      perimeter += this.calculateDistance(vertices[i], vertices[next]);
    }
    return perimeter;
  }

  /**
   * Convert units (assuming 1 unit = 1 foot for architectural plans)
   */
  static convertUnits(value: number, fromUnit: 'ft' | 'm' | 'units', toUnit: 'ft' | 'm' | 'units'): number {
    // Base conversion to feet
    let valueInFeet = value;
    if (fromUnit === 'm') valueInFeet = value * 3.28084;
    if (fromUnit === 'units') valueInFeet = value; // Assume units are feet

    // Convert from feet to target unit
    if (toUnit === 'm') return valueInFeet / 3.28084;
    if (toUnit === 'units') return valueInFeet;
    return valueInFeet; // ft
  }

  /**
   * Format measurement with appropriate units
   */
  static formatMeasurement(value: number, unit: 'ft' | 'm' | 'units' = 'ft', precision: number = 1): string {
    const formatted = value.toFixed(precision);
    const unitLabels = { ft: 'ft', m: 'm', units: 'units' };
    return `${formatted} ${unitLabels[unit]}`;
  }

  /**
   * Detect scale from known reference objects or dimensions
   */
  static detectScale(rooms: any[], knownRoomType?: string, knownDimension?: number): number {
    // Default scale assumptions for architectural plans
    const typicalRoomSizes = {
      'Bathroom': 50, // 50 sq ft typical
      'Bedroom': 120, // 120 sq ft typical
      'Kitchen': 150, // 150 sq ft typical
      'Living Room': 300, // 300 sq ft typical
      'Large Room': 400 // 400 sq ft typical
    };

    if (knownRoomType && knownDimension) {
      const room = rooms.find(r => r.type === knownRoomType || r.name === knownRoomType);
      if (room) {
        const calculatedArea = this.calculatePolygonArea(room.vertices);
        return knownDimension / calculatedArea;
      }
    }

    // Auto-detect based on typical room sizes
    for (const room of rooms) {
      const roomType = room.type || room.name;
      const expectedSize = typicalRoomSizes[roomType as keyof typeof typicalRoomSizes];
      
      if (expectedSize) {
        const calculatedArea = this.calculatePolygonArea(room.vertices);
        return expectedSize / calculatedArea;
      }
    }

    return 1; // Default scale
  }

  /**
   * Get room statistics with measurements
   */
  static getRoomStatistics(rooms: any[], scale: number = 1, unit: 'ft' | 'm' = 'ft'): any[] {
    return rooms.map(room => {
      const area = this.calculatePolygonArea(room.vertices) * scale;
      const perimeter = this.calculatePerimeter(room.vertices) * Math.sqrt(scale);
      const dimensions = this.getRoomDimensions(room.vertices, scale);

      return {
        ...room,
        measurements: {
          area: this.convertUnits(area, 'ft', unit),
          perimeter: this.convertUnits(perimeter, 'ft', unit),
          width: this.convertUnits(dimensions.width, 'ft', unit),
          height: this.convertUnits(dimensions.height, 'ft', unit),
          formattedArea: this.formatMeasurement(this.convertUnits(area, 'ft', unit), unit),
          formattedPerimeter: this.formatMeasurement(this.convertUnits(perimeter, 'ft', unit), unit),
          formattedDimensions: `${this.formatMeasurement(this.convertUnits(dimensions.width, 'ft', unit), unit)} × ${this.formatMeasurement(this.convertUnits(dimensions.height, 'ft', unit), unit)}`
        }
      };
    });
  }

  /**
   * Get room dimensions (width x height)
   */
  private static getRoomDimensions(vertices: Array<[number, number]>, scale: number): { width: number; height: number } {
    if (vertices.length === 0) return { width: 0, height: 0 };

    const xs = vertices.map(v => v[0]);
    const ys = vertices.map(v => v[1]);
    
    const width = (Math.max(...xs) - Math.min(...xs)) * Math.sqrt(scale);
    const height = (Math.max(...ys) - Math.min(...ys)) * Math.sqrt(scale);

    return { width, height };
  }
}

export { CacheEntry, UndoRedoState };
import React, { useState, useRef, useCallback } from 'react';
import { Upload, Download, RotateCcw, Palette, Layers3, Undo, Redo, Ruler, Settings } from 'lucide-react';
import ImageUploader from './ImageUploader';
import ImageProcessor from './ImageProcessor';
import ThreeDViewer from './ThreeDViewer';
import ColorPicker from './ColorPicker';
import { PerformanceManager, UndoRedoManager, MeasurementTools } from '../utils/performanceUtils';

interface Room {
  id: string;
  name: string;
  color: string;
  vertices: Array<[number, number]>;
  center: [number, number];
}

interface ProcessedData {
  rooms: Room[];
  walls: Array<Array<[number, number]>>;
  originalImage: string;
  processedImage: string;
}

const FloorPlanConverter: React.FC = () => {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [processedData, setProcessedData] = useState<ProcessedData | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<'upload' | 'process' | 'view'>('upload');
  const [showMeasurements, setShowMeasurements] = useState(false);
  const [measurementUnit, setMeasurementUnit] = useState<'ft' | 'm'>('ft');
  const [roomStatistics, setRoomStatistics] = useState<any[]>([]);
  
  const processorRef = useRef<{ processImage: () => void }>(null);
  const viewerRef = useRef<{ resetView: () => void, exportModel: () => void }>(null);

  const handleImageUpload = useCallback((imageData: string) => {
    setUploadedImage(imageData);
    setCurrentStep('process');
    setProcessedData(null);
    setSelectedRoom(null);
  }, []);

  const handleProcessComplete = useCallback((data: ProcessedData) => {
    // Save state for undo/redo
    if (processedData) {
      UndoRedoManager.saveState(processedData.rooms, processedData.walls);
    }

    // Cache the result for performance
    if (uploadedImage) {
      PerformanceManager.cacheResult(uploadedImage, data);
    }

    // Calculate room statistics with measurements
    const scale = MeasurementTools.detectScale(data.rooms);
    const statistics = MeasurementTools.getRoomStatistics(data.rooms, scale, measurementUnit);
    setRoomStatistics(statistics);

    setProcessedData(data);
    setCurrentStep('view');
    setIsProcessing(false);
  }, [uploadedImage, processedData, measurementUnit]);

  const handleProcessStart = useCallback(() => {
    // Check cache first for performance
    if (uploadedImage) {
      const cachedResult = PerformanceManager.getCachedResult(uploadedImage);
      if (cachedResult) {
        console.log('Using cached result for faster processing');
        handleProcessComplete(cachedResult);
        return;
      }
    }

    setIsProcessing(true);
    if (processorRef.current) {
      processorRef.current.processImage();
    }
  }, [uploadedImage, handleProcessComplete]);

  const handleRoomColorChange = useCallback((roomId: string, color: string) => {
    if (!processedData) return;
    
    // Save state for undo/redo
    UndoRedoManager.saveState(processedData.rooms, processedData.walls);
    
    const updatedData = {
      ...processedData,
      rooms: processedData.rooms.map(room =>
        room.id === roomId ? { ...room, color } : room
      )
    };
    setProcessedData(updatedData);
  }, [processedData]);

  const handleRoomSelect = useCallback((roomId: string | null) => {
    setSelectedRoom(roomId);
  }, []);

  const handleUndo = useCallback(() => {
    const previousState = UndoRedoManager.undo();
    if (previousState && processedData) {
      const updatedData = {
        ...processedData,
        rooms: previousState.rooms,
        walls: previousState.walls
      };
      setProcessedData(updatedData);
    }
  }, [processedData]);

  const handleRedo = useCallback(() => {
    const nextState = UndoRedoManager.redo();
    if (nextState && processedData) {
      const updatedData = {
        ...processedData,
        rooms: nextState.rooms,
        walls: nextState.walls
      };
      setProcessedData(updatedData);
    }
  }, [processedData]);

  const handleToggleMeasurements = useCallback(() => {
    setShowMeasurements(!showMeasurements);
  }, [showMeasurements]);

  const handleUnitChange = useCallback((unit: 'ft' | 'm') => {
    setMeasurementUnit(unit);
    if (processedData) {
      const scale = MeasurementTools.detectScale(processedData.rooms);
      const statistics = MeasurementTools.getRoomStatistics(processedData.rooms, scale, unit);
      setRoomStatistics(statistics);
    }
  }, [processedData]);

  const handleResetView = useCallback(() => {
    if (viewerRef.current) {
      viewerRef.current.resetView();
    }
  }, []);

  const handleExportModel = useCallback(() => {
    if (viewerRef.current) {
      viewerRef.current.exportModel();
    }
  }, []);

  const handleReset = useCallback(() => {
    UndoRedoManager.clearHistory();
    PerformanceManager.clearCache();
    setUploadedImage(null);
    setProcessedData(null);
    setSelectedRoom(null);
    setCurrentStep('upload');
    setIsProcessing(false);
    setShowMeasurements(false);
    setRoomStatistics([]);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="bg-white/95 backdrop-blur-xl shadow-xl border-b border-indigo-200/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl shadow-lg">
                <Layers3 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Floor Plan 3D Converter
                </h1>
                <p className="text-sm text-slate-600 font-medium">Transform 2D floor plans into stunning interactive 3D models</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {currentStep === 'view' && (
                <>
                  <button
                    onClick={handleUndo}
                    disabled={!UndoRedoManager.canUndo()}
                    className={`inline-flex items-center px-3 py-2 border border-indigo-200 rounded-xl text-sm font-medium transition-all duration-200 shadow-sm hover:shadow-lg ${
                      UndoRedoManager.canUndo() 
                        ? 'text-indigo-700 bg-white/90 hover:bg-indigo-50' 
                        : 'text-gray-400 bg-gray-100 cursor-not-allowed'
                    }`}
                  >
                    <Undo className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleRedo}
                    disabled={!UndoRedoManager.canRedo()}
                    className={`inline-flex items-center px-3 py-2 border border-indigo-200 rounded-xl text-sm font-medium transition-all duration-200 shadow-sm hover:shadow-lg ${
                      UndoRedoManager.canRedo() 
                        ? 'text-indigo-700 bg-white/90 hover:bg-indigo-50' 
                        : 'text-gray-400 bg-gray-100 cursor-not-allowed'
                    }`}
                  >
                    <Redo className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleToggleMeasurements}
                    className={`inline-flex items-center px-4 py-2 border border-indigo-200 rounded-xl text-sm font-medium transition-all duration-200 shadow-sm hover:shadow-lg ${
                      showMeasurements 
                        ? 'text-white bg-indigo-600 hover:bg-indigo-700' 
                        : 'text-indigo-700 bg-white/90 hover:bg-indigo-50'
                    }`}
                  >
                    <Ruler className="w-4 h-4 mr-2" />
                    Measurements
                  </button>
                  <button
                    onClick={handleResetView}
                    className="inline-flex items-center px-4 py-2 border border-indigo-200 rounded-xl text-sm font-medium text-indigo-700 bg-white/90 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-200 shadow-sm hover:shadow-lg"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Reset View
                  </button>
                  <button
                    onClick={handleExportModel}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-xl text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </button>
                </>
              )}
              <button
                onClick={handleReset}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-xl text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                <Upload className="w-4 h-4 mr-2" />
                New Project
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Progress Indicator */}
      <div className="bg-white/80 backdrop-blur-md border-b border-indigo-200/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-center space-x-8">
            {['upload', 'process', 'view'].map((step, index) => (
              <div key={step} className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium shadow-lg transition-all duration-300 ${
                  currentStep === step
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white scale-110'
                    : index < ['upload', 'process', 'view'].indexOf(currentStep)
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white'
                    : 'bg-white text-slate-600 border-2 border-slate-200'
                }`}>
                  {index + 1}
                </div>
                <span className={`ml-2 text-sm font-medium capitalize ${
                  currentStep === step ? 'text-indigo-600 font-semibold' : 'text-slate-600'
                }`}>
                  {step}
                </span>
                {index < 2 && (
                  <div className={`ml-8 w-16 h-1 rounded-full transition-all duration-500 ${
                    index < ['upload', 'process', 'view'].indexOf(currentStep)
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                      : 'bg-slate-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentStep === 'upload' && (
          <div className="text-center">
            <ImageUploader onImageUpload={handleImageUpload} />
          </div>
        )}

        {currentStep === 'process' && uploadedImage && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-slate-900 mb-2">Process Floor Plan</h2>
              <p className="text-slate-600">Analyze the uploaded image to detect rooms and walls</p>
            </div>
            
            <ImageProcessor
              ref={processorRef}
              imageData={uploadedImage}
              onProcessComplete={handleProcessComplete}
              onProcessStart={handleProcessStart}
              isProcessing={isProcessing}
            />
            
            {!isProcessing && (
              <div className="text-center">
                <button
                  onClick={handleProcessStart}
                  className="inline-flex items-center px-8 py-4 border border-transparent rounded-2xl text-base font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  <Layers3 className="w-5 h-5 mr-2" />
                  Process Image
                </button>
              </div>
            )}
          </div>
        )}

        {currentStep === 'view' && processedData && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* 3D Viewer */}
            <div className="lg:col-span-3">
              <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border border-indigo-200/30 p-6 hover:shadow-3xl transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    Interactive 3D Model
                  </h2>
                  {selectedRoom && (
                    <div className="flex items-center space-x-2 bg-indigo-50 px-3 py-1 rounded-full">
                      <Palette className="w-4 h-4 text-slate-600" />
                      <span className="text-sm text-indigo-700 font-medium">
                        Selected: {processedData.rooms.find(r => r.id === selectedRoom)?.name}
                      </span>
                    </div>
                  )}
                </div>
                <div className="aspect-video bg-gradient-to-br from-slate-50 to-indigo-50 rounded-2xl overflow-hidden shadow-inner border border-indigo-100">
                  <ThreeDViewer
                    ref={viewerRef}
                    processedData={processedData}
                    selectedRoom={selectedRoom}
                    onRoomSelect={handleRoomSelect}
                  />
                </div>
              </div>
            </div>

            {/* Controls Panel */}
            <div className="space-y-6">
              {/* Room List */}
              <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border border-indigo-200/30 p-6 hover:shadow-3xl transition-all duration-300">
                <h3 className="text-lg font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-4">
                  Rooms
                </h3>
                <div className="space-y-2">
                  {processedData.rooms.map((room) => (
                    <button
                      key={room.id}
                      onClick={() => handleRoomSelect(room.id === selectedRoom ? null : room.id)}
                      className={`w-full text-left p-4 rounded-xl border transition-all duration-200 transform hover:scale-105 ${
                        selectedRoom === room.id
                          ? 'border-indigo-400 bg-gradient-to-r from-indigo-50 to-purple-50 shadow-md'
                          : 'border-slate-200 hover:bg-gradient-to-r hover:from-indigo-25 hover:to-purple-25 hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div
                          className="w-5 h-5 rounded-lg border-2 border-white shadow-md"
                          style={{ backgroundColor: room.color }}
                        />
                        <span className="font-semibold text-slate-900">{room.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Picker */}
              {selectedRoom && (
                <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border border-indigo-200/30 p-6 hover:shadow-3xl transition-all duration-300">
                  <h3 className="text-lg font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-4">
                    Customize Color
                  </h3>
                  <ColorPicker
                    roomId={selectedRoom}
                    currentColor={processedData.rooms.find(r => r.id === selectedRoom)?.color || '#ffffff'}
                    onColorChange={handleRoomColorChange}
                  />
                </div>
              )}

              {/* Measurements Panel */}
              {showMeasurements && (
                <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border border-indigo-200/30 p-6 hover:shadow-3xl transition-all duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                      Room Measurements
                    </h3>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleUnitChange('ft')}
                        className={`px-3 py-1 text-xs rounded-full transition-all duration-200 ${
                          measurementUnit === 'ft' 
                            ? 'bg-indigo-600 text-white' 
                            : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'
                        }`}
                      >
                        ft
                      </button>
                      <button
                        onClick={() => handleUnitChange('m')}
                        className={`px-3 py-1 text-xs rounded-full transition-all duration-200 ${
                          measurementUnit === 'm' 
                            ? 'bg-indigo-600 text-white' 
                            : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'
                        }`}
                      >
                        m
                      </button>
                    </div>
                  </div>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {roomStatistics.map((room) => (
                      <div 
                        key={room.id} 
                        className={`p-3 rounded-lg border transition-all duration-200 ${
                          selectedRoom === room.id
                            ? 'border-indigo-400 bg-gradient-to-r from-indigo-50 to-purple-50'
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <div
                              className="w-3 h-3 rounded-full border border-white shadow-sm"
                              style={{ backgroundColor: room.color }}
                            />
                            <span className="font-semibold text-sm">{room.name}</span>
                          </div>
                        </div>
                        {room.measurements && (
                          <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                            <div>
                              <span className="font-medium">Area:</span>
                              <br />
                              <span className="text-indigo-600 font-bold">{room.measurements.formattedArea}</span>
                            </div>
                            <div>
                              <span className="font-medium">Dimensions:</span>
                              <br />
                              <span className="text-indigo-600 font-bold">{room.measurements.formattedDimensions}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Statistics */}
              <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border border-indigo-200/30 p-6 hover:shadow-3xl transition-all duration-300">
                <h3 className="text-lg font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-4">
                  Project Stats
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl">
                    <span className="text-slate-600">Rooms Detected:</span>
                    <span className="font-bold text-indigo-600 text-lg">{processedData.rooms.length}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl">
                    <span className="text-slate-600">Wall Segments:</span>
                    <span className="font-bold text-emerald-600 text-lg">{processedData.walls.length}</span>
                  </div>
                  {roomStatistics.length > 0 && (
                    <div className="flex justify-between items-center p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl">
                      <span className="text-slate-600">Total Area:</span>
                      <span className="font-bold text-green-600 text-lg">
                        {MeasurementTools.formatMeasurement(
                          roomStatistics.reduce((sum, room) => sum + (room.measurements?.area || 0), 0),
                          measurementUnit
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default FloorPlanConverter;
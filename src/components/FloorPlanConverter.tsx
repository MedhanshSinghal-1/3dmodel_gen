import React, { useState, useRef, useCallback } from 'react';
import { Upload, Download, RotateCcw, Palette, Layers3 } from 'lucide-react';
import ImageUploader from './ImageUploader';
import ImageProcessor from './ImageProcessor';
import ThreeDViewer from './ThreeDViewer';
import ColorPicker from './ColorPicker';

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
  
  const processorRef = useRef<{ processImage: () => void }>(null);
  const viewerRef = useRef<{ resetView: () => void, exportModel: () => void }>(null);

  const handleImageUpload = useCallback((imageData: string) => {
    setUploadedImage(imageData);
    setCurrentStep('process');
    setProcessedData(null);
    setSelectedRoom(null);
  }, []);

  const handleProcessComplete = useCallback((data: ProcessedData) => {
    setProcessedData(data);
    setCurrentStep('view');
    setIsProcessing(false);
  }, []);

  const handleProcessStart = useCallback(() => {
    setIsProcessing(true);
    if (processorRef.current) {
      processorRef.current.processImage();
    }
  }, []);

  const handleRoomColorChange = useCallback((roomId: string, color: string) => {
    if (!processedData) return;
    
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

  const handleReset = useCallback(() => {
    setUploadedImage(null);
    setProcessedData(null);
    setSelectedRoom(null);
    setCurrentStep('upload');
    setIsProcessing(false);
  }, []);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-600 rounded-lg">
                <Layers3 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Floor Plan 3D Converter</h1>
                <p className="text-sm text-slate-600">Transform 2D floor plans into interactive 3D models</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {currentStep === 'view' && (
                <>
                  <button
                    onClick={handleResetView}
                    className="inline-flex items-center px-3 py-2 border border-slate-300 rounded-md text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Reset View
                  </button>
                  <button
                    onClick={handleExportModel}
                    className="inline-flex items-center px-3 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </button>
                </>
              )}
              <button
                onClick={handleReset}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              >
                <Upload className="w-4 h-4 mr-2" />
                New Project
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Progress Indicator */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-center space-x-8">
            {['upload', 'process', 'view'].map((step, index) => (
              <div key={step} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  currentStep === step
                    ? 'bg-blue-600 text-white'
                    : index < ['upload', 'process', 'view'].indexOf(currentStep)
                    ? 'bg-green-600 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}>
                  {index + 1}
                </div>
                <span className={`ml-2 text-sm font-medium capitalize ${
                  currentStep === step ? 'text-blue-600' : 'text-slate-600'
                }`}>
                  {step}
                </span>
                {index < 2 && (
                  <div className={`ml-8 w-16 h-0.5 ${
                    index < ['upload', 'process', 'view'].indexOf(currentStep)
                      ? 'bg-green-600'
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
                  className="inline-flex items-center px-6 py-3 border border-transparent rounded-md text-base font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                >
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
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-slate-900">3D Model</h2>
                  {selectedRoom && (
                    <div className="flex items-center space-x-2">
                      <Palette className="w-4 h-4 text-slate-600" />
                      <span className="text-sm text-slate-600">
                        Selected: {processedData.rooms.find(r => r.id === selectedRoom)?.name}
                      </span>
                    </div>
                  )}
                </div>
                <div className="aspect-video bg-slate-100 rounded-lg overflow-hidden">
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
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Rooms</h3>
                <div className="space-y-2">
                  {processedData.rooms.map((room) => (
                    <button
                      key={room.id}
                      onClick={() => handleRoomSelect(room.id === selectedRoom ? null : room.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        selectedRoom === room.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div
                          className="w-4 h-4 rounded border border-slate-300"
                          style={{ backgroundColor: room.color }}
                        />
                        <span className="font-medium text-slate-900">{room.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Picker */}
              {selectedRoom && (
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Room Color</h3>
                  <ColorPicker
                    roomId={selectedRoom}
                    currentColor={processedData.rooms.find(r => r.id === selectedRoom)?.color || '#ffffff'}
                    onColorChange={handleRoomColorChange}
                  />
                </div>
              )}

              {/* Statistics */}
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Statistics</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Rooms Detected:</span>
                    <span className="font-medium">{processedData.rooms.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Wall Segments:</span>
                    <span className="font-medium">{processedData.walls.length}</span>
                  </div>
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
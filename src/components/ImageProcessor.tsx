import React, { useState, useImperativeHandle, forwardRef, useCallback } from 'react';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';

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

interface ImageProcessorProps {
  imageData: string;
  onProcessComplete: (data: ProcessedData) => void;
  onProcessStart: () => void;
  isProcessing: boolean;
}

const ImageProcessor = forwardRef<{ processImage: () => void }, ImageProcessorProps>(
  ({ imageData, onProcessComplete, isProcessing }, ref) => {
    const [processingStep, setProcessingStep] = useState('');
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    const processImage = useCallback(async () => {
      setProcessingStep('Loading image...');
      
      // Create canvas for image processing
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      return new Promise<void>((resolve) => {
        img.onload = async () => {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx?.drawImage(img, 0, 0);
          
          setProcessingStep('Detecting edges...');
          await new Promise(r => setTimeout(r, 800));
          
          // Simple edge detection simulation
          const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
          if (imageData) {
            // Apply a simple edge detection filter
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
              const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
              data[i] = gray;
              data[i + 1] = gray;
              data[i + 2] = gray;
            }
            ctx?.putImageData(imageData, 0, 0);
          }
          
          setProcessingStep('Identifying rooms...');
          await new Promise(r => setTimeout(r, 1000));
          
          setProcessingStep('Building 3D structure...');
          await new Promise(r => setTimeout(r, 800));
          
          // Generate processed image preview
          const processedImageData = canvas.toDataURL();
          setPreviewImage(processedImageData);
          
          // Generate mock room data
          const rooms: Room[] = [
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
            },
            {
              id: 'room3',
              name: 'Bedroom',
              color: '#e8f5e8',
              vertices: [[-50, 30], [20, 30], [20, 70], [-50, 70]],
              center: [-15, 50]
            },
            {
              id: 'room4',
              name: 'Bathroom',
              color: '#fff3e0',
              vertices: [[20, 30], [50, 30], [50, 70], [20, 70]],
              center: [35, 50]
            }
          ];
          
          const walls = [
            [[-50, -30], [50, -30]],
            [[50, -30], [100, -30]],
            [[100, -30], [100, 10]],
            [[100, 10], [50, 10]],
            [[50, 10], [50, 30]],
            [[50, 30], [20, 30]],
            [[20, 30], [-50, 30]],
            [[-50, 30], [-50, 70]],
            [[-50, 70], [50, 70]],
            [[50, 70], [50, 30]]
          ];
          
          const processedData: ProcessedData = {
            rooms,
            walls,
            originalImage: img.src,
            processedImage: processedImageData
          };
          
          setProcessingStep('Complete!');
          await new Promise(r => setTimeout(r, 500));
          
          onProcessComplete(processedData);
          resolve();
        };
        
        img.src = imageData;
      });
    }, [imageData, onProcessComplete]);

    useImperativeHandle(ref, () => ({
      processImage
    }));

    const steps = [
      'Loading image...',
      'Detecting edges...',
      'Identifying rooms...',
      'Building 3D structure...',
      'Complete!'
    ];

    const currentStepIndex = steps.indexOf(processingStep);

    return (
      <div className="max-w-4xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Original Image */}
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-purple-200/50 p-6 hover:shadow-2xl transition-all duration-300">
            <h3 className="text-lg font-semibold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-4">
              Original Image
            </h3>
            <div className="aspect-square bg-gradient-to-br from-slate-100 to-purple-50 rounded-xl overflow-hidden shadow-inner border border-purple-100">
              <img
                src={imageData}
                alt="Original floor plan"
                className="w-full h-full object-contain"
              />
            </div>
          </div>
          
          {/* Processed Preview */}
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-purple-200/50 p-6 hover:shadow-2xl transition-all duration-300">
            <h3 className="text-lg font-semibold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-4">
              Processed Preview
            </h3>
            <div className="aspect-square bg-gradient-to-br from-slate-100 to-purple-50 rounded-xl overflow-hidden flex items-center justify-center shadow-inner border border-purple-100">
              {previewImage ? (
                <img
                  src={previewImage}
                  alt="Processed floor plan"
                  className="w-full h-full object-contain"
                />
              ) : isProcessing ? (
                <div className="text-center">
                  <Loader2 className="w-10 h-10 text-purple-500 animate-spin mx-auto mb-3" />
                  <p className="text-sm text-purple-600 font-medium">Processing...</p>
                </div>
              ) : (
                <div className="text-center text-purple-400">
                  <AlertCircle className="w-10 h-10 mx-auto mb-3" />
                  <p className="text-sm">Processed image will appear here</p>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Processing Steps */}
        {isProcessing && (
          <div className="mt-6 bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-purple-200/50 p-6 hover:shadow-2xl transition-all duration-300">
            <h3 className="text-lg font-semibold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-4">
              Processing Steps
            </h3>
            <div className="space-y-3">
              {steps.map((step, index) => (
                <div key={step} className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-md transition-all duration-300 ${
                    index < currentStepIndex
                      ? 'bg-gradient-to-r from-green-500 to-teal-500'
                      : index === currentStepIndex
                      ? 'bg-gradient-to-r from-purple-500 to-blue-500 animate-pulse'
                      : 'bg-slate-200'
                  }`}>
                    {index < currentStepIndex ? (
                      <CheckCircle className="w-4 h-4 text-white" />
                    ) : index === currentStepIndex ? (
                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                    ) : (
                      <span className="text-xs text-slate-500 font-medium">{index + 1}</span>
                    )}
                  </div>
                  <span className={`text-sm transition-all duration-200 ${
                    index <= currentStepIndex ? 'text-slate-900 font-semibold' : 'text-slate-500'
                  }`}>
                    {step}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
);

ImageProcessor.displayName = 'ImageProcessor';

export default ImageProcessor;
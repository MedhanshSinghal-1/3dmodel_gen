import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Image as ImageIcon } from 'lucide-react';

interface ImageUploaderProps {
  onImageUpload: (imageData: string) => void;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageUpload }) => {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        onImageUpload(result);
      };
      reader.readAsDataURL(file);
    }
  }, [onImageUpload]);

  const handleExampleClick = useCallback((exampleId: number) => {
    // Create a simple floor plan as SVG and convert to data URL
    const svg = generateExampleFloorPlan(exampleId);
    const dataUrl = `data:image/svg+xml;base64,${btoa(svg)}`;
    onImageUpload(dataUrl);
  }, [onImageUpload]);

  const generateExampleFloorPlan = (id: number): string => {
    const width = 400;
    const height = 300;
    
    const plans = {
      1: {
        // Simple layout - living room and bedroom
        walls: [
          'M50,50 L350,50 L350,250 L50,250 Z',
          'M200,50 L200,150',
          'M50,150 L200,150'
        ],
        rooms: [
          { x: 125, y: 100, text: 'Living Room' },
          { x: 275, y: 150, text: 'Bedroom' },
          { x: 125, y: 200, text: 'Kitchen' }
        ]
      },
      2: {
        // Open floor plan
        walls: [
          'M50,50 L350,50 L350,250 L50,250 Z',
          'M300,50 L300,120',
          'M200,180 L350,180'
        ],
        rooms: [
          { x: 150, y: 120, text: 'Open Living Area' },
          { x: 325, y: 85, text: 'Kitchen' },
          { x: 275, y: 215, text: 'Bedroom' }
        ]
      },
      3: {
        // Multi-room layout
        walls: [
          'M50,50 L350,50 L350,250 L50,250 Z',
          'M150,50 L150,150',
          'M250,50 L250,150',
          'M50,150 L350,150',
          'M200,150 L200,250'
        ],
        rooms: [
          { x: 100, y: 100, text: 'BR1' },
          { x: 200, y: 100, text: 'Bath' },
          { x: 300, y: 100, text: 'BR2' },
          { x: 125, y: 200, text: 'Living' },
          { x: 275, y: 200, text: 'Kitchen' }
        ]
      }
    };
    
    const plan = plans[id as keyof typeof plans];
    
    return `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <style>
            .wall { fill: none; stroke: #333; stroke-width: 3; }
            .room-text { font-family: Arial; font-size: 12px; text-anchor: middle; fill: #666; }
          </style>
        </defs>
        <rect width="100%" height="100%" fill="#f8f9fa"/>
        ${plan.walls.map(wall => `<path d="${wall}" class="wall"/>`).join('')}
        ${plan.rooms.map(room => `<text x="${room.x}" y="${room.y}" class="room-text">${room.text}</text>`).join('')}
      </svg>
    `;
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg']
    },
    multiple: false
  });

  return (
    <div className="max-w-2xl mx-auto">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-300 transform hover:scale-105 ${
          isDragActive
            ? 'border-indigo-500 bg-gradient-to-br from-indigo-50 to-purple-50 shadow-xl'
            : 'border-indigo-300 hover:border-indigo-400 hover:bg-gradient-to-br hover:from-indigo-25 hover:to-purple-25 hover:shadow-lg'
        }`}
      >
        <input {...getInputProps()} />
        <div className="space-y-4">
          <div className="mx-auto w-20 h-20 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center shadow-lg">
            {isDragActive ? (
              <Upload className="w-10 h-10 text-indigo-600 animate-bounce" />
            ) : (
              <ImageIcon className="w-10 h-10 text-indigo-500" />
            )}
          </div>
          <div>
            <h3 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
              {isDragActive ? 'Drop your floor plan here!' : 'Upload Your Floor Plan'}
            </h3>
            <p className="text-slate-700 mb-4 font-medium">
              Drag and drop your 2D floor plan image, or click to browse files
            </p>
            <p className="text-sm text-slate-600">
              Supports PNG, JPG, JPEG files up to 10MB
            </p>
          </div>
          <button className="inline-flex items-center px-6 py-3 border border-transparent rounded-2xl text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105">
            <Upload className="w-4 h-4 mr-2" />
            Choose File
          </button>
        </div>
      </div>
      
      {/* Example images */}
      <div className="mt-8 text-center">
        <h4 className="text-base font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-4">
          Example Floor Plans
        </h4>
        <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
          {[
            { id: 1, name: 'Simple Layout' },
            { id: 2, name: 'Open Floor' },
            { id: 3, name: 'Multi-Room' }
          ].map((example) => (
            <div 
              key={example.id} 
              className="aspect-square bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl flex flex-col items-center justify-center shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer transform hover:scale-105"
              onClick={() => handleExampleClick(example.id)}
            >
              <ImageIcon className="w-8 h-8 text-indigo-400 mb-2" />
              <span className="text-xs text-indigo-600 font-medium text-center px-2">
                {example.name}
              </span>
            </div>
          ))}
        </div>
        <p className="text-sm text-slate-600 mt-3 font-medium">
          Click on any example to use it as a demo
        </p>
      </div>
    </div>
  );
};

export default ImageUploader;
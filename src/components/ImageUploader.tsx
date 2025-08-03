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
        className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'
        }`}
      >
        <input {...getInputProps()} />
        <div className="space-y-4">
          <div className="mx-auto w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
            {isDragActive ? (
              <Upload className="w-8 h-8 text-blue-500" />
            ) : (
              <ImageIcon className="w-8 h-8 text-slate-500" />
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              {isDragActive ? 'Drop your floor plan here' : 'Upload Floor Plan'}
            </h3>
            <p className="text-slate-600 mb-4">
              Drag and drop your 2D floor plan image, or click to browse
            </p>
            <p className="text-sm text-slate-500">
              Supports PNG, JPG, JPEG files up to 10MB
            </p>
          </div>
          <button className="inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors">
            <Upload className="w-4 h-4 mr-2" />
            Choose File
          </button>
        </div>
      </div>
      
      {/* Example images */}
      <div className="mt-8 text-center">
        <h4 className="text-sm font-medium text-slate-900 mb-4">Example Floor Plans</h4>
        <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
          {[1, 2, 3].map((i) => (
            <div key={i} className="aspect-square bg-slate-200 rounded-lg flex items-center justify-center">
              <ImageIcon className="w-6 h-6 text-slate-400" />
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Click on any example to use it as a demo
        </p>
      </div>
    </div>
  );
};

export default ImageUploader;
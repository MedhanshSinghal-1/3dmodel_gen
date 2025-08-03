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
        className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-300 transform hover:scale-105 ${
          isDragActive
            ? 'border-purple-500 bg-gradient-to-br from-purple-50 to-blue-50 shadow-xl'
            : 'border-purple-300 hover:border-purple-400 hover:bg-gradient-to-br hover:from-purple-25 hover:to-blue-25 hover:shadow-lg'
        }`}
      >
        <input {...getInputProps()} />
        <div className="space-y-4">
          <div className="mx-auto w-20 h-20 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full flex items-center justify-center shadow-lg">
            {isDragActive ? (
              <Upload className="w-10 h-10 text-purple-600 animate-bounce" />
            ) : (
              <ImageIcon className="w-10 h-10 text-purple-500" />
            )}
          </div>
          <div>
            <h3 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-2">
              {isDragActive ? 'Drop your floor plan here!' : 'Upload Your Floor Plan'}
            </h3>
            <p className="text-slate-700 mb-4 font-medium">
              Drag and drop your 2D floor plan image, or click to browse files
            </p>
            <p className="text-sm text-slate-600">
              Supports PNG, JPG, JPEG files up to 10MB
            </p>
          </div>
          <button className="inline-flex items-center px-6 py-3 border border-transparent rounded-xl text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105">
            <Upload className="w-4 h-4 mr-2" />
            Choose File
          </button>
        </div>
      </div>
      
      {/* Example images */}
      <div className="mt-8 text-center">
        <h4 className="text-base font-semibold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-4">
          Example Floor Plans
        </h4>
        <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
          {[1, 2, 3].map((i) => (
            <div key={i} className="aspect-square bg-gradient-to-br from-purple-100 to-blue-100 rounded-xl flex items-center justify-center shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer transform hover:scale-105">
              <ImageIcon className="w-8 h-8 text-purple-400" />
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
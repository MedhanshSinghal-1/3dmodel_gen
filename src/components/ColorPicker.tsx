import React, { useState } from 'react';
import { Palette } from 'lucide-react';

interface ColorPickerProps {
  roomId: string;
  currentColor: string;
  onColorChange: (roomId: string, color: string) => void;
}

const ColorPicker: React.FC<ColorPickerProps> = ({ roomId, currentColor, onColorChange }) => {
  const [showPalette, setShowPalette] = useState(false);

  const presetColors = [
    '#e3f2fd', // Light Blue
    '#f3e5f5', // Light Purple
    '#e8f5e8', // Light Green
    '#fff3e0', // Light Orange
    '#fce4ec', // Light Pink
    '#f1f8e9', // Light Lime
    '#e0f2f1', // Light Teal
    '#fff8e1', // Light Yellow
    '#efebe9', // Light Brown
    '#fafafa', // Light Gray
    '#ffebee', // Light Red
    '#e8eaf6', // Light Indigo
    '#f9fbe7', // Light Yellow Green
    '#fff2e7', // Light Deep Orange
    '#f3e5f5', // Light Deep Purple
    '#e1f5fe'  // Light Cyan
  ];

  const handleColorSelect = (color: string) => {
    onColorChange(roomId, color);
    setShowPalette(false);
  };

  const handleCustomColorChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onColorChange(roomId, event.target.value);
  };

  return (
    <div className="space-y-4">
      {/* Current Color Display */}
      <div className="flex items-center space-x-3">
        <div
          className="w-14 h-14 rounded-xl border-3 border-white shadow-lg cursor-pointer transform hover:scale-110 transition-all duration-200"
          style={{ backgroundColor: currentColor }}
          onClick={() => setShowPalette(!showPalette)}
        />
        <div>
          <p className="text-sm font-semibold text-slate-900">Current Color</p>
          <p className="text-xs text-purple-600 font-mono bg-purple-50 px-2 py-1 rounded">{currentColor}</p>
        </div>
      </div>

      {/* Custom Color Input */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          🎨 Custom Color
        </label>
        <div className="flex items-center space-x-2">
          <input
            type="color"
            value={currentColor}
            onChange={handleCustomColorChange}
            className="w-12 h-12 border-2 border-purple-200 rounded-lg cursor-pointer shadow-md hover:shadow-lg transition-all duration-200"
          />
          <input
            type="text"
            value={currentColor}
            onChange={(e) => onColorChange(roomId, e.target.value)}
            className="flex-1 px-4 py-2 border border-purple-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white/80 backdrop-blur-sm shadow-sm"
            placeholder="#ffffff"
          />
        </div>
      </div>

      {/* Preset Colors */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-medium text-slate-700">
            🌈 Preset Colors
          </label>
          <button
            onClick={() => setShowPalette(!showPalette)}
            className="text-xs text-purple-600 hover:text-purple-700 flex items-center font-medium bg-purple-50 px-2 py-1 rounded-full hover:bg-purple-100 transition-all duration-200"
          >
            <Palette className="w-3 h-3 mr-1" />
            {showPalette ? 'Hide' : 'Show'} Palette
          </button>
        </div>
        
        {showPalette && (
          <div className="grid grid-cols-4 gap-3 p-3 bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl">
            {presetColors.map((color) => (
              <button
                key={color}
                onClick={() => handleColorSelect(color)}
                className={`w-12 h-12 rounded-xl border-3 hover:scale-110 transition-all duration-200 shadow-md hover:shadow-lg ${
                  currentColor === color ? 'border-purple-500 ring-2 ring-purple-200' : 'border-white'
                }`}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="flex space-x-2">
        <button
          onClick={() => handleColorSelect('#ffffff')}
          className="flex-1 px-4 py-2 text-xs border border-purple-200 rounded-lg hover:bg-purple-50 transition-all duration-200 font-medium bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-md"
        >
          🔄 Reset
        </button>
        <button
          onClick={() => {
            const randomColor = presetColors[Math.floor(Math.random() * presetColors.length)];
            handleColorSelect(randomColor);
          }}
          className="flex-1 px-4 py-2 text-xs border border-purple-200 rounded-lg hover:bg-purple-50 transition-all duration-200 font-medium bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-md"
        >
          🎲 Random
        </button>
      </div>
    </div>
  );
};

export default ColorPicker;
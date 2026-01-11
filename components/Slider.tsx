import React from 'react';

interface SliderProps {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  unit?: string;
}

const Slider: React.FC<SliderProps> = ({ label, min, max, step, value, onChange, unit = '' }) => {
  // Format value to 2 decimal places if it's not an integer
  const displayValue = Number.isInteger(value) ? value : value.toFixed(2);

  return (
    <div className="mb-4">
      <label htmlFor={label.replace(/\s/g, '-').toLowerCase()} className="block text-sm font-medium text-gray-700">
        {label}: <span className="font-semibold text-gray-900">{displayValue}{unit}</span>
      </label>
      <input
        type="range"
        id={label.replace(/\s/g, '-').toLowerCase()}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-blue-100 rounded-lg appearance-none cursor-pointer mt-2 accent-blue-600"
      />
    </div>
  );
};

export default Slider;
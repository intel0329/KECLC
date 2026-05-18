import React from 'react';
import { Trash2 } from 'lucide-react';

export default function PropertiesPanel({ element, onUpdate, onDelete }) {
  const handleChange = (key, value) => {
    onUpdate({ ...element.properties, [key]: value });
  };

  return (
    <div className="w-72 bg-white border-l shadow-sm flex flex-col z-10 h-full">
      <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
        <h2 className="font-semibold text-gray-700 capitalize">
          {element.type.replace('_', ' ')} Properties
        </h2>
        <button
          onClick={onDelete}
          className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors"
          title="Delete Element"
        >
          <Trash2 size={18} />
        </button>
      </div>
      <div className="p-4 flex flex-col gap-4 overflow-y-auto">
        {Object.entries(element.properties).map(([key, value]) => (
          <div key={key} className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600 capitalize">
              {key.replace(/([A-Z])/g, ' $1').trim()}
            </label>
            <input
              type="text"
              value={value}
              onChange={(e) => handleChange(key, e.target.value)}
              className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

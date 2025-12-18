import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';

const SearchableSelect = ({ 
  value, 
  onChange, 
  options, 
  placeholder = 'Select option', 
  isDarkMode = false,
  disabled = false 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredOptions, setFilteredOptions] = useState(options);
  const wrapperRef = useRef(null);

  // Filter options based on search
  useEffect(() => {
    if (!searchTerm) {
      setFilteredOptions(options);
    } else {
      const filtered = options.filter(option =>
        option.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredOptions(filtered);
    }
  }, [searchTerm, options]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (option) => {
    onChange(option);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
    setSearchTerm('');
  };

  return (
    <div ref={wrapperRef} className="relative">
      {/* Selected Value Display */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-4 py-2.5 border-2 rounded-lg text-left flex items-center justify-between transition-all ${
          isOpen 
            ? 'ring-4 ring-blue-500/20 border-blue-500' 
            : ''
        } ${
          isDarkMode 
            ? 'bg-gray-800 border-gray-700 text-white hover:border-gray-600' 
            : 'bg-white border-gray-300 text-gray-900 hover:border-gray-400'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span className={value ? '' : isDarkMode ? 'text-gray-500' : 'text-gray-400'}>
          {value || placeholder}
        </span>
        <div className="flex items-center gap-2">
          {value && !disabled && (
            <X 
              className="w-4 h-4 text-gray-400 hover:text-red-500 transition-colors" 
              onClick={handleClear}
            />
          )}
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className={`absolute z-50 w-full mt-2 rounded-lg shadow-2xl border-2 overflow-hidden animate-slideDown ${
          isDarkMode 
            ? 'bg-gray-800 border-gray-700' 
            : 'bg-white border-gray-200'
        }`}>
          {/* Search Box */}
          <div className={`p-3 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className="relative">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${
                isDarkMode ? 'text-gray-400' : 'text-gray-500'
              }`} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search..."
                autoFocus
                className={`w-full pl-10 pr-4 py-2 rounded-lg border transition-all ${
                  isDarkMode 
                    ? 'bg-gray-900 border-gray-600 text-white placeholder-gray-500 focus:border-blue-500' 
                    : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500'
                } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
              />
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-64 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className={`p-4 text-center text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                No options found
              </div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => handleSelect(option)}
                  className={`w-full px-4 py-2.5 text-left transition-colors ${
                    value === option 
                      ? isDarkMode 
                        ? 'bg-blue-900/50 text-blue-300' 
                        : 'bg-blue-100 text-blue-700'
                      : isDarkMode 
                      ? 'text-gray-200 hover:bg-gray-700' 
                      : 'text-gray-800 hover:bg-gray-100'
                  }`}
                >
                  {option}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;


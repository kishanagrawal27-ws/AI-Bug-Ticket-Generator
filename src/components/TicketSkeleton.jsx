import React from 'react';

const TicketSkeleton = ({ isDarkMode }) => {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Title */}
      <div className="space-y-2">
        <div className={`h-6 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'} rounded w-3/4`}></div>
        <div className={`h-1 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-300'} rounded w-full`}></div>
      </div>
      
      {/* Description */}
      <div className="space-y-2">
        <div className={`h-5 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'} rounded w-1/3`}></div>
        <div className={`h-4 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-300'} rounded w-full`}></div>
        <div className={`h-4 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-300'} rounded w-5/6`}></div>
        <div className={`h-4 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-300'} rounded w-4/5`}></div>
        <div className={`h-1 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-300'} rounded w-full`}></div>
      </div>
      
      {/* Steps */}
      <div className="space-y-2">
        <div className={`h-5 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'} rounded w-2/5`}></div>
        <div className={`h-4 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-300'} rounded w-4/5`}></div>
        <div className={`h-4 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-300'} rounded w-3/4`}></div>
        <div className={`h-4 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-300'} rounded w-5/6`}></div>
        <div className={`h-1 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-300'} rounded w-full`}></div>
      </div>
      
      {/* Expected/Actual */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className={`h-5 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'} rounded w-3/4`}></div>
          <div className={`h-4 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-300'} rounded w-full`}></div>
          <div className={`h-4 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-300'} rounded w-5/6`}></div>
        </div>
        <div className="space-y-2">
          <div className={`h-5 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'} rounded w-3/4`}></div>
          <div className={`h-4 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-300'} rounded w-full`}></div>
          <div className={`h-4 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-300'} rounded w-4/5`}></div>
        </div>
      </div>
    </div>
  );
};

export default TicketSkeleton;


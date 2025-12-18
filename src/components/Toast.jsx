import React, { useEffect, useRef } from 'react';
import { CheckCircle, AlertCircle, X } from 'lucide-react';

const Toast = ({ message, type = 'success', onClose }) => {
  // Use ref to store onClose to avoid recreating timer on every render
  const onCloseRef = useRef(onClose);
  
  // Update ref when onClose changes
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Set up auto-dismiss timer based on message (not onClose)
  useEffect(() => {
    const timer = setTimeout(() => {
      onCloseRef.current();
    }, type === 'error' ? 5000 : 4000); // 5 seconds for errors, 4 seconds for success/info

    return () => clearTimeout(timer);
  }, [message, type]); // Depend on message and type instead of onClose

  const icons = {
    success: <CheckCircle className="w-6 h-6 text-green-600" />,
    error: <AlertCircle className="w-6 h-6 text-red-600 animate-shake" />,
    info: <AlertCircle className="w-6 h-6 text-blue-600" />,
  };

  const colors = {
    success: 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-300 text-green-800',
    error: 'bg-gradient-to-r from-red-50 to-pink-50 border-red-300 text-red-800',
    info: 'bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-300 text-blue-800',
  };

  return (
    <div className="fixed top-6 right-6 z-[60] animate-slideInRight">
      <div className={`flex items-center gap-3 px-5 py-4 rounded-xl border-2 shadow-2xl ${colors[type]} min-w-[350px] max-w-md backdrop-blur-sm`}>
        {icons[type]}
        <p className="flex-1 text-sm font-semibold leading-relaxed">{message}</p>
        <button 
          onClick={onClose} 
          className="hover:opacity-70 transition-opacity p-1 hover:bg-black/5 rounded"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default Toast;


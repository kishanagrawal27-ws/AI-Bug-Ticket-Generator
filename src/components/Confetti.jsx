import React, { useEffect, useState } from 'react';

const Confetti = ({ show }) => {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    if (show) {
      const newParticles = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.5,
        duration: 2 + Math.random() * 2,
        color: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#FFD93D'][Math.floor(Math.random() * 6)]
      }));
      setParticles(newParticles);

      // Clear particles after animation
      setTimeout(() => setParticles([]), 4000);
    }
  }, [show]);

  if (!show || particles.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute w-3 h-3 rounded-full animate-confetti"
          style={{
            left: `${particle.left}%`,
            top: '-20px',
            backgroundColor: particle.color,
            animationDelay: `${particle.delay}s`,
            animationDuration: `${particle.duration}s`,
          }}
        />
      ))}
    </div>
  );
};

export default Confetti;


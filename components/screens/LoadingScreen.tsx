import React from 'react';
import ProgressBar from '../ui/ProgressBar';

interface LoadingScreenProps {
    onComplete: () => void;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ onComplete }) => {
  return (
    <div className="page">
        <ProgressBar isActive={true} onComplete={onComplete} />
    </div>
  );
};

export default LoadingScreen;

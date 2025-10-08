import React from 'react';
import MagicCubeButton from '../ui/MagicCubeButton';
import { Mode } from '../../types';

interface SelectionScreenProps {
  onSelectMode: (mode: Mode) => void;
  onHover: (isHovering: boolean) => void;
}

const SelectionScreen: React.FC<SelectionScreenProps> = ({ onSelectMode, onHover }) => {
  return (
    <div className="page">
      <div
        onMouseEnter={() => onHover(true)}
        onMouseLeave={() => onHover(false)}
      >
        <MagicCubeButton 
          onClick={() => onSelectMode(Mode.AddBackground)} 
          symbols={['✡︎', '☸︎', '☯︎', '✝︎', '☪︎', '☮︎']}
        />
      </div>
      <p className="mt-4 text-center font-semibold text-gray-200 text-lg">注入背景模式</p>
    </div>
  );
};

export default SelectionScreen;

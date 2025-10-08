import React from 'react';

interface MagicCubeButtonProps {
  onClick?: () => void;
  size?: 'normal' | 'small';
  symbols?: string[];
  className?: string;
  isLoading?: boolean;
  isAnalyzing?: boolean;
  title?: string;
}

const MagicCubeButton: React.FC<MagicCubeButtonProps> = ({
  onClick,
  size = 'normal',
  symbols = ['✡︎', '☸︎', '☯︎', '✝︎', '☪︎', '☮︎'],
  className = '',
  isLoading = false,
  isAnalyzing = false,
  title
}) => {
  const wrapperClasses = [
    'button-3d-wrapper',
    size === 'small' ? 'button-3d-wrapper--small' : '',
    isLoading ? 'is-loading' : '',
    isAnalyzing ? 'is-analyzing' : '',
    className
  ].join(' ');

  const faces = symbols.slice(0, 6).map((symbol, index) => (
    <div key={index} className="face">{symbol}</div>
  ));

  // If there are fewer than 6 symbols, fill the rest with the first symbol
  while (faces.length < 6) {
    faces.push(<div key={faces.length} className="face">{symbols[0]}</div>);
  }

  return (
    <div className={wrapperClasses} onClick={onClick} title={title}>
      <div className="cube">
        {faces}
      </div>
    </div>
  );
};

export default MagicCubeButton;

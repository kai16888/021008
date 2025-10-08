import React, { useState, useEffect } from 'react';

interface ProgressBarProps {
  isActive: boolean;
  onComplete?: () => void;
}

const MAGICAL_MESSAGES = [
  "正在調和色彩光譜...", "從乙太網路中提取創意...", "為像素注入生命力...",
  "與繆斯女神進行溝通...", "正在編織視覺咒語...", "快好了，正在打磨水晶球...",
  "召喚古老的藝術之靈...", "將想像力轉化為現實..."
];

const ProgressBar: React.FC<ProgressBarProps> = ({ isActive, onComplete }) => {
  const [percent, setPercent] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [subtext, setSubtext] = useState(MAGICAL_MESSAGES[0]);

  useEffect(() => {
    let progressInterval: NodeJS.Timeout | null = null;
    let subtextInterval: NodeJS.Timeout | null = null;

    if (isActive && !isComplete) {
      setPercent(0);
      
      progressInterval = setInterval(() => {
        setPercent(prev => {
          if (prev >= 95) {
            if(progressInterval) clearInterval(progressInterval);
            return 95;
          }
          const increment = (95 - prev) * 0.05;
          return prev + Math.max(increment, 0.2);
        });
      }, 100);

      subtextInterval = setInterval(() => {
        setSubtext(MAGICAL_MESSAGES[Math.floor(Math.random() * MAGICAL_MESSAGES.length)]);
      }, 3000);

    } else if (!isActive) {
      setPercent(0);
      setIsComplete(false);
    }

    return () => {
      if (progressInterval) clearInterval(progressInterval);
      if (subtextInterval) clearInterval(subtextInterval);
    };
  }, [isActive]);

  useEffect(() => {
    if (isActive && onComplete) { // Simulate completion after reaching 95%
        const timer = setTimeout(() => {
            setIsComplete(true);
            let currentPercent = 95;
            const completionInterval = setInterval(() => {
                currentPercent += 5;
                if (currentPercent >= 100) {
                    setPercent(100);
                    setSubtext("魔法已然成形！");
                    clearInterval(completionInterval);
                    setTimeout(() => onComplete(), 500); // give time for animation
                } else {
                    setPercent(currentPercent);
                }
            }, 50);
        }, 2000); // delay before starting completion animation
        return () => clearTimeout(timer);
    }
  }, [isActive, onComplete]);


  const getBarColor = (p: number) => {
    if (isComplete) return 'progress__bar--blue';
    if (p >= 85) return 'progress__bar--green';
    if (p >= 55) return 'progress__bar--yellow';
    if (p >= 30) return 'progress__bar--orange';
    return 'progress__bar--red';
  };

  const barClasses = `progress__bar ${getBarColor(percent)}`;
  const progressClasses = `progress ${isActive ? 'progress--active' : ''} ${isComplete ? 'progress--complete' : ''}`;

  return (
    <div className="crystal-surface p-8 text-center flex flex-col items-center gap-8">
      <h2 className="text-2xl font-bold">魔法師正在詠唱咒語...</h2>
      <div className={progressClasses} style={{
        height: '20px',
        background: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '2px',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        width: '100%',
        maxWidth: '400px',
        position: 'relative'
      }}>
        <b className={barClasses} style={{
          width: `${percent}%`,
          color: 'white',
          fontSize: '12px',
          fontWeight: 'normal',
          textShadow: '0 1px 1px rgba(0, 0, 0, 0.6)',
          lineHeight: '19px',
          display: 'block',
          position: 'relative',
          top: '-1px',
          left: '-1px',
          height: '100%',
          opacity: isActive ? 1 : 0,
          border: '1px solid',
          borderRadius: '2px 0 0 2px',
          transition: 'opacity 0.2s ease, width 0.4s ease-out, background-color 1s ease, border-color 0.3s ease, box-shadow 1s ease'
        }}>
          <span className="progress__text" style={{
            width: '100%',
            padding: '0 0.9em',
            position: 'absolute',
            textAlign: 'center',
            left: 0,
          }}>
            <em>{isComplete ? '完成！' : `${percent.toFixed(0)}%`}</em>
          </span>
        </b>
      </div>
      <p className="mt-2 text-lg">{subtext}</p>
    </div>
  );
};

export default ProgressBar;

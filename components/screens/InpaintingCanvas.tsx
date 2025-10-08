import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef, useCallback } from 'react';
import MagicCubeButton from '../ui/MagicCubeButton';

const BRUSH_COLORS = { red: '#ef4444', black: '#000000', white: '#ffffff', yellow: '#f59e0b', blue: '#3b82f6' };
const COLOR_NAMES: { [key: string]: string } = { '#ef4444': '紅色', '#000000': '黑色', '#ffffff': '白色', '#f59e0b': '黃色', '#3b82f6': '藍色' };
const INPAINT_IMAGE_SIZE = 1024;

interface InpaintingCanvasProps {
  baseImage: string;
  onInstructionChange: (instructions: { [color: string]: string }) => void;
}

export interface InpaintingCanvasRef {
  getMask: () => string;
  isMaskEmpty: () => boolean;
  reset: () => void;
}

const hexToRgba = (hex: string, alpha: number) => {
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
        r = parseInt(hex[1] + hex[1], 16);
        g = parseInt(hex[2] + hex[2], 16);
        b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) {
        r = parseInt(hex[1] + hex[2], 16);
        g = parseInt(hex[3] + hex[4], 16);
        b = parseInt(hex[5] + hex[6], 16);
    }
    return `rgba(${r},${g},${b},${alpha})`;
};

const InpaintingCanvas = forwardRef<InpaintingCanvasRef, InpaintingCanvasProps>(({ baseImage, onInstructionChange }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(20);
  const [brushColor, setBrushColor] = useState(BRUSH_COLORS.red);
  const [activeInstructionColors, setActiveInstructionColors] = useState<Set<string>>(new Set());
  const [instructions, setInstructions] = useState<{ [color: string]: string }>({});

  const lastPos = useRef({ x: 0, y: 0 });

  const resetCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    
    const maskCtx = maskCanvas.getContext('2d');
    if (!ctx || !maskCtx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    maskCtx.fillStyle = 'black';
    maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
    canvas.style.backgroundImage = `url(${baseImage})`;
    setActiveInstructionColors(new Set());
    setInstructions({});
    onInstructionChange({});
  }, [baseImage, onInstructionChange]);

  useEffect(() => {
    maskCanvasRef.current = document.createElement('canvas');
    maskCanvasRef.current.width = INPAINT_IMAGE_SIZE;
    maskCanvasRef.current.height = INPAINT_IMAGE_SIZE;
    resetCanvas();
  }, [baseImage, resetCanvas]);


  useImperativeHandle(ref, () => ({
    getMask: () => {
        return maskCanvasRef.current?.toDataURL('image/png') || '';
    },
    isMaskEmpty: () => {
        const maskCanvas = maskCanvasRef.current;
        if (!maskCanvas) return true;
        const maskCtx = maskCanvas.getContext('2d');
        if (!maskCtx) return true;
        const maskData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height).data;
        for (let i = 0; i < maskData.length; i += 4) {
            if (maskData[i] > 0 || maskData[i+1] > 0 || maskData[i+2] > 0) {
                 return false;
            }
        }
        return true;
    },
    reset: resetCanvas,
  }));

  const getMousePos = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    if ('touches' in e.nativeEvent) {
      clientX = e.nativeEvent.touches[0].clientX;
      clientY = e.nativeEvent.touches[0].clientY;
    } else {
      clientX = e.nativeEvent.clientX;
      clientY = e.nativeEvent.clientY;
    }

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return { 
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY 
    };
  }, []);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (!canvas || !maskCanvas) return;
    const ctx = canvas.getContext('2d');
    const maskCtx = maskCanvas.getContext('2d');
    if (!ctx || !maskCtx) return;

    const pos = getMousePos(e);
    ctx.strokeStyle = hexToRgba(brushColor, 0.6);
    ctx.lineCap = 'round';
    ctx.lineWidth = brushSize;
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();

    const scaleFactor = maskCanvas.width / canvas.width;
    maskCtx.strokeStyle = 'white';
    maskCtx.lineCap = 'round';
    maskCtx.lineWidth = brushSize * scaleFactor;
    maskCtx.beginPath();
    maskCtx.moveTo(lastPos.current.x * scaleFactor, lastPos.current.y * scaleFactor);
    maskCtx.lineTo(pos.x * scaleFactor, pos.y * scaleFactor);
    maskCtx.stroke();
    
    lastPos.current = pos;
  }, [isDrawing, brushColor, brushSize, getMousePos]);

  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!activeInstructionColors.has(brushColor)) {
        setActiveInstructionColors(prev => new Set(prev).add(brushColor));
    }
    setIsDrawing(true);
    const pos = getMousePos(e);
    lastPos.current = pos;
    draw(e); // Draw a dot on initial click
  }, [brushColor, activeInstructionColors, getMousePos, draw]);
  
  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
  }, []);

  const handleInstructionTextChange = (color: string, text: string) => {
    const newInstructions = { ...instructions, [color]: text };
    setInstructions(newInstructions);
    onInstructionChange(newInstructions);
  };

  return (
    <div id="inpainting-area" className="flex flex-col items-center w-full">
        <label className="block text-xl font-bold mb-4 text-center">🎯 內繪/擴繪作業區</label>
        <p className="text-sm text-gray-400 mb-3 text-center">請用畫筆塗抹**希望 AI 重新繪製的區域**</p>
        <div className="relative mb-4 w-full max-w-xl aspect-square bg-gray-900 rounded-lg shadow-xl border border-blue-600/50 overflow-hidden">
            <canvas
                id="inpainting-canvas"
                ref={canvasRef}
                className="w-full h-full cursor-crosshair"
                width={INPAINT_IMAGE_SIZE}
                height={INPAINT_IMAGE_SIZE}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseOut={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
            />
        </div>
        <div className="crystal-surface p-4 w-full max-w-xl mb-4">
            <div className="flex items-center justify-between">
                <div>
                    <label htmlFor="brush-size-slider" className="block text-sm font-bold mb-2">筆刷尺寸: <span>{brushSize}</span>px</label>
                    <input type="range" id="brush-size-slider" min="5" max="100" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} className="w-48 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex justify-center gap-2">
                      {Object.entries(BRUSH_COLORS).map(([name, color]) => (
                        <button
                          key={name}
                          className={`color-btn ${brushColor === color ? 'active' : ''}`}
                          style={{ backgroundColor: color, border: (color === '#ffffff' || color === '#000000') ? '1px solid #ccc' : undefined }}
                          onClick={() => setBrushColor(color)}
                        />
                      ))}
                    </div>
                    <MagicCubeButton onClick={resetCanvas} size="small" symbols={['⎋']} title="清除所有繪製與指令" />
                </div>
            </div>
        </div>
        <div className="w-full max-w-xl space-y-3 mt-4">
          {Array.from(activeInstructionColors).map((color: string) => (
            <div key={color} className="instruction-box">
              <label className="block text-sm font-bold mb-1" style={{ color: color, textShadow: `0 0 5px ${color}` }}>{COLOR_NAMES[color]}區域指令</label>
              <textarea 
                rows={2} 
                className="w-full py-2 px-3 leading-tight text-sm instruction-textarea" 
                style={{ borderLeftColor: color }} 
                placeholder={`請描述希望對${COLOR_NAMES[color]}區域做的修改...`}
                value={instructions[color] || ''}
                onChange={(e) => handleInstructionTextChange(color, e.target.value)}
              />
            </div>
          ))}
        </div>
    </div>
  );
});

export default InpaintingCanvas;
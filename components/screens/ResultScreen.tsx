import React, { useState } from 'react';
import MagicCubeButton from '../ui/MagicCubeButton';

interface ResultScreenProps {
  images: string[];
  prompt: string;
  onBackToEdit: () => void;
  onRerun: () => void;
  onStartInpainting: (imageUrl: string) => void;
  onReset: () => void;
}

const ResultScreen: React.FC<ResultScreenProps> = ({ images, prompt, onBackToEdit, onRerun, onStartInpainting, onReset }) => {
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState<Record<string, boolean>>({});

  const handleImageClick = (url: string) => {
    const newSelection = new Set(selectedImages);
    if (newSelection.has(url)) {
      newSelection.delete(url);
    } else {
      newSelection.add(url);
    }
    setSelectedImages(newSelection);
    setError(null);
  };

  const handleRerunOrInpaint = () => {
    setError(null);
    if (selectedImages.size === 0) {
      onRerun();
    } else if (selectedImages.size === 1) {
      onStartInpainting(Array.from(selectedImages)[0]);
    } else {
      setError('進入內繪模式請只選取一張圖片。');
    }
  };
  
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const applyWatermark = async (baseImageUrl: string): Promise<string> => {
    const watermarkUrl = 'https://i.ibb.co/hFW1f4TH/LOGO150.png'; // User provided watermark
    return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas context not available'));

        const baseImage = new Image();
        baseImage.crossOrigin = 'anonymous';
        const watermarkImage = new Image();
        watermarkImage.crossOrigin = 'anonymous';

        let loaded = 0;
        const onLoaded = () => {
            loaded++;
            if (loaded < 2) return;

            canvas.width = baseImage.naturalWidth;
            canvas.height = baseImage.naturalHeight;
            ctx.drawImage(baseImage, 0, 0);

            const padding = canvas.width * 0.02; 
            const wmSize = canvas.width * 0.15;
            const x = canvas.width - wmSize - padding;
            const y = canvas.height - wmSize - padding;
            ctx.drawImage(watermarkImage, x, y, wmSize, wmSize);
            resolve(canvas.toDataURL('image/jpeg', 0.95));
        };

        baseImage.onload = onLoaded;
        watermarkImage.onload = onLoaded;
        baseImage.onerror = () => reject(new Error('Failed to load base image.'));
        watermarkImage.onerror = () => reject(new Error('Failed to load watermark image.'));
        baseImage.src = baseImageUrl;
        watermarkImage.src = watermarkUrl;
    });
  };

  const handleDownload = async (isWatermarked: boolean, type: string) => {
    setError(null);
    if (selectedImages.size === 0) {
      setError('請至少選取一張圖片才能下載。');
      return;
    }
    
    setIsDownloading(prev => ({ ...prev, [type]: true }));
    
    const date = new Date();
    const timestamp = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}${date.getHours().toString().padStart(2, '0')}${date.getMinutes().toString().padStart(2, '0')}${date.getSeconds().toString().padStart(2, '0')}`;
    const urlsToDownload = Array.from(selectedImages);
    
    for (let i = 0; i < urlsToDownload.length; i++) {
        try {
            // FIX: Explicitly type `url` as string to avoid it being inferred as `unknown`.
            const url: string = isWatermarked ? await applyWatermark(urlsToDownload[i]) : urlsToDownload[i];
            const filename = `${isWatermarked ? 'sealed' : 'ai'}_creation_${timestamp}_${i + 1}.jpg`;
            const blob = await (await fetch(url)).blob();
            const objectUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = filename;
            link.href = objectUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(objectUrl);
            await sleep(300);
        } catch (e) {
            console.error("Download/watermark error:", e);
            setError(`處理圖片時發生錯誤：${(e as Error).message}`);
            break;
        }
    }
    
    setIsDownloading(prev => ({ ...prev, [type]: false }));
  };

  return (
    <div className="page page-scrollable">
      <div className="p-8 crystal-surface flex flex-col my-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold mb-2">魔法已然成形！</h2>
          <p className="mb-6">輕觸以選定魔法造物，再次輕觸則解除選定</p>
        </div>
        {error && <p className="bg-red-900/50 border border-red-500/50 text-red-300 p-3 rounded-md mb-4">{error}</p>}
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl mx-auto mb-6">
            {images.map((url, index) => (
              <div
                key={index}
                className={`result-cell relative cursor-pointer rounded-lg overflow-hidden border-2 aspect-square ${selectedImages.has(url) ? 'selected' : ''}`}
                onClick={() => handleImageClick(url)}
              >
                <img src={url} className="w-full h-full object-cover" loading="lazy" alt={`Generated result ${index + 1}`} />
                <div className="selection-overlay absolute inset-0 bg-black/50 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 bg-black/20 p-4 rounded-lg space-y-3">
            <div>
              <p className="text-sm font-bold">✅ 您的魔導指令：</p>
              <p className="mt-1 text-gray-300">{prompt}</p>
            </div>
          </div>
        </div>
        <div className="pt-6 flex justify-center items-center gap-x-2 sm:gap-x-4 flex-wrap">
          <MagicCubeButton onClick={onBackToEdit} size="small" symbols={['⤴']} title="回爐重鑄" />
          <MagicCubeButton onClick={() => handleDownload(false, 'normal')} isLoading={isDownloading['normal']} size="small" symbols={['⎙']} title="提取造物" />
          <MagicCubeButton onClick={handleRerunOrInpaint} size="small" symbols={['♲']} title={selectedImages.size > 0 ? "進入內繪" : "時空回溯"} />
          <MagicCubeButton onClick={() => handleDownload(true, 'watermark')} isLoading={isDownloading['watermark']} size="small" symbols={['✵']} title="施加封印" />
          <MagicCubeButton onClick={onReset} size="small" symbols={['⌂']} title="返回結界" />
        </div>
      </div>
    </div>
  );
};

export default ResultScreen;
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Mode, AnalysisResult, Suggestion } from '../../types';
import * as geminiService from '../../services/geminiService';
import MagicCubeButton from '../ui/MagicCubeButton';
import InpaintingCanvas, { InpaintingCanvasRef } from './InpaintingCanvas';

interface CreationScreenProps {
  mode: Mode;
  initialInpaintingImage: string | null;
  uploadedImage: string | null;
  onBack: () => void;
  onGenerate: (prompt: string, negativePrompt: string, subjectName: string) => void;
  onInpaint: (mask: string, prompt: string, negativePrompt: string, subjectName: string) => void;
  onImageUpload: (file: File) => void;
  onImageRemove: () => void;
  fileName: string | null;
}

const SuggestionCard: React.FC<{ theme: string; suggestion: Suggestion; onClick: () => void; }> = ({ theme, suggestion, onClick }) => (
    <div className="suggestion-card p-4 border rounded-lg cursor-pointer" onClick={onClick}>
        <h4 className="font-bold text-gray-100">{theme}</h4>
        <p className="text-gray-300 text-sm mt-1">{suggestion.prompt}</p>
        <p className="text-xs mt-2"><strong>✅ 視覺焦點：</strong> {suggestion.focus}</p>
        <p className="text-xs mt-1"><strong>💡 光線提醒：</strong> {suggestion.lighting}</p>
    </div>
);

const CreationScreen: React.FC<CreationScreenProps> = ({
  mode,
  initialInpaintingImage,
  uploadedImage,
  onBack,
  onGenerate,
  onInpaint,
  onImageUpload,
  onImageRemove,
  fileName
}) => {
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [subjectDimensions, setSubjectDimensions] = useState('');
  const [subjectRelation, setSubjectRelation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [inpaintingInstructions, setInpaintingInstructions] = useState<{ [color: string]: string }>({});
  
  const inpaintingCanvasRef = useRef<InpaintingCanvasRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Reset local state when mode changes or component mounts
    setPrompt('');
    setNegativePrompt('');
    setSubjectName('');
    setSubjectDimensions('');
    setSubjectRelation('');
    setError(null);
    setIsAnalyzing(false);
    setAnalysisResult(null);
  }, [mode]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImageUpload(file);
    }
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) {
        onImageUpload(file);
    }
  };

  const handleAnalysis = async () => {
    const subjectDetails = [subjectName, subjectDimensions, subjectRelation].filter(Boolean).join(' ');
    if (!subjectDetails) {
      setError("請至少提供一項主體屬性，以利場景預言。");
      return;
    }
    if (!uploadedImage) {
      setError("請先上傳圖片再進行分析。");
      return;
    }

    setError(null);
    setIsAnalyzing(true);
    setAnalysisResult(null);
    try {
      const result = await geminiService.analyzeImageForScenes(uploadedImage, subjectDetails);
      setAnalysisResult(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = () => {
    setError(null);
    if (mode === Mode.AddBackground) {
        if (!uploadedImage) {
            setError('請先上傳一個主體。');
            return;
        }
        if (!prompt.trim()) {
            setError('創作指令不能為空。');
            return;
        }
        onGenerate(prompt, negativePrompt, subjectName);
    } else if (mode === Mode.Inpainting) {
        if (!inpaintingCanvasRef.current) {
            setError("內繪畫布尚未初始化。");
            return;
        }

        const combinedPrompt = Object.entries(inpaintingInstructions)
            .filter(([, instruction]) => instruction.trim())
            .map(([color, instruction]) => `- ${color}: ${instruction}`)
            .join('\n');
            
        if (!combinedPrompt) {
            setError('請至少為一個塗色區域填寫指令。');
            return;
        }

        if (inpaintingCanvasRef.current.isMaskEmpty()) {
            setError('請先在畫布上塗抹需要內繪的區域。');
            return;
        }
        
        const mask = inpaintingCanvasRef.current.getMask();
        onInpaint(mask, combinedPrompt, negativePrompt, subjectName);
    }
  };

  return (
    <div className="page page-scrollable">
      <button onClick={onBack} className="mb-6 text-blue-400 hover:text-blue-300 font-semibold transition-colors text-sm self-start">&larr; 返回魔法結界</button>
      <div className="p-8 crystal-surface flex flex-col">
        <h2 className="text-3xl mb-6 font-bold flex-shrink-0">{mode === Mode.AddBackground ? '注入背景模式' : '魔法內繪模式'}</h2>
        <div className="flex-grow space-y-6">
          {error && <p className="bg-red-900/50 border border-red-500/50 text-red-300 p-3 rounded-md">{error}</p>}
          
          {mode === Mode.Inpainting && initialInpaintingImage && (
            <InpaintingCanvas 
              ref={inpaintingCanvasRef} 
              baseImage={initialInpaintingImage} 
              onInstructionChange={setInpaintingInstructions}
            />
          )}

          {mode === Mode.AddBackground && (
            <>
              {/* Image Upload Area */}
              <div>
                <label className="block text-sm font-bold mb-2">第一步：召喚核心聖物 (主體)</label>
                <div 
                  className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-md hover:border-blue-500 transition-colors"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                >
                  <div className="space-y-1 text-center">
                    {uploadedImage && <img src={uploadedImage} className="mx-auto max-h-40 mb-4 rounded" alt="Preview"/>}
                    {!uploadedImage && (
                      <div id="upload-prompt-container">
                        <div className="flex text-sm justify-center">
                          <label htmlFor="file-upload" className="relative cursor-pointer rounded-md font-medium text-blue-400 hover:text-blue-300">
                            <span>從此處召喚</span>
                            <input ref={fileInputRef} id="file-upload" name="file-upload" type="file" className="sr-only" accept="image/jpeg, image/png" onChange={handleFileChange} />
                          </label>
                          <p className="pl-1 text-gray-500">或將主體拖曳至此法陣</p>
                        </div>
                      </div>
                    )}
                    {fileName && (
                      <div className="flex items-center justify-center gap-2">
                        <p className="text-xs text-gray-400">{fileName}</p>
                        <button onClick={onImageRemove} className="text-xs text-red-500 hover:text-red-400 font-semibold">[重新開始]</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Detail Options Area */}
              {uploadedImage && (
                <div>
                  <label className="block text-sm font-bold mb-4">第二步：賦予主體屬性 (選填)</label>
                  <div className="space-y-4">
                    <div>
                        <label htmlFor="subject-name" className="text-xs font-bold mb-1">主體名諱</label>
                        <input type="text" id="subject-name" value={subjectName} onChange={e => setSubjectName(e.target.value)} className="w-full py-2 px-3 leading-tight" placeholder="例如：一把銀色的蛋糕刀" />
                    </div>
                    <div>
                        <label htmlFor="subject-dimensions" className="text-xs font-bold mb-1">主體尺寸</label>
                        <input type="text" id="subject-dimensions" value={subjectDimensions} onChange={e => setSubjectDimensions(e.target.value)} className="w-full py-2 px-3 leading-tight" placeholder="例如：長度約 25 公分" />
                    </div>
                    <div>
                        <label htmlFor="subject-relation" className="text-xs font-bold mb-1">主體傳說</label>
                        <input type="text" id="subject-relation" value={subjectRelation} onChange={e => setSubjectRelation(e.target.value)} className="w-full py-2 px-3 leading-tight" placeholder="例如：用於切結婚紀念日的蛋糕" />
                    </div>
                  </div>
                </div>
              )}

              {/* Analysis Feature */}
              {uploadedImage && (
                <div className="space-y-4">
                  <label className="block text-sm font-bold mb-2">第三步：智慧場景預言</label>
                  <div className="flex flex-col items-center">
                    <MagicCubeButton onClick={handleAnalysis} isAnalyzing={isAnalyzing} symbols={['𐓏', '༄', '❆', '☼', '⛈︎', '☾']} />
                  </div>
                  {analysisResult && (
                    <div className="space-y-3">
                        {/* FIX: Cast `suggestion` to Suggestion type as it's inferred as `unknown`. */}
                        {Object.entries(analysisResult).map(([key, suggestion]) => (
                            <SuggestionCard 
                                key={key}
                                theme={{usage_scenario: '使用情境', result_display: '成果展示', still_life: '靜物擺放'}[key as keyof AnalysisResult] || '建議'}
                                suggestion={suggestion as Suggestion}
                                onClick={() => setPrompt((suggestion as Suggestion).prompt)}
                            />
                        ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Common Prompt Area */}
          <div className="space-y-4">
            {mode === Mode.AddBackground && (
                <div>
                    <label htmlFor="prompt" className="block text-sm font-bold mb-2">刻下你的魔導指令 (Prompt)</label>
                    <textarea id="prompt" rows={6} value={prompt} onChange={e => setPrompt(e.target.value)} className="w-full py-3 px-4 leading-tight" placeholder="可點擊上方預言場景自動填入，或自行詠唱..."></textarea>
                </div>
            )}
            <div>
                <label htmlFor="negative-prompt" className="block text-sm font-bold mb-2">禁忌詠唱 (選填)</label>
                <textarea id="negative-prompt" rows={2} value={negativePrompt} onChange={e => setNegativePrompt(e.target.value)} className="w-full py-2 px-3 leading-tight text-sm" placeholder="告訴AI不希望出現的元素，例如：多餘的手指, 文字, 浮水印, 畫質差"></textarea>
            </div>
          </div>
        </div>

        <div className="mt-auto pt-6 text-center flex-shrink-0 flex flex-col items-center">
            <MagicCubeButton onClick={handleSubmit} symbols={['⚒︎']} />
            <p className="mt-2 text-center font-semibold text-gray-200">啟動煉成陣</p>
        </div>
      </div>
    </div>
  );
};

export default CreationScreen;
import React, { useState, useCallback } from 'react';
import { Screen, Mode, AppState } from './types';
import * as geminiService from './services/geminiService';
import SelectionScreen from './components/screens/SelectionScreen';
import CreationScreen from './components/screens/CreationScreen';
import LoadingScreen from './components/screens/LoadingScreen';
import ResultScreen from './components/screens/ResultScreen';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>({
    screen: Screen.Selection,
    mode: null,
    uploadedImage: null,
    optimizedImage: null,
    generatedImages: [],
    lastUserPrompt: '',
    lastNegativePrompt: '',
    inpaintingBaseImage: null,
    error: null,
    loadingMessage: '',
    loadingSubtext: ''
  });
  const [isHovering, setIsHovering] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const resetToSelection = useCallback(() => {
    setAppState({
      screen: Screen.Selection,
      mode: null,
      uploadedImage: null,
      optimizedImage: null,
      generatedImages: [],
      lastUserPrompt: '',
      lastNegativePrompt: '',
      inpaintingBaseImage: null,
      error: null,
      loadingMessage: '',
      loadingSubtext: ''
    });
    setFileName(null);
  }, []);

  const handleSelectMode = useCallback((mode: Mode) => {
    setAppState(prev => ({ ...prev, screen: Screen.Creation, mode }));
  }, []);

  const handleBackToSelection = useCallback(() => {
    resetToSelection();
  }, [resetToSelection]);

  const resizeImage = (base64Str: string, maxWidth = 1024, maxHeight = 1024): Promise<string> => {
    return new Promise(resolve => {
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let { width, height } = img;
            if (width > height) {
                if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; }
            } else {
                if (height > maxHeight) { width *= maxHeight / height; height = maxHeight; }
            }
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.9));
        };
    });
  }

  const handleImageUpload = useCallback((file: File) => {
    setFileName(`${file.name} (優化中...)`);
    const reader = new FileReader();
    reader.onload = async (e) => {
        const result = e.target?.result as string;
        const optimized = await resizeImage(result);
        setAppState(prev => ({
            ...prev,
            uploadedImage: result,
            optimizedImage: optimized
        }));
        setFileName(`${file.name} (優化完成)`);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleImageRemove = useCallback(() => {
    setAppState(prev => ({
        ...prev,
        uploadedImage: null,
        optimizedImage: null,
    }));
    setFileName(null);
  }, []);

  const handleGenerationError = (error: unknown) => {
    console.error("Generation failed:", error);
    setAppState(prev => ({
        ...prev,
        screen: Screen.Creation,
        error: `圖片生成失敗：${(error as Error).message}`
    }));
  };

  const handleGenerate = useCallback(async (prompt: string, negativePrompt: string, subjectName: string) => {
    if (!appState.optimizedImage) return;

    setAppState(prev => ({
        ...prev,
        screen: Screen.Loading,
        lastUserPrompt: prompt,
        lastNegativePrompt: negativePrompt,
        error: null,
        loadingMessage: '魔法師正在詠唱咒語...'
    }));

    try {
        const imageUrls = await geminiService.generateImages(appState.optimizedImage, prompt, negativePrompt);
        setAppState(prev => ({
            ...prev,
            generatedImages: imageUrls,
            screen: Screen.Result,
        }));
    } catch (error) {
        handleGenerationError(error);
    }
  }, [appState.optimizedImage]);

  const handleInpaint = useCallback(async (mask: string, prompt: string, negativePrompt: string, subjectName: string) => {
    if (!appState.inpaintingBaseImage) return;

    setAppState(prev => ({
        ...prev,
        screen: Screen.Loading,
        lastUserPrompt: prompt,
        lastNegativePrompt: negativePrompt,
        error: null,
        loadingMessage: '魔法師正在進行內繪咒語...'
    }));

    try {
        const finalImage = await geminiService.inpaintImage(appState.inpaintingBaseImage, mask, appState.optimizedImage, prompt, negativePrompt, subjectName);
        setAppState(prev => ({
            ...prev,
            generatedImages: [finalImage],
            inpaintingBaseImage: finalImage, // Update base image for further inpainting
            screen: Screen.Result
        }));
    } catch (error) {
        handleGenerationError(error);
    }
  }, [appState.inpaintingBaseImage, appState.optimizedImage]);

  const handleRerun = useCallback(async () => {
    if (!appState.optimizedImage) return;
    
    setAppState(prev => ({ ...prev, screen: Screen.Loading, error: null, loadingMessage: '正在回溯時空...' }));
    
    try {
      const enhancedPrompt = await geminiService.enhancePrompt(appState.lastUserPrompt);
      const imageUrls = await geminiService.generateImages(appState.optimizedImage, enhancedPrompt, appState.lastNegativePrompt);
      setAppState(prev => ({
          ...prev,
          generatedImages: imageUrls,
          lastUserPrompt: enhancedPrompt,
          screen: Screen.Result
      }));
    } catch (error) {
        handleGenerationError(error);
    }
  }, [appState.lastUserPrompt, appState.lastNegativePrompt, appState.optimizedImage]);

  const handleStartInpainting = useCallback((imageUrl: string) => {
    setAppState(prev => ({
        ...prev,
        mode: Mode.Inpainting,
        inpaintingBaseImage: imageUrl,
        screen: Screen.Creation
    }));
  }, []);

  const renderScreen = () => {
    switch (appState.screen) {
      case Screen.Selection:
        return <SelectionScreen onSelectMode={handleSelectMode} onHover={setIsHovering} />;
      case Screen.Creation:
        if (!appState.mode) {
          resetToSelection();
          return null;
        }
        return (
          <CreationScreen
            mode={appState.mode}
            initialInpaintingImage={appState.inpaintingBaseImage}
            uploadedImage={appState.uploadedImage}
            onBack={handleBackToSelection}
            onGenerate={handleGenerate}
            onInpaint={handleInpaint}
            onImageUpload={handleImageUpload}
            onImageRemove={handleImageRemove}
            fileName={fileName}
          />
        );
      case Screen.Loading:
        return <LoadingScreen onComplete={() => {}} />;
      case Screen.Result:
        return (
          <ResultScreen
            images={appState.generatedImages}
            prompt={appState.lastUserPrompt}
            onBackToEdit={() => setAppState(prev => ({ ...prev, screen: Screen.Creation }))}
            onRerun={handleRerun}
            onStartInpainting={handleStartInpainting}
            onReset={resetToSelection}
          />
        );
      default:
        return <SelectionScreen onSelectMode={handleSelectMode} onHover={setIsHovering}/>;
    }
  };

  return (
    <div className={`root-container w-full h-full ${isHovering ? 'magic-hover' : ''}`}>
      <div className="circle"><div className="hexagram"></div></div>
      {renderScreen()}
    </div>
  );
};

export default App;

import React, { useState, useCallback } from 'react';
import ImageUploader from './components/ImageUploader';
import ImageEditor from './components/ImageEditor';
import { MaskSettings, ImageInfo, BatchResult } from './types';
import { removeWatermark } from './services/geminiService';

const App: React.FC = () => {
  const [batchImages, setBatchImages] = useState<ImageInfo[]>([]);
  const [batchResults, setBatchResults] = useState<BatchResult[]>([]);
  const [processingIndex, setProcessingIndex] = useState<number | null>(null);

  const [originalImageInfo, setOriginalImageInfo] = useState<ImageInfo | null>(null);
  const [aiResultBase64, setAiResultBase64] = useState<string | null>(null);
  const [maskSettings, setMaskSettings] = useState<MaskSettings>({
    width: 0,
    height: 0,
    maskX: 0,
    maskY: 0,
    feather: 15,
    opacity: 1,
    aspectRatio: '9:16',
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMaskOutline, setShowMaskOutline] = useState(true);
  const [showAIEffect, setShowAIEffect] = useState(true);

  const handleImagesUpload = useCallback((images: ImageInfo[]) => {
    setBatchImages(images);
    setBatchResults([]);
    setProcessingIndex(null);
    setOriginalImageInfo(images[0]);
    setAiResultBase64(null);
    setError(null);
    setMaskSettings({
      width: 0,
      height: 0,
      maskX: 0,
      maskY: 0,
      feather: 15,
      opacity: 1,
      aspectRatio: '9:16',
    });
    setIsLoading(false);
    setIsAiProcessing(false);
    setShowAIEffect(true);
  }, []);

  const handleMaskSettingsChange = useCallback((settings: MaskSettings) => {
    setMaskSettings(settings);
  }, []);

  const handleInitialMaskSet = useCallback(async (settings: MaskSettings) => {
    setMaskSettings(prev => ({
      ...settings,
      feather: prev.feather,
      opacity: prev.opacity,
      aspectRatio: prev.aspectRatio,
    }));
    setError(null);
  }, []);

  const handleTriggerWatermarkRemoval = useCallback(async () => {
    if (!originalImageInfo || !maskSettings.width || !maskSettings.height) {
      setError("Please draw a mask area on the reference image first.");
      return;
    }

    setIsLoading(true);
    setIsAiProcessing(true);
    setError(null);

    try {
      const results: BatchResult[] = [];
      for (let i = 0; i < batchImages.length; i++) {
        setProcessingIndex(i);
        const img = batchImages[i];
        const res = await removeWatermark(
          img.base64, 
          img.mimeType, 
          img.width, 
          img.height, 
          maskSettings.aspectRatio,
          maskSettings // Pass maskSettings as the 6th argument
        );
        results.push({ original: img, resultBase64: res });
      }
      setBatchResults(results);
      setAiResultBase64(results[0].resultBase64);
    } catch (err: any) {
      console.error("Workflow error:", err);
      setError(err.message || "Batch operation failed.");
    } finally {
      setIsLoading(false);
      setIsAiProcessing(false);
      setProcessingIndex(null);
    }
  }, [originalImageInfo, maskSettings, batchImages]);

  const handleSaveMaskSettings = useCallback(() => {
    if (maskSettings.width > 0 && maskSettings.height > 0) {
      const blob = new Blob([JSON.stringify(maskSettings, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `mask_settings_${maskSettings.aspectRatio.replace(':', '-')}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } else {
      alert('Draw a mask area first.');
    }
  }, [maskSettings]);

  const handleLoadMaskSettings = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async (event: Event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target && typeof e.target.result === 'string') {
            try {
              const loaded = JSON.parse(e.target.result);
              setMaskSettings(loaded);
              setAiResultBase64(null);
              setBatchResults([]);
            } catch { alert('Invalid config file'); }
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  }, []);

  const handleRemoveMask = useCallback(() => {
    setMaskSettings(prev => ({ ...prev, width: 0, height: 0 }));
    setAiResultBase64(null);
    setBatchResults([]);
    setError(null);
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 p-8 flex flex-col items-center">
      <div className="w-full max-w-7xl">
        <header className="mb-16 text-center">
          <h1 className="text-6xl font-black text-slate-900 tracking-tighter mb-4">
            AI <span className="text-blue-600">Batch</span> Eraser
          </h1>
          <div className="flex items-center justify-center gap-2">
            <span className="h-px w-8 bg-slate-300"></span>
            <p className="text-slate-400 font-black uppercase tracking-[0.4em] text-[10px]">High-Res Geometry Verified</p>
            <span className="h-px w-8 bg-slate-300"></span>
          </div>
        </header>

        {!originalImageInfo && (
          <div className="w-full max-w-xl mx-auto transform hover:scale-[1.01] transition-transform">
            <ImageUploader 
              onImagesUpload={handleImagesUpload} 
              isLoading={isLoading} 
              error={error} 
            />
          </div>
        )}

        {originalImageInfo && (
          <div className="animate-in fade-in slide-in-from-bottom-6 duration-700">
            {processingIndex !== null && (
              <div className="mb-10 bg-blue-600 shadow-2xl p-8 rounded-[3rem] flex items-center justify-between text-white border-4 border-blue-500/50">
                <div className="flex items-center gap-8">
                  <div className="h-16 w-16 rounded-[1.5rem] bg-white text-blue-600 flex items-center justify-center font-black text-2xl shadow-inner">
                    {processingIndex + 1}
                  </div>
                  <div>
                    <h3 className="text-2xl font-black tracking-tight leading-none mb-1">Processing Batch...</h3>
                    <p className="text-blue-100 font-bold text-xs uppercase tracking-[0.2em]">{batchImages[processingIndex].name}</p>
                  </div>
                </div>
                <div className="text-4xl font-black tabular-nums">
                  {Math.round(((processingIndex + 1) / batchImages.length) * 100)}%
                </div>
              </div>
            )}

            <ImageEditor
              originalImageInfo={originalImageInfo}
              aiResultBase64={aiResultBase64}
              batchResults={batchResults}
              maskSettings={maskSettings}
              onMaskSettingsChange={handleMaskSettingsChange}
              isLoading={isAiProcessing}
              onInitialMaskSet={handleInitialMaskSet}
              onTriggerWatermarkRemoval={handleTriggerWatermarkRemoval}
              onSaveMaskSettings={handleSaveMaskSettings}
              onLoadMaskSettings={handleLoadMaskSettings}
              onRemoveMask={handleRemoveMask}
              showMaskOutline={showMaskOutline}
              onToggleShowMaskOutline={() => setShowMaskOutline(!showMaskOutline)}
              showAIEffect={showAIEffect}
              onToggleShowAIEffect={() => setShowAIEffect(!showAIEffect)}
            />

            {error && (
              <div className="mt-12 bg-red-50 text-red-600 px-8 py-5 rounded-3xl border border-red-100 text-center font-black shadow-xl animate-bounce">
                {error}
              </div>
            )}

            <div className="mt-16 flex justify-center">
              <button
                onClick={() => {
                  setOriginalImageInfo(null);
                  setBatchImages([]);
                  setBatchResults([]);
                }}
                className="px-12 py-5 bg-white text-slate-900 font-black rounded-3xl border-2 border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-2xl active:scale-95 uppercase tracking-widest text-xs"
                disabled={isLoading}
              >
                Upload New Collection
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
import React, { useRef, useEffect, useCallback, useState } from 'react';
import { ImageInfo, MaskSettings, BatchResult } from '../types'; // Убедись, что BatchResult есть в типах, или удали его если не используешь
import { drawMaskedImageOnCanvas } from '../utils/imageUtils';
import Slider from './Slider';

interface ImageEditorProps {
  originalImageInfo: ImageInfo;
  aiResultBase64: string | null;
  batchResults: any[]; // Если используешь батчи
  maskSettings: MaskSettings;
  onMaskSettingsChange: (settings: MaskSettings) => void;
  isLoading: boolean;
  onInitialMaskSet: (settings: MaskSettings) => void;
  onTriggerWatermarkRemoval: () => void;
  onSaveMaskSettings: () => void;
  onLoadMaskSettings: () => void;
  onRemoveMask: () => void;
  showMaskOutline: boolean;
  onToggleShowMaskOutline: () => void;
  showAIEffect: boolean;
  onToggleShowAIEffect: () => void;
}

const ImageEditor: React.FC<ImageEditorProps> = ({
  originalImageInfo,
  aiResultBase64,
  batchResults,
  maskSettings,
  onMaskSettingsChange,
  isLoading,
  onInitialMaskSet,
  onTriggerWatermarkRemoval,
  onSaveMaskSettings,
  onLoadMaskSettings,
  onRemoveMask,
  showMaskOutline,
  onToggleShowMaskOutline,
  showAIEffect,
  onToggleShowAIEffect,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Локальный стейт для рисования
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{ x: number; y: number } | null>(null);

  const hasSelection = maskSettings.width > 0 && maskSettings.height > 0;
  const isBatchMode = batchResults && batchResults.length > 0;

  // 1. Сброс локального выделения, если родитель очистил маску
  useEffect(() => {
    if (maskSettings.width === 0 && !isSelecting) {
      setSelectionStart(null);
      setSelectionEnd(null);
    }
  }, [maskSettings.width, isSelecting]);

  // 2. Функция отрисовки (Canvas Redraw)
  const redrawCanvas = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageToDraw = showAIEffect ? aiResultBase64 : null;

    // Рисуем базовое изображение (или результат ИИ)
    await drawMaskedImageOnCanvas(
      canvas,
      { dataURL: originalImageInfo.dataURL, width: originalImageInfo.width, height: originalImageInfo.height },
      imageToDraw,
      maskSettings
    );

    if (!showMaskOutline) return;

    // Рисуем рамку выделения
    if (isSelecting && selectionStart && selectionEnd) {
      // Рисуем то, что тянем мышкой прямо сейчас
      const startX = Math.min(selectionStart.x, selectionEnd.x);
      const startY = Math.min(selectionStart.y, selectionEnd.y);
      const width = Math.abs(selectionStart.x - selectionEnd.x);
      const height = Math.abs(selectionStart.y - selectionEnd.y);

      ctx.fillStyle = 'rgba(0, 150, 255, 0.2)';
      ctx.fillRect(startX, startY, width, height);
      ctx.strokeStyle = 'rgba(0, 150, 255, 0.8)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(startX, startY, width, height);
      ctx.setLineDash([]);
    } else if (hasSelection) {
      // Рисуем уже зафиксированную маску (из props)
      const maskPixelWidth = canvas.width * (maskSettings.width / 100);
      const maskPixelHeight = canvas.height * (maskSettings.height / 100);
      const maskPixelX = canvas.width * (maskSettings.maskX / 100);
      const maskPixelY = canvas.height * (maskSettings.maskY / 100);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(maskPixelX, maskPixelY, maskPixelWidth, maskPixelHeight);
      ctx.setLineDash([]);
    }
  }, [originalImageInfo, aiResultBase64, maskSettings, isSelecting, selectionStart, selectionEnd, hasSelection, showMaskOutline, showAIEffect]);

  // Обновляем канвас при изменении любого параметра
  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // 3. Обработчик нажатия мыши (Start Drawing)
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isLoading || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    // Сбрасываем старую маску перед началом новой
    onRemoveMask(); 

    setSelectionStart({ x: mouseX, y: mouseY });
    setSelectionEnd({ x: mouseX, y: mouseY });
    setIsSelecting(true);
  }, [isLoading, onRemoveMask]);

  // 4. Обработчик движения мыши (Update Drawing Visuals)
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isSelecting || !selectionStart || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const currentX = (e.clientX - rect.left) * scaleX;
    const currentY = (e.clientY - rect.top) * scaleY;

    setSelectionEnd({ x: currentX, y: currentY });
    // ВАЖНО: Мы НЕ вызываем onInitialMaskSet здесь, чтобы не спамить обновлениями
  }, [isSelecting, selectionStart]);

  // 5. Обработчик отпускания мыши (Commit Selection)
  // Мы вешаем его на window, чтобы поймать отпускание даже за пределами канваса
  useEffect(() => {
    const handleMouseUp = () => {
      if (isSelecting && selectionStart && selectionEnd && canvasRef.current) {
        const canvas = canvasRef.current;
        
        // Вычисляем финальные координаты
        const startX = Math.min(selectionStart.x, selectionEnd.x);
        const startY = Math.min(selectionStart.y, selectionEnd.y);
        const width = Math.abs(selectionStart.x - selectionEnd.x);
        const height = Math.abs(selectionStart.y - selectionEnd.y);

        // Если выделение достаточно большое, сохраняем его
        if (width > 5 && height > 5) {
          onInitialMaskSet({
            maskX: (startX / canvas.width) * 100,
            maskY: (startY / canvas.height) * 100,
            width: (width / canvas.width) * 100,
            height: (height / canvas.height) * 100,
            feather: maskSettings.feather,
            opacity: maskSettings.opacity,
            aspectRatio: maskSettings.aspectRatio,
          });
        }
        
        // Завершаем режим рисования
        setIsSelecting(false);
        setSelectionStart(null);
        setSelectionEnd(null);
      }
    };

    if (isSelecting) {
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isSelecting, selectionStart, selectionEnd, onInitialMaskSet, maskSettings.feather, maskSettings.opacity, maskSettings.aspectRatio]);


  const handleSliderChange = useCallback((key: keyof MaskSettings, value: any) => {
    // При изменении слайдеров сбрасываем ручное выделение, чтобы не было конфликтов
    setSelectionStart(null);
    setSelectionEnd(null);
    onMaskSettingsChange({ ...maskSettings, [key]: value });
  }, [maskSettings, onMaskSettingsChange]);

  const downloadOne = async (result: any) => {
    const canvas = document.createElement('canvas');
    canvas.width = result.original.width;
    canvas.height = result.original.height;
    await drawMaskedImageOnCanvas(
      canvas,
      { dataURL: result.original.dataURL, width: result.original.width, height: result.original.height },
      result.resultBase64,
      maskSettings
    );
    const link = document.createElement('a');
    link.download = `cleaned_${result.original.name || 'image.png'}`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="space-y-12">
      <div className="flex flex-col lg:flex-row gap-8 p-10 bg-white rounded-[3rem] shadow-2xl border border-slate-100 ring-1 ring-slate-200/50">
        <div className="flex-1 flex flex-col items-center">
          <h2 className="text-xl font-black mb-8 text-slate-900 tracking-tight flex items-center gap-3">
            <span className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm shadow-xl shadow-blue-200">1</span>
            Draw Reference Mask
          </h2>
          <div className="relative border-[6px] border-slate-50 rounded-[2.5rem] overflow-hidden bg-slate-50 shadow-2xl ring-1 ring-slate-200 group">
            <canvas
              ref={canvasRef}
              className="max-w-full h-auto block"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              style={{ cursor: isSelecting ? 'crosshair' : 'default' }}
            />
          </div>
        </div>

        <div className="lg:w-[24rem] flex flex-col gap-6">
          {/* Actions */}
          <div className="bg-slate-50/50 p-7 rounded-[2rem] border border-slate-100 shadow-inner">
            <h3 className="text-[10px] font-black mb-6 text-slate-400 uppercase tracking-[0.25em]">Execution</h3>
            <button
              onClick={onTriggerWatermarkRemoval}
              disabled={!hasSelection || isLoading}
              className="w-full py-5 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3"
            >
              {isLoading ? (
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              ) : (isBatchMode || aiResultBase64 ? 'Re-run Removal' : 'Start Process')}
            </button>
            <button onClick={onRemoveMask} className="w-full mt-4 text-slate-400 font-bold hover:text-red-500 transition-colors text-xs py-2 uppercase tracking-widest">Reset Area</button>
          </div>

          {/* Geometry Fix */}
          <div className="bg-slate-50/50 p-7 rounded-[2rem] border border-slate-100 shadow-inner">
            <h3 className="text-[10px] font-black mb-6 text-slate-400 uppercase tracking-[0.25em]">Geometry Strategy</h3>
            <div className="flex bg-white p-1 rounded-xl border border-slate-200">
              <button 
                onClick={() => handleSliderChange('aspectRatio', '9:16')}
                className={`flex-1 py-3 text-[11px] font-black rounded-lg transition-all ${maskSettings.aspectRatio === '9:16' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                9:16 / VERTICAL
              </button>
              <button 
                onClick={() => handleSliderChange('aspectRatio', '4:5')}
                className={`flex-1 py-3 text-[11px] font-black rounded-lg transition-all ${maskSettings.aspectRatio === '4:5' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                4:5 / INSTAGRAM
              </button>
            </div>
            <p className="mt-4 text-[10px] text-slate-400 font-medium leading-relaxed">
              {maskSettings.aspectRatio === '4:5' ? '* Using Right-Side Padding for pixel-perfect 4:5 alignment.' : '* Using Centered Square Padding for vertical images.'}
            </p>
          </div>

          {/* Mask Settings */}
          <div className="bg-slate-50/50 p-7 rounded-[2rem] border border-slate-100 shadow-inner">
            <h3 className="text-[10px] font-black mb-6 text-slate-400 uppercase tracking-[0.25em]">Fine-Tune Mask</h3>
            <div className="space-y-1">
              <Slider label="X Pos" value={maskSettings.maskX} onChange={(v) => handleSliderChange('maskX', v)} min={0} max={100} step={0.01} unit="%" />
              <Slider label="Y Pos" value={maskSettings.maskY} onChange={(v) => handleSliderChange('maskY', v)} min={0} max={100} step={0.01} unit="%" />
              <Slider label="Width" value={maskSettings.width} onChange={(v) => handleSliderChange('width', v)} min={0} max={100} step={0.01} unit="%" />
              <Slider label="Height" value={maskSettings.height} onChange={(v) => handleSliderChange('height', v)} min={0} max={100} step={0.01} unit="%" />
              <Slider label="Feather" value={maskSettings.feather} onChange={(v) => handleSliderChange('feather', v)} min={0} max={100} step={1} unit="px" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button onClick={onSaveMaskSettings} className="py-4 bg-white border border-slate-200 rounded-2xl text-[10px] font-black text-slate-900 hover:bg-slate-100 shadow-sm transition-all uppercase tracking-widest">Save JSON</button>
            <button onClick={onLoadMaskSettings} className="py-4 bg-white border border-slate-200 rounded-2xl text-[10px] font-black text-slate-900 hover:bg-slate-100 shadow-sm transition-all uppercase tracking-widest">Load JSON</button>
          </div>
        </div>
      </div>

      {isBatchMode && (
        <div className="p-12 bg-white rounded-[3.5rem] shadow-2xl border border-slate-100">
          <div className="flex items-center justify-between mb-12">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Batch Results <span className="text-blue-600">({batchResults.length})</span></h2>
            <div className="bg-green-50 px-5 py-2 rounded-full border border-green-100">
              <span className="text-[10px] font-black text-green-600 uppercase tracking-widest">Ready for Export</span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
            {batchResults.map((result, idx) => (
              <div key={idx} className="relative group rounded-[2.5rem] overflow-hidden shadow-2xl bg-slate-50 border border-slate-100 aspect-square flex items-center justify-center transition-all hover:scale-[1.02]">
                <img 
                  src={`data:image/png;base64,${result.resultBase64}`} 
                  alt={result.original.name} 
                  className="max-w-full max-h-full object-contain"
                />
                <button
                  onClick={() => downloadOne(result)}
                  className="absolute top-5 right-5 px-6 py-4 bg-white/95 backdrop-blur-2xl text-black text-[10px] font-black rounded-[1.25rem] shadow-2xl hover:bg-white hover:scale-110 transition-all transform translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 flex items-center gap-3 ring-1 ring-black/5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                  DOWNLOAD
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageEditor;
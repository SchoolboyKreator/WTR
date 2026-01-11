import React, { useCallback, useState } from 'react';
import { ImageInfo } from '../types';
import { readFileAsDataURL, dataURLtoBase64, dataURLtoMimeType, loadImage } from '../utils/imageUtils';

interface ImageUploaderProps {
  onImagesUpload: (images: ImageInfo[]) => void;
  isLoading: boolean;
  error: string | null;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ onImagesUpload, isLoading, error }) => {
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      try {
        const imageInfos: ImageInfo[] = [];
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (file.type.startsWith('image/')) {
            const dataURL = await readFileAsDataURL(file);
            const img = await loadImage(dataURL);
            imageInfos.push({
              dataURL,
              base64: dataURLtoBase64(dataURL),
              mimeType: dataURLtoMimeType(dataURL),
              width: img.naturalWidth,
              height: img.naturalHeight,
              name: file.name
            });
          }
        }
        
        if (imageInfos.length > 0) {
          setPreviewSrc(imageInfos[0].dataURL);
          onImagesUpload(imageInfos);
        }
      } catch (err) {
        console.error("Upload error:", err);
        alert("Load failed. Try again.");
      }
    }
  }, [onImagesUpload]);

  return (
    <div className="flex flex-col items-center justify-center p-12 bg-white rounded-[3rem] shadow-2xl border border-slate-100">
      <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center text-blue-600 mb-8 shadow-inner ring-1 ring-blue-100">
        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
      </div>
      <h2 className="text-3xl font-black mb-2 text-slate-900 tracking-tight">Image Collection</h2>
      <p className="text-slate-400 mb-10 text-xs font-bold uppercase tracking-[0.2em]">Select multiple vertical or 4:5 photos</p>
      
      <div className="w-full flex justify-center items-center flex-col">
        {previewSrc ? (
          <div className="relative group mb-10 p-2 bg-slate-50 rounded-[2rem] border border-slate-200">
            <img src={previewSrc} alt="Preview" className="max-w-full max-h-64 object-contain rounded-[1.5rem] shadow-xl" />
          </div>
        ) : (
          <div className="w-full h-48 bg-slate-50 rounded-[2rem] flex flex-col items-center justify-center text-slate-300 mb-10 border-4 border-dashed border-slate-100 transition-all hover:border-blue-400 hover:bg-blue-50/30 group">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] group-hover:text-blue-500 transition-colors">Select files to begin</span>
          </div>
        )}
        <input
          type="file"
          multiple
          accept="image/png, image/jpeg, image/gif, image/webp"
          onChange={handleFileChange}
          disabled={isLoading}
          className="block w-full text-[10px] font-black text-slate-400 border border-slate-100 rounded-2xl cursor-pointer bg-slate-50 focus:outline-none file:mr-6 file:py-4 file:px-10 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:uppercase file:tracking-widest file:bg-slate-900 file:text-white hover:file:bg-black disabled:file:bg-slate-300 disabled:cursor-not-allowed transition-all shadow-sm"
        />
      </div>
      {error && <p className="mt-6 text-red-500 text-xs font-black uppercase tracking-widest">{error}</p>}
    </div>
  );
};

export default ImageUploader;
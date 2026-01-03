import React from 'react';
import { TrollPlan, ProductionAsset } from '../types';
import { Video, Loader2, AlertTriangle, CheckCircle, Copy, Film, Palette, Newspaper, Play, Lock, FileText, Camera, Download } from 'lucide-react';

interface TrollPlanDisplayProps {
  plan: TrollPlan;
  onGenerateVideo: () => void;
  isGeneratingVideo: boolean;
  isStitching?: boolean;
  finalVideoUrl?: string | null;
  productionAssets: ProductionAsset[];
  onPromptChange: (type: 'image' | 'video', index: number, val: string) => void;
  error: string | null;
  progressMessage?: string;
}

export const TrollPlanDisplay: React.FC<TrollPlanDisplayProps> = ({ 
  plan, 
  onGenerateVideo, 
  isGeneratingVideo, 
  isStitching,
  finalVideoUrl,
  productionAssets,
  onPromptChange,
  error,
  progressMessage
}) => {
  const getAsset = (idx: number) => productionAssets.find(a => a.clipIndex === idx);

  return (
    <div className="space-y-8 pb-24">
      
      {/* 1. Character Bible & Data */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
         {/* Character Bible */}
         <div className="md:col-span-8 bg-gray-900 border border-purple-900/30 rounded-xl p-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-2 opacity-10">
                <Lock size={100} />
            </div>
            <div className="flex justify-between items-start mb-4">
                <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wider flex items-center gap-2">
                    <Lock size={14}/> Character Bible: {plan.character_bible.character_id}
                </h3>
                {plan.character_bible.anchor_images?.length > 0 && (
                     <div className="flex -space-x-2">
                         {plan.character_bible.anchor_images.map((img) => (
                             <img key={img.id} src={`data:${img.mimeType};base64,${img.base64Data}`} className="w-10 h-10 rounded-full border-2 border-purple-900 object-cover" title={img.label} />
                         ))}
                     </div>
                )}
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="space-y-2">
                    <p className="font-bold text-gray-500 uppercase text-[10px]">Face Lock Rules</p>
                    <ul className="list-disc pl-4 text-gray-300 space-y-1">
                        {plan.character_bible.face_lock?.slice(0, 4).map((item, i) => (
                            <li key={i}>{item}</li>
                        ))}
                    </ul>
                </div>
                <div className="space-y-2">
                     <p className="font-bold text-gray-500 uppercase text-[10px]">Style Lock</p>
                     <p className="text-gray-400 leading-relaxed bg-black/30 p-2 rounded">
                         {plan.character_bible.style_lock.substring(0, 150)}...
                     </p>
                </div>
            </div>
         </div>

         {/* Kit Spec */}
         <div className="md:col-span-4 bg-gray-900 border border-gray-800 rounded-xl p-5">
             <h3 className="text-sm font-semibold text-blue-400 mb-3 uppercase tracking-wider flex items-center gap-2">
                <Palette size={14}/> Kit & Event
             </h3>
             <div className="space-y-2 text-xs text-gray-300">
                 <div className="flex justify-between border-b border-gray-800 pb-2">
                     <span className="text-gray-500">Event</span>
                     <span className="font-bold text-right w-1/2 truncate">{plan.event_fact_sheet.title}</span>
                 </div>
                 <div className="flex justify-between border-b border-gray-800 pb-2">
                     <span className="text-gray-500">Colors</span>
                     <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full border border-gray-600" style={{backgroundColor: plan.kit_spec.shirt}}></span>
                        <span className="w-3 h-3 rounded-full border border-gray-600" style={{backgroundColor: plan.kit_spec.shorts}}></span>
                     </div>
                 </div>
                 <div className="flex justify-between border-b border-gray-800 pb-2">
                     <span className="text-gray-500">Kit Spec</span>
                     <span className="truncate w-32 text-right">{plan.kit_spec.shirt} shirt</span>
                 </div>
             </div>
         </div>
      </div>

      {/* FINAL VIDEO OUTPUT (Shows when ready) */}
      {finalVideoUrl && (
          <div className="bg-gradient-to-r from-purple-900/40 to-indigo-900/40 border border-purple-500/50 rounded-xl p-8 flex flex-col items-center justify-center animate-in fade-in zoom-in-95 shadow-2xl shadow-purple-900/20">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                  <Film className="text-purple-400" /> 
                  Production Complete
              </h2>
              <div className="relative w-full max-w-[280px] aspect-[9/16] bg-black rounded-2xl overflow-hidden border-4 border-gray-800 shadow-2xl mb-6">
                  <video src={finalVideoUrl} controls autoPlay className="w-full h-full object-cover" />
              </div>
              <a 
                href={finalVideoUrl} 
                download="final_troll_edit.mp4" 
                className="bg-white hover:bg-gray-200 text-black px-8 py-3 rounded-full font-bold flex items-center gap-2 transition-all shadow-lg hover:shadow-xl hover:scale-105"
              >
                  <Download size={20} />
                  Download Final 9:16 Video
              </a>
          </div>
      )}

      {/* 2. Storyboard Editor (5 Clips) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <Film size={14} />
                5-Clip Parody Structure (9:16)
            </h3>
        </div>

        <div className="space-y-6">
            {plan.storyboard.map((clip, idx) => {
                const asset = getAsset(idx);
                const isProcessing = asset?.status === 'generating_image' || asset?.status === 'generating_video';
                
                return (
                    <div key={idx} className={`bg-gray-900 border rounded-xl overflow-hidden transition-all ${isProcessing ? 'border-purple-500/50 shadow-lg shadow-purple-900/20' : 'border-gray-800'}`}>
                        {/* Header */}
                        <div className="bg-black/40 px-4 py-2 border-b border-gray-800 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <span className="font-mono text-xs text-purple-400 font-bold">CLIP 0{idx+1}</span>
                                <span className="bg-gray-800 text-gray-300 text-[10px] px-2 py-0.5 rounded uppercase font-bold tracking-wider">{clip.purpose}</span>
                            </div>
                            <span className="text-[10px] text-gray-500 flex items-center gap-2">
                                <Camera size={12} />
                                {clip.camera_angle} • {clip.camera_movement} • {clip.seconds}s
                            </span>
                        </div>
                        
                        <div className="p-4 grid grid-cols-1 md:grid-cols-12 gap-6">
                            {/* Inputs */}
                            <div className="md:col-span-8 space-y-4">
                                <div>
                                    <label className="flex items-center gap-2 text-[10px] text-gray-500 uppercase mb-1">
                                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                        Keyframe Action
                                    </label>
                                    <p className="text-xs text-gray-400 mb-2 italic">"{clip.keyframe_prompt}"</p>
                                </div>
                                <div className="border-t border-gray-800 pt-2">
                                    <label className="flex items-center gap-2 text-[10px] text-gray-500 uppercase mb-1">
                                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                        Motion Prompt
                                    </label>
                                    <p className="text-xs text-gray-400 mb-2 italic">"{clip.video_prompt}"</p>
                                    <div className="mt-2 bg-yellow-900/10 border border-yellow-900/30 p-2 rounded flex items-start gap-2">
                                        <FileText size={12} className="text-yellow-500 mt-0.5" />
                                        <p className="text-[10px] text-yellow-200">
                                            <span className="font-bold">Overlay:</span> {clip.overlay_text}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Outputs / Preview (Strict 9:16 Container) */}
                            <div className="md:col-span-4 flex flex-col items-center">
                                <div className="relative w-full max-w-[180px] aspect-[9/16] bg-black rounded-lg overflow-hidden border border-gray-700 shadow-xl">
                                    {asset?.videoUrl ? (
                                        <>
                                            <video src={asset.videoUrl} controls className="w-full h-full object-cover" />
                                            <a href={asset.videoUrl} download={`clip_${idx+1}.mp4`} className="absolute top-2 right-2 bg-black/60 hover:bg-black/90 text-white p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity text-[10px]">Download</a>
                                        </>
                                    ) : asset?.imageUrl ? (
                                        <>
                                            <img src={asset.imageUrl} alt="Keyframe" className="w-full h-full object-cover opacity-90" />
                                            {asset.status === 'generating_video' && (
                                                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-xs text-white p-2 text-center">
                                                    <Loader2 size={24} className="animate-spin mb-2" />
                                                    Animating (Veo)...
                                                </div>
                                            )}
                                            <div className="absolute bottom-0 w-full bg-black/60 text-[8px] text-center text-white py-1 uppercase tracking-wider">Keyframe Reference</div>
                                        </>
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-600 gap-2 bg-gray-800/50">
                                            {asset?.status === 'generating_image' ? (
                                                <>
                                                    <Loader2 size={20} className="animate-spin text-purple-500" />
                                                    <span className="text-[10px]">Painting...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Film size={20} />
                                                    <span className="text-[10px]">Empty</span>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                                {asset?.error && <p className="text-[10px] text-red-400 text-center mt-2 px-1 leading-tight">{asset.error}</p>}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
      </div>

      {/* 3. Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur-lg border-t border-gray-800 p-4 z-40">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
            <div className="hidden md:block">
                <p className="text-xs text-gray-400">
                    <span className="text-white font-bold">{plan.storyboard.length} Clips</span> configured.
                    Forced 9:16 Aspect Ratio.
                </p>
            </div>
            
            <button
                onClick={onGenerateVideo}
                disabled={isGeneratingVideo || isStitching}
                className={`
                    flex-1 md:flex-none md:w-64 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all
                    ${isGeneratingVideo || isStitching
                        ? 'bg-gray-800 text-gray-400 cursor-not-allowed' 
                        : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-500/20'}
                `}
            >
                {isGeneratingVideo ? (
                    <>
                        <Loader2 size={18} className="animate-spin" />
                        {progressMessage || 'Production in Progress...'}
                    </>
                ) : isStitching ? (
                    <>
                        <Loader2 size={18} className="animate-spin" />
                        Stitching Final Cut...
                    </>
                ) : (
                    <>
                        <Play size={18} fill="currentColor" />
                        Start Production Pipeline
                    </>
                )}
            </button>
        </div>
      </div>

    </div>
  );
};
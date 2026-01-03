import React, { useState } from 'react';
import { PlayerProfile, TrollPlan, ProductionAsset, UploadedImage, NewsCandidate, EventFactSheet } from './types';
import { PlayerSearch } from './components/PlayerSearch';
import { TrollPlanDisplay } from './components/TrollPlanDisplay';
import { ImageUpload } from './components/ImageUpload';
import { NewsSelector } from './components/NewsSelector';
import { resolveNewsContext, createStoryPlan, executeProductionPipeline, stitchVideoClips } from './services/geminiService';
import { Bot, Key, RefreshCw, Sparkles, MonitorPlay, ImagePlus, Lock } from 'lucide-react';

const App: React.FC = () => {
  // State for Inputs
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerProfile | null>(null);
  const [privateQuery, setPrivateQuery] = useState('');
  const [anchorImages, setAnchorImages] = useState<UploadedImage[]>([]);
  
  // State for Process Flow
  const [isResolvingNews, setIsResolvingNews] = useState(false);
  const [newsCandidates, setNewsCandidates] = useState<NewsCandidate[]>([]);
  const [isPlanning, setIsPlanning] = useState(false);
  
  const [trollPlan, setTrollPlan] = useState<TrollPlan | null>(null);
  
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [isStitching, setIsStitching] = useState(false);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  
  // New State for Multi-Clip Assets
  const [productionAssets, setProductionAssets] = useState<ProductionAsset[]>([]);

  const handleChangeKey = async () => {
    const aistudio = (window as any).aistudio;
    if (aistudio && aistudio.openSelectKey) {
        try {
            await aistudio.openSelectKey();
            setError(null);
        } catch (e) {
            console.error(e);
        }
    } else {
        alert("Key selection is handled by the embedding environment.");
    }
  };

  const handleInitialSearch = async () => {
    if (!selectedPlayer) {
      setError("Please select a player to search.");
      return;
    }
    if (!privateQuery.trim()) {
        setError("Please enter a news query (e.g., 'Goal vs Poland').");
        return;
    }

    setError(null);
    setTrollPlan(null);
    setNewsCandidates([]);
    setIsResolvingNews(true);

    try {
        const resolution = await resolveNewsContext(selectedPlayer, privateQuery);
        
        // In the strict pipeline, we almost always want user confirmation unless it's perfect match.
        // But for safety, if multiple candidates exist, show them.
        if (resolution.candidates && resolution.candidates.length > 0) {
            setNewsCandidates(resolution.candidates);
            setIsResolvingNews(false);
        } else if (resolution.selected_event) {
            // If the model was super confident and returned only one selected_event (rare in strict mode)
            await runPlanning(resolution.selected_event);
        } else {
            setError("Could not find specific match events. Try adding a year or competition.");
            setIsResolvingNews(false);
        }
    } catch (err: any) {
        handleError(err);
        setIsResolvingNews(false);
    }
  };

  const runPlanning = async (event: EventFactSheet) => {
      setIsPlanning(true);
      setNewsCandidates([]); // Clear selection UI
      try {
          const plan = await createStoryPlan(selectedPlayer!, event, anchorImages);
          setTrollPlan(plan);
          setProductionAssets([]);
          setFinalVideoUrl(null);
      } catch (err: any) {
          handleError(err);
      } finally {
          setIsPlanning(false);
          setIsResolvingNews(false);
      }
  };

  const handleError = (err: any) => {
    const errorMessage = err.message || JSON.stringify(err);
    if (errorMessage.includes("404")) {
        setError("Model not found (404). Please ensure you have access to Gemini 3.");
    } else if (errorMessage.includes("429")) {
        setError("Quota Exceeded (429). Your current API key has hit its limit. Please wait or switch keys.");
    } else {
        setError("Error: " + errorMessage);
    }
  };

  const handlePromptChange = (type: 'image' | 'video', index: number, newPrompt: string) => {
    if (trollPlan) {
      const newPlan = { ...trollPlan };
      if (type === 'image') newPlan.storyboard[index].keyframe_prompt = newPrompt;
      if (type === 'video') newPlan.storyboard[index].video_prompt = newPrompt;
      setTrollPlan(newPlan);
    }
  };

  const handleRenderPipeline = async () => {
    if (!trollPlan) return;
    setError(null);
    setIsGeneratingVideo(true);
    setFinalVideoUrl(null);
    setProgressMessage('Starting 5-Clip Pro Pipeline...');

    try {
      const videoUrls = await executeProductionPipeline(
        trollPlan, 
        (asset) => {
             setProductionAssets(prev => {
                 const existing = prev.findIndex(p => p.clipIndex === asset.clipIndex);
                 if (existing >= 0) {
                     const newArr = [...prev];
                     newArr[existing] = { ...newArr[existing], ...asset };
                     return newArr;
                 }
                 return [...prev, asset];
             });
             
             // Update progress message
             if (asset.status === 'generating_image') setProgressMessage(`Clip ${asset.clipIndex + 1}: Conditioning Keyframe (9:16)...`);
             if (asset.status === 'generating_video') setProgressMessage(`Clip ${asset.clipIndex + 1}: Animating via Veo...`);
             if (asset.status === 'completed') setProgressMessage(`Clip ${asset.clipIndex + 1} Ready.`);
        }
      );

      // STITCHING PHASE
      if (videoUrls.length === 5) {
          setIsGeneratingVideo(false);
          setIsStitching(true);
          setProgressMessage('Assembling Final Cut (Client-side Stitching)...');
          try {
              const finalUrl = await stitchVideoClips(videoUrls);
              setFinalVideoUrl(finalUrl);
          } catch (stitchErr: any) {
              console.error("Stitch failed:", stitchErr);
              setError("Auto-stitching failed (Browser limitations). Please download individual clips.");
          } finally {
              setIsStitching(false);
          }
      } else {
          setError("Pipeline stopped early. Generated clips are available below.");
          setIsGeneratingVideo(false);
      }

    } catch (err: any) {
      console.error(err);
      setIsGeneratingVideo(false);
      const errorMessage = err.message || JSON.stringify(err);
      
      if (errorMessage.includes("Requested entity was not found") || errorMessage.includes("404")) {
         const aistudio = (window as any).aistudio;
         if (aistudio && aistudio.openSelectKey) {
            try {
                await aistudio.openSelectKey();
                setError("API Key session refreshed. Please click 'Render' again.");
            } catch (e) {
                setError("API Key Error: Please re-select your paid API key manually.");
            }
         } else {
             setError("Model or Entity Not Found (404). Check permissions.");
         }
      } else if (errorMessage.includes("429")) {
        setError("Quota Exceeded (429). The app is cooling down. Please wait 60 seconds.");
      } else {
        setError("Pipeline Error: " + errorMessage);
      }
    } finally {
      // setIsGeneratingVideo(false) handled above to separate stitching state
      setProgressMessage('');
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-gray-100 font-sans selection:bg-purple-500/30">
      
      {/* Header */}
      <header className="border-b border-gray-800 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-pink-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-pink-500/20 transform -rotate-2">
              <Bot size={24} className="text-white" />
            </div>
            <div>
                <h1 className="font-bold text-lg leading-tight text-white tracking-tight">Football Troll AI</h1>
                <p className="text-[10px] text-gray-500 font-mono uppercase tracking-wider flex items-center gap-1">
                    Veo 3.1 <span className="text-purple-500">•</span> Pro Pipeline
                </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
                onClick={handleChangeKey}
                className="flex items-center gap-2 text-xs font-medium text-gray-400 hover:text-white bg-gray-900 border border-gray-800 hover:bg-gray-800 px-3 py-1.5 rounded-lg transition-all"
            >
                <Key size={14} />
                <span className="hidden sm:inline">Switch API Key</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        
        {/* Input Section */}
        <section className={`bg-gray-900/50 border border-gray-800 rounded-2xl p-1 overflow-hidden transition-all duration-500 ${trollPlan ? 'opacity-50 grayscale pointer-events-none max-h-40' : ''}`}>
            <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-8">
                {/* Visuals */}
                <div className="md:col-span-5 space-y-6">
                    <div>
                        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2 mb-3">
                            1. Select Character
                        </h2>
                        <PlayerSearch 
                            selectedPlayer={selectedPlayer}
                            onSelectPlayer={setSelectedPlayer}
                        />
                    </div>
                    
                    <div className="pt-4 border-t border-gray-800">
                        <div className="flex items-center gap-2 mb-3">
                             <Lock size={14} className="text-purple-400" />
                             <h2 className="text-sm font-bold text-gray-200 uppercase tracking-wider">
                                Character Bible Anchors
                             </h2>
                        </div>
                        <p className="text-[10px] text-gray-500 mb-3 leading-relaxed">
                            Upload 1-3 images of your cartoon character (e.g. CR7 with long neck) to strict-lock consistency across all clips.
                        </p>
                        <ImageUpload 
                            images={anchorImages}
                            setImages={setAnchorImages}
                            label="Anchor Images"
                            maxImages={3}
                        />
                    </div>
                </div>

                {/* Context */}
                <div className="md:col-span-7 flex flex-col justify-between">
                     <div className="space-y-4">
                        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                            2. Search News Event
                        </h2>
                        <textarea 
                            value={privateQuery}
                            onChange={(e) => setPrivateQuery(e.target.value)}
                            placeholder="E.g. Ronaldo goal vs Al Wehda"
                            className="w-full bg-black/50 border border-gray-700 rounded-xl py-3 px-4 text-sm text-gray-200 focus:ring-2 focus:ring-purple-500 outline-none placeholder-gray-600 transition-all h-32 resize-none"
                        />
                     </div>

                     <div className="mt-4">
                        <button
                            onClick={handleInitialSearch}
                            disabled={isResolvingNews || isPlanning}
                            className={`
                                w-full py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all
                                ${isResolvingNews || isPlanning
                                ? 'bg-gray-800 text-gray-400 cursor-not-allowed' 
                                : 'bg-white hover:bg-gray-200 text-black shadow-lg shadow-purple-500/10'}
                            `}
                        >
                            {isResolvingNews ? (
                                <>
                                    <Sparkles size={18} className="animate-spin text-purple-600" />
                                    Searching & Grounding...
                                </>
                            ) : isPlanning ? (
                                <>
                                    <Sparkles size={18} className="animate-spin text-purple-600" />
                                    Writing 9:16 Storyboard...
                                </>
                            ) : (
                                <>
                                    <Bot size={18} />
                                    Find Event & Generate Plan
                                </>
                            )}
                        </button>
                        
                        {/* Error Display */}
                        {error && !trollPlan && !newsCandidates.length && (
                            <div className="mt-3 flex flex-col items-center gap-2 text-xs text-red-400 bg-red-900/10 py-3 px-2 rounded border border-red-900/30">
                                <span>{error}</span>
                                {(error.includes("429") || error.includes("quota")) && (
                                    <button 
                                        onClick={handleChangeKey}
                                        className="bg-red-500/20 hover:bg-red-500/30 text-red-200 px-3 py-1 rounded border border-red-500/40 flex items-center gap-2 transition-colors"
                                    >
                                        <RefreshCw size={12} />
                                        Switch API Key
                                    </button>
                                )}
                            </div>
                        )}
                     </div>
                </div>
            </div>
        </section>

        {/* News Resolver UI */}
        {newsCandidates.length > 0 && !trollPlan && (
            <NewsSelector 
                candidates={newsCandidates}
                onSelect={(candidate) => {
                    const evt: EventFactSheet = {
                        title: candidate.title,
                        specific_action_moment: candidate.action_description,
                        match_context: `vs ${candidate.opponent} (${candidate.competition})`,
                        what_happened: candidate.action_description,
                        kit_colors: candidate.kit_colors,
                        sources: candidate.sources
                    };
                    runPlanning(evt);
                }}
            />
        )}

        {/* Output Section */}
        {trollPlan && (
           <section className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="flex items-center gap-3 mb-6">
                    <div className="h-px bg-gray-800 flex-grow" />
                    <span className="text-xs font-mono text-gray-500 uppercase">Production Console</span>
                    <div className="h-px bg-gray-800 flex-grow" />
                </div>
                
                {error && (
                    <div className="mb-6 flex flex-col items-center gap-2 text-xs text-red-400 bg-red-900/10 py-4 px-4 rounded-xl border border-red-900/30">
                        <span className="font-semibold text-center">{error}</span>
                        {(error.includes("429") || error.includes("quota")) && (
                             <button 
                                onClick={handleChangeKey}
                                className="mt-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors font-medium"
                            >
                                <RefreshCw size={14} />
                                Switch API Key Now
                            </button>
                        )}
                    </div>
                )}

                <TrollPlanDisplay 
                    plan={trollPlan}
                    onGenerateVideo={handleRenderPipeline}
                    isGeneratingVideo={isGeneratingVideo}
                    isStitching={isStitching}
                    finalVideoUrl={finalVideoUrl}
                    productionAssets={productionAssets}
                    onPromptChange={handlePromptChange}
                    error={null} 
                    progressMessage={progressMessage}
                />
           </section>
        )}

      </main>
    </div>
  );
};

export default App;
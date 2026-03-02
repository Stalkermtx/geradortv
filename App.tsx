import React, { useState } from 'react';
import { generateImage, DEFAULT_PROMPT } from './services/geminiService';
import { AspectRatio, ImageResolution } from './types';
import ImageDisplay from './components/ImageDisplay';
import Controls from './components/Controls';
import ApiKeyChecker from './components/ApiKeyChecker';
import { Sparkles, Zap } from 'lucide-react';

const App: React.FC = () => {
  const [apiKeyValid, setApiKeyValid] = useState<boolean>(false);
  const [prompt, setPrompt] = useState<string>(DEFAULT_PROMPT);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [resolution, setResolution] = useState<ImageResolution>('4K');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!apiKeyValid) {
       // Should technically be caught by the modal overlay, but good for safety
       setError("API Key verification required.");
       return;
    }
    
    setLoading(true);
    setError(null);
    setImageUrl(null);

    try {
      const url = await generateImage(prompt, aspectRatio, resolution);
      setImageUrl(url);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred during generation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-[#050505] to-black text-white selection:bg-yellow-500/30">
      <ApiKeyChecker onKeyValid={() => setApiKeyValid(true)} />
      
      <header className="fixed top-0 left-0 right-0 z-40 border-b border-white/5 bg-black/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shadow-lg shadow-yellow-500/20">
                <Zap className="w-5 h-5 text-black fill-current" />
             </div>
             <h1 className="text-xl font-bold tracking-tight text-white">
               Conex<span className="text-yellow-500">TV</span> <span className="text-zinc-500 font-light mx-2">|</span> <span className="text-zinc-400 font-normal text-sm">Brand Generator</span>
             </h1>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 bg-zinc-900/50 px-3 py-1.5 rounded-full border border-zinc-800">
            <Sparkles className="w-3 h-3 text-yellow-500" />
            POWERED BY GEMINI 3 PRO
          </div>
        </div>
      </header>

      <main className="pt-24 pb-12 px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          
          {/* Left Column: Controls */}
          <div className="lg:col-span-4 space-y-6">
            <Controls 
              prompt={prompt}
              setPrompt={setPrompt}
              aspectRatio={aspectRatio}
              setAspectRatio={setAspectRatio}
              resolution={resolution}
              setResolution={setResolution}
              onGenerate={handleGenerate}
              loading={loading}
            />
            
            <div className="text-xs text-zinc-600 p-4 border border-dashed border-zinc-800 rounded-xl">
              <strong className="text-zinc-500 block mb-1">Pro Tip:</strong>
              Use high contrast terminology like "cinematic lighting", "8K", and "ray-traced" to get the best metallic effects. The model is optimized for high-fidelity textures.
            </div>
          </div>

          {/* Right Column: Preview */}
          <div className="lg:col-span-8">
            <div className="sticky top-24 space-y-4">
               <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Live Preview</h2>
                  {imageUrl && (
                    <span className="text-xs text-green-500 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"/>
                      Generation Complete
                    </span>
                  )}
               </div>
               <ImageDisplay 
                 imageUrl={imageUrl} 
                 loading={loading} 
                 error={error} 
               />
               
               {/* Technical Specs Footer beneath image */}
               <div className="grid grid-cols-3 gap-4 mt-6">
                  <div className="glass-panel p-4 rounded-lg flex flex-col items-center justify-center text-center">
                     <span className="text-zinc-500 text-xs uppercase mb-1">Model</span>
                     <span className="text-zinc-200 font-mono text-sm">Gemini 3 Pro</span>
                  </div>
                  <div className="glass-panel p-4 rounded-lg flex flex-col items-center justify-center text-center">
                     <span className="text-zinc-500 text-xs uppercase mb-1">Resolution</span>
                     <span className="text-zinc-200 font-mono text-sm">{resolution}</span>
                  </div>
                  <div className="glass-panel p-4 rounded-lg flex flex-col items-center justify-center text-center">
                     <span className="text-zinc-500 text-xs uppercase mb-1">Processing</span>
                     <span className="text-zinc-200 font-mono text-sm">Deep Ray-Tracing</span>
                  </div>
               </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
};

export default App;
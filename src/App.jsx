import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Settings, Play, Shuffle, RefreshCw, Trophy, Image as ImageIcon, Type, Sparkles, Heart } from 'lucide-react';

/* --- ScratchCard Component ---
   Handles the HTML5 Canvas scratching logic with improved smoothing.
*/
const ScratchCard = ({ 
  width, 
  height, 
  content, 
  type, 
  isRevealed, 
  onReveal, 
  onScratchStart,
  isLocked, 
  isWinner,
  color = 'gray' // Default color
}) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const lastPos = useRef(null); // Track last position for smooth lines
  const [isScratched, setIsScratched] = useState(false);
  const [isScratching, setIsScratching] = useState(false);

  // Color Definitions
  const colorMap = {
    indigo: { main: '#6366f1', light: '#a5b4fc', dark: '#4338ca' },
    purple: { main: '#a855f7', light: '#d8b4fe', dark: '#7e22ce' },
    emerald: { main: '#10b981', light: '#6ee7b7', dark: '#047857' },
    amber: { main: '#f59e0b', light: '#fcd34d', dark: '#b45309' },
    rose: { main: '#f43f5e', light: '#fda4af', dark: '#be123c' },
    gray: { main: '#9ca3af', light: '#e5e7eb', dark: '#4b5563' } 
  };

  // Initialize Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    // Handle High DPI displays
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    
    // Important: Scale the context so drawing operations match CSS pixels
    ctx.scale(dpr, dpr);
    
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    // Draw the scratch coating
    resetCanvas(ctx, width, height, color);
  }, [width, height, color]); // Add color dependency

  // Handle forcing reveal (e.g. at end of game)
  useEffect(() => {
    if (isRevealed && !isScratched) {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setIsScratched(true);
      }
    } else if (!isRevealed && !isScratched) {
       const canvas = canvasRef.current;
       if (canvas) {
         const ctx = canvas.getContext('2d');
         const dpr = window.devicePixelRatio || 1;
         ctx.setTransform(dpr, 0, 0, dpr, 0, 0); 
         resetCanvas(ctx, width, height, color);
       }
    }
  }, [isRevealed, isScratched, width, height, color]);

  const resetCanvas = (ctx, w, h, colorKey) => {
    ctx.globalCompositeOperation = 'source-over';
    
    const theme = colorMap[colorKey] || colorMap.gray;

    // Gradient based on color theme
    const gradient = ctx.createLinearGradient(0, 0, w, h);
    gradient.addColorStop(0, theme.light); 
    gradient.addColorStop(0.5, theme.main); 
    gradient.addColorStop(1, theme.light); 
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    // Scratch Me Text - White with shadow for better visibility on colors
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 4;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SCRATCH ME', w / 2, h / 2);
    ctx.shadowBlur = 0; // Reset shadow
    
    // Pattern dots
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    for(let i=0; i<50; i++) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        const r = Math.random() * 3 + 1;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }
  };

  const getMousePos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Handle both touch and mouse events
    const clientX = e.touches && e.touches.length > 0 ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches && e.touches.length > 0 ? e.touches[0].clientY : e.clientY;
    
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const scratch = (x, y) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = 40;     // Brush size
    ctx.lineCap = 'round';  // Smooth ends
    ctx.lineJoin = 'round'; // Smooth corners

    ctx.beginPath();
    if (lastPos.current) {
        // Draw continuous line from last position
        ctx.moveTo(lastPos.current.x, lastPos.current.y);
        ctx.lineTo(x, y);
    } else {
        // First dot
        ctx.moveTo(x, y);
        ctx.lineTo(x, y);
    }
    ctx.stroke();

    lastPos.current = { x, y };
  };

  const checkRevealProgress = useCallback(() => {
    if (isScratched || isLocked) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    
    // We analyze the raw pixel data
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;
    let transparent = 0;
    
    // Sampling every 16th pixel (4x4 block) is fast and accurate enough
    const totalPixels = data.length / 4;
    const step = 16; 

    for (let i = 0; i < totalPixels; i += step) {
      if (data[i * 4 + 3] === 0) { // Alpha channel is 0
        transparent++;
      }
    }

    // Threshold: if > 40% is cleared
    const actualTotalSamples = totalPixels / step;
    if (transparent > actualTotalSamples * 0.4) {
      setIsScratched(true);
      ctx.clearRect(0, 0, w, h); // Clear remaining debris
      onReveal(content);
    }
  }, [isScratched, isLocked, onReveal, content]);

  const handleStart = (e) => {
    if (isLocked || isScratched) return;
    setIsScratching(true);
    
    // Notify parent that scratching has started
    if (onScratchStart) {
        onScratchStart();
    }

    const { x, y } = getMousePos(e);
    lastPos.current = { x, y };
    scratch(x, y);
  };

  const handleMove = (e) => {
    if (!isScratching || isLocked || isScratched) return;
    
    // Prevent scrolling only when interacting with the canvas
    if (e.cancelable) e.preventDefault(); 
    
    const { x, y } = getMousePos(e);
    scratch(x, y);
    
    // Check progress periodically (e.g. random chance or counter) 
    // to avoid slamming the CPU on every move event
    if (Math.random() > 0.8) {
        checkRevealProgress();
    }
  };

  const handleEnd = () => {
    if (isScratching) {
        setIsScratching(false);
        lastPos.current = null;
        checkRevealProgress(); // Always check when user lifts finger/mouse
    }
  };

  return (
    <div 
      ref={containerRef}
      className={`relative rounded-xl overflow-hidden shadow-lg border-4 transition-all duration-500 transform ${isWinner ? 'border-yellow-400 scale-105 shadow-yellow-200 ring-4 ring-yellow-200/50' : 'border-gray-200 hover:scale-[1.02]'} ${isLocked && !isRevealed ? 'opacity-80' : 'opacity-100'}`}
      style={{ width, height }}
    >
      {/* Underlying Content */}
      <div className="absolute inset-0 flex items-center justify-center bg-white p-4">
        {type === 'image' ? (
          <img 
            src={content} 
            alt="Prize" 
            className="w-full h-full object-contain pointer-events-none select-none" 
            onError={(e) => {
                e.target.onerror = null;
                e.target.src = "https://placehold.co/150x150?text=Image+Error";
            }}
          />
        ) : (
          <div className="flex flex-col items-center gap-2">
             {isWinner && <Sparkles className="text-yellow-500 animate-spin-slow" size={24} />}
             <p className="text-xl font-bold text-center text-gray-800 break-words pointer-events-none select-none">
                {content}
             </p>
          </div>
        )}
      </div>

      {/* Scratch Layer */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-crosshair touch-none z-10"
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
      />
    </div>
  );
};

/* --- Main App Component --- */
export default function App() {
  const [mode, setMode] = useState('editor'); // 'editor' | 'play'
  const [numCards, setNumCards] = useState(3);
  const [shouldShuffle, setShouldShuffle] = useState(true);
  
  // Editor State
  const [cardConfigs, setCardConfigs] = useState([
    { id: 1, type: 'text', content: 'Better Luck Next Time!' },
    { id: 2, type: 'text', content: 'Free Coffee ☕' },
    { id: 3, type: 'text', content: '$10 Gift Card 🎁' },
    { id: 4, type: 'text', content: 'High Five ✋' },
    { id: 5, type: 'text', content: 'Mystery Prize ❓' },
  ]);

  // Game State
  const [gameCards, setGameCards] = useState([]);
  const [gameState, setGameState] = useState('playing'); // 'playing', 'finished'
  const [result, setResult] = useState(null);
  const [wonCardId, setWonCardId] = useState(null);
  const [startedCardId, setStartedCardId] = useState(null); // Track which card user started scratching

  const handleNumCardsChange = (e) => {
    let val = parseInt(e.target.value);
    if (val < 1) val = 1;
    if (val > 5) val = 5;
    setNumCards(val);
  };

  const updateCardConfig = (id, field, value) => {
    setCardConfigs(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const startGame = () => {
    // Take the first N configs based on numCards
    const activeConfigs = cardConfigs.slice(0, numCards);
    
    let initialGameCards;

    if (shouldShuffle) {
        // Shuffle logic
        initialGameCards = [...activeConfigs]
            .map(value => ({ value, sort: Math.random() }))
            .sort((a, b) => a.sort - b.sort)
            .map(({ value }, index) => ({
                ...value,
                gameId: `card-${index}-${Date.now()}`, // Unique ID for key
                isRevealed: false
            }));
    } else {
        // Preserve order
        initialGameCards = activeConfigs.map((config, index) => ({
            ...config,
            gameId: `card-${index}-${Date.now()}`, // Unique ID for key
            isRevealed: false
        }));
    }

    setGameCards(initialGameCards);
    setGameState('playing'); // Jump straight to playing
    setResult(null);
    setWonCardId(null);
    setStartedCardId(null); // Reset scratching state
    setMode('play');
  };

  const handleCardReveal = (cardId, content) => {
    if (gameState === 'finished') return;

    setGameState('finished');
    setResult(content);
    setWonCardId(cardId);
    
    // Reveal all other cards after a short delay
    setTimeout(() => {
      setGameCards(prev => prev.map(c => ({ ...c, isRevealed: true })));
    }, 500);
  };

  const handleCardStart = (cardId) => {
      if (!startedCardId && gameState === 'playing') {
          setStartedCardId(cardId);
      }
  };

  const handleReset = () => {
    setMode('editor');
    setGameState('playing');
    setResult(null);
    setStartedCardId(null);
  };

  const handleReplay = () => {
    startGame();
  };

  const handlePlayerShuffle = () => {
    // Force a shuffle of the currently active cards
    const activeConfigs = cardConfigs.slice(0, numCards);
    
    const shuffledCards = [...activeConfigs]
        .map(value => ({ value, sort: Math.random() }))
        .sort((a, b) => a.sort - b.sort)
        .map(({ value }, index) => ({
            ...value,
            gameId: `shuffled-${index}-${Date.now()}`, 
            isRevealed: false
        }));

    setGameCards(shuffledCards);
    setGameState('playing');
    setResult(null);
    setWonCardId(null);
    setStartedCardId(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 font-sans text-gray-900 p-4 md:p-8">
      
      <div className="max-w-4xl mx-auto bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl overflow-hidden min-h-[600px] flex flex-col">
        
        {/* Header */}
        <header className="bg-white border-b border-gray-100 p-6 flex justify-between items-center sticky top-0 z-20">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-md">
                <Trophy size={20} />
             </div>
             <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-pink-600">
                Lucky Scratch
             </h1>
          </div>
          {mode === 'play' && (
             <button 
                onClick={handleReset}
                className="text-sm font-medium text-gray-500 hover:text-indigo-600 flex items-center gap-2 transition-colors"
             >
                <Settings size={16} />
                Edit Cards
             </button>
          )}
        </header>

        {/* Content Area */}
        <div className="flex-1 p-6 md:p-8 overflow-y-auto">
          
          {mode === 'editor' ? (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-gray-50 p-6 rounded-2xl border border-gray-100">
                 <div>
                    <h2 className="text-xl font-semibold text-gray-800">Setup Your Scratch Cards</h2>
                    <p className="text-gray-500 mt-1">Configure prizes and settings.</p>
                 </div>
                 
                 <div className="flex flex-wrap items-center gap-6">
                    {/* Shuffle Toggle */}
                    <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-gray-200 shadow-sm">
                        <button 
                            onClick={() => setShouldShuffle(!shouldShuffle)}
                            className={`w-12 h-6 rounded-full transition-colors relative ${shouldShuffle ? 'bg-indigo-600' : 'bg-gray-300'}`}
                        >
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${shouldShuffle ? 'left-7' : 'left-1'}`} />
                        </button>
                        <span className="text-sm font-medium text-gray-700 cursor-pointer select-none" onClick={() => setShouldShuffle(!shouldShuffle)}>
                            Shuffle Cards
                        </span>
                    </div>

                    {/* Number Selector */}
                    <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-xl border border-gray-200 shadow-sm">
                        <label className="text-sm font-medium text-gray-700">Count:</label>
                        <div className="flex items-center gap-3">
                           <input 
                              type="range" 
                              min="1" 
                              max="5" 
                              value={numCards}
                              onChange={handleNumCardsChange}
                              className="w-24 accent-indigo-600 cursor-pointer"
                            />
                            <span className="font-bold text-indigo-600 w-4">{numCards}</span>
                        </div>
                    </div>
                 </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {cardConfigs.slice(0, numCards).map((card, idx) => (
                  <div key={card.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow relative">
                    <div className="absolute -top-3 -left-3 bg-indigo-100 text-indigo-700 w-8 h-8 flex items-center justify-center rounded-full text-xs font-bold border-2 border-white shadow-sm">
                        {idx + 1}
                    </div>

                    <div className="flex items-center justify-end mb-3 mr-6">
                        <div className="flex bg-gray-100 rounded-lg p-1">
                            <button 
                                onClick={() => updateCardConfig(card.id, 'type', 'text')}
                                className={`p-1.5 rounded-md transition-all ${card.type === 'text' ? 'bg-white shadow text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                <Type size={16} />
                            </button>
                            <button 
                                onClick={() => updateCardConfig(card.id, 'type', 'image')}
                                className={`p-1.5 rounded-md transition-all ${card.type === 'image' ? 'bg-white shadow text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                <ImageIcon size={16} />
                            </button>
                        </div>
                    </div>

                    {card.type === 'text' ? (
                        <textarea
                            value={card.content}
                            onChange={(e) => updateCardConfig(card.id, 'content', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none text-sm min-h-[80px]"
                            placeholder="Enter prize text..."
                        />
                    ) : (
                        <div className="space-y-2">
                             <input
                                type="text"
                                value={card.content.startsWith('http') ? card.content : ''}
                                onChange={(e) => updateCardConfig(card.id, 'content', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                placeholder="Paste Image URL..."
                            />
                            <div className="h-20 w-full bg-gray-50 rounded-lg overflow-hidden border border-gray-100 flex items-center justify-center relative group">
                                {card.content && card.content.startsWith('http') ? (
                                    <img src={card.content} alt="Preview" className="h-full object-contain" />
                                ) : (
                                    <span className="text-gray-400 text-xs">No Image</span>
                                )}
                            </div>
                        </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-center pt-4">
                 <button 
                    onClick={startGame}
                    className="group bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-4 rounded-2xl font-semibold shadow-lg shadow-indigo-200 transition-all hover:scale-105 active:scale-95 flex items-center gap-3"
                 >
                    <Play size={24} className="fill-current" />
                    <span className="text-lg">Start Game</span>
                 </button>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center">
               
               {/* Game Status / Result */}
               <div className="mb-8 text-center min-h-[5rem] flex flex-col justify-center">
                 {gameState === 'finished' ? (
                   <div className="animate-in zoom-in duration-300">
                     <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">Result</p>
                     <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-600 to-indigo-600">
                        You found: {gameCards.find(c => c.gameId === wonCardId)?.type === 'image' ? 'A Prize!' : result}
                     </h2>
                   </div>
                 ) : (
                   <div className="animate-in fade-in slide-in-from-top-2 duration-500">
                       <p className="text-indigo-600 font-bold text-xl">Pick a card to scratch!</p>
                       <p className="text-gray-400 text-sm mt-1">
                           Use your finger or mouse to scratch the card! {startedCardId 
                             ? "Finish scratching this card!" 
                             : "Find the hidden prize"}
                       </p>
                   </div>
                 )}
               </div>

               {/* Cards Container */}
               <div className="flex-1 w-full flex items-center justify-center">
                   <div className="flex flex-wrap justify-center gap-6 md:gap-8">
                       {gameCards.map((card) => {
                           // Logic to lock cards
                           const isFinished = gameState === 'finished';
                           const isNotWinner = isFinished && card.gameId !== wonCardId;
                           // If ANY card has been started, lock all others that are NOT the started one
                           const isOtherCardStarted = !isFinished && startedCardId && startedCardId !== card.gameId;
                           
                           const locked = isNotWinner || isOtherCardStarted;

                           return (
                               <div key={card.gameId} className={`transition-opacity duration-500 ${locked && !card.isRevealed ? 'opacity-50 grayscale' : 'opacity-100'}`}>
                                   <ScratchCard
                                       width={200}
                                       height={200}
                                       content={card.content}
                                       type={card.type}
                                       color="indigo" // Force uniform color
                                       isRevealed={card.isRevealed}
                                       isLocked={locked}
                                       onScratchStart={() => handleCardStart(card.gameId)}
                                       isWinner={card.gameId === wonCardId}
                                       onReveal={(content) => handleCardReveal(card.gameId, content)}
                                   />
                               </div>
                           );
                       })}
                   </div>
               </div>

               {/* Game Controls */}
               <div className="mt-8 flex gap-4">
                  {gameState === 'finished' ? (
                      <button 
                        onClick={handleReplay}
                        className="bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200 px-8 py-3 rounded-xl font-semibold transition-all flex items-center gap-2"
                      >
                        <RefreshCw size={20} />
                        Play Again
                      </button>
                  ) : (
                    <div className="flex gap-3">
                        <button 
                            onClick={handlePlayerShuffle}
                            className={`bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-semibold shadow-md shadow-indigo-200 transition-all flex items-center gap-2 ${startedCardId ? 'opacity-50 cursor-not-allowed' : ''}`}
                            disabled={!!startedCardId} // Disable shuffle once scratching starts
                        >
                            <Shuffle size={18} />
                            Shuffle
                        </button>
                        <button 
                            onClick={handleReplay}
                            className="bg-white border-2 border-gray-100 text-gray-500 hover:text-indigo-600 hover:border-indigo-100 px-4 py-2 rounded-xl font-medium transition-all flex items-center gap-2"
                        >
                            <RefreshCw size={18} />
                            Reset
                        </button>
                    </div>
                  )}
               </div>
            </div>
          )}
        </div>
        
        {/* Footer with Donation Link */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex flex-col items-center gap-2">
            <p className="text-xs text-gray-400 font-medium">Powered by ampmie152</p>
            <a 
                href="https://ampmie152.blogspot.com/p/please-support-me.html" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-pink-50 text-pink-600 hover:bg-pink-100 hover:text-pink-700 transition-colors text-sm font-medium border border-pink-100"
            >
                <Heart size={16} className="fill-current" />
                <span>Support Me</span>
            </a>
        </div>
      </div>
    </div>
  );
}
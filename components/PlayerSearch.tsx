import React, { useState, useEffect } from 'react';
import { Search, User, Check } from 'lucide-react';
import { PlayerProfile } from '../types';

// Hardcoded library of "Consistent Characters" based on the style reference
export const KNOWN_PLAYERS: PlayerProfile[] = [
  { 
    id: 'cr7', 
    name: 'Cristiano Ronaldo', 
    team: 'Al Nassr / Portugal', 
    visual_tokens: 'Cartoon Cristiano Ronaldo, extremely long neck, exaggerated sharp jawline, prominent adams apple, slicked back hair, confident smirk, wearing yellow and blue Al Nassr jersey number 7, caricature style' 
  },
  { 
    id: 'leo', 
    name: 'Lionel Messi', 
    team: 'Inter Miami / Argentina', 
    visual_tokens: 'Cartoon Lionel Messi, short neck, beard, kind eyes, wearing pink Inter Miami jersey number 10, caricature style' 
  },
  { 
    id: 'haaland', 
    name: 'Erling Haaland', 
    team: 'Man City', 
    visual_tokens: 'Cartoon Erling Haaland, long blonde hair tied back, viking features, wide mouth, pale skin, sky blue Man City jersey, caricature style' 
  },
  { 
    id: 'mbappe', 
    name: 'Kylian Mbappe', 
    team: 'Real Madrid', 
    visual_tokens: 'Cartoon Kylian Mbappe, shaved head, ninja turtle resemblance features, wearing white Real Madrid jersey, speed lines, caricature style' 
  },
  { 
    id: 'bellingham', 
    name: 'Jude Bellingham', 
    team: 'Real Madrid', 
    visual_tokens: 'Cartoon Jude Bellingham, short afro hair, open arms celebration pose, white Real Madrid jersey, caricature style' 
  }
];

interface PlayerSearchProps {
  selectedPlayer: PlayerProfile | null;
  onSelectPlayer: (player: PlayerProfile) => void;
}

export const PlayerSearch: React.FC<PlayerSearchProps> = ({ selectedPlayer, onSelectPlayer }) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  // Filter players
  const filtered = KNOWN_PLAYERS.filter(p => 
    p.name.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (selectedPlayer) {
      setQuery(selectedPlayer.name);
    }
  }, [selectedPlayer]);

  return (
    <div className="relative w-full space-y-3">
      <label className="block text-sm font-medium text-gray-300">Select Target Player</label>
      
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {selectedPlayer ? <Check className="text-green-500" size={16} /> : <Search className="text-gray-500" size={16} />}
        </div>
        
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            if (e.target.value === '') onSelectPlayer(null as any);
          }}
          onFocus={() => setIsOpen(true)}
          className={`w-full bg-gray-800 border ${selectedPlayer ? 'border-green-500/50' : 'border-gray-700'} rounded-xl py-3 pl-10 pr-4 text-sm text-gray-200 focus:ring-2 focus:ring-purple-500 outline-none transition-all`}
          placeholder="Search player (e.g. Ronaldo)..."
        />

        {isOpen && query.length > 0 && !selectedPlayer && (
          <div className="absolute z-10 w-full mt-2 bg-gray-800 border border-gray-700 rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto">
            {filtered.length > 0 ? (
              filtered.map((player) => (
                <div 
                  key={player.id}
                  onClick={() => {
                    onSelectPlayer(player);
                    setIsOpen(false);
                  }}
                  className="px-4 py-3 hover:bg-gray-700 cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center text-gray-500 group-hover:text-white group-hover:bg-purple-600 transition-colors">
                        <User size={14} />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-gray-200">{player.name}</p>
                        <p className="text-[10px] text-gray-500">{player.team}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-4 py-3 text-xs text-gray-500 italic">
                Player not in library. Using generic generation.
              </div>
            )}
          </div>
        )}
      </div>

      {selectedPlayer && (
        <div className="bg-green-900/10 border border-green-900/30 rounded-lg p-3">
            <p className="text-[10px] text-green-400 font-mono uppercase tracking-wider mb-1">Active Style Model</p>
            <p className="text-xs text-gray-400 italic">"{selectedPlayer.visual_tokens}"</p>
        </div>
      )}
    </div>
  );
};
import React from 'react';
import { NewsCandidate } from '../types';
import { Newspaper, ChevronRight, Trophy, Clock } from 'lucide-react';

interface NewsSelectorProps {
  candidates: NewsCandidate[];
  onSelect: (candidate: NewsCandidate) => void;
}

export const NewsSelector: React.FC<NewsSelectorProps> = ({ candidates, onSelect }) => {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 animate-in fade-in slide-in-from-bottom-4">
      <h3 className="text-lg font-bold text-blue-400 mb-2 flex items-center gap-2">
        <Newspaper size={20} />
        Confirm the Event
      </h3>
      <p className="text-sm text-gray-400 mb-4">
        We found these recent matches. Select the exact event to reconstruct:
      </p>

      <div className="space-y-3">
        {candidates.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c)}
            className="w-full text-left bg-black/40 hover:bg-black/60 border border-gray-700 hover:border-blue-500 rounded-lg p-4 transition-all group flex flex-col gap-2"
          >
            <div className="flex justify-between items-start w-full">
                <div>
                    <div className="font-bold text-gray-200 text-sm flex items-center gap-2">
                        {c.title}
                        <span className="bg-gray-800 text-gray-400 text-[10px] px-2 py-0.5 rounded">{c.scoreline}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1 flex items-center gap-3">
                        <span className="text-blue-400">{c.date}</span> 
                        <span className="flex items-center gap-1"><Trophy size={10} /> {c.competition}</span>
                        <span className="flex items-center gap-1"><Clock size={10} /> {c.minute}</span>
                    </div>
                </div>
                <ChevronRight className="text-gray-600 group-hover:text-blue-400 transition-colors" size={20} />
            </div>
            
            <div className="text-xs text-gray-300 italic border-l-2 border-gray-600 pl-2 mt-1">
                "{c.action_description}"
            </div>
            
            <div className="text-[10px] text-gray-500 flex gap-2 mt-1">
                <span className="uppercase tracking-wider">Kit:</span> 
                {c.kit_colors.shirt} / {c.kit_colors.shorts}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
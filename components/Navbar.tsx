import React from 'react';
import { Calendar, Layers, BarChart2, Settings } from 'lucide-react';
import { ViewState } from '../types';

interface NavbarProps {
  currentView: ViewState;
  setView: (view: ViewState) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentView, setView }) => {
  const navItems = [
    { id: 'calendar', icon: Calendar, label: 'Calendário' },
    { id: 'shifts', icon: Layers, label: 'Turnos' },
    { id: 'analytics', icon: BarChart2, label: 'Análise' },
    { id: 'settings', icon: Settings, label: 'Ajustes' },
  ];

  return (
    <div className="fixed bottom-3 left-0 right-0 z-50 flex justify-center pointer-events-none">
      <div className="bg-surface/90 backdrop-blur-xl border border-white/5 px-1.5 py-1.5 rounded-[2rem] shadow-2xl flex justify-between items-center w-[92%] max-w-[380px] pointer-events-auto transition-all duration-300">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id as ViewState)}
              className={`flex flex-col items-center justify-center w-full h-11 sm:h-12 rounded-2xl transition-all duration-300 active:scale-90 ${
                isActive 
                  ? 'bg-primary text-white shadow-lg shadow-primary/30 transform -translate-y-1' 
                  : 'text-textMuted hover:text-text hover:bg-white/5'
              }`}
            >
              <Icon size={isActive ? 20 : 18} strokeWidth={isActive ? 2.5 : 2} />
              {/* Active indicator dot */}
              <div className={`w-1 h-1 bg-white rounded-full mt-1 transition-all duration-300 ${isActive ? 'opacity-100 scale-100' : 'opacity-0 scale-0'}`} />
            </button>
          );
        })}
      </div>
    </div>
  );
};
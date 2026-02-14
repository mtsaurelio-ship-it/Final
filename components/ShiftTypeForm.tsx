import React, { useState, useEffect } from 'react';
import { X, Check, Clock, DollarSign, Type, Trash2 } from 'lucide-react';
import { ShiftType, COLORS } from '../types';

interface ShiftTypeFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (shiftType: Omit<ShiftType, 'id'>) => void;
  onUpdate: (shiftType: ShiftType) => void;
  onDelete: (id: string) => void; 
  initialData?: ShiftType;
}

export const ShiftTypeForm: React.FC<ShiftTypeFormProps> = ({
  isOpen,
  onClose,
  onSave,
  onUpdate,
  onDelete,
  initialData,
}) => {
  const [name, setName] = useState('');
  const [abbreviation, setAbbreviation] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [startTime, setStartTime] = useState('07:00');
  const [endTime, setEndTime] = useState('19:00');
  const [defaultRate, setDefaultRate] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setName(initialData.name);
        setAbbreviation(initialData.abbreviation);
        setColor(initialData.color);
        setStartTime(initialData.startTime);
        setEndTime(initialData.endTime);
        setDefaultRate(initialData.defaultRate.toString());
      } else {
        // Reset for new
        setName('');
        setAbbreviation('');
        setColor(COLORS[0]);
        setStartTime('07:00');
        setEndTime('19:00');
        setDefaultRate('');
      }
    }
  }, [isOpen, initialData]);

  const handleSubmit = () => {
    if (!name) return; 
    
    const data = {
      name,
      abbreviation: abbreviation || name.substring(0, 3).toUpperCase(),
      color,
      startTime,
      endTime,
      defaultRate: parseFloat(defaultRate) || 0
    };

    if (initialData) {
      onUpdate({ ...data, id: initialData.id });
    } else {
      onSave(data);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-md">
      <div className="bg-surface w-full max-w-sm rounded-[2rem] overflow-hidden shadow-2xl animate-slide-up border border-white/10">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-surface">
          <h2 className="text-xl font-black text-text tracking-tight">
            {initialData ? 'Editar Tipo' : 'Criar Tipo'}
          </h2>
          <button onClick={onClose} className="bg-surfaceHighlight p-1.5 rounded-full text-textMuted hover:text-white hover:bg-red-500/20 transition-all">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto no-scrollbar">
          
          {/* Name & Abbreviation */}
          <div className="space-y-3.5">
            <div>
              <label className="block text-[10px] font-bold text-textMuted uppercase tracking-widest mb-1.5">Nome do Plantão</label>
              <div className="relative group">
                <Type size={16} className="absolute left-3.5 top-3 text-textMuted group-focus-within:text-primary transition-colors" />
                <input
                  type="text"
                  placeholder="Ex: Hospital Regional"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-surfaceHighlight border border-transparent focus:border-primary rounded-2xl py-2.5 pl-10 pr-3 text-text focus:outline-none font-bold shadow-inner text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-textMuted uppercase tracking-widest mb-1.5">Sigla (3-4 letras)</label>
              <input
                type="text"
                placeholder="Ex: HRJ"
                maxLength={5}
                value={abbreviation}
                onChange={(e) => setAbbreviation(e.target.value.toUpperCase())}
                className="w-full bg-surfaceHighlight border border-transparent focus:border-primary rounded-2xl py-2.5 px-3 text-text focus:outline-none font-bold shadow-inner uppercase text-center tracking-widest text-sm"
              />
            </div>
          </div>

          {/* Color Picker */}
          <div>
            <label className="block text-[10px] font-bold text-textMuted uppercase tracking-widest mb-2.5">Cor da Etiqueta</label>
            <div className="grid grid-cols-5 gap-2.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-full aspect-square rounded-2xl transition-all shadow-lg ${
                    color === c ? 'ring-4 ring-white/30 scale-110 shadow-xl' : 'hover:scale-105 opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Default Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-textMuted font-bold uppercase mb-1.5 block">Início Padrão</label>
              <div className="relative group">
                <Clock size={16} className="absolute left-3.5 top-3 text-textMuted group-focus-within:text-primary transition-colors" />
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full bg-surfaceHighlight border border-transparent focus:border-primary rounded-2xl py-2.5 pl-10 pr-3 text-text focus:outline-none font-bold shadow-inner text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-textMuted font-bold uppercase mb-1.5 block">Fim Padrão</label>
              <div className="relative group">
                <Clock size={16} className="absolute left-3.5 top-3 text-textMuted group-focus-within:text-primary transition-colors" />
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full bg-surfaceHighlight border border-transparent focus:border-primary rounded-2xl py-2.5 pl-10 pr-3 text-text focus:outline-none font-bold shadow-inner text-sm"
                />
              </div>
            </div>
          </div>

          {/* Default Value */}
          <div>
            <label className="block text-[10px] font-bold text-textMuted uppercase tracking-widest mb-1.5">Valor Padrão (R$)</label>
            <div className="relative group">
              <DollarSign size={18} className="absolute left-3.5 top-3 text-textMuted group-focus-within:text-green-400 transition-colors" />
              <input
                type="number"
                value={defaultRate}
                onChange={(e) => setDefaultRate(e.target.value)}
                placeholder="0.00"
                className="w-full bg-surfaceHighlight border border-transparent focus:border-green-400 rounded-2xl py-2.5 pl-10 pr-3 text-text focus:outline-none font-bold text-base shadow-inner"
              />
            </div>
          </div>

          <div className="pt-1.5 space-y-3">
            <button
              onClick={handleSubmit}
              disabled={!name}
              className={`w-full bg-primary hover:bg-indigo-500 text-white font-bold h-14 rounded-2xl transition-all shadow-xl shadow-indigo-500/30 flex justify-center items-center gap-2.5 active:scale-95 text-base ${!name ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Check size={20} strokeWidth={3} />
              {initialData ? 'SALVAR' : 'CRIAR'}
            </button>
            
            {initialData && (
              <button
                onClick={() => {
                   onDelete(initialData.id);
                   onClose();
                }}
                className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold h-12 rounded-2xl transition-all flex justify-center items-center gap-2 active:scale-95 text-sm"
              >
                <Trash2 size={18} />
                Excluir
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
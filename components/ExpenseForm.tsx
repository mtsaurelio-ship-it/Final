import React, { useState } from 'react';
import { X, DollarSign, Calendar, RefreshCcw, Percent, Check } from 'lucide-react';
import { Expense } from '../types';
import { format } from 'date-fns';

interface ExpenseFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (expense: Omit<Expense, 'id'>) => void;
  selectedMonthDate: Date;
}

export const ExpenseForm: React.FC<ExpenseFormProps> = ({
  isOpen,
  onClose,
  onSave,
  selectedMonthDate,
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<'fixed' | 'variable'>('fixed');
  const [valueType, setValueType] = useState<'fixed' | 'percentage'>('fixed');
  const [value, setValue] = useState('');
  const [date, setDate] = useState(format(selectedMonthDate, 'yyyy-MM-dd'));

  const handleSave = () => {
    if (!name || !value) return;

    onSave({
      name,
      category,
      valueType,
      value: parseFloat(value),
      date: new Date(date),
    });
    
    // Reset form mostly
    setName('');
    setValue('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-md">
      <div className="bg-surface w-full max-w-sm rounded-[2rem] overflow-hidden shadow-2xl animate-slide-up border border-white/10">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-surface">
          <h2 className="text-xl font-black text-text tracking-tight">Adicionar Gasto</h2>
          <button onClick={onClose} className="bg-surfaceHighlight p-1.5 rounded-full text-textMuted hover:text-white hover:bg-red-500/20 transition-all">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          
          {/* Name */}
          <div>
            <label className="block text-[10px] font-bold text-textMuted uppercase tracking-widest mb-1.5">Descrição</label>
            <input
              type="text"
              placeholder="Ex: Imposto, Transporte"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-surfaceHighlight border border-transparent focus:border-primary rounded-2xl py-3 px-4 text-text focus:outline-none font-bold shadow-inner text-sm"
            />
          </div>

          {/* Category Toggle (Fixed vs Variable) */}
          <div>
            <label className="block text-[10px] font-bold text-textMuted uppercase tracking-widest mb-1.5">Frequência</label>
            <div className="grid grid-cols-2 gap-2.5 p-1 bg-surfaceHighlight rounded-2xl border border-white/5">
              <button
                onClick={() => setCategory('fixed')}
                className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  category === 'fixed' ? 'bg-primary text-white shadow-lg' : 'text-gray-400 hover:text-white'
                }`}
              >
                <RefreshCcw size={14} />
                Fixo
              </button>
              <button
                onClick={() => setCategory('variable')}
                className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  category === 'variable' ? 'bg-primary text-white shadow-lg' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Calendar size={14} />
                Variável
              </button>
            </div>
          </div>

          {/* Date Picker (Only if Variable) */}
          {category === 'variable' && (
            <div className="animate-fade-in">
              <label className="block text-[10px] font-bold text-textMuted uppercase tracking-widest mb-1.5">Data de Referência</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-surfaceHighlight border border-transparent focus:border-primary rounded-2xl py-3 px-4 text-text focus:outline-none font-bold text-sm"
              />
            </div>
          )}

          {/* Value Type Toggle & Input */}
          <div>
            <label className="block text-[10px] font-bold text-textMuted uppercase tracking-widest mb-1.5">Valor</label>
            <div className="flex gap-2.5 mb-2.5">
               <button
                  onClick={() => setValueType('fixed')}
                  className={`flex-1 py-2.5 px-2.5 rounded-2xl border text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all ${
                    valueType === 'fixed' 
                      ? 'bg-surfaceHighlight border-primary text-white ring-2 ring-primary/30' 
                      : 'border-white/10 text-gray-500 hover:bg-white/5'
                  }`}
               >
                 <DollarSign size={12} /> Valor (R$)
               </button>
               <button
                  onClick={() => setValueType('percentage')}
                  className={`flex-1 py-2.5 px-2.5 rounded-2xl border text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all ${
                    valueType === 'percentage' 
                      ? 'bg-surfaceHighlight border-primary text-white ring-2 ring-primary/30' 
                      : 'border-white/10 text-gray-500 hover:bg-white/5'
                  }`}
               >
                 <Percent size={12} /> Percentual (%)
               </button>
            </div>

            <div className="relative group">
              {valueType === 'fixed' ? (
                <DollarSign size={18} className="absolute left-4 top-3.5 text-textMuted group-focus-within:text-red-400 transition-colors" />
              ) : (
                <Percent size={18} className="absolute left-4 top-3.5 text-textMuted group-focus-within:text-red-400 transition-colors" />
              )}
              <input
                type="number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={valueType === 'fixed' ? "0.00" : "Ex: 27.5"}
                className="w-full bg-surfaceHighlight border border-transparent focus:border-red-400 rounded-2xl py-3 pl-10 pr-4 text-text focus:outline-none font-bold text-base shadow-inner"
              />
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={!name || !value}
            className={`w-full bg-primary hover:bg-indigo-500 text-white font-bold py-3.5 rounded-2xl transition-all shadow-xl shadow-indigo-500/30 flex justify-center items-center gap-2 active:scale-95 text-base mt-2 ${(!name || !value) ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Check size={20} strokeWidth={3} />
            ADICIONAR
          </button>
        </div>
      </div>
    </div>
  );
};
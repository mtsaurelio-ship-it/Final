import React, { useState, useEffect } from 'react';
import { X, Clock, DollarSign, Calendar as CalendarIcon, Check, BellRing, Minus, Plus } from 'lucide-react';
import { Shift, ShiftType, COLORS } from '../types';
import { format } from 'date-fns';

interface ShiftFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (shift: Omit<Shift, 'id'>) => void;
  selectedDate: Date;
  shiftTypes: ShiftType[];
  initialTypeId?: string;
  initialData?: Shift; // New prop for editing
}

export const ShiftForm: React.FC<ShiftFormProps> = ({
  isOpen,
  onClose,
  onSave,
  selectedDate,
  shiftTypes,
  initialTypeId,
  initialData
}) => {
  const [selectedTypeId, setSelectedTypeId] = useState<string>('');
  const [startTime, setStartTime] = useState('07:00');
  const [endTime, setEndTime] = useState('19:00');
  const [value, setValue] = useState<string>('0');
  const [paymentDate, setPaymentDate] = useState<string>(format(selectedDate, 'yyyy-MM-dd'));
  const [useDefaultPayment, setUseDefaultPayment] = useState(true);
  
  // Notification state
  const [notifyHours, setNotifyHours] = useState(2);

  // Initialize form when opening
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        // EDIT MODE
        setSelectedTypeId(initialData.typeId);
        setStartTime(initialData.startTime);
        setEndTime(initialData.endTime);
        setValue(initialData.value.toString());
        setPaymentDate(format(new Date(initialData.paymentDate), 'yyyy-MM-dd'));
        setNotifyHours(initialData.notificationAdvanceHours || 2);
        setUseDefaultPayment(false); // If editing, assume custom or already set date
      } else {
        // CREATE MODE
        // Use initialTypeId if provided, otherwise default to first available
        const typeIdToUse = initialTypeId || shiftTypes[0]?.id || '';
        setSelectedTypeId(typeIdToUse);

        const type = shiftTypes.find(t => t.id === typeIdToUse) || shiftTypes[0];
        if (type) {
          setStartTime(type.startTime);
          setEndTime(type.endTime);
          setValue(type.defaultRate.toString());
        }
        
        // Update payment date based on the NEW selectedDate passed as prop
        const defaultPayDate = new Date(selectedDate);
        defaultPayDate.setDate(defaultPayDate.getDate() + 30);
        setPaymentDate(format(defaultPayDate, 'yyyy-MM-dd'));

        // Default notification reset
        setNotifyHours(2);
        setUseDefaultPayment(true);
      }
    }
  }, [isOpen, selectedDate, shiftTypes, initialTypeId, initialData]);

  // Handle type change manually while form is open
  const handleTypeChange = (typeId: string) => {
    setSelectedTypeId(typeId);
    const type = shiftTypes.find(t => t.id === typeId);
    if (type) {
        setStartTime(type.startTime);
        setEndTime(type.endTime);
        setValue(type.defaultRate.toString());
    }
  }

  const handleSave = () => {
    const start = parseInt(startTime.split(':')[0]);
    const end = parseInt(endTime.split(':')[0]);
    let duration = end - start;
    if (duration <= 0) duration += 24;

    onSave({
      typeId: selectedTypeId,
      date: initialData ? initialData.date : selectedDate, // Keep original date if editing
      startTime,
      endTime,
      value: parseFloat(value),
      paymentDate: new Date(paymentDate),
      isPaid: initialData ? initialData.isPaid : false,
      durationHours: duration,
      notificationAdvanceHours: notifyHours,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-md">
      <div className="bg-surface w-full max-w-sm rounded-[2rem] overflow-hidden shadow-2xl animate-slide-up border border-white/10">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-surface">
          <h2 className="text-xl font-black text-text tracking-tight">{initialData ? 'Editar Turno' : 'Novo Turno'}</h2>
          <button onClick={onClose} className="bg-surfaceHighlight p-1.5 rounded-full text-textMuted hover:text-white hover:bg-red-500/20 transition-all">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto no-scrollbar">
          {/* Shift Type Selector */}
          <div>
            <label className="block text-[10px] font-bold text-textMuted uppercase tracking-widest mb-2.5">Tipo de Plantão</label>
            <div className="grid grid-cols-2 gap-2.5">
              {shiftTypes.map(type => (
                <button
                  key={type.id}
                  onClick={() => handleTypeChange(type.id)}
                  className={`p-3 rounded-2xl border flex items-center gap-2.5 transition-all ${
                    selectedTypeId === type.id
                      ? 'bg-surfaceHighlight border-primary ring-2 ring-primary/50'
                      : 'bg-surface border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="w-2.5 h-2.5 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)]" style={{ backgroundColor: type.color }} />
                  <span className={`text-xs font-bold truncate ${selectedTypeId === type.id ? 'text-text' : 'text-textMuted'}`}>{type.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Time & Duration */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-textMuted font-bold uppercase mb-1.5 block">Início</label>
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
              <label className="text-[10px] text-textMuted font-bold uppercase mb-1.5 block">Fim</label>
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

          {/* Value */}
          <div>
            <label className="block text-[10px] text-textMuted font-bold uppercase mb-1.5">Valor (R$)</label>
            <div className="relative group">
              <DollarSign size={18} className="absolute left-3.5 top-3 text-textMuted group-focus-within:text-green-400 transition-colors" />
              <input
                type="number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-full bg-surfaceHighlight border border-transparent focus:border-green-400 rounded-2xl py-2.5 pl-10 pr-3 text-text focus:outline-none font-bold text-base shadow-inner"
              />
            </div>
          </div>

           {/* Custom Notification */}
           <div>
            <label className="block text-[10px] text-textMuted font-bold uppercase mb-1.5">Lembrete Personalizado</label>
            <div className="flex items-center justify-between p-3 bg-surfaceHighlight rounded-2xl border border-white/5">
                <div className="flex items-center gap-3">
                    <BellRing size={18} className="text-pink-500" />
                    <span className="text-xs font-bold text-text">Avisar antes</span>
                </div>
                <div className="flex items-center gap-3 bg-surface rounded-xl px-2 py-1 border border-white/5">
                    <button 
                        onClick={() => setNotifyHours(prev => Math.max(1, prev - 1))}
                        className="w-7 h-7 flex items-center justify-center hover:bg-white/10 rounded-lg text-textMuted hover:text-white active:scale-95 transition-all"
                    >
                        <Minus size={14} />
                    </button>
                    
                    <span className="text-sm font-bold text-primary w-6 text-center">{notifyHours}h</span>
                    
                    <button 
                        onClick={() => setNotifyHours(prev => Math.min(48, prev + 1))}
                        className="w-7 h-7 flex items-center justify-center hover:bg-white/10 rounded-lg text-textMuted hover:text-white active:scale-95 transition-all"
                    >
                        <Plus size={14} />
                    </button>
                </div>
            </div>
          </div>

          {/* Payment Date */}
          <div className="bg-surfaceHighlight/50 p-4 rounded-2xl border border-white/5">
            <div className="flex justify-between items-center mb-3">
              <label className="text-xs font-bold text-text flex items-center gap-1.5">
                <CalendarIcon size={16} className="text-primary" />
                Data do Pagamento
              </label>
              <div className="flex items-center gap-1.5 bg-surface p-1 rounded-lg">
                <button 
                   onClick={() => setUseDefaultPayment(!useDefaultPayment)}
                   className={`w-8 h-5 rounded-full p-0.5 transition-colors duration-300 ${useDefaultPayment ? 'bg-primary' : 'bg-gray-600'}`}
                >
                   <div className={`w-4 h-4 bg-white rounded-full transition-transform duration-300 ${useDefaultPayment ? 'translate-x-3' : ''}`} />
                </button>
              </div>
            </div>
            
            <input
              type="date"
              value={paymentDate}
              disabled={useDefaultPayment}
              onChange={(e) => setPaymentDate(e.target.value)}
              className={`w-full bg-surface border border-transparent rounded-xl py-2.5 px-3 text-text focus:outline-none focus:ring-2 focus:ring-primary font-medium text-xs ${useDefaultPayment ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
            {useDefaultPayment && (
              <p className="text-[9px] text-textMuted mt-1.5 font-medium">
                * Automático (30 dias após o plantão)
              </p>
            )}
          </div>

          <button
            onClick={handleSave}
            className="w-full bg-primary hover:bg-indigo-500 text-white font-bold py-3.5 rounded-2xl transition-all shadow-xl shadow-indigo-500/30 flex justify-center items-center gap-2 active:scale-95 text-base"
          >
            <Check size={20} strokeWidth={3} />
            {initialData ? 'SALVAR ALTERAÇÕES' : 'CONFIRMAR'}
          </button>
        </div>
      </div>
    </div>
  );
};
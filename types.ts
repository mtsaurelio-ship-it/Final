
export interface ShiftType {
  id: string;
  name: string;
  abbreviation: string;
  color: string;
  startTime: string;
  endTime: string;
  defaultRate: number;
  archived?: boolean; // New property for soft delete
}

export interface Shift {
  id: string;
  typeId: string;
  date: Date;
  startTime: string;
  endTime: string;
  value: number;
  paymentDate: Date; // New requirement
  isPaid: boolean;
  notes?: string;
  durationHours: number;
  notificationAdvanceHours?: number; // Custom notification time per shift
}

export interface Expense {
  id: string;
  name: string;
  category: 'fixed' | 'variable'; // Fixo (todos meses) ou Variável (mês especifico)
  valueType: 'fixed' | 'percentage'; // Valor em R$ ou % do bruto
  value: number;
  date: Date; // Usado para saber qual mês aplicar se for variável
  
  // New fields for advanced recurrence handling
  recurrenceEnd?: Date; // Se definido, o gasto fixo deixa de aparecer após esta data
  exclusionDates?: string[]; // Lista de datas (yyyy-MM) onde este gasto fixo foi excluído individualmente
}

export interface UserSettings {
  notificationsEnabled: boolean;
  notificationAdvanceHours: number; // Kept as a fallback/default if needed, though UI will remove it
  notificationSound: string; // 'default' | 'chime' | 'alert' etc
  googleDriveSync?: boolean;
  lastBackupDate?: string | null; // ISO string date
  theme: 'dark' | 'light';
}

export type ViewState = 'calendar' | 'shifts' | 'analytics' | 'settings';

export const COLORS = [
  '#F43F5E', // Rose 500 (Vivid Red/Pink)
  '#F59E0B', // Amber 500 (Vivid Orange)
  '#10B981', // Emerald 500 (Vivid Green)
  '#06B6D4', // Cyan 500 (Vivid Blue)
  '#8B5CF6', // Violet 500 (Vivid Purple)
  '#EC4899', // Pink 500 (Hot Pink)
  '#3B82F6', // Blue 500 (Royal Blue)
  '#6366F1', // Indigo 500 (Deep Blue)
  '#84CC16', // Lime 500
  '#14B8A6', // Teal 500
];
export interface Macros {
  netCarbs: number;
  protein: number;
  fat: number;
  calories: number;
}

export interface FoodItem {
  id: string;
  name: string;
  grams: number;
  macros: Macros;
  isAnimalSource: boolean;
}

export interface Meal {
  id: string;
  title: string;
  createdAt: string; // פורמט שעה HH:MM
  photoUri?: string;
  items: FoodItem[];
  hiddenCarbsAlert?: string | null; 
  isLocked: boolean; 
}

export interface DailyLog {
  date: string; // פורמט YYYY-MM-DD משמש כמפתח
  meals: Meal[];
  targetMacros: Macros;
}

// מבנה נתונים קל לתצוגה שבועית
export interface WeeklyProgress {
  dateLabel: string;
  totalCarbs: number;
  totalProtein: number;
  totalFat: number;
} 
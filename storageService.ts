import AsyncStorage from '@react-native-async-storage/async-storage';
import { DailyLog } from './types';

const STORAGE_KEY_PREFIX = '@keto_log_';

export async function saveDailyLog(log: DailyLog): Promise<void> {
  try {
    const key = `${STORAGE_KEY_PREFIX}${log.date}`;
    await AsyncStorage.setItem(key, JSON.stringify(log));
  } catch (e) {
    console.error("Failed to save daily log to storage", e);
  }
}

export async function loadDailyLog(dateStr: string): Promise<DailyLog | null> {
  try {
    const key = `${STORAGE_KEY_PREFIX}${dateStr}`;
    const jsonStr = await AsyncStorage.getItem(key);
    return jsonStr ? JSON.parse(jsonStr) : null;
  } catch (e) {
    console.error("Failed to load daily log from storage", e);
    return null;
  }
}

// שליפת היסטוריה לצורך התקדמות שבועית
export async function loadWeeklyHistory(): Promise<any[]> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const logKeys = keys.filter(key => key.startsWith(STORAGE_KEY_PREFIX));
    const pairs = await AsyncStorage.multiGet(logKeys);
    
    return pairs.map(([key, value]) => {
      if (!value) return null;
      const log: DailyLog = JSON.parse(value);
      
      // אגרגציה של ערכי היום
      const totals = log.meals.reduce((acc, meal) => {
        meal.items.forEach(item => {
          acc.carbs += item.macros.netCarbs;
          acc.protein += item.macros.protein;
          acc.fat += item.macros.fat;
        });
        return acc;
      }, { carbs: 0, protein: 0, fat: 0 });

      return {
        dateLabel: log.date,
        ...totals
      };
    }).filter(item => item !== null);
  } catch (e) {
    console.error("Failed to load history", e);
    return [];
  }
}
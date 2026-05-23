import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator, Alert, DimensionValue } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { DailyLog, Meal } from './types';
import { analyzeMealImage } from './aiService';
import { saveDailyLog, loadDailyLog, loadWeeklyHistory } from './storageService';
import MealCard from './MealCard';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'today' | 'weekly'>('today');
  const [loading, setLoading] = useState(false);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [fastingHours, setFastingHours] = useState<string>("0");
  
  const [todayLog, setTodayLog] = useState<DailyLog>({
    date: new Date().toISOString().split('T')[0], // תאריך של היום
    targetMacros: { netCarbs: 20, protein: 110, fat: 130, calories: 1700 },
    meals: []
  });

  // טעינת נתונים ראשונית מהאחסון המקומי
  useEffect(() => {
    async function initStorage() {
      const saved = await loadDailyLog(todayLog.date);
      if (saved) {
        setTodayLog(saved);
      }
    }
    initStorage();
  }, []);

  // חישוב אוטומטי של חלון צום ומניעת הרצה על מערך ריק
  useEffect(() => {
    if (todayLog.meals.length >= 2) {
      // מיון ארוחות לפי שעה
      const sortedMeals = [...todayLog.meals].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const firstMealTime = sortedMeals[0].createdAt.split(':');
      const lastMealTime = sortedMeals[sortedMeals.length - 1].createdAt.split(':');
      
      const hours = parseInt(lastMealTime[0]) - parseInt(firstMealTime[0]);
      const minutes = parseInt(lastMealTime[1]) - parseInt(firstMealTime[1]);
      const totalEatingWindow = hours + (minutes / 60);
      
      // חלון צום ביום של 24 שעות
      setFastingHours((24 - totalEatingWindow).toFixed(1));
    } else {
      setFastingHours("משתנה (נדרשות 2 ארוחות לפחות)");
    }
    // בכל שינוי של ארוחות - נשמור אוטומטית למכשיר
    saveDailyLog(todayLog);
  }, [todayLog]);

  // טעינת ההיסטוריה השבועית במעבר טאב
  const handleTabChange = async (tab: 'today' | 'weekly') => {
    setCurrentTab(tab);
    if (tab === 'weekly') {
      const history = await loadWeeklyHistory();
      setWeeklyData(history);
    }
  };

  // חישוב סך המאקרו היומי שנאכל בפועל (רק מארוחות נעולות ומאושרות)
  const totalsEaten = todayLog.meals.reduce(
    (acc, meal) => {
      meal.items.forEach((item) => {
        acc.netCarbs += item.macros.netCarbs;
        acc.protein += item.macros.protein;
        acc.fat += item.macros.fat;
        acc.calories += item.macros.calories;
      });
      return acc;
    },
    { netCarbs: 0, protein: 0, fat: 0, calories: 0 }
  );

  // 💬 פונקציית הודעות עידוד חכמות ומשתנות
  const getMotivationalMessage = () => {
    if (todayLog.meals.length === 0) return "⏳ צום לסירוגין פעיל. הגוף שלך שורף שומן ברגע זה!";
    if (totalsEaten.netCarbs > todayLog.targetMacros.netCarbs) return "⚠️ חרגת מתקציב הפחמימות, לא נורא! חזרי מיד לשומן וחלבון מן החי.";
    if (totalsEaten.netCarbs >= todayLog.targetMacros.netCarbs - 5) return "🔥 את על הקצה של הפחמימות! הזמן המושלם להתמקד רק בבשר וביצים.";
    return "💪 סטטוס קטוזיס מעולה! הגוף שלך מכונת אנרגיה יעילה.";
  };

  const handleAddNewMeal = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert("שגיאה", "נדרשת גישה למצלמה");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const takenPhotoUri = result.assets[0].uri;
      const currentTime = new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

      setLoading(true);

      try {
        const rawAiResult = await analyzeMealImage(takenPhotoUri);

        // יצירת ארוחה במצב טיוטה לא נעולה לעריכה ידנית
        const newMeal: Meal = {
          id: Date.now().toString(),
          title: `ארוחה`,
          createdAt: currentTime,
          photoUri: takenPhotoUri,
          items: rawAiResult.items,
          hiddenCarbsAlert: rawAiResult.hiddenCarbsAlert,
          isLocked: false // 🔓 פתוח לעריכה ותיקון ידני!
        };

        setTodayLog({
          ...todayLog,
          meals: [...todayLog.meals, newMeal]
        });

      } catch (error: any) {
        Alert.alert("⚠️ תקלה", error.message);
      } finally {
        setLoading(false);
      }
    }
  };

  // פונקציית נעילת הארוחה לאחר שהמשתמש תיקן ידנית
  const handleLockMeal = (updatedMeal: Meal) => {
    const updatedMeals = todayLog.meals.map(m => m.id === updatedMeal.id ? updatedMeal : m);
    setTodayLog({
      ...todayLog,
      meals: updatedMeals
    });
  };

  // פונקציית עזר לחישוב אחוז לפס התקדמות
  const getProgressWidth = (current: number, target: number) => {
    const percentage = (current / target) * 100;
    return `${Math.min(percentage, 100)}%` as DimensionValue;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* הדר ניווט עליון */}
      <View style={styles.tabNav}>
        <TouchableOpacity style={[styles.tabButton, currentTab === 'weekly' && styles.activeTab]} onPress={() => handleTabChange('weekly')}>
          <Text style={[styles.tabText, currentTab === 'weekly' && styles.activeTabText]}>📊 התקדמות שבועית</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabButton, currentTab === 'today' && styles.activeTab]} onPress={() => handleTabChange('today')}>
          <Text style={[styles.tabText, currentTab === 'today' && styles.activeTabText]}>🥩 היומן היומי</Text>
        </TouchableOpacity>
      </View>

      {currentTab === 'today' ? (
        <ScrollView style={styles.mainScroll}>
          {/* 📊 דאשבורד עם פסי התקדמות (Progress Bars) */}
          <View style={styles.dashboardCard}>
            <Text style={styles.dashboardTitle}>מדד קטוזיס יומי</Text>
            
            {/* פחמימות נטו */}
            <View style={styles.macroProgressContainer}>
              <View style={styles.macroLabels}>
                <Text style={styles.macroValueText}>{totalsEaten.netCarbs.toFixed(1)} / {todayLog.targetMacros.netCarbs}ג׳</Text>
                <Text style={styles.macroLabelText}>פחמימות נטו (תקציב קשיח)</Text>
              </View>
              <View style={styles.progressBarBg}>
                <View style={[
                  styles.progressBarFill, 
                  { width: getProgressWidth(totalsEaten.netCarbs, todayLog.targetMacros.netCarbs) },
                  totalsEaten.netCarbs > todayLog.targetMacros.netCarbs ? { backgroundColor: '#E53E3E' } : { backgroundColor: '#38A169' }
                ]} />
              </View>
            </View>

            {/* חלבון */}
            <View style={styles.macroProgressContainer}>
              <View style={styles.macroLabels}>
                <Text style={styles.macroValueText}>{totalsEaten.protein.toFixed(0)} / {todayLog.targetMacros.protein}ג׳</Text>
                <Text style={styles.macroLabelText}>חלבון (בניית שריר)</Text>
              </View>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: getProgressWidth(totalsEaten.protein, todayLog.targetMacros.protein), backgroundColor: '#3182CE' }]} />
              </View>
            </View>

            {/* שומן */}
            <View style={styles.macroProgressContainer}>
              <View style={styles.macroLabels}>
                <Text style={styles.macroValueText}>{totalsEaten.fat.toFixed(0)} / {todayLog.targetMacros.fat}ג׳</Text>
                <Text style={styles.macroLabelText}>שומן (אנרגיה קיטוגנית)</Text>
              </View>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: getProgressWidth(totalsEaten.fat, todayLog.targetMacros.fat), backgroundColor: '#D69E2E' }]} />
              </View>
            </View>

            {/* 🕒 חלון צום אוטומטי */}
            <View style={styles.fastingSummaryRow}>
              <Text style={styles.fastingValue}>⏳ {fastingHours} שעות</Text>
              <Text style={styles.fastingLabel}>חלון צום משוער להיום:</Text>
            </View>
          </View>

          {/* 💬 בועת הודעת עידוד דינמית */}
          <View style={styles.motivationBubble}>
            <Text style={styles.motivationText}>{getMotivationalMessage()}</Text>
          </View>

          {/* רשימת ארוחות */}
          {todayLog.meals.map((meal, index) => (
            <MealCard key={meal.id} meal={meal} index={index} onLockMeal={handleLockMeal} />
          ))}

          {/* כפתור צילום צף בתחתית היומן */}
          <TouchableOpacity style={styles.floatingAddButton} onPress={handleAddNewMeal} disabled={loading}>
            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.floatingButtonText}>📸 תעד ארוחה חדשה</Text>}
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      ) : (
        // 📊 מסך חלון אחר - התקדמות שבועית
        <ScrollView style={styles.mainScroll}>
          <View style={styles.weeklyHeader}>
            <Text style={styles.weeklyTitle}>סיכום צריכת פחמימות שבועי</Text>
            <Text style={styles.weeklySubtitle}>מעקב חריגות ויציבות בקטוזיס</Text>
          </View>

          {weeklyData.length === 0 ? (
            <Text style={styles.emptyWeeklyText}>אין עדיין מידע שמור בימים קודמים.</Text>
          ) : (
            weeklyData.map((day, idx) => (
              <View key={idx} style={styles.weeklyRowCard}>
                <Text style={styles.weeklyDate}>{day.dateLabel}</Text>
                <View style={styles.weeklyMetrics}>
                  <Text style={[styles.weeklyMetricText, day.carbs > 20 ? { color: '#E53E3E' } : { color: '#38A169' }]}>
                    פחמימות: {day.carbs.toFixed(1)}ג׳ {day.carbs > 20 ? '⚠️' : '✅'}
                  </Text>
                  <Text style={styles.weeklyMetricSub}>חלבון: {day.protein.toFixed(0)}ג׳ | שומן: {day.fat.toFixed(0)}ג׳</Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F9FC' },
  tabNav: { flexDirection: 'row', backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  tabButton: { flex: 1, paddingVertical: 15, alignItems: 'center' },
  activeTab: { borderBottomWidth: 3, borderBottomColor: '#2E7D32' },
  tabText: { fontSize: 15, color: '#A0AEC0', fontWeight: '600' },
  activeTabText: { color: '#2E7D32', fontWeight: '800' },
  mainScroll: { padding: 20 },
  
  dashboardCard: { backgroundColor: '#1A1D1E', borderRadius: 24, padding: 20, marginBottom: 15 },
  dashboardTitle: { color: '#FFF', fontSize: 16, fontWeight: '700', textAlign: 'right', marginBottom: 15 },
  macroProgressContainer: { marginBottom: 12 },
  macroLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  macroValueText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  macroLabelText: { color: '#9A9FA2', fontSize: 13, fontWeight: '600' },
  progressBarBg: { height: 8, backgroundColor: '#2D3133', borderRadius: 4, width: '100%' },
  progressBarFill: { height: '100%', borderRadius: 4 },
  
  fastingSummaryRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#2D3133', paddingTop: 12, marginTop: 5 },
  fastingLabel: { color: '#9A9FA2', fontSize: 13, fontWeight: '600' },
  fastingValue: { color: '#68D391', fontSize: 14, fontWeight: '700' },
  
  motivationBubble: { backgroundColor: '#E8F5E9', padding: 14, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#C8E6C9' },
  motivationText: { color: '#2E7D32', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  
  floatingAddButton: { backgroundColor: '#2E7D32', paddingVertical: 15, borderRadius: 16, alignItems: 'center', marginTop: 10, shadowColor: '#2E7D32', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 3 },
  floatingButtonText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  
  weeklyHeader: { alignItems: 'flex-end', marginBottom: 20 },
  weeklyTitle: { fontSize: 22, fontWeight: '800', color: '#1A1D1E' },
  weeklySubtitle: { fontSize: 14, color: '#718096', marginTop: 4 },
  weeklyRowCard: { backgroundColor: '#FFF', padding: 16, borderRadius: 16, marginBottom: 12, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  weeklyDate: { fontSize: 14, fontWeight: '700', color: '#4A5568' },
  weeklyMetrics: { alignItems: 'flex-end' },
  weeklyMetricText: { fontSize: 15, fontWeight: '700' },
  weeklyMetricSub: { fontSize: 12, color: '#A0AEC0', marginTop: 2 },
  emptyWeeklyText: { textAlign: 'center', color: '#A0AEC0', marginTop: 40, fontSize: 15 }
});
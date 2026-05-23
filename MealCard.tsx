import React, { useState } from 'react';
import { StyleSheet, Text, View, Image, TextInput, TouchableOpacity } from 'react-native';
import { Meal, FoodItem } from './types';

interface MealCardProps {
  meal: Meal;
  index: number;
  onLockMeal?: (updatedMeal: Meal) => void; // נקרא רק כשהמשתמש נועל ארוחה חדשה
}

export default function MealCard({ meal, index, onLockMeal }: MealCardProps) {
  const [editableItems, setEditableItems] = useState<FoodItem[]>(meal.items);

  // פונקציה לעדכון משקל ידני וחישוב מחדש פרופורציונלי של הערכים
  const handleGramsChange = (itemId: string, text: string) => {
    const newGrams = parseFloat(text) || 0;
    
    const updated = editableItems.map(item => {
      if (item.id === itemId) {
        const ratio = item.grams > 0 ? newGrams / item.grams : 0;
        return {
          ...item,
          grams: newGrams,
          macros: {
            netCarbs: Math.round((item.macros.netCarbs * ratio) * 10) / 10,
            protein: Math.round((item.macros.protein * ratio) * 10) / 10,
            fat: Math.round((item.macros.fat * ratio) * 10) / 10,
            calories: Math.round(item.macros.calories * ratio)
          }
        };
      }
      return item;
    });
    setEditableItems(updated);
  };

  const handleConfirmAndLock = () => {
    if (onLockMeal) {
      onLockMeal({
        ...meal,
        items: editableItems,
        isLocked: true // 🔒 נועלים את הארוחה לתמיד
      });
    }
  };

  // חישוב המאקרו הנוכחי של הקארד
  const totalMacros = editableItems.reduce(
    (acc, item) => {
      acc.netCarbs += item.macros.netCarbs;
      acc.protein += item.macros.protein;
      acc.fat += item.macros.fat;
      return acc;
    },
    { netCarbs: 0, protein: 0, fat: 0 }
  );

  return (
    <View style={styles.mealCard}>
      <View style={styles.mealHeader}>
        <Text style={styles.mealTitle}>🍽️ ארוחה {index + 1}</Text>
        <Text style={styles.mealTime}>🕒 {meal.createdAt}</Text>
      </View>
      
      {meal.photoUri && <Image source={{ uri: meal.photoUri }} style={styles.mealImage} />}

      {/* ⚠️ התראת פחמימות חבויות במידה וקיימת */}
      {meal.hiddenCarbsAlert && (
        <View style={styles.alertContainer}>
          <Text style={styles.alertText}>⚠️ חשד לפחמימות חבויות: {meal.hiddenCarbsAlert}</Text>
        </View>
      )}

      {/* רשימת הרכיבים - תצוגה או עריכה */}
      <View style={styles.itemsContainer}>
        {editableItems.map((item) => (
          <View key={item.id} style={styles.foodItemRow}>
            {meal.isLocked ? (
              // מצב נעול קבוע
              <Text style={styles.foodName}>• {item.name} ({item.grams}ג׳)</Text>
            ) : (
              // מצב עריכה חד פעמי לפני אישור
              <View style={styles.editRow}>
                <Text style={styles.foodName}>• {item.name}</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.gramsInput}
                    keyboardType="numeric"
                    defaultValue={item.grams.toString()}
                    onChangeText={(text) => handleGramsChange(item.id, text)}
                  />
                  <Text style={styles.inputUnit}>ג׳</Text>
                </View>
              </View>
            )}
            {item.isAnimalSource && <Text style={styles.animalBadge}>🥩 מן החי</Text>}
          </View>
        ))}
      </View>

      {/* סיכום ארוחה */}
      <View style={styles.cardMacroSummary}>
        <Text style={styles.cardMacroText}>פחמימות: {totalMacros.netCarbs.toFixed(1)}ג׳</Text>
        <Text style={styles.cardMacroText}>חלבון: {totalMacros.protein.toFixed(1)}ג׳</Text>
        <Text style={styles.cardMacroText}>שומן: {totalMacros.fat.toFixed(1)}ג׳</Text>
      </View>

      {/* כפתור נעילה יישמר רק אם הארוחה היא טיוטה */}
      {!meal.isLocked && (
        <TouchableOpacity style={styles.lockButton} onPress={handleConfirmAndLock}>
          <Text style={styles.lockButtonText}>🔒 אשר ונעץ ערכים ביומן</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mealCard: { backgroundColor: '#FFF', borderRadius: 24, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.03, shadowRadius: 20, elevation: 3 },
  mealHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  mealTitle: { fontSize: 18, fontWeight: '700', color: '#1A1D1E' },
  mealTime: { fontSize: 14, fontWeight: '600', color: '#2E7D32', backgroundColor: '#E8F5E9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  mealImage: { width: '100%', height: 200, borderRadius: 18, marginBottom: 15, resizeMode: 'cover' },
  alertContainer: { backgroundColor: '#FFF9C4', padding: 12, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#FFF59D' },
  alertText: { color: '#F57F17', fontSize: 13, fontWeight: '700', textAlign: 'right' },
  itemsContainer: { marginBottom: 15, paddingHorizontal: 5 },
  foodItemRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginVertical: 6 },
  editRow: { flexDirection: 'row-reverse', alignItems: 'center', flex: 1, justifyContent: 'space-between' },
  foodName: { fontSize: 15, color: '#424242', fontWeight: '500' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F7F9FC', borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 6, marginLeft: 10 },
  gramsInput: { width: 50, height: 32, textAlign: 'center', fontWeight: '700', color: '#1A1D1E', padding: 0 },
  inputUnit: { fontSize: 12, color: '#A0AEC0', marginRight: 2 },
  animalBadge: { fontSize: 11, backgroundColor: '#ffebee', color: '#c62828', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, fontWeight: '600', overflow: 'hidden' },
  cardMacroSummary: { flexDirection: 'row-reverse', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingTop: 10, marginTop: 5 },
  cardMacroText: { fontSize: 12, color: '#718096', fontWeight: '600' },
  lockButton: { backgroundColor: '#1A1D1E', paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginTop: 15 },
  lockButtonText: { color: '#FFF', fontWeight: '700', fontSize: 14 }
});
import React, { useState, useEffect, useCallback } from 'react';
import {
  Flame,
  Dumbbell,
  Plus,
  Search,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Trash2,
  Sparkles,
  Utensils,
  Database,
  ShieldCheck,
} from 'lucide-react';
import { Food, FoodEntry, DailyNutrition, MealType } from '../types.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { getTodayDateString, formatDateReadable } from '../lib/utils.ts';
import { AddFoodModal } from '../components/AddFoodModal.tsx';
import { ConfirmModal } from '../components/ConfirmModal.tsx';
import { BodyWeightSection } from '../components/BodyWeightSection.tsx';
import { AdminAccessPrompt } from '../components/AdminAccessPrompt.tsx';

const CATEGORIES = ['All', 'Poultry', 'Dairy', 'Grains', 'Eggs', 'Fish', 'Vegan', 'Fruits', 'Legumes'];

export function DietPage() {
  const { user, getAuthHeaders } = useAuth();
  const toast = useToast();

  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  const [nutrition, setNutrition] = useState<DailyNutrition | null>(null);
  const [foodEntries, setFoodEntries] = useState<FoodEntry[]>([]);
  const [dbFoods, setDbFoods] = useState<Food[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchFoodQuery, setSearchFoodQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<FoodEntry | null>(null);
  const [activeMealType, setActiveMealType] = useState<MealType>('Breakfast');
  const [deleteEntry, setDeleteEntry] = useState<FoodEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadDietData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/diet/day/${selectedDate}`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setNutrition(data.nutrition);
        setFoodEntries(data.entries || []);
      }
    } catch (err) {
      console.error('Failed to load diet data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, getAuthHeaders]);

  const loadFoodsCatalog = useCallback(async () => {
    try {
      const res = await fetch('/api/foods');
      if (res.ok) {
        const data = await res.json();
        setDbFoods(data);
      }
    } catch (err) {
      console.error('Failed to load foods:', err);
    }
  }, []);

  useEffect(() => {
    loadDietData();
  }, [loadDietData]);

  useEffect(() => {
    loadFoodsCatalog();
  }, [loadFoodsCatalog]);

  const changeDateBy = (days: number) => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() + days);
    const ny = dateObj.getFullYear();
    const nm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const nd = String(dateObj.getDate()).padStart(2, '0');
    setSelectedDate(`${ny}-${nm}-${nd}`);
  };

  const handleDeleteEntry = async () => {
    if (!deleteEntry) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/diet/${deleteEntry.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        toast.success(`Removed ${deleteEntry.foodName}.`);
        loadDietData();
      } else {
        toast.error('Failed to delete item.');
      }
    } catch (err) {
      toast.error('Network error while deleting.');
    } finally {
      setIsDeleting(false);
      setDeleteEntry(null);
    }
  };

  // Quick log a catalog food item directly into current meal
  const handleQuickAddFood = async (food: Food, meal: MealType) => {
    try {
      const payload = {
        date: selectedDate,
        foodId: food.id,
        foodName: food.name,
        mealType: meal,
        quantity: Number(food.servingSize),
        unit: food.servingUnit,
        calories: Number(food.calories),
        protein: Number(food.protein),
        notes: `Quick added (${food.category})`,
      };

      const res = await fetch('/api/diet', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(`Added ${food.name} to ${meal}!`);
        loadDietData();
      } else {
        toast.error('Failed to log food.');
      }
    } catch (e) {
      toast.error('Network error adding food.');
    }
  };

  // Targets and Totals
  const totalCalories = nutrition ? Number(nutrition.totalCalories) : 0;
  const targetCalories = nutrition ? Number(nutrition.targetCalories) : user?.dailyCalories || 2200;
  const totalProtein = nutrition ? Number(nutrition.totalProtein) : 0;
  const targetProtein = nutrition ? Number(nutrition.targetProtein) : user?.dailyProtein || 120;

  const calPct = Math.min(100, Math.round((totalCalories / (targetCalories || 1)) * 100));
  const proPct = Math.min(100, Math.round((totalProtein / (targetProtein || 1)) * 100));

  const meals: { type: MealType; label: string; icon: string }[] = [
    { type: 'Breakfast', label: 'Breakfast', icon: '🍳' },
    { type: 'Lunch', label: 'Lunch', icon: '🍗' },
    { type: 'Dinner', label: 'Dinner', icon: '🍽' },
    { type: 'Snack', label: 'Snacks & Supplements', icon: '🍎' },
  ];

  // Filter foods for catalog browser
  const filteredCatalog = dbFoods.filter((f) => {
    const matchesCat = selectedCategory === 'All' || f.category.toLowerCase() === selectedCategory.toLowerCase();
    const matchesSearch = f.name.toLowerCase().includes(searchFoodQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Admin Access Permission Prompt */}
      <AdminAccessPrompt />

      {/* Top Header & Date Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Diet & Nutrition Tracker
            </h1>
            <span className="p-1 px-2 rounded-lg bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
              {formatDateReadable(selectedDate)}
            </span>
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-semibold border border-emerald-200/80 dark:border-emerald-800/60"
              title="All meals and macros are saved permanently in the dedicated database and linked to your Gmail login."
            >
              <Database className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Permanent DB Vault Active</span>
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Log your daily nutrition intake — all entries are permanently preserved under your Gmail account with zero data loss.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => changeDateBy(-1)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 px-2 cursor-pointer focus:outline-none"
            />
            <button
              onClick={() => changeDateBy(1)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => {
              setEditEntry(null);
              setActiveMealType('Breakfast');
              setIsModalOpen(true);
            }}
            className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Log Food
          </button>
        </div>
      </div>

      {/* Daily Progress Goal Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Calories Card */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">Daily Calorie Target</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
                    {totalCalories}
                  </span>
                  <span className="text-xs text-slate-400">/ {targetCalories} kcal</span>
                </div>
              </div>
            </div>
            <span className="text-sm font-black text-amber-600 dark:text-amber-400">{calPct}%</span>
          </div>

          <div className="mt-4 w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                calPct > 105 ? 'bg-rose-500' : 'bg-gradient-to-r from-amber-500 to-orange-500'
              }`}
              style={{ width: `${calPct}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500 flex justify-between">
            <span>Remaining today:</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {targetCalories - totalCalories > 0
                ? `${targetCalories - totalCalories} kcal`
                : 'Target achieved! 🔥'}
            </span>
          </p>
        </div>

        {/* Protein Card */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                <Dumbbell className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">Daily Protein Target</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    {totalProtein}g
                  </span>
                  <span className="text-xs text-slate-400">/ {targetProtein} g</span>
                </div>
              </div>
            </div>
            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{proPct}%</span>
          </div>

          <div className="mt-4 w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${proPct}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500 flex justify-between">
            <span>Remaining today:</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {targetProtein - totalProtein > 0
                ? `${(targetProtein - totalProtein).toFixed(1)}g`
                : 'Muscle goal achieved! 💪'}
            </span>
          </p>
        </div>
      </div>

      {/* Body Weight Section */}
      <BodyWeightSection selectedDate={selectedDate} onWeightUpdated={loadDietData} />

      {/* Split View: Meals on Left, Database Catalog on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Logged Meals List (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Logged Meals</h2>

          {meals.map((m) => {
            const items = foodEntries.filter((f) => f.mealType === m.type);
            const mealCalories = items.reduce((acc, curr) => acc + Number(curr.calories), 0);
            const mealProtein = items.reduce((acc, curr) => acc + Number(curr.protein), 0);

            return (
              <div
                key={m.type}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-2xs"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{m.icon}</span>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">{m.label}</h3>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-xs">
                      <span className="font-bold text-amber-600 dark:text-amber-400">
                        {mealCalories} kcal
                      </span>
                      <span className="mx-1 text-slate-300 dark:text-slate-700">·</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {mealProtein.toFixed(1)}g P
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        setEditEntry(null);
                        setActiveMealType(m.type);
                        setIsModalOpen(true);
                      }}
                      className="p-1 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-emerald-50 dark:hover:bg-slate-800"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {items.length === 0 ? (
                  <p className="text-xs text-slate-400 py-3 text-center italic">
                    Nothing logged for {m.label.toLowerCase()} yet.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="py-2.5 flex items-center justify-between gap-3 group"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            {item.foodName}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {item.quantity} {item.unit}
                            {item.notes ? ` · ${item.notes}` : ''}
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                              {item.calories} kcal
                            </span>
                            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold ml-2">
                              {item.protein}g
                            </span>
                          </div>

                          <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100">
                            <button
                              onClick={() => {
                                setEditEntry(item);
                                setIsModalOpen(true);
                              }}
                              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteEntry(item)}
                              className="p-1 text-slate-400 hover:text-rose-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Right Column: Quick Food Catalog Browser (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600" /> Quick Add From Catalog
            </h2>
            <span className="text-xs text-slate-400">{filteredCatalog.length} foods</span>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-2xs space-y-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchFoodQuery}
                onChange={(e) => setSearchFoodQuery(e.target.value)}
                placeholder="Search food catalog..."
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
                    selectedCategory === cat
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Catalog Food List */}
            <div className="max-h-[500px] overflow-y-auto space-y-2 pr-1">
              {filteredCatalog.map((food) => (
                <div
                  key={food.id}
                  className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700/60 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between transition-colors"
                >
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">{food.name}</p>
                    <p className="text-[10px] text-slate-500">
                      {food.servingSize} {food.servingUnit} ·{' '}
                      <span className="text-amber-600 dark:text-amber-400 font-semibold">
                        {food.calories} kcal
                      </span>{' '}
                      ·{' '}
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                        {food.protein}g protein
                      </span>
                    </p>
                  </div>

                  {/* 1-Click Add Dropdown / Buttons */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleQuickAddFood(food, 'Breakfast')}
                      title="Add to Breakfast"
                      className="p-1 px-1.5 text-[10px] font-bold rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-emerald-50 text-slate-700 dark:text-slate-300 hover:text-emerald-700"
                    >
                      🍳
                    </button>
                    <button
                      onClick={() => handleQuickAddFood(food, 'Lunch')}
                      title="Add to Lunch"
                      className="p-1 px-1.5 text-[10px] font-bold rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-emerald-50 text-slate-700 dark:text-slate-300 hover:text-emerald-700"
                    >
                      🍗
                    </button>
                    <button
                      onClick={() => handleQuickAddFood(food, 'Dinner')}
                      title="Add to Dinner"
                      className="p-1 px-1.5 text-[10px] font-bold rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-emerald-50 text-slate-700 dark:text-slate-300 hover:text-emerald-700"
                    >
                      🍽
                    </button>
                    <button
                      onClick={() => handleQuickAddFood(food, 'Snack')}
                      title="Add to Snacks"
                      className="p-1 px-1.5 text-[10px] font-bold rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-emerald-50 text-slate-700 dark:text-slate-300 hover:text-emerald-700"
                    >
                      🍎
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AddFoodModal
        isOpen={isModalOpen}
        selectedDate={selectedDate}
        editEntry={editEntry}
        defaultMeal={activeMealType}
        onClose={() => setIsModalOpen(false)}
        onSuccess={loadDietData}
      />

      <ConfirmModal
        isOpen={deleteEntry !== null}
        title="Remove Food Entry"
        message={`Remove "${deleteEntry?.foodName}" from ${deleteEntry?.mealType}? Daily calories and protein will recalculate automatically.`}
        confirmLabel="Remove Food"
        isDanger={true}
        isLoading={isDeleting}
        onConfirm={handleDeleteEntry}
        onCancel={() => setDeleteEntry(null)}
      />
    </div>
  );
}

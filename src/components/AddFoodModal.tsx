import React, { useState, useEffect } from 'react';
import { X, Search, Sparkles, Plus, Check, Keyboard } from 'lucide-react';
import { Food, FoodEntry, MealType, FoodUnit } from '../types.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';

interface AddFoodModalProps {
  isOpen: boolean;
  selectedDate: string;
  editEntry?: FoodEntry | null;
  defaultMeal?: MealType;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddFoodModal({
  isOpen,
  selectedDate,
  editEntry,
  defaultMeal = 'Breakfast',
  onClose,
  onSuccess,
}: AddFoodModalProps) {
  const { getAuthHeaders } = useAuth();
  const toast = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Food[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedDbFood, setSelectedDbFood] = useState<Food | null>(null);

  const [date, setDate] = useState(selectedDate);
  const [foodName, setFoodName] = useState('');
  const [mealType, setMealType] = useState<MealType>(defaultMeal);
  const [quantityInput, setQuantityInput] = useState('100');
  const [unit, setUnit] = useState<FoodUnit>('grams');
  const [caloriesInput, setCaloriesInput] = useState('');
  const [proteinInput, setProteinInput] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form when opening or changing editEntry
  useEffect(() => {
    if (editEntry) {
      setDate(editEntry.date);
      setFoodName(editEntry.foodName);
      setMealType(editEntry.mealType);
      setQuantityInput(String(editEntry.quantity));
      setUnit(editEntry.unit);
      setCaloriesInput(String(editEntry.calories));
      setProteinInput(String(editEntry.protein));
      setNotes(editEntry.notes || '');
      setSelectedDbFood(null);
    } else {
      setDate(selectedDate);
      setFoodName('');
      setMealType(defaultMeal);
      setQuantityInput('100');
      setUnit('grams');
      setCaloriesInput('');
      setProteinInput('');
      setNotes('');
      setSelectedDbFood(null);
      setSearchQuery('');
      setSearchResults([]);
    }
  }, [editEntry, isOpen, selectedDate, defaultMeal]);

  // Handle food search debouncing
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/foods?search=${encodeURIComponent(searchQuery.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
        }
      } catch (err) {
        console.error('Failed to search foods:', err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // When a food item from DB is chosen
  const handleSelectFood = (food: Food) => {
    setSelectedDbFood(food);
    setFoodName(food.name);
    setUnit(food.servingUnit);
    setQuantityInput(String(food.servingSize));
    setCaloriesInput(String(food.calories));
    setProteinInput(String(food.protein));
    setSearchQuery('');
    setSearchResults([]);
  };

  // Re-calculate calories & protein based on base food ratio when quantity changes
  const handleQuantityInputChange = (val: string) => {
    // Only allow positive numbers and single decimal
    const sanitized = val.replace(/[^0-9.]/g, '');
    if ((sanitized.match(/\./g) || []).length > 1) return;
    setQuantityInput(sanitized);

    const newQty = parseFloat(sanitized);
    if (!isNaN(newQty) && newQty > 0 && selectedDbFood && selectedDbFood.servingSize > 0) {
      const ratio = newQty / selectedDbFood.servingSize;
      setCaloriesInput(String(Math.round(selectedDbFood.calories * ratio)));
      setProteinInput(String(Number((selectedDbFood.protein * ratio).toFixed(1))));
    }
  };

  const handleCaloriesInputChange = (val: string) => {
    // Strictly numeric for keyboard entry
    const sanitized = val.replace(/[^0-9]/g, '');
    setCaloriesInput(sanitized);
    setSelectedDbFood(null);
  };

  const handleProteinInputChange = (val: string) => {
    // Numbers and optional decimal
    const sanitized = val.replace(/[^0-9.]/g, '');
    if ((sanitized.match(/\./g) || []).length > 1) return;
    setProteinInput(sanitized);
    setSelectedDbFood(null);
  };

  const adjustCalories = (delta: number) => {
    const current = parseInt(caloriesInput, 10) || 0;
    const nextVal = Math.max(0, current + delta);
    setCaloriesInput(String(nextVal));
    setSelectedDbFood(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!foodName.trim()) {
      toast.error('Food name is required.');
      return;
    }

    const qty = parseFloat(quantityInput);
    if (isNaN(qty) || qty <= 0) {
      toast.error('Please enter a valid quantity greater than 0.');
      return;
    }

    const cal = caloriesInput === '' ? 0 : parseInt(caloriesInput, 10);
    if (isNaN(cal) || cal < 0) {
      toast.error('Please enter a valid number of calories.');
      return;
    }

    const prot = proteinInput === '' ? 0 : parseFloat(proteinInput);
    if (isNaN(prot) || prot < 0) {
      toast.error('Please enter a valid protein amount.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        date,
        foodId: selectedDbFood ? selectedDbFood.id : null,
        foodName: foodName.trim(),
        mealType,
        quantity: qty,
        unit,
        calories: cal,
        protein: prot,
        notes: notes.trim(),
      };

      const url = editEntry ? `/api/diet/${editEntry.id}` : '/api/diet';
      const method = editEntry ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to save food entry.');
        return;
      }

      toast.success(editEntry ? 'Food entry updated!' : 'Food added to your diet log!');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error('Failed to save food. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 my-8">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {editEntry ? 'Edit Food Entry' : 'Log Food Intake'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Track calories & protein to maintain your nutrition goals
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Food Search Autocomplete (Only if creating new or replacing) */}
        {!editEntry && (
          <div className="mt-4 relative">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Quick Search Food Database</span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-normal">
                Auto-calculates nutrition
              </span>
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g. Chicken, Rice, Egg, Banana, Oats..."
                className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              />
              {isSearching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* Search Dropdown Results */}
            {searchResults.length > 0 && (
              <div className="absolute z-20 left-0 right-0 mt-1.5 max-h-56 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1">
                {searchResults.map((food) => (
                  <button
                    key={food.id}
                    type="button"
                    onClick={() => handleSelectFood(food)}
                    className="w-full text-left px-3.5 py-2 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 flex items-center justify-between transition-colors border-b border-slate-100 dark:border-slate-700/50 last:border-0"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{food.name}</p>
                      <p className="text-[11px] text-slate-500">
                        Serving: {food.servingSize} {food.servingUnit}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                        {food.calories} kcal
                      </span>
                      <span className="mx-1 text-slate-400">·</span>
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        {food.protein}g protein
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Selected DB food indicator badge */}
        {selectedDbFood && (
          <div className="mt-2.5 p-2 bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                Using <strong>{selectedDbFood.name}</strong> base formula ({selectedDbFood.servingSize}
                {selectedDbFood.servingUnit} = {selectedDbFood.calories}kcal, {selectedDbFood.protein}g protein)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedDbFood(null)}
              className="text-[11px] underline hover:text-emerald-900"
            >
              Manual
            </button>
          </div>
        )}

        {/* Form Fields */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          {/* Date & Meal Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Meal</label>
              <select
                value={mealType}
                onChange={(e) => setMealType(e.target.value as MealType)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              >
                <option value="Breakfast">🍳 Breakfast</option>
                <option value="Lunch">🍗 Lunch</option>
                <option value="Dinner">🍽 Dinner</option>
                <option value="Snack">🍎 Snacks</option>
              </select>
            </div>
          </div>

          {/* Food Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Food Item Name
            </label>
            <input
              type="text"
              value={foodName}
              onChange={(e) => {
                setFoodName(e.target.value);
                if (selectedDbFood && e.target.value !== selectedDbFood.name) {
                  setSelectedDbFood(null);
                }
              }}
              placeholder="e.g. Chicken Breast, Boiled Egg, Brown Rice"
              required
              className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>

          {/* Quantity & Unit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Quantity
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={quantityInput}
                onChange={(e) => handleQuantityInputChange(e.target.value)}
                placeholder="e.g. 100"
                required
                className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Unit</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as FoodUnit)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              >
                <option value="grams">grams</option>
                <option value="ml">ml</option>
                <option value="pieces">pieces</option>
                <option value="serving">serving</option>
                <option value="cup">cup</option>
                <option value="tablespoon">tablespoon</option>
                <option value="teaspoon">teaspoon</option>
              </select>
            </div>
          </div>

          {/* Calories & Protein - Clean Keyboard-First Inputs */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1 flex items-center justify-between">
                  <span>🔥 Calories (kcal)</span>
                  <span className="text-[10px] text-slate-400 font-normal flex items-center gap-0.5">
                    <Keyboard className="w-3 h-3" /> Keyboard
                  </span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={caloriesInput}
                  onChange={(e) => handleCaloriesInputChange(e.target.value)}
                  placeholder="e.g. 250"
                  required
                  className="w-full px-3.5 py-2.5 text-base bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40 font-bold tracking-wide"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-1 flex items-center justify-between">
                  <span>💪 Protein (g)</span>
                  <span className="text-[10px] text-slate-400 font-normal flex items-center gap-0.5">
                    <Keyboard className="w-3 h-3" /> Keyboard
                  </span>
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={proteinInput}
                  onChange={(e) => handleProteinInputChange(e.target.value)}
                  placeholder="e.g. 24.5"
                  required
                  className="w-full px-3.5 py-2.5 text-base bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40 font-bold tracking-wide"
                />
              </div>
            </div>

            {/* Quick Calorie Nudge Chips */}
            <div className="flex items-center gap-1.5 pt-1 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="text-[10px] uppercase font-semibold text-slate-400">Quick add:</span>
              <button
                type="button"
                onClick={() => adjustCalories(50)}
                className="px-2 py-0.5 rounded-lg bg-amber-100/70 hover:bg-amber-200/80 dark:bg-amber-950/60 dark:hover:bg-amber-900/80 text-amber-800 dark:text-amber-300 font-semibold transition-colors"
              >
                +50 kcal
              </button>
              <button
                type="button"
                onClick={() => adjustCalories(100)}
                className="px-2 py-0.5 rounded-lg bg-amber-100/70 hover:bg-amber-200/80 dark:bg-amber-950/60 dark:hover:bg-amber-900/80 text-amber-800 dark:text-amber-300 font-semibold transition-colors"
              >
                +100 kcal
              </button>
              <button
                type="button"
                onClick={() => adjustCalories(250)}
                className="px-2 py-0.5 rounded-lg bg-amber-100/70 hover:bg-amber-200/80 dark:bg-amber-950/60 dark:hover:bg-amber-900/80 text-amber-800 dark:text-amber-300 font-semibold transition-colors"
              >
                +250 kcal
              </button>
              <button
                type="button"
                onClick={() => setCaloriesInput('')}
                className="ml-auto text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Cooked in olive oil, no sugar added"
              className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>

          {/* Buttons */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-600/20 disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              {isSubmitting ? 'Saving...' : editEntry ? 'Update Food' : 'Add Food'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

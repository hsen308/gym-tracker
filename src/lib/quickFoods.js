// Variable-portion foods the user logs repeatedly. Each entry defines per-unit
// macros so a stepper can scale them without a keyboard. The values are
// approximate averages — close enough for a cut where the trend matters more
// than any single reading.
//
// `unit` is what the stepper increments: "egg", "g", "piece".
// `step` is the default increment; `longPressStep` for fast adjustment.
// `perUnit` is macros for ONE unit (1 egg, 1g, 1 piece).

export const QUICK_FOODS = [
  {
    id: 'boiled_egg_large',
    name: 'Boiled egg (large)',
    category: 'protein',
    unit: 'egg',
    step: 1,
    longPressStep: 2,
    perUnit: { calories: 78, protein_g: 6.3, carbs_g: 0.6, fat_g: 5.3 },
    note: '~50g each',
  },
  {
    id: 'boiled_egg_medium',
    name: 'Boiled egg (medium)',
    category: 'protein',
    unit: 'egg',
    step: 1,
    longPressStep: 2,
    perUnit: { calories: 68, protein_g: 5.5, carbs_g: 0.5, fat_g: 4.6 },
    note: '~44g each',
  },
  {
    id: 'boiled_egg_small',
    name: 'Boiled egg (small)',
    category: 'protein',
    unit: 'egg',
    step: 1,
    longPressStep: 2,
    perUnit: { calories: 58, protein_g: 4.7, carbs_g: 0.4, fat_g: 3.9 },
    note: '~38g each',
  },
  {
    id: 'lebanese_pita',
    name: 'Lebanese pita bread',
    category: 'carbs',
    unit: 'g',
    step: 10,
    longPressStep: 30,
    perUnit: { calories: 2.75, protein_g: 0.09, carbs_g: 0.52, fat_g: 0.02 },
    note: '275 kcal per 100g',
  },
  {
    id: 'white_rice',
    name: 'White rice (cooked)',
    category: 'carbs',
    unit: 'g',
    step: 50,
    longPressStep: 100,
    perUnit: { calories: 1.3, protein_g: 0.027, carbs_g: 0.28, fat_g: 0.003 },
    note: '130 kcal per 100g cooked',
  },
  {
    id: 'marinated_chicken',
    name: 'Marinated chicken breast (pan-seared)',
    category: 'protein',
    unit: 'g',
    step: 25,
    longPressStep: 50,
    perUnit: { calories: 1.65, protein_g: 0.31, carbs_g: 0, fat_g: 0.036 },
    note: '165 kcal per 100g, touch of oil',
  },
  {
    id: 'pasta_cooked',
    name: 'Pasta (cooked)',
    category: 'carbs',
    unit: 'g',
    step: 50,
    longPressStep: 100,
    perUnit: { calories: 1.31, protein_g: 0.05, carbs_g: 0.25, fat_g: 0.011 },
    note: '131 kcal per 100g cooked',
  },
  {
    id: 'mjaddara',
    name: 'Mjaddara (lentils & rice)',
    category: 'carbs',
    unit: 'g',
    step: 50,
    longPressStep: 100,
    perUnit: { calories: 1.7, protein_g: 0.07, carbs_g: 0.28, fat_g: 0.04 },
    note: '~170 kcal per 100g, 2:1 lentils:rice',
  },
]

// Fruits — fixed portions, no stepper needed. These go straight into the
// preset list like the programme meals, but in their own section.
export const FRUIT_PRESETS = [
  { name: 'Apple', calories: 95, protein_g: 0.5, carbs_g: 25, fat_g: 0.3 },
  { name: 'Banana', calories: 105, protein_g: 1.3, carbs_g: 27, fat_g: 0.4 },
  { name: 'Orange', calories: 62, protein_g: 1.2, carbs_g: 15, fat_g: 0.2 },
  { name: 'Mango', calories: 99, protein_g: 1.4, carbs_g: 25, fat_g: 0.6 },
  { name: 'Grapes (1 cup)', calories: 104, protein_g: 1.1, carbs_g: 27, fat_g: 0.2 },
  { name: 'Strawberries (1 cup)', calories: 49, protein_g: 1, carbs_g: 12, fat_g: 0.5 },
  { name: 'Watermelon (1 cup)', calories: 46, protein_g: 0.9, carbs_g: 12, fat_g: 0.2 },
  { name: 'Dates (3 pieces)', calories: 200, protein_g: 1.8, carbs_g: 54, fat_g: 0.3 },
]

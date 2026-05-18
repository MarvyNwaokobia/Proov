export type TemplateLayout =
  | 'grid' | 'color-rows' | 'earthy' | 'category-groups'
  | 'dot-grid' | 'list' | 'streak-focus' | 'journal';

export type Archetype = 'builder' | 'achiever' | 'creative' | 'nurturer';

export interface TemplateHabit {
  name: string;
  emoji: string;
  category: string;
  duration: number; // minutes, 0 = no timer
}

export interface HabitTemplate {
  id: string;
  archetype: Archetype;
  name: string;
  description: string;
  emoji: string;
  audience: string;
  layout: TemplateLayout;
  habits: TemplateHabit[];
  extras?: string[];
}

export const ARCHETYPE_LABELS: Record<Archetype, string> = {
  builder:  'The Builder',
  achiever: 'The Achiever',
  creative: 'The Creative',
  nurturer: 'The Nurturer',
};

export const HABIT_TEMPLATES: HabitTemplate[] = [
  // ── THE BUILDER ────────────────────────────────────────────────────────────
  {
    id: 'clean-grid', archetype: 'builder', emoji: '📊',
    name: 'Clean Grid', layout: 'grid',
    description: 'Minimal, organized. For focused professionals who want clarity.',
    audience: 'Professional · Organized · Clean',
    habits: [
      { name: 'Deep Work',      emoji: '🧠', category: 'focus',    duration: 90 },
      { name: 'Read 20 Pages',  emoji: '📖', category: 'learning', duration: 20 },
      { name: 'Exercise',       emoji: '💪', category: 'fitness',  duration: 30 },
      { name: 'Plan Tomorrow',  emoji: '📋', category: 'focus',    duration: 10 },
    ],
  },
  {
    id: 'command-line', archetype: 'builder', emoji: '⌨️',
    name: 'Command Line', layout: 'list',
    description: 'Stark, data-forward. Streaks as stats. For developers and data people.',
    audience: 'Developer · Analytical · Minimal',
    habits: [
      { name: 'Code 2 hours',    emoji: '💻', category: 'focus',    duration: 120 },
      { name: 'Ship one thing',  emoji: '🚀', category: 'focus',    duration: 0   },
      { name: 'Read docs/learn', emoji: '📚', category: 'learning', duration: 30  },
      { name: 'Walk/move',       emoji: '🚶', category: 'fitness',  duration: 20  },
    ],
  },
  {
    id: 'minimal-pro', archetype: 'builder', emoji: '🗒️',
    name: 'Minimal Pro', layout: 'list',
    description: 'Clean rows, circle checkmarks. Inspired by paper planners.',
    audience: 'Executive · Planner · Classic',
    habits: [
      { name: 'Morning review', emoji: '☀️', category: 'focus',    duration: 15 },
      { name: 'Priority task',  emoji: '🎯', category: 'focus',    duration: 90 },
      { name: 'Exercise',       emoji: '🏃', category: 'fitness',  duration: 30 },
      { name: 'Evening journal',emoji: '✍️', category: 'creative', duration: 10 },
    ],
  },

  // ── THE ACHIEVER ───────────────────────────────────────────────────────────
  {
    id: 'bold-sport', archetype: 'achiever', emoji: '🏆',
    name: 'Bold Sport', layout: 'dot-grid',
    description: 'Big numbers, bold dots. Inspired by training logs. Win the day.',
    audience: 'Athlete · Competitive · High energy',
    habits: [
      { name: 'Morning workout', emoji: '🏋️', category: 'fitness',  duration: 45 },
      { name: 'Run/cardio',      emoji: '🏃', category: 'fitness',  duration: 30 },
      { name: 'Protein hit',     emoji: '🥩', category: 'nutrition',duration: 0  },
      { name: 'Stretch/recovery',emoji: '🧘', category: 'wellness', duration: 15 },
    ],
  },
  {
    id: 'power-stack', archetype: 'achiever', emoji: '⚡',
    name: 'Power Stack', layout: 'color-rows',
    description: 'Stacked colour rows. Visual progress. Every colour is a win.',
    audience: 'Motivated · Visual · Progress-driven',
    habits: [
      { name: 'Wake up early',       emoji: '⏰', category: 'wellness', duration: 0  },
      { name: 'Workout',             emoji: '💪', category: 'fitness',  duration: 60 },
      { name: 'Cold shower',         emoji: '🚿', category: 'wellness', duration: 0  },
      { name: 'No social media AM',  emoji: '📵', category: 'wellness', duration: 0  },
      { name: 'Read',                emoji: '📖', category: 'learning', duration: 20 },
    ],
  },
  {
    id: 'fire-mode', archetype: 'achiever', emoji: '🔥',
    name: 'Fire Mode', layout: 'streak-focus',
    description: 'Dark, intense, streak-focused. For people who do not miss.',
    audience: 'Streak obsessed · Discipline · Grind',
    habits: [
      { name: 'Morning non-negotiable', emoji: '🔥', category: 'fitness', duration: 30  },
      { name: 'Deep focus block',       emoji: '🧠', category: 'focus',   duration: 120 },
      { name: 'No excuses workout',     emoji: '💪', category: 'fitness', duration: 45  },
      { name: 'Night review',           emoji: '🌙', category: 'focus',   duration: 10  },
    ],
  },

  // ── THE CREATIVE ───────────────────────────────────────────────────────────
  {
    id: 'earthy-organic', archetype: 'creative', emoji: '🌿',
    name: 'Earthy Organic', layout: 'earthy',
    description: 'Warm tones, water tracking, mood check. Gentle and grounding.',
    audience: 'Nature-loving · Warm · Intentional',
    habits: [
      { name: 'Water (8 glasses)', emoji: '💧', category: 'nutrition', duration: 0  },
      { name: 'Morning walk',      emoji: '🌄', category: 'fitness',   duration: 20 },
      { name: 'Journal',           emoji: '✍️', category: 'creative',  duration: 15 },
      { name: 'Mood check',        emoji: '😊', category: 'wellness',  duration: 0  },
    ],
    extras: ['water_tracker', 'mood_selector'],
  },
  {
    id: 'colour-story', archetype: 'creative', emoji: '🎨',
    name: 'Colour Story', layout: 'color-rows',
    description: 'Each habit gets its own colour. Your week becomes a painting.',
    audience: 'Visual · Playful · Colourful',
    habits: [
      { name: 'Create something',     emoji: '🎨', category: 'creative', duration: 30 },
      { name: 'Read',                 emoji: '📚', category: 'learning', duration: 20 },
      { name: 'Move your body',       emoji: '💃', category: 'fitness',  duration: 20 },
      { name: 'Connect with someone', emoji: '💬', category: 'wellness', duration: 0  },
    ],
  },
  {
    id: 'bloom-journal', archetype: 'creative', emoji: '🌸',
    name: 'Bloom Journal', layout: 'journal',
    description: 'Soft, personal. A daily journal of how you showed up.',
    audience: 'Reflective · Personal · Mindful',
    habits: [
      { name: 'Morning pages',     emoji: '📝', category: 'creative', duration: 15 },
      { name: 'Gratitude',         emoji: '🙏', category: 'wellness', duration: 0  },
      { name: 'Self-care ritual',  emoji: '✨', category: 'wellness', duration: 20 },
      { name: 'Evening reflection',emoji: '🌙', category: 'creative', duration: 10 },
    ],
  },

  // ── THE NURTURER ───────────────────────────────────────────────────────────
  {
    id: 'soft-wellness', archetype: 'nurturer', emoji: '🌱',
    name: 'Soft Wellness', layout: 'category-groups',
    description: 'Gentle, kind tracking. For people building health without pressure.',
    audience: 'Wellness-focused · Gentle · Self-compassion',
    habits: [
      { name: 'Hydration', emoji: '💧', category: 'nutrition', duration: 0  },
      { name: 'Vitamins',  emoji: '💊', category: 'wellness',  duration: 0  },
      { name: 'Stretch',   emoji: '🤸', category: 'fitness',   duration: 10 },
      { name: 'Sleep by 11',emoji: '😴',category: 'wellness',  duration: 0  },
    ],
  },
  {
    id: 'mood-tracker', archetype: 'nurturer', emoji: '😊',
    name: 'Mood Tracker', layout: 'earthy',
    description: 'Track how you feel alongside what you do. Patterns reveal themselves.',
    audience: 'Mental health aware · Curious · Empathetic',
    habits: [
      { name: 'Daily mood log', emoji: '😊', category: 'wellness', duration: 0  },
      { name: 'Meditate',       emoji: '🧘', category: 'wellness', duration: 10 },
      { name: 'Move/walk',      emoji: '🚶', category: 'fitness',  duration: 20 },
      { name: 'Connect',        emoji: '💬', category: 'wellness', duration: 0  },
    ],
    extras: ['mood_selector'],
  },
  {
    id: 'daily-ritual', archetype: 'nurturer', emoji: '☀️',
    name: 'Daily Ritual', layout: 'category-groups',
    description: 'Category-grouped habits for a balanced, whole-self routine.',
    audience: 'Balanced · Holistic · Grounded',
    habits: [
      { name: 'Workout',      emoji: '💪', category: 'fitness',   duration: 30 },
      { name: 'Healthy meal', emoji: '🥗', category: 'nutrition', duration: 0  },
      { name: 'Journal',      emoji: '✍️', category: 'creative',  duration: 10 },
      { name: 'Sleep 7-8hrs', emoji: '😴', category: 'wellness',  duration: 0  },
    ],
  },
];

export const RATING_OPTIONS = [
  { label: 'Waste of Time', value: 'Waste of Time', stars: '⭐', color: '#dc2626', bg: 'bg-red-600' },
  { label: 'Check that Out Once', value: 'Check that Out Once', stars: '⭐⭐', color: '#d97706', bg: 'bg-amber-600' },
  { label: 'Kinda Liked It', value: 'Kinda Liked It', stars: '⭐⭐⭐', color: '#eab308', bg: 'bg-yellow-500' },
  { label: 'It’s Peak', value: 'It’s Peak', stars: '⭐⭐⭐⭐', color: '#059669', bg: 'bg-emerald-600' },
  { label: 'Absolute Cinema', value: 'Absolute Cinema', stars: '⭐⭐⭐⭐⭐', color: '#9333ea', bg: 'bg-purple-600' },
];

export const RATING_LABELS = RATING_OPTIONS.map((item) => item.value);

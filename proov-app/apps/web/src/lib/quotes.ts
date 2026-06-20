const QUOTES = [
  { text: 'Small daily improvements are the key to staggering long-term results.', author: 'Robin Sharma' },
  { text: 'You do not rise to the level of your goals. You fall to the level of your systems.', author: 'James Clear' },
  { text: 'The secret of getting ahead is getting started.', author: 'Mark Twain' },
  { text: 'We are what we repeatedly do. Excellence is not an act, but a habit.', author: 'Aristotle' },
  { text: 'Discipline is choosing between what you want now and what you want most.', author: 'Abraham Lincoln' },
  { text: 'It does not matter how slowly you go as long as you do not stop.', author: 'Confucius' },
  { text: 'Success is the sum of small efforts, repeated day in and day out.', author: 'Robert Collier' },
  { text: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
  { text: 'Motivation is what gets you started. Habit is what keeps you going.', author: 'Jim Ryun' },
  { text: 'Every action you take is a vote for the person you wish to become.', author: 'James Clear' },
  { text: 'Don\'t watch the clock; do what it does. Keep going.', author: 'Sam Levenson' },
  { text: 'The chains of habit are too light to be felt until they are too heavy to be broken.', author: 'Warren Buffett' },
  { text: 'Your future is created by what you do today, not tomorrow.', author: 'Robert Kiyosaki' },
  { text: 'A year from now you will wish you had started today.', author: 'Karen Lamb' },
  { text: 'Start where you are. Use what you have. Do what you can.', author: 'Arthur Ashe' },
  { text: 'The difference between who you are and who you want to be is what you do.', author: 'Bill Phillips' },
  { text: 'Progress, not perfection, is what we should be asking of ourselves.', author: 'Julia Cameron' },
  { text: 'Consistency is what transforms average into excellence.', author: 'Tony Robbins' },
  { text: 'You don\'t have to be extreme, just consistent.', author: 'Unknown' },
  { text: 'The best time to plant a tree was 20 years ago. The second best time is now.', author: 'Chinese Proverb' },
  { text: 'First forget inspiration. Habit is more dependable.', author: 'Octavia Butler' },
  { text: 'What you get by achieving your goals is not as important as what you become.', author: 'Zig Ziglar' },
  { text: 'It\'s not about having time. It\'s about making time.', author: 'Unknown' },
  { text: 'Commitment means staying loyal to what you said you were going to do long after the mood has left you.', author: 'Unknown' },
  { text: 'If you are persistent, you will get it. If you are consistent, you will keep it.', author: 'Harvey Mackay' },
  { text: 'The hard days are the best because that\'s when champions are made.', author: 'Gabby Douglas' },
  { text: 'Believe you can and you\'re halfway there.', author: 'Theodore Roosevelt' },
  { text: 'Winners embrace hard work. They love the discipline of it.', author: 'Lou Holtz' },
  { text: 'Fall seven times, stand up eight.', author: 'Japanese Proverb' },
  { text: 'Success isn\'t always about greatness. It\'s about consistency.', author: 'Dwayne Johnson' },
  { text: 'The only person you are destined to become is the person you decide to be.', author: 'Ralph Waldo Emerson' },
  { text: 'Little by little, one travels far.', author: 'J.R.R. Tolkien' },
  { text: 'What lies behind us and what lies before us are tiny matters compared to what lies within us.', author: 'Ralph Waldo Emerson' },
  { text: 'Drop by drop, the water pot is filled.', author: 'Buddha' },
  { text: 'You are never too old to set another goal or to dream a new dream.', author: 'C.S. Lewis' },
  { text: 'It always seems impossible until it is done.', author: 'Nelson Mandela' },
  { text: 'Perseverance is not a long race; it is many short races one after the other.', author: 'Walter Elliot' },
  { text: 'Showing up is 80% of life.', author: 'Woody Allen' },
  { text: 'The man who moves a mountain begins by carrying away small stones.', author: 'Confucius' },
  { text: 'Habits are the compound interest of self-improvement.', author: 'James Clear' },
  { text: 'An ant on the move does more than a dozing ox.', author: 'Lao Tzu' },
  { text: 'Do something today that your future self will thank you for.', author: 'Sean Patrick Flanery' },
  { text: 'One day or day one. You decide.', author: 'Paulo Coelho' },
  { text: 'Your life does not get better by chance, it gets better by change.', author: 'Jim Rohn' },
  { text: 'Be stubborn about your goals, flexible about your methods.', author: 'Unknown' },
  { text: 'The distance between your dreams and reality is called discipline.', author: 'Unknown' },
  { text: 'Don\'t count the days. Make the days count.', author: 'Muhammad Ali' },
  { text: 'Action is the foundational key to all success.', author: 'Pablo Picasso' },
  { text: 'Champions keep playing until they get it right.', author: 'Billie Jean King' },
  { text: 'The only limit to our realization of tomorrow is our doubts of today.', author: 'Franklin D. Roosevelt' },
];

export function getDailyQuote(): { text: string; author: string } {
  const today = new Date();
  const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  return QUOTES[seed % QUOTES.length];
}

export function getRandomQuote(): { text: string; author: string } {
  return QUOTES[Math.floor(Math.random() * QUOTES.length)];
}

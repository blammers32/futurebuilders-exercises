import { Budget } from './budget'
import { Live } from './live'
import { Reason } from './reason'
import './styles.css'

export const exercise = {
  id: 'cost',
  title: 'Token Budget',
  kicker: 'Exercise',
  summary: 'Chat and see every token, then get the right answer with as few tokens as you can.',
  minutes: 30,
  levels: [
    {
      id: 'live',
      title: 'Chat',
      blurb: 'Chat. Watch the tokens.',
      steps: ['Type a message.', 'Press Send (or Enter).', 'Each color is one token. The small number is its ID.'],
      Component: Live,
    },
    {
      id: 'budget',
      title: 'Token Budget',
      blurb: 'Get the answer. Stay under budget.',
      steps: ['The prompt is too long. Make it shorter.', 'Press Send.', 'Get the right answer with fewer tokens than the budget.'],
      Component: Budget,
    },
    {
      id: 'think',
      title: 'Think or answer fast?',
      blurb: 'Find 2 puzzles where the models disagree.',
      steps: ['Pick a puzzle.', 'Pick two models. Turn 🧠 thinking on or off.', 'Press Ask both. Who is right? Thinking costs more tokens.'],
      Component: Reason,
    },
  ],
}

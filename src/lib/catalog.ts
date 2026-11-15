import { exercise as prediction } from '../../exercises/prediction/src/index'
import { exercise as tokenization } from '../../exercises/tokenization/src/index'
import type { ExerciseModule } from './types'

export const exercises: ExerciseModule[] = [tokenization, prediction]

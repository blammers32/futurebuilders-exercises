export type LevelProps = {
  onComplete: (result: { score: number; detail?: string }) => void
  completed: boolean
}

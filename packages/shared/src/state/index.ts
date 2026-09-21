/**
 * Zentraler State-Layer des quizapp — pure Function, kein React.
 *
 * Aufrufer:
 *   - Frontend: React-Provider (packages/quizapp/src/context/GameContext.tsx)
 *     baut deps mit localStorage-Wrapper.
 *   - Backend (ab Phase 3): AWS-Lambda baut deps mit DynamoDB-Reader.
 */
export * from './reducer'

import { equipmentTypes } from './exercises'
import type { Equipment } from '../types/exercise'

// Display labels for the app's hardcoded equipment list (see equipmentTypes in exercises.ts,
// which stays the source of truth for the ids themselves so exercise filtering and this list
// can never drift apart).
const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbells',
  machine: 'Machines',
  cable: 'Cable machine',
  bodyweight: 'Bodyweight',
  kettlebell: 'Kettlebell',
  bands: 'Resistance bands',
  harness: 'Neck harness',
  'pull-up-bar': 'Pull-up bar',
  'dip-bar': 'Dip bar',
  bench: 'Bench',
  'squat-rack': 'Squat rack',
  'smith-machine': 'Smith machine',
  'ez-bar': 'EZ bar',
  'weight-belt': 'Weight belt',
}

export interface EquipmentOption {
  id: Equipment
  label: string
}

export const equipmentOptions: EquipmentOption[] = equipmentTypes.map((id) => ({
  id,
  label: EQUIPMENT_LABELS[id],
}))

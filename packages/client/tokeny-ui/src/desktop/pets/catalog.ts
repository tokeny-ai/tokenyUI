/** Tokeny's seven built-in sprite sheets and their shared v3 animation grid. */
import orangeCat from './assets/orange-cat-v3.webp'
import tokenyCow from './assets/tokeny-cow-v3.webp'
import octopus from './assets/octopus-v3.webp'
import aiRobot from './assets/ai-robot-v3.webp'
import roverVacuum from './assets/rover-vacuum-v3.webp'
import marshmallowGhost from './assets/marshmallow-ghost-v3.webp'
import rainbowCloud from './assets/rainbow-cloud-v3.webp'

/** Built-in skin identifiers retained in browser preferences. */
export type PetSkinId = keyof typeof skinsById

/** Original Tokeny sprite sheets, compressed without changing visible pixels. */
export const skinsById = {
  'orange-cat': { id: 'orange-cat', src: orangeCat },
  'tokeny-cow': { id: 'tokeny-cow', src: tokenyCow },
  octopus: { id: 'octopus', src: octopus },
  'ai-robot': { id: 'ai-robot', src: aiRobot },
  'rover-vacuum': { id: 'rover-vacuum', src: roverVacuum },
  'marshmallow-ghost': { id: 'marshmallow-ghost', src: marshmallowGhost },
  'rainbow-cloud': { id: 'rainbow-cloud', src: rainbowCloud },
} as const

/** Ordered built-in choices for the companion skin picker. */
export const skins = Object.values(skinsById)

function row(index: number) {
  return Array.from({ length: 6 }, (_, column) => index * 6 + column)
}

function frames(indices: number[], durationMs: number, loop = false) {
  return { loop, frames: indices.map(index => ({ index, durationMs })) }
}

/** Frame numbers and timings from Tokeny's built-in v3 manifest. */
export const animations = {
  idle: frames(row(0), 500, true),
  walkLeft: frames(row(1), 140, true),
  walkRight: frames(row(2), 140, true),
  attention: frames(row(3), 140),
  success: frames(row(4), 140),
  error: frames(row(5), 140),
  thinking: frames(row(6), 320, true),
  working: frames(row(7), 180, true),
  pet: frames(row(8), 180),
  stretch: frames(row(9), 240),
  yawn: frames(row(10), 260),
  sleepStart: frames([66, 67, 68, 69], 280),
  sleep: frames([69, 70, 71], 1500, true),
  wake: frames([69, 68, 67, 66, 0], 200),
}

/** Actions currently used by the composer companion. */
export type PetAction = keyof typeof animations

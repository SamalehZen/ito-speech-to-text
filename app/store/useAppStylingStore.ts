import { create } from 'zustand'

export type AppTarget = {
  id: string
  userId: string
  name: string
  toneId: string | null
  iconBase64: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type Tone = {
  id: string
  userId: string | null
  name: string
  promptTemplate: string
  isSystem: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

type AppStylingState = {
  appTargets: Record<string, AppTarget>
  tones: Record<string, Tone>
  isLoading: boolean

  loadAppTargets: () => Promise<void>
  loadTones: () => Promise<void>
  registerCurrentApp: () => Promise<AppTarget | null>
  updateAppTone: (appId: string, toneId: string | null) => Promise<void>
  deleteAppTarget: (appId: string) => Promise<void>
  getCurrentAppTarget: () => Promise<AppTarget | null>
}

export const useAppStylingStore = create<AppStylingState>(set => ({
  appTargets: {},
  tones: {},
  isLoading: false,

  loadAppTargets: async () => {
    set({ isLoading: true })
    try {
      const targets = await window.api.appTargets.list()
      set({
        appTargets: targets.reduce(
          (acc: Record<string, AppTarget>, t: AppTarget) => {
            acc[t.id] = t
            return acc
          },
          {},
        ),
      })
    } finally {
      set({ isLoading: false })
    }
  },

  loadTones: async () => {
    const tones = await window.api.tones.list()
    set({
      tones: tones.reduce((acc: Record<string, Tone>, t: Tone) => {
        acc[t.id] = t
        return acc
      }, {}),
    })
  },

  registerCurrentApp: async () => {
    const target = await window.api.appTargets.registerCurrent()
    if (target) {
      set(state => ({
        appTargets: { ...state.appTargets, [target.id]: target },
      }))
    }
    return target
  },

  updateAppTone: async (appId: string, toneId: string | null) => {
    await window.api.appTargets.updateTone(appId, toneId)
    set(state => ({
      appTargets: {
        ...state.appTargets,
        [appId]: { ...state.appTargets[appId], toneId },
      },
    }))
  },

  deleteAppTarget: async (appId: string) => {
    await window.api.appTargets.delete(appId)
    set(state => {
      const { [appId]: _, ...rest } = state.appTargets
      return { appTargets: rest }
    })
  },

  getCurrentAppTarget: async () => {
    return window.api.appTargets.getCurrent()
  },
}))

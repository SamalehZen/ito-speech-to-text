import { run, get, all } from './utils'

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

export const AppTargetTable = {
  async findAll(userId: string): Promise<AppTarget[]> {
    const rows = await all<{
      id: string
      userId: string
      name: string
      toneId: string | null
      iconBase64: string | null
      createdAt: string
      updatedAt: string
      deletedAt: string | null
    }>(
      `SELECT id, user_id as userId, name, tone_id as toneId, icon_base64 as iconBase64, 
       created_at as createdAt, updated_at as updatedAt, deleted_at as deletedAt
       FROM app_targets WHERE user_id = ? AND deleted_at IS NULL ORDER BY name`,
      [userId],
    )
    return rows
  },

  async findById(id: string, userId: string): Promise<AppTarget | null> {
    const row = await get<{
      id: string
      userId: string
      name: string
      toneId: string | null
      iconBase64: string | null
      createdAt: string
      updatedAt: string
      deletedAt: string | null
    }>(
      `SELECT id, user_id as userId, name, tone_id as toneId, icon_base64 as iconBase64,
       created_at as createdAt, updated_at as updatedAt, deleted_at as deletedAt
       FROM app_targets WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      [id, userId],
    )
    return row || null
  },

  async upsert(data: {
    id: string
    userId: string
    name: string
    toneId?: string | null
    iconBase64?: string | null
  }): Promise<AppTarget> {
    const now = new Date().toISOString()

    await run(
      `INSERT INTO app_targets (id, user_id, name, tone_id, icon_base64, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id, user_id) DO UPDATE SET
         name = excluded.name,
         tone_id = COALESCE(excluded.tone_id, tone_id),
         icon_base64 = COALESCE(excluded.icon_base64, icon_base64),
         updated_at = excluded.updated_at`,
      [
        data.id,
        data.userId,
        data.name,
        data.toneId ?? null,
        data.iconBase64 ?? null,
        now,
        now,
      ],
    )

    const result = await AppTargetTable.findById(data.id, data.userId)
    return result!
  },

  async updateTone(
    id: string,
    userId: string,
    toneId: string | null,
  ): Promise<void> {
    const now = new Date().toISOString()

    await run(
      `UPDATE app_targets SET tone_id = ?, updated_at = ? WHERE id = ? AND user_id = ?`,
      [toneId, now, id, userId],
    )
  },

  async delete(id: string, userId: string): Promise<void> {
    const now = new Date().toISOString()

    await run(
      `UPDATE app_targets SET deleted_at = ? WHERE id = ? AND user_id = ?`,
      [now, id, userId],
    )
  },

  async deleteAllUserData(userId: string): Promise<void> {
    await run(`DELETE FROM app_targets WHERE user_id = ?`, [userId])
  },
}

export const ToneTable = {
  async findAll(userId: string): Promise<Tone[]> {
    const rows = await all<{
      id: string
      userId: string | null
      name: string
      promptTemplate: string
      isSystem: number
      sortOrder: number
      createdAt: string
      updatedAt: string
      deletedAt: string | null
    }>(
      `SELECT id, user_id as userId, name, prompt_template as promptTemplate, 
       is_system as isSystem, sort_order as sortOrder,
       created_at as createdAt, updated_at as updatedAt, deleted_at as deletedAt
       FROM tones 
       WHERE (user_id IS NULL OR user_id = ?) AND deleted_at IS NULL 
       ORDER BY sort_order`,
      [userId],
    )
    return rows.map(r => ({ ...r, isSystem: Boolean(r.isSystem) }))
  },

  async findById(id: string): Promise<Tone | null> {
    const row = await get<{
      id: string
      userId: string | null
      name: string
      promptTemplate: string
      isSystem: number
      sortOrder: number
      createdAt: string
      updatedAt: string
      deletedAt: string | null
    }>(
      `SELECT id, user_id as userId, name, prompt_template as promptTemplate,
       is_system as isSystem, sort_order as sortOrder,
       created_at as createdAt, updated_at as updatedAt, deleted_at as deletedAt
       FROM tones WHERE id = ?`,
      [id],
    )
    return row ? { ...row, isSystem: Boolean(row.isSystem) } : null
  },
}

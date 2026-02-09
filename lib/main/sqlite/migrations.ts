export interface Migration {
  id: string
  up: string
  down: string
}

export const MIGRATIONS: Migration[] = [
  {
    id: '20250108120000_add_raw_audio_to_interactions',
    up: 'ALTER TABLE interactions ADD COLUMN raw_audio BLOB;',
    down: 'ALTER TABLE interactions DROP COLUMN raw_audio;',
  },
  {
    id: '20250108130000_add_duration_to_interactions',
    up: 'ALTER TABLE interactions ADD COLUMN duration_ms INTEGER DEFAULT 0;',
    down: 'ALTER TABLE interactions DROP COLUMN duration_ms;',
  },
  {
    id: '20250110120000_add_sample_rate_to_interactions',
    up: 'ALTER TABLE interactions ADD COLUMN sample_rate INTEGER;',
    down: 'ALTER TABLE interactions DROP COLUMN sample_rate;',
  },
  {
    id: '20250111120000_add_raw_audio_id_to_interactions',
    up: 'ALTER TABLE interactions ADD COLUMN raw_audio_id TEXT;',
    down: 'ALTER TABLE interactions DROP COLUMN raw_audio_id;',
  },
  {
    id: '20250923091139_make_dictionary_word_unique',
    up: `
      -- Delete duplicate entries, keeping only the most recent one (highest id)
      DELETE FROM dictionary_items
      WHERE id NOT IN (
        SELECT MAX(id)
        FROM dictionary_items
        WHERE deleted_at IS NULL
        GROUP BY word
      )
      AND deleted_at IS NULL;

      -- Now create the unique index
      CREATE UNIQUE INDEX idx_dictionary_items_word_unique ON dictionary_items(word) WHERE deleted_at IS NULL;
    `,
    down: 'DROP INDEX idx_dictionary_items_word_unique;',
  },
  {
    id: '20251029000000_add_user_metadata_table',
    up: `
      CREATE TABLE user_metadata (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        paid_status TEXT NOT NULL DEFAULT 'FREE',
        free_words_remaining INTEGER,
        pro_trial_start_date TEXT,
        pro_trial_end_date TEXT,
        pro_subscription_start_date TEXT,
        pro_subscription_end_date TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
    down: 'DROP TABLE user_metadata;',
  },
  {
    id: '20260208000000_add_app_targets_and_tones',
    up: `
      -- App Targets: Applications registered by user
      CREATE TABLE IF NOT EXISTS app_targets (
        id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        tone_id TEXT,
        icon_base64 TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        PRIMARY KEY (id, user_id)
      );

      -- Writing Tones (system + custom)
      CREATE TABLE IF NOT EXISTS tones (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        name TEXT NOT NULL,
        prompt_template TEXT NOT NULL,
        is_system INTEGER DEFAULT 0,
        sort_order INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      );

      -- Insert default system tones
      INSERT OR IGNORE INTO tones (id, user_id, name, prompt_template, is_system, sort_order, created_at, updated_at) VALUES
      ('polished', NULL, 'Polished', '- Only correct grammar that would confuse the reader or look like an unintentional mistake
- Keep the speaker''s vocabulary, sentence patterns, and tone intact
- Remove filler words and speech disfluencies that carry no meaning
- The result should read like the speaker sat down and typed it carefully', 1, 0, datetime('now'), datetime('now'));

      INSERT OR IGNORE INTO tones (id, user_id, name, prompt_template, is_system, sort_order, created_at, updated_at) VALUES
      ('verbatim', NULL, 'Verbatim', '- Produce a near-exact transcription that preserves the speaker''s voice
- Add punctuation, capitalization, and paragraph breaks for readability
- Remove filler words (um, uh, like), false starts, repeated words
- Do NOT fix grammar or restructure sentences', 1, 1, datetime('now'), datetime('now'));

      INSERT OR IGNORE INTO tones (id, user_id, name, prompt_template, is_system, sort_order, created_at, updated_at) VALUES
      ('email', NULL, 'Email', '- Sound like the speaker, but written
- Fix grammar, remove filler and disfluencies, lightly restructure for readability
- Format as a professional email with greeting, body, and sign-off
- Preserve the speaker''s greeting and sign-off if present
- DO NOT introduce new phrasing or change intent', 1, 2, datetime('now'), datetime('now'));

      INSERT OR IGNORE INTO tones (id, user_id, name, prompt_template, is_system, sort_order, created_at, updated_at) VALUES
      ('chat', NULL, 'Chat', '- Keep the language casual and conversational like a text message
- Capitalize the first letter of each sentence
- Remove filler words that detract from the casual tone
- Keep question marks and exclamation points
- Never end the last sentence with a period', 1, 3, datetime('now'), datetime('now'));

      INSERT OR IGNORE INTO tones (id, user_id, name, prompt_template, is_system, sort_order, created_at, updated_at) VALUES
      ('formal', NULL, 'Formal', '- Rewrite in a polished, professional register
- Use complete sentences, precise vocabulary, and proper grammar
- Avoid contractions, colloquialisms, and casual phrasing
- The result should be suitable for official documents or professional correspondence', 1, 4, datetime('now'), datetime('now'));

      INSERT OR IGNORE INTO tones (id, user_id, name, prompt_template, is_system, sort_order, created_at, updated_at) VALUES
      ('disabled', NULL, 'Disabled', '', 1, 5, datetime('now'), datetime('now'));

      CREATE INDEX IF NOT EXISTS idx_app_targets_user_id ON app_targets(user_id);
      CREATE INDEX IF NOT EXISTS idx_tones_user_id ON tones(user_id);
    `,
    down: `
      DROP INDEX IF EXISTS idx_tones_user_id;
      DROP INDEX IF EXISTS idx_app_targets_user_id;
      DROP TABLE IF EXISTS tones;
      DROP TABLE IF EXISTS app_targets;
    `,
  },
  {
    id: '20260209000000_add_match_type_and_domain_to_app_targets',
    up: `
      -- Add match_type column: 'app' (default) or 'domain'
      ALTER TABLE app_targets ADD COLUMN match_type TEXT NOT NULL DEFAULT 'app';
      
      -- Add domain column for domain-based matching
      ALTER TABLE app_targets ADD COLUMN domain TEXT;
      
      -- Create index for domain lookups
      CREATE INDEX IF NOT EXISTS idx_app_targets_domain ON app_targets(domain) WHERE domain IS NOT NULL;
    `,
    down: `
      DROP INDEX IF EXISTS idx_app_targets_domain;
      ALTER TABLE app_targets DROP COLUMN domain;
      ALTER TABLE app_targets DROP COLUMN match_type;
    `,
  },
]

import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  varchar,
  numeric,
  index,
  uniqueIndex,
  unique,
  serial,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ─── profiles ────────────────────────────────────────────────────────────────

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(),
  email: text('email').unique(),
  displayName: text('display_name'),
  mascot: text('mascot'),
  onboardingCompleted: boolean('onboarding_completed').notNull().default(false),
  guidesCompleted: text('guides_completed')
    .array()
    .notNull()
    .default(sql`'{}'`),
  goldBalance: integer('gold_balance').notNull().default(0),
  diceRollsCount: integer('dice_rolls_count').notNull().default(15),
  level: integer('level').notNull().default(1),
  currentExp: integer('current_exp').notNull().default(0),
  currentOutfit: text('current_outfit').notNull().default('default'),
  travelBoardPosition: integer('travel_board_position').notNull().default(0),
  activeCourseMapId: uuid('active_course_map_id'),
  lastAccessedCourseMapId: uuid('last_accessed_course_map_id'),
  lastAccessedAt: timestamp('last_accessed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// ─── onboarding_sessions ─────────────────────────────────────────────────────

export const onboardingSessions = pgTable(
  'onboarding_sessions',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid('user_id').references(() => profiles.id, {
      onDelete: 'set null',
    }),
    phase: text('phase').notNull().default('exploration'),
    topic: text('topic'),
    level: text('level'),
    verifiedConcept: text('verified_concept'),
    focus: text('focus'),
    mode: text('mode'),
    source: text('source'),
    intent: text('intent'),
    stateJson: jsonb('state_json').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index('idx_onboarding_phase').on(t.phase),
    index('idx_onboarding_topic').on(t.topic),
    index('idx_onboarding_user_id').on(t.userId),
  ],
);

// ─── course_maps ─────────────────────────────────────────────────────────────

export const courseMaps = pgTable(
  'course_maps',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid('user_id').references(() => profiles.id, {
      onDelete: 'set null',
    }),
    topic: text('topic').notNull(),
    level: text('level').notNull(),
    focus: text('focus').notNull(),
    verifiedConcept: text('verified_concept').notNull(),
    mode: text('mode').notNull(),
    language: text('language').notNull().default('en'),
    totalCommitmentMinutes: integer('total_commitment_minutes').notNull(),
    mapMeta: jsonb('map_meta').notNull(),
    nodes: jsonb('nodes').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('idx_course_maps_topic').on(t.topic),
    index('idx_course_maps_mode').on(t.mode),
    index('idx_course_maps_created_at').on(t.createdAt),
    index('idx_course_maps_user_id').on(t.userId),
  ],
);

// ─── node_contents ───────────────────────────────────────────────────────────

export const nodeContents = pgTable(
  'node_contents',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    courseMapId: uuid('course_map_id')
      .notNull()
      .references(() => courseMaps.id, { onDelete: 'cascade' }),
    nodeId: integer('node_id').notNull(),
    contentType: text('content_type').notNull(),
    questionKey: text('question_key'),
    contentJson: jsonb('content_json').notNull(),
    generationStatus: varchar('generation_status', { length: 50 })
      .notNull()
      .default('pending'),
    generationStartedAt: timestamp('generation_started_at', {
      withTimezone: true,
    }),
    generationCompletedAt: timestamp('generation_completed_at', {
      withTimezone: true,
    }),
    generationError: text('generation_error'),
    nodeType: varchar('node_type', { length: 50 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('idx_node_contents_course_map_id').on(t.courseMapId),
    index('idx_node_contents_course_node').on(t.courseMapId, t.nodeId),
    index('idx_node_contents_type').on(t.contentType),
    index('idx_node_contents_generation_status').on(t.generationStatus),
  ],
);

// ─── node_progress ───────────────────────────────────────────────────────────

export const nodeProgress = pgTable(
  'node_progress',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    courseMapId: uuid('course_map_id')
      .notNull()
      .references(() => courseMaps.id, { onDelete: 'cascade' }),
    nodeId: integer('node_id').notNull(),
    status: text('status').notNull().default('locked'),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    unique('uq_user_course_node').on(t.userId, t.courseMapId, t.nodeId),
    index('idx_node_progress_user_id').on(t.userId),
    index('idx_node_progress_course_map_id').on(t.courseMapId),
  ],
);

// ─── quiz_attempts ───────────────────────────────────────────────────────────

export const quizAttempts = pgTable(
  'quiz_attempts',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    courseMapId: uuid('course_map_id')
      .notNull()
      .references(() => courseMaps.id, { onDelete: 'cascade' }),
    nodeId: integer('node_id').notNull(),
    quizJson: jsonb('quiz_json').notNull(),
    score: integer('score'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('idx_quiz_attempts_user_id').on(t.userId),
    index('idx_quiz_attempts_course_map_id').on(t.courseMapId),
    index('idx_quiz_attempts_node_id').on(t.nodeId),
    index('idx_quiz_attempts_course_map_node').on(t.courseMapId, t.nodeId),
    index('idx_quiz_attempts_created_at').on(t.createdAt),
  ],
);

// ─── game_transactions ───────────────────────────────────────────────────────

export const gameTransactions = pgTable('game_transactions', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: uuid('user_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  transactionType: text('transaction_type').notNull(),
  amount: integer('amount').notNull(),
  balanceAfter: integer('balance_after'),
  source: text('source').notNull(),
  sourceDetail: jsonb('source_detail'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── learning_activities ─────────────────────────────────────────────────────

export const learningActivities = pgTable(
  'learning_activities',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    courseMapId: uuid('course_map_id')
      .notNull()
      .references(() => courseMaps.id, { onDelete: 'cascade' }),
    nodeId: integer('node_id').notNull(),
    activityType: text('activity_type').notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    extraData: jsonb('extra_data'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('idx_learning_activities_user_time').on(t.userId, t.completedAt),
    index('idx_learning_activities_user_course').on(t.userId, t.courseMapId),
    index('idx_learning_activities_type').on(t.activityType),
  ],
);

// ─── shop_items ──────────────────────────────────────────────────────────────

export const shopItems = pgTable('shop_items', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  itemType: text('item_type').notNull(),
  price: integer('price').notNull(),
  imagePath: text('image_path').notNull(),
  rarity: text('rarity').notNull().default('common'),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── user_inventory ──────────────────────────────────────────────────────────

export const userInventory = pgTable(
  'user_inventory',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    itemId: uuid('item_id')
      .notNull()
      .references(() => shopItems.id, { onDelete: 'cascade' }),
    isEquipped: boolean('is_equipped').notNull().default(false),
    purchasedAt: timestamp('purchased_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique('uq_user_inventory_user_item').on(t.userId, t.itemId),
    index('idx_user_inventory_user_id').on(t.userId),
    index('idx_user_inventory_item_id').on(t.itemId),
  ],
);

// ─── user_stats ──────────────────────────────────────────────────────────────

export const userStats = pgTable(
  'user_stats',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    totalStudySeconds: integer('total_study_seconds').notNull().default(0),
    completedCoursesCount: integer('completed_courses_count')
      .notNull()
      .default(0),
    masteredNodesCount: integer('mastered_nodes_count').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index('idx_user_stats_study_time').on(t.totalStudySeconds),
  ],
);

// ─── discovery_courses ───────────────────────────────────────────────────────

export const discoveryCourses = pgTable(
  'discovery_courses',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    presetId: text('preset_id').notNull().unique(),
    title: text('title').notNull(),
    description: text('description'),
    imageUrl: text('image_url'),
    category: text('category').notNull(),
    displayOrder: integer('display_order').notNull().default(0),
    rating: numeric('rating', { precision: 3, scale: 1 }).notNull().default('4.5'),
    seedContext: jsonb('seed_context').notNull(),
    nodes: jsonb('nodes'),
    mapMeta: jsonb('map_meta'),
    sourceCourseMapId: uuid('source_course_map_id'),
    tags: jsonb('tags'),
    isActive: boolean('is_active').notNull().default(true),
    viewCount: integer('view_count').notNull().default(0),
    startCount: integer('start_count').notNull().default(0),
    completionCount: integer('completion_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index('idx_discovery_courses_category').on(t.category),
    index('idx_discovery_courses_active').on(t.isActive),
    index('idx_discovery_courses_order').on(t.category, t.displayOrder),
  ],
);

// ─── prompt_runs ─────────────────────────────────────────────────────────────

export const promptRuns = pgTable(
  'prompt_runs',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    requestId: uuid('request_id').notNull().unique(),
    promptName: text('prompt_name').notNull(),
    promptHash: text('prompt_hash').notNull(),
    model: text('model').notNull(),
    success: boolean('success').notNull(),
    retries: integer('retries').notNull().default(0),
    latencyMs: integer('latency_ms').notNull(),
    rawText: text('raw_text'),
    parsedJson: jsonb('parsed_json'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('idx_prompt_runs_prompt_name').on(t.promptName),
    index('idx_prompt_runs_prompt_hash').on(t.promptHash),
    index('idx_prompt_runs_created_at').on(t.createdAt),
  ],
);

// ─── prompt_test_runs ────────────────────────────────────────────────────────

export const promptTestRuns = pgTable(
  'prompt_test_runs',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    promptName: text('prompt_name').notNull(),
    promptText: text('prompt_text').notNull(),
    promptHash: text('prompt_hash').notNull(),
    courseMapIds: jsonb('course_map_ids').notNull(),
    status: text('status').notNull().default('running'),
    score: integer('score'),
    reviewComment: text('review_comment'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('idx_prompt_test_runs_prompt_name').on(t.promptName),
    index('idx_prompt_test_runs_status').on(t.status),
    index('idx_prompt_test_runs_created_at').on(t.createdAt),
  ],
);

// ─── prompt_test_results ─────────────────────────────────────────────────────

export const promptTestResults = pgTable(
  'prompt_test_results',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    runId: uuid('run_id')
      .notNull()
      .references(() => promptTestRuns.id, { onDelete: 'cascade' }),
    courseMapId: uuid('course_map_id')
      .notNull()
      .references(() => courseMaps.id, { onDelete: 'cascade' }),
    inputVariables: jsonb('input_variables').notNull(),
    outputRaw: text('output_raw'),
    outputParsed: jsonb('output_parsed'),
    status: text('status').notNull().default('pending'),
    errorMessage: text('error_message'),
    latencyMs: integer('latency_ms'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('idx_prompt_test_results_run_id').on(t.runId),
    index('idx_prompt_test_results_course_map_id').on(t.courseMapId),
    index('idx_prompt_test_results_status').on(t.status),
  ],
);

// ─── user_invites ────────────────────────────────────────────────────────────

export const userInvites = pgTable('user_invites', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  inviteCode: varchar('invite_code', { length: 6 }).notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── invite_bindings ─────────────────────────────────────────────────────────

export const inviteBindings = pgTable('invite_bindings', {
  id: serial('id').primaryKey(),
  inviterId: uuid('inviter_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  inviteeId: uuid('invitee_id')
    .notNull()
    .unique()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  inviteCode: varchar('invite_code', { length: 6 }).notNull(),
  boundAt: timestamp('bound_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  xpGranted: boolean('xp_granted').notNull().default(false),
});

// ─── user_rewards ────────────────────────────────────────────────────────────

export const userRewards = pgTable('user_rewards', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  rewardType: varchar('reward_type', { length: 50 }).notNull(),
  amount: integer('amount').notNull(),
  sourceType: varchar('source_type', { length: 50 }).notNull(),
  sourceId: text('source_id'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

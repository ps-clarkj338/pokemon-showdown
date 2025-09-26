# Pokémon Showdown `lib/sql.ts` - Complete API Reference

## Overview

The `lib/sql.ts` module provides a high-performance, async worker thread wrapper around SQLite using `better-sqlite3`. It's designed specifically for concurrent operations and includes PS-specific optimizations, prepared statement caching, transaction support, and a convenient ORM-style table interface.

## Basic Usage

```typescript
import { SQL } from '../lib/sql';

// Create database manager
const database = SQL(module, {
  file: 'databases/safari-zone.db',
  extension: 'safari-zone-db', // Optional extension file
  processes: 2 // Optional worker processes
});
```

## SQLOptions Configuration

### `SQLOptions` Interface

```typescript
interface SQLOptions {
  file: string;                    // Database file path
  extension?: string;              // Extension file for custom functions/transactions
  sqliteOptions?: sqlite.Options;  // better-sqlite3 options
  onError?: ErrorHandler;          // Custom error handling
}
```

### Basic Setup

```typescript
// Minimal setup
const db = SQL(module, {
  file: 'databases/plugin-data.db'
});

// Advanced setup with error handling
const db = SQL(module, {
  file: 'databases/safari-zone.db',
  extension: 'safari-zone-extensions',
  processes: 4, // Multi-process for better concurrency
  onError: (error, query, isParentProcess) => {
    console.error('Database error:', error.message);
    if (query.type === 'get') return null; // Return fallback for GET queries
    // Let other errors throw normally
  }
});
```

## Core Database Operations

### `run(statement, data?, noPrepare?): Promise<sqlite.RunResult>`

**⭐ For INSERT, UPDATE, DELETE** - Execute statements that modify data.

```typescript
// Insert new player
const result = await db.run(
  'INSERT INTO players (userid, catches, pokebucks) VALUES (?, ?, ?)', 
  ['alice123', 0, 1000]
);
console.log(`Inserted row with ID: ${result.lastInsertRowid}`);
console.log(`Changed ${result.changes} rows`);

// Update player data
await db.run(
  'UPDATE players SET catches = catches + 1, pokebucks = pokebucks - 500 WHERE userid = ?',
  ['alice123']
);

// Using template literals (requires sql-template-strings)
const userId = 'alice123';
const newCatches = 5;
await db.run(SQL.SQL`
  UPDATE players 
  SET catches = ${newCatches}
  WHERE userid = ${userId}
`);
```

### `get<T>(statement, data?, noPrepare?): Promise<T>`

**⭐ For single row results** - Fetch one row from database.

```typescript
// Get player data
interface Player {
  userid: string;
  catches: number;
  pokebucks: number;
  last_encounter?: string;
}

const player = await db.get<Player>(
  'SELECT * FROM players WHERE userid = ?',
  ['alice123']
);

if (player) {
  console.log(`${player.userid} has ${player.catches} catches`);
} else {
  console.log('Player not found');
}

// Get specific columns
const stats = await db.get<{catches: number, pokebucks: number}>(
  'SELECT catches, pokebucks FROM players WHERE userid = ?',
  ['alice123']
);
```

### `all<T>(statement, data?, noPrepare?): Promise<T[]>`

**⭐ For multiple row results** - Fetch array of rows from database.

```typescript
// Get all players
const allPlayers = await db.all<Player>('SELECT * FROM players ORDER BY catches DESC');

// Get top 10 players by catches
const topPlayers = await db.all<Player>(
  'SELECT * FROM players ORDER BY catches DESC LIMIT ?',
  [10]
);

// Get players with filters
const activePlayers = await db.all<Player>(
  'SELECT * FROM players WHERE last_encounter > ? ORDER BY catches DESC',
  [Date.now() - (7 * 24 * 60 * 60 * 1000)] // Last 7 days
);

// Complex query with joins (example)
interface PlayerWithStats {
  userid: string;
  catches: number;
  total_encounters: number;
  favorite_pokemon: string;
}

const playersWithStats = await db.all<PlayerWithStats>(`
  SELECT p.userid, p.catches, 
         COUNT(e.id) as total_encounters,
         e.species as favorite_pokemon
  FROM players p
  LEFT JOIN encounters e ON p.userid = e.userid
  GROUP BY p.userid
  ORDER BY p.catches DESC
`);
```

### `exec(sql): Promise<{changes: number}>`

**⭐ For DDL and bulk operations** - Execute raw SQL (CREATE TABLE, bulk inserts, etc.).

```typescript
// Create tables
await db.exec(`
  CREATE TABLE IF NOT EXISTS players (
    userid TEXT PRIMARY KEY,
    catches INTEGER DEFAULT 0,
    pokebucks INTEGER DEFAULT 1000,
    last_encounter INTEGER,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
  )
`);

await db.exec(`
  CREATE TABLE IF NOT EXISTS encounters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userid TEXT,
    species TEXT,
    level INTEGER,
    caught BOOLEAN DEFAULT FALSE,
    timestamp INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (userid) REFERENCES players(userid)
  )
`);

// Create indexes for performance
await db.exec(`
  CREATE INDEX IF NOT EXISTS idx_players_catches ON players(catches);
  CREATE INDEX IF NOT EXISTS idx_encounters_userid ON encounters(userid);
  CREATE INDEX IF NOT EXISTS idx_encounters_species ON encounters(species);
`);
```

### `prepare(statement): Promise<Statement | null>`

**⭐ For frequently used queries** - Pre-compile statements for better performance.

```typescript
// Prepare frequently used statements
const getPlayerStmt = await db.prepare('SELECT * FROM players WHERE userid = ?');
const updateCatchesStmt = await db.prepare('UPDATE players SET catches = catches + 1 WHERE userid = ?');
const insertEncounterStmt = await db.prepare(`
  INSERT INTO encounters (userid, species, level, caught) 
  VALUES (?, ?, ?, ?)
`);

// Use prepared statements (automatically cached)
const player = await getPlayerStmt.get(['alice123']);
await updateCatchesStmt.run(['alice123']);
await insertEncounterStmt.run(['alice123', 'Pikachu', 25, true]);
```

## Statement Class

Pre-compiled statements for optimal performance:

```typescript
class Statement<R, T> {
  run(data: R): Promise<sqlite.RunResult>
  get(data: R): Promise<T>
  all(data: R): Promise<T[]>
}

// Example usage
const stmt = await db.prepare('SELECT * FROM players WHERE catches > ?');
const topPlayers = await stmt.all([10]);
const bestPlayer = await stmt.get([50]);
```

## Transaction Support

### Basic Transactions

```typescript
// Define transaction function in extension file (safari-zone-extensions.ts)
export const transactions = {
  transferPokebucks: (data: [string, string, number], env: TransactionEnvironment) => {
    const [fromUser, toUser, amount] = data;
    
    // Get prepared statements from environment
    const getPlayer = env.statements.get('SELECT * FROM players WHERE userid = ?');
    const updatePlayer = env.statements.get('UPDATE players SET pokebucks = ? WHERE userid = ?');
    
    // Check sender has enough pokebucks
    const sender = getPlayer.get([fromUser]);
    if (!sender || sender.pokebucks < amount) {
      return { error: 'Insufficient pokebucks' };
    }
    
    // Transfer pokebucks
    updatePlayer.run([sender.pokebucks - amount, fromUser]);
    
    const receiver = getPlayer.get([toUser]);
    const newAmount = (receiver?.pokebucks || 0) + amount;
    if (receiver) {
      updatePlayer.run([newAmount, toUser]);
    } else {
      // Create new player
      const insertPlayer = env.statements.get('INSERT INTO players (userid, pokebucks) VALUES (?, ?)');
      insertPlayer.run([toUser, newAmount]);
    }
    
    return { success: true, transferred: amount };
  }
};

// Use transaction
const result = await db.transaction('transferPokebucks', ['alice123', 'bob456', 500]);
```

### Transaction Environment

```typescript
interface TransactionEnvironment {
  db: sqlite.Database;           // Direct database access
  statements: Map<string, sqlite.Statement>; // Cached prepared statements
}
```

## DatabaseTable ORM

**⭐ Recommended for structured data** - High-level table interface with type safety.

### Creating Tables

```typescript
import { SQL } from '../lib/sql';

// Define table schema
interface Player {
  userid: string;
  catches: number;
  pokebucks: number;
  last_encounter?: number;
  created_at?: number;
}

// Create table instance
const playersTable = new SQL.DatabaseTable<Player>('players', 'userid', db);
```

### Table Operations

#### `get(entries, keyId): Promise<T | null>`

Get single row by primary key.

```typescript
// Get player by userid (primary key)
const player = await playersTable.get('*', 'alice123');
const playerName = await playersTable.get('userid', 'alice123'); // Get only specific columns
const playerStats = await playersTable.get(['catches', 'pokebucks'], 'alice123');
```

#### `selectOne<R>(entries, where?): Promise<R | null>`

Get first matching row.

```typescript
// Find top player
const topPlayer = await playersTable.selectOne('*', 
  SQL.SQL`catches = (SELECT MAX(catches) FROM players)`
);

// Find player by catches
const goodPlayer = await playersTable.selectOne('*',
  SQL.SQL`catches >= ${50}`
);
```

#### `selectAll<R>(entries, where?): Promise<R[]>`

Get all matching rows.

```typescript
// Get all players
const allPlayers = await playersTable.selectAll('*');

// Get players with high catches
const topPlayers = await playersTable.selectAll('*',
  SQL.SQL`catches >= ${10} ORDER BY catches DESC LIMIT ${10}`
);

// Get specific columns
const playerNames = await playersTable.selectAll('userid',
  SQL.SQL`catches > ${0}`
);
```

#### `insert(data, rest?, isReplace?): Promise<sqlite.RunResult>`

Insert new rows.

```typescript
// Insert new player
await playersTable.insert({
  userid: 'charlie789',
  catches: 0,
  pokebucks: 1000,
  last_encounter: Date.now()
});

// Insert with ON CONFLICT clause
await playersTable.insert(
  { userid: 'alice123', catches: 5 },
  SQL.SQL`ON CONFLICT(userid) DO UPDATE SET catches = excluded.catches`
);
```

#### `replace(data, rest?): Promise<sqlite.RunResult>`

Replace row (INSERT OR REPLACE).

```typescript
// Replace player data
await playersTable.replace({
  userid: 'alice123',
  catches: 15,
  pokebucks: 2500
});
```

#### `update(primaryKey, data): Promise<sqlite.RunResult>`

Update by primary key.

```typescript
// Update player
await playersTable.update('alice123', {
  catches: 10,
  pokebucks: 1500,
  last_encounter: Date.now()
});
```

#### `updateOne(data, where): Promise<sqlite.RunResult>`

Update first matching row.

```typescript
// Update first player with 0 catches
await playersTable.updateOne(
  { pokebucks: 500 },
  SQL.SQL`catches = ${0}`
);
```

#### `updateAll(data, where?, limit?): Promise<sqlite.RunResult>`

Update multiple rows.

```typescript
// Give bonus pokebucks to all active players
await playersTable.updateAll(
  { pokebucks: SQL.SQL`pokebucks + 100` },
  SQL.SQL`last_encounter > ${Date.now() - 24*60*60*1000}` // Last 24 hours
);

// Update with limit
await playersTable.updateAll(
  { catches: SQL.SQL`catches + 1` },
  SQL.SQL`catches < ${50}`,
  10 // Update max 10 rows
);
```

#### `delete(keyId): Promise<sqlite.RunResult>`

Delete by primary key.

```typescript
// Delete player
await playersTable.delete('alice123');
```

#### `deleteOne(where): Promise<sqlite.RunResult>`

Delete first matching row.

```typescript
// Delete oldest inactive player
await playersTable.deleteOne(
  SQL.SQL`last_encounter < ${Date.now() - 30*24*60*60*1000} ORDER BY last_encounter ASC`
);
```

#### `deleteAll(where?, limit?): Promise<sqlite.RunResult>`

Delete multiple rows.

```typescript
// Delete all inactive players
await playersTable.deleteAll(
  SQL.SQL`last_encounter < ${Date.now() - 90*24*60*60*1000}` // 90 days ago
);

// Delete with limit
await playersTable.deleteAll(
  SQL.SQL`catches = ${0}`,
  5 // Delete max 5 rows
);
```

## SQL Template Literals

**⭐ Recommended for dynamic queries** - Safe parameterized queries using template literals.

```typescript
// Import SQL template function
const { SQL: sqlTag } = SQL;

// Safe parameterized queries
const userId = 'alice123';
const minCatches = 10;

const query = sqlTag`
  SELECT p.*, COUNT(e.id) as encounter_count
  FROM players p
  LEFT JOIN encounters e ON p.userid = e.userid
  WHERE p.userid = ${userId} 
    AND p.catches >= ${minCatches}
  GROUP BY p.userid
`;

const result = await db.get(query.sql, query.values);

// Complex dynamic queries
function buildPlayerQuery(filters: {
  minCatches?: number;
  maxCatches?: number;
  hasEncounters?: boolean;
  activeWithin?: number; // days
}) {
  let query = sqlTag`SELECT * FROM players WHERE 1=1`;
  
  if (filters.minCatches !== undefined) {
    query = sqlTag`${query} AND catches >= ${filters.minCatches}`;
  }
  
  if (filters.maxCatches !== undefined) {
    query = sqlTag`${query} AND catches <= ${filters.maxCatches}`;
  }
  
  if (filters.hasEncounters) {
    query = sqlTag`${query} AND userid IN (SELECT DISTINCT userid FROM encounters)`;
  }
  
  if (filters.activeWithin) {
    const cutoff = Date.now() - (filters.activeWithin * 24 * 60 * 60 * 1000);
    query = sqlTag`${query} AND last_encounter > ${cutoff}`;
  }
  
  return query;
}

// Usage
const activeQuery = buildPlayerQuery({ 
  minCatches: 5, 
  hasEncounters: true, 
  activeWithin: 7 
});
const activePlayers = await db.all(activeQuery.sql, activeQuery.values);
```

## Extension System

Create database extension files to define custom functions, transactions, and schema:

### Extension File Structure (`safari-zone-extensions.ts`)

```typescript
import type { Database } from 'better-sqlite3';
import type { TransactionEnvironment } from '../lib/sql';

// Custom SQL functions
export const functions = {
  // Calculate catch rate based on pokemon and ball type
  calculateCatchRate: (pokemonRarity: number, ballMultiplier: number, playerLevel: number) => {
    const baseRate = Math.max(1, 256 - pokemonRarity * 50);
    const levelBonus = Math.min(50, Math.floor(playerLevel / 10) * 5);
    return Math.min(255, baseRate * ballMultiplier + levelBonus);
  },
  
  // Generate encounter rarity
  getEncounterRarity: (species: string) => {
    const rarityMap: {[key: string]: number} = {
      'Pidgey': 1, 'Rattata': 1,
      'Pikachu': 3, 'Eevee': 3,
      'Dragonite': 5, 'Mewtwo': 5
    };
    return rarityMap[species] || 2;
  }
};

// Pre-compiled transactions
export const transactions = {
  // Atomic encounter processing
  processEncounter: (
    data: [string, string, number, boolean], 
    env: TransactionEnvironment
  ) => {
    const [userId, species, level, caught] = data;
    
    // Insert encounter record
    const insertEncounter = env.db.prepare(`
      INSERT INTO encounters (userid, species, level, caught, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `);
    const encounterResult = insertEncounter.run([userId, species, level, caught, Date.now()]);
    
    if (caught) {
      // Update player catches and deduct pokebucks
      const updatePlayer = env.db.prepare(`
        UPDATE players 
        SET catches = catches + 1, pokebucks = pokebucks - 500
        WHERE userid = ?
      `);
      updatePlayer.run([userId]);
      
      // Add pokemon to collection
      const insertPokemon = env.db.prepare(`
        INSERT INTO pokemon_collection (userid, species, level, caught_at)
        VALUES (?, ?, ?, ?)
      `);
      insertPokemon.run([userId, species, level, Date.now()]);
    }
    
    return { encounterId: encounterResult.lastInsertRowid, caught };
  },
  
  // Transfer pokemon between players
  tradePokemon: (
    data: [string, string, number], 
    env: TransactionEnvironment
  ) => {
    const [fromUser, toUser, pokemonId] = data;
    
    // Verify ownership
    const checkOwnership = env.db.prepare(`
      SELECT id FROM pokemon_collection 
      WHERE id = ? AND userid = ?
    `);
    const pokemon = checkOwnership.get([pokemonId, fromUser]);
    
    if (!pokemon) {
      return { error: 'Pokemon not found or not owned by user' };
    }
    
    // Transfer ownership
    const transfer = env.db.prepare(`
      UPDATE pokemon_collection 
      SET userid = ?, traded_at = ?
      WHERE id = ?
    `);
    transfer.run([toUser, Date.now(), pokemonId]);
    
    return { success: true, pokemonId };
  }
};

// Pre-compiled prepared statements
export const statements = {
  'SELECT * FROM players WHERE userid = ?': `
    SELECT * FROM players WHERE userid = ?
  `,
  'UPDATE players SET catches = catches + 1 WHERE userid = ?': `
    UPDATE players SET catches = catches + 1 WHERE userid = ?
  `,
  'GET_PLAYER_POKEMON': `
    SELECT * FROM pokemon_collection 
    WHERE userid = ? 
    ORDER BY caught_at DESC
  `
};

// Database initialization and migrations
export function onDatabaseStart(db: Database) {
  console.log('Initializing Safari Zone database...');
  
  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS players (
      userid TEXT PRIMARY KEY,
      catches INTEGER DEFAULT 0,
      pokebucks INTEGER DEFAULT 1000,
      last_encounter INTEGER,
      level INTEGER DEFAULT 1,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );
    
    CREATE TABLE IF NOT EXISTS encounters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userid TEXT,
      species TEXT,
      level INTEGER,
      caught BOOLEAN DEFAULT FALSE,
      ball_type TEXT DEFAULT 'safari',
      timestamp INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (userid) REFERENCES players(userid)
    );
    
    CREATE TABLE IF NOT EXISTS pokemon_collection (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userid TEXT,
      species TEXT,
      level INTEGER,
      caught_at INTEGER,
      traded_at INTEGER,
      FOREIGN KEY (userid) REFERENCES players(userid)
    );
  `);
  
  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_players_catches ON players(catches);
    CREATE INDEX IF NOT EXISTS idx_encounters_userid ON encounters(userid);
    CREATE INDEX IF NOT EXISTS idx_encounters_species ON encounters(species);
    CREATE INDEX IF NOT EXISTS idx_collection_userid ON pokemon_collection(userid);
  `);
  
  // Data migrations
  const version = db.pragma('user_version', { simple: true }) as number;
  
  if (version < 1) {
    // Migration 1: Add level column to players
    db.exec(`
      ALTER TABLE players ADD COLUMN level INTEGER DEFAULT 1;
      PRAGMA user_version = 1;
    `);
    console.log('Applied migration 1: Added level column');
  }
  
  if (version < 2) {
    // Migration 2: Add ball_type to encounters
    db.exec(`
      ALTER TABLE encounters ADD COLUMN ball_type TEXT DEFAULT 'safari';
      PRAGMA user_version = 2;
    `);
    console.log('Applied migration 2: Added ball_type column');
  }
}
```

## Advanced Usage Patterns

### Plugin Database Setup

```typescript
class SafariZonePlugin {
  private db: SQL.DatabaseManager;
  private playersTable: SQL.DatabaseTable<Player>;
  private encountersTable: SQL.DatabaseTable<Encounter>;
  
  constructor() {
    this.db = SQL(module, {
      file: 'databases/safari-zone.db',
      extension: 'safari-zone-extensions',
      processes: 2
    });
    
    this.playersTable = new SQL.DatabaseTable('players', 'userid', this.db);
    this.encountersTable = new SQL.DatabaseTable('encounters', 'id', this.db);
  }
  
  async getOrCreatePlayer(userId: string): Promise<Player> {
    let player = await this.playersTable.get('*', userId);
    if (!player) {
      await this.playersTable.insert({
        userid: userId,
        catches: 0,
        pokebucks: 1000,
        level: 1,
        last_encounter: Date.now()
      });
      player = await this.playersTable.get('*', userId);
    }
    return player!;
  }
  
  async processEncounter(userId: string, species: string, level: number, caught: boolean) {
    return this.db.transaction('processEncounter', [userId, species, level, caught]);
  }
  
  async getLeaderboard(limit = 10) {
    return this.playersTable.selectAll('*',
      SQL.SQL`ORDER BY catches DESC, pokebucks DESC LIMIT ${limit}`
    );
  }
  
  async getPlayerStats(userId: string) {
    return this.db.get<{
      catches: number;
      encounters: number;
      success_rate: number;
      favorite_pokemon: string;
    }>(`
      SELECT 
        p.catches,
        COUNT(e.id) as encounters,
        CASE WHEN COUNT(e.id) > 0 
          THEN ROUND(CAST(p.catches AS FLOAT) / COUNT(e.id) * 100, 2)
          ELSE 0 
        END as success_rate,
        (SELECT species FROM encounters 
         WHERE userid = p.userid AND caught = 1 
         GROUP BY species 
         ORDER BY COUNT(*) DESC 
         LIMIT 1) as favorite_pokemon
      FROM players p
      LEFT JOIN encounters e ON p.userid = e.userid
      WHERE p.userid = ?
      GROUP BY p.userid
    `, [userId]);
  }
}
```

### Performance Optimization

```typescript
class OptimizedDatabase {
  private db: SQL.DatabaseManager;
  private preparedStatements = new Map<string, SQL.Statement>();
  
  async prepareCommonQueries() {
    // Pre-compile frequently used queries
    const statements = {
      getPlayer: 'SELECT * FROM players WHERE userid = ?',
      updateCatches: 'UPDATE players SET catches = catches + 1, last_encounter = ? WHERE userid = ?',
      insertEncounter: 'INSERT INTO encounters (userid, species, level, caught) VALUES (?, ?, ?, ?)',
      getTopPlayers: 'SELECT * FROM players ORDER BY catches DESC LIMIT ?',
      getRecentEncounters: 'SELECT * FROM encounters WHERE userid = ? ORDER BY timestamp DESC LIMIT ?'
    };
    
    for (const [key, sql] of Object.entries(statements)) {
      const stmt = await this.db.prepare(sql);
      if (stmt) this.preparedStatements.set(key, stmt);
    }
  }
  
  async fastGetPlayer(userId: string) {
    const stmt = this.preparedStatements.get('getPlayer');
    return stmt?.get([userId]);
  }
  
  // Batch operations for better performance
  async batchInsertEncounters(encounters: Array<{userId: string, species: string, level: number, caught: boolean}>) {
    const stmt = this.preparedStatements.get('insertEncounter');
    const results = [];
    
    for (const encounter of encounters) {
      const result = await stmt?.run([encounter.userId, encounter.species, encounter.level, encounter.caught]);
      results.push(result);
    }
    
    return results;
  }
}
```

### Error Handling Strategies

```typescript
const db = SQL(module, {
  file: 'databases/safari-zone.db',
  extension: 'safari-zone-extensions',
  onError: (error, query, isParentProcess) => {
    // Log detailed error information
    console.error('Database Error:', {
      message: error.message,
      query: query,
      isParent: isParentProcess,
      stack: error.stack
    });
    
    // Handle specific error types
    if (error.message.includes('UNIQUE constraint failed')) {
      return { error: 'duplicate_entry' };
    }
    
    if (error.message.includes('no such table')) {
      console.error('Database schema not initialized!');
      return { error: 'schema_missing' };
    }
    
    if (error.message.includes('database is locked')) {
      return { error: 'database_locked', retry: true };
    }
    
    // For read queries, return null on error
    if (['get', 'all'].includes(query.type)) {
      return null;
    }
    
    // Let write queries throw for proper error handling
    return undefined;
  }
});

// Usage with error handling
async function safeGetPlayer(userId: string) {
  try {
    const result = await db.get('SELECT * FROM players WHERE userid = ?', [userId]);
    
    if (result?.error === 'database_locked') {
      // Retry logic
      await new Promise(resolve => setTimeout(resolve, 100));
      return safeGetPlayer(userId);
    }
    
    return result;
  } catch (error) {
    console.error('Failed to get player:', error);
    return null;
  }
}
```

## Type Definitions

### Core Types

```typescript
type SQLInput = string | number | null;
interface ResultRow { [k: string]: SQLInput }

interface TransactionEnvironment {
  db: sqlite.Database;
  statements: Map<string, sqlite.Statement>;
}

type DatabaseQuery = 
  | { type: 'prepare', data: string }
  | { type: 'all', data: DataType, statement: string, noPrepare?: boolean }
  | { type: 'get', data: DataType, statement: string, noPrepare?: boolean }
  | { type: 'run', data: DataType, statement: string, noPrepare?: boolean }
  | { type: 'transaction', name: string, data: DataType }
  | { type: 'exec', data: string }
  | { type: 'load-extension', data: string };
```

## Best Practices

### 1. **Use Prepared Statements for Frequent Queries**

```typescript
// Good: Prepare once, use many times
const stmt = await db.prepare('SELECT * FROM players WHERE userid = ?');
const results = await Promise.all(
  userIds.map(id => stmt.get([id]))
);

// Avoid: Re-compiling statement each time
for (const userId of userIds) {
  await db.get('SELECT * FROM players WHERE userid = ?', [userId]);
}
```

### 2. **Use Transactions for Multi-Step Operations**

```typescript
// Good: Atomic operation
const result = await db.transaction('transferPokebucks', [fromUser, toUser, amount]);

// Avoid: Non-atomic operations
await db.run('UPDATE players SET pokebucks = pokebucks - ? WHERE userid = ?', [amount, fromUser]);
await db.run('UPDATE players SET pokebucks = pokebucks + ? WHERE userid = ?', [amount, toUser]);
```

### 3. **Use SQL Template Literals for Dynamic Queries**

```typescript
// Good: Safe parameterization
const query = SQL.SQL`
  SELECT * FROM players 
  WHERE catches >= ${minCatches} 
    AND last_encounter > ${cutoff}
`;

// Avoid: String concatenation (SQL injection risk)
const unsafeQuery = `SELECT * FROM players WHERE catches >= ${minCatches}`;
```

### 4. **Use DatabaseTable for Structured Operations**

```typescript
// Good: Type-safe table operations
const playersTable = new SQL.DatabaseTable<Player>('players', 'userid', db);
await playersTable.update('alice123', { catches: 15 });

// Also good: Direct SQL when needed
await db.run('UPDATE players SET special_field = custom_function(?) WHERE userid = ?', [data, userId]);
```

### 5. **Handle Errors Appropriately**

```typescript
// Good: Specific error handling
try {
  await playersTable.insert(newPlayer);
} catch (error) {
  if (error.message.includes('UNIQUE constraint')) {
    // Player already exists, update instead
    await playersTable.update(newPlayer.userid, newPlayer);
  } else {
    throw error;
  }
}
```

## Performance Notes

- **Prepared statements are cached automatically** for better performance
- **Use transactions for multi-step operations** to ensure atomicity
- **Worker threads** handle concurrent operations without blocking
- **Indexes** should be created for frequently queried columns
- **LIMIT** clauses prevent memory issues with large result sets
- **Statement pooling** reuses compiled queries across requests

## Common Plugin Patterns

### Initialization Pattern

```typescript
export class SafariZoneDatabase {
  private static instance: SafariZoneDatabase;
  private db: SQL.DatabaseManager;
  
  private constructor() {
    this.db = SQL(module, {
      file: 'databases/safari-zone.db',
      extension: 'safari-zone-extensions'
    });
  }
  
  static getInstance(): SafariZoneDatabase {
    if (!SafariZoneDatabase.instance) {
      SafariZoneDatabase.instance = new SafariZoneDatabase();
    }
    return SafariZoneDatabase.instance;
  }
  
  // ... methods
}
```

This comprehensive API reference covers all aspects of using Pokémon Showdown's SQL module for robust, high-performance database operations in plugins. The system provides both low-level SQL access and high-level ORM functionality while maintaining type safety and excellent performance characteristics.
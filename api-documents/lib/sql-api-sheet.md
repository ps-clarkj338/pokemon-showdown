# Pokemon Showdown SQL API Usage Sheet

## Overview

The SQL module provides an async worker thread wrapper around SQLite using better-sqlite3, designed to improve concurrent performance. It includes high-level database table abstractions and SQL template string support.

## Basic Usage Pattern

```javascript
import { SQL } from './sql';

// Create database manager
const db = SQL(module, {
  file: 'database.db',
  extension: 'database-schema.js', // optional
  processes: 4 // optional worker processes
});
```

## Database Manager Setup

### `SQL(module: NodeJS.Module, options: SQLOptions & { processes?: number })`
Creates a new SQLDatabaseManager instance.

#### SQLOptions Interface
```typescript
interface SQLOptions {
  file: string;                    // Database file path
  extension?: string;              // Extension file (relative path)
  sqliteOptions?: sqlite.Options;  // better-sqlite3 options
  onError?: ErrorHandler;          // Custom error handler
}
```

```javascript
// Basic setup
const db = SQL(module, {
  file: 'data/pokemon.db'
});

// Advanced setup with workers and extensions
const db = SQL(module, {
  file: 'data/pokemon.db',
  extension: 'pokemon-schema.js',
  processes: 4, // Spawn 4 worker processes
  sqliteOptions: {
    verbose: console.log,
    fileMustExist: false
  },
  onError: (error, query, isParentProcess) => {
    console.error('Database error:', error.message);
    // Return custom error response or let it throw
  }
});
```

## Core Database Operations

### Statement Preparation

#### `prepare(statement: string): Promise<Statement | null>`
Prepares a SQL statement for reuse.

```javascript
// Prepare statement
const stmt = await db.prepare('SELECT * FROM users WHERE name = ?');

// Use prepared statement
const users = await stmt.all(['John']);
const user = await stmt.get(['Jane']);
await stmt.run(['Bob']);
```

### Query Execution

#### `query(input: DatabaseQuery): Promise<any>`
**(Fixed: Added missing method documentation)**
Core internal method that executes database queries. This method is used internally by all other database operations but can be called directly for advanced use cases.

```javascript
// Direct query usage (advanced)
const result = await db.query({
  type: 'all',
  statement: 'SELECT * FROM users WHERE active = ?',
  data: [true]
});

// This is equivalent to:
const result = await db.all('SELECT * FROM users WHERE active = ?', [true]);
```

#### `all<T>(statement: string | Statement, data?: DataType, noPrepare?: boolean): Promise<T[]>`
Execute query and return all matching rows.

```javascript
// Simple query
const users = await db.all('SELECT * FROM users');

// With parameters
const activeUsers = await db.all(
  'SELECT * FROM users WHERE active = ?', 
  [true]
);

// With prepared statement
const stmt = await db.prepare('SELECT * FROM users WHERE age > ?');
const adults = await db.all(stmt, [18]);

// Skip statement caching (use existing prepared statement)
const result = await db.all('SELECT * FROM users WHERE id = ?', [1], true);
```

#### `get<T>(statement: string | Statement, data?: DataType, noPrepare?: boolean): Promise<T>`
Execute query and return first matching row.

```javascript
// Get single user
const user = await db.get('SELECT * FROM users WHERE id = ?', [1]);

// Returns null if no match found
const missing = await db.get('SELECT * FROM users WHERE id = ?', [999]);
// missing === null

// With complex query
const userStats = await db.get(`
  SELECT u.name, COUNT(p.id) as post_count 
  FROM users u 
  LEFT JOIN posts p ON u.id = p.user_id 
  WHERE u.id = ?
`, [userId]);
```

#### `run(statement: string | Statement, data?: DataType, noPrepare?: boolean): Promise<sqlite.RunResult>`
Execute statement and return run information (changes, lastInsertRowid, etc.).

```javascript
// Insert new user
const result = await db.run(
  'INSERT INTO users (name, email) VALUES (?, ?)', 
  ['Alice', 'alice@example.com']
);
console.log(`Inserted user with ID: ${result.lastInsertRowid}`);
console.log(`${result.changes} rows affected`);

// Update users
const updateResult = await db.run(
  'UPDATE users SET active = ? WHERE last_login < ?',
  [false, Date.now() - 86400000] // Deactivate users inactive for 1 day
);
console.log(`Deactivated ${updateResult.changes} users`);

// Delete user
const deleteResult = await db.run('DELETE FROM users WHERE id = ?', [userId]);
if (deleteResult.changes === 0) {
  console.log('User not found');
}
```

### Raw SQL Execution

#### `exec(sql: string): Promise<{ changes: number }>`
Execute raw SQL (useful for schema changes, multiple statements).

```javascript
// Create tables
await db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
  );
  
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
`);

// Run migration
await db.exec(`
  ALTER TABLE users ADD COLUMN last_login INTEGER;
  UPDATE users SET last_login = created_at;
`);
```

#### `runFile(file: string): Promise<{ changes: number }>`
Execute SQL from a file.

```javascript
// Execute schema file
await db.runFile('schema/create-tables.sql');

// Execute migration
await db.runFile('migrations/001-add-indexes.sql');
```

### Transactions

#### `transaction<T>(name: string, data?: DataType): Promise<T>`
Execute a named transaction.

```javascript
// Transaction must be defined in extension file
// In pokemon-schema.js:
export const transactions = {
  transferCredits: (params, env) => {
    const { fromUserId, toUserId, amount } = params;
    const { db, statements } = env;
    
    // Get prepared statements
    const getBalance = statements.get('SELECT credits FROM users WHERE id = ?');
    const updateCredits = statements.get('UPDATE users SET credits = ? WHERE id = ?');
    
    // Check sender balance
    const sender = getBalance.get([fromUserId]);
    if (!sender || sender.credits < amount) {
      throw new Error('Insufficient credits');
    }
    
    // Get receiver
    const receiver = getBalance.get([toUserId]);
    if (!receiver) {
      throw new Error('Receiver not found');
    }
    
    // Transfer credits
    updateCredits.run([sender.credits - amount, fromUserId]);
    updateCredits.run([receiver.credits + amount, toUserId]);
    
    return { success: true, newBalance: sender.credits - amount };
  }
};

// Execute transaction
const result = await db.transaction('transferCredits', {
  fromUserId: 1,
  toUserId: 2,
  amount: 100
});
```

## Statement Class

### `Statement<R, T>` Methods
Wrapper around prepared statements with typed parameters and results.

```javascript
const stmt = await db.prepare('SELECT name, age FROM users WHERE active = ?');

// Execute and get all results
const activeUsers = await stmt.all([true]);

// Execute and get first result
const firstActive = await stmt.get([true]);

// Execute for side effects
const result = await stmt.run([true]);

// Convert to string (returns SQL)
console.log(stmt.toString()); // "SELECT name, age FROM users WHERE active = ?"
console.log(JSON.stringify(stmt)); // Same as toString()
```

## Database Table Abstraction

### `DatabaseTable<T>` Class
High-level ORM-like interface for table operations.

#### Creating Table Instances

```javascript
// Define user interface
interface User {
  id: number;
  name: string;
  email: string;
  active: boolean;
  created_at: number;
}

// Create table instance
const usersTable = new SQL.DatabaseTable<User>('users', 'id', db);

// Table is automatically registered in SQL.tables Map
console.log(SQL.tables.get('users')); // Returns the table instance
```

### Selection Operations

#### `selectAll<R>(entries: string | string[], where?: SQLStatement): Promise<R[]>`
Select multiple rows with optional WHERE clause.

```javascript
// Select all columns
const allUsers = await usersTable.selectAll('*');

// Select specific columns
const names = await usersTable.selectAll(['name', 'email']);

// With WHERE clause (requires sql-template-strings)
const activeUsers = await usersTable.selectAll('*', SQL.SQL`active = ${true}`);

// Complex WHERE with multiple conditions
const recentActiveUsers = await usersTable.selectAll(
  ['id', 'name'], 
  SQL.SQL`active = ${true} AND created_at > ${Date.now() - 86400000}`
);
```

#### `selectOne<R>(entries: string | string[], where?: SQLStatement): Promise<R | null>`
Select single row (adds LIMIT 1 automatically).

```javascript
// Get first user
const firstUser = await usersTable.selectOne('*');

// Get specific user
const user = await usersTable.selectOne('*', SQL.SQL`name = ${'Alice'}`);

// Select specific columns
const userEmail = await usersTable.selectOne(
  'email', 
  SQL.SQL`id = ${userId}`
);
```

#### `get(entries: string | string[], keyId: SQLInput): Promise<T | null>`
Select by primary key.

```javascript
// Get user by ID (primary key)
const user = await usersTable.get('*', 123);

// Get specific columns by ID
const userName = await usersTable.get('name', 123);
const userContact = await usersTable.get(['name', 'email'], 123);
```

### Modification Operations

#### `insert(colMap: Partial<T>, rest?: SQLStatement, isReplace = false): Promise<sqlite.RunResult>`
Insert new row.

```javascript
// Insert new user
const result = await usersTable.insert({
  name: 'Alice',
  email: 'alice@example.com',
  active: true
});
console.log(`New user ID: ${result.lastInsertRowid}`);

// Insert with ON CONFLICT clause
const result2 = await usersTable.insert(
  { name: 'Bob', email: 'bob@example.com' },
  SQL.SQL`ON CONFLICT(email) DO UPDATE SET name = excluded.name`
);
```

#### `replace(cols: Partial<T>, rest?: SQLStatement): Promise<sqlite.RunResult>`
Replace row (INSERT OR REPLACE).

```javascript
// Replace user (updates if exists, inserts if not)
await usersTable.replace({
  id: 123,
  name: 'Alice Updated',
  email: 'alice.new@example.com'
});
```

#### `update(primaryKey: SQLInput, data: Partial<T>): Promise<sqlite.RunResult>`
Update row by primary key.

```javascript
// Update user
const result = await usersTable.update(123, {
  name: 'Alice Smith',
  active: false
});

if (result.changes === 0) {
  console.log('User not found');
}
```

#### `updateAll(toParams: Partial<T>, where?: SQLStatement, limit?: number): Promise<sqlite.RunResult>`
Update multiple rows.

```javascript
// Deactivate all inactive users
await usersTable.updateAll(
  { active: false },
  SQL.SQL`last_login < ${Date.now() - 2592000000}` // 30 days ago
);

// Update with limit
await usersTable.updateAll(
  { status: 'migrated' },
  SQL.SQL`created_at < ${oldDate}`,
  100 // Only update 100 rows
);
```

#### `updateOne(to: Partial<T>, where?: SQLStatement): Promise<sqlite.RunResult>`
Update single row (adds LIMIT 1).

```javascript
// Update first matching user
await usersTable.updateOne(
  { last_login: Date.now() },
  SQL.SQL`email = ${'alice@example.com'}`
);
```

### Deletion Operations

#### `delete(keyEntry: SQLInput): Promise<sqlite.RunResult>`
Delete by primary key.

```javascript
// Delete user by ID
const result = await usersTable.delete(123);
if (result.changes === 0) {
  console.log('User not found');
}
```

#### `deleteOne(where: SQLStatement): Promise<sqlite.RunResult>`
Delete single row matching condition.

```javascript
// Delete specific user
await usersTable.deleteOne(SQL.SQL`email = ${'old@example.com'}`);
```

#### `deleteAll(where?: SQLStatement, limit?: number): Promise<sqlite.RunResult>`
Delete multiple rows.

```javascript
// Delete inactive users
await usersTable.deleteAll(SQL.SQL`active = ${false}`);

// Delete with limit
await usersTable.deleteAll(
  SQL.SQL`created_at < ${oldDate}`,
  50 // Only delete 50 rows
);

// Delete all rows (careful!)
await usersTable.deleteAll();
```

### Raw Query Methods

#### `run(sql: SQLStatement): Promise<{ changes: number }>`
Execute raw SQL on the table.

```javascript
// Custom update with complex logic
await usersTable.run(SQL.SQL`
  UPDATE users 
  SET rank = (
    SELECT COUNT(*) + 1 
    FROM users u2 
    WHERE u2.score > users.score
  )
`);
```

#### `all<R>(sql: SQLStatement): Promise<R[]>`
Execute raw SELECT query.

```javascript
// Complex query with JOINs
const userStats = await usersTable.all(SQL.SQL`
  SELECT u.name, COUNT(p.id) as post_count, AVG(p.score) as avg_score
  FROM users u
  LEFT JOIN posts p ON u.id = p.user_id
  WHERE u.active = ${true}
  GROUP BY u.id, u.name
  HAVING post_count > ${5}
  ORDER BY avg_score DESC
`);
```

## Extension System

Extensions allow you to define reusable database functions, transactions, and statements.

### Extension File Structure

```javascript
// database-extensions.js
export const functions = {
  // Custom SQLite functions
  calculateAge: (birthdate) => {
    return Math.floor((Date.now() - birthdate) / (365.25 * 24 * 3600 * 1000));
  },
  
  slugify: (text) => {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').trim('-');
  }
};

export const transactions = {
  // Named transactions
  createUserWithProfile: (params, { db, statements }) => {
    const { name, email, profileData } = params;
    
    // Insert user
    const userResult = statements.get('INSERT INTO users (name, email) VALUES (?, ?)').run([name, email]);
    const userId = userResult.lastInsertRowid;
    
    // Insert profile
    statements.get('INSERT INTO profiles (user_id, data) VALUES (?, ?)').run([userId, JSON.stringify(profileData)]);
    
    return { userId, success: true };
  }
};

export const statements = {
  // Commonly used statements (will be prepared automatically)
  'SELECT * FROM users WHERE active = ?': null,
  'UPDATE users SET last_login = ? WHERE id = ?': null,
  'INSERT INTO logs (user_id, action, timestamp) VALUES (?, ?, ?)': null
};

export function onDatabaseStart(db) {
  // Run migrations, create tables, etc.
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      active BOOLEAN DEFAULT 1,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );
    
    CREATE TABLE IF NOT EXISTS profiles (
      id INTEGER PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      data TEXT
    );
  `);
  
  console.log('Database initialized');
}
```

### Loading Extensions

#### `loadExtension(filepath: string): Promise<void>`
Load extension file dynamically.

```javascript
// Load additional extensions at runtime
await db.loadExtension('user-functions.js');
```

## SQL Template Strings

The module integrates with `sql-template-strings` for safe SQL building.

### `SQL.SQL` Template Tag

```javascript
// Basic usage
const name = "Robert'; DROP TABLE users; --";
const query = SQL.SQL`SELECT * FROM users WHERE name = ${name}`;
// Safely escapes the malicious input

// Building complex queries
const buildUserQuery = (filters) => {
  const query = SQL.SQL`SELECT * FROM users WHERE 1=1`;
  
  if (filters.name) {
    query.append(SQL.SQL` AND name LIKE ${`%${filters.name}%`}`);
  }
  
  if (filters.active !== undefined) {
    query.append(SQL.SQL` AND active = ${filters.active}`);
  }
  
  if (filters.minAge) {
    query.append(SQL.SQL` AND calculateAge(birthdate) >= ${filters.minAge}`);
  }
  
  query.append(SQL.SQL` ORDER BY created_at DESC LIMIT ${filters.limit || 50}`);
  
  return query;
};

// Use with table methods
const users = await usersTable.all(buildUserQuery({ name: 'Alice', active: true }));
```

## Error Handling

### Custom Error Handler

```javascript
const db = SQL(module, {
  file: 'database.db',
  onError: (error, query, isParentProcess) => {
    // Log error details
    console.error(`Database error in ${isParentProcess ? 'parent' : 'worker'}:`);
    console.error(`Query:`, query);
    console.error(`Error:`, error.message);
    
    // For certain errors, return custom response
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return { error: 'DUPLICATE_ENTRY', field: extractField(error.message) };
    }
    
    // Return nothing to let it throw normally
    return null;
  }
});

// Usage
try {
  await usersTable.insert({ email: 'duplicate@example.com' });
} catch (error) {
  if (error.error === 'DUPLICATE_ENTRY') {
    console.log(`Duplicate ${error.field}`);
  } else {
    throw error; // Re-throw unexpected errors
  }
}
```

## Performance Considerations

### Worker Processes

```javascript
// Use multiple worker processes for heavy concurrent loads
const db = SQL(module, {
  file: 'database.db',
  processes: 4 // Spawn 4 worker processes
});
```

### Statement Caching

```javascript
// Statements are automatically cached by default
await db.all('SELECT * FROM users WHERE active = ?', [true]); // Prepared and cached
await db.all('SELECT * FROM users WHERE active = ?', [false]); // Reuses cached statement

// Skip caching when using pre-prepared statements
const stmt = await db.prepare('SELECT * FROM users WHERE id = ?');
await db.all(stmt, [123], true); // noPrepare=true, uses existing statement
```

### Connection Management

```javascript
// Database connections are managed automatically
// Worker processes each maintain their own connection
// Parent process connection is used when no workers are spawned
```

## Complete Usage Examples

### Basic CRUD Application

```javascript
// Setup
const db = SQL(module, {
  file: 'app.db',
  extension: 'app-schema.js',
  processes: 2
});

const usersTable = new SQL.DatabaseTable('users', 'id', db);

// Create user
async function createUser(userData) {
  try {
    const result = await usersTable.insert(userData);
    return { id: result.lastInsertRowid, ...userData };
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw new Error('Email already exists');
    }
    throw error;
  }
}

// Get user with posts
async function getUserWithPosts(userId) {
  const user = await usersTable.get('*', userId);
  if (!user) return null;
  
  const posts = await db.all(
    'SELECT * FROM posts WHERE user_id = ? ORDER BY created_at DESC',
    [userId]
  );
  
  return { ...user, posts };
}

// Search users
async function searchUsers(query, limit = 20) {
  return usersTable.selectAll(
    ['id', 'name', 'email'],
    SQL.SQL`name LIKE ${`%${query}%`} ORDER BY name LIMIT ${limit}`
  );
}

// Update user activity
async function updateUserActivity(userId) {
  const result = await usersTable.update(userId, {
    last_active: Date.now()
  });
  return result.changes > 0;
}
```

### Advanced Transaction Example

```javascript
// In extension file
export const transactions = {
  processOrder: (params, { db, statements }) => {
    const { userId, items, paymentInfo } = params;
    
    // Check user balance
    const user = statements.get('SELECT credits FROM users WHERE id = ?').get([userId]);
    if (!user) throw new Error('User not found');
    
    // Calculate total
    const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    if (user.credits < total) throw new Error('Insufficient credits');
    
    // Create order
    const orderResult = statements.get('INSERT INTO orders (user_id, total, status) VALUES (?, ?, ?)').run([userId, total, 'processing']);
    const orderId = orderResult.lastInsertRowid;
    
    // Add order items
    for (const item of items) {
      statements.get('INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)').run([
        orderId, item.productId, item.quantity, item.price
      ]);
      
      // Update inventory
      statements.get('UPDATE products SET stock = stock - ? WHERE id = ?').run([
        item.quantity, item.productId
      ]);
    }
    
    // Deduct credits
    statements.get('UPDATE users SET credits = credits - ? WHERE id = ?').run([total, userId]);
    
    // Log transaction
    statements.get('INSERT INTO transactions (user_id, amount, type, reference_id) VALUES (?, ?, ?, ?)').run([
      userId, -total, 'order', orderId
    ]);
    
    return { orderId, total, remainingCredits: user.credits - total };
  }
};

// Usage
const orderResult = await db.transaction('processOrder', {
  userId: 123,
  items: [
    { productId: 1, quantity: 2, price: 10.00 },
    { productId: 2, quantity: 1, price: 25.00 }
  ],
  paymentInfo: { method: 'credits' }
});
```

## Type Safety

```typescript
// Define your data models
interface User {
  id: number;
  name: string;
  email: string;
  active: boolean;
  created_at: number;
}

interface Post {
  id: number;
  user_id: number;
  title: string;
  content: string;
  created_at: number;
}

// Create typed table instances
const usersTable = new SQL.DatabaseTable<User>('users', 'id', db);
const postsTable = new SQL.DatabaseTable<Post>('posts', 'id', db);

// TypeScript will enforce types
const user: User | null = await usersTable.get('*', 123);
const posts: Post[] = await postsTable.selectAll('*', SQL.SQL`user_id = ${123}`);
```

## DatabaseQuery Interface

The `DatabaseQuery` interface defines the structure of queries sent to worker processes:

```typescript
type DatabaseQuery = 
  | { type: 'prepare', data: string }
  | { type: 'all', data: DataType, statement: string, noPrepare?: boolean }
  | { type: 'exec', data: string }
  | { type: 'get', data: DataType, statement: string, noPrepare?: boolean }
  | { type: 'run', data: DataType, statement: string, noPrepare?: boolean }
  | { type: 'transaction', name: string, data: DataType }
  | { type: 'start', options: SQLOptions }
  | { type: 'load-extension', data: string };
```

This interface is used internally by the `query` method to communicate with worker processes and execute database operations.
# Pokémon Showdown `lib/utils.ts` - Complete API Reference

## Overview

The `lib/utils.ts` module provides essential utility functions used throughout Pokémon Showdown. These are dependency-free, general-purpose functions designed for wide reuse across different projects and components.

## Basic Usage

```typescript
import { Utils } from '../lib/utils';

// Or import specific functions
import { escapeHTML, shuffle, levenshtein } from '../lib/utils';
```

## String Processing & Safety

### `getString(str: any): string`

**⭐ Critical for safety** - Safely converts any value to string without crashing.

```typescript
Utils.getString("hello");           // "hello"
Utils.getString(42);               // "42"
Utils.getString(null);             // ""
Utils.getString(undefined);        // ""
Utils.getString({toString: "not a function"}); // ""

// Safe for untrusted JSON data
const userInput = JSON.parse(untrustedData);
const safeName = Utils.getString(userInput.name);
```

### `escapeHTML(str: string | number): string`

**⭐ Essential for XSS prevention** - Escapes HTML entities for safe display.

```typescript
Utils.escapeHTML('<script>alert("xss")</script>');
// "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;"

Utils.escapeHTML('User "Name" & <tag>');
// "User &quot;Name&quot; &amp; &lt;tag&gt;"

Utils.escapeHTML('Path/to/file\nNew line');
// "Path&#x2f;to&#x2f;file<br />New line"
```

**What it escapes:**
- `&` → `&amp;`
- `<` → `&lt;` 
- `>` → `&gt;`
- `"` → `&quot;`
- `'` → `&apos;`
- `/` → `&#x2f;`
- `\n` → `<br />`

### `stripHTML(htmlContent: string): string`

Remove HTML tags from string.

```typescript
Utils.stripHTML('<b>Bold</b> <i>italic</i> text');
// "Bold italic text"

Utils.stripHTML('<div class="message">Hello <span>World</span></div>');
// "Hello World"
```

### `escapeRegex(str: string): string`

Escape special regex characters for literal matching.

```typescript
Utils.escapeRegex('Hello [world] (test)');
// "Hello \\[world\\] \\(test\\)"

const userSearch = Utils.escapeRegex(userInput);
const regex = new RegExp(userSearch, 'i');
```

### `forceWrap(text: string): string`

Force word wrapping by inserting zero-width break characters in long words.

```typescript
Utils.forceWrap('verylongwordwithoutspaces'); 
// Inserts U+200B characters to allow wrapping
```

### `escapeHTMLForceWrap(text: string): string`

Combines `escapeHTML` and `forceWrap`, replacing U+200B with `<wbr />`.

```typescript
Utils.escapeHTMLForceWrap('verylongword<script>alert("xss")</script>');
// Escaped HTML with <wbr /> tags for wrapping
```

## Template String Processing

### `html(strings: TemplateStringsArray, ...args: any[]): string`

**⭐ Recommended for HTML generation** - Template tag function with automatic HTML escaping.

```typescript
const username = '<script>evil</script>';
const level = 50;

const safeHTML = Utils.html`
  <div class="pokemon-info">
    <h3>Trainer: ${username}</h3>
    <p>Level: ${level}</p>
  </div>
`;
// HTML with username automatically escaped
```

## Array Manipulation

### `shuffle<T>(arr: T[]): T[]`

**⭐ In-place Fisher-Yates shuffle** - Shuffles array randomly and returns it.

```typescript
const pokemon = ['Pikachu', 'Charizard', 'Blastoise', 'Venusaur'];
Utils.shuffle(pokemon);
console.log(pokemon); // Randomly ordered

// For Safari Zone encounters
const availableEncounters = ['Nidoran♂', 'Nidoran♀', 'Paras', 'Venonat'];
const shuffledEncounters = Utils.shuffle([...availableEncounters]);
```

### `randomElement<T>(arr: T[]): T`

Pick a random element from array.

```typescript
const starters = ['Bulbasaur', 'Charmander', 'Squirtle'];
const randomStarter = Utils.randomElement(starters);

// Safari Zone random encounter
const wildPokemon = Utils.randomElement(zoneEncounters);
```

### `sortBy<T>(array: T[], callback?: (a: T) => Comparable): T[]`

**⭐ Smart sorting** - Sorts using PS's comparison system.

```typescript
// Sort numbers (regular sort fails on numbers)
Utils.sortBy([10, 2, 30, 1]); // [1, 2, 10, 30]

// Sort by property
const players = [
  {name: 'Alice', score: 150},
  {name: 'Bob', score: 200},
  {name: 'Charlie', score: 75}
];
Utils.sortBy(players, p => p.score); // Sorted by score ascending

// Complex sorting
Utils.sortBy(players, p => [-p.score, p.name]); // Score desc, then name asc
```

### `compare(a: Comparable, b: Comparable): number`

Smart comparison function supporting multiple types.

```typescript
Utils.compare(1, 2);           // -1 (numbers: low to high)
Utils.compare('apple', 'box'); // -1 (strings: A to Z)
Utils.compare(true, false);    // -1 (booleans: true first)
Utils.compare([1, 'a'], [1, 'b']); // -1 (arrays: lexical order)
Utils.compare({reverse: 'z'}, {reverse: 'a'}); // -1 (reverse comparison)
```

## String Operations

### `splitFirst(str: string, delimiter: string | RegExp, limit = 1): string[]`

**⭐ Better than split()** - Splits string but only on first N occurrences.

```typescript
Utils.splitFirst('cmd arg1 arg2 arg3', ' ');
// ['cmd', 'arg1 arg2 arg3'] - only split on first space

Utils.splitFirst('a|b|c|d', '|', 2);
// ['a', 'b', 'c|d'] - split on first 2 delimiters

// Perfect for command parsing
const [command, target] = Utils.splitFirst(message, ' ');
const [mainCmd, subCmd, args] = Utils.splitFirst(message, ' ', 2);
```

### `formatOrder(place: number): string`

Convert numbers to ordinal strings (1st, 2nd, 3rd, etc.).

```typescript
Utils.formatOrder(1);   // "1st"
Utils.formatOrder(2);   // "2nd" 
Utils.formatOrder(3);   // "3rd"
Utils.formatOrder(4);   // "4th"
Utils.formatOrder(11);  // "11th" (special case)
Utils.formatOrder(21);  // "21st"
Utils.formatOrder(22);  // "22nd"

// Usage in Safari Zone
const place = Utils.formatOrder(playerRank);
this.say(`You are ranked ${place} in the Safari Zone!`);
```

### `levenshtein(s: string, t: string, l?: number): number`

**⭐ String similarity** - Calculate edit distance between strings (typo detection).

```typescript
Utils.levenshtein('Pikachu', 'Pikchu');    // 1 (missing 'a')
Utils.levenshtein('Charizard', 'Charizrd'); // 1 (missing 'a')
Utils.levenshtein('Hello', 'World');       // 4
Utils.levenshtein('abc', 'def', 2);        // 2 (max distance 2)

// Pokemon name matching with typos
function findPokemon(input: string) {
  const pokemon = ['Pikachu', 'Charizard', 'Blastoise'];
  let bestMatch = '';
  let bestDistance = Infinity;
  
  for (const name of pokemon) {
    const distance = Utils.levenshtein(input.toLowerCase(), name.toLowerCase());
    if (distance < bestDistance && distance <= 2) {
      bestDistance = distance;
      bestMatch = name;
    }
  }
  
  return bestMatch;
}

findPokemon('Pikchu'); // "Pikachu"
```

## Object & Data Operations

### `deepClone(obj: any): any`

**⭐ Safe object cloning** - Creates deep copy of objects.

```typescript
const original = {
  player: 'Alice',
  pokemon: ['Pikachu', 'Charizard'],
  stats: { level: 50, hp: 200 }
};

const copy = Utils.deepClone(original);
copy.pokemon.push('Blastoise'); // Doesn't affect original

// Perfect for plugin data
const playerDataCopy = Utils.deepClone(this.playerData);
```

### `deepFreeze<T>(obj: T): T`

Recursively freeze object to prevent modifications.

```typescript
const config = Utils.deepFreeze({
  zones: ['Forest', 'Cave', 'Lake'],
  rates: { common: 0.6, rare: 0.3, legendary: 0.1 }
});

// config.zones.push('Mountain'); // Error: Cannot modify frozen object
```

## Numeric Operations

### `clampIntRange(num: any, min?: number, max?: number): number`

**⭐ Safe number clamping** - Forces value to be integer within range.

```typescript
Utils.clampIntRange(5.7);           // 5 (floor to integer)
Utils.clampIntRange(-10, 0, 100);   // 0 (clamp to min)
Utils.clampIntRange(150, 0, 100);   // 100 (clamp to max)
Utils.clampIntRange("42", 0, 100);  // 42 (convert string)
Utils.clampIntRange(null, 1, 10);   // 1 (null becomes min)

// Safari Zone usage
const safeLevel = Utils.clampIntRange(userInput.level, 1, 100);
const catchRate = Utils.clampIntRange(calculatedRate, 0, 255);
```

### `parseExactInt(str: string): number`

**⭐ Strict integer parsing** - Returns NaN if string isn't a normalized integer.

```typescript
Utils.parseExactInt('42');     // 42
Utils.parseExactInt('-17');    // -17
Utils.parseExactInt('007');    // NaN (not normalized)
Utils.parseExactInt('42.0');   // NaN (not an integer)
Utils.parseExactInt('42x');    // NaN (extra characters)

// Validate user input
const userLevel = Utils.parseExactInt(input);
if (!isNaN(userLevel)) {
  // Valid integer input
}
```

## Advanced Utilities

### `visualize(value: any, depth = 0): string`

**⭐ Debug-friendly object display** - Better than JSON.stringify for debugging.

```typescript
Utils.visualize({ name: 'Alice', pokemon: ['Pikachu'] });
// "{name: \"Alice\", pokemon: [\"Pikachu\"]}"

Utils.visualize(new Set(['a', 'b', 'c']));
// "Set (3) { a, b, c }"

Utils.visualize(new Map([['key', 'value']]));
// "Map (1) { \"key\" => \"value\" }"

// Great for debugging plugin state
console.log('Current state:', Utils.visualize(this.gameState));
```

## Binary/Hex Operations

### `bufFromHex(hex: string): Uint8Array`

Convert hex string to buffer.

```typescript
const buffer = Utils.bufFromHex('48656c6c6f');
// Uint8Array representing "Hello"
```

### `bufReadHex(buf: Uint8Array, start = 0, end?: number): string`

Read buffer as hex string.

```typescript
const hex = Utils.bufReadHex(buffer);
// "48656c6c6f"
```

### `bufWriteHex(buf: Uint8Array, hex: string, offset = 0): void`

Write hex string to buffer at offset.

```typescript
const buffer = new Uint8Array(10);
Utils.bufWriteHex(buffer, '48656c6c6f', 0);
```

## SQL Utilities

### `formatSQLArray(arr: unknown[], args?: unknown[]): string`

Format array for SQL IN clauses.

```typescript
const playerIds = ['alice', 'bob', 'charlie'];
const placeholders = Utils.formatSQLArray(playerIds, sqlArgs);
// Returns "?, ?, ?" and adds values to sqlArgs

const query = `SELECT * FROM players WHERE id IN (${placeholders})`;
```

## Advanced Data Structures

### `Multiset<T> extends Map<T, number>`

**⭐ Counter/frequency map** - Map that tracks counts automatically.

```typescript
const encounters = new Utils.Multiset<string>();

encounters.add('Pikachu');
encounters.add('Pikachu');
encounters.add('Rattata');

console.log(encounters.get('Pikachu')); // 2
console.log(encounters.get('Rattata')); // 1
console.log(encounters.get('Missing')); // 0 (safe default)

encounters.remove('Pikachu');
console.log(encounters.get('Pikachu')); // 1

// Perfect for Safari Zone statistics
class SafariZoneStats {
  private encounterCounts = new Utils.Multiset<string>();
  
  recordEncounter(species: string) {
    this.encounterCounts.add(species);
  }
  
  getEncounterRate(species: string) {
    const total = [...this.encounterCounts.values()].reduce((a, b) => a + b, 0);
    return this.encounterCounts.get(species) / total;
  }
}
```

**Methods:**
- `get(key)` - Returns count (0 if not found)
- `add(key)` - Increment count by 1
- `remove(key)` - Decrement count by 1 (auto-deletes at 0)
- `set(key, value)` - Set specific count
- `delete(key)` - Remove key entirely

## Async Utilities

### `waitUntil(time: number): Promise<void>`

Wait until specific timestamp.

```typescript
// Wait until specific time
const targetTime = Date.now() + 5000; // 5 seconds from now
await Utils.waitUntil(targetTime);

// Safari Zone timed events
const eventEndTime = Date.now() + (30 * 60 * 1000); // 30 minutes
await Utils.waitUntil(eventEndTime);
```

## Module Management

### `clearRequireCache(options?: { exclude?: string[] }): void`

Clear Node.js require cache (for hot-reloading).

```typescript
Utils.clearRequireCache(); // Clear all except node_modules

Utils.clearRequireCache({ 
  exclude: ['critical-module.js', 'database-connector.js'] 
});

// Common usage in development
if (process.env.NODE_ENV === 'development') {
  Utils.clearRequireCache();
  // Reload modules
}
```

### `uncacheModuleTree(mod: NodeJS.Module, excludes: string[]): void`

Lower-level cache clearing for specific modules.

## Common Usage Patterns

### Command Processing

```typescript
function parseCommand(message: string) {
  // Split command from arguments
  const [cmd, rest] = Utils.splitFirst(message, ' ');
  const [subcmd, args] = Utils.splitFirst(rest, ' ');
  
  return {
    command: cmd.toLowerCase(),
    subcommand: subcmd.toLowerCase(), 
    arguments: args
  };
}

// Usage
const parsed = parseCommand('/safari catch Pikachu with Great Ball');
// { command: '/safari', subcommand: 'catch', arguments: 'Pikachu with Great Ball' }
```

### Safe Data Display

```typescript
function displayPlayerInfo(player: any) {
  const safeName = Utils.escapeHTML(Utils.getString(player.name));
  const safeMessage = Utils.escapeHTML(Utils.getString(player.lastMessage));
  
  return Utils.html`
    <div class="player-card">
      <h3>${safeName}</h3>
      <p>Last seen: ${safeMessage}</p>
      <p>Rank: ${Utils.formatOrder(player.rank)}</p>
    </div>
  `;
}
```

### Fuzzy Search Implementation

```typescript
class PokemonSearch {
  private pokemonList = ['Pikachu', 'Charizard', 'Blastoise', 'Venusaur'];
  
  findBestMatch(query: string, maxDistance = 2) {
    query = query.toLowerCase();
    let bestMatch = '';
    let bestDistance = Infinity;
    
    for (const pokemon of this.pokemonList) {
      const distance = Utils.levenshtein(query, pokemon.toLowerCase(), maxDistance);
      if (distance <= maxDistance && distance < bestDistance) {
        bestDistance = distance;
        bestMatch = pokemon;
      }
    }
    
    return bestMatch;
  }
}

const search = new PokemonSearch();
search.findBestMatch('Pikchu');  // "Pikachu"
search.findBestMatch('Charizrd'); // "Charizard"
```

### Configuration Management

```typescript
class SafariConfig {
  private config: any;
  
  async loadConfig() {
    const rawData = await FS('config/safari.json').readIfExists();
    if (rawData) {
      try {
        this.config = JSON.parse(rawData);
        return Utils.deepFreeze(Utils.deepClone(this.config));
      } catch (e) {
        console.error('Invalid config JSON:', e);
      }
    }
    return this.getDefaultConfig();
  }
  
  private getDefaultConfig() {
    return Utils.deepFreeze({
      zones: ['Forest', 'Cave', 'Lake'],
      encounterRates: { common: 60, rare: 30, legendary: 10 },
      maxLevel: 50
    });
  }
  
  validateNumericInput(input: string, min: number, max: number) {
    const num = Utils.parseExactInt(input);
    if (isNaN(num)) return null;
    return Utils.clampIntRange(num, min, max);
  }
}
```

### Random Selection with Weights

```typescript
function weightedRandom<T>(items: T[], weights: number[]): T {
  const shuffled = Utils.shuffle([...items]);
  // Use first item after shuffle as simple weighted selection
  // For true weighted selection, you'd implement more complex logic
  return shuffled[0];
}

// Safari Zone encounter selection
const encounters = ['Common', 'Rare', 'Legendary'];
const weights = [60, 30, 10];
const encounter = weightedRandom(encounters, weights);
```

### Data Validation Pipeline

```typescript
function validateAndSanitizeUserData(userData: any) {
  return {
    name: Utils.getString(userData.name).slice(0, 18), // PS name limit
    level: Utils.clampIntRange(userData.level, 1, 100),
    message: Utils.escapeHTML(Utils.getString(userData.message)),
    pokemon: Array.isArray(userData.pokemon) ? 
      userData.pokemon.map(p => Utils.getString(p)).filter(Boolean) : []
  };
}
```

## Type Definitions

### `Comparable`

Type used by comparison functions:

```typescript
type Comparable = 
  | number 
  | string 
  | boolean 
  | Comparable[] 
  | { reverse: Comparable };
```

## Performance Notes

- **`shuffle()`** - Modifies array in-place (O(n))
- **`levenshtein()`** - O(n*m) complexity, use max distance limit for performance
- **`deepClone()`** - Can be expensive on large objects
- **`visualize()`** - Includes depth limit to prevent infinite recursion

## Safety Features

1. **XSS Prevention**: `escapeHTML()` and `html` template tag
2. **Type Safety**: `getString()` handles malformed objects
3. **Memory Safety**: `deepClone()` handles circular references  
4. **Crash Prevention**: All functions handle edge cases gracefully
5. **Input Validation**: `parseExactInt()` and `clampIntRange()` for user input

## Common Plugin Patterns

### Chat Command Handler

```typescript
export const commands: ChatCommands = {
  safari(target, room, user) {
    const [subcmd, rest] = Utils.splitFirst(target, ' ');
    
    switch (subcmd) {
      case 'catch':
        const pokemon = Utils.getString(rest).trim();
        if (!pokemon) return this.errorReply("Specify a Pokémon to catch!");
        
        // Safe name handling
        const safeName = Utils.escapeHTML(pokemon);
        return this.sendReply(Utils.html`Attempting to catch ${safeName}...`);
        
      case 'stats':
        const stats = this.getPlayerStats(user.id);
        const rank = Utils.formatOrder(stats.rank);
        return this.sendReply(Utils.html`You are ranked ${rank} with ${stats.catches} catches!`);
    }
  }
};
```

This comprehensive API reference shows how `lib/utils.ts` provides essential building blocks for safe, robust plugin development in Pokémon Showdown.
# Pokemon Showdown Utils API Usage Sheet

## Overview

The Utils module provides miscellaneous utility functions with no dependencies, designed for use across a wide variety of projects. Functions are designed to be safe, efficient, and handle edge cases gracefully.

## Basic Usage Pattern

```javascript
import { getString, escapeHTML, sortBy, /* ... */ } from './utils';
// or
import { Utils } from './utils'; // backwards compatibility
```

## String Utilities

### Safe String Conversion

#### `getString(str: any): string`
Safely converts any value to string without risk of crashes from malformed objects.

```javascript
// Safe conversion - won't crash even with malformed objects
const safe = getString(someUntrustedData); // Returns string or ''
const safe2 = getString(null); // Returns ''
const safe3 = getString(42); // Returns '42'
const safe4 = getString("hello"); // Returns 'hello'

// Dangerous alternatives that can crash:
// `${untrustedObj}` - crashes if toString is not a function
// String(untrustedObj) - same issue
```

### HTML Processing

#### `escapeHTML(str: string | number): string`
Escapes HTML characters to prevent XSS attacks.

```javascript
const userInput = '<script>alert("xss")</script>';
const safe = escapeHTML(userInput);
// Returns: '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2f;script&gt;'

// Handles newlines too
const multiline = escapeHTML("Line 1\nLine 2");
// Returns: 'Line 1<br />Line 2'

// Handles numbers
const num = escapeHTML(42); // Returns '42'
```

#### `stripHTML(htmlContent: string): string`
Removes HTML tags from a string.

```javascript
const html = '<p>Hello <strong>world</strong>!</p>';
const text = stripHTML(html); // Returns: 'Hello world!'

const empty = stripHTML(''); // Returns: ''
```

#### `html(strings: TemplateStringsArray, ...args: any): string`
Template tag for automatic HTML escaping in template literals.

```javascript
const userInput = '<script>evil</script>';
const username = 'John & Jane';

const safeHTML = html`
  <div>
    <p>Hello ${username}!</p>
    <p>Input: ${userInput}</p>
  </div>
`;
// Automatically escapes the interpolated values
```

### Text Processing

#### `escapeRegex(str: string): string`
Escapes special regex characters in a string.

```javascript
const userPattern = 'Hello (world)';
const escaped = escapeRegex(userPattern); // 'Hello \\(world\\)'
const regex = new RegExp(escaped); // Safe to use in regex
```

#### `forceWrap(text: string): string`
Inserts zero-width spaces (U+200B) to force long words to wrap.

```javascript
const longWord = 'supercalifragilisticexpialidocious';
const wrapped = forceWrap(longWord);
// Inserts \u200B characters at strategic points for wrapping
```

#### `escapeHTMLForceWrap(text: string): string`
Combines HTML escaping with force wrapping, using `<wbr />` tags.

```javascript
const longCode = 'veryLongVariableNameThatShouldWrap';
const result = escapeHTMLForceWrap(longCode);
// HTML-safe with <wbr /> tags for wrapping instead of \u200B
```

#### `splitFirst(str: string, delimiter: string | RegExp, limit = 1): string[]`
Like string.split(), but only splits on the first N occurrences of the delimiter.

```javascript
// Standard split vs splitFirst
"a b c d".split(" ", 2); // ['a', 'b'] - loses remaining content!

// splitFirst preserves remaining content
splitFirst("a b c d", " ", 1); // ['a', 'b c d']
splitFirst("a b c d", " ", 2); // ['a', 'b', 'c d']
splitFirst("a b c d", " ", 3); // ['a', 'b', 'c', 'd']

// Works with regex too
splitFirst("foo123bar456baz", /\d+/, 1); // ['foo', 'bar456baz']

// Always returns exactly limit + 1 elements
const [command, ...args] = splitFirst(input, " ", 2);
```

### String Analysis

#### `levenshtein(s: string, t: string, l: number): number`
Calculates Levenshtein distance between two strings with optional limit.

```javascript
const distance1 = levenshtein("kitten", "sitting", 0); // 3
const distance2 = levenshtein("hello", "world", 0); // 4

// With limit for performance (returns early if distance > limit)
const limited = levenshtein("verylongstring", "anotherlongstring", 5);
// Returns early if distance exceeds 5
```

## Formatting Utilities

#### `formatOrder(place: number): string`
Converts numbers to ordinal strings (1st, 2nd, 3rd, etc.).

```javascript
formatOrder(1); // '1st'
formatOrder(2); // '2nd'
formatOrder(3); // '3rd'
formatOrder(4); // '4th'
formatOrder(11); // '11th' (special case)
formatOrder(21); // '21st'
formatOrder(22); // '22nd'
formatOrder(23); // '23rd'
```

## Data Visualization & Debugging

#### `visualize(value: any, depth = 0): string`
Creates a readable string representation of any JavaScript value.

```javascript
// Basic types
visualize(42); // '42'
visualize("hello"); // '"hello"'
visualize(true); // 'true'
visualize(undefined); // 'undefined'
visualize(null); // 'null'

// Arrays
visualize([1, 2, 3]); // '[1, 2, 3]'
visualize([[1, 2], [3, 4]]); // '[[1, 2], [3, 4]]'

// Objects
visualize({name: "John", age: 30}); // '{name: "John", age: 30}'

// Maps and Sets
const map = new Map([['a', 1], ['b', 2]]);
visualize(map); // 'Map (2) { "a" => 1, "b" => 2 }'

const set = new Set([1, 2, 3]);
visualize(set); // 'Set (3) { 1, 2, 3 }'

// Functions and complex objects
visualize(console.log); // 'function log() { [native code] }'

// Handles circular references and depth limits
const circular = {a: 1};
circular.self = circular;
visualize(circular); // Safe handling of circular references
```

## Comparison & Sorting

### Type Comparison

#### `compare(a: Comparable, b: Comparable): number`
Smart comparator that handles different types appropriately.

```javascript
// Numbers: low to high
compare(1, 2); // -1 (1 comes before 2)
compare(5, 3); // 1 (5 comes after 3)

// Strings: alphabetical (case-insensitive)
compare("apple", "banana"); // -1
compare("zebra", "apple"); // 1

// Booleans: true-first
compare(true, false); // -1 (true comes before false)
compare(false, true); // 1

// Arrays: lexicographical
compare([1, 2], [1, 3]); // -1
compare([2, 1], [1, 9]); // 1

// Reverse wrapper
compare({reverse: "zebra"}, {reverse: "apple"}); // -1 (reversed)
compare(-5, -3); // -1 (use negative for reverse numeric sort)
```

### Array Sorting

#### `sortBy<T>(array: T[], callback?: (a: T) => Comparable): T[]`
Sorts array using the compare function, with optional transformation callback.

```javascript
// Direct sorting of comparable types
const numbers = [3, 1, 4, 1, 5];
sortBy(numbers); // [1, 1, 3, 4, 5]

const strings = ["zebra", "apple", "banana"];
sortBy(strings); // ["apple", "banana", "zebra"]

const bools = [false, true, false, true];
sortBy(bools); // [true, true, false, false]

// Sorting with transformation callback
const users = [
  {name: "John", age: 30},
  {name: "Jane", age: 25},
  {name: "Bob", age: 35}
];

// Sort by age
sortBy(users, u => u.age); // Jane(25), John(30), Bob(35)

// Sort by name
sortBy(users, u => u.name); // Bob, Jane, John

// Reverse sort by age
sortBy(users, u => -u.age); // Bob(35), John(30), Jane(25)

// Reverse sort by name
sortBy(users, u => ({reverse: u.name})); // John, Jane, Bob

// Complex multi-field sorting
sortBy(users, u => [u.department, u.age]); // Sort by dept, then age
sortBy(users, u => [u.department, {reverse: u.name}]); // Dept asc, name desc
```

## Array Utilities

#### `shuffle<T>(arr: T[]): T[]`
In-place Fisher-Yates shuffle of array.

```javascript
const deck = [1, 2, 3, 4, 5];
shuffle(deck); // Modifies original array randomly
// deck might now be [3, 1, 5, 2, 4] or any other permutation
```

#### `randomElement<T>(arr: T[]): T`
Returns a random element from the array.

```javascript
const colors = ['red', 'green', 'blue', 'yellow'];
const randomColor = randomElement(colors); // e.g., 'blue'

// Useful for random selections
const responses = ['Yes', 'No', 'Maybe'];
const answer = randomElement(responses);
```

## Number Utilities

#### `clampIntRange(num: any, min?: number, max?: number): number`
Forces a value to be an integer within specified bounds.

```javascript
clampIntRange(3.7); // 3 (floored to integer)
clampIntRange("5.2"); // 0 (non-number becomes 0)
clampIntRange(15, 1, 10); // 10 (clamped to max)
clampIntRange(-5, 1, 10); // 1 (clamped to min)
clampIntRange(7, 1, 10); // 7 (within range)

// Common use cases
const page = clampIntRange(userInput, 1, totalPages);
const level = clampIntRange(playerLevel, 1, 100);
```

#### `parseExactInt(str: string): number`
Like parseInt, but only accepts normalized integer strings.

```javascript
parseExactInt("42"); // 42
parseExactInt("-17"); // -17
parseExactInt("0"); // 0

// Rejects non-normalized forms
parseExactInt("042"); // NaN (leading zero)
parseExactInt("42.0"); // NaN (decimal point)
parseExactInt("42x"); // NaN (extra characters)
parseExactInt(" 42 "); // NaN (whitespace)

// Compare with parseInt
parseInt("042"); // 42 (accepts)
parseInt("42x"); // 42 (accepts)
parseExactInt("042"); // NaN (rejects)
parseExactInt("42x"); // NaN (rejects)
```

## Object Utilities

#### `deepClone(obj: any): any`
Creates a deep copy of an object, preserving prototype chains.

```javascript
const original = {
  name: "John",
  scores: [1, 2, 3],
  metadata: {
    created: new Date(),
    tags: ['user', 'active']
  }
};

const clone = deepClone(original);
clone.scores.push(4); // Doesn't affect original
clone.metadata.tags.push('premium'); // Doesn't affect original

// Preserves prototypes
class User {
  greet() { return `Hello, ${this.name}!`; }
}
const user = new User();
user.name = "Alice";

const clonedUser = deepClone(user);
clonedUser.greet(); // Still works - prototype preserved
```

#### `deepFreeze<T>(obj: T): T`
Recursively freezes an object and all its properties.

```javascript
const config = {
  server: {
    port: 8080,
    hosts: ['localhost', '0.0.0.0']
  },
  features: ['chat', 'battles']
};

deepFreeze(config);

// All mutation attempts will fail (in strict mode) or be ignored
config.server.port = 3000; // Ignored
config.features.push('trading'); // Ignored
config.newProp = 'value'; // Ignored

// Safe against circular references
const circular = {a: 1};
circular.self = circular;
deepFreeze(circular); // Won't infinite loop
```

## Buffer/Hex Utilities

#### `bufFromHex(hex: string): Uint8Array`
Creates a Uint8Array from a hexadecimal string.

```javascript
const buffer = bufFromHex("48656c6c6f"); // "Hello" in hex
// Returns Uint8Array with bytes [72, 101, 108, 108, 111]

const shortHex = bufFromHex("abc"); // Handles odd-length hex
// Returns Uint8Array with bytes [171, 192] (padding applied)
```

#### `bufWriteHex(buf: Uint8Array, hex: string, offset = 0): void`
Writes hexadecimal string data into an existing buffer.

```javascript
const buffer = new Uint8Array(10);
bufWriteHex(buffer, "48656c6c6f", 0); // Write "Hello" at start
bufWriteHex(buffer, "576f726c64", 5); // Write "World" at offset 5
```

#### `bufReadHex(buf: Uint8Array, start = 0, end?: number): string`
Reads buffer contents as hexadecimal string.

```javascript
const buffer = new Uint8Array([72, 101, 108, 108, 111]);
const hex = bufReadHex(buffer); // "48656c6c6f"
const partial = bufReadHex(buffer, 1, 3); // "656c" (bytes 1-2)
```

## SQL Utilities

#### `formatSQLArray(arr: unknown[], args?: unknown[]): string`
Formats an array for SQL IN clauses and optionally adds to arguments array.

```javascript
const ids = [1, 2, 3, 4, 5];
const args = ['John'];

const placeholder = formatSQLArray(ids, args);
// Returns: "?, ?, ?, ?, ?"
// args is now ['John', 1, 2, 3, 4, 5]

// Use in SQL query
const query = `SELECT * FROM users WHERE name = ? AND id IN (${placeholder})`;
// Execute with args array
```

## Advanced Data Structures

### Multiset Class

#### `class Multiset<T> extends Map<T, number>`
A Map-based multiset (bag) that counts occurrences of elements.

```javascript
const multiset = new Multiset();

// Adding elements
multiset.add('apple'); // count: 1
multiset.add('apple'); // count: 2
multiset.add('banana'); // count: 1

// Getting counts
multiset.get('apple'); // 2
multiset.get('banana'); // 1
multiset.get('orange'); // 0 (safe default)

// Removing elements
multiset.remove('apple'); // count: 1, returns true
multiset.remove('apple'); // count: 0, element deleted, returns true
multiset.remove('apple'); // element not found, returns false

// Standard Map methods work
multiset.size; // Current number of unique elements
multiset.has('banana'); // true
multiset.clear(); // Remove all elements

// Iteration works as expected
for (const [item, count] of multiset) {
  console.log(`${item}: ${count}`);
}
```

## Module Loading Utilities

#### `clearRequireCache(options?: { exclude?: string[] }): void`
Clears Node.js require cache, useful for development/hot-reloading.

```javascript
// Clear all cached modules except node_modules
clearRequireCache();

// Clear with custom exclusions
clearRequireCache({
  exclude: ['/node_modules/', '/lib/critical-module.js']
});
```

#### `uncacheModuleTree(mod: NodeJS.Module, excludes: string[]): void`
Recursively uncaches a module and its dependencies.

```javascript
// Usually used internally by clearRequireCache
// but can be used directly for specific modules
const mod = require.cache['/path/to/module.js'];
if (mod) {
  uncacheModuleTree(mod, ['/node_modules/']);
}
```

## Async Utilities

#### `waitUntil(time: number): Promise<void>`
Promise that resolves at a specific timestamp.

```javascript
// Wait until a specific time
const targetTime = Date.now() + 5000; // 5 seconds from now
await waitUntil(targetTime);
console.log('5 seconds have passed!');

// Common pattern: delay until specific time
const nextHour = Math.ceil(Date.now() / 3600000) * 3600000;
await waitUntil(nextHour);
console.log('It is now the top of the hour!');

// Different from setTimeout - waits until specific timestamp
const scheduleTime = new Date('2023-12-25 09:00:00').getTime();
await waitUntil(scheduleTime);
console.log('Merry Christmas!');
```

## Usage Examples

### Safe Data Processing
```javascript
// Process untrusted user data safely
function processUserData(data: any) {
  const name = getString(data?.name);
  const age = clampIntRange(data?.age, 0, 150);
  const bio = escapeHTML(getString(data?.bio));
  
  return { name, age, bio };
}
```

### Search with Fuzzy Matching
```javascript
function findBestMatch(query: string, options: string[]) {
  return sortBy(options, option => levenshtein(query, option, 5))
    .filter(option => levenshtein(query, option, 5) <= 3);
}
```

### Template Rendering
```javascript
function renderUserCard(user: any) {
  return html`
    <div class="user-card">
      <h3>${user.name}</h3>
      <p>Age: ${user.age}</p>
      <p>Bio: ${user.bio}</p>
    </div>
  `;
}
```

### Configuration Management
```javascript
const defaultConfig = deepFreeze({
  server: { port: 8080, host: 'localhost' },
  features: ['basic'],
  limits: { maxUsers: 100 }
});

function createUserConfig(overrides: any) {
  return deepClone({...defaultConfig, ...overrides});
}
```

## Backwards Compatibility

The module exports a `Utils` object containing all functions for backwards compatibility:

```javascript
import { Utils } from './utils';

Utils.escapeHTML('<script>'); // Same as escapeHTML('<script>')
Utils.sortBy([3,1,2]); // Same as sortBy([3,1,2])
// ... etc
```
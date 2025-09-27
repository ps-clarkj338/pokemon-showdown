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

---

## HTML Processing

### `escapeHTML(str: string | number): string`
Escapes HTML characters to prevent XSS attacks. Newline characters (`\n`) are replaced with `<br />`.

```javascript
const safe = escapeHTML(userInput); // Prevents XSS
const withNewlines = escapeHTML("Line 1\nLine 2"); // "Line 1<br />Line 2"
```

### `stripHTML(htmlContent: string): string`
Removes HTML tags from a string.

```javascript
const clean = stripHTML("<p>Hello <b>world</b></p>"); // "Hello world"
```

---

## Template Literals

### `html(strings: TemplateStringsArray, ...args: any): string`
Tagged template literal for HTML with automatic escaping of interpolated values.

```javascript
const name = "<script>alert('xss')</script>";
const html = html`<div>Hello ${name}</div>`; // Automatically escapes name
```

---

## Regex Utilities

### `escapeRegex(str: string): string`
**(Fixed: Explicit return type added)**
Escapes special regex characters in a string so it can safely be used in a RegExp.

```javascript
const userPattern = "Hello.*world?";
const escaped = escapeRegex(userPattern); // "Hello\\.\\*world\\?"
const regex = new RegExp(escaped); // Safe to use in regex
```

---

## Text Processing

### `forceWrap(text: string): string`
Inserts zero-width spaces (U+200B) for strategic word wrapping at long words.

```javascript
const wrapped = forceWrap("supercalifragilisticexpialidocious");
// Adds invisible break opportunities
```

### `escapeHTMLForceWrap(text: string): string`
Combines HTML escaping with force wrapping, using `<wbr />` tags instead of zero-width spaces.

```javascript
const safe = escapeHTMLForceWrap("verylongword<script>alert(1)</script>");
// HTML-escaped with word break opportunities
```

### `splitFirst(str: string, delimiter: string | RegExp, limit = 1): string[]`
Like `string.split`, but only splits on the first N occurrences of the delimiter.  
Returns an array of length exactly `limit + 1`.

```javascript
const parts = splitFirst("a:b:c:d", ":", 2); // ["a", "b", "c:d"]
const emailParts = splitFirst("user@domain.com", "@"); // ["user", "domain.com"]
```

---

## String Analysis

### `levenshtein(s: string, t: string, l: number): number`
**(Fixed: Description clarified for parameter `l`)**
Calculates Levenshtein distance between two strings.  
The third parameter `l` sets an optional upper limit on the distance calculation; if the distance exceeds `l`, the function returns early for performance (useful for fuzzy search where you only care if distance is within a threshold).

```javascript
const distance1 = levenshtein("kitten", "sitting", 0); // 3
const distance2 = levenshtein("hello", "world", 0); // 4
const limited = levenshtein("verylongstring", "anotherlongstring", 5); // Returns early if distance exceeds 5
```

---

## Formatting Utilities

### `formatOrder(place: number): string`
Converts numbers to ordinal strings (`1st`, `2nd`, `3rd`, etc.), handles English special cases (e.g., `11th`, `12th`, `13th`).

```javascript
formatOrder(1);  // "1st"
formatOrder(2);  // "2nd"
formatOrder(3);  // "3rd"
formatOrder(11); // "11th" (special case)
formatOrder(21); // "21st"
```

---

## Data Visualization/Debugging

### `visualize(value: any, depth = 0): string`
Creates a readable string representation of JS values, handling circular references and depth limits.

```javascript
const obj = { a: 1, b: [2, 3], c: { d: 4 } };
console.log(visualize(obj)); // "{a: 1, b: [2, 3], c: {d: 4}}"
```

---

## Comparison & Sorting

### Smart Comparison

#### `compare(a: Comparable, b: Comparable): number`
Handles a variety of types for sorting purposes. Returns negative for a < b, positive for a > b, zero for equal.

**Sorting behavior:**
- **Numbers**: Ascending (1, 2, 3...)
- **Strings**: Alphabetical using `localeCompare` (A, B, C...)
- **Booleans**: `true` values come before `false`
- **Arrays**: Element-by-element comparison
- **Objects with `reverse` property**: Reverses the comparison

```javascript
[3, 1, 2].sort(compare); // [1, 2, 3]
['c', 'a', 'b'].sort(compare); // ['a', 'b', 'c']
[false, true].sort(compare); // [true, false]
```

### Array Sorting

#### `sortBy<T>(array: T[], callback?: (a: T) => Comparable): T[]`
Sorts using `compare` with optional transformation function. Modifies array in-place and returns it.

```javascript
const users = [{name: 'Bob', age: 30}, {name: 'Alice', age: 25}];
sortBy(users, u => u.name); // Sort by name
sortBy(users, u => u.age);  // Sort by age
```

---

## Array Utilities

### `shuffle<T>(arr: T[]): T[]`
In-place Fisher-Yates shuffle of array. Modifies the original array and returns it.

```javascript
const deck = [1, 2, 3, 4, 5];
shuffle(deck); // Array is now randomly shuffled
```

### `randomElement<T>(arr: T[]): T`
Returns a random element from the array.

```javascript
const colors = ['red', 'blue', 'green'];
const random = randomElement(colors); // e.g., 'blue'
```

---

## Number Utilities

### `clampIntRange(num: any, min?: number, max?: number): number`
Forces a value to be an integer within specified bounds. Converts strings/floats to integers.

```javascript
clampIntRange(5.7);           // 5
clampIntRange(5.7, 0, 10);    // 5
clampIntRange(-5, 0, 10);     // 0
clampIntRange(15, 0, 10);     // 10
clampIntRange("abc");         // 0
```

### `parseExactInt(str: string): number`
Like `parseInt`, but only accepts strictly normalized integer strings (no leading zeros, whitespace, or extra characters).

```javascript
parseExactInt("42");    // 42
parseExactInt("042");   // NaN (leading zero)
parseExactInt(" 42");   // NaN (whitespace)
parseExactInt("42.0");  // NaN (decimal point)
```

---

## Object Utilities

### `deepClone(obj: any): any`
Creates a deep copy of any object, preserving prototype chains and handling circular references.

```javascript
const original = { a: { b: 1 } };
const copy = deepClone(original);
copy.a.b = 2; // original.a.b is still 1
```

### `deepFreeze<T>(obj: T): T`
Recursively freezes an object and its properties (safe against circular references).

```javascript
const obj = { a: { b: 1 } };
deepFreeze(obj);
// obj.a.b = 2; // TypeError in strict mode
```

---

## Buffer/Hex Utilities

### `bufFromHex(hex: string): Uint8Array`
Creates a buffer from hex string (handles odd length by padding with zero).

```javascript
const buf1 = bufFromHex("48656c6c6f"); // Buffer for "Hello"
const buf2 = bufFromHex("abc");        // Handles odd length
```

### `bufWriteHex(buf: Uint8Array, hex: string, offset = 0): void`
Writes hexadecimal string data into an existing buffer at the specified offset.

```javascript
const buf = new Uint8Array(10);
bufWriteHex(buf, "48656c6c6f", 0); // Writes "Hello" to buffer
```

### `bufReadHex(buf: Uint8Array, start = 0, end?: number): string`
Reads buffer data as hexadecimal string.

```javascript
const buf = new Uint8Array([72, 101, 108, 108, 111]);
const hex = bufReadHex(buf); // "48656c6c6f"
```

---

## SQL Utilities

### `formatSQLArray(arr: unknown[], args?: unknown[]): string`
Formats array for SQL IN clauses and optionally adds elements to args array for parameterized queries.

```javascript
const ids = [1, 2, 3];
const sql = formatSQLArray(ids); // "?, ?, ?"

// With args array for parameterized query
const args = [];
const placeholder = formatSQLArray(ids, args);
// placeholder: "?, ?, ?", args: [1, 2, 3]
```

---

## Advanced Data Structures

### `class Multiset<T> extends Map<T, number>`
A Map-based multiset (bag) that counts occurrences of elements. Supports all standard Map methods plus multiset-specific operations.

```javascript
const ms = new Multiset(['a', 'b', 'a', 'c', 'a']);
ms.get('a'); // 3
ms.get('b'); // 1
ms.get('x'); // 0 (not undefined like Map)
```

---

## Module Loading Utilities

### `clearRequireCache(options?: { exclude?: string[] }): void`
Clears Node.js require cache for hot reloading. Useful in development.

```javascript
clearRequireCache(); // Clear all
clearRequireCache({ exclude: ['fs', 'path'] }); // Exclude core modules
```

### `uncacheModuleTree(mod: NodeJS.Module, excludes: string[]): void`
Recursively uncaches a module and its dependencies.

```javascript
uncacheModuleTree(require.cache['/path/to/module.js'], ['fs']);
```

---

## Async Utilities

### `waitUntil(time: number): Promise<void>`
Promise that resolves at a specific timestamp (milliseconds since epoch).

```javascript
const future = Date.now() + 5000; // 5 seconds from now
await waitUntil(future); // Waits until that time
```

---

## Types

### `Comparable`
Union type for values that can be compared using the `compare` function.

**Type definition:**
```typescript
type Comparable = number | string | boolean | Comparable[] | { reverse: Comparable };
```

**Usage:**
- Basic types: `number`, `string`, `boolean`
- Arrays: `Comparable[]` for element-by-element comparison
- Reverse objects: `{ reverse: Comparable }` to invert comparison

---

## Backwards Compatibility

The module exports a `Utils` object containing all functions for backwards compatibility with older code.

```javascript
import { Utils } from './utils';

// All functions available on Utils object:
Utils.escapeHTML(str);
Utils.sortBy(array, callback);
Utils.getString(value);
// ... etc
```

---

## Error Handling

Most utilities are designed to be safe and handle edge cases gracefully:

- `getString()` never crashes, returns empty string for invalid inputs
- `escapeHTML()` handles null/undefined by returning empty string
- `clampIntRange()` converts invalid numbers to 0
- `parseExactInt()` returns NaN for malformed strings
- `deepClone()` and `deepFreeze()` handle circular references

This makes the utilities suitable for processing untrusted or unpredictable data inputs.
# Pokémon Showdown `lib/fs.ts` - Complete API Reference

## Overview

The `lib/fs.ts` module provides a Promise-based abstraction layer around Node.js's filesystem with PS-specific enhancements. All paths are relative to Pokémon Showdown's base directory, and operations can be disabled during testing via `Config.nofswriting`.

## Basic Usage

```typescript
import { FS } from '../lib/fs';

// Basic API pattern
const file = FS('path/to/file.txt');
await file.write('Hello World');
const content = await file.read();
```

## Constructor

### `FS(path: string): FSPath`

Creates a new FSPath instance for the given path (relative to PS base directory).

```typescript
const configFile = FS('config/config.js');
const dataFile = FS('data/formats.ts');
const pluginFile = FS('chat-plugins/safari-zone.ts');
```

## Core Properties

### `FSPath.path: string`

The absolute resolved path to the file/directory.

```typescript
const file = FS('config/rooms.json');
console.log(file.path); // /home/user/pokemon-showdown/config/rooms.json
```

## File Reading Methods

### `read(options?: AnyObject | BufferEncoding = 'utf8'): Promise<string>`

Read file content as string (UTF-8 by default).

```typescript
const content = await FS('config.json').read();
const customEncoding = await FS('file.txt').read('ascii');
const withOptions = await FS('file.txt').read({ encoding: 'utf8' });
```

### `readSync(options?: AnyObject | string = 'utf8'): string`

Synchronous version of read().

```typescript
const content = FS('config.json').readSync();
```

### `readBuffer(options?: AnyObject | BufferEncoding = {}): Promise<Buffer>`

Read file content as Buffer.

```typescript
const buffer = await FS('image.png').readBuffer();
```

### `readBufferSync(options?: AnyObject | string = {}): Buffer`

Synchronous version of readBuffer().

```typescript
const buffer = FS('image.png').readBufferSync();
```

### `readIfExists(): Promise<string>`

Read file content, return empty string if file doesn't exist.

```typescript
const content = await FS('optional-file.txt').readIfExists();
// Returns '' if file doesn't exist, content if it does
```

### `readIfExistsSync(): string`

Synchronous version of readIfExists().

```typescript
const content = FS('optional-file.txt').readIfExistsSync();
```

## File Writing Methods

### `write(data: string | Buffer, options?: AnyObject = {}): Promise<void>`

Write data to file.

```typescript
await FS('output.txt').write('Hello World');
await FS('output.txt').write(buffer);
await FS('output.txt').write('data', { mode: 0o644 });
```

### `writeSync(data: string | Buffer, options?: AnyObject = {}): void`

Synchronous version of write().

```typescript
FS('output.txt').writeSync('Hello World');
```

### `safeWrite(data: string | Buffer, options?: AnyObject = {}): Promise<void>`

**⭐ Recommended for important data**

Writes to a temporary file then renames to prevent corruption if process crashes.

```typescript
// Safely update critical configuration
await FS('config/rooms.json').safeWrite(JSON.stringify(roomData));
```

### `safeWriteSync(data: string | Buffer, options?: AnyObject = {}): void`

Synchronous version of safeWrite().

```typescript
FS('config/rooms.json').safeWriteSync(JSON.stringify(roomData));
```

### `writeUpdate(dataFetcher: () => string | Buffer, options?: AnyObject = {}): void`

**⭐ Best for frequently updated data**

Safest way to update files with in-memory state. Prevents race conditions and supports throttling.

```typescript
// Update player data with throttling
FS('config/safari-players.json').writeUpdate(() => {
  return JSON.stringify(playerData);
}, { throttle: 5000 }); // Max once per 5 seconds

// Multiple rapid calls will be batched
for (let i = 0; i < 100; i++) {
  FS('stats.json').writeUpdate(() => JSON.stringify(currentStats));
}
// Only writes once with latest data
```

**Options:**
- `throttle: number` - Minimum milliseconds between writes

### `append(data: string | Buffer, options?: AnyObject = {}): Promise<void>`

Append data to file.

```typescript
await FS('logs/battle.log').append('New battle started\n');
```

### `appendSync(data: string | Buffer, options?: AnyObject = {}): void`

Synchronous version of append().

```typescript
FS('logs/error.log').appendSync(`Error: ${error.message}\n`);
```

## File Existence & Properties

### `exists(): Promise<boolean>`

Check if file/directory exists.

```typescript
if (await FS('config/custom.json').exists()) {
  // File exists
}
```

### `existsSync(): boolean`

Synchronous version of exists().

```typescript
if (FS('config/custom.json').existsSync()) {
  // File exists
}
```

### `isFile(): Promise<boolean>`

Check if path is a file.

```typescript
if (await FS('path').isFile()) {
  // It's a file
}
```

### `isFileSync(): boolean`

Synchronous version of isFile().

### `isDirectory(): Promise<boolean>`

Check if path is a directory.

```typescript
if (await FS('config').isDirectory()) {
  // It's a directory
}
```

### `isDirectorySync(): boolean`

Synchronous version of isDirectory().

## Directory Operations

### `readdir(): Promise<string[]>`

Read directory contents.

```typescript
const files = await FS('chat-plugins').readdir();
console.log(files); // ['safari-zone.ts', 'economy.ts', ...]
```

### `readdirSync(): string[]`

Synchronous version of readdir().

```typescript
const files = FS('chat-plugins').readdirSync();
```

### `readdirIfExists(): Promise<string[]>`

Read directory contents, return empty array if doesn't exist.

```typescript
const files = await FS('optional-dir').readdirIfExists();
// Returns [] if directory doesn't exist
```

### `readdirIfExistsSync(): string[]`

Synchronous version of readdirIfExists().

### `mkdir(mode?: string | number = 0o755): Promise<void>`

Create directory.

```typescript
await FS('new-directory').mkdir();
await FS('restricted-dir').mkdir(0o700);
```

### `mkdirSync(mode?: string | number = 0o755): void`

Synchronous version of mkdir().

### `mkdirIfNonexistent(mode?: string | number = 0o755): Promise<void>`

Create directory if it doesn't exist (no error if exists).

```typescript
await FS('logs').mkdirIfNonexistent();
```

### `mkdirIfNonexistentSync(mode?: string | number = 0o755): void`

Synchronous version of mkdirIfNonexistent().

### `mkdirp(mode?: string | number = 0o755): Promise<void>`

**⭐ Recommended for nested directories**

Create directory and all parent directories if necessary.

```typescript
await FS('deep/nested/directory/structure').mkdirp();
// Creates all intermediate directories
```

### `mkdirpSync(mode?: string | number = 0o755): void`

Synchronous version of mkdirp().

```typescript
FS('config/plugins/safari-zone').mkdirpSync();
```

### `rmdir(recursive?: boolean): Promise<void>`

Remove directory.

```typescript
await FS('temp-dir').rmdir();
await FS('dir-with-contents').rmdir(true); // recursive
```

### `rmdirSync(recursive?: boolean): void`

Synchronous version of rmdir().

## File Operations

### `rename(target: string): Promise<void>`

Rename/move file.

```typescript
await FS('old-name.txt').rename('new-name.txt');
await FS('file.txt').rename('backup/file.txt');
```

### `renameSync(target: string): void`

Synchronous version of rename().

### `copyFile(dest: string): Promise<void>`

Copy file to destination.

```typescript
await FS('template.json').copyFile('config/rooms.json');
```

### `unlinkIfExists(): Promise<void>`

Delete file if it exists (no error if doesn't exist).

```typescript
await FS('temp-file.txt').unlinkIfExists();
```

### `unlinkIfExistsSync(): void`

Synchronous version of unlinkIfExists().

### `symlinkTo(target: string): Promise<void>`

Create symbolic link.

```typescript
await FS('link-name').symlinkTo('target-file.txt');
```

### `symlinkToSync(target: string): void`

Synchronous version of symlinkTo().

### `realpath(): Promise<string>`

Resolve symbolic links to real path.

```typescript
const realPath = await FS('symbolic-link').realpath();
```

### `realpathSync(): string`

Synchronous version of realpath().

## Stream Operations

### `createReadStream(): ReadStream`

Create readable stream for large files.

```typescript
const stream = FS('large-file.txt').createReadStream();
for await (const line of stream.byLine()) {
  console.log(line);
}
```

### `createWriteStream(options = {}): WriteStream`

Create writable stream.

```typescript
const writeStream = FS('output.log').createWriteStream();
writeStream.write('Log entry\n');
await writeStream.writeEnd();
```

### `createAppendStream(options?: AnyObject = {}): WriteStream`

Create append-mode writable stream.

```typescript
const appendStream = FS('log.txt').createAppendStream();
appendStream.write('New log entry\n');
```

## File Watching

### `onModify(callback: () => void): void`

Watch file for modifications.

```typescript
FS('config.json').onModify(() => {
  console.log('Config file changed!');
  reloadConfig();
});
```

### `unwatch(): void`

Stop watching file.

```typescript
FS('config.json').unwatch();
```

## Utility Methods

### `parentDir(): FSPath`

Get parent directory as FSPath.

```typescript
const file = FS('config/rooms.json');
const configDir = file.parentDir(); // Points to 'config/'
await configDir.mkdirp(); // Ensure config directory exists
```

## Special Properties & Constants

### `FS.ROOT_PATH: string`

The absolute path to Pokémon Showdown's base directory.

```typescript
console.log(FS.ROOT_PATH); // /home/user/pokemon-showdown
```

### `FS.FSPath: typeof FSPath`

Reference to the FSPath class constructor.

### `FS.FileReadStream: typeof FileReadStream`

Reference to the FileReadStream class.

## Common Usage Patterns

### Plugin Configuration Storage

```typescript
class SafariZonePlugin {
  private configFile = FS('config/chat-plugins/safari-zone.json');
  
  async loadConfig() {
    const content = await this.configFile.readIfExists();
    return content ? JSON.parse(content) : this.getDefaultConfig();
  }
  
  async saveConfig(config: any) {
    await this.configFile.parentDir().mkdirp();
    await this.configFile.safeWrite(JSON.stringify(config, null, 2));
  }
}
```

### Player Data Management

```typescript
class PlayerDataManager {
  private dataFile = FS('config/safari-players.json');
  private playerData: Map<string, any> = new Map();
  
  constructor() {
    // Auto-save with throttling
    setInterval(() => this.save(), 60000); // Save every minute
  }
  
  private save() {
    this.dataFile.writeUpdate(() => {
      return JSON.stringify(Array.from(this.playerData.entries()));
    }, { throttle: 5000 }); // Max once per 5 seconds
  }
  
  async load() {
    const content = await this.dataFile.readIfExists();
    if (content) {
      const entries = JSON.parse(content);
      this.playerData = new Map(entries);
    }
  }
}
```

### Log File Management

```typescript
class Logger {
  private logStream = FS('logs/safari-zone.log').createAppendStream();
  
  constructor() {
    // Ensure log directory exists
    FS('logs').mkdirpSync();
  }
  
  log(message: string) {
    const timestamp = new Date().toISOString();
    this.logStream.write(`[${timestamp}] ${message}\n`);
  }
  
  async rotateLogs() {
    const logFile = FS('logs/safari-zone.log');
    const backupFile = FS(`logs/safari-zone-${Date.now()}.log`);
    
    await logFile.rename(backupFile.path);
    this.logStream = logFile.createAppendStream();
  }
}
```

### Temporary File Handling

```typescript
async function processLargeData(data: any[]) {
  const tempFile = FS(`temp/processing-${Date.now()}.json`);
  
  try {
    // Create temp directory
    await tempFile.parentDir().mkdirp();
    
    // Write temporary data
    await tempFile.write(JSON.stringify(data));
    
    // Process data...
    const result = await processFile(tempFile);
    
    return result;
  } finally {
    // Clean up
    await tempFile.unlinkIfExists();
  }
}
```

### Configuration with Fallbacks

```typescript
async function getConfig(filename: string, defaultConfig: any) {
  const configFile = FS(`config/${filename}`);
  
  if (await configFile.exists()) {
    try {
      const content = await configFile.read();
      return { ...defaultConfig, ...JSON.parse(content) };
    } catch (error) {
      console.warn(`Error reading ${filename}, using defaults:`, error);
    }
  }
  
  // Save default config for future editing
  await configFile.parentDir().mkdirp();
  await configFile.safeWrite(JSON.stringify(defaultConfig, null, 2));
  
  return defaultConfig;
}
```

## Error Handling

Most methods throw standard Node.js filesystem errors. Common error codes:
- `ENOENT` - File/directory not found
- `EEXIST` - File/directory already exists
- `EACCES` - Permission denied
- `EISDIR` - Expected file but found directory
- `ENOTDIR` - Expected directory but found file

```typescript
try {
  await FS('config.json').read();
} catch (error) {
  if (error.code === 'ENOENT') {
    console.log('Config file not found, using defaults');
  } else {
    throw error; // Re-throw unexpected errors
  }
}
```

## Best Practices

1. **Use `safeWrite()` for important data** to prevent corruption
2. **Use `writeUpdate()` for frequently changing data** to prevent race conditions  
3. **Use `mkdirp()` before writing to ensure directories exist**
4. **Use `readIfExists()` for optional configuration files**
5. **Use streams for large files** to avoid memory issues
6. **Always handle ENOENT errors** for file operations
7. **Use relative paths** - all paths are relative to PS base directory
8. **Consider throttling** with `writeUpdate()` for high-frequency updates

## Configuration Awareness

The FS module respects `Config.nofswriting` - when set to `true`, all write operations become no-ops. This is used during testing to prevent filesystem modifications.

```typescript
// This does nothing if Config.nofswriting is true
await FS('file.txt').write('data');
```
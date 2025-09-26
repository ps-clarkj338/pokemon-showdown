# Pokemon Showdown FS API Usage Sheet

## Overview

The FS module is an abstraction layer around Node.js filesystem operations, providing a Promise-based API with additional safety features and Pokemon Showdown-specific optimizations.

## Basic Usage Pattern

```javascript
import { FS } from './fs';

// Primary usage pattern
FS('path/to/file.txt').read()
FS('path/to/file.txt').write('content')
```

## Constructor & Path Handling

### `FS(path: string)`
Creates a new FSPath instance. Paths are automatically resolved relative to the Pokemon Showdown root directory.

```javascript
const file = FS('data/users.json');
const config = FS('config/config.js');
```

### `parentDir()`
Returns FSPath instance for parent directory.

```javascript
const parentPath = FS('data/users/profile.json').parentDir(); // Points to 'data/users/'
```

## File Reading Operations

### Asynchronous Reading

#### `read(options?: AnyObject | BufferEncoding = 'utf8'): Promise<string>`
Read file content as string.

```javascript
// Basic usage
const content = await FS('file.txt').read();

// With encoding options
const content = await FS('file.txt').read('ascii');
const content = await FS('file.txt').read({ encoding: 'utf8' });
```

#### `readBuffer(options?: AnyObject | BufferEncoding = {}): Promise<Buffer>`
Read file content as Buffer.

```javascript
const buffer = await FS('image.png').readBuffer();
```

#### `readIfExists(): Promise<string>`
Read file content, returns empty string if file doesn't exist.

```javascript
const content = await FS('optional-config.json').readIfExists();
// Returns '' if file doesn't exist, otherwise returns file content
```

### Synchronous Reading

#### `readSync(options?: AnyObject | string = 'utf8'): string`
Synchronous file read.

```javascript
const content = FS('config.json').readSync();
const content = FS('config.json').readSync('ascii');
```

#### `readBufferSync(options?: AnyObject | string = {})`
Synchronous buffer read.

```javascript
const buffer = FS('image.png').readBufferSync();
```

#### `readIfExistsSync(): string`
Synchronous read with fallback to empty string.

```javascript
const content = FS('optional-file.txt').readIfExistsSync();
```

## File Writing Operations

### Basic Writing

#### `write(data: string | Buffer, options?: AnyObject = {}): Promise<void>`
Write data to file.

```javascript
await FS('output.txt').write('Hello World');
await FS('data.bin').write(buffer);
await FS('file.txt').write('content', { encoding: 'utf8' });
```

#### `writeSync(data: string | Buffer, options?: AnyObject = {})`
Synchronous write.

```javascript
FS('output.txt').writeSync('Hello World');
```

### Safe Writing (Atomic Operations)

#### `safeWrite(data: string | Buffer, options?: AnyObject = {}): Promise<void>`
Writes to temporary file then renames. Prevents corruption if process crashes during write.

```javascript
await FS('important-data.json').safeWrite(JSON.stringify(data));
```

#### `safeWriteSync(data: string | Buffer, options?: AnyObject = {})`
Synchronous safe write.

```javascript
FS('critical-config.json').safeWriteSync(JSON.stringify(config));
```

### Advanced Writing with Race Condition Protection

#### `writeUpdate(dataFetcher: () => string | Buffer, options?: AnyObject = {})`
Safest way to update files with in-memory state. Handles race conditions and throttling.

```javascript
// Basic usage
FS('stats.json').writeUpdate(() => JSON.stringify(getCurrentStats()));

// With throttling (max once per 5 seconds)
FS('logs.txt').writeUpdate(
  () => getCurrentLogs(),
  { throttle: 5000 }
);
```

### Appending

#### `append(data: string | Buffer, options?: AnyObject = {}): Promise<void>`
Append data to file.

```javascript
await FS('log.txt').append('New log entry\n');
```

#### `appendSync(data: string | Buffer, options?: AnyObject = {})`
Synchronous append.

```javascript
FS('debug.log').appendSync(`[${new Date()}] Debug info\n`);
```

## File Existence & Properties

#### `exists(): Promise<boolean>`
Check if file exists.

```javascript
const fileExists = await FS('config.json').exists();
```

#### `existsSync(): boolean`
Synchronous existence check.

```javascript
const fileExists = FS('config.json').existsSync();
```

#### `isFile(): Promise<boolean>`
Check if path is a file.

```javascript
const isFile = await FS('path').isFile();
```

#### `isFileSync(): boolean`
Synchronous file check.

```javascript
const isFile = FS('path').isFileSync();
```

#### `isDirectory(): Promise<boolean>`
Check if path is a directory.

```javascript
const isDir = await FS('data/').isDirectory();
```

#### `isDirectorySync(): boolean`
Synchronous directory check.

```javascript
const isDir = FS('data/').isDirectorySync();
```

## Directory Operations

### Reading Directories

#### `readdir(): Promise<string[]>`
List directory contents.

```javascript
const files = await FS('data/').readdir();
```

#### `readdirSync(): string[]`
Synchronous directory listing.

```javascript
const files = FS('data/').readdirSync();
```

#### `readdirIfExists(): Promise<string[]>`
List directory contents, returns empty array if doesn't exist.

```javascript
const files = await FS('optional-dir/').readdirIfExists();
```

#### `readdirIfExistsSync(): string[]`
Synchronous version of readdirIfExists.

```javascript
const files = FS('optional-dir/').readdirIfExistsSync();
```

### Creating Directories

#### `mkdir(mode?: string | number = 0o755): Promise<void>`
Create directory.

```javascript
await FS('new-folder').mkdir();
await FS('new-folder').mkdir(0o644);
```

#### `mkdirSync(mode?: string | number = 0o755)`
Synchronous directory creation.

```javascript
FS('new-folder').mkdirSync();
```

#### `mkdirIfNonexistent(mode?: string | number = 0o755): Promise<void>`
Create directory only if it doesn't exist.

```javascript
await FS('maybe-exists').mkdirIfNonexistent();
```

#### `mkdirIfNonexistentSync(mode?: string | number = 0o755)`
Synchronous conditional directory creation.

```javascript
FS('maybe-exists').mkdirIfNonexistentSync();
```

#### `mkdirp(mode?: string | number = 0o755): Promise<void>`
Create directory and all parent directories (like `mkdir -p`).

```javascript
await FS('deep/nested/path').mkdirp();
```

#### `mkdirpSync(mode?: string | number = 0o755)`
Synchronous recursive directory creation.

```javascript
FS('deep/nested/path').mkdirpSync();
```

### Removing Directories

#### `rmdir(recursive?: boolean): Promise<void>`
Remove directory.

```javascript
await FS('empty-dir').rmdir();
await FS('dir-with-contents').rmdir(true); // recursive
```

#### `rmdirSync(recursive?: boolean)`
Synchronous directory removal.

```javascript
FS('dir-to-remove').rmdirSync(true);
```

## File Operations

### Deletion

#### `unlinkIfExists(): Promise<void>`
Delete file if it exists (won't throw if file doesn't exist).

```javascript
await FS('temp-file.txt').unlinkIfExists();
```

#### `unlinkIfExistsSync()`
Synchronous conditional file deletion.

```javascript
FS('temp-file.txt').unlinkIfExistsSync();
```

### File System Operations

#### `copyFile(dest: string): Promise<void>`
Copy file to destination.

```javascript
await FS('source.txt').copyFile('destination.txt');
```

#### `rename(target: string): Promise<void>`
Rename/move file.

```javascript
await FS('old-name.txt').rename('new-name.txt');
```

#### `renameSync(target: string)`
Synchronous rename.

```javascript
FS('old-name.txt').renameSync('new-name.txt');
```

#### `symlinkTo(target: string): Promise<void>`
Create symbolic link.

```javascript
await FS('link-name').symlinkTo('target-file');
```

#### `symlinkToSync(target: string)`
Synchronous symbolic link creation.

```javascript
FS('link-name').symlinkToSync('target-file');
```

#### `realpath(): Promise<string>`
Get real path (resolves symbolic links).

```javascript
const realPath = await FS('maybe-symlink').realpath();
```

#### `realpathSync(): string`
Synchronous real path resolution.

```javascript
const realPath = FS('maybe-symlink').realpathSync();
```

## Streaming Operations

### Read Streams

#### `createReadStream(): FileReadStream`
Create a read stream for the file.

```javascript
const readStream = FS('large-file.txt').createReadStream();
readStream.on('data', chunk => {
  // Process chunk
});
```

### Write Streams

#### `createWriteStream(options = {}): WriteStream`
Create a write stream.

```javascript
const writeStream = FS('output.txt').createWriteStream();
writeStream.write('chunk1');
writeStream.write('chunk2');
writeStream.end();
```

#### `createAppendStream(options = {}): WriteStream`
Create an append stream.

```javascript
const appendStream = FS('log.txt').createAppendStream();
appendStream.write('New log entry\n');
```

## File Monitoring

#### `onModify(callback: () => void)`
Watch file for modifications.

```javascript
FS('config.json').onModify(() => {
  console.log('Config file was modified!');
  // Reload configuration
});
```

#### `unwatch()`
Stop watching file for modifications.

```javascript
FS('config.json').unwatch();
```

## Configuration & Special Behavior

### No-Write Mode
When `global.Config.nofswriting` is true, all write operations become no-ops. This is useful for unit testing.

### Throttling
The `writeUpdate` method supports throttling to prevent excessive writes:

```javascript
// Only write once every 30 seconds maximum
FS('frequently-updated.json').writeUpdate(
  () => JSON.stringify(data),
  { throttle: 30000 }
);
```

### Path Resolution
All paths are resolved relative to the Pokemon Showdown root directory. The module automatically detects if it's running from a `dist` directory and adjusts accordingly.

## Error Handling

Most async methods return Promises that reject on error. Sync methods throw exceptions. The module provides safe variants for common operations:

```javascript
// Safe variants that handle ENOENT errors gracefully
const content = await FS('might-not-exist.txt').readIfExists();
const files = await FS('might-not-exist/').readdirIfExists();
await FS('might-not-exist.txt').unlinkIfExists();
```

## Usage Examples

### Reading Configuration
```javascript
const config = JSON.parse(await FS('config/settings.json').readIfExists() || '{}');
```

### Atomic Data Updates
```javascript
// Safe update of user data
FS('data/users.json').writeUpdate(() => {
  return JSON.stringify(getAllUsers());
}, { throttle: 10000 });
```

### Log File Management
```javascript
// Append to daily log
const today = new Date().toISOString().split('T')[0];
await FS(`logs/${today}.log`).append(`[${new Date()}] ${message}\n`);
```

### Directory Setup
```javascript
// Ensure directory structure exists
await FS('data/cache/temp').mkdirp();
```
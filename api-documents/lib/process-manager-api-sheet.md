# Pokemon Showdown Process Manager API Usage Sheet

## Overview

The Process Manager module abstracts multiprocess logic for Pokemon Showdown, providing three types of process management:

- **QueryProcessManager**: Send discrete queries to worker processes and receive responses.
- **StreamProcessManager**: Spawn worker processes that communicate via streams for high-throughput data processing.
- **RawProcessManager**: Full control over child processes, using raw child_process or cluster.Worker APIs.

It handles worker spawning, load balancing, crash recovery, and inter-process communication.

---

## Basic Usage Patterns

```javascript
import {
  QueryProcessManager,
  StreamProcessManager,
  RawProcessManager,
  exec,
} from './process-manager';
```

### Utility Function: `exec`

```typescript
export function exec(
  args: string | [string, ...string[]],
  execOptions?: child_process.ExecOptions | child_process.ExecFileOptions
): Promise<{ stdout: string; stderr: string }>;
```

Executes a command in a child process or spawns a file. Returns a Promise resolving with `stdout` and `stderr`.

```javascript
// Run shell command
const { stdout } = await exec('ls -la');

// Run executable with args
const { stdout, stderr } = await exec(['node', 'script.js', '--flag']);
```

---

## QueryProcessManager

Manages a pool of worker processes that handle discrete input/output queries via messages.

### Constructor

```typescript
new QueryProcessManager(
  module: NodeModule,
  handler: (input: any) => any | Promise<any>,
  options?: {
    processes?: number;
    spawnArgs?: string[];
    load?: (input: any) => number; // weight function
    onWorkerCrash?: (error: Error) => void;
  }
)
```

- **`module`**: Use `module` to locate the worker script.
- **`handler`**: Function executed in each worker for incoming inputs.
- **`processes`**: Number of worker processes (default: CPU count).
- **`spawnArgs`**: Additional Node.js spawn arguments.
- **`load`**: Function to estimate work weight for balancing.
- **`onWorkerCrash`**: Callback on unexpected worker exit.

### Methods

- **`async send(input: any): Promise<any>`**
  Send a query to the least-loaded worker and await its response.

- **`shutdown(): Promise<void>`**
  Gracefully shut down all workers, waiting for in-flight requests.

**Example**:
```javascript
const queryManager = new QueryProcessManager(module, async (data) => {
  // Process data
  return processData(data);
}, { processes: 4 });

const result = await queryManager.send({ task: 'compute', payload: [1,2,3] });
await queryManager.shutdown();
```

---

## StreamProcessManager

Spawns worker processes that read from and write to Node.js streams.

### Constructor

```typescript
new StreamProcessManager(
  module: NodeModule,
  createStream: () => NodeJS.ReadWriteStream,
  options?: {
    processes?: number;
    spawnArgs?: string[];
    onWorkerCrash?: (error: Error) => void;
  }
)
```

- **`createStream`**: Factory returning a duplex stream for each worker.
- **`processes`**: Number of workers.
- **`onWorkerCrash`**: Callback on worker crash.

### Methods

- **`write(data: any): boolean`**
  Write data to the next worker’s stream. Returns false if the internal buffer is full.

- **`end(): void`**
  Close all worker streams.

**Example**:
```javascript
const streamManager = new StreamProcessManager(module, () => {
  return createProcessingStream();
}, { processes: 2 });

streamManager.write(input1);
streamManager.write(input2);
streamManager.end();
```

---

## RawProcessManager

Provides low-level control over child processes or cluster.Worker instances.

### Constructor

```typescript
new RawProcessManager({
  module: NodeModule,
  setupChild: () => NodeJS.ReadWriteStream,
  isCluster?: boolean;
  processes?: number;
  spawnArgs?: string[];
  onWorkerCrash?: (error: Error) => void;
});
```

- **`setupChild`**: Factory for child communication stream.
- **`isCluster`**: Use `cluster.fork` instead of `child_process.spawn`.
- **`processes`**, **`spawnArgs`**, **`onWorkerCrash`**: Same as above.

### Methods

- **`async send(data: any): Promise<any>`**
  Send data to a worker and await a response (requires protocol implementation).

- **`shutdown(): Promise<void>`**
  Gracefully terminate workers.

**Example**:
```javascript
const rawManager = new RawProcessManager({
  module,
  setupChild: () => createJsonRpcStream(),
  isCluster: true,
  processes: 3,
});

await rawManager.send({ method: 'doWork', params: [1,2,3] });
await rawManager.shutdown();
```

---

## Best Practices & Tips

- **Graceful Shutdown**: Always call `shutdown()` to clean up worker processes.
- **Crash Handling**: Provide `onWorkerCrash` to monitor and restart workers if necessary.
- **Load Balancing**: For `QueryProcessManager`, implement a `load` function if tasks vary significantly in cost.
- **Stream Backpressure**: Check `write()` return value and handle `drain` events.

---

## Licenses

This module is licensed under the MIT License.
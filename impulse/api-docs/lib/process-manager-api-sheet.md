# Pokemon Showdown Process Manager API Usage Sheet

## Overview

The Process Manager module abstracts multiprocess logic for Pokemon Showdown, providing three types of process management: Query-based, Stream-based, and Raw process management. It handles worker process spawning, load balancing, crash recovery, and inter-process communication.

## Basic Usage Pattern

```javascript
import { QueryProcessManager, StreamProcessManager, RawProcessManager } from './process-manager';

// Query-based processing
const queryManager = new QueryProcessManager(module, (input) => {
  // Process input and return result
  return processData(input);
});

// Stream-based processing
const streamManager = new StreamProcessManager(module, () => {
  // Return a stream for processing
  return createProcessingStream();
});

// Raw process management
const rawManager = new RawProcessManager({
  module,
  setupChild: () => createChildStream(),
  isCluster: true
});
```

## Utility Functions

### `exec(args: string | string[], execOptions?): Promise<{stderr: string, stdout: string}>`
Execute system commands with Promise-based interface.

```javascript
// Execute single command
const result = await exec('ls -la');
console.log(result.stdout);

// Execute command with arguments array
const result = await exec(['node', '--version']);
console.log(result.stdout); // Node.js version

// Execute with options
const result = await exec('pwd', { cwd: '/tmp' });
console.log(result.stdout); // /tmp

// Execute complex command
const result = await exec(['git', 'log', '--oneline', '-5'], {
  cwd: '/path/to/repo'
});
console.log(result.stdout); // Recent commits

// Handle errors
try {
  const result = await exec('nonexistent-command');
} catch (error) {
  console.error('Command failed:', error.message);
}
```

## Query Process Management

### `QueryProcessManager<T, U>` Class
Manages worker processes that handle discrete queries with input/output.

#### Constructor
```javascript
const manager = new QueryProcessManager(
  module,                    // Current module
  queryFunction,            // Function to handle queries
  timeout = 15 * 60 * 1000, // Timeout in ms (15 minutes)
  debugCallback             // Optional debug message handler
);
```

#### Basic Query Processing
```javascript
// Define query handler
function processUserData(input) {
  const { userId, action, data } = input;
  
  switch (action) {
    case 'calculate_stats':
      return calculateUserStats(userId, data);
    case 'validate_team':
      return validatePokemonTeam(data);
    case 'process_battle':
      return processBattleAction(userId, data);
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

// Create manager
const userProcessor = new QueryProcessManager(module, processUserData);

// Spawn worker processes
userProcessor.spawn(4); // Spawn 4 worker processes

// Process queries
const stats = await userProcessor.query({
  userId: 12345,
  action: 'calculate_stats',
  data: { battles: 150, wins: 120 }
});

const validation = await userProcessor.query({
  userId: 67890,
  action: 'validate_team',
  data: { pokemon: [...teamData] }
});
```

#### Advanced Query Management
```javascript
// Query with specific process
const process = userProcessor.acquire(); // Get least loaded process
const result = await userProcessor.query(inputData, process);

// Temporary process for one-off tasks
const heavyResult = await userProcessor.queryTemporaryProcess({
  action: 'heavy_computation',
  data: largeDataset
}, true); // force spawn even if disabled

// Custom timeout and error handling
const manager = new QueryProcessManager(
  module,
  processData,
  30000, // 30 second timeout
  (debugMessage) => {
    console.log('Worker debug:', debugMessage);
  }
);
```

### Process Lifecycle Management
```javascript
// Spawn processes
manager.spawn(3); // Spawn 3 workers
manager.spawnOne(); // Spawn single worker

// Process information
const process = manager.acquire(); // Get least loaded process
console.log('Process load:', process.getLoad()); // Number of pending tasks

// Respawn processes (useful for code reloading)
await manager.respawn(4); // Kill all, spawn 4 new ones

// Clean shutdown
await manager.destroy(); // Shutdown all processes
```

## Stream Process Management

### `StreamProcessManager` Class
Manages processes that handle continuous data streams.

#### Constructor and Setup
```javascript
function createDataStream() {
  return new Streams.ObjectReadWriteStream({
    async _read() {
      // Read data from source
      const data = await getNextDataChunk();
      this.push(data);
    },
    async _write(data) {
      // Process incoming data
      const result = await processStreamData(data);
      this.push(result);
    }
  });
}

const streamManager = new StreamProcessManager(
  module,
  createDataStream,
  (message) => console.log('Stream debug:', message)
);
```

#### Stream Processing
```javascript
// Spawn stream workers
streamManager.spawn(2);

// Create processing stream
const processingStream = streamManager.createStream();

// Write data to stream
await processingStream.write('data chunk 1');
await processingStream.write('data chunk 2');

// Read processed results
processingStream.on('data', (result) => {
  console.log('Processed:', result);
});

// Handle stream completion
processingStream.on('end', () => {
  console.log('Stream processing complete');
});

// Handle errors
processingStream.on('error', (error) => {
  console.error('Stream error:', error);
});

// End the stream
processingStream.writeEnd();
```

#### Real-time Data Processing Example
```javascript
function createBattleStream() {
  return new Streams.ObjectReadWriteStream({
    async _read() {
      // Stream reads battle events
    },
    async _write(battleEvent) {
      // Process battle event
      const result = processBattleEvent(battleEvent);
      if (result) {
        this.push(JSON.stringify(result));
      }
    }
  });
}

const battleProcessor = new StreamProcessManager(module, createBattleStream);
battleProcessor.spawn(3);

// Process battle events in real-time
const battleStream = battleProcessor.createStream();

battleStream.on('data', (processedEvent) => {
  const event = JSON.parse(processedEvent);
  broadcastToClients(event);
});

// Send battle events
await battleStream.write(JSON.stringify({
  type: 'move',
  user: 'player1',
  pokemon: 'Pikachu',
  move: 'Thunderbolt',
  target: 'Charizard'
}));
```

## Raw Process Management

### `RawProcessManager` Class
Most flexible process management for custom worker architectures.

#### Constructor and Setup
```javascript
function setupChildProcess() {
  // Setup child process stream
  const stream = new Streams.ObjectReadWriteStream({
    async _read() {
      // Handle incoming messages from parent
    },
    async _write(message) {
      // Process message and optionally respond
      const response = await processMessage(message);
      if (response) {
        // Send response back to parent
        process.send(response);
      }
    }
  });
  
  return stream;
}

const rawManager = new RawProcessManager({
  module,
  setupChild: setupChildProcess,
  isCluster: true, // Use cluster workers instead of child_process
  env: { NODE_ENV: 'worker' } // Environment variables for workers
});
```

#### Worker Management
```javascript
// Spawn workers
rawManager.spawn(4);

// Subscribe to worker lifecycle events
rawManager.subscribeSpawn((worker) => {
  console.log(`Worker ${worker.workerid} spawned`);
  worker.load = 0; // Initialize load tracking
});

rawManager.subscribeUnspawn((worker) => {
  console.log(`Worker ${worker.workerid} destroyed`);
});

// Access workers
rawManager.workers.forEach((worker, index) => {
  console.log(`Worker ${index}: Load ${worker.load}`);
});

// Send messages to workers
const worker = rawManager.workers[0];
await worker.stream.write('task data');
```

#### Cluster vs Child Process Workers
```javascript
// Cluster workers (shared server ports, better for HTTP servers)
const clusterManager = new RawProcessManager({
  module,
  setupChild: setupChildProcess,
  isCluster: true
});

// Child process workers (isolated processes, better for CPU-intensive tasks)
const childProcessManager = new RawProcessManager({
  module,
  setupChild: setupChildProcess,
  isCluster: false
});
```

## Process Wrapper Classes

### `QueryProcessWrapper<T, U>`
Wraps individual query-processing workers.

```javascript
// Usually managed automatically, but can be used directly
const wrapper = new QueryProcessWrapper('worker-script.js', (message) => {
  console.log('Debug message:', message);
});

// Send query
const result = await wrapper.query({ action: 'process', data: inputData });

// Check load
console.log('Pending tasks:', wrapper.getLoad());

// Clean shutdown
await wrapper.release();
```

### `StreamProcessWrapper`
Wraps individual stream-processing workers.

```javascript
const wrapper = new StreamProcessWrapper('stream-worker.js');

// Create stream
const stream = wrapper.createStream();

// Use stream for processing
await stream.write('data');
stream.on('data', (result) => {
  console.log('Stream result:', result);
});

// Clean shutdown
await wrapper.release();
```

### `RawProcessWrapper`
Wraps individual raw workers (cluster or child process).

```javascript
// Cluster worker
const clusterWrapper = new RawProcessWrapper('worker.js', true);

// Child process worker
const childWrapper = new RawProcessWrapper('worker.js', false, {
  NODE_ENV: 'worker'
});

// Access the underlying process
const process = clusterWrapper.getProcess();
console.log('Worker PID:', process.pid);

// Send raw messages
await clusterWrapper.stream.write('message');
```

## Error Handling and Crash Recovery

### Automatic Crash Recovery
```javascript
const manager = new QueryProcessManager(module, queryFunction);

// Automatic crash handling
// - Crashed processes are automatically respawned
// - Maximum 5 crashes per 30 minutes before giving up
// - Pending queries are rejected when process crashes

// Monitor crash recovery
manager.processes.forEach((process, index) => {
  process.process.on('disconnect', () => {
    console.log(`Process ${index} disconnected`);
  });
});

// Check crashed processes
console.log('Crashed processes:', manager.crashedProcesses.length);
console.log('Crash count:', manager.crashRespawnCount);
```

### Custom Error Handling
```javascript
const manager = new QueryProcessManager(
  module,
  (input) => {
    if (input.action === 'error') {
      throw new Error('Intentional error for testing');
    }
    return processData(input);
  },
  10000, // 10 second timeout
  (debugMessage) => {
    // Handle debug messages from workers
    if (debugMessage.includes('ERROR')) {
      console.error('Worker error:', debugMessage);
    }
  }
);

// Handle query timeout
try {
  const result = await manager.query({
    action: 'slow_operation',
    timeout: 5000
  });
} catch (error) {
  if (error.message.includes('took too long')) {
    console.log('Query timed out, process was respawned');
  }
}
```

## Advanced Features

### Load Balancing
```javascript
// Manual load balancing
const manager = new QueryProcessManager(module, queryFunction);
manager.spawn(4);

// Get least loaded process
const process = manager.acquire();
console.log('Selected process load:', process.getLoad());

// Query specific process
const result = await manager.query(data, process);
```

### Process Monitoring
```javascript
// Monitor all process managers
import { processManagers } from './process-manager';

setInterval(() => {
  processManagers.forEach((manager, index) => {
    console.log(`Manager ${index} (${manager.basename}):`);
    console.log(`  Active processes: ${manager.processes.length}`);
    console.log(`  Releasing processes: ${manager.releasingProcesses.length}`);
    console.log(`  Crashed processes: ${manager.crashedProcesses.length}`);
    
    manager.processes.forEach((process, pIndex) => {
      console.log(`    Process ${pIndex}: Load ${process.getLoad()}`);
    });
  });
}, 5000);
```

### Graceful Shutdown
```javascript
// Graceful shutdown of all process managers
async function gracefulShutdown() {
  console.log('Shutting down process managers...');
  
  const shutdownPromises = processManagers.map(async (manager) => {
    console.log(`Shutting down ${manager.basename}...`);
    await manager.destroy();
    console.log(`${manager.basename} shut down complete`);
  });
  
  await Promise.all(shutdownPromises);
  console.log('All process managers shut down');
}

// Handle shutdown signals
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
```

### Dynamic Process Scaling
```javascript
class AdaptiveProcessManager {
  constructor(manager, minWorkers = 1, maxWorkers = 8) {
    this.manager = manager;
    this.minWorkers = minWorkers;
    this.maxWorkers = maxWorkers;
    this.lastScaleTime = Date.now();
    
    this.startMonitoring();
  }
  
  startMonitoring() {
    setInterval(() => {
      this.scaleBasedOnLoad();
    }, 10000); // Check every 10 seconds
  }
  
  scaleBasedOnLoad() {
    const now = Date.now();
    if (now - this.lastScaleTime < 30000) return; // Cool-down period
    
    const totalLoad = this.manager.processes.reduce(
      (sum, process) => sum + process.getLoad(), 0
    );
    const avgLoad = totalLoad / this.manager.processes.length;
    const processCount = this.manager.processes.length;
    
    if (avgLoad > 5 && processCount < this.maxWorkers) {
      // Scale up
      this.manager.spawnOne();
      console.log(`Scaled up to ${processCount + 1} workers (avg load: ${avgLoad})`);
      this.lastScaleTime = now;
    } else if (avgLoad < 2 && processCount > this.minWorkers) {
      // Scale down
      const process = this.manager.processes[processCount - 1];
      this.manager.unspawnOne(process);
      console.log(`Scaled down to ${processCount - 1} workers (avg load: ${avgLoad})`);
      this.lastScaleTime = now;
    }
  }
}

// Use adaptive scaling
const manager = new QueryProcessManager(module, queryFunction);
const adaptive = new AdaptiveProcessManager(manager, 2, 8);
```

## Complete Usage Examples

### Battle Processing System
```javascript
// battle-processor.js
function createBattleProcessor(input) {
  const { battleId, action, data } = input;
  
  switch (action) {
    case 'init':
      return initializeBattle(battleId, data);
    case 'move':
      return processBattleMove(battleId, data);
    case 'switch':
      return processPokemonSwitch(battleId, data);
    case 'end':
      return endBattle(battleId, data);
    default:
      throw new Error(`Unknown battle action: ${action}`);
  }
}

const battleManager = new QueryProcessManager(module, createBattleProcessor);
battleManager.spawn(6); // 6 battle processing workers

// Process battle actions
const battleResult = await battleManager.query({
  battleId: 'battle_123',
  action: 'move',
  data: {
    player: 'player1',
    pokemon: 0,
    move: 'Thunderbolt',
    target: 1
  }
});
```

### Chat Message Processing
```javascript
function createChatStream() {
  return new Streams.ObjectReadWriteStream({
    async _write(message) {
      try {
        const processed = await processChatMessage(message);
        if (processed) {
          this.push(processed);
        }
      } catch (error) {
        console.error('Chat processing error:', error);
      }
    }
  });
}

const chatManager = new StreamProcessManager(module, createChatStream);
chatManager.spawn(3);

const chatStream = chatManager.createStream();

chatStream.on('data', (processedMessage) => {
  broadcastMessage(processedMessage);
});

// Process incoming chat messages
chatStream.write(JSON.stringify({
  user: 'trainer123',
  room: 'lobby',
  message: 'Hello everyone!',
  timestamp: Date.now()
}));
```

### Custom Worker Pool
```javascript
function setupWorker() {
  // Setup custom worker logic
  const stream = new Streams.ObjectReadWriteStream({
    async _write(task) {
      const result = await executeTask(task);
      // Send result back to parent
      process.send(`RESULT:${JSON.stringify(result)}`);
    }
  });
  
  return stream;
}

const workerPool = new RawProcessManager({
  module,
  setupChild: setupWorker,
  isCluster: false
});

workerPool.spawn(4);

// Send tasks to workers
const worker = workerPool.workers[0];
await worker.stream.write(JSON.stringify({
  type: 'data_analysis',
  data: largeDataset
}));

// Listen for results
worker.stream.on('data', (message) => {
  if (message.startsWith('RESULT:')) {
    const result = JSON.parse(message.slice(7));
    console.log('Worker result:', result);
  }
});
```

## Performance Considerations

### Process Count Guidelines
```javascript
// CPU-intensive tasks: 1 process per CPU core
const cpuProcesses = require('os').cpus().length;
const cpuManager = new QueryProcessManager(module, cpuIntensiveTask);
cpuManager.spawn(cpuProcesses);

// I/O-intensive tasks: More processes than cores
const ioManager = new QueryProcessManager(module, ioTask);
ioManager.spawn(cpuProcesses * 2);

// Memory-intensive tasks: Fewer processes
const memoryManager = new QueryProcessManager(module, memoryIntensiveTask);
memoryManager.spawn(Math.max(2, cpuProcesses / 2));
```

### Timeout Configuration
```javascript
// Short-running tasks
const quickManager = new QueryProcessManager(module, quickTask, 5000);

// Long-running tasks
const slowManager = new QueryProcessManager(module, slowTask, 5 * 60 * 1000);

// Real-time tasks (no timeout)
const realtimeManager = new QueryProcessManager(module, realtimeTask, 0);
```

### Memory Management
```javascript
// Clean up resources periodically
setInterval(async () => {
  // Respawn processes to clear memory leaks
  await manager.respawn();
  
  // Force garbage collection in workers if available
  if (global.gc) {
    manager.processes.forEach(process => {
      process.query({ action: 'gc' }); // Custom GC trigger in worker
    });
  }
}, 60 * 60 * 1000); // Every hour
```
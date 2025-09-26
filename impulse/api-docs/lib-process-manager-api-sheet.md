# Pokémon Showdown `lib/process-manager.ts` - Complete API Reference

## Overview

The `lib/process-manager.ts` module provides sophisticated multi-process orchestration for CPU-intensive tasks, streaming operations, and scalable worker management. It includes automatic crash recovery, load balancing, timeout management, and three distinct process communication patterns optimized for different use cases.

## Basic Usage

```typescript
import { QueryProcessManager, StreamProcessManager, RawProcessManager } from '../lib/process-manager';

// Query-based processing
const calculator = new QueryProcessManager(module, (data) => {
  return heavyCalculation(data);
});

const result = await calculator.query({ numbers: [1, 2, 3, 4, 5] });
```

## Core Architecture

### Process Communication Patterns

1. **Query/Response** - Request-response interactions with JSON serialization
2. **Streaming** - Bidirectional data streams for real-time processing  
3. **Raw Processing** - Low-level process control with custom protocols

## QueryProcessManager

**⭐ Most common pattern** - Request-response processing with automatic load balancing.

### Constructor

```typescript
new QueryProcessManager<InputType, OutputType>(
  module: NodeJS.Module,
  queryFunction: (input: InputType) => OutputType | Promise<OutputType>,
  timeout?: number, // Default: 15 minutes
  debugCallback?: (message: string) => any
)
```

### Basic Usage

```typescript
// Safari Zone encounter calculator
interface EncounterInput {
  zone: string;
  weather: string;
  timeOfDay: string;
  playerLevel: number;
}

interface EncounterResult {
  pokemon: string;
  level: number;
  shiny: boolean;
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
}

const encounterManager = new QueryProcessManager<EncounterInput, EncounterResult>(
  module,
  (input) => {
    // Complex encounter calculation in separate process
    return calculateEncounter(input.zone, input.weather, input.timeOfDay, input.playerLevel);
  },
  30000 // 30 second timeout
);

// Spawn worker processes
encounterManager.spawn(3); // 3 worker processes for load balancing

// Use the manager
const encounter = await encounterManager.query({
  zone: 'safari-forest',
  weather: 'rain',
  timeOfDay: 'night',
  playerLevel: 25
});

console.log(`Found ${encounter.pokemon} (Level ${encounter.level})!`);
```

### Advanced Query Usage

```typescript
class SafariZoneProcessor {
  private encounterManager: QueryProcessManager<EncounterInput, EncounterResult>;
  private statisticsManager: QueryProcessManager<StatsInput, StatsResult>;
  
  constructor() {
    // Encounter processing
    this.encounterManager = new QueryProcessManager(module, this.processEncounter, 10000);
    this.encounterManager.spawn(4); // 4 workers for high concurrency
    
    // Statistics processing  
    this.statisticsManager = new QueryProcessManager(module, this.calculateStatistics, 60000);
    this.statisticsManager.spawn(2); // 2 workers for periodic stats
  }
  
  private processEncounter = (input: EncounterInput): EncounterResult => {
    // CPU-intensive encounter logic
    const baseRates = this.getBaseRates(input.zone);
    const weatherModifier = this.getWeatherModifier(input.weather);
    const timeModifier = this.getTimeModifier(input.timeOfDay);
    
    const encounterRate = baseRates.map(rate => 
      rate * weatherModifier * timeModifier
    );
    
    const selected = this.weightedRandom(encounterRate);
    const pokemon = this.generatePokemon(selected, input.playerLevel);
    
    return {
      pokemon: pokemon.species,
      level: pokemon.level,
      shiny: Math.random() < 0.001, // 1/1000 shiny rate
      rarity: this.getRarity(selected)
    };
  };
  
  private calculateStatistics = (input: StatsInput): StatsResult => {
    // Heavy statistical analysis
    return this.runComplexStatistics(input);
  };
  
  async getEncounter(zone: string, weather: string, timeOfDay: string, playerLevel: number) {
    try {
      return await this.encounterManager.query({
        zone, weather, timeOfDay, playerLevel
      });
    } catch (error) {
      console.error('Encounter calculation failed:', error);
      return this.getFallbackEncounter();
    }
  }
  
  // Use temporary process for one-off heavy calculations
  async getSpecialEncounter(input: EncounterInput) {
    return this.encounterManager.queryTemporaryProcess(input, true);
  }
  
  async shutdown() {
    await Promise.all([
      this.encounterManager.destroy(),
      this.statisticsManager.destroy()
    ]);
  }
}
```

### Process Management

```typescript
// Spawn processes
manager.spawn(count); // Spawn specific number
manager.spawnOne(); // Spawn single process
manager.respawn(count); // Replace all processes

// Process monitoring
const load = manager.acquire()?.getLoad() || 0;
console.log(`Current process load: ${load} pending tasks`);

// Graceful shutdown
await manager.unspawn(); // Stop all processes
await manager.destroy(); // Clean up resources

// Force respawn on issues
await manager.respawn(4); // Replace all with 4 new processes
```

## StreamProcessManager

**⭐ For real-time data** - Bidirectional streaming with backpressure handling.

### Constructor

```typescript
new StreamProcessManager(
  module: NodeJS.Module,
  createStream: () => Streams.ObjectReadWriteStream<string>,
  messageCallback?: (message: string) => any
)
```

### Basic Streaming

```typescript
import { Streams } from '../lib/streams';

// Real-time battle log processor
const battleLogProcessor = new StreamProcessManager(
  module,
  () => {
    return new Streams.ObjectReadWriteStream({
      write(battleAction: string) {
        // Process battle action in real-time
        const action = JSON.parse(battleAction);
        const processed = processBattleAction(action);
        
        // Send back processed result
        this.push(JSON.stringify(processed));
      }
    });
  }
);

battleLogProcessor.spawn(2); // 2 streaming workers

// Create stream for real-time processing
const stream = battleLogProcessor.createStream();

// Send battle actions
stream.write(JSON.stringify({ type: 'move', pokemon: 'Pikachu', move: 'Thunderbolt' }));
stream.write(JSON.stringify({ type: 'switch', pokemon: 'Charizard' }));

// Read processed results
for await (const result of stream) {
  const processed = JSON.parse(result);
  console.log('Processed battle action:', processed);
}

// Clean shutdown
stream.destroy();
```

### Advanced Streaming Example

```typescript
class LiveSafariEventProcessor {
  private eventStream: StreamProcessManager;
  private activeStreams = new Set<Streams.ObjectReadWriteStream<string>>();
  
  constructor() {
    this.eventStream = new StreamProcessManager(
      module,
      () => this.createEventStream(),
      (message) => this.handleWorkerMessage(message)
    );
    this.eventStream.spawn(3);
  }
  
  private createEventStream(): Streams.ObjectReadWriteStream<string> {
    return new Streams.ObjectReadWriteStream({
      write(eventData: string) {
        try {
          const event = JSON.parse(eventData);
          const processed = this.processLiveEvent(event);
          
          // Stream back processed events
          if (processed) {
            this.push(JSON.stringify(processed));
          }
        } catch (error) {
          console.error('Event processing error:', error);
        }
      }
    });
  }
  
  private processLiveEvent(event: any) {
    switch (event.type) {
      case 'pokemon_encounter':
        return this.processEncounter(event);
      case 'catch_attempt':
        return this.processCatchAttempt(event);
      case 'zone_change':
        return this.processZoneChange(event);
      default:
        return null;
    }
  }
  
  async startLiveProcessing(): Promise<Streams.ObjectReadWriteStream<string>> {
    const stream = this.eventStream.createStream();
    this.activeStreams.add(stream);
    
    // Handle stream completion
    stream.on('end', () => {
      this.activeStreams.delete(stream);
    });
    
    return stream;
  }
  
  broadcastEvent(event: any) {
    const eventJson = JSON.stringify(event);
    
    // Send to all active streams
    for (const stream of this.activeStreams) {
      if (!stream.destroyed) {
        stream.write(eventJson);
      }
    }
  }
  
  private handleWorkerMessage(message: string) {
    // Handle debug/status messages from workers
    console.log('Worker message:', message);
  }
  
  async shutdown() {
    // Close all active streams
    const closePromises = Array.from(this.activeStreams).map(stream => 
      stream.destroy()
    );
    
    await Promise.all(closePromises);
    await this.eventStream.destroy();
  }
}
```

## RawProcessManager

**⭐ For maximum control** - Low-level process management with custom protocols.

### Constructor

```typescript
new RawProcessManager({
  module: NodeJS.Module,
  setupChild: () => Streams.ObjectReadWriteStream<string>,
  isCluster?: boolean, // Use cluster workers vs child processes
  env?: Record<string, string> // Custom environment variables
})
```

### Basic Raw Processing

```typescript
// High-performance Safari Zone simulation
const safariSimulator = new RawProcessManager({
  module,
  setupChild: () => {
    return new Streams.ObjectReadWriteStream({
      write(command: string) {
        const [action, ...args] = command.split(' ');
        
        switch (action) {
          case 'SIMULATE_ZONE':
            const result = simulateEntireZone(args[0], parseInt(args[1]));
            this.push(`SIMULATION_RESULT ${JSON.stringify(result)}`);
            break;
            
          case 'BATCH_ENCOUNTERS':
            const encounters = generateBatchEncounters(parseInt(args[0]));
            this.push(`BATCH_RESULT ${JSON.stringify(encounters)}`);
            break;
            
          case 'ANALYZE_PATTERNS':
            const patterns = analyzeEncounterPatterns(JSON.parse(args[0]));
            this.push(`PATTERN_ANALYSIS ${JSON.stringify(patterns)}`);
            break;
            
          default:
            this.push(`ERROR Unknown command: ${action}`);
        }
      }
    });
  },
  isCluster: true, // Use cluster workers for better performance
  env: {
    SAFARI_MODE: 'high_performance',
    MAX_MEMORY: '512MB'
  }
});

// Spawn cluster workers
safariSimulator.spawn(4);

// Subscribe to worker events
safariSimulator.subscribeSpawn((worker) => {
  console.log(`Safari worker ${worker.workerid} spawned`);
  
  // Listen to worker messages
  worker.stream.on('data', (message: string) => {
    const [type, ...data] = message.split(' ');
    
    switch (type) {
      case 'SIMULATION_RESULT':
        handleSimulationResult(JSON.parse(data.join(' ')));
        break;
      case 'BATCH_RESULT':
        handleBatchResult(JSON.parse(data.join(' ')));
        break;
      case 'PATTERN_ANALYSIS':
        handlePatternAnalysis(JSON.parse(data.join(' ')));
        break;
      case 'ERROR':
        console.error('Worker error:', data.join(' '));
        break;
    }
  });
});

safariSimulator.subscribeUnspawn((worker) => {
  console.log(`Safari worker ${worker.workerid} stopped`);
});

// Send commands to workers
function simulateZone(zoneName: string, playerCount: number) {
  const availableWorkers = safariSimulator.workers.filter(w => w.load < 5);
  if (availableWorkers.length === 0) {
    throw new Error('No available workers');
  }
  
  const worker = availableWorkers[0];
  worker.load++; // Track load manually
  worker.stream.write(`SIMULATE_ZONE ${zoneName} ${playerCount}`);
}

function generateBatchEncounters(count: number) {
  const worker = safariSimulator.workers[0]; // Use first worker
  worker.stream.write(`BATCH_ENCOUNTERS ${count}`);
}
```

### Cluster vs Child Process

```typescript
// Cluster workers (shared memory, better for CPU-intensive tasks)
const clusterManager = new RawProcessManager({
  module,
  setupChild: createHighPerformanceProcessor,
  isCluster: true, // Uses cluster.fork()
  env: { WORKER_TYPE: 'cluster' }
});

// Child processes (isolated memory, better for untrusted code)
const processManager = new RawProcessManager({
  module,
  setupChild: createIsolatedProcessor,
  isCluster: false, // Uses child_process.fork()
  env: { WORKER_TYPE: 'process' }
});
```

## Error Handling & Recovery

### Automatic Crash Recovery

```typescript
class ResilientSafariManager extends QueryProcessManager<any, any> {
  constructor() {
    super(module, (data) => this.processData(data), 30000);
    
    // Monitor crash recovery
    this.setupCrashMonitoring();
    this.spawn(4);
  }
  
  private setupCrashMonitoring() {
    // Monitor for process crashes
    const originalReleaseCrashed = this.releaseCrashed.bind(this);
    this.releaseCrashed = (process) => {
      console.warn(`Process ${process.getProcess().pid} crashed, respawning...`);
      
      // Custom crash handling
      this.logCrashDetails(process);
      this.notifyAdministrators(process);
      
      // Call original crash handler
      originalReleaseCrashed(process);
    };
  }
  
  private logCrashDetails(process: any) {
    console.error('Crash details:', {
      pid: process.getProcess().pid,
      load: process.getLoad(),
      debug: process.debug,
      crashTime: new Date().toISOString()
    });
  }
  
  private notifyAdministrators(process: any) {
    // Send crash notification to administrators
    // Implementation depends on your notification system
  }
  
  // Override query method to add retry logic
  async query(input: any, retries = 3): Promise<any> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await super.query(input);
      } catch (error) {
        console.warn(`Query attempt ${attempt} failed:`, error.message);
        
        if (attempt === retries) {
          throw new Error(`Query failed after ${retries} attempts: ${error.message}`);
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
}
```

### Custom Error Recovery

```typescript
class SafariZoneManager {
  private managers: Map<string, QueryProcessManager<any, any>> = new Map();
  
  createManager(name: string, processor: Function, options: any = {}) {
    const manager = new QueryProcessManager(
      module,
      processor,
      options.timeout || 30000,
      (message) => this.handleDebugMessage(name, message)
    );
    
    // Custom crash handling per manager
    const originalReleaseCrashed = manager.releaseCrashed.bind(manager);
    manager.releaseCrashed = (process) => {
      this.handleManagerCrash(name, process);
      originalReleaseCrashed(process);
    };
    
    this.managers.set(name, manager);
    manager.spawn(options.workers || 2);
    
    return manager;
  }
  
  private handleManagerCrash(managerName: string, process: any) {
    console.error(`Manager ${managerName} process crashed:`, {
      pid: process.getProcess().pid,
      load: process.getLoad()
    });
    
    // Implement custom recovery strategies
    if (managerName === 'encounter-generator') {
      this.fallbackToSimpleEncounters();
    } else if (managerName === 'statistics-processor') {
      this.pauseStatisticsCollection();
    }
  }
  
  private handleDebugMessage(managerName: string, message: string) {
    console.log(`[${managerName}] Debug:`, message);
  }
  
  async healthCheck(): Promise<Record<string, any>> {
    const health: Record<string, any> = {};
    
    for (const [name, manager] of this.managers) {
      health[name] = {
        processCount: manager.processes.length,
        releasingCount: manager.releasingProcesses.length,
        crashedCount: manager.crashedProcesses.length,
        totalLoad: manager.processes.reduce((sum, p) => sum + p.getLoad(), 0),
        crashRespawnCount: manager.crashRespawnCount,
        lastCrashTime: manager.crashTime
      };
    }
    
    return health;
  }
  
  async shutdown() {
    const shutdownPromises = Array.from(this.managers.values()).map(manager => 
      manager.destroy()
    );
    
    await Promise.all(shutdownPromises);
    this.managers.clear();
  }
}
```

## Advanced Usage Patterns

### Load Balancing and Monitoring

```typescript
class LoadBalancedProcessor {
  private manager: QueryProcessManager<any, any>;
  private metrics = {
    totalQueries: 0,
    averageResponseTime: 0,
    errorCount: 0,
    lastMinuteQueries: [] as number[]
  };
  
  constructor() {
    this.manager = new QueryProcessManager(module, this.processQuery.bind(this));
    this.setupDynamicScaling();
    this.startMetricsCollection();
  }
  
  private setupDynamicScaling() {
    // Check load every 30 seconds
    setInterval(() => {
      const currentLoad = this.getCurrentLoad();
      const targetProcesses = this.calculateOptimalProcessCount(currentLoad);
      
      if (targetProcesses > this.manager.processes.length) {
        console.log(`Scaling up to ${targetProcesses} processes`);
        this.manager.spawn(targetProcesses);
      } else if (targetProcesses < this.manager.processes.length) {
        console.log(`Scaling down to ${targetProcesses} processes`);
        const excess = this.manager.processes.length - targetProcesses;
        for (let i = 0; i < excess; i++) {
          void this.manager.unspawnOne(this.manager.processes[0]);
        }
      }
    }, 30000);
  }
  
  private getCurrentLoad(): number {
    return this.manager.processes.reduce((total, process) => 
      total + process.getLoad(), 0
    );
  }
  
  private calculateOptimalProcessCount(currentLoad: number): number {
    const avgLoadPerProcess = currentLoad / Math.max(1, this.manager.processes.length);
    
    // Target 3-5 tasks per process for optimal performance
    if (avgLoadPerProcess > 5) {
      return Math.min(8, this.manager.processes.length + 1);
    } else if (avgLoadPerProcess < 2 && this.manager.processes.length > 1) {
      return Math.max(1, this.manager.processes.length - 1);
    }
    
    return this.manager.processes.length;
  }
  
  async query(input: any): Promise<any> {
    const startTime = Date.now();
    this.metrics.totalQueries++;
    
    try {
      const result = await this.manager.query(input);
      const responseTime = Date.now() - startTime;
      this.updateMetrics(responseTime);
      return result;
    } catch (error) {
      this.metrics.errorCount++;
      throw error;
    }
  }
  
  private updateMetrics(responseTime: number) {
    // Update average response time
    const total = this.metrics.averageResponseTime * (this.metrics.totalQueries - 1);
    this.metrics.averageResponseTime = (total + responseTime) / this.metrics.totalQueries;
    
    // Track queries per minute
    const now = Date.now();
    this.metrics.lastMinuteQueries = this.metrics.lastMinuteQueries
      .filter(time => now - time < 60000);
    this.metrics.lastMinuteQueries.push(now);
  }
  
  getMetrics() {
    return {
      ...this.metrics,
      queriesPerMinute: this.metrics.lastMinuteQueries.length,
      processCount: this.manager.processes.length,
      currentLoad: this.getCurrentLoad()
    };
  }
}
```

### Multi-Stage Processing Pipeline

```typescript
class SafariZonePipeline {
  private stages: Map<string, QueryProcessManager<any, any>> = new Map();
  
  constructor() {
    this.setupPipeline();
  }
  
  private setupPipeline() {
    // Stage 1: Zone Analysis
    this.stages.set('analyze', new QueryProcessManager(
      module, this.analyzeZoneConditions, 10000
    ));
    
    // Stage 2: Encounter Generation
    this.stages.set('generate', new QueryProcessManager(
      module, this.generateEncounters, 15000
    ));
    
    // Stage 3: Result Processing
    this.stages.set('process', new QueryProcessManager(
      module, this.processResults, 5000
    ));
    
    // Spawn workers for each stage
    this.stages.get('analyze')!.spawn(2);
    this.stages.get('generate')!.spawn(4); // Most CPU-intensive
    this.stages.get('process')!.spawn(2);
  }
  
  async processSafariRequest(request: any): Promise<any> {
    try {
      // Stage 1: Analyze zone conditions
      const analysis = await this.stages.get('analyze')!.query({
        zone: request.zone,
        weather: request.weather,
        time: request.timeOfDay
      });
      
      // Stage 2: Generate encounters based on analysis
      const encounters = await this.stages.get('generate')!.query({
        analysis,
        playerLevel: request.playerLevel,
        count: request.encounterCount || 1
      });
      
      // Stage 3: Process and format results
      const results = await this.stages.get('process')!.query({
        encounters,
        format: request.format || 'standard'
      });
      
      return results;
    } catch (error) {
      console.error('Pipeline processing failed:', error);
      throw new Error(`Safari Zone processing failed: ${error.message}`);
    }
  }
  
  private analyzeZoneConditions = (input: any) => {
    // Complex zone analysis logic
    return {
      baseEncounterRate: this.calculateBaseRate(input.zone),
      weatherModifier: this.getWeatherEffect(input.weather),
      timeModifier: this.getTimeEffect(input.time),
      availablePokemon: this.getZonePokemon(input.zone)
    };
  };
  
  private generateEncounters = (input: any) => {
    // Heavy encounter generation
    const encounters = [];
    for (let i = 0; i < input.count; i++) {
      encounters.push(this.generateSingleEncounter(input.analysis, input.playerLevel));
    }
    return encounters;
  };
  
  private processResults = (input: any) => {
    // Format and validate results
    return {
      encounters: input.encounters,
      metadata: {
        processedAt: Date.now(),
        format: input.format,
        count: input.encounters.length
      }
    };
  };
  
  async getHealthStatus(): Promise<any> {
    const stageHealth: any = {};
    
    for (const [name, manager] of this.stages) {
      stageHealth[name] = {
        processCount: manager.processes.length,
        currentLoad: manager.processes.reduce((sum, p) => sum + p.getLoad(), 0),
        crashCount: manager.crashedProcesses.length
      };
    }
    
    return stageHealth;
  }
  
  async shutdown() {
    const shutdownPromises = Array.from(this.stages.values()).map(manager =>
      manager.destroy()
    );
    
    await Promise.all(shutdownPromises);
    this.stages.clear();
  }
}
```

## Utility Functions

### `exec(command, options?): Promise<{stdout: string, stderr: string}>`

Execute shell commands with Promise support.

```typescript
// Execute shell command
const { stdout, stderr } = await exec('ls -la /tmp');
console.log('Directory listing:', stdout);

// Execute with file arguments
const { stdout } = await exec(['node', 'scripts/generate-pokemon-data.js', 'safari-zone']);
console.log('Generation result:', stdout);

// With execution options
const { stdout } = await exec('python3 encounter-calculator.py', {
  cwd: '/path/to/scripts',
  env: { ZONE: 'forest', WEATHER: 'rain' },
  timeout: 30000
});
```

### Process Monitoring

```typescript
// Global process manager tracking
import { processManagers } from '../lib/process-manager';

// Get all active process managers
console.log(`Active process managers: ${processManagers.length}`);

for (const manager of processManagers) {
  console.log(`Manager: ${manager.basename}`);
  console.log(`Processes: ${manager.processes.length}`);
  console.log(`Releasing: ${manager.releasingProcesses.length}`);
}

// Global shutdown
async function shutdownAllProcesses() {
  const shutdownPromises = processManagers.map(manager => manager.destroy());
  await Promise.all(shutdownPromises);
  console.log('All process managers shut down');
}
```

## Configuration and Control

### Global Process Management

```typescript
// Disable all process spawning (useful for testing)
ProcessManager.disabled = true;

// Force spawn despite disabled flag
manager.spawn(2, true); // force = true

// Re-enable process spawning
ProcessManager.disabled = false;
```

### Environment Configuration

```typescript
// Custom environment for child processes
const manager = new RawProcessManager({
  module,
  setupChild: createProcessor,
  env: {
    NODE_ENV: 'production',
    SAFARI_MODE: 'high_performance',
    MAX_MEMORY: '1GB',
    CPU_PRIORITY: 'high'
  }
});
```

### Debug and Monitoring

```typescript
// Enable debug callbacks
const manager = new QueryProcessManager(
  module,
  processingFunction,
  30000,
  (debugMessage) => {
    console.log(`[DEBUG] ${debugMessage}`);
    // Log to monitoring system
    MonitoringSystem.log('process-debug', debugMessage);
  }
);

// Monitor process health
setInterval(async () => {
  const health = {
    processCount: manager.processes.length,
    totalLoad: manager.processes.reduce((sum, p) => sum + p.getLoad(), 0),
    crashCount: manager.crashedProcesses.length,
    uptime: process.uptime()
  };
  
  console.log('Process health:', health);
  
  // Send to monitoring system
  await MonitoringSystem.recordMetrics('safari-zone-processes', health);
}, 60000); // Every minute
```

## Best Practices

### 1. **Choose the Right Pattern**

```typescript
// Query/Response - For stateless processing
const calculator = new QueryProcessManager(module, heavyCalculation);

// Streaming - For real-time data processing  
const processor = new StreamProcessManager(module, createDataStream);

// Raw - For maximum control and custom protocols
const controller = new RawProcessManager({ module, setupChild: createCustom });
```

### 2. **Handle Errors Gracefully**

```typescript
// Implement retry logic
async function resilientQuery(manager: QueryProcessManager<any, any>, input: any) {
  const maxRetries = 3;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await manager.query(input);
    } catch (error) {
      if (attempt === maxRetries) throw error;
      
      console.warn(`Attempt ${attempt} failed, retrying...`);
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}
```

### 3. **Monitor Resource Usage**

```typescript
// Track memory and CPU usage
class MonitoredProcessManager {
  private manager: QueryProcessManager<any, any>;
  private metrics = new Map<number, any>();
  
  constructor() {
    this.manager = new QueryProcessManager(module, this.processData);
    this.startMonitoring();
  }
  
  private startMonitoring() {
    setInterval(() => {
      for (const process of this.manager.processes) {
        const pid = process.getProcess().pid;
        const usage = process.memoryUsage?.() || { heapUsed: 0 };
        
        this.metrics.set(pid, {
          memoryUsage: usage.heapUsed,
          load: process.getLoad(),
          timestamp: Date.now()
        });
      }
    }, 10000); // Every 10 seconds
  }
}
```

### 4. **Implement Graceful Shutdown**

```typescript
class GracefulProcessManager {
  private managers: QueryProcessManager<any, any>[] = [];
  
  constructor() {
    // Handle shutdown signals
    process.on('SIGTERM', this.shutdown.bind(this));
    process.on('SIGINT', this.shutdown.bind(this));
  }
  
  private async shutdown() {
    console.log('Shutting down process managers...');
    
    const shutdownPromises = this.managers.map(async (manager) => {
      // Allow current tasks to complete
      const timeoutPromise = new Promise(resolve => setTimeout(resolve, 30000));
      const shutdownPromise = manager.destroy();
      
      // Wait for shutdown or timeout
      await Promise.race([shutdownPromise, timeoutPromise]);
    });
    
    await Promise.all(shutdownPromises);
    console.log('All process managers shut down');
    process.exit(0);
  }
}
```

### 5. **Scale Dynamically**

```typescript
// Auto-scaling based on load
class AutoScalingManager {
  private manager: QueryProcessManager<any, any>;
  private minProcesses = 1;
  private maxProcesses = 8;
  
  constructor() {
    this.manager = new QueryProcessManager(module, this.processData);
    this.startAutoScaling();
  }
  
  private startAutoScaling() {
    setInterval(() => {
      const currentLoad = this.getTotalLoad();
      const processCount = this.manager.processes.length;
      const avgLoad = currentLoad / processCount;
      
      if (avgLoad > 10 && processCount < this.maxProcesses) {
        // Scale up
        this.manager.spawn(processCount + 1);
        console.log(`Scaled up to ${processCount + 1} processes`);
      } else if (avgLoad < 2 && processCount > this.minProcesses) {
        // Scale down
        void this.manager.unspawnOne(this.manager.processes[0]);
        console.log(`Scaled down to ${processCount - 1} processes`);
      }
    }, 30000); // Check every 30 seconds
  }
  
  private getTotalLoad(): number {
    return this.manager.processes.reduce((sum, p) => sum + p.getLoad(), 0);
  }
}
```

## Performance Considerations

- **Process overhead** - Each process has memory overhead (~10MB base)
- **Communication cost** - JSON serialization/deserialization for QueryProcessManager
- **Context switching** - More processes don't always mean better performance
- **Memory usage** - Monitor heap usage in child processes
- **Crash recovery** - Limit to 5 crashes per 30 minutes to prevent resource exhaustion

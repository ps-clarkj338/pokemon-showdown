# Pokémon Showdown `lib/net.ts` - Complete API Reference

## Overview

The `lib/net.ts` module provides a simplified abstraction layer around Node.js's HTTP/HTTPS request system. It offers easier data acquisition, Promise-based API, and mass disabling of outgoing requests via configuration. This is the primary way to make external API calls in Pokémon Showdown.

## Basic Usage

```typescript
import { Net } from '../lib/net';

// Simple GET request
const response = await Net('https://pokeapi.co/api/v2/pokemon/pikachu').get();
const pokemonData = JSON.parse(response);

// POST request
await Net('https://api.example.com/webhook').post({
  body: { message: 'Safari Zone event completed!' }
});
```

## Core Classes

### `NetRequest` - Request Builder

Main class for building and executing HTTP requests.

```typescript
class NetRequest {
  uri: string;
  response?: http.IncomingMessage;
  
  constructor(uri: string);
  getStream(opts?: NetRequestOptions): NetStream;
  get(opts?: NetRequestOptions): Promise<string>;
  post(opts?: NetRequestOptions, body?: PostData | string): Promise<string>;
}
```

## Request Methods

### `get(options?): Promise<string>`

**⭐ Most common method** - Makes GET request and returns response body as string.

```typescript
// Simple GET request
const html = await Net('https://example.com').get();

// GET with headers
const apiResponse = await Net('https://api.github.com/user').get({
  headers: {
    'Authorization': 'token ghp_xxxxxxxxxxxx',
    'User-Agent': 'Pokemon-Showdown/1.0'
  }
});

// GET with query parameters
const searchResults = await Net('https://api.pokemontcg.io/v2/cards').get({
  query: {
    q: 'name:pikachu',
    page: '1',
    pageSize: '10'
  }
});

// GET with timeout
const data = await Net('https://slow-api.com/data').get({
  timeout: 10000 // 10 second timeout
});
```

### `post(options?, body?): Promise<string>`

**⭐ For API submissions** - Makes POST request with optional body data.

```typescript
// Simple POST with JSON
const result = await Net('https://api.example.com/submit').post({
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    event: 'safari_catch',
    pokemon: 'Pikachu',
    user: 'alice123'
  })
});

// POST with form data
const response = await Net('https://forms.example.com/submit').post({
  body: {
    username: 'alice123',
    pokemon: 'Pikachu',
    action: 'catch'
  }
});

// POST with custom headers
await Net('https://webhook.site/unique-id').post({
  headers: {
    'Authorization': 'Bearer secret-token',
    'Content-Type': 'application/json'
  }
}, JSON.stringify(webhookData));

// Alternative syntax
await Net('https://api.example.com/endpoint').post({
  body: formData,
  headers: { 'User-Agent': 'Safari-Zone-Plugin/1.0' }
});
```

### `getStream(options?): NetStream`

**⭐ For large responses or streaming** - Returns a stream instead of loading entire response into memory.

```typescript
// Stream large file
const stream = Net('https://example.com/large-file.json').getStream();
const data = await stream.readAll();

// Stream with progress tracking
const downloadStream = Net('https://example.com/pokemon-data.zip').getStream();
let bytesRead = 0;

for await (const chunk of downloadStream) {
  bytesRead += chunk.length;
  console.log(`Downloaded ${bytesRead} bytes`);
}

// Pipe to file
const fileStream = FS('downloads/pokemon-data.json').createWriteStream();
const response = Net('https://api.pokemon.com/data').getStream();
await response.pipeTo(fileStream);
```

## NetRequestOptions Interface

### Configuration Options

```typescript
interface NetRequestOptions extends https.RequestOptions {
  body?: string | PostData;    // POST body data
  writable?: boolean;          // Make request writable (for streaming)
  query?: PostData;           // URL query parameters
  timeout?: number;           // Request timeout (default: 5000ms)
  headers?: http.OutgoingHttpHeaders; // Custom headers
  method?: string;            // HTTP method (GET, POST, etc.)
}

interface PostData {
  [key: string]: string | number;
}
```

### Headers and Authentication

```typescript
// API key authentication
const pokemonData = await Net('https://api.pokemon.com/v1/pokemon/pikachu').get({
  headers: {
    'X-API-Key': 'your-api-key-here',
    'User-Agent': 'Pokemon-Showdown-Safari-Plugin/1.0'
  }
});

// Bearer token authentication
const userInfo = await Net('https://api.github.com/user').get({
  headers: {
    'Authorization': 'Bearer ghp_xxxxxxxxxxxx'
  }
});

// Custom content type
await Net('https://api.example.com/xml-endpoint').post({
  headers: {
    'Content-Type': 'application/xml',
    'Accept': 'application/xml'
  },
  body: '<pokemon><name>Pikachu</name></pokemon>'
});
```

## NetStream Class

### Advanced Streaming Operations

```typescript
class NetStream extends Streams.ReadWriteStream {
  statusCode: number | null;
  headers: http.IncomingHttpHeaders | null;
  state: 'pending' | 'open' | 'timeout' | 'success' | 'error';
  
  // Inherited from ReadWriteStream
  readAll(): Promise<string>;
  readLine(): Promise<string>;
  pipeTo(destination: WriteStream): Promise<void>;
}
```

### Stream Usage Examples

```typescript
// Check response status
const stream = Net('https://api.example.com/status').getStream();
const response = await stream.response;
console.log(`Status: ${stream.statusCode}`);
console.log(`Headers:`, stream.headers);

// Stream processing with status checks
const apiStream = Net('https://api.pokemon.com/large-dataset').getStream({
  timeout: 30000
});

// Wait for headers
await apiStream.response;

if (apiStream.statusCode !== 200) {
  throw new Error(`API returned status ${apiStream.statusCode}`);
}

// Process stream data
for await (const line of apiStream.byLine()) {
  const pokemonData = JSON.parse(line);
  processPokemonData(pokemonData);
}
```

## Error Handling

### HttpError Class

```typescript
class HttpError extends Error {
  statusCode?: number;
  body: string;
  
  constructor(message: string, statusCode: number | undefined, body: string);
}
```

### Error Handling Examples

```typescript
// Basic error handling
try {
  const data = await Net('https://api.example.com/pokemon').get();
  return JSON.parse(data);
} catch (error) {
  if (error instanceof HttpError) {
    console.log(`HTTP Error ${error.statusCode}: ${error.message}`);
    console.log(`Response body: ${error.body}`);
    
    if (error.statusCode === 404) {
      return null; // Pokemon not found
    } else if (error.statusCode === 429) {
      // Rate limited, wait and retry
      await new Promise(resolve => setTimeout(resolve, 1000));
      return this.fetchPokemonData(pokemonName);
    }
  }
  throw error; // Re-throw unexpected errors
}

// Status code checking
async function safeFetch(url: string) {
  try {
    const response = await Net(url).get();
    return { success: true, data: response };
  } catch (error) {
    if (error instanceof HttpError) {
      return { 
        success: false, 
        status: error.statusCode, 
        message: error.message,
        body: error.body 
      };
    }
    return { success: false, message: error.message };
  }
}
```

## Advanced Features

### Query Parameter Encoding

```typescript
// Query parameters are automatically URL-encoded
const response = await Net('https://api.example.com/search').get({
  query: {
    q: 'pokemon name with spaces',
    type: 'electric',
    generation: '1',
    limit: '50'
  }
});
// Results in: https://api.example.com/search?q=pokemon%20name%20with%20spaces&type=electric&generation=1&limit=50
```

### Form Data Handling

```typescript
// Automatic form encoding for POST
await Net('https://forms.example.com/submit').post({
  body: {
    trainer_name: 'Ash Ketchum',
    pokemon_caught: '151',
    favorite_type: 'Electric'
  }
});
// Content-Type: application/x-www-form-urlencoded is automatically set
```

### File Upload Simulation

```typescript
// Upload data as form
const fileData = await FS('data/pokemon-stats.json').read();
await Net('https://api.example.com/upload').post({
  headers: { 'Content-Type': 'application/json' },
  body: fileData
});

// Multi-part form data (manual construction)
const boundary = `----FormBoundary${Date.now()}`;
const formData = [
  `--${boundary}`,
  'Content-Disposition: form-data; name="file"; filename="pokemon.json"',
  'Content-Type: application/json',
  '',
  fileData,
  `--${boundary}--`
].join('\r\n');

await Net('https://upload.example.com/api').post({
  headers: {
    'Content-Type': `multipart/form-data; boundary=${boundary}`
  },
  body: formData
});
```

## Common Usage Patterns

### API Integration for Safari Zone

```typescript
class PokemonAPIClient {
  private baseURL = 'https://pokeapi.co/api/v2';
  
  async getPokemonData(nameOrId: string | number) {
    try {
      const response = await Net(`${this.baseURL}/pokemon/${nameOrId}`).get({
        timeout: 10000,
        headers: {
          'User-Agent': 'Pokemon-Showdown-Safari-Plugin/1.0'
        }
      });
      
      return JSON.parse(response);
    } catch (error) {
      if (error instanceof HttpError && error.statusCode === 404) {
        return null; // Pokemon not found
      }
      throw error;
    }
  }
  
  async getSpeciesData(nameOrId: string | number) {
    const response = await Net(`${this.baseURL}/pokemon-species/${nameOrId}`).get();
    return JSON.parse(response);
  }
  
  async getEvolutionChain(id: number) {
    const response = await Net(`${this.baseURL}/evolution-chain/${id}`).get();
    return JSON.parse(response);
  }
  
  async searchPokemon(query: string) {
    // Note: PokéAPI doesn't have search, this is an example
    const response = await Net('https://api.pokemontcg.io/v2/pokemon').get({
      query: { q: `name:${query}*` },
      headers: { 'X-Api-Key': process.env.POKEMON_TCG_API_KEY }
    });
    
    return JSON.parse(response);
  }
}
```

### Webhook Integration

```typescript
class SafariZoneWebhooks {
  private webhookURL = process.env.SAFARI_WEBHOOK_URL;
  
  async sendCatchNotification(userId: string, pokemon: string, rare: boolean) {
    if (!this.webhookURL) return;
    
    try {
      await Net(this.webhookURL).post({
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'pokemon_caught',
          user: userId,
          pokemon: pokemon,
          rare: rare,
          timestamp: new Date().toISOString()
        }),
        timeout: 5000
      });
    } catch (error) {
      console.warn('Failed to send webhook:', error.message);
      // Don't throw - webhooks are non-critical
    }
  }
  
  async sendLeaderboardUpdate(topPlayers: any[]) {
    if (!this.webhookURL) return;
    
    await Net(this.webhookURL).post({
      body: {
        event: 'leaderboard_update',
        top_players: topPlayers.slice(0, 10),
        timestamp: Date.now()
      }
    });
  }
}
```

### Rate-Limited API Client

```typescript
class RateLimitedAPIClient {
  private lastRequest = 0;
  private minInterval = 1000; // 1 second between requests
  
  private async waitForRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequest;
    
    if (timeSinceLastRequest < this.minInterval) {
      const waitTime = this.minInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequest = Date.now();
  }
  
  async makeRequest(url: string, options: NetRequestOptions = {}) {
    await this.waitForRateLimit();
    
    try {
      return await Net(url).get(options);
    } catch (error) {
      if (error instanceof HttpError && error.statusCode === 429) {
        // Rate limited, wait longer and retry
        await new Promise(resolve => setTimeout(resolve, 5000));
        return this.makeRequest(url, options);
      }
      throw error;
    }
  }
}
```

### External Data Fetching

```typescript
class ExternalPokemonData {
  async fetchPokemonSprites(pokemonName: string) {
    try {
      const response = await Net(`https://pokeapi.co/api/v2/pokemon/${pokemonName.toLowerCase()}`).get({
        timeout: 5000
      });
      
      const data = JSON.parse(response);
      return {
        front: data.sprites.front_default,
        back: data.sprites.back_default,
        shiny: data.sprites.front_shiny
      };
    } catch (error) {
      console.warn(`Failed to fetch sprites for ${pokemonName}:`, error.message);
      return null;
    }
  }
  
  async fetchTypeMatchups(type1: string, type2?: string) {
    const url = `https://pokeapi.co/api/v2/type/${type1.toLowerCase()}`;
    
    try {
      const response = await Net(url).get();
      const typeData = JSON.parse(response);
      
      return {
        weakTo: typeData.damage_relations.double_damage_from.map((t: any) => t.name),
        resistsTo: typeData.damage_relations.half_damage_from.map((t: any) => t.name),
        immuneTo: typeData.damage_relations.no_damage_from.map((t: any) => t.name)
      };
    } catch (error) {
      console.warn(`Failed to fetch type data for ${type1}:`, error.message);
      return null;
    }
  }
  
  async fetchRandomPokemonFact() {
    const factAPIs = [
      'https://some-pokemon-fact-api.com/random',
      'https://pokemon-trivia-api.com/fact',
      'https://pokedex-api.com/daily-fact'
    ];
    
    // Try each API until one works
    for (const apiURL of factAPIs) {
      try {
        const response = await Net(apiURL).get({ timeout: 3000 });
        return JSON.parse(response);
      } catch (error) {
        console.warn(`API ${apiURL} failed:`, error.message);
        continue;
      }
    }
    
    return null; // All APIs failed
  }
}
```

## NetStream Class

### Stream Properties

```typescript
class NetStream extends Streams.ReadWriteStream {
  statusCode: number | null;           // HTTP status code
  headers: http.IncomingHttpHeaders | null; // Response headers
  uri: string;                        // Request URI
  request: http.ClientRequest;        // Underlying request object
  response: Promise<http.IncomingMessage | null> | http.IncomingMessage | null;
  state: 'pending' | 'open' | 'timeout' | 'success' | 'error';
}
```

### Stream Usage Examples

```typescript
// Download large dataset
async function downloadPokemonDatabase() {
  const stream = Net('https://api.pokemon.com/complete-dataset.json').getStream({
    timeout: 60000 // 1 minute timeout for large file
  });
  
  // Wait for response headers
  const response = await stream.response;
  
  if (!response || stream.statusCode !== 200) {
    throw new Error(`Failed to download: status ${stream.statusCode}`);
  }
  
  console.log('Content-Length:', stream.headers?.['content-length']);
  console.log('Content-Type:', stream.headers?.['content-type']);
  
  // Process stream data
  let totalSize = 0;
  const chunks: string[] = [];
  
  for await (const chunk of stream) {
    chunks.push(chunk);
    totalSize += chunk.length;
    
    if (totalSize % 100000 === 0) { // Log every 100KB
      console.log(`Downloaded ${totalSize} bytes`);
    }
  }
  
  return chunks.join('');
}

// Streaming JSON processing
async function processStreamingPokemonData() {
  const stream = Net('https://streaming-pokemon-api.com/live-data').getStream();
  
  // Process line by line (for JSONL format)
  for await (const line of stream.byLine()) {
    if (line.trim()) {
      try {
        const pokemonEvent = JSON.parse(line);
        handlePokemonEvent(pokemonEvent);
      } catch (error) {
        console.warn('Invalid JSON line:', line);
      }
    }
  }
}
```

## Static Utility Methods

### `NetStream.encodeQuery(data: PostData): string`

Manually encode form data (usually automatic).

```typescript
const formData = { name: 'Ash Ketchum', pokemon: 'Pikachu' };
const encoded = NetStream.encodeQuery(formData);
// "name=Ash%20Ketchum&pokemon=Pikachu"

// Used internally by Net, but available for custom usage
const customURL = `https://api.example.com/search?${NetStream.encodeQuery(searchParams)}`;
```

## Configuration and Control

### Global Request Disabling

```typescript
// Disable all network requests (useful for testing)
global.Config = { noNetRequests: true };

// This will throw an error
try {
  await Net('https://example.com').get();
} catch (error) {
  console.log(error.message); // "Net requests are disabled."
}
```

### Request Timeout Handling

```typescript
// Set custom timeout
async function fetchWithTimeout(url: string, timeoutMs: number) {
  try {
    return await Net(url).get({ timeout: timeoutMs });
  } catch (error) {
    if (error.message.includes('timeout')) {
      console.warn(`Request to ${url} timed out after ${timeoutMs}ms`);
      return null;
    }
    throw error;
  }
}

// Different timeouts for different operations
const quickData = await fetchWithTimeout('https://fast-api.com/data', 2000);      // 2s timeout
const slowData = await fetchWithTimeout('https://slow-api.com/report', 30000);    // 30s timeout
```

## Advanced Integration Patterns

### API Client with Caching

```typescript
class CachedPokemonAPI {
  private cache = new Map<string, { data: any, expires: number }>();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes
  
  async getPokemon(name: string) {
    const cacheKey = `pokemon:${name}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }
    
    try {
      const response = await Net(`https://pokeapi.co/api/v2/pokemon/${name}`).get({
        timeout: 10000
      });
      
      const data = JSON.parse(response);
      this.cache.set(cacheKey, {
        data,
        expires: Date.now() + this.cacheTimeout
      });
      
      return data;
    } catch (error) {
      // Return cached data even if expired, if available
      if (cached) {
        console.warn(`Using stale cache for ${name}:`, error.message);
        return cached.data;
      }
      throw error;
    }
  }
  
  clearCache() {
    this.cache.clear();
  }
}
```

### Batch API Requests

```typescript
class BatchPokemonFetcher {
  private batchSize = 5;
  private delayBetweenBatches = 1000; // 1 second
  
  async fetchMultiplePokemon(pokemonNames: string[]) {
    const results = [];
    
    // Process in batches to avoid overwhelming the API
    for (let i = 0; i < pokemonNames.length; i += this.batchSize) {
      const batch = pokemonNames.slice(i, i + this.batchSize);
      
      console.log(`Fetching batch ${Math.floor(i / this.batchSize) + 1}/${Math.ceil(pokemonNames.length / this.batchSize)}`);
      
      // Fetch batch in parallel
      const batchPromises = batch.map(async (name) => {
        try {
          const response = await Net(`https://pokeapi.co/api/v2/pokemon/${name}`).get({
            timeout: 5000
          });
          return { name, data: JSON.parse(response), error: null };
        } catch (error) {
          return { name, data: null, error: error.message };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Wait between batches
      if (i + this.batchSize < pokemonNames.length) {
        await new Promise(resolve => setTimeout(resolve, this.delayBetweenBatches));
      }
    }
    
    return results;
  }
}
```

### Safari Zone Integration Example

```typescript
export class SafariZoneExternalData {
  private pokemonAPI = new CachedPokemonAPI();
  
  // Fetch encounter data from external APIs
  async getWildPokemonData(species: string) {
    const [pokemonData, speciesData] = await Promise.all([
      this.pokemonAPI.getPokemon(species),
      this.fetchSpeciesInfo(species)
    ]);
    
    if (!pokemonData) return null;
    
    return {
      name: pokemonData.name,
      types: pokemonData.types.map((t: any) => t.type.name),
      stats: pokemonData.stats.reduce((acc: any, stat: any) => {
        acc[stat.stat.name] = stat.base_stat;
        return acc;
      }, {}),
      height: pokemonData.height,
      weight: pokemonData.weight,
      rarity: speciesData?.rarity || 'common'
    };
  }
  
  private async fetchSpeciesInfo(species: string) {
    try {
      const response = await Net(`https://pokeapi.co/api/v2/pokemon-species/${species}`).get();
      const speciesData = JSON.parse(response);
      
      return {
        rarity: this.calculateRarity(speciesData.capture_rate),
        habitat: speciesData.habitat?.name,
        generation: speciesData.generation?.name
      };
    } catch (error) {
      console.warn(`Could not fetch species info for ${species}:`, error.message);
      return null;
    }
  }
  
  private calculateRarity(captureRate: number): 'common' | 'uncommon' | 'rare' | 'legendary' {
    if (captureRate >= 200) return 'common';
    if (captureRate >= 100) return 'uncommon'; 
    if (captureRate >= 25) return 'rare';
    return 'legendary';
  }
  
  // Send statistics to external analytics
  async reportEncounterStats(stats: any) {
    const analyticsURL = process.env.ANALYTICS_WEBHOOK;
    if (!analyticsURL) return;
    
    try {
      await Net(analyticsURL).post({
        headers: {
          'Authorization': `Bearer ${process.env.ANALYTICS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          service: 'safari-zone',
          data: stats,
          timestamp: Date.now()
        }),
        timeout: 10000
      });
    } catch (error) {
      // Analytics failures shouldn't break the game
      console.warn('Analytics reporting failed:', error.message);
    }
  }
}
```

### Health Check and Monitoring

```typescript
class ServiceHealthChecker {
  private services = [
    { name: 'PokeAPI', url: 'https://pokeapi.co/api/v2/pokemon/1' },
    { name: 'Pokemon TCG API', url: 'https://api.pokemontcg.io/v2/cards?pageSize=1' },
    { name: 'Custom Backend', url: 'https://your-backend.com/health' }
  ];
  
  async checkAllServices() {
    const results = await Promise.all(
      this.services.map(service => this.checkService(service))
    );
    
    return results.reduce((acc, result) => {
      acc[result.name] = result;
      return acc;
    }, {} as Record<string, any>);
  }
  
  private async checkService(service: { name: string, url: string }) {
    const startTime = Date.now();
    
    try {
      const response = await Net(service.url).get({ timeout: 5000 });
      const responseTime = Date.now() - startTime;
      
      return {
        name: service.name,
        status: 'healthy',
        responseTime,
        lastChecked: new Date().toISOString()
      };
    } catch (error) {
      return {
        name: service.name,
        status: 'unhealthy',
        error: error.message,
        responseTime: Date.now() - startTime,
        lastChecked: new Date().toISOString()
      };
    }
  }
}
```

## Error Types and Handling

### Common Error Scenarios

```typescript
async function robustAPICall(url: string) {
  try {
    return await Net(url).get({ timeout: 5000 });
  } catch (error) {
    if (error instanceof HttpError) {
      switch (error.statusCode) {
        case 400:
          throw new Error('Bad request - check API parameters');
        case 401:
          throw new Error('Unauthorized - check API credentials');
        case 403:
          throw new Error('Forbidden - insufficient permissions');
        case 404:
          return null; // Not found is often acceptable
        case 429:
          throw new Error('Rate limited - slow down requests');
        case 500:
          throw new Error('Server error - try again later');
        default:
          throw new Error(`HTTP ${error.statusCode}: ${error.message}`);
      }
    } else if (error.message.includes('timeout')) {
      throw new Error('Request timeout - service may be slow');
    } else if (error.code === 'ENOTFOUND') {
      throw new Error('DNS resolution failed - check URL');
    } else if (error.code === 'ECONNREFUSED') {
      throw new Error('Connection refused - service may be down');
    } else {
      throw error; // Unknown error
    }
  }
}
```

## Performance Tips

1. **Use streams for large responses** to avoid memory issues
2. **Implement timeouts** to prevent hanging requests  
3. **Cache frequently accessed data** to reduce API calls
4. **Use batch requests** when possible to minimize round trips
5. **Implement retry logic** for transient failures
6. **Set appropriate User-Agent headers** for API identification
7. **Handle rate limits gracefully** with exponential backoff

## Security Considerations

1. **Never include API keys in URLs** - use headers instead
2. **Validate external data** before using it
3. **Set reasonable timeouts** to prevent resource exhaustion
4. **Log failures** but don't log sensitive data
5. **Use HTTPS** for all sensitive communications
6. **Sanitize any external data** before displaying to users

## Configuration

The Net module respects `Config.noNetRequests` - when set to `true`, all network requests will throw an error. This is useful for testing and offline development.

```typescript
// Disable all outgoing requests
global.Config = { noNetRequests: true };

// Enable requests (default)
global.Config = { noNetRequests: false };
```

This comprehensive API reference shows how `lib/net.ts` provides a clean, Promise-based interface for HTTP operations that's perfect for integrating external APIs, webhooks, and data sources into Pokémon Showdown plugins.
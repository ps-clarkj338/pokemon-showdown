# Pokemon Showdown Net API Usage Sheet

## Overview

The Net module provides an abstraction layer around Node.js HTTP/HTTPS request system, offering easier data acquisition and centralized control over outgoing requests. It includes streaming capabilities, error handling, and built-in request/response management.

## Basic Usage Pattern

```javascript
import { Net } from './net';

// Create request instance
const request = Net('https://api.example.com/data');

// Make requests
const data = await request.get();
const result = await request.post({ headers: { 'Content-Type': 'application/json' } }, jsonData);
```

## Core Classes

### `NetRequest` Class
Main class for making HTTP requests with response caching.

#### Constructor
```javascript
const request = new Net.NetRequest('https://api.example.com');
// or using the factory function
const request = Net('https://api.example.com');
```

### `NetStream` Class
Streaming interface for HTTP requests with real-time data processing.

### `HttpError` Class
Custom error class for HTTP-specific errors with status codes and response bodies.

## Request Methods

### `get(opts?: NetRequestOptions): Promise<string>`
Makes a GET request and returns the response body as a string.

```javascript
// Basic GET request
const data = await request.get();

// GET with headers
const data = await request.get({
  headers: {
    'Authorization': 'Bearer token123',
    'User-Agent': 'Pokemon-Showdown/1.0'
  }
});

// GET with query parameters
const data = await request.get({
  query: {
    limit: 50,
    page: 1,
    active: true
  }
});
// Automatically appends ?limit=50&page=1&active=true to URL

// GET with timeout
const data = await request.get({
  timeout: 10000 // 10 seconds
});

// GET with custom options
const data = await request.get({
  headers: { 'Accept': 'application/json' },
  timeout: 5000,
  query: { format: 'json' }
});
```

### `post(opts?: NetRequestOptions): Promise<string>`
### `post(opts: Omit<NetRequestOptions, 'body'>, body: PostData | string): Promise<string>`
Makes a POST request with optional body data.

```javascript
// POST with object data (automatically URL-encoded)
const response = await request.post({
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
}, {
  username: 'player1',
  action: 'login',
  timestamp: Date.now()
});

// POST with JSON string
const response = await request.post({
  headers: { 'Content-Type': 'application/json' }
}, JSON.stringify({
  data: 'value',
  nested: { key: 'value' }
}));

// POST with body in options
const response = await request.post({
  body: { key: 'value' },
  headers: { 'Authorization': 'Bearer token' }
});

// POST with form data
const response = await request.post({
  body: {
    file: 'data.txt',
    content: 'file contents here',
    public: 1
  }
});
```

## Streaming Interface

### `getStream(opts?: NetRequestOptions): NetStream`
Returns a streaming interface for processing large responses or real-time data.

```javascript
// Basic streaming
const stream = request.getStream();

// Process data as it arrives
stream.on('data', chunk => {
  console.log('Received chunk:', chunk);
  // Process chunk immediately
});

stream.on('end', () => {
  console.log('Stream completed');
  console.log('Status code:', stream.statusCode);
  console.log('Headers:', stream.headers);
});

stream.on('error', error => {
  console.error('Stream error:', error);
});

// Streaming with options
const stream = request.getStream({
  headers: { 'Accept': 'text/event-stream' },
  timeout: 30000 // Longer timeout for streaming
});
```

### NetStream Properties

#### Response Information
```javascript
const stream = request.getStream();

// Wait for response headers
const response = await stream.response;

// Access response data
console.log('Status:', stream.statusCode); // HTTP status code
console.log('Headers:', stream.headers);   // Response headers
console.log('State:', stream.state);       // 'pending' | 'open' | 'timeout' | 'success' | 'error'
console.log('URI:', stream.uri);           // Final URI (after redirects)
```

#### Reading Stream Data
```javascript
// Read all data at once (waits for completion)
const fullData = await stream.readAll();

// Read data incrementally
let chunk;
while ((chunk = await stream.read()) !== null) {
  process(chunk);
}

// Pipe to another stream
stream.pipe(fs.createWriteStream('output.txt'));
```

## Writable Streams (Upload)

### Streaming Uploads
```javascript
// Create writable stream for uploading
const uploadStream = request.getStream({
  method: 'POST',
  writable: true,
  headers: {
    'Content-Type': 'application/octet-stream',
    'Transfer-Encoding': 'chunked'
  }
});

// Write data to stream
await uploadStream.write('chunk 1\n');
await uploadStream.write('chunk 2\n');
await uploadStream.write('chunk 3\n');

// End the stream
uploadStream.end();

// Wait for response
const response = await uploadStream.response;
const result = await uploadStream.readAll();
```

### File Upload Example
```javascript
// Stream file upload
const uploadStream = request.getStream({
  method: 'PUT',
  writable: true,
  headers: {
    'Content-Type': 'text/plain',
    'Content-Length': fileSize
  }
});

// Read file and stream upload
const fileStream = fs.createReadStream('large-file.txt');
fileStream.pipe(uploadStream);

// Wait for completion
const response = await uploadStream.response;
console.log('Upload status:', uploadStream.statusCode);
```

## Request Options Interface

### `NetRequestOptions` Properties
```typescript
interface NetRequestOptions extends https.RequestOptions {
  body?: string | PostData;     // Request body (auto-encoded if object)
  writable?: boolean;           // Enable writable stream mode
  query?: PostData;             // Query parameters (appended to URL)
  
  // Standard Node.js options
  method?: string;              // HTTP method
  headers?: http.OutgoingHttpHeaders;
  timeout?: number;             // Request timeout in milliseconds
  auth?: string;                // Basic authentication
  // ... other Node.js RequestOptions
}
```

### Query Parameter Handling
```javascript
// Query parameters are automatically URL-encoded
const stream = request.getStream({
  query: {
    search: 'Pokémon Sun & Moon',  // Automatically encoded
    limit: 25,
    active: true,
    tags: 'battle,ranked'
  }
});
// Results in: ?search=Pok%C3%A9mon%20Sun%20%26%20Moon&limit=25&active=true&tags=battle%2Cranked
```

### Body Data Handling
```javascript
// Object bodies are automatically URL-encoded
await request.post({}, {
  username: 'user with spaces',
  password: 'p@ssw0rd!',
  special: 'chars & symbols'
});
// Automatically becomes: username=user%20with%20spaces&password=p%40ssw0rd%21&special=chars%20%26%20symbols

// String bodies are sent as-is
await request.post({
  headers: { 'Content-Type': 'application/json' }
}, JSON.stringify({ key: 'value' }));
```

## Error Handling

### `HttpError` Class
Custom error thrown for HTTP-specific issues.

```javascript
try {
  const data = await request.get();
} catch (error) {
  if (error instanceof Net.HttpError) {
    console.error('HTTP Error:', error.statusCode);
    console.error('Message:', error.message);
    console.error('Response body:', error.body);
    
    // Handle specific status codes
    switch (error.statusCode) {
      case 404:
        console.log('Resource not found');
        break;
      case 401:
        console.log('Unauthorized - check credentials');
        break;
      case 500:
        console.log('Server error:', error.body);
        break;
    }
  } else {
    // Network or other errors
    console.error('Network error:', error.message);
  }
}
```

### Stream Error Handling
```javascript
const stream = request.getStream();

stream.on('error', error => {
  console.error('Stream error:', error.message);
  
  if (stream.state === 'timeout') {
    console.log('Request timed out');
  } else if (stream.state === 'error') {
    console.log('Connection error');
  }
});

// Check response status
stream.on('data', () => {
  if (stream.statusCode && stream.statusCode !== 200) {
    console.warn('Non-200 status:', stream.statusCode);
  }
});
```

## Configuration & Control

### Request Disabling
```javascript
// Global request disabling (useful for testing)
global.Config = { noNetRequests: true };

try {
  await request.get();
} catch (error) {
  console.log(error.message); // "Net requests are disabled."
}
```

## Utility Methods

### `NetStream.encodeQuery(data: PostData): string`
Static method to manually encode query parameters.

```javascript
const queryString = Net.NetStream.encodeQuery({
  name: 'Ash Ketchum',
  region: 'Kanto',
  badges: 8
});
console.log(queryString); // "name=Ash%20Ketchum&region=Kanto&badges=8"

// Use in custom URLs
const url = `https://api.example.com/trainers?${queryString}`;
```

## Advanced Usage Examples

### API Client with Authentication
```javascript
class PokemonAPI {
  constructor(baseUrl, apiKey) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }
  
  createRequest(endpoint) {
    return Net(`${this.baseUrl}${endpoint}`);
  }
  
  async get(endpoint, params = {}) {
    const request = this.createRequest(endpoint);
    return request.get({
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Accept': 'application/json'
      },
      query: params,
      timeout: 10000
    });
  }
  
  async post(endpoint, data) {
    const request = this.createRequest(endpoint);
    return request.post({
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    }, JSON.stringify(data));
  }
}

// Usage
const api = new PokemonAPI('https://pokeapi.co/api/v2/', 'your-api-key');
const pokemon = await api.get('/pokemon/pikachu');
```

### Streaming JSON Parser
```javascript
async function streamingJsonProcessor(url) {
  const stream = Net(url).getStream({
    headers: { 'Accept': 'application/json' }
  });
  
  let buffer = '';
  let objectCount = 0;
  
  stream.on('data', chunk => {
    buffer += chunk;
    
    // Process complete JSON objects
    let braceCount = 0;
    let start = 0;
    
    for (let i = 0; i < buffer.length; i++) {
      if (buffer[i] === '{') braceCount++;
      if (buffer[i] === '}') braceCount--;
      
      if (braceCount === 0 && i > start) {
        try {
          const jsonStr = buffer.slice(start, i + 1);
          const obj = JSON.parse(jsonStr);
          console.log(`Object ${++objectCount}:`, obj);
          start = i + 1;
        } catch (e) {
          // Incomplete JSON, continue buffering
        }
      }
    }
    
    // Keep remaining buffer
    buffer = buffer.slice(start);
  });
  
  await stream.readAll(); // Wait for completion
}
```

### File Download with Progress
```javascript
async function downloadWithProgress(url, filename) {
  const stream = Net(url).getStream();
  const writeStream = fs.createWriteStream(filename);
  
  // Wait for headers to get content length
  const response = await stream.response;
  const totalSize = parseInt(response.headers['content-length'] || '0');
  
  let downloadedSize = 0;
  
  stream.on('data', chunk => {
    downloadedSize += chunk.length;
    const progress = totalSize ? (downloadedSize / totalSize * 100).toFixed(1) : 'unknown';
    console.log(`Download progress: ${progress}% (${downloadedSize}/${totalSize} bytes)`);
    
    writeStream.write(chunk);
  });
  
  stream.on('end', () => {
    writeStream.end();
    console.log('Download completed');
  });
  
  stream.on('error', error => {
    writeStream.destroy();
    fs.unlink(filename, () => {}); // Clean up partial file
    throw error;
  });
}
```

### Parallel Requests
```javascript
async function fetchMultipleEndpoints(baseUrl, endpoints) {
  const requests = endpoints.map(endpoint => {
    const request = Net(`${baseUrl}${endpoint}`);
    return request.get({
      headers: { 'Accept': 'application/json' },
      timeout: 5000
    }).then(data => ({ endpoint, data, success: true }))
      .catch(error => ({ endpoint, error, success: false }));
  });
  
  const results = await Promise.all(requests);
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`${successful.length} successful, ${failed.length} failed`);
  
  return {
    successful: successful.map(r => ({ endpoint: r.endpoint, data: JSON.parse(r.data) })),
    failed: failed.map(r => ({ endpoint: r.endpoint, error: r.error.message }))
  };
}
```

### Request Retry Logic
```javascript
async function requestWithRetry(url, options = {}, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const request = Net(url);
      return await request.get({
        ...options,
        timeout: options.timeout || 5000
      });
    } catch (error) {
      lastError = error;
      
      if (error instanceof Net.HttpError) {
        // Don't retry client errors (4xx)
        if (error.statusCode >= 400 && error.statusCode < 500) {
          throw error;
        }
      }
      
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt - 1) * 1000; // Exponential backoff
        console.log(`Request failed, retrying in ${delay}ms... (attempt ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}
```

## Best Practices

### Timeout Management
```javascript
// Set appropriate timeouts based on operation
const quickRequest = Net(url).get({ timeout: 3000 });     // Quick API calls
const fileUpload = Net(url).post({ timeout: 60000 });     // File operations
const streamingData = Net(url).getStream({ timeout: 0 }); // Streaming (no timeout)
```

### Memory Management for Large Responses
```javascript
// For large responses, use streaming instead of get()
const stream = Net(largeDataUrl).getStream();
const writeStream = fs.createWriteStream('large-response.json');

stream.pipe(writeStream);
await new Promise((resolve, reject) => {
  writeStream.on('finish', resolve);
  writeStream.on('error', reject);
});
// Memory efficient - doesn't load entire response into memory
```

### Request Pooling
```javascript
// Reuse NetRequest instances for the same domain
const apiClient = Net('https://api.example.com');

// Multiple requests to same domain
const users = await apiClient.get({ query: { endpoint: '/users' } });
const posts = await apiClient.get({ query: { endpoint: '/posts' } });
```

### Error Recovery
```javascript
async function robustRequest(url) {
  try {
    return await Net(url).get({ timeout: 5000 });
  } catch (error) {
    if (error instanceof Net.HttpError) {
      // Log HTTP errors but don't crash
      console.warn(`HTTP ${error.statusCode}: ${error.message}`);
      return null;
    } else {
      // Network errors might be temporary
      console.error('Network error:', error.message);
      throw error;
    }
  }
}
```
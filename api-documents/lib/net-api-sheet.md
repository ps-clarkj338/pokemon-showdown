# Pokemon Showdown Net API Usage Sheet

## Overview

The Net module provides an abstraction layer around Node.js HTTP/HTTPS request system, offering easier data acquisition and centralized control over outgoing requests. It includes streaming capabilities, error handling, and built-in request/response management.

## Basic Usage Pattern

```javascript
import { NetRequest, NetStream, HttpError } from './net';

// Create request instance
const request = new NetRequest('https://api.example.com/data');

// Make requests
const data = await request.get();
const result = await request.post({ headers: { 'Content-Type': 'application/json' } }, jsonData);
```

### Alternative Import Pattern: Factory Function

```javascript
import { Net } from './net';

// Using the factory function
const request = Net('https://api.example.com/data');
const data = await request.get();
```

---

## Interfaces

### `PostData`
Type definition for form data or query parameters.

```typescript
interface PostData {
  [key: string]: string | number;
}
```

### `NetRequestOptions`
Extends Node.js `https.RequestOptions` with additional Net-specific options.

```typescript
interface NetRequestOptions extends https.RequestOptions {
  body?: string | PostData;     // Request body data
  writable?: boolean;           // Whether stream should be writable
  query?: PostData;             // URL query parameters
}
```

---

## Core Classes

### `HttpError` Class
Custom error class for HTTP-related errors.

#### Constructor
```typescript
new HttpError(message: string, statusCode: number | undefined, body: string)
```

#### Properties
- **`statusCode?: number`** - HTTP status code from response
- **`body: string`** - Response body content
- **`name: string`** - Always 'HttpError'
- **`message: string`** - Error description

```javascript
// Error handling example
try {
  const data = await request.get();
} catch (error) {
  if (error instanceof HttpError) {
    console.log(`HTTP ${error.statusCode}: ${error.message}`);
    console.log('Response body:', error.body);
  }
}
```

### `NetStream` Class
Streaming interface for HTTP requests with real-time data processing.

#### Constructor
```typescript
new NetStream(uri: string, opts: NetRequestOptions)
```

#### Properties
- **`opts: NetRequestOptions | null`** - Request options
- **`uri: string`** - Target URI
- **`request: http.ClientRequest`** - Underlying Node.js request object
- **`response: Promise<http.IncomingMessage> | http.IncomingMessage`** - Response object or promise
- **`statusCode?: number`** - HTTP response status code
- **`headers?: http.IncomingHttpHeaders`** - Response headers
- **`state: 'pending' | 'open' | 'timeout' | 'success' | 'error'`** - Current stream state

#### Static Methods

##### `static encodeQuery(data: PostData): string`
**(Added: Previously missing from documentation)**
URL-encodes object data into query string format.

```javascript
const queryString = NetStream.encodeQuery({ 
  name: 'John Doe', 
  age: 30,
  city: 'New York'
});
// Returns: "name=John%20Doe&age=30&city=New%20York"
```

#### Instance Methods

##### `write(data: string): boolean`
Write data to the request stream.

```javascript
const stream = new NetStream('https://api.example.com/upload', {
  method: 'POST',
  writable: true
});

stream.write('chunk1');
stream.write('chunk2');
stream.end();
```

##### Event Handling Methods
- **`ondata(callback: (chunk: Buffer) => void)`** - Handle incoming data
- **`onend(callback: () => void)`** - Handle stream end
- **`onerror(callback: (error: Error) => void)`** - Handle errors

```javascript
const stream = new NetStream('https://api.example.com/stream');

stream.ondata((chunk) => {
  console.log('Received:', chunk.toString());
});

stream.onend(() => {
  console.log('Stream ended');
});

stream.onerror((error) => {
  console.error('Stream error:', error.message);
});
```

#### Standard Stream Events
NetStream also supports standard Node.js stream events:

```javascript
stream.on('data', (chunk) => {
  // Process data chunk
});

stream.on('end', () => {
  // Stream finished
});

stream.on('error', (error) => {
  // Handle error
});
```

### `NetRequest` Class
Main class for making HTTP requests with response caching.

#### Constructor
```typescript
new NetRequest(uri: string)
```

```javascript
const request = new NetRequest('https://jsonplaceholder.typicode.com/posts/1');
```

#### Methods

##### `getStream(opts?: NetRequestOptions): NetStream`
Create a streaming request for real-time data processing.

```javascript
const stream = request.getStream({ 
  timeout: 10000,
  headers: { 'Accept': 'application/json' }
});

let responseData = '';
stream.ondata((chunk) => {
  responseData += chunk.toString();
});

stream.onend(() => {
  console.log('Complete response:', responseData);
});
```

##### `get(opts?: NetRequestOptions): Promise<string>`
Perform GET request and return response body as string.

```javascript
// Simple GET request
const data = await request.get();

// GET with custom headers and timeout
const data = await request.get({
  headers: {
    'User-Agent': 'MyApp/1.0',
    'Authorization': 'Bearer token123'
  },
  timeout: 5000
});

// GET with query parameters
const searchRequest = new NetRequest('https://api.example.com/search');
const results = await searchRequest.get({
  query: {
    q: 'pokemon',
    limit: 10,
    page: 1
  }
});
// Requests: https://api.example.com/search?q=pokemon&limit=10&page=1
```

##### `post(opts?: NetRequestOptions, body?: string | PostData): Promise<string>`
Perform POST request with optional body data.

```javascript
// POST with JSON data
const response = await request.post({
  headers: { 'Content-Type': 'application/json' }
}, JSON.stringify({ name: 'Pikachu', type: 'Electric' }));

// POST with form data (automatically encoded)
const response = await request.post({
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
}, {
  username: 'trainer123',
  password: 'secret',
  remember: 1
});

// POST with custom options
const response = await request.post({
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your-api-key'
  }
}, userData);
```

---

## Factory Function

### `Net(path: string): NetRequest`
Factory function that creates NetRequest instances.

```javascript
import { Net } from './net';

// Equivalent to new NetRequest(path)
const api = Net('https://api.pokemon.com');
const pokemonData = await api.get();
```

The factory function also exposes the classes:
```javascript
// Access to classes via factory
const { NetRequest, NetStream } = Net;
```

---

## Advanced Usage Examples

### Error Handling with Status Codes

```javascript
import { NetRequest, HttpError } from './net';

async function fetchUserData(userId) {
  const request = new NetRequest(`https://api.example.com/users/${userId}`);
  
  try {
    const userData = await request.get({
      headers: { 'Authorization': 'Bearer ' + token },
      timeout: 10000
    });
    return JSON.parse(userData);
  } catch (error) {
    if (error instanceof HttpError) {
      switch (error.statusCode) {
        case 404:
          throw new Error('User not found');
        case 401:
          throw new Error('Authentication required');
        case 429:
          throw new Error('Rate limit exceeded');
        default:
          throw new Error(`HTTP ${error.statusCode}: ${error.message}`);
      }
    }
    throw error; // Re-throw non-HTTP errors
  }
}
```

### Streaming Large Responses

```javascript
import { NetStream } from './net';

async function downloadLargeFile(url, outputPath) {
  const stream = new NetStream(url, { timeout: 30000 });
  const chunks = [];
  
  return new Promise((resolve, reject) => {
    stream.ondata((chunk) => {
      chunks.push(chunk);
      console.log(`Downloaded: ${chunks.length} chunks`);
    });
    
    stream.onend(() => {
      const completeData = Buffer.concat(chunks);
      resolve(completeData);
    });
    
    stream.onerror((error) => {
      reject(error);
    });
  });
}
```

### Form Data Submission

```javascript
async function submitContactForm(formData) {
  const request = new NetRequest('https://example.com/contact');
  
  const response = await request.post({
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'ContactForm/1.0'
    },
    timeout: 15000
  }, {
    name: formData.name,
    email: formData.email,
    message: formData.message,
    timestamp: Date.now()
  });
  
  return JSON.parse(response);
}
```

### Request with Query Parameters

```javascript
async function searchPokemon(query, filters = {}) {
  const request = new NetRequest('https://pokeapi.co/api/v2/pokemon');
  
  const searchParams = {
    q: query,
    limit: filters.limit || 20,
    offset: filters.offset || 0,
    ...filters
  };
  
  const response = await request.get({
    query: searchParams,
    headers: {
      'Accept': 'application/json'
    },
    timeout: 10000
  });
  
  return JSON.parse(response);
}
```

---

## Configuration

The Net module respects global configuration for disabling outgoing requests:

```javascript
// When Config.nonetwork is true, all requests will be disabled
declare const Config: {
  nonetwork?: boolean;
};
```

This is useful for testing environments where external network calls should be blocked.

---

## Internal Implementation Notes

### Low-Level Stream Controls
**(Added: Previously missing from documentation)**

NetStream extends Node.js ReadWriteStream and implements:

- **`_read()`** - Internal method for handling stream backpressure
- **`_write()`** - Internal method for writing data to the request stream

These methods enable proper backpressure management but are typically not needed in high-level usage.

### State Management

NetStream tracks request lifecycle through the `state` property:
- **`pending`** - Request created but not started
- **`open`** - Request in progress
- **`timeout`** - Request timed out
- **`success`** - Request completed successfully
- **`error`** - Request failed with an error

```javascript
const stream = new NetStream('https://api.example.com/data');
console.log(stream.state); // 'pending'

stream.onend(() => {
  console.log(stream.state); // 'success' or 'error'
});
```

---

## Type Definitions Summary

```typescript
// Complete type definitions
interface PostData {
  [key: string]: string | number;
}

interface NetRequestOptions extends https.RequestOptions {
  body?: string | PostData;
  writable?: boolean;
  query?: PostData;
}

class HttpError extends Error {
  statusCode?: number;
  body: string;
  constructor(message: string, statusCode: number | undefined, body: string);
}

class NetStream extends ReadWriteStream {
  opts: NetRequestOptions | null;
  uri: string;
  request: http.ClientRequest;
  response: Promise<http.IncomingMessage> | http.IncomingMessage;
  statusCode?: number;
  headers?: http.IncomingHttpHeaders;
  state: 'pending' | 'open' | 'timeout' | 'success' | 'error';
  
  static encodeQuery(data: PostData): string;
  write(data: string): boolean;
  ondata(callback: (chunk: Buffer) => void): void;
  onend(callback: () => void): void;
  onerror(callback: (error: Error) => void): void;
}

class NetRequest {
  constructor(uri: string);
  getStream(opts?: NetRequestOptions): NetStream;
  get(opts?: NetRequestOptions): Promise<string>;
  post(opts?: NetRequestOptions, body?: string | PostData): Promise<string>;
}

declare const Net: ((path: string) => NetRequest) & {
  NetRequest: typeof NetRequest;
  NetStream: typeof NetStream;
};
```
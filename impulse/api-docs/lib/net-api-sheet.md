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

## Alternative Import Pattern (Factory Function)

```javascript
import Net from './net';

// Using the factory function
const request = Net('https://api.example.com/data');
const data = await request.get();
```

## Core Classes

### `NetRequest` Class
Main class for making HTTP requests with response caching.

#### Constructor
```javascript
const request = new NetRequest('https://api.example.com');
// or using the factory function (if available)
const request = Net('https://api.example.com');
```

#### Basic Methods

##### `get(options?)`
Makes a GET request to the specified URL.

```javascript
// Simple GET request
const data = await request.get();

// GET with headers
const data = await request.get({
    headers: {
        'User-Agent': 'Pokemon-Showdown/1.0',
        'Accept': 'application/json'
    }
});
```

##### `post(options?, data?)`
Makes a POST request with optional data.

```javascript
// POST with JSON data
const response = await request.post({
    headers: { 'Content-Type': 'application/json' }
}, JSON.stringify({ key: 'value' }));

// POST with form data
const response = await request.post({
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
}, 'key=value&other=data');
```

### `NetStream` Class
Streaming interface for HTTP requests with real-time data processing.

#### Constructor
```javascript
const stream = new NetStream('wss://example.com/stream');
```

#### Methods

##### `write(data)`
Writes data to the stream.

```javascript
stream.write('Hello, WebSocket!');
```

##### Event Handling
```javascript
stream.on('data', (chunk) => {
    console.log('Received:', chunk.toString());
});

stream.on('end', () => {
    console.log('Stream ended');
});

stream.on('error', (err) => {
    console.error('Stream error:', err);
});
```

### `HttpError` Class
Custom error class for HTTP-related errors.

#### Properties
- `statusCode`: HTTP status code
- `body`: Response body content
- `message`: Error message

#### Usage
```javascript
import { NetRequest, HttpError } from './net';

try {
    const data = await request.get();
} catch (error) {
    if (error instanceof HttpError) {
        console.log('HTTP Error:', error.statusCode, error.message);
        console.log('Response body:', error.body);
    }
}
```

## Configuration Options

### Request Options Interface
```javascript
interface NetRequestOptions {
    headers?: { [key: string]: string };
    body?: string | PostData;
    writable?: boolean;
    query?: PostData;
    timeout?: number;
    // ... other https.RequestOptions
}
```

### PostData Interface
```javascript
interface PostData {
    [key: string]: string | number;
}
```

## Advanced Usage

### Query Parameters
```javascript
const request = new NetRequest('https://api.example.com/search');
const data = await request.get({
    query: {
        q: 'pokemon',
        limit: 10,
        offset: 0
    }
});
// This will request: https://api.example.com/search?q=pokemon&limit=10&offset=0
```

### Custom Headers
```javascript
const request = new NetRequest('https://api.example.com');
const data = await request.get({
    headers: {
        'Authorization': 'Bearer token123',
        'User-Agent': 'Pokemon-Showdown/1.0',
        'Accept': 'application/json'
    }
});
```

### Handling Different Response Types
```javascript
// JSON response
const jsonData = await request.get({
    headers: { 'Accept': 'application/json' }
});

// Text response
const textData = await request.get({
    headers: { 'Accept': 'text/plain' }
});

// Binary data
const binaryData = await request.get({
    headers: { 'Accept': 'application/octet-stream' }
});
```

## Error Handling

### Basic Error Handling
```javascript
import { NetRequest, HttpError } from './net';

const request = new NetRequest('https://api.example.com');

try {
    const data = await request.get();
    console.log('Success:', data);
} catch (error) {
    if (error instanceof HttpError) {
        console.error(`HTTP ${error.statusCode}: ${error.message}`);
        console.error('Response body:', error.body);
    } else {
        console.error('Network error:', error.message);
    }
}
```

### Specific Status Code Handling
```javascript
try {
    const data = await request.get();
} catch (error) {
    if (error instanceof HttpError) {
        switch (error.statusCode) {
            case 404:
                console.log('Resource not found');
                break;
            case 401:
                console.log('Unauthorized - check credentials');
                break;
            case 500:
                console.log('Server error');
                break;
            default:
                console.log(`HTTP error: ${error.statusCode}`);
        }
    }
}
```

## Best Practices

### 1. Always Handle Errors
```javascript
// Good
try {
    const data = await request.get();
    return data;
} catch (error) {
    console.error('Request failed:', error);
    return null;
}

// Avoid - unhandled errors can crash the application
const data = await request.get(); // No error handling
```

### 2. Set Appropriate Timeouts
```javascript
const request = new NetRequest('https://slow-api.example.com');
const data = await request.get({
    timeout: 5000 // 5 second timeout
});
```

### 3. Use Specific Content-Type Headers
```javascript
// For JSON APIs
const response = await request.post({
    headers: { 'Content-Type': 'application/json' }
}, JSON.stringify(data));

// For form submissions
const response = await request.post({
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
}, 'key=value&other=data');
```

### 4. Reuse Request Instances
```javascript
// Good - reuse for same base URL
const apiRequest = new NetRequest('https://api.example.com');
const users = await apiRequest.get({ query: { endpoint: 'users' } });
const posts = await apiRequest.get({ query: { endpoint: 'posts' } });

// Less efficient - creating new instances
const userRequest = new NetRequest('https://api.example.com/users');
const postRequest = new NetRequest('https://api.example.com/posts');
```

## Common Patterns

### API Client Wrapper
```javascript
import { NetRequest, HttpError } from './net';

class APIClient {
    private request: NetRequest;

    constructor(baseURL: string, private apiKey: string) {
        this.request = new NetRequest(baseURL);
    }

    private getHeaders() {
        return {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'User-Agent': 'Pokemon-Showdown/1.0'
        };
    }

    async get(endpoint: string, params?: any) {
        try {
            return await this.request.get({
                headers: this.getHeaders(),
                query: params
            });
        } catch (error) {
            if (error instanceof HttpError && error.statusCode === 401) {
                throw new Error('API authentication failed');
            }
            throw error;
        }
    }

    async post(endpoint: string, data: any) {
        return await this.request.post({
            headers: this.getHeaders()
        }, JSON.stringify(data));
    }
}

// Usage
const client = new APIClient('https://api.example.com', 'your-api-key');
const userData = await client.get('/users/123');
```

### WebSocket-like Streaming
```javascript
import { NetStream } from './net';

const stream = new NetStream('wss://live-updates.example.com');

stream.on('data', (data) => {
    const message = JSON.parse(data.toString());
    console.log('Live update:', message);
});

stream.on('error', (error) => {
    console.error('Stream error:', error);
    // Implement reconnection logic
});

stream.on('end', () => {
    console.log('Stream ended, attempting reconnection...');
    // Implement reconnection logic
});
```

## Security Considerations

### 1. Validate URLs
```javascript
function isValidURL(url: string): boolean {
    try {
        const parsed = new URL(url);
        return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
        return false;
    }
}

if (isValidURL(userProvidedURL)) {
    const request = new NetRequest(userProvidedURL);
    // ... proceed with request
}
```

### 2. Sanitize Headers
```javascript
function sanitizeHeaders(headers: any): { [key: string]: string } {
    const safe: { [key: string]: string } = {};
    for (const [key, value] of Object.entries(headers)) {
        if (typeof key === 'string' && typeof value === 'string') {
            safe[key] = value;
        }
    }
    return safe;
}
```

### 3. Handle Sensitive Data
```javascript
// Don't log sensitive information
try {
    const response = await request.post({
        headers: { 'Authorization': `Bearer ${token}` }
    }, sensitiveData);
} catch (error) {
    // Log error without sensitive details
    console.error('Request failed:', error.message);
    // Don't log: error.body (might contain sensitive data)
}
```

## Migration Notes

If migrating from older Net implementations:

### Old Pattern
```javascript
// Old way (if it existed)
const Net = require('./net');
Net.get('https://example.com', callback);
```

### New Pattern
```javascript
// New way
import { NetRequest } from './net';
const request = new NetRequest('https://example.com');
const data = await request.get();
```

The new implementation provides:
- Promise-based API (async/await support)
- Better error handling with custom HttpError class
- Type safety with TypeScript interfaces
- Streaming capabilities
- More consistent API design

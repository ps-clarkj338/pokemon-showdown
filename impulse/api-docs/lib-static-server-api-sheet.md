# Pokémon Showdown `lib/static-server.ts` - Complete API Reference

## Overview

The `lib/static-server.ts` module provides a lightweight, Promise-based static file server inspired by node-static but optimized for Pokémon Showdown's needs. It handles HTTP range requests, gzip compression, caching headers, MIME type detection, and directory serving with robust error handling.

## Basic Usage

```typescript
import { StaticServer } from '../lib/static-server';

// Create server instance
const server = new StaticServer('public', {
  cacheTime: 3600,      // 1 hour cache
  gzip: true,          // Enable gzip compression
  indexFile: 'index.html'
});

// Serve files in HTTP handler
app.use(async (req, res) => {
  const result = await server.serve(req, res);
  // Server handles response automatically unless errorCallback returns true
});
```

## Constructor Options

### `StaticServer(root?, options?)`

Create a new static server instance.

```typescript
// Basic constructor
const server = new StaticServer('./public');

// With root directory
const server = new StaticServer('/var/www/html', {
  cacheTime: 7200,
  gzip: true
});

// Options-only constructor
const server = new StaticServer({
  root: './assets',
  indexFile: 'home.html',
  defaultExtension: 'html',
  cacheTime: 3600
});
```

### `Options` Interface

```typescript
interface Options {
  root?: string;                    // Root directory (default: current directory)
  indexFile?: string;              // Directory index file (default: 'index.html')
  defaultExtension?: string;       // Extension to try if file not found
  cacheTime?: number | null;       // Cache time in seconds (default: 3600, null = no cache)
  gzip?: boolean | RegExp;         // Enable gzip compression
  headers?: Headers;               // Custom headers for success responses
  serverInfo?: string | null;      // Server header value (null to disable)
}
```

## Core Methods

### `serve(req, res, errorCallback?): Promise<Result>`

**⭐ Primary method** - Serve static files for HTTP requests with automatic response handling.

```typescript
// Basic usage
const result = await server.serve(req, res);

// With custom error handling
const result = await server.serve(req, res, (result) => {
  if (result.status === 404) {
    res.writeHead(404, {'Content-Type': 'text/html'});
    res.end('<h1>Custom 404 Page</h1>');
    return true; // Suppress default error page
  }
  return false; // Use default error page
});

// Complete server implementation
const http = require('http');
const server = http.createServer(async (req, res) => {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  const staticServer = new StaticServer('public', {
    cacheTime: 3600,
    gzip: /\.(js|css|html|json)$/,
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY'
    }
  });
  
  await staticServer.serve(req, res, (result) => {
    if (result.status === 404 && req.url?.startsWith('/api/')) {
      // API endpoints should return JSON 404
      res.writeHead(404, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({ error: 'Not Found' }));
      return true;
    }
    return false;
  });
});
```

### `serveFile(pathname, status, headers, req, res, errorCallback?): Promise<Result>`

**⭐ For specific file serving** - Serve a specific file with custom status and headers.

```typescript
// Serve specific file
const result = await server.serveFile('assets/pokemon.json', 200, {
  'Content-Type': 'application/json',
  'Cache-Control': 'max-age=300'
}, req, res);

// Serve with custom status
const result = await server.serveFile('templates/maintenance.html', 503, {
  'Content-Type': 'text/html',
  'Retry-After': '3600'
}, req, res);

// File streaming with range support
const result = await server.serveFile('videos/battle-replay.mp4', 200, {
  'Accept-Ranges': 'bytes'
}, req, res); // Automatically handles HTTP Range requests
```

### `serveDir(pathname, req, res): Promise<Result>`

**⭐ For directory serving** - Serve directory index files with proper redirects.

```typescript
// Directory serving with index.html
const result = await server.serveDir('/pokemon-data/', req, res);

// Custom directory behavior
class CustomStaticServer extends StaticServer {
  async serveDir(pathname: string, req: http.IncomingMessage, res: http.ServerResponse) {
    // Try custom index files in order
    const indexFiles = ['index.html', 'default.html', 'home.html'];
    
    for (const indexFile of indexFiles) {
      const indexPath = path.join(pathname, indexFile);
      try {
        const stat = await fsP.stat(indexPath);
        if (stat.isFile()) {
          return this.respond(200, {}, indexPath, stat, req, res);
        }
      } catch {
        continue; // Try next index file
      }
    }
    
    // Generate directory listing
    return this.generateDirectoryListing(pathname, req, res);
  }
  
  async generateDirectoryListing(pathname: string, req: http.IncomingMessage, res: http.ServerResponse) {
    try {
      const files = await fsP.readdir(pathname);
      const listing = `
        <!DOCTYPE html>
        <html>
        <head><title>Directory Listing</title></head>
        <body>
          <h1>Directory Listing</h1>
          <ul>
            ${files.map(file => `<li><a href="${file}">${file}</a></li>`).join('')}
          </ul>
        </body>
        </html>
      `;
      
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(listing);
      return this.getResult(200, {}, true);
    } catch {
      return this.getResult(404);
    }
  }
}
```

## Utility Methods

### `resolve(pathname): string`

Resolve pathname relative to server root.

```typescript
const server = new StaticServer('/var/www');
const fullPath = server.resolve('assets/pokemon.png');
// Returns: '/var/www/assets/pokemon.png'

// Safe path resolution (prevents directory traversal)
const safePath = server.resolve('../../../etc/passwd'); 
// Still returns path within /var/www root
```

### `getResult(status, headers?, alreadySent?): Result`

Create standardized result object.

```typescript
// Basic result
const result = server.getResult(200);
// { status: 200, headers: {...}, message: 'OK', alreadySent: false }

// Custom headers
const result = server.getResult(201, {
  'Location': '/api/created-resource',
  'Content-Type': 'application/json'
});

// Mark as already sent (prevents double response)
const result = server.getResult(200, {}, true);
```

### `finish(result, req, res, errorCallback?): Result`

Complete the HTTP response.

```typescript
// Manual response handling
const result = await server.servePath('/api/data.json', 200, {}, req, res);
const finalResult = server.finish(result, req, res, (result) => {
  if (result.status >= 500) {
    console.error('Server error serving file');
    // Custom error page
    res.writeHead(500, {'Content-Type': 'text/html'});
    res.end('<h1>Internal Server Error</h1>');
    return true; // Suppress default error page
  }
  return false;
});
```

## Advanced Features

### Gzip Compression Support

```typescript
// Enable gzip for all files
const server = new StaticServer('public', { gzip: true });

// Enable gzip for specific file types
const server = new StaticServer('public', { 
  gzip: /\.(js|css|html|json|svg)$/ 
});

// Manual gzip checking
const shouldGzip = server.gzipOk(req, 'application/javascript');
if (shouldGzip) {
  // Serve compressed version
}
```

### HTTP Range Request Support

```typescript
// Range requests are handled automatically
// Client sends: Range: bytes=200-1000
// Server responds with: Content-Range: bytes 200-1000/5000

// Manual range parsing
const range = server.parseByteRange(req, fileStat);
if (range.valid) {
  console.log(`Serving bytes ${range.from}-${range.to}`);
}
```

### Custom MIME Types

```typescript
// Built-in MIME types (can be extended)
const mimeTypes = {
  '.html': 'text/html;charset=utf-8',
  '.js': 'application/javascript;charset=utf-8',
  '.css': 'text/css;charset=utf-8',
  '.json': 'application/json;charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  // ... many more
};

// Add custom MIME types
StaticServer.mimeTypes['.pokemon'] = 'application/x-pokemon-data';
StaticServer.mimeTypes['.replay'] = 'application/x-ps-replay';
```

## Result Object

### `Result` Interface

```typescript
interface Result {
  status: number;          // HTTP status code
  headers: Headers;        // Response headers  
  message: string | undefined; // Status message
  alreadySent: boolean;    // Whether response was already sent
}
```

### Status Code Handling

```typescript
async function handleStaticRequest(req, res) {
  const result = await server.serve(req, res, (result) => {
    switch (result.status) {
      case 404:
        // Custom 404 page
        res.writeHead(404, {'Content-Type': 'text/html'});
        res.end('<h1>Pokemon Not Found!</h1>');
        return true;
        
      case 403:
        // Log forbidden access attempts
        console.warn(`Forbidden access attempt: ${req.url} from ${req.connection.remoteAddress}`);
        return false; // Use default error page
        
      case 500:
        // Server error - log and show generic error
        console.error('Static server error:', result);
        res.writeHead(500, {'Content-Type': 'text/plain'});
        res.end('Internal Server Error');
        return true;
        
      default:
        return false; // Use default handling
    }
  });
}
```

## Common Usage Patterns

### Safari Zone Asset Serving

```typescript
class SafariZoneAssetServer {
  private server: StaticServer;
  
  constructor() {
    this.server = new StaticServer('safari-zone-assets', {
      cacheTime: 86400, // 24 hours
      gzip: /\.(js|css|html|json|svg)$/,
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
  
  async serveAssets(req: http.IncomingMessage, res: http.ServerResponse) {
    return this.server.serve(req, res, (result) => {
      if (result.status === 404) {
        // Try fallback for missing Pokemon sprites
        return this.serveFallbackSprite(req, res);
      }
      return false;
    });
  }
  
  private serveFallbackSprite(req: http.IncomingMessage, res: http.ServerResponse) {
    // Serve default Pokemon sprite for missing ones
    const defaultSprite = 'sprites/unknown.png';
    this.server.serveFile(defaultSprite, 200, {
      'Cache-Control': 'max-age=300' // Short cache for fallbacks
    }, req, res);
    return true;
  }
}
```

### Plugin Resource Server

```typescript
class PluginResourceServer {
  private staticServers = new Map<string, StaticServer>();
  
  getServerForPlugin(pluginName: string): StaticServer {
    if (!this.staticServers.has(pluginName)) {
      this.staticServers.set(pluginName, new StaticServer(`chat-plugins/${pluginName}/assets`, {
        cacheTime: 3600,
        gzip: true,
        headers: {
          'X-Plugin': pluginName,
          'Access-Control-Allow-Origin': '*'
        }
      }));
    }
    return this.staticServers.get(pluginName)!;
  }
  
  async servePluginAsset(pluginName: string, req: http.IncomingMessage, res: http.ServerResponse) {
    const server = this.getServerForPlugin(pluginName);
    
    return server.serve(req, res, (result) => {
      if (result.status === 404) {
        res.writeHead(404, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({ 
          error: 'Asset not found',
          plugin: pluginName,
          path: req.url
        }));
        return true;
      }
      return false;
    });
  }
}
```

### Development Server with Hot Reload

```typescript
class DevelopmentStaticServer extends StaticServer {
  private watchedFiles = new Set<string>();
  private clients = new Set<http.ServerResponse>();
  
  constructor(root: string) {
    super(root, {
      cacheTime: 0, // No caching in development
      gzip: false,  // Skip compression for faster reloads
      headers: {
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
  
  async serve(req: http.IncomingMessage, res: http.ServerResponse) {
    // Add hot reload script injection for HTML files
    return super.serve(req, res, (result) => {
      if (result.status === 200 && req.url?.endsWith('.html')) {
        this.injectHotReloadScript(res);
      }
      return false;
    });
  }
  
  private injectHotReloadScript(res: http.ServerResponse) {
    // Add hot reload WebSocket client script
    const script = `
      <script>
        const ws = new WebSocket('ws://localhost:8081/hot-reload');
        ws.onmessage = () => location.reload();
      </script>
    `;
    
    // Note: This is simplified - real implementation would need to modify the HTML stream
  }
  
  watchFile(filepath: string) {
    if (this.watchedFiles.has(filepath)) return;
    
    this.watchedFiles.add(filepath);
    FS(filepath).onModify(() => {
      this.notifyClients();
    });
  }
  
  private notifyClients() {
    // Notify all connected clients to reload
    // Implementation would depend on WebSocket setup
  }
}
```

### Conditional Serving with Authentication

```typescript
class AuthenticatedStaticServer extends StaticServer {
  private authenticator: (req: http.IncomingMessage) => boolean;
  
  constructor(root: string, authenticator: (req: http.IncomingMessage) => boolean) {
    super(root, {
      cacheTime: 0, // No caching for authenticated content
      headers: {
        'Cache-Control': 'private, no-store',
        'X-Frame-Options': 'SAMEORIGIN'
      }
    });
    this.authenticator = authenticator;
  }
  
  async serve(req: http.IncomingMessage, res: http.ServerResponse) {
    // Check authentication first
    if (!this.authenticator(req)) {
      res.writeHead(401, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({ error: 'Authentication required' }));
      return this.getResult(401, {}, true);
    }
    
    // Add user context to headers
    const userHeader = this.extractUser(req);
    return super.serve(req, res, (result) => {
      if (result.status === 200) {
        result.headers['X-User'] = userHeader;
      }
      return false;
    });
  }
  
  private extractUser(req: http.IncomingMessage): string {
    // Extract user from auth header, session, etc.
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) {
      // Decode JWT or validate token
      return 'authenticated-user';
    }
    return 'anonymous';
  }
}
```

### API Endpoint Integration

```typescript
class HybridServer {
  private staticServer: StaticServer;
  private apiRoutes: Map<string, (req: http.IncomingMessage, res: http.ServerResponse) => void>;
  
  constructor() {
    this.staticServer = new StaticServer('public');
    this.apiRoutes = new Map();
    this.setupRoutes();
  }
  
  private setupRoutes() {
    // API endpoints
    this.apiRoutes.set('/api/safari/status', this.handleSafariStatus);
    this.apiRoutes.set('/api/safari/leaderboard', this.handleLeaderboard);
    this.apiRoutes.set('/api/pokemon/search', this.handlePokemonSearch);
  }
  
  async handle(req: http.IncomingMessage, res: http.ServerResponse) {
    const url = new URL(req.url!, 'http://localhost');
    
    // Check if it's an API route
    if (this.apiRoutes.has(url.pathname)) {
      const handler = this.apiRoutes.get(url.pathname)!;
      return handler(req, res);
    }
    
    // Serve static files
    return this.staticServer.serve(req, res, (result) => {
      if (result.status === 404 && url.pathname.startsWith('/safari/')) {
        // SPA fallback - serve index.html for Safari Zone routes
        return this.staticServer.serveFile('index.html', 200, {
          'Content-Type': 'text/html'
        }, req, res);
      }
      return false;
    });
  }
  
  private handleSafariStatus = (req: http.IncomingMessage, res: http.ServerResponse) => {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({
      active: true,
      players: this.getActivePlayerCount(),
      zones: this.getAvailableZones()
    }));
  };
  
  private handleLeaderboard = async (req: http.IncomingMessage, res: http.ServerResponse) => {
    const leaderboard = await this.getLeaderboardData();
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify(leaderboard));
  };
}
```

### Content Delivery Optimization

```typescript
class OptimizedStaticServer extends StaticServer {
  private compressionCache = new Map<string, Buffer>();
  
  constructor(root: string) {
    super(root, {
      cacheTime: 31536000, // 1 year for production assets
      gzip: /\.(js|css|html|json|svg|xml)$/,
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'Referrer-Policy': 'strict-origin-when-cross-origin'
      }
    });
  }
  
  async serve(req: http.IncomingMessage, res: http.ServerResponse) {
    // Add security headers for all responses
    this.addSecurityHeaders(res);
    
    return super.serve(req, res, (result) => {
      if (result.status === 200) {
        this.addPerformanceHeaders(result, req);
      } else if (result.status === 404) {
        this.logNotFound(req);
      }
      return false;
    });
  }
  
  private addSecurityHeaders(res: http.ServerResponse) {
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  }
  
  private addPerformanceHeaders(result: Result, req: http.IncomingMessage) {
    // Add CDN and caching headers
    result.headers['CDN-Cache-Control'] = 'max-age=31536000';
    result.headers['Vary'] = 'Accept-Encoding, User-Agent';
    
    // Add resource hints for common files
    if (req.url?.endsWith('.html')) {
      result.headers['Link'] = '</assets/style.css>; rel=preload; as=style, </assets/app.js>; rel=preload; as=script';
    }
  }
  
  private logNotFound(req: http.IncomingMessage) {
    console.warn(`404 Not Found: ${req.url} from ${req.socket.remoteAddress}`);
  }
}
```

## MIME Type System

### Built-in MIME Types

The server includes comprehensive MIME type detection:

```typescript
// Text formats
'.html': 'text/html;charset=utf-8'
'.css': 'text/css;charset=utf-8'
'.js': 'application/javascript;charset=utf-8'
'.json': 'application/json;charset=utf-8'
'.txt': 'text/plain;charset=utf-8'
'.md': 'text/markdown;charset=utf-8'

// Images
'.png': 'image/png'
'.jpg': 'image/jpeg'  
'.gif': 'image/gif'
'.svg': 'image/svg+xml;charset=utf-8'
'.ico': 'image/x-icon'

// Fonts
'.woff': 'font/woff'
'.woff2': 'font/woff2'
'.ttf': 'font/ttf'

// Audio/Video
'.mp3': 'audio/mpeg'
'.mp4': 'video/mp4'
'.webm': 'video/webm'

// Archives
'.zip': 'application/zip'
'.gz': 'application/gzip'
```

### Custom MIME Types

```typescript
// Add Pokemon Showdown specific types
mimeTypes['.psreplay'] = 'application/x-pokemon-showdown-replay';
mimeTypes['.psteam'] = 'application/x-pokemon-team';
mimeTypes['.pokeset'] = 'application/x-pokemon-set';

// Usage in server
const server = new StaticServer('replays', {
  headers: {
    'Content-Disposition': 'attachment' // Force download for .psreplay files
  }
});
```

## Caching Strategies

### Cache Control Options

```typescript
// No caching (development)
const devServer = new StaticServer('src', { cacheTime: 0 });

// Short cache (dynamic content)
const dynamicServer = new StaticServer('dynamic', { cacheTime: 300 }); // 5 minutes

// Long cache (static assets)
const assetsServer = new StaticServer('assets', { cacheTime: 31536000 }); // 1 year

// No cache headers
const noCacheServer = new StaticServer('temp', { cacheTime: null });
```

### Conditional Caching

```typescript
class SmartCachingServer extends StaticServer {
  setCacheHeaders(headers: Headers): Headers {
    const pathname = this.currentRequest?.url;
    
    if (pathname?.includes('/api/')) {
      // Short cache for API responses
      headers['cache-control'] = 'max-age=60';
    } else if (pathname?.match(/\.(css|js|png|jpg)$/)) {
      // Long cache for assets with versioning
      headers['cache-control'] = 'max-age=31536000, immutable';
    } else {
      // Default cache for other content
      headers['cache-control'] = 'max-age=3600';
    }
    
    return headers;
  }
}
```

## Error Handling Patterns

### Comprehensive Error Handling

```typescript
class RobustStaticServer {
  private server: StaticServer;
  private errorLog: string[] = [];
  
  constructor(root: string) {
    this.server = new StaticServer(root);
  }
  
  async serveWithFallbacks(req: http.IncomingMessage, res: http.ServerResponse) {
    return this.server.serve(req, res, (result) => {
      this.logError(result, req);
      
      switch (result.status) {
        case 404:
          return this.handle404(req, res);
        case 403:
          return this.handle403(req, res);
        case 500:
          return this.handle500(req, res);
        default:
          return false;
      }
    });
  }
  
  private logError(result: Result, req: http.IncomingMessage) {
    if (result.status >= 400) {
      const logEntry = `${new Date().toISOString()} ${result.status} ${req.method} ${req.url} ${req.headers['user-agent']}`;
      this.errorLog.push(logEntry);
      
      // Keep only last 1000 errors
      if (this.errorLog.length > 1000) {
        this.errorLog.shift();
      }
    }
  }
  
  private handle404(req: http.IncomingMessage, res: http.ServerResponse) {
    // Try to serve a custom 404 page
    this.server.serveFile('404.html', 404, {
      'Content-Type': 'text/html'
    }, req, res);
    return true;
  }
  
  private handle403(req: http.IncomingMessage, res: http.ServerResponse) {
    res.writeHead(403, {'Content-Type': 'text/plain'});
    res.end('Access Denied');
    return true;
  }
  
  private handle500(req: http.IncomingMessage, res: http.ServerResponse) {
    console.error('Static server internal error for:', req.url);
    res.writeHead(500, {'Content-Type': 'text/html'});
    res.end('<h1>Internal Server Error</h1><p>Please try again later.</p>');
    return true;
  }
  
  getErrorLog() {
    return [...this.errorLog];
  }
}
```

## Security Features

### Path Traversal Prevention

```typescript
// Automatic path traversal prevention
const server = new StaticServer('/var/www/html');

// These requests are automatically blocked:
// GET /../../../etc/passwd -> 403 Forbidden
// GET /./hidden-file      -> Resolved safely
// GET /%2E%2E%2Fpasswd   -> URL decoded and blocked
```

### Security Headers

```typescript
const secureServer = new StaticServer('public', {
  headers: {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "default-src 'self'"
  }
});
```

## Performance Features

### HTTP Range Request Support

```typescript
// Automatic range request handling for large files
// Client: Range: bytes=0-1023
// Server: Content-Range: bytes 0-1023/1048576
//         Status: 206 Partial Content

// Perfect for:
// - Video streaming
// - Large asset downloads
// - Resume functionality
// - Bandwidth optimization
```

### Compression Optimization

```typescript
// Intelligent gzip compression
const server = new StaticServer('assets', {
  gzip: /\.(js|css|html|json|svg|xml|txt)$/ // Compress text-based files
});

// Automatic .gz file serving
// If client requests 'app.js' and 'app.js.gz' exists:
// - Checks client Accept-Encoding for gzip support
// - Serves .gz file with proper Content-Encoding header
// - Adds Vary: Accept-Encoding header
```

## Integration Examples

### Express.js Integration

```typescript
import express from 'express';

const app = express();
const staticServer = new StaticServer('public', {
  cacheTime: 3600,
  gzip: true
});

app.use('/assets', async (req, res, next) => {
  const result = await staticServer.serve(req, res, (result) => {
    if (result.status === 404) {
      next(); // Pass to next middleware
      return true;
    }
    return false;
  });
  
  if (!result.alreadySent) {
    // Handle any remaining cases
    res.status(result.status).end(result.message);
  }
});
```

### Pokémon Showdown Integration

```typescript
// In your chat plugin
export const pages: PageTable = {
  safari(args, user) {
    // Serve Safari Zone UI assets
    const staticServer = new StaticServer('chat-plugins/safari-zone/public');
    
    if (args[0] === 'assets') {
      return staticServer.serve(this.req, this.res, (result) => {
        if (result.status === 404) {
          this.res.writeHead(404, {'Content-Type': 'text/plain'});
          this.res.end('Safari Zone asset not found');
          return true;
        }
        return false;
      });
    }
    
    // Serve main Safari Zone interface
    return staticServer.serveFile('safari-zone.html', 200, {
      'Content-Type': 'text/html',
      'X-User': user.id
    }, this.req, this.res);
  }
};
```

## Best Practices

1. **Set appropriate cache times** - Long for static assets, short for dynamic content
2. **Enable gzip compression** for text-based files to reduce bandwidth
3. **Use security headers** to protect against common web vulnerabilities
4. **Handle errors gracefully** with custom error pages
5. **Log 404s and security events** for monitoring
6. **Use HTTPS in production** with proper SSL headers
7. **Implement rate limiting** for public-facing servers
8. **Monitor file access patterns** for optimization opportunities

## Constants and Utilities

### `SERVER_INFO: string`
Default server identification string: `'node-static-vendored/1.0'`

### `mimeTypes: Record<string, string>`
Complete MIME type mapping for file extensions

### `Headers: Record<string, string>`
Type alias for HTTP headers object

The static server provides a robust, production-ready foundation for serving web assets in Pokémon Showdown plugins with built-in security, performance optimizations, and flexible error handling.
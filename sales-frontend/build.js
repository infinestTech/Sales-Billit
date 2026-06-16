const fs = require('fs');
const path = require('path');

console.log('🚀 Building Sales Frontend for Production...');

// Create dist directory if it doesn't exist
const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

// Copy all necessary files to dist
const filesToCopy = [
    'index.html',
    'styles.css',
    'server.js',
    'package.json',
    '.env'
];

console.log('📁 Copying static files...');
filesToCopy.forEach(file => {
    const srcPath = path.join(__dirname, file);
    const destPath = path.join(distDir, file);
    
    if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
        console.log(`✅ Copied ${file}`);
    }
});

// Copy src directory recursively
console.log('📂 Copying source files...');
function copyDirSync(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    
    const items = fs.readdirSync(src);
    
    items.forEach(item => {
        const srcPath = path.join(src, item);
        const destPath = path.join(dest, item);
        const stat = fs.statSync(srcPath);
        
        if (stat.isDirectory()) {
            copyDirSync(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    });
}

const srcDir = path.join(__dirname, 'src');
const destSrcDir = path.join(distDir, 'src');
copyDirSync(srcDir, destSrcDir);
console.log('✅ Copied src/ directory');

// Create production server configuration
const prodServerContent = `require('dotenv').config();

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3020;
const root = __dirname;

// Production optimizations
const isProduction = process.env.NODE_ENV === 'production';

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.jsx': 'text/plain; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// Cache headers for production
const getCacheHeaders = (ext) => {
  if (!isProduction) return {};
  
  const headers = {
    'Cache-Control': 'public, max-age=3600', // 1 hour default
  };
  
  if (['.js', '.css'].includes(ext)) {
    headers['Cache-Control'] = 'public, max-age=86400'; // 24 hours for assets
  }
  
  return headers;
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, \`http://localhost:\${PORT}\`).pathname);
  
  // Handle dynamic environment config
  if (urlPath === '/src/config/env.js') {
    const configContent = \`// Environment configuration for sales frontend
// This file provides environment variables globally

window.ENV_CONFIG = {
  SALES_API_URL: '\${process.env.VITE_SALES_API_URL || 'https://sales.infinestech.com'}',
  AUTH_API_URL: '\${process.env.VITE_AUTH_API_URL || 'https://auth.infinestech.com'}',
  WHATSAPP_WEB_URL: '\${process.env.VITE_WHATSAPP_WEB_URL || 'https://web.whatsapp.com'}'
};

// For backward compatibility, also set SALES_URL
window.SALES_URL = window.ENV_CONFIG.SALES_API_URL;

console.log('🔧 Environment config loaded:', window.ENV_CONFIG);\`;

    const headers = {
      'Content-Type': 'application/javascript; charset=utf-8',
      ...getCacheHeaders('.js')
    };
    
    res.writeHead(200, headers);
    return res.end(configContent);
  }
  
  let filePath = path.join(root, urlPath === '/' ? 'index.html' : urlPath);

  // Prevent path traversal
  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.stat(filePath, (err, stats) => {
    if (err) {
      res.writeHead(404);
      return res.end('Not found');
    }

    if (stats.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        res.writeHead(500);
        return res.end('Server error');
      }
      
      const ext = path.extname(filePath).toLowerCase();
      const headers = {
        'Content-Type': mime[ext] || 'application/octet-stream',
        ...getCacheHeaders(ext)
      };
      
      res.writeHead(200, headers);
      res.end(data);
    });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(\`🚀 Sales Frontend running on http://0.0.0.0:\${PORT}\`);
  console.log(\`📡 Environment: \${process.env.NODE_ENV || 'development'}\`);
  console.log(\`🔗 Sales API: \${process.env.VITE_SALES_API_URL || 'https://sales.infinestech.com'}\`);
  console.log(\`🔐 Auth API: \${process.env.VITE_AUTH_API_URL || 'https://auth.infinestech.com'}\`);
});
`;

fs.writeFileSync(path.join(distDir, 'server.js'), prodServerContent);
console.log('✅ Created production server.js');

// Create PM2 ecosystem file
const pm2Config = {
    apps: [{
        name: 'sales-frontend',
        script: './server.js',
        cwd: './dist',
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: '1G',
        env: {
            NODE_ENV: 'development',
            PORT: 3020
        },
        env_production: {
            NODE_ENV: 'production',
            PORT: 3020
        }
    }]
};

fs.writeFileSync(path.join(__dirname, 'ecosystem.config.js'), 
    `module.exports = ${JSON.stringify(pm2Config, null, 2)};`);
console.log('✅ Created PM2 ecosystem.config.js');

console.log('');
console.log('🎉 Production build completed successfully!');
console.log('');
console.log('📁 Files ready in dist/ directory');
console.log('🚀 To deploy: Copy dist/ folder to your VPS');
console.log('📋 Run: cd dist && npm install && NODE_ENV=production npm start');
console.log('');
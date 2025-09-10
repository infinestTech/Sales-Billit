module.exports = {
  "apps": [
    {
      "name": "sales-frontend",
      "script": "./server.js",
      "cwd": "./dist",
      "instances": 1,
      "autorestart": true,
      "watch": false,
      "max_memory_restart": "1G",
      "env": {
        "NODE_ENV": "development",
        "PORT": 3020
      },
      "env_production": {
        "NODE_ENV": "production",
        "PORT": 3020
      }
    }
  ]
};
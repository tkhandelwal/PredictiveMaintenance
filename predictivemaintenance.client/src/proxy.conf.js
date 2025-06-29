const { env } = require('process');

const target = env.ASPNETCORE_HTTPS_PORT ? `https://localhost:${env.ASPNETCORE_HTTPS_PORT}` :
  env.ASPNETCORE_URLS ? env.ASPNETCORE_URLS.split(';')[0] : 'https://localhost:7197';

const PROXY_CONFIG = [
  {
    context: [
      "/api",
      "/hubs",
    ],
    target: "http://localhost:5236", // Use HTTP port from your running server
    secure: false,
    logLevel: "debug" // Add this for troubleshooting
  }
]

module.exports = PROXY_CONFIG;

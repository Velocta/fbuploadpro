module.exports = {
  apps: [
    {
      name: 'fbuploadpro-adu-downloader',
      script: 'worker.py',
      interpreter: 'python3',
      cwd: __dirname,
      env_file: '.env',
      autorestart: true,
      max_restarts: 20,
    },
  ],
};

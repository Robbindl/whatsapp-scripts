const path = require('path');
const Service = require('node-windows').Service;

function parseCliArgs(argv = process.argv.slice(2)) {
  const result = { action: null, env: [] };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--env') {
      const rawValue = argv[index + 1];
      if (!rawValue) {
        throw new Error('Missing value for --env. Use --env NAME=value');
      }

      const separatorIndex = rawValue.indexOf('=');
      if (separatorIndex <= 0) {
        throw new Error(`Invalid environment assignment: ${rawValue}`);
      }

      const name = rawValue.slice(0, separatorIndex);
      const value = rawValue.slice(separatorIndex + 1);
      result.env.push({ name, value });
      index += 1;
      continue;
    }

    if (arg === '--install' || arg === '--uninstall' || arg === '--start' || arg === '--stop') {
      result.action = arg;
    }
  }

  return result;
}

function createService(envOverrides = []) {
  return new Service({
    name: 'WhatsAppRobbinBot',
    description: 'Runs the WhatsApp Robbin bot in the background',
    script: path.join(__dirname, 'robbin_bot.js'),
    nodeOptions: ['--harmony', '--max_old_space_size=4096'],
    workingDirectory: __dirname,
    env: [
      { name: 'NODE_ENV', value: 'production' },
      ...envOverrides,
    ],
    stopparentfirst: true,
  });
}

function run() {
  const { action, env } = parseCliArgs();
  const svc = createService(env);

  svc.on('install', () => {
    console.log('Service installed successfully.');
    svc.start();
  });

  svc.on('alreadyinstalled', () => {
    console.log('Service already installed.');
  });

  svc.on('start', () => {
    console.log('Service started.');
  });

  svc.on('stop', () => {
    console.log('Service stopped.');
  });

  svc.on('uninstall', () => {
    console.log('Service uninstalled successfully.');
  });

  svc.on('error', (err) => {
    console.error('Service error:', err);
  });

  if (action === '--install') {
    svc.install();
  } else if (action === '--uninstall') {
    svc.uninstall();
  } else if (action === '--start') {
    svc.start();
  } else if (action === '--stop') {
    svc.stop();
  } else {
    console.log('Usage: node service.js --install | --uninstall | --start | --stop');
    console.log('Optional: --env NVIDIA_API_KEY=your-key');
  }
}

if (require.main === module) {
  run();
}

module.exports = {
  createService,
  parseCliArgs,
  run,
};

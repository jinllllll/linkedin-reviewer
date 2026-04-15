#!/usr/bin/env node
'use strict';

const { startServer } = require('./server');

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('');
  console.error('  Missing ANTHROPIC_API_KEY');
  console.error('  Set it before starting:');
  console.error('');
  console.error('    export ANTHROPIC_API_KEY=sk-ant-...');
  console.error('');
  process.exit(1);
}

startServer();

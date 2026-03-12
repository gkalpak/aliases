#!/usr/bin/env/ node
// Imports
import {execSync} from 'node:child_process';
import {argv} from 'node:process';


const npmScript = argv[2];
execSync(`npm run ${npmScript}`, {stdio: 'inherit'});

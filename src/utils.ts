import { execFile } from 'child_process';
import { promisify } from 'util';

export let _execFile = promisify(execFile);
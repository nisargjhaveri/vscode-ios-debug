import { execFile } from 'child_process';
import { promisify } from 'util';
import * as crypto from 'crypto';

export let _execFile = promisify(execFile);

export function randomString(size: number = 16) {
    let random;

    try {
        random = crypto.randomBytes(size);
    } catch (e) {
        random = crypto.pseudoRandomBytes(size);
    }

    return random.toString('hex');
}

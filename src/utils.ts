import { execFile } from 'child_process';

export function _execFile(command: string, args: string[]): Promise<{stdout: string, stderr: string}>
{
    return new Promise((resolve, reject) => {
        let p = execFile(command, args, (error, stdout, stderr) => {
            if (error)
            {
                reject(error);
            }

            resolve({stdout, stderr});
        });
    });
}

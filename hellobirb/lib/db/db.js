import { homedir } from 'os';
import { join } from 'path';

function getDataDir() {
  const dir = process.env.XDG_DATA_HOME;
  if (dir) {
    return dir;
  }
  return join(homedir(), '.local', 'share', 'hellobirb');
}

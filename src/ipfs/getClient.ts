import fs from 'fs';
import path from 'path';
import { create, Options } from 'ipfs-http-client';
import { Buffer } from 'buffer';
import getLogger from '../common/getLogger';
import IPFSConfiguration from '../interface/IPFSConfiguration';

const loadConfig = (): IPFSConfiguration | null => {
  try {
    const configPath = path.resolve(__dirname, '../../.config/ipfs.json');
    if (!fs.existsSync(configPath)) {
      return null;
    }
    const raw = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(raw) as IPFSConfiguration;
  } catch (error) {
    const logger = getLogger();
    logger.error(`Unable to read IPFS config: ${(error as Error).message}`);
    return null;
  }
};
/**
 * Returns ipfs client
 *
 * @returns - IPFS client
 */
const getClient = () => {
  const logger = getLogger();
  const config = loadConfig();
  try {
    if (!config || !config.clientSecret) {
      logger.error('IPFS not configured');
      return null;
    }
    const auth = `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`;
    const clientOptions: Options = {
      host: config.host,
      port: config.port,
      protocol: config.protocol,
      headers: {
        authorization: auth,
      },
    };
    return create(clientOptions);
  } catch (e) {
    logger.error(e);
  }
  return null;
};
export default getClient;

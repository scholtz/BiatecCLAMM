import getClient from './getClient';
import getLogger from '../common/getLogger';

/**
 * Uploads the string content to IPFS
 * @param {string} content - Content of the file to be uploaded
 * @returns - IPFS link or undefined
 */
const publishFileBuffer = async (content: Buffer): Promise<string> => {
  try {
    const ipfs = getClient();
    if (ipfs) {
      const added = await ipfs.add(content);
      return added.path;
    }
  } catch (e) {
    const logger = getLogger();
    logger.error(e);
  }
  return '';
};
export default publishFileBuffer;

import _ from 'lodash';
import { readFiles } from 'h3-formidable';

export default defineEventHandler(async (event) => {
  const { files } = await readFiles(event, {
    maxFiles: 1,
    keepExtensions: true,
  });
  _.chain(files)
    .values()
    .flatten()
    .compact()
    .value()
    .forEach((file) => {
      const { originalFilename, newFilename } = file;
      console.log({ originalFilename, newFilename });
    });
});

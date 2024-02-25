import _ from 'lodash';
import { readFiles } from 'h3-formidable';
import { PDFLoader } from 'langchain/document_loaders/fs/pdf';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';

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
    .forEach(async (file) => {
      const loader = new PDFLoader(file.filepath);
      const docs = await loader.load();
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 500,
        chunkOverlap: 50,
      });
      const chunks = await splitter.splitDocuments(docs);
      chunks.map((chunk, i) => {
        console.log(
          `page ${i}:`,
          _.truncate(chunk.pageContent, { length: 20 })
        );
      });
    });
});

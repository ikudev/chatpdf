import _ from 'lodash';
import { readFiles } from 'h3-formidable';
import { PDFLoader } from 'langchain/document_loaders/fs/pdf';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OpenAIEmbeddings } from '@langchain/openai';
import { PrismaVectorStore } from '@langchain/community/vectorstores/prisma';
import { Prisma, PrismaClient, type Document } from '@prisma/client';

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
      // split the uploaded file into chunks
      const loader = new PDFLoader(file.filepath);
      const docs = await loader.load();
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 500,
        chunkOverlap: 50,
      });
      const chunks = await splitter.splitDocuments(docs);
      // generate embeddings and the vector store
      const openAIApiKey = useRuntimeConfig().openaiApiKey;
      const embeddings = new OpenAIEmbeddings({ openAIApiKey });
      const db = new PrismaClient();
      const vectorStore = PrismaVectorStore.withModel<Document>(db).create(
        embeddings,
        {
          prisma: Prisma,
          tableName: 'Document',
          vectorColumnName: 'vector',
          columns: {
            id: PrismaVectorStore.IdColumn,
            content: PrismaVectorStore.ContentColumn,
          },
        }
      );
      // store the chunks in the database
      await db.document.deleteMany();
      await vectorStore.addModels(
        await db.$transaction(
          chunks.map((chunk) =>
            db.document.create({ data: { content: chunk.pageContent } })
          )
        )
      );
    });
});

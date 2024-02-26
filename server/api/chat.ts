import { Message, StreamingTextResponse } from 'ai';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import _ from 'lodash';
import { Prisma, PrismaClient, type Document } from '@prisma/client';
import { PrismaVectorStore } from '@langchain/community/vectorstores/prisma';
import { StringOutputParser } from '@langchain/core/output_parsers';

export default defineLazyEventHandler(() => {
  const apiKey = useRuntimeConfig().openaiApiKey;
  if (!apiKey) {
    throw createError('Missing OpenAI API key');
  }
  const llm = new ChatOpenAI({
    openAIApiKey: apiKey,
    streaming: true,
  });

  const db = new PrismaClient();
  const embeddings = new OpenAIEmbeddings({ openAIApiKey: apiKey });
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

  return defineEventHandler(async (event) => {
    const { messages } = await readBody(event);

    const standaloneQuestionTemplate = `Given a question, convert the question to a standalone question.
      question: {question}
      standalone question:`;
    const standaloneQuestionPrompt = PromptTemplate.fromTemplate(
      standaloneQuestionTemplate
    );
    const retriever = vectorStore.asRetriever();
    const outputParser = new StringOutputParser();

    const chain = standaloneQuestionPrompt
      .pipe(llm)
      .pipe(outputParser)
      .pipe(retriever)
      .pipe((docs) => docs.map((e) => e.pageContent).join('\n\n'));
    const stream = await chain.stream({
      question: _.last<Message>(messages)?.content || '',
    });
    return new StreamingTextResponse(stream);
  });
});

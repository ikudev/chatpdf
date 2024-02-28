import _ from 'lodash';
import { Message, StreamingTextResponse } from 'ai';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { Prisma, PrismaClient, type Document } from '@prisma/client';
import { PrismaVectorStore } from '@langchain/community/vectorstores/prisma';
import { StringOutputParser } from '@langchain/core/output_parsers';
import {
  RunnablePassthrough,
  RunnableSequence,
} from '@langchain/core/runnables';
import { Document as DocumentChunk } from '@langchain/core/documents';

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
    const outputParser = new StringOutputParser();

    // standalone question chain
    const standaloneQuestionTemplate = `Given a question, convert the question to a standalone question.
      question: {question}
      standalone question:`;
    const standaloneQuestionPrompt = PromptTemplate.fromTemplate(
      standaloneQuestionTemplate
    );
    const questionChain = standaloneQuestionPrompt.pipe(llm).pipe(outputParser);

    // retrieval chain
    const retriever = vectorStore.asRetriever();
    const retrievalChain = RunnableSequence.from([
      (prevResult) => prevResult.standaloneQuestion,
      retriever,
      (docs: DocumentChunk[]) =>
        docs.map((doc) => doc.pageContent).join('\n\n'),
    ]);

    // answering chain
    const answerTemplate = `You are a helpful support assistant who can answer a given question based on the context provided.
      Try to find the answer in the context.
      If you can't find the answer, say "I'm sorry, I don't know the answer to that."
      Don't try to make up an answer. Always speak as if you were chatting to a friend.
      context: {context}
      question: {question}
      answer: `;
    const answerPrompt = PromptTemplate.fromTemplate(answerTemplate);
    const answerChain = answerPrompt.pipe(llm).pipe(outputParser);

    // overall chain
    const chain = RunnableSequence.from([
      {
        standaloneQuestion: questionChain,
        originalInput: new RunnablePassthrough(),
      },
      {
        context: retrievalChain,
        question: ({ originalInput }) => originalInput.question,
      },
      answerChain,
    ]);
    const stream = await chain.stream({
      question: _.last<Message>(messages)?.content || '',
    });
    return new StreamingTextResponse(stream);
  });
});

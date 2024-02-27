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
    // standalone question prompt
    const standaloneQuestionTemplate = `Given a question, convert the question to a standalone question.
      question: {question}
      standalone question:`;
    const standaloneQuestionPrompt = PromptTemplate.fromTemplate(
      standaloneQuestionTemplate
    );
    // answer prompt
    const answerTemplate = `You are a helpful support assistant who can answer a given question based on the context provided.
      Try to find the answer in the context.
      If you can't find the answer, say "I'm sorry, I don't know the answer to that."
      Don't try to make up an answer. Always speak as if you were chatting to a friend.
      context: {context}
      question: {question}
      answer: `;
    const answerPrompt = PromptTemplate.fromTemplate(answerTemplate);
    // retrieval
    const retriever = vectorStore.asRetriever();
    const outputParser = new StringOutputParser();
    // chain
    let standaloneQuestion = '';
    const chain = standaloneQuestionPrompt
      .pipe(llm)
      .pipe(outputParser)
      .pipe((qst) => {
        standaloneQuestion = qst;
        return qst;
      })
      .pipe(retriever)
      .pipe((docs) => ({
        question: standaloneQuestion,
        context: docs.map((e) => e.pageContent).join('\n\n'),
      }))
      .pipe(answerPrompt)
      .pipe(llm)
      .pipe(outputParser);
    const stream = await chain.stream({
      question: _.last<Message>(messages)?.content || '',
    });
    return new StreamingTextResponse(stream);
  });
});

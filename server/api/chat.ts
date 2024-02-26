import { LangChainStream, Message, StreamingTextResponse } from 'ai';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import _ from 'lodash';

export default defineLazyEventHandler(() => {
  const apiKey = useRuntimeConfig().openaiApiKey;
  if (!apiKey) {
    throw createError('Missing OpenAI API key');
  }
  const llm = new ChatOpenAI({
    openAIApiKey: apiKey,
    streaming: true,
  });

  return defineEventHandler(async (event) => {
    const { messages } = await readBody(event);

    const { stream, handlers } = LangChainStream();

    const standaloneQuestionTemplate = `Given a question, convert the question to a standalone question.
      question: {question}
      standalone question:`;
    const standaloneQuestionPrompt = PromptTemplate.fromTemplate(
      standaloneQuestionTemplate
    );

    standaloneQuestionPrompt
      .pipe(llm)
      .invoke(
        { question: _.last<Message>(messages)?.content || '' },
        { callbacks: [handlers] }
      )
      .catch(console.error);
    return new StreamingTextResponse(stream);
  });
});

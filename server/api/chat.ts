import { LangChainStream, Message, StreamingTextResponse } from 'ai';
import { ChatOpenAI } from '@langchain/openai';
import { AIMessage, HumanMessage } from '@langchain/core/messages';

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
    llm
      .call(
        (messages as Message[]).map((message) =>
          message.role === 'user'
            ? new HumanMessage(message.content)
            : new AIMessage(message.content)
        ),
        {},
        [handlers]
      )
      // eslint-disable-next-line no-console
      .catch(console.error);
    return new StreamingTextResponse(stream);
  });
});

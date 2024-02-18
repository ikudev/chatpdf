<template>
  <div class="flex flex-col gap-2">
    <div
      class="overflow-scroll border border-solid border-gray-300 rounded p-4 flex-grow"
    >
      <template v-for="message in messages" :key="message.id">
        <div
          class="whitespace-pre-wrap chat"
          :class="[isMessageFromUser(message) ? 'chat-end' : 'chat-start']"
        >
          <div class="chat-image flex flex-col items-center">
            <div class="avatar">
              <div class="w-10 rounded-full">
                <img
                  :src="
                    isMessageFromUser(message)
                      ? 'https://cdn-icons-png.flaticon.com/512/3541/3541871.png'
                      : 'https://cdn-icons-png.flaticon.com/512/1624/1624640.png'
                  "
                />
              </div>
            </div>
            <strong>
              {{ isMessageFromUser(message) ? 'Me' : 'AI' }}
            </strong>
          </div>
          <div class="chat-header"></div>
          <div
            class="chat-bubble mb-4"
            :class="
              isMessageFromUser(message)
                ? 'chat-bubble-secondary'
                : 'chat-bubble-primary'
            "
          >
            {{ message.content }}
          </div>
        </div>
      </template>
    </div>
    <form class="w-full" @submit.prevent="handleSubmit">
      <input
        v-model="input"
        class="w-full p-2 mb-8 border border-gray-300 rounded shadow-xl outline-none"
        placeholder="Say something..."
      />
    </form>
  </div>
</template>

<script lang="ts" setup>
const messages = ref<any>([{
  role: 'ai',
  content: 'Hello!'
}]);
const input = ref<string>('');

function isMessageFromUser(message: any) {
  return message.role === 'user';
}

function handleSubmit() {
  if (input.value) {
    messages.value = [
      ...messages.value,
      {
        role: 'user',
        content: input.value,
      },
      {
        role: 'ai',
        content: input.value,
      },
    ];
    input.value = '';
  }
}
</script>

<style></style>

<template>
  <div class="h-screen w-1/2 mx-auto my-2 flex flex-col gap-2">
    <form class="flex justify-between items-center gap-1">
      <input
        type="file"
        id="file"
        accept=".pdf"
        @change="uploadFile($event.target as HTMLInputElement)"
      />
    </form>
    <ChatBox class="flex-grow" />
  </div>
</template>

<script lang="ts" setup>
async function uploadFile(elem: HTMLInputElement) {
  const formData = new FormData();
  formData.append('file', elem.files?.[0] as Blob);
  try {
    await useFetch('/api/upload', {
      method: 'POST',
      body: formData,
    });
  } catch (error) {
    console.error(error);
  }
}
</script>

<script setup lang="ts">
import { computed } from 'vue';

import { useClipboard } from '@vueuse/core';
import { message } from 'antdv-next';

const props = defineProps<{
  endpoint: string;
  serverName: string;
}>();
const { copy } = useClipboard({ legacy: true });
const configuration = computed(() =>
  JSON.stringify(
    {
      mcpServers: {
        [props.serverName]: {
          url: props.endpoint,
          headers: { Authorization: 'Bearer <YOUR_MCP_KEY>' },
        },
      },
    },
    null,
    2,
  ),
);

async function copyText(value: string) {
  try {
    await copy(value);
    message.success('已复制');
  } catch {
    message.error('剪贴板不可用，请手动选择并复制');
  }
}
</script>

<template>
  <div class="min-w-0 space-y-3">
    <div class="flex flex-wrap items-center gap-2">
      <span class="font-medium">Streamable HTTP 端点</span>
      <a-button size="small" @click="copyText(endpoint)">复制端点</a-button>
    </div>
    <code class="block break-all rounded bg-accent p-3">{{ endpoint }}</code>
    <details>
      <summary class="cursor-pointer font-medium">
        客户端配置（Bearer API Key）
      </summary>
      <p class="my-2 text-sm text-muted-foreground">
        适用于支持 HTTP URL 和自定义 Authorization 请求头的客户端；不是 OAuth
        登录。 将占位符替换为本次创建时保存的 MCP Key，请勿放入 URL。
      </p>
      <pre class="overflow-x-auto rounded bg-accent p-3 text-xs">{{
        configuration
      }}</pre>
      <a-button class="mt-2" @click="copyText(configuration)">
复制配置（占位令牌）
</a-button>
    </details>
  </div>
</template>

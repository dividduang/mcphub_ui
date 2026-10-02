<script setup lang="ts">
import type { HubGrant, HubServer } from '../api';

import { computed, ref, watch } from 'vue';

import { message } from 'antdv-next';

import {
  formatTime,
  getGrants,
  grantTools,
  revokeGrant,
  toolGroups,
  toolLabel,
} from '../api';
import ToolSelector from './tool-selector.vue';

const props = defineProps<{ canManage: boolean; servers: HubServer[] }>();
const emit = defineEmits<{ changed: [] }>();
const userId = ref('');
const loadedUser = ref('');
const grants = ref<HubGrant[]>([]);
const scope = ref<string[]>([]);
const busy = ref(false);
const revokeTarget = ref<HubGrant | null>(null);
const groups = computed(() =>
  toolGroups(props.servers, (tool, server) => tool.enabled && server.enabled),
);
watch(userId, () => {
  loadedUser.value = '';
  grants.value = [];
  scope.value = [];
});

function validUser() {
  if (!props.canManage) return false;
  if (!/^[1-9]\d*$/.test(userId.value.trim())) {
    message.warning('请输入有效的十进制用户 ID');
    return false;
  }
  return true;
}

async function query() {
  if (busy.value || !validUser()) return;
  busy.value = true;
  try {
    const id = userId.value.trim();
    grants.value = await getGrants(id);
    loadedUser.value = id;
  } catch {
    loadedUser.value = '';
  } finally {
    busy.value = false;
  }
}

async function grant() {
  if (busy.value || !validUser()) return;
  if (scope.value.length === 0) {
    message.warning('请选择要授予的工具');
    return;
  }
  busy.value = true;
  try {
    const id = userId.value.trim();
    grants.value = await grantTools(id, scope.value);
    loadedUser.value = id;
    scope.value = [];
    message.success('工具授权已生效');
    emit('changed');
  } catch {
    // The server validates the real FBA user and grant policy.
  } finally {
    busy.value = false;
  }
}

async function revoke() {
  if (!props.canManage || !revokeTarget.value || busy.value) return;
  busy.value = true;
  try {
    await revokeGrant(revokeTarget.value.id);
    revokeTarget.value = null;
    message.success('工具授权已撤销');
    emit('changed');
    loadedUser.value = '';
    grants.value = await getGrants(userId.value.trim());
    loadedUser.value = userId.value.trim();
  } catch {
    // Errors remain visible through requestClient; never synthesize a grant.
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section v-if="canManage" class="space-y-4" aria-label="用户工具授权管理">
    <a-alert
      type="warning"
      show-icon
      message="此处为管理员直接授予 / 撤销。用户 ID 来自 FBA 用户管理；重新授予不会恢复旧 Key 的绑定。"
    />
    <div class="flex flex-wrap items-end gap-3">
      <label class="block min-w-0 flex-1 space-y-2">
        <span>目标用户 ID</span>
        <a-input
          v-model:value="userId"
          :disabled="busy"
          inputmode="numeric"
          placeholder="保持完整数字，不转为 JavaScript number"
          aria-label="目标用户 ID"
        />
      </label>
      <a-button :loading="busy" @click="query">查询用户授权</a-button>
    </div>
    <ToolSelector
      v-model="scope"
      :groups="groups"
      :disabled="busy"
      label="直接授予工具"
    />
    <a-button type="primary" :loading="busy" @click="grant">
确认授予所选工具
</a-button>
    <div v-if="loadedUser" class="space-y-3">
      <h3 class="font-medium">用户 {{ loadedUser }} 的授权记录</h3>
      <a-empty v-if="grants.length === 0" description="该用户暂无工具授权" />
      <div
        v-for="item in grants"
        :key="item.id"
        class="flex flex-wrap items-center justify-between gap-3 rounded border border-border p-3"
      >
        <div class="space-y-1">
          <p>{{ toolLabel(servers, item.tool_id) }}</p>
          <p class="text-xs text-muted-foreground">
            {{ formatTime(item.created_time) }} · 来源 {{ item.source }}
          </p>
          <a-tag :color="item.active ? 'success' : 'default'">
{{
            item.active ? '已授权' : '已撤销'
          }}
</a-tag>
        </div>
        <a-button
          v-if="item.active"
          danger
          :disabled="busy"
          @click="revokeTarget = item"
          >
撤销工具授权
</a-button>
      </div>
    </div>
    <a-modal
      :open="!!revokeTarget"
      title="确认撤销工具授权"
      :confirm-loading="busy"
      :mask-closable="false"
      ok-text="撤销授权"
      cancel-text="取消"
      @ok="revoke"
      @cancel="revokeTarget = null"
    >
      <p>
        撤销
        {{ revokeTarget ? toolLabel(servers, revokeTarget.tool_id) : '' }}
        后，该用户所有 Key 都失去此工具。重新授予后必须创建新
        Key，旧绑定不会恢复。已发出的上游请求无法回滚。
      </p>
    </a-modal>
  </section>
</template>

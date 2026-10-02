<script setup lang="ts">
import type { HubKey, HubServer } from '../api';

import { computed, onBeforeUnmount, onDeactivated, ref, watch } from 'vue';

import { message } from 'antdv-next';

import {
  createKey,
  formatTime,
  getKeys,
  revokeKey,
  toolGroups,
  toolLabel,
  updateKey,
} from '../api';
import ToolSelector from './tool-selector.vue';

const props = defineProps<{ revision: number; servers: HubServer[] }>();
const rows = ref<HubKey[]>([]);
const page = ref(1);
const total = ref(0);
const loading = ref(false);
const failed = ref(false);
const busy = ref(false);
const editing = ref<HubKey | null>(null);
const open = ref(false);
const name = ref('');
const expires = ref('');
const scope = ref<string[]>([]);
const secret = ref('');
const revokeTarget = ref<HubKey | null>(null);
const groups = computed(() =>
  toolGroups(
    props.servers,
    (tool, server) =>
      server.enabled &&
      tool.enabled &&
      tool.granted &&
      (!editing.value || editing.value.tool_ids.includes(tool.id)),
  ),
);

async function load() {
  loading.value = true;
  failed.value = false;
  try {
    const result = await getKeys(page.value);
    rows.value = result.items;
    total.value = result.total;
  } catch {
    failed.value = true;
  } finally {
    loading.value = false;
  }
}

watch(() => props.revision, load, { immediate: true });

function openEditor(key: HubKey | null = null) {
  editing.value = key;
  name.value = key?.name ?? '';
  expires.value = '';
  const allowed = new Set(
    groups.value.flatMap((group) => group.tools.map((tool) => tool.id)),
  );
  scope.value = key ? key.tool_ids.filter((id) => allowed.has(id)) : [];
  open.value = true;
}

async function save() {
  if (busy.value) return;
  if (!name.value.trim()) {
    message.warning('请输入 Key 名称');
    return;
  }
  if (!editing.value && scope.value.length === 0) {
    message.warning('请至少选择一个已授权工具');
    return;
  }
  let expireTime: null | string = null;
  if (!editing.value && expires.value) {
    const date = new Date(expires.value);
    if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) {
      message.warning('有效期必须晚于当前时间');
      return;
    }
    expireTime = date.toISOString();
  }
  busy.value = true;
  try {
    if (editing.value) {
      await updateKey(editing.value.id, {
        name: name.value.trim(),
        tool_ids: scope.value,
      });
      message.success('Key 名称及范围已保存');
    } else {
      const created = await createKey({
        name: name.value.trim(),
        tool_ids: scope.value,
        expire_time: expireTime,
      });
      secret.value = created.secret;
    }
    open.value = false;
    await load();
  } catch {
    // requestClient displays the server error; preserve the form for correction.
  } finally {
    busy.value = false;
  }
}

async function toggle(key: HubKey) {
  if (busy.value || key.status === 'revoked') return;
  busy.value = true;
  try {
    await updateKey(key.id, { enabled: key.status !== 'active' });
    message.success('Key 状态已更新');
    await load();
  } catch {
    // Keep the authoritative row unchanged on failure.
  } finally {
    busy.value = false;
  }
}

async function confirmRevoke() {
  if (!revokeTarget.value || busy.value) return;
  busy.value = true;
  try {
    await revokeKey(revokeTarget.value.id);
    revokeTarget.value = null;
    message.success('Key 已永久撤销');
    await load();
  } catch {
    // The confirmation stays open on a rejected request.
  } finally {
    busy.value = false;
  }
}

async function copySecret() {
  try {
    await navigator.clipboard.writeText(secret.value);
    message.success('新 Key 已复制，请妥善保存');
  } catch {
    message.error('剪贴板不可用，请手动复制');
  }
}

function clearSecret() {
  secret.value = '';
}
onDeactivated(clearSecret);
onBeforeUnmount(clearSecret);

function changePage(value: number) {
  page.value = value;
  void load();
}
</script>

<template>
  <section class="space-y-4" aria-label="我的 MCP Keys">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="text-muted-foreground">
        每把 Key 只绑定选中的工具；新增范围请创建新 Key。已撤销 Key 无法恢复。
      </p>
      <div class="flex gap-2">
        <a-button :loading="loading" @click="load">刷新 Keys</a-button>
        <a-button
          type="primary"
          :disabled="busy || loading"
          @click="openEditor()"
          >
创建 MCP Key
</a-button>
      </div>
    </div>
    <a-alert
      v-if="failed"
      type="error"
      show-icon
      message="Keys 加载失败，请重试。当前显示可能不是最新状态。"
    />
    <a-spin :spinning="loading">
      <a-empty
        v-if="!loading && !failed && rows.length === 0"
        description="尚未创建 MCP Key，请先申请工具授权"
      />
      <div class="grid gap-4 lg:grid-cols-2">
        <a-card v-for="key in rows" :key="key.id" :title="key.name">
          <div class="space-y-3">
            <div class="flex flex-wrap gap-2">
              <a-tag
                :color="
                  key.status === 'active'
                    ? 'success'
                    : key.status === 'revoked'
                      ? 'error'
                      : 'default'
                "
              >
                {{
                  key.status === 'active'
                    ? '已启用'
                    : key.status === 'disabled'
                      ? '已停用'
                      : '已撤销'
                }}
              </a-tag>
              <a-tag
                v-if="
                  key.expire_time &&
                  new Date(key.expire_time).getTime() <= Date.now()
                "
                color="error"
                >
已过期
</a-tag>
            </div>
            <p class="break-all text-xs text-muted-foreground">
              公开 ID：{{ key.id }}（不是令牌）
            </p>
            <p>有效期：{{ formatTime(key.expire_time) }}</p>
            <p class="text-sm text-muted-foreground">
              创建于 {{ formatTime(key.created_time) }}
            </p>
            <div>
              <p class="mb-1 font-medium">当前有效工具</p>
              <p
                v-if="key.effective_tool_ids.length === 0"
                class="text-muted-foreground"
              >
                当前没有有效工具
              </p>
              <ul class="space-y-1 text-sm">
                <li v-for="id in key.effective_tool_ids" :key="id">
                  {{ toolLabel(servers, id) }}
                </li>
              </ul>
            </div>
            <details>
              <summary class="cursor-pointer text-sm">
                查看显式绑定范围（{{ key.tool_ids.length }}）
              </summary>
              <ul class="mt-2 space-y-1 text-sm">
                <li v-for="id in key.tool_ids" :key="id">
                  {{ toolLabel(servers, id) }}
                </li>
              </ul>
            </details>
            <div v-if="key.status !== 'revoked'" class="flex flex-wrap gap-2">
              <a-button :disabled="busy || loading" @click="openEditor(key)">
编辑 / 收缩范围
</a-button>
              <a-button :disabled="busy || loading" @click="toggle(key)">
{{
                key.status === 'active' ? '停用 Key' : '启用 Key'
              }}
</a-button>
              <a-button
                danger
                :disabled="busy || loading"
                @click="revokeTarget = key"
                >
撤销 Key
</a-button>
            </div>
          </div>
        </a-card>
      </div>
    </a-spin>
    <a-pagination
      :current="page"
      :page-size="10"
      :total="total"
      :show-size-changer="false"
      :disabled="loading"
      @change="changePage"
    />

    <a-modal
      :open="open"
      :title="editing ? '编辑 MCP Key（仅可收缩范围）' : '创建 MCP Key'"
      :confirm-loading="busy"
      :closable="!busy"
      :mask-closable="false"
      ok-text="保存 Key"
      cancel-text="取消"
      @ok="save"
      @cancel="open = false"
    >
      <div class="space-y-4 py-3">
        <label class="block space-y-2">
          <span>Key 名称</span>
          <a-input
            v-model:value="name"
            :maxlength="64"
            :disabled="busy"
            placeholder="例如：D 的 A1/A3"
            aria-label="Key 名称"
          />
        </label>
        <label v-if="!editing" class="block space-y-2">
          <span>有效期（本地时间；留空永久有效）</span>
          <input
            v-model="expires"
            type="datetime-local"
            :disabled="busy"
            class="w-full rounded border border-border bg-background p-2"
            aria-label="Key 有效期"
          />
        </label>
        <a-alert
          v-if="editing"
          type="info"
          show-icon
          message="只能保留或移除原绑定中当前仍获批的工具。保存会移除失效项，不能添加新范围；有效期不可更改。"
        />
        <ToolSelector
          v-model="scope"
          :groups="groups"
          :disabled="busy"
          label="Key 工具范围（仅当前已授权）"
        />
      </div>
    </a-modal>
    <a-modal
      :open="!!secret"
      title="MCP Key 已创建（仅展示一次）"
      :footer="null"
      :mask-closable="false"
      @cancel="clearSecret"
    >
      <a-alert
        class="mb-4"
        type="warning"
        show-icon
        message="请立即复制并妥善保存。关闭后无法再次获取原文；不要将令牌发送给他人或放入 URL。"
      />
      <a-input-password
        :value="secret"
        readonly
        autocomplete="off"
        aria-label="新 MCP Key 秘密"
      />
      <div class="mt-4 flex flex-wrap justify-end gap-2">
        <a-button type="primary" @click="copySecret">复制新 Key</a-button>
        <a-button @click="clearSecret">已保存，关闭</a-button>
      </div>
    </a-modal>
    <a-modal
      :open="!!revokeTarget"
      title="确认永久撤销 Key"
      :confirm-loading="busy"
      :mask-closable="false"
      ok-text="永久撤销"
      cancel-text="取消"
      @ok="confirmRevoke"
      @cancel="revokeTarget = null"
    >
      <p>
        确认撤销“{{ revokeTarget?.name }}”？撤销后不可恢复，后续 MCP
        请求将被拒绝。已发出的上游请求无法回滚。
      </p>
    </a-modal>
  </section>
</template>

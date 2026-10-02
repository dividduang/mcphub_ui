<script setup lang="ts">
import type { HubRequest, HubServer } from '../api';

import { computed, ref, watch } from 'vue';

import { message } from 'antdv-next';

import {
  decideRequest,
  formatTime,
  getRequests,
  submitRequest,
  toolGroups,
  toolLabel,
} from '../api';
import ToolSelector from './tool-selector.vue';

const props = defineProps<{
  canManage: boolean;
  revision: number;
  servers: HubServer[];
}>();
const emit = defineEmits<{ changed: [] }>();
const rows = ref<HubRequest[]>([]);
const page = ref(1);
const total = ref(0);
const all = ref(false);
const loading = ref(false);
const failed = ref(false);
const busy = ref(false);
const open = ref(false);
const scope = ref<string[]>([]);
const note = ref('');
const decision = ref<HubRequest | null>(null);
const approved = ref<string[]>([]);
const statuses = {
  approved: '已授予',
  partial: '部分授予',
  pending: '待处理',
  rejected: '已拒绝',
};
const groups = computed(() =>
  toolGroups(
    props.servers,
    (tool, server) => server.enabled && tool.enabled && !tool.granted,
  ),
);
const decisionGroups = computed(() =>
  toolGroups(
    props.servers,
    (tool, server) =>
      server.enabled &&
      tool.enabled &&
      !!decision.value?.tool_ids.includes(tool.id) &&
      !decision.value.granted_tool_ids.includes(tool.id),
  ),
);

async function load() {
  loading.value = true;
  failed.value = false;
  try {
    const result = await getRequests(page.value, props.canManage && all.value);
    rows.value = result.items;
    total.value = result.total;
  } catch {
    failed.value = true;
  } finally {
    loading.value = false;
  }
}
watch(() => props.revision, load, { immediate: true });

async function submit() {
  if (busy.value) return;
  if (scope.value.length === 0) {
    message.warning('请选择要申请的工具');
    return;
  }
  busy.value = true;
  try {
    const result = await submitRequest(
      scope.value,
      note.value.trim() || undefined,
    );
    message.success(`申请已提交：${statuses[result.status]}`);
    open.value = false;
    scope.value = [];
    note.value = '';
    page.value = 1;
    emit('changed');
  } catch {
    // Retain the selection when the server rejects the request.
  } finally {
    busy.value = false;
  }
}

function openDecision(row: HubRequest) {
  if (!props.canManage) return;
  decision.value = row;
  approved.value = [];
}

async function decide() {
  if (!props.canManage || !decision.value || busy.value) return;
  busy.value = true;
  try {
    const result = await decideRequest(decision.value.id, approved.value);
    message.success(`处理结果：${statuses[result.status]}`);
    decision.value = null;
    emit('changed');
  } catch {
    // Do not report approval until the backend commits the decision.
  } finally {
    busy.value = false;
  }
}

function changePage(value: number) {
  page.value = value;
  void load();
}
function changeView() {
  page.value = 1;
  void load();
}
</script>

<template>
  <section class="space-y-4" aria-label="工具申请记录">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex flex-wrap items-center gap-3">
        <label v-if="canManage" class="flex cursor-pointer items-center gap-2">
          <input
            v-model="all"
            type="checkbox"
            :disabled="loading"
            @change="changeView"
          />查看所有用户申请
        </label>
        <a-button :loading="loading" @click="load">刷新申请</a-button>
      </div>
      <a-button type="primary" :disabled="busy" @click="open = true">
申请工具
</a-button>
    </div>
    <a-alert
      type="info"
      show-icon
      message="管理员预授权的工具可自动生效；其他申请保留为待处理。提交申请不代表已经获得全部权限。"
    />
    <a-alert
      v-if="failed"
      type="error"
      show-icon
      message="申请记录加载失败，请重试。"
    />
    <a-spin :spinning="loading">
      <a-empty
        v-if="!loading && !failed && rows.length === 0"
        description="暂无工具申请"
      />
      <div class="space-y-4">
        <a-card v-for="row in rows" :key="row.id">
          <div class="space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex flex-wrap items-center gap-2">
                <a-tag
                  :color="
                    row.status === 'approved'
                      ? 'success'
                      : row.status === 'rejected'
                        ? 'error'
                        : 'processing'
                  "
                  >
{{ statuses[row.status] }}
</a-tag>
                <span class="text-sm text-muted-foreground">{{
                  formatTime(row.created_time)
                }}</span>
                <span v-if="canManage && all" class="text-sm">用户 ID：{{ row.user_id }}</span>
              </div>
              <a-button
                v-if="
                  canManage &&
                  !row.decided_by &&
                  (row.status === 'pending' || row.status === 'partial')
                "
                :disabled="busy"
                @click="openDecision(row)"
                >
处理申请
</a-button>
            </div>
            <p v-if="row.note">申请备注：{{ row.note }}</p>
            <ul class="space-y-2">
              <li
                v-for="id in row.tool_ids"
                :key="id"
                class="flex flex-wrap items-center gap-2 text-sm"
              >
                <span>{{ toolLabel(servers, id) }}</span>
                <a-tag
                  :color="
                    row.granted_tool_ids.includes(id) ? 'success' : 'default'
                  "
                >
                  {{
                    row.granted_tool_ids.includes(id)
                      ? '本次已授予'
                      : row.decided_by || row.status === 'rejected'
                        ? '本次未授予'
                        : '待处理'
                  }}
                </a-tag>
              </li>
            </ul>
            <p class="text-xs text-muted-foreground">
              本次结果为历史记录；当前权限请查看“已授权工具”。
            </p>
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
      title="申请 MCP 工具"
      :confirm-loading="busy"
      :closable="!busy"
      :mask-closable="false"
      ok-text="提交申请"
      cancel-text="取消"
      @ok="submit"
      @cancel="open = false"
    >
      <div class="space-y-4 py-3">
        <ToolSelector
          v-model="scope"
          :groups="groups"
          :disabled="busy"
          label="选择要申请的工具"
        />
        <label class="block space-y-2">
          <span>申请备注（选填）</span>
          <a-textarea
            v-model:value="note"
            :maxlength="500"
            :rows="3"
            :disabled="busy"
            aria-label="申请备注"
          />
        </label>
      </div>
    </a-modal>
    <a-modal
      :open="!!decision"
      title="处理 MCP 工具申请"
      :confirm-loading="busy"
      :closable="!busy"
      :mask-closable="false"
      ok-text="确认处理"
      cancel-text="取消"
      @ok="decide"
      @cancel="decision = null"
    >
      <div class="space-y-4 py-3">
        <p>申请人 ID：{{ decision?.user_id }}</p>
        <a-alert
          type="warning"
          show-icon
          message="勾选实际批准项，其余项不予授予。全部不选即拒绝本次申请；不会自动撤销此前已生效的授权。"
        />
        <ToolSelector
          v-model="approved"
          :groups="decisionGroups"
          :disabled="busy"
          label="本次批准工具"
        />
      </div>
    </a-modal>
  </section>
</template>

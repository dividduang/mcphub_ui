<script setup lang="ts">
import type { HubGrant, HubMetadata, HubServer } from '../api';

import { computed, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { message } from 'antdv-next';

import {
  formatTime,
  getCatalog,
  getGrants,
  getMetadata,
  toolLabel,
  updateServer,
  updateTool,
} from '../api';
import EndpointPanel from './endpoint-panel.vue';
import GrantsPanel from './grants-panel.vue';
import KeysPanel from './keys-panel.vue';
import RequestsPanel from './requests-panel.vue';

interface ManagementAction {
  field: 'auto_approve' | 'enabled';
  id: string;
  label: string;
  target: 'server' | 'tool';
  value: boolean;
}

const metadata = ref<HubMetadata | null>(null);
const servers = ref<HubServer[]>([]);
const grants = ref<HubGrant[]>([]);
const loading = ref(false);
const failed = ref(false);
const busy = ref(false);
const revision = ref(0);
const tab = ref('catalog');
const pendingAction = ref<ManagementAction | null>(null);
const canManage = computed(() => metadata.value?.can_manage === true);
const activeGrants = computed(() =>
  grants.value.filter((grant) => grant.active),
);

async function reload() {
  if (loading.value) return;
  loading.value = true;
  failed.value = false;
  try {
    const currentMetadata = await getMetadata();
    metadata.value = currentMetadata;
    const [catalog, currentGrants] = await Promise.all([
      getCatalog(),
      getGrants(),
    ]);
    servers.value = catalog.servers;
    grants.value = currentGrants;
    revision.value += 1;
  } catch {
    failed.value = true;
  } finally {
    loading.value = false;
  }
}
onMounted(reload);

function manage(action: ManagementAction) {
  if (!canManage.value || busy.value) return;
  pendingAction.value = action;
}

async function confirmManagement() {
  if (!canManage.value || !pendingAction.value || busy.value) return;
  const action = pendingAction.value;
  busy.value = true;
  try {
    if (action.target === 'server') {
      await updateServer(action.id, action.value);
    } else if (action.field === 'enabled') {
      await updateTool(action.id, { enabled: action.value });
    } else {
      await updateTool(action.id, { auto_approve: action.value });
    }
    pendingAction.value = null;
    message.success('服务配置已保存');
    await reload();
  } catch {
    // Keep the confirmation open if the authoritative update fails.
  } finally {
    busy.value = false;
  }
}

function grantAvailable(toolId: string) {
  return servers.value.some(
    (server) =>
      server.enabled &&
      server.tools.some((tool) => tool.id === toolId && tool.enabled),
  );
}
</script>

<template>
  <Page
    title="MCP Hub"
    description="申请工具、管理最小权限 Key，并连接真实 MCP 服务。"
  >
    <div class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="text-muted-foreground">
            管理操作使用 FBA 登录；MCP 调用使用独立 Bearer Key。
          </p>
          <p v-if="metadata" class="mt-1 text-xs text-muted-foreground">
            当前用户 ID：{{ metadata.user_id }} ·
            {{ canManage ? '具备 MCP 管理权限' : '个人工具与 Key' }}
          </p>
        </div>
        <a-button :loading="loading" :disabled="busy" @click="reload">
刷新 MCP Hub
</a-button>
      </div>
      <a-alert
        v-if="failed"
        type="error"
        show-icon
        message="MCP Hub 加载失败，请重试。已有内容可能不是最新状态；服务端仍会校验每次操作。"
      />
      <a-spin :spinning="loading">
        <a-tabs v-if="metadata" v-model:active-key="tab">
          <a-tab-pane key="catalog" tab="服务目录">
            <div class="space-y-4">
              <a-empty
                v-if="!loading && servers.length === 0"
                description="暂无已注册 MCP 服务，请联系管理员检查插件启动状态"
              />
              <a-card
                v-for="server in servers"
                :key="server.id"
                :title="server.name"
              >
                <div class="space-y-4">
                  <div class="flex flex-wrap items-start justify-between gap-3">
                    <div class="space-y-2">
                      <p>{{ server.description }}</p>
                      <a-tag :color="server.enabled ? 'success' : 'error'">
{{
                        server.enabled ? '服务可用' : '服务已停用'
                      }}
</a-tag>
                    </div>
                    <a-button
                      v-if="canManage"
                      :danger="server.enabled"
                      :disabled="busy || loading"
                      @click="
                        manage({
                          target: 'server',
                          id: server.id,
                          field: 'enabled',
                          value: !server.enabled,
                          label: `${server.enabled ? '停用' : '启用'}服务 ${server.name}`,
                        })
                      "
                    >
                      {{ server.enabled ? '停用服务' : '启用服务' }}
                    </a-button>
                  </div>
                  <EndpointPanel
                    :endpoint="server.endpoint"
                    :server-name="server.slug"
                  />
                  <div class="grid gap-3 lg:grid-cols-2">
                    <article
                      v-for="tool in server.tools"
                      :key="tool.id"
                      class="min-w-0 space-y-3 rounded-lg border border-border p-4"
                    >
                      <div>
                        <h3 class="font-medium">{{ tool.title }}</h3>
                        <code class="break-all text-xs text-muted-foreground">{{
                          tool.name
                        }}</code>
                      </div>
                      <p class="text-sm">{{ tool.description }}</p>
                      <div class="flex flex-wrap gap-1">
                        <a-tag
                          :color="
                            server.enabled && tool.enabled
                              ? 'success'
                              : 'default'
                          "
                          >
{{
                            server.enabled && tool.enabled ? '可用' : '不可用'
                          }}
</a-tag>
                        <a-tag :color="tool.granted ? 'blue' : 'default'">
{{
                          tool.granted ? '我已获授权' : '尚未授权'
                        }}
</a-tag>
                        <a-tag>
{{
                          tool.auto_approve ? '申请可自动授予' : '需管理员授予'
                        }}
</a-tag>
                      </div>
                      <details>
                        <summary class="cursor-pointer text-sm">
                          工具参数 Schema
                        </summary>
                        <pre
                          class="mt-2 max-h-64 overflow-auto rounded bg-accent p-2 text-xs"
                          >{{ JSON.stringify(tool.input_schema, null, 2) }}</pre>
                      </details>
                      <div v-if="canManage" class="flex flex-wrap gap-2">
                        <a-button
                          size="small"
                          :disabled="busy || loading"
                          @click="
                            manage({
                              target: 'tool',
                              id: tool.id,
                              field: 'enabled',
                              value: !tool.enabled,
                              label: `${tool.enabled ? '停用' : '启用'}工具 ${tool.title}`,
                            })
                          "
                        >
                          {{ tool.enabled ? '停用工具' : '启用工具' }}
                        </a-button>
                        <a-button
                          size="small"
                          :disabled="busy || loading"
                          @click="
                            manage({
                              target: 'tool',
                              id: tool.id,
                              field: 'auto_approve',
                              value: !tool.auto_approve,
                              label: `${tool.auto_approve ? '关闭' : '开启'}自动授予：${tool.title}`,
                            })
                          "
                        >
                          {{
                            tool.auto_approve ? '关闭自动授予' : '开启自动授予'
                          }}
                        </a-button>
                      </div>
                    </article>
                  </div>
                  <a-button type="primary" @click="tab = 'requests'">
前往申请工具
</a-button>
                </div>
              </a-card>
            </div>
          </a-tab-pane>
          <a-tab-pane key="requests" tab="我的工具申请">
            <RequestsPanel
              :servers="servers"
              :can-manage="canManage"
              :revision="revision"
              @changed="reload"
            />
          </a-tab-pane>
          <a-tab-pane key="grants" tab="已授权工具">
            <div class="space-y-4">
              <a-alert
                type="info"
                show-icon
                message="授权与服务可用状态是两件事。Key 的实际权限取当前授权、Key 绑定、服务与工具启用状态的交集。"
              />
              <a-empty
                v-if="activeGrants.length === 0"
                description="暂无有效授权，请先提交工具申请"
              />
              <div
                v-for="grant in activeGrants"
                :key="grant.id"
                class="space-y-2 rounded-lg border border-border p-4"
              >
                <p class="font-medium">
                  {{ toolLabel(servers, grant.tool_id) }}
                </p>
                <a-tag
                  :color="grantAvailable(grant.tool_id) ? 'success' : 'default'"
                  >
{{
                    grantAvailable(grant.tool_id)
                      ? '当前可绑定 Key'
                      : '服务或工具暂不可用'
                  }}
</a-tag>
                <p class="text-xs text-muted-foreground">
                  授予时间 {{ formatTime(grant.created_time) }} · 来源
                  {{ grant.source }}
                </p>
              </div>
            </div>
          </a-tab-pane>
          <a-tab-pane key="keys" tab="我的 MCP Keys">
            <KeysPanel :servers="servers" :revision="revision" />
          </a-tab-pane>
          <a-tab-pane v-if="canManage" key="manage" tab="用户授权管理">
            <GrantsPanel
              :servers="servers"
              :can-manage="canManage"
              @changed="reload"
            />
          </a-tab-pane>
        </a-tabs>
      </a-spin>
    </div>
    <a-modal
      :open="!!pendingAction"
      title="确认服务配置变更"
      :confirm-loading="busy"
      :mask-closable="false"
      ok-text="确认变更"
      cancel-text="取消"
      @ok="confirmManagement"
      @cancel="pendingAction = null"
    >
      <p class="mb-3">{{ pendingAction?.label }}</p>
      <a-alert
        v-if="pendingAction?.field === 'auto_approve'"
        type="warning"
        show-icon
        message="自动授予意味着所有有效登录用户都可以申请获得此工具。策略变更不追溯扩大旧授权或 Key，也不会撤销已经授予的权限。"
      />
      <a-alert
        v-else
        type="warning"
        show-icon
        message="停用会阻止后续 MCP 调用，不会撤回已经发出的上游请求。重新启用不会给用户新增工具授权。"
      />
    </a-modal>
  </Page>
</template>

import { requestClient } from '#/api/request';

export interface HubMetadata {
  user_id: string;
  can_manage: boolean;
  auth_mode: 'private_bearer_key';
  management_auth: 'fba_jwt';
  dynamic_code: false;
}

export interface HubTool {
  id: string;
  name: string;
  title: string;
  description: string;
  enabled: boolean;
  auto_approve: boolean;
  input_schema: Record<string, unknown>;
  granted: boolean;
}

export interface HubServer {
  id: string;
  slug: string;
  name: string;
  description: string;
  enabled: boolean;
  endpoint: string;
  tools: HubTool[];
}

export interface HubRequest {
  id: string;
  user_id: string;
  tool_ids: string[];
  granted_tool_ids: string[];
  status: 'approved' | 'partial' | 'pending' | 'rejected';
  note: null | string;
  created_time: string;
  decided_by: null | string;
}

export interface HubGrant {
  id: string;
  user_id: string;
  tool_id: string;
  generation: string;
  active: boolean;
  source: string;
  created_time: string;
}

export interface HubKey {
  id: string;
  name: string;
  status: 'active' | 'disabled' | 'revoked';
  expire_time: null | string;
  created_time: string;
  tool_ids: string[];
  effective_tool_ids: string[];
}

export interface HubPage<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

const root = '/api/v1/mcphub';

export const getMetadata = () =>
  requestClient.get<HubMetadata>(`${root}/metadata`);
export const getCatalog = () =>
  requestClient.get<{ servers: HubServer[] }>(`${root}/catalog`);
export const getGrants = (user_id?: string) =>
  requestClient.get<HubGrant[]>(`${root}/grants`, { params: { user_id } });
export const getRequests = (page: number, all = false) =>
  requestClient.get<HubPage<HubRequest>>(`${root}/requests`, {
    params: { page, size: 10, all },
  });
export const submitRequest = (tool_ids: string[], note?: string) =>
  requestClient.post<HubRequest>(`${root}/requests`, { tool_ids, note });
export const decideRequest = (id: string, approve_tool_ids: string[]) =>
  requestClient.post<HubRequest>(`${root}/requests/${id}/decision`, {
    approve_tool_ids,
  });
export const updateServer = (id: string, enabled: boolean) =>
  requestClient.request<Omit<HubServer, 'tools'>>(`${root}/servers/${id}`, {
    method: 'PATCH',
    data: { enabled },
  });
export const updateTool = (
  id: string,
  data: { auto_approve?: boolean; enabled?: boolean },
) =>
  requestClient.request<HubTool>(`${root}/tools/${id}`, {
    method: 'PATCH',
    data,
  });
export const grantTools = (user_id: string, tool_ids: string[]) =>
  requestClient.post<HubGrant[]>(`${root}/grants`, { user_id, tool_ids });
export const revokeGrant = (id: string) =>
  requestClient.delete<{ active: false; id: string }>(`${root}/grants/${id}`);
export const getKeys = (page: number) =>
  requestClient.get<HubPage<HubKey>>(`${root}/keys`, {
    params: { page, size: 10 },
  });
export const createKey = (data: {
  expire_time: null | string;
  name: string;
  tool_ids: string[];
}) => requestClient.post<{ key: HubKey; secret: string }>(`${root}/keys`, data);
export const updateKey = (
  id: string,
  data: { enabled?: boolean; name?: string; tool_ids?: string[] },
) =>
  requestClient.request<HubKey>(`${root}/keys/${id}`, {
    method: 'PATCH',
    data,
  });
export const revokeKey = (id: string) =>
  requestClient.delete<HubKey>(`${root}/keys/${id}`);

export function formatTime(value: null | string) {
  if (!value) return '永久有效';
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

export function toolLabel(servers: HubServer[], id: string) {
  for (const server of servers) {
    const tool = server.tools.find((item) => item.id === id);
    if (tool) return `${server.name} / ${tool.title} (${tool.name})`;
  }
  return `已下架工具 ${id}`;
}

export function toolGroups(
  servers: HubServer[],
  allow: (tool: HubTool, server: HubServer) => boolean,
) {
  return servers.map((server) => ({
    id: server.id,
    label: server.name,
    tools: server.tools
      .filter((tool) => allow(tool, server))
      .map((tool) => ({
        id: tool.id,
        label: `${tool.title} (${tool.name})`,
        description: tool.description,
      })),
  }));
}

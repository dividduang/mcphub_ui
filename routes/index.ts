import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    name: 'PluginMcpHub',
    path: '/plugins/mcphub',
    component: () => import('../views/index.vue'),
    meta: {
      title: 'MCP Hub',
      icon: 'lucide:network',
    },
  },
];

export default routes;

<script setup lang="ts">
interface ToolOption {
  description: string;
  disabled?: boolean;
  id: string;
  label: string;
}

interface ToolGroup {
  id: string;
  label: string;
  tools: ToolOption[];
}

defineProps<{
  disabled?: boolean;
  groups: ToolGroup[];
  label: string;
}>();

const selected = defineModel<string[]>({ required: true });

function toggle(id: string, event: Event) {
  const checked = (event.target as HTMLInputElement).checked;
  selected.value = checked
    ? [...new Set([...selected.value, id])]
    : selected.value.filter((value) => value !== id);
}
</script>

<template>
  <fieldset :disabled="disabled" class="min-w-0 space-y-3">
    <legend class="mb-2 font-medium">{{ label }}</legend>
    <a-empty
      v-if="groups.every((group) => group.tools.length === 0)"
      description="暂无可选择工具"
    />
    <fieldset
      v-for="group in groups.filter((item) => item.tools.length > 0)"
      :key="group.id"
      class="rounded-lg border border-border p-3"
    >
      <legend class="px-1 font-medium">{{ group.label }}</legend>
      <label
        v-for="tool in group.tools"
        :key="tool.id"
        class="flex items-start gap-3 rounded p-2"
        :class="tool.disabled ? 'opacity-50' : 'cursor-pointer hover:bg-accent'"
      >
        <input
          type="checkbox"
          class="mt-1 size-4 shrink-0 accent-primary"
          :checked="selected.includes(tool.id)"
          :disabled="disabled || tool.disabled"
          :aria-label="`${group.label} / ${tool.label}`"
          @change="toggle(tool.id, $event)"
        />
        <span class="min-w-0">
          <span class="block font-medium">{{ tool.label }}</span>
          <span class="block break-words text-sm text-muted-foreground">{{
            tool.description
          }}</span>
        </span>
      </label>
    </fieldset>
  </fieldset>
</template>

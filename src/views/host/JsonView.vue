<template>
  <div class="json-view">
    <!-- 对象 / 数组节点：按 key 收起、展开 -->
    <template v-if="expandable">
      <div class="json-row json-toggle" @click="expanded = !expanded">
        <a-icon :type="expanded ? 'caret-down' : 'caret-right'" class="json-caret" />
        <span v-if="label !== null" class="json-key">{{ label }}:</span>
        <span class="json-bracket">{{ isArray ? '[' : '{' }}</span>
        <template v-if="!expanded">
          <span class="json-ellipsis">…</span>
          <span class="json-bracket">{{ isArray ? ']' : '}' }}</span>
          <span class="json-summary">{{ isArray ? count + ' items' : count + ' keys' }}</span>
        </template>
      </div>
      <div v-if="expanded" class="json-children">
        <json-view
          v-for="(value, key) in data"
          :key="key"
          :label="isArray ? '[' + key + ']' : String(key)"
          :data="value"
          :init-expanded="false"
          :level="level + 1"
          :command="command"
        />
      </div>
      <div v-if="expanded" class="json-row">
        <span class="json-bracket">{{ isArray ? ']' : '}' }}</span>
      </div>
    </template>
    <!-- 基础类型 / 空对象 / 空数组：直接显示值 -->
    <div v-else class="json-row">
      <span class="json-caret json-caret-placeholder"></span>
      <span v-if="label !== null" class="json-key">{{ label }}:</span>
      <span class="json-value" :class="valueClass">{{ displayValue }}</span>
    </div>
  </div>
</template>

<script>
// 递归 JSON 树组件：对象/数组节点可点击收起、展开，默认收缩
export default {
  name: 'JsonView',
  props: {
    data: {
      required: true
    },
    // 节点显示名；根节点传 null 表示不显示 key
    label: {
      type: String,
      default: null
    },
    // 初始是否展开（根节点传 true，子节点默认收缩）
    initExpanded: {
      type: Boolean,
      default: false
    },
    // 一键展开/收起命令：{ action: 'expand' | 'collapse', seq } 沿递归树传播
    command: {
      type: Object,
      default: null
    },
    // 节点层级（根节点为 0）：收缩命令保留第一层级（根节点保持展开）
    level: {
      type: Number,
      default: 0
    }
  },
  data () {
    return {
      // 展开命令触发时，新挂载的子节点也需直接初始化为展开
      expanded: this.initExpanded || (this.command && this.command.action === 'expand')
    }
  },
  watch: {
    command (val) {
      if (val && val.action === 'expand') {
        this.expanded = true
      } else if (val && val.action === 'collapse') {
        // 收缩保留第一层级：根节点（level 0）保持展开，其余层级全部收缩
        this.expanded = this.level === 0
      }
    },
    // 展开状态变化时向上抛出（父组件仅监听根节点，用于切换按钮状态）
    expanded (val) {
      this.$emit('expanded-change', val)
    }
  },
  computed: {
    isArray () {
      return Array.isArray(this.data)
    },
    isObject () {
      return !this.isArray && typeof this.data === 'object' && this.data !== null
    },
    expandable () {
      if (this.isArray) return this.data.length > 0
      return this.isObject && Object.keys(this.data).length > 0
    },
    count () {
      return this.isArray ? this.data.length : Object.keys(this.data).length
    },
    displayValue () {
      if (this.isArray) return '[]'
      if (this.isObject) return '{}'
      if (this.data === null) return 'null'
      if (typeof this.data === 'string') return `"${this.data}"`
      return String(this.data)
    },
    valueClass () {
      if (this.isArray || this.isObject) return 'json-punct'
      if (this.data === null) return 'json-null'
      switch (typeof this.data) {
        case 'string': return 'json-string'
        case 'number': return 'json-number'
        case 'boolean': return 'json-boolean'
        default: return 'json-null'
      }
    }
  }
}
</script>

<style lang="less" scoped>
.json-view {
  font-family: SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 13px;
  line-height: 24px;
  overflow-x: auto;

  .json-row {
    display: flex;
    align-items: baseline;
    white-space: nowrap;
  }

  .json-toggle {
    cursor: pointer;
    user-select: none;
    transition: all 0.3s;

    &:hover {
      background: rgba(0, 0, 0, 0.04);
    }
  }

  .json-children {
    margin-left: 9px;
    padding-left: 12px;
    border-left: 1px solid #f0f0f0;
  }

  .json-caret {
    font-size: 10px;
    color: rgba(0, 0, 0, 0.45);
    margin-right: 6px;
    position: relative;
    top: -1px;
  }

  .json-caret-placeholder {
    visibility: hidden;
  }

  .json-key {
    color: #722ed1;
    margin-right: 8px;
  }

  .json-bracket {
    color: rgba(0, 0, 0, 0.65);
  }

  .json-ellipsis {
    color: rgba(0, 0, 0, 0.45);
  }

  .json-summary {
    color: rgba(0, 0, 0, 0.45);
    font-size: 12px;
    margin-left: 8px;
  }

  .json-value {
    word-break: break-all;

    &.json-string {
      color: #389e0d;
    }
    &.json-number {
      color: #1890ff;
    }
    &.json-boolean {
      color: #d46b08;
    }
    &.json-null,
    &.json-punct {
      color: rgba(0, 0, 0, 0.45);
    }
  }
}
</style>

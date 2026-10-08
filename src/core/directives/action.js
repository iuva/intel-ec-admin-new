import Vue from 'vue'
import store from '@/store'
import { hasAction } from '@/permission'

/**
 * 按钮权限指令：当前角色无对应按钮权限时移除元素
 * 权限配置：src/permission.js -> ROLE_CONFIG[role].actions（'模块:操作' 标识，'*' 通配全部）
 *
 * 指令用法（arg 或 value 两种写法等价）：
 *  - <a v-action:host:delete @click="handleDelete(record)">Delete</a>
 *  - <a-button v-action="'account:add'">Add Account</a-button>
 *  - <a-divider v-action:host:offline type="vertical" />
 *
 * 注意：权限在登录后即固定，指令在元素插入时判断一次；
 * 列表行刷新时元素重建会重新判断，无需额外处理
 */
const action = Vue.directive('action', {
  inserted: function (el, binding) {
    const actionName = binding.arg || binding.value
    if (!hasAction(store.getters.actions || [], actionName)) {
      el.parentNode && el.parentNode.removeChild(el)
    }
  }
})

export default action

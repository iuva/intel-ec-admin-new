import { ROLES } from '@/mock/services/account'
import { hasAction } from '@/permission'

// 密码掩码：Lab Tech 角色可见、Viewer 不可见
export const PASSWORD_MASK = '******'

// 角色判断 mixin：从 vuex 读取当前登录账号角色（登录接口返回的角色名，permission.js 守卫已归一化）
// 用法：mixins: [roleMixin]，模板中直接使用 isAdmin / isLabTech / isViewer（数据级展示控制，如密码掩码）；
// 按钮级权限统一用 v-action 指令（配置见 src/permission.js -> ROLE_CONFIG），JS 侧判断用 hasAction()
export const roleMixin = {
  computed: {
    currentRole () {
      const roles = this.$store.state.user.roles
      // 未登录兜底为 Admin，与登录 mock 的兜底行为一致
      return (roles && roles[0]) || ROLES.ADMIN
    },
    isAdmin () {
      return this.currentRole === ROLES.ADMIN
    },
    isLabTech () {
      return this.currentRole === ROLES.LAB_TECH
    },
    isViewer () {
      return this.currentRole === ROLES.VIEWER
    }
  },
  methods: {
    // 按钮权限判断（与 v-action 指令同一份配置）
    hasAction (action) {
      return hasAction(this.$store.getters.actions || [], action)
    }
  }
}

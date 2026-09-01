import { ROLES } from '@/mock/services/account'

// 密码掩码：Lab Tech 角色可见、Viewer 不可见
export const PASSWORD_MASK = '******'

// 角色判断 mixin：从 vuex 读取当前登录账号角色（getInfo 返回的 role.name）
// 用法：mixins: [roleMixin]，模板中直接使用 isAdmin / isLabTech / isViewer
export const roleMixin = {
  computed: {
    currentRole () {
      const roles = this.$store.state.user.roles
      // 未登录兜底为 Admin，与 mock getInfo 的兜底行为一致
      return (roles && roles.name) || ROLES.ADMIN
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
  }
}

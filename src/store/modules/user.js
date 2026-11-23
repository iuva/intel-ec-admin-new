import storage from 'store'
import expirePlugin from 'store/plugins/expire'
import { getInfo } from '@/api/login'
import { login } from '@/api/index'
import { ACCESS_TOKEN, REFRESH_TOKEN, CURRENT_USER } from '@/store/mutation-types'
import { welcome } from '@/utils/util'

storage.addPlugin(expirePlugin)
const user = {
  state: {
    token: '',
    refreshToken: '',
    name: '',
    welcome: '',
    avatar: '',
    roles: [],
    // 当前角色按钮权限数组（permission.js 守卫按 ROLE_CONFIG 写入，v-action 指令 / hasAction 消费）
    actions: [],
    info: {}
  },

  mutations: {
    SET_TOKEN: (state, token) => {
      state.token = token
    },
    SET_REFRESH_TOKEN: (state, refreshToken) => {
      state.refreshToken = refreshToken
    },
    SET_NAME: (state, { name, welcome }) => {
      state.name = name
      state.welcome = welcome
    },
    SET_AVATAR: (state, avatar) => {
      state.avatar = avatar
    },
    SET_ROLES: (state, roles) => {
      state.roles = roles
    },
    SET_ACTIONS: (state, actions) => {
      state.actions = actions
    },
    SET_INFO: (state, info) => {
      state.info = info
    }
  },

  actions: {
    // 登录
    Login ({ commit }, userInfo) {
      return new Promise((resolve, reject) => {
        login(userInfo).then(response => {
          const result = response.data
          // 换账号重新登录时清空旧的动态路由（如 401 跳登录页等未走 Logout 的路径），
          // 保证守卫按新角色重新生成左侧菜单
          commit('SET_ROUTERS', [])
          storage.set(ACCESS_TOKEN, result.token)
          storage.set(REFRESH_TOKEN, result.refresh_token)
          // 持久化当前账号：刷新页面后按此还原角色与路由权限（后续接入 getInfo 接口可整体替换）
          storage.set(CURRENT_USER, { name: userInfo.username, role: result.role, avatar: result.avatar || '/avatar2.jpg' })
          commit('SET_TOKEN', result.token)
          commit('SET_REFRESH_TOKEN', result.refresh_token)
          commit('SET_NAME', { name: userInfo.username })
          commit('SET_ROLES', [result.role])
          resolve()
        }).catch(error => {
          reject(error)
        })
      })
    },

    // 获取用户信息
    GetInfo ({ commit }) {
      return new Promise((resolve, reject) => {
        // 请求后端获取用户信息 /api/user/info
        getInfo().then(response => {
          const { result } = response
          if (result.role && result.role.permissions.length > 0) {
            const role = { ...result.role }
            role.permissions = result.role.permissions.map(permission => {
              const per = {
                ...permission,
                actionList: (permission.actionEntitySet || {}).map(item => item.action)
               }
              return per
            })
            role.permissionList = role.permissions.map(permission => { return permission.permissionId })
            // 覆盖响应体的 role, 供下游使用
            result.role = role

            commit('SET_ROLES', role)
            commit('SET_INFO', result)
            commit('SET_NAME', { name: result.name, welcome: welcome() })
            commit('SET_AVATAR', result.avatar)
            // 下游
            resolve(result)
          } else {
            reject(new Error('getInfo: roles must be a non-null array !'))
          }
        }).catch(error => {
          reject(error)
        })
      })
    },

    // 登出
    Logout ({ commit, state }) {
      return new Promise((resolve) => {
        // logout({ token: `Bearer ${state.token}` }).then(() => {
          commit('SET_TOKEN', '')
          commit('SET_REFRESH_TOKEN', '')
          commit('SET_ROLES', [])
          commit('SET_ACTIONS', [])
          // 清空已生成的动态路由：换角色重新登录时守卫会按新角色重新生成
          commit('SET_ROUTERS', [])
          storage.remove(ACCESS_TOKEN)
          storage.remove(REFRESH_TOKEN)
          storage.remove(CURRENT_USER)
          resolve()
        // }).catch((err) => {
        //   console.log('logout fail:', err)
        //   // resolve()
        // }).finally(() => {
        // })
      })
    }

  }
}

export default user

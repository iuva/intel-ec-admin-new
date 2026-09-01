import Mock from 'mockjs2'
import md5 from 'md5'
import { builder, getBody } from '../util'
import { mockAccounts, setSessionUser, clearSessionUser } from './account'

// 登录校验改为按「账号管理」共享账号列表：用哪个账号登录，即以该账号角色控制各页面权限
// （Login.vue 提交前对密码做 md5，这里同样以 md5 比对）
const login = (options) => {
  const body = getBody(options)
  console.log('mock: body', body)
  const account = mockAccounts.find(item => item.username === body.username)
  if (!account || md5(account.password) !== body.password) {
    return builder({ isLogin: true }, '账户或密码错误', 401)
  }

  // 记录会话用户，供 getInfo 返回对应角色
  setSessionUser(account.username)

  return builder({
    'id': account.id,
    'name': account.username,
    'username': account.username,
    'password': '',
    'avatar': 'https://gw.alipayobjects.com/zos/rmsportal/jZUIxmJycoymBprLOUbT.png',
    'status': 1,
    'telephone': '',
    'lastLoginIp': '27.154.74.117',
    'lastLoginTime': 1534837621348,
    'creatorId': 'admin',
    'createTime': 1497160610259,
    'deleted': 0,
    'roleId': account.role,
    'lang': 'zh-CN',
    'token': 'mock-token-' + account.username
  }, '', 200, { 'Custom-Header': Mock.mock('@guid') })
}

const logout = () => {
  clearSessionUser()
  return builder({}, '[测试接口] 注销成功')
}

const smsCaptcha = () => {
  return builder({ captcha: Mock.mock('@integer(10000, 99999)') })
}

const twofactor = () => {
  return builder({ stepCode: Mock.mock('@integer(0, 1)') })
}

Mock.mock(/\/auth\/login/, 'post', login)
Mock.mock(/\/auth\/logout/, 'post', logout)
Mock.mock(/\/account\/sms/, 'post', smsCaptcha)
Mock.mock(/\/auth\/2step-code/, 'post', twofactor)


export const getPermissionList = () => {
  const pList = ['home', 'dashboard', 'form', 'table', 'profile', 'result', 'exception', 'user', 'account-management']

  return {
    id: 'Admin',
      name: 'Admin',
    describe: 'All actions (incl. Delete, Account Management)',
    status: 1,
    creatorId: 'system',
    createTime: 1497160610259,
    deleted: 0,
    permissions: pList.map(permissionId => {
    return {
      roleId: 'Admin',
      permissionId: permissionId,
      permissionName: permissionId,
      actions: '[]',
      actionEntitySet: [],
      actionList: null,
      dataAccess: null
    }
  })
  }
}


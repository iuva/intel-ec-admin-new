// JSON 差异比较工具
// 语义约定：oldValue = 上一次审批通过的硬件信息（旧），newValue = 本次更新的硬件信息（新）
//   added    仅存在于新数据 → 新增（绿色）
//   deleted  仅存在于旧数据 → 删除（红色）
//   modified 两边均存在但值不同 → 修改（黄色）

const isContainer = (v) => v !== null && typeof v === 'object'

const isEqual = (a, b) => {
  if (a === b) return true
  if (isContainer(a) && isContainer(b)) return JSON.stringify(a) === JSON.stringify(b)
  return false
}

// 对象按新数据 key 顺序为主、旧数据独有 key 追加在后；数组按下标逐位比较
const buildChildren = (oldVal, newVal) => {
  if (Array.isArray(newVal)) {
    const oldArr = Array.isArray(oldVal) ? oldVal : []
    const len = Math.max(newVal.length, oldArr.length)
    const children = []
    for (let i = 0; i < len; i++) {
      children.push(buildDiffTree('[' + i + ']', oldArr[i], newVal[i]))
    }
    return children
  }
  const oldObj = isContainer(oldVal) ? oldVal : {}
  const keys = Object.keys(newVal)
  Object.keys(oldObj).forEach((k) => {
    if (!(k in newVal)) keys.push(k)
  })
  return keys.map((k) => buildDiffTree(k, oldObj[k], newVal[k]))
}

// 构建差异树节点：{ label, oldVal, newVal, status, children }
// children 为 null 表示叶子节点（基础类型值），为数组（含空数组）表示容器节点（对象/数组）
export function buildDiffTree (label, oldVal, newVal) {
  const node = { label, oldVal, newVal, status: 'same', children: null }
  const missingOld = oldVal === undefined
  const missingNew = newVal === undefined
  if (missingOld || missingNew) {
    // 单侧存在：整块新增/删除；容器继续下钻，让每个子叶子都带上新增/删除标识
    node.status = missingOld ? 'added' : 'deleted'
    const present = missingOld ? newVal : oldVal
    if (isContainer(present)) {
      const empty = Array.isArray(present) ? [] : {}
      node.children = missingOld ? buildChildren(empty, present) : buildChildren(present, empty)
    }
    return node
  }
  const bothContainer = isContainer(oldVal) && isContainer(newVal) &&
    Array.isArray(oldVal) === Array.isArray(newVal)
  if (bothContainer) {
    node.status = 'container'
    node.children = buildChildren(oldVal, newVal)
    return node
  }
  // 基础类型比较 / 容器与基础类型比较（类型变更视为修改）
  if (!isEqual(oldVal, newVal)) {
    node.status = 'modified'
  }
  return node
}

// 统计叶子级差异数量：addNum=新增 delNum=删除 modNum=修改 isChanged=是否存在差异
export function countDiffStats (oldVal, newVal) {
  const stat = { addNum: 0, delNum: 0, modNum: 0, isChanged: false }
  const walk = (node) => {
    if (node.children) {
      // 容器节点本身不计数，仅统计叶子级差异；空容器整块新增/删除计 1
      if (node.children.length === 0 && (node.status === 'added' || node.status === 'deleted')) {
        stat[node.status === 'added' ? 'addNum' : 'delNum']++
      } else {
        node.children.forEach(walk)
      }
      return
    }
    if (node.status === 'added') stat.addNum++
    else if (node.status === 'deleted') stat.delNum++
    else if (node.status === 'modified') stat.modNum++
  }
  walk(buildDiffTree(null, oldVal, newVal))
  stat.isChanged = stat.addNum + stat.delNum + stat.modNum > 0
  return stat
}

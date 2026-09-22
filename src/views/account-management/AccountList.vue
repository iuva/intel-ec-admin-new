<template>
  <!-- 一级功能页：面包屑仅显示功能名本身（覆盖 matched 多层级默认渲染） -->
  <page-header-wrapper
    class="account-management"
    :breadcrumb="{ props: { routes: [{ path: '/account-management', breadcrumbName: $t('menu.account-management') }] } }"
  >
    <a-card :bordered="false">
      <div class="table-page-search-wrapper">
        <a-form layout="inline">
          <a-row :gutter="48">
            <a-col :md="8" :sm="24">
              <a-form-item label="Username">
                <a-input v-model="queryParam.username" placeholder="Please enter Username" />
              </a-form-item>
            </a-col>
            <a-col :md="8" :sm="24">
              <a-form-item label="Role">
                <a-select v-model="queryParam.role" placeholder="Please select">
                  <a-select-option value="">All</a-select-option>
                  <a-select-option value="Admin">Admin</a-select-option>
                  <a-select-option value="Lab Tech">Lab Tech</a-select-option>
                  <a-select-option value="Viewer">Viewer</a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
            <a-col :md="8" :sm="24">
              <span class="table-page-search-submitButtons">
                <a-button type="primary" @click="$refs.table.refresh(true)">Search</a-button>
                <a-button style="margin-left: 8px" @click="handleReset">Reset</a-button>
              </span>
            </a-col>
          </a-row>
        </a-form>
      </div>

      <div class="table-operator">
        <!-- 新增账号：仅 Admin 可见 -->
        <a-button v-if="isAdmin" type="dashed" icon="plus" @click="handleAdd">Add Account</a-button>
      </div>

      <s-table
        ref="table"
        size="default"
        rowKey="id"
        :columns="columns"
        :data="loadData"
        showPagination="auto"
      >
        <span slot="role" slot-scope="text">
          <a-tag :color="text | roleColorFilter">{{ text }}</a-tag>
        </span>

        <!-- 密码列：Admin 明文 / Lab Tech 掩码 / Viewer 整列隐藏 -->
        <span slot="password" slot-scope="text">
          <span class="password-text">{{ text }}</span>
        </span>

        <span slot="action" slot-scope="text, record" class="account-actions">
          <template>
            <a @click="handleView(record)">View</a>
            <template v-if="isAdmin">
              <a-divider type="vertical" />
              <a class="danger-link" @click="handleDelete(record)">Delete</a>
            </template>
          </template>
        </span>
      </s-table>

      <!-- 新增/编辑账号共用弹窗：新增与查看/编辑仅模式不同 -->
      <a-modal
        :title="isEdit ? 'Edit Account' : 'Add Account'"
        :width="520"
        :visible="dialogVisible"
        :confirmLoading="dialogSubmitting"
        @cancel="handleDialogCancel"
        @ok="handleDialogSubmit"
      >
        <a-form :form="dialogForm" v-bind="formItemLayout">
          <a-form-item label="Username">
            <!-- 编辑模式用户名不可修改 -->
            <a-input
              v-decorator="['username', { rules: [{ required: true, message: 'Please enter username' }, { validator: handleValidateUsername }] }]"
              placeholder="Please enter username"
              :disabled="isEdit"
            />
          </a-form-item>
          <a-form-item label="Role">
            <!-- 编辑模式角色不可修改，仅新增时可选 -->
            <a-select
              v-decorator="['role', { rules: [{ required: true, message: 'Please select role' }], initialValue: 'Viewer' }]"
              :disabled="isEdit"
            >
              <a-select-option value="Admin">Admin</a-select-option>
              <a-select-option value="Lab Tech">Lab Tech</a-select-option>
              <a-select-option value="Viewer">Viewer</a-select-option>
            </a-select>
          </a-form-item>
          <!-- 密码：新增/编辑均必填（View 打开编辑弹窗的目的就是修改密码，账号名不可改）；
               Lab Tech 掩码展示不可编辑；Viewer 不可见。
               长引导/约束文案放 extra 常驻展示在输入框下方，placeholder 只留简短内容提示 -->
          <template v-if="showPasswordFields">
            <a-form-item label="Password" extra="At least 6 characters">
              <a-input-password
                v-decorator="['password', { rules: [{ required: true, message: 'Please enter password' }, { min: 6, message: 'Password must be at least 6 characters' }] }]"
                placeholder="Please enter password"
              />
            </a-form-item>
            <a-form-item label="Confirm Password">
              <a-input-password
                v-decorator="['confirm', { rules: [{ required: true, message: 'Please confirm password' }, { validator: handleConfirmPassword }] }]"
                placeholder="Please enter again"
              />
            </a-form-item>
          </template>
          <!-- Lab Tech 编辑：密码掩码展示，不可编辑 -->
          <a-form-item v-if="isEdit && isLabTech" label="Password">
            <a-input class="password-text" value="******" disabled />
          </a-form-item>
        </a-form>
      </a-modal>
    </a-card>
  </page-header-wrapper>
</template>

<script>
import { STable, Ellipsis } from '@/components'
import { roleMixin } from '@/utils/roles'
import { mockAccounts, addAccount, updateAccount, deleteAccount, ROLES } from '@/mock/services/account'

// 密码掩码：Lab Tech 可见掩码，Viewer 整列隐藏，Admin 明文
const PASSWORD_MASK = '******'

export default {
  name: 'AccountManagementList',
  components: {
    STable,
    Ellipsis
  },
  mixins: [roleMixin],
  beforeCreate () {
    // 新增/编辑账号共用表单
    this.dialogForm = this.$form.createForm(this)
  },
  data () {
    return {
      // 新增/编辑共用弹窗：editingAccount 为空 = 新增模式
      dialogVisible: false,
      dialogSubmitting: false,
      editingAccount: null,
      formItemLayout: {
        labelCol: { lg: { span: 7 }, sm: { span: 7 } },
        wrapperCol: { lg: { span: 13 }, sm: { span: 15 } }
      },
      // 查询参数
      queryParam: {},
      // 加载数据方法 必须为 Promise 对象
      loadData: parameter => {
        const requestParameters = Object.assign({}, parameter, this.queryParam)
        // TODO: 替换为后端接口，如 getAccountList(requestParameters)
        const filtered = mockAccounts.filter(item => {
          return (!requestParameters.username || item.username.toLowerCase().includes(requestParameters.username.toLowerCase())) &&
            (!requestParameters.role || item.role === requestParameters.role)
        })
        // 密码展示按当前登录角色：Admin 明文 / Lab Tech 掩码 / Viewer 不可见（列已隐藏）
        const withPassword = filtered.map(item => {
          return { ...item, password: this.isAdmin ? item.password : PASSWORD_MASK }
        })
        return new Promise(resolve => {
          resolve({
            pageSize: parameter.pageSize || 10,
            pageNo: parameter.pageNo || 1,
            totalCount: withPassword.length,
            totalPage: Math.ceil(withPassword.length / (parameter.pageSize || 10)),
            data: withPassword
          })
        })
      }
    }
  },
  computed: {
    // 弹窗是否处于编辑模式（View 打开）
    isEdit () {
      return !!this.editingAccount
    },
    // 密码字段显隐：新增/编辑均为必填（View 弹窗的目的即修改密码）；
    // 编辑模式仅 Admin 可见；Viewer 永远不可见
    showPasswordFields () {
      if (this.isEdit) {
        return this.isAdmin
      }
      return !this.isViewer
    },
    // 密码列按角色显隐：Viewer 不渲染该列
    columns () {
      const baseColumns = [
        { title: 'ID', dataIndex: 'id' },
        { title: 'Username', dataIndex: 'username' },
        { title: 'Role', dataIndex: 'role', scopedSlots: { customRender: 'role' } }
      ]
      if (!this.isViewer) {
        baseColumns.push({ title: 'Password', dataIndex: 'password', scopedSlots: { customRender: 'password' } })
      }
      baseColumns.push(
        { title: 'Create Time', dataIndex: 'createTime' },
        { title: 'Last Login', dataIndex: 'lastLoginTime' },
        {
          title: 'Action',
          dataIndex: 'action',
          // width: '1%' 为最小宽度提示：操作列收缩到内容宽度并整体靠右，
          // 右缘到表格右侧的 16px 内边距与 ID 列左缘的 16px 间距对称；
          // 列内保持左对齐，富余宽度全部分给数据列
          width: '1%',
          scopedSlots: { customRender: 'action' }
        }
      )
      return baseColumns
    }
  },
  filters: {
    roleColorFilter (role) {
      const colorMap = {
        [ROLES.ADMIN]: 'geekblue',
        [ROLES.LAB_TECH]: 'cyan',
        [ROLES.VIEWER]: 'green'
      }
      return colorMap[role] || 'default'
    }
  },
  methods: {
    handleReset () {
      this.queryParam = {}
      this.$refs.table.refresh(true)
    },
    // 打开共用弹窗：新增模式
    handleAdd () {
      this.editingAccount = null
      this.dialogVisible = true
      this.$nextTick(() => {
        this.dialogForm.resetFields()
      })
    },
    // 打开共用弹窗：查看/编辑模式（View）
    handleView (record) {
      // 找到原始数据（表格数据里的密码可能是掩码）
      const account = mockAccounts.find(item => item.id === record.id)
      if (!account) return
      this.editingAccount = { ...account }
      this.dialogVisible = true
      this.$nextTick(() => {
        this.dialogForm.resetFields()
        this.dialogForm.setFieldsValue({
          username: account.username,
          role: account.role
        })
      })
    },
    // 删除账号：仅 Admin 可见；不可删除当前登录账号；带二次确认弹窗
    handleDelete (record) {
      const currentUsername = this.$store.state.user.info.username
      if (record.username === currentUsername) {
        this.$message.warning('Cannot delete the account you are currently logged in with')
        return
      }
      const that = this
      this.$confirm({
        title: 'Delete Account',
        content: `Are you sure to delete account ${record.username}? This action cannot be undone!`,
        okText: 'Delete',
        okType: 'danger',
        cancelText: 'Cancel',
        onOk () {
          // TODO: 调用后端删除接口
          deleteAccount(record.id)
          that.$message.success(`Account ${record.username} deleted`)
          that.$refs.table.refresh()
        }
      })
    },
    // 关闭弹窗并重置表单
    handleDialogCancel () {
      this.dialogVisible = false
      this.dialogForm.resetFields()
      this.editingAccount = null
    },
    // 用户名唯一性校验（编辑模式排除自身）
    handleValidateUsername (rule, value, callback) {
      if (value && mockAccounts.some(item => item.id !== (this.editingAccount || {}).id && item.username.toLowerCase() === value.trim().toLowerCase())) {
        callback(new Error('Username already exists'))
      } else {
        callback()
      }
    },
    // 确认密码与密码一致（编辑模式密码可留空）
    handleConfirmPassword (rule, value, callback) {
      const password = this.dialogForm.getFieldValue('password')
      if (password && value !== password) {
        callback(new Error('Two passwords do not match'))
      } else {
        callback()
      }
    },
    // 提交弹窗：新增 / 编辑
    handleDialogSubmit () {
      const that = this
      this.dialogForm.validateFields((err, values) => {
        if (err) return
        that.dialogSubmitting = true
        // TODO: 替换为后端接口（新增/编辑账号）
        setTimeout(() => {
          if (that.isEdit) {
            // 编辑：角色不可修改（仅回显原值），密码为必填项（View 弹窗的目的即修改密码）
            updateAccount(that.editingAccount.id, {
              role: that.editingAccount.role,
              password: values.password
            })
            that.$message.success(`Account ${values.username} updated`)
          } else {
            addAccount({
              username: values.username.trim(),
              password: values.password,
              role: values.role
            })
            that.$message.success(`Account ${values.username.trim()} created`)
          }
          that.dialogSubmitting = false
          that.dialogVisible = false
          that.editingAccount = null
          that.$refs.table.refresh()
        }, 500)
      })
    }
  }
}
</script>

<style lang="less" scoped>

// 搜索区域：标签固定宽度右对齐，保证各列控件起始位置统一
.table-page-search-wrapper {
  /deep/ .ant-form-item-label {
    flex: 0 0 96px;
    text-align: right;

    > label {
      width: 100%;
      text-align: right;
    }
  }

  // 按钮与同行输入控件垂直对齐
  .table-page-search-submitButtons {
    height: 32px;
    line-height: 32px;
  }
}

// 操作按钮区域：与表格之间留出间距
.table-operator {
  margin-bottom: 16px;
}

// 表格视觉：各列「均分」指列间距一致——单元格左右内边距统一（默认16px），
// 列宽由内容自适应动态重排；单词内不折行
/deep/ .ant-table-tbody > tr > td {
  word-break: keep-all;
  padding-left: 16px;
  padding-right: 16px;
}

.account-actions {
  display: inline-flex;
  // 禁止折行：操作列按最小内容宽度收缩时，最小宽度即整行链接宽度，
  // 保证 View~Delete 始终单行显示
  flex-wrap: nowrap;
  white-space: nowrap;
  align-items: center;

  // 收紧分隔线间距，与单元格 padding 协调，保持列间距视觉一致
  /deep/ .ant-divider-vertical {
    margin: 0 4px;
  }
}

// 密码列/掩码：统一等宽字体展示
.password-text {
  font-family: SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace;
  color: rgba(0, 0, 0, 0.85);
}

.danger-link {
  color: #f5222d;

  &:hover {
    color: #ff7875;
  }
}
</style>

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
                  <a-select-option value="admin">Admin</a-select-option>
                  <a-select-option value="labtech">Lab Tech</a-select-option>
                  <a-select-option value="viewer">Viewer</a-select-option>
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
        <!-- 按钮权限：v-action 配置见 src/permission.js -> ROLE_CONFIG[role].actions（仅 Admin 可见） -->
        <a-button v-action:account:add type="dashed" icon="plus" @click="handleAdd">Add Account</a-button>
      </div>

      <s-table
        ref="table"
        size="default"
        rowKey="id"
        :columns="columns"
        :data="getAccountList"
        :dataBefore="accountListReq"
        :dataAfter="accountListRes"
        :params="queryParam"
        showPagination="auto"
      >
        <span slot="role" slot-scope="text">
          <a-tag :color="text | roleColorFilter">{{ text }}</a-tag>
        </span>

        <!-- 密码列：后端统一下发掩码（admin/labtech），viewer 请求时不下发该字段、整列隐藏 -->
        <span slot="password" slot-scope="text">
          <span class="password-text">{{ text }}</span>
        </span>

        <span slot="action" slot-scope="text, record" class="account-actions">
          <a @click="handleView(record)">View</a>
          <a-divider v-action:account:delete type="vertical" />
          <a v-action:account:delete class="danger-link" @click="handleDelete(record)">Delete</a>
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
            <!-- 编辑模式用户名不可修改；唯一性由后端校验（422 账号已存在） -->
            <a-input
              v-decorator="['username', { rules: [{ required: true, message: 'Please enter username' }] }]"
              placeholder="Please enter username"
              :disabled="isEdit"
            />
          </a-form-item>
          <a-form-item label="Role">
            <!-- 编辑模式角色不可修改，仅新增时可选 -->
            <a-select
              v-decorator="['role', { rules: [{ required: true, message: 'Please select role' }], initialValue: 'viewer' }]"
              :disabled="isEdit"
            >
              <a-select-option value="admin">Admin</a-select-option>
              <a-select-option value="labtech">Lab Tech</a-select-option>
              <a-select-option value="viewer">Viewer</a-select-option>
            </a-select>
          </a-form-item>
          <!-- 密码：新增/编辑均必填（View 打开编辑弹窗的目的就是修改密码，账号名不可改）；
               Lab Tech 掩码展示不可编辑；Viewer 不可见。
               长引导/约束文案放 extra 常驻展示在输入框下方，placeholder 只留简短内容提示 -->
          <template v-if="showPasswordFields">
            <a-form-item label="Password" extra="At least 8 characters, including uppercase, lowercase and number">
              <a-input-password
                v-decorator="['password', { rules: [{ required: true, message: 'Please enter password' }, { min: 8, message: 'Password must be at least 8 characters' }, { pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, message: 'Password must contain uppercase and lowercase letters and numbers' }] }]"
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
import { getAccountList, addAccount, updateAccount, deleteAccount } from '@/api/account'

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
      // 查询参数（变量名以接口文档 §6 为准）
      queryParam: {},
      getAccountList
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
    // 密码列按角色显隐：viewer 请求时后端不下发 password 字段，列亦不渲染
    columns () {
      const baseColumns = [
        { title: 'ID', dataIndex: 'id' },
        { title: 'Username', dataIndex: 'user_account' },
        { title: 'Role', dataIndex: 'role', scopedSlots: { customRender: 'role' } }
      ]
      if (!this.isViewer) {
        baseColumns.push({ title: 'Password', dataIndex: 'password', scopedSlots: { customRender: 'password' } })
      }
      baseColumns.push(
        { title: 'Create Time', dataIndex: 'created_time' },
        { title: 'Last Login', dataIndex: 'last_login_time' },
        {
          title: 'Action',
          dataIndex: 'action',
          scopedSlots: { customRender: 'action' }
        }
      )
      return baseColumns
    }
  },
  filters: {
    roleColorFilter (role) {
      const colorMap = {
        admin: 'geekblue',
        labtech: 'cyan',
        viewer: 'green'
      }
      return colorMap[role] || 'default'
    }
  },
  methods: {
    // 请求前参数处理：s-table 通用分页参数转换为契约分页参数，剔除空值搜索条件，
    // 并把页面展示角色（Admin/Lab Tech/Viewer）转为契约取值（admin/labtech/viewer）
    accountListReq (params) {
      params.page = params.pageNo
      params.page_size = params.pageSize
      delete params.pageNo
      delete params.pageSize
      Object.keys(params).forEach(key => {
        if (params[key] === '' || params[key] === undefined || params[key] === null) {
          delete params[key]
        }
      })
    },
    // 响应映射：信封 {code, message, data} → s-table 结构（契约 data: {list, page, page_size, total}）
    accountListRes (res) {
      return {
        pageNo: res.page,
        totalCount: res.total,
        data: res.list
      }
    },
    handleReset () {
      this.queryParam = {}
      this.$nextTick(() => {
        this.$refs.table.refresh(true)
      })
    },
    // 打开共用弹窗：新增模式
    handleAdd () {
      this.editingAccount = null
      this.dialogVisible = true
      this.$nextTick(() => {
        this.dialogForm.resetFields()
      })
    },
    // 打开共用弹窗：查看/编辑模式（View）；列表 password 恒为掩码，编辑仅回显账号与角色
    handleView (record) {
      this.editingAccount = { ...record }
      this.dialogVisible = true
      this.$nextTick(() => {
        this.dialogForm.resetFields()
        this.dialogForm.setFieldsValue({
          username: record.user_account,
          role: record.role
        })
      })
    },
    // 删除账号：仅 Admin 可见；不可删除当前登录账号（后端同时兜底：不能删自己/最后一个启用 admin）；带二次确认弹窗
    handleDelete (record) {
      const currentUsername = this.$store.state.user.name
      if (record.user_account === currentUsername) {
        this.$message.warning('Cannot delete the account you are currently logged in with')
        return
      }
      this.$confirm({
        title: 'Delete Account',
        content: `Are you sure to delete account ${record.user_account}? This action cannot be undone!`,
        okText: 'Delete',
        okType: 'danger',
        cancelText: 'Cancel',
        onOk: () => {
          deleteAccount(record.id).then(() => {
            this.$message.success(`Account ${record.user_account} deleted`)
            this.$refs.table.refresh()
          }).catch(error => {
            this.$message.error(this.getErrorMessage(error, 'Delete failed'))
          })
        }
      })
    },
    // 关闭弹窗并重置表单
    handleDialogCancel () {
      this.dialogVisible = false
      this.dialogForm.resetFields()
      this.editingAccount = null
    },
    // 接口错误文案：优先取后端 message（如 422 账号已存在/密码强度/不能删最后一个启用 admin），否则回退默认提示
    getErrorMessage (error, fallback) {
      return (error.response && error.response.data && error.response.data.message) || fallback
    },
    // 确认密码与密码一致（新增/编辑密码均为必填）
    handleConfirmPassword (rule, value, callback) {
      const password = this.dialogForm.getFieldValue('password')
      if (password && value !== password) {
        callback(new Error('Two passwords do not match'))
      } else {
        callback()
      }
    },
    // 提交弹窗：新增 / 编辑
    // 编辑仅改密码（user_account 不可变，角色仅回显）；契约：改密后该用户即时失效需重新登录
    handleDialogSubmit () {
      this.dialogForm.validateFields((err, values) => {
        if (err) return
        this.dialogSubmitting = true
        const request = this.isEdit
          ? updateAccount(this.editingAccount.id, { password: values.password })
          : addAccount({
              user_account: values.username.trim(),
              password: values.password,
              password_confirm: values.confirm,
              role: values.role
            })
        request.then(() => {
          this.$message.success(this.isEdit ? `Account ${values.username} updated` : `Account ${values.username.trim()} created`)
          this.dialogVisible = false
          this.editingAccount = null
          this.$refs.table.refresh()
        }).catch(error => {
          this.$message.error(this.getErrorMessage(error, this.isEdit ? 'Update failed' : 'Create failed'))
        }).finally(() => {
          this.dialogSubmitting = false
        })
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

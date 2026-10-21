<template>
  <!-- 一级功能页：面包屑仅显示功能名本身（覆盖 matched 多层级默认渲染） -->
  <page-header-wrapper
    class="ota-management"
    :breadcrumb="{ props: { routes: [{ path: '/ota-management', breadcrumbName: $t('menu.ota-management') }] } }"
  >
    <a-card :bordered="false">
      <a-tabs v-model="activeTab">
        <!-- 新增版本：与 tab 标题平齐，显示在右侧 -->
        <a-button slot="tabBarExtraContent" type="primary" @click="openAddModal" v-action:ota:new >New Version</a-button>
        <a-tab-pane v-for="sys in systems" :key="sys.key">
          <span slot="tab">
            <a-icon :type="sys.icon" />
            {{ sys.key }}
          </span>
          <div class="ota-layout">
            <!-- 左侧：版本列表（服务端数据，当前版本行高亮） -->
            <div class="record-table">
              <a-table
                :row-key="record => (record.id != null ? record.id : record.version)"
                :columns="columns"
                :data-source="activeReleases"
                :loading="releaseLoading"
                :pagination="{ pageSize: 10, size: 'small' }"
                :scroll="{ y: 450 }"
                :row-class-name="record => (record.current ? 'is-current-row' : '')"
              >
                <template slot="current" slot-scope="text, row">
                  <a-tag v-if="text" color="green">Current</a-tag>
                  <!-- 非当前版本：行内发版 -->
                  <a-button
                    v-else
                    type="primary"
                    size="small"
                    class="publish-cell-btn"
                    v-action:ota:push
                    @click="handlePublish(row)"
                  >
                    Publish
                  </a-button>
                </template>
                <template slot="md5" slot-scope="text">
                  <span class="md5-cell" :title="text">{{ text }}</span>
                </template>
              </a-table>
            </div>
            <!-- 右侧：当前版本推送详情（契约 §5：接口只返回最近一次推送版本，用户定稿只展示当前版本） -->
            <div class="record-detail">
              <template v-if="activeResult">
                <div class="detail-title">
                  <span>{{ activeResult.version }} Push Details</span>
                </div>
                <!-- 概览数量 -->
                <div class="summary-grid">
                  <div v-for="stat in summaryFields" :key="stat.label" class="summary-item" :class="stat.type">
                    <div class="summary-value">{{ stat.calc(activeResult.stats) }}</div>
                    <div class="summary-label">{{ stat.label }}</div>
                  </div>
                </div>
                <!-- 失败明细：retry=true 的行可定向重推 -->
                <a-table
                  row-key="host_id"
                  class="host-table"
                  :columns="failedColumns"
                  :data-source="activeResult.hosts || []"
                  :loading="resultLoading"
                  :pagination="{ pageSize: 5, size: 'small' }"
                >
                  <template slot="state" slot-scope="text">
                    <a-tag :color="stateColor(text)">{{ text }}</a-tag>
                  </template>
                  <template slot="action" slot-scope="text, row">
                    <a-button v-if="row.retryable" type="link" size="small" @click="handleRetry(row)" v-action:ota:retry>
                      Retry
                    </a-button>
                  </template>
                </a-table>
              </template>
              <a-empty v-else description="No push records yet" />
            </div>
          </div>
        </a-tab-pane>
      </a-tabs>

      <!-- 新增版本弹窗：仅选择安装包，版本号与 MD5 由服务端解析 -->
      <a-modal
        title="New Version"
        :visible="addModal.visible"
        :confirm-loading="addModal.uploading"
        @ok="handleAddSubmit"
        @cancel="addModal.visible = false"
      >
        <div class="add-field">
          <span class="add-label"><span class="required-star">*</span>Installation Package:</span>
          <a-upload :show-upload-list="false" :before-upload="handleAddFile">
            <a-button><a-icon type="upload" /> Select File</a-button>
          </a-upload>
          <span v-if="addModal.fileName" class="add-file" :title="addModal.fileName">{{ addModal.fileName }}</span>
        </div>
      </a-modal>
    </a-card>
  </page-header-wrapper>
</template>

<script>
import { fetchReleases, fetchDeployResult, deploy, upload } from '@/api/ota'

const getErrMsg = (e, fallback) => (e && e.response && e.response.data && e.response.data.message) || fallback

export default {
  name: 'OtaManagement',
  data () {
    return {
      activeTab: 'agent',
      // 页签配置：key 即接口 app_key（契约 §5）
      systems: [
        { key: 'agent', icon: 'robot' },
        { key: 'ek', icon: 'usb' },
        { key: 'dmr_config', icon: 'setting' }
      ],
      // 版本列表（按 app_key 缓存）：行字段 id/version/file_name/md5/current
      releases: { agent: [], ek: [], dmr_config: [] },
      releaseLoading: false,
      // 当前版本推送详情（按 app_key 缓存）：{ version, to_upgrade, upgraded, failed, list }
      results: { agent: null, ek: null, dmr_config: null },
      resultLoading: false,
      // 版本列表列
      columns: [
        { title: 'Version', dataIndex: 'conf_ver' },
        { title: 'Installation Package', dataIndex: 'artifactory_path' },
        { title: 'MD5', dataIndex: 'md5', scopedSlots: { customRender: 'md5' } },
        { title: 'Current', dataIndex: 'current', align: 'center', scopedSlots: { customRender: 'current' } }
      ],
      // 失败明细列：Retry 仅对 retry=true 的行展示（重推复用 deploy 定向单播）
      failedColumns: [
        { title: 'Host Name', dataIndex: 'host_name', width: 140 },
        { title: 'State', dataIndex: 'state', width: 180, align: 'center', scopedSlots: { customRender: 'state' } },
        { title: 'Action', dataIndex: 'host_id', width: 120, align: 'center', scopedSlots: { customRender: 'action' } }
      ],
      // 概览数量字段：口径为 deploy/result 响应（to_upgrade/upgraded/failed）
      summaryFields: [
        { label: 'To Upgrade', type: 'blue', calc: result => result.to_upgrade },
        { label: 'Upgraded', type: 'green', calc: result => result.upgraded },
        { label: 'Failed', type: 'red', calc: result => result.failed }
      ],
      // 新增版本弹窗：仅选文件，上传后由服务端解析版本号与 MD5
      addModal: { visible: false, file: null, fileName: '', uploading: false }
    }
  },
  computed: {
    activeReleases () {
      return this.releases[this.activeTab] || []
    },
    activeResult () {
      return this.results[this.activeTab]
    }
  },
  watch: {
    activeTab () {
      this.loadTabData()
    }
  },
  created () {
    this.loadTabData()
  },
  methods: {
    // 加载当前页签的版本列表与当前版本推送详情
    loadTabData () {
      this.loadReleases()
      this.loadResult()
    },
    async loadReleases () {
      const appKey = this.activeTab
      this.releaseLoading = true
      try {
        const res = await fetchReleases({ app_key: appKey })
        if (appKey !== this.activeTab) return
        const d = res.data || {}
        this.releases[appKey] = Array.isArray(d) ? d : (d.releases || [])
      } catch (e) {
        this.$message.error(getErrMsg(e, 'Failed to load OTA releases'))
      } finally {
        if (appKey === this.activeTab) this.releaseLoading = false
      }
    },
    async loadResult () {
      const appKey = this.activeTab
      this.resultLoading = true
      try {
        const res = await fetchDeployResult({ app_key: appKey })
        if (appKey !== this.activeTab) return
        this.results[appKey] = res || null
      } catch (e) {
        if (appKey !== this.activeTab) return
        // 该类型从未推送过时后端可能 404，视为暂无推送详情
        if (!(e.response && e.response.status === 404)) {
          this.$message.error(getErrMsg(e, 'Failed to load push details'))
        }
        this.results[appKey] = null
      } finally {
        if (appKey === this.activeTab) this.resultLoading = false
      }
    },
    // 发版：将所选版本推送为当前使用版本
    handlePublish (record) {
      const appKey = this.activeTab
      this.$confirm({
        title: 'Publish Confirmation',
        content: `Are you sure to publish ${appKey} version ${record.version} as the current version?`,
        okText: 'Publish',
        cancelText: 'Cancel',
        onOk: () => {
          return deploy({
            release_id: record.id,
            conf_ver: record.conf_ver,
            conf_name: record.conf_name,
            conf_url: record.artifactory_url,
            conf_md5: record.md5
          }).then(() => {
            this.$message.success(`${appKey} ${record.version} published as current version`)
            this.loadTabData()
          }).catch(e => {
            this.$message.error(getErrMsg(e, 'Failed to publish version'))
          })
        }
      })
    },
    // 新增版本：打开弹窗并重置表单
    openAddModal () {
      this.addModal = { visible: true, file: null, fileName: '', uploading: false }
    },
    // 新增版本：选择安装包（拦截自动上传，仅记录文件，提交时统一上传）
    handleAddFile (file) {
      this.addModal.file = file
      this.addModal.fileName = file.name
      return false
    },
    // 新增版本：提交（multipart 上传，版本号与 MD5 由服务端解析）
    async handleAddSubmit () {
      const { file } = this.addModal
      if (!file) {
        this.$message.warning('Please select Installation Package')
        return
      }
      const appKey = this.activeTab
      const formData = new FormData()
      formData.append('file', file)
      formData.append('app_key', appKey)
      this.addModal.uploading = true
      try {
        await upload(formData)
        this.$message.success(`${appKey} ${file.name} uploaded`)
        this.addModal = { visible: false, file: null, fileName: '', uploading: false }
        this.loadReleases()
      } catch (e) {
        this.$message.error(getErrMsg(e, 'Failed to upload installation package'))
        this.addModal.uploading = false
      }
    },
    // 失败明细：定向重推单台失败主机
    handleRetry (host) {
      const appKey = this.activeTab
      this.$confirm({
        title: 'Re-push Confirmation',
        content: `Are you sure to re-push to ${host.host_name}?`,
        okText: 'Re-push',
        cancelText: 'Cancel',
        onOk: () => {
          return deploy({
            release_id: this.activeResult.release_id,
            app_key: appKey,
            host_ids: [host.host_id]
          }).then(() => {
            this.$message.success(`${host.host_name} re-push task submitted`)
            this.loadResult()
          }).catch(e => {
            this.$message.error(getErrMsg(e, 'Failed to submit re-push task'))
          })
        }
      })
    },
    // 失败类型标签配色
    stateColor (state) {
      if (state === 'Download Failed') return 'orange'
      if (state === 'Install Failed') return 'gold'
      return 'red'
    }
  }
}
</script>

<style lang="less" scoped>
.ota-management{
  height: calc(100vh - 64px)!important;
  display: block !important;
  overflow-y: auto !important;
}

.ota-layout {
  display: flex;
  align-items: flex-start;
  gap: 24px;

  // 左侧表格：当前版本行高亮
  .record-table {
    flex: 1 1 auto;
    min-width: 0;

    /deep/ .ant-table-tbody > tr.is-current-row > td {
      background-color: #e6f7ff;
    }

    .md5-cell {
      display: inline-block;
      max-width: 100%;
      overflow: hidden;
      color: rgba(0, 0, 0, 0.85);
      text-overflow: ellipsis;
      white-space: nowrap;
      vertical-align: bottom;
    }

    // 行内「发布此版本」按钮：压缩字号与内边距
    .publish-cell-btn {
      padding: 0 5px;
      font-size: 11px;
    }
  }

  // 右侧详情：浅灰底与左侧表格区分
  .record-detail {
    flex: 0 0 600px;
    padding: 16px;
    background-color: #fafafa;
    border-radius: 4px;
  }

  .detail-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
    font-weight: 600;
    font-size: 15px;
    color: rgba(0, 0, 0, 0.85);
  }

  // 概览数量：蓝(需升级) / 绿(成功) / 红(失败) 淡色卡片
  .summary-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-bottom: 16px;

    .summary-item {
      padding: 16px 8px;
      border-radius: 4px;
      text-align: center;

      .summary-value {
        font-weight: 600;
        font-size: 26px;
        line-height: 34px;
      }

      .summary-label {
        margin-top: 4px;
        font-size: 13px;
      }

      &.blue {
        background-color: #e6f7ff;

        .summary-value {
          color: #1890ff;
        }

        .summary-label {
          color: rgba(24, 144, 255, 0.75);
        }
      }

      &.green {
        background-color: #f6ffed;

        .summary-value {
          color: #52c41a;
        }

        .summary-label {
          color: rgba(82, 196, 26, 0.75);
        }
      }

      &.red {
        background-color: #fff1f0;

        .summary-value {
          color: #f5222d;
        }

        .summary-label {
          color: rgba(245, 34, 45, 0.75);
        }
      }
    }
  }

  // 失败明细表：固定表体高度，与左侧表格底部大致对齐
  .host-table {
    /deep/ .ant-table-body {
      height: 320px;
    }
    /deep/ .ant-table-pagination{
      padding-top: 10px;
    }
  }
}

// 新增版本弹窗表单
.add-field {
  display: flex;
  align-items: center;
  margin-bottom: 16px;

  &:last-child {
    margin-bottom: 0;
  }

  .add-label {
    flex: 0 0 150px;
    margin-right: 12px;
    text-align: right;
    color: rgba(0, 0, 0, 0.85);
  }

  .required-star {
    margin-right: 4px;
    color: #f5222d;
    font-family: SimSun, sans-serif;
  }

  .add-file {
    flex: 1 1 auto;
    min-width: 0;
    margin-left: 8px;
    overflow: hidden;
    color: rgba(0, 0, 0, 0.65);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>

<template>
  <!-- 一级功能页：面包屑仅显示功能名本身（覆盖 matched 多层级默认渲染） -->
  <page-header-wrapper :breadcrumb="{ props: { routes: [{ path: '/ota-management', breadcrumbName: $t('menu.ota-management') }] } }">
    <a-card :bordered="false">
      <a-tabs v-model="activeTab">
        <!-- 新增版本：与 tab 标题平齐，显示在右侧 -->
        <a-button slot="tabBarExtraContent" type="primary" @click="openAddModal">New Version</a-button>
        <a-tab-pane v-for="sys in systems" :key="sys.key">
          <span slot="tab">
            <a-icon :type="sys.icon" />
            {{ sys.key }}
          </span>
          <div class="ota-layout">
            <!-- 左侧：部署记录表格，支持滚动翻页，单击行切换右侧详情 -->
            <div class="record-table">
              <a-table
                row-key="id"
                :columns="columns"
                :data-source="sys.records"
                :pagination="{ pageSize: 10, size: 'small' }"
                :scroll="{ y: 450 }"
                :custom-row="record => tableRowProps(sys, record)"
              >
                <template slot="current" slot-scope="text, row">
                  <a-tag v-if="text" color="green">Current</a-tag>
                  <!-- 非当前版本：行内发版 -->
                  <a-button
                    v-else
                    type="primary"
                    size="small"
                    class="publish-cell-btn"
                    @click.stop="handlePublish(sys, row)"
                  >
                    Publish
                  </a-button>
                </template>
                <template slot="md5" slot-scope="text">
                  <span class="md5-cell" :title="text">{{ text }}</span>
                </template>
              </a-table>
            </div>
            <!-- 右侧：当前条目推送详情 -->
            <div class="record-detail">
              <template v-if="getActiveRecord(sys)">
                <div class="detail-title">
                  <span>{{ getActiveRecord(sys).version }} Push Details</span>
                </div>
                <!-- 概览数量 -->
                <div class="summary-grid">
                  <div v-for="stat in summaryFields" :key="stat.label" class="summary-item" :class="stat.type">
                    <div class="summary-value">{{ stat.calc(getActiveRecord(sys)) }}</div>
                    <div class="summary-label">{{ stat.label }}</div>
                  </div>
                </div>
                <!-- 失败明细：推送失败 / 下载失败 / 安装失败，悬停展示异常信息，支持重新推送 -->
                <a-table
                  row-key="id"
                  class="host-table"
                  :columns="getHostColumns(getActiveRecord(sys))"
                  :data-source="getActiveRecord(sys).failedHosts"
                  :pagination="{ pageSize: 5, size: 'small' }"
                >
                  <template slot="type" slot-scope="text, row">
                    <a-tooltip placement="top" :title="row.errorMsg">
                      <a-tag v-if="text === 'push'" color="red">Push Failed</a-tag>
                      <a-tag v-else-if="text === 'download'" color="orange">Download Failed</a-tag>
                      <a-tag v-else color="gold">Install Failed</a-tag>
                    </a-tooltip>
                  </template>
                  <template slot="action" slot-scope="text, row">
                    <a-tooltip placement="top" :title="`Re-push to ${text}`">
                      <a-button type="link" size="small" @click="handleRetry(getActiveRecord(sys), row)">
                        Retry
                      </a-button>
                    </a-tooltip>
                  </template>
                </a-table>
              </template>
              <a-empty v-else description="Please select a record" />
            </div>
          </div>
        </a-tab-pane>
      </a-tabs>

      <!-- 新增版本弹窗 -->
      <a-modal
        title="New Version"
        :visible="addModal.visible"
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
        <div class="add-field">
          <span class="add-label">MD5:</span>
          <a-input v-model="addModal.md5" placeholder="Auto-generated" />
        </div>
      </a-modal>
    </a-card>
  </page-header-wrapper>
</template>

<script>
// mock：各失败类型的示例异常信息
const MOCK_ERROR_MESSAGES = {
  push: [
    'Device offline',
    'Connection timeout',
    'Network unreachable'
  ],
  download: [
    'Checksum mismatch',
    'Download timed out',
    'Insufficient storage'
  ],
  install: [
    'Install script exited with code 1',
    'Version verification failed',
    'Incompatible device firmware'
  ]
}

export default {
  name: 'OtaManagement',
  data () {
    return {
      activeTab: 'agent',
      // 记录表格列
      columns: [
        { title: 'Version', dataIndex: 'version', width: 80 },
        { title: 'Installation Package', dataIndex: 'fileName', width: 160 },
        { title: 'MD5', dataIndex: 'md5', scopedSlots: { customRender: 'md5' } },
        { title: 'Current', dataIndex: 'current', width: 160, align: 'center', scopedSlots: { customRender: 'current' } }
      ],
      // 概览数量字段：升级失败数含推送失败与设备下载失败
      summaryFields: [
        { label: 'To Upgrade', type: 'blue', calc: record => record.stats.needPush },
        { label: 'Upgraded', type: 'green', calc: record => record.stats.installSuccess },
        { label: 'Failed', type: 'red', calc: record => record.stats.pushFailed + record.stats.downloadFailed + record.stats.installFailed }
      ],
      // 新增版本弹窗
      addModal: { visible: false, fileName: '', md5: '' },
      // TODO: 对接 OTA 记录查询接口，以下为模拟数据
      systems: [
        {
          key: 'agent',
          icon: 'robot',
          activeId: 1,
          records: [
            { id: 1, version: '1.2.0', fileName: 'agent-1.2.0.zip', md5: 'e10adc3949ba59abbe56e057f20f883e', current: true, stats: { needPush: 120, pushed: 96, pushFailed: 24, downloadFailed: 6, installSuccess: 88, installFailed: 2 } },
            { id: 2, version: '1.1.3', fileName: 'agent-1.1.3.zip', md5: 'c4ca4238a0b923820dcc509a6f75849b', current: false, stats: { needPush: 200, pushed: 200, pushFailed: 0, downloadFailed: 4, installSuccess: 194, installFailed: 2 } },
            { id: 3, version: '1.1.0', fileName: 'agent-1.1.0.zip', md5: '28c8edde3d61a0411511d3b1866f0636', current: false, stats: { needPush: 150, pushed: 132, pushFailed: 18, downloadFailed: 10, installSuccess: 119, installFailed: 3 } }
          ]
        },
        {
          key: 'ek',
          icon: 'usb',
          activeId: 1,
          records: [
            { id: 1, version: '2.0.1', fileName: 'ek-2.0.1.pkg', md5: '6512bd43d9caa6e02c990b0a82652dca', current: true, stats: { needPush: 80, pushed: 65, pushFailed: 15, downloadFailed: 5, installSuccess: 58, installFailed: 2 } },
            { id: 2, version: '2.0.0', fileName: 'ek-2.0.0.pkg', md5: 'd3d9446802a44259755d38e6d163e820', current: false, stats: { needPush: 80, pushed: 80, pushFailed: 0, downloadFailed: 2, installSuccess: 76, installFailed: 2 } }
          ]
        },
        {
          key: 'dmr_config',
          icon: 'setting',
          activeId: 1,
          records: [
            { id: 1, version: '1.0.4', fileName: 'dmr_config-1.0.4.bin', md5: '8f14e45fceea167a5a36dedd4bea2543', current: true, stats: { needPush: 60, pushed: 42, pushFailed: 18, downloadFailed: 3, installSuccess: 38, installFailed: 1 } },
            { id: 2, version: '1.0.3', fileName: 'dmr_config-1.0.3.bin', md5: '7f6ffaa6bb0b408017b622542116a016', current: false, stats: { needPush: 60, pushed: 60, pushFailed: 0, downloadFailed: 1, installSuccess: 58, installFailed: 1 } }
          ]
        }
      ]
    }
  },
  created () {
    // mock：为 agent 补充历史版本记录，便于演示翻页
    const agent = this.systems[0]
    for (let i = 8; i >= 1; i--) {
      agent.records.push({
        id: agent.records.length + 1,
        version: `1.0.${i}`,
        fileName: `agent-1.0.${i}.zip`,
        md5: this.randomMd5(),
        current: false,
        stats: { needPush: 60 + i, pushed: 60 + i, pushFailed: 0, downloadFailed: i, installSuccess: 58, installFailed: 2 }
      })
    }
    // 派生 mock：失败 host 明细
    this.systems.forEach(sys => {
      sys.records.forEach(record => {
        record.failedHosts = this.buildFailedHosts(record)
      })
    })
  },
  methods: {
    // 表格行：单击选中，当前行高亮
    tableRowProps (sys, record) {
      return {
        class: record.id === sys.activeId ? 'is-active-row' : '',
        on: {
          click: () => this.selectRecord(sys, record)
        }
      }
    },
    // 单击左侧条目：切换右侧详情
    selectRecord (sys, record) {
      sys.activeId = record.id
    },
    getActiveRecord (sys) {
      return sys.records.find(record => record.id === sys.activeId)
    },
    // 失败明细列：仅当前使用版本显示操作列（重新推送）
    getHostColumns (record) {
      const cols = [
        { title: 'Host Name', dataIndex: 'host', width: 110 },
        { title: 'Type', dataIndex: 'type', width: 180, align: 'center', scopedSlots: { customRender: 'type' } }
      ]
      if (record.current) {
        cols.push({ title: 'Action', dataIndex: 'host', key: 'action', width: 120, align: 'center', scopedSlots: { customRender: 'action' } })
      }
      return cols
    },
    // 发版：将所选版本设为当前使用版本
    handlePublish (sys, record) {
      this.$confirm({
        title: 'Publish Confirmation',
        content: `Are you sure to publish ${sys.key} version ${record.version} as the current version?`,
        okText: 'Publish',
        cancelText: 'Cancel',
        onOk: () => {
          // TODO: 对接发版接口，此处模拟本地切换当前版本
          sys.records.forEach(item => { item.current = item.id === record.id })
          this.$message.success(`${sys.key} ${record.version} published as current version`)
        }
      })
    },
    // 新增版本：打开弹窗并重置表单
    openAddModal () {
      this.addModal = { visible: true, version: '', fileName: '', md5: '' }
    },
    // 新增版本：选择安装包（拦截上传，仅取文件信息，MD5 模拟生成）
    handleAddFile (file) {
      this.addModal.fileName = file.name
      this.addModal.md5 = this.randomMd5()
      return false
    },
    // 新增版本：提交
    handleAddSubmit () {
      const { fileName } = this.addModal

      if (!fileName) {
        this.$message.warning('Please select Installation Package')
        return
      }
      const sys = this.systems.find(item => item.key === this.activeTab)
      const id = sys.records.reduce((max, item) => Math.max(max, item.id), 0) + 1
      const record = {
        id,
        fileName,
        md5: this.addModal.md5,
        current: false,
        stats: { needPush: 0, pushed: 0, pushFailed: 0, downloadFailed: 0, installSuccess: 0, installFailed: 0 },
        failedHosts: []
      }
      sys.records.unshift(record)
      sys.activeId = id
      this.addModal.visible = false
      this.$message.success(`${sys.key} ${fileName} created`)
    },
    // mock：失败 host 明细（推送失败 / 下载失败 / 安装失败三类）
    buildFailedHosts (record) {
      const hosts = []
      let seq = 1
      const append = (count, type) => {
        const messages = MOCK_ERROR_MESSAGES[type]
        for (let i = 0; i < count; i++) {
          hosts.push({
            id: seq,
            host: `host-${String(seq++).padStart(3, '0')}`,
            type,
            errorMsg: messages[Math.floor(Math.random() * messages.length)]
          })
        }
      }
      append(record.stats.pushFailed, 'push')
      append(record.stats.downloadFailed, 'download')
      append(record.stats.installFailed, 'install')
      return hosts
    },
    // 失败明细：重新推送，成功后移出失败列表并同步统计
    handleRetry (record, host) {
      this.$confirm({
        title: 'Re-push Confirmation',
        content: `Are you sure to re-push to ${host.host}?`,
        okText: 'Re-push',
        cancelText: 'Cancel',
        onOk: () => {
          // TODO: 对接重新推送接口，此处模拟重推成功
          return new Promise(resolve => {
            setTimeout(() => {
              const stats = record.stats
              if (host.type === 'push') {
                stats.pushFailed--
              } else if (host.type === 'download') {
                stats.downloadFailed--
              } else {
                stats.installFailed--
              }
              record.failedHosts.splice(record.failedHosts.indexOf(host), 1)
              this.$message.success(`${host.host} re-push task submitted`)
              resolve()
            }, 500)
          })
        }
      })
    },
    // mock：随机 32 位 MD5
    randomMd5 () {
      let s = ''
      while (s.length < 32) {
        s += Math.random().toString(16).slice(2)
      }
      return s.slice(0, 32)
    }
  }
}
</script>

<style lang="less" scoped>
.ota-layout {
  display: flex;
  align-items: flex-start;
  gap: 24px;

  // 左侧表格：行可点击，选中行高亮
  .record-table {
    flex: 1 1 auto;
    min-width: 0;

    /deep/ .ant-table-tbody > tr {
      cursor: pointer;
    }

    /deep/ .ant-table-tbody > tr.is-active-row > td {
      background-color: #bae7ff;
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

  .host-title {
    margin-bottom: 12px;
    font-weight: 500;
    font-size: 14px;
    color: rgba(0, 0, 0, 0.85);
  }

  // 失败明细表：固定表体高度，与左侧表格底部大致对齐
  .host-table {
    /deep/ .ant-table-body {
      height: 320px;
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
